import Phaser from "phaser";
import { makeBattleBgs, makeTitleBg } from "../backdrops";
import { ART_PX, buildRamp, keepBlocky, makeTexture, makeTilesetTexture, smoothBoundaryOnly } from "../pixelart";
import type { TileSkin } from "../sceneCommon";
import { type Season, seasonLook, seasonToday } from "../season";
import { bakeCraftedGear } from "../ui/Blacksmith";

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

// The tree is an OBJECT tile: everything that is not the tree itself is '.',
// which drawRows skips, so the tile is a cropped tree and whatever terrain the
// object layer sits on shows through. It used to be painted onto a copy of the
// grass speckle pattern, which only looked right over grass -- the moment the
// same tile landed on a road or a tilled plot it dragged a square of lawn with
// it. b outlines the canopy, c highlights it, t is the trunk.
//
// There is deliberately no ground shadow baked in here. This palette holds
// opaque colours only, and a shadow's whole job is to darken WHATEVER is under
// it; an opaque pixel can only be pre-mixed for one terrain. The old 's'
// (0x123a28) was exactly GRASS 0x1f5c42 at 60% -- i.e. what addGroundShadow's
// black-at-0.4 produces over grass -- so on a road or soil it read as a green
// smear, not a shadow. If these trees want grounding, addGroundShadow() in
// pixelart.ts is the terrain-independent way to do it (it alpha-blends), and
// that belongs in the scene, not in the grid.
const TREE_PALETTE = {
  // canopy: outline + 4-step ramp lit from the top left
  b: 0x07281a,
  S: 0x0d3a26,
  D: 0x155235,
  c: 0x24734a,
  H: 0x53a05f,
  // trunk lit / shadow side
  t: 0x4a3620,
  T: 0x2f2113,
};
// Canopy is a shaded sphere lit from the top left rather than a flat blob:
// outline, 4-step ramp, then a two-tone trunk.
const TREE_TILE = [
  ".......bb.......",
  "....bbHHHcbb....",
  "...bHHHcHcccb...",
  "..bHHHcHcDDcDb..",
  ".bHHHcccDcDcSDb.",
  ".bHHHHccDDDDSSb.",
  ".bHHcHDcDDDSSSb.",
  ".bcHccDDDDSSSSb.",
  ".bccccDDDSSSSSb.",
  "..bDDDDSSSSSSb..",
  "...bDDSSSSSSb...",
  "....bbttTTbb....",
  ".....bttTTb.....",
  ".....bttTTb.....",
  ".....bttTTb.....",
  "................",
];
// Three more of the same species so a run of trees is not one stamp repeated.
// Only the canopy's centre, radius and squash differ; the trunk is copied from
// TREE_TILE unchanged, because vertically adjacent trees have to line up and
// the trunk is what marks where the tree stands. Each keeps the same
// one-column margin, so they connect exactly where tile 3 does. Background is
// '.' here for the same reason it is in TREE_TILE.
const TREE_TILE_2 = [
  "................",
  "......bbb.......",
  "...bbbHHHbbb....",
  "..bbHHcHccDbb...",
  "..bHHHcccDDDb...",
  ".bHHHHcccDDSDb..",
  ".bHcHccDDDDSSb..",
  ".bHccDcDDDSSSb..",
  ".bccDcDSSSSSSb..",
  "..bccDDSSSSSb...",
  "...bSDSSSSSb....",
  "....bbttTTbb....",
  ".....bttTTb.....",
  ".....bttTTb.....",
  ".....bttTTb.....",
  "................",
];
const TREE_TILE_3 = [
  ".......bbb......",
  ".....bbHHHbb....",
  "...bbHHcHHccbb..",
  "...bHHHHccDDDb..",
  "..bHHHcccDcDDSb.",
  "..bHcHHcDDSDDSb.",
  "..bHHccDDDSSSSb.",
  "..bHcccDDDDSSSb.",
  "..bHcDDSSSSSSSb.",
  "...bcDDDDSSSSb..",
  "....bDDSDSSSb...",
  "....bbttTTbb....",
  ".....bttTTb.....",
  ".....bttTTb.....",
  ".....bttTTb.....",
  "................",
];
const TREE_TILE_4 = [
  "......bbbb......",
  "....bbHHHHbb....",
  "...bHHHHcccDb...",
  "..bHHHHccccDDb..",
  "..bHHcHccDDSDb..",
  "..bHcHcccDDSSb..",
  "..bcHccDDSDSSb..",
  "..bcHDDDSDDSSb..",
  "..bHccDDDSSSSb..",
  "...bDDDSSSSSb...",
  "...bbSSSSSSbb...",
  "....bbttTTbb....",
  ".....bttTTb.....",
  ".....bttTTb.....",
  ".....bttTTb.....",
  "................",
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

// Tile 6 is the house FOOTPRINT, not the house: TownScene draws the building
// with add.image(..., "house") -- a 128x128 texture centred on the same 2x2
// block -- plus an addGroundShadow ellipse under it. The tile used to fill that
// block with a dark slab, and because the house image's top 24px band and its
// 4px side margins are transparent, the slab showed as a purple box sticking
// out above the roof and down both sides. Drawing nothing at all is what makes
// the building read as a building on any terrain. The index still has to exist
// (T_HOUSE = 6 is baked into saved map data) and it still collides via SOLID.
//
// The palette is kept, and holds the slab's old tones: makeTilesetTexture wants
// a palette per entry, and an unused entry is harmless -- see PATH_PALETTE.
const HOUSE_TILE_PALETTE = { s: 0x3d3650, d: 0x322c42 };
const HOUSE_TILE = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
];

