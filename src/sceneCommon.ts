import type Phaser from "phaser";
import { buildTransitionLayer, pickVariant, ROAD_TEXTURE_KEY, SHORE_TEXTURE_KEY, TRANSITION_DEPTH } from "./autotile";
import { OBJECT_TILES, SOLID, T_GRASS, T_PATH, T_WATER_A, T_WATER_B, TILE } from "./levels";
import { TILE_VARIANTS } from "./scenes/BootScene";

type LastMove = "down" | "up" | "right" | "left";

const WALK_DIRECTIONS: readonly LastMove[] = ["down", "up", "right", "left"];
const WALK_FRAME_COUNT = 4;
const WALK_FRAME_RATE = 10;

// Every variant set starts with the base index the map data actually stores
// (TILE_VARIANTS.grass[0] === T_GRASS and so on), so the first entry doubles as
// the set's key and as the "plain" look.
const VARIANT_SETS: readonly (readonly number[])[] = [
  TILE_VARIANTS.grass,
  TILE_VARIANTS.waterA,
  TILE_VARIANTS.waterB,
  TILE_VARIANTS.path,
  TILE_VARIANTS.tree,
];
const VARIANTS_BY_BASE = new Map<number, readonly number[]>(VARIANT_SETS.map((set) => [set[0], set]));

/** Every index a base tile can end up rendering as, its variation frames included. */
function renderIndexes(base: number): readonly number[] {
  return VARIANTS_BY_BASE.get(base) ?? [base];
}

// Collision is split across the two layers below, so these two lists have to
// be exact: an index on both separates twice, an index on neither is walked
// straight through. Terrain keeps the solid *ground* (water); the object layer
// keeps the solid *objects* (tree, house). Variation frames are expanded into
// both, because putTileAt re-derives a tile's collision from its own layer's
// collide index list — paint a variant that was never registered and it turns
// walkable with nothing to warn you.
const SOLID_TERRAIN_INDEXES: number[] = [...SOLID].filter((tile) => !OBJECT_TILES.has(tile)).flatMap(renderIndexes);
const SOLID_OBJECT_INDEXES: number[] = [...OBJECT_TILES].filter((tile) => SOLID.has(tile)).flatMap(renderIndexes);

const TERRAIN_LAYER_DEPTH = 0;
/**
 * The object layer sits above the transition overlay (TRANSITION_DEPTH = 1),
 * which is the whole point of splitting the tilemap: the overlay may run its
 * rounded coastline/road edge straight through a tree's cell and the tree is
 * still drawn on top of it, intact. Anything in a scene that has to cover an
 * object tile (WorldScene's house art) belongs above this.
 */
export const OBJECT_LAYER_DEPTH = TRANSITION_DEPTH + 1;

/** The two tilemap layers a roaming scene renders its map with, plus what fills in under an object. */
export interface TileLayers {
  /** Ground only — grass/water/path/tall grass/soil. Owns the collision for solid ground (water). */
  terrain: Phaser.Tilemaps.TilemapLayer;
  /** Trees and houses on a transparent background, empty (-1) everywhere else. Owns their collision. */
  objects: Phaser.Tilemaps.TilemapLayer;
  /** Ground index painted underneath an object tile — grass outdoors, cave floor in the dungeon. */
  ground: number;
}

/** Tile index pairs the water tick swaps. Add a pair per water variation. */
export type TileSwapPair = readonly [number, number];

// waterA[i] and waterB[i] are the same ripple layout one row apart, so pairing
// them by position is what keeps the animation in phase.
export const WATER_TILE_PAIRS: readonly TileSwapPair[] = TILE_VARIANTS.waterA.map((a, i): TileSwapPair => [a, TILE_VARIANTS.waterB[i]]);

/**
 * Walkability read straight off `level`, the logical grid — the only place
 * that still knows a cell holds a tree or a house. Since those render on the
 * object layer, a terrain-layer lookup finds the *ground* under them and
 * happily calls it walkable, so nothing here may go through a tilemap layer.
 * Out of bounds is not walkable.
 */
export function isWalkableCell(level: readonly (readonly number[])[], tx: number, ty: number): boolean {
  const tile = level[ty]?.[tx];
  return tile !== undefined && !SOLID.has(tile);
}

/**
 * The grid the terrain layer actually renders: every object tile swapped for
 * the ground that shows under it, now that trees and houses draw on their own
 * layer with a transparent background.
 *
 * Everything that reasons about ground has to agree on this one grid — the
 * terrain layer, its variations and the transition overlays alike. Hand the
 * overlays `level` instead and they draw a coastline against a tile the ground
 * layer never painted (the dungeon, whose walls are trees over cave floor, is
 * where that shows up first).
 */
function terrainGrid(level: readonly (readonly number[])[], ground: number): number[][] {
  return level.map((row) => row.map((tile) => (OBJECT_TILES.has(tile) ? ground : tile)));
}

