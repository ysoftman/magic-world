import Phaser from "phaser";
import type { AbyssBout } from "../abyss";
import { ARENA_BOSSES, ARENA_CLEAR_BONUS, ARENA_GOLD_SHARE, ARENA_RECOVER_PCT, type ArenaRun } from "../arena";
import { BATTLE_THEME, BOSS_THEME, FOREST_BATTLE_THEME, Sfx, SNOW_BATTLE_THEME, VOLCANO_BATTLE_THEME } from "../audio";
import { battleSource, battleTexture } from "../battleHd";
import {
  BOSS_TELL_CHANCE,
  BOSS_TELL_COOLDOWN,
  BOSS_TELLS,
  type BossTell,
  BURN_PROOF,
  bossStrikeDamage,
  CHILL_PROOF,
  COMBO_CAP,
  CRIT_MULT,
  captureChance,
  comboBonus,
  companionAtk,
  DEATH_GOLD_LOSS,
  defendedDamage,
  ENRAGE_ATK_MULT,
  ENRAGE_HP_SHARE,
  edgedDef,
  edgeOf,
  FREEZE_GRACE_TURNS,
  guardedDamage,
  hardenDef,
  MOVE_FLURRY_MULT,
  MOVE_HOWL_ATK,
  MOVE_SNATCH_MULT,
  moveDamage,
  moveDue,
  moveReady,
  POISON_TURNS,
  parriedDamage,
  perfectDamage,
  poisonTickDamage,
  REACTIONS,
  reactionDamage,
  reactionOf,
  regenAmount,
  rollDamage,
  SKILLS,
  type Skill,
  type SkillEffect,
  SPELL_EFFECT_WEAK_MULT,
  SPELLS,
  type Spell,
  type SpellEffect,
  STEAL_CHANCE,
  STEAL_GOLD_PCT,
  STREAK_MIN,
  scaleEnemy,
  skillCost,
  skillHit,
  snatchGold,
  spellRoll,
  WARD_COLOR,
  WARD_TURNS,
  WEAKNESS_MULT,
} from "../battleRules";
import {
  COMPANION_CHILL_MULT,
  COMPANION_DOT_PCT,
  COMPANION_DOT_TURNS,
  COMPANION_DOUBLE_MULT,
  COMPANION_HEAL_PCT,
  COMPANION_PILFER_PCT,
  COMPANION_SKILLS,
  type CompanionSkill,
  companionSkillChance,
} from "../companionSkills";
import { GAME_HEIGHT, GAME_WIDTH, PIXEL } from "../config";
import { type MealDef, takeMealCharge } from "../cooking";
import { actsAgain, ELITES, type EliteKind, rollElite } from "../elite";
import { bakeBattleFx, flash, loopFx, playFx, shake, warmFx } from "../fx";
import { GameState, isNight, onSaved } from "../gameState";
import { RESTED_WARD_TURNS } from "../home";
import { BOMB_DAMAGE, ETHER_MP, HI_POTION_HP, ITEM_INFO, MPOTION_MP, POTION_HP } from "../itemInfo";
import { chargeLimit, LIMIT_MAX, LIMIT_PARRY, limitDamage, limitDealt, limitFull, limitTaken } from "../limit";
import { ENEMIES, type EnemyDef, type EnemyMove, type EnemySpecial } from "../monsters";
import { settleLevels, settleWin } from "../payout";
import { perkOpened } from "../perks";
import { ART_PX, bodyStyle, DIM_TEXT, gridOutline, retroStyle, showToast, texelsOf } from "../pixelart";
import type { PixelText } from "../pixelText";
import { endPracticeRun, type PracticeRun, practiceEnemy, practiceHp, randomStep } from "../practice";
import { openRelicBout, relicAtk, relicDef } from "../relics";
import { type KeeperBout, keeperDef } from "../seals";
import { type BlessingDef, takeBlessingCharge } from "../shrine";
import { playSkill, SKILL_HITS, SKILL_SHEET_KEYS, type SkillStage } from "../skillFx";
import { playSkillSfx, skillSfxHits } from "../skillSfx";
import { playSoul, warmSoul } from "../soulFx";
import { breakOf, StatusFx, type StatusKind } from "../statusFx";
import { playTech, TECH_HITS, TECH_MELEE, TECH_SHEET_KEYS } from "../techFx";
import { rollTreasureMap } from "../treasure";
import { BattleHelp } from "../ui/BattleHelp";
import { addBattleWeather } from "../ui/BattleWeather";
import { bindKeyHint, keyHint, onInputChange } from "../ui/Gamepad";
import { GEAR_LAYOUT } from "../ui/HeroGear";
import { skyOverlay } from "../ui/NightOverlay";
import { BAR_TRACK, barShare } from "../ui/StatusHud";
import { TypedText } from "../ui/TypedText";
import { battleBgKey } from "./BootScene";
import type { EndingData } from "./EndingScene";

// snappy lunges (out/back) — slow enough to read, fast enough to feel quick
const LUNGE_OUT_MS = 90;
const LUNGE_BACK_MS = 110;
// a strike's anticipation (the hero draws back and raises the weapon), the
// freeze on contact, and the foe's knock-back (a crit's farther)
const WINDUP_MS = 100;
const WINDUP_PX = 22;
// the body's pose: leaning back / forward (degrees, + is forward as the hero
// faces right), and a crouch before and a stretch through the dash, kept
// small as the feet stand off the ground by half the lost height
const HERO_SCALE = 2;
const LEAN_BACK = -9;
const LEAN_FWD = 8;
const CROUCH: [number, number] = [1.05, 0.93];
const STRETCH: [number, number] = [1.14, 0.95];
// the weapon's raised, down-stroke and per-hit swing angles
const WEAPON_UP = -80;
const WEAPON_DOWN = 100;
const HIT_STOP_MS = 50;
const CRIT_STOP_MS = 90;
const RECOIL_PX = 10;
const CRIT_RECOIL_PX = 18;
const RECOIL_MS = 90;
// PARRY: a key or tap as the foe's blow lands. The foe stands still for a
// random beat (so no rhythm can be learnt), draws back (the cue, in real ms
// whatever the BATTLE SPEED, so the cue-to-blow time never drops under a
// reaction), then lunges. Only the first press counts and it must fall in the
// last PARRY_WINDOW_MS before contact: mashing is always early. A parried
// blow does battleRules PARRY_MULT of its damage (after WARD/GUARD/DEFEND)
// and carries no poison or freeze. The hero can't on the round it thaws.
// The cue comes 350ms before the blow (305ms at BATTLE SPEED 2) and the
// window opens 150ms (105ms) after it: a press on seeing the foe draw back
// (a 200-330ms reaction) lands inside. At 180ms of draw-back the blow came
// 270ms after the cue, sooner than most reactions. The beat is 150ms at
// least, so a press 150ms after the one that advanced the last line (mashing)
// is still 100ms early. A press up to PARRY_LATE_MS after the blow is told so.
const PARRY_HOLD_MS: [number, number] = [150, 450];
const PARRY_BACK_MS = 260;
const PARRY_BACK_PX = 24;
const PARRY_WINDOW_MS = 200;
const PARRY_LATE_MS = 250;
// PERFECT: FIGHT's blow timed the same way, for battleRules PERFECT_MULT of
// its damage; a miss costs nothing. A reticle closes on the foe over the
// run-up (PERFECT_RUN_MS, real ms at any BATTLE SPEED, a different length
// each time so the eyes time it, not a learnt rhythm) and is shut
// PERFECT_GRACE_MS before the blade lands: the first press since FIGHT was
// picked counts if it fell in the last PERFECT_WINDOW_MS before contact,
// about 80ms either side of the reticle shutting (the wind-up, the hold and
// the dash each end on a frame, so the blade lands some 30ms after its
// time). The hero holds the wind-up
// pose for what the run-up has over the dash's own 190ms (95ms at speed 2),
// 220ms a FIGHT on average. The window opens 190ms in at the earliest, so a
// second press 120ms after the one that picked FIGHT (mashing) is early.
const PERFECT_RUN_MS: [number, number] = [340, 480];
const PERFECT_WINDOW_MS = 150;
const PERFECT_GRACE_MS = 40;
// the reticle: four corner brackets (2 cells thick, 8 long) closing from
// CUE_FROM to CUE_HALF about the foe's middle, on the 2px grid
const CUE_FROM = 120;
const CUE_HALF = 56;
// breathing (idleBob): how far a fighter rises and falls, two of its 2px cells
const IDLE_BOB_PX = 4;
// a flier's breathing is a hover: higher and quicker, wings at work
const FLY_BOB_PX = 8;
const FLY_BOB_MS = 1100;
// Where the fighters stand (stand()): each one's lowest opaque row on a
// ground line just under the backdrop's lit lip (the horizon is y 440, the
// lip to 452), a shadow under it. Placed by their centres (the foe at 280, a
// boss at 312, the hero at 368), every foe and the hero hung over the far
// hills or the cave wall, the foes up to 96px off the ground. The companion
// stands a step nearer, in front of the hero. The item list's first row
// starts at y 474: the shadows end by 466 and 472.
const GROUND_Y = 456;
const COMPANION_GROUND_Y = 464;
// a flier's lowest pixel this far over its shadow, about the hero's chin
const FLY_LIFT = 64;
// A shadow's strength, a flier's paler and narrower (a share of its body's
// width) for its height, and how far a fighter rises off its rest (a breath,
// a win's hop) for its shadow to fade out. At 0.25 and half the body a
// flier's shadow was a smudge on the cave's and the snow field's dark ground.
const SHADOW_ALPHA = 0.4;
const FLY_SHADOW_ALPHA = 0.35;
const FLY_SHADOW_W = 0.6;
const SHADOW_FADE_LIFT = 64;
// where the companion stands, and where a caught monster flies to (catchFx)
const COMPANION_X = 180;
// The companion is its field art (32 cells at ART_PX) at 1x, a cell 2px as
// every battler's is (battleHd.ts) and half the hero's 128px: a pet, not a
// second hero (ui/CompanionSprite.ts). At 1.5x of the art drawn at twice the
// cells its texels were 1.5px, 1px and 2px columns by turns; at 2x, the size
// of the hero and the foes, it read as a second hero, and the TROLL KING
// (192px, x 84..276) reached the hero's shield (from x 260).
const COMPANION_SCALE = 1;
// where its dash (companionLunge) ends, short of the foe's middle: a 64px
// SLIME's front then meets a WOLF's (90, right for its 96px at 1.5x, left
// 16px between them)
const COMPANION_DASH_GAP = 76;
// the CANDY icon's light pink (art/icons.ts ICON_CANDY_PALETTE): a catch's glow
const CANDY_PINK = 0xf9a8d4;
// the OS's reduced-motion setting, as fx.ts reads it: no breathing, no hops
const reducedMotion = (): boolean => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
// BATTLE SPEED (GameState.battleSpeed: 1 / 1.5 / 2) divides every animation
// in a battle through anim(): lunges, projectiles, NOVA, the boss wind-up,
// damage pop-ups, the typewriter and the closing fades. What it leaves alone:
// the input waits (every message still needs Z), the game logic and its
// rolls, the fx wrappers' SCREEN SHAKE / FLASHES settings, and the slow fade
// into the ending or epilogue (a story beat, not battle chrome). The floors
// keep FASTER readable: a damage or heal number stays up at least
// POPUP_MIN_MS, a status pop STATUS_POP_MIN_MS, a typed glyph TYPE_MIN_MS.
const POPUP_MIN_MS = 500;
// a damage/heal number's highest top edge (popNumber), 16px under the stat
// windows' bottom (200), and the least it rises from where it starts
const POPUP_TOP = 216;
const POPUP_MIN_RISE = 48;
const STATUS_POP_MIN_MS = 600;
// The stat windows and everything in them draw over the effect sheets (depth
// 0) and the damage numbers (1): a spell's sparks over a high flier, or any
// effect over a boss, reached up into the foe's window across its HP and WEAK
// lines. Under the hint (30); STREAK/COMBO and the NIGHT/ARENA/ABYSS note in
// the gap are at 120 already.
const STAT_DEPTH = 10;
// a spell's burst over the foe draws over a status sheet started with it (a
// BURN, CHILL or STUN that repaints the body hid the burst), under the damage
// numbers (1)
const SPELL_BURST_DEPTH = 0.5;
// how far right of the hero a spell's shot sets off: NOVA's orb further, so
// its 34-cell core clears the hero (from 40 it hid half the hero at launch)
const SHOT_START_X = 40;
const ORB_START_X = 104;
// a line's typewriter: ms a glyph at BATTLE SPEED 1 and its floor. At 14 the
// typing alone was 0.75-1.1s of a round's 1.9-2.2s (a 54-glyph row 0.76s).
const TYPE_MS = 10;
const TYPE_MIN_MS = 6;
// the least a line stays before a press moves on, however fast it was shown
// (say), and what a rushed line of news stays on top of that
const LINE_MIN_MS = 200;
const NEWS_HOLD_MS = 350;
const FREEZE_TINT = 0x67e8f9;
// a poison tick's purple, filled on the foe and multiplied on the hero, which
// warmStatuses bakes their poison sheets in ahead
const PSN_TINT = 0xc084fc;
const ENRAGE_TINT = 0xff7070;
// WARD's bubble round the hero (wardRing): its radius, half the 128px hero, as it ever was
const WARD_R = 64;
// each attack spell's projectile and the burst where it lands (fx.ts sheets)
const SPELL_FX: Record<string, readonly [string, string]> = {
  FIRE: ["fx-fireball", "fx-fire"],
  ICE: ["fx-iceshard", "fx-ice"],
  BOLT: ["fx-spark", "fx-bolt"],
  NOVA: ["fx-orb", "fx-nova"],
};
// a hit's sheet plays as long as the spark burst under it lives (hitBurst's lifespan)
const HIT_FX_MS = 300;
// a status sheet as long as its label's pop (flashStatus), floor and all
const STATUS_FX_MS = 900;
// the MOSS GOLEM's regrowth (regenerate): its 2.4s turn of leaves at 1.6x
const REGROW_FX_MS = 1500;
// a BOMB's toss (lobBomb): its flight and how high it arcs over the line, and
// its blast's 1.07s sheet a little faster
const BOMB_LOB_MS = 380;
const BOMB_HOP = 140;
const BOMB_FX_MS = 900;
// a restore's ring (ringOn): its 1.75s sheet at 1.5x, about the bag's 1.2s
const RESTORE_FX_MS = 1200;
// A boss's breath (breathOn, fx.ts fx-breath-*): the sheet's ms at 1x, and
// how long after it starts the blow lands, as the cone reaches the hero. The
// tilt turns it about the foe's mouth down toward the hero's chest; the
// crops in fx.ts are cut for it.
const BREATH_FX_MS = 900;
const BREATH_LAND_MS = 300;
const BREATHS: Record<string, { key: string; tilt: number }> = {
  [ENEMIES.flameDrake.name]: { key: "fx-breath-fire", tilt: -0.13 },
  [ENEMIES.salamander.name]: { key: "fx-spit-fire", tilt: 0 },
  [ENEMIES.iceGolem.name]: { key: "fx-breath-frost", tilt: -0.06 },
};
// A boss's move as it is shown (bossSheets.ts), by the move's name: the sheet,
// its length, how far in the hit lands (the wave breaks, the cloud bursts),
// whose feet it stands at, and its sound in place of the wind-up's. The
// sheets are cut 58 cells over the floor (y 224) and 8 under (y 488).
const MOVE_FX: Record<string, { key: string; ms: number; hit: number; sfx: string; on?: "foe" }> = {
  SPLASH: { key: "fx-bs-splash", ms: 1300, hit: 530, sfx: "move:splash" },
  SPORES: { key: "fx-bs-spores", ms: 1500, hit: 440, sfx: "move:spores" },
  SWEEP: { key: "fx-bs-sweep", ms: 700, hit: 130, sfx: "move:sweep" },
  ARMOR: { key: "fx-bs-armor", ms: 1200, hit: 0, sfx: "move:armor", on: "foe" },
};
// FRENZY's blows land in this in place of the plain hit's sparks
const CLUB_FX = "fx-bs-club";
// a HOWL's throb and red flush before the bite it leads into
const HOWL_MS = 480;
// the beats that stand in for a line: DEFEND's pop, a frozen turn's
const DEFEND_MS = 350;
const THAW_MS = 450;

// A companion skill's own sheet (fx.ts COMPANION_SHEETS) as its blow lands
// (skillFxOn), in place of the plain strike's fx-hit: its ms at 1x, on the
// foe's feet or, `ground`, on the ground under it (a flier's too); `back`, its
// back half, under the foe; `fade`, the share of its ms it fades out over,
// for one whose span ends with something still up; `drops`, more than one
// (x off the foe's, delay ms at 1x); `jolt`, a camera shake (ms, intensity).
// FIREBALL is FIRE's own shot and burst (companionCast), PILFER coins
// (pilferCoins).
interface SkillFx {
  key: string;
  ms: number;
  ground?: boolean;
  back?: string;
  fade?: number;
  drops?: [number, number][];
  jolt?: [number, number];
}
const SKILL_FX: Record<string, SkillFx> = {
  // a bite's claw sheet at about fx-hit's 300ms, its 0.57s at 1.6x
  "DOUBLE BITE": { key: "fx-claw", ms: 360 },
  // its orbs streaking off toward the hero fade as they go
  "BLOOD SIP": { key: "fx-sip", ms: 850, ground: true, fade: 0.35 },
  // its dust still rolling at 1s
  SMASH: { key: "fx-smash", ms: 800, ground: true, fade: 0.3, jolt: [160, 0.01] },
  // three icicles a beat apart, either side of the foe and on it last
  AVALANCHE: {
    key: "fx-icicle",
    ms: 650,
    ground: true,
    drops: [
      [-44, 0],
      [40, 90],
      [0, 180],
    ],
    jolt: [260, 0.006],
  },
  BLAZE: { key: "fx-blaze", ms: 1300, ground: true, back: "fx-blaze-back" },
  "VENOM STING": { key: "fx-sting", ms: 360 },
  // its pit still smoking at 1.5s
  MELT: { key: "fx-melt", ms: 1000, ground: true, fade: 0.2 },
  // still holding the foe at 1.6s; the stars (showStun) stay on after it
  "WEB SNARE": { key: "fx-web", ms: 1200, back: "fx-web-back", fade: 0.25 },
};
// FIREBALL's shot (companionCast): where it sets off, right of and over the
// FIRE IMP's middle (its right wing, at COMPANION_SCALE), and its flight to
// the foe, 780px at 1x
const COMPANION_SHOT_X = 22;
const COMPANION_SHOT_MS = 300;
// PILFER's coins (pilferCoins): their flight to the goblin's place, the hop
// of the first (each next one higher) and the beat between them
const PILFER_COIN_MS = 520;
const PILFER_HOP = 120;
const PILFER_GAP_MS = 90;
// a death of the foe's own (deathOf): its sheet's 2.4-2.45s squeezed in, the
// break-up some 1s in, the debris settled as the victory line has typed
const DEATH_FX_MS = 1800;
// the deaths' kinds: the snow field's and the volcano's rosters
const SHATTER_KIN = [ENEMIES.frostMoth, ENEMIES.auroraMoth, ENEMIES.yeti, ENEMIES.iceGolem].map((e) => e.name);
const BURNAWAY_KIN = [ENEMIES.magmaSlime, ENEMIES.fireImp, ENEMIES.gildedImp, ENEMIES.salamander, ENEMIES.flameDrake].map((e) => e.name);
// stone and the troll that turns to it: the forest's boss and golem
const PETRIFY_KIN = [ENEMIES.troll, ENEMIES.mossGolem].map((e) => e.name);

// a hero at this share of its max HP or less has its fall (soulFx.ts) baked
// before the move sheets, as the next blow or two may be its last
const SOUL_WARM_HP = 0.4;

// status labels sit right-aligned on the HP rows, 20px inside each window
const PLAYER_STATUS_RIGHT = 476;
const ENEMY_STATUS_RIGHT = GAME_WIDTH - 48;
// Player tags are size 5, 3 glyphs = 60px with 20px between. "HP 999/999"
// (MAX_HP) ends at x=304, so a row holds two (336..476); a third (WRD with
// PSN and FRZ up) wraps to a second row beside the HP bar (which ends at
// x=304 too, 20px short of the tags).
const PLAYER_STATUS_MIN_X = 324;
const STATUS_ROWS = [90, 114, 138];
// Each window's rows: the figures, and their bar 2px under them on a dark
// track as wide as the figures at their widest (10 glyphs x 24). The next
// row starts 6px or more under the bar, so a bar reads as the row's over it:
// with 8px either side, and the LIMIT gauge a bare bar over "HP", the empty
// gauge read as HP's bar and the green HP bar as MP's (which had none).
const STAT_BAR_W = 240;
const STAT_BAR_H = 8;
const HP_ROW_Y = 88;
const MP_ROW_Y = 128;
const HP_COLOR = 0x22c55e;
const MP_COLOR = 0x60a5fa;
// The LIMIT gauge's fill and its colour when full; its bar (x 156..276,
// right of its own label) and the three notches that cut it into quarters;
// where the figure right of it starts; and the tap box round the row (x
// 64..448 at its widest, touch's "TAP:BREAK!", y 70..86) padded 12px.
const LIMIT_COLOR = 0xf472b6;
const LIMIT_FULL_COLOR = 0xfde047;
const LIMIT_BAR_X = 156;
const LIMIT_BAR_W = 120;
const LIMIT_NOTE_X = 288;
const LIMIT_TAP = new Phaser.Geom.Rectangle(52, 58, 408, 40);
// The enemy side works the same way: "HP 700/700" (an HARD 3 FLAME DRAKE, the
// most HP in the game) and the HP bar end at x=1056, and the tags keep to x
// 1072..1232 on all three rows (y 90, 114, 138, the third beside "WEAK:FIRE",
// which ends at x=996; the COMBO line is under them at y=168). The 160px
// hold two short tags (CHG or PSN/BRN/CHL, 60px, with RAGE or ATK+/DEF+, 80)
// or one long one, and layoutTags puts each in the first row with room, so
// the most a fight can raise fits the three:
// - a boss or giant (never an elite, elite.ts): CHG or its move's tag (the
//   two are never up together, rollIntent), RAGE, PSN/BRN, CHL, and the
//   GLACIER GOLEM alone a DEF+ besides: CHG DEF+ / RAGE PSN / CHL, or
//   >ARMOR / DEF+ PSN / RAGE CHL;
// - any other foe: CHG (ORC, YETI, SALAMANDER, which have no move) or its
//   move's tag or the buff that leaves (one use), PSN/BRN, CHL, and an
//   elite's tag (to 120px): >SNATCH / PSN CHL / STURDY.
// At 152px (x 1076..1228) and filled a row at a time, the GLACIER GOLEM's
// five ran on leftwards along the third row, over "WEAK:FIRE". An elite's
// tag with RAGE cannot happen; forced, the third row runs over WEAK.
// The player never has more than three tags.
const ENEMY_STATUS_MIN_X = 1072;
// ...which is why a foe's HP stays three digits (battleRules ENEMY_HP_MAX): a
// fourth would run "HP" into the first tag. Nothing outside the deep ABYSS
// comes near it.
const DOT_COLOR = { PSN: "#c084fc", BRN: "#fb923c" } as const;
// the action menu splits into two rows, rather than shrinking its font, once
// one row at size 5 would leave less than MENU_MIN_GAP between buttons (see
// layoutMenu()); one row sits on MENU_Y, two MENU_ROW_GAP apart on MENU_ROWS_Y
const MENU_MARGIN = 48;
const MENU_MIN_GAP = 20;
const MENU_ROW_GAP = 40;
const MENU_Y = GAME_HEIGHT - 184;
const MENU_ROWS_Y = [GAME_HEIGHT - 208, GAME_HEIGHT - 172];

type MenuAction =
  | "fight"
  | "magic"
  | "skill"
  | "defend"
  | "limit"
  | "run"
  | "steal"
  | "foe"
  | "potion"
  | "mPotion"
  | "candy"
  | "hiPotion"
  | "ether"
  | "elixir"
  | "bomb";
// one flat action row, spells included at the same level as everything else;
// a spell button carries its Spell and resolves as a "magic" action; "item"
// and "skills" open their lists
interface MenuButton {
  label: string;
  action: MenuAction | "item" | "skills";
  spell?: Spell;
  enabled?: () => boolean;
}

interface ItemSlot {
  label: string;
  key: keyof typeof GameState.inventory;
  action: MenuAction;
}

const ITEM_SLOTS: ItemSlot[] = [
  { label: "POTION", key: "potion", action: "potion" },
  { label: "MPOTION", key: "mPotion", action: "mPotion" },
  { label: "CANDY", key: "candy", action: "candy" },
  { label: "HI-POTION", key: "hiPotion", action: "hiPotion" },
  { label: "ETHER", key: "ether", action: "ether" },
  { label: "ELIXIR", key: "elixir", action: "elixir" },
  { label: "BOMB", key: "bomb", action: "bomb" },
];

const ITEMS_PER_ROW = 4;
const ITEM_TEXT_OFFSET = 32;
// Each column as wide as its longest entry at two digits, 24px glyphs plus
// the 4px outline, with the cursor's ITEM_TEXT_OFFSET in front: POTION x99
// 32 + 244, MPOTION x99 32 + 268, CANDY x99 32 + 220, HI-POTION x99 32 + 316
// = 1176px, spread over x 24..1256 with ~19px between columns. At a flat
// 280px a column, MPOTION x10 already ran 16px into the next one's cursor.
const ITEM_COL_X = [24, 319, 637, 908];
// the item list's line on a touch screen, where H/J/K/L, Z and ESC aren't
// there: a tap picks an item, a second tap on it uses it (onPointerDown),
// and a tap off the list goes back. 43 glyphs at 16px = 688px, x 296..984.
const TOUCH_ITEM_HINT = "TAP:SELECT  TAP AGAIN:USE  TAP OUTSIDE:BACK";

// The SKILL list (X) works as the item list does, on the backdrop under the
// fighters, the 26 moves in the order they are learned, in pages of three
// columns by four rows: rows 32px apart from y 488, so y 474..598, where the
// item list's info line and hint were. Those two go into the message box (y
// 604..716) while the list is up, over the battle's last line, hidden till
// it closes. Four columns of 24px glyphs don't fit the longest names (DAGGER
// FLURRY 13, FLAME PILLAR / FIRE TORNADO / HEAVY CLEAVE / DOUBLE SLASH 12
// each in a column of their own: 49 glyphs and four cursors, 1320px), and four
// rows are all there is room for, so 12 a page (3 pages at Lv29). Columns a
// third of x 24..1256 apart, each name after the cursor's ITEM_TEXT_OFFSET:
// the longest, DAGGER FLURRY, 316px from x 466 to 782, FLAME PILLAR from 876
// to 1168.
const SKILLS_PER_ROW = 3;
const SKILL_ROWS = 4;
const SKILLS_PER_PAGE = SKILLS_PER_ROW * SKILL_ROWS;
const SKILL_COL_X = [24, 434, 844];
const SKILL_ROW_Y = [488, 520, 552, 584];
// In the message box: the cursor's skill on the battle line's own row
// ("DOUBLE SLASH  14 MP  Two quick cuts of your weapon." in bodyStyle(33), 54
// glyphs at most: battleRules MoveBase.info), the key hint under it, 16px
// glyphs at y 682..698, and with more than one page "< 1/3 >" right of it (x
// 1104..1216, tapped on a half to turn back or on). The touch hint,
// TOUCH_ITEM_HINT, is 688px, x 296..984.
const SKILL_INFO_Y = GAME_HEIGHT - 104;
const SKILL_HINT_Y = GAME_HEIGHT - 30;
const SKILL_PAGE_RIGHT = GAME_WIDTH - 64;
// the move the list was last left on, kept for the next battle's cursor (not
// saved: a reload starts at the top)
let lastSkill: string | undefined;
// how long a skill's effects may run before its hits land regardless
// (playSkill not settling would hold the battle there for good)
const SKILL_FX_TIMEOUT_MS = 8000;
// a multi-hit skill's damage numbers, each this far right of the last, the
// row centred on the foe, so five stars' numbers don't pile on one spot
const SKILL_POP_STEP = 40;

// skillFx.ts and techFx.ts play as many blows as they list, the rules deal
// as many as battleRules lists, skillSfx.ts has a sound for as many, and a
// weapon tech is one techFx.ts plays up close. They must agree (castSkill
// would land the rest at the end of the effects, or leave a blow without
// damage, or dash in for a spell; playSkillSfx would repeat the last blow's
// sound).
const fxHits = (s: Skill): number => (s.style === "blow" ? SKILL_HITS[s.name] : TECH_HITS[s.name]);
if (process.env.NODE_ENV !== "production") {
  for (const s of SKILLS) {
    if (fxHits(s) !== s.hits) console.error(`${s.name}: ${s.hits} hits in battleRules.ts, ${fxHits(s)} in its effects`);
    if (skillSfxHits(s.name) !== fxHits(s))
      console.error(`${s.name}: ${skillSfxHits(s.name)} blow sounds in skillSfx.ts, ${fxHits(s)} in its effects`);
    if (s.style !== "blow" && TECH_MELEE[s.name] !== (s.style === "weapon")) console.error(`${s.name}: weapon or spell?`);
  }
}

