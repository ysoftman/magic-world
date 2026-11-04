import Phaser from "phaser";
import * as bird from "pixelfx/fx/critters/bird";
import * as butterfly from "pixelfx/fx/critters/butterfly";
import * as frog from "pixelfx/fx/critters/frog";
import * as wisp from "pixelfx/fx/critters/wisp";
import { bakePixelSheet, type PixelSheet, sheetInfo, spanOf } from "../fx";
import { nightFactor } from "../gameState";
import { T_GRASS, T_WATER_A, T_WATER_B, TILE } from "../levels";
import { ART_PX } from "../pixelart";
import { seasonToday } from "../season";
import { isWet, weatherToday } from "../weather";
import { AMBIENT_DEPTH, GLOW_DEPTH, seasonal } from "./Ambient";
import type { Rect } from "./Villagers";

// The field's critters: butterflies, a passing bird, a frog by the water and
// will-o'-the-wisps, all pixelfx critters (github:patch-gg/pixelfx, MIT) baked
// into looping sheets like the battle's effects (fx.ts). Only to look at: no
// body, no talk, no fight. One pixelfx pixel to an art cell at ART_PX, the
// hero's own 2px cell, so a butterfly is drawn as finely as the hero it
// passes.

export type CritterRegion = "town" | "forest" | "abyss";

// a sheet, and how long each of its frames shows: by default the effect's own
// pace, its span over its frames
type CritterSheet = PixelSheet & { frameMs?: number };

// Half the effects' 30fps: 15 is as smooth as the battle sheets play
// (AGENTS.md), and the textures and the title's bake half as long.
const fps15 = (fx: PixelSheet["fx"]): number => Math.round(fx.meta.duration * 15);

export const CRITTER_SHEETS = {
  // the iridescent blue one, and an amber one beside it
  "critter-butterfly-a": { fx: butterfly, frames: fps15(butterfly) },
  "critter-butterfly-b": {
    fx: butterfly,
    opts: { palette: ["#1f0b04", "#4a1c08", "#8a3a10", "#d0701c", "#f5a83a", "#ffd88a", "#ffffff"], seed: 2 },
    frames: fps15(butterfly),
  },
  // drawn facing right, mirrored to fly left
  "critter-bird": { fx: bird, frames: fps15(bird) },
  // its anchor is its feet, on the tile it sits on
  "critter-frog": { fx: frog, frames: fps15(frog) },
  "critter-wisp": { fx: wisp, frames: fps15(wisp) },
  // the ABYSS's, violet like its glow
  "critter-wisp-abyss": {
    fx: wisp,
    opts: { palette: ["#140a24", "#2a1048", "#4a1a7a", "#7a2ab0", "#a855f7", "#d8b4fe", "#ffffff"] },
    frames: fps15(wisp),
  },
} satisfies Record<string, CritterSheet>;

type CritterKey = keyof typeof CRITTER_SHEETS;
const SHEETS: Record<CritterKey, CritterSheet> = CRITTER_SHEETS;

// Under the NightOverlay (90), so the night darkens it with the ground; over
// the terrain and objects (2..3), the footprints (4) and the treasure glint
// (4.5); under the step puffs (6), the signs (9) and the hero (10), who walks
// over it.
const FROG_DEPTH = 5;
// the frog's box round its anchor, in pixelfx pixels: the grid it draws in
// (critters/frog), its leap and the fly it snaps included
const FROG_BOX = { x0: -22, y0: -40, x1: 22, y1: 4 };
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
}

const frameMsOf = (sheet: CritterSheet): number => {
  const { from, to, frames } = spanOf(sheet);
  return sheet.frameMs ?? ((to - from) * 1000) / frames;
};

