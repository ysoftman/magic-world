import Phaser from "phaser";
import * as bird from "pixelfx/fx/critters/bird";
import * as butterfly from "pixelfx/fx/critters/butterfly";
import * as frog from "pixelfx/fx/critters/frog";
import * as wisp from "pixelfx/fx/critters/wisp";
import { type PixelSheet, sheetInfo, spanOf, warmSheets } from "../fx";
import { nightFactor } from "../gameState";
import { T_GRASS, T_WATER_A, T_WATER_B, TILE } from "../levels";
import { ART_PX } from "../pixelart";
import { seasonToday } from "../season";
import { isWet, weatherToday } from "../weather";
import { AMBIENT_DEPTH, GLOW_DEPTH, seasonal } from "./Ambient";
import type { Rect } from "./Villagers";

// The field's critters: butterflies, a passing bird, a frog by the water and
// the ABYSS's will-o'-the-wisps, all pixelfx critters (github:patch-gg/pixelfx, MIT) baked
// into looping sheets like the battle's effects (fx.ts). Only to look at: no
// body, no talk, no fight. One pixelfx pixel to an art cell at ART_PX, the
// hero's own 2px cell, so a butterfly is drawn as finely as the hero it
// passes.

export type CritterRegion = "town" | "forest" | "abyss";

// a sheet, and how long each of its frames shows: by default the effect's own
// pace, its span over its frames
type CritterSheet = PixelSheet & { frameMs?: number };

type Box = [x0: number, y0: number, x1: number, y1: number];

// a box round an effect's anchor, in its pixels, as the part of its canvas a
// sheet bakes (PixelSheet.crop)
const around = (fx: PixelSheet["fx"], [x0, y0, x1, y1]: Box): Box => {
  const [ax, ay] = fx.meta.origin;
  return [ax + x0, ay + y0, ax + x1, ay + y1];
};

// What a butterfly's loop draws: it wanders 26 cells either way of its anchor,
// the loop's middle, its wings 18 either side of its body, and its dust falls
// to 31 under the anchor.
const BUTTERFLY_BOX: Box = [-45, -26, 45, 32];
// What the frog draws round its anchor, its feet: the dust it lands in, 28
// either side, and the fly it snaps, up to 47 over it. Its sheet's crop, and
// the box frogSpots keeps off the name tags.
const FROG_BOX: Box = [-28, -47, 28, 4];

