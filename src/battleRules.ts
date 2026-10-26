import { ABYSS_GUARDIAN_GOLD_SHARE, type AbyssBout, abyssScale } from "./abyss";
import type { GameState } from "./gameState";
import { type Element, ENEMIES, type EnemyDef } from "./monsters";

// The battle's rules without the battle: every constant, table and formula
// BattleScene plays by that needs no Phaser, so the balance sim (outside the
// repo) can import the game's own numbers and maths instead of copying them.
// BattleScene keeps the turn order, the timing and everything drawn; what
// it rolls and how it scales the foe come from here.

export const CRIT_CHANCE = 0.1;
export const CRIT_MULT = 2;
// an attack spell hitting a species' weakness multiplies its rolled damage
export const WEAKNESS_MULT = 1.5;
export const NIGHT_STAT_MULT = 1.25;
export const NIGHT_LOOT_MULT = 1.5;
export const STREAK_MIN = 3;
// a hit always lands for at least this share of its own roll, whatever the
// target's defense
export const MIN_DAMAGE_SHARE = 0.2;
// how much gold a defeat costs
export const DEATH_GOLD_LOSS = 0.5;
export const STREAK_CAP = 8;
// each consecutive FIGHT adds this much extra damage, so a pure-fight run
// outpaces pausing to heal; items/magic/flee reset it
export const COMBO_PCT = 0.1;
export const COMBO_CAP = 8;
// flat roll, independent of enemy HP — unlike throwCandy's ratio-based
// capture chance, so players can't game it by whittling the enemy down first
export const STEAL_CHANCE = 0.35;
export const STEAL_GOLD_PCT = 0.4;

// Status effects live only inside one battle. Poison ticks a share of max HP
// at the start of each round but stops at 1 HP: it pressures the player into
// curing, it never lands the killing blow on its own.
export const POISON_TURNS = 3;
export const POISON_PCT = 0.06;

// after a frozen turn is spent, this many enemy turns can't freeze again, so
// a lucky roll streak can never lock the player out of acting
export const FREEZE_GRACE_TURNS = 2;

// bosses/giants snap once when they first drop to this share of their HP
export const ENRAGE_HP_SHARE = 0.3;
export const ENRAGE_ATK_MULT = 1.3;

export const REGEN_PCT = 0.12;

// Telegraphed boss attacks: a boss (or the TROLL KING) may spend a turn
// winding up — a warning line and a CHG tag instead of an attack — and the
// next enemy turn lands the strike, so WARD, HEAL or an item has a turn to
// answer it. Tuning knobs for the balance audit:
// - BOSS_TELL_CHANCE: odds an enemy turn turns into a wind-up, once ready.
//   0.5 from the balance audit: at 0.3 only 52-57% of boss fights ever saw
//   a wind-up land as a strike before the boss fell, so the mechanic was
//   often never met; 0.5 makes it 74-80% with win rates unchanged and 1-6
//   points more of max HP lost per fight.
// - BOSS_TELL_COOLDOWN: enemy turns after a strike before the next wind-up,
//   so the frozen turn GLACIER GOLEM's breath can cause is never followed by
//   a fresh wind-up the hero couldn't answer
// - BossTell.mult: the strike's ATK multiplier, applied BEFORE DEF. A late
//   hero's DEF clips ordinary boss hits to the 20% floor, so scaling the hit
//   after DEF would only double a scratch. No crit roll: the telegraph is the
//   big moment. At each boss's intended level and gear (KING Lv6 + SHIELD,
//   TROLL Lv8 + IRON SHIELD, MOSS Lv12 + IRON, GLACIER Lv18 + MYTHRIL, DRAKE
//   Lv24 + MYTHRIL, small bestiary DEF), an unanswered strike costs 13-42% of
//   max HP, and up to 48-58% enraged. Bosses take no night stat bump (see
//   init); only the wild TROLL KING can stack night on enrage (both multiply
//   ATK), which would reach 82% but stops at the cap below. WARD halves that
//   to at most 35%.
// - BOSS_STRIKE_MAX_HP_SHARE: the strike never takes more than this share of
//   max HP before WARD, so from full HP it can't kill, whatever stacks
// Statuses: a boss never starts a wind-up while the hero is frozen; it can't
// be snared or shocked (WEB SNARE and BOLT skip bosses and giants), so no
// strike is ever cancelled; poison/burn still tick on a wind-up turn; CHILL
// (companion or ICE) lowers the ATK the strike multiplies; enraging at the
// start of the strike turn powers the strike up. The ARENA plays it all the
// same.
export const BOSS_TELL_CHANCE = 0.5;
export const BOSS_TELL_COOLDOWN = 2;
export const BOSS_STRIKE_MAX_HP_SHARE = 0.7;

