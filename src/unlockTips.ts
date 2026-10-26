import type Phaser from "phaser";
import { abyssOpen } from "./abyss";
import { arenaOpen } from "./arena";
import { MATERIAL_KEYS } from "./drops";
import { GameState } from "./gameState";
import { showToast } from "./pixelart";
import { isWet, weatherToday } from "./weather";

// One-time tips: the first time something opens up (or a kind of day first
// comes round), a toast says so once, instead of the news living only in the
// ELDER's lines. What has been shown is saved (GameState.seenTips), so a
// re-entered scene or a reloaded save never repeats one.
//
// A new tip is one row: `place` is the scene that shows it (every region
// entrance, the arena and the BLACKSMITH are in town), `when` the moment it
// becomes true. Materials drop in battle, so that tip waits for the walk back.
// Each line ends in "!" so the toast queue treats it as news (pixelart.ts
// supersedes()) and never lets a tip replace another. At retroStyle(5),
// 20px a glyph, the longest (44 glyphs, 880px) sits at x 200..1080.
// Town events need no row: TownScene already announces each event day.
export type TipPlace = "town" | "snow";

interface UnlockTip {
  id: string;
  place: TipPlace;
  text: string;
  when: () => boolean;
}

export const UNLOCK_TIPS: UnlockTip[] = [
  { id: "arena", place: "town", text: "THE ARENA IS NOW OPEN IN TOWN!", when: arenaOpen },
  { id: "forest", place: "town", text: "THE FOREST GATE IS OPEN!", when: () => GameState.quest.bossDefeated },
  { id: "snow", place: "town", text: "THE SNOW PASS IS OPEN!", when: () => GameState.quest.forestBoss },
  { id: "volcano", place: "town", text: "THE VOLCANO IS OPEN!", when: () => GameState.quest.snowBoss },
  { id: "ngplus", place: "town", text: "NEW GAME+ IS OPEN: PRESS P ON THE TITLE!", when: () => GameState.quest.volcanoBoss },
  { id: "abyss", place: "town", text: "THE ABYSS OPENS DEEP IN THE CAVE!", when: () => abyssOpen(GameState.quest, GameState.ngPlus) },
  {
    id: "material",
    place: "town",
    text: "YOU FOUND A MATERIAL: VISIT THE BLACKSMITH!",
    when: () => MATERIAL_KEYS.some((k) => GameState.inventory[k] > 0),
  },
  // The bag's CANDY says what it's for only in the item window, and the
  // battle's item row shows no description, so a first CANDY (a field drop
  // or the shop) says it here — unless the hero has already caught one.
  {
    id: "candy",
    place: "town",
    text: "CANDY CATCHES A WEAK MONSTER: IT JOINS YOU!",
    when: () => GameState.inventory.candy > 0 && GameState.caught.length === 0,
  },
  // The first harvest or catch says "+1 BEAN TO COOK" but not where: HOME's
  // Z opens the kitchen (ui/HomeUI.ts). Shown once the farm or pond panel
  // closes, as every tip waits for open panels.
  {
    id: "pantry",
    place: "town",
    text: "YOU HAVE FOOD: COOK IT AT HOME (Z)!",
    when: () => !GameState.meal && Object.values(GameState.pantry).some((n) => n > 0),
  },
  { id: "rain", place: "town", text: "RAINY DAY: FISH BITE FASTER, CROPS PAY MORE!", when: () => isWet(weatherToday("town")) },
  { id: "blizzard", place: "snow", text: "BLIZZARD: THE ICE HOLE BITES SLOWER!", when: () => weatherToday("snow") === "blizzard" },
];

/**
 * Shows the next unseen tip for `place` whose moment has come, at most one a
 * call so a burst (the arena and the forest open together) queues a second
 * apart. A save from before the tips (seenTips null) is first seeded with
 * everything already true — or with every tip in NEW GAME+, which has seen
 * them all — and shows nothing. True when seenTips changed, so the caller
 * saves (quietly, like a claimed achievement).
 */
export function showUnlockTip(scene: Phaser.Scene, place: TipPlace, y: number): boolean {
  if (GameState.seenTips === null) {
    GameState.seenTips = UNLOCK_TIPS.filter((t) => GameState.ngPlus > 0 || t.when()).map((t) => t.id);
    return true;
  }
  const seen = GameState.seenTips;
  const tip = UNLOCK_TIPS.find((t) => t.place === place && !seen.includes(t.id) && t.when());
  if (!tip) return false;
  seen.push(tip.id);
  showToast(scene, tip.text, y);
  return true;
}
