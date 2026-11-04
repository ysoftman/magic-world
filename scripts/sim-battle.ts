// Monte Carlo boss-fight sim: `bun run sim:battle` (see --help). The
// numbers in the abyss/cooking/treasure/home comments ("balance sim ...")
// come from a sim like this; this one lives in the repo so a
// retune can be checked again. It imports the game's own rules
// (battleRules.ts, monsters.ts, companionSkills.ts, gameState.ts) and
// replays only what BattleScene keeps to itself — the turn order and the
// level-up gains — each marked with where it comes from, so a change there
// has to be mirrored here.
//
// The model, kept simple: day, NG+0, no meal, not rested, no accessory, no
// bestiary bonus. The hero FIGHTs; at 35% HP or less drinks a POTION (while
// any are left) or casts HEAL; answers a boss wind-up with WARD once learned,
// with DEFEND before that or without the MP for it; casts the foe's weakness
// spell whenever MP allows. The companion is a WOLF (DOUBLE BITE) or none;
// its bond bonus is min(5, floor(level / 4)) unless --bond says otherwise,
// roughly the rounds a hero of that level has fought beside it.
//
// The late-game options (--refine, --forged, --ng, --abyss, --hipotions,
// --talisman, --meal; see --help) dress that hero for NEW GAME+ and the
// ABYSS's GUARDIANs, as the BLACKSMITH's REFINE was sized with (drops.ts).
// Left out, the run is the one above.
//
// --skills lets the hero use the SKILL list too, greedily: each turn it has
// nothing to heal or brace for, the attack spell or skill with the most
// expected damage this turn that it can pay for, poison or burn it would
// leave counted in, if that beats a FIGHT; a skill that can't reach the foe
// (QUAKE on a flier) is left out. MP runs dry fast that way, which makes it
// the most a skill-casting hero gets out of the list, not a typical one.
// --greedy is the same hero without the list, which is the run to set it
// against: the default hero casts its weakness spell even where a FIGHT
// would hit harder (FIRE's 18 on the GLACIER GOLEM against a Lv18 FIGHT's
// ~25), so beside it the list would also be credited with the better pick.
// --skill-table prints what each attack spell and skill deals a cast instead
// of fighting (battleRules.ts sized the skills off it).

import type { Skill, Spell } from "../src/battleRules";
import type { EquipmentKey } from "../src/gameState";

// gameState.ts reads localStorage inside its save/load helpers; nothing here
// saves, but the module must import — so the game modules are imported after
// this polyfill, not hoisted above it
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
};

const {
  BOSS_TELLS,
  BOSS_TELL_CHANCE,
  BOSS_TELL_COOLDOWN,
  BURN_PROOF,
  CHILL_PROOF,
  CRIT_CHANCE,
  CRIT_MULT,
  ENRAGE_ATK_MULT,
  ENRAGE_HP_SHARE,
  FREEZE_GRACE_TURNS,
  MIN_DAMAGE_SHARE,
  POISON_TURNS,
  SKILLS,
  SPELLS,
  SPELL_EFFECT_WEAK_MULT,
  WARD_TURNS,
  WEAKNESS_MULT,
  bossStrikeDamage,
  comboBonus,
  companionAtk,
  defendedDamage,
  guardedDamage,
  poisonTickDamage,
  regenAmount,
  rollDamage,
  scaleEnemy,
  skillHit,
  spellRoll,
} = await import("../src/battleRules");
const { COMPANION_CHILL_MULT, COMPANION_DOT_PCT, COMPANION_DOT_TURNS, COMPANION_DOUBLE_MULT, COMPANION_SKILLS, companionSkillChance } =
  await import("../src/companionSkills");
const { MAX_HP, MAX_LEVEL, MAX_MP } = await import("../src/config");
const { GameState } = await import("../src/gameState");
const { HI_POTION_HP, POTION_HP } = await import("../src/itemInfo");
const { ENEMIES } = await import("../src/monsters");
const { abyssGuardian } = await import("../src/abyss");

type Foe = ReturnType<typeof scaleEnemy>;

