import Phaser from "phaser";
import { type Region, weatherToday } from "../weather";
import { addLightning, addOvercast, bakeSheet, rainParticles, SHEET, WEATHER_PARTICLES } from "./Ambient";

export type BattleOrigin = "Town" | "Forest" | "Snow" | "Dungeon" | "Volcano";

const REGION: Record<BattleOrigin, Region> = {
  Town: "town",
  Forest: "forest",
  Snow: "snow",
  Dungeon: "dungeon",
  Volcano: "volcano",
};

// The battle backdrops' ground line (battle-bg-*: sky above, ground below):
// rain only splashes on the ground, not in the sky.
const GROUND_Y = 440;
// Simulated up front, as on the field, so the weather is already falling when
// the battle screen appears.
const PREWARM_MS = 8000;
// Fainter than the field's 0.12: here the flash sits behind the fighters and
// the numbers they throw, and is only the sky lighting up.
const LIGHTNING_PEAK = 0.07;

type WeatherObject = Phaser.GameObjects.Rectangle | Phaser.GameObjects.Particles.ParticleEmitter;

/**
 * Carries the weather of the region a battle started in (weather.ts) onto the
 * battle screen: rain or a storm, snow or a blizzard, or ashfall, over the
 * backdrop. Nothing for clear days or the cave.
 *
 * Everything here is put in the display list right after the backdrop image,
 * at the backdrop's depth (0), wherever in create() this is called. Every
 * sprite, window, menu, message, status tag and damage number BattleScene adds
 * shares that depth and draws in the order added, so they all stay on top;
 * its night shade is added right after this (also depth 0), so a night storm
 * darkens along with the backdrop while the fighters and windows don't.
 * The sky tints (clouds, whiteout, smog) are under the fighters as well, so
 * only the backdrop dims and the sprites keep their contrast.
 *
 * The weather sound beds stay off in battle (Ambient's field scene fades them
 * out on shutdown): the battle has its own music, and the storm's thunder
 * would land on the hit sounds.
 */
export function addBattleWeather(scene: Phaser.Scene, origin: BattleOrigin): void {
  const weather = weatherToday(REGION[origin]);
  if (weather === "clear" || weather === "none") return;
  bakeSheet(scene);
  // bottom to top
  const objects: WeatherObject[] = [];
  const particles = (config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig): Phaser.GameObjects.Particles.ParticleEmitter => {
    const emitter = scene.add.particles(0, 0, SHEET, config);
    objects.push(emitter);
    return emitter;
  };
  const sky = (color: number, alpha: number): void => {
    objects.push(addOvercast(scene, color).setAlpha(alpha));
  };

  if (weather === "rain" || weather === "storm") {
    const storm = weather === "storm";
    sky(0x1c2433, storm ? 0.2 : 0.12);
    const flash = storm ? addLightning(scene, () => true, { peak: LIGHTNING_PEAK, thunder: false }) : null;
    if (flash) objects.push(flash);
    // a plain rainy day falls at half the storm's density, as on the field;
    // dark streaks over a winter backdrop's snow, as on the field
    const rain = rainParticles(REGION[origin]);
    const drops = particles({ ...rain.rain, frequency: WEATHER_PARTICLES.rain.frequency * (storm ? 1 : 2) });
    const splash = particles(rain.splash);
    drops.onParticleDeath((p: Phaser.GameObjects.Particles.Particle) => {
      if (!drops.skipping && p.y > GROUND_Y && Math.random() < 0.4) splash.emitParticleAt(p.x, p.y, 1);
    });
  } else if (weather === "snow" || weather === "blizzard") {
    const blizzard = weather === "blizzard";
    if (blizzard) sky(0xe6eef7, 0.12);
    // No camera and no gust loop here: a blizzard's wind is baked into the
    // flakes' own sideways speed, and its streaks fly with it.
    particles(
      blizzard
        ? { ...WEATHER_PARTICLES.flakes, speedX: { min: -170, max: -90 }, frequency: 44, maxAliveParticles: 200 }
        : WEATHER_PARTICLES.flakes,
    );
    if (blizzard) particles({ ...WEATHER_PARTICLES.streaks, speedX: { min: -720, max: -520 }, frequency: 70 });
  } else if (weather === "ashfall") {
    sky(0x2a2020, 0.16);
    particles(WEATHER_PARTICLES.ashfall);
  }

  for (const o of objects) if (o instanceof Phaser.GameObjects.Particles.ParticleEmitter && o.emitting) o.fastForward(PREWARM_MS);
  const backdrop = scene.children.list.find((o) => o instanceof Phaser.GameObjects.Image && o.texture.key.startsWith("battle-bg-"));
  // no backdrop yet: the bottom of the list, under whatever comes next
  const base = backdrop ? scene.children.getIndex(backdrop) + 1 : 0;
  objects.forEach((o, i) => {
    o.setDepth(0);
    scene.children.moveTo(o, base + i);
  });
}