// Volcano terrain (tiles16 23..27). The region grades nothing with a tint --
// green grass can't be multiplied into grey ash -- so it carries its own floor.
// Ash follows the grass rules: two tones, a diagonal period coprime with 16
// (7 here), luma spread ~6. Scorched ground is TALL_TILE's blade lattice in
// char-for-char swap, so a monster zone reads by the same quantity-not-contrast
// cue as tall grass, its embers kept to a hue shift (~8 luma) rather than glow.
const ASH_PALETTE = { a: 0x3b3537, h: 0x423b3d };
const ASH_TILE = [
  "haaaaaahaaaaaaha",
  "aaaahaaaaaahaaaa",
  "ahaaaaaahaaaaaah",
  "aaaaahaaaaaahaaa",
  "aahaaaaaahaaaaaa",
  "aaaaaahaaaaaahaa",
  "aaahaaaaaahaaaaa",
  "haaaaaahaaaaaaha",
  "aaaahaaaaaahaaaa",
  "ahaaaaaahaaaaaah",
  "aaaaahaaaaaahaaa",
  "aahaaaaaahaaaaaa",
  "aaaaaahaaaaaahaa",
  "aaahaaaaaahaaaaa",
  "haaaaaahaaaaaaha",
  "aaaahaaaaaahaaaa",
];
const SCORCH_PALETTE = { s: 0x2c2527, e: 0x47291f };
const SCORCH_TILE = [
  "eeseeseeseeseese",
  "essessessessesse",
  "ssssssssssssssss",
  "ssessessessesses",
  "ssessessessesses",
  "ssssssssssssssss",
  "sessessessessess",
  "sessessessessess",
  "ssssssssssssssss",
  "essessessessesse",
  "essessessessesse",
  "ssssssssssssssss",
  "ssessessessesses",
  "ssessessessesses",
  "ssssssssssssssss",
  "sessessessessess",
];
// Lava is WATER_A's crest layout recoloured (W->L, B->R, l->o, h->y, d->k), and
// B is A scrolled one row up exactly as WATER_B is, so the swap reads as a slow
// churn instead of a jump. Solid like water; nobody stands on it, so it is not
// held to the terrain calm limits.
const LAVA_PALETTE = { k: 0x7c2d12, R: 0x9a3412, L: 0xc2410c, o: 0xea580c, y: 0xfdba74 };
const LAVA_A = [
  "ooLLLLLLLLLLLRRL",
  "RRoyLLLLLLLLLLLL",
  "LLLLLLLLLLLLLLLL",
  "LLLLLLLLLLLLLLLL",
  "LLLLLLLLLLLooLLL",
  "LLLLLRRLLLLRRoyL",
  "LLLLLLLLLLooLLLL",
  "LLLLLLLLLLRRoyLL",
  "LLLLLkLLLLLLLLRR",
  "LLLLLLLLLooLLLLL",
  "LLLLLLLLLRRoyLLL",
  "LLLLLLLLLLLLRRLL",
  "LLLLLkLLLLLLLLLL",
  "LLLLLRRLLLoyLLLL",
  "LLLLLLLLooLLLLLL",
  "LLLLLLLLRRLLkLLL",
];
const LAVA_B = [
  "RRoyLLLLLLLLLLLL",
  "LLLLLLLLLLLLLLLL",
  "LLLLLLLLLLLLLLLL",
  "LLLLLLLLLLLooLLL",
  "LLLLLRRLLLLRRoyL",
  "LLLLLLLLLLooLLLL",
  "LLLLLLLLLLRRoyLL",
  "LLLLLkLLLLLLLLRR",
  "LLLLLLLLLooLLLLL",
  "LLLLLLLLLRRoyLLL",
  "LLLLLLLLLLLLRRLL",
  "LLLLLkLLLLLLLLLL",
  "LLLLLRRLLLoyLLLL",
  "LLLLLLLLooLLLLLL",
  "LLLLLLLLRRLLkLLL",
  "ooLLLLLLLLLLLRRL",
];
// Basalt boulder: the volcano's tree. An object tile like TREE_TILE, so '.' is
// its background and the ash shows through around it; lit from the top left,
// with one ember crack so the walls belong to this region and not the cave.
const ROCK_PALETTE = { b: 0x0f0b0c, S: 0x1f1a1c, D: 0x2e2729, c: 0x433a3d, H: 0x5e5356, e: 0xea580c };
const ROCK_TILE = [
  "................",
  ".....bbbbbb.....",
  "...bbHHHccDbb...",
  "..bHHHccccDDSb..",
  ".bHHccccDDDDSSb.",
  ".bHcccDDDDDSSSb.",
  "bHcccDDDDDSSSSSb",
  "bccccDDDeDSSSSSb",
  "bcccDDDDSeSSSSSb",
  "bccDDDDSSSeSSSSb",
  "bcDDDDSSSSSSSSSb",
  "bDDDDSSSSSSSSSSb",
  ".bDDSSSSSSSSSSb.",
  "..bbSSSSSSSSbb..",
  "....bbbbbbbb....",
  "................",
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

// The base colours, then the light and shade the 32-cell hero is drawn with:
// hair shine (H) and contour (d), the tunic's lit (T) and shaded (u) sides,
// the trousers' shadow (P), off buildRamp() of each base colour (heroShades
// below, which bakeHero applies to every look; these literals are BLUE's,
// and check:art holds them to it). Then the skin's shadow (S), the boots'
// shine (O), the eyes' glint (w) and the belt buckle (y), the same in every look.
const HERO_PALETTE = {
  h: 0x6b4226,
  s: 0xf8c896,
  e: 0x141414,
  t: 0x3b6ef0,
  b: 0x8a5a2b,
  p: 0x2f3a56,
  o: 0x4a2f1a,
  H: 0x916838,
  d: 0x402319,
  T: 0x75a7ee,
  u: 0x1b37d8,
  P: 0x1b1f31,
  S: 0xe3ac80,
  O: 0x71532b,
  w: 0xffffff,
  y: 0xffd166,
};

// The hero on a 32-cell grid, drawn at ART_PX (2px), so its texture is the
// same 64px as every other sprite's. The draft was Scale2x of the old 16-cell
// hero (same silhouette, so the equipment overlays and the shadow still sit
// where they did), then shaded by hand: a contour round the hair and a shine
// along its crown, a glint in each eye, the face shaded on its right, the
// tunic lit on its left and shaded on its right, a buckle in front, the
// trousers' inner edges and the boots' tops. Head, torso and legs stack as
// before (18 + 6 + 8 rows); the back and the side view wear the torso
// without the buckle.
const HERO_HEAD_32 = [
  "................................",
  "................................",
  "................................",
  "................................",
  "...........dddddddddd...........",
  ".........ddhhhhhhhhhhdd.........",
  ".........dhHHHHHhhhhhhd.........",
  ".......ddHHHHHHHhhhhhhhdd.......",
  ".......dhHHhhhhhhhhhhhhhd.......",
  "......dhhhhhhhhhhhhhhhhhhd......",
  "......dhhssssssssssssSShhd......",
  "......dhssssssssssssssSShd......",
  "......dhssweeessssweeeSShd......",
  "......dhsseeeesssseeeeSShd......",
  "......dhssssssssssssssSShd......",
  ".......dhssssssssssssSShd.......",
  ".......ddhhhhhhhhhhhhhhdd.......",
  ".........dddddddddddddd.........",
];

const HERO_UP_HEAD_32 = [
  "................................",
  "................................",
  "................................",
  "................................",
  "...........dddddddddd...........",
  ".........ddhhhhhhhhhhdd.........",
  ".........dhHHHHHhhhhhhd.........",
  ".......ddHHHHHHHhhhhhhhdd.......",
  ".......dhHHhhhhhhhhhhhhhd.......",
  "......dhhhhhhhhhhhhhhhhhhd......",
  "......dhhhhhhhhhhhhhhhhhhd......",
  "......dhhhhhhhhhhhhhhhhhhd......",
  "......dhhhhhhhhhhhhhhhhhhd......",
  "......dhhhhhhhhhhhhhhhhhhd......",
  "......dhhhhhhhhhhhhhhhhhhd......",
  ".......dhhhhhhhhhhhhhhhhd.......",
  ".......ddhhhhhhhhhhhhhhdd.......",
  ".........dddddddddddddd.........",
];

const HERO_SIDE_HEAD_32 = [
  "................................",
  "................................",
  "................................",
  "................................",
  "...........dddddddddd...........",
  ".........ddhhhhhhhhhhdd.........",
  ".........dhHHHHHhhhhhhd.........",
  ".......ddHHHHHHHhhhhhhhdd.......",
  ".......dhHHhhhhhhhhhhhhhd.......",
  "......dhhhhhhhhhhhhhhhhhhd......",
  "......dhhssssssssssssssssss.....",
  "......dhssssssssssssssssssss....",
  "......dhssssssssssssweeessss....",
  "......dhsssssssssssseeeessss....",
  "......dhssssssssssssssssssss....",
  ".......dhssssssssssssssssss.....",
  ".......ddhhhhhhhhhhhhhhd........",
  ".........dddddddddddddd.........",
];

const HERO_TORSO_32 = [
  "..........TTttttttttuu..........",
  ".........TTttttttttttuu.........",
  ".........TTttttttttttuu.........",
  ".......TTttttttttttttttuu.......",
  "......TTtttbbbbyybbbbtttuu......",
  "......TTttbbbbbyybbbbbttuu......",
];

const HERO_TORSO_BACK_32 = [
  "..........TTttttttttuu..........",
  ".........TTttttttttttuu.........",
  ".........TTttttttttttuu.........",
  ".......TTttttttttttttttuu.......",
  "......TTtttbbbbbbbbbbtttuu......",
  "......TTttbbbbbbbbbbbbttuu......",
];

// the walk cycle's legs (the villagers keep the 16-cell legs below)
const HERO_LEGS_STRIDE_A_32 = [
  "....ss....pppP....pppP....ss....",
  "....sss..pppP......pppP..sss....",
  ".....sssppppP......ppppPsss.....",
  "......sspppP........pppPss......",
  "........OOOOOO....OOOOOO........",
  ".........ooooo....ooooo.........",
  "................................",
  "................................",
];

const HERO_LEGS_PASS_A_32 = [
  "....ss....pppppppppppP....ss....",
  "....sss..pppppppppppppP..sss....",
  ".....ssspppppppppppppppPsss.....",
  "......sspppppppppppppppPss......",
  "........OOOOOOOOOOOOOOOO........",
  ".........oooooooooooooo.........",
  "................................",
  "................................",
];

const HERO_LEGS_STRIDE_B_32 = [
  "....ss....pppP....pppP....ss....",
  "....ss...ppppP....ppppP...ss....",
  ".........ppppP....ppppP.........",
  "........pppppP....pppppP........",
  "........OOOOOO....OOOOOO........",
  ".........oooo......oooo.........",
  "................................",
  "................................",
];

const HERO_LEGS_PASS_B_32 = [
  "........pppppppppppppppP........",
  "........pppppppppppppppP........",
  "......sspppppppppppppppPss......",
  "......sspppppppppppppppPss......",
  "........OOOOOOOOOOOOOOOO........",
  ".........oooooooooooooo.........",
  "................................",
  "................................",
];

const HERO_LEGS_IDLE_32 = [
  "....ss....pppppppppppP....ss....",
  "....ss....pppppppppppP....ss....",
  "....ss....pppppppppppP....ss....",
  "....ss....pppppppppppP....ss....",
  "....OOOO..OOOOOOOOOOOO..OOOO....",
  ".....ooo...oooooooooo...ooo.....",
  "................................",
  "................................",
];

// The looks a hero can wear: hair (h), tunic (t), belt (b) and trousers (p)
// over the same skin, eyes and boots. BLUE restates HERO_PALETTE's own slots,
// so picking it again restores the original. Each tunic keeps at least the
// default blue's contrast against every ground (grass 1.7-3.0:1, cave/ash
// 2.5-4.5:1); where one fades (GREEN on snow, 1.4:1) its dark trousers
// (5.8:1) and hair still outline the hero.
export const HERO_LOOKS = [
  { name: "BLUE", h: 0x6b4226, t: 0x3b6ef0, b: 0x8a5a2b, p: 0x2f3a56 },
  { name: "RED", h: 0xe0b354, t: 0xd23c3c, b: 0x5a3a20, p: 0x3d2b2b },
  { name: "GREEN", h: 0x9c4a1e, t: 0x34b55e, b: 0x7a5530, p: 0x34402a },
  { name: "VIOLET", h: 0xcfd2dc, t: 0x9258dc, b: 0x5b3a6e, p: 0x2c2645 },
] as const;

// a look's hair, tunic and trouser shading, off its own colours
const heroShades = ({ h, t, p }: { h: number; t: number; p: number }) => {
  const [hair, tunic, trousers] = [buildRamp(h), buildRamp(t), buildRamp(p)];
  return { H: hair[3], d: hair[1], T: tunic[3], u: tunic[1], P: trousers[1] };
};

// a look's own slots last, so one that names a shade (VIOLET's d) keeps it
const heroLookPalette = (look: number) => {
  const { name: _name, ...slots } = HERO_LOOKS[look] ?? HERO_LOOKS[0];
  return { ...HERO_PALETTE, ...heroShades(slots), ...slots };
};

const flipRows = (rows: string[]): string[] => rows.map((r) => [...r].reverse().join(""));

// Every hero frame, drawn with HERO_PALETTE as it stands. A `this` function
// rather than a scene method so bakeHero() can redraw from any scene, and
// still `makeTexture(this, ..., HERO_PALETTE)` so check:art pairs these grids
// with their palette like every other bake.
function drawHero(this: Phaser.Scene): void {
  const walkFrames = [HERO_LEGS_STRIDE_A_32, HERO_LEGS_PASS_A_32, HERO_LEGS_STRIDE_B_32, HERO_LEGS_PASS_B_32];
  for (let i = 0; i < walkFrames.length; i++) {
    const legs = walkFrames[i];
    makeTexture(this, `hero-down-${i}`, [...HERO_HEAD_32, ...HERO_TORSO_32, ...legs], HERO_PALETTE, ART_PX);
    makeTexture(this, `hero-up-${i}`, [...HERO_UP_HEAD_32, ...HERO_TORSO_BACK_32, ...legs], HERO_PALETTE, ART_PX);
    makeTexture(this, `hero-right-${i}`, [...HERO_SIDE_HEAD_32, ...HERO_TORSO_BACK_32, ...legs], HERO_PALETTE, ART_PX);
    makeTexture(this, `hero-left-${i}`, [...flipRows(HERO_SIDE_HEAD_32), ...HERO_TORSO_BACK_32, ...legs], HERO_PALETTE, ART_PX);
  }

  makeTexture(this, "hero-idle-down", [...HERO_HEAD_32, ...HERO_TORSO_32, ...HERO_LEGS_IDLE_32], HERO_PALETTE, ART_PX);
  makeTexture(this, "hero-idle-up", [...HERO_UP_HEAD_32, ...HERO_TORSO_BACK_32, ...HERO_LEGS_IDLE_32], HERO_PALETTE, ART_PX);
  makeTexture(this, "hero-idle-right", [...HERO_SIDE_HEAD_32, ...HERO_TORSO_BACK_32, ...HERO_LEGS_IDLE_32], HERO_PALETTE, ART_PX);
  makeTexture(this, "hero-idle-left", [...flipRows(HERO_SIDE_HEAD_32), ...HERO_TORSO_BACK_32, ...HERO_LEGS_IDLE_32], HERO_PALETTE, ART_PX);
}

// One idle frame per look for the pickers (ui/LookPicker.ts), under keys of
// their own, so showing all four at once never touches the hero-* textures.
// Drawn through `scene`, not `this`: check:art reads `makeTexture(this, ...)`
// calls with a named palette, and a computed one would throw its pairing off.
function drawLookPreviews(scene: Phaser.Scene): void {
  HERO_LOOKS.forEach((_, i) => {
    makeTexture(scene, `hero-look-${i}`, [...HERO_HEAD_32, ...HERO_TORSO_32, ...HERO_LEGS_IDLE_32], heroLookPalette(i), ART_PX);
  });
}

// the look the hero-* textures currently show; BootScene bakes BLUE
let bakedLook = 0;

/**
 * Redraws the hero-* textures in `look` (an index into HERO_LOOKS; anything
 * else is BLUE), under the same keys, so every scene, the walk animations
 * and the battle sprite pick it up with no change of their own. Phaser's
 * generateTexture draws onto an existing canvas texture without clearing it,
 * so each one is cleared first; the Texture and Frame objects stay the same,
 * which keeps the walk animations' frame references valid. The villagers
 * share the leg rows but have textures of their own, so they're untouched.
 * A no-op when that look is already baked.
 */
export function bakeHero(scene: Phaser.Scene, look: number): void {
  const index = HERO_LOOKS[look] ? look : 0;
  if (index === bakedLook) return;
  Object.assign(HERO_PALETTE, heroLookPalette(index));
  for (const key of scene.textures.getTextureKeys()) {
    if (!key.startsWith("hero-") || key.startsWith("hero-look-")) continue;
    const tex = scene.textures.get(key);
    if (tex instanceof Phaser.Textures.CanvasTexture) tex.clear();
  }
  drawHero.call(scene);
  bakedLook = index;
}

// The gear in the hero's hands, on the hero's own 32-cell grid at ART_PX,
// each with the hand's grip at the centre cell (16,16): ui/HeroGear.ts puts
// that cell on the hero's hand. The blade rises from the hand up and out at
// 45 degrees, lit along its upper edge (W) and shaded along its lower (v),
// past a cross-guard, with the pommel below the grip; the shield is a small
// heater (8x10 cells, about a third of the hero's width) with a lit rim (h)
// and a glint on the boss (w), hung from the hand beside the body.
const EQUIP_SWORD_PALETTE = { w: 0xd1d5db, d: 0x64748b, g: 0xf59e0b, b: 0x6b4226, W: 0xf8fafc, v: 0xa3aab5 };
const EQUIP_SWORD_32 = [
  "................................",
  "................................",
  "................................",
  "............................W...",
  "...........................WW...",
  "..........................Wwv...",
  ".........................Wwv....",
  "........................Wwv.....",
  ".......................Wwv......",
  "......................Wwv.......",
  ".....................Wwv........",
  "....................Wwv.........",
  "...................Wwv..........",
  "...............g..Wwv...........",
  "................gWwv............",
  ".................g..............",
  "...............bb.g.............",
  "..............bb...g............",
  ".............bb.................",
  "............gg..................",
  "............gg..................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
];

// the starting shield is wood: a dark rim, a knot for a boss
const EQUIP_SHIELD_PALETTE = { s: 0x5c3a1e, S: 0x9a6a3a, d: 0x6b4423, h: 0xc08a52, w: 0xd6cbb5 };
const EQUIP_SHIELD_32 = [
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "............ssssssss............",
  "............shhSSSSs............",
  "............shSSSSSs............",
  "............sSSddSSs............",
  "............sSSdwSSs............",
  "............sSSSSSds............",
  ".............sSSSSs.............",
  ".............sSSSds.............",
  "..............sSSs..............",
  "...............ss...............",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
];

// The tiers read by colour: a wooden shield and a plain blade with a gold
// guard, then IRON in a low-saturation blue-grey steel (a bright rim round a
// dark face), then MYTHRIL in bright cyan. IRON was once blue too and sat
// beside MYTHRIL, and the grey starting shield sat beside IRON.
const EQUIP_IRON_SWORD_PALETTE = { w: 0xb3c0cf, d: 0x334155, g: 0x8a9ab0, b: 0x3a4150, W: 0xe8edf3, v: 0x7a899d };
const EQUIP_IRON_SHIELD_PALETTE = { s: 0xb4c1d0, S: 0x4b6080, d: 0x2e3b4e, h: 0xdbe3ec, w: 0xf4f7fa };
const EQUIP_MYTHRIL_SWORD_PALETTE = { w: 0xe0f2fe, d: 0x38bdf8, g: 0xa5f3fc, b: 0x1e3a8a, W: 0xffffff, v: 0xa9d8f2 };
const EQUIP_MYTHRIL_SHIELD_PALETTE = { s: 0x7dd3fc, S: 0x38bdf8, d: 0x0ea5e9, h: 0xbae6fd, w: 0xf0f9ff };

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

// Town villagers on the hero's 32-cell grid: a 24-row head and torso each
// (Scale2x of the old 16-cell art, shaded as the hero is: a contour and shine
// on the hat or hood, lit and shaded sides on the clothes, the face's right
// edge in shadow, the eyes kept as flat 4x2 blocks with a glint), on the
// hero's own 32-cell legs (HERO_LEGS_*_32), so they walk with the same
// stride. Every palette therefore carries the legs' s (hands), p and P
// (trousers) and o and O (boots).
// straw hat with a wide brim, red shirt under blue overalls
const FARMER_PALETTE = {
  y: 0xfacc15,
  Y: 0xca8a04,
  h: 0x78350f,
  s: 0xf8c896,
  e: 0x141414,
  g: 0xdc2626,
  b: 0x2563eb,
  p: 0x1e40af,
  o: 0x422006,
  Z: 0x8a5a04,
  H: 0x9a5a2a,
  d: 0x4a2008,
  B: 0x5b8cf5,
  n: 0x1e3a8a,
  R: 0xf87171,
  P: 0x172f80,
  O: 0x6b3a12,
  S: 0xe3ac80,
  i: 0xffffff,
};
// old angler: peaked cap, white beard, work vest
const FISHER_PALETTE = {
  c: 0x0e7490,
  C: 0x164e63,
  h: 0x9ca3af,
  s: 0xf1c27d,
  e: 0x141414,
  w: 0xe5e7eb,
  v: 0xb45309,
  t: 0xf1f5f9,
  p: 0x334155,
  o: 0x1f2937,
  D: 0x22a5c4,
  H: 0xc5cad3,
  d: 0x6b7280,
  T: 0xffffff,
  u: 0xcbd5e1,
  V: 0xd97706,
  x: 0x7c3a06,
  P: 0x1f2937,
  O: 0x374151,
  S: 0xd9a46a,
  i: 0xffffff,
};
// hooded wanderer with a bright scarf; a rust cloak rather than green: a
// green hood vanished against the grass
const TRAVELER_PALETTE = {
  k: 0x92400e,
  K: 0x78350f,
  a: 0x22d3ee,
  s: 0xd6a77a,
  e: 0x141414,
  p: 0x57534e,
  o: 0x292524,
  A: 0x67e8f9,
  n: 0x0e7490,
  P: 0x44403c,
  O: 0x44403c,
  S: 0xbf8f62,
  i: 0xffffff,
};

const FARMER_TOP_32 = [
  "................................",
  "................................",
  ".............ZZZZZZ.............",
  "...........ZZyyyyyyZZ...........",
  "...........ZyyyyyyyyZ...........",
  "..........ZyyyyyyyyyyZ..........",
  "....YYYYYYYYYYYYYYYYYYYYYYZZ....",
  "....YYYYYYYYYYYYYYYYYYYYYYZZ....",
  "......HHssssssssssssssSSdd......",
  "......HHssssssssssssssSSdd......",
  "......HHssieeessssieeeSSdd......",
  "......HHsseeeesssseeeeSSdd......",
  "......HHssssssssssssssSSdd......",
  ".......HHssssssssssssSSdd.......",
  ".......HHssssssssssssSSdd.......",
  ".........HssssssssssSSd.........",
  "..........ssssssssssSS..........",
  "..........ssssssssssSS..........",
  "..........RRBBbbbbnngg..........",
  ".........RRgBBbbbbnnggg.........",
  ".........RRgBBbbbbnnggg.........",
  ".......RRggBBbbbbbbnngggg.......",
  "......RRgggBBbbbbbbnnggggg......",
  "......RRggBBbbbbbbbbnngggg......",
];

const FISHER_TOP_32 = [
  "................................",
  "................................",
  "................................",
  "................................",
  "...........CCCCCCCCCC...........",
  ".........CCDDDDDcccccCC.........",
  ".........CDcccccccccccC.........",
  "........CccccccccccccccC........",
  "........CccccccccccccccCCCCC....",
  "........CcccccccccccccCCCCCC....",
  ".......HssssssssssssssSSdd......",
  "......HHssssssssssssssSSdd......",
  "......HHssieeessssieeeSSdd......",
  "......HHsseeeesssseeeeSSdd......",
  "......HHsswwwwwwwwwwwwssdd......",
  ".......Hswwwwwwwwwwwwwwsd.......",
  "........wwwwwwwwwwwwwwww........",
  ".........wwwwwwwwwwwwww.........",
  "..........VVTTttttuuxx..........",
  ".........VVvTTttttuuvxx.........",
  ".........VVvTTttttuuvxx.........",
  ".......VVvvvTTttttuuvvvxx.......",
  "......VVvvvvTTttttuuvvvvxx......",
  "......VVvvvvTTttttuuvvvvxx......",
];

const TRAVELER_TOP_32 = [
  "................................",
  "................................",
  ".............KKKKKK.............",
  "...........KKkkkkkkKK...........",
  "...........KkkkkkkkkK...........",
  ".........KKkkkkkkkkkkKK.........",
  ".........KkkkkkkkkkkkkK.........",
  ".......KKkkkkkkkkkkkkkkKK.......",
  ".......KkKssssssssssSSKkK.......",
  "......KkKKssssssssssSSKKkK......",
  "......KkKKssieeessSSieKKkK......",
  "......KkKKsseeeessSSeeKKkK......",
  "......KkKKssssssssssSSKKkK......",
  ".......KkKssssssssssSSKkK.......",
  ".......KkkAAaaaaaaaannkkK.......",
  "........KkkAAaaaaaannkkK........",
  "........KkkAAaaaaaannkkK........",
  "........KkkkkAAaannkkkkK........",
  "........KkkkkkkkkkkkkkkK........",
  ".......KkkkkkkkkkkkkkkkkK.......",
  ".......KkkkkkkkkkkkkkkkkK.......",
  "......KkkkkkkkkkkkkkkkkkkK......",
  "......KkkkKKkkkkkkkkKKkkkK......",
  ".......KKKKKKKKKKKKKKKKKK.......",
];

// The town's fixed NPCs, one figure each on the hero's 32-cell body (same
// head, height and feet, so the shadow and the name tag sit as they did for
// the shared robed "npc"), each with what says its trade at a glance. Drawn
// at ART_PX as they stand; TownScene.addNpc uses npc-<label> when it exists.
// ELDER: white hair and a long beard, a purple robe to the boots, a staff
const NPC_ELDER_PALETTE = {
  h: 0xd6d3d1,
  H: 0xf5f5f4,
  d: 0x8f8a85,
  s: 0xf1c8a0,
  S: 0xd9a983,
  e: 0x141414,
  i: 0xffffff,
  t: 0x7c3aed,
  T: 0xa171f2,
  u: 0x48248c,
  g: 0xfacc15,
  o: 0x3b2a1a,
  w: 0x8b5a2b,
  W: 0xb07a40,
  k: 0x3e2414,
};
const NPC_ELDER_32 = [
  "................................",
  "................................",
  "................................",
  "................................",
  "...........dddddddddd.....kk....",
  ".........ddHHHHHhhhhhdd..kWwk...",
  ".........dHhhhhhhhhhhhd..kwwk...",
  ".......ddhhhhhhhhhhhhhhdd.kk....",
  ".......dHhhhhhhhhhhhhhhhd.Ww....",
  "......dhhhhhhhhhhhhhhhhhhdWw....",
  "......dhhssssssssssssSShhhWw....",
  "......dhssssssssssssssSShhWw....",
  "......dhssieeessssieeeSShhWw....",
  "......dhsseeeesssseeeeSShhWw....",
  "......dhssssssssssssssSShdWw....",
  ".......dhshhhhhhhhhhhhShd.Ww....",
  ".......ddhHHHHHHhhhhhhhdd.Ww....",
  ".........dhhhhhhhhhhhhd...Ww....",
  "..........dhhhhhhhhhhd....Ww....",
  ".........Thhhhhhhhhhhhu...Ww....",
  ".........TThhhhhhhhhhuu...Ww....",
  ".......TTttthhhhhhhhttuusssss...",
  "......TTtttggghhhhgggtuusssss...",
  "......TTttggggggggggggttuuWw....",
  "......TTttttttttttttttuu..Ww....",
  "......TTttttttttttttttuu..Ww....",
  "......ssTTttttttttttttuu..Ww....",
  "......ssTTttttttttttttuu..Ww....",
  "....oooTTtttttttttttttuu..Ww....",
  ".....ooo...oooooooooo...ooWw....",
  "................................",
  "................................",
];

// SHOP: a mustache and a cream apron over a yellow shirt
const NPC_SHOP_PALETTE = {
  h: 0x7c4a26,
  H: 0xa36a3c,
  d: 0x4a2a14,
  m: 0x4a2a14,
  s: 0xf8c896,
  S: 0xe3ac80,
  e: 0x141414,
  i: 0xffffff,
  t: 0xf2b134,
  T: 0xffd166,
  u: 0xc98a1c,
  b: 0x8a5a2b,
  a: 0xf5efe0,
  A: 0xd8cfb8,
  p: 0x5a4030,
  o: 0x3b2a1a,
};
const NPC_SHOP_32 = [
  "................................",
  "................................",
  "................................",
  "................................",
  "...........dddddddddd...........",
  ".........ddHHHHHhhhhhdd.........",
  ".........dHhhhhhhhhhhhd.........",
  ".......ddhhhhhhhhhhhhhhdd.......",
  ".......dHhhhhhhhhhhhhhhhd.......",
  "......dhhhhhhhhhhhhhhhhhhd......",
  "......dhhssssssssssssSShhd......",
  "......dhssssssssssssssSShd......",
  "......dhssieeessssieeeSShd......",
  "......dhsseeeesssseeeeSShd......",
  "......dhssssssssssssssSShd......",
  ".......dhssmmmmmmmmmmSShd.......",
  ".......ddhhhhhhhhhhhhhhdd.......",
  ".........dHHHHHHhhhhhhd.........",
  "..........TTaattttAAuu..........",
  ".........TaaaaaaaaaaAAu.........",
  ".........TaaaaaaaaaaAAu.........",
  ".......TTtaaaaaaaaaaAAtuu.......",
  "......TTttaaaaaaaaaaAAttuu......",
  "......TTttaaaaaaaaaaAAttuu......",
  "....ss....aaaaAAAAaaAA....ss....",
  "....ss....aaaaaaaaaaAA....ss....",
  "....ss....aaaaaaaaaaAA....ss....",
  "....ss....aaaaaaaaaaAA....ss....",
  "....oooo..oooooooooooo..oooo....",
  ".....ooo...oooooooooo...ooo.....",
  "................................",
  "................................",
];

// GUARD: a steel helmet with a cyan crest, a cyan tabard, a spear
const NPC_GUARD_PALETTE = {
  m: 0x9aa5b4,
  M: 0xd5dde6,
  n: 0x4b5563,
  c: 0x22d3ee,
  C: 0x0e7490,
  s: 0xf8c896,
  S: 0xe3ac80,
  e: 0x141414,
  i: 0xffffff,
  p: 0x334155,
  o: 0x1f2937,
  w: 0x8b5a2b,
  W: 0xb07a40,
  b: 0x4b5563,
};
const NPC_GUARD_32 = [
  "............................M...",
  "..............cccc.........MMn..",
  ".............cccccc........MMn..",
  "..............cCCc........MMMMn.",
  "...........nnnmmmmnnn......nnn..",
  ".........nnMMMMMmmmmmnn....Ww...",
  ".........nMmmmmmmmmmmnn....Ww...",
  ".......nnmmmmmmmmmmmmmmnn..Ww...",
  ".......nMmmmmmmmmmmmmmmnn..Ww...",
  "......nMmmmmmmmmmmmmmmmmnn.Ww...",
  "......nnnnnnnnnnnnnnnnnnnn.Ww...",
  "......nMsssssssnnsssssSSnn.Ww...",
  "......nMssieeesnnsieeeSSnn.Ww...",
  "......nMsseeeesnnseeeeSSnn.Ww...",
  "......nMssssssssssssssSSnn.Ww...",
  ".......nMssssssssssssSSnn..Ww...",
  ".......nnmmmmmmmmmmmmmmnn..Ww...",
  ".........nMMMMMMmmmmmnn....Ww...",
  "..........nMmccccccmnn.....Ww...",
  ".........nMmmccccccmmnn....Ww...",
  ".........nMmmccccccmmnn....Ww...",
  ".......nnmmmmccccccmmmmnnsssss..",
  "......nMMmmbbCCCCCCbbmmnnsssss..",
  "......nnnnbbbCCCCCCbbbnnnn.Ww...",
  "....ss....pppccccccppp.....Ww...",
  "....ss....pppccccccppp.....Ww...",
  "....ss....pppccccccppp.....Ww...",
  "....ss....pppccccccppp.....Ww...",
  "....oooo..oooooooooooo.....Ww...",
  ".....ooo...oooooooooo...oooWw...",
  "................................",
  "................................",
];

// HUNTER: a feathered green cap, a quiver strap, a bow in the left hand
const NPC_HUNTER_PALETTE = {
  c: 0x3f8f3a,
  G: 0x6cc04a,
  C: 0x1f4f22,
  f: 0xe0503a,
  F: 0x8a2a1a,
  h: 0x6b4226,
  H: 0x916838,
  d: 0x402319,
  s: 0xf1c27d,
  S: 0xd9a46a,
  e: 0x141414,
  i: 0xffffff,
  t: 0x4ca64a,
  T: 0x86d97a,
  u: 0x2e6e2c,
  b: 0x6b4226,
  p: 0x5a4030,
  o: 0x3b2a1a,
  w: 0x8b5a2b,
  q: 0xf5efe0,
};
const NPC_HUNTER_32 = [
  ".........................ff.....",
  "........................fF......",
  ".......................fF.......",
  "......................fF........",
  "...........CCCCCCCCCC.F.........",
  ".........CCGGGGGcccccCC.........",
  ".........CGcccccccccccC.........",
  ".......CCccccccccccccccCC.......",
  ".....wwGGcccccccccccccccC.......",
  "....wwqCCCCCCCCCCCCCCCCCCC......",
  "...wwwqhhssssssssssssSShhd......",
  "...ww.qhssssssssssssssSShd......",
  "..ww..qhssieeessssieeeSShd......",
  "..ww..qhsseeeesssseeeeSShd......",
  "..ww..qhssssssssssssssSShd......",
  "..ww..qhhssssssssssssSShd.......",
  "..ww..qhdhhhhhhhhhhhhhhdd.......",
  "..wwssss.dhhhhhhhhhhhhd.........",
  "..wwssss..bbTTttttttuu..........",
  "..ww..q..TTtbbtttttttuu.........",
  "..ww..q..TTtttbbtttttuu.........",
  "..ww..qTTtttttttbbtttttuu.......",
  "...ww.qTTttbbbbbbbbbbtttuu......",
  "...ww.qTTtbbbbbbbbbbbbttuu......",
  "....wwq...pppppppppppp....ss....",
  "....wwq...pppppppppppp....ss....",
  ".....ww...pppppppppppp....ss....",
  "..........pppppppppppp....ss....",
  "..........oooooooooooo..oooo....",
  ".....ooo...oooooooooo...ooo.....",
  "................................",
  "................................",
];

// GAMBLER: a black top hat with a pink band, a pink vest, a bow tie
const NPC_GAMBLER_PALETTE = {
  k: 0x1c1626,
  K: 0x3c3450,
  r: 0xec4899,
  R: 0xf9a8d4,
  u: 0x9d174d,
  x: 0xf5f5f5,
  g: 0xfacc15,
  h: 0x2b1b12,
  H: 0x4a3020,
  d: 0x140c08,
  s: 0xf8c896,
  S: 0xe3ac80,
  e: 0x141414,
  i: 0xffffff,
  p: 0x1f1b2e,
  o: 0x14101c,
};
const NPC_GAMBLER_32 = [
  "..........kkkkkkkkkkkk..........",
  "..........KKKKKKkkkkkk..........",
  "..........kkkkkkkkkkkk..........",
  "..........kkkkkkkkkkkk..........",
  "..........kkkkkkkkkkkk..........",
  ".........kkkkkkkkkkkkkk.........",
  ".........KRRrrrrrrrruuk.........",
  ".......kkkRRrrrrrrrruukkk.......",
  ".......KKkkkkkkkkkkkkkkkk.......",
  "......dkkkKKKKKKkkkkkkkkkd......",
  "......dhhssssssssssssSShhd......",
  "......dhssssssssssssssSShd......",
  "......dhssieeessssieeeSShd......",
  "......dhsseeeesssseeeeSShd......",
  "......dhssssssssssssssSShd......",
  ".......dhssssssssssssSShd.......",
  ".......ddhhhhhhhhhhhhhhdd.......",
  ".........dhhhhhhhhhhhhd.........",
  "........RRrrrkkxxkkrrruu........",
  "........RRrrrxKkkkxrrruu........",
  "........RRrrrkkxxkkrrruu........",
  ".......xRRrrrxxggxxrrruux.......",
  "......xxRRrrrxxxxxxrrruuxx......",
  "......xxRRrrrxxxxxxrrruuxx......",
  "....ss....pppppppppppp....ss....",
  "....ss....pppppppppppp....ss....",
  "....ss....pppppppppppp....ss....",
  "....ss....pppppppppppp....ss....",
  "....oooo..oooooooooooo..oooo....",
  ".....ooo...oooooooooo...ooo.....",
  "................................",
  "................................",
];

// ARENA: a crested gold helmet, a gold breastplate, a red war-skirt
const NPC_ARENA_PALETTE = {
  m: 0xe0a82e,
  M: 0xfde68a,
  n: 0x8a5a12,
  r: 0xdc2626,
  R: 0xf87171,
  u: 0x7f1d1d,
  s: 0xd9a06a,
  S: 0xbf8754,
  e: 0x141414,
  i: 0xffffff,
  p: 0x5a3a20,
  o: 0x3b2a1a,
};
const NPC_ARENA_32 = [
  ".............rrrrrr.............",
  "............rrRRrrrr............",
  "............rrrrrrrr............",
  ".............rrrrrr.............",
  "...........nnmmmmmmnn...........",
  ".........nnMMMMMmmmmmnn.........",
  ".........nMmmmmmmmmmmnn.........",
  ".......nnmmmmmmmmmmmmmmnn.......",
  ".......nMmmmmmmmmmmmmmmnn.......",
  "......nMmmmmmmmmmmmmmmmmnn......",
  "......nnnnnnnnnnnnnnnnnnnn......",
  "......nMssssssssssssssSSnn......",
  "......nMssieeessssieeeSSnn......",
  "......nMsseeeesssseeeeSSnn......",
  "......nMssssssssssssssSSnn......",
  ".......nMssssssssssssSSnn.......",
  ".......nnmmmmmmmmmmmmmmnn.......",
  ".........nMMMMMMmmmmmnn.........",
  "......MMMMMMmmmmmmmmnnnnnn......",
  "......MMMMMMmmmmmmmmnnnnnn......",
  "......MMMMMMmmmmmmmmnnnnnn......",
  ".......nMmmmmmmmmmmmmmmnn.......",
  "......nMMMmnnnnnnnnnnmmmnn......",
  "......nnnnnnnnnnnnnnnnnnnn......",
  "....ss....rprprprprprp....ss....",
  "....ss....rprprprprprp....ss....",
  "....ss....rprprprprprp....ss....",
  "....ss....rprprprprprp....ss....",
  "....oooo..oooooooooooo..oooo....",
  ".....ooo...oooooooooo...ooo.....",
  "................................",
  "................................",
];

// BLACKSMITH: a red headband, bare forearms, a leather apron, a hammer
const NPC_BLACKSMITH_PALETTE = {
  h: 0x2b1b12,
  H: 0x4a3020,
  d: 0x140c08,
  r: 0xdc2626,
  s: 0xd9a06a,
  S: 0xbf8754,
  e: 0x141414,
  i: 0xffffff,
  x: 0x94a3b8,
  X: 0xcbd5e1,
  y: 0x64748b,
  a: 0x7a4a24,
  A: 0x9a6a3a,
  b: 0x4a2a14,
  p: 0x3b3b46,
  o: 0x1f1f26,
  m: 0x6b7280,
  M: 0x9ca3af,
  n: 0x374151,
  w: 0x6b4226,
  W: 0x8b5a2b,
};
const NPC_BLACKSMITH_32 = [
  "................................",
  "................................",
  "................................",
  "................................",
  "...........dddddddddd...........",
  ".........ddHHHHHhhhhhdd.........",
  ".........dHhhhhhhhhhhhd.........",
  ".......ddhhhhhhhhhhhhhhdd.......",
  ".......dHhhhhhhhhhhhhhhhd.......",
  "......drrrrrrrrrrrrrrrrnmmmmmn..",
  "......dhhssssssssssssSSmMMMMmn..",
  "......dhsssssssssssssSSmmmmmmn..",
  "......dhssieeessssieeeSnnnnnnn..",
  "......dhsseeeesssseeeeSShhWw....",
  "......dhssssssssssssssSShdWw....",
  ".......dhssssssssssssSShd.Ww....",
  ".......ddhhhhhhhhhhhhhhdd.Ww....",
  ".........dHHHHHHhhhhhhd...Ww....",
  "..........XXAAxxxxbbyy....Ww....",
  ".........XAAaaaaaaaabby...Ww....",
  ".........XAAaaaaaaaabby..ssss...",
  "......sssXAAaaaaaaaabbyssssss...",
  "......sssXAAaaaaaaaabbysssWw....",
  "......sssXAAaaaaaaaabbysssWw....",
  "....ss....AAaaaaaaaabb....Ww....",
  "....ss....AAaaaaaaaabb....Ww....",
  "....ss....AAaaaaaaaabb....Ww....",
  "....ss....AAaaaaaaaabb..........",
  "....oooo..oooooooooooo..........",
  ".....ooo...oooooooooo...ooo.....",
  "................................",
  "................................",
];

// The slimes on a 32-cell grid at ART_PX: one dome lit from the top left
// (shadow / base / light / highlight bands off an ellipsoid), a specular blob
// and glint, eyes with a glint each and a small smile. Every slime palette
// walks the same 6 chars (outline / shadow / base ramp / specular), so the
// one grid recolours into the golden, king and magma slimes. The golden slime
// is its own texture rather than the green one tinted: a multiply tint over
// green came out olive. The green slime's outline is a near-black green: at
// 0x11543c every outline pixel sat within RGB distance 40 of the town's grass
// and scrub (its home) and the forest's, so it had no edge on the field.
const SLIME_PALETTE = { o: 0x082419, s: 0x1c8a5e, g: 0x2fbd70, m: 0x4ade80, h: 0x86eb9c, w: 0xd6fadf };
const GOLD_SLIME_PALETTE = { o: 0x6b4508, s: 0xb7791f, g: 0xe8b923, m: 0xfad643, h: 0xfdeea0, w: 0xfffdf0 };
const KING_SLIME_PALETTE = { o: 0x631028, s: 0x99182f, g: 0xcf2130, m: 0xef4444, h: 0xf98a72, w: 0xfde3cf };
const SLIME_32 = [
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "...........oooooooooo...........",
  ".........oohhhhmmmmmmoo.........",
  ".......oohhhhhhmmmmmmmgoo.......",
  "......ohhhhhwhhmmmmmmmgggo......",
  ".....ohhwwhhhhhmmmmmmmggggo.....",
  ".....ohwwwwhhhhmmmmmmmggggo.....",
  "....ohhwwhhhhhmmmmmmmggggggo....",
  "....ohhwhhhhhmmmmmmmmggggggo....",
  "...ohhhhhhhhhmmmmmmmmggggggso...",
  "...ohhhhhhhhmmmmmmmmggggggsso...",
  "..ohhhhhhhoommmmmmmgooggggssso..",
  "..ohhhhhhowoommmmmmowoogggssso..",
  "..omhhmmmoooommmmmgooooggsssso..",
  "..ommmmmmmoommmmmgggoogggsssso..",
  "..ommmmmmmmmmmmmggggggggssssso..",
  "..ommmmmmmmmmmmgggggggggssssso..",
  "..ommmmmmmmmmmgggggggggsssssso..",
  "..ommmmmmmmmgoggggogggssssssso..",
  "..ommmmmmmggggoooogggsssssssso..",
  "..ogmmggggggggggggggssssssssso..",
  "..oggggggggggggggggsssssssssso..",
  "..ogggggggggggggggssssssssssso..",
  "...oggggggggggggsssssssssssso...",
  "...ogggggggggggssssssssssssso...",
  "....ooggggggssssssssssssssoo....",
  "......oooooooooooooooooooo......",
];

// The goblin on a 32-cell grid: pointed ears, angry brows over eyes (e) with
// a glint (w), a fanged grin (f), arms outlined against the flanks and a
// loincloth (r/R). K is the outline, S s L H the skin lit from the top left.
// The cursed goblin is its own violet palette, as the golden slime is; at a
// mean luma of ~104 it keeps the old violet tint's lift off the cave floor
// (54). The TROLL KING and the MOSS GOLEM wore this grid too, scaled up, and
// read as big goblins; they have their own grids below. K is dark enough to
// stand off the forest's moss and scrub (at 0x173d2a it was within RGB
// distance 40 of them all round), and no darker.
const GOBLIN_PALETTE = {
  K: 0x0d261a,
  S: 0x4fae72,
  s: 0x7fdc9c,
  L: 0xa8f0c0,
  H: 0xd8fbe4,
  e: 0xff5555,
  w: 0xffffff,
  r: 0x8b5a2b,
  R: 0x5c3a1a,
  f: 0xf1fdf5,
};
const CURSED_GOBLIN_PALETTE = {
  K: 0x3b0d4f,
  S: 0x8a3fb5,
  s: 0xc06ee8,
  L: 0xdc9ff7,
  H: 0xf3d9ff,
  e: 0xfde047,
  w: 0xffffff,
  r: 0x4a2a5c,
  R: 0x2c1838,
  f: 0xf5ecff,
};
const GOBLIN_32 = [
  "................................",
  "................................",
  "................................",
  "................................",
  "..........KK........KK..........",
  ".........KLK........KsK.........",
  ".........KSLKKKKKKKKsSK.........",
  "........KLSHHHHHLLLssSsK........",
  ".......KsSHHHHLLLLLsssSSK.......",
  "......KssKKHHLLLLLssssKKSK......",
  "......KssHLKKLLLLsssKKSSSK......",
  "......KSSLLweeLssssweeSSSK......",
  ".......KSLLeeessssseeeSSK.......",
  "........KssssssSSsSSSSSK........",
  "........KsssKKKKKKKKSSSK........",
  ".........KKKKfKKKKfKKKK.........",
  ".......KKLLLLLLLssssSSSKKK......",
  "......KLLLLLLLssssssSSssSK......",
  "......KLLKLLLssssssSSSKSSK......",
  "......KssKsssssssSSSSSKSSK......",
  "......KssKssssssSSSSSSKSSK......",
  "......KssKrrrrrKKrrrRRKSSK......",
  "......KKK.KrrrrrrRRRRK.KKK......",
  "..........RRRRKRRKRRRR..........",
  ".........KLLLK.KK.KsSSK.........",
  ".........KsssK....KSSSK.........",
  ".........KsssK....KSSSK.........",
  "........KKKKKK....KKKKKK........",
  "................................",
  "................................",
  "................................",
  "................................",
];

// TROLL KING on a 32-cell grid: a hulking hunched body, long arms with the
// knuckles near the ground, a small head sunk between the shoulders under a
// gold crown (y Y o, a gem g), heavy brows over small yellow eyes, an
// underbite with tusks (t), a lit gut and a loincloth. The crown starts four
// rows down: battle draws giants at 3x with their top under the enemy panel.
const TROLL_PALETTE = {
  K: 0x141c14,
  S: 0x4a584c,
  s: 0x6f7f70,
  L: 0x98a598,
  H: 0xc5cdc5,
  e: 0xffd166,
  r: 0x7c2d12,
  R: 0x4a1a0a,
  t: 0xe5e0c8,
  o: 0xb45309,
  y: 0xfacc15,
  Y: 0xfde68a,
  g: 0xdc2626,
};
const TROLL_32 = [
  "................................",
  "................................",
  "................................",
  "................................",
  "...........KY..YY..YK...........",
  "...........Kyy.yy.yyK...........",
  "...........KYyyggyyyK...........",
  "...........KooooooooK...........",
  "...........KKKKKKKKKK...........",
  "...........KHHLLLLssK...........",
  "...........KKKKLLKKKK...........",
  "......KKKKKKLeLLsseSKKKKKK......",
  ".....KHHHHHKLssssssSKLssssK.....",
  "....KHHHHHHKtssssSStKsssssSK....",
  "...KLHHHHHHLtKKKKKKtLssssSSsK...",
  "..KLLLHHHHLLLLLLLLLLsssssSsssK..",
  "..KLLLLLLLLLLLLLLLLsssssSSsssK..",
  "..KLLKKLLLLLHHLLLsssssssSKKssK..",
  "..KLLK.KLLLHLLLLsssssssSK.KssK..",
  "..KLLK.KLLHLLLssssssssSSK.KsSK..",
  "..KssK.KsssssssSsSSSSSSSK.KSSK..",
  "..KssK.KsssssssSSSSSSSSSK.KSSK..",
  ".KssssKsssssSSSSSSSSSSSSSKSSSSK.",
  ".KssssKrrrrrrrrrrrrrrrrRRKSSSSK.",
  ".KSsSSKrrrrrrrrrrrrrrRRRRKSSSSK.",
  "..KKKK.KrrrrrrrrRRRRRRRRK.KKKK..",
  ".......RRRRRRKKKKRRRRRRRK.......",
  "......KLLLLLK....KsssSSK........",
  "......KSSsssK....KSSSSSK........",
  ".....KssssssK....KsssSSSK.......",
  ".....KKKKKKKK....KKKKKKKK.......",
  "................................",
];

// head-on wolf on a 32-cell grid: tall ears with pink insides, a cheek ruff, a
// dark mask on the brow, red eyes, a pale muzzle tapering to the nose, fangs
// and two front legs. K just dark enough to clear the forest's scrub, which
// swallowed the whole outline at 0x1e2433 (a companion follows into it).
const WOLF_PALETTE = {
  K: 0x171c28,
  D: 0x56647a,
  G: 0x75849a,
  g: 0xa0aec0,
  l: 0xd0d7e2,
  W: 0xf1f5f9,
  e: 0xef4444,
  w: 0xffffff,
  p: 0xa8788a,
  f: 0xf8fafc,
};
const WOLF_32 = [
  "................................",
  "................................",
  ".....K....................K.....",
  ".....KK..................KK.....",
  ".....KpK................KpK.....",
  ".....KppK..............KppK.....",
  ".....KpppK............KpppK.....",
  ".....KGpppKKKKKKKKKKKKpppDK.....",
  ".....KGGDDDlllDDDDgggDDDDDK.....",
  ".....KlllllllDDDDDDgggGGGGK.....",
  "....KllKKKllggDDDDggggKKKGGK....",
  "...KlllllKKgggggggggGKKGGGGDK...",
  "..KgggggweegggggggGGGweeGGDDDK..",
  "...KgggggeKgggWWWWGGGKeGGDDDK...",
  "..KKgggggggggWWWWWWGGGGGDDDDKK..",
  "....KKGGGGGGWWWWWWllGGDDDDKK....",
  "......KKGGGGWWKKKKllDDDDKK......",
  "........KKGGWWWKKlllDDKK........",
  ".......KggKKfKKKKKKfKKDDK.......",
  "......KgggggKKKKKKKKGGDDDK......",
  "......KgggggWWWWWWWlGDDDDK......",
  "......KggggGWWWWWWllDDDDDK......",
  "......KGDDDDDWWWlllDDDDDDK......",
  ".......KDggGDKKKKKKDDDDDK.......",
  "........KGGGK......KDDDK........",
  "........KGGGK......KDDDK........",
  ".......KllllK......KGDDDK.......",
  ".......KKKKKK......KKKKKK.......",
  "................................",
  "................................",
  "................................",
  "................................",
];

// will-o'-wisp on a 32-cell grid: a teardrop of light drawn up into one flame
// tip, lit from within (white core out to a dark rim), two hollow eyes either
// side of the core and a curling tail. The 16-cell wisp stayed blocky because
// Scale2x pulled its eyes lopsided; this one is drawn at ART_PX as it stands.
const WISP_PALETTE = { k: 0x082f49, d: 0x0c4a6e, c: 0x1d7fb8, C: 0x38bdf8, l: 0x8fd7fa, w: 0xe8f7ff };
const WISP_32 = [
  ".................kk.............",
  ".................kk.............",
  "................kcck............",
  "...............kccck............",
  ".............kkccccck...........",
  "............kCCCCCccck..........",
  "...........kCCCCCCCCcck.........",
  ".........kkCCCCCCCCCCCck........",
  "........kCCCllllllCCCCCk........",
  ".......kCCClllllllllCCCck.......",
  "......kCCCllllllllllCCCCck......",
  ".....kCCCllllwwwwllllCCCcck.....",
  ".....kCCClllwwwwwwlllCCCcck.....",
  ".....kCCClkkwwwwwwwlkkCCCck.....",
  ".....kCCCkkkkwwwwwwkkkkCCck.....",
  ".....kCCCkkkkwwwwwlkkkkCcck.....",
  ".....kCCCkkkkwwwwllkkkkCcck.....",
  ".....kcCCCkkllllllllkkCCcck.....",
  ".....kcCCCClllllllllCCCccck.....",
  "......kdCCCCllllllCCCCCddk......",
  "......kddCCCCCCCCCCCCCdddk......",
  ".......kddCCCCCCCCCCddddk.......",
  "........kkddCCCCCCddddkk........",
  "..........kkddddddddkk..........",
  "............kkdddddk............",
  "..............kdddk.............",
  "...............kkdk.............",
  ".................kk.............",
  ".................kk.............",
  "................kk..............",
  "................kk..............",
  "..............kkk...............",
];

// frost moth on a 32-cell grid: four frosted wings with an eye-spot each, a
// furred body, feathered antennae and red eyes
const FROST_MOTH_PALETTE = {
  K: 0x1c4f6e,
  d: 0x0369a1,
  b: 0x38bdf8,
  W: 0xbae6fd,
  w: 0xe0f2fe,
  q: 0xf4fbff,
  F: 0x92b5ca,
  f: 0xdaf2fe,
  e: 0xef4444,
  i: 0xffffff,
};
const FROST_MOTH_32 = [
  "................................",
  "................................",
  "...........F........F...........",
  ".....KKKKKKKF......FKKKKKKK.....",
  "...KKqqqqqqFKF....FKFwwwWWWKK...",
  "..KqqqqqqqqqqKKKKKKwwwwWWWWWWK..",
  "..KqqqqqqqqwwKffffKwwwwWWWWWWK..",
  ".KwwqqqbbbwwwKiefiewwwWbbbWWWWK.",
  ".KwwwwbdddbwwKFFFFKwwWbdddbWWWK.",
  ".KwwwwbdddbwwwFFFFwWWWbdddbWWbK.",
  ".KwwwwbdddbwwKffffKWWWbdddbWbbK.",
  ".KwwwwwbbbwwwKffffKWWWWbbbWbbbK.",
  "..KwwwwwwwwwwKfFFfKWWWWWWWWbbK..",
  "...KwwwwwwwWKKFFFFKKWWWWWbbbK...",
  "....KKWWWWWK.FFFFFF.KWWWbbKK....",
  "......KWWWWWK.KFFK.KWWWbbK......",
  "......KWWWWWWKKfFKKWWbbbbK......",
  ".....KWWWWWWWWKfFKWbbbbbbbK.....",
  ".....KWWWWWWWKfFFFKbbbbbbbK.....",
  ".....KWbbbbbbKFFFFKbbbbbbbK.....",
  ".....KbbbbbbbKFFFFKbbbbbbbK.....",
  ".....KbbbbbbbbKFFKbbbbbbbbK.....",
  "......KbbbbbbKKFFKKbbbbbbK......",
  ".......KKKKKK.KFFK.KKKKKK.......",
  "..............KFFK..............",
  "...............KK...............",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
];

// yeti on a 32-cell grid: a shaggy hunched body (S F f q lit from the top
// left), long arms, a blue face (a/s) with brows, a glint in each eye and the
// flat grumpy mouth it always had -- Scale2x had turned that mouth down, so
// the 16-cell yeti stayed blocky
const YETI_PALETTE = {
  K: 0x334155,
  S: 0x94a3b8,
  F: 0xcbd5e1,
  f: 0xf1f5f9,
  q: 0xffffff,
  a: 0x60a5fa,
  s: 0x93c5fd,
  e: 0x1e3a8a,
  i: 0xffffff,
  m: 0x475569,
};
const YETI_32 = [
  "................................",
  "................................",
  "................................",
  "................................",
  ".............KKKKKKK............",
  ".........KKKKqqqqqqfKKKK........",
  ".........KqqqqqqqqffffK.........",
  ".......KKqqqqqqqqqfffffKK.......",
  "......KqqqqqqqssssfffffffK......",
  "......KqqqqqssssssssfffffK......",
  ".....KqqqqqFFFFssFFFFffffFK.....",
  ".....KqqqqssiessssieaafffFK.....",
  "....KqqqqqsseesssseeaafffFFK....",
  "....KqqqqqsssssssssaaaffFFFK....",
  "...KqqqqqfsssssssaaaaafFFFFFK...",
  "...KffffffsssmmmmmmaaafFFFFFK...",
  "...KfffffffaaaaaaaaaafFFFFFFK...",
  "...KfffffffffaaaaaaffFFFFFFFK...",
  "...KfffffffffffffffFFFFFSSSFK...",
  "...KffffffffffffffFFFFFSSSSSK...",
  "...KffffffffffffFFFFFFSSSSSSK...",
  "...KffffffffffFFFFFFSSSSSSSSK...",
  "...KfffSFFFFFFFFFFFSSSSSSSSSK...",
  "...KffFSSSFFFFFFFSSSSSSSSSSSK...",
  "...KffFSSFFFFFKKKKSSSSSSSSSSK...",
  "...KKKK.KFFFFK....KSSSSK.KKKK...",
  "........KFFFFK....KSSSSK........",
  "........KFFFFK....KSSSSK........",
  "........KFFFFK....KSSSSK........",
  ".......KKKKKKK....KKKKKKK.......",
  "................................",
  "................................",
];

// GLACIER GOLEM on a 32-cell grid: a faceted ice body (d c I i z) with lit
// facet edges (q), a dark crack at its core, crystal shoulders, glowing eyes
// in a dark visor and cracked stone fists (J j H)
const ICE_GOLEM_PALETTE = {
  K: 0x0c3440,
  d: 0x0e7490,
  c: 0x22d3ee,
  I: 0x67e8f9,
  i: 0xa5f3fc,
  z: 0xcaf8fd,
  q: 0xeffdfe,
  J: 0x334155,
  j: 0x6b7583,
  H: 0x94a0ae,
  e: 0xffffff,
};
const ICE_GOLEM_32 = [
  "................................",
  "................................",
  "...............KK...............",
  "..............KiiK..............",
  "...........KKKiiiIKKK...........",
  "...........KeKKKKKKeK...........",
  "...........KKeeKKeeKK...........",
  "......KK....KKKKKKKK....KK......",
  ".....KziK.KKzziiiiIIKK.KIIK.....",
  "....KiiicKzqzziiiiIIIcKccccK....",
  "...KKIIKczzzqiiiiiIIIccccccKK...",
  "..KHHKK.KzziiqiiiIIIIccK.KKjjK..",
  "..KJHHK.KziiiiqiIIIIIccK.KjjJK..",
  "..KHJHK.KiiiiiiddIIIccdK.KjJjK..",
  "..KHHJK..KiiiiIdKIIcccK..KJjJK..",
  "..KHHJK..KiiiIIKdIIczcK..KjJJK..",
  "..KjjHK...KIIIIIdIczcK...KJJJK..",
  ".KjjJjjK..KIIIIIIczcdK..KJJJJJK.",
  ".KjjjJJK...KIIIcczcdK...KJJJJJK.",
  ".KJjJjJK...KIcccccddK...KJJJJJK.",
  "..KKKKK...KcccccdddddK...KKKKK..",
  "..........KcccKKKKdddK..........",
  ".........KiiiK....KIIIK.........",
  ".........KiiiK....KIIcK.........",
  ".........KIIIK....KcccK.........",
  ".........KIIIK....KcccK.........",
  "........KIIIIK....KcdddK........",
  "........KccccK....KddddK........",
  "........KKKKKK....KKKKKK........",
  "................................",
  "................................",
  "................................",
];

// Volcano roster. The magma slime is SLIME_32 again in a molten ramp, the
// same one-grid-many-palettes trick as the king slime; the rest are new shapes.
const MAGMA_SLIME_PALETTE = { o: 0x3b0d06, s: 0x7c2d12, g: 0xc2410c, m: 0xf97316, h: 0xfdba74, w: 0xfef3c7 };
// fire imp on a 32-cell grid: bone horns (pale on their lit side, so they read
// on the ash), slanted glowing eyes, a fanged grin, flame-orange wings on
// their bones and a lit tail tip
const FIRE_IMP_PALETTE = {
  K: 0x1c0a0a,
  R: 0x991b1b,
  r: 0xdc2626,
  l: 0xef4444,
  h: 0xf87171,
  O: 0xc2410c,
  o: 0xf97316,
  a: 0xfb923c,
  y: 0xfde047,
  Y: 0xfef9c3,
  n: 0x78716c,
  N: 0xd6d3d1,
};
const FIRE_IMP_32 = [
  "................................",
  "................................",
  "........Nn............Nn........",
  "........Nn............Nn........",
  "........Nn............Nn........",
  ".........Nn..........Nn.........",
  "..........Nn.KKKKKK.Nn..........",
  "...........NKhhllllKN...........",
  "...........KhhhlllrrK...........",
  "..........KKKllllrrrKK..........",
  "..........KlYyylrYyyKK..........",
  "..........KllyyrryyrRK..........",
  "..........KrrrrrrrrRRK..........",
  ".KKK......KrKrrrrrRKRK......KKK.",
  "KaaaKK.....KKKKKKKKKK.....KKoooK",
  "KOaaaaKK.....YKKKKY.....KKooooOK",
  "KaOaaOaaKK...KllllK...KKooOoOOOK",
  "KooOooOoooK.KllllrrK.KoooOOOOOOK",
  ".KKooooOoolKlllllrrrKRoOOOOOOKK.",
  ".K.KooooolllllllrrrrRRROOOOOK.K.",
  ".K..KKoorroKllrrrrrrKORROOKK..K.",
  "....K.KOrKK.KrrrrrrK.KKROK.K....",
  "....K..KK...KrrrrrrK...KK..Ky...",
  "............KrrrrrRRK......yyy..",
  "............KrrKKRRRKK.....yYYy.",
  "............KrK..KRK.KK....yYyy.",
  "............KRK..KRK..KKK.KKKy..",
  "............KRK..KRK....KKK.....",
  "...........KKKK..KKKK...........",
  "................................",
  "................................",
  "................................",
];
// side-on fire lizard on a 32-cell grid: flame tongues along its spine (a
// white-hot root, yellow, orange tips), dark spots, a pale belly, an eye with
// a pupil and a tail hooked under it
const SALAMANDER_PALETTE = {
  K: 0x1c0a0a,
  d: 0x7c2d12,
  O: 0xc2410c,
  o: 0xf97316,
  l: 0xfb923c,
  h: 0xfdba74,
  b: 0xfcd34d,
  y: 0xfde047,
  Y: 0xfef9c3,
  w: 0xfef3c7,
};
const SALAMANDER_32 = [
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "..............o.................",
  "...........o..y..o..............",
  "...........y.oyo.y..............",
  "........o.oyooyooyo.o...........",
  "........Y.yYyyYyyYy.Y...........",
  ".......yYyyYyyYyyYyyYy..........",
  "..KKKKKKK.KKKKKKKKK.............",
  ".KhhwKlooKhllllddooKKK..........",
  "KKllwwoooOddllooooooOOKK........",
  "KlllloooOOllooooooOddOOOKKK.....",
  "KKKKKooOOOoooooooOOOOOdddoOKK...",
  ".KKoOObOOooooddOOOOOddbKKKKKOK..",
  "...KKKObbbbOOOOOOObbbbK.....KdK.",
  "......dddKKbbbbbbbdddK......KdK.",
  "......Kdd..KKKKKKKddd.......KdK.",
  "......KoK.........KOK.......KdK.",
  "......KOK.........KOK........KK.",
  ".....KKKKK.......KKKKK......KK..",
  "............................KK..",
  "..........................KKK...",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
];
// the volcano's boss on a 32-cell grid, head-on with its wings spread on
// their bones, bone horns, yellow eyes under heavy brows, a glowing belly of
// plates and a spaded tail; drawn at 1.5x in the field like the GLACIER GOLEM
const FLAME_DRAKE_PALETTE = {
  K: 0x1c0a0a,
  R: 0x7f1d1d,
  r: 0xb91c1c,
  l: 0xdc2626,
  h: 0xf87171,
  O: 0xc2410c,
  o: 0xf97316,
  a: 0xfb923c,
  y: 0xfde047,
  Y: 0xfef08a,
  n: 0x78716c,
  N: 0xd6d3d1,
};
const FLAME_DRAKE_32 = [
  ".........Nn..........Nn.........",
  ".........Nn..........Nn.........",
  "..........Nn..KKKK..Nn..........",
  "KK.........NKKhhllKKN.........KK",
  "KRKK.......KKKhlllKKKK......KKRK",
  "KaaRK......KYyllllyYK......KRooK",
  "KaaaaK....KllyllllyrrK....KooooK",
  "KaaaaaK...KlllllrrrrrK...KooooOK",
  "KaaaaaaK...KlllrrrrrK...KooooOOK",
  "KKaaaaaaK..KlrrrrrrRK..KooooOOKK",
  "K.KoRRoooK..KrKrrKRK..KoooRROK.K",
  "K.KKooRRRoK.KrrrRRRK.KoRRROOKK.K",
  "..K.KooooRK.KYRRRRYK.KROOOOK.K..",
  "..K.KooooRK..RRRRRR..KROOOOK.K..",
  "....KKRRRoK.KRRRRRRK.KORRRKK....",
  "....K.KooooKllYYyyrrKOOOOK.K....",
  "....K.KOOOlllYYYyyyrrrOOOK.K....",
  "......KOOOllloooooorrrOOOK......",
  ".......KOOlllYYYyyyrrrOOK.......",
  "........KllllYYYyyyrrRRK........",
  "........KlllloooooorrRRK........",
  "........KlKrryyyyyyrRKRK........",
  "........KK.KrryyyyrRK.KK........",
  "...........KrrooooRRK...........",
  "..........KKKKryyRKKKK..........",
  "..........KrKKKKKKKKRK..........",
  "..........KrRK....KRRRK......K..",
  "..........KRRK....KRRRKK....KrK.",
  "..........KRRK....KRRK.KKK.KrrrK",
  ".........KKKKK....KKKKK..KKKKKK.",
  "................................",
  "................................",
];
// bat on a 32-cell grid: wings spread to the top corners on finger bones (b),
// scalloped membranes (d/B), a furred body (B b z q), red eyes and an open
// screech with fangs. The membrane sits a step lighter than the old bat's so
// it still stands off the cave floor without the old white mouth.
const BAT_PALETTE = {
  K: 0x1e0b3d,
  d: 0x5b21b6,
  B: 0x7c3aed,
  b: 0x9d6cf7,
  z: 0xb99cfa,
  q: 0xd8c8fd,
  e: 0xf87171,
  w: 0xffffff,
  m: 0x7f1d1d,
  f: 0xffffff,
};
const BAT_32 = [
  "KK............................KK",
  "KBKK........................KKdK",
  "KBBBKK.....K........K.....KKBddK",
  "KBBBbBKK...KK......KK...KKBbdddK",
  "KBBbbBBBKK.KeK....KeK.KKBBBbbddK",
  "KbbBbbBBBBKqqzKKKKbbbKBBBBbbdbbK",
  "KKBBbbBBBBBBzzzzzbbbBBBBddbbddKK",
  "K.KBbbBBBBBBzzzzbbbBBBBdddbbdK.K",
  "...KbBbBBBBzweebbweeBddddbdbK...",
  "...KbBbBBBBqbeebbeeBbddddbdbK...",
  "....KKBbBBBqbbbBBBBBBdddbdKK....",
  "....K.KbBBBqqBKKKKBbBdddbK.K....",
  "....K..KdddqzzKmmKbBBdddK..K....",
  ".......KbKdzzzfmmfbBBdKbK.......",
  "........K.KdzzbKKbBBdK.K........",
  "........K..KbbbbbBBBK..K........",
  "............KbbbBBBK............",
  ".............KBKKBK.............",
  ".............KK..KK.............",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
];

// wasp on a 32-cell grid: a big yellow head with black visor eyes (a glint
// each) and mandibles, glassy wings (v w W) and a striped abdomen whose black
// bands catch a sheen (j) on the lit side
const WASP_PALETTE = {
  K: 0x2a1c05,
  O: 0xb06f06,
  Y: 0xe8a20c,
  y: 0xffdd44,
  z: 0xffec95,
  q: 0xfffbe6,
  k: 0x141414,
  j: 0x3d3d3d,
  i: 0xffffff,
  v: 0x8ea2c6,
  w: 0xc7d4ee,
  W: 0xeef3fb,
};
const WASP_32 = [
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "..........kk........kk..........",
  "...........k.KKKKKK.k...........",
  "...........KKqqzzzzKK...........",
  "..........KqqqzzzzyyyK..........",
  ".........KkkkzzzzykkkyK.........",
  ".........kkkkkzzyykkkkk.........",
  ".....vv.kikkkkzyyykikkkk.vv.....",
  "...vvWWvkkkkkzyyyyykkkkkvwwvv...",
  "..vWWWWvKkkkyyyyyyyYkkkKvwwwwv..",
  "..vWWWWWvKyyyyyyyYYYYOKvwwwwvv..",
  "..vWWWWWvKyyyyyYYYYYOOKvwwvvvv..",
  "...vwwwWWvKyYKYYYYKOOKvwwvvvv...",
  "....vwwwwv.KKYKYYKOKK.vvvvvv....",
  "....vwwwwwv.KKKKKKKK.vvvvvvv....",
  "....vvwwwvvKzzzyyyyYKvvvvvvv....",
  "......vvv.KzzzyyyyYYOK.vvv......",
  "..........KjjjkkkkkkkK..........",
  "..........KkkkkkkkkkkK..........",
  "..........KyyyYYYOOOOK..........",
  "..........KYYYYOOOOOOK..........",
  "...........KkkkkkkkkK...........",
  "...........kKKkkkkKKk...........",
  "...........k..KkKK..k...........",
  "..........kk...K....kk..........",
  "................................",
  "................................",
];

// spider on a 32-cell grid: legs arched up and out (two cells wide, lit along
// one), a big pair of red eyes over a small pair, fangs and an hourglass on
// its back
const SPIDER_PALETTE = {
  K: 0x1e0b3d,
  d: 0x5b21b6,
  B: 0x7c3aed,
  b: 0x9d6cf7,
  z: 0xb99cfa,
  q: 0xd8c8fd,
  e: 0xef4444,
  E: 0xb91c1c,
  i: 0xffffff,
  n: 0xf0abfc,
  f: 0xf5f3ff,
};
const SPIDER_32 = [
  "................................",
  "................................",
  "................................",
  "........bd............dd........",
  ".......bbd............ddb.......",
  ".......bdbd..........ddbd.......",
  ".....bbd.bd..........dd.ddb.....",
  ".....bbd..bd.KKKKKK.dd..ddb.....",
  "....bd.bd.bdKqzzzbbKdd.dd.dd....",
  "....bd..bd.KieezbieeK.dd..dd....",
  "....bd...bdKeeebbeeeKbd...dd....",
  "....bd....KzbbbbbBBBdK....dd....",
  "...bd.bd...KbEbBBBEdK...dd.dd...",
  "...bd.bbbd.KBBBBBBddK.ddbb.dd...",
  ".....bd..bbdKKKBdKKKddb..dd.....",
  ".....bd...KKzKfKKfKbKK...dd.....",
  ".....bd...KzzzzbbbbBBK...dd.....",
  ".....bd..KzzzzbbbbbBBBK..dd.....",
  "....bd.bbKzzznnnnnnBBBKbb.dd....",
  "....bd.bdKzzbbnnnnBBBBKdd.dd....",
  "....bd.bKbbbbbbnnBBBBBdKd.dd....",
  ".......bKbbbbbnnnnBBBddKd.......",
  ".......bdKbbbnnnnnnBddKdd.......",
  "......bd.KbbBBBBBBBdddK.dd......",
  "......bd.KBBBBBBBBddddK.dd......",
  "......bd..KBBBBBBddddK..dd......",
  "......bd..KKBBBdddddKK..dd......",
  "......bd....KddddddK....dd......",
  ".............KKKKKK.............",
  "................................",
  "................................",
  "................................",
];

// orc on a 32-cell grid: olive skin (a step off the goblin's mint and the
// forest floor's blue-green), a topknot, a heavy brow over red eyes, tusks, a
// bandolier and a club in its right hand
const ORC_PALETTE = {
  K: 0x1f2a0c,
  S: 0x5a7a2a,
  s: 0x7fa23a,
  L: 0xa6c65a,
  H: 0xd2e69a,
  h: 0x1f2e24,
  j: 0x3a4d3f,
  e: 0xff5555,
  w: 0xffffff,
  t: 0xf1f5e0,
  r: 0x8b5a2b,
  R: 0x5c3a1a,
  c: 0x9a6b3c,
  C: 0x6b4423,
};
const ORC_32 = [
  "................................",
  "................................",
  "................................",
  "................................",
  "..............KKKK..............",
  ".............KjjjjK.............",
  "...........KKjhhhhhKK...........",
  "..........KKKKKKKKKKKK..........",
  ".........KHHHHHHLLLLssKK........",
  ".........KHHHHHLLLLssssK........",
  "........KHKKKKKLLLsKKKKKK.......",
  "........KLLweeLLLssweeSSK.......",
  "........KLLLeeLSSsseeSSSK.......",
  "........KLLstsssssstSSSSK.......",
  ".........KsstKKKKKKtSSSK...KKK..",
  "..........KKKKKKKKKKKKK...KccCK.",
  ".......KKKLrRLLLsssssSsKK.KccCK.",
  "......KLLLLLrrRssssssSSssKKccK..",
  "......KLLKLLLLrrRsssSSSKSK.KK...",
  "......KssKLsssssrrRSSSSKSK.KK...",
  "......KssKsssssssSrRSSSKssKK....",
  "......KssKsssssSSSSSSSSKsSCK....",
  "......KSK.KrrrrrrrrrrRK.KSCK....",
  "......KKK.KrrrrrrrrRRRK..KKK....",
  "..........KRrRRKKKRRRRK.........",
  "..........KLLLK...KsSSK.........",
  "..........KsssK...KSSSK.........",
  "..........KsssK...KSSSK.........",
  ".........KKKKKK...KKKKKK........",
  "................................",
  "................................",
  "................................",
];

// MOSS GOLEM on a 32-cell grid: chamfered boulders (head, chest, shoulders,
// forearms, legs) shaded as flat faces lit from the top left -- top H, left
// L, front s, right and underside S -- under moss (M m n) that drips off
// every top face, vines with leaves down the chest and an arm, eyes glowing
// in a dark recess and a glowing crack at its core (it regenerates). K just
// dark enough to clear the forest's scrub, its boss zone, which swallowed the
// whole outline at 0x1e2620.
const MOSS_GOLEM_PALETTE = {
  K: 0x151c17,
  S: 0x5b6b5c,
  s: 0x7f8f80,
  L: 0xa3b2a4,
  H: 0xc9d3c9,
  e: 0x8ce99a,
  n: 0x2a4a1f,
  m: 0x4d7a35,
  M: 0x7fb04a,
  c: 0x37433a,
};
const MOSS_GOLEM_32 = [
  "................................",
  "................................",
  "................................",
  ".............KKKKKK.............",
  "............KMMMMMMK............",
  "...........KMmmmmmmMK...........",
  "...........KKKKKKKKKK...........",
  "...........KKeeKKeeKK...........",
  "....KKKK..KMKnnssnSKMK..KKKK....",
  "...KMMMMKKMmMKKKKKKMmMKKMMMMK...",
  "..KMmmmnKMnnmMMMMMMmmmnKnmmmMK..",
  "..KnnmmKMnmnmmmmmmmnmmnMKmnmnK..",
  "...KLnnKnmmnnmmnmmmsnnnnKnsnK...",
  "...KKKKKnnnsnMmsnmnssMsmKKKKK...",
  "..KHnHHKLsssnmnssnssnssnKHHHHK..",
  ".KHsnMHKLsssnnsscsssnssSKHHHsHK.",
  ".KLsnsSKLssnssscesssnssSKLsssSK.",
  ".KLsnsSKLsMnsssecssMsnsSKLsssSK.",
  ".KMnssSKLssnssscsssssnsSKLsssSK.",
  ".KLnssSKLsssnssssssssnsSKLsssSK.",
  ".KLnssSKLsssnssssssssssSKLsssSK.",
  ".KLsssSKKLsssnssssssssSKKLsssSK.",
  "..KLsSK..KLssnsssssssSK..KLsSK..",
  "...KKK...KLLSSKKKKSSSSK...KKK...",
  "........KHKKKK....KKKKHK........",
  "........KLHHHK....KHHHSK........",
  "........KLssSK....KLssSK........",
  "........KLssSK....KLssSK........",
  "........KLssSK....KLssSK........",
  ".........KKKK......KKKK.........",
  "................................",
  "................................",
];

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

// Town props (TownScene): the SHOP's produce crate and the BLACKSMITH's anvil
// beside their keepers, so the two read as places, and the flower patches and
// stones scattered over the southern meadow. Lit from the top left like the
// chest; '.' is the grass showing through.
const PRODUCE_CRATE_PALETTE = { b: 0x2b1a0c, d: 0x4a2f1a, w: 0x8a5a2b, W: 0xa9743a, r: 0xdc2626, R: 0xf87171, g: 0x65a30d, G: 0xa3e635 };
const PRODUCE_CRATE_TILE = [
  "................",
  "................",
  "................",
  ".....rR..gG.....",
  "...rRrRrgGgGg...",
  "..rrRrrrgggGgg..",
  ".bbbbbbbbbbbbbb.",
  ".bWWWWWWWWWWWWb.",
  ".bwwwwwwwwwwwdb.",
  ".bddddddddddddb.",
  ".bWWWWWWWWWWWWb.",
  ".bwwwwwwwwwwwdb.",
  ".bddddddddddddb.",
  ".bbbbbbbbbbbbbb.",
  "..bb........bb..",
  "................",
];
const ANVIL_PALETTE = { b: 0x111827, s: 0x374151, S: 0x6b7280, H: 0xd1d5db, t: 0x6b4423, T: 0x3f2a14, r: 0x8a5a2b };
// horn to the left, on a sawn stump
const ANVIL_TILE = [
  "................",
  "................",
  "................",
  "bbbbbbbbbbbbbb..",
  "bHHHHHHHHHHHSSb.",
  ".bbSSSSSSSSSSsb.",
  "...bbbSSSSsbbb..",
  ".....bSSSsb.....",
  "....bSSSSSsb....",
  "...bbbbbbbbbb...",
  "...btttttttTb...",
  "...brrrrrrrrb...",
  "...bttttttTTb...",
  "...bttttttTTb...",
  "....bbbbbbbb....",
  "................",
];
const FLOWERS_PALETTE = { p: 0xf9a8d4, w: 0xf8fafc, y: 0xfde047, c: 0xf59e0b, s: 0x14532d, l: 0x15803d };
const FLOWERS_TILE = [
  "................",
  "................",
  "................",
  "................",
  "..........w.....",
  "....p....wcw....",
  "...pcp....w.....",
  "....p.....s.....",
  "....s....ls.....",
  "....sl....s..y..",
  "..........s.ycy.",
  "......y......y..",
  ".....ycy.....s..",
  "......y.....ls..",
  "......sl........",
  "......s.........",
];
const STONES_PALETTE = { b: 0x1f2937, d: 0x4b5563, m: 0x6b7280, h: 0x9ca3af };
const STONES_TILE = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "......bbbb......",
  ".....bhhmmb.....",
  "....bhmmmmdb....",
  "....bmmmmddb.bb.",
  "..bbbmmdddb.bhmb",
  ".bhhmbbbbbb.bmdb",
  ".bmmddb......bb.",
  "..bbbb..........",
  "................",
];

