import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, PIXEL } from "../config";
import { GameState, nightFactor } from "../gameState";
import { TILE } from "../levels";
import { seasonLook } from "../season";

// One night look shared by every scene. Before this, the overworld faded a
// 0x1a1a4a wash in and out with the clock while the cave and the forest sat
// under a fixed 0x0a0a2a that ignored the time of day entirely.
//
// The night is one MULTIPLY-blended rectangle: each channel of what's under it
// scaled by the rectangle's colour. It used to be that navy laid on at 0.45
// (NORMAL blend), which also lifted every dark pixel toward the navy, so an
// outline, an eye or a name tag's stroke greyed out and the hero went flat on
// the grass (skin 2.88:1 against it, the tunic 1.41). A multiply darkens
// without the haze, so what was darker stays darker: at the same grass
// brightness skin is 3.58:1, the tunic 1.73 (1.75 by day), a name tag
// 1.4-1.5x its old contrast with its stroke.
const WHITE = 0xffffff;

// Full night on open ground: the cast at a gloom of NIGHT_RANGE, chosen so
// the grass ends up as bright as under the old navy. Blue over green over
// red, as moonlight, but no more blue than 1.3x the green: past that the
// red and blue left in a face outweigh its green and skin turns mauve (the
// first try, 0x9ea8ff, did). Here skin is a warm grey (hue 12) and white a
// pale steel blue.
const NIGHT_CAST = 0xa1b5eb;

// How dark full night gets on open ground, as `gloom`. Enclosed scenes pass a
// smaller range and carry a constant `ambient` instead, so their own gloom
// stays but dusk and dawn still read the same way everywhere. Up to it the
// cast comes up linearly from white; past it (the forest's 0.55, the cave's
// 0.6, the snow field's 0.75 with SNOW_EXTRA_GLOOM) the cast only dims,
// keeping its hue, by DEEP_DIM per unit of gloom: about as dark as the old
// navy, a shade lighter at the deepest, where every extra step of darkness
// costs the fighters more contrast (the cave's skin is 3.2:1 to the old 2.19).
export const NIGHT_RANGE = 0.45;
const DEEP_DIM = 0.7;

// Light ground and open sky keep more of their brightness under a multiply
// than they did under the old navy, which pulled the brightest pixels down
// the most: matched on the grass, snow (the snow field, the town in winter)
// and the town's battle sky came out 1.2-1.5x as bright as before at night,
// nearer a blue evening than night. They take this much more gloom at full
// night, which brings them back to about their old brightness.
const SNOW_EXTRA_GLOOM = 0.2;
const SKY_EXTRA_GLOOM = 0.15;
const snowy = (sceneKey: string): boolean => sceneKey === "Snow" || seasonLook(sceneKey.toLowerCase()) === "winter";

// Encounters get riskier after dark by the same factor in every scene.
export const NIGHT_ENCOUNTER_MULT = 1.8;

// The sky through the day, multiplied in with the night's cast: [hour,
// factor], interpolated in between, white (nothing) outside 05:00..20:00 (the
// night alone) or across 07:00..18:00 (clear daylight). Dusk goes gold,
// orange, rose, purple and hands over to the night's cast as the dark comes
// up at 19:30..20:00; dawn comes up pink under the last of the night and
// leaves gold. Every factor keeps green over blue or red over green, so a
// face stays warm (hue 8..31) at every hour, and each takes off a little more
// than the one before it toward the night: a mid-grey keeps 90% at 18:15,
// 72% at 19:00, 60% at 19:30, 49% under the night's cast, never darker than
// the night it hands over to. The old NORMAL wash's pinks and purples, made
// into factors, took so much green off that 19:15 came out nearly as dark as
// the night, and the dawn's purple under the night's cast turned faces mauve.
type SkyStop = readonly [hour: number, factor: number];
const OPEN_SKY: readonly SkyStop[] = [
  [5.0, WHITE],
  [5.5, 0xfff0f0],
  [6.0, 0xffd8dc],
  [6.5, 0xfff0d4],
  [7.0, WHITE],
  [18.0, WHITE],
  [18.5, 0xffe4c4],
  [19.0, 0xffcfcf],
  [19.5, 0xdcc0e6],
  [20.0, WHITE],
];
// The crater's sky through its ash: the same hours pulled red, so sunset
// reads as the smog catching fire rather than a pastel sky over lava.
const EMBER_SKY: readonly SkyStop[] = [
  [5.0, WHITE],
  [5.5, 0xfff0e8],
  [6.0, 0xffd0bc],
  [6.5, 0xffe0bc],
  [7.0, WHITE],
  [18.0, WHITE],
  [18.5, 0xffd4b8],
  [19.0, 0xf8bcb0],
  [19.5, 0xd8b4c4],
  [20.0, WHITE],
];
// Which scenes see the sky, and how much of it. The cave has none and keeps
// the plain night; the forest sees it through the canopy, a little fainter.
const SKY_BY_SCENE: Record<string, { stops: readonly SkyStop[]; strength: number }> = {
  Town: { stops: OPEN_SKY, strength: 1 },
  Snow: { stops: OPEN_SKY, strength: 1 },
  Forest: { stops: OPEN_SKY, strength: 0.8 },
  Volcano: { stops: EMBER_SKY, strength: 1 },
};

