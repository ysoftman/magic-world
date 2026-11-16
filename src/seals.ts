import { MAX_GOLD, MAX_MP } from "./config";
import type { EliteKind } from "./elite";
import { TILE } from "./levels";

// Seals: a field's one puzzle. A red standing stone (the SEAL) keeps
// something shut in, and three rune plates lie about the field. Walking over
// the plates in the right order breaks the seal; a wrong plate puts them all
// out. The stone itself gives the order as a riddle (Z beside it), by what
// each plate lies near, and with three plates there are only six orders to
// try, so nobody is stuck for want of the riddle. Once broken, Z at the stone
// calls its keeper out: one named fight, an elite of the field's jackpot
// species (elite.ts, forced by the fight's start data — the jackpots are
// never elites otherwise). Felled or caught, the keeper is gone for good and
// leaves SEAL_MP max MP and the field's purse, once.
//
// The reward is max MP because nothing else gives it but levels: the star
// shards (shards.ts) give max HP, ATK and DEF, the shrines a few battles'
// blessing. HARD MODE shuts every seal again (GameState.reset), as it
// refills the chests; the MP stays.
//
// The plates' progress is the field's own and is not saved: leaving the
// field, or a fight on the way, puts them out. Three plates are a short
// walk, and a fight between two of them is the puzzle's only real cost.

export type SealRegion = "dungeon";

type Cell = readonly [number, number];

export interface SealDef {
  // the stone
  at: Cell;
  // the plates, each with the riddle's words for where it lies
  plates: readonly [Cell, Cell, Cell];
  // the order to walk them in, as indexes into `plates`
  order: readonly [number, number, number];
  // the stone's riddle, in the order's order; sentence-sized lines
  riddle: readonly string[];
  // the keeper: its name in the field's talk (the battle shows the species
  // and its elite tag), an ENEMIES key and the elite it is fought as
  keeper: string;
  enemy: string;
  elite: EliteKind;
  // the purse it leaves, on top of the fight's own payout
  gold: number;
}

export const SEAL_MP = 3;

// The cave's: the stone stands in the middle hall west of the east pools'
// zone, plate 0 by the north-west pool, 1 before the doorway down to the
// king's room, 2 under the south-east pool. All on open floor more than a
// tile clear of every monster zone and 180px or more from the way in, the
// chests, the shrine, the PEDDLER's place and the star shards.
export const SEALS: Record<SealRegion, SealDef> = {
  dungeon: {
    at: [11, 8],
    plates: [
      [4, 2],
      [9, 8],
      [15, 12],
    ],
    order: [1, 2, 0],
    riddle: [
      "Three runes sleep in this cave.",
      "Wake the one before the king's door first,",
      "then the one under the southern pool,",
      "and last the one by the north-west water.",
    ],
    keeper: "GRUK THE HEXED",
    enemy: "cursedGoblin",
    elite: "fierce",
    gold: 150,
  },
};

export const SEAL_REGIONS = Object.keys(SEALS) as SealRegion[];

export const cellCentre = ([tx, ty]: Cell): { x: number; y: number } => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });

// "open": the plates were walked and the keeper waits; "done": it is gone
export type SealStage = "open" | "done";
export type SealState = Partial<Record<SealRegion, SealStage>>;

// A save from before the seals has every one shut; only the known fields'
// known stages are kept
export function loadSeals(data: unknown): SealState {
  const seals: SealState = {};
  const raw = (data ?? {}) as Record<string, unknown>;
  for (const region of SEAL_REGIONS) {
    const stage = raw[region];
    if (stage === "open" || stage === "done") seals[region] = stage;
  }
  return seals;
}

export const sealsDone = (seals: SealState): number => SEAL_REGIONS.filter((r) => seals[r] === "done").length;

/**
 * The plates' progress as plate `i` is stepped on: `lit` plates walked so
 * far, in order. The next of the order lights it; one already lit changes
 * nothing; any other puts them all out.
 */
export function stepPlate(def: SealDef, lit: number, i: number): number {
  if (def.order.indexOf(i) < lit) return lit;
  return def.order[lit] === i ? lit + 1 : 0;
}

interface KeeperState {
  seals: SealState;
  gold: number;
  player: { mp: number; maxMp: number };
}

// The keeper felled: the seal done, its max MP and purse given. What was
// given, or null when the seal was not open (shut still, or done already).
export function fellKeeper(state: KeeperState, region: SealRegion): { mp: number; gold: number } | null {
  if (state.seals[region] !== "open") return null;
  state.seals[region] = "done";
  const mp = Math.min(MAX_MP, state.player.maxMp + SEAL_MP) - state.player.maxMp;
  state.player.maxMp += mp;
  state.player.mp += mp;
  const gold = Math.min(MAX_GOLD, state.gold + SEALS[region].gold) - state.gold;
  state.gold += gold;
  return { mp, gold };
}