// The cave mouth (TownScene's CAVE, and the way out inside the cave): a
// boulder outcrop lit from the top left with an arched opening, dark only
// inside, on a dim floor where the road runs in. 128px, two tiles each way.
const CAVE_PALETTE = { b: 0x1a1714, d: 0x3b3631, m: 0x5c554d, l: 0x80776b, h: 0xa89d8c, k: 0x060508, K: 0x110f14, n: 0x231d1a };
const CAVE_TILE = [
  "................................",
  "................................",
  "................................",
  "................................",
  "...........b...bb.bb............",
  "...........bbbbhlblmb...........",
  "..........bmmdddllmmb...........",
  ".........bmmddlddmmmdbb.........",
  "........bmmddllldddddddb........",
  ".......bmmddlllmmdhhlddhb.......",
  "......bddddlllmmmdhllldhlb......",
  "......bhlddllmmmdhlllmdlllbb....",
  "....bbhlllddmmbbbbllmmddlmmb....",
  "...bmdlllmmdbbkkkkbbmmdddddb....",
  "...bddllmmmbkkkkkkkkbdddhlllb...",
  "..bdddlmmmbkkkkkkkkkkbdhlllmb...",
  "..bdhdddmdbkkkkkkkkkkbdlllmmmb..",
  "..bhlllddbkkkkkkkkkkkkbllmmmdb..",
  ".bhlllmmdbkkkkkkkkkkkkbddmmddhb.",
  "bdlllmmmdbkkkkkkkkkkkkbhddddhllb",
  "bddlmmmddbkkkkkkkkkkkkbllldhlllb",
  "bldddmdddbkkkkkkkkkkkkbllmddllmb",
  "bllmddddhbkkkkkkkkkkkkblmmmdlmmb",
  "blmmmdhhlbkkkkkkkkkkkkbmmmdddddb",
  "bmmmddhllbkkkkkkkkkkkkbmmdddhhlb",
  "bmmdddlllbKKKKKKKKKKKKbdddddhllb",
  "bmdddddlmbKKKKKKKKKKKKbhhlldlllb",
  "bdddhlddmbKKKKKKKKKKKKbhlllddlmb",
  "bdhhlllddbKKKKKKKKKKKKblllmmdmmb",
  ".bhlllmmmbnnnnnnnnnnnnbllmmmddb.",
  "..bllmmmdbnnnnnnnnnnnnblmmmddb..",
  "...bbbbbbbnnnnnnnnnnnnbbbbbbb...",
];
// The farm's tilled field laid over its 3x2 soil tiles: ridge and furrow
// rows inside a low rail fence, open to the south where the road comes in.
const FARM_FIELD_PALETTE = { r: 0x7a5536, R: 0x8a6340, f: 0x553a24, F: 0x46301e, e: 0x3f2a19, W: 0xc08a4e, w: 0x8a5a2b, P: 0x4a2f1a };
const FARM_FIELD_TILE = [
  "WW......WW......WW......WW......WW......WW....WW",
  "wPWWWWWWwPWWWWWWwPWWWWWWwPWWWWWWwPWWWWWWwPWWWWwP",
  "wPwwwwwwwPwwwwwwwPwwwwwwwPwwwwwwwPwwwwwwwPwwwwwP",
  "wPFFFFFFwPFFFFFFwPFFFFFFwPFFFFFFwPFFFFFFwPFFFFwP",
  "wPfffffFwPffffffwPffFfffwPffffffwPffffffwPffffwP",
  "wFffffffffffFffffffffffffFffffffffffffFfffffffFw",
  "wFrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrFw",
  "wFrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrFw",
  "WWffffffffffffFffffffffffffFffffffffffffFfffffWW",
  "wPffffFffffffffffffFffffffffffffFffffffffffffFwP",
  "wPRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrwP",
  "wPrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrwP",
  "wPffffffFffffffffffffFffffffffffffFfffffffffffwP",
  "wFfffffffffffFffffffffffffFffffffffffffFffffffFw",
  "wFrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrFw",
  "wFrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrFw",
  "WWFffffffffffffFffffffffffffFffffffffffffFffffWW",
  "wPfffffFffffffffffffFffffffffffffFffffffffffffwP",
  "wPrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrwP",
  "wPrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrwP",
  "wPfffffffFffffffffffffFffffffffffffFffffffffffwP",
  "wFffffffffffffFffffffffffffFffffffffffffFfffffFw",
  "wFrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrFw",
  "wFrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrFw",
  "WWfFffffffffffffFffffffffffffFffffffffffffFfffWW",
  "wPffffffFffffffffffffFffffffffffffFfffffffffffwP",
  "wPrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrwP",
  "wPrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRwP",
  "wPffffffffFffffffffffffFffffffffffffFfffffffffwP",
  "wFFffffffffffffFffffffffffffFffffffffffffFffffFw",
  "wFrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrFw",
  "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
];

