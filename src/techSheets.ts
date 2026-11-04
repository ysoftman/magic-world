// The battle techs' sheets (techFx.ts plays them), apart from techFx.ts so
// fx.ts can take them into its table of sheets by key without importing back
// the module that imports its playFx: only pixelfx and a type come in here.
import { clearFrame, createFrame, createFx, type FxFrame, type FxModule } from "pixelfx";
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

// the painter pixelfx hands an effect's draw: only its frame is read here
interface Painting {
  frame: FxFrame;
}

// How far a sheet may reach from the point it is played on, in art cells
// (4px): the stat windows end at y 200, so nothing goes over y 224 above the
// ground or 204 above a flier (its feet at 392), and the menu rows start
// under the ground, so nothing goes under y 488. From the foe's feet a sheet
// keeps to 46 cells up (a flier's) and 8 down (a foe on the ground's); from
// the ground under it, 58 up and 8 down.
const FEET_UP = 46;
const GROUND_UP = 58;
const DOWN = 8;

/**
 * The crop of `mod`'s canvas round the point `focus` (the effect's pixels
 * from its anchor) that playTech puts on the foe's feet or the ground:
 * `left`, `up`, `right` and `down` cells of it.
 */
function around(
  mod: FxModule,
  focus: [number, number],
  left: number,
  up: number,
  right: number,
  down: number,
): [number, number, number, number] {
  const [ax, ay] = mod.meta.origin;
  const [x, y] = [ax + focus[0], ay + focus[1]];
  return [x - left, y - up, x + right, y + down];
}

// ordered dither thresholds (4x4 Bayer), as pixelfx's own fades use
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/**
 * `mod` with its solid pixels dithered away over the last `edge` pixels of
 * the frame on every side, as fx.ts fades the glow (EDGE_FADE): sparks, smoke
 * or a ring the crop cuts off thin out into the backdrop instead of ending on
 * a straight line under the stat windows.
 */
function soften(mod: FxModule, edge = 8): FxModule {
  return {
    meta: mod.meta,
    create(o: Record<string, unknown>) {
      const inner = createFx(mod, o);
      const dither = (f: FxFrame): void => {
        for (let y = 0; y < f.h; y++)
          for (let x = 0; x < f.w; x++) {
            const e = Math.min(x, y, f.w - 1 - x, f.h - 1 - y);
            if (e >= edge) {
              x = Math.max(x, f.w - edge - 1);
              continue;
            }
            const i = y * f.w + x;
            if (f.color[i] && (e + 0.5) / edge <= BAYER[((y & 3) << 2) | (x & 3)]) f.color[i] = 0;
          }
      };
      return {
        update: (dt: number): void => inner.update(dt),
        drawBack: (p: Painting): void => {
          inner.draw(p.frame, "back");
          dither(p.frame);
        },
        draw: (p: Painting): void => {
          inner.draw(p.frame, "front");
          dither(p.frame);
        },
      };
    },
  } as FxModule;
}

const luma = (c: number): number => (c & 255) * 0.299 + ((c >>> 8) & 255) * 0.587 + ((c >>> 16) & 255) * 0.114;

/**
 * `mod` at half its size, still a pixelfx pixel to an art cell: each 2x2 of
 * its pixels becomes one, the brightest solid one where two or more are
 * solid (or a lone bright one: a spark, a ring's thin line), the light
 * averaged. For an effect much bigger than a 32-cell foe with no size of its
 * own to turn down (a black hole's disk, 124 cells across).
 */
