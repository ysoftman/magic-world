/*! pixelfx (github.com/patch-gg/pixelfx) | MIT License | Copyright (c) 2026 Patch, Copyright (c) 2026 Hugo Duprez */
import Phaser from "phaser";
import { clearFrame, composite, createFrame, createFx, type FxFrame, type FxModule } from "pixelfx";
import * as arcaneOrb from "pixelfx/fx/arcane/arcane-orb";
import * as smallExplosion from "pixelfx/fx/explosions/small-explosion";
import * as fireball from "pixelfx/fx/fire/fireball";
import * as iceLance from "pixelfx/fx/ice/ice-lance";
import * as snowflakeBurst from "pixelfx/fx/ice/snowflake-burst";
import * as critHit from "pixelfx/fx/impacts/crit-hit";
import * as hitSpark from "pixelfx/fx/impacts/hit-spark";
import * as zapHit from "pixelfx/fx/lightning/zap-hit";
import * as swordSlash from "pixelfx/fx/melee/sword-slash";
import * as collectBurst from "pixelfx/fx/pickups/collect-burst";
import * as magicMissile from "pixelfx/fx/projectiles/magic-missile";
import * as plasmaShot from "pixelfx/fx/projectiles/plasma-shot";
import * as coinDrop from "pixelfx/fx/spawn/coin-drop";
import * as poof from "pixelfx/fx/spawn/poof";
import { PIXEL } from "./config";
import { GameState } from "./gameState";
import { ART_PX } from "./pixelart";

// Camera shake and full-screen flash behind the SCREEN SHAKE / FLASHES
// settings. Call these instead of camera.shake()/camera.flash() so a player
// prone to motion sickness or photosensitive seizures can turn them off.

// With FLASHES off a flash still happens, as a faint wash rather than a
// full-frame white-out: the beat it marks (a crit, an enrage) stays readable,
// and at this alpha and length it is nowhere near a hazardous flash.
export const SOFT_FLASH_ALPHA = 0.2;
export const SOFT_FLASH_MAX_MS = 150;

// The OS-level "reduce motion" setting counts as both switches off, read on
// every call so flipping it mid-game takes effect at once
const reducedMotion = (): boolean => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** camera.shake(), or nothing at all with SCREEN SHAKE or the OS's reduced motion on. */
export function shake(camera: Phaser.Cameras.Scene2D.Camera, duration: number, intensity: number): void {
  if (!GameState.screenShake || reducedMotion()) return;
  camera.shake(duration, intensity);
}

/** camera.flash(), softened to a short faint wash with FLASHES off or the OS's reduced motion on. */
export function flash(camera: Phaser.Cameras.Scene2D.Camera, duration: number, red = 255, green = 255, blue = 255): void {
  // Phaser's flash starts from flashEffect.alpha and restores it when done,
  // so it has to be set on every call — a softened flash would otherwise
  // leave every later flash soft too, even after FLASHES is back on
  const full = GameState.flashes && !reducedMotion();
  camera.flashEffect.alpha = full ? 1 : SOFT_FLASH_ALPHA;
  camera.flash(full ? duration : Math.min(duration, SOFT_FLASH_MAX_MS), red, green, blue);
}

// The mosaic's biggest block. It steps up a whole art pixel (PIXEL) at a time:
// a block size between grid lines would cut the art into slivers.
const MOSAIC_MAX = 32;

/**
 * The fade into a battle, then `done`: the screen breaks into ever bigger
 * blocks as it goes black, so walking into a fight never looks like walking
 * through a door (those keep the plain fade). The whole frame goes, HUD too.
 * With FLASHES off or the OS's reduced motion on, just the plain fade. The
 * filter is never removed: `done` starts the battle, and the shutdown destroys
 * this camera with it.
 */
export function encounterOut(camera: Phaser.Cameras.Scene2D.Camera, ms: number, done: () => void): void {
  if (GameState.flashes && !reducedMotion()) {
    const mosaic = camera.filters.external.addBlocky({ size: PIXEL });
    camera.scene.tweens.addCounter({
      from: PIXEL,
      to: MOSAIC_MAX,
      duration: ms,
      onUpdate: (tw) => {
        const size = Math.round((tw.getValue() ?? PIXEL) / PIXEL) * PIXEL;
        mosaic.size.x = size;
        mosaic.size.y = size;
      },
    });
  }
  camera.fadeOut(ms, 0, 0, 0);
  camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, done);
}

