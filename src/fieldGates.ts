import { GameState } from "./gameState";

// What the fields hold besides fights opens one thing at a time, each as a
// boss falls and its region opens, so every region has something new in it:
//
//   from the start      the shrines, ambushes and tempers, the runners
//   3 wins              the STAR SHARDS are told of (they lie there from the
//                       start; the gate is the town's tip and the journal's count)
//   KING SLIME felled   the ELITES and the NESTS      (the forest opens)
//   MOSS GOLEM felled   the SEALS and the PEDDLER     (the snow pass opens)
//   GLACIER GOLEM       the day's OMEN                (the volcano opens)
//
// Once open, open in every field. HARD MODE wipes the boss flags, but only a
// hero who felled them all can start a cycle, so nothing shuts again (as the
// ABYSS's stair, abyss.ts abyssOpen). Nothing is saved for it: a save from
// before the gates opens what its bosses have, and what it had done while
// they were open by wins alone (a seal broken, a nest's day) is kept.
//
// Every gate is asked here: the fields' objects (ui/Seal.ts, ui/Nest.ts,
// ui/Peddler.ts), the rolls (elite.ts, omen.ts, peddler.ts), the BOUNTY
// BOARD's deeds (gameState.ts deedCounters) and the town's tips
// (unlockTips.ts), whose telling the journal's and the fields' lines wait on.
export type FieldSystem = "shards" | "seal" | "elite" | "nest" | "peddler" | "omen";

export interface FieldProgress {
  battles: number;
  ngPlus: number;
  quest: { bossDefeated: boolean; forestBoss: boolean; snowBoss: boolean };
}

export const SHARDS_MIN_BATTLES = 3;

const OPENS: Record<FieldSystem, (s: FieldProgress) => boolean> = {
  shards: (s) => s.battles >= SHARDS_MIN_BATTLES,
  elite: (s) => s.quest.bossDefeated,
  nest: (s) => s.quest.bossDefeated,
  seal: (s) => s.quest.forestBoss,
  peddler: (s) => s.quest.forestBoss,
  omen: (s) => s.quest.snowBoss,
};

/** Whether `system` has opened for this hero (the save in play unless `s` is given). */
export function fieldOpen(system: FieldSystem, s: FieldProgress = GameState): boolean {
  return s.ngPlus > 0 || OPENS[system](s);
}
