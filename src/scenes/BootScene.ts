import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { makeTexture, makeTilesetTexture } from "../pixelart";

// Terrain is a regular diagonal pattern, two tones, deliberately low contrast.
//
// The first version scattered a 5-tone hue-shifted ramp with a coordinate hash.
// It measured well for evenness but read as noise: busy, then tiring. The fix
// was never fewer marks -- this pattern marks MORE cells than that one did
// (20% vs 19.5%) -- it was less contrast, in two steps. Spread against the base
// went 70 -> 13, which still showed dots at 1:1, then 13 -> 5, which does not.
// A repeating pattern gets filed as texture and ignored; random dots keep
// looking like information. Terrain is the floor an actor stands on: it loses.
//
// Judge terrain at 1:1 (one art pixel = PIXEL screen pixels, tiles 64px). The
// 3-4x renders used earlier exaggerated the noise and sent two rounds of this
// in the wrong direction.
//
// The pattern period must be coprime with the 16-cell tile (5 for grass, 6 for
// path) or the marks line up with the tile edge and the 64px grid reappears.
// Variations are phase shifts of the one pattern, offset by `seed`. Not seed*3:
// at period 6 that collapses to phases 0,3,0,3 and two of the four variants come
// out byte-identical, silently costing half the variation.
const GRASS_PALETTE = { g: 0x1f5c42, h: 0x216246 };
const GRASS_TILE = [
  "hgggghgggghggggh",
  "ggghgggghgggghgg",
  "ghgggghgggghgggg",
  "gggghgggghgggghg",
  "gghgggghgggghggg",
  "hgggghgggghggggh",
  "ggghgggghgggghgg",
  "ghgggghgggghgggg",
  "gggghgggghgggghg",
  "gghgggghgggghggg",
  "hgggghgggghggggh",
  "ggghgggghgggghgg",
  "ghgggghgggghgggg",
  "gggghgggghgggghg",
  "gghgggghgggghggg",
  "hgggghgggghggggh",
];
const GRASS_TILE_2 = [
  "gggghgggghgggghg",
  "gghgggghgggghggg",
  "hgggghgggghggggh",
  "ggghgggghgggghgg",
  "ghgggghgggghgggg",
  "gggghgggghgggghg",
  "gghgggghgggghggg",
  "hgggghgggghggggh",
  "ggghgggghgggghgg",
  "ghgggghgggghgggg",
  "gggghgggghgggghg",
  "gghgggghgggghggg",
  "hgggghgggghggggh",
  "ggghgggghgggghgg",
  "ghgggghgggghgggg",
  "gggghgggghgggghg",
];
const GRASS_TILE_3 = [
  "ggghgggghgggghgg",
  "ghgggghgggghgggg",
  "gggghgggghgggghg",
  "gghgggghgggghggg",
  "hgggghgggghggggh",
  "ggghgggghgggghgg",
  "ghgggghgggghgggg",
  "gggghgggghgggghg",
  "gghgggghgggghggg",
  "hgggghgggghggggh",
  "ggghgggghgggghgg",
  "ghgggghgggghgggg",
  "gggghgggghgggghg",
  "gghgggghgggghggg",
  "hgggghgggghggggh",
  "ggghgggghgggghgg",
];
const GRASS_TILE_4 = [
  "gghgggghgggghggg",
  "hgggghgggghggggh",
  "ggghgggghgggghgg",
  "ghgggghgggghgggg",
  "gggghgggghgggghg",
  "gghgggghgggghggg",
  "hgggghgggghggggh",
  "ggghgggghgggghgg",
  "ghgggghgggghgggg",
  "gggghgggghgggghg",
  "gghgggghgggghggg",
  "hgggghgggghggggh",
  "ggghgggghgggghgg",
  "ghgggghgggghgggg",
  "gggghgggghgggghg",
  "gghgggghgggghggg",
];

// Water animates by swapping frame A for frame B. Each B frame is its A frame
// scrolled one pixel up, so the ripple layout is identical and only the phase
// changes -- pair variation i of A with variation i of B or the water jitters.
//
// Crests are deliberately short 2+2 staircases, not straight runs, and every
// variation puts exactly one crest in each of five row bands. Sampling the rows
// freely instead put a crest on row 7 of all four variations, which tiled into a
// hard bright line every 16px; a long horizontal run does the same on its own.
const WATER_PALETTE = { d: 0x011654, B: 0x01207f, W: 0x0133a9, l: 0x2f6ecb, h: 0x7fc6f0 };
const WATER_A = [
  "llWWWWWWWWWWWBBW",
  "BBlhWWWWWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "WWWWWWWWWWWllWWW",
  "WWWWWBBWWWWBBlhW",
  "WWWWWWWWWWllWWWW",
  "WWWWWWWWWWBBlhWW",
  "WWWWWdWWWWWWWWBB",
  "WWWWWWWWWllWWWWW",
  "WWWWWWWWWBBlhWWW",
  "WWWWWWWWWWWWBBWW",
  "WWWWWdWWWWWWWWWW",
  "WWWWWBBWWWlhWWWW",
  "WWWWWWWWllWWWWWW",
  "WWWWWWWWBBWWdWWW",
];
const WATER_B = [
  "BBlhWWWWWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "WWWWWWWWWWWllWWW",
  "WWWWWBBWWWWBBlhW",
  "WWWWWWWWWWllWWWW",
  "WWWWWWWWWWBBlhWW",
  "WWWWWdWWWWWWWWBB",
  "WWWWWWWWWllWWWWW",
  "WWWWWWWWWBBlhWWW",
  "WWWWWWWWWWWWBBWW",
  "WWWWWdWWWWWWWWWW",
  "WWWWWBBWWWlhWWWW",
  "WWWWWWWWllWWWWWW",
  "WWWWWWWWBBWWdWWW",
  "llWWWWWWWWWWWBBW",
];
const WATER_A_2 = [
  "WWWWWWWWWWlhWBBW",
  "WWWWWWWWllWWWWWW",
  "WlhWWWWWBBWWWWWW",
  "lWWWWWWWWWBBBWWl",
  "BWWWWWWWWWWWWWWB",
  "WWdWWWWWWWWWWWWW",
  "BBWWWlhWWWWWWWWW",
  "WWWllWWWWWWWWWWW",
  "WWWBBWWWWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "WWWWWWWWllWWWWdW",
  "WWWWWWWWBBlhBWWW",
  "WWWWWWWWWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "hWWWWWWWWWdWWWWl",
  "WWWWBBWWWWWWWllW",
];
const WATER_B_2 = [
  "WWWWWWWWllWWWWWW",
  "WlhWWWWWBBWWWWWW",
  "lWWWWWWWWWBBBWWl",
  "BWWWWWWWWWWWWWWB",
  "WWdWWWWWWWWWWWWW",
  "BBWWWlhWWWWWWWWW",
  "WWWllWWWWWWWWWWW",
  "WWWBBWWWWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "WWWWWWWWllWWWWdW",
  "WWWWWWWWBBlhBWWW",
  "WWWWWWWWWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "hWWWWWWWWWdWWWWl",
  "WWWWBBWWWWWWWllW",
  "WWWWWWWWWWlhWBBW",
];
const WATER_A_3 = [
  "WWWWBBWWWWlhWWWW",
  "WWWWWWWWllWWWWWW",
  "WWWWWWWWBBWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "dWWWWWWWWWWWWWWW",
  "WWWWWWWllWWBBWWW",
  "WWWWWWWBBlhWWWWW",
  "WdWdllWWBBWWWWWW",
  "WWWWBBlhWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "WWBBWWWlhWWWWWWW",
  "WWWlhllWWWWWWWWW",
  "WllWWBBWWWWWWWWW",
  "WBBWWWWWWWWWWWWW",
  "WWWWWBBWWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
];
const WATER_B_3 = [
  "WWWWWWWWllWWWWWW",
  "WWWWWWWWBBWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "dWWWWWWWWWWWWWWW",
  "WWWWWWWllWWBBWWW",
  "WWWWWWWBBlhWWWWW",
  "WdWdllWWBBWWWWWW",
  "WWWWBBlhWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "WWBBWWWlhWWWWWWW",
  "WWWlhllWWWWWWWWW",
  "WllWWBBWWWWWWWWW",
  "WBBWWWWWWWWWWWWW",
  "WWWWWBBWWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "WWWWBBWWWWlhWWWW",
];
const WATER_A_4 = [
  "WWWWWWWWWWWWWWWW",
  "WWWWWWWWWWWWWBBW",
  "WWWWWWWWWWWWWWll",
  "lhWWWWWWWWWWWWBB",
  "WBBWWWWWWWWWllWW",
  "WWWWWWWWWWWWBBlh",
  "WWWWWWWWWWWWWWWW",
  "llWWWWWWWWWWWWWW",
  "BBlhWWWdWWBBdWWW",
  "WWWWWWWWWWWWWWWW",
  "WWWllWWBBWWWWWWW",
  "WWWBBlhWWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "WWWWWWWdWWlhWWWW",
  "WWWWBBWWllWWWWWW",
  "WWWWWWWWBBWWWWWW",
];
const WATER_B_4 = [
  "WWWWWWWWWWWWWBBW",
  "WWWWWWWWWWWWWWll",
  "lhWWWWWWWWWWWWBB",
  "WBBWWWWWWWWWllWW",
  "WWWWWWWWWWWWBBlh",
  "WWWWWWWWWWWWWWWW",
  "llWWWWWWWWWWWWWW",
  "BBlhWWWdWWBBdWWW",
  "WWWWWWWWWWWWWWWW",
  "WWWllWWBBWWWWWWW",
  "WWWBBlhWWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "WWWWWWWdWWlhWWWW",
  "WWWWBBWWllWWWWWW",
  "WWWWWWWWBBWWWWWW",
  "WWWWWWWWWWWWWWWW",
];

