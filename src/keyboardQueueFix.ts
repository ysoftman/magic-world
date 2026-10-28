import Phaser from "phaser";

// A fix for Phaser 4.2.1's keyboard queue (the latest release at the time):
// - KeyboardManager.js 186-223: each DOM keydown/keyup is pushed onto
//   `queue` and MANAGER_PROCESS is emitted straight away, so every scene's
//   KeyboardPlugin.update() runs through the whole queue again;
// - KeyboardManager.js 172/262: the queue is only emptied on POST_STEP, at
//   the end of the game step;
// - KeyboardPlugin.js 777: its duplicate check compares with the one event
//   before (prevCode/prevTime/prevType) only.
// So when three or more key events land inside one step (a slow frame, a
// gamepad poll sending several buttons, fast typing), every earlier event was
// handed on again — the same KeyboardEvent object, to "keydown" listeners and
// Key "down" alike: one M press followed by another key toggled the mute
// three times, and fast typing on the name entry came out "CC''D". Here each
// plugin takes each queued event once. On a Phaser upgrade, check whether
// this is still needed: dispatch three keydowns on window in one go and see
// whether a scene's "keydown" listener gets each once without it.
type QueueOwner = { manager?: { queue?: KeyboardEvent[] }; isActive(): boolean; update(): void };
type Patched = QueueOwner["update"] & { keyboardQueueFix?: true };

// Called once at boot, before the game is made. It does nothing when the
// plugin isn't shaped as 4.2.1's (an upgrade changed it) and when it already
// ran (an HMR rerun of main.ts), so it can't break input or wrap twice.
export function installKeyboardQueueFix(): void {
  const proto = Phaser.Input.Keyboard?.KeyboardPlugin?.prototype as unknown as QueueOwner | undefined;
  const update = proto?.update as Patched | undefined;
  if (!proto || typeof update !== "function" || update.keyboardQueueFix) return;
  const seenBy = new WeakMap<QueueOwner, WeakSet<KeyboardEvent>>();
  const patched: Patched = function (this: QueueOwner): void {
    const manager = this.manager;
    const all = manager?.queue;
    if (!manager || !Array.isArray(all) || !this.isActive()) {
      update.call(this);
      return;
    }
    let seen = seenBy.get(this);
    if (!seen) {
      seen = new WeakSet();
      seenBy.set(this, seen);
    }
    const fresh = all.filter((e) => !seen.has(e));
    for (const e of fresh) seen.add(e);
    manager.queue = fresh;
    try {
      update.call(this);
    } finally {
      // a key event dispatched from inside a handler joined `fresh`; keep it
      manager.queue = all.concat((manager.queue ?? []).filter((e) => !fresh.includes(e)));
    }
  };
  patched.keyboardQueueFix = true;
  proto.update = patched;
}
