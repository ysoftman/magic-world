import Phaser from "phaser";
import { Sfx } from "./audio";
import { buildTransitionLayer, pickVariant, ROAD_TEXTURE_KEY, SHORE_TEXTURE_KEY, TRANSITION_DEPTH, tileHash } from "./autotile";
import { PIXEL } from "./config";
import { GameState } from "./gameState";
import { OBJECT_TILES, SOLID, T_GRASS, T_LAVA_A, T_LAVA_B, T_PATH, T_SCORCH, T_TALL, T_WATER_A, T_WATER_B, TILE } from "./levels";
import { FIELD_TOAST_Y, holdToastsWhile, makeTexture, pumpToasts, retroStyle, showToast } from "./pixelart";
import { TILE_VARIANTS } from "./scenes/BootScene";
import type { DialogueBox } from "./ui/DialogueBox";
import { helpOpen } from "./ui/HelpPopup";
import type { Minimap } from "./ui/Minimap";
import { STATUS_HUD_HEIGHT, type StatusHud } from "./ui/StatusHud";
import type { Weather } from "./weather";

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
 * object tile (TownScene's house art) belongs above this.
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

/**
 * Texture keys a map is drawn from. A scene can swap in a palette-swapped set
 * (SNOW_SKIN in art/tilesets.ts) baked from the same grids in the same order,
 * so every tile index, variation and transition mask keeps its meaning.
 */
export interface TileSkin {
  tiles: string;
  shore: string;
  road: string;
}

const DEFAULT_SKIN: TileSkin = { tiles: "tiles16", shore: SHORE_TEXTURE_KEY, road: ROAD_TEXTURE_KEY };

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
 * `skin` picks the textures all three are drawn from (see TileSkin).
 */
export function buildTileLayers(
  scene: Phaser.Scene,
  level: readonly (readonly number[])[],
  { ground = T_GRASS, tint, skin = DEFAULT_SKIN }: { ground?: number; tint?: number; skin?: TileSkin } = {},
): TileLayers {
  const groundGrid = terrainGrid(level, ground);
  const map = scene.make.tilemap({ data: groundGrid, tileWidth: TILE, tileHeight: TILE });
  const tileset = map.addTilesetImage(skin.tiles, skin.tiles, TILE, TILE)!;

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
  buildTerrainOverlays(scene, groundGrid, skin, ground, tint);
  return layers;
}

/**
 * Repaints one logical cell across both layers — the map editor's brush and
 * TownScene's landmark footprints are what call this. Keeps the pair
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
function buildTerrainOverlays(
  scene: Phaser.Scene,
  groundGrid: readonly (readonly number[])[],
  skin: TileSkin,
  ground: number,
  tint?: number,
): void {
  const overlays = [
    buildTransitionLayer(scene, groundGrid, skin.shore, SHORE_IDS),
    buildTransitionLayer(scene, groundGrid, skin.road, ROAD_IDS),
    // monster zones fray into the open ground round them, and the ground
    // crusts over a lava pool's edge (the volcano's ash)
    buildFrayedEdges(scene, groundGrid, skin.tiles, ZONE_MARKERS, new Set([ground]), FRINGE_BLADES, "blades"),
    buildFrayedEdges(scene, groundGrid, skin.tiles, new Set([ground]), LAVA_IDS, CRUST_LUMPS, "crust"),
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

// Monster-zone markings: the town's, forest's and snow's tall grass, the
// volcano's scorch. Each gets a frayed edge (buildFrayedEdges).
const ZONE_MARKERS: ReadonlySet<number> = new Set([T_TALL, T_SCORCH]);
const LAVA_IDS: ReadonlySet<number> = new Set([T_LAVA_A, T_LAVA_B]);
// Heights in art pixels, one per column along a tile edge, low at both ends
// so the two sides of a corner don't run into each other. Blades for grass,
// rounder lumps for the ash crusting over lava.
const FRINGE_BLADES = [
  [0, 2, 1, 3, 2, 0, 1, 3, 2, 1, 3, 1, 0, 2, 1, 0],
  [1, 0, 2, 3, 1, 2, 0, 2, 3, 1, 2, 3, 1, 0, 2, 0],
  [0, 1, 3, 1, 0, 2, 3, 2, 1, 0, 3, 2, 1, 3, 1, 0],
];
const CRUST_LUMPS = [
  [0, 1, 2, 2, 3, 3, 2, 1, 1, 2, 3, 3, 2, 2, 1, 0],
  [0, 2, 2, 1, 1, 2, 3, 3, 3, 2, 1, 1, 2, 2, 1, 0],
  [1, 1, 2, 3, 3, 2, 2, 1, 2, 2, 3, 2, 1, 1, 1, 0],
];

// A tile cut down to the shape `heights` rises from its bottom edge, taken
// from the skin's own baked tile so every season and region frays in its own
// colours. Baked once per skin, tile and shape; textures outlive a restart.
function fringeTexture(scene: Phaser.Scene, tilesKey: string, tile: number, heights: readonly number[], key: string): string {
  if (scene.textures.exists(key)) return key;
  const src = scene.textures.get(tilesKey).getSourceImage() as HTMLCanvasElement;
  const tex = scene.textures.createCanvas(key, TILE, TILE);
  if (!tex) return key;
  const ctx = tex.getContext();
  ctx.drawImage(src, tile * TILE, 0, TILE, TILE, 0, 0, TILE, TILE);
  heights.forEach((h, col) => {
    ctx.clearRect(col * PIXEL, 0, PIXEL, TILE - h * PIXEL);
  });
  tex.refresh();
  return key;
}

/**
 * A ragged edge between two terrains with no transition art: on every `into`
 * cell beside a `from` one, the `from` tile reaches in from the shared edge
 * (turned to face it) in one of `shapes`, so the boundary stops being a ruled
 * line — a monster zone's grass fraying into the meadow, ash crusting over a
 * lava pool. Over the road and shore overlays, under the object layer.
 */
function buildFrayedEdges(
  scene: Phaser.Scene,
  groundGrid: readonly (readonly number[])[],
  tilesKey: string,
  from: ReadonlySet<number>,
  into: ReadonlySet<number>,
  shapes: readonly (readonly number[])[],
  name: string,
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0).setDepth(TRANSITION_DEPTH);
  const sides = [
    [0, -1, 0],
    [1, 0, 90],
    [0, 1, 180],
    [-1, 0, 270],
  ] as const;
  const variants = shapes.map((_, i) => i);
  for (let y = 0; y < groundGrid.length; y++) {
    for (let x = 0; x < groundGrid[y].length; x++) {
      const tile = groundGrid[y][x];
      if (!from.has(tile)) continue;
      for (const [dx, dy, angle] of sides) {
        const nx = x + dx;
        const ny = y + dy;
        const next = groundGrid[ny]?.[nx];
        if (next === undefined || !into.has(next)) continue;
        const v = pickVariant(variants, x * 2 + dx, y * 2 + dy);
        const key = fringeTexture(scene, tilesKey, tile, shapes[v], `${tilesKey}-${name}-${tile}-${v}`);
        container.add(scene.add.image(nx * TILE + TILE / 2, ny * TILE + TILE / 2, key).setAngle(angle));
      }
    }
  }
  return container;
}

