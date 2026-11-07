import Phaser from "phaser";
import { createFrame, type FxFrame } from "pixelfx";

/**
 * A screen-fixed canvas that pixelfx effects (MIT; their notice is the /*!
 * line in fx.ts) are drawn into live, one of their pixels to `cell` px, for
 * an effect too long or too varied to bake into a sheet (the forest's sun
 * rays, the fireworks, the shooting stars, the aurora). The caller draws into
 * `frame` (its origin at `ox`, `oy` in the effects' own pixels) and calls
 * `upload` (see redrawLive for when), which shows
 * it added over the scene (ADD): their light, and their opaque pixels as they
 * are. Their translucent colour (the dark air of a night backdrop, smoke) is
 * left out: added, it could only brighten. The image starts hidden, and goes
 * with the scene, texture and all.
 *
 * `smooth` (the sun rays) uploads `smooth` x `smooth` texels to an effect
 * pixel, the light between pixels' middles blended (bilinear), the opaque
 * pixels as they are: a light the effect works out a pixel at a time (the
 * rays' shafts, weather/_lib rows()) shows its edges stepping by a texel
 * instead of a whole pixel. Drawn at that density instead (hiresPaint.ts) it
 * came out the same, as the shafts are worked out by the effect a pixel at a
 * time whatever the painter does.
 */
export function addLightCanvas(
  scene: Phaser.Scene,
  key: string,
  {
    cols,
    rows,
    cell,
    depth,
    ox = 0,
    oy = 0,
    smooth = 1,
  }: { cols: number; rows: number; cell: number; depth: number; ox?: number; oy?: number; smooth?: number },
): {
  frame: FxFrame;
  image: Phaser.GameObjects.Image;
  upload: (rowAlpha?: (y: number) => number, colAlpha?: Float32Array) => void;
} {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const [W, H] = [cols * smooth, rows * smooth];
  const texture = scene.textures.createCanvas(key, W, H);
  const image = scene.add
    .image(0, 0, key)
    .setOrigin(0)
    .setScale(cell / smooth)
    .setScrollFactor(0)
    .setDepth(depth)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setVisible(false);
  const frame = createFrame(cols, rows, ox, oy);
  const ctx = texture?.getContext();
  const img = ctx?.createImageData(W, H);
  const out = img && new Uint32Array(img.data.buffer);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    image.destroy();
    scene.textures.remove(key);
  });
  // `rowAlpha` scales a row's alpha, 0..1 (a fade in from an edge), and
  // `colAlpha` a column's, one entry a column
  const upload = (rowAlpha?: (y: number) => number, colAlpha?: Float32Array): void => {
    if (!ctx || !img || !out || !texture) return;
    if (smooth > 1) uploadSmooth(rowAlpha, colAlpha);
    else
      for (let y = 0; y < rows; y++) {
        const fade = rowAlpha?.(y) ?? 1;
        for (let x = 0, i = y * cols; x < cols; x++, i++) {
          const c = frame.color[i];
          const l = frame.light[i] & 0xffffff;
          // an opaque pixel as it is; or the light, as its colour over its
          // brightest channel (added, that is the light itself)
          const solid = c >>> 24 === 255;
          const a = solid ? 255 : Math.max(l & 255, (l >>> 8) & 255, l >>> 16);
          out[i] = a ? (Math.round(a * fade * (colAlpha ? colAlpha[x] : 1)) << 24) | (solid ? c & 0xffffff : divide(l, a)) : 0;
        }
      }
    ctx.putImageData(img, 0, 0);
    texture.refresh();
  };
  // Each texel's light blended from the four pixels round its middle (in
  // the frame's pixels, clamped to it), its opaque pixel as it is. No arrays
  // made per texel: 230K texels an upload.
  const uploadSmooth = (rowAlpha?: (y: number) => number, colAlpha?: Float32Array): void => {
    if (!out) return;
    const L = frame.light;
    const C = frame.color;
    for (let Y = 0; Y < H; Y++) {
      const y = (Y + 0.5) / smooth - 0.5;
      const fade = rowAlpha?.(y) ?? 1;
      const y0 = Math.max(0, Math.min(rows - 1, Math.floor(y)));
      const v = Math.max(0, Math.min(1, y - y0));
      const top = y0 * cols;
      const bottom = Math.min(rows - 1, y0 + 1) * cols;
      const row = Math.floor(Y / smooth) * cols;
      for (let X = 0, i = Y * W; X < W; X++, i++) {
        const col = Math.floor(X / smooth);
        const along = colAlpha ? fade * colAlpha[col] : fade;
        const c = C[row + col];
        if (c >>> 24 === 255) {
          out[i] = (Math.round(255 * along) << 24) | (c & 0xffffff);
          continue;
        }
        const x = (X + 0.5) / smooth - 0.5;
        const x0 = Math.max(0, Math.min(cols - 1, Math.floor(x)));
        const x1 = Math.min(cols - 1, x0 + 1);
        const u = Math.max(0, Math.min(1, x - x0));
        const a = L[top + x0];
        const b = L[top + x1];
        const d = L[bottom + x0];
        const e = L[bottom + x1];
        if (!(a | b | d | e)) {
          out[i] = 0;
          continue;
        }
        const w00 = (1 - u) * (1 - v);
        const w01 = u * (1 - v);
        const w10 = (1 - u) * v;
        const w11 = u * v;
        const r = (a & 255) * w00 + (b & 255) * w01 + (d & 255) * w10 + (e & 255) * w11;
        const g = ((a >>> 8) & 255) * w00 + ((b >>> 8) & 255) * w01 + ((d >>> 8) & 255) * w10 + ((e >>> 8) & 255) * w11;
        const bl = ((a >>> 16) & 255) * w00 + ((b >>> 16) & 255) * w01 + ((d >>> 16) & 255) * w10 + ((e >>> 16) & 255) * w11;
        const m = Math.max(r, g, bl);
        if (m < 1) {
          out[i] = 0;
          continue;
        }
        const k = 255 / m;
        out[i] =
          (Math.round(m * along) << 24) |
          (Math.min(255, Math.round(bl * k)) << 16) |
          (Math.min(255, Math.round(g * k)) << 8) |
          Math.min(255, Math.round(r * k));
      }
    }
  };
  return { frame, image, upload };
}

