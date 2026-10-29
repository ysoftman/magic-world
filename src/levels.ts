import { OVERWORLD_MAP } from "./overworldMap";
export const TILE = 64;

export const T_GRASS = 0;
export const T_WATER_A = 1;
export const T_WATER_B = 2;
export const T_TREE = 3;
export const T_PATH = 4;
export const T_TALL = 5;
export const T_HOUSE = 6;
export const T_SOIL = 7;
// Volcano terrain, appended after art/tilesets.ts's variation frames (8..22).
// Lava swaps A/B on a timer the way water does; scorched ground marks the
// monster zones there the way tall grass does everywhere else.
export const T_ASH = 23;
export const T_LAVA_A = 24;
export const T_LAVA_B = 25;
export const T_ROCK = 26;
export const T_SCORCH = 27;

export const MAP_W = 28;
export const MAP_H = 20;

export const SOLID = new Set<number>([T_WATER_A, T_WATER_B, T_TREE, T_HOUSE, T_LAVA_A, T_LAVA_B, T_ROCK]);
/**
 * Tiles that draw a thing standing *on* the ground rather than the ground
 * itself. Their art is cropped to the object with a transparent background, so
 * they render on the scene's object layer (with ground painted underneath)
 * instead of the terrain layer — see buildTileLayers in sceneCommon.ts.
 */
export const OBJECT_TILES = new Set<number>([T_TREE, T_HOUSE, T_ROCK]);
export const TALL_GRASS = T_TALL;

export interface MonsterZone {
  cx: number;
  cy: number;
  w: number;
  h: number;
  count: number;
  kind?: "slime" | "goblin" | "wolf" | "bat" | "wasp" | "spider" | "orc" | "frostMoth" | "yeti" | "magmaSlime" | "fireImp" | "salamander";
}

export const MONSTER_ZONES: MonsterZone[] = [
  { cx: 4 * TILE, cy: 12 * TILE, w: 2 * TILE, h: 2 * TILE, count: 3 },
  { cx: 17 * TILE, cy: 13 * TILE, w: 2 * TILE, h: 2 * TILE, count: 3 },
  { cx: 10 * TILE, cy: 17 * TILE, w: 2 * TILE, h: 2 * TILE, count: 3 },
  // the north-east meadow, off the main road and two tiles from the cave's
  // spur road: it used to sit on the road itself, in front of the cave
  { cx: 20 * TILE, cy: 4 * TILE, w: 2 * TILE, h: 2 * TILE, count: 3, kind: "wolf" },
  { cx: 23 * TILE, cy: 16 * TILE, w: 2 * TILE, h: 2 * TILE, count: 3, kind: "wolf" },
  // no zone right by the CAVE: its tall grass crowded the cave mouth, and
  // three slime zones elsewhere already cover the overworld
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
  A: T_ASH,
  L: T_LAVA_A,
  R: T_ROCK,
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
    // a bad override is dropped; with storage blocked (site data off) the
    // read above threw and so would the removal, which would stop the boot
    mapOverride = null;
    try {
      localStorage.removeItem(MAP_KEY);
    } catch {
      /* nothing stored to drop */
    }
  }
}

// A 2x2 zone's ragged rim: a 4x4 mask with the zone's own cells at (1..2,
// 1..2), each one lumpy in its own way so no patch reads as a box.
const ZONE_RIMS = [
  [".h..", "hhh.", ".hh.", "...."],
  ["....", ".hhh", "hhh.", "...."],
  ["..h.", ".hh.", ".hhh", "...."],
  ["....", ".hh.", "hhh.", "..h."],
  [".h..", ".hhh", ".hh.", "..h."],
];

