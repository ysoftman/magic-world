import type Phaser from "phaser";
import { makeTilesetTexture } from "../pixelart";
import type { TileSkin } from "../sceneCommon";
import { type Season, seasonLook, seasonToday } from "../season";
import {
  ASH_PALETTE,
  ASH_TILE,
  GRASS_PALETTE,
  GRASS_TILE,
  GRASS_TILE_2,
  GRASS_TILE_3,
  GRASS_TILE_4,
  HOUSE_TILE,
  HOUSE_TILE_PALETTE,
  LAVA_A,
  LAVA_B,
  LAVA_PALETTE,
  PATH_PALETTE,
  PATH_TILE,
  PATH_TILE_2,
  PATH_TILE_3,
  PATH_TILE_4,
  ROAD_PALETTE,
  ROAD_TILE_1,
  ROAD_TILE_2,
  ROAD_TILE_3,
  ROAD_TILE_4,
  ROAD_TILE_5,
  ROAD_TILE_6,
  ROAD_TILE_7,
  ROAD_TILE_8,
  ROAD_TILE_9,
  ROAD_TILE_10,
  ROAD_TILE_11,
  ROAD_TILE_12,
  ROAD_TILE_13,
  ROAD_TILE_14,
  ROCK_PALETTE,
  ROCK_TILE,
  SCORCH_PALETTE,
  SCORCH_TILE,
  SHORE_PALETTE,
  SHORE_TILE_1,
  SHORE_TILE_2,
  SHORE_TILE_3,
  SHORE_TILE_4,
  SHORE_TILE_5,
  SHORE_TILE_6,
  SHORE_TILE_7,
  SHORE_TILE_8,
  SHORE_TILE_9,
  SHORE_TILE_10,
  SHORE_TILE_11,
  SHORE_TILE_12,
  SHORE_TILE_13,
  SHORE_TILE_14,
  SOIL_PALETTE,
  SOIL_TILE,
  TALL_PALETTE,
  TALL_TILE,
  TREE_PALETTE,
  TREE_TILE,
  TREE_TILE_2,
  TREE_TILE_3,
  TREE_TILE_4,
  WATER_A,
  WATER_A_2,
  WATER_A_3,
  WATER_A_4,
  WATER_B,
  WATER_B_2,
  WATER_B_3,
  WATER_B_4,
  WATER_PALETTE,
} from "./tiles";

// The tilesets the maps are drawn from -- tiles16, one index per map cell,
// and the shore16 and road16 transition overlays -- and their skins: the
// same strips, grid for grid, in another region's or season's palettes.
// BootScene re-exports what the scenes import from here.

// Snow Field skin. The snow field draws its map from palette-swapped copies of
// tiles16, shore16 and road16 baked from the same grids in the same order, so
// every tile index, variation and transition mask means the same thing and
// nothing in levels.ts or autotile.ts changes. Only the palettes the field
// shows are swapped; house, soil and the volcano tiles keep theirs, there only
// to hold their indices.
//
// The snow is a cool grey-blue, not white, on purpose: the frost moth's and the
// yeti's rim pixels are near-white (luma ~240-250) and vanished against a white
// floor. At luma ~188 the moth's rim still clears it by ~50. The terrain keeps
// the green field's calm limits (check:art).
const SNOW_GRASS_PALETTE = { g: 0xaebfce, h: 0xb5c5d3 };
// trampled snow over frozen dirt, a clear step darker than the field
const SNOW_PATH_PALETTE = { p: 0x8c8f96, h: 0x92959c, D: 0x5c5f66, P: 0x7d8087, m: 0x9a9da4, S: 0xa6a9b0 };
// monster zones: snowed-over scrub, a dry sage showing through with its twigs
// as darker marks. It was the field's own blue-grey (0xa2b4c4), and once the
// winter town and forest took this skin the wasp's pale blue wings (0x8ea2c6)
// sank into it, 38% of its outline within RGB distance 40 of the scrub; the
// sage keeps that brightness (so the frost moth's rim still clears it) and
// sits apart from the wings, the snow and the trodden paths alike.
const SNOW_TALL_PALETTE = { g: 0xaeb6a6, h: 0x9ca494 };
// cold dark water under icy foam
const SNOW_WATER_PALETTE = { d: 0x123a57, B: 0x1b4d72, W: 0x2a6690, l: 0x5d9ac0, h: 0xc4e6f5 };
// The canopy's lit top-left (H, c) carries the snow and the shaded side stays a
// dark spruce green, so the same sphere reads as a laden conifer.
const SNOW_TREE_PALETTE = { b: 0x0b231d, S: 0x123329, D: 0x1d4a3e, c: 0xa9bfcf, H: 0xe6eef5, t: 0x4a3a2c, T: 0x2f241a };
// grass tones (g/q) equal SNOW_GRASS_PALETTE's g/h, as SHORE/ROAD do for grass
const SNOW_SHORE_PALETTE = { W: 0x2a6690, B: 0x1b4d72, h: 0xc4e6f5, l: 0x5d9ac0, g: 0xaebfce, q: 0xb5c5d3 };
const SNOW_ROAD_PALETTE = { p: 0x8c8f96, P: 0x7d8087, S: 0x999ca3, m: 0x9a9da4, g: 0xaebfce, q: 0xb5c5d3 };

// The texture keys buildTileLayers() reads for the snow field.
export const SNOW_SKIN = { tiles: "tiles16-snow", shore: "shore16-snow", road: "road16-snow" } as const;

