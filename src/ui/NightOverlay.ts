import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, PIXEL } from "../config";
import { GameState, nightFactor } from "../gameState";
import { TILE } from "../levels";

// One night look shared by every scene. Before this, the overworld faded a
// 0x1a1a4a wash in and out with the clock while the cave and the forest sat
// under a fixed 0x0a0a2a that ignored the time of day entirely.
export const NIGHT_TINT = 0x1a1a4a;

// How dark full night gets on open ground. Enclosed scenes pass a smaller
// range and carry a constant `ambient` instead, so their own gloom stays but
// dusk and dawn still read the same way everywhere.
export const NIGHT_RANGE = 0.45;

// Encounters get riskier after dark by the same factor in every scene.
export const NIGHT_ENCOUNTER_MULT = 1.8;

// The sky's colour through the day, under the night's darkness: [hour,
// colour, alpha], interpolated in between, nothing outside 05:00..20:00 (the
// night alone) or across 07:00..18:00 (clear daylight, as before). Dusk goes
// gold, orange, rose, purple and hands over to the night's navy as the dark
// comes up at 19:30..20:00; dawn comes up pink under the last of the night
// and leaves gold. A colour stop at alpha 0 repeats its neighbour, so the hue
// never drifts through grey while it fades. Alpha peaks at 0.22, half the
// night's 0.45: a uniform overlay scales every difference between two pixels
// by 1 - alpha whatever its colour, so an orange WASP on orange dusk keeps
// more contrast than it has at night.
type SkyStop = readonly [hour: number, color: number, alpha: number];
const OPEN_SKY: readonly SkyStop[] = [
  [5.0, 0x6a3a8a, 0],
  [5.5, 0xa0507f, 0.14],
  [6.0, 0xff8a9a, 0.16],
  [6.5, 0xffc060, 0.1],
  [7.0, 0xffc060, 0],
  [18.0, 0xffb040, 0],
  [18.5, 0xff7a30, 0.16],
  [19.0, 0xe0506a, 0.2],
  [19.5, 0x7a3c9a, 0.22],
  [20.0, 0x7a3c9a, 0],
];
// The crater's sky through its ash: the same hours pulled red, so sunset
// reads as the smog catching fire rather than a pastel sky over lava.
const EMBER_SKY: readonly SkyStop[] = [
  [5.0, 0x5a1a3a, 0],
  [5.5, 0x8a2a40, 0.14],
  [6.0, 0xe0603a, 0.16],
  [6.5, 0xf09040, 0.1],
  [7.0, 0xf09040, 0],
  [18.0, 0xf08a3a, 0],
  [18.5, 0xe04a2a, 0.18],
  [19.0, 0xa02434, 0.2],
  [19.5, 0x5a1a40, 0.22],
  [20.0, 0x5a1a40, 0],
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

function skyAt(stops: readonly SkyStop[], h: number): { color: number; alpha: number } {
  for (let i = 0; i + 1 < stops.length; i++) {
    const [h0, c0, a0] = stops[i];
    const [h1, c1, a1] = stops[i + 1];
    if (h >= h0 && h < h1) {
      const t = (h - h0) / (h1 - h0);
      return { color: mix(c0, c1, t), alpha: a0 + (a1 - a0) * t };
    }
  }
  return { color: NIGHT_TINT, alpha: 0 };
}

const clockHour = (): number => (GameState.minutes / 60) % 24;

// The sky's colour under the night's navy (`gloom` alpha), flattened into one
// rectangle: the two layers' combined alpha, and the colour weighted by what
// each one contributes.
function overlayAt(sceneKey: string, h: number, gloom: number): { color: number; alpha: number } {
  const sky = SKY_BY_SCENE[sceneKey];
  const { color, alpha: skyAlpha } = sky ? skyAt(sky.stops, h) : { color: NIGHT_TINT, alpha: 0 };
  const tint = skyAlpha * (sky?.strength ?? 0);
  const alpha = 1 - (1 - tint) * (1 - gloom);
  return { color: alpha > 0 ? mix(color, NIGHT_TINT, gloom / alpha) : NIGHT_TINT, alpha };
}

/**
 * The open-ground overlay over `sceneKey`'s sky right now: transparent by day,
 * NIGHT_TINT at NIGHT_RANGE by night, the scene's dawn or dusk in between.
 * For the battle screen's backdrop, so a fight picks up the sky of the field
 * it started in.
 */
export function skyOverlay(sceneKey: string): { color: number; alpha: number } {
  const h = clockHour();
  return overlayAt(sceneKey, h, darkness(h) * NIGHT_RANGE);
}

// A lamp someone lights (NightLight.lamp) comes up across late dusk,
// 19:00..20:00, ahead of the dark's own 19:30..20:00, and goes out with it
// at dawn.
function lampLevel(h: number, dark: number): number {
  return h >= 19 && h < 20 ? Math.max(dark, h - 19) : dark;
}

// Lights (addLights) draw just over the overlay so they shine through the dark
// instead of being dimmed with everything else, and under Ambient's fireflies
// and embers (90.5) and the area title (95).
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
    this.range = range;
    this.rect = scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, NIGHT_TINT, 1)
      .setScrollFactor(0)
      .setDepth(90)
      .setAlpha(ambient);
  }

  // Call every frame; the dark ramps across dusk and dawn and the sky's colour
  // is interpolated, so this is a fade rather than a switch. Returns
  // nightFactor() for the callers that time their own night things by it.
  update(): number {
    const h = clockHour();
    const gloom = this.ambient + darkness(h) * this.range;
    const { color, alpha } = overlayAt(this.scene.sys.settings.key, h, gloom);
    this.rect.setFillStyle(color).setAlpha(alpha);
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
