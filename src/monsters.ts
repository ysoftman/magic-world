// attack spell elements a species may be weak against
export type Element = "fire" | "ice" | "bolt";

// Per-turn special move. poison/freeze ride on a normal hit, regen spends the
// whole turn healing. Boss enrage isn't listed here: every boss/giant gets it
// (see BattleScene.enemyTurn).
export interface EnemySpecial {
  kind: "poison" | "freeze" | "regen";
  chance: number; // kept low (0.2-0.3) so plain attacks still dominate a fight
}

export interface EnemyDef {
  name: string;
  texture: string;
  hp: number;
  atk: number;
  def: number;
  exp: number;
  gold: number;
  boss?: boolean; // story boss (KING SLIME, MOSS GOLEM): quest flag, uncatchable, boss dialogue
  giant?: boolean; // just a bigger sprite + boss fanfare, no quest/story hooks
  rare?: boolean; // rare world jackpot (GOLDEN SLIME): own palette, big payout, not required for collection
  weakness?: Element; // attack spell element that deals bonus damage (bestiary shows the hint)
  special?: EnemySpecial;
}

export const ENEMIES: Record<string, EnemyDef> = {
  slime: { name: "SLIME", texture: "slime", hp: 16, atk: 5, def: 0, exp: 8, gold: 5 },
  goldSlime: {
    name: "GOLDEN SLIME",
    texture: "goldSlime",
    hp: 28,
    atk: 6,
    def: 1,
    exp: 40,
    gold: 60,
    rare: true, // rare world jackpot: big payout, not required for collection
    weakness: "fire",
  },
  goblin: { name: "GOBLIN", texture: "goblin", hp: 22, atk: 7, def: 1, exp: 14, gold: 9, weakness: "bolt" },
  cursedGoblin: {
    name: "CURSED GOBLIN",
    // a light violet palette (BootScene CURSED_GOBLIN_PALETTE): an old darker
    // purple took the goblin down to the cave floor's luma (mean 57 vs 54) and
    // it vanished there
    texture: "cursedGoblin",
    hp: 38,
    atk: 8,
    def: 2,
    exp: 70,
    gold: 108,
    rare: true, // dungeon-exclusive jackpot: a palette reskin, as GOLDEN SLIME is
    weakness: "bolt",
  },
  bat: { name: "BAT", texture: "bat", hp: 18, atk: 6, def: 0, exp: 12, gold: 8, weakness: "ice" },
  wolf: { name: "WOLF", texture: "wolf", hp: 30, atk: 9, def: 1, exp: 25, gold: 15, weakness: "fire" },
  king: {
    name: "KING SLIME",
    texture: "king",
    // Once 60, which a Lv6 hero with a companion finished in 2-3 rounds,
    // before a BODY SLAM could even land; then 120, which kept a solo hero
    // on it 9 rounds. With companions cut to x0.8 (BattleScene
    // COMPANION_ATK_MULT) 100 takes 8 rounds alone and 5 with a WOLF, and
    // ATK 9 -> 10 keeps the threat the shorter fight lost: ~62% of max HP
    // gone solo, as at 120 / 9 (Lv6, SWORD + SHIELD).
    hp: 100,
    atk: 10,
    def: 2,
    exp: 80,
    gold: 120,
    boss: true,
    weakness: "bolt",
  },
  troll: {
    name: "TROLL KING",
    texture: "troll",
    // 90 -> 150 for the same reason as the KING SLIME, then 110 with it: at
    // Lv8 (SWORD + IRON SHIELD) 7-8 rounds alone instead of 9-11, 4-5 with a
    // WOLF at x0.8 (never under 3), and ATK 13 -> 14 for the threat: 57% of
    // max HP lost solo where 74% was, 39% with the WOLF where 35% was
    hp: 110,
    atk: 14,
    def: 3,
    exp: 150,
    gold: 200,
    giant: true,
    weakness: "fire",
  },
  wasp: {
    name: "WASP",
    texture: "wasp",
    hp: 28,
    atk: 9,
    def: 1,
    exp: 22,
    gold: 14,
    weakness: "bolt",
    special: { kind: "poison", chance: 0.2 },
  },
  // The forest's jackpot, as the GOLDEN SLIME is the town's: a WASP in its
  // own silver palette, 3.5% of the wasps (ForestScene), scaled as the other
  // jackpots are off their kind (HP x1.7, ATK and DEF +1, EXP x5, gold x12)
  silverWasp: {
    name: "SILVER WASP",
    texture: "silverWasp",
    hp: 48,
    atk: 10,
    def: 2,
    exp: 110,
    gold: 168,
    rare: true, // forest jackpot: big payout, not required for collection
    weakness: "bolt",
    special: { kind: "poison", chance: 0.2 },
  },
  spider: {
    name: "SPIDER",
    texture: "spider",
    hp: 40,
    atk: 11,
    def: 2,
    exp: 34,
    gold: 22,
    weakness: "fire",
    special: { kind: "poison", chance: 0.3 },
  },
  orc: { name: "ORC", texture: "orc", hp: 52, atk: 13, def: 3, exp: 50, gold: 34, weakness: "ice" },
  mossGolem: {
    name: "MOSS GOLEM",
    texture: "mossGolem",
    hp: 140,
    atk: 15,
    def: 5,
    exp: 220,
    gold: 300,
    boss: true, // FOREST story boss: same flag/uncatchable path as KING SLIME
    weakness: "fire", // a mossy plant body burns
    special: { kind: "regen", chance: 0.25 }, // regrows its moss: rewards bursting it down
  },
  wisp: {
    name: "NIGHT WISP",
    texture: "wisp",
    hp: 34,
    atk: 10,
    def: 1,
    exp: 55,
    gold: 70,
    rare: true, // night-only world jackpot: big payout, not required for collection
    weakness: "ice", // cold snuffs out its ghost-flame
  },
  frostMoth: {
    name: "FROST MOTH",
    texture: "frostMoth",
    hp: 44,
    atk: 14,
    def: 2,
    exp: 58,
    gold: 38,
    weakness: "fire",
    special: { kind: "freeze", chance: 0.2 },
  },
  // the snow field's jackpot, 3.5% of the frost moths (SnowScene), scaled
  // as SILVER WASP is
  auroraMoth: {
    name: "AURORA MOTH",
    texture: "auroraMoth",
    hp: 75,
    atk: 15,
    def: 3,
    exp: 290,
    gold: 456,
    rare: true, // snow field jackpot: big payout, not required for collection
    weakness: "fire",
    special: { kind: "freeze", chance: 0.2 },
  },
  yeti: {
    name: "YETI",
    texture: "yeti",
    hp: 72,
    atk: 17,
    def: 4,
    exp: 95,
    gold: 60,
    weakness: "bolt",
    special: { kind: "freeze", chance: 0.2 },
  },
  iceGolem: {
    name: "GLACIER GOLEM",
    texture: "iceGolem",
    hp: 200,
    atk: 20,
    def: 6,
    exp: 400,
    gold: 500,
    boss: true, // SNOW FIELD superboss: post-game challenge past the MOSS GOLEM
    weakness: "fire", // glacial body shatters under heat
    special: { kind: "freeze", chance: 0.25 },
  },
  // VOLCANO roster, one step past the snow field's (FROST MOTH/YETI/GLACIER
  // GOLEM). Ice is the obvious answer to fire, so most are weak to it; the
  // salamander's scales shrug ice off, so it falls to bolt instead. No
  // specials: poison and freeze don't fit fire, and regen's line is the MOSS
  // GOLEM's ("regrows its moss") — the drake still enrages like every boss.
  magmaSlime: { name: "MAGMA SLIME", texture: "magmaSlime", hp: 60, atk: 17, def: 3, exp: 80, gold: 48, weakness: "ice" },
  fireImp: { name: "FIRE IMP", texture: "fireImp", hp: 66, atk: 20, def: 3, exp: 105, gold: 66, weakness: "ice" },
  salamander: { name: "SALAMANDER", texture: "salamander", hp: 90, atk: 21, def: 5, exp: 130, gold: 80, weakness: "bolt" },
  flameDrake: {
    name: "FLAME DRAKE",
    texture: "flameDrake",
    hp: 280,
    atk: 25,
    def: 8,
    exp: 600,
    gold: 700,
    boss: true, // VOLCANO superboss: the last region, past the GLACIER GOLEM
    weakness: "ice",
  },
};

// Bosses can't be caught (throwCandy refuses them), and rare monsters are a
// bonus jackpot — not required — so bestiary completion is measured against
// this list, not every entry in ENEMIES.
export const CATCHABLE = Object.values(ENEMIES).filter((e) => !e.boss && !e.rare);

export function allSpeciesCaught(caught: string[]): boolean {
  return CATCHABLE.every((e) => caught.includes(e.name));
}
