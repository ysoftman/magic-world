import Phaser from "phaser";
import { type AmbienceCue, Sfx } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH, PIXEL } from "../config";
import { GameState, nightFactor } from "../gameState";
import { drawRows, type PixelMap, retroStyle, scale2x } from "../pixelart";
import { seasonLook, seasonToday } from "../season";
import { type Region, WEATHER_LABEL, type Weather, weatherToday } from "../weather";
import { addNightSky } from "./NightSky";
import { STATUS_HUD_HEIGHT } from "./StatusHud";

export type AmbientKind = Region;

type Particle = Phaser.GameObjects.Particles.Particle;
type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;
type EmitterConfig = Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;

// Over every world sprite (hero and monsters 10, gear and map labels 11) but
// under the town's house speech bubble (12), so a petal never crosses its text,
// and under the NightOverlay (90), so dusk darkens the weather with the ground.
// The area title (95), minimap (96), HUD (110) and every panel (150+) stay on
// top.
const AMBIENT_DEPTH = 11.5;
// Fireflies and volcano embers are the exception: they are lights, so they sit
// just over the NightOverlay instead of being dimmed by it, still under the
// area title (95).
const GLOW_DEPTH = 90.5;
// Weather tints the whole view (rain clouds, whiteout, ash smog) just under the
// NightOverlay, so night still darkens on top; lightning brightens over that.
const OVERCAST_DEPTH = 89.5;
const FLASH_DEPTH = 89.6;
// the area title is drawn at STATUS_HUD_HEIGHT + 24; the caption sits below it
const CAPTION_Y = STATUS_HUD_HEIGHT + 66;

// the one texture every ambient, battle-weather and footstep particle is cut from
export const SHEET = "ambient-px";
const BUTTERFLY_ANIM = "ambient-butterfly";

// Simulated on entry so the air is already full instead of filling up from
// nothing while the player watches.
const PREWARM_MS = 8000;
// How far past the screen edge a particle may go before it wraps round.
const WRAP_MARGIN = 16;
// Seconds for a new day's weather to fade fully in (or out) while the player
// stays in the scene across midnight.
const RAMP_S = 8;
// Rain emission interval at full storm strength; a plain rainy day runs at
// half that density. Drops live ~0.4s, so the cap is never far off it.
const RAIN_FREQ = 4;
const RAIN_CAP = 150;

const TAU = Math.PI * 2;

// Each sprite is its own frame in one strip. Size variety comes from separate
// frames, never from `scale`: a scaled 4px pixel stops lining up with the art.
const LEAF_A = [".lg.", "lggd", ".gd."];
const LEAF_B = ["lg.", "glg", ".gd"];
const PETAL_PALETTE = { p: 0xf9a8d4, q: 0xfbcfe8 };
// white wings so the emitter's `tint` can colour each butterfly
const BUTTERFLY_PALETTE = { w: 0xffffff, b: 0x3b2a20 };

