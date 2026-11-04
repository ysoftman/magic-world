import Phaser from "phaser";
import { flash, playFx, shake, spanOf } from "./fx";
import type { SkillStage } from "./skillFx";
import { TECH_SHEETS } from "./techSheets";

export type TechName =
  | "DOUBLE SLASH"
  | "UPPERCUT"
  | "WHIP CRACK"
  | "DAGGER FLURRY"
  | "SPEAR SWEEP"
  | "SPIN SLASH"
  | "HEAVY CLEAVE"
  | "SCYTHE REAP"
  | "FIRE TORNADO"
  | "THUNDERCLAP"
  | "FROST NOVA"
  | "BLACK HOLE";

/** how many times each tech lands (the rules' table has the same) */
export const TECH_HITS: Record<TechName, number> = {
  "DOUBLE SLASH": 2,
  UPPERCUT: 1,
  "WHIP CRACK": 1,
  "DAGGER FLURRY": 4,
  "SPEAR SWEEP": 1,
  "SPIN SLASH": 3,
  "HEAVY CLEAVE": 1,
  "SCYTHE REAP": 1,
  "FIRE TORNADO": 1,
  THUNDERCLAP: 1,
  "FROST NOVA": 1,
  "BLACK HOLE": 1,
};

/** the weapon techs: the hero has dashed up to the foe before playTech (BattleScene does the dash and the way back) */
export const TECH_MELEE: Record<TechName, boolean> = {
  "DOUBLE SLASH": true,
  UPPERCUT: true,
  "WHIP CRACK": true,
  "DAGGER FLURRY": true,
  "SPEAR SWEEP": true,
  "SPIN SLASH": true,
  "HEAVY CLEAVE": true,
  "SCYTHE REAP": true,
  "FIRE TORNADO": false,
  THUNDERCLAP: false,
  "FROST NOVA": false,
  "BLACK HOLE": false,
};

/** the sheets each tech plays, for the battle's create to warm (fx.ts warmFx) */
export const TECH_SHEET_KEYS: Record<TechName, string[]> = {
  "DOUBLE SLASH": ["fx-tk-double"],
  UPPERCUT: ["fx-tk-upper"],
  "WHIP CRACK": ["fx-tk-whip"],
  "DAGGER FLURRY": ["fx-tk-flurry"],
  "SPEAR SWEEP": ["fx-tk-sweep-back", "fx-tk-sweep"],
  "SPIN SLASH": ["fx-tk-spin-back", "fx-tk-spin"],
  "HEAVY CLEAVE": ["fx-tk-cleave-back", "fx-tk-cleave"],
  "SCYTHE REAP": ["fx-tk-reap-back", "fx-tk-reap"],
  "FIRE TORNADO": ["fx-tk-tornado"],
  THUNDERCLAP: ["fx-tk-clap-back", "fx-tk-clap"],
  "FROST NOVA": ["fx-tk-nova-back", "fx-tk-nova"],
  "BLACK HOLE": ["fx-tk-hole", "fx-tk-pop"],
};

// Every tech sheet is drawn on the battlers' 4px cell (playFx's scale 2),
// a boss's and a giant's too. A blow plays on the foe's feet (a
// flier's up in the air with it), what stands on the floor on the ground
// under the foe, and what whirls round the hero on the ground under the hero;
// techSheets.ts crops each to the screen's limits from there.
const CELL = 2;

const wait = (scene: Phaser.Scene, ms: number): Promise<void> => new Promise((resolve) => scene.time.delayedCall(Math.max(0, ms), resolve));

// when, `ms` into a sheet's play, its effect reaches its own second `t`
function msAt(key: string, t: number, ms: number): number {
  const { from, to } = spanOf(TECH_SHEETS[key]);
  return Phaser.Math.Clamp(((t - from) / (to - from)) * ms, 0, ms);
}

type Beat = [number, () => void];

// the lower of the hero and the foe in the display list: a sheet's back half
// goes under both, so the far side of a ring passes behind whoever it rounds
function under(scene: Phaser.Scene, { hero, foe }: SkillStage): Phaser.GameObjects.Sprite {
  return scene.children.getIndex(hero) < scene.children.getIndex(foe) ? hero : foe;
}

/**
 * Plays sheet `key` once at (x, y) over `ms` (BATTLE SPEED already in), its
 * `-back` half too when `back` (under the hero and the foe), and `beats` at
 * their moments in the effect's own seconds. `fadeMs`: faded out over its
 * last ms (dust or a reap still hanging where the span ends). Resolves when
 * it is over.
 */
function sheet(
  scene: Phaser.Scene,
  stage: SkillStage,
  key: string,
  x: number,
  y: number,
  ms: number,
  beats: Beat[] = [],
  { back = false, fadeMs = 0 } = {},
): { sprites: Phaser.GameObjects.Sprite[]; done: Promise<void> } {
  const sprites = [playFx(scene, key, x, y, ms, CELL)];
  if (back) {
    const b = playFx(scene, `${key}-back`, x, y, ms, CELL);
    scene.children.moveBelow(b, under(scene, stage));
    sprites.push(b);
  }
  if (fadeMs > 0) scene.tweens.add({ targets: sprites, alpha: 0, delay: ms - fadeMs, duration: Math.max(1, fadeMs - 1) });
  for (const [t, beat] of beats) scene.time.delayedCall(msAt(key, t, ms), beat);
  return { sprites, done: wait(scene, ms) };
}

