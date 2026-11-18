import { MAX_HP, MAX_MP } from "./config";

// The BOUNTY BOARD's rank: every bounty finished and every delivery handed in
// is a job, and the jobs done raise the hero's standing with the board, from
// ROOKIE to LEGEND. Each rank is handed over by the board itself, once, with
// a small gain kept for good, and every rank makes the board's bounties pay a
// tenth more.
//
// Why: the board's two daily jobs paid gold and nothing else, so they stopped
// meaning anything where the purse sits at its cap, and once the ELDER's and
// the HUNTER's chains were paid the HUD's slot read QUEST DONE over a journal
// of dailies with nothing to work toward. The rank is what the dailies add up
// to: the slot and the journal count toward the next one.
//
// The jobs are counters the save already kept (bountiesDone, deliveriesDone,
// and today's claimed bounty on top, as the BOUNTY HUNTER trophy counts
// them), so a save from before the ranks has its jobs waiting: the journal
// shows READY and the board hands one rank a talk. All of it stays through
// HARD MODE, like the counters.
//
// The pace: a reward day (econDay, 24 minutes' play) posts one bounty and one
// delivery, and a delivery wants spare materials, so about 1.5 jobs a day.
// SCOUT comes on the second day, LEGEND after some 20 days, about 8 hours.
//
// The gains stay small beside what the fields give (the star shards' max HP
// +20 and ATK/DEF +2, the seals' max MP +17): max HP +5, max MP +5, ATK +3
// and DEF +3 in all, the last two points of each only at LEGEND. The pay is
// the bounties' alone: a delivery at +50% would pay what the PEDDLER's pieces
// cost (peddler.ts sells them at 1.5 of delivery.ts PIECE_GOLD) and turn him
// into a shop to resell from.
export interface BoardRank {
  // 8 glyphs at most: the journal's "BOUNTY RANK: CHAMPION" is 21 of its 23,
  // the board's "RANK UP! YOU ARE NOW A CHAMPION." 32 of the touch row's 42
  name: string;
  // the jobs it is reached at
  jobs: number;
  maxHp?: number;
  maxMp?: number;
  atk?: number;
  def?: number;
}

export const BOARD_RANKS: readonly BoardRank[] = [
  { name: "SCOUT", jobs: 2, maxHp: 5 },
  { name: "RANGER", jobs: 6, maxMp: 5 },
  { name: "VETERAN", jobs: 12, atk: 1 },
  { name: "CHAMPION", jobs: 20, def: 1 },
  { name: "LEGEND", jobs: 30, atk: 2, def: 2 },
];
export const MAX_BOARD_RANK = BOARD_RANKS.length;
// the standing before the first rank
export const ROOKIE = "ROOKIE";
// what each rank adds to a bounty's gold (gameState.ts rollBountyIfStale)
export const BOARD_PAY_STEP = 0.1;

export const boardPay = (rank: number): number => 1 + BOARD_PAY_STEP * Math.min(MAX_BOARD_RANK, Math.max(0, rank));
export const boardRankName = (rank: number): string => (rank <= 0 ? ROOKIE : BOARD_RANKS[Math.min(rank, MAX_BOARD_RANK) - 1].name);

// what the ranks read and write of the game's state
export interface BoardState {
  bountiesDone: number;
  deliveriesDone: number;
  bounty: { claimed: boolean } | null;
  boardRank: number;
  player: { hp: number; maxHp: number; mp: number; maxMp: number; atk: number; def: number };
}

// today's claimed bounty joins bountiesDone only as the day turns
// (rollBountyIfStale), so it is counted here until then
export const boardJobs = (s: BoardState): number => s.bountiesDone + (s.bounty?.claimed ? 1 : 0) + s.deliveriesDone;

// the rank still to come, null at LEGEND
export const nextBoardRank = (s: BoardState): BoardRank | null => BOARD_RANKS[s.boardRank] ?? null;

// the next rank's jobs are done and the board has it to hand over
export function boardRankDue(s: BoardState): boolean {
  const next = nextBoardRank(s);
  return !!next && boardJobs(s) >= next.jobs;
}

// "MAX HP +5", "ATK +2 DEF +2": 13 glyphs at most, so the journal's
// "LEGEND: ATK +2 DEF +2, BOUNTIES +10%" is 36 of its 37
export function boardGift(r: BoardRank): string {
  const parts: string[] = [];
  if (r.maxHp) parts.push(`MAX HP +${r.maxHp}`);
  if (r.maxMp) parts.push(`MAX MP +${r.maxMp}`);
  if (r.atk) parts.push(`ATK +${r.atk}`);
  if (r.def) parts.push(`DEF +${r.def}`);
  return parts.join(" ");
}

// Hands over the next rank if its jobs are done: one rank a call, so a save
// with many jobs behind it is promoted a talk at a time. The gains go onto
// the hero's own figures, as a star's and a perk's do (and fill what they add).
export function takeBoardRank(s: BoardState): BoardRank | null {
  const next = nextBoardRank(s);
  if (!next || boardJobs(s) < next.jobs) return null;
  s.boardRank += 1;
  const hp = Math.min(MAX_HP, s.player.maxHp + (next.maxHp ?? 0)) - s.player.maxHp;
  s.player.maxHp += hp;
  s.player.hp += hp;
  const mp = Math.min(MAX_MP, s.player.maxMp + (next.maxMp ?? 0)) - s.player.maxMp;
  s.player.maxMp += mp;
  s.player.mp += mp;
  s.player.atk += next.atk ?? 0;
  s.player.def += next.def ?? 0;
  return next;
}

// The board's lines once a job is done (a bounty paid, a delivery taken) or
// a rank waits: the promotion, or how far the next rank is. Each at most 42
// glyphs, the touch box's row: "RANK UP! YOU ARE NOW A CHAMPION." 32,
// "ATK +2 DEF +2. BOUNTIES PAY +50%." 33, "CHAMPION IN 10 MORE JOBS." 25.
export function boardRankLines(s: BoardState, promoted: BoardRank | null): string[] {
  if (promoted) {
    return [
      `RANK UP! YOU ARE NOW A ${promoted.name}.`,
      `${boardGift(promoted)}. BOUNTIES PAY +${Math.round((boardPay(s.boardRank) - 1) * 100)}%.`,
    ];
  }
  const next = nextBoardRank(s);
  if (!next) return [];
  const left = next.jobs - boardJobs(s);
  return [`${next.name} IN ${left} MORE JOB${left === 1 ? "" : "S"}.`];
}
