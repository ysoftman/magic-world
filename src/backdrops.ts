import type Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, PIXEL } from "./config";
import { ART_PX } from "./pixelart";

// The title screen's backdrop (makeTitleBg, at the end) and the battle
// backdrops, one per field a fight starts in, baked once at boot
// (BootScene) as 1280x720 textures: "battle-bg-<region>", and for the town and
// the forest one per look the season gives their maps ("-autumn", "-winter";
// art/tilesets.ts battleBgKey picks). Each is drawn in three depths on 2px
// cells (C, ART_PX), the cell the field's art has on screen and the fighters'
// battle textures have (battleHd.ts); what sets it back is its lower chroma
// and contrast:
//
// - far: mountains, a tree wall or a cave wall, close to the sky's colour
// - mid: hills, trees, rocks or pillars, darker and still muted
// - near: the ground the fighters stand on, and dark shapes at the screen's
//   left and right edges that frame the fight without reaching the fighters
//
// The backdrop loses to the fighters: every layer is less saturated and lower
// in contrast than the 32-cell sprites in front of it (the same idea as
// check:art's limit on terrain), and nothing bright sits behind where they
// stand (hero x 256..384, y 336..464; foe x 864..1056, y 256..466, shadows
// included), behind the two stat windows (x 32..496 and 784..1248, y
// 24..200; their 0.85 fill lets the backdrop through) or behind the NIGHT /
// ARENA / ABYSS note between them (x 520..760, y 40..116).
//
// Fixed lines the rest of the battle relies on:
// - the horizon is y 440: BattleWeather splashes rain below it, and the
//   fighters stand just under its lit lip, their shadows on the ground
//   (BattleScene GROUND_Y 456, the companion's 464)
// - the ground stays dark and plain where the battle menu, the hint and the
//   item list are drawn straight onto it (y 488..584) in white and pale blue:
//   tufts, cracks and seams keep to the strip just under the horizon
//   (y 444..484) or the screen's edges. Winter's ground is the snow field's
//   icy teal, not the map's pale snow (white on that was ~1.9:1, on this ~9:1)
// - night is not drawn here: BattleScene lays the field's sky overlay over the
//   backdrop, and BattleWeather its rain, snow or ash
//
// Band colours were picked against the fighters: a rust or brown band behind
// the hero sat on his hair and boots (0x6b4226, 0x4a2f1a), a grey winter sky on
// the wolf's greys, a slate one on his navy trousers. So the town's and the
// forest's bands around the hero stay green, red-orange or teal, never brown.
//
// The backdrops were first drawn on 4px cells, and their sizes are still
// written in that step (P): the lip is P * 3 high, a mid trunk P * 4 wide, a
// cloud's lumps P apart. Halving the cell kept every one of those and only
// made the edges finer. What is one cell, a rim, a dither row, a star, is C.

const C = ART_PX;
const P = PIXEL;
const GROUND = 440;
const W = GAME_WIDTH;

type G = Phaser.GameObjects.Graphics;

const snap = (v: number): number => Math.round(v / C) * C;

// deterministic, so every boot (and every capture) bakes the same backdrops
let seed = 1;
const rand = (): number => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

/** A fixed 0..1 for an integer: raggedness that comes out the same every boot, without using up rand(). */
const hash = (n: number): number => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** `a` towards `b` by `t`, channel by channel; past 1 it carries on beyond `b` (a lighter rim), clamped. */
const mix = (a: number, b: number, t: number): number => {
  let out = 0;
  for (const s of [16, 8, 0]) {
    const ca = (a >> s) & 255;
    out |= Math.min(255, Math.max(0, Math.round(ca + (((b >> s) & 255) - ca) * t))) << s;
  }
  return out;
};

// A seam between two flat colours: three rows of the lower colour at a
// quarter, a half and three quarters of their cells, 6px. On 4px cells it was
// one row at a half; on 2px that one row was a hairline of dots.
const SEAM = [0.25, 0.5, 0.75] as const;

/** The cells of `row` from x0 to x1 where `on` holds, a rect per run, in the current fill. */
function cellRuns(g: G, row: number, x0: number, x1: number, on: (x: number) => boolean): void {
  let start = -1;
  for (let x = x0; x <= x1; x += C) {
    if (x < x1 && on(x)) {
      if (start < 0) start = x;
    } else if (start >= 0) {
      g.fillRect(start, row, x - start, C);
      start = -1;
    }
  }
}

/**
 * Rows of `color` from `y` down, row k covering `cover[k]` of its cells
 * (0.25, 0.5 or 0.75). A quarter and three quarters shift by two cells row to
 * row and a half by one, so no column lines up.
 */
function dither(g: G, color: number, y: number, cover: readonly number[]): void {
  g.fillStyle(color, 1);
  cover.forEach((c, k) => {
    const row = y + k * C;
    const r = row / C;
    cellRuns(g, row, 0, W, (x) => {
      const i = x / C;
      return c >= 0.75 ? (i + 2 * (r & 1)) % 4 !== 2 : c >= 0.5 ? (i + r) % 2 === 0 : (i + 2 * (r & 1)) % 4 === 0;
    });
  });
}

/** Sky bands top to bottom, each seam dithered (SEAM). */
function sky(g: G, stops: ReadonlyArray<readonly [number, number]>, bottom = GROUND): void {
  stops.forEach(([y, color], i) => {
    const next = stops[i + 1];
    const y1 = next ? next[0] : bottom;
    g.fillStyle(color, 1);
    g.fillRect(0, y, W, y1 - y);
    if (next) dither(g, next[1], y1 - SEAM.length * C, SEAM);
  });
}

/**
 * A shaft of light from (top0..top1, yTop) to (bottom0..bottom1, yBottom),
 * a row of cells at a time. Drawn as a triangle it came out with smoothed,
 * off-grid edges.
 */
function beam(
  g: G,
  yTop: number,
  top0: number,
  top1: number,
  yBottom: number,
  bottom0: number,
  bottom1: number,
  color: number,
  alpha: number,
): void {
  g.fillStyle(color, alpha);
  for (let y = yTop; y < yBottom; y += C) {
    const t = (y + C / 2 - yTop) / (yBottom - yTop);
    const x0 = snap(top0 + (bottom0 - top0) * t);
    const x1 = snap(top1 + (bottom1 - top1) * t);
    if (x1 > x0) g.fillRect(x0, y, x1 - x0, C);
  }
}

