import Phaser from "phaser";
import * as parry from "pixelfx/fx/impacts/parry";
import * as collectBurst from "pixelfx/fx/pickups/collect-burst";
import { bakePixelSheet, type PixelSheet, sheetInfo, spanOf, warmSheets } from "../fx";

// The field's moments as pixelfx sheets (github:patch-gg/pixelfx, MIT, baked
// as fx.ts bakes the battle's): a treasure dig's soil and chest (TreasureDig.ts),
// the fishing pond's rings and splash (Fishing.ts) and the town's panels' wins
// (PanelFx, below), each a sheet played as a Phaser animation of `ms`, once or
// over and over.

/** A sheet, the texture and animation it makes (`key`) and how it plays. */
export interface FieldFx {
  key: string;
  sheet: PixelSheet;
  /** one run of its frames, in ms */
  ms: number;
  /** over and over, until stopped */
  loop?: boolean;
}

/** `fx`'s sheets by key, for a warm-up queue (fx.ts warmSheets). */
export function fieldFxSheets(...fx: FieldFx[]): Record<string, PixelSheet> {
  const sheets: Record<string, PixelSheet> = {};
  for (const f of fx) sheets[f.key] = f.sheet;
  return sheets;
}

/**
 * Bakes `fx` a slice of each of `scene`'s frames from now (warmSheets), so a
 * scene that may play them has them before it does: a create that baked the
 * pond's sheets there and then took the town's first frame to 172ms.
 */
export function warmFieldFx(scene: Phaser.Scene, ...fx: FieldFx[]): void {
  warmSheets(scene, fieldFxSheets(...fx));
}

// The animation, made the first time, the game's from then on like its
// texture; the sheet baked here and now if no warm-up has got to it yet.
function animOf(scene: Phaser.Scene, fx: FieldFx): string {
  bakePixelSheet(scene, fx.key, fx.sheet);
  if (!scene.anims.exists(fx.key))
    scene.anims.create({
      key: fx.key,
      frames: Array.from({ length: spanOf(fx.sheet).frames }, (_, frame) => ({ key: fx.key, frame })),
      duration: fx.ms,
      repeat: fx.loop ? -1 : 0,
    });
  return fx.key;
}

/**
 * A hidden sprite for `fx` with its anchor on (x, y), at `scale` screen px a
 * pixelfx pixel. It needs no texture yet (Phaser's blank one): playFieldFx
 * puts the sheet's frames on it.
 */
export function fieldFxSprite(scene: Phaser.Scene, fx: FieldFx, x: number, y: number, scale: number): Phaser.GameObjects.Sprite {
  return scene.add
    .sprite(x, y, "__DEFAULT")
    .setOrigin(...sheetInfo(fx.sheet).origin)
    .setScale(scale)
    .setVisible(false);
}

/** Shows `sprite` playing `fx` from its first frame. */
export function playFieldFx(sprite: Phaser.GameObjects.Sprite, fx: FieldFx): Phaser.GameObjects.Sprite {
  return sprite.setVisible(true).play(animOf(sprite.scene, fx));
}

/** One play of `fx` with its anchor on (x, y), gone when done. */
export function playFieldFxOnce(
  scene: Phaser.Scene,
  fx: FieldFx,
  x: number,
  y: number,
  scale: number,
  depth: number,
): Phaser.GameObjects.Sprite {
  const sprite = playFieldFx(fieldFxSprite(scene, fx, x, y, scale).setDepth(depth), fx);
  sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.destroy());
  return sprite;
}

// The panels' moments (BLACKSMITH, HOME, LUCKY WHEEL, FARM, KITCHEN) play
// between a panel's fill (151) and its words and icons (152): never over a
// line of text, which stays whole on top of them.
const PANEL_FX_DEPTH = 151.5;

/**
 * A panel's plays, fixed to the screen like the panel, so closing it can take
 * any still going with it rather than leave them over the map.
 */
export class PanelFx {
  private scene: Phaser.Scene;
  private fx: FieldFx[];
  private warmed = false;
  private playing = new Set<Phaser.GameObjects.Sprite>();

  constructor(scene: Phaser.Scene, ...fx: FieldFx[]) {
    this.scene = scene;
    this.fx = fx;
  }

  /**
   * Bakes the panel's sheets a slice a frame from now (warmFieldFx), once a
   * scene: called as the panel opens, as its moments come a key or two after
   * that, and a panel never opened bakes nothing. Made in the town's create,
   * the five panels' sheets put 4.6MiB in at once and a 32-49ms frame on its
   * first entry. A moment that comes first bakes its sheet then (playFieldFx).
   */
  warm(): void {
    if (this.warmed) return;
    this.warmed = true;
    warmFieldFx(this.scene, ...this.fx);
  }

  /** One play of `fx` with its anchor on (x, y), at `scale` screen px a pixelfx pixel. */
  play(fx: FieldFx, x: number, y: number, scale: number): void {
    const sprite = playFieldFxOnce(this.scene, fx, x, y, scale, PANEL_FX_DEPTH).setScrollFactor(0);
    this.playing.add(sprite);
    sprite.once(Phaser.GameObjects.Events.DESTROY, () => this.playing.delete(sprite));
  }

  /** Ends every play still going: the panel is closing. */
  clear(): void {
    for (const sprite of [...this.playing]) sprite.destroy();
  }
}

// A collect-burst (a white flash and a cross, a ring snapping out ahead of a
// softer one, twinkles thrown wide that brake and wink out) in `palette`,
// dark to bright. Its burst, 30 over its anchor, on (x, y).
const burst = (key: string, palette: string[]): FieldFx => ({
  key,
  sheet: { fx: collectBurst, opts: { palette }, span: [0, 1.1], frames: 16, focus: [0, -30], crop: [18, 12, 100, 102] },
  ms: 900,
});

/** A burst in gold, ui/level-up's ramp as the battle's TREASURE MAP has it: a win. */
export const GOLD_BURST = burst("fx-panel-gold", ["#2a1405", "#5c3008", "#9a5a0e", "#d48e18", "#f5b92c", "#ffde5e", "#fff4bc", "#ffffff"]);

/** A burst in the FARM's greens, its title's #a3e635 among them: a harvest. */
export const GREEN_BURST = burst("fx-panel-green", [
  "#0c1a10",
  "#173a1a",
  "#24582a",
  "#3f7a1e",
  "#65a30d",
  "#a3e635",
  "#d9f99d",
  "#f7fee7",
]);

/** A burst in the KITCHEN's warm oranges, its title's #fdba74 among them: a dish served. */
export const WARM_BURST = burst("fx-panel-warm", ["#1f0d05", "#4a1d08", "#8a3a10", "#c2581a", "#f97316", "#fdba74", "#ffedd5", "#ffffff"]);

/**
 * A hammer's clang: a white four-point star, a ring breaking into arcs and a
 * fan of gold sparks that sprays up and rains down 30 under it (impacts/parry).
 * Its star on (x, y). A forging, a refine, a HOME extension built.
 */
export const SPARKS: FieldFx = {
  key: "fx-panel-sparks",
  // the sparks by 0.8s nearly all down; the widest few, past 80 a side, cut
  // for 12 frames to a row (1920x96)
  sheet: { fx: parry, span: [0, 0.8], frames: 12, focus: [0, -30], crop: [20, 14, 180, 110] },
  ms: 700,
};
