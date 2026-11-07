// pixelfx frames drawn at more than one texel to an effect pixel, so a battle
// sheet shown at 4px a cell keeps the field's 2px detail (fx.ts PixelSheet.res).
//
// An effect draws in its own pixels (its cells) and the painter maps them to
// the frame's: here that mapping is scaled by k, a cell k x k texels. pixelfx
// itself is not touched (a pinned dependency): a hi-res frame's painter, the
// one painterFor() keeps for that frame and every createFx draw goes through,
// gets its own transform and drawing methods put on it, nothing else's.
//
// - Shapes the painter rasterizes itself (shade, each and what is built on
//   them: circle, ring, arc, beam, poly, disc) ask for the effect's colour at
//   every texel, so their edges and gradients come out at k x the detail.
//   Glow (glow, glowLine, glowRing) is the same light over k x k the texels.
// - A pixel (px, dot, light, blend, get, a sprite's or mask's pixels) stays a
//   cell, k x k texels, so a sparkle's cross or a coin's art keeps its shape,
//   but it lands on the texel grid: a particle moves in steps of 1/k cell.
// - A line stays a cell thick (k texels across its run) but steps by texels,
//   so a diagonal is a finer stair of the same weight.
//
// Two kinds of effect code reach past the painter's shapes:
// - code that walks the frame in screen space itself, from p.toX/p.toY with
//   sizes in cells (fire/_lib's solid and soft, the flame and smoke puffs):
//   toX/toY answer in cells here, and the whole cells put, blendPx or add
//   then write are held as a run. A run of one colour is the disc solid and
//   soft draw, every cell whose middle is within r of the point asked for:
//   it is drawn again at texels, r between the farthest middle written and
//   the nearest one beside them left out. Any other run fills its cells, as
//   blocky as at one texel to a cell, at their size.
//   Code with a fast path of its own for an unturned painter, that walks
//   the buffers at a texel to a cell (explosions/_lib's disc, weather/_lib's
//   pass() and rows(), the whole-sky passes), tests the painter's cs and sn
//   first: here they are NaN, so it always takes its general way through the
//   painter, a cell at a time (as blocky as at one texel to a cell).
// - code that writes the light buffer by p.cellX (shadow/_lib's black star):
//   it reaches one texel of each cell; finish() takes the light off the rest
//   of the cells it emptied.
//
// finish() also draws a run still held, so it is called after every draw
// into a hi-res frame (fx.ts sheetBaker, sheetFx.ts's wrappers).
import { createFrame, type FxFrame, Painter, painterFor } from "pixelfx";

// what of pixelfx's Painter is used here (src/env.d.ts types only what fx.ts
// bakes sheets with)
declare module "pixelfx" {
  export class Painter {
    constructor(frame: FxFrame);
    frame: FxFrame;
    w: number;
    h: number;
    ox: number;
    oy: number;
    C: Uint32Array;
    L: Uint32Array;
    tx: number;
    ty: number;
    fx: number;
    cs: number;
    sn: number;
    fade: number;
    lightK: number;
    reset(): this;
    place(x: number, y: number, flip?: boolean, angle?: number): this;
    put(sx: number, sy: number, c: number, a?: number): void;
    add(sx: number, sy: number, c: number, k?: number): void;
    blendPx(sx: number, sy: number, c: number, a: number): void;
    rect(x: number, y: number, w: number, h: number, c: number, a?: number): void;
  }
  export function painterFor(frame: FxFrame): Painter;
}

/** A frame with its texels to an effect pixel (k); 1 (or none) for pixelfx's own. */
export interface HiFrame extends FxFrame {
  k?: number;
}

/** Texels to an effect pixel across `frame`. */
export const densityOf = (frame: FxFrame): number => (frame as HiFrame).k ?? 1;

type Fn = (...args: never[]) => unknown;
type Colour = number | ((...a: number[]) => number);
const call = (v: Colour, ...a: number[]): number => (typeof v === "function" ? v(...a) : v);
const proto = Painter.prototype;
// ordered dither thresholds (4x4 Bayer), pixelfx's put()'s own
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/**
 * A frame `w` x `h` texels, its top-left at (`ox`, `oy`) texels from the
 * effect's anchor, drawn into at `k` texels to an effect pixel. At 1, just
 * pixelfx's own frame.
 */
