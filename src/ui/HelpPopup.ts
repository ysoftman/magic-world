import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { retroStyle } from "../pixelart";

const PANEL_W = 900;
const PANEL_H = 440;
const PANEL_TOP = GAME_HEIGHT / 2 - PANEL_H / 2;
const KEY_W = 7;
const COL_W = 18;

// "?" toggles a key-list panel. Non-modal: the scene keeps running under it,
// so it needs no hooks into each scene's isPanelOpen/update loop
export function addHelpPopup(scene: Phaser.Scene, keys: [string, string][], goal = ""): Phaser.GameObjects.Container {
  const half = Math.ceil(keys.length / 2);
  const cell = ([k, d]: [string, string]) => k.padEnd(KEY_W) + d;
  const body = keys
    .slice(0, half)
    .map((e, i) => cell(e).padEnd(COL_W) + (keys[half + i] ? cell(keys[half + i]) : ""))
    .join("\n");

  const popup = scene.add
    .container(0, 0, [
      scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, PANEL_W, PANEL_H, 0x0b0b2b, 0.95).setStrokeStyle(2, 0xffffff),
      scene.add.text(GAME_WIDTH / 2, PANEL_TOP + 44, "HELP", retroStyle(8, "#ffd166")).setOrigin(0.5),
      scene.add
        .text(GAME_WIDTH / 2, PANEL_TOP + 90, body, retroStyle(6, "#f5f5f5"))
        .setOrigin(0.5, 0)
        .setLineSpacing(12),
      scene.add.text(GAME_WIDTH / 2, PANEL_TOP + PANEL_H - 66, goal, retroStyle(5, "#7fbf7f")).setOrigin(0.5),
      scene.add.text(GAME_WIDTH / 2, PANEL_TOP + PANEL_H - 30, "?/ESC: CLOSE", retroStyle(4, "#8ecbff")).setOrigin(0.5),
    ])
    .setScrollFactor(0)
    .setDepth(140)
    .setVisible(false);

  scene.input
    .keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.FORWARD_SLASH)
    .on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (!e.repeat) popup.setVisible(!popup.visible);
    });
  scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on(Phaser.Input.Keyboard.Events.DOWN, () => popup.setVisible(false));
  return popup;
}
