// A won fight's settling, the one place it is worked out: BattleScene's
// victory() says what it returns, and an overrun (overrun.ts) pays a share of
// it from the field with no battle at all. No Phaser in here: the sim and the
// field's check load it bare.
import { type AbyssBout, abyssDropMult } from "./abyss";
import { BOSS_LOOT, FIELD_LOOT, STREAK_CAP, STREAK_MIN } from "./battleRules";
import { MAX_HP, MAX_LEVEL, MAX_MP } from "./config";
import type { MealDef } from "./cooking";
import { MATERIALS, rollDrop } from "./drops";
import { ELITE_DROP_MULT, type EliteKind } from "./elite";
import { noteWin } from "./feats";
import { econDay, expToNext, GameState } from "./gameState";
import { ENEMIES, type EnemyDef } from "./monsters";
import { nestFightOn } from "./nest";
import { omenGold } from "./omen";
import { recordRank } from "./ranking";
import { relicWinHeal } from "./relics";
import type { BlessingDef } from "./shrine";

export interface Win {
  /** the foe as the fight met it (battleRules scaleEnemy) */
  enemy: Pick<EnemyDef, "name" | "gold" | "exp" | "boss" | "giant">;
  /** a field boss or the TROLL KING met again: no streak bonus, no meal's gold, no sure HI-POTION */
  rematch: boolean;
  abyss: AbyssBout | null;
  elite: EliteKind | null;
  /** what the battle was fought on (their charge taken as it began) */
  meal: MealDef | null;
  blessing: BlessingDef | null;
  weakFinish: boolean;
  /** felled by a LIMIT BREAK's blow */
  limitKill: boolean;
  /**
   * An overrun's share (overrun.ts), under 1: its gold and EXP times this,
   * its loot and material each this likely, and none of the rest a fight
   * ends on (+5 HP, +2 MP, MEND, CALM). A battle leaves it out.
   */
  share?: number;
}

export interface Payout {
  gold: number;
  streakBonus: number;
  exp: number;
  /** "a POTION", "2 SLIME GEL" */
  found: string[];
  /** FISH STEW's HP */
  mealHeal: number;
}

export interface LevelUp {
  from: number;
  level: number;
  /** the rank the new level took on the board, 0 for none */
  rank: number;
}

// A won fight's quest bookkeeping: the ELDER's and HUNTER's counters, the
// achievement tallies, the daily bounty and a story boss's quest flag.
function tallyQuestKill(enemy: Win["enemy"]): void {
  if (enemy.name === "SLIME") GameState.quest.slimes += 1;
  if (enemy.name === "GOLDEN SLIME") GameState.quest.goldenSlimes += 1;
  if (enemy.name === ENEMIES.wisp.name) GameState.quest.wispsDefeated += 1;
  if (enemy.name === "BAT") GameState.quest.batsSlain += 1;
  if (enemy.name === ENEMIES.yeti.name) GameState.quest.yetisSlain += 1;
  // daily bounty board: unbounded like the counters above, only ever
  // compared/clamped at display time. Today's only: a board left unread kept
  // an old bounty filling for days, and paid it whole at the next reading
  if (GameState.bounty?.day === econDay() && enemy.name === GameState.bounty.target) GameState.bounty.have += 1;
  // two story bosses share the `boss` flag; each sets its own quest gate
  if (enemy.boss) {
    if (enemy.name === ENEMIES.mossGolem.name) GameState.quest.forestBoss = true;
    else if (enemy.name === ENEMIES.iceGolem.name) GameState.quest.snowBoss = true;
    else if (enemy.name === ENEMIES.flameDrake.name) GameState.quest.volcanoBoss = true;
    else GameState.quest.bossDefeated = true;
  }
}

/**
 * Pays a won fight into GameState: the streak, the gold, the count of
 * battles, the quest and feat tallies, the rest after it, the loot, the
 * material and the EXP. Levels are settleLevels', after the payout is said.
 */
