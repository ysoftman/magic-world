// Monte Carlo boss-fight sim: `bun run sim:battle` (see --help). The
// numbers in the abyss/cooking/treasure/home comments ("balance sim ...")
// come from a sim like this; this one lives in the repo so a
// retune can be checked again. It imports the game's own rules
// (battleRules.ts, monsters.ts, companionSkills.ts, gameState.ts) and
// replays only what BattleScene keeps to itself — the turn order and the
// level-up gains — each marked with where it comes from, so a change there
// has to be mirrored here.
//
// The model, kept simple: day, HARD 0, no meal, not rested, no accessory, no
// bestiary bonus. The hero FIGHTs; at 35% HP or less drinks a POTION (while
// any are left) or casts HEAL; answers a boss wind-up with WARD once learned,
// with DEFEND before that or without the MP for it; casts the foe's weakness
// spell whenever MP allows. The companion is a WOLF (DOUBLE BITE) or none;
// its bond bonus is min(5, floor(level / 4)) unless --bond says otherwise,
// roughly the rounds a hero of that level has fought beside it.
//
// The late-game options (--refine, --forged, --ng, --abyss, --hipotions,
// --talisman, --meal; see --help) dress that hero for HARD MODE and the
// ABYSS's GUARDIANs, as the BLACKSMITH's REFINE was sized with (drops.ts).
// Left out, the run is the one above.
//
// --foe KEY fights any ENEMIES entry instead of the bosses (in --gear
// weapon,armor, SWORD and SHIELD if not given; the GEAR columns), and
// --elite fierce|sturdy|swift makes the foe that elite (elite.ts): how its
// numbers were checked against each region's foes at the level a hero walks
// in with, e.g. `--foe orc --elite fierce --level 9 --gear sword,ironShield`.
//
// --limit N starts each fight with the LIMIT gauge (limit.ts) at N of 100
// and lets the hero spend it the turn it is full (not while healing or
// bracing); each cell then also prints `L+nn`, the gauge a fight fills on
// average (uncapped, what the blow itself dealt left out, no PARRY: that is
// the player's timing). Without it the hero has no LIMIT, as before.
//
// --parry P and --perfect P are the share (0..1) of the foe's blows the
// player PARRIES and of FIGHTs timed PERFECT (BattleScene enemyLunge,
// playerAttack; battleRules parriedDamage, perfectDamage): a parried blow
// brings no poison or freeze either, and fills LIMIT_PARRY of the gauge.
// 0.4 is a player who tries, 0.8 one who has it down; left out, none.
//
// --perks a,b,... gives the hero those perks (perks.ts keys, whatever its
// level): MIGHT, WALL, VIGOR and FOCUS through GameState as the game applies
// them, FLOW, SURGE, BREAK and PACK where the battle reads them. The rest
// (gold, EXP, the heal and MP after a win, RUN, CATCH) change nothing a
// single fight's table shows.
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
//
// Reactions (battleRules REACTIONS: MELT, SHATTER, DETONATE, a crit on a
// stuck foe) happen whenever a cast meets the status, in every run; only the
// --skills / --greedy hero counts one's damage when it picks its move.

import type { Edge, Skill, Spell } from "../src/battleRules";
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
  ENRAGE_ATK_MULT,
  ENRAGE_HP_SHARE,
  FREEZE_GRACE_TURNS,
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
  reactionDamage,
  reactionOf,
  CRIT_CHANCE,
  CRIT_MULT,
  edgedDef,
  edgeOf,
  guardedDamage,
  parriedDamage,
  perfectDamage,
  poisonTickDamage,
  hardenDef,
  MOVE_FLURRY_MULT,
  MOVE_HOWL_ATK,
  MOVE_SNATCH_MULT,
  moveDamage,
  moveDue,
  moveReady,
  regenAmount,
  rollDamage,
  scaleEnemy,
  skillCost,
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
const { actsAgain, ELITES } = await import("../src/elite");
const { PERKS } = await import("../src/perks");
const { LIMIT_MAX, LIMIT_PARRY, limitDamage, limitDealt, limitTaken } = await import("../src/limit");