// the bosses, their intended level and gear (battleRules.ts BOSS_TELLS note:
// "KING Lv6 + SHIELD, TROLL Lv8 + IRON SHIELD, MOSS Lv12 + IRON, GLACIER
// Lv18 + MYTHRIL, DRAKE Lv24 + MYTHRIL"), and the first levels at a 90% win
// this sim measured with the telegraphed strikes (BOSS_TELLS) on and the hero
// DEFENDing them (`todo`, first noted in TODO.md; the summary prints them as
// "noted"). DEFEND took them 0-2 lower (from WOLF 4/4/8/16/18, solo
// 5/6/11/19/21, at 20000 fights a cell); KING alone at Lv4 and TROLL at Lv3
// and MOSS at Lv7 beside the WOLF sit at 90-92%, so a run may print a level
// either way. They still sit above the numbers from before the strikes (WOLF
// 1/2/4/8/11, solo 3/4/8/10/17): a strike that takes up to 70% of max HP is
// deadly at a low level. The fights at the intended levels still come out as
// the monsters.ts and battleRules.ts comments say: 4.8-8.3 rounds beside the
// WOLF, 32-37% of max HP taken (heals not subtracted). A boss falling before
// its intended level is seen, not tuned: those comments aim at a threat, not
// a win rate, and NEW GAME+ is the challenge. An unarmed Lv8 hero beats the
// MOSS GOLEM ~91% of the time with the WOLF, ~30% alone (a point or two
// either way a run). The lost progression sim (a WOLF player who takes each
// boss on as soon as it reaches 90%: 95-100% against the KING at Lv5, MOSS
// Lv8, GLACIER Lv13, DRAKE Lv16.5) predates the strikes and wasn't redone;
// this sim gives GLACIER Lv13 ~87%, DRAKE Lv16 ~91%.
interface BossCase {
  tag: string;
  key: keyof typeof ENEMIES;
  level: number;
  gear: { weapon: EquipmentKey; armor: EquipmentKey };
  todo: { wolf: number; solo: number };
}
const BOSSES: BossCase[] = [
  { tag: "KING", key: "king", level: 6, gear: { weapon: "sword", armor: "shield" }, todo: { wolf: 4, solo: 4 } },
  { tag: "TROLL", key: "troll", level: 8, gear: { weapon: "sword", armor: "ironShield" }, todo: { wolf: 3, solo: 6 } },
  { tag: "MOSS", key: "mossGolem", level: 12, gear: { weapon: "ironSword", armor: "ironShield" }, todo: { wolf: 7, solo: 10 } },
  { tag: "GLACIER", key: "iceGolem", level: 18, gear: { weapon: "mythrilSword", armor: "mythrilShield" }, todo: { wolf: 14, solo: 18 } },
  { tag: "DRAKE", key: "flameDrake", level: 24, gear: { weapon: "mythrilSword", armor: "mythrilShield" }, todo: { wolf: 16, solo: 20 } },
];
const WOLF = ENEMIES.wolf;
const HP_LOW_SHARE = 0.35;