// Border dressing (addBorderDressing): a darker filler between neighbouring
// wall objects, a hair outward, behind them; and in front, now and then, a
// full one or a small one (a shrub, a stone) set in toward the field.
const BORDER_BACK_DEPTH = OBJECT_LAYER_DEPTH - 0.2;
const BORDER_FRONT_DEPTH = OBJECT_LAYER_DEPTH + 0.2;
const BORDER_BACK_SHADE = 0.72;
// how far the near-side clumps reach toward the walkable ground, in tiles
const BORDER_FRONT_REACH = 0.45;

const shade = (f: number): number => {
  const c = (shift: number): number => Math.round(0xff * f) << shift;
  return c(16) | c(8) | c(0);
};

// one tile of a baked tileset as an image frame, named the way autotile names
// its transition frames so the two never register the same tile twice
function tileFrame(scene: Phaser.Scene, textureKey: string, index: number): string {
  const key = `${textureKey}#${index}`;
  const texture = scene.textures.get(textureKey);
  if (!texture.has(key)) texture.add(key, 0, index * TILE, 0, TILE, TILE);
  return key;
}

/**
 * Dresses a field's outer wall — the ring of trees or rocks round its edge —
 * so it reads as a wood or a rock face instead of one object stamped every
 * tile: behind the ring, a darker, larger one between each pair; in front,
 * here and there a second rank or a shrub or stone, set in toward the field
 * on the north, west and east (never the south, where it would be drawn
 * under a hero standing behind it). Drawn from the skin's own wall tile, so
 * seasons follow; picked by coordinate hash, so a cell always dresses the
 * same. Nothing collides — the walkable ground is exactly what it was — and
 * nothing is put within two tiles of `clear` (the exit gap and its sign, the
 * cave mouth).
 */