// nightFactor()'s ramps (05:30..06:00 and 19:30..20:00) on the unrounded
// clock: nightFactor() reads whole minutes, which at TIME SPEED 20 steps the
// dark every third frame
function darkness(h: number): number {
  if (h >= 6 && h < 19.5) return 0;
  if (h >= 20 || h < 5.5) return 1;
  return h < 6 ? (6 - h) / 0.5 : (h - 19.5) / 0.5;
}

function mix(a: number, b: number, t: number): number {
  const ch = (shift: number): number => Math.round(((a >> shift) & 0xff) * (1 - t) + ((b >> shift) & 0xff) * t) << shift;
  return ch(16) | ch(8) | ch(0);
}

function multiply(a: number, b: number): number {
  const ch = (shift: number): number => Math.round((((a >> shift) & 0xff) * ((b >> shift) & 0xff)) / 255) << shift;
  return ch(16) | ch(8) | ch(0);
}

function skyAt(stops: readonly SkyStop[], h: number): number {
  for (let i = 0; i + 1 < stops.length; i++) {
    const [h0, c0] = stops[i];
    const [h1, c1] = stops[i + 1];
    if (h >= h0 && h < h1) return mix(c0, c1, (h - h0) / (h1 - h0));
  }
  return WHITE;
}

// the night's multiply factor at `gloom` (see NIGHT_RANGE)
function nightCast(gloom: number): number {
  if (gloom <= NIGHT_RANGE) return mix(WHITE, NIGHT_CAST, gloom / NIGHT_RANGE);
  return multiply(NIGHT_CAST, mix(0, WHITE, 1 - DEEP_DIM * (gloom - NIGHT_RANGE)));
}

const clockHour = (): number => (GameState.minutes / 60) % 24;

// The sky's tint times the night's cast: two multiplies are one, so a single
// rectangle carries both.
function overlayAt(sceneKey: string, h: number, gloom: number): number {
  const sky = SKY_BY_SCENE[sceneKey];
  return multiply(sky ? mix(WHITE, skyAt(sky.stops, h), sky.strength) : WHITE, nightCast(gloom));
}

/**
 * The open-ground MULTIPLY factor over `sceneKey`'s sky right now: white (no
 * change) by day, NIGHT_CAST by night, the scene's dawn or dusk in between.
 * For the battle screen's backdrop, so a fight picks up the sky of the field
 * it started in.
 */
export function skyOverlay(sceneKey: string): number {
  const h = clockHour();
  const extra = snowy(sceneKey) ? SNOW_EXTRA_GLOOM : sceneKey === "Town" ? SKY_EXTRA_GLOOM : 0;
  return overlayAt(sceneKey, h, darkness(h) * (NIGHT_RANGE + extra));
}

// A lamp someone lights (NightLight.lamp) comes up across late dusk,
// 19:00..20:00, ahead of the dark's own 19:30..20:00, and goes out with it
// at dawn.
function lampLevel(h: number, dark: number): number {
  return h >= 19 && h < 20 ? Math.max(dark, h - 19) : dark;
}

// Lights (addLights) draw just over the overlay so they shine through the dark
// instead of being dimmed with everything else, and under Ambient's fireflies
// and embers (90.5) and the area title (95). ADD over the multiply: a glow
// lifts what the night took off, the windows' and the lava's colour with it.
const LIGHT_DEPTH = 90.4;
// The swell of a pulsing light: slow and shallow, a glow breathing rather
// than anything that reads as a flicker or a flash.
const PULSE_SWING = 0.12;

/** A soft glow in world space that comes up as the scene gets dark. */
export interface NightLight {
  x: number;
  y: number;
  /** glow radius in px; snapped to the PIXEL grid */
  radius: number;
  color: number;
  /** alpha at full darkness */
  strength: number;
  /** ms for one slow swell; leave out for a steady light */
  pulseMs?: number;
  /** lit by someone (a window), so on before full dark; see lampLevel */
  lamp?: boolean;
}

/**
 * One light per `block` x `block` patch of tiles holding any of `ids`, at the
 * centroid of those tiles, instead of one per tile: a lava field is dozens of
 * tiles, and overlapping ADD glows would also stack into a white-hot blob.
 */
