import { GameState } from "./gameState";
import { TILE } from "./levels";
import { ENEMIES } from "./monsters";
import { overruns } from "./overrun";

// TEMPER: what a field's roamer does about a hero it sees. Every roamer of
// every field walked its box the same blind way, so a walk past a zone had
// nothing to read and the cave's goblins were the snow's yetis with another
// picture. A kind with a temper notices a hero inside `notice` who is not
// behind it (the cone an AMBUSH comes from, sceneCommon firstStrike: what
// walks or last walked away from the hero has its back to it), stands
// through `windup` under a "!", then for `grit` comes at the hero ("bold")
// or runs from it ("shy") at `speed`, out of its box by up to TEMPER_LEASH.
// After that it is spent: it walks home, blind, its back to whoever it was
// chasing.
//
// The numbers are against the hero's walk (sceneCommon WALK_SPEED 240 on an
// axis, 339 on a diagonal): only a dart (SPIDER, YETI) is faster than a hero
// walking straight off, and the one is short and the other cannot turn, so
// walking away always works and what is left to the player is which way.
// One kind per field is left blind on purpose (the slimes), and a boss or a
// giant keeps its room.
export interface Temper {
  way: "bold" | "shy";
  /** px: how near the hero is seen */
  notice: number;
  /** ms stood under the "!" before it moves */
  windup: number;
  /** px a second */
  speed: number;
  /** ms it keeps at it */
  grit: number;
  /** a charge: the line is set as it starts and it cannot turn */
  locked?: boolean;
}

// how far out of its box (the zone) a chase or a flight takes a roamer
export const TEMPER_LEASH = TILE * 3;
// the hero this far off (in notices) has got away, or been got away from
export const TEMPER_LOSE = 1.75;
// a hero this near the way in (the scene's `haven`) is not seen: a zone sits
// by every entry, and the cave's bats would dive at whoever had just arrived
export const TEMPER_HAVEN = TILE * 2.5;
// ms before a roamer new to the map, or home from a chase, sees anything:
// the entry's and a fight's return's grace (1.2s) and a second to look round
export const TEMPER_CALM_MS = 2500;

const t = (way: Temper["way"], tiles: number, windup: number, speed: number, grit: number, locked = false): Temper => ({
  way,
  notice: tiles * TILE,
  windup,
  speed,
  grit,
  locked,
});

const GOBLIN = t("bold", 3, 400, 170, 2500);
const WASP = t("bold", 3.5, 300, 210, 2000);
const MOTH = t("shy", 2.5, 250, 160, 2500);

export const TEMPERS: Record<string, Temper> = {
  // the cave: goblins that give chase, bats that dive and give up
  goblin: GOBLIN,
  cursedGoblin: GOBLIN,
  bat: t("bold", 2.5, 250, 230, 900),
  // the forest: a wasp nearly keeps up, a spider waits and lunges, an orc
  // is slow to start and slow to stop
  wasp: WASP,
  silverWasp: WASP,
  spider: t("bold", 1.75, 200, 300, 500),
  orc: t("bold", 4, 600, 130, 6000),
  // the snow: moths that will not be met, a yeti's straight charge to step out of
  frostMoth: MOTH,
  auroraMoth: MOTH,
  yeti: t("bold", 3.5, 700, 270, 1100, true),
  // the volcano: imps quick and soon bored, salamanders that plod after.
  // Its zones sit in the lanes between the lava, so both see less far than
  // their like elsewhere (a hero walking away from each met 10.7 fights a
  // minute at 3 and 3.5 tiles)
  fireImp: t("bold", 2.5, 250, 200, 1200),
  salamander: t("bold", 3, 500, 140, 3000),
};

/**
 * The temper of a roamer of `kind` as the hero is now, or null for one that
 * pays the hero no mind. One the hero overruns (overrun.ts) is such a one
 * whatever its kind: it no longer dares, and a pack of them is swept through
 * as it stood. They ran at first, and a sweep became a chase after each.
 */
export function temperOf(kind: string): Temper | null {
  const def = ENEMIES[kind];
  if (!def || def.boss || def.giant) return null;
  if (GameState.overrun && overruns(kind)) return null;
  return TEMPERS[kind] ?? null;
}
