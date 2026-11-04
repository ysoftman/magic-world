/*! pixelfx (github.com/patch-gg/pixelfx) | MIT License | Copyright (c) 2026 Patch, Copyright (c) 2026 Hugo Duprez */
import Phaser from "phaser";
import { clearFrame, composite, createFrame, createFx, type FxFrame, type FxModule } from "pixelfx";
import * as smallExplosion from "pixelfx/fx/explosions/small-explosion";
import * as fireball from "pixelfx/fx/fire/fireball";
import * as iceLance from "pixelfx/fx/ice/ice-lance";
import * as snowflakeBurst from "pixelfx/fx/ice/snowflake-burst";
import * as critHit from "pixelfx/fx/impacts/crit-hit";
import * as hitSpark from "pixelfx/fx/impacts/hit-spark";
import * as swordSlash from "pixelfx/fx/melee/sword-slash";
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

// The battle's effects as pixel-art sprite sheets, drawn here in code when the
// first battle starts (bakeBattleFx). Two kinds: pixelfx effects
// (PIXEL_SHEETS, below) sampled into frames, and the older hand-drawn ones
// (SHEETS), a row of square frames on a 2px cell -- 32 cells (64px) for a
// burst, 16 (32px) for a projectile -- each drawn from a few shapes (rays,
// rings, blobs, jagged lines) through a seeded random, so every boot draws the
// same sheet. Either way a sheet is shown on the battlers' own 4px cell.
// playFx() steps a sheet's frames across a given duration, so an effect fills
// exactly the time the old circle or burst it replaced took, and the battle's
// pace does not change.

type Cells = (x: number, y: number, colour: number) => void;
interface Sheet {
  cells: number;
  frames: number;
  draw: (put: Cells, frame: number, rand: () => number) => void;
}

const FX_CELL = 2;

const seeded = (seed: number): (() => number) => {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
};

/** cells along a line, `w` cells wide, coloured by distance from its axis */
function line(put: Cells, x0: number, y0: number, x1: number, y1: number, w: number, ramp: readonly number[]): void {
  const len = Math.max(1, Math.hypot(x1 - x0, y1 - y0));
  const steps = Math.ceil(len * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = x0 + (x1 - x0) * t;
    const cy = y0 + (y1 - y0) * t;
    // whole cells only: a width under 1 is a one-cell line
    const reach = Math.floor(w);
    for (let dy = -reach; dy <= reach; dy++)
      for (let dx = -reach; dx <= reach; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > w) continue;
        put(Math.round(cx + dx), Math.round(cy + dy), ramp[Math.min(ramp.length - 1, Math.floor((d / (w + 0.01)) * ramp.length))]);
      }
  }
}

/** a filled disc, its colour by distance from the centre */
function disc(put: Cells, cx: number, cy: number, r: number, ramp: readonly number[], noise?: () => number): void {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
    for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) + (noise ? (noise() - 0.5) * 1.6 : 0);
      if (d <= r) put(x, y, ramp[Math.min(ramp.length - 1, Math.max(0, Math.floor((d / r) * ramp.length)))]);
    }
}

/** a ring `w` cells thick */
function ring(put: Cells, cx: number, cy: number, r: number, w: number, colour: number, gaps = 0, rand?: () => number): void {
  for (let y = Math.floor(cy - r - w); y <= cy + r + w; y++)
    for (let x = Math.floor(cx - r - w); x <= cx + r + w; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (Math.abs(d - r) <= w / 2 && !(gaps && rand && rand() < gaps)) put(x, y, colour);
    }
}

/**
 * a jagged bolt from (x0, y0) to (x1, y1): a one-cell `core` inside a border
 * of `edge`, so it still reads over a sprite flashed its own colour
 */
function zigzag(
  put: Cells,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  jag: number,
  rand: () => number,
  core: number,
  edge: number,
): void {
  const n = 6;
  const points = [[x0, y0]];
  for (let i = 1; i < n; i++)
    points.push([x0 + ((x1 - x0) * i) / n + (rand() - 0.5) * jag * 2, y0 + ((y1 - y0) * i) / n + (rand() - 0.5) * jag]);
  points.push([x1, y1]);
  for (const [w, colour] of [
    [1, edge],
    [0, core],
  ])
    for (let i = 1; i <= n; i++) line(put, points[i - 1][0], points[i - 1][1], points[i][0], points[i][1], w, [colour]);
}

