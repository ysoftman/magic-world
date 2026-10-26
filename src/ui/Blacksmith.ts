import Phaser from "phaser";
import { Sfx } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { MATERIALS, type MaterialKey, RECIPES, type Recipe } from "../drops";
import { GameState } from "../gameState";
import { ITEM_INFO } from "../itemInfo";
import { ART_PX, DIM_TEXT, makeTexture, retroStyle } from "../pixelart";
import { isTouchDevice } from "./TouchControls";

// Worn-gear art for the two forged pieces that show up as overlays (the
// charms are accessories and never drawn). Same 32-cell framing at ART_PX as
// BootScene's EQUIP_SWORD_32 / EQUIP_SHIELD_32, the grip at the centre cell,
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

// Laid out top to bottom, Press Start 2P at retroStyle(n) = n*4 px a glyph:
// the title (y+40) with the gold readout at the right; four recipe rows from
// y+100 at a 40px pitch, the piece's icon (32px, BootScene "icon-<key>",
// x 230..262), its name 8px after (12 glyphs at most, "GLACIER MAIL" = 288px
// from x=270) and its status ("NEED MATS" 216px from x=600); then the picked
// recipe — its effect line centered at y+262 (the longest, "TALISMAN:
// ACCESSORY, BLOCKS ALL AILMENTS", 40 x 20 = 800px, x 240..1040), up to three
// material lines from y+296 at a 28px pitch, each the material's icon and its
// line from x=270 ("SPIDER SILK  999/4", 360px, to 630) beside the fee from
// x=640 (the icons' art keeps to their middle 28px, so the pitch holds) —
// the message at y+392 (the longest, "FORGE GLACIER MAIL FOR 400G? Z/ESC",
// 34 x 24 = 816px,
// x 232..1048) and the key hint at y+422, in a 960 x 440 panel. Centered on
// a keyboard; on touch it's pinned to y=28, so it all ends by y=468, above
// the d-pad (y>=508) and Z (y>=532).
const PANEL_W = 960;
const PANEL_H = 440;
const PANEL_TOP = isTouchDevice() ? 28 : GAME_HEIGHT / 2 - PANEL_H / 2;
const NAME_X = GAME_WIDTH / 2 - PANEL_W / 2 + 70;
// a row's icon starts at NAME_X, its text ICON_DX after
const ICON_DX = 40;
const STATUS_X = NAME_X + ICON_DX + 330;
const FEE_X = GAME_WIDTH / 2;
const ROW_Y = PANEL_TOP + 100;
const ROW_GAP = 40;
const INFO_Y = PANEL_TOP + 262;
const NEED_Y = PANEL_TOP + 296;
const NEED_GAP = 28;
const MAX_NEEDS = Math.max(...RECIPES.map((r) => Object.keys(r.needs).length));

type Status = "owned" | "ready" | "short";

const needsOf = (r: Recipe): Array<[MaterialKey, number]> => Object.entries(r.needs) as Array<[MaterialKey, number]>;

// one of each piece: forging a second copy of gear you already own would just
// burn the materials
function statusOf(r: Recipe): Status {
  if (GameState.inventory[r.key] > 0) return "owned";
  return needsOf(r).every(([m, n]) => GameState.inventory[m] >= n) ? "ready" : "short";
}

const STATUS_LABEL: Record<Status, [string, string]> = {
  owned: ["OWNED", "#ffd166"],
  ready: ["READY", "#4ade80"],
  short: ["NEED MATS", DIM_TEXT],
};

export class BlacksmithUI {
  private scene: Phaser.Scene;
  private active = false;
  private index = 0;
  // Z on a ready recipe asks first; a second Z forges, anything else backs out
  private confirming = false;

  private dim: Phaser.GameObjects.Rectangle;
  private panel: Phaser.GameObjects.Rectangle;
  private title: Phaser.GameObjects.Text;
  private goldText: Phaser.GameObjects.Text;
  private names: Phaser.GameObjects.Text[] = [];
  private icons: Phaser.GameObjects.Image[] = [];
  private statuses: Phaser.GameObjects.Text[] = [];
  private cursor: Phaser.GameObjects.Text;
  private info: Phaser.GameObjects.Text;
  private needs: Phaser.GameObjects.Text[] = [];
  private needIcons: Phaser.GameObjects.Image[] = [];
  private fee: Phaser.GameObjects.Text;
  private msg: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;
  private msgTimer?: Phaser.Time.TimerEvent;

