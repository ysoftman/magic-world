import Phaser from "phaser";
import * as pixelfx from "pixelfx";
import { clearFrame, createFx, type Fx, type FxFrame, type FxMeta } from "pixelfx";
import * as fireworkBurst from "pixelfx/fx/explosions/firework-burst";
import * as weatherLib from "pixelfx/fx/weather/_lib";
import * as auroraFx from "pixelfx/fx/weather/aurora";
import * as shootingStars from "pixelfx/fx/weather/shooting-stars";
import { Sfx } from "../audio";
import { GAME_WIDTH } from "../config";
import { eventToday } from "../events";
import { GameState, hour, nightFactor } from "../gameState";
import { ART_PX } from "../pixelart";
import { isWet, type Region, weatherToday } from "../weather";
import { addLightCanvas } from "./lightCanvas";
import { STATUS_HUD_HEIGHT } from "./StatusHud";

// pixelfx's painter and the helpers the shooting star and the aurora are
// drawn with, beyond what env.d.ts types (fx.ts only bakes through createFx)
interface Painter {
  C: Uint32Array;
  lightK: number;
  place(x: number, y: number, flip?: boolean, angle?: number): Painter;
  put(sx: number, sy: number, c: number, a?: number): void;
  add(sx: number, sy: number, c: number, k?: number): void;
  blendPx(sx: number, sy: number, c: number, a: number): void;
  px(x: number, y: number, c: number): void;
  dot(x: number, y: number, c: number, a?: number): void;
  line(x0: number, y0: number, x1: number, y1: number, c: number, a?: number): void;
  glow(x: number, y: number, r: number, c: number, k?: number): void;
}
const { painterFor, resolveOptions, fit, at, rand, sparkle, WHITE } = pixelfx as unknown as {
  painterFor(frame: FxFrame): Painter;
  resolveOptions(meta: FxMeta, o?: Record<string, unknown>): Record<string, unknown>;
  fit(ramp: unknown[], n: number): number[];
  at(ramp: number[], t: number): number;
  rand(...ns: number[]): number;
  sparkle(p: Painter, x: number, y: number, arm: number, c: number, tip?: number, k?: number): void;
  WHITE: number;
};
const aurora = auroraFx as unknown as { meta: FxMeta; draw(p: Painter, t: number, o: Record<string, unknown>): void };
const { field } = weatherLib as unknown as { field: (seed: number, w: number, h: number, cells?: number[]) => unknown };

// Over the night shade (90), its lights (90.4) and Ambient's fireflies and
// embers (90.5), under the guide arrow (91), the area title (95), the
// minimap (96), the HUD (110), the panels (150) and the toasts (200).
const SKY_DEPTH = 90.6;
// The sky is the top of the screen, under the HUD: fireworks burst, stars fall
// and the aurora hangs between here and SKY_BOTTOM.
const SKY_TOP = STATUS_HUD_HEIGHT + 24;
const SKY_BOTTOM = 300;
// The glow of a firework or a shooting star's flare at this strength with the
// FLASHES setting off or under prefers-reduced-motion: a burst lights a patch
// of sky 220px round (its light at 0.6, for 1.5s), a flare one 80px round,
// and the sparks and stars alone are no flash. Read at each burst or fall, so
// flipping FLASHES takes effect from the next.
const SOFT_LIGHT = 0.35;
const skyLight = (reducedMotion: boolean): number => (reducedMotion || !GameState.flashes ? SOFT_LIGHT : 1);