export function hiFrame(w: number, h: number, ox: number, oy: number, k: number, opts?: HiOptions): FxFrame {
  return hires(createFrame(w, h, ox, oy), k, opts);
}

/**
 * `frame`'s own pixels seen at `k` texels to an effect pixel: a frame sharing
 * its buffers, for an effect drawn into it at another density (sheetFx.ts half).
 */
export function hiView(frame: FxFrame, k: number): FxFrame {
  const { w, h, ox, oy, color, light } = frame;
  return hires({ w, h, ox, oy, color, light }, k);
}

/** How a hi-res frame meets code that walks its buffers itself. */
export interface HiOptions {
  /**
   * the raw fields (C, L, w, h, ox, oy, tx, ty) in cells, over a buffer of a
   * texel to a cell, for code that walks the buffers itself at a texel to a
   * cell when the painter is not turned (weather/_lib's pass() and rows(), the
   * whole-sky passes): it takes its fast way at its own speed, and what it
   * wrote goes into the texels before the painter draws anything else, a
   * blend over a texel unlike the cell's first one blended again over it. Not
   * for code that walks them by the painter's own texels (shadow/_lib's
   * unlight, through each())
   */
  rawCells?: boolean;
}

/**
 * `frame` (pixelfx's shape, its w, h, ox, oy in texels) drawn into at `k`
 * texels to an effect pixel from now on: its painter (painterFor) is the
 * hi-res one. At 1, left as it is.
 */
export function hires<F extends FxFrame>(frame: F, k: number, opts: HiOptions = {}): F {
  if (k !== 1) scaled(frame, k, opts);
  return frame;
}

// the cells shadow/_lib's black star emptied of light through cellX, by frame
const emptied = new WeakMap<FxFrame, number[]>();
// the run of whole-cell writes a hi-res frame's painter holds, drawn, by frame
const endRuns = new WeakMap<FxFrame, () => void>();

/**
 * After an effect's draw into a hi-res frame: the run of whole-cell writes
 * still held drawn, and the light off the whole of each cell code outside the
 * painter emptied one texel of by its cellX (a black star kept black under
 * the glow drawn before it).
 */
export function finish(frame: FxFrame): void {
  endRuns.get(frame)?.();
  const cells = emptied.get(frame);
  if (!cells?.length) return;
  const k = densityOf(frame);
  const { w, h, ox, oy, light } = frame;
  for (let i = 0; i < cells.length; i += 2) {
    const x = cells[i] - ox;
    const y = cells[i + 1] - oy;
    if (x < 0 || y < 0 || x >= w || y >= h || light[y * w + x]) continue;
    for (let dy = 0; dy < k; dy++)
      for (let dx = 0; dx < k; dx++) {
        const X = x + dx;
        const Y = y + dy;
        if (X < w && Y < h) light[Y * w + X] = 0;
      }
  }
  cells.length = 0;
}

