// Autotiling helpers: coastline/path-edge transition tiles (dual-grid corner
// sampling) and deterministic per-cell tile variation (grass/water/path).
//
// Wired in from sceneCommon.ts: buildTileLayers paints variant indices onto
// the terrain layer and then adds one transition container per terrain pair.
// Both are safe to re-run on every scene (re)create — variation is a
// deterministic hash rather than random, and the overlay containers go away
// with the scene.
//
// The grid handed to buildTransitionLayer is the *ground* grid, not `level`:
// object tiles (tree, house) have already been swapped for the ground under
// them, so a corner sample never has to know an object exists. The overlay is
// free to run straight through an object's cell, because the object layer is
// drawn above it (see TRANSITION_DEPTH below).
//
// Nothing here touches `level[][]`, `overworldMap.ts`, or the map editor's
// export path: MapEditor reads `this.level` (the logical grid) to export,
// never the render layer's tile index, so painting extra tile indexes onto
// the layer alone is invisible to the map file and the F2 editor.

import type Phaser from "phaser";
import { T_GRASS, TILE } from "./levels";

/**
 * The terrain the transition art paints on its NON-`otherIds` half. Both
 * "shore16" and "road16" draw grass there — `bun run check:art` asserts their
 * grass tones match GRASS_PALETTE exactly, which is the same reason this
 * constant exists. Re-point it (or split it per texture) the day either
 * texture's base half stops being grass.
 *
 * This is the third bug of one shape, so the shape is worth naming: this file
 * and applyTileVariations both work off tile *indexes* and used to quietly
 * ASSUME what those indexes were. Water variation frames were painted without
 * being registered as solid, so water became walkable. The overlay was painted
 * over trees, so trees lost their trunks. The overlay was painted over soil, so
 * a farm plot rendered as a square of grass. Every time the guard has to ask
 * "does what I am about to draw actually match this tile?", never "everything
 * that is not `otherIds` must be grass".
 */
const OVERLAY_BASE_ID = T_GRASS;

/** Tile indices that count as "other" terrain for a corner sample (e.g. the water set, or the path set). */
export type OtherIds = ReadonlySet<number>;

// ---------------------------------------------------------------------------
// Texture layout (agreed with impl-art / team-lead — do not renumber without
// updating BootScene's tileset bakes too):
//
// Base terrain (grass/water/tree/path/tall/house/soil, plus impl-art's 8..19
// variation frames) lives in "tiles16", indices this file never touches.
//
// Transition art lives in two SEPARATE textures, not appended to "tiles16" —
// a single texture holding tiles16's 20 base/variation frames *plus* 28
// transition frames would be 48 * 16 * PIXEL(4) = 3072px wide. Some mobile
// GPUs report GL_MAX_TEXTURE_SIZE=2048 (this game supports touch — see
// src/ui/TouchControls.ts — so mobile GPUs are in scope), and a texture over
// that limit silently fails to create on those devices: terrain would render
// fine on desktop and vanish on a subset of phones. Splitting into two
// textures keeps each at 14 * 16 * 4 = 896px, safely under any real device's
// limit:
//   "shore16" — grass<->water transitions, mask 1..14 -> frame index 0..13
//   "road16"  — grass<->path transitions,  mask 1..14 -> frame index 0..13
// (mask 0 and 15 have no frame at all — see transitionTileIndex below)
// ---------------------------------------------------------------------------
export const SHORE_TEXTURE_KEY = "shore16";
export const ROAD_TEXTURE_KEY = "road16";
/** How many transition tiles exist per terrain pair (masks 1..14; masks 0 and 15 draw nothing). */
export const TRANSITION_TILE_COUNT = 14;

/**
 * Depth for the transition overlay: above the terrain layer (depth 0) but
 * below the object layer (depth 2), which is what lets an edge run through a
 * tree's cell without cutting the tree in half — the tree is drawn again on
 * top of it. Below every "standing on the ground" depth too: shadows (5),
 * farm crops (8), signs/cave art (9), the exit marker (9.5) and every actor
 * (10+). Matches TownScene's depth scale as read for this task — re-check
 * that scale if it changes.
 */