/**
 * Builds a scene's map as two tilemap layers off one Tilemap:
 *
 *   depth 0  terrain   ground tiles, water collision
 *   depth 1  overlay   transition art (buildTerrainOverlays, no physics)
 *   depth 2  objects   trees and houses, their collision
 *
 * The caller has to add a collider against *both* layers. `tint` is the value
 * the scene would have passed layer.setTint: a Phaser 4 TilemapLayer has no
 * readable tint to copy off, so it is threaded through here instead and every
 * piece of the map — ground, objects and transition art — gets graded together.
 */
export function buildTileLayers(
  scene: Phaser.Scene,
  level: readonly (readonly number[])[],
  { ground = T_GRASS, tint }: { ground?: number; tint?: number } = {},
): TileLayers {
  const groundGrid = terrainGrid(level, ground);
  const map = scene.make.tilemap({ data: groundGrid, tileWidth: TILE, tileHeight: TILE });
  const tileset = map.addTilesetImage("tiles16", "tiles16", TILE, TILE)!;

  const terrain = map.createLayer(0, tileset, 0, 0)! as Phaser.Tilemaps.TilemapLayer;
  terrain.setDepth(TERRAIN_LAYER_DEPTH);
  // Registered before the first putTileAt below, never after: putTileAt reads
  // this list to decide whether the tile it just painted collides.
  terrain.setCollision(SOLID_TERRAIN_INDEXES);
  applyTileVariations(terrain, groundGrid);

  const objects = map.createBlankLayer("objects", tileset, 0, 0)! as Phaser.Tilemaps.TilemapLayer;
  objects.setDepth(OBJECT_LAYER_DEPTH);
  objects.setCollision(SOLID_OBJECT_INDEXES);
  const layers: TileLayers = { terrain, objects, ground };
  for (let y = 0; y < level.length; y++) {
    const row = level[y];
    for (let x = 0; x < row.length; x++) if (OBJECT_TILES.has(row[x])) putObject(layers, x, y, row[x]);
  }

  // After the painting, not before: setTint stamps the colour onto each tile
  // it finds, so a cell still empty at that point would never be graded.
  if (tint !== undefined) {
    terrain.setTint(tint);
    objects.setTint(tint);
  }
  buildTerrainOverlays(scene, groundGrid, tint);
  return layers;
}

/**
 * Repaints one logical cell across both layers — the map editor's brush and
 * WorldScene's landmark footprints are what call this. Keeps the pair
 * consistent: an object tile draws on the object layer with its ground filled
 * in underneath, anything else draws on the terrain layer and clears whatever
 * object stood above it. Collision comes back off each layer's collide index
 * list, which buildTileLayers registered the variation frames into as well.
 *
 * `level` itself is the caller's to update — this only touches the render.
 */
export function paintTile(layers: TileLayers, tx: number, ty: number, index: number): void {
  const isObject = OBJECT_TILES.has(index);
  layers.terrain.putTileAt(pickVariant(renderIndexes(isObject ? layers.ground : index), tx, ty), tx, ty);
  // -1 rather than removeTileAt: it keeps the same Tile object (and so the
  // scene's tint) instead of dropping in a fresh untinted one.
  if (isObject) putObject(layers, tx, ty, index);
  else layers.objects.putTileAt(-1, tx, ty);
}

function putObject(layers: TileLayers, tx: number, ty: number, index: number): void {
  layers.objects.putTileAt(pickVariant(renderIndexes(index), tx, ty), tx, ty);
}

/**
 * Repaints a render layer with one deterministic variation per cell, so the
 * same speckle stops landing on every tile of the same terrain. `level` (the
 * logical grid the map file, the minimap and the F2 editor all read) is left
 * alone — only the layer's rendered indexes change, and `pickVariant` hashes
 * the coordinates, so a scene restart repaints the identical pattern.
 */
function applyTileVariations(layer: Phaser.Tilemaps.TilemapLayer, grid: readonly (readonly number[])[]): void {
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
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

// The two terrain pairs that own transition art. Both read the *ground* grid,
// which only ever holds base indexes, so variation frames can't confuse them.
const SHORE_IDS: ReadonlySet<number> = new Set([T_WATER_A, T_WATER_B]);
const ROAD_IDS: ReadonlySet<number> = new Set([T_PATH]);

/**
 * Draws the coastline and road-edge overlays over an already-built terrain
 * layer. Purely decorative: two Containers of Images at TRANSITION_DEPTH
 * (above the terrain layer, below the object layer and every shadow and
 * actor) with no physics of their own, so walkability still comes from the
 * tilemap layers alone. The scene owns them — a restart tears the old ones
 * down with the rest of the display list.
 */
function buildTerrainOverlays(scene: Phaser.Scene, groundGrid: readonly (readonly number[])[], tint?: number): void {
  const overlays = [
    buildTransitionLayer(scene, groundGrid, SHORE_TEXTURE_KEY, SHORE_IDS),
    buildTransitionLayer(scene, groundGrid, ROAD_TEXTURE_KEY, ROAD_IDS),
  ];
  // The cave/forest/snow grade their whole terrain with a tint, and a Phaser 4
  // TilemapLayer has no readable tint to copy — so the caller hands over the
  // same value it gave setTint and the transition art gets graded with the
  // ground instead of sitting on it at full brightness.
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