export function addBorderDressing(
  scene: Phaser.Scene,
  level: readonly (readonly number[])[],
  skin: TileSkin = DEFAULT_SKIN,
  clear: ReadonlyArray<{ x: number; y: number }> = [],
): void {
  const h = level.length;
  const w = level[0]?.length ?? 0;
  const near = (x: number, y: number): boolean =>
    clear.some((p) => Math.abs(Math.floor(p.x / TILE) - x) <= 2 && Math.abs(Math.floor(p.y / TILE) - y) <= 2);
  const frameOf = (tile: number, hash: number): string =>
    tileFrame(scene, skin.tiles, renderIndexes(tile)[hash % renderIndexes(tile).length]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x > 0 && y > 0 && x < w - 1 && y < h - 1) continue;
      const tile = level[y][x];
      if (!OBJECT_TILES.has(tile) || near(x, y)) continue;
      const hash = tileHash(x, y);
      // along the edge, and in toward the field
      const [ax, ay] = y === 0 || y === h - 1 ? [1, 0] : [0, 1];
      const [ix, iy] = y === 0 ? [0, 1] : y === h - 1 ? [0, -1] : x === 0 ? [1, 0] : [-1, 0];
      const cx = x * TILE + TILE / 2;
      const cy = y * TILE + TILE / 2;
      const nx = x + ax;
      const ny = y + ay;
      if (hash % 3 !== 0 && OBJECT_TILES.has(level[ny]?.[nx] ?? -1) && !near(nx, ny)) {
        scene.add
          .image(cx + (ax * TILE) / 2 - ix * 12, cy + (ay * TILE) / 2 - iy * 12, skin.tiles, frameOf(tile, hash >>> 3))
          .setScale(1 + ((hash >>> 6) % 20) / 100)
          .setTint(shade(BORDER_BACK_SHADE))
          .setFlipX(((hash >>> 9) & 1) === 1)
          .setDepth(BORDER_BACK_DEPTH);
      }
      const front = (hash >>> 12) % 5;
      const corner = (x === 0 || x === w - 1) && (y === 0 || y === h - 1);
      if (iy === -1 || corner || front > 2) continue;
      const small = front > 0;
      const jitter = ((hash >>> 15) % 25) - 12;
      const reach = small ? BORDER_FRONT_REACH + 0.1 : BORDER_FRONT_REACH;
      scene.add
        .image(cx + ix * TILE * reach + ax * jitter, cy + iy * TILE * reach + ay * jitter, skin.tiles, frameOf(tile, hash >>> 18))
        .setScale(small ? 0.55 + ((hash >>> 20) % 20) / 100 : 0.9 + ((hash >>> 20) % 15) / 100)
        .setTint(shade(small ? 0.85 : 0.95))
        .setFlipX(((hash >>> 23) & 1) === 1)
        .setDepth(BORDER_FRONT_DEPTH);
    }
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