const SPRITES: Record<string, { rows: string[]; palette: PixelMap }> = {
  // the canopy floor is dark green, so the leaves sit a step lighter to read
  "leaf-a": { rows: LEAF_A, palette: { l: 0xb6f08a, g: 0x6cc04a, d: 0x2f7a34 } },
  "leaf-b": { rows: LEAF_B, palette: { l: 0x9be07a, g: 0x52a84a, d: 0x2a6b34 } },
  "leaf-c": { rows: LEAF_A, palette: { l: 0xffe08a, g: 0xe0a83a, d: 0x8a5a22 } },
  // autumn's (season.ts): orange and red, with the gold one above
  "leaf-d": { rows: LEAF_B, palette: { l: 0xffb060, g: 0xe07a2a, d: 0x8a3a14 } },
  "leaf-e": { rows: LEAF_A, palette: { l: 0xf08a68, g: 0xc8442a, d: 0x6a1e14 } },
  // a bright core in a soft halo, so it reads as a light rather than a speck
  firefly: { rows: ["..h..", ".hgh.", "hgcgh", ".hgh.", "..h.."], palette: { c: 0xffffe0, g: 0xe4f57a, h: 0x5f6d1e } },
  "flake-s": { rows: ["w"], palette: { w: 0xffffff } },
  "flake-m": { rows: ["ww", "ww"], palette: { w: 0xeaf6ff } },
  "flake-l": { rows: [".w.", "wWw", ".w."], palette: { w: 0xcfe8ff, W: 0xffffff } },
  streak: { rows: ["wwww"], palette: { w: 0xeaf6ff } },
  // light enough to show through the cave's permanent gloom
  "mote-a": { rows: ["m"], palette: { m: 0xfff3d6 } },
  "mote-b": { rows: ["m"], palette: { m: 0xd8c8a8 } },
  drop: { rows: ["l", "b"], palette: { l: 0xd6f1ff, b: 0x7cc3ee } },
  splash: { rows: ["s"], palette: { s: 0xbfe6ff } },
  "petal-a": { rows: ["pq"], palette: PETAL_PALETTE },
  "petal-b": { rows: ["q", "p"], palette: PETAL_PALETTE },
  "petal-c": { rows: ["wv"], palette: { w: 0xffffff, v: 0xf3e8ff } },
  "bfly-open": { rows: ["ww.ww", "wwbww", ".wbw."], palette: BUTTERFLY_PALETTE },
  "bfly-shut": { rows: [".w.w.", ".wbw.", "..b.."], palette: BUTTERFLY_PALETTE },
  "ember-a": { rows: ["y"], palette: { y: 0xfff0a0 } },
  "ember-b": { rows: ["o"], palette: { o: 0xff8a30 } },
  // a hot head with a cooler tail trailing below it as it rises
  "ember-c": { rows: ["y", "r"], palette: { y: 0xffd060, r: 0xd8452a } },
  "ash-a": { rows: ["a"], palette: { a: 0x9a9090 } },
  "ash-b": { rows: ["a"], palette: { a: 0x6e6666 } },
  "ash-c": { rows: ["ab"], palette: { a: 0xa09898, b: 0x787070 } },
  // a broken wavy line: drawn faint and rising, it reads as heat shimmer
  haze: { rows: ["..hh....hh..", ".h..h..h..h.", "h....hh....h"], palette: { h: 0xffd8a0 } },
  // One column across every three rows: the same 1-in-3 slant as the drops'
  // velocity (speedX about a third of speedY), so the streak points the way
  // it falls.
  "rain-a": { rows: [".b", ".b", ".b", "b.", "b.", "b."], palette: { b: 0xc8dcf0 } },
  "rain-b": { rows: [".b", ".b", ".b", "b.", "b.", "b."], palette: { b: 0x9fb8d8 } },
  "rain-splash": { rows: ["s.s", ".s."], palette: { s: 0xd6e8f8 } },
  // The same rain over snow (a lowland winter's ground, seasonLook): the pale
  // streaks were the snow's own luma (rain-b ~181 on ~188, rain-a ~217), so at
  // the drops' 0.5 alpha they moved it by -4 and +14 against +52 and +70 over
  // the grass. Dark blue-grey instead: -46, -37 and the splash -36.
  "rain-a-snow": { rows: [".b", ".b", ".b", "b.", "b.", "b."], palette: { b: 0x5b7594 } },
  "rain-b-snow": { rows: [".b", ".b", ".b", "b.", "b.", "b."], palette: { b: 0x4a6482 } },
  "rain-splash-snow": { rows: ["s.s", ".s."], palette: { s: 0x6a84a2 } },
  // Footsteps.ts: a boot pressed into the snow, one frame per way of walking
  // (the sheet never rotates a sprite), in the snow skin's own shadow blue,
  // luma ~44 under its ground (0xaebfce, ~188): at the first try's ~25 it
  // vanished once it began to fade
  "print-v": { rows: ["dd", "dd", "dd"], palette: { d: 0x7f93a6 } },
  "print-h": { rows: ["ddd", "ddd"], palette: { d: 0x7f93a6 } },
  // and the puffs a step kicks up: dirt on a path (lighter than the town's and
  // the forest's path tiles, and two pixels wide, a kicked clod: one pixel
  // was gone before the eye found it), ash in the crater, stone dust in the cave
  "puff-dirt": { rows: ["dd"], palette: { d: 0xa08a6a } },
  "puff-dirt-dark": { rows: ["dd"], palette: { d: 0x8a6e4c } },
  "puff-ash": { rows: ["a"], palette: { a: 0x8a8480 } },
  "puff-ash-dark": { rows: ["a"], palette: { a: 0x5e5856 } },
  "puff-stone": { rows: ["s"], palette: { s: 0x6a645d } },
};

// How much of each weather look is showing, 0..1. Eased toward today's target
// every frame, so the weather of a new day drifts in over RAMP_S seconds
// instead of switching at the stroke of midnight.
interface Mix {
  rain: number;
  storm: number;
  snow: number;
  blizzard: number;
  ash: number;
}

const NO_WEATHER: Mix = { rain: 0, storm: 0, snow: 0, blizzard: 0, ash: 0 };
const WEATHER_MIX: Record<Weather, Mix> = {
  clear: NO_WEATHER,
  none: NO_WEATHER,
  rain: { ...NO_WEATHER, rain: 1 },
  storm: { ...NO_WEATHER, rain: 1, storm: 1 },
  snow: { ...NO_WEATHER, snow: 1 },
  blizzard: { ...NO_WEATHER, snow: 1, blizzard: 1 },
  ashfall: { ...NO_WEATHER, ash: 1 },
};

interface Layer {
  emitter: Emitter;
  // the configured emission interval, which show() stretches to thin it out
  freq: number;
  // how hard the snow field's gusts shove this layer sideways (0 = not at all)
  wind: number;
  // Long-lived layers wrap round the screen edges so their density holds while
  // the camera pans; short-lived ones (drips) just leave the frame.
  wrap: boolean;
}

interface Effect {
  layers: Layer[];
  // runs every frame with the current nightFactor()
  tick?: (night: number) => void;
  // sideways push in px/s, scaled per layer by Layer.wind
  wind?: () => number;
  // levels 0..1 for the rain and wind sound beds (Sfx.setWeatherSound)
  sound?: () => { rain: number; wind: number };
  // a held low note under the place (Sfx.setDrone)
  drone?: { level: () => number; freq: number };
}

