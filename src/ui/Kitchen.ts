import Phaser from "phaser";
import { Sfx } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { canCook, cook, INGREDIENTS, type IngredientKey, MEAL_KEYS, MEALS, type MealKey, needsOf } from "../cooking";
import { GameState } from "../gameState";
import { mealBattles } from "../home";
import { bodyStyle, DIM_TEXT, retroStyle } from "../pixelart";
import { bindKeyHint, keyHint, keyNames } from "./Gamepad";
import { PANEL_TOP_OVER_HUD } from "./StatusHud";
import { isTouchDevice } from "./TouchControls";

// HOME's kitchen (cooking.ts), laid out like the BLACKSMITH's panel. Top to
// bottom, Press Start 2P at retroStyle(n) = n*4 px a glyph (the effect line
// and the message in bodyStyle(22), 14px a glyph), in a 960 x 480
// panel: the title (y+38, y+22..54); the pantry on two lines centered at y+76
// (y+58..94), the farm's ("CORN 99  BEAN 99  PUMPKIN 99  MOONFLOWER 99", 43 x
// 16 = 688px) over the pond's ("FISH 99  RARE FISH 99", 336px) — on one line
// the six came to 1056px, past the 920 inside the panel; six recipe rows
// from y+114 at a 32px pitch (to y+286; the rows' 24px glyphs keep 8px apart
// and the icons' art its middle 28px), the dish's icon (32px, BootScene
// "icon-<key>", x 230..262), its name 8px after (12 glyphs at most,
// "GRILLED FISH" = 288px from x=270) and its status ("NEED FOOD" 216px from
// x=600); the picked recipe's effect centered at y+306 (the longest, "HALF OF
// POISON & FREEZE BLOCKED - 5 BATTLES", 43 x 14 = 602px, x 339..941); its
// ingredients from y+342 at a 28px pitch, each the ingredient's icon and its
// line from x=270 ("MOONFLOWER  99/1", 320px, to 590; the icons' art keeps
// to their middle 28px, so the pitch holds) beside what's on the table
// (from x=640, "NOW: GRILLED FISH x5", 400px, to 1040); the message at
// y+412 (the longest, "GRILLED FISH IS SERVED! 5 BATTLES", 33 x 14 = 462px,
// x 409..871) and the key hint at
// y+450. Every line keeps 20px inside the panel's 160..1120. Centered on a
// keyboard; on touch pinned over the HUD (statusHud.ts), so it ends by
// y=488, above the d-pad.
const PANEL_W = 960;
const PANEL_H = 480;
const PANEL_TOP = isTouchDevice() ? PANEL_TOP_OVER_HUD : GAME_HEIGHT / 2 - PANEL_H / 2;
const NAME_X = GAME_WIDTH / 2 - PANEL_W / 2 + 70;
// a row's icon starts at NAME_X, its text ICON_DX after
const ICON_DX = 40;
const STATUS_X = NAME_X + ICON_DX + 330;
const TABLE_X = GAME_WIDTH / 2;
const ROW_Y = PANEL_TOP + 114;
const ROW_GAP = 32;
// the pantry's two lines: what the farm grows, then what the pond gives
const PANTRY_LINES: IngredientKey[][] = [
  ["corn", "bean", "pumpkin", "moonflower"],
  ["fish", "rareFish"],
];
const INFO_Y = PANEL_TOP + 306;
const NEED_Y = PANEL_TOP + 342;
const NEED_GAP = 28;
const MAX_NEEDS = Math.max(...MEAL_KEYS.map((k) => needsOf(MEALS[k]).length));

type Status = "table" | "ready" | "short";

function statusOf(key: MealKey): Status {
  if (GameState.meal?.key === key) return "table";
  return canCook(GameState.pantry, key) ? "ready" : "short";
}

const STATUS_LABEL: Record<Status, [string, string]> = {
  table: ["ON TABLE", "#ffd166"],
  ready: ["READY", "#4ade80"],
  short: ["NEED FOOD", DIM_TEXT],
};

export class KitchenUI {
  private scene: Phaser.Scene;
  private active = false;
  private index = 0;
  // Z on a cookable recipe asks first; a second Z cooks, anything else backs out
  private confirming = false;