/**
 * Columns from top(x) down to `bottom`, one colour per column, merged into
 * runs so a flat stretch is one rect.
 */
function columns(g: G, cell: (x: number) => readonly [number, number] | null, bottom = GROUND): void {
  let x0 = 0;
  let run = cell(0);
  const flush = (x1: number): void => {
    if (!run || run[0] >= bottom) return;
    g.fillStyle(run[1], 1);
    g.fillRect(x0, run[0], x1 - x0, bottom - run[0]);
  };
  for (let x = C; x <= W; x += C) {
    const c = x < W ? cell(x) : null;
    if (x === W || c?.[0] !== run?.[0] || c?.[1] !== run?.[1]) {
      flush(x);
      x0 = x;
      run = c;
    }
  }
}

type Peak = readonly [x: number, top: number, halfWidth: number];

/** The depth in cells of a gully whose middle is column `i` (3..6), or 0 for none: one column in twenty. */
const gully = (i: number): number => {
  const h = hash(i);
  return h < 0.05 ? 3 + Math.floor(h * 80) : 0;
};

/**
 * How many cells the snow line drops below its level at column `i`: a wander
 * of a cell or two, and here and there a tongue down a gully, two cells
 * shallower each column out from its middle. On 4px cells the edge could only
 * zigzag a cell up or down in a fixed beat; square-ended tongues read as
 * icing running down.
 */
const snowLine = (i: number): number => {
  const wander = Math.round(Math.sin(i * 0.61) * 1.4 + Math.sin(i * 1.73 + 2) * 0.9);
  let tongue = 0;
  for (let d = -2; d <= 2; d++) tongue = Math.max(tongue, gully(i + d) - Math.abs(d) * 2);
  return wander + tongue;
};

/**
 * A range of peaks, the lit (left) face and the shaded (right) face of each,
 * with a ragged cap of snow or ash on the summits if `cap` is given.
 */
function peaks(
  g: G,
  list: readonly Peak[],
  lit: number,
  shade: number,
  cap?: { lit: number; shade: number; depth: number },
  bottom = GROUND,
): void {
  const owner = (x: number): { top: number; peak: Peak } => {
    let best = { top: Number.POSITIVE_INFINITY, peak: list[0] };
    for (const peak of list) {
      const [px, py, hw] = peak;
      const top = py + (Math.abs(x + C / 2 - px) * (bottom - py)) / hw;
      if (top < best.top) best = { top, peak };
    }
    return best;
  };
  columns(
    g,
    (x) => {
      const { top, peak } = owner(x);
      return [snap(top), x + C / 2 < peak[0] ? lit : shade];
    },
    bottom,
  );
  if (!cap) return;
  for (let x = 0; x < W; x += C) {
    const { top, peak } = owner(x);
    const capBottom = snap(peak[1] + cap.depth) + snowLine(x / C) * C;
    const t = snap(top);
    if (t >= capBottom) continue;
    g.fillStyle(x + C / 2 < peak[0] ? cap.lit : cap.shade, 1);
    g.fillRect(x, t, C, capBottom - t);
  }
}

type Wave = readonly [amp: number, period: number, phase: number];

const wave = (x: number, waves: readonly Wave[]): number =>
  waves.reduce((sum, [amp, period, phase]) => sum + amp * Math.sin((x / period + phase) * Math.PI * 2), 0);

/** Rolling ground above `base`, with a rim of `rim` along its crest and a cell of half-rim under it. */
function hills(g: G, base: number, waves: readonly Wave[], color: number, rim?: number, bottom = GROUND): void {
  columns(g, (x) => [snap(base - wave(x, waves)), color], bottom);
  if (rim === undefined) return;
  const crest = (x: number): number => snap(base - wave(x, waves));
  g.fillStyle(rim, 1);
  for (let x = 0; x < W; x += C) g.fillRect(x, crest(x), C, C);
  g.fillStyle(mix(rim, color, 0.5), 1);
  for (let x = 0; x < W; x += C) g.fillRect(x, crest(x) + C, C, C);
}

/**
 * A stepped ellipse, one row of cells at a time. A row wider than both its
 * neighbours is cut back to the wider of them: rounding each row on its own
 * left the widest one a lone cell proud of the rest, a nub on each side of a
 * tree's crown.
 */
function blob(g: G, cx: number, cy: number, rx: number, ry: number, color: number, alpha = 1): void {
  const rows: number[] = [];
  for (let y = -ry; y < ry; y += C) {
    const t = (y + C / 2) / ry;
    rows.push(snap(rx * Math.sqrt(Math.max(0, 1 - t * t))));
  }
  g.fillStyle(color, alpha);
  rows.forEach((w, k) => {
    const half = Math.min(w, Math.max(rows[k - 1] ?? 0, rows[k + 1] ?? 0));
    if (half > 0) g.fillRect(snap(cx) - half, snap(cy - ry + k * C), half * 2, C);
  });
}

/**
 * A blob lit from the top left: the dark body, then a smaller lit one up and
 * left of centre, a cell of a lighter rim round its top and left.
 */
function litBlob(g: G, cx: number, cy: number, rx: number, ry: number, dark: number, light: number): void {
  blob(g, cx, cy, rx, ry, dark);
  const lx = cx - rx * 0.18;
  const ly = cy - ry * 0.2;
  blob(g, lx, ly, rx * 0.72, ry * 0.68, mix(dark, light, 1.5));
  blob(g, lx + C, ly + C, rx * 0.72, ry * 0.68, light);
}

/** Soft round light: rings of falling alpha. */
function glow(g: G, cx: number, cy: number, r: number, color: number, alpha: number): void {
  for (const [k, a] of [
    [1, 0.35],
    [0.7, 0.6],
    [0.45, 1],
  ] as const)
    blob(g, cx, cy, r * k, r * k, color, alpha * a);
}

/** A cloud: three lumps, a lit top and a shaded underside. */
function cloud(g: G, cx: number, cy: number, w: number, light: number, shade: number, alpha: number): void {
  blob(g, cx, cy + P * 2, w * 0.5, w * 0.12, shade, alpha);
  blob(g, cx - w * 0.22, cy, w * 0.22, w * 0.13, light, alpha);
  blob(g, cx + w * 0.05, cy - P * 2, w * 0.26, w * 0.17, light, alpha);
  blob(g, cx + w * 0.3, cy + P, w * 0.18, w * 0.1, light, alpha);
}

