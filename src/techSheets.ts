// The battle techs' sheets (techFx.ts plays them), apart from techFx.ts so
// fx.ts can take them into its table of sheets by key without importing back
// the module that imports its playFx: only pixelfx, the shared wrappers and
// reach (sheetFx.ts) and a type come in here.
import * as implosion from "pixelfx/fx/explosions/implosion";
import * as fireTornado from "pixelfx/fx/fire/fire-tornado";
import * as frostNova from "pixelfx/fx/ice/frost-nova";
import * as thunderclap from "pixelfx/fx/lightning/thunderclap";
import * as daggerFlurry from "pixelfx/fx/melee/dagger-flurry";
import * as doubleSlash from "pixelfx/fx/melee/double-slash";
import * as heavyCleave from "pixelfx/fx/melee/heavy-cleave";
import * as scytheReap from "pixelfx/fx/melee/scythe-reap";
import * as spearSweep from "pixelfx/fx/melee/spear-sweep";
import * as spinSlash from "pixelfx/fx/melee/spin-slash";
import * as uppercut from "pixelfx/fx/melee/uppercut";
import * as whipCrack from "pixelfx/fx/melee/whip-crack";
import * as blackHole from "pixelfx/fx/shadow/black-hole";
import type { PixelSheet } from "./fx";
import { around, DOWN, FEET_UP, GROUND_UP, half, soften } from "./sheetFx";

// A body with nothing in it (o.actor): thunderclap lights its caster white
// for a frame, and pixelfx's stand-in, a 24x38 figure, would show as a white
// doll over the foe (statusFx.ts paints a battler's own instead).
const NO_BODY = {
  mask: { w: 1, h: 1, data: new Uint8Array(1) },
  pixels: new Uint32Array(1),
  x: 0,
  y: -1,
  w: 1,
  h: 1,
  k: 2,
  head: [0, -1],
  chest: [0, -1],
  eyes: [],
};

// the glow at half (meta.options light), as the skills' sheets have it
const LIGHT = 0.5;

// Where each weapon tech's blow lands, in its effect's pixels from its
// anchor (the fighter's feet, pixelfx's stand-in some 60 cells off): played
// with that point on the foe's feet, so the cut crosses its body. The hero
// stands 20 cells left of the foe (BattleScene's dash), so the effect's own
// fighter is off to the hero's left, behind it.
const DOUBLE_FOCUS: [number, number] = [38, 0];
const UPPER_FOCUS: [number, number] = [19, -27];
// the whip's length, so its handle is in the hero's hand and its tip cracks
// on the foe: the hand 11 cells from the anchor, the tip L further
const WHIP_L = 24;
// its tip 4 cells into the foe, and the whole 9 cells down: the whip 12
// cells over the feet, at the hero's hand, not its face (its sparks' floor
// goes under the crop)
const WHIP_FOCUS: [number, number] = [11 + WHIP_L - 4, -9];
const FLURRY_FOCUS: [number, number] = [32, 0];
// heavy-cleave's arc meets the floor 31 cells in front of its fighter
const CLEAVE_FOCUS: [number, number] = [31, 0];
const REAP_FOCUS: [number, number] = [8, -4];
// spin-slash's ring round the hero, wide enough to cut through the foe 20 cells off
const SPIN_R = 28;

const DOUBLE: PixelSheet = {
  fx: soften(doubleSlash),
  opts: { light: LIGHT },
  span: [0, 0.6],
  frames: 9,
  focus: DOUBLE_FOCUS,
  crop: around(doubleSlash, DOUBLE_FOCUS, 40, FEET_UP, 60, DOWN),
};

const SWEEP: PixelSheet = {
  fx: soften(spearSweep),
  opts: { light: LIGHT },
  span: [0, 0.9],
  frames: 14,
  crop: around(spearSweep, [0, 0], 82, GROUND_UP, 92, DOWN),
};

const SPIN: PixelSheet = {
  fx: soften(spinSlash),
  opts: { light: LIGHT, radius: SPIN_R },
  span: [0, 0.45],
  frames: 7,
  crop: around(spinSlash, [0, 0], 62, FEET_UP, 74, DOWN),
};

const CLEAVE: PixelSheet = {
  fx: soften(heavyCleave),
  opts: { light: LIGHT },
  span: [0.22, 1.12],
  frames: 14,
  focus: CLEAVE_FOCUS,
  crop: around(heavyCleave, CLEAVE_FOCUS, 60, GROUND_UP, 64, DOWN),
};

