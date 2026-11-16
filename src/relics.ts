import type { AbyssBout } from "./abyss";

// RELICS: what makes one ABYSS dive unlike the next. A dive is offered two at
// random when it starts and again every RELIC_EVERY stairs down, and keeps
// one; what it holds lasts for that dive only.
//
// Rules, and why:
// - Held in memory with the run (AbyssScene's `run`), never saved: a dive
//   ends by the stair up, a warp home, a fall, a quit to the title or a
//   reload, and its relics with it. A dive picked up from a portal or a
//   checkpoint is a new dive, so it starts with none — and with the first
//   offer, like any other, so a deep start is never empty-handed. Resting at
//   HOME and coming back by the portal therefore trades the build for the
//   refill, which is the choice a long dive now turns on.
// - Two on offer, not three: a touch question holds two choices (DialogueBox)
//   and one row of text, which is what the names (five glyphs at most) and
//   effects (eleven) are sized for: "AEGIS: WARD 1 TURN. HEART: WIN HEAL 4%."
//   is 39 of its 42 glyphs.
// - The same relic stacks, its step added each time, up to `max`; one at its
//   max is no longer offered. All eight maxed is 22 picks, 44 floors down: an
//   offer with fewer than two left to give is skipped.
// - Only fights begun in the ABYSS read them (every function here takes the
//   bout and is neutral without one), so relics left over from a dive that
//   ended in a fall or a quit can't reach a fight in town; the next dive
//   starts by clearing them.
// - The numbers are a tenth or so a stack, against a floor's +6% to the foes'
//   HP and ATK: three FANGs buy back about five floors of the foes' HP, not
//   the depth cap. PURSE pays past the loot cap (abyss.ts ABYSS_LOOT_CAP) on
//   purpose: it is a pick not spent on staying alive. None of this is in
//   scripts/sim-battle.ts, whose abyss figures are a dive without relics.
export type RelicKey = "fang" | "plate" | "hex" | "aegis" | "heart" | "rune" | "purse" | "cloak";

interface RelicDef {
  name: string;
  // one stack's worth, as the offer words it
  effect: string;
  step: number;
  max: number;
}

export const RELICS: Record<RelicKey, RelicDef> = {
  // the hero's ATK and DEF, on top of the meal's (BattleScene heroAtk/heroDef)
  fang: { name: "FANG", effect: "ATK +10%", step: 0.1, max: 3 },
  plate: { name: "PLATE", effect: "DEF +10%", step: 0.1, max: 3 },
  // off the foe's HP as the fight opens, a GUARDIAN's too
  hex: { name: "HEX", effect: "FOE HP -8%", step: 0.08, max: 3 },
  // WARD up as the fight opens, a turn a stack (the spell's own is three)
  aegis: { name: "AEGIS", effect: "WARD 1 TURN", step: 1, max: 2 },
  // of max HP back after a win, with the usual +5
  heart: { name: "HEART", effect: "WIN HEAL 4%", step: 0.04, max: 3 },
  // MP back as each fight opens
  rune: { name: "RUNE", effect: "FIGHT MP +3", step: 3, max: 3 },
  // on a fight's gold and a chest's
  purse: { name: "PURSE", effect: "GOLD +20%", step: 0.2, max: 3 },
  // off the chance of a fight while walking; roamers still give chase
  cloak: { name: "CLOAK", effect: "AMBUSH -30%", step: 0.3, max: 2 },
};

// an offer when the dive starts, then one every this many stairs down
export const RELIC_EVERY = 2;

const KEYS = Object.keys(RELICS) as RelicKey[];
const held = new Map<RelicKey, number>();

const amount = (key: RelicKey): number => (held.get(key) ?? 0) * RELICS[key].step;

/** A new dive holds nothing. */
export function resetRelics(): void {
  held.clear();
}

export function takeRelic(key: RelicKey): void {
  held.set(key, Math.min(RELICS[key].max, (held.get(key) ?? 0) + 1));
}

/** Two different relics still short of their max, or null with fewer than two left. */
export function rollRelicOffer(rand: () => number = Math.random): [RelicKey, RelicKey] | null {
  const open = KEYS.filter((k) => (held.get(k) ?? 0) < RELICS[k].max);
  if (open.length < 2) return null;
  const first = open.splice(Math.floor(rand() * open.length), 1)[0];
  return [first, open[Math.floor(rand() * open.length)]];
}

/**
 * What the dive holds, for the ABYSS's HUD line: "FANG x2 PLATE", in the
 * order above, "" with none. All eight at their max is 67 glyphs.
 */
export function relicLine(): string {
  return KEYS.flatMap((k) => {
    const n = held.get(k) ?? 0;
    return n === 0 ? [] : [n > 1 ? `${RELICS[k].name} x${n}` : RELICS[k].name];
  }).join(" ");
}

/** How many relics the dive holds, stacks counted (the RELIC HOARDER trophy). */
export const relicTotal = (): number => [...held.values()].reduce((n, v) => n + v, 0);

// the walking-encounter chance and a chest's gold, in the ABYSS itself
export const relicAmbush = (): number => 1 - amount("cloak");
export const relicGold = (): number => 1 + amount("purse");

// BattleScene's hooks: `bout` is its `abyss`, null outside the ABYSS
export const relicAtk = (bout: AbyssBout | null): number => (bout ? 1 + amount("fang") : 1);
export const relicDef = (bout: AbyssBout | null): number => (bout ? 1 + amount("plate") : 1);
export const relicWinHeal = (bout: AbyssBout | null, maxHp: number): number => (bout ? Math.ceil(maxHp * amount("heart")) : 0);

/**
 * As an ABYSS fight opens: HEX off the scaled foe's HP, PURSE on its gold,
 * RUNE's MP to the hero. Returns the turns of WARD AEGIS starts it with.
 */
export function openRelicBout(
  bout: AbyssBout | null,
  enemy: { hp: number; curHp: number; gold: number },
  hero: { mp: number; maxMp: number },
): number {
  if (!bout) return 0;
  enemy.hp = Math.max(1, Math.round(enemy.hp * (1 - amount("hex"))));
  enemy.curHp = enemy.hp;
  enemy.gold = Math.round(enemy.gold * relicGold());
  hero.mp = Math.min(hero.maxMp, hero.mp + amount("rune"));
  return amount("aegis");
}
