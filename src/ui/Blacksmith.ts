import Phaser from "phaser";
import { Sfx } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import {
  isRefinable,
  MATERIALS,
  MAX_REFINE,
  type MaterialKey,
  RECIPES,
  REFINE_STEP,
  type Recipe,
  type RefineKey,
  refineCost,
} from "../drops";
import { EQUIP_BONUS, EQUIP_SLOT, GameState, refinedName } from "../gameState";
import { itemInfo } from "../itemInfo";
import { ART_PX, bodyStyle, DIM_TEXT, makeTexture, retroStyle } from "../pixelart";
import type { PixelText } from "../pixelText";
import { SHOP_ITEMS } from "../shopItems";
import { bindKeyHint, keyHint, keyNames } from "./Gamepad";
import { PANEL_TOP_OVER_HUD } from "./StatusHud";
import { isTouchDevice } from "./TouchControls";

// Worn-gear art for the two forged pieces that show up as overlays (the
// charms are accessories and never drawn). Same 32-cell framing at ART_PX as
// art/hero.ts's EQUIP_SWORD_32 / EQUIP_SHIELD_32, the grip at the centre cell,
// so they sit in the hand where the shop gear does: the drake blade's red
// edge lit (R), flame marks (o) up it and a gold tip (y); the GLACIER MAIL,
// worn in the shield's place, as a round ice buckler with a lit rim (h).
const DRAKE_BLADE_PALETTE = { r: 0xdc2626, o: 0xf97316, y: 0xfde047, g: 0xfbbf24, b: 0x7c2d12, R: 0xf87171 };
const DRAKE_BLADE_32 = [
  "................................",
  "................................",
  "................................",
  "............................y...",
  "...........................Ry...",
  "..........................Rrr...",
  ".........................Rrr....",
  "........................Ror.....",
  ".......................Rrr......",
  "......................Rrr.......",
  ".....................Ror........",
  "....................Rrr.........",
  "...................Rrr..........",
  "...............g..Ror...........",
  "................gRrr............",
  ".................g..............",
  "...............bb.g.............",
  "..............bb...g............",
  ".............bb.................",
  "............gg..................",
  "............gg..................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
];
const GLACIER_MAIL_PALETTE = { i: 0xbae6fd, I: 0x7dd3fc, d: 0x0369a1, w: 0xffffff, h: 0xe0f2fe };
const GLACIER_MAIL_32 = [
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "..............iiii..............",
  ".............ihhIIi.............",
  "............ihIIwIIi............",
  "............iIIddIIi............",
  "............iIwddIIi............",
  "............iIIIIIdi............",
  ".............iIIIdi.............",
  "..............iiii..............",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
];

// The forged gear's overlays, once per game: BootScene bakes them so the
// title's save cards can draw a hero wearing them before any Town exists,
// and the panel asks again in case it ever runs first. Baking an existing
// key again would draw over it.
export function bakeCraftedGear(scene: Phaser.Scene): void {
  if (!scene.textures.exists("equip-drake-blade")) makeTexture(scene, "equip-drake-blade", DRAKE_BLADE_32, DRAKE_BLADE_PALETTE, ART_PX);
  if (!scene.textures.exists("equip-glacier-mail")) makeTexture(scene, "equip-glacier-mail", GLACIER_MAIL_32, GLACIER_MAIL_PALETTE, ART_PX);
}

