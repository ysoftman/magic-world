import Phaser from "phaser";
import * as divineShield from "pixelfx/fx/holy/divine-shield";
import * as heal from "pixelfx/fx/holy/heal";
import * as freeze from "pixelfx/fx/ice/freeze";
import * as electrified from "pixelfx/fx/lightning/electrified";
import * as burning from "pixelfx/fx/status/burning";
import * as frozen from "pixelfx/fx/status/frozen";
import * as poisoned from "pixelfx/fx/status/poisoned";
import { bakePixelSheet, type PixelSheet } from "./fx";
import { ART_PX } from "./pixelart";

// The battle's status and recovery effects: pixelfx effects that act on a
// body (o.actor), handed the battler's own picture instead of pixelfx's 24x38
// stand-in. Drawn with the stand-in they paint that figure over the monster
// (burning's flames float at its head height, poisoned and frozen repaint its
// whole body), so each sheet is baked for one battler: its texture read back
// one art cell (ART_PX texels) to a pixelfx pixel, mirrored as the sprite is.
// Baked on first use and kept for the battle, one per battler, effect and,
// for poison, the tint the battler shows: the effect repaints the body, and
// the purple it is flashed has to stay purple under it.

export type StatusKind = "heal" | "ward" | "burn" | "chill" | "shock" | "poison" | "freeze";

// a fx.ts pixel sheet over the whole canvas, its span and frames set; tinted:
// the battler's tint at play() baked into its colours
interface StatusSheet extends PixelSheet {
  span: [number, number];
  frames: number;
  tinted?: boolean;
}