export interface BossTell {
  warn: string; // the wind-up's line, <= 36 glyphs
  strike: string; // the strike's name: "<strike>! 999 damage! (GUARD)" <= 36
  mult: number;
  color: number; // the boss's tint while it winds up
  freezes?: boolean; // the strike also freezes (EMBER RING blocks it)
}

export const BOSS_TELLS: Record<string, BossTell> = {
  [ENEMIES.king.name]: { warn: "KING SLIME puffs up to pounce!", strike: "BODY SLAM", mult: 2.4, color: 0xffd166 },
  [ENEMIES.troll.name]: { warn: "TROLL KING raises its club!", strike: "CLUB SMASH", mult: 2.4, color: 0xfbbf24 },
  [ENEMIES.mossGolem.name]: { warn: "MOSS GOLEM's roots creep closer!", strike: "ROOT CRUSH", mult: 2.6, color: 0x86efac },
  [ENEMIES.iceGolem.name]: { warn: "GLACIER GOLEM draws in frost...", strike: "FROST BREATH", mult: 2.6, color: 0x67e8f9, freezes: true },
  [ENEMIES.flameDrake.name]: { warn: "FLAME DRAKE takes a deep breath...", strike: "INFERNO", mult: 2.8, color: 0xf97316 },
};

// Companion attack power is (species ATK + level/2 + bond) x this. It was
// x1.3, set to give back the double strike the onYoyo bug used to land (see
// companionLunge), and that left a WOLF out-hitting the hero: at each boss's
// intended level and gear (the BOSS_TELLS note) it dealt 46-62% of a boss
// fight's damage, and a boss fell in 4-5 rounds with a companion against
// 8-14 alone. x0.8 makes it 33-46% (a stronger late species, YETI or FIRE
// IMP, 45-59%) and those fights 4-7 rounds — long enough for a wind-up to
// matter — with 21-39% of max HP lost instead of 17-35%. x1.0 still left
// 41-49%. The KING SLIME and TROLL KING were cut along with it (monsters.ts)
// so a hero without one isn't stuck 9-11 rounds on them. (A Monte Carlo
// battle sim replaying this file's rules, a WOLF at bond 1-5.)
export const COMPANION_ATK_MULT = 0.8;

// WARD halves every enemy hit (crits included, never below 1) for this many
// enemy turns; recasting refreshes rather than stacks
export const WARD_TURNS = 3;
export const WARD_MULT = 0.5;
export const WARD_COLOR = 0x93c5fd;