  private dim: Phaser.GameObjects.Rectangle;
  private panel: Phaser.GameObjects.Rectangle;
  private title: Phaser.GameObjects.Text;
  private pantryText: Phaser.GameObjects.Text;
  private names: Phaser.GameObjects.Text[] = [];
  private icons: Phaser.GameObjects.Image[] = [];
  private statuses: Phaser.GameObjects.Text[] = [];
  private cursor: Phaser.GameObjects.Text;
  private info: Phaser.GameObjects.Text;
  private needs: Phaser.GameObjects.Text[] = [];
  private needIcons: Phaser.GameObjects.Image[] = [];
  private table: Phaser.GameObjects.Text;
  private msg: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;
  private msgTimer?: Phaser.Time.TimerEvent;

  private upQueued = false;
  private downQueued = false;
  private zQueued = false;
  private escQueued = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
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
    this.title = fixed(scene.add.text(GAME_WIDTH / 2, PANEL_TOP + 38, "KITCHEN", retroStyle(8, "#fdba74")).setOrigin(0.5));
    this.pantryText = fixed(
      scene.add
        .text(GAME_WIDTH / 2, PANEL_TOP + 76, "", retroStyle(4, "#a3e635"))
        .setOrigin(0.5)
        .setAlign("center")
        .setLineSpacing(4),
    );
    MEAL_KEYS.forEach((k, i) => {
      const y = ROW_Y + i * ROW_GAP;
      this.icons.push(fixed(scene.add.image(NAME_X + 16, y, `icon-${k}`).setScale(0.5)));
      this.names.push(fixed(scene.add.text(NAME_X + ICON_DX, y, MEALS[k].name, retroStyle(6, "#ffffff")).setOrigin(0, 0.5)));
      this.statuses.push(fixed(scene.add.text(STATUS_X, y, "", retroStyle(6, DIM_TEXT)).setOrigin(0, 0.5)));
    });
    this.cursor = fixed(scene.add.text(0, 0, ">", retroStyle(6, "#ffd166")).setOrigin(0.5));
    this.info = fixed(scene.add.text(GAME_WIDTH / 2, INFO_Y, "", bodyStyle(22, "#9f9fd0")).setOrigin(0.5));
    for (let i = 0; i < MAX_NEEDS; i++) {
      this.needIcons.push(fixed(scene.add.image(NAME_X + 16, NEED_Y + i * NEED_GAP, "icon-corn").setScale(0.5)));
      this.needs.push(fixed(scene.add.text(NAME_X + ICON_DX, NEED_Y + i * NEED_GAP, "", retroStyle(5, "#ffffff")).setOrigin(0, 0.5)));
    }
    this.table = fixed(scene.add.text(TABLE_X, NEED_Y, "", retroStyle(5, "#fdba74")).setOrigin(0, 0.5));
    this.msg = fixed(scene.add.text(GAME_WIDTH / 2, PANEL_TOP + 412, "", bodyStyle(22, "#f5f5f5")).setOrigin(0.5));
    // touch names the d-pad rather than JK (the arrows it sends move here too)
    this.hint = fixed(
      bindKeyHint(scene.add.text(GAME_WIDTH / 2, PANEL_TOP + 450, "", retroStyle(4, DIM_TEXT)), () =>
        keyHint("JK: MOVE   Z: COOK   ESC: CLOSE", "D-PAD: MOVE   Z: COOK   ESC: CLOSE"),
      ).setOrigin(0.5),
    );

