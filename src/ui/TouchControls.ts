import Phaser from "phaser";
import { retroStyle } from "../pixelart";
import type { PixelText } from "../pixelText";

// Virtual gamepad for coarse-pointer (touch) devices. Buttons replay real key
// events into the window so every scene keeps its existing keyboard handling:
// Phaser's keyboard plugin updates Key.isDown from these events exactly as it
// does for physical presses. The KeyboardEvent constructor leaves keyCode
// unset and Phaser matches registered keys by it, so it (and the legacy
// `which`) are redefined on the event before dispatch.
const KEY_CODES: Record<string, number> = {
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
  KeyZ: 90,
  Escape: 27,
  KeyI: 73,
  KeyU: 85,
  KeyB: 66,
  KeyA: 65,
  KeyO: 79,
  KeyT: 84,
  KeyW: 87,
  Slash: 191,
};

// Panel hotkeys for the right-edge column, labeled with the same key letters
// the "?" help popup lists, so that popup doubles as the legend. T toggles the
// minimap, which Minimap.ts lifts above the d-pad on touch.
const MENU: Array<[label: string, code: string]> = [
  ["I", "KeyI"],
  ["U", "KeyU"],
  ["B", "KeyB"],
  ["A", "KeyA"],
  ["T", "KeyT"],
  ["O", "KeyO"],
  ["W", "KeyW"],
  ["?", "Slash"],
];
// x: 1222..1270, clear of Z (x <= 1180). y: the column ends at 474, above
// the dialogue box (480), and starts under the HUD (88) and the y=100 toasts.
// Seven buttons (the Town's full set, I U B A T O ?) are r=24 at a 50px pitch,
// 2px apart, from 150. The fields have W as well, eight (the most of any
// scene): r=21 at 46px, 4px apart, centres 131..453, discs y 110..474. The
// map-edited note (y 160..180) ends at x=1210, left of the column, so the two
// never meet.
const MENU_X = 1246;
const MENU_BOTTOM = 474;
const MENU_FULL = 7;
const MENU_PITCH = 50;
const MENU_R = 24;
const MENU_TIGHT_PITCH = 46;
const MENU_TIGHT_R = 21;
// The discs' black fill. At 0.25 a map tag under the d-pad (BLACKSMITH, at
// the new game's spawn) showed through near full strength and its letters
// ran into the arrows; at 0.5 it reads as dimmed ground behind them, and the
// map still shows. Pressed, it lightens as before.
const DISC_ALPHA = 0.5;
const DISC_PRESSED_ALPHA = 0.2;

