import Phaser from "phaser";
import { createFx, type Fx, type FxFrame, type FxModule } from "pixelfx";
import { GAME_WIDTH, PIXEL } from "../config";

// A pixelfx weather loop (pixelfx/fx/weather/*, MIT, by Patch and Hugo
// Duprez; its notice is the /*! line in fx.ts) played live behind the
// battle's fighters. Its canvas is 320x180, the screen in 4px cells, so one
// of its pixels is one backdrop cell (PIXEL). A 12s loop baked at 15fps would
// be 180 frames of 230KB, so it is drawn as it plays instead: the effect is a
// pure function of its time, redrawn STEP_MS apart into a CanvasTexture the
// size of the cells it reaches.

// Redrawn this often, half the 30fps the loops are authored at: a redraw
// costs 1-2ms, spread over two or three frames (below).
const STEPS = 15;
const STEP_MS = 1000 / STEPS;
const COLS = GAME_WIDTH / PIXEL;
const TEXTURE = "battle-weather";

export interface PixelWeatherLook {
  /** the effect: `import * as name from "pixelfx/fx/weather/<name>"` */
  fx: FxModule;
  /** over the effect's own options (its meta.options): palette, light (glow strength) */
  opts?: Record<string, unknown>;
  /**
   * the effect's translucent volumes (haze, veils of rain, mist, sheets of
   * blown snow) at this share of their own alpha: they are drawn for the dark
   * night sky pixelfx paints its weather on, and at full strength darkened a
   * lit backdrop by half
   */
  haze: number;
  /**
   * the back layer drawn in this many bands of rows, one a frame, for an
   * effect that costs more than ~2ms at once (the storm: its veil of rain is
   * a pass over every cell of sky). A band still pays for what is drawn
   * without regard to rows (the storm's off-screen cloud deck, its bolt), so
   * more bands save less each. 1 by default
   */
  bands?: number;
  /**
   * stretches of the loop, in its own seconds (their ends on whole steps),
   * jumped over while `when()` holds: the storm's strike with FLASHES off.
   * Jumping is free, as the effect is a function of its time
   */
  skip?: { spans: ReadonlyArray<readonly [number, number]>; when: () => boolean };
}

/**
 * Plays `look` over the screen's top `rows` cells, its floor (the effect's
 * origin) on the cell row `floor`: above it the whole effect, below it only
 * its front layer (the near drops and their splashes). The back layer's
 * floor (pixelfx's wet lip, puddle strips, the snow bank under its crest)
 * would have run a lit line along the backdrop's horizon. The image is
 * created at depth 0; the caller puts it in the display list. Gone with the
 * scene, texture and all.
 */
export function addPixelWeather(scene: Phaser.Scene, look: PixelWeatherLook, floor: number, rows: number): Phaser.GameObjects.Image {
  if (scene.textures.exists(TEXTURE)) scene.textures.remove(TEXTURE);
  const texture = scene.textures.createCanvas(TEXTURE, COLS, rows);
  const image = scene.add.image(0, 0, TEXTURE).setOrigin(0).setScale(PIXEL);
  if (!texture) return image;
  const ctx = texture.getContext();
  const img = ctx.createImageData(COLS, rows);
  const out = new Uint32Array(img.data.buffer);
  const color = new Uint32Array(COLS * rows);
  const light = new Uint32Array(COLS * rows);
  // the front draws into every row; the back only into those above its floor
  const front: FxFrame = { w: COLS, h: rows, ox: 0, oy: 0, color, light };
  const rowsOf = (y0: number, y1: number): FxFrame => ({
    w: COLS,
    h: y1 - y0,
    ox: 0,
    oy: y0,
    color: color.subarray(y0 * COLS, y1 * COLS),
    light: light.subarray(y0 * COLS, y1 * COLS),
  });
  const n = look.bands ?? 1;
  const bands = Array.from({ length: n }, (_, i) => rowsOf(Math.round((floor * i) / n), Math.round((floor * (i + 1)) / n)));

  // The effect's own seed, always: each seed bakes its noise fields (pixelfx
  // weather/_lib field(), 15-38ms each, a storm's four ~100ms) into a cache
  // that is never emptied, so a new seed every battle or every loop stalled a
  // frame and kept 128KB a field for good. warmBattleWeather bakes them ahead.
  const fx: Fx = createFx(look.fx, { x: COLS / 2, y: floor, ...look.opts });
  const { duration } = look.fx.meta;
  // The loop's clock, and the time it was last drawn at: the clock in whole
  // steps (1/STEPS s) of the loop, whatever the screen's refresh rate. The
  // storm's strokes flicker on pixelfx's 30fps frames (1, .62, .95, .4, .7),
  // so redraws that drifted against them showed one stroke as two flashes;
  // on whole steps from 0 they show every other frame, one flash fading.
  let clock = 0;
  let shown = 0;
  const advance = (dt: number): void => {
    clock += dt;
    const phase = clock % duration;
    if (look.skip?.when()) for (const [from, end] of look.skip.spans) if (phase >= from && phase < end) clock += end - phase;
    const to = Math.floor(clock * STEPS + 1e-6) / STEPS;
    fx.update(to - shown);
    shown = to;
  };
  // where in its loop it starts: anywhere, so no two battles open alike
  advance(Math.random() * duration);

  // a redraw spread over frames: the back layer's bands one a frame, then the
  // front and the upload, so no one frame pays for all of it; the clock runs
  // on through them, so a banded effect keeps the same pace
  let wait = 0;
  let next = -1;
  const step = (_time: number, delta: number): void => {
    wait += delta;
    if (next < 0) {
      if (wait < STEP_MS) return;
      advance(wait / 1000);
      wait = 0;
      color.fill(0);
      light.fill(0);
      next = 0;
    }
    if (next < bands.length) {
      fx.draw(bands[next], "back");
      next++;
      return;
    }
    fx.draw(front, "front");
    composite(color, light, out, look.haze);
    ctx.putImageData(img, 0, 0);
    texture.refresh();
    next = -1;
  };
  // the first picture before the first frame shows
  wait = STEP_MS;
  do step(0, 0);
  while (next >= 0);
  scene.events.on(Phaser.Scenes.Events.UPDATE, step);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, step);
    image.destroy();
    scene.textures.remove(TEXTURE);
  });
  return image;
}

/**
 * pixelfx's composite over transparency, with its translucent colour scaled by
 * `haze`: opaque pixels (drops, flakes, the bolt) stay whole, and light over
 * nothing becomes colour with alpha, its brightest channel, which reads as a
 * glow over the backdrop.
 */
function composite(color: Uint32Array, light: Uint32Array, out: Uint32Array, haze: number): void {
  for (let i = 0; i < out.length; i++) {
    const c = color[i];
    const l = light[i] & 0xffffff;
    const ca = c >>> 24;
    if (!l) {
      out[i] = ca === 255 || ca === 0 ? c : (Math.round(ca * haze) << 24) | (c & 0xffffff);
      continue;
    }
    const a = ca === 255 ? 1 : (ca / 255) * haze;
    const lr = l & 255;
    const lg = (l >>> 8) & 255;
    const lb = (l >>> 16) & 255;
    // premultiply what's there, add the light, divide by the new alpha
    const na = Math.min(1, Math.max(a, Math.max(lr, lg, lb) / 255));
    const r = Math.min(255, ((c & 255) * a + lr) / na);
    const g = Math.min(255, (((c >>> 8) & 255) * a + lg) / na);
    const b = Math.min(255, (((c >>> 16) & 255) * a + lb) / na);
    out[i] = (Math.round(na * 255) << 24) | (b << 16) | (g << 8) | r;
  }
}
