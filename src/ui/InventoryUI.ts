import Phaser from "phaser";
import { Sfx } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH, PIXEL } from "../config";
import { MATERIAL_KEYS, MATERIALS, type MaterialKey } from "../drops";
import { type EquipmentKey, GameState, refinedName } from "../gameState";
import { ETHER_MP, HI_POTION_HP, itemInfo, MPOTION_MP, POTION_HP } from "../itemInfo";
import { bodyStyle, DIM_TEXT, retroStyle } from "../pixelart";
import type { PixelText } from "../pixelText";
import { MAX_MAPS, REGIONS, type TreasureRegion } from "../treasure";
import { bindKeyHint, keyHint } from "./Gamepad";
import { PANEL_TOP_OVER_HUD } from "./StatusHud";
import { isTouchDevice } from "./TouchControls";
import { drawTreasureMap } from "./TreasureDig";

type ConsumableKey = "potion" | "mPotion" | "candy" | "hiPotion" | "ether" | "elixir" | "bomb";

interface UseItem {
  label: string;
  key: ConsumableKey;
  kind: "use";
  use(): string;
}
interface EquipItem {
  label: string;
  key: EquipmentKey;
  kind: "equip";
}
// held only for the BLACKSMITH; Z on one says so
interface MaterialItem {
  label: string;
  key: MaterialKey;
  kind: "material";
}
// a held treasure map (treasure.ts), by its place in GameState.treasureMaps
interface MapItem {
  label: string;
  key: "map";
  kind: "map";
  slot: number;
}
type InventoryItem = UseItem | EquipItem | MaterialItem | MapItem;

// a map's region in its own count column, 7 glyphs at most so it ends (x
// 508..676) short of the chart drawn beside it from x=680
const MAP_TAG: Record<TreasureRegion, string> = { town: "TOWN", dungeon: "CAVE", forest: "FOREST", snow: "SNOW", volcano: "VOLCANO" };

const INVENTORY_ROW_GAP = 44;

const CONSUMABLES: UseItem[] = [
  {
    label: "POTION",
    key: "potion",
    kind: "use",
    use: () => {
      const healed = Math.min(GameState.effMaxHp() - GameState.player.hp, POTION_HP);
      GameState.player.hp += healed;
      return healed > 0 ? `HP +${healed}!` : "HP is already full!";
    },
  },
  {
    label: "BOMB",
    key: "bomb",
    kind: "use",
    use: () => "Bomb is for battle!",
  },
  {
    label: "MPOTION",
    key: "mPotion",
    kind: "use",
    use: () => {
      const restored = Math.min(GameState.player.maxMp - GameState.player.mp, MPOTION_MP);
      GameState.player.mp += restored;
      return restored > 0 ? `MP +${restored}!` : "MP is already full!";
    },
  },
  {
    label: "CANDY",
    key: "candy",
    kind: "use",
    use: () => "Candy is for battle!",
  },
  {
    label: "HI-POTION",
    key: "hiPotion",
    kind: "use",
    use: () => {
      const healed = Math.min(GameState.effMaxHp() - GameState.player.hp, HI_POTION_HP);
      GameState.player.hp += healed;
      return healed > 0 ? `HP +${healed}!` : "HP is already full!";
    },
  },
  {
    label: "ETHER",
    key: "ether",
    kind: "use",
    use: () => {
      const restored = Math.min(GameState.player.maxMp - GameState.player.mp, ETHER_MP);
      GameState.player.mp += restored;
      return restored > 0 ? `MP +${restored}!` : "MP is already full!";
    },
  },
  {
    label: "ELIXIR",
    key: "elixir",
    kind: "use",
    use: () => {
      GameState.player.hp = GameState.effMaxHp();
      GameState.player.mp = GameState.player.maxMp;
      return "HP and MP fully restored!";
    },
  },
];

const equip = (label: string, key: EquipmentKey): EquipItem => ({ label, key, kind: "equip" });

