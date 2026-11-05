import Phaser from "phaser";
import { clearFrame, createFx, type Fx } from "pixelfx";
import * as fireworkBurst from "pixelfx/fx/explosions/firework-burst";
import { ACHIEVEMENTS, TOTAL_FISH } from "../achievements";
import { OVERWORLD_THEME, Sfx, TITLE_THEME } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH, VERSION_TAG } from "../config";
import { dayIndex, GameState } from "../gameState";
import { CATCHABLE } from "../monsters";
import { DIM_TEXT, retroStyle } from "../pixelart";
import { bindKeyHint, keyNames, usingPad } from "../ui/Gamepad";
import { addLightCanvas, redrawLive } from "../ui/lightCanvas";
import { FIREWORK_LIFE_S, FIREWORK_RISE_MS, FIREWORK_STEP_MS, SOFT_LIGHT, shellRamp } from "../ui/NightSky";
import { isTouchDevice } from "../ui/TouchControls";

export interface EndingData {
  // the FLAME DRAKE's first fall: the last region's boss closes the whole run
  epilogue?: boolean;
  // watched again from the town's ELDER: no change to the save, and back to
  // the town where the hero stood, not on to the title or the forest lane
  replay?: boolean;
}

// Every region in the order the story opens them, for the epilogue's credits
const JOURNEY = ["TOWN", "CAVE", "FOREST", "SNOW FIELD", "VOLCANO"];
// stat labels padded to the widest ("ACHIEVEMENTS") plus a space
const LABEL_W = 13;
// When each screen's PRESS ENTER starts to blink, and the screen takes a
// press: one before then is dropped. Z mashed through the battle's last line
// ("Battle won!" then, the boss's "... is no more!" now, and a 1.5s fade)
// landed here and threw the ending away as it came up.
const ENDING_PROMPT_MS = 4200;
const EPILOGUE_PROMPT_MS = 5000;
// a pad's A sends Z, which leaves as ENTER does
const pressLine = (): string => (usingPad() ? `PRESS ${keyNames("Z")}` : isTouchDevice() ? "TAP TO CONTINUE" : "PRESS ENTER");

// Fireworks either side of the words: pixelfx's firework burst (MIT; its
// notice is the /*! line in fx.ts), as the town's festival nights have it
// (NightSky.ts), drawn live into a canvas a side (lightCanvas.ts). One screen
// px a pixel, half the festival's ART_PX: over 60 seeds a burst's stars and
// its light over 12/255 reach 98 px either way, 76 up and 149 down of where it
// breaks (BURST_REACH), and the columns beside the summaries are 278 x 262 and
// 330 x 316 (FIREWORK_BOX). At 2px a burst would be 392 x 450, wider and
// taller than either: it would break over the summary and the lines round it.
const BURST_REACH = { left: 98, right: 98, up: 76, down: 149 };
// The left column's box [x0, y0, x1, y1], the right one its mirror, 10px off
// every line of text so nothing bright goes behind a word. The ending's: under
// the sub (to y 206), over TO BE CONTINUED (from 488), left of the summary's
// widest row (from x 288, a 12-glyph NAME). The epilogue's: under the sub
// (166), over the journey (502), left of its summary (340).
const FIREWORK_BOX = { ending: [0, 216, 278, 478], epilogue: [0, 176, 330, 492] } as const;
// the moss golem's in the forest's colours (its headline green, cyan, violet);
// the true end's in every colour, its headline's orange first
const FIREWORK_COLORS = { ending: [0x4ade80, 0x33c4f2, 0x9b5cf6], epilogue: [0xfb923c, 0xf53cd1, 0x33c4f2, 0x9b5cf6, 0x62d93a] };
// the first two shells go up as the headline fades in (400..1300ms), a side
// each, then one every so often, mostly turn about; the true end's oftener
const FIREWORK_FIRST_MS = [250, 600];
const FIREWORK_GAP_MS = { ending: [1400, 2800], epilogue: [900, 2000] };
// the shells' ramps, redraw step, life, RISE and soft glow are the festival's
// (NightSky.ts)