/** A round-crowned tree on its trunk. */
function tree(g: G, x: number, base: number, h: number, dark: number, light: number, trunk: number): void {
  g.fillStyle(trunk, 1);
  g.fillRect(snap(x) - P, snap(base - h * 0.4), P * 2, snap(h * 0.4));
  litBlob(g, x, base - h * 0.62, h * 0.34, h * 0.38, dark, light);
}

/** A pine: three tiers widening down, lit on the left, an optional snow line on each tier. */
function pine(g: G, x: number, base: number, h: number, dark: number, light: number, snow?: number): void {
  const top = snap(base - h);
  const maxHalf = h * 0.3;
  for (let y = top; y < base; y += C) {
    const t = (y - top) / h;
    const tier = (t * 3) % 1;
    const half = Math.max(C, snap(maxHalf * (0.3 + 0.7 * tier) * (0.45 + 0.55 * t)));
    const snowy = snow !== undefined && tier < 0.12;
    g.fillStyle(dark, 1);
    g.fillRect(snap(x) - half, y, half * 2, C);
    g.fillStyle(snowy ? snow : light, 1);
    g.fillRect(snap(x) - half, y, snowy ? half * 2 : Math.max(C, snap(half * 0.7)), C);
  }
}

// a tuft: a tall blade between two splayed short ones, from one root (10x6).
// A bare V of two blades read as a bird.
const TUFT = [
  [2, 0],
  [0, 1],
  [2, 1],
  [4, 1],
  [1, 2],
  [2, 2],
  [3, 2],
] as const;

/** Scattered tufts of grass on the ground, sparse and close to its colour. */
function tufts(g: G, color: number, count: number, y0: number, y1: number): void {
  g.fillStyle(color, 1);
  for (let i = 0; i < count; i++) {
    const x = snap(rand() * (W - P * 3));
    const y = snap(y0 + rand() * (y1 - y0));
    for (const [dx, dy] of TUFT) g.fillRect(x + dx * C, y + dy * C, C, C);
  }
}

/** The ground: a flat field, a lit lip along the horizon, a darker band further down. */
function ground(g: G, base: number, lip: number, low: number): void {
  g.fillStyle(base, 1);
  g.fillRect(0, GROUND, W, GAME_HEIGHT - GROUND);
  g.fillStyle(lip, 1);
  g.fillRect(0, GROUND, W, P * 3);
  g.fillStyle(low, 1);
  g.fillRect(0, 600, W, GAME_HEIGHT - 600);
  dither(g, low, 600 - SEAM.length * C, SEAM);
}

/**
 * A glowing seam in the ground: a cell-high line of `color` at `alpha` that
 * steps a cell `step` (up -1, down 1) into a tail `tail` long, in a faint
 * halo on the cells round it (not under it, where the two alphas would stack).
 */
function seam(g: G, x: number, y: number, w: number, tail: number, step: number, color: number, alpha: number): void {
  const lines = [
    [y, x, x + w],
    [y + step * C, x + w, x + w + tail],
  ] as const;
  const core = (row: number, cx: number): boolean => lines.some(([r, a, b]) => r === row && cx >= a && cx < b);
  const near = (row: number, cx: number): boolean => lines.some(([r, a, b]) => Math.abs(r - row) <= C && cx >= a - C && cx < b + C);
  const top = Math.min(y, y + step * C) - C;
  for (let row = top; row <= top + C * 3; row += C) {
    g.fillStyle(color, alpha * 0.4);
    cellRuns(g, row, x - C, x + w + tail + C, (cx) => near(row, cx) && !core(row, cx));
    g.fillStyle(color, alpha);
    cellRuns(g, row, x, x + w + tail, (cx) => core(row, cx));
  }
}

// ---------------------------------------------------------------- town

interface TownLook {
  sky: ReadonlyArray<readonly [number, number]>;
  sun: number;
  halo: number;
  cloud: number;
  cloudShade: number;
  cloudAlpha: number;
  farLit: number;
  farShade: number;
  capLit: number;
  capShade: number;
  hill: number;
  hillRim: number;
  treeDark: number;
  treeLight: number;
  trunk: number;
  pines: boolean;
  bushDark: number;
  bushLight: number;
  ground: number;
  lip: number;
  low: number;
  tuft: number;
}

const TOWN: TownLook = {
  sky: [
    [0, 0x3a6da5],
    [140, 0x477bb4],
    [240, 0x568cbf],
    [320, 0x6d9fcb],
    [380, 0x87b2d6],
  ],
  sun: 0xfff7c8,
  halo: 0xffe88a,
  cloud: 0xf2f7fc,
  cloudShade: 0xc9dcee,
  cloudAlpha: 0.55,
  farLit: 0x81a1be,
  farShade: 0x7191b0,
  capLit: 0xc8daeb,
  capShade: 0xaec4da,
  hill: 0x33634d,
  hillRim: 0x40735a,
  treeDark: 0x295641,
  treeLight: 0x35654f,
  trunk: 0x1b4a35,
  pines: false,
  bushDark: 0x143a2a,
  bushLight: 0x1c4a36,
  ground: 0x1f5c42,
  lip: 0x27684e,
  low: 0x1b533b,
  tuft: 0x266b4d,
};

const TOWN_AUTUMN: TownLook = {
  ...TOWN,
  sky: [
    [0, 0x3a6da5],
    [140, 0x477bb4],
    [240, 0x5a8cbc],
    [320, 0x789dc0],
    [380, 0xa2bbd0],
  ],
  farLit: 0x8ea1b2,
  farShade: 0x7f92a5,
  hill: 0x5b6737,
  hillRim: 0x6b7741,
  treeDark: 0x8a3f23,
  treeLight: 0xa85f33,
  trunk: 0x3c2a1c,
  bushDark: 0x5c2214,
  bushLight: 0x74301a,
  ground: 0x4a6028,
  lip: 0x56702e,
  low: 0x425624,
  tuft: 0x56692c,
};

