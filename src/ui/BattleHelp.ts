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
// Thirteen rows of bodyStyle(22) (14px a glyph, 26px a line): a name padded to
// NAME_W and its line, the longest row 75 glyphs (touch's LIMIT), 1050px from
// x 108, in a 1160px panel (x 60..1220, 48px a side). The panel is opaque and
// runs y 48..596: over the stat windows, both menu rows (to 560) and the hint
// line (to 586), short of the message box (from 604). Ending at 530 its edge
// cut through the menu's glyphs. Title at 84, rows 124..462, the close hint
// at 560. The figures are the rules' own constants, so a retune rewrites its
// row.
const PANEL_W = 1160;
const PANEL_TOP = 48;
const PANEL_H = 548;
const NAME_W = 10;
const pct = (share: number): string => `${Math.round(share * 100)}%`;

const rows = (): [string, string][] => [
  [
    "PARRY",
    keyHint(
      `Any key just as a foe's blow lands: it does ${pct(PARRY_MULT)}, no status.`,
      `Tap just as a foe's blow lands: it does ${pct(PARRY_MULT)}, no status.`,
    ),
  ],
  [
    "PERFECT",
    keyHint(
      `Any key as FIGHT's frame shuts gold: +${pct(PERFECT_MULT - 1)} damage.`,
      `Tap as FIGHT's frame shuts gold: +${pct(PERFECT_MULT - 1)} damage.`,
    ),
  ],
  ["COMBO", `FIGHTs in a row: +${pct(COMBO_PCT)} each, to +${pct(COMBO_PCT * COMBO_CAP)}. Any other action resets it.`],
  [
    "LIMIT",
    keyHint(
      `The bar under your name. Full, it blinks: L for one x${LIMIT_MULT} blow.`,
      `The bar under your name. Full, it blinks: tap it for a x${LIMIT_MULT} blow.`,
    ),
  ],
  ["DEFEND", `A turn braced: a CHG strike or a blast does ${pct(DEFEND_HEAVY_MULT)} and you COUNTER.`],
  [">MOVE", "Blinking in the foe's window: the move it uses next turn."],
  ["CHG", "The foe winds up: its big strike is next turn. DEFEND or WARD."],
  ["ATK+ DEF+", "The foe's buff. Spells, and a HEAVY sword, go through a DEF+."],
  ["PSN BRN", "The foe's poison or burn ticks each turn. CHL: its ATK is down."],
  ["REACTION", "A status reacts and is spent: BRN+ICE, CHL+BOLT, PSN+FIRE."],
  ["WEAK", "Its weak element (x1.5), shown once you have fought its kind."],
  ["ELITE", "A coloured name with FIERCE, STURDY or SWIFT: tougher, richer."],
  ["SWORDS", "Each sword has a nature of its own: read its line in ITEMS."],
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
        bindKeyHint(scene.add.pixelText(GAME_WIDTH / 2 - PANEL_W / 2 + 48, PANEL_TOP + 76, "", bodyStyle(22, "#f5f5f5")), body),
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