// Festival fireworks: a town event's night (events.ts), 20:00..23:00, one
// shell every 1.8-4.5s while it isn't raining. Each is pixelfx's firework
// burst (MIT; its notice is the /*! line in fx.ts): the shell climbs, bursts
// into trailing stars round a gold core, they droop and crackle out in white
// pops. Its shell colour (the middle of its ramp, shellRamp) and its seed are
// its own, so no two bursts look alike.
const FIREWORK_HOURS = [20, 23];
const FIREWORK_COLORS = [0xf53cd1, 0x33c4f2, 0x62d93a, 0x9b5cf6, 0xf2483a];
// One of its pixels to an art cell (ART_PX), the critters' 2px: a burst some
// 190 cells across is 380px, about the old sparks' spread, where 4px made it
// 760. Drawn live into one canvas over the sky (lightCanvas.ts) rather than
// baked: its 3s at 15fps were 45 frames of 170KB, a sheet a colour. The rows
// reach the deepest a star droops (138 cells under the lowest burst, 536px).
const FIREWORK_ROWS = 280;
// redrawn this often; a redraw (~1ms for three bursts, headless) and its
// upload go on two frames
const FIREWORK_STEP_MS = 1000 / 20;
// a burst is over (its last pop out) this long after its launch, and bursts
// this long after it (the effect's own RISE)
const FIREWORK_LIFE_S = 3.1;
const FIREWORK_RISE_MS = 420;
// While the fireworks are on, the sky behind them darkens a little: the
// night's navy, deepest under the HUD and gone by FIREWORK_VEIL_H below it,
// eased in and out over ~2.5s. The snowed-in winter town is pale even at
// night, and additive sparks barely showed on it. Down to y 448: a burst's
// stars droop to 536px, and over a veil that stopped at 320 their white pops
// sank into the snow.
const FIREWORK_VEIL = 0.45;
const FIREWORK_VEIL_H = 360;

// A shooting star now and then on a clear night, one every 40-110s: one of
// pixelfx's (weather/shooting-stars, MIT; its notice is the /*! line in
// fx.ts). A white head brightens, holds and burns out ahead of a trail that
// cools from gold to rose; the big ones flare and break up into sparkles and
// fragments; the whole path it burned lingers as a train that twists, drifts
// and fades. That effect is a whole starry sky with seven of them in a 10s
// loop and only draws the lot, so drawMeteor is its meteor() on its own, with
// the effect's shapes (METEORS) and palette. Its stars and milky band are left
// out: on the field they would be specks on the ground.
const METEOR_GAP_MS = [40000, 110000];
// One of its pixels to an art cell (ART_PX), as the fireworks: a star runs
// 240-504px, about the hand-drawn streak's 260 (at 4px the big one's 1000px
// would cross the screen). Drawn live into a canvas 640x480 under the HUD,
// put somewhere along the sky at each fall. The big flaring star reaches 223
// cells left of where it lit; its fragments carry on to 262 below it, but
// past the canvas's last row (it lights 6-20 rows down) they are under a
// third of their light, near gone.
const METEOR_COLS = 320;
const METEOR_ROWS = 240;
// redrawn this often, a redraw (0.1-0.5ms, headless) and its upload on two
// frames, as the fireworks; the upload's frame counts towards the next, so
// the star burns at its own speed
const METEOR_STEP_MS = 1000 / 20;
// how long the train lingers after the head burns out (the effect's TRAIN)
const METEOR_TRAIN_S = 1.6;
// pixelfx's seven: heading (radians from +x, y down: down and to the left),
// speed (cells/s), how long the head burns (s), size, and the two that flare
interface Meteor {
  a: number;
  v: number;
  life: number;
  s: number;
  flare?: boolean;
}
const METEORS: Meteor[] = [
  { a: 2.45, v: 260, life: 0.55, s: 0.6 },
  { a: 2.2, v: 220, life: 0.7, s: 0.8 },
  { a: 2.62, v: 300, life: 0.45, s: 0.5 },
  { a: 2.35, v: 240, life: 1.05, s: 1.4, flare: true },
  { a: 2.05, v: 200, life: 0.6, s: 0.7 },
  { a: 2.5, v: 280, life: 0.5, s: 0.6 },
  { a: 2.28, v: 230, life: 0.8, s: 1, flare: true },
];
const meteorEnd = (m: Meteor): number => m.life + (m.flare ? 0.5 : 0) + METEOR_TRAIN_S;

