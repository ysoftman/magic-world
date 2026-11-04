import Phaser from "phaser";
import type { FxModule } from "pixelfx";
import * as blinkIn from "pixelfx/fx/arcane/blink-in";
import * as blinkOut from "pixelfx/fx/arcane/blink-out";
import { Sfx } from "../audio";
import { bakePixelSheet, type PixelSheet, sheetInfo, warmSheets } from "../fx";
import { GameState } from "../gameState";
import { ART_PX, texelsOf } from "../pixelart";
import { GEAR_LAYOUT } from "./HeroGear";

// The ABYSS's portals taken: the hero blinks out of the field in violet light
// and blinks in on the floor below (pixelfx's arcane/blink-out and blink-in,
// MIT, by Patch and Hugo Duprez after Sprite Fusion's blink). Out by the
// town's gate, the cave's stair and a floor's stair down (sceneCommon's
// askAbyssDive, AbyssScene's tryDescend), in on every floor arrived at
// (AbyssScene's create); a plain exit keeps walkOut's fade.
//
// Both act on a body (o.actor), so each is baked from the hero's own picture,
// not pixelfx's 24x38 stand-in, which they would draw over the hero: the idle
// frame facing the camera and the gear in its hands (HeroGear's "down"), one
// art cell (ART_PX texels) to a pixelfx pixel, as statusFx.ts reads a
// battler. The hero turns to the camera as a warp starts (HeroWalk.hold), so
// one body serves both ways, whatever the hero faced. A look or gear changed
// is a new body, its sheets keyed by its picture's hash.
//
// Each plays faster than the effect's own time (1.2x out, 1.33x in) so a
// warp seen every floor stays short: out 820ms, the camera's 200ms fade over
// its last stretch, in 720ms. Over the hero and its gear (10, 10.5), under
// the map's tags (11) and the night (90), as a treasure dig's chest is.

/** The hero's walk as a warp takes it over (sceneCommon's HeroWalk). */
export interface WarpWalker {
  readonly hero: Phaser.GameObjects.Sprite;
  /** stands the hero turned to the camera (true), or gives the walk back */
  hold(on: boolean): void;
  /** the hero, its shadow and gear, and the companion (as the hero unless given) */
  setAlpha(alpha: number, companion?: number): void;
}

// The gate's violets (abyssRift.ts's rift: ABYSS_GATE_PALETTE's K, p, r and V,
// the gate glow's G), a pale step and white: the effect's arcane ramp is pinker
const VIOLET = ["#0b0614", "#1e0b3d", "#4c1d95", "#6d28d9", "#8b5cf6", "#b197fc", "#e4d8ff", "#ffffff"];

// Its glow, baked as colour with alpha (pixelfx's light): a step under the
// effect's 1, set by eye on the town's grass and the ABYSS's dark floor. With
// FLASHES off or the OS's reduced motion, the 0.35 the battle's soft effects use.
const LIGHT = 0.7;
const SOFT_LIGHT = 0.35;

const WARP_DEPTH = 10.6;
const OUT_MS = 820;
const IN_MS = 720;
// walkOut's fade, over the out's last stretch: its sparks drift off into black
const OUT_FADE_MS = 200;
// the companion, which the effect does not draw: fading out as the hero
// gathers light (gone as the hero is), and back in this long once it is whole
const COMPANION_IN_MS = 250;
// frames a new scene runs before the in plays: the first is handed the whole
// load as its delta (TownScene's checkEncounter), which would skip the in's start
const IN_WAIT_FRAMES = 2;

type Way = "out" | "in";

// what each way plays: the sampled stretch and frames, and the part of the
// canvas kept round the anchor (the feet). Out: the outline crackling on
// (0-0.32), the squeeze to a line (to 0.52), the pop and its drifting motes;
// cut at 1.0, the last few dots. In: the bits spiralling in (from 0.02, the
// first with any), the line opening into the white body (0.48), the cooling
// and the ring, to 0.98. Crops: the opaque reach over the span with the
// hero's 54-cell body (gear and all) and some air, measured at light 1.
// The effect, and how much of its body it leaves the host to draw at effect
// time t (its actorAlpha, which env.d.ts leaves out): the hero hides as the
// out flashes white (0.32) and shows as the in's silhouette opens (0.48).
type Acting = FxModule & { actorAlpha: (t: number) => number };
interface WarpWay {
  fx: Acting;
  span: [number, number];
  frames: number;
  box: [number, number, number, number];
}
const WAYS: Record<Way, WarpWay> = {
  out: { fx: blinkOut as unknown as Acting, span: [0, 1], frames: 25, box: [-56, -64, 56, 16] },
  in: { fx: blinkIn as unknown as Acting, span: [0.02, 0.98], frames: 24, box: [-50, -62, 50, 16] },
};

// the scenes a warp has: their FieldKeys.leaving() holds meanwhile
const active = new WeakSet<Phaser.Scene>();

/** Whether a warp is playing in `scene`, out or in: its keys are dropped as in a fade (FieldKeys.leaving). */
export function warping(scene: Phaser.Scene): boolean {
  return active.has(scene);
}