// The tree is drawn straight onto a copy of the grass speckle pattern (g/G/L
// shared with GRASS_TILE) so the tile merges into the map instead of reading
// as a dark box; b outlines the canopy, c highlights it, t is the trunk.
const TREE_PALETTE = {
  // grass base, identical to tile 0 so the tree tile still merges into the map
  g: 0x1f5c42,
  h: 0x216246,
  // canopy: outline + 4-step ramp lit from the top left
  b: 0x07281a,
  S: 0x0d3a26,
  D: 0x155235,
  c: 0x24734a,
  H: 0x53a05f,
  // trunk lit / shadow side, then the shadow it drops on the grass
  t: 0x4a3620,
  T: 0x2f2113,
  s: 0x123a28,
};
// Canopy is a shaded sphere lit from the top left rather than a flat blob:
// outline, 4-step ramp, then a two-tone trunk and a shadow dropped on the grass.
const TREE_TILE = [
  "hgggghgbbghggggh",
  "ggghbbHHHcbbghgg",
  "ghgbHHHcHcccbggg",
  "ggbHHHcHcDDcDbhg",
  "gbHHHcccDcDcSDbg",
  "hbHHHHccDDDDSSbh",
  "gbHHcHDcDDDSSSbg",
  "gbcHccDDDDSSSSbg",
  "gbccccDDDSSSSSbg",
  "ggbDDDDSSSSSSbgg",
  "hggbDDSSSSSSbggh",
  "ggghbbttTTbbghgg",
  "ghgggbttTTbhgggg",
  "gggghbttTTbggghg",
  "gghggbttTTbghggg",
  "hgggssssssssgggh",
];

// P/m/S/D are kept for the road transition overlays (ROAD_TILE_*) even though
// the path terrain tiles themselves only use p and h. An unused palette entry
// is harmless; removing one that a transition tile references turns its pixels
// transparent instead of failing loudly.
const PATH_PALETTE = { p: 0x735f43, h: 0x796446, D: 0x40331f, P: 0x5e4c33, m: 0x8b7454, S: 0xa89275 };
const PATH_TILE = [
  "hppppphppppphppp",
  "pppphppppphppppp",
  "pphppppphppppphp",
  "hppppphppppphppp",
  "pppphppppphppppp",
  "pphppppphppppphp",
  "hppppphppppphppp",
  "pppphppppphppppp",
  "pphppppphppppphp",
  "hppppphppppphppp",
  "pppphppppphppppp",
  "pphppppphppppphp",
  "hppppphppppphppp",
  "pppphppppphppppp",
  "pphppppphppppphp",
  "hppppphppppphppp",
];
const PATH_TILE_2 = [
  "ppppphppppphpppp",
  "ppphppppphppppph",
  "phppppphppppphpp",
  "ppppphppppphpppp",
  "ppphppppphppppph",
  "phppppphppppphpp",
  "ppppphppppphpppp",
  "ppphppppphppppph",
  "phppppphppppphpp",
  "ppppphppppphpppp",
  "ppphppppphppppph",
  "phppppphppppphpp",
  "ppppphppppphpppp",
  "ppphppppphppppph",
  "phppppphppppphpp",
  "ppppphppppphpppp",
];
const PATH_TILE_3 = [
  "pppphppppphppppp",
  "pphppppphppppphp",
  "hppppphppppphppp",
  "pppphppppphppppp",
  "pphppppphppppphp",
  "hppppphppppphppp",
  "pppphppppphppppp",
  "pphppppphppppphp",
  "hppppphppppphppp",
  "pppphppppphppppp",
  "pphppppphppppphp",
  "hppppphppppphppp",
  "pppphppppphppppp",
  "pphppppphppppphp",
  "hppppphppppphppp",
  "pppphppppphppppp",
];
const PATH_TILE_4 = [
  "ppphppppphppppph",
  "phppppphppppphpp",
  "ppppphppppphpppp",
  "ppphppppphppppph",
  "phppppphppppphpp",
  "ppppphppppphpppp",
  "ppphppppphppppph",
  "phppppphppppphpp",
  "ppppphppppphpppp",
  "ppphppppphppppph",
  "phppppphppppphpp",
  "ppppphppppphpppp",
  "ppphppppphppppph",
  "phppppphppppphpp",
  "ppppphppppphpppp",
  "ppphppppphppppph",
];

