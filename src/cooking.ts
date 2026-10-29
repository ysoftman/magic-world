// Cooking at HOME (ui/Kitchen.ts). Every harvest and every catch still pays
// its gold as before and leaves one ingredient on top (ui/Farm.ts,
// ui/Fishing.ts): the crop itself, or a FISH — one kind for every species,
// so the five everyday recipes never wait on a rare bite. The four rare
// bites (isRareFish) leave a RARE FISH as well, for the one dish that does:
// the KOI FEAST, whose doubled material drops feed the BLACKSMITH's REFINE.
// A meal cooked from them lasts MEAL_BATTLES battles, counted per battle
// rather than by the clock, which TIME SPEED would run twenty times as fast.
// One meal at a time; cooking another replaces it. BattleScene takes a
// battle's charge when it starts — won, lost or fled, each ARENA bout and
// each ABYSS fight alike — and applies the meal for that whole battle. An
// ARENA win takes none of the heal, gold, EXP or drops, though: the bout
// pays its own purse (arena.ts).
//
// The effects are kept small: +10% ATK and +15% DEF come to two to four
// points on a mid-game hero, about what two levels or one armour tier give,
// and none of them stops a boss's strike or its rage. PUMPKIN PIE's gold is
// only the battle's own payout (not loot or the bounty), so the farm and pond
// economy sits where it was. In the balance sim (ingredients never run out)
// a meal every fight cuts the hunt to the FLAME DRAKE only from 15.2 to 14.9
// minutes, but it tips the hard fights: NEW GAME+1's DRAKE at the level just
// past the first one (16.5) 74% -> 95%, NEW GAME+3's (Lv30, the forged kit,
// ten HI-POTIONs) 54% -> 77% on BEAN SOUP, 83% with the FEATHER BEDS' WARD
// as well. The best meal is BEAN SOUP for the KING SLIME, GRILLED FISH for
// the MOSS and GLACIER GOLEMs. Kept up every fight (/tmp/pwcheck/econ-sim
// cook-sim.ts: a walk HOME the moment a meal runs out, the farm harvested
// and replanted, the pond fished for what the recipe lacks), those two and
// FISH STEW never lapse: four BEAN plots ripen each trip (42-63 BEANs an hour
// against 32-42 eaten), two FISH are ~18s at the pond. The slow crops cap
// the rest: PUMPKIN PIE is on 26% of fights (43% with the HEARTH, 48% with
// the HERB GARDEN too), MOON TEA on 50/69/73%, KOI FEAST on 56-80% with a
// fifth of the hour spent fishing for its RARE FISH. The real cost is the
// walk: from the volcano a trip every five fights cuts 134 fights an hour to
// ~105 on BEAN SOUP (111 with the HEARTH), more than any meal gives back on
// plain hunting.

export const INGREDIENTS = {
  corn: "CORN",
  bean: "BEAN",
  pumpkin: "PUMPKIN",
  moonflower: "MOONFLOWER",
  fish: "FISH",
  rareFish: "RARE FISH",
} as const;
export type IngredientKey = keyof typeof INGREDIENTS;
export type Pantry = Record<IngredientKey, number>;
// a two-digit count for the kitchen's columns
export const PANTRY_MAX = 99;

export const MEAL_BATTLES = 5;
// with the HOME's HEARTH (home.ts mealBattles)
export const MEAL_BATTLES_MAX = 7;

export interface MealEffect {
  // fractions: +0.1 = +10%
  atk?: number;
  def?: number;
  // of max HP, after each battle won
  heal?: number;
  exp?: number;
  gold?: number;
  // the chance a poison or freeze that lands is shrugged off
  resist?: number;
  // more of the monster material a won battle drops (drops.ts rollDrop),
  // multiplied in with the ABYSS's own depth multiplier
  drops?: number;
}

export interface MealDef {
  name: string;
  // the HUD's and battle window's short name, 5 glyphs at most
  tag: string;
  needs: Partial<Pantry>;
  effect: MealEffect;
  // the kitchen's effect line; 36 glyphs at most (Kitchen.ts)
  info: string;
}