function addFireworks(scene: Phaser.Scene, epilogue: boolean): void {
  const [x0, y0, x1, y1] = FIREWORK_BOX[epilogue ? "epilogue" : "ending"];
  const colors = FIREWORK_COLORS[epilogue ? "epilogue" : "ending"];
  const gap = FIREWORK_GAP_MS[epilogue ? "epilogue" : "ending"];
  const soft = (): boolean => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || !GameState.flashes;
  // made now, hidden, so they sit under the words added after them
  const sides = [x0, GAME_WIDTH - x1].map((left, i) => {
    const sky = addLightCanvas(scene, `ending-fireworks-${i}`, { cols: x1 - x0, rows: y1 - y0, cell: 1, depth: 0, ox: left, oy: y0 });
    sky.image.setPosition(left, y0);
    return { sky, bursts: [] as Array<{ fx: Fx; age: number }>, drawn: false };
  });
  redrawLive(scene, FIREWORK_STEP_MS, {
    active: () => sides.some((s) => s.bursts.length),
    draw: (dt) => {
      for (const s of sides) {
        if (!s.bursts.length) continue;
        for (const b of s.bursts) {
          b.fx.update(dt);
          b.age += dt;
        }
        s.bursts = s.bursts.filter((b) => b.age < FIREWORK_LIFE_S);
        clearFrame(s.sky.frame);
        for (const b of s.bursts) b.fx.draw(s.sky.frame);
        s.drawn = true;
      }
    },
    upload: () => {
      for (const s of sides) {
        if (s.drawn) s.sky.upload();
        s.drawn = false;
        s.sky.image.setVisible(s.bursts.length > 0);
      }
    },
  });

  const launch = (side: number): void => {
    const x = Phaser.Math.Between(x0 + BURST_REACH.left, x1 - BURST_REACH.right);
    sides[side].bursts.push({
      fx: createFx(fireworkBurst, {
        x: side ? GAME_WIDTH - x : x,
        y: Phaser.Math.Between(y0 + BURST_REACH.up, y1 - BURST_REACH.down),
        palette: shellRamp(Phaser.Utils.Array.GetRandom(colors)),
        seed: Phaser.Math.Between(1, 9999),
        light: soft() ? SOFT_LIGHT : 1,
      }),
      age: 0,
    });
    scene.time.delayedCall(FIREWORK_RISE_MS, () => Sfx.ambience("pop", Phaser.Math.FloatBetween(0.6, 0.9)));
  };
  let side = Phaser.Math.Between(0, 1);
  scene.time.delayedCall(FIREWORK_FIRST_MS[0], () => launch(side));
  scene.time.delayedCall(FIREWORK_FIRST_MS[1], () => {
    side = 1 - side;
    launch(side);
  });
  const schedule = (after: number): void => {
    scene.time.delayedCall(after, () => {
      if (Math.random() < 0.75) side = 1 - side;
      launch(side);
      schedule(Phaser.Math.Between(gap[0], gap[1]));
    });
  };
  schedule(FIREWORK_FIRST_MS[1] + Phaser.Math.Between(gap[0], gap[1]));
}

