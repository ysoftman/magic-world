import { ABYSS_FLOOR_MAX } from "./abyss";
import { MAX_GOLD, MAX_HP, MAX_LEVEL, MAX_MP } from "./config";
import { loadMeal, loadPantry, type Meal, newPantry } from "./cooking";
import { type CraftedKey, MATERIAL_KEYS, type MaterialKey, RECIPES } from "./drops";
import { MAX_HOUSE } from "./home";
import { CATCHABLE, type EnemyDef } from "./monsters";
import { recordRank } from "./ranking";
import { loadTreasureMaps, type TreasureMap } from "./treasure";

// bounty board eligibility: these only roam the forest/snow fields, which
// stay locked behind the same quest flags TownScene already gates them on
const FOREST_BOUNTY_MONSTERS = new Set(["WASP", "SPIDER", "ORC"]);
const SNOW_BOUNTY_MONSTERS = new Set(["FROST MOTH", "YETI"]);
// ...and these only the volcano, which opens once the GLACIER GOLEM falls
const VOLCANO_BOUNTY_MONSTERS = new Set(["MAGMA SLIME", "FIRE IMP", "SALAMANDER"]);
// HUNTER's fourth job wants one of each of the same volcano roster
export const FIRE_BEASTS = [...VOLCANO_BOUNTY_MONSTERS];
// bounty gold reward as a multiple of the target's own kill-gold value —
// sized against HUNTER's existing fixed bounties (roughly 0.8x-1.9x raw
// kill value once their item bonuses are folded in), biased to the high
// end since a rotating bounty can't attach a themed item like HUNTER's do
const BOUNTY_MULT = 1.5;

export interface PlayerState {
  name: string;
  level: number;
  exp: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  def: number;
}

// a count per monster material (drops.ts) rides along with the items
export interface InventoryState extends Record<MaterialKey, number> {
  potion: number;
  mPotion: number;
  candy: number;
  hiPotion: number;
  ether: number;
  elixir: number;
  bomb: number;
  sword: number;
  shield: number;
  ironSword: number;
  ironShield: number;
  amulet: number;
  mythrilSword: number;
  mythrilShield: number;
  antidoteCharm: number;
  emberRing: number;
  // forged by the BLACKSMITH (drops.ts RECIPES), never sold in the shop
  lifeCharm: number;
  talisman: number;
  glacierMail: number;
  drakeBlade: number;
}

export type EquipSlot = "weapon" | "armor" | "accessory";
export type EquipmentKey =
  | "sword"
  | "shield"
  | "ironSword"
  | "ironShield"
  | "amulet"
  | "mythrilSword"
  | "mythrilShield"
  | "antidoteCharm"
  | "emberRing"
  | CraftedKey;

export const EQUIP_SLOT: Record<EquipmentKey, EquipSlot> = {
  sword: "weapon",
  ironSword: "weapon",
  mythrilSword: "weapon",
  shield: "armor",
  ironShield: "armor",
  mythrilShield: "armor",
  amulet: "accessory",
  antidoteCharm: "accessory",
  emberRing: "accessory",
  lifeCharm: "accessory",
  talisman: "accessory",
  glacierMail: "armor",
  drakeBlade: "weapon",
};

// One table per equipment property, so adding a tier is one line each instead
// of a new branch in effAtk/effDef and in every scene's overlay code.
export const EQUIP_BONUS: Record<EquipmentKey, number> = {
  sword: 2,
  ironSword: 4,
  mythrilSword: 6,
  shield: 2,
  ironShield: 4,
  mythrilShield: 6,
  amulet: 0,
  antidoteCharm: 0,
  emberRing: 0,
  // the forged tier: two over MYTHRIL, and the one place to tune it (balance
  // audit) — enough to be worth the hunt, not enough to skip NEW GAME+
  lifeCharm: 0,
  talisman: 0,
  glacierMail: 8,
  drakeBlade: 8,
};

export const EQUIP_TEXTURE: Record<EquipmentKey, string> = {
  sword: "equip-sword",
  ironSword: "equip-iron-sword",
  mythrilSword: "equip-mythril-sword",
  shield: "equip-shield",
  ironShield: "equip-iron-shield",
  mythrilShield: "equip-mythril-shield",
  amulet: "equip-sword", // accessory: never drawn as an overlay
  antidoteCharm: "equip-sword", // accessory: never drawn as an overlay
  emberRing: "equip-sword", // accessory: never drawn as an overlay
  lifeCharm: "equip-sword", // accessory: never drawn as an overlay
  talisman: "equip-sword", // accessory: never drawn as an overlay
  // baked at runtime by the BLACKSMITH panel (ui/Blacksmith.ts), which Town
  // builds before any scene can draw a worn weapon or armor
  glacierMail: "equip-glacier-mail",
  drakeBlade: "equip-drake-blade",
};

// Max HP a worn piece adds (GameState.effMaxHp). Partial: only these carry
// one; LIFE CHARM doubles the AMULET's, the same accessory-slot trade as the
// resist charms.
export const EQUIP_MAXHP: Partial<Record<EquipmentKey, number>> = {
  amulet: 10,
  lifeCharm: 20,
};

// Status immunities a worn piece grants against enemy specials. Partial: only
// the resist accessories carry them. The accessory slot holds one item, so a
// charm or ring is a trade against the AMULET's +10 max HP.
export type ResistKind = "poison" | "freeze";
export const RESIST_KINDS: ResistKind[] = ["poison", "freeze"];
export const EQUIP_RESIST: Partial<Record<EquipmentKey, ResistKind[]>> = {
  antidoteCharm: ["poison"], // the forest's WASP/SPIDER
  emberRing: ["freeze"], // the snow field's FROST MOTH/YETI/GLACIER GOLEM
  talisman: ["poison", "freeze"], // forged: both at once
};

// every count added since the first saves — materials and forged gear — so
// a fresh state, reset() and an old save's load all fill the same keys
const LATER_INVENTORY_KEYS = [...MATERIAL_KEYS, ...RECIPES.map((r) => r.key)];
const laterInventory = (from?: Record<string, unknown>): Record<(typeof LATER_INVENTORY_KEYS)[number], number> =>
  Object.fromEntries(LATER_INVENTORY_KEYS.map((k) => [k, typeof from?.[k] === "number" ? (from[k] as number) : 0])) as Record<
    (typeof LATER_INVENTORY_KEYS)[number],
    number
  >;

export const FARM_PLOTS = 4;

export interface CropDef {
  name: string;
  seed: number;
  // in-game minutes from planting to harvest (GameState.minutes); for a
  // nightOnly crop, minutes of night
  grow: number;
  min: number;
  max: number;
  // only grows while isNight(), on farmNightMinutes (see cropClock())
  nightOnly?: boolean;
}

// Crops pay out at roughly the same rate per in-game hour they hold a plot
// (~6G); CORN is the bigger single payout for a full day's wait, BEAN the fast
// turnaround. MOONFLOWER grows through 8 of the 10 night hours, so it's priced
// as one harvest per 24h — plant it by 22:00 and it's ready by dawn. PUMPKIN
// runs a little hot on purpose (~6.5G/h): it ties up 60G and a plot for a
// whole day, longer than anything else, and the premium is what pays for that.
// One entry per CropKey, same table-per-property convention as EQUIP_BONUS.
export const CROPS = {
  corn: { name: "CORN", seed: 20, grow: 480, min: 55, max: 80 },
  bean: { name: "BEAN", seed: 8, grow: 180, min: 20, max: 30 },
  pumpkin: { name: "PUMPKIN", seed: 60, grow: 1440, min: 190, max: 240 },
  moonflower: { name: "MOONFLOWER", seed: 25, grow: 480, min: 150, max: 190, nightOnly: true },
} satisfies Record<string, CropDef>;

export type CropKey = keyof typeof CROPS;