// SCYTHE REAP drains: its blade and wisps in a violet body with a magenta-red
// edge (C[5]) and pink highlight (C[6]) for the blood it draws, its weight on
// the violet so it is not the BAT's crimson BLOOD SIP (fx.ts fx-sip, fx-claw);
// the default's pale teal ghost edge read as ICE
const REAP_RAMP = ["#0a0410", "#190a2a", "#2c1046", "#46186a", "#6a2894", "#c42a78", "#f59ac8", "#ffffff"];

const REAP: PixelSheet = {
  fx: soften(scytheReap),
  opts: { light: LIGHT, palette: REAP_RAMP },
  span: [0.05, 1.25],
  frames: 18,
  focus: REAP_FOCUS,
  crop: around(scytheReap, REAP_FOCUS, 66, FEET_UP, 64, DOWN),
};

const CLAP: PixelSheet = {
  fx: soften(thunderclap),
  opts: { light: LIGHT, reach: 40, actor: NO_BODY },
  // from its first frame: the sparks rushing in before the clap (0.12s) give
  // it a beat of warning; from 0.06 it went off 74ms into the cast
  span: [0, 1.0],
  frames: 15,
  crop: around(thunderclap, [0, 0], 70, GROUND_UP, 70, DOWN),
};

const NOVA: PixelSheet = {
  fx: soften(frostNova),
  opts: { light: LIGHT, reach: 40 },
  span: [0.2, 1.6],
  frames: 21,
  crop: around(frostNova, [0, 0], 60, GROUND_UP, 60, DOWN),
};

const HOLE_FX = half(blackHole);
const POP_FX = half(implosion);

export const TECH_SHEETS: Record<string, PixelSheet> = {
  "fx-tk-double": DOUBLE,
  "fx-tk-upper": {
    fx: soften(uppercut),
    opts: { light: LIGHT },
    span: [0, 0.6],
    frames: 9,
    focus: UPPER_FOCUS,
    crop: around(uppercut, UPPER_FOCUS, 50, FEET_UP, 46, DOWN),
  },
  "fx-tk-whip": {
    fx: soften(whipCrack),
    opts: { light: LIGHT, length: WHIP_L },
    span: [0.05, 0.6],
    frames: 9,
    focus: WHIP_FOCUS,
    crop: around(whipCrack, WHIP_FOCUS, 28, FEET_UP, 44, DOWN),
  },
  "fx-tk-flurry": {
    fx: soften(daggerFlurry),
    opts: { light: LIGHT },
    span: [0, 0.75],
    frames: 12,
    focus: FLURRY_FOCUS,
    crop: around(daggerFlurry, FLURRY_FOCUS, 40, FEET_UP, 60, DOWN),
  },
  "fx-tk-sweep-back": { ...SWEEP, layer: "back" },
  "fx-tk-sweep": { ...SWEEP, layer: "front" },
  "fx-tk-spin-back": { ...SPIN, layer: "back" },
  "fx-tk-spin": { ...SPIN, layer: "front" },
  "fx-tk-cleave-back": { ...CLEAVE, layer: "back" },
  "fx-tk-cleave": { ...CLEAVE, layer: "front" },
  "fx-tk-reap-back": { ...REAP, layer: "back" },
  "fx-tk-reap": { ...REAP, layer: "front" },
  "fx-tk-tornado": {
    fx: soften(fireTornado),
    opts: { light: LIGHT, height: 44 },
    span: [0, 1.2],
    frames: 18,
    crop: around(fireTornado, [0, 0], 40, GROUND_UP, 40, DOWN),
  },
  "fx-tk-clap-back": { ...CLAP, layer: "back" },
  "fx-tk-clap": { ...CLAP, layer: "front" },
  "fx-tk-nova-back": { ...NOVA, layer: "back" },
  "fx-tk-nova": { ...NOVA, layer: "front" },
  "fx-tk-hole": {
    fx: soften(HOLE_FX),
    opts: { light: LIGHT },
    span: [0, 1],
    frames: 15,
    focus: [0, -35],
    crop: around(HOLE_FX, [0, -35], 36, 30, 36, 24),
  },
  "fx-tk-pop": {
    fx: soften(POP_FX),
    opts: { light: LIGHT },
    span: [0.6, 1.5],
    frames: 14,
    crop: around(POP_FX, [0, 0], 36, 30, 36, 30),
  },
};
