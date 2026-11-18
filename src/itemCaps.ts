// How many of each consumable the bag holds. Without a cap a late fight's
// gold (about 65 G in the volcano) bought two HI-POTIONs (30 G), so a boss
// could be outlasted on a stack of them and its wind-ups never answered.
// Prices are unchanged; a stack is what a fight can lean on, not a hoard.
// Sized with sim:battle at each boss's intended level and gear, the bag full
// (--potions 9 --hipotions 5, --elixirs 2 from the MOSS GOLEM on) and
// nothing answered (--nobrace): alone 65/56/69/51/85% (KING SLIME, TROLL
// KING, MOSS GOLEM, GLACIER GOLEM, FLAME DRAKE), beside a WOLF 79/71/82/
// 64/88%, where 3 POTIONs alone are 19/14/6/6/18% and 69/69/49/59/44%. The
// sim's hero drinks only at 35% HP or less, so past 3 HI-POTIONs and one
// ELIXIR a bigger stack moves nothing there; the caps bound the player who
// drinks every turn, whom it does not model.
//
// Everything that hands out an item goes through addItem (GameState.gainItem
// for the callers that hold GameState): the shop, a fight's loot, chests,
// treasure maps, the PEDDLER, quest and favor rewards, deliveries, fishing.
// What doesn't fit is lost, and the caller says so where it has a line. A
// save holding more than a cap (from before there were any) keeps it: it
// only can't gain until it has used its way under.
export const ITEM_CAPS = {
  potion: 9,
  mPotion: 9,
  hiPotion: 5,
  ether: 5,
  // 3, not the 2 the sim was run with: the ELDER pays 3 at a time (TownScene.ts)
  elixir: 3,
  bomb: 5,
  candy: 9,
} as const;
export type CappedItem = keyof typeof ITEM_CAPS;

/** The most of `key` the bag holds, Infinity for what has no cap (gear, materials). */
export const itemCap = (key: string): number => (ITEM_CAPS as Record<string, number | undefined>)[key] ?? Number.POSITIVE_INFINITY;

/** How many more of `key` fit in `inventory`. */
export const itemRoom = <K extends string>(inventory: Record<K, number>, key: K): number => Math.max(0, itemCap(key) - inventory[key]);

/** Adds up to `n` of `key` to `inventory`, stopping at its cap; returns how many went in. */
export function addItem<K extends string>(inventory: Record<K, number>, key: K, n = 1): number {
  const added = Math.min(n, itemRoom(inventory, key));
  inventory[key] += added;
  return added;
}

/**
 * " (3/9)" for a capped item, "" for the rest: what the shop's and the bag's
 * info line ends on. The longest line with it is CANDY's, 47 glyphs of the
 * 55 a line is sized for (itemInfo.ts).
 */
export const capNote = <K extends string>(inventory: Record<K, number>, key: K): string =>
  Number.isFinite(itemCap(key)) ? ` (${inventory[key]}/${itemCap(key)})` : "";
