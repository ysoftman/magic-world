import type Phaser from "phaser";
import { abyssOpen } from "./abyss";
import { arenaOpen } from "./arena";
import { MATERIAL_KEYS } from "./drops";
import { fieldOpen } from "./fieldGates";
import { GameState } from "./gameState";
import { showToast } from "./pixelart";
import { keyNames } from "./ui/Gamepad";
import { isWet, weatherToday } from "./weather";

// One-time tips: the first time something opens up (or a kind of day first
// comes round), a toast says so once, instead of the news living only in the
// ELDER's lines. What has been shown is saved (GameState.seenTips), so a
// re-entered scene or a reloaded save never repeats one. A tip is seen as
// its toast goes up, not as it is handed over: on a day with much news the
// toast row drops the oldest line waiting (pixelart.ts TOAST_MAX_WAITING),
// and a tip dropped there, or left waiting as the hero walked out of town,
// was marked seen and never said (the CANDY's, behind eight other lines;
// for a field's tip the journal's line then stood unexplained).
//
// A new tip is one row: `place` is the scene that shows it (every region
// entrance, the arena and the BLACKSMITH are in town), `when` the moment it
// becomes true. Materials drop in battle, so that tip waits for the walk back.
// Each line ends in "!" so the toast queue treats it as news (pixelart.ts
// supersedes()) and never lets a tip replace another. At retroStyle(5),
// 20px a glyph, the longest (44 glyphs, 880px) sits at x 200..1080. A tip
// naming a key reads it when it shows (a getter), so with a pad in use it
// names the button: "PRESS LT ON THE TITLE!" (41 glyphs), "AT HOME (A)!".
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
  {
    id: "ngplus",
    place: "town",
    get text() {
      return `HARD MODE IS OPEN: PRESS ${keyNames("P", "title")} ON THE TITLE!`;
    },
    when: () => GameState.quest.volcanoBoss,
  },
  { id: "abyss", place: "town", text: "THE ABYSS OPENS: A GATE BY THE CAVE!", when: () => abyssOpen(GameState.quest, GameState.ngPlus) },
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
    get text() {
      return `YOU HAVE FOOD: COOK IT AT HOME (${keyNames("Z")})!`;
    },
    when: () => !GameState.meal && Object.values(GameState.pantry).some((n) => n > 0),
  },
  // What the fields hold besides fights, which nothing in town says: each
  // told as it opens (fieldGates.ts), the shards once the first fights are
  // won and the rest a boss apart, after that boss's own region tip above.
  // The quest journal's and the fields' lines for each wait on its tip
  // (tipTold below). 32, 42, 42 and 44 glyphs.
  { id: "shards", place: "town", text: "STAR SHARDS HIDE IN EVERY FIELD!", when: () => fieldOpen("shards") },
  { id: "nests", place: "town", text: "NESTS OPEN AND ELITE FOES ROAM THE FIELDS!", when: () => fieldOpen("nest") },
  { id: "seals", place: "town", text: "SEALS WAKE AND A PEDDLER ROAMS THE FIELDS!", when: () => fieldOpen("seal") },
  { id: "omens", place: "town", text: "A DAILY OMEN MARKS A FIELD: SEE THE JOURNAL!", when: () => fieldOpen("omen") },
  { id: "rain", place: "town", text: "RAINY DAY: FISH BITE FASTER, CROPS PAY MORE!", when: () => isWet(weatherToday("town")) },
  { id: "blizzard", place: "snow", text: "BLIZZARD: THE ICE HOLE BITES SLOWER!", when: () => weatherToday("snow") === "blizzard" },
];

// A save from when one tip ("fields", at 3 wins) told of the shards and the
// seals together, and wins alone opened the rest: it has had that news, so
// what is open for it now is told already, and only what a boss still to
// fall opens will be news.
const OLD_FIELDS_TIP = "fields";
const FIELD_TIPS = ["shards", "nests", "seals", "omens"];

function carryOldTips(seen: string[]): void {
  const at = seen.indexOf(OLD_FIELDS_TIP);
  if (at < 0) return;
  const open = UNLOCK_TIPS.filter((t) => FIELD_TIPS.includes(t.id) && !seen.includes(t.id) && t.when()).map((t) => t.id);
  seen.splice(at, 1, ...open);
}

/**
 * Whether the town's tip `id` has been shown: what the quest journal's and
 * the fields' lines on the shards, the seals, the PEDDLER and the omen wait
 * for, so none names a thing no word has. A save from before the tips
 * (seenTips null) has seen all that is true for it.
 */
export function tipTold(id: string): boolean {
  const seen = GameState.seenTips;
  if (seen === null) return UNLOCK_TIPS.find((t) => t.id === id)?.when() ?? false;
  carryOldTips(seen);
  return seen.includes(id);
}

// a tip's toast went up since the last showUnlockTip: seenTips is to be saved
let toldSince = false;

/**
 * Hands the toast row the next unseen tip for `place` whose moment has come,
 * one at a time: the same tip each call until its toast is up (the row keeps
 * one line of a text, so a tip still waiting stays where it is, and one the
 * row dropped waits again), then the next, so a burst (the arena and the
 * forest open together) comes a toast apart. A save from before the tips
 * (seenTips null) is first seeded with everything already true — or with
 * every tip in HARD MODE, which has seen them all — and shows nothing. True
 * when seenTips changed (a tip's toast went up since the last call), so the
 * caller saves (quietly, like a claimed achievement).
 */
export function showUnlockTip(scene: Phaser.Scene, place: TipPlace, y: number): boolean {
  if (GameState.seenTips === null) {
    GameState.seenTips = UNLOCK_TIPS.filter((t) => GameState.ngPlus > 0 || t.when()).map((t) => t.id);
    return true;
  }
  const seen = GameState.seenTips;
  carryOldTips(seen);
  const tip = UNLOCK_TIPS.find((t) => t.place === place && !seen.includes(t.id) && t.when());
  if (tip) {
    const { id } = tip;
    showToast(scene, tip.text, y, () => {
      // (a toast a panel took down goes up again; a save loaded since has its own list)
      const now = GameState.seenTips;
      if (!now || now.includes(id)) return;
      now.push(id);
      toldSince = true;
    });
  }
  const told = toldSince;
  toldSince = false;
  return told;
}