type Foe = ReturnType<typeof scaleEnemy>;
type Elem = Spell["element"];

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
// WOLF, 32-37% of max HP taken (heals not subtracted). Then each boss got a
// second pattern (monsters.ts EnemyMove `at`: SPLASH, FRENZY, SPORES, ARMOR,
// SWEEP), on top of its turn, and DEFEND its heavy share and COUNTER
// (battleRules DEFEND_HEAVY_MULT) against the hits that are announced and
// can't be parried. The levels above are with both (before them WOLF
// 4/3/7/14/16, solo 4/6/10/18/20); at the intended levels it is 4.5-9.7
// rounds and 42-51% beside the WOLF. Alone in the intended gear, 8000 fights
// (win, max HP lost): wind-ups and blasts unanswered (--nobrace) 94/89/83/68/
// 66% and 102/108/115/123/129%; wind-ups braced (the default) 98/98/100/100/
// 95% and 85/90/88/96/90%; blasts braced too (--brace) 100/98/100/100/99%
// and 70/91/82/96/78%. With --parry 0.4 --perfect 0.4 --limit 50 and the
// level's perks, 48/41/44/44/50% (48/38/38/42/31% with no second pattern).
// A boss falling before
// its intended level is seen, not tuned: those comments aim at a threat, not
// a win rate, and HARD MODE is the challenge. An unarmed Lv8 hero beats the
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
  { tag: "KING", key: "king", level: 6, gear: { weapon: "sword", armor: "shield" }, todo: { wolf: 5, solo: 6 } },
  { tag: "TROLL", key: "troll", level: 8, gear: { weapon: "sword", armor: "ironShield" }, todo: { wolf: 6, solo: 8 } },
  { tag: "MOSS", key: "mossGolem", level: 12, gear: { weapon: "ironSword", armor: "ironShield" }, todo: { wolf: 7, solo: 8 } },
  { tag: "GLACIER", key: "iceGolem", level: 18, gear: { weapon: "mythrilSword", armor: "mythrilShield" }, todo: { wolf: 12, solo: 15 } },
  { tag: "DRAKE", key: "flameDrake", level: 24, gear: { weapon: "mythrilSword", armor: "mythrilShield" }, todo: { wolf: 18, solo: 23 } },
];
const WOLF = ENEMIES.wolf;
const HP_LOW_SHARE = 0.35;