// Item icons: one per thing a panel lists (InventoryUI, Shop, the BLACKSMITH,
// HOME's KITCHEN), as "icon-<key>" for the inventory, material, ingredient
// or dish key, and "icon-map" for a treasure map. 16-cell grids baked through
// Scale2x like the props, so 64px, and drawn at half that: 32px beside a
// 24px name, each Scale2x cell one screen pixel. Outline b, lit from the top
// left. A grid is shared where only the colours change: the flask by POTION
// and MPOTION, the sword and the shield by every tier -- in the very colours
// of the hero's gear (EQUIP_*_PALETTE above), the wooden shield included --
// and the two scales, the two bowls. Each sits in the middle 14 cells, so
// the needs lines' 28px pitch never puts two icons' art on top of each other.

const ICON_FLASK = [
  "................",
  "......bbbb......",
  "......bkKb......",
  ".....bbkKbb.....",
  "......bgsb......",
  "......bgsb......",
  "....bbgsssbb....",
  "...bglLLLLLLb...",
  "..bglLLLLLLLDb..",
  "..bglLLLLLLLDb..",
  "..bgLLLLLLLLDb..",
  "..blLLLLLLLDDb..",
  "...bLLLLLLDDb...",
  "....bbDDDDbb....",
  "......bbbb......",
  "................",
];
const ICON_TALL = [
  "................",
  ".....bbbbbb.....",
  ".....bkkkKb.....",
  ".....bbbbbb.....",
  "......bgsb......",
  ".....bbgsbb.....",
  "....bglLLLLb....",
  "....bglLLLLb....",
  "....bglLLLDb....",
  "....bwwwwwwb....",
  "....bglLLLDb....",
  "....bgLLLLDb....",
  "....blLLLDDb....",
  "....bLLLDDDb....",
  ".....bbbbbb.....",
  "................",
];
const ICON_ELIXIR = [
  "................",
  ".......bb.......",
  "......bkKb......",
  "......bbbb......",
  "......bgsb......",
  ".....bgllLb.....",
  "....bglLLLLb....",
  "...bglLLLLLDb...",
  "..bglLLwwLLLDb..",
  "...bLLLwwLLDb...",
  "....bLLLLLDb....",
  ".....bLLLDb.....",
  "......bLDb......",
  ".......bb.......",
  "................",
  "................",
];
const ICON_BOMB = [
  "................",
  "..........y.....",
  ".........yYy....",
  "........ff......",
  ".......f........",
  ".....bbKbb......",
  "...bbgsssSbb....",
  "..bgssSSSSSSb...",
  "..bgsSSSSSSSb...",
  ".bgsSSSSSSSSDb..",
  ".bsSSSSSSSSSDb..",
  ".bSSSSSSSSSDDb..",
  "..bSSSSSSSDDb...",
  "..bbSSSSSDDbb...",
  "....bbbbbbb.....",
  "................",
];
const ICON_CANDY = [
  "................",
  "................",
  "................",
  "................",
  "bb....bbbb....bb",
  "bWb..bwppPb..bWb",
  "bwWbbwppppPbbWwb",
  "bwWWbppwppPbWWwb",
  "bwWWbpPpwpPbWWwb",
  "bwWbbpPPpPPbbWwb",
  "bWb..bPPPPb..bWb",
  "bb....bbbb....bb",
  "................",
  "................",
  "................",
  "................",
];
const ICON_SWORD = [
  "................",
  "............bbb.",
  "...........bWwb.",
  "..........bWwvb.",
  ".........bWwvb..",
  "........bWwvb...",
  ".......bWwvb....",
  "..bb..bWwvb.....",
  "..bgbbWwvb......",
  "...bgbwvb.......",
  "....bgbb........",
  "...bbbgb........",
  "..bbbb.bgb......",
  ".bgbb...bb......",
  ".bgb............",
  "..b.............",
];
const ICON_SHIELD = [
  "................",
  "..bbbbbbbbbbbb..",
  "..bhhssssssssb..",
  "..bhSSSSSSSSsb..",
  "..bhSSSSSSSSsb..",
  "..bsSSSddSSSsb..",
  "..bsSSdwddSSsb..",
  "..bsSSdddSSSsb..",
  "..bsSSSddSSSsb..",
  "...bsSSSSSSsb...",
  "...bsSSSSSSsb...",
  "....bsSSSSsb....",
  ".....bsSSsb.....",
  "......bssb......",
  ".......bb.......",
  "................",
];
const ICON_AMULET = [
  "................",
  "....bb....bb....",
  "...bcb....bcb...",
  "...bcb....bcb...",
  "....bcb..bcb....",
  ".....bcbbcb.....",
  "......bccb......",
  ".....bbyybb.....",
  "....byYYyyyb....",
  "...byYwrryyYb...",
  "...byYrrRryyb...",
  "...byyrRRryyb...",
  "....byyrryyb....",
  ".....byyyyb.....",
  "......bbbb......",
  "................",
];
const ICON_CHARM = [
  "................",
  "......bbbb......",
  "......byyb......",
  ".....bbyybb.....",
  "....byybbyyb....",
  "...byb.bb.byb...",
  "..byb.bllb.byb..",
  "..byb.blLLbbyb..",
  "..byb.blLLLbyb..",
  "..byb..bLLDbyb..",
  "..byb...bDbbyb..",
  "...byb...bbyb...",
  "....byybbyyb....",
  ".....bbyybb.....",
  "......bbbb......",
  "................",
];
const ICON_RING = [
  "................",
  "................",
  "......bbbb......",
  ".....brrRRb.....",
  "....bbwrRRbb....",
  "....bybbbbyb....",
  "...byYbbbbyyb...",
  "..byYb....byyb..",
  "..byb......byb..",
  "..byb......byb..",
  "..byyb....byyb..",
  "...byyb..byyb...",
  "....byyyyyyb....",
  ".....bbbbbb.....",
  "................",
  "................",
];
const ICON_HEART = [
  "................",
  "......bbbb......",
  ".....bcbbcb.....",
  "....bcb..bcb....",
  "....bcb..bcb....",
  "..bbbbbbbbbbbb..",
  ".brrwrbbrrrRRb..",
  ".brwrrrrrrrRRb..",
  ".brrrrrrrrrRRb..",
  "..brrrrrrrRRb...",
  "...brrrrrRRb....",
  "....brrrRRb.....",
  ".....brRRb......",
  "......bRb.......",
  ".......b........",
  "................",
];
const ICON_TALISMAN = [
  "................",
  "....bbbbbbbb....",
  "....bwwwwwWb....",
  "....bwrrrrWb....",
  "....bwrwwrWb....",
  "....bwrrrrWb....",
  "....bwwwwwWb....",
  "....bwkkkkWb....",
  "....bwwwwwWb....",
  "....bwkkkkWb....",
  "....bwwwwwWb....",
  "....bbbbbbbb....",
  "......brrb......",
  ".....brrrRb.....",
  ".....brRRRb.....",
  "......bbbb......",
];
const ICON_GEL = [
  "................",
  "................",
  "................",
  "......bbbb......",
  ".....bwlllb.....",
  "....bwlLLLLb....",
  "...bwlLLLLLLb...",
  "...blLLLLLLLb...",
  "..blLLLLLLLLDb..",
  "..blLLLLLLLLDb..",
  "..bLLLLLLLLDDb..",
  "...bLLLLLLDDb...",
  "....bbbbbbbb....",
  "................",
  "................",
  "................",
];
const ICON_WING = [
  "................",
  ".bb.............",
  ".bzbb...........",
  ".bzzzbb.........",
  "..bzBBzbb.......",
  "..bzBBBBzbb.....",
  "...bzBBBBBBzbb..",
  "...bzBBBBBBBBzb.",
  "....bzBBBBBBBBb.",
  "....bzBBBdBBdb..",
  ".....bzBBdbBdb..",
  ".....bzBdbbdb...",
  "......bzdb.bb...",
  "......bbb.......",
  "................",
  "................",
];
const ICON_FANG = [
  "................",
  "...bbbbbb.......",
  "..bwwwwWWb......",
  "..bwWWWWWb......",
  "...bwWWWWb......",
  "...bwWWWWb......",
  "....bwWWWWb.....",
  "....bwWWWWb.....",
  ".....bwWWWWb....",
  ".....bwWWWWb....",
  "......bwWWWb....",
  ".......bwWWb....",
  "........bwWb....",
  ".........bWb....",
  "..........b.....",
  "................",
];
const ICON_SILK = [
  "................",
  "...bbbbbbbbbb...",
  "...btttttttTb...",
  "....bbbbbbbb....",
  "....bwwwwwWb....",
  "....bwWWWWWb....",
  "....bwwwwwWb....",
  "....bwWWWWWb....",
  "....bwwwwwWb....",
  "....bwWWWWWb....",
  "....bwwwwwWb....",
  "....bbbbbbbb....",
  "...btttttttTb...",
  "...bbbbbbbbbb...",
  "......bwb.......",
  ".......bwb......",
];
const ICON_FUR = [
  "................",
  "................",
  "....bb..bb......",
  "...bwwbbwwb.bb..",
  "..bwWWwwWWwbwwb.",
  "..bwWWWWWWWwWWb.",
  ".bwWWWWWWWWWWWb.",
  ".bwWWWWWWWWWWFb.",
  ".bwWWWWWWWWWWFb.",
  ".bwWWWWWWWWWFFb.",
  "..bWWWWWWWWWFFb.",
  "..bWFWWFWWFFFb..",
  "...bFbbFbbFFb...",
  "....b..b..bb....",
  "................",
  "................",
];
const ICON_SCALE = [
  "................",
  "......bbbb......",
  ".....bwlllb.....",
  "....bwlLLLLb....",
  "...bwlLLLLLLb...",
  "...blLLLLLLLb...",
  "..blLLLLLLLLDb..",
  "..blLLLLLLLLDb..",
  "..bLLLLLLLLLDb..",
  "..bLLLLLLLLDDb..",
  "...bLLLLLLDDb...",
  "...bLLLLLDDDb...",
  "....bLLLDDDb....",
  ".....bbDDbb.....",
  ".......bb.......",
  "................",
];
const ICON_CORE = [
  "................",
  ".....bbbbbb.....",
  "...bbkkkkKKbb...",
  "..bkkyyYYoKKKb..",
  "..bkyYYYYyoKKb..",
  ".bkyYwYYYyooKKb.",
  ".bkyYYYYYyooKKb.",
  ".bkyYYYYyyooKKb.",
  ".bkoyyyyyooKKKb.",
  ".bKkooooooKKKKb.",
  "..bKKkkkkKKKKb..",
  "..bKKKKKKKKKKb..",
  "...bbKKKKKKbb...",
  ".....bbbbbb.....",
  "................",
  "................",
];
const ICON_CORN = [
  "................",
  "..........gg....",
  ".........gG.....",
  "......bbbbG.....",
  ".....byyYYbG....",
  "....byYyYyYb....",
  "....byyYyYyb.g..",
  "...byYyYyYybgG..",
  "...byyYyYyYbG...",
  "..byYyYyYyYbG...",
  "..byyYyYyYbgG...",
  ".gbyYyYyYbgG....",
  ".gGbbYyYbgG.....",
  "..gGGbbbgG......",
  "....gGGGG.......",
  "................",
];
const ICON_BEAN = [
  "................",
  "............bb..",
  "...........bgb..",
  ".........bbgb...",
  "......bbbGGb....",
  "....bbgGllGb....",
  "...bgGlLLlGb....",
  "..bgGlLLGlLb....",
  "..bgllGlLLGb....",
  ".bgGlLLGlLb.....",
  ".bgGlLLGllb.....",
  ".bgGGlLGGb......",
  "..bGGGGGb.......",
  "...bbbbb........",
  "................",
  "................",
];
const ICON_PUMPKIN = [
  "................",
  ".......bb.......",
  "......bgGb......",
  "....bbbgbbbb....",
  "...boooOOoooOb..",
  "..boYoOooOoOOOb.",
  "..bYoooOoooOOOb.",
  ".bYoooOooOooOOOb",
  ".bYoooOooOooOOOb",
  ".boooOoooOooOOOb",
  ".boooOoooOoOOOOb",
  "..booOoooOoOOOb.",
  "..bOoOooOOOOOb..",
  "...bbbbbbbbbb...",
  "................",
  "................",
];
const ICON_FLOWER = [
  "................",
  "......bbbb......",
  ".....bwwWWb.....",
  "..bbbbwWWbbbb...",
  ".bwwWbbWbbwWWb..",
  ".bwWWWbyybWWWb..",
  "..bbWbyYYybWbb..",
  "..bwbbyYYybbWb..",
  ".bwWWWbyybWWWb..",
  ".bwWWbbWbbWWWb..",
  "..bbbbwWWbbbb...",
  ".....bwWWb.gg...",
  "......bbbbgG....",
  "........gGG.....",
  ".......gG.......",
  "................",
];
const ICON_FISH = [
  "................",
  "................",
  "................",
  "...........bb...",
  "......bbbbbbsb..",
  "....bbllLLLLbsb.",
  "...blwlLLLLLLbsb",
  "..bllkLLLLLLLLbb",
  "..bLLLLLLLLLLLbb",
  "...bLLLLLLLLDbsb",
  "....bbDDDDDDbsb.",
  "......bbbbbbsb..",
  "...........bb...",
  "................",
  "................",
  "................",
];
const ICON_PLATE_FISH = [
  "................",
  "................",
  "................",
  "................",
  "...........bb...",
  "......bbbbbbsb..",
  "....bbllkLkLbsb.",
  "...blwlLkLkLLbsb",
  "...bLLkLkLkLLbbb",
  "....bbDDDDDDbsb.",
  "..bbbbbbbbbbbbbb",
  ".bwwwwwwwwwwwwWb",
  "..bWWWWWWWWWWWb.",
  "...bbbbbbbbbbb..",
  "................",
  "................",
];
const ICON_BOWL = [
  "................",
  ".....w...w......",
  "....w...w.......",
  ".....w...w......",
  "....w...w.......",
  "..bbbbbbbbbbbb..",
  ".bLLlLLGLLlLLLb.",
  ".bLGLLLLLGLLLLb.",
  ".bccccccccccCCb.",
  "..bcccccccCCCb..",
  "..bccccccccCCb..",
  "...bccccccCCb...",
  "....bbccCCbb....",
  "....bbbbbbbb....",
  "................",
  "................",
];
const ICON_PIE = [
  "................",
  "................",
  "................",
  "..........bb....",
  "........bbwwb...",
  "......bbwwWWb...",
  "....bbooooooWb..",
  "..bbooooooooOWb.",
  ".bwooooooooOOOb.",
  ".bWWWWWWWWWWWWb.",
  ".bccccccccccCCb.",
  ".bcCcCcCcCcCCCb.",
  "..bbbbbbbbbbbbb.",
  "................",
  "................",
  "................",
];
const ICON_CUP = [
  "................",
  ".......w..w.....",
  "......w..w......",
  ".......w..w.....",
  "................",
  "..bbbbbbbbbb....",
  "..bllLLLLLLbbbb.",
  "..bwwwwwwwWbbWb.",
  "..bwwwwwwwWb.bb.",
  "..bwwwwwwWWbbWb.",
  "...bwwwwWWbbbb..",
  "...bwwwwWWb.....",
  "..bbbbbbbbbbb...",
  ".bWWWWWWWWWWWb..",
  "..bbbbbbbbbbb...",
  "................",
];
const ICON_MAP = [
  "................",
  "................",
  "..bbbbbbbbbbbb..",
  ".bwWbppppppPPbb.",
  ".bWbpppppppppPb.",
  "..bpppGGppppppb.",
  "..bppGGGpprpRpb.",
  "..bpppGppppRppb.",
  "..bppppppprpRpb.",
  "..bpppGGpppppPb.",
  "..bppGGGppppPPb.",
  "..bpppppppppPPb.",
  ".bbbbbbbbbbbPbb.",
  ".bwWWWWWWWWWbb..",
  "..bbbbbbbbbbb...",
  "................",
];
const ICON_POTION_PALETTE = { b: 0x1d1424, k: 0xa8743f, K: 0x6b4423, g: 0xe8f6ff, s: 0xb8d8e8, l: 0xff8a8a, L: 0xe0454a, D: 0x9a1c2a };
const ICON_M_POTION_PALETTE = { b: 0x1d1424, k: 0xa8743f, K: 0x6b4423, g: 0xe8f6ff, s: 0xb8d8e8, l: 0x93c5fd, L: 0x3b82f6, D: 0x1e3a8a };
const ICON_HI_POTION_PALETTE = {
  b: 0x1d1424,
  k: 0xa8743f,
  K: 0x6b4423,
  g: 0xe8f6ff,
  s: 0xb8d8e8,
  l: 0xff8a8a,
  L: 0xe0454a,
  D: 0x9a1c2a,
  w: 0xf3e2c6,
};
const ICON_ETHER_PALETTE = {
  b: 0x1d1424,
  k: 0xa8743f,
  K: 0x6b4423,
  g: 0xe8f6ff,
  s: 0xb8d8e8,
  l: 0xc4b5fd,
  L: 0x8b5cf6,
  D: 0x4c1d95,
  w: 0xf3e2c6,
};
const ICON_ELIXIR_PALETTE = {
  b: 0x1d1424,
  k: 0xa8743f,
  K: 0x6b4423,
  g: 0xe8f6ff,
  s: 0xb8d8e8,
  l: 0xfef3c7,
  L: 0xfbbf24,
  D: 0xb45309,
  w: 0xffffff,
};
const ICON_BOMB_PALETTE = {
  b: 0x1d1424,
  s: 0x6b7280,
  S: 0x374151,
  D: 0x1f2937,
  g: 0xd1d5db,
  K: 0x6b4423,
  f: 0xa8743f,
  y: 0xfde047,
  Y: 0xfff3c4,
};
const ICON_CANDY_PALETTE = { b: 0x1d1424, w: 0xfdf2f8, W: 0xf9a8d4, p: 0xec4899, P: 0xbe185d };
const ICON_SWORD_PALETTE = { b: 0x1d1424, W: 0xf8fafc, w: 0xd1d5db, v: 0xa3aab5, g: 0xf59e0b };
const ICON_IRON_SWORD_PALETTE = { b: 0x1d1424, W: 0xe8edf3, w: 0xb3c0cf, v: 0x7a899d, g: 0x8a9ab0 };
const ICON_MYTHRIL_SWORD_PALETTE = { b: 0x1d1424, W: 0xffffff, w: 0xe0f2fe, v: 0xa9d8f2, g: 0xa5f3fc };
const ICON_DRAKE_BLADE_PALETTE = { b: 0x1d1424, W: 0xfdba74, w: 0xdc2626, v: 0x991b1b, g: 0xfbbf24 };
const ICON_SHIELD_PALETTE = { b: 0x1d1424, s: 0x5c3a1e, S: 0x9a6a3a, d: 0x6b4423, h: 0xc08a52, w: 0xd6cbb5 };
const ICON_IRON_SHIELD_PALETTE = { b: 0x1d1424, s: 0xb4c1d0, S: 0x4b6080, d: 0x2e3b4e, h: 0xdbe3ec, w: 0xf4f7fa };
const ICON_MYTHRIL_SHIELD_PALETTE = { b: 0x1d1424, s: 0x7dd3fc, S: 0x38bdf8, d: 0x0ea5e9, h: 0xbae6fd, w: 0xf0f9ff };
const ICON_GLACIER_MAIL_PALETTE = { b: 0x1d1424, s: 0xa5f3fc, S: 0x67e8f9, d: 0x0e7490, h: 0xcffafe, w: 0xffffff };
const ICON_AMULET_PALETTE = { b: 0x1d1424, c: 0x8a5a2b, y: 0xfbbf24, Y: 0xfde68a, r: 0xa78bfa, R: 0x6d28d9, w: 0xffffff };
const ICON_ANTIDOTE_CHARM_PALETTE = { b: 0x1d1424, y: 0xfbbf24, l: 0x86efac, L: 0x22c55e, D: 0x15803d };
const ICON_EMBER_RING_PALETTE = { b: 0x1d1424, y: 0xfbbf24, Y: 0xfde68a, r: 0xf97316, R: 0xc2410c, w: 0xfff3c4 };
const ICON_LIFE_CHARM_PALETTE = { b: 0x1d1424, c: 0x8a5a2b, r: 0xef4444, R: 0xb91c1c, w: 0xfecaca };
const ICON_TALISMAN_PALETTE = { b: 0x1d1424, w: 0xfdf6e3, W: 0xd8cfb4, r: 0xdc2626, R: 0x991b1b, k: 0x3b2a4a };
const ICON_SLIME_GEL_PALETTE = { b: 0x1d1424, w: 0xeafff0, l: 0x86efac, L: 0x22c55e, D: 0x15803d };
const ICON_BAT_WING_PALETTE = { b: 0x1d1424, z: 0xa78bfa, B: 0x6d28d9, d: 0x4c1d95 };
const ICON_WOLF_FANG_PALETTE = { b: 0x1d1424, w: 0xffffff, W: 0xd8dde6 };
const ICON_SPIDER_SILK_PALETTE = { b: 0x1d1424, t: 0x8a5a2b, T: 0x5c3a1a, w: 0xffffff, W: 0xd6dbe4 };
const ICON_YETI_FUR_PALETTE = { b: 0x1d1424, w: 0xffffff, W: 0xe2e8f0, F: 0x94a3b8 };
const ICON_FROST_SCALE_PALETTE = { b: 0x1d1424, w: 0xffffff, l: 0xa5f3fc, L: 0x38bdf8, D: 0x0369a1 };
const ICON_MAGMA_CORE_PALETTE = { b: 0x1d1424, k: 0x57534e, K: 0x292524, y: 0xfde047, Y: 0xfff3c4, o: 0xf97316, w: 0xffffff };
const ICON_DRAKE_SCALE_PALETTE = { b: 0x1d1424, w: 0xffd0b0, l: 0xf87171, L: 0xdc2626, D: 0x7f1d1d };
const ICON_CORN_PALETTE = { b: 0x1d1424, y: 0xfde047, Y: 0xeab308, g: 0x4ade80, G: 0x15803d };
const ICON_BEAN_PALETTE = { b: 0x1d1424, g: 0x86efac, G: 0x16a34a, l: 0xd9f99d, L: 0x65a30d };
const ICON_PUMPKIN_PALETTE = { b: 0x1d1424, o: 0xfb923c, O: 0xc2410c, Y: 0xfdba74, g: 0x4ade80, G: 0x166534 };
const ICON_MOONFLOWER_PALETTE = { b: 0x1d1424, w: 0xffffff, W: 0xc7d2fe, y: 0xfde047, Y: 0xfbbf24, g: 0x4ade80, G: 0x166534 };
const ICON_FISH_PALETTE = { b: 0x1d1424, l: 0x9fd4ff, L: 0x5b9bd5, D: 0x2c5f8a, w: 0xffffff, k: 0x1d1424, s: 0x7aa9cf };
const ICON_GRILLED_FISH_PALETTE = {
  b: 0x1d1424,
  l: 0xe8b07a,
  L: 0xc0703a,
  D: 0x7a3a1a,
  k: 0x3a1a0a,
  w: 0xffffff,
  s: 0xa06030,
  W: 0xc8d0dc,
};
const ICON_BEAN_SOUP_PALETTE = { b: 0x1d1424, w: 0xe2e8f0, l: 0xbef264, L: 0x84cc16, G: 0x3f6212, c: 0xc0703a, C: 0x7a3a1a };
const ICON_FISH_STEW_PALETTE = { b: 0x1d1424, w: 0xe2e8f0, l: 0xfde0a0, L: 0xe0a050, G: 0xfff7ed, c: 0x8a8f9a, C: 0x4b5160 };
const ICON_PUMPKIN_PIE_PALETTE = { b: 0x1d1424, o: 0xfb923c, O: 0xc2410c, w: 0xfff7ed, W: 0xfed7aa, c: 0xd9a35a, C: 0x92602a };
const ICON_MOON_TEA_PALETTE = { b: 0x1d1424, w: 0xffffff, W: 0xc8d0dc, l: 0xc7d2fe, L: 0x818cf8 };
const ICON_MAP_PALETTE = { b: 0x1d1424, p: 0xf3e2c6, P: 0xc8a878, w: 0xfff8e8, W: 0xd8c098, G: 0x65a30d, r: 0xdc2626, R: 0x991b1b };

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

