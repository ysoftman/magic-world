// OVERRUN: a foe the hero's first FIGHT fells on an average roll, and that could
// barely scratch back, falls where the two meet in the field: no battle
// screen, a share of its payout (payout.ts settleWin). The fight it replaces
// was three keys and some five seconds with nothing to decide. No Phaser in
// here; the field's side is sceneCommon's.
//
// The test is the fight's own arithmetic, not a level gap:
// - the hero's FIGHT on an average roll (battleRules rollDamage at x1.0, no
//   crit, no combo, no PERFECT; the meal's and the blessing's ATK counted as
//   the battle would) takes all the foe's HP as this hour scales it (night,
//   HARD MODE). At the least roll (x0.8) only five species ever qualified,
//   the SLIME from Lv12. At the average the fight skipped is one blow half
//   the time and two the rest, a fight already won either way;
// - the foe's hardest blow (its highest roll, a crit) is at most
//   OVERRUN_HURT_SHARE of the hero's max HP.
// Only an ordinary species met in the open: never a boss, a giant or a rare
// one (so no runner, no seal's keeper), nor the ARENA, the ABYSS or the yard,
// which never ask. An elite is rolled first (elite.ts, the battle's own
// roll) and is always fought, so elites turn up as often as before and the
// ELITE bounty and trophies lose nothing; the battle is handed the roll.
// A species not yet in the bestiary is fought once. One not yet caught is
// overrun all the same: holding it back while there was CANDY to throw
// (the first rule) held nearly every overrun back, since one kill in seven
// drops a CANDY and the bag is seldom without. Who wants to catch a weak
// one turns OVERRUN off in SETTINGS for it.
//
// What an overrun pays and counts (settleWin's `share`):
// - gold and EXP x OVERRUN_SHARE (the streak's bonus and TRADE/STUDY on
//   top, as in a battle), loot and material each OVERRUN_SHARE as likely;
// - the win streak, the count of battles, the quest and bounty kills: yes;
// - a TREASURE MAP: at OVERRUN_SHARE of its chance;
// - the meal's and the blessing's charge: not spent, and their gold, EXP,
//   drops and heal not paid (their ATK does count toward the test);
// - the +5 HP / +2 MP a won fight rests, MEND, CALM, the LIMIT gauge, the
//   companion's bond: nothing, no fight was fought.
//
// The share, measured (2026-11, the harness's bot): a one-blow fight takes
// 1.8-2.6s from the meeting to the field again with its 3-4 keys pressed
// the moment they can be (about 3s played), then 1.2s of grace; an overrun
// stops nothing (the hero walks on) and leaves 0.6s of cooldown. The grass
// rolls a meeting 6% a second walked, one every ~17s: 0.8 x (17 + 1.2 + 3) /
// (17 + 0.6) = 0.96 of the hour's gold and EXP, 0.92 against the bot. About
// what fighting paid: the time saved is the prize, not the purse. Roamers
// are met far faster (a pack stands a second or two apart), which is why an
// overrun one does not come back until the field is built again (a fight, a
// way out and in): a zone's pack pays once, 15 kills or so, and then it is
// the grass's rate. And a foe that can be overrun is far under the hero (the
// levels in README), so its purse is small change either way.
import { CRIT_MULT, MIN_DAMAGE_SHARE, SKILLS, SPELLS, scaleEnemy } from "./battleRules";
import { MEALS, type MealDef } from "./cooking";
import { type EliteKind, rollElite } from "./elite";
import { GameState, isNight } from "./gameState";
import { ENEMIES, type EnemyDef } from "./monsters";
import { type LevelUp, type Payout, settleLevels, settleWin } from "./payout";
import { perkOpened } from "./perks";
import { BLESSINGS, type BlessingDef } from "./shrine";
import { rollTreasureMap } from "./treasure";

export const OVERRUN_SHARE = 0.8;
export const OVERRUN_HURT_SHARE = 0.1;

type Foe = Pick<EnemyDef, "hp" | "atk" | "def">;

/** Whether a hero of these numbers fells the foe with an average FIGHT and shrugs its hardest blow off. */
export function outmatched(hero: { atk: number; def: number; maxHp: number }, foe: Foe): boolean {
  const dealt = Math.max(Math.ceil(hero.atk * MIN_DAMAGE_SHARE), hero.atk - foe.def);
  if (dealt < foe.hp) return false;
  const most = Math.floor(foe.atk * 1.2);
  const taken = Math.max(Math.ceil(most * MIN_DAMAGE_SHARE), most - hero.def) * CRIT_MULT;
  return taken <= hero.maxHp * OVERRUN_HURT_SHARE;
}