// Tall grass is how the map shows where monsters roam, so it is stamped from
// MONSTER_ZONES rather than positioned by hand — the two drifted apart when the
// map was resized and zones ended up marked in the wrong place, or not at all.
// A 2x2 zone also gets a rim from ZONE_RIMS, picked by where it sits, so the
// patch is a clump rather than a square (sceneCommon frays its edge as well).
// The rim only covers open `ground` — never a road, water, a tree — and never
// a cell in `keepClear` (landmarks, chests); the roamers keep to the rect.
function markZones(
  map: number[][],
  zones: MonsterZone[],
  marker = T_TALL,
  ground = T_GRASS,
  keepClear: ReadonlyArray<{ x: number; y: number }> = [],
): void {
  const inMap = (tx: number, ty: number): boolean => tx >= 0 && tx < map[0].length && ty >= 0 && ty < map.length;
  const clear = new Set(keepClear.map((p) => `${Math.floor(p.x / TILE)},${Math.floor(p.y / TILE)}`));
  for (const z of zones) {
    const x0 = Math.round((z.cx - z.w / 2) / TILE);
    const y0 = Math.round((z.cy - z.h / 2) / TILE);
    const x1 = Math.round((z.cx + z.w / 2) / TILE);
    const y1 = Math.round((z.cy + z.h / 2) / TILE);
    for (let ty = y0; ty < y1; ty++) {
      for (let tx = x0; tx < x1; tx++) {
        if (inMap(tx, ty)) map[ty][tx] = marker;
      }
    }
    if (x1 - x0 !== 2 || y1 - y0 !== 2) continue;
    const rim = ZONE_RIMS[(x0 * 3 + y0 * 7) % ZONE_RIMS.length];
    rim.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) {
        const tx = x0 - 1 + dx;
        const ty = y0 - 1 + dy;
        if (row[dx] === "h" && inMap(tx, ty) && map[ty][tx] === ground && !clear.has(`${tx},${ty}`)) map[ty][tx] = marker;
      }
    });
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

export function buildLevel(): number[][] {
  // a map edited in-game wins outright: it is already the finished grid, so
  // markZones below is deliberately skipped for it — an override is trusted
  // as final and never has code-driven state re-stamped onto it (the same way
  // MapEditor takes landmark positions straight from the override rather than
  // recomputing them). Don't "fix" this without re-checking that. Anything
  // that must apply to both paths belongs in the scene that owns the tilemap
  // layer, not here — tile variation and autotile transitions both need the
  // layer, which doesn't exist yet at this point.
  if (mapOverride) return rowsToMap(mapOverride.tiles);
  const map = rowsToMap(OVERWORLD_MAP.rows);
  // tall grass still comes from MONSTER_ZONES rather than the rows in the map
  // file, so moving a zone in code can never drift from the grass marking it
  markZones(map, MONSTER_ZONES, T_TALL, T_GRASS, Object.values(EDITABLE_POS));
  return map;
}

// on the doorstep, one tile below the house — a new hero starts at home. Not
// on the house tiles themselves: those are solid, and the walk-out would start
// inside a wall.
// mutable copies: the map editor moves these at runtime, the data file stays
const LANDMARKS = OVERWORLD_MAP.landmarks;

export const PLAYER_SPAWN = { ...LANDMARKS.PLAYER_SPAWN };
export const NPC_POS = { ...LANDMARKS.NPC_POS };
export const HOUSE_POS = { ...LANDMARKS.HOUSE_POS };
export const SHOP_POS = { ...LANDMARKS.SHOP_POS };
// Landmark positions, laid out in the map editor along with the grid above.
// Two things each of them has to keep: a walkable tile (the editor will not
// stop you dropping one on water), and 120px of clearance from the next
// interactive spot, or a Z press near the seam picks the wrong one.
//
// FOREST, SNOW PASS and VOLCANO are roads running off the map: each sits on
// the road's last tile at the edge, with two walkable road tiles inward of it
// (a returning hero is set down there, off the trigger) and its signpost one
// tile in, beside the road (TownScene.addMapExit). The CAVE is the one exit in
// the middle of the map; its spur road ends at the mouth and a returning hero
// steps out two tiles south.
export const CAVE_POS = { ...LANDMARKS.CAVE_POS };
// hero record board, west of the ELDER on the main road's north side
export const RANK_BOARD_POS = { ...LANDMARKS.RANK_BOARD_POS };

