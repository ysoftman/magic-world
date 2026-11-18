import { ABYSS_GUARDIAN_GOLD_SHARE, type AbyssBout, abyssScale, boutDepth } from "./abyss";
import { ARENA_GOLD_SHARE } from "./arena";
import { MAX_LEVEL } from "./config";
import { type EliteKind, eliteDef } from "./elite";
import type { EquipmentKey, GameState } from "./gameState";
import { type Element, ENEMIES, type EnemyDef, type EnemyMove } from "./monsters";

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
// outpaces pausing to heal; items, STEAL, flee and every spell but a
// weakness hit reset it. CHAIN: an attack spell on the foe's weakness counts
// as one more hit instead (BattleScene castSpell), though the spell's own
// damage takes no bonus. While it reset the combo too, casting the spell the
// bestiary's WEAK hint points at cost the FIGHTs after it their bonus, and
// mashing FIGHT beat mixing it in. It moves the bosses little (sim:battle's
// hero casts the weakness spell while its MP lasts): a lone hero beats the
// FLAME DRAKE 3-6 points more often at Lv19-21, the rest within a point or
// two.
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

// Telegraphed boss attacks: a boss, giant or big foe may spend a turn
// winding up — a warning line and a CHG tag instead of an attack — and the
// next enemy turn lands the strike, so DEFEND, WARD, HEAL or an item has a
// turn to answer it. Tuning knobs for the balance audit:
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
//   Lv24 + MYTHRIL, small bestiary DEF), an unanswered strike costs 20-65% of
//   max HP (the TROLL KING's up to the cap below), and the cap once enraged
//   (DRAKE up to 60%). Bosses take no
//   night stat bump (see init); the wild TROLL KING can stack night on
//   enrage (both multiply ATK) and stops at the cap too. WARD halves that
//   to at most 35%, and so does a DEFEND (DEFEND_HEAVY_MULT), which
//   strikes back as well.
//   The bosses' mults were 2.4-2.8 (13-42% of max HP), under which the
//   story's bosses fell to a hero who answered nothing: 100% wins beside a
//   WOLF with or without a DEFEND, so PARRY, DEFEND and WARD had no use.
//   Sized now (with each boss's blast, monsters.ts) so that answering is
//   what wins, 4000 fights a cell at the intended level and gear, KING/
//   TROLL/MOSS/GLACIER/DRAKE, beside a WOLF and alone: nothing answered
//   (sim-battle --nobrace) 70/69/47/57/43% and 21/15/5/7/18%; wind-ups
//   braced, blasts not (its default) 98/99/80/100/84% and 71/59/54/72/57%;
//   blasts braced too with --parry 0.4 --perfect 0.4 --limit 50 and the
//   level's perks 100% all five and 99/94/99/98/93%. Two levels up the
//   default is 100/100/95/100/95% beside the WOLF. The fights are no longer
//   (--greedy/--skills rounds within 2 of before).
// - BOSS_STRIKE_MAX_HP_SHARE: the strike never takes more than this share of
//   max HP before WARD, so from full HP it can't kill, whatever stacks
// - HEAVY_SCALED_SHARE (heavyShare): HARD MODE and the ABYSS scale a foe's
//   ATK, which these mults multiply before DEF, so there a strike or blast
//   keeps only that share of its mult (the whole of it until the scale
//   passes 1 / share). Without it the mults above took HARD 1's FLAME DRAKE
//   from 92% to 43% beside a WOLF and the B15 GUARDIAN from 100% to 88%
//   (Lv30, forged kit, 3 HI-POTIONs); with it 87% and 100%, B20 90 -> 86%.
// - BossTell.chance: a big ordinary foe's own odds (ORC, YETI, SALAMANDER),
//   so the regions between the bosses ask for DEFEND too. Their fights last
//   1.5-2.5 rounds, so a wind-up mostly asks whether to finish the foe
//   first. Their mults put an unanswered strike at 18-19% of max HP at the
//   level and gear a hero walks into the region with (ORC Lv8 + SWORD + IRON
//   SHIELD, YETI Lv14 + IRON, SALAMANDER Lv18 + MYTHRIL; 28% by night, whose
//   x1.25 ATK they do take) and ~10% by the region's boss level, against 3-6%
//   for a plain hit.
// Statuses: a boss never starts a wind-up while the hero is frozen; it can't
// be snared or shocked (WEB SNARE and BOLT skip bosses and giants), so no
// strike is ever cancelled; a big foe can, and its strike waits out the lost
// turn, CHG still up; poison/burn still tick on a wind-up turn; CHILL
// (companion or ICE) lowers the ATK the strike multiplies; enraging at the
// start of the strike turn powers the strike up. The ARENA plays it all the
// same.
export const BOSS_TELL_CHANCE = 0.5;
export const BOSS_TELL_COOLDOWN = 2;
export const BOSS_STRIKE_MAX_HP_SHARE = 0.7;
// a boss's second pattern (a blast, a flurry's blows together) stops lower:
// it comes on top of that turn's blow or wind-up, which needs the room
export const BOSS_MOVE_MAX_HP_SHARE = 0.5;

export interface BossTell {
  warn: string; // the wind-up's line, <= 54 glyphs (one battle message row)
  strike: string; // the strike's name: "<strike>! 999 damage! (DEFEND)" <= 54
  mult: number;
  color: number; // the boss's tint while it winds up
  freezes?: boolean; // the strike also freezes (EMBER RING blocks it)
  chance?: number; // odds of a wind-up, BOSS_TELL_CHANCE if not given
}

