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
//   hero) is 30-37, a full gauge every three fights or so; a boss fight
//   (40-60% lost) fills it once by its middle. The companion's blows and a
//   burn or poison ticking on the foe count as dealt, the foe's poison on
//   the hero as taken; healing either side gives nothing back.
// - The blow is FIGHT's roll on ATK x LIMIT_MULT in a tighter spread, less
//   DEF: no crit, no combo bonus, no weakness, so it is the same known
//   number on any foe. At Lv30 (ATK 47, DEF 5) ~136 against HEAVY CLEAVE's
//   97 and BLACK HOLE's 92, at Lv6 ~34 of the KING SLIME's 100: a third to
//   a half of a boss at its level, never the whole. It costs no MP, leaves
//   the combo as it is and doesn't fill the gauge it empties.
// - The TRAINING YARD keeps it full, as it keeps HP and MP, and never writes
//   the saved gauge: the yard is where it can be tried.
export const LIMIT_MAX = 100;
export const LIMIT_DEALT = 22;
export const LIMIT_TAKEN = 150;
export const LIMIT_PARRY = 6;
export const LIMIT_MULT = 3;

export const limitDealt = (dmg: number, foeMaxHp: number): number => (dmg / foeMaxHp) * LIMIT_DEALT;
export const limitTaken = (dmg: number, heroMaxHp: number): number => (dmg / heroMaxHp) * LIMIT_TAKEN;
export const limitFull = (gauge: number): boolean => gauge >= LIMIT_MAX;
export const chargeLimit = (gauge: number, gain: number): number => Math.min(LIMIT_MAX, gauge + Math.max(0, gain));

/** The LIMIT blow: ATK x LIMIT_MULT x 0.9-1.1 less DEF, never under FIGHT's floor. */
export function limitDamage(atk: number, def: number, rand: () => number = Math.random): number {
  const roll = Math.floor(atk * LIMIT_MULT * (0.9 + rand() * 0.2));
  return Math.max(Math.ceil(roll * MIN_DAMAGE_SHARE), roll - def);
}