/**
 * Adds the area's weather and ambient particles to `scene`: one call from
 * create(), and it tears itself down on SHUTDOWN. The weather is today's for
 * `kind` (see weather.ts); `caption` flashes its name under the area title on
 * entry and whenever the day turns while the player is here.
 *
 * The emitters are screen-space (scrollFactor 0) so the effect always covers
 * the view, but every particle is shifted against the camera's own movement
 * each frame, so it reads as hanging in the world rather than stuck to the
 * lens, and wraps round the edges so walking never empties the screen.
 */
export function addAmbient(scene: Phaser.Scene, kind: AmbientKind, { caption = false } = {}): void {
  bakeSheet(scene);
  let weather = weatherToday(kind);
  // today's weather starts in full; only a change while here eases in
  const mix: Mix = { ...WEATHER_MIX[weather] };
  const effect = BUILDERS[kind](scene, mix);
  effect.tick?.(nightFactor());
  // fastForward() emits even when `emitting` is off, so only warm up the
  // layers that are actually on right now (no daytime fireflies).
  for (const { emitter } of effect.layers) if (emitter.emitting) emitter.fastForward(PREWARM_MS);
  const label = caption ? addCaption(scene) : undefined;
  label?.(weather);
  // fireworks, shooting stars and the aurora, over the sky regions
  addNightSky(scene, kind);

  const cam = scene.cameras.main;
  let lastX: number | undefined;
  let lastY: number | undefined;
  const onUpdate = (_time: number, delta: number): void => {
    let dx = lastX === undefined ? 0 : cam.scrollX - lastX;
    let dy = lastY === undefined ? 0 : cam.scrollY - lastY;
    lastX = cam.scrollX;
    lastY = cam.scrollY;
    // a jump this big is the camera snapping onto the hero, not a pan
    if (Math.abs(dx) > GAME_WIDTH / 2 || Math.abs(dy) > GAME_HEIGHT / 2) dx = dy = 0;

    const today = weatherToday(kind);
    if (today !== weather) {
      weather = today;
      label?.(weather);
    }
    easeMix(mix, WEATHER_MIX[weather], delta / 1000 / RAMP_S);
    effect.tick?.(nightFactor());
    const sound = effect.sound?.();
    Sfx.setWeatherSound(sound?.rain ?? 0, sound?.wind ?? 0);
    Sfx.setDrone(effect.drone?.level() ?? 0, effect.drone?.freq);
    const push = (effect.wind?.() ?? 0) * (delta / 1000);
    for (const layer of effect.layers) {
      const sx = layer.wind * push - dx;
      layer.emitter.forEachAlive((p: Particle) => {
        p.x += sx;
        p.y -= dy;
        if (layer.wrap) wrapOnScreen(p);
      }, null);
    }
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
    // the beds outlive the scene (they're on the audio context): leaving for a
    // battle or the title fades them out, the next field scene brings its own
    Sfx.setWeatherSound(0, 0);
    Sfx.setDrone(0);
  });
}