// --- options -----------------------------------------------------------------

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(`bun run sim:battle [--boss KING|TROLL|MOSS|GLACIER|DRAKE] [--level 8 | --level 6,12,18] [--n 2000] [--potions 3] [--bond N]
                    [--foe KEY [--gear W,A]] [--elite fierce|sturdy|swift] [--limit N] [--perks a,b] [--parry P] [--perfect P]
                    [--skills | --greedy] [--refine N] [--forged] [--ng N] [--abyss FLOOR] [--hipotions N] [--talisman] [--meal atk|def]
       bun run sim:battle --skill-table
  --boss       one boss instead of all five
  --foe        any ENEMIES key instead (slime, orc, yeti...), its row's intended level the first --level
  --gear       that fight's GEAR columns, EQUIPMENT keys "weapon,armor" (default sword,shield)
  --parry      share of the foe's blows parried, 0..1 (default 0)
  --perfect    share of FIGHTs timed PERFECT, 0..1 (default 0)
  --perks      perks taken, a comma list of perks.ts keys (might,vigor,flow...)
  --limit      the LIMIT gauge each fight starts with, 0..100, spent when full; cells add the gauge a fight fills
  --elite      the foe as that elite (elite.ts); with no --foe, the bosses as if they could be
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
  --ng         HARD MODE cycle N (GameState.enemyScale)
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
const PARRY = Number(opt("parry") ?? 0);
// --brace: the hero answers a boss's announced blast as it does a wind-up
// (WARD, else DEFEND and its COUNTER). Off by default, so the default hero is
// the one the older comments measured, wind-ups braced and nothing else.
const BRACE = args.includes("--brace");
// --nobrace: nor a wind-up (no WARD or DEFEND for it): what bracing is worth
const NOBRACE = args.includes("--nobrace");
// --noward: the braces are DEFENDs, WARD never cast
const NOWARD = args.includes("--noward");
const PERFECT = Number(opt("perfect") ?? 0);
const PERK_LIST = (opt("perks") ?? "").split(",").filter(Boolean);
const perk = (key: string): number => (PERK_LIST.includes(key) ? PERKS[key as keyof typeof PERKS].value : 0);
const LIMIT = opt("limit") === undefined ? null : Number(opt("limit"));
const ELITE = opt("elite");
if (ELITE !== undefined && !Object.keys(ELITES).includes(ELITE)) {
  console.error(`unknown elite ${ELITE}; one of ${Object.keys(ELITES).join(", ")}`);
  process.exit(1);
}
const eliteKind = (ELITE ?? null) as keyof typeof ELITES | null;
const FOE = opt("foe");
if (FOE !== undefined) {
  if (!Object.keys(ENEMIES).includes(FOE)) {
    console.error(`unknown foe ${FOE}; one of ${Object.keys(ENEMIES).join(", ")}`);
    process.exit(1);
  }
  const [weapon, armor] = (opt("gear") ?? "sword,shield").split(",") as [EquipmentKey, EquipmentKey];
  bosses = [
    {
      tag: FOE.toUpperCase().slice(0, 8),
      key: FOE as BossCase["key"],
      level: levels[0],
      gear: { weapon, armor },
      todo: { wolf: 0, solo: 0 },
    },
  ];
}

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
  edge: Edge; // the worn sword's nature (battleRules WEAPON_NATURE)
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
  for (const key of PERK_LIST) GameState.takePerk(key as keyof typeof PERKS);
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
    edge: edgeOf(GameState.equipped.weapon),
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

// a move's damage over all its hits (skillHit), crits counted, sampled once
// a move, ATK, DEF, weakness and flier; `weak` gives the foe the move's
// element as its weakness
const skillMeans = new Map<string, number>();
function skillMean(skill: Skill, atk: number, def: number, weak: boolean, flying = false, edge: Edge = edgeOf(null)): number {
  const key = `${skill.name}:${atk}:${def}:${weak}:${flying}:${edge.defShare}:${edge.crit}`;
  let mean = skillMeans.get(key);
  if (mean === undefined) {
    const target = { atk, def, weakness: weak ? skill.element : undefined, flying, edge };
    let sum = 0;
    for (let i = 0; i < 20000; i++) for (let h = 0; h < skill.hits; h++) sum += skillHit(skill, target).dmg;
    mean = sum / 20000;
    skillMeans.set(key, mean);
  }
  return mean;
}

// a FIGHT's damage, crits counted, before the combo (rollDamage), sampled
// once an ATK and DEF
const fightMeans = new Map<string, number>();
function fightMean(atk: number, def: number, crit = CRIT_CHANCE): number {
  const key = `${atk}:${def}:${crit}`;
  let mean = fightMeans.get(key);
  if (mean === undefined) {
    let sum = 0;
    for (let i = 0; i < 20000; i++) sum += rollDamage(atk, def, Math.random, crit).dmg;
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
  gauge: number; // LIMIT the fight filled (limit.ts), uncapped
}

type Action =
  | { kind: "fight" }
  | { kind: "potion" }
  | { kind: "hiPotion" }
  | { kind: "defend" }
  | { kind: "limit" }
  | { kind: "magic"; spell: Spell }
  | { kind: "skill"; skill: Skill };

function fight(hero: Hero, boss: BossCase, wolf: boolean, bond: number): Outcome {
  const foe: Foe = scaleEnemy(ENEMIES[boss.key], {
    night: false,
    arena: false,
    abyss: ABYSS === null ? null : { floor: ABYSS, guardian: true },
    ng: NG_SCALE,
    elite: eliteKind,
  });
  const tell = BOSS_TELLS[foe.name];
  let hp = hero.maxHp;
  let mp = hero.maxMp;
  let potions = POTIONS;
  let hiPotions = HIPOTIONS;
  // BattleScene's per-battle state (init())
  let combo = 0;
  let opened = false;
  let poisonTurns = 0;
  let frozen = false;
  let freezeGrace = 0;
  let enraged = false;
  let charging = false;
  let tellCooldown = 0;
  let wardTurns = 0;
  let defending = false;
  let enemyDot: number | null = null; // turns left (burn: FIRE's effect)
  let dotKind: "PSN" | "BRN" | null = null;
  let chillLost = 0;
  // BattleScene react(): the status spent, the cast's multiplier and what it adds
  const react = (element: Elem): { mult: number; extra: number } => {
    const kind = reactionOf(element, { dot: enemyDot === null ? null : dotKind, chilled });
    if (!kind) return { mult: 1, extra: 0 };
    const out = reactionDamage(kind, Math.max(1, Math.round(foe.hp * COMPANION_DOT_PCT)), enemyDot ?? 0);
    if (kind === "shatter") {
      chilled = false;
      foe.atk += chillLost;
      chillLost = 0;
    } else {
      enemyDot = null;
      dotKind = null;
    }
    return out;
  };
  const chill = (): void => {
    const before = foe.atk;
    chilled = true;
    foe.atk = Math.max(1, Math.round(before * COMPANION_CHILL_MULT));
    chillLost = before - foe.atk;
  };
  let stuck = false;
  let chilled = false;
  // the foe's move (BattleScene rollIntent(), enemyMove()): no gold in the
  // sim, so SNATCH is its half blow and is only kept from repeating
  let intent = false;
  let moved = false;
  let buffed = false;
  let snatched = false;
  let movesUsed = 0;
  let armor: { def: number; turns: number } | null = null;
  const rollIntent = (): void => {
    const move = foe.move;
    const immune = move?.status === "poison" ? poisonTurns > 0 : frozen || freezeGrace > 0;
    const ready = moveReady(move, { moved, buffed, snatched, gold: 1, immune });
    moved = false;
    intent = ready && !charging && moveDue(move, { used: movesUsed, curHp: foe.curHp, hp: foe.hp });
    if (intent && move?.at) movesUsed += 1;
  };
  rollIntent();
  let rounds = 0;
  let taken = 0;
  // the LIMIT blow's own damage, which fills nothing, and whether it is spent
  let limitDmg = 0;
  let parries = 0;
  let limitSpent = false;
  // what the fight has filled so far: the foe's HP gone (regrowth not
  // counted twice here, as BattleScene's syncLimit would) and the hero's
  const gauge = (): number =>
    (limitDealt(foe.hp - Math.max(0, foe.curHp) - limitDmg, foe.hp) + limitTaken(taken, hero.maxHp) + parries * LIMIT_PARRY) *
    (1 + perk("surge"));
  const done = (won: boolean): Outcome => ({ won, rounds, taken, gauge: gauge() });

  const hurt = (dmg: number): void => {
    hp = Math.max(0, hp - dmg);
    taken += dmg;
  };
  // BattleScene guardHit(): WARD halves a hit (no ORC here, so no BULWARK),
  // else DEFEND takes its share
  // (PARRY x0.7 and FIGHT's PERFECT x1.25 are the player's timing, left out: these are the numbers with neither)
  // (a heavy hit by DEFEND's heavy share, and COUNTERed: a FIGHT once the
  // hit is in, BattleScene counter(), `riposte` here)
  let counter = false;
  const guard = (raw: number, heavy = false): number => {
    if (wardTurns > 0) return guardedDamage(raw, true);
    if (!defending) return raw;
    if (heavy) counter = true;
    return defendedDamage(raw, heavy);
  };
  const riposte = (frozenNow = false): void => {
    if (counter && hp > 0 && !frozenNow) playerAttack();
    counter = false;
  };
  // BattleScene enemyLunge(): the blow parried or not, on top of the guard
  const blow = (raw: number, heavy = false): boolean => {
    const parried = Math.random() < PARRY;
    if (parried) parries += 1;
    const dmg = guard(raw, heavy);
    hurt(parried ? parriedDamage(dmg) : dmg);
    return parried;
  };

  const choose = (): Action => {
    if (hp <= hero.maxHp * HP_LOW_SHARE) {
      if (hiPotions > 0) return { kind: "hiPotion" };
      if (potions > 0) return { kind: "potion" };
      const heal = hero.spells.find((s) => s.kind === "heal");
      if (heal && mp >= heal.cost) return { kind: "magic", spell: heal };
    }
    const ward = hero.spells.find((s) => s.kind === "ward");
    // a boss's announced blast or flurry is braced for as its wind-up is
    const brace = !NOBRACE && (charging || (BRACE && intent && !!foe.move?.at && foe.move.kind === "blast"));
    if (brace && ward && !NOWARD && mp >= ward.cost && wardTurns === 0) return { kind: "magic", spell: ward };
    if (brace && wardTurns === 0) return { kind: "defend" };
    if (LIMIT !== null && !limitSpent && LIMIT + gauge() >= LIMIT_MAX) return { kind: "limit" };
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
  // a cast's damage with the reaction it would set off now (battleRules
  // REACTIONS), less what the status it spends had left to tick: the greedy
  // hero takes a reaction when it is the most damage, as a player reading the
  // skill list's INFO line would, and never plays a set-up for one (a hero
  // that did, THORNS then FIRE and the like, lost as much as one that never
  // used the list: MOSS 86% of max HP against 58%)
  const reacted = (mean: number, element: Elem): number => {
    const kind = reactionOf(element, { dot: enemyDot === null ? null : dotKind, chilled });
    if (!kind) return mean;
    const tick = Math.max(1, Math.round(foe.hp * COMPANION_DOT_PCT));
    const { mult, extra } = reactionDamage(kind, tick, enemyDot ?? 0);
    return mean * mult + extra - (kind === "shatter" ? 0 : tick * (enemyDot ?? 0));
  };
  const greedy = (): Action => {
    let best: Action = { kind: "fight" };
    let most = fightMean(hero.atk, edgedDef(foe.def, hero.edge), hero.edge.crit) * (1 + comboBonus(combo + 1) * (1 + perk("flow")));
    for (const spell of hero.spells) {
      if (spell.kind !== "attack" || mp < spell.cost) continue;
      const weak = spell.element !== undefined && spell.element === foe.weakness;
      const value = reacted(spellMean(spell, weak), spell.element) + dotValue(spell.effect, weak);
      if (value > most) [best, most] = [{ kind: "magic", spell }, value];
    }
    for (const skill of hero.skills) {
      if (mp < skillCost(skill, hero.maxMp) || (skill.grounded && foe.flying)) continue;
      const weak = skill.element !== undefined && skill.element === foe.weakness;
      const value =
        reacted(skillMean(skill, hero.atk, foe.def, weak, !!foe.flying, hero.edge), skill.element) + dotValue(skill.effect, weak);
      if (value > most) [best, most] = [{ kind: "skill", skill }, value];
    }
    return best;
  };

  // BattleScene playerAttack()
  const playerAttack = (): void => {
    combo += 1;
    // a stuck foe takes it as a crit
    const roll = rollDamage(hero.atk, edgedDef(foe.def, hero.edge), Math.random, hero.edge.crit);
    const dmg = roll.crit || !stuck ? roll.dmg : roll.dmg * CRIT_MULT;
    // QUICK's first FIGHT, SEAR's burn (battleRules WEAPON_NATURE)
    const opener = opened ? 1 : hero.edge.opener;
    opened = true;
    const total = Math.max(1, Math.floor(dmg * (1 + comboBonus(combo) * (1 + perk("flow"))) * opener));
    foe.curHp = Math.max(0, foe.curHp - (Math.random() < PERFECT ? perfectDamage(total) : total));
    if (foe.curHp > 0 && enemyDot === null && !BURN_PROOF.includes(foe.name) && Math.random() < hero.edge.burn) {
      enemyDot = COMPANION_DOT_TURNS;
      dotKind = "BRN";
    }
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
    const reaction = react(spell.element);
    foe.curHp = Math.max(0, foe.curHp - (Math.round(dmg * reaction.mult) + reaction.extra));
    if (!effect || foe.curHp <= 0) return;
    if (effect === "burn") {
      enemyDot = COMPANION_DOT_TURNS;
      dotKind = "BRN";
    } else if (effect === "chill") {
      chill();
    } else stuck = true;
  };

  // BattleScene castSkill() + spellEffectCanLand() + landSkillEffect(): the
  // effect rolled before the hits, landed if the foe outlives them; a hit
  // the foe is already down for isn't thrown
  const useSkill = (skill: Skill): void => {
    mp -= skillCost(skill, hero.maxMp);
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
    let reaction: { mult: number; extra: number } | undefined;
    for (let i = 0; i < skill.hits && foe.curHp > 0; i++) {
      const rolled = skillHit(skill, { atk: hero.atk, def: foe.def, weakness: foe.weakness, flying: foe.flying, edge: hero.edge }).dmg;
      reaction ??= react(skill.element);
      const dmg = Math.round(rolled * reaction.mult) + (i === 0 ? reaction.extra : 0);
      foe.curHp = Math.max(0, foe.curHp - dmg);
      total += dmg;
    }
    // CHAIN, as an attack spell; a weapon tech one more hit, as a FIGHT
    combo = weak || skill.style === "weapon" ? combo + 1 : 0;
    if (skill.drain) hp += Math.min(hero.maxHp - hp, Math.ceil(total * skill.drain));
    if (!effect || foe.curHp <= 0) return;
    if (effect === "burn" || effect === "poison") {
      enemyDot = COMPANION_DOT_TURNS;
      dotKind = effect === "burn" ? "BRN" : "PSN";
    } else if (effect === "chill") {
      chill();
    } else stuck = true;
  };

  // BattleScene companionAttack() + companionSkill("double"): a WOLF only
  const companion = (): void => {
    const atk = Math.round(companionAtk(WOLF, hero.level, bond) * (1 + perk("pack")));
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
    if (intent && foe.move) {
      intent = false;
      moved = true;
      if (freezeGrace > 0) freezeGrace -= 1;
      const kind = foe.move.kind;
      if (kind === "howl") {
        foe.atk = Math.round(foe.atk * MOVE_HOWL_ATK);
        buffed = true;
        blow(rollDamage(foe.atk, hero.def).dmg);
      } else if (kind === "harden" || kind === "armor") {
        const def = hardenDef(foe.atk);
        foe.def += def;
        buffed = true;
        if (kind === "armor") armor = { def, turns: foe.move.turns ?? 2 };
      } else if (kind === "flurry") {
        for (let i = 0; i < (foe.move.hits ?? 2) && hp > 0; i++)
          blow(moveDamage(rollDamage(foe.atk, hero.def).dmg, foe.move.mult ?? MOVE_FLURRY_MULT));
      } else if (kind === "afflict") {
        if (!blow(rollDamage(foe.atk, hero.def).dmg) && hp > 0) {
          if (foe.move.status === "poison" && !hero.resists.poison) poisonTurns = POISON_TURNS;
          else if (foe.move.status === "freeze" && !hero.resists.freeze) frozen = true;
        }
      } else if (kind === "blast") {
        // BattleScene enemyBlast(): no PARRY, the guard as ever
        hurt(guard(moveDamage(rollDamage(foe.atk, hero.def).dmg, foe.move.mult ?? 1), true));
        if (foe.move.poison && hp > 0 && poisonTurns === 0 && !hero.resists.poison) poisonTurns = POISON_TURNS;
        riposte();
        if (foe.curHp <= 0) return;
      } else if (kind === "snatch") {
        if (!blow(moveDamage(rollDamage(foe.atk, hero.def).dmg, MOVE_SNATCH_MULT))) snatched = true;
      } else {
        const before = hp;
        if (!blow(rollDamage(foe.atk, hero.def).dmg) && hp > 0) foe.curHp += Math.min(before - hp, foe.hp - foe.curHp);
      }
      // a boss's is on top of its turn
      if (!foe.move.at || hp <= 0) return;
    }
    if (tell && charging) {
      const canFreeze = !!tell.freezes && !frozen && freezeGrace === 0;
      if (freezeGrace > 0) freezeGrace -= 1;
      charging = false;
      tellCooldown = BOSS_TELL_COOLDOWN;
      const parried = blow(bossStrikeDamage(foe.atk, tell.mult, hero.def, hero.maxHp), true);
      if (hp > 0 && canFreeze && !parried && !hero.resists.freeze) frozen = true;
      riposte(frozen);
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
    if (blow(rollDamage(foe.atk, hero.def).dmg) || hp <= 0) return;
    // BattleScene enemyTurn(): a resist accessory takes the hit, not the status
    if (special === "poison" && !hero.resists.poison) poisonTurns = POISON_TURNS;
    else if (special === "freeze" && !hero.resists.freeze) frozen = true;
  };

  // BattleScene enemyTurn(): the act, ARMOR's count, the next intent
  const foeTurn = (): void => {
    const armored = armor;
    enemyTurn();
    if (armored && armor === armored && --armored.turns <= 0) {
      foe.def -= armored.def;
      armor = null;
      buffed = false;
    }
    if (!intent && hp > 0 && foe.curHp > 0) rollIntent();
  };

  // BattleScene runBattle(): poison tick, hero, companion, foe, WARD tick
  for (;;) {
    if (hp <= 0) return done(false);
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
      else if (action.kind === "limit") {
        // BattleScene limitBreak(): the combo is left as it is
        limitSpent = true;
        const dmg = Math.min(foe.curHp, Math.round(limitDamage(hero.atk, foe.def) * (1 + perk("break"))));
        limitDmg += dmg;
        foe.curHp -= dmg;
      } else if (action.kind === "defend") {
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
    if (foe.curHp <= 0) return done(true);
    if (wolf) {
      companion();
      if (foe.curHp <= 0) return done(true);
    }
    // BattleScene runBattle(): a SWIFT elite may act again
    const again = !stuck && actsAgain(eliteKind);
    foeTurn();
    if (again && !charging && hp > 0 && foe.curHp > 0) foeTurn();
    // felled by a COUNTER
    if (foe.curHp <= 0 && hp > 0) return done(true);
    defending = false;
    if (wardTurns > 0) wardTurns -= 1;
  }
}

// --- the tables --------------------------------------------------------------

interface Cell {
  win: number; // 0..1
  rounds: number; // mean, all fights
  lost: number; // mean damage taken / max HP, all fights
  gauge: number; // mean LIMIT filled, all fights
}

function cell(boss: BossCase, level: number, gear: boolean, wolf: boolean): Cell {
  const hero = makeHero(level, gear ? boss.gear : null);
  const bond = BOND ?? Math.min(5, Math.floor(level / 4));
  let wins = 0;
  let rounds = 0;
  let lost = 0;
  let gauge = 0;
  for (let i = 0; i < N; i++) {
    const o = fight(hero, boss, wolf, bond);
    if (o.won) wins += 1;
    rounds += o.rounds;
    lost += o.taken / hero.maxHp;
    gauge += o.gauge;
  }
  return { win: wins / N, rounds: rounds / N, lost: lost / N, gauge: gauge / N };
}

const COLS = [
  { label: "WOLF+GEAR", gear: true, wolf: true },
  { label: "WOLF+NONE", gear: false, wolf: true },
  { label: "SOLO+GEAR", gear: true, wolf: false },
  { label: "SOLO+NONE", gear: false, wolf: false },
];
const pct = (x: number): string => `${Math.round(x * 100)}%`.padStart(4);
const fmt = (c: Cell): string =>
  `${pct(c.win)} ${c.rounds.toFixed(1).padStart(5)} ${pct(c.lost)}${LIMIT === null ? "" : ` L+${Math.round(c.gauge)}`.padEnd(6)}`;

// --skill-table: what each attack spell and SKILL-list move deals a cast
// (all its hits), against what a FIGHT (no combo) would: at the level it is
// learned, the hero there in the gear of the boss before it against the DEF
// of the region it is learned in (DEF 1 to Lv7, 2 to Lv12, 3 to Lv18, then
// 4), and at Lv30 (LATE). GAIN is the cast's damage over the FIGHT's, a MP:
// what the MP buys. WEAK is the cast on a foe weak to its element. What it
// leaves (poison, burn, chill, stun, HP) isn't in the damage.
const LATE = { level: 30, atk: 47, def: 5 }; // MYTHRIL's 41, the bestiary's +5, a PARTNER's +1
const regionDef = (lv: number): number => (lv < 8 ? 1 : lv < 13 ? 2 : lv < 19 ? 3 : 4);
if (args.includes("--skill-table")) {
  type Row = {
    name: string;
    lv: number;
    mp: (maxMp: number) => number;
    hits: number;
    at: (atk: number, def: number, weak: boolean) => number;
    note: string;
  };
  const effectNote = (e: Skill["effect"]): string => (e ? `${e.kind} ${Math.round(e.chance * 100)}%` : "");
  const rows: Row[] = [
    ...SPELLS.filter((s) => s.kind === "attack").map(
      (s): Row => ({
        name: s.name,
        lv: s.learnLevel,
        mp: () => s.cost,
        hits: 1,
        at: (_atk, _def, weak) => spellMean(s, weak && s.element !== undefined),
        note: `SPELL ${[s.element, effectNote(s.effect)].filter(Boolean).join(", ")}`,
      }),
    ),
    ...SKILLS.map(
      (s): Row => ({
        name: s.name,
        lv: s.learnLevel,
        mp: (maxMp) => skillCost(s, maxMp),
        hits: s.hits,
        at: (atk, def, weak) => skillMean(s, atk, def, weak && s.element !== undefined),
        note: [
          s.style === "weapon" ? `weapon x${s.mult}${s.hits > 1 ? " each" : ""}` : s.style,
          s.element,
          effectNote(s.effect),
          s.style === "blow" && s.pierce && "ignores DEF",
          s.style === "weapon" && s.defShare && `meets DEF x${s.defShare}`,
          s.style === "weapon" && s.crit && `crit ${s.crit * 100}%`,
          s.style === "weapon" && s.flierMult && `flier x${s.flierMult}`,
          s.drain && `drain ${s.drain * 100}%`,
          s.grounded && "misses fliers",
        ]
          .filter(Boolean)
          .join(", "),
      }),
    ),
  ].sort((a, b) => a.lv - b.lv);
  const f = (x: number, w = 6): string => x.toFixed(1).padStart(w);
  const late = makeHero(LATE.level, null);
  console.log("ATTACK SPELLS AND SKILL-LIST MOVES: mean damage a cast (all hits), and its gain over a FIGHT a MP");
  console.log(`${"".padEnd(13)}    | at its level                         | at Lv${LATE.level}, ATK ${LATE.atk} DEF ${LATE.def}`);
  console.log(`${"NAME".padEnd(13)} LV | ATK DEF MP    DMG  FIGHT  GAIN   WEAK | MP    DMG  GAIN | NOTE`);
  for (const r of rows) {
    const gear = [...BOSSES].reverse().find((b) => b.level <= r.lv)?.gear ?? BOSSES[0].gear;
    const hero = makeHero(r.lv, gear);
    const def = regionDef(r.lv);
    const mp = r.mp(hero.maxMp);
    const dmg = r.at(hero.atk, def, false);
    const fight = fightMean(hero.atk, def);
    const lateMp = r.mp(late.maxMp);
    const lateDmg = r.at(LATE.atk, LATE.def, false);
    console.log(
      `${r.name.padEnd(13)} ${String(r.lv).padStart(2)} | ${String(hero.atk).padStart(3)} ${String(def).padStart(3)} ${String(mp).padStart(2)} ` +
        `${f(dmg)} ${f(fight)} ${f((dmg - fight) / mp, 5)} ${f(r.at(hero.atk, def, true))} | ${String(lateMp).padStart(2)} ` +
        `${f(lateDmg)} ${f((lateDmg - fightMean(LATE.atk, LATE.def)) / lateMp, 5)} | ${r.note}`,
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
  `BATTLE SIM  ${N} fights a cell, day, HARD ${NG}, ${MEAL ? "" : "no meal, "}not rested, ${TALISMAN ? "" : "no accessory, "}no bestiary bonus, ` +
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
