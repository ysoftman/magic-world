import Phaser from "phaser";
import { T_ASH, T_GRASS, T_PATH, T_SCORCH, T_TALL, TILE } from "../levels";
import { seasonLook } from "../season";
import { type Region, weatherToday } from "../weather";
import { bakeSheet, SHEET } from "./Ambient";

// On the ground with the hero's own shadow (addGroundShadow, depth 5): a print
// just under it, a puff just over it, both under every actor (9-11).
const PRINT_DEPTH = 4;
const PUFF_DEPTH = 6;
// the feet: where the scenes hang the hero's shadow
const FEET_DY = 28;
// left and right foot either side of the line of travel
const STRIDE_DX = 6;

// How long a print takes to fill back in: fresh snow covers it sooner, and a
// blizzard's wind wipes it in a moment.
const PRINT_MS: Record<string, number> = { clear: 6000, snow: 4000, blizzard: 1600 };
// One step every 200ms (two strides per 4-frame cycle at 10fps), so at most
// 6s / 200ms = 30 prints are ever down at once.
const PRINT_CAP = 32;
const PUFF_CAP = 16;

// What a step kicks up, per region, and on which ground. The grass gets
// nothing on purpose: the meadow underfoot would turn every walk into a
// dust storm, which is what the scenes' old every-terrain dust did.
const PUFFS: Partial<Record<Region, { ground: ReadonlySet<number>; frames: string[]; count: number; alpha: number }>> = {
  town: { ground: new Set([T_PATH]), frames: ["puff-dirt"], count: 3, alpha: 0.6 },
  forest: { ground: new Set([T_PATH]), frames: ["puff-dirt-dark"], count: 3, alpha: 0.6 },
  volcano: { ground: new Set([T_ASH, T_SCORCH]), frames: ["puff-ash", "puff-ash", "puff-ash-dark"], count: 3, alpha: 0.6 },
  // the cave floor is T_PATH in its level data; the faintest of the lot
  dungeon: { ground: new Set([T_PATH]), frames: ["puff-stone"], count: 1, alpha: 0.3 },
};
// snow takes prints, not puffs, on open snow and snowed-over scrub; the paths
// are already trodden flat
const SNOW_GROUND: ReadonlySet<number> = new Set([T_GRASS, T_TALL]);
// In autumn now and then a fallen leaf skitters off the path with a step:
// about one stride in four, one leaf, so a walk rustles rather than sheds.
const LEAF_CHANCE = 0.25;

/**
 * Footprints and dust that follow the ground under `actor`: prints pressed
 * into the snow that fill back in over a few seconds, a puff of ash in the
 * crater, a little dirt off a path in the town and forest, a breath of dust on
 * the cave floor. Steps land on the walk cycle's two stride frames, never on a
 * diagonal or while standing still. Ground is read off `level` (the scene's
 * logical grid). World space, so the camera carries them like the ground.
 */
export function addFootsteps(
  scene: Phaser.Scene,
  actor: Phaser.Physics.Arcade.Sprite,
  level: readonly (readonly number[])[],
  region: Region,
): void {
  // the season's look of the ground (seasonLook, as the map skin reads it):
  // a winter town or forest is snow like the snow field, with its paths
  // trodden flat
  const look = seasonLook(region);
  const snowy = region === "snow" || look === "winter";
  const puffs = snowy ? undefined : PUFFS[region];
  if (!snowy && !puffs) return;
  bakeSheet(scene);

  const printMs = PRINT_MS[weatherToday(region)] ?? PRINT_MS.clear;
  const print = (frame: string): Phaser.GameObjects.Particles.ParticleEmitter =>
    scene.add
      .particles(0, 0, SHEET, {
        frame,
        lifespan: printMs,
        alpha: { start: 0.85, end: 0 },
        maxAliveParticles: PRINT_CAP / 2,
        emitting: false,
      })
      .setDepth(PRINT_DEPTH);
  const prints = snowy ? { v: print("print-v"), h: print("print-h") } : null;
  const puff = puffs
    ? scene.add
        .particles(0, 0, SHEET, {
          frame: puffs.frames,
          // a small upward fan that settles back: y grows downward
          speed: { min: 6, max: 20 },
          angle: { min: 200, max: 340 },
          gravityY: 24,
          lifespan: { min: 260, max: 420 },
          alpha: { start: puffs.alpha, end: 0 },
          maxAliveParticles: PUFF_CAP,
          emitting: false,
        })
        .setDepth(PUFF_DEPTH)
    : null;
  // Ambient's autumn leaves, kicked up off the path: a short hop that settles
  // back and fades
  const leaves =
    look === "autumn"
      ? scene.add
          .particles(0, 0, SHEET, {
            frame: ["leaf-c", "leaf-d", "leaf-e"],
            speed: { min: 14, max: 34 },
            angle: { min: 210, max: 330 },
            gravityY: 60,
            lifespan: { min: 500, max: 700 },
            alpha: { start: 0.9, end: 0 },
            maxAliveParticles: 4,
            emitting: false,
          })
          .setDepth(PUFF_DEPTH)
      : null;

  const step = (frame: Phaser.Animations.AnimationFrame): void => {
    // the stride frames, hero-*-0 and hero-*-2 (index is 1-based)
    if (frame.index !== 1 && frame.index !== 3) return;
    const body = actor.body as Phaser.Physics.Arcade.Body | null;
    const vx = body?.velocity.x ?? 0;
    const vy = body?.velocity.y ?? 0;
    if ((vx === 0) === (vy === 0)) return; // standing still, or a diagonal
    const fx = actor.x;
    const fy = actor.y + FEET_DY;
    const tile = level[Math.floor(fy / TILE)]?.[Math.floor(fx / TILE)];
    if (tile === undefined) return;
    const side = frame.index === 1 ? -1 : 1;
    if (prints && SNOW_GROUND.has(tile)) {
      if (vy !== 0) prints.v.emitParticleAt(fx + side * STRIDE_DX, fy - 2, 1);
      else prints.h.emitParticleAt(fx, fy + side * (STRIDE_DX / 2), 1);
    } else if (puff && puffs?.ground.has(tile)) {
      puff.emitParticleAt(fx + side * STRIDE_DX, fy, puffs.count);
      if (leaves && Math.random() < LEAF_CHANCE) leaves.emitParticleAt(fx + side * STRIDE_DX, fy, 1);
    }
  };
  const onUpdate = (_anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame): void => step(frame);
  actor.on(Phaser.Animations.Events.ANIMATION_UPDATE, onUpdate);
  actor.on(Phaser.Animations.Events.ANIMATION_START, onUpdate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    actor.off(Phaser.Animations.Events.ANIMATION_UPDATE, onUpdate);
    actor.off(Phaser.Animations.Events.ANIMATION_START, onUpdate);
  });
}
