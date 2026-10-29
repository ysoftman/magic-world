import type Phaser from "phaser";
import { GAME_WIDTH } from "../config";
import { MEALS } from "../cooking";
import { clock, expToNext, GameState, isNight, type QuestState } from "../gameState";
import { currentObjective } from "../objective";
import { makeTexture, type PixelMap, retroStyle } from "../pixelart";
import type { PixelText } from "../pixelText";
import { type Region, type Weather, weatherToday } from "../weather";

export const STATUS_HUD_HEIGHT = 88;
export const STATUS_HUD_TOAST_Y = STATUS_HUD_HEIGHT + 12;
// Where a panel that reaches up into the HUD may start, so its top edge cuts
// no line of HUD glyphs (row 1 at y 14..34, row 2 at 58..78) in half: over
// both rows, or in the gap under row 1. At 28 and 61 the edge sliced through
// a row and left half-letters showing above the panel.
export const PANEL_TOP_OVER_HUD = 8;
export const PANEL_TOP_UNDER_HUD_ROW1 = 40;

// The single quest slot shows whichever chapter is currently open: the label
// of objective.ts's current step, the same walk of the chain the minimap's
// marker follows. Exported for the title screen's save card, which passes the
// save's own caught list rather than the live one.
export function questLabel(q: QuestState, caught: readonly string[] = GameState.caught): string {
  return currentObjective(q, caught).label;
}

const COLORS = {
  name: "#ffffff",
  lv: "#fbbf24",
  hp: "#4ade80",
  mp: "#60a5fa",
  gold: "#fde047",
  time: "#e2e8f0",
  quest: "#fb923c",
  caught: "#67e8f9",
  exp: "#86efac",
  meal: "#fdba74",
};

// The EXP bar runs x 516..1256 on row 2; while a meal (cooking.ts) is on,
// its tag and battles left take the bar's right end instead: "GRILL 5" is
// 140px right-aligned at 1256 (from 1116), the bar stops 16px short of it.
const EXP_BAR_X = 516;
const EXP_BAR_W = 740;
const MEAL_TAG_RIGHT = 1256;
const EXP_BAR_W_MEAL = MEAL_TAG_RIGHT - 140 - 16 - EXP_BAR_X;

// Day/night indicator icons: 16-cell grids baked through Scale2x to 64px and
// drawn at half that, so each Scale2x cell is one screen pixel, as the item
// icons are (BootScene "icon-<key>"). Lit from the top left. A yellow sun with
// rays, a pale crescent moon with one star. Drawn as a right-anchored image
// on row 1 so it can't overlap the GOLD segment.
const SUN_ROWS = [
  "................",
  ".......RR.......",
  "..R....RR....R..",
  "...R........R...",
  "......yyYY......",
  ".....yyYYYY.....",
  "....yyYYYYYY....",
  ".RR.yYYYYYYY.RR.",
  ".RR.YYYYYYYO.RR.",
  "....YYYYYYOO....",
  ".....YYYYOO.....",
  "......YOOO......",
  "...R........R...",
  "..R....RR....R..",
  ".......RR.......",
  "................",
];
const SUN_PALETTE: PixelMap = { y: 0xfef9c3, Y: 0xfde047, O: 0xf59e0b, R: 0xfbbf24 };

const MOON_ROWS = [
  "................",
  "........MMm.....",
  "......MMmmmd....",
  ".....MMmmd......",
  "....MMmmd.......",
  "...MMmmd........",
  "...Mmmmd...S....",
  "...Mmmd...SSS...",
  "...mmmd....S....",
  "...mmmmd........",
  "...mmmdd........",
  "....mmmdd.......",
  ".....mmddd......",
  "......mmdddd....",
  "........ddd.....",
  "................",
];
const MOON_PALETTE: PixelMap = { M: 0xf8fafc, m: 0xcbd5e1, d: 0x94a3b8, S: 0xfde68a };