const TOWN_WINTER: TownLook = {
  sky: [
    [0, 0x4f86c0],
    [140, 0x5a92ca],
    [240, 0x5f9ad6],
    [320, 0x7fb2e2],
    [380, 0x9fcaf0],
  ],
  sun: 0xffffff,
  halo: 0xf4f8ff,
  cloud: 0xf6f9fc,
  cloudShade: 0xd6e2ee,
  cloudAlpha: 0.7,
  farLit: 0xc9dbea,
  farShade: 0xb2c8dc,
  capLit: 0xf2f7fb,
  capShade: 0xdbe6f0,
  hill: 0xdce8f2,
  hillRim: 0xf2f7fb,
  treeDark: 0x4d6e7a,
  treeLight: 0x5f828e,
  trunk: 0x3a4f58,
  pines: true,
  bushDark: 0x9fb8c8,
  bushLight: 0xc8d9e5,
  ground: 0x175241,
  lip: 0x9fc9d8,
  low: 0x134a3a,
  tuft: 0x2a6656,
};

function town(g: G, look: TownLook): void {
  sky(g, look.sky);
  // the sun in the clear sky between the stat windows, under the note there:
  // at 240,176 its 120px halo glowed through the hero's window behind the MP
  // line, and a cloud that sat at 640,112 lay right behind the note
  glow(g, 640, 160, 38, look.halo, 0.45);
  blob(g, 640, 160, 22, 22, look.sun);
  cloud(g, 1160, 244, 150, look.cloud, look.cloudShade, look.cloudAlpha);
  cloud(g, 470, 236, 130, look.cloud, look.cloudShade, look.cloudAlpha * 0.8);
  // far: a blue range under snow
  peaks(
    g,
    [
      [120, 300, 260],
      [430, 262, 300],
      [700, 244, 280],
      [1010, 282, 300],
      [1240, 300, 240],
    ],
    look.farLit,
    look.farShade,
    { lit: look.capLit, shade: look.capShade, depth: 28 },
  );
  // mid: rolling hills, a line of trees along them
  const waves: Wave[] = [
    [18, 520, 0.1],
    [8, 230, 0.6],
  ];
  hills(g, 392, waves, look.hill, look.hillRim);
  for (const x of [40, 150, 470, 560, 640, 760, 1120, 1210]) {
    const crest = 392 - wave(x, waves);
    const h = 56 + ((x * 7) % 5) * 6;
    if (look.pines) pine(g, x, crest + 8, h, look.treeDark, look.treeLight, look.hillRim);
    else tree(g, x, crest + 8, h, look.treeDark, look.treeLight, look.trunk);
  }
  // near: the field, and bushes at the edges
  ground(g, look.ground, look.lip, look.low);
  tufts(g, look.tuft, 40, 452, 480);
  litBlob(g, 24, 432, 88, 52, look.bushDark, look.bushLight);
  litBlob(g, 1268, 428, 96, 60, look.bushDark, look.bushLight);
}

// ---------------------------------------------------------------- forest

interface ForestLook {
  sky: ReadonlyArray<readonly [number, number]>;
  shaft: number;
  shaftAlpha: number;
  far: number;
  farLight: number;
  mid: number;
  midLight: number;
  trunk: number;
  snow?: number;
  // winter: the low cloud the treetops vanish into (forest())
  fog?: number;
  frame: number;
  frameLight: number;
  ground: number;
  lip: number;
  low: number;
  tuft: number;
}

const FOREST: ForestLook = {
  sky: [
    [0, 0x102c20],
    [160, 0x183c2b],
    [260, 0x1e4834],
    [340, 0x25583e],
  ],
  shaft: 0xd9f2b8,
  shaftAlpha: 0.07,
  far: 0x24513b,
  farLight: 0x295841,
  mid: 0x153728,
  midLight: 0x1b4330,
  trunk: 0x0b2a1c,
  frame: 0x061a10,
  frameLight: 0x0b2a1b,
  ground: 0x104927,
  lip: 0x155a31,
  low: 0x0d3f21,
  tuft: 0x14552d,
};

// Autumn's wall is dusty tan under a plum dusk, not the crimson it was: that
// band measured chroma 0.20 (y 204..436 minus the fighters' spots, chroma =
// (max - min) / 255) against the fighters' 0.35, and its red sat on the
// hero's and the orc's reds. Now 0.14, between spring's 0.16 and winter's
// 0.14, with the hero's spot at 0.18 and the foe's at 0.16.
const FOREST_AUTUMN: ForestLook = {
  sky: [
    [0, 0x1e1219],
    [160, 0x301a22],
    [260, 0x44262c],
    [340, 0x5c3b2e],
  ],
  shaft: 0xf5dcb0,
  shaftAlpha: 0.07,
  far: 0x5e4232,
  farLight: 0x6c4d39,
  mid: 0x2b1420,
  midLight: 0x3c1e2a,
  trunk: 0x22091a,
  frame: 0x1a0812,
  frameLight: 0x2a0e1a,
  ground: 0x34421c,
  lip: 0x44542a,
  low: 0x2e3a18,
  tuft: 0x6a4a1e,
};

const FOREST_WINTER: ForestLook = {
  sky: [
    [0, 0x1e2c38],
    [160, 0x2e4650],
    [260, 0x3e5f66],
    [340, 0x5a7e88],
  ],
  shaft: 0xffffff,
  shaftAlpha: 0.09,
  far: 0x58767f,
  farLight: 0x617f88,
  mid: 0x26423f,
  midLight: 0x2e4c48,
  trunk: 0x1c3431,
  snow: 0x9db4bc,
  fog: 0x4a666f,
  frame: 0x141e22,
  frameLight: 0x22323a,
  ground: 0x173e44,
  lip: 0x8fb3c0,
  low: 0x14363b,
  tuft: 0x2a565c,
};

