import type { MaterialKey } from "./drops";
import { ELITE_MIN_BATTLES } from "./elite";
import type { KeeperBout } from "./seals";

// NEST: a den in a field where three fights come back to back. Z beside it
// asks once; each fight won, the hero is asked again whether to go on or
// leave with what is banked so far. Nothing mends between them but a win's
// own +5 HP and +2 MP: no walk to a bed, no bag opened in the field (the
// question comes up as the field does). All three won pays the purse and
// NEST_PIECES of the field's material; leaving early pays the smaller purse
// and no material; a fall is any fall. Once a day (econDay), the day spent
// as the hero goes in, so a reload mid-run forfeits it.
//
// What it adds is the choice the single fights lack: HP and MP are the
// stake, and the third foe is the one that takes them.
//
// How it runs, with nothing in the battle scene for it:
// - Each fight is a keeper's bout (seals.ts KeeperBout): the species as an
//   elite with its HP and ATK multiplied first, named in the battle's
//   opening line ("NEST MOTHER rises!"). So each pays an elite's gold and
//   EXP, and counts as an elite felled (feats.ts: the BOUNTY BOARD's FELL AN
//   ELITE can be done here, the price being the run).
// - The run is kept in ui/Nest.ts between the fights, not saved: the field
//   is built again when a fight returns and reads it back, a win being
//   GameState.battles grown or a catch `caught` grown (the seals' way). A
//   fight fled is the run left there, with what was banked. Any other way
//   into the field (a fall and the walk back, the title, a reload) drops it.
// - The arena, the ABYSS and the yard never start one, and nothing of it is
//   read in them.
//
// Numbers (the cave's; sim:battle with the bout's multipliers put on the
// species first, WOLF + SWORD and SHIELD, no potions): max HP lost a fight at
// Lv3, where a hero has the ELITE_MIN_BATTLES wins that open it, is 13%, 34%
// and 51%, 98% in all less the 25% two wins mend: a hero who drinks nothing
// ends near a quarter of its HP on average and falls about one run in five
// (taking each fight's spread as half its mean). At Lv2 it is 21/49/77% and
// mostly lost, at Lv4 7/22/29% and safe: the cave's nest is the cave's.
// Gold: the three fights pay 20 + 22 + 20 as elites, the purse 40 on top, a
// day's 100 G against the ~380 G the cave's hunt makes in a day's 24 minutes
// (ui/Runner.ts's table), and the three BAT WINGs are the prize.
export type NestRegion = "dungeon";

type Cell = readonly [number, number];

export interface NestFight {
  // an ENEMIES key
  enemy: string;
  bout: KeeperBout;
}

export interface NestDef {
  at: Cell;
  fights: readonly [NestFight, NestFight, NestFight];
  // gold banked after each win: the first two are what leaving pays, the
  // third the whole purse
  purse: readonly [number, number, number];
  material: MaterialKey;
}

export const NEST_FIGHTS = 3;
export const NEST_PIECES = 3;
// the fights are elites: not before a hero would meet one (elite.ts)
export const NEST_MIN_BATTLES = ELITE_MIN_BATTLES;

// The cave's stands at the foot of the map past the king's room, on the way
// to nothing else: open floor more than a tile clear of every zone, 180px or
// more from the way in, the chests, the stair, the shrine, the seal's stone
// and plates, the PEDDLER and the star shards, and under no touch disc from
// any cell the hero can stand on. Only two elite kinds, so one run is not
// the ELITE HUNTER trophy.
export const NESTS: Record<NestRegion, NestDef> = {
  dungeon: {
    at: [13, 14],
    fights: [
      { enemy: "bat", bout: { name: "NEST SENTRY", elite: "fierce", hp: 1.3, atk: 1.2 } },
      { enemy: "goblin", bout: { name: "NEST GUARD", elite: "fierce", hp: 1.5, atk: 1.3 } },
      { enemy: "bat", bout: { name: "NEST MOTHER", elite: "sturdy", hp: 2.5, atk: 1.5 } },
    ],
    purse: [10, 25, 40],
    material: "batWing",
  },
};

export const NEST_REGIONS = Object.keys(NESTS) as NestRegion[];

// the day (econDay) each nest was last gone into; a save from before the
// nests has none
export type NestDays = Partial<Record<NestRegion, number>>;

export function loadNestDays(data: unknown): NestDays {
  const days: NestDays = {};
  const raw = (data ?? {}) as Record<string, unknown>;
  for (const region of NEST_REGIONS) {
    const day = raw[region];
    if (typeof day === "number" && Number.isInteger(day)) days[region] = day;
  }
  return days;
}

export const nestSpent = (state: { nestDays: NestDays }, region: NestRegion, day: number): boolean => state.nestDays[region] === day;

/** Whether the hero may go in today: old enough in fights, and not been in. */
export const nestOpen = (state: { nestDays: NestDays; battles: number }, region: NestRegion, day: number): boolean =>
  state.battles >= NEST_MIN_BATTLES && !nestSpent(state, region, day);

interface NestState {
  inventory: Record<MaterialKey, number>;
  gainGold: (n: number) => number;
}

/**
 * The run over with `wins` fights won (left, fled or all three): the gold
 * that fit the purse and the material given, both nothing with no win.
 */
export function payNest(state: NestState, region: NestRegion, wins: number): { gold: number; pieces: number } {
  const def = NESTS[region];
  if (wins <= 0) return { gold: 0, pieces: 0 };
  const gold = state.gainGold(def.purse[Math.min(wins, NEST_FIGHTS) - 1]);
  const pieces = wins >= NEST_FIGHTS ? NEST_PIECES : 0;
  state.inventory[def.material] += pieces;
  return { gold, pieces };
}
