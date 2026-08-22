import Phaser from "phaser";
import { Sfx } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { EQUIP_SLOT, GameState, type InventoryState } from "../gameState";
import { retroStyle } from "../pixelart";

type EquipKey = "sword" | "shield" | "ironSword" | "ironShield" | "amulet" | "mythrilSword" | "mythrilShield";

interface ShopItem {
  name: string;
  price: number;
  // every item maps 1:1 to an inventory count — sell mode reads/decrements
  // this regardless of whether it's a consumable or equipment
  invKey: keyof InventoryState;
  key?: EquipKey;
  // Gated stock: shown as LOCKED until the quest opens it, so late-game gear
  // can't be bought at level 1 and flatten the difficulty curve.
  unlocked?: () => boolean;
  buy(): string;
}

const SHOP_ITEMS: ShopItem[] = [
  {
    name: "POTION",
    price: 10,
    invKey: "potion",
    buy: () => {
      GameState.inventory.potion += 1;
      return "Potion acquired!";
    },
  },
  {
    name: "MPOTION",
    price: 15,
    invKey: "mPotion",
    buy: () => {
      GameState.inventory.mPotion += 1;
      return "MPotion acquired!";
    },
  },
  {
    name: "CANDY",
    price: 20,
    invKey: "candy",
    buy: () => {
      GameState.inventory.candy += 1;
      return "Candy acquired!";
    },
  },
  {
    name: "HI-POTION",
    price: 30,
    invKey: "hiPotion",
    buy: () => {
      GameState.inventory.hiPotion += 1;
      return "Hi-Potion acquired!";
    },
  },
  {
    name: "ETHER",
    price: 25,
    invKey: "ether",
    buy: () => {
      GameState.inventory.ether += 1;
      return "Ether acquired!";
    },
  },
  {
    name: "ELIXIR",
    price: 100,
    invKey: "elixir",
    buy: () => {
      GameState.inventory.elixir += 1;
      return "Elixir acquired!";
    },
  },
  {
    name: "BOMB",
    price: 50,
    invKey: "bomb",
    buy: () => {
      GameState.inventory.bomb += 1;
      return "Bomb acquired!";
    },
  },
  {
    name: "SWORD",
    price: 80,
    invKey: "sword",
    key: "sword",
    buy: () => {
      GameState.inventory.sword += 1;
      return "Sword acquired!";
    },
  },
  {
    name: "SHIELD",
    price: 80,
    invKey: "shield",
    key: "shield",
    buy: () => {
      GameState.inventory.shield += 1;
      return "Shield acquired!";
    },
  },
  {
    name: "IRON SWORD",
    price: 180,
    invKey: "ironSword",
    key: "ironSword",
    buy: () => {
      GameState.inventory.ironSword += 1;
      return "Iron Sword acquired!";
    },
  },
  {
    name: "IRON SHIELD",
    price: 180,
    invKey: "ironShield",
    key: "ironShield",
    buy: () => {
      GameState.inventory.ironShield += 1;
      return "Iron Shield acquired!";
    },
  },
  {
    name: "AMULET",
    price: 120,
    invKey: "amulet",
    key: "amulet",
    buy: () => {
      GameState.inventory.amulet += 1;
      return "Amulet acquired!";
    },
  },
  {
    name: "MYTHRIL SWORD",
    price: 320,
    invKey: "mythrilSword",
    key: "mythrilSword",
    unlocked: () => GameState.quest.bossDefeated,
    buy: () => {
      GameState.inventory.mythrilSword += 1;
      return "Mythril Sword acquired!";
    },
  },
  {
    name: "MYTHRIL SHIELD",
    price: 320,
    invKey: "mythrilShield",
    key: "mythrilShield",
    unlocked: () => GameState.quest.bossDefeated,
    buy: () => {
      GameState.inventory.mythrilShield += 1;
      return "Mythril Shield acquired!";
    },
  },
];

// half the buy price, floored, never free
const sellPrice = (price: number): number => Math.max(1, Math.floor(price / 2));

const SHOP_ROWS = Math.ceil(SHOP_ITEMS.length / 2);
const SHOP_ROW_GAP = 44;

// Name and price live on separate columns so prices line up in a readable
// money column and a long name can't shove the next column sideways.
const PANEL_W = 1100;
const PANEL_H = 510;
const PANEL_TOP = GAME_HEIGHT / 2 - PANEL_H / 2;
const COL_W = 520;
const NAME_X = GAME_WIDTH / 2 - PANEL_W / 2 + 60;
const PRICE_DX = 370;

export class ShopUI {
  private scene: Phaser.Scene;
  private active = false;
  private index = 0;
  private mode: "buy" | "sell" = "buy";

