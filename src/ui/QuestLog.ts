import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { canDeliver, deliveryReward, materialName, todaysDelivery } from "../delivery";
import { FAVOR_GIVERS, favorProgress, favorStatus, favorStep } from "../favors";
import { econDay, GameState } from "../gameState";
import { allSpeciesCaught, CATCHABLE } from "../monsters";
import { type QuestStep, type QuestStepId, questSteps } from "../objective";
import { DIM_TEXT, retroStyle } from "../pixelart";
import { hideTouchButtons } from "./TouchControls";

// Rows are pooled, sized to the most each column can ever hold at once.
// IN PROGRESS: up to 5 ELDER steps (all four bosses can fall before any is
// reported, with the slime hunt still open; CATCH EVERY BEAST only shows once
// the KING SLIME and MOSS GOLEM rewards are paid), 1 HUNTER job (each is
// offered only after the previous one pays out), the bounty and the
// delivery: 8. COMPLETED: 5 ELDER steps, the bestiary, 4 HUNTER jobs, the
// bounty and the delivery: 12. The townsfolk's favors come after all of
// that (up to 3 taken on plus one "need help" row, 3 finished chains): they
// have no deadline, so when a column overflows they are what gives way to a
// last "+N MORE" row. A new quest line needs these (and the gaps below, or
// PANEL_H) bumped, or has to sit behind the favors.
const ACTIVE_ROWS = 8;
const DONE_ROWS = 12;

// The panel spans x 60..1220: it ends where the touch menu column starts
// (x>=1222), like the other panels. Widths (Press Start 2P: chars x size x
// 4px), against at least a 20px inner margin:
// - IN PROGRESS title, retroStyle(5): "DELIVERY: 4 SPIDER SILK" 23 x 20 = 460,
//   x 84..544, leaving 20px before the right-aligned "READY" at 564..664
// - its detail, retroStyle(4): "ONE MAGMA SLIME, FIRE IMP, SALAMANDER" 37 x
//   16 = 592, x 84..676, 24px short of the COMPLETED column at 700
// - COMPLETED, retroStyle(5): "★ DELIVERY: 4 SPIDER SILK" 25 x 20 = 500,
//   x 700..1200, 20px inside the panel's 1220 edge
// Heights (Press Start 2P lines measure exactly 1em): 8 two-line rows 56px
// apart end at PANEL_TOP+576 (the last detail line), 26px clear of the close
// hint's top (PANEL_TOP+602); 12 one-line rows 36px apart end at
// PANEL_TOP+556. The 640px panel leaves 40px above and below.
const PANEL_W = 1160;
const PANEL_H = 640;
const PANEL_LEFT = GAME_WIDTH / 2 - PANEL_W / 2;
const PANEL_TOP = GAME_HEIGHT / 2 - PANEL_H / 2;
const ACTIVE_X = PANEL_LEFT + 24;
const PROGRESS_R = PANEL_LEFT + 604;
const DONE_X = PANEL_LEFT + 640;
const HEADER_Y = PANEL_TOP + 100;
const ROW_Y = PANEL_TOP + 150;
const ACTIVE_GAP = 56;
const DETAIL_DY = 26;
const DONE_GAP = 36;

const PROGRESS_COLOR = "#ffd166";
const READY_COLOR = "#4ade80";
const HINT_COLOR = "#8ecbff";

interface Objective {
  title: string;
  // reward collected: the row moves to the COMPLETED column
  done: boolean;
  // goal met but the reward is still waiting with `giver`
  ready: boolean;
  progress: string; // "3/5", "NEW", or "" for a single boss
  giver: string;
  hint: string; // where to go while the goal is still open
}

