export const TILE = 64;

export const T_GRASS = 0;
export const T_WATER_A = 1;
export const T_WATER_B = 2;
export const T_TREE = 3;
export const T_PATH = 4;
export const T_TALL = 5;
export const T_HOUSE = 6;
export const T_SOIL = 7;

export const MAP_W = 28;
export const MAP_H = 20;

export const SOLID = new Set<number>([T_WATER_A, T_WATER_B, T_TREE, T_HOUSE]);
export const TALL_GRASS = T_TALL;

export interface MonsterZone {
  cx: number;
  cy: number;
  w: number;
  h: number;
  count: number;
  kind?: "slime" | "goblin" | "wolf" | "bat" | "wasp" | "spider" | "orc" | "frostMoth" | "yeti";
}

export const MONSTER_ZONES: MonsterZone[] = [
  { cx: 4 * TILE, cy: 12 * TILE, w: 2 * TILE, h: 2 * TILE, count: 3 },
  { cx: 17 * TILE, cy: 13 * TILE, w: 2 * TILE, h: 2 * TILE, count: 3 },
  { cx: 10 * TILE, cy: 17 * TILE, w: 2 * TILE, h: 2 * TILE, count: 3 },
  { cx: 24 * TILE, cy: 7 * TILE, w: 2 * TILE, h: 2 * TILE, count: 3, kind: "wolf" },
  { cx: 23 * TILE, cy: 16 * TILE, w: 2 * TILE, h: 2 * TILE, count: 3, kind: "wolf" },
  // no zone by the CAVE at (19,2): its tall grass and warning sign crowded the
  // cave mouth, and three slime zones elsewhere already cover the overworld
];