// Autotile transition overlays: grass<->water (shore) and grass<->path (road).
// Generated, not hand-drawn -- bilinear corner interpolation plus world-space
// noise, so the shared edge of two adjacent tiles matches by construction.
//
// These bake into their OWN textures, "shore16" and "road16", NOT into tiles16:
// 48 tiles in one strip would be 3072px wide, past the 2048px
// GL_MAX_TEXTURE_SIZE some mobile GPUs report, and this game ships touch
// controls. Split, each is 14 * 16 * PIXEL = 896px.
//
// Array order is corner mask 1..14, so SHORE_TILE_n is frame index n-1 --
// the same arithmetic autotile.ts's transitionTileIndex() does at runtime.
// Masks 0 and 15 draw nothing and have no tile.
//
// Every tile is FULLY OPAQUE and paints its own grass fill. An earlier version
// left the grass side transparent, which meant the overlay could only ADD water
// or path on top of the base layer, never carve into it: measured over a test
// map, grass pixels only ever decreased, so the base tilemap's 90-degree
// rectangle survived underneath and only gained a fringe inside it. Covering the
// whole cell lets the boundary actually cut the corner off.
//
// The grass tones here (g/q) must stay equal to GRASS_PALETTE's g/h. They are
// dedicated palettes rather than reuses of WATER_PALETTE/PATH_PALETTE so the
// border tones can be tuned independently -- ROAD's are capped near the
// terrain's own contrast, because once the terrain dropped to a luminance delta
// of 5, PATH_PALETTE's original border tones read at 4x-10x that and the road
// edge became the busiest thing on a calm field.
const SHORE_PALETTE = { W: 0x0133a9, B: 0x01207f, h: 0x7fc6f0, l: 0x2f6ecb, g: 0x1f5c42, q: 0x216246 };
const ROAD_PALETTE = { p: 0x735f43, P: 0x5e4c33, S: 0x887356, m: 0x897353, g: 0x1f5c42, q: 0x216246 };
const SHORE_TILE_1 = [
  "WWWWWBhhhggggggg",
  "WBWWWllggggggggg",
  "WWWWlhgggggggggg",
  "WWBlhhgggggggggg",
  "WBWghggggggggggg",
  "lWhhgggggggggggg",
  "Whhggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
];
const SHORE_TILE_2 = [
  "gggggggghlWWWWWW",
  "ggggggggghlWWBWW",
  "ggggggggghBlWWBW",
  "gggggggggghllWWW",
  "ggggggggggghhhWB",
  "ggggggggggggghll",
  "ggggggggggggghWW",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
];
const SHORE_TILE_3 = [
  "WWWWWWWBBWBWWWWB",
  "WWWWBBWWBWWWWWWW",
  "WWWWWWBWWWWWWWWW",
  "BWWWWWBWWWBBWWWW",
  "WWWWBWWWWWWWWWWW",
  "WWlBlWWBWlWlWBWW",
  "WBhlWWWllllhhWlB",
  "gghgghhhhghhlhgh",
  "hhhghggghhgggggh",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
];
const SHORE_TILE_4 = [
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "hggggggggggggggg",
  "gggggggggggggggg",
  "hhgggggggggggggg",
  "WBhghggggggggggg",
  "WBlggggggggggggg",
  "WWWWhggggggggggg",
  "WWWWBhhggggggggg",
  "WBWWWlhhgggggggg",
  "WWBWWWlggggggggg",
];
const SHORE_TILE_5 = [
  "BBWWWlhhhggggggg",
  "BWWWBWBhgggggggg",
  "WWWWWWWhhggggggg",
  "WBBWWWlWgggggggg",
  "WWWWWWhhgggggggg",
  "WWWWWBWggggggggg",
  "WWWWWBWhgggggggg",
  "BBWWWWWghggggggg",
  "WWWWWBBhgggggggg",
  "BWWWWWlhhggggggg",
  "WWWWBWWggggggggg",
  "BBBWWWlggggggggg",
  "BWWWWWhggggggggg",
  "WBWBWWhhgggggggg",
  "WWWWWWBhgggggggg",
  "BBWWWWWhgggggggg",
];
const SHORE_TILE_6 = [
  "ggggggghhhWWWWBW",
  "ggggggggghWBWWWB",
  "ggggggggghllWWWW",
  "ggggggggghhlBWWB",
  "ggggggggggghhhWW",
  "gggggggggggghWll",
  "gggggggggggggghl",
  "gggggggggggggggg",
  "hggggggggggggggg",
  "lhgggggggggggggg",
  "WWhhghgggggggggg",
  "WWBhhggggggggggg",
  "WWlWlggggggggggg",
  "BBBBlhgggggggggg",
  "WWWWllWhgggggggg",
  "WBWWWWhhgggggggg",
];
const SHORE_TILE_7 = [
  "WWWWBWWWWBWWWBWW",
  "WWWWWWWWBWWWWBBW",
  "WWBWWWWBWWWWWWWW",
  "BWWWWWWWWBBWWWWW",
  "WWWWWWWWWBWBWWBW",
  "WBWWBWWWWWBWWWWW",
  "WWWWWWBWWWWWWWWh",
  "WBWWWWBBWWBWlllW",
  "WWWWWWWWWWBBWggg",
  "BWWWBWWWWWWlgggg",
  "BWBWWBWWlBlhhggg",
  "WBWBWBBWhggggggg",
  "WWWBWWWlWgghgggg",
  "WWWWWWBllggggggg",
  "WWWWBBWlhggggggg",
  "BWWWWWWghggggggg",
];
const SHORE_TILE_8 = [
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggghl",
  "ggggggggggghhhll",
  "gggggggggghhWBBW",
  "ggggggggghhBllBW",
  "gggggggggghBBWBB",
  "gggggggggBlWBBWW",
  "ggggggghgWlBBWBW",
];
const SHORE_TILE_9 = [
  "WWWWWWhggggggggg",
  "WBBWWlgggggggggg",
  "WBWlllhggggggggg",
  "BWWWhhgggggggggg",
  "BWhWhhgggggggggg",
  "Wllhgggggggggggg",
  "WWhggggggggggggg",
  "hggggggggggggggg",
  "gggggggggggggggg",
  "ggggggggggggghhl",
  "gggggggggggghlWW",
  "gggggggggghhhhWB",
  "gggggggggggglBBW",
  "ggggggggghhWWBWW",
  "gggggggghlWWWWWB",
  "ggggggghhhWWWWBW",
];
const SHORE_TILE_10 = [
  "gggggggghlWWWWWW",
  "gggggggggllWWWWW",
  "ggggggggghWWWWWW",
  "ggggggghhlWWWWWW",
  "ggggggggglWWWBWW",
  "gggggggggWlWWWWW",
  "gggggggghhWWWWWW",
  "ggggggghhWWWWWWW",
  "gggggggggWWWWWBB",
  "gggggggghlWWBWWW",
  "ggggggggglBWWBWW",
  "ggggggggWlWWWWWW",
  "ggggggghWBWBBWWB",
  "ggggggggghWBBBWW",
  "ggggggggglWWWWWW",
  "ggggggghglWWBWWW",
];
const SHORE_TILE_11 = [
  "WBWWWBWWBWWWWWWW",
  "WWWWBBBWWBWWBWWB",
  "WWWWWBBWWWWWWWWW",
  "WWBWWWWBWWWWBWWW",
  "BBWWBWBWWBWWWWWB",
  "WWWWWWBWWBWWBBWB",
  "WWWWWWWWWWWWWWWW",
  "hlBBWWWWWBWWWWWB",
  "ghlWWlBWWBBWWBWW",
  "ggghglWWBWWWWWWW",
  "gggglhWWWBBWWWBB",
  "ggggghlWWWWWWWWW",
  "ggggghglBBWBWWWW",
  "ggggggggBlWBWWWW",
  "gggggggglWWWWBWW",
  "gggggggghWWWWWWW",
];
const SHORE_TILE_12 = [
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gghhghlhghlhhhhW",
  "hWlWlWhhlBWlhlll",
  "WWWWWWWWBWlWWWWW",
  "WWWWBWWWWWBBWBWW",
  "WBBWBWWWBBWWWWBW",
  "BWWWWWWWBBWBWWWW",
  "WBBWWWBWWWWWWBWW",
  "BBWWBWWWWWWWWWBW",
];
const SHORE_TILE_13 = [
  "WWWWWWWggggggggg",
  "WWWBWWWlhggggggg",
  "WWBWWWlBhghggggg",
  "WWBWWBWBWhhggggg",
  "WWWWWBBWlBhggggg",
  "WWWWBWWWBBlggggg",
  "WWBWWWBWWWlWhggg",
  "WBWWWWWWWBBlhlhg",
  "WWWWWWWWWWWWWllh",
  "WWBWWBWWWWWWWWll",
  "WWWBWBWWWWWWWWWl",
  "BBWWWWWWBBWWWWWW",
  "BBBBWWBBWWWWWWWW",
  "WWWWWWWWBBWWWWWW",
  "WWBBWBWWWWWBWWWW",
  "BBWWWWWWWWWWWWBB",
];
const SHORE_TILE_14 = [
  "gggggggghlWBWWBW",
  "ggggggghhWBWWWWW",
  "ggggghhglBWBWWWW",
  "gggggghllWWWWWBW",
  "ggggghWWWBWWWBWW",
  "gggghhhWWBWWWWWW",
  "ggggWlWBWWBWWWWB",
  "hhWhllWWBWWWWWWW",
  "hhBWWWBWBWWWBWWW",
  "lBWBWWWWBWWWWBWW",
  "WWWWWWWWWWWBWBWW",
  "BWWWWBWWWBWWWWWW",
  "BWWWBWWWWWBWWWWW",
  "WWWBWWWWBBWWWWWW",
  "WBWWWWWWWWWWWWWB",
  "WWWWWWBWWWWWWWWW",
];
const ROAD_TILE_1 = [
  "pppppPSSSggggggg",
  "pPpppmmggggggggg",
  "ppppmSgggggggggg",
  "ppPmSSgggggggggg",
  "pPpgSggggggggggg",
  "mpSSgggggggggggg",
  "pSSggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
];
const ROAD_TILE_2 = [
  "ggggggggSmpppppp",
  "gggggggggSmppPpp",
  "gggggggggSPmppPp",
  "ggggggggggSmmppp",
  "gggggggggggSSSpP",
  "gggggggggggggSmm",
  "gggggggggggggSpp",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
];
const ROAD_TILE_3 = [
  "pppppppPPpPppppP",
  "ppppPPppPppppppp",
  "ppppppPppppppppp",
  "PpppppPpppPPpppp",
  "ppppPppppppppppp",
  "ppmPmppPpmpmpPpp",
  "pPSmpppmmmmSSpmP",
  "ggSggSSSSgSSmSgS",
  "SSSgSgggSSgggggS",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
];
const ROAD_TILE_4 = [
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "Sggggggggggggggg",
  "gggggggggggggggg",
  "SSgggggggggggggg",
  "pPSgSggggggggggg",
  "pPmggggggggggggg",
  "ppppSggggggggggg",
  "ppppPSSggggggggg",
  "pPpppmSSgggggggg",
  "ppPpppmggggggggg",
];
const ROAD_TILE_5 = [
  "PPpppmSSSggggggg",
  "PpppPpPSgggggggg",
  "pppppppSSggggggg",
  "pPPpppmpgggggggg",
  "ppppppSSgggggggg",
  "pppppPpggggggggg",
  "pppppPpSgggggggg",
  "PPpppppgSggggggg",
  "pppppPPSgggggggg",
  "PpppppmSSggggggg",
  "ppppPppggggggggg",
  "PPPpppmggggggggg",
  "PpppppSggggggggg",
  "pPpPppSSgggggggg",
  "ppppppPSgggggggg",
  "PPpppppSgggggggg",
];
const ROAD_TILE_6 = [
  "gggggggSSSppppPp",
  "gggggggggSpPpppP",
  "gggggggggSmmpppp",
  "gggggggggSSmPppP",
  "gggggggggggSSSpp",
  "ggggggggggggSpmm",
  "ggggggggggggggSm",
  "gggggggggggggggg",
  "Sggggggggggggggg",
  "mSgggggggggggggg",
  "ppSSgSgggggggggg",
  "ppPSSggggggggggg",
  "ppmpmggggggggggg",
  "PPPPmSgggggggggg",
  "ppppmmpSgggggggg",
  "pPppppSSgggggggg",
];
const ROAD_TILE_7 = [
  "ppppPppppPpppPpp",
  "ppppppppPppppPPp",
  "ppPppppPpppppppp",
  "PppppppppPPppppp",
  "pppppppppPpPppPp",
  "pPppPpppppPppppp",
  "ppppppPppppppppS",
  "pPppppPPppPpmmmp",
  "ppppppppppPPpggg",
  "PpppPppppppmgggg",
  "PpPppPppmPmSSggg",
  "pPpPpPPpSggggggg",
  "pppPpppmpggSgggg",
  "ppppppPmmggggggg",
  "ppppPPpmSggggggg",
  "PppppppgSggggggg",
];
const ROAD_TILE_8 = [
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "ggggggggggggggSm",
  "gggggggggggSSSmm",
  "ggggggggggSSpPPp",
  "gggggggggSSPmmPp",
  "ggggggggggSPPpPP",
  "gggggggggPmpPPpp",
  "gggggggSgpmPPpPp",
];
const ROAD_TILE_9 = [
  "ppppppSggggggggg",
  "pPPppmgggggggggg",
  "pPpmmmSggggggggg",
  "PpppSSgggggggggg",
  "PpSpSSgggggggggg",
  "pmmSgggggggggggg",
  "ppSggggggggggggg",
  "Sggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggSSm",
  "ggggggggggggSmpp",
  "ggggggggggSSSSpP",
  "ggggggggggggmPPp",
  "gggggggggSSppPpp",
  "ggggggggSmpppppP",
  "gggggggSSSppppPp",
];
const ROAD_TILE_10 = [
  "ggggggggSmpppppp",
  "gggggggggmmppppp",
  "gggggggggSpppppp",
  "gggggggSSmpppppp",
  "gggggggggmpppPpp",
  "gggggggggpmppppp",
  "ggggggggSSpppppp",
  "gggggggSSppppppp",
  "gggggggggpppppPP",
  "ggggggggSmppPppp",
  "gggggggggmPppPpp",
  "ggggggggpmpppppp",
  "gggggggSpPpPPppP",
  "gggggggggSpPPPpp",
  "gggggggggmpppppp",
  "gggggggSgmppPppp",
];
const ROAD_TILE_11 = [
  "pPpppPppPppppppp",
  "ppppPPPppPppPppP",
  "pppppPPppppppppp",
  "ppPppppPppppPppp",
  "PPppPpPppPpppppP",
  "ppppppPppPppPPpP",
  "pppppppppppppppp",
  "SmPPpppppPpppppP",
  "gSmppmPppPPppPpp",
  "gggSgmppPppppppp",
  "ggggmSpppPPpppPP",
  "gggggSmppppppppp",
  "gggggSgmPPpPpppp",
  "ggggggggPmpPpppp",
  "ggggggggmppppPpp",
  "ggggggggSppppppp",
];
const ROAD_TILE_12 = [
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "ggSSgSmSgSmSSSSp",
  "SpmpmpSSmPpmSmmm",
  "ppppppppPpmppppp",
  "ppppPpppppPPpPpp",
  "pPPpPpppPPppppPp",
  "PpppppppPPpPpppp",
  "pPPpppPppppppPpp",
  "PPppPpppppppppPp",
];
const ROAD_TILE_13 = [
  "pppppppggggggggg",
  "pppPpppmSggggggg",
  "ppPpppmPSgSggggg",
  "ppPppPpPpSSggggg",
  "pppppPPpmPSggggg",
  "ppppPpppPPmggggg",
  "ppPpppPpppmpSggg",
  "pPpppppppPPmSmSg",
  "pppppppppppppmmS",
  "ppPppPppppppppmm",
  "pppPpPpppppppppm",
  "PPppppppPPpppppp",
  "PPPPppPPpppppppp",
  "ppppppppPPpppppp",
  "ppPPpPpppppPpppp",
  "PPppppppppppppPP",
];
const ROAD_TILE_14 = [
  "ggggggggSmpPppPp",
  "gggggggSSpPppppp",
  "gggggSSgmPpPpppp",
  "ggggggSmmpppppPp",
  "gggggSpppPpppPpp",
  "ggggSSSppPpppppp",
  "ggggpmpPppPppppP",
  "SSpSmmppPppppppp",
  "SSPpppPpPpppPppp",
  "mPpPppppPppppPpp",
  "pppppppppppPpPpp",
  "PppppPpppPpppppp",
  "PpppPpppppPppppp",
  "pppPppppPPpppppp",
  "pPpppppppppppppP",
  "ppppppPppppppppp",
];