export interface FarmPlot {
  crop: CropKey;
  // the crop's farm clock at planting (cropClock): GameState.farmMinutes, or
  // farmNightMinutes for a night-only crop
  plantedAt: number;
}

// isNight()'s window (before 06:00, from 20:00) laid over GameState.minutes,
// which never wraps: the night time between two moments is plain arithmetic,
// and sleeping through the night (rest() jumping the clock to dawn) counts as
// night time like any other.
const DAWN = 6 * 60;
const DUSK = 20 * 60;
const NIGHT_PER_DAY = DAWN + 1440 - DUSK;

function nightMinutesBefore(t: number): number {
  const day = Math.floor(t / 1440);
  const r = t - day * 1440;
  return day * NIGHT_PER_DAY + Math.min(r, DAWN) + Math.max(0, r - DUSK);
}

// TIME SPEED is a viewing preference — how fast the sky turns — so it must not
// pay. Crops grow on the farm's own clocks, which run with GameState.minutes
// divided by the TIME SPEED of the moment (see the minutes setter): a game
// minute per game minute at NORMAL, 1/speed of one at FAST / VERY FAST, so a
// crop takes the same real time whatever the setting, and switching the
// speed mid-growth only ever counts each minute at the speed it passed at. A
// night slept through counts the same way (its skipped minutes / speed), or
// VERY FAST's night every 72s would sleep crops ripe 20 times as often.
// farmNightMinutes is the same over the night's minutes alone, for the
// night-only crops. Before this, a field of PUMPKINs slept on every night
// paid ~51k G an hour at x20 and the best mix ~77k (x5: ~21k), against ~4k at
// NORMAL; now ~3-4k at every speed (at x20 a sleep saves less waiting than
// the walk home costs). NORMAL's numbers are unchanged.
export function cropClock(crop: CropKey): number {
  const def: CropDef = CROPS[crop];
  return def.nightOnly ? GameState.farmNightMinutes : GameState.farmMinutes;
}

// growth so far, in the unit of its crop's `grow`
export function cropGrowth(plot: FarmPlot): number {
  return cropClock(plot.crop) - plot.plantedAt;
}

// 0 at planting, 1 once harvestable — what the field sprite and panel read
export function cropProgress(plot: FarmPlot): number {
  return cropGrowth(plot) / CROPS[plot.crop].grow;
}

// game minutes still to wait, at the current TIME SPEED (for a night-only
// crop, minutes of night)
export function cropLeft(plot: FarmPlot): number {
  return (CROPS[plot.crop].grow - cropGrowth(plot)) * GameState.timeSpeed;
}

// GameState.minutes at which the plot becomes harvestable if the speed stays
// as it is. A plain countdown would lie for a night crop (two hours left at
// 05:00 really means 21:00), so the farm panel shows this clock time for
// those instead.
export function cropReadyAt(plot: FarmPlot): number {
  const def: CropDef = CROPS[plot.crop];
  const now = GameState.minutes;
  if (!def.nightOnly) return now + cropLeft(plot);
  const target = nightMinutesBefore(now) + cropLeft(plot);
  const day = Math.floor(target / NIGHT_PER_DAY);
  const r = target - day * NIGHT_PER_DAY;
  return day * 1440 + (r <= DAWN ? r : DUSK + r - DAWN);
}

export interface FishDef {
  name: string;
  min: number;
  max: number;
  // a weight, not a probability: the bite roll sums the weights of whatever
  // can bite right now, so a night-only species adds to the table at night
  // instead of eating into the day fish's odds
  chance: number;
  // top-tier catches also grant a consumable, on top of the gold roll
  bonusItem?: "potion" | "hiPotion";
  // only bites while isNight() — the reason to fish after 20:00
  night?: boolean;
}

// Lives here next to CROPS rather than in the fishing panel so the panel,
// fishLogged() and the achievements all count the same species list.
export const POND_FISH: FishDef[] = [
  { name: "MINNOW", min: 5, max: 10, chance: 0.45 },
  { name: "PERCH", min: 12, max: 20, chance: 0.3 },
  { name: "TROUT", min: 25, max: 40, chance: 0.17 },
  { name: "GOLDEN FISH", min: 80, max: 120, chance: 0.08, bonusItem: "potion" },
  // ~9% of night bites; worth more than a TROUT, less than the GOLDEN FISH
  // that it never replaces
  { name: "MOON EEL", min: 45, max: 70, chance: 0.1, night: true },
];

// same odds/value curve as the town pond — the snow field isn't meant to be
// strictly better, just re-themed — except the top tier gives a HI-POTION
// instead of a POTION, matching how victory() already rewards boss kills
// richer than regular ones
export const ARCTIC_FISH: FishDef[] = [
  { name: "ICE SHRIMP", min: 5, max: 10, chance: 0.45 },
  { name: "FROST PERCH", min: 12, max: 20, chance: 0.3 },
  { name: "GLACIER TROUT", min: 25, max: 40, chance: 0.17 },
  { name: "AURORA KOI", min: 80, max: 120, chance: 0.08, bonusItem: "hiPotion" },
  { name: "GHOST ICEFISH", min: 45, max: 70, chance: 0.1, night: true },
];

export const ALL_FISH: FishDef[] = [...POND_FISH, ...ARCTIC_FISH];

export interface QuestState {
  slimes: number;
  goldenSlimes: number;
  wispsDefeated: number;
  comboCapped: boolean;
  slimeReward: boolean;
  bossDefeated: boolean;
  finalReward: boolean;
  forestBoss: boolean;
  forestReward: boolean;
  bestiaryReward: boolean;
  // post-game superboss in the SNOW FIELD, unlocked after the MOSS GOLEM falls
  snowBoss: boolean;
  snowReward: boolean;
  // the last region: the VOLCANO, opened once the GLACIER GOLEM falls
  volcanoBoss: boolean;
  volcanoReward: boolean;
  // the TROLL KING beaten (or caught) in a fight of its own: no story hangs
  // on it, it's what puts the giant in the ARENA lineup (arena.ts)
  trollDefeated: boolean;
  // HUNTER side quests: first a kill bounty (4 bats), then a collection
  // bounty (any 3 catches past the snapshot taken when it was accepted)
  hunterBatsAccepted: boolean;
  batsSlain: number;
  hunterBatsReward: boolean;
  hunterCatchAccepted: boolean;
  caughtAtAccept: number;
  hunterCatchReward: boolean;
  // third HUNTER bounty, offered once the forest boss falls and opens the
  // snow pass: a kill bounty against the SNOW FIELD's YETIs
  hunterYetiAccepted: boolean;
  yetisSlain: number;
  hunterYetiReward: boolean;
  // fourth HUNTER bounty, offered once the volcano opens and the yeti job is
  // paid: one of each FIRE_BEASTS species caught after accepting, read off
  // `caught` past this snapshot the way the catch job reads caughtAtAccept
  hunterFireAccepted: boolean;
  fireCaughtAtAccept: number;
  hunterFireReward: boolean;
}

// daily bounty board: unlike HUNTER's fixed chain, this rerolls a random
// target every in-game day. `have` is never capped at increment time (same
// unbounded-then-clamp-at-display convention as batsSlain/yetisSlain above).
export interface BountyState {
  target: string; // an ENEMIES[...].name
  need: number;
  have: number;
  reward: number;
  day: number; // econDay() at roll time — compared to detect a new day
  claimed: boolean;
}

// the townsfolk's favor chains (favors.ts): per villager, how many steps are
// done, whether the current one was taken on, and the counter it was taken
// on at (crops harvested, fish caught...), so only progress after that counts
export type VillagerKey = "farmer" | "fisher" | "traveler";
export interface FavorState {
  step: number;
  accepted: boolean;
  snap: number;
}
const newFavors = (): Record<VillagerKey, FavorState> => ({
  farmer: { step: 0, accepted: false, snap: 0 },
  fisher: { step: 0, accepted: false, snap: 0 },
  traveler: { step: 0, accepted: false, snap: 0 },
});