/**
 * Builds the mosaic's shader before the first encounter needs it: its first
 * use stalled a frame for 213ms, most of the 300ms fade. A 1px block changes
 * nothing on screen, and comes off again after the one frame it renders.
 */
export function warmEncounterOut(camera: Phaser.Cameras.Scene2D.Camera): void {
  const warm = camera.filters.external.addBlocky({ size: 1 });
  camera.scene.events.once(Phaser.Scenes.Events.RENDER, () => camera.filters.external.remove(warm));
}

// The battle's effects as pixel-art sprite sheets, drawn here in code on the
// title, a sheet a frame (warmBattleFx), or by a battle that comes first
// (bakeBattleFx): pixelfx effects (PIXEL_SHEETS, below) sampled into frames,
// shown on the battlers' own 4px cell. playFx() steps a
// sheet's frames across a given duration, so an effect fills exactly the time
// the old circle or burst it replaced took, and the battle's pace does not
// change.

// The pixelfx effects (github:patch-gg/pixelfx, MIT, by Patch and Hugo
// Duprez). A pixelfx effect is code drawing into a pixel buffer over time;
// here it is sampled into a sheet's frames at boot, one pixelfx pixel to a
// texel. Its pixels are drawn for a 24x38 figure, so one is one art cell:
// shown at ART_PX x the battler's scale, 4px (6px on a boss).
export interface PixelSheet {
  /** the effect: `import * as name from "pixelfx/fx/<category>/<name>"` */
  fx: FxModule;
  /** over the effect's own options (its meta.options): palette, seed, knobs */
  opts?: Record<string, unknown>;
  /**
   * the stretch of the effect's own time sampled, in seconds, 0..duration by
   * default: playFx squeezes it into its ms, so a long tail is left off here
   */
  span?: [number, number];
  /** frames sampled evenly across the span; one per 1/meta.fps by default */
  frames?: number;
  /** the point put on the battler's middle, in the effect's pixels from its anchor; 0, 0 by default */
  focus?: [number, number];
  /** drawn facing right: mirrored when the blow goes left, onto the hero */
  directional?: boolean;
  /** kept at the 4px cell over a boss or giant too, for one that would reach the stat windows at 6px */
  sameOnBoss?: boolean;
  /** the part of the effect's canvas (meta.size) baked, [x0, y0, x1, y1]: a smaller texture, or a stray part left off */
  crop?: [number, number, number, number];
}

// a 32-cell battler's middle to its feet, in art cells: an impact this high
// (its `height`) has its sparks bounce on the ground the battler stands on
const FEET = 16;
// a projectile's sheet: its loop's first 8 frames of 1/30s, one 240ms flight
// at castProjectile's 30ms a frame
const SHOT_SPAN: [number, number] = [0, 8 / 30];
// BOLT's colours as the old sheets had them: indigo edges (0x4338ca,
// 0x6366f1) round a yellow and white core (0xfde047, 0xfef08a). The pixelfx
// lightning blue read as ICE, and an all-yellow one sank into the foe flashed
// BOLT's yellow.
const BOLT_RAMP = ["#120a33", "#2a1b78", "#4338ca", "#6366f1", "#a5b4fc", "#fde047", "#fef08a", "#ffffff"];
// NOVA's magenta to pale pink, from the old sheets' 0xc026d3, 0xf0abfc, 0xfae8ff
const NOVA_RAMP = ["#1a0420", "#3b0a45", "#701a75", "#a21caf", "#c026d3", "#f0abfc", "#fae8ff", "#ffffff"];