export const MEALS = {
  grilledFish: { name: "GRILLED FISH", tag: "GRILL", needs: { fish: 2 }, effect: { atk: 0.1 }, info: "ATK +10%" },
  beanSoup: { name: "BEAN SOUP", tag: "SOUP", needs: { bean: 2 }, effect: { def: 0.15 }, info: "DEF +15%" },
  fishStew: { name: "FISH STEW", tag: "STEW", needs: { fish: 1, corn: 1 }, effect: { heal: 0.15 }, info: "HEAL 15% HP AFTER EACH WIN" },
  pumpkinPie: {
    name: "PUMPKIN PIE",
    tag: "PIE",
    needs: { pumpkin: 1, bean: 1 },
    effect: { exp: 0.2, gold: 0.1 },
    info: "EXP +20%  GOLD +10%",
  },
  moonTea: { name: "MOON TEA", tag: "TEA", needs: { moonflower: 1 }, effect: { resist: 0.5 }, info: "HALF OF POISON & FREEZE BLOCKED" },
  koiFeast: { name: "KOI FEAST", tag: "FEAST", needs: { rareFish: 1, pumpkin: 1 }, effect: { drops: 1 }, info: "MATERIAL DROPS x2" },
} satisfies Record<string, MealDef>;

export type MealKey = keyof typeof MEALS;
export const MEAL_KEYS = Object.keys(MEALS) as MealKey[];

export interface Meal {
  key: MealKey;
  // battles still to come, this one included while it is being fought
  left: number;
}

export const newPantry = (): Pantry => ({ corn: 0, bean: 0, pumpkin: 0, moonflower: 0, fish: 0, rareFish: 0 });

// The four rare bites, by what makes them rare in gameState.ts's tables: the
// top tier that also gives a potion (GOLDEN FISH, AURORA KOI, 8%) and the
// night-only species (MOON EEL, GHOST ICEFISH)
export const isRareFish = (fish: { bonusItem?: unknown; night?: boolean }): boolean => !!fish.bonusItem || !!fish.night;

// A save from before cooking has no pantry and starts empty, and one from
// before the RARE FISH has none of it; a hand-edited or imported one keeps
// only whole counts, clamped to 0..PANTRY_MAX.
export function loadPantry(data: unknown): Pantry {
  const pantry = newPantry();
  const raw = (data ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(pantry) as IngredientKey[]) {
    const n = raw[key];
    if (typeof n === "number" && Number.isInteger(n)) pantry[key] = Math.min(PANTRY_MAX, Math.max(0, n));
  }
  return pantry;
}

// ...and no meal; one that names no recipe or has no battles left is dropped
export function loadMeal(data: unknown): Meal | null {
  const m = data as { key?: unknown; left?: unknown } | null;
  // an own key only: an imported "toString" is `in` every object
  if (!m || typeof m.key !== "string" || !Object.keys(MEALS).includes(m.key)) return null;
  if (typeof m.left !== "number" || !Number.isInteger(m.left) || m.left < 1) return null;
  return { key: m.key as MealKey, left: Math.min(MEAL_BATTLES_MAX, m.left) };
}

export const needsOf = (def: MealDef): Array<[IngredientKey, number]> => Object.entries(def.needs) as Array<[IngredientKey, number]>;

export const canCook = (pantry: Pantry, key: MealKey): boolean => needsOf(MEALS[key]).every(([k, n]) => pantry[k] >= n);

// takes the ingredients and puts the meal on the table for `battles`
// battles; false (and nothing taken) when the pantry is short
export function cook(state: { pantry: Pantry; meal: Meal | null }, key: MealKey, battles = MEAL_BATTLES): boolean {
  if (!canCook(state.pantry, key)) return false;
  for (const [k, n] of needsOf(MEALS[key])) state.pantry[k] -= n;
  state.meal = { key, left: battles };
  return true;
}

export function addIngredient(pantry: Pantry, key: IngredientKey): void {
  pantry[key] = Math.min(PANTRY_MAX, pantry[key] + 1);
}

// A battle starting: the meal it is fought on (with this battle counted in
// `left`), and the state's meal one battle shorter, gone after its last.
export function takeMealCharge(state: { meal: Meal | null }): { def: MealDef; left: number } | null {
  const meal = state.meal;
  if (!meal) return null;
  state.meal = meal.left > 1 ? { key: meal.key, left: meal.left - 1 } : null;
  return { def: MEALS[meal.key], left: meal.left };
}