const TALL_PALETTE = { g: 0x185137, h: 0x1a583c };
// Blades are built from quantity, not contrast: at the terrain's luma cap a
// sparse lattice disappeared and the monster zone read as a plain darker
// rectangle, losing the cue for why monsters spawn there. Each blade row is
// offset by its own index so the marks stagger instead of lining up into
// vertical corduroy, and both periods stay coprime with the 16-cell tile.
const TALL_TILE = [
  "hhghhghhghhghhgh",
  "hgghgghgghgghggh",
  "gggggggggggggggg",
  "gghgghgghgghgghg",
  "gghgghgghgghgghg",
  "gggggggggggggggg",
  "ghgghgghgghgghgg",
  "ghgghgghgghgghgg",
  "gggggggggggggggg",
  "hgghgghgghgghggh",
  "hgghgghgghgghggh",
  "gggggggggggggggg",
  "gghgghgghgghgghg",
  "gghgghgghgghgghg",
  "gggggggggggggggg",
  "ghgghgghgghgghgg",
];

// tilled farm soil: a lit ridge and a dark furrow every four rows
const SOIL_PALETTE = { s: 0x6b4a2f, h: 0x735033 };
const SOIL_TILE = [
  "hhhhhhhhhhhhhhhh",
  "ssssssssssssssss",
  "ssssssssssssssss",
  "ssssssssssssssss",
  "hhhhhhhhhhhhhhhh",
  "ssssssssssssssss",
  "ssssssssssssssss",
  "ssssssssssssssss",
  "hhhhhhhhhhhhhhhh",
  "ssssssssssssssss",
  "ssssssssssssssss",
  "ssssssssssssssss",
  "hhhhhhhhhhhhhhhh",
  "ssssssssssssssss",
  "ssssssssssssssss",
  "ssssssssssssssss",
];

const HOUSE_TILE_PALETTE = { s: 0x3d3650, d: 0x322c42 };
const HOUSE_TILE = [
  "ssssssssssssssss",
  "ssssssssssssssss",
  "ssdssssssssdssss",
  "ssssssssssssssss",
  "ssssssdsssssssss",
  "ssssssssssssssss",
  "ssdssssssssssdss",
  "ssssssssssssssss",
  "sssssssssdssssss",
  "sssssdssssssssss",
  "ssssssssssssssss",
  "sssssssssdssssss",
  "ssssssssssssssss",
  "ssdsssssssssssss",
  "sssssssssssssdss",
  "ssssssssssssssss",
];

// farm crops, drawn on the plots in the overworld: one shared sprout for the
// early stage, then a ripe texture per crop (tinted green while unripe)
const SPROUT_PALETTE = { D: 0x14532d, d: 0x15803d, l: 0x22c55e, g: 0x4ade80, h: 0x86efac };
const SPROUT_TILE = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  ".....d....d.....",
  "....dlhh..hhld..",
  ".....dlhhld.....",
  "......lggl......",
  ".......gl.......",
  ".......gl.......",
  ".......gD.......",
  "......DggD......",
  "................",
];

const CORN_PALETTE = { d: 0x14532d, s: 0x15803d, g: 0x4ade80, h: 0x86efac, o: 0xa16207, y: 0xfacc15, Y: 0xfde68a };
const CORN_TILE = [
  "................",
  ".......hs.......",
  "......hggs......",
  ".....hg..gs.....",
  "....hg.hs.gs....",
  "...hg..hs..gs...",
  ".....Yyyyyo.....",
  ".....Yoyyoo.....",
  ".....Yyooyo.....",
  ".....Yoyyoo.....",
  ".....Yyooyo.....",
  ".....yyyyoo.....",
  "....gd.gs.gd....",
  "...gd..gs..gd...",
  ".......gd.......",
  "................",
];

const BEAN_PALETTE = { D: 0x14532d, d: 0x15803d, g: 0x4ade80, h: 0x86efac, P: 0x65a30d, p: 0x84cc16, L: 0xbef264 };
const BEAN_TILE = [
  "................",
  "................",
  "......hggd......",
  ".....hggggd.....",
  "....hgg..ggd....",
  "....hg.dD.gd....",
  ".....h.dD.d.....",
  "...Lp..dD..pP...",
  "...Lp..dD..pP...",
  "...Lp..dD..pP...",
  "....p..dD..p....",
  ".......dD.......",
  "......hgdD......",
  ".......dD.......",
  "................",
  "................",
];

const HERO_PALETTE = {
  h: 0x6b4226,
  s: 0xf8c896,
  e: 0x141414,
  t: 0x3b6ef0,
  b: 0x8a5a2b,
  p: 0x2f3a56,
  o: 0x4a2f1a,
};

const HERO_HEAD = [
  "................",
  "................",
  ".....hhhhhh.....",
  "....hhhhhhhh....",
  "...hhhhhhhhhh...",
  "...hssssssssh...",
  "...hseesseesh...",
  "...hssssssssh...",
  "....hhhhhhhh....",
];
const HERO_TORSO = [".....tttttt.....", "....tttttttt....", "...ttbbbbbbtt..."];

const HERO_UP_HEAD = [
  "................",
  "................",
  ".....hhhhhh.....",
  "....hhhhhhhh....",
  "...hhhhhhhhhh...",
  "...hhhhhhhhhh...",
  "...hhhhhhhhhh...",
  "...hhhhhhhhhh...",
  "....hhhhhhhh....",
];

const HERO_SIDE_HEAD = [
  "................",
  "................",
  ".....hhhhhh.....",
  "....hhhhhhhh....",
  "...hhhhhhhhhh...",
  "...hssssssssss..",
  "...hsssssseess..",
  "...hssssssssss..",
  "....hhhhhhhh....",
];

const HERO_LEGS_STRIDE_A = ["..s..pp..pp..s..", "...spp....pps...", "....ooo..ooo....", "................"];
const HERO_LEGS_PASS_A = ["..s..pppppp..s..", "...spppppppps...", "....oooooooo....", "................"];
const HERO_LEGS_STRIDE_B = ["..s..pp..pp..s..", "....ppp..ppp....", "....ooo..ooo....", "................"];
const HERO_LEGS_PASS_B = ["....pppppppp....", "...spppppppps...", "....oooooooo....", "................"];
const HERO_LEGS_IDLE = ["..s..pppppp..s..", "..s..pppppp..s..", "..oo.oooooo.oo..", "................"];