// How long an area's title (scrollFactor 0, just under the HUD) stays up after
// entry: it covers the map's rows 0-1 while the camera sits at the top.
const AREA_TITLE_HOLD_MS = 2600;
const AREA_TITLE_FADE_MS = 600;

/**
 * Fades a map tag in once the area title (fadeAreaTitle) has faded out. On
 * entry the camera is at the top of the map or by the stair the hero came
 * in on, where a tag there and the title would print over each other;
 * fading in as the title faded out, both showed half through.
 */
export function fadeInAfterAreaTitle(scene: Phaser.Scene, target: Phaser.GameObjects.Text): void {
  target.setAlpha(0);
  scene.tweens.add({ targets: target, alpha: 1, delay: AREA_TITLE_HOLD_MS + AREA_TITLE_FADE_MS, duration: AREA_TITLE_FADE_MS });
}

/**
 * Floating "TOWN" marker over a sub-map's exit zone, so the way back home is
 * visible from a distance. Sits under the player (depth 10) but over terrain.
 * Every exit is on row 1, so the label is set 8px lower than a tile above the
 * exit: at the top of its 8px bob it used to touch the map's top edge (y=0),
 * past the label-inside-the-map rule now that row 0 can scroll into view.
 * It comes in after the area title (fadeInAfterAreaTitle), while the hero is
 * standing right by the exit anyway; with `titled` false (back from a fight,
 * no title shown) it is just there.
 */
export function addTownExitLabel(scene: Phaser.Scene, x: number, y: number, titled = true): void {
  const label = scene.add
    .text(x, y - TILE + 8, "TOWN", retroStyle(5, "#ffd166"))
    .setOrigin(0.5, 1)
    .setStroke("#1a1028", 4)
    .setDepth(9);
  scene.tweens.add({ targets: label, y: label.y - 8, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  if (titled) fadeInAfterAreaTitle(scene, label);
}

/**
 * While `up()` holds — a panel, the help or a talk up — the map's name tags
 * go and the scene's toasts wait (pixelart.holdToastsWhile).
 *
 * Tags: panels are translucent, so a tag behind one showed through as ghost
 * letters among its lines ("HUNT 5 SLIMES" over SLIMES), and a talk's name
 * plate sat right on them; neither needs a tag. They are every world-space
 * text the scene holds when it first updates, and every world-space
 * container with text in it (the town's HOME bubble) — notes made later,
 * like a chest's "+GOLD", aren't — put back to full when `up()` ends.
 * Hidden again every frame: the TOWN sign's fade-in tween, still running
 * when a panel opened just after arriving, brought it back under the panel.
 * `shown` runs each frame they're up, after that, for a scene's own fades.
 *
 * Toasts: an unlock tip or achievement printed over a panel's title hid
 * both; news now comes out once the panel closes (pixelart's toastHolds).
 */
type MapTag = Phaser.GameObjects.Text | Phaser.GameObjects.Container;
const isMapTag = (o: Phaser.GameObjects.GameObject): o is MapTag =>
  (o instanceof Phaser.GameObjects.Text && o.scrollFactorX === 1) ||
  (o instanceof Phaser.GameObjects.Container && o.scrollFactorX === 1 && o.list.some((c) => c instanceof Phaser.GameObjects.Text));

export function whilePanelUp(scene: Phaser.Scene, up: () => boolean, shown?: () => void): void {
  holdToastsWhile(scene, up);
  let tags: MapTag[] | null = null;
  let off = false;
  const step = (): void => {
    tags ??= scene.children.list.filter(isMapTag);
    const hide = up();
    if (hide || off) {
      off = hide;
      for (const t of tags) t.setAlpha(hide ? 0 : 1);
    }
    if (!hide) shown?.();
    pumpToasts(scene);
  };
  // after the physics step has moved the hero, whatever else update() did
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, step);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, step));
}