// monster hunter offering side bounties, across the north-south road from the
// BOUNTY BOARD and a row lower, so the two name tags clear each other
export const HUNTER_POS = { ...LANDMARKS.HUNTER_POS };

// gambler offering the lucky wheel, on the road's south side, clear of the
// wolf zone further east
export const GAMBLER_POS = { ...LANDMARKS.GAMBLER_POS };

// bounty board, beside the town's other (north-south) road at x=7 rather than
// on it, clear of the slime zone to its west (cx=4, cy=12)
export const BOUNTY_BOARD_POS = { ...LANDMARKS.BOUNTY_BOARD_POS };

// Fishing spot on the pond's west bank, with its signpost one tile north on
// the same bank — both tiles touch the water, and both are three tiles clear
// of the farm so the two never fight over a Z press.
export const FISH_POS = { ...LANDMARKS.FISH_POS };
export const FISH_SIGN_POS = { ...LANDMARKS.FISH_SIGN_POS };

// Farm plot centre, on the tilled field itself, with the signpost on the grass
// west of the field.
export const FARM_POS = { ...LANDMARKS.FARM_POS };
export const FARM_SIGN_POS = { ...LANDMARKS.FARM_SIGN_POS };

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
  // A row lower than it was: at row 12 the king (drawn 1.5x) reached 40px up
  // into the boss room's top wall, now a solid rock face rather than trunks.
  { cx: 10 * TILE, cy: 13 * TILE, w: 3 * TILE, h: 2 * TILE, count: 1 },
  // clear of the entry spawn at (10.5, 3.5) — this zone used to cover it, so
  // walking into the cave dropped the player straight onto a bat. A column
  // right of x=11, where a bat at its left limit overlapped the pillar at (9,4).
  { cx: 12 * TILE, cy: 5 * TILE, w: 2 * TILE, h: 2 * TILE, count: 3, kind: "bat" },
  { cx: 21 * TILE, cy: 10 * TILE, w: 2 * TILE, h: 2 * TILE, count: 3, kind: "bat" },
  { cx: 4 * TILE, cy: 12 * TILE, w: 2 * TILE, h: 2 * TILE, count: 2, kind: "bat" },
];

// The stair down to the ABYSS (abyss.ts), shown once the FLAME DRAKE has
// fallen: the dead end of the cave's south-east pocket, reached only through
// the one-tile gap at (22,12), the cave's deepest corner. Its "ABYSS" tag
// (100px) sits at x 1198..1298, y 838..872 — over the pocket's boulders, clear
// of the chest and inside the map.
export const ABYSS_STAIRS_POS = { x: 19 * TILE + TILE / 2, y: 14 * TILE + TILE / 2 };

export const TREASURE_POS: Array<{ id: string; x: number; y: number }> = [
  { id: "dungeon-1", x: 7 * TILE + TILE / 2, y: 4 * TILE + TILE / 2 },
  { id: "dungeon-2", x: 17 * TILE + TILE / 2, y: 10 * TILE + TILE / 2 },
  // In the stair's pocket, off the way in: it stood in the gap at (22,12),
  // where it read as a wall across the only way to the stair (a player took
  // the stair for gone). Three tiles east of the stair, its corner.
  { id: "dungeon-3", x: 22 * TILE + TILE / 2, y: 14 * TILE + TILE / 2 },
];

