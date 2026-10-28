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
// GOBLIN, NIGHT WISP) already pay out in gold and drop nothing; the forest's
// and the snow field's (SILVER WASP, AURORA MOTH) leave two of their kind's
// material as well, a sure step toward the BLACKSMITH's REFINE. The delivery
// prices (delivery.ts PIECE_GOLD) are worked out from these odds.
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
  silverWasp: { material: "spiderSilk", chance: 1, count: 2 },
  spider: { material: "spiderSilk", chance: 0.3, count: 1 },
  mossGolem: { material: "spiderSilk", chance: 1, count: 3 },
  frostMoth: { material: "frostScale", chance: 0.25, count: 1 },
  auroraMoth: { material: "frostScale", chance: 1, count: 2 },
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

// REFINE: the BLACKSMITH's +1..+5 on the worn weapon or armor, a sink for the
// gold and materials the late game piles up with nothing left to buy (gold
// stops at MAX_GOLD, the forge and the house are one-time). Each level adds
// REFINE_STEP to the piece's ATK (weapon) or DEF (armor), kept per piece.
// The balance sim set the size (bun run sim:battle --refine N; the deep kit
// is --abyss 45 --level 30 --potions 0 --hipotions 10 --talisman --meal def):
// at +5 a Lv30 hero in the forged kit with a WOLF takes the ABYSS's B45
// GLACIER GOLEM from 59% to 80%, and NEW GAME+3 (--forged --ng 3) stays a
// fight, its GLACIER 10% to 26% and its DRAKE 1% to 3%; stacked on a full
// bestiary (+5) and PARTNER (+3), 92%, 50% and 16%. +2 a level made B45 near
// sure (88%) before either bonus. The B50 DRAKE stays at 0% whatever the
// refine (still 0% at +30, and at +5 with both bonuses): that wall is the
// ABYSS's own (abyss.ts).
export type RefineKey = "sword" | "shield" | "ironSword" | "ironShield" | "mythrilSword" | "mythrilShield" | "glacierMail" | "drakeBlade";
export const MAX_REFINE = 5;
export const REFINE_STEP = 1;
// the fee to reach each level, +1 first; the last under MAX_GOLD, so every
// level is one trip's savings at most
export const REFINE_FEES = [500, 1000, 2000, 3500, 5000];
// What each piece is refined with: its tier's region, as the shop and the
// forge send the player there. The top weapons take the volcano's MAGMA CORE
// and, for the last two levels, a DRAKE SCALE; the top armor the snow's.
export const REFINE_MATS: Record<RefineKey, [MaterialKey, MaterialKey]> = {
  sword: ["slimeGel", "batWing"],
  shield: ["slimeGel", "batWing"],
  ironSword: ["wolfFang", "spiderSilk"],
  ironShield: ["wolfFang", "spiderSilk"],
  mythrilSword: ["magmaCore", "drakeScale"],
  mythrilShield: ["frostScale", "yetiFur"],
  drakeBlade: ["magmaCore", "drakeScale"],
  glacierMail: ["frostScale", "yetiFur"],
};
// pieces of each material per level, +1 first: 20 and 9 for a piece's +5.
// A DRAKE SCALE comes one to a FLAME DRAKE (three on the ABYSS's B25), so
// only the last two levels ask for one.
const MAIN_PIECES = [2, 3, 4, 5, 6];
const SECOND_PIECES = [1, 1, 2, 2, 3];
const SCALE_PIECES = [0, 0, 0, 1, 1];

export function isRefinable(key: string | null): key is RefineKey {
  // an own key only: an imported "toString" is `in` every object
  return key !== null && Object.keys(REFINE_MATS).includes(key);
}

/** What taking `key` to refine level `to` (1..MAX_REFINE) costs. */
export function refineCost(key: RefineKey, to: number): { fee: number; needs: Partial<Record<MaterialKey, number>> } {
  const i = to - 1;
  const [main, second] = REFINE_MATS[key];
  const needs: Partial<Record<MaterialKey, number>> = { [main]: MAIN_PIECES[i] };
  const n = second === "drakeScale" ? SCALE_PIECES[i] : SECOND_PIECES[i];
  if (n > 0) needs[second] = n;
  return { fee: REFINE_FEES[i], needs };
}
