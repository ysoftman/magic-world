import Phaser from "phaser";
import { bakePixelSheet, type PixelSheet, sheetInfo, spanOf, warmSheets } from "../fx";

// The field's moments as pixelfx sheets (github:patch-gg/pixelfx, MIT, baked
// as fx.ts bakes the battle's): a treasure dig's soil and chest (TreasureDig.ts)
// and the fishing pond's rings and splash (Fishing.ts), each a sheet played as
// a Phaser animation of `ms`, once or over and over.

/** A sheet, the texture and animation it makes (`key`) and how it plays. */
export interface FieldFx {
  key: string;
  sheet: PixelSheet;
  /** one run of its frames, in ms */
  ms: number;
  /** over and over, until stopped */
  loop?: boolean;
}

/** `fx`'s sheets by key, for a warm-up queue (fx.ts warmSheets, warmBattleFx). */
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
