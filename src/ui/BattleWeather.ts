import Phaser from "phaser";
import * as weatherLib from "pixelfx/fx/weather/_lib";
import * as blizzardFx from "pixelfx/fx/weather/blizzard";
import * as rainFx from "pixelfx/fx/weather/rain";
import * as snowFx from "pixelfx/fx/weather/snow";
import * as stormFx from "pixelfx/fx/weather/storm";
import { PIXEL } from "../config";
import { GameState } from "../gameState";
import { seasonLook } from "../season";
import { type Region, weatherToday } from "../weather";
import { addOvercast, bakeSheet, SHEET, WEATHER_PARTICLES } from "./Ambient";
import { addPixelWeather, type PixelWeatherLook } from "./PixelWeather";

export type BattleOrigin = "Town" | "Forest" | "Snow" | "Dungeon" | "Volcano";

const REGION: Record<BattleOrigin, Region> = {
  Town: "town",
  Forest: "forest",
  Snow: "snow",
  Dungeon: "dungeon",
  Volcano: "volcano",
};

// The battle backdrops' ground line (battle-bg-*: sky above, ground below),
// in cells: the weather's floor. Its front layer reaches 8 cells under it, the
// near drops' splashes round the fighters' feet (y 456), and stops at y 472,
// over the menu band (y 474..586) the menu and hints are drawn straight onto.
const HORIZON = 440 / PIXEL;
const ROWS = 472 / PIXEL;
// Simulated up front, as on the field, so the ash is already falling when
// the battle screen appears.
const PREWARM_MS = 8000;

const reducedMotion = (): boolean => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

// pixelfx paints its weather over a dark night sky, so its far drops and
// flakes sit a step or two above black. Over a lit backdrop those were darker
// than the sky and read as specks of dirt: the town's (sky 0x3a6da5), the
// snow field's (0x6e9fc4 to 0xd2e3f0) and a lowland winter's take these
// ramps, each step above its sky. The forest's stay pixelfx's own: its tree
// wall is as dark as the sky they were made for. The first steps (haze,
// veil) keep pixelfx's darks, so they still darken.
const RAIN_DAY = ["#0e1322", "#1a2440", "#6e88ae", "#84a0c4", "#9cb6d6", "#b4cce6", "#d0e2f4", "#f2f8ff"];
const STORM_DAY = ["#09080f", "#121120", "#1b1a30", "#262541", "#7a88b0", "#94a4c8", "#b4c4e4", "#dce6ff"];
const SNOW_DAY = ["#0c1020", "#161d36", "#24304f", "#8ea6c6", "#b4c8e0", "#cddcee", "#e4eef8", "#ffffff"];
// the whiteout: its far sheets of blown snow (the second and third steps) in
// pale grey-blue, so the gale lightens the sky as the old whiteout tint did
const BLIZZARD_DAY = ["#0d111f", "#182035", "#b8c8dc", "#c8d6e6", "#a8bcd6", "#c4d4e8", "#e0eaf6", "#ffffff"];

// The storm's strike (a leader feeling its way down from 2.6s, two strokes
// at 3.0 and 3.3, its sparks gone by 4.8) and its sheet lightning (6.4..7.3),
// in the loop's seconds (pixelfx weather/storm), ends on whole 1/15s steps.
// They light the sky, so with FLASHES off or the OS's reduced motion the loop
// jumps over them: no bolt, no flash. The far flickers light only its cloud
// deck, which hangs above the screen here. With FLASHES on, each pair (the
// two strokes, the sheet's two swells) is two flashes inside half a second,
// three seconds from the next: never more than two in any second, as on the
// field (Ambient's addLightning).
const STORM_STRIKES: ReadonlyArray<readonly [number, number]> = [
  [2, 5],
  [6.2, 7.4],
];
// With FLASHES on the strike plays, its light at this share: the sky band
// behind the fighters peaks about 16 luma brighter for one redraw, the whole
// screen 8 (the old flash, a pale blue at 0.07 over everything, was 12), and
// the bolt itself is a line, not a white-out.
const STORM_LIGHT = 0.3;