/**
 * Keeps a live canvas going on `scene`'s UPDATE: `draw(dt)` every `stepMs`
 * and `upload()` on the frame after, so a redraw (a millisecond or more) and
 * its upload never share a frame. `dt` is the real time since the last
 * redraw in seconds, the upload's frame counted, so an effect stepped by it
 * keeps real time; at most `maxMs`, as a tab back from the background hands
 * over seconds at once. Counted from after the upload instead, the festival's
 * and the ending's fireworks ran at 0.77x, a burst breaking 83-183ms after
 * its pop, and the forest's sun rays at 0.82x. While `active()` is false
 * nothing is drawn; once it is true again the first redraw comes at once, with
 * dt 0 (a firework launched this frame starts as it is). Stops with the scene.
 */
export function redrawLive(
  scene: Phaser.Scene,
  stepMs: number,
  {
    draw,
    upload,
    active = () => true,
    maxMs = 100,
  }: { draw: (dt: number) => void; upload: () => void; active?: () => boolean; maxMs?: number },
): void {
  let wait = 0;
  let drawn = false;
  let idle = true;
  const step = (_time: number, delta: number): void => {
    wait += delta;
    if (drawn) {
      drawn = false;
      upload();
      return;
    }
    if (!active()) {
      idle = true;
      return;
    }
    // a millisecond's slack, so three 16.67ms frames make 50
    if (!idle && wait < stepMs - 1) return;
    draw(idle ? 0 : Math.min(wait, maxMs) / 1000);
    idle = false;
    wait = 0;
    drawn = true;
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, step);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, step));
}

// a light's colour scaled up to full alpha `a` (its brightest channel), as ABGR
function divide(l: number, a: number): number {
  const k = 255 / a;
  return (
    (Math.min(255, Math.round(((l >>> 16) & 255) * k)) << 16) |
    (Math.min(255, Math.round(((l >>> 8) & 255) * k)) << 8) |
    Math.min(255, Math.round((l & 255) * k))
  );
}
