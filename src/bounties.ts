import type { OmenKind } from "./omen";

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
// offer one (ui/Runner.ts: ~1.4-2.7 an hour and half the arrivals while the
// bounty is up), the prayer's and the LIMIT's the least: one walk to a
// shrine, whose gold the blessing already repays, or one blow.
//
// None pays under the kill bounty's average. At 3-6 the least was two thirds
// of it, and read as a dud beside a kill bounty's best (6 of the dearest
// species, three times the average). With every region open (the pool's
// average 33.3 G): kills 23-720 G, 224 on average; deeds 224 (the prayer,
// the LIMIT), 249 (parries, PERFECTs), 274 (an elite), 299 (reactions), 349
// (a runner). Each region's opening scales both alike (the average is 9.3,
// 15.3, 22.8, 33.3 G).
// The board's rank adds a tenth to both for each rank handed over
// (boardRank.ts boardPay): these figures are a ROOKIE's.
//
// Three are counted inside the battle (feats.ts, one line each in
// BattleScene): PERFECTs, reactions and a foe finished by the LIMIT BREAK.
// - PERFECT HITS asks for more than LAND PARRIES at the same pay: every
//   FIGHT is a try and a miss costs nothing, where a parry waits on the foe.
// - REACTIONS pays most of the three: each wants a status on the foe first
//   and the element that answers it, two casts' MP and a foe that lives to
//   the second. It is posted from REACTION_MIN_LEVEL, where the hero can
//   make one alone (THORNS' poison, then FIRE: DETONATE).
// - LIMIT FINISH pays least of the three: a full gauge fells most of a field's foes in
//   one blow, so its cost is the gauge, three or four fights' filling
//   (limit.ts). Posted once LIMIT_MIN_BATTLES are won, when one has filled.
export type BountyKind = "elite" | "parry" | "runner" | "pray" | "perfect" | "react" | "limit";

// THORNS' learnLevel (battleRules.ts SKILLS); FIRE is known from the start
const REACTION_MIN_LEVEL = 4;
const LIMIT_MIN_BATTLES = 5;

export interface DeedCounters {
  // feats.ts
  parries: number;
  eliteWins: number;
  perfects: number;
  reactions: number;
  limitKills: number;
  // gameState.ts
  prayers: number;
  runnersCaught: number;
  // open fields whose shrine has not had today's offering
  shrinesLeft: number;
  // wins so far, the hero's level and whether elites turn up yet
  // (fieldGates.ts), for what a hero can be asked yet
  battles: number;
  level: number;
  elites: boolean;
}

interface DeedDef {
  // the board's and the journal's name for it, in the species' place:
  // "BOUNTY: CATCH A RUNNER" is the journal's widest, 22 of its 23 glyphs.
  // At 12 or under the board's "BOUNTY: <label> 0/9 REWARD: 999 GOLD." is
  // one touch row (42); the two of 13 and 14 wrap onto a second
  label: string;
  need: readonly [number, number];
  pay: number;
  // the journal's line under it; with " - 9999G" 37 glyphs at most
  hint: string;
  open: (c: DeedCounters) => boolean;
  count: (c: DeedCounters) => number;
}

export const DEEDS: Record<BountyKind, DeedDef> = {
  // an elite turns up in 8% of the fields' fights once the KING SLIME has
  // fallen (fieldGates.ts): one in a day's hunt, most days
  elite: {
    label: "FELL AN ELITE",
    need: [1, 1],
    pay: 5.5,
    hint: "A FOE WITH A COLORED TAG",
    open: (c) => c.elites,
    count: (c) => c.eliteWins,
  },
  parry: {
    label: "LAND PARRIES",
    need: [3, 5],
    pay: 5,
    hint: "Z AS A FOE'S BLOW LANDS",
    open: () => true,
    count: (c) => c.parries,
  },
  runner: {
    label: "CATCH A RUNNER",
    need: [1, 1],
    pay: 7,
    hint: "A RARE FOE LOOSE IN A FIELD",
    open: () => true,
    count: (c) => c.runnersCaught,
  },
  pray: {
    label: "SHRINE PRAYER",
    need: [1, 1],
    pay: 4.5,
    hint: "A SHRINE STANDS IN EACH FIELD",
    // each shrine takes one offering a day: with every open one prayed at
    // before the board was read, the day had no prayer left to count
    open: (c) => c.shrinesLeft > 0,
    count: (c) => c.prayers,
  },
  perfect: {
    label: "PERFECT HITS",
    need: [5, 8],
    pay: 5,
    hint: "Z AS YOUR OWN BLOW LANDS",
    open: () => true,
    count: (c) => c.perfects,
  },
  react: {
    label: "REACTIONS",
    need: [2, 3],
    pay: 6,
    hint: "FIRE ON POISON, ICE ON BURN",
    open: (c) => c.level >= REACTION_MIN_LEVEL,
    count: (c) => c.reactions,
  },
  limit: {
    label: "LIMIT FINISH",
    need: [1, 1],
    pay: 4.5,
    hint: "END A FIGHT WITH L:BREAK",
    open: (c) => c.battles >= LIMIT_MIN_BATTLES,
    count: (c) => c.limitKills,
  },
};

export const DEED_SHARE = 0.5;

const KINDS = Object.keys(DEEDS) as BountyKind[];

export const isBountyKind = (v: unknown): v is BountyKind => typeof v === "string" && KINDS.includes(v as BountyKind);

// The day's omen (omen.ts) leans the board toward the bounty it suits, so a
// day has one road through it: the WILD HUNT's field is where an elite is
// felled, the CALM DAY's where a runner stands, the HOLY DAY's shrine asks
// half. When the board posts a deed and the omen's is open to this hero, it
// is that one OMEN_FAVOR of the time (else any open one, itself included):
// 29% of such days against the 7% of one deed in seven. A GOLD RUSH leans a
// kill bounty toward its field's species the same way (gameState
// rollBountyIfStale). The board says so under the bounty ("THE OMEN FAVORS
// IT."), from the bounty and the day alone: nothing more is saved.
export const OMEN_FAVOR = 0.5;
export const OMEN_DEED: Partial<Record<OmenKind, BountyKind>> = { wild: "elite", calm: "runner", holy: "pray" };

/** The deed the board posts today, or null for a kill bounty; `favored` is the day's omen's (OMEN_DEED). */
export function rollDeed(
  c: DeedCounters,
  rand: () => number = Math.random,
  favored?: BountyKind,
): { kind: BountyKind; need: number; snap: number } | null {
  if (rand() >= DEED_SHARE) return null;
  const open = KINDS.filter((k) => DEEDS[k].open(c));
  if (open.length === 0) return null;
  const kind = favored && open.includes(favored) && rand() < OMEN_FAVOR ? favored : open[Math.floor(rand() * open.length)];
  const [min, max] = DEEDS[kind].need;
  return { kind, need: min + Math.floor(rand() * (max - min + 1)), snap: DEEDS[kind].count(c) };
}

/** How far a deed bounty has come since it was posted. */
export const deedProgress = (kind: BountyKind, snap: number, c: DeedCounters): number => Math.max(0, DEEDS[kind].count(c) - snap);
