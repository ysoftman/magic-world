import Phaser from "phaser";
import { type AbyssBout, abyssDropMult } from "../abyss";
import { ARENA_BOSSES, ARENA_CLEAR_BONUS, ARENA_GOLD_SHARE, ARENA_RECOVER_PCT, type ArenaRun } from "../arena";
import { BATTLE_THEME, BOSS_THEME, FOREST_BATTLE_THEME, Sfx, SNOW_BATTLE_THEME, VOLCANO_BATTLE_THEME } from "../audio";
import { battleSource, battleTexture } from "../battleHd";
import {
  BOSS_LOOT,
  BOSS_TELL_CHANCE,
  BOSS_TELL_COOLDOWN,
  BOSS_TELLS,
  type BossTell,
  BURN_PROOF,
  bossStrikeDamage,
  CHILL_PROOF,
  COMBO_CAP,
  captureChance,
  comboBonus,
  companionAtk,
  DEATH_GOLD_LOSS,
  defendedDamage,
  ENRAGE_ATK_MULT,
  ENRAGE_HP_SHARE,
  FIELD_LOOT,
  FREEZE_GRACE_TURNS,
  guardedDamage,
  POISON_TURNS,
  poisonTickDamage,
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
  STREAK_CAP,
  STREAK_MIN,
  scaleEnemy,
  skillCost,
  skillHit,
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
import { GAME_HEIGHT, GAME_WIDTH, MAX_HP, MAX_LEVEL, MAX_MP, PIXEL } from "../config";
import { type MealDef, takeMealCharge } from "../cooking";
import { MATERIALS, rollDrop } from "../drops";
import { bakeBattleFx, flash, loopFx, playFx, shake, warmFx } from "../fx";
import { expToNext, GameState, isNight, onSaved } from "../gameState";
import { RESTED_WARD_TURNS } from "../home";
import { BOMB_DAMAGE, ETHER_MP, HI_POTION_HP, ITEM_INFO, MPOTION_MP, POTION_HP } from "../itemInfo";
import { ENEMIES, type EnemyDef, type EnemySpecial } from "../monsters";
import { ART_PX, bodyStyle, DIM_TEXT, retroStyle, showToast, texelsOf } from "../pixelart";
import type { PixelText } from "../pixelText";
import { endPracticeRun, type PracticeRun, practiceEnemy } from "../practice";
import { recordRank } from "../ranking";
import { playSkill, SKILL_HITS, SKILL_SHEET_KEYS, type SkillStage } from "../skillFx";
import { playSkillSfx, skillSfxHits } from "../skillSfx";
import { playSoul, warmSoul } from "../soulFx";
import { breakOf, StatusFx, type StatusKind } from "../statusFx";
import { playTech, TECH_HITS, TECH_MELEE, TECH_SHEET_KEYS } from "../techFx";
import { rollTreasureMap } from "../treasure";
import { addBattleWeather } from "../ui/BattleWeather";
import { bindKeyHint, keyHint, onInputChange } from "../ui/Gamepad";
import { GEAR_LAYOUT } from "../ui/HeroGear";
import { skyOverlay } from "../ui/NightOverlay";
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
const TYPE_MIN_MS = 6;
const FREEZE_TINT = 0x67e8f9;
// a poison tick's purple, filled on the foe and multiplied on the hero, which
// warmStatuses bakes their poison sheets in ahead
const PSN_TINT = 0xc084fc;
const ENRAGE_TINT = 0xff7070;
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
// FIRE IMP's middle, and its flight to the foe, 780px at 1x
const COMPANION_SHOT_X = 32;
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
const BURNAWAY_KIN = [ENEMIES.magmaSlime, ENEMIES.fireImp, ENEMIES.salamander, ENEMIES.flameDrake].map((e) => e.name);
// stone and the troll that turns to it: the forest's boss and golem
const PETRIFY_KIN = [ENEMIES.troll, ENEMIES.mossGolem].map((e) => e.name);

// a hero at this share of its max HP or less has its fall (soulFx.ts) baked
// before the move sheets, as the next blow or two may be its last
const SOUL_WARM_HP = 0.4;

// status labels sit right-aligned on the HP rows, 20px inside each window
const PLAYER_STATUS_RIGHT = 476;
const ENEMY_STATUS_RIGHT = GAME_WIDTH - 52;
// Player tags are size 5, 3 glyphs = 60px with 20px between. "HP 999/999"
// ends at x=304, so a row holds two (336..476); a third (WRD with PSN and
// FRZ up) wraps to a second row in the free strip between the HP and MP
// rows, right of the HP bar (which ends at x=240).
const PLAYER_STATUS_MIN_X = 324;
const STATUS_ROWS = [90, 114, 138];
// the enemy side works the same way: "HP 700/700" (an NG+3 FLAME DRAKE, the
// most HP in the game) ends at x=1056, so one tag fills row 1 and the rest stack below, right of
// the HP bar (which ends at x=992). With a boss's CHG, RAGE, a companion's
// PSN/BRN and CHL all up, the fourth takes a third row (y 138..158), above
// the COMBO line at y=168. The player never has more than three tags.
const ENEMY_STATUS_MIN_X = 1076;
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

  private playerHpBar!: Phaser.GameObjects.Rectangle;
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
  // set for a TRAINING YARD bout (see practice.ts); null for every other battle
  private practice: PracticeRun | null = null;
  // set for a fight down in the ABYSS (see abyss.ts): its floor, and whether
  // the foe is that floor's GUARDIAN
  private abyss: AbyssBout | null = null;
  // a field boss or the TROLL KING fought again after its first kill (see
  // init)
  private rematch = false;
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
  private wardTurns = 0;
  // companion skill state on the enemy (see companionSkills.ts), which the
  // elemental spells' side effects share: a poison or burn ticking down, a
  // web or a BOLT's shock costing its next turn, CHILL/PILFER spent
  private enemyDot: { label: "PSN" | "BRN"; turns: number } | null = null;
  private stuck: "web" | "shock" | null = null;
  // the stars round a stuck foe's head (statusFx's stun loop): what fades them out
  private stunStars?: () => void;
  private chilled = false;
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
  // WELL RESTED from the HOME's FEATHER BEDS (home.ts): WARD up at the start
  private rested = false;
  private rageText!: PixelText;
  // a pale bubble around the hero for as long as WARD holds
  private wardRing!: Phaser.GameObjects.Arc;

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
  }): void {
    // Phaser reuses the scene instance across scene.start(), so per-battle
    // counters must reset here rather than in the field initializer
    this.arena = data?.arena ?? null;
    this.abyss = data?.abyss ?? null;
    this.practice = data?.practice ?? null;
    // a meal lasts so many battles: this one takes its charge now, won, lost
    // or fled, each ARENA bout included, and keeps the meal to its end
    this.meal = this.practice ? null : takeMealCharge(GameState);
    this.combo = 0;
    this.stolen = false;
    this.poisonTurns = 0;
    this.frozen = false;
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
    this.pilfered = false;
    this.guarded = false;
    this.defending = false;
    this.weakFinish = false;
    const def = ENEMIES[data?.enemy ?? ""] ?? ENEMIES.slime;
    // Night is the risk/reward shift: tougher enemies, richer payout. Applied
    // to the copy, so ENEMIES stays the daytime baseline. Two exceptions, from
    // the balance audit:
    // - a boss keeps its daytime HP/ATK, though not its daytime payout. A boss
    //   is a gate the story sends you through, and night x1.25 on NEW GAME+'s
    //   x2.5 left an NG+3 night FLAME DRAKE unwinnable. The TROLL KING, a
    //   giant, keeps the whole shift: it roams the town fields like any wild
    //   foe, so meeting it at night is a choice, and it's Lv8 content that NG+
    //   outgrows.
    // - the ARENA takes no night shift at all. Its bouts are the bosses (stats
    //   already exempt) and that TROLL KING, and its prize is a share of their
    //   gold, so night would only pay x1.5 for the same risk. NEW GAME+ scaling
    //   still applies there: that risk is real.
    // - the ABYSS has no night either: no sky underground, and its depth
    //   scaling below is its whole risk/reward curve (abyss.ts).
    // NEW GAME+: each cycle hardens every foe on top of the night shift
    // (GameState.enemyScale; 1 and 1 on a first playthrough), and in the ABYSS
    // the floor's depth on top of that (abyss.ts abyssScale, capped). HP stops
    // at ENEMY_HP_MAX, which only the deep ABYSS ever reaches. A GUARDIAN pays
    // a cut of its gold, as an ARENA bout does: its first kill already paid
    // in full (abyss.ts). So does a field boss met again once its quest flag
    // is set (the ARENA's own lineup check, read before this fight's victory
    // sets it, and cleared by NEW GAME+ so a cycle's first kill pays in
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
    this.enemy = scaleEnemy(def, {
      night: this.night,
      arena: !!this.arena,
      abyss: this.abyss,
      ng: GameState.enemyScale(),
      rematch: this.rematch,
    });
    const from = data?.from;
    this.origin = from === "Dungeon" || from === "Forest" || from === "Snow" || from === "Volcano" || from === "Abyss" ? from : "Town";
    // read before this fight puts the species in the bestiary, below: the
    // enemy window shows its weakness only once an earlier fight has
    this.weakKnown = GameState.seenMonsters.includes(def.name);
    if (!GameState.seenMonsters.includes(def.name)) {
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
      this.add.pixelText(64, 168, `STREAK ${GameState.streak}`, retroStyle(6, "#fbbf24")).setDepth(120);
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
    this.companionSprite = companionDef
      ? this.add.sprite(COMPANION_X, 0, battleTexture(this, companionDef.texture)).setScale(1.5)
      : undefined;
    this.companionStance = this.companionSprite && this.stand(this.companionSprite, COMPANION_GROUND_Y, !!companionDef?.flying);

    this.heroIdle = this.idleBob(this.playerSprite, 1400, 0);
    this.enemyIdle = this.idleBob(this.enemySprite, 1700, 500, this.enemy.flying);
    this.companionIdle = this.companionSprite && this.idleBob(this.companionSprite, 1200, 900, companionDef?.flying);

    this.window(32, 24, 464, 176);
    this.window(GAME_WIDTH - 496, 24, 464, 176);

    this.add.pixelText(64, 40, GameState.player.name, retroStyle(7, "#ffd166")).setOrigin(0, 0).setDepth(STAT_DEPTH);
    this.playerHpText = this.add
      .pixelText(64, 88, "HP " + GameState.player.hp + "/" + GameState.effMaxHp(), retroStyle(6, "#ffffff"))
      .setOrigin(0, 0)
      .setDepth(STAT_DEPTH);
    this.playerMpText = this.add
      .pixelText(64, 136, "MP " + GameState.player.mp + "/" + GameState.player.maxMp, retroStyle(6, "#8ecbff"))
      .setOrigin(0, 0)
      .setDepth(STAT_DEPTH);

    this.playerHpBar = this.add.rectangle(64, 124, 176, 16, 0x22c55e).setOrigin(0, 0.5).setDepth(STAT_DEPTH);

    this.add
      .pixelText(GAME_WIDTH - 464, 40, this.enemy.name, retroStyle(7, "#ff5555"))
      .setOrigin(0, 0)
      .setDepth(STAT_DEPTH);
    this.enemyHpText = this.add
      .pixelText(GAME_WIDTH - 464, 88, "HP " + this.enemy.curHp + "/" + this.enemy.hp, retroStyle(6, "#ffffff"))
      .setOrigin(0, 0)
      .setDepth(STAT_DEPTH);
    this.enemyHpBar = this.add
      .rectangle(GAME_WIDTH - 464, 124, 176, 16, 0xef4444)
      .setOrigin(0, 0.5)
      .setDepth(STAT_DEPTH);
    // The foe's weakness worded and coloured as the bestiary has it
    // (BestiaryUI's "WEAK:FIRE"), once an earlier fight has put the species
    // there; "WEAK:?" the first time, the book having nothing either, and
    // "WEAK:-" for one with none. Between the HP bar (to y=132) and the COMBO
    // line (from 168), y 140..160; "WEAK:FIRE" is 9 x 20 = 180px from x=816,
    // clear of the status tags' third row (from x=1076).
    const weak = this.enemy.weakness;
    this.add
      .pixelText(
        GAME_WIDTH - 464,
        140,
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
    // right-aligned in the window: "MP 999/999" ends at x=304, the longest
    // tag "GRILL 5" (140px) starts at 336
    if (this.meal)
      this.add.pixelText(476, 140, `${this.meal.def.tag} ${this.meal.left}`, retroStyle(5, "#fdba74")).setOrigin(1, 0).setDepth(STAT_DEPTH);
    this.wardRing = this.add
      .circle(this.playerSprite.x, this.playerSprite.y, 64, WARD_COLOR, 0.12)
      .setStrokeStyle(3, WARD_COLOR, 0.8)
      .setVisible(false);
    this.tweens.add({ targets: this.wardRing, scale: 1.06, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
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
    this.updateEnemyStatus();
    this.updateStatus();

    // the message box (y 604..716) reads like the dialogue box, in its
    // bodyStyle(33) with its 5px leading: 54 glyphs a row, and a second row's
    // descenders end at y=697
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 60, GAME_WIDTH - 64, 112, 0x0b0b2b, 0.92).setStrokeStyle(1, 0xffffff);
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
      { label: this.practice ? "ESC:EXIT" : "ESC:RUN", action: "run", enabled: () => !this.arena },
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
    if (e.repeat || !this.waitingAction) return;

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
      // no way out of an ARENA bout but through it (see arena.ts)
      if (this.arena) {
        Sfx.error();
        return;
      }
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
    waiter.resolve(action);
  }

  // Mouse support for the action menu and item list: a global pointerdown
  // hit-tests the visible entries' bounds (like awaitAdvance) rather than
  // setInteractive() per item, so the keyboard flow stays untouched.
  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.waitingAction) return;

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
    this.add.rectangle(x, y, w, h, 0x0b0b2b, 0.85).setOrigin(0, 0).setStrokeStyle(1, 0xffffff).setDepth(STAT_DEPTH);
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
      this.menuTexts[i].setText(keyHint(b.label, b.label, { table: "battle" }));
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
    this.hintText.setText(""); // every action, spells included, has a button above
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
    this.skillInfoText.setText(`${skill.name}  ${this.skillCost(skill)} MP  ${skill.info}`).setVisible(true);
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
    const intro = this.arena ? `ROUND ${this.arena.round + 1}: ${this.enemy.name}!` : `${this.enemy.name} blocks your way!`;
    this.type(this.rested ? `${intro}\nWell rested: your WARD is up!` : intro);

    while (this.running) {
      if (GameState.player.hp <= 0) return this.defeat();

      if (this.poisonTurns > 0) await this.poisonTick();
      // a frozen hero forfeits this action (null matches no case below); the
      // companion and the enemy still take their turns
      const action = this.frozen ? null : await this.playerTurn();
      if (!action) await this.thaw();

      switch (action) {
        case "foe":
          return this.practiceFoe(this.practice!, 1);
        case "run": {
          if (this.practice) return this.exitPractice(this.practice);
          this.resetCombo();
          if (Math.random() < 0.5) {
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
      }

      if (!this.running) return;
      if (this.enemy.curHp <= 0) return this.victory();

      await this.companionAttack();
      if (!this.running) return;
      if (this.enemy.curHp <= 0) return this.victory();

      await this.enemyTurn();
      this.defending = false;
      await this.tickWard();
    }
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
    Sfx.attack();
    this.addCombo();
    const comboBonus = this.comboBonus();
    const { dmg, crit } = rollDamage(this.heroAtk(), this.enemy.def);
    const total = Math.max(1, Math.floor(dmg * (1 + comboBonus)));
    // the blow lands at the contact, the hero still out at the foe
    await this.lunge(crit, () => {
      Sfx.strike();
      if (crit) Sfx.critical();
      this.enemy.curHp = Math.max(0, this.enemy.curHp - total);
      this.enemySprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      this.fxOn(this.enemySprite, "fx-slash", HIT_FX_MS);
      if (crit) this.fxOn(this.enemySprite, "fx-crit", HIT_FX_MS);
      this.hitBurst.setPosition(this.enemySprite.x, this.enemySprite.y);
      this.hitBurst.explode(crit ? 16 : 8);
      shake(this.cameras.main, crit ? 120 : 60, crit ? 0.012 : 0.004);
      this.flashDamage(this.enemySprite.x, this.enemySprite.y, total, crit);
      this.recoil(this.enemySprite, 1, crit);
    });
    const comboNote = comboBonus > 0 ? ` COMBO x${this.combo}!` : "";
    await this.say(crit ? `CRITICAL HIT! You strike for ${total}!${comboNote}` : `You strike for ${total}!${comboNote}`);
    this.restoreEnemyTint();
    this.updateEnemyHp();
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
    const { dmg, weak } = spellRoll(spell, this.enemy.weakness);
    const fx = spell.effect;
    const effect =
      fx && this.spellEffectCanLand(fx.kind) && Math.random() < fx.chance * (weak ? SPELL_EFFECT_WEAK_MULT : 1) ? fx.kind : null;
    if (spell.ultimate) await this.castNova(spell);
    else await this.castProjectile(spell);
    this.enemy.curHp = Math.max(0, this.enemy.curHp - dmg);
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
    // worst case "WEAKNESS! ICE hits for 39! ATK DN! CHAIN x99!", 45 glyphs
    const tail = effect && this.enemy.curHp > 0 ? this.landSpellEffect(effect) : "";
    const chain = weak && this.enemy.curHp > 0 && this.combo >= 2 ? ` CHAIN x${this.combo}!` : "";
    const finish = this.weakFinish ? " WEAK FINISH!" : "";
    await this.say(`${weak ? `WEAKNESS! ${spell.name} hits for ${dmg}!` : `${spell.name}! ${dmg} damage!`}${tail}${chain}${finish}`);
    this.restoreEnemyTint();
    this.updateEnemyHp();
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
    // the hits' numbers in a row across the foe, centred on it
    const popX = (i: number): number => this.enemySprite.x + (i - (skill.hits - 1) / 2) * SKILL_POP_STEP;
    const land = (): void => {
      if (over || blows >= skill.hits) return;
      const i = blows++;
      if (this.enemy.curHp <= 0) return;
      const hit = skillHit(skill, {
        atk: this.heroAtk(),
        def: this.enemy.def,
        weakness: this.enemy.weakness,
        flying: this.enemy.flying,
      });
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
    const tail = effect && !down ? this.landSkillEffect(effect) : "";
    const chain = weak && !down && this.combo >= 2 ? ` CHAIN x${this.combo}!` : "";
    const combo = melee && !down && this.combo >= 2 ? ` COMBO x${this.combo}!` : "";
    const finish = this.weakFinish ? " WEAK FINISH!" : "";
    const drained = healed > 0 ? ` +${healed} HP` : "";
    const head = `${crit ? "CRITICAL! " : ""}${weak ? "WEAKNESS! " : ""}${skill.name}!`;
    await this.say(`${head} ${dealt.join("+")} damage!${drained}${tail}${chain}${combo}${finish}`);
    this.restoreEnemyTint();
    this.updateEnemyHp();
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
  private async strikeIn(onContact?: () => void): Promise<void> {
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
      this.chilled = true;
      this.enemy.atk = Math.max(1, Math.round(this.enemy.atk * COMPANION_CHILL_MULT));
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
    this.enemySprite.setTint(0xffa500).setTintMode(Phaser.TintModes.FILL);
    this.flashDamage(this.enemySprite.x, this.enemySprite.y, dmg);
    await this.say(`BOOM! ${dmg} damage!`);
    this.restoreEnemyTint();
    this.updateEnemyHp();
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
    if (Math.random() < captureChance(this.enemy.curHp, this.enemy.hp)) {
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
  // in 0.001 steps for every catchable foe from the ground line, no top edge
  // rises above y 247 (the TROLL KING's), 47px under the windows, and it
  // clears the hero's head but for a brush of under 10ms. BATTLE SPEED
  // applies: 0.88s at 1x.
  private async catchFx(): Promise<void> {
    const sprite = this.enemySprite;
    this.enemyIdle?.stop();
    this.settleEnemyScale();
    sprite.setTint(CANDY_PINK).setTintMode(Phaser.TintModes.FILL);
    this.catchBurst.explode(14, sprite.x, sprite.y);
    // lifted off the ground as it goes, so its shadow goes with the glow
    this.tweens.add({ targets: this.enemyStance, fade: 0, duration: this.anim(200) });
    const flying = !!this.enemy.flying;
    const toY = this.restY(this.enemy.texture, 1.5, COMPANION_GROUND_Y, flying);
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
    const caught = battleTexture(this, this.enemy.texture);
    if (this.companionSprite) this.companionSprite.setTexture(caught);
    else this.companionSprite = this.add.sprite(COMPANION_X, toY, caught);
    this.companionSprite.setScale(1.5);
    this.companionStance = this.stand(this.companionSprite, COMPANION_GROUND_Y, flying, this.companionStance);
    this.companionIdle = this.idleBob(this.companionSprite, 1200, 0, flying);
    this.companionSprite.setScale(0.5);
    await this.tweenPromise(this.companionSprite, { scale: 1.5, ease: "Back.easeOut" }, this.anim(180));
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
    await this.say("You brace for the blow!");
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
    const atk = companionAtk(def, GameState.player.level, bond);
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
  // keeps one height.
  private companionLunge(onHit: () => void): Promise<void> {
    const sprite = this.companionSprite;
    if (!sprite) return Promise.resolve();
    let struck = false;
    this.companionIdle?.pause();
    return new Promise<void>((resolve) => {
      this.tweens.add({
        targets: sprite,
        x: this.enemySprite.x - 90,
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
  // toward the foe, in place of a dash: FIRE's own shot at the imp's 3px
  // cell (its 1.5x). onHit as it lands (its burst, companionSkill).
  private async companionCast(onHit: () => void): Promise<void> {
    const sprite = this.companionSprite;
    if (!sprite) return;
    const foe = this.enemySprite;
    const [x, y] = [sprite.x + COMPANION_SHOT_X, sprite.y];
    this.tweens.add({ targets: sprite, x: sprite.x + 16, duration: this.anim(90), yoyo: true });
    const shot = loopFx(this, "fx-fireball", x, y, this.anim(30), 1.5).setRotation(Math.atan2(foe.y - y, foe.x - x));
    await this.tweenPromise(shot, { x: foe.x, y: foe.y }, this.anim(COMPANION_SHOT_MS));
    shot.destroy();
    shake(this.cameras.main, 100, 0.006);
    onHit();
  }

  // PILFER: three coins (fx.ts fx-coin) spin off the foe in arcs, a beat
  // apart, to the goblin's place as it dashes back, at its 3px cell. Each
  // next one hops higher; the highest (PILFER_HOP + 48) tops out at y 206
  // over a flier, the windows' bottom 200.
  private pilferCoins(): void {
    const goblin = this.companionSprite;
    if (!goblin) return;
    const [fromX, fromY] = [this.enemySprite.x, this.enemySprite.y];
    const [toX, toY] = [COMPANION_X, goblin.y];
    for (let i = 0; i < 3; i++) {
      const coin = loopFx(this, "fx-coin", fromX, fromY, this.anim(30), 1.5).setVisible(false);
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
      this.chilled = true;
      this.enemy.atk = Math.max(1, Math.round(this.enemy.atk * COMPANION_CHILL_MULT));
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
      await this.say(`${this.enemy.name} takes ${dmg} ${word.toLowerCase()}!`);
      this.restoreEnemyTint();
    }
    if (dot.turns === 0) {
      this.enemyDot = null;
      this.updateEnemyStatus();
      await this.say(`${word} on ${this.enemy.name} wore off.`);
    }
  }

  private async enemyTurn(): Promise<void> {
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
    // a wound-up strike lands before anything else this turn could; a fresh
    // wind-up only once the cooldown has run out (see BOSS_TELLS)
    const tell = BOSS_TELLS[this.enemy.name];
    if (tell && this.charging) return this.bossStrike(tell);
    if (tell && this.tellCooldown > 0) this.tellCooldown -= 1;
    else if (tell && !this.frozen && Math.random() < (tell.chance ?? BOSS_TELL_CHANCE)) return this.bossTell(tell);
    const special = this.rollSpecial();
    if (this.freezeGrace > 0) this.freezeGrace -= 1;
    if (special === "regen") return this.regenerate();

    await this.enemyLunge();
    // impact thud lands with the damage, not at the wind-up
    Sfx.hit();
    const hit = rollDamage(this.enemy.atk, this.heroDef());
    const crit = hit.crit;
    const { dmg, note, braced } = this.guardHit(hit.dmg);
    if (crit) Sfx.critical();
    GameState.player.hp = Math.max(0, GameState.player.hp - dmg);
    this.setPlayerTint(0xff6666, true);
    this.fxOn(this.playerSprite, crit ? "fx-crit" : "fx-hit", HIT_FX_MS);
    if (braced) this.blockOn();
    this.hitBurst.setPosition(this.playerSprite.x, this.playerSprite.y);
    this.hitBurst.explode(crit ? 16 : 8);
    shake(this.cameras.main, crit ? 120 : 80, crit ? 0.012 : 0.006);
    this.recoil(this.playerSprite, -1, crit);
    this.flashDamage(this.playerSprite.x, this.playerSprite.y, dmg, crit);
    await this.say(crit ? `CRITICAL! ${this.enemy.name} strikes for ${dmg}!${note}` : `${this.enemy.name} attacks for ${dmg}!${note}`);
    this.setPlayerTint(undefined);
    this.updatePlayerStats();
    if (GameState.player.hp <= 0) return;

    // a resist accessory still takes the hit but stops the status, and says
    // so — otherwise the gear would look like it did nothing
    if ((special === "poison" || special === "freeze") && GameState.resists(special)) {
      await this.say(special === "poison" ? "ANTIDOTE CHARM blocks the poison!" : "EMBER RING blocks freezing!");
      return;
    }
    // ...and a MOON TEA (cooking.ts) shrugs off a share of what gets past
    if ((special === "poison" || special === "freeze") && this.meal && Math.random() < (this.meal.def.effect.resist ?? 0)) {
      await this.say(`The ${this.meal.def.name} wards off ${special === "poison" ? "poison" : "the frost"}!`);
      return;
    }

    if (special === "poison") {
      Sfx.poison();
      this.poisonTurns = POISON_TURNS;
      this.updateStatus();
      this.statusOn(this.playerSprite, "poison", STATUS_FX_MS, STATUS_POP_MIN_MS);
      this.flashStatus("PSN", "#c084fc");
      await this.say("POISONED! HEAL or POTION cures it.");
    } else if (special === "freeze") {
      await this.freezeHero();
    }
  }

  // the hero's ATK and DEF as this battle's meal (cooking.ts) leaves them
  private heroAtk(): number {
    return Math.round(GameState.effAtk() * (1 + (this.meal?.def.effect.atk ?? 0)));
  }

  private heroDef(): number {
    return Math.round(GameState.effDef() * (1 + (this.meal?.def.effect.def ?? 0)));
  }

  // WARD (while it lasts) or BULWARK (the next blow) halves a hit, never
  // below 1, else DEFEND takes its share; the three never stack, and BULWARK
  // is used up by the blow either way. Worst case "CRITICAL! CURSED GOBLIN
  // strikes for 999! (DEFEND)", 49 glyphs. `braced`: DEFEND or BULWARK took
  // it, which blockOn() shows (WARD has its bubble already)
  private guardHit(raw: number): { dmg: number; note: string; braced: boolean } {
    const warded = this.wardTurns > 0;
    const guarded = !warded && this.guarded;
    this.guarded = false;
    const defended = !warded && !guarded && this.defending;
    const dmg = defended ? defendedDamage(raw) : guardedDamage(raw, warded || guarded);
    return { dmg, note: warded ? " (WARD)" : guarded ? " (GUARD)" : defended ? " (DEFEND)" : "", braced: guarded || defended };
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
    await this.say(tell.warn);
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
    } else await this.enemyLunge();
    Sfx.hit();
    Sfx.critical();
    const { dmg, note, braced } = this.guardHit(bossStrikeDamage(this.enemy.atk, tell.mult, this.heroDef(), GameState.effMaxHp()));
    GameState.player.hp = Math.max(0, GameState.player.hp - dmg);
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
    this.updatePlayerStats();
    if (GameState.player.hp <= 0 || !canFreeze) return;
    if (GameState.resists("freeze")) {
      await this.say("EMBER RING blocks freezing!");
      return;
    }
    await this.freezeHero();
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
    await this.say(`${this.enemy.name} is ENRAGED! ATK UP!`);
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
      await this.say(`The poison deals ${dmg} damage!`);
      this.setPlayerTint(this.frozen ? FREEZE_TINT : undefined);
    }
    if (this.poisonTurns === 0) {
      this.updateStatus();
      await this.say("The poison wore off.");
    }
  }

  private async thaw(): Promise<void> {
    this.frozen = false;
    this.freezeGrace = FREEZE_GRACE_TURNS;
    shake(this.cameras.main, 80, 0.004);
    await this.say("Frozen solid! You lose this turn.");
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
  private flashStatus(label: string, color: string, x = this.playerSprite.x, y = this.playerSprite.y - 80): void {
    const t = this.add.pixelText(x, y, label, retroStyle(10, color)).setOrigin(0.5).setStroke("#000000", 2);
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
    this.layoutTags(
      [
        // first, so an incoming strike always holds the top row
        [this.chargeText, this.charging],
        [this.rageText, this.enraged],
        [this.dotText, this.enemyDot !== null],
        [this.chillText, this.chilled],
      ],
      ENEMY_STATUS_RIGHT,
      ENEMY_STATUS_MIN_X,
    );
  }

  private layoutTags(tags: Array<[PixelText, boolean]>, rightEdge: number, minX: number): void {
    let right = rightEdge;
    let row = 0;
    for (const [t, on] of tags) {
      t.setVisible(on);
      if (!on) continue;
      if (right - t.width < minX && row < STATUS_ROWS.length - 1) {
        row += 1;
        right = rightEdge;
      }
      t.setPosition(right, STATUS_ROWS[row]);
      right -= t.width + 20;
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

  private async enemyLunge(): Promise<void> {
    const startX = this.enemySprite.x;
    const targetX = this.playerSprite.x + 80;
    const trail = this.ghostTrail(this.enemySprite);
    await this.tweenPromise(this.enemySprite, { x: targetX }, this.anim(LUNGE_OUT_MS), trail);
    await this.tweenPromise(this.enemySprite, { x: startX }, this.anim(LUNGE_BACK_MS));
  }

  // FIGHT's strike: strikeIn (draw back, dash, `onContact` as it connects),
  // a short freeze, then home
  private async lunge(crit = false, onContact?: () => void): Promise<void> {
    const startX = this.playerSprite.x;
    await this.strikeIn(onContact);
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
  // each side, or FLY_SHADOW_W of the body for a flier; it lies on the
  // backdrop's 4px cells, 3 to 5 rows of them, and under every fighter.
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
    for (let top = -h / 2; top < h / 2; top += PIXEL) {
      const mid = (top + PIXEL / 2) / (h / 2);
      const hw = Math.round((half * Math.sqrt(1 - mid * mid)) / PIXEL) * PIXEL;
      shadow.fillRect(-hw, top, hw * 2, PIXEL);
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
    const big = this.enemy.boss || this.enemy.giant;
    const spells = this.knownSpells();
    const skills = this.knownSkills();
    // a spell's or skill's side effect, where spellEffectCanLand could ever let it
    const casts = (kind: SkillEffect): boolean =>
      spells.some((s) => s.effect?.kind === kind) || skills.some((s) => s.effect?.kind === kind);
    const pal = COMPANION_SKILLS[GameState.companion ?? ""];
    const warm = (target: Phaser.GameObjects.Sprite, kind: StatusKind, tint?: number, mode?: Phaser.TintModes): void =>
      this.statusFx.warm(target, kind, tint, mode);
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
    if (special?.kind === "poison" && !GameState.resists("poison")) {
      warm(hero, "poison");
      warm(hero, "poison", PSN_TINT);
    }
    if ((special?.kind === "freeze" || BOSS_TELLS[name]?.freezes) && !GameState.resists("freeze")) warm(hero, "freeze");
    if (special?.kind === "regen") warm(foe, "regrow");
    // How the foe dies, ahead of the move sheets below: a first-turn blow can
    // fell it, played some 0.7s in after a quick FIGHT and Z, and behind a Lv30
    // hero's 34 move sheets (1.2s of the warm) a shatter was baked on the spot
    // there (25ms, headless).
    const death = this.deathOf();
    if (death) warm(foe, death);
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
    this.enemyHpBar.setScale(Math.max(0, this.enemy.curHp / this.enemy.hp), 1);
  }

  // hit flashes clearTint the enemy sprite, which would also strip a boss's
  // enrage glow; re-apply it afterwards
  private restoreEnemyTint(): void {
    this.enemySprite.clearTint();
    if (this.enraged) this.enemySprite.setTint(ENRAGE_TINT);
  }

  private comboBonus(): number {
    return comboBonus(this.combo);
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
    this.playerHpBar.setScale(Math.max(0, GameState.player.hp / GameState.effMaxHp()), 1);
  }

  // A won fight's quest bookkeeping: the ELDER's and HUNTER's counters, the
  // achievement tallies, the daily bounty and a story boss's quest flag.
  private tallyQuestKill(): void {
    if (this.enemy.name === "SLIME") GameState.quest.slimes += 1;
    if (this.enemy.name === "GOLDEN SLIME") GameState.quest.goldenSlimes += 1;
    if (this.enemy.name === ENEMIES.wisp.name) GameState.quest.wispsDefeated += 1;
    if (this.enemy.name === "BAT") GameState.quest.batsSlain += 1;
    if (this.enemy.name === ENEMIES.yeti.name) GameState.quest.yetisSlain += 1;
    // daily bounty board: unbounded like the counters above, only ever
    // compared/clamped at display time
    if (GameState.bounty && this.enemy.name === GameState.bounty.target) GameState.bounty.have += 1;
    // two story bosses share the `boss` flag; each sets its own quest gate
    if (this.enemy.boss) {
      if (this.enemy.name === ENEMIES.mossGolem.name) GameState.quest.forestBoss = true;
      else if (this.enemy.name === ENEMIES.iceGolem.name) GameState.quest.snowBoss = true;
      else if (this.enemy.name === ENEMIES.flameDrake.name) GameState.quest.volcanoBoss = true;
      else GameState.quest.bossDefeated = true;
    }
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
    // the TROLL KING's flag (arena.ts: what puts it in the ARENA lineup) for
    // beating it or catching it, which takes beating it down first; never
    // from the ABYSS, where nothing sets a flag
    if (!this.abyss && this.enemy.name === ENEMIES.troll.name) GameState.quest.trollDefeated = true;
    // read before the boss branch below sets the flags: only the first MOSS
    // GOLEM / FLAME DRAKE kill (of each NEW GAME+ cycle, which clears them)
    // rolls the ending / epilogue, a rematch just ends the battle — and the
    // ABYSS is all rematch, even in a NEW GAME+ cycle that hasn't yet beaten
    // the boss it meets down there as a GUARDIAN (abyss.ts)
    const firstMoss = !caught && !this.abyss && this.enemy.name === ENEMIES.mossGolem.name && !GameState.quest.forestBoss;
    const firstDrake = !caught && !this.abyss && this.enemy.name === ENEMIES.flameDrake.name && !GameState.quest.volcanoBoss;
    if (!caught) {
      GameState.streak += 1;
      // streak bonus rewards pushing on without fleeing; capped so a long run
      // can't outpace the boss/chest economy; a rematch pays neither bonus,
      // as its ARENA bout doesn't (see init)
      const streakPct = GameState.streak >= STREAK_MIN && !this.rematch ? Math.min(GameState.streak, STREAK_CAP) * 0.1 : 0;
      const streakBonus = Math.floor(this.enemy.gold * streakPct);
      // PUMPKIN PIE (cooking.ts) adds to the battle's own payout, not the loot
      const mealGold = this.rematch ? 0 : (this.meal?.def.effect.gold ?? 0);
      const goldGained = GameState.gainGold(Math.round((this.enemy.gold + streakBonus) * (1 + mealGold)));
      GameState.battles += 1;
      // nothing fought in the ABYSS counts toward a quest, the bounty or a
      // boss's flag (abyss.ts)
      if (!this.abyss) this.tallyQuestKill();
      GameState.player.hp = Math.min(GameState.effMaxHp(), GameState.player.hp + 5);
      GameState.player.mp = Math.min(GameState.player.maxMp, GameState.player.mp + 2);
      // FISH STEW (cooking.ts): a share of max HP back after each win
      const mealHeal = Math.min(
        GameState.effMaxHp() - GameState.player.hp,
        Math.ceil(GameState.effMaxHp() * (this.meal?.def.effect.heal ?? 0)),
      );
      GameState.player.hp += mealHeal;
      this.updatePlayerStats();
      // a boss's first kill always leaves a HI-POTION; anything else, a
      // rematch too, rolls FIELD_LOOT
      const roll = Math.random();
      let edge = 0;
      const loot =
        this.enemy.boss && !this.rematch
          ? BOSS_LOOT
          : FIELD_LOOT.find((l) => {
              edge += l.chance;
              return roll < edge;
            });
      if (loot) GameState.inventory[loot.key] += 1;
      // monster materials for the BLACKSMITH (drops.ts), likelier after a
      // WEAK FINISH, more of them deep in the ABYSS (abyss.ts, at most x3);
      // the ARENA returned above
      const drop = rollDrop(this.enemy, false, Math.random, this.weakFinish);
      if (drop && this.abyss) drop.count *= abyssDropMult(this.abyss.floor);
      // the KOI FEAST's doubling (cooking.ts), on top of the depth's
      if (drop) drop.count *= 1 + (this.meal?.def.effect.drops ?? 0);
      if (drop) GameState.inventory[drop.material] += drop.count;
      const found = [loot?.name, drop && `${drop.count > 1 ? drop.count : "a"} ${MATERIALS[drop.material].name}`].filter(Boolean);
      const exp = Math.round(this.enemy.exp * (1 + (this.meal?.def.effect.exp ?? 0)));
      GameState.player.exp += exp;
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
      // figure has four digits at most: the biggest purse is an NG+3 night
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
      await this.say(`${this.enemy.name} falls! +${goldGained}G${streak}  EXP +${exp}${second ? `\n${second}` : ""}`);
      let leveled = false;
      let newRank = 0;
      const fromLevel = GameState.player.level;
      while (GameState.player.level < MAX_LEVEL && GameState.player.exp >= expToNext(GameState.player.level)) {
        GameState.player.exp -= expToNext(GameState.player.level);
        GameState.player.level += 1;
        GameState.player.maxHp = Math.min(MAX_HP, GameState.player.maxHp + 5);
        GameState.player.maxMp = Math.min(MAX_MP, GameState.player.maxMp + 2);
        GameState.player.atk += 1;
        GameState.player.def += 1;
        GameState.player.hp = GameState.effMaxHp();
        GameState.player.mp = GameState.player.maxMp;
        const rank = recordRank(GameState.player.name, GameState.player.level);
        if (rank > 0) newRank = rank;
        leveled = true;
      }
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
        await this.say(`LEVEL UP! LV ${GameState.player.level}${newRank > 0 ? `  RANK #${newRank}!` : ""}${this.learnedLine(fromLevel)}`);
      }
      // now and then a TREASURE MAP (treasure.ts), never in the ABYSS, whose
      // pay model has no room for it; its own line, news the payout's page
      // would bury, and where to read it on a second (the bag's last page,
      // which nothing else points a new player at; touch has an I button
      // too). 29 glyphs, inside the 54 a row holds
      if (!this.abyss && rollTreasureMap(GameState.treasureMaps, GameState.quest)) {
        Sfx.pickup();
        this.fxOn(this.playerSprite, "fx-levelup", 1100);
        await this.say("You found a TREASURE MAP!\nRead it in ITEMS (I), page 3.");
      }
      if (this.enemy.boss) await this.say(`The ${this.enemy.name} is no more!`);
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

  // A yard foe down: nothing is won, and the same foe comes in again behind
  // a short fade, for as long as the player stays (C:FOE picks another)
  private async practiceVictory(run: PracticeRun): Promise<void> {
    Sfx.victory();
    this.fell();
    await this.say(`${this.enemy.name} is down! Again...`);
    this.practiceFoe(run, 0);
  }

  // the yard's next bout, `step` foes along the roster (0 for the same one)
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

  private say(text: string): Promise<void> {
    return new Promise((resolve) => this.type(text, () => this.awaitAdvance(resolve)));
  }

  // types `text` into the message box, then `done`; a line still typing
  // (only ever the opening one, which nothing waits on) is cut off
  private type(text: string, done?: () => void): void {
    this.typing?.remove();
    this.msgText.setText(text);
    let i = 0;
    const ev = this.time.addEvent({
      delay: this.anim(14, TYPE_MIN_MS),
      repeat: text.length,
      callback: () => {
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
