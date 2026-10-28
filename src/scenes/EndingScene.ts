import Phaser from "phaser";
import { ACHIEVEMENTS, TOTAL_FISH } from "../achievements";
import { OVERWORLD_THEME, Sfx, TITLE_THEME } from "../audio";
import { GAME_HEIGHT, GAME_VERSION, GAME_WIDTH } from "../config";
import { dayIndex, GameState } from "../gameState";
import { CATCHABLE } from "../monsters";
import { retroStyle } from "../pixelart";
import { isTouchDevice } from "../ui/TouchControls";

export interface EndingData {
  // the FLAME DRAKE's first fall: the last region's boss closes the whole run
  epilogue?: boolean;
}

// Every region in the order the story opens them, for the epilogue's credits
const JOURNEY = ["TOWN", "CAVE", "FOREST", "SNOW FIELD", "VOLCANO"];
// stat labels padded to the widest ("ACHIEVEMENTS") plus a space
const LABEL_W = 13;
// When each screen's PRESS ENTER starts to blink, and the screen takes a
// press: one before then is dropped. Z mashed through the battle's last line
// ("Battle won!", then a 1.5s fade) landed here and threw the ending away as
// it came up.
const ENDING_PROMPT_MS = 4200;
const EPILOGUE_PROMPT_MS = 5000;

// Final boss victory screen: congratulations, a run summary and THE END,
// then back to the title. The save is kept so the player can keep roaming.
// The epilogue variant is the same screen for the post-game's last boss,
// with a fuller summary and the road travelled.
export class EndingScene extends Phaser.Scene {
  private leaving = false;
  // set once the prompt shows (ENDING_PROMPT_MS / EPILOGUE_PROMPT_MS)
  private ready = false;

  constructor() {
    super("Ending");
  }