// A fighter's feet on its texture, read off the pixels once per texture: how
// far under the centre its lowest opaque row ends, and the middle and width
// of its bottom FOOT_ROWS rows (its feet) and of its whole body, in texture
// pixels from the centre. The grids leave different margins under the feet
// (the SLIME none, the GOBLIN 8px, the BAT 26px), so a centre puts no two on
// the same ground.
interface Footing {
  feet: number;
  footX: number;
  footW: number;
  bodyX: number;
  bodyW: number;
}
const FOOT_ROWS = 8;
const footings = new Map<string, Footing>();

function footingOf(scene: Phaser.Scene, key: string): Footing {
  const known = footings.get(key);
  if (known) return known;
  const src = scene.textures.get(key).getSourceImage();
  const { width: w, height: h } = src;
  let footing: Footing = { feet: h / 2, footX: 0, footW: w, bodyX: 0, bodyW: w };
  // off the art's own canvas (texelsOf): copied into a new canvas first, the
  // read waited on the GPU for both, up to 17ms of the first battle's create
  const data = src instanceof HTMLCanvasElement || src instanceof HTMLImageElement ? texelsOf(src, 0, 0, w, h) : null;
  if (data) {
    const span = (y0: number, y1: number): [number, number] => {
      let l = w;
      let r = -1;
      for (let y = y0; y <= y1; y++)
        for (let x = 0; x < w; x++)
          if (data[(y * w + x) * 4 + 3] > 0) {
            l = Math.min(l, x);
            r = Math.max(r, x);
          }
      return [l, r + 1];
    };
    let bottom = h - 1;
    while (bottom >= 0 && span(bottom, bottom)[1] === 0) bottom--;
    if (bottom >= 0) {
      const [fl, fr] = span(Math.max(0, bottom - FOOT_ROWS + 1), bottom);
      const [bl, br] = span(0, bottom);
      footing = { feet: bottom + 1 - h / 2, footX: (fl + fr - w) / 2, footW: fr - fl, bodyX: (bl + br - w) / 2, bodyW: br - bl };
    }
  }
  footings.set(key, footing);
  return footing;
}

// a fighter on the ground (stand()), and what its shadow follows (syncShadow)
interface Stance {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Graphics;
  // the sprite's y and scale at rest, its shadow's strength there, and the
  // shadow's middle off the sprite's centre in texture pixels
  restY: number;
  scale: number;
  alpha: number;
  offX: number;
  // tweened to 0 to take the shadow off a foe that stays on screen (catchFx)
  fade: number;
}

// a region's ordinary fights play its own take on the battle riff (see
// audio.ts); the Town and the Dungeon keep the original
const REGION_BATTLE_THEMES: Record<string, typeof BATTLE_THEME> = {
  Forest: FOREST_BATTLE_THEME,
  Snow: SNOW_BATTLE_THEME,
  Volcano: VOLCANO_BATTLE_THEME,
};

export class BattleScene extends Phaser.Scene {
  private enemy!: EnemyDef & { curHp: number };
  private enemySprite!: Phaser.GameObjects.Sprite;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private weaponOverlay!: Phaser.GameObjects.Sprite;
  private readonly nudging = new Map<Phaser.GameObjects.Sprite, { home: number; tween: Phaser.Tweens.Tween }>();
  private shieldOverlay!: Phaser.GameObjects.Sprite;
  private msgText!: TypedText;
  // the line typing out now (type()), cut off by the next one
  private typing?: Phaser.Time.TimerEvent;

  private menuButtons: MenuButton[] = [];
  private menuTexts: PixelText[] = [];
  // vertical tap padding around each menu button: 14px for the single row
  // (short of the hint line at y=568), 8px once there are two rows
  private menuHitPadY = 14;

  private inItems = false;
  private itemIndex = 0;
  private itemTexts: PixelText[] = [];
  private itemCursor!: PixelText;
  private itemInfoText!: PixelText;

  // the SKILL list (X), one text per skill known this battle
  private inSkills = false;
  private skillIndex = 0;
  private skillTexts: PixelText[] = [];
  private skillCursor!: PixelText;
  private skillInfoText!: PixelText;
  private skillHintText!: PixelText;
  // "< 1/3 >" beside the hint while there is more than one page
  private skillPageText!: PixelText;
  private pendingSkill!: Skill;

  private pendingSpell!: Spell;
  private companionSprite?: Phaser.GameObjects.Sprite;
  // the breathing tweens (idleBob), stopped when their fighter falls and
  // paused while the hero is frozen or the companion dashes
  private heroIdle?: Phaser.Tweens.Tween;
  private enemyIdle?: Phaser.Tweens.Tween;
  // the foe's size as made (2, a boss's or giant's too: their 48-cell art is
  // the size), which every throb grows from and returns to; the throb running
  // now, if any
  private enemyBaseScale = 2;
  private enemyPulse?: Phaser.Tweens.Tween;
  private companionIdle?: Phaser.Tweens.Tween;
  // each fighter's footing and shadow (stand())
  private heroStance!: Stance;
  private enemyStance!: Stance;
  private companionStance?: Stance;
  private hintText!: PixelText;
  private help!: BattleHelp;
  // while a foe's blow (PARRY) or FIGHT's (PERFECT) is on its way: null
  // until the first press, then when it came (performance.now); undefined
  // outside a blow
  private timedPress: number | null | undefined;
  // until when (performance.now) a press is a late one, after a blow no
  // press met, and whose blow it was
  private timedLate = 0;
  private timedStrike = false;
  // the round a frozen hero thaws on: no PARRY against that round's blow
  private thawing = false;

  private playerHpBar!: Phaser.GameObjects.Rectangle;
  private playerMpBar!: Phaser.GameObjects.Rectangle;
  private enemyHpBar!: Phaser.GameObjects.Rectangle;
  private playerHpText!: PixelText;
  private playerMpText!: PixelText;
  private enemyHpText!: PixelText;

  private running = false;
  private night = false;
  private waitingAction: { resolve: (a: MenuAction) => void } | null = null;
  private origin: "Town" | "Dungeon" | "Forest" | "Snow" | "Volcano" | "Abyss" = "Town";
  // set for an ARENA bout (see arena.ts); null for every ordinary battle
  private arena: ArenaRun | null = null;
  // the ARENA's first ESC:QUIT asked, the next one leaves
  private leaveArmed = false;
  // set for a TRAINING YARD bout (see practice.ts); null for every other battle
  private practice: PracticeRun | null = null;
  // set for a fight down in the ABYSS (see abyss.ts): its floor, and whether
  // the foe is that floor's GUARDIAN
  private abyss: AbyssBout | null = null;
  // a field boss or the TROLL KING fought again after its first kill (see
  // init)
  private rematch = false;
  // The LIMIT gauge (limit.ts) as this battle has it, GameState's but in the
  // yard, and the two HP figures it was last brought up to date with
  // (syncLimit); its bar and label under the hero's name
  private limit = 0;
  // the foe fell to a LIMIT BREAK's blow (the FINISHER trophy, feats.ts)
  private limitKill = false;
  private limitSeen = { foe: 0, hero: 0 };
  private limitBar!: Phaser.GameObjects.Rectangle;
  private limitText!: PixelText;
  private limitLabel!: PixelText;
  // the foe is an elite of its kind (elite.ts), rolled in init
  private elite: EliteKind | null = null;
  // a seal's keeper (seals.ts): the name the opening line gives it
  private keeperName: string | null = null;
  // who strikes before the first turn (init's `opening`), if either
  private opening: "hero" | "foe" | null = null;
  private combo = 0;
  private comboText!: PixelText;
  // one successful steal per battle; failed attempts don't count against it
  private stolen = false;
  // whether the bestiary had this species before the fight (see init)
  private weakKnown = false;
  private poisonTurns = 0;
  private frozen = false;
  private freezeGrace = 0;
  private enraged = false;
  // a boss, giant or big foe mid wind-up (its strike lands on its next
  // turn), and the turns left before it may wind up again (see BOSS_TELLS)
  private charging = false;
  private tellCooldown = 0;
  private chargeText!: PixelText;
  // The foe's move (monsters.ts EnemyMove): `intent`, it comes next turn, its
  // tag (">HOWL") pulsing in the foe's window from the moment it is rolled
  // (rollIntent: before the first turn and after each of the foe's);
  // `moved`, it was last turn's, so not this one's; `foeBuff`, what a HOWL or
  // HARDEN left ("ATK+" / "DEF+"); `snatched`, the gold a SNATCH holds until
  // the foe falls.
  private intent = false;
  private moved = false;
  // a boss's move: how many of its HP marks (EnemyMove.at) it has announced,
  // and what an ARMOR has left: the DEF it put on and the foe's turns to go
  private movesUsed = 0;
  private armor: { def: number; turns: number } | null = null;
  private foeBuff: "ATK+" | "DEF+" | null = null;
  private snatched = 0;
  private intentText!: PixelText;
  private eliteText!: PixelText;
  private buffText!: PixelText;
  private wardTurns = 0;
  // companion skill state on the enemy (see companionSkills.ts), which the
  // elemental spells' side effects share: a poison or burn ticking down, a
  // web or a BOLT's shock costing its next turn, CHILL/PILFER spent
  private enemyDot: { label: "PSN" | "BRN"; turns: number } | null = null;
  private stuck: "web" | "shock" | null = null;
  // the stars round a stuck foe's head (statusFx's stun loop): what fades them out
  private stunStars?: () => void;
  private chilled = false;
  // the ATK a chill took, given back when a SHATTER spends it
  private chillLost = 0;
  // a reaction went off this cast: the first one a save sees gets its tip
  private reacted = false;
  // a FIGHT has been struck this battle (QUICK's is the first)
  private opened = false;
  // the poison's cure has been said this battle (afflict)
  private poisonTold = false;
  private pilfered = false;
  // ORC's BULWARK: halves the next enemy hit, then it's gone
  private guarded = false;
  // DEFEND, for the enemy turn after it (battleRules DEFEND_MULT)
  private defending = false;
  // the killing blow was a weakness spell's (WEAK FINISH, drops.ts)
  private weakFinish = false;
  private dotText!: PixelText;
  private chillText!: PixelText;
  private poisonText!: PixelText;
  private frozenText!: PixelText;
  private wardText!: PixelText;
  // the meal from HOME this battle is fought on (cooking.ts)
  private meal: { def: MealDef; left: number } | null = null;
  // ...and the field shrine's blessing beside it (shrine.ts)
  private blessing: { def: BlessingDef; left: number } | null = null;
  // WELL RESTED from the HOME's FEATHER BEDS (home.ts): WARD up at the start
  private rested = false;
  private rageText!: PixelText;
  // a pale bubble around the hero for as long as WARD holds
  private wardRing!: Phaser.GameObjects.Graphics;

