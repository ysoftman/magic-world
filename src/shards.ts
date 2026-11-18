import { MAX_HP } from "./config";
import type { MaterialKey } from "./drops";
import { addItem } from "./itemCaps";
import { TILE } from "./levels";

// Star shards: three lie in each field (the cave, the forest, the snow field,
// the volcano), in its far corners and dead ends, off the minimap but plain
// on the ground (ui/StarShards.ts), each taken by walking over it. A field's
// third makes its star whole: +5 max HP for good, two of the field's material
// and a CANDY. All twelve are the STARFALL: +2 ATK and +2 DEF for good. In
// all +20 max HP, +2 and +2 — two steps of the bestiary's completion bonus
// and a level's HP — for walking every map's edges once. The quest journal
// counts them (ui/QuestLog.ts) and the twelfth is a trophy (achievements.ts).
//
// The first version (one commit long) gave +1 ATK and +1 DEF a field; a save
// that made a star whole then keeps those and gets nothing more for it.
//
// Cells, each open floor the hero can walk to, more than a tile clear of
// every monster zone and away from the way in, the chests and the shrine.
// The fields are not the map editor's (F2 edits the town alone), so none can
// be walled in after the fact.

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
    [1, 14],
    [24, 13],
  ],
  snow: [
    [22, 1],
    [22, 9],
    [5, 14],
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
export const SHARDS_TOTAL = 12;
// a field's star whole
export const STAR_MAX_HP = 5;
export const STAR_MATERIALS = 2;
export const STAR_MATERIAL: Record<ShardRegion, MaterialKey> = {
  dungeon: "batWing",
  forest: "spiderSilk",
  snow: "frostScale",
  volcano: "magmaCore",
};
// ...and all four
export const STARFALL_ATK = 2;
export const STARFALL_DEF = 2;

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
  player: { atk: number; def: number; hp: number; maxHp: number };
  inventory: Record<MaterialKey, number> & { candy: number };
}

// The hero takes shard `id`: how many of its field's are now held, whether
// that made the star whole and whether it was the last of all (the rewards
// are given here). Null when it was held already.
export function takeShard(state: ShardState, region: ShardRegion, id: string): { have: number; whole: boolean; all: boolean } | null {
  if (state.shards.includes(id) || !ALL_IDS.includes(id)) return null;
  state.shards.push(id);
  const have = shardsFound(state.shards, region);
  const whole = have === SHARDS_PER_REGION;
  const all = state.shards.length === SHARDS_TOTAL;
  if (whole) {
    const add = Math.min(MAX_HP, state.player.maxHp + STAR_MAX_HP) - state.player.maxHp;
    state.player.maxHp += add;
    state.player.hp += add;
    state.inventory[STAR_MATERIAL[region]] += STAR_MATERIALS;
    addItem(state.inventory, "candy");
  }
  if (all) {
    state.player.atk += STARFALL_ATK;
    state.player.def += STARFALL_DEF;
  }
  return { have, whole, all };
}
