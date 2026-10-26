import Phaser from "phaser";
import { Sfx } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { addIngredient, INGREDIENTS } from "../cooking";
import { HARVEST_MULT, isEventToday } from "../events";
import { CROPS, type CropDef, type CropKey, cropClock, cropLeft, cropReadyAt, FARM_PLOTS, type FarmPlot, GameState } from "../gameState";
import { DIM_TEXT, makeTexture, retroStyle } from "../pixelart";
import { isWet, weatherToday } from "../weather";
import { isTouchDevice } from "./TouchControls";

// Sized off the widest lines, Press Start 2P at retroStyle(n) = n*4 px a
// glyph: a night crop's plot row (43 x 20 = 860, "PLOT 1  MOONFLOWER  READY
// 04:00  NIGHT ONLY"), the seed picker (42 x 20 = 840) and the hint at
// retroStyle(4) (52 x 16 = 832) all keep >= 30px inside 960.
const PANEL_W = 960;
const PANEL_H = 420;
const PANEL_TOP = GAME_HEIGHT / 2 - PANEL_H / 2;
const ROW_X = GAME_WIDTH / 2 - PANEL_W / 2 + 70;
const ROW_GAP = 40;
const NAME_COL = Math.max(...Object.values(CROPS).map((c) => c.name.length));
const SEED_LABEL = "SEED:";

// 1 in 20 harvests pays triple
const GOLDEN_CHANCE = 0.05;
const GOLDEN_MULT = 3;
// A rain or storm day in town (weather.ts) leaves the crops "RAIN-FED": the
// harvest pays a fifth more. Only the payout — how fast a crop grows
// (gameState cropGrowth) doesn't look at the sky.
const RAIN_FED_MULT = 1.2;

// today's payout multiplier from the day itself: a harvest festival
// (events.ts) and a wet sky stack, x1.8 together
const dayPayMult = (): number => (isEventToday("harvest") ? HARVEST_MULT : 1) * (isWet(weatherToday("town")) ? RAIN_FED_MULT : 1);

const CROP_KEYS = Object.keys(CROPS) as CropKey[];

