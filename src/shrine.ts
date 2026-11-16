// Shrines: one old stone in each field (the cave, the forest, the snow field,
// the volcano; ui/Shrine.ts draws it and asks). Z by it offers gold for one of
// the two blessings that stone keeps, for the next BLESSING_BATTLES battles.
// A blessing is counted like a meal (cooking.ts): per battle, a charge taken
// as each one starts — won, lost or fled, an ARENA bout or an ABYSS fight
// alike, never a TRAINING YARD round — and one at a time, a new one taking
// the old one's place. It is fought on beside the meal, not instead of it:
// ATK and DEF multiply with the meal's, gold and EXP add to it (BattleScene).
// Each shrine hears one offering a day (econDay).
//
// Why walk to one. The pairs differ by field, so what a hero wants decides
// where they go: STONE before a boss is in the cave or the snow field, LORE
// for a levelling run in the forest or the snow field, GREED and FURY at the
// far ends. And the prices are the field's own (SHRINES), so the cave's GREED
// carried to the volcano pays: +50% of ~65G over six wins is ~195G for 30G,
// once a day and a walk through the cave away (the volcano hunts 150G a
// minute, cooking.ts's sums) — a reason to roam, not an income. Bought where
// it is spent it about breaks even (the volcano's is 200G).
//
// The effects are a meal's size or a little over, and FURY is the one with a
// price past the gold: +20% ATK for -20% DEF, where GRILLED FISH gives +10%
// for nothing. On a mid-game hero (ATK ~30, DEF ~15) that is 6 points out and
// 3 more in from every blow.

export type ShrineRegion = "dungeon" | "forest" | "snow" | "volcano";

export interface BlessingEffect {
  // fractions: +0.2 = +20%, -0.2 = -20%
  atk?: number;
  def?: number;
  exp?: number;
  // of the battle's own payout, as PUMPKIN PIE's (not loot or the bounty)
  gold?: number;
}

export interface BlessingDef {
  // the choice's label, the HUD's and the battle window's tag: 5 glyphs at
  // most (DialogueBox's choices, StatusHud)
  name: string;
  effect: BlessingEffect;
  // the shrine's line for it; 24 glyphs at most (ui/Shrine.ts)
  info: string;
}

export const BLESSINGS = {
  fury: { name: "FURY", effect: { atk: 0.2, def: -0.2 }, info: "ATK +20%, DEF -20%" },
  stone: { name: "STONE", effect: { def: 0.2 }, info: "DEF +20%" },
  greed: { name: "GREED", effect: { gold: 0.5 }, info: "GOLD +50%" },
  lore: { name: "LORE", effect: { exp: 0.3 }, info: "EXP +30%" },
} satisfies Record<string, BlessingDef>;

export type BlessingKey = keyof typeof BLESSINGS;

export const BLESSING_BATTLES = 6;

export interface ShrineDef {
  // the offering, in gold
  cost: number;
  // the two it keeps: all a touch question holds (DialogueBox)
  offers: readonly [BlessingKey, BlessingKey];
}

export const SHRINES: Record<ShrineRegion, ShrineDef> = {
  dungeon: { cost: 30, offers: ["stone", "greed"] },
  forest: { cost: 60, offers: ["fury", "lore"] },
  snow: { cost: 120, offers: ["stone", "lore"] },
  volcano: { cost: 200, offers: ["fury", "greed"] },
};

const SHRINE_REGIONS = Object.keys(SHRINES) as ShrineRegion[];

export interface Blessing {
  key: BlessingKey;
  // battles still to come, this one included while it is being fought
  left: number;
}

// the econDay() each shrine last heard an offering on
export type ShrineDays = Partial<Record<ShrineRegion, number>>;

interface ShrineState {
  gold: number;
  blessing: Blessing | null;
  shrineDays: ShrineDays;
}

// A save from before the shrines has no blessing; one that names none of
// them or has no battles left is dropped
export function loadBlessing(data: unknown): Blessing | null {
  const b = data as { key?: unknown; left?: unknown } | null;
  // an own key only: an imported "toString" is `in` every object
  if (!b || typeof b.key !== "string" || !Object.keys(BLESSINGS).includes(b.key)) return null;
  if (typeof b.left !== "number" || !Number.isInteger(b.left) || b.left < 1) return null;
  return { key: b.key as BlessingKey, left: Math.min(BLESSING_BATTLES, b.left) };
}

// ...and every shrine unvisited; only whole days of the four regions are kept
export function loadShrineDays(data: unknown): ShrineDays {
  const days: ShrineDays = {};
  const raw = (data ?? {}) as Record<string, unknown>;
  for (const region of SHRINE_REGIONS) {
    const day = raw[region];
    if (typeof day === "number" && Number.isInteger(day)) days[region] = day;
  }
  return days;
}

// whether `region`'s shrine has had its offering for `day`
export const shrineSpent = (state: { shrineDays: ShrineDays }, region: ShrineRegion, day: number): boolean =>
  state.shrineDays[region] === day;

// The offering made: the gold taken, the blessing put on for
// BLESSING_BATTLES battles in place of any other, the shrine spent for the
// day. False (and nothing taken) when it is spent already or the gold is
// short.
export function pray(state: ShrineState, region: ShrineRegion, key: BlessingKey, day: number): boolean {
  const { cost, offers } = SHRINES[region];
  if (!offers.includes(key) || shrineSpent(state, region, day) || state.gold < cost) return false;
  state.gold -= cost;
  state.blessing = { key, left: BLESSING_BATTLES };
  state.shrineDays[region] = day;
  return true;
}

// A battle starting: the blessing it is fought on (with this battle counted
// in `left`), and the state's blessing one battle shorter, gone after its
// last. cooking.ts's takeMealCharge, for the blessing.
export function takeBlessingCharge(state: { blessing: Blessing | null }): { def: BlessingDef; left: number } | null {
  const blessing = state.blessing;
  if (!blessing) return null;
  state.blessing = blessing.left > 1 ? { key: blessing.key, left: blessing.left - 1 } : null;
  return { def: BLESSINGS[blessing.key], left: blessing.left };
}
