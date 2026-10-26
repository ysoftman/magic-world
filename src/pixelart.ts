import type Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, PIXEL, RETRO_FONT } from "./config";

export interface PixelMap {
  [ch: string]: number;
}

// The dimmed text colour: what's empty, locked, out of stock or just a key
// hint. 4.96:1 on the panels' #0b0b2b — WCAG AA for text — and still a third
// as bright as their #f5f5f5, so it reads as greyed out. The #666666 (3.33:1)
// and #444444 (1.97:1) it replaces were the UI's least legible lines.
export const DIM_TEXT = "#808096";

// Text is baked at the scale the screen shows the 1280x720 canvas at (device
// pixels per game pixel, rounded up, 1 to 3), then drawn back down with the
// game's nearest filtering. Baked at 1, a glyph's anti-aliased grey edge was
// what the FIT scaling blew up into the blur: on a MacBook (DPR2 1440x900,
// 2.25x) the in-between pixels of a 20px line went from 24.7% to 0% at 3,
// 33.8% to 10.7% for 24px, at no FPS cost. The price is texture memory, the
// square of it: the town's 431 texts take 3.9MB at 1, 15MB at 2, ~35MB at 3,
// hence the cap. Read once at load — a window resized later keeps it. Every
// Text goes through retroStyle; one styled by hand must use this too.
const TEXT_RESOLUTION_MAX = 3;
export const TEXT_RESOLUTION = ((): number => {
  if (typeof window === "undefined") return 1;
  const shown = (window.devicePixelRatio || 1) * Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT);
  return Math.min(TEXT_RESOLUTION_MAX, Math.max(1, Math.ceil(shown - 1e-6)));
})();

export function retroStyle(size = 8, color = "#ffffff"): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: RETRO_FONT,
    fontSize: `${size * PIXEL}px`,
    color,
    align: "left",
    resolution: TEXT_RESOLUTION,
  };
}

const TOAST_NAME = "__toast";

// Where a field scene (forest/snow/volcano/cave) shows its toasts: under the
// area title (STATUS_HUD_HEIGHT + 24 = 112, retroStyle(8) with its outline:
// y 93..131) and the weather caption below it (Ambient's CAPTION_Y = 154,
// retroStyle(5): y 142..166). Both fade out ~3s after entry, but toasts fire
// during that window (achievements claimed on arrival), and the town's
// STATUS_HUD_TOAST_Y (100) sat right on the title. A literal rather than
// read off StatusHud, which imports this file.
export const FIELD_TOAST_Y = 176;
// at most this many wait behind the toast on screen; past that the oldest
// waiting one is dropped, so a burst can't trail stale news for seconds
// (each toast is up ~1.3s: 200ms in, 900ms hold, 200ms out)
const TOAST_MAX_WAITING = 3;

interface ToastEntry {
  text: string;
  y?: number;
  // a status line put up under a panel: the answer to what the player just
  // did there (SLOT 1 CODE COPIED, SOUND: OFF), so it shows over the panel
  pinned?: boolean;
}

interface ToastState {
  showing: boolean;
  // the toast up now, while `showing`
  current: ToastEntry | null;
  waiting: ToastEntry[];
}

// per toast Text, so a scene restart (which destroys the Text) starts clean
const toastStates = new WeakMap<Phaser.GameObjects.Text, ToastState>();

// News waits while a scene's panel, help or talk is up (holdToastsWhile).
// An unlock tip or an achievement printed over a panel's title covered it
// and was unreadable itself ("THE FOREST GATE IS OPEN!" on ITEMS). News (a
// line with a "!": achievements, tips, "MARKET DAY! ...") comes out in order
// once the panel closes; one already up when a panel opens goes back to the
// front of the line. A status line already up then (SAVED from just before)
// is put away, stale. One put up under the panel is pinned and shows: it
// answers a key pressed there. A scene that holds must call pumpToasts()
// every frame.
const toastHolds = new WeakMap<Phaser.Scene, () => boolean>();
const toastsHeld = (scene: Phaser.Scene): boolean => toastHolds.get(scene)?.() === true;
const isNews = (text: string): boolean => text.includes("!");

export function holdToastsWhile(scene: Phaser.Scene, held: () => boolean): void {
  toastHolds.set(scene, held);
}

export function pumpToasts(scene: Phaser.Scene): void {
  const t = scene.children.getByName(TOAST_NAME) as Phaser.GameObjects.Text | null;
  const state = t && toastStates.get(t);
  if (!t || !state) return;
  if (toastsHeld(scene)) {
    if (state.showing && !state.current?.pinned) {
      scene.tweens.killTweensOf(t);
      t.setAlpha(0);
      state.showing = false;
      state.waiting = state.waiting.filter((e) => e.pinned || isNews(e.text));
      if (state.current && isNews(state.current.text)) state.waiting.unshift(state.current);
      state.current = null;
    }
    const pinned = state.showing ? -1 : state.waiting.findIndex((e) => e.pinned);
    if (pinned >= 0) playToast(scene, t, state, state.waiting.splice(pinned, 1)[0]);
    return;
  }
  const next = state.showing ? undefined : state.waiting.shift();
  if (next) playToast(scene, t, state, next);
}

