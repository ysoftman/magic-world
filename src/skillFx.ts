// The battle skills' effects: each skill's pixelfx sheets (skillSheets.ts)
// played over the hero, the foe and the ground between them, with the
// moments its blows land handed back to the battle (onHit) to deal and show
// the damage. A sheet is timed in its effect's own seconds (the `t` given for
// each blow below) and squeezed into a play time like playFx's: a blow lands
// on the frame it shows in, at any BATTLE SPEED.
import Phaser from "phaser";
import { flash, loopFx, playFx, shake, spanOf } from "./fx";
import { SKILL_SHEETS } from "./skillSheets";

export type SkillName =
  | "ARCANE BEAM"
  | "THORNS"
  | "MISSILES"
  | "FLAME PILLAR"
  | "CHAIN BOLT"
  | "ICE SPIKES"
  | "LASER"
  | "SOUL DRAIN"
  | "QUAKE"
  | "EMP"
  | "SMITE"
  | "METEOR"
  | "STAR FALL"
  | "VOID";

export interface SkillStage {
  /** the hero's sprite (origin in its middle, x about 320) */
  hero: Phaser.GameObjects.Sprite;
  /** the foe's sprite (origin in its middle, x about 960) */
  foe: Phaser.GameObjects.Sprite;
  /** BattleScene enemyBaseScale: 2, a boss's or giant's 3 */
  foeScale: number;
  /** the ground the battlers stand on (GROUND_Y, 456) */
  groundY: number;
  /** the foe's feet: GROUND_Y, a flier's GROUND_Y - FLY_LIFT */
  foeFeetY: number;
  /** BATTLE SPEED applied (BattleScene.anim) */
  anim: (ms: number) => number;
}

/** how many times each skill lands (the rules' SKILLS table has the same) */
export const SKILL_HITS: Record<SkillName, number> = {
  "ARCANE BEAM": 1,
  THORNS: 1,
  MISSILES: 3,
  "FLAME PILLAR": 1,
  "CHAIN BOLT": 3,
  "ICE SPIKES": 1,
  LASER: 4,
  "SOUL DRAIN": 1,
  QUAKE: 1,
  EMP: 1,
  SMITE: 1,
  METEOR: 1,
  "STAR FALL": 5,
  VOID: 1,
};

/** the sheets each skill plays, for the battle's create to warm (fx.ts warmFx) */
export const SKILL_SHEET_KEYS: Record<SkillName, string[]> = {
  "ARCANE BEAM": ["fx-sk-beam"],
  THORNS: ["fx-sk-thorns"],
  MISSILES: ["fx-sk-missiles"],
  "FLAME PILLAR": ["fx-sk-pillar"],
  // BOLT's own burst (fx.ts) for the surge down the chain
  "CHAIN BOLT": ["fx-sk-chain", "fx-bolt"],
  "ICE SPIKES": ["fx-sk-spikes"],
  LASER: ["fx-sk-laser", "fx-sk-laser-hit"],
  "SOUL DRAIN": ["fx-sk-drain"],
  QUAKE: ["fx-sk-quake"],
  EMP: ["fx-sk-emp"],
  SMITE: ["fx-sk-smite"],
  METEOR: ["fx-sk-meteor"],
  "STAR FALL": ["fx-sk-stars"],
  VOID: ["fx-sk-void"],
};

// Every skill sheet is drawn on the battlers' 4px cell (playFx's scale 2),
// a boss's and a giant's too. What stands on the floor plays at the ground (groundY), a flier's
// too: thorns, spikes, a pillar or a quake come up out of the ground under
// it, a meteor or a star or a smite comes down onto it.
const CELL = 2;
// where the hero's spells leave the hand, as BattleScene castProjectile's
// shots: 40 right of its middle, 20 up
const HAND_X = 40;
const HAND_Y = -20;
// what may not go higher: the stat windows end at y 200, so a sheet's top is
// kept to 224 over the ground and 204 over a flier; its floor to 488 (the menu
// rows below the ground)
const TOP = 224;
const FLIER_TOP = 204;
const FLOOR = 488;

const wait = (scene: Phaser.Scene, ms: number): Promise<void> => new Promise((resolve) => scene.time.delayedCall(Math.max(0, ms), resolve));

// when, `ms` into a sheet's play, its effect reaches its own second `t`
function msAt(key: string, t: number, ms: number): number {
  const { from, to } = spanOf(SKILL_SHEETS[key]);
  return Phaser.Math.Clamp(((t - from) / (to - from)) * ms, 0, ms);
}