const PIXEL_SHEETS: Record<string, PixelSheet> = {
  // a blow landing: a lopsided cross flare round a white core, then a cone of
  // sparks that falls and bounces
  "fx-hit": { fx: hitSpark, opts: { height: FEET }, span: [0, 0.45], focus: [0, -FEET], directional: true },
  // a crit: a jagged white starburst, a ring breaking into arcs, a flare,
  // shards to the floor (they lie there past 0.6s, left off). The ring grows
  // to 40 cells: at a boss's 6px its arcs crossed the foe's HP bar.
  "fx-crit": { fx: critHit, opts: { height: FEET }, span: [0, 0.6], focus: [0, -FEET], directional: true, sameOnBoss: true },
  // FIGHT: a crescent whipped over the foe, white cooling to blue, sparks off
  // its tip. Radius 30 of 42 fits it to a 32-cell foe, and its arc's centre
  // (6, -26) sits 12 cells left of and 6 under the foe's middle, so the
  // crescent cuts across the body, not round it. From 1/30s, when it shows.
  "fx-slash": { fx: swordSlash, opts: { radius: 30 }, span: [1 / 30, 0.5], focus: [18, -32], directional: true },
  // FIRE's shot: a white-hot head in a corona of flame, a torn tail of flame
  // puffs cooling to smoke. Speed 60 keeps the tail to 44 cells: the default's
  // 92 ran back past the hero at launch.
  "fx-fireball": { fx: fireball, opts: { speed: 60 }, span: SHOT_SPAN, crop: [52, 4, 132, 52] },
  // FIRE's burst: a white flash, a fireball in a shock ring, breaking into
  // burning puffs and smoke; the smoke column and the debris landing after
  // 0.4s are left off. Its ground 12 cells under the foe's middle: the ball
  // covers the body and the debris band keeps to the feet.
  "fx-fire": {
    fx: smallExplosion,
    opts: { size: 0.6 },
    span: [0, 0.4],
    frames: 10,
    focus: [0, -12],
    sameOnBoss: true,
    crop: [98, 122, 206, 224],
  },
  // ICE's shot: a faceted spear, a pulse down its core, rings of cold air
  // shearing off its tip. Length 28 of 40, a little over a foe's width.
  "fx-iceshard": { fx: iceLance, opts: { length: 28 }, span: SHOT_SPAN, crop: [40, 16, 156, 48] },
  // ICE's burst: frost gathers and flashes white in a ring, then six-armed
  // flakes spin out (from just before the flash; their drift down after
  // 0.85s left off). The flakes' middle, 52 cells over its ground, on the foe's.
  "fx-ice": { fx: snowflakeBurst, span: [0.15, 0.85], frames: 10, focus: [-2, -52], sameOnBoss: true, crop: [28, 8, 116, 112] },
  // BOLT's shot: a white-hot blob, a corona crackling over it, its tail
  // necking into droplets that tear off
  "fx-spark": { fx: plasmaShot, opts: { palette: BOLT_RAMP }, span: SHOT_SPAN, crop: [30, 6, 130, 56] },
  // BOLT's burst: an arc snaps in from the caster's side onto the foe's
  // middle, which overloads into a knot of crackle and a fern of burn marks
  "fx-bolt": {
    fx: zapHit,
    opts: { palette: BOLT_RAMP },
    span: [0.03, 0.47],
    frames: 10,
    directional: true,
    sameOnBoss: true,
    crop: [2, 18, 118, 94],
  },
  // NOVA's shot: an orb of smoky glass, a swirl round a white heart, two
  // tilted rings round it. Its middle hangs 51 cells over its ground, which
  // is cropped off with the light pooled there: under a shot in flight that
  // lit line rode along the menu row.
  "fx-orb": { fx: arcaneOrb, opts: { palette: NOVA_RAMP }, span: SHOT_SPAN, focus: [0, -51], crop: [32, 22, 106, 78] },
  // NOVA's blasts: a magic missile's landing, a star flare, a white disc, a
  // ring rushing out, sparkles (the missile's flight before 0.83s and the
  // fading sparkles after 1.45s left off; its ribbon's last cells show for a
  // frame or two). It lands at (reach 112, height 26) from its anchor.
  "fx-nova": {
    fx: magicMissile,
    opts: { palette: NOVA_RAMP },
    span: [0.83, 1.45],
    frames: 10,
    focus: [112, -26],
    sameOnBoss: true,
    crop: [86, 36, 172, 110],
  },
  // a foe going down (victory, arenaVictory): a white pop, a ring of smoke
  // balls, little stars, the cloud lifting away. Its anchor is the floor, so
  // BattleScene plays it on the ground under the foe (GROUND_Y), a flier's
  // too; at 4px on a boss, whose 6px stars reached up into the stat window.
  "fx-poof": { fx: poof, span: [0, 1.2], frames: 18, sameOnBoss: true },
  // the foe's gold, with fx-poof: coins spin out of a small puff (lost in the
  // poof's cloud), bounce along the ground, twinkle and wink out. Cropped to
  // what it draws (13, 16, 146, 87) grown just enough that every pixel bakes
  // as before: 146 wide fits 14 frames a row, 2044x234 for 1920x352.
  "fx-coins": { fx: coinDrop, span: [0, 2.8], frames: 42, sameOnBoss: true, crop: [7, 10, 153, 88] },
  // a level up, and a TREASURE MAP found: a gold flash and cross, a ring
  // snapping out, twinkles thrown wide; its burst, 30 over its anchor, on the
  // hero's middle. Gold is ui/level-up's ramp.
  "fx-levelup": {
    fx: collectBurst,
    opts: { palette: ["#2a1405", "#5c3008", "#9a5a0e", "#d48e18", "#f5b92c", "#ffde5e", "#fff4bc", "#ffffff"] },
    span: [0, 1.1],
    frames: 17,
    focus: [0, -30],
  },
};

