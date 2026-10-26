import Phaser from "phaser";
import { Sfx } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH, PIXEL } from "../config";
import { eventToday } from "../events";
import { GameState, hour, nightFactor } from "../gameState";
import { keepBlocky, makeTexture } from "../pixelart";
import { isWet, type Region, weatherToday } from "../weather";
import { STATUS_HUD_HEIGHT } from "./StatusHud";

// Over the night shade (90), its lights (90.4) and Ambient's fireflies and
// embers (90.5), under the guide arrow (91), the area title (95), the
// minimap (96), the HUD (110), the panels (150) and the toasts (200).
const SKY_DEPTH = 90.6;
// The sky is the top of the screen, under the HUD: fireworks burst, stars fall
// and the aurora hangs between here and SKY_BOTTOM.
const SKY_TOP = STATUS_HUD_HEIGHT + 24;
const SKY_BOTTOM = 300;

// Festival fireworks: a town event's night (events.ts), 20:00..23:00, one
// shell every 1.8-4.5s while it isn't raining.
const FIREWORK_HOURS = [20, 23];
const FIREWORK_COLORS = [0xff7ab6, 0xffd166, 0x7ee8fa, 0x9cf27a, 0xc59bff];
const SPARKS_PER_BURST = 36;
// The sky lights up a little with each burst: a faint wash of the shell's
// colour, under half the storm's lightning peak (0.12). Off with the FLASHES
// setting and under prefers-reduced-motion, as the lightning is; the sparks
// alone are no flash (a few dozen 4px points), so they stay.
const BURST_GLOW = 0.05;
// While the fireworks are on, the sky behind them darkens a little: the
// night's navy, deepest under the HUD and gone by FIREWORK_VEIL_H below it,
// eased in and out over ~2.5s. The snowed-in winter town is pale even at
// night, and additive sparks barely showed on it.
const FIREWORK_VEIL = 0.45;
const FIREWORK_VEIL_H = 232;

// A shooting star now and then on a clear night: one every 40-110s.
const METEOR_GAP_MS = [40000, 110000];
const METEOR_RUN = 260;
const METEOR_MS = 650;

// The snow field's aurora on a clear night: a curtain hung along a slow wave
// across the top of the sky (y ~112-200, clear of the tags below). Strands
// are born inside that band, more of them where a slowly drifting fold is
// bright, each fading in and out where it was born; the whole curtain sways
// sideways over ~7s and breathes over ~8s, never flashing.
const AURORA_EMIT_MS = 70;
const AURORA_CAP = 70;
const AURORA_PEAK = 0.55;
// the band's centre line, and how far the wave lifts and drops it
const AURORA_Y = SKY_TOP + 44;
const AURORA_WAVE = 15;
// how far the curtain swings either way, in px
const AURORA_SWAY = 12;
// For ADD blending, where black is see-through: the spark and the star are
// grey ramps tinted at emission.
const SKY_SPRITES: Record<string, { rows: string[]; palette: Record<string, number> }> = {
  // 2x2: a single art pixel was lost against the snowed-in town at night
  "sky-spark": { rows: ["ww", "ww"], palette: { w: 0xffffff } },
  // brightest at the head (bottom left), the tail thinning up and right;
  // flipped for a star falling the other way
  "sky-meteor": {
    rows: [
      ".............1",
      "............1.",
      "...........2..",
      "..........2...",
      ".........3....",
      "........4.....",
      ".......5......",
      "......6.......",
      ".....7........",
      "....8.........",
      "...8..........",
      "..9...........",
      "89............",
      "W8............",
    ],
    palette: {
      1: 0x141414,
      2: 0x242424,
      3: 0x383838,
      4: 0x4c4c4c,
      5: 0x646464,
      6: 0x808080,
      7: 0x9c9c9c,
      8: 0xbcbcbc,
      9: 0xdcdcdc,
      W: 0xffffff,
    },
  },
};
// the spark stays a full 2x2 block: Scale2x (pixelart.ts) cut its corners
keepBlocky(SKY_SPRITES["sky-spark"].rows);

// The aurora's strands (frames "a", "b" and "c"), top to bottom: violet
// fading out at the top, teal, a bright green hem low down and its underside
// softened, so neither end is a hard edge; "b" leans violet and "c" is "a"
// with its violet squeezed into fewer rows under a black top (black adds
// nothing), so all the hems line up along the wave while the tops stay
// ragged. 6 art px wide, the outer columns at half strength, so strands born
// side by side overlap into one sheet of curtain rather than reading as
// separate streaks.
const STRAND_A = [
  0x0a0414, 0x140828, 0x1e0c3a, 0x28104c, 0x2a1858, 0x242868, 0x1a3a60, 0x165050, 0x18684c, 0x1c8250, 0x22a058, 0x2cc066, 0x1c7a44,
  0x0a2c18,
];
const STRAND_RAMPS = [
  STRAND_A,
  [
    0x0e0414, 0x1c0828, 0x2a0c3c, 0x361250, 0x381a5c, 0x30265e, 0x24345a, 0x1a4654, 0x165c4c, 0x1a7650, 0x20925a, 0x28b064, 0x187040,
    0x082814,
  ],
  [0, 0, 0, 0, STRAND_A[1], STRAND_A[3], STRAND_A[5], ...STRAND_A.slice(7)],
];
const STRAND_FRAMES = ["a", "b", "c"];
const STRAND_W = 6;
const half = (c: number): number => (c >> 1) & 0x7f7f7f;

