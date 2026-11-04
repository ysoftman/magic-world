// process.env.NODE_ENV for the dev-only code paths: Bun's bundler folds it to
// a constant ("development" on the dev server, "production" in
// scripts/build.ts), so a dev branch drops out of the bundle
declare const process: { env: { NODE_ENV?: string } };

// main.ts imports the font CSS for its side effect; the bundler handles it
declare module "*.css";

// pixelfx (github:patch-gg/pixelfx, plain JS): just what fx.ts bakes sheets
// with, typed here rather than turning on allowJs for the whole package
declare module "pixelfx" {
  export interface FxFrame {
    w: number;
    h: number;
    ox: number;
    oy: number;
    color: Uint32Array;
    light: Uint32Array;
  }
  export interface FxMeta {
    size: [number, number];
    origin: [number, number];
    duration: number;
    fps: number;
    loop: boolean;
    options?: Record<string, unknown>;
  }
  export interface FxModule {
    meta: FxMeta;
  }
  export interface Fx {
    update(dt: number): void;
    draw(frame: FxFrame, layer?: "back" | "front"): void;
  }
  export function createFrame(w: number, h: number, ox?: number, oy?: number): FxFrame;
  export function clearFrame(frame: FxFrame): FxFrame;
  export function createFx(mod: FxModule, opts?: Record<string, unknown>): Fx;
  /** a palette's hex strings as `n` colours, stepped (an effect's own palette option) */
  export function fit(ramp: readonly string[], n: number): number[];
  export function composite(frame: FxFrame, out: Uint8ClampedArray, bg: null, lightK?: number): Uint8ClampedArray;
}
declare module "pixelfx/fx/*" {
  export const meta: import("pixelfx").FxMeta;
}
