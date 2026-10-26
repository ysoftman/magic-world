import Phaser from "phaser";
import { Sfx } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH, MAX_GOLD } from "../config";
import { eventToday, MARKET_DISCOUNT, shopPrice } from "../events";
import { dayIndex, EQUIP_SLOT, GameState } from "../gameState";
import { ITEM_INFO } from "../itemInfo";
import { DIM_TEXT, retroStyle } from "../pixelart";
import { SHOP_ITEMS } from "../shopItems";
import { isTouchDevice } from "./TouchControls";

// half the buy price, floored, never free
const sellPrice = (price: number): number => Math.max(1, Math.floor(price / 2));

// One column per kind (supplies left, equipment right) rather than splitting
// the list in half, so the headers stay true once the two kinds differ in
// length. SHOP_ITEMS lists every supply before any equipment.
const SUPPLY_COUNT = SHOP_ITEMS.filter((item) => !item.key).length;
const SHOP_ROWS = Math.max(SUPPLY_COUNT, SHOP_ITEMS.length - SUPPLY_COUNT);
const SHOP_ROW_GAP = 44;
const slotOf = (i: number): { col: number; row: number } => (i < SUPPLY_COUNT ? { col: 0, row: i } : { col: 1, row: i - SUPPLY_COUNT });

// Each row is the item's icon (32px, BootScene "icon-<key>"), its name 8px
// after it and its price on a column of its own, so prices line up in a
// readable money column and a long name can't shove the next column
// sideways. The equipment column's prices sit 40px further out than the
// supplies' (x 1050 against 490): its names run to 14 glyphs (336px from
// x=680, to 1016), the supplies' to 9 ("HI-POTION", to 376), and the
// supplies' widest price, "100G" (96px, to 586), stays 16px short of the
// cursor beside the equipment column (x>=602). "LOCKED" (6 x 24 = 144px from
// x=1050) ends 26px inside the right edge. The height grows with the rows:
// 130 to the first row, 116 from the last row to the bottom (msg + hint).
const PANEL_W = 1160;
const PANEL_H = 202 + SHOP_ROWS * SHOP_ROW_GAP;
// Centered on a keyboard. On touch it's pinned near the top instead, so the
// last equipment row (y 498..522) ends above the Z button (y>=532) instead of
// under it. The msg then sits at y 564..588, and centered it's bounded by the
// nearer obstacle, the d-pad (x<=258): 30 glyphs (720px, x 280..1000) at
// most — the longest message, "Antidote Charm: blocks poison!", is 30.
const PANEL_TOP = isTouchDevice() ? 28 : GAME_HEIGHT / 2 - PANEL_H / 2;
const COL_W = 520;
const NAME_X = GAME_WIDTH / 2 - PANEL_W / 2 + 60;
// a row's icon starts at its column's x, its name ICON_DX after, its price
// PRICE_DX[col] after
const ICON_DX = 40;
const PRICE_DX = [370, 410];
// a sell row ("IRON SHIELD (x1) (E)") may run past the price column; drop
// the count, then the (E) — the gold color still marks it as worn
const sellNameW = (col: number): number => PRICE_DX[col] - ICON_DX - 8;
// an icon for what can't be had here and now (LOCKED, SOLD, none to sell)
const ICON_NONE_ALPHA = 0.35;
// The cursor item's "NAME: INFO" line, on its own row halfway between the
// last item row and the msg (12px gap to each at 20px tall), so a buy/sell
// message never covers it. At retroStyle(5) the longest, 40 glyphs, is 800px
// (x 240..1040): inside the panel on a keyboard, and on touch (y 533..553)
// clear of the d-pad's up arrow (x<=194) and Z (x>=1086 at that height).
const INFO_Y = PANEL_TOP + PANEL_H - 83;

export class ShopUI {
  private scene: Phaser.Scene;
  private active = false;
  private index = 0;
  private mode: "buy" | "sell" = "buy";
  // the day the prices on screen were worked out for (see update())
  private day = -1;

  private dim: Phaser.GameObjects.Rectangle;
  private panel: Phaser.GameObjects.Rectangle;
  private title: Phaser.GameObjects.Text;
  private items: Phaser.GameObjects.Text[] = [];
  private icons: Phaser.GameObjects.Image[] = [];
  private prices: Phaser.GameObjects.Text[] = [];
  private headers: Phaser.GameObjects.Text[] = [];
  private cursor: Phaser.GameObjects.Text;
  private goldText: Phaser.GameObjects.Text;
  private msg: Phaser.GameObjects.Text;
  private info: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;
  private modeChip?: Phaser.GameObjects.Text;
  private msgTimer?: Phaser.Time.TimerEvent;

