import Phaser from "phaser";
import { createFrame, type FxFrame } from "pixelfx";

/**
 * A screen-fixed canvas that pixelfx effects (MIT; their notice is the /*!
 * line in fx.ts) are drawn into live, one of their pixels to `cell` px, for
 * an effect too long or too varied to bake into a sheet (the forest's sun
 * rays, the festival fireworks). The caller draws into `frame` (its origin
 * at `ox`, `oy` in the effects' own pixels) and calls `upload`, which shows
 * it added over the scene (ADD): their light, and their opaque pixels as they
 * are. Their translucent colour (the dark air of a night backdrop, smoke) is
 * left out: added, it could only brighten. The image starts hidden, and goes
 * with the scene, texture and all.
 */
export function addLightCanvas(
  scene: Phaser.Scene,
  key: string,
  { cols, rows, cell, depth, ox = 0, oy = 0 }: { cols: number; rows: number; cell: number; depth: number; ox?: number; oy?: number },
): { frame: FxFrame; image: Phaser.GameObjects.Image; upload: (rowAlpha?: (y: number) => number) => void } {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const texture = scene.textures.createCanvas(key, cols, rows);
  const image = scene.add
    .image(0, 0, key)
    .setOrigin(0)
    .setScale(cell)
    .setScrollFactor(0)
    .setDepth(depth)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setVisible(false);
  const frame = createFrame(cols, rows, ox, oy);
  const ctx = texture?.getContext();
  const img = ctx?.createImageData(cols, rows);
  const out = img && new Uint32Array(img.data.buffer);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    image.destroy();
    scene.textures.remove(key);
  });
  // `rowAlpha` scales a row's alpha, 0..1 (a fade in from an edge)
  const upload = (rowAlpha?: (y: number) => number): void => {
    if (!ctx || !img || !out || !texture) return;
    for (let y = 0; y < rows; y++) {
      const fade = rowAlpha?.(y) ?? 1;
      for (let i = y * cols; i < (y + 1) * cols; i++) {
        const c = frame.color[i];
        const l = frame.light[i] & 0xffffff;
        // an opaque pixel as it is; or the light, as its colour over its
        // brightest channel (added, that is the light itself)
        const solid = c >>> 24 === 255;
        const a = solid ? 255 : Math.max(l & 255, (l >>> 8) & 255, l >>> 16);
        out[i] = a ? (Math.round(a * fade) << 24) | (solid ? c & 0xffffff : divide(l, a)) : 0;
      }
    }
    ctx.putImageData(img, 0, 0);
    texture.refresh();
  };
  return { frame, image, upload };
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
