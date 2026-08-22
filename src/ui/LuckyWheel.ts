import Phaser from "phaser";
import { Sfx } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { GameState } from "../gameState";
import { retroStyle } from "../pixelart";

const PANEL_W = 460;
const PANEL_H = 420;
const PANEL_TOP = GAME_HEIGHT / 2 - PANEL_H / 2;
const ROW_GAP = 48;
const SPIN_HOLD = 800;
const SPIN_TICK = 90;
const RESULT_HOLD = 1400;

const WAGER_TIERS = [10, 50, 200, 1000];

interface WheelOutcome {
  name: string;
  mult: number;
  chance: number;
}

// break-even by design (0*.4 + 1*.35 + 2*.2 + 5*.05 = 1.0x wager on average) —
// a real, frequent (40%) chance to lose the whole wager, not a disguised
// gold farm. Chances must sum to exactly 1 (same roll shape as FISH_TABLE).
const WHEEL_TABLE: WheelOutcome[] = [
  { name: "BUST", mult: 0, chance: 0.4 },
  { name: "REFUND", mult: 1, chance: 0.35 },
  { name: "DOUBLE", mult: 2, chance: 0.2 },
  { name: "JACKPOT", mult: 5, chance: 0.05 },
];

type WheelState = "select" | "spinning" | "result";

export class LuckyWheel {
  private scene: Phaser.Scene;
  private active = false;
  private dirty = false;
  private index = 0;
  private state: WheelState = "select";
  private wager = 0;
  private spinUntil = 0;
  private nextTick = 0;
  private resultUntil = 0;

  private dim: Phaser.GameObjects.Rectangle;
  private panel: Phaser.GameObjects.Rectangle;
  private title: Phaser.GameObjects.Text;
  private goldText: Phaser.GameObjects.Text;
  private rows: Phaser.GameObjects.Text[] = [];
  private cursor: Phaser.GameObjects.Text;
  private status: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;

  private keyUp: Phaser.Input.Keyboard.Key;
  private keyDown: Phaser.Input.Keyboard.Key;
  private keyJ: Phaser.Input.Keyboard.Key;
  private keyK: Phaser.Input.Keyboard.Key;
  private keyZ: Phaser.Input.Keyboard.Key;
  private keyEsc: Phaser.Input.Keyboard.Key;