// Laid out top to bottom, Press Start 2P at retroStyle(n) = n*4 px a glyph
// (the effect line and the message in bodyStyle(22), 14px a glyph):
// the title (y+40) between the two tabs at the left (FORGE 100px from x=190,
// REFINE 120px from x=310, clear of the title's x 480..800) and the gold
// readout at the right; the rows from y+100 at a 40px pitch, each the
// piece's icon (32px, BootScene "icon-<key>", x 230..262), its name 8px after
// and its status — FORGE's four recipes (12 glyphs at most, "GLACIER MAIL" =
// 288px from x=270, status "NEED MATS" 216px from x=600), REFINE's worn
// weapon and armor (16, "MYTHRIL SHIELD+5" = 384px to x=654, status from
// x=680); then the picked row — its effect line centered at y+262 (the
// longest, "TALISMAN: ACCESSORY, BLOCKS ALL AILMENTS", 40 x 14 = 560px, x
// 360..920; REFINE's, "MYTHRIL SHIELD+4 > +5: DEF 10 > 11", 476px), up to
// three material lines from y+296 at a 28px pitch, each the material's icon
// and its line from x=270 ("SPIDER SILK  999/4", 360px, to 630) beside the
// fee from x=640 (the icons' art keeps to their middle 28px, so the pitch
// holds) — the message at y+392 (the longest, "FORGE GLACIER MAIL FOR 400G?
// Z/ESC", 34 x 14 = 476px, x 402..878; REFINE's "MYTHRIL SHIELD+5 FOR
// 5000G? Z/ESC" is 462px) and the key hint at y+422 ("HL: TAB   JK: MOVE
// Z: REFINE   ESC: CLOSE", 42 x 16 = 672px), in a 960 x 440 panel. Centered
// on a keyboard; on touch it's pinned over the HUD (statusHud.ts), so it all
// ends by y=448, above the d-pad (y>=508) and Z (y>=532).
const PANEL_W = 960;
const PANEL_H = 440;
const PANEL_TOP = isTouchDevice() ? PANEL_TOP_OVER_HUD : GAME_HEIGHT / 2 - PANEL_H / 2;
const NAME_X = GAME_WIDTH / 2 - PANEL_W / 2 + 70;
// a row's icon starts at NAME_X, its text ICON_DX after
const ICON_DX = 40;
const STATUS_X = NAME_X + ICON_DX + 330;
const REFINE_STATUS_X = NAME_X + ICON_DX + 410;
const TAB_X = GAME_WIDTH / 2 - PANEL_W / 2 + 30;
const TAB_GAP = 120;
const FEE_X = GAME_WIDTH / 2;
const ROW_Y = PANEL_TOP + 100;
const ROW_GAP = 40;
const INFO_Y = PANEL_TOP + 262;
const NEED_Y = PANEL_TOP + 296;
const NEED_GAP = 28;
const MAX_NEEDS = Math.max(...RECIPES.map((r) => Object.keys(r.needs).length));

type Mode = "forge" | "refine";
const MODES: Mode[] = ["forge", "refine"];
const TAB_LABEL: Record<Mode, string> = { forge: "FORGE", refine: "REFINE" };

type Status = "owned" | "ready" | "short";

const entriesOf = (needs: Partial<Record<MaterialKey, number>>): Array<[MaterialKey, number]> =>
  Object.entries(needs) as Array<[MaterialKey, number]>;
const needsMet = (needs: Partial<Record<MaterialKey, number>>): boolean => entriesOf(needs).every(([m, n]) => GameState.inventory[m] >= n);

// one of each piece: forging a second copy of gear you already own would just
// burn the materials
function statusOf(r: Recipe): Status {
  if (GameState.inventory[r.key] > 0) return "owned";
  return needsMet(r.needs) ? "ready" : "short";
}

const STATUS_LABEL: Record<Status, [string, string]> = {
  owned: ["OWNED", "#ffd166"],
  ready: ["READY", "#4ade80"],
  short: ["NEED MATS", DIM_TEXT],
};

// REFINE's two rows: what's worn in each slot, or null (nothing worn; an
// accessory never lands here)
const REFINE_SLOTS = ["weapon", "armor"] as const;
const wornIn = (row: number): RefineKey | null => {
  const key = GameState.equipped[REFINE_SLOTS[row]];
  return isRefinable(key) ? key : null;
};
// the gear's names as the shop and the forge list them
const GEAR_NAME: Record<string, string> = Object.fromEntries([
  ...SHOP_ITEMS.flatMap((item) => (item.key ? [[item.key, item.name]] : [])),
  ...RECIPES.map((r) => [r.key, r.name]),
]);

