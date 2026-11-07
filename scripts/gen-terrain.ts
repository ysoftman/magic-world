// Generates the terrain grids in src/art/tiles.ts that are made, not drawn:
// the floors (GRASS_TILE.., PATH_TILE.., TALL_TILE, SOIL_TILE, ASH_TILE,
// SCORCH_TILE, HOUSE_TILE), the water and the lava (WATER_A/B.., LAVA_A/B) and
// the transition overlays (SHORE_TILE_1..14, ROAD_TILE_1..14), all 32 cells on
// ART_PX. It rewrites each one's literal block in tiles.ts, so the file stays
// what check:art and tilesets.ts read; the trees and the boulder (TREE_TILE..,
// ROCK_TILE), drawn rather than made, are left as they stand.
//
//   bun run gen:terrain            rewrite the blocks
//   bun run gen:terrain --check    exit 1 if a block is not what this makes
//
// The comments in tiles.ts say what each grid is for; this says how it is made.

const N = 32;
const TILES_TS = `${import.meta.dir}/../src/art/tiles.ts`;

type Grid = string[];

const mod = (a: number, n: number): number => ((a % n) + n) % n;

function blank(ch: string): string[][] {
  return Array.from({ length: N }, () => Array<string>(N).fill(ch));
}

function put(g: string[][], x: number, y: number, ch: string): void {
  g[mod(y, N)][mod(x, N)] = ch;
}

const rows = (g: string[][]): Grid => g.map((r) => r.join(""));

// ---------------------------------------------------------------- floors

/**
 * The 16-cell lattice (X = slope * Y + phase, mod period), its 4px marks laid
 * out as they were, each redrawn as `shape` (cells round 2X, 2Y): the same
 * spacing and share of marked cells, the mark itself on 2px cells.
 */
function lattice(
  base: string,
  mark: string,
  period: number,
  slope: number,
  phase: number,
  shape: (X: number, Y: number) => ReadonlyArray<readonly [number, number]>,
): Grid {
  const g = blank(base);
  for (let Y = 0; Y < 16; Y++)
    for (let X = 0; X < 16; X++)
      if (mod(X - slope * Y - phase, period) === 0) for (const [dx, dy] of shape(X, Y)) put(g, 2 * X + dx, 2 * Y + dy, mark);
  return rows(g);
}

// grass: a blade a cell wide and four tall, its top leaning a cell on
// alternate lattice rows so the field doesn't read as a column grid
const grassBlade = (X: number, Y: number): Array<[number, number]> => {
  const lean = (X + Y) % 2 ? 1 : 0;
  return [
    [lean, -1],
    [lean, 0],
    [0, 1],
    [0, 2],
  ];
};

// path: a pebble, three cells over two, its crown a cell
const pebble = (): Array<[number, number]> => [
  [1, 0],
  [0, 1],
  [1, 1],
  [2, 1],
];

// ash: a fleck of four cells on a slant
const fleck = (): Array<[number, number]> => [
  [0, 0],
  [1, 1],
  [2, 1],
  [1, 0],
];

/**
 * TALL_TILE's lattice: a blade every three columns, in bands a column over
 * from the last, each 4x8px blade redrawn as a pointed one -- a tip a cell
 * wide (leaning left or right) over two cells of body. Six bands five or six
 * rows apart, so the sixth meets the next tile's first a band on.
 */
function blades(base: string, mark: string): Grid {
  const g = blank(base);
  [0, 5, 11, 16, 21, 27].forEach((y0, k) => {
    const phase = mod(-k, 3);
    for (let X = 0; X < 16; X++) {
      if (mod(X - phase, 3)) continue;
      const x0 = 2 * X;
      const tip = (Math.floor(X / 3) + k) % 2;
      put(g, x0 + tip, y0, mark);
      for (const dy of [1, 2, 3]) {
        put(g, x0, y0 + dy, mark);
        put(g, x0 + 1, y0 + dy, mark);
      }
    }
  });
  return rows(g);
}

// tilled soil: a ridge two cells deep every eight rows, its lit crest broken
// a cell now and then, two clods off it in the furrow
function soil(): Grid {
  const g = blank("s");
  for (let k = 0; k < 4; k++) {
    const y = 8 * k;
    for (let x = 0; x < N; x++) {
      put(g, x, y + 1, "h");
      if ((x * 5 + k * 3) % 9 !== 0) put(g, x, y, "h");
    }
    for (const x of [(k * 11 + 5) % N, (k * 11 + 21) % N]) put(g, x, y + 4, "h");
  }
  return rows(g);
}

// ---------------------------------------------------------------- water

function h32(n: number): number {
  let h = (Math.imul(n, 0x9e3779b1) + 0x7f4a7c15) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
}

/**
 * One variation of the water: a crest in each of BANDS row bands -- a 2px
 * glint (LIGHT) over a 2px dark dash (DARK) two cells to its left -- at its
 * own column and row in the band, nothing within a cell of another, and DEEP
 * pairs of dd. B is A a row on, so swapping them shifts the ripples a cell.
 */