const reducedMotion = (): boolean => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

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

// a body read off the art: its actor, the texels from the hero's middle down
// to its feet (the anchor), and a hash of its picture for the sheets' keys
interface Body {
  actor: Actor;
  feet: number;
  id: string;
}

// The hero facing the camera with the gear it wears, as the field draws it
// (HeroGear's "down": both over the hero, the shield's sprite made after the
// weapon's): each picture's middle `dx`, `dy` screen px off the hero's.
function layers(): { key: string; dx: number; dy: number; flip: boolean }[] {
  const { weapon, shield } = GEAR_LAYOUT.down;
  return [
    { key: "hero-idle-down", dx: 0, dy: 0, flip: false },
    ...(GameState.equipped.weapon ? [{ key: GameState.weaponTexture(), dx: weapon.x, dy: weapon.y, flip: weapon.flip }] : []),
    ...(GameState.equipped.armor ? [{ key: GameState.armorTexture(), dx: shield.x, dy: shield.y, flip: shield.flip }] : []),
  ];
}

// The body read back on the art grid, cells counted from the hero's middle:
// a cell is on when any of its texels is, in that texel's colour, the later
// picture over the earlier. Off each picture's own canvas (texelsOf), about
// 0.5ms a read.
function bodyOf(scene: Phaser.Scene): Body | null {
  const cells = new Map<number, number>();
  const at = (cx: number, cy: number): number => (cy + 512) * 1024 + cx + 512;
  let [left, right, top, bottom] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const { key, dx, dy, flip } of layers()) {
    const frame = scene.textures.getFrame(key);
    const src = frame?.source.image;
    if (!frame || !(src instanceof HTMLCanvasElement || src instanceof HTMLImageElement)) return null;
    const [tw, th] = [frame.cutWidth, frame.cutHeight];
    const data = texelsOf(src, frame.cutX, frame.cutY, tw, th);
    if (!data) return null;
    const [w, h] = [Math.ceil(tw / ART_PX), Math.ceil(th / ART_PX)];
    const [ox, oy] = [Math.round((dx - tw / 2) / ART_PX), Math.round((dy - th / 2) / ART_PX)];
    for (let cy = 0; cy < h; cy++)
      for (let cx = 0; cx < w; cx++)
        for (let k = 0; k < ART_PX * ART_PX; k++) {
          const x = cx * ART_PX + (k % ART_PX);
          const y = cy * ART_PX + Math.floor(k / ART_PX);
          if (x >= tw || y >= th) continue;
          const i = (y * tw + x) * 4;
          if (data[i + 3] === 0) continue;
          const [mx, my] = [ox + (flip ? w - 1 - cx : cx), oy + cy];
          // pixelfx colours are ImageData bytes read as one number: R in the low byte
          cells.set(at(mx, my), ((255 << 24) | (data[i + 2] << 16) | (data[i + 1] << 8) | data[i]) >>> 0);
          [left, right, top, bottom] = [Math.min(left, mx), Math.max(right, mx), Math.min(top, my), Math.max(bottom, my)];
          break;
        }
  }
  if (right < left) return null;
  const [w, h] = [right - left + 1, bottom - top + 1];
  const mask = new Uint8Array(w * h);
  const pixels = new Uint32Array(w * h);
  // FNV-1a over the picture, its size first
  let hash = Math.imul(0x811c9dc5 ^ (w * 4096 + h), 0x01000193) >>> 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = cells.get(at(left + x, top + y)) ?? 0;
      mask[y * w + x] = c ? 1 : 0;
      pixels[y * w + x] = c;
      hash = Math.imul(hash ^ c, 0x01000193) >>> 0;
    }
  // the feet: the line under the lowest cell, the hero's middle being cell 0's top
  const ay = -h;
  return {
    actor: { mask: { w, h, data: mask }, pixels, x: left, y: ay, w, h, k: 2, head: [0, ay], chest: [0, Math.round(ay * 0.6)] },
    feet: (bottom + 1) * ART_PX,
    id: hash.toString(36),
  };
}

const soft = (): boolean => !GameState.flashes || reducedMotion();

const keyOf = (way: Way, body: Body, isSoft: boolean): string => `warp-${way}:${body.id}${isSoft ? ":soft" : ""}`;

function sheetOf(way: Way, body: Body, isSoft: boolean): PixelSheet {
  const { fx, span, frames, box } = WAYS[way];
  const [ax, ay] = fx.meta.origin;
  const [W, H] = fx.meta.size;
  return {
    fx,
    opts: { palette: VIOLET, actor: body.actor, light: isSoft ? SOFT_LIGHT : LIGHT },
    span,
    frames,
    crop: [Math.max(0, ax + box[0]), Math.max(0, ay + box[1]), Math.min(W, ax + box[2]), Math.min(H, ay + box[3])],
  };
}

// the sheets of the body last warmed, so a body worn no more lets its go
let warmed: string[] = [];

