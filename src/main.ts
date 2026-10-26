import Phaser from "phaser";
import { Sfx } from "./audio";
import { GAME_HEIGHT, GAME_WIDTH } from "./config";
import { GameState } from "./gameState";
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
// text it won't repaint when the webfont finishes loading later. Wait for it
// (bounded, so a slow/broken connection can't stall the game forever) before
// booting Phaser, so the title screen never flashes the fallback font.
const fontReady = document.fonts.load('16px "Press Start 2P"').catch(() => undefined);
const timeout = new Promise((resolve) => setTimeout(resolve, 2000));
Promise.race([fontReady, timeout]).finally(() => {
  GameState.loadSettings();
  loadMapOverride();
  new Phaser.Game(config);
});
