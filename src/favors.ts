import { MATERIALS, type MaterialKey } from "./drops";
import { ALL_FISH, type FavorState, GameState, type QuestState, type VillagerKey } from "./gameState";

// The townsfolk's favors: a three-step chain each that sends the hero back to
// a system the villager already talks about — the FARMER to the farm, the
// FISHER to the pond, the TRAVELER to the monster materials. Taken on and
// handed in by talking to them, so only by day (they go home at dusk).
//
// A step's progress is one of:
// - `counter`: a GameState counter, counted from the value it had when the
//   step was taken on (FavorState.snap), so earlier harvests or catches
//   don't fill it
// - `have`: read as it stands: pieces in the bag (handed over on YES), or a
//   fish already in the log (showing it is the favor)
// Rewards stay small, 40/80/150 gold, with an ELIXIR at the end of each chain:
// the chains are something to do with the farm, the pond and spare
// materials, not another income. The materials asked for are worth more at
// the BOUNTY BOARD's delivery (delivery.ts) — these are favors.
//
// Widths: a title (QuestLog, retroStyle(5)) is at most 23 glyphs, 460px, so
// it ends 20px short of READY; a hint at most 37 glyphs (the quest log's
// bodyStyle(22), 518px); the talk lines at most 42, the touch box's row.
export interface FavorStep {
  title: string;
  talk: string[];
  hint: string;
  need: number;
  counter?: () => number;
  have?: () => number;
  takes?: MaterialKey;
  opens?: (q: QuestState) => boolean;
  gold: number;
}

const loggedAny = (pick: (f: (typeof ALL_FISH)[number]) => boolean): number =>
  ALL_FISH.some((f) => pick(f) && f.name in GameState.fishLog) ? 1 : 0;
const bag = (k: MaterialKey) => () => GameState.inventory[k];

export const FAVORS: Record<VillagerKey, FavorStep[]> = {
  farmer: [
    {
      title: "FARMER: HARVEST 3 CROPS",
      talk: ["My back is killing me.", "Could you harvest 3", "crops at the farm?"],
      hint: "PLANT AND HARVEST AT THE FARM",
      need: 3,
      counter: () => GameState.cropsHarvested,
      gold: 40,
    },
    {
      title: "FARMER: HARVEST 8 CROPS",
      talk: ["The market wants more.", "Could you harvest 8", "more crops for me?"],
      hint: "PLANT AND HARVEST AT THE FARM",
      need: 8,
      counter: () => GameState.cropsHarvested,
      gold: 80,
    },
    {
      title: "FARMER: GOLDEN HARVEST",
      talk: ["They say 1 crop in 20", "comes up GOLDEN. Will", "you grow me one?"],
      hint: "1 HARVEST IN 20 COMES UP GOLDEN",
      need: 1,
      counter: () => GameState.goldenHarvests,
      gold: 150,
    },
  ],
  fisher: [
    {
      title: "FISHER: CATCH 5 FISH",
      talk: ["The fish are biting!", "Could you catch 5", "for me, hero?"],
      hint: "CAST AT THE POND OR THE ICE HOLE",
      need: 5,
      counter: () => GameState.fishCaught,
      gold: 40,
    },
    {
      title: "FISHER: A NIGHT FISH",
      talk: ["I've never seen a fish", "that bites after dark.", "Log one for me?"],
      hint: "A NIGHT FISH IN YOUR FISH LOG",
      need: 1,
      have: () => loggedAny((f) => f.night === true),
      gold: 80,
    },
    {
      title: "FISHER: A GOLDEN CATCH",
      talk: ["The GOLDEN FISH... or", "the AURORA KOI. Will", "you log one for me?"],
      hint: "GOLDEN FISH OR AURORA KOI",
      need: 1,
      have: () => loggedAny((f) => f.bonusItem !== undefined),
      gold: 150,
    },
  ],
  traveler: [
    {
      title: "TRAVELER: 2 WOLF FANG",
      talk: ["I'm making a charm.", "Could you bring me", "2 WOLF FANG?"],
      hint: "WOLVES AND GOBLINS DROP THEM",
      need: 2,
      have: bag("wolfFang"),
      takes: "wolfFang",
      gold: 40,
    },
    {
      title: "TRAVELER: 1 SPIDER SILK",
      talk: ["Now it needs a string.", "Could you bring me", "1 SPIDER SILK?"],
      hint: "SPIDERS AND WASPS IN THE FOREST",
      need: 1,
      have: bag("spiderSilk"),
      takes: "spiderSilk",
      opens: (q) => q.bossDefeated,
      gold: 80,
    },
    {
      title: "TRAVELER: 1 MAGMA CORE",
      talk: ["And a warm stone for", "its heart. Could you", "bring me 1 MAGMA CORE?"],
      hint: "THE VOLCANO'S BEASTS DROP IT",
      need: 1,
      have: bag("magmaCore"),
      takes: "magmaCore",
      opens: (q) => q.snowBoss,
      gold: 150,
    },
  ],
};

export const FAVOR_GIVERS = Object.keys(FAVORS) as VillagerKey[];

/** done: every step paid; locked: the next step's region isn't open; offer: not taken on yet. */
export type FavorStatus = "done" | "locked" | "offer" | "open" | "ready";

const stateOf = (key: VillagerKey): FavorState => GameState.favors[key];

export function favorStep(key: VillagerKey): FavorStep | null {
  return FAVORS[key][stateOf(key).step] ?? null;
}

export function favorProgress(key: VillagerKey): { have: number; need: number } {
  const step = favorStep(key);
  if (!step) return { have: 0, need: 0 };
  const have = step.counter ? step.counter() - stateOf(key).snap : (step.have?.() ?? 0);
  return { have: Math.max(0, have), need: step.need };
}

export function favorStatus(key: VillagerKey): FavorStatus {
  const step = favorStep(key);
  if (!step) return "done";
  if (!stateOf(key).accepted) return step.opens && !step.opens(GameState.quest) ? "locked" : "offer";
  const { have, need } = favorProgress(key);
  return have >= need ? "ready" : "open";
}

export function acceptFavor(key: VillagerKey): void {
  const step = favorStep(key);
  if (!step) return;
  GameState.favors[key] = { step: stateOf(key).step, accepted: true, snap: step.counter ? step.counter() : 0 };
}

/**
 * Pays a ready step and moves the chain on: the gold lands first
 * (gainGold()'s credited amount is what's reported), then the pieces it asked
 * for leave the bag and the last step adds an ELIXIR. "full" when the purse
 * is at the gold cap — nothing credited, so nothing is taken and the step
 * stays ready, the same edge the bounty claim and the delivery guard. Null
 * when the step isn't ready.
 */
export function completeFavor(key: VillagerKey): { gold: number; elixir: boolean } | "full" | null {
  const step = favorStep(key);
  if (!step || favorStatus(key) !== "ready") return null;
  const gold = GameState.gainGold(step.gold);
  if (gold <= 0) return "full";
  if (step.takes) GameState.inventory[step.takes] -= step.need;
  const next = stateOf(key).step + 1;
  const elixir = next >= FAVORS[key].length;
  if (elixir) GameState.inventory.elixir += 1;
  GameState.favors[key] = { step: next, accepted: false, snap: 0 };
  return { gold, elixir };
}

export const allFavorsDone = (): boolean => FAVOR_GIVERS.every((k) => favorStatus(k) === "done");

export const materialNameOf = (k: MaterialKey): string => MATERIALS[k].name;