// Remaining growth as H/M, the same unit the in-game clock shows, and as D/H
// from 100 hours, which only FAST / VERY FAST reach (crops keep NORMAL's
// pace there, gameState cropClock: a VERY FAST PUMPKIN is 480 game hours):
// "6D16H", at most "20D00H", never wider than "99H59M"'s 6 glyphs, which is
// what every line below is sized for.
const remainText = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  if (h >= 100) return `${Math.floor(h / 24)}D${String(h % 24).padStart(2, "0")}H`;
  return `${h}H${String(Math.floor(minutes % 60)).padStart(2, "0")}M`;
};
// a GameState.minutes moment as the HUD's HH:MM, rounded up so it never
// promises a crop earlier than cropLeft() lets it be harvested
const clockAt = (minutes: number): string => {
  const m = Math.ceil(minutes);
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
// A night crop's readiness: "READY 04:00" when that falls within the next day
// (always, at NORMAL), else the wait, "IN 15D23H" — at FAST / VERY FAST it can
// be many nights off (16 at x20), and a bare 04:00 wouldn't say which. The
// plot row stays within the widest one, 43 glyphs (860px): the far form is
// at most 41.
const nightReady = (plot: FarmPlot): string => {
  const wait = cropReadyAt(plot) - GameState.minutes;
  return wait < 1440 ? `READY ${clockAt(cropReadyAt(plot))}` : `IN ${remainText(wait)}`;
};

// Ripe-plant art for the crops BootScene doesn't bake; TownScene's field
// sprites look up `crop-${key}` for every CropKey. Same 16x16 framing as
// CORN_TILE/BEAN_TILE so the sprout -> tinted -> ripe stages line up.
const PUMPKIN_PALETTE = { d: 0x14532d, s: 0x15803d, g: 0x4ade80, r: 0x9a3412, o: 0xea580c, O: 0xf97316, y: 0xfdba74 };
const PUMPKIN_TILE = [
  "................",
  "................",
  "................",
  ".......sd.......",
  "....ggsd..g.....",
  "...g...sdgg.....",
  "....oOOrrOOo....",
  "...oOyOrrOOOo...",
  "..oOyOOrrOOOOo..",
  "..oOyOOrrOOOOo..",
  "..oOOOOrrOOOOo..",
  "..ooOOOrrOOOoo..",
  "...ooOOrrOOoo...",
  "....oooooooo....",
  "................",
  "................",
];
const MOONFLOWER_PALETTE = { d: 0x14532d, s: 0x15803d, g: 0x4ade80, w: 0xe0e7ff, b: 0xa5b4fc, B: 0x818cf8, c: 0xfef9c3, C: 0xfde047 };
const MOONFLOWER_TILE = [
  "................",
  "......wwww......",
  "....bwwwwwwb....",
  "...bwwwccwwwb...",
  "...bwwcCCcwwb...",
  "...bwwwccwwwb...",
  "....bbwwwwbb....",
  "......BbbB......",
  ".......gs.......",
  "...gg..gs..gg...",
  "....ggggsggg....",
  ".......gs.......",
  ".......gd.......",
  "......dggd......",
  "................",
  "................",
];

export class FarmUI {
  private scene: Phaser.Scene;
  private active = false;
  private dirty = false;
  private index = 0;
  private seed: CropKey = "corn";

  private dim: Phaser.GameObjects.Rectangle;
  private panel: Phaser.GameObjects.Rectangle;
  private title: Phaser.GameObjects.Text;
  private goldText: Phaser.GameObjects.Text;
  private seedLabel: Phaser.GameObjects.Text;
  private seedChips: Phaser.GameObjects.Text[] = [];
  private seedText: Phaser.GameObjects.Text;
  private rows: Phaser.GameObjects.Text[] = [];
  private cursor: Phaser.GameObjects.Text;
  private msg: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;
  private msgTimer?: Phaser.Time.TimerEvent;

  private upQueued = false;
  private downQueued = false;
  private zQueued = false;
  private seedQueued = 0;
  private escQueued = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // once per game, like StatusHud's sun/moon: TownScene can restart (map
    // editor), and baking an existing key again draws over the old texture
    if (!scene.textures.exists("crop-pumpkin")) makeTexture(scene, "crop-pumpkin", PUMPKIN_TILE, PUMPKIN_PALETTE);
    if (!scene.textures.exists("crop-moonflower")) makeTexture(scene, "crop-moonflower", MOONFLOWER_TILE, MOONFLOWER_PALETTE);

    this.dim = scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5)
      .setScrollFactor(0)
      .setDepth(150)
      .setVisible(false);
    this.panel = scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, PANEL_W, PANEL_H, 0x0b0b2b, 0.95)
      .setScrollFactor(0)
      .setDepth(151)
      .setStrokeStyle(2, 0xffffff)
      .setVisible(false);
    this.title = scene.add
      .text(GAME_WIDTH / 2, PANEL_TOP + 40, "FARM", retroStyle(8, "#a3e635"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    this.goldText = scene.add
      .text(GAME_WIDTH / 2 + PANEL_W / 2 - 30, PANEL_TOP + 40, "", retroStyle(6, "#8ecbff"))
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);

    // every seed on one line with brackets on the picked one; each chip
    // reserves its bracket width either way so the line never shifts
    const chips = CROP_KEYS.map((k) => ` ${CROPS[k].name} `);
    const pickerW = (SEED_LABEL.length + chips.reduce((n, c) => n + c.length + 1, 0)) * 20;
    let x = GAME_WIDTH / 2 - pickerW / 2;
    this.seedLabel = scene.add
      .text(x, PANEL_TOP + 92, SEED_LABEL, retroStyle(5, "#9f9fd0"))
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    x += (SEED_LABEL.length + 1) * 20;
    for (const chip of chips) {
      this.seedChips.push(
        scene.add
          .text(x, PANEL_TOP + 92, chip, retroStyle(5, DIM_TEXT))
          .setOrigin(0, 0.5)
          .setScrollFactor(0)
          .setDepth(152)
          .setVisible(false),
      );
      x += (chip.length + 1) * 20;
    }
    this.seedText = scene.add
      .text(GAME_WIDTH / 2, PANEL_TOP + 126, "", retroStyle(5, "#ffd166"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);

    for (let i = 0; i < FARM_PLOTS; i++) {
      this.rows.push(
        scene.add
          .text(ROW_X, PANEL_TOP + 176 + i * ROW_GAP, "", retroStyle(5, "#ffffff"))
          .setOrigin(0, 0.5)
          .setScrollFactor(0)
          .setDepth(152)
          .setVisible(false),
      );
    }
    this.cursor = scene.add.text(0, 0, ">", retroStyle(5, "#ffd166")).setOrigin(0.5).setScrollFactor(0).setDepth(152).setVisible(false);

    this.msg = scene.add
      .text(GAME_WIDTH / 2, PANEL_TOP + PANEL_H - 70, "", retroStyle(6, "#f5f5f5"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false)
      .setWordWrapWidth(PANEL_W - 60, true)
      .setAlign("center");
    // touch names the d-pad by its own button labels (no J/K/H/L/TAB there);
    // 48 x 16 = 768px keeps it between the d-pad (x<=194 on this line) and Z
    this.hint = scene.add
      .text(
        GAME_WIDTH / 2,
        PANEL_TOP + PANEL_H - 22,
        isTouchDevice() ? "^v: PLOT  <>: SEED  Z: PLANT/HARVEST  ESC: CLOSE" : "JK: PLOT  HL/TAB: SEED  Z: PLANT/HARVEST  ESC: CLOSE",
        retroStyle(4, DIM_TEXT),
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);

    const kb = scene.input.keyboard!;
    const DOWN = Phaser.Input.Keyboard.Events.DOWN;
    const on = (code: number, flag: "upQueued" | "downQueued" | "zQueued" | "escQueued") => {
      kb.addKey(code).on(DOWN, () => {
        this[flag] = true;
      });
    };
    const onSeed = (code: number, dir: number) => {
      kb.addKey(code).on(DOWN, () => {
        this.seedQueued = dir;
      });
    };
    const K = Phaser.Input.Keyboard.KeyCodes;
    on(K.UP, "upQueued");
    on(K.K, "upQueued");
    on(K.DOWN, "downQueued");
    on(K.J, "downQueued");
    on(K.Z, "zQueued");
    on(K.ESC, "escQueued");
    // left/right as well as TAB: the touch d-pad has arrows but no TAB, and
    // four seeds are a long way round in one direction
    onSeed(K.TAB, 1);
    onSeed(K.RIGHT, 1);
    onSeed(K.L, 1);
    onSeed(K.LEFT, -1);
    onSeed(K.H, -1);
  }

  open(): void {
    this.active = true;
    this.dirty = false;
    this.index = 0;
    this.upQueued = false;
    this.downQueued = false;
    this.zQueued = false;
    this.seedQueued = 0;
    this.escQueued = false;
    this.setShown(true);
    this.refresh();
  }

  isActive(): boolean {
    return this.active;
  }

  update(): void {
    if (!this.active) return;
    if (this.escQueued) {
      this.escQueued = false;
      this.close();
      return;
    }
    if (this.seedQueued !== 0) {
      const n = CROP_KEYS.length;
      this.seed = CROP_KEYS[(CROP_KEYS.indexOf(this.seed) + this.seedQueued + n) % n];
      this.seedQueued = 0;
      Sfx.move();
    }
    const prev = this.index;
    if (this.upQueued) {
      this.upQueued = false;
      this.index = (this.index + FARM_PLOTS - 1) % FARM_PLOTS;
    }
    if (this.downQueued) {
      this.downQueued = false;
      this.index = (this.index + 1) % FARM_PLOTS;
    }
    if (this.index !== prev) Sfx.move();
    if (this.zQueued) {
      this.zQueued = false;
      this.act();
    }
    // crops keep growing while the panel is open, so the countdown is redrawn
    // every frame (Phaser's setText skips unchanged strings)
    this.refresh();
  }

  private act(): void {
    const plot = GameState.farm[this.index];
    if (!plot) {
      const def = CROPS[this.seed];
      if (GameState.gold < def.seed) {
        Sfx.error();
        this.showMsg("Not enough gold!");
        return;
      }
      GameState.gold -= def.seed;
      GameState.farm[this.index] = { crop: this.seed, plantedAt: cropClock(this.seed) };
      this.dirty = true;
      Sfx.buy();
      this.showMsg(`${def.name} planted!`);
      return;
    }
    const def: CropDef = CROPS[plot.crop];
    const left = cropLeft(plot);
    if (left > 0) {
      Sfx.error();
      this.showMsg(def.nightOnly ? `Grows at night: ${nightReady(plot)}` : `Still growing: ${remainText(left)}`);
      return;
    }
    const golden = Math.random() < GOLDEN_CHANCE;
    // the day's multiplier stacks on a golden crop: x5.4 at most (a rain-fed
    // festival), still 1 harvest in 20 — a golden PUMPKIN tops out at 1296G,
    // and gainGold() clamps at the gold cap as ever
    const mult = (golden ? GOLDEN_MULT : 1) * dayPayMult();
    // gainGold()'s return value, not the raw roll, so the message never
    // overstates what was actually credited near the gold cap
    const gold = GameState.gainGold(Math.round(Phaser.Math.Between(def.min, def.max) * mult));
    GameState.farm[this.index] = null;
    GameState.cropsHarvested += 1;
    addIngredient(GameState.pantry, plot.crop);
    // the ingredient on a line of its own under the payout, so the kitchen
    // (cooking.ts) gets found: "+1 MOONFLOWER TO COOK" is 21 x 24 = 504px
    // under "GOLDEN MOONFLOWER! x3  +1296G" (696px), and the two lines (y
    // 320..380, 315..385 at the golden pulse's 1.15) sit between the last
    // plot row (to y 309) and the hint (from 388)
    const cookLine = `+1 ${INGREDIENTS[plot.crop]} TO COOK`;
    if (golden) {
      GameState.goldenHarvests += 1;
      // the four-note fanfare is the biggest jingle in the set, kept for the
      // rarest payout on this panel
      Sfx.levelup();
      this.showMsg(`GOLDEN ${def.name}! x${GOLDEN_MULT}  +${gold}G\n${cookLine}`, true);
    } else {
      Sfx.pickup();
      this.showMsg(`Harvested ${def.name}!  +${gold}G\n${cookLine}`);
    }
    // written out now, like the LUCKY WHEEL's spin, not on close(): a plain
    // harvest reloaded with the panel still open left the crop ripe in the
    // save, to be rolled again for the 5% GOLDEN (up to 1296G)
    GameState.save();
  }

  private showMsg(text: string, golden = false): void {
    this.msgTimer?.remove();
    this.scene.tweens.killTweensOf(this.msg);
    this.msg
      .setText(text)
      .setColor(golden ? "#ffd166" : "#f5f5f5")
      .setScale(1);
    if (golden) this.scene.tweens.add({ targets: this.msg, scale: 1.15, duration: 120, yoyo: true, repeat: 2 });
    this.msgTimer = this.scene.time.addEvent({
      delay: golden ? 2400 : 1200,
      callback: () => this.msg.setText(""),
    });
  }

  private refresh(): void {
    // Redrawn every frame (see update()), so the festival/rain titles and
    // payouts come and go with the day even while the panel is open. The
    // widest title, "RAIN-FED FESTIVAL" (17 x 32 = 544px, x 368..912), clears
    // the gold readout (x>=946); the seed line's multiplier is always one
    // "(xN.N)" and its grow time at most 6 glyphs (remainText), so its
    // longest, "25G -> 270-342G (x1.8)  40H00M AT NIGHT ONLY" (FAST's
    // MOONFLOWER, 44 x 20 = 880px), keeps 40px a side.
    const festival = isEventToday("harvest");
    const rainFed = isWet(weatherToday("town"));
    this.title.setText(festival ? (rainFed ? "RAIN-FED FESTIVAL" : "HARVEST FESTIVAL") : rainFed ? "RAIN-FED FARM" : "FARM");
    this.goldText.setText(`G ${GameState.gold}`);
    CROP_KEYS.forEach((k, i) => {
      const picked = k === this.seed;
      this.seedChips[i].setText(picked ? `[${CROPS[k].name}]` : ` ${CROPS[k].name} `).setColor(picked ? "#ffd166" : DIM_TEXT);
    });
    const seedDef: CropDef = CROPS[this.seed];
    const m = dayPayMult();
    const pay =
      m !== 1
        ? `${Math.round(seedDef.min * m)}-${Math.round(seedDef.max * m)}G (x${Number(m.toFixed(2))})`
        : `${seedDef.min}-${seedDef.max}G`;
    // the grow time in game time at this TIME SPEED (gameState: crops keep
    // NORMAL's pace), so a VERY FAST CORN reads 6D16H
    this.seedText.setText(
      `${seedDef.seed}G -> ${pay}  ${remainText(seedDef.grow * GameState.timeSpeed)}${seedDef.nightOnly ? " AT NIGHT ONLY" : ""}`,
    );
    for (let i = 0; i < FARM_PLOTS; i++) {
      const plot = GameState.farm[i];
      if (!plot) {
        this.rows[i].setText(`PLOT ${i + 1}  EMPTY`).setColor(DIM_TEXT);
        continue;
      }
      const def: CropDef = CROPS[plot.crop];
      const head = `PLOT ${i + 1}  ${def.name.padEnd(NAME_COL)}  `;
      const left = cropLeft(plot);
      if (left <= 0) {
        this.rows[i].setText(`${head}READY!`).setColor("#a3e635");
      } else if (def.nightOnly) {
        this.rows[i].setText(`${head}${nightReady(plot)}  NIGHT ONLY`).setColor("#c4b5fd");
      } else {
        this.rows[i].setText(`${head}${remainText(left)} LEFT`).setColor("#ffffff");
      }
    }
    const target = this.rows[this.index];
    this.cursor.setPosition(target.x - 26, target.y);
  }

  private setShown(shown: boolean): void {
    this.dim.setVisible(shown);
    this.panel.setVisible(shown);
    this.title.setVisible(shown);
    this.goldText.setVisible(shown);
    this.seedLabel.setVisible(shown);
    for (const c of this.seedChips) c.setVisible(shown);
    this.seedText.setVisible(shown);
    this.msg.setVisible(shown);
    this.hint.setVisible(shown);
    this.cursor.setVisible(shown);
    for (const r of this.rows) r.setVisible(shown);
  }

  private close(): void {
    this.active = false;
    this.setShown(false);
    this.msg.setText("");
    this.msgTimer?.remove();
    if (this.dirty) GameState.save();
  }

  destroy(): void {
    this.dim.destroy();
    this.panel.destroy();
    this.title.destroy();
    this.goldText.destroy();
    this.seedLabel.destroy();
    for (const c of this.seedChips) c.destroy();
    this.seedText.destroy();
    this.msg.destroy();
    this.hint.destroy();
    this.cursor.destroy();
    for (const r of this.rows) r.destroy();
    this.msgTimer?.remove();
    // keys are shared kb.addKey instances; scene shutdown tears them down
  }
}