// The journal's words for each chain step; which steps show and in what state
// is objective.ts's questSteps(), the same judgment the HUD slot and minimap
// marker pick their one step from.
const STEP_TEXT: Record<QuestStepId, { title: string; hint: string }> = {
  slimes: { title: "HUNT 5 SLIMES", hint: "SLIMES LURK IN THE TALL GRASS" },
  king: { title: "SLAY THE KING SLIME", hint: "IT WAITS DEEP IN THE CAVE" },
  moss: { title: "SLAY THE MOSS GOLEM", hint: "IT LURKS IN THE FOREST" },
  glacier: { title: "SLAY THE GLACIER GOLEM", hint: "IT SLEEPS PAST THE SNOW PASS" },
  drake: { title: "SLAY THE FLAME DRAKE", hint: "IT RULES THE VOLCANO" },
  bats: { title: "SLAY 4 BATS", hint: "BATS NEST IN THE CAVE" },
  catch: { title: "CATCH 3 NEW BEASTS", hint: "THROW CANDY IN BATTLE" },
  yetis: { title: "SLAY 3 YETIS", hint: "YETIS ROAM PAST THE SNOW PASS" },
  fire: { title: "CATCH EACH FIRE BEAST", hint: "ONE MAGMA SLIME, FIRE IMP, SALAMANDER" },
};

// a HUNTER job not taken yet: only say work is waiting
const OFFER: Objective = {
  title: "THE HUNTER HAS A JOB",
  done: false,
  ready: false,
  progress: "NEW",
  giver: "HUNTER",
  hint: "TALK TO THE HUNTER",
};

// The chain steps come from questSteps(); the bestiary and bounty rows aren't
// part of that chain and are judged here, mirroring the ELDER's and the
// BOUNTY BOARD's own branches in TownScene. Counters are unbounded in
// GameState and clamped here, the same display-time clamp the NPCs use.
function objectives(): Objective[] {
  const q = GameState.quest;
  const count = (have: number, need: number): string => `${Math.min(have, need)}/${need}`;
  const row = (s: QuestStep): Objective =>
    s.state === "offered"
      ? OFFER
      : {
          ...STEP_TEXT[s.id],
          done: s.state === "done",
          ready: s.state === "ready",
          progress: s.need > 0 ? count(s.have, s.need) : "",
          giver: s.giver,
        };
  const steps = questSteps(q, GameState.caught).filter((s) => s.state !== "hidden");
  const list = steps.filter((s) => s.giver === "ELDER").map(row);
  // the ELDER neither mentions nor pays the bestiary reward until the forest
  // reward is handed over, even if every beast is already caught
  if (q.forestReward) {
    const caught = CATCHABLE.filter((e) => GameState.caught.includes(e.name)).length;
    list.push({
      title: "CATCH EVERY BEAST",
      done: q.bestiaryReward,
      ready: allSpeciesCaught(GameState.caught),
      progress: count(caught, CATCHABLE.length),
      giver: "ELDER",
      hint: "THROW CANDY IN BATTLE",
    });
  }
  list.push(...steps.filter((s) => s.giver === "HUNTER").map(row));

  // the board rerolls on its first read of a new day (rollBountyIfStale) — a
  // write the journal must not make, so a missing or yesterday's bounty just
  // points the player at the board
  const b = GameState.bounty;
  if (!b || b.day !== econDay()) {
    list.push({
      title: "DAILY BOUNTY",
      done: false,
      ready: false,
      progress: "NEW",
      giver: "BOUNTY BOARD",
      hint: "CHECK THE BOUNTY BOARD",
    });
  } else {
    list.push({
      title: `BOUNTY: ${b.target}`,
      done: b.claimed,
      ready: b.have >= b.need,
      progress: count(b.have, b.need),
      giver: "BOUNTY BOARD",
      hint: `REWARD ${b.reward}G - TODAY ONLY`,
    });
  }
  // today's request even before the board is read: todaysDelivery() works it
  // out without writing, the same answer the board will freeze. Progress is
  // what's in the bag, so READY means it can be handed in now.
  const d = todaysDelivery();
  const pay = deliveryReward(d.material, d.need);
  list.push({
    title: `DELIVERY: ${d.need} ${materialName(d.material)}`,
    done: d.done,
    ready: canDeliver(d),
    progress: count(GameState.inventory[d.material], d.need),
    giver: "BOUNTY BOARD",
    hint: `PAYS ${pay.gold}G${pay.bomb ? " + BOMB" : ""} - TODAY ONLY`,
  });
  // the townsfolk (favors.ts): each favor taken on, a finished chain, and
  // one row for whoever still has one to offer ("ASK BY DAY: FARMER, FISHER,
  // TRAVELER" is 36 glyphs, 576px)
  for (const key of FAVOR_GIVERS) {
    const status = favorStatus(key);
    const step = favorStep(key);
    const giver = key.toUpperCase();
    if (status === "done") {
      list.push({ title: `${giver}'S FAVORS`, done: true, ready: false, progress: "", giver, hint: "" });
    } else if (step && (status === "open" || status === "ready")) {
      const { have, need } = favorProgress(key);
      list.push({ title: step.title, done: false, ready: status === "ready", progress: count(have, need), giver, hint: step.hint });
    }
  }
  const asking = FAVOR_GIVERS.filter((k) => favorStatus(k) === "offer").map((k) => k.toUpperCase());
  if (asking.length > 0) {
    list.push({
      title: "TOWNSFOLK NEED HELP",
      done: false,
      ready: false,
      progress: "NEW",
      giver: "",
      hint: `ASK BY DAY: ${asking.join(", ")}`,
    });
  }
  return list;
}