const EQUIP_SWORD_PALETTE = { w: 0xd1d5db, d: 0x64748b, g: 0xf59e0b, b: 0x6b4226 };
const EQUIP_SWORD_TILE = [
  "................",
  "................",
  "................",
  ".....wwww.......",
  ".....wwww.......",
  ".....wwww.......",
  ".....wwww.......",
  ".....wwww.......",
  ".....wwww.......",
  ".....wwww.......",
  ".....wwww.......",
  ".....wwww.......",
  ".....gggg.......",
  ".....bbbb.......",
  ".....bb.........",
  "................",
];

const EQUIP_SHIELD_PALETTE = { s: 0x94a3b8, S: 0x64748b, d: 0x475569 };
const EQUIP_SHIELD_TILE = [
  "................",
  "................",
  "................",
  "................",
  "....ssssssss....",
  "...ssssssssss...",
  "...sSSSSSSSSs...",
  "...sSSddddSSs...",
  "...sSSddddSSs...",
  "...sSSSSSSSSs...",
  "...ssssssssss...",
  "....ssssssss....",
  "................",
  "................",
  "................",
  "................",
];

const EQUIP_IRON_SWORD_PALETTE = { w: 0xe2e8f0, d: 0x334155, g: 0x60a5fa, b: 0x1e3a8a };
const EQUIP_IRON_SHIELD_PALETTE = { s: 0x60a5fa, S: 0x3b82f6, d: 0x1e3a8a };
const EQUIP_MYTHRIL_SWORD_PALETTE = { w: 0xe0f2fe, d: 0x38bdf8, g: 0xa5f3fc, b: 0x1e3a8a };
const EQUIP_MYTHRIL_SHIELD_PALETTE = { s: 0x7dd3fc, S: 0x38bdf8, d: 0x0ea5e9 };

const NPC_PALETTE = {
  h: 0xf59e0b,
  s: 0xf8c896,
  e: 0x141414,
  b: 0xe5e7eb,
  r: 0x7c3aed,
  R: 0x6d28d9,
  v: 0x0a0a18,
  x: 0x48248c,
  z: 0xa171f2,
  q: 0xc5a8f7,
  u: 0xad710f,
  j: 0xfad08a,
  n: 0xe2d4fb,
};
const NPC_TILE = [
  "................",
  ".....hhjjjj.....",
  "....hhhhhjjh....",
  "...hhhhhhhhjh...",
  "...jssssssssu...",
  "...jseesseesu...",
  "...jbbbbbbbbu...",
  "....rznnzzrx....",
  "...rznzzzrrxv...",
  "...rrzzzrrrxv...",
  "...rrbbbbbbbxv..",
  "...xrrrrxxxvv...",
  "....xxxxvvvv....",
  "....xvvv..vv....",
  "................",
  "................",
];

// Both slime palettes walk the same 6 chars (outline / shadow / base ramp /
// specular) so the one grid can be recoloured into the king slime.
const SLIME_PALETTE = { o: 0x11543c, s: 0x1c8a5e, g: 0x2fbd70, m: 0x4ade80, h: 0x86eb9c, w: 0xd6fadf };
const KING_SLIME_PALETTE = { o: 0x631028, s: 0x99182f, g: 0xcf2130, m: 0xef4444, h: 0xf98a72, w: 0xfde3cf };
const SLIME_TILE = [
  "................",
  "................",
  "................",
  "......oooo......",
  "....oohhhhoo....",
  "...owwwhhhhmo...",
  "..owwwwhhhmmmo..",
  "..ohwwhhhhmmgo..",
  "..hhwohhhmwogs..",
  ".ohhoohhmmoogso.",
  ".ohhhmmmmmggsso.",
  "..mmmmmmgggsss..",
  "..ommgoggossso..",
  "...ogggoossso...",
  "....osssssso....",
  ".....oooooo.....",
];

const GOBLIN_PALETTE = {
  s: 0x86efac,
  S: 0x5bb97e,
  e: 0xff5555,
  h: 0x4ade80,
  r: 0x8b5a2b,
  v: 0x4b8366,
  x: 0x6cbe8c,
  z: 0xbbf6d1,
  q: 0xf1fdf5,
  u: 0xe4fbed,
};
const TROLL_PALETTE = {
  s: 0x4d5d4d,
  S: 0x2f3a2f,
  e: 0xffd166,
  h: 0x1f2e1f,
  r: 0x7c2d12,
  v: 0x0a0a18,
  x: 0x2e3735,
  z: 0x808b80,
  q: 0xb3b9b3,
  u: 0xd8dbd8,
};
const GOBLIN_TILE = [
  "................",
  "................",
  ".....hh..hh.....",
  "....huqzzzzsh...",
  "...hquuzzqzzh...",
  "...hqSqeezSsh...",
  "...hqqqqzzzsh...",
  "....hzzzzzsh....",
  "....szzzzzsx....",
  "...szzzzsssxv...",
  "...ssrrrrrrxv...",
  "...ssrrrrrrvv...",
  "....xxxvvvvv....",
  "....xv....vv....",
  "................",
  "................",
];

const WOLF_PALETTE = {
  g: 0x94a3b8,
  G: 0x64748b,
  d: 0x475569,
  e: 0xef4444,
  n: 0x334155,
  v: 0x3d4253,
  x: 0x6d778a,
  z: 0xc7cfda,
  q: 0xf9fafb,
  u: 0x282f40,
  j: 0x7f8997,
  a: 0xe7ebef,
};
const WOLF_TILE = [
  "................",
  "..qq.......gg...",
  "..qaz.....gzg...",
  "..qaazzzggzzgg..",
  "..zqGGGGGGGGgx..",
  ".zqGddddjjjjGgx.",
  ".zqGdddjjjjjGgx.",
  ".zzGdjeeejjGxx..",
  ".zzGjjeeejdGxv..",
  "..gzGjjjdddGxv..",
  "..ggGGGGGGGGxv..",
  "..ggxxgggxvvxv..",
  "..xx..xxxv..vv..",
  "..xx..vvvv..vv..",
  "................",
  "................",
];

const WISP_PALETTE = { k: 0x082f49, d: 0x0c4a6e, c: 0x1d7fb8, C: 0x38bdf8, l: 0x8fd7fa, w: 0xe8f7ff };
const WISP_TILE = [
  ".....kkkkk......",
  "...kkddddddk....",
  "..kddcccccddk...",
  "..ddccCCCCccdk..",
  ".kdcCClllCCcdd..",
  ".ddcCllwwlCCcdk.",
  ".dccCkkwwkkCcdk.",
  ".dccCkkwwkkCcdk.",
  ".kdcCllwllCccdk.",
  ".kdccCCllCCcdk..",
  "..kdccCCCccddk..",
  "..kkddccccddk...",
  "....kdddddkk....",
  "......kkk.......",
  ".......cc.......",
  ".......dd.......",
];

const FROST_MOTH_PALETTE = {
  w: 0xe0f2fe,
  W: 0xbae6fd,
  b: 0x38bdf8,
  d: 0x0369a1,
  e: 0xef4444,
  v: 0x1c4f6e,
  x: 0x2b8bba,
  z: 0x96dcfb,
  q: 0xf4fbff,
  u: 0x92b5ca,
  j: 0xdaf2fe,
  n: 0xd3f0fd,
};
const FROST_MOTH_TILE = [
  "................",
  "..ww........ww..",
  ".wWWw......wjWw.",
  ".wWWWzzbbbbWjWw.",
  ".wWWWjzzzzWjjWw.",
  "..wjWWnneezjWWw.",
  "..wjWWnzzzjWuw..",
  "...wjzzzzzbuw...",
  "...wjzdzdbdxW...",
  "....wbzbbbbxw...",
  "....wbdbdbdv....",
  ".....wxbbxv.....",
  "......wxxv......",
  ".......wv.......",
  "................",
  "................",
];

const YETI_PALETTE = {
  f: 0xf1f5f9,
  F: 0xcbd5e1,
  s: 0x93c5fd,
  e: 0x1e3a8a,
  m: 0x64748b,
  v: 0x93959d,
  x: 0xc7cad0,
  z: 0xf5f8fb,
  q: 0xf8fafc,
  u: 0x9da5b1,
  j: 0xe4e9f0,
  n: 0xfcfdfe,
};
const YETI_TILE = [
  "................",
  "................",
  "....qzzzzzzf....",
  "...qnqqFjjjjFf..",
  "..qnnFssssssFfx.",
  "..zqFsssssssjfx.",
  "..zqFseessejfx..",
  "..zzFssssssjfx..",
  "..zzFsmmmmsFxx..",
  "..fzzzzzzzffxv..",
  ".fzzzzzzfffffxv.",
  ".fzjjFFFFuuFuxv.",
  ".ffjFuuuuFFuxvv.",
  "..xfx..vv..vvv..",
  "..xxx..vv..vvv..",
  "................",
];

