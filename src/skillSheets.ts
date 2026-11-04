// The battle skills' sheets (skillFx.ts plays them), apart from skillFx.ts so
// fx.ts can take them into its table of sheets by key without importing back
// the module that imports its playFx: only pixelfx and a type come in here.
import { clearFrame, createFrame, createFx, type FxFrame, type FxModule } from "pixelfx";
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

// the painter pixelfx hands an effect's draw: only its frame is read here
interface Painting {
  frame: FxFrame;
}

const addLight = (d: number, l: number): number =>
  (255 << 24) |
  (Math.min(255, ((d >>> 16) & 255) + ((l >>> 16) & 255)) << 16) |
  (Math.min(255, ((d >>> 8) & 255) + ((l >>> 8) & 255)) << 8) |
  Math.min(255, (d & 255) + (l & 255));

/**
 * `mod` with its columns from..to (effect pixels right of its origin)
 * squeezed into `len`, a column dropped every so often (nearest neighbour):
 * an effect of a fixed length, fitted to the gap between the hero and the
 * foe. Both layers come out together, so a squeezed sheet has no `layer`.
 */
function squeezeX(mod: FxModule, from: number, to: number, len: number): FxModule {
  const cut = to - from - len;
  const [w, h] = mod.meta.size;
  const squeezed = {
    meta: { ...mod.meta, size: [w - cut, h] as [number, number] },
    create(o: Record<string, unknown>) {
      const inner = createFx(mod, o);
      let tmp: FxFrame | undefined;
      return {
        update: (dt: number): void => inner.update(dt),
        draw: (p: Painting): void => {
          const dst = p.frame;
          if (!tmp || tmp.w !== dst.w + cut || tmp.h !== dst.h || tmp.ox !== dst.ox || tmp.oy !== dst.oy)
            tmp = createFrame(dst.w + cut, dst.h, dst.ox, dst.oy);
          clearFrame(tmp);
          inner.draw(tmp);
          for (let c = 0; c < dst.w; c++) {
            const x = c + dst.ox;
            const sx = x < from ? x : x < from + len ? from + Math.floor(((x - from) * (to - from)) / len) : x + cut;
            const sc = sx - dst.ox;
            for (let r = 0; r < dst.h; r++) {
              const i = r * tmp.w + sc;
              const j = r * dst.w + c;
              if (tmp.color[i]) dst.color[j] = tmp.color[i];
              if (tmp.light[i] & 0xffffff) dst.light[j] = addLight(dst.light[j], tmp.light[i]);
            }
          }
        },
      };
    },
  };
  return squeezed;
}

// ordered dither thresholds (4x4 Bayer), as pixelfx's own fades use
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/**
 * `mod` with its solid pixels dithered away over the last `edge` pixels of
 * the frame on every side, as fx.ts fades the glow (EDGE_FADE): smoke, a
 * flame's crown or a falling star the crop cuts off thins out into the
 * backdrop instead of ending on a straight line under the stat windows.
 */
function soften(mod: FxModule, edge = 8): FxModule {
  const softened = {
    meta: mod.meta,
    create(o: Record<string, unknown>) {
      const inner = createFx(mod, o);
      return {
        update: (dt: number): void => inner.update(dt),
        draw: (p: Painting): void => {
          const f = p.frame;
          inner.draw(f);
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
        },
      };
    },
  };
  return softened;
}

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
  "fx-sk-beam": {
    fx: squeezeX(arcaneBeam, BEAM_HX + 15, BEAM_HX + BEAM_L - 24, BEAM_L - 39 - BEAM_CUT),
    span: [0, 1.2],
    frames: 18,
    focus: [BEAM_HX, BEAM_HY],
    sameOnBoss: true,
    crop: [22, 28, 22 + 187, 86],
  },
  "fx-sk-thorns": { fx: thorns, span: [0.06, 2], frames: 18, focus: [114, 0], sameOnBoss: true, crop: [48, 20, 48 + 140, 86] },
  "fx-sk-missiles": {
    fx: soften(arcaneMissiles),
    span: [0, 1.45],
    frames: 22,
    focus: [15, -24],
    sameOnBoss: true,
    crop: [24, 27, 24 + 214, 93],
  },
  "fx-sk-pillar": {
    fx: soften(flamePillar),
    opts: { height: 38 },
    span: [0.2, 2.3],
    frames: 18,
    sameOnBoss: true,
    crop: [52, 174, 132, 240],
  },
  "fx-sk-chain": {
    fx: chainLightning,
    opts: { palette: BOLT_RAMP, sparks: ["#ffffff", "#fef08a", "#fde047", "#6366f1"] },
    span: [0, 1.3],
    frames: 18,
    focus: [150, 0],
    sameOnBoss: true,
    crop: [42, 32, 210, 90],
  },
  "fx-sk-spikes": {
    fx: soften(iceSpikes),
    opts: { reach: 190, height: 44 },
    span: [0, 2.1],
    frames: 21,
    sameOnBoss: true,
    crop: [16, 38, 220, 104],
  },
  "fx-sk-laser": { fx: laserBolt, opts: { length: 32 }, span: [0, 8 / 30], frames: 8, sameOnBoss: true, crop: [64, 8, 116, 25] },
  "fx-sk-laser-hit": {
    fx: hitSpark,
    opts: { palette: LASER_RAMP, height: 16 },
    span: [0, 0.45],
    focus: [0, -16],
    sameOnBoss: true,
    crop: [0, 0, 136, 68],
  },
  "fx-sk-drain": { fx: soften(soulDrain), span: [1.75, 3.55], frames: 20, focus: [0, -50], sameOnBoss: true, crop: [16, 22, 205, 88] },
  "fx-sk-quake": { fx: soften(quake), opts: { reach: 48 }, span: [0, 1.9], frames: 18, sameOnBoss: true, crop: [76, 30, 212, 96] },
  "fx-sk-emp": { fx: empBlast, opts: { radius: 40 }, span: [0.1, 2.1], frames: 18, sameOnBoss: true, crop: [20, 26, 132, 92] },
  "fx-sk-smite": { fx: soften(smite), opts: { light: 0.5 }, span: [0.1, 1.9], frames: 18, sameOnBoss: true, crop: [42, 90, 182, 156] },
  "fx-sk-meteor": { fx: soften(meteor), opts: { light: 0.5 }, span: [0.3, 1.5], frames: 15, sameOnBoss: true, crop: [40, 150, 226, 216] },
  "fx-sk-stars": { fx: soften(starFall), opts: { seed: 208 }, span: [0.25, 1.8], frames: 20, sameOnBoss: true, crop: [34, 92, 186, 158] },
  "fx-sk-void": {
    fx: soften(darkExplosion),
    opts: { light: 0.6 },
    span: [0, 2.2],
    frames: 20,
    focus: [0, -54],
    sameOnBoss: true,
    crop: [86, 114, 194, 174],
  },
};