// --- options -----------------------------------------------------------------

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(`bun run sim:battle [--boss KING|TROLL|MOSS|GLACIER|DRAKE] [--level 8 | --level 6,12,18] [--n 2000] [--potions 3] [--bond N]
                    [--skills | --greedy] [--refine N] [--forged] [--ng N] [--abyss FLOOR] [--hipotions N] [--talisman] [--meal atk|def]
       bun run sim:battle --skill-table
  --boss       one boss instead of all five
  --level      one level or a comma list instead of 1..${MAX_LEVEL}
  --n          fights per cell (default 2000)
  --potions    POTIONs the hero carries in (default 3)
  --bond       the WOLF's bond bonus 0..5 (default min(5, floor(level / 4)))
  --skills     the hero casts SKILLs too, greedily (the header comment)
  --greedy     that greedy pick from the spells alone, to set --skills against
  --skill-table  each attack spell's and skill's damage a cast, and per MP, then exits
  late-game kits (none changes the default run):
  --refine     the GEAR columns' weapon and armor at BLACKSMITH REFINE +N
  --forged     the GEAR columns in DRAKE BLADE + GLACIER MAIL, not the intended gear
  --ng         NEW GAME+ cycle N (GameState.enemyScale)
  --abyss      the GUARDIAN of ABYSS floor FLOOR (a multiple of 5) instead, in the forged kit
  --hipotions  HI-POTIONs carried too, drunk before POTIONs
  --talisman   the TALISMAN worn: no poison, no freeze
  --meal       GRILLED FISH (atk, ATK +10%) or BEAN SOUP (def, DEF +15%)`);
  process.exit(0);
}
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const N = Number(opt("n") ?? 2000);
const POTIONS = Number(opt("potions") ?? 3);
const BOND = opt("bond") === undefined ? undefined : Number(opt("bond"));
const REFINE = Number(opt("refine") ?? 0);
const NG = Number(opt("ng") ?? 0);
const ABYSS = opt("abyss") === undefined ? null : Number(opt("abyss"));
const HIPOTIONS = Number(opt("hipotions") ?? 0);
const TALISMAN = args.includes("--talisman");
const MEAL = opt("meal");
const MEAL_ATK = MEAL === "atk" ? 0.1 : 0;
const MEAL_DEF = MEAL === "def" ? 0.15 : 0;
const SKILLS_ON = args.includes("--skills");
const GREEDY = SKILLS_ON || args.includes("--greedy");
const FORGED: BossCase["gear"] = { weapon: "drakeBlade", armor: "glacierMail" };
GameState.reset();
GameState.ngPlus = NG;
const NG_SCALE = GameState.enemyScale();
const bossArg = opt("boss")?.toUpperCase();
let bosses = bossArg ? BOSSES.filter((b) => b.tag === bossArg) : BOSSES;
if (args.includes("--forged")) bosses = bosses.map((b) => ({ ...b, gear: FORGED }));
if (ABYSS !== null) {
  const key = abyssGuardian(ABYSS);
  if (!key) {
    console.error(`B${ABYSS} has no GUARDIAN; one every 5 floors`);
    process.exit(1);
  }
  bosses = [{ tag: `B${ABYSS}`, key: key as keyof typeof ENEMIES, level: MAX_LEVEL, gear: FORGED, todo: { wolf: 0, solo: 0 } }];
}
if (bosses.length === 0) {
  console.error(`unknown boss ${bossArg}; one of ${BOSSES.map((b) => b.tag).join(", ")}`);
  process.exit(1);
}
const levelArg = opt("level");
const levels = levelArg ? levelArg.split(",").map(Number) : Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);

// --- the hero ----------------------------------------------------------------

interface Hero {
  level: number;
  maxHp: number;
  maxMp: number;
  atk: number;
  def: number;
  spells: Spell[];
  skills: Skill[]; // only with --skills
  resists: { poison: boolean; freeze: boolean };
}

// A hero of `level`: reset()'s Lv1 stats with every level-up applied —
// BattleScene.ts victory(): maxHp +5, maxMp +2, atk +1, def +1 a level —
// then the gear's bonus through the game's own effAtk/effDef/effMaxHp.
function makeHero(level: number, gear: BossCase["gear"] | null): Hero {
  GameState.reset();
  for (let l = 1; l < level; l++) {
    GameState.player.level += 1;
    GameState.player.maxHp = Math.min(MAX_HP, GameState.player.maxHp + 5);
    GameState.player.maxMp = Math.min(MAX_MP, GameState.player.maxMp + 2);
    GameState.player.atk += 1;
    GameState.player.def += 1;
  }
  GameState.equipped.weapon = gear?.weapon ?? null;
  GameState.equipped.armor = gear?.armor ?? null;
  GameState.equipped.accessory = TALISMAN ? "talisman" : null;
  if (gear && REFINE > 0) GameState.refine = { [gear.weapon]: REFINE, [gear.armor]: REFINE };
  // a meal multiplies the worn total, as BattleScene's playerAtk()/playerDef()
  return {
    level,
    maxHp: GameState.effMaxHp(),
    maxMp: GameState.player.maxMp,
    atk: Math.round(GameState.effAtk() * (1 + MEAL_ATK)),
    def: Math.round(GameState.effDef() * (1 + MEAL_DEF)),
    spells: SPELLS.filter((s) => level >= s.learnLevel),
    skills: SKILLS_ON ? SKILLS.filter((s) => level >= s.learnLevel) : [],
    resists: { poison: GameState.resists("poison"), freeze: GameState.resists("freeze") },
  };
}