function bake(scene: Phaser.Scene): void {
  if (scene.textures.exists("sky-strand")) return;
  for (const [key, { rows, palette }] of Object.entries(SKY_SPRITES)) makeTexture(scene, key, rows, palette);
  const g = scene.add.graphics();
  STRAND_RAMPS.forEach((ramp, v) => {
    ramp.forEach((color, y) => {
      for (let x = 0; x < STRAND_W; x++) {
        g.fillStyle(x === 0 || x === STRAND_W - 1 ? half(color) : color, 1);
        g.fillRect((v * (STRAND_W + 1) + x) * PIXEL, y * PIXEL, PIXEL, PIXEL);
      }
    });
  });
  const strandH = STRAND_RAMPS[0].length * PIXEL;
  g.generateTexture("sky-strand", (STRAND_RAMPS.length * (STRAND_W + 1) - 1) * PIXEL, strandH);
  g.clear();
  const strands = scene.textures.get("sky-strand");
  STRAND_FRAMES.forEach((name, v) => {
    strands.add(name, 0, v * (STRAND_W + 1) * PIXEL, 0, STRAND_W * PIXEL, strandH);
  });
  // the fireworks' veil: the night's navy in 8px steps, opaque at the top
  // (the image's alpha scales it) and clear at the bottom
  const steps = FIREWORK_VEIL_H / 8;
  for (let i = 0; i < steps; i++) {
    g.fillStyle(0x0e0e30, (1 - i / steps) ** 1.2);
    g.fillRect(0, i * 8, 4, 8);
  }
  g.generateTexture("sky-veil", 4, FIREWORK_VEIL_H);
  g.destroy();
}

/**
 * Small delights in the night sky over `region`: fireworks over the town on a
 * festival night, the odd shooting star on a clear night in the town, the
 * forest and the snow field, and the aurora over the snow field. Screen-fixed
 * like the sky they're in (the stars don't scroll past as you walk), purely
 * visual. One emitter or image per effect, pooled, so a scene gains at most
 * four display objects. Called from addAmbient; tears down with the scene.
 */
export function addNightSky(scene: Phaser.Scene, region: Region): void {
  if (region !== "town" && region !== "forest" && region !== "snow") return;
  bake(scene);
  const clear = (): boolean => weatherToday(region) === "clear";
  if (region === "town") addFireworks(scene);
  addMeteors(scene, clear);
  if (region === "snow") addAurora(scene, clear);
}

const fixed = <T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(
  o: T,
): T => o.setScrollFactor(0).setDepth(SKY_DEPTH);

function addFireworks(scene: Phaser.Scene): void {
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  let color = FIREWORK_COLORS[0];
  // the shell's trail is half a spark
  let size = 1;
  const sparks = fixed(
    scene.add.particles(0, 0, "sky-spark", {
      // the trail hangs where the shell passed; the burst flies wide
      speed: { onEmit: () => (size < 1 ? Phaser.Math.Between(4, 16) : Phaser.Math.Between(80, 200)) },
      angle: { min: 0, max: 360 },
      gravityY: 60,
      lifespan: { min: 1000, max: 1600 },
      scale: { onEmit: () => size },
      // a quick twinkle riding the fade
      alpha: { onEmit: () => 1, onUpdate: (_p, _k, t) => (1 - t) * (0.75 + 0.25 * Math.sin(t * 40)) },
      tint: { onEmit: () => color },
      maxAliveParticles: 160,
      emitting: false,
    }),
  ).setBlendMode(Phaser.BlendModes.ADD);
  const glow = reducedMotion
    ? null
    : fixed(scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 1))
        .setDepth(SKY_DEPTH - 0.05)
        .setAlpha(0);

  const veil = fixed(scene.add.image(0, STATUS_HUD_HEIGHT, "sky-veil"))
    .setOrigin(0, 0)
    .setDisplaySize(GAME_WIDTH, FIREWORK_VEIL_H)
    .setDepth(SKY_DEPTH - 0.08)
    .setAlpha(0);
  const festive = (): boolean => {
    const h = hour();
    return !!eventToday() && h >= FIREWORK_HOURS[0] && h < FIREWORK_HOURS[1] && !isWet(weatherToday("town"));
  };
  scene.time.addEvent({
    delay: 100,
    loop: true,
    callback: () => veil.setAlpha(Phaser.Math.Clamp(veil.alpha + (festive() ? 0.012 : -0.012), 0, FIREWORK_VEIL)),
  });

  const launch = (): void => {
    color = Phaser.Utils.Array.GetRandom(FIREWORK_COLORS);
    const x = Phaser.Math.Between(140, GAME_WIDTH - 140);
    const y = Phaser.Math.Between(SKY_TOP + 20, SKY_BOTTOM - 40);
    // the shell climbs from below the sky band, shedding a faint trail
    const shell = { y: SKY_BOTTOM + 60 };
    scene.tweens.add({
      targets: shell,
      y,
      duration: 600,
      ease: "Quad.easeOut",
      onUpdate: () => {
        size = 0.5;
        sparks.emitParticleAt(x, shell.y, 1);
      },
      onComplete: () => {
        size = 1;
        sparks.emitParticleAt(x, y, SPARKS_PER_BURST);
        Sfx.ambience("pop", Phaser.Math.FloatBetween(0.7, 1));
        if (!glow || !GameState.flashes) return;
        scene.tweens.killTweensOf(glow);
        glow.setFillStyle(color).setAlpha(0);
        scene.tweens.add({ targets: glow, alpha: BURST_GLOW, duration: 80, yoyo: true, hold: 40, ease: "Quad.easeOut" });
      },
    });
  };
  const schedule = (): void => {
    scene.time.delayedCall(Phaser.Math.Between(1800, 4500), () => {
      if (festive()) launch();
      schedule();
    });
  };
  schedule();
}