// The MOSS GOLEM's fall closes the story's first part: congratulations, a
// run summary, TO BE CONTINUED and a hint of the snow pass it opens, then
// back to the town. It used to say THE END and go to the title a tenth of the
// way through the game, with the snow field, the volcano and the ABYSS still
// ahead and nothing saying so. The epilogue variant, for the FLAME DRAKE, is
// the real close: a fuller summary, the road travelled, THE TRUE END, then
// the title. Both come after the battle has saved.
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
    const replay = data.replay === true;
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
    addFireworks(this, epilogue);

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
        // { fromForest }, not {}: GameState.pos is where the hero left the
        // town, the forest lane's last tile, and set down there they walked
        // straight back into the forest
        // never without data (a start with none replays the last, this one's
        // { replay } included): GameState.pos is where the hero stood
        if (replay) this.scene.start("Town", {});
        else if (epilogue) this.scene.start("Title");
        else this.scene.start("Town", { fromForest: true });
      });
    };
    this.input.keyboard!.on("keydown", (e: KeyboardEvent) => {
      if (e.code !== "Enter" && e.code !== "KeyZ" && e.code !== "Space") return;
      leave();
    });
    // this scene has no touch controls, so a tap stands in for ENTER
    this.input.on(Phaser.Input.Events.POINTER_DOWN, leave);

    // where the title has it, top right (x 1040..1264, y 12..28): at the
    // bottom it stood 16px off the epilogue's NEW GAME+ note on the same line
    // and read as its last word; the headlines start at y 66
    this.add.pixelText(GAME_WIDTH - 16, 12, VERSION_TAG, retroStyle(4, DIM_TEXT)).setOrigin(1, 0);
  }

  private showEnding(): void {
    // size 11, not 12: 27 glyphs x 48px was 1296, wider than the screen and
    // clipping the first T and the "!"; x 44 = 1188 leaves 46px either side
    const headline = this.add
      .pixelText(GAME_WIDTH / 2, 130, "THE MOSS GOLEM IS DEFEATED!", retroStyle(11, "#4ade80"))
      .setOrigin(0.5)
      .setAlpha(0);
    // the forest, not the world: the snow pass opens on this fight (27 x 32 = 864px)
    const sub = this.add
      .pixelText(GAME_WIDTH / 2, 190, "PEACE RETURNS TO THE FOREST", retroStyle(8, "#c4b5fd"))
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
      .pixelText(GAME_WIDTH / 2, 330, stats.join("\n"), retroStyle(8, "#f5f5f5"))
      .setOrigin(0.5)
      .setLineSpacing(14)
      .setAlpha(0);

    // 18 x 64 = 1152px (x 64..1216), its shadow 8px more; THE END's
    // retroStyle(24) would be 1728. Rows: 488..552 and the shadow to 560, the
    // hint 578..602, the prompt 614..646.
    const toBeContinued = this.add
      .pixelText(GAME_WIDTH / 2, 520, "TO BE CONTINUED...", retroStyle(16, "#ffd166"))
      .setOrigin(0.5)
      .setAlpha(0);
    toBeContinued.setShadow(8, 8, "#7c2d12", 1, true, true);
    // where it goes on: the SNOW PASS, which thaws with this fall (the town's
    // snow gate waits on forestBoss); 36 x 24 = 864px, x 208..1072
    const hint = this.add
      .pixelText(GAME_WIDTH / 2, 590, "A COLD WIND BLOWS FROM THE SNOW PASS", retroStyle(6, "#a5f3fc"))
      .setOrigin(0.5)
      .setAlpha(0);

    const prompt = bindKeyHint(this.add.pixelText(GAME_WIDTH / 2, 630, "", retroStyle(8, "#ffffff")), pressLine)
      .setOrigin(0.5)
      .setAlpha(0);

    // staged reveal, credits style
    this.tweens.add({ targets: headline, alpha: 1, duration: 900, delay: 400 });
    this.tweens.add({ targets: sub, alpha: 1, duration: 900, delay: 1200 });
    this.tweens.add({ targets: summary, alpha: 1, duration: 900, delay: 2000 });
    this.tweens.add({ targets: toBeContinued, alpha: 1, duration: 1200, delay: 3000 });
    this.tweens.add({ targets: hint, alpha: 1, duration: 900, delay: 3600 });
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
  // bottom (the version tag is top right, out of the way).
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
      .pixelText(GAME_WIDTH / 2, 90, "THE FLAME IS QUENCHED", retroStyle(12, "#fb923c"))
      .setOrigin(0.5)
      .setAlpha(0);
    const sub = this.add
      .pixelText(GAME_WIDTH / 2, 150, "ALL OF MAGIC WORLD IS AT PEACE", retroStyle(8, "#c4b5fd"))
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
      .pixelText(GAME_WIDTH / 2, 330, stats.map(([k, v]) => `${k.padEnd(LABEL_W)}${v}`).join("\n"), retroStyle(6, "#f5f5f5"))
      .setOrigin(0.5)
      .setLineSpacing(10)
      .setAlpha(0);

    const journey = this.add
      .pixelText(GAME_WIDTH / 2, 512, JOURNEY.join(" > "), retroStyle(5, "#8ecbff"))
      .setOrigin(0.5)
      .setAlpha(0);

    const theEnd = this.add
      .pixelText(GAME_WIDTH / 2, 586, "THE TRUE END", retroStyle(16, "#ffd166"))
      .setOrigin(0.5)
      .setAlpha(0);
    theEnd.setShadow(8, 8, "#7c2d12", 1, true, true);

    const prompt = bindKeyHint(this.add.pixelText(GAME_WIDTH / 2, 668, "", retroStyle(8, "#ffffff")), pressLine)
      .setOrigin(0.5)
      .setAlpha(0);

    // The drake's fall is what opens NEW GAME+ (TitleScene offers it once the
    // save has volcanoBoss), and nothing else in the game says so; on touch
    // it names the title's button, since there is no P key to press, and with
    // a pad the button that sends P there (LT, "...PRESS LT ON THE TITLE
    // SCREEN" 49 x 16 = 784px)
    const plus = bindKeyHint(this.add.pixelText(GAME_WIDTH / 2, 702, "", retroStyle(4, "#ffd166")), () =>
      !usingPad() && isTouchDevice()
        ? "NEW GAME+ UNLOCKED - TAP NEW GAME+ ON THE TITLE"
        : `NEW GAME+ UNLOCKED - PRESS ${keyNames("P", "title")} ON THE TITLE SCREEN`,
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
