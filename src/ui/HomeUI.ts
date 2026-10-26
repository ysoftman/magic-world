import Phaser from "phaser";
import { Sfx } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { addIngredient, INGREDIENTS, type IngredientKey, MEALS } from "../cooking";
import { MATERIALS, type MaterialKey } from "../drops";
import { econDay, GameState, isNight } from "../gameState";
import { BEDS_LEVEL, GARDEN_LEVEL, GARDEN_YIELD, gardenPick, HOUSE_STAGES, type HouseStage } from "../home";
import { DIM_TEXT, retroStyle } from "../pixelart";
import { isTouchDevice } from "./TouchControls";

// HOME's panel: REST, COOK (the kitchen, ui/Kitchen.ts) and BUILD (home.ts's
// extensions). A panel rather than a dialogue question: three choices end
// at x=1024 on touch, into the ESC button, and the BUILD row needs its costs
// laid out anyway. Top to bottom, Press Start 2P at retroStyle(n) = n*4 px a
// glyph, in a 960 x 460 panel whose lines all keep 20px inside x 160..1120:
// the title (y+40) and the gold (right); what's built (y+78, the longest
// "BUILT: HEARTH, HERB GARDEN, FEATHER BEDS", 40 x 20 = 800px); three rows
// from y+124 at a 42px pitch, the name and its status from x=430 (the
// longest, "FEATHER BEDS 8000G", 18 x 24 = 432px, to 862); the picked row's
// line centered at y+262 (the longest, "FEATHER BEDS: REST HERE: WARD UP
// NEXT FIGHT", 43 x 20 = 860px) and up to three lines under it from y+298 at
// a 28px pitch ("MAGMA CORE  99/2" 320px, the pantry 832px at size 4); the
// message at y+392 ("BUILD FEATHER BEDS FOR 8000G? Z/ESC", 35 x 24 = 840px)
// and the key hint at y+430. On touch pinned to y=28, ending at y=488,
// above the d-pad.
const PANEL_W = 960;
const PANEL_H = 460;
const PANEL_TOP = isTouchDevice() ? 28 : GAME_HEIGHT / 2 - PANEL_H / 2;
const NAME_X = GAME_WIDTH / 2 - PANEL_W / 2 + 70;
const STATUS_X = NAME_X + 200;
const ROW_Y = PANEL_TOP + 124;
const ROW_GAP = 42;
const INFO_Y = PANEL_TOP + 262;
const LINE_Y = PANEL_TOP + 298;
const LINE_GAP = 28;
const ROWS = ["REST", "COOK", "BUILD"] as const;
type Row = (typeof ROWS)[number];

const nextStage = (): HouseStage | undefined => HOUSE_STAGES[GameState.houseLevel];
const needsOf = (s: HouseStage): Array<[MaterialKey, number]> => Object.entries(s.needs) as Array<[MaterialKey, number]>;

export interface HomeActions {
  rest(): void;
  cook(): void;
  // after an extension is paid for and GameState.houseLevel raised
  built(level: number): void;
}

export class HomeUI {
  private scene: Phaser.Scene;
  private actions: HomeActions;
  private active = false;
  private index = 0;
  // Z on BUILD asks first; a second Z builds, anything else backs out
  private confirming = false;

  private dim: Phaser.GameObjects.Rectangle;
  private panel: Phaser.GameObjects.Rectangle;
  private title: Phaser.GameObjects.Text;
  private goldText: Phaser.GameObjects.Text;
  private builtText: Phaser.GameObjects.Text;
  private names: Phaser.GameObjects.Text[] = [];
  private statuses: Phaser.GameObjects.Text[] = [];
  private cursor: Phaser.GameObjects.Text;
  private info: Phaser.GameObjects.Text;
  private lines: Phaser.GameObjects.Text[] = [];
  private msg: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;
  private msgTimer?: Phaser.Time.TimerEvent;

  private upQueued = false;
  private downQueued = false;
  private zQueued = false;
  private escQueued = false;

