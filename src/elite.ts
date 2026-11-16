import type { EnemyDef } from "./monsters";

// ELITES: now and then an ordinary foe of the fields, the cave, the forest,
// the snow or the volcano turns up as a harder one of its kind that pays for
// it. Rolled as the battle starts (BattleScene.init), so the fields'
// encounter rolls know nothing of it.
//
// Rules, and why:
// - Ordinary foes only: no boss or giant (gates and set pieces, tuned as
//   they are), no rare jackpot (its payout already assumes its odds), and
//   not in the ARENA, the TRAINING YARD or the ABYSS, whose depth scaling and
//   cursed chests are its own risk and reward. Nor before the hero's first
//   ELITE_MIN_BATTLES wins: the first fights teach the menu.
// - The species stays what it is: the same name, so the bestiary, the
//   quests' counts, the drop table and every line sized for a name are
//   untouched. The kind shows as a tag in the foe's window and in its colour
//   on the name, and the opening line says what it does.
// - It pays x2.5 gold and EXP and twice the material when one drops. At
//   ELITE_CHANCE that is +12% gold and EXP over a hunt, +8% material, for
//   the 8% of fights that run longer and hit harder.
// - The stats multiply the species' own before night and HARD MODE do
//   (battleRules.scaleEnemy), so those stack as on any foe.
export type EliteKind = "fierce" | "sturdy" | "swift";

interface EliteDef {
  // the window's tag, six glyphs at most (BattleScene's elite tag)
  tag: string;
  color: string;
  // the opening line's second row, after "ELITE: " (13 glyphs at most)
  note: string;
  hp: number;
  atk: number;
  // the chance, each round, of a second action (BattleScene runBattle)
  again: number;
}

export const ELITES: Record<EliteKind, EliteDef> = {
  fierce: { tag: "FIERCE", color: "#fb923c", note: "hits harder", hp: 1.3, atk: 1.5, again: 0 },
  sturdy: { tag: "STURDY", color: "#a3e635", note: "much tougher", hp: 2, atk: 1.2, again: 0 },
  swift: { tag: "SWIFT", color: "#67e8f9", note: "may act twice", hp: 1.3, atk: 1, again: 0.5 },
};

export const ELITE_CHANCE = 0.08;
export const ELITE_MIN_BATTLES = 5;
export const ELITE_LOOT_MULT = 2.5;
export const ELITE_DROP_MULT = 2;

const KINDS = Object.keys(ELITES) as EliteKind[];

/** The elite kind this fight's foe turns up as, or null (nearly always). */
export function rollElite(
  def: Pick<EnemyDef, "boss" | "giant" | "rare">,
  bout: { arena: boolean; practice: boolean; abyss: boolean; battles: number },
  rand: () => number = Math.random,
): EliteKind | null {
  if (def.boss || def.giant || def.rare) return null;
  if (bout.arena || bout.practice || bout.abyss || bout.battles < ELITE_MIN_BATTLES) return null;
  if (rand() >= ELITE_CHANCE) return null;
  return KINDS[Math.floor(rand() * KINDS.length)];
}

/** The species as that elite: its HP and ATK up, its gold and EXP x2.5. */
export function eliteDef<T extends Pick<EnemyDef, "hp" | "atk" | "gold" | "exp">>(def: T, kind: EliteKind): T {
  const e = ELITES[kind];
  return {
    ...def,
    hp: Math.round(def.hp * e.hp),
    atk: Math.round(def.atk * e.atk),
    gold: Math.round(def.gold * ELITE_LOOT_MULT),
    exp: Math.round(def.exp * ELITE_LOOT_MULT),
  };
}

/** Whether a SWIFT foe acts again this round. */
export const actsAgain = (kind: EliteKind | null, rand: () => number = Math.random): boolean =>
  kind !== null && rand() < ELITES[kind].again;
