import type Phaser from "phaser";
import { GameState } from "./gameState";

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

// The battle's effects as pixel-art sprite sheets, drawn here in code when the
// first battle starts (bakeBattleFx): a sheet is a row of square frames on a
// 2px cell -- 32 cells (64px) for a burst, 16 (32px) for a projectile --
// and BattleScene shows them at 2x, the same 4px cell the 32-cell monsters
// are shown at. Each frame is drawn from a few shapes (rays, rings, blobs,
// jagged lines) through a seeded random, so every boot draws the same sheet.
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
  // FIGHT: a crescent slash from top right to bottom left, grown in, then thinned out
  "fx-slash": {
    cells: 32,
    frames: 5,
    draw: (put, f, rand) => {
      const [t0, t1] = [
        [0, 0.4],
        [0, 0.85],
        [0.1, 1],
        [0.45, 1],
        [0.8, 1],
      ][f];
      for (let i = 0; i <= 60; i++) {
        const t = t0 + ((t1 - t0) * i) / 60;
        const x = 27 - 22 * t - 5 * Math.sin(Math.PI * t);
        const y = 4 + 23 * t - 5 * Math.sin(Math.PI * t);
        const w = (f < 3 ? 2.6 : 1.4) * Math.sin(Math.PI * t) + 0.4;
        // a blue rim keeps it apart from the foe, flashed white by the blow
        line(put, x, y, x, y, w, [0xffffff, 0xffffff, 0xe0f2fe, 0x3b82f6]);
      }
      if (f >= 2) for (let k = 0; k < 4; k++) put(Math.round(6 + rand() * 20), Math.round(6 + rand() * 20), 0xfff3c4);
    },
  },
  // a crit: eight rays out of a white core, then breaking into flying sparks
  "fx-crit": {
    cells: 32,
    frames: 6,
    draw: (put, f, rand) => {
      const len = [6, 11, 14, 15, 15, 15][f];
      const from = [0, 0, 2, 7, 10, 13][f];
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4 + Math.PI / 8;
        const l = k % 2 ? len * 0.7 : len;
        const s = k % 2 ? from * 0.7 : from;
        line(
          put,
          C + Math.cos(a) * s,
          C + Math.sin(a) * s,
          C + Math.cos(a) * l,
          C + Math.sin(a) * l,
          f < 3 ? 1 : 0.5,
          [0xffffff, 0xfde047, 0xfb923c],
        );
      }
      const core = [4, 5, 4, 2, 1, 0][f];
      if (core) disc(put, C, C, core, [0xffffff, 0xfff3c4]);
      if (f >= 3) for (let k = 0; k < 6; k++) sparkle(put, Math.round(4 + rand() * 24), Math.round(4 + rand() * 24), 1, 0xffffff, 0xfde047);
    },
  },
  // FIRE: a ball of flame that blooms, then breaks into embers and smoke
  "fx-fire": {
    cells: 32,
    frames: 6,
    draw: (put, f, rand) => {
      const r = [5, 9, 12, 13, 12, 9][f];
      const ramp = f < 3 ? [0xfffbe6, 0xfde047, 0xfb923c, 0xfb923c, 0xdc2626] : [0xfde047, 0xfb923c, 0xdc2626, 0x7f1d1d];
      disc(put, C, C + (f >= 3 ? -1 : 0), r, ramp, rand);
      if (f >= 3) {
        // the middle burns out first: holes of smoke where the core was
        for (let k = 0; k < (f - 2) * 7; k++)
          disc(put, C + (rand() - 0.5) * r * 1.4, C + (rand() - 0.6) * r * 1.4, 1.6, [0x4b3a3a, 0x2a2020]);
        for (let k = 0; k < 8; k++) put(Math.round(C + (rand() - 0.5) * 30), Math.round(C + (rand() - 0.5) * 30), 0xfde047);
      }
    },
  },
  // ICE: six spikes of ice grow out from the middle, then shatter into shards
  "fx-ice": {
    cells: 32,
    frames: 6,
    draw: (put, f, rand) => {
      const ramp = [0xffffff, 0xcffafe, 0x67e8f9, 0x0e7490];
      if (f < 4) {
        const len = [5, 10, 13, 14][f];
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3 - Math.PI / 2;
          line(put, C, C, C + Math.cos(a) * len, C + Math.sin(a) * len, f < 2 ? 1.5 : 2, ramp);
        }
        disc(put, C, C, 3, [0xffffff, 0xcffafe]);
        return;
      }
      // shards fly out along the spikes and fall
      for (let k = 0; k < 12; k++) {
        const a = (k * Math.PI) / 6 + rand() * 0.4;
        const d = (f === 4 ? 9 : 13) + rand() * 3;
        const x = C + Math.cos(a) * d;
        const y = C + Math.sin(a) * d + (f - 4) * 2;
        line(put, x - 1, y - 1, x + 1, y + 1, 0.6, [0xffffff, 0x67e8f9]);
      }
    },
  },
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
  // a blow landing on the hero: a small star of impact
  "fx-hit": {
    cells: 32,
    frames: 4,
    draw: (put, f) => {
      const len = [5, 9, 10, 10][f];
      const from = [0, 2, 5, 8][f];
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        line(
          put,
          C + Math.cos(a) * from,
          C + Math.sin(a) * from,
          C + Math.cos(a) * len,
          C + Math.sin(a) * len,
          f < 2 ? 1 : 0.5,
          [0xffffff, 0xfde047, 0xfb923c],
        );
      }
      if (f < 2) disc(put, C, C, 3 - f, [0xffffff, 0xfde047]);
    },
  },
  // the projectiles, 16 cells, two frames of flicker each, flying right
  "fx-fireball": {
    cells: 16,
    frames: 2,
    draw: (put, f) => {
      for (let k = 0; k < 6; k++) disc(put, 9 - k * 1.4, 7.5 + (k % 2 ? (f ? 0.5 : -0.5) : 0), 3.4 - k * 0.45, [0xfb923c, 0xdc2626]);
      disc(put, 10, 7.5, 3.6, [0xfffbe6, 0xfde047, 0xfb923c]);
    },
  },
  "fx-iceshard": {
    cells: 16,
    frames: 2,
    draw: (put, f) => {
      for (let x = 0; x < 12; x++) {
        const h = Math.round(x < 8 ? x * 0.45 : (12 - x) * 0.9);
        for (let dy = -h; dy <= h; dy++) put(2 + x, 7 + dy, dy < 0 ? 0xcffafe : dy > 0 ? 0x0e7490 : 0xffffff);
      }
      put(f ? 4 : 6, 3, 0xffffff);
      put(f ? 7 : 3, 12, 0xcffafe);
    },
  },
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