const ICE_GOLEM_PALETTE = {
  i: 0xa5f3fc,
  I: 0x67e8f9,
  c: 0x22d3ee,
  d: 0x0e7490,
  k: 0x334155,
  e: 0xffffff,
  v: 0x618d98,
  x: 0x86c5cf,
  z: 0xcaf8fd,
  q: 0xeffdfe,
  u: 0x1e2536,
  j: 0x6b7583,
  n: 0xebfcfe,
};
const ICE_GOLEM_TILE = [
  "................",
  ".....qqzzzz.....",
  "....qInqqzIi....",
  "....zIeeeeIi....",
  "....zqnqqqzi....",
  "...jqIqqqzIiu...",
  "..jknIcqzcIzku..",
  ".j.jzIczzcIiu.k.",
  ".jj.iIIIIIIx.kk.",
  ".kk.iiIddIxx.kk.",
  ".k.kizzddiixk.k.",
  "....uiixxiixk...",
  "....uixIIxxvk...",
  "....uxI..Ivk....",
  "....uvv..vvk....",
  "................",
];
const BAT_PALETTE = {
  b: 0x7c3aed,
  B: 0x5b21b6,
  d: 0x3b0764,
  w: 0xffffff,
  e: 0xf87171,
  v: 0x0a0a18,
  x: 0x48248c,
  z: 0xa171f2,
  q: 0xc5a8f7,
  u: 0x321565,
  j: 0x865bc9,
  n: 0xe2d4fb,
};
const BAT_TILE = [
  "nq............bb",
  "nqzz........bxbz",
  "qnqqzzbbbbbbbbzb",
  "zBBBjjjjjBBBjBBx",
  ".zjddddddddddBx.",
  ".zjdwwwwwwwwduv.",
  ".bjdweeeeeewduv.",
  ".bjdwwwwwwwwduv.",
  "..bBdddddddduv..",
  "...xxxxxxvvvv...",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
];

const WASP_PALETTE = {
  y: 0xffdd44,
  Y: 0xe8a20c,
  k: 0x141414,
  e: 0x141414,
  w: 0xc7d4ee,
  v: 0x8e7c30,
  x: 0xccb13b,
  z: 0xffec95,
  q: 0xfffbe6,
  u: 0xfff8d6,
};
const WASP_TILE = [
  "................",
  "................",
  "................",
  ".....qqzzzz.....",
  "....quuqzzzy....",
  "....zekkqeky....",
  "....zquqqzyx....",
  "....zzqqzzyx....",
  ".ww.yzzzzzyx.ww.",
  ".ww.yzzzzyyx.ww.",
  "...ykkkkkkkkv...",
  "...ykYYYYYYkv...",
  "...xkkkkkkkkv...",
  "....xYYYYYYv....",
  ".....v....v.....",
  "................",
];

const SPIDER_PALETTE = {
  b: 0x7c3aed,
  B: 0x5b21b6,
  d: 0x3b0764,
  e: 0xef4444,
  E: 0xb91c1c,
  v: 0x0a0a18,
  x: 0x36166d,
  z: 0x8256c7,
  q: 0xa98bd9,
  u: 0x422281,
  j: 0xa477f3,
  n: 0xdbceef,
};
const SPIDER_TILE = [
  "................",
  "...bb......bb...",
  "..bbbj....bjjb..",
  "..bbbz....Bjbu..",
  "..jbnqjbbbzzbu..",
  "..jqnnzzzBzzBu..",
  "..jzqeqzzzzeBu..",
  "..jzqzddddBBxb..",
  "...BzzzzzBBxv...",
  "...bBzzzBBBxb...",
  "....xBBBBBxv....",
  "....uBBBBBxb....",
  ".....xxBBxv.....",
  "......vxxv......",
  ".......vv.......",
  "................",
];

const ORC_PALETTE = {
  s: 0x4ade80,
  S: 0x2d9d5c,
  e: 0xff5555,
  h: 0x3b7d4a,
  r: 0x8b5a2b,
  t: 0xd1d5db,
  v: 0x276947,
  x: 0x3aaa66,
  z: 0x9eedbb,
  q: 0xf2fdf6,
  u: 0x234431,
  j: 0x80ab8a,
  n: 0xd7f8e3,
};
const ORC_TILE = [
  "................",
  "................",
  ".....hhjjjj.....",
  "....hhhhhjjh....",
  "...hhhhhhhhjh...",
  "...jhnnqqqzsu...",
  "...jqnqezzesu...",
  "....jzqzzzsu....",
  "....hzzzzzsu....",
  "...hzzzzzssxvh..",
  "...hstzzssstxh..",
  "...hszzssssxxh..",
  "...uhssrrxxvhh..",
  "....xxrrrrvv....",
  "....xv....vv....",
  "................",
];

const MOSS_GOLEM_PALETTE = {
  s: 0x7d8f7d,
  S: 0x5c6f5c,
  e: 0x8ce99a,
  h: 0x4a5a4a,
  r: 0x2f3a2f,
  v: 0x272b31,
  x: 0x56625b,
  z: 0xb2bcb2,
  q: 0xe6eae6,
  u: 0xe2e6e2,
};

const SPARK_PALETTE = { y: 0xffdd44 };
// The cross sat at x=2 with its vertical arm stopping a row short, so its mass
// centre was well up and left of the texture centre. Particles scale about the
// texture centre, so the scale tween made the spark slide as it shrank. Both
// arms now run the full span and cross at x=3 / y=3. An even 8-cell grid with
// 1px arms cannot centre exactly -- 3 vs a true centre of 3.5 -- so a small
// residual remains; 2px arms would zero it at the cost of a chunkier spark.
const SPARK_TILE = ["...y....", "...y....", "...y....", "yyyyyyyy", "...y....", "...y....", "...y....", "...y...."];

const GLOW_PALETTE = { g: 0x8ecbff, w: 0xffffff };
const GLOW_TILE = [
  "................",
  "......gggg......",
  "....ggwwwwgg....",
  "...ggwwwwwwgg...",
  "..ggwwwwwwwwgg..",
  "..gwwwwwwwwwwg..",
  ".gwwwwwwwwwwwwg.",
  ".gwwwwwwwwwwwwg.",
  ".gwwwwwwwwwwwwg.",
  ".gwwwwwwwwwwwwg.",
  "..gwwwwwwwwwwg..",
  "..ggwwwwwwwwgg..",
  "...ggwwwwwwgg...",
  "....ggwwwwgg....",
  "......gggg......",
  "................",
];

const COIN_PALETTE = { o: 0x5c3a14, d: 0x9c6a1e, y: 0xd19b34, Y: 0xffd166, L: 0xffeba6, W: 0xfffbe6 };
const COIN_TILE = [
  "................",
  "....oooooooo....",
  "...ooLLLLLLoo...",
  "..oLLWYYYYLYYo..",
  ".ooLWWWLLLyyYoo.",
  ".oLWWWWWLLYyyyo.",
  ".oLYWWWLLYYYdyo.",
  ".oLYLWLLLYYyddo.",
  ".oLYLLLYYYyyddo.",
  ".oYyYYYYYyyyddo.",
  ".oYYyYYyyyydddo.",
  ".ooYddyyyddddoo.",
  "..oyyydddddddo..",
  "...ooddddddoo...",
  "....oooooooo....",
  "................",
];

// Fireflies render with ADD blend, which adds these RGB values to whatever is
// under them -- so what matters is the total light the sprite adds, not how
// bright its brightest pixel is. The old 8x8 flat dot barely registered
// (measured scene mean luminance 56.19 -> 56.26 with ADD switched on). This is
// the same peak spread over a falloff halo: ~3x the light added, hottest pixel
// unchanged, so the 200 luminance ceiling still has headroom.
const FIREFLY_PALETTE = { c: 0xe9fa96, b: 0x909b5d, m: 0x545a36, d: 0x2a2d1b, e: 0x10120b };
const FIREFLY_TILE = [
  "............",
  "...eeeeee...",
  "..eeddddee..",
  ".eedmmmmdee.",
  ".edmbbbbmde.",
  ".edmbccbmde.",
  ".edmbccbmde.",
  ".edmbbbbmde.",
  ".eedmmmmdee.",
  "..eeddddee..",
  "...eeeeee...",
  "............",
];

const CHEST_PALETTE = { b: 0x2b1a0c, d: 0x4a2f1a, w: 0x8a5a2b, W: 0xa9743a, L: 0xd1a455, H: 0xf0d79a, Y: 0xffd166 };
const CHEST_TILE = [
  "................",
  "................",
  "...bbbbbbbbbb...",
  "..bWWWWWWwwwwb..",
  ".bWWWWWWwwwwwwb.",
  ".bWWWWwwwwwwwdb.",
  ".bHLLLLLLLLLLdb.",
  ".bWWwwwwwwwwwdb.",
  ".bWwwwLLLLwwwdb.",
  ".bWwwwLHHLwwwdb.",
  ".bWwwwLLLLwwwdb.",
  ".bWwwwwwwwwwddb.",
  "..bbbbbbbbbbbb..",
  "...bb......bb...",
  "................",
  "................",
];
const CHEST_OPEN_TILE = [
  "................",
  "..bbbbbbbbbbbb..",
  ".bWWWWWWwwwwwwb.",
  ".bLLLLLLLLLLLLb.",
  "................",
  "..bbbbbbbbbbbb..",
  ".bWHHYYYYYYYYdb.",
  ".bWHYYYYYYYYYdb.",
  ".bWYYYYYYYYYYdb.",
  ".bWYYYYYYYYYddb.",
  ".bWwwwwwwwwwddb.",
  ".bWwwwwwwwwwddb.",
  "..bbbbbbbbbbbb..",
  "...bb......bb...",
  "................",
  "................",
];