function forest(g: G, look: ForestLook): void {
  sky(g, look.sky);
  beam(g, 0, 300, 400, GROUND, 220, 220, look.shaft, look.shaftAlpha);
  beam(g, 0, 700, 820, GROUND, 640, 640, look.shaft, look.shaftAlpha);
  beam(g, 0, 1060, 1140, GROUND, 1010, 1010, look.shaft, look.shaftAlpha);
  // far: a wall of pines, then a haze of the sky's low band over it
  for (let x = -30; x < W + 60; x += 76) {
    const h = 190 + ((x * 13) % 7) * 14;
    pine(g, x, GROUND, h, look.far, look.farLight);
  }
  g.fillStyle(look.sky[look.sky.length - 1][1], 0.35);
  g.fillRect(0, 160, W, GROUND - 160);
  // mid: nearer trunks under their crowns, darker, a cell of bark lit on the left
  for (const [x, h] of [
    [130, 250],
    [440, 280],
    [600, 230],
    [780, 270],
    [1160, 260],
  ] as const) {
    g.fillStyle(look.trunk, 1);
    g.fillRect(snap(x) - P * 2, snap(GROUND - h * 0.5), P * 4, snap(h * 0.5));
    g.fillStyle(mix(look.trunk, look.midLight, 0.5), 1);
    g.fillRect(snap(x) - P * 2 + C, snap(GROUND - h * 0.5), C, snap(h * 0.5));
    pine(g, x, GROUND - h * 0.35, h * 0.75, look.mid, look.midLight, look.snow);
  }
  // Winter: the treetops vanish into low cloud. Down to just under the stat
  // windows (rows 24..199) the sky is drawn again over them, then a band of
  // fog, dithered at both edges, all of it below the windows. Winter's far
  // wall is paler than its sky and its pines are snowed to the tip, so the
  // treeline had shown through both windows (their 0.85 fill lets 15% by) as
  // a jagged band.
  if (look.fog !== undefined) {
    sky(g, look.sky.slice(0, 2), 204);
    g.fillStyle(look.fog, 1);
    g.fillRect(0, 204, W, P * 4);
    dither(g, look.fog, 200, [0.25, 0.75]);
    dither(g, look.fog, 220, [0.75, 0.5, 0.5, 0.25]);
  }
  // near: two great trunks framing the clearing, rounded by a half-lit cell
  // each side of the lit stripe, their roots flaring onto the ground
  for (const x of [0, W - 64]) {
    g.fillStyle(look.frame, 1);
    g.fillRect(x, 0, 64, GROUND + P * 2);
    g.fillStyle(mix(look.frame, look.frameLight, 0.5), 1);
    g.fillRect(x + P * 2 - C, 0, P * 3 + C * 2, GROUND);
    g.fillStyle(look.frameLight, 1);
    g.fillRect(x + P * 2, 0, P * 3, GROUND);
    g.fillStyle(look.frame, 1);
    const top = GROUND - P * 6;
    for (let y = top; y < GROUND + P * 2; y += C) {
      const t = (y + C - top) / (P * 8);
      const reach = snap(P * 4 * t * t);
      if (reach > 0) g.fillRect(x === 0 ? 64 : x - reach, y, reach, C);
    }
  }
  ground(g, look.ground, look.lip, look.low);
  tufts(g, look.tuft, 34, 452, 480);
}

// ---------------------------------------------------------------- cave

function cave(g: G): void {
  sky(g, [
    [0, 0x0e0c22],
    [200, 0x120f2a],
    [300, 0x161230],
    [380, 0x1a1636],
  ]);
  // far: the back wall's strata, a shade off the dark
  g.fillStyle(0x1c1838, 1);
  for (const [y, x0, x1] of [
    [236, 0, 520],
    [252, 700, 1280],
    [312, 120, 760],
    [328, 880, 1280],
    [372, 0, 400],
    [388, 560, 1100],
  ] as const)
    g.fillRect(x0, y, x1 - x0, P);
  // a far arch of rock, lit faintly from the torches
  peaks(
    g,
    [
      [300, 320, 200],
      [640, 300, 220],
      [980, 330, 200],
    ],
    0x231d44,
    0x1d183a,
  );
  // mid: pillars with a torch each, and a broken one between, its top ragged;
  // courses of stone below the stat windows, every other joint staggered
  for (const [x, top, broken] of [
    [150, 0, false],
    [1130, 0, false],
    [640, 344, true],
  ] as const) {
    for (let px = x - 36; px < x + 36; px += C) {
      const crown = broken ? C * Math.floor(hash(px / C) * 4) : 0;
      g.fillStyle(px < x - 36 + P * 3 ? 0x342b5e : px >= x + 24 ? 0x221c42 : 0x2a2350, 1);
      g.fillRect(px, top - crown, C, GROUND - top + crown);
    }
    g.fillStyle(0x221c42, 1);
    for (let y = 216, k = 0; y < GROUND; y += 36, k++) {
      if (y < top + P * 2) continue;
      g.fillRect(x - 36 + P * 3, y, 72 - P * 6, C);
      g.fillRect(x + (k % 2 ? -12 : 8), y + C, C, Math.min(34, GROUND - y - C));
    }
  }
  for (const x of [150, 1130]) {
    glow(g, x, 250, 130, 0xffa54d, 0.16);
    g.fillStyle(0x5a4632, 1);
    g.fillRect(x - P * 2, 252, P * 4, 40);
    blob(g, x, 240, 14, 16, 0xffb84d);
    blob(g, x, 244, 7, 8, 0xffe3a8);
  }
  // near: stalactites over the gap between the windows, stalagmites at the edges
  g.fillStyle(0x241d44, 1);
  for (const [x, w, h] of [
    [520, 40, 96],
    [600, 24, 56],
    [690, 48, 128],
    [760, 24, 64],
  ] as const)
    for (let y = 0; y < h; y += C) {
      const half = snap((w / 2) * (1 - y / h));
      if (half > 0) g.fillRect(x - half, y, half * 2, C);
    }
  ground(g, 0x3d3931, 0x4a453c, 0x35312a);
  for (const [x, h] of [
    [40, 120],
    [88, 64],
    [1236, 132],
    [1188, 72],
  ] as const)
    peaks(g, [[x, GROUND - h, 40]], 0x2c2652, 0x221d40, undefined, GROUND + P * 2);
  // cracks in the floor, a cell of the lip's colour along their lower edge
  for (const [x, y, w] of [
    [160, 460, 120],
    [740, 472, 160],
    [480, 452, 96],
    [1040, 464, 80],
  ] as const) {
    g.fillStyle(0x302c26, 1);
    g.fillRect(x, y, w, C);
    g.fillRect(x + w, y + C, P * 6, C);
    g.fillStyle(0x4a453c, 1);
    g.fillRect(x + C, y + C, w - C, C);
    g.fillRect(x + w + C, y + C * 2, P * 6 - C, C);
  }
}

// ---------------------------------------------------------------- abyss

