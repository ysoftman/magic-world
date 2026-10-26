import Phaser from "phaser";
import { retroStyle } from "../pixelart";

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
  ["?", "Slash"],
];
// x: 1222..1270, clear of Z (x <= 1180). y: seven buttons (the Town's full
// set) from 126, under the HUD (88), the y=100 toasts and the map-edited note
// (to 114), down to 474, above the dialogue box (480) and Z (532) — which is
// why they're r=24 at a 50px pitch, 2px apart, rather than bigger
const MENU_X = 1246;
const MENU_TOP = 150;
const MENU_GAP = 50;
const MENU_R = 24;

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
  text: Phaser.GameObjects.Text;
  groups: TouchGroup[];
  release: () => void;
}

function sendKey(type: "keydown" | "keyup", code: string): void {
  const ev = new KeyboardEvent(type, { code, bubbles: true });
  const keyCode = KEY_CODES[code];
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
    // d-pad held with one finger while tapping Z with another
    scene.input.addPointer(2);
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

  private dpad(scene: Phaser.Scene): void {
    const cx = 150;
    const cy = 616;
    const gap = 64;
    this.button(scene, cx, cy - gap, 44, "^", "ArrowUp", undefined, ["dpad", "updown"]);
    this.button(scene, cx - gap, cy, 44, "<", "ArrowLeft", undefined, ["dpad"]);
    this.button(scene, cx + gap, cy, 44, ">", "ArrowRight", undefined, ["dpad"]);
    this.button(scene, cx, cy + gap, 44, "v", "ArrowDown", undefined, ["dpad", "updown"]);
  }

  // Only keys the scene actually registered get a button — every scene builds
  // its keys and help popup before its TouchControls — so U shows up in the
  // Town alone, and a panel a scene adds later appears without touching this.
  private menu(scene: Phaser.Scene): void {
    const keys = scene.input.keyboard?.keys ?? [];
    MENU.filter(([, code]) => keys[KEY_CODES[code]]).forEach(([label, code], i) => {
      this.button(scene, MENU_X, MENU_TOP + i * MENU_GAP, MENU_R, label, code, 6);
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
  ): void {
    const ring = scene.add.circle(x, y, r, 0x000000, 0.25).setStrokeStyle(2, 0xffffff, 0.45).setScrollFactor(0).setDepth(250);
    const text = scene.add.text(x, y, label, retroStyle(size, "#ffffff")).setOrigin(0.5).setScrollFactor(0).setDepth(251);
    ring.setInteractive(new Phaser.Geom.Circle(r, r, r), Phaser.Geom.Circle.Contains);
    let held = false;
    ring.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      held = true;
      ring.setFillStyle(0x000000, 0.05);
      sendKey("keydown", code);
    });
    // only a press gets a keyup, so hide() can call this on every button
    const release = (): void => {
      if (!held) return;
      held = false;
      ring.setFillStyle(0x000000, 0.25);
      sendKey("keyup", code);
    };
    ring.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, release);
    ring.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, release);
    this.buttons.push({ ring, text, groups, release });
  }
}
