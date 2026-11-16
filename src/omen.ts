// OMEN: each day one open field lies under an omen, a condition on what is
// done there that day. It gives the day somewhere to go: the fields are
// otherwise the same every day but for the weather and where the PEDDLER
// stands. Which field and which omen come from the day alone (econDay, as
// the PEDDLER's field does), so nothing is saved, and the quest journal can
// say it from the town.
//
// The day is fixed as the hero walks into a field (enterField), like the
// PEDDLER's goods: midnight in the field changes nothing till the hero has
// been out and in again, and the fights fought from there are paid by it.
// The town clears it (leaveFields); the ABYSS and the ARENA are no field's.
//
// The omens:
// - GOLD RUSH: a fight won in the field pays OMEN_GOLD more gold, on top of
//   and added to a meal's, a blessing's and TRADE's (payout.ts settleWin), an
//   overrun's share too; not a rematch's, as theirs. A day's hunt there is
//   +30% of its fights' gold; taken every day it falls (one day in two with
//   two omens, in each open field in turn) and hunted all that day, about a
//   seventh on the year, for a hero who goes where the journal says.
// - WILD HUNT: elites come OMEN_ELITE_MULT times as often among the field's
//   ordinary fights (elite.ts ELITE_CHANCE 8% -> 24%; sceneCommon meetFoe).
//   An elite pays x2.5, so +12% gold and EXP over a hunt becomes +36%, for
//   fights that run longer and hit harder; the BOUNTY BOARD's FELL AN ELITE
//   is quickest there. Never the rare ones, the bosses, nor before the
//   ELITE_MIN_BATTLES wins (rollElite's own rules).
import { ELITE_CHANCE } from "./elite";

export type OmenRegion = "dungeon" | "forest" | "snow" | "volcano";
export type OmenKind = "gold" | "wild";

interface OmenDef {
  // the field's line and the toasts; 9 glyphs at most
  name: string;
  // the journal's row, "<tag>: VOLCANO" in 13 glyphs: 4 at most
  tag: string;
  // the toast as the hero walks in: "<name>: <says>!" 52 glyphs at most
  says: string;
}

export const OMEN_GOLD = 0.3;
export const OMEN_ELITE_MULT = 3;

export const OMENS: Record<OmenKind, OmenDef> = {
  gold: { name: "GOLD RUSH", tag: "GOLD", says: "FIGHTS HERE PAY 30% MORE GOLD TODAY" },
  wild: { name: "WILD HUNT", tag: "WILD", says: "THREE TIMES THE ELITES HERE TODAY" },
};
const KINDS = Object.keys(OMENS) as OmenKind[];

// the journal's and the toasts' name for each field; 7 glyphs at most
export const OMEN_REGION_NAMES: Record<OmenRegion, string> = { dungeon: "CAVE", forest: "FOREST", snow: "SNOW", volcano: "VOLCANO" };

interface Gates {
  bossDefeated: boolean;
  forestBoss: boolean;
  snowBoss: boolean;
}
// the flags that open each field (the PEDDLER's and the bounty pool's gates)
const OPEN: Record<OmenRegion, (q: Gates) => boolean> = {
  dungeon: () => true,
  forest: (q) => q.bossDefeated,
  snow: (q) => q.forestBoss,
  volcano: (q) => q.snowBoss,
};

// murmur3's finalizer, salted apart from the PEDDLER's, the delivery's and
// the events' day hashes so they never move in step
function mix(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** The day's omen and the open field it lies on: the same day and gates, the same answer. */
export function omenOn(day: number, q: Gates): { region: OmenRegion; kind: OmenKind } {
  const open = (Object.keys(OPEN) as OmenRegion[]).filter((r) => OPEN[r](q));
  const h = mix(day);
  return { region: open[h % open.length], kind: KINDS[(h >>> 8) % KINDS.length] };
}

// the field the hero is in and the omen it was entered under, if any
let here: { region: OmenRegion; kind: OmenKind | null } | null = null;

/** The hero walks into `region` on `day`: its omen, if today's lies there, held till the town. */
export function enterField(region: OmenRegion, day: number, q: Gates): OmenKind | null {
  const omen = omenOn(day, q);
  here = { region, kind: omen.region === region ? omen.kind : null };
  return here.kind;
}

/** Back in the town: no field's omen holds. */
export function leaveFields(): void {
  here = null;
}

/** The omen the hero's field was entered under, or null. */
export const omenHere = (): OmenKind | null => here?.kind ?? null;

/** GOLD RUSH's share on a fight's gold in the hero's field, 0 without it. */
export const omenGold = (): number => (here?.kind === "gold" ? OMEN_GOLD : 0);

/**
 * WILD HUNT: the chance of the roll that makes a fight an elite's when the
 * ordinary roll (ELITE_CHANCE) would be made anyway, so that the two
 * together are OMEN_ELITE_MULT times it. 0 without the omen.
 */
export const omenEliteExtra = (): number => (here?.kind === "wild" ? (ELITE_CHANCE * (OMEN_ELITE_MULT - 1)) / (1 - ELITE_CHANCE) : 0);