// the board's daily material delivery (delivery.ts): what today asks for,
// frozen on the first look of the day, and whether it was handed in
export interface DeliveryState {
  day: number; // econDay() it was posted on
  material: MaterialKey;
  need: number;
  done: boolean;
}

// Three save slots, each under its own key; which one is in use lives in
// the settings, so the game reopens on it. Before slots there was one save
// under LEGACY_SAVE_KEY: migrateLegacySave() moves it into slot 1.
export const SAVE_SLOTS = 3;
const LEGACY_SAVE_KEY = "magic-world-save";
const SETTINGS_KEY = "magic-world-settings";
const slotKey = (slot: number): string => `${LEGACY_SAVE_KEY}-${slot}`;
// The title's name prompt takes 12 glyphs, and the save card, the HUD and
// the rank board are sized for that. A save code can carry any string, so
// load() and the card's summary cut it to the same length.
const NAME_MAX = 12;
const clampSlot = (v: unknown): number => (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= SAVE_SLOTS ? v : 1);

/**
 * Moves the pre-slot save into a slot, losing nothing and safe to run on
 * every boot. The old key is only removed once a slot reads back the very
 * same text, so a failed write (storage full) keeps the original for the
 * next try. It goes to slot 1 unless slot 1 already holds a different save
 * (an old tab saving after the update) — then to the first empty slot, and
 * with none free it stays where it is, untouched.
 */
export function migrateLegacySave(): void {
  try {
    const legacy = localStorage.getItem(LEGACY_SAVE_KEY);
    if (legacy === null) return;
    // the first slot, from 1, that is free or already holds this very save
    let target = 0;
    for (let slot = 1; slot <= SAVE_SLOTS; slot++) {
      const held = localStorage.getItem(slotKey(slot));
      if (held === null || held === legacy) {
        target = slot;
        break;
      }
    }
    if (!target) return;
    if (localStorage.getItem(slotKey(target)) === null) localStorage.setItem(slotKey(target), legacy);
    if (localStorage.getItem(slotKey(target)) === legacy) localStorage.removeItem(LEGACY_SAVE_KEY);
  } catch {
    // storage unavailable or full: leave everything as it was
  }
}

// Each slot keeps its last overwritten save under one backup key (only the
// one, for the space), written just before NEW GAME / NEW GAME+ / IMPORT
// replace the slot; restoreSave() swaps it back. A slot that won't parse is
// never just dropped: its bytes are parked under a timestamped "-corrupt"
// key first, one per incident, so nothing damaged is ever overwritten.
// The title lists and deletes them (damagedCopyKeys/deleteDamagedCopies).
const backupKey = (slot: number): string => `${slotKey(slot)}-prev`;
const corruptPrefix = (slot: number): string => `${slotKey(slot)}-corrupt-`;
const corruptKey = (slot: number): string => `${corruptPrefix(slot)}${Date.now()}`;

const parses = (raw: string): boolean => {
  try {
    JSON.parse(raw);
    return true;
  } catch {
    return false;
  }
};

// writes and reads back: false (and the key as it was) when storage refuses
function writeVerified(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return localStorage.getItem(key) === value;
  } catch {
    return false;
  }
}

// Removes a slot's save, parking it first if it doesn't parse. false (slot
// untouched) when the parking copy couldn't be written.
function dropSlot(slot: number): boolean {
  const raw = localStorage.getItem(slotKey(slot));
  if (raw === null) return true;
  if (!parses(raw) && !writeVerified(corruptKey(slot), raw)) return false;
  localStorage.removeItem(slotKey(slot));
  return true;
}

const saveListeners: Array<() => void> = [];
const saveFailListeners: Array<() => void> = [];

// GameState.save() hit a full (or blocked) storage: the game carries on with
// what's in memory, and whoever listens tells the player. Returns an
// unsubscribe function, like onSaved().
export function onSaveFailed(callback: () => void): () => void {
  saveFailListeners.push(callback);
  return () => {
    const i = saveFailListeners.indexOf(callback);
    if (i >= 0) saveFailListeners.splice(i, 1);
  };
}

// Lets scenes show a "SAVED" toast without GameState.save() needing any
// reference to a Phaser scene. Returns an unsubscribe function.
export function onSaved(callback: () => void): () => void {
  saveListeners.push(callback);
  return () => {
    const i = saveListeners.indexOf(callback);
    if (i >= 0) saveListeners.splice(i, 1);
  };
}

// The L²/2 term keeps pace with monster EXP, which grows ~16x from the cave
// to the volcano: on the old linear 10 + 10L a hero who fought ~15 battles a
// region reached each superboss 4-6 levels over its intended level and hit
// Lv30 before the FLAME DRAKE, leaving NEW GAME+ nothing to grow into. Now the
// same pace meets KING/MOSS/GLACIER/DRAKE near Lv 6/11/18/24 and ends the
// first run around Lv25. Never below the old curve, so an old save's exp
// can't already exceed its level's requirement.
export const expToNext = (level: number): number => 10 + level * 10 + Math.round((level * level) / 2);

export function hour(): number {
  return Math.floor(GameState.minutes / 60) % 24;
}

export function minute(): number {
  return Math.floor(GameState.minutes) % 60;
}

export function clock(): string {
  return `${String(hour()).padStart(2, "0")}:${String(minute()).padStart(2, "0")}`;
}

// GameState.minutes never wraps on its own (only hour()/minute() do, via %) —
// this is the same /1440 divisor rest() already uses to roll to next dawn
export function dayIndex(): number {
  return Math.floor(GameState.minutes / 1440);
}

// The calendar day: the farm's clock (farmMinutes, game minutes / TIME
// SPEED) in days, so a day takes a NORMAL day of real time — 24 minutes —
// at every speed. At NORMAL it is dayIndex(); at VERY FAST the sky turns 20
// days in one of these. What a day hands out (the BOUNTY BOARD's bounty and
// delivery, the herb garden) and what colours it (the town events, the
// weather) all go by it: TIME SPEED is a toggle anyone can flip, and on
// dayIndex() a rain or market day could be pulled up at x20 in minutes and
// used at NORMAL for a real 24. Only the season (season.ts) and the
// ending's DAY count the days the hero saw, dayIndex().
export function econDay(): number {
  return Math.floor(GameState.farmMinutes / 1440);
}

export function isNight(): boolean {
  const h = hour();
  return h < 6 || h >= 20;
}

export function nightFactor(): number {
  const h = hour() + minute() / 60;
  if (h >= 6.0 && h < 19.5) return 0;
  if (h >= 20.0 || h < 5.5) return 1;
  if (h < 6.0) return 1 - (h - 5.5) / 0.5;
  return (h - 19.5) / 0.5;
}

export const TEXT_SPEEDS = [0.5, 1, 2];
// multiplies how fast GameState.minutes advances (day/night, bounty-board
// day rollover) — a local display preference like textSpeed, not save state
export const TIME_SPEEDS = [1, 5, 20];
// divides every battle animation's duration (NORMAL / FAST / FASTER) — a
// display preference like the two above, see BattleScene.anim()
export const BATTLE_SPEEDS = [1, 1.5, 2];

const clampVolume = (v: unknown): number => (typeof v === "number" && v >= 0 && v <= 1 ? Math.round(v * 10) / 10 : 1);

