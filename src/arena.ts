import { GameState } from "./gameState";
import type { ENEMIES } from "./monsters";

// The town ARENA: every boss the hero has already beaten, back to back, in
// story order. Shared by TownScene (the keeper's offer), BattleScene (the
// bouts) and achievements.ts (CHAMPION), so all three agree on the lineup.
//
// Rules, and why:
// - No running, no stealing, no catching: a fight you can leave or farm
//   isn't a gauntlet, and the TROLL KING (a giant, so normally catchable)
//   must not become a free catch.
// - Items work, and between bouts the hero gets back ARENA_RECOVER_PCT of
//   max HP and MP. Five bosses with nothing back would only reward hoarding
//   potions; a full refill would make it five separate fights.
// - Losing ends the run instead of the usual defeat (half the gold): the
//   hero is carried back out at 1 HP with what the run has won.
// - The prize is ARENA_GOLD_SHARE of each beaten boss's gold (NEW GAME+
//   loot scaling included; no night bonus, as bouts take no night shift —
//   see BattleScene.init), plus ARENA_CLEAR_BONUS of that on a
//   full clear. Each bout's share is paid, and the record and the save
//   written, the moment the bout is won: a run cut short by a closed tab or
//   a reload keeps what it won, as a fall would, and only the clear's bonus
//   waits for the end. Nothing comes of quitting on purpose either — the
//   next run starts over at the first, cheapest bout. The first kills
//   already paid in full and the arena can be run again and again, so it
//   pays a cut: a boss is worth 8-15 field kills. At half, a run paid
//   4-11x hunting the region the hero had reached (~60k G an hour with all
//   five). Measured by the balance sim (/tmp/pwcheck/sim, report.ts and
//   arena2.ts: the game's battle rules, battle time timed in the live game,
//   ~40s a run to walk to the keeper and back), all five beside the volcano
//   by day, Lv20-30: hunting pays 8.5-8.9k G an hour without the win streak
//   and 15.3-16.0k with it — the streak sits at 8+ there (no defeat in
//   3,000 fights in the kit that beat the drake), and it pays on field and
//   ABYSS fights but never here. 0.15 made the run 1.3x the streakless hunt
//   and 0.7x the real one, below late hunting, where 0.1 had been thrown
//   out for landing; 0.25 makes it ~2.2x / ~1.2x (18-20k G an hour), worth
//   a gauntlet that can't be fled. A lone KING beside the forest stays a
//   taste, not a farm: ~0.9x / ~0.5x, the walk outlasting the bout.
// - A boss win here sets no quest flag, ticks no bounty/HUNTER counter and
//   rolls no ending: BattleScene routes arena wins and losses around all of it.
export const ARENA_RECOVER_PCT = 0.2;
export const ARENA_GOLD_SHARE = 0.25;
export const ARENA_CLEAR_BONUS = 0.5;

// How the save knows each one was beaten: the story bosses' quest flags, and
// for the TROLL KING (a roaming giant, no story of its own) the flag a won
// fight against it sets, beaten or caught (BattleScene.victory). It used to
// be a bestiary sighting, so a hero who met it and ran was matched against
// it, and NEW GAME+, which keeps the bestiary but clears the flags, had it in
// the lineup before even the KING SLIME.
export const ARENA_BOSSES: Array<{ key: keyof typeof ENEMIES; beaten: () => boolean }> = [
  { key: "king", beaten: () => GameState.quest.bossDefeated },
  { key: "troll", beaten: () => GameState.quest.trollDefeated },
  { key: "mossGolem", beaten: () => GameState.quest.forestBoss },
  { key: "iceGolem", beaten: () => GameState.quest.snowBoss },
  { key: "flameDrake", beaten: () => GameState.quest.volcanoBoss },
];

// the keeper opens the gates once the KING SLIME — always the first bout — falls
export function arenaOpen(): boolean {
  return GameState.quest.bossDefeated;
}

export function arenaLineup(): string[] {
  return ARENA_BOSSES.filter((b) => b.beaten()).map((b) => b.key);
}

// carried from bout to bout through BattleScene's init data
export interface ArenaRun {
  lineup: string[]; // ENEMIES keys, in fighting order
  round: number; // 0-based index of the bout being fought
  purse: number; // gold won so far, already paid (and saved) bout by bout
  // this run has set a new arenaBest (written bout by bout), for the
  // closing NEW RECORD line
  record?: boolean;
}