export function settleWin(win: Win, rand: () => number = Math.random): Payout {
  const { enemy, meal, blessing } = win;
  const share = win.share ?? 1;
  const cut = (n: number): number => (share < 1 && n > 0 ? Math.max(1, Math.round(n * share)) : n);
  GameState.streak += 1;
  // streak bonus rewards pushing on without fleeing; capped so a long run
  // can't outpace the boss/chest economy; a rematch pays neither bonus,
  // as its ARENA bout doesn't (BattleScene init)
  const streakPct = GameState.streak >= STREAK_MIN && !win.rematch ? Math.min(GameState.streak, STREAK_CAP) * 0.1 : 0;
  const streakBonus = cut(Math.floor(enemy.gold * streakPct));
  // PUMPKIN PIE (cooking.ts) adds to the battle's own payout, not the loot
  // ...and so does the field's GOLD RUSH (omen.ts), never the ABYSS's fights
  const mealGold = win.rematch
    ? 0
    : (meal?.effect.gold ?? 0) + (blessing?.effect.gold ?? 0) + GameState.perk("trade") + (win.abyss ? 0 : omenGold());
  const gold = GameState.gainGold(Math.round((cut(enemy.gold) + streakBonus) * (1 + mealGold)));
  GameState.battles += 1;
  // nothing fought in the ABYSS counts toward a quest, the bounty or a
  // boss's flag (abyss.ts)
  if (!win.abyss) tallyQuestKill(enemy);
  noteWin(GameState.feats, win.elite, win.limitKill && !!(enemy.boss || enemy.giant));
  let mealHeal = 0;
  if (share >= 1) {
    // the usual +5 HP and +2 MP, with a relic's share (relics.ts) and MEND's and CALM's (perks.ts)
    const winHeal = 5 + relicWinHeal(win.abyss, GameState.effMaxHp()) + Math.ceil(GameState.effMaxHp() * GameState.perk("mend"));
    GameState.player.hp = Math.min(GameState.effMaxHp(), GameState.player.hp + winHeal);
    GameState.player.mp = Math.min(GameState.player.maxMp, GameState.player.mp + 2 + GameState.perk("calm"));
    // FISH STEW (cooking.ts): a share of max HP back after each win
    mealHeal = Math.min(GameState.effMaxHp() - GameState.player.hp, Math.ceil(GameState.effMaxHp() * (meal?.effect.heal ?? 0)));
    GameState.player.hp += mealHeal;
  }
  // a boss's first kill always leaves a HI-POTION; anything else, a
  // rematch too, rolls FIELD_LOOT
  const roll = rand();
  let edge = 0;
  const rolled =
    enemy.boss && !win.rematch
      ? BOSS_LOOT
      : FIELD_LOOT.find((l) => {
          edge += l.chance;
          return roll < edge;
        });
  const loot = rolled && (share >= 1 || rand() < share) ? rolled : undefined;
  if (loot) GameState.inventory[loot.key] += 1;
  // monster materials for the BLACKSMITH (drops.ts), likelier after a
  // WEAK FINISH, more of them deep in the ABYSS (abyss.ts, at most x3)
  const dropped = rollDrop(enemy, false, rand, win.weakFinish);
  const drop = dropped && (share >= 1 || rand() < share) ? dropped : null;
  if (drop && win.abyss) drop.count *= abyssDropMult(win.abyss.floor);
  // an elite's (elite.ts), never in the ABYSS
  if (drop && win.elite) drop.count *= ELITE_DROP_MULT;
  // the KOI FEAST's doubling (cooking.ts), on top of the depth's
  if (drop) drop.count *= 1 + (meal?.effect.drops ?? 0);
  if (drop) GameState.inventory[drop.material] += drop.count;
  const found = [loot?.name, drop && `${drop.count > 1 ? drop.count : "a"} ${MATERIALS[drop.material].name}`].filter(
    (s): s is string => !!s,
  );
  const expBonus = (meal?.effect.exp ?? 0) + (blessing?.effect.exp ?? 0) + GameState.perk("study");
  const exp = Math.round(cut(enemy.exp) * (1 + expBonus));
  GameState.player.exp += exp;
  return { gold, streakBonus, exp, found, mealHeal };
}

/**
 * The levels the EXP now held buys, each with its stats and a full HP and MP;
 * null for none. In a nest's fight (nest.ts nestFightOn) a level mends HP and
 * MP only by what their maximums grew: the run's stake is the HP it has cost.
 */
export function settleLevels(): LevelUp | null {
  const p = GameState.player;
  const from = p.level;
  const mend = !nestFightOn();
  let rank = 0;
  while (p.level < MAX_LEVEL && p.exp >= expToNext(p.level)) {
    const hpWas = GameState.effMaxHp();
    const mpWas = p.maxMp;
    p.exp -= expToNext(p.level);
    p.level += 1;
    p.maxHp = Math.min(MAX_HP, p.maxHp + 5);
    p.maxMp = Math.min(MAX_MP, p.maxMp + 2);
    p.atk += 1;
    p.def += 1;
    const hpMax = GameState.effMaxHp();
    p.hp = mend ? hpMax : Math.min(hpMax, p.hp + hpMax - hpWas);
    p.mp = mend ? p.maxMp : Math.min(p.maxMp, p.mp + p.maxMp - mpWas);
    const r = recordRank(p.name, p.level);
    if (r > 0) rank = r;
  }
  return p.level > from ? { from, level: p.level, rank } : null;
}