// Weather takes the sun/moon's slot (same 32px, same spot) whenever the sky
// isn't clear: a cloud with rain, a storm cloud with a bolt, a snowflake, a
// cloud with gusts and flakes for a blizzard, an ash cloud with an ember. The
// same art day and night — on a rainy night the cloud is the sky, not the
// moon, and the clock beside it already says which half of the day it is.
// Falling bits of one colour never touch corner to corner, or Scale2x joins
// them into slashes; the rain's streaks do, on purpose.
const CLOUD_ROWS = [
  "................",
  "......hhhh......",
  ".....hWWWWs.....",
  "..hh.hWWWWWs....",
  ".hWWhWWWWWWW.hs.",
  ".hWWWWWWWWWWWWs.",
  ".WWWWWWWWWWWWWs.",
  ".sWWWWWWWWWWsss.",
  "..GGGGGGGGGGGG..",
];
const PALE_CLOUD: PixelMap = { h: 0xf8fafc, W: 0xe2e8f0, s: 0xcbd5e1, G: 0x94a3b8 };
const WEATHER_ICONS: Partial<Record<Weather, { key: string; rows: string[]; palette: PixelMap }>> = {
  rain: {
    key: "wx-rain",
    rows: [
      ...CLOUD_ROWS,
      "................",
      "....B...B...B...",
      "...B...B...B....",
      "................",
      "..B...B...B...B.",
      ".B...B...B...B..",
      "................",
    ],
    palette: { ...PALE_CLOUD, B: 0x60a5fa },
  },
  storm: {
    key: "wx-storm",
    rows: [
      ...CLOUD_ROWS,
      ".......YY.......",
      "......YY........",
      ".....YYYYY......",
      "..B.....YY...B..",
      ".B.....YY...B...",
      ".......Y........",
      "................",
    ],
    palette: { h: 0x94a3b8, W: 0x64748b, s: 0x475569, G: 0x334155, Y: 0xfde047, B: 0x60a5fa },
  },
  snow: {
    key: "wx-snow",
    rows: [
      "................",
      ".......C........",
      "......cCc.......",
      "..c....C....c...",
      "...C...C...C....",
      "....C..C..C.....",
      ".....C.C.C......",
      ".c....CCC....c..",
      ".cCCCCCWCCCCCc..",
      ".c....CCC....c..",
      ".....C.C.C......",
      "....C..C..C.....",
      "...C...C...C....",
      "..c....C....c...",
      "......cCc.......",
      ".......C........",
    ],
    palette: { C: 0xbae6fd, c: 0x7dd3fc, W: 0xffffff },
  },
  blizzard: {
    key: "wx-blizzard",
    rows: [
      ...CLOUD_ROWS,
      "................",
      ".wwwwwwww...S...",
      ".........w......",
      "..S....ww...S...",
      "...............S",
      "....S..wwwwwww..",
      "..............w.",
    ],
    palette: { ...PALE_CLOUD, S: 0xffffff, w: 0x7dd3fc },
  },
  ashfall: {
    key: "wx-ash",
    rows: [
      ...CLOUD_ROWS,
      "................",
      "..g.....e...g...",
      "........e.......",
      "....g..eEe....g.",
      ".e......e..g....",
      "...g........e...",
      "..........g.....",
    ],
    palette: { h: 0xa8a29e, W: 0x78716c, s: 0x57534e, G: 0x44403c, g: 0xa8a29e, e: 0xf97316, E: 0xfde68a },
  },
};

// Scene key -> weather region. Scenes without a sky (or a HUD that isn't in
// this list) keep the plain sun/moon, which is also what the cave's "none" is.
const SCENE_REGION: Record<string, Region> = {
  Town: "town",
  Forest: "forest",
  Snow: "snow",
  Dungeon: "dungeon",
  Volcano: "volcano",
};

function skyIcon(weather: Weather | null, night: boolean): string {
  return (weather && WEATHER_ICONS[weather]?.key) ?? (night ? "moon" : "sun");
}