// Each kind gets its own column (interleaved kinds read as one jumbled list),
// two columns a page. The columns of both pages read as one strip, as in
// BestiaryUI: LEFT/RIGHT past a page's outer column lands on the other page.
// Weapons and body armor share a column, cheapest first, since each pair of
// rows is a choice for the same slot; accessories get their own.
const COLUMNS: Array<{ header: string; items: InventoryItem[] }> = [
  { header: "CONSUMABLES", items: CONSUMABLES },
  { header: "MATERIALS", items: MATERIAL_KEYS.map((key): MaterialItem => ({ label: MATERIALS[key].name, key, kind: "material" })) },
  {
    header: "WEAPONS & ARMOR",
    items: [
      equip("SWORD", "sword"),
      equip("IRON SWORD", "ironSword"),
      equip("MYTHRIL SWORD", "mythrilSword"),
      equip("DRAKE BLADE", "drakeBlade"),
      equip("SHIELD", "shield"),
      equip("IRON SHIELD", "ironShield"),
      equip("MYTHRIL SHIELD", "mythrilShield"),
      equip("GLACIER MAIL", "glacierMail"),
    ],
  },
  {
    header: "ACCESSORIES",
    items: [
      equip("AMULET", "amulet"),
      equip("ANTIDOTE CHARM", "antidoteCharm"),
      equip("EMBER RING", "emberRing"),
      equip("LIFE CHARM", "lifeCharm"),
      equip("TALISMAN", "talisman"),
    ],
  },
  // the third page: the maps on the left, the cursor's map drawn on the right
  {
    header: "TREASURE MAPS",
    items: Array.from({ length: MAX_MAPS }, (_, slot): MapItem => ({ label: `MAP ${slot + 1}`, key: "map", kind: "map", slot })),
  },
];
const PAGES = Math.ceil(COLUMNS.length / 2);
const INVENTORY_ITEMS = COLUMNS.flatMap((c) => c.items);
const SLOTS = COLUMNS.flatMap((c, col) => c.items.map((_, row) => ({ col, row })));
const INVENTORY_ROWS = Math.max(...COLUMNS.map((c) => c.items.length));
const firstOf = (col: number): number => COLUMNS.slice(0, col).reduce((n, c) => n + c.items.length, 0);
const pageOf = (i: number): number => Math.floor(SLOTS[i].col / 2);

// Each row is the item's icon (32px, BootScene "icon-<key>"), its name 8px
// after it and its count on a fixed column, so a long label like MYTHRIL
// SHIELD can't push its count into the next column the way one combined
// "LABEL xN" string did. The panel stays 1160 wide so its right edge
// (x=1220) clears the touch menu strip (x>=1222). The longest name (14 x 24 =
// 336px from x=720) ends a glyph (24px) short of its count: at 12px
// "ANTIDOTE CHARMx0" read as one word. The widest count, "x99 E" (5 x 24 =
// 120px, x 1080..1200), keeps 20px inside the panel; in the left column
// (x 520..640) it would reach the right column's cursor (x>=642), but only a
// hand-made save holds 99 of a worn piece — "x1 E" ends at 616, "x99" at 592.
// Worn gear says "E", not "(E)": the 168px of the old "x99 (E)" ran into
// that cursor once the names moved over for the icons; it's gold anyway.
// The height grows with the rows: 130 to the first row, 116 from the last
// row to the bottom (info, message and key lines, as in the shop). The pager
// shares the header row, right aligned: "< PAGE 1/2 >" (12 x 20 = 240px,
// x 940..1180) stays 40px clear of the longest right-column header,
// ACCESSORIES (11 x 20 = 220px from x=680).
const PANEL_W = 1160;
const PANEL_H = 202 + INVENTORY_ROWS * INVENTORY_ROW_GAP;
// Centered on a keyboard (y 83..637, just under the HUD's second row). On
// touch it's pinned over the HUD instead (statusHud.ts), so the last row (8
// rows: y 434..458) ends well above the Z button (y>=532). The msg then sits
// at y 499..525, bounded by the d-pad's up arrow (x<=194) and Z (x>=1076):
// at bodyStyle(22) 59 glyphs at most (826px, x 227..1053); the longest,
// "Take it to the BLACKSMITH!" and "HP and MP are already full!", are 27.
const PANEL_TOP = isTouchDevice() ? PANEL_TOP_OVER_HUD : GAME_HEIGHT / 2 - PANEL_H / 2;
const COL_W = 560;
const NAME_X = GAME_WIDTH / 2 - PANEL_W / 2 + 60;
// a row's icon starts at NAME_X, its name ICON_DX after
const ICON_DX = 40;
const COUNT_DX = 400;
// a map row's region tag, a glyph further in than the counts so "VOLCANO"
// still ends before the chart
const MAP_TAG_DX = 388;
// an icon for none of it (count 0, an empty map slot), dimmed with its name
const ICON_NONE_ALPHA = 0.35;
// A refined piece's name carries its "+3" (refinedName). Past 14 glyphs at
// retroStyle(6) a name runs into its count ("MYTHRIL SHIELD+5", 16 x 24 =
// 384px from x=720, to 1104, over the count from 1080), and the panel can't
// widen (the touch strip), so such a name drops to retroStyle(5): 320px, to
// 1040, a glyph and more short of the count.
const NAME_GLYPHS = 14;
const STATUS_RIGHT_X = GAME_WIDTH / 2 + PANEL_W / 2 - 40;
// room for the widest value ("110/110") plus the label beside it
const STATUS_VALUE_W = 240;
// the HP/MP block's centre under the panel's top, 2px over the title's
const STATUS_Y = 38;
// ATK/DEF, the sums effAtk/effDef apply (level, gear and its REFINE, the
// bestiary and PARTNER bonuses), mirror HP/MP on the title row's left: no
// other screen showed them. A third line in the HP/MP block (88px tall)
// would have run into the pager under it. Labels from the columns' x
// (120), values right-aligned 168px on (a 3-digit value, a glyph's gap):
// x 120..288, well clear of the title (x>=560).
const ATK_DEF_W = 168;
// The cursor item's "NAME: INFO" line, on its own row between the last item
// row and the msg (8 and 7px apart at bodyStyle(22)'s 26px), so a use/equip
// message never covers it. The longest, 40 glyphs, is 560px (x 360..920):
// inside the panel on a keyboard, and on touch (y 466..492) above the d-pad
// (y>=508) and Z (y>=532).
const INFO_Y = PANEL_TOP + PANEL_H - 83;
// The key line under the msg, like every other panel's: without one nothing
// said Z wears a piece. At retroStyle(4) the touch one, 39 glyphs, is 624px
// (x 328..952; on touch y 534..550, clear of the d-pad's up arrow, x<=194,
// and of Z, x>=1089 that high), the keyboard's 38.
const HINT = (): string => keyHint("HJKL: MOVE   Z: USE/EQUIP   ESC: CLOSE", "D-PAD: MOVE   Z: USE/EQUIP   ESC: CLOSE");
// The chart of the cursor's map (ui/TreasureDig.ts), in the right half of
// the maps page: x 680..1180 under the column header (to y 94) and 16px over
// the info line, less its 6px frame. At 16px a cell the town's 28 x 20 is
// 448 x 320, the biggest region, centred in 488 x 333.
const MAP_AREA = {
  x: NAME_X + COL_W + 6,
  y: PANEL_TOP + 110 + 6,
  w: STATUS_RIGHT_X - NAME_X - COL_W - 12,
  h: INFO_Y - 16 - PANEL_TOP - 110 - 12,
};