export function isTouchDevice(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

// "dpad" is the whole pad, "updown" just its ^ and v: a dialogue question
// hides only those, so < and > can move between its choices
export type TouchGroup = "dpad" | "updown" | "z";
const HIDE_EVENT = "touch-hide";

// Panels that fill a bottom corner and take no arrow (or Z) input — the
// dialogue text, the quest journal's lower rows — hide those buttons while
// they're up, and pass [] on close. A scene event rather than a reference to
// the TouchControls, so neither needs the other and the scenes stay
// untouched; on a keyboard device nothing listens. Panels only open after
// create(), and every scene builds its TouchControls inside create().
export function hideTouchButtons(scene: Phaser.Scene, groups: TouchGroup[]): void {
  scene.events.emit(HIDE_EVENT, groups);
}

interface TouchButton {
  ring: Phaser.GameObjects.Arc;
  text: PixelText;
  groups: TouchGroup[];
  release: () => void;
}

// Replays one key into the window; the gamepad (Gamepad.ts) sends its
// buttons through here too, so a letter outside KEY_CODES (a battle's E/F/H)
// gets its keyCode from the letter. `key` is set along with `code`: the
// title screen and the look picker read e.key, which a bare code leaves "".
export function sendKey(type: "keydown" | "keyup", code: string): void {
  const letter = code.startsWith("Key") ? code[3] : null;
  const key = letter ? letter.toLowerCase() : code === "Slash" ? "/" : code;
  const ev = new KeyboardEvent(type, { code, key, bubbles: true });
  const keyCode = KEY_CODES[code] ?? (letter ? letter.charCodeAt(0) : undefined);
  Object.defineProperty(ev, "keyCode", { get: () => keyCode });
  Object.defineProperty(ev, "which", { get: () => keyCode });
  window.dispatchEvent(ev);
}

// D-pad bottom-left replays the arrow keys every roam scene polls for
// movement; Z/ESC bottom-right cover confirm/talk and back/skip; the column
// on the right edge opens the panels (items, quests, bestiary, ...). Battle
// menus and the title screen are already directly tappable.
export class TouchControls {
  private scene: Phaser.Scene;
  private buttons: TouchButton[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // the d-pad held with one finger while Z is tapped with another needs
    // more than one touch pointer: main.ts sets input.activePointers
    this.dpad(scene);
    this.button(scene, 1128, 584, 52, "Z", "KeyZ", undefined, ["z"]);
    this.button(scene, 1000, 668, 40, "ESC", "Escape");
    this.menu(scene);
    scene.events.on(HIDE_EVENT, this.hide, this);
  }

  destroy(): void {
    this.scene.events.off(HIDE_EVENT, this.hide, this);
    for (const b of this.buttons) {
      b.ring.destroy();
      b.text.destroy();
    }
    this.buttons = [];
  }

  private hide(groups: TouchGroup[]): void {
    for (const b of this.buttons) {
      const hidden = b.groups.some((g) => groups.includes(g));
      // a finger still on an arrow would never send its keyup once the
      // button is gone, and the player would walk off when the panel closes
      if (hidden) b.release();
      b.ring.setVisible(!hidden);
      b.text.setVisible(!hidden);
      if (b.ring.input) b.ring.input.enabled = !hidden;
    }
  }

  // One glyph turned four ways: Press Start 2P's ^ is a small caret and its
  // v a letter, not the chevron of > and <, so the pad read as two kinds of
  // key. Quarter turns keep the pixel font's cells square. The > sits off its
  // cell's middle (one empty column before it, two after, one row under it:
  // x 6..35, y 0..41 of 48), so each turns about its own centre, 7/16 of the
  // cell, and all four land in the middle of their discs.
  private dpad(scene: Phaser.Scene): void {
    const cx = 150;
    const cy = 616;
    const gap = 64;
    const arrow = (x: number, y: number, code: string, angle: number, groups: TouchGroup[]): void => {
      this.button(scene, x, y, 44, ">", code, undefined, groups)
        .text.setOrigin(7 / 16)
        .setAngle(angle);
    };
    arrow(cx, cy - gap, "ArrowUp", -90, ["dpad", "updown"]);
    arrow(cx - gap, cy, "ArrowLeft", 180, ["dpad"]);
    arrow(cx + gap, cy, "ArrowRight", 0, ["dpad"]);
    arrow(cx, cy + gap, "ArrowDown", 90, ["dpad", "updown"]);
  }

  // Only keys the scene actually registered get a button — every scene builds
  // its keys and help popup before its TouchControls — so U shows up in the
  // Town alone, and a panel a scene adds later appears without touching this.
  private menu(scene: Phaser.Scene): void {
    const keys = scene.input.keyboard?.keys ?? [];
    const shown = MENU.filter(([, code]) => keys[KEY_CODES[code]]);
    // past seven, the discs shrink and close up so the column still ends at 474
    const tight = shown.length > MENU_FULL;
    const pitch = tight ? MENU_TIGHT_PITCH : MENU_PITCH;
    const r = tight ? MENU_TIGHT_R : MENU_R;
    const top = MENU_BOTTOM - r - (Math.max(shown.length, MENU_FULL) - 1) * pitch;
    shown.forEach(([label, code], i) => {
      this.button(scene, MENU_X, top + i * pitch, r, label, code, 6);
    });
  }

  private button(
    scene: Phaser.Scene,
    x: number,
    y: number,
    r: number,
    label: string,
    code: string,
    size = label.length > 1 ? 6 : 12,
    groups: TouchGroup[] = [],
  ): TouchButton {
    const ring = scene.add.circle(x, y, r, 0x000000, DISC_ALPHA).setStrokeStyle(2, 0xffffff, 0.45).setScrollFactor(0).setDepth(250);
    const text = scene.add.pixelText(x, y, label, retroStyle(size, "#ffffff")).setOrigin(0.5).setScrollFactor(0).setDepth(251);
    ring.setInteractive(new Phaser.Geom.Circle(r, r, r), Phaser.Geom.Circle.Contains);
    let held = false;
    ring.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      held = true;
      ring.setFillStyle(0x000000, DISC_PRESSED_ALPHA);
      sendKey("keydown", code);
    });
    // only a press gets a keyup, so hide() can call this on every button
    const release = (): void => {
      if (!held) return;
      held = false;
      ring.setFillStyle(0x000000, DISC_ALPHA);
      sendKey("keyup", code);
    };
    ring.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, release);
    ring.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, release);
    const button = { ring, text, groups, release };
    this.buttons.push(button);
    return button;
  }
}
