import { type EquipmentKey, GameState, type InventoryState } from "./gameState";

// The SHOP's stock and its prices, apart from the panel (ui/Shop.ts) so the
// balance sim, which can't load Phaser, reads the same list.
export interface ShopItem {
  name: string;
  price: number;
  // every item maps 1:1 to an inventory count — buy/sell just add/remove one
  // of this field, regardless of whether it's a consumable or equipment
  invKey: keyof InventoryState;
  key?: EquipmentKey;
  // Gated stock: shown as LOCKED until the quest opens it, so late-game gear
  // can't be bought at level 1 and flatten the difficulty curve. lockedMsg
  // names the boss whose defeat opens it.
  unlocked?: () => boolean;
  lockedMsg?: string;
  msg: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  { name: "POTION", price: 10, invKey: "potion", msg: "Potion acquired!" },
  { name: "MPOTION", price: 15, invKey: "mPotion", msg: "MPotion acquired!" },
  { name: "CANDY", price: 20, invKey: "candy", msg: "Candy acquired!" },
  { name: "HI-POTION", price: 30, invKey: "hiPotion", msg: "Hi-Potion acquired!" },
  { name: "ETHER", price: 25, invKey: "ether", msg: "Ether acquired!" },
  { name: "ELIXIR", price: 100, invKey: "elixir", msg: "Elixir acquired!" },
  { name: "BOMB", price: 50, invKey: "bomb", msg: "Bomb acquired!" },
  { name: "SWORD", price: 80, invKey: "sword", key: "sword", msg: "Sword acquired!" },
  { name: "SHIELD", price: 80, invKey: "shield", key: "shield", msg: "Shield acquired!" },
  { name: "IRON SWORD", price: 180, invKey: "ironSword", key: "ironSword", msg: "Iron Sword acquired!" },
  { name: "IRON SHIELD", price: 180, invKey: "ironShield", key: "ironShield", msg: "Iron Shield acquired!" },
  { name: "AMULET", price: 120, invKey: "amulet", key: "amulet", msg: "Amulet acquired!" },
  {
    name: "MYTHRIL SWORD",
    price: 320,
    invKey: "mythrilSword",
    key: "mythrilSword",
    unlocked: () => GameState.quest.bossDefeated,
    lockedMsg: "Defeat the KING SLIME first!",
    msg: "Mythril Sword acquired!",
  },
  {
    name: "MYTHRIL SHIELD",
    price: 320,
    invKey: "mythrilShield",
    key: "mythrilShield",
    unlocked: () => GameState.quest.bossDefeated,
    lockedMsg: "Defeat the KING SLIME first!",
    msg: "Mythril Shield acquired!",
  },
  // Resist accessories open with the region whose monsters they counter and
  // cost about 8-9 of that region's kills: the forest pays ~23G a fight
  // (WASP 14 / SPIDER 22 / ORC 34), the snow field ~49G (FROST MOTH 38 /
  // YETI 60). The ring costs more since a lost turn hurts more than poison.
  {
    name: "ANTIDOTE CHARM",
    price: 200,
    invKey: "antidoteCharm",
    key: "antidoteCharm",
    unlocked: () => GameState.quest.bossDefeated,
    lockedMsg: "Defeat the KING SLIME first!",
    msg: "Antidote Charm: blocks poison!",
  },
  {
    name: "EMBER RING",
    price: 400,
    invKey: "emberRing",
    key: "emberRing",
    unlocked: () => GameState.quest.forestBoss,
    lockedMsg: "Defeat the MOSS GOLEM first!",
    msg: "Ember Ring: blocks freezing!",
  },
];
