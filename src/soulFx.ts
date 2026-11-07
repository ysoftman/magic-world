import Phaser from "phaser";
import type { FxModule } from "pixelfx";
import * as soulRise from "pixelfx/fx/spawn/soul-rise";
import { bakePixelSheet, type PixelSheet, sheetInfo, warmSheets } from "./fx";
import { GameState } from "./gameState";
import { ART_PX, texelsOf } from "./pixelart";
import { fadeAboveCeiling, hdBody } from "./statusFx";
import { GEAR_LAYOUT } from "./ui/HeroGear";

// The hero's fall in a battle (BattleScene defeat): its outline flares, a pale
// copy of it lifts out and stretches into a wisp that thins into light, the
// body left dimmed under it (pixelfx's spawn/soul-rise, MIT, by Patch and
// Hugo Duprez after Sprite Fusion's movement and heal). It acts on a body
// (o.actor), so it is baked from the hero's own picture as the battle draws
// it, not pixelfx's 24x38 stand-in: hero-down-0 mirrored, and the weapon and
// the shield at the hero's hands (GEAR_LAYOUT.down at the battle's 2x, a cell
// being 2 art px as the field's), one art cell (ART_PX texels) to a pixelfx
// pixel, as statusFx.ts reads a battler; and, as statusFx bakes a battler the
// battle draws on twice the cells, at two texels to that pixel with each
// cell's quarters in their colours off the pictures' "@hd" (statusFx hdBody),
// so the soul and the dimmed body are the 2px hero the battle shows. A look
// or gear changed is a new body,
// its sheet keyed by its picture's hash, baked ahead for the battle
// (warmSoul) and removed with it. The hero is left to the battle (the
// effect's actorAlpha is 1): the effect dims it as the soul leaves.
//
// The soul rises LIFT cells (4px each) and stretches 22%, to y ~214 over the
// feet's 456: into the hero's status window (to y 200, drawn over the effect),
// so the sheet is cut at the rage and deaths' ceiling (WINDOW_CEILING) as
// theirs are, and the effect's own 50 cells would have run well into it.
// Its 3.1s are played in PLAY_MS (1.4x), the soul gone by 1.8s, the dimmed
// body coming back as the last of the light goes.

const LIFT = 24;
const PLAY_MS = 2200;
// screen px over the feet where the sheet is gone (statusFx's WINDOW_CEILING)
const CEILING = 234;
const SOFT_LIGHT = 0.35;
// the effect's whole length less the last 0.1s, where its dimming ends
const SPAN: [number, number] = [0, 3.1];
const FRAMES = 30;
// the part of the 96x140 canvas kept round the anchor (48, 126): the ring
// on the floor reaches 32 cells out, the soul's top is cut at the ceiling
const CROP: [number, number, number, number] = [12, 64, 84, 134];

type Acting = FxModule;
const FX = soulRise as unknown as Acting;

const reducedMotion = (): boolean => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
const soft = (): boolean => !GameState.flashes || reducedMotion();

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
// to its feet (the anchor), and a hash of its picture for the sheet's key;
// `subs`, the actor in its cells' quarters' colours off the "@hd" pictures
// (statusFx hdBody), when every picture has one
interface Body {
  actor: Actor;
  subs: Actor[] | null;
  feet: number;
  id: string;
}

// texels to an effect pixel in a sheet baked from the "@hd" pictures (a cell's quarters)
const HD_RES = ART_PX;

// the hero as the battle draws it, each picture's middle `dx`, `dy` px off
// the hero's at the battle's 2x (the gear overlays are not mirrored)
function layers(): { key: string; dx: number; dy: number; flip: boolean }[] {
  const { weapon, shield } = GEAR_LAYOUT.down;
  return [
    { key: "hero-down-0", dx: 0, dy: 0, flip: true },
    ...(GameState.equipped.weapon ? [{ key: GameState.weaponTexture(), dx: weapon.x, dy: weapon.y, flip: false }] : []),
    ...(GameState.equipped.armor ? [{ key: GameState.armorTexture(), dx: shield.x, dy: shield.y, flip: false }] : []),
  ];
}

