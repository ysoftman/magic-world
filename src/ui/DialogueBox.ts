import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, PIXEL } from "../config";
import { GameState } from "../gameState";
import { BODY_GLYPH_W, type BodySize, bodyStyle, retroStyle } from "../pixelart";
import type { PixelText } from "../pixelText";
import { hideTouchButtons, isTouchDevice } from "./TouchControls";
import { TypedText } from "./TypedText";

// Where the box and its glyphs sit: one layout for keyboard play, one for
// touch (pointer: coarse).
interface Layout {
  size: BodySize;
  lineSpacing: number;
  charsPerRow: number;
  // the box inside its 8px white border
  boxW: number;
  boxTop: number;
  boxH: number;
  textX: number;
  textY: number;
  // a question's last page holds this many rows of text over its choices
  questionRows: number;
  choiceSize: number;
  choiceX: number;
  choiceY: number;
  choicePitch: number;
  nameSize: number;
}
const ROWS_PER_PAGE = 4;
const BORDER = 8;
// Keyboard: the talk is in bodyStyle(22), 14px a glyph and a 26px line, 8px
// apart (a 34px pitch, about 1.5 of the glyph's size), 60 glyphs a row. It
// was bodyStyle(33) across the whole screen, 54 glyphs of 21px: big enough
// that a row was read in several looks, and two rows filled the screen's
// width. At 22 a full-width row would hold 84 glyphs, too long to find the
// next row's start from, so the box is as wide as 60 glyphs (840px) and 24px
// either side, centred: x 196..1084, with its border 188..1092. A page holds
// more than before (4 x 60 against 4 x 54), and a wider row never wraps into
// more rows, so every talk measured for the old rows still fits its pages.
// Four rows from y=536, the last one's descenders ending at 664, inside the
// box's 524..680 (caps start 18px under its top, descenders end 16px over
// its foot).
// ask(): the choices sit on the page's fourth row in retroStyle(6), y
// 644..668, 14px under the third row's descenders (630) and 12px over the
// box's foot (at 640 they crowded the row above), so a question's last
// page packs at most three rows of text above them. Each choice is "> " plus
// its label, 280px apart from x=220: three seven-glyph labels end at 220 +
// 2 x 280 + 9 x 24 = 996, short of the text's right end at 1060.
const KEYBOARD: Layout = {
  size: 22,
  lineSpacing: 8,
  charsPerRow: 60,
  boxW: 60 * BODY_GLYPH_W[22] + 48,
  boxTop: GAME_HEIGHT - 196,
  boxH: 156,
  textX: GAME_WIDTH / 2 - 30 * BODY_GLYPH_W[22],
  textY: GAME_HEIGHT - 184,
  questionRows: ROWS_PER_PAGE - 1,
  choiceSize: 6,
  choiceX: GAME_WIDTH / 2 - 30 * BODY_GLYPH_W[22],
  choiceY: GAME_HEIGHT - 76,
  choicePitch: 280,
  nameSize: 4,
};
// Touch keeps bodyStyle(33), 21px a glyph and a 39px line, 5px apart, across
// the screen: a phone shows the game far smaller than a desk screen does, and
// the box has to stay clear of the buttons anyway. Four rows from y=496, the
// last one's descenders ending at 665, inside the box's 488..680. The text
// stops at x=930 (42 glyphs), short of the ESC (x>=960) and Z (x>=1076)
// buttons over the box's right end; the d-pad over its left end is hidden
// while the box is up (bar < and > under a question's choices, see below).
// The choices are in retroStyle(8) on the fourth row, 8px down it where the
// body's caps start (y 636..668). They bring back the d-pad's < and > (hiding
// only its ^ and v, TouchControls' "updown") so they can step between them.
// Those two sit at x 42..258, y 572..660, over the box's left end, so a
// question's last page keeps to one row of text (its descenders end at y 533;
// a second row's caps would sit at 548..572, on the arrows) and the choices
// start at x=288, 30px right of them. Two end at 288 + 256 + 7 x 32 = 768; a
// third would end at 1024, into the ESC button (x>=960), so touch questions
// keep to two.
const TOUCH: Layout = {
  size: 33,
  lineSpacing: 5,
  charsPerRow: 42,
  boxW: GAME_WIDTH - 64,
  boxTop: GAME_HEIGHT - 232,
  boxH: 192,
  textX: 48,
  textY: GAME_HEIGHT - 224,
  questionRows: 1,
  choiceSize: 8,
  choiceX: 288,
  choiceY: GAME_HEIGHT - 84,
  choicePitch: 256,
  nameSize: 6,
};
// A confirm (Z/ENTER/SPACE, or a tap on a choice) within this long of the
// choices showing is dropped, and restarts the wait. The Z meant to skip the
// last page's typing can land just as the typing ends on its own, and Z
// mashed through a talk ran straight on into the first choice: a delivery
// handed in, a favor taken, an ARENA bout started. 250ms is under a
// deliberate first press (seeing the choices and deciding takes longer than
// the ~200-250ms of a bare reaction) and over the ~100-170ms between mashed
// presses, so a mash keeps the choices waiting until it stops. Moving the
// marker, Y/N (a choice by name) and ESC (the last, as on any page) stay live.
const CHOICE_GUARD_MS = 250;
const MAX_CHOICES = 3;
const PICKED_COLOR = "#ffd166";
// the speaker's plate round its name: 8 a side, 4 on top, none under (see
// the constructor)
const NAME_PAD_X = 8;
const NAME_PAD_TOP = 4;