/**
 * The way back to town from a field (forest, snow, volcano): the entry path
 * runs out through a gap in the top border, a signpost two tiles west of the
 * entry names it, and addExitArrow marks the gap once the hero is close. The
 * tag comes in after the area title, as above; with `titled` false (a field
 * built again round a hero who never left, a fight's or a season's, no title
 * shown) it is just there.
 */
export function addTownExitSign(scene: Phaser.Scene, hero: { x: number; y: number }, x: number, y: number, titled = true): void {
  const signX = x - 2 * TILE;
  scene.add.image(signX, y, "sign").setDepth(9);
  const tag = scene.add
    .text(signX, y - 48, "TOWN", retroStyle(5, "#ffd166"))
    .setOrigin(0.5)
    .setStroke("#1a1028", 4)
    .setDepth(11);
  if (titled) fadeInAfterAreaTitle(scene, tag);
  // the gap is the two path tiles left of the entry's centre, on row 0
  addExitArrow(scene, hero, x - TILE / 2, TILE / 2, -90);
}

const EXIT_ARROW_KEY = "exit-arrow";
const EXIT_ARROW_PALETTE = { o: 0x3b2a1a, f: 0xfff3c4 };
// pointing east; turned with setAngle a quarter at a time, so square
// biome-ignore format: one row per line so the art reads as a grid
const EXIT_ARROW = [
  "...........",
  "..oo.......",
  "..ofo......",
  "..offo.....",
  "...offo....",
  "....offo...",
  "...offo....",
  "..offo.....",
  "..ofo......",
  "..oo.......",
  "...........",
];
// full strength within a tile of the exit, gone by two and a half
const EXIT_ARROW_NEAR = TILE;
const EXIT_ARROW_FAR = 2.5 * TILE;
const EXIT_ARROW_ALPHA = 0.8;

/**
 * A chevron painted on a map exit's last tile, pointing off the map. It
 * shows only as the hero walks up to it and never pulses, so reduced motion
 * needs no case of its own. Ground level (under the hero and NPCs at 10), and
 * cream rather than the GUIDE ARROW's magenta — which is gone by then anyway,
 * since it hides once its goal is in view. Returned for the town's map
 * editor to carry along with the exit.
 */
export function addExitArrow(
  scene: Phaser.Scene,
  hero: { x: number; y: number },
  x: number,
  y: number,
  angle: number,
): Phaser.GameObjects.Image {
  if (!scene.textures.exists(EXIT_ARROW_KEY)) makeTexture(scene, EXIT_ARROW_KEY, EXIT_ARROW, EXIT_ARROW_PALETTE);
  const arrow = scene.add.image(x, y, EXIT_ARROW_KEY).setAngle(angle).setDepth(9).setAlpha(0);
  const onUpdate = (): void => {
    const d = Phaser.Math.Distance.Between(hero.x, hero.y, arrow.x, arrow.y);
    arrow.setAlpha(EXIT_ARROW_ALPHA * Phaser.Math.Clamp((EXIT_ARROW_FAR - d) / (EXIT_ARROW_FAR - EXIT_ARROW_NEAR), 0, 1));
  };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, onUpdate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, onUpdate));
  return arrow;
}

/**
 * Bounds the main camera to a w x h map plus, while the status HUD is up, a
 * STATUS_HUD_HEIGHT strip above it. The HUD covers the top 88px of the screen,
 * so with the map alone as bounds the first row could never scroll out from
 * under it -- the TOWN exit marker on row 1 lived behind the HUD. The strip is
 * empty, and it is behind the HUD whenever the camera can reach it. Tracks
 * the HUD toggle (S), so a hidden HUD doesn't leave a bare band at the top.
 * Physics bounds are the caller's and stay the map itself.
 */