// The body read back on the art grid, cells counted from the hero's middle: a
// cell is on when any of its texels is, in that texel's colour, the later
// picture over the earlier. Off each picture's own canvas (texelsOf).
function bodyOf(scene: Phaser.Scene): Body | null {
  const cells = new Map<number, number>();
  const at = (cx: number, cy: number): number => (cy + 512) * 1024 + cx + 512;
  // the "@hd" pictures' texels, from the hero's middle as the cells are
  const texels = new Map<number, number>();
  const atTexel = (x: number, y: number): number => (y + 1024) * 4096 + x + 1024;
  let hd = true;
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
    // its "@hd" over the same cells, a texel a quarter, mirrored as the art is
    const hdFrame = scene.textures.exists(`${key}@hd`) ? scene.textures.getFrame(`${key}@hd`) : null;
    const hdSrc = hdFrame?.source.image;
    const hdData =
      hdFrame &&
      hdFrame.cutWidth === tw &&
      hdFrame.cutHeight === th &&
      (hdSrc instanceof HTMLCanvasElement || hdSrc instanceof HTMLImageElement)
        ? texelsOf(hdSrc, hdFrame.cutX, hdFrame.cutY, tw, th)
        : null;
    if (!hdData) {
      hd = false;
      continue;
    }
    for (let y = 0; y < th; y++)
      for (let x = 0; x < tw; x++) {
        const i = (y * tw + x) * 4;
        if (hdData[i + 3] === 0) continue;
        texels.set(
          atTexel(ox * ART_PX + (flip ? tw - 1 - x : x), oy * ART_PX + y),
          ((255 << 24) | (hdData[i + 2] << 16) | (hdData[i + 1] << 8) | hdData[i]) >>> 0,
        );
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
  const ay = -h;
  const actor: Actor = { mask: { w, h, data: mask }, pixels, x: left, y: ay, w, h, k: 2, head: [0, ay], chest: [0, Math.round(ay * 0.6)] };
  // each cell's quarter (top left, top right, bottom left, bottom right) off the "@hd" texels, its own colour where empty
  const quarter = (q: number): Actor => {
    const px = new Uint32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const c = pixels[y * w + x];
        if (c) px[y * w + x] = texels.get(atTexel((left + x) * HD_RES + (q & 1), (top + y) * HD_RES + (q >> 1))) ?? c;
      }
    return { ...actor, pixels: px };
  };
  return {
    actor,
    subs: hd ? [0, 1, 2, 3].map(quarter) : null,
    feet: (bottom + 1) * ART_PX,
    id: hash.toString(36),
  };
}

const keyOf = (body: Body, isSoft: boolean): string => `soul-rise:${body.id}${body.subs ? ":hd" : ""}${isSoft ? ":soft" : ""}`;

// texels to an effect pixel of a body's sheet
const resOf = (body: Body): number => (body.subs ? HD_RES : 1);

function sheetOf(body: Body, isSoft: boolean): PixelSheet {
  const res = resOf(body);
  return {
    fx: body.subs ? hdBody(FX, body.subs) : FX,
    opts: { actor: body.actor, height: LIFT, ...(isSoft ? { light: SOFT_LIGHT } : {}) },
    span: SPAN,
    frames: FRAMES,
    crop: CROP,
    res,
    trimFrames: res > 1,
  };
}

// a sheet's ceiling faded once, on the hero's cell (the battle's 2x)
const faded = new Set<string>();
function settle(scene: Phaser.Scene, key: string, cell: number, res: number): void {
  if (faded.has(key)) return;
  faded.add(key);
  fadeAboveCeiling(scene, key, FX.meta.origin[1] - CROP[1], CEILING, cell, res);
  // the battle's end takes the texture with it
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    faded.delete(key);
    if (scene.textures.exists(key)) scene.textures.remove(key);
  });
}

/**
 * Bakes the fall for the hero as it looks now, a slice of each of `scene`'s
 * frames (fx.ts warmSheets), so a defeat does not stall on it.
 */
export function warmSoul(scene: Phaser.Scene, hero: Phaser.GameObjects.Sprite): void {
  const body = bodyOf(scene);
  if (!body) return;
  const isSoft = soft();
  const key = keyOf(body, isSoft);
  warmSheets(scene, { [key]: sheetOf(body, isSoft) }, (k) => settle(scene, k, ART_PX * Math.round(hero.scaleX), resOf(body)));
}

/**
 * The soul leaving `hero`, a sprite of its own over the hero (the effect
 * dims the hero as it goes) for `ms`; not awaited, so the fall's lines come
 * up with it. A sheet no warm has baked yet is baked here, and it is a
 * dev-build console line how long that took. Returns false with nothing played
 * if the hero's picture could not be read.
 */
export function playSoul(scene: Phaser.Scene, hero: Phaser.GameObjects.Sprite, ms: number = PLAY_MS): boolean {
  const body = bodyOf(scene);
  if (!body) return false;
  const isSoft = soft();
  const key = keyOf(body, isSoft);
  const sheet = sheetOf(body, isSoft);
  if (!scene.textures.exists(key)) {
    const t0 = performance.now();
    bakePixelSheet(scene, key, sheet);
    if (process.env.NODE_ENV !== "production")
      console.info(`[soulFx] ${key} baked on the spot in ${(performance.now() - t0).toFixed(1)}ms`);
  }
  settle(scene, key, ART_PX * Math.round(hero.scaleX), resOf(body));
  const sprite = scene.add
    .sprite(hero.x, hero.y + body.feet * hero.scaleY, key, 0)
    .setOrigin(...sheetInfo(sheet).origin)
    .setScale((hero.scaleX * ART_PX) / resOf(body));
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: Math.max(1, ms),
    onUpdate: (tw) => sprite.setFrame(Math.min(FRAMES - 1, Math.floor((tw.getValue() ?? 0) * FRAMES))),
    onComplete: () => sprite.destroy(),
  });
  return true;
}
