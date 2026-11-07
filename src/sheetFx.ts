// What the skills' and techs' sheet tables (skillSheets.ts, techSheets.ts)
// share: wrappers that reshape a pixelfx effect before fx.ts bakes it, and
// how far a sheet may reach on the battle screen. Only pixelfx comes in
// here, so the tables, which fx.ts imports, never import back from fx.ts.
//
// A wrapper is itself a pixelfx effect module: it creates the effect it
// wraps (createFx) and draws it into the frame pixelfx hands its own draw
// (a painter's `frame`, the one field read here), or into a frame of its
// own that it then copies across. That frame may hold more than one texel to
// an effect pixel (hiresPaint.ts densityOf, a battle sheet's res): what a
// wrapper measures in effect pixels it measures in that many texels.
import { clearFrame, createFx, type FxFrame, type FxModule } from "pixelfx";
import { densityOf, finish, hiFrame, hiView } from "./hiresPaint";

// the painter pixelfx hands an effect's draw: only its frame is read here
interface Painting {
  frame: FxFrame;
}

// How far a sheet may reach from the point it is played on, in art cells
// (4px, every battler's cell, a boss's and a giant's too): the stat windows
// end at y 200, so nothing goes over y 224 above the ground or 204 above a
// flier (its feet at 392), and the menu rows start under the ground, so
// nothing goes under y 488. From the foe's feet a sheet keeps to 46 cells up
// (a flier's) and 8 down (a foe on the ground's); from the ground under it,
// 58 up and 8 down.
export const FEET_UP = 46;
export const GROUND_UP = 58;
export const DOWN = 8;

/**
 * The crop of `mod`'s canvas round the point `focus` (the effect's pixels
 * from its anchor) that is put on the foe's feet or the ground: `left`, `up`,
 * `right` and `down` cells of it.
 */
export function around(
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
 * the frame on every side, as fx.ts fades the glow (EDGE_FADE): smoke, a
 * flame's crown, a falling star, sparks or a ring the crop cuts off thin out
 * into the backdrop instead of ending on a straight line under the stat
 * windows. Each layer is dithered as it is drawn, so a sheet's `layer` works.
 * In a hi-res frame the band is as wide in effect pixels and dithered texel
 * by texel, finer.
 */
export function soften(mod: FxModule, edgePx = 8): FxModule {
  return {
    meta: mod.meta,
    create(o: Record<string, unknown>) {
      const inner = createFx(mod, o);
      const dither = (f: FxFrame): void => {
        const edge = edgePx * densityOf(f);
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
          finish(p.frame);
          dither(p.frame);
        },
        draw: (p: Painting): void => {
          inner.draw(p.frame, "front");
          finish(p.frame);
          dither(p.frame);
        },
      };
    },
  } as FxModule;
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
export function squeezeX(mod: FxModule, from: number, to: number, len: number): FxModule {
  const cut = to - from - len;
  const [w, h] = mod.meta.size;
  return {
    meta: { ...mod.meta, size: [w - cut, h] },
    create(o: Record<string, unknown>) {
      const inner = createFx(mod, o);
      let tmp: FxFrame | undefined;
      return {
        update: (dt: number): void => inner.update(dt),
        draw: (p: Painting): void => {
          const dst = p.frame;
          // from, len and cut in the frame's texels
          const k = densityOf(dst);
          const [F, N, CUT] = [from * k, len * k, cut * k];
          if (!tmp || tmp.w !== dst.w + CUT || tmp.h !== dst.h || tmp.ox !== dst.ox || tmp.oy !== dst.oy)
            tmp = hiFrame(dst.w + CUT, dst.h, dst.ox, dst.oy, k);
          clearFrame(tmp);
          inner.draw(tmp);
          finish(tmp);
          for (let c = 0; c < dst.w; c++) {
            const x = c + dst.ox;
            const sx = x < F ? x : x < F + N ? F + Math.floor(((x - F) * (to - from)) / len) : x + CUT;
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
  } as FxModule;
}

const luma = (c: number): number => (c & 255) * 0.299 + ((c >>> 8) & 255) * 0.587 + ((c >>> 16) & 255) * 0.114;

/**
 * `mod` at half its size, still a pixelfx pixel to an art cell: each 2x2 of
 * its pixels becomes one, the brightest solid one where two or more are
 * solid (or a lone bright one: a spark, a ring's thin line), the light
 * averaged. For an effect much bigger than a 32-cell foe with no size of its
 * own to turn down (a black hole's disk, 124 cells across). Into a frame of
 * an even number of texels to a cell (a battle sheet's 2) nothing is lost:
 * the effect draws straight in at half that, its own pixels whole.
 */
export function half(mod: FxModule): FxModule {
  const [w, h] = mod.meta.size;
  const [ax, ay] = mod.meta.origin;
  return {
    meta: { ...mod.meta, size: [Math.ceil(w / 2), Math.ceil(h / 2)], origin: [Math.round(ax / 2), Math.round(ay / 2)] },
    create(o: Record<string, unknown>) {
      const inner = createFx(mod, o);
      let tmp: FxFrame | undefined;
      // the frame drawn into at half its density, by frame
      const views = new WeakMap<FxFrame, FxFrame>();
      const down = (dst: FxFrame, layer: "back" | "front"): void => {
        const k = densityOf(dst);
        if (k % 2 === 0) {
          const view = views.get(dst) ?? hiView(dst, k / 2);
          views.set(dst, view);
          inner.draw(view, layer);
          finish(view);
          return;
        }
        if (!tmp || tmp.w !== dst.w * 2 || tmp.h !== dst.h * 2 || tmp.ox !== dst.ox * 2 || tmp.oy !== dst.oy * 2)
          tmp = hiFrame(dst.w * 2, dst.h * 2, dst.ox * 2, dst.oy * 2, k);
        clearFrame(tmp);
        inner.draw(tmp, layer);
        finish(tmp);
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