  private dim: Phaser.GameObjects.Rectangle;
  private panel: Phaser.GameObjects.Rectangle;
  private title: Phaser.GameObjects.Text;
  private items: Phaser.GameObjects.Text[] = [];
  private prices: Phaser.GameObjects.Text[] = [];
  private headers: Phaser.GameObjects.Text[] = [];
  private cursor: Phaser.GameObjects.Text;
  private goldText: Phaser.GameObjects.Text;
  private msg: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;
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
    this.panel = scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, PANEL_W, PANEL_H, 0x0b0b2b, 0.95)
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
      const col = Math.floor(i / SHOP_ROWS);
      const x = NAME_X + col * COL_W;
      const y = startY + (i % SHOP_ROWS) * SHOP_ROW_GAP;
      this.items.push(
        scene.add.text(x, y, item.name, retroStyle(6, "#ffffff")).setOrigin(0, 0.5).setScrollFactor(0).setDepth(152).setVisible(false),
      );
      this.prices.push(
        scene.add
          .text(x + PRICE_DX, y, "", retroStyle(6, "#ffffff"))
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
      .text(GAME_WIDTH / 2, PANEL_TOP + PANEL_H - 34, "", retroStyle(6, "#f5f5f5"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    this.hint = scene.add
      .text(GAME_WIDTH / 2, PANEL_TOP + PANEL_H - 12, "TAB: BUY/SELL", retroStyle(4, "#666666"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);

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
    this.hint.setVisible(true);
    for (const t of this.items) t.setVisible(true);
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
      this.index = (this.index + SHOP_ROWS) % SHOP_ITEMS.length;
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
      this.showMsg("Defeat the KING SLIME first!");
      return;
    }
    if (item.key && GameState.inventory[item.key] > 0) {
      Sfx.error();
      this.showMsg("Already owned!");
      return;
    }
    if (GameState.gold < item.price) {
      Sfx.error();
      this.showMsg("Not enough gold!");
      return;
    }
    GameState.gold -= item.price;
    const result = item.buy();
    Sfx.buy();
    GameState.save();
    this.showMsg(result);
    this.refresh();
  }

  private sell(): void {
    const item = SHOP_ITEMS[this.index];
    if (GameState.inventory[item.invKey] <= 0) {
      Sfx.error();
      this.showMsg("Nothing to sell!");
      return;
    }
    // selling your last one while it's worn unequips it first, same as
    // dropping it from the inventory screen would imply
    if (item.key && GameState.isEquipped(item.key)) GameState.unequip(EQUIP_SLOT[item.key]);
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
    this.goldText.setText(`G ${GameState.gold}`);
    this.title.setText(this.mode === "buy" ? "SHOP" : "SHOP - SELL");
    for (let i = 0; i < SHOP_ITEMS.length; i++) {
      const item = SHOP_ITEMS[i];
      if (this.mode === "sell") {
        const count = GameState.inventory[item.invKey];
        const color = count > 0 ? "#ffffff" : "#666666";
        this.items[i].setText(item.name + (count > 1 ? ` (x${count})` : "")).setColor(color);
        this.prices[i].setText(count > 0 ? `+${sellPrice(item.price)}G` : "NONE").setColor(color);
        continue;
      }
      const locked = item.unlocked ? !item.unlocked() : false;
      const owned = item.key ? GameState.inventory[item.key] > 0 : false;
      const color = locked ? "#8b5cf6" : owned ? "#666666" : "#ffffff";
      this.items[i].setText(item.name).setColor(color);
      this.prices[i].setText(locked ? "LOCKED" : owned ? "SOLD" : `${item.price}G`).setColor(color);
    }
    this.renderCursor();
  }

  private renderCursor(): void {
    const target = this.items[this.index];
    this.cursor.setPosition(target.x - 26, target.y);
  }

  private close(): void {
    this.active = false;
    this.dim.setVisible(false);
    this.panel.setVisible(false);
    this.title.setVisible(false);
    this.goldText.setVisible(false);
    this.msg.setVisible(false);
    this.msg.setText("");
    this.hint.setVisible(false);
    this.msgTimer?.remove();
    for (const t of this.items) t.setVisible(false);
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
    this.hint.destroy();
    this.msgTimer?.remove();
    for (const t of this.items) t.destroy();
    for (const t of this.prices) t.destroy();
    for (const t of this.headers) t.destroy();
    this.cursor.destroy();
    // keys are shared instances from kb.addKey (same keycode → same object);
    // destroying them would wipe other panels' listeners. Scene shutdown
    // already tears every Key down via KeyboardPlugin.removeAllKeys(true).
  }
}
