import { MATERIALS, type MaterialKey } from "./drops";
import type { QuestState } from "./gameState";
import {
  ABYSS_STAIRS_POS,
  buildDungeon,
  buildForest,
  buildLevel,
  buildSnow,
  buildVolcano,
  CAVE_POS,
  DUNGEON_ENTRY,
  DUNGEON_ZONES,
  EDITABLE_POS,
  FOREST_ENTRY,
  FOREST_POS,
  FOREST_TREASURE_POS,
  FOREST_ZONES,
  type MonsterZone,
  PLAYER_SPAWN,
  SNOW_ENTRY,
  SNOW_FISH_POS,
  SNOW_POS,
  SNOW_TREASURE_POS,
  SNOW_ZONES,
  SOLID,
  T_PATH,
  T_SCORCH,
  T_SOIL,
  T_TALL,
  TILE,
  TREASURE_POS,
  VOLCANO_ENTRY,
  VOLCANO_POS,
  VOLCANO_TREASURE_POS,
  VOLCANO_ZONES,
  workplaceCells,
} from "./levels";

// Treasure maps: now and then a won battle leaves one (BattleScene), naming a
// region and one cell in it; the item window (I) draws the region with the X,
// and Z on that cell (ui/TreasureDig.ts) digs it up for gold, the region's
// material and, rarely, CANDY or a piece of shop gear.
//
// What it pays, against hunting. A map drops in 1 win of 25 and only while
// fewer than MAX_MAPS are held: at 125-145 wins an hour (the balance sim,
// /tmp/pwcheck/sim report.ts: a fight every ~26s with the encounter waits,
// battle time timed in the live game), ~5 maps an hour, each to an even pick
// of the open regions. A dig pays the middle of its region's range (the
// table below, x the NEW GAME+ loot scale like a battle's gold): ~160G on
// average once all five are open, ~135G with four. Then ~0.8 materials (60%
// of digs find some, 30% of those two pieces), a CANDY 10% and a shop piece
// 4%, a HI-POTION once all four are owned (/tmp/pwcheck/econ-sim
// treasure-sim.ts, 100k digs a region). Each map is a detour from the
// volcano to its cell and back, ~30s on the grids' walk (15s for a volcano
// X, 46s for a snow field one) to ~1 minute: 75-145G not hunted at the
// volcano's 8.5-9.0k G an hour by day without the win streak, 140-260G at
// its 15.4-16.2k with it. Net: +1% to +5% over hunting alone without the
// streak, -3.5% to +1% with it — even on gold; the materials are the real
// draw, a quicker way to a BLACKSMITH recipe than the 15-25 fights drops.ts
// plans on.
// All gold goes through gainGold(), so the gold cap holds.

export type TreasureRegion = "town" | "dungeon" | "forest" | "snow" | "volcano";

export interface TreasureMap {
  region: TreasureRegion;
  tx: number;
  ty: number;
}

export const MAX_MAPS = 3;
export const MAP_DROP_CHANCE = 0.04;
// how close (px, centre to centre) the hero has to stand to dig
export const DIG_RADIUS = 72;
// ...and to see the ground glint over the spot (ui/TreasureDig.ts)
export const HINT_RADIUS = 2 * TILE;

type Point = { x: number; y: number };

interface RegionDef {
  // the item window's name for it; 11 glyphs at most
  name: string;
  grid: () => number[][];
  // where the hero comes in: every spot must be walkable from here
  start: () => Point;
  // landmarks and chests, kept 2 tiles clear
  keep: () => Point[];
  // the ways out (and on the town map, the CAVE), kept 3 tiles clear: an
  // exit's signpost and the forest GUARD stand within that
  exits: () => Point[];
  zones: readonly MonsterZone[];
  // cells solid without being solid tiles (the town keepers' workplaces,
  // levels.ts workplaceCells): walls to the walk from `start` and no spot
  blocked?: () => Array<[number, number]>;
  // a road is no place for buried treasure, except in the cave, whose whole
  // floor is T_PATH
  noRoads: boolean;
  gold: readonly [number, number];
  materials: readonly MaterialKey[];
  open: (q: QuestState) => boolean;
}