// The keepers' workplaces (TownScene addWorkplace): a 2x2-tile building right
// behind each town NPC that runs something, so they read as keepers standing in
// front of their shop instead of people on bare grass. 32-cell grids on 4px
// cells, 128px like HOME, baked through Scale2x like the props: drawn the way
// HOME is -- seen straight on, flat walls and roofs with a darker band along
// the top -- plus the props' outline. Each grid's left half is the keeper's
// tile, so what they keep (a door, the tools, the way in) sits on that side.
// A window pane is one block, not four: Scale2x rounds a 2x2 pane into a dot.

// ELDER: a stone cottage under a steep slate gable, the door on the left where
// the elder stands, a lit window on the right and one in the gable
const ELDER_HUT_PALETTE = {
  b: 0x1d1424,
  R: 0x2b4150,
  r: 0x3d5a6b,
  s: 0x777588,
  z: 0x55536a,
  t: 0x7a4f2a,
  T: 0x4a2f1a,
  y: 0xffd672,
  Y: 0xfff0b8,
  d: 0x4a2f5c,
  D: 0x24142e,
};
const ELDER_HUT = [
  "................................",
  "................................",
  "...............bb...............",
  "..............bRRb....bbbb......",
  ".............bRRRRb...bssb......",
  "...........bbrrrrrrbb.bssb......",
  "..........brrrrrrrrrrbzssb......",
  ".........brrrrryyrrrrrzssb......",
  "........brrrrrryYrrrrrzssb......",
  ".......brrrrrrrrrrrrrrzzzb......",
  ".....bbrrrrrrrrrrrrrrrrrrrb.....",
  "....brrrrrrrrrrrrrrrrrrrrrrb....",
  "...brrrrrrrrrrrrrrrrrrrrrrrrb...",
  "..brrrrrrrrrrrrrrrrrrrrrrrrrrb..",
  ".brrrrrrrrrrrrrrrrrrrrrrrrrrrrb.",
  "bbRRRRRRRRRRRRRRRRRRRRRRRRRRRRbb",
  "..bzzzzzzzzzzzzzzzzzzzzzzzzzzb..",
  "..bzzzzzzzzzzzzzzzzzzzzzzzzzzb..",
  "..bsssssssssssssssstttttttsssb..",
  "..bssdddddddssssssstYYYyytsssb..",
  "..bszdDdDdDdsszzzzstYyyyytzzsb..",
  "..bssdDdDdDdssssssstyyyyytsssb..",
  "..bssdDdDdDdssssssstyyyyytsssb..",
  "..bssdDdDdDdzsssssstyyyyytsssb..",
  "..bssdDdDdDdssssssstttttttsssb..",
  "..bssdDdDdydssssssTTTTTTTTTssb..",
  "..bszdDdDdDdsszzzzsssssszzzzsb..",
  "..bssdDdDdDdsssssssssssssssssb..",
  "..bssdDdDdDdsssssssssssssssssb..",
  "..bssdDdDdDdsssssssssssssssssb..",
  "..bzzdDdDdDdzzzzzzzzzzzzzzzzzb..",
  "..bbbbbbbbbbbbbbbbbbbbbbbbbbbb..",
];