function addMeteors(scene: Phaser.Scene, clear: () => boolean): void {
  const star = fixed(scene.add.image(0, 0, "sky-meteor"))
    .setBlendMode(Phaser.BlendModes.ADD)
    .setVisible(false);
  const schedule = (): void => {
    scene.time.delayedCall(Phaser.Math.Between(METEOR_GAP_MS[0], METEOR_GAP_MS[1]), () => {
      if (clear() && nightFactor() > 0.8) fall();
      schedule();
    });
  };
  const fall = (): void => {
    // down and to the left (the texture's way) or, flipped, to the right,
    // always along its own 45 degrees
    const dir = Math.random() < 0.5 ? -1 : 1;
    const x = Phaser.Math.Between(240, GAME_WIDTH - 240);
    const y = Phaser.Math.Between(SKY_TOP, SKY_TOP + 80);
    star
      .setPosition(x, y)
      .setFlipX(dir > 0)
      .setAlpha(0)
      .setVisible(true);
    scene.tweens.add({
      targets: star,
      x: x + dir * METEOR_RUN,
      y: y + METEOR_RUN,
      duration: METEOR_MS,
      onUpdate: (tween) => star.setAlpha(Math.min(1, tween.progress * 6, (1 - tween.progress) * 3)),
      onComplete: () => star.setVisible(false),
    });
  };
  schedule();
}

function addAurora(scene: Phaser.Scene, clear: () => boolean): void {
  let level = 0;
  let breath = 1;
  const strands = fixed(
    scene.add.particles(0, 0, "sky-strand", {
      frame: ["a", "a", "b", "c"],
      lifespan: { min: 3000, max: 5000 },
      // a slight drift of its own; the sway below moves them all together
      speedX: { min: -3, max: 3 },
      alpha: { onEmit: () => 0, onUpdate: (_p, _k, t) => AURORA_PEAK * level * breath * Math.sin(Math.PI * t) },
      maxAliveParticles: AURORA_CAP,
      emitting: false,
    }),
  ).setBlendMode(Phaser.BlendModes.ADD);
  // two slow waves, so the curtain's line never repeats exactly
  const wave = (x: number, t: number): number =>
    AURORA_Y + AURORA_WAVE * (0.65 * Math.sin(x / 210 + t / 4800) + 0.35 * Math.sin(x / 90 - t / 2700));
  // the curtain's folds: where along it the strands crowd, drifting slowly
  const fold = (x: number, t: number): number => 0.5 + 0.5 * Math.sin(x / 160 - t / 3400);
  scene.time.addEvent({
    delay: AURORA_EMIT_MS,
    loop: true,
    callback: () => {
      const t = scene.time.now;
      // up with the dark and gone in daylight, eased so a clear night that
      // clouds over at midnight fades rather than snaps
      const target = clear() ? nightFactor() : 0;
      level += Phaser.Math.Clamp(target - level, -0.02, 0.02);
      breath = 0.7 + 0.3 * Math.sin(t / 1300);
      // the particles live in the emitter's space, so moving it swings the
      // whole curtain at once, strands already lit included
      strands.x = AURORA_SWAY * Math.sin(t / 1100);
      if (level < 0.05) return;
      for (let tries = 0; tries < 4; tries++) {
        // past both edges, so the swing never bares a strip of sky
        const x = Phaser.Math.Between(-AURORA_SWAY - 12, GAME_WIDTH + AURORA_SWAY + 12);
        if (Math.random() > 0.25 + 0.75 * fold(x, t)) continue;
        strands.emitParticleAt(x, wave(x, t) + Phaser.Math.Between(-3, 3), 1);
        return;
      }
    },
  });
}
