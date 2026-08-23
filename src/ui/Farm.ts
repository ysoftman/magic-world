import Phaser from "phaser";
import { Sfx } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { CROPS, type CropKey, FARM_PLOTS, GameState } from "../gameState";
import { retroStyle } from "../pixelart";

// wide enough for the longest line it draws: the ESC/TAB hint at
// retroStyle(4) (52 chars x 16px = 832px) plus a margin either side —
// Press Start 2P is fixed-width, one em per character
const PANEL_W = 900;
const PANEL_H = 400;
const PANEL_TOP = GAME_HEIGHT / 2 - PANEL_H / 2;
const ROW_X = GAME_WIDTH / 2 - PANEL_W / 2 + 70;
const ROW_GAP = 46;

const CROP_KEYS = Object.keys(CROPS) as CropKey[];

// remaining growth as H/M, the same unit the in-game clock shows
const remainText = (minutes: number): string => `${Math.floor(minutes / 60)}H${String(Math.floor(minutes % 60)).padStart(2, "0")}M`;

export class FarmUI {
  private scene: Phaser.Scene;
  private active = false;
  private dirty = false;
  private index = 0;
  private seed: CropKey = "corn";

  private dim: Phaser.GameObjects.Rectangle;
  private panel: Phaser.GameObjects.Rectangle;
  private title: Phaser.GameObjects.Text;
  private goldText: Phaser.GameObjects.Text;
  private seedText: Phaser.GameObjects.Text;
  private rows: Phaser.GameObjects.Text[] = [];
  private cursor: Phaser.GameObjects.Text;
  private msg: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;
  private msgTimer?: Phaser.Time.TimerEvent;