// SHOP: a market stall, a striped awning over shelves of potions, bottles on
// the counter and a lantern under the awning's left end
const SHOP_STALL_PALETTE = {
  b: 0x1d1424,
  y: 0xffd672,
  Y: 0xfff0b8,
  a: 0xf2c14e,
  A: 0xfbf1d6,
  c: 0xd9a43a,
  C: 0xd8cfb4,
  o: 0xa8743f,
  t: 0x7a4f2a,
  T: 0x4a2f1a,
  p: 0xe0454a,
  u: 0x4f8be8,
  g: 0x4cbf6a,
  W: 0xf4f1ea,
};
const SHOP_STALL = [
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  ".bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.",
  "bccccccccccccccccccccccccccccccb",
  "baaaAAAAaaaaAAAAaaaaAAAAaaaaAAAb",
  "baaaAAAAaaaaAAAAaaaaAAAAaaaaAAAb",
  "baaaAAAAaaaaAAAAaaaaAAAAaaaaAAAb",
  "baaaAAAAaaaaAAAAaaaaAAAAaaaaAAAb",
  "baaaAAAAaaaaAAAAaaaaAAAAaaaaAAAb",
  "baaaCAAAcaaaCAAAcaaaCAAAcaaaCAAb",
  "botTTTTTTTTTTTTTTTTTTTTTTTTTTotb",
  ".btTypTuTgTTpTuTTTgTTpTuTgTTTob.",
  ".btTYpTuTgTTpTuTTTgTTpTuTgTTTob.",
  ".btttttttttttttttttttttttttttob.",
  ".btTTTTTTTTTTTTTTTTTTTTTTTTTTob.",
  ".btTTTpTuTgTTpTuTTTgTTpTuTgTTob.",
  ".btTTTtTuTtTTptuTTTgTtpTutgTTob.",
  ".bttttWtttWtttWttttttWtttWtttob.",
  ".btTTpppTuuuTgggTTTTpppTuuuTTob.",
  ".btTTpWpTuWuTgWgTTTTpWpTuWuTTob.",
  ".btooooooooooooooooooooooooooob.",
  ".btooooooooooooooooooooooooooob.",
  ".btttttTtttttTtttttTtttttTtttob.",
  ".btttttTtttttTtttttTtttttTtttob.",
  ".btttttTtttttTtttttTtttttTtttob.",
  ".btttttTtttttTtttttTtttttTtttob.",
  ".btttttTtttttTtttttTtttttTtttob.",
  ".btttttTtttttTtttttTtttttTtttob.",
  ".bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.",
];

