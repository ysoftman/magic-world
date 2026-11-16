// PERKS: what a level-up lets the hero choose. Every fourth level from Lv4 to
// Lv28 opens one tier, a pair to take one of with the ELDER in town, for
// good. Seven choices make a build: two heroes of one level and one kit no
// longer fight alike.
//
// Rules, and why:
// - Saved as the list of keys taken, tier by tier (GameState.perks). A tier
//   is due once the hero's level reaches it and the tiers before it are
//   taken, so a save from before perks (or a hero who walked past the ELDER
//   for ten levels) picks the ones it is owed one after another. HARD MODE
//   keeps them, as it keeps the level.
// - No taking one back: VIGOR and FOCUS are added to the hero's own max HP
//   and MP the moment they are taken, and a choice that can be undone for
//   gold is a setting, not a build.
// - Asked as a touch question holds it (DialogueBox): two choices, the
//   names five glyphs at most, and one row of 42 glyphs for both effects
//   (twelve glyphs at most each: "TAMER: CATCH +15%. PACK: ALLY ATK+20%." is
//   38).
// - A tenth or so each, as a relic's stack is (relics.ts): MIGHT and WALL
//   are in GameState.effAtk/effDef, so the bag's figures and the battle's
//   agree; the rest are read where the battle pays, rolls or counts
//   (BattleScene), none inside a blow's own roll. scripts/sim-battle.ts
//   takes them with --perks.
export type PerkKey =
  | "might"
  | "wall"
  | "vigor"
  | "focus"
  | "trade"
  | "study"
  | "flow"
  | "surge"
  | "mend"
  | "fleet"
  | "tamer"
  | "pack"
  | "break"
  | "calm";

interface PerkDef {
  name: string;
  // as the ELDER words it
  effect: string;
  // the figure its hook reads
  value: number;
}

export const PERKS: Record<PerkKey, PerkDef> = {
  // on the worn total (GameState.effAtk / effDef)
  might: { name: "MIGHT", effect: "ATK +8%", value: 0.08 },
  wall: { name: "WALL", effect: "DEF +8%", value: 0.08 },
  // added to the hero's own maximum when taken (GameState.takePerk)
  vigor: { name: "VIGOR", effect: "MAX HP +15", value: 15 },
  focus: { name: "FOCUS", effect: "MAX MP +10", value: 10 },
  // on a won fight's gold and EXP
  trade: { name: "TRADE", effect: "GOLD +10%", value: 0.1 },
  study: { name: "STUDY", effect: "EXP +10%", value: 0.1 },
  // the combo's bonus (10% a step becomes 12.5%), and what fills the LIMIT gauge
  flow: { name: "FLOW", effect: "COMBO x1.25", value: 0.25 },
  surge: { name: "SURGE", effect: "GAUGE +25%", value: 0.25 },
  // of max HP after a win, on the usual +5; and RUN's even odds raised
  mend: { name: "MEND", effect: "WIN HEAL 5%", value: 0.05 },
  fleet: { name: "FLEET", effect: "RUN 80%", value: 0.3 },
  // added to a CANDY's chance; and on the companion's attack power
  tamer: { name: "TAMER", effect: "CATCH +15%", value: 0.15 },
  pack: { name: "PACK", effect: "ALLY ATK+20%", value: 0.2 },
  // the LIMIT blow's damage; and MP after a win, on the usual +2
  break: { name: "BREAK", effect: "LIMIT x1.25", value: 0.25 },
  calm: { name: "CALM", effect: "WIN MP +4", value: 4 },
};

export const PERK_TIERS: ReadonlyArray<{ level: number; pair: readonly [PerkKey, PerkKey] }> = [
  { level: 4, pair: ["might", "wall"] },
  { level: 8, pair: ["vigor", "focus"] },
  { level: 12, pair: ["trade", "study"] },
  { level: 16, pair: ["flow", "surge"] },
  { level: 20, pair: ["mend", "fleet"] },
  { level: 24, pair: ["tamer", "pack"] },
  { level: 28, pair: ["break", "calm"] },
];

/** The tier a hero of `level` with `taken` may pick now, or null. */
export function perkDue(taken: readonly PerkKey[], level: number): (typeof PERK_TIERS)[number] | null {
  const tier = PERK_TIERS[taken.length];
  return tier && level >= tier.level ? tier : null;
}

/** Whether going from level `from` to `to` opened a tier (the level-up's note). */
export const perkOpened = (from: number, to: number): boolean => PERK_TIERS.some((t) => t.level > from && t.level <= to);

/** A save's list as far as it is sound: each key one of its own tier's pair. */
export function soundPerks(data: unknown): PerkKey[] {
  const out: PerkKey[] = [];
  if (!Array.isArray(data)) return out;
  for (const [i, key] of data.entries()) {
    if (i >= PERK_TIERS.length || !PERK_TIERS[i].pair.includes(key)) break;
    out.push(key);
  }
  return out;
}

/** What `key` adds where its hook reads it, 0 when it isn't among `taken`. */
export const perkValue = (taken: readonly PerkKey[], key: PerkKey): number => (taken.includes(key) ? PERKS[key].value : 0);

/** The names taken, for the journal's line: seven are 39 glyphs. */
export const perkLine = (taken: readonly PerkKey[]): string => taken.map((k) => PERKS[k].name).join(" ");
