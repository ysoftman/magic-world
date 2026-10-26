// Overworld map data — the one file that decides what the town looks like.
// Written by the in-game map editor (F2, then X applies it straight back here)
// and read by levels.ts, so swapping this file swaps the whole layout.
//
// Row legend: G grass, W water, T tree, P path, h tall grass, H house, S soil.
// Landmark coordinates are in pixels; T is one tile, kept local so this file
// imports nothing and can be replaced wholesale.
const T = 64;

export const OVERWORLD_MAP = {
  rows: [
    "GGGGGGGGGGGGGGGGGGGGGGGGGGGG",
    "GGGGGSSSGGWWWWGGGGGGGGGGGGGG",
    "GHHGGSSSGGWWWGGGGGGGGGGGGGTG",
    "GHHGGGGPGGWGGGGGGGGhhGGPGTTT",
    "GPPGGGGPGGGGGGGGGGhhhGGPGGGG",
    "GGPGGGTPGGGGGGGGTGGGhGGPGGGG",
    "GGPGGGGPGGGGGGGTTTGGGGGPGGGG",
    "GGPPPPPPPPPPPPPPPPPPPPPPGGGG",
    "GGGGGGGPGGGGGGGGGGGGGPGGGGGG",
    "GGGGGGGPGGGGGGGGGGTGTPPPPPPP",
    "GGGGGGGPGGGGGGGGGGGTGGGGGPGG",
    "GGGhhhGPGGGGGGGGGhGGGGGGGPGG",
    "GGhhhGGPGGGGGGGGhhGGGGTGTPGG",
    "GGGGGGGPGGGTGGGGhhhGGGGTGPTG",
    "GGGGGGGPPPPPPPPGGGGGGGGGGPGG",
    "GGGGGGGPGhGGGGGGTGGGGGhhhPGG",
    "PPPPPPPPGhhhGTTGGGGGThhhGPTG",
    "GGGGGGTGGhhGTTTTGGGTTTGGGPTT",
    "GGGGGTTTGGhGGTTTGGTTGGGGGPGG",
    "GGGGGGGGGGGGGGGGGGGGGGGGGPGG",
  ],
  landmarks: {
    PLAYER_SPAWN: { x: 2 * T + T / 2, y: 4 * T + T / 2 },
    NPC_POS: { x: 8 * T + T / 2, y: 6 * T + T / 2 },
    HOUSE_POS: { x: 1 * T, y: 2 * T },
    SHOP_POS: { x: 5 * T + T / 2, y: 10 * T + T / 2 },
    CAVE_POS: { x: 23 * T + T / 2, y: 2 * T + T / 2 },
    RANK_BOARD_POS: { x: 3 * T + T / 2, y: 6 * T + T / 2 },
    HUNTER_POS: { x: 8 * T + T / 2, y: 12 * T + T / 2 },
    GAMBLER_POS: { x: 16 * T + T / 2, y: 10 * T + T / 2 },
    BOUNTY_BOARD_POS: { x: 5 * T + T / 2, y: 13 * T + T / 2 },
    FISH_POS: { x: 9 * T + T / 2, y: 2 * T + T / 2 },
    FISH_SIGN_POS: { x: 9 * T + T / 2, y: 1 * T + T / 2 },
    FARM_POS: { x: 6 * T + T / 2, y: 2 * T + T / 2 },
    FARM_SIGN_POS: { x: 4 * T + T / 2, y: 1 * T + T / 2 },
    FOREST_POS: { x: 27 * T + T / 2, y: 9 * T + T / 2 },
    SNOW_POS: { x: 0 * T + T / 2, y: 16 * T + T / 2 },
    VOLCANO_POS: { x: 25 * T + T / 2, y: 19 * T + T / 2 },
    ARENA_POS: { x: 13 * T + T / 2, y: 6 * T + T / 2 },
    BLACKSMITH_POS: { x: 2 * T + T / 2, y: 10 * T + T / 2 },
  },
};
