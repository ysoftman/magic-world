import type Phaser from "phaser";
import { Sfx } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { DIM_TEXT, retroStyle } from "../pixelart";
import { isTouchDevice } from "./TouchControls";

// The hero's name at NEW GAME, in the game's own panel: window.prompt put a
// browser (on touch an OS) dialog over the pixel screen, and a gamepad had
// no way to type into it. The name keeps what the prompt's line did with
// its answer (TitleScene): upper case, trimmed, 12 glyphs at most, "HERO"
// when left empty. 12 is also GameState's cap on a loaded name.
const NAME_MAX = 12;
const DEFAULT_NAME = "HERO";

// Sized off Press Start 2P (chars x size x 4px), in the look picker's frame
// (760 x 496, x 260..1020, y 112..608), the panel that follows it; at 608 it
// also covers the title's PRESS ENTER line (576..608), which a shorter one
// cut in half. The title at y 152 (retroStyle(8), "YOUR NAME" 288px); the
// name at y 216 on twelve slots (retroStyle(8), 12 x 32 = 384px, x
// 448..832), an underscore marking each one still empty; the grid's five rows
// from y 308 at a 48px pitch (cells 284..524), ten 56px columns (x 360..920,
// 100px inside each side); the key line at y 580, as the picker's (the
// longest, the keyboard's, 45 x 16 = 720px, x 280..1000, 20px inside).
const PANEL_W = 760;
const PANEL_H = 496;
const PANEL_TOP = 112;
const NAME_Y = PANEL_TOP + 104;
const NAME_X = GAME_WIDTH / 2 - (NAME_MAX * 32) / 2;
const GRID_Y = PANEL_TOP + 196;
const COLS = 10;
const CELL_W = 56;
const CELL_H = 48;
const GRID_X = GAME_WIDTH / 2 - (COLS * CELL_W) / 2;
const PICKED = "#ffd166";
// the plate under the untouched default, as a prompt's preselected text sat
const SELECTED_BG = "#3b4a75";

// What a keyboard may type: printable ASCII, as the prompt took it (upper
// cased). Anything past it (an IME's hangul, an emoji) is dropped: the
// bundled font is latin only.
const TYPABLE = /^[ -~]$/;

// The grid offers the letters, digits, a space and the few marks a name
// tends to use; each row is ten columns, and a wide cell spans several.
type Cell = { label: string; ch?: string; act?: "del" | "ok"; col: number; span: number; row: number };
const ROWS: Array<Array<[label: string, span: number, act?: "del" | "ok"]>> = [
  [..."ABCDEFGHIJ"].map((c): [string, number] => [c, 1]),
  [..."KLMNOPQRST"].map((c): [string, number] => [c, 1]),
  [..."UVWXYZ-.'!"].map((c): [string, number] => [c, 1]),
  [..."1234567890"].map((c): [string, number] => [c, 1]),
  [
    ["SPACE", 4],
    ["DEL", 3, "del"],
    ["OK", 3, "ok"],
  ],
];
const CELLS: Cell[] = ROWS.flatMap((row, r) => {
  let col = 0;
  return row.map(([label, span, act]) => {
    const cell: Cell = { label, ch: act ? undefined : label === "SPACE" ? " " : label, act, col, span, row: r };
    col += span;
    return cell;
  });
});
// the cell under each (row, column), so UP/DOWN keep the column
const AT: Cell[][] = ROWS.map((_, r) =>
  Array.from({ length: COLS }, (_, c) => CELLS.find((x) => x.row === r && c >= x.col && c < x.col + x.span) as Cell),
);
const cellX = (cell: Cell): number => GRID_X + (cell.col + cell.span / 2) * CELL_W;
const cellY = (cell: Cell): number => GRID_Y + cell.row * CELL_H;

// A keyboard types; the grid is moved with the arrows and picked with Z
// (ENTER, though, is OK). A pad and the touch buttons type through the same
// keyboard events, but synthetic ones (TouchControls' sendKey, which the
// gamepad goes through too): untrusted, so their Z picks rather than types
// and their other letters (X is A, Y is I ...) do nothing here. On touch a
// tap on a cell picks it and a tap outside the panel backs out.
const HINT = isTouchDevice() ? "TAP: TYPE   OK: DONE   TAP OUTSIDE: BACK" : "A-Z: TYPE   BKSP: DEL   ENTER: OK   ESC: BACK";