// a sheet's frames, the texture point put on (x, y) as a fraction of a frame,
// whether it turns to face the blow and whether it keeps the normal cell over
// a boss
interface SheetInfo {
  frames: number;
  origin: [number, number];
  directional: boolean;
  sameOnBoss: boolean;
}

const cropOf = (sheet: PixelSheet): [number, number, number, number] => sheet.crop ?? [0, 0, ...sheet.fx.meta.size];

export function spanOf(sheet: PixelSheet): { from: number; to: number; frames: number } {
  const [from, to] = sheet.span ?? [0, sheet.fx.meta.duration];
  return { from, to, frames: sheet.frames ?? Math.max(1, Math.round((to - from) * sheet.fx.meta.fps)) };
}

const infoOf = (key: string): SheetInfo => sheetInfo(PIXEL_SHEETS[key]);

/** A baked sheet's frame count, the point its origin puts on (x, y), and how it turns and scales. */
export function sheetInfo(pixel: PixelSheet): SheetInfo {
  const [x0, y0, x1, y1] = cropOf(pixel);
  const [ax, ay] = pixel.fx.meta.origin;
  const [fx, fy] = pixel.focus ?? [0, 0];
  return {
    frames: spanOf(pixel).frames,
    origin: [(ax + fx - x0) / (x1 - x0), (ay + fy - y0) / (y1 - y0)],
    directional: !!pixel.directional,
    sameOnBoss: !!pixel.sameOnBoss,
  };
}

// the widest texture a sheet may be: some mobile GPUs go no further (AGENTS.md)
const MAX_TEXTURE_W = 2048;
// glow fades out over a frame's last pixels, so a halo the frame cuts off does
// not end in a straight edge (as pixelfx's own sheet export does)
const EDGE_FADE = 8;

function fadeEdges({ w, h, light }: FxFrame): void {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const e = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (e >= EDGE_FADE || !(light[i] & 0xffffff)) continue;
      const u = (e + 0.5) / EDGE_FADE;
      const k = u * u * (3 - 2 * u);
      const l = light[i];
      light[i] =
        (l & 0xff000000) |
        Math.round((l & 255) * k) |
        (Math.round(((l >>> 8) & 255) * k) << 8) |
        (Math.round(((l >>> 16) & 255) * k) << 16);
    }
}

