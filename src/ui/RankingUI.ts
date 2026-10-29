import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { GameState } from "../gameState";
import { DIM_TEXT, retroStyle } from "../pixelart";
import { getRanks, MAX_RANKS } from "../ranking";
import { bindKeyHint, keyHint } from "./Gamepad";
import { hideTouchButtons } from "./TouchControls";

// Cells are retroStyle(6) (24px a glyph), headers retroStyle(5) (20px). The
// ARENA and NG+ columns widened the panel (960 -> 1040), and the ABYSS one
// to the widest any panel goes (1160, x 60..1220, like the quest journal:
// it ends where the touch menu column starts, x>=1222), rather than
// shrinking the text: RK "10." 100..172, NAME (12 glyphs) 196..484, LV "30"
// 516..564, ARENA (header) 604..704, NG+ "+12" 724..796, ABYSS (header)
// 820..920 over "B999" 820..916, DATE "2026-10-25" 940..1180 — 40px inside
// the right edge, at least 20px between columns.
const PANEL_W = 1160;
const PANEL_H = 640;
const PANEL_TOP = GAME_HEIGHT / 2 - PANEL_H / 2;
const PANEL_LEFT = GAME_WIDTH / 2 - PANEL_W / 2;
const ROW_H = 46;
const ROWS_START = PANEL_TOP + 140;
const COL_RANK = PANEL_LEFT + 40;
const COL_NAME = PANEL_LEFT + 136;
const COL_LEVEL = PANEL_LEFT + 456;
const COL_ARENA = PANEL_LEFT + 544;
const COL_NG = PANEL_LEFT + 664;
const COL_ABYSS = PANEL_LEFT + 760;
const COL_DATE = PANEL_LEFT + 880;

// Top-10 level leaderboard shown by the RANK BOARD sign in the village.
// Follows the BestiaryUI modal pattern: dim + panel, ESC (or Z, since Z is
// the key that opens it) closes, and it re-reads the board on every open.
export class RankingUI {
  private scene: Phaser.Scene;
  private active = false;

  private dim: Phaser.GameObjects.Rectangle;
  private panel: Phaser.GameObjects.Rectangle;
  private title: Phaser.GameObjects.Text;
  private headers: Phaser.GameObjects.Text[] = [];
  private footer: Phaser.GameObjects.Text;
  private rankCells: Phaser.GameObjects.Text[] = [];
  private nameCells: Phaser.GameObjects.Text[] = [];
  private levelCells: Phaser.GameObjects.Text[] = [];
  private arenaCells: Phaser.GameObjects.Text[] = [];
  private ngCells: Phaser.GameObjects.Text[] = [];
  private abyssCells: Phaser.GameObjects.Text[] = [];
  private dateCells: Phaser.GameObjects.Text[] = [];

