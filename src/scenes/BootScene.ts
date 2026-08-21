import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { makeTexture, makeTilesetTexture } from "../pixelart";

const GRASS_PALETTE = { g: 0x1f5c42, G: 0x16432f, L: 0x2a6b4d };
const GRASS_TILE = [
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gGgggggggggGgggg",
  "gggggggggggggggg",
  "gggggLgggggggggg",
  "gggggggggggggggg",
  "gGgggggggggggGgg",
  "gggggggggggggggg",
  "gggggggggLgggggg",
  "gggggGgggggggggg",
  "gggggggggggggggg",
  "gggggggggLgggggg",
  "gggggggggggggggg",
  "gGgggggggggggggg",
  "gggggggggggggLgg",
  "gggggggggggggggg",
];

const WATER_PALETTE = { W: 0x0133a9, B: 0x01207f };
const WATER_A = [
  "WWWWWWWWWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "WWBBWWWWWWWWBBWW",
  "WWWWWWWWWWWWWWWW",
  "WWWWWWBBWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "BBWWWWWWWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "WWWWWWBBWWWWBBWW",
  "WWWWWWWWWWWWWWWW",
  "WWBBWWWWWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "WWBBWWWWWWWWBBWW",
  "WWWWWWWWWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
];
const WATER_B = [
  "WWWWWWWWWWWWWWWW",
  "WWBBWWWWWWBBWWWW",
  "WWWWWWWWWWWWWWWW",
  "WWWWWWBBWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "BBWWWWWWWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "WWWWWWBBWWWWBBWW",
  "WWWWWWWWWWWWWWWW",
  "WWBBWWWWWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "WWBBWWWWWWWWBBWW",
  "WWWWWWWWWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "WWBBWWWWWWWWWWWW",
];

// The tree is drawn straight onto a copy of the grass speckle pattern (g/G/L
// shared with GRASS_TILE) so the tile merges into the map instead of reading
// as a dark box; b outlines the canopy, c highlights it, t is the trunk.
const TREE_PALETTE = { g: 0x1f5c42, G: 0x16432f, L: 0x2a6b4d, b: 0x0a331f, d: 0x0d4528, c: 0x155e38, t: 0x3d2c18 };
const TREE_TILE = [
  "gggggggggggggggg",
  "gggggggggggggggg",
  "gGggbcddddddcbgg",
  "ggbddddddddddbgg",
  "gbddddddddddddbg",
  "gbddddddddddddbg",
  "bddddddddddddddb",
  "bddddddddddddddb",
  "bddddddddddddddb",
  "gbddddddddddddbg",
  "gggbddddddddbggg",
  "ggggggttttgggggg",
  "ggggggttttgggggg",
  "gGggggttttgggggg",
  "gggggttttttggLgg",
  "gggggggggggggggg",
];

const PATH_PALETTE = { p: 0x735f43, P: 0x5e4c33 };
const PATH_TILE = [
  "pppppppppppppppp",
  "pppppppppppppppp",
  "pppPPppppppPPppp",
  "pppppppppppppppp",
  "pppppppPPppppppp",
  "pppppppppppppppp",
  "pPPppppppppppppp",
  "pppppppppppppppp",
  "pppppppppPPppppp",
  "pppppppppppppppp",
  "pppPPppppppPPppp",
  "pppppppppppppppp",
  "pppppppppppppppp",
  "pppppPPppppppppp",
  "pppppppppppppppp",
  "pppppppppppppppp",
];

const TALL_PALETTE = { g: 0x185137, d: 0x113f2a, h: 0x2a6b4d };
const TALL_TILE = [
  "gggggggggggggggg",
  "gdhgggggdhgggggg",
  "gggggggggggggdhg",
  "gdgggggggggggggg",
  "gggggdhggggggggg",
  "gggggggggggdhggg",
  "gdgggggggggggggg",
  "gggggdhggggggggg",
  "gggggggggggggdhg",
  "gdhggggggggggggg",
  "gggggggggdhggggg",
  "gggggggggggggggg",
  "ggdhgggggggggggg",
  "gggggggggggggdhg",
  "gdhggggggggggggg",
  "gggggggggggggggg",
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
};
const NPC_TILE = [
  "................",
  ".....hhhhhh.....",
  "....hhhhhhhh....",
  "...hhhhhhhhhh...",
  "...hssssssssh...",
  "...hseesseesh...",
  "...hbbbbbbbbh...",
  "....rrrrrrrr....",
  "...rrrrrrrrrr...",
  "...rrrrrrrrrr...",
  "...rrbbbbbbbrr..",
  "...rrrrrrrrrr...",
  "....rrrrrrrr....",
  "....rrrr..rr....",
  "................",
  "................",
];