/** a small four-point sparkle */
function sparkle(put: Cells, x: number, y: number, size: number, core: number, arm: number): void {
  put(x, y, core);
  for (let k = 1; k <= size; k++) {
    put(x + k, y, arm);
    put(x - k, y, arm);
    put(x, y + k, arm);
    put(x, y - k, arm);
  }
}

const C = 15.5;

const SHEETS: Record<string, Sheet> = {
  // BOLT: a jagged bolt down onto the target, a star where it lands, crackle
  "fx-bolt": {
    cells: 32,
    frames: 5,
    draw: (put, f, rand) => {
      if (f < 4) {
        zigzag(put, C + (rand() - 0.5) * 6, 0, C, C, 4, rand, 0xffffff, 0x4338ca);
        if (f % 2 === 0) zigzag(put, C, C, C + (rand() - 0.5) * 22, C + 8 + rand() * 6, 3, rand, 0xfef08a, 0x4338ca);
      }
      const star = [3, 5, 4, 3, 2][f];
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + Math.PI / 4;
        line(put, C, C, C + Math.cos(a) * star * 1.6, C + Math.sin(a) * star * 1.6, 0.5, [0xffffff, 0xfde047]);
      }
      disc(put, C, C, star * 0.7, [0xffffff, 0xfef08a]);
      if (f >= 3) for (let k = 0; k < 5; k++) sparkle(put, Math.round(6 + rand() * 20), Math.round(8 + rand() * 18), 1, 0xffffff, 0xfde047);
    },
  },
  // NOVA: a star core, a ring of light rushing out, sparkles in its wake
  "fx-nova": {
    cells: 32,
    frames: 6,
    draw: (put, f, rand) => {
      const r = [3, 6, 9, 12, 14, 15][f];
      ring(put, C, C, r, f < 4 ? 2.4 : 1.4, f < 3 ? 0xfae8ff : 0xf0abfc, f >= 4 ? 0.35 : 0, rand);
      if (r > 4) ring(put, C, C, r - 2, 1, 0xc026d3, f >= 3 ? 0.5 : 0, rand);
      const core = [5, 6, 4, 2, 0, 0][f];
      if (core) disc(put, C, C, core, [0xffffff, 0xfae8ff, 0xf0abfc]);
      for (let k = 0; k < (f + 1) * 2; k++) {
        const a = rand() * Math.PI * 2;
        const d = rand() * r;
        sparkle(put, Math.round(C + Math.cos(a) * d), Math.round(C + Math.sin(a) * d), 1, 0xffffff, 0xf0abfc);
      }
    },
  },
  // HEAL: green crosses of light rising around the hero, swelling and
  // shrinking, each in a dark green border so it reads over grass too
  "fx-heal": {
    cells: 32,
    frames: 6,
    draw: (put, f) => {
      const plus = (x: number, y: number, size: number, colour: number) => {
        for (let k = -size; k <= size; k++) {
          put(x + k, y, colour);
          put(x, y + k, colour);
        }
      };
      for (const [x, y, phase] of [
        [7, 26, 0],
        [24, 24, 1],
        [13, 19, 0],
        [21, 14, 2],
        [8, 12, 1],
        [26, 8, 0],
        [16, 6, 2],
      ] as const) {
        const age = f - phase;
        if (age < 0 || age > 3) continue;
        const yy = y - age * 2;
        const size = [1, 2, 2, 1][age];
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ])
          plus(x + dx, yy + dy, size, 0x14532d);
        plus(x, yy, size, age < 3 ? 0x4ade80 : 0x22c55e);
        put(x, yy, 0xffffff);
      }
    },
  },
  // WARD: a hexagon of light drawn round the hero edge by edge, then a shimmer
  "fx-ward": {
    cells: 32,
    frames: 5,
    draw: (put, f) => {
      const edges = [2, 4, 6, 6, 6][f];
      const corner = (k: number): [number, number] => [
        C + Math.cos((k * Math.PI) / 3 - Math.PI / 2) * 13,
        C + Math.sin((k * Math.PI) / 3 - Math.PI / 2) * 14,
      ];
      for (let k = 0; k < edges; k++) {
        const [x0, y0] = corner(k);
        const [x1, y1] = corner(k + 1);
        line(put, x0, y0, x1, y1, f === 4 ? 0.5 : 1, f === 3 ? [0xffffff, 0xbfdbfe] : [0xbfdbfe, 0x60a5fa]);
      }
      if (f === 3) for (let k = 0; k < 6; k++) sparkle(put, Math.round(corner(k)[0]), Math.round(corner(k)[1]), 1, 0xffffff, 0xbfdbfe);
    },
  },
  // a burn taking hold: flames licking up the target, flickering
  "fx-burn": {
    cells: 32,
    frames: 5,
    draw: (put, f, rand) => {
      for (const [x, base] of [
        [9, 28],
        [16, 30],
        [23, 27],
      ] as const) {
        const h = 6 + ((f * 3 + x) % 5) + (f === 4 ? -4 : 0);
        if (h <= 1) continue;
        for (let y = 0; y < h; y++) {
          const t = y / h;
          const w = Math.max(0, Math.round((1 - t) * 3.2 - (t > 0.8 ? 1 : 0)));
          const sway = Math.round(Math.sin((y + f * 2) * 0.8) * 0.8);
          // red at the rim and tip, so it shows on a foe flashed orange
          for (let dx = -w; dx <= w; dx++)
            put(
              x + dx + sway,
              base - y,
              Math.abs(dx) < w * 0.4 && t < 0.6 ? 0xfde047 : t > 0.75 || Math.abs(dx) === w ? 0xb91c1c : 0xfb923c,
            );
        }
        put(x, base - 1, 0xfffbe6);
      }
      if (f >= 2) for (let k = 0; k < 3; k++) put(Math.round(6 + rand() * 20), Math.round(4 + rand() * 12), 0xfde047);
    },
  },
  // a chill: frost flakes settling over the target
  "fx-chill": {
    cells: 32,
    frames: 5,
    draw: (put, f) => {
      for (const [x, y, phase] of [
        [8, 6, 0],
        [22, 4, 1],
        [15, 12, 0],
        [26, 14, 2],
        [6, 18, 1],
        [18, 22, 2],
      ] as const) {
        const age = f - phase;
        if (age < 0) continue;
        const yy = y + age * 2;
        const big = age === 1 || age === 2;
        put(x, yy, 0xffffff);
        for (const [dx, dy] of big
          ? [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
              [2, 0],
              [-2, 0],
              [0, 2],
              [0, -2],
              [1, 1],
              [-1, -1],
              [1, -1],
              [-1, 1],
            ]
          : [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ])
          put(x + dx, yy + dy, Math.abs(dx) + Math.abs(dy) > 1 ? 0x67e8f9 : 0xcffafe);
      }
    },
  },
  // a shock: arcs crackling round the target, a new set every frame
  "fx-shock": {
    cells: 32,
    frames: 4,
    draw: (put, f, rand) => {
      for (let k = 0; k < (f === 3 ? 1 : 3); k++) {
        const a = rand() * Math.PI * 2;
        const b = a + 0.9 + rand();
        zigzag(put, C + Math.cos(a) * 12, C + Math.sin(a) * 12, C + Math.cos(b) * 12, C + Math.sin(b) * 12, 4, rand, 0xfef08a, 0x4338ca);
      }
    },
  },
  // poison: bubbles rising off the hero and popping
  "fx-poison": {
    cells: 32,
    frames: 5,
    draw: (put, f) => {
      for (const [x, y, r, phase] of [
        [10, 26, 2.5, 0],
        [20, 28, 2, 1],
        [15, 22, 3, 1],
        [24, 20, 2, 0],
        [8, 16, 2, 2],
      ] as const) {
        const age = f - phase;
        if (age < 0) continue;
        const yy = y - age * 4;
        if (age >= 3) {
          sparkle(put, x, yy, 1, 0xf5d0fe, 0x7e22ce);
          continue;
        }
        // a dark rim: the poisoned hero is tinted this same purple
        disc(put, x, yy, r, [0xa855f7, 0xa855f7, 0x3b0764]);
        put(Math.round(x - r / 2), Math.round(yy - r / 2), 0xf5d0fe);
      }
    },
  },
  // freeze: ice growing up round the hero's legs, a shard at a time
  "fx-freeze": {
    cells: 32,
    frames: 5,
    draw: (put, f) => {
      for (const [x, h, w, phase] of [
        [8, 12, 2, 0],
        [13, 16, 3, 1],
        [19, 14, 3, 0],
        [24, 11, 2, 2],
        [16, 8, 2, 3],
      ] as const) {
        const grown = Math.min(1, Math.max(0, (f - phase + 1) / 2));
        const hh = Math.round(h * grown);
        for (let y = 0; y < hh; y++) {
          const ww = Math.max(0, Math.round(w * (1 - y / (h + 1))));
          for (let dx = -ww; dx <= ww; dx++)
            put(x + dx, 31 - y, dx === -ww ? 0xffffff : dx === ww ? 0x0e7490 : y > hh - 3 ? 0xcffafe : 0x67e8f9);
        }
      }
    },
  },
  // the projectiles, 16 cells, two frames of flicker each, flying right
  "fx-spark": {
    cells: 16,
    frames: 2,
    draw: (put, f) => {
      disc(put, 8, 8, 3.2, [0xffffff, 0xfef08a, 0xfde047]);
      // four sparks round the orb, turned an eighth each frame
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + (f * Math.PI) / 4;
        line(put, 8 + Math.cos(a) * 4, 8 + Math.sin(a) * 4, 8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7, 0, [0xfde047]);
      }
    },
  },
  "fx-orb": {
    cells: 16,
    frames: 2,
    draw: (put, f) => {
      disc(put, 8, 8, 3.6, [0xffffff, 0xfae8ff, 0xf0abfc]);
      ring(put, 8, 8, f ? 6 : 5, 1, 0xc026d3);
      sparkle(put, 8, 8, f ? 7 : 6, 0xffffff, 0xf0abfc);
    },
  },
};