const BUILDERS: Record<AmbientKind, (scene: Phaser.Scene, mix: Mix) => Effect> = {
  forest(scene, mix) {
    const season = seasonal();
    // autumn brings down twice the leaves, turned; the bare winter wood none
    const leaves = addLayer(scene, {
      frame: season.autumn ? AUTUMN_LEAVES : ["leaf-a", "leaf-a", "leaf-b", "leaf-c"],
      ...ANYWHERE_ON_SCREEN,
      lifespan: { min: 7000, max: 10000 },
      speedX: { min: -14, max: 14 },
      speedY: { min: 18, max: 38 },
      accelerationX: sway(26, 2),
      ...tumble(5),
      alpha: fadeInOut(0.85),
      frequency: season.autumn ? 160 : 320,
      maxAliveParticles: season.autumn ? 44 : 26,
    });
    const fireflies = addFireflies(scene);
    const rain = addRain(scene, mix, "forest");
    const snow = addSnowfall(scene, mix);
    // birds by day, an owl and insects by night; the rain hushes them all,
    // and winter keeps only a few birds and the owl
    everyFew(scene, 2000, 6000, () => cue("warble", season.birds * (1 - nightFactor()) * (1 - 0.8 * mix.rain)));
    everyFew(scene, 9000, 18000, () => cue("owl", nightFactor() * (1 - 0.6 * mix.rain)));
    everyFew(scene, 2500, 5000, () => cue("cricket", season.insects * 0.7 * nightFactor() * (1 - 0.7 * mix.rain)));
    return {
      layers: [leaves, fireflies, ...rain.layers, ...snow.layers],
      tick: (night) => {
        // fewer leaves come down in the rain, and fewer fireflies come out
        show(leaves, season.leaves * (1 - night) * (1 - 0.6 * mix.rain), 1 - night);
        show(fireflies, season.insects * night * (1 - 0.75 * mix.rain), night);
        rain.tick();
        snow.tick();
      },
      sound: () => ({ ...rain.sound(), ...snow.sound() }),
    };
  },

  snow(scene, mix) {
    // the cap is raised toward 200 in a blizzard, in tick
    const flakes = addLayer(scene, { ...WEATHER_PARTICLES.flakes, emitting: mix.snow > 0 }, { wind: 1 });
    // The streaks have no velocity of their own here: the gust alone moves
    // them, faster than the flakes, so it reads even on an empty stretch.
    const streaks = addLayer(scene, { ...WEATHER_PARTICLES.streaks, emitting: false }, { wind: 2.6 });

    const whiteout = addOvercast(scene, 0xe6eef7);

    // A blizzard gusts about three times as often and half again as hard, on
    // top of a steady leftward blow (see `wind` below).
    const gust = { wind: 0 };
    const scheduleGust = (): void => {
      scene.time.delayedCall(Phaser.Math.Between(7000, 14000) * (1 - 0.65 * mix.blizzard), () => {
        // mostly along the flakes' own leftward drift
        const dir = Math.random() < 0.65 ? -1 : 1;
        scene.tweens.add({
          targets: gust,
          wind: dir * Phaser.Math.Between(170, 260) * (1 + 0.5 * mix.blizzard),
          duration: 900,
          hold: 1400,
          yoyo: true,
          ease: "Sine.easeInOut",
          onComplete: scheduleGust,
        });
      });
    };
    scheduleGust();

    const wind = (): number => gust.wind - 70 * mix.blizzard;
    return {
      layers: [flakes, streaks],
      tick: () => {
        show(flakes, mix.snow * (1 + 0.6 * mix.blizzard));
        flakes.emitter.maxAliveParticles = Math.round(140 + 60 * mix.blizzard);
        show(streaks, Math.min(1, Math.abs(wind()) / 200));
        whiteout.setAlpha(0.12 * mix.blizzard);
      },
      wind,
      // the wind is heard with the gusts, softer on a plain snowy day
      sound: () => ({ rain: 0, wind: Math.min(1, Math.abs(wind()) / 300) * (0.5 + 0.5 * mix.blizzard) }),
    };
  },

  dungeon(scene) {
    const motes = addLayer(scene, {
      frame: ["mote-a", "mote-a", "mote-b"],
      ...ANYWHERE_ON_SCREEN,
      lifespan: { min: 5000, max: 9000 },
      speed: { min: 3, max: 10 },
      accelerationX: sway(4, 1),
      accelerationY: sway(3, 1.3),
      alpha: fadeInOut(0.75),
      frequency: 200,
      maxAliveParticles: 36,
    });
    const drops = addLayer(
      scene,
      { frame: "drop", lifespan: { min: 380, max: 520 }, gravityY: 1100, alpha: 0.85, emitting: false },
      { wrap: false },
    );
    // y grows downward, so 200..340 degrees is an upward fan
    const splash = addLayer(
      scene,
      {
        frame: "splash",
        lifespan: { min: 220, max: 360 },
        speed: { min: 40, max: 90 },
        angle: { min: 200, max: 340 },
        gravityY: 520,
        alpha: { start: 0.8, end: 0 },
        emitting: false,
      },
      { wrap: false },
    );
    drops.emitter.onParticleDeath((p: Particle) => {
      splash.emitter.emitParticleAt(p.x, p.y, 3);
      // heard as it lands, in time with the splash
      Sfx.ambience("drip", Phaser.Math.FloatBetween(0.7, 1));
    });

    const scheduleDrip = (): void => {
      scene.time.delayedCall(Phaser.Math.Between(1400, 4200), () => {
        // high enough on screen that the fall and the splash both stay in view
        const x = Phaser.Math.Between(40, GAME_WIDTH - 40);
        const y = Phaser.Math.Between(STATUS_HUD_HEIGHT + 40, GAME_HEIGHT * 0.6);
        drops.emitter.emitParticleAt(x, y, 1);
        scheduleDrip();
      });
    };
    scheduleDrip();

    // the cave's own low resonance under it all
    return { layers: [motes, drops, splash], drone: { level: () => 1, freq: 120 } };
  },

  volcano(scene, mix) {
    // Haze, then ash, then embers, so the brightest layer draws on top. All
    // three ride the crater's updraft; the haze barely shows, a few faint
    // waves at a time.
    const haze = addLayer(scene, {
      frame: "haze",
      ...ANYWHERE_ON_SCREEN,
      lifespan: { min: 3000, max: 4500 },
      speedY: { min: -16, max: -8 },
      accelerationX: sway(10, 1.5),
      ...tumble(3),
      alpha: fadeInOut(0.16),
      frequency: 900,
      maxAliveParticles: 5,
    });
    haze.emitter.setBlendMode(Phaser.BlendModes.ADD);
    const ash = addLayer(scene, {
      frame: ["ash-a", "ash-a", "ash-b"],
      ...ANYWHERE_ON_SCREEN,
      lifespan: { min: 6000, max: 10000 },
      speedX: { min: -8, max: 8 },
      speedY: { min: -12, max: -4 },
      accelerationX: sway(6, 1),
      alpha: fadeInOut(0.6),
      frequency: 300,
      maxAliveParticles: 26,
    });
    const embers = addLayer(scene, {
      frame: ["ember-a", "ember-b", "ember-b", "ember-c"],
      ...ANYWHERE_ON_SCREEN,
      lifespan: { min: 3000, max: 5500 },
      speedX: { min: -10, max: 10 },
      speedY: { min: -45, max: -20 },
      accelerationX: sway(20, 2),
      // flickers as it burns down
      alpha: { onEmit: () => 0, onUpdate: (_p, _k, t) => Math.sin(Math.PI * t) * (0.75 + 0.25 * Math.sin(t * TAU * 6)) },
      frequency: 110,
      maxAliveParticles: 40,
    });
    embers.emitter.setBlendMode(Phaser.BlendModes.ADD).setDepth(GLOW_DEPTH);

    // Every few seconds a vent somewhere puffs a cluster of embers at once,
    // so the field is not just an even drizzle.
    const scheduleFlare = (): void => {
      scene.time.delayedCall(Phaser.Math.Between(3000, 7000), () => {
        const x = Phaser.Math.Between(80, GAME_WIDTH - 80);
        const y = Phaser.Math.Between(GAME_HEIGHT * 0.4, GAME_HEIGHT - 40);
        embers.emitter.emitParticleAt(x, y, Phaser.Math.Between(6, 10));
        scheduleFlare();
      });
    };
    scheduleFlare();

    // ashfall days: heavier ash coming down out of a smoggy sky
    const ashfall = addLayer(scene, { ...WEATHER_PARTICLES.ashfall, emitting: mix.ash > 0 });
    const smog = addOvercast(scene, 0x2a2020);

    // lava bubbling, the odd groan from deep down, a low rumble under both
    everyFew(scene, 1200, 3500, () => cue("bubble", Phaser.Math.FloatBetween(0.6, 1)));
    everyFew(scene, 10000, 22000, () => cue("rumble", 0.8));

    return {
      layers: [haze, ash, embers, ashfall],
      tick: () => {
        show(ashfall, mix.ash);
        smog.setAlpha(0.16 * mix.ash);
      },
      drone: { level: () => 0.8, freq: 60 },
    };
  },

  // petals and butterflies by day, fireflies at night, rain on a wet day
  town(scene, mix) {
    if (!scene.anims.exists(BUTTERFLY_ANIM)) {
      scene.anims.create({
        key: BUTTERFLY_ANIM,
        frames: [
          { key: SHEET, frame: "bfly-open" },
          { key: SHEET, frame: "bfly-shut" },
        ],
        frameRate: 8,
        repeat: -1,
      });
    }
    const season = seasonal();
    // autumn's leaves blow through on the petals' breeze; winter has neither
    const petals = addLayer(scene, {
      frame: season.autumn ? AUTUMN_LEAVES : ["petal-a", "petal-b", "petal-c"],
      ...ANYWHERE_ON_SCREEN,
      lifespan: { min: 8000, max: 11000 },
      speedX: { min: 12, max: 34 },
      speedY: { min: 10, max: 24 },
      accelerationX: sway(18, 1.5),
      ...tumble(4),
      alpha: fadeInOut(0.85),
      frequency: 900,
      maxAliveParticles: 12,
    });
    const butterflies = addLayer(scene, {
      anim: BUTTERFLY_ANIM,
      ...ANYWHERE_ON_SCREEN,
      lifespan: { min: 9000, max: 13000 },
      speed: { min: 16, max: 32 },
      accelerationX: sway(14, 1.2),
      // quick bobbing on top of the wander: the flutter
      accelerationY: sway(120, 9),
      tint: [0xffffff, 0xfde68a, 0xf9a8d4, 0xa5d8ff],
      alpha: fadeInOut(0.95),
      frequency: 3500,
      maxAliveParticles: 4,
    });
    const fireflies = addFireflies(scene);
    const rain = addRain(scene, mix, "town");
    const snow = addSnowfall(scene, mix);
    // birdsong by day, crickets by night; the rain hushes both, and winter
    // keeps only a few birds
    everyFew(scene, 3000, 8000, () => cue("bird", season.birds * (1 - nightFactor()) * (1 - 0.8 * mix.rain)));
    everyFew(scene, 1500, 4000, () => cue("cricket", season.insects * nightFactor() * (1 - 0.7 * mix.rain)));
    return {
      layers: [petals, butterflies, fireflies, ...rain.layers, ...snow.layers],
      tick: (night) => {
        // the rain replaces the petals and butterflies outright
        show(petals, season.leaves * (1 - night) * (1 - mix.rain));
        show(butterflies, season.butterflies * (1 - night) * (1 - mix.rain));
        show(fireflies, season.insects * night * (1 - 0.75 * mix.rain), night);
        rain.tick();
        snow.tick();
      },
      sound: () => ({ ...rain.sound(), ...snow.sound() }),
    };
  },
};

