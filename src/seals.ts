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
// leaves SEAL_MP max MP and the field's purse, once; the fourth keeper's
// fall adds ALL_SEALS_MP (+17 max MP in all, a level and a half's worth).
//
// The reward is max MP because nothing else gives it but levels: the star
// shards (shards.ts) give max HP, ATK and DEF, the shrines a few battles'
// blessing. HARD MODE shuts every seal again (GameState.reset), as it
// refills the chests; the MP stays.
//
// The plates' progress is the field's own and is not saved: leaving the
// field, or a fight on the way, puts them out. Three plates are a short
// walk, and a fight between two of them is the puzzle's only real cost.

export type SealRegion = "dungeon" | "forest" | "snow" | "volcano";

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
  bout: KeeperBout;
  // the purse it leaves, on top of the fight's own payout
  gold: number;
}

// How a keeper is fought (the Battle scene's start data): as that elite, with
// its species' HP and ATK multiplied first, before the elite's, the night's
// and HARD MODE's own.
//
// Sized by the balance sim's "first level at 90% wins" (bun run sim:battle
// --foe KEY --elite KIND, the species' HP and ATK scaled by hand; WOLF /
// SOLO), to sit between the field's hardest plain elite and its boss:
//   cave     FIERCE GOBLIN 1/1      GRUK 3/5     KING SLIME 5/6
//   forest   SWIFT ORC 3/4          ZIRR 5/6     MOSS GOLEM 7/8
//   snow     STURDY YETI 7/8        YSKA 10/14   GLACIER GOLEM 12/15
//   volcano  FIERCE SALAMANDER 11/14  MOLG 14/17  FLAME DRAKE 18/23
// As bare elites of their species the four came out at or under the plain
// elite (1/2, 2/3, 6/8, 10/13).
export interface KeeperBout {
  elite: EliteKind;
  hp: number;
  atk: number;
}

/** The species as a keeper's own (BattleScene.init), or as it is with no `bout`. */
export function keeperDef<T extends { hp: number; atk: number }>(def: T, bout?: KeeperBout): T {
  return bout ? { ...def, hp: Math.round(def.hp * bout.hp), atk: Math.round(def.atk * bout.atk) } : def;
}

export const SEAL_MP = 3;
// ...and when the last of the four keepers falls
export const ALL_SEALS_MP = 5;

// Every stone and plate is on open floor the hero can walk to, more than a
// tile clear of every monster zone and 180px or more from the way in, the
// chests, the shrine, the PEDDLER's place and the star shards.
//
// The cave's: the stone stands in the middle hall west of the east pools'
// zone, plate 0 by the north-west pool, 1 before the doorway down to the
// king's room, 2 under the south-east pool.
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
    bout: { elite: "fierce", hp: 2, atk: 1.25 },
    gold: 150,
  },
  // The forest's: the stone west of the road's first bend, plate 0 on the
  // west wall under the pond, 1 where the road ends short of the golem's
  // clearing, 2 under the north wall.
  forest: {
    at: [9, 8],
    plates: [
      [1, 9],
      [17, 10],
      [7, 1],
    ],
    order: [2, 0, 1],
    riddle: [
      "Three runes sleep under these trees.",
      "Wake the one below the north wall first,",
      "then the one on the west wall, past the pond,",
      "and last the one where the road gives out.",
    ],
    keeper: "ZIRR THE SWIFT",
    enemy: "silverWasp",
    bout: { elite: "swift", hp: 2.5, atk: 1.3 },
    gold: 300,
  },
  // The snow field's: the stone west of the golem's basin, plate 0 under the
  // north wall east of the way in, 1 on the west wall above the south-west
  // pond, 2 east of the basin. Clear of the ice hole and the shrine by more
  // than both talks' reach, so the field's own Z never has two answers.
  snow: {
    at: [8, 9],
    plates: [
      [16, 1],
      [1, 9],
      [15, 10],
    ],
    order: [1, 2, 0],
    riddle: [
      "Three runes sleep under this snow.",
      "Wake the one on the west wall first,",
      "then the one east of the golem's hollow,",
      "and last the one below the north wall.",
    ],
    keeper: "YSKA THE PALE",
    enemy: "auroraMoth",
    bout: { elite: "sturdy", hp: 2, atk: 1.25 },
    gold: 600,
  },
  // The volcano's: the stone above the crater's moat east of the bridge,
  // plate 0 west of the bridge, 1 on the east wall over the vent, 2 between
  // the western vents (in the crook of the west pool: a cell south-east, at
  // (4,7), it lay under the touch D-pad on the way in).
  volcano: {
    at: [14, 9],
    plates: [
      [9, 8],
      [22, 5],
      [3, 6],
    ],
    order: [2, 1, 0],
    riddle: [
      "Three runes sleep in this ash.",
      "Wake the one between the western vents first,",
      "then the one on the east wall, over the lava,",
      "and last the one before the crater's bridge.",
    ],
    keeper: "MOLG THE GILDED",
    enemy: "gildedImp",
    bout: { elite: "fierce", hp: 1.5, atk: 1.15 },
    gold: 900,
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

// The keeper felled: the seal done, its max MP and purse given, and the last
// of the four's ALL_SEALS_MP on top (`all`). What was given, or null when the
// seal was not open (shut still, or done already).
export function fellKeeper(state: KeeperState, region: SealRegion): { mp: number; gold: number; all: boolean } | null {
  if (state.seals[region] !== "open") return null;
  state.seals[region] = "done";
  const all = sealsDone(state.seals) === SEAL_REGIONS.length;
  const mp = Math.min(MAX_MP, state.player.maxMp + SEAL_MP + (all ? ALL_SEALS_MP : 0)) - state.player.maxMp;
  state.player.maxMp += mp;
  state.player.mp += mp;
  const gold = Math.min(MAX_GOLD, state.gold + SEALS[region].gold) - state.gold;
  state.gold += gold;
  return { mp, gold, all };
}