export class InventoryUI {
  private scene: Phaser.Scene;
  private active = false;
  private index = 0;
  private page = 0;

  private dim: Phaser.GameObjects.Rectangle;
  private panel: Phaser.GameObjects.Rectangle;
  private title: PixelText;
  private items: PixelText[] = [];
  private icons: Phaser.GameObjects.Image[] = [];
  private counts: PixelText[] = [];
  private headers: PixelText[] = [];
  private cursor: PixelText;
  private statusLabels: PixelText;
  private statusValues: PixelText;
  private atkDefLabels: PixelText;
  private atkDefValues: PixelText;
  private msg: PixelText;
  private info: PixelText;
  private hint: PixelText;
  private pager: PixelText;
  private mapView: Phaser.GameObjects.Graphics;
  private mapTitle: PixelText;
  private msgTimer?: Phaser.Time.TimerEvent;

  private keyUp: Phaser.Input.Keyboard.Key;
  private keyDown: Phaser.Input.Keyboard.Key;
  private keyLeft: Phaser.Input.Keyboard.Key;
  private keyRight: Phaser.Input.Keyboard.Key;
  private keyH: Phaser.Input.Keyboard.Key;
  private keyK: Phaser.Input.Keyboard.Key;
  private keyJ: Phaser.Input.Keyboard.Key;
  private keyL: Phaser.Input.Keyboard.Key;
  private keyZ: Phaser.Input.Keyboard.Key;
  private keyEsc: Phaser.Input.Keyboard.Key;

