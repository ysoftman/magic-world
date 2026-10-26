import type { Element } from "./monsters";

// One signature move per catchable species, so the companion you pick
// changes how a fight plays rather than only how hard the follow-up hits.
//
// A companion can't be hurt and acts every round on top of the hero, so a
// skill stays a garnish: it fires a fifth of the time at bond 0, about a
// third at full bond (COMPANION_SKILL_CHANCE), in place of that round's plain
// strike. None can win a fight on its own terms: poison and burn stop at
// 1 HP like the hero's own poison, the turn-stealing web skips bosses and
// giants, and the once-a-battle ones (PILFER, CHILL) then fall back to plain
// strikes. A skill that would do nothing right now (healing a full-HP hero,
// a second poison) isn't rolled, so it never wastes the round.
export type CompanionSkillKind = "heal" | "pilfer" | "drain" | "double" | "strike" | "dot" | "snare" | "guard" | "chill";

export interface CompanionSkill {
  name: string;
  kind: CompanionSkillKind;
  // strike: multiplier on the companion's normal damage roll
  mult?: number;
  // strike: a matching enemy weakness adds the hero spells' x1.5 on top
  element?: Element;
  // strike: rolled against DEF 0
  pierce?: boolean;
  // dot: which damage-over-time it leaves, also its tag on the enemy HP row
  dot?: "PSN" | "BRN";
}

// Keyed by EnemyDef.name, one entry per CATCHABLE species. The bestiary
// prints "COMPANION: <name>  BOND+n  SKILL:<skill>" in 1080px at 24px a
// glyph, i.e. 45 glyphs with 27 fixed, so a species name plus its skill name
// must stay within 18 (FIRE IMP + FIREBALL is the longest at 16).
export const COMPANION_SKILLS: Record<string, CompanionSkill> = {
  SLIME: { name: "GOO HEAL", kind: "heal" },
  GOBLIN: { name: "PILFER", kind: "pilfer" },
  BAT: { name: "BLOOD SIP", kind: "drain" },
  WOLF: { name: "DOUBLE BITE", kind: "double" },
  "TROLL KING": { name: "SMASH", kind: "strike", mult: 1.8 },
  WASP: { name: "VENOM STING", kind: "dot", dot: "PSN" },
  SPIDER: { name: "WEB SNARE", kind: "snare" },
  ORC: { name: "BULWARK", kind: "guard" },
  "FROST MOTH": { name: "CHILL", kind: "chill" },
  YETI: { name: "AVALANCHE", kind: "strike", mult: 1.4, element: "ice" },
  "MAGMA SLIME": { name: "MELT", kind: "strike", pierce: true },
  "FIRE IMP": { name: "FIREBALL", kind: "strike", mult: 1.4, element: "fire" },
  SALAMANDER: { name: "BLAZE", kind: "dot", dot: "BRN" },
};

// 20% at bond 0, +3% per companionBondBonus point (0-5), so 35% at most
export function companionSkillChance(bondBonus: number): number {
  return 0.2 + 0.03 * bondBonus;
}

// GOO HEAL: SLIME's own strike is the weakest in the game (ATK 5), so its
// skill is worth more as a share of the hero's max HP than as damage
export const COMPANION_HEAL_PCT = 0.15;
// DOUBLE BITE: two rolls at 70% each, 1.4x a plain strike on average
export const COMPANION_DOUBLE_MULT = 0.7;
// PILFER: a quarter of the foe's gold, once a battle — under the hero's
// STEAL (40%), which costs the hero's whole turn
export const COMPANION_PILFER_PCT = 0.25;
// VENOM STING / BLAZE: three enemy turns of 5% max HP, stopping at 1 HP —
// 42 HP over the whole of a 280 HP FLAME DRAKE
export const COMPANION_DOT_TURNS = 3;
export const COMPANION_DOT_PCT = 0.05;
// CHILL: the foe's ATK for the rest of the battle, once
export const COMPANION_CHILL_MULT = 0.85;