// The cave's walls and pillars are T_ROCK, the volcano's boulder: a tree
// skinned grey still read as a tree. art/tilesets.ts CAVE_SKIN draws it as
// plain cave rock with no lava crack. Same solidity as the trees it replaced,
// so the layout, its reachability and every zone are unchanged.
export function buildDungeon(): number[][] {
  const map: number[][] = Array.from({ length: DUNGEON_H }, () => Array<number>(DUNGEON_W).fill(T_PATH));

  for (let x = 0; x < DUNGEON_W; x++) {
    map[0][x] = T_ROCK;
    map[DUNGEON_H - 1][x] = T_ROCK;
  }
  for (let y = 0; y < DUNGEON_H; y++) {
    map[y][0] = T_ROCK;
    map[y][DUNGEON_W - 1] = T_ROCK;
  }

  // pools of overlapping 2x2s (see the forest's ponds), none a rectangle
  stamp(map, 1, 2, ["WW.", "WWW", ".WW"]);
  stamp(map, 14, 2, [".WW", "WWW", "WW."]);
  stamp(map, 1, 9, [".WW", "WWW", "WW."]);
  stamp(map, 14, 9, [".WW", "WWW", "WW."]);

  stamp(map, 8, 4, ["RR", "..", ".."]);
  stamp(map, 4, 7, [".R", "R."]);

  for (let x = 6; x <= 13; x++) {
    if (x === 9 || x === 10) continue; // doorway down into the boss room
    map[10][x] = T_ROCK;
  }
  map[11][6] = T_ROCK;
  map[12][6] = T_ROCK;
  map[11][13] = T_ROCK;
  map[12][13] = T_ROCK;

  stamp(map, 21, 3, ["WW", "WW", ".W"]);
  stamp(map, 19, 5, [".R", "RR"]);
  stamp(map, 19, 13, ["RR"]);
  stamp(map, 21, 12, ["R"]);
  stamp(map, 3, 14, ["R.", ".R"]);
  stamp(map, 17, 14, ["RR"]);
  stamp(map, 20, 2, ["R"]);
  stamp(map, 23, 12, ["R", "R"]);

  return map;
}

// Forest: 26x18 wall of trees around a grassy glade, path from entrance to boss clearing
export const FOREST_W = 26;
export const FOREST_H = 18;
export const FOREST_ENTRY = { x: 12 * TILE + TILE / 2, y: 1 * TILE + TILE / 2 };

// World-map position of the forest entrance, where the eastern lane runs off
// the map's east edge
export const FOREST_POS = { ...LANDMARKS.FOREST_POS };

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

  // winding path: in through a gap in the top border, across, down into the
  // clearing. The gap is the way back to town (sceneCommon.addTownExitSign).
  stamp(map, 11, 0, ["PP", "PP", "PP", "PP"]);
  stamp(map, 13, 3, ["PPPPPP"]);
  stamp(map, 18, 4, ["P", "P", "P", "P"]);
  stamp(map, 13, 7, ["PPPPPP"]);
  stamp(map, 13, 8, ["P", "P", "P"]);
  stamp(map, 14, 10, ["PPPP"]);

  // small ponds, each two overlapping 2x2 pools: lopsided, and never a
  // one-tile finger, which the shoreline art sharpens into a spike
  stamp(map, 1, 5, ["WW.", "WWW", ".WW"]);
  stamp(map, 22, 11, [".WW", "WWW", "WW."]);

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
    T_TALL,
    T_GRASS,
    [FOREST_ENTRY, ...FOREST_TREASURE_POS],
  );

  return map;
}

// Snow Field: post-game area past the MOSS GOLEM, reached from a mountain
// pass in the overworld's north-west corner
export const SNOW_W = 24;
export const SNOW_H = 16;
export const SNOW_ENTRY = { x: 12 * TILE + TILE / 2, y: 1 * TILE + TILE / 2 };

// World-map position of the pass, where the south-western road runs off the
// map's west edge.
export const SNOW_POS = { ...LANDMARKS.SNOW_POS };

// World-map position of the volcano road's end: it leaves the forest lane by
// the GUARD and runs south off the map's bottom edge, a tile clear of the wolf
// zone to its west. Opens once the GLACIER GOLEM falls.
export const VOLCANO_POS = { ...LANDMARKS.VOLCANO_POS };