// Compact top-of-screen overlay: colored stat segments on row 1, quest/caught
// and the EXP bar on row 2, HP/MP thin bars under the values. Everything is
// scroll-locked and drawn above the night/dungeon overlays so it stays legible;
// a sun/moon image in the top-right corner marks the day/night state.
export class StatusHud {
  private scene: Phaser.Scene;
  private panel!: Phaser.GameObjects.Rectangle;
  private accent!: Phaser.GameObjects.Rectangle;
  private hpBar!: Phaser.GameObjects.Rectangle;
  private mpBar!: Phaser.GameObjects.Rectangle;
  private expBar!: Phaser.GameObjects.Rectangle;
  private dayNightIcon!: Phaser.GameObjects.Image;
  private region: Region | null;
  private lastIcon = "";
  private segments: PixelText[] = [];
  private lastTexts: string[] = [];
  private lastColors: string[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.region = SCENE_REGION[scene.scene.key] ?? null;
    // opaque: at 0.6 the map's name tags under it ("HOME", "FARM",
    // "FISHING") read as part of the HUD — "QA HOME" beside the hero's name —
    // and even at 0.92 they still showed through
    this.panel = scene.add
      .rectangle(GAME_WIDTH / 2, STATUS_HUD_HEIGHT / 2, GAME_WIDTH - 2, STATUS_HUD_HEIGHT, 0x0b0b2b, 1)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setStrokeStyle(1, 0xffffff)
      .setDepth(110);
    this.accent = scene.add.rectangle(0, 0, GAME_WIDTH, 4, 0xfbbf24, 0.9).setOrigin(0, 0).setScrollFactor(0).setDepth(111);

    this.makeDayNightTextures();
    this.dayNightIcon = scene.add
      .image(GAME_WIDTH - 24, 26, "sun")
      .setOrigin(1, 0.5)
      .setScale(0.5)
      .setScrollFactor(0)
      .setDepth(111);

    // Row 1 is laid out on even 40px-gap slots between 24px side margins,
    // using each segment's max span so the gaps stay uniform at max values
    // (size-5 font = 20px/char, name reserves 12 chars):
    // name(240) | LV(100, right-anchored) | HP(200) | MP(200) | G(120) |
    // clock(100, right-anchored) | icon(32).
    this.addSegment(24, 14, 5, COLORS.name);
    this.addSegment(404, 14, 5, COLORS.lv, 1);
    this.addSegment(444, 14, 5, COLORS.hp);
    this.addSegment(684, 14, 5, COLORS.mp);
    this.addSegment(924, 14, 5, COLORS.gold);
    this.addSegment(1184, 14, 5, COLORS.time, 1);
    this.addSegment(24, 58, 5, COLORS.quest);
    this.addSegment(248, 58, 5, COLORS.caught);
    this.addSegment(452, 58, 5, COLORS.exp);
    this.addSegment(MEAL_TAG_RIGHT, 58, 5, COLORS.meal, 1);

    this.hpBar = scene.add.rectangle(444, 46, 192, 5, 0x4ade80, 1).setOrigin(0, 0.5).setScrollFactor(0).setDepth(110);
    this.mpBar = scene.add.rectangle(684, 46, 192, 5, 0x60a5fa, 1).setOrigin(0, 0.5).setScrollFactor(0).setDepth(110);
    this.expBar = scene.add.rectangle(EXP_BAR_X, 68, EXP_BAR_W, 8, 0x22c55e, 1).setOrigin(0, 0.5).setScrollFactor(0).setDepth(110);

    this.setVisible(GameState.hudVisible);
    this.update();
  }

