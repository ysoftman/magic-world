import type Phaser from "phaser";
import { Sfx } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { retroStyle } from "../pixelart";
import { HERO_LOOKS } from "../scenes/BootScene";
import { isTouchDevice } from "./TouchControls";

// Sized off Press Start 2P (chars x size x 4px): the title "CHOOSE YOUR LOOK"
// at retroStyle(8) is 512px (x 384..896) and the keyboard hint at
// retroStyle(4) 544px (34 glyphs, x 368..912; the touch one 512px), inside
// the 760px panel (x 260..1020). Four 144px
// frames 170px apart span x 313..967, 53px clear of each side; a name at
// retroStyle(5) is at most 120px ("VIOLET"). Rows: title 224, frames
// 270..420, names 440, hint 510, the panel 180..540.
const PANEL_W = 760;
const PANEL_H = 360;
const PANEL_TOP = GAME_HEIGHT / 2 - PANEL_H / 2;
const SPACING = 170;
const FRAME_W = 144;
const FRAME_H = 150;
const FRAME_Y = PANEL_TOP + 165;
const NAME_Y = PANEL_TOP + 260;
const PICKED = "#ffd166";
const HINT = isTouchDevice() ? "TAP A HERO  -  TAP OUTSIDE: BACK" : "LEFT/RIGHT: PICK  Z: OK  ESC: BACK";

const lookX = (i: number): number => GAME_WIDTH / 2 + (i - (HERO_LOOKS.length - 1) / 2) * SPACING;

// The hero's look, chosen at NEW GAME (TitleScene) and at HOME (TownScene):
// one idle frame per look side by side, LEFT/RIGHT (or H/L, 1-4) to move,
// Z/ENTER/SPACE to take it, ESC to back out; on touch a tap on a hero takes
// it and a tap outside the panel backs out. Input is queued and acted on in
// update(), like the other panels, so the Z that confirms is spent here and
// can't also reach the scene's own Z (TownScene's HOME rest).
export class LookPicker {
  private root: Phaser.GameObjects.Container;
  private frames: Phaser.GameObjects.Rectangle[] = [];
  private names: Phaser.GameObjects.Text[] = [];
  private active = false;
  private index = 0;
  private done: (look: number | null) => void = () => {};
  private step = 0;
  private jump: number | null = null;
  private confirmQueued = false;
  private cancelQueued = false;
  // the key that opened the picker (ENTER/Z on the title, which also start a
  // game) is still being dispatched when open() runs; anything older is ignored
  private openedAt = 0;

  constructor(scene: Phaser.Scene) {
    // swallows taps meant for whatever is under the panel; a tap on it backs out
    const dim = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5).setInteractive();
    dim.on("pointerdown", () => {
      this.cancelQueued = true;
    });
    const panel = scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, PANEL_W, PANEL_H, 0x0b0b2b, 0.95)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive();
    const children: Array<Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text | Phaser.GameObjects.Image> = [
      dim,
      panel,
      scene.add.text(GAME_WIDTH / 2, PANEL_TOP + 44, "CHOOSE YOUR LOOK", retroStyle(8, PICKED)).setOrigin(0.5),
      scene.add.text(GAME_WIDTH / 2, PANEL_TOP + PANEL_H - 30, HINT, retroStyle(4, "#8ecbff")).setOrigin(0.5),
    ];
    HERO_LOOKS.forEach((look, i) => {
      const frame = scene.add.rectangle(lookX(i), FRAME_Y, FRAME_W, FRAME_H, 0x000000, 0).setInteractive({ useHandCursor: true });
      frame.on("pointerdown", () => {
        this.jump = i;
        this.confirmQueued = true;
      });
      const hero = scene.add.image(lookX(i), FRAME_Y - 6, `hero-look-${i}`).setScale(2);
      const name = scene.add.text(lookX(i), NAME_Y, look.name, retroStyle(5, "#f5f5f5")).setOrigin(0.5);
      this.frames.push(frame);
      this.names.push(name);
      children.push(frame, hero, name);
    });
    // each child too: input hit-tests a container's children by their own
    // scroll factor, so in the scrolled town a tap would miss the frames
    for (const c of children) c.setScrollFactor(0);
    this.root = scene.add.container(0, 0, children).setScrollFactor(0).setDepth(160).setVisible(false);

    scene.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (!this.active || e.repeat || e.timeStamp <= this.openedAt) return;
      const key = e.key.toLowerCase();
      if (key === "arrowleft" || key === "h") this.step -= 1;
      else if (key === "arrowright" || key === "l") this.step += 1;
      else if (/^[1-9]$/.test(key) && Number(key) <= HERO_LOOKS.length) this.jump = Number(key) - 1;
      else if (key === "z" || e.key === "Enter" || e.key === " ") this.confirmQueued = true;
      else if (e.key === "Escape") this.cancelQueued = true;
    });
  }

  /** Shows the picker on `current`; `done` gets the chosen index, or null when backed out of. */
  open(current: number, done: (look: number | null) => void): void {
    this.active = true;
    this.openedAt = performance.now();
    this.done = done;
    this.index = HERO_LOOKS[current] ? current : 0;
    this.step = 0;
    this.jump = null;
    this.confirmQueued = false;
    this.cancelQueued = false;
    this.render();
    this.root.setVisible(true);
  }

  isActive(): boolean {
    return this.active;
  }

  update(): void {
    if (!this.active) return;
    if (this.jump !== null || this.step !== 0) {
      const n = HERO_LOOKS.length;
      const next = this.jump ?? (((this.index + this.step) % n) + n) % n;
      this.jump = null;
      this.step = 0;
      if (next !== this.index) {
        this.index = next;
        Sfx.move();
        this.render();
      }
    }
    if (this.cancelQueued) {
      this.close(null);
      return;
    }
    if (this.confirmQueued) {
      Sfx.buy();
      this.close(this.index);
    }
  }

  destroy(): void {
    this.root.destroy();
  }

  private close(look: number | null): void {
    this.active = false;
    this.confirmQueued = false;
    this.cancelQueued = false;
    this.root.setVisible(false);
    this.done(look);
  }

  private render(): void {
    this.frames.forEach((f, i) => {
      const picked = i === this.index;
      f.setStrokeStyle(picked ? 3 : 2, picked ? 0xffd166 : 0xffffff, picked ? 1 : 0.3);
      this.names[i].setColor(picked ? PICKED : "#f5f5f5");
    });
  }
}
