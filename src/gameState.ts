import { MAX_GOLD, MAX_HP, MAX_LEVEL, MAX_MP } from "./config";
import { CATCHABLE, type EnemyDef } from "./monsters";
import { recordRank } from "./ranking";

// bounty board eligibility: these only roam the forest/snow fields, which
// stay locked behind the same quest flags WorldScene already gates them on
const FOREST_BOUNTY_MONSTERS = new Set(["WASP", "SPIDER", "ORC"]);
const SNOW_BOUNTY_MONSTERS = new Set(["FROST MOTH", "YETI"]);
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

export interface InventoryState {
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
}

export type EquipSlot = "weapon" | "armor" | "accessory";
export type EquipmentKey = "sword" | "shield" | "ironSword" | "ironShield" | "amulet" | "mythrilSword" | "mythrilShield";

export const EQUIP_SLOT: Record<EquipmentKey, EquipSlot> = {
  sword: "weapon",
  ironSword: "weapon",
  mythrilSword: "weapon",
  shield: "armor",
  ironShield: "armor",
  mythrilShield: "armor",
  amulet: "accessory",
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
};

export const EQUIP_TEXTURE: Record<EquipmentKey, string> = {
  sword: "equip-sword",
  ironSword: "equip-iron-sword",
  mythrilSword: "equip-mythril-sword",
  shield: "equip-shield",
  ironShield: "equip-iron-shield",
  mythrilShield: "equip-mythril-shield",
  amulet: "equip-sword", // accessory: never drawn as an overlay
};

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
}

// daily bounty board: unlike HUNTER's fixed chain, this rerolls a random
// target every in-game day. `have` is never capped at increment time (same
// unbounded-then-clamp-at-display convention as batsSlain/yetisSlain above).
export interface BountyState {
  target: string; // an ENEMIES[...].name
  need: number;
  have: number;
  reward: number;
  day: number; // dayIndex() at roll time — compared to detect a new day
  claimed: boolean;
}

const SAVE_KEY = "magic-world-save";
const SETTINGS_KEY = "magic-world-settings";

const saveListeners: Array<() => void> = [];

// Lets scenes show a "SAVED" toast without GameState.save() needing any
// reference to a Phaser scene. Returns an unsubscribe function.
export function onSaved(callback: () => void): () => void {
  saveListeners.push(callback);
  return () => {
    const i = saveListeners.indexOf(callback);
    if (i >= 0) saveListeners.splice(i, 1);
  };
}

export const expToNext = (level: number): number => 10 + level * 10;

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

