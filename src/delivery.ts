import { MATERIALS, type MaterialKey } from "./drops";
import { type DeliveryState, econDay, GameState, type QuestState } from "./gameState";

// The BOUNTY BOARD's daily delivery: one monster material, 2-4 pieces, for
// gold. Materials otherwise only feed the BLACKSMITH, and the shop won't buy
// them (that would be a gold farm), so once the forge is done with them this
// is where the spares go — at most once a day, a reward day (econDay): one a
// NORMAL day's real time at any TIME SPEED, or VERY FAST would post one every
// 72 seconds and a stock of pieces would pay out twenty times over.
//
// Only what can be gathered today is asked for: a region's materials join the
// pool when its gate opens (the same flags the bounty pool and the regions
// use), and the DRAKE SCALE never does — one per FLAME DRAKE, and the
// DRAKE BLADE needs it.
type DeliverableKey = Exclude<MaterialKey, "drakeScale">;
const OPENS: Record<DeliverableKey, (q: QuestState) => boolean> = {
  slimeGel: () => true,
  batWing: () => true,
  wolfFang: () => true,
  spiderSilk: (q) => q.bossDefeated,
  frostScale: (q) => q.forestBoss,
  yetiFur: (q) => q.forestBoss,
  magmaCore: (q) => q.snowBoss,
};

// What one piece is worth: the fights it takes where it comes cheapest (one
// over its drop odds per fight, drops.ts DROP_TABLE over that region's
// encounter mix) times the gold a fight there pays (ENEMIES gold over the
// same mix, no streak bonus), rounded to 5. E.g. a WOLF FANG in the town's
// grass: GOBLIN 35% x 15% + WOLF 25% x 25% = 0.115 a fight at 8.9 gold a fight.
//   SLIME GEL   cave     0.105/fight,  7.3G/fight -> 69.5
//   BAT WING    cave     0.075/fight,  7.3G/fight -> 97.3
//   WOLF FANG   town     0.115/fight,  8.9G/fight -> 77.4
//   SPIDER SILK forest   0.158/fight, 22.8G/fight -> 144.8
//   FROST SCALE snow     0.125/fight, 49.0G/fight -> 392
//   YETI FUR    snow     0.125/fight, 49.0G/fight -> 392
//   MAGMA CORE  volcano  0.243/fight, 62.3G/fight -> 256.9
// A delivery pays DELIVERY_PAY times that, the low end of 1.0-1.3: the fights
// that dropped the pieces already paid their own gold, so even at 1.0 a
// delivered piece doubles what its fights earned — capped at one delivery a
// day, it can't outrun hunting.
const PIECE_GOLD: Record<DeliverableKey, number> = {
  slimeGel: 70,
  batWing: 95,
  wolfFang: 75,
  spiderSilk: 145,
  frostScale: 390,
  yetiFur: 390,
  magmaCore: 255,
};
const DELIVERY_PAY = 1;
// the biggest ask also hands over a BOMB: the one consumable no battle drops,
// so it can't add to the stacks the loot table already builds
const BOMB_AT = 4;
const NEED_MIN = 2;
const NEED_MAX = 4;

/** Materials today's request can name, in a fixed order. */
export function deliveryPool(q: QuestState): DeliverableKey[] {
  return (Object.keys(OPENS) as DeliverableKey[]).filter((k) => OPENS[k](q));
}

// murmur3's finalizer, salted apart from events.ts's day hash so the two
// never move in step
function mix(n: number): number {
  let h = Math.imul(n ^ 0x2545f491, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** The request for `day` given what's open: the same day and gates, the same answer. */
export function deliveryRequestFor(day: number, q: QuestState): { material: DeliverableKey; need: number } {
  const pool = deliveryPool(q);
  const h = mix(day);
  return { material: pool[h % pool.length], need: NEED_MIN + (Math.floor(h / pool.length) % (NEED_MAX - NEED_MIN + 1)) };
}

export function deliveryReward(material: MaterialKey, need: number): { gold: number; bomb: boolean } {
  const piece = PIECE_GOLD[material as DeliverableKey] ?? 0;
  return { gold: Math.round((need * piece * DELIVERY_PAY) / 5) * 5, bomb: need >= BOMB_AT };
}

/**
 * Today's delivery without writing anything (the quest journal reads this):
 * the one frozen at the board today, else what the board would post now.
 */
export function todaysDelivery(): DeliveryState {
  const d = GameState.delivery;
  const day = econDay();
  if (d && d.day === day) return d;
  return { day, ...deliveryRequestFor(day, GameState.quest), done: false };
}

/** The board's first look of a day freezes the request, so a gate opening later that day can't swap it. */
export function rollDeliveryIfStale(): DeliveryState {
  if (!GameState.delivery || GameState.delivery.day !== econDay()) GameState.delivery = todaysDelivery();
  return GameState.delivery;
}

export function canDeliver(d: DeliveryState): boolean {
  return !d.done && GameState.inventory[d.material] >= d.need;
}

/**
 * Hands today's pieces in. Paid first and only then taken, so a purse at the
 * gold cap (gainGold() credits nothing) keeps its materials and the request
 * stays open, the same edge the bounty claim guards. Null when nothing
 * happened.
 */
export function deliver(d: DeliveryState): { gold: number; bomb: boolean } | null {
  if (!canDeliver(d)) return null;
  const reward = deliveryReward(d.material, d.need);
  const gold = GameState.gainGold(reward.gold);
  if (gold <= 0) return null;
  GameState.inventory[d.material] -= d.need;
  if (reward.bomb) GameState.inventory.bomb += 1;
  d.done = true;
  return { gold, bomb: reward.bomb };
}

export const materialName = (k: MaterialKey): string => MATERIALS[k].name;
