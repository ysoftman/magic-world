import Phaser from "phaser";
import type { FxModule } from "pixelfx";
import * as pixelfx from "pixelfx";
import * as divineShield from "pixelfx/fx/holy/divine-shield";
import * as heal from "pixelfx/fx/holy/heal";
import * as freeze from "pixelfx/fx/ice/freeze";
import * as electrified from "pixelfx/fx/lightning/electrified";
import * as natureLib from "pixelfx/fx/nature/_lib";
import * as leafStorm from "pixelfx/fx/nature/leaf-storm";
import * as disintegrate from "pixelfx/fx/spawn/disintegrate";
import * as dissolveBurn from "pixelfx/fx/spawn/dissolve-burn";
import * as shatterDeath from "pixelfx/fx/spawn/shatter-death";
import * as burning from "pixelfx/fx/status/burning";
import * as frozen from "pixelfx/fx/status/frozen";
import * as poisoned from "pixelfx/fx/status/poisoned";
import * as rage from "pixelfx/fx/status/rage";
import * as stunned from "pixelfx/fx/status/stunned";
import { battleSource } from "./battleHd";
import { bakePixelSheet, type PixelSheet, warmSheets } from "./fx";
import { GameState } from "./gameState";
import { ART_PX } from "./pixelart";

// The battle's status and recovery effects: pixelfx effects that act on a
// body (o.actor), handed the battler's own picture instead of pixelfx's 24x38
// stand-in. Drawn with the stand-in they paint that figure over the monster
// (burning's flames float at its head height, poisoned and frozen repaint its
// whole body), so each sheet is baked for one battler: its texture read back
// one art cell (ART_PX texels) to a pixelfx pixel, mirrored as the sprite is.
// Baked on first use and kept for the battle, one per battler, effect and,
// for poison and rage, the tint the battler shows: the effect repaints the
// body, and the purple it is flashed (the red an enraged boss keeps) has to
// stay under it. Most play once (play()); the stars of a stuck foe hold for
// as long as it is stuck (loop()). A foe's death (shatter, dissolve,
// disintegrate) takes its body over and leaves nothing.

export type StatusKind =
  | "heal"
  | "ward"
  | "burn"
  | "chill"
  | "shock"
  | "poison"
  | "freeze"
  | "stun"
  | "rage"
  | "regrow"
  | "shatter"
  | "dissolve"
  | "disintegrate";

// a fx.ts pixel sheet over the whole canvas, its span and frames set. body:
// the battler's colours as handed to the effect, "tinted" with its tint at
// play() (or the one warm() is told it will have), or "grey" (their
// brightness only)
interface StatusSheet extends PixelSheet {
  span: [number, number];
  frames: number;
  body?: "tinted" | "grey";
  /**
   * baked as two sheets, the effect's drawBack under the battler's sprite and
   * its draw over it: a ring round the head passes behind it (a pure effect
   * only, one with no create)
   */
  layered?: boolean;
  /**
   * the body handed over trimmed to its opaque cells: an effect placed by the
   * head (a.y, a.w) otherwise goes by the frame's top and width, over the
   * empty rows above a short foe
   */
  trim?: boolean;
  /** the last share of play()'s ms it fades out over: a loop's stretch played once has no end of its own */
  fade?: number;
  /** the first share it fades in over, as a loop's stretch has no start of its own either */
  rise?: number;
  /** its glow (pixelfx's light) with FLASHES off or the OS's reduced motion, as fx.ts softens a flash */
  soft?: number;
  /** seeded by the battler: rage keeps its floor cracks by seed alone, and a second boss stood on the first one's */
  ownSeed?: boolean;
  /**
   * screen px over its anchor (the feet) where it is gone, faded out over the
   * CEILING_FADE effect pixels under that: what it throws up off a big
   * foe's head would reach into the foe's window. In screen px, so it is
   * the same line on screen whatever the cell (4px, 4.6px at enrage's
   * 1.15x throb).
   */
  ceiling?: number;
  /**
   * a death: the battler's own sprite shown as long as the effect's
   * actorAlpha has it (the effect draws over it, then breaks it up), and its
   * floor the ground under a hovering battler (StatusFx.hover), where what
   * falls off it lands
   */
  fells?: boolean;
  /** a death's moment its body is gone, in the effect's seconds: where the foe's gold drops from (breakOf) */
  breaks?: number;
}

// rage's ceiling and the deaths': over the feet at GROUND_Y (456), y 222,
// under the foe's window (to y 200), the fade's 8 cells (32px) under that
const WINDOW_CEILING = 234;

// how many effect pixels a sheet's ceiling fades out over
const CEILING_FADE = 8;

// The OS's reduced-motion setting, as fx.ts reads it: it counts as FLASHES
// off, and holds a looping status on one frame as the fighters stop breathing
const reducedMotion = (): boolean => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