export const REGIONS: Record<TreasureRegion, RegionDef> = {
  town: {
    name: "TOWN FIELDS",
    grid: buildLevel,
    start: () => PLAYER_SPAWN,
    keep: () => Object.values(EDITABLE_POS),
    exits: () => [FOREST_POS, SNOW_POS, VOLCANO_POS, CAVE_POS],
    zones: [],
    blocked: workplaceCells,
    noRoads: true,
    gold: [50, 90],
    materials: ["slimeGel"],
    open: () => true,
  },
  dungeon: {
    name: "CAVE",
    grid: buildDungeon,
    start: () => ({ x: DUNGEON_ENTRY.x, y: DUNGEON_ENTRY.y + 2 * TILE }),
    keep: () => [...TREASURE_POS, ABYSS_STAIRS_POS],
    exits: () => [DUNGEON_ENTRY],
    zones: DUNGEON_ZONES,
    noRoads: false,
    gold: [80, 130],
    materials: ["batWing"],
    open: () => true,
  },
  forest: {
    name: "FOREST",
    grid: buildForest,
    start: () => ({ x: FOREST_ENTRY.x, y: FOREST_ENTRY.y + 2 * TILE }),
    keep: () => FOREST_TREASURE_POS,
    exits: () => [FOREST_ENTRY],
    zones: FOREST_ZONES,
    noRoads: true,
    gold: [120, 180],
    materials: ["spiderSilk"],
    open: (q) => q.bossDefeated,
  },
  snow: {
    name: "SNOW FIELD",
    grid: buildSnow,
    start: () => ({ x: SNOW_ENTRY.x, y: SNOW_ENTRY.y + 2 * TILE }),
    keep: () => [...SNOW_TREASURE_POS, SNOW_FISH_POS],
    exits: () => [SNOW_ENTRY],
    zones: SNOW_ZONES,
    noRoads: true,
    gold: [170, 240],
    materials: ["yetiFur", "frostScale"],
    open: (q) => q.forestBoss,
  },
  volcano: {
    name: "VOLCANO",
    grid: buildVolcano,
    start: () => ({ x: VOLCANO_ENTRY.x, y: VOLCANO_ENTRY.y + 2 * TILE }),
    keep: () => VOLCANO_TREASURE_POS,
    exits: () => [VOLCANO_ENTRY],
    zones: VOLCANO_ZONES,
    noRoads: true,
    gold: [230, 320],
    materials: ["magmaCore"],
    open: (q) => q.snowBoss,
  },
};

const REGION_KEYS = Object.keys(REGIONS) as TreasureRegion[];
const UNDIGGABLE = new Set([T_TALL, T_SCORCH, T_SOIL]);
const cellOf = (p: Point): [number, number] => [Math.floor(p.x / TILE), Math.floor(p.y / TILE)];
const within = (p: Point, x: number, y: number, r: number): boolean => {
  const [px, py] = cellOf(p);
  return Math.abs(px - x) <= r && Math.abs(py - y) <= r;
};

/**
 * Every cell a map to `region` may mark: walkable (no solid tile, no
 * keeper's workplace) and reached from where the hero comes in; not tall grass or scorch, tilled soil, a road (but the
 * cave's), nor the map's edge; 2 tiles clear of a monster zone, a landmark or
 * a chest, 3 of an exit; and 3 clear of another map's X in the same region,
 * so two maps never point at the same patch.
 */
export function spotsFor(region: TreasureRegion, taken: readonly TreasureMap[]): Array<[number, number]> {
  const def = REGIONS[region];
  const grid = def.grid();
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const blocked = new Set((def.blocked?.() ?? []).map(([x, y]) => `${x},${y}`));
  const walk = (x: number, y: number): boolean => grid[y]?.[x] !== undefined && !SOLID.has(grid[y][x]) && !blocked.has(`${x},${y}`);
  const [sx, sy] = cellOf(def.start());
  const reached = new Set([`${sx},${sy}`]);
  const queue: Array<[number, number]> = [[sx, sy]];
  while (queue.length > 0) {
    const [x, y] = queue.pop() as [number, number];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const k = `${x + dx},${y + dy}`;
      if (!reached.has(k) && walk(x + dx, y + dy)) {
        reached.add(k);
        queue.push([x + dx, y + dy]);
      }
    }
  }
  const keep = def.keep();
  const exits = def.exits();
  const others = taken.filter((m) => m.region === region);
  const inZone = (x: number, y: number): boolean =>
    def.zones.some(
      (z) => Math.abs(x * TILE + TILE / 2 - z.cx) <= z.w / 2 + 2 * TILE && Math.abs(y * TILE + TILE / 2 - z.cy) <= z.h / 2 + 2 * TILE,
    );
  const out: Array<[number, number]> = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const tile = grid[y][x];
      if (!reached.has(`${x},${y}`) || UNDIGGABLE.has(tile) || (def.noRoads && tile === T_PATH)) continue;
      if (inZone(x, y) || keep.some((p) => within(p, x, y, 2)) || exits.some((p) => within(p, x, y, 3))) continue;
      if (others.some((m) => Math.abs(m.tx - x) <= 3 && Math.abs(m.ty - y) <= 3)) continue;
      out.push([x, y]);
    }
  }
  return out;
}

/**
 * A won battle's roll for a map: none while MAX_MAPS are held, else 1 in 25,
 * to a region the hero can already reach, at a cell picked from spotsFor().
 * Adds it to `maps` and returns it, or null.
 */
export function rollTreasureMap(maps: TreasureMap[], quest: QuestState, rand: () => number = Math.random): TreasureMap | null {
  if (maps.length >= MAX_MAPS || rand() >= MAP_DROP_CHANCE) return null;
  const open = REGION_KEYS.filter((k) => REGIONS[k].open(quest));
  const region = open[Math.floor(rand() * open.length)];
  const spots = spotsFor(region, maps);
  if (spots.length === 0) return null;
  const [tx, ty] = spots[Math.floor(rand() * spots.length)];
  const map = { region, tx, ty };
  maps.push(map);
  return map;
}