  private upQueued = false;
  private downQueued = false;
  private leftQueued = false;
  private rightQueued = false;
  private zQueued = false;
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
      .pixelText(GAME_WIDTH / 2, PANEL_TOP + 40, "ITEMS", retroStyle(8, "#ffd166"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);

    COLUMNS.forEach(({ header }, col) => {
      this.headers.push(
        scene.add
          .pixelText(NAME_X + (col % 2) * COL_W, PANEL_TOP + 84, header, retroStyle(5, "#8ecbff"))
          .setOrigin(0, 0.5)
          .setScrollFactor(0)
          .setDepth(152)
          .setVisible(false),
      );
    });

    const startY = PANEL_TOP + 130;
    INVENTORY_ITEMS.forEach((item, i) => {
      const { col, row } = SLOTS[i];
      const x = NAME_X + (col % 2) * COL_W;
      const y = startY + row * INVENTORY_ROW_GAP;
      this.icons.push(
        scene.add
          .image(x + 16, y, `icon-${item.key}`)
          .setScale(0.5)
          .setScrollFactor(0)
          .setDepth(152)
          .setVisible(false),
      );
      this.items.push(
        scene.add
          .pixelText(x + ICON_DX, y, item.label, retroStyle(6, "#ffffff"))
          .setOrigin(0, 0.5)
          .setScrollFactor(0)
          .setDepth(152)
          .setVisible(false),
      );
      this.counts.push(
        scene.add
          .pixelText(x + (item.kind === "map" ? MAP_TAG_DX : COUNT_DX), y, "x0", retroStyle(6, "#ffffff"))
          .setOrigin(0, 0.5)
          .setScrollFactor(0)
          .setDepth(152)
          .setVisible(false),
      );
    });
    this.cursor = scene.add
      .pixelText(0, 0, ">", retroStyle(6, "#ffd166"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);

    // HP/MP is justified: the labels share a left edge, the values a right
    // one. A single right-aligned "HP n/n\nMP n/n" text left the shorter MP
    // label hanging inward. 8px of leading, as Press Start 2P has none (the
    // two lines sat 3px apart): 56px, y 10..66 under the panel's top, 10px
    // inside its edge and 8px over the pager on the header row (from 74)
    this.statusLabels = scene.add
      .pixelText(STATUS_RIGHT_X - STATUS_VALUE_W, PANEL_TOP + STATUS_Y, "HP\nMP", retroStyle(6, "#8ecbff"))
      .setOrigin(0, 0.5)
      .setLineSpacing(8)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    this.statusValues = scene.add
      .pixelText(STATUS_RIGHT_X, PANEL_TOP + STATUS_Y, "", retroStyle(6, "#8ecbff"))
      .setOrigin(1, 0.5)
      .setAlign("right")
      .setLineSpacing(8)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    this.atkDefLabels = scene.add
      .pixelText(NAME_X, PANEL_TOP + STATUS_Y, "ATK\nDEF", retroStyle(6, "#8ecbff"))
      .setOrigin(0, 0.5)
      .setLineSpacing(8)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    this.atkDefValues = scene.add
      .pixelText(NAME_X + ATK_DEF_W, PANEL_TOP + STATUS_Y, "", retroStyle(6, "#8ecbff"))
      .setOrigin(1, 0.5)
      .setAlign("right")
      .setLineSpacing(8)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    this.msg = scene.add
      .pixelText(GAME_WIDTH / 2, PANEL_TOP + PANEL_H - 50, "", bodyStyle(22, "#f5f5f5"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    this.hint = bindKeyHint(scene.add.pixelText(GAME_WIDTH / 2, PANEL_TOP + PANEL_H - 20, "", retroStyle(4, DIM_TEXT)), HINT)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    this.info = scene.add
      .pixelText(GAME_WIDTH / 2, INFO_Y, "", bodyStyle(22, "#9f9fd0"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    this.pager = scene.add
      .pixelText(STATUS_RIGHT_X, PANEL_TOP + 84, "", retroStyle(5, "#9f9fd0"))
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    this.mapView = scene.add.graphics().setScrollFactor(0).setDepth(152).setVisible(false);
    // the map's region over its chart, on the header row: "TOWN FIELDS" is
    // 220px from x=680, 40px clear of the pager
    this.mapTitle = scene.add
      .pixelText(NAME_X + COL_W, PANEL_TOP + 84, "", retroStyle(5, "#fdba74"))
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setVisible(false);
    // tapping the pager's left or right half turns the page, as in BestiaryUI
    this.pager.setInteractive({ useHandCursor: true }).on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.active) this.toColumn(SLOTS[this.index].col + (p.x < this.pager.x - this.pager.width / 2 ? -2 : 2));
    });

    const kb = scene.input.keyboard!;
    this.keyUp = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyDown = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.keyLeft = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keyRight = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keyH = kb.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    this.keyK = kb.addKey(Phaser.Input.Keyboard.KeyCodes.K);
    this.keyJ = kb.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.keyL = kb.addKey(Phaser.Input.Keyboard.KeyCodes.L);
    this.keyZ = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
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
    this.keyEsc.on(DOWN, () => {
      this.escQueued = true;
    });
  }

  open(): void {
    this.active = true;
    this.index = 0;
    this.page = 0;
    this.upQueued = false;
    this.downQueued = false;
    this.leftQueued = false;
    this.rightQueued = false;
    this.zQueued = false;
    this.escQueued = false;
    this.dim.setVisible(true);
    this.panel.setVisible(true);
    this.title.setVisible(true);
    this.statusLabels.setVisible(true);
    this.statusValues.setVisible(true);
    this.atkDefLabels.setVisible(true);
    this.atkDefValues.setVisible(true);
    this.msg.setVisible(true);
    this.info.setVisible(true);
    this.hint.setVisible(true);
    this.pager.setVisible(true);
    this.cursor.setVisible(true);
    this.showPage();
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
    const prev = this.index;
    if (this.upQueued) {
      this.upQueued = false;
      this.index = (this.index + INVENTORY_ITEMS.length - 1) % INVENTORY_ITEMS.length;
    }
    if (this.downQueued) {
      this.downQueued = false;
      this.index = (this.index + 1) % INVENTORY_ITEMS.length;
    }
    const dir = (this.rightQueued ? 1 : 0) - (this.leftQueued ? 1 : 0);
    this.leftQueued = false;
    this.rightQueued = false;
    if (dir !== 0) {
      this.toColumn(SLOTS[this.index].col + dir);
      return;
    }
    if (this.index !== prev) {
      Sfx.move();
      this.renderCursor();
    }
    if (this.zQueued) {
      this.zQueued = false;
      this.useItem();
    }
  }

  private useItem(): void {
    const item = INVENTORY_ITEMS[this.index];
    if (item.kind === "map") {
      Sfx.error();
      this.showMsg(GameState.treasureMaps[item.slot] ? "Find the X and press Z!" : "No map here!");
      return;
    }
    if (GameState.inventory[item.key] <= 0) {
      Sfx.error();
      this.showMsg("Not owned!");
      return;
    }
    if (item.kind === "material") {
      Sfx.error();
      this.showMsg("Take it to the BLACKSMITH!");
      return;
    }
    if (item.kind === "equip") {
      const result = GameState.equipToggle(item.key);
      Sfx.buy();
      GameState.save();
      this.showMsg(result);
      this.refresh();
      return;
    }
    switch (item.key) {
      case "candy":
        Sfx.error();
        this.showMsg("Candy is for battle!");
        return;
      case "bomb":
        Sfx.error();
        this.showMsg("Bomb is for battle!");
        return;
      case "potion":
      case "hiPotion":
        if (GameState.player.hp >= GameState.effMaxHp()) {
          Sfx.error();
          this.showMsg("HP is already full!");
          return;
        }
        break;
      case "mPotion":
      case "ether":
        if (GameState.player.mp >= GameState.player.maxMp) {
          Sfx.error();
          this.showMsg("MP is already full!");
          return;
        }
        break;
      case "elixir":
        if (GameState.player.hp >= GameState.effMaxHp() && GameState.player.mp >= GameState.player.maxMp) {
          Sfx.error();
          this.showMsg("HP and MP are already full!");
          return;
        }
        break;
    }
    GameState.inventory[item.key] -= 1;
    const result = item.use();
    Sfx.buy();
    GameState.save();
    this.showMsg(result);
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
    const p = GameState.player;
    this.statusValues.setText(`${p.hp}/${GameState.effMaxHp()}\n${p.mp}/${p.maxMp}`);
    this.atkDefValues.setText(`${GameState.effAtk()}\n${GameState.effDef()}`);
    for (let i = 0; i < INVENTORY_ITEMS.length; i++) {
      const item = INVENTORY_ITEMS[i];
      if (item.kind === "map") {
        const map = GameState.treasureMaps[item.slot];
        this.items[i].setColor(map ? "#ffffff" : DIM_TEXT);
        this.icons[i].setAlpha(map ? 1 : ICON_NONE_ALPHA);
        this.counts[i].setText(map ? MAP_TAG[map.region] : "-").setColor(map ? "#ffffff" : DIM_TEXT);
        continue;
      }
      const count = GameState.inventory[item.key];
      const equipped = item.kind === "equip" && GameState.isEquipped(item.key);
      if (item.kind === "equip") {
        const name = refinedName(item.label, item.key);
        this.items[i].setText(name).setFontSize(`${(name.length > NAME_GLYPHS ? 5 : 6) * PIXEL}px`);
      }
      const color = equipped ? "#ffd166" : count > 0 ? "#ffffff" : DIM_TEXT;
      this.items[i].setColor(color);
      this.icons[i].setAlpha(count > 0 ? 1 : ICON_NONE_ALPHA);
      this.counts[i].setText(`x${count}` + (equipped ? " E" : "")).setColor(color);
    }
    this.renderCursor();
  }

  // same row in the target column (wrapping round the strip), or its last
  // row if that column is shorter; the cursor's page comes along with it
  private toColumn(col: number): void {
    const to = (col + COLUMNS.length) % COLUMNS.length;
    this.index = firstOf(to) + Math.min(SLOTS[this.index].row, COLUMNS[to].items.length - 1);
    Sfx.move();
    this.renderCursor();
  }

  private showPage(): void {
    this.items.forEach((t, i) => {
      const shown = pageOf(i) === this.page;
      t.setVisible(shown);
      this.icons[i].setVisible(shown);
      this.counts[i].setVisible(shown);
    });
    this.headers.forEach((t, col) => {
      t.setVisible(Math.floor(col / 2) === this.page);
    });
    this.pager.setText(`< PAGE ${this.page + 1}/${PAGES} >`);
  }

  // every cursor move and refresh lands here, so the info line always names
  // what the cursor is on and its page is the one shown
  private renderCursor(): void {
    if (pageOf(this.index) !== this.page) {
      this.page = pageOf(this.index);
      this.showPage();
    }
    const target = this.items[this.index];
    this.cursor.setPosition(target.x - ICON_DX - 26, target.y);
    const item = INVENTORY_ITEMS[this.index];
    if (item.kind !== "map") {
      this.info.setText(`${item.label}: ${itemInfo(item.key)}`);
      this.mapView.setVisible(false);
      this.mapTitle.setVisible(false);
      return;
    }
    // "MAP 1: DIG AT THE X - TOWN FIELDS" (33 glyphs), "MAP 1: FOUND ON
    // MONSTERS NOW AND THEN" (37): both inside the info line's 40
    const map = GameState.treasureMaps[item.slot];
    this.info.setText(map ? `${item.label}: DIG AT THE X - ${REGIONS[map.region].name}` : `${item.label}: FOUND ON MONSTERS NOW AND THEN`);
    if (map) drawTreasureMap(this.mapView, map, MAP_AREA);
    this.mapView.setVisible(!!map);
    this.mapTitle.setText(map ? REGIONS[map.region].name : "").setVisible(!!map);
  }

  close(): void {
    this.active = false;
    this.dim.setVisible(false);
    this.panel.setVisible(false);
    this.title.setVisible(false);
    this.statusLabels.setVisible(false);
    this.statusValues.setVisible(false);
    this.atkDefLabels.setVisible(false);
    this.atkDefValues.setVisible(false);
    this.msg.setVisible(false);
    this.msg.setText("");
    this.info.setVisible(false);
    this.hint.setVisible(false);
    this.pager.setVisible(false);
    this.mapView.setVisible(false);
    this.mapTitle.setVisible(false);
    this.msgTimer?.remove();
    for (const t of this.items) t.setVisible(false);
    for (const t of this.counts) t.setVisible(false);
    for (const t of this.icons) t.setVisible(false);
    for (const t of this.headers) t.setVisible(false);
    this.cursor.setVisible(false);
  }

  destroy(): void {
    this.dim.destroy();
    this.panel.destroy();
    this.title.destroy();
    this.statusLabels.destroy();
    this.statusValues.destroy();
    this.atkDefLabels.destroy();
    this.atkDefValues.destroy();
    this.msg.destroy();
    this.info.destroy();
    this.hint.destroy();
    this.pager.destroy();
    this.mapView.destroy();
    this.mapTitle.destroy();
    this.msgTimer?.remove();
    for (const t of this.items) t.destroy();
    for (const t of this.counts) t.destroy();
    for (const t of this.icons) t.destroy();
    for (const t of this.headers) t.destroy();
    this.cursor.destroy();
    // keys are shared instances from kb.addKey (same keycode → same object);
    // destroying them would wipe other panels' listeners. Scene shutdown
    // already tears every Key down via KeyboardPlugin.removeAllKeys(true).
  }
}