const SLIME_PALETTE = { g: 0x4ade80, G: 0x1c5c38, m: 0x14532d };
const KING_SLIME_PALETTE = { g: 0xff7a7a, G: 0xb91c1c, m: 0x7f1d1d };
const SLIME_TILE = [
  "................",
  "................",
  "................",
  ".....gggggg.....",
  "....gggggggg....",
  "...gggggggggg...",
  "..gggggggggggg..",
  "..gggggggggggg..",
  "..gggGggggGggg..",
  "..gggggggggggg..",
  "..ggmgggggmggg..",
  "...gggggggggg...",
  "....gggggggg....",
  ".....gggggg.....",
  "................",
  "................",
];

const GOBLIN_PALETTE = {
  s: 0x86efac,
  S: 0x5bb97e,
  e: 0xff5555,
  h: 0x4ade80,
  r: 0x8b5a2b,
};
const TROLL_PALETTE = {
  s: 0x4d5d4d,
  S: 0x2f3a2f,
  e: 0xffd166,
  h: 0x1f2e1f,
  r: 0x7c2d12,
};
const GOBLIN_TILE = [
  "................",
  "................",
  ".....hh..hh.....",
  "....hsssssssh...",
  "...hssssssssh...",
  "...hsSseesSsh...",
  "...hssssssssh...",
  "....hssssssh....",
  "....ssssssss....",
  "...ssssssssss...",
  "...ssrrrrrrss...",
  "...ssrrrrrrss...",
  "....ssssssss....",
  "....ss....ss....",
  "................",
  "................",
];

const WOLF_PALETTE = { g: 0x94a3b8, G: 0x64748b, d: 0x475569, e: 0xef4444, n: 0x334155 };
const WOLF_TILE = [
  "................",
  "..gg.......gg...",
  "..ggg.....ggg...",
  "..gggggggggggg..",
  "..ggGGGGGGGGgg..",
  ".ggGddddddddGgg.",
  ".ggGddddddddGgg.",
  ".ggGddeeeddGgg..",
  ".ggGddeeeddGgg..",
  "..ggGddddddGgg..",
  "..ggGGGGGGGGgg..",
  "..gggggggggggg..",
  "..gg..gggg..gg..",
  "..gg..gggg..gg..",
  "................",
  "................",
];

const WISP_PALETTE = { d: 0x0c4a6e, c: 0x38bdf8, w: 0xe0f2fe, k: 0x082f49 };
const WISP_TILE = [
  "................",
  "......dddd......",
  "....ddccccdd....",
  "...dcccwwcccd...",
  "..dccwwwwwwccd..",
  ".dccwwwwwwwwccd.",
  ".dcwwwkwwkwwwcd.",
  ".dcwwwkwwkwwwcd.",
  ".dcwwwwwwwwwwcd.",
  ".dccwwwwwwwwccd.",
  "..dccwwwwwwccd..",
  "...dcccwwcccd...",
  "....ddccccdd....",
  ".....ddccdd.....",
  "......dwwd......",
  "................",
];

const FROST_MOTH_PALETTE = { w: 0xe0f2fe, W: 0xbae6fd, b: 0x38bdf8, d: 0x0369a1, e: 0xef4444 };
const FROST_MOTH_TILE = [
  "................",
  "..ww........ww..",
  ".wWWw......wWWw.",
  ".wWWWbbbbbbWWWw.",
  ".wWWWWbbbbWWWWw.",
  "..wWWWbbeebWWWw.",
  "..wWWWbbbbWWWw..",
  "...wWbbbbbbWw...",
  "...wWbdbdbdbW...",
  "....wbbbbbbbw...",
  "....wbdbdbdb....",
  ".....wbbbbb.....",
  "......wbbb......",
  ".......wb.......",
  "................",
  "................",
];

