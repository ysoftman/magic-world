import type Phaser from "phaser";
import { makeTexture } from "../pixelart";

// Item icons: one per thing a panel lists (InventoryUI, Shop, the BLACKSMITH,
// HOME's KITCHEN), as "icon-<key>" for the inventory, material, ingredient
// or dish key, and "icon-map" for a treasure map. 16-cell grids baked through
// Scale2x like the props, so 64px, and drawn at half that: 32px beside a
// 24px name, each Scale2x cell one screen pixel. Outline b, lit from the top
// left. A grid is shared where only the colours change: the flask by POTION
// and MPOTION, the sword and the shield by every tier -- in the very colours
// of the hero's gear (hero.ts EQUIP_*_PALETTE), the wooden shield included --
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
// the RARE FISH (cooking.ts): the same fish in a koi's gold and orange, red
// fins, so it never reads as the everyday blue FISH beside it
const ICON_RARE_FISH_PALETTE = { b: 0x1d1424, l: 0xfde68a, L: 0xf59e0b, D: 0xb45309, w: 0xffffff, k: 0x1d1424, s: 0xef4444 };
// the KOI FEAST: that koi on the GRILLED FISH's plate, its grill marks red
// koi spots
const ICON_KOI_FEAST_PALETTE = {
  b: 0x1d1424,
  l: 0xfde68a,
  L: 0xf59e0b,
  D: 0xb45309,
  k: 0xdc2626,
  w: 0xffffff,
  s: 0xef4444,
  W: 0xc8d0dc,
};
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

// Called with the scene as `this`, as drawHero is: the form check:art reads
// to pair each grid with its palette.
export function bakeIcons(this: Phaser.Scene): void {
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
  makeTexture(this, "icon-rareFish", ICON_FISH, ICON_RARE_FISH_PALETTE);
  makeTexture(this, "icon-koiFeast", ICON_PLATE_FISH, ICON_KOI_FEAST_PALETTE);
  makeTexture(this, "icon-map", ICON_MAP, ICON_MAP_PALETTE);
}