// ramps, dark to bright: the battle's own colours for each (the HEAL spell's
// green, WARD's blue, the burn's red rim, FREEZE_TINT's cyan, PSN's purple)
const HEAL_RAMP = ["#08201a", "#0f3f2c", "#17663e", "#24924e", "#3ec466", "#7ee88a", "#c8ffc4", "#ffffff"];
const WARD_RAMP = ["#0b1838", "#15306b", "#1e4fa0", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#ffffff"];
// a step darker than burning's own: its yellow tongues were lost on a foe flashed orange
const BURN_RAMP = ["#3a0d0a", "#7a1610", "#b91c1c", "#dc2626", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6"];
const ICE_RAMP = ["#0b2a3a", "#0e4a63", "#0e7490", "#22a6c4", "#67e8f9", "#a5f3fc", "#cffafe", "#ffffff"];
const PSN_RAMP = ["#1a0533", "#3b0764", "#581c87", "#7e22ce", "#a855f7", "#c084fc", "#e9d5ff", "#f5d0fe"];

const STATUS_SHEETS: Record<StatusKind, StatusSheet> = {
  // petals at the feet, a hoop of light climbing the body as it washes pale
  // and comes back, motes rising; the tail where the last of them pop is left off
  heal: { fx: heal, opts: { palette: HEAL_RAMP }, span: [0.05, 1.45], frames: 12 },
  // a bubble round the hero, meridians turning, a sheen and sparkles; a loop,
  // so a stretch of it. Radius 20 fits a 32-cell battler (29 is the stand-in's)
  ward: { fx: divineShield, opts: { palette: WARD_RAMP, radius: 20 }, span: [0, 0.8], frames: 8 },
  // one tick of burning: the body flashes white then orange, tongues lick from
  // its outline, scorch, sparks and smoke (a second tick would flash it again)
  burn: { fx: burning, opts: { palette: BURN_RAMP }, span: [0, 0.6], frames: 10 },
  // frosted over (status/frozen): the body redrawn in ice, rime, snow above, frost underfoot
  chill: { fx: frozen, opts: { palette: ICE_RAMP }, span: [0, 0.9], frames: 10 },
  // arcs crawling over the outline, two jolts that flare the whole body
  shock: { fx: electrified, span: [0, 1], frames: 10 },
  // one tick of poisoned: purple rolling up the body, blisters popping, a ring
  // on the floor, sweat dripping
  poison: { fx: poisoned, opts: { palette: PSN_RAMP, veins: "#1a0533" }, span: [0, 0.8], frames: 10, tinted: true },
  // frost races in and climbs the hero, a block of ice crystallizes round it
  // and glints; it cracks and bursts later, past the span: the hero stays frozen
  freeze: { fx: freeze, opts: { palette: ICE_RAMP }, span: [0.1, 1.5], frames: 12 },
};

// pixelfx's o.actor: the body's silhouette and colours in effect pixels, feet at (0, 0)
interface Actor {
  mask: { w: number; h: number; data: Uint8Array };
  pixels: Uint32Array;
  x: number;
  y: number;
  w: number;
  h: number;
  k: number;
  head: [number, number];
  chest: [number, number];
}

type Rgb = [number, number, number];

// what the battler's tint does to a colour, for the colours an effect repaints
function tintOf(sprite: Phaser.GameObjects.Sprite): { id: string; apply: (c: Rgb) => Rgb } | null {
  const t = sprite.tintTopLeft;
  const tr = (t >> 16) & 255;
  const tg = (t >> 8) & 255;
  const tb = t & 255;
  const id = t.toString(16).padStart(6, "0");
  if (sprite.tintMode === Phaser.TintModes.FILL) return { id: `fill-${id}`, apply: () => [tr, tg, tb] };
  if (sprite.tintMode === Phaser.TintModes.MULTIPLY && t !== 0xffffff)
    return { id: `mul-${id}`, apply: ([r, g, b]) => [Math.round((r * tr) / 255), Math.round((g * tg) / 255), Math.round((b * tb) / 255)] };
  return null;
}

// The sprite's frame read back on the art grid: a cell is on when any of its
// texels is, in that texel's colour. `feet` is the texels from the frame's top
// to the line under its lowest cell, where the effect's anchor goes.
function actorOf(sprite: Phaser.GameObjects.Sprite, tint: ((c: Rgb) => Rgb) | null): { actor: Actor; feet: number } | null {
  const frame = sprite.frame;
  const src = frame.source.image;
  if (!(src instanceof HTMLCanvasElement || src instanceof HTMLImageElement)) return null;
  const tw = frame.cutWidth;
  const th = frame.cutHeight;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  ctx.canvas.width = tw;
  ctx.canvas.height = th;
  ctx.drawImage(src, frame.cutX, frame.cutY, tw, th, 0, 0, tw, th);
  const data = ctx.getImageData(0, 0, tw, th).data;
  const w = Math.ceil(tw / ART_PX);
  const h = Math.ceil(th / ART_PX);
  const mask = new Uint8Array(w * h);
  const pixels = new Uint32Array(w * h);
  let bottom = 0;
  for (let cy = 0; cy < h; cy++)
    for (let cx = 0; cx < w; cx++)
      for (let k = 0; k < ART_PX * ART_PX; k++) {
        const x = cx * ART_PX + (k % ART_PX);
        const y = cy * ART_PX + Math.floor(k / ART_PX);
        if (x >= tw || y >= th) continue;
        const i = (y * tw + x) * 4;
        if (data[i + 3] === 0) continue;
        const [r, g, b] = tint ? tint([data[i], data[i + 1], data[i + 2]]) : [data[i], data[i + 1], data[i + 2]];
        // mirrored as the sprite is drawn
        const at = cy * w + (sprite.flipX ? w - 1 - cx : cx);
        mask[at] = 1;
        // pixelfx colours are ImageData bytes read as one number: R in the low byte
        pixels[at] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
        bottom = Math.max(bottom, cy);
        break;
      }
  const x = -Math.floor(w / 2);
  const y = -(bottom + 1);
  return {
    actor: { mask: { w, h, data: mask }, pixels, x, y, w, h, k: 2, head: [0, y], chest: [0, Math.round(y * 0.6)] },
    feet: (bottom + 1) * ART_PX,
  };
}

/**
 * The status and recovery effects of one battle, at depth 0 as playFx's are:
 * the stat windows draw over them. The sheets go with the battle.
 */
export class StatusFx {
  // each baked sheet's key, and the texels from its battler's top to its feet
  private readonly feet = new Map<string, number>();

  constructor(private readonly scene: Phaser.Scene) {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const key of this.feet.keys()) scene.textures.remove(key);
      this.feet.clear();
    });
  }

  /**
   * Plays `kind` on `target` (shown at `scale`, its own: 2, 3 on a boss) for
   * `ms`, its anchor on the battler's feet. It follows the battler, which
   * breathes under it, so a repainted body stays on the sprite.
   */
  play(target: Phaser.GameObjects.Sprite, kind: StatusKind, ms: number, scale: number): void {
    const sheet = STATUS_SHEETS[kind];
    const tint = sheet.tinted ? tintOf(target) : null;
    const key = `status-${kind}:${target.texture.key}:${target.frame.name}${target.flipX ? ":flip" : ""}${tint ? `:${tint.id}` : ""}`;
    let feet = this.feet.get(key);
    if (feet === undefined) {
      const body = actorOf(target, tint?.apply ?? null);
      if (!body) return;
      bakePixelSheet(this.scene, key, { ...sheet, opts: { ...sheet.opts, actor: body.actor } });
      feet = body.feet;
      this.feet.set(key, feet);
    }
    const {
      size: [w, h],
      origin: [ax, ay],
    } = sheet.fx.meta;
    // from the battler's middle (its origin) down to its feet
    const drop = (feet - target.frame.cutHeight / 2) * scale;
    const sprite = this.scene.add
      .sprite(target.x, target.y + drop, key, 0)
      .setOrigin(ax / w, ay / h)
      .setScale(scale * ART_PX);
    this.scene.tweens.addCounter({
      from: 0,
      to: sheet.frames,
      duration: Math.max(1, ms),
      onUpdate: (tw) => {
        sprite.setFrame(Math.min(sheet.frames - 1, Math.floor(tw.getValue() ?? 0)));
        sprite.setPosition(target.x, target.y + drop);
      },
      onComplete: () => sprite.destroy(),
    });
  }
}