export class NameEntry {
  private root: Phaser.GameObjects.Container;
  private nameText: Phaser.GameObjects.Text;
  private slots: Phaser.GameObjects.Text;
  private caret: Phaser.GameObjects.Text;
  private cellBoxes: Phaser.GameObjects.Rectangle[] = [];
  private cellTexts: Phaser.GameObjects.Text[] = [];
  private active = false;
  private name = DEFAULT_NAME;
  // the default stands selected until the first edit replaces it, as a
  // prompt's preselected default did
  private fresh = true;
  private row = 0;
  private col = 0;
  private done: (name: string | null) => void = () => {};
  private queue: Array<{ kind: "type"; ch: string } | { kind: "move"; dr: number; dc: number } | { kind: "pick" | "del" | "ok" | "back" }> =
    [];
  // the key that opened the panel (ENTER/Z/N on the title) is still being
  // dispatched when open() runs; anything older is ignored
  private openedAt = 0;

  constructor(scene: Phaser.Scene) {
    // swallows taps meant for the title under it; a tap on it backs out
    const dim = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5).setInteractive();
    dim.on("pointerdown", () => this.queue.push({ kind: "back" }));
    const panel = scene.add
      .rectangle(GAME_WIDTH / 2, PANEL_TOP + PANEL_H / 2, PANEL_W, PANEL_H, 0x0b0b2b, 0.95)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive();
    // an underscore only under a slot still empty: under every glyph it read
    // as part of it (a T over one looked like an I, a space like a "_")
    this.slots = scene.add.text(NAME_X, NAME_Y, "", retroStyle(8, DIM_TEXT)).setOrigin(0, 0.5);
    this.nameText = scene.add.text(NAME_X, NAME_Y, "", retroStyle(8, "#f5f5f5")).setOrigin(0, 0.5);
    this.caret = scene.add.text(NAME_X, NAME_Y, "_", retroStyle(8, PICKED)).setOrigin(0, 0.5);
    scene.tweens.add({ targets: this.caret, alpha: 0.2, duration: 400, yoyo: true, repeat: -1 });
    const children: Phaser.GameObjects.GameObject[] = [
      dim,
      panel,
      scene.add.text(GAME_WIDTH / 2, PANEL_TOP + 40, "YOUR NAME", retroStyle(8, PICKED)).setOrigin(0.5),
      this.slots,
      this.nameText,
      this.caret,
      scene.add.text(GAME_WIDTH / 2, PANEL_TOP + PANEL_H - 28, HINT, retroStyle(4, "#8ecbff")).setOrigin(0.5),
    ];
    for (const cell of CELLS) {
      const box = scene.add
        .rectangle(cellX(cell), cellY(cell), cell.span * CELL_W - 8, CELL_H - 8, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      box.on("pointerdown", () => {
        this.row = cell.row;
        this.col = cell.col;
        this.queue.push({ kind: "pick" });
      });
      const text = scene.add.text(cellX(cell), cellY(cell), cell.label, retroStyle(6, "#f5f5f5")).setOrigin(0.5);
      this.cellBoxes.push(box);
      this.cellTexts.push(text);
      children.push(box, text);
    }
    for (const c of children) (c as Phaser.GameObjects.Text).setScrollFactor(0);
    this.root = scene.add.container(0, 0, children).setScrollFactor(0).setDepth(160).setVisible(false);

    scene.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (!this.active || e.timeStamp <= this.openedAt) return;
      const key = e.key;
      if (key === "ArrowLeft") this.queue.push({ kind: "move", dr: 0, dc: -1 });
      else if (key === "ArrowRight") this.queue.push({ kind: "move", dr: 0, dc: 1 });
      else if (key === "ArrowUp") this.queue.push({ kind: "move", dr: -1, dc: 0 });
      else if (key === "ArrowDown") this.queue.push({ kind: "move", dr: 1, dc: 0 });
      else if (key === "Escape") this.queue.push({ kind: "back" });
      else if (key === "Enter") this.queue.push({ kind: "ok" });
      else if (key === "Backspace") this.queue.push({ kind: "del" });
      else if (!e.isTrusted) {
        if (key === "z") this.queue.push({ kind: "pick" });
      } else if (TYPABLE.test(key) && !e.ctrlKey && !e.metaKey && !e.altKey) this.queue.push({ kind: "type", ch: key.toUpperCase() });
    });
  }

  /** Shows the panel on the default name; `done` gets the name, or null when backed out of. */
  open(done: (name: string | null) => void): void {
    this.active = true;
    this.openedAt = performance.now();
    this.done = done;
    this.name = DEFAULT_NAME;
    this.fresh = true;
    this.row = 0;
    this.col = 0;
    this.queue = [];
    this.render();
    this.root.setVisible(true);
  }

  isActive(): boolean {
    return this.active;
  }

  // input is queued and acted on here, like the other panels, so the Z or
  // ENTER that finishes is spent before the title's own handlers could see it
  update(): void {
    if (!this.active) return;
    const queued = this.queue;
    this.queue = [];
    for (const q of queued) {
      if (!this.active) return;
      if (q.kind === "move") this.move(q.dr, q.dc);
      else if (q.kind === "type") this.type(q.ch);
      else if (q.kind === "del") this.del();
      else if (q.kind === "ok") this.finish();
      else if (q.kind === "back") this.close(null);
      else if (q.kind === "pick") {
        const cell = AT[this.row][this.col];
        if (cell.act === "del") this.del();
        else if (cell.act === "ok") this.finish();
        else if (cell.ch !== undefined) this.type(cell.ch);
      }
    }
  }

  destroy(): void {
    this.root.destroy();
  }

  private move(dr: number, dc: number): void {
    if (dr !== 0) {
      this.row = (this.row + dr + ROWS.length) % ROWS.length;
    } else {
      // step to the next cell along the row, past a wide cell's columns
      const cell = AT[this.row][this.col];
      const next = dc > 0 ? cell.col + cell.span : cell.col - 1;
      this.col = (next + COLS) % COLS;
      this.col = AT[this.row][this.col].col;
    }
    Sfx.move();
    this.render();
  }

  private type(ch: string): void {
    // the first edit replaces the default rather than adding to it
    const base = this.fresh ? "" : this.name;
    // no leading space: trimmed away at the end anyway, it only hid the caret
    if (base.length >= NAME_MAX || (ch === " " && base.length === 0)) {
      Sfx.error();
      return;
    }
    this.name = base + ch;
    this.fresh = false;
    Sfx.move();
    this.render();
  }

  private del(): void {
    if (this.fresh || this.name.length === 0) {
      this.name = "";
      this.fresh = false;
      Sfx.error();
    } else {
      this.name = this.name.slice(0, -1);
      Sfx.move();
    }
    this.render();
  }

  private finish(): void {
    Sfx.buy();
    this.close(this.name.trim() || DEFAULT_NAME);
  }

  private close(name: string | null): void {
    this.active = false;
    this.queue = [];
    this.root.setVisible(false);
    this.done(name);
  }

  private render(): void {
    this.nameText.setText(this.name).setBackgroundColor(this.fresh ? SELECTED_BG : "");
    this.slots.setText(" ".repeat(this.name.length) + "_".repeat(NAME_MAX - this.name.length));
    // on the slot the next glyph goes to; gone while the default is selected
    // (the next glyph replaces it) and once all twelve are full
    this.caret.setX(NAME_X + this.name.length * 32).setVisible(!this.fresh && this.name.length < NAME_MAX);
    const picked = AT[this.row][this.col];
    CELLS.forEach((cell, i) => {
      const on = cell === picked;
      this.cellBoxes[i].setStrokeStyle(on ? 3 : 1, on ? 0xffd166 : 0xffffff, on ? 1 : 0.25);
      this.cellTexts[i].setColor(on ? PICKED : cell.act === "ok" ? "#4ade80" : "#f5f5f5");
    });
  }
}