// NEW GAME+ enemy scaling per cycle. A cleared hero starts NG+ near the level
// cap in the best gear, so +50% HP/ATK a cycle is what keeps the bosses a
// fight; EXP/gold only +25%, since EXP stops mattering at the cap and gold is
// capped too. Stops growing after the third cycle: past that the FLAME DRAKE's
// night HP would run to four digits, wider than the battle HP line allows for.
const NG_STAT_STEP = 0.5;
const NG_LOOT_STEP = 0.25;
const NG_SCALE_CAP = 3;
// Quest fields that are lifetime records rather than chapter progress, so
// NEW GAME+ keeps them: the achievement counters, and the bestiary reward,
// which follows the catch record that is kept (it would otherwise pay out a
// second time for catches made last cycle).
const NG_KEEP_QUEST = ["goldenSlimes", "wispsDefeated", "comboCapped", "bestiaryReward"] as const;

export const GameState = {
  player: {
    name: "HERO",
    level: 1,
    exp: 0,
    hp: 30,
    maxHp: 30,
    mp: 10,
    maxMp: 10,
    atk: 6,
    def: 2,
  } as PlayerState,
  gold: 0,
  battles: 0,
  streak: 0,
  fishCaught: 0,
  // fish log: species name -> the best value rolled for it. A key's presence
  // is the "caught at least once" flag, so there's no second list to drift.
  fishLog: {} as Record<string, number>,
  cropsHarvested: 0,
  // GOLDEN harvests (the farm panel's rare payout multiplier), for its achievement
  goldenHarvests: 0,
  // ARENA record: the most bouts won in one run (see arena.ts)
  arenaBest: 0,
  // ABYSS record: the deepest floor reached, B1 = 1 (see abyss.ts)
  abyssBest: 0,
  // the floor past the deepest GUARDIAN beaten (B6, B11...), where a dive may
  // start instead of B1; 0 for none (abyss.ts)
  abyssCheckpoint: 0,
  // the floor last left by its stair up to town, where the next dive may
  // pick up (B2 and down); 0 for none. Gone once used or on a fall down
  // there (abyss.ts)
  abyssPortal: 0,
  // ingredients from the farm and the pond, and the meal cooked from them
  // that the next battles are fought on (cooking.ts)
  pantry: newPantry(),
  meal: null as Meal | null,
  // treasure maps held (treasure.ts), at most MAX_MAPS, and how many were dug
  treasureMaps: [] as TreasureMap[],
  mapsDug: 0,
  // HOME's extensions built, 0..MAX_HOUSE (home.ts); the econDay() its herb
  // garden last gave on (-1: never); WELL RESTED, set by a rest at HOME with
  // the FEATHER BEDS and spent by the next battle
  houseLevel: 0,
  gardenDay: -1,
  rested: false,
  // the season (season.ts, counted from day 0) the town last announced,
  // -1 for none yet, so a reload doesn't announce it again
  seasonSeen: -1,
  farm: Array.from({ length: FARM_PLOTS }, () => null) as Array<FarmPlot | null>,
  achievements: [] as string[],
  inventory: {
    potion: 2,
    mPotion: 1,
    candy: 0,
    hiPotion: 0,
    ether: 0,
    elixir: 0,
    bomb: 0,
    sword: 0,
    shield: 0,
    ironSword: 0,
    ironShield: 0,
    amulet: 0,
    mythrilSword: 0,
    mythrilShield: 0,
    antidoteCharm: 0,
    emberRing: 0,
    ...laterInventory(),
  } as InventoryState,
  equipped: { weapon: null, armor: null, accessory: null } as Record<EquipSlot, EquipmentKey | null>,
  caught: [] as string[],
  seenMonsters: [] as string[],
  companion: null as string | null,
  // combat rounds fought alongside each companion species, by name (one per
  // companionAttack() call, so a long fight grows bond faster than a string
  // of one-shot kills) — grows a small permanent ATK bonus, see
  // companionBondBonus
  companionBond: {} as Record<string, number>,
  openedTreasures: [] as string[],
  quest: {
    slimes: 0,
    goldenSlimes: 0,
    wispsDefeated: 0,
    comboCapped: false,
    slimeReward: false,
    bossDefeated: false,
    finalReward: false,
    forestBoss: false,
    forestReward: false,
    bestiaryReward: false,
    snowBoss: false,
    snowReward: false,
    volcanoBoss: false,
    volcanoReward: false,
    trollDefeated: false,
    hunterBatsAccepted: false,
    batsSlain: 0,
    hunterBatsReward: false,
    hunterCatchAccepted: false,
    caughtAtAccept: 0,
    hunterCatchReward: false,
    hunterYetiAccepted: false,
    yetisSlain: 0,
    hunterYetiReward: false,
    hunterFireAccepted: false,
    fireCaughtAtAccept: 0,
    hunterFireReward: false,
  } as QuestState,
  bounty: null as BountyState | null,
  delivery: null as DeliveryState | null,
  favors: newFavors(),
  // The clock, behind an accessor so the farm's clocks (cropClock) can't miss
  // a minute: whatever moves it forward — a scene's tick, a night's sleep —
  // also moves them by the same span / TIME SPEED. Only reset() and load()
  // put it anywhere else, and they write _minutes and the farm's clocks
  // themselves.
  _minutes: 360,
  get minutes(): number {
    return this._minutes;
  },
  set minutes(to: number) {
    const from = this._minutes;
    this._minutes = to;
    if (to <= from) return;
    this.farmMinutes += (to - from) / this.timeSpeed;
    this.farmNightMinutes += (nightMinutesBefore(to) - nightMinutesBefore(from)) / this.timeSpeed;
  },
  // the farm's clocks (cropClock): game minutes / TIME SPEED, all of them
  // and the night's alone; a new game starts them level with the clock. The
  // first is also the daily rewards' calendar (econDay).
  farmMinutes: 360,
  farmNightMinutes: nightMinutesBefore(360),
  pos: undefined as { x: number; y: number } | undefined,
  // NEW GAME+ cycle: 0 on a first playthrough, +1 each time a cleared save
  // starts over (beginNewGamePlus). enemyScale() turns it into multipliers.
  ngPlus: 0,
  // ids of the one-time unlock tips already shown (unlockTips.ts). null for
  // a save from before the tips: the first check seeds it with whatever is
  // already unlocked, so an update doesn't fire every tip at once
  seenTips: [] as string[] | null,
  // the hero's look, an index into BootScene's HERO_LOOKS (0 = the original
  // blue, and what saves from before looks load as); bakeHero() applies it
  heroLook: 0,
  hudVisible: true,
  soundMuted: false,
  bgmVolume: 1,
  sfxVolume: 1,
  textSpeed: 1,
  timeSpeed: 1,
  battleSpeed: 1,
  // accessibility: camera shake (motion sickness) and full-screen flashes
  // (photosensitivity), each switchable on its own; see src/fx.ts
  screenShake: true,
  flashes: true,
  // the arrow orbiting the hero towards the quest's goal (ui/GuideArrow.ts)
  guideArrow: true,
  // the save slot (1..SAVE_SLOTS) every save/load/export goes to; a setting,
  // so it outlives a page load (see setSaveSlot)
  saveSlot: 1,

  effMaxHp(): number {
    return Math.min(MAX_HP, this.player.maxHp + (this.equipped.accessory ? (EQUIP_MAXHP[this.equipped.accessory] ?? 0) : 0));
  },
  gainGold(n: number): number {
    const added = Math.min(MAX_GOLD, this.gold + n) - this.gold;
    this.gold += added;
    return added;
  },
  // The CATCHABLE species caught (monsters.ts): what the bestiary's CAUGHT,
  // the HUD's, the COLLECTOR achievement and the completion below all count.
  // Not every name in `caught`: the rare jackpots (GOLDEN SLIME and the like)
  // are caught but never required, and counting them gave a late save 15/13,
  // ATK+5 with 12 of 13 caught and MONSTER MASTER from 10.
  caughtSpecies(): number {
    return CATCHABLE.filter((e) => this.caught.includes(e.name)).length;
  },
  // bestiary completion rewards: +1 ATK/+1 DEF per 20% of catchable species
  // caught, plus a rank title shown in the bestiary
  bestiaryCompletion(): number {
    return this.caughtSpecies() / CATCHABLE.length;
  },
  bestiaryBonus(): number {
    return Math.floor(this.bestiaryCompletion() * 5);
  },
  bestiaryTitle(): string {
    const pct = this.bestiaryCompletion();
    if (pct >= 1) return "MONSTER MASTER";
    if (pct >= 0.75) return "BEAST TAMER";
    if (pct >= 0.5) return "HUNTER";
    return "";
  },
  // "new" on a species' first catch, "best" when it beats the old record, so
  // the fishing panel can badge the result. Takes the raw roll rather than
  // gainGold()'s credited amount, or every catch made at the gold cap would
  // log as 0G.
  logFish(name: string, value: number): "new" | "best" | null {
    const prev = this.fishLog[name];
    if (prev !== undefined && value <= prev) return null;
    this.fishLog[name] = value;
    return prev === undefined ? "new" : "best";
  },
  // counted against ALL_FISH, not Object.keys(fishLog), so a renamed or
  // removed species left in an old save can't inflate the total
  fishLogged(): number {
    return ALL_FISH.filter((f) => f.name in this.fishLog).length;
  },
  // +1 ATK per 10 combat rounds fought alongside this companion, capped at
  // +5 — companions have no DEF stat of their own (they never take damage
  // individually), so unlike bestiaryBonus this only scales their attack
  companionBondBonus(name: string | null): number {
    if (!name) return 0;
    return Math.min(5, Math.floor((this.companionBond[name] ?? 0) / 10));
  },
  // eligible bounty targets: every catchable species except the TROLL KING
  // (a rare 35%-per-load Town roamer — could make that day's bounty
  // impossible), gated by the same quest flags that unlock their area
  bountyPool(): EnemyDef[] {
    return CATCHABLE.filter((e) => {
      if (e.giant) return false;
      if (FOREST_BOUNTY_MONSTERS.has(e.name)) return this.quest.bossDefeated;
      if (SNOW_BOUNTY_MONSTERS.has(e.name)) return this.quest.forestBoss;
      if (VOLCANO_BOUNTY_MONSTERS.has(e.name)) return this.quest.snowBoss;
      return true;
    });
  },
  // HUNTER's fire-beast job: which FIRE_BEASTS have been caught since it was
  // accepted, in roster order — a second catch of one species counts once.
  // One helper so TownScene, QuestLog and StatusHud all count it the same way.
  fireBeastsCaught(): string[] {
    return fireBeastsCaughtIn(this.caught, this.quest.fireCaughtAtAccept);
  },
  // rerolls the board once a new reward day (econDay) starts, or on first
  // visit; no partial credit or streak carries over, same as every other
  // day-based gate in this game (day/night, NIGHT WISP) just reflecting
  // current state
  rollBountyIfStale(): void {
    if (this.bounty && this.bounty.day === econDay()) return;
    // a finished-but-unclaimed bounty still gets paid before it's discarded —
    // "no partial credit" is meant for unfinished progress, not for silently
    // voiding a reward the player already earned just because they didn't
    // walk back to the board before the day rolled over
    if (this.bounty && !this.bounty.claimed && this.bounty.have >= this.bounty.need) {
      this.gainGold(this.bounty.reward);
    }
    const pool = this.bountyPool();
    const target = pool[Math.floor(Math.random() * pool.length)];
    const need = 3 + Math.floor(Math.random() * 4); // 3-6 inclusive
    this.bounty = {
      target: target.name,
      need,
      have: 0,
      reward: Math.round(need * target.gold * BOUNTY_MULT),
      day: econDay(),
      claimed: false,
    };
  },
  effAtk(): number {
    return this.player.atk + (this.equipped.weapon ? EQUIP_BONUS[this.equipped.weapon] : 0) + this.bestiaryBonus();
  },
  effDef(): number {
    return this.player.def + (this.equipped.armor ? EQUIP_BONUS[this.equipped.armor] : 0) + this.bestiaryBonus();
  },
  weaponTexture(): string {
    return this.equipped.weapon ? EQUIP_TEXTURE[this.equipped.weapon] : "equip-sword";
  },
  armorTexture(): string {
    return this.equipped.armor ? EQUIP_TEXTURE[this.equipped.armor] : "equip-shield";
  },
  isEquipped(key: EquipmentKey): boolean {
    return this.equipped[EQUIP_SLOT[key]] === key;
  },
  // BattleScene asks this before landing poison/freeze
  resists(kind: ResistKind): boolean {
    return Object.values(this.equipped).some((key) => key !== null && (EQUIP_RESIST[key]?.includes(kind) ?? false));
  },
  equipToggle(key: EquipmentKey): string {
    const slot = EQUIP_SLOT[key];
    if (this.isEquipped(key)) {
      this.unequip(slot);
      return "Unequipped!";
    }
    const before = this.effMaxHp();
    this.setEquipped(slot, key);
    // preserve the HP the amulet's +maxHp bonus grants, without letting
    // repeated equip/unequip toggles net-heal (the bonus isn't tracked
    // separately from maxHp, so clamping alone would keep adding it back)
    this.player.hp = Math.min(this.effMaxHp(), this.player.hp + (this.effMaxHp() - before));
    return "Equipped!";
  },
  setEquipped(slot: EquipSlot, key: EquipmentKey): void {
    this.equipped[slot] = key;
  },
  unequip(slot: EquipSlot): void {
    const key = this.equipped[slot];
    if (!key) return;
    const before = this.effMaxHp();
    this.equipped[slot] = null;
    this.player.hp = Math.max(1, Math.min(this.effMaxHp(), this.player.hp + (this.effMaxHp() - before)));
  },

  // Multipliers BattleScene applies to an enemy's HP/ATK (stat) and its
  // EXP/gold (loot) for the current NEW GAME+ cycle; 1 and 1 on a first run.
  enemyScale(): { stat: number; loot: number } {
    const n = Math.min(this.ngPlus, NG_SCALE_CAP);
    return { stat: 1 + NG_STAT_STEP * n, loot: 1 + NG_LOOT_STEP * n };
  },

  // NEW GAME+, on a loaded save that has beaten the FLAME DRAKE: back to day
  // one in town, keeping what the hero *is* — level, stats, gear and what is
  // worn, catches and sightings, trophies, the fish log, the companion and its
  // bond — and replaying what the hero *did*: every ELDER and HUNTER chapter,
  // the chests, the bounty board, the farm. Consumables go back to the new-
  // game kit because every quest that paid them out pays them again; gold is
  // halved, since the kept gear already covers what the shop sells dearest.
  // The monster materials stay, like the pantry and the treasure maps below:
  // the hero gathered them, no quest hands them out again.
  beginNewGamePlus(): void {
    const gear = Object.fromEntries((Object.keys(EQUIP_SLOT) as EquipmentKey[]).map((k) => [k, this.inventory[k]]));
    const materials = Object.fromEntries(MATERIAL_KEYS.map((k) => [k, this.inventory[k]]));
    const records = Object.fromEntries(NG_KEEP_QUEST.map((k) => [k, this.quest[k]]));
    const kept = {
      player: { ...this.player },
      gold: Math.floor(this.gold / 2),
      battles: this.battles,
      fishCaught: this.fishCaught,
      fishLog: this.fishLog,
      cropsHarvested: this.cropsHarvested,
      goldenHarvests: this.goldenHarvests,
      // records, like the trophies beside them, not progress to replay
      arenaBest: this.arenaBest,
      abyssBest: this.abyssBest,
      // kept like the record: what the hero has reached, and B1 is always
      // still on offer when NEW GAME+'s harder foes make it too deep
      abyssCheckpoint: this.abyssCheckpoint,
      // and the portal with it, on the same terms
      abyssPortal: this.abyssPortal,
      // the larder and what's on the table, like the gear: the hero's own
      // goods rather than a quest's payout to be replayed
      pantry: this.pantry,
      meal: this.meal,
      // loot like the gear, and a record like the trophies; a map to a region
      // the new cycle hasn't reopened yet waits until it has
      treasureMaps: this.treasureMaps,
      mapsDug: this.mapsDug,
      // the house is the hero's for good; its garden starts the new day over
      houseLevel: this.houseLevel,
      achievements: this.achievements,
      equipped: this.equipped,
      caught: this.caught,
      seenMonsters: this.seenMonsters,
      companion: this.companion,
      companionBond: this.companionBond,
      ngPlus: this.ngPlus + 1,
      // a tip told once stays told: the replayed unlocks aren't news
      seenTips: this.seenTips,
      heroLook: this.heroLook,
    };
    // reset() is the new-game state for everything not kept above, so the
    // quest/chest/farm/kit defaults live in one place
    this.reset();
    Object.assign(this, kept);
    Object.assign(this.inventory, gear, materials);
    Object.assign(this.quest, records);
    this.player.hp = this.effMaxHp();
    this.player.mp = this.player.maxMp;
  },

  reset(): void {
    this.player = {
      name: "HERO",
      level: 1,
      exp: 0,
      hp: 30,
      maxHp: 30,
      mp: 10,
      maxMp: 10,
      atk: 6,
      def: 2,
    };
    this.gold = 0;
    this.battles = 0;
    this.streak = 0;
    this.fishCaught = 0;
    this.fishLog = {};
    this.cropsHarvested = 0;
    this.goldenHarvests = 0;
    this.arenaBest = 0;
    this.abyssBest = 0;
    this.abyssCheckpoint = 0;
    this.abyssPortal = 0;
    this.pantry = newPantry();
    this.meal = null;
    this.treasureMaps = [];
    this.mapsDug = 0;
    this.houseLevel = 0;
    this.gardenDay = -1;
    this.rested = false;
    this.seasonSeen = -1;
    this.farm = Array.from({ length: FARM_PLOTS }, () => null);
    this.achievements = [];
    this.inventory = {
      potion: 2,
      mPotion: 1,
      candy: 0,
      hiPotion: 0,
      ether: 0,
      elixir: 0,
      bomb: 0,
      sword: 0,
      shield: 0,
      ironSword: 0,
      ironShield: 0,
      amulet: 0,
      mythrilSword: 0,
      mythrilShield: 0,
      antidoteCharm: 0,
      emberRing: 0,
      ...laterInventory(),
    };
    this.equipped = { weapon: null, armor: null, accessory: null };
    this.caught = [];
    this.seenMonsters = [];
    this.companion = null;
    this.companionBond = {};
    this.openedTreasures = [];
    this.quest = {
      slimes: 0,
      goldenSlimes: 0,
      wispsDefeated: 0,
      comboCapped: false,
      slimeReward: false,
      bossDefeated: false,
      finalReward: false,
      forestBoss: false,
      forestReward: false,
      bestiaryReward: false,
      snowBoss: false,
      snowReward: false,
      volcanoBoss: false,
      volcanoReward: false,
      trollDefeated: false,
      hunterBatsAccepted: false,
      batsSlain: 0,
      hunterBatsReward: false,
      hunterCatchAccepted: false,
      caughtAtAccept: 0,
      hunterCatchReward: false,
      hunterYetiAccepted: false,
      yetisSlain: 0,
      hunterYetiReward: false,
      hunterFireAccepted: false,
      fireCaughtAtAccept: 0,
      hunterFireReward: false,
    };
    this.bounty = null;
    this.delivery = null;
    this.favors = newFavors();
    this._minutes = 360;
    this.farmMinutes = 360;
    this.farmNightMinutes = nightMinutesBefore(360);
    this.pos = undefined;
    this.ngPlus = 0;
    this.seenTips = [];
    this.heroLook = 0;
  },

  // `slot` defaults to the one in use, here and in clearSave/export/import
  hasSave(slot?: number): boolean {
    return localStorage.getItem(slotKey(slot ?? this.saveSlot)) !== null;
  },

  // switch the slot saves go to (the title screen's picker); remembered
  setSaveSlot(slot: number): void {
    this.saveSlot = clampSlot(slot);
    this.saveSettings();
  },

  // false when storage refused the write (full or blocked): nothing is
  // thrown at the caller — the game carries on from memory and onSaveFailed
  // listeners tell the player; the slot keeps its last good save
  save(): boolean {
    try {
      localStorage.setItem(
        slotKey(this.saveSlot),
        JSON.stringify({
          player: this.player,
          gold: this.gold,
          battles: this.battles,
          streak: this.streak,
          fishCaught: this.fishCaught,
          fishLog: this.fishLog,
          cropsHarvested: this.cropsHarvested,
          goldenHarvests: this.goldenHarvests,
          arenaBest: this.arenaBest,
          abyssBest: this.abyssBest,
          abyssCheckpoint: this.abyssCheckpoint,
          abyssPortal: this.abyssPortal,
          pantry: this.pantry,
          meal: this.meal,
          treasureMaps: this.treasureMaps,
          mapsDug: this.mapsDug,
          houseLevel: this.houseLevel,
          gardenDay: this.gardenDay,
          rested: this.rested,
          seasonSeen: this.seasonSeen,
          farm: this.farm,
          achievements: this.achievements,
          inventory: this.inventory,
          equipped: this.equipped,
          caught: this.caught,
          seenMonsters: this.seenMonsters,
          companion: this.companion,
          companionBond: this.companionBond,
          openedTreasures: this.openedTreasures,
          quest: this.quest,
          bounty: this.bounty,
          delivery: this.delivery,
          favors: this.favors,
          minutes: this.minutes,
          farmMinutes: this.farmMinutes,
          farmNightMinutes: this.farmNightMinutes,
          pos: this.pos,
          ngPlus: this.ngPlus,
          seenTips: this.seenTips,
          heroLook: this.heroLook,
        }),
      );
    } catch {
      saveFailListeners.forEach((cb) => {
        cb();
      });
      return false;
    }
    // every saved hero shows up on the village rank board
    recordRank(this.player.name, this.player.level);
    saveListeners.forEach((cb) => {
      cb();
    });
    return true;
  },

  // false when the slot is empty or won't load. A save that fails is left
  // exactly where it is: the title shows it as DAMAGED and it is only moved
  // aside (under a "-corrupt" key) when the slot is about to be reused.
  load(): boolean {
    const raw = localStorage.getItem(slotKey(this.saveSlot));
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      Object.assign(this.player, data.player);
      this.player.name = typeof this.player.name === "string" ? this.player.name.slice(0, NAME_MAX) : "HERO";
      this.player.level = Math.min(MAX_LEVEL, this.player.level);
      this.player.maxHp = Math.min(MAX_HP, this.player.maxHp);
      this.player.maxMp = Math.min(MAX_MP, this.player.maxMp);
      this.gold = Math.min(MAX_GOLD, data.gold ?? 0);
      this.battles = data.battles ?? 0;
      this.streak = data.streak ?? 0;
      this.fishCaught = data.fishCaught ?? 0;
      // old saves have no log and start it empty; only numeric entries are
      // kept, since `name in fishLog` throws if an imported save code put a
      // primitive here
      this.fishLog = Object.fromEntries(Object.entries(data.fishLog ?? {}).filter((e): e is [string, number] => typeof e[1] === "number"));
      this.cropsHarvested = data.cropsHarvested ?? 0;
      this.goldenHarvests = data.goldenHarvests ?? 0;
      this.arenaBest = data.arenaBest ?? 0;
      // none on saves from before the ABYSS; a junk value from an imported
      // save code reads as never having gone down
      this.abyssBest = Number.isInteger(data.abyssBest) && data.abyssBest > 0 ? data.abyssBest : 0;
      this.abyssCheckpoint = Number.isInteger(data.abyssCheckpoint) && data.abyssCheckpoint > 1 ? data.abyssCheckpoint : 0;
      // none on saves from before the portal; only a save's own key, and a
      // floor a portal can name (B2..ABYSS_FLOOR_MAX)
      const portal = Object.keys(data).includes("abyssPortal") ? data.abyssPortal : 0;
      this.abyssPortal = Number.isInteger(portal) && portal >= 2 && portal <= ABYSS_FLOOR_MAX ? portal : 0;
      // none on saves from before cooking: an empty pantry, nothing cooked
      this.pantry = loadPantry(data.pantry);
      this.meal = loadMeal(data.meal);
      // none on saves from before treasure maps
      this.treasureMaps = loadTreasureMaps(data.treasureMaps);
      this.mapsDug = Number.isInteger(data.mapsDug) && data.mapsDug > 0 ? data.mapsDug : 0;
      // a house never extended on saves from before HOME's extensions
      this.houseLevel = Number.isInteger(data.houseLevel) ? Math.min(MAX_HOUSE, Math.max(0, data.houseLevel)) : 0;
      this.gardenDay = Number.isInteger(data.gardenDay) ? data.gardenDay : -1;
      this.rested = data.rested === true;
      this.seasonSeen = Number.isInteger(data.seasonSeen) ? data.seasonSeen : -1;
      // rebuilt slot by slot so an old save (no farm), a shorter array or an
      // unknown crop key can't leave a plot the farm panel would read as
      // undefined
      this.farm = Array.from({ length: FARM_PLOTS }, (_, i) => {
        const plot = data.farm?.[i];
        // an own key only: "toString" is `in` every object
        return plot && Object.keys(CROPS).includes(plot.crop) ? { crop: plot.crop as CropKey, plantedAt: plot.plantedAt ?? 0 } : null;
      });
      this.achievements = data.achievements ?? [];
      Object.assign(this.inventory, data.inventory);
      // saves from before the resist accessories carry neither key; set them
      // outright so they can't keep a count left over from a save loaded
      // earlier this session (same reason as the volcano quest flags below)
      this.inventory.antidoteCharm = data.inventory?.antidoteCharm ?? 0;
      this.inventory.emberRing = data.inventory?.emberRing ?? 0;
      // ...and the same for materials and forged gear
      Object.assign(this.inventory, laterInventory(data.inventory));
      // migrate old boolean equipment flags -> inventory counts + equipped
      if (data.sword && this.inventory.sword === 0) this.inventory.sword = 1;
      if (data.shield && this.inventory.shield === 0) this.inventory.shield = 1;
      this.equipped = data.equipped ?? {
        weapon: data.sword ? "sword" : null,
        armor: data.shield ? "shield" : null,
        accessory: null,
      };
      this.caught = data.caught ?? [];
      this.seenMonsters = data.seenMonsters ?? [];
      this.companion = data.companion ?? null;
      this.companionBond = data.companionBond ?? {};
      this.openedTreasures = data.openedTreasures ?? [];
      Object.assign(this.quest, data.quest);
      // saves from before the volcano carry neither flag; set them outright so
      // they can't keep a value left over from a save loaded earlier this session
      this.quest.volcanoBoss = data.quest?.volcanoBoss ?? false;
      this.quest.volcanoReward = data.quest?.volcanoReward ?? false;
      // A save from before the flag can't say whether the TROLL KING it met
      // was beaten, and the ARENA used to take a sighting for it; keep
      // that, so no save loses a bout it already had.
      this.quest.trollDefeated = data.quest?.trollDefeated ?? this.seenMonsters.includes("TROLL KING");
      // ...and the same for HUNTER's fire-beast job, which came with it
      this.quest.hunterFireAccepted = data.quest?.hunterFireAccepted ?? false;
      this.quest.fireCaughtAtAccept = data.quest?.fireCaughtAtAccept ?? 0;
      this.quest.hunterFireReward = data.quest?.hunterFireReward ?? false;
      this.bounty = data.bounty ?? null;
      // none on saves from before deliveries; anything malformed is dropped
      // and today's is simply rolled again at the board
      const d = data.delivery;
      this.delivery =
        d && Number.isInteger(d.day) && MATERIAL_KEYS.includes(d.material) && Number.isInteger(d.need) && d.need > 0
          ? { day: d.day, material: d.material, need: d.need, done: d.done === true }
          : null;
      // saves from before favors start every chain at its first step; a
      // malformed entry is reset rather than trusted
      this.favors = newFavors();
      for (const key of Object.keys(this.favors) as VillagerKey[]) {
        const f = data.favors?.[key];
        if (f && Number.isInteger(f.step) && f.step >= 0 && Number.isInteger(f.snap) && f.snap >= 0) {
          this.favors[key] = { step: f.step, accepted: f.accepted === true, snap: f.snap };
        }
      }
      // straight into the field: a load is no time passing (see the setter)
      this._minutes = data.minutes ?? 360;
      // The farm's clocks. A save from before them grew its crops on the
      // clock itself, so they start level with it and its plots carry on
      // where they were: a day crop's plantedAt was a clock reading already,
      // a night crop's becomes the night minutes up to it.
      if (typeof data.farmMinutes === "number" && typeof data.farmNightMinutes === "number") {
        this.farmMinutes = data.farmMinutes;
        this.farmNightMinutes = data.farmNightMinutes;
      } else {
        this.farmMinutes = this._minutes;
        this.farmNightMinutes = nightMinutesBefore(this._minutes);
        for (const plot of this.farm) {
          const def: CropDef | undefined = plot ? CROPS[plot.crop] : undefined;
          if (plot && def?.nightOnly) plot.plantedAt = nightMinutesBefore(plot.plantedAt);
        }
      }
      this.pos = data.pos;
      // saves from before NEW GAME+ are a first playthrough
      this.ngPlus = ngPlusOf(data);
      // missing on saves from before the tips: null, seeded by unlockTips.ts
      this.seenTips = Array.isArray(data.seenTips) ? data.seenTips.filter((t: unknown): t is string => typeof t === "string") : null;
      // older saves have none; bakeHero() treats an unknown index as BLUE too
      this.heroLook = Number.isInteger(data.heroLook) && data.heroLook >= 0 ? data.heroLook : 0;
      return true;
    } catch {
      return false;
    }
  },

  // Display/audio preferences: kept in their own key, separate from the game
  // save, so they survive "new game" / delete-save and don't trigger the
  // "SAVED" toast that GameState.save() fires on every real progress save.
  loadSettings(): void {
    // main.ts calls this once at boot, before any scene can read or write a
    // save — the one place the pre-slot save gets moved over
    migrateLegacySave();
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      this.hudVisible = s.hudVisible ?? true;
      this.soundMuted = s.soundMuted ?? false;
      this.bgmVolume = clampVolume(s.bgmVolume);
      this.sfxVolume = clampVolume(s.sfxVolume);
      this.textSpeed = TEXT_SPEEDS.includes(s.textSpeed) ? s.textSpeed : 1;
      this.timeSpeed = TIME_SPEEDS.includes(s.timeSpeed) ? s.timeSpeed : 1;
      // settings saved before the option existed read as NORMAL
      this.battleSpeed = BATTLE_SPEEDS.includes(s.battleSpeed) ? s.battleSpeed : 1;
      // settings saved before these existed lack them: both default on
      this.screenShake = typeof s.screenShake === "boolean" ? s.screenShake : true;
      this.flashes = typeof s.flashes === "boolean" ? s.flashes : true;
      this.guideArrow = typeof s.guideArrow === "boolean" ? s.guideArrow : true;
      this.saveSlot = clampSlot(s.saveSlot);
    } catch {
      /* keep defaults */
    }
  },
  saveSettings(): void {
    // a full storage only costs the preference its persistence
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
          hudVisible: this.hudVisible,
          soundMuted: this.soundMuted,
          bgmVolume: this.bgmVolume,
          sfxVolume: this.sfxVolume,
          textSpeed: this.textSpeed,
          timeSpeed: this.timeSpeed,
          battleSpeed: this.battleSpeed,
          screenShake: this.screenShake,
          flashes: this.flashes,
          guideArrow: this.guideArrow,
          saveSlot: this.saveSlot,
        }),
      );
    } catch {
      /* keep going with the settings in memory */
    }
  },

  // removes the slot's save; a damaged one is parked first, and false means
  // that copy couldn't be written so the slot was left as it was
  clearSave(slot?: number): boolean {
    return dropSlot(slot ?? this.saveSlot);
  },

  // Keeps what's in the slot before it is replaced: a good save becomes the
  // slot's one backup (the older backup goes), a damaged one is parked under
  // its own "-corrupt" key. true when there was nothing to keep or the copy
  // read back intact; false (nothing written) when storage refused it, and
  // the caller must then leave the slot alone.
  backupSave(slot?: number): boolean {
    const n = slot ?? this.saveSlot;
    const raw = localStorage.getItem(slotKey(n));
    if (raw === null) return true;
    return writeVerified(parses(raw) ? backupKey(n) : corruptKey(n), raw);
  },

  // NEW GAME over a slot, or DELETE: back it up, then empty it
  retireSave(slot?: number): boolean {
    const n = slot ?? this.saveSlot;
    if (!this.backupSave(n)) return false;
    localStorage.removeItem(slotKey(n));
    return true;
  },

  hasBackup(slot?: number): boolean {
    return localStorage.getItem(backupKey(slot ?? this.saveSlot)) !== null;
  },

  // Swaps the slot with its backup, so a restore can itself be undone and
  // never loses the save it replaces. The current save goes to a scratch key
  // first; each step reads back before the next, and a refused write stops
  // with every save still held somewhere (the slot, the backup or scratch).
  restoreSave(slot?: number): boolean {
    const n = slot ?? this.saveSlot;
    const prev = localStorage.getItem(backupKey(n));
    if (prev === null) return false;
    const cur = localStorage.getItem(slotKey(n));
    const scratch = `${backupKey(n)}-swap`;
    if (cur !== null && !writeVerified(scratch, cur)) return false;
    if (!writeVerified(slotKey(n), prev)) {
      localStorage.removeItem(scratch);
      return false;
    }
    if (cur === null) localStorage.removeItem(backupKey(n));
    else if (!writeVerified(backupKey(n), cur)) {
      // undo: put the slot back to what it held; scratch is only cleared once
      // that is confirmed, so a refusal here still leaves the save there
      if (writeVerified(slotKey(n), cur)) localStorage.removeItem(scratch);
      return false;
    }
    localStorage.removeItem(scratch);
    return true;
  },

  // UTF-8-safe Base64: player names can be non-Latin1, and plain btoa would
  // throw on them, so the JSON goes through TextEncoder bytes first
  exportSaveCode(slot?: number): string {
    const raw = localStorage.getItem(slotKey(slot ?? this.saveSlot));
    if (!raw) return "";
    let bin = "";
    for (const b of new TextEncoder().encode(raw)) bin += String.fromCharCode(b);
    return btoa(bin);
  },
  // "invalid" for a code that isn't a save; "full" when storage refused the
  // backup or the write, and then the slot holds what it did before
  importSaveCode(code: string, slot?: number): "ok" | "invalid" | "full" {
    const n = slot ?? this.saveSlot;
    let json: string;
    try {
      const bin = atob(code.trim());
      json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
      const data = JSON.parse(json) as { player?: { level?: unknown } } | null;
      if (!data || typeof data.player?.level !== "number") return "invalid";
    } catch {
      return "invalid";
    }
    if (!this.backupSave(n)) return "full";
    return writeVerified(slotKey(n), json) ? "ok" : "full";
  },
};

