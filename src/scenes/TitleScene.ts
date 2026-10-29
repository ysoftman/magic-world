import Phaser from "phaser";
import { Sfx, TITLE_THEME } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH, VERSION_TAG } from "../config";
import { warmEncounterOut } from "../fx";
import {
  damagedCopyKeys,
  deleteDamagedCopies,
  GameState,
  isSaveDamaged,
  onSaveFailed,
  readBackupSummary,
  readSaveSummary,
  SAVE_SLOTS,
} from "../gameState";
import { DIM_TEXT, retroStyle, showToast } from "../pixelart";
import { GEAR_LAYOUT } from "../ui/HeroGear";
import { LookPicker } from "../ui/LookPicker";
import { NameEntry } from "../ui/NameEntry";
import { SettingsUI } from "../ui/SettingsUI";
import { questLabel } from "../ui/StatusHud";
import { isTouchDevice } from "../ui/TouchControls";
import { bakeHero, HERO_LOOKS } from "./BootScene";

// One save card per slot, side by side in the band between the subtitle
// (bottom y=432) and the prompt (top y=576). Each has three retroStyle(5)
// lines, 20px each (Press Start 2P measures exactly 1em) with 8px between,
// plus 12px padding: 100px tall at y=454..554, 22px clear of both. A save's
// card shows its hero beside the bottom two lines: the look and the worn
// sword and shield at the art's own 1px a cell (32px), 8px clear of the
// lines, which go left-aligned after it. Those two lines then have 16 x 20 =
// 320px — "LV 30 SLIMES 5/5" (every quest label is at most 10; one space
// after the level, not the two it had) and a name of 12 — so the card is
// 20 + 32 + 8 + 320 + 20 = 400px; three with 20px between span x=20..1260.
// The header, "< SLOT 1 NG+99 >" at 16, and an empty or damaged slot's lines
// stay centered across the full 360px: an empty slot's free third line says
// when damaged copies of it are kept aside, "DAMAGED COPY KEPT" and "99
// DAMAGED COPIES" both 17 = 340px. The old single card's gold/day/beasts/
// trophies lines don't fit three across, so a card keeps who (name, look),
// how far (level, quest step) and which cycle.
const CARD_Y = 504;
const CARD_LINE_GAP = 8;
const CARD_PAD_X = 20;
const CARD_PAD_Y = 12;
const PREVIEW = 32;
const PREVIEW_GAP = 8;
const CARD_W = CARD_PAD_X + PREVIEW + PREVIEW_GAP + 16 * 5 * 4 + CARD_PAD_X;
// the hero beside the bottom two lines, and where those lines start
const PREVIEW_X = -CARD_W / 2 + CARD_PAD_X + PREVIEW / 2;
const PREVIEW_Y = (20 + CARD_LINE_GAP) / 2;
const SIDE_X = -CARD_W / 2 + CARD_PAD_X + PREVIEW + PREVIEW_GAP;
// The gear as GEAR_LAYOUT.down holds it, but the sword in close to the body:
// held out in the hand (x 22) its blade ran 8px past the 32px box into the
// "LV" beside it. The blade's art ends 13px right of its grip at half size,
// so a grip at x 6 (3px right of centre) keeps the tip inside the box, the
// full 8px gap to the lines; the shield's art already sits inside it.
const CARD_GEAR = { weapon: { x: 6, y: GEAR_LAYOUT.down.weapon.y }, shield: GEAR_LAYOUT.down.shield };
const CARD_H = 3 * 20 + 2 * CARD_LINE_GAP + CARD_PAD_Y * 2;
const CARD_GAP = 20;
const cardX = (slot: number): number => GAME_WIDTH / 2 + (slot - (SAVE_SLOTS + 1) / 2) * (CARD_W + CARD_GAP);