// The snow field's aurora on a clear night: pixelfx's (weather/aurora, MIT;
// its notice is the /*! line in fx.ts) rippling curtains, their folding hems
// burning bright and their rays shimmering up into violet, the whole sky
// slowly breathing. That loop is a night sky 320x180 with three curtains over
// a starfield; the field has no sky, only the top of the screen under the
// HUD, so it shows a band of it: rows AURORA_ROWS (the back curtain's hem and
// the front one's where it hangs highest), one of its pixels to an art cell
// (ART_PX). That is 640px across, so the screen holds two of it: the left
// half as it is, the right half mirrored and AURORA_OFFSET_S further on in the
// loop, the two meeting on the middle with the effect's right edge, both
// fading out over AURORA_SEAM columns there, a gap between two curtains. At
// 4px one spanned the screen, but its hems hung 230-330px down, over the
// hero, and cut to the top 160px it was only the rays' violet haze; the same
// loop mirrored set every bright ray opposite its twin (465 and 815px).
const AURORA_ROWS = [-150, -80];
const AURORA_OFFSET_S = 5.3;
const AURORA_SEAM = 28;
// rows faded in at the band's top and out at its bottom, so neither is a line
const AURORA_FADE = 10;
const AURORA_PEAK = 0.7;
// a half redrawn this often, the halves in turn (2-3ms to draw one in
// headless Chrome, then the upload on the next frame), so each moves at
// 10fps; not at all while it is out (day, cloud, snow)
const AURORA_STEP_MS = 1000 / 20;
// up with the dark over this long, and down as fast when it clouds over
const AURORA_EASE_MS = 3500;
// The aurora samples a noise field it bakes on its first frame and keeps
// (pixelfx weather/_lib field(): seed x5 + 1, 256x128, octaves 8..32), 23ms
// that can't be split, so it is baked on a frame that has done no more than
// this by its POST_UPDATE, counted from the game's step (a scene steps in the
// frame it is made, and the bake on top of the snow field's create made a
// 31ms frame), once the night and the sky call for it; the aurora waits.
const AURORA_FIELD_CELLS = [8, 16, 32];
const QUIET_MS = 3;

