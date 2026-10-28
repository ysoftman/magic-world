import type Phaser from "phaser";
import { ARENA_BOSSES } from "./arena";
import { MAX_GOLD, MAX_LEVEL } from "./config";
import { RECIPES } from "./drops";
import { FAVOR_GIVERS, FAVORS } from "./favors";
import { ALL_FISH, GameState } from "./gameState";
import { MAX_HOUSE } from "./home";
import { FOREST_TREASURE_POS, SNOW_TREASURE_POS, TREASURE_POS, VOLCANO_TREASURE_POS } from "./levels";
import { CATCHABLE } from "./monsters";
import { showToast } from "./pixelart";

// Every chest across the dungeon, forest, snow field and volcano — a new map
// only needs its list added here. treasure-hunter checks each id instead of
// counting openedTreasures, which a chest removed or renamed since an old save
// would pad (and which a missing map here let pass early: the volcano's three
// chests weren't counted, so ten of thirteen was enough).
const ALL_TREASURES = [...TREASURE_POS, ...FOREST_TREASURE_POS, ...SNOW_TREASURE_POS, ...VOLCANO_TREASURE_POS];
export const TOTAL_TREASURES = ALL_TREASURES.length;

// Every species across the town pond and the ice hole, night-only ones
// included — so a new fish only needs a table row in gameState.ts.
export const TOTAL_FISH = ALL_FISH.length;

// ABYSS DIVER's floor: the second GUARDIAN's, so the first has fallen
const ABYSS_DIVER_FLOOR = 10;

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  check: () => boolean;
  // a count toward a target, for the trophy board's "7/10" on a locked row;
  // only where the target is more than 1 (a first catch has no "0/1" worth
  // showing)
  progress?: () => { have: number; need: number };
}

// A count-up achievement: earned once `have` reaches `need`, with the same
// count as its progress, so the check and the board's number can't disagree.
// Where `have` is the state of the moment (the streak for HOT STREAK and
// UNSTOPPABLE, the gold held for GOLDBAG and TYCOON) the number falls again
// on a loss or a spend: those ask for a streak or a purse, not a record.
const atLeast = (have: () => number, need: number): Pick<AchievementDef, "check" | "progress"> => ({
  check: () => have() >= need,
  progress: () => ({ have: have(), need }),
});
// how many of `items` pass `has`, for the collect-them-all ones
const counted =
  <T>(items: readonly T[], has: (item: T) => boolean) =>
  (): number =>
    items.filter(has).length;

