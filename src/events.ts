import { dayIndex } from "./gameState";

// Town events: some days the village runs something special, a reason to
// drop back in. Worked out from the day number alone, so nothing is saved
// and every load agrees on what today is.
export type TownEventKind = "market" | "derby" | "harvest" | "lucky";

export interface TownEvent {
  kind: TownEventKind;
  // the panel tag, e.g. "MARKET DAY"
  name: string;
  // announced in town on arrival and when the day turns over there
  toast: string;
}

// Effect sizes; each panel applies its own (Shop, Fishing, Farm, LuckyWheel).
// The discount only touches buying: selling stays at half the base price, so
// a market-day buy (80%) sold back (50%) loses 30% — no buy/sell loop. The
// x1.5s lift an ordinary day's take by half without outrunning the wilds:
// a pond catch averages ~22G, a full farm of CORN ~270G per 8 hours.
export const MARKET_DISCOUNT = 0.2;
export const DERBY_MULT = 1.5;
export const HARVEST_MULT = 1.5;

const EVENTS: Record<TownEventKind, TownEvent> = {
  market: { kind: "market", name: "MARKET DAY", toast: `MARKET DAY! SHOP PRICES -${Math.round(MARKET_DISCOUNT * 100)}% TODAY` },
  derby: { kind: "derby", name: "FISHING DERBY", toast: `FISHING DERBY! POND CATCHES PAY x${DERBY_MULT} TODAY` },
  harvest: { kind: "harvest", name: "HARVEST FESTIVAL", toast: `HARVEST FESTIVAL! CROPS PAY x${HARVEST_MULT} TODAY` },
  lucky: { kind: "lucky", name: "LUCKY DAY", toast: "LUCKY DAY! THE WHEEL BUSTS LESS TODAY" },
};

// One event day in every block of three, on a day within the block picked
// by a hash — regular enough that one is never far off (1 day in 3), not so
// regular it lands on the same weekday-like slot. The kind steps through a
// fixed rotation, so neighbouring event days never repeat and each kind
// comes round every 4 blocks (12 days). The other two days in three, most
// days, are ordinary.
const EVENT_BLOCK = 3;
const ROTATION: TownEventKind[] = ["market", "derby", "harvest", "lucky"];

// small integer mix (murmur3's finalizer) so neighbouring blocks scatter
function mix(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function eventOn(day: number): TownEvent | null {
  const block = Math.floor(day / EVENT_BLOCK);
  if (day - block * EVENT_BLOCK !== mix(block) % EVENT_BLOCK) return null;
  return EVENTS[ROTATION[block % ROTATION.length]];
}

export function eventToday(): TownEvent | null {
  return eventOn(dayIndex());
}

export function isEventToday(kind: TownEventKind): boolean {
  return eventToday()?.kind === kind;
}

// what the shop charges today for something listed at `base`
export function shopPrice(base: number): number {
  return isEventToday("market") ? Math.round(base * (1 - MARKET_DISCOUNT)) : base;
}