type RefineStatus = "max" | "ready" | "short" | "none";
function refineStatus(key: RefineKey | null): RefineStatus {
  if (!key) return "none";
  const level = GameState.refineOf(key);
  if (level >= MAX_REFINE) return "max";
  return needsMet(refineCost(key, level + 1).needs) ? "ready" : "short";
}

const REFINE_LABEL: Record<RefineStatus, [string, string]> = {
  max: ["MAX", "#ffd166"],
  ready: ["READY", "#4ade80"],
  short: ["NEED MATS", DIM_TEXT],
  none: ["", DIM_TEXT],
};

// the piece's own ATK or DEF at `level`: its EQUIP_BONUS plus the refine
const statOf = (key: RefineKey, level: number): number => EQUIP_BONUS[key] + level * REFINE_STEP;
const statName = (key: RefineKey): string => (EQUIP_SLOT[key] === "weapon" ? "ATK" : "DEF");

export class BlacksmithUI {
  private scene: Phaser.Scene;
  private active = false;
  private mode: Mode = "forge";
  private index = 0;
  // Z on a ready row asks first; a second Z forges or refines, anything else
  // backs out
  private confirming = false;

  private dim: Phaser.GameObjects.Rectangle;
  private panel: Phaser.GameObjects.Rectangle;
  private title: PixelText;
  private tabs: PixelText[] = [];
  private goldText: PixelText;
  private names: PixelText[] = [];
  private icons: Phaser.GameObjects.Image[] = [];
  private statuses: PixelText[] = [];
  private cursor: PixelText;
  private info: PixelText;
  private needs: PixelText[] = [];
  private needIcons: Phaser.GameObjects.Image[] = [];
  private fee: PixelText;
  private msg: PixelText;
  private hint: PixelText;
  private msgTimer?: Phaser.Time.TimerEvent;