// a column's rows, or all but the last of them and a "+N MORE" in its place
function fit<T>(rows: T[], cap: number, more: (n: number) => T): T[] {
  return rows.length > cap ? [...rows.slice(0, cap - 1), more(rows.length - cap + 1)] : rows;
}

// shown in place of an empty IN PROGRESS column: with every quest line paid
// out and today's bounty claimed, tomorrow's bounty is all that's left
const ALL_DONE: Objective = {
  title: "ALL CAUGHT UP!",
  done: false,
  ready: false,
  progress: "",
  giver: "",
  hint: "A NEW BOUNTY IS POSTED EACH DAY",
};

interface ActiveRow {
  title: Phaser.GameObjects.Text;
  progress: Phaser.GameObjects.Text;
  detail: Phaser.GameObjects.Text;
}

// Quest journal shown with U: what's still open (with progress and where to
// go, or who to report to once it's met) beside what's already paid out.
// Read-only over GameState. Same dim + panel modal as AchievementsUI, held in
// one container so open/close is a single visibility flip; ESC or U closes.
export class QuestLog {
  private scene: Phaser.Scene;
  private active = false;
  private root: Phaser.GameObjects.Container;
  private title: Phaser.GameObjects.Text;
  private activeRows: ActiveRow[] = [];
  private doneRows: Phaser.GameObjects.Text[] = [];
  private closeQueued = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const text = (x: number, y: number, size: number, color: string, value = ""): Phaser.GameObjects.Text =>
      scene.add.text(x, y, value, retroStyle(size, color)).setOrigin(0, 0.5);

    for (let i = 0; i < ACTIVE_ROWS; i++) {
      const y = ROW_Y + i * ACTIVE_GAP;
      this.activeRows.push({
        title: text(ACTIVE_X, y, 5, "#ffffff"),
        progress: text(PROGRESS_R, y, 5, PROGRESS_COLOR).setOrigin(1, 0.5),
        detail: text(ACTIVE_X, y + DETAIL_DY, 4, HINT_COLOR),
      });
    }
    for (let i = 0; i < DONE_ROWS; i++) {
      this.doneRows.push(text(DONE_X, ROW_Y + i * DONE_GAP, 5, "#7fbf7f"));
    }
    // "QUEST JOURNAL  NG+99" on a replay: 20 x 32 = 640px, x=320..960
    this.title = scene.add.text(GAME_WIDTH / 2, PANEL_TOP + 44, "QUEST JOURNAL", retroStyle(8, "#ffd166")).setOrigin(0.5);