  private keyUp: Phaser.Input.Keyboard.Key;
  private keyDown: Phaser.Input.Keyboard.Key;
  private keyLeft: Phaser.Input.Keyboard.Key;
  private keyRight: Phaser.Input.Keyboard.Key;
  private keyH: Phaser.Input.Keyboard.Key;
  private keyJ: Phaser.Input.Keyboard.Key;
  private keyK: Phaser.Input.Keyboard.Key;
  private keyL: Phaser.Input.Keyboard.Key;
  private keyZ: Phaser.Input.Keyboard.Key;
  private keyTab: Phaser.Input.Keyboard.Key;
  private keyEsc: Phaser.Input.Keyboard.Key;

  private upQueued = false;
  private downQueued = false;
  private leftQueued = false;
  private rightQueued = false;
  private zQueued = false;
  private tabQueued = false;
  private escQueued = false;

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
      .text(GAME_WIDTH / 2, PANEL_TOP + 40, "SHOP", retroStyle(8, "#ffd166"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);

    ["SUPPLIES", "EQUIPMENT"].forEach((label, col) => {
      this.headers.push(
        scene.add
          .text(NAME_X + col * COL_W, PANEL_TOP + 84, label, retroStyle(5, "#8ecbff"))
          .setOrigin(0, 0.5)
          .setScrollFactor(0)
          .setDepth(152)
          .setVisible(false),
      );
    });

    const startY = PANEL_TOP + 130;
    SHOP_ITEMS.forEach((item, i) => {
      const { col, row } = slotOf(i);
      const x = NAME_X + col * COL_W;
      const y = startY + row * SHOP_ROW_GAP;
      this.icons.push(
        scene.add
          .image(x + 16, y, `icon-${item.invKey}`)
          .setScale(0.5)
          .setScrollFactor(0)
          .setDepth(152)
          .setVisible(false),
      );
      this.items.push(
        scene.add
          .text(x + ICON_DX, y, item.name, retroStyle(6, "#ffffff"))
          .setOrigin(0, 0.5)
          .setScrollFactor(0)
          .setDepth(152)
          .setVisible(false),
      );
      this.prices.push(
        scene.add
          .text(x + PRICE_DX[col], y, "", retroStyle(6, "#ffffff"))
          .setOrigin(0, 0.5)
          .setScrollFactor(0)
          .setDepth(152)
          .setVisible(false),
      );
    });
    this.cursor = scene.add.text(0, 0, ">", retroStyle(6, "#ffd166")).setOrigin(0.5).setScrollFactor(0).setDepth(152).setVisible(false);

    this.goldText = scene.add
      .text(GAME_WIDTH / 2 + PANEL_W / 2 - 40, PANEL_TOP + 40, "G 0", retroStyle(6, "#8ecbff"))
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    this.msg = scene.add
      .text(GAME_WIDTH / 2, PANEL_TOP + PANEL_H - 50, "", retroStyle(6, "#f5f5f5"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    this.info = scene.add
      .text(GAME_WIDTH / 2, INFO_Y, "", retroStyle(5, "#9f9fd0"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    // the keyboard line (896px) would run under the d-pad and ESC on touch,
    // which switches modes with the chip below instead of TAB
    this.hint = scene.add
      .text(
        GAME_WIDTH / 2,
        PANEL_TOP + PANEL_H - 20,
        isTouchDevice() ? "D-PAD: MOVE   Z: BUY/SELL   ESC: CLOSE" : "HJKL: MOVE   Z: BUY/SELL   TAB: SWITCH MODE   ESC: CLOSE",
        retroStyle(4, DIM_TEXT),
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    // Touch has no TAB key, so selling was out of reach there; this chip on
    // the title row (x 120..220, clear of the centered title) names the other
    // mode and a tap queues the same switch TAB does
    if (isTouchDevice()) {
      this.modeChip = scene.add
        .text(NAME_X, PANEL_TOP + 40, "", retroStyle(5, "#ffd166"))
        .setOrigin(0, 0.5)
        .setPadding(10, 8, 10, 8)
        .setBackgroundColor("#334155")
        .setScrollFactor(0)
        .setDepth(152)
        .setVisible(false);
      this.modeChip.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
        this.tabQueued = true;
      });
    }

    const kb = scene.input.keyboard!;
    this.keyUp = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyDown = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.keyLeft = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keyRight = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keyH = kb.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    this.keyJ = kb.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.keyK = kb.addKey(Phaser.Input.Keyboard.KeyCodes.K);
    this.keyL = kb.addKey(Phaser.Input.Keyboard.KeyCodes.L);
    this.keyZ = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.keyTab = kb.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.keyEsc = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

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
    this.keyTab.on(DOWN, () => {
      this.tabQueued = true;
    });
    this.keyEsc.on(DOWN, () => {
      this.escQueued = true;
    });
  }

  open(): void {
    this.active = true;
    this.index = 0;
    this.mode = "buy";
    this.upQueued = false;
    this.downQueued = false;
    this.leftQueued = false;
    this.rightQueued = false;
    this.zQueued = false;
    this.tabQueued = false;
    this.escQueued = false;
    this.dim.setVisible(true);
    this.panel.setVisible(true);
    this.title.setVisible(true);
    this.goldText.setVisible(true);
    this.msg.setVisible(true);
    this.info.setVisible(true);
    this.hint.setVisible(true);
    this.modeChip?.setVisible(true);
    for (const t of this.items) t.setVisible(true);
    for (const t of this.icons) t.setVisible(true);
    for (const t of this.prices) t.setVisible(true);
    for (const t of this.headers) t.setVisible(true);
    this.cursor.setVisible(true);
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
    // the town clock keeps running behind the panel; re-price the moment a
    // market day starts or ends rather than charging what isn't shown
    if (dayIndex() !== this.day) this.refresh();
    if (this.tabQueued) {
      this.tabQueued = false;
      this.mode = this.mode === "buy" ? "sell" : "buy";
      Sfx.move();
      this.refresh();
    }
    const prev = this.index;
    if (this.upQueued) {
      this.upQueued = false;
      this.index = (this.index + SHOP_ITEMS.length - 1) % SHOP_ITEMS.length;
    }
    if (this.downQueued) {
      this.downQueued = false;
      this.index = (this.index + 1) % SHOP_ITEMS.length;
    }
    if (this.leftQueued || this.rightQueued) {
      this.leftQueued = false;
      this.rightQueued = false;
      // same row in the other column, or its last row if that one is shorter
      const { col, row } = slotOf(this.index);
      this.index = col === 0 ? SUPPLY_COUNT + Math.min(row, SHOP_ITEMS.length - SUPPLY_COUNT - 1) : Math.min(row, SUPPLY_COUNT - 1);
    }
    if (this.index !== prev) {
      Sfx.move();
      this.renderCursor();
    }
    if (this.zQueued) {
      this.zQueued = false;
      if (this.mode === "buy") this.buy();
      else this.sell();
    }
  }

  private buy(): void {
    const item = SHOP_ITEMS[this.index];
    if (item.unlocked && !item.unlocked()) {
      Sfx.error();
      this.showMsg(item.lockedMsg ?? "Not for sale yet!");
      return;
    }
    if (item.key && GameState.inventory[item.key] > 0) {
      Sfx.error();
      this.showMsg("Already owned!");
      return;
    }
    const price = shopPrice(item.price);
    if (GameState.gold < price) {
      Sfx.error();
      this.showMsg("Not enough gold!");
      return;
    }
    GameState.gold -= price;
    GameState.inventory[item.invKey] += 1;
    Sfx.buy();
    GameState.save();
    this.showMsg(item.msg);
    this.refresh();
  }

  private sell(): void {
    const item = SHOP_ITEMS[this.index];
    const count = GameState.inventory[item.invKey];
    if (count <= 0) {
      Sfx.error();
      this.showMsg("Nothing to sell!");
      return;
    }
    if (GameState.gold >= MAX_GOLD) {
      Sfx.error();
      this.showMsg("Gold is full!");
      return;
    }
    // only unequip when this was the last copy — a duplicate from a quest
    // reward (e.g. a second MYTHRIL SWORD) should stay worn
    if (item.key && count === 1 && GameState.isEquipped(item.key)) GameState.unequip(EQUIP_SLOT[item.key]);
    GameState.inventory[item.invKey] -= 1;
    const gold = GameState.gainGold(sellPrice(item.price));
    Sfx.buy();
    GameState.save();
    this.showMsg(`Sold for ${gold}G!`);
    this.refresh();
  }

  private showMsg(text: string): void {
    this.msgTimer?.remove();
    this.msg.setText(text);
    this.msgTimer = this.scene.time.addEvent({
      delay: 1200,
      callback: () => this.msg.setText(""),
    });
  }

  private refresh(): void {
    this.day = dayIndex();
    // Only buying is discounted (sell prices stay at half the list price),
    // so the tag rides on the buy title alone. "SHOP - MARKET DAY -20%" is
    // 22 x 32 = 704px (x 288..992): clear of the gold readout (x>=1036) and
    // of the touch mode chip (x<=220).
    const market = eventToday()?.kind === "market";
    this.goldText.setText(`G ${GameState.gold}`);
    this.title.setText(this.mode === "sell" ? "SHOP - SELL" : market ? `SHOP - MARKET DAY -${Math.round(MARKET_DISCOUNT * 100)}%` : "SHOP");
    this.modeChip?.setText(this.mode === "buy" ? "SELL" : "BUY");
    for (let i = 0; i < SHOP_ITEMS.length; i++) {
      const item = SHOP_ITEMS[i];
      if (this.mode === "sell") {
        const count = GameState.inventory[item.invKey];
        const equipped = item.key ? GameState.isEquipped(item.key) : false;
        const color = equipped ? "#ffd166" : count > 0 ? "#ffffff" : DIM_TEXT;
        const worn = equipped ? " (E)" : "";
        const labels = count > 0 ? [`${item.name} (x${count})${worn}`, `${item.name}${worn}`, item.name] : [item.name];
        for (const label of labels) {
          this.items[i].setText(label);
          if (this.items[i].width <= sellNameW(slotOf(i).col)) break;
        }
        this.items[i].setColor(color);
        this.icons[i].setAlpha(count > 0 ? 1 : ICON_NONE_ALPHA);
        this.prices[i].setText(count > 0 ? `+${sellPrice(item.price)}G` : "NONE").setColor(color);
        continue;
      }
      const locked = item.unlocked ? !item.unlocked() : false;
      const owned = item.key ? GameState.inventory[item.key] > 0 : false;
      const color = locked ? "#8b5cf6" : owned ? DIM_TEXT : "#ffffff";
      this.items[i].setText(item.name).setColor(color);
      this.icons[i].setAlpha(locked || owned ? ICON_NONE_ALPHA : 1);
      // a market-day price is green, so the cut reads at a glance
      this.prices[i]
        .setText(locked ? "LOCKED" : owned ? "SOLD" : `${shopPrice(item.price)}G`)
        .setColor(market && !locked && !owned ? "#a3e635" : color);
    }
    this.renderCursor();
  }

  // every cursor move and refresh lands here, so the info line always names
  // what the cursor is on — a LOCKED item included, so the player can see
  // what the boss fight opens up (Z on it still names that boss)
  private renderCursor(): void {
    const target = this.items[this.index];
    this.cursor.setPosition(target.x - ICON_DX - 26, target.y);
    const item = SHOP_ITEMS[this.index];
    this.info.setText(`${item.name}: ${ITEM_INFO[item.invKey]}`);
  }

  private close(): void {
    this.active = false;
    this.dim.setVisible(false);
    this.panel.setVisible(false);
    this.title.setVisible(false);
    this.goldText.setVisible(false);
    this.msg.setVisible(false);
    this.msg.setText("");
    this.info.setVisible(false);
    this.hint.setVisible(false);
    this.modeChip?.setVisible(false);
    this.msgTimer?.remove();
    for (const t of this.items) t.setVisible(false);
    for (const t of this.icons) t.setVisible(false);
    for (const t of this.prices) t.setVisible(false);
    for (const t of this.headers) t.setVisible(false);
    this.cursor.setVisible(false);
  }

  destroy(): void {
    this.dim.destroy();
    this.panel.destroy();
    this.title.destroy();
    this.goldText.destroy();
    this.msg.destroy();
    this.info.destroy();
    this.hint.destroy();
    this.modeChip?.destroy();
    this.msgTimer?.remove();
    for (const t of this.items) t.destroy();
    for (const t of this.icons) t.destroy();
    for (const t of this.prices) t.destroy();
    for (const t of this.headers) t.destroy();
    this.cursor.destroy();
    // keys are shared instances from kb.addKey (same keycode → same object);
    // destroying them would wipe other panels' listeners. Scene shutdown
    // already tears every Key down via KeyboardPlugin.removeAllKeys(true).
  }
}