// ARENA keeper, on the grass just north of the main road between the ELDER
// and the trees: 286px from the GAMBLER, the nearest other talk spot, and its
// name tag clear of every other label (see arena.ts for what it runs)
export const ARENA_POS = { ...LANDMARKS.ARENA_POS };

// BLACKSMITH, on the grass south-west of the SHOP: 202px from it and from the
// RANK BOARD, the nearest other talk spots, and its name tag clear of the
// SHOP's sprite, every other label and the map edge (ui/Blacksmith.ts forges
// monster materials into gear)
export const BLACKSMITH_POS = { ...LANDMARKS.BLACKSMITH_POS };

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
  // a 3x2 pool with a lobe off its north-east corner and one south-west by
  // the cast spot, so its shore is not a rounded rectangle
  FISH_POS: {
    tile: T_WATER_A,
    cells: [
      [1, -1],
      [2, -1],
      [3, -1],
      [4, -1],
      [1, 0],
      [2, 0],
      [3, 0],
      [1, 1],
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
  VOLCANO_POS,
  ARENA_POS,
  BLACKSMITH_POS,
});

// The keepers whose workplace TownScene draws behind them: a 2x2-tile building
// on the two rows north of the keeper's tile, its left column over the
// keeper's. Solid to the hero; the villagers and anything that picks a free
// tile (the treasure map) keep off its cells (workplaceCells).
export const WORKPLACE_LANDMARKS = ["NPC_POS", "SHOP_POS", "BLACKSMITH_POS", "ARENA_POS", "GAMBLER_POS", "HUNTER_POS"] as const;
export const workplaceCells = (): Array<[number, number]> =>
  WORKPLACE_LANDMARKS.flatMap((k) => {
    const tx = Math.floor(EDITABLE_POS[k].x / TILE);
    const ty = Math.floor(EDITABLE_POS[k].y / TILE);
    return [
      [tx, ty - 2],
      [tx + 1, ty - 2],
      [tx, ty - 1],
      [tx + 1, ty - 1],
    ] as Array<[number, number]>;
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

  // winding path: in through a gap in the top border (the way back to town),
  // across, down into the boss basin
  stamp(map, 11, 0, ["PP", "PP", "PP", "PP"]);
  stamp(map, 9, 3, ["PPPPPP"]);
  stamp(map, 9, 4, ["P", "P"]);
  // joins the row-3 path to the row-5 one; they only touched corners
  stamp(map, 14, 4, ["P", "P"]);
  stamp(map, 15, 5, ["PPPPP"]);
  stamp(map, 19, 6, ["P", "P", "P"]);
  stamp(map, 14, 8, ["PPPP"]);
  stamp(map, 17, 9, ["P", "P"]);

  // frozen ponds, two overlapping 2x2 pools each (see the forest's); the
  // first keeps (3,3) beside the ice-fishing hole
  stamp(map, 2, 1, [".WW", "WWW", "WW."]);
  stamp(map, 20, 10, [".WW", "WWW", "WW."]);
  stamp(map, 3, 11, ["WW.", "WWW", ".WW"]);

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
    T_TALL,
    T_GRASS,
    [SNOW_ENTRY, SNOW_FISH_POS, ...SNOW_TREASURE_POS],
  );

  return map;
}

// Volcano: the last region, past the GLACIER GOLEM. Same 24x16 frame and
// top-centre entry as the snow field, walled in basalt instead of trees, with
// the boss in a lava-ringed crater at the bottom that one bridge leads into.
export const VOLCANO_W = 24;
export const VOLCANO_H = 16;
export const VOLCANO_ENTRY = { x: 12 * TILE + TILE / 2, y: 1 * TILE + TILE / 2 };

