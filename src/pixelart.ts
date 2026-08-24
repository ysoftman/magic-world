import type Phaser from "phaser";
import { GAME_WIDTH, PIXEL, RETRO_FONT } from "./config";

export interface PixelMap {
  [ch: string]: number;
}

export function retroStyle(size = 8, color = "#ffffff"): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: RETRO_FONT,
    fontSize: `${size * PIXEL}px`,
    color,
    align: "left",
    resolution: 1,
  };
}

const TOAST_NAME = "__toast";

export function showToast(scene: Phaser.Scene, text: string, y = 8): void {
  // Reuse one toast per scene instead of stacking a new Text on every call —
  // otherwise mashing the key that triggers it (e.g. mute) overlaps garbled
  // text from multiple in-flight instances.
  let t = scene.children.getByName(TOAST_NAME) as Phaser.GameObjects.Text | null;
  if (!t) {
    t = scene.add
      .text(GAME_WIDTH / 2, y, "", retroStyle(5, "#8ecbff"))
      .setName(TOAST_NAME)
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(200)
      .setAlpha(0)
      // batched "ACHIEVEMENTS: A, B, C!" toasts can outrun GAME_WIDTH — wrap
      // instead of spilling past the canvas edges.
      .setWordWrapWidth(GAME_WIDTH - 80, true)
      .setAlign("center");
  }
  scene.tweens.killTweensOf(t);
  t.setText(text).setAlpha(0);
  scene.tweens.add({
    targets: t,
    alpha: 1,
    duration: 200,
    yoyo: true,
    hold: 900,
  });
}

export function drawRows(g: Phaser.GameObjects.Graphics, rows: string[], palette: PixelMap, ox: number, oy: number): void {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]];
      if (color !== undefined) {
        g.fillStyle(color, 1);
        g.fillRect(ox + x * PIXEL, oy + y * PIXEL, PIXEL, PIXEL);
      }
    }
  }
}

export function makeTexture(scene: Phaser.Scene, key: string, rows: string[], palette: PixelMap): void {
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const g = scene.add.graphics();
  drawRows(g, rows, palette, 0, 0);
  g.generateTexture(key, w * PIXEL, h * PIXEL);
  g.destroy();
}

// Bakes one horizontal strip of `tileSize` tiles under `key`.
//
// Call this at most ONCE per key per page load. Phaser's generateTexture does
// not replace an existing texture: if the key is already in the Texture Manager
// it draws onto that texture's canvas, and the canvas renderer never clears
// first, so a second call composites on top of the first. There is no warning
// and no error. For an opaque tileset that just redraws the same pixels, but a
// mostly-transparent one (the shore16/road16 transition overlays) keeps the old
// art visible through every transparent pixel.
//
// Safe today because BootScene.buildTextures() runs once per page load --
// MapEditor's scene.restart() restarts its owning scene, not Boot. Moving
// texture baking into a scene that can restart means calling
// scene.textures.remove(key) first.
export function makeTilesetTexture(
  scene: Phaser.Scene,
  key: string,
  tiles: Array<{ rows: string[]; palette: PixelMap }>,
  tileSize: number,
): void {
  const g = scene.add.graphics();
  tiles.forEach((t, i) => {
    drawRows(g, t.rows, t.palette, i * tileSize * PIXEL, 0);
  });
  g.generateTexture(key, tiles.length * tileSize * PIXEL, tileSize * PIXEL);
  g.destroy();
}

// Shading ramp: `steps` shades around `baseHex`, dark to light. Hue shifts with
// brightness the way hand-drawn pixel art does -- shadows lean blue/violet,
// highlights lean yellow -- and saturation peaks in the middle of the ramp so
// the ends do not read as washed-out grey. An odd `steps` puts the base
// brightness on the middle entry.
export function buildRamp(baseHex: number, steps = 5, hueShiftDeg = 16): number[] {
  const { h, s, l } = rgbToHsl(baseHex);
  const ramp: number[] = [];
  for (let i = 0; i < steps; i++) {
    // -1 at the dark end, 0 in the middle, +1 at the light end
    const t = steps === 1 ? 0 : (i / (steps - 1)) * 2 - 1;
    const away = Math.abs(t);
    const hue = shiftHueToward(h, t < 0 ? SHADOW_HUE : HIGHLIGHT_HUE, away * hueShiftDeg);
    ramp.push(hslToRgb(hue, clamp01(s * (1 - 0.25 * away) + 0.06 * (1 - away)), clamp01(l + t * 0.22)));
  }
  return ramp;
}

const SHADOW_HUE = 260;
const HIGHLIGHT_HUE = 55;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

function rgbToHsl(hex: number): { h: number; s: number; l: number } {
  const r = ((hex >> 16) & 0xff) / 255;
  const g = ((hex >> 8) & 0xff) / 255;
  const b = (hex & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return { h: 0, s: 0, l };
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return { h: h < 0 ? h + 360 : h, s: d / (1 - Math.abs(2 * l - 1)), l };
}

function hslToRgb(hDeg: number, s: number, l: number): number {
  const h = (((hDeg % 360) + 360) % 360) / 60;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = l - c / 2;
  const sector = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][Math.floor(h) % 6];
  return sector.reduce((acc, v) => (acc << 8) | Math.round(clamp01(v + m) * 255), 0);
}

// Walks `deg` degrees from `h` toward `target`, taking the short way round and
// never overshooting.
function shiftHueToward(h: number, target: number, deg: number): number {
  const delta = ((target - h + 540) % 360) - 180;
  return h + Math.sign(delta) * Math.min(deg, Math.abs(delta));
}

// The ellipse the scenes already put under the hero and the npcs. Defaults match
// that code exactly, so it can also be dropped under the objects that currently
// have no shadow at all (trees, houses, chests).
export function addGroundShadow(
  scene: Phaser.Scene,
  target: { x: number; y: number },
  opts: { w?: number; h?: number; yOffset?: number; depth?: number; alpha?: number } = {},
): Phaser.GameObjects.Ellipse {
  const { w = 40, h = 16, yOffset = 28, depth = 5, alpha = 0.4 } = opts;
  return scene.add.ellipse(target.x, target.y + yOffset, w, h, 0x000000, alpha).setDepth(depth);
}
