import Phaser from "phaser";
import { ACHIEVEMENTS, earnedCount, nextLookNeeds } from "../achievements";
import { Sfx } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { GameState } from "../gameState";
import { BODY_GLYPH_W, bodyStyle, DIM_TEXT, retroStyle } from "../pixelart";
import { PANEL_TOP_OVER_HUD } from "./StatusHud";
import { isTouchDevice } from "./TouchControls";

// Fixed pages of two columns x seven rows. Shrinking the row gap to fit one
// page stopped working at 23 entries (a name's glyphs touched its own desc),
// so the gap now stays put and a new achievement only ever adds a page.
const COLS = 2;
const ROWS = 7;
const PER_PAGE = COLS * ROWS;
const PAGES = Math.max(1, Math.ceil(ACHIEVEMENTS.length / PER_PAGE));
// a name's caps cover y-12..y+8 (its "*" too) and a desc line's (bodyStyle(22))
// y+D-7..y+D+8, its descenders to y+D+11, so D=24 leaves 9px under the name
// and 12px (9 from a descender) before the next row's name
const ROW_GAP = 56;
const DESC_DY = 24;
// widest line a column has to hold, measured from the data: a desc at 14px a
// glyph (bodyStyle(22)), or at 4px x font size a glyph a size-6 "* NAME", or a
// locked count-up's size-6 NAME, a 16px gap and its size-4 "need/need"
// right-aligned at the column's end ("TREASURE HUNTER" + "13/13" is the
// widest, 456px). A longer entry widens the panel instead of running into
// the next column; past a 39-glyph desc the panel would reach the touch menu
// column that starts at x=1220, so shorten the text rather than the margin.
// Today's longest (34 glyphs, 476px) puts the right edge at x=1150.
const progressLabel = (have: number, need: number): string => `${Math.min(have, need)}/${need}`;
const TEXT_W = Math.max(
  ...ACHIEVEMENTS.map((a) => {
    const p = a.progress?.();
    const counted = p && p.need > 1 ? a.name.length * 6 * 4 + 16 + progressLabel(p.need, p.need).length * 4 * 4 : 0;
    return Math.max(a.desc.length * BODY_GLYPH_W[22], (a.name.length + 2) * 6 * 4, counted);
  }),
);
const COL_W = TEXT_W + 20;
const PANEL_W = COL_W + TEXT_W + 48;
const COL_X = GAME_WIDTH / 2 - PANEL_W / 2 + 24;
// Pinned over the HUD (statusHud.ts) instead of centered: the rows then end
// at y=463, above the touch d-pad (y>=508) and Z button (y>=532) that would
// otherwise sit on the bottom rows; only the centered pager/counter go
// lower, between them.
const PANEL_TOP = PANEL_TOP_OVER_HUD;
const ROW_Y = PANEL_TOP + 84;
const PAGER_Y = ROW_Y + (ROWS - 1) * ROW_GAP + DESC_DY + 48;
const COUNTER_Y = PAGER_Y + 36;
// The next hero look the count opens (achievements.ts LOOK_MILESTONES) under
// the counter, then the key line (y 562..578 and 596..612, 14px apart, as the
// counter and the key line were). At retroStyle(4) the longer, "NEXT LOOK: 38
// ACHIEVEMENTS", is 26 glyphs, 416px, as is the touch key line (x 432..848):
// between the d-pad (x<=258) and Z (x>=1076) at that height.
const NEXT_Y = COUNTER_Y + 34;
const HINT_Y = NEXT_Y + 34;
const HINT = isTouchDevice() ? "D-PAD: PAGE   A/ESC: CLOSE" : "HL: PAGE   A/ESC: CLOSE";
const PANEL_H = HINT_Y + 28 - PANEL_TOP;

// Trophy board shown with A, listing every achievement as name + description,
// gold when earned and gray when still locked. Same dim + panel modal pattern
// as BestiaryUI; ESC or A (the opening key) closes, LEFT/RIGHT (or H/L — the
// touch d-pad sends the arrows) turns the page.
export class AchievementsUI {
  private active = false;
  private page = 0;

  private dim: Phaser.GameObjects.Rectangle;
  private panel: Phaser.GameObjects.Rectangle;
  private title: Phaser.GameObjects.Text;
  private pager: Phaser.GameObjects.Text;
  private counter: Phaser.GameObjects.Text;
  private next: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;
  // one name/desc pair per slot on a page, refilled on every page turn
  private names: Phaser.GameObjects.Text[] = [];
  private descs: Phaser.GameObjects.Text[] = [];
  // a locked count-up's "7/10", right-aligned on its name's line
  private counts: Phaser.GameObjects.Text[] = [];

  private keyEsc: Phaser.Input.Keyboard.Key;
  private keyA: Phaser.Input.Keyboard.Key;
  private closeQueued = false;
  private turnQueued = 0;