// Fires `play` every `minMs`..`maxMs`, each gap drawn fresh, for as long as the
// scene runs: its clock is cleared on shutdown, and stops with a hidden tab.
function everyFew(scene: Phaser.Scene, minMs: number, maxMs: number, play: () => void): void {
  const next = (): void => {
    scene.time.delayedCall(Phaser.Math.Between(minMs, maxMs), () => {
      play();
      next();
    });
  };
  next();
}

// An ambience cue at `level` (0..1, from the hour and the weather), skipped
// rather than played near-silent once the level is that low.
function cue(name: AmbienceCue, level: number): void {
  if (level > 0.05) Sfx.ambience(name, level);
}

const ANYWHERE_ON_SCREEN: EmitterConfig = {
  x: { min: 0, max: GAME_WIDTH },
  y: { min: 0, max: GAME_HEIGHT },
};

// The weather's particle setups, shared by the field (the builders above) and
// the battle screen (BattleWeather.ts); each user adds its own on/off, density
// and wind on top.
export const WEATHER_PARTICLES = {
  rain: {
    frame: ["rain-a", "rain-a", "rain-b"],
    ...ANYWHERE_ON_SCREEN,
    lifespan: { min: 280, max: 520 },
    speedX: { min: -320, max: -280 },
    speedY: { min: 860, max: 980 },
    alpha: 0.5,
    frequency: RAIN_FREQ,
    maxAliveParticles: RAIN_CAP,
  },
  splash: { frame: "rain-splash", lifespan: { min: 180, max: 260 }, alpha: { start: 0.6, end: 0 }, maxAliveParticles: 30, emitting: false },
  flakes: {
    // small flakes far outnumber the big ones
    frame: ["flake-s", "flake-s", "flake-s", "flake-m", "flake-m", "flake-l"],
    ...ANYWHERE_ON_SCREEN,
    lifespan: { min: 8000, max: 12000 },
    speedX: { min: -22, max: 8 },
    speedY: { min: 40, max: 85 },
    accelerationX: sway(10, 1.5),
    alpha: fadeInOut(0.8),
    frequency: 70,
    maxAliveParticles: 140,
  },
  // wind-blown streaks
  streaks: {
    frame: "streak",
    ...ANYWHERE_ON_SCREEN,
    lifespan: { min: 500, max: 900 },
    alpha: fadeInOut(0.4),
    frequency: 45,
    maxAliveParticles: 24,
  },
  ashfall: {
    frame: ["ash-a", "ash-b", "ash-c"],
    ...ANYWHERE_ON_SCREEN,
    lifespan: { min: 6000, max: 9000 },
    speedX: { min: -14, max: 6 },
    speedY: { min: 22, max: 44 },
    accelerationX: sway(8, 1.2),
    ...tumble(3),
    alpha: fadeInOut(0.75),
    frequency: 70,
    maxAliveParticles: 100,
  },
} satisfies Record<string, EmitterConfig>;