/**
 * Moves each held map whose X no longer passes spotsFor() to a cell that
 * does, in the same region and clear of the other maps as a new one would
 * be. The map editor (F2) rewrites the town, and an X it walled in, flooded
 * or paved over could never be dug. Run by every field scene's
 * TreasureDigger, so on ground that is final, edits and all. The new cell is
 * the allowed one nearest the old (straight-line; a tie goes to the first in
 * spotsFor's row order): a hero who saw the X before the edit finds it close
 * by, and as nothing is random a reload before the next save moves the map to
 * the same place again. A map with nowhere left to go (an edit that cut its
 * region off from the way in) keeps its X rather than being lost, and moves
 * once the ground is mended. Returns how many moved.
 */
export function resettleTreasureMaps(maps: TreasureMap[]): number {
  let moved = 0;
  for (const map of maps) {
    const spots = spotsFor(
      map.region,
      maps.filter((m) => m !== map),
    );
    if (spots.length === 0 || spots.some(([x, y]) => x === map.tx && y === map.ty)) continue;
    const away = ([x, y]: [number, number]): number => (x - map.tx) ** 2 + (y - map.ty) ** 2;
    [map.tx, map.ty] = spots.reduce((best, s) => (away(s) < away(best) ? s : best));
    moved++;
  }
  return moved;
}

// shop gear a dig can turn up, first one not yet owned; once all are, a HI-POTION
const GEAR_FINDS = ["sword", "shield", "ironSword", "ironShield"] as const;
const GEAR_NAME: Record<(typeof GEAR_FINDS)[number], string> = {
  sword: "SWORD",
  shield: "SHIELD",
  ironSword: "IRON SWORD",
  ironShield: "IRON SHIELD",
};
const CANDY_CHANCE = 0.1;
const GEAR_CHANCE = 0.04;
const MATERIAL_CHANCE = 0.6;
const SECOND_PIECE_CHANCE = 0.3;

export interface DigState {
  inventory: Record<MaterialKey | (typeof GEAR_FINDS)[number] | "candy" | "hiPotion", number>;
  gainGold(n: number): number;
  enemyScale(): { loot: number };
}

/**
 * Digs up `map`'s chest into `state` and says what came out, as one line for
 * a toast: at most "DUG UP 420G, 2 FROST SCALE & AN IRON SHIELD!" (44 glyphs,
 * NEW GAME+3's x1.75 on the snow field's 240G).
 */
export function digUp(map: TreasureMap, state: DigState, rand: () => number = Math.random): string {
  const def = REGIONS[map.region];
  const [lo, hi] = def.gold;
  const gold = state.gainGold(Math.round((lo + Math.floor(rand() * (hi - lo + 1))) * state.enemyScale().loot));
  const found: string[] = [];
  if (rand() < MATERIAL_CHANCE) {
    const m = def.materials[Math.floor(rand() * def.materials.length)];
    const n = rand() < SECOND_PIECE_CHANCE ? 2 : 1;
    state.inventory[m] += n;
    found.push(`${n} ${MATERIALS[m].name}`);
  }
  const r = rand();
  if (r < GEAR_CHANCE) {
    const gear = GEAR_FINDS.find((k) => state.inventory[k] <= 0);
    if (gear) {
      state.inventory[gear] += 1;
      found.push(`AN ${GEAR_NAME[gear]}`.replace(/^AN (?=[^AEIOU])/, "A "));
    } else {
      state.inventory.hiPotion += 1;
      found.push("A HI-POTION");
    }
  } else if (r < GEAR_CHANCE + CANDY_CHANCE) {
    state.inventory.candy += 1;
    found.push("A CANDY");
  }
  const all = [`${gold}G`, ...found];
  return `DUG UP ${all.length > 1 ? `${all.slice(0, -1).join(", ")} & ${all[all.length - 1]}` : all[0]}!`;
}

// A save from before treasure maps holds none; an imported or hand-edited one
// keeps only well-formed maps to a known region, inside its grid, at most
// MAX_MAPS. The cell itself isn't re-judged here: a later map change
// shouldn't throw one away, and resettleTreasureMaps() moves an X the ground
// no longer allows.
export function loadTreasureMaps(data: unknown): TreasureMap[] {
  if (!Array.isArray(data)) return [];
  const out: TreasureMap[] = [];
  for (const m of data) {
    if (!m || typeof m !== "object") continue;
    const { region, tx, ty } = m as Record<string, unknown>;
    // an own key only: an imported "toString" is `in` every object
    if (typeof region !== "string" || !Object.keys(REGIONS).includes(region)) continue;
    if (!Number.isInteger(tx) || !Number.isInteger(ty)) continue;
    const grid = REGIONS[region as TreasureRegion].grid();
    if ((ty as number) < 0 || (ty as number) >= grid.length || (tx as number) < 0 || (tx as number) >= (grid[0]?.length ?? 0)) continue;
    out.push({ region: region as TreasureRegion, tx: tx as number, ty: ty as number });
    if (out.length === MAX_MAPS) break;
  }
  return out;
}