  constructor(scene: Phaser.Scene) {
    this.dim = scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5)
      .setScrollFactor(0)
      .setDepth(150)
      .setVisible(false);
    // opaque: it reaches up over the HUD (y 0..88), whose lines showed through at 0.95
    this.panel = scene.add
      .rectangle(GAME_WIDTH / 2, PANEL_TOP + PANEL_H / 2, PANEL_W, PANEL_H, 0x0b0b2b, 1)
      .setScrollFactor(0)
      .setDepth(151)
      .setStrokeStyle(2, 0xffffff)
      .setVisible(false);
    this.title = scene.add
      .text(GAME_WIDTH / 2, PANEL_TOP + 36, "ACHIEVEMENTS", retroStyle(8, "#ffd166"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    this.pager = scene.add
      .text(GAME_WIDTH / 2, PAGER_Y, "", retroStyle(5, "#9f9fd0"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    this.counter = scene.add
      .text(GAME_WIDTH / 2, COUNTER_Y, "", retroStyle(6, "#8ecbff"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    this.next = scene.add
      .text(GAME_WIDTH / 2, NEXT_Y, "", retroStyle(4, "#ffd166"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    this.hint = scene.add
      .text(GAME_WIDTH / 2, HINT_Y, HINT, retroStyle(4, DIM_TEXT))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);

    for (let i = 0; i < PER_PAGE; i++) {
      const x = COL_X + Math.floor(i / ROWS) * COL_W;
      const y = ROW_Y + (i % ROWS) * ROW_GAP;
      this.names.push(
        scene.add.text(x, y, "", retroStyle(6, DIM_TEXT)).setOrigin(0, 0.5).setScrollFactor(0).setDepth(152).setVisible(false),
      );
      this.descs.push(
        scene.add
          .text(x, y + DESC_DY, "", bodyStyle(22, DIM_TEXT))
          .setOrigin(0, 0.5)
          .setScrollFactor(0)
          .setDepth(152)
          .setVisible(false),
      );
      this.counts.push(
        scene.add
          .text(x + TEXT_W, y, "", retroStyle(4, "#9f9fd0"))
          .setOrigin(1, 0.5)
          .setScrollFactor(0)
          .setDepth(152)
          .setVisible(false),
      );
    }

    const kb = scene.input.keyboard!;
    this.keyEsc = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    const queueClose = () => {
      this.closeQueued = true;
    };
    this.keyEsc.on(Phaser.Input.Keyboard.Events.DOWN, queueClose);
    this.keyA.on(Phaser.Input.Keyboard.Events.DOWN, queueClose);
    const K = Phaser.Input.Keyboard.KeyCodes;
    for (const code of [K.LEFT, K.H]) {
      kb.addKey(code).on(Phaser.Input.Keyboard.Events.DOWN, () => {
        this.turnQueued = -1;
      });
    }
    for (const code of [K.RIGHT, K.L]) {
      kb.addKey(code).on(Phaser.Input.Keyboard.Events.DOWN, () => {
        this.turnQueued = 1;
      });
    }
  }

  open(): void {
    this.active = true;
    // cleared here (not in the constructor) so the A keydown that opens the
    // panel — same event also sets closeQueued — doesn't immediately close it,
    // and an arrow held while walking up doesn't flip the first page away
    this.closeQueued = false;
    this.turnQueued = 0;
    this.page = 0;
    this.setShown(true);
    this.refresh();
  }

  close(): void {
    this.active = false;
    this.setShown(false);
  }

  isActive(): boolean {
    return this.active;
  }

  update(): void {
    if (!this.active) return;
    if (this.closeQueued) {
      this.closeQueued = false;
      this.close();
      return;
    }
    if (this.turnQueued !== 0) {
      const dir = this.turnQueued;
      this.turnQueued = 0;
      if (PAGES === 1) return;
      // wraps, so the last page is one press from the first either way
      this.page = (this.page + dir + PAGES) % PAGES;
      Sfx.move();
      this.refresh();
    }
  }

  private setShown(shown: boolean): void {
    this.dim.setVisible(shown);
    this.panel.setVisible(shown);
    this.title.setVisible(shown);
    this.pager.setVisible(shown);
    this.counter.setVisible(shown);
    this.next.setVisible(shown);
    this.hint.setVisible(shown);
    for (const t of this.names) t.setVisible(shown);
    for (const t of this.descs) t.setVisible(shown);
    for (const t of this.counts) t.setVisible(shown);
  }

  private refresh(): void {
    this.counter.setText(`EARNED ${earnedCount()}/${ACHIEVEMENTS.length}`);
    const next = nextLookNeeds();
    this.next.setText(next === undefined ? "ALL LOOKS UNLOCKED" : `NEXT LOOK: ${next} ACHIEVEMENTS`);
    this.pager.setText(PAGES > 1 ? `< PAGE ${this.page + 1}/${PAGES} >` : `PAGE 1/1`);
    for (let i = 0; i < PER_PAGE; i++) {
      const a = ACHIEVEMENTS[this.page * PER_PAGE + i];
      // the last page's unused slots are blanked, not hidden, so setShown()
      // stays the only thing that toggles visibility
      if (!a) {
        this.names[i].setText("");
        this.descs[i].setText("");
        this.counts[i].setText("");
        continue;
      }
      const got = GameState.achievements.includes(a.id);
      const p = got ? undefined : a.progress?.();
      this.counts[i].setText(p && p.need > 1 ? progressLabel(p.have, p.need) : "");
      // "*", not "★": the bundled Press Start 2P is latin only, and a ★ came
      // from a fallback font at its own width and height
      this.names[i].setText(got ? `* ${a.name}` : a.name);
      this.names[i].setColor(got ? "#ffd166" : DIM_TEXT);
      this.descs[i].setText(a.desc);
      this.descs[i].setColor(got ? "#8ecbff" : DIM_TEXT);
    }
  }

  destroy(): void {
    this.dim.destroy();
    this.panel.destroy();
    this.title.destroy();
    this.pager.destroy();
    this.counter.destroy();
    this.next.destroy();
    this.hint.destroy();
    for (const t of this.names) t.destroy();
    for (const t of this.descs) t.destroy();
    for (const t of this.counts) t.destroy();
    // keys are shared instances from kb.addKey (same keycode → same object);
    // destroying them would wipe other panels' listeners. Scene shutdown
    // already tears every Key down via KeyboardPlugin.removeAllKeys(true).
  }
}