// BLACKSMITH: a stone forge, a tall chimney, hammer and tongs on the wall
// behind the smith and the hearth open and burning on the right, by the anvil
const FORGE_PALETTE = {
  b: 0x1d1424,
  R: 0x2e2e38,
  r: 0x41414e,
  S: 0x9c9aa8,
  s: 0x777588,
  z: 0x55536a,
  D: 0x140c10,
  f: 0xf97316,
  F: 0xfdba74,
  Y: 0xfff3c4,
  g: 0xb4421a,
  t: 0x7a4f2a,
  T: 0x4a2f1a,
};
const FORGE = [
  "...bbbbbb.......................",
  "...bSSSSb.......................",
  "...bssssb.......................",
  "...bssssb.......................",
  "...bssssb.......................",
  "...bssssb.......................",
  "...bssssb.......................",
  "...bssssb.......................",
  "...bssssb.......................",
  "bbbRRRRRRbbbbbbbbbbbbbbbbbbbbbbb",
  "bRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRb",
  "brrrrrrrrrrrrrrrrrrrrrrrrrrrrrrb",
  "brrrrrrrrrrrrrrrrrrrrrrrrrrrrrrb",
  "brrrrrrrrrrrrrrrrrrrrrrrrrrrrrrb",
  "brrrrrrrrrrrrrrrrrrrrrrrrrrrrrrb",
  "brrrrrrrrrrrrrrrrrrrrrrrrrrrrrrb",
  ".bzzzzzzzzzzzzzzzzzzzzzzzzzzzzb.",
  ".bzzzzzzzzzzzzzzzzzzzzzzzzzzzzb.",
  ".bssTTsssssTsTssssssssssssssssb.",
  ".bssTTssssssTsssszDDDDDDDDDDzsb.",
  ".bssstsssssTsTsssDDDDDDDDDDDDsb.",
  ".bzzztssssTszzzzsDDDDDDDDDDDDsb.",
  ".bssstsssTsssssssDDDDDDDDDDDDsb.",
  ".bssstsssssssssssDDDDDDDDDDDDsb.",
  ".bssssszzzzssssssDDDDDDDDDDDDsb.",
  ".bsssssssssssssssDDDgDDggDDgDsb.",
  ".bsssssssssssssssDDgffgfFfggDsb.",
  ".bzzzzsssssszzzzsDgfFFfFFFfgDsb.",
  ".bsssssssssssssssDffFYFFYFffDsb.",
  ".bsssssssssssssssDggfffffgggDsb.",
  ".bzzzzzzzzzzzzzzsggggggggggggsb.",
  ".bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.",
];

// ARENA: a palisade of pointed logs, a portcullised gateway under a gilt
// shield, a lantern under its lintel and a banner either side
const ARENA_GATE_PALETTE = {
  b: 0x1d1424,
  o: 0xa8743f,
  t: 0x7a4f2a,
  T: 0x4a2f1a,
  y: 0xffd672,
  D: 0x1d1424,
  s: 0x6b6b78,
  a: 0xfbbf24,
  A: 0xd99a14,
  p: 0xc0392b,
};
const ARENA_GATE = [
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  ".b.......b.......b.......b......",
  ".bb......bb..bbbbab......bb.....",
  "bttb.b..bttbbapaapab.b..bttb.b..",
  "bttb.bb.bttTaappppab.bb.bttb.bb.",
  "bTTTbTTbottTaaappaaabttbTTTTbTTb",
  "btAaaaaTottToaaaaaaTottToAaaaatb",
  "btAaaaaTooooooaaaaoooooooAaaaatb",
  "btAaaaaTTTTTTTTTTTTTTTTToAaaaatb",
  "btApppaToDDDDDDTDDDDDDDToApppatb",
  "btAapaaToDsDDsDysDDsDDDToAapaatb",
  "btApppaToDsDDsDDsDDsDDDToApppatb",
  "btAaaaaToDssssssssssssDToAaaaatb",
  "btAaaaaToDsDDsDDsDDsDDDToAaaaatb",
  "btAaaaaToDsDDsDDsDDsDDDToAaaaatb",
  "btAaaaaToDsDDsDDsDDsDDDToAaaaatb",
  "btAaaaaToDssssssssssssDToAaaaatb",
  "btaAoaaToDsDDsDDsDDsDDDToaATaatb",
  "bttTottToDsDDsDDsDDsDDDTottTottb",
  "bttTottToDsDDsDDsDDsDDDTottTottb",
  "bttTottToDssssssssssssDTottTottb",
  "bttTottToDsDDsDDsDDsDDDTottTottb",
  "bttTottToDsDDsDDsDDsDDDTottTottb",
  "bttTottToDsDDsDDsDDsDDDTottTottb",
  "bttTottToDssssssssssssDTottTottb",
  "bttTottToDsDDsDDsDDsDDDTottTottb",
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
];

// GAMBLER: a striped tent with a pennant, its flap tied back on a lantern-lit
// way in and a fortune wheel painted on the right
const GAMBLER_TENT_PALETTE = {
  b: 0x1d1424,
  m: 0xc0378a,
  c: 0xf3e2c6,
  a: 0xf2c14e,
  p: 0xe0454a,
  D: 0x1d1424,
  T: 0x4a2f1a,
  y: 0xffd672,
  Y: 0xfff0b8,
};
const GAMBLER_TENT = [
  "...............bbbb.............",
  "...............bmmbbb...........",
  "...............bmb..............",
  "...............bb...............",
  "..............bccb..............",
  "............bbmcmcbb............",
  "...........bcmmcmcmmb...........",
  "..........bccmccmccmcb..........",
  "........bbccmmccmmccmmbb........",
  ".......bmccmmmccmmccmmmcb.......",
  "......bmcccmmcccmmcccmmccb......",
  "....bbmcccmmmcccmmmcccmmmcbb....",
  "...bmmcccmmmmcccmmmcccmmmmccb...",
  "..bmmccccmmmccccmmmccccmmmcccb..",
  "bbmmccccmmmmccccmmmmccccmmmmccbb",
  "baaaaaaaaaaaaaaaaaaaaaaaaaaaaaab",
  "bmmmccccmmmmccccmmmmccccmmmmcccb",
  ".bmccccccmmccccccmmccccccmmcccb.",
  ".bmmccccmmmmccccmmmmccccmmmmccb.",
  ".bmmccccmmmmccccmmmmccpaammmccb.",
  ".bmmccDDDDDcccccmmmmpppaaapmccb.",
  ".bmmcDDDDDDDccccmmmmappaappmccb.",
  ".bmmcDDDDDDDccccmmmaaapTppppccb.",
  ".bmmcDDDTDDDccccmmmaaaTTTaaaccb.",
  ".bmmcDDyYyDDccccmmmppppTpaaaccb.",
  ".bmmcDDDyDDDccccmmmmppaappamccb.",
  ".bmmcDDDDDDDccccmmmmpaaapppmccb.",
  ".bmmcDDDDDDDccccmmmmccaapmmmccb.",
  ".bmmcDDDDDDDccccmmmmccccmmmmccb.",
  ".bmmcDDDDDDDccccmmmmccccmmmmccb.",
  ".bmmcDDDDDDDccccmmmmccccmmmmccb.",
  ".bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.",
];

// HUNTER: a log cabin under a mossy roof, antlers over the door, a lantern
// beside it and a hide stretched on its frame
const HUNTER_LODGE_PALETTE = {
  b: 0x1d1424,
  R: 0x2f4a2a,
  r: 0x3f5f34,
  o: 0xa8743f,
  t: 0x7a4f2a,
  T: 0x4a2f1a,
  d: 0x3a2a3e,
  D: 0x1d1424,
  y: 0xffd672,
  Y: 0xfff0b8,
  B: 0xe8dcc0,
  h: 0xc89a6a,
  H: 0xa87a4a,
};
const HUNTER_LODGE = [
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "bRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRb",
  "brrrrrrrrrrrrrrrrrrrrrrrrrrrrrrb",
  "brrrrrrrrrrrrrrrrrrrrrrrrrrrrrrb",
  "brrrrrrrrrrrrrrrrrrrrrrrrrrrrrrb",
  "brrrrrrrrrrrrrrrrrrrrrrrrrrrrrrb",
  "brrrrrrrrrrrrrrrrrrrrrrrrrrrrrrb",
  "bRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRb",
  "bottttttttttttttttttttttttttttob",
  "bTttBtBtttBtBtttttttttttttttttTb",
  ".bTTTBBTTTBBTTTTTttttttttttttTb.",
  "bottttBBBBBtttttttTThhTThhTTttob",
  "bTtttttttttttTttttThhhhhhhhTttTb",
  ".bTTTdddddddTyTTTtTThHHHHhTTtTb.",
  "botttdDdDdDdtYttttTThHHHHhTTttob",
  "bTtttdDdDdDdttttttTThHHHHhTTttTb",
  ".bTTTdDdDdDdTTTTTtTThHHHHhTTtTb.",
  "botttdDdDdDdttttttTThHHHHhTTttob",
  "bTtttdDdDdDdttttttThhHHHHhhTttTb",
  ".bTTTdDdDdydTTTTTtThhTTTThhTtTb.",
  "botttdDdDdDdttttttTTTTTTTTTTttob",
  "bTtttdDdDdDdttttttttttttttttttTb",
  ".bTTTdDdDdDdTTTTTTTTTTTTTTTTTTb.",
  ".bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.",
];