// The rain and its splash for `region`: the dark streaks over a lowland
// winter's snow (seasonLook, as the map's skin is chosen), the pale ones on
// every other ground.
export function rainParticles(region: Region): { rain: EmitterConfig; splash: EmitterConfig } {
  if (seasonLook(region) !== "winter") return { rain: WEATHER_PARTICLES.rain, splash: WEATHER_PARTICLES.splash };
  return {
    rain: { ...WEATHER_PARTICLES.rain, frame: ["rain-a-snow", "rain-a-snow", "rain-b-snow"] },
    splash: { ...WEATHER_PARTICLES.splash, frame: "rain-splash-snow" },
  };
}

function addFireflies(scene: Phaser.Scene): Layer {
  const layer = addLayer(scene, {
    frame: "firefly",
    ...ANYWHERE_ON_SCREEN,
    lifespan: { min: 4000, max: 7000 },
    speed: { min: 4, max: 14 },
    accelerationX: sway(10, 1.5),
    accelerationY: sway(8, 1.1),
    // a slow blink riding on the birth-to-death fade
    alpha: { onEmit: () => 0, onUpdate: (_p, _k, t) => Math.sin(Math.PI * t) * (0.7 + 0.3 * Math.sin(t * TAU * 4)) },
    frequency: 260,
    maxAliveParticles: 22,
    emitting: false,
  });
  // fireflies are lights, not motes: ADD makes them glow over the dark ground
  layer.emitter.setBlendMode(Phaser.BlendModes.ADD).setDepth(GLOW_DEPTH);
  return layer;
}

// What the season (season.ts) puts in the town's and the forest's air, as
// levels for show() and the ambience cues. Read once, when the scene builds,
// the way its map skin is, so the two always agree.
function seasonal(): { autumn: boolean; leaves: number; butterflies: number; insects: number; birds: number } {
  const season = seasonToday();
  const winter = season === "winter";
  return {
    autumn: season === "autumn",
    leaves: winter ? 0 : 1,
    butterflies: season === "spring" || season === "summer" ? 1 : 0,
    insects: winter ? 0 : 1,
    birds: winter ? 0.3 : 1,
  };
}
const AUTUMN_LEAVES = ["leaf-c", "leaf-d", "leaf-d", "leaf-e"];

// Snow on a lowland winter day (weather.ts): the snow field's flakes, a
// lighter fall without its gusts, streaks and whiteout, and a breath of wind
// under it. Shared by the town and the forest, which share one sky.
function addSnowfall(scene: Phaser.Scene, mix: Mix): { layers: Layer[]; tick: () => void; sound: () => { wind: number } } {
  const flakes = addLayer(scene, { ...WEATHER_PARTICLES.flakes, frequency: 110, maxAliveParticles: 90, emitting: mix.snow > 0 });
  return {
    layers: [flakes],
    tick: () => show(flakes, mix.snow),
    sound: () => ({ wind: 0.2 * mix.snow }),
  };
}

