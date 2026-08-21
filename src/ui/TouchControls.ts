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
};

export function isTouchDevice(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

function sendKey(type: "keydown" | "keyup", code: string): void {
  const ev = new KeyboardEvent(type, { code, bubbles: true });
  const keyCode = KEY_CODES[code];
  Object.defineProperty(ev, "keyCode", { get: () => keyCode });
  Object.defineProperty(ev, "which", { get: () => keyCode });
  window.dispatchEvent(ev);
}

// D-pad bottom-left replays the arrow keys every roam scene polls for
// movement; Z/ESC bottom-right cover confirm/talk and back/skip. Battle menus
// and the title screen are already directly tappable.
export class TouchControls {
  private objects: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene) {
    // d-pad held with one finger while tapping Z with another
    scene.input.addPointer(2);
    this.dpad(scene);
    this.button(scene, 1128, 584, 52, "Z", "KeyZ");
    this.button(scene, 1000, 668, 40, "ESC", "Escape");
  }

  destroy(): void {
    for (const o of this.objects) o.destroy();
    this.objects = [];
  }

  private dpad(scene: Phaser.Scene): void {
    const cx = 150;
    const cy = 616;
    const gap = 64;
    this.button(scene, cx, cy - gap, 44, "^", "ArrowUp");
    this.button(scene, cx - gap, cy, 44, "<", "ArrowLeft");
    this.button(scene, cx + gap, cy, 44, ">", "ArrowRight");
    this.button(scene, cx, cy + gap, 44, "v", "ArrowDown");
  }

  private button(scene: Phaser.Scene, x: number, y: number, r: number, label: string, code: string): void {
    const ring = scene.add.circle(x, y, r, 0x000000, 0.25).setStrokeStyle(2, 0xffffff, 0.45).setScrollFactor(0).setDepth(250);
    const text = scene.add
      .text(x, y, label, retroStyle(label.length > 1 ? 6 : 12, "#ffffff"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(251);
    ring.setInteractive(new Phaser.Geom.Circle(r, r, r), Phaser.Geom.Circle.Contains);
    ring.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      ring.setFillStyle(0x000000, 0.05);
      sendKey("keydown", code);
    });
    const release = (): void => {
      ring.setFillStyle(0x000000, 0.25);
      sendKey("keyup", code);
    };
    ring.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, release);
    ring.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, release);
    this.objects.push(ring, text);
  }
}