const YETI_PALETTE = { f: 0xf1f5f9, F: 0xcbd5e1, s: 0x93c5fd, e: 0x1e3a8a, m: 0x64748b };
const YETI_TILE = [
  "................",
  "................",
  "....ffffffff....",
  "...ffffFFFFFFf..",
  "..fffFssssssFff.",
  "..ffFsssssssFff.",
  "..ffFseesseFff..",
  "..ffFssssssFff..",
  "..ffFsmmmmsFff..",
  "..ffffffffffff..",
  ".ffffffffffffff.",
  ".ffFFFFFFFFFFff.",
  ".ffFFFFFFFFFfff.",
  "..fff..ff..fff..",
  "..fff..ff..fff..",
  "................",
];

const ICE_GOLEM_PALETTE = { i: 0xa5f3fc, I: 0x67e8f9, c: 0x22d3ee, d: 0x0e7490, k: 0x334155, e: 0xffffff };
const ICE_GOLEM_TILE = [
  "................",
  ".....iiiiii.....",
  "....iIiiiiIi....",
  "....iIeeeeIi....",
  "....iiiiiiii....",
  "...kiIiiiiIik...",
  "..kkiIciicIikk..",
  ".k.kiIciicIik.k.",
  ".kk.iIIIIIIi.kk.",
  ".kk.iiIddIii.kk.",
  ".k.kiiiDDiiik.k.",
  "....kiiiiiiik...",
  "....kiiIIiiik...",
  "....kiI..Iik....",
  "....kii..iik....",
  "................",
];
const BAT_PALETTE = { b: 0x7c3aed, B: 0x5b21b6, d: 0x3b0764, w: 0xffffff, e: 0xf87171 };
const BAT_TILE = [
  "bb............bb",
  "bbbb........bbbb",
  "bbbbbbbbbbbbbbbb",
  "bBBBBBBBBBBBBBBb",
  "bBdddddddddddBb.",
  ".bBdwwwwwwwdBbb..",
  ".bBdweeeeewdBbb..",
  ".bBdwwwwwwwdBbb..",
  "..bBddddddBb....",
  "..bbbbbbbbbb....",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
];

const WASP_PALETTE = { y: 0xffdd44, Y: 0xe8a20c, k: 0x141414, e: 0x141414, w: 0xc7d4ee };
const WASP_TILE = [
  "................",
  "................",
  "................",
  ".....yyyyyy.....",
  "....yyyyyyyy....",
  "....yekkyeky....",
  "....yyyyyyyy....",
  "....yyyyyyyy....",
  ".ww.yyyyyyyy.ww.",
  ".ww.yyyyyyyy.ww.",
  "...ykkkkkkkky...",
  "...ykYYYYYYky...",
  "...ykkkkkkkky...",
  "....yYYYYYYy....",
  ".....y....y.....",
  "................",
];

const SPIDER_PALETTE = { b: 0x7c3aed, B: 0x5b21b6, d: 0x3b0764, e: 0xef4444, E: 0xb91c1c };
const SPIDER_TILE = [
  "................",
  "...bb......bb...",
  "..bbbb....bbbb..",
  "..bbbB....Bbbb..",
  "..bbBBbbbbBBbb..",
  "..bBBBBBBBBBBb..",
  "..bBBeBBBBBeBb..",
  "..bBBBddddBBBb..",
  "...BBBBBBBBBB...",
  "...bBBBBBBBBb...",
  "....BBBBBBBB....",
  "....bBBBBBBb....",
  ".....BBBBBB.....",
  "......BBBB......",
  ".......BB.......",
  "................",
];

