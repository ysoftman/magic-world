import { MATERIAL_KEYS, MATERIALS, type MaterialKey } from "./drops";
import {
  EQUIP_BONUS,
  EQUIP_MAXHP,
  EQUIP_RESIST,
  EQUIP_SLOT,
  type EquipmentKey,
  type InventoryState,
  RESIST_KINDS,
  type ResistKind,
} from "./gameState";

// What each consumable gives. InventoryUI's use() and BattleScene's
// usePotion/useMPotion/useHiPotion/useEther/throwBomb all spend these, so
// the effects and the descriptions below can't drift apart.
export const POTION_HP = 25;
export const HI_POTION_HP = 50;
export const MPOTION_MP = 8;
export const ETHER_MP = 12;
// a flat hit: throwBomb() skips calcDamage, so the target's DEF never applies
export const BOMB_DAMAGE = 12;

const RESIST_NAME: Record<ResistKind, string> = { poison: "POISON", freeze: "FREEZING" };

// Read off the equipment tables rather than written out, so a retuned bonus
// or a new resist shows up here on its own. Only the weapon's bonus feeds
// ATK and only the armor's DEF (GameState.effAtk/effDef); an accessory's
// EQUIP_BONUS is 0 and never applied. A piece blocking every ailment says so
// in one phrase: "TALISMAN: ACCESSORY, BLOCKS ALL AILMENTS" is 40 glyphs,
// where naming both would overrun the info line.
function equipInfo(key: EquipmentKey): string {
  const slot = EQUIP_SLOT[key];
  const parts = [slot.toUpperCase()];
  const bonus = EQUIP_BONUS[key];
  if (bonus > 0 && slot !== "accessory") parts.push(`${slot === "weapon" ? "ATK" : "DEF"} +${bonus}`);
  const resists = EQUIP_RESIST[key] ?? [];
  if (resists.length === RESIST_KINDS.length) parts.push("BLOCKS ALL AILMENTS");
  else for (const r of resists) parts.push(`BLOCKS ${RESIST_NAME[r]}`);
  const hp = EQUIP_MAXHP[key];
  if (hp) parts.push(`MAX HP +${hp}`);
  return parts.join(", ");
}

// a material says what it's for and where it comes from (drops.ts)
const materialInfo = Object.fromEntries(MATERIAL_KEYS.map((k) => [k, `SMITHING, FROM ${MATERIALS[k].from}`])) as Record<
  MaterialKey,
  string
>;

// One line per inventory key — a Record, so a new item is a compile error
// here until it has a description. Shop/InventoryUI show it as
// "NAME: INFO"; the longest, CANDY's and ANTIDOTE CHARM's, are 40 glyphs —
// what both panels' info line is sized for. Poison only exists in battle,
// so "CURES POISON" is a battle effect (BattleScene.curePoison).
export const ITEM_INFO: Record<keyof InventoryState, string> = {
  potion: `RESTORES ${POTION_HP} HP, CURES POISON`,
  mPotion: `RESTORES ${MPOTION_MP} MP`,
  // throwCandy(): 15% at half HP or more, 55-70% below it, never a boss
  candy: "THROW TO CATCH A WEAKENED MONSTER",
  hiPotion: `RESTORES ${HI_POTION_HP} HP, CURES POISON`,
  ether: `RESTORES ${ETHER_MP} MP`,
  elixir: "FULL HP AND MP, CURES POISON",
  bomb: `${BOMB_DAMAGE} DAMAGE, IGNORES DEFENSE`,
  sword: equipInfo("sword"),
  shield: equipInfo("shield"),
  ironSword: equipInfo("ironSword"),
  ironShield: equipInfo("ironShield"),
  amulet: equipInfo("amulet"),
  mythrilSword: equipInfo("mythrilSword"),
  mythrilShield: equipInfo("mythrilShield"),
  antidoteCharm: equipInfo("antidoteCharm"),
  emberRing: equipInfo("emberRing"),
  lifeCharm: equipInfo("lifeCharm"),
  talisman: equipInfo("talisman"),
  glacierMail: equipInfo("glacierMail"),
  drakeBlade: equipInfo("drakeBlade"),
  ...materialInfo,
};