    const kb = scene.input.keyboard!;
    const DOWN = Phaser.Input.Keyboard.Events.DOWN;
    const on = (code: number, flag: "upQueued" | "downQueued" | "zQueued" | "escQueued") => {
      kb.addKey(code).on(DOWN, () => {
        this[flag] = true;
      });
    };
    const K = Phaser.Input.Keyboard.KeyCodes;
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
      this.index = (this.index + MEAL_KEYS.length - 1) % MEAL_KEYS.length;
    }
    if (this.downQueued) {
      this.downQueued = false;
      this.index = (this.index + 1) % MEAL_KEYS.length;
    }
    if (this.index !== prev) {
      Sfx.move();
      if (this.confirming) this.cancel();
      this.refresh();
    }
    if (this.zQueued) {
      this.zQueued = false;
      if (this.confirming) this.serve();
      else this.ask();
    }
  }

  private ask(): void {
    const key = MEAL_KEYS[this.index];
    if (!canCook(GameState.pantry, key)) {
      const [k, n] = needsOf(MEALS[key]).find(([i, need]) => GameState.pantry[i] < need) as [IngredientKey, number];
      this.refuse(`Need ${n - GameState.pantry[k]} more ${INGREDIENTS[k]}`);
      return;
    }
    this.confirming = true;
    Sfx.move();
    // cooking replaces whatever is on the table, so say so
    const now = GameState.meal;
    const ask = keyNames("Z/ESC");
    this.showMsg(now ? `SWAP ${MEALS[now.key].tag} FOR ${MEALS[key].name}? ${ask}` : `COOK ${MEALS[key].name}? ${ask}`, 0);
  }

  private serve(): void {
    this.confirming = false;
    const key = MEAL_KEYS[this.index];
    // re-checked: nothing should change behind an open panel, but a meal must
    // never take ingredients the pantry can't fully cover
    // the HOME's HEARTH (home.ts) makes a meal last longer
    const battles = mealBattles(GameState.houseLevel);
    if (!cook(GameState, key, battles)) {
      this.refuse("Can't cook that now!");
      return;
    }
    GameState.mealsCooked += 1;
    GameState.save();
    Sfx.buy();
    this.showMsg(`${MEALS[key].name} IS SERVED! ${battles} BATTLES`);
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

  // 0 keeps the line up (the cook question waits for an answer)
  private showMsg(text: string, hold = 1400): void {
    this.msgTimer?.remove();
    this.msg.setText(text);
    if (hold > 0) this.msgTimer = this.scene.time.addEvent({ delay: hold, callback: () => this.msg.setText("") });
  }

  private refresh(): void {
    const p = GameState.pantry;
    this.pantryText.setText(PANTRY_LINES.map((keys) => keys.map((k) => `${INGREDIENTS[k]} ${p[k]}`).join("  ")).join("\n"));
    MEAL_KEYS.forEach((k, i) => {
      const [label, color] = STATUS_LABEL[statusOf(k)];
      this.statuses[i].setText(label).setColor(color);
    });
    const key = MEAL_KEYS[this.index];
    const def = MEALS[key];
    this.cursor.setPosition(NAME_X - 26, ROW_Y + this.index * ROW_GAP);
    this.info.setText(`${def.info} - ${mealBattles(GameState.houseLevel)} BATTLES`);
    const needs = needsOf(def);
    this.needs.forEach((t, i) => {
      const need = needs[i];
      this.needIcons[i].setVisible(this.active && !!need);
      if (!need) {
        t.setText("");
        return;
      }
      const [k, n] = need;
      this.needIcons[i].setTexture(`icon-${k}`);
      t.setText(`${INGREDIENTS[k].padEnd(10)}  ${p[k]}/${n}`).setColor(p[k] >= n ? "#4ade80" : "#ff8a8a");
    });
    const now = GameState.meal;
    this.table.setText(now ? `NOW: ${MEALS[now.key].name} x${now.left}` : "NOTHING COOKED");
  }

  private setShown(shown: boolean): void {
    for (const o of [this.dim, this.panel, this.title, this.pantryText, this.cursor, this.info, this.table, this.msg, this.hint])
      o.setVisible(shown);
    for (const t of [...this.names, ...this.icons, ...this.statuses, ...this.needs]) t.setVisible(shown);
    // a need line's icon only beside a line that names something
    this.needIcons.forEach((t, i) => {
      t.setVisible(shown && this.needs[i].text !== "");
    });
  }

  private close(): void {
    this.active = false;
    this.confirming = false;
    this.msgTimer?.remove();
    this.setShown(false);
  }

  destroy(): void {
    this.msgTimer?.remove();
    for (const o of [this.dim, this.panel, this.title, this.pantryText, this.cursor, this.info, this.table, this.msg, this.hint])
      o.destroy();
    for (const t of [...this.names, ...this.icons, ...this.statuses, ...this.needs, ...this.needIcons]) t.destroy();
    // keys are shared kb.addKey instances; scene shutdown tears them down
  }
}
