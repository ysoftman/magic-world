import type Phaser from "phaser";
import { buildTransitionLayer, pickVariant, ROAD_TEXTURE_KEY, SHORE_TEXTURE_KEY } from "./autotile";
import { SOLID, T_PATH, T_WATER_A, T_WATER_B } from "./levels";
import { TILE_VARIANTS } from "./scenes/BootScene";

type LastMove = "down" | "up" | "right" | "left";

const WALK_DIRECTIONS: readonly LastMove[] = ["down", "up", "right", "left"];
const WALK_FRAME_COUNT = 4;
const WALK_FRAME_RATE = 10;

// Every variant set starts with the base index the map data actually stores
// (TILE_VARIANTS.grass[0] === T_GRASS and so on), so the first entry doubles as
// the set's key and as the "plain" look.
const VARIANT_SETS: readonly (readonly number[])[] = [TILE_VARIANTS.grass, TILE_VARIANTS.waterA, TILE_VARIANTS.waterB, TILE_VARIANTS.path];
const VARIANTS_BY_BASE = new Map<number, readonly number[]>(VARIANT_SETS.map((set) => [set[0], set]));
const BASE_BY_VARIANT = new Map<number, number>(VARIANT_SETS.flatMap((set) => set.map((index): [number, number] => [index, set[0]])));
// The variation frames of a solid base (the water sets) — they have to collide
// exactly like the base tile they replace.
const SOLID_VARIANT_INDEXES: number[] = VARIANT_SETS.filter((set) => SOLID.has(set[0])).flatMap((set) => set.slice(1));

/** Tile index pairs the water tick swaps. Add a pair per water variation. */
export type TileSwapPair = readonly [number, number];

// waterA[i] and waterB[i] are the same ripple layout one row apart, so pairing
// them by position is what keeps the animation in phase.
export const WATER_TILE_PAIRS: readonly TileSwapPair[] = TILE_VARIANTS.waterA.map((a, i): TileSwapPair => [a, TILE_VARIANTS.waterB[i]]);

/** True for a solid tile index, variation frames included. Use instead of `SOLID.has(tile.index)` on a rendered layer. */
export function isSolidTile(index: number): boolean {
  return SOLID.has(BASE_BY_VARIANT.get(index) ?? index);
}

/**
 * Repaints the render layer with one deterministic variation per cell, so the
 * same speckle stops landing on every tile of the same terrain. `level` (the
 * logical grid the map file, the minimap and the F2 editor all read) is left
 * alone — only the layer's rendered indexes change, and `pickVariant` hashes
 * the coordinates, so a scene restart repaints the identical pattern.
 */
export function applyTileVariations(layer: Phaser.Tilemaps.TilemapLayer, level: readonly (readonly number[])[]): void {
  // putTileAt re-derives the new tile's collision from the layer's collide
  // index list, so the water variants must be registered as solid *before* the
  // first one is painted. setCollision appends, so the SOLID pass the scene
  // already ran stays in effect.
  layer.setCollision(SOLID_VARIANT_INDEXES);
  for (let y = 0; y < level.length; y++) {
    const row = level[y];
    for (let x = 0; x < row.length; x++) {
      const variants = VARIANTS_BY_BASE.get(row[x]);
      if (variants) layer.putTileAt(pickVariant(variants, x, y), x, y);
    }
  }
}

export const WATER_ANIM_DELAY = 400;

/**
 * Swap every water tile in the layer to its partner index on a loop, which is
 * what makes the water ripple. Each pair swaps both ways and a tile is visited
 * once per tick, so overlapping pairs can never double-swap back to the start.
 */
export function startWaterAnimation(
  scene: Phaser.Scene,
  layer: Phaser.Tilemaps.TilemapLayer,
  pairs: readonly TileSwapPair[] = WATER_TILE_PAIRS,
  delay = WATER_ANIM_DELAY,
): Phaser.Time.TimerEvent {
  const nextIndex = new Map<number, number>();
  for (const [a, b] of pairs) {
    nextIndex.set(a, b);
    nextIndex.set(b, a);
  }
  return scene.time.addEvent({
    delay,
    loop: true,
    callback: () => {
      layer.forEachTile((tile) => {
        const swapped = nextIndex.get(tile.index);
        if (swapped !== undefined) tile.index = swapped;
      });
    },
  });
}

// The two terrain pairs that own transition art. Both read the *logical* grid,
// which only ever holds base indexes, so variation frames can't confuse them.
const SHORE_IDS: ReadonlySet<number> = new Set([T_WATER_A, T_WATER_B]);
const ROAD_IDS: ReadonlySet<number> = new Set([T_PATH]);

/**
 * Draws the coastline and road-edge overlays over an already-built base layer.
 * Purely decorative: two Containers of Images at TRANSITION_DEPTH (above the
 * tilemap, below every shadow and actor) with no physics of their own, so
 * walkability still comes from the tilemap layer alone. The scene owns them —
 * a restart tears the old ones down with the rest of the display list.
 */
export function buildTerrainOverlays(scene: Phaser.Scene, level: readonly (readonly number[])[], tint?: number): void {
  const overlays = [
    buildTransitionLayer(scene, level, SHORE_TEXTURE_KEY, SHORE_IDS),
    buildTransitionLayer(scene, level, ROAD_TEXTURE_KEY, ROAD_IDS),
  ];
  // The cave/forest/snow grade their whole terrain with layer.setTint, and a
  // Phaser 4 TilemapLayer has no readable tint to copy — so the caller hands
  // over the same value it passed setTint and the transition art gets graded
  // with the ground instead of sitting on it at full brightness.
  if (tint === undefined) return;
  for (const overlay of overlays) {
    for (const child of overlay.list) (child as Phaser.GameObjects.Image).setTint(tint);
  }
}

/**
 * Register the four-direction hero walk cycles. Animations live on the global
 * anims manager, so the exists() guard keeps re-entering a scene cheap.
 */
export function createWalkAnimations(scene: Phaser.Scene): void {
  for (const dir of WALK_DIRECTIONS) {
    const key = `walk-${dir}`;
    if (scene.anims.exists(key)) continue;
    const frames: Phaser.Types.Animations.AnimationFrame[] = Array.from({ length: WALK_FRAME_COUNT }, (_, i) => ({
      key: `hero-${dir}-${i}`,
    }));
    scene.anims.create({ key, frames, frameRate: WALK_FRAME_RATE, repeat: -1 });
  }
}