const LIGHT = "llllhh";
const DARK = "BBBBBB";
const LEAD = 2;
const BANDS = 12;
const DEEP = 6;
function water(variant: number): [Grid, Grid] {
  const g = blank("W");
  const used = Array.from({ length: N }, () => Array<boolean>(N).fill(false));
  const free = (cells: Array<[number, number]>): boolean => cells.every(([x, y]) => !used[mod(y, N)][mod(x, N)]);
  const claim = (cells: Array<[number, number]>, chars: string): void => {
    cells.forEach(([x, y], i) => {
      put(g, x, y, chars[i]);
    });
    for (const [x, y] of cells)
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) used[mod(y + dy, N)][mod(x + dx, N)] = true;
  };
  for (let b = 0; b < BANDS; b++) {
    const top = Math.floor((b * N) / BANDS);
    const span = Math.floor(N / BANDS);
    for (let tries = 0; tries < 40; tries++) {
      const r = h32(variant * 977 + b * 131 + tries * 7);
      const row = top + ((r >>> 3) % Math.max(1, span - 1));
      const x = (r >>> 9) % N;
      const cells: Array<[number, number]> = [
        ...[...LIGHT].map((_, i): [number, number] => [x + LEAD + i, row]),
        ...[...DARK].map((_, i): [number, number] => [x + i, row + 1]),
      ];
      if (free(cells)) {
        claim(cells, LIGHT + DARK);
        break;
      }
    }
  }
  for (let k = 0; k < DEEP; k++)
    for (let tries = 0; tries < 40; tries++) {
      const r = h32(variant * 5003 + k * 61 + tries * 13 + 1);
      const [x, y] = [(r >>> 4) % N, (r >>> 12) % N];
      const cells: Array<[number, number]> = [
        [x, y],
        [x + 1, y],
      ];
      if (free(cells)) {
        claim(cells, "dd");
        break;
      }
    }
  const a = rows(g);
  return [a, [...a.slice(1), a[0]]];
}

const LAVA_OF: Record<string, string> = { W: "L", B: "R", l: "o", h: "y", d: "k" };
const recolour = (g: Grid, table: Record<string, string>): Grid => g.map((r) => [...r].map((c) => table[c] ?? c).join(""));

// ---------------------------------------------------------------- transitions

// a warp's terms: amplitude (in tiles), p (half-waves across the tile), q
// (waves along it), phase
type Wave = readonly [number, number, number, number];
const SHORE_WAVES: Wave[] = [
  [0.06, 1, 1, 0.4],
  [0.03, 3, 2, 1.7],
  [0.015, 1, 4, 4.0],
];
const ROAD_WAVES: Wave[] = [
  [0.045, 1, 1, 2.2],
  [0.025, 3, 2, 0.9],
  [0.012, 1, 3, 3.1],
];

const smooth = (t: number): number => t * t * (3 - 2 * t);
const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/**
 * Bends (u, v) a cell or two: du is nought on the left and right edges, dv on
 * the top and bottom (sin(pi p u)), and each repeats every tile along the
 * other axis, so an edge stays on itself and the two tiles that share it bend
 * it alike. Odd p reach the middle line, where a straight shore runs.
 */
function warp(u: number, v: number, waves: readonly Wave[]): [number, number] {
  let du = 0;
  let dv = 0;
  for (const [a, p, q, ph] of waves) {
    du += a * Math.sin(Math.PI * p * u) * Math.cos(2 * Math.PI * q * v + ph);
    dv += a * Math.sin(Math.PI * p * v) * Math.cos(2 * Math.PI * q * u + ph * 1.7);
  }
  return [u + du, v + dv];
}

/**
 * How much of the other terrain is at (u, v) in the tile for `mask` (bit 0
 * TL, 1 TR, 2 BL, 3 BR): the corners' bilinear blend on smoothstepped
 * coordinates, exact on every edge, a lone corner rounding off like a quarter
 * circle. The saddles (6, 9) are the union of their two corner wedges, which
 * is the same blend on every edge.
 */
function field(mask: number, u0: number, v0: number, waves: readonly Wave[]): number {
  const [tl, tr, bl, br] = [0, 1, 2, 3].map((i) => (mask >> i) & 1);
  const [wu, wv] = warp(u0, v0, waves);
  const u = smooth(clamp01(wu));
  const v = smooth(clamp01(wv));
  const w = [tl * (1 - u) * (1 - v), tr * u * (1 - v), bl * (1 - u) * v, br * u * v];
  return mask === 6 || mask === 9 ? Math.max(...w) : w[0] + w[1] + w[2] + w[3];
}

