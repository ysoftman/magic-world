import { FIRE_BEASTS, fireBeastsCaughtIn, GameState, type QuestState } from "./gameState";
import {
  CAVE_POS,
  DUNGEON_ENTRY,
  DUNGEON_ZONES,
  FOREST_ENTRY,
  FOREST_POS,
  FOREST_ZONES,
  HUNTER_POS,
  MONSTER_ZONES,
  type MonsterZone,
  NPC_POS,
  SNOW_ENTRY,
  SNOW_POS,
  SNOW_ZONES,
  VOLCANO_ENTRY,
  VOLCANO_POS,
  VOLCANO_ZONES,
} from "./levels";
import type { Region } from "./weather";

type FieldRegion = Exclude<Region, "town">;

/** Where the current step sends the hero. */
export type ObjectiveSpot =
  | { kind: "npc"; who: "ELDER" | "HUNTER" }
  | { kind: "slimes" }
  | { kind: "boss"; region: FieldRegion }
  // somewhere in a region with no one spot to name (a HUNTER job's hunting ground)
  | { kind: "region"; region: FieldRegion };

export interface Objective {
  /** the HUD's quest slot (StatusHud.questLabel); at most 10 characters */
  label: string;
  /** null when there's nowhere to point: a CATCH job, or the quest done */
  spot: ObjectiveSpot | null;
}

const ELDER: ObjectiveSpot = { kind: "npc", who: "ELDER" };
const HUNTER: ObjectiveSpot = { kind: "npc", who: "HUNTER" };
const boss = (region: FieldRegion): ObjectiveSpot => ({ kind: "boss", region });
const area = (region: FieldRegion): ObjectiveSpot => ({ kind: "region", region });

export type QuestStepId = "slimes" | "king" | "moss" | "glacier" | "drake" | "bats" | "catch" | "yetis" | "fire";

/**
 * What the quest journal lists a step as: `hidden` until its gate opens (a
 * boss behind a locked region, a HUNTER job not yet offered), `offered` for a
 * HUNTER job waiting to be taken, then `open`, `ready` (goal met, reward still
 * with the giver) and `done` (paid).
 */
export type QuestStepState = "hidden" | "offered" | "open" | "ready" | "done";

export interface QuestStep {
  id: QuestStepId;
  giver: "ELDER" | "HUNTER";
  /** the goal is met: the boss felled, the count reached */
  met: boolean;
  /** the reward is handed over */
  paid: boolean;
  /** a HUNTER job taken on; the ELDER's chain is always accepted */
  accepted: boolean;
  /** a counter goal's progress (unclamped, clamp when shown) and target; 0/0 for a boss */
  have: number;
  need: number;
  state: QuestStepState;
}

/**
 * Every step of the ELDER's chain and the HUNTER's jobs, in order, judged
 * once: the HUD slot and minimap marker (currentObjective) and the quest
 * journal (QuestLog) all read these, so a new step or a changed condition is
 * one edit here. Each condition mirrors the branch TownScene's ELDER / HUNTER
 * dialogue actually takes, so nothing ever sends the player to an NPC that
 * has nothing for them yet: a later boss is listed once the gate the previous
 * one opens is open (the GUARD's forest, the snow pass, the crater), and each
 * HUNTER job is offered on the talk after the previous one pays out (the YETI
 * job also waits for the snow pass, the FIRE job for the volcano).
 */
export function questSteps(q: QuestState, caught: readonly string[] = GameState.caught): QuestStep[] {
  const elder = (id: QuestStepId, met: boolean, paid: boolean, listed: boolean, have = 0, need = 0): QuestStep => ({
    id,
    giver: "ELDER",
    met,
    paid,
    accepted: true,
    have,
    need,
    state: !listed ? "hidden" : paid ? "done" : met ? "ready" : "open",
  });
  const hunter = (id: QuestStepId, accepted: boolean, offered: boolean, have: number, need: number, paid: boolean): QuestStep => ({
    id,
    giver: "HUNTER",
    met: have >= need,
    paid,
    accepted,
    have,
    need,
    state: accepted ? (paid ? "done" : have >= need ? "ready" : "open") : offered ? "offered" : "hidden",
  });
  // only catches past the snapshot taken on accepting count; the fire job
  // counts distinct species, so a second SALAMANDER doesn't fill the set
  const fresh = caught.length - q.caughtAtAccept;
  const fire = fireBeastsCaughtIn(caught, q.fireCaughtAtAccept).length;
  return [
    elder("slimes", q.slimes >= 5, q.slimeReward, true, q.slimes, 5),
    elder("king", q.bossDefeated, q.finalReward, true),
    elder("moss", q.forestBoss, q.forestReward, q.bossDefeated),
    elder("glacier", q.snowBoss, q.snowReward, q.forestBoss),
    elder("drake", q.volcanoBoss, q.volcanoReward, q.snowBoss),
    hunter("bats", q.hunterBatsAccepted, true, q.batsSlain, 4, q.hunterBatsReward),
    hunter("catch", q.hunterCatchAccepted, q.hunterBatsReward, fresh, 3, q.hunterCatchReward),
    hunter("yetis", q.hunterYetiAccepted, q.hunterCatchReward && q.forestBoss, q.yetisSlain, 3, q.hunterYetiReward),
    hunter("fire", q.hunterFireAccepted, q.hunterYetiReward && q.snowBoss, fire, FIRE_BEASTS.length, q.hunterFireReward),
  ];
}