// The fire-beast count over any caught list, so a save can be summarised
// without loading it (GameState.fireBeastsCaught is this over the live state).
export function fireBeastsCaughtIn(caught: readonly string[], from: number): string[] {
  const fresh = caught.slice(from);
  return FIRE_BEASTS.filter((name) => fresh.includes(name));
}

export interface SaveSummary {
  name: string;
  level: number;
  gold: number;
  day: number; // 1-based, from the saved clock
  quest: QuestState;
  caught: string[];
  achievements: string[];
  ngPlus: number;
  // what the title's card draws the hero in: the look (HERO_LOOKS index) and
  // the worn weapon's and armor's overlay textures, null when none is worn
  look: number;
  weapon: string | null;
  armor: string | null;
}

// a worn item's overlay texture in a save, or null for none or junk
function wornTexture(key: unknown): string | null {
  return typeof key === "string" && Object.keys(EQUIP_TEXTURE).includes(key) ? EQUIP_TEXTURE[key as EquipmentKey] : null;
}

// the save's NEW GAME+ cycle; 0 for saves from before it and for junk values
function ngPlusOf(data: { ngPlus?: unknown } | null | undefined): number {
  const n = data?.ngPlus;
  return typeof n === "number" && Number.isInteger(n) && n > 0 ? n : 0;
}

