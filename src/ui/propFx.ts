import type Phaser from "phaser";
import * as torch from "pixelfx/fx/fire/torch";
import { warmSheets } from "../fx";
import { ART_PX } from "../pixelart";
import { type FieldFx, fieldFxSheets, fieldFxSprite, playFieldFx } from "./fieldFx";

// The fields' props that move: fire and water standing on the map, pixelfx
// loops (github:patch-gg/pixelfx, MIT) baked into sheets as the critters are
// (Critters.ts), one pixelfx pixel to an art cell at ART_PX. Only to look at:
// no body, nothing to talk to.

// A box round an effect's anchor, in its pixels, as the part of its canvas a
// sheet bakes (PixelSheet.crop).
const around = (fx: FieldFx["sheet"]["fx"], [x0, y0, x1, y1]: [number, number, number, number]): [number, number, number, number] => {
  const [ax, ay] = fx.meta.origin;
  return [ax + x0, ay + y0, ax + x1, ay + y1];
};

/**
 * A wall torch (fire/torch): its iron plate on the anchor, the handle and its
 * pitch-soaked wrap over it, a flame licking up off the wrap with smoke and
 * embers. Its loop at 15fps, 30 frames; the box keeps the plate, the flame and
 * the near smoke and embers, and leaves off those that climb past 46 cells
 * and the glow's outer rings, which the torch's night lamp stands in for.
 */
export const TORCH: FieldFx = {
  key: "prop-torch",
  sheet: { fx: torch, frames: 30, crop: around(torch, [-20, -46, 21, 16]) },
  ms: torch.meta.duration * 1000,
  loop: true,
};

// how long a prop takes to come in once its sheet is baked
const FADE_IN_MS = 600;

/**
 * `fx` looping with its anchor on (x, y) at `depth`, at ART_PX, from when its
 * sheet is in: baked a slice of each frame (warmSheets), so the scene's first
 * frame does not bake it, and faded in then. `phase` (0..1) is how far into
 * its loop it starts, so two side by side do not move as one. Gone with the
 * scene.
 */
export function addProp(scene: Phaser.Scene, fx: FieldFx, x: number, y: number, depth: number, phase = 0): Phaser.GameObjects.Sprite {
  const sprite = fieldFxSprite(scene, fx, x, y, ART_PX).setDepth(depth);
  warmSheets(scene, fieldFxSheets(fx), () => {
    playFieldFx(sprite, fx).setAlpha(0).anims.setProgress(phase);
    scene.tweens.add({ targets: sprite, alpha: 1, duration: FADE_IN_MS });
  });
  return sprite;
}
