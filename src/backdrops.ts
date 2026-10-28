import type Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, PIXEL } from "./config";

// The title screen's backdrop (makeTitleBg, at the end) and the battle
// backdrops, one per field a fight starts in, baked once at boot
// (BootScene) as 1280x720 textures: "battle-bg-<region>", and for the town and
// the forest one per look the season gives their maps ("-autumn", "-winter";
// art/tilesets.ts battleBgKey picks). Each is drawn in three depths on 4px
// cells, a step coarser than the fighters' 2px art, so it reads as further
// away:
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

const P = PIXEL;
const GROUND = 440;
const W = GAME_WIDTH;

type G = Phaser.GameObjects.Graphics;

const snap = (v: number): number => Math.round(v / P) * P;

// deterministic, so every boot (and every capture) bakes the same backdrops
let seed = 1;
const rand = (): number => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

/** Sky bands top to bottom, each seam dithered on one row of cells. */
function sky(g: G, stops: ReadonlyArray<readonly [number, number]>, bottom = GROUND): void {
  stops.forEach(([y, color], i) => {
    const next = stops[i + 1];
    const y1 = next ? next[0] : bottom;
    g.fillStyle(color, 1);
    g.fillRect(0, y, W, y1 - y);
    if (!next) return;
    g.fillStyle(next[1], 1);
    for (let x = 0; x < W; x += P * 2) g.fillRect(x, y1 - P, P, P);
  });
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
  for (let x = P; x <= W; x += P) {
    const c = x < W ? cell(x) : null;
    if (x === W || c?.[0] !== run?.[0] || c?.[1] !== run?.[1]) {
      flush(x);
      x0 = x;
      run = c;
    }
  }
}

type Peak = readonly [x: number, top: number, halfWidth: number];

/**
 * A range of peaks, the lit (left) face and the shaded (right) face of each,
 * with a jagged cap of snow or ash on the summits if `cap` is given.
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
      const top = py + (Math.abs(x + P / 2 - px) * (bottom - py)) / hw;
      if (top < best.top) best = { top, peak };
    }
    return best;
  };
  columns(
    g,
    (x) => {
      const { top, peak } = owner(x);
      return [snap(top), x + P / 2 < peak[0] ? lit : shade];
    },
    bottom,
  );
  if (!cap) return;
  for (let x = 0; x < W; x += P) {
    const { top, peak } = owner(x);
    const capBottom = snap(peak[1] + cap.depth) + ((x / P) % 3 === 1 ? P : 0) + ((x / P) % 5 === 0 ? -P : 0);
    const t = snap(top);
    if (t >= capBottom) continue;
    g.fillStyle(x + P / 2 < peak[0] ? cap.lit : cap.shade, 1);
    g.fillRect(x, t, P, capBottom - t);
  }
}

type Wave = readonly [amp: number, period: number, phase: number];

const wave = (x: number, waves: readonly Wave[]): number =>
  waves.reduce((sum, [amp, period, phase]) => sum + amp * Math.sin((x / period + phase) * Math.PI * 2), 0);

/** Rolling ground above `base`, with a one-cell rim of `rim` along its crest. */
function hills(g: G, base: number, waves: readonly Wave[], color: number, rim?: number, bottom = GROUND): void {
  columns(g, (x) => [snap(base - wave(x, waves)), color], bottom);
  if (rim === undefined) return;
  g.fillStyle(rim, 1);
  for (let x = 0; x < W; x += P) g.fillRect(x, snap(base - wave(x, waves)), P, P);
}

/** A stepped ellipse, one row of cells at a time. */
function blob(g: G, cx: number, cy: number, rx: number, ry: number, color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  for (let y = -ry; y < ry; y += P) {
    const t = (y + P / 2) / ry;
    const half = snap(rx * Math.sqrt(Math.max(0, 1 - t * t)));
    if (half > 0) g.fillRect(snap(cx) - half, snap(cy + y), half * 2, P);
  }
}