// Battle ends leave the hero standing where the fight started — inside the
// monster zone, so the post-battle encounter lock expiring right there pulls
// them straight into another fight. This finds the nearest walkable tile
// outside every zone (within `maxTiles` tiles) for the scene to teleport to.
export function escapeFromZones(
  zones: MonsterZone[],
  x: number,
  y: number,
  walkable: (tx: number, ty: number) => boolean,
  maxTiles = 6,
): { x: number; y: number } | null {
  // Clearance from the zone edge: half a tile, so the hero's 40x32 body
  // never reaches back into the zone (or into the dungeon exit trigger).
  const pad = TILE * 0.5;
  const inZone = (px: number, py: number, p: number): boolean =>
    zones.some((z) => Math.abs(px - z.cx) <= z.w / 2 + p && Math.abs(py - z.cy) <= z.h / 2 + p);
  if (!inZone(x, y, TILE * 0.25)) return null;
  let best: { x: number; y: number; d: number } | null = null;
  const cx = Math.floor(x / TILE);
  const cy = Math.floor(y / TILE);
  for (let ty = cy - maxTiles; ty <= cy + maxTiles; ty++) {
    for (let tx = cx - maxTiles; tx <= cx + maxTiles; tx++) {
      const wx = tx * TILE + TILE / 2;
      const wy = ty * TILE + TILE / 2;
      if (inZone(wx, wy, pad)) continue;
      if (!walkable(tx, ty)) continue;
      const d = Math.hypot(wx - x, wy - y);
      if (!best || d < best.d) best = { x: wx, y: wy, d };
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

const CHARS: Record<string, number> = {
  G: T_GRASS,
  W: T_WATER_A,
  T: T_TREE,
  P: T_PATH,
  h: T_TALL,
  H: T_HOUSE,
  S: T_SOIL,
};

// index -> char, the reverse of CHARS, for the map editor's export/save
const TILE_CHARS: Record<number, string> = Object.fromEntries(Object.entries(CHARS).map(([c, i]) => [i, c]));

export const mapToRows = (map: number[][]): string[] => map.map((row) => row.map((t) => TILE_CHARS[t] ?? "G").join(""));

const rowsToMap = (rows: string[]): number[][] =>
  Array.from({ length: MAP_H }, (_, y) => Array.from({ length: MAP_W }, (_, x) => CHARS[rows[y]?.[x]] ?? T_GRASS));

const MAP_KEY = "magic-world-map";

export interface MapOverride {
  tiles: string[];
  landmarks: Record<string, { x: number; y: number }>;
}

let mapOverride: MapOverride | null = null;

// Landmarks the in-game map editor (F2) can move. Every consumer reads .x/.y
// when its scene is created, so an override only has to mutate these objects
// before that — nothing copies the numbers at module load.
export const EDITABLE_POS: Record<string, { x: number; y: number }> = {};

export function saveMapOverride(override: MapOverride): void {
  mapOverride = override;
  localStorage.setItem(MAP_KEY, JSON.stringify(override));
}

export function clearMapOverride(): void {
  mapOverride = null;
  localStorage.removeItem(MAP_KEY);
}

export function hasMapOverride(): boolean {
  return mapOverride !== null;
}

// Called once at boot, before any scene is created.
export function loadMapOverride(): void {
  try {
    const raw = localStorage.getItem(MAP_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as MapOverride;
    if (!Array.isArray(data.tiles)) return;
    mapOverride = data;
    for (const [name, pos] of Object.entries(data.landmarks ?? {})) {
      const target = EDITABLE_POS[name];
      if (target && typeof pos?.x === "number" && typeof pos?.y === "number") {
        target.x = pos.x;
        target.y = pos.y;
      }
    }
  } catch {
    clearMapOverride();
  }
}

// Tall grass is how the map shows where monsters roam, so it is stamped from
// MONSTER_ZONES rather than positioned by hand — the two drifted apart when the
// map was resized and zones ended up marked in the wrong place, or not at all.
function markZones(map: number[][], zones: MonsterZone[]): void {
  for (const z of zones) {
    const x0 = Math.round((z.cx - z.w / 2) / TILE);
    const y0 = Math.round((z.cy - z.h / 2) / TILE);
    const x1 = Math.round((z.cx + z.w / 2) / TILE);
    const y1 = Math.round((z.cy + z.h / 2) / TILE);
    for (let ty = y0; ty < y1; ty++) {
      for (let tx = x0; tx < x1; tx++) {
        if (tx >= 0 && tx < map[0].length && ty >= 0 && ty < map.length) map[ty][tx] = T_TALL;
      }
    }
  }
}

function stamp(map: number[][], x0: number, y0: number, rows: string[]): void {
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const c = CHARS[rows[y][x]];
      if (c === undefined) continue;
      const tx = x0 + x;
      const ty = y0 + y;
      if (tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H) map[ty][tx] = c;
    }
  }
}

// The overworld as it stands, laid out with the in-game map editor (F2) and
// exported from it. Legend: G grass, W water, T tree, P path, h tall grass,
// H house, S farm soil — the same CHARS table the editor round-trips.
const MAP_ROWS = [
  "GGGGGGGGGGGGGGGGGGGGGGGGGGGG",
  "GGGGGSSSGGWWWGGGGGGGGGGGGGGG",
  "GHHGGSSSGGWWWGGGGGGGGGGGGGTG",
  "GHHGGGGPGGGGGGGGGGGGGGGGGTTT",
  "GGGGGGGPGGGGGGGGGGGGGGGGGGGG",
  "GGGGGGTPTGGGGGGGTGGGGGGGGGGG",
  "GGGGGGGPGGGGGGGTTTGGGGGhhGGG",
  "PPPPPPPPPPPPPPPPPPPPPPPhhPPP",
  "GGGGGGGPGGGGGGGGGGGGGPGGGGGG",
  "GGGGGGGPGGGGGGGGGGTGTPPPPPPP",
  "GGGGGGGPGGGGGGGGGGGTGGGGGGGG",
  "GGGhhGGPGGGGGGGGGGGGGGGGGGGG",
  "GGGhhGGPGGGGGGGGhhGGGGTGTGGG",
  "GGGGGGGPGGGTGGGGhhGGGGGTGGTG",
  "GGGGGGGPGGGGGGGGGGGGGGGGGGGG",
  "GGGGGGGPGGGGGGGGTGGGGGhhGGGG",
  "PPPPPPPPGhhGGGGGGGGGTGhhGGTG",
  "GGGGGGTPGhhGGTTTGGGTTTGGGTTT",
  "GGGGGTTTGGGGGGTGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGGGGGGGGGGGGGG",
];

export function buildLevel(): number[][] {
  // a map edited in-game wins outright: it is already the finished grid
  if (mapOverride) return rowsToMap(mapOverride.tiles);
  const map = rowsToMap(MAP_ROWS);
  // tall grass still comes from MONSTER_ZONES rather than the rows above, so
  // moving a zone in code can never drift from the grass that marks it
  markZones(map, MONSTER_ZONES);
  return map;
}

// on the doorstep, one tile below the house — a new hero starts at home. Not
// on the house tiles themselves: those are solid, and the walk-out would start
// inside a wall.
export const PLAYER_SPAWN = { x: 2 * TILE + TILE / 2, y: 4 * TILE + TILE / 2 };
export const NPC_POS = { x: 8 * TILE + TILE / 2, y: 6 * TILE + TILE / 2 };
export const HOUSE_POS = { x: 1 * TILE, y: 2 * TILE };
export const SHOP_POS = { x: 5 * TILE + TILE / 2, y: 8 * TILE + TILE / 2 };
// Landmark positions, laid out in the map editor along with the grid above.
// Two things each of them has to keep: a walkable tile (the editor will not
// stop you dropping one on water), and 120px of clearance from the next
// interactive spot, or a Z press near the seam picks the wrong one.
//
// Exits to another map (CAVE, FOREST, SNOW PASS) also need two walkable tiles
// south of them for the nudge that keeps a returning hero off the trigger, and
// their name label has to survive the camera clamp at a map edge — the SNOW
// PASS sits one tile from the west edge, so its label is clamped inward.
export const CAVE_POS = { x: 23 * TILE + TILE / 2, y: 2 * TILE + TILE / 2 };
// hero record board, west of the ELDER on the main road's north side
export const RANK_BOARD_POS = { x: 3 * TILE + TILE / 2, y: 6 * TILE + TILE / 2 };

// monster hunter offering side bounties, out on the open ground south of the
// road, four tiles east of the BOUNTY BOARD
export const HUNTER_POS = { x: 11 * TILE + TILE / 2, y: 11 * TILE + TILE / 2 };

// gambler offering the lucky wheel, on the road's south side, clear of the
// wolf zone further east
export const GAMBLER_POS = { x: 17 * TILE + TILE / 2, y: 8 * TILE + TILE / 2 };

// bounty board, on the town's other (north-south) road at x=7, clear of the
// slime zone to its west (cx=4, cy=12)
export const BOUNTY_BOARD_POS = { x: 7 * TILE + TILE / 2, y: 11 * TILE + TILE / 2 };

// Fishing spot on the pond's west bank, with its signpost one tile north on
// the same bank — both tiles touch the water, and both are three tiles clear
// of the farm so the two never fight over a Z press.
export const FISH_POS = { x: 9 * TILE + TILE / 2, y: 2 * TILE + TILE / 2 };
export const FISH_SIGN_POS = { x: 9 * TILE + TILE / 2, y: 1 * TILE + TILE / 2 };

// Farm plot centre, on the tilled field itself, with the signpost on the grass
// west of the field.
export const FARM_POS = { x: 6 * TILE + TILE / 2, y: 2 * TILE + TILE / 2 };
export const FARM_SIGN_POS = { x: 4 * TILE + TILE / 2, y: 1 * TILE + TILE / 2 };

// The four tilled plots, on the corners of the 3x2 field so the middle column
// stays clear for the hero to stand on FARM_POS. Derived from FARM_POS rather
// than listed, so moving the farm in the editor moves its plots with it.
// Index matches GameState.farm.
export const farmPlots = (): Array<{ x: number; y: number }> => [
  { x: FARM_POS.x - TILE, y: FARM_POS.y - TILE },
  { x: FARM_POS.x + TILE, y: FARM_POS.y - TILE },
  { x: FARM_POS.x - TILE, y: FARM_POS.y },
  { x: FARM_POS.x + TILE, y: FARM_POS.y },
];

export const DUNGEON_W = 24;
export const DUNGEON_H = 16;
export const DUNGEON_ENTRY = { x: 10 * TILE + TILE / 2, y: 1 * TILE + TILE / 2 };

export const DUNGEON_ZONES: MonsterZone[] = [
  { cx: 4 * TILE, cy: 5 * TILE, w: 3 * TILE, h: 2 * TILE, count: 3 },
  { cx: 15 * TILE, cy: 6 * TILE, w: 3 * TILE, h: 2 * TILE, count: 3 },
  { cx: 10 * TILE, cy: 12 * TILE, w: 3 * TILE, h: 2 * TILE, count: 1 },
  // clear of the entry spawn at (10.5, 3.5) — this zone used to cover it, so
  // walking into the cave dropped the player straight onto a bat
  { cx: 11 * TILE, cy: 5 * TILE, w: 2 * TILE, h: 2 * TILE, count: 3, kind: "bat" },
  { cx: 21 * TILE, cy: 10 * TILE, w: 2 * TILE, h: 2 * TILE, count: 3, kind: "bat" },
  { cx: 4 * TILE, cy: 12 * TILE, w: 2 * TILE, h: 2 * TILE, count: 2, kind: "bat" },
];

export const TREASURE_POS: Array<{ id: string; x: number; y: number }> = [
  { id: "dungeon-1", x: 7 * TILE + TILE / 2, y: 4 * TILE + TILE / 2 },
  { id: "dungeon-2", x: 17 * TILE + TILE / 2, y: 10 * TILE + TILE / 2 },
  { id: "dungeon-3", x: 22 * TILE + TILE / 2, y: 12 * TILE + TILE / 2 },
];

export function buildDungeon(): number[][] {
  const map: number[][] = Array.from({ length: DUNGEON_H }, () => Array<number>(DUNGEON_W).fill(T_PATH));

  for (let x = 0; x < DUNGEON_W; x++) {
    map[0][x] = T_TREE;
    map[DUNGEON_H - 1][x] = T_TREE;
  }
  for (let y = 0; y < DUNGEON_H; y++) {
    map[y][0] = T_TREE;
    map[y][DUNGEON_W - 1] = T_TREE;
  }

  stamp(map, 1, 2, ["WWW", "WWW"]);
  stamp(map, 14, 2, ["WWW", "WWW", "WWW"]);
  stamp(map, 2, 9, ["WWW", "WWW"]);
  stamp(map, 15, 9, ["WW", "WW", "WW"]);

  stamp(map, 8, 4, ["TT", "..", ".."]);
  stamp(map, 4, 7, [".T", "T."]);

  for (let x = 6; x <= 13; x++) {
    if (x === 9 || x === 10) continue; // doorway down into the boss room
    map[10][x] = T_TREE;
  }
  map[11][6] = T_TREE;
  map[12][6] = T_TREE;
  map[11][13] = T_TREE;
  map[12][13] = T_TREE;

  stamp(map, 21, 4, ["WW", "WW", "WW"]);
  stamp(map, 19, 5, [".T", "TT"]);
  stamp(map, 19, 13, ["TT"]);
  stamp(map, 21, 12, ["T"]);
  stamp(map, 3, 14, ["T.", ".T"]);
  stamp(map, 17, 14, ["TT"]);
  stamp(map, 20, 2, ["T"]);
  stamp(map, 23, 12, ["T", "T"]);

  return map;
}

// Forest: 26x18 wall of trees around a grassy glade, path from entrance to boss clearing
export const FOREST_W = 26;
export const FOREST_H = 18;
export const FOREST_ENTRY = { x: 12 * TILE + TILE / 2, y: 1 * TILE + TILE / 2 };

// World-map position of the forest entrance, at the end of the eastern lane
export const FOREST_POS = { x: 24 * TILE + TILE / 2, y: 9 * TILE + TILE / 2 };

export const FOREST_ZONES: Array<MonsterZone & { kind?: "wasp" | "spider" | "orc" }> = [
  { cx: 4 * TILE, cy: 3 * TILE, w: 2 * TILE, h: 2 * TILE, count: 3, kind: "wasp" },
  { cx: 21 * TILE, cy: 3 * TILE, w: 2 * TILE, h: 2 * TILE, count: 3, kind: "wasp" },
  { cx: 5 * TILE, cy: 10 * TILE, w: 2 * TILE, h: 2 * TILE, count: 3, kind: "spider" },
  { cx: 21 * TILE, cy: 9 * TILE, w: 2 * TILE, h: 2 * TILE, count: 3, kind: "spider" },
  { cx: 6 * TILE, cy: 14 * TILE, w: 2 * TILE, h: 2 * TILE, count: 3, kind: "orc" },
  { cx: 14 * TILE, cy: 13 * TILE, w: 3 * TILE, h: 2 * TILE, count: 1 }, // moss golem boss
];

export const FOREST_TREASURE_POS: Array<{ id: string; x: number; y: number }> = [
  { id: "forest-1", x: 4 * TILE + TILE / 2, y: 7 * TILE + TILE / 2 },
  { id: "forest-2", x: 19 * TILE + TILE / 2, y: 8 * TILE + TILE / 2 },
  { id: "forest-3", x: 9 * TILE + TILE / 2, y: 4 * TILE + TILE / 2 },
  { id: "forest-4", x: 16 * TILE + TILE / 2, y: 13 * TILE + TILE / 2 },
];

export function buildForest(): number[][] {
  const map: number[][] = Array.from({ length: FOREST_H }, () => Array<number>(FOREST_W).fill(T_GRASS));

  for (let x = 0; x < FOREST_W; x++) {
    map[0][x] = T_TREE;
    map[FOREST_H - 1][x] = T_TREE;
  }
  for (let y = 0; y < FOREST_H; y++) {
    map[y][0] = T_TREE;
    map[y][FOREST_W - 1] = T_TREE;
  }

  // winding path: entrance (top-center) down, across, down into the clearing
  stamp(map, 11, 1, ["PP", "PP", "PP"]);
  stamp(map, 13, 3, ["PPPPPP"]);
  stamp(map, 18, 4, ["P", "P", "P", "P"]);
  stamp(map, 13, 7, ["PPPPPP"]);
  stamp(map, 13, 8, ["P", "P", "P"]);
  stamp(map, 14, 10, ["PPPP"]);

  // small ponds
  stamp(map, 1, 6, ["WW", "WW", "WW"]);
  stamp(map, 23, 12, ["WW", "WW", "WW"]);

  // tree clusters
  stamp(map, 2, 2, ["T"]);
  stamp(map, 8, 5, [".T.", "TTT"]);
  stamp(map, 22, 6, ["T.T", ".T."]);
  stamp(map, 2, 10, ["T"]);
  stamp(map, 18, 11, [".T.", "TTT"]);
  stamp(map, 12, 11, ["T.T"]);
  stamp(map, 15, 15, ["T"]);
  stamp(map, 9, 14, ["T"]);
  stamp(map, 18, 15, [".T", "TT"]);
  stamp(map, 24, 5, ["T"]);
  stamp(map, 2, 14, ["TTT", ".T."]);

  // same marking rule as the overworld; the boss clearing stays unmarked so
  // the MOSS GOLEM is still a surprise
  markZones(
    map,
    FOREST_ZONES.filter((z) => z.count > 1),
  );

  return map;
}

// Snow Field: post-game area past the MOSS GOLEM, reached from a mountain
// pass in the overworld's north-west corner
export const SNOW_W = 24;
export const SNOW_H = 16;
export const SNOW_ENTRY = { x: 12 * TILE + TILE / 2, y: 1 * TILE + TILE / 2 };

// World-map position of the pass, at the west end of the main road. It used to
// sit at (1,1), in the map's north-west corner; this keeps it in the same
// quarter of the map while clearing both the map edge and the house door.
export const SNOW_POS = { x: 1 * TILE + TILE / 2, y: 15 * TILE + TILE / 2 };

// Filled here rather than at the declaration because it needs every landmark
// above to exist first. The map editor moves whatever is listed.
// Terrain a landmark owns, as tile offsets from its own tile. The map editor
// moves these with it, so dragging the house/pond/field takes its ground along
// instead of leaving a hole behind and dropping the art on bare grass.
export const LANDMARK_TILES: Record<string, { tile: number; cells: Array<[number, number]> }> = {
  HOUSE_POS: {
    tile: T_HOUSE,
    cells: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
  },
  FARM_POS: {
    tile: T_SOIL,
    cells: [
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      [0, 0],
      [1, 0],
    ],
  },
  FISH_POS: {
    tile: T_WATER_A,
    cells: [
      [1, -1],
      [2, -1],
      [3, -1],
      [1, 0],
      [2, 0],
      [3, 0],
    ],
  },
};

Object.assign(EDITABLE_POS, {
  PLAYER_SPAWN,
  NPC_POS,
  HOUSE_POS,
  SHOP_POS,
  CAVE_POS,
  RANK_BOARD_POS,
  HUNTER_POS,
  GAMBLER_POS,
  BOUNTY_BOARD_POS,
  FISH_POS,
  FISH_SIGN_POS,
  FARM_POS,
  FARM_SIGN_POS,
  FOREST_POS,
  SNOW_POS,
});

export const SNOW_ZONES: Array<MonsterZone & { kind?: "frostMoth" | "yeti" }> = [
  { cx: 5 * TILE, cy: 4 * TILE, w: 2 * TILE, h: 2 * TILE, count: 3, kind: "frostMoth" },
  { cx: 19 * TILE, cy: 4 * TILE, w: 2 * TILE, h: 2 * TILE, count: 3, kind: "frostMoth" },
  { cx: 5 * TILE, cy: 10 * TILE, w: 2 * TILE, h: 2 * TILE, count: 2, kind: "yeti" },
  { cx: 19 * TILE, cy: 9 * TILE, w: 2 * TILE, h: 2 * TILE, count: 2, kind: "yeti" },
  // clear of the entry spawn at (12.5, 3.5), same rule as DUNGEON_ZONES
  { cx: 12 * TILE, cy: 6 * TILE, w: 2 * TILE, h: 2 * TILE, count: 3, kind: "frostMoth" },
  { cx: 12 * TILE, cy: 12 * TILE, w: 3 * TILE, h: 2 * TILE, count: 1 }, // glacier golem boss
];

// Ice fishing spot on the north-west frozen pond's south bank (3,4) — clear
// of the frostMoth zone at (4-5, 3-4) and reachable straight off the entry
// path at (9,3-5) by walking west across open grass.
export const SNOW_FISH_POS = { x: 3 * TILE + TILE / 2, y: 4 * TILE + TILE / 2 };

export const SNOW_TREASURE_POS: Array<{ id: string; x: number; y: number }> = [
  { id: "snow-1", x: 3 * TILE + TILE / 2, y: 7 * TILE + TILE / 2 },
  { id: "snow-2", x: 21 * TILE + TILE / 2, y: 6 * TILE + TILE / 2 },
  { id: "snow-3", x: 8 * TILE + TILE / 2, y: 13 * TILE + TILE / 2 },
];

export function buildSnow(): number[][] {
  const map: number[][] = Array.from({ length: SNOW_H }, () => Array<number>(SNOW_W).fill(T_GRASS));

  for (let x = 0; x < SNOW_W; x++) {
    map[0][x] = T_TREE;
    map[SNOW_H - 1][x] = T_TREE;
  }
  for (let y = 0; y < SNOW_H; y++) {
    map[y][0] = T_TREE;
    map[y][SNOW_W - 1] = T_TREE;
  }

  // winding path: entrance (top-center) down, across, down into the boss basin
  stamp(map, 11, 1, ["PP", "PP", "PP"]);
  stamp(map, 9, 3, ["PPPPPP"]);
  stamp(map, 9, 4, ["P", "P"]);
  stamp(map, 15, 5, ["PPPPP"]);
  stamp(map, 19, 6, ["P", "P", "P"]);
  stamp(map, 14, 8, ["PPPP"]);
  stamp(map, 17, 9, ["P", "P"]);

  // frozen ponds
  stamp(map, 2, 2, ["WW", "WW"]);
  stamp(map, 20, 11, ["WWW", "WWW"]);
  stamp(map, 3, 12, ["WW", "WW"]);

  // wind-carved rock clusters
  stamp(map, 7, 2, ["T"]);
  stamp(map, 16, 2, [".T.", "TTT"]);
  stamp(map, 22, 3, ["T"]);
  stamp(map, 8, 6, ["T.T", ".T."]);
  stamp(map, 2, 8, ["T"]);
  stamp(map, 16, 11, [".T.", "TTT"]);
  stamp(map, 10, 10, ["T.T"]);
  stamp(map, 21, 8, ["T"]);
  stamp(map, 6, 14, ["TT"]);
  stamp(map, 14, 14, ["T"]);

  // same marking rule as the forest; the boss basin stays unmarked so the
  // GLACIER GOLEM is still a surprise
  markZones(
    map,
    SNOW_ZONES.filter((z) => z.count > 1),
  );

  return map;
}