/**
 * Bakes both ways for the hero as it looks now, a slice of each of `scene`'s
 * frames (fx.ts warmSheets): called by a scene with a way into the ABYSS as
 * it is made, and again as the gate or the stair asks, in case the look or
 * gear changed since. The last body's sheets go once another is warmed (in a
 * create, so no warp is playing them). A warp that comes first bakes its own
 * there and then (play()).
 */
export function warmWarp(scene: Phaser.Scene): void {
  const body = bodyOf(scene);
  if (!body) return;
  const isSoft = soft();
  const keys = (["out", "in"] as const).map((way) => keyOf(way, body, isSoft));
  for (const key of warmed) if (!keys.includes(key) && scene.textures.exists(key)) scene.textures.remove(key);
  warmed = keys;
  warmSheets(scene, {
    [keys[0]]: sheetOf("out", body, isSoft),
    [keys[1]]: sheetOf("in", body, isSoft),
  });
}

// Plays `way` on the hero over `ms`: its frames stepped evenly, the hero, its
// shadow and gear shown as the effect would show its body (actorAlpha), then
// `done`. The companion fades out over the out's gathering, to be gone with
// the hero, and stays out through the in (warpIn brings it back after). A
// sheet no warm has baked yet is baked here.
function play(scene: Phaser.Scene, walker: WarpWalker, way: Way, ms: number, done: () => void): void {
  const body = bodyOf(scene);
  if (!body) {
    walker.setAlpha(way === "out" ? 0 : 1);
    done();
    return;
  }
  const isSoft = soft();
  const key = keyOf(way, body, isSoft);
  const sheet = sheetOf(way, body, isSoft);
  if (!scene.textures.exists(key)) {
    const t0 = performance.now();
    bakePixelSheet(scene, key, sheet);
    if (process.env.NODE_ENV !== "production")
      console.info(`[warpFx] ${key} baked on the spot in ${(performance.now() - t0).toFixed(1)}ms`);
  }
  const { fx, span, frames } = WAYS[way];
  const shown = fx.actorAlpha;
  const { hero } = walker;
  const sprite = scene.add
    .sprite(hero.x, hero.y + body.feet, key, 0)
    .setOrigin(...sheetInfo(sheet).origin)
    .setScale(ART_PX)
    .setDepth(WARP_DEPTH);
  const frameAt = (u: number): number => Math.min(frames - 1, Math.floor(u * frames));
  const bodyAt = (f: number): number => shown(span[0] + (f * (span[1] - span[0])) / frames);
  // the share of the out by which the hero is gone (its first hidden frame)
  let gone = 0;
  while (gone < frames && bodyAt(gone) > 0) gone++;
  const companionAt = (u: number): number => (way === "in" ? 0 : Math.max(0, 1 - u / Math.max(1e-6, gone / frames)));
  const show = (u: number): void => {
    const f = frameAt(u);
    sprite.setFrame(f);
    walker.setAlpha(bodyAt(f), companionAt(u));
  };
  show(0);
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: ms,
    onUpdate: (tw) => show(tw.getValue() ?? 0),
    onComplete: () => {
      sprite.destroy();
      done();
    },
  });
}

function begin(scene: Phaser.Scene, walker: WarpWalker): void {
  active.add(scene);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => active.delete(scene));
  walker.hold(true);
}

/**
 * Into a portal: the hero stops and turns to the camera, gathers violet light
 * and blinks out, the camera fading over its last sparks, then `next`, the
 * scene change. FieldKeys.leaving() from the start, so Q, the panel keys and
 * a talk's Z are dropped throughout, as in walkOut's fade; the scene's own
 * flag, set before, keeps a fight or a second way out from starting over it.
 */
export function warpOut(scene: Phaser.Scene, walker: WarpWalker, next: () => void): void {
  begin(scene, walker);
  Sfx.emit("warp-out");
  play(scene, walker, "out", OUT_MS, () => {});
  scene.time.delayedCall(OUT_MS - OUT_FADE_MS, () => {
    scene.cameras.main.fadeOut(OUT_FADE_MS, 0, 0, 0);
    scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, next);
  });
}

/**
 * Out of a portal, on arriving: the hero, hidden and held from here, blinks
 * in where it stands once the scene's first frames are past, and walks on
 * when it is whole, its companion fading in beside it. Its keys are dropped
 * meanwhile (FieldKeys.leaving). Cut off by the scene's end, nothing carries
 * over: the next scene makes its hero and companion anew, at alpha 1.
 */
export function warpIn(scene: Phaser.Scene, walker: WarpWalker): void {
  begin(scene, walker);
  walker.setAlpha(0);
  let wait = IN_WAIT_FRAMES;
  const start = (): void => {
    if (--wait > 0) return;
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, start);
    Sfx.emit("warp-in");
    play(scene, walker, "in", IN_MS, () => {
      walker.setAlpha(1, 0);
      walker.hold(false);
      active.delete(scene);
      scene.tweens.addCounter({ from: 0, to: 1, duration: COMPANION_IN_MS, onUpdate: (tw) => walker.setAlpha(1, tw.getValue() ?? 1) });
    });
  };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, start);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, start));
}

/** How long a warp in holds the hero, for a scene's grace before a fight. */
export const WARP_IN_MS = IN_MS;