const cam = (scene: Phaser.Scene): Phaser.Cameras.Scene2D.Camera => scene.cameras.main;

// a blow landing: its number and the foe's flash (onHit), and a jolt
const blow = (scene: Phaser.Scene, onHit: (i: number) => void, i: number, ms: number, intensity: number) => (): void => {
  onHit(i);
  shake(cam(scene), ms, intensity);
};

/** Plays the tech, calling onHit(i) (i = 0..TECH_HITS[name]-1) as each blow lands; resolves when it is all over. */
export function playTech(scene: Phaser.Scene, name: TechName, stage: SkillStage, onHit: (i: number) => void): Promise<void> {
  return PLAYS[name](scene, stage, onHit);
}

type Play = (scene: Phaser.Scene, stage: SkillStage, onHit: (i: number) => void) => Promise<void>;

const PLAYS: Record<TechName, Play> = {
  // DOUBLE SLASH: a rose-red cut down through the foe, then one up that
  // crosses it; the X flashes white, bursts in sparks and lingers dotted.
  // Its blows, each cut (0.06s, 0.16s).
  "DOUBLE SLASH": async (scene, stage, onHit) => {
    const { anim, foe, foeFeetY } = stage;
    await sheet(scene, stage, "fx-tk-double", foe.x, foeFeetY, anim(600), [
      [0.06, blow(scene, onHit, 0, 70, 0.004)],
      [0.16, blow(scene, onHit, 1, 140, 0.008)],
    ]).done;
  },

  // UPPERCUT: a fiery crescent rises up the foe's front and a comic impact
  // star bursts at its head, rays, a ring, twinkles. Its blow, the star (0.09s).
  UPPERCUT: async (scene, stage, onHit) => {
    const { anim, foe, foeFeetY } = stage;
    await sheet(scene, stage, "fx-tk-upper", foe.x, foeFeetY, anim(600), [[0.09, blow(scene, onHit, 0, 160, 0.01)]]).done;
  },

  // WHIP CRACK: a leather whip rolls out of the hero's hand and its tip
  // flips over and cracks on the foe: a white pop, a ring of air, sparks.
  // Its blow, the crack (0.22s).
  "WHIP CRACK": async (scene, stage, onHit) => {
    const { anim, foe, foeFeetY } = stage;
    await sheet(scene, stage, "fx-tk-whip", foe.x, foeFeetY, anim(550), [[0.22, blow(scene, onHit, 0, 120, 0.008)]]).done;
  },

  // DAGGER FLURRY: small quick violet-white cuts at every angle over the
  // foe, then one big cut that glints and bursts. Its blows, the 1st, 3rd and
  // 5th small cuts and the big one (of its 7 small at 0.055s apart, then 0.42s).
  "DAGGER FLURRY": async (scene, stage, onHit) => {
    const { anim, foe, foeFeetY } = stage;
    await sheet(scene, stage, "fx-tk-flurry", foe.x, foeFeetY, anim(900), [
      [0.05, blow(scene, onHit, 0, 50, 0.003)],
      [0.16, blow(scene, onHit, 1, 50, 0.003)],
      [0.27, blow(scene, onHit, 2, 50, 0.003)],
      [0.42, blow(scene, onHit, 3, 160, 0.008)],
    ]).done;
  },

  // SPEAR SWEEP: a long flat jade crescent swings low from behind the hero's
  // legs round the front through the foe's, kicking a wake of dust along the
  // floor that rolls out both ways and thins. Its blow, as the sweep passes
  // the foe (0.1s).
  "SPEAR SWEEP": async (scene, stage, onHit) => {
    const { anim, hero, groundY } = stage;
    const ms = anim(800);
    await sheet(scene, stage, "fx-tk-sweep", hero.x, groundY, ms, [[0.1, blow(scene, onHit, 0, 140, 0.008)]], {
      back: true,
      fadeMs: anim(260),
    }).done;
  },

  // SPIN SLASH: the blade whirls round the hero's waist three times on a
  // tilted ring wide enough to cut through the foe, the far side behind them
  // both; each closed ring flares white and throws sparks. Its blows, the
  // three rings closing (0.17s into each). Round the hero's waist on the
  // ground, round its head against a flier (on the foe's feet's line), where
  // the ring cuts through the flier, not under it.
  "SPIN SLASH": async (scene, stage, onHit) => {
    const { anim, hero, foeFeetY } = stage;
    const spins = [0, 1, 2].map(async (i) => {
      await wait(scene, anim(i * 320));
      await sheet(
        scene,
        stage,
        "fx-tk-spin",
        hero.x,
        foeFeetY,
        anim(400),
        [[0.17, blow(scene, onHit, i, i === 2 ? 160 : 70, i === 2 ? 0.008 : 0.004)]],
        {
          back: true,
        },
      ).done;
    });
    await Promise.all(spins);
  },

  // HEAVY CLEAVE: a glint over the hero's head, then a thick ember arc comes
  // over the top and down through the foe into the floor: a white slam,
  // glowing cracks, dust rolling both ways, embers rising. Its blow, the slam
  // (0.335s).
  "HEAVY CLEAVE": async (scene, stage, onHit) => {
    const { anim, foe, groundY } = stage;
    await sheet(
      scene,
      stage,
      "fx-tk-cleave",
      foe.x,
      groundY,
      anim(1000),
      [
        [
          0.335,
          () => {
            onHit(0);
            shake(cam(scene), 260, 0.016);
          },
        ],
      ],
      { back: true, fadeMs: anim(240) },
    ).done;
  },

  // SCYTHE REAP (a drain): a slow, huge violet crescent reaps round the
  // foe, behind it and back in front, its edge blood-red; it hangs, then
  // tears away from the tail into red wisps. Its blow, as the blade sweeps
  // under the foe (0.3s).
  "SCYTHE REAP": async (scene, stage, onHit) => {
    const { anim, foe, foeFeetY } = stage;
    await sheet(scene, stage, "fx-tk-reap", foe.x, foeFeetY, anim(1100), [[0.3, blow(scene, onHit, 0, 180, 0.01)]], {
      back: true,
      fadeMs: anim(220),
    }).done;
  },

  // FIRE TORNADO: a funnel of fire spins up out of the ground under the foe
  // (grown from the floor), bands turning round it, licks flung off, a ring
  // of flame at its foot, embers orbiting; it burns a beat and blows out.
  // Its blow, once it stands full height.
  "FIRE TORNADO": async (scene, stage, onHit) => {
    const { anim, foe, groundY } = stage;
    const ms = anim(1200);
    const { sprites, done } = sheet(scene, stage, "fx-tk-tornado", foe.x, groundY, ms, [[0.45, blow(scene, onHit, 0, 220, 0.01)]], {
      fadeMs: anim(260),
    });
    const [funnel] = sprites;
    const s = funnel.scaleY;
    funnel.setScale(funnel.scaleX * 0.6, s * 0.1).setAlpha(0);
    scene.tweens.add({ targets: funnel, scaleX: s, scaleY: s, alpha: 1, duration: anim(240), ease: "Cubic.easeOut" });
    await done;
  },

  // THUNDERCLAP: sparks rush in to the foe's middle, then a white flash
  // there, forked bolts burst out of it and stab the floor round it, a shock
  // ring tears across the ground raising dust, sparks streak away. Its blow,
  // the clap (0.12s).
  THUNDERCLAP: async (scene, stage, onHit) => {
    const { anim, foe, groundY } = stage;
    await sheet(
      scene,
      stage,
      "fx-tk-clap",
      foe.x,
      groundY,
      anim(1000),
      [
        [
          0.13,
          () => {
            onHit(0);
            shake(cam(scene), 240, 0.012);
            flash(cam(scene), 110, 190, 220, 255);
          },
        ],
      ],
      { back: true, fadeMs: anim(200) },
    ).done;
  },

  // FROST NOVA: cold spirals into a spinning snowflake at the foe's middle,
  // then it bursts: rings of ice crystals bloom round the foe, the far ones
  // behind it, snow drifting. Its blow, the burst (0.48s).
  "FROST NOVA": async (scene, stage, onHit) => {
    const { anim, foe, groundY } = stage;
    await sheet(scene, stage, "fx-tk-nova", foe.x, groundY, anim(1300), [[0.48, blow(scene, onHit, 0, 200, 0.01)]], {
      back: true,
      fadeMs: anim(280),
    }).done;
  },

  // BLACK HOLE: a black hole opens on the foe's middle, a tilted violet disk
  // turning round it, debris spiralling in; then it collapses (an
  // implosion: rings contracting onto a crushed white point) and pops. Its
  // blow, the pop (the implosion's 1.07s).
  "BLACK HOLE": async (scene, stage, onHit) => {
    const { anim, foe } = stage;
    const holeMs = anim(900);
    const hole = playFx(scene, "fx-tk-hole", foe.x, foe.y, holeMs, CELL);
    const s = hole.scaleY;
    hole.setScale(0).setAlpha(0);
    scene.tweens.add({ targets: hole, scale: s, alpha: 1, duration: anim(260), ease: "Back.easeOut" });
    await wait(scene, anim(500));
    const popMs = anim(750);
    // swallowed into the implosion's point as it crushes (0.8s of it)
    scene.tweens.add({
      targets: hole,
      scale: 0,
      delay: msAt("fx-tk-pop", 0.68, popMs),
      duration: msAt("fx-tk-pop", 0.8, popMs) - msAt("fx-tk-pop", 0.68, popMs),
      ease: "Cubic.easeIn",
    });
    await sheet(scene, stage, "fx-tk-pop", foe.x, foe.y, popMs, [
      [
        1.07,
        () => {
          onHit(0);
          shake(cam(scene), 240, 0.012);
          flash(cam(scene), 100, 200, 170, 255);
        },
      ],
    ]).done;
  },
};