// Each sheet is one whole loop (the default span, 0..duration, so its last
// frame steps on to its first), cropped to what that loop draws at its frame
// count, and the frame counts fill their texture's rows (2048 / width frames
// a row): 4.1MB for the five, against 10.3MB baking the effects' whole
// canvases at 15fps. The day critters bake with light 0: glow bakes as colour
// with alpha, a haze over bright grass, and at a butterfly's light 0.3 it did
// not show at all while the crop it needed grew from 90x58 to 112x80.
export const CRITTER_SHEETS = {
  // The iridescent blue one, as pixelfx draws it. 44 frames (13.75fps): at 90
  // wide a row holds 22, so 38 (12fps) left six of its two rows' slots empty.
  "critter-butterfly-a": { fx: butterfly, opts: { light: 0 }, frames: 44, crop: around(butterfly, BUTTERFLY_BOX) },
  // An orange one beside it: black-brown veins and rim, white dots on the black
  // wing tips, a pale yellow ring round the hind wings' eyespots (the default
  // gold, 0xffb43c, sank into the orange). Orange, not pink: the town's petals
  // are pink. Seed 2 puts its loop 0.62 of a turn on from the blue one's.
  "critter-butterfly-b": {
    fx: butterfly,
    opts: {
      palette: ["#1c0d05", "#3d1a08", "#7a3510", "#c0561a", "#f28c28", "#ffc35c", "#fff6e0"],
      spots: ["#3a1a08", "#c8641a", "#ffe08a", "#fff6e0"],
      seed: 2,
      light: 0,
    },
    frames: 44,
    crop: around(butterfly, BUTTERFLY_BOX),
  },
  // Drawn facing right, mirrored to fly left round its origin, the middle of
  // its body. The loose feather drifting back from it stays in: cropped off, it
  // vanished at the crop's edge. 15fps for the wingbeats, one row of 36.
  "critter-bird": { fx: bird, opts: { light: 0 }, frames: 36, focus: [-1, -2], crop: around(bird, [-35, -18, 15, 21]) },
  // Its anchor is its feet, on the tile it sits on. The default greens: its
  // dark rim keeps the ring on every grass (5.2% of it lost at most, on the
  // forest's scrub). 36 frames (13.8fps) at the dust's whole width fit one
  // row; 39 (15fps) took two, or a crop that cut the dust off flat.
  "critter-frog": { fx: frog, opts: { light: 0 }, frames: 36, crop: around(frog, FROG_BOX) },
  // The ABYSS's, in its own purples (0x4c1d95, 0x7c3aed) with the top steps
  // held off white: added over its floor, a white top made the head a white
  // lavender and left the halo hardly purple. Its halo (radius 46) goes with
  // the head round a figure-eight 34 cells either way, so any crop cuts it:
  // this one, 60 either side with the light pooled on the floor under it, no
  // harder than the effect's own canvas (alpha 12 at the sides, 15 at the
  // floor, under the edge fade); 53 either side, the pool left off, boxed it
  // at 25 and 33. 120 wide fits 17 a row: 34 frames (10.6fps) fill two, 38
  // (12fps) took a third. None in the forest: the town's NIGHT WISP
  // (monsters.ts) is a foe out only at night, and a wisp among the trees could
  // read as one to go after; the forest's nights have the fireflies.
  "critter-wisp-abyss": {
    fx: wisp,
    opts: { palette: ["#12062a", "#2a0f5c", "#4c1d95", "#7129d1", "#9a63f0", "#c9a6ff", "#f6eeff"], seed: 2 },
    frames: 34,
    focus: [0, -36],
    crop: around(wisp, [-60, -88, 60, 8]),
  },
} satisfies Record<string, CritterSheet>;

type CritterKey = keyof typeof CRITTER_SHEETS;
const SHEETS: Record<CritterKey, CritterSheet> = CRITTER_SHEETS;

// Under the NightOverlay (90), so the night darkens it with the ground; over
// the terrain and objects (2..3), the footprints (4) and the treasure glint
// (4.5); under the step puffs (6), the signs (9) and the hero (10), who walks
// over it.
const FROG_DEPTH = 5;
// at most this many, a few tiles apart so two never sit side by side
const FROGS = 2;
const FROG_GAP = 3 * TILE;
// clear of a talk spot or exit by as much as the villagers keep (Villagers.ts)
const KEEP_CLEAR = 2 * TILE;

// a drifter this far past the view is put back just past its other side
const WANDER_OFF = 160;
// the most a drifter's heading turns, in radians a second
const TURN = 0.8;
// how fast a critter fades in or out, in alpha a second: about 3s
const FADE = 0.35;
// a frog whose sheet came in after the scene opened fades in this long
const FROG_FADE_MS = 1000;
// a bird every BIRD_MS, as likely as the birdsong (Ambient's cue): a third as
// often in winter, never by night or in the rain
const BIRD_MS: [number, number] = [4000, 14000];
const BIRD_SPEED: [number, number] = [200, 280];

interface Drifter {
  sprite: Phaser.GameObjects.Sprite;
  heading: number;
  speed: number;
  // its own phase in the wander, so no two turn in step
  phase: number;
  // put somewhere in view on its first frame; `late` (its sheet baked after
  // the scene opened) fades in from nothing there rather than being out already
  placed: boolean;
  late: boolean;
}