const ORC_PALETTE = {
  s: 0x4ade80,
  S: 0x2d9d5c,
  e: 0xff5555,
  h: 0x3b7d4a,
  r: 0x8b5a2b,
  t: 0xd1d5db,
};
const ORC_TILE = [
  "................",
  "................",
  ".....hhhhhh.....",
  "....hhhhhhhh....",
  "...hhhhhhhhhh...",
  "...hhsssssssh...",
  "...hsssessesh...",
  "....hssssssh....",
  "....hssssssh....",
  "...hsssssssssh..",
  "...hstssssstsh..",
  "...hsssssssssh..",
  "...hhssrrssshh..",
  "....ssrrrrss....",
  "....ss....ss....",
  "................",
];

const MOSS_GOLEM_PALETTE = {
  s: 0x7d8f7d,
  S: 0x5c6f5c,
  e: 0x8ce99a,
  h: 0x4a5a4a,
  r: 0x2f3a2f,
};

const SPARK_PALETTE = { y: 0xffdd44 };
const SPARK_TILE = ["..y.....", "..y.....", "..y.....", "yyyyyyyy", "..y.....", "..y.....", "..y.....", "........"];

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

const COIN_PALETTE = { y: 0x8a5a2b, Y: 0xffd166, W: 0xfff3c4 };
const COIN_TILE = [
  "................",
  ".....yyyyyy.....",
  "...yyyYYYYyyy...",
  "..yyYYYYYYYYyy..",
  ".yyYYYYYYYYYYyy.",
  ".yYYYYYYYYYYYYy.",
  "yYYYWWYYYYWWYYYy",
  "yYYYWYYYYYYWYYYy",
  "yYYYYYYYYYYYYYYy",
  "yYYYYYYYYYYYYYYy",
  ".yYYYYYYYYYYYYy.",
  ".yyYYYYYYYYYYyy.",
  "..yyYYYYYYYYyy..",
  "...yyyYYYYyyy...",
  ".....yyyyyy.....",
  "................",
];

const FIREFLY_PALETTE = { w: 0xe9ff66 };
const FIREFLY_TILE = ["........", "........", "..ww....", ".wwww...", "..ww....", "........", "........", "........"];

const CHEST_PALETTE = { b: 0x4a2f1a, w: 0x8a5a2b, L: 0xd1a455, l: 0x3d2c18, Y: 0xffd166 };
const CHEST_TILE = [
  "................",
  "................",
  "...bbbbbbbbbb...",
  "..bwwwwwwwwwwb..",
  ".bwwwwwwwwwwwwb.",
  ".bwLLLLLLLLLLwb.",
  ".bwLllllllllLwb.",
  ".bwLllllllllLwb.",
  ".bwLllllllllLwb.",
  ".bwLllllllllLwb.",
  ".bwLLLLLLLLLLwb.",
  ".bwwwwwwwwwwwwb.",
  "..bbbbbbbbbbbb..",
  "...bb......bb...",
  "................",
  "................",
];
const CHEST_OPEN_TILE = [
  "................",
  "..bbbbbbbbbbbb..",
  ".bbwwwwwwwwwwbb.",
  "................",
  "................",
  "...bwwwwwwwwwb..",
  "..bwYYYYYYYYYwb.",
  ".bwYYYYYYYYYYYwb",
  ".bwYYYYYYYYYYYwb",
  ".bwYYYYYYYYYYYwb",
  ".bwYYYYYYYYYYYwb",
  ".bwwwwwwwwwwwwb.",
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
        { rows: GRASS_TILE, palette: GRASS_PALETTE },
        { rows: WATER_A, palette: WATER_PALETTE },
        { rows: WATER_B, palette: WATER_PALETTE },
        { rows: TREE_TILE, palette: TREE_PALETTE },
        { rows: PATH_TILE, palette: PATH_PALETTE },
        { rows: TALL_TILE, palette: TALL_PALETTE },
        { rows: HOUSE_TILE, palette: HOUSE_TILE_PALETTE },
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
    makeTexture(this, "chest", CHEST_TILE, CHEST_PALETTE);
    makeTexture(this, "chest-open", CHEST_OPEN_TILE, CHEST_PALETTE);

    makeHouse(this);
    makeSign(this);
    makeCave(this);
    makeBattleBg(this);
    makeTitleBg(this);
  }
}