// The pixelfx effects (github:patch-gg/pixelfx, MIT, by Patch and Hugo
// Duprez). A pixelfx effect is code drawing into a pixel buffer over time;
// here it is sampled into a sheet's frames at boot like the ones above, one
// pixelfx pixel to a texel. Its pixels are drawn for a 24x38 figure, so one is
// one art cell: shown at ART_PX x the battler's scale, 4px (6px on a boss).
interface PixelSheet {
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
  // a foe going down (victory, arenaVictory): a white pop, a ring of smoke
  // balls, little stars, the cloud lifting away. Its anchor is the floor, so
  // BattleScene plays it on the ground under the foe (GROUND_Y), a flier's
  // too; at 4px on a boss, whose 6px stars reached up into the stat window.
  "fx-poof": { fx: poof, span: [0, 1.2], frames: 18, sameOnBoss: true },
  // the foe's gold, with fx-poof: coins spin out of a small puff (lost in the
  // poof's cloud), bounce along the ground, twinkle and wink out
  "fx-coins": { fx: coinDrop, span: [0, 2.8], frames: 42, sameOnBoss: true },
};

// a sheet's frames, how many texels to an art cell, the texture point put on
// (x, y) as a fraction of a frame, whether it turns to face the blow and
// whether it keeps the normal cell over a boss
interface SheetInfo {
  frames: number;
  texel: number;
  origin: [number, number];
  directional: boolean;
  sameOnBoss: boolean;
}