  private makeDayNightTextures(): void {
    // Town and Dungeon scenes both construct a StatusHud, so generate the
    // icon textures only once per game.
    if (!this.scene.textures.exists("sun")) {
      makeTexture(this.scene, "sun", SUN_ROWS, SUN_PALETTE);
    }
    if (!this.scene.textures.exists("moon")) {
      makeTexture(this.scene, "moon", MOON_ROWS, MOON_PALETTE);
    }
    for (const icon of Object.values(WEATHER_ICONS)) {
      if (!this.scene.textures.exists(icon.key)) makeTexture(this.scene, icon.key, icon.rows, icon.palette);
    }
  }

  private addSegment(x: number, y: number, size: number, color: string, originX = 0): void {
    const t = this.scene.add.pixelText(x, y, "", retroStyle(size, color)).setOrigin(originX, 0).setScrollFactor(0).setDepth(111);
    this.segments.push(t);
    this.lastTexts.push("");
    this.lastColors.push("");
  }

  setVisible(visible: boolean): void {
    this.panel.setVisible(visible);
    this.accent.setVisible(visible);
    this.hpBar.setVisible(visible);
    this.mpBar.setVisible(visible);
    this.expBar.setVisible(visible);
    this.dayNightIcon.setVisible(visible);
    for (const t of this.segments) t.setVisible(visible);
  }

  isVisible(): boolean {
    return this.panel.visible;
  }

  forceRefresh(): void {
    this.lastTexts = this.lastTexts.map(() => "");
    this.lastColors = this.lastColors.map(() => "");
  }

  update(): void {
    const p = GameState.player;
    const q = GameState.quest;
    const maxHp = GameState.effMaxHp();
    const hpRatio = maxHp > 0 ? p.hp / maxHp : 0;
    const mpRatio = p.maxMp > 0 ? p.mp / p.maxMp : 0;
    const hpColor = hpRatio < 0.25 ? "#ef4444" : hpRatio < 0.5 ? "#fbbf24" : COLORS.hp;

    this.setSegment(0, p.name, COLORS.name);
    this.setSegment(1, `LV ${p.level}`, COLORS.lv);
    this.setSegment(2, `HP ${p.hp}/${maxHp}`, hpColor);
    this.setSegment(3, `MP ${p.mp}/${p.maxMp}`, COLORS.mp);
    this.setSegment(4, `G ${GameState.gold}`, COLORS.gold);
    this.setSegment(5, clock(), COLORS.time);
    this.setSegment(6, questLabel(q), COLORS.quest);
    // species caught, counted as the bestiary's "CAUGHT n/13" counts them —
    // the number of catches (repeats and rare ones too) read 15 beside its
    // 12/13. No "/13" here: "CAUGHT 13/13" (240px from x=248) would run
    // into EXP at 452; "CAUGHT 13" ends at 428
    this.setSegment(7, `CAUGHT ${GameState.caughtSpecies()}`, COLORS.caught);
    this.setSegment(8, "EXP", COLORS.exp);
    const meal = GameState.meal;
    this.setSegment(9, meal ? `${MEALS[meal.key].tag} ${meal.left}` : "", COLORS.meal);

    // Re-read every frame, swapped only on a change: weatherToday() is a hash
    // of the day number, so the icon follows the weather over midnight (and
    // a rest() that jumps to the next dawn) with nothing to subscribe to.
    const icon = skyIcon(this.region ? weatherToday(this.region) : null, isNight());
    if (icon !== this.lastIcon) {
      this.lastIcon = icon;
      this.dayNightIcon.setTexture(icon);
    }

    this.hpBar.setScale(Math.max(0, hpRatio), 1);
    this.mpBar.setScale(Math.max(0, mpRatio), 1);
    const barW = meal ? EXP_BAR_W_MEAL : EXP_BAR_W;
    this.expBar.setScale((Math.min(1, Math.max(0, p.exp / expToNext(p.level))) * barW) / EXP_BAR_W, 1);
  }

  private setSegment(index: number, text: string, color: string): void {
    if (text === this.lastTexts[index] && color === this.lastColors[index]) return;
    this.lastTexts[index] = text;
    this.lastColors[index] = color;
    this.segments[index].setText(text).setColor(color);
  }
}