// The sheet, baked here if the title has not got to it yet (warmBattleFx),
// and its looping animation (the game's, like the texture, so made once).
function ready(scene: Phaser.Scene, key: CritterKey): void {
  const sheet = SHEETS[key];
  if (!scene.textures.exists(key)) bakePixelSheet(scene, key, sheet);
  if (scene.anims.exists(key)) return;
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

  // butterflies on a dry spring or summer day, wisps in the forest's night
  // and always in the ABYSS; each fades toward `show()`
  const flocks: Array<{ drifters: Drifter[]; show: () => number }> = [];
  if (season?.butterflies) {
    ready(scene, "critter-butterfly-a");
    ready(scene, "critter-butterfly-b");
    const kinds: CritterKey[] = ["critter-butterfly-a", "critter-butterfly-b"];
    const drifters = Array.from({ length: Phaser.Math.Between(2, 3) }, (_, i) =>
      drifter(scene, kinds[i % 2], AMBIENT_DEPTH, Phaser.Math.FloatBetween(14, 26)),
    );
    flocks.push({ drifters, show: () => (1 - nightFactor()) * dry() });
  }
  if (region !== "town") {
    const key: CritterKey = region === "abyss" ? "critter-wisp-abyss" : "critter-wisp";
    ready(scene, key);
    const drifters = Array.from({ length: Phaser.Math.Between(1, 2) }, () =>
      drifter(scene, key, GLOW_DEPTH, Phaser.Math.FloatBetween(8, 16)),
    );
    // lights, like the fireflies: added over the night, not dimmed by it
    for (const d of drifters) d.sprite.setBlendMode(Phaser.BlendModes.ADD);
    flocks.push({ drifters, show: region === "abyss" ? () => 1 : nightFactor });
  }

  if (season) {
    ready(scene, "critter-bird");
    const next = (): void => {
      scene.time.delayedCall(Phaser.Math.Between(...BIRD_MS), () => {
        if (Math.random() < season.birds * (1 - nightFactor()) * dry()) flyBy(scene);
        next();
      });
    };
    next();
  }

  if (lowland && level && seasonToday() !== "winter") {
    ready(scene, "critter-frog");
    // on the lower half of its tile, so it sits on the tile rather than over the one above
    for (const [tx, ty] of frogSpots(level, avoid, labels))
      critter(scene, "critter-frog", (tx + 0.5) * TILE, (ty + 0.75) * TILE, FROG_DEPTH);
  }

  if (!flocks.length) return;
  const cam = scene.cameras.main;
  let placed = false;
  const onUpdate = (time: number, delta: number): void => {
    const view = cam.worldView;
    // the view is first set as the camera renders: until then, nowhere to put them
    if (view.width === 0) return;
    // a tab back from the background hands over seconds at once
    const dt = Math.min(delta, 100) / 1000;
    for (const { drifters, show } of flocks) {
      const alpha = show();
      for (const d of drifters) {
        // already out when the scene opens, anywhere in view
        if (!placed) d.sprite.setPosition(view.x + view.width * Math.random(), view.y + view.height * Math.random()).setAlpha(alpha);
        else d.sprite.setAlpha(d.sprite.alpha + Phaser.Math.Clamp(alpha - d.sprite.alpha, -FADE * dt, FADE * dt));
        wander(d, view, time, dt);
      }
    }
    placed = true;
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate));
}

function drifter(scene: Phaser.Scene, key: CritterKey, depth: number, speed: number): Drifter {
  return {
    // unseen until the first frame puts it in view
    sprite: critter(scene, key, 0, 0, depth).setAlpha(0),
    heading: Math.random() * Math.PI * 2,
    speed,
    phase: Math.random() * 100,
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
  const box = (tx: number, ty: number): Rect => ({
    x: (tx + 0.5) * TILE + FROG_BOX.x0 * ART_PX,
    y: (ty + 0.75) * TILE + FROG_BOX.y0 * ART_PX,
    w: (FROG_BOX.x1 - FROG_BOX.x0) * ART_PX,
    h: (FROG_BOX.y1 - FROG_BOX.y0) * ART_PX,
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
