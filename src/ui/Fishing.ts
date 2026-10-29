import Phaser from "phaser";
import { TOTAL_FISH } from "../achievements";
import { Sfx } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { addIngredient, isRareFish } from "../cooking";
import { DERBY_MULT, isEventToday } from "../events";
import { ARCTIC_FISH, type FishDef, GameState, isNight, POND_FISH } from "../gameState";
import { DIM_TEXT, retroStyle } from "../pixelart";
import { isWet, WEATHER_LABEL, weatherToday } from "../weather";
import { bindKeyHint, keyHint } from "./Gamepad";
import { isTouchDevice } from "./TouchControls";

// Sized off the widest lines, all Press Start 2P at retroStyle(n) = n*4 px a
// glyph: "NIGHT ICE FISHING" (17 x 32 = 544), "CAUGHT: GLACIER TROUT!" (22 x
// 24 = 528) and the keyboard hint (33 x 20 = 660) each keep >= 20px inside 700.
const PANEL_W = 700;
const PANEL_H = 340;
const PANEL_TOP = GAME_HEIGHT / 2 - PANEL_H / 2;
const WATER_Y = PANEL_TOP + 146;
// The wait for a bite. At 1.0-2.6s a catch came every ~3.5s, ~22k G an hour
// with no risk from Lv1 on — nine times hunting the town's grass and enough
// for the whole shop in five minutes. 4-10s (with the reaction and the 1.4s
// result hold, ~8.75s a catch) brings it to ~9k G an hour.
const CAST_MIN = 4000;
const CAST_MAX = 10000;
// Weather on the water (weather.ts) changes only the wait before a bite, not
// the 700ms window to react or the odds per catch. Rain or a storm stirs the
// town pond's fish: 3/4 the wait, so a ~8.75s cycle becomes ~7s — about 25%
// more fish an hour. A blizzard on the snow field slows the ice hole (5/4:
// ~10.5s, ~17% fewer).
const WET_BITE_WAIT = 0.75;
const BLIZZARD_BITE_WAIT = 1.25;
const BITE_WINDOW = 700;
const RESULT_HOLD = 1400;
// Fake nibbles: 0-2 small twitches of the float during the wait, so 4-10s of
// nothing doesn't read as a frozen panel. Made unlike a real bite on purpose:
// only the float's parts dip NIBBLE_DIP px (a bite drops the whole float
// 12px), with no "!", no sound and no status line, never in the first
// NIBBLE_START or last NIBBLE_LEAD ms of the wait. A Z pressed during one is
// dropped like any other press before the bite (see update()).
const NIBBLES_MAX = 2;
const NIBBLE_START = 800;
const NIBBLE_LEAD = 900;
const NIBBLE_GAP = 600;
const NIBBLE_DIP = 4;
// log rows: "GLACIER TROUT  BEST 120G" is 24 glyphs, an unseen night row
// "???            NIGHT ONLY" 25 — the block is centered on the 25
const NAME_COL = 13;
const LOG_W = 25 * 5 * 4;
const LOG_TOP = PANEL_TOP + 120;
const LOG_GAP = 36;

// touch has no TAB: the page switch is the LOG/BACK chip there (see the
// constructor), so its hints leave TAB out
const FISH_HINT = (): string => keyHint("Z: REEL   HL/TAB: LOG   ESC: QUIT", "Z: REEL   ESC: QUIT");
const LOG_HINT = (): string => keyHint("HL/TAB: BACK   ESC: QUIT", "ESC: QUIT");

// one entry per bonusItem value, so a new one is a compile error here
// instead of a silently mislabeled toast — same shape as gameState.ts's
// EQUIP_BONUS/EQUIP_TEXTURE tables
const BONUS_LABEL: Record<NonNullable<FishDef["bonusItem"]>, string> = {
  potion: "POTION",
  hiPotion: "HI-POTION",
};

type FishState = "cast" | "bite" | "result" | "log";

