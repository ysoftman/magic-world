// Press Start 2P from the bundle, not a font CDN: offline, behind a firewall
// or when the CDN's name won't resolve, every layout measured as one glyph =
// 1em (AGENTS.md) fell apart in the fallback font. Latin only: the game draws
// ASCII and the em dash. A ★ is in none of its subsets (it fell back to
// another font), so the panels mark earned and done rows with "*" instead.
import "@fontsource/press-start-2p/latin-400.css";
import Phaser from "phaser";
import { Sfx } from "./audio";
import { GAME_HEIGHT, GAME_WIDTH } from "./config";
import { GameState } from "./gameState";
import { installKeyboardQueueFix } from "./keyboardQueueFix";
import { loadMapOverride } from "./levels";
import { AbyssScene } from "./scenes/AbyssScene";
import { BattleScene } from "./scenes/BattleScene";
import { BootScene } from "./scenes/BootScene";
import { DungeonScene } from "./scenes/DungeonScene";
import { EndingScene } from "./scenes/EndingScene";
import { ForestScene } from "./scenes/ForestScene";
import { SnowScene } from "./scenes/SnowScene";
import { TitleScene } from "./scenes/TitleScene";
import { TownScene } from "./scenes/TownScene";
import { VolcanoScene } from "./scenes/VolcanoScene";
import { startGamepad } from "./ui/Gamepad";

document.addEventListener("visibilitychange", () => {
  if (document.hidden) Sfx.suspendBgmForHiddenTab();
  else Sfx.resumeBgmFromHiddenTab();
});

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  backgroundColor: "#0b0b2b",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  roundPixels: true,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, TitleScene, TownScene, DungeonScene, ForestScene, SnowScene, VolcanoScene, AbyssScene, BattleScene, EndingScene],
};

// Canvas text bakes in whatever font is available at draw time; unlike DOM
// text it won't repaint when the webfont finishes loading later. The
// @font-face above only fetches its file when asked, so ask, and wait for it
// (bounded, so a slow first load can't stall the game forever) before
// booting Phaser, so the title screen never flashes the fallback font.
const fontReady = document.fonts.load('16px "Press Start 2P"').catch(() => undefined);
const timeout = new Promise((resolve) => setTimeout(resolve, 2000));
Promise.race([fontReady, timeout]).finally(() => {
  GameState.loadSettings();
  loadMapOverride();
  installKeyboardQueueFix();
  startGamepad(new Phaser.Game(config));
});