const cropOf = (sheet: PixelSheet): [number, number, number, number] => sheet.crop ?? [0, 0, ...sheet.fx.meta.size];

function spanOf(sheet: PixelSheet): { from: number; to: number; frames: number } {
  const [from, to] = sheet.span ?? [0, sheet.fx.meta.duration];
  return { from, to, frames: sheet.frames ?? Math.max(1, Math.round((to - from) * sheet.fx.meta.fps)) };
}

function infoOf(key: string): SheetInfo {
  const pixel = PIXEL_SHEETS[key];
  if (!pixel) return { frames: SHEETS[key].frames, texel: FX_CELL, origin: [0.5, 0.5], directional: false, sameOnBoss: false };
  const [x0, y0, x1, y1] = cropOf(pixel);
  const [ax, ay] = pixel.fx.meta.origin;
  const [fx, fy] = pixel.focus ?? [0, 0];
  return {
    frames: spanOf(pixel).frames,
    texel: 1,
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
function bakePixelSheet(scene: Phaser.Scene, key: string, sheet: PixelSheet): void {
  const [x0, y0, x1, y1] = cropOf(sheet);
  const [w, h] = [x1 - x0, y1 - y0];
  const [ax, ay] = sheet.fx.meta.origin;
  const { from, to, frames } = spanOf(sheet);
  const cols = Math.min(frames, Math.max(1, Math.floor(MAX_TEXTURE_W / w)));
  const tex = scene.textures.createCanvas(key, cols * w, Math.ceil(frames / cols) * h);
  if (!tex) return;
  const ctx = tex.getContext();
  const fx = createFx(sheet.fx, sheet.opts);
  const frame = createFrame(w, h, x0 - ax, y0 - ay);
  const img = new ImageData(w, h);
  if (from > 0) fx.update(from);
  for (let f = 0; f < frames; f++) {
    if (f > 0) fx.update((to - from) / frames);
    clearFrame(frame);
    fx.draw(frame);
    fadeEdges(frame);
    composite(frame, img.data, null);
    const x = (f % cols) * w;
    const y = Math.floor(f / cols) * h;
    ctx.putImageData(img, x, y);
    tex.add(f, 0, x, y, w, h);
  }
  tex.refresh();
}

// seeded by its key, so taking a sheet out of the table redraws no other
const seedOf = (key: string): number => [...key].reduce((s, c) => (s * 31 + c.charCodeAt(0)) % 2147483647, 101);

/** Draws every sheet once into its own texture, frames numbered 0..n-1. */
export function bakeBattleFx(scene: Phaser.Scene): void {
  for (const [key, sheet] of Object.entries(SHEETS)) {
    if (scene.textures.exists(key)) continue;
    const size = sheet.cells * FX_CELL;
    const tex = scene.textures.createCanvas(key, size * sheet.frames, size);
    if (!tex) continue;
    const ctx = tex.getContext();
    for (let f = 0; f < sheet.frames; f++) {
      const put: Cells = (x, y, colour) => {
        if (x < 0 || y < 0 || x >= sheet.cells || y >= sheet.cells) return;
        ctx.fillStyle = `#${colour.toString(16).padStart(6, "0")}`;
        ctx.fillRect(f * size + x * FX_CELL, y * FX_CELL, FX_CELL, FX_CELL);
      };
      sheet.draw(put, f, seeded(seedOf(key) + f * 7));
      tex.add(f, 0, f * size, 0, size, size);
    }
    tex.refresh();
  }
  for (const [key, sheet] of Object.entries(PIXEL_SHEETS)) if (!scene.textures.exists(key)) bakePixelSheet(scene, key, sheet);
}

// the scale battlers are shown at, a boss's or giant's above it
const BATTLER_SCALE = 2;

// a sheet's sprite at (x, y) on the cell of a battler shown at `scale`; a
// negative scaleX mirrors it round its origin (flipX turns a frame round its
// middle, which would move an off-centre origin)
function fxSprite(scene: Phaser.Scene, key: string, x: number, y: number, scale: number, left: boolean): Phaser.GameObjects.Sprite {
  const { texel, origin, directional, sameOnBoss } = infoOf(key);
  const s = ((sameOnBoss ? Math.min(scale, BATTLER_SCALE) : scale) * ART_PX) / texel;
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
