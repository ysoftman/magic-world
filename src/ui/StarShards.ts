import Phaser from "phaser";
import { Sfx } from "../audio";
import { MATERIALS } from "../drops";
import { GameState } from "../gameState";
import { TILE } from "../levels";
import { omenShardReach } from "../omen";
import { ART_PX, FIELD_TOAST_Y, makeTexture, showToast } from "../pixelart";
import { seasonLook } from "../season";
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
// On the snow field's pale ground that splinter was white on white, only its
// rim to read it by: there it is the same shape three steps darker, a deep
// blue glass with one pale edge. The winter forest lies under the same snow
// (its map skin is the snow field's), so it takes the same.
const SNOW_SHARD_KEY = "star-shard-snow";
const SNOW_SHARD_PALETTE = { k: 0x0b1440, w: 0xb8dcff, c: 0x5b8fe0, b: 0x2f55b0, d: 0x1e3a8a };
// Found by walking near: nothing past SEEN, full a tile inside it. (Shown
// always, for one commit, the corners gave them away from across the map.)
const SEEN = 3 * TILE;
// taken by walking onto its cell
const TAKE_RADIUS = 36;
// on the ground with the treasure maps' glints: over the meadow's flowers
// (4), under footprint dust, the hero and every tag
const SHARD_DEPTH = 4.5;
const BREATH_MS = 1600;

// The hint: within SENSE of a shard still lying and not yet in sight, a mote
// of its light drifts out from the hero towards it and a soft ping sounds
// (sfxKit's "shard:near"), the oftener and louder the nearer. It says which
// way and roughly how far, never the cell: the shard itself still shows only
// inside SEEN, so it is still found by looking. SENSE is twice SEEN, about
// half the view (10 tiles to either side, 5.6 up and down), so it only ever
// speaks of a shard already on or just off the screen; on a CALM DAY it
// reaches OMEN_CALM_SHARD_REACH as far (9 tiles), still inside its width.
// Not a mark that stays: shown always (one commit) the corners gave the
// shards away from across the map.
const SENSE = 6 * TILE;
// it stops once the shard is half in sight (its alpha 0.5, as `near` below)
const HINT_UNTIL = SEEN - TILE / 2;
// a ping each PING_NEAR_MS at SEEN, PING_PER_TILE_MS longer each tile
// further: 2s at SENSE, 3.3s at a CALM DAY's 9 tiles. The cadence is by
// distance alone, so it means the same on a calm day; the first comes as
// soon as the shard is in reach (the hero crosses 3 tiles in 0.8s).
const PING_NEAR_MS = 700;
const PING_PER_TILE_MS = 430;
// it answers walking: a hero standing still this long gets no more pings
// (the one in flight drifts out) till it moves again. Many a field's spot
// lies within SENSE of a shard (the volcano's way in 5 tiles off one, the
// forest's shrine 4.5, the volcano's nest 3), and a hero left standing there
// would have pinged every second or two for as long as the game was open.
// Two or three pings at a stop, still enough to stand and listen to.
const STILL_MS = 3000;
// louder nearer: 1 at SEEN, 0.12 less each tile, 0.5 at the least (-4dB at
// SENSE, -6dB from 7 tiles on)
const PING_VOL_PER_TILE = 0.12;
const PING_VOL_MIN = 0.5;
// the mote: out from MOTE_FROM to MOTE_TO px off the hero's centre (round
// the guide arrow's 56, just clear of the 64px hero), fading in and out
// over MOTE_MS, following the hero as it walks; a twinkle, the small frame
// at either end and the four-point one between
const MOTE_MS = 650;
const MOTE_FROM = 44;
const MOTE_TO = 92;
const MOTE_ALPHA = 0.85;
// over the hero and the NPCs (10) and just under the guide arrow (10.5),
// under every tag (11) like the arrow, and under the night shade (90) too,
// so it dims with the map after dark: white on the dark night ground it still
// reads, where over the shade it would glow brighter than the shard it
// points to
const MOTE_DEPTH = 10.45;
const MOTE_KEY = "star-mote";
const SNOW_MOTE_KEY = "star-mote-snow";
// 9x9 cells, 18px; the small frame is the same size, so it twinkles in place
// biome-ignore format: one row per line so the art reads as a grid
const MOTE = [
  "....b....",
  "....c....",
  "....w....",
  "...cwc...",
  "bcwwwwwcb",
  "...cwc...",
  "....w....",
  "....c....",
  "....b....",
];
// biome-ignore format: as above
const MOTE_SMALL = [
  ".........",
  ".........",
  ".........",
  "....c....",
  "...cwc...",
  "....c....",
  ".........",
  ".........",
  ".........",
];
// the shard's own light, white to its pale blue; on snow, where no light
// reads, its deep blue glass, the darkest at the heart (the snow shard's rim)
const MOTE_PALETTE = { w: 0xffffff, c: 0xd6f0ff, b: 0x8ecbff };
const SNOW_MOTE_PALETTE = { w: 0x0b1440, c: 0x1e3a8a, b: 0x2f55b0 };