function bake(scene: Phaser.Scene): void {
  if (scene.textures.exists("sky-veil")) return;
  // the fireworks' veil: the night's navy in 8px steps, opaque at the top
  // (the image's alpha scales it) and clear at the bottom
  const g = scene.add.graphics();
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
 * visual. One canvas or image per effect, so a scene gains at most three
 * display objects. Called from addAmbient; tears down with the scene.
 */
export function addNightSky(scene: Phaser.Scene, region: Region): void {
  if (region !== "town" && region !== "forest" && region !== "snow") return;
  const clear = (): boolean => weatherToday(region) === "clear";
  if (region === "town") {
    bake(scene);
    addFireworks(scene);
  }
  addMeteors(scene, clear);
  if (region === "snow") addAurora(scene, clear);
}

const fixed = <T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(
  o: T,
): T => o.setScrollFactor(0).setDepth(SKY_DEPTH);

// A shell colour's 7 steps, dark to white, as pixelfx's own pink ramp has
// them round 0xf53cd1: a quarter, 0.45 and 0.7 of it, it, then 35%, 70% and
// all the way to white.
function shellRamp(c: number): string[] {
  const rgb = [c >> 16, (c >> 8) & 255, c & 255];
  return [0.25, 0.45, 0.7, 1, 1.35, 1.7, 2].map(
    (k) =>
      `#${rgb
        .map((v) =>
          Math.round(k <= 1 ? v * k : v + (255 - v) * (k - 1))
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")}`,
  );
}

function addFireworks(scene: Phaser.Scene): void {
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // made with the night's first shell: most visits see none
  let sky: ReturnType<typeof addLightCanvas> | undefined;
  const bursts: Array<{ fx: Fx; age: number }> = [];
  let wait = 0;
  let drawn = false;
  const step = (_time: number, delta: number): void => {
    if (!sky) return;
    if (drawn) {
      drawn = false;
      sky.upload();
      sky.image.setVisible(bursts.length > 0);
      return;
    }
    if (!bursts.length) return;
    wait += delta;
    if (wait < FIREWORK_STEP_MS) return;
    // a tab back from the background hands over seconds at once
    const dt = Math.min(wait, 100) / 1000;
    wait = 0;
    for (const b of bursts) {
      b.fx.update(dt);
      b.age += dt;
    }
    for (let i = bursts.length - 1; i >= 0; i--) if (bursts[i].age >= FIREWORK_LIFE_S) bursts.splice(i, 1);
    clearFrame(sky.frame);
    for (const b of bursts) b.fx.draw(sky.frame);
    drawn = true;
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, step);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, step));

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

  // a shell bursting at (x, y) on screen, climbing to it from 144px below
  const launch = (): void => {
    sky ??= addLightCanvas(scene, "sky-fireworks", { cols: GAME_WIDTH / ART_PX, rows: FIREWORK_ROWS, cell: ART_PX, depth: SKY_DEPTH });
    const x = Phaser.Math.Between(140, GAME_WIDTH - 140);
    const y = Phaser.Math.Between(SKY_TOP + 20, SKY_BOTTOM - 40);
    const fx = createFx(fireworkBurst, {
      x: x / ART_PX,
      y: y / ART_PX,
      palette: shellRamp(Phaser.Utils.Array.GetRandom(FIREWORK_COLORS)),
      seed: Phaser.Math.Between(1, 9999),
      light: skyLight(reducedMotion),
    });
    bursts.push({ fx, age: 0 });
    scene.time.delayedCall(FIREWORK_RISE_MS, () => Sfx.ambience("pop", Phaser.Math.FloatBetween(0.7, 1)));
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
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const palette = fit(shootingStars.meta.options?.palette as string[], 6);
  // made with the first star: most visits see none
  let sky: ReturnType<typeof addLightCanvas> | undefined;
  let star: { m: Meteor; age: number; x: number; y: number; flip: boolean; seed: number; light: number } | undefined;
  let wait = 0;
  let drawn = false;
  const step = (_time: number, delta: number): void => {
    if (!sky) return;
    wait += delta;
    if (drawn) {
      drawn = false;
      sky.upload();
      sky.image.setVisible(!!star);
      return;
    }
    if (!star) return;
    if (wait < METEOR_STEP_MS) return;
    // a tab back from the background hands over seconds at once
    star.age += Math.min(wait, 100) / 1000;
    wait = 0;
    clearFrame(sky.frame);
    if (star.age >= meteorEnd(star.m)) star = undefined;
    else {
      const p = painterFor(sky.frame).place(star.x, star.y, star.flip);
      p.lightK = star.light;
      drawMeteor(p, star.age, star.m, star.seed, palette);
    }
    drawn = true;
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, step);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, step));

  const fall = (): void => {
    sky ??= addLightCanvas(scene, "sky-meteor", { cols: METEOR_COLS, rows: METEOR_ROWS, cell: ART_PX, depth: SKY_DEPTH });
    // anywhere along the sky; down and to the left (the effect's way) from
    // near the canvas's right edge, or mirrored, to the right from its left
    sky.image.setPosition(Phaser.Math.Between(0, GAME_WIDTH - METEOR_COLS * ART_PX), STATUS_HUD_HEIGHT);
    const flip = Math.random() < 0.5;
    const x = Phaser.Math.Between(228, 306);
    star = {
      m: Phaser.Utils.Array.GetRandom(METEORS),
      age: 0,
      x: flip ? METEOR_COLS - x : x,
      y: Phaser.Math.Between(6, 20),
      flip,
      seed: Phaser.Math.Between(1, 9999),
      light: skyLight(reducedMotion),
    };
    wait = METEOR_STEP_MS;
  };
  const schedule = (): void => {
    scene.time.delayedCall(Phaser.Math.Between(METEOR_GAP_MS[0], METEOR_GAP_MS[1]), () => {
      if (!star && clear() && nightFactor() > 0.8) fall();
      schedule();
    });
  };
  schedule();
}