  constructor(scene: Phaser.Scene, actions: HomeActions) {
    this.scene = scene;
    this.actions = actions;
    const fixed = <
      T extends Phaser.GameObjects.Components.Visible & Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth,
    >(
      o: T,
      depth = 152,
    ): T => o.setScrollFactor(0).setDepth(depth).setVisible(false);
    this.dim = fixed(scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5), 150);
    // opaque: on a touch screen it hangs from y 28, over the HUD, whose lines showed through at 0.95
    this.panel = fixed(
      scene.add.rectangle(GAME_WIDTH / 2, PANEL_TOP + PANEL_H / 2, PANEL_W, PANEL_H, 0x0b0b2b, 1).setStrokeStyle(2, 0xffffff),
      151,
    );
    this.title = fixed(scene.add.text(GAME_WIDTH / 2, PANEL_TOP + 40, "HOME", retroStyle(8, "#9f9fd0")).setOrigin(0.5));
    this.goldText = fixed(
      scene.add.text(GAME_WIDTH / 2 + PANEL_W / 2 - 30, PANEL_TOP + 40, "", retroStyle(6, "#8ecbff")).setOrigin(1, 0.5),
    );
    this.builtText = fixed(scene.add.text(GAME_WIDTH / 2, PANEL_TOP + 78, "", retroStyle(5, "#fdba74")).setOrigin(0.5));
    ROWS.forEach((row, i) => {
      const y = ROW_Y + i * ROW_GAP;
      this.names.push(fixed(scene.add.text(NAME_X, y, row, retroStyle(6, "#ffffff")).setOrigin(0, 0.5)));
      this.statuses.push(fixed(scene.add.text(STATUS_X, y, "", retroStyle(6, DIM_TEXT)).setOrigin(0, 0.5)));
    });
    this.cursor = fixed(scene.add.text(0, 0, ">", retroStyle(6, "#ffd166")).setOrigin(0.5));
    this.info = fixed(scene.add.text(GAME_WIDTH / 2, INFO_Y, "", retroStyle(5, "#9f9fd0")).setOrigin(0.5));
    for (let i = 0; i < 3; i++) {
      this.lines.push(fixed(scene.add.text(NAME_X, LINE_Y + i * LINE_GAP, "", retroStyle(5, "#ffffff")).setOrigin(0, 0.5)));
    }
    this.msg = fixed(scene.add.text(GAME_WIDTH / 2, PANEL_TOP + 392, "", retroStyle(6, "#f5f5f5")).setOrigin(0.5));
    this.hint = fixed(
      scene.add
        .text(
          GAME_WIDTH / 2,
          PANEL_TOP + 430,
          isTouchDevice() ? "D-PAD: PICK   Z: OK   ESC: CLOSE" : "J/K: PICK   Z: OK   ESC: CLOSE",
          retroStyle(4, DIM_TEXT),
        )
        .setOrigin(0.5),
    );