// Slanted rain with a splash where each drop lands (two in five, to keep the
// count down), a darker sky, the sound of it, and in a storm denser, louder
// rain and the odd lightning and thunder. Shared by the town and the forest,
// which share one sky.
function addRain(
  scene: Phaser.Scene,
  mix: Mix,
  region: "town" | "forest",
): { layers: Layer[]; tick: () => void; sound: () => { rain: number; wind: number } } {
  const { rain, splash: splashes } = rainParticles(region);
  const drops = addLayer(scene, { ...rain, emitting: mix.rain > 0 });
  const splash = addLayer(scene, splashes, { wrap: false });
  drops.emitter.onParticleDeath((p: Particle) => {
    // not while addAmbient prewarms the drops: the splash layer isn't stepped
    // then, so they would all land on the first frame at once
    if (!drops.emitter.skipping && Math.random() < 0.4) splash.emitter.emitParticleAt(p.x, p.y, 1);
  });
  const clouds = addOvercast(scene, 0x1c2433);
  // only once the storm has fully rolled in, not while it eases in or out
  addLightning(scene, () => mix.storm > 0.9);
  return {
    layers: [drops, splash],
    tick: () => {
      show(drops, mix.rain * (0.5 + 0.5 * mix.storm), mix.rain);
      clouds.setAlpha(0.12 * mix.rain + 0.08 * mix.storm);
    },
    sound: () => ({ rain: mix.rain * (0.6 + 0.4 * mix.storm), wind: 0 }),
  };
}

// Storm lightning, kept gentle for photosensitive players: a faint, short
// brightening (peak alpha 0.12 of a pale blue, never a white-out) that eases
// in and out, one strike every 6-14s with at most one echo half a second
// later, so never more than two flashes in any second (the limit is three).
// The flash is off under prefers-reduced-motion and with the FLASHES setting
// off (GameState.flashes, see fx.ts) -- read at every pulse, not once here, so
// flipping it in SETTINGS mid-storm takes effect from the next strike. The
// thunder 0.3-1.2s after each strike plays either way: a sound is no risk to
// a photosensitive player, and it keeps the storm a storm. The battle screen
// strikes softer (`peak`) and without thunder (BattleWeather.ts). Returns the
// flash, or null under reduced motion.
export function addLightning(
  scene: Phaser.Scene,
  stormy: () => boolean,
  { peak = 0.12, thunder = true } = {},
): Phaser.GameObjects.Rectangle | null {
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const flash = reducedMotion ? null : addOvercast(scene, 0xe8f0ff, FLASH_DEPTH);
  const pulse = (peak: number): void => {
    if (!flash || !GameState.flashes) return;
    scene.tweens.add({
      targets: flash,
      alpha: peak,
      duration: 90,
      ease: "Quad.easeOut",
      onComplete: () => scene.tweens.add({ targets: flash, alpha: 0, duration: 420, ease: "Quad.easeIn" }),
    });
  };
  const scheduleStrike = (): void => {
    scene.time.delayedCall(Phaser.Math.Between(6000, 14000), () => {
      if (stormy()) {
        pulse(peak);
        // the echo, a little over half as bright
        if (Math.random() < 0.5) scene.time.delayedCall(520, () => pulse(peak * 0.58));
        if (thunder) scene.time.delayedCall(Phaser.Math.Between(300, 1200), () => Sfx.thunder(Phaser.Math.FloatBetween(0.7, 1)));
      }
      scheduleStrike();
    });
  };
  scheduleStrike();
  return flash;
}

export function addOvercast(scene: Phaser.Scene, color: number, depth = OVERCAST_DEPTH): Phaser.GameObjects.Rectangle {
  return scene.add
    .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, color, 1)
    .setScrollFactor(0)
    .setDepth(depth)
    .setAlpha(0);
}

// Returns a function that shows a weather's name under the area title for a
// few seconds; "none" (the cave) shows nothing.
function addCaption(scene: Phaser.Scene): (weather: Weather) => void {
  const text = scene.add
    .text(GAME_WIDTH / 2, CAPTION_Y, "", retroStyle(5, "#dbe7f3"))
    .setOrigin(0.5)
    .setStroke("#1a1028", 4)
    .setScrollFactor(0)
    .setDepth(95)
    .setAlpha(0);
  return (weather) => {
    scene.tweens.killTweensOf(text);
    text.setText(WEATHER_LABEL[weather]).setAlpha(0);
    if (!WEATHER_LABEL[weather]) return;
    scene.tweens.add({ targets: text, alpha: 1, duration: 300, hold: 2600, yoyo: true });
  };
}

function easeMix(mix: Mix, target: Mix, step: number): void {
  for (const k of Object.keys(mix) as Array<keyof Mix>) {
    mix[k] += Phaser.Math.Clamp(target[k] - mix[k], -step, step);
  }
}