export const BOSS_TELLS: Record<string, BossTell> = {
  [ENEMIES.king.name]: { warn: "KING SLIME puffs up to pounce!", strike: "BODY SLAM", mult: 4, color: 0xffd166 },
  [ENEMIES.troll.name]: { warn: "TROLL KING raises its club!", strike: "CLUB SMASH", mult: 3.8, color: 0xfbbf24 },
  [ENEMIES.mossGolem.name]: { warn: "MOSS GOLEM's roots creep closer!", strike: "ROOT CRUSH", mult: 4, color: 0x86efac },
  [ENEMIES.iceGolem.name]: { warn: "GLACIER GOLEM draws in frost...", strike: "FROST BREATH", mult: 3.6, color: 0x67e8f9, freezes: true },
  [ENEMIES.flameDrake.name]: { warn: "FLAME DRAKE takes a deep breath...", strike: "INFERNO", mult: 3, color: 0xf97316 },
  [ENEMIES.orc.name]: { warn: "ORC raises its club high!", strike: "CLUB SMASH", mult: 2, color: 0xfca5a5, chance: 0.25 },
  [ENEMIES.yeti.name]: { warn: "YETI rears up, roaring!", strike: "MAUL", mult: 2.2, color: 0xe0f2fe, chance: 0.25 },
  [ENEMIES.salamander.name]: { warn: "SALAMANDER's throat glows red...", strike: "FLAME SPIT", mult: 2.2, color: 0xfb923c, chance: 0.25 },
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

// DEFEND (D) spends the hero's turn bracing: the enemy turn after it lands
// at this share, never below 1, crits and telegraphed strikes included. WARD
// or BULWARK, when up, halve the hit instead; the three never stack. It is
// the answer to a wind-up a hero has before WARD (Lv18) or the MP for it,
// paid for with the turn's damage and the combo. In sim:battle, its hero
// DEFENDing each wind-up it can't WARD, x0.5 took the first level at a 90%
// win 2-5 lower and left the strikes before Lv18 near harmless; x0.7 takes
// it 0-2 lower, with 32-37% of max HP still lost at each boss's intended
// level. (Measured before the bosses' second patterns and the heavy share
// below; sim-battle's header has the numbers with them.)
export const DEFEND_MULT = 0.7;
// ...and a heavy hit, one that was announced and no PARRY meets (a wind-up's
// strike, a boss's blast), by this, WARD's share for the one hit, with a
// COUNTER: a FIGHT struck back at once, no turn spent (BattleScene
// counter()). At 0.7 and no COUNTER, bracing for an announced hit cost more
// than it saved: the turn it spends is a blow the fight then runs longer by
// (sim-battle, KING SLIME Lv6 alone: 110% of max HP lost bracing its
// wind-ups against 85% not; now 85% against 102%, and 70% bracing its
// SPLASH too). An armed "next FIGHT x2" did not pay either: a hero with MP
// gave up a spell for it. WARD keeps its place: the same share with no
// COUNTER, but for three turns and every hit in them.
export const DEFEND_HEAVY_MULT = 0.5;

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
export const BURN_PROOF = [
  ENEMIES.wisp,
  ENEMIES.magmaSlime,
  ENEMIES.fireImp,
  ENEMIES.gildedImp,
  ENEMIES.salamander,
  ENEMIES.flameDrake,
].map((e) => e.name);
export const CHILL_PROOF = [ENEMIES.frostMoth, ENEMIES.yeti, ENEMIES.iceGolem].map((e) => e.name);

// Spells are learned automatically at their level gate, so nothing about
// them needs saving: an old save just knows fewer spells until it levels up.
// Each spell's first letter is its hotkey, so a new name must not start with
// another spell's letter or a menu key (A FIGHT, E ITEM, D DEFEND, S STEAL)
// — nor M, which mutes, or the item list's H/J/K/L/Z.
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

// Skills: the battle's second book (BattleScene's X:SKILL list), learned at
// their level gates as spells are, so nothing about them is saved either. 26
// moves in three styles:
// - "blow" (the 14 skills, skillFx.ts): each hit is its power plus up to half
//   again (spellRoll's spread) less the foe's DEF (rollDamage's floor), and a
//   one-hit one crits as FIGHT does. A multi-hit one never crits, and pays DEF
//   on every hit, so it hurts soft foes most; LASER `pierce`s DEF.
// - "weapon" (8 techs, techFx.ts): FIGHT's roll on the hero's ATK x `mult`
//   less DEF (SPEAR SWEEP meets half of it), the hero dashing in for it as it
//   does to FIGHT. A one-hit tech crits (WHIP CRACK at 35%), a multi-hit one
//   never. It is a blow of the weapon: one more hit in the combo, though it
//   takes no combo bonus itself. Its MP is a share of max MP (skillCost): its
//   damage grows with ATK, and at a flat cost DOUBLE SLASH (2 MP at Lv2) was
//   ~9 damage a MP over a FIGHT at Lv30 against ~1.5 for every spell.
// - "spell" (4 techs, techFx.ts): an attack spell's roll (spellRoll): no
//   DEF, no crit. BLACK HOLE is the game's biggest blow because of it.
// fire/ice/bolt ones take the weakness x1.5, CHAIN the combo, finish WEAK
// and double their effect's odds on a weakness, as attack spells do; the
// other blows and spells reset the combo. Effects reuse the spells' and the
// companions' rules (spellEffectCanLand): burn (BURN_PROOF), chill
// (CHILL_PROOF), shock (no boss or giant), and THORNS' poison, VENOM STING's
// PSN (never on a PSN/BRN already ticking). SOUL DRAIN heals half its damage
// as BLOOD SIP does, SCYTHE REAP 30%. QUAKE can't reach a flier: the list
// greys it out against one. UPPERCUT hits a flier x1.2 harder.
//
// Sized with sim:battle --skill-table: the mean damage a cast at its level
// (the hero's ATK there in the gear of the boss before it, against the DEF of
// the region it is learned in) over a FIGHT's there, a MP, and the same at
// Lv30 (ATK 47, DEF 5). A spell gains 1.2-1.7 a MP at its level; so do the
// moves: blows 1.1-1.7 (FLAME PILLAR 0.7 off a fire weakness, 1.9 on one),
// weapon techs 1.3-1.6, spell techs 1.2-1.8, THORNS and EMP less for their
// poison and stun, SOUL DRAIN 0.8 and its healing. At Lv30 a FIGHT outgrew
// every flat move but the biggest (NOVA 1.2, VOID 1.4, BLACK HOLE 1.5), so
// past Lv24 the spells, blows and spell techs grow (grownPower's note): 1.2-
// 2.0 of a FIGHT a cast there and 0.5-1.5 a MP over one; the
// weapon techs keep 1.3-1.7 there, as their MP grows with max MP. On a
// weakness no move beats its element's spell per MP (FIRE 6.0, ICE 5.5,
// BOLT 5.5 against FIRE TORNADO 5.3, ICE SPIKES 5.3, FROST NOVA 4.5 ...).
// The biggest turns are BLACK HOLE 92, VOID 86 (at DEF 4), NOVA 74.5 and
// HEAVY CLEAVE ~97 at Lv30.
// sim:battle --skills (a hero casting the most damage it can afford each
// turn) against --greedy (the same pick from the spells alone), beside the
// WOLF at each boss's intended level: KING SLIME 5.8 -> 4.9 rounds, TROLL
// KING 4.8 -> 4.8, MOSS GOLEM 6.0 -> 4.9, GLACIER GOLEM 6.2 -> 5.6, FLAME
// DRAKE 5.3 -> 4.4; the first level at a 90% win one or two lower at most.
// The two that moved most were cut back: FLAME PILLAR was 22 power for 8 MP,
// four casts on a fire weakness the MOSS GOLEM's 140 HP in one Lv12 MP bar (a
// lone Lv12 hero's fight there 11.3 rounds -> 5.4; at 18 for 9 MP, 8.1), and
// FROST NOVA was 17 MP with a 30% chill (60% on the drake's weakness), the
// FLAME DRAKE beside a WOLF in 4.1 rounds with 14% of max HP lost.
// Names are the effects' (skillFx.ts SkillName, techFx.ts TechName, which
// must match) and the hit counts their SKILL_HITS / TECH_HITS.
export type SkillEffect = SpellEffect | "poison";
export const SKILL_NAMES = [
  "ARCANE BEAM",
  "THORNS",
  "MISSILES",
  "FLAME PILLAR",
  "CHAIN BOLT",
  "ICE SPIKES",
  "LASER",
  "SOUL DRAIN",
  "QUAKE",
  "EMP",
  "SMITE",
  "METEOR",
  "STAR FALL",
  "VOID",
] as const;
export type SkillName = (typeof SKILL_NAMES)[number];
export const TECH_NAMES = [
  "DOUBLE SLASH",
  "UPPERCUT",
  "WHIP CRACK",
  "DAGGER FLURRY",
  "SPEAR SWEEP",
  "SPIN SLASH",
  "HEAVY CLEAVE",
  "SCYTHE REAP",
  "FIRE TORNADO",
  "THUNDERCLAP",
  "FROST NOVA",
  "BLACK HOLE",
] as const;
export type TechName = (typeof TECH_NAMES)[number];

interface MoveBase {
  learnLevel: number;
  hits: number;
  color: number; // the foe's flash as a hit lands
  element?: Element;
  effect?: { kind: SkillEffect; chance: number }; // x SPELL_EFFECT_WEAK_MULT on a weakness
  drain?: number; // the share of its damage back as HP
  grounded?: boolean; // misses a flier, so it can't be picked against one
  // the list's INFO line after "<NAME>  <MP> MP  ", in the message box's 54
  // glyphs: name + 9 + info <= 54 (BattleScene SKILL_INFO_Y)
  info: string;
}
export interface BlowSkill extends MoveBase {
  style: "blow";
  name: SkillName;
  cost: number;
  power: number; // each hit's
  pierce?: boolean; // rolled against DEF 0
  flat?: boolean; // power and MP as learned, whatever the level (MAGIC_GROWTH)
}
export interface WeaponTech extends MoveBase {
  style: "weapon";
  name: TechName;
  mpShare: number; // its MP, a share of max MP (skillCost)
  mult: number; // each hit's, on the hero's ATK
  crit?: number; // a one-hit tech's crit odds, CRIT_CHANCE if not given
  defShare?: number; // the share of the foe's DEF it meets
  flierMult?: number; // x this on a flier
}
export interface SpellTech extends MoveBase {
  style: "spell";
  name: TechName;
  cost: number;
  power: number;
}
export type Skill = BlowSkill | WeaponTech | SpellTech;

// In the order they are learned, which is the list's (a blow before a tech
// at one level)
export const SKILLS: Skill[] = [
  {
    style: "weapon",
    name: "DOUBLE SLASH",
    mpShare: 0.2,
    learnLevel: 2,
    mult: 0.8,
    hits: 2,
    color: 0xe2e8f0,
    info: "Two quick cuts of your weapon.",
  },
  {
    style: "blow",
    name: "ARCANE BEAM",
    cost: 4,
    learnLevel: 3,
    power: 12,
    hits: 1,
    color: 0xc4b5fd,
    info: "A beam of raw magic, no element.",
  },
  {
    style: "blow",
    name: "THORNS",
    cost: 4,
    learnLevel: 4,
    power: 6,
    hits: 1,
    color: 0x84cc16,
    flat: true,
    effect: { kind: "poison", chance: 0.5 },
    info: "A light hit. Poisons 50% (PSN).",
  },
  {
    style: "weapon",
    name: "UPPERCUT",
    mpShare: 0.2,
    learnLevel: 5,
    mult: 1.4,
    flierMult: 1.2,
    hits: 1,
    color: 0xfde68a,
    info: "A rising blow, harder on fliers.",
  },
  {
    style: "blow",
    name: "MISSILES",
    cost: 6,
    learnLevel: 7,
    power: 7,
    hits: 3,
    color: 0xa5b4fc,
    info: "A volley of magic darts, 3 hits.",
  },
  {
    style: "weapon",
    name: "WHIP CRACK",
    mpShare: 0.2,
    learnLevel: 8,
    mult: 1.2,
    crit: 0.35,
    hits: 1,
    color: 0xfca5a5,
    info: "A snapping lash. Crits 35%.",
  },
  {
    style: "blow",
    name: "FLAME PILLAR",
    cost: 9,
    learnLevel: 10,
    power: 18,
    hits: 1,
    color: 0xfb923c,
    element: "fire",
    effect: { kind: "burn", chance: 0.2 },
    info: "Fire. Burns 20% (BRN).",
  },
  {
    style: "weapon",
    name: "DAGGER FLURRY",
    mpShare: 0.22,
    learnLevel: 11,
    mult: 0.5,
    hits: 4,
    color: 0xcbd5e1,
    info: "Four quick stabs.",
  },
  {
    style: "blow",
    name: "CHAIN BOLT",
    cost: 9,
    learnLevel: 12,
    power: 10,
    hits: 3,
    color: 0xfde047,
    element: "bolt",
    effect: { kind: "shock", chance: 0.08 },
    info: "Bolt, three hits. Stuns 8%.",
  },
  {
    style: "blow",
    name: "ICE SPIKES",
    cost: 9,
    learnLevel: 13,
    power: 26,
    hits: 1,
    color: 0x67e8f9,
    element: "ice",
    effect: { kind: "chill", chance: 0.1 },
    info: "Ice. Chills 10% (ATK DN).",
  },
  {
    style: "weapon",
    name: "SPEAR SWEEP",
    mpShare: 0.22,
    learnLevel: 14,
    mult: 1.4,
    defShare: 0.5,
    hits: 1,
    color: 0xe5e7eb,
    info: "A thrust through half the DEF.",
  },
  {
    style: "blow",
    name: "LASER",
    cost: 8,
    learnLevel: 15,
    power: 7,
    hits: 4,
    color: 0xff5577,
    pierce: true,
    info: "Four hits that ignore DEF.",
  },
  {
    style: "blow",
    name: "SOUL DRAIN",
    cost: 10,
    learnLevel: 16,
    power: 26,
    hits: 1,
    color: 0xc084fc,
    drain: 0.5,
    info: "Heals you half the damage.",
  },
  {
    style: "weapon",
    name: "SPIN SLASH",
    mpShare: 0.2,
    learnLevel: 17,
    mult: 0.6,
    hits: 3,
    color: 0xbae6fd,
    info: "A whirling slash, 3 hits.",
  },
  {
    style: "blow",
    name: "QUAKE",
    cost: 12,
    learnLevel: 18,
    power: 37,
    hits: 1,
    color: 0xd6a76c,
    grounded: true,
    info: "A huge blow. Fliers dodge it.",
  },
  {
    style: "spell",
    name: "FIRE TORNADO",
    cost: 13,
    learnLevel: 19,
    power: 37,
    hits: 1,
    color: 0xf97316,
    element: "fire",
    effect: { kind: "burn", chance: 0.25 },
    info: "Fire, a spell. Burns 25%.",
  },
  {
    style: "blow",
    name: "EMP",
    cost: 8,
    learnLevel: 20,
    power: 10,
    hits: 1,
    color: 0x7dd3fc,
    flat: true,
    effect: { kind: "shock", chance: 1 },
    info: "A light hit. Stuns, not bosses.",
  },
  {
    style: "weapon",
    name: "HEAVY CLEAVE",
    mpShare: 0.45,
    learnLevel: 20,
    mult: 2,
    hits: 1,
    color: 0xfecaca,
    info: "One crushing weapon blow.",
  },
  {
    style: "blow",
    name: "SMITE",
    cost: 14,
    learnLevel: 21,
    power: 40,
    hits: 1,
    color: 0xfff3b0,
    info: "A heavy blow, no element.",
  },
  {
    style: "spell",
    name: "THUNDERCLAP",
    cost: 15,
    learnLevel: 22,
    power: 42,
    hits: 1,
    color: 0xfde047,
    element: "bolt",
    effect: { kind: "shock", chance: 0.35 },
    info: "Bolt, a spell. Stuns 35%.",
  },
  {
    style: "blow",
    name: "METEOR",
    cost: 22,
    learnLevel: 23,
    power: 52,
    hits: 1,
    color: 0xf97316,
    element: "fire",
    effect: { kind: "burn", chance: 0.2 },
    info: "Fire, a huge blow. Burns 20%.",
  },
  {
    style: "spell",
    name: "FROST NOVA",
    cost: 19,
    learnLevel: 24,
    power: 46,
    hits: 1,
    color: 0x67e8f9,
    element: "ice",
    effect: { kind: "chill", chance: 0.2 },
    info: "Ice, a spell. Chills 20%.",
  },
  {
    style: "weapon",
    name: "SCYTHE REAP",
    mpShare: 0.4,
    learnLevel: 25,
    mult: 1.8,
    hits: 1,
    color: 0xa855f7,
    drain: 0.3,
    info: "Heals you 30% of the damage.",
  },
  {
    style: "blow",
    name: "STAR FALL",
    cost: 22,
    learnLevel: 26,
    power: 14,
    hits: 5,
    color: 0xfef08a,
    info: "Five falling stars.",
  },
  {
    style: "blow",
    name: "VOID",
    cost: 28,
    learnLevel: 28,
    power: 66,
    hits: 1,
    color: 0x8b5cf6,
    info: "A blow of nothing, no element.",
  },
  {
    style: "spell",
    name: "BLACK HOLE",
    cost: 30,
    learnLevel: 29,
    power: 74,
    hits: 1,
    color: 0x6d28d9,
    info: "The strongest spell, past DEF.",
  },
];

// Attack spells and magic moves (blows, spell techs) are sized flat, against
// a FIGHT at the level they are learned (the Skills note), and a FIGHT grows
// with ATK: by Lv30 it out-hit twelve of them (FIRE 12 against its ~46), so
// the late game's list was the weapon techs and three big spells. Past the
// story (MAGIC_BLOOM_LEVEL, the last boss's intended level) each level closes
// part of the gap between a move's power and the strongest spell's
// (MAGIC_PEAK, BLACK HOLE's), MAGIC_BLOOM_SHARE of it by MAX_LEVEL: the
// weakest grow most, none passes one above it, and nothing changes at the
// level a move is learned or at any story boss. A multi-hit blow pays DEF on
// every hit, so its hits aim at the peak over hits ** MAGIC_HITS_SHARE, a
// little more than an even share. The MP grows with the power, a little
// faster (grownCost: the power's ratio ** MAGIC_COST_CURVE): at a flat MP a
// damage that follows the level runs away a MP (DOUBLE SLASH, the weapon
// techs' note), and at the plain ratio a Lv30 hero had four or five casts of
// its weakness spell at x1.5, which the ABYSS and HARD MODE were not sized
// for (the B20 GUARDIAN alone, 3 HI-POTIONs: 1% -> 59%; 31% at 1.25). At
// Lv30 every cast deals 1.2-2.0 of a FIGHT and gains 0.5-1.5 a MP over one
// (sim:battle --skill-table).
// A `flat` move (THORNS, EMP) keeps both: its effect is what it is cast for.
// Why not from the level it is learned: any growth before Lv24 is the bosses'
// weakness spell growing (FIRE on the MOSS and GLACIER GOLEM, ICE on the
// FLAME DRAKE), and a third more of it took the FLAME DRAKE from 43% to 77%
// for a hero who braces nothing (sim-battle --nobrace, beside a WOLF).
export const MAGIC_BLOOM_LEVEL = 24;
export const MAGIC_BLOOM_SHARE = 0.55;
export const MAGIC_COST_CURVE = 1.25;
export const MAGIC_PEAK = 74;
export const MAGIC_HITS_SHARE = 0.75;
interface Grown {
  power: number;
  cost: number;
  learnLevel: number;
  hits?: number;
  flat?: boolean;
  pierce?: boolean;
  kind?: Spell["kind"];
}
const grows = (move: Grown): boolean => !move.flat && (move.kind ?? "attack") === "attack" && move.power > 0;

/** Each hit's power for a hero of `level` (the bloom above), a whole number. */
export function grownPower(move: Grown, level: number): number {
  if (!grows(move)) return move.power;
  const from = Math.max(MAGIC_BLOOM_LEVEL, move.learnLevel);
  const bloom = Math.min(1, Math.max(0, level - from) / (MAX_LEVEL - MAGIC_BLOOM_LEVEL)) * MAGIC_BLOOM_SHARE;
  // LASER pays no DEF, so its hits share the peak evenly
  const gap = Math.max(0, MAGIC_PEAK / (move.hits ?? 1) ** (move.pierce ? 1 : MAGIC_HITS_SHARE) - move.power);
  return Math.round(move.power + gap * bloom);
}

/** Its MP for that hero: the cost grown as its power has (MAGIC_COST_CURVE). */
export const grownCost = (move: Grown, level: number): number =>
  grows(move) ? Math.round(move.cost * (grownPower(move, level) / move.power) ** MAGIC_COST_CURVE) : move.cost;

// a move's MP now: a weapon tech's share of max MP (never under 1), a magic
// one's grown with the hero's level
export const skillCost = (skill: Skill, maxMp: number, level: number): number =>
  skill.style === "weapon" ? Math.max(1, Math.round(maxMp * skill.mpShare)) : grownCost(skill, level);

// what a hit is thrown at: the hero's ATK (a weapon tech's), the foe's DEF,
// weakness and whether it flies
export interface SkillTarget {
  atk: number;
  def: number;
  /** the hero's level, which a blow's and a spell tech's power grows with */
  level: number;
  weakness?: Element;
  flying?: boolean;
  /** the worn weapon's (edgeOf), a weapon tech's alone */
  edge?: Edge;
}

// ---- a sword's own nature (EQUIP_BONUS is its ATK; this is what else it does) ----
// Each sword has one, so the tier under the one worn is still a choice: the
// tiers are 2 ATK apart, and a nature is worth about that where it applies
// and nothing where it doesn't. It works on FIGHT and the weapon techs (the
// SKILL list's "weapon" style), never on a spell, a blow tech or LIMIT. A
// REFINE keeps the sword and so its nature.
// - HEAVY (IRON SWORD): the blade goes by half the foe's DEF, whatever put it
//   there. A HARDEN, CRUST or ARMOR had only spells for an answer.
// - KEEN (MYTHRIL SWORD): FIGHT and a one-hit weapon tech crit twice as often
//   (a tech with odds of its own keeps the better of the two).
// - QUICK (SWORD): the fight's first FIGHT deals half again. The first sword
//   is 4 to 6 ATK under the rest and no nature closes that over a long fight
//   (a combo bonus x1.5 was tried on paper: +14% at five blows against a 25%
//   gap), so this one is for the fights it is bought for, two blows long,
//   and against a foe one blow from falling. FIGHT only.
// - SEAR (DRAKE BLADE): a FIGHT that leaves the foe standing may set it
//   burning (FIRE's BRN, with its rules: not a fire kind, not one already
//   burning or poisoned), the footing a MELT wants. FIGHT only.
export interface Edge {
  /** the share of the foe's DEF the blade meets */
  defShare: number;
  /** FIGHT's crit odds */
  crit: number;
  /** what the fight's first FIGHT is multiplied by */
  opener: number;
  /** a FIGHT's odds of a burn */
  burn: number;
}
export const HEAVY_DEF_SHARE = 0.5;
export const KEEN_CRIT = 0.2;
export const QUICK_OPENER = 1.5;
export const SEAR_CHANCE = 0.15;
export const WEAPON_NATURE: Partial<Record<EquipmentKey, { name: string; info: string; edge: Partial<Edge> }>> = {
  sword: { name: "QUICK", info: "FIRST BLOW +50%", edge: { opener: QUICK_OPENER } },
  drakeBlade: { name: "SEAR", info: "FIGHT MAY BURN", edge: { burn: SEAR_CHANCE } },
  ironSword: { name: "HEAVY", info: "CUTS HALF DEF", edge: { defShare: HEAVY_DEF_SHARE } },
  mythrilSword: { name: "KEEN", info: "CRIT X2", edge: { crit: KEEN_CRIT } },
};
/** The worn weapon's edge; a bare hand's or a plain sword's changes nothing. */
export const edgeOf = (weapon: EquipmentKey | null): Edge => ({
  defShare: 1,
  crit: CRIT_CHANCE,
  opener: 1,
  burn: 0,
  ...(weapon ? WEAPON_NATURE[weapon]?.edge : undefined),
});
/** The foe's DEF as FIGHT's blade meets it. */
export const edgedDef = (def: number, edge: Edge): number => Math.round(def * edge.defShare);

/**
 * One hit of a move (see the styles above), x1.5 on the weakness. A blow:
 * power plus up to half again, less DEF (0 for a pierce). A weapon tech:
 * FIGHT's roll (ATK x 0.8-1.2) on ATK x mult (x flierMult on a flier) less
 * its share of DEF. Both with rollDamage's floor, doubled on a crit (one-hit
 * ones only, `rand` called for it first as rollDamage does). A spell tech:
 * spellRoll's, no DEF, no crit.
 */
export function skillHit(
  skill: Skill,
  target: SkillTarget,
  rand: () => number = Math.random,
): { dmg: number; crit: boolean; weak: boolean } {
  const weak = skill.element !== undefined && target.weakness === skill.element;
  const w = weak ? WEAKNESS_MULT : 1;
  if (skill.style === "spell") {
    const power = grownPower(skill, target.level);
    const roll = power + Math.floor(rand() * Math.ceil(power / 2));
    return { dmg: Math.floor(roll * w), crit: false, weak };
  }
  const keen = target.edge?.crit ?? CRIT_CHANCE;
  const odds = skill.hits > 1 ? 0 : skill.style === "weapon" ? Math.max(skill.crit ?? CRIT_CHANCE, keen) : CRIT_CHANCE;
  const crit = odds > 0 && rand() < odds;
  let roll: number;
  let def: number;
  if (skill.style === "blow") {
    const power = grownPower(skill, target.level);
    roll = power + Math.floor(rand() * Math.ceil(power / 2));
    def = skill.pierce ? 0 : target.def;
  } else {
    const mult = skill.mult * (target.flying ? (skill.flierMult ?? 1) : 1);
    roll = Math.floor(target.atk * mult * (0.8 + rand() * 0.4));
    def = Math.round(target.def * (skill.defShare ?? 1) * (target.edge?.defShare ?? 1));
  }
  const hit = Math.max(Math.ceil(roll * MIN_DAMAGE_SHARE), roll - def);
  return { dmg: Math.floor((crit ? hit * CRIT_MULT : hit) * w), crit, weak };
}

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
export function rollDamage(
  atk: number,
  def: number,
  rand: () => number = Math.random,
  critChance = CRIT_CHANCE,
): { dmg: number; crit: boolean } {
  const crit = rand() < critChance;
  const raw = Math.floor(atk * (0.8 + rand() * 0.4));
  const hit = Math.max(Math.ceil(raw * MIN_DAMAGE_SHARE), raw - def);
  return { dmg: crit ? hit * CRIT_MULT : hit, crit };
}

// the extra share of a FIGHT's damage after `combo` FIGHTs in a row (this
// one counted)
export const comboBonus = (combo: number): number => Math.min(combo - 1, COMBO_CAP) * COMBO_PCT;

// an attack spell's damage: its power for a hero of `level` (grownPower)
// plus up to half again, x1.5 on the foe's weakness
export function spellRoll(
  spell: Spell,
  weakness: Element | undefined,
  level: number,
  rand: () => number = Math.random,
): { dmg: number; weak: boolean } {
  const power = grownPower(spell, level);
  const roll = power + Math.floor(rand() * Math.ceil(power / 2));
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
export function bossStrikeDamage(
  atk: number,
  mult: number,
  def: number,
  maxHp: number,
  rand: () => number = Math.random,
  share = BOSS_STRIKE_MAX_HP_SHARE,
): number {
  const roll = Math.floor(atk * mult * (0.8 + rand() * 0.4));
  const raw = Math.min(Math.max(Math.ceil(roll * MIN_DAMAGE_SHARE), roll - def), Math.floor(maxHp * share));
  return Math.max(1, raw);
}

// A boss's blast (SPLASH, SPORES, SWEEP) is rolled as a strike is, ATK x
// mult before DEF with no crit, and stops at BOSS_MOVE_MAX_HP_SHARE of max HP
export const bossBlastDamage = (atk: number, mult: number, def: number, maxHp: number, rand: () => number = Math.random): number =>
  bossStrikeDamage(atk, mult, def, maxHp, rand, BOSS_MOVE_MAX_HP_SHARE);

// the most one blow of a boss's flurry (FRENZY) takes: the move's cap shared
// out over its hits, at least 1
export const flurryCap = (maxHp: number, hits: number): number => Math.max(1, Math.floor((maxHp * BOSS_MOVE_MAX_HP_SHARE) / hits));

// The share of its mult an announced blow (a wind-up's strike, a boss's
// blast) keeps on a foe whose stats are scaled by `stat` (HARD MODE, the
// ABYSS): the scale already multiplies the ATK the mult is taken of, before
// DEF, so the two together outgrew the hero.
export const HEAVY_SCALED_SHARE = 0.78;
export const heavyShare = (stat: number): number => (stat > 1 ? Math.max(HEAVY_SCALED_SHARE, 1 / stat) : 1);

// a hit through WARD or BULWARK: halved, never below 1
export const guardedDamage = (raw: number, halved: boolean): number => (halved ? Math.max(1, Math.ceil(raw * WARD_MULT)) : raw);

// a hit on a DEFENDing hero, never below 1
export const defendedDamage = (raw: number, heavy = false): number =>
  Math.max(1, Math.ceil(raw * (heavy ? DEFEND_HEAVY_MULT : DEFEND_MULT)));
// a parried hit (BattleScene enemyLunge: a press timed to the blow), on top
// of WARD/GUARD/DEFEND, never below 1. Player skill, so sim-battle leaves it out.
export const PARRY_MULT = 0.7;
export const parriedDamage = (dmg: number): number => Math.max(1, Math.ceil(dmg * PARRY_MULT));
// ---- reactions: a status on the foe meets an element (BattleScene react) ----
// A spell or skill of the right element on a foe with the right status
// spends the status for more: order is worth something, and the moves that
// leave a status often (THORNS 50%, FLAME PILLAR 20%, FROST NOVA 20%, a
// companion's VENOM, FIREBALL or CHILL) are a set-up for the next cast.
//   MELT      ice on a burning foe (BRN): the cast at MELT_MULT and what the
//             burn had left to tick at once (at x1.5 alone it was a loss on a
//             boss: a fresh burn's three ticks are 15% of its HP)
//   SHATTER   bolt on a chilled foe (CHL): the cast at SHATTER_MULT, the chill
//             spent and its ATK back, which is the price
//   DETONATE  fire on a poisoned foe (PSN): what the poison had left to tick,
//             at DETONATE_MULT, at once on top of the cast
// One status, one reaction: none can be had again until the status is back.
// A stunned or webbed foe (it can't be a boss or giant) takes FIGHT as a crit.
export type Reaction = "melt" | "shatter" | "detonate";
export const MELT_MULT = 1.5;
export const SHATTER_MULT = 2;
export const DETONATE_MULT = 1.5;
export const REACTIONS: Record<Reaction, { name: string; info: string; color: string }> = {
  // the skill list's INFO line while the cursor's skill would react: name + 9
  // + info <= 54 with the longest names of each element (FROST NOVA 10,
  // THUNDERCLAP 11, FLAME PILLAR 12)
  melt: { name: "MELT", info: "MELT! x1.5 on a burning foe.", color: "#67e8f9" },
  shatter: { name: "SHATTER", info: "SHATTER! x2 on a chilled foe.", color: "#fde047" },
  detonate: { name: "DETONATE", info: "DETONATE! Its poison at once.", color: "#fb923c" },
};
/** The reaction `element` sets off on a foe with these statuses, if any. */
export function reactionOf(element: Element | undefined, s: { dot: "PSN" | "BRN" | null; chilled: boolean }): Reaction | null {
  if (element === "ice" && s.dot === "BRN") return "melt";
  if (element === "bolt" && s.chilled) return "shatter";
  if (element === "fire" && s.dot === "PSN") return "detonate";
  return null;
}
/**
 * What a reaction does to its cast: the damage multiplied by `mult` and
 * `extra` on top, the dot's ticks left (`dotTick` each, `turns` of them) all
 * at once: DETONATE's at its multiplier, MELT's as they were.
 */
export function reactionDamage(kind: Reaction, dotTick: number, turns: number): { mult: number; extra: number } {
  if (kind === "shatter") return { mult: SHATTER_MULT, extra: 0 };
  if (kind === "melt") return { mult: MELT_MULT, extra: dotTick * turns };
  return { mult: 1, extra: Math.round(dotTick * turns * DETONATE_MULT) };
}

// ---- a species' move (monsters.ts EnemyMove; BattleScene enemyMove) ----
// HOWL: ATK x1.25 for the rest of the fight, and its blow the same turn.
// Howling in place of a blow made the WOLF easier: a fight is two rounds, so
// the turn it howled was half its blows gone (7% of max HP lost at Lv3
// became 4%).
export const MOVE_HOWL_ATK = 1.25;
// HARDEN / CRUST: DEF up by half its ATK, rounded down (2 at least), for the
// rest of the fight, in place of a blow (the one move that spends the turn).
// Spells and a LASER go by no DEF, so they answer it. Rounded up, the SLIME's
// was +3 against a new hero's 5 or so a FIGHT: the game's first fights, bare
// handed at Lv1, went from 2.9 rounds to 3.8 with the move (3.4 at +2).
export const hardenDef = (atk: number): number => Math.max(2, Math.floor(atk * 0.5));
// SNATCH: half a blow, and gold off the hero (what the foe itself pays, at
// most what the hero carries), handed back when the foe falls or is caught
export const MOVE_SNATCH_MULT = 0.5;
export const snatchGold = (heroGold: number, foeGold: number): number => Math.min(heroGold, foeGold);
// SIPHON / DUST: a blow that also burns this share of max MP (2 at least,
// never more than is held) unless parried: at Lv9 4 of 28 MP, a FIRE and
// more; at Lv13 5 of 36
export const MOVE_SAP_MP_SHARE = 0.15;
export const sapMp = (mp: number, maxMp: number): number => Math.min(mp, Math.max(2, Math.round(maxMp * MOVE_SAP_MP_SHARE)));
// FLURRY: two blows at this share each, 1.2 blows in all if neither is parried
export const MOVE_FLURRY_MULT = 0.6;
// a share of a rolled blow, never below 1
export const moveDamage = (dmg: number, mult: number): number => Math.max(1, Math.round(dmg * mult));
/**
 * Whether a foe may announce its move for its next turn: not twice running
 * (`moved`: it used it last turn), a buff only once at a time (`buffed`),
 * SNATCH once and only from a purse (`snatched`, `gold`), FLEE only once it has (it
 * runs with that gold), a status only where it could land (`immune`), EVADE
 * not while one is still up, a SIPHON only with MP to burn. DRAIN and FLURRY
 * any time: the hero strikes first,
 * so there is something to drain by then.
 */
export interface MoveState {
  moved: boolean;
  buffed: boolean;
  snatched: boolean;
  gold: number;
  /** poisoned already (a poison move), frozen or inside the grace (a freeze) */
  immune: (status: EnemyMove["status"]) => boolean;
  /** the hero's MP: SIPHON and DUST want some to burn */
  mp: number;
  /**
   * An ordinary field fight, the only kind a foe may FLEE: in a nest's run, a
   * seal's keeper's bout, the ARENA, the yard or the ABYSS its going would
   * end something the hero staked a day or a dive on, through no fault of
   * theirs (the cave nest's second foe is a FIERCE GOBLIN).
   */
  field: boolean;
}
export function moveReady(move: EnemyMove | undefined, s: MoveState): move is EnemyMove {
  if (!move || s.moved) return false;
  if (move.kind === "howl" || move.kind === "harden" || move.kind === "armor" || move.kind === "evade") return !s.buffed;
  if (move.kind === "snatch") return !s.snatched && s.gold > 0;
  if (move.kind === "flee") return s.snatched && s.field;
  if (move.kind === "afflict") return !s.immune(move.status);
  if (move.kind === "sap") return s.mp > 0;
  return true;
}
/**
 * The move a foe announces for its next turn, or null: of its one or two
 * (monsters.ts `move`, `move2`) one that is ready, picked at even odds, and
 * then only if it is due (moveDue: its chance, a boss's HP mark). A species
 * with two announces nothing while a tag its move left is up (DEF+, EVADE):
 * the two tags never share the window, as when a species had one move.
 */
export function nextMove(
  foe: { move?: EnemyMove; move2?: EnemyMove },
  s: MoveState,
  due: { used: number; curHp: number; hp: number },
  rand: () => number = Math.random,
): EnemyMove | null {
  const ready = [foe.move, foe.move2].filter((m): m is EnemyMove => moveReady(m, s));
  if (ready.length === 0 || (foe.move2 && s.buffed)) return null;
  const move = ready.length > 1 ? ready[Math.floor(rand() * ready.length)] : ready[0];
  return moveDue(move, due, rand) ? move : null;
}
/**
 * Whether a ready move is announced now: an ordinary foe's at its chance, a
 * boss's when its HP has fallen to the next share in `at` (`used`: how many
 * of them it has announced).
 */
export function moveDue(move: EnemyMove, s: { used: number; curHp: number; hp: number }, rand: () => number = Math.random): boolean {
  if (!move.at) return rand() < move.chance;
  return s.used < move.at.length && s.curHp <= s.hp * move.at[s.used];
}

// FIGHT's blow timed right (BattleScene playerAttack), on top of the combo
// bonus and a crit, always at least 1 more. Player skill too: not in sim-battle.
export const PERFECT_MULT = 1.25;
export const perfectDamage = (dmg: number): number => Math.max(dmg + 1, Math.round(dmg * PERFECT_MULT));

// A PERFECT also hands back this share of the hero's max MP (at least 1):
// four of them pay for a weapon technique (20% of max MP). A win's +2 MP was
// all an ordinary fight returned, so the skill list stayed shut outside boss
// fights; this lets timing pay for it. Not in the training yard.
export const PERFECT_MP_SHARE = 0.05;
export const perfectMp = (maxMp: number): number => Math.max(1, Math.round(maxMp * PERFECT_MP_SHARE));

// a round's poison tick on the hero, which never takes the last HP
export const poisonTickDamage = (maxHp: number, hp: number): number => Math.min(Math.max(1, Math.floor(maxHp * POISON_PCT)), hp - 1);

// MOSS GOLEM's regrowth
export const regenAmount = (hp: number, curHp: number): number => Math.min(hp - curHp, Math.round(hp * REGEN_PCT));

/**
 * The foe as a battle meets it: night (outside the ARENA and the ABYSS)
 * hardens an ordinary foe and pays x1.5, a boss keeping its daytime HP and
 * ATK; then HARD MODE's scale, in the ABYSS times its floor's depth
 * (abyss.ts), HP capped at ENEMY_HP_MAX; a GUARDIAN pays its gold share.
 * `night` is isNight() && not the ABYSS, as BattleScene works it out. A
 * field boss's (or the TROLL KING's) `rematch` pays the gold its ARENA bout
 * does: the ARENA's share, with no night x1.5 (its EXP keeps the night's).
 * `elite` is BattleScene's roll (elite.ts rollElite), null for most fights.
 */
export function scaleEnemy(
  species: EnemyDef,
  opts: {
    night: boolean;
    arena: boolean;
    abyss: AbyssBout | null;
    ng: { stat: number; loot: number };
    rematch?: boolean;
    elite?: EliteKind | null;
  },
): EnemyDef & { curHp: number; heavy: number } {
  // an elite (elite.ts) is its species with more HP, ATK, gold and EXP,
  // before anything below scales it
  const def = opts.elite ? eliteDef(species, opts.elite) : species;
  const enemy = { ...def, curHp: def.hp, heavy: 1 };
  if (opts.night && !opts.arena) {
    if (!def.boss) {
      enemy.hp = Math.round(def.hp * NIGHT_STAT_MULT);
      enemy.curHp = enemy.hp;
      enemy.atk = Math.round(def.atk * NIGHT_STAT_MULT);
    }
    if (!opts.rematch) enemy.gold = Math.round(def.gold * NIGHT_LOOT_MULT);
    enemy.exp = Math.round(def.exp * NIGHT_LOOT_MULT);
  }
  const ng = opts.abyss ? abyssScale(boutDepth(opts.abyss), opts.ng) : opts.ng;
  enemy.hp = Math.min(ENEMY_HP_MAX, Math.round(enemy.hp * ng.stat));
  enemy.curHp = enemy.hp;
  enemy.atk = Math.round(enemy.atk * ng.stat);
  // bosses and giants only: an ORC's, YETI's or SALAMANDER's strike keeps its mult
  if (def.boss || def.giant) enemy.heavy = heavyShare(ng.stat);
  enemy.exp = Math.round(enemy.exp * ng.loot);
  enemy.gold = Math.round(enemy.gold * ng.loot);
  if (opts.abyss?.guardian) enemy.gold = Math.round(enemy.gold * ABYSS_GUARDIAN_GOLD_SHARE);
  if (opts.rematch) enemy.gold = Math.round(enemy.gold * ARENA_GOLD_SHARE);
  return enemy;
}