// a looping status going away (StatusFx.loop's stop) fades out this long
const LOOP_FADE_MS = 250;

// ramps, dark to bright: the battle's own colours for each (the HEAL spell's
// green, WARD's blue, the burn's red rim, FREEZE_TINT's cyan, PSN's purple)
const HEAL_RAMP = ["#08201a", "#0f3f2c", "#17663e", "#24924e", "#3ec466", "#7ee88a", "#c8ffc4", "#ffffff"];
const WARD_RAMP = ["#0b1838", "#15306b", "#1e4fa0", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#ffffff"];
// a step darker than burning's own: its yellow tongues were lost on a foe flashed orange
const BURN_RAMP = ["#3a0d0a", "#7a1610", "#b91c1c", "#dc2626", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6"];
const ICE_RAMP = ["#0b2a3a", "#0e4a63", "#0e7490", "#22a6c4", "#67e8f9", "#a5f3fc", "#cffafe", "#ffffff"];
const PSN_RAMP = ["#1a0533", "#3b0764", "#581c87", "#7e22ce", "#a855f7", "#c084fc", "#e9d5ff", "#f5d0fe"];
// the ABYSS's violet (its floor label's #c084fc), the accent a step bluer
const ABYSS_RAMP = ["#12062a", "#2a0f55", "#4c1d95", "#6d28d9", "#8b5cf6", "#c084fc", "#e9d5ff", "#ffffff"];

// The MOSS GOLEM's regrow spiral: pixelfx's nature/leaf-storm (MIT, by Patch
// and Hugo Duprez; its leaves' tumble after Sprite Fusion's falling leaves,
// MIT) drawn round a wider body. The effect has no size of its own to turn
// up, its rings a constant 15-24 cells out, and at the golem's 4px cell they
// fell inside its 94px half-width: the leaves read as stuck on it, not
// whirling round it. Its draw is copied here with the rings, the fling off
// the top and the litter at the feet SPIRAL_SPREAD times as far out (90-144px,
// where they were when bosses were drawn at 6px); the leaves themselves
// (drawLeaf) and every other number are pixelfx's own. A copy, so a pixelfx
// upgrade does not reach it.
interface SpiralPainter {
  px(x: number, y: number, c: number): void;
  dot(x: number, y: number, c: number, a?: number): void;
  blend(x: number, y: number, c: number, a: number): void;
  glow(x: number, y: number, r: number, c: number, k?: number): void;
  disc(x: number, y: number, r: number, c: number, a: number): void;
}
interface SpiralRng {
  next(): number;
  range(a: number, b: number): number;
  int(a: number, b: number): number;
}
const { cycle, fit, rng, smooth, clamp, lerp, TAU, WHITE } = pixelfx as unknown as {
  cycle(
    t: number,
    period: number,
    count: number,
    seed: number,
    life: number | ((g: SpiralRng) => number),
    fn: (age: number, life: number, r: SpiralRng) => void,
  ): void;
  fit(ramp: unknown[], n: number): number[];
  rng(...ns: number[]): SpiralRng;
  smooth(e0: number, e1: number, x: number): number;
  clamp(x: number, a?: number, b?: number): number;
  lerp(a: number, b: number, t: number): number;
  TAU: number;
  WHITE: number;
};
const { drawLeaf } = natureLib as unknown as {
  drawLeaf(p: SpiralPainter, x: number, y: number, len: number, wid: number, ang: number, fl: number, pal: number[], alpha?: number): void;
};
const SPIRAL_SPREAD = 1.5;
const SPIRAL_TOP = 64;
const SPIRAL_SY = 0.3;
const SPIRAL_D = leafStorm.meta.duration;
const spiralR = (y: number): number => (15 + 9 * clamp(-y / SPIRAL_TOP)) * SPIRAL_SPREAD;

// leaves riding the spiral: up from the floor, round two turns or so, flung out off the top
function spiralLeaves(p: SpiralPainter, L: number[], t: number, seed: number, back: boolean): void {
  cycle(
    t,
    SPIRAL_D,
    28,
    seed,
    (g) => g.range(1.5, 2.3),
    (age, life, R) => {
      const k = age / life;
      const turns = R.range(1.4, 2.2);
      const th = R.range(0, TAU) + turns * TAU * k;
      const sn = Math.sin(th);
      if (sn > 0 === back) return;
      const y = -lerp(1, SPIRAL_TOP, k ** 0.9) - R.range(0, 6);
      const fling = smooth(0.75, 1, k);
      const rr = spiralR(y) * R.range(0.85, 1.15) + fling * 22 * SPIRAL_SPREAD;
      const x = Math.cos(th) * rr;
      const yy = y + sn * rr * SPIRAL_SY;
      const a = Math.min(1, k * 7) * (1 - smooth(0.85, 1, k));
      const spin = R.range(-9, 9) * age + th;
      const fl = age * R.range(5, 11);
      const o = R.int(0, 2) * 4;
      const pal = back ? [L[o], L[o], L[o + 1], L[o + 2]] : [L[o], L[o + 1], L[o + 2], L[o + 3]];
      drawLeaf(p, x, yy, R.range(6.5, 9), R.range(2.4, 3.3), spin, fl, pal, a);
      // a glint as it turns face on to the light
      if (!back && Math.abs(Math.cos(fl)) > 0.97) {
        p.px(x, yy, WHITE);
        p.glow(x, yy, 5, L[o + 3], 0.35 * a);
      }
    },
  );
}

// wind bands: 1px streaks on tilted rings round it, bright at the head, the far halves dimmer and behind
function spiralWind(p: SpiralPainter, C: number[], t: number, seed: number, back: boolean): void {
  for (let j = 0; j < 16; j++) {
    const R = rng(seed, j);
    const y0 = -R.range(4, SPIRAL_TOP - 4);
    const r = spiralR(y0) * R.range(1.0, 1.25);
    const K = R.int(2, 3);
    const span = R.range(1.1, 2.4);
    const head = R.range(0, TAU) + (TAU * K * t) / SPIRAL_D;
    const rise = R.range(-0.18, 0.18);
    for (let s = 0; s <= span; s += 0.45 / r) {
      const th = head - s;
      const sn = Math.sin(th);
      if (sn > 0 === back) continue;
      const k = s / span;
      const x = Math.cos(th) * r;
      const y = y0 + sn * r * SPIRAL_SY + (th - head) * rise * 4;
      const c = back ? (k < 0.3 ? C[3] : C[2]) : k < 0.06 && R.next() < 2 ? WHITE : k < 0.15 ? C[5] : k < 0.4 ? C[4] : C[3];
      if (k < 0.45) p.dot(x, y, c);
      else p.blend(x, y, c, 1.6 * (1 - k));
    }
    if (!back && Math.sin(head) > 0) p.glow(Math.cos(head) * r, y0 + Math.sin(head) * r * SPIRAL_SY, 5, C[4], 0.25);
  }
}

// at the feet: litter and dust swept round on the floor
function spiralSwirl(p: SpiralPainter, C: number[], t: number, seed: number, back: boolean): void {
  cycle(
    t,
    SPIRAL_D,
    14,
    seed,
    (g) => g.range(0.6, 1.1),
    (age, life, R) => {
      const k = age / life;
      const th = R.range(0, TAU) + R.range(6, 9) * age;
      const sn = Math.sin(th);
      if (sn > 0 === back) return;
      const rr = (R.range(10, 22) + k * 8) * SPIRAL_SPREAD;
      const x = Math.cos(th) * rr;
      const y = -1 - k * R.range(2, 8) + sn * rr * 0.25;
      const s = R.range(2, 3.5) * (0.6 + k);
      p.disc(x, y, s, back ? C[2] : C[3], (1 - k) * Math.min(1, k * 6) * 0.3);
    },
  );
  for (let j = 0; j < 6; j++) {
    const R = rng(seed + 9, j);
    const rr = R.range(12, 24) * SPIRAL_SPREAD;
    const th0 = R.range(0, TAU) + (TAU * 3 * t) / SPIRAL_D;
    const span = R.range(0.5, 1);
    for (let s = 0; s < span; s += 0.6 / rr) {
      const th = th0 - s;
      if (Math.sin(th) > 0 === back) continue;
      p.dot(Math.cos(th) * rr, 0.5 + rr * 0.2 * Math.sin(th), s < span * 0.4 ? C[3] : C[2], 1 - s / span);
    }
  }
}

const MOSS_SPIRAL = {
  // wide enough for the outer rings (36 cells), the fling off the top (33) and a leaf
  meta: { ...leafStorm.meta, size: [160, 108] as [number, number], origin: [80, 92] as [number, number] },
  drawBack(p: SpiralPainter, t: number, o: Record<string, unknown>): void {
    const C = fit(o.palette as unknown[], 6);
    const L = fit(o.leaves as unknown[], 12);
    const seed = o.seed as number;
    p.glow(0, -30, 46, C[4], 0.12);
    p.glow(0, -2, 26, L[2], 0.12);
    spiralSwirl(p, C, t, seed * 3 + 1, true);
    spiralWind(p, C, t, seed * 5 + 2, true);
    spiralLeaves(p, L, t, seed * 7 + 3, true);
  },
  draw(p: SpiralPainter, t: number, o: Record<string, unknown>): void {
    const C = fit(o.palette as unknown[], 6);
    const L = fit(o.leaves as unknown[], 12);
    const seed = o.seed as number;
    spiralSwirl(p, C, t, seed * 3 + 1, false);
    spiralWind(p, C, t, seed * 5 + 2, false);
    spiralLeaves(p, L, t, seed * 7 + 3, false);
  },
} as FxModule;

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
  // frosted over (status/frozen): the body redrawn in ice, rime, snow above,
  // frost underfoot. Ice from its greys: frozen pulls a colour only 38% of the
  // way to ice, which left a red KING SLIME pink-brown
  chill: { fx: frozen, opts: { palette: ICE_RAMP }, span: [0, 0.9], frames: 10, body: "grey" },
  // arcs crawling over the outline, two jolts that flare the whole body
  shock: { fx: electrified, span: [0, 1], frames: 10 },
  // one tick of poisoned: purple rolling up the body, blisters popping, a ring
  // on the floor, sweat dripping
  poison: { fx: poisoned, opts: { palette: PSN_RAMP, veins: "#1a0533" }, span: [0, 0.8], frames: 10, body: "tinted" },
  // frost races in and climbs the hero, a block of ice crystallizes round it
  // and glints; it cracks and bursts later, past the span: the hero stays frozen
  freeze: { fx: freeze, opts: { palette: ICE_RAMP }, span: [0.1, 1.5], frames: 12 },
  // a stuck foe (StatusFx.loop): three gold stars (the STUN label's yellow)
  // and two birds round its head on a tilted ring, the far half behind it; the
  // whole 2s loop, the ring going round twice, at 15fps
  stun: { fx: stunned, span: [0, 2], frames: 30, layered: true, trim: true },
  // A boss or giant snapping (enrage): one heartbeat of the loop, lub and
  // dub. The body judders on each in ENRAGE_TINT's red, an anger mark throbs
  // at its brow, stress lines and steam burst off its head, the floor cracks
  // hot and spits embers; the calm after it fades out. Once, not looped for
  // the rest of the fight: every beat repaints the body, over a hit's white
  // flash and a wind-up's colour, and the steam and lines rising off a big
  // foe's head would keep reaching for the foe's window. Its red glow on the
  // beat lights a disc some 300px across: a faint one with FLASHES off.
  // The steam and the lines off the tallest, the FLAME DRAKE (its top 47
  // cells up, at y 268), rise some 16 cells over its head: to y 180, into
  // the window (to 200), when bosses were drawn at 6px, and to about y 204
  // at 4px. Gone 234px (58 cells) over the feet, y 222, and at the 1.15x
  // throb's peak (feet at 470, 4.6px cells) y 201.
  rage: {
    fx: rage,
    span: [0, 0.75],
    frames: 15,
    body: "tinted",
    layered: true,
    trim: true,
    fade: 0.3,
    soft: 0.35,
    ownSeed: true,
    ceiling: WINDOW_CEILING,
  },
  // The MOSS GOLEM regrowing its moss (BattleScene regenerate): one turn of
  // leaves tumbling up a spiral round it, behind and in front of it (its
  // drawBack under the golem), wrapped in bands of wind, litter swirling at
  // its feet. Its leaves in the golem's own moss greens (MOSS_GOLEM_PALETTE
  // n, m, M), the wind in its eyes' glow (e, #8ce99a); its autumn golds and
  // reds left out, which read as a wind attack. Its rings 22-36 cells out
  // (MOSS_SPIRAL, above), 90-144px round a golem 94px half-wide, and it
  // rises 64 cells (256px), cut at the ceiling (y 222), some 10 cells over
  // the head. 18 frames of the 2.4s loop, two rows a layer (1920x216).
  regrow: {
    fx: MOSS_SPIRAL,
    opts: {
      palette: ["#10241a", "#1e4030", "#2f6a4a", "#4fae6e", "#8ce99a", "#e8fff0"],
      leaves: [
        ...["#1c3314", "#2a4a1f", "#4d7a35", "#7fb04a"],
        ...["#123818", "#2f7a2a", "#6cb83a", "#c8f070"],
        ...["#24401c", "#4d7a35", "#7fb04a", "#b6dc78"],
      ],
    },
    span: [0, 2.4],
    frames: 18,
    layered: true,
    rise: 0.15,
    fade: 0.25,
    ceiling: WINDOW_CEILING,
  },
  // The deaths (BattleScene victory), in place of fx-poof for a foe of ice,
  // of fire or met in the ABYSS. Each takes the body over: the sprite goes
  // as the effect's actorAlpha says, and nothing is left at the end. Their
  // glow, a white flash or a fire's, is soft with FLASHES off.
  // Frost seals the body in faceted ice, cracks spread, it bursts into its
  // facets at 1.4s (its BURST), which tumble, bounce and melt (the last of
  // the melt left off)
  shatter: {
    fx: shatterDeath,
    opts: { palette: ICE_RAMP },
    span: [0.05, 2.5],
    frames: 30,
    fade: 0.2,
    soft: 0.35,
    fells: true,
    breaks: 1.4,
    ceiling: WINDOW_CEILING,
  },
  // it catches from the feet up, burns to char and crumbles into embers and
  // smoke rising off, the body all but gone by 1.6s (the smoke's last wisps
  // left off)
  dissolve: {
    fx: dissolveBurn,
    opts: { palette: BURN_RAMP },
    span: [0.1, 2.6],
    frames: 30,
    fade: 0.2,
    soft: 0.35,
    fells: true,
    breaks: 1.6,
    ceiling: WINDOW_CEILING,
  },
  // a white flash, a ring on the floor, then the body peels into motes the
  // wind carries off right, away from the hero; gone by 1.2s (its PEEL)
  disintegrate: {
    fx: disintegrate,
    opts: { palette: ABYSS_RAMP, accent: ["#86198f", "#e879f9", "#fae8ff"] },
    span: [0.2, 2.6],
    frames: 30,
    fade: 0.2,
    soft: 0.35,
    fells: true,
    breaks: 1.2,
    ceiling: WINDOW_CEILING,
  },
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

// what a battler's tint (its colour and mode) does to a colour, for the colours an effect repaints
function tintOf(t: number, mode: Phaser.TintModes): { id: string; apply: (c: Rgb) => Rgb } | null {
  const tr = (t >> 16) & 255;
  const tg = (t >> 8) & 255;
  const tb = t & 255;
  const id = t.toString(16).padStart(6, "0");
  if (mode === Phaser.TintModes.FILL) return { id: `fill-${id}`, apply: () => [tr, tg, tb] };
  if (mode === Phaser.TintModes.MULTIPLY && t !== 0xffffff)
    return { id: `mul-${id}`, apply: ([r, g, b]) => [Math.round((r * tr) / 255), Math.round((g * tg) / 255), Math.round((b * tb) / 255)] };
  return null;
}

const greyOf = ([r, g, b]: Rgb): Rgb => {
  const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  return [l, l, l];
};

// a battler's frame as RGBA bytes, texture size
interface FramePixels {
  data: Uint8ClampedArray;
  tw: number;
  th: number;
}

// The texture a battler's body is read from: its art as baked, not the
// battle's copy with the outline smoothed (battleHd.ts). The body is read a
// cell at a time, and a smoothed copy has texels of an outline colour in the
// empty cells at its inner corners, which would read as cells of the body.
const bodyKey = (sprite: Phaser.GameObjects.Sprite): string => battleSource(sprite.texture.key);

function framePixels(sprite: Phaser.GameObjects.Sprite): FramePixels | null {
  const frame = sprite.scene.textures.getFrame(bodyKey(sprite), sprite.frame.name) ?? sprite.frame;
  const src = frame.source.image;
  if (!(src instanceof HTMLCanvasElement || src instanceof HTMLImageElement)) return null;
  const tw = frame.cutWidth;
  const th = frame.cutHeight;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  ctx.canvas.width = tw;
  ctx.canvas.height = th;
  ctx.drawImage(src, frame.cutX, frame.cutY, tw, th, 0, 0, tw, th);
  return { data: ctx.getImageData(0, 0, tw, th).data, tw, th };
}

// The sprite's frame read back on the art grid: a cell is on when any of its
// texels is, in that texel's colour. `feet` is the texels from the frame's top
// to the line under its lowest cell, where the effect's anchor goes. `trim`
// crops the frame to the cells that are on (the mask, a.x/a.y/a.w/a.h and the
// head with it), the anchor staying where the frame's would be. `lift`: the
// cells the body hovers over the anchor (a flier over the ground).
function actorOf(
  sprite: Phaser.GameObjects.Sprite,
  { data, tw, th }: FramePixels,
  recolor: ((c: Rgb) => Rgb) | null,
  trim = false,
  lift = 0,
): { actor: Actor; feet: number } {
  const w = Math.ceil(tw / ART_PX);
  const h = Math.ceil(th / ART_PX);
  const mask = new Uint8Array(w * h);
  const pixels = new Uint32Array(w * h);
  // the cells that are on: columns left..right, rows top..bottom (mirrored columns)
  let [left, right, top, bottom] = [w, -1, h, 0];
  for (let cy = 0; cy < h; cy++)
    for (let cx = 0; cx < w; cx++)
      for (let k = 0; k < ART_PX * ART_PX; k++) {
        const x = cx * ART_PX + (k % ART_PX);
        const y = cy * ART_PX + Math.floor(k / ART_PX);
        if (x >= tw || y >= th) continue;
        const i = (y * tw + x) * 4;
        if (data[i + 3] === 0) continue;
        const [r, g, b] = recolor ? recolor([data[i], data[i + 1], data[i + 2]]) : [data[i], data[i + 1], data[i + 2]];
        // mirrored as the sprite is drawn
        const mx = sprite.flipX ? w - 1 - cx : cx;
        const at = cy * w + mx;
        mask[at] = 1;
        // pixelfx colours are ImageData bytes read as one number: R in the low byte
        pixels[at] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
        [left, right, top, bottom] = [Math.min(left, mx), Math.max(right, mx), Math.min(top, cy), Math.max(bottom, cy)];
        break;
      }
  const feet = (bottom + 1 + lift) * ART_PX;
  const x = -Math.floor(w / 2);
  const y = -(bottom + 1 + lift);
  const actor = (m: Uint8Array, px: Uint32Array, ax: number, ay: number, aw: number, ah: number): Actor => ({
    mask: { w: aw, h: ah, data: m },
    pixels: px,
    x: ax,
    y: ay,
    w: aw,
    h: ah,
    k: 2,
    head: [0, ay],
    chest: [0, Math.round(ay * 0.6)],
  });
  if (!trim || right < left) return { actor: actor(mask, pixels, x, y, w, h), feet };
  const [cw, ch] = [right - left + 1, bottom - top + 1];
  const cropped = new Uint8Array(cw * ch);
  const croppedPixels = new Uint32Array(cw * ch);
  for (let cy = 0; cy < ch; cy++)
    for (let cx = 0; cx < cw; cx++) {
      cropped[cy * cw + cx] = mask[(top + cy) * w + left + cx];
      croppedPixels[cy * cw + cx] = pixels[(top + cy) * w + left + cx];
    }
  return { actor: actor(cropped, croppedPixels, x + left, -ch - lift, cw, ch), feet };
}

// a pixelfx effect's draw and drawBack, and how much of its body a death
// leaves the host to draw (actorAlpha), which env.d.ts leaves out of FxModule
type Draw = (p: unknown, t: number, o: Record<string, unknown>) => void;
interface Layers extends FxModule {
  draw: Draw;
  drawBack?: Draw;
  actorAlpha?: (t: number, o: Record<string, unknown>) => number;
}

// One layer of a pure effect as an effect of its own: bakePixelSheet draws
// both of them into one frame, the back over the battler with the rest.
function layerOf(fx: FxModule, back: boolean): FxModule {
  const { meta, draw, drawBack } = fx as Layers;
  const layer: Layers = { meta, draw: (back ? drawBack : draw) ?? (() => {}) };
  return layer;
}

// Erases what a baked sheet draws over its ceiling, frame by frame, and fades
// the CEILING_FADE rows under it: a status sheet's frames are the effect's
// whole canvas (no crop), its anchor on row origin[1] of each. `cell`: the
// screen px an effect pixel is shown at on its battler.
function fadeAbove(scene: Phaser.Scene, key: string, sheet: StatusSheet, cell: number): void {
  const tex = scene.textures.get(key);
  if (sheet.ceiling === undefined || !(tex instanceof Phaser.Textures.CanvasTexture)) return;
  const h = sheet.fx.meta.size[1];
  const gone = Math.max(0, sheet.fx.meta.origin[1] - Math.round(sheet.ceiling / cell));
  const ctx = tex.getContext();
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  for (let y = 0; y < tex.height; y += h) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, y, tex.width, gone);
    const fade = ctx.createLinearGradient(0, y + gone, 0, y + gone + CEILING_FADE);
    fade.addColorStop(0, "rgba(0, 0, 0, 1)");
    fade.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, y + gone, tex.width, CEILING_FADE);
  }
  ctx.restore();
  tex.refresh();
}