/** Draws every sheet once into its own texture, frames numbered 0..n-1. */
export function bakeBattleFx(scene: Phaser.Scene): void {
  Object.entries(SHEETS).forEach(([key, sheet], i) => {
    if (scene.textures.exists(key)) return;
    const size = sheet.cells * FX_CELL;
    const tex = scene.textures.createCanvas(key, size * sheet.frames, size);
    if (!tex) return;
    const ctx = tex.getContext();
    for (let f = 0; f < sheet.frames; f++) {
      const put: Cells = (x, y, colour) => {
        if (x < 0 || y < 0 || x >= sheet.cells || y >= sheet.cells) return;
        ctx.fillStyle = `#${colour.toString(16).padStart(6, "0")}`;
        ctx.fillRect(f * size + x * FX_CELL, y * FX_CELL, FX_CELL, FX_CELL);
      };
      sheet.draw(put, f, seeded(101 + i * 31 + f * 7));
      tex.add(f, 0, f * size, 0, size, size);
    }
    tex.refresh();
  });
}

/**
 * Plays a sheet once at (x, y): its frames stepped evenly across `ms`, then
 * gone. 2x by default, the monsters' own scale. Created at depth 0, so a
 * damage number or label added after it draws on top.
 */
export function playFx(scene: Phaser.Scene, key: string, x: number, y: number, ms: number, scale = 2): Phaser.GameObjects.Sprite {
  const frames = SHEETS[key].frames;
  const sprite = scene.add.sprite(x, y, key, 0).setScale(scale);
  scene.tweens.addCounter({
    from: 0,
    to: frames,
    duration: Math.max(1, ms),
    onUpdate: (tw) => sprite.setFrame(Math.min(frames - 1, Math.floor(tw.getValue() ?? 0))),
    onComplete: () => sprite.destroy(),
  });
  return sprite;
}

/** A sheet's two-frame flicker, looping until the caller destroys it. */
export function loopFx(scene: Phaser.Scene, key: string, x: number, y: number, frameMs: number, scale = 2): Phaser.GameObjects.Sprite {
  const frames = SHEETS[key].frames;
  const sprite = scene.add.sprite(x, y, key, 0).setScale(scale);
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
