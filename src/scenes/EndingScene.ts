import Phaser from "phaser";
import { Sfx, TITLE_THEME } from "../audio";
import { GAME_HEIGHT, GAME_VERSION, GAME_WIDTH } from "../config";
import { GameState } from "../gameState";
import { retroStyle } from "../pixelart";

// Final boss victory screen: congratulations, a run summary and THE END,
// then back to the title. The save is kept so the player can keep roaming.
export class EndingScene extends Phaser.Scene {
  private leaving = false;

  constructor() {
    super("Ending");
  }

  create(): void {
    this.leaving = false;
    Sfx.playBgm(TITLE_THEME);

    // night sky: scattered twinkling stars over the game background colour
    for (let i = 0; i < 70; i++) {
      const star = this.add
        .rectangle(
          Phaser.Math.Between(8, GAME_WIDTH - 8),
          Phaser.Math.Between(8, GAME_HEIGHT - 8),
          2,
          2,
          0xffffff,
          Phaser.Math.FloatBetween(0.2, 0.9),
        )
        .setAlpha(0);
      this.tweens.add({
        targets: star,
        alpha: { from: 0, to: Phaser.Math.FloatBetween(0.4, 1) },
        duration: Phaser.Math.Between(600, 1800),
        delay: Phaser.Math.Between(0, 1200),
      });
    }

    const headline = this.add
      .text(GAME_WIDTH / 2, 130, "THE MOSS GOLEM IS DEFEATED!", retroStyle(12, "#4ade80"))
      .setOrigin(0.5)
      .setAlpha(0);
    const sub = this.add
      .text(GAME_WIDTH / 2, 190, "PEACE RETURNS TO MAGIC WORLD", retroStyle(8, "#c4b5fd"))
      .setOrigin(0.5)
      .setAlpha(0);

    const totalMin = Math.floor(GameState.minutes);
    const playtime = `${Math.floor(totalMin / 60)}H ${totalMin % 60}M`;
    const stats = [
      `NAME      ${GameState.player.name}`,
      `LEVEL     ${GameState.player.level}`,
      `GOLD      ${GameState.gold}`,
      `BATTLES   ${GameState.battles}`,
      `PLAY TIME ${playtime}`,
    ];
    const summary = this.add
      .text(GAME_WIDTH / 2, 330, stats.join("\n"), retroStyle(8, "#f5f5f5"))
      .setOrigin(0.5)
      .setAlign("center")
      .setLineSpacing(14)
      .setAlpha(0);

    const theEnd = this.add
      .text(GAME_WIDTH / 2, 520, "THE END", retroStyle(24, "#ffd166"))
      .setOrigin(0.5)
      .setAlpha(0);
    theEnd.setShadow(8, 8, "#7c2d12", 1, true, true);

    const prompt = this.add
      .text(GAME_WIDTH / 2, 630, "PRESS ENTER", retroStyle(8, "#ffffff"))
      .setOrigin(0.5)
      .setAlpha(0);

    // staged reveal, credits style
    this.tweens.add({ targets: headline, alpha: 1, duration: 900, delay: 400 });
    this.tweens.add({ targets: sub, alpha: 1, duration: 900, delay: 1200 });
    this.tweens.add({ targets: summary, alpha: 1, duration: 900, delay: 2000 });
    this.tweens.add({ targets: theEnd, alpha: 1, duration: 1200, delay: 3000 });
    this.tweens.add({
      targets: prompt,
      alpha: 0,
      duration: 500,
      yoyo: true,
      repeat: -1,
      onStart: () => prompt.setAlpha(0),
      delay: 4200,
    });

    this.input.keyboard!.on("keydown", (e: KeyboardEvent) => {
      if (this.leaving) return;
      if (e.code !== "Enter" && e.code !== "KeyZ" && e.code !== "Space") return;
      this.leaving = true;
      Sfx.buy();
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start("Title");
      });
    });

    this.add.text(GAME_WIDTH - 16, GAME_HEIGHT - 12, `v${GAME_VERSION}`, retroStyle(4, "#666688")).setOrigin(1, 1);
  }
}