// the HUD's word for a boss still to fell, and where it lairs
const BOSS_GOAL: Array<[QuestStepId, string, FieldRegion]> = [
  ["moss", "FIND GOLEM", "forest"],
  ["glacier", "ICE GOLEM", "snow"],
  ["drake", "FIND DRAKE", "volcano"],
];
// a HUNTER job's slot word and its hunting ground; a catch can happen
// anywhere, so CATCH has nowhere to point until it's done
const JOB_GOAL: Partial<Record<QuestStepId, [string, FieldRegion | null]>> = {
  bats: ["BATS", "dungeon"],
  catch: ["CATCH", null],
  yetis: ["YETIS", "snow"],
  fire: ["FIRE", "volcano"],
};

/**
 * The quest chain's current step: its HUD label and where it points, picked
 * from questSteps() so the HUD's slot (and the title screen's save card), the
 * minimap's marker and the journal can never disagree. The main chain comes
 * first, each boss reported to the ELDER; once it's done the slot tracks the
 * HUNTER's side jobs. A finished goal waiting on its reward points at whoever
 * pays it (the ELDER's / HUNTER's own checks, in TownScene).
 *
 * The slime hunt is the slot's first step only until the KING SLIME falls:
 * once it has, the KING's report comes first even with the slimes unreported.
 * Once the slimes are reported the slot names the KING SLIME itself: it used
 * to keep reading SLIMES 5/5 while it pointed at the cave, a goal that looked
 * finished with nothing said about the next one.
 *
 * Every label is capped at 10 chars: the slot starts at x=24 and CAUGHT at
 * x=248, so 10 x 20px ends at 224 with a 24px gap -- counters are clamped for
 * the same reason (an unclamped "SLIMES 12/5" ran 20px past that).
 */
export function currentObjective(q: QuestState, caught: readonly string[] = GameState.caught): Objective {
  const steps = questSteps(q, caught);
  const step = (id: QuestStepId): QuestStep => steps.find((s) => s.id === id) as QuestStep;
  const count = (s: QuestStep): string => `${Math.min(s.have, s.need)}/${s.need}`;
  const slimes = step("slimes");
  if (!step("king").met) {
    if (slimes.paid) return { label: "KING SLIME", spot: boss("dungeon") };
    return { label: `SLIMES ${count(slimes)}`, spot: slimes.met ? ELDER : { kind: "slimes" } };
  }
  // the KING's reward, like every later boss's, is the ELDER's to hand over
  if (!step("king").paid) return { label: "SEE ELDER", spot: ELDER };
  for (const [id, label, region] of BOSS_GOAL) {
    const s = step(id);
    if (!s.met) return { label, spot: boss(region) };
    if (!s.paid) return { label: "SEE ELDER", spot: ELDER };
  }
  const job = steps.find((s) => s.giver === "HUNTER" && s.accepted && !s.paid);
  const goal = job && JOB_GOAL[job.id];
  if (job && goal) {
    const [word, region] = goal;
    return { label: `${word} ${count(job)}`, spot: job.met ? HUNTER : region ? area(region) : null };
  }
  return { label: "QUEST DONE", spot: null };
}

// each region's doorway on the town map, and the way back out of it
const ENTRANCE: Record<FieldRegion, { x: number; y: number }> = {
  dungeon: CAVE_POS,
  forest: FOREST_POS,
  snow: SNOW_POS,
  volcano: VOLCANO_POS,
};
const EXIT: Record<FieldRegion, { x: number; y: number }> = {
  dungeon: DUNGEON_ENTRY,
  forest: FOREST_ENTRY,
  snow: SNOW_ENTRY,
  volcano: VOLCANO_ENTRY,
};
const ZONES: Record<FieldRegion, readonly MonsterZone[]> = {
  dungeon: DUNGEON_ZONES,
  forest: FOREST_ZONES,
  snow: SNOW_ZONES,
  volcano: VOLCANO_ZONES,
};

/**
 * Where on `region`'s own map the step points, in world px. A goal in another
 * region points at this map's way there: the town's doorway to it, or a
 * field's exit back to the town every region hangs off. The NPCs and the town
 * doorways are the map editor's live positions, read at call time.
 */
export function objectivePoints(spot: ObjectiveSpot | null, region: Region): Array<{ x: number; y: number }> {
  if (!spot) return [];
  if (region !== "town") {
    if (spot.kind === "boss" && spot.region === region) {
      // a boss zone is the one zone with a single occupant
      const lair = ZONES[region].find((z) => z.count === 1);
      return lair ? [{ x: lair.cx, y: lair.cy }] : [];
    }
    // already in the hunting ground: the whole map is the goal
    if (spot.kind === "region" && spot.region === region) return [];
    return [EXIT[region]];
  }
  if (spot.kind === "npc") return [spot.who === "ELDER" ? NPC_POS : HUNTER_POS];
  // the slime meadows: the town's zones without a named kind
  if (spot.kind === "slimes") return MONSTER_ZONES.filter((z) => !z.kind).map((z) => ({ x: z.cx, y: z.cy }));
  return [ENTRANCE[spot.region]];
}
