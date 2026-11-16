// The bosses' moves' sheets (BattleScene enemyBlast, enemyMove; monsters.ts
// EnemyMove), apart from fx.ts as the skills' and techs' are: only pixelfx,
// the shared wrappers (sheetFx.ts) and a type come in here. One boss's are
// warmed by its own battle (BattleScene warmStatuses), never at the title.
import * as frostNova from "pixelfx/fx/ice/frost-nova";
import * as bluntHit from "pixelfx/fx/impacts/blunt-hit";
import * as spearSweep from "pixelfx/fx/melee/spear-sweep";
import * as sporeBurst from "pixelfx/fx/nature/spore-burst";
import * as waveCrash from "pixelfx/fx/water/wave-crash";
import type { PixelSheet } from "./fx";
import { around, DOWN, GROUND_UP, soften } from "./sheetFx";

// the glow at half, as the skills' and techs' sheets have it
const LIGHT = 0.5;

export const BOSS_SHEETS: Record<string, PixelSheet> = {
  // SPLASH (KING SLIME): a wave rears up on the foe's side, rolls in and
  // breaks at the hero's feet (the effect's crest comes down at its anchor,
  // 1.2s in: 0.65s into this span), spray and foam after it. Drawn rolling
  // right, so mirrored onto the hero. From 0.55s, the swell already a hump.
  // In the slime's own reds: the effect's blue water was nothing of its.
  "fx-bs-splash": {
    fx: soften(waveCrash),
    opts: { light: LIGHT, palette: ["#2a0810", "#5e1220", "#a41e30", "#e03a44", "#f47a7c", "#ffc0bc", "#ffffff"] },
    span: [0.55, 2.15],
    frames: 20,
    directional: true,
    crop: around(waveCrash, [0, 0], 100, GROUND_UP, 60, DOWN),
  },
  // SPORES (MOSS GOLEM): a toadstool swells at the hero's feet and bursts
  // (0.87s in, 0.67s into this span) into a teal cloud that hangs and thins.
  // It comes up 14 cells to the hero's foe side (`focus`, mirrored with the
  // sheet): at its feet the stem stood over the hero.
  "fx-bs-spores": {
    fx: soften(sporeBurst),
    opts: { light: LIGHT },
    span: [0.2, 2.5],
    frames: 20,
    focus: [14, 0],
    directional: true,
    crop: around(sporeBurst, [14, 0], 70, GROUND_UP, 42, DOWN),
  },
  // SWEEP (FLAME DRAKE): the tail's low arc whipped round the hero's legs in
  // the drake's fire, dust rolling off it; the techs' SPEAR SWEEP in other
  // colours, mirrored so it comes from the foe's side.
  "fx-bs-sweep": {
    fx: soften(spearSweep),
    opts: { light: LIGHT, palette: ["#2a0a08", "#5e1a10", "#a4321a", "#e8642a", "#ffa64a", "#ffe0a0", "#ffffff"] },
    span: [0, 0.9],
    frames: 14,
    directional: true,
    crop: around(spearSweep, [0, 0], 82, GROUND_UP, 92, DOWN),
  },
  // ARMOR (GLACIER GOLEM): crystals erupt in a ring from its feet out past
  // its sides (it is 96 cells wide, the ring's reach 56) and stand; the
  // floor's frost after 1.8s is left off.
  "fx-bs-armor": {
    fx: soften(frostNova),
    opts: { light: LIGHT, reach: 56 },
    span: [0.2, 1.8],
    frames: 20,
    crop: around(frostNova, [0, 0], 76, GROUND_UP, 76, DOWN),
  },
  // FRENZY (TROLL KING), each blow of the club: a pale burst, spikes and a
  // ring of dust at the hero's feet, in place of the plain hit's sparks.
  "fx-bs-club": {
    fx: soften(bluntHit),
    opts: { light: LIGHT },
    span: [0, 0.6],
    frames: 9,
    crop: around(bluntHit, [0, 0], 46, 50, 46, DOWN),
  },
};