  private upQueued = false;
  private downQueued = false;
  private zQueued = false;
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
      .text(GAME_WIDTH / 2, PANEL_TOP + 36, "LUCKY WHEEL", retroStyle(8, "#f472b6"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    // own line below the title, not beside it — "LUCKY WHEEL" at retroStyle(8)
    // runs wide enough to collide with a same-row gold readout
    this.goldText = scene.add
      .text(GAME_WIDTH / 2, PANEL_TOP + 74, "G 0", retroStyle(6, "#8ecbff"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);

    const startY = PANEL_TOP + 130;
    const rowX = GAME_WIDTH / 2 - 70;
    WAGER_TIERS.forEach((_tier, i) => {
      this.rows.push(
        scene.add
          .text(rowX, startY + i * ROW_GAP, "", retroStyle(6, "#ffffff"))
          .setOrigin(0, 0.5)
          .setScrollFactor(0)
          .setDepth(152)
          .setVisible(false),
      );
    });
    this.cursor = scene.add.text(0, 0, ">", retroStyle(6, "#ffd166")).setOrigin(0.5).setScrollFactor(0).setDepth(152).setVisible(false);
    this.status = scene.add
      .text(GAME_WIDTH / 2, PANEL_TOP + 330, "", retroStyle(6, "#f5f5f5"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false)
      // some result/idle lines run wider than the panel — wrap instead of
      // spilling past the border, same fix as Fishing.ts's status text
      .setWordWrapWidth(PANEL_W - 40, true)
      .setAlign("center");
    // only UP/DOWN/J/K are bound below — this is a single column, not a
    // grid, so no H/L to advertise
    this.hint = scene.add
      .text(GAME_WIDTH / 2, PANEL_TOP + PANEL_H - 30, "J/K: MOVE   Z: SPIN   ESC: CLOSE", retroStyle(4, "#666666"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);

    const kb = scene.input.keyboard!;
    this.keyUp = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyDown = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.keyJ = kb.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.keyK = kb.addKey(Phaser.Input.Keyboard.KeyCodes.K);
    this.keyZ = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.keyEsc = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    const DOWN = Phaser.Input.Keyboard.Events.DOWN;
    this.keyUp.on(DOWN, () => {
      this.upQueued = true;
    });
    this.keyK.on(DOWN, () => {
      this.upQueued = true;
    });
    this.keyDown.on(DOWN, () => {
      this.downQueued = true;
    });
    this.keyJ.on(DOWN, () => {
      this.downQueued = true;
    });
    this.keyZ.on(DOWN, () => {
      this.zQueued = true;
    });
    this.keyEsc.on(DOWN, () => {
      this.escQueued = true;
    });
  }

  open(): void {
    this.active = true;
    this.dirty = false;
    this.index = 0;
    this.state = "select";
    this.upQueued = false;
    this.downQueued = false;
    this.zQueued = false;
    this.escQueued = false;
    this.dim.setVisible(true);
    this.panel.setVisible(true);
    this.title.setVisible(true);
    this.goldText.setVisible(true);
    for (const t of this.rows) t.setVisible(true);
    this.cursor.setVisible(true);
    this.status.setVisible(true);
    this.hint.setVisible(true);
    this.status.setText("PICK A WAGER AND SPIN!");
    this.refresh();
  }

  isActive(): boolean {
    return this.active;
  }

  update(): void {
    if (!this.active) return;
    // ESC is swallowed mid-spin — the wager is already deducted, and closing
    // before resolve() ran would forfeit it with no payout and no message
    if (this.escQueued) {
      this.escQueued = false;
      if (this.state !== "spinning") this.close();
      return;
    }
    const now = this.scene.time.now;
    if (this.state === "select") {
      const prev = this.index;
      if (this.upQueued) {
        this.upQueued = false;
        this.index = (this.index + WAGER_TIERS.length - 1) % WAGER_TIERS.length;
      }
      if (this.downQueued) {
        this.downQueued = false;
        this.index = (this.index + 1) % WAGER_TIERS.length;
      }
      if (this.index !== prev) {
        Sfx.move();
        this.renderCursor();
      }
      if (this.zQueued) {
        this.zQueued = false;
        this.spin();
      }
    } else if (this.state === "spinning") {
      this.upQueued = false;
      this.downQueued = false;
      this.zQueued = false;
      if (now >= this.nextTick) {
        this.nextTick = now + SPIN_TICK;
        const flash = WHEEL_TABLE[Math.floor(Math.random() * WHEEL_TABLE.length)];
        this.status.setText(`${flash.name}...`);
      }
      if (now >= this.spinUntil) this.resolve();
    } else if (this.state === "result") {
      this.upQueued = false;
      this.downQueued = false;
      this.zQueued = false;
      if (now >= this.resultUntil) {
        this.state = "select";
        this.status.setText("PICK A WAGER AND SPIN!");
        this.refresh();
      }
    }
  }

  private spin(): void {
    const tier = WAGER_TIERS[this.index];
    if (GameState.gold < tier) {
      Sfx.error();
      this.status.setText("NOT ENOUGH GOLD!");
      return;
    }
    GameState.gold -= tier;
    this.wager = tier;
    this.dirty = true;
    this.goldText.setText(`G ${GameState.gold}`);
    this.state = "spinning";
    this.spinUntil = this.scene.time.now + SPIN_HOLD;
    this.nextTick = 0;
    Sfx.move();
  }

  private resolve(): void {
    let r = Math.random();
    let outcome = WHEEL_TABLE[WHEEL_TABLE.length - 1];
    for (const o of WHEEL_TABLE) {
      if (r < o.chance) {
        outcome = o;
        break;
      }
      r -= o.chance;
    }
    // gainGold()'s return value, not the raw payout — a jackpot rolled near
    // MAX_GOLD must report what actually landed, not the full 5x
    const gained = GameState.gainGold(this.wager * outcome.mult);
    this.goldText.setText(`G ${GameState.gold}`);
    if (outcome.mult === 0) {
      Sfx.error();
      this.status.setText(`BUST! You lose ${this.wager}G...`);
    } else {
      Sfx.victory();
      this.status.setText(`${outcome.name}! +${gained}G`);
    }
    // write the result out now, not on close() — a bust reloaded before
    // closing the panel must not get to keep the pre-spin gold (Shop/Fishing
    // can defer safely since neither of their outcomes is ever negative)
    GameState.save();
    this.state = "result";
    this.resultUntil = this.scene.time.now + RESULT_HOLD;
  }

  private refresh(): void {
    this.goldText.setText(`G ${GameState.gold}`);
    WAGER_TIERS.forEach((tier, i) => {
      const affordable = GameState.gold >= tier;
      this.rows[i].setText(`WAGER ${tier}G`).setColor(affordable ? "#ffffff" : "#666666");
    });
    this.renderCursor();
  }

  private renderCursor(): void {
    const target = this.rows[this.index];
    this.cursor.setPosition(target.x - 26, target.y);
  }

  private close(): void {
    this.active = false;
    this.dim.setVisible(false);
    this.panel.setVisible(false);
    this.title.setVisible(false);
    this.goldText.setVisible(false);
    for (const t of this.rows) t.setVisible(false);
    this.cursor.setVisible(false);
    this.status.setVisible(false);
    this.hint.setVisible(false);
    if (this.dirty) GameState.save();
  }

  destroy(): void {
    this.dim.destroy();
    this.panel.destroy();
    this.title.destroy();
    this.goldText.destroy();
    for (const t of this.rows) t.destroy();
    this.cursor.destroy();
    this.status.destroy();
    this.hint.destroy();
    // keys are shared instances from kb.addKey (same keycode → same object);
    // destroying them would wipe other panels' listeners. Scene shutdown
    // already tears every Key down via KeyboardPlugin.removeAllKeys(true).
  }
}