// What a won ordinary fight leaves (one roll, at most one item; victory()).
// It used to be POTION 30% and HI-POTION 8%, and the stock piled up: the
// balance audit's progression sim (normal WOLF player, ~55 fights by the
// VOLCANO) reached it holding ~20 POTIONs and ~9 HI-POTIONs, ~24 / ~11 by the
// FLAME DRAKE, so the shop's consumables had no buyers. Arrival stock per
// candidate (POTION / HI-POTION, normal and solo alike; 1000 runs):
//   30% / 8% -> 19.7 / 9.4    15% / 4% -> 11.7 / 7.4    12% / 3% -> 10.2 / 6.9
//   10% / 2% ->  9.2 / 6.6     8% / 2% ->  8.2 / 6.6    10% / 0% ->  9.2 / 6.0
// 10% lands at the top of the 6-10 POTION target on purpose: the sim's hero
// never drinks one outside a boss fight, a real player does, mostly in the
// early fights before HEAL (Lv5), and at the KING SLIME it still holds ~6.
// HI-POTION bottoms out near 6 even at 0%, as the bosses' sure drop, the
// YETI bounty's two and the shop top-up carry it; 2% keeps the odd find.
// CANDY and MPOTION are unchanged, and were looked at again: a hero who
// never uses one reaches the VOLCANO (~49 fights in) with ~9 CANDY and ~6
// MPOTION. That CANDY covers the HUNTER's three fire beasts with a few to
// spare (a catch costs ~1.5-2 throws once a foe is under half HP, ~7 above),
// and ~6 MPOTION is ~47 MP, one bar at Lv18 — neither leaves the shop
// without a buyer.
export const FIELD_LOOT: Array<{ key: keyof typeof GameState.inventory; chance: number; name: string }> = [
  { key: "potion", chance: 0.1, name: "a POTION" },
  { key: "candy", chance: 0.15, name: "some CANDY" },
  { key: "mPotion", chance: 0.1, name: "an MPOTION" },
  { key: "hiPotion", chance: 0.02, name: "a HI-POTION" },
];
export const BOSS_LOOT = FIELD_LOOT[3];

// Elemental spells' side effects, so which element you cast matters beyond
// the weakness bonus. Each reuses a companion skill's state and its rules:
// - burn (FIRE, BRN): BLAZE's burn, 5% max HP on each of the next three
//   enemy turns, stopping at 1 HP; it never stacks on or refreshes a PSN/BRN
//   already ticking
// - chill (ICE, CHL): CHILL's ATK x0.85 for the rest of the battle, once
//   (whichever lands first spends it)
// - shock (BOLT): WEB SNARE's lost turn, so never on a boss or giant — which
//   also means it can never cancel a boss's telegraphed strike
// Rolled only when the effect could take, after the damage roll, and applied
// only if the foe survives the hit. Odds double on a weakness, so reading the
// bestiary's hint pays twice. Base odds stay low because the effects are a
// garnish on a damage spell, a bonus that turns up now and then, sized by
// how much each is worth (boss figures from the balance sim, a hero who casts
// the weakness spell whenever MP allows, at each boss's intended level):
// - FIRE 6% (12% weak): a %-of-max-HP burn grows with the foe, and FIRE is
//   the cheapest spell. At 15% (30% weak) the burn added 19-37% to that
//   hero's spell damage on the fire-weak TROLL KING / MOSS GOLEM / GLACIER
//   GOLEM; now 8% / 10% / 17% alone, 6-13% beside a WOLF.
// - ICE 5% (10% weak): once a battle, so with ICE cast all fight long the
//   odds decide how many fights it lands in at all. At 20% (40% weak) it
//   chilled the FLAME DRAKE in 87-96% of fights, a sure ATK x0.85 rather than
//   a lucky one; now 42-48%.
// - BOLT 15% (30% weak): a whole enemy turn, the strongest of the three, but
//   only ever on ordinary foes, which rarely outlast a cast or two.
// Creatures of fire don't burn and creatures of ice don't chill (BURN_PROOF,
// CHILL_PROOF): without that, a 3 MP FIRE's burn on the 280 HP FLAME DRAKE
// would out-damage its ice weakness per MP. Companion skills don't check
// these lists; they predate the spells' effects.
export type SpellEffect = "burn" | "chill" | "shock";
export const SPELL_EFFECT_WEAK_MULT = 2;
export const BURN_PROOF = [ENEMIES.wisp, ENEMIES.magmaSlime, ENEMIES.fireImp, ENEMIES.salamander, ENEMIES.flameDrake].map((e) => e.name);
export const CHILL_PROOF = [ENEMIES.frostMoth, ENEMIES.yeti, ENEMIES.iceGolem].map((e) => e.name);

