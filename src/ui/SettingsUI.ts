import Phaser from "phaser";
import { Sfx } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { GameState, TEXT_SPEEDS, TIME_SPEEDS } from "../gameState";
import { retroStyle, showToast } from "../pixelart";

const PANEL_W = 960;
const PANEL_H = 404;
const PANEL_TOP = GAME_HEIGHT / 2 - PANEL_H / 2;
const ROW_GAP = 44;

const SPEED_LABELS: Record<number, string> = { 0.5: "SLOW", 1: "NORMAL", 2: "FAST" };
const TIME_SPEED_LABELS: Record<number, string> = { 1: "NORMAL", 5: "FAST", 20: "VERY FAST" };
const LABELS = ["BGM VOLUME", "SFX VOLUME", "TEXT SPEED", "TIME SPEED", "EXPORT SAVE", "IMPORT SAVE"];

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

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.dim = scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5)
      .setScrollFactor(0)
      .setDepth(150)
      .setVisible(false);
    this.panel = scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, PANEL_W, PANEL_H, 0x0b0b2b, 0.95)
      .setScrollFactor(0)
      .setDepth(151)
      .setStrokeStyle(2, 0xffffff)
      .setVisible(false);
    this.title = scene.add
      .text(GAME_WIDTH / 2, PANEL_TOP + 44, "SETTINGS", retroStyle(8, "#ffd166"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    LABELS.forEach((_, i) => {
      const row = scene.add
        .text(GAME_WIDTH / 2, PANEL_TOP + 120 + i * ROW_GAP, "", retroStyle(6, "#f5f5f5"))
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(152)
        .setVisible(false);
      this.rows.push(row);
    });
    this.hint = scene.add
      .text(
        GAME_WIDTH / 2,
        PANEL_TOP + PANEL_H - 36,
        "ARROWS/HJKL: SELECT/ADJUST   Z: APPLY/CLOSE   ESC/O: CLOSE",
        retroStyle(4, "#8ecbff"),
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);

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
    for (const t of this.rows) t.setVisible(true);
    this.refresh();
  }

  close(): void {
    this.active = false;
    this.dim.setVisible(false);
    this.panel.setVisible(false);
    this.title.setVisible(false);
    this.hint.setVisible(false);
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
    if (this.row === 0) this.setVolume("bgmVolume", GameState.bgmVolume + dir * 0.1);
    else if (this.row === 1) this.setVolume("sfxVolume", GameState.sfxVolume + dir * 0.1);
    else if (this.row === 2) {
      const i = TEXT_SPEEDS.indexOf(GameState.textSpeed);
      GameState.textSpeed = TEXT_SPEEDS[(i + dir + TEXT_SPEEDS.length) % TEXT_SPEEDS.length];
      GameState.saveSettings();
      Sfx.move();
    } else {
      const i = TIME_SPEEDS.indexOf(GameState.timeSpeed);
      GameState.timeSpeed = TIME_SPEEDS[(i + dir + TIME_SPEEDS.length) % TIME_SPEEDS.length];
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
      showToast(this.scene, "NO SAVE TO EXPORT");
      return;
    }
    navigator.clipboard
      ?.writeText(code)
      .then(() => {
        Sfx.buy();
        showToast(this.scene, "SAVE CODE COPIED");
      })
      .catch(() => {
        window.prompt("COPY THIS CODE:", code);
        Sfx.buy();
      });
  }

  private importSave(): void {
    const code = window.prompt("PASTE SAVE CODE:");
    if (!code) return;
    if (!GameState.importSaveCode(code)) {
      Sfx.error();
      showToast(this.scene, "INVALID CODE");
      return;
    }
    Sfx.buy();
    showToast(this.scene, "SAVE IMPORTED - RELOADING");
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
      "",
      "",
    ];
    LABELS.forEach((label, i) => {
      const selected = i === this.row;
      const value = values[i] ? `: ${values[i]}` : "";
      this.rows[i].setText(`${selected ? "> " : ""}${label}${value}`);
      this.rows[i].setColor(selected ? "#ffd166" : "#f5f5f5");
    });
  }
}
