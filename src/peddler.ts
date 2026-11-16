import { deliveryPool, PIECE_GOLD } from "./delivery";
import { MATERIALS, type MaterialKey } from "./drops";

// The PEDDLER: a travelling trader who stands in one field a day (the cave,
// and the forest, the snow field and the volcano once each is open), a
// different one most days, by a hash of the day (econDay) as the weather and
// the bounty board go. Z beside him offers two things, each once that day:
//
// - PIECES: two of a monster material the hero's open regions drop, which no
//   shop sells — a recipe or a REFINE finished without the last few fights.
//   At 1.5x what a delivery pays a piece (delivery.ts PIECE_GOLD), so bought
//   pieces handed in at the BOUNTY BOARD lose a third of their price.
// - A DEAL: a small lot of one consumable at about two thirds of the town
//   SHOP's price, and over what the shop pays for it back (half its list), so
//   it can't be sold on.
//
// The quest journal names the field he is in today (ui/QuestLog.ts): the
// reason to walk into a field that day.

export type PeddlerRegion = "dungeon" | "forest" | "snow" | "volcano";

// the journal's and his own line's name for each field; 7 glyphs at most
export const PEDDLER_REGION_NAMES: Record<PeddlerRegion, string> = { dungeon: "CAVE", forest: "FOREST", snow: "SNOW", volcano: "VOLCANO" };

interface Gates {
  bossDefeated: boolean;
  forestBoss: boolean;
  snowBoss: boolean;
}

const OPEN: Record<PeddlerRegion, (q: Gates) => boolean> = {
  dungeon: () => true,
  forest: (q) => q.bossDefeated,
  snow: (q) => q.forestBoss,
  volcano: (q) => q.snowBoss,
};

// murmur3's finalizer, salted apart from the delivery's and the events' day
// hashes so the three never move in step
function mix(n: number): number {
  let h = Math.imul(n ^ 0x1b873593, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** The field he stands in on `day`, of those open: the same day and gates, the same answer. */
export function peddlerRegion(day: number, q: Gates): PeddlerRegion {
  const open = (Object.keys(OPEN) as PeddlerRegion[]).filter((r) => OPEN[r](q));
  return open[mix(day) % open.length];
}

type DealKey = "elixir" | "bomb" | "hiPotion" | "candy";
// the shop's list price for the lot in the comment; each over half of it
const DEALS: ReadonlyArray<{ key: DealKey; name: string; count: number; price: number }> = [
  { key: "elixir", name: "ELIXIR", count: 1, price: 65 }, // 100
  { key: "bomb", name: "BOMB", count: 2, price: 65 }, // 100
  { key: "hiPotion", name: "HI-POTION", count: 3, price: 60 }, // 90
  { key: "candy", name: "CANDY", count: 3, price: 40 }, // 60
];

export const PIECES_COUNT = 2;
const PIECES_MARKUP = 1.5;

export interface PeddlerOffer {
  key: MaterialKey | DealKey;
  // "2 SPIDER SILK", "3 HI-POTION": 13 glyphs at most
  label: string;
  count: number;
  price: number;
}

/** His two offers on `day`: the pieces, then the deal. */
export function peddlerStock(day: number, q: Parameters<typeof deliveryPool>[0]): [PeddlerOffer, PeddlerOffer] {
  const h = mix(day * 31 + 7);
  const pool = deliveryPool(q);
  const material = pool[h % pool.length];
  const deal = DEALS[Math.floor(h / pool.length) % DEALS.length];
  return [
    {
      key: material,
      label: `${PIECES_COUNT} ${MATERIALS[material].name}`,
      count: PIECES_COUNT,
      price: Math.round((PIECES_COUNT * PIECE_GOLD[material] * PIECES_MARKUP) / 5) * 5,
    },
    { key: deal.key, label: `${deal.count} ${deal.name}`, count: deal.count, price: deal.price },
  ];
}

// what was bought of today's two offers
export interface PeddlerState {
  day: number;
  bought: [boolean, boolean];
}

// A save from before the peddler has bought nothing
export function loadPeddler(data: unknown): PeddlerState | null {
  const p = data as { day?: unknown; bought?: unknown } | null;
  if (!p || typeof p.day !== "number" || !Number.isInteger(p.day) || !Array.isArray(p.bought)) return null;
  return { day: p.day, bought: [p.bought[0] === true, p.bought[1] === true] };
}

export const peddlerSold = (state: { peddler: PeddlerState | null }, day: number, which: 0 | 1): boolean =>
  state.peddler?.day === day && state.peddler.bought[which];

interface BuyState {
  gold: number;
  peddler: PeddlerState | null;
  inventory: Record<MaterialKey | DealKey, number>;
}

// Offer `which` of `day`'s bought: the gold taken, the goods in the bag, the
// offer gone for the day. False (and nothing taken) when it was bought
// already or the gold is short.
export function buyFromPeddler(state: BuyState, offer: PeddlerOffer, day: number, which: 0 | 1): boolean {
  if (peddlerSold(state, day, which) || state.gold < offer.price) return false;
  state.gold -= offer.price;
  state.inventory[offer.key] += offer.count;
  const bought: [boolean, boolean] = state.peddler?.day === day ? [...state.peddler.bought] : [false, false];
  bought[which] = true;
  state.peddler = { day, bought };
  return true;
}
