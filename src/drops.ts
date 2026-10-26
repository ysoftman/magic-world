import { ENEMIES, type EnemyDef } from "./monsters";

// Monster materials: what a won battle can leave behind besides gold and EXP,
// and what the town BLACKSMITH forges gear from. One material per region's
// signature beast, so each recipe sends the player back to where it grows.
export const MATERIAL_KEYS = ["slimeGel", "batWing", "wolfFang", "spiderSilk", "yetiFur", "frostScale", "magmaCore", "drakeScale"] as const;
export type MaterialKey = (typeof MATERIAL_KEYS)[number];

// `from` finishes the item-info line ("NAME: SMITHING, FROM <from>") inside
// its 40 glyphs: the longest, "FROST SCALE: SMITHING, FROM FROST MOTHS", is 39
export const MATERIALS: Record<MaterialKey, { name: string; from: string }> = {
  slimeGel: { name: "SLIME GEL", from: "SLIMES" },
  batWing: { name: "BAT WING", from: "CAVE BATS" },
  wolfFang: { name: "WOLF FANG", from: "WOLVES" },
  spiderSilk: { name: "SPIDER SILK", from: "SPIDERS" },
  yetiFur: { name: "YETI FUR", from: "YETIS" },
  frostScale: { name: "FROST SCALE", from: "FROST MOTHS" },
  magmaCore: { name: "MAGMA CORE", from: "VOLCANO FOES" },
  drakeScale: { name: "DRAKE SCALE", from: "FLAME DRAKE" },
};

export interface Drop {
  material: MaterialKey;
  count: number;
}

// Drop odds per species, keyed like ENEMIES. A regular foe leaves one piece
// 15-30% of the time — about one in four kills, so a recipe's 3-6 pieces of
// a material take some 15-25 fights in its region, roughly a region's worth
// of play rather than a grind. The region's boss (and the town's TROLL KING)
// always drops a handful, so beating it is a real step toward the gear; the
// DRAKE SCALE comes from the FLAME DRAKE alone, which is what holds the best
// weapon back until the last fight. Rare jackpots (GOLDEN SLIME, CURSED
// GOBLIN, NIGHT WISP) already pay out in gold and drop nothing.
const DROP_TABLE: Record<string, { material: MaterialKey; chance: number; count: number }> = {
  slime: { material: "slimeGel", chance: 0.3, count: 1 },
  king: { material: "slimeGel", chance: 1, count: 3 },
  // the cave's GOBLINs and the forest's ORCs carry fang trophies
  goblin: { material: "wolfFang", chance: 0.15, count: 1 },
  bat: { material: "batWing", chance: 0.25, count: 1 },
  wolf: { material: "wolfFang", chance: 0.25, count: 1 },
  troll: { material: "wolfFang", chance: 1, count: 2 },
  orc: { material: "wolfFang", chance: 0.2, count: 1 },
  wasp: { material: "spiderSilk", chance: 0.15, count: 1 },
  spider: { material: "spiderSilk", chance: 0.3, count: 1 },
  mossGolem: { material: "spiderSilk", chance: 1, count: 3 },
  frostMoth: { material: "frostScale", chance: 0.25, count: 1 },
  yeti: { material: "yetiFur", chance: 0.25, count: 1 },
  iceGolem: { material: "frostScale", chance: 1, count: 3 },
  magmaSlime: { material: "magmaCore", chance: 0.2, count: 1 },
  fireImp: { material: "magmaCore", chance: 0.25, count: 1 },
  salamander: { material: "magmaCore", chance: 0.3, count: 1 },
  flameDrake: { material: "drakeScale", chance: 1, count: 1 },
};

// BattleScene works on a copy of the species (night/NG+ rescale it), so the
// name is what still ties a fight back to its ENEMIES entry
const BY_NAME = new Map(Object.entries(ENEMIES).map(([key, def]) => [def.name, DROP_TABLE[key]]));

/**
 * What a won battle against `enemy` leaves, or null. Pure apart from `rand`
 * (Math.random by default), so the odds can be tested. ARENA bouts drop
 * nothing: the gauntlet replays bosses on demand, and their sure drops would
 * turn it into a material farm.
 */
export function rollDrop(enemy: Pick<EnemyDef, "name">, inArena = false, rand: () => number = Math.random): Drop | null {
  if (inArena) return null;
  const entry = BY_NAME.get(enemy.name);
  if (!entry || rand() >= entry.chance) return null;
  return { material: entry.material, count: entry.count };
}

export type CraftedKey = "lifeCharm" | "talisman" | "glacierMail" | "drakeBlade";

export interface Recipe {
  key: CraftedKey;
  name: string;
  fee: number;
  needs: Partial<Record<MaterialKey, number>>;
}

// The BLACKSMITH's list, cheapest first. Each wants the materials of the
// region that unlocks it plus a gold fee in the range of that region's shop
// gear, so a recipe is a goal for the region, not a shortcut past it; what
// each piece does lives in gameState's equipment tables (EQUIP_BONUS etc.).
export const RECIPES: Recipe[] = [
  { key: "lifeCharm", name: "LIFE CHARM", fee: 150, needs: { slimeGel: 6, batWing: 4 } },
  { key: "talisman", name: "TALISMAN", fee: 300, needs: { spiderSilk: 4, frostScale: 3 } },
  { key: "glacierMail", name: "GLACIER MAIL", fee: 400, needs: { yetiFur: 4, frostScale: 3, wolfFang: 4 } },
  { key: "drakeBlade", name: "DRAKE BLADE", fee: 500, needs: { drakeScale: 1, magmaCore: 4, wolfFang: 4 } },
];