// --- what a cast deals, on average (the --skills hero's pick, --skill-table) --

// an attack spell's damage (spellRoll), every roll of its spread
function spellMean(spell: Spell, weak: boolean): number {
  const spread = Math.ceil(spell.power / 2);
  let sum = 0;
  for (let r = 0; r < spread; r++) sum += Math.floor((spell.power + r) * (weak ? WEAKNESS_MULT : 1));
  return sum / spread;
}

// a skill's damage over all its hits (skillHit), every roll of its spread
// and the crit a one-hit skill may roll
function skillMean(skill: Skill, def: number, weak: boolean): number {
  const spread = Math.ceil(skill.power / 2);
  const crit = skill.hits === 1 ? CRIT_CHANCE : 0;
  const w = weak ? WEAKNESS_MULT : 1;
  let sum = 0;
  for (let r = 0; r < spread; r++) {
    const roll = skill.power + r;
    const hit = Math.max(Math.ceil(roll * MIN_DAMAGE_SHARE), roll - (skill.pierce ? 0 : def));
    sum += (1 - crit) * Math.floor(hit * w) + crit * Math.floor(hit * CRIT_MULT * w);
  }
  return (sum / spread) * skill.hits;
}

// a FIGHT's damage, crits counted, before the combo (rollDamage), sampled
// once an ATK and DEF
const fightMeans = new Map<string, number>();
function fightMean(atk: number, def: number): number {
  const key = `${atk}:${def}`;
  let mean = fightMeans.get(key);
  if (mean === undefined) {
    let sum = 0;
    for (let i = 0; i < 20000; i++) sum += rollDamage(atk, def).dmg;
    mean = sum / 20000;
    fightMeans.set(key, mean);
  }
  return mean;
}

// --- one fight ---------------------------------------------------------------

interface Outcome {
  won: boolean;
  rounds: number;
  taken: number; // damage the hero took, poison ticks included
}

type Action =
  | { kind: "fight" }
  | { kind: "potion" }
  | { kind: "hiPotion" }
  | { kind: "defend" }
  | { kind: "magic"; spell: Spell }
  | { kind: "skill"; skill: Skill };

