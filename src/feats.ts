// FEATS: the counts behind the trophies of the newer ways to fight
// (achievements.ts): parries landed, a boss finished with a LIMIT BREAK, the
// kinds of elite felled, the most relics one ABYSS dive has held and the
// cursed chests opened. One saved object (GameState.feats), kept through
// HARD MODE like the other records; a save from before it starts at none.
// The shrines and the perks need nothing here: GameState.shrineDays and
// GameState.perks already say which have been visited and taken.
import { ELITES, type EliteKind } from "./elite";

export interface Feats {
  parries: number;
  // bosses and giants felled by a LIMIT BREAK's blow
  limitFinishes: number;
  // the elite kinds beaten or caught, each once
  elites: EliteKind[];
  // ...and every elite beaten or caught (the BOUNTY BOARD's count, bounties.ts)
  eliteWins: number;
  // the most relic stacks held at once in a dive
  relicBest: number;
  cursedOpened: number;
}

export const noFeats = (): Feats => ({ parries: 0, limitFinishes: 0, elites: [], eliteWins: 0, relicBest: 0, cursedOpened: 0 });

const count = (v: unknown): number => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : 0);

export function loadFeats(data: unknown): Feats {
  const raw = (data ?? {}) as Record<string, unknown>;
  const kinds = Object.keys(ELITES) as EliteKind[];
  return {
    parries: count(raw.parries),
    limitFinishes: count(raw.limitFinishes),
    elites: kinds.filter((k) => Array.isArray(raw.elites) && raw.elites.includes(k)),
    eliteWins: count(raw.eliteWins),
    relicBest: count(raw.relicBest),
    cursedOpened: count(raw.cursedOpened),
  };
}

/** A won (or caught) fight: the elite it was, and a boss or giant a LIMIT BREAK finished. */
export function noteWin(feats: Feats, elite: EliteKind | null, limitFinish: boolean): void {
  if (elite && !feats.elites.includes(elite)) feats.elites.push(elite);
  if (elite) feats.eliteWins += 1;
  if (limitFinish) feats.limitFinishes += 1;
}