// a battler's own seed for an effect, the same every battle
function seedOf(key: string): number {
  let h = 7;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 9973;
  return h + 1;
}

// a status's sprites on one battler: one sheet, or a layered one's back (under
// the battler) and front
interface Layered {
  sprites: Phaser.GameObjects.Sprite[];
  // shows frame f where the battler is now, at its size now (a throb scales it)
  show: (f: number) => void;
  destroy: () => void;
}

// what a bake of a status on a battler goes under and reads (StatusFx.plan)
interface Plan {
  key: string;
  // its textures: the key, or a layered sheet's back and front
  layers: string[];
  recolor: ((c: Rgb) => Rgb) | null;
  soft: boolean;
  // the cells a death's body hovers over its floor (hover())
  lift: number;
}

/** The share of a death's play its body is gone by: where the foe's gold drops from. */
export function breakOf(kind: StatusKind): number {
  const { span, breaks } = STATUS_SHEETS[kind];
  return breaks === undefined ? 0 : (breaks - span[0]) / (span[1] - span[0]);
}

/**
 * The status and recovery effects of one battle, at depth 0 as playFx's are:
 * the stat windows draw over them. The sheets go with the battle.
 */
export class StatusFx {
  // each sheet ready to show (baked, its ceiling faded), and the texels from its battler's top to its feet
  private readonly feet = new Map<string, number>();
  // every texture baked or queued for this battle, removed at its end (a warm cut off halfway leaves some)
  private readonly textures = new Set<string>();
  // the textures whose ceiling is faded: a warm finishing after a bake that could not wait must not fade it twice
  private readonly faded = new Set<string>();
  // each battler frame read back once (framePixels): the opening's warm hands
  // the same body to six sheets, and its reads were 11ms of the battle's create
  private readonly frames = new Map<string, FramePixels | null>();
  // the cells each hovering battler is over the ground (hover())
  private readonly lifts = new Map<Phaser.GameObjects.Sprite, number>();