// Spells are learned automatically at their level gate, so nothing about
// them needs saving: an old save just knows fewer spells until it levels up.
// Each spell's first letter is its hotkey, so a new name must not start with
// another spell's letter or a menu key (A FIGHT, E ITEM, S STEAL) — nor M,
// which mutes, or the item list's H/J/K/L/Z.
export interface Spell {
  name: string;
  cost: number;
  learnLevel: number;
  kind: "attack" | "heal" | "ward";
  power: number;
  color: number;
  element?: Element; // checked against the enemy's weakness for bonus damage
  effect?: { kind: SpellEffect; chance: number }; // see SPELL_EFFECT_WEAK_MULT
  ultimate?: boolean; // the big multi-blast animation instead of one bolt
}

// Max MP is 10 + 2 per level: 44 at Lv18, 56 at Lv24, 68 at Lv30.
// WARD (Lv18) is a boss tool: against everyday foes DEF's damage floor
// already keeps hits small and HEAL's 20 HP for 4 MP is the better buy, but
// an enraged FLAME DRAKE (ATK 25, x1.3 enraged) still lands
// double-digit hits on a Lv18-20 hero, and halving three of those for 6 MP
// beats healing them back.
// NOVA (Lv24) has no element, so no weakness bonus: 60-89 damage, which
// fells a MAGMA SLIME (60) or, mostly, a FIRE IMP (66) in one cast by day,
// never a SALAMANDER (90) or anything at night (75-112). At 3.1 damage per
// MP it's less efficient than BOLT (3.7, 5.5 on
// a weakness), and the FLAME DRAKE (280 HP, night or day) would need 96 MP
// of it — more than even a Lv30 hero holds — so it ends fights, it
// doesn't replace them.
export const SPELLS: Spell[] = [
  {
    name: "FIRE",
    cost: 3,
    learnLevel: 1,
    kind: "attack",
    power: 10,
    color: 0xffa500,
    element: "fire",
    effect: { kind: "burn", chance: 0.06 },
  },
  { name: "HEAL", cost: 4, learnLevel: 5, kind: "heal", power: 20, color: 0x4ade80 },
  {
    name: "ICE",
    cost: 6,
    learnLevel: 9,
    kind: "attack",
    power: 18,
    color: 0x67e8f9,
    element: "ice",
    effect: { kind: "chill", chance: 0.05 },
  },
  {
    name: "BOLT",
    cost: 10,
    learnLevel: 14,
    kind: "attack",
    power: 30,
    color: 0xfde047,
    element: "bolt",
    effect: { kind: "shock", chance: 0.15 },
  },
  { name: "WARD", cost: 6, learnLevel: 18, kind: "ward", power: 0, color: WARD_COLOR },
  { name: "NOVA", cost: 24, learnLevel: 24, kind: "attack", power: 60, color: 0xf5d0fe, ultimate: true },
];

// ...and a foe's HP stays three digits: BattleScene's enemy window has room
// for no more (see its ENEMY_STATUS_MIN_X note)
export const ENEMY_HP_MAX = 999;

/**
 * One blow: ATK x 0.8-1.2 less DEF, never under MIN_DAMAGE_SHARE of the roll,
 * doubled on a crit. A flat 1-damage floor meant that once DEF outgrew the
 * strongest attack in the game (level 10 in mythril) nothing could hurt the
 * hero again; the floor is applied before the crit so a crit still doubles.
 * `rand` is called twice, crit first, as the battle always has.
 */
export function rollDamage(atk: number, def: number, rand: () => number = Math.random): { dmg: number; crit: boolean } {
  const crit = rand() < CRIT_CHANCE;
  const raw = Math.floor(atk * (0.8 + rand() * 0.4));
  const hit = Math.max(Math.ceil(raw * MIN_DAMAGE_SHARE), raw - def);
  return { dmg: crit ? hit * CRIT_MULT : hit, crit };
}

// the extra share of a FIGHT's damage after `combo` FIGHTs in a row (this
// one counted)
export const comboBonus = (combo: number): number => Math.min(combo - 1, COMBO_CAP) * COMBO_PCT;