function addLayer(scene: Phaser.Scene, config: EmitterConfig, { wind = 0, wrap = true } = {}): Layer {
  const emitter = scene.add.particles(0, 0, SHEET, config).setScrollFactor(0).setDepth(AMBIENT_DEPTH);
  const freq = typeof config.frequency === "number" ? config.frequency : 0;
  return { emitter, freq, wind, wrap };
}

// Fades a layer to `alpha` and thins its emission to `amount` of the
// configured rate, for the day/night cross-fade and the weather. A layer that
// has faded out stops emitting so it costs nothing until it comes back.
// Setting `frequency` directly, not via setFrequency(), which would reset the
// emit countdown every frame and starve the emitter.
function show(layer: Layer, amount: number, alpha = Math.min(1, amount)): void {
  layer.emitter.setAlpha(alpha);
  layer.emitter.emitting = amount > 0.05;
  if (layer.freq > 0 && amount > 0.05) layer.emitter.frequency = layer.freq / amount;
}

// Particles can be born anywhere on screen, so they fade in from nothing
// instead of popping up mid-air at full strength.
function fadeInOut(peak: number): Phaser.Types.GameObjects.Particles.EmitterOpCustomUpdateConfig {
  return { onEmit: () => 0, onUpdate: (_p, _k, t) => peak * Math.sin(Math.PI * t) };
}

// A side-to-side acceleration that cycles `cycles` times over each life.
// Particles are born at different moments, so they never sway in step.
function sway(amp: number, cycles: number): Phaser.Types.GameObjects.Particles.EmitterOpCustomUpdateConfig {
  return { onEmit: () => 0, onUpdate: (_p, _k, t) => amp * Math.cos(t * TAU * cycles) };
}

// Mirrors the sprite back and forth instead of rotating it: a rotated pixel
// sprite smears off the grid, a flipped one stays crisp.
function tumble(flips: number): Pick<EmitterConfig, "scaleX" | "scaleY"> {
  return {
    scaleX: { onEmit: () => 1, onUpdate: (_p, _k, t) => (Math.sin(t * TAU * flips) >= 0 ? 1 : -1) },
    scaleY: 1,
  };
}

function wrapOnScreen(p: Particle): void {
  if (p.x < -WRAP_MARGIN) p.x += GAME_WIDTH + WRAP_MARGIN * 2;
  else if (p.x > GAME_WIDTH + WRAP_MARGIN) p.x -= GAME_WIDTH + WRAP_MARGIN * 2;
  if (p.y < -WRAP_MARGIN) p.y += GAME_HEIGHT + WRAP_MARGIN * 2;
  else if (p.y > GAME_HEIGHT + WRAP_MARGIN) p.y -= GAME_HEIGHT + WRAP_MARGIN * 2;
}

// The ambient sprites are drawn in half-size art pixels (2px), finer than the
// 4px world they drift over, in one of two ways. What reads as a point (dust,
// sparks, small flakes, drops) simply halves. What reads by its outline (rain,
// fireflies, leaves, butterflies, petals, haze, the big flake) keeps its size
// and is redrawn through Scale2x, so only its edges get finer: halved, the
// rain shrank to 4x12px streaks that all but vanished over the grass (a
// third of the pixels it changed) and a firefly to a 10px fleck. Footsteps.ts's
// prints and puffs keep the full 4px — they lie on the ground at the hero's
// own scale.
const FINE_PX = PIXEL / 2;
const POINTS = new Set([
  "flake-s",
  "flake-m",
  "streak",
  "mote-a",
  "mote-b",
  "drop",
  "splash",
  "ember-a",
  "ember-b",
  "ember-c",
  "ash-a",
  "ash-b",
  "ash-c",
]);

// the grid each sprite is drawn from, and its cell size (pixelart's scale2x,
// off the grid transparent, so a sprite never grows past its outline)
function bakeGrid(name: string, rows: string[]): { rows: readonly string[]; px: number } {
  if (name.startsWith("print-") || name.startsWith("puff-")) return { rows, px: PIXEL };
  return POINTS.has(name) ? { rows, px: FINE_PX } : { rows: scale2x(rows), px: FINE_PX };
}

// Bakes every ambient sprite into one strip with a named frame each.
export function bakeSheet(scene: Phaser.Scene): void {
  // Area scenes restart on every visit, and generateTexture draws onto an
  // existing key instead of replacing it (see makeTilesetTexture), so bake once.
  if (scene.textures.exists(SHEET)) return;
  const g = scene.add.graphics();
  const frames: Array<{ name: string; x: number; w: number; h: number }> = [];
  let x = 0;
  let height = 0;
  for (const [name, sprite] of Object.entries(SPRITES)) {
    const { palette } = sprite;
    const { rows, px } = bakeGrid(name, sprite.rows);
    const w = Math.max(...rows.map((r) => r.length)) * px;
    const h = rows.length * px;
    drawRows(g, rows, palette, x, 0, { px });
    frames.push({ name, x, w, h });
    // one empty pixel between frames so none can bleed into its neighbour
    x += w + PIXEL;
    height = Math.max(height, h);
  }
  g.generateTexture(SHEET, x, height);
  g.destroy();
  const texture = scene.textures.get(SHEET);
  for (const f of frames) texture.add(f.name, 0, f.x, 0, f.w, f.h);
}