function abyss(g: G): void {
  sky(g, [
    [0, 0x070615],
    [160, 0x0c091e],
    [260, 0x130e2a],
    [340, 0x1b1339],
    [400, 0x251848],
  ]);
  // light welling up from below the edge of the world
  beam(g, 160, 520, 520, GROUND, 440, 560, 0x8b5cf6, 0.05);
  beam(g, 200, 840, 840, GROUND, 780, 880, 0x8b5cf6, 0.05);
  // far: islands of rock adrift in the dark, their undersides trailing down,
  // a bevel of light along the top and the left, and a stone or two adrift
  // under each
  const ROCK = 0x221a3e;
  const LIT = 0x34285c;
  for (const [x, y, w] of [
    [190, 252, 140],
    [640, 150, 180],
    [1100, 262, 120],
    [470, 336, 80],
    [800, 330, 64],
  ] as const) {
    const left = snap(x - w / 2);
    g.fillStyle(ROCK, 1);
    g.fillRect(left, snap(y), snap(w), P * 4);
    let tip = snap(y) + P * 4;
    for (let k = 0; snap(w / 2 - P * 2 - k * P) > 0; k++) {
      const half = snap(w / 2 - P * 2 - k * P);
      g.fillRect(snap(x) - half, tip, half * 2, C);
      tip += C;
    }
    g.fillStyle(LIT, 1);
    g.fillRect(left, snap(y), snap(w * 0.7), C);
    g.fillRect(left, snap(y), C, P * 3);
    g.fillStyle(mix(ROCK, LIT, 0.5), 1);
    g.fillRect(left + C, snap(y) + C, snap(w * 0.7) - C * 2, C);
    g.fillRect(left + C, snap(y) + C, C, P * 3 - C * 2);
    for (const [dx, dy] of [
      [0.12, P * 2],
      [-0.18, P * 5],
    ] as const) {
      g.fillStyle(ROCK, 1);
      g.fillRect(snap(x + w * dx), tip + dy, P, P);
      g.fillStyle(LIT, 1);
      g.fillRect(snap(x + w * dx), tip + dy, C, C);
    }
  }
  // near: the ledge the fight stands on, cracked with violet light
  ground(g, 0x241f38, 0x332c4e, 0x1e1a30);
  for (const [x, y, w] of [
    [120, 464, 160],
    [700, 476, 200],
    [420, 452, 120],
    [1020, 468, 120],
  ] as const)
    seam(g, x, y, w, P * 5, -1, 0x6d4fc8, 0.55);
  for (const [x, h] of [
    [32, 140],
    [1248, 156],
  ] as const)
    peaks(g, [[x, GROUND - h, 56]], 0x2a2048, 0x1e1736, undefined, GROUND + P * 2);
}

// ---------------------------------------------------------------- snow field

function snow(g: G): void {
  sky(g, [
    [0, 0x6e9fc4],
    [140, 0x7aa9cc],
    [220, 0x8fb9d8],
    [300, 0xa4c8e2],
    [360, 0xb8d8ec],
  ]);
  // between the stat windows as in town(), left of the big peak's white
  // summit (640,160), which would swallow a white sun
  glow(g, 560, 160, 34, 0xffffff, 0.4);
  blob(g, 560, 160, 20, 20, 0xffffff);
  // far: the big peaks, snow to their shoulders
  peaks(
    g,
    [
      [240, 240, 260],
      [640, 160, 380],
      [1160, 260, 300],
    ],
    0xa9c6dd,
    0x9dbcd5,
    { lit: 0xe6f1f9, shade: 0xd2e3f0, depth: 64 },
  );
  // mid: a snowed ridge with dark pines along it
  const waves: Wave[] = [
    [14, 480, 0.3],
    [6, 190, 0.1],
  ];
  hills(g, 400, waves, 0xd6e6f1, 0xf2f8fc);
  for (const x of [60, 130, 470, 540, 620, 1140, 1230]) {
    pine(g, x, 404 - wave(x, waves), 64 + ((x * 3) % 4) * 8, 0x4f7480, 0x5d828d, 0xe6f0f6);
  }
  // near: icy-teal ground, frost patches, drifts at the edges
  ground(g, 0x175241, 0x9fc9d8, 0x134a3a);
  for (const [x, y, rx] of [
    [300, 464, 120],
    [860, 472, 150],
  ] as const)
    blob(g, x, y, rx, 12, 0xd8ecf5, 0.2);
  litBlob(g, 20, 436, 96, 44, 0xb4cad8, 0xe2edf4);
  litBlob(g, 1264, 432, 104, 52, 0xb4cad8, 0xe2edf4);
}

// ---------------------------------------------------------------- volcano

function volcano(g: G): void {
  sky(g, [
    [0, 0x1c0a0a],
    [140, 0x2a0d0b],
    [220, 0x3b120d],
    [300, 0x4c1810],
    [370, 0x5c1e12],
  ]);
  // far: the cone, its crater lighting the smoke above it
  glow(g, 640, 200, 220, 0xf97316, 0.14);
  for (const [x, y, r] of [
    [620, 150, 44],
    [668, 112, 56],
    [612, 72, 64],
    [690, 28, 72],
  ] as const)
    blob(g, x, y, r, r * 0.7, 0x3a2626, 0.55);
  peaks(
    g,
    [
      [600, 196, 380],
      [680, 196, 380],
    ],
    0x3a2222,
    0x2c1a1a,
  );
  g.fillStyle(0x2c1a1a, 1);
  g.fillRect(600, 196, 80, P * 2);
  // the crater lip, and lava down the near face, dulled so it stays behind,
  // narrowing as it goes (it stepped from 12px to 8px halfway, a notch at 2px)
  g.fillStyle(0xc2410c, 1);
  g.fillRect(588, 192, 104, P * 2);
  g.fillStyle(0xf59e57, 1);
  g.fillRect(608, 192, 64, C);
  g.fillStyle(0xa8401a, 1);
  for (const [x0, x1] of [
    [616, 520],
    [668, 740],
  ] as const)
    for (let y = 200; y < GROUND; y += C) {
      const t = (y - 200) / (GROUND - 200);
      g.fillRect(snap(x0 + (x1 - x0) * t), y, snap(P * (3 - t)), C);
    }
  // mid: jagged dark ridges, a rim of glow along their crests
  peaks(
    g,
    [
      [140, 312, 200],
      [330, 352, 160],
      [960, 340, 180],
      [1160, 300, 220],
    ],
    0x241414,
    0x1a0e0e,
  );
  g.fillStyle(0x6b2a14, 1);
  for (const [px, py] of [
    [140, 312],
    [1160, 300],
  ] as const)
    for (let k = 0; k < 12; k++) g.fillRect(snap(px - P * (k + 1)), snap(py + (k + 1) * 6), P, C);
  // near: cooled rock underfoot, glowing seams, basalt at the edges
  ground(g, 0x2c2527, 0x433a3d, 0x262022);
  for (const [x, y, w] of [
    [140, 464, 220],
    [760, 476, 260],
    [460, 452, 140],
  ] as const)
    seam(g, x, y, w, P * 4, 1, 0xc2410c, 0.55);
  for (const [x, h] of [
    [36, 128],
    [1244, 140],
  ] as const)
    peaks(g, [[x, GROUND - h, 52]], 0x221a1c, 0x181214, undefined, GROUND + P * 2);
}

