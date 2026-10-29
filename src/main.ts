// Press Start 2P from the bundle, not a font CDN: offline, behind a firewall
// or when the CDN's name won't resolve, every layout measured as one glyph =
// 1em (AGENTS.md) fell apart in the fallback font. Latin only: the game draws
// ASCII and the em dash. A ★ is in none of its subsets (it fell back to
// another font), so the panels mark earned and done rows with "*" instead.
// Departure Mono, the long-text font (bodyStyle), is bundled the same way.
import "@fontsource/press-start-2p/latin-400.css";
import "./assets/fonts/departure-mono.css";
import Phaser from "phaser";
import { Sfx } from "./audio";
import { GAME_HEIGHT, GAME_WIDTH } from "./config";
import { GameState } from "./gameState";
import { installKeyboardQueueFix } from "./keyboardQueueFix";
import { loadMapOverride } from "./levels";
import { watchTextResolution } from "./pixelart";
import { installRenderTextureLeakFix } from "./renderTextureLeakFix";
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
    // the display steps down to a multiple of the 320x180 art, so every art
    // pixel is a whole number of CSS pixels: a MacBook (DPR 2) shows the game
    // at exactly 2 device pixels per game pixel rather than 2.19, where the
    // same glyph stroke came out 16, 17 or 18 device pixels wide. It costs at
    // most one step of size (91% of the width there)
    snap: { width: 320, height: 180 },
  },
  // three touches at once (the mouse has its own pointer besides): the d-pad
  // held while Z is tapped, and one to spare (TouchControls). Set here once;
  // each scene used to add two more as it built its buttons, up to the cap
  input: { activePointers: 3 },
  // every sound is Sfx's (audio.ts), synthesized on its own AudioContext;
  // Phaser's SoundManager went unused but still opened a second context and
  // kept it running from the first key on
  audio: { noAudio: true },
  scene: [BootScene, TitleScene, TownScene, DungeonScene, ForestScene, SnowScene, VolcanoScene, AbyssScene, BattleScene, EndingScene],
};

// Canvas text bakes in whatever font is available at draw time; unlike DOM
// text it won't repaint when the webfont finishes loading later. The
// @font-faces above only fetch their files when asked, so ask, and wait for
// both (bounded, so a slow first load can't stall the game forever) before
// booting Phaser, so the title screen never flashes the fallback font.
const fontReady = Promise.all([document.fonts.load('16px "Press Start 2P"'), document.fonts.load('22px "Departure Mono"')]).catch(
  () => undefined,
);
const timeout = new Promise((resolve) => setTimeout(resolve, 2000));
Promise.race([fontReady, timeout]).finally(() => {
  GameState.loadSettings();
  loadMapOverride();
  installKeyboardQueueFix();
  installRenderTextureLeakFix();
  const game = new Phaser.Game(config);
  watchTextResolution(game);
  startGamepad(game);
});