// Each check reads live GameState, so claimAchievements() can be called from
// anywhere after a state mutation (battle win, fish catch, chest open) and
// only the ids that newly became true are returned for the caller to toast.
export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first-blood",
    name: "FIRST BLOOD",
    desc: "Win your first battle",
    check: () => GameState.battles >= 1,
  },
  {
    id: "veteran",
    name: "VETERAN",
    desc: "Win 10 battles",
    ...atLeast(() => GameState.battles, 10),
  },
  {
    id: "hot-streak",
    name: "HOT STREAK",
    desc: "Win 3 battles in a row",
    ...atLeast(() => GameState.streak, 3),
  },
  {
    id: "unstoppable",
    name: "UNSTOPPABLE",
    desc: "Win 8 battles in a row",
    ...atLeast(() => GameState.streak, 8),
  },
  {
    id: "angler",
    name: "ANGLER",
    desc: "Catch your first fish",
    check: () => GameState.fishCaught >= 1,
  },
  {
    id: "fishmaster",
    name: "FISHMASTER",
    desc: "Catch 10 fish",
    ...atLeast(() => GameState.fishCaught, 10),
  },
  {
    id: "night-angler",
    name: "NIGHT ANGLER",
    desc: "Land a night-only fish",
    check: () => ALL_FISH.some((f) => f.night && f.name in GameState.fishLog),
  },
  {
    id: "master-angler",
    name: "MASTER ANGLER",
    desc: `Log all ${TOTAL_FISH} kinds of fish`,
    ...atLeast(() => GameState.fishLogged(), TOTAL_FISH),
  },
  {
    id: "farmer",
    name: "FARMER",
    desc: "Harvest your first crop",
    check: () => GameState.cropsHarvested >= 1,
  },
  {
    id: "harvester",
    name: "HARVESTER",
    desc: "Harvest 10 crops",
    ...atLeast(() => GameState.cropsHarvested, 10),
  },
  {
    id: "golden-harvest",
    name: "GOLDEN HARVEST",
    desc: "Reap a golden crop",
    check: () => GameState.goldenHarvests >= 1,
  },
  {
    id: "goldbag",
    name: "GOLDBAG",
    desc: "Hold 100 gold at once",
    ...atLeast(() => GameState.gold, 100),
  },
  {
    id: "treasure-hunter",
    name: "TREASURE HUNTER",
    desc: "Open every treasure chest",
    ...atLeast(
      counted(ALL_TREASURES, (t) => GameState.openedTreasures.includes(t.id)),
      ALL_TREASURES.length,
    ),
  },
  {
    id: "tamed",
    name: "TAMED",
    desc: "Catch your first monster",
    check: () => GameState.caught.length >= 1,
  },
  {
    id: "collector",
    name: "COLLECTOR",
    desc: "Catch every catchable monster",
    ...atLeast(() => GameState.caughtSpecies(), CATCHABLE.length),
  },
  {
    id: "boss-slayer",
    name: "BOSS SLAYER",
    desc: "Defeat the KING SLIME",
    check: () => GameState.quest.bossDefeated,
  },
  {
    id: "golden-hunter",
    name: "GOLDEN HUNTER",
    desc: "Defeat a GOLDEN SLIME",
    check: () => GameState.quest.goldenSlimes >= 1,
  },
  {
    id: "ghost-hunter",
    name: "GHOST HUNTER",
    desc: "Defeat a NIGHT WISP",
    check: () => GameState.quest.wispsDefeated >= 1,
  },
  {
    id: "combo-master",
    name: "COMBO MASTER",
    desc: "Reach an 8-hit combo in one battle",
    check: () => GameState.quest.comboCapped,
  },
  {
    id: "golem-breaker",
    name: "GOLEM BREAKER",
    desc: "Defeat the MOSS GOLEM",
    check: () => GameState.quest.forestBoss,
  },
  {
    id: "legend",
    name: "LEGEND",
    desc: "Reach level 10",
    ...atLeast(() => GameState.player.level, 10),
  },
  {
    id: "ice-breaker",
    name: "ICE BREAKER",
    desc: "Defeat the GLACIER GOLEM",
    check: () => GameState.quest.snowBoss,
  },
  {
    id: "drake-slayer",
    name: "DRAKE SLAYER",
    desc: "Defeat the FLAME DRAKE",
    check: () => GameState.quest.volcanoBoss,
  },
  {
    id: "lava-looter",
    name: "LAVA LOOTER",
    desc: "Open every volcano chest",
    ...atLeast(
      counted(VOLCANO_TREASURE_POS, (t) => GameState.openedTreasures.includes(t.id)),
      VOLCANO_TREASURE_POS.length,
    ),
  },
  {
    // a forged piece is never sold or used up, so holding one is having
    // forged it. 29 glyphs, inside AchievementsUI's 34.
    id: "master-smith",
    name: "MASTER SMITH",
    desc: `Forge all ${RECIPES.length} BLACKSMITH pieces`,
    ...atLeast(
      counted(RECIPES, (r) => GameState.inventory[r.key] > 0),
      RECIPES.length,
    ),
  },
  {
    // every boss in one run, so a lineup still missing one (say, a TROLL KING
    // never met) can't earn it early
    id: "champion",
    name: "CHAMPION",
    desc: `Win all ${ARENA_BOSSES.length} ARENA bouts in a row`,
    ...atLeast(() => GameState.arenaBest, ARENA_BOSSES.length),
  },
  {
    // the deepest floor any run reached (abyss.ts), kept through NEW GAME+.
    // 22 glyphs, inside AchievementsUI's 34.
    id: "abyss-diver",
    name: "ABYSS DIVER",
    desc: `Reach B${ABYSS_DIVER_FLOOR} in the ABYSS`,
    ...atLeast(() => GameState.abyssBest, ABYSS_DIVER_FLOOR),
  },
  {
    id: "ascendant",
    name: "ASCENDANT",
    desc: `Reach level ${MAX_LEVEL}`,
    ...atLeast(() => GameState.player.level, MAX_LEVEL),
  },
  {
    id: "tycoon",
    name: "TYCOON",
    desc: `Hold ${MAX_GOLD} gold at once`,
    ...atLeast(() => GameState.gold, MAX_GOLD),
  },
  {
    // NEW GAME+ wipes the quest flags, so volcanoBoss is only true again once
    // the drake falls on the replay. 33 glyphs, inside AchievementsUI's 34.
    id: "encore",
    name: "ENCORE",
    desc: "Beat the FLAME DRAKE in NEW GAME+",
    check: () => GameState.ngPlus >= 1 && GameState.quest.volcanoBoss,
  },
  {
    // every step of the FARMER's, FISHER's and TRAVELER's chains (favors.ts).
    // NEW GAME+ replays them like the HUNTER's jobs; the trophy stays.
    id: "good-neighbor",
    name: "GOOD NEIGHBOR",
    desc: "Finish every townsfolk favor",
    // steps done across the three chains, each capped at its chain's length
    ...atLeast(
      () => FAVOR_GIVERS.reduce((n, k) => n + Math.min(GameState.favors[k].step, FAVORS[k].length), 0),
      FAVOR_GIVERS.reduce((n, k) => n + FAVORS[k].length, 0),
    ),
  },
  {
    // treasure maps dug (treasure.ts); with "10/10" its locked row is 480px,
    // under the 544 of the longest desc
    id: "x-marks-the-spot",
    name: "X MARKS THE SPOT",
    desc: "Dig up 10 treasure maps",
    ...atLeast(() => GameState.mapsDug, 10),
  },
  {
    // meals served at HOME's KITCHEN (ui/Kitchen.ts): ten is 50-70 battles
    // eaten through, a habit rather than a first try
    id: "chef",
    name: "CHEF",
    desc: "Cook 10 meals at HOME",
    ...atLeast(() => GameState.mealsCooked, 10),
  },
  {
    // every extension, built in order (home.ts); "3/3" on the locked row
    id: "homebuilder",
    name: "HOMEBUILDER",
    desc: `Build all ${MAX_HOUSE} HOME extensions`,
    ...atLeast(() => GameState.houseLevel, MAX_HOUSE),
  },
  {
    // one bounty a day: the days gone by are folded into bountiesDone when
    // the board rolls (GameState.rollBountyIfStale), today's counts as soon
    // as it is claimed, so the trophy lands at the board, not a day later
    id: "bounty-hunter",
    name: "BOUNTY HUNTER",
    desc: "Complete 5 daily bounties",
    ...atLeast(() => GameState.bountiesDone + (GameState.bounty?.claimed ? 1 : 0), 5),
  },
  {
    // the board's daily delivery (delivery.ts deliver()), one a day too
    id: "courier",
    name: "COURIER",
    desc: "Make 5 BOUNTY BOARD deliveries",
    ...atLeast(() => GameState.deliveriesDone, 5),
  },
  {
    // the LUCKY WHEEL's top outcome (ui/LuckyWheel.ts), 3-5% a spin
    id: "jackpot",
    name: "JACKPOT",
    desc: "Hit the LUCKY WHEEL's JACKPOT",
    check: () => GameState.jackpots >= 1,
  },
  {
    // 5 is companionBondBonus's cap (gameState.ts): 50 rounds fought beside
    // one species; the locked row shows the best bond so far
    id: "best-friends",
    name: "BEST FRIENDS",
    desc: "Raise a companion's bond to +5",
    ...atLeast(() => Math.max(0, ...Object.keys(GameState.companionBond).map((n) => GameState.companionBondBonus(n))), 5),
  },
];