export class DialogueBox {
  private scene: Phaser.Scene;
  private lines: string[] = [];
  private index = 0;
  private charIndex = 0;
  private typing = false;
  private active = false;
  private pageSize = 1;
  private pageText = "";
  private touch = isTouchDevice();
  private layout = this.touch ? TOUCH : KEYBOARD;

  private border: Phaser.GameObjects.Rectangle;
  private box: Phaser.GameObjects.Rectangle;
  private text: TypedText;
  private namePlate: Phaser.GameObjects.Rectangle;
  private nameText: PixelText;
  private timer?: Phaser.Time.TimerEvent;

  private z: Phaser.Input.Keyboard.Key;
  private space: Phaser.Input.Keyboard.Key;
  private enter: Phaser.Input.Keyboard.Key;
  private esc: Phaser.Input.Keyboard.Key;
  private advanceQueued = false;
  private escQueued = false;

  // ask(): the choices, the picked one, and whether they're showing yet (only
  // once the last page has finished typing)
  private choices: string[] = [];
  private onPick: ((index: number) => void) | null = null;
  // the choice ESC takes: the last, unless ask() names another
  private escPick = 0;
  private choice = 0;
  private choosing = false;
  private choiceTexts: PixelText[] = [];
  private choiceStep = 0;
  private pickQueued: number | null = null;
  private tapQueued: number | null = null;
  // scene time before which a confirm is dropped (CHOICE_GUARD_MS)
  private confirmAfter = 0;

