import Phaser from "phaser";
import { Sfx } from "../audio";
import { MATERIALS } from "../drops";
import { GameState } from "../gameState";
import { ART_PX, FIELD_TOAST_Y, makeTexture, showToast } from "../pixelart";
import {
  SHARD_REGION_NAMES,
  SHARDS_PER_REGION,
  type ShardRegion,
  STAR_MATERIAL,
  STAR_MATERIALS,
  STAR_MAX_HP,
  STARFALL_ATK,
  STARFALL_DEF,
  shardSpots,
  takeShard,
} from "../shards";

const SHARD_KEY = "star-shard";
// a shard of a fallen star: a slanted splinter, white at its core through
// pale blue to a deep blue rim, on 2px cells (ART_PX), 22x26px. Not the
// treasure maps' gold cross (TreasureDig's glint), which means "dig here".
// biome-ignore format: one row per line so the art reads as a grid
const SHARD = [
  "......kk...",
  ".....kwbk..",
  "....kwwbk..",
  "....kwcbbk.",
  "...kwwcbbk.",
  "..kwwccbbk.",
  "..kwcccbdk.",
  ".kwwccbbdk.",
  ".kwccbbddk.",
  "kwccbbddk..",
  "kccbbddk...",
  ".kbbddk....",
  "..kkkk.....",
];
const SHARD_PALETTE = { k: 0x1e2a5e, w: 0xffffff, c: 0xd6f0ff, b: 0x8ecbff, d: 0x4f7fd6 };
// taken by walking onto its cell
const TAKE_RADIUS = 36;
// on the ground with the treasure maps' glints: over the meadow's flowers
// (4), under footprint dust, the hero and every tag
const SHARD_DEPTH = 4.5;
const BREATH_MS = 1600;

/**
 * A field's star shards (shards.ts): each one not yet taken lies on its cell,
 * breathing in its alpha (it was hidden past 2.5 tiles at first: a thing to
 * collect nobody knew was there); walking onto it takes it, with a toast of
 * how many of the field's three are held, the third's toast says what the
 * whole star gave, and the twelfth's adds the STARFALL. `found` runs after one is
 * taken, for the scene to hold off its fights while the toast is read.
 */
export class StarShards {
  constructor(scene: Phaser.Scene, region: ShardRegion, hero: { x: number; y: number }, opts: { found?: () => void } = {}) {
    if (!scene.textures.exists(SHARD_KEY)) makeTexture(scene, SHARD_KEY, SHARD, SHARD_PALETTE, ART_PX);
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const left = shardSpots(region)
      .filter((s) => !GameState.shards.includes(s.id))
      .map((s) => ({ ...s, image: scene.add.image(s.x, s.y, SHARD_KEY).setDepth(SHARD_DEPTH) }));
    if (left.length === 0) return;
    const onUpdate = (time: number): void => {
      const breath = calm ? 1 : 0.7 + 0.3 * Math.sin((time / BREATH_MS) * Math.PI * 2);
      for (let i = left.length - 1; i >= 0; i--) {
        const s = left[i];
        const d = Math.hypot(s.x - hero.x, s.y - hero.y);
        if (d <= TAKE_RADIUS) {
          const got = takeShard(GameState, region, s.id);
          left.splice(i, 1);
          scene.tweens.add({ targets: s.image, y: s.y - 40, alpha: 0, duration: 500, onComplete: () => s.image.destroy() });
          if (!got) continue;
          Sfx.pickup();
          // news (the "!"); before the save, so its "SAVED" queues behind
          // the longest, "VOLCANO STAR WHOLE! MAX HP +5, 2 MAGMA CORE, CANDY", is
          // 49 glyphs, 980px of the toast's 1200
          showToast(
            scene,
            got.whole
              ? `${SHARD_REGION_NAMES[region]} STAR WHOLE! MAX HP +${STAR_MAX_HP}, ${STAR_MATERIALS} ${MATERIALS[STAR_MATERIAL[region]].name}, CANDY`
              : `STAR SHARD ${got.have}/${SHARDS_PER_REGION}!`,
            FIELD_TOAST_Y,
          );
          if (got.all) showToast(scene, `STARFALL! ALL 12 SHARDS: ATK +${STARFALL_ATK} DEF +${STARFALL_DEF}`, FIELD_TOAST_Y);
          if (got.whole) Sfx.levelup();
          GameState.save();
          opts.found?.();
          continue;
        }
        s.image.setAlpha(breath);
      }
    };
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, onUpdate));
  }
}