// The frames sit in a grid no wider than MAX_TEXTURE_W, each the effect's own
// canvas (meta.size, or its crop) with its anchor at meta.origin; light (glow) becomes
// colour with alpha, which reads as a glow over the dark battle backdrops.
// `step` draws the sheet's next frames for about `ms` (always at least one)
// and says whether it is done. The canvas is drawn apart and only added under
// `key` with its last frame in, so textures.exists() never finds a part-baked
// sheet, and one given up on (`drop`) leaves nothing behind.
function sheetBaker(scene: Phaser.Scene, key: string, sheet: PixelSheet): { step: (ms: number) => boolean; drop: () => void } {
  const [x0, y0, x1, y1] = cropOf(sheet);
  const [w, h] = [x1 - x0, y1 - y0];
  const [ax, ay] = sheet.fx.meta.origin;
  const { from, to, frames } = spanOf(sheet);
  const cols = Math.min(frames, Math.max(1, Math.floor(MAX_TEXTURE_W / w)));
  const at = (f: number): [number, number] => [(f % cols) * w, Math.floor(f / cols) * h];
  // as textures.createCanvas makes one, and with the context its CanvasTexture asks for
  const pool = Phaser.Display.Canvas.CanvasPool;
  const canvas = pool.create(scene.textures, cols * w, Math.ceil(frames / cols) * h, Phaser.CANVAS, true);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const fx = createFx(sheet.fx, sheet.opts);
  const frame = createFrame(w, h, x0 - ax, y0 - ay);
  const img = new ImageData(w, h);
  if (from > 0) fx.update(from);
  let f = 0;
  const step = (ms: number): boolean => {
    const end = performance.now() + ms;
    do {
      if (f > 0) fx.update((to - from) / frames);
      clearFrame(frame);
      fx.draw(frame);
      fadeEdges(frame);
      composite(frame, img.data, null);
      ctx?.putImageData(img, ...at(f));
      f++;
    } while (f < frames && performance.now() < end);
    if (f < frames) return false;
    // baked whole meanwhile by a scene that could not wait: keep that one
    if (scene.textures.exists(key)) pool.remove(canvas);
    else {
      const tex = scene.textures.addCanvas(key, canvas);
      for (let i = 0; i < frames; i++) tex?.add(i, 0, ...at(i), w, h);
      tex?.refresh();
    }
    return true;
  };
  return { step, drop: () => pool.remove(canvas) };
}

/** Bakes the sheet into its own texture here and now, frames numbered 0..n-1. */
export function bakePixelSheet(scene: Phaser.Scene, key: string, sheet: PixelSheet): void {
  if (!scene.textures.exists(key)) sheetBaker(scene, key, sheet).step(Number.POSITIVE_INFINITY);
}

/** Draws every sheet not yet baked into its own texture, frames numbered 0..n-1. */
export function bakeBattleFx(scene: Phaser.Scene): void {
  for (const [key, sheet] of Object.entries(PIXEL_SHEETS)) if (!scene.textures.exists(key)) bakePixelSheet(scene, key, sheet);
}

// How much of a frame warmSheets spends baking. A sheet a frame held the
// title's frame for up to 76ms (a butterfly, Critters.ts; headless): its
// frames are split over several now.
const BAKE_BUDGET_MS = 8;

interface Waiting {
  key: string;
  sheet: PixelSheet;
  done?: (key: string) => void;
}
// a scene's one queue, so two callers share its budget instead of each taking one
const queues = new WeakMap<Phaser.Scene, Waiting[]>();

/**
 * Bakes `sheets` not yet in, in order after anything `scene` has queued
 * already, BAKE_BUDGET_MS of each of its frames (POST_UPDATE) at a time: a
 * cheap sheet or a few in a frame, a costly one across several. `done` hears
 * each key once its texture is in, at once for one that is in already. Should
 * the scene shut down first, the rest, the sheet under way too, are left to
 * whoever needs them next, and `done` hears nothing more: finishing that sheet
 * on the spot put up to 70ms (a butterfly, headless) on the frame a Continue
 * pressed on the title opened the town in, already its longest.
 */