export class FishingUI {
  private scene: Phaser.Scene;
  private active = false;
  private dirty = false;
  private state: FishState = "cast";
  private castAt = 0;
  // scene-clock times of this cast's fake nibbles, earliest first
  private nibbles: number[] = [];
  private nibbleTween?: Phaser.Tweens.Tween;
  private biteUntil = 0;
  private resultUntil = 0;

  private dim: Phaser.GameObjects.Rectangle;
  private panel: Phaser.GameObjects.Rectangle;
  private title: Phaser.GameObjects.Text;
  private water: Phaser.GameObjects.Ellipse;
  private bobber: Phaser.GameObjects.Container;
  private biteMark: Phaser.GameObjects.Text;
  private status: Phaser.GameObjects.Text;
  private badge: Phaser.GameObjects.Text;
  private count: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;
  private pageChip?: Phaser.GameObjects.Text;
  private logRows: Phaser.GameObjects.Text[] = [];
  private bobTween?: Phaser.Tweens.Tween;

  private zQueued = false;
  private escQueued = false;
  private tabQueued = false;
  private arctic: boolean;
  private table: FishDef[];

  constructor(scene: Phaser.Scene, arctic = false) {
    this.scene = scene;
    this.arctic = arctic;
    this.table = arctic ? ARCTIC_FISH : POND_FISH;

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
      .text(GAME_WIDTH / 2, PANEL_TOP + 34, "", retroStyle(8, "#38bdf8"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    this.water = scene.add
      .ellipse(GAME_WIDTH / 2, WATER_Y, 280, 34, 0x1e40af, 0.8)
      .setStrokeStyle(2, 0x60a5fa)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    this.bobber = scene.add.container(GAME_WIDTH / 2, WATER_Y, [
      scene.add.ellipse(0, 0, 12, 10, 0xef4444, 1),
      scene.add.ellipse(0, -4, 12, 5, 0xfef3c7, 1),
    ]);
    this.bobber.setScrollFactor(0).setDepth(153).setVisible(false);
    this.biteMark = scene.add
      .text(GAME_WIDTH / 2 + 24, WATER_Y - 30, "!", retroStyle(10, "#ffd166"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(153)
      .setVisible(false);
    // top-anchored under the water so the two-line catch result (fish, then
    // reward) grows downward instead of back up into the bobber
    this.status = scene.add
      .text(GAME_WIDTH / 2, WATER_Y + 34, "", retroStyle(6, "#f5f5f5"))
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false)
      // every current line fits; this only catches a longer species name
      // added later before it spills past the border
      .setWordWrapWidth(PANEL_W - 60, true)
      .setAlign("center")
      // Press Start 2P has no built-in leading; without this the reward line
      // sits flush against the fish name above it
      .setLineSpacing(8);
    // top-anchored (y+252..272, where it was centered at y+262) so a rare
    // catch's second line grows down, to y+298, 6px above the hint (y+304)
    this.badge = scene.add
      .text(GAME_WIDTH / 2, PANEL_TOP + 252, "", retroStyle(5, "#ffd166"))
      .setOrigin(0.5, 0)
      .setAlign("center")
      .setLineSpacing(6)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    this.count = scene.add
      .text(GAME_WIDTH / 2, PANEL_TOP + 72, "", retroStyle(5, "#8ecbff"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    this.hint = scene.add
      .text(GAME_WIDTH / 2, PANEL_TOP + PANEL_H - 26, "", retroStyle(5, "#9f9fd0"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    // Touch has no TAB key, so the log was out of reach there. This chip sits
    // right-aligned on the count row (x 870..970 at its widest, "BACK"),
    // clear of the count's 340px and of the title above, and a tap queues
    // the same page flip TAB does.
    if (isTouchDevice()) {
      this.pageChip = scene.add
        .text(GAME_WIDTH / 2 + PANEL_W / 2 - 20, PANEL_TOP + 72, "", retroStyle(5, "#ffd166"))
        .setOrigin(1, 0.5)
        .setPadding(10, 8, 10, 8)
        .setBackgroundColor("#334155")
        .setScrollFactor(0)
        .setDepth(152)
        .setVisible(false);
      this.pageChip.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
        this.tabQueued = true;
      });
    }
    this.table.forEach((_f, i) => {
      this.logRows.push(
        scene.add
          .text(GAME_WIDTH / 2 - LOG_W / 2, LOG_TOP + i * LOG_GAP, "", retroStyle(5, "#f5f5f5"))
          .setOrigin(0, 0.5)
          .setScrollFactor(0)
          .setDepth(152)
          .setVisible(false),
      );
    });

    const kb = scene.input.keyboard!;
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z).on(Phaser.Input.Keyboard.Events.DOWN, () => {
      this.zQueued = true;
    });
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on(Phaser.Input.Keyboard.Events.DOWN, () => {
      this.zQueued = true;
    });
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on(Phaser.Input.Keyboard.Events.DOWN, () => {
      this.escQueued = true;
    });
    // TAB flips pages like it flips the shop's buy/sell; no scene maps it to
    // a field action, so a press here can't leak out after the panel closes.
    // Left/right flip them too, as nothing else here uses them: a gamepad
    // sends no TAB (Gamepad.ts), and its d-pad comes in as the arrows. A
    // press while closed is dropped by open(), like TAB's.
    const flip = () => {
      this.tabQueued = true;
    };
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.TAB).on(Phaser.Input.Keyboard.Events.DOWN, flip);
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT).on(Phaser.Input.Keyboard.Events.DOWN, flip);
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT).on(Phaser.Input.Keyboard.Events.DOWN, flip);
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.H).on(Phaser.Input.Keyboard.Events.DOWN, flip);
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.L).on(Phaser.Input.Keyboard.Events.DOWN, flip);
  }

  open(): void {
    this.active = true;
    this.dirty = false;
    this.zQueued = false;
    this.escQueued = false;
    this.tabQueued = false;
    this.bobTween?.remove();
    this.bobTween = this.scene.tweens.add({
      targets: this.bobber,
      y: WATER_Y - 6,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "sine.inout",
    });
    this.showFishing();
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
    if (this.tabQueued) {
      this.tabQueued = false;
      if (this.state === "log") this.showFishing();
      else this.showLog();
      return;
    }
    const now = this.scene.time.now;
    if (this.state === "cast") {
      if (this.nibbles.length > 0 && now >= this.nibbles[0]) {
        this.nibbles.shift();
        this.nibbleTween = this.scene.tweens.add({
          targets: this.bobber.list,
          y: `+=${NIBBLE_DIP}`,
          duration: 80,
          yoyo: true,
          ease: "quad.out",
        });
      }
      if (now >= this.castAt) {
        this.state = "bite";
        this.biteUntil = now + BITE_WINDOW;
        this.biteMark.setVisible(true);
        this.status.setText("!! BITE !!");
        // the idle bob rewrites the float's y every frame, so it would undo
        // this drop at once; it holds still until the next cast
        this.bobTween?.pause();
        this.bobber.setY(WATER_Y + 12);
        // a press made while casting must not carry into the window — only a
        // press inside the 700ms bite window should count as a catch
        this.zQueued = false;
        Sfx.hit();
      }
    } else if (this.state === "bite") {
      if (this.zQueued) {
        this.zQueued = false;
        this.catchFish();
      } else if (now >= this.biteUntil) {
        this.state = "result";
        this.resultUntil = now + RESULT_HOLD;
        this.biteMark.setVisible(false);
        this.bobber.setY(WATER_Y);
        this.status.setText("IT GOT AWAY...");
        Sfx.error();
      }
    } else if (this.state === "result" && now >= this.resultUntil) {
      this.startCast();
    }
  }

  // one switch for every object, so a page can't leave a stray piece of the
  // other one on screen; null hides the whole panel
  private setPage(page: "fish" | "log" | null): void {
    const shown = page !== null;
    this.dim.setVisible(shown);
    this.panel.setVisible(shown);
    this.title.setVisible(shown);
    this.count.setVisible(shown);
    this.hint.setVisible(shown);
    this.pageChip?.setText(page === "log" ? "BACK" : "LOG").setVisible(shown);
    this.water.setVisible(page === "fish");
    this.bobber.setVisible(page === "fish");
    this.status.setVisible(page === "fish");
    this.biteMark.setVisible(false);
    this.badge.setVisible(false);
    for (const row of this.logRows) row.setVisible(page === "log");
  }

  private showFishing(): void {
    this.setPage("fish");
    this.count.setText(`FISH CAUGHT: ${GameState.fishCaught}`);
    bindKeyHint(this.hint, FISH_HINT);
    this.startCast();
  }

  // the cast/bite timers simply stop while this page is up; TAB back starts
  // a fresh cast, so a bite can't expire unseen behind the log
  private showLog(): void {
    this.state = "log";
    this.setPage("log");
    this.title.setText("FISH LOG");
    this.count.setText(`LOGGED ${GameState.fishLogged()}/${TOTAL_FISH}`);
    bindKeyHint(this.hint, LOG_HINT);
    this.table.forEach((f, i) => {
      const best = GameState.fishLog[f.name];
      const caught = best !== undefined;
      // an unseen night fish still names when it bites — that line is the
      // whole reason to come back after dark
      const text = caught
        ? `${f.name.padEnd(NAME_COL)}  BEST ${String(best).padStart(3)}G`
        : `${"???".padEnd(NAME_COL)}  ${f.night ? "NIGHT ONLY" : ""}`;
      this.logRows[i].setText(text);
      this.logRows[i].setColor(!caught ? DIM_TEXT : f.night ? "#c4b5fd" : "#f5f5f5");
    });
    Sfx.move();
  }

  private startCast(): void {
    this.state = "cast";
    const weather = this.weatherBite();
    const now = this.scene.time.now;
    this.castAt = now + Math.round(Phaser.Math.Between(CAST_MIN, CAST_MAX) * (weather?.wait ?? 1));
    // drawn after castAt, so the wait itself is rolled exactly as before
    const first = now + NIBBLE_START;
    const last = this.castAt - NIBBLE_LEAD;
    const times =
      last > first
        ? Array.from({ length: Phaser.Math.Between(0, NIBBLES_MAX) }, () => Phaser.Math.Between(first, last)).sort((a, b) => a - b)
        : [];
    this.nibbles = times.filter((t, i) => i === 0 || t - times[i - 1] >= NIBBLE_GAP);
    // re-read every cast: the clock keeps running while the panel is open,
    // so the title flips the moment the night fish start biting (or a derby
    // starts or ends). A derby swaps the title rather than growing it —
    // "NIGHT FISHING DERBY" (608px) left the panel, then 640, 16px a side
    this.title.setText(
      this.derby()
        ? isNight()
          ? "NIGHT DERBY"
          : "FISHING DERBY"
        : `${isNight() ? "NIGHT " : ""}${this.arctic ? "ICE FISHING" : "FISHING"}`,
    );
    this.biteMark.setVisible(false);
    this.badge.setVisible(false);
    this.bobber.setY(WATER_Y);
    this.bobTween?.resume();
    // the title has no room left (night and derby already swap it), so the
    // weather says itself under CASTING...; the longest, "BLIZZARD: SLOW
    // BITES", is 20 x 24 = 480px (x 400..880) inside the 700 panel
    this.status.setText(weather ? `CASTING...\n${weather.note}` : "CASTING...");
    // a Z press while casting must not carry into the bite window — only a
    // press inside the window (700ms) should count as a catch
    this.zQueued = false;
    Sfx.move();
  }

  // re-read every cast, like the title: the day (and its sky) can turn over
  // while the panel is open
  private weatherBite(): { wait: number; note: string } | null {
    if (this.arctic) return weatherToday("snow") === "blizzard" ? { wait: BLIZZARD_BITE_WAIT, note: "BLIZZARD: SLOW BITES" } : null;
    const sky = weatherToday("town");
    return isWet(sky) ? { wait: WET_BITE_WAIT, note: `${WEATHER_LABEL[sky]}: FASTER BITES` } : null;
  }

  // a town event, so only the village pond holds the derby — the snow
  // field's ice hole fishes at its usual rates
  private derby(): boolean {
    return !this.arctic && isEventToday("derby");
  }

  private catchFish(): void {
    this.state = "result";
    this.resultUntil = this.scene.time.now + RESULT_HOLD;
    this.biteMark.setVisible(false);
    this.bobber.setY(WATER_Y);
    const biting = this.table.filter((f) => !f.night || isNight());
    let r = Math.random() * biting.reduce((sum, f) => sum + f.chance, 0);
    let fish: FishDef = biting[biting.length - 1];
    for (const f of biting) {
      if (r < f.chance) {
        fish = f;
        break;
      }
      r -= f.chance;
    }
    const roll = Phaser.Math.Between(fish.min, fish.max);
    const derby = this.derby();
    // gainGold()'s return value, not the raw roll, so the message never
    // overstates what was actually credited near the gold cap
    const gold = GameState.gainGold(derby ? Math.round(roll * DERBY_MULT) : roll);
    GameState.fishCaught += 1;
    addIngredient(GameState.pantry, "fish");
    const rare = isRareFish(fish);
    if (rare) addIngredient(GameState.pantry, "rareFish");
    // the log keeps the fish's own roll, so a derby can't inflate a record
    const logged = GameState.logFish(fish.name, roll);
    this.dirty = true;
    this.count.setText(`FISH CAUGHT: ${GameState.fishCaught}`);
    // longest with the tag: "+180G (x1.5) +POTION", 20 x 24 = 480px
    let reward = `+${gold}G${derby ? ` (x${DERBY_MULT})` : ""}`;
    if (fish.bonusItem) {
      GameState.inventory[fish.bonusItem] += 1;
      reward += ` +${BONUS_LABEL[fish.bonusItem]}`;
    }
    this.status.setText(`CAUGHT: ${fish.name}!\n${reward}`);
    // under the reward, the ingredient for the kitchen (cooking.ts) and any
    // log news: "+1 FISH TO COOK  NEW BEST!" is 26 x 20 = 520px of the 660.
    // A rare bite's "+1 FISH +1 RARE FISH TO COOK" is 28 (560px), so its
    // news takes a line of its own below.
    const news = logged === "new" ? "NEW!" : logged === "best" ? "NEW BEST!" : "";
    const sep = news && (rare ? "\n" : "  ");
    this.badge.setText(`${rare ? "+1 FISH +1 RARE FISH" : "+1 FISH"} TO COOK${sep}${news}`).setVisible(true);
    // a new species gets the bestiary's capture jingle — same "added to the
    // book" moment — over the usual catch sounds
    if (logged === "new") Sfx.capture();
    else if (fish.bonusItem) Sfx.victory();
    else Sfx.pickup();
  }

  private close(): void {
    this.active = false;
    this.bobTween?.remove();
    this.setPage(null);
    if (this.dirty) GameState.save();
  }

  destroy(): void {
    this.bobTween?.remove();
    // close() lets a twitch finish (160ms) so the float's parts end back in
    // place; only here, with the float going away, is one cut short
    this.nibbleTween?.remove();
    this.dim.destroy();
    this.panel.destroy();
    this.title.destroy();
    this.water.destroy();
    this.bobber.destroy();
    this.biteMark.destroy();
    this.status.destroy();
    this.badge.destroy();
    this.count.destroy();
    this.hint.destroy();
    this.pageChip?.destroy();
    for (const row of this.logRows) row.destroy();
  }
}