function pixelLook(weather: "rain" | "storm" | "snow" | "blizzard", region: Region): PixelWeatherLook {
  const lit = region !== "forest" || seasonLook(region) === "winter";
  switch (weather) {
    case "rain":
      return { fx: rainFx, opts: lit ? { palette: RAIN_DAY } : {}, haze: 0.3 };
    case "storm":
      return {
        fx: stormFx,
        opts: { light: STORM_LIGHT, ...(lit ? { palette: STORM_DAY } : {}) },
        haze: 0.35,
        bands: 2,
        skip: { spans: STORM_STRIKES, when: () => !GameState.flashes || reducedMotion() },
      };
    case "snow":
      return { fx: snowFx, opts: { palette: SNOW_DAY }, haze: 0.15 };
    case "blizzard":
      return { fx: blizzardFx, opts: { palette: BLIZZARD_DAY }, haze: 0.3 };
  }
}

// The noise fields the loops sample, as each effect asks for them at its own
// seed (pixelfx weather/<name>.js, the field() calls: seed, size 256x128,
// octaves): rain seed 4, storm 5, blizzard 9; snow uses none. A field is
// baked on first use and kept, 15ms with three octaves and 38ms with four,
// so the first rainy battle opened 45ms late, a storm or a blizzard's 75-85.
const FIELDS: ReadonlyArray<readonly [number, number[]?]> = [
  [4 + 21, [4, 8, 16]], // rain: gusts
  [4 + 9], // rain: mist
  [5 + 11, [4, 8, 16]], // storm: veil
  [5 * 3 + 1], // storm: cloud deck
  [5 + 3], // storm: wet floor
  [5 + 4, [4, 8, 16]], // storm: floor mist
  [9 * 3 + 7], // blizzard: far sheets
  [9 * 3 + 8], // blizzard: near sheets
  [9 * 5 + 1], // blizzard: spindrift
];
const { field } = weatherLib as unknown as { field: (seed: number, w: number, h: number, cells?: number[]) => unknown };

/**
 * Bakes the weather's noise fields ahead of the first battle in rain, a storm
 * or a blizzard, one a frame while `scene` runs (the title, as warmBattleFx
 * does the effect sheets). Any it leaves, the battle bakes as it opens.
 */
export function warmBattleWeather(scene: Phaser.Scene): void {
  const left = [...FIELDS];
  const step = (): void => {
    const next = left.shift();
    if (!next) scene.events.off(Phaser.Scenes.Events.POST_UPDATE, step);
    else field(next[0], 256, 128, next[1]);
  };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, step);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, step));
}

/**
 * Carries the weather of the region a battle started in (weather.ts) onto the
 * battle screen: rain, a storm, snow or a blizzard from pixelfx (PixelWeather),
 * ashfall as Ambient's particles under a smog. Nothing for clear days or the
 * cave. pixelfx's weather is a side view, as the battle is: it falls to the
 * backdrop's horizon, and its splashes and settling flakes land round the
 * fighters' feet. The storm brings its own lightning; the weather sound beds
 * stay off (Ambient's field scene fades them out on shutdown): the battle has
 * its own music, and the storm's thunder would land on the hit sounds.
 *
 * Everything here is put in the display list right after the backdrop image,
 * at the backdrop's depth (0), wherever in create() this is called. Every
 * sprite, window, menu, message, status tag and damage number BattleScene adds
 * shares that depth and draws in the order added, so they all stay on top;
 * its night shade is added right after this (also depth 0), so a night storm
 * darkens along with the backdrop while the fighters and windows don't.
 * The weather's haze and the smog are under the fighters as well, so only the
 * backdrop dims and the sprites keep their contrast.
 */
export function addBattleWeather(scene: Phaser.Scene, origin: BattleOrigin): void {
  const region = REGION[origin];
  const weather = weatherToday(region);
  if (weather === "clear" || weather === "none") return;
  // bottom to top
  const objects: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | Phaser.GameObjects.Particles.ParticleEmitter> = [];

  if (weather === "ashfall") {
    bakeSheet(scene);
    objects.push(addOvercast(scene, 0x2a2020).setAlpha(0.16));
    const ash = scene.add.particles(0, 0, SHEET, WEATHER_PARTICLES.ashfall);
    ash.fastForward(PREWARM_MS);
    objects.push(ash);
  } else objects.push(addPixelWeather(scene, pixelLook(weather, region), HORIZON, ROWS));

  const backdrop = scene.children.list.find((o) => o instanceof Phaser.GameObjects.Image && o.texture.key.startsWith("battle-bg-"));
  // no backdrop yet: the bottom of the list, under whatever comes next
  const base = backdrop ? scene.children.getIndex(backdrop) + 1 : 0;
  objects.forEach((o, i) => {
    o.setDepth(0);
    scene.children.moveTo(o, base + i);
  });
}
