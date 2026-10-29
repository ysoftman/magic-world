import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { bodyStyle, retroStyle } from "../pixelart";
import { bindKeyHint, keyHint, padButtons, usingPad } from "./Gamepad";
import { isTouchDevice } from "./TouchControls";

const PANEL_W = 900;
// Sized for the Town's keyboard list, 8 rows at a 36px pitch from y 84 of the
// panel (bodyStyle(33)'s 39px lines 3px into each other, which only the empty
// tops of the glyph cells share: caps from y 92, 32px under the title's, the
// last row's descenders ending at 373): the goal line (PANEL_H - 70, glyphs
// 390..406) sits 17px under them and the hint (PANEL_H - 30, 432..446) 26px
// under it. At 440 the 8th row ran into the goal line.
const PANEL_H = 470;
const PANEL_TOP = GAME_HEIGHT / 2 - PANEL_H / 2;
const KEY_W = 7;
const COL_W = 18;

// On touch the list names the on-screen buttons instead of keys: the d-pad
// for HJKL, O for SETTINGS and its QUIT chip (SettingsUI, standing in for Q),
// a tap on the HOME bubble for C (the bubble's own "HOME  TAP: NEW LOOK"),
// and nothing for the keys no button sends. The longest touch cell, "O" +
// "SETUP/QUIT", is 17 glyphs, inside COL_W.
// The columns are padEnd()ed, so the body needs a monospace font. Widest rows
// (bodyStyle(33), 21px a glyph; the panel's sides less 20px leave 860px): the
// Town's keyboard list, 16 keys in 8 rows, is 18 + "F2     MAP EDIT" = 33
// glyphs (693px); its touch list, 11 in 6 rows, 18 + "O      SETUP/QUIT" =
// 35 (735px). With a pad the keys are its buttons (Gamepad.ts), and those no
// button sends (C, F2, CTRL+S) drop out: the Town's 13 in 7 rows, at most
// 18 + "START  SETTINGS" = 33.
const TOUCH_KEYS: Record<string, [string, string] | null> = {
  HJKL: ["D-PAD", "MOVE"],
  C: ["HOME", "TAP: LOOK"],
  O: ["O", "SETUP/QUIT"],
  Q: null,
  S: null,
  M: null,
  F2: null,
  "CTRL+S": null,
};

// the popup each scene added, so the scene's uiBlocking() can ask about it
const popups = new WeakMap<Phaser.Scene, Phaser.GameObjects.Container>();

export function helpOpen(scene: Phaser.Scene): boolean {
  return popups.get(scene)?.visible === true;
}

export function closeHelp(scene: Phaser.Scene): void {
  popups.get(scene)?.setVisible(false);
}

// "?" toggles a key-list panel. Modal: the scene lists it in uiBlocking()
// (helpOpen), so nothing walks, talks or opens under it, and `blocked` (the
// scene's other panels and prompts) keeps it from opening over one of them —
// it sits below the panels' depth and would only show through them. `goal`,
// the green line under the keys, can be a function: read each time the popup
// opens, so a line that follows the quest (the Town's) stays current.
export function addHelpPopup(
  scene: Phaser.Scene,
  keys: [string, string][],
  goal: string | (() => string) = "",
  blocked: () => boolean = () => false,
): Phaser.GameObjects.Container {
  // rebuilt when the input in use changes (bindKeyHint)
  const body = (): string => {
    const shown = usingPad()
      ? keys.flatMap(([k, d]): [string, string][] => {
          const button = padButtons(k);
          return button ? [[button, d]] : [];
        })
      : isTouchDevice()
        ? keys.flatMap(([k, d]): [string, string][] => {
            const t: [string, string] | null = k in TOUCH_KEYS ? TOUCH_KEYS[k] : [k, d];
            return t ? [t] : [];
          })
        : keys;
    const half = Math.ceil(shown.length / 2);
    const cell = ([k, d]: [string, string]) => k.padEnd(KEY_W) + d;
    return shown
      .slice(0, half)
      .map((e, i) => cell(e).padEnd(COL_W) + (shown[half + i] ? cell(shown[half + i]) : ""))
      .join("\n");
  };

  const goalText = scene.add.text(GAME_WIDTH / 2, PANEL_TOP + PANEL_H - 70, "", retroStyle(5, "#7fbf7f")).setOrigin(0.5);
  const popup = scene.add
    .container(0, 0, [
      scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, PANEL_W, PANEL_H, 0x0b0b2b, 0.95).setStrokeStyle(2, 0xffffff),
      scene.add.text(GAME_WIDTH / 2, PANEL_TOP + 44, "HELP", retroStyle(8, "#ffd166")).setOrigin(0.5),
      bindKeyHint(scene.add.text(GAME_WIDTH / 2, PANEL_TOP + 84, "", bodyStyle(33, "#f5f5f5")), body)
        .setOrigin(0.5, 0)
        .setLineSpacing(-3),
      goalText,
      bindKeyHint(scene.add.text(GAME_WIDTH / 2, PANEL_TOP + PANEL_H - 30, "", retroStyle(4, "#8ecbff")), () =>
        keyHint("?/ESC: CLOSE"),
      ).setOrigin(0.5),
    ])
    .setScrollFactor(0)
    .setDepth(140)
    .setVisible(false);
  popups.set(scene, popup);

  scene.input
    .keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.FORWARD_SLASH)
    .on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (e.repeat) return;
      if (popup.visible) popup.setVisible(false);
      else if (!blocked()) {
        goalText.setText(typeof goal === "function" ? goal() : goal);
        popup.setVisible(true);
      }
    });
  scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on(Phaser.Input.Keyboard.Events.DOWN, () => popup.setVisible(false));
  return popup;
}
