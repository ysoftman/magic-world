import type { MaterialKey } from "./drops";
import { ELITE_MIN_BATTLES } from "./elite";
import type { KeeperBout } from "./seals";

// NEST: a den in a field where three fights come back to back. Z beside it
// asks once; each fight won, the hero is asked again whether to go on or
// leave with what is banked so far. Nothing mends between them but a win's
// own +5 HP and +2 MP: no walk to a bed, no bag opened in the field (the
// question comes up as the field does), and a level bought in a fight mends
// only what it adds (nestFightOn below). All three won pays the purse and
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
// Numbers. The sizing (sim:battle with the bout's multipliers put on the
// species first, WOLF and the region's intended gear, no potions): the share
// of max HP a fight takes at the level a hero comes to the field with, and
// the sum of the three less what two wins mend (+5 HP each). It took the run
// for a sum, one fight at a time, with no level bought on the way.
//            level, gear              1st  2nd  3rd   sum - mended
//   cave      Lv3, SWORD + SHIELD     13%  34%  51%   98 - 25 = 73%   (Lv2 147, Lv4 58)
//   forest    Lv8, SWORD + IRON SH.   10%  36%  45%   91 - 15 = 76%   (Lv7 129, Lv9 67)
//   snow     Lv13, IRON + IRON        20%  28%  41%   89 - 11 = 78%   (Lv12 105, Lv14 61)
//   volcano  Lv19, MYTHRIL + MYTHRIL   7%  23%  56%   86 -  8 = 78%   (Lv18 103, Lv20 76)
// But the first two fights' EXP (elites, x2.5: 65, 180, 383, 463 against
// 45, 122, 225, 381 to the next level) always buy a level before the third,
// a level up a hero no worse than the sim's (+1 ATK, +1 DEF, +5 max HP), so
// the runs measured in the game (headless, that hero and gear, exp 0 into
// its level, FIGHT / HEAL under 35% / DEFEND a CHG / the weakness spell, no
// LIMIT or PARRY, 10 runs a field) fall short of the sum. With the level's
// mend kept to what it adds (2026-11):
//            cleared  HP into the 3rd   lowest in the 3rd    HP left
//   cave      10/10     81% (min 60)      51% (min 16)      62% (min 27)
//   forest    10/10     81% (min 70)      40% (min 24)      60% (min 49)
//   snow      10/10     69% (min 61)      35% (min 26)      53% (min 49)
//   volcano   10/10     85% (min 81)      30% (min 10)      34% (min 14)
// A level under (Lv2, 7, 12, 18, 6 runs each) the same EXP buys it too:
// 6, 6, 6 and 4 of 6 cleared (the two volcano runs lost in the third), HP
// left 47, 61, 52 and 27%. While the level mended to full all 40 above and
// 21 of 21 a level under were cleared. Not the quarter left and one run in
// five lost the sum promised: the third foe would have to take about twice
// its share in the cave, the forest and the snow for that.
// The cave's opens with the ELITE_MIN_BATTLES wins a Lv2-3 hero has.
// Gold: the three fights pay as elites (x2.5 their species': 62, 175, 340 and
// 485 G), the purse on top (40, 120, 300, 340), together about a quarter of
// what the field's hunt makes in a day's 24 minutes (ui/Runner.ts's table:
// 380, 1200, 2590, 3290 G), and the three pieces are the prize.
export type NestRegion = "dungeon" | "forest" | "snow" | "volcano";

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

// Each stands off its field's road, far from the way in: open floor more
// than a tile clear of every zone, 180px or more from the way in, the chests,
// the shrine, the seal's stone and plates, the PEDDLER and the star shards,
// and under no touch disc from any cell the hero can stand on. The cave's is
// at the foot of the map past the king's room, the forest's on the south wall
// under the orcs' camp, the snow field's on the south wall under the golem's
// basin (more than both talks' reach from the shrine, as the seal is), the
// volcano's in the pocket on the west wall. Only two elite kinds in each, so
// one run is not the ELITE HUNTER trophy.
const fights = (first: [string, number, number], second: [string, number, number], third: [string, number, number]): NestDef["fights"] => [
  { enemy: first[0], bout: { name: "NEST SENTRY", elite: "fierce", hp: first[1], atk: first[2] } },
  { enemy: second[0], bout: { name: "NEST GUARD", elite: "fierce", hp: second[1], atk: second[2] } },
  { enemy: third[0], bout: { name: "NEST MOTHER", elite: "sturdy", hp: third[1], atk: third[2] } },
];
export const NESTS: Record<NestRegion, NestDef> = {
  dungeon: {
    at: [13, 14],
    fights: fights(["bat", 1.3, 1.2], ["goblin", 1.5, 1.3], ["bat", 2.5, 1.5]),
    purse: [10, 25, 40],
    material: "batWing",
  },
  forest: {
    at: [12, 16],
    fights: fights(["wasp", 1.3, 1.2], ["orc", 1.2, 1.1], ["spider", 2, 1.3]),
    purse: [30, 75, 120],
    material: "spiderSilk",
  },
  snow: {
    at: [12, 14],
    fights: fights(["frostMoth", 1.3, 1.2], ["yeti", 1, 1], ["frostMoth", 2, 1.4]),
    purse: [75, 180, 300],
    material: "frostScale",
  },
  volcano: {
    at: [1, 4],
    fights: fights(["magmaSlime", 1.3, 1.2], ["fireImp", 1.5, 1.3], ["salamander", 2.5, 1.4]),
    purse: [85, 210, 340],
    material: "magmaCore",
  },
};

export const NEST_REGIONS = Object.keys(NESTS) as NestRegion[];

// A run's fight under way: from its start (ui/Nest.ts, as each fight goes
// out) until its battle shuts down, won, fled or fallen, or a field is built
// again. While it is, a level the fight's EXP buys (payout.ts settleLevels)
// raises the stats and the maximum HP and MP but mends HP and MP only by what
// those maximums grew, not to full: nothing mends between the fights but a
// win's +5 HP and +2 MP. The three are elites (x2.5 EXP), and at the level a
// hero walks in with the first two always bought a level, whose full mend
// sent the hero into the third, the hardest, at full HP: 40 runs of 40
// cleared, none lower than 38% HP at the worst moment (2026-11). Not saved:
// a reload ends the run (Nest.ts), and with it this.
let fightOn = false;

export const nestFightOn = (): boolean => fightOn;

export function setNestFight(on: boolean): void {
  fightOn = on;
}

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