export function warmSheets(scene: Phaser.Scene, sheets: Record<string, PixelSheet>, done?: (key: string) => void): void {
  const fresh: Waiting[] = [];
  for (const [key, sheet] of Object.entries(sheets)) {
    if (scene.textures.exists(key)) done?.(key);
    else fresh.push({ key, sheet, done });
  }
  const queued = queues.get(scene);
  if (queued) {
    queued.push(...fresh);
    return;
  }
  if (!fresh.length) return;
  const waiting = fresh;
  queues.set(scene, waiting);
  let baking: { item: Waiting; baker: ReturnType<typeof sheetBaker> } | undefined;
  const step = (): void => {
    const end = performance.now() + BAKE_BUDGET_MS;
    do {
      if (!baking) {
        const item = waiting.shift();
        if (!item) {
          stop();
          return;
        }
        if (scene.textures.exists(item.key)) {
          item.done?.(item.key);
          continue;
        }
        baking = { item, baker: sheetBaker(scene, item.key, item.sheet) };
      }
      if (!baking.baker.step(end - performance.now())) return;
      baking.item.done?.(baking.item.key);
      baking = undefined;
    } while (performance.now() < end);
  };
  const leave = (): void => {
    baking?.baker.drop();
    stop();
  };
  const stop = (): void => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, step);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, leave);
    queues.delete(scene);
  };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, step);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, leave);
}

/**
 * Bakes the sheets ahead of the first battle while `scene` runs (the title,
 * which every game passes through): all at once as that battle started, they
 * held its first frame for some 100-140ms. Textures are the game's, so they
 * outlast the scene; any it leaves unbaked, the battle bakes (bakeBattleFx).
 * `after`'s sheets (the field critters, ui/Critters.ts) come next in the same
 * queue (warmSheets).
 */
export function warmBattleFx(scene: Phaser.Scene, after: Record<string, PixelSheet> = {}): void {
  warmSheets(scene, { ...PIXEL_SHEETS, ...after });
}

// the scale battlers are shown at, a boss's or giant's above it
const BATTLER_SCALE = 2;

// a sheet's sprite at (x, y) on the cell of a battler shown at `scale`; a
// negative scaleX mirrors it round its origin (flipX turns a frame round its
// middle, which would move an off-centre origin)
function fxSprite(scene: Phaser.Scene, key: string, x: number, y: number, scale: number, left: boolean): Phaser.GameObjects.Sprite {
  const { origin, directional, sameOnBoss } = infoOf(key);
  const s = (sameOnBoss ? Math.min(scale, BATTLER_SCALE) : scale) * ART_PX;
  return scene.add
    .sprite(x, y, key, 0)
    .setOrigin(...origin)
    .setScale(left && directional ? -s : s, s);
}

/**
 * Plays a sheet once at (x, y): its frames stepped evenly across `ms`, then
 * gone. `scale` is the battler's it plays over: 2, the monsters' own, by
 * default. `left`: the blow goes left (onto the hero), so a directional sheet
 * is mirrored. Created at depth 0, so a damage number or label added after it
 * draws on top.
 */
export function playFx(
  scene: Phaser.Scene,
  key: string,
  x: number,
  y: number,
  ms: number,
  scale = BATTLER_SCALE,
  left = false,
): Phaser.GameObjects.Sprite {
  const { frames } = infoOf(key);
  const sprite = fxSprite(scene, key, x, y, scale, left);
  scene.tweens.addCounter({
    from: 0,
    to: frames,
    duration: Math.max(1, ms),
    onUpdate: (tw) => sprite.setFrame(Math.min(frames - 1, Math.floor(tw.getValue() ?? 0))),
    onComplete: () => sprite.destroy(),
  });
  return sprite;
}

/** A sheet's frames over and over, `frameMs` each, until the caller destroys it. */
export function loopFx(
  scene: Phaser.Scene,
  key: string,
  x: number,
  y: number,
  frameMs: number,
  scale = BATTLER_SCALE,
): Phaser.GameObjects.Sprite {
  const { frames } = infoOf(key);
  const sprite = fxSprite(scene, key, x, y, scale, false);
  let f = 0;
  const timer = scene.time.addEvent({
    delay: Math.max(16, frameMs),
    loop: true,
    callback: () => {
      f = (f + 1) % frames;
      sprite.setFrame(f);
    },
  });
  sprite.once("destroy", () => timer.remove());
  return sprite;
}