  create(data: EndingData = {}): void {
    this.leaving = false;
    this.ready = false;
    const epilogue = data.epilogue === true;
    // Phaser keeps the last start()'s data when the next start() passes none,
    // so without this a plain ending after an epilogue in the same session
    // (a new game, MOSS GOLEM again) would replay the epilogue
    this.sys.settings.data = {};
    // the town theme for the epilogue: the run ends where it started
    Sfx.playBgm(epilogue ? OVERWORLD_THEME : TITLE_THEME);

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

    if (epilogue) this.showEpilogue();
    else this.showEnding();
    // the scene's clock, which counts from this start; a tween's onStart
    // won't do, it fires on add (a tween's `delay` holds its values only)
    this.time.delayedCall(epilogue ? EPILOGUE_PROMPT_MS : ENDING_PROMPT_MS, () => {
      this.ready = true;
    });

    const leave = (): void => {
      if (this.leaving || !this.ready) return;
      this.leaving = true;
      Sfx.buy();
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start("Title");
      });
    };
    this.input.keyboard!.on("keydown", (e: KeyboardEvent) => {
      if (e.code !== "Enter" && e.code !== "KeyZ" && e.code !== "Space") return;
      leave();
    });
    // this scene has no touch controls, so a tap stands in for ENTER
    this.input.on(Phaser.Input.Events.POINTER_DOWN, leave);

    this.add.text(GAME_WIDTH - 16, GAME_HEIGHT - 12, `v${GAME_VERSION}`, retroStyle(4, "#666688")).setOrigin(1, 1);
  }

  private showEnding(): void {
    // size 11, not 12: 27 glyphs x 48px was 1296, wider than the screen and
    // clipping the first T and the "!"; x 44 = 1188 leaves 46px either side
    const headline = this.add
      .text(GAME_WIDTH / 2, 130, "THE MOSS GOLEM IS DEFEATED!", retroStyle(11, "#4ade80"))
      .setOrigin(0.5)
      .setAlpha(0);
    const sub = this.add
      .text(GAME_WIDTH / 2, 190, "PEACE RETURNS TO MAGIC WORLD", retroStyle(8, "#c4b5fd"))
      .setOrigin(0.5)
      .setAlpha(0);

    // The in-game day, 1-based as on the title's save cards, not hours: the
    // clock runs at TIME SPEED and jumps a night's sleep, so the "PLAY TIME"
    // it used to read started at 6H and was never time played. The widest
    // row is still the NAME one, 22 x 32 = 704px (x 288..992). Left-aligned
    // inside a centered block, as the epilogue's: centred row by row, rows of
    // unlike length started at unlike x and the padded values didn't line up.
    const stats = [
      `NAME      ${GameState.player.name}`,
      `LEVEL     ${GameState.player.level}`,
      `GOLD      ${GameState.gold}`,
      `BATTLES   ${GameState.battles}`,
      `DAY       ${dayIndex() + 1}`,
    ];
    const summary = this.add
      .text(GAME_WIDTH / 2, 330, stats.join("\n"), retroStyle(8, "#f5f5f5"))
      .setOrigin(0.5)
      .setLineSpacing(14)
      .setAlpha(0);

    const theEnd = this.add
      .text(GAME_WIDTH / 2, 520, "THE END", retroStyle(24, "#ffd166"))
      .setOrigin(0.5)
      .setAlpha(0);
    theEnd.setShadow(8, 8, "#7c2d12", 1, true, true);

    const prompt = this.add
      .text(GAME_WIDTH / 2, 630, isTouchDevice() ? "TAP TO CONTINUE" : "PRESS ENTER", retroStyle(8, "#ffffff"))
      .setOrigin(0.5)
      .setAlpha(0);

    // staged reveal, credits style
    this.tweens.add({ targets: headline, alpha: 1, duration: 900, delay: 400 });
    this.tweens.add({ targets: sub, alpha: 1, duration: 900, delay: 1200 });
    this.tweens.add({ targets: summary, alpha: 1, duration: 900, delay: 2000 });
    this.tweens.add({ targets: theEnd, alpha: 1, duration: 1200, delay: 3000 });
    // From 1, not the 0 it waits at: "alpha: 0" tweened 0 to 0 and the
    // prompt never showed (an onStart setAlpha ran on add, not after delay).
    this.tweens.add({
      targets: prompt,
      alpha: { from: 1, to: 0 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      delay: ENDING_PROMPT_MS,
    });
  }

  // Widths at retroStyle(n) = n*4 px a glyph, all centered on 1280:
  // headline 21 x 48 = 1008, sub 30 x 32 = 960, the summary's longest row
  // ("NAME" + a 12-glyph name) 25 x 24 = 600, the journey 43 x 20 = 860,
  // THE TRUE END 12 x 64 = 768, the NEW GAME+ note at most 48 x 16 = 768.
  // Rows: headline 66..114, sub 134..166, summary 182..478, journey 502..522,
  // THE TRUE END 554..626 with its shadow, prompt 652..684, NEW GAME+ note
  // 694..710 — the one band left free, 10px under the prompt and 10px off the
  // bottom; at x=256..1024 it stays left of the version tag (x>=1168).
  private showEpilogue(): void {
    // embers drifting up and going out behind the text
    for (let i = 0; i < 36; i++) {
      const ember = this.add
        .rectangle(Phaser.Math.Between(16, GAME_WIDTH - 16), GAME_HEIGHT + 8, 3, 3, Phaser.Math.RND.pick([0xf97316, 0xfb923c, 0xef4444]))
        .setAlpha(0);
      this.tweens.add({
        targets: ember,
        y: Phaser.Math.Between(120, 480),
        alpha: { from: 0.9, to: 0 },
        duration: Phaser.Math.Between(3000, 6000),
        delay: Phaser.Math.Between(0, 5000),
        repeat: -1,
      });
    }

    const headline = this.add
      .text(GAME_WIDTH / 2, 90, "THE FLAME IS QUENCHED", retroStyle(12, "#fb923c"))
      .setOrigin(0.5)
      .setAlpha(0);
    const sub = this.add
      .text(GAME_WIDTH / 2, 150, "ALL OF MAGIC WORLD IS AT PEACE", retroStyle(8, "#c4b5fd"))
      .setOrigin(0.5)
      .setAlpha(0);

    const caught = GameState.caughtSpecies();
    // checked as well as claimed: the field scenes claim on a once-a-second
    // tick, so DRAKE SLAYER (earned by the fight that led here) isn't in
    // GameState.achievements yet — reading check() leaves the claim, and its
    // toast, to the town the player wakes up in
    const earned = ACHIEVEMENTS.filter((a) => GameState.achievements.includes(a.id) || a.check()).length;
    const stats: Array<[string, string | number]> = [
      ["NAME", GameState.player.name],
      ["LEVEL", GameState.player.level],
      ["GOLD", GameState.gold],
      ["BATTLES", GameState.battles],
      ["BESTIARY", `${caught}/${CATCHABLE.length}`],
      ["FISH LOG", `${GameState.fishLogged()}/${TOTAL_FISH}`],
      ["HARVESTS", GameState.cropsHarvested],
      ["ACHIEVEMENTS", `${earned}/${ACHIEVEMENTS.length}`],
      // the in-game day, as in showEnding()
      ["DAY", dayIndex() + 1],
    ];
    // left-aligned inside a centered block, so the values line up in a column
    const summary = this.add
      .text(GAME_WIDTH / 2, 330, stats.map(([k, v]) => `${k.padEnd(LABEL_W)}${v}`).join("\n"), retroStyle(6, "#f5f5f5"))
      .setOrigin(0.5)
      .setLineSpacing(10)
      .setAlpha(0);

    const journey = this.add
      .text(GAME_WIDTH / 2, 512, JOURNEY.join(" > "), retroStyle(5, "#8ecbff"))
      .setOrigin(0.5)
      .setAlpha(0);

    const theEnd = this.add
      .text(GAME_WIDTH / 2, 586, "THE TRUE END", retroStyle(16, "#ffd166"))
      .setOrigin(0.5)
      .setAlpha(0);
    theEnd.setShadow(8, 8, "#7c2d12", 1, true, true);

    const prompt = this.add
      .text(GAME_WIDTH / 2, 668, isTouchDevice() ? "TAP TO CONTINUE" : "PRESS ENTER", retroStyle(8, "#ffffff"))
      .setOrigin(0.5)
      .setAlpha(0);

    // The drake's fall is what opens NEW GAME+ (TitleScene offers it once the
    // save has volcanoBoss), and nothing else in the game says so; on touch
    // it names the title's button, since there is no P key to press.
    const plus = this.add
      .text(
        GAME_WIDTH / 2,
        702,
        isTouchDevice() ? "NEW GAME+ UNLOCKED - TAP NEW GAME+ ON THE TITLE" : "NEW GAME+ UNLOCKED - PRESS P ON THE TITLE SCREEN",
        retroStyle(4, "#ffd166"),
      )
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({ targets: headline, alpha: 1, duration: 900, delay: 400 });
    this.tweens.add({ targets: sub, alpha: 1, duration: 900, delay: 1200 });
    this.tweens.add({ targets: summary, alpha: 1, duration: 900, delay: 2000 });
    this.tweens.add({ targets: journey, alpha: 1, duration: 900, delay: 3000 });
    this.tweens.add({ targets: theEnd, alpha: 1, duration: 1200, delay: 3800 });
    this.tweens.add({ targets: plus, alpha: 1, duration: 900, delay: 5000 });
    // from 1, as in showEnding()
    this.tweens.add({
      targets: prompt,
      alpha: { from: 1, to: 0 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      delay: EPILOGUE_PROMPT_MS,
    });
  }
}