// Menu row of tappable buttons, retroStyle(6) = 24px a char. With a save:
// "C: CONTINUE" 264 + "N: NEW GAME" 264 + "D: DELETE" 216 + "O: SETTINGS"
// 264 = 1008px, +6px stroke each = 1032px, plus 3 x 48px gaps = 1176px,
// x=52..1228. The old single hint line ran 1248px, 16px off each screen edge.
const MENU_Y = 660;
// Once NEW GAME+ is open, five buttons (~1500px) no longer fit one row, so the
// menu splits in two. y=636: "C: CONTINUE" + "P: NEW GAME+" = 270 + 294 + 48
// = 612px, x=334..946; y=684: "N: NEW GAME" + "D: DELETE" + "O: SETTINGS" =
// 270 + 222 + 270 + 96 = 858px, x=211..1069. Glyphs run 624..648 (16px under
// the prompt's 608) and 672..699 (21px off the bottom); the padded hit boxes
// meet at 660 without overlapping. Row two is also why the version tag is up
// in the top-right corner (see create()).
// U: RESTORE (240 + 6 stroke = 246px) joins row one when the slot has a
// backup: "C: CONTINUE" + "P: NEW GAME+" + "U: RESTORE" = 270 + 294 + 246 +
// 2 x 48 = 906px (x 187..1093); without NEW GAME+ it is C + U = 564px. A
// damaged slot's single row N + D + U + O is 1152px (x 64..1216), an empty
// slot's N + U + O 882px — both inside the 1176px four-button row.
// X: DAMAGED (246px, as U) comes up when the slot has damaged copies kept
// aside, and goes in row one: C + P + U + X = 1200px (x 40..1240); a save
// with neither P nor U splits into C + X 564px over N + D + O. An empty
// slot's N + U + X + O is 1176px on one row; a damaged slot's splits into
// N + D + U 834px over X + O 564px (x 358..922).
const MENU_ROWS_Y = [636, 684];
const MENU_GAP = 48;
const MENU_STROKE = 6;
// taps land on a padded box, not just the glyphs
const BUTTON_PAD = 12;

type Mode = "menu" | "confirmDelete" | "confirmNew" | "confirmPlus" | "confirmRestore" | "confirmPurge";

// GameState.save() reports a full storage instead of throwing; this tells
// the player in whichever scene is up. Hooked once for the whole game — the
// title is the first scene every session opens — not once per visit here.
let saveFailHooked = false;
type Button = [label: string, run: () => void];

export class TitleScene extends Phaser.Scene {
  private started = false;
  private settingsUI?: SettingsUI;
  private lookPicker?: LookPicker;
  private nameEntry?: NameEntry;
  private buttons: Phaser.GameObjects.Text[] = [];

  constructor() {
    super("Title");
  }

  create(): void {
    this.started = false;
    this.buttons = [];
    Sfx.playBgm(TITLE_THEME);
    // every game passes through here before its first encounter
    warmEncounterOut(this.cameras.main);

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "title-bg");

    const title = this.add.text(GAME_WIDTH / 2, 216, "MAGIC WORLD", retroStyle(24, "#ffd166")).setOrigin(0.5);
    title.setShadow(8, 8, "#7c2d12", 1, true, true);