function makeCave(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.fillStyle(0x2a2a3a, 1);
  g.fillRect(0, 0, 128, 128);
  g.fillStyle(0x3d3650, 1);
  g.fillRect(0, 0, 128, 12);
  g.fillRect(0, 0, 12, 128);
  g.fillRect(116, 0, 12, 128);
  g.fillStyle(0x141418, 1);
  g.fillTriangle(16, 12, 64, 80, 112, 12);
  g.fillRect(20, 12, 88, 80);
  g.fillStyle(0x0b0b0e, 1);
  g.fillRect(20, 60, 88, 68);
  g.generateTexture("cave", 128, 128);
  g.destroy();
}

function makeSign(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.fillStyle(0x4a2f1a, 1);
  g.fillRect(24, 36, 16, 28);
  g.fillStyle(0x8a5a2b, 1);
  g.fillRect(4, 4, 56, 32);
  g.fillStyle(0x6d4a1f, 1);
  g.fillRect(4, 4, 56, 4);
  g.fillStyle(0x2a1f2e, 1);
  g.fillRect(28, 12, 8, 16);
  g.fillRect(28, 32, 8, 4);
  g.generateTexture("sign", 64, 64);
  g.destroy();
}

function makeHouse(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.fillStyle(0x8a2b3a, 1);
  g.fillRect(0, 24, 128, 32);
  g.fillStyle(0x6d2130, 1);
  g.fillRect(0, 24, 128, 8);
  g.fillStyle(0x453a52, 1);
  g.fillRect(4, 56, 120, 72);
  g.fillStyle(0x382e44, 1);
  g.fillRect(4, 56, 120, 8);
  g.fillStyle(0x2a1f2e, 1);
  g.fillRect(48, 80, 32, 48);
  g.fillStyle(0x171019, 1);
  g.fillRect(60, 100, 8, 28);
  g.fillStyle(0xffd672, 1);
  g.fillRect(16, 60, 24, 24);
  g.fillStyle(0xffd672, 0.3);
  g.fillRect(12, 56, 32, 32);
  g.fillStyle(0xffd672, 1);
  g.fillRect(88, 60, 24, 24);
  g.fillStyle(0xffd672, 0.3);
  g.fillRect(84, 56, 32, 32);
  g.generateTexture("house", 128, 128);
  g.destroy();
}

function makeBattleBg(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.fillStyle(0x0133a9, 1);
  g.fillRect(0, 0, GAME_WIDTH, 240);
  g.fillStyle(0x0a38b8, 1);
  g.fillRect(0, 240, GAME_WIDTH, 160);
  g.fillStyle(0xe8eaf8, 0.18);
  g.fillCircle(240, 176, 160);
  g.fillStyle(0xf6f6ff, 0.4);
  g.fillCircle(240, 176, 72);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(240, 176, 32);
  for (let i = 0; i < 30; i++) {
    g.fillStyle(0xffffff, Math.random() * 0.7 + 0.2);
    g.fillRect(Math.floor(Math.random() * GAME_WIDTH), Math.floor(Math.random() * 200), 4, 4);
  }
  g.fillStyle(0x261973, 1);
  g.fillTriangle(0, 440, 240, 240, 480, 440);
  g.fillTriangle(280, 440, 640, 160, 1000, 440);
  g.fillTriangle(800, 440, 1160, 260, 1280, 440);
  g.fillStyle(0x1a1240, 1);
  g.fillRect(0, 440, GAME_WIDTH, GAME_HEIGHT - 440);
  g.fillStyle(0x372a52, 1);
  g.fillRect(0, 440, GAME_WIDTH, 16);
  g.fillStyle(0x1f5c42, 1);
  g.fillRect(0, 456, GAME_WIDTH, 24);
  g.generateTexture("battle-bg", GAME_WIDTH, GAME_HEIGHT);
  g.destroy();
}

function makeTitleBg(scene: Phaser.Scene): void {
  const g = scene.add.graphics();

  // twilight sky: indigo night melting into a violet-pink horizon
  const SKY_BANDS: Array<[number, number]> = [
    [0x120b33, 150],
    [0x1d1247, 130],
    [0x2c1a63, 110],
    [0x45247c, 90],
    [0x6c3091, 70],
    [0x94489b, 50],
  ];
  let skyY = 0;
  for (const [color, h] of SKY_BANDS) {
    g.fillStyle(color, 1);
    g.fillRect(0, skyY, GAME_WIDTH, h);
    skyY += h;
  }

  g.fillStyle(0xc86bd9, 0.1);
  g.fillEllipse(260, 190, 420, 110);
  g.fillEllipse(860, 110, 360, 90);
  g.fillStyle(0x64d9e8, 0.08);
  g.fillEllipse(580, 250, 480, 100);

  for (let i = 0; i < 90; i++) {
    g.fillStyle(0xffffff, Math.random() * 0.75 + 0.15);
    g.fillRect(Math.floor(Math.random() * GAME_WIDTH), Math.floor(Math.random() * 420), 4, 4);
  }
  const crossStar = (x: number, y: number, s: number, a: number): void => {
    g.fillStyle(0xffffff, a);
    g.fillRect(x - s, y - 2, s * 2, 4);
    g.fillRect(x - 2, y - s, 4, s * 2);
  };
  crossStar(180, 90, 14, 0.9);
  crossStar(520, 60, 10, 0.8);
  crossStar(1180, 70, 12, 0.85);
  crossStar(700, 160, 8, 0.7);

  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(820, 84, 3);
  g.fillStyle(0xffffff, 0.45);
  g.fillCircle(800, 92, 2);
  g.fillStyle(0xffffff, 0.25);
  g.fillCircle(782, 99, 2);
  g.fillStyle(0xffffff, 0.12);
  g.fillCircle(766, 106, 2);

  g.fillStyle(0xfff3c4, 0.07);
  g.fillCircle(150, 100, 80);
  g.fillStyle(0xfff3c4, 0.12);
  g.fillCircle(150, 100, 64);
  g.fillStyle(0xffedb0, 0.35);
  g.fillCircle(150, 100, 52);
  g.fillStyle(0xfdf0c2, 1);
  g.fillCircle(150, 100, 40);
  g.fillStyle(0xe8d79a, 1);
  g.fillCircle(136, 86, 7);
  g.fillCircle(163, 110, 5);
  g.fillCircle(146, 118, 4);

  g.fillStyle(0x241a4a, 1);
  g.fillTriangle(-120, 600, 200, 400, 520, 600);
  g.fillTriangle(340, 600, 700, 370, 1060, 600);
  g.fillTriangle(880, 600, 1160, 430, 1400, 600);
  g.fillStyle(0x1c1440, 1);
  g.fillTriangle(-60, 600, 320, 470, 700, 600);
  g.fillTriangle(560, 600, 940, 450, 1320, 600);

  const island = (x: number, y: number, w: number): void => {
    g.fillStyle(0x7ef9ff, 0.06);
    g.fillEllipse(x, y + 26, w * 1.5, 40);
    g.fillStyle(0x3a2a55, 1);
    g.fillTriangle(x - w / 2, y, x + w / 2, y, x, y + w * 0.42);
    g.fillStyle(0x241a3e, 1);
    g.fillTriangle(x - w * 0.18, y + 8, x + w * 0.3, y + 6, x + w * 0.05, y + w * 0.34);
    g.fillRect(x - w * 0.22, y + 14, 3, 22);
    g.fillRect(x + w * 0.1, y + 18, 3, 16);
    g.fillRect(x + w * 0.26, y + 10, 3, 12);
    g.fillStyle(0x1f6b46, 1);
    g.fillEllipse(x, y, w, 26);
    g.fillStyle(0x2a8a5a, 1);
    g.fillEllipse(x, y - 4, w * 0.82, 16);
  };

  island(230, 320, 200);
  g.fillStyle(0x0f3d24, 1);
  g.fillTriangle(212, 308, 228, 272, 244, 308);
  g.fillRect(225, 306, 6, 10);

  island(330, 450, 100);
  g.fillStyle(0x67e8f9, 1);
  g.fillTriangle(318, 438, 330, 406, 342, 438);
  g.fillStyle(0xa5f3fc, 0.8);
  g.fillTriangle(324, 438, 330, 416, 336, 438);

  const STONE = 0x191238;
  const ROOF = 0x3d1d5c;
  g.fillStyle(0x141033, 1);
  g.fillEllipse(1020, 620, 460, 90);
  g.fillStyle(STONE, 1);
  g.fillRect(940, 500, 160, 110);
  g.fillRect(908, 520, 40, 90);
  g.fillRect(1092, 520, 40, 90);
  g.fillRect(986, 430, 68, 80);
  for (let i = 0; i < 5; i++) g.fillRect(944 + i * 32, 492, 16, 10);
  g.fillStyle(ROOF, 1);
  g.fillTriangle(900, 520, 928, 484, 956, 520);
  g.fillTriangle(1084, 520, 1112, 484, 1140, 520);
  g.fillTriangle(978, 430, 1020, 372, 1062, 430);
  g.fillStyle(0x7ef9ff, 0.25);
  g.fillCircle(1020, 360, 22);
  g.fillStyle(0x7ef9ff, 0.5);
  g.fillCircle(1020, 360, 13);
  g.fillStyle(0xd9fbff, 1);
  g.fillCircle(1020, 360, 7);
  const win = (x: number, y: number): void => {
    g.fillStyle(0xffd166, 0.25);
    g.fillRect(x - 2, y - 2, 12, 16);
    g.fillStyle(0xffd166, 1);
    g.fillRect(x, y, 8, 12);
  };
  win(964, 530);
  win(1000, 530);
  win(1036, 530);
  win(964, 566);
  win(1036, 566);
  win(918, 544);
  win(1108, 544);
  win(1010, 452);
  win(1010, 482);
  g.fillStyle(0x0b0820, 1);
  g.fillRect(1000, 574, 40, 36);

  g.fillStyle(0x12331f, 1);
  g.fillRect(0, 600, GAME_WIDTH, 120);
  g.fillStyle(0x0c2718, 1);
  g.fillRect(0, 668, GAME_WIDTH, 52);
  g.fillStyle(0x1a4a2c, 0.6);
  g.fillRect(120, 620, 180, 6);
  g.fillRect(420, 640, 220, 6);
  g.fillRect(760, 616, 160, 6);
  g.fillRect(1040, 644, 180, 6);

  const pine = (x: number, base: number, h: number): void => {
    g.fillStyle(0x081b12, 1);
    g.fillTriangle(x - h * 0.32, base, x, base - h, x + h * 0.32, base);
    g.fillTriangle(x - h * 0.24, base - h * 0.45, x, base - h * 1.35, x + h * 0.24, base - h * 0.45);
    g.fillRect(x - 3, base - 6, 6, 10);
  };
  pine(80, 640, 90);
  pine(150, 660, 120);
  pine(230, 645, 80);
  pine(310, 668, 100);
  pine(1210, 655, 95);
  pine(1265, 640, 75);

  for (let i = 0; i < 26; i++) {
    const fx = Math.floor(Math.random() * GAME_WIDTH);
    const fy = 560 + Math.floor(Math.random() * 130);
    g.fillStyle(0xffe066, 0.12);
    g.fillCircle(fx, fy, 8);
    g.fillStyle(0xffe066, Math.random() * 0.5 + 0.3);
    g.fillRect(fx - 2, fy - 2, 4, 4);
  }

  const sparkle = (x: number, y: number, c: number, a: number): void => {
    g.fillStyle(c, a);
    g.fillRect(x - 2, y - 6, 4, 12);
    g.fillRect(x - 6, y - 2, 12, 4);
  };
  sparkle(560, 500, 0x7ef9ff, 0.5);
  sparkle(660, 460, 0xffd166, 0.4);
  sparkle(760, 520, 0x7ef9ff, 0.35);
  sparkle(470, 540, 0xd9fbff, 0.3);
  sparkle(1130, 470, 0x7ef9ff, 0.45);
  sparkle(360, 480, 0xffd166, 0.35);

  g.fillStyle(0x7ef9ff, 0.12);
  g.fillEllipse(110, 690, 220, 60);
  g.fillStyle(0x67e8f9, 1);
  g.fillTriangle(60, 712, 90, 640, 120, 712);
  g.fillTriangle(110, 712, 135, 664, 160, 712);
  g.fillStyle(0xa5f3fc, 0.8);
  g.fillTriangle(78, 712, 90, 662, 102, 712);

  g.generateTexture("title-bg", GAME_WIDTH, GAME_HEIGHT);
  g.destroy();
}

