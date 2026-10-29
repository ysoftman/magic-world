import Phaser from "phaser";
import { earnedCount, lookNeeds, lookUnlocked } from "../achievements";
import { Sfx } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { DIM_TEXT, retroStyle } from "../pixelart";
import type { PixelText } from "../pixelText";
import { HERO_LOOKS } from "../scenes/BootScene";
import { bindKeyHint, keyHint } from "./Gamepad";

// Sized off Press Start 2P (chars x size x 4px). Eight looks in two rows of
// four: 144px frames 170px apart span x 313..967 inside the 760px panel (x
// 260..1020), 53px clear of each side, and clear of the touch d-pad (x<=258)
// and Z (x>=1076) that stay up over the picker; a name at retroStyle(5) is at
// most 140px ("CRIMSON"). The title "CHOOSE YOUR LOOK" at retroStyle(8) is
// 512px; the detail line under the rows, "EARN 38 ACHIEVEMENTS TO UNLOCK
// (12/38)" at its longest, 38 glyphs at retroStyle(4) = 608px (x 336..944);
// the touch hint 512px. Rows: title 152, frames 184..324 and 364..504, names
// 340 and 520, detail 550, hint 580, the panel 112..608 (below the HUD band).
const PANEL_W = 760;
const PANEL_H = 496;
const PANEL_TOP = 112;
const COLS = 4;
const SPACING = 170;
const ROW_GAP = 180;
const FRAME_W = 144;
const FRAME_H = 140;
const FRAME_Y = PANEL_TOP + 142;
const NAME_DY = 86;
const DETAIL_Y = PANEL_TOP + 438;
const PICKED = "#ffd166";
// a look still to earn: its hero as a flat shape, the count it opens at on it
const SILHOUETTE = 0x2c2c4a;
const HINT = (): string => keyHint("HJKL: MOVE   Z: OK   ESC: BACK", "TAP A HERO  -  TAP OUTSIDE: BACK");

const lookX = (i: number): number => GAME_WIDTH / 2 + ((i % COLS) - (COLS - 1) / 2) * SPACING;
const lookY = (i: number): number => FRAME_Y + Math.floor(i / COLS) * ROW_GAP;

// The hero's look, chosen at NEW GAME (TitleScene) and at HOME (TownScene):
// one idle frame per look, LEFT/RIGHT (or H/L) and UP/DOWN (J/K) to move,
// 1-8 to jump, Z/ENTER/SPACE to take it, ESC to back out; on touch a tap on
// a hero takes it and a tap outside the panel backs out. The last four looks
// open with achievements (achievements.ts LOOK_MILESTONES): a locked one shows
// as a silhouette with its count, can be moved to (the line under the rows
// says what it takes) but not taken. Input is queued and acted on in
// update(), like the other panels, so the Z that confirms is spent here and
// can't also reach the scene's own Z (TownScene's HOME rest).
export class LookPicker {
  private root: Phaser.GameObjects.Container;
  private frames: Phaser.GameObjects.Rectangle[] = [];
  private heroes: Phaser.GameObjects.Image[] = [];
  private names: PixelText[] = [];
  private needs: PixelText[] = [];
  private detail: PixelText;
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
      .rectangle(GAME_WIDTH / 2, PANEL_TOP + PANEL_H / 2, PANEL_W, PANEL_H, 0x0b0b2b, 0.95)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive();
    this.detail = scene.add.pixelText(GAME_WIDTH / 2, DETAIL_Y, "", retroStyle(4, PICKED)).setOrigin(0.5);
    const children: Array<Phaser.GameObjects.Rectangle | PixelText | Phaser.GameObjects.Image> = [
      dim,
      panel,
      scene.add.pixelText(GAME_WIDTH / 2, PANEL_TOP + 40, "CHOOSE YOUR LOOK", retroStyle(8, PICKED)).setOrigin(0.5),
      this.detail,
      bindKeyHint(scene.add.pixelText(GAME_WIDTH / 2, PANEL_TOP + PANEL_H - 28, "", retroStyle(4, "#8ecbff")), HINT).setOrigin(0.5),
    ];
    HERO_LOOKS.forEach((look, i) => {
      const frame = scene.add.rectangle(lookX(i), lookY(i), FRAME_W, FRAME_H, 0x000000, 0).setInteractive({ useHandCursor: true });
      frame.on("pointerdown", () => {
        this.jump = i;
        this.confirmQueued = true;
      });
      const hero = scene.add.image(lookX(i), lookY(i) - 6, `hero-look-${i}`).setScale(2);
      const name = scene.add.pixelText(lookX(i), lookY(i) + NAME_DY, look.name, retroStyle(5, "#f5f5f5")).setOrigin(0.5);
      const need = scene.add
        .pixelText(lookX(i), lookY(i) - 6, String(lookNeeds(i)), retroStyle(8, PICKED))
        .setStroke("#0b0b2b", 4)
        .setOrigin(0.5);
      this.frames.push(frame);
      this.heroes.push(hero);
      this.names.push(name);
      this.needs.push(need);
      children.push(frame, hero, need, name);
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
      else if (key === "arrowup" || key === "k") this.step -= COLS;
      else if (key === "arrowdown" || key === "j") this.step += COLS;
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
    // a look out of range, or one not earned (bakeHero shows BLUE for it too)
    this.index = HERO_LOOKS[current] && lookUnlocked(current) ? current : 0;
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
      this.confirmQueued = false;
      // a locked look stays on show with what it takes, as a spent STEAL does
      if (!lookUnlocked(this.index)) {
        Sfx.error();
        return;
      }
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
      const open = lookUnlocked(i);
      f.setStrokeStyle(picked ? 3 : 2, picked ? 0xffd166 : 0xffffff, picked ? 1 : 0.3);
      if (open) this.heroes[i].clearTint();
      else this.heroes[i].setTint(SILHOUETTE).setTintMode(Phaser.TintModes.FILL);
      this.needs[i].setVisible(!open);
      this.names[i].setColor(picked ? PICKED : open ? "#f5f5f5" : DIM_TEXT);
    });
    const need = lookNeeds(this.index);
    this.detail.setText(lookUnlocked(this.index) ? "" : `EARN ${need} ACHIEVEMENTS TO UNLOCK (${earnedCount()}/${need})`);
  }
}