// Roamers float over terrain (no collider), so every zone keeps an ash tile
// between it and the nearest lava or the sprites would wade through it.
export const VOLCANO_ZONES: Array<MonsterZone & { kind?: "magmaSlime" | "fireImp" | "salamander" }> = [
  { cx: 5 * TILE, cy: 4 * TILE, w: 2 * TILE, h: 2 * TILE, count: 3, kind: "magmaSlime" },
  { cx: 19 * TILE, cy: 4 * TILE, w: 2 * TILE, h: 2 * TILE, count: 3, kind: "magmaSlime" },
  // clear of the entry spawn at (12.5, 3.5), same rule as DUNGEON_ZONES
  { cx: 12 * TILE, cy: 7 * TILE, w: 2 * TILE, h: 2 * TILE, count: 3, kind: "fireImp" },
  { cx: 5 * TILE, cy: 10 * TILE, w: 2 * TILE, h: 2 * TILE, count: 2, kind: "salamander" },
  { cx: 19 * TILE, cy: 10 * TILE, w: 2 * TILE, h: 2 * TILE, count: 2, kind: "salamander" },
  // flame drake boss: the crater floor is x 9..14, y 11..14, and the 1.5x
  // sprite roaming this box stays inside it, a row clear of the bridge
  { cx: 12 * TILE, cy: 13 * TILE, w: 3 * TILE, h: 2 * TILE, count: 1 },
];

export const VOLCANO_TREASURE_POS: Array<{ id: string; x: number; y: number }> = [
  { id: "volcano-1", x: 21 * TILE + TILE / 2, y: 2 * TILE + TILE / 2 },
  { id: "volcano-2", x: 2 * TILE + TILE / 2, y: 13 * TILE + TILE / 2 },
  { id: "volcano-3", x: 21 * TILE + TILE / 2, y: 13 * TILE + TILE / 2 },
];

export function buildVolcano(): number[][] {
  const map: number[][] = Array.from({ length: VOLCANO_H }, () => Array<number>(VOLCANO_W).fill(T_ASH));

  for (let x = 0; x < VOLCANO_W; x++) {
    map[0][x] = T_ROCK;
    map[VOLCANO_H - 1][x] = T_ROCK;
  }
  for (let y = 0; y < VOLCANO_H; y++) {
    map[y][0] = T_ROCK;
    map[y][VOLCANO_W - 1] = T_ROCK;
  }

  // the way back to town: a gap in the top wall above the entry
  stamp(map, 11, 0, ["AA"]);
  // twin lava pools flanking the entry, dripping south — not quite mirrored
  stamp(map, 8, 3, [".LL...LLL", "LLL...LL.", "LL.....LL"]);
  // ...and the vents along the side walls
  stamp(map, 1, 5, ["L..", "LL.", "LLL", "L.."]);
  stamp(map, 20, 6, [".LL", "LLL", "..L", "..L"]);

  // the crater: a lava moat on three sides, basalt on the fourth, and a
  // two-tile bridge at x 11-12 as the only way in
  stamp(map, 8, 10, ["LLL..LLL"]);
  for (let y = 11; y <= 14; y++) {
    map[y][8] = T_LAVA_A;
    map[y][15] = T_LAVA_A;
  }
  // the moat bulges out here and there, so its walls aren't ruled lines
  stamp(map, 7, 12, ["L", "L"]);
  stamp(map, 16, 11, ["L"]);

  // basalt outcrops
  stamp(map, 7, 2, ["R"]);
  stamp(map, 16, 2, ["R"]);
  stamp(map, 6, 7, ["R"]);
  stamp(map, 17, 7, ["R"]);
  stamp(map, 3, 12, ["R"]);
  stamp(map, 20, 12, ["R"]);

  // scorched ground marks the zones the way tall grass does elsewhere; the
  // crater stays unmarked so the FLAME DRAKE is still a surprise
  markZones(
    map,
    VOLCANO_ZONES.filter((z) => z.count > 1),
    T_SCORCH,
    T_ASH,
    [VOLCANO_ENTRY, ...VOLCANO_TREASURE_POS],
  );

  return map;
}