  private keyEsc: Phaser.Input.Keyboard.Key;
  private keyZ: Phaser.Input.Keyboard.Key;
  private closeQueued = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.dim = scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5)
      .setScrollFactor(0)
      .setDepth(150)
      .setVisible(false);
    // opaque: it reaches up over the HUD (y 0..88), whose lines showed through at 0.95
    this.panel = scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, PANEL_W, PANEL_H, 0x0b0b2b, 1)
      .setScrollFactor(0)
      .setDepth(151)
      .setStrokeStyle(2, 0xffffff)
      .setVisible(false);
    this.title = scene.add
      .text(GAME_WIDTH / 2, PANEL_TOP + 44, "RANKING", retroStyle(8, "#ffd166"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);

    const headerY = ROWS_START - 32;
    const headers: Array<{ x: number; label: string }> = [
      { x: COL_RANK, label: "RK" },
      { x: COL_NAME, label: "NAME" },
      { x: COL_LEVEL, label: "LV" },
      { x: COL_ARENA, label: "ARENA" },
      { x: COL_NG, label: "NG+" },
      { x: COL_ABYSS, label: "ABYSS" },
      { x: COL_DATE, label: "DATE" },
    ];
    for (const h of headers) {
      this.headers.push(
        scene.add
          .text(h.x, headerY, h.label, retroStyle(5, "#8ecbff"))
          .setOrigin(0, 0.5)
          .setScrollFactor(0)
          .setDepth(152)
          .setVisible(false),
      );
    }
    // touch hides Z while the board is up (see open()), leaving ESC to close
    this.footer = bindKeyHint(scene.add.text(GAME_WIDTH / 2, PANEL_TOP + PANEL_H - 36, "", retroStyle(5, "#9f9fd0")), () =>
      keyHint("TOP 10 BY LEVEL   ESC/Z: CLOSE", "TOP 10 BY LEVEL   ESC: CLOSE"),
    )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);

    for (let i = 0; i < MAX_RANKS; i++) {
      const y = ROWS_START + i * ROW_H;
      this.rankCells.push(
        scene.add
          .text(COL_RANK, y, `${i + 1}.`, retroStyle(6, "#9f9fd0"))
          .setOrigin(0, 0.5)
          .setScrollFactor(0)
          .setDepth(152)
          .setVisible(false),
      );
      this.nameCells.push(
        scene.add.text(COL_NAME, y, "", retroStyle(6, "#ffffff")).setOrigin(0, 0.5).setScrollFactor(0).setDepth(152).setVisible(false),
      );
      this.levelCells.push(
        scene.add.text(COL_LEVEL, y, "", retroStyle(6, "#ffffff")).setOrigin(0, 0.5).setScrollFactor(0).setDepth(152).setVisible(false),
      );
      this.arenaCells.push(
        scene.add.text(COL_ARENA, y, "", retroStyle(6, "#ffffff")).setOrigin(0, 0.5).setScrollFactor(0).setDepth(152).setVisible(false),
      );
      this.ngCells.push(
        scene.add.text(COL_NG, y, "", retroStyle(6, "#ffffff")).setOrigin(0, 0.5).setScrollFactor(0).setDepth(152).setVisible(false),
      );
      this.abyssCells.push(
        scene.add.text(COL_ABYSS, y, "", retroStyle(6, "#ffffff")).setOrigin(0, 0.5).setScrollFactor(0).setDepth(152).setVisible(false),
      );
      this.dateCells.push(
        scene.add.text(COL_DATE, y, "", retroStyle(6, "#ffffff")).setOrigin(0, 0.5).setScrollFactor(0).setDepth(152).setVisible(false),
      );
    }

    const kb = scene.input.keyboard!;
    this.keyEsc = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyZ = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    const queueClose = () => {
      this.closeQueued = true;
    };
    this.keyEsc.on(Phaser.Input.Keyboard.Events.DOWN, queueClose);
    this.keyZ.on(Phaser.Input.Keyboard.Events.DOWN, queueClose);
  }

  open(): void {
    this.active = true;
    // cleared here (not in the constructor) so the Z keydown that opens the
    // panel — same event also sets closeQueued — doesn't immediately close it
    this.closeQueued = false;
    this.dim.setVisible(true);
    this.panel.setVisible(true);
    this.title.setVisible(true);
    this.footer.setVisible(true);
    for (const t of this.headers) t.setVisible(true);
    for (const arr of this.cells()) {
      for (const t of arr) t.setVisible(true);
    }
    // The 10th row sits under the touch d-pad's arrows ("10." at x 100..172)
    // and Z (its date reaches x=1180). The board takes
    // no arrows, and ESC closes it as well as Z, so both go while it's up;
    // on a keyboard device nothing listens for this
    hideTouchButtons(this.scene, ["dpad", "z"]);
    this.refresh();
  }

  close(): void {
    this.active = false;
    hideTouchButtons(this.scene, []);
    this.dim.setVisible(false);
    this.panel.setVisible(false);
    this.title.setVisible(false);
    this.footer.setVisible(false);
    for (const t of this.headers) t.setVisible(false);
    for (const arr of this.cells()) {
      for (const t of arr) t.setVisible(false);
    }
  }

  isActive(): boolean {
    return this.active;
  }

  update(): void {
    if (!this.active || !this.closeQueued) return;
    this.closeQueued = false;
    this.close();
  }

  private cells(): Phaser.GameObjects.Text[][] {
    return [this.rankCells, this.nameCells, this.levelCells, this.arenaCells, this.ngCells, this.abyssCells, this.dateCells];
  }

  private refresh(): void {
    const ranks = getRanks();
    for (let i = 0; i < MAX_RANKS; i++) {
      const e = ranks[i];
      const isMe = !!e && e.name === GameState.player.name;
      this.rankCells[i].setColor(i === 0 && e ? "#ffd166" : isMe ? "#8ecbff" : e ? "#9f9fd0" : DIM_TEXT);
      if (e) {
        const color = isMe ? "#8ecbff" : "#ffffff";
        // the NAME column holds 12 glyphs (196..484); a row recorded from a
        // save code before load() cut names to 12 can carry a longer one
        this.nameCells[i].setText(e.name.slice(0, 12)).setColor(color);
        this.levelCells[i].setText(String(e.level)).setColor(color);
        // "-" for none yet, and for rows written before the board kept these
        this.arenaCells[i].setText(e.arena ? String(e.arena) : "-").setColor(e.arena ? color : DIM_TEXT);
        this.ngCells[i].setText(e.ng ? `+${e.ng}` : "-").setColor(e.ng ? color : DIM_TEXT);
        // the deepest floor, as the ABYSS names it (B1 is 1)
        this.abyssCells[i].setText(e.abyss ? `B${e.abyss}` : "-").setColor(e.abyss ? color : DIM_TEXT);
        this.dateCells[i].setText(e.date).setColor(color);
      } else {
        this.nameCells[i].setText("---").setColor(DIM_TEXT);
        for (const arr of [this.levelCells, this.arenaCells, this.ngCells, this.abyssCells, this.dateCells])
          arr[i].setText("").setColor(DIM_TEXT);
      }
    }
  }

  destroy(): void {
    this.dim.destroy();
    this.panel.destroy();
    this.title.destroy();
    this.footer.destroy();
    for (const t of this.headers) t.destroy();
    for (const arr of this.cells()) {
      for (const t of arr) t.destroy();
    }
    // keys are shared instances from kb.addKey (same keycode → same object);
    // destroying them would wipe other panels' listeners. Scene shutdown
    // already tears every Key down via KeyboardPlugin.removeAllKeys(true).
  }
}