const frameMsOf = (sheet: CritterSheet): number => {
  const { from, to, frames } = spanOf(sheet);
  return sheet.frameMs ?? ((to - from) * 1000) / frames;
};

// A baked sheet's looping animation (the game's, like the texture, so made once).
function animate(scene: Phaser.Scene, key: CritterKey): void {
  if (scene.anims.exists(key)) return;
  const sheet = SHEETS[key];
  const { frames } = sheetInfo(sheet);
  scene.anims.create({
    key,
    frames: Array.from({ length: frames }, (_, frame) => ({ key, frame })),
    frameRate: 1000 / frameMsOf(sheet),
    repeat: -1,
  });
}

// each from its own frame, so two of a kind never beat their wings together
function critter(scene: Phaser.Scene, key: CritterKey, x: number, y: number, depth: number): Phaser.GameObjects.Sprite {
  return scene.add
    .sprite(x, y, key, 0)
    .setOrigin(...sheetInfo(SHEETS[key]).origin)
    .setScale(ART_PX)
    .setDepth(depth)
    .play({ key, randomFrame: true });
}

/**
 * Adds `region`'s critters to `scene`: one call from create(), and it tears
 * itself down on SHUTDOWN (the sprites, tweens and timers go with the scene).
 * The season is read once here, as Ambient reads it; the hour and the weather
 * every frame. The frogs keep to grass on the water's edge in `level`, clear of
 * `avoid` (talk spots, exits, treasure) and of the map's name tags `labels`.
 * A kind whose sheet the title has not baked yet is baked here a few frames at
 * a time (warmSheets) and comes out once it is in: a scene entered straight
 * off the title held its first frame for some 170ms (headless) baking them all.
 */