  constructor(private readonly scene: Phaser.Scene) {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const tex of this.textures) if (scene.textures.exists(tex)) scene.textures.remove(tex);
      this.textures.clear();
      this.faded.clear();
      this.frames.clear();
      this.feet.clear();
      this.lifts.clear();
    });
  }

  /** `target` hovers `cells` art cells over the ground: where its death's debris lands (StatusSheet fells). */
  hover(target: Phaser.GameObjects.Sprite, cells: number): void {
    this.lifts.set(target, cells);
  }

  /**
   * Plays `kind` on `target` for `ms`, its anchor on the battler's feet at the
   * battler's own scale (2, a boss's and a giant's too). It follows the battler, which breathes
   * and throbs under it, so a repainted body stays on the sprite.
   */
  play(target: Phaser.GameObjects.Sprite, kind: StatusKind, ms: number): void {
    const sheet = STATUS_SHEETS[kind];
    const on = this.sprites(target, kind);
    if (!on) return;
    const fadeFrom = 1 - (sheet.fade ?? 0);
    // a death's battler, shown while the effect leaves its body to it
    const body = sheet.fells ? (sheet.fx as Layers).actorAlpha : undefined;
    const [from, to] = sheet.span;
    const at = (u: number): void => {
      on.show(Math.min(sheet.frames - 1, Math.floor(u * sheet.frames)));
      const rising = sheet.rise ? Math.min(1, u / sheet.rise) : 1;
      if (sheet.rise || u > fadeFrom) for (const s of on.sprites) s.setAlpha(rising * (u > fadeFrom ? (1 - u) / (1 - fadeFrom) : 1));
      if (body) target.setAlpha(body(from + u * (to - from), sheet.opts ?? {}));
    };
    at(0);
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: Math.max(1, ms),
      onUpdate: (tw) => at(tw.getValue() ?? 0),
      onComplete: () => on.destroy(),
    });
  }

  /**
   * Loops `kind` on `target` as play() does until the function it returns is
   * called, which fades it out. In real time, as the fighters breathe: BATTLE
   * SPEED hurries the fight, not a status that holds. Held on its first frame
   * under the OS's reduced motion, which keeps the fighters still too.
   */
  loop(target: Phaser.GameObjects.Sprite, kind: StatusKind): () => void {
    const sheet = STATUS_SHEETS[kind];
    const on = this.sprites(target, kind);
    if (!on) return () => {};
    const still = reducedMotion();
    const turn = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: (sheet.span[1] - sheet.span[0]) * 1000,
      repeat: -1,
      onUpdate: (tw) => on.show(still ? 0 : Math.min(sheet.frames - 1, Math.floor((tw.getValue() ?? 0) * sheet.frames))),
    });
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      this.scene.tweens.add({
        targets: on.sprites,
        alpha: 0,
        duration: LOOP_FADE_MS,
        onComplete: () => {
          turn.remove();
          on.destroy();
        },
      });
    };
  }

  /**
   * Bakes `kind` for `target` over the next frames (fx.ts warmSheets), so the
   * turn it lands on doesn't stall for it: baked there, the first BURN, CHILL,
   * HEAL or WARD held that turn 12-36ms (headless), the stun's two layers
   * 19-66ms on top of the shock's own 9-20. `tint` and `mode`: what the
   * battler will show by then, for a "tinted" body (an enraged boss's
   * ENRAGE_TINT, multiplied; a foe's poison tick fills it purple); left out,
   * the tint it shows now. Should it be needed before it is in, play() and
   * loop() bake what is left there and then.
   */
  warm(target: Phaser.GameObjects.Sprite, kind: StatusKind, tint?: number, mode = Phaser.TintModes.MULTIPLY): void {
    const plan = this.plan(target, kind, tint, mode);
    if (this.feet.has(plan.key)) return;
    const bake = this.bakeOf(target, kind, plan);
    if (!bake) return;
    let left = plan.layers.length;
    warmSheets(this.scene, bake.sheets, (key) => {
      this.settle(key, kind, target);
      left -= 1;
      if (left === 0) this.feet.set(plan.key, bake.feet);
    });
  }

  // What a bake of `kind` on `target` reads, so its key: the battler's frame,
  // its mirroring, the tint a "tinted" body shows (`tint` in `mode`, else the
  // sprite's now) and, for a sheet with a soft glow, whether it is soft.
  private plan(target: Phaser.GameObjects.Sprite, kind: StatusKind, tint?: number, mode = Phaser.TintModes.MULTIPLY): Plan {
    const sheet = STATUS_SHEETS[kind];
    const tinted = sheet.body !== "tinted" ? null : tint === undefined ? tintOf(target.tintTopLeft, target.tintMode) : tintOf(tint, mode);
    const soft = sheet.soft !== undefined && (!GameState.flashes || reducedMotion());
    const lift = sheet.fells ? (this.lifts.get(target) ?? 0) : 0;
    const key = `status-${kind}:${bodyKey(target)}:${target.frame.name}${target.flipX ? ":flip" : ""}${tinted ? `:${tinted.id}` : ""}${soft ? ":soft" : ""}${lift ? `:lift${lift}` : ""}`;
    return {
      key,
      layers: sheet.layered ? [`${key}:back`, `${key}:front`] : [key],
      recolor: sheet.body === "grey" ? greyOf : (tinted?.apply ?? null),
      soft,
      lift,
    };
  }

  // each of the plan's textures as bakePixelSheet and warmSheets take it, the
  // battler's body handed over, and the battler's feet
  private bakeOf(
    target: Phaser.GameObjects.Sprite,
    kind: StatusKind,
    plan: Plan,
  ): { sheets: Record<string, PixelSheet>; feet: number } | null {
    const sheet = STATUS_SHEETS[kind];
    const at = `${bodyKey(target)}:${target.frame.name}`;
    if (!this.frames.has(at)) this.frames.set(at, framePixels(target));
    const pixels = this.frames.get(at);
    if (!pixels) return null;
    const body = actorOf(target, pixels, plan.recolor, sheet.trim, plan.lift);
    const opts = {
      ...sheet.opts,
      actor: body.actor,
      ...(sheet.ownSeed ? { seed: seedOf(bodyKey(target)) } : {}),
      ...(plan.soft ? { light: sheet.soft } : {}),
    };
    const sheets: Record<string, PixelSheet> = {};
    plan.layers.forEach((key, i) => {
      sheets[key] = { ...sheet, fx: sheet.layered ? layerOf(sheet.fx, i === 0) : sheet.fx, opts };
      this.textures.add(key);
    });
    return { sheets, feet: body.feet };
  }

  // a texture just baked: its ceiling faded, once, on the cell of `target`
  // at its own size (a throb's 1.15x left out)
  private settle(key: string, kind: StatusKind, target: Phaser.GameObjects.Sprite): void {
    if (this.faded.has(key)) return;
    this.faded.add(key);
    fadeAbove(this.scene, key, STATUS_SHEETS[kind], ART_PX * Math.round(target.scaleX));
  }

  // The sheet (or its two layers) for `kind` on `target`, baked here if no
  // warm has put it in yet, on its first frame where the battler stands
  private sprites(target: Phaser.GameObjects.Sprite, kind: StatusKind): Layered | null {
    const sheet = STATUS_SHEETS[kind];
    const plan = this.plan(target, kind);
    let feet = this.feet.get(plan.key);
    if (feet === undefined) {
      const bake = this.bakeOf(target, kind, plan);
      if (!bake) return null;
      // a layer a warm still under way has finished is skipped
      for (const [key, s] of Object.entries(bake.sheets)) {
        bakePixelSheet(this.scene, key, s);
        this.settle(key, kind, target);
      }
      feet = bake.feet;
      this.feet.set(plan.key, feet);
    }
    const {
      size: [w, h],
      origin: [ax, ay],
    } = sheet.fx.meta;
    const sprites = plan.layers.map((k) => this.scene.add.sprite(target.x, target.y, k, 0).setOrigin(ax / w, ay / h));
    // under the battler, its shadow under that (BattleScene stand())
    if (sheet.layered) this.scene.children.moveBelow(sprites[0], target);
    // from the battler's middle (its origin) down to its feet, at its size now
    const texels = feet - target.frame.cutHeight / 2;
    const show = (f: number): void => {
      for (const s of sprites)
        s.setFrame(f)
          .setPosition(target.x, target.y + texels * target.scaleY)
          .setScale(target.scaleX * ART_PX);
    };
    show(0);
    return {
      sprites,
      show,
      destroy: () => {
        for (const s of sprites) s.destroy();
      },
    };
  }
}