// pixelfx weather/shooting-stars' meteor(), one star `age` seconds after it
// lit, from its own origin (0, 0): a head that brightens and burns out, a
// trail cooling down the ramp behind it, a flare and fragments for the big
// ones, and the train it leaves glowing and twisting as it fades. `C` is the
// effect's palette (6 steps, dark to white); `seed` scatters the flare's bits.
function drawMeteor(q: Painter, age: number, m: Meteor, seed: number, C: number[]): void {
  const ca = Math.cos(m.a);
  const sa = Math.sin(m.a);
  const pos = (tt: number): [number, number] => [ca * m.v * tt, sa * m.v * tt];
  const burn = Math.min(age, m.life);
  const [hx, hy] = pos(burn);
  // the train: the whole path it has burned, lingering, widening, drifting and twisting
  const trainK = age < m.life ? 1 : 1 - (age - m.life) / (METEOR_TRAIN_S + (m.flare ? 0.5 : 0));
  if (trainK > 0) {
    const len = m.v * burn;
    for (let d = 0; d < len; d += 1) {
      const passed = age - d / m.v;
      if (passed < 0.08) continue;
      const g = trainK * Math.min(1, (passed - 0.08) * 4) * (0.35 + 0.65 * Math.sin((Math.PI * d) / len)) * m.s;
      const tw = Math.sin(d * 0.09 + passed * 1.7) * Math.min(4, passed * 3);
      const x = ca * d - sa * tw + passed * 4;
      const y = sa * d + ca * tw;
      q.dot(x, y, passed < 0.6 ? C[2] : C[1], g * 0.75);
      if (d % 6 === 0) q.glow(x, y, 6 + passed * 4, C[1], 0.12 * g);
    }
  }
  if (age > m.life + (m.flare ? 0.5 : 0)) return;
  // the head brightens fast, holds, and burns out; the big ones flare as they go
  const u = age / m.life;
  const k = age < m.life ? Math.min(1, u * 6) * (u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1) : 0;
  if (k > 0) {
    const L = (24 + 40 * m.s) * Math.min(1, u * 3);
    const cooling = C.slice(1).reverse();
    for (let d = 0; d <= L; d += 0.5) {
      const v = d / L;
      const x = hx - ca * d;
      const y = hy - sa * d;
      q.dot(x, y, v < 0.08 ? WHITE : at(cooling, v * 0.95), k * (v < 0.6 ? 1 : (1 - v) / 0.4));
      if (m.s > 0.9 && v < 0.4) q.dot(x - sa * 0.9, y + ca * 0.9, v < 0.15 ? C[4] : C[3], k * (1 - v / 0.4));
    }
    q.px(hx, hy, WHITE);
    if (m.s > 0.9) {
      q.px(hx + 1, hy, WHITE);
      q.px(hx, hy + 1, C[4]);
    }
    q.glow(hx, hy, 8 + 10 * m.s, C[4], 0.45 * k);
    q.glow(hx - ca * L * 0.3, hy - sa * L * 0.3, 10 + 8 * m.s, C[3], 0.2 * k);
  }
  if (!m.flare || age < m.life * 0.82) return;
  // the flare: a burst of light and rays, fragments carrying on and fading
  const f = (age - m.life * 0.82) / (m.life * 0.18 + 0.5);
  const [fx, fy] = pos(m.life * 0.86);
  if (f < 0.35) {
    sparkle(q, fx, fy, 9 * Math.sin((Math.PI * f) / 0.35) + 2, C[4], C[3], 0.6);
    q.glow(fx, fy, 40, C[3], 0.5 * (1 - f / 0.35));
  }
  // little stars scattered round the burst, each twinkling once and gone
  for (let j = 0; j < 7; j++) {
    const ang = rand(seed, j, 5) * Math.PI * 2;
    const r = 5 + rand(seed, j, 6) * 16;
    const g = (f - rand(seed, j, 7) * 0.3) / 0.45;
    if (g <= 0 || g >= 1) continue;
    const sx = fx + Math.cos(ang) * r * (0.6 + g * 0.5);
    const sy = fy + Math.sin(ang) * r * (0.6 + g * 0.5) - g * 3;
    const arm = Math.round(2.5 * Math.sin(Math.PI * g));
    if (arm >= 1) sparkle(q, sx, sy, arm, j % 3 ? C[4] : WHITE, C[3], 0.3 * (1 - g));
    else q.px(sx, sy, C[4]);
  }
  for (let j = 0; j < 4; j++) {
    const g = 1 - f;
    if (g <= 0) continue;
    const da = m.a + (rand(seed, j, 1) - 0.5) * 0.5;
    const run = m.v * (0.5 + rand(seed, j, 2) * 0.4) * f * (m.life * 0.18 + 0.5);
    const x = fx + Math.cos(da) * run;
    const y = fy + Math.sin(da) * run;
    q.line(x - Math.cos(da) * 5 * g, y - Math.sin(da) * 5 * g, x, y, C[3], g);
    q.px(x, y, g > 0.5 ? WHITE : C[4]);
    q.glow(x, y, 5, C[3], 0.35 * g);
  }
}

