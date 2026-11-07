// The battle skills' sheets (skillFx.ts plays them), apart from skillFx.ts so
// fx.ts can take them into its table of sheets by key without importing back
// the module that imports its playFx: only pixelfx, the shared wrappers
// (sheetFx.ts) and a type come in here.
import * as arcaneBeam from "pixelfx/fx/arcane/arcane-beam";
import * as arcaneMissiles from "pixelfx/fx/arcane/arcane-missiles";
import * as starFall from "pixelfx/fx/arcane/star-fall";
import * as flamePillar from "pixelfx/fx/fire/flame-pillar";
import * as meteor from "pixelfx/fx/fire/meteor";
import * as smite from "pixelfx/fx/holy/smite";
import * as iceSpikes from "pixelfx/fx/ice/ice-spikes";
import * as hitSpark from "pixelfx/fx/impacts/hit-spark";
import * as chainLightning from "pixelfx/fx/lightning/chain-lightning";
import * as quake from "pixelfx/fx/nature/quake";
import * as thorns from "pixelfx/fx/nature/thorns";
import * as laserBolt from "pixelfx/fx/projectiles/laser-bolt";
import * as empBlast from "pixelfx/fx/scifi/emp-blast";
import * as darkExplosion from "pixelfx/fx/shadow/dark-explosion";
import * as soulDrain from "pixelfx/fx/shadow/soul-drain";
import type { PixelSheet } from "./fx";
import { soften, squeezeX } from "./sheetFx";

// BOLT's ramp (fx.ts BOLT_RAMP): indigo edges round a yellow and white core,
// so the chain reads as lightning, not ICE
const BOLT_RAMP = ["#120a33", "#2a1b78", "#4338ca", "#6366f1", "#a5b4fc", "#fde047", "#fef08a", "#ffffff"];
// the laser's own red (projectiles/laser-bolt), for its sparks on the foe
const LASER_RAMP = ["#2a0610", "#5c0d1c", "#9a1428", "#d8243a", "#ff4d5e", "#ff8a94", "#ffffff"];

// arcane-beam: its source at (15, -24), its end 168 further right
const BEAM_HX = 15;
const BEAM_HY = -24;
const BEAM_L = 168;
// the beam's middle squeezed so its end lands this far from the hand: 576px
export const BEAM_REACH = 144;
const BEAM_CUT = BEAM_L - BEAM_REACH;

export const SKILL_SHEETS: Record<string, PixelSheet> = {
  // whole frames: skillFx.ts shows the beam a share of its frame's width at a
  // time (setCrop), which a trimmed frame would cut in its own box
  "fx-sk-beam": {
    fx: squeezeX(arcaneBeam, BEAM_HX + 15, BEAM_HX + BEAM_L - 24, BEAM_L - 39 - BEAM_CUT),
    span: [0, 1.2],
    frames: 18,
    focus: [BEAM_HX, BEAM_HY],
    crop: [22, 28, 22 + 187, 86],
    trimFrames: false,
  },
  "fx-sk-thorns": { fx: thorns, span: [0.06, 2], frames: 18, focus: [114, 0], crop: [48, 20, 48 + 140, 86] },
  "fx-sk-missiles": {
    fx: soften(arcaneMissiles),
    span: [0, 1.45],
    frames: 22,
    focus: [15, -24],
    crop: [24, 27, 24 + 214, 93],
  },
  "fx-sk-pillar": {
    fx: soften(flamePillar),
    opts: { height: 38 },
    span: [0.2, 2.3],
    frames: 18,
    crop: [52, 174, 132, 240],
  },
  "fx-sk-chain": {
    fx: chainLightning,
    opts: { palette: BOLT_RAMP, sparks: ["#ffffff", "#fef08a", "#fde047", "#6366f1"] },
    span: [0, 1.3],
    frames: 18,
    focus: [150, 0],
    crop: [42, 32, 210, 90],
  },
  "fx-sk-spikes": {
    fx: soften(iceSpikes),
    opts: { reach: 190, height: 44 },
    span: [0, 2.1],
    frames: 21,
    crop: [16, 38, 220, 104],
  },
  "fx-sk-laser": { fx: laserBolt, opts: { length: 32 }, span: [0, 8 / 30], frames: 8, crop: [64, 8, 116, 25] },
  "fx-sk-laser-hit": {
    fx: hitSpark,
    opts: { palette: LASER_RAMP, height: 16 },
    span: [0, 0.45],
    focus: [0, -16],
    crop: [0, 0, 136, 68],
  },
  "fx-sk-drain": { fx: soften(soulDrain), span: [1.75, 3.55], frames: 20, focus: [0, -50], crop: [16, 22, 205, 88] },
  "fx-sk-quake": { fx: soften(quake), opts: { reach: 48 }, span: [0, 1.9], frames: 18, crop: [76, 30, 212, 96] },
  "fx-sk-emp": { fx: empBlast, opts: { radius: 40 }, span: [0.1, 2.1], frames: 18, crop: [20, 26, 132, 92] },
  "fx-sk-smite": { fx: soften(smite), opts: { light: 0.5 }, span: [0.1, 1.9], frames: 18, crop: [42, 90, 182, 156] },
  "fx-sk-meteor": { fx: soften(meteor), opts: { light: 0.5 }, span: [0.3, 1.5], frames: 15, crop: [40, 150, 226, 216] },
  "fx-sk-stars": { fx: soften(starFall), opts: { seed: 208 }, span: [0.25, 1.8], frames: 20, crop: [34, 92, 186, 158] },
  "fx-sk-void": {
    fx: soften(darkExplosion),
    opts: { light: 0.6 },
    span: [0, 2.2],
    frames: 20,
    focus: [0, -54],
    crop: [86, 114, 194, 174],
  },
};
