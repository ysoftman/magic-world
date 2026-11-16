import { TILE } from "./levels";

// Star shards: three lie hidden in each field (the cave, the forest, the
// snow field, the volcano), in its far corners and dead ends, off the minimap.
// One shows only as a faint glint once the hero is within two tiles
// (ui/StarShards.ts) and is taken by walking over it. A field's third makes
// its star whole: +1 ATK and +1 DEF for good, the same size as one step of
// the bestiary's completion bonus. All four fields are +4 and +4, about one
// armour tier, for walking every map's edges once.
//
// Cells, each open floor the hero can walk to, more than a tile clear of
// every monster zone and away from the way in, the chests and the shrine.

export type ShardRegion = "dungeon" | "forest" | "snow" | "volcano";

type Cell = readonly [number, number];

export const SHARD_CELLS: Record<ShardRegion, readonly [Cell, Cell, Cell]> = {
  dungeon: [
    [1, 1],
    [22, 7],
    [1, 14],
  ],
  forest: [
    [24, 3],
    [1, 16],
    [24, 16],
  ],
  snow: [
    [22, 1],
    [22, 9],
    [1, 14],
  ],
  volcano: [
    [1, 1],
    [17, 1],
    [6, 14],
  ],
};

// the toasts' name for each field's star; 7 glyphs at most
export const SHARD_REGION_NAMES: Record<ShardRegion, string> = { dungeon: "CAVE", forest: "FOREST", snow: "SNOW", volcano: "VOLCANO" };

export const SHARDS_PER_REGION = 3;
export const SHARD_ATK = 1;
export const SHARD_DEF = 1;

export const shardId = (region: ShardRegion, i: number): string => `${region}-${i}`;

export const shardSpots = (region: ShardRegion): Array<{ id: string; x: number; y: number }> =>
  SHARD_CELLS[region].map(([tx, ty], i) => ({ id: shardId(region, i), x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 }));

const ALL_IDS = (Object.keys(SHARD_CELLS) as ShardRegion[]).flatMap((r) => SHARD_CELLS[r].map((_, i) => shardId(r, i)));

// A save from before the shards has none; only real ids are kept, each once
export function loadShards(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  return ALL_IDS.filter((id) => data.includes(id));
}

export const shardsFound = (found: readonly string[], region: ShardRegion): number =>
  found.filter((id) => id.startsWith(`${region}-`)).length;

interface ShardState {
  shards: string[];
  player: { atk: number; def: number };
}

// The hero takes shard `id`: how many of its field's are now held, and
// whether that made the star whole (the stats are raised here). Null when it
// was held already.
export function takeShard(state: ShardState, region: ShardRegion, id: string): { have: number; whole: boolean } | null {
  if (state.shards.includes(id) || !ALL_IDS.includes(id)) return null;
  state.shards.push(id);
  const have = shardsFound(state.shards, region);
  const whole = have === SHARDS_PER_REGION;
  if (whole) {
    state.player.atk += SHARD_ATK;
    state.player.def += SHARD_DEF;
  }
  return { have, whole };
}