function fight(hero: Hero, boss: BossCase, wolf: boolean, bond: number): Outcome {
  const foe: Foe = scaleEnemy(ENEMIES[boss.key], {
    night: false,
    arena: false,
    abyss: ABYSS === null ? null : { floor: ABYSS, guardian: true },
    ng: NG_SCALE,
  });
  const tell = BOSS_TELLS[foe.name];
  let hp = hero.maxHp;
  let mp = hero.maxMp;
  let potions = POTIONS;
  let hiPotions = HIPOTIONS;
  // BattleScene's per-battle state (init())
  let combo = 0;
  let poisonTurns = 0;
  let frozen = false;
  let freezeGrace = 0;
  let enraged = false;
  let charging = false;
  let tellCooldown = 0;
  let wardTurns = 0;
  let defending = false;
  let enemyDot: number | null = null; // turns left (burn: FIRE's effect)
  let stuck = false;
  let chilled = false;
  let rounds = 0;
  let taken = 0;

  const hurt = (dmg: number): void => {
    hp = Math.max(0, hp - dmg);
    taken += dmg;
  };
  // BattleScene guardHit(): WARD halves a hit (no ORC here, so no BULWARK),
  // else DEFEND takes its share
  const guard = (raw: number): number => (wardTurns > 0 ? guardedDamage(raw, true) : defending ? defendedDamage(raw) : raw);

  const choose = (): Action => {
    if (hp <= hero.maxHp * HP_LOW_SHARE) {
      if (hiPotions > 0) return { kind: "hiPotion" };
      if (potions > 0) return { kind: "potion" };
      const heal = hero.spells.find((s) => s.kind === "heal");
      if (heal && mp >= heal.cost) return { kind: "magic", spell: heal };
    }
    const ward = hero.spells.find((s) => s.kind === "ward");
    if (charging && ward && mp >= ward.cost && wardTurns === 0) return { kind: "magic", spell: ward };
    if (charging && wardTurns === 0) return { kind: "defend" };
    if (GREEDY) return greedy();
    const weak = hero.spells.find((s) => s.kind === "attack" && s.element !== undefined && s.element === foe.weakness);
    if (weak && mp >= weak.cost) return { kind: "magic", spell: weak };
    return { kind: "fight" };
  };

  // --skills: the most damage this turn (a poison or burn it would leave
  // counted whole, at its odds), else FIGHT
  const dotValue = (effect: Skill["effect"] | Spell["effect"], weak: boolean): number => {
    if (!effect || enemyDot !== null || (effect.kind !== "burn" && effect.kind !== "poison")) return 0;
    if (effect.kind === "burn" && BURN_PROOF.includes(foe.name)) return 0;
    const odds = Math.min(1, effect.chance * (weak ? SPELL_EFFECT_WEAK_MULT : 1));
    return odds * COMPANION_DOT_TURNS * Math.max(1, Math.round(foe.hp * COMPANION_DOT_PCT));
  };
  const greedy = (): Action => {
    let best: Action = { kind: "fight" };
    let most = fightMean(hero.atk, foe.def) * (1 + comboBonus(combo + 1));
    for (const spell of hero.spells) {
      if (spell.kind !== "attack" || mp < spell.cost) continue;
      const weak = spell.element !== undefined && spell.element === foe.weakness;
      const value = spellMean(spell, weak) + dotValue(spell.effect, weak);
      if (value > most) [best, most] = [{ kind: "magic", spell }, value];
    }
    for (const skill of hero.skills) {
      if (mp < skill.cost || (skill.grounded && foe.flying)) continue;
      const weak = skill.element !== undefined && skill.element === foe.weakness;
      const value = skillMean(skill, foe.def, weak) + dotValue(skill.effect, weak);
      if (value > most) [best, most] = [{ kind: "skill", skill }, value];
    }
    return best;
  };

  // BattleScene playerAttack()
  const playerAttack = (): void => {
    combo += 1;
    const { dmg } = rollDamage(hero.atk, foe.def);
    foe.curHp = Math.max(0, foe.curHp - Math.max(1, Math.floor(dmg * (1 + comboBonus(combo)))));
  };

  // BattleScene castSpell() + spellEffectCanLand() + landSpellEffect()
  const cast = (spell: Spell): void => {
    mp -= spell.cost;
    if (spell.kind === "heal") {
      combo = 0;
      hp += Math.min(hero.maxHp - hp, spell.power);
      poisonTurns = 0;
      return;
    }
    if (spell.kind === "ward") {
      combo = 0;
      wardTurns = WARD_TURNS;
      return;
    }
    const { dmg, weak } = spellRoll(spell, foe.weakness);
    // CHAIN: a weakness hit is one more in the combo, any other cast resets it
    combo = weak ? combo + 1 : 0;
    const fx = spell.effect;
    const canLand =
      fx &&
      (fx.kind === "burn"
        ? enemyDot === null && !BURN_PROOF.includes(foe.name)
        : fx.kind === "chill"
          ? !chilled && !CHILL_PROOF.includes(foe.name)
          : !stuck && !foe.boss && !foe.giant);
    const effect = fx && canLand && Math.random() < fx.chance * (weak ? SPELL_EFFECT_WEAK_MULT : 1) ? fx.kind : null;
    foe.curHp = Math.max(0, foe.curHp - dmg);
    if (!effect || foe.curHp <= 0) return;
    if (effect === "burn") enemyDot = COMPANION_DOT_TURNS;
    else if (effect === "chill") {
      chilled = true;
      foe.atk = Math.max(1, Math.round(foe.atk * COMPANION_CHILL_MULT));
    } else stuck = true;
  };

  // BattleScene castSkill() + spellEffectCanLand() + landSkillEffect(): the
  // effect rolled before the hits, landed if the foe outlives them; a hit
  // the foe is already down for isn't thrown
  const useSkill = (skill: Skill): void => {
    mp -= skill.cost;
    const weak = skill.element !== undefined && skill.element === foe.weakness;
    const fx = skill.effect;
    const canLand =
      fx &&
      (fx.kind === "burn"
        ? enemyDot === null && !BURN_PROOF.includes(foe.name)
        : fx.kind === "poison"
          ? enemyDot === null
          : fx.kind === "chill"
            ? !chilled && !CHILL_PROOF.includes(foe.name)
            : !stuck && !foe.boss && !foe.giant);
    const effect = fx && canLand && Math.random() < fx.chance * (weak ? SPELL_EFFECT_WEAK_MULT : 1) ? fx.kind : null;
    let total = 0;
    for (let i = 0; i < skill.hits && foe.curHp > 0; i++) {
      const { dmg } = skillHit(skill, foe.def, foe.weakness);
      foe.curHp = Math.max(0, foe.curHp - dmg);
      total += dmg;
    }
    // CHAIN, as an attack spell
    combo = weak ? combo + 1 : 0;
    if (skill.drain) hp += Math.min(hero.maxHp - hp, Math.ceil(total * skill.drain));
    if (!effect || foe.curHp <= 0) return;
    if (effect === "burn" || effect === "poison") enemyDot = COMPANION_DOT_TURNS;
    else if (effect === "chill") {
      chilled = true;
      foe.atk = Math.max(1, Math.round(foe.atk * COMPANION_CHILL_MULT));
    } else stuck = true;
  };

  // BattleScene companionAttack() + companionSkill("double"): a WOLF only
  const companion = (): void => {
    const atk = companionAtk(WOLF, hero.level, bond);
    if (COMPANION_SKILLS[WOLF.name].kind !== "double") throw new Error("the sim only knows the WOLF's DOUBLE BITE");
    if (Math.random() < companionSkillChance(bond)) {
      for (let bite = 0; bite < 2 && foe.curHp > 0; bite++) {
        const { dmg } = rollDamage(atk, foe.def);
        foe.curHp = Math.max(0, foe.curHp - Math.max(1, Math.floor(dmg * COMPANION_DOUBLE_MULT)));
      }
      return;
    }
    foe.curHp = Math.max(0, foe.curHp - rollDamage(atk, foe.def).dmg);
  };

  // BattleScene rollSpecial()
  const rollSpecial = (): string | undefined => {
    const special = foe.special;
    if (!special || Math.random() >= special.chance) return undefined;
    if (special.kind === "poison" && poisonTurns > 0) return undefined;
    if (special.kind === "freeze" && (frozen || freezeGrace > 0)) return undefined;
    if (special.kind === "regen" && foe.curHp >= foe.hp) return undefined;
    return special.kind;
  };

  // BattleScene enemyTurn(), with enemyDotTick(), enrage(), bossTell(),
  // bossStrike() and regenerate() inlined in the order it calls them
  const enemyTurn = (): void => {
    if (enemyDot !== null) {
      enemyDot -= 1;
      const dot = Math.min(Math.max(1, Math.round(foe.hp * COMPANION_DOT_PCT)), foe.curHp - 1);
      if (dot > 0) foe.curHp -= dot;
      if (enemyDot === 0) enemyDot = null;
    }
    if ((foe.boss || foe.giant) && !enraged && foe.curHp <= foe.hp * ENRAGE_HP_SHARE) {
      enraged = true;
      foe.atk = Math.round(foe.atk * ENRAGE_ATK_MULT);
    }
    if (stuck) {
      stuck = false;
      return;
    }
    if (tell && charging) {
      const canFreeze = !!tell.freezes && !frozen && freezeGrace === 0;
      if (freezeGrace > 0) freezeGrace -= 1;
      charging = false;
      tellCooldown = BOSS_TELL_COOLDOWN;
      hurt(guard(bossStrikeDamage(foe.atk, tell.mult, hero.def, hero.maxHp)));
      if (hp > 0 && canFreeze && !hero.resists.freeze) frozen = true;
      return;
    }
    if (tell && tellCooldown > 0) tellCooldown -= 1;
    else if (tell && !frozen && Math.random() < BOSS_TELL_CHANCE) {
      if (freezeGrace > 0) freezeGrace -= 1;
      charging = true;
      return;
    }
    const special = rollSpecial();
    if (freezeGrace > 0) freezeGrace -= 1;
    if (special === "regen") {
      foe.curHp += regenAmount(foe.hp, foe.curHp);
      return;
    }
    hurt(guard(rollDamage(foe.atk, hero.def).dmg));
    if (hp <= 0) return;
    // BattleScene enemyTurn(): a resist accessory takes the hit, not the status
    if (special === "poison" && !hero.resists.poison) poisonTurns = POISON_TURNS;
    else if (special === "freeze" && !hero.resists.freeze) frozen = true;
  };

  // BattleScene runBattle(): poison tick, hero, companion, foe, WARD tick
  for (;;) {
    if (hp <= 0) return { won: false, rounds, taken };
    if (poisonTurns > 0) {
      hurt(poisonTickDamage(hero.maxHp, hp));
      poisonTurns -= 1;
    }
    rounds += 1;
    if (frozen) {
      frozen = false;
      freezeGrace = FREEZE_GRACE_TURNS;
    } else {
      const action = choose();
      if (action.kind === "fight") playerAttack();
      else if (action.kind === "magic") cast(action.spell);
      else if (action.kind === "skill") useSkill(action.skill);
      else if (action.kind === "defend") {
        combo = 0;
        defending = true;
      } else if (action.kind === "hiPotion") {
        combo = 0;
        hiPotions -= 1;
        hp += Math.min(hero.maxHp - hp, HI_POTION_HP);
        poisonTurns = 0;
      } else {
        combo = 0;
        potions -= 1;
        hp += Math.min(hero.maxHp - hp, POTION_HP);
        poisonTurns = 0;
      }
    }
    if (foe.curHp <= 0) return { won: true, rounds, taken };
    if (wolf) {
      companion();
      if (foe.curHp <= 0) return { won: true, rounds, taken };
    }
    enemyTurn();
    defending = false;
    if (wardTurns > 0) wardTurns -= 1;
  }
}

