import Phaser from "phaser";
import { Sfx } from "../audio";
import { COMPANION_SKILLS } from "../companionSkills";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { GameState } from "../gameState";
import { CATCHABLE, ENEMIES, type EnemyDef, type EnemySpecial } from "../monsters";
import { DIM_TEXT, retroStyle } from "../pixelart";
import { isTouchDevice } from "./TouchControls";

const SPECIES = Object.values(ENEMIES);

// Fixed pages of two columns x five rows, with the same pager as
// AchievementsUI. Shrinking the row gap to fit every species on one page ran
// out at 22 (a name+note block met the next row's), so the gap now stays put
// and a new species only ever adds a page.
const COLS = 2;
const ROWS = 5;
const PER_PAGE = COLS * ROWS;
const PAGES = Math.max(1, Math.ceil(SPECIES.length / PER_PAGE));
// a row is a 40px block (24px name over a 16px note) centered on its y, so
// 52 leaves 12px between rows
const ROW_GAP = 52;
const ROW_HALF = 20;
const ICON_SCALE = (ROW_GAP / 80) * 0.9;
// not wider: a touch device's menu-button strip starts at x=1220
const PANEL_W = 1160;
const COL_W = 560;
// per column: icon, then the name far enough right to clear the widest sprite
const COL_X = GAME_WIDTH / 2 - PANEL_W / 2 + 40;
const ICON_DX = 30;
const NAME_DX = 80;
// a name line's room before the next column (col 2: before the panel edge)
const NAME_W = COL_W - NAME_DX - 20;

// Pinned near the top like AchievementsUI and laid out top to bottom: title
// (32px), hint (16px), the rows, the pager (20px), then the counter sized for
// its worst case, three lines (with a companion) 8px apart. It all ends at
// y=504, above the touch d-pad (y>=508) and Z (y>=532).
const PANEL_TOP = 28;
const TITLE_Y = PANEL_TOP + 36;
const HINT_Y = PANEL_TOP + 72;
const ROW_Y = HINT_Y + 8 + 16 + ROW_HALF;
const PAGER_Y = ROW_Y + (ROWS - 1) * ROW_GAP + ROW_HALF + 12 + 10;
const COUNTER_LINE_SPACING = 8;
const COUNTER_H = 3 * 24 + 2 * COUNTER_LINE_SPACING;
const COUNTER_TOP = PAGER_Y + 10 + 12;
const PANEL_H = COUNTER_TOP + COUNTER_H + 20 - PANEL_TOP;

// The hint's line doubles as the panel's message line, like the shop's and
// the forge's: a companion picked, a refusal or the all-caught news stands in
// for the hint a moment. As toasts they landed on this panel (the town's at
// y 100 on the hint, the fields' at y 176 on the first rows). retroStyle(5)
// is 20px a glyph: the longest, "ALL CAUGHT! SEE THE ELDER" (25, 500px: x
// 390..890) and "COMPANION: " + an 11-glyph MAGMA SLIME (22, 440px), sit well
// inside the panel (x 60..1220), and the line (y 90..110) clears the title
// (to y 80) and the first row (from y 124).
const MSG_HOLD_MS = 1400;
const NEWS_HOLD_MS = 2600;

// A seen species' combat notes (weakness, special move, enrage) sit on a
// small second line under its name. Sharing the name's line meant
// abbreviating and then measure-and-dropping them, and once specials were
// added most of the roster ran out of column width.
const NAME_DY = -8;
const NOTE_DY = 12;
const SPECIAL_NOTE: Record<EnemySpecial["kind"], string> = { poison: "POISON", freeze: "FREEZE", regen: "REGEN" };

// longest is "WEAK:FIRE  FREEZE  ENRAGE" (25 x 16 = 400px), well inside
// NAME_W
function speciesNote(def: EnemyDef): string {
  return [
    def.weakness ? `WEAK:${def.weakness.toUpperCase()}` : "",
    def.special ? SPECIAL_NOTE[def.special.kind] : "",
    // every boss/giant enrages once at low HP (BattleScene.enemyTurn)
    def.boss || def.giant ? "ENRAGE" : "",
  ]
    .filter(Boolean)
    .join("  ");
}

const slotX = (s: number): number => COL_X + Math.floor(s / ROWS) * COL_W;
const slotY = (s: number): number => ROW_Y + (s % ROWS) * ROW_GAP;

export class BestiaryUI {
  private scene: Phaser.Scene;
  private active = false;
  private allCaughtShown = false;
  // index runs over all of SPECIES; page always holds it
  private index = 0;
  private page = 0;

