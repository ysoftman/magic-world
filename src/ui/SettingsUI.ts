import Phaser from "phaser";
import { Sfx } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { BATTLE_SPEEDS, GameState, TEXT_SPEEDS, TIME_SPEEDS } from "../gameState";
import { retroStyle, showToast } from "../pixelart";
import { isTouchDevice } from "./TouchControls";

// Ten retroStyle(6) rows (24px, Press Start 2P measures 1em) from
// PANEL_TOP+104 at a 36px pitch. The panel grew upward for the ninth (BATTLE
// SPEED) and is pinned by its bottom edge at y=588 rather than centred, so the
// rows and the touch clearance below them didn't have to shrink: it spans
// y=92..588 (just under the 88px HUD), the title runs 132..164 — low enough
// that a one-line toast on the HUD's y=100 row (to 126) can't clip it, the
// CLOSE chip beside it 126..170 — the rows 184..532 and the hint line
// (retroStyle(4), centred at PANEL_H-36) still sits
// at 544..560 — 12px above the d-pad's right arrow (TouchControls: centre
// 214,616 r44, top 572). With no room left above (the HUD) or below (the
// d-pad), the tenth (GUIDE ARROW) came out of the pitch: 40 would run the
// last row to 568, onto the hint, and 36 still leaves 12px between rows and
// 12px above the hint. Widest row
// "> BGM VOLUME: ##########  100%" is 30 x 24 = 720px, x=280..1000 inside the
// panel's 160..1120, clear of the d-pad (x<=258) and the touch menu (x>=1222).
const PANEL_W = 960;
const PANEL_H = 496;
const PANEL_TOP = 588 - PANEL_H;
const TITLE_Y = PANEL_TOP + 56;
const ROW_Y = PANEL_TOP + 104;
const ROW_GAP = 36;

const SPEED_LABELS: Record<number, string> = { 0.5: "SLOW", 1: "NORMAL", 2: "FAST" };
const TIME_SPEED_LABELS: Record<number, string> = { 1: "NORMAL", 5: "FAST", 20: "VERY FAST" };
const BATTLE_SPEED_LABELS: Record<number, string> = { 1: "NORMAL", 1.5: "FAST", 2: "FASTER" };
// the two actions stay last: Z activates any row from LABELS.length - 2 on
const LABELS = [
  "BGM VOLUME",
  "SFX VOLUME",
  "TEXT SPEED",
  "TIME SPEED",
  "BATTLE SPEED",
  "SCREEN SHAKE",
  "FLASHES",
  "GUIDE ARROW",
  "EXPORT SAVE",
  "IMPORT SAVE",
];
const TOGGLES: Record<number, "screenShake" | "flashes" | "guideArrow"> = { 5: "screenShake", 6: "flashes", 7: "guideArrow" };
// the stepped rows: which setting each adjusts and its allowed values
const SPEEDS: Record<number, { key: "textSpeed" | "timeSpeed" | "battleSpeed"; values: number[] }> = {
  2: { key: "textSpeed", values: TEXT_SPEEDS },
  3: { key: "timeSpeed", values: TIME_SPEEDS },
  4: { key: "battleSpeed", values: BATTLE_SPEEDS },
};

// Tappable CLOSE in the panel's top-right, level with the title. The title
// screen has no TouchControls (no ESC/Z buttons), so without it a touch player
// who opened SETTINGS there had no way back out. "CLOSE" is 5 x 20 = 100px;
// with 12px padding the chip is 124 x 44, x=972..1096, clear of the 256px
// title (x=512..768).
const CHIP_PAD = 12;
const CHIP_RIGHT = GAME_WIDTH / 2 + PANEL_W / 2 - 24;
// Touch has no Q, so a field scene's SETTINGS carries a QUIT chip in the
// top-left, mirroring CLOSE: the first tap turns it into "SURE?" (the chip is
// sized for that, 5 x 20 + 24 = 124px, x=184..308), the second closes the
// panel and hands over to the scene's own save-and-quit. Keyboards keep Q.
const CHIP_LEFT = GAME_WIDTH / 2 - PANEL_W / 2 + 24;

