import type Phaser from "phaser";
import type { FxModule } from "pixelfx";
import * as torch from "pixelfx/fx/fire/torch";
import * as toxicPuddle from "pixelfx/fx/nature/toxic-puddle";
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

// nature/toxic-puddle's front layer alone: its bubbles and the vapour off
// them, without the tar pool and the glow round it (drawBack). As statusFx.ts
// layerOf does, the draw env.d.ts leaves out of FxModule.
type Draw = (p: unknown, t: number, o: Record<string, unknown>) => void;
const puddleBubbles: FxModule = { meta: toxicPuddle.meta, draw: (toxicPuddle as unknown as { draw: Draw }).draw } as FxModule;

/**
 * Lava bubbling (nature/toxic-puddle's bubbles, its pool left off): domes
 * with a dark crust that swell, stretch and pop in a ring of bright spatter,
 * each loosing a ribbon of vapour. In the lava tiles' own ramp
 * (art/tiles.ts LAVA_PALETTE, a crust darker than its k and a pale top over
 * its y), so the domes read as the lava's own skin, not a tar pool laid on
 * it. Width 10: they rise within 7 cells either side, a tile's middle. Its
 * 4s loop in 48 frames (12fps, a row of 2016px); the box keeps the domes and
 * the spatter and cuts the vapour 34 cells up, where it has faded to grey.
 * Light 0.6: glow bakes as colour with alpha, a pale haze over lava that is
 * bright already, so less of it than the effect's 1.
 */
export const LAVA_BUBBLES: FieldFx = {
  key: "prop-lava-bubbles",
  sheet: {
    fx: puddleBubbles,
    opts: {
      palette: ["#2a0c06", "#4a1408", "#7c2d12", "#9a3412", "#c2410c", "#ea580c", "#fdba74", "#fff1c2"],
      sheen: ["#7c2d12", "#c2410c", "#fb923c", "#fed7aa"],
      width: 10,
      light: 0.6,
    },
    frames: 48,
    crop: around(toxicPuddle, [-20, -34, 22, 12]),
  },
  ms: toxicPuddle.meta.duration * 1000,
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