export function lightsOverTiles(
  level: readonly (readonly number[])[],
  ids: ReadonlySet<number>,
  light: Omit<NightLight, "x" | "y">,
  block = 3,
): NightLight[] {
  const lights: NightLight[] = [];
  for (let by = 0; by < level.length; by += block) {
    for (let bx = 0; bx < (level[0]?.length ?? 0); bx += block) {
      let n = 0;
      let sx = 0;
      let sy = 0;
      for (let y = by; y < by + block; y++)
        for (let x = bx; x < bx + block; x++)
          if (ids.has(level[y]?.[x] ?? -1)) {
            n++;
            sx += x;
            sy += y;
          }
      if (n > 0) lights.push({ ...light, x: (sx / n + 0.5) * TILE, y: (sy / n + 0.5) * TILE });
    }
  }
  return lights;
}

export class NightOverlay {
  private rect: Phaser.GameObjects.Rectangle;
  private ambient: number;
  private range: number;
  private scene: Phaser.Scene;
  private lights: Array<{ img: Phaser.GameObjects.Image; strength: number; pulseMs?: number; lamp?: boolean; phase: number }> = [];

  constructor(scene: Phaser.Scene, ambient = 0, range = NIGHT_RANGE) {
    this.scene = scene;
    this.ambient = ambient;
    this.range = range + (snowy(scene.sys.settings.key) ? SNOW_EXTRA_GLOOM : 0);
    this.rect = scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, nightCast(ambient))
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setScrollFactor(0)
      .setDepth(90);
  }

  // Call every frame; the dark ramps across dusk and dawn and the sky's colour
  // is interpolated, so this is a fade rather than a switch. Returns
  // nightFactor() for the callers that time their own night things by it.
  update(): number {
    const h = clockHour();
    const gloom = this.ambient + darkness(h) * this.range;
    const color = overlayAt(this.scene.sys.settings.key, h, gloom);
    this.rect.setFillStyle(color).setVisible(color !== WHITE);
    // Lights follow this overlay's own darkness, not the clock alone, and not
    // the sky: outdoors that's the night's ramp, while the always-dim cave
    // and crater keep a standing glow that grows after dark. Lamps come on a
    // little ahead of it.
    const dark = gloom / (this.ambient + this.range);
    const now = this.scene.time.now;
    for (const l of this.lights) {
      const swell = l.pulseMs ? 1 + PULSE_SWING * Math.sin((now / l.pulseMs) * Math.PI * 2 + l.phase) : 1;
      l.img.setAlpha(l.strength * (l.lamp ? lampLevel(h, dark) : dark) * swell);
    }
    return nightFactor();
  }

  /**
   * Adds glows that come up with the dark: ADD-blended over this overlay so a
   * lit window or a lava pool actually shines at night. Returns the images so
   * a caller can move them with what they belong to (the map editor's house).
   */
  addLights(lights: readonly NightLight[]): Phaser.GameObjects.Image[] {
    return lights.map((l) => {
      const img = this.scene.add
        .image(l.x, l.y, glowTexture(this.scene, Math.max(1, Math.round(l.radius / PIXEL))))
        .setTint(l.color)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(LIGHT_DEPTH)
        .setAlpha(0);
      // out of step with each other, so a whole field never breathes as one
      this.lights.push({ img, strength: l.strength, pulseMs: l.pulseMs, lamp: l.lamp, phase: Math.random() * Math.PI * 2 });
      return img;
    });
  }

  destroy(): void {
    this.rect.destroy();
    for (const l of this.lights) l.img.destroy();
    this.lights = [];
  }
}

// A white radial glow `cells` art pixels in radius, baked once per size: falloff
// in sixteenths, one half-PIXEL (2px) square at a time, so it stays stepped
// pixel art rather than a smooth gradient, but rounder than the 4px world it
// lights. Steep and rounded down at the rim, so the outermost step is faint
// enough not to read as the edge of a disc. Tinted per light.
const GLOW_STEPS = 16;
const GLOW_PX = PIXEL / 2;
function glowTexture(scene: Phaser.Scene, cells: number): string {
  const key = `night-glow-${cells}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.add.graphics();
  const n = (cells * PIXEL) / GLOW_PX;
  for (let y = 0; y < n * 2; y++) {
    for (let x = 0; x < n * 2; x++) {
      const d = Math.hypot(x + 0.5 - n, y + 0.5 - n) / n;
      if (d >= 1) continue;
      const a = Math.round((1 - d) ** 2.2 * GLOW_STEPS) / GLOW_STEPS;
      if (a <= 0) continue;
      g.fillStyle(0xffffff, a);
      g.fillRect(x * GLOW_PX, y * GLOW_PX, GLOW_PX, GLOW_PX);
    }
  }
  g.generateTexture(key, cells * 2 * PIXEL, cells * 2 * PIXEL);
  g.destroy();
  return key;
}