export function addCritters(
  scene: Phaser.Scene,
  region: CritterRegion,
  {
    level,
    avoid = [],
    labels = [],
  }: { level?: number[][]; avoid?: ReadonlyArray<{ x: number; y: number }>; labels?: readonly Rect[] } = {},
): void {
  const lowland = region !== "abyss";
  const season = lowland ? seasonal() : undefined;
  const dry = (): number => (region !== "abyss" && isWet(weatherToday(region)) ? 0 : 1);
  // while this call runs: a sheet in already puts its kind out from the start
  let entering = true;

  // butterflies on a dry spring or summer day, wisps always in the ABYSS;
  // each fades toward `show()`
  const flocks: Array<{ drifters: Drifter[]; show: () => number }> = [];
  const flock = (show: () => number): Drifter[] => {
    const drifters: Drifter[] = [];
    flocks.push({ drifters, show });
    return drifters;
  };
  // each kind this visit has, and what puts it out once its sheet is in, in
  // the order warmSheets bakes them: the cheap frog first, the costly
  // butterflies after it
  const kinds: Partial<Record<CritterKey, () => void>> = {};

  if (lowland && level && seasonToday() !== "winter") {
    kinds["critter-frog"] = () => {
      // on the lower half of its tile, so it sits on the tile rather than over the one above
      for (const [tx, ty] of frogSpots(level, avoid, labels)) {
        const frog = critter(scene, "critter-frog", (tx + 0.5) * TILE, (ty + 0.75) * TILE, FROG_DEPTH);
        if (!entering) scene.tweens.add({ targets: frog.setAlpha(0), alpha: 1, duration: FROG_FADE_MS });
      }
    };
  }
  if (season?.butterflies) {
    const butterflies = flock(() => (1 - nightFactor()) * dry());
    // One or two in view at once: at ART_PX one is wider than the hero (its
    // wings 37 cells across, 74px), and three read as a swarm. Two are one of
    // each, one is either.
    const count = Phaser.Math.Between(1, 2);
    const blue = count === 2 ? 1 : Phaser.Math.Between(0, 1);
    const out = (key: CritterKey, n: number) => () => {
      for (let i = 0; i < n; i++) butterflies.push(drifter(scene, key, AMBIENT_DEPTH, Phaser.Math.FloatBetween(14, 26), !entering));
    };
    if (blue) kinds["critter-butterfly-a"] = out("critter-butterfly-a", blue);
    if (count > blue) kinds["critter-butterfly-b"] = out("critter-butterfly-b", count - blue);
  }
  if (season) {
    let birds = false;
    kinds["critter-bird"] = () => {
      birds = true;
    };
    const next = (): void => {
      scene.time.delayedCall(Phaser.Math.Between(...BIRD_MS), () => {
        if (birds && Math.random() < season.birds * (1 - nightFactor()) * dry()) flyBy(scene);
        next();
      });
    };
    next();
  }
  if (region === "abyss") {
    const wisps = flock(() => 1);
    kinds["critter-wisp-abyss"] = () => {
      for (let i = Phaser.Math.Between(1, 2); i > 0; i--) {
        const d = drifter(scene, "critter-wisp-abyss", GLOW_DEPTH, Phaser.Math.FloatBetween(8, 16), !entering);
        // lights, like the fireflies: added over the gloom, not dimmed by it
        d.sprite.setBlendMode(Phaser.BlendModes.ADD);
        wisps.push(d);
      }
    };
  }

  const keys = Object.keys(kinds) as CritterKey[];
  warmSheets(scene, Object.fromEntries(keys.map((k) => [k, SHEETS[k]])), (key) => {
    animate(scene, key as CritterKey);
    kinds[key as CritterKey]?.();
  });
  entering = false;

  if (!flocks.length) return;
  const cam = scene.cameras.main;
  const onUpdate = (time: number, delta: number): void => {
    const view = cam.worldView;
    // the view is first set as the camera renders: until then, nowhere to put them
    if (view.width === 0) return;
    // a tab back from the background hands over seconds at once
    const dt = Math.min(delta, 100) / 1000;
    for (const { drifters, show } of flocks) {
      const alpha = show();
      for (const d of drifters) {
        // anywhere in view: out already as the scene opens, or fading in there
        if (!d.placed) {
          d.sprite.setPosition(view.x + view.width * Math.random(), view.y + view.height * Math.random());
          d.sprite.setAlpha(d.late ? 0 : alpha);
          d.placed = true;
        } else d.sprite.setAlpha(d.sprite.alpha + Phaser.Math.Clamp(alpha - d.sprite.alpha, -FADE * dt, FADE * dt));
        wander(d, view, time, dt);
      }
    }
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate));
}

function drifter(scene: Phaser.Scene, key: CritterKey, depth: number, speed: number, late: boolean): Drifter {
  return {
    // unseen until the first frame puts it in view
    sprite: critter(scene, key, 0, 0, depth).setAlpha(0),
    heading: Math.random() * Math.PI * 2,
    speed,
    phase: Math.random() * 100,
    placed: false,
    late,
  };
}

// A slow drift whose heading swings one way and back. One that drifts far
// out of view comes back in just past the other side, headed in, so the
// critters stay round the hero wherever they walk; the sheet's own loop is
// the flutter on top.
function wander(d: Drifter, view: Phaser.Geom.Rectangle, time: number, dt: number): void {
  const s = d.sprite;
  d.heading += Math.sin(time / 2300 + d.phase) * TURN * dt;
  s.x += Math.cos(d.heading) * d.speed * dt;
  s.y += Math.sin(d.heading) * d.speed * dt;
  const hw = s.displayWidth / 2;
  const hh = s.displayHeight / 2;
  const [x, y] = [s.x, s.y];
  if (s.x < view.x - hw - WANDER_OFF) s.x = view.right + hw;
  else if (s.x > view.right + hw + WANDER_OFF) s.x = view.x - hw;
  if (s.y < view.y - hh - WANDER_OFF) s.y = view.bottom + hh;
  else if (s.y > view.bottom + hh + WANDER_OFF) s.y = view.y - hh;
  if (s.x !== x || s.y !== y) d.heading = Math.atan2(view.centerY - s.y, view.centerX - s.x) + Phaser.Math.FloatBetween(-0.6, 0.6);
}