// The aurora's painter with its starfield dropped: the effect draws its stars
// first, through the painter's writes, and only then reads the frame's colour
// buffer (C) for its shading pass (pixelfx weather/_lib's rows()), so every
// write before that first read is a star, and is left out. That order is
// pixelfx's aurora.js: after updating pixelfx, check the snow field's aurora
// still shows no stars.
function starless(p: Painter): { painter: Painter; reset: () => void } {
  let sky = false;
  const painter = Object.create(p, {
    C: {
      get: () => {
        sky = true;
        return p.C;
      },
    },
    // writable, as the effect's clip() shadows them on its own painter
    put: { writable: true, value: (sx: number, sy: number, c: number, a?: number) => sky && p.put(sx, sy, c, a) },
    add: { writable: true, value: (sx: number, sy: number, c: number, k?: number) => sky && p.add(sx, sy, c, k) },
    blendPx: { writable: true, value: (sx: number, sy: number, c: number, a: number) => sky && p.blendPx(sx, sy, c, a) },
  }) as Painter;
  return {
    painter,
    reset: () => {
      sky = false;
    },
  };
}

function addAurora(scene: Phaser.Scene, clear: () => boolean): void {
  const half = aurora.meta.size[0];
  const [cols, rows] = [half * 2, AURORA_ROWS[1] - AURORA_ROWS[0]];
  const { frame, image, upload } = addLightCanvas(scene, "sky-aurora", { cols, rows, cell: ART_PX, depth: SKY_DEPTH, oy: AURORA_ROWS[0] });
  image.setPosition(0, STATUS_HUD_HEIGHT);
  const opts = resolveOptions(aurora.meta);
  const base = painterFor(frame);
  const { painter, reset } = starless(base);
  const fade = (y: number): number => Math.min(1, (y + 0.5) / AURORA_FADE, (rows - y - 0.5) / AURORA_FADE);
  const seam = Float32Array.from({ length: cols }, (_, x) => Math.min(1, ((x < half ? half - 1 - x : x - half) + 0.5) / AURORA_SEAM));
  // one half: the effect's origin on its middle, the right one mirrored
  const drawHalf = (right: boolean, at: number): void => {
    for (let y = 0; y < rows; y++) {
      const from = y * cols + (right ? half : 0);
      frame.color.fill(0, from, from + half);
      frame.light.fill(0, from, from + half);
    }
    base.place(right ? half * 1.5 : half / 2, 0, right);
    reset();
    aurora.draw(painter, at % aurora.meta.duration, opts);
  };
  const wanted = (): number => (clear() ? nightFactor() : 0);

  let baked = false;
  let frameStart = 0;
  const mark = (): void => {
    frameStart = performance.now();
  };
  const bakeField = (): void => {
    if (wanted() <= 0 || performance.now() - frameStart > QUIET_MS) return;
    field(Number(opts.seed) * 5 + 1, 256, 128, AURORA_FIELD_CELLS);
    baked = true;
    scene.game.events.off(Phaser.Core.Events.PRE_STEP, mark);
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, bakeField);
  };

  // where in its loop it starts: anywhere, so no two nights open alike
  let t = Math.random() * aurora.meta.duration;
  let level = 0;
  let wait = AURORA_STEP_MS;
  let drawn = false;
  let right = false;
  const step = (_time: number, delta: number): void => {
    // up with the dark and gone in daylight, eased so a clear night that
    // clouds over at midnight fades rather than snaps
    const ease = delta / AURORA_EASE_MS;
    level = Phaser.Math.Clamp(level + Phaser.Math.Clamp(wanted() - level, -ease, ease), 0, 1);
    const shown = baked && level > 0.01;
    image.setVisible(shown).setAlpha(AURORA_PEAK * level);
    if (!shown) return;
    wait += delta;
    if (drawn) {
      drawn = false;
      upload(fade, seam);
      return;
    }
    if (wait < AURORA_STEP_MS) return;
    // a tab back from the background hands over seconds at once
    t = (t + Math.min(wait, 250) / 1000) % aurora.meta.duration;
    wait = 0;
    drawHalf(right, right ? t + AURORA_OFFSET_S : t);
    right = !right;
    drawn = true;
  };
  scene.game.events.on(Phaser.Core.Events.PRE_STEP, mark);
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, bakeField);
  scene.events.on(Phaser.Scenes.Events.UPDATE, step);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.game.events.off(Phaser.Core.Events.PRE_STEP, mark);
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, bakeField);
    scene.events.off(Phaser.Scenes.Events.UPDATE, step);
  });
}