    this.add.text(GAME_WIDTH / 2, 368, "A TALE OF MAGIC", retroStyle(8, "#c4b5fd")).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 416, "AND ADVENTURE", retroStyle(8, "#c4b5fd")).setOrigin(0.5);

    // Top right, not bottom right: with the commit hash, "v0.1.0-3a09b68" is
    // 14 x 16 = 224px (x 1040..1264, y 12..28), and down at y 692..708 it ran
    // into the menu's second row (x 211..1069, y 669..699) — every glyph more
    // in the hash is 16px further left. Nothing else is drawn up here but the
    // toast, at most 604px wide centred (x 338..942), and the backdrop keeps its
    // stars out from behind it (backdrops.ts). DIM_TEXT, not #666688: 3.4:1 on
    // this sky was too faint to read the hash off.
    this.add.text(GAME_WIDTH - 16, 12, VERSION_TAG, retroStyle(4, DIM_TEXT)).setOrigin(1, 0);

    // one card per slot; tapping a card picks that slot, tapping the picked
    // one again is ENTER (continue it, or start a new game in it)
    const cards = Array.from({ length: SAVE_SLOTS }, (_, i) => {
      const slot = i + 1;
      const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, 0x0b0b2b, 0.85);
      const lines = [
        this.add.text(0, -(20 + CARD_LINE_GAP), "", retroStyle(5, "#9f9fd0")).setOrigin(0.5),
        this.add.text(0, 0, "", retroStyle(5, "#ffffff")).setOrigin(0.5),
        this.add.text(0, 20 + CARD_LINE_GAP, "", retroStyle(5, "#fb923c")).setOrigin(0.5),
      ];
      // the hero at half its 64px texture: each 2px cell of the 32-cell art
      // lands on one screen pixel, so nothing is resampled unevenly
      const hero = [
        this.add.image(PREVIEW_X, PREVIEW_Y, "hero-look-0").setScale(0.5),
        this.add.image(PREVIEW_X + CARD_GEAR.shield.x / 2, PREVIEW_Y + CARD_GEAR.shield.y / 2, "equip-shield").setScale(0.5),
        this.add.image(PREVIEW_X + CARD_GEAR.weapon.x / 2, PREVIEW_Y + CARD_GEAR.weapon.y / 2, "equip-sword").setScale(0.5),
      ] as const;
      this.add.container(cardX(slot), CARD_Y, [bg, ...lines, ...hero]);
      bg.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
        Sfx.ensure();
        if (settings.isActive()) return;
        if (mode !== "menu") showMenu();
        else if (slot === GameState.saveSlot) enter();
        else pickSlot(slot);
      });
      return { bg, lines, hero };
    });

    const prompt = this.add.text(GAME_WIDTH / 2, 592, "", retroStyle(8, "#ffffff")).setOrigin(0.5);
    // The line blinks only as the menu's own (PRESS ENTER, TAP TO START); a
    // question, a refusal or the DAMAGED warning put in it holds still.
    // Blinking, it was gone half the time, and "RESTORE QA2 LV25? Y/N" is the
    // one place that says which save comes back.
    let blinking = false;
    const blink = (on: boolean) => {
      if (on === blinking) return;
      blinking = on;
      this.tweens.killTweensOf(prompt);
      prompt.setAlpha(1);
      if (on) this.tweens.add({ targets: prompt, alpha: 0, duration: 500, yoyo: true, repeat: -1 });
    };
    blink(true);

    const settings = new SettingsUI(this);
    this.settingsUI = settings;
    const picker = new LookPicker(this);
    this.lookPicker = picker;
    const nameEntry = new NameEntry(this);
    this.nameEntry = nameEntry;

    if (!saveFailHooked) {
      saveFailHooked = true;
      const game = this.game;
      // a status line, no "!", so it shows over a panel at once; the longer,
      // "SAVE FAILED: STORAGE BLOCKED", is 28 x 20 = 560px
      onSaveFailed((why) => {
        const up = game.scene.getScenes(true);
        const top = up[up.length - 1];
        if (top) showToast(top, why === "full" ? "SAVE FAILED: STORAGE FULL" : "SAVE FAILED: STORAGE BLOCKED");
      });
    }

    const touch = isTouchDevice();
    let mode: Mode = "menu";

    // Read straight from localStorage: GameState.load() would assign the save
    // into GameState just to draw it. The quest step is the HUD's own label.
    // The picked slot is framed in gold and its header gets the arrows the
    // keyboard moves it with.
    const renderCards = () => {
      cards.forEach(({ bg, lines, hero }, i) => {
        const slot = i + 1;
        const picked = slot === GameState.saveSlot;
        const save = readSaveSummary(slot);
        // a save that won't parse: kept as it is, shown but not loadable
        const damaged = isSaveDamaged(slot);
        const header = `SLOT ${slot}${save && save.ngPlus > 0 ? ` NG+${save.ngPlus}` : ""}`;
        lines[0].setText(picked ? `< ${header} >` : header).setColor(picked ? "#ffd166" : "#9f9fd0");
        lines[1].setText(damaged ? "DAMAGED" : save ? save.name : "EMPTY").setColor(damaged ? "#ff5555" : save ? "#ffffff" : DIM_TEXT);
        const kept = !damaged && !save ? damagedCopyKeys(slot).length : 0;
        lines[2]
          .setText(
            damaged
              ? "CAN'T LOAD"
              : save
                ? `LV ${save.level} ${questLabel(save.quest, save.caught)}`
                : kept > 1
                  ? `${kept} DAMAGED COPIES`
                  : kept
                    ? "DAMAGED COPY KEPT"
                    : "",
          )
          .setColor(kept ? "#ff5555" : "#fb923c");
        // a save's hero beside its two lines, which then start after it; an
        // empty or damaged slot keeps them centered and draws no hero
        const [figure, shield, sword] = hero;
        for (const line of [lines[1], lines[2]]) line.setOrigin(save ? 0 : 0.5, 0.5).setX(save ? SIDE_X : 0);
        figure.setVisible(!!save).setTexture(`hero-look-${save && HERO_LOOKS[save.look] ? save.look : 0}`);
        shield.setVisible(!!save?.armor).setTexture(save?.armor ?? "equip-shield");
        sword.setVisible(!!save?.weapon).setTexture(save?.weapon ?? "equip-sword");
        bg.setStrokeStyle(picked ? 3 : 2, picked ? 0xffd166 : 0xffffff, picked ? 1 : 0.4).setFillStyle(0x0b0b2b, picked ? 0.92 : 0.7);
      });
    };

    const pickSlot = (slot: number) => {
      if (slot === GameState.saveSlot) return;
      GameState.setSaveSlot(slot);
      Sfx.move();
      showMenu();
    };

    // one row at MENU_Y, or two at MENU_ROWS_Y; each row centred on its own
    const setButtons = (rows: Button[][]) => {
      for (const b of this.buttons) b.destroy();
      this.buttons = [];
      rows.forEach((list, r) => {
        const y = rows.length === 1 ? MENU_Y : MENU_ROWS_Y[r];
        const row = list.map(([label, run]) => {
          // the dark stroke keeps "C: CONTINUE" legible over the pale crystal
          // in the background art's bottom-left corner
          const b = this.add.text(0, y, label, retroStyle(6, "#8ecbff")).setOrigin(0.5).setStroke("#0b0b2b", MENU_STROKE);
          b.setInteractive({
            hitArea: new Phaser.Geom.Rectangle(-BUTTON_PAD, -BUTTON_PAD, b.width + BUTTON_PAD * 2, b.height + BUTTON_PAD * 2),
            hitAreaCallback: Phaser.Geom.Rectangle.Contains,
            useHandCursor: true,
          });
          b.on("pointerover", () => b.setColor("#ffd166"));
          b.on("pointerout", () => b.setColor("#8ecbff"));
          b.on("pointerdown", () => {
            Sfx.ensure();
            if (!settings.isActive()) run();
          });
          return b;
        });
        const total = row.reduce((w, b) => w + b.width, 0) + MENU_GAP * (row.length - 1);
        let x = GAME_WIDTH / 2 - total / 2;
        for (const b of row) {
          b.setX(x + b.width / 2);
          x += b.width + MENU_GAP;
        }
        this.buttons.push(...row);
      });
    };

    // NEW GAME+ opens once the save has felled the FLAME DRAKE (the true end)
    const canPlus = () => readSaveSummary()?.quest.volcanoBoss === true;

    const showMenu = () => {
      mode = "menu";
      renderCards();
      const hasSave = GameState.hasSave();
      const damaged = isSaveDamaged();
      blink(!damaged);
      prompt
        .setText(
          damaged
            ? `SLOT ${GameState.saveSlot} IS DAMAGED`
            : hasSave
              ? touch
                ? "TAP TO CONTINUE"
                : "PRESS ENTER TO CONTINUE"
              : touch
                ? "TAP TO START"
                : "PRESS ENTER",
        )
        .setColor(damaged ? "#ff5555" : "#ffffff");
      const settingsButton: Button = ["O: SETTINGS", () => settings.open()];
      const restore: Button[] = GameState.hasBackup() ? [["U: RESTORE", askRestore]] : [];
      const plus: Button[] = canPlus() ? [["P: NEW GAME+", askPlus]] : [];
      const purge: Button[] = damagedCopyKeys().length > 0 ? [["X: DAMAGED", askPurge]] : [];
      if (!hasSave) {
        setButtons([[["N: NEW GAME", newGame], ...restore, ...purge, settingsButton]]);
      } else if (damaged) {
        const slotRow: Button[] = [["N: NEW GAME", newGame], ["D: DELETE", askDelete], ...restore];
        setButtons(purge.length > 0 ? [slotRow, [...purge, settingsButton]] : [[...slotRow, settingsButton]]);
      } else if (plus.length + restore.length + purge.length > 0) {
        setButtons([
          [["C: CONTINUE", () => start(true)], ...plus, ...restore, ...purge],
          [["N: NEW GAME", newGame], ["D: DELETE", askDelete], settingsButton],
        ]);
      } else {
        setButtons([[["C: CONTINUE", () => start(true)], ["N: NEW GAME", newGame], ["D: DELETE", askDelete], settingsButton]]);
      }
    };

    // back to the menu with why nothing happened in the prompt line; the
    // longest, "STORAGE FULL - SLOT 3 KEPT", is 26 x 32 = 832px (x 224..1056)
    const refuse = (why: string) => {
      showMenu();
      Sfx.error();
      prompt.setText(why).setColor("#ff5555");
      blink(false);
    };
    const storageFull = () => refuse(`STORAGE FULL - SLOT ${GameState.saveSlot} KEPT`);

    // ENTER, Z, SPACE and taps off the buttons: continue the slot, or start
    // fresh in an empty one; a damaged slot can only be started over (N)
    const enter = () => {
      if (isSaveDamaged()) {
        Sfx.error();
        return;
      }
      start(GameState.hasSave());
    };

    const confirm = (next: Mode, question: string, yesLabel: string) => {
      mode = next;
      Sfx.error();
      prompt.setText(question).setColor("#ff5555");
      blink(false);
      setButtons([
        [
          [yesLabel, yes],
          ["N: CANCEL", showMenu],
        ],
      ]);
    };

    // the questions name the slot they act on; the longest, "SLOT 3: NEW
    // GAME+? Y/N", is 22 x 32 = 704px (x 288..992)
    const askDelete = () => confirm("confirmDelete", `DELETE SLOT ${GameState.saveSlot}? Y/N`, "Y: DELETE");
    // the replay rewrites the save (quests, chests, half the gold), so it gets
    // the same Y/N as the other two
    const askPlus = () => confirm("confirmPlus", `SLOT ${GameState.saveSlot}: NEW GAME+? Y/N`, "Y: NEW GAME+");
    // names what comes back: "RESTORE TWELVECHARSX LV30? Y/N" is 30 x 32 =
    // 960px (x 160..1120). It swaps, so the save it replaces becomes the
    // backup and U again puts it back.
    const askRestore = () => {
      const prev = readBackupSummary();
      confirm("confirmRestore", `RESTORE ${prev ? `${prev.name} LV${prev.level}` : "BACKUP"}? Y/N`, "Y: RESTORE");
    };
    // "OLD" so it isn't read as the save in the slot now; "DELETE 12 OLD
    // DAMAGED COPIES? Y/N" is 33 x 32 = 1056px (x 112..1168)
    const askPurge = () => {
      const n = damagedCopyKeys().length;
      confirm("confirmPurge", n > 1 ? `DELETE ${n} OLD DAMAGED COPIES? Y/N` : "DELETE THE OLD DAMAGED COPY? Y/N", "Y: DELETE");
    };

    // starting over empties the slot on the spot (start() retires the save to
    // the slot's backup), so it gets the same Y/N as DELETE; with no save
    // there is nothing to lose and it starts straight away
    const newGame = () => {
      if (GameState.hasSave()) confirm("confirmNew", `OVERWRITE SLOT ${GameState.saveSlot}? Y/N`, "Y: NEW GAME");
      else start(false);
    };

    const yes = () => {
      if (mode === "confirmDelete") {
        // kept as the slot's backup, so a mistaken DELETE is one U away
        if (GameState.retireSave()) showMenu();
        else storageFull();
      } else if (mode === "confirmRestore") {
        if (GameState.restoreSave()) {
          Sfx.buy();
          showMenu();
        } else storageFull();
      } else if (mode === "confirmNew") {
        start(false);
      } else if (mode === "confirmPlus") {
        startPlus();
      } else if (mode === "confirmPurge") {
        deleteDamagedCopies();
        showMenu();
      }
    };

    // Saved straight away, so quitting before the first autosave can't drop
    // the player back into the cleared run with the replay half-applied.
    // The cleared run is kept as the slot's backup first; if that, the load or
    // the save is refused, the slot is left as it was and the title says so.
    const startPlus = () => {
      if (this.started) return;
      if (!GameState.load()) return refuse(`SLOT ${GameState.saveSlot} CAN'T LOAD`);
      GameState.beginNewGamePlus();
      bakeHero(this, GameState.heroLook);
      if (!GameState.backupSave() || !GameState.save()) return storageFull();
      this.started = true;
      Sfx.buy();
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start("Town", {});
      });
    };

    const start = (continueGame: boolean) => {
      if (this.started) return;
      if (continueGame) {
        // a save that parses but still won't load stays put, untouched
        if (!GameState.load()) return refuse(`SLOT ${GameState.saveSlot} CAN'T LOAD`);
        bakeHero(this, GameState.heroLook);
        this.started = true;
        Sfx.buy();
        // resume in the monster-free town center (PLAYER_SPAWN fallback)
        // instead of wherever the save happened, which can be mid-grass
        // next to a roamer and trigger an instant battle
        GameState.pos = undefined;
        // {} rather than nothing: Phaser keeps the last start()'s data when the
        // next passes none, and a stale { fromDungeon } from before the quit
        // would spawn the hero at that exit instead (the other two starts too)
        this.scene.start("Town", {});
        return;
      }
      GameState.reset();
      // the name in the game's own panel (ui/NameEntry.ts), then the look;
      // backing out of either leaves the slot as it was
      nameEntry.open((name) => {
        if (name === null) return showMenu();
        GameState.player.name = name;
        picker.open(GameState.heroLook, (look) => {
          if (look === null) return showMenu();
          GameState.heroLook = look;
          bakeHero(this, look);
          // the old save becomes the slot's backup (U: RESTORE brings it back)
          if (!GameState.retireSave()) return storageFull();
          this.started = true;
          this.cameras.main.fadeOut(400, 0, 0, 0);
          this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
            this.scene.start("Town", {});
          });
        });
      });
    };

    this.input.keyboard!.on("keydown", (e: KeyboardEvent) => {
      // holding Q through the world's save-and-quit would land repeat Q
      // events here and delete the save that was just written
      if (e.repeat) return;
      Sfx.ensure();
      if (settings.isActive() || picker.isActive() || nameEntry.isActive()) return;
      const key = e.key.toLowerCase();
      // as in the field and in battle; before the Y/N check so it doesn't back out
      if (key === "m") {
        showToast(this, Sfx.toggleMuted() ? "SOUND: OFF" : "SOUND: ON");
        return;
      }
      if (mode !== "menu") {
        // Y confirms; any other key backs out, as DELETE always has
        if (key === "y") yes();
        else showMenu();
        return;
      }
      // the slot picker: LEFT/RIGHT or H/L step through (wrapping), 1-3 jump
      if (key === "arrowleft" || key === "h" || key === "arrowright" || key === "l") {
        const step = key === "arrowleft" || key === "h" ? -1 : 1;
        pickSlot(((GameState.saveSlot - 1 + step + SAVE_SLOTS) % SAVE_SLOTS) + 1);
      } else if (/^[1-9]$/.test(key) && Number(key) <= SAVE_SLOTS) {
        pickSlot(Number(key));
      } else if (e.key === "Enter" || key === "z" || e.key === " ") {
        enter();
      } else if (key === "n") {
        newGame();
      } else if (key === "c" && GameState.hasSave() && !isSaveDamaged()) {
        start(true);
      } else if (key === "d" && GameState.hasSave()) {
        askDelete();
      } else if (key === "u" && GameState.hasBackup()) {
        askRestore();
      } else if (key === "p" && canPlus()) {
        askPlus();
      } else if (key === "x" && damagedCopyKeys().length > 0) {
        askPurge();
      } else if (key === "o") {
        settings.open();
      }
    });
    // A tap off the buttons is ENTER, as it always was: continue the save, or
    // start fresh when there is none. During a Y/N it backs out instead.
    this.input.on("pointerdown", (_pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      Sfx.ensure();
      if (settings.isActive() || picker.isActive() || nameEntry.isActive() || over.length > 0) return;
      if (mode !== "menu") showMenu();
      else enter();
    });

    showMenu();
  }

  // SettingsUI closes via a queued flag processed in update(); without this
  // override the panel would open on O and never close again.
  update(): void {
    this.settingsUI?.update();
    this.nameEntry?.update();
    this.lookPicker?.update();
  }
}