export function boundCameraToMap(scene: Phaser.Scene, w: number, h: number): void {
  const cam = scene.cameras.main;
  let inset = -1;
  const apply = (): void => {
    const next = GameState.hudVisible ? STATUS_HUD_HEIGHT : 0;
    if (next === inset) return;
    inset = next;
    cam.setBounds(0, -inset, w, h + inset);
  };
  apply();
  scene.events.on(Phaser.Scenes.Events.UPDATE, apply);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, apply));
}

/**
 * Fades an area's title out a few seconds after entry. With the camera able
 * to rise above the map, the title would otherwise sit over rows 0-1 for good.
 * Timed to leave with Ambient's weather caption beneath it (0.3s in, 2.6s
 * held, 0.3s out), and before the TOWN marker comes in. Outlined like that
 * caption: it lies straight on the map's top rows, and the bare green of THE
 * FOREST sank into the forest's canopy at night.
 */
export function fadeAreaTitle(scene: Phaser.Scene, title: Phaser.GameObjects.Text): void {
  title.setStroke("#1a1028", 4);
  scene.tweens.add({ targets: title, alpha: 0, delay: AREA_TITLE_HOLD_MS, duration: AREA_TITLE_FADE_MS });
}

// Where a field's last fight began, and the sky over it: the battle comes back
// with { fromBattle } and the field puts the hero there again, rather than at
// its entrance, which every fight used to send them back to, long walks to a
// chest, a treasure map's X or the boss cut short each time. Held per scene
// (Phaser reuses the instance) and not in GameState.pos, which is the town's.
export interface FightSpot {
  x: number;
  y: number;
  weather: Weather;
}
const fightSpots = new WeakMap<Phaser.Scene, FightSpot>();

/** Notes where `scene`'s hero is as a fight starts (as its fade ends). */
export function noteFightSpot(scene: Phaser.Scene, spot: FightSpot): void {
  fightSpots.set(scene, spot);
}

/**
 * The spot noteFightSpot() kept, when this start is the battle's return
 * ({ fromBattle }); undefined for any other way in, and taken once. A fall
 * goes to the town instead and leaves it, so the next way in drops it. Also
 * empties the start's data: Phaser hands a start that passes none the last
 * one's, and the town's walk-ins pass none, so they would replay this
 * { fromBattle } and set the hero down at an old fight.
 */
export function takeFightSpot(scene: Phaser.Scene, data?: { fromBattle?: boolean }): FightSpot | undefined {
  const spot = data?.fromBattle ? fightSpots.get(scene) : undefined;
  fightSpots.delete(scene);
  scene.sys.settings.data = {};
  return spot;
}

/** The keys every map scene reads alike, besides walking (FieldKeys). */
export type FieldKey = "S" | "CTRL+S" | "M" | "T" | "I" | "B" | "A" | "U" | "O" | "Q";

/**
 * S (the HUD) and CTRL+S (save), M (mute), T (the minimap), the panels' I B
 * A U O — the journal is U because the town's map editor has R and X — and Q
 * (quit). A keydown only queues its key and update() takes it, each at its
 * own point in the frame, so a frame still handles them in the scene's own
 * order (the town reads T after its quit guard, the fields before it).
 *
 * Built in create(): every entry (back from a fight, quit and continue, a new
 * season) runs the same scene instance again, and a key queued while the last
 * run faded out would otherwise act on this run's first frame. The scene's
 * keys go at its shutdown, these listeners with them.
 *
 * A repeat keydown is dropped, but on S and M, which never checked. Phaser
 * sends a Key's DOWN for the first keydown of a press only, so a repeat here
 * is a key held through the scene switch, and would act on the new scene's
 * first frame. The town's I took one too, from before the check (no reason
 * kept): an I held through a field's exit or a fight's end opened the bag on
 * arrival in town, and nowhere else. Built before the scene's TouchControls,
 * so touch gets a button for each of these its MENU has. `toastY` is the
 * scene's toast line (the town's sits under the HUD, the fields' lower).
 */
export class FieldKeys {
  private readonly queued = new Set<FieldKey>();
  private readonly scene: Phaser.Scene;
  private readonly toastY: number;

