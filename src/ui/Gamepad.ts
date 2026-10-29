import type Phaser from "phaser";
import { isTouchDevice, sendKey } from "./TouchControls";

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
export type PadTable = "field" | "battle" | "title";
const TABLES: Record<PadTable, Record<number, string>> = { field: FIELD, battle: BATTLE, title: TITLE };

// The buttons' names in the key lines, by standard index (the d-pad is
// D-PAD). A Nintendo pad reports the same places under its own labels: its
// bottom button, index 0, is B, and the top one the title's Y/N asks for is X.
const NAMES = ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "SELECT", "START", "L3", "R3"];
const NINTENDO_NAMES = ["B", "A", "Y", "X", "L", "R", "ZL", "ZR", "-", "+", "L3", "R3"];
// Chrome's "Pro Controller (STANDARD GAMEPAD Vendor: 057e ...)", Firefox's
// "057e-2009-Pro Controller"; 057e is Nintendo's USB vendor id
const NINTENDO_ID = /nintendo|pro controller|joy-con|057e/i;

// The key lines follow the input last used: a pad press (the stick past the
// deadzone too) turns them to the pad's buttons, a key typed on a keyboard or
// a finger on a touch screen turns them back. sendKey's events are untrusted,
// so the keys the pad and the touch buttons send don't count as a keyboard.
let padInUse = false;
let names = NAMES;
const listeners = new Set<() => void>();

function setInput(pad: boolean, padNames = names): void {
  if (pad === padInUse && padNames === names) return;
  padInUse = pad;
  names = padNames;
  rewriteHints();
  for (const fn of listeners) fn();
}

export function usingPad(): boolean {
  return padInUse;
}

// for what bindKeyHint can't rewrite on its own (a layout that follows its
// labels' widths); the returned function unsubscribes
export function onInputChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// One key of a line as the pad's button, or null when no button sends it
// (TAB, ENTER, CLICK, CTRL+S ...). The vim keys are the d-pad, which a line
// giving each axis its own job (FARM's JK: PLOT, HL: SEED) splits into the
// touch pad's glyphs, ^v and <>.
function buttonName(key: string, table: Record<number, string>, split: boolean): string | null {
  if (key === "HJKL") return "D-PAD";
  if (key === "JK" || key === "HL") return !split ? "D-PAD" : key === "JK" ? "^v" : "<>";
  const code = key === "ESC" ? "Escape" : key === "?" ? "Slash" : /^[A-Z]$/.test(key) ? `Key${key}` : null;
  const button = Object.keys(table)
    .map(Number)
    .find((b) => table[b] === code);
  return button === undefined ? null : (names[button] ?? null);
}

// "Z/ESC" as the pad's "A/B" in `table`'s scene; "" when no button sends any
export function padButtons(keys: string, table: PadTable = "field", split = false): string {
  const out: string[] = [];
  for (const key of keys.split("/")) {
    const name = buttonName(key, TABLES[table], split);
    if (name && !out.includes(name)) out.push(name);
  }
  return out.join("/");
}

// keys named inside a sentence ("FORGE IT? Z/ESC"), as the pad's buttons
// once it is in use
export function keyNames(keys: string, table: PadTable = "field"): string {
  return (padInUse && padButtons(keys, table)) || keys;
}

// A key line ("JK: MOVE   Z: COOK   ESC: CLOSE", or the battle's tighter
// "HJKL:MOVE  Z:OK") for the input in use: the pad's buttons after a pad
// press, `touch` on a touch screen, else as written. Each "KEYS: ACTION"
// takes the buttons that send its keys and drops out when none does; words
// without a colon ("TOP 10 BY LEVEL") stay. `pad` is the line to translate
// when the pad's keys differ from the keyboard's (the shop's B/U for TAB).
export function keyHint(keys: string, touch = keys, { table = "field", pad = keys }: { table?: PadTable; pad?: string } = {}): string {
  if (!padInUse) return isTouchDevice() ? touch : keys;
  const split = /\bJK\b/.test(pad) && /\bHL\b/.test(pad);
  const sep = pad.includes("   ") ? "   " : "  ";
  return pad
    .split(sep)
    .flatMap((group) => {
      const m = /^(\S+):( ?)(.*)$/.exec(group);
      if (!m) return [group];
      const buttons = padButtons(m[1], table, split);
      return buttons ? [`${buttons}:${m[2]}${m[3]}`] : [];
    })
    .join(sep);
}

// The texts showing a key line: what to write and what was written last. A
// text later given other words (the battle's hint between its uses) shows
// something else by then and is dropped instead of overwritten.
const bound = new Map<Phaser.GameObjects.Text, { line: () => string; shown: string }>();

function rewriteHints(): void {
  for (const [text, hint] of bound) {
    if (text.text !== hint.shown) {
      bound.delete(text);
      continue;
    }
    hint.shown = hint.line();
    text.setText(hint.shown);
  }
}

// Writes `line()` into `text`, and again whenever the input in use changes,
// so a panel shows the right buttons when it opens and while it is up.
export function bindKeyHint(text: Phaser.GameObjects.Text, line: () => string): Phaser.GameObjects.Text {
  if (!bound.has(text)) text.once("destroy", () => bound.delete(text));
  const shown = line();
  bound.set(text, { line, shown });
  return text.setText(shown);
}

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
  const padNames = NINTENDO_ID.test(pad.id) ? NINTENDO_NAMES : NAMES;
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
    // before the key goes out, so a panel it opens names the pad's buttons
    setInput(true, padNames);
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
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.isTrusted) setInput(false);
    },
    true,
  );
  // A finger only once the tap has landed: the canvas handles its touches
  // before they bubble here, so a tap aimed at a battle button still meets
  // the layout it was aimed at, not the one its own names would make.
  window.addEventListener("touchend", (e) => {
    if (e.isTrusted) setInput(false);
  });
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