/**
 * A field's star shards (shards.ts): each one not yet taken lies on its cell,
 * unseen until the hero is within SEEN and breathing in its alpha (the quest
 * journal says how many each field still holds); walking onto it takes it, with a toast of
 * how many of the field's three are held, the third's toast says what the
 * whole star gave, and the twelfth's adds the STARFALL. Nearer than SENSE and
 * not yet in sight, the nearest gives its hint (above). `found` runs after one is
 * taken, for the scene to hold off its fights while the toast is read;
 * `blocked` (a panel, a dialogue or a prompt up, the scene on its way out)
 * holds the hint.
 */
export class StarShards {
  constructor(
    scene: Phaser.Scene,
    region: ShardRegion,
    hero: { x: number; y: number },
    opts: { found?: () => void; blocked?: () => boolean } = {},
  ) {
    if (!scene.textures.exists(SHARD_KEY)) {
      makeTexture(scene, SHARD_KEY, SHARD, SHARD_PALETTE, ART_PX);
      makeTexture(scene, SNOW_SHARD_KEY, SHARD, SNOW_SHARD_PALETTE, ART_PX);
      makeTexture(scene, MOTE_KEY, MOTE, MOTE_PALETTE, ART_PX);
      makeTexture(scene, `${MOTE_KEY}-small`, MOTE_SMALL, MOTE_PALETTE, ART_PX);
      makeTexture(scene, SNOW_MOTE_KEY, MOTE, SNOW_MOTE_PALETTE, ART_PX);
      makeTexture(scene, `${SNOW_MOTE_KEY}-small`, MOTE_SMALL, SNOW_MOTE_PALETTE, ART_PX);
    }
    // the season is read once, as the map skin is: the forest is built again when it turns
    const snowy = region === "snow" || seasonLook(region) === "winter";
    const key = snowy ? SNOW_SHARD_KEY : SHARD_KEY;
    const moteKey = snowy ? SNOW_MOTE_KEY : MOTE_KEY;
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const left = shardSpots(region)
      .filter((s) => !GameState.shards.includes(s.id))
      .map((s) => ({ ...s, image: scene.add.image(s.x, s.y, key).setDepth(SHARD_DEPTH).setVisible(false) }));
    if (left.length === 0) return;
    const mote = scene.add.image(0, 0, moteKey).setDepth(MOTE_DEPTH).setVisible(false);
    // scene time of the last ping, and the way its mote drifts; when and
    // where the hero last moved
    let pinged = Number.NEGATIVE_INFINITY;
    let angle = 0;
    let movedAt = Number.NEGATIVE_INFINITY;
    let lastX = hero.x;
    let lastY = hero.y;
    const hint = (time: number): void => {
      if (hero.x !== lastX || hero.y !== lastY) {
        movedAt = time;
        lastX = hero.x;
        lastY = hero.y;
      }
      const blocked = opts.blocked?.() ?? false;
      let d = Number.POSITIVE_INFINITY;
      let to: (typeof left)[number] | null = null;
      if (!blocked)
        for (const s of left) {
          const sd = Math.hypot(s.x - hero.x, s.y - hero.y);
          if (sd < d) {
            d = sd;
            to = s;
          }
        }
      if (to && d >= HINT_UNTIL && d <= SENSE * omenShardReach()) {
        angle = Math.atan2(to.y - hero.y, to.x - hero.x);
        const tiles = Math.max(0, d - SEEN) / TILE;
        if (time - pinged >= PING_NEAR_MS + tiles * PING_PER_TILE_MS && time - movedAt < STILL_MS) {
          pinged = time;
          Sfx.emit("shard:near", { vol: Math.max(PING_VOL_MIN, 1 - tiles * PING_VOL_PER_TILE) });
        }
      } else if (blocked) {
        // a panel up or the way out: the mote in flight goes too (out of
        // reach, in sight or taken, it drifts out its last 650ms)
        pinged = Math.min(pinged, time - MOTE_MS);
      }
      const t = (time - pinged) / MOTE_MS;
      if (t >= 1) {
        mote.setVisible(false);
        return;
      }
      const r = calm ? (MOTE_FROM + MOTE_TO) / 2 : MOTE_FROM + (MOTE_TO - MOTE_FROM) * Math.sin((t * Math.PI) / 2);
      mote
        .setVisible(true)
        .setTexture(calm || (t > 0.25 && t < 0.75) ? moteKey : `${moteKey}-small`)
        .setPosition(Math.round(hero.x + Math.cos(angle) * r), Math.round(hero.y + Math.sin(angle) * r))
        .setAlpha(MOTE_ALPHA * Math.sin(t * Math.PI));
    };
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
        const near = Phaser.Math.Clamp((SEEN - d) / TILE, 0, 1);
        s.image.setVisible(near > 0).setAlpha(near * breath);
      }
      hint(time);
    };
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, onUpdate));
  }
}