/**
 * Plays sheet `key` once at (x, y) over `ms` (BATTLE SPEED already in), and
 * `beats` at their moments in the effect's own seconds; resolves when it is
 * over.
 */
function sheet(
  scene: Phaser.Scene,
  key: string,
  x: number,
  y: number,
  ms: number,
  beats: [number, () => void][] = [],
): { sprite: Phaser.GameObjects.Sprite; done: Promise<void> } {
  const sprite = playFx(scene, key, x, y, ms, CELL);
  for (const [t, beat] of beats) scene.time.delayedCall(msAt(key, t, ms), beat);
  return { sprite, done: wait(scene, ms) };
}

// the hero's hand, where beams, bolts and missiles leave it
const handOf = ({ hero }: SkillStage): [number, number] => [hero.x + HAND_X, hero.y + HAND_Y];

// a sheet's (x, y) on the foe's middle, moved up or down as little as keeps
// its `above` and `below` cells inside the screen's limits
function onFoe(stage: SkillStage, above: number, below: number): number {
  const top = stage.foeFeetY < stage.groundY ? FLIER_TOP : TOP;
  return Phaser.Math.Clamp(stage.foe.y, top + above * CELL * 2, FLOOR - below * CELL * 2);
}

// a sheet faded in over its first `inMs` and out over its last `outMs`
function fadeEnds(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, ms: number, inMs: number, outMs: number): void {
  sprite.setAlpha(0);
  scene.tweens.add({ targets: sprite, alpha: 1, duration: Math.max(1, inMs) });
  scene.tweens.add({ targets: sprite, alpha: 0, delay: ms - outMs, duration: Math.max(1, outMs - 1) });
}

const cam = (scene: Phaser.Scene): Phaser.Cameras.Scene2D.Camera => scene.cameras.main;

/** Plays the skill, calling onHit(i) (i = 0..SKILL_HITS[name]-1) as each blow lands; resolves when it is all over. */
export function playSkill(scene: Phaser.Scene, name: SkillName, stage: SkillStage, onHit: (i: number) => void): Promise<void> {
  return PLAYS[name](scene, stage, onHit);
}

type Play = (scene: Phaser.Scene, stage: SkillStage, onHit: (i: number) => void) => Promise<void>;