// Their winter look ("<key>-winter"): two cells of snow under the outline on
// every column's top, a third on every third column, so roofs, the awning, the
// tent's cone and the palisade's points all catch it. Baked through `scene`,
// not `this`: check:art reads the plain grids, and this only recolours them.
const SNOW_CAP_PALETTE = { n: 0xf2f7fb, N: 0xc9d9e6 };
function snowCapped(rows: readonly string[]): string[] {
  const g = rows.map((r) => [...r]);
  for (let x = 0; x < g[0].length; x++) {
    const y0 = g.findIndex((r) => r[x] !== ".");
    if (y0 < 0) continue;
    const cap: Array<[number, string | null]> = [
      [1, "n"],
      [2, x % 3 ? "N" : "n"],
      [3, x % 3 === 0 ? "N" : null],
    ];
    for (const [k, c] of cap) {
      const row = g[y0 + k];
      if (c && row && row[x] !== "." && row[x] !== "b") row[x] = c;
    }
  }
  return g.map((r) => r.join(""));
}
const WORKPLACE_ART: ReadonlyArray<readonly [string, readonly string[], Record<string, number>]> = [
  ["hut-elder", ELDER_HUT, ELDER_HUT_PALETTE],
  ["stall-shop", SHOP_STALL, SHOP_STALL_PALETTE],
  ["forge", FORGE, FORGE_PALETTE],
  ["gate-arena", ARENA_GATE, ARENA_GATE_PALETTE],
  ["tent-gambler", GAMBLER_TENT, GAMBLER_TENT_PALETTE],
  ["lodge-hunter", HUNTER_LODGE, HUNTER_LODGE_PALETTE],
];
function makeWorkplaceSnow(scene: Phaser.Scene): void {
  for (const [key, rows, palette] of WORKPLACE_ART)
    makeTexture(scene, `${key}-winter`, snowCapped(rows), { ...palette, ...SNOW_CAP_PALETTE });
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

// HOME's extensions (home.ts), one texture per level, drawn the way makeHouse
// draws the cottage — the same flat blocks, the same 128px box on the same
// 2x2 footprint, so the collision, the HOME spot and its tag never move —
// with each level's additions on top: 1 a stone chimney and doorstep, 2
// window boxes and herb pots, 3 a lit dormer, door lanterns and a gilt eave.
// The two windows stay where they were: the night glows (TownScene) sit on
// them. Each level also gets a winter cap ("house-N-snow", N from 0) laid
// over it when the town wears its snow skin: snow along the roof ridge,
// icicles at the eave, on the chimney and the dormer once they are there.
function makeHouseLevels(scene: Phaser.Scene): void {
  for (let level = 1; level <= 3; level++) {
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
    // 1: HEARTH — a stone chimney off the right of the ridge, a doorstep
    g.fillStyle(0x6b6670, 1);
    g.fillRect(94, 6, 16, 22);
    g.fillStyle(0x56515b, 1);
    g.fillRect(94, 14, 16, 2);
    g.fillRect(94, 22, 16, 2);
    g.fillStyle(0x4b4650, 1);
    g.fillRect(92, 2, 20, 6);
    g.fillStyle(0x8b8494, 1);
    g.fillRect(42, 122, 44, 6);
    if (level >= 2) {
      // 2: HERB GARDEN — window boxes in bloom, a herb pot either side of the door
      g.fillStyle(0x6d4a1f, 1);
      g.fillRect(12, 84, 32, 6);
      g.fillRect(84, 84, 32, 6);
      g.fillStyle(0x4d7c0f, 1);
      g.fillRect(14, 80, 28, 4);
      g.fillRect(86, 80, 28, 4);
      g.fillStyle(0xf472b6, 1);
      g.fillRect(18, 78, 4, 4);
      g.fillRect(30, 78, 4, 4);
      g.fillRect(98, 78, 4, 4);
      g.fillStyle(0xfde047, 1);
      g.fillRect(24, 78, 4, 4);
      g.fillRect(90, 78, 4, 4);
      g.fillRect(106, 78, 4, 4);
      g.fillStyle(0xa0522d, 1);
      g.fillRect(32, 114, 12, 12);
      g.fillRect(84, 114, 12, 12);
      g.fillStyle(0x65a30d, 1);
      g.fillRect(30, 106, 16, 8);
      g.fillRect(82, 106, 16, 8);
    }
    if (level >= 3) {
      // 3: FEATHER BEDS — a dormer with a lit window, lanterns, a gilt eave
      g.fillStyle(0x6d2130, 1);
      g.fillTriangle(48, 30, 64, 14, 80, 30);
      g.fillStyle(0x453a52, 1);
      g.fillRect(52, 28, 24, 24);
      g.fillStyle(0xffd672, 1);
      g.fillRect(58, 34, 12, 12);
      g.fillStyle(0xd4a017, 1);
      g.fillRect(0, 54, 128, 2);
      g.fillStyle(0x2a1f2e, 1);
      g.fillRect(40, 84, 4, 12);
      g.fillRect(84, 84, 4, 12);
      g.fillStyle(0xffd672, 1);
      g.fillRect(38, 96, 8, 8);
      g.fillRect(82, 96, 8, 8);
    }
    g.generateTexture(`house-${level}`, 128, 128);
    g.destroy();
  }
  for (let level = 0; level <= 3; level++) {
    const g = scene.add.graphics();
    g.fillStyle(0xf1f5f9, 1);
    g.fillRect(0, 20, 128, 8);
    g.fillStyle(0xcbd5e1, 1);
    g.fillRect(0, 26, 128, 2);
    g.fillStyle(0xe0f2fe, 1);
    for (const x of [6, 22, 38, 58, 76, 96, 116]) g.fillRect(x, 56, 2, 4 + (x % 3) * 2);
    g.fillStyle(0xf1f5f9, 1);
    if (level >= 1) g.fillRect(92, 0, 20, 4);
    if (level >= 3) g.fillTriangle(56, 22, 64, 14, 72, 22);
    g.generateTexture(`house-${level}-snow`, 128, 128);
    g.destroy();
  }
}

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

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    this.buildTextures();
    this.scene.start("Title");
  }

  private buildTextures(): void {
    // Every grid bakes through Scale2x (pixelart.ts) except where it bends
    // what the grid was drawn to say. The terrain floors stay blocky: the
    // water's and the lava's ripple dashes came out as diagonal streaks, and
    // the transition tiles below draw the same fill, so all of them keep the
    // one 4px pattern and meet without a seam (the grass, path, tall grass,
    // soil, ash and scorch scatter is lone cells, which Scale2x leaves as
    // they are anyway). The npc's face stays blocky too: Scale2x curved its flat
    // eyes into smiles. The villagers (whose fisher did the same) and the
    // monsters it bent -- the wisp's eyes went lopsided, the yeti's mouth
    // turned down, the wasp's eye bars uneven -- are redrawn on the 32-cell
    // grid instead.
    keepBlocky(
      GRASS_TILE,
      GRASS_TILE_2,
      GRASS_TILE_3,
      GRASS_TILE_4,
      PATH_TILE,
      PATH_TILE_2,
      PATH_TILE_3,
      PATH_TILE_4,
      TALL_TILE,
      SOIL_TILE,
      ASH_TILE,
      SCORCH_TILE,
      WATER_A,
      WATER_B,
      WATER_A_2,
      WATER_B_2,
      WATER_A_3,
      WATER_B_3,
      WATER_A_4,
      WATER_B_4,
      LAVA_A,
      LAVA_B,
      NPC_TILE,
      // the fence posts slanted
      FARM_FIELD_TILE,
    );
    // The shoreline and the road's edge round off; the water's and the path's
    // fill inside them stays the base tiles' blocky pattern.
    smoothBoundaryOnly(
      "gq",
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
    );
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

    drawHero.call(this);
    drawLookPreviews(this);

    makeTexture(this, "equip-sword", EQUIP_SWORD_32, EQUIP_SWORD_PALETTE, ART_PX);
    makeTexture(this, "equip-shield", EQUIP_SHIELD_32, EQUIP_SHIELD_PALETTE, ART_PX);
    makeTexture(this, "equip-iron-sword", EQUIP_SWORD_32, EQUIP_IRON_SWORD_PALETTE, ART_PX);
    makeTexture(this, "equip-iron-shield", EQUIP_SHIELD_32, EQUIP_IRON_SHIELD_PALETTE, ART_PX);
    makeTexture(this, "equip-mythril-sword", EQUIP_SWORD_32, EQUIP_MYTHRIL_SWORD_PALETTE, ART_PX);
    makeTexture(this, "equip-mythril-shield", EQUIP_SHIELD_32, EQUIP_MYTHRIL_SHIELD_PALETTE, ART_PX);
    // the forged gear too, so the title's save cards can draw it
    bakeCraftedGear(this);

    makeTexture(this, "npc", NPC_TILE, NPC_PALETTE);
    makeTexture(this, "npc-elder", NPC_ELDER_32, NPC_ELDER_PALETTE, ART_PX);
    makeTexture(this, "npc-shop", NPC_SHOP_32, NPC_SHOP_PALETTE, ART_PX);
    makeTexture(this, "npc-guard", NPC_GUARD_32, NPC_GUARD_PALETTE, ART_PX);
    makeTexture(this, "npc-hunter", NPC_HUNTER_32, NPC_HUNTER_PALETTE, ART_PX);
    makeTexture(this, "npc-gambler", NPC_GAMBLER_32, NPC_GAMBLER_PALETTE, ART_PX);
    makeTexture(this, "npc-arena", NPC_ARENA_32, NPC_ARENA_PALETTE, ART_PX);
    makeTexture(this, "npc-blacksmith", NPC_BLACKSMITH_32, NPC_BLACKSMITH_PALETTE, ART_PX);
    // villagers: two stride frames plus a standing pose each (src/ui/Villagers.ts)
    makeTexture(this, "villager-farmer-0", [...FARMER_TOP_32, ...HERO_LEGS_STRIDE_A_32], FARMER_PALETTE, ART_PX);
    makeTexture(this, "villager-farmer-1", [...FARMER_TOP_32, ...HERO_LEGS_PASS_A_32], FARMER_PALETTE, ART_PX);
    makeTexture(this, "villager-farmer-idle", [...FARMER_TOP_32, ...HERO_LEGS_IDLE_32], FARMER_PALETTE, ART_PX);
    makeTexture(this, "villager-fisher-0", [...FISHER_TOP_32, ...HERO_LEGS_STRIDE_A_32], FISHER_PALETTE, ART_PX);
    makeTexture(this, "villager-fisher-1", [...FISHER_TOP_32, ...HERO_LEGS_PASS_A_32], FISHER_PALETTE, ART_PX);
    makeTexture(this, "villager-fisher-idle", [...FISHER_TOP_32, ...HERO_LEGS_IDLE_32], FISHER_PALETTE, ART_PX);
    makeTexture(this, "villager-traveler-0", [...TRAVELER_TOP_32, ...HERO_LEGS_STRIDE_A_32], TRAVELER_PALETTE, ART_PX);
    makeTexture(this, "villager-traveler-1", [...TRAVELER_TOP_32, ...HERO_LEGS_PASS_A_32], TRAVELER_PALETTE, ART_PX);
    makeTexture(this, "villager-traveler-idle", [...TRAVELER_TOP_32, ...HERO_LEGS_IDLE_32], TRAVELER_PALETTE, ART_PX);
    makeTexture(this, "slime", SLIME_32, SLIME_PALETTE, ART_PX);
    makeTexture(this, "goldSlime", SLIME_32, GOLD_SLIME_PALETTE, ART_PX);
    makeTexture(this, "king", SLIME_32, KING_SLIME_PALETTE, ART_PX);
    makeTexture(this, "goblin", GOBLIN_32, GOBLIN_PALETTE, ART_PX);
    makeTexture(this, "cursedGoblin", GOBLIN_32, CURSED_GOBLIN_PALETTE, ART_PX);
    makeTexture(this, "troll", TROLL_32, TROLL_PALETTE, ART_PX);
    makeTexture(this, "mossGolem", MOSS_GOLEM_32, MOSS_GOLEM_PALETTE, ART_PX);
    makeTexture(this, "wolf", WOLF_32, WOLF_PALETTE, ART_PX);
    makeTexture(this, "bat", BAT_32, BAT_PALETTE, ART_PX);
    makeTexture(this, "wasp", WASP_32, WASP_PALETTE, ART_PX);
    makeTexture(this, "spider", SPIDER_32, SPIDER_PALETTE, ART_PX);
    makeTexture(this, "orc", ORC_32, ORC_PALETTE, ART_PX);
    makeTexture(this, "wisp", WISP_32, WISP_PALETTE, ART_PX);
    makeTexture(this, "frostMoth", FROST_MOTH_32, FROST_MOTH_PALETTE, ART_PX);
    makeTexture(this, "yeti", YETI_32, YETI_PALETTE, ART_PX);
    makeTexture(this, "iceGolem", ICE_GOLEM_32, ICE_GOLEM_PALETTE, ART_PX);
    makeTexture(this, "magmaSlime", SLIME_32, MAGMA_SLIME_PALETTE, ART_PX);
    makeTexture(this, "fireImp", FIRE_IMP_32, FIRE_IMP_PALETTE, ART_PX);
    makeTexture(this, "salamander", SALAMANDER_32, SALAMANDER_PALETTE, ART_PX);
    makeTexture(this, "flameDrake", FLAME_DRAKE_32, FLAME_DRAKE_PALETTE, ART_PX);

    makeTexture(this, "spark", SPARK_TILE, SPARK_PALETTE);
    makeTexture(this, "glow", GLOW_TILE, GLOW_PALETTE);
    makeTexture(this, "coin", COIN_TILE, COIN_PALETTE);
    makeTexture(this, "firefly", FIREFLY_TILE, FIREFLY_PALETTE);
    makeTexture(this, "crop-sprout", SPROUT_TILE, SPROUT_PALETTE);
    makeTexture(this, "crop-corn", CORN_TILE, CORN_PALETTE);
    makeTexture(this, "crop-bean", BEAN_TILE, BEAN_PALETTE);
    makeTexture(this, "chest", CHEST_TILE, CHEST_PALETTE);
    makeTexture(this, "chest-open", CHEST_OPEN_TILE, CHEST_PALETTE);
    makeTexture(this, "produce-crate", PRODUCE_CRATE_TILE, PRODUCE_CRATE_PALETTE);
    makeTexture(this, "anvil", ANVIL_TILE, ANVIL_PALETTE);
    makeTexture(this, "flowers", FLOWERS_TILE, FLOWERS_PALETTE);
    makeTexture(this, "stones", STONES_TILE, STONES_PALETTE);
    makeTexture(this, "icon-potion", ICON_FLASK, ICON_POTION_PALETTE);
    makeTexture(this, "icon-mPotion", ICON_FLASK, ICON_M_POTION_PALETTE);
    makeTexture(this, "icon-hiPotion", ICON_TALL, ICON_HI_POTION_PALETTE);
    makeTexture(this, "icon-ether", ICON_TALL, ICON_ETHER_PALETTE);
    makeTexture(this, "icon-elixir", ICON_ELIXIR, ICON_ELIXIR_PALETTE);
    makeTexture(this, "icon-bomb", ICON_BOMB, ICON_BOMB_PALETTE);
    makeTexture(this, "icon-candy", ICON_CANDY, ICON_CANDY_PALETTE);
    makeTexture(this, "icon-sword", ICON_SWORD, ICON_SWORD_PALETTE);
    makeTexture(this, "icon-ironSword", ICON_SWORD, ICON_IRON_SWORD_PALETTE);
    makeTexture(this, "icon-mythrilSword", ICON_SWORD, ICON_MYTHRIL_SWORD_PALETTE);
    makeTexture(this, "icon-drakeBlade", ICON_SWORD, ICON_DRAKE_BLADE_PALETTE);
    makeTexture(this, "icon-shield", ICON_SHIELD, ICON_SHIELD_PALETTE);
    makeTexture(this, "icon-ironShield", ICON_SHIELD, ICON_IRON_SHIELD_PALETTE);
    makeTexture(this, "icon-mythrilShield", ICON_SHIELD, ICON_MYTHRIL_SHIELD_PALETTE);
    makeTexture(this, "icon-glacierMail", ICON_SHIELD, ICON_GLACIER_MAIL_PALETTE);
    makeTexture(this, "icon-amulet", ICON_AMULET, ICON_AMULET_PALETTE);
    makeTexture(this, "icon-antidoteCharm", ICON_CHARM, ICON_ANTIDOTE_CHARM_PALETTE);
    makeTexture(this, "icon-emberRing", ICON_RING, ICON_EMBER_RING_PALETTE);
    makeTexture(this, "icon-lifeCharm", ICON_HEART, ICON_LIFE_CHARM_PALETTE);
    makeTexture(this, "icon-talisman", ICON_TALISMAN, ICON_TALISMAN_PALETTE);
    makeTexture(this, "icon-slimeGel", ICON_GEL, ICON_SLIME_GEL_PALETTE);
    makeTexture(this, "icon-batWing", ICON_WING, ICON_BAT_WING_PALETTE);
    makeTexture(this, "icon-wolfFang", ICON_FANG, ICON_WOLF_FANG_PALETTE);
    makeTexture(this, "icon-spiderSilk", ICON_SILK, ICON_SPIDER_SILK_PALETTE);
    makeTexture(this, "icon-yetiFur", ICON_FUR, ICON_YETI_FUR_PALETTE);
    makeTexture(this, "icon-frostScale", ICON_SCALE, ICON_FROST_SCALE_PALETTE);
    makeTexture(this, "icon-magmaCore", ICON_CORE, ICON_MAGMA_CORE_PALETTE);
    makeTexture(this, "icon-drakeScale", ICON_SCALE, ICON_DRAKE_SCALE_PALETTE);
    makeTexture(this, "icon-corn", ICON_CORN, ICON_CORN_PALETTE);
    makeTexture(this, "icon-bean", ICON_BEAN, ICON_BEAN_PALETTE);
    makeTexture(this, "icon-pumpkin", ICON_PUMPKIN, ICON_PUMPKIN_PALETTE);
    makeTexture(this, "icon-moonflower", ICON_FLOWER, ICON_MOONFLOWER_PALETTE);
    makeTexture(this, "icon-fish", ICON_FISH, ICON_FISH_PALETTE);
    makeTexture(this, "icon-grilledFish", ICON_PLATE_FISH, ICON_GRILLED_FISH_PALETTE);
    makeTexture(this, "icon-beanSoup", ICON_BOWL, ICON_BEAN_SOUP_PALETTE);
    makeTexture(this, "icon-fishStew", ICON_BOWL, ICON_FISH_STEW_PALETTE);
    makeTexture(this, "icon-pumpkinPie", ICON_PIE, ICON_PUMPKIN_PIE_PALETTE);
    makeTexture(this, "icon-moonTea", ICON_CUP, ICON_MOON_TEA_PALETTE);
    makeTexture(this, "icon-map", ICON_MAP, ICON_MAP_PALETTE);
    makeTexture(this, "cave", CAVE_TILE, CAVE_PALETTE);
    makeTexture(this, "farm-field", FARM_FIELD_TILE, FARM_FIELD_PALETTE);

    makeHouse(this);
    makeHouseLevels(this);
    makeTexture(this, "hut-elder", ELDER_HUT, ELDER_HUT_PALETTE);
    makeTexture(this, "stall-shop", SHOP_STALL, SHOP_STALL_PALETTE);
    makeTexture(this, "forge", FORGE, FORGE_PALETTE);
    makeTexture(this, "gate-arena", ARENA_GATE, ARENA_GATE_PALETTE);
    makeTexture(this, "tent-gambler", GAMBLER_TENT, GAMBLER_TENT_PALETTE);
    makeTexture(this, "lodge-hunter", HUNTER_LODGE, HUNTER_LODGE_PALETTE);
    makeWorkplaceSnow(this);
    makeSign(this);
    makeBattleBgs(this);
    makeTitleBg(this);
  }
}