    this.root = scene.add
      .container(0, 0, [
        scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5),
        // opaque: it reaches up over the HUD (y 0..88), whose lines showed through at 0.95
        scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, PANEL_W, PANEL_H, 0x0b0b2b, 1).setStrokeStyle(2, 0xffffff),
        this.title,
        text(ACTIVE_X, HEADER_Y, 6, HINT_COLOR, "IN PROGRESS"),
        text(DONE_X, HEADER_Y, 6, HINT_COLOR, "COMPLETED"),
        ...this.activeRows.flatMap((r) => [r.title, r.progress, r.detail]),
        ...this.doneRows,
        scene.add.text(GAME_WIDTH / 2, PANEL_TOP + PANEL_H - 30, "U/ESC: CLOSE", retroStyle(4, HINT_COLOR)).setOrigin(0.5),
      ])
      .setScrollFactor(0)
      .setDepth(150)
      .setVisible(false);

    // e.repeat is ignored so holding the U that opened the panel doesn't
    // close it again once the OS key repeat kicks in
    const queueClose = (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (!e.repeat) this.closeQueued = true;
    };
    const kb = scene.input.keyboard!;
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on(Phaser.Input.Keyboard.Events.DOWN, queueClose);
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.U).on(Phaser.Input.Keyboard.Events.DOWN, queueClose);
  }

  open(): void {
    this.active = true;
    // cleared here (not in the constructor) so the U keydown that opens the
    // panel — same event also sets closeQueued — doesn't immediately close it
    this.closeQueued = false;
    this.refresh();
    this.root.setVisible(true);
    // on touch the d-pad sits on the last IN PROGRESS rows and Z on the tenth
    // COMPLETED one; this panel reads neither, only ESC/U
    hideTouchButtons(this.scene, ["dpad", "z"]);
  }

  close(): void {
    this.active = false;
    this.root.setVisible(false);
    hideTouchButtons(this.scene, []);
  }

  isActive(): boolean {
    return this.active;
  }

  update(): void {
    if (!this.active || !this.closeQueued) return;
    this.closeQueued = false;
    this.close();
  }

  private refresh(): void {
    // a replay's chapters read the same as the first run's, so the cycle is
    // the one thing that tells the two journals apart
    this.title.setText(GameState.ngPlus > 0 ? `QUEST JOURNAL  NG+${GameState.ngPlus}` : "QUEST JOURNAL");
    const all = objectives();
    const open = all.filter((o) => !o.done);
    const done = all.filter((o) => o.done);
    const shown =
      open.length > 0
        ? fit(open, ACTIVE_ROWS, (n) => ({ ...ALL_DONE, title: `+${n} MORE`, hint: "FINISH ONE TO SEE THE REST" }))
        : [ALL_DONE];
    this.activeRows.forEach((row, i) => {
      const o = shown[i];
      row.title.setText(o?.title ?? "");
      row.progress.setText(o ? (o.ready ? "READY" : o.progress) : "").setColor(o?.ready ? READY_COLOR : PROGRESS_COLOR);
      row.detail.setText(o ? (o.ready ? `REPORT TO THE ${o.giver}` : o.hint) : "").setColor(o?.ready ? READY_COLOR : HINT_COLOR);
    });
    const doneText = fit(
      done.map((o) => `★ ${o.title}`),
      DONE_ROWS,
      (n) => `+${n} MORE`,
    );
    this.doneRows.forEach((row, i) => {
      const t = doneText[i];
      row.setText(t ?? (i === 0 ? "NONE YET" : "")).setColor(t ? "#7fbf7f" : DIM_TEXT);
    });
  }

  destroy(): void {
    this.root.destroy();
    // keys are shared instances from kb.addKey (same keycode → same object);
    // destroying them would wipe other panels' listeners. Scene shutdown
    // already tears every Key down via KeyboardPlugin.removeAllKeys(true).
  }
}