  constructor(scene: Phaser.Scene, { toastY = FIELD_TOAST_Y }: { toastY?: number } = {}) {
    this.scene = scene;
    this.toastY = toastY;
    const kb = scene.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    const on = (code: number, key: (e: KeyboardEvent) => FieldKey | null): void => {
      kb.addKey(code).on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
        const pressed = key(e);
        if (pressed) this.queued.add(pressed);
      });
    };
    const once = (code: number, key: FieldKey): void => on(code, (e) => (e.repeat ? null : key));
    on(K.S, (e) => (e.ctrlKey ? "CTRL+S" : "S"));
    on(K.M, () => "M");
    once(K.T, "T");
    once(K.I, "I");
    once(K.B, "B");
    once(K.A, "A");
    once(K.U, "U");
    once(K.O, "O");
    once(K.Q, "Q");
  }

  /** Whether `key` was pressed since it was last taken; taking it clears it. */
  take(key: FieldKey): boolean {
    return this.queued.delete(key);
  }

  /**
   * Whether the scene has begun to leave: every way off a map (a fight, an
   * exit or a stair, a new season) fades its camera out and changes scene
   * as the fade ends, and the town's rest fades out the same way before it
   * fades back in. Q (takeQuitKey), the panel keys (FieldPanels) and the
   * scenes' own (the help, a treasure map's or the ice hole's Z) are dropped
   * meanwhile, as under a panel: a bag or a question opened in a fight's
   * 300ms fade was still up as the battle took over, and a dig in it saved.
   * The quit's wait for the title has no fade; the scenes hold it with their
   * `quitting`.
   */
  leaving(): boolean {
    const fade = this.scene.cameras.main.fadeEffect;
    return fade.direction && (fade.isRunning || fade.isComplete);
  }

  /**
   * S, CTRL+S and M, which answer under a panel too, so a scene takes them
   * ahead of its quit and panel gates: the HUD on or off (kept with the
   * settings; boundCameraToMap follows it), a save, and the sound, said on
   * the toast line.
   */
  takeSystemKeys(hud: StatusHud): void {
    if (this.take("S")) {
      const visible = !hud.isVisible();
      hud.setVisible(visible);
      GameState.hudVisible = visible;
      GameState.saveSettings();
    }
    if (this.take("CTRL+S")) GameState.save();
    if (this.take("M")) {
      const muted = Sfx.toggleMuted();
      showToast(this.scene, muted ? "SOUND: OFF" : "SOUND: ON", this.toastY);
    }
  }

  /** T: the minimap, unless `blocked()` — a panel, a talk or the help is up. */
  takeMapKey(minimap: Minimap, blocked: () => boolean): void {
    if (this.take("T") && !blocked()) minimap.toggle();
  }

  /**
   * Q: the quit question (askQuitToTitle), never while `blocked()` — over an
   * open panel the question's ESC would close that panel too — nor once the
   * scene is leaving().
   */
  takeQuitKey(dialogue: DialogueBox, blocked: () => boolean, quit: () => void): void {
    if (this.take("Q") && !blocked() && !this.leaving()) askQuitToTitle(dialogue, quit);
  }
}

/** The keys that open a panel, in the order a frame reads them. */
type PanelKey = Extract<FieldKey, "I" | "B" | "A" | "U" | "O">;
const PANEL_KEYS: readonly PanelKey[] = ["I", "B", "A", "U", "O"];

/** What FieldPanels asks of a panel: whether it is up, its frame, its teardown. */
export interface FieldPanel {
  isActive(): boolean;
  update(): void;
  destroy(): void;
}

/** A panel one of I B A U O opens and closes. */
export interface KeyedPanel extends FieldPanel {
  open(): void;
  close(): void;
}