// the hero as a battle starting now would have it (BattleScene heroAtk/heroDef), no charge taken
function heroNow(): { atk: number; def: number; maxHp: number } {
  const meal = (GameState.meal ? (MEALS[GameState.meal.key] as MealDef) : null)?.effect;
  const blessing = (GameState.blessing ? (BLESSINGS[GameState.blessing.key] as BlessingDef) : null)?.effect;
  const with2 = (base: number, a = 0, b = 0): number => Math.round(base * (1 + a) * (1 + b));
  return {
    atk: with2(GameState.effAtk(), meal?.atk, blessing?.atk),
    def: with2(GameState.effDef(), meal?.def, blessing?.def),
    maxHp: GameState.effMaxHp(),
  };
}

export type Meeting =
  /** overrun: `enemy` as scaleEnemy has it now, for settle */
  | { overrun: true; enemy: ReturnType<typeof scaleEnemy> }
  /** fought: the elite roll already made, for the battle to take as its own */
  | { overrun: false; elite: EliteKind | null };

/**
 * What meeting `key` in the field comes to: an overrun, or a fight with the
 * elite roll it was judged on. `on` is the player's setting.
 */
export function meet(key: string, on: boolean, rand: () => number = Math.random): Meeting {
  const def = ENEMIES[key] ?? ENEMIES.slime;
  const elite = rollElite(def, { arena: false, practice: false, abyss: false, battles: GameState.battles }, rand);
  const fight: Meeting = { overrun: false, elite };
  if (!on || elite || def.boss || def.giant || def.rare) return fight;
  if (!GameState.seenMonsters.includes(def.name)) return fight;
  const enemy = scaleEnemy(def, { night: isNight(), arena: false, abyss: null, ng: GameState.enemyScale() });
  return outmatched(heroNow(), enemy) ? { overrun: true, enemy } : fight;
}

export interface Overrun {
  name: string;
  payout: Payout;
  levels: LevelUp | null;
  map: boolean;
}

/** Pays an overrun (meet's `enemy`); the caller saves. */
export function settleOverrun(enemy: ReturnType<typeof scaleEnemy>, rand: () => number = Math.random): Overrun {
  const payout = settleWin(
    {
      enemy,
      rematch: false,
      abyss: null,
      elite: null,
      meal: null,
      blessing: null,
      weakFinish: false,
      limitKill: false,
      share: OVERRUN_SHARE,
    },
    rand,
  );
  const levels = settleLevels();
  const map = rand() < OVERRUN_SHARE && !!rollTreasureMap(GameState.treasureMaps, GameState.quest, rand);
  return { name: enemy.name, payout, levels, map };
}

// a toast's glyphs (retroStyle(5), 20px each) kept inside 1040 of the screen's 1280
const TOAST_GLYPHS = 52;

/**
 * An overrun as the field's toasts say it: a status line (no "!", so it shows
 * at once and a second overrun's replaces it) and the news after it. Longest
 * status with its finds, "OVERRUN MAGMA SLIME: +9999G +9999EXP  +2 ITEMS",
 * is 46 glyphs; the finds are named while the line stays inside TOAST_GLYPHS.
 * "LEVEL UP! LV 30  PERK: SEE THE ELDER!  NEW MOVES" is 47.
 */
export function overrunLines(o: Overrun): { status: string; news: string[] } {
  const base = `OVERRUN ${o.name}: +${o.payout.gold}G +${o.payout.exp}EXP`;
  const named = `${base}  ${o.payout.found.join(", ").toUpperCase()}`;
  const status = o.payout.found.length === 0 ? base : named.length <= TOAST_GLYPHS ? named : `${base}  +${o.payout.found.length} ITEMS`;
  const news: string[] = [];
  if (o.levels) {
    const { from, level } = o.levels;
    const learned = [...SPELLS, ...SKILLS].filter((s) => s.learnLevel > from && s.learnLevel <= level).map((s) => s.name);
    const head = `LEVEL UP! LV ${level}${perkOpened(from, level) ? "  PERK: SEE THE ELDER!" : ""}`;
    const moves = learned.length === 0 ? "" : `  NEW: ${learned.join(", ")}`;
    news.push(head + (moves && (head + moves).length <= TOAST_GLYPHS ? moves : moves ? "  NEW MOVES" : ""));
  }
  if (o.map) news.push("TREASURE MAP FOUND! READ IT IN ITEMS, PAGE 3");
  return { status, news };
}