// One bird across the view, from just past one side to just past the other,
// a little aslant, then gone.
function flyBy(scene: Phaser.Scene): void {
  const view = scene.cameras.main.worldView;
  if (view.width === 0) return;
  const left = Math.random() < 0.5;
  const sprite = critter(scene, "critter-bird", 0, 0, AMBIENT_DEPTH);
  // drawn facing right; a negative scaleX turns it round its origin
  if (left) sprite.setScale(-ART_PX, ART_PX);
  const hw = sprite.displayWidth / 2;
  const [x0, x1] = left ? [view.right + hw, view.x - hw] : [view.x - hw, view.right + hw];
  // both ends under the HUD band at the top and over the touch buttons at
  // the bottom: a slant up from high on the view ran in under the HUD
  const [top, bottom] = [view.y + view.height * 0.2, view.y + view.height * 0.65];
  const y0 = Phaser.Math.FloatBetween(top, bottom);
  const rise = Math.abs(x1 - x0) * Phaser.Math.FloatBetween(0.05, 0.2) * (Math.random() < 0.5 ? -1 : 1);
  const y1 = Phaser.Math.Clamp(y0 + rise, top, bottom);
  sprite.setPosition(x0, y0);
  scene.tweens.add({
    targets: sprite,
    x: x1,
    y: y1,
    duration: (Math.hypot(x1 - x0, y1 - y0) / Phaser.Math.Between(...BIRD_SPEED)) * 1000,
    onComplete: () => sprite.destroy(),
  });
}

// Up to FROGS grass tiles beside the water, the same ones every visit to the
// same map: walkable, off the map's edge rows (the top one is under the HUD),
// KEEP_CLEAR of every `avoid` point, the frog's box over no name tag.
function frogSpots(level: number[][], avoid: ReadonlyArray<{ x: number; y: number }>, labels: readonly Rect[]): Array<[number, number]> {
  const water = (tx: number, ty: number): boolean => level[ty]?.[tx] === T_WATER_A || level[ty]?.[tx] === T_WATER_B;
  const [x0, y0, x1, y1] = FROG_BOX;
  const box = (tx: number, ty: number): Rect => ({
    x: (tx + 0.5) * TILE + x0 * ART_PX,
    y: (ty + 0.75) * TILE + y0 * ART_PX,
    w: (x1 - x0) * ART_PX,
    h: (y1 - y0) * ART_PX,
  });
  const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const spots: Array<[number, number]> = [];
  for (let ty = 1; ty < level.length - 1; ty++)
    for (let tx = 1; tx < level[ty].length - 1; tx++) {
      if (level[ty][tx] !== T_GRASS) continue;
      if (!water(tx - 1, ty) && !water(tx + 1, ty) && !water(tx, ty - 1) && !water(tx, ty + 1)) continue;
      const cx = (tx + 0.5) * TILE;
      const cy = (ty + 0.5) * TILE;
      if (avoid.some((p) => Math.hypot(p.x - cx, p.y - cy) < KEEP_CLEAR)) continue;
      const b = box(tx, ty);
      if (labels.some((r) => overlaps(b, r))) continue;
      spots.push([tx, ty]);
    }
  // a fixed shuffle (the tile's own hash), so the pick is the same each visit
  const hash = ([tx, ty]: [number, number]): number => (Math.imul(tx * 73 + ty * 151, 0x9e3779b1) >>> 0) % 1009;
  spots.sort((a, b) => hash(a) - hash(b));
  const picked: Array<[number, number]> = [];
  for (const s of spots) {
    if (picked.length === FROGS) break;
    if (picked.every(([tx, ty]) => Math.hypot(tx - s[0], ty - s[1]) * TILE >= FROG_GAP)) picked.push(s);
  }
  return picked;
}