// The painter of `frame`, drawing at k texels to an effect pixel. Its turn
// is kept here (the rotation's cosine and sine times k, so the transform maps
// cells straight to texels) and its own cs and sn are NaN, so any code
// testing them for the identity takes its general way (header).
function scaled(frame: HiFrame, k: number, { rawCells = false }: HiOptions): void {
  frame.k = k;
  const p = painterFor(frame);
  // the frame's texels: its size, place and buffers never change
  const { w: FW, h: FH, ox: FOX, oy: FOY, color: FC, light: FL } = frame;

  // pixelfx's put, add and blendPx on those (theirs read the painter's own
  // fields, which rawCells gives in cells)
  const put = (sx: number, sy: number, c: number, a = 1): void => {
    if (!c) return;
    const aa = a * p.fade;
    if (aa < 1 && aa <= BAYER[((sy & 3) << 2) | (sx & 3)]) return;
    const x = sx - FOX;
    const y = sy - FOY;
    if (x < 0 || y < 0 || x >= FW || y >= FH) return;
    FC[y * FW + x] = c;
  };
  const add = (sx: number, sy: number, c: number, kk = 1): void => {
    const K = kk * p.fade * p.lightK;
    if (K <= 0.004) return;
    const x = sx - FOX;
    const y = sy - FOY;
    if (x < 0 || y < 0 || x >= FW || y >= FH) return;
    const i = y * FW + x;
    const d = FL[i];
    const r = Math.min(255, (d & 255) + (c & 255) * K) | 0;
    const g = Math.min(255, ((d >>> 8) & 255) + ((c >>> 8) & 255) * K) | 0;
    const b = Math.min(255, ((d >>> 16) & 255) + ((c >>> 16) & 255) * K) | 0;
    FL[i] = (255 << 24) | (b << 16) | (g << 8) | r;
  };
  const over = (d: number, c: number, a: number): number => {
    const da = (d >>> 24) / 255;
    const oa = a + da * (1 - a);
    const q = a / oa;
    const ch = (s: number): number => (((c >>> s) & 255) * q + ((d >>> s) & 255) * (1 - q)) & 255;
    return (((oa * 255) & 255) << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0);
  };
  const blendPx = (sx: number, sy: number, c: number, a: number): void => {
    const aa = a * p.fade;
    if (!c || aa <= 0.004) return;
    const x = sx - FOX;
    const y = sy - FOY;
    if (x < 0 || y < 0 || x >= FW || y >= FH) return;
    const i = y * FW + x;
    FC[i] = over(FC[i], c, aa);
  };
  const k2 = k * k;
  // half a cell less half a texel: a cell's middle to its top-left texel
  const lead = k / 2 - 0.5;
  const cells: number[] = [];
  emptied.set(frame, cells);

  // cells to texels and back
  let [tx, ty, flip, cs, sn] = [0, 0, 1, k, 0];
  const X = (x: number, y: number): number => tx + x * flip * cs - y * sn;
  const Y = (x: number, y: number): number => ty + x * flip * sn + y * cs;
  const LX = (sx: number, sy: number): number => (((sx - tx) * cs + (sy - ty) * sn) * flip) / k2;
  const LY = (sx: number, sy: number): number => (-(sx - tx) * sn + (sy - ty) * cs) / k2;
  // what code outside reads of the transform: cs never the identity's, sn
  // only for rawCells' fast ways (header)
  const unturned = (): void => {
    p.cs = Number.NaN;
    p.sn = rawCells && sn === 0 ? 0 : Number.NaN;
    p.fx = flip;
    if (rawCells) return;
    p.tx = tx;
    p.ty = ty;
  };
  // the top-left texel of the cell drawn at (x, y): its box [x, x+1) mapped,
  // on the nearest texel (on the cell itself for whole x, y)
  const bx = (x: number, y: number): number => Math.floor(X(x + 0.5, y + 0.5) - lead);
  const by = (x: number, y: number): number => Math.floor(Y(x + 0.5, y + 0.5) - lead);

  const writes = [put, blendPx, add] as const;
  const PUT = 0;
  // A cell's k x k texels from its top-left (sx, sy), by one of writes, the
  // fade and light worked out once: the clipped painters of the weather and
  // the sun rays light their glow a cell at a time, a pixel a write.
  const block = (kind: number, sx: number, sy: number, c: number, a: number): void => {
    if (kind === 1 || !c) {
      if (c) for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) blendPx(sx + dx, sy + dy, c, a);
      return;
    }
    const x0 = Math.max(sx, FOX) - FOX;
    const x1 = Math.min(sx + k, FOX + FW) - FOX;
    const y0 = Math.max(sy, FOY) - FOY;
    const y1 = Math.min(sy + k, FOY + FH) - FOY;
    if (x0 >= x1 || y0 >= y1) return;
    if (kind === PUT) {
      const aa = a * p.fade;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) if (aa >= 1 || aa > BAYER[(((y + FOY) & 3) << 2) | ((x + FOX) & 3)]) FC[y * FW + x] = c;
      return;
    }
    const K = a * p.fade * p.lightK;
    if (K <= 0.004) return;
    const [cr, cg, cb] = [(c & 255) * K, ((c >>> 8) & 255) * K, ((c >>> 16) & 255) * K];
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = y * FW + x;
        const d = FL[i];
        FL[i] =
          (255 << 24) |
          ((Math.min(255, ((d >>> 16) & 255) + cb) | 0) << 16) |
          ((Math.min(255, ((d >>> 8) & 255) + cg) | 0) << 8) |
          (Math.min(255, (d & 255) + cr) | 0);
      }
  };

  // rawCells: the fields code outside walks the buffers by, in cells, over a
  // buffer of a texel to a cell (header). `held` from its first read of C or
  // L, the cells as they were then in c0 and l0 (each cell's first texel),
  // until the painter is next asked to draw: then what changed goes into the
  // texels (up).
  const [W, H] = [FW / k, FH / k];
  let held = false;
  let up = (): void => {};
  if (rawCells) {
    const [sc, sl, c0, l0] = [0, 1, 2, 3].map(() => new Uint32Array(W * H));
    const down = (): void => {
      if (held) return;
      endRun();
      held = true;
      for (let cy = 0; cy < H; cy++)
        for (let cx = 0, i = cy * W, t = cy * k * FW; cx < W; cx++, i++, t += k) {
          sc[i] = c0[i] = FC[t];
          sl[i] = l0[i] = FL[t];
        }
    };
    // The write that took a cell's first texel from b to n, made on each of
    // its texels: n where a texel was b too (a sky just cleared: all of it).
    // Elsewhere a blend of the colour at the alpha it took to make n of b (an
    // opaque write's alpha is 1), when b let it be worked out (not opaque).
    const colour = (t: number, b: number, n: number): void => {
      let a = Number.NaN;
      let c = 0;
      for (let dy = 0; dy < k; dy++)
        for (let dx = 0, j = t + dy * FW; dx < k; dx++, j++) {
          const d = FC[j];
          if (d === b) {
            FC[j] = n;
            continue;
          }
          if (Number.isNaN(a)) {
            const [ba, na] = [(b >>> 24) / 255, (n >>> 24) / 255];
            a = ba < 1 ? (na - ba) / (1 - ba) : -1;
            const q = a / na;
            for (const s of [16, 8, 0])
              c |= Math.max(0, Math.min(255, Math.round((((n >>> s) & 255) - ((b >>> s) & 255) * (1 - q)) / q))) << s;
          }
          FC[j] = a > 0.004 && a < 1 ? over(d, c, a) : n;
        }
    };
    // light only adds: the same added to each texel (n where any of it fell)
    const light = (t: number, b: number, n: number): void => {
      const dr = (n & 255) - (b & 255);
      const dg = ((n >>> 8) & 255) - ((b >>> 8) & 255);
      const db = ((n >>> 16) & 255) - ((b >>> 16) & 255);
      const fell = dr < 0 || dg < 0 || db < 0;
      for (let dy = 0; dy < k; dy++)
        for (let dx = 0, j = t + dy * FW; dx < k; dx++, j++) {
          const d = FL[j];
          FL[j] =
            fell || d === b
              ? n
              : (255 << 24) |
                (Math.min(255, ((d >>> 16) & 255) + db) << 16) |
                (Math.min(255, ((d >>> 8) & 255) + dg) << 8) |
                Math.min(255, (d & 255) + dr);
        }
    };
    up = (): void => {
      if (!held) return;
      held = false;
      for (let cy = 0; cy < H; cy++)
        for (let cx = 0, i = cy * W, t = cy * k * FW; cx < W; cx++, i++, t += k) {
          if (sc[i] !== c0[i]) colour(t, c0[i], sc[i]);
          if (sl[i] !== l0[i]) light(t, l0[i], sl[i]);
        }
    };
    const cellField = (get: () => unknown): PropertyDescriptor => ({ get, set: () => {}, configurable: true });
    Object.defineProperties(p, {
      C: cellField(() => {
        down();
        return sc;
      }),
      L: cellField(() => {
        down();
        return sl;
      }),
      w: cellField(() => W),
      h: cellField(() => H),
      ox: cellField(() => FOX / k),
      oy: cellField(() => FOY / k),
      tx: cellField(() => tx / k),
      ty: cellField(() => ty / k),
    });
  }

  // Whole-cell writes after toX/toY, held until the painter is asked for
  // anything else: the point asked for (cells) and each write's cell, kind
  // (index in writes), colour and alpha or light, five numbers apiece.
  // Started by toX or toY, which only code walking the frame in its own cells
  // asks for.
  let run: { x: number; y: number; ops: number[] } | null = null;
  const endRun = (): void => {
    if (!run) return;
    const { x, y, ops } = run;
    run = null;
    const n = ops.length / 5;
    if (!n) return;
    const [kind, c, a] = [ops[2], ops[3], ops[4]];
    let disc = Number.isFinite(x) && Number.isFinite(y);
    for (let i = 5; disc && i < ops.length; i += 5) disc = ops[i + 2] === kind && ops[i + 3] === c && ops[i + 4] === a;
    const write = writes[kind];
    if (!disc) {
      for (let i = 0; i < ops.length; i += 5) block(ops[i + 2], ops[i] * k, ops[i + 1] * k, ops[i + 3], ops[i + 4]);
      return;
    }
    // the disc's radius: past the farthest middle written, short of the
    // nearest middle beside the cells written that was left out
    const keyOf = (cx: number, cy: number): number => (cx + 32768) * 65536 + cy + 32768;
    const inRun = new Set<number>();
    for (let i = 0; i < ops.length; i += 5) inRun.add(keyOf(ops[i], ops[i + 1]));
    const far = (cx: number, cy: number): number => Math.hypot(cx + 0.5 - x, cy + 0.5 - y);
    let rIn = 0;
    let rOut = Number.POSITIVE_INFINITY;
    for (let i = 0; i < ops.length; i += 5) {
      const [cx, cy] = [ops[i], ops[i + 1]];
      rIn = Math.max(rIn, far(cx, cy));
      for (const [nx, ny] of [
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1],
      ])
        if (!inRun.has(keyOf(nx, ny))) rOut = Math.min(rOut, far(nx, ny));
    }
    const R = (rOut > rIn && Number.isFinite(rOut) ? (rIn + rOut) / 2 : rIn + 0.5) * k;
    // every texel whose middle is within R of the point
    const [cx0, cy0] = [x * k, y * k];
    const sy0 = Math.max(Math.floor(cy0 - R), FOY);
    const sy1 = Math.min(Math.ceil(cy0 + R), FOY + FH - 1);
    for (let sy = sy0; sy <= sy1; sy++) {
      const dy = sy + 0.5 - cy0;
      if (dy * dy > R * R) continue;
      const span = Math.sqrt(R * R - dy * dy);
      const sx1 = Math.min(Math.floor(cx0 + span - 0.5), FOX + FW - 1);
      for (let sx = Math.max(Math.ceil(cx0 - span - 0.5), FOX); sx <= sx1; sx++) write(sx, sy, c, a);
    }
  };
  // before any drawing: rawCells' writes into the texels, a run held drawn
  const ready = (): void => {
    up();
    endRun();
  };
  endRuns.set(frame, ready);
  // a whole-cell write: held in the run, or straight to the texel without one
  const cellWrite = (kind: number, sx: number, sy: number, c: number, a: number): void => {
    up();
    if (run) {
      if (kind !== PUT || c) run.ops.push(sx, sy, kind, c, a);
    } else writes[kind](sx, sy, c, a);
  };
  const startRun = (): { x: number; y: number; ops: number[] } => {
    up();
    if (!run) run = { x: Number.NaN, y: Number.NaN, ops: [] };
    else if (run.ops.length) {
      ready();
      run = { x: Number.NaN, y: Number.NaN, ops: [] };
    }
    return run;
  };
  const putCell = (x: number, y: number, c: number, a: number): void => {
    ready();
    if (!c) return;
    block(0, bx(x, y), by(x, y), c, a);
  };

  const blend = (x: number, y: number, c: number, a: number): void => {
    ready();
    block(1, bx(x, y), by(x, y), c, a);
  };
  const dot = (x: number, y: number, c: number, a = 1): void => {
    if (a > 0) putCell(x, y, c, a);
  };
  // every texel whose middle falls in the cells' box, with that middle in cells
  const each = (x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number, sx: number, sy: number) => void): void => {
    ready();
    let ax = Number.POSITIVE_INFINITY;
    let bxx = Number.NEGATIVE_INFINITY;
    let ay = Number.POSITIVE_INFINITY;
    let byy = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < 4; i++) {
      const x = i & 1 ? x1 : x0;
      const y = i & 2 ? y1 : y0;
      const sx = X(x, y);
      const sy = Y(x, y);
      ax = Math.min(ax, sx);
      bxx = Math.max(bxx, sx);
      ay = Math.min(ay, sy);
      byy = Math.max(byy, sy);
    }
    const sx0 = Math.max(Math.floor(ax), FOX);
    const sx1 = Math.min(Math.ceil(bxx), FOX + FW - 1);
    const sy0 = Math.max(Math.floor(ay), FOY);
    const sy1 = Math.min(Math.ceil(byy), FOY + FH - 1);
    for (let sy = sy0; sy <= sy1; sy++)
      for (let sx = sx0; sx <= sx1; sx++) {
        const cx = sx + 0.5;
        const cy = sy + 0.5;
        fn(LX(cx, cy), LY(cx, cy), sx, sy);
      }
  };

  // Painter.add for one light colour at strength kk: what lights a texel
  // f (0..1) of kk, inside the frame (the callers keep to it); null when
  // nothing could show
  const lighter = (c: number, kk: number): ((sx: number, sy: number, f: number) => void) | null => {
    const K = kk * p.fade * p.lightK;
    if (K <= 0.004) return null;
    const [cr, cg, cb] = [c & 255, (c >>> 8) & 255, (c >>> 16) & 255];
    return (sx, sy, f) => {
      const v = f * K;
      if (v <= 0.004) return;
      const i = (sy - FOY) * FW + sx - FOX;
      const d = FL[i];
      const r = Math.min(255, (d & 255) + cr * v) | 0;
      const g = Math.min(255, ((d >>> 8) & 255) + cg * v) | 0;
      const b = Math.min(255, ((d >>> 16) & 255) + cb * v) | 0;
      FL[i] = (255 << 24) | (b << 16) | (g << 8) | r;
    };
  };

  const own: Record<string, Fn> = {
    reset(): Painter {
      ready();
      proto.reset.call(p);
      [tx, ty, flip, cs, sn] = [0, 0, 1, k, 0];
      unturned();
      return p;
    },
    place(x: number, y: number, mirrored = false, angle = 0): Painter {
      [tx, ty, flip] = [x * k, y * k, mirrored ? -1 : 1];
      [cs, sn] = [Math.cos(angle) * k, Math.sin(angle) * k];
      unturned();
      return p;
    },
    // in cells, for code that walks the frame itself (fire/_lib solid, soft)
    toX(x: number, y: number): number {
      const at = X(x, y) / k;
      startRun().x = at;
      return at;
    },
    toY(x: number, y: number): number {
      const at = Y(x, y) / k;
      startRun().y = at;
      return at;
    },
    fromX: (sx: number, sy: number): number => LX(sx * k, sy * k),
    fromY: (sx: number, sy: number): number => LY(sx * k, sy * k),
    // a cell's top-left texel, for code writing the buffers by it (the black star)
    cellX(x: number, y: number): number {
      ready();
      return bx(Math.floor(x), Math.floor(y));
    },
    cellY(x: number, y: number): number {
      ready();
      const sy = by(Math.floor(x), Math.floor(y));
      cells.push(bx(Math.floor(x), Math.floor(y)), sy);
      return sy;
    },
    // a whole cell after toX/toY (held in the run), a texel otherwise (each()
    // hands out texels)
    put: (sx: number, sy: number, c: number, a = 1): void => cellWrite(0, sx, sy, c, a),
    blendPx: (sx: number, sy: number, c: number, a: number): void => cellWrite(1, sx, sy, c, a),
    add: (sx: number, sy: number, c: number, kk = 1): void => cellWrite(2, sx, sy, c, kk),
    blend,
    get(x: number, y: number): number {
      ready();
      const sx = bx(x, y) - FOX;
      const sy = by(x, y) - FOY;
      return sx < 0 || sy < 0 || sx >= FW || sy >= FH ? 0 : FC[sy * FW + sx];
    },
    px: (x: number, y: number, c: number): void => putCell(x, y, c, 1),
    dot,
    light(x: number, y: number, c: number, kk = 1): void {
      ready();
      block(2, bx(x, y), by(x, y), c, kk);
    },
    each,
    // a cell thick: a run of k texels across the line at each texel along it
    line(x0: number, y0: number, x1: number, y1: number, c: Colour, a: Colour = 1): void {
      ready();
      const [ax, ay, ex, ey] = [bx(x0, y0), by(x0, y0), bx(x1, y1), by(x1, y1)];
      const dx = ex - ax;
      const dy = ey - ay;
      const n = Math.max(Math.abs(dx), Math.abs(dy));
      const along = Math.abs(dx) >= Math.abs(dy);
      const [s0, s1] = along ? [Math.min(ax, ex), Math.max(ax, ex)] : [Math.min(ay, ey), Math.max(ay, ey)];
      for (let s = s0; s <= s1 + k - 1; s++) {
        // how far along, 0 at (x0, y0), 1 at (x1, y1)
        const u = n ? Math.min(1, Math.max(0, (s - (along ? ax : ay)) / (along ? dx : dy))) : 0;
        const cc = call(c, u);
        const aa = call(a, u);
        if (!cc) continue;
        const o = Math.round(along ? ay + dy * u : ax + dx * u);
        for (let j = 0; j < k; j++) {
          if (along) put(s, o + j, cc, aa);
          else put(o + j, s, cc, aa);
        }
      }
    },
    // on the texel grid when it is not turned, by its cells' middles when it is
    rect(x: number, y: number, w: number, h: number, c: number, a = 1): void {
      ready();
      if (sn !== 0) {
        proto.rect.call(p, x, y, w, h, c, a);
        return;
      }
      const [ax, bx2] = [X(x, y), X(x + w, y)];
      const [ay, by2] = [Y(x, y), Y(x, y + h)];
      const X0 = Math.round(Math.min(ax, bx2));
      const X1 = Math.round(Math.max(ax, bx2));
      const Y0 = Math.round(Math.min(ay, by2));
      const Y1 = Math.round(Math.max(ay, by2));
      for (let sy = Y0; sy < Y1; sy++) for (let sx = X0; sx < X1; sx++) put(sx, sy, c, a);
    },
    // filled shapes as pixelfx's (each() at texels), the angle worked out only
    // for a colour or alpha that asks for it: Math.atan2 on every texel was an
    // eighth of a sheet's baking
    disc(cx: number, cy: number, r: number, c: Colour, a: Colour): void {
      if (r < 0.5) {
        blend(cx, cy, call(c, 0, 0), call(a, 0, 0));
        return;
      }
      const turn = typeof c === "function" || typeof a === "function";
      each(cx - r, cy - r, cx + r, cy + r, (x: number, y: number, sx: number, sy: number) => {
        const dx = x - cx;
        const dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > r * r) return;
        const d = Math.sqrt(d2) / r;
        const ang = turn ? Math.atan2(dy, dx) : 0;
        blendPx(sx, sy, call(c, d, ang), call(a, d, ang));
      });
    },
    circle(cx: number, cy: number, r: number, c: Colour, a: Colour = 1): void {
      if (r < 0.6) {
        dot(cx, cy, call(c, 0, 0), call(a, 0, 0));
        return;
      }
      const turn = typeof c === "function" || typeof a === "function";
      each(cx - r, cy - r, cx + r, cy + r, (x: number, y: number, sx: number, sy: number) => {
        const dx = x - cx;
        const dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > r * r) return;
        const d = Math.sqrt(d2) / r;
        const ang = turn ? Math.atan2(dy, dx) : 0;
        const col = call(c, d, ang);
        if (col) put(sx, sy, col, call(a, d, ang));
      });
    },
    // the light: pixelfx's, in texels (r and R times k), each row walked only
    // where it can be lit, the light added in place (Painter.add's own sums)
    glow(x: number, y: number, r: number, c: number, kk = 0.5): void {
      ready();
      if (r < 1 || kk <= 0.004) return;
      const cx = X(x, y);
      const cy = Y(x, y);
      const R = r * k;
      const lit = lighter(c, kk);
      if (!lit) return;
      const sy0 = Math.max(Math.floor(cy - R), FOY);
      const sy1 = Math.min(Math.ceil(cy + R), FOY + FH - 1);
      for (let sy = sy0; sy <= sy1; sy++) {
        const dy = (sy + 0.5 - cy) / R;
        const dy2 = dy * dy;
        if (dy2 >= 1) continue;
        const span = Math.sqrt(1 - dy2) * R;
        const sx1 = Math.min(Math.ceil(cx + span), FOX + FW - 1);
        for (let sx = Math.max(Math.floor(cx - span), FOX); sx <= sx1; sx++) {
          const dx = (sx + 0.5 - cx) / R;
          const d = dx * dx + dy2;
          if (d >= 1) continue;
          const f = 1 - Math.sqrt(d);
          lit(sx, sy, f * f);
        }
      }
    },
    glowLine(x0: number, y0: number, x1: number, y1: number, r: number, c: number, kk = 0.5): void {
      ready();
      if (r < 1 || kk <= 0.004) return;
      const lit = lighter(c, kk);
      if (!lit) return;
      const R = r * k;
      const ax = X(x0, y0);
      const ay = Y(x0, y0);
      const ex = X(x1, y1);
      const ey = Y(x1, y1);
      const dx = ex - ax;
      const dy = ey - ay;
      const L2 = dx * dx + dy * dy || 1e-9;
      const sy0 = Math.max(Math.floor(Math.min(ay, ey) - R), FOY);
      const sy1 = Math.min(Math.ceil(Math.max(ay, ey) + R), FOY + FH - 1);
      const sx0 = Math.max(Math.floor(Math.min(ax, ex) - R), FOX);
      const sx1 = Math.min(Math.ceil(Math.max(ax, ex) + R), FOX + FW - 1);
      for (let sy = sy0; sy <= sy1; sy++)
        for (let sx = sx0; sx <= sx1; sx++) {
          const px = sx + 0.5;
          const py = sy + 0.5;
          const u = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / L2));
          const qx = ax + dx * u - px;
          const qy = ay + dy * u - py;
          const d2 = (qx * qx + qy * qy) / (R * R);
          if (d2 >= 1) continue;
          const f = 1 - Math.sqrt(d2);
          lit(sx, sy, f * f);
        }
    },
    glowRing(x: number, y: number, R: number, r: number, c: number, kk = 0.5): void {
      ready();
      if (r < 1 || kk <= 0.004) return;
      const lit = lighter(c, kk);
      if (!lit) return;
      const cx = X(x, y);
      const cy = Y(x, y);
      const RR = R * k;
      const rr = r * k;
      const E = RR + rr;
      const sy0 = Math.max(Math.floor(cy - E), FOY);
      const sy1 = Math.min(Math.ceil(cy + E), FOY + FH - 1);
      for (let sy = sy0; sy <= sy1; sy++) {
        const dy = sy + 0.5 - cy;
        if (Math.abs(dy) >= E) continue;
        // the row's span outside the hole the ring leaves (its inner edge)
        const out = Math.sqrt(E * E - dy * dy);
        const inner = RR > rr && Math.abs(dy) < RR - rr ? Math.sqrt((RR - rr) ** 2 - dy * dy) : 0;
        const sx1 = Math.min(Math.ceil(cx + out), FOX + FW - 1);
        for (let sx = Math.max(Math.floor(cx - out), FOX); sx <= sx1; sx++) {
          const ddx = sx + 0.5 - cx;
          if (inner && Math.abs(ddx) < inner - 1) {
            sx = Math.max(sx, Math.floor(cx + inner) - 1);
            continue;
          }
          const d = Math.abs(Math.sqrt(ddx * ddx + dy * dy) - RR) / rr;
          if (d >= 1) continue;
          const f = 1 - d;
          lit(sx, sy, f * f);
        }
      }
    },
  };
  Object.assign(p, own);
}