export class SettingsUI {
  private active = false;
  private row = 0;
  private closeQueued = false;

  private scene: Phaser.Scene;
  private dim: Phaser.GameObjects.Rectangle;
  private panel: Phaser.GameObjects.Rectangle;
  private title: Phaser.GameObjects.Text;
  private rows: Phaser.GameObjects.Text[] = [];
  private hint: Phaser.GameObjects.Text;
  private closeChip: Phaser.GameObjects.Container;
  private quitChip?: Phaser.GameObjects.Container;
  private quitText?: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, onQuit?: () => void) {
    this.scene = scene;
    this.dim = scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5)
      .setScrollFactor(0)
      .setDepth(150)
      .setVisible(false);
    this.panel = scene.add
      .rectangle(GAME_WIDTH / 2, PANEL_TOP + PANEL_H / 2, PANEL_W, PANEL_H, 0x0b0b2b, 0.95)
      .setScrollFactor(0)
      .setDepth(151)
      .setStrokeStyle(2, 0xffffff)
      .setVisible(false);
    this.title = scene.add
      .text(GAME_WIDTH / 2, TITLE_Y, "SETTINGS", retroStyle(8, "#ffd166"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    LABELS.forEach((_, i) => {
      const row = scene.add
        .text(GAME_WIDTH / 2, ROW_Y + i * ROW_GAP, "", retroStyle(6, "#f5f5f5"))
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(152)
        .setVisible(false);
      this.rows.push(row);
    });
    // The keyboard line (55 x 16 = 880px, x 200..1080, 40px inside the
    // panel's sides) runs under the touch d-pad's up arrow; the touch line is
    // 50 x 16 = 800px (x 240..1040), clear of it and of Z, and names the
    // d-pad rather than HJKL
    this.hint = scene.add
      .text(
        GAME_WIDTH / 2,
        PANEL_TOP + PANEL_H - 36,
        isTouchDevice() ? "D-PAD: SELECT/ADJUST   Z: APPLY/CLOSE   ESC: CLOSE" : "JK: SELECT   HL: ADJUST   Z: APPLY/CLOSE   ESC/O: CLOSE",
        retroStyle(4, "#8ecbff"),
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);

    const chipText = scene.add.text(0, 0, "CLOSE", retroStyle(5, "#8ecbff")).setOrigin(0.5);
    const chipW = chipText.width + CHIP_PAD * 2;
    const chipH = chipText.height + CHIP_PAD * 2;
    const chipBox = scene.add.rectangle(0, 0, chipW, chipH, 0x0b0b2b).setStrokeStyle(2, 0x8ecbff);
    this.closeChip = scene.add
      .container(CHIP_RIGHT - chipW / 2, TITLE_Y, [chipBox, chipText])
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false)
      .setSize(chipW, chipH)
      .setInteractive({ useHandCursor: true });
    // same queued close as ESC/O, so update() closes it on the next frame
    this.closeChip.on("pointerdown", () => {
      if (this.active) this.closeQueued = true;
    });

    if (onQuit && isTouchDevice()) {
      const quitText = scene.add.text(0, 0, "SURE?", retroStyle(5, "#ff8a8a")).setOrigin(0.5);
      const quitW = quitText.width + CHIP_PAD * 2;
      const quitH = quitText.height + CHIP_PAD * 2;
      const quitBox = scene.add.rectangle(0, 0, quitW, quitH, 0x0b0b2b).setStrokeStyle(2, 0xff8a8a);
      this.quitText = quitText.setText("QUIT");
      this.quitChip = scene.add
        .container(CHIP_LEFT + quitW / 2, TITLE_Y, [quitBox, quitText])
        .setScrollFactor(0)
        .setDepth(152)
        .setVisible(false)
        .setSize(quitW, quitH)
        .setInteractive({ useHandCursor: true });
      this.quitChip.on("pointerdown", () => {
        if (!this.active) return;
        if (quitText.text === "QUIT") {
          quitText.setText("SURE?");
          Sfx.error();
          return;
        }
        this.close();
        onQuit();
      });
    }

    const kb = scene.input.keyboard!;
    const up = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    const down = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    const left = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    const right = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    // vim-style aliases — same keys InventoryUI/BestiaryUI already use, and
    // the same shared-Key-instance-by-keycode setup they rely on
    const h = kb.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    const j = kb.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    const k = kb.addKey(Phaser.Input.Keyboard.KeyCodes.K);
    const l = kb.addKey(Phaser.Input.Keyboard.KeyCodes.L);
    const z = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    const esc = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    const o = kb.addKey(Phaser.Input.Keyboard.KeyCodes.O);
    const moveUp = () => this.moveRow(-1);
    const moveDown = () => this.moveRow(1);
    const adjustLeft = () => this.adjust(-1);
    const adjustRight = () => this.adjust(1);
    up.on(Phaser.Input.Keyboard.Events.DOWN, moveUp);
    k.on(Phaser.Input.Keyboard.Events.DOWN, moveUp);
    down.on(Phaser.Input.Keyboard.Events.DOWN, moveDown);
    j.on(Phaser.Input.Keyboard.Events.DOWN, moveDown);
    left.on(Phaser.Input.Keyboard.Events.DOWN, adjustLeft);
    h.on(Phaser.Input.Keyboard.Events.DOWN, adjustLeft);
    right.on(Phaser.Input.Keyboard.Events.DOWN, adjustRight);
    l.on(Phaser.Input.Keyboard.Events.DOWN, adjustRight);
    const queueClose = () => {
      if (this.active) this.closeQueued = true;
    };
    z.on(Phaser.Input.Keyboard.Events.DOWN, () => {
      if (!this.active) return;
      if (this.row >= LABELS.length - 2) this.activate();
      else this.closeQueued = true;
    });
    esc.on(Phaser.Input.Keyboard.Events.DOWN, queueClose);
    o.on(Phaser.Input.Keyboard.Events.DOWN, queueClose);
  }

  open(): void {
    this.active = true;
    this.closeQueued = false;
    this.row = 0;
    this.dim.setVisible(true);
    this.panel.setVisible(true);
    this.title.setVisible(true);
    this.hint.setVisible(true);
    this.closeChip.setVisible(true);
    this.quitChip?.setVisible(true);
    this.quitText?.setText("QUIT");
    for (const t of this.rows) t.setVisible(true);
    this.refresh();
  }

  close(): void {
    this.active = false;
    this.dim.setVisible(false);
    this.panel.setVisible(false);
    this.title.setVisible(false);
    this.hint.setVisible(false);
    this.closeChip.setVisible(false);
    this.quitChip?.setVisible(false);
    for (const t of this.rows) t.setVisible(false);
  }

  isActive(): boolean {
    return this.active;
  }

  update(): void {
    if (!this.active || !this.closeQueued) return;
    this.closeQueued = false;
    this.close();
  }

  destroy(): void {
    this.dim.destroy();
    this.panel.destroy();
    this.title.destroy();
    this.hint.destroy();
    this.closeChip.destroy();
    this.quitChip?.destroy();
    for (const t of this.rows) t.destroy();
  }

  private moveRow(dir: number): void {
    if (!this.active) return;
    this.row = (this.row + dir + LABELS.length) % LABELS.length;
    Sfx.move();
    this.refresh();
  }

  private adjust(dir: number): void {
    if (!this.active || this.row >= LABELS.length - 2) return;
    const toggle = TOGGLES[this.row];
    if (this.row === 0) this.setVolume("bgmVolume", GameState.bgmVolume + dir * 0.1);
    else if (this.row === 1) this.setVolume("sfxVolume", GameState.sfxVolume + dir * 0.1);
    else if (toggle) {
      // left is OFF, right is ON — stops at the end like the speeds below
      const next = dir > 0;
      if (next === GameState[toggle]) return;
      GameState[toggle] = next;
      GameState.saveSettings();
      Sfx.move();
    } else {
      // the speeds stop at their ends instead of wrapping, the way the volume
      // bars already clamp — pressing left at SLOW should stay at SLOW rather
      // than jump to FAST
      const { key, values: speeds } = SPEEDS[this.row];
      const i = Math.max(0, speeds.indexOf(GameState[key]));
      const next = speeds[Phaser.Math.Clamp(i + dir, 0, speeds.length - 1)];
      if (next === GameState[key]) return;
      GameState[key] = next;
      GameState.saveSettings();
      Sfx.move();
    }
    this.refresh();
  }

  private setVolume(key: "bgmVolume" | "sfxVolume", value: number): void {
    GameState[key] = Math.min(1, Math.max(0, Math.round(value * 10) / 10));
    GameState.saveSettings();
    Sfx.applyVolumes();
    Sfx.spark();
  }

  private activate(): void {
    if (this.row === LABELS.length - 2) this.exportSave();
    else this.importSave();
  }

  private exportSave(): void {
    const code = GameState.exportSaveCode();
    if (!code) {
      Sfx.error();
      showToast(this.scene, `NO SAVE IN SLOT ${GameState.saveSlot}`);
      return;
    }
    navigator.clipboard
      ?.writeText(code)
      .then(() => {
        Sfx.buy();
        showToast(this.scene, `SLOT ${GameState.saveSlot} CODE COPIED`);
      })
      .catch(() => {
        window.prompt(`SLOT ${GameState.saveSlot} CODE - COPY IT:`, code);
        Sfx.buy();
      });
  }

  private importSave(): void {
    // lands in the slot in use; what was there becomes the slot's backup,
    // which the title's U: RESTORE brings back
    const code = window.prompt(`PASTE A SAVE CODE INTO SLOT ${GameState.saveSlot}:`);
    if (!code) return;
    const result = GameState.importSaveCode(code);
    if (result !== "ok") {
      Sfx.error();
      // "STORAGE FULL - NOTHING CHANGED" is 30 x 20 = 600px
      showToast(this.scene, result === "invalid" ? "INVALID CODE" : "STORAGE FULL - NOTHING CHANGED");
      return;
    }
    Sfx.buy();
    showToast(this.scene, `SLOT ${GameState.saveSlot} IMPORTED - RELOADING`);
    // Reload instead of scene.start: every scene's SHUTDOWN handler saves the
    // in-memory state and would overwrite the code just imported
    this.scene.time.delayedCall(900, () => location.reload());
  }

  private refresh(): void {
    const bar = (v: number): string => {
      const n = Math.round(v * 10);
      return "#".repeat(n) + "-".repeat(10 - n);
    };
    const values = [
      `${bar(GameState.bgmVolume)}  ${Math.round(GameState.bgmVolume * 100)}%`,
      `${bar(GameState.sfxVolume)}  ${Math.round(GameState.sfxVolume * 100)}%`,
      SPEED_LABELS[GameState.textSpeed] ?? "NORMAL",
      TIME_SPEED_LABELS[GameState.timeSpeed] ?? "NORMAL",
      BATTLE_SPEED_LABELS[GameState.battleSpeed] ?? "NORMAL",
      GameState.screenShake ? "ON" : "OFF",
      GameState.flashes ? "ON" : "OFF",
      GameState.guideArrow ? "ON" : "OFF",
      "",
      "",
    ];
    LABELS.forEach((label, i) => {
      const selected = i === this.row;
      const value = values[i] ? `: ${values[i]}` : "";
      // the save actions name the slot they act on: "> IMPORT SAVE (SLOT 3)"
      // is 22 x 24 = 528px, inside the widest row's 720
      const slot = i >= LABELS.length - 2 ? ` (SLOT ${GameState.saveSlot})` : "";
      this.rows[i].setText(`${selected ? "> " : ""}${label}${slot}${value}`);
      this.rows[i].setColor(selected ? "#ffd166" : "#f5f5f5");
    });
  }
}
