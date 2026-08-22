import Phaser from "phaser";
import { Sfx } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { GameState } from "../gameState";
import { CATCHABLE, ENEMIES } from "../monsters";
import { retroStyle, showToast } from "../pixelart";

const SPECIES = Object.values(ENEMIES);

// Two columns: one column of ten species needed a panel taller than the
// 720px screen, which cut off the title, the last row and the counter.
// ROW_GAP (and the icon scale with it) shrinks as more species are added, so
// the panel keeps fitting the screen instead of silently clipping again.
const COLS = 2;
const ROWS = Math.ceil(SPECIES.length / COLS);
const MAX_PANEL_H = GAME_HEIGHT - 40;
const ROW_GAP = Math.min(80, Math.floor((MAX_PANEL_H - 200) / ROWS));
const ICON_SCALE = (ROW_GAP / 80) * 0.9;
const PANEL_W = 1160;
const PANEL_H = 200 + ROWS * ROW_GAP;
const PANEL_TOP = GAME_HEIGHT / 2 - PANEL_H / 2;
const COL_W = 560;
// per column: icon, then the name far enough right to clear the widest sprite
const COL_X = GAME_WIDTH / 2 - PANEL_W / 2 + 40;
const ICON_DX = 30;
const NAME_DX = 80;

export class BestiaryUI {
  private scene: Phaser.Scene;
  private active = false;
  private allCaughtToastShown = false;

  private dim: Phaser.GameObjects.Rectangle;
  private panel: Phaser.GameObjects.Rectangle;
  private title: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;
  private counter: Phaser.GameObjects.Text;
  private icons: Phaser.GameObjects.Sprite[] = [];
  private rows: Phaser.GameObjects.Text[] = [];

  private keyEsc: Phaser.Input.Keyboard.Key;
  private keyB: Phaser.Input.Keyboard.Key;
  private closeQueued = false;

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
      .text(GAME_WIDTH / 2, PANEL_TOP + 44, "BESTIARY", retroStyle(8, "#ffd166"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    this.hint = scene.add
      .text(GAME_WIDTH / 2, PANEL_TOP + 84, "CLICK A CAUGHT MONSTER TO SET COMPANION", retroStyle(4, "#666666"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    this.counter = scene.add
      .text(GAME_WIDTH / 2, PANEL_TOP + PANEL_H - 44, "", retroStyle(6, "#8ecbff"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);

    const startY = PANEL_TOP + 130;
    SPECIES.forEach((def, i) => {
      const col = Math.floor(i / ROWS);
      const y = startY + (i % ROWS) * ROW_GAP;
      const x = COL_X + col * COL_W;
      const icon = scene.add
        .sprite(x + ICON_DX, y, def.texture)
        // the source art is a full 64px tile; 1.4x overlapped the rows above
        // and below it, so keep it just under the row gap
        .setScale(ICON_SCALE)
        .setScrollFactor(0)
        .setDepth(152)
        .setVisible(false);
      if (def.tint) icon.setTint(def.tint);
      this.icons.push(icon);
      const row = scene.add
        .text(x + NAME_DX, y, "???", retroStyle(6, "#666666"))
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(152)
        .setVisible(false);
      this.rows.push(row);

      // click a caught species to make it the battle companion; a click on
      // an unseen "???" row (still hit-testable — Text keeps its full box
      // even when showing the placeholder) is a no-op via the caught check
      const selectCompanion = () => {
        if (GameState.companion === def.name) return;
        if (!GameState.caught.includes(def.name)) {
          // seen-but-not-caught rows are clickable but did nothing here,
          // which looked identical to the click not registering at all
          Sfx.error();
          showToast(this.scene, "NOT CAUGHT YET");
          return;
        }
        GameState.companion = def.name;
        Sfx.buy();
        showToast(this.scene, `COMPANION: ${def.name}`);
        GameState.save();
        this.refresh();
      };
      icon.setInteractive({ useHandCursor: true }).on("pointerdown", selectCompanion);
      row.setInteractive({ useHandCursor: true }).on("pointerdown", selectCompanion);
    });

    const kb = scene.input.keyboard!;
    this.keyEsc = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyB = kb.addKey(Phaser.Input.Keyboard.KeyCodes.B);
    const queueClose = () => {
      this.closeQueued = true;
    };
    this.keyEsc.on(Phaser.Input.Keyboard.Events.DOWN, queueClose);
    this.keyB.on(Phaser.Input.Keyboard.Events.DOWN, queueClose);
  }

  open(): void {
    this.active = true;
    this.closeQueued = false;
    this.dim.setVisible(true);
    this.panel.setVisible(true);
    this.title.setVisible(true);
    this.hint.setVisible(true);
    this.counter.setVisible(true);
    for (const t of this.rows) t.setVisible(true);
    this.refresh();
  }

  close(): void {
    this.active = false;
    this.dim.setVisible(false);
    this.panel.setVisible(false);
    this.title.setVisible(false);
    this.hint.setVisible(false);
    this.counter.setVisible(false);
    for (const s of this.icons) s.setVisible(false);
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

  private refresh(): void {
    // CAUGHT is scored against CATCHABLE — bosses appear in the list but can
    // never be caught, so counting them would make 100% unreachable.
    const seen = SPECIES.filter((def) => GameState.seenMonsters.includes(def.name)).length;
    const caught = CATCHABLE.filter((def) => GameState.caught.includes(def.name)).length;
    const title = GameState.bestiaryTitle();
    const bonus = GameState.bestiaryBonus();
    this.counter.setText(
      `SEEN ${seen}/${SPECIES.length}  CAUGHT ${caught}/${CATCHABLE.length}${title ? `  RANK:${title}` : ""}\n` +
        `COMPLETION BONUS ATK+${bonus} DEF+${bonus}`,
    );
    if (caught === CATCHABLE.length && !this.allCaughtToastShown) {
      this.allCaughtToastShown = true;
      showToast(this.scene, "ALL CAUGHT! SEE THE ELDER");
    }
    SPECIES.forEach((def, i) => {
      const rowSeen = GameState.seenMonsters.includes(def.name);
      const rowCaught = GameState.caught.filter((n) => n === def.name).length;
      const isCompanion = rowCaught > 0 && def.name === GameState.companion;
      this.icons[i].setVisible(rowSeen);
      const weaknessHint = rowSeen && def.weakness ? `  WEAK:${def.weakness.toUpperCase()}` : "";
      this.rows[i].setText(
        rowSeen ? `${isCompanion ? "★ " : ""}${def.name}${rowCaught > 0 ? ` (x${rowCaught})` : ""}${weaknessHint}` : "???",
      );
      this.rows[i].setColor(!rowSeen ? "#666666" : isCompanion ? "#4ade80" : "#ffffff");
    });
  }

  destroy(): void {
    this.dim.destroy();
    this.panel.destroy();
    this.title.destroy();
    this.hint.destroy();
    this.counter.destroy();
    for (const s of this.icons) s.destroy();
    for (const t of this.rows) t.destroy();
    // keys are shared instances from kb.addKey (same keycode → same object);
    // destroying them would wipe other panels' listeners. Scene shutdown
    // already tears every Key down via KeyboardPlugin.removeAllKeys(true).
  }
}
