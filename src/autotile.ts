// Autotiling helpers: coastline/path-edge transition tiles (dual-grid corner
// sampling) and deterministic per-cell tile variation (grass/water/path).
//
// Wired in from sceneCommon.ts, which the four roaming scenes call after
// setting up their tilemap layer: applyTileVariations paints variant indices
// onto the render layer, then buildTerrainOverlays adds one transition
// container per terrain pair. Both are safe to re-run on every scene
// (re)create — variation is a deterministic hash rather than random, and the
// overlay containers go away with the scene.
//
// Nothing here touches `level[][]`, `overworldMap.ts`, or the map editor's
// export path: MapEditor reads `this.level` (the logical grid) to export,
// never the render layer's tile index, so painting extra tile indexes onto
// the layer alone is invisible to the map file and the F2 editor.

import type Phaser from "phaser";
import { T_HOUSE, T_TREE, TILE } from "./levels";

/** Tiles that draw an object, not ground — the overlay must not paint over these. */
const OBJECT_TILES: ReadonlySet<number> = new Set([T_TREE, T_HOUSE]);

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
 * Depth for the transition overlay: above the base tile layer (depth 0 — the
 * ground/tree tilemap and the un-depth-set house image both sit there) but
 * below anything with a real "standing on the ground" depth: shadows (5),
 * farm crops (8), signs/cave art (9), the exit marker (9.5) and every actor
 * (10+). Matches WorldScene's depth scale as read for this task — re-check
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
 * this dual-grid cell sits entirely inside one terrain — the base tile layer
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
 * Builds one terrain-pair's transition overlay as a Container of Images,
 * laid out on the dual (offset-by-half-tile) grid over `level`. Call once
 * per terrain pair after the base tilemap layer exists — e.g.:
 *   buildTransitionLayer(this, this.level, SHORE_TEXTURE_KEY, new Set([T_WATER_A, T_WATER_B]))
 *   buildTransitionLayer(this, this.level, ROAD_TEXTURE_KEY, new Set([T_PATH]))
 *
 * Purely additive — never mutates `level` or any Tilemap layer. `textureKey`
 * must already have 14 frames baked in at index 0..13 (mask 1..14 — see
 * transitionTileIndex above); currently "shore16"/"road16".
 */
export function buildTransitionLayer(
  scene: Phaser.Scene,
  level: readonly (readonly number[])[],
  textureKey: string,
  otherIds: OtherIds,
  tileSize = TILE,
  depth = TRANSITION_DEPTH,
): Phaser.GameObjects.Container {
  const mapH = level.length;
  const mapW = level[0]?.length ?? 0;
  const container = scene.add.container(0, 0).setDepth(depth);
  for (let gy = 0; gy <= mapH; gy++) {
    for (let gx = 0; gx <= mapW; gx++) {
      if (coversAnObject(level, gx, gy)) continue;
      const index = transitionTileIndex(cornerMask(level, gx, gy, otherIds));
      if (index === null) continue;
      const frameKey = ensureTileFrame(scene, textureKey, index, tileSize);
      container.add(scene.add.image(gx * tileSize - tileSize / 2, gy * tileSize - tileSize / 2, textureKey, frameKey).setOrigin(0, 0));
    }
  }
  return container;
}

/**
 * True when this dual-grid cell straddles a tile that draws an object rather
 * than ground — a tree or a house.
 *
 * cornerMask only asks "is this corner the other terrain?", so a tree counts
 * as base ground and the overlay happily draws over it. The overlay is fully
 * opaque and sits above the tilemap, and a dual-grid cell covers the bottom
 * half of one tile and the top half of the next, so a tree next to a path or
 * shore lost its trunk to a patch of painted grass. Skipping the cell leaves
 * that one corner square instead, which is far less visible than a tree cut
 * in half.
 */
function coversAnObject(level: readonly (readonly number[])[], gx: number, gy: number): boolean {
  for (const [x, y] of [
    [gx - 1, gy - 1],
    [gx, gy - 1],
    [gx - 1, gy],
    [gx, gy],
  ]) {
    if (OBJECT_TILES.has(level[y]?.[x] ?? -1)) return true;
  }
  return false;
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