const PLAYS: Record<SkillName, Play> = {
  // ARCANE BEAM: a violet beam bursts out of the hand across to the foe
  // (its end flare, spraying sparks, on the foe's near side), holds a beat
  // and draws off into it. The sheet is the loop, shown a little at a time
  // as it shoots out (a crop growing from the hand) and as it lets go (one
  // shrinking into the foe). Its blow, as it reaches the foe.
  "ARCANE BEAM": async (scene, stage, onHit) => {
    const { anim } = stage;
    const [x, y] = handOf(stage);
    const beam = loopFx(scene, "fx-sk-beam", x, y, anim(55), CELL);
    const { width: w, height: h } = beam.frame;
    // the part of the frame shown, [x0, x1) of its width, as p goes 0..1
    const sweep = (ms: number, part: (p: number) => [number, number]): Promise<void> =>
      new Promise((resolve) =>
        scene.tweens.addCounter({
          from: 0,
          to: 1,
          duration: Math.max(1, ms),
          onUpdate: (tw) => {
            const [x0, x1] = part(tw.getValue() ?? 0);
            beam.setCrop(Math.round(w * x0), 0, Math.max(1, Math.round(w * (x1 - x0))), h);
          },
          onComplete: () => resolve(),
        }),
      );
    beam.setCrop(0, 0, 1, h);
    await sweep(anim(110), (p) => [0, p]);
    onHit(0);
    shake(cam(scene), 160, 0.006);
    await wait(scene, anim(520));
    scene.tweens.add({ targets: beam, alpha: 0, duration: anim(160) });
    await sweep(anim(160), (p) => [p, 1]);
    beam.destroy();
  },

  // THORNS: a line of light runs along the floor to the foe and hooked
  // thorns punch up out of it one after another, each bigger, the last and
  // biggest through the foe; they hold, then sink. Its blow, as that last
  // one has half risen (0.495s, rising over 0.11s).
  THORNS: async (scene, stage, onHit) => {
    const { anim, foe, groundY } = stage;
    await sheet(scene, "fx-sk-thorns", foe.x, groundY, anim(1150), [
      [
        0.55,
        () => {
          onHit(0);
          shake(cam(scene), 140, 0.006);
        },
      ],
    ]).done;
  },

  // MISSILES: five violet bolts fan out of the hand, curl round on twisting
  // ribbons and pop on the foe's near side one after another. Three of them
  // are the blows: the first, the middle and the last (they land at 0.783,
  // 0.967 and 1.217s; the other two at 0.867 and 1.1s).
  MISSILES: async (scene, stage, onHit) => {
    const { anim } = stage;
    const [x, y] = handOf(stage);
    const blow = (i: number, hard: boolean) => (): void => {
      onHit(i);
      shake(cam(scene), hard ? 160 : 80, hard ? 0.008 : 0.004);
    };
    await sheet(scene, "fx-sk-missiles", x, y, anim(1300), [
      [0.783, blow(0, false)],
      [0.967, blow(1, false)],
      [1.217, blow(2, true)],
    ]).done;
  },

  // FLAME PILLAR: cracks glow out across the floor under the foe, then a
  // column of fire erupts through it, roars and burns down to smoke. Its blow,
  // as it erupts (0.55s, at full height 0.12s later).
  "FLAME PILLAR": async (scene, stage, onHit) => {
    const { anim, foe, groundY } = stage;
    await sheet(scene, "fx-sk-pillar", foe.x, groundY, anim(1200), [
      [
        0.6,
        () => {
          onHit(0);
          shake(cam(scene), 220, 0.01);
        },
      ],
    ]).done;
  },

  // CHAIN BOLT: a bolt leaps from the hand across two sparks over the floor
  // onto the foe and holds there, humming; BOLT's own burst surges down it
  // into the foe, then the chain snaps and the foe pops once more. Its blows:
  // the bolt landing (0.32s), the surge, and the snap (1.04s).
  "CHAIN BOLT": async (scene, stage, onHit) => {
    const { anim, foe, groundY } = stage;
    await sheet(scene, "fx-sk-chain", foe.x, groundY, anim(1100), [
      [
        0.32,
        () => {
          onHit(0);
          shake(cam(scene), 100, 0.005);
        },
      ],
      [
        0.56,
        () => {
          playFx(scene, "fx-bolt", foe.x, foe.y, anim(280), CELL);
          onHit(1);
          shake(cam(scene), 100, 0.006);
        },
      ],
      [
        1.04,
        () => {
          onHit(2);
          shake(cam(scene), 140, 0.008);
        },
      ],
    ]).done;
  },

  // ICE SPIKES: a frost line runs out from in front of the hero along the
  // floor, ice blades bursting up behind it, highest round the foe; they
  // shiver, flash white together and shatter, the frost melting off. Its
  // blow, as the blades reach the foe: its middle is 148 cells along the
  // line of 190 (0.3s), its blades up 0.012s after.
  "ICE SPIKES": async (scene, stage, onHit) => {
    const { anim, hero, groundY } = stage;
    await sheet(scene, "fx-sk-spikes", hero.x + 48, groundY, anim(1400), [
      [
        0.33,
        () => {
          onHit(0);
          shake(cam(scene), 140, 0.006);
        },
      ],
    ]).done;
  },

  // LASER: four red bolts out of the hand in quick succession, a little
  // apart, each bursting in red sparks where it hits.
  LASER: async (scene, stage, onHit) => {
    const { anim, foe } = stage;
    const [x, y] = handOf(stage);
    const aims: [number, number][] = [
      [-6, -8],
      [4, 10],
      [-2, -16],
      [6, 2],
    ];
    const shots = aims.map(async ([dy, ty], i) => {
      await wait(scene, anim(i * 110));
      const [tx, toY] = [foe.x - 24, foe.y + ty];
      const from = y + dy;
      const bolt = loopFx(scene, "fx-sk-laser", x, from, anim(30), CELL).setRotation(Math.atan2(toY - from, tx - x));
      await new Promise<void>((resolve) =>
        scene.tweens.add({ targets: bolt, x: tx, y: toY, duration: anim(150), onComplete: () => resolve() }),
      );
      bolt.destroy();
      playFx(scene, "fx-sk-laser-hit", tx, toY, anim(260), CELL);
      onHit(i);
      shake(cam(scene), 70, i === aims.length - 1 ? 0.006 : 0.003);
    });
    await Promise.all(shots);
    await wait(scene, anim(200));
  },

  // SOUL DRAIN: a black crystal vessel hangs in front of the hero, a funnel
  // of violet streaks reaching from it out over the foe; a pale soul is torn
  // out of the foe's middle (its line starts 146 cells out, level with the
  // vessel) and dragged down the funnel into the vessel, which flares as it
  // lands. The loop's stretch round that soul (born 1.915s, landing 3.365s),
  // faded in and out. Its blow, as the soul is torn loose.
  "SOUL DRAIN": async (scene, stage, onHit) => {
    const { anim, hero } = stage;
    const ms = anim(1300);
    const { sprite, done } = sheet(scene, "fx-sk-drain", hero.x + 64, hero.y - 16, ms, [
      [
        1.94,
        () => {
          onHit(0);
          shake(cam(scene), 100, 0.004);
        },
      ],
    ]);
    fadeEnds(scene, sprite, ms, anim(120), anim(160));
    await done;
  },

  // QUAKE: the ground under the foe jolts three times, cracking wider each
  // time with molten light in the cracks, rubble thrown up and dust rolling;
  // the screen shakes with each. Its blow, the big second jolt (0.5s).
  QUAKE: async (scene, stage, onHit) => {
    const { anim, foe, groundY } = stage;
    await sheet(scene, "fx-sk-quake", foe.x, groundY, anim(1200), [
      [0.06, () => shake(cam(scene), 120, 0.004)],
      [
        0.5,
        () => {
          onHit(0);
          shake(cam(scene), 300, 0.014);
        },
      ],
      [0.92, () => shake(cam(scene), 160, 0.006)],
    ]).done;
  },

  // EMP: sparks crackle at the foe's feet, then a dome of blue force snaps
  // out over it (radius 40, 160px), strobes and breaks into motes. Its blow,
  // as the dome pops out (0.42s).
  EMP: async (scene, stage, onHit) => {
    const { anim, foe, groundY } = stage;
    await sheet(scene, "fx-sk-emp", foe.x, groundY, anim(1200), [
      [
        0.45,
        () => {
          onHit(0);
          shake(cam(scene), 120, 0.006);
        },
      ],
    ]).done;
  },

  // SMITE: a ring marks the floor under the foe, a thread of light comes
  // down onto it, then the hammer of light falls: a white flash, a dome and
  // a ring of light, scorch and embers. Its blow, the hammer (0.54s).
  SMITE: async (scene, stage, onHit) => {
    const { anim, foe, groundY } = stage;
    await sheet(scene, "fx-sk-smite", foe.x, groundY, anim(1200), [
      [
        0.55,
        () => {
          onHit(0);
          shake(cam(scene), 200, 0.012);
          flash(cam(scene), 120, 255, 244, 200);
        },
      ],
    ]).done;
  },

  // METEOR: a burning rock streaks in from the upper left out of the sky
  // (cut where the stat windows start) and smashes into the ground under the
  // foe: a white flash, a fireball, rocks thrown, smoke rising. Its blow, the
  // impact (0.62s).
  METEOR: async (scene, stage, onHit) => {
    const { anim, foe, groundY } = stage;
    await sheet(scene, "fx-sk-meteor", foe.x, groundY, anim(1000), [
      [
        0.62,
        () => {
          onHit(0);
          shake(cam(scene), 280, 0.018);
          flash(cam(scene), 150, 255, 170, 90);
        },
      ],
    ]).done;
  },

  // STAR FALL: eleven stars streak down on long trails across the ground
  // round the foe, each landing in a flash and a ring; five land on the foe
  // (within 17 cells of its middle) and are the blows. Seed 208 spaces those
  // five out: 0.427, 0.64, 0.849, 1.13 and 1.442s (1.44 here).
  "STAR FALL": async (scene, stage, onHit) => {
    const { anim, foe, groundY } = stage;
    const blow = (i: number) => (): void => {
      onHit(i);
      shake(cam(scene), 80, 0.004);
    };
    await sheet(
      scene,
      "fx-sk-stars",
      foe.x,
      groundY,
      anim(1300),
      [0.427, 0.64, 0.849, 1.13, 1.44].map((t, i): [number, () => void] => [t, blow(i)]),
    ).done;
  },

  // VOID: motes swirl into a pulsing core on the foe, a black star cuts
  // across a violet-white flash, and a black sphere burns there, throwing
  // shards, then collapses in violet smoke. On the foe's middle, moved up or
  // down as little as keeps its 38 cells over and 22 under on the screen.
  // Its blow, the black star (0.52s).
  VOID: async (scene, stage, onHit) => {
    const { anim, foe } = stage;
    await sheet(scene, "fx-sk-void", foe.x, onFoe(stage, 38, 22), anim(1300), [
      [
        0.56,
        () => {
          onHit(0);
          shake(cam(scene), 220, 0.012);
          flash(cam(scene), 140, 200, 150, 255);
        },
      ],
    ]).done;
  },
};
