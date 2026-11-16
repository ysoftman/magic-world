import { ELITE_MIN_BATTLES } from "./elite";

// The BOUNTY BOARD's other bounties. Half the days the board asks for kills
// of one species, as it always did (gameState.ts rollBountyIfStale); the
// other half it asks for one of these deeds, each a way to play that nothing
// else in town points at. One a day either way, the same rules: today only,
// paid once at the board, refused whole by a purse too full.
//
// A deed is counted by a counter the game already keeps (or one kept for
// this): the bounty notes where it stood when it was posted (`snap`) and its
// progress is how far it has moved since (bountyProgress). So a deed done
// before the board was read doesn't count, and the fields and the battle
// know nothing of bounties.
//
// What each pays is in kills: a kill bounty is 3-6 kills of one species at
// BOUNTY_MULT its gold, 4.5 kills of the pool's average on average, and a
// deed pays `pay` kills at the pool's average gold (bountyPool, so it grows
// with the regions open). The runner's is the most because the day may not
// offer one (ui/Runner.ts: ~1.4-2.7 an hour and the arrivals' 12%), the
// prayer's the least because its cost is only the shrine's gold, which the
// blessing already repays.
export type BountyKind = "elite" | "parry" | "runner" | "pray";

export interface DeedCounters {
  // feats.ts
  parries: number;
  eliteWins: number;
  // gameState.ts
  prayers: number;
  runnersCaught: number;
  // wins so far, for what a hero can be asked yet
  battles: number;
}

interface DeedDef {
  // the board's and the journal's name for it, in the species' place:
  // "BOUNTY: CATCH A RUNNER" is the journal's widest, 22 of its 23 glyphs
  label: string;
  need: readonly [number, number];
  pay: number;
  // the journal's line under it; with " - 9999G" 37 glyphs at most
  hint: string;
  open: (c: DeedCounters) => boolean;
  count: (c: DeedCounters) => number;
}

export const DEEDS: Record<BountyKind, DeedDef> = {
  // an elite turns up in 8% of the fields' fights once ELITE_MIN_BATTLES are
  // won: one in a day's hunt, most days
  elite: {
    label: "FELL AN ELITE",
    need: [1, 1],
    pay: 5,
    hint: "A FOE WITH A COLORED TAG",
    open: (c) => c.battles >= ELITE_MIN_BATTLES,
    count: (c) => c.eliteWins,
  },
  parry: {
    label: "LAND PARRIES",
    need: [3, 5],
    pay: 4,
    hint: "Z AS A FOE'S BLOW LANDS",
    open: () => true,
    count: (c) => c.parries,
  },
  runner: {
    label: "CATCH A RUNNER",
    need: [1, 1],
    pay: 6,
    hint: "A RARE FOE LOOSE IN A FIELD",
    open: () => true,
    count: (c) => c.runnersCaught,
  },
  pray: {
    label: "SHRINE PRAYER",
    need: [1, 1],
    pay: 3,
    hint: "A SHRINE STANDS IN EACH FIELD",
    open: () => true,
    count: (c) => c.prayers,
  },
};

export const DEED_SHARE = 0.5;

const KINDS = Object.keys(DEEDS) as BountyKind[];

export const isBountyKind = (v: unknown): v is BountyKind => typeof v === "string" && KINDS.includes(v as BountyKind);

/** The deed the board posts today, or null for a kill bounty. */
export function rollDeed(c: DeedCounters, rand: () => number = Math.random): { kind: BountyKind; need: number; snap: number } | null {
  if (rand() >= DEED_SHARE) return null;
  const open = KINDS.filter((k) => DEEDS[k].open(c));
  if (open.length === 0) return null;
  const kind = open[Math.floor(rand() * open.length)];
  const [min, max] = DEEDS[kind].need;
  return { kind, need: min + Math.floor(rand() * (max - min + 1)), snap: DEEDS[kind].count(c) };
}

/** How far a deed bounty has come since it was posted. */
export const deedProgress = (kind: BountyKind, snap: number, c: DeedCounters): number => Math.max(0, DEEDS[kind].count(c) - snap);