  // the status and recovery effects, baked for this battle's fighters (statusFx.ts)
  private statusFx!: StatusFx;
  private hitBurst!: Phaser.GameObjects.Particles.ParticleEmitter;
  private glowBurst!: Phaser.GameObjects.Particles.ParticleEmitter;
  private coinBurst!: Phaser.GameObjects.Particles.ParticleEmitter;
  private catchBurst!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super("Battle");
  }

  init(data: {
    enemy: string;
    from?: "Town" | "Dungeon" | "Forest" | "Snow" | "Volcano" | "Abyss";
    arena?: ArenaRun;
    abyss?: AbyssBout;
    practice?: PracticeRun;
    // a field seal's keeper (seals.ts): the elite it is fought as, not
    // rolled, and its own HP and ATK on top
    keeper?: KeeperBout;
    // the elite roll the field already made for this meeting (overrun.ts
    // meet, which fights an elite and may overrun the rest): not rolled again
    elite?: EliteKind | null;
    // FIRST STRIKE (sceneCommon firstStrike): who gets a blow in before the
    // first turn, by how the hero and a roamer met in the field
    opening?: "hero" | "foe";
  }): void {
    // Phaser reuses the scene instance across scene.start(), so per-battle
    // counters must reset here rather than in the field initializer
    this.arena = data?.arena ?? null;
    this.abyss = data?.abyss ?? null;
    this.practice = data?.practice ?? null;
    // a meal lasts so many battles: this one takes its charge now, won, lost
    // or fled, each ARENA bout included, and keeps the meal to its end
    this.meal = this.practice ? null : takeMealCharge(GameState);
    // a shrine's blessing is counted the same way
    this.blessing = this.practice ? null : takeBlessingCharge(GameState);
    this.combo = 0;
    this.stolen = false;
    this.poisonTurns = 0;
    this.frozen = false;
    this.intent = false;
    this.moved = false;
    this.movesUsed = 0;
    this.armor = null;
    this.foeBuff = null;
    this.snatched = 0;
    this.thawing = false;
    this.timedPress = undefined;
    this.freezeGrace = 0;
    this.enraged = false;
    this.charging = false;
    this.tellCooldown = 0;
    this.wardTurns = 0;
    // spent by this battle, whatever it is
    this.rested = !this.practice && GameState.rested;
    if (!this.practice) GameState.rested = false;
    if (this.rested) this.wardTurns = RESTED_WARD_TURNS;
    this.enemyDot = null;
    this.stuck = null;
    // the last battle's, gone with its scene
    this.stunStars = undefined;
    this.chilled = false;
    this.chillLost = 0;
    this.reacted = false;
    this.opened = false;
    this.poisonTold = false;
    this.pilfered = false;
    this.guarded = false;
    this.defending = false;
    this.weakFinish = false;
    const def = keeperDef(ENEMIES[data?.enemy ?? ""] ?? ENEMIES.slime, data?.keeper);
    // Night is the risk/reward shift: tougher enemies, richer payout. Applied
    // to the copy, so ENEMIES stays the daytime baseline. Two exceptions, from
    // the balance audit:
    // - a boss keeps its daytime HP/ATK, though not its daytime payout. A boss
    //   is a gate the story sends you through, and night x1.25 on HARD MODE's
    //   x2.5 left an HARD 3 night FLAME DRAKE unwinnable. The TROLL KING, a
    //   giant, keeps the whole shift: it roams the town fields like any wild
    //   foe, so meeting it at night is a choice, and it's Lv8 content that HARD
    //   outgrows.
    // - the ARENA takes no night shift at all. Its bouts are the bosses (stats
    //   already exempt) and that TROLL KING, and its prize is a share of their
    //   gold, so night would only pay x1.5 for the same risk. HARD MODE scaling
    //   still applies there: that risk is real.
    // - the ABYSS has no night either: no sky underground, and its depth
    //   scaling below is its whole risk/reward curve (abyss.ts).
    // HARD MODE: each cycle hardens every foe on top of the night shift
    // (GameState.enemyScale; 1 and 1 on a first playthrough), and in the ABYSS
    // the floor's depth on top of that (abyss.ts abyssScale, capped). HP stops
    // at ENEMY_HP_MAX, which only the deep ABYSS ever reaches. A GUARDIAN pays
    // a cut of its gold, as an ARENA bout does: its first kill already paid
    // in full (abyss.ts). So does a field boss met again once its quest flag
    // is set (the ARENA's own lineup check, read before this fight's victory
    // sets it, and cleared by HARD MODE so a cycle's first kill pays in
    // full). Its field raises it on every visit and the hero comes back from
    // the fight beside it, so a full purse a kill was a farm: the FLAME
    // DRAKE's 1,260 G by day on an 8+ streak, 1,890 by night, one kill every
    // ~30s (a Lv30 hero in MYTHRIL with the WOLF fells it in five rounds,
    // ~14s clicked through as fast as the text allows). It pays what its
    // ARENA bout does instead, no night bonus, win-streak bonus or PUMPKIN
    // PIE, and no sure HI-POTION; its EXP and materials stay. That is 175 G,
    // ~21k G an hour, near the ARENA's 18-20k (arena.ts). The TROLL KING, a
    // giant and in that lineup too, is the same farm by chance: every Town
    // build (each fight there ends in one) rolls it into a meadow 35% of the
    // time, so a ~5s slime fight rerolls it, and that hero fells it in two
    // or three rounds (~7.5s) for 360 G by day on the streak, 540 by night.
    // A kill every ~20s knowing its meadow, ~35s going by what the screen
    // shows: 38-64k G an hour by day. Its rematch pays 50 G. The arithmetic
    // is battleRules.scaleEnemy's.
    this.night = isNight() && !this.abyss;
    this.rematch = !this.arena && !this.abyss && !!ARENA_BOSSES.find((b) => b.key === data?.enemy)?.beaten();
    const fought = { arena: !!this.arena, practice: !!this.practice, abyss: !!this.abyss, battles: GameState.battles };
    this.elite = data?.keeper?.elite ?? (data && "elite" in data ? (data.elite ?? null) : rollElite(def, fought));
    this.keeperName = data?.keeper?.name ?? null;
    this.opening = data?.opening ?? null;
    this.enemy = scaleEnemy(def, {
      night: this.night,
      arena: !!this.arena,
      abyss: this.abyss,
      ng: GameState.enemyScale(),
      rematch: this.rematch,
      elite: this.elite,
    });
    if (this.practice) {
      this.enemy.hp = practiceHp(this.enemy.hp, GameState.effAtk());
      this.enemy.curHp = this.enemy.hp;
    }
    // the dive's relics (relics.ts), nothing outside the ABYSS
    this.wardTurns = Math.max(this.wardTurns, openRelicBout(this.abyss, this.enemy, GameState.player));
    const from = data?.from;
    this.origin = from === "Dungeon" || from === "Forest" || from === "Snow" || from === "Volcano" || from === "Abyss" ? from : "Town";
    // read before this fight puts the species in the bestiary, below: the
    // enemy window shows its weakness only once an earlier fight has
    this.weakKnown = this.practice !== null || GameState.seenMonsters.includes(def.name);
    // the yard's foes aren't met for the bestiary, a weakness shown from the start
    if (!this.practice && !GameState.seenMonsters.includes(def.name)) {
      GameState.seenMonsters.push(def.name);
      // persist immediately: a battle ended by RUN never reaches the
      // victory-path save, which would lose the bestiary entry on reload
      GameState.save();
    }
  }

  create(): void {
    Sfx.playBgm(this.enemy.boss || this.enemy.giant ? BOSS_THEME : (REGION_BATTLE_THEMES[this.origin] ?? BATTLE_THEME));
    this.menuTexts = [];
    this.itemTexts = [];
    this.inItems = false;
    this.itemIndex = 0;
    this.skillTexts = [];
    this.inSkills = false;
    this.skillIndex = 0;
    this.waitingAction = null;
    this.typing = undefined;

    const unsubSaved = onSaved(() => showToast(this, "SAVED"));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubSaved);

    // the town's and the forest's in the season's look, as their maps are; the
    // ABYSS has its own (src/backdrops.ts) and the cave's lack of weather
    const field = this.origin === "Abyss" ? "Dungeon" : this.origin;
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, battleBgKey(this.origin));
    addBattleWeather(this, field);
    // The night shade covers just the backdrop and its weather: everything
    // added after it (fighters, windows, menus, numbers) draws on top at full
    // brightness. Over the whole screen it dimmed every line of UI text. It's
    // the open-ground sky of the field the fight started in (the ARENA's is
    // the Town's), dawn and dusk colours included, so it carries straight on
    // from the field; static, since the clock doesn't advance during a battle.
    // MULTIPLY, as on the field (NightOverlay). The ABYSS has no sky and no
    // night (see init).
    const sky = skyOverlay(this.origin);
    if (sky !== 0xffffff && !this.abyss) {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, sky).setBlendMode(Phaser.BlendModes.MULTIPLY);
    }

    // STREAK/COMBO live on the free line inside each stat window (below the
    // MP/HP rows) — at (16,24)/(GAME_WIDTH-16,24) they sat on top of the
    // window borders and the player/enemy names
    if (GameState.streak >= STREAK_MIN) {
      this.add.pixelText(64, 170, `STREAK ${GameState.streak}`, retroStyle(6, "#fbbf24")).setDepth(120);
    }

    // live combo counter, filled in by updateCombo() on every fight/heal turn
    this.comboText = this.add.pixelText(GAME_WIDTH - 464, 168, "", retroStyle(6, "#fbbf24")).setDepth(120);

    // Stacked in the gap between the two stat windows (x 496..784): as one
    // 840px line across the top it ran over both windows and the foe's name.
    // "TOUGHER FOES" is 12 x 20 = 240px, x 520..760, 24px clear of each
    // window. It says only what the night changes here (see init): the
    // payout for a boss, nothing in the ARENA, whose label takes the gap.
    if (this.night && !this.arena && !this.practice) {
      this.add
        .pixelText(
          GAME_WIDTH / 2,
          40,
          this.enemy.boss ? "NIGHT\nRICHER LOOT" : "NIGHT\nTOUGHER FOES\nRICHER LOOT",
          retroStyle(5, "#a5b4fc"),
        )
        .setOrigin(0.5, 0)
        .setAlign("center")
        .setLineSpacing(8)
        .setDepth(120);
    }

    // in the gap between the two stat windows (x 496..784), where the night
    // note goes outside the ARENA: "ARENA 5/5" is 9 x 24 = 216px, x 532..748
    if (this.arena) {
      this.add
        .pixelText(GAME_WIDTH / 2, 64, `ARENA ${this.arena.round + 1}/${this.arena.lineup.length}`, retroStyle(6, "#fbbf24"))
        .setOrigin(0.5, 0)
        .setDepth(120);
    }
    // ...and the yard's, "PRACTICE" being 8 x 24 = 192px
    if (this.practice) {
      this.add
        .pixelText(GAME_WIDTH / 2, 64, "PRACTICE", retroStyle(6, "#4ade80"))
        .setOrigin(0.5, 0)
        .setDepth(120);
    }
    // ...and the ABYSS floor in the same spot (no night note down there):
    // "ABYSS B999" is 10 x 24 = 240px, x 520..760
    if (this.abyss) {
      this.add
        .pixelText(GAME_WIDTH / 2, 64, `ABYSS B${this.abyss.floor}`, retroStyle(6, "#c084fc"))
        .setOrigin(0.5, 0)
        .setDepth(120);
    }

    // Bosses and giants draw at 2x as every battler does, their 48-cell art
    // (96px) making them 192px. On the ground their tops are at y 264 (KING
    // SLIME, TROLL KING) and 268 (the golems, the FLAME DRAKE), about 235-240
    // through the 1.15x charge pulse: clear of the enemy window (to y 200),
    // which a boss centred at 280 ran under, hiding the drake's horns. The
    // fliers' tops are at 256 at most.
    this.enemyBaseScale = 2;
    this.enemySprite = this.add.sprite(GAME_WIDTH - 320, 0, battleTexture(this, this.enemy.texture)).setScale(this.enemyBaseScale);
    this.playerSprite = this.add.sprite(320, 0, battleTexture(this, "hero-down-0")).setScale(2);
    this.playerSprite.setFlipX(true);
    this.enemyStance = this.stand(this.enemySprite, GROUND_Y, !!this.enemy.flying);
    this.heroStance = this.stand(this.playerSprite, GROUND_Y);
    // the gear in the hero's hands as on the field facing the camera (ui/HeroGear.ts), at the battle's 2x
    this.weaponOverlay = this.add.sprite(0, 0, battleTexture(this, GameState.weaponTexture())).setScale(2);
    this.shieldOverlay = this.add.sprite(0, 0, battleTexture(this, GameState.armorTexture())).setScale(2);
    this.weaponOverlay.setVisible(!!GameState.equipped.weapon);
    this.shieldOverlay.setVisible(!!GameState.equipped.armor);
    this.syncGear();

    const companionDef = Object.values(ENEMIES).find((e) => e.name === GameState.companion);
    // assigned either way: the scene instance outlives a battle (see init),
    // and a companion dismissed since the last one would leave its sprite here
    this.companionSprite = companionDef ? this.add.sprite(COMPANION_X, 0, companionDef.texture).setScale(COMPANION_SCALE) : undefined;
    this.companionStance = this.companionSprite && this.stand(this.companionSprite, COMPANION_GROUND_Y, !!companionDef?.flying);

    this.heroIdle = this.idleBob(this.playerSprite, 1400, 0);
    this.enemyIdle = this.idleBob(this.enemySprite, 1700, 500, this.enemy.flying);
    this.companionIdle = this.companionSprite && this.idleBob(this.companionSprite, 1200, 900, companionDef?.flying);

    this.window(32, 24, 464, 176);
    this.window(GAME_WIDTH - 496, 24, 464, 176);

    this.add.pixelText(64, 40, GameState.player.name, retroStyle(7, "#ffd166")).setOrigin(0, 0).setDepth(STAT_DEPTH);
    // The hero's rows, top to bottom: the name (y 40..68), the LIMIT gauge
    // (70..86), HP's figures (88..112) and bar (114..122), MP's (128..152,
    // 154..162), and STREAK (170..194) under them.
    this.playerHpText = this.add
      .pixelText(64, HP_ROW_Y, "HP " + GameState.player.hp + "/" + GameState.effMaxHp(), retroStyle(6, "#ffffff"))
      .setOrigin(0, 0)
      .setDepth(STAT_DEPTH);
    this.playerMpText = this.add
      .pixelText(64, MP_ROW_Y, "MP " + GameState.player.mp + "/" + GameState.player.maxMp, retroStyle(6, "#8ecbff"))
      .setOrigin(0, 0)
      .setDepth(STAT_DEPTH);

    // scaled to what the hero brings in, as updatePlayerStats() keeps them
    // after every change: a fight entered hurt used to open on a full bar
    // over its true "HP 21/30" until the first blow redrew it
    this.playerHpBar = this.statBar(64, HP_ROW_Y, HP_COLOR);
    this.playerMpBar = this.statBar(64, MP_ROW_Y, MP_COLOR);
    this.addLimitGauge();

    this.add
      .pixelText(GAME_WIDTH - 464, 40, this.enemy.name, retroStyle(7, this.elite ? ELITES[this.elite].color : "#ff5555"))
      .setOrigin(0, 0)
      .setDepth(STAT_DEPTH);
    // An elite's tag (elite.ts), in its colour as its name is: the last of
    // the status tags (updateEnemyStatus), so it sits on the HP row alone and
    // moves down a row for each row of tags over it. Fixed on the WEAK row
    // (then y 140) it lay under a third row of tags (y 138). "STURDY" is 6 x 20 =
    // 120px; an elite has three rows at most (its move's tag or buff, or a
    // wind-up's CHG; PSN/BRN with CHL; this), and on the third it is clear of
    // "WEAK:FIRE" (to x=996).
    this.eliteText = this.add
      .pixelText(
        ENEMY_STATUS_RIGHT,
        90,
        this.elite ? ELITES[this.elite].tag : "",
        retroStyle(5, this.elite ? ELITES[this.elite].color : DIM_TEXT),
      )
      .setOrigin(1, 0)
      .setDepth(STAT_DEPTH)
      .setVisible(false);
    this.enemyHpText = this.add
      .pixelText(GAME_WIDTH - 464, 88, "HP " + this.enemy.curHp + "/" + this.enemy.hp, retroStyle(6, "#ffffff"))
      .setOrigin(0, 0)
      .setDepth(STAT_DEPTH);
    this.enemyHpBar = this.statBar(GAME_WIDTH - 464, HP_ROW_Y, 0xef4444);
    // The foe's weakness worded and coloured as the bestiary has it
    // (BestiaryUI's "WEAK:FIRE"), once an earlier fight has put the species
    // there; "WEAK:?" the first time, the book having nothing either, and
    // "WEAK:-" for one with none. Between the HP bar (to y=122) and the COMBO
    // line (from 168), y 138..158, level with the status tags' third row;
    // "WEAK:FIRE" is 9 x 20 = 180px from x=816, clear of that row (from
    // x=1072, ENEMY_STATUS_MIN_X).
    const weak = this.enemy.weakness;
    this.add
      .pixelText(
        GAME_WIDTH - 464,
        138,
        !this.weakKnown ? "WEAK:?" : weak ? `WEAK:${weak.toUpperCase()}` : "WEAK:-",
        retroStyle(5, this.weakKnown && weak ? "#fdba74" : DIM_TEXT),
      )
      .setOrigin(0, 0)
      .setDepth(STAT_DEPTH);

    // one size smaller than the HP rows so "HP 999/999" (ends x=304) keeps a
    // gap to "PSN FRZ" (x=336..476) when both statuses are up
    this.poisonText = this.add.pixelText(0, 90, "PSN", retroStyle(5, "#c084fc")).setOrigin(1, 0).setDepth(STAT_DEPTH);
    this.frozenText = this.add.pixelText(0, 90, "FRZ", retroStyle(5, "#67e8f9")).setOrigin(1, 0).setDepth(STAT_DEPTH);
    this.wardText = this.add.pixelText(0, 90, "WRD", retroStyle(5, "#93c5fd")).setOrigin(1, 0).setDepth(STAT_DEPTH);
    // the meal's tag and battles left, this one counted, on the MP row
    // right-aligned in the window: "MP 999/999" and its bar end at x=304, the
    // longest tag "GRILL 5" (140px) starts at 336; y 136..156, 2px under the
    // status tags' second row (to 134) and 16px over the blessing's
    if (this.meal)
      this.add.pixelText(476, 136, `${this.meal.def.tag} ${this.meal.left}`, retroStyle(5, "#fdba74")).setOrigin(1, 0).setDepth(STAT_DEPTH);
    // the blessing's the same on the STREAK row under it: "STREAK 999" ends
    // at x=304, "STONE 6" (140px) starts at 336, y 172..192 in the window's 200
    if (this.blessing)
      this.add
        .pixelText(476, 172, `${this.blessing.def.name} ${this.blessing.left}`, retroStyle(5, "#c4b5fd"))
        .setOrigin(1, 0)
        .setDepth(STAT_DEPTH);
    // WARD's bubble round the hero in the battle's 2px cells: a faint disc
    // and its rim a cell thick, in rows (a circle and a 3px stroke, swelling
    // 1.06x, were 1px edges on a 2px picture); it breathes in its alpha
    const even = (v: number): number => Math.round(v / ART_PX) * ART_PX;
    this.wardRing = this.add.graphics({ x: even(this.playerSprite.x), y: even(this.playerSprite.y) }).setVisible(false);
    const span = (r: number, top: number): number => {
      const mid = (top + ART_PX / 2) / r;
      return Math.abs(mid) >= 1 ? 0 : Math.round((r * Math.sqrt(1 - mid * mid)) / ART_PX) * ART_PX;
    };
    for (let top = -WARD_R; top < WARD_R; top += ART_PX) {
      const [outer, inner] = [span(WARD_R, top), span(WARD_R - ART_PX, top)];
      this.wardRing
        .fillStyle(WARD_COLOR, 0.8)
        .fillRect(-outer, top, outer - inner, ART_PX)
        .fillRect(inner, top, outer - inner, ART_PX);
      if (inner > 0) this.wardRing.fillStyle(WARD_COLOR, 0.12).fillRect(-inner, top, inner * 2, ART_PX);
    }
    this.tweens.add({ targets: this.wardRing, alpha: 0.7, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.rageText = this.add
      .pixelText(ENEMY_STATUS_RIGHT, 90, "RAGE", retroStyle(5, "#ff5555"))
      .setOrigin(1, 0)
      .setDepth(STAT_DEPTH)
      .setVisible(false);
    this.dotText = this.add
      .pixelText(ENEMY_STATUS_RIGHT, 90, "PSN", retroStyle(5, DOT_COLOR.PSN))
      .setOrigin(1, 0)
      .setDepth(STAT_DEPTH)
      .setVisible(false);
    this.chillText = this.add
      .pixelText(ENEMY_STATUS_RIGHT, 90, "CHL", retroStyle(5, "#67e8f9"))
      .setOrigin(1, 0)
      .setDepth(STAT_DEPTH)
      .setVisible(false);
    // pulses while a boss winds up, so the warning outlives its message
    this.chargeText = this.add
      .pixelText(ENEMY_STATUS_RIGHT, 90, "CHG", retroStyle(5, "#f97316"))
      .setOrigin(1, 0)
      .setDepth(STAT_DEPTH)
      .setVisible(false);
    this.tweens.add({ targets: this.chargeText, alpha: 0.35, duration: 320, yoyo: true, repeat: -1 });
    // The move it will use next turn, pulsing as CHG does. ">SNATCH" is 7 x
    // 20 = 140px of the row's 160 (x 1072..1232), so it holds row 1 alone and
    // PSN/BRN with CHL take row 2: never the third, where an elite's tag is.
    // The buff a move leaves takes its place (a species has one move, and a
    // buffing one is used once), so the two are never up together.
    this.intentText = this.add
      .pixelText(ENEMY_STATUS_RIGHT, 90, `>${this.enemy.move?.name ?? ""}`, retroStyle(5, "#fde047"))
      .setOrigin(1, 0)
      .setDepth(STAT_DEPTH)
      .setVisible(false);
    this.tweens.add({ targets: this.intentText, alpha: 0.35, duration: 320, yoyo: true, repeat: -1 });
    this.buffText = this.add
      .pixelText(ENEMY_STATUS_RIGHT, 90, "ATK+", retroStyle(5, "#fca5a5"))
      .setOrigin(1, 0)
      .setDepth(STAT_DEPTH)
      .setVisible(false);
    this.updateEnemyStatus();
    this.updateStatus();

    // the message box (y 604..716), in bodyStyle(33) with a 5px leading (as
    // the touch dialogue box's; the keyboard one is in 22): 54 glyphs a row,
    // and a second row's descenders end at y=697
    gridOutline(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 60, GAME_WIDTH - 64, 112, 0x0b0b2b, 0.92), 0xffffff);
    this.msgText = new TypedText(this, 64, GAME_HEIGHT - 104, bodyStyle(33, "#f5f5f5"), {
      wrapWidth: GAME_WIDTH - 128,
      lineSpacing: 5,
    });

    this.menuButtons = [
      { label: "A:FIGHT", action: "fight" },
      ...this.knownSpells().map(
        (s): MenuButton => ({ label: `${s.name[0]}:${s.name}`, action: "magic", spell: s, enabled: () => this.canCast(s) }),
      ),
      // once the first move is learned (Lv2); greyed out, as ITEM is, when
      // nothing on the list can be used now (MP, a QUAKE on a flier)
      ...(this.knownSkills().length > 0
        ? [{ label: "X:SKILL", action: "skills", enabled: () => this.canUseAnySkill() } satisfies MenuButton]
        : []),
      // greyed out with nothing in the bag, as a spent STEAL is: an empty list
      // has nothing to pick
      { label: "E:ITEM", action: "item", enabled: () => this.hasItems() },
      { label: "D:DEFEND", action: "defend" },
      // the yard has nothing to steal; its C changes the foe (practice.ts)
      this.practice ? { label: "C:FOE", action: "foe" } : { label: "S:STEAL", action: "steal", enabled: () => this.stealAvailable() },
      { label: this.practice ? "ESC:EXIT" : this.arena ? "ESC:QUIT" : "ESC:RUN", action: "run" },
    ];
    // Always size 5 (20px a glyph), within 48px margins (1184px of room), and
    // outlined, as text straight on the backdrop is (AGENTS.md): a greyed-out
    // DIM_TEXT button was 1.7:1 on the town's daytime field bare. The outline
    // adds 4px to each button.
    this.menuTexts = this.menuButtons.map(() =>
      this.add.pixelText(0, MENU_Y, "", retroStyle(5, "#ffffff")).setStroke("#0b0b2b", 4).setOrigin(0, 0.5),
    );
    this.layoutMenu();
    // a pad press or a key renames the buttons, and their widths change
    const offInput = onInputChange(() => this.layoutMenu());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offInput);
    this.hideMenu();

    // outlined like the map's name tags: it sits on the backdrop's field,
    // not a panel (#9f9fd0 on that green is 1.4:1 bare)
    this.hintText = this.add
      .pixelText(GAME_WIDTH / 2, GAME_HEIGHT - 144, "", retroStyle(4, "#9f9fd0"))
      .setStroke("#0b0b2b", 4)
      .setOrigin(0.5)
      .setDepth(30);
    this.help = new BattleHelp(this);

    // outlined as the menu is: an empty slot's DIM_TEXT sits on the field too
    const itemY = GAME_HEIGHT - 232;
    for (let i = 0; i < ITEM_SLOTS.length; i++) {
      const slot = ITEM_SLOTS[i];
      const t = this.add
        .pixelText(
          ITEM_COL_X[i % ITEMS_PER_ROW] + ITEM_TEXT_OFFSET,
          itemY + Math.floor(i / ITEMS_PER_ROW) * 40,
          `${slot.label} x${GameState.inventory[slot.key]}`,
          retroStyle(6, "#ffffff"),
        )
        .setStroke("#0b0b2b", 4)
        .setOrigin(0, 0.5)
        .setVisible(false);
      this.itemTexts.push(t);
    }
    this.itemCursor = this.add
      .pixelText(0, itemY, ">", retroStyle(6, "#ffd166"))
      .setStroke("#0b0b2b", 4)
      .setOrigin(0, 0.5)
      .setVisible(false);
    // what the cursor's item does, as the shop and the bag word it
    // (itemInfo.ts). Size 4 is all that fits between the second item row
    // (size 6 at y=528, to 544) and the hint (from 566): y 544..564. The
    // longest, "CANDY: THROW TO CATCH A WEAKENED MONSTER", is 40 glyphs =
    // 640px, x 320..960. Outlined like the hint: it sits on the backdrop.
    this.itemInfoText = this.add
      .pixelText(GAME_WIDTH / 2, GAME_HEIGHT - 166, "", retroStyle(4, "#ffd166"))
      .setStroke("#0b0b2b", 4)
      .setOrigin(0.5)
      .setDepth(30)
      .setVisible(false);

    // the SKILL list, outlined as the item list is (see SKILL_COL_X), each
    // move at its place on its page; the cursor where the last battle left it
    const known = this.knownSkills();
    this.skillIndex = Math.max(
      0,
      known.findIndex((k) => k.name === lastSkill),
    );
    known.forEach((skill, i) => {
      const cell = i % SKILLS_PER_PAGE;
      const t = this.add
        .pixelText(
          SKILL_COL_X[cell % SKILLS_PER_ROW] + ITEM_TEXT_OFFSET,
          SKILL_ROW_Y[Math.floor(cell / SKILLS_PER_ROW)],
          skill.name,
          retroStyle(6, "#ffffff"),
        )
        .setStroke("#0b0b2b", 4)
        .setOrigin(0, 0.5)
        .setVisible(false);
      this.skillTexts.push(t);
    });
    this.skillCursor = this.add
      .pixelText(0, SKILL_ROW_Y[0], ">", retroStyle(6, "#ffd166"))
      .setStroke("#0b0b2b", 4)
      .setOrigin(0, 0.5)
      .setVisible(false);
    // in the message box, a panel: no outline needed
    this.skillInfoText = this.add.pixelText(64, SKILL_INFO_Y, "", bodyStyle(33, "#ffd166")).setVisible(false);
    this.skillHintText = this.add
      .pixelText(GAME_WIDTH / 2, SKILL_HINT_Y, "", retroStyle(4, "#9f9fd0"))
      .setOrigin(0.5)
      .setVisible(false);
    this.skillPageText = this.add
      .pixelText(SKILL_PAGE_RIGHT, SKILL_HINT_Y, "", retroStyle(4, "#ffd166"))
      .setOrigin(1, 0.5)
      .setVisible(false);

    // drawn once, by the first battle; later ones reuse the textures
    bakeBattleFx(this);
    this.statusFx = new StatusFx(this);
    // a flier's death lands its debris on the ground, FLY_LIFT under it
    if (this.enemy.flying) this.statusFx.hover(this.enemySprite, Math.round(FLY_LIFT / (ART_PX * this.enemyBaseScale)));
    this.warmStatuses();
    this.hitBurst = this.add.particles(0, 0, "spark", {
      speed: { min: 40, max: 120 },
      lifespan: 300,
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      emitting: false,
    });
    this.glowBurst = this.add.particles(0, 0, "glow", {
      speed: { min: 60, max: 160 },
      lifespan: 400,
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      emitting: false,
    });
    this.coinBurst = this.add.particles(0, 0, "coin", {
      speed: { min: 60, max: 140 },
      lifespan: 600,
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      emitting: false,
    });
    // a caught monster's trail and its landing (catchFx); smaller than the
    // other bursts, or the trail's glows run together into one pink rope
    this.catchBurst = this.add.particles(0, 0, "glow", {
      speed: { min: 30, max: 110 },
      lifespan: 450,
      scale: { start: 0.6, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: CANDY_PINK,
      emitting: false,
    });

    this.input.keyboard!.on("keydown", this.onKey, this);
    this.input.keyboard!.on("keydown-M", () => {
      const muted = Sfx.toggleMuted();
      showToast(this, muted ? "SOUND: OFF" : "SOUND: ON");
    });
    this.input.on("pointerdown", this.onPointerDown, this);

    this.running = true;
    this.runBattle();
  }

  // keydown events, not JustDown polling: Key.onUp resets _justDown, so a
  // press whose down/up land in the same frame queue is silently dropped
  private onKey(e: KeyboardEvent): void {
    if (e.repeat) return;
    if (!(e.metaKey || e.ctrlKey || e.altKey || e.shiftKey)) this.timedInput();
    if (!this.waitingAction) return;
    // the help over the menu (the menu's ends would show past its sides, so
    // the menu goes while it is up): any key shuts it and is not the menu's; "?"
    // (with or without SHIFT) opens it from the menu itself, not a list
    if (this.help.open) {
      this.help.hide();
      this.renderMenu();
      return;
    }
    if (e.code === "Slash" && !this.inSkills && !this.inItems) {
      this.hideMenu();
      this.help.show();
      return;
    }

    if (this.inSkills) {
      const next = this.skillMove(e.code);
      if (next !== null) {
        if (next !== this.skillIndex) Sfx.move();
        this.skillIndex = next;
        this.renderSkills();
        return;
      }
      if (e.code === "Escape") {
        this.closeSkills();
        return;
      }
      // X again casts the cursor's move, which opens on the last one used: a
      // repeat is X X
      if (e.code === "KeyZ" || e.code === "KeyX") this.pickSkill();
      return;
    }

    if (this.inItems) {
      if (e.code === "ArrowLeft" || e.code === "KeyH") {
        this.itemIndex = (this.itemIndex + ITEM_SLOTS.length - 1) % ITEM_SLOTS.length;
        Sfx.move();
        this.renderItems();
        return;
      }
      if (e.code === "ArrowRight" || e.code === "KeyL") {
        this.itemIndex = (this.itemIndex + 1) % ITEM_SLOTS.length;
        Sfx.move();
        this.renderItems();
        return;
      }
      if (e.code === "ArrowUp" || e.code === "KeyK") {
        this.itemIndex = (this.itemIndex + ITEM_SLOTS.length - ITEMS_PER_ROW) % ITEM_SLOTS.length;
        Sfx.move();
        this.renderItems();
        return;
      }
      if (e.code === "ArrowDown" || e.code === "KeyJ") {
        this.itemIndex = (this.itemIndex + ITEMS_PER_ROW) % ITEM_SLOTS.length;
        Sfx.move();
        this.renderItems();
        return;
      }
      if (e.code === "Escape") {
        this.closeItems();
        return;
      }
      if (e.code === "KeyZ") {
        const slot = ITEM_SLOTS[this.itemIndex];
        if (GameState.inventory[slot.key] <= 0) {
          Sfx.error();
          return;
        }
        this.inItems = false;
        this.hideItems();
        this.resolveAction(slot.action);
      }
      return;
    }

    if (e.code === "Escape") {
      this.resolveAction("run");
      return;
    }
    if (e.code === "KeyA") {
      this.resolveAction("fight");
      return;
    }
    if (e.code === "KeyD") {
      this.resolveAction("defend");
      return;
    }
    if (e.code === "KeyL") {
      if (limitFull(this.limit)) this.resolveAction("limit");
      else Sfx.error();
      return;
    }
    if (e.code === "KeyC" && this.practice) {
      this.resolveAction("foe");
      return;
    }
    if (e.code === "KeyE") {
      if (!this.hasItems()) {
        Sfx.error();
        return;
      }
      this.hideMenu();
      this.renderItems();
      this.inItems = true;
      return;
    }
    if (e.code === "KeyX") {
      if (!this.canUseAnySkill()) {
        Sfx.error();
        return;
      }
      this.openSkills();
      return;
    }
    // direct spell hotkeys — the first letter of each spell (F/H/I/B/W/N are
    // all distinct, see Spell); unlearned or unaffordable just beeps
    if (e.code.startsWith("Key") && SPELLS.some((s) => s.name[0] === e.code[3])) {
      const spell = this.knownSpells().find((s) => s.name.startsWith(e.code[3]));
      if (!spell || !this.canCast(spell)) {
        Sfx.error();
        return;
      }
      this.pendingSpell = spell;
      this.resolveAction("magic");
      return;
    }
    if (e.code === "KeyS") {
      // reject at input time instead of burning the turn on an action that
      // was never going to do anything — same guard shape as the uncastable
      // spell (line ~406) and empty-item (line ~363) checks above
      if (!this.stealAvailable()) {
        Sfx.error();
        return;
      }
      this.resolveAction("steal");
    }
  }

  private stealAvailable(): boolean {
    return !this.enemy.boss && !this.stolen && !this.arena && !this.practice;
  }

  private resolveAction(action: MenuAction): void {
    const waiter = this.waitingAction!;
    this.waitingAction = null;
    this.hideMenu();
    this.hintText.setText("");
    waiter.resolve(action);
  }

  // a key or tap that may be the PARRY (enemyLunge) or the PERFECT
  // (playerAttack): the first one while a blow is on its way, or one just
  // after a blow nothing met
  private timedInput(): void {
    const now = performance.now();
    if (this.timedPress === null) this.timedPress = now;
    else if (now < this.timedLate) {
      this.timedLate = 0;
      this.timedNote("LATE", this.timedStrike);
    }
  }

  // PARRY! or PERFECT!, or how the press missed. Up and to the far side of
  // whoever was struck: over the hero a PARRY! lay across the blow's damage
  // number (a crit's "516!" is 224px wide about a point 40px right of the
  // hero, popNumber, to x 472; PARRY! is 192px from x 484: from 434 the two
  // shared 41px). FIGHT's is left of the foe, over the hero's head as it
  // strikes: PERFECT! is 256px to x 848, a crit's number on the foe from 888.
  private timedNote(label: "PARRY!" | "PERFECT!" | "EARLY" | "LATE", strike = false): void {
    const hit = label.endsWith("!");
    const x = strike ? this.enemySprite.x - 240 : this.playerSprite.x + 260;
    this.flashStatus(label, hit ? "#fde047" : DIM_TEXT, x, this.playerSprite.y - 90, hit ? 8 : 6);
  }

  // PERFECT's cue: the reticle closing on the foe in `ms`, gold once shut.
  // Returns what removes it.
  private strikeCue(ms: number): () => void {
    const even = (v: number): number => Math.round(v / ART_PX) * ART_PX;
    const g = this.add.graphics({ x: even(this.enemySprite.x), y: even(this.enemySprite.y) }).setDepth(5);
    const corners = (half: number, color: number, alpha: number): void => {
      g.fillStyle(color, alpha);
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        g.fillRect(sx < 0 ? -half : half - 16, sy < 0 ? -half : half - 4, 16, 4);
        g.fillRect(sx < 0 ? -half : half - 4, sy < 0 ? -half : half - 16, 4, 16);
      }
    };
    const draw = (half: number, shut: boolean): void => {
      g.clear();
      if (!shut) corners(CUE_HALF, 0xffffff, 0.35);
      corners(half, shut ? 0xfde047 : 0xffffff, 1);
    };
    const at = { half: CUE_FROM };
    draw(CUE_FROM, false);
    const tween = this.tweens.add({
      targets: at,
      half: CUE_HALF,
      duration: ms,
      onUpdate: () => draw(even(at.half), false),
      onComplete: () => draw(CUE_HALF, true),
    });
    return () => {
      tween.remove();
      g.destroy();
    };
  }

  // Mouse support for the action menu and item list: a global pointerdown
  // hit-tests the visible entries' bounds (like awaitAdvance) rather than
  // setInteractive() per item, so the keyboard flow stays untouched.
  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    this.timedInput();
    if (!this.waitingAction) return;
    if (this.help.open) {
      this.help.hide();
      this.renderMenu();
      return;
    }
    // the hint line's HELP, a finger's box round it (the word is 64 x 16)
    if (!this.inSkills && !this.inItems && this.hintText.text) {
      const b = this.hintText.getBounds();
      if (Phaser.Geom.Rectangle.Contains(Phaser.Geom.Rectangle.Inflate(b, 24, 14), pointer.x, pointer.y)) {
        this.hideMenu();
        this.help.show();
        return;
      }
    }

    if (this.inSkills) {
      // the page chip, in the message box: its halves turn back and on
      const chip = this.skillPageText;
      if (chip.visible && Phaser.Geom.Rectangle.Inflate(chip.getBounds(), 8, 12).contains(pointer.x, pointer.y)) {
        this.turnSkillPage(pointer.x < chip.getBounds().centerX ? -1 : 1);
        return;
      }
      for (let i = 0; i < this.skillTexts.length; i++) {
        // padded 8px across, 2px down: the rows are 32px apart, the glyphs 28
        const t = this.skillTexts[i];
        if (!t.visible || !Phaser.Geom.Rectangle.Inflate(t.getBounds(), 8, 2).contains(pointer.x, pointer.y)) continue;
        // a first tap reads, a second casts, as in the item list
        if (i !== this.skillIndex) {
          this.skillIndex = i;
          Sfx.move();
          this.renderSkills();
          return;
        }
        this.pickSkill();
        return;
      }
      // off the list (the message box under it too): back to the menu
      this.closeSkills();
      return;
    }

    if (this.inItems) {
      for (let i = 0; i < this.itemTexts.length; i++) {
        const t = this.itemTexts[i];
        // padded as the menu's buttons are, so a near miss doesn't close it
        if (!t.visible || !Phaser.Geom.Rectangle.Inflate(t.getBounds(), 8, 8).contains(pointer.x, pointer.y)) continue;
        // a tap on another item only moves the cursor there, so a touch
        // player can read what it does before a second tap (or Z) spends it
        if (i !== this.itemIndex) {
          this.itemIndex = i;
          Sfx.move();
          this.renderItems();
          return;
        }
        const slot = ITEM_SLOTS[i];
        if (GameState.inventory[slot.key] <= 0) {
          Sfx.error();
          return;
        }
        this.inItems = false;
        this.hideItems();
        this.resolveAction(slot.action);
        return;
      }
      // a tap anywhere off the list goes back to the menu, as ESC does: a
      // touch screen has no ESC in a battle, and an empty or unwanted list
      // otherwise held the fight there
      this.closeItems();
      return;
    }

    // the full LIMIT gauge is its own button: the bar and its label
    if (limitFull(this.limit) && LIMIT_TAP.contains(pointer.x, pointer.y)) {
      this.resolveAction("limit");
      return;
    }
    for (let i = 0; i < this.menuButtons.length; i++) {
      const t = this.menuTexts[i];
      // padded past the glyphs so a button is a fair finger target: 8px of
      // the >= 20px gap each side, and menuHitPadY up and down (see layoutMenu())
      // (an empty label, a pad's SKILL, isn't laid out: layoutMenu)
      if (!t.visible || !t.text || !Phaser.Geom.Rectangle.Inflate(t.getBounds(), 8, this.menuHitPadY).contains(pointer.x, pointer.y))
        continue;
      const btn = this.menuButtons[i];
      if (btn.enabled && !btn.enabled()) {
        Sfx.error();
        return;
      }
      if (btn.action === "item") {
        this.hideMenu();
        this.renderItems();
        this.inItems = true;
        return;
      }
      if (btn.action === "skills") {
        this.openSkills();
        return;
      }
      if (btn.spell) this.pendingSpell = btn.spell;
      this.resolveAction(btn.action);
      return;
    }
  }

  private window(x: number, y: number, w: number, h: number): void {
    gridOutline(this.add.rectangle(x, y, w, h, 0x0b0b2b, 0.85).setOrigin(0, 0), 0xffffff).setDepth(STAT_DEPTH);
  }

  // At Lv1 the 6 buttons (41 glyphs, 820px + 24) fit one row with 68px
  // gaps, and SKILL (Lv2) keeps it one: 48 glyphs, 988px, 32px gaps. HEAL
  // (Lv5) makes it 54 glyphs (10px gaps, under MENU_MIN_GAP), so from Lv5 the
  // attacks (FIGHT and the spells) take a row of their own above SKILL / ITEM
  // / DEFEND / STEAL / RUN (35 glyphs, 700 + 5 x 4 + 4 x 40 = 880px), each
  // centered with MENU_ROW_GAP between buttons; Lv24's attack row is the
  // widest, 42 glyphs = 840 + 7 x 4 + 6 x 40 = 1108px. (Before SKILL the one
  // row lasted to Lv8, before DEFEND to Lv17.) The rows (y 500..524 /
  // 536..560) clear the companion sprite (to y 488) above and the hint line
  // (566..586) and message box (604) below. With a pad the buttons carry its
  // names (X:FIGHT ... START:DEFEND, SELECT:STEAL, B:RUN): HEAL's row is 56
  // glyphs, two rows from Lv5, the lower one 35 glyphs = 836px, and Lv24's
  // attacks are 48 = 960 + 7 x 4, their gaps closing to 32px to fit the 1184.
  // SKILL has no pad button (AGENTS.md: no pad mappings for new keys), so
  // with a pad its label is empty and the layout leaves it out.
  private layoutMenu(): void {
    this.menuButtons.forEach((b, i) => {
      // a touch screen has no keys: the buttons are tapped by their words
      this.menuTexts[i].setText(keyHint(b.label, b.label.replace(/^[^:]+:/, ""), { table: "battle" }));
    });
    const shown = (t: PixelText): boolean => t.width > 0;
    const texts = this.menuTexts.filter(shown);
    const room = GAME_WIDTH - MENU_MARGIN * 2;
    const total = texts.reduce((n, t) => n + t.width, 0);
    const oneRowGap = (room - total) / (texts.length - 1);
    if (oneRowGap >= MENU_MIN_GAP) {
      let x = MENU_MARGIN;
      for (const t of texts) {
        t.setPosition(x, MENU_Y);
        x += t.width + oneRowGap;
      }
      this.menuHitPadY = 14;
    } else {
      const isAttack = (i: number) => this.menuButtons[i].action === "fight" || this.menuButtons[i].action === "magic";
      const rows = [this.menuTexts.filter((t, i) => shown(t) && isAttack(i)), this.menuTexts.filter((t, i) => shown(t) && !isAttack(i))];
      rows.forEach((row, r) => {
        const width = row.reduce((n, t) => n + t.width, 0);
        // a spell list longer than today's would close the gaps before overflowing
        const gap = Math.min(MENU_ROW_GAP, (room - width) / Math.max(1, row.length - 1));
        let x = GAME_WIDTH / 2 - (width + gap * (row.length - 1)) / 2;
        for (const t of row) {
          t.setPosition(x, MENU_ROWS_Y[r]);
          x += t.width + gap;
        }
      });
      // 36px between the rows' centres: 8px of padding each way keeps the
      // two rows' tap boxes from overlapping
      this.menuHitPadY = 8;
    }
  }

  private hideMenu(): void {
    for (const t of this.menuTexts) t.setVisible(false);
  }

  private renderMenu(): void {
    for (let i = 0; i < this.menuButtons.length; i++) {
      this.menuTexts[i].setVisible(true);
      // gray out whatever can't be picked right now (MP-starved spell,
      // full-HP heal, spent steal)
      this.menuTexts[i].setColor((this.menuButtons[i].enabled?.() ?? true) ? "#ffffff" : DIM_TEXT);
    }
    // Every action has a button above, so the hint line is free for the one
    // thing that has none: the battle's help (ui/BattleHelp.ts), "?" or a tap
    // on the word. Not a menu button: a sixth on the lower row is 1044px of
    // its 1184, but on the single row of Lv2-4 it closed the gaps under
    // MENU_MIN_GAP and split the menu in two three levels early.
    bindKeyHint(this.hintText, () => keyHint("?:HELP", "HELP", { table: "battle", pad: "" }));
  }

  private hideItems(): void {
    for (const t of this.itemTexts) t.setVisible(false);
    this.itemCursor.setVisible(false);
    this.itemInfoText.setVisible(false);
  }

  // back from the item list to the menu, no turn spent
  private closeItems(): void {
    this.inItems = false;
    this.hideItems();
    this.renderMenu();
  }

  private hasItems(): boolean {
    return ITEM_SLOTS.some((s) => GameState.inventory[s.key] > 0);
  }

  private renderItems(): void {
    // The list's first row (y 474..502) starts just under the companion's
    // shadow (to y 472, COMPANION_GROUND_Y): no room to move the list down,
    // as the info line, the hint and the message box fill the 116px under it.
    for (let i = 0; i < ITEM_SLOTS.length; i++) {
      this.itemTexts[i].setVisible(true);
      const count = GameState.inventory[ITEM_SLOTS[i].key];
      this.itemTexts[i].setText(`${ITEM_SLOTS[i].label} x${count}`);
      this.itemTexts[i].setColor(count > 0 ? "#ffffff" : DIM_TEXT);
    }
    this.itemCursor.setVisible(true);
    const target = this.itemTexts[this.itemIndex];
    this.itemCursor.setX(target.x - ITEM_TEXT_OFFSET);
    this.itemCursor.setY(target.y);
    const slot = ITEM_SLOTS[this.itemIndex];
    this.itemInfoText.setText(`${slot.label}: ${ITEM_INFO[slot.key]}`).setVisible(true);
    bindKeyHint(this.hintText, () => keyHint("HJKL:MOVE  Z:OK  ESC:BACK", TOUCH_ITEM_HINT, { table: "battle" }));
  }

  private knownSpells(): Spell[] {
    return SPELLS.filter((s) => GameState.player.level >= s.learnLevel);
  }

  // learned at their level as spells are, in the list's order
  private knownSkills(): Skill[] {
    return SKILLS.filter((s) => GameState.player.level >= s.learnLevel);
  }

  // its MP now (a weapon tech's grows with max MP: battleRules skillCost)
  private skillCost(skill: Skill): number {
    return skillCost(skill, GameState.player.maxMp);
  }

  // the MP for it, and a foe it can reach (QUAKE never reaches a flier)
  private canUseSkill(skill: Skill): boolean {
    return GameState.player.mp >= this.skillCost(skill) && !(skill.grounded && this.enemy.flying);
  }

  private canUseAnySkill(): boolean {
    return this.knownSkills().some((s) => this.canUseSkill(s));
  }

  // The SKILL list's cursor after a vim key or an arrow. Across a row, and
  // off its end onto the next page's (or back onto the last page's) same row,
  // so H and L also turn the pages; up and down within the column on this
  // page, wrapping from its bottom move to its top (a partial last row has no
  // cell under some columns). null for any other key.
  private skillMove(code: string): number | null {
    const i = this.skillIndex;
    const page = Math.floor(i / SKILLS_PER_PAGE);
    const first = page * SKILLS_PER_PAGE;
    const end = Math.min(first + SKILLS_PER_PAGE, this.skillTexts.length);
    const col = (i - first) % SKILLS_PER_ROW;
    const row = Math.floor((i - first) / SKILLS_PER_ROW);
    if (code === "ArrowRight" || code === "KeyL") {
      return col < SKILLS_PER_ROW - 1 && i + 1 < end ? i + 1 : this.skillAt(page + 1, row, 0);
    }
    if (code === "ArrowLeft" || code === "KeyH") return col > 0 ? i - 1 : this.skillAt(page - 1, row, SKILLS_PER_ROW - 1);
    if (code === "ArrowDown" || code === "KeyJ") return i + SKILLS_PER_ROW < end ? i + SKILLS_PER_ROW : first + col;
    if (code === "ArrowUp" || code === "KeyK") {
      if (row > 0) return i - SKILLS_PER_ROW;
      let last = first + col;
      while (last + SKILLS_PER_ROW < end) last += SKILLS_PER_ROW;
      return last;
    }
    return null;
  }

  // the move at row, col of a page (wrapping round the pages), or that page's
  // last when the cell is empty
  private skillAt(page: number, row: number, col: number): number {
    const pages = Math.ceil(this.skillTexts.length / SKILLS_PER_PAGE);
    const first = (((page % pages) + pages) % pages) * SKILLS_PER_PAGE;
    return Math.min(first + row * SKILLS_PER_ROW + col, this.skillTexts.length - 1);
  }

  // the "< 1/3 >" chip tapped: a page back on its left half, on on its right,
  // the cursor at the same place on it
  private turnSkillPage(by: number): void {
    const i = this.skillIndex;
    const page = Math.floor(i / SKILLS_PER_PAGE);
    const cell = i - page * SKILLS_PER_PAGE;
    this.skillIndex = this.skillAt(page + by, Math.floor(cell / SKILLS_PER_ROW), cell % SKILLS_PER_ROW);
    Sfx.move();
    this.renderSkills();
  }

  private openSkills(): void {
    this.hintText.setText("");
    this.hideMenu();
    this.inSkills = true;
    this.renderSkills();
  }

  // The cursor's page, each move white when it can be used now, else dim;
  // the cursor's in the message box with its MP and what it does, the
  // battle's line hidden behind it (SKILL_INFO_Y), and the page chip
  private renderSkills(): void {
    const skills = this.knownSkills();
    const page = Math.floor(this.skillIndex / SKILLS_PER_PAGE);
    const pages = Math.ceil(skills.length / SKILLS_PER_PAGE);
    skills.forEach((s, i) => {
      this.skillTexts[i].setVisible(Math.floor(i / SKILLS_PER_PAGE) === page).setColor(this.canUseSkill(s) ? "#ffffff" : DIM_TEXT);
    });
    const target = this.skillTexts[this.skillIndex];
    this.skillCursor.setPosition(target.x - ITEM_TEXT_OFFSET, target.y).setVisible(true);
    const skill = skills[this.skillIndex];
    this.msgText.setVisible(false);
    // what it would set off on the foe as it stands, in place of its own note
    const reaction = reactionOf(skill.element, { dot: this.enemyDot?.label ?? null, chilled: this.chilled });
    const info = reaction ? REACTIONS[reaction].info : skill.info;
    this.skillInfoText.setText(`${skill.name}  ${this.skillCost(skill)} MP  ${info}`).setVisible(true);
    this.skillHintText.setVisible(true);
    bindKeyHint(this.skillHintText, () => keyHint("HJKL:MOVE  Z/X:OK  ESC:BACK", TOUCH_ITEM_HINT, { table: "battle" }));
    this.skillPageText.setText(`< ${page + 1}/${pages} >`).setVisible(pages > 1);
  }

  private hideSkills(): void {
    for (const t of this.skillTexts) t.setVisible(false);
    this.skillCursor.setVisible(false);
    this.skillInfoText.setVisible(false);
    this.skillHintText.setVisible(false);
    this.skillPageText.setVisible(false);
    this.msgText.setVisible(true);
  }

  // back from the SKILL list to the menu, no turn spent
  private closeSkills(): void {
    this.inSkills = false;
    this.hideSkills();
    this.renderMenu();
  }

  // Z or a second tap on the cursor's skill: cast it, or beep if it can't be
  // (not the MP, a flier out of QUAKE's reach), the list staying up
  private pickSkill(): void {
    const skill = this.knownSkills()[this.skillIndex];
    if (!this.canUseSkill(skill)) {
      Sfx.error();
      return;
    }
    this.inSkills = false;
    this.hideSkills();
    lastSkill = skill.name;
    this.pendingSkill = skill;
    this.resolveAction("skill");
  }

  private async runBattle(): Promise<void> {
    if (this.enemy.boss || this.enemy.giant) Sfx.boss();
    // The opening line types out under the menu instead of waiting for a Z:
    // nothing has happened yet to read past, and it was one press more in
    // every fight. It stays in the box until the first action's line.
    const intro = this.arena
      ? `ROUND ${this.arena.round + 1}: ${this.enemy.name}!`
      : `${this.keeperName ?? this.enemy.name} ${this.keeperName ? "rises" : "blocks your way"}!`;
    // An elite (elite.ts) is named in the line and says what it does under it,
    // beside the rest's note: "ELITE: much tougher!  Well rested: your WARD
    // is up!" is 51 of a row's 54 glyphs, "STURDY MAGMA SLIME blocks your
    // way!" 35.
    if (this.opening) {
      await this.openingBlow(this.opening);
      if (!this.running) return;
      if (this.enemy.curHp <= 0) return this.victory();
      if (GameState.player.hp <= 0) return this.defeat();
    }
    const elite = this.elite && ELITES[this.elite];
    const notes = [elite && `ELITE: ${elite.note}!`, this.rested && "Well rested: your WARD is up!"].filter(Boolean);
    this.type([elite && !this.keeperName ? `${elite.tag} ${intro}` : intro, ...(notes.length > 0 ? [notes.join("  ")] : [])].join("\n"));

    this.rollIntent();
    this.leaveArmed = false;
    while (this.running) {
      if (GameState.player.hp <= 0) return this.defeat();

      if (this.poisonTurns > 0) await this.poisonTick();
      // the full LIMIT gauge explained, the first time the menu comes up
      // with one (a gauge that filled on a fight's last blow is full at the
      // next fight's start: said at a round's end, most fights never did)
      await this.tip("limit");
      await this.tip("intent");
      // a frozen hero forfeits this action (null matches no case below); the
      // companion and the enemy still take their turns
      let action = this.frozen ? null : await this.playerTurn();
      // the ARENA can be left, not fled: the first ESC:QUIT only asks, back to
      // the menu with no turn spent; the second ends the run with what it has
      // won (arena.ts)
      while (action === "run" && this.arena && !this.leaveArmed) {
        this.leaveArmed = true;
        await this.say("Leave the ARENA? Prize so far is kept. ESC again.");
        action = await this.playerTurn();
      }
      if (action !== "run") this.leaveArmed = false;
      if (!action) await this.thaw();

      switch (action) {
        case "foe":
          return this.practiceFoe(this.practice!, 1);
        case "run": {
          if (this.practice) return this.exitPractice(this.practice);
          // the second ESC:QUIT, once the first has asked (above)
          if (this.arena) return this.quitArena(this.arena);
          this.resetCombo();
          if (Math.random() < 0.5 + GameState.perk("fleet")) {
            Sfx.run();
            await Promise.all([this.runOff(), this.say("You escaped!")]);
            if (GameState.streak >= STREAK_MIN) {
              await this.say(`Win streak of ${GameState.streak} lost!`);
            }
            GameState.streak = 0;
            // stolen gold (or anything else gained this fight) is otherwise
            // unsaved on this path — victory()/defeat() both save, RUN didn't
            GameState.save();
            return this.end();
          }
          await this.say("Can't escape!");
          break;
        }
        case "fight":
          await this.playerAttack();
          break;
        case "magic":
          await this.castSpell(this.pendingSpell);
          break;
        case "skill":
          await this.castSkill(this.pendingSkill);
          break;
        case "potion":
          await this.usePotion();
          break;
        case "mPotion":
          await this.useMPotion();
          break;
        case "candy":
          await this.throwCandy();
          break;
        case "hiPotion":
          await this.useHiPotion();
          break;
        case "ether":
          await this.useEther();
          break;
        case "elixir":
          await this.useElixir();
          break;
        case "bomb":
          await this.throwBomb();
          break;
        case "steal":
          await this.attemptSteal();
          break;
        case "defend":
          await this.defend();
          break;
        case "limit":
          await this.limitBreak();
          break;
      }

      if (!this.running) return;
      if (this.enemy.curHp <= 0) return this.victory();

      await this.companionAttack();
      if (!this.running) return;
      if (this.enemy.curHp <= 0) return this.victory();

      // a SWIFT elite (elite.ts) may act again: not out of a turn it lost
      // (stuck), nor to loose the strike it has just wound up
      const again = !this.stuck && actsAgain(this.elite);
      await this.tip("parry");
      await this.enemyTurn();
      if (again && this.running && !this.charging && GameState.player.hp > 0 && this.enemy.curHp > 0) {
        // no line of its own (it was a key between the two blows): the tag
        // pops as it gathers itself (a row over where a move's ATK+ or DEF+
        // would, and from x 684: at 664 it shared 14px with the second blow's
        // PARRY!, which ends at 676), and its beat before the blow is the pause
        this.flashStatus("AGAIN!", ELITES.swift.color, this.enemySprite.x - 180, this.enemySprite.y - 56, 8);
        await this.enemyTurn();
      }
      this.defending = false;
      this.thawing = false;
      // felled by a COUNTER
      if (this.running && this.enemy.curHp <= 0 && GameState.player.hp > 0) return this.victory();
      await this.tickWard();
    }
  }

  // FIRST STRIKE: the blow before the fight's first turn. The hero's is a
  // FIGHT as any other (its PERFECT too), the foe's its plain blow (a PARRY
  // answers it): no move, no wind-up, nothing rolled for its turn. Its word
  // pops over whoever was caught; the fight's opening line comes after.
  private async openingBlow(who: "hero" | "foe"): Promise<void> {
    if (who === "hero") {
      this.flashStatus("AMBUSH!", "#fde047", this.enemySprite.x, this.enemySprite.y - 80);
      return this.playerAttack();
    }
    this.flashStatus("OFF GUARD!", "#f87171");
    await this.tip("parry");
    const { dmg, crit, note } = await this.enemyBlow();
    await this.say(crit ? `CRITICAL! ${this.enemy.name} strikes for ${dmg}!${note}` : `${this.enemy.name} attacks for ${dmg}!${note}`);
    this.setPlayerTint(undefined);
  }

  // A first-time line, said once a save (GameState.seenTips, where the
  // fields' unlock tips are kept): what a PARRY is, before the first blow the
  // hero ever faces, and what a full LIMIT gauge is for, before the first
  // menu that has one; and what the foe's blinking tag is, before the first
  // menu under one. 52, 46 and 49 (">SNATCH", the longest) glyphs of a row's
  // 54 (touch: 42, 45, the same). Not in the yard, whose gauge is always full.
  private async tip(id: "parry" | "limit" | "intent" | "react"): Promise<void> {
    const seen = GameState.seenTips;
    if (!seen || seen.includes(id) || this.practice || !this.running || GameState.player.hp <= 0) return;
    if (id === "limit" && !limitFull(this.limit)) return;
    if (id === "intent" && !this.intent) return;
    if (id === "react" && !this.reacted) return;
    seen.push(id);
    // 52 glyphs
    if (id === "react") return this.say("TIP: BRN+ice, CHL+bolt, PSN+fire: a status reacts!", true);
    if (id === "intent") return this.say(`TIP: the blinking >${this.enemy.move?.name} is the foe's next move.`, true);
    await this.say(
      id === "parry"
        ? keyHint("TIP: press any key just as a blow lands to PARRY it.", "TIP: tap just as a blow lands to PARRY it.")
        : keyHint("LIMIT is full! L unleashes it now, or save it.", "LIMIT is full! Tap the gauge now, or save it."),
      true,
    );
  }

  // one enemy turn spent, whether it attacked, regrew or was the thaw round
  private async tickWard(): Promise<void> {
    if (this.wardTurns === 0) return;
    this.wardTurns -= 1;
    if (this.wardTurns > 0) return;
    this.updateStatus();
    // a hero the last blow just felled goes straight to defeat() instead
    if (GameState.player.hp > 0) await this.say("Your WARD fades.");
  }

  private playerTurn(): Promise<MenuAction> {
    this.renderMenu();
    return new Promise((resolve) => {
      this.waitingAction = { resolve };
    });
  }

  private async playerAttack(): Promise<void> {
    this.addCombo();
    const comboBonus = this.comboBonus();
    // a foe that can't move (stunned, webbed) takes it as a crit
    // the worn sword's nature (battleRules WEAPON_NATURE): HEAVY's share of the DEF, KEEN's odds
    const edge = edgeOf(GameState.equipped.weapon);
    const roll = rollDamage(this.heroAtk(), edgedDef(this.enemy.def, edge), Math.random, edge.crit);
    const crit = roll.crit || this.stuck !== null;
    const dmg = roll.crit || !this.stuck ? roll.dmg : roll.dmg * CRIT_MULT;
    // QUICK: the fight's first FIGHT, whoever it is aimed by (a COUNTER, a first strike)
    const quick = !this.opened && edge.opener > 1;
    this.opened = true;
    let total = Math.max(1, Math.floor(dmg * (1 + comboBonus) * (quick ? edge.opener : 1)));
    // PERFECT: the wind-up held so the blow lands a run-up after FIGHT, the
    // reticle shut just before it; the swing's whoosh waits with it
    const dash = this.anim(WINDUP_MS) + this.anim(LUNGE_OUT_MS);
    const hold = Math.max(0, Phaser.Math.Between(...PERFECT_RUN_MS) - dash);
    const endCue = this.strikeCue(hold + dash - PERFECT_GRACE_MS);
    this.time.delayedCall(hold, () => Sfx.attack());
    bindKeyHint(this.hintText, () => keyHint("ANY KEY:PERFECT", "TAP:PERFECT", { table: "battle", pad: "Z:PERFECT" }));
    this.timedLate = 0;
    this.timedPress = null;
    // the blow lands at the contact, the hero still out at the foe
    const onContact = (): void => {
      const press = this.timedPress;
      this.timedPress = undefined;
      this.hintText.setText("");
      endCue();
      const now = performance.now();
      if (press != null && now - press <= PERFECT_WINDOW_MS) {
        total = perfectDamage(total);
        if (!this.practice) GameState.feats.perfects += 1;
        Sfx.emit("perfect");
        this.glowBurst.setPosition(this.enemySprite.x, this.enemySprite.y);
        this.glowBurst.explode(12);
        this.timedNote("PERFECT!", true);
      } else if (press != null) this.timedNote("EARLY", true);
      else {
        this.timedLate = now + PARRY_LATE_MS;
        this.timedStrike = true;
      }
      Sfx.strike();
      if (crit) Sfx.critical();
      this.enemy.curHp = Math.max(0, this.enemy.curHp - total);
      this.updateEnemyHp();
      this.enemySprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      this.fxOn(this.enemySprite, "fx-slash", HIT_FX_MS);
      if (crit) this.fxOn(this.enemySprite, "fx-crit", HIT_FX_MS);
      this.hitBurst.setPosition(this.enemySprite.x, this.enemySprite.y);
      this.hitBurst.explode(crit ? 16 : 8);
      shake(this.cameras.main, crit ? 120 : 60, crit ? 0.012 : 0.004);
      this.flashDamage(this.enemySprite.x, this.enemySprite.y, total, crit);
      this.recoil(this.enemySprite, 1, crit);
      // its line types from the contact on, while the hero walks home: after
      // the walk it was 160ms more of every FIGHT with nothing new to see
      const comboNote = comboBonus > 0 ? ` COMBO x${this.combo}!` : "";
      // The sword's nature says so when it does something, and only then
      // (a sword has one, so one note at most): HEAVY cutting through a
      // HARDEN, CRUST or ARMOR, QUICK's first blow, SEAR's burn as it takes
      // (FIRE's own, label and all). "CRITICAL HIT! You strike for 516!
      // COMBO x99! HEAVY!" is 50 glyphs of a row's 54.
      const sears = edge.burn > 0 && this.enemy.curHp > 0 && this.spellEffectCanLand("burn") && Math.random() < edge.burn;
      const nature = sears
        ? this.landSpellEffect("burn")
        : quick
          ? " QUICK!"
          : edge.defShare < 1 && this.foeBuff === "DEF+"
            ? " HEAVY!"
            : "";
      line = this.say(`${crit ? "CRITICAL HIT! " : ""}You strike for ${total}!${comboNote}${nature}`);
    };
    let line: Promise<void> | undefined;
    await this.lunge(crit, onContact, hold);
    await line;
    this.restoreEnemyTint();
  }

  // a struck fighter's knock-back along the ground (dir 1 pushes it right)
  // and back
  private recoil(sprite: Phaser.GameObjects.Sprite, dir: 1 | -1, crit: boolean): void {
    this.nudge(sprite, (crit ? CRIT_RECOIL_PX : RECOIL_PX) * dir, RECOIL_MS);
  }

  // `dx` along x and back in `ms`. x only, so the breathing and a boss's pulse
  // keep their own. A second nudge before the first is home restarts from the
  // same home, so quick hits (a double slash) never leave the sprite displaced.
  private nudge(sprite: Phaser.GameObjects.Sprite, dx: number, ms: number): void {
    const held = this.nudging.get(sprite);
    held?.tween.remove();
    const home = held?.home ?? sprite.x;
    const tween = this.tweens.add({
      targets: sprite,
      x: home + dx,
      duration: this.anim(ms),
      yoyo: true,
      ease: "Quad.easeOut",
      onComplete: () => {
        sprite.x = home;
        this.nudging.delete(sprite);
      },
    });
    this.nudging.set(sprite, { home, tween });
  }

  private canCast(spell: Spell): boolean {
    if (GameState.player.mp < spell.cost) return false;
    return !(spell.kind === "heal" && this.hpFull());
  }

  // full HP only blocks a heal when there's no poison left to cure with it
  private hpFull(): boolean {
    return GameState.player.hp >= GameState.effMaxHp() && this.poisonTurns === 0;
  }

  // every HP-restoring action (HEAL, POTION, HI-POTION, ELIXIR) also cures
  // poison; returns the suffix for that action's message
  private curePoison(): string {
    if (this.poisonTurns === 0) return "";
    this.poisonTurns = 0;
    this.updateStatus();
    return " Poison cured!";
  }

  private async castSpell(spell: Spell): Promise<void> {
    // an attack spell settles the combo when it lands (CHAIN, below)
    if (spell.kind !== "attack") this.resetCombo();
    if (spell.kind === "ward") Sfx.ward();
    else if (spell.ultimate) Sfx.nova();
    else Sfx.magic();
    GameState.player.mp -= spell.cost;
    this.updatePlayerStats();
    if (spell.kind === "heal") {
      const healed = Math.min(GameState.effMaxHp() - GameState.player.hp, spell.power);
      GameState.player.hp += healed;
      this.updatePlayerStats();
      // the sheet in place of the glow burst, as long as that burst lived
      this.statusOn(this.playerSprite, "heal", 500);
      if (healed > 0) this.flashHeal(this.playerSprite.x, this.playerSprite.y, healed);
      await this.say(`${spell.name} restores ${healed} HP!${this.curePoison()}`);
      return;
    }
    if (spell.kind === "ward") {
      const refreshed = this.wardTurns > 0;
      this.wardTurns = WARD_TURNS;
      this.updateStatus();
      this.statusOn(this.playerSprite, "ward", 500);
      this.flashStatus("WARD", "#93c5fd");
      await this.say(refreshed ? `WARD renewed for ${WARD_TURNS} turns!` : `A WARD halves damage for ${WARD_TURNS} turns!`);
      return;
    }
    const { dmg: rolled, weak } = spellRoll(spell, this.enemy.weakness);
    const fx = spell.effect;
    const effect =
      fx && this.spellEffectCanLand(fx.kind) && Math.random() < fx.chance * (weak ? SPELL_EFFECT_WEAK_MULT : 1) ? fx.kind : null;
    if (spell.ultimate) await this.castNova(spell);
    else await this.castProjectile(spell);
    const reaction = this.react(spell.element);
    const dmg = Math.round(rolled * reaction.mult) + reaction.extra;
    this.enemy.curHp = Math.max(0, this.enemy.curHp - dmg);
    this.updateEnemyHp();
    this.enemySprite.setTint(spell.color).setTintMode(Phaser.TintModes.FILL);
    this.flashDamage(this.enemySprite.x, this.enemySprite.y, dmg);
    // CHAIN (battleRules COMBO_PCT): a weakness hit is one more in the combo
    if (weak) this.addCombo();
    else this.resetCombo();
    // WEAK FINISH (drops.ts): the weakness hit that fells the foe betters the
    // odds of its material
    this.weakFinish = weak && this.enemy.curHp <= 0;
    if (weak) {
      Sfx.critical();
      shake(this.cameras.main, 120, 0.01);
    }
    // worst case "WEAKNESS! BOLT hits for 99! SHATTER! STUN! CHAIN x99!", 53 glyphs
    const tail = reaction.tail + (effect && this.enemy.curHp > 0 ? this.landSpellEffect(effect) : "");
    const chain = weak && this.enemy.curHp > 0 && this.combo >= 2 ? ` CHAIN x${this.combo}!` : "";
    const finish = this.weakFinish ? " WEAK FINISH!" : "";
    await this.say(`${weak ? `WEAKNESS! ${spell.name} hits for ${dmg}!` : `${spell.name}! ${dmg} damage!`}${tail}${chain}${finish}`);
    this.restoreEnemyTint();
    await this.tip("react");
  }

  // A move off the SKILL list (battleRules SKILLS): its effects (skillFx.ts
  // for a blow, techFx.ts for a tech) call each hit as it lands, and the
  // hit's damage, number and flash go in then; a hit the foe is already down
  // for falls on nothing. A weapon tech dashes the hero up to the foe first
  // (meleeX), plays there and comes back. The side effect is rolled up front
  // from what could take now and lands after the last hit if the foe still
  // stands, as castSpell's does; CHAIN and WEAK FINISH as there, and a weapon
  // tech keeps the combo going as a FIGHT does. Lines, at most two message
  // rows: "CRITICAL! WEAKNESS! FLAME PILLAR! 999 damage! BURN! CHAIN x99!" is
  // 64 glyphs, "WEAKNESS! CHAIN BOLT! 99+99+99 damage! STUN! CHAIN x99!" 55.
  private async castSkill(skill: Skill): Promise<void> {
    this.moveSfx(skill, "cast");
    GameState.player.mp -= this.skillCost(skill);
    this.updatePlayerStats();
    const weak = skill.element !== undefined && this.enemy.weakness === skill.element;
    const fx = skill.effect;
    const effect =
      fx && this.spellEffectCanLand(fx.kind) && Math.random() < fx.chance * (weak ? SPELL_EFFECT_WEAK_MULT : 1) ? fx.kind : null;
    const dealt: number[] = [];
    let crit = false;
    let healed = 0;
    let blows = 0;
    let over = false;
    let unflash: Phaser.Time.TimerEvent | undefined;
    let reaction: { mult: number; extra: number; tail: string } | undefined;
    // the hits' numbers in a row across the foe, centred on it
    const popX = (i: number): number => this.enemySprite.x + (i - (skill.hits - 1) / 2) * SKILL_POP_STEP;
    const land = (): void => {
      if (over || blows >= skill.hits) return;
      const i = blows++;
      if (this.enemy.curHp <= 0) return;
      const rolled = skillHit(skill, {
        atk: this.heroAtk(),
        def: this.enemy.def,
        weakness: this.enemy.weakness,
        flying: this.enemy.flying,
        edge: edgeOf(GameState.equipped.weapon),
      });
      // a reaction goes off as the first hit lands, its multiplier on every
      // hit of the cast and what it adds on that first one
      reaction ??= this.react(skill.element);
      const hit = { ...rolled, dmg: Math.round(rolled.dmg * reaction.mult) + (i === 0 ? reaction.extra : 0) };
      this.enemy.curHp = Math.max(0, this.enemy.curHp - hit.dmg);
      dealt.push(hit.dmg);
      crit ||= hit.crit;
      this.moveSfx(skill, "hit", i, hit.crit);
      if (skill.style === "weapon") this.meleeHit(hit.crit);
      // the first hit on a weakness rings and shakes as a weakness spell does
      if (hit.weak && i === 0) {
        Sfx.critical();
        shake(this.cameras.main, 120, 0.01);
      }
      unflash?.remove();
      this.enemySprite.setTint(skill.color).setTintMode(Phaser.TintModes.FILL);
      unflash = this.time.delayedCall(this.anim(140), () => this.restoreEnemyTint());
      this.flashDamage(popX(i), this.enemySprite.y, hit.dmg, hit.crit);
      this.updateEnemyHp();
      if (skill.drain) {
        const back = Math.min(GameState.effMaxHp() - GameState.player.hp, Math.ceil(hit.dmg * skill.drain));
        GameState.player.hp += back;
        healed += back;
        if (back > 0) this.flashHeal(this.playerSprite.x, this.playerSprite.y, back);
        this.updatePlayerStats();
      }
    };
    const melee = skill.style === "weapon";
    const home = this.playerSprite.x;
    if (melee) await this.strikeIn();
    else await this.castPose();
    const stage: SkillStage = {
      hero: this.playerSprite,
      foe: this.enemySprite,
      foeScale: this.enemyBaseScale,
      groundY: GROUND_Y,
      foeFeetY: GROUND_Y - (this.enemy.flying ? FLY_LIFT : 0),
      anim: (ms) => this.anim(ms),
    };
    const play = skill.style === "blow" ? playSkill(this, skill.name, stage, land) : playTech(this, skill.name, stage, land);
    await Promise.race([play, this.wait(this.anim(SKILL_FX_TIMEOUT_MS))]);
    // whatever the effects didn't land, so the damage is always dealt
    while (blows < skill.hits) land();
    over = true;
    await this.poseRest(home);
    unflash?.remove();
    this.restoreEnemyTint();
    const down = this.enemy.curHp <= 0;
    if (weak || melee) this.addCombo();
    else this.resetCombo();
    this.weakFinish = weak && down;
    const tail = (reaction?.tail ?? "") + (effect && !down ? this.landSkillEffect(effect) : "");
    const chain = weak && !down && this.combo >= 2 ? ` CHAIN x${this.combo}!` : "";
    const combo = melee && !down && this.combo >= 2 ? ` COMBO x${this.combo}!` : "";
    const finish = this.weakFinish ? " WEAK FINISH!" : "";
    const drained = healed > 0 ? ` +${healed} HP` : "";
    const head = `${crit ? "CRITICAL! " : ""}${weak ? "WEAKNESS! " : ""}${skill.name}!`;
    await this.say(`${head} ${dealt.join("+")} damage!${drained}${tail}${chain}${combo}${finish}`);
    this.restoreEnemyTint();
    this.updateEnemyHp();
    await this.tip("react");
  }

  // A move's sounds, all in this one place: its own (skillSfx.ts) cast as it
  // starts, a weapon tech's as the dash sets off, and hit i as hit i lands;
  // a crit rings FIGHT's on top
  private moveSfx(skill: Skill, at: "cast" | "hit", i = 0, crit = false): void {
    playSkillSfx(skill.name, at, i);
    if (at === "hit" && crit) Sfx.critical();
  }

  // where the hero stands to strike the foe: a step off its near side (x-80
  // for a 128px foe, as FIGHT always went), a boss's or giant's 192px body
  // too, which the old x-80 put the hero inside of
  private meleeX(): number {
    return this.enemySprite.x - this.enemySprite.displayWidth / 2 - 16;
  }

  // A weapon tech's dash is FIGHT's lunge in two halves with the tech's
  // effects between: strikeIn out, poseRest home.
  // draw back into a crouch and raise the weapon, then dash out to the foe
  // stretched and leaning in, the weapon swung down with afterimages, and
  // `onContact` (if given) as it connects
  private async strikeIn(onContact?: () => void, hold = 0): Promise<void> {
    const hero = this.playerSprite;
    const hasWeapon = !!GameState.equipped.weapon;
    const trail = this.ghostTrail(hero);
    const weaponTrail = this.ghostTrail(this.weaponOverlay, 0.5);
    const startX = hero.x;
    if (hasWeapon) {
      this.weaponOverlay.setAngle(0);
      this.tweens.add({ targets: this.weaponOverlay, angle: WEAPON_UP, duration: this.anim(WINDUP_MS), ease: "Sine.easeOut" });
    }
    await this.tweenPromise(
      hero,
      { x: startX - WINDUP_PX, angle: LEAN_BACK, scaleX: HERO_SCALE * CROUCH[0], scaleY: HERO_SCALE * CROUCH[1] },
      this.anim(WINDUP_MS),
    );
    // FIGHT holds the pose here, the blade up (playerAttack's PERFECT)
    if (hold > 0) await this.wait(hold);
    if (hasWeapon) {
      this.tweens.add({ targets: this.weaponOverlay, angle: WEAPON_DOWN, duration: this.anim(LUNGE_OUT_MS), ease: "Sine.easeIn" });
    }
    await this.tweenPromise(
      hero,
      { x: this.meleeX(), angle: LEAN_FWD, scaleX: HERO_SCALE * STRETCH[0], scaleY: HERO_SCALE * STRETCH[1] },
      this.anim(LUNGE_OUT_MS),
      () => {
        trail();
        if (hasWeapon) weaponTrail();
      },
    );
    if (hasWeapon) this.slashArc();
    onContact?.();
  }

  // back to the stance: at home, upright, at scale, the weapon down
  private async poseRest(home: number): Promise<void> {
    if (GameState.equipped.weapon) {
      this.tweens.add({ targets: this.weaponOverlay, angle: 0, duration: this.anim(LUNGE_BACK_MS), ease: "Sine.easeOut" });
    }
    await this.tweenPromise(this.playerSprite, { x: home, angle: 0, scaleX: HERO_SCALE, scaleY: HERO_SCALE }, this.anim(LUNGE_BACK_MS));
  }

  // a blow-style skill's cast: the hero draws back into a crouch with the
  // weapon up, then thrusts forward as the effects begin (rest: poseRest)
  private async castPose(): Promise<void> {
    const hero = this.playerSprite;
    const hasWeapon = !!GameState.equipped.weapon;
    if (hasWeapon) {
      this.weaponOverlay.setAngle(0);
      this.tweens.add({ targets: this.weaponOverlay, angle: WEAPON_UP, duration: this.anim(WINDUP_MS), ease: "Sine.easeOut" });
    }
    await this.tweenPromise(
      hero,
      { x: hero.x - WINDUP_PX / 2, angle: LEAN_BACK, scaleX: HERO_SCALE * CROUCH[0], scaleY: HERO_SCALE * CROUCH[1] },
      this.anim(WINDUP_MS),
    );
    if (hasWeapon) {
      this.tweens.add({ targets: this.weaponOverlay, angle: WEAPON_DOWN / 2, duration: this.anim(LUNGE_OUT_MS), ease: "Sine.easeIn" });
    }
    this.tweens.add({
      targets: hero,
      x: hero.x + WINDUP_PX,
      angle: LEAN_FWD,
      scaleX: HERO_SCALE * STRETCH[0],
      scaleY: HERO_SCALE * STRETCH[1],
      duration: this.anim(LUNGE_OUT_MS),
      ease: "Quad.easeOut",
    });
  }

  // one more blow of a weapon tech landing: the blade whips through again
  // and the hero jabs in, the foe knocked back
  private meleeHit(crit: boolean): void {
    if (GameState.equipped.weapon) {
      this.weaponOverlay.setAngle(-50);
      this.tweens.add({ targets: this.weaponOverlay, angle: WEAPON_DOWN, duration: this.anim(70), ease: "Sine.easeIn" });
      this.slashArc();
    }
    this.nudge(this.playerSprite, 14, 60);
    this.recoil(this.enemySprite, 1, crit);
  }

  // the blade's white sweep across the foe's near side, gone in 160ms
  private slashArc(): void {
    const g = this.add.graphics().setDepth(5);
    const [x, y] = [this.enemySprite.x - this.enemySprite.displayWidth / 2, this.enemySprite.y];
    g.lineStyle(10, 0xffffff, 0.9);
    g.beginPath();
    g.arc(x - 20, y, 96, -1.1, 0.9, false);
    g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: this.anim(160), onComplete: () => g.destroy() });
  }

  // a skill's side effect landed: THORNS' poison here (VENOM STING's dot, in
  // the purple its ticks fill the foe with, enemyDotTick), the rest as a
  // spell's
  private landSkillEffect(kind: SkillEffect): string {
    if (kind !== "poison") return this.landSpellEffect(kind);
    this.enemyDot = { label: "PSN", turns: COMPANION_DOT_TURNS };
    this.updateEnemyStatus();
    Sfx.poison();
    this.enemySprite.setTint(PSN_TINT).setTintMode(Phaser.TintModes.FILL);
    this.statusOn(this.enemySprite, "poison", STATUS_FX_MS, STATUS_POP_MIN_MS);
    this.flashStatus("PSN", DOT_COLOR.PSN, this.enemySprite.x - 200, this.enemySprite.y);
    return " POISON!";
  }

  // CHL on the foe: its ATK down until the fight ends or a SHATTER spends it
  private chill(): void {
    const before = this.enemy.atk;
    this.chilled = true;
    this.enemy.atk = Math.max(1, Math.round(before * COMPANION_CHILL_MULT));
    this.chillLost = before - this.enemy.atk;
  }

  // The reaction (battleRules REACTIONS) a cast of `element` sets off on the
  // foe as it lands, its status spent here: what the cast's damage is
  // multiplied by, what is added to it, and " MELT!" for its line. Its name
  // pops over the status labels' spot (landSpellEffect), which the cast's own
  // side effect may fill the same moment.
  private react(element: Spell["element"]): { mult: number; extra: number; tail: string } {
    const kind = reactionOf(element, { dot: this.enemyDot?.label ?? null, chilled: this.chilled });
    if (!kind) return { mult: 1, extra: 0, tail: "" };
    const tick = Math.max(1, Math.round(this.enemy.hp * COMPANION_DOT_PCT));
    const { mult, extra } = reactionDamage(kind, tick, this.enemyDot?.turns ?? 0);
    if (kind === "shatter") {
      this.chilled = false;
      this.enemy.atk += this.chillLost;
      this.chillLost = 0;
      Sfx.freeze();
      this.fxOn(this.enemySprite, "fx-ice", HIT_FX_MS);
    } else {
      if (kind === "detonate") Sfx.poison();
      else Sfx.spark();
      this.enemyDot = null;
      this.fxOn(this.enemySprite, "fx-fire", HIT_FX_MS);
    }
    this.updateEnemyStatus();
    Sfx.critical();
    shake(this.cameras.main, 140, 0.01);
    const { name, color } = REACTIONS[kind];
    // 48px left of the status labels' column: a one-hit blow tech can crit
    // (FLAME PILLAR, ICE SPIKES, METEOR), and its "1032!" is 280px about the
    // foe, from x 860; "DETONATE!" (288px) ended at 904 and now ends at 856
    this.flashStatus(`${name}!`, color, this.enemySprite.x - 248, this.enemySprite.y - 56, 8);
    this.reacted = true;
    if (!this.practice) GameState.feats.reactions += 1;
    return { mult, extra, tail: ` ${name}!` };
  }

  // the companion skills' own "would it do anything" rules (see
  // companionSkillUseful), plus BURN_PROOF / CHILL_PROOF; THORNS' poison is
  // VENOM STING's
  private spellEffectCanLand(kind: SkillEffect): boolean {
    const name = this.enemy.name;
    if (kind === "burn") return this.enemyDot === null && !BURN_PROOF.includes(name);
    if (kind === "poison") return this.enemyDot === null;
    if (kind === "chill") return !this.chilled && !CHILL_PROOF.includes(name);
    return !this.stuck && !this.enemy.boss && !this.enemy.giant;
  }

  // Applies a landed side effect; returns the tail for the spell's message.
  // Its label pops beside the foe, on the hero's side: over the sprite it
  // would vanish into the hit flash (the spell's own colour, which is also
  // the label's), and above it is the damage number's lane. "STUN" is 160px
  // wide, so x-200 ends at 840, clear of even a boss's 192px sprite (864).
  private landSpellEffect(kind: SpellEffect): string {
    const x = this.enemySprite.x - 200;
    const y = this.enemySprite.y;
    if (kind === "burn") {
      this.enemyDot = { label: "BRN", turns: COMPANION_DOT_TURNS };
      this.updateEnemyStatus();
      Sfx.spark();
      this.statusOn(this.enemySprite, "burn", STATUS_FX_MS, STATUS_POP_MIN_MS);
      this.flashStatus("BRN", DOT_COLOR.BRN, x, y);
      return " BURN!";
    }
    if (kind === "chill") {
      this.chill();
      this.updateEnemyStatus();
      Sfx.freeze();
      this.statusOn(this.enemySprite, "chill", STATUS_FX_MS, STATUS_POP_MIN_MS);
      this.flashStatus("CHL", "#67e8f9", x, y);
      return " ATK DN!";
    }
    this.stuck = "shock";
    Sfx.shock();
    this.statusOn(this.enemySprite, "shock", STATUS_FX_MS, STATUS_POP_MIN_MS);
    this.showStun();
    this.flashStatus("STUN", "#fde047", x, y);
    return " STUN!";
  }

  private async usePotion(): Promise<void> {
    this.resetCombo();
    if (this.hpFull()) {
      Sfx.error();
      await this.say("HP is already full!");
      return;
    }
    Sfx.buy();
    GameState.inventory.potion -= 1;
    const healed = Math.min(GameState.effMaxHp() - GameState.player.hp, POTION_HP);
    GameState.player.hp += healed;
    this.updatePlayerStats();
    this.ringOn("fx-restore-hp");
    if (healed > 0) this.flashHeal(this.playerSprite.x, this.playerSprite.y, healed);
    await this.say(`Potion heals ${healed} HP!${this.curePoison()}`);
  }

  private async useMPotion(): Promise<void> {
    this.resetCombo();
    if (GameState.player.mp >= GameState.player.maxMp) {
      Sfx.error();
      await this.say("MP is already full!");
      return;
    }
    Sfx.buy();
    GameState.inventory.mPotion -= 1;
    const restored = Math.min(GameState.player.maxMp - GameState.player.mp, MPOTION_MP);
    GameState.player.mp += restored;
    this.updatePlayerStats();
    this.ringOn("fx-restore-mp");
    await this.say(`Magic restores ${restored} MP!`);
  }

  private async useHiPotion(): Promise<void> {
    this.resetCombo();
    if (this.hpFull()) {
      Sfx.error();
      await this.say("HP is already full!");
      return;
    }
    Sfx.buy();
    GameState.inventory.hiPotion -= 1;
    const healed = Math.min(GameState.effMaxHp() - GameState.player.hp, HI_POTION_HP);
    GameState.player.hp += healed;
    this.updatePlayerStats();
    this.ringOn("fx-restore-hp");
    if (healed > 0) this.flashHeal(this.playerSprite.x, this.playerSprite.y, healed);
    await this.say(`Hi-Potion heals ${healed} HP!${this.curePoison()}`);
  }

  private async useEther(): Promise<void> {
    this.resetCombo();
    if (GameState.player.mp >= GameState.player.maxMp) {
      Sfx.error();
      await this.say("MP is already full!");
      return;
    }
    Sfx.buy();
    GameState.inventory.ether -= 1;
    const restored = Math.min(GameState.player.maxMp - GameState.player.mp, ETHER_MP);
    GameState.player.mp += restored;
    this.updatePlayerStats();
    this.ringOn("fx-restore-mp");
    await this.say(`Ether restores ${restored} MP!`);
  }

  private async useElixir(): Promise<void> {
    this.resetCombo();
    if (this.hpFull() && GameState.player.mp >= GameState.player.maxMp) {
      Sfx.error();
      await this.say("HP and MP are already full!");
      return;
    }
    Sfx.buy();
    GameState.inventory.elixir -= 1;
    const hpBefore = GameState.player.hp;
    GameState.player.hp = GameState.effMaxHp();
    GameState.player.mp = GameState.player.maxMp;
    this.updatePlayerStats();
    this.ringOn("fx-restore-all");
    const healed = GameState.effMaxHp() - hpBefore;
    if (healed > 0) this.flashHeal(this.playerSprite.x, this.playerSprite.y, healed);
    await this.say(`Elixir fully restores HP and MP!${this.curePoison()}`);
  }

  private async throwBomb(): Promise<void> {
    this.resetCombo();
    GameState.inventory.bomb -= 1;
    await this.lobBomb();
    Sfx.hit();
    playFx(this, "fx-bomb", this.enemySprite.x, GROUND_Y, this.anim(BOMB_FX_MS));
    shake(this.cameras.main, 220, 0.014);
    const dmg = BOMB_DAMAGE;
    this.enemy.curHp = Math.max(0, this.enemy.curHp - dmg);
    this.updateEnemyHp();
    this.enemySprite.setTint(0xffa500).setTintMode(Phaser.TintModes.FILL);
    this.flashDamage(this.enemySprite.x, this.enemySprite.y, dmg);
    await this.say(`BOOM! ${dmg} damage!`);
    this.restoreEnemyTint();
  }

  // The BOMB, its own icon, lobbed from the hero's hand in an arc to the
  // foe's feet, turning over once; it blows where it lands (fx.ts fx-bomb).
  // Its bottom row on the ground line: 14 of the icon's 16 cells, 24px under
  // its middle.
  private async lobBomb(): Promise<void> {
    const [fromX, fromY] = [this.playerSprite.x + SHOT_START_X, this.playerSprite.y - 20];
    const [toX, toY] = [this.enemySprite.x, GROUND_Y - 24];
    const bomb = this.add.image(fromX, fromY, "icon-bomb");
    await new Promise<void>((resolve) => {
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: this.anim(BOMB_LOB_MS),
        onUpdate: (tw) => {
          const p = tw.getValue() ?? 0;
          const y = Phaser.Math.Linear(fromY, toY, p) - Math.sin(Math.PI * p) * BOMB_HOP;
          bomb.setPosition(Phaser.Math.Linear(fromX, toX, p), y).setRotation(p * Math.PI * 2);
        },
        onComplete: () => resolve(),
      });
    });
    bomb.destroy();
  }

  private async throwCandy(): Promise<void> {
    this.resetCombo();
    if (this.enemy.boss) {
      Sfx.error();
      await this.say(`The ${this.enemy.name} is too strong!`);
      return;
    }
    if (this.practice) {
      Sfx.error();
      await this.say("No catching in the yard!");
      return;
    }
    // the TROLL KING is a giant, catchable in the wild but not mid-gauntlet
    if (this.arena) {
      Sfx.error();
      await this.say("No catching in the ARENA!");
      return;
    }
    // ...nor as an ABYSS guardian (abyss.ts): a sure TROLL KING on B10 would
    // be a free catch
    if (this.abyss?.guardian) {
      Sfx.error();
      await this.say("A GUARDIAN can't be caught!");
      return;
    }
    Sfx.capture();
    GameState.inventory.candy -= 1;
    if (Math.random() < captureChance(this.enemy.curHp, this.enemy.hp) + GameState.perk("tamer")) {
      GameState.caught.push(this.enemy.name);
      GameState.companion = this.enemy.name;
      await this.catchFx();
      await this.say(`You caught ${this.enemy.name}! It joins your party!`);
      Sfx.victory();
      return this.victory(true);
    }
    // the shake is awaited too: a Z mashed through the line would otherwise
    // start the foe's lunge from mid-shake, and the lunge returns to its start
    await Promise.all([this.headShake(), this.say("It broke free!")]);
  }

  // A catch: the foe glows candy pink and, shrinking, is drawn into the
  // companion's place, where it lands as the new companion (in place of any
  // old one, as GameState.companion now says). Its way (p) starts slow and
  // speeds up while its size shrinks fast and then slowly, and its 140px
  // hop (a flier's FLY_LIFT less, being up that much already) peaks late
  // (p * p), over the hero rather than under the foe's stat window: checked
  // in 0.001 steps for every catchable foe from its rest on the ground line
  // to its rest at COMPANION_SCALE, no opaque top edge rises above y 231 (the
  // TROLL KING's, 96px at 2x shrinking), 31px under the windows, and it
  // clears the hero's head (x 280..360, y 352..408) but for a brush of 12ms
  // at most (the SALAMANDER's), under a frame. BATTLE SPEED applies: 0.88s
  // at 1x.
  private async catchFx(): Promise<void> {
    const sprite = this.enemySprite;
    this.enemyIdle?.stop();
    this.settleEnemyScale();
    sprite.setTint(CANDY_PINK).setTintMode(Phaser.TintModes.FILL);
    this.catchBurst.explode(14, sprite.x, sprite.y);
    // lifted off the ground as it goes, so its shadow goes with the glow
    this.tweens.add({ targets: this.enemyStance, fade: 0, duration: this.anim(200) });
    const flying = !!this.enemy.flying;
    const toY = this.restY(this.enemy.texture, COMPANION_SCALE, COMPANION_GROUND_Y, flying);
    const hop = 140 - (flying ? FLY_LIFT : 0);
    const { x: fromX, y: fromY, scale: fromScale } = sprite;
    let last = 0;
    await new Promise<void>((resolve) => {
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: this.anim(700),
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0;
          const p = 1 - Math.cos((t * Math.PI) / 2);
          const x = Phaser.Math.Linear(fromX, COMPANION_X, p);
          const y = Phaser.Math.Linear(fromY, toY, p) - Math.sin(Math.PI * p * p) * hop;
          sprite.setPosition(x, y).setScale(Phaser.Math.Linear(fromScale, 0.5, Math.sin((t * Math.PI) / 2)));
          if (this.time.now - last < this.anim(40)) return;
          last = this.time.now;
          this.catchBurst.emitParticleAt(x, y, 1);
        },
        onComplete: () => resolve(),
      });
    });
    sprite.setVisible(false);
    this.catchBurst.explode(16, COMPANION_X, toY);
    // an old companion's breathing ran over its own texture's footing
    this.companionIdle?.stop();
    const caught = this.enemy.texture;
    if (this.companionSprite) this.companionSprite.setTexture(caught);
    else this.companionSprite = this.add.sprite(COMPANION_X, toY, caught);
    this.companionSprite.setScale(COMPANION_SCALE);
    this.companionStance = this.stand(this.companionSprite, COMPANION_GROUND_Y, flying, this.companionStance);
    this.companionIdle = this.idleBob(this.companionSprite, 1200, 0, flying);
    this.companionSprite.setScale(0.5);
    await this.tweenPromise(this.companionSprite, { scale: COMPANION_SCALE, ease: "Back.easeOut" }, this.anim(180));
  }

  // "It broke free!": the foe shakes its head, a dying wiggle on x (the
  // breathing has y) that ends exactly where it stood
  private headShake(): Promise<void> {
    const sprite = this.enemySprite;
    const x = sprite.x;
    return new Promise((resolve) => {
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: this.anim(360),
        onUpdate: (tw) => {
          const p = tw.getValue() ?? 0;
          sprite.setX(x + Math.sin(p * Math.PI * 4) * 8 * (1 - p));
        },
        onComplete: () => {
          sprite.setX(x);
          resolve();
        },
      });
    });
  }

  // the turn spent bracing for the enemy's next hit (guardHit), which
  // answers a wind-up's CHG before WARD; it breaks the combo as any
  // non-attack does
  private async defend(): Promise<void> {
    this.resetCombo();
    this.defending = true;
    Sfx.ward();
    this.flashStatus("DEFEND", "#e2e8f0");
    // no line: "You brace for the blow!" said what the pop does, for a key
    // every DEFEND (eight in a FLAME DRAKE fight). A beat for the pop to read.
    await this.wait(this.anim(DEFEND_MS));
  }

  // one chance per battle to lift bonus gold instead of fighting; costs the
  // turn the same as any other non-fight action (companion still attacks,
  // enemy still counters) whether it succeeds or not
  private async attemptSteal(): Promise<void> {
    this.resetCombo();
    if (this.enemy.boss) {
      Sfx.error();
      await this.say(`You can't steal from the ${this.enemy.name}!`);
      return;
    }
    if (this.stolen) {
      Sfx.error();
      await this.say("There's nothing left to steal!");
      return;
    }
    if (Math.random() < STEAL_CHANCE) {
      const stolenGold = GameState.gainGold(Math.floor(this.enemy.gold * STEAL_GOLD_PCT));
      // only latch the once-per-battle flag if gold actually landed — at the
      // gold cap gainGold() clamps to 0, and the roll shouldn't be spent on
      // nothing (same MAX_GOLD edge the shop sell fix guards against)
      if (stolenGold > 0) this.stolen = true;
      Sfx.pickup();
      this.coinBurst.setPosition(this.enemySprite.x, this.enemySprite.y);
      this.coinBurst.explode(8);
      await this.say(`You lift ${stolenGold} gold from the ${this.enemy.name}!`);
      return;
    }
    Sfx.error();
    await this.say("You failed to steal anything!");
  }

  // the caught monster fights alongside the hero: one follow-up strike (or its
  // species skill) per turn, scaled by its species attack plus half the hero's
  // level and its bond, times COMPANION_ATK_MULT
  private async companionAttack(): Promise<void> {
    const name = GameState.companion;
    const def = name ? Object.values(ENEMIES).find((e) => e.name === name) : undefined;
    if (!name || !def || !this.companionSprite) return;
    // one more round fought together — grows this companion's permanent
    // bond bonus (see GameState.companionBondBonus); this fires once per
    // surviving round, so a long fight builds bond faster than a one-shot kill
    const wasPartner = GameState.isPartner(name);
    const partnerBonus = GameState.partnerBonus();
    GameState.companionBond[name] = (GameState.companionBond[name] ?? 0) + 1;
    const bond = GameState.companionBondBonus(name);
    const atk = Math.round(companionAtk(def, GameState.player.level, bond) * (1 + GameState.perk("pack")));
    const skill = COMPANION_SKILLS[name];
    if (skill && this.companionSkillUseful(skill) && Math.random() < companionSkillChance(bond)) {
      await this.companionSkill(name, skill, atk);
    } else {
      Sfx.attack();
      let dmg = 0;
      let crit = false;
      await this.companionLunge(() => {
        ({ dmg, crit } = rollDamage(atk, this.enemy.def));
        this.companionHit(dmg, crit);
      });
      await this.say(crit ? `CRITICAL! ${name} helps for ${dmg}!` : `${name} attacks for ${dmg}!`);
    }
    if (!wasPartner && GameState.isPartner(name)) await this.announcePartner(name, GameState.partnerBonus() > partnerBonus);
  }

  // This round's strike took the bond to +5: the species is a PARTNER for
  // good (GameState.partnerBonus), said at the end of the companion's turn
  // so the strike plays out first. The second line only when it made an even
  // count, which is what raises the hero's ATK/DEF. "MAGMA SLIME IS NOW A
  // PARTNER!" (the longest catchable name) is 29 glyphs of a row's 36.
  private async announcePartner(name: string, raised: boolean): Promise<void> {
    Sfx.levelup();
    if (this.companionSprite) this.glowBurst.setPosition(this.companionSprite.x, this.companionSprite.y).explode(16);
    const line = `${name} IS NOW A PARTNER!`;
    await this.say(raised ? `${line}\nATK/DEF +1 (${GameState.partnerCount()} PARTNERS)` : line);
  }

  // Dash at the foe along the ground and back, its shadow along (update);
  // onHit runs once at the far end of the dash. Once: Phaser fires onYoyo per
  // tweened property, and when this tween also moved y (up to the foe, which
  // then stood higher) the strike landed twice — two rolls of damage behind a
  // message that reported one. The breathing holds meanwhile, so the dash
  // keeps one height. It ends COMPANION_DASH_GAP short of the foe's middle.
  private companionLunge(onHit: () => void): Promise<void> {
    const sprite = this.companionSprite;
    if (!sprite) return Promise.resolve();
    let struck = false;
    this.companionIdle?.pause();
    return new Promise<void>((resolve) => {
      this.tweens.add({
        targets: sprite,
        x: this.enemySprite.x - COMPANION_DASH_GAP,
        duration: this.anim(130),
        yoyo: true,
        hold: this.anim(50),
        onUpdate: this.ghostTrail(sprite),
        onYoyo: () => {
          if (struck) return;
          struck = true;
          onHit();
        },
        onComplete: () => {
          this.companionIdle?.resume();
          resolve();
        },
      });
    });
  }

  // `skillFx`: a skill's own sheet (skillFxOn) in place of fx-hit, a crit's
  // starburst still over it
  private companionHit(dmg: number, crit: boolean, tint?: number, skillFx?: () => void): void {
    Sfx.strike();
    if (crit) Sfx.critical();
    this.enemy.curHp = Math.max(0, this.enemy.curHp - dmg);
    skillFx?.();
    if (crit || !skillFx) this.fxOn(this.enemySprite, crit ? "fx-crit" : "fx-hit", HIT_FX_MS);
    this.hitBurst.setPosition(this.enemySprite.x, this.enemySprite.y);
    this.hitBurst.explode(crit ? 12 : 6);
    if (tint !== undefined) {
      this.enemySprite.setTint(tint).setTintMode(Phaser.TintModes.FILL);
      this.time.delayedCall(this.anim(200), () => this.restoreEnemyTint());
    }
    this.flashDamage(this.enemySprite.x, this.enemySprite.y, dmg, crit);
    this.updateEnemyHp();
  }

  // A skill's own sheet on the foe (SKILL_FX), at the foe's scale (4px over
  // a boss: fx.ts COMPANION_SHEETS); `mirrored`, raked the other way
  private skillFxOn(fx: SkillFx, mirrored = false): void {
    const y = fx.ground ? GROUND_Y : GROUND_Y - (this.enemy.flying ? FLY_LIFT : 0);
    const ms = this.anim(fx.ms);
    const drop = (dx: number): void => {
      const x = this.enemySprite.x + dx;
      const sprites = [playFx(this, fx.key, x, y, ms, this.enemyBaseScale, mirrored)];
      if (fx.back) {
        const back = playFx(this, fx.back, x, y, ms, this.enemyBaseScale, mirrored);
        this.children.moveBelow(back, this.enemySprite);
        sprites.push(back);
      }
      if (fx.fade) this.tweens.add({ targets: sprites, alpha: 0, delay: ms * (1 - fx.fade), duration: ms * fx.fade - 1 });
    };
    for (const [dx, delay] of fx.drops ?? [[0, 0]]) {
      if (delay > 0) this.time.delayedCall(this.anim(delay), () => drop(dx));
      else drop(dx);
    }
    if (fx.jolt) shake(this.cameras.main, ...fx.jolt);
  }

  // FIREBALL: the FIRE IMP throws one from where it stands, with a hop
  // toward the foe, in place of a dash: FIRE's own shot at the imp's 2px
  // cell (COMPANION_SCALE). onHit as it lands (its burst, companionSkill).
  private async companionCast(onHit: () => void): Promise<void> {
    const sprite = this.companionSprite;
    if (!sprite) return;
    const foe = this.enemySprite;
    const [x, y] = [sprite.x + COMPANION_SHOT_X, sprite.y];
    this.tweens.add({ targets: sprite, x: sprite.x + 16, duration: this.anim(90), yoyo: true });
    const shot = loopFx(this, "fx-fireball", x, y, this.anim(30), COMPANION_SCALE).setRotation(Math.atan2(foe.y - y, foe.x - x));
    await this.tweenPromise(shot, { x: foe.x, y: foe.y }, this.anim(COMPANION_SHOT_MS));
    shot.destroy();
    shake(this.cameras.main, 100, 0.006);
    onHit();
  }

  // PILFER: three coins (fx.ts fx-coin) spin off the foe in arcs, a beat
  // apart, to the goblin's place as it dashes back, at its 2px cell
  // (COMPANION_SCALE). Each next one hops higher. The highest (PILFER_HOP +
  // 48), off the highest flier (the NIGHT WISP), has its top at y 181 at its
  // peak, between the windows (x 496..784, under the NIGHT/ARENA/ABYSS note
  // to y 116), and no higher than y 202 where it passes over one (their
  // bottom 200), off a coin's opaque texels frame by frame.
  private pilferCoins(): void {
    const goblin = this.companionSprite;
    if (!goblin) return;
    const [fromX, fromY] = [this.enemySprite.x, this.enemySprite.y];
    const [toX, toY] = [COMPANION_X, goblin.y];
    for (let i = 0; i < 3; i++) {
      const coin = loopFx(this, "fx-coin", fromX, fromY, this.anim(30), COMPANION_SCALE).setVisible(false);
      this.tweens.addCounter({
        from: 0,
        to: 1,
        delay: this.anim(i * PILFER_GAP_MS),
        duration: this.anim(PILFER_COIN_MS),
        onStart: () => coin.setVisible(true),
        onUpdate: (tw) => {
          const p = tw.getValue() ?? 0;
          coin.setPosition(
            Phaser.Math.Linear(fromX, toX, p),
            Phaser.Math.Linear(fromY, toY, p) - Math.sin(Math.PI * p) * (PILFER_HOP + i * 24),
          );
        },
        onComplete: () => coin.destroy(),
      });
    }
  }

  // a skill that can't do anything this round isn't rolled at all, so the
  // companion strikes normally instead of wasting its turn
  private companionSkillUseful(skill: CompanionSkill): boolean {
    switch (skill.kind) {
      case "heal":
        return GameState.player.hp < GameState.effMaxHp();
      case "pilfer":
        // no gold out of a repeatable gauntlet but the prize (see arena.ts)
        return !this.pilfered && !this.arena && !this.practice;
      case "dot":
        return this.enemyDot === null;
      case "snare":
        return !this.stuck && !this.enemy.boss && !this.enemy.giant;
      case "guard":
        return !this.guarded && this.wardTurns === 0;
      case "chill":
        return !this.chilled;
      default:
        return true;
    }
  }

  // Messages stay within one 54-glyph line at worst: "SPIDER: WEB SNARE!
  // 999, foe stuck" (33), "FROST MOTH: CHILL! 999 dmg ATK DN" (33).
  private async companionSkill(name: string, skill: CompanionSkill, atk: number): Promise<void> {
    const head = `${name}: ${skill.name}!`;
    if (skill.kind === "heal") {
      const max = GameState.effMaxHp();
      const healed = Math.min(max - GameState.player.hp, Math.max(1, Math.round(max * COMPANION_HEAL_PCT)));
      GameState.player.hp += healed;
      Sfx.magic();
      this.ringOn("fx-restore-hp");
      this.flashHeal(this.playerSprite.x, this.playerSprite.y, healed);
      this.updatePlayerStats();
      await this.say(`${head} +${healed} HP`);
      return;
    }

    Sfx.attack();
    if (skill.kind === "double") {
      const bites: number[] = [];
      await this.companionLunge(() => {
        const { dmg, crit } = rollDamage(atk, this.enemy.def);
        bites.push(Math.max(1, Math.floor(dmg * COMPANION_DOUBLE_MULT)));
        this.companionHit(bites[0], crit, undefined, () => this.skillFxOn(SKILL_FX[skill.name]));
      });
      if (this.enemy.curHp > 0) {
        await this.companionLunge(() => {
          const { dmg, crit } = rollDamage(atk, this.enemy.def);
          bites.push(Math.max(1, Math.floor(dmg * COMPANION_DOUBLE_MULT)));
          // the second raked the other way
          this.companionHit(bites[1], crit, undefined, () => this.skillFxOn(SKILL_FX[skill.name], true));
        });
      }
      await this.say(`${head} ${bites.join("+")} dmg`);
      return;
    }

    const weak = skill.element !== undefined && this.enemy.weakness === skill.element;
    const tint =
      skill.element === "ice"
        ? 0x67e8f9
        : skill.element === "fire" || skill.dot === "BRN"
          ? 0xfb923c
          : skill.dot === "PSN"
            ? 0xc084fc
            : 0xffffff;
    let dmg = 0;
    const cast = skill.name === "FIREBALL";
    const skillFx = SKILL_FX[skill.name];
    // FIREBALL lands in FIRE's own burst, over a status sheet set off with it as a spell's is
    const hitFx = cast
      ? () => this.fxOn(this.enemySprite, "fx-fire", 280).setDepth(SPELL_BURST_DEPTH)
      : skillFx && (() => this.skillFxOn(skillFx));
    const onHit = (): void => {
      const roll = rollDamage(atk, skill.pierce ? 0 : this.enemy.def);
      dmg = Math.max(1, Math.floor(roll.dmg * (skill.mult ?? 1) * (weak ? WEAKNESS_MULT : 1)));
      this.companionHit(dmg, roll.crit, tint, hitFx);
    };
    await (cast ? this.companionCast(onHit) : this.companionLunge(onHit));

    let tail = `${dmg} dmg`;
    if (skill.kind === "drain") {
      const healed = Math.min(GameState.effMaxHp() - GameState.player.hp, Math.ceil(dmg / 2));
      GameState.player.hp += healed;
      if (healed > 0) this.flashHeal(this.playerSprite.x, this.playerSprite.y, healed);
      this.updatePlayerStats();
      tail = `${dmg} dmg +${healed} HP`;
    } else if (skill.kind === "pilfer") {
      this.pilfered = true;
      const gold = GameState.gainGold(Math.max(1, Math.round(this.enemy.gold * COMPANION_PILFER_PCT)));
      Sfx.pickup();
      this.pilferCoins();
      tail = `${dmg} dmg +${gold}G`;
    } else if (skill.kind === "dot" && skill.dot && this.enemy.curHp > 0) {
      this.enemyDot = { label: skill.dot, turns: COMPANION_DOT_TURNS };
      this.updateEnemyStatus();
      tail = `${dmg} dmg, ${skill.dot}`;
    } else if (skill.kind === "snare" && this.enemy.curHp > 0) {
      this.stuck = "web";
      this.showStun();
      tail = `${dmg}, foe stuck`;
    } else if (skill.kind === "guard") {
      this.guarded = true;
      tail = `${dmg} dmg +GUARD`;
    } else if (skill.kind === "chill" && this.enemy.curHp > 0) {
      this.chill();
      this.updateEnemyStatus();
      // frosted over as ICE's CHL leaves it (landSpellEffect): CHILL never
      // ticks, so this is the one time the frost shows
      this.statusOn(this.enemySprite, "chill", STATUS_FX_MS, STATUS_POP_MIN_MS);
      tail = `${dmg} dmg ATK DN`;
    } else if (weak) {
      tail = `WEAK! ${dmg} dmg`;
    }
    await this.say(`${head} ${tail}`);
  }

  // start of the enemy's turn, the companion-skill twin of poisonTick(): it
  // can't take the last HP either, so a fight is still won by a blow
  private async enemyDotTick(): Promise<void> {
    const dot = this.enemyDot;
    if (!dot) return;
    dot.turns -= 1;
    const dmg = Math.min(Math.max(1, Math.round(this.enemy.hp * COMPANION_DOT_PCT)), this.enemy.curHp - 1);
    const word = dot.label === "PSN" ? "POISON" : "BURN";
    if (dmg > 0) {
      this.enemy.curHp -= dmg;
      if (dot.label === "PSN") Sfx.poison();
      else Sfx.spark();
      this.enemySprite.setTint(dot.label === "PSN" ? PSN_TINT : 0xfb923c).setTintMode(Phaser.TintModes.FILL);
      this.statusOn(this.enemySprite, dot.label === "PSN" ? "poison" : "burn", STATUS_FX_MS, STATUS_POP_MIN_MS);
      this.flashDamage(this.enemySprite.x, this.enemySprite.y, dmg);
      this.updateEnemyHp();
    }
    // The last tick and its wearing off on one line, where they were two and
    // a key each: "GLACIER GOLEM takes 999 poison! The poison wears off." is
    // 53 glyphs. No tick (the foe at 1 HP), only the wearing off.
    const over = dot.turns === 0;
    if (over) {
      this.enemyDot = null;
      this.updateEnemyStatus();
    }
    const tick = dmg > 0 ? `${this.enemy.name} takes ${dmg} ${word.toLowerCase()}!` : "";
    const worn = over ? (dmg > 0 ? ` The ${word.toLowerCase()} wears off.` : `${word} on ${this.enemy.name} wore off.`) : "";
    if (tick || worn) await this.say(tick + worn);
    this.restoreEnemyTint();
  }

  // the foe's turn, then what it will do with its next (the intent tag)
  private async enemyTurn(): Promise<void> {
    // ARMOR lasts so many of its turns, the one it went up in not counted
    const armored = this.armor;
    await this.enemyAct();
    if (armored && this.armor === armored && --armored.turns <= 0) {
      this.enemy.def -= armored.def;
      this.armor = null;
      this.foeBuff = null;
      this.updateEnemyStatus();
    }
    // one a lost turn (web, shock) left unused stays up for the next
    if (this.running && !this.intent && GameState.player.hp > 0 && this.enemy.curHp > 0) this.rollIntent();
  }

  // Whether the foe's next turn is its move, shown from now on. A practice
  // bout has no gold to take.
  private rollIntent(): void {
    const move = this.enemy.move;
    const ready = moveReady(move, {
      moved: this.moved,
      buffed: this.foeBuff !== null,
      snatched: this.snatched > 0,
      gold: this.practice ? 0 : GameState.gold,
      immune: move?.status === "poison" ? this.poisonTurns > 0 : this.frozen || this.freezeGrace > 0,
    });
    this.moved = false;
    // a boss winding up has its CHG up: one warning at a time, and the mark
    // its HP has passed is announced after the strike
    this.intent = ready && !this.charging && moveDue(move, { used: this.movesUsed, curHp: this.enemy.curHp, hp: this.enemy.hp });
    if (this.intent && move?.at) this.movesUsed += 1;
    this.updateEnemyStatus();
  }

  private async enemyAct(): Promise<void> {
    await this.enemyDotTick();
    // checked here rather than after each hit: whatever brought the boss low
    // (FIGHT, spell, bomb, companion), it snaps right before it next acts
    if ((this.enemy.boss || this.enemy.giant) && !this.enraged && this.enemy.curHp <= this.enemy.hp * ENRAGE_HP_SHARE) {
      await this.enrage();
    }
    // SPIDER's web or BOLT's shock: this whole turn is lost (never on a boss
    // or giant). "CURSED GOBLIN is shocked stiff!" is 31 glyphs.
    if (this.stuck) {
      const line = this.stuck === "web" ? "is stuck in the web!" : "is shocked stiff!";
      this.stuck = null;
      await this.say(`${this.enemy.name} ${line}`);
      // the stars stay round its head for the line that spends the turn
      this.hideStun();
      return;
    }
    // its announced move, an ordinary foe's in place of everything below (a
    // turn lost above keeps it for the next)
    if (this.intent && this.enemy.move) {
      this.intent = false;
      this.moved = true;
      this.updateEnemyStatus();
      // the turns since a thaw count through a move's turn as any other's
      if (this.freezeGrace > 0) this.freezeGrace -= 1;
      await this.enemyMove(this.enemy.move);
      // a boss's is on top of its turn, not in place of it: in its place it
      // took the turn's blow or wind-up with it and the fight got easier
      // (KING SLIME Lv6 solo: 83% of max HP lost became 76%)
      if (!this.enemy.move.at || !this.running || GameState.player.hp <= 0 || this.enemy.curHp <= 0) return;
    }
    // a wound-up strike lands before anything else this turn could; a fresh
    // wind-up only once the cooldown has run out (see BOSS_TELLS)
    const tell = BOSS_TELLS[this.enemy.name];
    if (tell && this.charging) return this.bossStrike(tell);
    if (tell && this.tellCooldown > 0) this.tellCooldown -= 1;
    else if (tell && !this.frozen && Math.random() < (tell.chance ?? BOSS_TELL_CHANCE)) return this.bossTell(tell);
    const special = this.rollSpecial();
    if (this.freezeGrace > 0) this.freezeGrace -= 1;
    if (special === "regen") return this.regenerate();

    const { dmg, crit, parried, note } = await this.enemyBlow();
    await this.say(crit ? `CRITICAL! ${this.enemy.name} strikes for ${dmg}!${note}` : `${this.enemy.name} attacks for ${dmg}!${note}`);
    this.setPlayerTint(undefined);
    // a parried blow carries no poison or freeze
    if (GameState.player.hp <= 0 || parried) return;

    if (special === "poison" || special === "freeze") await this.afflict(special);
  }

  // poison or freeze off a blow that landed
  private async afflict(special: "poison" | "freeze"): Promise<void> {
    // a resist accessory still takes the hit but stops the status, and says
    // so — otherwise the gear would look like it did nothing
    if (GameState.resists(special)) {
      await this.say(special === "poison" ? "ANTIDOTE CHARM blocks the poison!" : "EMBER RING blocks freezing!");
      return;
    }
    // ...and a MOON TEA (cooking.ts) shrugs off a share of what gets past
    if (this.meal && Math.random() < (this.meal.def.effect.resist ?? 0)) {
      await this.say(`The ${this.meal.def.name} wards off ${special === "poison" ? "poison" : "the frost"}!`);
      return;
    }
    if (special === "poison") {
      Sfx.poison();
      this.poisonTurns = POISON_TURNS;
      this.updateStatus();
      this.statusOn(this.playerSprite, "poison", STATUS_FX_MS, STATUS_POP_MIN_MS);
      this.flashStatus("PSN", "#c084fc");
      // what cures it is said the first time in a fight; after that the pop
      // and the tag are the news (a long fight poisons again and again)
      if (!this.poisonTold) await this.say("POISONED! HEAL or POTION cures it.");
      this.poisonTold = true;
    } else await this.freezeHero();
  }

  // One blow of the foe's on the hero, all but its line: the lunge (and its
  // PARRY), the damage at `mult` of the roll through WARD/GUARD/DEFEND, the
  // sparks (`club`: the TROLL KING's burst of dust instead) and the knock-back.
  private async enemyBlow(mult = 1, club = false): Promise<{ dmg: number; crit: boolean; parried: boolean; note: string }> {
    const parried = await this.enemyLunge();
    // impact thud lands with the damage, not at the wind-up
    if (!parried) Sfx.hit();
    const hit = rollDamage(this.enemy.atk, this.heroDef());
    const crit = hit.crit;
    const guard = this.guardHit(mult === 1 ? hit.dmg : moveDamage(hit.dmg, mult));
    const { note, braced } = guard;
    const dmg = parried ? parriedDamage(guard.dmg) : guard.dmg;
    if (crit) Sfx.critical();
    GameState.player.hp = Math.max(0, GameState.player.hp - dmg);
    this.updatePlayerStats();
    this.setPlayerTint(0xff6666, true);
    if (club && !crit) playFx(this, CLUB_FX, this.playerSprite.x, GROUND_Y, this.anim(450), this.enemyBaseScale, true);
    else this.fxOn(this.playerSprite, crit ? "fx-crit" : "fx-hit", HIT_FX_MS);
    if (braced) this.blockOn();
    this.hitBurst.setPosition(this.playerSprite.x, this.playerSprite.y);
    this.hitBurst.explode(crit ? 16 : 8);
    shake(this.cameras.main, crit ? 120 : 80, crit ? 0.012 : 0.006);
    this.recoil(this.playerSprite, -1, crit);
    this.flashDamage(this.playerSprite.x, this.playerSprite.y, dmg, crit);
    return { dmg, crit, parried, note };
  }

  // The foe's move (monsters.ts EnemyMove, battleRules MOVE_*). A blow in it
  // is parried as any other, and a parried one brings nothing with it: no
  // drain, no gold taken. Longest lines (an elite's name carries no prefix):
  // "MAGMA SLIME uses CRUST! DEF up: spells cut through." 51 glyphs, "GOBLIN
  // hits for 999 and snatches 9999G! (DEFEND)" 48.
  private async enemyMove(move: EnemyMove): Promise<void> {
    const name = this.enemy.name;
    if (move.kind === "blast") return this.enemyBlast(move);
    if (move.kind === "howl" || move.kind === "harden" || move.kind === "armor") {
      const howl = move.kind === "howl";
      const def = hardenDef(this.enemy.atk);
      if (howl) this.enemy.atk = Math.round(this.enemy.atk * MOVE_HOWL_ATK);
      else this.enemy.def += def;
      if (move.kind === "armor") this.armor = { def, turns: move.turns ?? 2 };
      this.foeBuff = howl ? "ATK+" : "DEF+";
      this.updateEnemyStatus();
      const fx = MOVE_FX[move.name];
      if (fx) {
        Sfx.emit(fx.sfx);
        playFx(this, fx.key, this.enemySprite.x, GROUND_Y, this.anim(fx.ms), this.enemyBaseScale);
      } else if (howl) Sfx.charge();
      else Sfx.ward();
      this.enemySprite.setTint(howl ? 0xfca5a5 : 0xcbd5e1).setTintMode(Phaser.TintModes.FILL);
      this.pulseEnemy(1.08, 160);
      this.glowBurst.setPosition(this.enemySprite.x, this.enemySprite.y);
      this.glowBurst.explode(12);
      this.flashStatus(this.foeBuff, howl ? "#fca5a5" : "#cbd5e1", this.enemySprite.x - 200, this.enemySprite.y);
      if (!howl) {
        await this.say(`${name} uses ${move.name}! DEF up: spells cut through.`);
        this.restoreEnemyTint();
        return;
      }
      // The howl is no turn spent: its bite follows, the stronger for it, and
      // the two share a line. With one of its own ("lets out a HOWL! Its ATK
      // rises.") the turn took a key more than any other foe's. "CRITICAL!
      // WOLF howls (ATK up), bites for 999! (DEFEND)" is 53 glyphs.
      await this.wait(this.anim(HOWL_MS));
      this.restoreEnemyTint();
      const bite = await this.enemyBlow();
      await this.say(
        bite.crit
          ? `CRITICAL! ${name} howls (ATK up), bites for ${bite.dmg}!${bite.note}`
          : `${name} howls (ATK up) and bites for ${bite.dmg}!${bite.note}`,
      );
      this.setPlayerTint(undefined);
      return;
    }
    if (move.kind === "flurry") {
      const [hits, mult] = [move.hits ?? 2, move.mult ?? MOVE_FLURRY_MULT];
      const dealt: number[] = [];
      let note = "";
      for (let i = 0; i < hits && GameState.player.hp > 0; i++) {
        // home before it comes again: the next lunge starts from where it stands
        if (i > 0) await this.wait(this.anim(LUNGE_BACK_MS) + 20);
        const blow = await this.enemyBlow(mult, !!move.at);
        dealt.push(blow.dmg);
        note = blow.note || note;
      }
      // "TROLL KING strikes 3 times: 99, 99 and 99! (DEFEND)" is 51 glyphs
      const list = dealt.length > 1 ? `${dealt.slice(0, -1).join(", ")} and ${dealt[dealt.length - 1]}` : `${dealt[0]}`;
      const verb = hits === 2 ? "claws twice:" : `strikes ${dealt.length} times:`;
      await this.say(dealt.length > 1 ? `${name} ${verb} ${list}!${note}` : `${name} strikes for ${list}!${note}`);
      this.setPlayerTint(undefined);
      return;
    }
    const { dmg, crit, parried, note } = await this.enemyBlow(move.kind === "snatch" ? MOVE_SNATCH_MULT : 1);
    const landed = !parried && GameState.player.hp > 0;
    if (move.kind === "afflict") {
      // the plain attack's line, then the sting or the frost it carried
      await this.say(crit ? `CRITICAL! ${name} strikes for ${dmg}!${note}` : `${name} attacks for ${dmg}!${note}`);
      this.setPlayerTint(undefined);
      if (landed && move.status) await this.afflict(move.status);
      return;
    }
    if (move.kind === "drain") {
      const healed = landed ? Math.min(dmg, this.enemy.hp - this.enemy.curHp) : 0;
      if (healed > 0) {
        this.enemy.curHp += healed;
        this.flashHeal(this.enemySprite.x, this.enemySprite.y, healed);
        this.updateEnemyHp();
      }
      await this.say(healed > 0 ? `${name} bites for ${dmg} and drains ${healed} HP!${note}` : `${name} bites for ${dmg}!${note}`);
    } else {
      const gold = landed && !this.practice ? snatchGold(GameState.gold, this.enemy.gold) : 0;
      if (gold > 0) {
        GameState.gold -= gold;
        this.snatched = gold;
        Sfx.pickup();
        // left of the hero: over its head the blow's own number is up ("-9999G"
        // is 192px, x 54..246; a crit's number starts at 248)
        this.flashStatus(`-${gold}G`, "#fbbf24", this.playerSprite.x - 170, this.playerSprite.y - 80, 8);
      }
      await this.say(gold > 0 ? `${name} hits for ${dmg} and snatches ${gold}G!${note}` : `${name} hits for ${dmg}!${note}`);
    }
    this.setPlayerTint(undefined);
  }

  // A blast (EnemyMove "blast"): no lunge and so no PARRY. Its sheet (MOVE_FX)
  // plays at the hero's feet from the foe's side and the hit lands as the
  // sheet's does; WARD, BULWARK and DEFEND take their share as of any blow.
  // "FLAME DRAKE's SWEEP hits for 999! (DEFEND)" is 44 glyphs.
  private async enemyBlast(move: EnemyMove): Promise<void> {
    const fx = MOVE_FX[move.name];
    if (fx) {
      Sfx.emit(fx.sfx);
      playFx(this, fx.key, this.playerSprite.x, GROUND_Y, this.anim(fx.ms), this.enemyBaseScale, true);
    } else Sfx.charge();
    this.pulseEnemy(1.1, 120);
    await this.wait(this.anim(fx?.hit ?? 360));
    Sfx.hit();
    Sfx.critical();
    const { dmg, note, braced, countered } = this.guardHit(
      moveDamage(rollDamage(this.enemy.atk, this.heroDef()).dmg, move.mult ?? 1),
      true,
    );
    GameState.player.hp = Math.max(0, GameState.player.hp - dmg);
    this.updatePlayerStats();
    this.setPlayerTint(0xff6666, true);
    // its own sheet is the hit's picture; without one, the crit's and a flash
    if (!fx) {
      this.fxOn(this.playerSprite, "fx-crit", HIT_FX_MS);
      flash(this.cameras.main, 120, 255, 255, 255);
    }
    if (braced) this.blockOn();
    this.hitBurst.setPosition(this.playerSprite.x, this.playerSprite.y);
    this.hitBurst.explode(20);
    shake(this.cameras.main, 240, 0.012);
    this.recoil(this.playerSprite, -1, true);
    this.flashDamage(this.playerSprite.x, this.playerSprite.y, dmg, true);
    await this.say(`${this.enemy.name}'s ${move.name} hits for ${dmg}!${note}`);
    this.setPlayerTint(undefined);
    if (move.poison && GameState.player.hp > 0 && this.poisonTurns === 0) await this.afflict("poison");
    if (countered) await this.counter();
  }

  // the hero's ATK and DEF as this battle's meal (cooking.ts) and blessing
  // (shrine.ts) leave them
  private heroAtk(): number {
    return Math.round(
      GameState.effAtk() * (1 + (this.meal?.def.effect.atk ?? 0)) * (1 + (this.blessing?.def.effect.atk ?? 0)) * relicAtk(this.abyss),
    );
  }

  private heroDef(): number {
    return Math.round(
      GameState.effDef() * (1 + (this.meal?.def.effect.def ?? 0)) * (1 + (this.blessing?.def.effect.def ?? 0)) * relicDef(this.abyss),
    );
  }

  // WARD (while it lasts) or BULWARK (the next blow) halves a hit, never
  // below 1, else DEFEND takes its share; the three never stack, and BULWARK
  // is used up by the blow either way. Worst case "CRITICAL! CURSED GOBLIN
  // strikes for 999! (DEFEND)", 49 glyphs. `braced`: DEFEND or BULWARK took
  // it, which blockOn() shows (WARD has its bubble already). A `heavy` hit (a
  // wind-up's strike, a blast) DEFEND takes at its heavy share and answers:
  // `countered`, for the caller to strike back once its line is read.
  private guardHit(raw: number, heavy = false): { dmg: number; note: string; braced: boolean; countered: boolean } {
    const warded = this.wardTurns > 0;
    const guarded = !warded && this.guarded;
    this.guarded = false;
    const defended = !warded && !guarded && this.defending;
    const dmg = defended ? defendedDamage(raw, heavy) : guardedDamage(raw, warded || guarded);
    const note = warded ? " (WARD)" : guarded ? " (GUARD)" : defended ? " (DEFEND)" : "";
    return { dmg, note, braced: guarded || defended, countered: defended && heavy };
  }

  // COUNTER: the FIGHT a DEFEND strikes back with once a heavy hit is in
  // (battleRules DEFEND_HEAVY_MULT), no turn spent; PERFECT and all, and one
  // more in the combo DEFEND reset. Not from a hero the hit felled or froze.
  // Its label pops between the two at chest height, under the hit's number
  // and a PARRY! still rising over the hero's side and under the PERFECT! to
  // come (all three a row higher): over the hero's head it lay on the number.
  private async counter(): Promise<void> {
    if (!this.running || this.frozen || GameState.player.hp <= 0 || this.enemy.curHp <= 0) return;
    this.flashStatus("COUNTER!", "#fde047", this.playerSprite.x + 260, this.playerSprite.y - 20, 8);
    await this.playerAttack();
  }

  // the blow caught on a half-dome on the hero's foe side (fx.ts fx-block),
  // standing on the floor; over the hit's sparks, which show through its glass
  private blockOn(): void {
    playFx(this, "fx-block", this.playerSprite.x, GROUND_Y, this.anim(900, STATUS_POP_MIN_MS));
  }

  private async freezeHero(): Promise<void> {
    Sfx.freeze();
    this.frozen = true;
    this.updateStatus();
    this.setPlayerTint(FREEZE_TINT);
    // iced over, the hero stops breathing until thaw()
    this.heroIdle?.pause();
    this.statusOn(this.playerSprite, "freeze", STATUS_FX_MS, STATUS_POP_MIN_MS);
    this.flashStatus("FRZ", "#67e8f9");
    await this.say("FROZEN! You'll lose your next turn.");
  }

  // the wind-up turn: no attack, a warning, the CHG tag (see BOSS_TELLS)
  private async bossTell(tell: BossTell): Promise<void> {
    if (this.freezeGrace > 0) this.freezeGrace -= 1;
    this.charging = true;
    this.updateEnemyStatus();
    Sfx.charge();
    this.enemySprite.setTint(tell.color).setTintMode(Phaser.TintModes.FILL);
    this.pulseEnemy(1.08, 160);
    this.glowBurst.setPosition(this.enemySprite.x, this.enemySprite.y);
    this.glowBurst.explode(16);
    shake(this.cameras.main, 200, 0.004);
    await this.say(tell.warn, true);
    this.restoreEnemyTint();
  }

  // the strike: ATK x tell.mult before DEF, no crit, capped at
  // BOSS_STRIKE_MAX_HP_SHARE of max HP, then WARD/BULWARK as usual
  private async bossStrike(tell: BossTell): Promise<void> {
    // checked before this turn spends the grace, as rollSpecial() does
    const canFreeze = !!tell.freezes && !this.frozen && this.freezeGrace === 0;
    if (this.freezeGrace > 0) this.freezeGrace -= 1;
    this.charging = false;
    this.tellCooldown = BOSS_TELL_COOLDOWN;
    this.updateEnemyStatus();
    // a breath streams out of the mouth where a blow lunges in
    const breath = BREATHS[this.enemy.name];
    if (breath) {
      this.breathOn(breath);
      await this.wait(this.anim(BREATH_LAND_MS));
    }
    // a breath can't be parried, a blow can
    const parried = !breath && (await this.enemyLunge());
    if (!parried) Sfx.hit();
    Sfx.critical();
    const guard = this.guardHit(bossStrikeDamage(this.enemy.atk, tell.mult, this.heroDef(), GameState.effMaxHp()), true);
    const { note, braced } = guard;
    const dmg = parried ? parriedDamage(guard.dmg) : guard.dmg;
    GameState.player.hp = Math.max(0, GameState.player.hp - dmg);
    this.updatePlayerStats();
    this.setPlayerTint(0xff6666, true);
    this.fxOn(this.playerSprite, "fx-crit", HIT_FX_MS);
    if (braced) this.blockOn();
    this.hitBurst.setPosition(this.playerSprite.x, this.playerSprite.y);
    this.hitBurst.explode(24);
    shake(this.cameras.main, 320, 0.018);
    flash(this.cameras.main, 160, (tell.color >> 16) & 0xff, (tell.color >> 8) & 0xff, tell.color & 0xff);
    this.flashDamage(this.playerSprite.x, this.playerSprite.y, dmg, true);
    await this.say(`${tell.strike}! ${dmg} damage!${note}`);
    this.setPlayerTint(undefined);
    if (GameState.player.hp > 0 && canFreeze && !parried) {
      if (GameState.resists("freeze")) await this.say("EMBER RING blocks freezing!");
      else await this.freezeHero();
    }
    if (guard.countered) await this.counter();
  }

  // the breath's loop over the hero, fading in and out (the sheet is a loop, so
  // its first frame is a full stream); the tilt turns it about the mouth
  private breathOn(breath: { key: string; tilt: number }): void {
    const ms = this.anim(BREATH_FX_MS);
    const sprite = playFx(this, breath.key, this.enemySprite.x, this.enemySprite.y, ms, this.enemyBaseScale, true);
    sprite.setRotation(breath.tilt).setAlpha(0);
    this.tweens.add({ targets: sprite, alpha: 1, duration: ms * 0.2 });
    this.tweens.add({ targets: sprite, alpha: 0, delay: ms * 0.8, duration: ms * 0.2 });
  }

  // A special that couldn't land falls back to a plain attack: no stacking
  // or refreshing poison, no freeze while frozen or inside the grace window,
  // no regen at full HP.
  private rollSpecial(): EnemySpecial["kind"] | undefined {
    const special = this.enemy.special;
    if (!special || Math.random() >= special.chance) return undefined;
    if (special.kind === "poison" && this.poisonTurns > 0) return undefined;
    if (special.kind === "freeze" && (this.frozen || this.freezeGrace > 0)) return undefined;
    if (special.kind === "regen" && this.enemy.curHp >= this.enemy.hp) return undefined;
    return special.kind;
  }

  private async enrage(): Promise<void> {
    this.enraged = true;
    this.enemy.atk = Math.round(this.enemy.atk * ENRAGE_ATK_MULT);
    Sfx.enrage();
    this.restoreEnemyTint();
    this.updateEnemyStatus();
    shake(this.cameras.main, 400, 0.015);
    flash(this.cameras.main, 200, 255, 60, 60);
    this.pulseEnemy(1.15, 120);
    // one heartbeat of rage as it snaps, about the throb's 720ms, its body in
    // the ENRAGE_TINT just put on; the tint and the RAGE tag carry it on
    this.statusOn(this.enemySprite, "rage", 750, STATUS_POP_MIN_MS);
    await this.say(`${this.enemy.name} is ENRAGED! ATK UP!`, true);
  }

  // A wind-up or enrage throb on the foe, from the size it was made at rather
  // than whatever scale it has now: started over a throb still running (the
  // messages can be skipped faster than it lasts), the new one took that mid
  // value as its rest and yoyoed back to it, leaving the foe a size too big
  // for the rest of the fight.
  private pulseEnemy(by: number, ms: number): void {
    this.settleEnemyScale();
    this.enemyPulse = this.tweens.add({
      targets: this.enemySprite,
      scale: this.enemyBaseScale * by,
      duration: this.anim(ms),
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        this.enemyPulse = undefined;
      },
    });
  }

  // ends a throb at once, back at the foe's own size: before the next throb,
  // and before the defeat fade or the catch read the size to tween from
  private settleEnemyScale(): void {
    this.enemyPulse?.stop();
    this.enemyPulse = undefined;
    this.enemySprite.setScale(this.enemyBaseScale);
  }

  private async regenerate(): Promise<void> {
    const healed = regenAmount(this.enemy.hp, this.enemy.curHp);
    this.enemy.curHp += healed;
    Sfx.magic();
    // its moss whirling up round it (statusFx.ts regrow)
    this.statusOn(this.enemySprite, "regrow", REGROW_FX_MS, STATUS_POP_MIN_MS);
    this.flashHeal(this.enemySprite.x, this.enemySprite.y, healed);
    this.updateEnemyHp();
    await this.say(`${this.enemy.name} regrows its moss! +${healed} HP`);
  }

  // start of round: the tick can't take the last HP (see POISON_PCT)
  private async poisonTick(): Promise<void> {
    const dmg = poisonTickDamage(GameState.effMaxHp(), GameState.player.hp);
    this.poisonTurns -= 1;
    if (dmg > 0) {
      GameState.player.hp -= dmg;
      Sfx.poison();
      this.setPlayerTint(PSN_TINT);
      this.statusOn(this.playerSprite, "poison", STATUS_FX_MS, STATUS_POP_MIN_MS);
      this.flashDamage(this.playerSprite.x, this.playerSprite.y, dmg);
      this.updatePlayerStats();
    }
    // the last tick and its wearing off on one line (they were two, a key each)
    const over = this.poisonTurns === 0;
    if (over) this.updateStatus();
    if (dmg > 0) await this.say(`The poison deals ${dmg} damage!${over ? " It wears off." : ""}`);
    else if (over) await this.say("The poison wore off.");
    if (dmg > 0) this.setPlayerTint(this.frozen ? FREEZE_TINT : undefined);
  }

  private async thaw(): Promise<void> {
    this.frozen = false;
    this.thawing = true;
    this.freezeGrace = FREEZE_GRACE_TURNS;
    shake(this.cameras.main, 80, 0.004);
    // no line: the turn before said "FROZEN! You'll lose your next turn."
    // and this one's "Frozen solid! You lose this turn." was its echo, a key
    // more. The pop and a beat mark the turn lost.
    this.flashStatus("FROZEN", "#67e8f9");
    await this.wait(this.anim(THAW_MS));
    this.setPlayerTint(undefined);
    this.heroIdle?.resume();
    this.updateStatus();
  }

  // the hero sprite plus its weapon/shield overlays, so a frozen hero reads
  // as one iced-over figure and a struck one as one red flash (fill: the
  // colour replaces the art instead of shading it); undefined clears it
  private setPlayerTint(color: number | undefined, fill = false): void {
    for (const s of [this.playerSprite, this.weaponOverlay, this.shieldOverlay]) {
      s.clearTint();
      if (color !== undefined) s.setTint(color).setTintMode(fill ? Phaser.TintModes.FILL : Phaser.TintModes.MULTIPLY);
    }
  }

  // status label pops over the hero when it lands, on top of the HP-row tag
  // (a spell's side effect on the foe passes its own spot); like the damage
  // numbers it stops under the stat windows (POPUP_TOP, see popNumber)
  private flashStatus(label: string, color: string, x = this.playerSprite.x, y = this.playerSprite.y - 80, size = 10): void {
    const t = this.add.pixelText(x, y, label, retroStyle(size, color)).setOrigin(0.5).setStroke("#000000", 2);
    const endY = Math.max(t.y - 60, POPUP_TOP + t.height / 2);
    this.tweens.add({ targets: t, y: endY, alpha: 0, duration: this.anim(900, STATUS_POP_MIN_MS), onComplete: () => t.destroy() });
  }

  // lays the active player tags out right-to-left so a lone one sits flush
  // against the window edge instead of leaving a hole where the other was,
  // wrapping to the second row once one would cross PLAYER_STATUS_MIN_X
  private updateStatus(): void {
    this.layoutTags(
      [
        [this.frozenText, this.frozen],
        [this.poisonText, this.poisonTurns > 0],
        [this.wardText, this.wardTurns > 0],
      ],
      PLAYER_STATUS_RIGHT,
      PLAYER_STATUS_MIN_X,
    );
    this.wardRing.setVisible(this.wardTurns > 0);
  }

  private updateEnemyStatus(): void {
    if (this.enemyDot) this.dotText.setText(this.enemyDot.label).setColor(DOT_COLOR[this.enemyDot.label]);
    if (this.foeBuff) this.buffText.setText(this.foeBuff).setColor(this.foeBuff === "ATK+" ? "#fca5a5" : "#cbd5e1");
    this.layoutTags(
      [
        // first, so an incoming strike always holds the top row
        [this.chargeText, this.charging],
        [this.intentText, this.intent],
        [this.buffText, this.foeBuff !== null],
        [this.rageText, this.enraged],
        [this.dotText, this.enemyDot !== null],
        [this.chillText, this.chilled],
        [this.eliteText, this.elite !== null],
      ],
      ENEMY_STATUS_RIGHT,
      ENEMY_STATUS_MIN_X,
    );
  }

  private layoutTags(tags: Array<[PixelText, boolean]>, rightEdge: number, minX: number): void {
    // each in the first row with room for it (the last, if none has): a
    // short tag fills the hole a long one left on a row above
    const rights = STATUS_ROWS.map(() => rightEdge);
    for (const [t, on] of tags) {
      t.setVisible(on);
      if (!on) continue;
      const fits = rights.findIndex((right) => right - t.width >= minX);
      const row = fits < 0 ? STATUS_ROWS.length - 1 : fits;
      t.setPosition(rights[row], STATUS_ROWS[row]);
      rights[row] -= t.width + 20;
    }
  }

  // throttled afterimage spawner for a tween's onUpdate: faded copies trail
  // the sprite along its dash, selling the sped-up lunges as speed
  private ghostTrail(sprite: Phaser.GameObjects.Sprite, alpha = 0.35): () => void {
    let last = 0;
    return () => {
      if (this.time.now - last < this.anim(40)) return;
      last = this.time.now;
      const ghost = this.add
        .image(sprite.x, sprite.y, sprite.texture.key)
        .setScale(sprite.scaleX, sprite.scaleY)
        .setFlipX(sprite.flipX)
        .setAlpha(alpha)
        .setAngle(sprite.angle)
        .setTint(0x9fd4ff);
      this.tweens.add({ targets: ghost, alpha: 0, duration: this.anim(180), onComplete: () => ghost.destroy() });
    };
  }

  // The foe's blow, resolved as it connects (it walks home on its own): a
  // still beat, the draw-back that cues the PARRY, the lunge. True if the
  // first press since the beat began fell in the window before contact.
  private async enemyLunge(): Promise<boolean> {
    const foe = this.enemySprite;
    const startX = foe.x;
    const targetX = this.playerSprite.x + 80;
    const trail = this.ghostTrail(foe);
    this.timedLate = 0;
    if (!this.thawing) {
      bindKeyHint(this.hintText, () => keyHint("ANY KEY:PARRY", "TAP:PARRY", { table: "battle", pad: "Z:PARRY" }));
      this.timedPress = null;
    } else this.hintText.setText("");
    await this.wait(Phaser.Math.Between(...PARRY_HOLD_MS));
    await this.tweenPromise(foe, { x: startX + PARRY_BACK_PX }, PARRY_BACK_MS);
    await this.tweenPromise(foe, { x: targetX }, this.anim(LUNGE_OUT_MS), trail);
    const press = this.timedPress;
    this.timedPress = undefined;
    this.hintText.setText("");
    this.tweens.add({ targets: foe, x: startX, duration: this.anim(LUNGE_BACK_MS) });
    const now = performance.now();
    const parried = press != null && now - press <= PARRY_WINDOW_MS;
    if (press === null) {
      this.timedLate = now + PARRY_LATE_MS;
      this.timedStrike = false;
    }
    if (parried) {
      Sfx.emit("parry");
      this.glowBurst.setPosition(this.playerSprite.x + 40, this.playerSprite.y);
      this.glowBurst.explode(12);
      this.timedNote("PARRY!");
      this.syncLimit(LIMIT_PARRY);
    } else if (press != null) this.timedNote("EARLY");
    return parried;
  }

  // FIGHT's strike: strikeIn (draw back, dash, `onContact` as it connects),
  // a short freeze, then home
  private async lunge(crit = false, onContact?: () => void, hold = 0): Promise<void> {
    const startX = this.playerSprite.x;
    await this.strikeIn(onContact, hold);
    await this.wait(this.anim(crit ? CRIT_STOP_MS : HIT_STOP_MS));
    await this.poseRest(startX);
  }

  // The yard's infinite HP and MP: topped up every frame, so a blow's damage
  // shows for no more than a frame and nothing can run dry or kill the hero
  private refillHero(): void {
    const p = GameState.player;
    const [maxHp, maxMp] = [GameState.effMaxHp(), p.maxMp];
    if (p.hp >= maxHp && p.mp >= maxMp) return;
    p.hp = maxHp;
    p.mp = maxMp;
    this.updatePlayerStats();
  }

  // The weapon and the shield at the hero's hands (ui/HeroGear.ts's layout
  // facing the camera, at the battle's 2x) wherever the lunge or the
  // breathing has carried it; every frame, from update(), after the tweens
  // have moved the hero for this one.
  private syncGear(): void {
    const { weapon, shield } = GEAR_LAYOUT.down;
    this.weaponOverlay.setPosition(this.playerSprite.x + weapon.x * 2, this.playerSprite.y + weapon.y * 2);
    this.shieldOverlay.setPosition(this.playerSprite.x + shield.x * 2, this.playerSprite.y + shield.y * 2);
  }

  update(): void {
    if (this.practice) this.refillHero();
    this.syncGear();
    this.syncShadow(this.heroStance);
    this.syncShadow(this.enemyStance);
    if (this.companionStance) this.syncShadow(this.companionStance);
  }

  // Puts a fighter, already at its scale, on the ground at groundY (a flier
  // FLY_LIFT over it) with a shadow there, in place of the shadow it had (a
  // caught monster's new texture). The shadow spans the feet two cells wider
  // each side, or FLY_SHADOW_W of the body for a flier, 12 to 20px tall (3 to
  // 5 cells of 4px), stepped in 2px as the fighters and the backdrop are, and
  // lies under every fighter.
  private stand(sprite: Phaser.GameObjects.Sprite, groundY: number, flying = false, old?: Stance): Stance {
    old?.shadow.destroy();
    const scale = sprite.scaleX;
    // read off the art the battle copy (battleHd.ts) was made from: the copy
    // fills concave corners, which could widen the feet, and the shadow, a cell
    const art = battleSource(sprite.texture.key);
    const f = footingOf(this, art);
    const restY = this.restY(art, scale, groundY, flying);
    sprite.setY(restY);
    const w = flying ? f.bodyW * scale * FLY_SHADOW_W : f.footW * scale + PIXEL * 4;
    const half = Math.max(PIXEL * 2, Math.round(w / 2 / PIXEL) * PIXEL);
    const h = Phaser.Math.Clamp(Math.round((half * 2 * 0.16) / PIXEL) * PIXEL, PIXEL * 3, PIXEL * 5);
    const shadow = this.add.graphics({ x: sprite.x, y: groundY }).fillStyle(0x000000, 1);
    // its rows and their ends in the battlers' 2px cells (ART_PX); its width
    // and height stay whole 4px cells as above
    for (let top = -h / 2; top < h / 2; top += ART_PX) {
      const mid = (top + ART_PX / 2) / (h / 2);
      const hw = Math.round((half * Math.sqrt(1 - mid * mid)) / ART_PX) * ART_PX;
      shadow.fillRect(-hw, top, hw * 2, ART_PX);
    }
    this.children.moveBelow(shadow, this.enemySprite);
    const stance = {
      sprite,
      shadow,
      restY,
      scale,
      alpha: flying ? FLY_SHADOW_ALPHA : SHADOW_ALPHA,
      offX: flying ? f.bodyX : f.footX,
      fade: 1,
    };
    this.syncShadow(stance);
    return stance;
  }

  // where a fighter's centre rests for its feet (or a flier's lowest pixel,
  // FLY_LIFT up) to be at groundY
  private restY(key: string, scale: number, groundY: number, flying: boolean): number {
    return groundY - (flying ? FLY_LIFT : 0) - footingOf(this, key).feet * scale;
  }

  // A shadow keeps to the ground under its fighter: along with a lunge, a
  // dash, a shake or a run, not with a breath, a hop or a catch's arc, which
  // lift the fighter off it and so pale it. It fades and goes with its
  // fighter (the defeat pop, the catch) and grows back with a new companion.
  private syncShadow(s: Stance): void {
    const { sprite } = s;
    const lift = Math.max(0, s.restY - sprite.y);
    s.shadow
      .setX(sprite.x + (sprite.flipX ? -s.offX : s.offX) * sprite.scaleX)
      .setVisible(sprite.visible)
      .setAlpha(s.alpha * s.fade * sprite.alpha * Math.min(1, sprite.scaleX / s.scale) * Math.max(0, 1 - lift / SHADOW_FADE_LIFT));
  }

  // A slow rise and fall on y, each fighter at its own pace and offset so
  // none breathe in step; a flier hovers, higher and quicker. Only y: a hit
  // tell and a boss's heal tween scale, the death pop scale and alpha, a
  // lunge x, so none of them fights this. Every fighter rises off its rest
  // and back, its feet never under the ground line. Real time, not anim():
  // BATTLE SPEED hurries the fight, not a fighter's breathing (as the WARD
  // ring's pulse). The OS's reduced-motion setting (fx.ts) keeps the
  // fighters still.
  private idleBob(sprite: Phaser.GameObjects.Sprite, ms: number, delay: number, flying = false): Phaser.Tweens.Tween | undefined {
    if (reducedMotion()) return undefined;
    return this.tweens.add({
      targets: sprite,
      y: sprite.y - (flying ? FLY_BOB_PX : IDLE_BOB_PX),
      duration: flying ? FLY_BOB_MS : ms,
      delay,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  // A win: the hero hops twice, the companion a beat behind. On y, so each
  // one's breathing holds meanwhile and takes up again where it left off (as
  // for the companion's dash). Left out under reduced motion, as the
  // breathing is. 0.52s at 1x.
  private victoryHop(): void {
    if (reducedMotion()) return;
    const hop = (sprite: Phaser.GameObjects.Sprite, idle: Phaser.Tweens.Tween | undefined, height: number, delay: number) => {
      idle?.pause();
      this.tweens.add({
        targets: sprite,
        y: sprite.y - height,
        duration: this.anim(130),
        delay,
        ease: "Quad.easeOut",
        yoyo: true,
        repeat: 1,
        onComplete: () => idle?.resume(),
      });
    };
    hop(this.playerSprite, this.heroIdle, 24, 0);
    if (this.companionSprite) hop(this.companionSprite, this.companionIdle, 18, this.anim(90));
  }

  // A RUN that works: the hero darts off the left edge as it would lunge
  // (afterimages and all, the gear along with it), the companion a beat
  // behind, while "You escaped!" types. Still facing the camera, as in a
  // lunge. 0.32s at 1x.
  private runOff(): Promise<void> {
    this.heroIdle?.stop();
    this.companionIdle?.stop();
    if (this.companionSprite) {
      this.tweens.add({ targets: this.companionSprite, x: -120, delay: this.anim(60), duration: this.anim(320), ease: "Sine.easeIn" });
    }
    return this.tweenPromise(this.playerSprite, { x: -120, ease: "Sine.easeIn" }, this.anim(320), this.ghostTrail(this.playerSprite));
  }

  private async castProjectile(spell: Spell): Promise<void> {
    const [shot, burst] = SPELL_FX[spell.name] ?? SPELL_FX.NOVA;
    const x = this.playerSprite.x + (spell.ultimate ? ORB_START_X : SHOT_START_X);
    const y = this.playerSprite.y - 20;
    // the sheets fly rightwards, turned to aim at the foe; 8 frames of 30ms a
    // flight (fx.ts SHOT_SPAN)
    const fb = loopFx(this, shot, x, y, this.anim(30)).setRotation(Math.atan2(this.enemySprite.y - y, this.enemySprite.x - x));
    await this.tweenPromise(fb, { x: this.enemySprite.x, y: this.enemySprite.y }, this.anim(240));
    fb.destroy();
    this.fxOn(this.enemySprite, burst, 280).setDepth(SPELL_BURST_DEPTH);
    this.glowBurst.setPosition(this.enemySprite.x, this.enemySprite.y);
    this.glowBurst.explode(12);
    shake(this.cameras.main, 100, 0.008);
  }

  // NOVA: light gathers on the hero, one bright bolt, then three staggered
  // blasts across the target under a long shake and flash — castProjectile,
  // hitBurst and the camera effects reused, just stacked. Sfx.nova() is
  // timed so its low boom lands on the last blast.
  private async castNova(spell: Spell): Promise<void> {
    this.glowBurst.setPosition(this.playerSprite.x, this.playerSprite.y);
    this.glowBurst.explode(20);
    flash(this.cameras.main, 150, 255, 255, 255);
    await this.wait(this.anim(250));
    await this.castProjectile(spell);
    for (const [dx, dy] of [
      [-44, -32],
      [40, 28],
      [0, 0],
    ]) {
      const x = this.enemySprite.x + dx;
      const y = this.enemySprite.y + dy;
      // 2x, every battler's scale: at a boss's old 3x the outer blasts
      // reached the enemy window
      playFx(this, "fx-nova", x, y, this.anim(360)).setDepth(SPELL_BURST_DEPTH);
      this.hitBurst.setPosition(x, y);
      this.hitBurst.explode(14);
      await this.wait(this.anim(110));
    }
    shake(this.cameras.main, 380, 0.02);
    flash(this.cameras.main, 220, 245, 208, 254);
  }

  // The status sheets this fight can come to show, baked over the opening's
  // frames (statusFx warm) rather than on the turn each first lands, and only
  // those: a sheet nothing here can set off would be a texture and its time
  // for nothing. Each in the tint it will be shown in: an enraged boss's
  // ENRAGE_TINT, the purple a foe's poison tick fills it with (enemyDotTick),
  // the hero's poison untinted where it lands and multiplied purple on its
  // ticks (poisonTick).
  private warmStatuses(): void {
    const foe = this.enemySprite;
    const hero = this.playerSprite;
    const { name, special } = this.enemy;
    // a status the foe's move leaves (monsters.ts "afflict") or its special
    const status = this.enemy.move?.status ?? special?.kind;
    const big = this.enemy.boss || this.enemy.giant;
    const spells = this.knownSpells();
    const skills = this.knownSkills();
    // a spell's or skill's side effect, where spellEffectCanLand could ever let it
    const casts = (kind: SkillEffect): boolean =>
      spells.some((s) => s.effect?.kind === kind) || skills.some((s) => s.effect?.kind === kind);
    const pal = COMPANION_SKILLS[GameState.companion ?? ""];
    const warm = (target: Phaser.GameObjects.Sprite, kind: StatusKind, tint?: number, mode?: Phaser.TintModes): void =>
      this.statusFx.warm(target, kind, tint, mode);
    // How the foe dies, first: a first-turn blow can fell it, played some 0.7s
    // in after a quick FIGHT and Z, before any status can land. Behind a Lv30
    // hero's 34 move sheets (1.2s of the warm) a shatter was baked on the spot
    // there (25ms, headless); baked off the foe's "@hd" picture (statusFx
    // hdBody) a death is the dearest sheet of the battle (a shatter 80ms), and
    // behind the status sheets it was in at 0.77s.
    const death = this.deathOf();
    if (death) warm(foe, death);
    // a boss's move's sheet (bossSheets.ts): its first HP mark is some rounds off
    const moveFx =
      this.enemy.move && (this.enemy.move.kind === "flurry" ? this.enemy.move.at && CLUB_FX : MOVE_FX[this.enemy.move.name]?.key);
    if (moveFx) warmFx(this, [moveFx]);
    if (big) warm(foe, "rage", ENRAGE_TINT);
    // BOLT's shock and WEB SNARE skip bosses and giants
    if (!big && casts("shock")) warm(foe, "shock");
    if (!big && (casts("shock") || pal?.kind === "snare")) warm(foe, "stun");
    if ((casts("burn") && !BURN_PROOF.includes(name)) || pal?.dot === "BRN") warm(foe, "burn");
    if ((casts("chill") && !CHILL_PROOF.includes(name)) || pal?.kind === "chill") warm(foe, "chill");
    // VENOM STING's or THORNS' poison, landing (landSkillEffect) and ticking
    // in the same purple
    if (pal?.dot === "PSN" || casts("poison")) warm(foe, "poison", PSN_TINT, Phaser.TintModes.FILL);
    if (spells.some((s) => s.kind === "heal")) warm(hero, "heal");
    if (spells.some((s) => s.kind === "ward")) warm(hero, "ward");
    // a resist accessory stops the status outright; a MOON TEA only sometimes
    if (status === "poison" && !GameState.resists("poison")) {
      warm(hero, "poison");
      warm(hero, "poison", PSN_TINT);
    }
    if ((status === "freeze" || special?.kind === "freeze" || BOSS_TELLS[name]?.freezes) && !GameState.resists("freeze"))
      warm(hero, "freeze");
    if (special?.kind === "regen") warm(foe, "regrow");
    // The hero's fall (soulFx.ts), ahead of the move sheets when it is a blow
    // or two from it, behind them otherwise (below).
    const frail = GameState.player.hp <= GameState.effMaxHp() * SOUL_WARM_HP;
    if (frail) warmSoul(this, hero);
    // The hero's moves' sheets (skillFx.ts, techFx.ts), wanted from the first
    // turn: the last move used, then the companion's (fx.ts COMPANION_SHEETS:
    // its first skill comes after the hero's first turn at the soonest), then
    // the rest the strongest first, as a high-level hero reaches for the late
    // moves. In the order learned, VOID and BLACK HOLE came 1.1-1.2s in, and
    // one cast on the first turn baked its sheet on the spot (26-46ms).
    // lastSkill is the page's own, so a session's first battle, the one whose
    // warm bakes them all for the rest of it, goes by level alone.
    const sheetsOf = (s: Skill): string[] => (s.style === "blow" ? SKILL_SHEET_KEYS[s.name] : TECH_SHEET_KEYS[s.name]);
    const last = skills.find((s) => s.name === lastSkill);
    if (last) warmFx(this, sheetsOf(last));
    const skillFx = pal && SKILL_FX[pal.name];
    if (skillFx) warmFx(this, skillFx.back ? [skillFx.back, skillFx.key] : [skillFx.key]);
    if (pal?.kind === "pilfer") warmFx(this, ["fx-coin"]);
    const rest = new Set(
      skills
        .filter((s) => s !== last)
        .sort((a, b) => b.learnLevel - a.learnLevel)
        .flatMap(sheetsOf),
    );
    if (rest.size > 0) warmFx(this, [...rest]);
    if (!frail) warmSoul(this, hero);
  }

  // How the foe dies, if not in fx-poof: its own kind's way (a creature of
  // ice shatters, one of fire burns away, stone turns to a statue and bursts,
  // an ARENA bout's too), else unmade
  // into motes in the ABYSS
  private deathOf(): StatusKind | null {
    const { name } = this.enemy;
    if (SHATTER_KIN.includes(name)) return "shatter";
    if (BURNAWAY_KIN.includes(name)) return "dissolve";
    if (PETRIFY_KIN.includes(name)) return "petrify";
    return this.abyss ? "disintegrate" : null;
  }

  // The foe going down. A death of its own (deathOf, statusFx.ts) takes its
  // body over and hides the sprite when it breaks up, its shadow with it; in
  // its own colours, so an enraged boss's red goes out of it as it dies.
  // Else a poof on the ground under it (a flier's too), the sprite swelling
  // as it fades. Returns the ms till its body is gone (breakOf).
  private fell(): number {
    this.settleEnemyScale();
    const death = this.deathOf();
    if (death) {
      this.enemySprite.clearTint();
      this.statusOn(this.enemySprite, death, DEATH_FX_MS);
      return Math.round(this.anim(DEATH_FX_MS) * breakOf(death));
    }
    this.tweenPromise(this.enemySprite, { scale: this.enemyBaseScale * 1.15, alpha: 0 }, this.anim(350));
    playFx(this, "fx-poof", this.enemySprite.x, GROUND_Y, this.anim(1200), this.enemyBaseScale);
    return 0;
  }

  // a status or recovery effect on a battler for ms (at BATTLE SPEED), at the
  // battler's own scale (2x, a boss's or giant's too)
  private statusOn(sprite: Phaser.GameObjects.Sprite, kind: StatusKind, ms: number, min = 0): void {
    this.statusFx.play(sprite, kind, this.anim(ms, min));
  }

  // Stars round the foe's head from the moment `stuck` is set (BOLT's shock,
  // WEB SNARE) until the turn it costs has been said, or the foe falls first
  private showStun(): void {
    this.stunStars ??= this.statusFx.loop(this.enemySprite, "stun");
  }

  private hideStun(): void {
    this.stunStars?.();
    this.stunStars = undefined;
  }

  // HP or MP back from the bag (or the SLIME's GOO HEAL): a ring rolls out
  // round the hero's feet, in its colour (fx.ts fx-restore-*), as the bag
  // shows it in the field; in place of the green glow burst, which MP had none of
  private ringOn(key: string): void {
    playFx(this, key, this.playerSprite.x, GROUND_Y, this.anim(RESTORE_FX_MS));
  }

  // a sheet played over a battler for ms (at BATTLE SPEED), at the foe's
  // scale as the sprite itself is (2x, a boss's or giant's too); on the hero
  // it turns to face left, the way the foe's blows go
  private fxOn(sprite: Phaser.GameObjects.Sprite, key: string, ms: number, min = 0): Phaser.GameObjects.Sprite {
    return playFx(this, key, sprite.x, sprite.y, this.anim(ms, min), this.enemyBaseScale, sprite === this.playerSprite);
  }

  // an animation's duration at the player's BATTLE SPEED, never below min
  private anim(ms: number, min = 0): number {
    return Math.max(min, Math.round(ms / GameState.battleSpeed));
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  private flashDamage(x: number, y: number, amount: number, crit = false): void {
    this.popNumber(x, y, crit ? `${amount}!` : String(amount), crit ? 14 : 10, crit ? "#ff5555" : "#ffdd44", crit ? 200 : 160);
  }

  private flashHeal(x: number, y: number, amount: number): void {
    this.popNumber(x, y, `+${amount}`, 10, "#4ade80", 160);
  }

  // A damage or heal number that pops out of the fighter at (x, y) and rises
  // toward y - rise, but stops with its top edge at POPUP_TOP, under the stat
  // windows (y 24..200) that sit over both fighters' columns: from y - 80
  // they ran up over the COMBO line and HP bar, and a boss's or a crit on the
  // hero over the MP line. A flier's head can be up at y 256 (stand()), so
  // its numbers may start on its body and rise POPUP_MIN_RISE; a foe on the
  // ground's start over its head, as the hero's do. Outlined as text on the
  // art is (AGENTS.md), since it can cross the fighter.
  private popNumber(x: number, y: number, text: string, size: number, color: string, rise: number): void {
    const t = this.add
      .pixelText(x + 40, 0, text, retroStyle(size, color))
      .setOrigin(0.5)
      .setStroke("#1a1028", 4)
      // over an effect sheet, even one started after it
      .setDepth(1);
    const endY = Math.max(y - rise, POPUP_TOP + t.height / 2);
    t.setY(Math.max(y - 80, endY + POPUP_MIN_RISE));
    this.tweens.add({
      targets: t,
      y: endY,
      alpha: 0,
      duration: this.anim(800, POPUP_MIN_MS),
      onComplete: () => t.destroy(),
    });
  }

  private updateEnemyHp(): void {
    this.enemyHpText.setText(`HP ${this.enemy.curHp}/${this.enemy.hp}`);
    this.enemyHpBar.setScale(barShare(this.enemy.curHp, this.enemy.hp, STAT_BAR_W), 1);
    this.syncLimit();
  }

  // hit flashes clearTint the enemy sprite, which would also strip a boss's
  // enrage glow; re-apply it afterwards
  private restoreEnemyTint(): void {
    this.enemySprite.clearTint();
    if (this.enraged) this.enemySprite.setTint(ENRAGE_TINT);
  }

  private comboBonus(): number {
    return comboBonus(this.combo) * (1 + GameState.perk("flow"));
  }

  private updateCombo(): void {
    const bonus = this.comboBonus();
    if (this.combo < 2) {
      this.comboText.setText("");
      return;
    }
    this.comboText.setText(`COMBO x${this.combo}  +${Math.round(bonus * 100)}%`);
    this.comboText.setColor(this.combo >= COMBO_CAP ? "#ff5555" : "#fbbf24");
  }

  // one more hit in the combo: a FIGHT, or a weakness spell's CHAIN
  private addCombo(): void {
    this.combo += 1;
    if (this.combo >= COMBO_CAP) GameState.quest.comboCapped = true;
    this.updateCombo();
  }

  private resetCombo(): void {
    this.combo = 0;
    this.updateCombo();
  }

  private updatePlayerStats(): void {
    this.playerHpText.setText(`HP ${GameState.player.hp}/${GameState.effMaxHp()}`);
    this.playerMpText.setText(`MP ${GameState.player.mp}/${GameState.player.maxMp}`);
    this.playerHpBar.setScale(barShare(GameState.player.hp, GameState.effMaxHp(), STAT_BAR_W), 1);
    this.playerMpBar.setScale(barShare(GameState.player.mp, GameState.player.maxMp, STAT_BAR_W), 1);
    this.syncLimit();
  }

  // the bar of the figures at (x, y): its dark track, and the fill returned
  // (still to be scaled: update*Stats / updateEnemyHp)
  private statBar(x: number, y: number, color: number): Phaser.GameObjects.Rectangle {
    const top = y + 26;
    this.add.rectangle(x, top, STAT_BAR_W, STAT_BAR_H, BAR_TRACK).setOrigin(0, 0).setDepth(STAT_DEPTH);
    return this.add.rectangle(x, top, STAT_BAR_W, STAT_BAR_H, color).setOrigin(0, 0).setDepth(STAT_DEPTH);
  }

  // The LIMIT gauge (limit.ts) in the hero's window, on a row of its own
  // between the name (to y 68) and the HP row (from 88), y 70..86 at
  // retroStyle(4): "LIMIT" (x 64..144), its bar (156..276, y 74..82) and how
  // full it is ("100%" to x 352). The label leads the bar and three notches
  // cut it into quarters, so it reads as a charge of its own: as a bare bar
  // with its label after it, it sat over "HP" as HP's bar would. Full, the
  // row turns gold, the figure becomes the key and what it does ("L:BREAK!",
  // touch "TAP:BREAK!" to x 448, where the row is the button, LIMIT_TAP) and
  // bar and figure blink. Inside the window's 476; the status tags start a
  // row lower (y 90).
  private addLimitGauge(): void {
    this.limit = this.practice ? LIMIT_MAX : GameState.limit;
    this.limitKill = false;
    this.limitSeen = { foe: this.enemy.curHp, hero: GameState.player.hp };
    this.limitLabel = this.add.pixelText(64, 70, "LIMIT", retroStyle(4, "#f9a8d4")).setDepth(STAT_DEPTH);
    this.add.rectangle(LIMIT_BAR_X, 74, LIMIT_BAR_W, STAT_BAR_H, BAR_TRACK).setOrigin(0, 0).setDepth(STAT_DEPTH);
    this.limitBar = this.add.rectangle(LIMIT_BAR_X, 74, LIMIT_BAR_W, STAT_BAR_H, LIMIT_COLOR).setOrigin(0, 0).setDepth(STAT_DEPTH);
    for (const q of [1, 2, 3]) {
      this.add
        .rectangle(LIMIT_BAR_X + (q * LIMIT_BAR_W) / 4 - ART_PX / 2, 74, ART_PX, STAT_BAR_H, 0x0b0b2b)
        .setOrigin(0, 0)
        .setDepth(STAT_DEPTH);
    }
    this.limitText = this.add.pixelText(LIMIT_NOTE_X, 70, "", retroStyle(4, DIM_TEXT)).setDepth(STAT_DEPTH);
    this.tweens.add({ targets: [this.limitBar, this.limitText], alpha: 0.45, duration: 420, yoyo: true, repeat: -1, paused: true });
    this.drawLimit();
  }

  private drawLimit(): void {
    const full = limitFull(this.limit);
    this.limitBar.setScale(barShare(this.limit, LIMIT_MAX, LIMIT_BAR_W), 1).setFillStyle(full ? LIMIT_FULL_COLOR : LIMIT_COLOR);
    this.limitLabel.setColor(full ? "#fde047" : "#f9a8d4");
    this.limitText
      .setText(
        full
          ? keyHint("L:BREAK!", "TAP:BREAK!", { table: "battle" }) || "BREAK!"
          : `${Math.min(99, Math.floor((this.limit / LIMIT_MAX) * 100))}%`,
      )
      .setColor(full ? "#fde047" : DIM_TEXT);
    const blink = this.tweens.getTweensOf(this.limitBar)[0];
    if (full) blink?.resume();
    else {
      blink?.pause();
      this.limitBar.setAlpha(1);
      this.limitText.setAlpha(1);
    }
  }

  // Brings the gauge up to what both HP figures have lost since it last
  // looked (limit.ts: dealing fills it, being hit fills it faster), plus
  // `bonus` (a PARRY's). Called wherever either figure is redrawn, so every
  // blow, tick and strike is counted without a line in each. The yard's
  // stays full and leaves the saved one alone.
  private syncLimit(bonus = 0): void {
    const dealt = Math.max(0, this.limitSeen.foe - this.enemy.curHp);
    const taken = Math.max(0, this.limitSeen.hero - GameState.player.hp);
    this.limitSeen = { foe: this.enemy.curHp, hero: GameState.player.hp };
    // a PARRY is the one thing that brings a bonus: counted for its trophies
    if (bonus > 0 && !this.practice) GameState.feats.parries += 1;
    const was = limitFull(this.limit);
    const gain = (limitDealt(dealt, this.enemy.hp) + limitTaken(taken, GameState.effMaxHp()) + bonus) * (1 + GameState.perk("surge"));
    this.limit = this.practice ? LIMIT_MAX : chargeLimit(this.limit, gain);
    if (!this.practice) GameState.limit = this.limit;
    if (!was && limitFull(this.limit)) Sfx.emit("limit");
    this.drawLimit();
  }

  // LIMIT (L, or a tap on the full gauge): FIGHT's lunge with a crit's stop
  // and sparks for one blow of ATK x2.5 (limit.ts limitDamage). The gauge is
  // emptied as the blow lands, its own damage not counted back into it.
  private async limitBreak(): Promise<void> {
    const total = Math.round(limitDamage(this.heroAtk(), this.enemy.def) * (1 + GameState.perk("break")));
    Sfx.attack();
    this.glowBurst.setPosition(this.playerSprite.x, this.playerSprite.y);
    this.glowBurst.explode(16);
    await this.lunge(true, () => {
      Sfx.strike();
      Sfx.critical();
      this.enemy.curHp = Math.max(0, this.enemy.curHp - total);
      this.limitSeen.foe = this.enemy.curHp;
      this.limitKill = this.enemy.curHp <= 0;
      if (this.limitKill && !this.practice) GameState.feats.limitKills += 1;
      this.limit = 0;
      this.updateEnemyHp();
      this.enemySprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      this.fxOn(this.enemySprite, "fx-slash", HIT_FX_MS);
      this.fxOn(this.enemySprite, "fx-crit", HIT_FX_MS);
      this.hitBurst.setPosition(this.enemySprite.x, this.enemySprite.y);
      this.hitBurst.explode(24);
      shake(this.cameras.main, 200, 0.016);
      this.flashDamage(this.enemySprite.x, this.enemySprite.y, total, true);
      this.recoil(this.enemySprite, 1, true);
    });
    await this.say(`LIMIT BREAK! You strike for ${total}!`);
    this.restoreEnemyTint();
  }

  private async victory(caught = false): Promise<void> {
    this.running = false;
    this.enemyIdle?.stop();
    // felled the round it was stunned (the companion's blow after BOLT's)
    this.hideStun();
    this.victoryHop();
    // before anything below: no quest flag, counter, loot, EXP or ending
    if (this.arena) return this.arenaVictory(this.arena);
    if (this.practice) return this.practiceVictory(this.practice);
    // SNATCH's gold comes back with the foe, felled or caught
    if (this.snatched > 0) {
      const back = GameState.gainGold(this.snatched);
      this.snatched = 0;
      // back where the "-9G" went (enemyMove), with no line of its own: the
      // payout's page is next and a key here was one more in every such fight
      // "BACK": a bare "+23G" read as the payout's own "+23G" on the line
      // under it. "+9999G BACK" is 11 x 24 = 264px at size 6, x 18..282.
      if (back > 0) this.flashStatus(`+${back}G BACK`, "#fbbf24", this.playerSprite.x - 170, this.playerSprite.y - 80, 6);
    }
    // the TROLL KING's flag (arena.ts: what puts it in the ARENA lineup) for
    // beating it or catching it, which takes beating it down first; never
    // from the ABYSS, where nothing sets a flag
    if (!this.abyss && this.enemy.name === ENEMIES.troll.name) GameState.quest.trollDefeated = true;
    // read before the boss branch below sets the flags: only the first MOSS
    // GOLEM / FLAME DRAKE kill (of each HARD MODE cycle, which clears them)
    // rolls the ending / epilogue, a rematch just ends the battle — and the
    // ABYSS is all rematch, even in a HARD MODE cycle that hasn't yet beaten
    // the boss it meets down there as a GUARDIAN (abyss.ts)
    const firstMoss = !caught && !this.abyss && this.enemy.name === ENEMIES.mossGolem.name && !GameState.quest.forestBoss;
    const firstDrake = !caught && !this.abyss && this.enemy.name === ENEMIES.flameDrake.name && !GameState.quest.volcanoBoss;
    if (!caught) {
      // the streak, the gold, the tallies, the rest, the loot and the EXP
      // (payout.ts settleWin, which an overrun shares)
      const {
        gold: goldGained,
        streakBonus,
        exp,
        found,
        mealHeal,
      } = settleWin({
        enemy: this.enemy,
        rematch: this.rematch,
        abyss: this.abyss,
        elite: this.elite,
        meal: this.meal?.def ?? null,
        blessing: this.blessing?.def ?? null,
        weakFinish: this.weakFinish,
        limitKill: this.limitKill,
      });
      this.updatePlayerStats();
      Sfx.victory();
      // its gold drops on the ground under it (fx.ts) as it goes: out of a
      // death of its own, the coins' flash and puff over a body still whole
      // hid it
      this.time.delayedCall(this.fell(), () =>
        playFx(this, "fx-coins", this.enemySprite.x, GROUND_Y, this.anim(2800), this.enemyBaseScale),
      );
      if (streakBonus > 0) {
        this.coinBurst.setPosition(this.playerSprite.x, this.playerSprite.y);
        this.coinBurst.explode(10);
      }
      // the streak's and the find's chime after the fanfare, not over it
      if (streakBonus > 0 || found.length > 0) this.time.delayedCall(360, () => Sfx.pickup());
      // The whole payout on one page, where it took five, a Z each (the foe,
      // the gold, the streak, the find, the EXP, then "Battle won!"). Every
      // figure has four digits at most: the biggest purse is an HARD 3 night
      // FLAME DRAKE's first kill on an 8+ streak with PUMPKIN PIE, 3639G
      // (STREAK +1470), EXP +1890. The longest name with them all at four,
      // "GLACIER GOLEM falls! +2599G (STREAK +1050)  EXP +1260", is 53 of a
      // row's 54 glyphs ("is defeated!" made it 59). The second row at most,
      // "Found a HI-POTION & 9 FROST SCALE!  FISH STEW +150 HP", is 53 (an
      // ABYSS GUARDIAN's x3; the KOI FEAST's 18 takes the meal's place).
      const streak = streakBonus > 0 ? ` (STREAK +${streakBonus})` : "";
      const finds = [
        found.length > 0 && `Found ${found.join(" & ")}!`,
        mealHeal > 0 && this.meal && `${this.meal.def.name} +${mealHeal} HP`,
      ];
      const second = finds.filter(Boolean).join("  ");
      await this.say(`${this.enemy.name} falls! +${goldGained}G${streak}  EXP +${exp}${second ? `\n${second}` : ""}`, true);
      const leveled = settleLevels();
      // a level up keeps a line of its own, the burst and the fanfare with it
      if (leveled) {
        Sfx.levelup();
        this.fxOn(this.playerSprite, "fx-levelup", 1100);
        this.coinBurst.setPosition(this.playerSprite.x, this.playerSprite.y);
        this.coinBurst.explode(12);
        shake(this.cameras.main, 200, 0.01);
        // the stat window takes the new HP/MP with the burst and the line, not
        // only once the hero is back in the field
        this.updatePlayerStats();
        // a perk tier opened (perks.ts): on the level's own row, "LEVEL UP! LV
        // 30  RANK #10!  PERK: see the ELDER!" 48 glyphs of a row's 54 (it had
        // a line and a key of its own)
        const perk = perkOpened(leveled.from, leveled.level) ? "  PERK: see the ELDER!" : "";
        const rank = leveled.rank > 0 ? `  RANK #${leveled.rank}!` : "";
        await this.say(`LEVEL UP! LV ${leveled.level}${rank}${perk}${this.learnedLine(leveled.from)}`, true);
      }
      // now and then a TREASURE MAP (treasure.ts), never in the ABYSS, whose
      // pay model has no room for it; its own line, news the payout's page
      // would bury, and where to read it on a second (the bag's last page,
      // which nothing else points a new player at; touch has an I button
      // too). 29 glyphs, inside the 54 a row holds
      if (!this.abyss && rollTreasureMap(GameState.treasureMaps, GameState.quest)) {
        Sfx.pickup();
        this.fxOn(this.playerSprite, "fx-levelup", 1100);
        await this.say("You found a TREASURE MAP!\nRead it in ITEMS (I), page 3.", true);
      }
      if (this.enemy.boss) await this.say(`The ${this.enemy.name} is no more!`, true);
    }
    GameState.save();
    // the forest boss closes the story's first part: the ending's TO BE
    // CONTINUED, then back to the town (EndingScene)
    if (firstMoss) {
      this.cameras.main.fadeOut(1500, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start("Ending");
      });
      return;
    }
    // the volcano's boss is the story's real close: same fade, the epilogue
    // (THE TRUE END, then the title)
    if (firstDrake) {
      this.cameras.main.fadeOut(1500, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start("Ending", { epilogue: true } satisfies EndingData);
      });
      return;
    }
    this.end();
  }

  // The level up's second row, what it taught: nothing announced a spell, and
  // the SKILL button turning up at Lv2 would go unexplained. The longest of
  // one level, "New spell: NOVA  New skill: FROST NOVA" (Lv24), is 37 glyphs;
  // a jump over many gates at once, past a row's 54, only says there are some.
  private learnedLine(from: number): string {
    const level = GameState.player.level;
    const learned = (list: ReadonlyArray<{ name: string; learnLevel: number }>): string[] =>
      list.filter((s) => s.learnLevel > from && s.learnLevel <= level).map((s) => s.name);
    const spells = learned(SPELLS);
    const skills = learned(SKILLS);
    const line = [spells.length > 0 && `New spell: ${spells.join(", ")}`, skills.length > 0 && `New skill: ${skills.join(", ")}`]
      .filter(Boolean)
      .join("  ");
    if (!line) return "";
    return `\n${line.length <= 54 ? line : "New spells and skills!"}`;
  }

  // Losing used to wipe the save outright, so a death at level 30 meant
  // starting the whole game again. You now wake up in town, down half your
  // gold and your win streak, with everything else intact.
  private async defeat(): Promise<void> {
    this.running = false;
    this.heroIdle?.stop();
    if (this.arena) return this.arenaDefeat(this.arena);
    if (this.practice) return this.exitPractice(this.practice);
    Sfx.gameover();
    this.soulRise();
    await this.say("You have fallen...");
    const lost = Math.floor(GameState.gold * DEATH_GOLD_LOSS);
    GameState.gold -= lost;
    GameState.streak = 0;
    GameState.player.hp = Math.max(1, Math.floor(GameState.effMaxHp() / 2));
    GameState.player.mp = Math.max(0, Math.floor(GameState.player.maxMp / 2));
    // undefined sends TownScene back to PLAYER_SPAWN, the town centre
    GameState.pos = undefined;
    // a fall down in the ABYSS takes its portal with it (abyss.ts), saved
    // here with the rest so a reload can't bring it back
    const portalLost = !!this.abyss && GameState.abyssPortal > 0;
    if (this.abyss) GameState.abyssPortal = 0;
    GameState.save();
    await this.say("A villager drags you home.");
    await this.say(lost > 0 ? `You lost ${lost} gold.` : "You had no gold to lose.");
    // 27 glyphs, inside a row's 36
    if (portalLost) await this.say("The ABYSS portal has faded.");
    this.cameras.main.fadeOut(this.anim(800), 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      // {}: with no data Phaser would replay the Town's last { fromDungeon }
      // and the like, waking the hero at that exit instead of the centre
      this.scene.start("Town", {});
    });
  }

  // The hero's soul leaving its body (soulFx.ts), played as the fall's first
  // line comes up and not waited for, so the way home is no later for it.
  // The hit's flash goes out of the body it dims.
  private soulRise(): void {
    this.playerSprite.clearTint();
    playSoul(this, this.playerSprite, this.anim(2200));
  }

  // An ARENA bout won: bank this boss's share of the prize and, unless it was
  // the last, patch the hero up a little and restart straight into the next
  // boss — no trip back through the Town between bouts, one fade instead of two.
  // Messages stay within one line: "Next: GLACIER GOLEM! +999 HP +999 MP" (36).
  private async arenaVictory(run: ArenaRun): Promise<void> {
    Sfx.victory();
    this.fell();
    await this.say(`${this.enemy.name} is defeated!`);
    // This bout's share is paid, the record moved up and the game saved right
    // here, so a run cut off from now on (the tab closed, a reload) keeps
    // them; only a clear's bonus is left for endArena. enemy.gold carries NEW
    // GAME+ loot scaling but no night bonus (see init).
    const purse = run.purse + GameState.gainGold(Math.round(this.enemy.gold * ARENA_GOLD_SHARE));
    const won = run.round + 1;
    const record = !!run.record || won > GameState.arenaBest;
    GameState.arenaBest = Math.max(GameState.arenaBest, won);
    GameState.save();
    if (won >= run.lineup.length) return this.endArena({ ...run, record }, won, purse, true);
    const maxHp = GameState.effMaxHp();
    const hp = Math.min(maxHp - GameState.player.hp, Math.ceil(maxHp * ARENA_RECOVER_PCT));
    const mp = Math.min(GameState.player.maxMp - GameState.player.mp, Math.ceil(GameState.player.maxMp * ARENA_RECOVER_PCT));
    GameState.player.hp += hp;
    GameState.player.mp += mp;
    this.updatePlayerStats();
    if (hp > 0) this.flashHeal(this.playerSprite.x, this.playerSprite.y, hp);
    await this.say(`Next: ${ENEMIES[run.lineup[won]].name}! +${hp} HP +${mp} MP`);
    this.cameras.main.fadeOut(this.anim(400), 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.restart({ enemy: run.lineup[won], from: "Town", arena: { ...run, round: won, purse, record } });
    });
  }

  // Falling in the ARENA ends the run in place of the usual defeat: no gold
  // lost, no streak reset, carried back out at 1 HP to where the hero stood
  // by the keeper (GameState.pos, kept from when the Town handed over).
  // The player leaving mid-run: what the bouts won so far paid stays (it was
  // paid bout by bout), the clear's bonus is lost, and the hero walks out as
  // is, no 1 HP as after a fall.
  private async quitArena(run: ArenaRun): Promise<void> {
    this.resetCombo();
    await this.say("You leave the ARENA.");
    return this.endArena(run, run.round, run.purse, false);
  }

  private async arenaDefeat(run: ArenaRun): Promise<void> {
    Sfx.gameover();
    this.soulRise();
    await this.say("You fall in the ARENA...");
    GameState.player.hp = 1;
    this.updatePlayerStats();
    return this.endArena(run, run.round, run.purse, false);
  }

  // `purse` was paid bout by bout (arenaVictory); a clear adds its bonus here,
  // and the closing line reports the run's whole take
  private async endArena(run: ArenaRun, won: number, purse: number, cleared: boolean): Promise<void> {
    const prize = purse + (cleared ? GameState.gainGold(Math.round(purse * ARENA_CLEAR_BONUS)) : 0);
    const record = !!run.record;
    GameState.save();
    if (cleared) Sfx.levelup();
    const total = run.lineup.length;
    await this.say(cleared ? `ARENA CLEARED! ${won}/${total} bouts won!` : `ARENA OVER: ${won}/${total} bouts won.`);
    await this.say(record ? `Prize: +${prize}G  NEW RECORD!` : `Prize: +${prize}G  (best ${GameState.arenaBest})`);
    this.end();
  }

  // A yard foe down: nothing is won, and another comes in behind a short
  // fade, for as long as the player stays
  private async practiceVictory(run: PracticeRun): Promise<void> {
    Sfx.victory();
    this.fell();
    await this.say(`${this.enemy.name} is down! Next foe...`);
    this.practiceFoe(run, randomStep());
  }

  // the yard's next bout, `step` foes along the roster
  private practiceFoe(run: PracticeRun, step: number): void {
    this.running = false;
    this.cameras.main.fadeOut(this.anim(300), 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const foe = run.foe + step;
      this.scene.restart({ enemy: practiceEnemy(foe), from: this.origin, practice: { ...run, foe, round: run.round + 1 } });
    });
  }

  // the player's EXIT: what the yard lent is put back, and nothing is saved
  // of it
  private exitPractice(run: PracticeRun): void {
    endPracticeRun(run);
    // the yard is over, so update() stops topping the hero up past what was put back
    this.practice = null;
    this.end();
  }

  private end(): void {
    this.running = false;
    this.cameras.main.fadeOut(this.anim(400), 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      // init() already narrowed origin to a scene key, so it is the target
      this.scene.start(this.origin, {
        fromBattle: true,
      });
    });
  }

  // A line typed out, then a key or tap to go on (awaitAdvance). One while it
  // still types shows the rest of it at once and is not the one that goes on:
  // a late PARRY or PERFECT press lands here, and must not skip the line of
  // the blow it missed. But the line then stays as long as its typing would
  // have taken (LINE_MIN_MS at least) before a press can move on: with the
  // wait starting a frame after the rush, two presses were a line gone, and
  // mashed at 130ms a payout was up for 0.22s where its typing had held it
  // 0.5s. A rushed line of `news` holds NEWS_HOLD_MS more: the payout, a
  // level, a map, a boss's warning, a tip. A line left to type itself out
  // moves on at the first press after, as it always did, so who reads loses
  // no time to this. While it types or holds the hint line is blank, since
  // no press goes on yet.
  private say(text: string, news = false): Promise<void> {
    return new Promise((resolve) => {
      const typed = text.length * this.anim(TYPE_MS, TYPE_MIN_MS);
      const ready = this.time.now + Math.max(LINE_MIN_MS, typed) + (news ? this.anim(NEWS_HOLD_MS, NEWS_HOLD_MS / 2) : 0);
      const shown = (rushed = false): void => {
        stop();
        const wait = rushed ? ready - this.time.now : 0;
        if (wait > 1) this.time.delayedCall(wait, () => this.awaitAdvance(resolve));
        else this.awaitAdvance(resolve);
      };
      const rush = (): void => {
        if (!this.typing) return;
        this.typing.remove();
        this.typing = undefined;
        this.msgText.reveal(text.length);
        shown(true);
      };
      const onKey = (e: KeyboardEvent): void => {
        if (!(e.metaKey || e.ctrlKey || e.altKey || e.shiftKey)) rush();
      };
      const stop = (): void => {
        this.input.keyboard?.off("keydown", onKey);
        this.input.off("pointerdown", rush);
      };
      this.input.keyboard?.on("keydown", onKey);
      this.input.on("pointerdown", rush);
      this.hintText.setText("");
      this.type(text, () => shown());
    });
  }

  // types `text` into the message box, then `done`; a line still typing
  // (only ever the opening one, which nothing waits on) is cut off
  private type(text: string, done?: () => void): void {
    this.typing?.remove();
    this.msgText.setText(text);
    let i = 0;
    const ev = this.time.addEvent({
      delay: this.anim(TYPE_MS, TYPE_MIN_MS),
      repeat: text.length,
      callback: () => {
        // a removed event can still fire once more when several glyphs are due
        // in one frame (BATTLE SPEED 2): `done` twice put ANY KEY:CONTINUE
        // back over the PARRY hint, or over the menu
        if (this.typing !== ev) return;
        i++;
        this.msgText.reveal(i);
        if (i >= text.length) {
          ev.remove();
          this.typing = undefined;
          done?.();
        }
      },
    });
    this.typing = ev;
  }

  // any key advances messages, so mashing your next action never stalls on a
  // textbox; one pressed with CMD/CTRL/ALT/SHIFT is a browser shortcut (CMD+TAB)
  // and would skip a line unread
  private awaitAdvance(resolve: () => void): void {
    // a tap advances too (below), and a touch screen has no keys
    bindKeyHint(this.hintText, () => keyHint("ANY KEY:CONTINUE", "TAP:CONTINUE", { table: "battle", pad: "Z:CONTINUE" }));
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey || e.altKey || e.shiftKey)) done();
    };
    const done = () => {
      this.input.keyboard?.off("keydown", onKey);
      this.input.off("pointerdown", done);
      resolve();
    };
    this.input.keyboard?.on("keydown", onKey);
    this.input.once("pointerdown", done);
  }

  private tweenPromise(target: Phaser.GameObjects.GameObject, props: object, duration: number, onUpdate?: () => void): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({
        targets: target,
        ...props,
        duration,
        onUpdate,
        onComplete: () => resolve(),
      });
    });
  }
}