  private dim: Phaser.GameObjects.Rectangle;
  private panel: Phaser.GameObjects.Rectangle;
  private title: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;
  private msg: Phaser.GameObjects.Text;
  private msgTimer?: Phaser.Time.TimerEvent;
  private pager: Phaser.GameObjects.Text;
  private counter: Phaser.GameObjects.Text;
  // one icon/name/note set per slot on a page, refilled on every page turn
  private icons: Phaser.GameObjects.Sprite[] = [];
  private rows: Phaser.GameObjects.Text[] = [];
  private notes: Phaser.GameObjects.Text[] = [];
  private cursor: Phaser.GameObjects.Text;

  private keyEsc: Phaser.Input.Keyboard.Key;
  private keyB: Phaser.Input.Keyboard.Key;
  private keyUp: Phaser.Input.Keyboard.Key;
  private keyDown: Phaser.Input.Keyboard.Key;
  private keyLeft: Phaser.Input.Keyboard.Key;
  private keyRight: Phaser.Input.Keyboard.Key;
  private keyH: Phaser.Input.Keyboard.Key;
  private keyJ: Phaser.Input.Keyboard.Key;
  private keyK: Phaser.Input.Keyboard.Key;
  private keyL: Phaser.Input.Keyboard.Key;
  private keyZ: Phaser.Input.Keyboard.Key;
  private closeQueued = false;
  private upQueued = false;
  private downQueued = false;
  private leftQueued = false;
  private rightQueued = false;
  private zQueued = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
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
      .text(GAME_WIDTH / 2, TITLE_Y, "BESTIARY", retroStyle(8, "#ffd166"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    this.hint = scene.add
      .text(
        GAME_WIDTH / 2,
        HINT_Y,
        isTouchDevice() ? "TAP OR D-PAD+Z A CAUGHT MONSTER TO SET COMPANION" : "CLICK OR HJKL+Z A CAUGHT MONSTER TO SET COMPANION",
        retroStyle(4, DIM_TEXT),
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    this.msg = scene.add
      .text(GAME_WIDTH / 2, HINT_Y, "", retroStyle(5, "#f5f5f5"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    // the arrows are tappable too: the left half turns back, the right on
    this.pager = scene.add
      .text(GAME_WIDTH / 2, PAGER_Y, "", retroStyle(5, "#9f9fd0"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    this.pager.setInteractive({ useHandCursor: true }).on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.turnPage(p.x < this.pager.x ? -1 : 1);
    });
    // top-anchored at its reserved slot, so a two-line counter (no companion)
    // just ends higher instead of creeping up toward the pager
    this.counter = scene.add
      .text(GAME_WIDTH / 2, COUNTER_TOP, "", retroStyle(6, "#8ecbff"))
      .setOrigin(0.5, 0)
      .setLineSpacing(COUNTER_LINE_SPACING)
      .setAlign("center")
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);

    for (let s = 0; s < PER_PAGE; s++) {
      const x = slotX(s);
      const y = slotY(s);
      const icon = scene.add
        .sprite(x + ICON_DX, y, SPECIES[0].texture)
        // the source art is a full 64px tile; 1.4x overlapped the rows above
        // and below it, so keep it just under the row gap
        .setScale(ICON_SCALE)
        .setScrollFactor(0)
        .setDepth(152)
        .setVisible(false);
      this.icons.push(icon);
      const row = scene.add
        .text(x + NAME_DX, y, "", retroStyle(6, DIM_TEXT))
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(152)
        .setVisible(false);
      this.rows.push(row);
      const note = scene.add
        .text(x + NAME_DX, y + NOTE_DY, "", retroStyle(4, "#9f9fd0"))
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(152)
        .setVisible(false);
      this.notes.push(note);

      // click/tap a caught species to make it the battle companion (HJKL+Z
      // does the same thing via trySelectCompanion, see update()); a click on
      // an unseen "???" row (still hit-testable — Text keeps its full box
      // even when showing the placeholder) is a no-op via the caught check
      const select = () => this.selectSlot(s);
      icon.setInteractive({ useHandCursor: true }).on("pointerdown", select);
      row.setInteractive({ useHandCursor: true }).on("pointerdown", select);
      note.setInteractive({ useHandCursor: true }).on("pointerdown", select);
    }
    this.cursor = scene.add.text(0, 0, ">", retroStyle(6, "#ffd166")).setOrigin(0.5).setScrollFactor(0).setDepth(152).setVisible(false);

    const kb = scene.input.keyboard!;
    this.keyEsc = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyB = kb.addKey(Phaser.Input.Keyboard.KeyCodes.B);
    const queueClose = () => {
      this.closeQueued = true;
    };
    this.keyEsc.on(Phaser.Input.Keyboard.Events.DOWN, queueClose);
    this.keyB.on(Phaser.Input.Keyboard.Events.DOWN, queueClose);

    // HJKL/arrows move a cursor over the columns, Z confirms — same scheme as
    // InventoryUI. LEFT/RIGHT past a page's outer column turn the page (the
    // touch d-pad sends the arrows), see update()
    this.keyUp = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyDown = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.keyLeft = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keyRight = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keyH = kb.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    this.keyJ = kb.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.keyK = kb.addKey(Phaser.Input.Keyboard.KeyCodes.K);
    this.keyL = kb.addKey(Phaser.Input.Keyboard.KeyCodes.L);
    this.keyZ = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    const DOWN = Phaser.Input.Keyboard.Events.DOWN;
    const queue = (flag: "upQueued" | "downQueued" | "leftQueued" | "rightQueued") => () => {
      this[flag] = true;
    };
    this.keyUp.on(DOWN, queue("upQueued"));
    this.keyK.on(DOWN, queue("upQueued"));
    this.keyDown.on(DOWN, queue("downQueued"));
    this.keyJ.on(DOWN, queue("downQueued"));
    this.keyLeft.on(DOWN, queue("leftQueued"));
    this.keyH.on(DOWN, queue("leftQueued"));
    this.keyRight.on(DOWN, queue("rightQueued"));
    this.keyL.on(DOWN, queue("rightQueued"));
    this.keyZ.on(DOWN, () => {
      this.zQueued = true;
    });
  }

  // a click or tap also moves the cursor there, so a Z afterwards agrees
  private selectSlot(s: number): void {
    const i = this.page * PER_PAGE + s;
    if (i >= SPECIES.length) return;
    this.index = i;
    this.renderCursor();
    this.trySelectCompanion(SPECIES[i]);
  }

  // shared by mouse click and the Z-key confirm
  private trySelectCompanion(def: EnemyDef): void {
    if (GameState.companion === def.name) return;
    if (!GameState.caught.includes(def.name)) {
      // seen-but-not-caught rows are selectable but did nothing here, which
      // looked identical to the click/key not registering at all
      Sfx.error();
      this.showMsg("NOT CAUGHT YET");
      return;
    }
    GameState.companion = def.name;
    Sfx.buy();
    this.showMsg(`COMPANION: ${def.name}`);
    GameState.save();
    this.refresh();
  }

  private showMsg(text: string, hold = MSG_HOLD_MS): void {
    this.msgTimer?.remove();
    this.msg.setText(text).setVisible(true);
    this.hint.setVisible(false);
    this.msgTimer = this.scene.time.addEvent({ delay: hold, callback: () => this.clearMsg() });
  }

  private clearMsg(): void {
    this.msgTimer?.remove();
    this.msgTimer = undefined;
    this.msg.setText("").setVisible(false);
    this.hint.setVisible(this.active);
  }

  open(): void {
    this.active = true;
    this.index = 0;
    this.page = 0;
    this.closeQueued = false;
    this.upQueued = false;
    this.downQueued = false;
    this.leftQueued = false;
    this.rightQueued = false;
    this.zQueued = false;
    this.dim.setVisible(true);
    this.panel.setVisible(true);
    this.title.setVisible(true);
    this.hint.setVisible(true);
    this.pager.setVisible(true);
    this.counter.setVisible(true);
    for (const t of this.rows) t.setVisible(true);
    for (const t of this.notes) t.setVisible(true);
    this.cursor.setVisible(true);
    this.refresh();
  }

  close(): void {
    this.active = false;
    this.clearMsg();
    this.dim.setVisible(false);
    this.panel.setVisible(false);
    this.title.setVisible(false);
    this.hint.setVisible(false);
    this.pager.setVisible(false);
    this.counter.setVisible(false);
    for (const s of this.icons) s.setVisible(false);
    for (const t of this.rows) t.setVisible(false);
    for (const t of this.notes) t.setVisible(false);
    this.cursor.setVisible(false);
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
    const prev = this.index;
    const n = SPECIES.length;
    if (this.upQueued) {
      this.upQueued = false;
      this.index = (this.index + n - 1) % n;
    }
    if (this.downQueued) {
      this.downQueued = false;
      this.index = (this.index + 1) % n;
    }
    if (this.leftQueued || this.rightQueued) {
      const dir = this.rightQueued ? 1 : -1;
      this.leftQueued = false;
      this.rightQueued = false;
      // the columns of every page read as one strip, so stepping past a
      // page's outer column lands on the next (or previous) page, wrapping
      // like the pager; a short last column clamps to its last species
      const strips = Math.ceil(n / ROWS);
      const strip = (Math.floor(this.index / ROWS) + dir + strips) % strips;
      this.index = Math.min(strip * ROWS + (this.index % ROWS), n - 1);
    }
    if (this.index !== prev) {
      Sfx.move();
      const page = Math.floor(this.index / PER_PAGE);
      if (page !== this.page) {
        this.page = page;
        this.refresh();
      } else {
        this.renderCursor();
      }
    }
    if (this.zQueued) {
      this.zQueued = false;
      this.trySelectCompanion(SPECIES[this.index]);
    }
  }

  private turnPage(dir: number): void {
    if (PAGES === 1) return;
    this.page = (this.page + dir + PAGES) % PAGES;
    // same slot on the new page, or its last species if that page is shorter
    this.index = Math.min(this.page * PER_PAGE + (this.index % PER_PAGE), SPECIES.length - 1);
    Sfx.move();
    this.refresh();
  }

  private renderCursor(): void {
    const target = this.rows[this.index % PER_PAGE];
    this.cursor.setPosition(target.x - 26, target.y);
  }

  private refresh(): void {
    // CAUGHT is scored against CATCHABLE — bosses appear in the list but can
    // never be caught, so counting them would make 100% unreachable.
    const seen = SPECIES.filter((def) => GameState.seenMonsters.includes(def.name)).length;
    const caught = CATCHABLE.filter((def) => GameState.caught.includes(def.name)).length;
    const title = GameState.bestiaryTitle();
    const bonus = GameState.bestiaryBonus();
    // "BOND+n ATK" lost its " ATK" to make room for the skill: at 24px a
    // glyph the line has 1080px (45 glyphs) and the longest pairing, "FIRE
    // IMP" + "FIREBALL", makes it 43 (1032px). companionSkills.ts keeps any
    // new species within that.
    const skill = GameState.companion ? COMPANION_SKILLS[GameState.companion] : undefined;
    const companionLine = GameState.companion
      ? `\nCOMPANION: ${GameState.companion}  BOND+${GameState.companionBondBonus(GameState.companion)}${skill ? `  SKILL:${skill.name}` : ""}`
      : "";
    this.counter.setText(
      `SEEN ${seen}/${SPECIES.length}  CAUGHT ${caught}/${CATCHABLE.length}${title ? `  RANK:${title}` : ""}\n` +
        `COMPLETION BONUS ATK+${bonus} DEF+${bonus}${companionLine}`,
    );
    if (caught === CATCHABLE.length && !this.allCaughtShown) {
      this.allCaughtShown = true;
      this.showMsg("ALL CAUGHT! SEE THE ELDER", NEWS_HOLD_MS);
    }
    this.pager.setText(PAGES > 1 ? `< PAGE ${this.page + 1}/${PAGES} >` : "PAGE 1/1");
    for (let s = 0; s < PER_PAGE; s++) {
      const def = SPECIES[this.page * PER_PAGE + s];
      const icon = this.icons[s];
      const row = this.rows[s];
      // the last page's unused slots are blanked, not hidden, so open/close
      // stay the only things that toggle the texts' visibility
      if (!def) {
        icon.setVisible(false);
        row.setText("");
        this.notes[s].setText("");
        continue;
      }
      const rowSeen = GameState.seenMonsters.includes(def.name);
      const rowCaught = GameState.caught.filter((n) => n === def.name).length;
      const isCompanion = rowCaught > 0 && def.name === GameState.companion;
      icon.setTexture(def.texture).setVisible(rowSeen);
      const note = rowSeen ? speciesNote(def) : "";
      // a row without a note (unseen, or a plain SLIME) keeps its name
      // centered on the icon instead of floating above an empty line
      row.setY(slotY(s) + (note ? NAME_DY : 0)).setColor(!rowSeen ? DIM_TEXT : isCompanion ? "#4ade80" : "#ffffff");
      this.notes[s].setText(note);
      if (!rowSeen) {
        row.setText("???");
        continue;
      }
      // "★ CURSED GOBLIN (x1)" ran 17px past NAME_W; the count sheds its
      // parentheses first ("x1" fits every current name), then goes
      const star = isCompanion ? "★ " : "";
      const labels = rowCaught > 0 ? [`${star}${def.name} (x${rowCaught})`, `${star}${def.name} x${rowCaught}`] : [];
      labels.push(`${star}${def.name}`);
      for (const label of labels) {
        row.setText(label);
        if (row.width <= NAME_W) break;
      }
    }
    this.renderCursor();
  }

  destroy(): void {
    this.dim.destroy();
    this.panel.destroy();
    this.title.destroy();
    this.msgTimer?.remove();
    this.hint.destroy();
    this.msg.destroy();
    this.pager.destroy();
    this.counter.destroy();
    for (const s of this.icons) s.destroy();
    for (const t of this.rows) t.destroy();
    for (const t of this.notes) t.destroy();
    this.cursor.destroy();
    // keys are shared instances from kb.addKey (same keycode → same object);
    // destroying them would wipe other panels' listeners. Scene shutdown
    // already tears every Key down via KeyboardPlugin.removeAllKeys(true).
  }
}