  private upQueued = false;
  private downQueued = false;
  private zQueued = false;
  private escQueued = false;

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
    this.title = fixed(scene.add.text(GAME_WIDTH / 2, PANEL_TOP + 40, "BLACKSMITH", retroStyle(8, "#fb923c")).setOrigin(0.5));
    this.goldText = fixed(
      scene.add.text(GAME_WIDTH / 2 + PANEL_W / 2 - 30, PANEL_TOP + 40, "", retroStyle(6, "#8ecbff")).setOrigin(1, 0.5),
    );
    RECIPES.forEach((r, i) => {
      const y = ROW_Y + i * ROW_GAP;
      this.icons.push(fixed(scene.add.image(NAME_X + 16, y, `icon-${r.key}`).setScale(0.5)));
      this.names.push(fixed(scene.add.text(NAME_X + ICON_DX, y, r.name, retroStyle(6, "#ffffff")).setOrigin(0, 0.5)));
      this.statuses.push(fixed(scene.add.text(STATUS_X, y, "", retroStyle(6, DIM_TEXT)).setOrigin(0, 0.5)));
    });
    this.cursor = fixed(scene.add.text(0, 0, ">", retroStyle(6, "#ffd166")).setOrigin(0.5));
    this.info = fixed(scene.add.text(GAME_WIDTH / 2, INFO_Y, "", retroStyle(5, "#9f9fd0")).setOrigin(0.5));
    for (let i = 0; i < MAX_NEEDS; i++) {
      this.needIcons.push(fixed(scene.add.image(NAME_X + 16, NEED_Y + i * NEED_GAP, "icon-slimeGel").setScale(0.5)));
      this.needs.push(fixed(scene.add.text(NAME_X + ICON_DX, NEED_Y + i * NEED_GAP, "", retroStyle(5, "#ffffff")).setOrigin(0, 0.5)));
    }
    this.fee = fixed(scene.add.text(FEE_X, NEED_Y, "", retroStyle(5, "#ffffff")).setOrigin(0, 0.5));
    this.msg = fixed(scene.add.text(GAME_WIDTH / 2, PANEL_TOP + 392, "", retroStyle(6, "#f5f5f5")).setOrigin(0.5));
    // touch names the d-pad rather than J/K (the arrows it sends move here too)
    this.hint = fixed(
      scene.add
        .text(
          GAME_WIDTH / 2,
          PANEL_TOP + 422,
          isTouchDevice() ? "D-PAD: PICK   Z: FORGE   ESC: CLOSE" : "J/K: PICK   Z: FORGE   ESC: CLOSE",
          retroStyle(4, DIM_TEXT),
        )
        .setOrigin(0.5),
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
      this.index = (this.index + RECIPES.length - 1) % RECIPES.length;
    }
    if (this.downQueued) {
      this.downQueued = false;
      this.index = (this.index + 1) % RECIPES.length;
    }
    if (this.index !== prev) {
      Sfx.move();
      if (this.confirming) this.cancel();
      this.refresh();
    }
    if (this.zQueued) {
      this.zQueued = false;
      if (this.confirming) this.forge();
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
      const [m, n] = needsOf(r).find(([k, need]) => GameState.inventory[k] < need) as [MaterialKey, number];
      this.refuse(`Need ${n - GameState.inventory[m]} more ${MATERIALS[m].name}`);
      return;
    }
    if (GameState.gold < r.fee) {
      this.refuse("Not enough gold!");
      return;
    }
    this.confirming = true;
    Sfx.move();
    this.showMsg(`FORGE ${r.name} FOR ${r.fee}G? Z/ESC`, 0);
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
    for (const [m, n] of needsOf(r)) GameState.inventory[m] -= n;
    GameState.inventory[r.key] += 1;
    GameState.save();
    Sfx.levelup();
    this.showMsg(`${r.name} forged!`);
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
    RECIPES.forEach((r, i) => {
      const [label, color] = STATUS_LABEL[statusOf(r)];
      this.statuses[i].setText(label).setColor(color);
      this.names[i].setColor(statusOf(r) === "owned" ? "#ffd166" : "#ffffff");
    });
    const r = RECIPES[this.index];
    // an owned piece's recipe is greyed out rather than shown as short
    const owned = statusOf(r) === "owned";
    this.cursor.setPosition(NAME_X - 26, ROW_Y + this.index * ROW_GAP);
    this.info.setText(`${r.name}: ${ITEM_INFO[r.key]}`);
    const needs = needsOf(r);
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
      t.setText(`${MATERIALS[m].name.padEnd(11)}  ${have}/${n}`).setColor(owned ? DIM_TEXT : have >= n ? "#4ade80" : "#ff8a8a");
    });
    this.fee.setText(`FEE ${r.fee}G`).setColor(owned ? DIM_TEXT : GameState.gold >= r.fee ? "#ffffff" : "#ff8a8a");
  }

  private setShown(shown: boolean): void {
    for (const o of [this.dim, this.panel, this.title, this.goldText, this.cursor, this.info, this.fee, this.msg, this.hint])
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
    for (const o of [this.dim, this.panel, this.title, this.goldText, this.cursor, this.info, this.fee, this.msg, this.hint]) o.destroy();
    for (const t of [...this.names, ...this.icons, ...this.statuses, ...this.needs, ...this.needIcons]) t.destroy();
    // keys are shared kb.addKey instances; scene shutdown tears them down
  }
}
