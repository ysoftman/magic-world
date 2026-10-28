import { GIT_HASH } from "./buildInfo";

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const PIXEL = 4;
export const RETRO_FONT = '"Press Start 2P", monospace';
// the long-text font (pixelart.ts bodyStyle); bundled, main.ts waits for it
export const BODY_FONT = '"Departure Mono", monospace';
export const GAME_VERSION = "0.1.0";
// the title's and the ending's corner tag: "v0.1.0-3a09b68", with the commit
// the bundle was built from (src/buildInfo.ts), or "v0.1.0" without one
export const VERSION_TAG = `v${GAME_VERSION}${GIT_HASH ? `-${GIT_HASH}` : ""}`;
export const MAX_LEVEL = 30;
export const MAX_HP = 999;
export const MAX_MP = 999;
export const MAX_GOLD = 9999;
