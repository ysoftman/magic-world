import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { GameState } from "../gameState";
import { retroStyle } from "../pixelart";

const FONT_SIZE = 32;
const CHARS_PER_ROW = Math.floor((GAME_WIDTH - 128) / FONT_SIZE);
const ROWS_PER_PAGE = 5;

export class DialogueBox {
  private scene: Phaser.Scene;
  private lines: string[] = [];
  private index = 0;
  private charIndex = 0;
  private typing = false;
  private active = false;
  private pageSize = 1;
  private pageText = "";

  private border: Phaser.GameObjects.Rectangle;
  private box: Phaser.GameObjects.Rectangle;
  private text: Phaser.GameObjects.Text;
  private nameText: Phaser.GameObjects.Text;
  private timer?: Phaser.Time.TimerEvent;

  private z: Phaser.Input.Keyboard.Key;
  private space: Phaser.Input.Keyboard.Key;
  private enter: Phaser.Input.Keyboard.Key;
  private esc: Phaser.Input.Keyboard.Key;
  private advanceQueued = false;
  private escQueued = false;

  constructor(scene: Phaser.Scene, lines: string[]) {
    this.scene = scene;
    this.lines = lines;

    this.border = scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 136, GAME_WIDTH - 48, 208, 0xffffff)
      .setScrollFactor(0)
      .setDepth(200);
    this.box = scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 136, GAME_WIDTH - 64, 192, 0x0b0b2b)
      .setScrollFactor(0)
      .setDepth(201);
    this.text = scene.add
      .text(48, GAME_HEIGHT - 224, "", retroStyle(8, "#f5f5f5"))
      .setScrollFactor(0)
      .setDepth(202)
      .setWordWrapWidth(GAME_WIDTH - 128);
    this.nameText = scene.add
      .text(48, GAME_HEIGHT - 264, "", retroStyle(6, "#ffd166"))
      .setScrollFactor(0)
      .setDepth(202);

    this.border.setVisible(false);
    this.box.setVisible(false);
    this.text.setVisible(false);
    this.nameText.setVisible(false);

    const kb = scene.input.keyboard!;
    this.z = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.space = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.enter = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.esc = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    const queueAdvance = () => {
      this.advanceQueued = true;
    };
    this.z.on(Phaser.Input.Keyboard.Events.DOWN, queueAdvance);
    this.space.on(Phaser.Input.Keyboard.Events.DOWN, queueAdvance);
    this.enter.on(Phaser.Input.Keyboard.Events.DOWN, queueAdvance);
    this.esc.on(Phaser.Input.Keyboard.Events.DOWN, () => {
      this.escQueued = true;
    });
  }

  start(lines?: string[], name?: string): void {
    if (lines) this.lines = lines;
    this.index = 0;
    this.charIndex = 0;
    this.active = true;
    this.advanceQueued = false;
    this.escQueued = false;

    this.border.setVisible(true);
    this.box.setVisible(true);
    this.text.setVisible(true);
    this.nameText.setVisible(name ? true : false);
    this.nameText.setText(name ?? "");

    this.typeLine();
  }

  private typeLine(): void {
    // Pack lines until the box is full: callers pass sentence-sized strings,
    // and paging them one-per-keypress left most of the box empty.
    const page: string[] = [];
    let rows = 0;
    while (this.index + page.length < this.lines.length) {
      const line = this.lines[this.index + page.length];
      const needed = Math.max(1, Math.ceil(line.length / CHARS_PER_ROW));
      if (page.length > 0 && rows + needed > ROWS_PER_PAGE) break;
      page.push(line);
      rows += needed;
    }
    if (page.length === 0) {
      this.close();
      return;
    }
    this.pageSize = page.length;
    this.pageText = page.join("\n");
    this.text.setText("");
    this.typing = true;
    this.charIndex = 0;
    this.timer = this.scene.time.addEvent({
      delay: 22 / GameState.textSpeed,
      repeat: this.pageText.length,
      callback: () => {
        this.charIndex++;
        this.text.setText(this.pageText.slice(0, this.charIndex));
        if (this.charIndex >= this.pageText.length) {
          this.typing = false;
          this.timer?.remove();
        }
      },
    });
  }

  update(): void {
    if (!this.active) return;
    if (this.escQueued) {
      this.escQueued = false;
      this.close();
      return;
    }
    if (!this.advanceQueued) return;
    this.advanceQueued = false;

    if (this.typing) {
      this.typing = false;
      this.timer?.remove();
      this.text.setText(this.pageText);
      return;
    }
    this.index += this.pageSize;
    if (this.index < this.lines.length) {
      this.typeLine();
    } else {
      this.close();
    }
  }

  private close(): void {
    this.active = false;
    this.border.setVisible(false);
    this.box.setVisible(false);
    this.text.setVisible(false);
    this.nameText.setVisible(false);
  }

  isActive(): boolean {
    return this.active;
  }

  destroy(): void {
    this.timer?.remove();
    this.border.destroy();
    this.box.destroy();
    this.text.destroy();
    this.nameText.destroy();
    // keys are shared instances from kb.addKey (same keycode → same object);
    // destroying them would wipe other panels' listeners. Scene shutdown
    // already tears every Key down via KeyboardPlugin.removeAllKeys(true).
  }
}