const clampVolume = (v: unknown): number => (typeof v === "number" && v >= 0 && v <= 1 ? Math.round(v * 10) / 10 : 1);

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
    hunterBatsAccepted: false,
    batsSlain: 0,
    hunterBatsReward: false,
    hunterCatchAccepted: false,
    caughtAtAccept: 0,
    hunterCatchReward: false,
    hunterYetiAccepted: false,
    yetisSlain: 0,
    hunterYetiReward: false,
  } as QuestState,
  bounty: null as BountyState | null,
  minutes: 360,
  pos: undefined as { x: number; y: number } | undefined,
  encounterLockUntil: 0,
  hudVisible: true,
  soundMuted: false,
  bgmVolume: 1,
  sfxVolume: 1,
  textSpeed: 1,
  timeSpeed: 1,

  lockEncounters(ms: number): void {
    this.encounterLockUntil = Date.now() + ms;
  },
  encountersLocked(): boolean {
    return Date.now() < this.encounterLockUntil;
  },

  effMaxHp(): number {
    return Math.min(MAX_HP, this.player.maxHp + (this.equipped.accessory === "amulet" ? 10 : 0));
  },
  gainGold(n: number): number {
    const added = Math.min(MAX_GOLD, this.gold + n) - this.gold;
    this.gold += added;
    return added;
  },
  // bestiary completion rewards: +1 ATK/+1 DEF per 20% of catchable species
  // caught, plus a rank title shown in the bestiary
  bestiaryCompletion(): number {
    return new Set(this.caught).size / CATCHABLE.length;
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
  // +1 ATK per 10 combat rounds fought alongside this companion, capped at
  // +5 — companions have no DEF stat of their own (they never take damage
  // individually), so unlike bestiaryBonus this only scales their attack
  companionBondBonus(name: string | null): number {
    if (!name) return 0;
    return Math.min(5, Math.floor((this.companionBond[name] ?? 0) / 10));
  },
  // eligible bounty targets: every catchable species except the TROLL KING
  // (a rare 35%-per-load World roamer — could make that day's bounty
  // impossible), gated by the same quest flags that unlock their area
  bountyPool(): EnemyDef[] {
    return CATCHABLE.filter((e) => {
      if (e.giant) return false;
      if (FOREST_BOUNTY_MONSTERS.has(e.name)) return this.quest.bossDefeated;
      if (SNOW_BOUNTY_MONSTERS.has(e.name)) return this.quest.forestBoss;
      return true;
    });
  },
  // rerolls the board once a new in-game day starts (or on first visit);
  // no partial credit or streak carries over, same as every other day-based
  // gate in this game (day/night, NIGHT WISP) just reflecting current state
  rollBountyIfStale(): void {
    if (this.bounty && this.bounty.day === dayIndex()) return;
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
      day: dayIndex(),
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
      hunterBatsAccepted: false,
      batsSlain: 0,
      hunterBatsReward: false,
      hunterCatchAccepted: false,
      caughtAtAccept: 0,
      hunterCatchReward: false,
      hunterYetiAccepted: false,
      yetisSlain: 0,
      hunterYetiReward: false,
    };
    this.bounty = null;
    this.minutes = 360;
    this.pos = undefined;
    this.encounterLockUntil = 0;
  },

  hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null;
  },

  save(): void {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        player: this.player,
        gold: this.gold,
        battles: this.battles,
        streak: this.streak,
        fishCaught: this.fishCaught,
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
        minutes: this.minutes,
        pos: this.pos,
        encounterLockUntil: this.encounterLockUntil,
      }),
    );
    // every saved hero shows up on the village rank board
    recordRank(this.player.name, this.player.level);
    saveListeners.forEach((cb) => {
      cb();
    });
  },

  load(): void {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      Object.assign(this.player, data.player);
      this.player.level = Math.min(MAX_LEVEL, this.player.level);
      this.player.maxHp = Math.min(MAX_HP, this.player.maxHp);
      this.player.maxMp = Math.min(MAX_MP, this.player.maxMp);
      this.gold = Math.min(MAX_GOLD, data.gold ?? 0);
      this.battles = data.battles ?? 0;
      this.streak = data.streak ?? 0;
      this.fishCaught = data.fishCaught ?? 0;
      this.achievements = data.achievements ?? [];
      Object.assign(this.inventory, data.inventory);
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
      this.bounty = data.bounty ?? null;
      this.minutes = data.minutes ?? 360;
      this.pos = data.pos;
      this.encounterLockUntil = data.encounterLockUntil ?? 0;
    } catch {
      this.clearSave();
    }
  },

  // Display/audio preferences: kept in their own key, separate from the game
  // save, so they survive "new game" / delete-save and don't trigger the
  // "SAVED" toast that GameState.save() fires on every real progress save.
  loadSettings(): void {
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
    } catch {
      /* keep defaults */
    }
  },
  saveSettings(): void {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        hudVisible: this.hudVisible,
        soundMuted: this.soundMuted,
        bgmVolume: this.bgmVolume,
        sfxVolume: this.sfxVolume,
        textSpeed: this.textSpeed,
        timeSpeed: this.timeSpeed,
      }),
    );
  },

  clearSave(): void {
    localStorage.removeItem(SAVE_KEY);
  },

  // UTF-8-safe Base64: player names can be non-Latin1, and plain btoa would
  // throw on them, so the JSON goes through TextEncoder bytes first
  exportSaveCode(): string {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return "";
    let bin = "";
    for (const b of new TextEncoder().encode(raw)) bin += String.fromCharCode(b);
    return btoa(bin);
  },
  importSaveCode(code: string): boolean {
    try {
      const bin = atob(code.trim());
      const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
      const data = JSON.parse(json) as { player?: { level?: unknown } } | null;
      if (!data || typeof data.player?.level !== "number") return false;
      localStorage.setItem(SAVE_KEY, json);
      return true;
    } catch {
      return false;
    }
  },
};