/** A blob lit from the top left: the dark body, then a smaller lit one up and left of centre. */
function litBlob(g: G, cx: number, cy: number, rx: number, ry: number, dark: number, light: number): void {
  blob(g, cx, cy, rx, ry, dark);
  blob(g, cx - rx * 0.18, cy - ry * 0.2, rx * 0.72, ry * 0.68, light);
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
  for (let y = top; y < base; y += P) {
    const t = (y - top) / h;
    const tier = (t * 3) % 1;
    const half = Math.max(P, snap(maxHalf * (0.3 + 0.7 * tier) * (0.45 + 0.55 * t)));
    g.fillStyle(dark, 1);
    g.fillRect(snap(x) - half, y, half * 2, P);
    g.fillStyle(snow !== undefined && tier < 0.12 ? snow : light, 1);
    g.fillRect(snap(x) - half, y, snow !== undefined && tier < 0.12 ? half * 2 : Math.max(P, snap(half * 0.7)), P);
  }
}

/** Scattered pairs of grass blades (or pebbles) on the ground, sparse and close to its colour. */
function tufts(g: G, color: number, count: number, y0: number, y1: number): void {
  g.fillStyle(color, 1);
  for (let i = 0; i < count; i++) {
    const x = snap(rand() * (W - P * 3));
    const y = snap(y0 + rand() * (y1 - y0));
    g.fillRect(x, y, P, P);
    g.fillRect(x + P * 2, y, P, P);
    g.fillRect(x + P, y + P, P, P);
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
  g.fillStyle(low, 1);
  for (let x = 0; x < W; x += P * 2) g.fillRect(x, 600 - P, P, P);
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
  g.fillStyle(look.shaft, look.shaftAlpha);
  g.fillTriangle(300, 0, 400, 0, 220, GROUND);
  g.fillTriangle(700, 0, 820, 0, 640, GROUND);
  g.fillTriangle(1060, 0, 1140, 0, 1010, GROUND);
  // far: a wall of pines, then a haze of the sky's low band over it
  for (let x = -30; x < W + 60; x += 76) {
    const h = 190 + ((x * 13) % 7) * 14;
    pine(g, x, GROUND, h, look.far, look.farLight);
  }
  g.fillStyle(look.sky[look.sky.length - 1][1], 0.35);
  g.fillRect(0, 160, W, GROUND - 160);
  // mid: nearer trunks under their crowns, darker
  for (const [x, h] of [
    [130, 250],
    [440, 280],
    [600, 230],
    [780, 270],
    [1160, 260],
  ] as const) {
    g.fillStyle(look.trunk, 1);
    g.fillRect(snap(x) - P * 2, snap(GROUND - h * 0.5), P * 4, snap(h * 0.5));
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
    for (const y of [200, 220, 224]) for (let x = ((y / P) % 2) * P; x < W; x += P * 2) g.fillRect(x, y, P, P);
  }
  // near: two great trunks framing the clearing
  for (const x of [0, W - 64]) {
    g.fillStyle(look.frame, 1);
    g.fillRect(x, 0, 64, GROUND + P * 2);
    g.fillStyle(look.frameLight, 1);
    g.fillRect(x + P * 2, 0, P * 3, GROUND);
    g.fillStyle(look.frame, 1);
    g.fillRect(x === 0 ? 64 : x - P * 4, GROUND - P * 6, P * 4, P * 8);
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
  // mid: pillars with a torch each, and a broken one between
  for (const [x, top] of [
    [150, 0],
    [1130, 0],
    [640, 344],
  ] as const) {
    g.fillStyle(0x2a2350, 1);
    g.fillRect(x - 36, top, 72, GROUND - top);
    g.fillStyle(0x342b5e, 1);
    g.fillRect(x - 36, top, P * 3, GROUND - top);
    g.fillStyle(0x221c42, 1);
    g.fillRect(x + 24, top, P * 3, GROUND - top);
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
    for (let y = 0; y < h; y += P) {
      const half = snap((w / 2) * (1 - y / h));
      if (half > 0) g.fillRect(x - half, y, half * 2, P);
    }
  ground(g, 0x3d3931, 0x4a453c, 0x35312a);
  for (const [x, h] of [
    [40, 120],
    [88, 64],
    [1236, 132],
    [1188, 72],
  ] as const)
    peaks(g, [[x, GROUND - h, 40]], 0x2c2652, 0x221d40, undefined, GROUND + P * 2);
  g.fillStyle(0x302c26, 1);
  for (const [x, y, w] of [
    [160, 460, 120],
    [740, 472, 160],
    [480, 452, 96],
    [1040, 464, 80],
  ] as const) {
    g.fillRect(x, y, w, P);
    g.fillRect(x + w, y + P, P * 6, P);
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
  g.fillStyle(0x8b5cf6, 0.05);
  g.fillTriangle(440, GROUND, 520, 160, 560, GROUND);
  g.fillTriangle(780, GROUND, 840, 200, 880, GROUND);
  // far: islands of rock adrift in the dark, their undersides trailing down
  for (const [x, y, w] of [
    [190, 252, 140],
    [640, 150, 180],
    [1100, 262, 120],
    [470, 336, 80],
    [800, 330, 64],
  ] as const) {
    g.fillStyle(0x221a3e, 1);
    g.fillRect(snap(x - w / 2), snap(y), snap(w), P * 4);
    for (let k = 1; k * P * 2 < w / 2; k++) {
      const half = snap(w / 2 - k * P * 2);
      g.fillRect(snap(x) - half, snap(y) + P * (3 + k), half * 2, P);
    }
    g.fillStyle(0x34285c, 1);
    g.fillRect(snap(x - w / 2), snap(y), snap(w * 0.7), P);
    g.fillRect(snap(x - w / 2), snap(y), P, P * 3);
  }
  // near: the ledge the fight stands on, cracked with violet light
  ground(g, 0x241f38, 0x332c4e, 0x1e1a30);
  g.fillStyle(0x6d4fc8, 0.55);
  for (const [x, y, w] of [
    [120, 464, 160],
    [700, 476, 200],
    [420, 452, 120],
    [1020, 468, 120],
  ] as const) {
    g.fillRect(x, y, w, P);
    g.fillRect(x + w, y - P, P * 5, P);
  }
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
  // the crater lip, and lava down the near face, dulled so it stays behind
  g.fillStyle(0xc2410c, 1);
  g.fillRect(588, 192, 104, P * 2);
  g.fillStyle(0xf59e57, 1);
  g.fillRect(608, 192, 64, P);
  g.fillStyle(0xa8401a, 1);
  for (const [x0, x1] of [
    [616, 520],
    [668, 740],
  ] as const)
    for (let y = 200; y < GROUND; y += P) {
      const t = (y - 200) / (GROUND - 200);
      g.fillRect(snap(x0 + (x1 - x0) * t), y, P * (t < 0.5 ? 3 : 2), P);
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
    for (let k = 0; k < 6; k++) g.fillRect(snap(px - P * (k + 1) * 2), snap(py + P * (k + 1) * 3), P * 2, P);
  // near: cooled rock underfoot, glowing seams, basalt at the edges
  ground(g, 0x2c2527, 0x433a3d, 0x262022);
  g.fillStyle(0xc2410c, 0.55);
  for (const [x, y, w] of [
    [140, 464, 220],
    [760, 476, 260],
    [460, 452, 140],
  ] as const) {
    g.fillRect(x, y, w, P);
    g.fillRect(x + w, y + P, P * 4, P);
  }
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
  for (let k = 0; snap(half - k * P * 1.6) > 0; k++) {
    const hw = snap(half - k * P * 1.6);
    g.fillStyle(0x241a3e, 1);
    g.fillRect(snap(x) - hw, snap(y) + k * P, hw * 2, P);
    g.fillStyle(0x3a2a55, 1);
    g.fillRect(snap(x) - hw, snap(y) + k * P, Math.max(P, snap(hw * 0.8)), P);
  }
  g.fillStyle(0x1a1230, 1);
  for (const [dx, len] of [
    [-0.22, 24],
    [0.1, 16],
    [0.26, 12],
  ] as const)
    g.fillRect(snap(x + w * dx), snap(y + 12), P, len);
  blob(g, x, y, half, 14, 0x1f6b46);
  blob(g, x - P, y - P, half * 0.84, 8, 0x2a8a5a);
}

/** A crystal: a lit left face, a shaded right one. */
function crystal(g: G, x: number, base: number, h: number, w: number): void {
  for (let y = 0; y < h; y += P) {
    const half = Math.max(P / 2, snap((w / 2) * (y / h)));
    g.fillStyle(0x3ab8cc, 1);
    g.fillRect(snap(x) - half, snap(base - h + y), half * 2, P);
    g.fillStyle(0x8ff3fb, 1);
    g.fillRect(snap(x) - half, snap(base - h + y), half, P);
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
  // stars, a few bright crosses and one falling
  for (let i = 0; i < 90; i++) {
    const alpha = 0.15 + rand() * 0.7;
    const x = snap(rand() * W);
    const y = snap(rand() * 420);
    // clear of the version tag (x 1040..1264, y 12..28, a glyph further left
    // for each hash digit past 7) with a glyph's room round it; a skipped star
    // still takes its three numbers, so the rest stay where they were
    if (x > 1000 && y < 44) continue;
    g.fillStyle(0xffffff, alpha);
    g.fillRect(x, y, P, P);
  }
  for (const [x, y, r] of [
    [520, 60, 12],
    [1180, 72, 12],
    [700, 160, 8],
    [1060, 220, 8],
  ] as const) {
    g.fillStyle(0xffffff, 0.85);
    g.fillRect(x - r, y - P / 2, r * 2, P);
    g.fillRect(x - P / 2, y - r, P, r * 2);
  }
  for (let k = 0; k < 5; k++) {
    g.fillStyle(0xffffff, 0.9 - k * 0.18);
    g.fillRect(820 - k * 16, 84 + k * 4, P * 2, P);
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
  // the fall off the big island's lip lands on the small one
  for (let y = 332; y < 448; y += P) {
    g.fillStyle(0x6fc8dc, 0.45);
    g.fillRect(300, y, P * 3, P);
    g.fillStyle(0xd9fbff, 0.55);
    g.fillRect(304 + ((y / P) % 2) * P, y, P, P);
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
    g.fillRect(x, y, P, h);
  for (const [cx, base, half, h] of [
    [928, 520, 28, 36],
    [1112, 520, 28, 36],
    [1020, 430, 44, 60],
  ] as const)
    for (let y = 0; y < h; y += P) {
      const hw = Math.max(P / 2, snap((half * y) / h));
      g.fillStyle(ROOF, 1);
      g.fillRect(cx - hw, base - h + y, hw * 2, P);
      g.fillStyle(0x52296f, 1);
      g.fillRect(cx - hw, base - h + y, Math.max(P, snap(hw * 0.6)), P);
    }
  glow(g, 1020, 360, 28, 0x7ef9ff, 0.6);
  blob(g, 1020, 360, 8, 8, 0xd9fbff);
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
    g.fillRect(x, y, 8, 12);
  }
  g.fillStyle(0x0b0820, 1);
  g.fillRect(1000, 572, 40, 28);
  // magic drifting up from the meadow
  for (const [x, y, c, a] of [
    [560, 500, 0x7ef9ff, 0.5],
    [660, 460, 0xffd166, 0.4],
    [760, 520, 0x7ef9ff, 0.35],
    [470, 540, 0xd9fbff, 0.3],
    [1140, 470, 0x7ef9ff, 0.45],
    [360, 484, 0xffd166, 0.35],
  ] as const) {
    g.fillStyle(c, a);
    g.fillRect(x - P / 2, y - P * 1.5, P, P * 3);
    g.fillRect(x - P * 1.5, y - P / 2, P * 3, P);
  }
  // near: the meadow, pines at its edges, crystals in the corner, fireflies
  g.fillStyle(0x12331f, 1);
  g.fillRect(0, HORIZON, W, GAME_HEIGHT - HORIZON);
  g.fillStyle(0x1a4a2c, 1);
  g.fillRect(0, HORIZON, W, P);
  g.fillStyle(0x0c2718, 1);
  g.fillRect(0, 668, W, GAME_HEIGHT - 668);
  for (let x = 0; x < W; x += P * 2) g.fillRect(x, 664, P, P);
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
    g.fillStyle(0xffe066, 0.3 + rand() * 0.5);
    g.fillRect(x - P / 2, y - P / 2, P, P);
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
