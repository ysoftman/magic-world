import { MIN_DAMAGE_SHARE } from "./battleRules";

// LIMIT: a gauge every fight fills, and one great blow when it is full. It
// carries from fight to fight (GameState.limit, saved with the rest), so the
// choice is when to spend it: on the foe in front, or kept for the boss's
// wind-up or a finish that must not miss.
//
// Rules, and why:
// - It fills by shares, so it is the same at every level: the whole of a
//   foe's HP dealt is LIMIT_DEALT of the gauge, the whole of the hero's max
//   HP lost LIMIT_TAKEN, a PARRY LIMIT_PARRY on top. Being hit fills it
//   faster than hitting does: a fight going badly is the one that needs it.
//   An ordinary fight at its region's level (all of the foe, 5-10% of the
//   hero) is 28-34, a full gauge every three or four fights; a boss fight
//   (40-60% lost) fills it once by its middle. The companion's blows and a
//   burn or poison ticking on the foe count as dealt, the foe's poison on
//   the hero as taken; healing either side gives nothing back.
// - The blow is FIGHT's roll on ATK x LIMIT_MULT in a tighter spread, less
//   DEF: no crit, no combo bonus, no weakness, so it is the same known
//   number on any foe. At Lv30 (ATK 47, DEF 5) ~112 against HEAVY CLEAVE's
//   97 and BLACK HOLE's 92, at Lv6 ~28 of the KING SLIME's 100: a quarter to
//   a half of a boss at its level, never the whole. It costs no MP, leaves
//   the combo as it is and doesn't fill the gauge it empties.
// - The TRAINING YARD keeps it full, as it keeps HP and MP, and never writes
//   the saved gauge: the yard is where it can be tried.
// LIMIT_MULT was 3 and LIMIT_TAKEN 150 at first: with PARRY, PERFECT and the
// perks beside it (sim:battle --parry 0.4 --perfect 0.4 --limit 50 --perks
// ...), the blow was worth four or five FIGHTs to a hero short on ATK (3 x
// ATK less the same DEF) and a long boss fight filled it twice; solo in the
// intended gear the bosses took 34-45% of max HP where they had taken
// 53-103%. At 2.5 and 120 that is 38-49%, the rest being the perks' and
// the PARRY's share.
export const LIMIT_MAX = 100;
export const LIMIT_DEALT = 22;
export const LIMIT_TAKEN = 120;
export const LIMIT_PARRY = 6;
export const LIMIT_MULT = 2.5;

export const limitDealt = (dmg: number, foeMaxHp: number): number => (dmg / foeMaxHp) * LIMIT_DEALT;
export const limitTaken = (dmg: number, heroMaxHp: number): number => (dmg / heroMaxHp) * LIMIT_TAKEN;
export const limitFull = (gauge: number): boolean => gauge >= LIMIT_MAX;
export const chargeLimit = (gauge: number, gain: number): number => Math.min(LIMIT_MAX, gauge + Math.max(0, gain));

/** The LIMIT blow: ATK x LIMIT_MULT x 0.9-1.1 less DEF, never under FIGHT's floor. */
export function limitDamage(atk: number, def: number, rand: () => number = Math.random): number {
  const roll = Math.floor(atk * LIMIT_MULT * (0.9 + rand() * 0.2));
  return Math.max(Math.ceil(roll * MIN_DAMAGE_SHARE), roll - def);
}
