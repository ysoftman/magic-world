import type Phaser from "phaser";
import { COMBO_CAP, COMBO_PCT, DEFEND_HEAVY_MULT, PARRY_MULT, PERFECT_MULT } from "../battleRules";
import { GAME_WIDTH } from "../config";
import { LIMIT_MULT } from "../limit";
import { bodyStyle, gridOutline, retroStyle } from "../pixelart";
import { bindKeyHint, keyHint } from "./Gamepad";

// The battle's own help: what each thing on the battle screen is, a row
// each, under the names the screen itself uses (the gauge's LIMIT, the tags'
// CHG and >MOVE). A first-time line (BattleScene tip) says a thing once and
// the field's "?" lists keys; nothing said again what the full LIMIT gauge
// was. Opened from the menu ("?", or a tap on the hint line's HELP), closed by
// any key or tap, so it costs a fight nothing unless asked for.
//
// Fourteen rows of bodyStyle(22) (14px a glyph) at a 30px pitch (its 26px
// line and 4 more: set solid, the rows read as one block): a name padded to
// NAME_W and its line, 60 glyphs a row at most (840px, the dialogue box's
// measure), from x 220. The panel is opaque and runs x 24..1256, y 16..596:
// over both stat windows whole (x 32..1248, y 24..200; a narrower one left
// their borders and the names' tops showing round it), both menu rows (to
// 560) and the hint line (to 586), short of the message box (from 604).
// Title at 52, rows 84..504, the close hint at 560. The figures are the
// rules' own constants, so a retune rewrites its row.
const PANEL_X = 24;
const PANEL_TOP = 16;
const PANEL_W = GAME_WIDTH - PANEL_X * 2;
const PANEL_H = 580;
const NAME_W = 10;
const ROW_GLYPHS = 60;
const TEXT_X = (GAME_WIDTH - ROW_GLYPHS * 14) / 2;
const pct = (share: number): string => `${Math.round(share * 100)}%`;

const rows = (): [string, string][] => [
  ["PARRY", keyHint(`Any key as a foe's blow lands: ${pct(PARRY_MULT)} damage.`, `Tap as a foe's blow lands: ${pct(PARRY_MULT)} damage.`)],
  [
    "PERFECT",
    keyHint(
      `Any key as FIGHT's frame shuts gold: +${pct(PERFECT_MULT - 1)}.`,
      `Tap as FIGHT's frame shuts gold: +${pct(PERFECT_MULT - 1)}.`,
    ),
  ],
  ["COMBO", `FIGHTs in a row: +${pct(COMBO_PCT)} each, up to +${pct(COMBO_PCT * COMBO_CAP)}.`],
  [
    "LIMIT",
    keyHint(`The bar under your name. Full: L, a x${LIMIT_MULT} blow.`, `The bar under your name. Full: tap it for x${LIMIT_MULT}.`),
  ],
  ["DEFEND", `A CHG strike or a blast does ${pct(DEFEND_HEAVY_MULT)}; you COUNTER.`],
  [">MOVE", "Blinks in the foe's window: its next move."],
  ["CHG", "Big hit next: DEFEND; PARRY (no breath): it reels."],
  ["ATK+ DEF+", "The foe's buff. Spells go through a DEF+."],
  ["PSN BRN", "Tick each turn. CHL: the foe's ATK is down."],
  ["REACTION", "BRN+ICE, CHL+BOLT, PSN+FIRE: the status bursts."],
  ["WEAK", "Its weak element (x1.5), once you fought one."],
  ["AMBUSH!", "Its back: a free FIGHT. OFF GUARD!: it hits first."],
  ["ELITE", "FIERCE, STURDY or SWIFT: tougher, richer loot."],
  ["SWORDS", "Each has a nature: see its line in ITEMS."],
];

export class BattleHelp {
  private readonly panel: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    const body = (): string =>
      rows()
        .map(([name, line]) => name.padEnd(NAME_W) + line)
        .join("\n");
    this.panel = scene.add
      .container(0, 0, [
        gridOutline(scene.add.rectangle(GAME_WIDTH / 2, PANEL_TOP + PANEL_H / 2, PANEL_W, PANEL_H, 0x0b0b2b, 1), 0xffffff),
        scene.add.pixelText(GAME_WIDTH / 2, PANEL_TOP + 36, "BATTLE HELP", retroStyle(6, "#ffd166")).setOrigin(0.5),
        bindKeyHint(scene.add.pixelText(TEXT_X, PANEL_TOP + 68, "", bodyStyle(22, "#f5f5f5")).setLineSpacing(4), body),
        bindKeyHint(scene.add.pixelText(GAME_WIDTH / 2, PANEL_TOP + PANEL_H - 36, "", retroStyle(4, "#8ecbff")), () =>
          keyHint("ANY KEY: CLOSE", "TAP: CLOSE"),
        ).setOrigin(0.5),
      ])
      .setDepth(260)
      .setVisible(false);
  }

  get open(): boolean {
    return this.panel.visible;
  }

  show(): void {
    this.panel.setVisible(true);
  }

  hide(): void {
    this.panel.setVisible(false);
  }
}