// --- the tables --------------------------------------------------------------

interface Cell {
  win: number; // 0..1
  rounds: number; // mean, all fights
  lost: number; // mean damage taken / max HP, all fights
}

function cell(boss: BossCase, level: number, gear: boolean, wolf: boolean): Cell {
  const hero = makeHero(level, gear ? boss.gear : null);
  const bond = BOND ?? Math.min(5, Math.floor(level / 4));
  let wins = 0;
  let rounds = 0;
  let lost = 0;
  for (let i = 0; i < N; i++) {
    const o = fight(hero, boss, wolf, bond);
    if (o.won) wins += 1;
    rounds += o.rounds;
    lost += o.taken / hero.maxHp;
  }
  return { win: wins / N, rounds: rounds / N, lost: lost / N };
}

const COLS = [
  { label: "WOLF+GEAR", gear: true, wolf: true },
  { label: "WOLF+NONE", gear: false, wolf: true },
  { label: "SOLO+GEAR", gear: true, wolf: false },
  { label: "SOLO+NONE", gear: false, wolf: false },
];
const pct = (x: number): string => `${Math.round(x * 100)}%`.padStart(4);
const fmt = (c: Cell): string => `${pct(c.win)} ${c.rounds.toFixed(1).padStart(5)} ${pct(c.lost)}`;