/**
 * The save, read for display only — the title screen's summary card. Unlike
 * GameState.load() it never assigns into GameState, so looking at a save can't
 * change the game that "continue" will then load. Fields an older save lacks
 * read as a fresh game would have them (quest flags false, counters 0), using
 * GameState.quest only for its key set and value types. null when there is no
 * save or it doesn't parse.
 */
export function readSaveSummary(slot = GameState.saveSlot): SaveSummary | null {
  return summarize(localStorage.getItem(slotKey(slot)));
}

// the slot's backup, read the same way (the title's RESTORE question names it)
export function readBackupSummary(slot = GameState.saveSlot): SaveSummary | null {
  return summarize(localStorage.getItem(backupKey(slot)));
}

// a save is there but won't even parse; the title shows it as DAMAGED
export function isSaveDamaged(slot = GameState.saveSlot): boolean {
  const raw = localStorage.getItem(slotKey(slot));
  return raw !== null && !parses(raw);
}

// The slot's damaged saves parked aside (one "-corrupt-<ms>" key per
// incident, oldest first). They can't be loaded or imported back, so all the
// title offers is their count and a way to free the space.
export function damagedCopyKeys(slot = GameState.saveSlot): string[] {
  const prefix = corruptPrefix(slot);
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  return keys.sort();
}