/**
 * Every panel a map scene puts over its map: the bag (I), the bestiary (B),
 * the trophies (A), the journal (U) and the settings (O), which their keys
 * open and close, and the scene's own, which it opens itself (its dialogue
 * box, the ice hole, the town's shop and the rest). Any of them up, or the
 * help, is the scene's uiBlocking() (blocking()): the scene stands its hero
 * still and runs them (update()) instead.
 *
 * Each is add()ed as the scene builds it, so they are built in the scene's
 * own order as before — a panel registers its key listeners and draws as it
 * is made, which settles which of two listeners on a shared key (ESC, Z, the
 * arrows) hears a press first — and run in that order: the town's dialogue
 * box first, so a talk's answer that opens the shop has the shop running that
 * same frame. Built in create() on the scene's FieldKeys, which queue the
 * keys; the scene's SHUTDOWN handler calls destroy().
 */
export class FieldPanels {
  private readonly panels: FieldPanel[] = [];
  private readonly keyed = new Map<PanelKey, KeyedPanel>();
  private readonly scene: Phaser.Scene;
  private readonly keys: FieldKeys;

  constructor(scene: Phaser.Scene, keys: FieldKeys) {
    this.scene = scene;
    this.keys = keys;
  }

  /** `panel`, with the key that opens it if it has one; returned for the scene to keep. */
  add<P extends KeyedPanel>(panel: P, key: PanelKey): P;
  add<P extends FieldPanel>(panel: P): P;
  add(panel: FieldPanel, key?: PanelKey): FieldPanel {
    this.panels.push(panel);
    if (key) this.keyed.set(key, panel as KeyedPanel);
    return panel;
  }

  /** A panel or the help up: the scene's uiBlocking(). */
  blocking(): boolean {
    return this.panels.some((p) => p.isActive()) || helpOpen(this.scene);
  }

  /**
   * A frame under a panel: a panel key closes its own panel when that is the
   * one up and is dropped otherwise (it would open a second one over it),
   * then every panel runs.
   */
  update(): void {
    for (const key of PANEL_KEYS) {
      const panel = this.keyed.get(key);
      if (this.keys.take(key) && panel?.isActive()) panel.close();
    }
    for (const panel of this.panels) panel.update();
  }

  /**
   * With none up: the first panel key pressed opens its panel and the
   * scene's update() ends there for the frame (true); the rest wait and are
   * dropped under it. All are taken and dropped once the scene is leaving
   * (FieldKeys.leaving).
   */
  takeOpenKey(): boolean {
    const leaving = this.keys.leaving();
    for (const key of PANEL_KEYS) {
      if (!this.keys.take(key) || leaving) continue;
      this.keyed.get(key)?.open();
      return true;
    }
    return false;
  }

  destroy(): void {
    for (const panel of this.panels) panel.destroy();
  }
}

// long enough for the SAVED toast to be readable before the title
export const QUIT_SAVE_DELAY = 700;

/**
 * Q on a field: its dialogue box asks, so a touch can tap YES or NO, and Y,
 * N and ESC (the last choice) still answer as the old centre prompt took
 * them. YES runs `quit`, the scene's own (saveAndQuit below); NO just closes
 * the box. The box counts as the scene's uiBlocking(), so the hero and the
 * panel keys stand still under it as under any talk, and the map's tags go.
 */
export function askQuitToTitle(dialogue: DialogueBox, quit: () => void): void {
  Sfx.error();
  dialogue.ask(["QUIT TO TITLE?"], "", ["YES", "NO"], (i) => {
    if (i === 0) quit();
  });
}

/**
 * Save, let the SAVED toast show, then back to the title: YES above, or the
 * settings' QUIT chip on touch, which has no Q. Saved here rather than by the
 * scene's SHUTDOWN handler: that one runs after the toast subscription is
 * torn down, so the player never saw the confirmation. The SHUTDOWN save
 * then just repeats this one. The scene sets its `quitting` first, which
 * keeps its update() from moving the hero or opening a panel meanwhile.
 */
export function saveAndQuit(scene: Phaser.Scene): void {
  GameState.save();
  scene.time.delayedCall(QUIT_SAVE_DELAY, () => scene.scene.start("Title"));
}