// an attack spell's damage: its power plus up to half again, x1.5 on the
// foe's weakness
export function spellRoll(spell: Spell, weakness: Element | undefined, rand: () => number = Math.random): { dmg: number; weak: boolean } {
  const roll = spell.power + Math.floor(rand() * Math.ceil(spell.power / 2));
  const weak = spell.element !== undefined && weakness === spell.element;
  return { dmg: Math.floor(roll * (weak ? WEAKNESS_MULT : 1)), weak };
}

// the companion's attack power: its species ATK, half the hero's level and
// its bond, x COMPANION_ATK_MULT
export const companionAtk = (species: EnemyDef, heroLevel: number, bond: number): number =>
  Math.round((species.atk + Math.floor(heroLevel / 2) + bond) * COMPANION_ATK_MULT);

// a CANDY's odds: 15% on a foe above half HP, 40% rising to 70% below it
export function captureChance(curHp: number, hp: number): number {
  const ratio = curHp / hp;
  return ratio < 0.5 ? 0.4 + (1 - ratio) * 0.3 : 0.15;
}

// a telegraphed strike before WARD: ATK x mult x 0.8-1.2 less DEF, with the
// usual floor, never over BOSS_STRIKE_MAX_HP_SHARE of max HP, at least 1
export function bossStrikeDamage(atk: number, mult: number, def: number, maxHp: number, rand: () => number = Math.random): number {
  const roll = Math.floor(atk * mult * (0.8 + rand() * 0.4));
  const raw = Math.min(Math.max(Math.ceil(roll * MIN_DAMAGE_SHARE), roll - def), Math.floor(maxHp * BOSS_STRIKE_MAX_HP_SHARE));
  return Math.max(1, raw);
}

// a hit through WARD or BULWARK: halved, never below 1
export const guardedDamage = (raw: number, halved: boolean): number => (halved ? Math.max(1, Math.ceil(raw * WARD_MULT)) : raw);

// a round's poison tick on the hero, which never takes the last HP
export const poisonTickDamage = (maxHp: number, hp: number): number => Math.min(Math.max(1, Math.floor(maxHp * POISON_PCT)), hp - 1);

// MOSS GOLEM's regrowth
export const regenAmount = (hp: number, curHp: number): number => Math.min(hp - curHp, Math.round(hp * REGEN_PCT));

/**
 * The foe as a battle meets it: night (outside the ARENA and the ABYSS)
 * hardens an ordinary foe and pays x1.5, a boss keeping its daytime HP and
 * ATK; then NEW GAME+'s scale, in the ABYSS times its floor's depth
 * (abyss.ts), HP capped at ENEMY_HP_MAX; a GUARDIAN pays its gold share.
 * `night` is isNight() && not the ABYSS, as BattleScene works it out.
 */
export function scaleEnemy(
  def: EnemyDef,
  opts: { night: boolean; arena: boolean; abyss: AbyssBout | null; ng: { stat: number; loot: number } },
): EnemyDef & { curHp: number } {
  const enemy = { ...def, curHp: def.hp };
  if (opts.night && !opts.arena) {
    if (!def.boss) {
      enemy.hp = Math.round(def.hp * NIGHT_STAT_MULT);
      enemy.curHp = enemy.hp;
      enemy.atk = Math.round(def.atk * NIGHT_STAT_MULT);
    }
    enemy.gold = Math.round(def.gold * NIGHT_LOOT_MULT);
    enemy.exp = Math.round(def.exp * NIGHT_LOOT_MULT);
  }
  const ng = opts.abyss ? abyssScale(opts.abyss.floor, opts.ng) : opts.ng;
  enemy.hp = Math.min(ENEMY_HP_MAX, Math.round(enemy.hp * ng.stat));
  enemy.curHp = enemy.hp;
  enemy.atk = Math.round(enemy.atk * ng.stat);
  enemy.exp = Math.round(enemy.exp * ng.loot);
  enemy.gold = Math.round(enemy.gold * ng.loot);
  if (opts.abyss?.guardian) enemy.gold = Math.round(enemy.gold * ABYSS_GUARDIAN_GOLD_SHARE);
  return enemy;
}
