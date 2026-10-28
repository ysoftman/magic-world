import type Phaser from "phaser";
import { sendKey } from "./TouchControls";

// A gamepad as a second keyboard. The browser's Gamepad API is state, not
// events, so a loop outside Phaser (requestAnimationFrame, one read of
// navigator.getGamepads() a frame) watches the buttons and the left stick
// and replays only the transitions — keydown on press, keyup on release —
// through TouchControls' sendKey, the path the touch buttons already take.
// Every scene keeps its keyboard handling, and holding a button is holding
// the key: the field scenes poll Key.isDown for movement, so nothing
// repeats here.

// w3c "standard" mapping indices, the layout Xbox / PlayStation / Switch Pro
// pads report (a pad with another mapping is read the same way, as a guess)
const BTN = {
  a: 0,
  b: 1,
  x: 2,
  y: 3,
  lb: 4,
  rb: 5,
  lt: 6,
  rt: 7,
  select: 8,
  start: 9,
  l3: 10,
  r3: 11,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
} as const;
const AXIS_X = 0;
const AXIS_Y = 1;
const DEADZONE = 0.5;

// What each button types. A/B are confirm/back everywhere; the panel keys
// follow the touch column's letters (TouchControls' MENU), L3 its T (the
// minimap), Start is the settings, Select the "?" help (FORWARD_SLASH, as
// HelpPopup registers it). LT is S (the HUD), RT M (mute), R3 Q: the quit
// question, answered with the d-pad and A, which saves on the way out.
// CTRL+S stays on the keyboard: sendKey carries no modifiers, and the quit
// and the autosaves already save.
const FIELD: Record<number, string> = {
  [BTN.a]: "KeyZ",
  [BTN.b]: "Escape",
  [BTN.x]: "KeyA",
  [BTN.y]: "KeyI",
  [BTN.lb]: "KeyB",
  [BTN.rb]: "KeyU",
  [BTN.lt]: "KeyS",
  [BTN.rt]: "KeyM",
  [BTN.l3]: "KeyT",
  [BTN.r3]: "KeyQ",
  [BTN.start]: "KeyO",
  [BTN.select]: "Slash",
  [BTN.up]: "ArrowUp",
  [BTN.down]: "ArrowDown",
  [BTN.left]: "ArrowLeft",
  [BTN.right]: "ArrowRight",
};
// In a battle the menu has no cursor (BattleScene.onKey): every action is a
// letter of its own, so the spare buttons stand in for the common ones — X
// FIGHT (KeyA, as in the field), Y the items, LB HEAL, RB FIRE, LT ICE, RT
// BOLT — and the stick clicks for the two late spells, L3 WARD and R3 NOVA.
// Select, the help in the field (a battle has none), is STEAL. Start (O)
// does nothing here. A still advances the text and picks an item, B still
// runs / closes the list, the d-pad still moves the item cursor.
const BATTLE: Record<number, string> = {
  ...FIELD,
  [BTN.y]: "KeyE",
  [BTN.lb]: "KeyH",
  [BTN.rb]: "KeyF",
  [BTN.lt]: "KeyI",
  [BTN.rt]: "KeyB",
  [BTN.l3]: "KeyW",
  [BTN.r3]: "KeyN",
  [BTN.select]: "KeyS",
};
// The title (TitleScene's keydown): A still continues or starts, the d-pad
// picks the slot, RB is U (RESTORE), RT M and Start O as in the field. X is
// N (NEW GAME), LB D (DELETE), LT P (NEW GAME+), and Y types Y, the only key
// that answers their Y/N: every other button backs out. A press alone never
// loses a save, and the three that replace one keep it as the slot's backup
// (U brings it back). X (deleting damaged copies, which keeps nothing) stays
// on the keyboard. C is left out: A already continues.
const TITLE: Record<number, string> = {
  ...FIELD,
  [BTN.x]: "KeyN",
  [BTN.y]: "KeyY",
  [BTN.lb]: "KeyD",
  [BTN.lt]: "KeyP",
};

// the key each pressed button sent, so its release sends that same key even
// when the scene (and with it the mapping) changed while it was held
const held = new Map<number, string>();

function release(button: number): void {
  const code = held.get(button);
  if (code === undefined) return;
  held.delete(button);
  sendKey("keyup", code);
}

function releaseAll(): void {
  for (const button of [...held.keys()]) release(button);
}

function firstPad(): Gamepad | null {
  try {
    for (const pad of navigator.getGamepads()) if (pad?.connected) return pad;
  } catch {
    // a frame denied the gamepad permission: nothing to read
  }
  return null;
}

// the left stick past the deadzone counts as that d-pad direction
function stick(pad: Gamepad, button: number): boolean {
  const x = pad.axes[AXIS_X] ?? 0;
  const y = pad.axes[AXIS_Y] ?? 0;
  if (button === BTN.left) return x < -DEADZONE;
  if (button === BTN.right) return x > DEADZONE;
  if (button === BTN.up) return y < -DEADZONE;
  if (button === BTN.down) return y > DEADZONE;
  return false;
}

function poll(game: Phaser.Game): void {
  const pad = firstPad();
  if (!pad) {
    releaseAll();
    return;
  }
  const mapping = game.scene.isActive("Battle") ? BATTLE : game.scene.isActive("Title") ? TITLE : FIELD;
  // at least the d-pad indices, which a stick-only pad may not list
  for (let button = 0; button < Math.max(pad.buttons.length, 16); button++) {
    const down = pad.buttons[button]?.pressed === true || stick(pad, button);
    if (down === held.has(button)) continue;
    if (!down) {
      release(button);
      continue;
    }
    const code = mapping[button];
    if (!code) continue;
    held.set(button, code);
    sendKey("keydown", code);
  }
}

export function startGamepad(game: Phaser.Game): void {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return;
  window.addEventListener("gamepadconnected", (e) =>
    console.info(`GAMEPAD: ${e.gamepad?.id ?? "?"} (${e.gamepad?.mapping || "no standard mapping"})`),
  );
  window.addEventListener("gamepaddisconnected", releaseAll);
  // a key held when the tab goes away would otherwise never come up, and
  // the hero would walk on until the tab comes back
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) releaseAll();
  });
  const tick = (): void => {
    poll(game);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