// Forest skin, built the same way as the snow field's. A deep wood: a duller,
// darker moss than the town's grass (luma ~67 against ~79), a leaf-litter dirt
// path, darker scrub in the monster zones, dark heavy canopies and murky swamp
// water. It stops at ~67 because the spider's lower half is a dark purple
// (luma 35-56) and has to stay off the floor; the orc's rim (luma 107) and
// bright body clear it easily, so a green floor doesn't swallow it.
const FOREST_GRASS_PALETTE = { g: 0x2f4b30, h: 0x34522f };
// packed dirt under leaf litter, the litter a warm step lighter
const FOREST_PATH_PALETTE = { p: 0x6a5236, h: 0x765633, D: 0x3b2e1f, P: 0x56432c, m: 0x7a5f40, S: 0x8a6e4c };
// monster zones: darker undergrowth, blades a little lighter than its floor
const FOREST_TALL_PALETTE = { g: 0x263f2a, h: 0x2d4a31 };
// swamp water: a dark teal, apart from the moss in hue and a step darker,
// with pale green scum on its crests
const FOREST_WATER_PALETTE = { d: 0x081c1f, B: 0x0f2c2f, W: 0x163a3c, l: 0x2f5f5a, h: 0x8db8a0 };
const FOREST_TREE_PALETTE = { b: 0x061a10, S: 0x0b2a1b, D: 0x123d27, c: 0x1d5534, H: 0x3a7a45, t: 0x3d2c1b, T: 0x261a0f };
// grass tones (g/q) equal FOREST_GRASS_PALETTE's g/h, as for the other skins
const FOREST_SHORE_PALETTE = { W: 0x163a3c, B: 0x0f2c2f, h: 0x8db8a0, l: 0x2f5f5a, g: 0x2f4b30, q: 0x34522f };
const FOREST_ROAD_PALETTE = { p: 0x6a5236, P: 0x56432c, S: 0x7a5f40, m: 0x7b603f, g: 0x2f4b30, q: 0x34522f };

// The texture keys buildTileLayers() reads for the forest.
export const FOREST_SKIN = { tiles: "tiles16-forest", shore: "shore16-forest", road: "road16-forest" } as const;

// Cave skin, built the same way. The cave floor is path tiles (buildDungeon
// fills with T_PATH) and its walls and pillars are T_ROCK (26), so those two
// carry the look: a warm grey stone floor (luma ~54) and cool grey boulders,
// the volcano rock's lava crack (e) closed to a dark seam. The floor leans warm
// on purpose. The cursed goblin's purple tint lands it at luma 33-82, right
// across any dark floor, so it can only part from the floor by hue -- and a
// warm floor stays the opposite hue to purple even under the night's blue
// wash, where a neutral one turned the same navy. The slime's dark rim (~68)
// still clears it.
const CAVE_PATH_PALETTE = { p: 0x3a3632, h: 0x3f3a35, D: 0x26231f, P: 0x312e2a, m: 0x46413b, S: 0x504a43 };
const CAVE_ROCK_PALETTE = { b: 0x141518, S: 0x2a2c31, D: 0x3c3f45, c: 0x55585f, H: 0x737780, e: 0x1b1c20 };
// dark underground pools with a faint glint on the crests
const CAVE_WATER_PALETTE = { d: 0x050c16, B: 0x0a1626, W: 0x102136, l: 0x24405f, h: 0x6a8fb0 };
// The cave has no grass, so grass is painted as the cave floor itself:
// DungeonScene draws its T_PATH floor as T_GRASS, the base terrain the shore
// transitions round water off against, so the pools get the same curved,
// foamed edges as the ponds outside instead of hard rectangles.
const CAVE_GRASS_PALETTE = { g: 0x3a3632, h: 0x3f3a35 };
// unused in today's cave (no zone is marked there), kept in the cave's tones
const CAVE_TALL_PALETTE = { g: 0x312d2a, h: 0x37332f };
const CAVE_SHORE_PALETTE = { W: 0x102136, B: 0x0a1626, h: 0x6a8fb0, l: 0x24405f, g: 0x3a3632, q: 0x3f3a35 };
const CAVE_ROAD_PALETTE = { p: 0x3a3632, P: 0x312e2a, S: 0x433e38, m: 0x45403a, g: 0x3a3632, q: 0x3f3a35 };

// The texture keys buildTileLayers() reads for the cave.
export const CAVE_SKIN = { tiles: "tiles16-cave", shore: "shore16-cave", road: "road16-cave" } as const;

// Autumn skins (season.ts), built the same way again. Only the grass, the
// monster zones' scrub and the trees turn: the paths, the water, the houses
// and the soil keep their own palettes. The canopies go rust and gold, lit
// from the same top left, and carry most of the season. The grass only
// yellows to an olive at the green's brightness and spread (luma ~87 against
// ~77, h a ~5 step over g, the scrub a step under the grass, as in green):
// a true straw or leaf-litter brown sits right on the hero's hair and boots
// (0x6b4226, 0x4a2f1a; a first 0x56582a put a third of the hero's pixels
// within RGB distance 40 of the floor), and this olive keeps every hero
// colour at least as far off it as the green does (~44).
const AUTUMN_GRASS_PALETTE = { g: 0x4a6028, h: 0x4e662b };
const AUTUMN_TALL_PALETTE = { g: 0x42542a, h: 0x46592c };
const AUTUMN_TREE_PALETTE = { b: 0x3a1408, S: 0x6e2a10, D: 0x9a4418, c: 0xc8662a, H: 0xe8a040, t: 0x4a3620, T: 0x2f2113 };
// grass tones (g/q) equal AUTUMN_GRASS_PALETTE's g/h, as for the other skins
const AUTUMN_SHORE_PALETTE = { W: 0x0133a9, B: 0x01207f, h: 0x7fc6f0, l: 0x2f6ecb, g: 0x4a6028, q: 0x4e662b };
const AUTUMN_ROAD_PALETTE = { p: 0x735f43, P: 0x5e4c33, S: 0x887356, m: 0x897353, g: 0x4a6028, q: 0x4e662b };
export const AUTUMN_SKIN = { tiles: "tiles16-autumn", shore: "shore16-autumn", road: "road16-autumn" } as const;