  constructor(scene: Phaser.Scene, lines: string[]) {
    this.scene = scene;
    this.lines = lines;

    const lay = this.layout;
    const boxY = lay.boxTop + lay.boxH / 2;
    this.border = scene.add
      .rectangle(GAME_WIDTH / 2, boxY, lay.boxW + 2 * BORDER, lay.boxH + 2 * BORDER, 0xffffff)
      .setScrollFactor(0)
      .setDepth(200);
    this.box = scene.add
      .rectangle(GAME_WIDTH / 2, boxY, lay.boxW, lay.boxH, 0x0b0b2b)
      .setScrollFactor(0)
      .setDepth(201);
    this.text = new TypedText(scene, lay.textX, lay.textY, bodyStyle(lay.size, "#f5f5f5"), {
      wrapWidth: lay.charsPerRow * BODY_GLYPH_W[lay.size],
      lineSpacing: lay.lineSpacing,
    })
      .setScrollFactor(0)
      .setDepth(202);
    // On a plate of the box's colour, a tab on the box's top edge: bare, it
    // sat on the map and ran into the name tags behind it (ELDER over
    // BLACKSMITH). The plate reaches 8px past the name either side and 4px
    // over it, the glyphs start at the text's x, and the plate's foot is on
    // the border's top edge (sized to the name in open()).
    const nameH = lay.nameSize * PIXEL;
    const plateY = lay.boxTop - BORDER - nameH - NAME_PAD_TOP;
    this.namePlate = scene.add
      .rectangle(lay.textX - NAME_PAD_X, plateY, 0, 0, 0x0b0b2b)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(202);
    this.nameText = scene.add
      .pixelText(lay.textX, plateY + NAME_PAD_TOP, "", retroStyle(lay.nameSize, "#ffd166"))
      .setScrollFactor(0)
      .setDepth(202);

    this.border.setVisible(false);
    this.box.setVisible(false);
    this.text.setVisible(false);
    this.namePlate.setVisible(false);
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
    // choice keys only count while the choices show; they are the scene's
    // move keys too, but the scene stands still while the box is up
    const step = (dir: number) => () => {
      if (this.choosing) this.choiceStep += dir;
    };
    for (const code of ["LEFT", "UP", "H", "K"] as const) {
      kb.addKey(Phaser.Input.Keyboard.KeyCodes[code]).on(Phaser.Input.Keyboard.Events.DOWN, step(-1));
    }
    for (const code of ["RIGHT", "DOWN", "L", "J"] as const) {
      kb.addKey(Phaser.Input.Keyboard.KeyCodes[code]).on(Phaser.Input.Keyboard.Events.DOWN, step(1));
    }
    // Y takes the first choice and N the last, as the old Y/N prompts did:
    // also while the question's own page is still typing, which they cut
    // short. Dropped there, an N pressed before the choices showed left the
    // question up, and the ABYSS's stair took that for STAY.
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.Y).on(Phaser.Input.Keyboard.Events.DOWN, () => {
      if (this.choosing || this.typingQuestion()) this.pickQueued = 0;
    });
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.N).on(Phaser.Input.Keyboard.Events.DOWN, () => {
      if (this.choosing || this.typingQuestion()) this.pickQueued = this.choices.length - 1;
    });
    for (let i = 0; i < MAX_CHOICES; i++) {
      const t = scene.add
        .pixelText(lay.choiceX + i * lay.choicePitch, lay.choiceY, "", retroStyle(lay.choiceSize, "#f5f5f5"))
        .setScrollFactor(0)
        .setDepth(202)
        .setVisible(false);
      // a tap takes that choice outright; < and > only move the marker
      t.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
        if (this.choosing) this.tapQueued = i;
      });
      this.choiceTexts.push(t);
    }
  }

  start(lines?: string[], name?: string): void {
    this.open(lines, name, [], null);
  }

  /**
   * Like start(), then a row of 2-3 choices under the last page: LEFT/RIGHT
   * (or UP/DOWN, H/J/K/L) moves, Z/ENTER/SPACE takes the marked one, Y the
   * first and N the last (on the last page even before it has finished
   * typing); ESC, on any page, takes the last, so put the "no"
   * there — or `escPick`, when the safe answer must also be the marked one
   * (the first) and so can't be last. On touch the d-pad's < and > move and
   * a tap on a choice takes it. A Z or tap in the first CHOICE_GUARD_MS is
   * dropped. `onPick` runs after the box has closed, so it can open the next
   * talk. Picked in update(), like an ordinary advance, so the Z that picks
   * can't also reach the scene.
   */
  ask(lines: string[], name: string, choices: string[], onPick: (index: number) => void, escPick?: number): void {
    this.open(lines, name, choices.slice(0, MAX_CHOICES), onPick);
    if (escPick !== undefined) this.escPick = escPick;
  }

  private open(lines: string[] | undefined, name: string | undefined, choices: string[], onPick: ((index: number) => void) | null): void {
    this.choices = choices;
    this.onPick = onPick;
    this.escPick = choices.length - 1;
    this.choice = 0;
    this.choosing = false;
    this.choiceStep = 0;
    this.pickQueued = null;
    this.tapQueued = null;
    for (const t of this.choiceTexts) t.setVisible(false);
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
    this.namePlate.setSize(this.nameText.width + 2 * NAME_PAD_X, this.nameText.height + NAME_PAD_TOP).setVisible(this.nameText.visible);
    hideTouchButtons(this.scene, ["dpad"]);

    this.typeLine();
  }

  private typeLine(): void {
    // Pack lines until the box is full: callers pass sentence-sized strings,
    // and paging them one-per-keypress left most of the box empty. Counted as
    // wrapped: a row now holds two of those strings, so one a row (the old
    // estimate) filled half the box, and a "\n" takes a row of its own.
    const page: string[] = [];
    while (this.index + page.length < this.lines.length) {
      page.push(this.lines[this.index + page.length]);
      if (page.length > 1 && this.text.getWrappedText(page.join(" ")).length > ROWS_PER_PAGE) {
        page.pop();
        break;
      }
    }
    // a question's last page keeps the fourth row for its choices (on touch,
    // the d-pad's rows too): what doesn't fit moves on to a page of its own.
    const questionRows = this.layout.questionRows;
    while (
      this.choices.length > 0 &&
      this.index + page.length === this.lines.length &&
      page.length > 1 &&
      this.text.getWrappedText(page.join(" ")).length > questionRows
    ) {
      page.pop();
    }
    if (page.length === 0) {
      this.close();
      return;
    }
    this.pageSize = page.length;
    // Space-join so setWordWrapWidth wraps only at the real box width; "\n"
    // forced every fragment onto its own row even at half-filled width.
    this.pageText = page.join(" ");
    this.text.setText(this.pageText);
    this.typing = true;
    this.charIndex = 0;
    this.timer = this.scene.time.addEvent({
      delay: 22 / GameState.textSpeed,
      repeat: this.pageText.length,
      callback: () => {
        this.charIndex++;
        this.text.reveal(this.charIndex);
        if (this.charIndex >= this.pageText.length) {
          this.typing = false;
          this.timer?.remove();
          this.showChoicesIfLast();
        }
      },
    });
  }

  update(): void {
    if (!this.active) return;
    if (this.escQueued) {
      this.escQueued = false;
      if (this.choices.length > 0) this.pick(this.escPick);
      else this.close();
      return;
    }
    if (this.choosing) {
      if (this.choiceStep !== 0) {
        const n = this.choices.length;
        this.choice = (((this.choice + this.choiceStep) % n) + n) % n;
        this.choiceStep = 0;
        this.renderChoices();
      }
      if (this.pickQueued !== null) this.pick(this.pickQueued);
      else if (this.advanceQueued || this.tapQueued !== null) {
        const now = this.scene.time.now;
        // too soon after the choices showed to be meant (CHOICE_GUARD_MS)
        if (now < this.confirmAfter) this.confirmAfter = now + CHOICE_GUARD_MS;
        else this.pick(this.tapQueued ?? this.choice);
      }
      this.advanceQueued = false;
      this.tapQueued = null;
      return;
    }
    // a Y/N while the question's page types: the rest of it would only be
    // read past, so the answer stands now
    if (this.pickQueued !== null) {
      this.typing = false;
      this.timer?.remove();
      this.pick(this.pickQueued);
      return;
    }
    if (!this.advanceQueued) return;
    this.advanceQueued = false;

    if (this.typing) {
      this.typing = false;
      this.timer?.remove();
      this.text.reveal(this.pageText.length);
      this.showChoicesIfLast();
      return;
    }
    this.index += this.pageSize;
    if (this.index < this.lines.length) {
      this.typeLine();
    } else {
      this.close();
    }
  }

  // a question's last page, still typing (Y/N are already answers there)
  private typingQuestion(): boolean {
    return this.active && this.typing && this.choices.length > 0 && this.index + this.pageSize >= this.lines.length;
  }

  // the last page of a question has finished typing: show its choices
  private showChoicesIfLast(): void {
    if (this.choices.length === 0 || this.index + this.pageSize < this.lines.length) return;
    this.choosing = true;
    this.choiceStep = 0;
    // pickQueued is left as it is: a Y/N pressed while this page typed
    this.tapQueued = null;
    this.confirmAfter = this.scene.time.now + CHOICE_GUARD_MS;
    // < and > back for the choices (close() brings back the rest)
    if (this.touch) hideTouchButtons(this.scene, ["updown"]);
    this.renderChoices();
  }

  private renderChoices(): void {
    this.choiceTexts.forEach((t, i) => {
      const label = this.choices[i];
      const picked = i === this.choice;
      t.setVisible(label !== undefined);
      if (label !== undefined) t.setText(`${picked ? ">" : " "} ${label}`).setColor(picked ? PICKED_COLOR : "#f5f5f5");
    });
  }

  private pick(index: number): void {
    const onPick = this.onPick;
    this.close();
    onPick?.(index);
  }

  private close(): void {
    this.active = false;
    this.choosing = false;
    this.choices = [];
    this.onPick = null;
    for (const t of this.choiceTexts) t.setVisible(false);
    this.border.setVisible(false);
    this.box.setVisible(false);
    this.text.setVisible(false);
    this.namePlate.setVisible(false);
    this.nameText.setVisible(false);
    hideTouchButtons(this.scene, []);
  }

  isActive(): boolean {
    return this.active;
  }

  destroy(): void {
    this.timer?.remove();
    this.border.destroy();
    this.box.destroy();
    this.text.destroy();
    this.namePlate.destroy();
    this.nameText.destroy();
    for (const t of this.choiceTexts) t.destroy();
    // keys are shared instances from kb.addKey (same keycode → same object);
    // destroying them would wipe other panels' listeners. Scene shutdown
    // already tears every Key down via KeyboardPlugin.removeAllKeys(true).
  }
}