export const TRANSITION_DEPTH = 1;

/**
 * Corner-sample bitmask for the dual-grid point at grid coordinate (gx, gy)
 * — the shared corner of the 4 base-grid cells (gx-1,gy-1), (gx,gy-1),
 * (gx-1,gy) and (gx,gy). A bit is 1 when that corner's cell is in
 * `otherIds` (e.g. the water set), 0 when it's the base terrain (e.g.
 * grass). Out-of-bounds cells count as base (0) so map edges don't grow a
 * false shoreline.
 *
 * Bit convention — WE define this; there is no external standard to match.
 * (Checked two primary sources on marching-squares/dual-grid autotiling and
 * each uses a different corner order.) Pick once, draw art to match, and
 * never "correct" it later without re-drawing every transition tile:
 *   bit 0 (1) = top-left corner     (gx-1, gy-1)
 *   bit 1 (2) = top-right corner    (gx,   gy-1)
 *   bit 2 (4) = bottom-left corner  (gx-1, gy)
 *   bit 3 (8) = bottom-right corner (gx,   gy)
 */
export function cornerMask(level: readonly (readonly number[])[], gx: number, gy: number, otherIds: OtherIds): number {
  const at = (x: number, y: number): number => (otherIds.has(level[y]?.[x] ?? -1) ? 1 : 0);
  return at(gx - 1, gy - 1) | (at(gx, gy - 1) << 1) | (at(gx - 1, gy) << 2) | (at(gx, gy) << 3);
}

/**
 * Maps a corner mask (0..15) to a frame index (0..13) within a transition
 * texture ("shore16" or "road16" — both use the same mask-to-frame mapping,
 * only the texture differs), or null when nothing should be drawn. Mask 0
 * (all 4 corners are base terrain) and mask 15 (all 4 are "other") both mean
 * this dual-grid cell sits entirely inside one terrain — the terrain layer
 * underneath already shows the right thing there, so there's nothing to
 * overlay.
 *
 * Masks 6 and 9 are the diagonal ("saddle") cases — two opposite corners are
 * "other", the other two are base. Neither primary source checked for this
 * settles how to draw these; we draw them as two independent corner wedges
 * (not connected across the diagonal). Decide this once when authoring
 * those two tiles and don't "fix" it later without re-checking every
 * coastline/road edge in the game — it's a visual choice baked into the
 * art, not a bug in this function.
 */
export function transitionTileIndex(mask: number): number | null {
  if (mask <= 0 || mask >= 15) return null;
  return mask - 1;
}

/** Frame name this module registers on a shared baked tileset texture for one tile index. */
function tileFrameKey(textureKey: string, index: number): string {
  return `${textureKey}#${index}`;
}

/**
 * Lazily registers a Phaser texture Frame for tile `index` on the shared
 * baked tileset texture (e.g. "shore16"/"road16"), so a single tile can be
 * drawn with a plain `scene.add.image` instead of a second Tilemap layer.
 * Guarded with `.has()` so re-running this every scene (re)create (battle
 * return, F2 reset) is cheap and idempotent — Phaser textures persist across
 * a scene restart within the same page load.
 */
function ensureTileFrame(scene: Phaser.Scene, textureKey: string, index: number, tileSize: number): string {
  const key = tileFrameKey(textureKey, index);
  const texture = scene.textures.get(textureKey);
  if (!texture.has(key)) texture.add(key, 0, index * tileSize, 0, tileSize, tileSize);
  return key;
}