    const kb = scene.input.keyboard;
    const DOWN = Phaser.Input.Keyboard.Events.DOWN;
    const K = Phaser.Input.Keyboard.KeyCodes;
    const on = (code: number, flag: "upQueued" | "downQueued" | "zQueued" | "escQueued") => {
      kb?.addKey(code).on(DOWN, () => {
        this[flag] = true;
      });
    };
    on(K.UP, "upQueued");
    on(K.K, "upQueued");
    on(K.DOWN, "downQueued");
    on(K.J, "downQueued");
    on(K.Z, "zQueued");
    on(K.ESC, "escQueued");
  }

  open(): void {
    this.active = true;
    this.index = 0;
    this.confirming = false;
    this.upQueued = false;
    this.downQueued = false;
    this.zQueued = false;
    this.escQueued = false;
    this.setShown(true);
    this.msg.setText("");
    this.pickGarden();
    this.refresh();
  }

  isActive(): boolean {
    return this.active;
  }

  update(): void {
    if (!this.active) return;
    if (this.escQueued) {
      this.escQueued = false;
      if (this.confirming) this.cancel();
      else this.close();
      return;
    }
    const prev = this.index;
    if (this.upQueued) {
      this.upQueued = false;
      this.index = (this.index + ROWS.length - 1) % ROWS.length;
    }
    if (this.downQueued) {
      this.downQueued = false;
      this.index = (this.index + 1) % ROWS.length;
    }
    if (this.index !== prev) {
      Sfx.move();
      if (this.confirming) this.cancel();
      this.refresh();
    }
    if (this.zQueued) {
      this.zQueued = false;
      this.choose(ROWS[this.index]);
    }
  }

  // HERB GARDEN (home.ts): the first visit of the day finds a few crops
  private pickGarden(): void {
    if (GameState.houseLevel < GARDEN_LEVEL || GameState.gardenDay === econDay()) return;
    GameState.gardenDay = econDay();
    const got: IngredientKey[] = [];
    for (let i = 0; i < GARDEN_YIELD; i++) {
      const k = gardenPick();
      addIngredient(GameState.pantry, k);
      got.push(k);
    }
    GameState.save();
    Sfx.pickup();
    // "GARDEN: +1 MOONFLOWER, +1 MOONFLOWER" is 36 x 24 = 864px
    this.showMsg(`GARDEN: ${got.map((k) => `+1 ${INGREDIENTS[k]}`).join(", ")}`, 2400);
  }

  private choose(row: Row): void {
    if (row === "REST") {
      this.close();
      this.actions.rest();
      return;
    }
    if (row === "COOK") {
      this.close();
      this.actions.cook();
      return;
    }
    if (this.confirming) {
      this.build();
      return;
    }
    const next = nextStage();
    if (!next) {
      this.refuse("Your HOME is complete!");
      return;
    }
    if (GameState.gold < next.cost) {
      this.refuse(`Need ${next.cost - GameState.gold} more GOLD`);
      return;
    }
    const short = needsOf(next).find(([m, n]) => GameState.inventory[m] < n);
    if (short) {
      const [m, n] = short;
      this.refuse(`Need ${n - GameState.inventory[m]} more ${MATERIALS[m].name}`);
      return;
    }
    this.confirming = true;
    Sfx.move();
    this.showMsg(`BUILD ${next.name} FOR ${next.cost}G? Z/ESC`, 0);
  }

  private build(): void {
    this.confirming = false;
    const next = nextStage();
    // re-checked: nothing should change behind an open panel, but a build
    // must never take what the purse or the bag can't fully cover
    if (!next || GameState.gold < next.cost || needsOf(next).some(([m, n]) => GameState.inventory[m] < n)) {
      this.refuse("Can't build that now!");
      return;
    }
    GameState.gold -= next.cost;
    for (const [m, n] of needsOf(next)) GameState.inventory[m] -= n;
    GameState.houseLevel += 1;
    GameState.save();
    Sfx.levelup();
    this.showMsg(`${next.name} BUILT!`);
    this.actions.built(GameState.houseLevel);
    this.refresh();
  }

  private cancel(): void {
    this.confirming = false;
    this.msg.setText("");
  }

  private refuse(text: string): void {
    Sfx.error();
    this.showMsg(text);
  }

  // 0 keeps the line up (the build question waits for an answer)
  private showMsg(text: string, hold = 1400): void {
    this.msgTimer?.remove();
    this.msg.setText(text);
    if (hold > 0) this.msgTimer = this.scene.time.addEvent({ delay: hold, callback: () => this.msg.setText("") });
  }

  private refresh(): void {
    const level = GameState.houseLevel;
    const next = nextStage();
    const meal = GameState.meal;
    this.goldText.setText(`G ${GameState.gold}`);
    const built = HOUSE_STAGES.slice(0, level).map((s) => s.name);
    this.builtText.setText(built.length > 0 ? `BUILT: ${built.join(", ")}` : "A COTTAGE, NOTHING BUILT ON YET");
    const status: Record<Row, [string, string]> = {
      REST: [isNight() ? "SLEEP UNTIL 06:00" : "FULL HP/MP", "#ffffff"],
      COOK: [meal ? `${MEALS[meal.key].name} x${meal.left}` : "NOTHING COOKED", meal ? "#fdba74" : DIM_TEXT],
      BUILD: next ? [`${next.name} ${next.cost}G`, "#ffffff"] : ["ALL BUILT", "#ffd166"],
    };
    ROWS.forEach((row, i) => {
      this.statuses[i].setText(status[row][0]).setColor(status[row][1]);
    });
    this.cursor.setPosition(NAME_X - 26, ROW_Y + this.index * ROW_GAP);
    const row = ROWS[this.index];
    const lines: Array<[string, string]> = [];
    if (row === "REST") {
      this.info.setText(level >= BEDS_LEVEL ? "REST: FULL HP/MP, WARD UP NEXT FIGHT" : "REST: FULL HP/MP, A NIGHT TO 06:00");
    } else if (row === "COOK") {
      this.info.setText("COOK: A MEAL FOR THE NEXT BATTLES");
      const p = GameState.pantry;
      lines.push([(Object.keys(INGREDIENTS) as IngredientKey[]).map((k) => `${INGREDIENTS[k]} ${p[k]}`).join("  "), "#a3e635"]);
    } else if (next) {
      this.info.setText(`${next.name}: ${next.info}`);
      lines.push([`${"GOLD".padEnd(11)}  ${GameState.gold}/${next.cost}`, GameState.gold >= next.cost ? "#4ade80" : "#ff8a8a"]);
      for (const [m, n] of needsOf(next)) {
        const have = GameState.inventory[m];
        lines.push([`${MATERIALS[m].name.padEnd(11)}  ${have}/${n}`, have >= n ? "#4ade80" : "#ff8a8a"]);
      }
    } else {
      this.info.setText("EVERY EXTENSION IS BUILT");
    }
    this.lines.forEach((t, i) => {
      const line = lines[i];
      // the pantry is one long line: smaller, and centred under the info
      const pantry = row === "COOK" && i === 0;
      t.setText(line ? line[0] : "")
        .setColor(line ? line[1] : "#ffffff")
        .setStyle(retroStyle(pantry ? 4 : 5, line ? line[1] : "#ffffff"))
        .setOrigin(pantry ? 0.5 : 0, 0.5)
        .setX(pantry ? GAME_WIDTH / 2 : NAME_X);
    });
  }

  private setShown(shown: boolean): void {
    for (const o of [this.dim, this.panel, this.title, this.goldText, this.builtText, this.cursor, this.info, this.msg, this.hint])
      o.setVisible(shown);
    for (const t of [...this.names, ...this.statuses, ...this.lines]) t.setVisible(shown);
  }

  private close(): void {
    this.active = false;
    this.confirming = false;
    this.msgTimer?.remove();
    this.setShown(false);
  }

  destroy(): void {
    this.msgTimer?.remove();
    for (const o of [this.dim, this.panel, this.title, this.goldText, this.builtText, this.cursor, this.info, this.msg, this.hint])
      o.destroy();
    for (const t of [...this.names, ...this.statuses, ...this.lines]) t.destroy();
    // keys are shared kb.addKey instances; scene shutdown tears them down
  }
}
