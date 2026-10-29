import Phaser from "phaser";
import { Sfx } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { BATTLE_SPEEDS, GameState, TEXT_SPEEDS, TIME_SPEEDS } from "../gameState";
import { DIM_TEXT, retroStyle, showToast } from "../pixelart";
import type { PixelText } from "../pixelText";
import { bindKeyHint, keyHint } from "./Gamepad";
import { isTouchDevice } from "./TouchControls";

// Eleven retroStyle(6) rows (24px, Press Start 2P measures 1em) from
// PANEL_TOP+98 at a 33px pitch. The panel grew upward for the ninth (BATTLE
// SPEED) and is pinned by its bottom edge at y=588 rather than centred, so the
// rows and the touch clearance below them didn't have to shrink: it spans
// y=92..588 (just under the 88px HUD), the title runs 132..164 — low enough
// that a one-line toast on the HUD's y=100 row (to 126) can't clip it, the
// CLOSE chip beside it 126..170 — the rows 178..532 and the hint line
// (retroStyle(4), centred at PANEL_H-36) still sits
// at 544..560 — 12px above the d-pad's right arrow (TouchControls: centre
// 214,616 r44, top 572). With no room left above (the HUD) or below (the
// d-pad), the tenth (GUIDE ARROW) came out of the pitch (40 to 36) and the
// eleventh (FULLSCREEN) did again: 33 keeps 12px above the hint and 8 under
// the CLOSE chip, and leaves 9 between rows. Widest row
// "> BGM VOLUME: ##########  100%" is 30 x 24 = 720px, x=280..1000, and on
// touch "< BGM VOLUME: ##########  100% >" is 32 x 24 = 768px, x=256..1024:
// inside the panel's 160..1120, clear of the touch menu (x>=1222), and far
// above the d-pad (x<=258 from y=508).
const PANEL_W = 960;
const PANEL_H = 496;
const PANEL_TOP = 588 - PANEL_H;
const TITLE_Y = PANEL_TOP + 56;
const ROW_Y = PANEL_TOP + 98;
const ROW_GAP = 33;
// the rows' tap zone: as wide as the widest touch row, a full pitch per row
const ROWS_TOP = ROW_Y - ROW_GAP / 2;
const ROWS_HIT_W = 768;

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
  "FULLSCREEN",
  "EXPORT SAVE",
  "IMPORT SAVE",
];
const TOGGLES: Record<number, "screenShake" | "flashes" | "guideArrow"> = { 5: "screenShake", 6: "flashes", 7: "guideArrow" };
// The browser's state rather than a saved setting: it shows what the screen
// is now, and ESC leaving fullscreen flips it back through LEAVE_FULLSCREEN
const FULLSCREEN_ROW = 8;
// iPhone Safari has no element fullscreen (only a <video>'s), and an iframe
// without allow="fullscreen" turns it off; the row reads N/A there
const fullscreenSupported = (scale: Phaser.Scale.ScaleManager): boolean =>
  scale.fullscreen.available && document.fullscreenEnabled !== false;
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
  private title: PixelText;
  private rows: PixelText[] = [];
  private rowsHit: Phaser.GameObjects.Zone;
  private hint: PixelText;
  private closeChip: Phaser.GameObjects.Container;
  private quitChip?: Phaser.GameObjects.Container;
  private quitText?: PixelText;
  private offFullscreen: () => void;

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
      .pixelText(GAME_WIDTH / 2, TITLE_Y, "SETTINGS", retroStyle(8, "#ffd166"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    LABELS.forEach((_, i) => {
      const row = scene.add
        .pixelText(GAME_WIDTH / 2, ROW_Y + i * ROW_GAP, "", retroStyle(6, "#f5f5f5"))
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(152)
        .setVisible(false);
      this.rows.push(row);
    });
    // The keyboard line (55 x 16 = 880px, x 200..1080, 40px inside the
    // panel's sides) runs under the touch d-pad's up arrow; the touch line is
    // 39 x 16 = 624px (x 328..952), clear of it and of Z. It names taps, not
    // the d-pad: the title opens SETTINGS too and has no TouchControls. A
    // pad's line is 57 (912px, x 184..1096); on a touch screen it leaves out
    // START (O) for 51 (x 232..1048), between the up arrow and Z.
    this.hint = bindKeyHint(scene.add.pixelText(GAME_WIDTH / 2, PANEL_TOP + PANEL_H - 36, "", retroStyle(4, "#8ecbff")), () =>
      keyHint("JK: SELECT   HL: ADJUST   Z: APPLY/CLOSE   ESC/O: CLOSE", "TAP: TOGGLE/APPLY   TAP LEFT/RIGHT: -/+", {
        pad: `JK: SELECT   HL: ADJUST   Z: APPLY/CLOSE   ${isTouchDevice() ? "ESC" : "ESC/O"}: CLOSE`,
      }),
    )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);

    const chipText = scene.add.pixelText(0, 0, "CLOSE", retroStyle(5, "#8ecbff")).setOrigin(0.5);
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
      const quitText = scene.add.pixelText(0, 0, "SURE?", retroStyle(5, "#ff8a8a")).setOrigin(0.5);
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

    // Every row takes a tap or click, the title's touch player's only way to
    // change one (no d-pad there). One zone over all the rows, a full pitch
    // each so the 9px gaps count too (y 173..537, under the chips' 170 and
    // above the hint's 544; x 256..1024, clear of the d-pad's up arrow at
    // x<=194 and of Z at x>=1076). It reads a tap by row, and a stepped row
    // by half like the pagers (BestiaryUI): see tapRow. On pointerup: asking
    // for fullscreen needs the browser's user activation, a touch only grants
    // it at touchend, and the d-pad sends its key from pointerdown, so a tap
    // on the FULLSCREEN row itself is the one touch input sure to work there.
    this.rowsHit = scene.add
      .zone(GAME_WIDTH / 2, ROWS_TOP + (LABELS.length * ROW_GAP) / 2, ROWS_HIT_W, LABELS.length * ROW_GAP)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (p: Phaser.Input.Pointer) => {
        if (!this.active) return;
        const i = Math.min(LABELS.length - 1, Math.floor((p.y - ROWS_TOP) / ROW_GAP));
        this.tapRow(i, p.x < GAME_WIDTH / 2 ? -1 : 1);
      });
    // the ScaleManager is the game's, so it outlives this scene's rows
    const onFullscreenChange = () => {
      if (this.active) this.refresh();
    };
    scene.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, onFullscreenChange);
    scene.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, onFullscreenChange);
    this.offFullscreen = () => {
      scene.scale.off(Phaser.Scale.Events.ENTER_FULLSCREEN, onFullscreenChange);
      scene.scale.off(Phaser.Scale.Events.LEAVE_FULLSCREEN, onFullscreenChange);
    };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.offFullscreen);

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
    this.rowsHit.setVisible(true);
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
    // hidden, it is no hit target: the title reads a tap that hits nothing as ENTER
    this.rowsHit.setVisible(false);
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
    this.offFullscreen();
    this.dim.destroy();
    this.panel.destroy();
    this.title.destroy();
    this.hint.destroy();
    this.closeChip.destroy();
    this.quitChip?.destroy();
    for (const t of this.rows) t.destroy();
    this.rowsHit.destroy();
  }

  // A tap selects the row and works it in one go (a tap that only selected
  // would be a wasted one): a stepped row goes the way of the half it hit,
  // an ON/OFF row flips — a tap on its value always changes it — and a save
  // row runs.
  private tapRow(i: number, half: number): void {
    this.row = i;
    this.refresh();
    if (i >= LABELS.length - 2) this.activate();
    else if (i === FULLSCREEN_ROW) this.adjust(this.scene.scale.isFullscreen ? -1 : 1);
    else if (TOGGLES[i]) this.adjust(GameState[TOGGLES[i]] ? -1 : 1);
    else this.adjust(half);
  }

  private moveRow(dir: number): void {
    if (!this.active) return;
    this.row = (this.row + dir + LABELS.length) % LABELS.length;
    Sfx.move();
    this.refresh();
  }

  private adjust(dir: number): void {
    if (!this.active || this.row >= LABELS.length - 2) return;
    if (this.row === FULLSCREEN_ROW) {
      // left is OFF, right is ON like the toggles; the row redraws on the
      // ENTER/LEAVE_FULLSCREEN that follows
      this.setFullscreen(dir > 0);
      return;
    }
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

  private setFullscreen(on: boolean): void {
    const scale = this.scene.scale;
    if (!fullscreenSupported(scale)) {
      Sfx.error();
      return;
    }
    if (on === scale.isFullscreen) return;
    if (!on) {
      scale.stopFullscreen();
      Sfx.move();
      return;
    }
    const refused = () => {
      Sfx.error();
      showToast(this.scene, "CLICK OR TAP FULLSCREEN");
    };
    // A pad button is no user activation, nor is the d-pad's key once the
    // last touchend is a few seconds old; asking then would only be refused
    if (navigator.userActivation?.isActive === false) {
      refused();
      return;
    }
    // The page's root goes fullscreen, not Phaser's startFullscreen(): that
    // one sends a wrapper div (black backdrop around the game instead of the
    // page's navy) and drops requestFullscreen's promise, so a refusal is an
    // uncaught rejection, and FULLSCREEN_FAILED never fires (4.2.1:
    // fullscreenErrorHandler has no caller). The ScaleManager still follows
    // the root through fullscreenchange: isFullscreen, the refit, the events.
    // fullscreen.request is the method name this browser has, maybe prefixed.
    const root = document.documentElement as unknown as Record<string, (options: FullscreenOptions) => Promise<void> | undefined>;
    Promise.resolve(root[scale.fullscreen.request]({ navigationUI: "hide" })).then(() => Sfx.move(), refused);
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
    // Reload instead of scene.start, and at once, with the scene paused until
    // the page goes: the memory still holds the old save, and every scene's
    // SHUTDOWN handler, CTRL+S and a season's turn write it to the slot. A
    // 900ms wait for an IMPORTED toast left room for that, and a scene change
    // in it dropped the timer, so the code was lost though the toast said
    // IMPORTED. The paused scene has no update or keys while the old page
    // waits for the new one; the reload itself is the confirmation.
    this.scene.scene.pause();
    location.reload();
  }

  private refresh(): void {
    const bar = (v: number): string => {
      const n = Math.round(v * 10);
      return "#".repeat(n) + "-".repeat(10 - n);
    };
    const fullscreenOk = fullscreenSupported(this.scene.scale);
    const touch = isTouchDevice();
    const values = [
      `${bar(GameState.bgmVolume)}  ${Math.round(GameState.bgmVolume * 100)}%`,
      `${bar(GameState.sfxVolume)}  ${Math.round(GameState.sfxVolume * 100)}%`,
      SPEED_LABELS[GameState.textSpeed] ?? "NORMAL",
      TIME_SPEED_LABELS[GameState.timeSpeed] ?? "NORMAL",
      BATTLE_SPEED_LABELS[GameState.battleSpeed] ?? "NORMAL",
      GameState.screenShake ? "ON" : "OFF",
      GameState.flashes ? "ON" : "OFF",
      GameState.guideArrow ? "ON" : "OFF",
      fullscreenOk ? (this.scene.scale.isFullscreen ? "ON" : "OFF") : "N/A",
      "",
      "",
    ];
    LABELS.forEach((label, i) => {
      const selected = i === this.row;
      const value = values[i] ? `: ${values[i]}` : "";
      // the save actions name the slot they act on: "> IMPORT SAVE (SLOT 3)"
      // is 22 x 24 = 528px, inside the widest row's 720
      const slot = i >= LABELS.length - 2 ? ` (SLOT ${GameState.saveSlot})` : "";
      const text = `${label}${slot}${value}`;
      // on touch a stepped row (volumes, speeds) under the cursor wears the
      // pagers' "< >" in place of "> ": the halves a tap steps it by
      const stepped = i < 2 || i in SPEEDS;
      this.rows[i].setText(!selected ? text : touch && stepped ? `< ${text} >` : `> ${text}`);
      // N/A stays greyed even under the cursor; the "> " still marks it
      const dimmed = i === FULLSCREEN_ROW && !fullscreenOk;
      this.rows[i].setColor(dimmed ? DIM_TEXT : selected ? "#ffd166" : "#f5f5f5");
    });
  }
}