function half(mod: FxModule): FxModule {
  const [w, h] = mod.meta.size;
  const [ax, ay] = mod.meta.origin;
  return {
    meta: { ...mod.meta, size: [Math.ceil(w / 2), Math.ceil(h / 2)], origin: [Math.round(ax / 2), Math.round(ay / 2)] },
    create(o: Record<string, unknown>) {
      const inner = createFx(mod, o);
      let tmp: FxFrame | undefined;
      const down = (dst: FxFrame, layer: "back" | "front"): void => {
        if (!tmp || tmp.w !== dst.w * 2 || tmp.h !== dst.h * 2 || tmp.ox !== dst.ox * 2 || tmp.oy !== dst.oy * 2)
          tmp = createFrame(dst.w * 2, dst.h * 2, dst.ox * 2, dst.oy * 2);
        clearFrame(tmp);
        inner.draw(tmp, layer);
        const { color, light } = tmp;
        for (let r = 0; r < dst.h; r++)
          for (let c = 0; c < dst.w; c++) {
            const s = [2 * r * tmp.w + 2 * c, 2 * r * tmp.w + 2 * c + 1, (2 * r + 1) * tmp.w + 2 * c, (2 * r + 1) * tmp.w + 2 * c + 1];
            let best = 0;
            let bright = -1;
            let solid = 0;
            let lr = 0;
            let lg = 0;
            let lb = 0;
            for (const i of s) {
              const k = color[i];
              if (k >>> 24) {
                solid++;
                const y = luma(k) * ((k >>> 24) / 255);
                if (y > bright) {
                  bright = y;
                  best = k;
                }
              }
              const l = light[i];
              lr += l & 255;
              lg += (l >>> 8) & 255;
              lb += (l >>> 16) & 255;
            }
            const j = r * dst.w + c;
            if (solid >= 2 || (solid === 1 && bright >= 128)) dst.color[j] = best;
            if (lr || lg || lb) dst.light[j] = (255 << 24) | (Math.round(lb / 4) << 16) | (Math.round(lg / 4) << 8) | Math.round(lr / 4);
          }
      };
      return {
        update: (dt: number): void => inner.update(dt),
        drawBack: (p: Painting): void => down(p.frame, "back"),
        draw: (p: Painting): void => down(p.frame, "front"),
      };
    },
  } as FxModule;
}

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
  sameOnBoss: true,
  crop: around(doubleSlash, DOUBLE_FOCUS, 40, FEET_UP, 60, DOWN),
};

const SWEEP: PixelSheet = {
  fx: soften(spearSweep),
  opts: { light: LIGHT },
  span: [0, 0.9],
  frames: 14,
  sameOnBoss: true,
  crop: around(spearSweep, [0, 0], 82, GROUND_UP, 92, DOWN),
};

const SPIN: PixelSheet = {
  fx: soften(spinSlash),
  opts: { light: LIGHT, radius: SPIN_R },
  span: [0, 0.45],
  frames: 7,
  sameOnBoss: true,
  crop: around(spinSlash, [0, 0], 62, FEET_UP, 74, DOWN),
};

const CLEAVE: PixelSheet = {
  fx: soften(heavyCleave),
  opts: { light: LIGHT },
  span: [0.22, 1.12],
  frames: 14,
  focus: CLEAVE_FOCUS,
  sameOnBoss: true,
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
  sameOnBoss: true,
  crop: around(scytheReap, REAP_FOCUS, 66, FEET_UP, 64, DOWN),
};

const CLAP: PixelSheet = {
  fx: soften(thunderclap),
  opts: { light: LIGHT, reach: 40, actor: NO_BODY },
  span: [0.06, 1.0],
  frames: 14,
  sameOnBoss: true,
  crop: around(thunderclap, [0, 0], 70, GROUND_UP, 70, DOWN),
};

const NOVA: PixelSheet = {
  fx: soften(frostNova),
  opts: { light: LIGHT, reach: 40 },
  span: [0.2, 1.6],
  frames: 21,
  sameOnBoss: true,
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
    sameOnBoss: true,
    crop: around(uppercut, UPPER_FOCUS, 50, FEET_UP, 46, DOWN),
  },
  "fx-tk-whip": {
    fx: soften(whipCrack),
    opts: { light: LIGHT, length: WHIP_L },
    span: [0.05, 0.6],
    frames: 9,
    focus: WHIP_FOCUS,
    sameOnBoss: true,
    crop: around(whipCrack, WHIP_FOCUS, 28, FEET_UP, 44, DOWN),
  },
  "fx-tk-flurry": {
    fx: soften(daggerFlurry),
    opts: { light: LIGHT },
    span: [0, 0.75],
    frames: 12,
    focus: FLURRY_FOCUS,
    sameOnBoss: true,
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
    sameOnBoss: true,
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
    sameOnBoss: true,
    crop: around(HOLE_FX, [0, -35], 36, 30, 36, 24),
  },
  "fx-tk-pop": {
    fx: soften(POP_FX),
    opts: { light: LIGHT },
    span: [0.6, 1.5],
    frames: 14,
    sameOnBoss: true,
    crop: around(POP_FX, [0, 0], 36, 30, 36, 30),
  },
};