// The forest in autumn: its moss a warmer, yellower olive at the same depth
// (luma ~74 against ~67, still above the spider's dark purple, and as far
// off the hero as the forest's green), the undergrowth a step under it, and
// deep rust canopies.
const FOREST_AUTUMN_GRASS_PALETTE = { g: 0x3a5226, h: 0x3e5729 };
const FOREST_AUTUMN_TALL_PALETTE = { g: 0x324624, h: 0x364b27 };
const FOREST_AUTUMN_TREE_PALETTE = { b: 0x200a06, S: 0x4a1a0c, D: 0x742c12, c: 0xa04a1c, H: 0xcf7a30, t: 0x3d2c1b, T: 0x261a0f };
const FOREST_AUTUMN_SHORE_PALETTE = { W: 0x163a3c, B: 0x0f2c2f, h: 0x8db8a0, l: 0x2f5f5a, g: 0x3a5226, q: 0x3e5729 };
const FOREST_AUTUMN_ROAD_PALETTE = { p: 0x6a5236, P: 0x56432c, S: 0x7a5f40, m: 0x7b603f, g: 0x3a5226, q: 0x3e5729 };
export const FOREST_AUTUMN_SKIN = { tiles: "tiles16-forestautumn", shore: "shore16-forestautumn", road: "road16-forestautumn" } as const;

/**
 * The skin the town's or the forest's map wears in `season`: their own look
 * in spring and summer (undefined is buildTileLayers' default, the town's),
 * the autumn skins above, and in winter the snow field's skin -- whose house
 * and soil tiles keep their palettes, so the town's homes and fields show
 * through the snow. Read when a scene builds its map, so a season that turns
 * while the player is out shows on the next visit. Minimap's SEASON_COLORS
 * follows the same table.
 */
export function seasonSkin(region: "town" | "forest", season: Season = seasonToday()): TileSkin | undefined {
  const look = seasonLook(region, season);
  if (look === "autumn") return region === "town" ? AUTUMN_SKIN : FOREST_AUTUMN_SKIN;
  if (look === "winter") return SNOW_SKIN;
  return region === "town" ? undefined : FOREST_SKIN;
}

/**
 * The battle backdrop for a fight that started in `origin` (a scene key, the
 * ARENA's being the Town): the town's and the forest's in the season's look
 * (seasonLook), as their maps are, "battle-bg-town-winter" and so on. Baked
 * by src/backdrops.ts.
 */
export function battleBgKey(origin: string, season: Season = seasonToday()): string {
  const region = origin.toLowerCase();
  const look = seasonLook(region, season);
  return `battle-bg-${region}${look ? `-${look}` : ""}`;
}

// Interchangeable tile indices for one terrain, so callers never hardcode the
// numbers. Every set's first entry is the index the map data stores, so it works
// as both the set's key and its plain look.
//
// Same-position entries of waterA/waterB are the two animation frames of one
// ripple layout: index i of waterA must be swapped with index i of waterB.
//
// `tree` is a solid base, unlike grass and path. Whatever consumes these has to
// register the variation indices as colliding too, or trees painted with a
// variation become walkable.
export const TILE_VARIANTS = {
  grass: [0, 8, 9, 10],
  waterA: [1, 11, 12, 13],
  waterB: [2, 14, 15, 16],
  path: [4, 17, 18, 19],
  tree: [3, 20, 21, 22],
} as const;

// The volcano tiles (23..27) have no variation frames, so no set lists them.