// what a toast is about: "SOUND" for "SOUND: ON", the whole text when there's
// no colon ("SAVED")
const toastTopic = (text: string): string => text.split(":")[0];

// Whether `next` supersedes `prev`, so it can take its place rather than
// wait behind it. A status line (no "!": SOUND: ON, SAVED, COMPANION: X) is
// only ever its latest value, so a newer one on the same topic supersedes
// it. An announcement ends in "!" (an achievement, a town event, A NIGHT
// WISP EMERGES!) and is news each time — two different achievements must
// both be seen — so only the very same line again supersedes it.
const supersedes = (next: string, prev: string): boolean =>
  next === prev || (!next.endsWith("!") && !prev.endsWith("!") && toastTopic(next) === toastTopic(prev));

/**
 * One toast line per scene, near the top of the screen. `y` places this
 * toast; left out, it shows wherever the scene's toast last was (y=8 for
 * the first one), as it always did.
 *
 * Toasts queue rather than cut each other off: an achievement claimed while
 * a town event is being announced waits its turn. One that supersedes the
 * toast up or waiting (see supersedes()) replaces it instead — "SOUND: ON"
 * mashed after "SOUND: OFF", a second "SAVED" — which keeps a mashed toggle
 * instant, while a second, different achievement still queues.
 *
 * Under a held scene's panel (holdToastsWhile) news waits for it to close
 * and a status line shows over it (see toastHolds).
 */
export function showToast(scene: Phaser.Scene, text: string, y?: number): void {
  // Reuse one toast per scene instead of stacking a new Text on every call —
  // otherwise mashing the key that triggers it (e.g. mute) overlaps garbled
  // text from multiple in-flight instances.
  let t = scene.children.getByName(TOAST_NAME) as Phaser.GameObjects.Text | null;
  if (!t) {
    t = scene.add
      .text(GAME_WIDTH / 2, y ?? 8, "", retroStyle(5, "#8ecbff"))
      .setName(TOAST_NAME)
      .setOrigin(0.5, 0)
      // the same dark outline as the other floating text (the TOWN marker,
      // the weather caption): without it the pale blue sat on the snow
      // field's pale ground (luminance ~193 on ~188) with nothing to read by
      .setStroke("#1a1028", 4)
      .setScrollFactor(0)
      .setDepth(200)
      .setAlpha(0)
      // batched "ACHIEVEMENTS: A, B, C!" toasts can outrun GAME_WIDTH — wrap
      // instead of spilling past the canvas edges.
      .setWordWrapWidth(GAME_WIDTH - 80, true)
      .setAlign("center");
  }
  let state = toastStates.get(t);
  if (!state) {
    state = { showing: false, current: null, waiting: [] };
    toastStates.set(t, state);
  }
  const held = toastsHeld(scene);
  const entry: ToastEntry = { text, y, pinned: held && !isNews(text) };
  const waits = held && !entry.pinned;
  if (!waits && (!state.showing || supersedes(text, t.text))) {
    playToast(scene, t, state, entry);
    return;
  }
  const same = state.waiting.findIndex((e) => supersedes(text, e.text));
  if (same >= 0) {
    state.waiting[same] = entry;
    return;
  }
  state.waiting.push(entry);
  if (state.waiting.length > TOAST_MAX_WAITING) state.waiting.shift();
}

function playToast(scene: Phaser.Scene, t: Phaser.GameObjects.Text, state: ToastState, entry: ToastEntry): void {
  // a killed tween never completes, so a replaced toast doesn't also pull
  // the next one off the queue
  scene.tweens.killTweensOf(t);
  state.showing = true;
  state.current = entry;
  if (entry.y !== undefined) t.setY(entry.y);
  t.setText(entry.text).setAlpha(0);
  scene.tweens.add({
    targets: t,
    alpha: 1,
    duration: 200,
    yoyo: true,
    hold: 900,
    onComplete: () => {
      state.showing = false;
      state.current = null;
      // under a panel the line waits for pumpToasts() to let it out
      if (toastsHeld(scene)) return;
      const next = state.waiting.shift();
      if (next) playToast(scene, t, state, next);
    },
  });
}