// ---------------------------------------------------------------- title

/** A floating island: a grass cap, a rock underside lit on the left, roots trailing. */
function island(g: G, x: number, y: number, w: number): void {
  blob(g, x, y + 26, w * 0.75, 20, 0x7ef9ff, 0.06);
  const half = w / 2;
  for (let k = 0; snap(half - k * C * 1.6) > 0; k++) {
    const hw = snap(half - k * C * 1.6);
    g.fillStyle(0x241a3e, 1);
    g.fillRect(snap(x) - hw, snap(y) + k * C, hw * 2, C);
    g.fillStyle(0x3a2a55, 1);
    g.fillRect(snap(x) - hw, snap(y) + k * C, Math.max(C, snap(hw * 0.8)), C);
  }
  // roots a cell wide, kinking a cell aside every 8px
  g.fillStyle(0x1a1230, 1);
  for (const [dx, len] of [
    [-0.22, 24],
    [0.1, 16],
    [0.26, 12],
  ] as const)
    for (let d = 0; d < len; d += C) g.fillRect(snap(x + w * dx) + (Math.floor(d / 8) % 2) * C, snap(y + 12) + d, C, C);
  blob(g, x, y, half, 14, 0x1f6b46);
  blob(g, x - P, y - P, half * 0.84, 8, 0x2a8a5a);
}

/** A crystal: a lit left face, a shaded right one. */
function crystal(g: G, x: number, base: number, h: number, w: number): void {
  for (let y = 0; y < h; y += C) {
    const half = Math.max(C, snap((w / 2) * (y / h)));
    g.fillStyle(0x3ab8cc, 1);
    g.fillRect(snap(x) - half, snap(base - h + y), half * 2, C);
    g.fillStyle(0x8ff3fb, 1);
    g.fillRect(snap(x) - half, snap(base - h + y), half, C);
  }
}

/**
 * A twinkle: a cell at (x, y) and arms of `arm` cells each way, fading out
 * towards their tips. On 4px cells the arms were solid bars a cell thick.
 */
function twinkle(g: G, x: number, y: number, arm: number, color: number, alpha: number): void {
  g.fillStyle(color, alpha);
  g.fillRect(x, y, C, C);
  for (let k = 1; k <= arm; k++) {
    g.fillStyle(color, alpha * (1 - (k / (arm + 1)) ** 2));
    for (const [dx, dy] of [
      [-k, 0],
      [k, 0],
      [0, -k],
      [0, k],
    ])
      g.fillRect(x + dx * C, y + dy * C, C, C);
  }
}