// Hero looks earned with achievements: art/hero.ts HERO_LOOKS past the first
// BASE_LOOKS open one at each count here, the last once every achievement is
// in. Counted off GameState.achievements (as the trophy board counts them,
// so an id an old save kept for a since-removed entry adds nothing), so the
// save holds nothing new.
export const BASE_LOOKS = 4;
export const LOOK_MILESTONES = [10, 20, 30, ACHIEVEMENTS.length];

export function earnedCount(): number {
  return ACHIEVEMENTS.filter((a) => GameState.achievements.includes(a.id)).length;
}

/** How many achievements HERO_LOOKS[look] takes: 0 for the first four. */
export function lookNeeds(look: number): number {
  return look < BASE_LOOKS ? 0 : (LOOK_MILESTONES[look - BASE_LOOKS] ?? Number.POSITIVE_INFINITY);
}

export function lookUnlocked(look: number): boolean {
  return earnedCount() >= lookNeeds(look);
}

/** The count the next locked look opens at, or undefined once all are open. */
export function nextLookNeeds(): number | undefined {
  const have = earnedCount();
  return LOOK_MILESTONES.find((n) => have < n);
}

// Called after claimAchievements() with what it returned: when the claim
// reached a look's count, says so. Shown after the achievement's own toast,
// as the queue keeps news ("!") in order. 37 glyphs at retroStyle(5), 740px.
export function announceLooks(scene: Phaser.Scene, earned: readonly string[], y: number): void {
  const have = earnedCount();
  if (LOOK_MILESTONES.some((n) => have >= n && have - earned.length < n)) showToast(scene, "NEW LOOK UNLOCKED: TRY IT ON AT HOME!", y);
}

// Returns the ids of achievements that the current state newly satisfies.
export function claimAchievements(): string[] {
  const earned: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (GameState.achievements.includes(a.id)) continue;
    if (a.check()) {
      GameState.achievements.push(a.id);
      earned.push(a.id);
    }
  }
  return earned;
}