// Every grid is baked through Scale2x and drawn in half-size art pixels
// (ART_PX, 2px), so a texture keeps its size (16 cells x 4px = 64px) while its
// stair steps come out as diagonals. The whole game then reads at one 2px
// density, and art redrawn on a 32-cell grid (drawn at ART_PX as it is, no
// Scale2x) sits beside the rest without a jump in density. keepBlocky() opts a
// grid out where Scale2x bends what it was drawn to say (see BootScene).
export const ART_PX = PIXEL / 2;

// What Scale2x sees past a grid's edge: nothing for a sprite, so it never
// grows past its outline; the edge cell itself for a tile, so no corner is cut
// toward a neighbour it cannot see (transition tiles don't wrap round).
export type GridEdges = "transparent" | "clamp";

// Scale2x (AdvMAME2x): each cell becomes 2x2, and a corner takes a
// neighbour's colour where the two edges beside it agree, so a step becomes a
// diagonal. It only ever reuses colours already there, never blends.
// `family` (the characters of one terrain, e.g. a transition tile's grass)
// limits it to the boundary: a corner only changes where the colour it would
// take lies across that boundary, so the shoreline rounds off while the
// water's own pattern stays cell for cell what the base water tile draws.
export function scale2x(rows: readonly string[], edges: GridEdges = "transparent", family?: string): string[] {
  const pick = (p: string, n: string): string => (family === undefined || family.includes(p) !== family.includes(n) ? n : p);
  const at =
    edges === "clamp"
      ? (x: number, y: number): string => {
          const row = rows[Math.min(rows.length - 1, Math.max(0, y))];
          return row[Math.min(row.length - 1, Math.max(0, x))];
        }
      : (x: number, y: number): string => rows[y]?.[x] ?? ".";
  const out: string[] = [];
  rows.forEach((row, y) => {
    let top = "";
    let bottom = "";
    for (let x = 0; x < row.length; x++) {
      const p = at(x, y);
      const a = at(x, y - 1);
      const b = at(x + 1, y);
      const c = at(x - 1, y);
      const d = at(x, y + 1);
      top += (c === a && c !== d && a !== b ? pick(p, a) : p) + (a === b && a !== c && b !== d ? pick(p, b) : p);
      bottom += (d === c && d !== b && c !== a ? pick(p, c) : p) + (b === d && b !== a && d !== c ? pick(p, d) : p);
    }
    out.push(top, bottom);
  });
  return out;
}

const blockyGrids = new WeakSet<readonly string[]>();
const boundaryGrids = new WeakMap<readonly string[], string>();
// these grids bake as they always did, in full 4px cells
export function keepBlocky(...grids: ReadonlyArray<readonly string[]>): void {
  for (const grid of grids) blockyGrids.add(grid);
}
// these bake through Scale2x across the edge of `family` only (see scale2x)
export function smoothBoundaryOnly(family: string, ...grids: ReadonlyArray<readonly string[]>): void {
  for (const grid of grids) boundaryGrids.set(grid, family);
}

// The cells `rows` bakes to and their size: Scale2x at ART_PX by default; as
// drawn at `px` when one is given (a grid already at 2px density, or PIXEL
// for a composite kept blocky); as drawn at PIXEL for a keepBlocky() grid.
export function bakedCells(
  rows: readonly string[],
  edges: GridEdges = "transparent",
  px?: number,
): { cells: readonly string[]; px: number } {
  if (px !== undefined) return { cells: rows, px };
  if (blockyGrids.has(rows)) return { cells: rows, px: PIXEL };
  return { cells: scale2x(rows, edges, boundaryGrids.get(rows)), px: ART_PX };
}

export function drawRows(
  g: Phaser.GameObjects.Graphics,
  rows: readonly string[],
  palette: PixelMap,
  ox: number,
  oy: number,
  { edges = "transparent", px }: { edges?: GridEdges; px?: number } = {},
): void {
  const baked = bakedCells(rows, edges, px);
  const size = baked.px;
  // one rectangle per run of a colour along the row, not per cell: the same
  // pixels for a quarter of the draw calls Scale2x's doubled rows would cost
  baked.cells.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      let end = x + 1;
      while (end < row.length && row[end] === row[x]) end++;
      const color = palette[row[x]];
      if (color !== undefined) {
        g.fillStyle(color, 1);
        g.fillRect(ox + x * size, oy + y * size, (end - x) * size, size);
      }
      x = end;
    }
  });
}

// `px` marks a grid drawn at that cell size as it stands (a 32-cell grid at
// ART_PX); without it the grid is a 16-density one and bakes through Scale2x
export function makeTexture(scene: Phaser.Scene, key: string, rows: readonly string[], palette: PixelMap, px?: number): void {
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const cell = px ?? PIXEL;
  const g = scene.add.graphics();
  drawRows(g, rows, palette, 0, 0, { px });
  g.generateTexture(key, w * cell, h * cell);
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
    drawRows(g, t.rows, t.palette, i * tileSize * PIXEL, 0, { edges: "clamp" });
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