// removes them all; how many there were
export function deleteDamagedCopies(slot = GameState.saveSlot): number {
  const keys = damagedCopyKeys(slot);
  for (const key of keys) localStorage.removeItem(key);
  return keys.length;
}

function summarize(raw: string | null): SaveSummary | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    const saved = data?.quest ?? {};
    const quest = Object.fromEntries(
      Object.entries(GameState.quest).map(([key, value]) => [key, saved[key] ?? (typeof value === "number" ? 0 : false)]),
    ) as unknown as QuestState;
    return {
      name: typeof data?.player?.name === "string" ? data.player.name.slice(0, NAME_MAX) : "HERO",
      level: Math.min(MAX_LEVEL, data?.player?.level ?? 1),
      gold: Math.min(MAX_GOLD, data?.gold ?? 0),
      day: Math.floor((data?.minutes ?? 360) / 1440) + 1,
      quest,
      caught: Array.isArray(data?.caught) ? data.caught : [],
      achievements: Array.isArray(data?.achievements) ? data.achievements : [],
      ngPlus: ngPlusOf(data),
      look: Number.isInteger(data?.heroLook) && data.heroLook >= 0 ? data.heroLook : 0,
      weapon: wornTexture(data?.equipped?.weapon),
      armor: wornTexture(data?.equipped?.armor),
    };
  } catch {
    return null;
  }
}