  private upQueued = false;
  private downQueued = false;
  private zQueued = false;
  private tabQueued = false;
  private escQueued = false;

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
      .text(GAME_WIDTH / 2, PANEL_TOP + 40, "FARM", retroStyle(8, "#a3e635"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    this.goldText = scene.add
      .text(GAME_WIDTH / 2 + PANEL_W / 2 - 30, PANEL_TOP + 40, "", retroStyle(6, "#8ecbff"))
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    this.seedText = scene.add
      .text(ROW_X - 30, PANEL_TOP + 90, "", retroStyle(5, "#ffd166"))
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);

    for (let i = 0; i < FARM_PLOTS; i++) {
      this.rows.push(
        scene.add
          .text(ROW_X, PANEL_TOP + 140 + i * ROW_GAP, "", retroStyle(6, "#ffffff"))
          .setOrigin(0, 0.5)
          .setScrollFactor(0)
          .setDepth(152)
          .setVisible(false),
      );
    }
    this.cursor = scene.add.text(0, 0, ">", retroStyle(6, "#ffd166")).setOrigin(0.5).setScrollFactor(0).setDepth(152).setVisible(false);

    this.msg = scene.add
      .text(GAME_WIDTH / 2, PANEL_TOP + PANEL_H - 56, "", retroStyle(6, "#f5f5f5"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false)
      .setWordWrapWidth(PANEL_W - 60, true)
      .setAlign("center");
    this.hint = scene.add
      .text(GAME_WIDTH / 2, PANEL_TOP + PANEL_H - 22, "JK: MOVE   Z: PLANT/HARVEST   TAB: SEED   ESC: CLOSE", retroStyle(4, "#666666"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);

    const kb = scene.input.keyboard!;
    const DOWN = Phaser.Input.Keyboard.Events.DOWN;
    const on = (code: number, flag: "upQueued" | "downQueued" | "zQueued" | "tabQueued" | "escQueued") => {
      kb.addKey(code).on(DOWN, () => {
        this[flag] = true;
      });
    };
    const K = Phaser.Input.Keyboard.KeyCodes;
    on(K.UP, "upQueued");
    on(K.K, "upQueued");
    on(K.DOWN, "downQueued");
    on(K.J, "downQueued");
    on(K.Z, "zQueued");
    on(K.TAB, "tabQueued");
    on(K.ESC, "escQueued");
  }

  open(): void {
    this.active = true;
    this.dirty = false;
    this.index = 0;
    this.upQueued = false;
    this.downQueued = false;
    this.zQueued = false;
    this.tabQueued = false;
    this.escQueued = false;
    this.dim.setVisible(true);
    this.panel.setVisible(true);
    this.title.setVisible(true);
    this.goldText.setVisible(true);
    this.seedText.setVisible(true);
    this.msg.setVisible(true);
    this.hint.setVisible(true);
    this.cursor.setVisible(true);
    for (const r of this.rows) r.setVisible(true);
    this.refresh();
  }

  isActive(): boolean {
    return this.active;
  }

  update(): void {
    if (!this.active) return;
    if (this.escQueued) {
      this.escQueued = false;
      this.close();
      return;
    }
    if (this.tabQueued) {
      this.tabQueued = false;
      this.seed = CROP_KEYS[(CROP_KEYS.indexOf(this.seed) + 1) % CROP_KEYS.length];
      Sfx.move();
    }
    const prev = this.index;
    if (this.upQueued) {
      this.upQueued = false;
      this.index = (this.index + FARM_PLOTS - 1) % FARM_PLOTS;
    }
    if (this.downQueued) {
      this.downQueued = false;
      this.index = (this.index + 1) % FARM_PLOTS;
    }
    if (this.index !== prev) Sfx.move();
    if (this.zQueued) {
      this.zQueued = false;
      this.act();
    }
    // crops keep growing while the panel is open, so the countdown is redrawn
    // every frame (Phaser's setText skips unchanged strings)
    this.refresh();
  }

  private act(): void {
    const plot = GameState.farm[this.index];
    if (!plot) {
      const def = CROPS[this.seed];
      if (GameState.gold < def.seed) {
        Sfx.error();
        this.showMsg("Not enough gold!");
        return;
      }
      GameState.gold -= def.seed;
      GameState.farm[this.index] = { crop: this.seed, plantedAt: GameState.minutes };
      this.dirty = true;
      Sfx.buy();
      this.showMsg(`${def.name} planted!`);
      return;
    }
    const def = CROPS[plot.crop];
    const left = def.grow - (GameState.minutes - plot.plantedAt);
    if (left > 0) {
      Sfx.error();
      this.showMsg(`Still growing: ${remainText(left)}`);
      return;
    }
    // gainGold()'s return value, not the raw roll, so the message never
    // overstates what was actually credited near the gold cap
    const gold = GameState.gainGold(Phaser.Math.Between(def.min, def.max));
    GameState.farm[this.index] = null;
    GameState.cropsHarvested += 1;
    this.dirty = true;
    Sfx.pickup();
    this.showMsg(`Harvested ${def.name}!  +${gold}G`);
  }

  private showMsg(text: string): void {
    this.msgTimer?.remove();
    this.msg.setText(text);
    this.msgTimer = this.scene.time.addEvent({
      delay: 1200,
      callback: () => this.msg.setText(""),
    });
  }

  private refresh(): void {
    this.goldText.setText(`G ${GameState.gold}`);
    const seedDef = CROPS[this.seed];
    this.seedText.setText(`SEED: ${seedDef.name}  ${seedDef.seed}G -> ${seedDef.min}-${seedDef.max}G / ${remainText(seedDef.grow)}`);
    for (let i = 0; i < FARM_PLOTS; i++) {
      const plot = GameState.farm[i];
      if (!plot) {
        this.rows[i].setText(`PLOT ${i + 1}  EMPTY`).setColor("#666666");
        continue;
      }
      const def = CROPS[plot.crop];
      const left = def.grow - (GameState.minutes - plot.plantedAt);
      if (left > 0) {
        this.rows[i].setText(`PLOT ${i + 1}  ${def.name}  ${remainText(left)} LEFT`).setColor("#ffffff");
      } else {
        this.rows[i].setText(`PLOT ${i + 1}  ${def.name}  READY!`).setColor("#a3e635");
      }
    }
    const target = this.rows[this.index];
    this.cursor.setPosition(target.x - 26, target.y);
  }

  private close(): void {
    this.active = false;
    this.dim.setVisible(false);
    this.panel.setVisible(false);
    this.title.setVisible(false);
    this.goldText.setVisible(false);
    this.seedText.setVisible(false);
    this.msg.setVisible(false);
    this.msg.setText("");
    this.hint.setVisible(false);
    this.cursor.setVisible(false);
    for (const r of this.rows) r.setVisible(false);
    this.msgTimer?.remove();
    if (this.dirty) GameState.save();
  }

  destroy(): void {
    this.dim.destroy();
    this.panel.destroy();
    this.title.destroy();
    this.goldText.destroy();
    this.seedText.destroy();
    this.msg.destroy();
    this.hint.destroy();
    this.cursor.destroy();
    for (const r of this.rows) r.destroy();
    this.msgTimer?.remove();
    // keys are shared kb.addKey instances; scene shutdown tears them down
  }
}