// --skill-table: each attack spell and skill a cast, at the DEF it can meet
// (a spell's ignores DEF), on a weakness at DEF 3, and per MP at DEF 3,
// beside a FIGHT at its level in the gear of the boss before it, against
// DEF 3 (no combo). What it leaves (poison, burn, chill, stun, HP) isn't in
// the damage.
if (args.includes("--skill-table")) {
  type Row = { name: string; lv: number; mp: number; hits: number; at: (def: number, weak: boolean) => number; note: string };
  const effectNote = (e: Skill["effect"]): string => (e ? `${e.kind} ${Math.round(e.chance * 100)}%` : "");
  const rows: Row[] = [
    ...SPELLS.filter((s) => s.kind === "attack").map(
      (s): Row => ({
        name: s.name,
        lv: s.learnLevel,
        mp: s.cost,
        hits: 1,
        at: (_def, weak) => spellMean(s, weak && s.element !== undefined),
        note: `spell${s.element ? ` ${s.element}` : ""} ${effectNote(s.effect)}`.trim(),
      }),
    ),
    ...SKILLS.map(
      (s): Row => ({
        name: s.name,
        lv: s.learnLevel,
        mp: s.cost,
        hits: s.hits,
        at: (def, weak) => skillMean(s, def, weak && s.element !== undefined),
        note: [
          s.element,
          effectNote(s.effect),
          s.pierce && "ignores DEF",
          s.drain && `drain ${s.drain * 100}%`,
          s.grounded && "misses fliers",
        ]
          .filter(Boolean)
          .join(", "),
      }),
    ),
  ].sort((a, b) => a.lv - b.lv);
  const f = (x: number): string => x.toFixed(1).padStart(6);
  console.log("ATTACK SPELLS AND SKILLS: mean damage a cast (all hits)");
  console.log(`${"NAME".padEnd(13)} LV  MP  HITS   DEF1   DEF3   DEF5   DEF8  WEAK3  /MP@3  FIGHT  NOTE`);
  for (const r of rows) {
    const gear = [...BOSSES].reverse().find((b) => b.level <= r.lv)?.gear ?? BOSSES[0].gear;
    const fightAt = fightMean(makeHero(r.lv, gear).atk, 3);
    console.log(
      `${r.name.padEnd(13)} ${String(r.lv).padStart(2)}  ${String(r.mp).padStart(2)}  ${String(r.hits).padStart(4)} ` +
        `${f(r.at(1, false))} ${f(r.at(3, false))} ${f(r.at(5, false))} ${f(r.at(8, false))} ${f(r.at(3, true))} ` +
        `${f(r.at(3, false) / r.mp)} ${f(fightAt)}  ${r.note}`,
    );
  }
  process.exit(0);
}