// Interchangeable tile indices for one terrain, so callers never hardcode the
// numbers. Same-position entries of waterA/waterB are the two animation frames
// of one ripple layout: index i of waterA must be swapped with index i of
// waterB.
export const TILE_VARIANTS = {
  grass: [0, 8, 9, 10],
  waterA: [1, 11, 12, 13],
  waterB: [2, 14, 15, 16],
  path: [4, 17, 18, 19],
} as const;

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    this.buildTextures();
    this.scene.start("Title");
  }

  private buildTextures(): void {
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

    const flipRows = (rows: string[]): string[] => rows.map((r) => [...r].reverse().join(""));

    const walkFrames = [HERO_LEGS_STRIDE_A, HERO_LEGS_PASS_A, HERO_LEGS_STRIDE_B, HERO_LEGS_PASS_B];
    for (let i = 0; i < walkFrames.length; i++) {
      const legs = walkFrames[i];
      makeTexture(this, `hero-down-${i}`, [...HERO_HEAD, ...HERO_TORSO, ...legs], HERO_PALETTE);
      makeTexture(this, `hero-up-${i}`, [...HERO_UP_HEAD, ...HERO_TORSO, ...legs], HERO_PALETTE);
      makeTexture(this, `hero-right-${i}`, [...HERO_SIDE_HEAD, ...HERO_TORSO, ...legs], HERO_PALETTE);
      makeTexture(this, `hero-left-${i}`, [...flipRows(HERO_SIDE_HEAD), ...HERO_TORSO, ...legs], HERO_PALETTE);
    }

    makeTexture(this, "hero-idle-down", [...HERO_HEAD, ...HERO_TORSO, ...HERO_LEGS_IDLE], HERO_PALETTE);
    makeTexture(this, "hero-idle-up", [...HERO_UP_HEAD, ...HERO_TORSO, ...HERO_LEGS_IDLE], HERO_PALETTE);
    makeTexture(this, "hero-idle-right", [...HERO_SIDE_HEAD, ...HERO_TORSO, ...HERO_LEGS_IDLE], HERO_PALETTE);
    makeTexture(this, "hero-idle-left", [...flipRows(HERO_SIDE_HEAD), ...HERO_TORSO, ...HERO_LEGS_IDLE], HERO_PALETTE);

    makeTexture(this, "equip-sword", EQUIP_SWORD_TILE, EQUIP_SWORD_PALETTE);
    makeTexture(this, "equip-shield", EQUIP_SHIELD_TILE, EQUIP_SHIELD_PALETTE);
    makeTexture(this, "equip-iron-sword", EQUIP_SWORD_TILE, EQUIP_IRON_SWORD_PALETTE);
    makeTexture(this, "equip-iron-shield", EQUIP_SHIELD_TILE, EQUIP_IRON_SHIELD_PALETTE);
    makeTexture(this, "equip-mythril-sword", EQUIP_SWORD_TILE, EQUIP_MYTHRIL_SWORD_PALETTE);
    makeTexture(this, "equip-mythril-shield", EQUIP_SHIELD_TILE, EQUIP_MYTHRIL_SHIELD_PALETTE);

    makeTexture(this, "npc", NPC_TILE, NPC_PALETTE);
    makeTexture(this, "slime", SLIME_TILE, SLIME_PALETTE);
    makeTexture(this, "king", SLIME_TILE, KING_SLIME_PALETTE);
    makeTexture(this, "goblin", GOBLIN_TILE, GOBLIN_PALETTE);
    makeTexture(this, "troll", GOBLIN_TILE, TROLL_PALETTE);
    makeTexture(this, "mossGolem", GOBLIN_TILE, MOSS_GOLEM_PALETTE);
    makeTexture(this, "wolf", WOLF_TILE, WOLF_PALETTE);
    makeTexture(this, "bat", BAT_TILE, BAT_PALETTE);
    makeTexture(this, "wasp", WASP_TILE, WASP_PALETTE);
    makeTexture(this, "spider", SPIDER_TILE, SPIDER_PALETTE);
    makeTexture(this, "orc", ORC_TILE, ORC_PALETTE);
    makeTexture(this, "wisp", WISP_TILE, WISP_PALETTE);
    makeTexture(this, "frostMoth", FROST_MOTH_TILE, FROST_MOTH_PALETTE);
    makeTexture(this, "yeti", YETI_TILE, YETI_PALETTE);
    makeTexture(this, "iceGolem", ICE_GOLEM_TILE, ICE_GOLEM_PALETTE);

    makeTexture(this, "dust", ["dd", "dd"], { d: 0xcbbfa8 });
    makeTexture(this, "spark", SPARK_TILE, SPARK_PALETTE);
    makeTexture(this, "glow", GLOW_TILE, GLOW_PALETTE);
    makeTexture(this, "coin", COIN_TILE, COIN_PALETTE);
    makeTexture(this, "firefly", FIREFLY_TILE, FIREFLY_PALETTE);
    makeTexture(this, "snowflake", ["ww", "ww"], { w: 0xffffff });
    makeTexture(this, "leaf", ["gd", "dg"], { g: 0x4ade80, d: 0x15803d });
    makeTexture(this, "crop-sprout", SPROUT_TILE, SPROUT_PALETTE);
    makeTexture(this, "crop-corn", CORN_TILE, CORN_PALETTE);
    makeTexture(this, "crop-bean", BEAN_TILE, BEAN_PALETTE);
    makeTexture(this, "chest", CHEST_TILE, CHEST_PALETTE);
    makeTexture(this, "chest-open", CHEST_OPEN_TILE, CHEST_PALETTE);

    makeHouse(this);
    makeSign(this);
    makeCave(this);
    makeBattleBg(this);
    makeTitleBg(this);
  }
}