/**
 * Builds one terrain-pair's transition overlay as a Container of Images, laid
 * out on the dual (offset-by-half-tile) grid over `ground` — the grid of what
 * the terrain layer actually painted, object tiles already resolved to the
 * ground beneath them. Call once per terrain pair after the terrain layer
 * exists — e.g.:
 *   buildTransitionLayer(this, ground, SHORE_TEXTURE_KEY, new Set([T_WATER_A, T_WATER_B]))
 *   buildTransitionLayer(this, ground, ROAD_TEXTURE_KEY, new Set([T_PATH]))
 *
 * Purely additive — never mutates the grid or any Tilemap layer. `textureKey`
 * must already have 14 frames baked in at index 0..13 (mask 1..14 — see
 * transitionTileIndex above); currently "shore16"/"road16".
 */
export function buildTransitionLayer(
  scene: Phaser.Scene,
  ground: readonly (readonly number[])[],
  textureKey: string,
  otherIds: OtherIds,
  tileSize = TILE,
  depth = TRANSITION_DEPTH,
): Phaser.GameObjects.Container {
  const mapH = ground.length;
  const mapW = ground[0]?.length ?? 0;
  const container = scene.add.container(0, 0).setDepth(depth);
  for (let gy = 0; gy <= mapH; gy++) {
    for (let gx = 0; gx <= mapW; gx++) {
      const index = transitionTileIndex(cornerMask(ground, gx, gy, otherIds));
      if (index === null) continue;
      if (!coversOnlyPaintableGround(ground, gx, gy, otherIds)) continue;
      const frameKey = ensureTileFrame(scene, textureKey, index, tileSize);
      container.add(scene.add.image(gx * tileSize - tileSize / 2, gy * tileSize - tileSize / 2, textureKey, frameKey).setOrigin(0, 0));
    }
  }
  return container;
}

/**
 * True when every corner of this dual cell is ground the transition art can
 * honestly cover: the base terrain it paints on one half (OVERLAY_BASE_ID), or
 * the `otherIds` terrain it paints on the other. Soil and tall grass are
 * neither, and the art is fully opaque, so an overlay tile straddling them
 * wipes them out and leaves grass behind — the farm losing its bottom-right
 * plot to the road below it, or a monster zone losing the tall grass that
 * marks it, which is a gameplay signal and not just a smudge.
 *
 * cornerMask only asks "is this corner `otherIds`?", so it folds every other
 * terrain into one "base" bucket and cannot make this call itself.
 *
 * Trees and houses need no guard here any more: they render on the object
 * layer *above* this overlay (see TRANSITION_DEPTH), so an edge may run
 * straight through their cell and they are simply drawn again on top. That is
 * the whole point of the split — the boundary keeps its rounded corner.
 *
 * Out of bounds counts as base terrain, exactly as cornerMask treats it.
 */
function coversOnlyPaintableGround(ground: readonly (readonly number[])[], gx: number, gy: number, otherIds: OtherIds): boolean {
  for (const [x, y] of [
    [gx - 1, gy - 1],
    [gx, gy - 1],
    [gx - 1, gy],
    [gx, gy],
  ]) {
    const tile = ground[y]?.[x];
    if (tile !== undefined && tile !== OVERLAY_BASE_ID && !otherIds.has(tile)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Deterministic per-cell tile variation (grass/water/path). NOT Math.random —
// a hash of (x, y) so the same cell always picks the same variant, whether
// this runs on first load, a battle-return scene restart, or the F2 editor's
// "R" reset. Phaser's own `TilemapLayer#weightedRandomize`/`randomize` were
// considered and rejected for this: they re-roll with Math.random() on every
// call (visible flicker on every scene restart) and they overwrite every
// tile in a rectangular region regardless of its current index (they'd also
// turn water/tree/path tiles into grass, not just the grass ones).
// ---------------------------------------------------------------------------

/** Cheap 32-bit integer hash of a tile coordinate — stable across runs, not cryptographic. */
export function tileHash(x: number, y: number): number {
  const mixed = (Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0;
  return Math.imul(mixed ^ (mixed >>> 13), 1274126177) >>> 0;
}

/** Deterministically picks one of `variants` for cell (x, y). Put the plain/base index first by convention. */
export function pickVariant(variants: readonly number[], x: number, y: number): number {
  return variants[tileHash(x, y) % variants.length];
}