const started = Date.now();
const kit = [
  REFINE > 0 && `REFINE +${REFINE}`,
  args.includes("--forged") && "forged kit",
  ABYSS !== null && `ABYSS B${ABYSS} (x${(ABYSS === null ? 1 : 1 + 0.06 * (ABYSS - 1)).toFixed(2)})`,
  HIPOTIONS > 0 && `${HIPOTIONS} HI-POTION(s)`,
  TALISMAN && "TALISMAN",
  MEAL && `meal ${MEAL}`,
  GREEDY && (SKILLS_ON ? "greedy, SKILLs" : "greedy, spells only"),
].filter(Boolean);
console.log(
  `BATTLE SIM  ${N} fights a cell, day, NG+${NG}, ${MEAL ? "" : "no meal, "}not rested, ${TALISMAN ? "" : "no accessory, "}no bestiary bonus, ` +
    `${POTIONS} POTION(s), WOLF bond ${BOND ?? "min(5, floor(level/4))"}${kit.length > 0 ? ` | ${kit.join(", ")}` : ""}`,
);
console.log("each cell: win%  mean rounds  damage taken as % of max HP (heals not subtracted)");
const gearName = (g: BossCase["gear"]): string => `${g.weapon}+${g.armor}`;
const summary: string[] = [];
for (const boss of bosses) {
  const def = ENEMIES[boss.key];
  console.log(
    `\n== ${def.name}  HP ${def.hp} ATK ${def.atk} DEF ${def.def} weak ${def.weakness ?? "-"}  intended Lv${boss.level} ${gearName(boss.gear)} ==`,
  );
  console.log(`LV  ${COLS.map((c) => c.label.padEnd(15)).join("  ")}`);
  const first: Record<string, number | null> = {};
  let atIntended: Cell | null = null;
  for (const level of levels) {
    const cells = COLS.map((c) => cell(boss, level, c.gear, c.wolf));
    console.log(`${String(level).padStart(2)}  ${cells.map(fmt).join("  ")}`);
    cells.forEach((c, i) => {
      if (c.win >= 0.9 && first[COLS[i].label] === undefined) first[COLS[i].label] = level;
    });
    if (level === boss.level) atIntended = cells[0];
  }
  const lv = (label: string): string => String(first[label] ?? "-").padStart(2);
  summary.push(
    `${boss.tag.padEnd(8)} ${lv("WOLF+GEAR")} / ${String(boss.todo.wolf).padStart(2)}      ${lv("SOLO+GEAR")} / ${String(boss.todo.solo).padStart(2)}      ` +
      (atIntended ? `Lv${boss.level}: ${fmt(atIntended)}` : "-"),
  );
}
console.log("\n== first level at 90% wins, intended gear: sim / noted ==");
console.log("BOSS     WOLF          SOLO          WOLF+GEAR at the intended level (win rounds dmg)");
for (const line of summary) console.log(line);
console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