function hsh(x: number, y: number, salt: number): number {
  let n = (x * 374761393 + y * 668265263 + salt * 2246822519) >>> 0;
  n = Math.imul((n ^ (n >>> 13)) >>> 0, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/**
 * One transition tile. The fills carry the base tiles on, shifted half a tile
 * (the overlay sits on the dual grid): grass (GRASS_TILE's h as q) and the
 * other terrain (`fill`). Then the edge: the shore's h foam and l under it,
 * the road's S (now and then m) and P ruts or p under it.
 */
function transition(mask: number, kind: "shore" | "road", grass: Grid, fill: Grid, waves: readonly Wave[]): Grid {
  const shift = (t: Grid, x: number, y: number): string => t[(y + 16) % N][(x + 16) % N];
  let other = Array.from({ length: N + 4 }, (_, j) =>
    Array.from({ length: N + 4 }, (_, i) => field(mask, (i - 2 + 0.5) / N, (j - 2 + 0.5) / N, waves) > 0.5),
  );
  const at = (x: number, y: number): boolean => other[y + 2][x + 2];
  // a majority pass over the inside of the tile, twice, never its border
  // (which a neighbour shares): spits and notches a cell or two wide go
  for (let pass = 0; pass < 2; pass++) {
    const next = other.map((r) => [...r]);
    for (let y = 1; y < N - 1; y++)
      for (let x = 1; x < N - 1; x++) {
        let votes = 0;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (at(x + dx, y + dy)) votes++;
        next[y + 2][x + 2] = votes >= 5;
      }
    other = next;
  }
  const near = (x: number, y: number, reach: number): boolean => {
    for (let dx = -reach; dx <= reach; dx++)
      for (let dy = -reach; dy <= reach; dy++) if (Math.abs(dx) + Math.abs(dy) <= reach && (dx || dy) && !at(x + dx, y + dy)) return true;
    return false;
  };
  const out: Grid = [];
  for (let y = 0; y < N; y++) {
    let r = "";
    for (let x = 0; x < N; x++) {
      if (!at(x, y)) r += shift(grass, x, y) === "h" ? "q" : "g";
      else if (near(x, y, 1)) r += kind === "shore" ? "h" : hsh(x, y, 5) < 0.85 ? "S" : "m";
      else if (near(x, y, 2)) r += kind === "shore" ? "l" : hsh(x, y, 7) < 0.5 ? "P" : "p";
      else r += shift(fill, x, y);
    }
    out.push(r);
  }
  return out;
}

// ---------------------------------------------------------------- all of it

function generate(): Map<string, Grid> {
  const g = new Map<string, Grid>();
  const suffix = ["", "_2", "_3", "_4"];
  [0, 4, 3, 2].forEach((phase, i) => {
    g.set(`GRASS_TILE${suffix[i]}`, lattice("g", "h", 5, 3, phase, grassBlade));
  });
  [0, 5, 4, 3].forEach((phase, i) => {
    g.set(`PATH_TILE${suffix[i]}`, lattice("p", "h", 6, 4, phase, pebble));
  });
  g.set("TALL_TILE", blades("g", "h"));
  g.set("SOIL_TILE", soil());
  g.set("HOUSE_TILE", Array<string>(N).fill(".".repeat(N)));
  g.set("ASH_TILE", lattice("a", "h", 7, 4, 0, fleck));
  g.set("SCORCH_TILE", blades("s", "e"));
  suffix.forEach((s, i) => {
    const [a, b] = water(i);
    g.set(`WATER_A${s}`, a);
    g.set(`WATER_B${s}`, b);
  });
  const [la, lb] = water(0);
  g.set("LAVA_A", recolour(la, LAVA_OF));
  g.set("LAVA_B", recolour(lb, LAVA_OF));
  const grass = g.get("GRASS_TILE") as Grid;
  for (let m = 1; m <= 14; m++) {
    g.set(`SHORE_TILE_${m}`, transition(m, "shore", grass, g.get("WATER_A") as Grid, SHORE_WAVES));
    g.set(`ROAD_TILE_${m}`, transition(m, "road", grass, g.get("PATH_TILE") as Grid, ROAD_WAVES));
  }
  return g;
}

const grids = generate();
const source = await Bun.file(TILES_TS).text();
const seen = new Set<string>();
const changed: string[] = [];
const written = source.replace(/^export const ([A-Z0-9_]+) = \[\n[\s\S]*?\n\];$/gm, (block, name: string) => {
  const grid = grids.get(name);
  if (!grid) return block;
  seen.add(name);
  const fresh = `export const ${name} = [\n${grid.map((r) => `  "${r}",`).join("\n")}\n];`;
  if (fresh !== block) changed.push(name);
  return fresh;
});
const missing = [...grids.keys()].filter((n) => !seen.has(n));
if (missing.length) {
  console.error(`no literal block in tiles.ts for ${missing.join(", ")}`);
  process.exit(1);
}
if (process.argv.includes("--check")) {
  console.log(changed.length ? `differs from tiles.ts: ${changed.join(", ")}` : `all ${grids.size} generated grids match tiles.ts`);
  process.exit(changed.length ? 1 : 0);
}
await Bun.write(TILES_TS, written);
console.log(changed.length ? `rewrote ${changed.join(", ")}` : `all ${grids.size} generated grids already matched`);