  private upQueued = false;
  private downQueued = false;
  private tabQueued = false;
  private zQueued = false;
  private escQueued = false;
  private tapQueued: Mode | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    bakeCraftedGear(scene);

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
    this.title = fixed(scene.add.pixelText(GAME_WIDTH / 2, PANEL_TOP + 40, "BLACKSMITH", retroStyle(8, "#fb923c")).setOrigin(0.5));
    MODES.forEach((mode, i) => {
      const tab = fixed(
        scene.add.pixelText(TAB_X + i * TAB_GAP, PANEL_TOP + 40, TAB_LABEL[mode], retroStyle(5, DIM_TEXT)).setOrigin(0, 0.5),
      );
      // a tap picks the tab, as HL / the d-pad's < and > do
      tab.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
        if (this.active) this.tapQueued = mode;
      });
      this.tabs.push(tab);
    });
    this.goldText = fixed(
      scene.add.pixelText(GAME_WIDTH / 2 + PANEL_W / 2 - 30, PANEL_TOP + 40, "", retroStyle(6, "#8ecbff")).setOrigin(1, 0.5),
    );
    RECIPES.forEach((r, i) => {
      const y = ROW_Y + i * ROW_GAP;
      this.icons.push(fixed(scene.add.image(NAME_X + 16, y, `icon-${r.key}`).setScale(0.5)));
      this.names.push(fixed(scene.add.pixelText(NAME_X + ICON_DX, y, r.name, retroStyle(6, "#ffffff")).setOrigin(0, 0.5)));
      this.statuses.push(fixed(scene.add.pixelText(STATUS_X, y, "", retroStyle(6, DIM_TEXT)).setOrigin(0, 0.5)));
    });
    this.cursor = fixed(scene.add.pixelText(0, 0, ">", retroStyle(6, "#ffd166")).setOrigin(0.5));
    this.info = fixed(scene.add.pixelText(GAME_WIDTH / 2, INFO_Y, "", bodyStyle(22, "#9f9fd0")).setOrigin(0.5));
    for (let i = 0; i < MAX_NEEDS; i++) {
      this.needIcons.push(fixed(scene.add.image(NAME_X + 16, NEED_Y + i * NEED_GAP, "icon-slimeGel").setScale(0.5)));
      this.needs.push(fixed(scene.add.pixelText(NAME_X + ICON_DX, NEED_Y + i * NEED_GAP, "", retroStyle(5, "#ffffff")).setOrigin(0, 0.5)));
    }
    this.fee = fixed(scene.add.pixelText(FEE_X, NEED_Y, "", retroStyle(5, "#ffffff")).setOrigin(0, 0.5));
    this.msg = fixed(scene.add.pixelText(GAME_WIDTH / 2, PANEL_TOP + 392, "", bodyStyle(22, "#f5f5f5")).setOrigin(0.5));
    // the line itself is the mode's (refresh); touch names the d-pad rather
    // than HL/JK (the arrows it sends move here too)
    this.hint = fixed(scene.add.pixelText(GAME_WIDTH / 2, PANEL_TOP + 422, "", retroStyle(4, DIM_TEXT)).setOrigin(0.5));

    const kb = scene.input.keyboard!;
    const DOWN = Phaser.Input.Keyboard.Events.DOWN;
    const on = (code: number, flag: "upQueued" | "downQueued" | "tabQueued" | "zQueued" | "escQueued") => {
      kb.addKey(code).on(DOWN, () => {
        this[flag] = true;
      });
    };
    const K = Phaser.Input.Keyboard.KeyCodes;
    on(K.UP, "upQueued");
    on(K.K, "upQueued");
    on(K.DOWN, "downQueued");
    on(K.J, "downQueued");
    // two tabs, so either way is the other one
    on(K.LEFT, "tabQueued");
    on(K.H, "tabQueued");
    on(K.RIGHT, "tabQueued");
    on(K.L, "tabQueued");
    on(K.Z, "zQueued");
    on(K.ESC, "escQueued");
  }

  open(): void {
    this.active = true;
    this.mode = "forge";
    this.index = 0;
    this.confirming = false;
    this.upQueued = false;
    this.downQueued = false;
    this.tabQueued = false;
    this.tapQueued = null;
    this.zQueued = false;
    this.escQueued = false;
    this.setShown(true);
    this.msg.setText("");
    this.refresh();
  }

  isActive(): boolean {
    return this.active;
  }

  private rows(): number {
    return this.mode === "forge" ? RECIPES.length : REFINE_SLOTS.length;
  }

  update(): void {
    if (!this.active) return;
    if (this.escQueued) {
      this.escQueued = false;
      if (this.confirming) this.cancel();
      else this.close();
      return;
    }
    const tabTo = this.tabQueued ? MODES[(MODES.indexOf(this.mode) + 1) % MODES.length] : this.tapQueued;
    this.tabQueued = false;
    this.tapQueued = null;
    if (tabTo && tabTo !== this.mode) {
      Sfx.move();
      this.mode = tabTo;
      this.index = 0;
      if (this.confirming) this.cancel();
      this.msg.setText("");
      this.refresh();
    }
    const prev = this.index;
    if (this.upQueued) {
      this.upQueued = false;
      this.index = (this.index + this.rows() - 1) % this.rows();
    }
    if (this.downQueued) {
      this.downQueued = false;
      this.index = (this.index + 1) % this.rows();
    }
    if (this.index !== prev) {
      Sfx.move();
      if (this.confirming) this.cancel();
      this.refresh();
    }
    if (this.zQueued) {
      this.zQueued = false;
      if (this.mode === "refine") {
        if (this.confirming) this.refine();
        else this.askRefine();
      } else if (this.confirming) this.forge();
      else this.ask();
    }
  }

  private ask(): void {
    const r = RECIPES[this.index];
    const status = statusOf(r);
    if (status === "owned") {
      this.refuse("Already owned!");
      return;
    }
    if (status === "short") {
      const [m, n] = entriesOf(r.needs).find(([k, need]) => GameState.inventory[k] < need) as [MaterialKey, number];
      this.refuse(`Need ${n - GameState.inventory[m]} more ${MATERIALS[m].name}`);
      return;
    }
    if (GameState.gold < r.fee) {
      this.refuse("Not enough gold!");
      return;
    }
    this.confirming = true;
    Sfx.move();
    this.showMsg(`FORGE ${r.name} FOR ${r.fee}G? ${keyNames("Z/ESC")}`, 0);
  }

  private forge(): void {
    this.confirming = false;
    const r = RECIPES[this.index];
    // re-checked: nothing should change behind an open panel, but the forge
    // must never take materials or gold it can't fully cover
    if (statusOf(r) !== "ready" || GameState.gold < r.fee) {
      this.refuse("Can't forge that now!");
      return;
    }
    GameState.gold -= r.fee;
    for (const [m, n] of entriesOf(r.needs)) GameState.inventory[m] -= n;
    GameState.inventory[r.key] += 1;
    GameState.save();
    Sfx.levelup();
    this.showMsg(`${r.name} forged!`);
    this.refresh();
  }

  private askRefine(): void {
    const key = wornIn(this.index);
    if (!key) {
      this.refuse(this.index === 0 ? "Wear a weapon first!" : "Wear armor first!");
      return;
    }
    const level = GameState.refineOf(key);
    if (level >= MAX_REFINE) {
      this.refuse(`Already +${MAX_REFINE}!`);
      return;
    }
    const { fee, needs } = refineCost(key, level + 1);
    const short = entriesOf(needs).find(([m, n]) => GameState.inventory[m] < n);
    if (short) {
      this.refuse(`Need ${short[1] - GameState.inventory[short[0]]} more ${MATERIALS[short[0]].name}`);
      return;
    }
    if (GameState.gold < fee) {
      this.refuse("Not enough gold!");
      return;
    }
    this.confirming = true;
    Sfx.move();
    this.showMsg(`${GEAR_NAME[key]}+${level + 1} FOR ${fee}G? ${keyNames("Z/ESC")}`, 0);
  }

  // the level goes on the piece (GameState.refine), so it stays with it
  // whatever is worn later
  private refine(): void {
    this.confirming = false;
    const key = wornIn(this.index);
    const level = key ? GameState.refineOf(key) : 0;
    // re-checked, as forge() is
    if (!key || refineStatus(key) !== "ready" || GameState.gold < refineCost(key, level + 1).fee) {
      this.refuse("Can't refine that now!");
      return;
    }
    const { fee, needs } = refineCost(key, level + 1);
    GameState.gold -= fee;
    for (const [m, n] of entriesOf(needs)) GameState.inventory[m] -= n;
    GameState.refine[key] = level + 1;
    GameState.save();
    Sfx.levelup();
    this.showMsg(`${GEAR_NAME[key]}+${level + 1} refined!`);
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

  // 0 keeps the line up (the forge question waits for an answer)
  private showMsg(text: string, hold = 1400): void {
    this.msgTimer?.remove();
    this.msg.setText(text);
    if (hold > 0) this.msgTimer = this.scene.time.addEvent({ delay: hold, callback: () => this.msg.setText("") });
  }

  private refresh(): void {
    this.goldText.setText(`G ${GameState.gold}`);
    this.tabs.forEach((t, i) => {
      t.setColor(MODES[i] === this.mode ? "#ffd166" : DIM_TEXT);
    });
    const action = this.mode === "forge" ? "FORGE" : "REFINE";
    bindKeyHint(this.hint, () => keyHint(`HL: TAB   JK: MOVE   Z: ${action}   ESC: CLOSE`, `D-PAD: MOVE/TAB   Z: ${action}   ESC: CLOSE`));
    this.cursor.setPosition(NAME_X - 26, ROW_Y + this.index * ROW_GAP);
    const lines = this.mode === "forge" ? this.refreshForge() : this.refreshRefine();
    // the rows past the mode's own, and the icon of an empty REFINE slot, off
    this.names.forEach((t, i) => {
      const shown = this.active && i < this.rows();
      t.setVisible(shown);
      this.statuses[i].setVisible(shown);
      this.icons[i].setVisible(shown && (this.mode === "forge" || wornIn(i) !== null));
    });
    const { needs, dim } = lines;
    this.needs.forEach((t, i) => {
      const need = needs[i];
      this.needIcons[i].setVisible(this.active && !!need);
      if (!need) {
        t.setText("");
        return;
      }
      const [m, n] = need;
      const have = GameState.inventory[m];
      this.needIcons[i].setTexture(`icon-${m}`);
      // "SPIDER SILK  999/4": 18 x 20 = 360px (x 230..590), left of the fee
      t.setText(`${MATERIALS[m].name.padEnd(11)}  ${have}/${n}`).setColor(dim ? DIM_TEXT : have >= n ? "#4ade80" : "#ff8a8a");
    });
  }

  private refreshForge(): { needs: Array<[MaterialKey, number]>; dim: boolean } {
    RECIPES.forEach((r, i) => {
      const [label, color] = STATUS_LABEL[statusOf(r)];
      this.icons[i].setTexture(`icon-${r.key}`);
      this.names[i].setText(r.name).setColor(statusOf(r) === "owned" ? "#ffd166" : "#ffffff");
      this.statuses[i].setX(STATUS_X).setText(label).setColor(color);
    });
    const r = RECIPES[this.index];
    // an owned piece's recipe is greyed out rather than shown as short
    const owned = statusOf(r) === "owned";
    this.info.setText(`${r.name}: ${itemInfo(r.key)}`);
    this.fee.setText(`FEE ${r.fee}G`).setColor(owned ? DIM_TEXT : GameState.gold >= r.fee ? "#ffffff" : "#ff8a8a");
    return { needs: entriesOf(r.needs), dim: owned };
  }

  private refreshRefine(): { needs: Array<[MaterialKey, number]>; dim: boolean } {
    REFINE_SLOTS.forEach((slot, i) => {
      const key = wornIn(i);
      const status = refineStatus(key);
      const [label, color] = REFINE_LABEL[status];
      if (key) this.icons[i].setTexture(`icon-${key}`);
      this.names[i]
        .setText(key ? refinedName(GEAR_NAME[key], key) : slot === "weapon" ? "NO WEAPON" : "NO ARMOR")
        .setColor(!key ? DIM_TEXT : status === "max" ? "#ffd166" : "#ffffff");
      this.statuses[i].setX(REFINE_STATUS_X).setText(label).setColor(color);
    });
    const key = wornIn(this.index);
    if (!key) {
      this.info.setText(this.index === 0 ? "WEAR A WEAPON TO REFINE IT" : "WEAR ARMOR TO REFINE IT");
      this.fee.setText("");
      return { needs: [], dim: true };
    }
    const level = GameState.refineOf(key);
    const name = refinedName(GEAR_NAME[key], key);
    if (level >= MAX_REFINE) {
      this.info.setText(`${name}: ${statName(key)} ${statOf(key, level)} (MAX)`);
      this.fee.setText("");
      return { needs: [], dim: true };
    }
    const { fee, needs } = refineCost(key, level + 1);
    this.info.setText(`${name} > +${level + 1}: ${statName(key)} ${statOf(key, level)} > ${statOf(key, level + 1)}`);
    this.fee.setText(`FEE ${fee}G`).setColor(GameState.gold >= fee ? "#ffffff" : "#ff8a8a");
    return { needs: entriesOf(needs), dim: false };
  }

  private setShown(shown: boolean): void {
    for (const o of [this.dim, this.panel, this.title, this.goldText, this.cursor, this.info, this.fee, this.msg, this.hint, ...this.tabs])
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
    for (const o of [this.dim, this.panel, this.title, this.goldText, this.cursor, this.info, this.fee, this.msg, this.hint, ...this.tabs])
      o.destroy();
    for (const t of [...this.names, ...this.icons, ...this.statuses, ...this.needs, ...this.needIcons]) t.destroy();
    // keys are shared kb.addKey instances; scene shutdown tears them down
  }
}
