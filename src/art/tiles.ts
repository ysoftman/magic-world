import { keepBlocky, smoothBoundaryOnly } from "../pixelart";

// The terrain's grids and palettes: grass, water, trees, paths, the shore and
// road transitions, tall grass, soil, the house footprint and the volcano's
// floor. tilesets.ts bakes them into the tilesets and their skins.

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
export const GRASS_PALETTE = { g: 0x1f5c42, h: 0x216246 };
export const GRASS_TILE = [
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
export const GRASS_TILE_2 = [
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
export const GRASS_TILE_3 = [
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
export const GRASS_TILE_4 = [
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
export const WATER_PALETTE = { d: 0x011654, B: 0x01207f, W: 0x0133a9, l: 0x2f6ecb, h: 0x7fc6f0 };
export const WATER_A = [
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
export const WATER_B = [
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
export const WATER_A_2 = [
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
export const WATER_B_2 = [
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
export const WATER_A_3 = [
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
export const WATER_B_3 = [
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
export const WATER_A_4 = [
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
export const WATER_B_4 = [
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
export const TREE_PALETTE = {
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
export const TREE_TILE = [
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
export const TREE_TILE_2 = [
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
export const TREE_TILE_3 = [
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
export const TREE_TILE_4 = [
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
export const PATH_PALETTE = { p: 0x735f43, h: 0x796446, D: 0x40331f, P: 0x5e4c33, m: 0x8b7454, S: 0xa89275 };
export const PATH_TILE = [
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
export const PATH_TILE_2 = [
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
export const PATH_TILE_3 = [
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
export const PATH_TILE_4 = [
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
export const SHORE_PALETTE = { W: 0x0133a9, B: 0x01207f, h: 0x7fc6f0, l: 0x2f6ecb, g: 0x1f5c42, q: 0x216246 };
export const ROAD_PALETTE = { p: 0x735f43, P: 0x5e4c33, S: 0x887356, m: 0x897353, g: 0x1f5c42, q: 0x216246 };
export const SHORE_TILE_1 = [
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
export const SHORE_TILE_2 = [
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
export const SHORE_TILE_3 = [
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
export const SHORE_TILE_4 = [
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
export const SHORE_TILE_5 = [
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
export const SHORE_TILE_6 = [
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
export const SHORE_TILE_7 = [
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
export const SHORE_TILE_8 = [
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
export const SHORE_TILE_9 = [
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
export const SHORE_TILE_10 = [
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
export const SHORE_TILE_11 = [
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
export const SHORE_TILE_12 = [
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
export const SHORE_TILE_13 = [
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
export const SHORE_TILE_14 = [
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
export const ROAD_TILE_1 = [
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
export const ROAD_TILE_2 = [
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
export const ROAD_TILE_3 = [
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
export const ROAD_TILE_4 = [
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
export const ROAD_TILE_5 = [
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
export const ROAD_TILE_6 = [
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
export const ROAD_TILE_7 = [
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
export const ROAD_TILE_8 = [
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
export const ROAD_TILE_9 = [
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
export const ROAD_TILE_10 = [
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
export const ROAD_TILE_11 = [
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
export const ROAD_TILE_12 = [
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
export const ROAD_TILE_13 = [
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
export const ROAD_TILE_14 = [
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

export const TALL_PALETTE = { g: 0x185137, h: 0x1a583c };
// Blades are built from quantity, not contrast: at the terrain's luma cap a
// sparse lattice disappeared and the monster zone read as a plain darker
// rectangle, losing the cue for why monsters spawn there. Each blade row is
// offset by its own index so the marks stagger instead of lining up into
// vertical corduroy, and both periods stay coprime with the 16-cell tile.
export const TALL_TILE = [
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
export const SOIL_PALETTE = { s: 0x6b4a2f, h: 0x735033 };
export const SOIL_TILE = [
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
export const HOUSE_TILE_PALETTE = { s: 0x3d3650, d: 0x322c42 };
export const HOUSE_TILE = [
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
export const ASH_PALETTE = { a: 0x3b3537, h: 0x423b3d };
export const ASH_TILE = [
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
export const SCORCH_PALETTE = { s: 0x2c2527, e: 0x47291f };
export const SCORCH_TILE = [
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
export const LAVA_PALETTE = { k: 0x7c2d12, R: 0x9a3412, L: 0xc2410c, o: 0xea580c, y: 0xfdba74 };
export const LAVA_A = [
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
export const LAVA_B = [
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
export const ROCK_PALETTE = { b: 0x0f0b0c, S: 0x1f1a1c, D: 0x2e2729, c: 0x433a3d, H: 0x5e5356, e: 0xea580c };
export const ROCK_TILE = [
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

// Every grid bakes through Scale2x (pixelart.ts) except where it bends
// what the grid was drawn to say. The terrain floors stay blocky: the
// water's and the lava's ripple dashes came out as diagonal streaks, and
// the transition tiles below draw the same fill, so all of them keep the
// one 4px pattern and meet without a seam (the grass, path, tall grass,
// soil, ash and scorch scatter is lone cells, which Scale2x leaves as
// they are anyway). The npc's face (npcs.ts) and the farm's fence
// (landmarks.ts) are kept blocky beside their own grids.
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
