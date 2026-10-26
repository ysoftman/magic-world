import type { IngredientKey } from "./cooking";
import type { MaterialKey } from "./drops";

// HOME's extensions, built in order at the HOME panel (ui/HomeUI.ts), each
// for gold and materials, each kept for good (NEW GAME+ included: the house
// is the hero's, not a chapter's). What they do stays off the battle
// numbers: longer meals, a few free ingredients, one warded opening.
//
// What they cost, against what late play earns (the balance sim,
// /tmp/pwcheck/sim report.ts; abyss.ts has its yardstick). Hunting the
// VOLCANO by day pays 8.5-9.0k G an hour without the win streak and
// 15.4-16.2k with it, the ARENA with all five bosses 18-20k, a dive from
// the B11 checkpoint ~1.75x the field (abyss.ts); treasure maps are about
// even on gold (treasure.ts). The three come to 14,000G: ~1.6 hours of
// streakless volcano hunting, ~0.9 with the streak, ~0.75 of the ARENA. A
// real sink once the purse sits at the 9,999 cap with nothing in the shop
// left to buy, and each step alone still under that cap. The sim's heroes
// reach the FLAME DRAKE with 1.3-1.7k G, so none is bought before it. The materials send the hero back through the regions
// once more — the cave and town for the first, the forest for the second,
// the snow field and the volcano for the last — so the house grows with the
// adventure rather than with the purse alone.

export interface HouseStage {
  // 12 glyphs at most (HomeUI's BUILD row)
  name: string;
  cost: number;
  needs: Partial<Record<MaterialKey, number>>;
  // HomeUI's effect line, 32 glyphs at most
  info: string;
}

export const HOUSE_STAGES: readonly HouseStage[] = [
  { name: "HEARTH", cost: 2000, needs: { slimeGel: 4, batWing: 2 }, info: "MEALS LAST 7 BATTLES, NOT 5" },
  { name: "HERB GARDEN", cost: 4000, needs: { spiderSilk: 3, wolfFang: 3 }, info: "2 FREE INGREDIENTS EACH DAY" },
  { name: "FEATHER BEDS", cost: 8000, needs: { yetiFur: 3, magmaCore: 2 }, info: "REST HERE: WARD UP NEXT FIGHT" },
];
export const MAX_HOUSE = HOUSE_STAGES.length;

// the level each extension is in place from
export const HEARTH_LEVEL = 1;
export const GARDEN_LEVEL = 2;
export const BEDS_LEVEL = 3;

// HEARTH: how long a meal lasts (cooking.ts)
export const mealBattles = (level: number): number => (level >= HEARTH_LEVEL ? 7 : 5);

// HERB GARDEN: what the garden gives on the first visit HOME each day (by
// econDay(), the day crops and bounties count in, so x20 time can't speed it
// up): two of the crops, the cheap ones three times as often as the dear
export const GARDEN_YIELD = 2;
const GARDEN_WEIGHTS: ReadonlyArray<[IngredientKey, number]> = [
  ["corn", 3],
  ["bean", 3],
  ["pumpkin", 1],
  ["moonflower", 1],
];
export function gardenPick(rand: () => number = Math.random): IngredientKey {
  let r = rand() * GARDEN_WEIGHTS.reduce((n, [, w]) => n + w, 0);
  for (const [k, w] of GARDEN_WEIGHTS) {
    if (r < w) return k;
    r -= w;
  }
  return "corn";
}

// FEATHER BEDS: a rest at HOME leaves the hero WELL RESTED, and the next
// battle opens with WARD up for this many enemy turns (WARD itself lasts 3)
export const RESTED_WARD_TURNS = 2;

// the house's texture at each level (BootScene bakes house-1..3 beside the
// original "house")
export const houseTexture = (level: number): string => (level <= 0 ? "house" : `house-${Math.min(level, MAX_HOUSE)}`);