// Every tileset, once per page load: a second bake of a key draws over the
// first (pixelart.ts makeTilesetTexture). Called with the scene as `this`,
// as drawHero is: the form check:art reads.
export function bakeTilesets(this: Phaser.Scene): void {
  makeTilesetTexture(
    this,
    "tiles16",
    [
      // 0..7 are the T_* constants in levels.ts and are baked into saved map
      // data: never reorder or insert here, only append.
      { rows: GRASS_TILE, palette: GRASS_PALETTE },
      { rows: WATER_A, palette: WATER_PALETTE },
      { rows: WATER_B, palette: WATER_PALETTE },
      { rows: TREE_TILE, palette: TREE_PALETTE },
      { rows: PATH_TILE, palette: PATH_PALETTE },
      { rows: TALL_TILE, palette: TALL_PALETTE },
      { rows: HOUSE_TILE, palette: HOUSE_TILE_PALETTE },
      { rows: SOIL_TILE, palette: SOIL_PALETTE },
      // 8..19 are the variations, addressed through TILE_VARIANTS.
      { rows: GRASS_TILE_2, palette: GRASS_PALETTE },
      { rows: GRASS_TILE_3, palette: GRASS_PALETTE },
      { rows: GRASS_TILE_4, palette: GRASS_PALETTE },
      { rows: WATER_A_2, palette: WATER_PALETTE },
      { rows: WATER_A_3, palette: WATER_PALETTE },
      { rows: WATER_A_4, palette: WATER_PALETTE },
      { rows: WATER_B_2, palette: WATER_PALETTE },
      { rows: WATER_B_3, palette: WATER_PALETTE },
      { rows: WATER_B_4, palette: WATER_PALETTE },
      { rows: PATH_TILE_2, palette: PATH_PALETTE },
      { rows: PATH_TILE_3, palette: PATH_PALETTE },
      { rows: PATH_TILE_4, palette: PATH_PALETTE },
      { rows: TREE_TILE_2, palette: TREE_PALETTE },
      { rows: TREE_TILE_3, palette: TREE_PALETTE },
      { rows: TREE_TILE_4, palette: TREE_PALETTE },
      // 23..27 are the volcano's T_ASH..T_SCORCH in levels.ts — same
      // append-only rule as 0..7. 28 tiles = 1792px of the 2048px cap.
      { rows: ASH_TILE, palette: ASH_PALETTE },
      { rows: LAVA_A, palette: LAVA_PALETTE },
      { rows: LAVA_B, palette: LAVA_PALETTE },
      { rows: ROCK_TILE, palette: ROCK_PALETTE },
      { rows: SCORCH_TILE, palette: SCORCH_PALETTE },
    ],
    16,
  );

  // Separate texture keys, so these carry no tiles16 index and never collide.
  makeTilesetTexture(
    this,
    "shore16",
    [
      { rows: SHORE_TILE_1, palette: SHORE_PALETTE },
      { rows: SHORE_TILE_2, palette: SHORE_PALETTE },
      { rows: SHORE_TILE_3, palette: SHORE_PALETTE },
      { rows: SHORE_TILE_4, palette: SHORE_PALETTE },
      { rows: SHORE_TILE_5, palette: SHORE_PALETTE },
      { rows: SHORE_TILE_6, palette: SHORE_PALETTE },
      { rows: SHORE_TILE_7, palette: SHORE_PALETTE },
      { rows: SHORE_TILE_8, palette: SHORE_PALETTE },
      { rows: SHORE_TILE_9, palette: SHORE_PALETTE },
      { rows: SHORE_TILE_10, palette: SHORE_PALETTE },
      { rows: SHORE_TILE_11, palette: SHORE_PALETTE },
      { rows: SHORE_TILE_12, palette: SHORE_PALETTE },
      { rows: SHORE_TILE_13, palette: SHORE_PALETTE },
      { rows: SHORE_TILE_14, palette: SHORE_PALETTE },
    ],
    16,
  );
  makeTilesetTexture(
    this,
    "road16",
    [
      { rows: ROAD_TILE_1, palette: ROAD_PALETTE },
      { rows: ROAD_TILE_2, palette: ROAD_PALETTE },
      { rows: ROAD_TILE_3, palette: ROAD_PALETTE },
      { rows: ROAD_TILE_4, palette: ROAD_PALETTE },
      { rows: ROAD_TILE_5, palette: ROAD_PALETTE },
      { rows: ROAD_TILE_6, palette: ROAD_PALETTE },
      { rows: ROAD_TILE_7, palette: ROAD_PALETTE },
      { rows: ROAD_TILE_8, palette: ROAD_PALETTE },
      { rows: ROAD_TILE_9, palette: ROAD_PALETTE },
      { rows: ROAD_TILE_10, palette: ROAD_PALETTE },
      { rows: ROAD_TILE_11, palette: ROAD_PALETTE },
      { rows: ROAD_TILE_12, palette: ROAD_PALETTE },
      { rows: ROAD_TILE_13, palette: ROAD_PALETTE },
      { rows: ROAD_TILE_14, palette: ROAD_PALETTE },
    ],
    16,
  );

  // The snow field's skin (SNOW_SKIN): entry for entry the three bakes above
  // with snow palettes. Keep the order identical -- check:art compares them.
  makeTilesetTexture(
    this,
    "tiles16-snow",
    [
      { rows: GRASS_TILE, palette: SNOW_GRASS_PALETTE },
      { rows: WATER_A, palette: SNOW_WATER_PALETTE },
      { rows: WATER_B, palette: SNOW_WATER_PALETTE },
      { rows: TREE_TILE, palette: SNOW_TREE_PALETTE },
      { rows: PATH_TILE, palette: SNOW_PATH_PALETTE },
      { rows: TALL_TILE, palette: SNOW_TALL_PALETTE },
      { rows: HOUSE_TILE, palette: HOUSE_TILE_PALETTE },
      { rows: SOIL_TILE, palette: SOIL_PALETTE },
      { rows: GRASS_TILE_2, palette: SNOW_GRASS_PALETTE },
      { rows: GRASS_TILE_3, palette: SNOW_GRASS_PALETTE },
      { rows: GRASS_TILE_4, palette: SNOW_GRASS_PALETTE },
      { rows: WATER_A_2, palette: SNOW_WATER_PALETTE },
      { rows: WATER_A_3, palette: SNOW_WATER_PALETTE },
      { rows: WATER_A_4, palette: SNOW_WATER_PALETTE },
      { rows: WATER_B_2, palette: SNOW_WATER_PALETTE },
      { rows: WATER_B_3, palette: SNOW_WATER_PALETTE },
      { rows: WATER_B_4, palette: SNOW_WATER_PALETTE },
      { rows: PATH_TILE_2, palette: SNOW_PATH_PALETTE },
      { rows: PATH_TILE_3, palette: SNOW_PATH_PALETTE },
      { rows: PATH_TILE_4, palette: SNOW_PATH_PALETTE },
      { rows: TREE_TILE_2, palette: SNOW_TREE_PALETTE },
      { rows: TREE_TILE_3, palette: SNOW_TREE_PALETTE },
      { rows: TREE_TILE_4, palette: SNOW_TREE_PALETTE },
      { rows: ASH_TILE, palette: ASH_PALETTE },
      { rows: LAVA_A, palette: LAVA_PALETTE },
      { rows: LAVA_B, palette: LAVA_PALETTE },
      { rows: ROCK_TILE, palette: ROCK_PALETTE },
      { rows: SCORCH_TILE, palette: SCORCH_PALETTE },
    ],
    16,
  );
  makeTilesetTexture(
    this,
    "shore16-snow",
    [
      { rows: SHORE_TILE_1, palette: SNOW_SHORE_PALETTE },
      { rows: SHORE_TILE_2, palette: SNOW_SHORE_PALETTE },
      { rows: SHORE_TILE_3, palette: SNOW_SHORE_PALETTE },
      { rows: SHORE_TILE_4, palette: SNOW_SHORE_PALETTE },
      { rows: SHORE_TILE_5, palette: SNOW_SHORE_PALETTE },
      { rows: SHORE_TILE_6, palette: SNOW_SHORE_PALETTE },
      { rows: SHORE_TILE_7, palette: SNOW_SHORE_PALETTE },
      { rows: SHORE_TILE_8, palette: SNOW_SHORE_PALETTE },
      { rows: SHORE_TILE_9, palette: SNOW_SHORE_PALETTE },
      { rows: SHORE_TILE_10, palette: SNOW_SHORE_PALETTE },
      { rows: SHORE_TILE_11, palette: SNOW_SHORE_PALETTE },
      { rows: SHORE_TILE_12, palette: SNOW_SHORE_PALETTE },
      { rows: SHORE_TILE_13, palette: SNOW_SHORE_PALETTE },
      { rows: SHORE_TILE_14, palette: SNOW_SHORE_PALETTE },
    ],
    16,
  );
  makeTilesetTexture(
    this,
    "road16-snow",
    [
      { rows: ROAD_TILE_1, palette: SNOW_ROAD_PALETTE },
      { rows: ROAD_TILE_2, palette: SNOW_ROAD_PALETTE },
      { rows: ROAD_TILE_3, palette: SNOW_ROAD_PALETTE },
      { rows: ROAD_TILE_4, palette: SNOW_ROAD_PALETTE },
      { rows: ROAD_TILE_5, palette: SNOW_ROAD_PALETTE },
      { rows: ROAD_TILE_6, palette: SNOW_ROAD_PALETTE },
      { rows: ROAD_TILE_7, palette: SNOW_ROAD_PALETTE },
      { rows: ROAD_TILE_8, palette: SNOW_ROAD_PALETTE },
      { rows: ROAD_TILE_9, palette: SNOW_ROAD_PALETTE },
      { rows: ROAD_TILE_10, palette: SNOW_ROAD_PALETTE },
      { rows: ROAD_TILE_11, palette: SNOW_ROAD_PALETTE },
      { rows: ROAD_TILE_12, palette: SNOW_ROAD_PALETTE },
      { rows: ROAD_TILE_13, palette: SNOW_ROAD_PALETTE },
      { rows: ROAD_TILE_14, palette: SNOW_ROAD_PALETTE },
    ],
    16,
  );

  // The forest's skin (FOREST_SKIN), the same way: entry for entry the base
  // bakes with forest palettes, in the same order -- check:art compares them.
  makeTilesetTexture(
    this,
    "tiles16-forest",
    [
      { rows: GRASS_TILE, palette: FOREST_GRASS_PALETTE },
      { rows: WATER_A, palette: FOREST_WATER_PALETTE },
      { rows: WATER_B, palette: FOREST_WATER_PALETTE },
      { rows: TREE_TILE, palette: FOREST_TREE_PALETTE },
      { rows: PATH_TILE, palette: FOREST_PATH_PALETTE },
      { rows: TALL_TILE, palette: FOREST_TALL_PALETTE },
      { rows: HOUSE_TILE, palette: HOUSE_TILE_PALETTE },
      { rows: SOIL_TILE, palette: SOIL_PALETTE },
      { rows: GRASS_TILE_2, palette: FOREST_GRASS_PALETTE },
      { rows: GRASS_TILE_3, palette: FOREST_GRASS_PALETTE },
      { rows: GRASS_TILE_4, palette: FOREST_GRASS_PALETTE },
      { rows: WATER_A_2, palette: FOREST_WATER_PALETTE },
      { rows: WATER_A_3, palette: FOREST_WATER_PALETTE },
      { rows: WATER_A_4, palette: FOREST_WATER_PALETTE },
      { rows: WATER_B_2, palette: FOREST_WATER_PALETTE },
      { rows: WATER_B_3, palette: FOREST_WATER_PALETTE },
      { rows: WATER_B_4, palette: FOREST_WATER_PALETTE },
      { rows: PATH_TILE_2, palette: FOREST_PATH_PALETTE },
      { rows: PATH_TILE_3, palette: FOREST_PATH_PALETTE },
      { rows: PATH_TILE_4, palette: FOREST_PATH_PALETTE },
      { rows: TREE_TILE_2, palette: FOREST_TREE_PALETTE },
      { rows: TREE_TILE_3, palette: FOREST_TREE_PALETTE },
      { rows: TREE_TILE_4, palette: FOREST_TREE_PALETTE },
      { rows: ASH_TILE, palette: ASH_PALETTE },
      { rows: LAVA_A, palette: LAVA_PALETTE },
      { rows: LAVA_B, palette: LAVA_PALETTE },
      { rows: ROCK_TILE, palette: ROCK_PALETTE },
      { rows: SCORCH_TILE, palette: SCORCH_PALETTE },
    ],
    16,
  );
  makeTilesetTexture(
    this,
    "shore16-forest",
    [
      { rows: SHORE_TILE_1, palette: FOREST_SHORE_PALETTE },
      { rows: SHORE_TILE_2, palette: FOREST_SHORE_PALETTE },
      { rows: SHORE_TILE_3, palette: FOREST_SHORE_PALETTE },
      { rows: SHORE_TILE_4, palette: FOREST_SHORE_PALETTE },
      { rows: SHORE_TILE_5, palette: FOREST_SHORE_PALETTE },
      { rows: SHORE_TILE_6, palette: FOREST_SHORE_PALETTE },
      { rows: SHORE_TILE_7, palette: FOREST_SHORE_PALETTE },
      { rows: SHORE_TILE_8, palette: FOREST_SHORE_PALETTE },
      { rows: SHORE_TILE_9, palette: FOREST_SHORE_PALETTE },
      { rows: SHORE_TILE_10, palette: FOREST_SHORE_PALETTE },
      { rows: SHORE_TILE_11, palette: FOREST_SHORE_PALETTE },
      { rows: SHORE_TILE_12, palette: FOREST_SHORE_PALETTE },
      { rows: SHORE_TILE_13, palette: FOREST_SHORE_PALETTE },
      { rows: SHORE_TILE_14, palette: FOREST_SHORE_PALETTE },
    ],
    16,
  );
  makeTilesetTexture(
    this,
    "road16-forest",
    [
      { rows: ROAD_TILE_1, palette: FOREST_ROAD_PALETTE },
      { rows: ROAD_TILE_2, palette: FOREST_ROAD_PALETTE },
      { rows: ROAD_TILE_3, palette: FOREST_ROAD_PALETTE },
      { rows: ROAD_TILE_4, palette: FOREST_ROAD_PALETTE },
      { rows: ROAD_TILE_5, palette: FOREST_ROAD_PALETTE },
      { rows: ROAD_TILE_6, palette: FOREST_ROAD_PALETTE },
      { rows: ROAD_TILE_7, palette: FOREST_ROAD_PALETTE },
      { rows: ROAD_TILE_8, palette: FOREST_ROAD_PALETTE },
      { rows: ROAD_TILE_9, palette: FOREST_ROAD_PALETTE },
      { rows: ROAD_TILE_10, palette: FOREST_ROAD_PALETTE },
      { rows: ROAD_TILE_11, palette: FOREST_ROAD_PALETTE },
      { rows: ROAD_TILE_12, palette: FOREST_ROAD_PALETTE },
      { rows: ROAD_TILE_13, palette: FOREST_ROAD_PALETTE },
      { rows: ROAD_TILE_14, palette: FOREST_ROAD_PALETTE },
    ],
    16,
  );

  // The cave's skin (CAVE_SKIN), the same way again. Trees keep their own
  // palette: the cave has none left, its walls are rock (26).
  makeTilesetTexture(
    this,
    "tiles16-cave",
    [
      { rows: GRASS_TILE, palette: CAVE_GRASS_PALETTE },
      { rows: WATER_A, palette: CAVE_WATER_PALETTE },
      { rows: WATER_B, palette: CAVE_WATER_PALETTE },
      { rows: TREE_TILE, palette: TREE_PALETTE },
      { rows: PATH_TILE, palette: CAVE_PATH_PALETTE },
      { rows: TALL_TILE, palette: CAVE_TALL_PALETTE },
      { rows: HOUSE_TILE, palette: HOUSE_TILE_PALETTE },
      { rows: SOIL_TILE, palette: SOIL_PALETTE },
      { rows: GRASS_TILE_2, palette: CAVE_GRASS_PALETTE },
      { rows: GRASS_TILE_3, palette: CAVE_GRASS_PALETTE },
      { rows: GRASS_TILE_4, palette: CAVE_GRASS_PALETTE },
      { rows: WATER_A_2, palette: CAVE_WATER_PALETTE },
      { rows: WATER_A_3, palette: CAVE_WATER_PALETTE },
      { rows: WATER_A_4, palette: CAVE_WATER_PALETTE },
      { rows: WATER_B_2, palette: CAVE_WATER_PALETTE },
      { rows: WATER_B_3, palette: CAVE_WATER_PALETTE },
      { rows: WATER_B_4, palette: CAVE_WATER_PALETTE },
      { rows: PATH_TILE_2, palette: CAVE_PATH_PALETTE },
      { rows: PATH_TILE_3, palette: CAVE_PATH_PALETTE },
      { rows: PATH_TILE_4, palette: CAVE_PATH_PALETTE },
      { rows: TREE_TILE_2, palette: TREE_PALETTE },
      { rows: TREE_TILE_3, palette: TREE_PALETTE },
      { rows: TREE_TILE_4, palette: TREE_PALETTE },
      { rows: ASH_TILE, palette: ASH_PALETTE },
      { rows: LAVA_A, palette: LAVA_PALETTE },
      { rows: LAVA_B, palette: LAVA_PALETTE },
      { rows: ROCK_TILE, palette: CAVE_ROCK_PALETTE },
      { rows: SCORCH_TILE, palette: SCORCH_PALETTE },
    ],
    16,
  );
  makeTilesetTexture(
    this,
    "shore16-cave",
    [
      { rows: SHORE_TILE_1, palette: CAVE_SHORE_PALETTE },
      { rows: SHORE_TILE_2, palette: CAVE_SHORE_PALETTE },
      { rows: SHORE_TILE_3, palette: CAVE_SHORE_PALETTE },
      { rows: SHORE_TILE_4, palette: CAVE_SHORE_PALETTE },
      { rows: SHORE_TILE_5, palette: CAVE_SHORE_PALETTE },
      { rows: SHORE_TILE_6, palette: CAVE_SHORE_PALETTE },
      { rows: SHORE_TILE_7, palette: CAVE_SHORE_PALETTE },
      { rows: SHORE_TILE_8, palette: CAVE_SHORE_PALETTE },
      { rows: SHORE_TILE_9, palette: CAVE_SHORE_PALETTE },
      { rows: SHORE_TILE_10, palette: CAVE_SHORE_PALETTE },
      { rows: SHORE_TILE_11, palette: CAVE_SHORE_PALETTE },
      { rows: SHORE_TILE_12, palette: CAVE_SHORE_PALETTE },
      { rows: SHORE_TILE_13, palette: CAVE_SHORE_PALETTE },
      { rows: SHORE_TILE_14, palette: CAVE_SHORE_PALETTE },
    ],
    16,
  );
  makeTilesetTexture(
    this,
    "road16-cave",
    [
      { rows: ROAD_TILE_1, palette: CAVE_ROAD_PALETTE },
      { rows: ROAD_TILE_2, palette: CAVE_ROAD_PALETTE },
      { rows: ROAD_TILE_3, palette: CAVE_ROAD_PALETTE },
      { rows: ROAD_TILE_4, palette: CAVE_ROAD_PALETTE },
      { rows: ROAD_TILE_5, palette: CAVE_ROAD_PALETTE },
      { rows: ROAD_TILE_6, palette: CAVE_ROAD_PALETTE },
      { rows: ROAD_TILE_7, palette: CAVE_ROAD_PALETTE },
      { rows: ROAD_TILE_8, palette: CAVE_ROAD_PALETTE },
      { rows: ROAD_TILE_9, palette: CAVE_ROAD_PALETTE },
      { rows: ROAD_TILE_10, palette: CAVE_ROAD_PALETTE },
      { rows: ROAD_TILE_11, palette: CAVE_ROAD_PALETTE },
      { rows: ROAD_TILE_12, palette: CAVE_ROAD_PALETTE },
      { rows: ROAD_TILE_13, palette: CAVE_ROAD_PALETTE },
      { rows: ROAD_TILE_14, palette: CAVE_ROAD_PALETTE },
    ],
    16,
  );

  // The autumn skins (AUTUMN_SKIN, FOREST_AUTUMN_SKIN), the same way: entry
  // for entry the base bakes, in the same order -- check:art compares them.
  // Paths and water keep the town's and the forest's own palettes.
  makeTilesetTexture(
    this,
    "tiles16-autumn",
    [
      { rows: GRASS_TILE, palette: AUTUMN_GRASS_PALETTE },
      { rows: WATER_A, palette: WATER_PALETTE },
      { rows: WATER_B, palette: WATER_PALETTE },
      { rows: TREE_TILE, palette: AUTUMN_TREE_PALETTE },
      { rows: PATH_TILE, palette: PATH_PALETTE },
      { rows: TALL_TILE, palette: AUTUMN_TALL_PALETTE },
      { rows: HOUSE_TILE, palette: HOUSE_TILE_PALETTE },
      { rows: SOIL_TILE, palette: SOIL_PALETTE },
      { rows: GRASS_TILE_2, palette: AUTUMN_GRASS_PALETTE },
      { rows: GRASS_TILE_3, palette: AUTUMN_GRASS_PALETTE },
      { rows: GRASS_TILE_4, palette: AUTUMN_GRASS_PALETTE },
      { rows: WATER_A_2, palette: WATER_PALETTE },
      { rows: WATER_A_3, palette: WATER_PALETTE },
      { rows: WATER_A_4, palette: WATER_PALETTE },
      { rows: WATER_B_2, palette: WATER_PALETTE },
      { rows: WATER_B_3, palette: WATER_PALETTE },
      { rows: WATER_B_4, palette: WATER_PALETTE },
      { rows: PATH_TILE_2, palette: PATH_PALETTE },
      { rows: PATH_TILE_3, palette: PATH_PALETTE },
      { rows: PATH_TILE_4, palette: PATH_PALETTE },
      { rows: TREE_TILE_2, palette: AUTUMN_TREE_PALETTE },
      { rows: TREE_TILE_3, palette: AUTUMN_TREE_PALETTE },
      { rows: TREE_TILE_4, palette: AUTUMN_TREE_PALETTE },
      { rows: ASH_TILE, palette: ASH_PALETTE },
      { rows: LAVA_A, palette: LAVA_PALETTE },
      { rows: LAVA_B, palette: LAVA_PALETTE },
      { rows: ROCK_TILE, palette: ROCK_PALETTE },
      { rows: SCORCH_TILE, palette: SCORCH_PALETTE },
    ],
    16,
  );
  makeTilesetTexture(
    this,
    "shore16-autumn",
    [
      { rows: SHORE_TILE_1, palette: AUTUMN_SHORE_PALETTE },
      { rows: SHORE_TILE_2, palette: AUTUMN_SHORE_PALETTE },
      { rows: SHORE_TILE_3, palette: AUTUMN_SHORE_PALETTE },
      { rows: SHORE_TILE_4, palette: AUTUMN_SHORE_PALETTE },
      { rows: SHORE_TILE_5, palette: AUTUMN_SHORE_PALETTE },
      { rows: SHORE_TILE_6, palette: AUTUMN_SHORE_PALETTE },
      { rows: SHORE_TILE_7, palette: AUTUMN_SHORE_PALETTE },
      { rows: SHORE_TILE_8, palette: AUTUMN_SHORE_PALETTE },
      { rows: SHORE_TILE_9, palette: AUTUMN_SHORE_PALETTE },
      { rows: SHORE_TILE_10, palette: AUTUMN_SHORE_PALETTE },
      { rows: SHORE_TILE_11, palette: AUTUMN_SHORE_PALETTE },
      { rows: SHORE_TILE_12, palette: AUTUMN_SHORE_PALETTE },
      { rows: SHORE_TILE_13, palette: AUTUMN_SHORE_PALETTE },
      { rows: SHORE_TILE_14, palette: AUTUMN_SHORE_PALETTE },
    ],
    16,
  );
  makeTilesetTexture(
    this,
    "road16-autumn",
    [
      { rows: ROAD_TILE_1, palette: AUTUMN_ROAD_PALETTE },
      { rows: ROAD_TILE_2, palette: AUTUMN_ROAD_PALETTE },
      { rows: ROAD_TILE_3, palette: AUTUMN_ROAD_PALETTE },
      { rows: ROAD_TILE_4, palette: AUTUMN_ROAD_PALETTE },
      { rows: ROAD_TILE_5, palette: AUTUMN_ROAD_PALETTE },
      { rows: ROAD_TILE_6, palette: AUTUMN_ROAD_PALETTE },
      { rows: ROAD_TILE_7, palette: AUTUMN_ROAD_PALETTE },
      { rows: ROAD_TILE_8, palette: AUTUMN_ROAD_PALETTE },
      { rows: ROAD_TILE_9, palette: AUTUMN_ROAD_PALETTE },
      { rows: ROAD_TILE_10, palette: AUTUMN_ROAD_PALETTE },
      { rows: ROAD_TILE_11, palette: AUTUMN_ROAD_PALETTE },
      { rows: ROAD_TILE_12, palette: AUTUMN_ROAD_PALETTE },
      { rows: ROAD_TILE_13, palette: AUTUMN_ROAD_PALETTE },
      { rows: ROAD_TILE_14, palette: AUTUMN_ROAD_PALETTE },
    ],
    16,
  );
  makeTilesetTexture(
    this,
    "tiles16-forestautumn",
    [
      { rows: GRASS_TILE, palette: FOREST_AUTUMN_GRASS_PALETTE },
      { rows: WATER_A, palette: FOREST_WATER_PALETTE },
      { rows: WATER_B, palette: FOREST_WATER_PALETTE },
      { rows: TREE_TILE, palette: FOREST_AUTUMN_TREE_PALETTE },
      { rows: PATH_TILE, palette: FOREST_PATH_PALETTE },
      { rows: TALL_TILE, palette: FOREST_AUTUMN_TALL_PALETTE },
      { rows: HOUSE_TILE, palette: HOUSE_TILE_PALETTE },
      { rows: SOIL_TILE, palette: SOIL_PALETTE },
      { rows: GRASS_TILE_2, palette: FOREST_AUTUMN_GRASS_PALETTE },
      { rows: GRASS_TILE_3, palette: FOREST_AUTUMN_GRASS_PALETTE },
      { rows: GRASS_TILE_4, palette: FOREST_AUTUMN_GRASS_PALETTE },
      { rows: WATER_A_2, palette: FOREST_WATER_PALETTE },
      { rows: WATER_A_3, palette: FOREST_WATER_PALETTE },
      { rows: WATER_A_4, palette: FOREST_WATER_PALETTE },
      { rows: WATER_B_2, palette: FOREST_WATER_PALETTE },
      { rows: WATER_B_3, palette: FOREST_WATER_PALETTE },
      { rows: WATER_B_4, palette: FOREST_WATER_PALETTE },
      { rows: PATH_TILE_2, palette: FOREST_PATH_PALETTE },
      { rows: PATH_TILE_3, palette: FOREST_PATH_PALETTE },
      { rows: PATH_TILE_4, palette: FOREST_PATH_PALETTE },
      { rows: TREE_TILE_2, palette: FOREST_AUTUMN_TREE_PALETTE },
      { rows: TREE_TILE_3, palette: FOREST_AUTUMN_TREE_PALETTE },
      { rows: TREE_TILE_4, palette: FOREST_AUTUMN_TREE_PALETTE },
      { rows: ASH_TILE, palette: ASH_PALETTE },
      { rows: LAVA_A, palette: LAVA_PALETTE },
      { rows: LAVA_B, palette: LAVA_PALETTE },
      { rows: ROCK_TILE, palette: ROCK_PALETTE },
      { rows: SCORCH_TILE, palette: SCORCH_PALETTE },
    ],
    16,
  );
  makeTilesetTexture(
    this,
    "shore16-forestautumn",
    [
      { rows: SHORE_TILE_1, palette: FOREST_AUTUMN_SHORE_PALETTE },
      { rows: SHORE_TILE_2, palette: FOREST_AUTUMN_SHORE_PALETTE },
      { rows: SHORE_TILE_3, palette: FOREST_AUTUMN_SHORE_PALETTE },
      { rows: SHORE_TILE_4, palette: FOREST_AUTUMN_SHORE_PALETTE },
      { rows: SHORE_TILE_5, palette: FOREST_AUTUMN_SHORE_PALETTE },
      { rows: SHORE_TILE_6, palette: FOREST_AUTUMN_SHORE_PALETTE },
      { rows: SHORE_TILE_7, palette: FOREST_AUTUMN_SHORE_PALETTE },
      { rows: SHORE_TILE_8, palette: FOREST_AUTUMN_SHORE_PALETTE },
      { rows: SHORE_TILE_9, palette: FOREST_AUTUMN_SHORE_PALETTE },
      { rows: SHORE_TILE_10, palette: FOREST_AUTUMN_SHORE_PALETTE },
      { rows: SHORE_TILE_11, palette: FOREST_AUTUMN_SHORE_PALETTE },
      { rows: SHORE_TILE_12, palette: FOREST_AUTUMN_SHORE_PALETTE },
      { rows: SHORE_TILE_13, palette: FOREST_AUTUMN_SHORE_PALETTE },
      { rows: SHORE_TILE_14, palette: FOREST_AUTUMN_SHORE_PALETTE },
    ],
    16,
  );
  makeTilesetTexture(
    this,
    "road16-forestautumn",
    [
      { rows: ROAD_TILE_1, palette: FOREST_AUTUMN_ROAD_PALETTE },
      { rows: ROAD_TILE_2, palette: FOREST_AUTUMN_ROAD_PALETTE },
      { rows: ROAD_TILE_3, palette: FOREST_AUTUMN_ROAD_PALETTE },
      { rows: ROAD_TILE_4, palette: FOREST_AUTUMN_ROAD_PALETTE },
      { rows: ROAD_TILE_5, palette: FOREST_AUTUMN_ROAD_PALETTE },
      { rows: ROAD_TILE_6, palette: FOREST_AUTUMN_ROAD_PALETTE },
      { rows: ROAD_TILE_7, palette: FOREST_AUTUMN_ROAD_PALETTE },
      { rows: ROAD_TILE_8, palette: FOREST_AUTUMN_ROAD_PALETTE },
      { rows: ROAD_TILE_9, palette: FOREST_AUTUMN_ROAD_PALETTE },
      { rows: ROAD_TILE_10, palette: FOREST_AUTUMN_ROAD_PALETTE },
      { rows: ROAD_TILE_11, palette: FOREST_AUTUMN_ROAD_PALETTE },
      { rows: ROAD_TILE_12, palette: FOREST_AUTUMN_ROAD_PALETTE },
      { rows: ROAD_TILE_13, palette: FOREST_AUTUMN_ROAD_PALETTE },
      { rows: ROAD_TILE_14, palette: FOREST_AUTUMN_ROAD_PALETTE },
    ],
    16,
  );
}