function title(g: G): void {
  const HORIZON = 600;
  sky(
    g,
    [
      [0, 0x120b33],
      [120, 0x170e3d],
      [220, 0x1d1247],
      [310, 0x2c1a63],
      [390, 0x45247c],
      [460, 0x6c3091],
      [520, 0x94489b],
    ],
    HORIZON,
  );
  // faint cloud banks, one cool, two warm
  blob(g, 260, 190, 210, 28, 0xc86bd9, 0.1);
  blob(g, 860, 110, 180, 24, 0xc86bd9, 0.1);
  blob(g, 580, 250, 240, 26, 0x64d9e8, 0.08);
  // stars, the brightest a cell bigger than the rest, a few twinkles and one falling
  for (let i = 0; i < 90; i++) {
    const alpha = 0.15 + rand() * 0.7;
    const x = snap(rand() * W);
    const y = snap(rand() * 420);
    // clear of the version tag (x 1040..1264, y 12..28, a glyph further left
    // for each hash digit past 7) with a glyph's room round it; a skipped star
    // still takes its three numbers, so the rest stay where they were
    if (x > 1000 && y < 44) continue;
    g.fillStyle(0xffffff, alpha);
    const size = alpha > 0.7 ? C * 2 : C;
    g.fillRect(x, y, size, size);
  }
  for (const [x, y, r] of [
    [520, 60, 12],
    [1180, 72, 12],
    [700, 160, 8],
    [1060, 220, 8],
  ] as const)
    twinkle(g, x, y, r / C - 1, 0xffffff, 0.85);
  for (let k = 0; k < 10; k++) {
    g.fillStyle(0xffffff, 0.9 - k * 0.08);
    g.fillRect(820 - k * P * 2, 84 + k * C, P * 2, C);
  }
  // the moon, its halo in rings
  glow(g, 150, 100, 80, 0xfff3c4, 0.3);
  blob(g, 150, 100, 40, 40, 0xfdf0c2);
  blob(g, 158, 92, 30, 30, 0xfff8dc);
  blob(g, 136, 88, 8, 8, 0xe8d79a);
  blob(g, 164, 112, 6, 6, 0xe8d79a);
  blob(g, 144, 120, 4, 4, 0xe8d79a);
  // far: a range under the dusk, its sides lit faintly on the left
  peaks(
    g,
    [
      [200, 400, 330],
      [700, 370, 360],
      [1160, 430, 280],
    ],
    0x2a1e56,
    0x221848,
    { lit: 0x3d2b70, shade: 0x2c205a, depth: 18 },
    HORIZON,
  );
  // mid: a nearer ridge, darker
  peaks(
    g,
    [
      [320, 470, 390],
      [940, 452, 390],
    ],
    0x1e1644,
    0x18113a,
    undefined,
    HORIZON,
  );
  // the floating islands: a pine on the big one, a crystal on the small, a fall of water
  island(g, 230, 320, 200);
  pine(g, 228, 314, 56, 0x0f3d24, 0x17502f);
  // the fall off the big island's lip lands on the small one: two streaks of
  // spray in it, one wavering a cell side to side, one broken now and then
  for (let y = 332; y < 448; y += C) {
    const j = y / C;
    g.fillStyle(0x6fc8dc, 0.45);
    g.fillRect(300, y, P * 3, C);
    g.fillStyle(0xd9fbff, 0.55);
    g.fillRect(300 + C * (1 + ((j >> 1) & 1)), y, C, C);
    if (j % 7 !== 3) g.fillRect(300 + C * 4, y, C, C);
  }
  island(g, 330, 452, 100);
  blob(g, 308, 446, 20, 6, 0xd9fbff, 0.3);
  crystal(g, 330, 440, 36, 20);
  // the castle on the right, lit windows, the orb on its spire
  const STONE = 0x191238;
  const RIM = 0x251b4e;
  const ROOF = 0x3d1d5c;
  blob(g, 1020, 616, 230, 40, 0x141033);
  g.fillStyle(STONE, 1);
  g.fillRect(940, 500, 160, 100);
  g.fillRect(908, 520, 40, 80);
  g.fillRect(1092, 520, 40, 80);
  g.fillRect(984, 430, 72, 80);
  for (let i = 0; i < 5; i++) g.fillRect(944 + i * 32, 488, 16, 12);
  g.fillStyle(RIM, 1);
  for (const [x, y, h] of [
    [940, 500, 100],
    [908, 520, 80],
    [984, 430, 80],
    [1092, 520, 80],
  ] as const)
    g.fillRect(x, y, C, h);
  for (const [cx, base, half, h] of [
    [928, 520, 28, 36],
    [1112, 520, 28, 36],
    [1020, 430, 44, 60],
  ] as const)
    for (let y = 0; y < h; y += C) {
      const hw = Math.max(C, snap((half * y) / h));
      g.fillStyle(ROOF, 1);
      g.fillRect(cx - hw, base - h + y, hw * 2, C);
      g.fillStyle(0x52296f, 1);
      g.fillRect(cx - hw, base - h + y, Math.max(C, snap(hw * 0.6)), C);
    }
  glow(g, 1020, 360, 28, 0x7ef9ff, 0.6);
  blob(g, 1020, 360, 8, 8, 0xd9fbff);
  // windows with arched tops, the door too
  for (const [x, y] of [
    [964, 528],
    [1000, 528],
    [1036, 528],
    [964, 564],
    [1036, 564],
    [920, 544],
    [1108, 544],
    [1012, 452],
    [1012, 484],
  ] as const) {
    g.fillStyle(0xffd166, 0.25);
    g.fillRect(x - P, y - P, 16, 20);
    g.fillStyle(0xffd166, 1);
    g.fillRect(x, y + C, 8, 12 - C);
    g.fillRect(x + C, y, 8 - C * 2, C);
  }
  blob(g, 1020, 584, 20, 12, 0x0b0820);
  g.fillStyle(0x0b0820, 1);
  g.fillRect(1000, 584, 40, 16);
  // magic drifting up from the meadow
  for (const [x, y, c, a] of [
    [560, 500, 0x7ef9ff, 0.5],
    [660, 460, 0xffd166, 0.4],
    [760, 520, 0x7ef9ff, 0.35],
    [470, 540, 0xd9fbff, 0.3],
    [1140, 470, 0x7ef9ff, 0.45],
    [360, 484, 0xffd166, 0.35],
  ] as const)
    twinkle(g, x, y, 2, c, a);
  // near: the meadow, pines at its edges, crystals in the corner, fireflies
  g.fillStyle(0x12331f, 1);
  g.fillRect(0, HORIZON, W, GAME_HEIGHT - HORIZON);
  g.fillStyle(0x1a4a2c, 1);
  g.fillRect(0, HORIZON, W, P);
  g.fillStyle(0x0c2718, 1);
  g.fillRect(0, 668, W, GAME_HEIGHT - 668);
  dither(g, 0x0c2718, 668 - SEAM.length * C, SEAM);
  tufts(g, 0x1c4a2e, 30, 608, 660);
  for (const [x, base, h] of [
    [80, 644, 96],
    [150, 664, 128],
    [230, 648, 84],
    [310, 672, 104],
    [1210, 660, 100],
    [1266, 644, 80],
  ] as const)
    pine(g, x, base, h, 0x081b12, 0x0f2a1c);
  blob(g, 110, 700, 100, 24, 0x7ef9ff, 0.12);
  crystal(g, 90, 712, 72, 56);
  crystal(g, 136, 712, 48, 44);
  for (let i = 0; i < 26; i++) {
    const x = snap(rand() * W);
    const y = snap(560 + rand() * 130);
    // the corner the version tag had before it moved up; dropping this would
    // reshuffle every firefly after the one it skips
    if (x > 1140 && y > 672) continue;
    blob(g, x, y, 8, 8, 0xffe066, 0.12);
    // a bright cell in a ring of four a little dimmer: one cell alone read as
    // a speck inside its glow, a ring rather than a light
    const a = 0.3 + rand() * 0.5;
    g.fillStyle(0xffe066, a * 0.7);
    g.fillRect(x - C, y, C * 3, C);
    g.fillRect(x, y - C, C, C);
    g.fillRect(x, y + C, C, C);
    g.fillStyle(0xffe066, a);
    g.fillRect(x, y, C, C);
  }
}

/** Bakes the title screen's backdrop, "title-bg". */
export function makeTitleBg(scene: Phaser.Scene): void {
  seed = 7;
  const g = scene.add.graphics();
  title(g);
  g.generateTexture("title-bg", W, GAME_HEIGHT);
  g.destroy();
}

/** Bakes every battle backdrop; see the notes at the top. */
export function makeBattleBgs(scene: Phaser.Scene): void {
  seed = 1;
  const g = scene.add.graphics();
  const bake = (key: string, draw: (g: G) => void): void => {
    draw(g);
    g.generateTexture(key, W, GAME_HEIGHT);
    g.clear();
  };
  bake("battle-bg-town", (g) => town(g, TOWN));
  bake("battle-bg-town-autumn", (g) => town(g, TOWN_AUTUMN));
  bake("battle-bg-town-winter", (g) => town(g, TOWN_WINTER));
  bake("battle-bg-forest", (g) => forest(g, FOREST));
  bake("battle-bg-forest-autumn", (g) => forest(g, FOREST_AUTUMN));
  bake("battle-bg-forest-winter", (g) => forest(g, FOREST_WINTER));
  bake("battle-bg-dungeon", cave);
  bake("battle-bg-abyss", abyss);
  bake("battle-bg-snow", snow);
  bake("battle-bg-volcano", volcano);
  g.destroy();
}
