import type Phaser from "phaser";
import * as portal from "pixelfx/fx/arcane/portal";
import { warmSheets } from "../fx";
import { ART_PX } from "../pixelart";
import { type FieldFx, fieldFxSheets, fieldFxSprite, playFieldFx } from "./fieldFx";

// The ABYSS's two ways in, each with pixelfx's portal (arcane/portal, MIT)
// turning in it, so it reads as a way in: standing up in the town gate's ring
// (TownScene), laid flat in the cave stair's pit (DungeonScene). Before it the
// gate's spiral stood still, and the stair's grey steps read as one more of
// its pocket's boulders (DungeonScene's lights).
//
// Under the night (90), not over it with ADD as the lights are: the hero walks
// in front of the gate and onto the stair (10), and over the night a rift
// would draw on him and on the gate's tag (11); the gate has no lamp because a
// violet one turned faces violet; and under the night's multiply the rift's
// rim is still the brightest thing round it. Light 0.4: glow bakes as colour
// with alpha, and at the effect's 1 it washed the gate's stone pink.

// The gate's own violets (art/landmarks.ts, ABYSS_GATE_PALETTE's K, p, r and V,
// the gate glow's G), a pale step and white: the effect's arcane ramp is pinker.
const VIOLET = ["#0b0614", "#1e0b3d", "#4c1d95", "#6d28d9", "#8b5cf6", "#b197fc", "#e4d8ff", "#ffffff"];
const [AX, AY] = portal.meta.origin;

// A rift `width` x `height` (its half-axes, in pixelfx pixels), the sprite's
// origin its middle, height + 5 over the effect's anchor. `box` is what is
// baked round the anchor: the rift and the motes riding round it. Motes pulled
// in from further off are cut at its edge, and the line of light the effect
// lays on the floor under the rift (y 0 and 1, 72 wide) is left off with its
// grit: it ran across the gate's base and out under the stair. 36 frames, 15fps.
function rift(key: string, width: number, height: number, [x0, y0, x1, y1]: [number, number, number, number]): FieldFx {
  return {
    key,
    sheet: {
      fx: portal,
      opts: { palette: VIOLET, width, height, light: 0.4 },
      frames: 36,
      focus: [0, -(height + 5)],
      crop: [AX + x0, AY + y0, AX + x1, AY + y1],
    },
    ms: portal.meta.duration * 1000,
    loop: true,
  };
}

// The gate's ring opens 12x17 cells round the middle of its 15th row (3px over
// the gate's middle). 5.5 x 7.5 keeps the rift's outer line on the ring's
// violet edge, and a half-height of 7.5 puts the rift's middle on a cell's
// middle, as the ring's is, so its pixels sit on the gate's 2px grid. Its box
// stays inside the gate's 64px: 27 over the anchor is the texture's top (the
// ABYSS tag is above it), and -3 stops 2px over the gate's base.
export const GATE_RIFT = rift("abyss-rift-gate", 5.5, 7.5, [-14, -27, 14, -3]);
// The stair's pit is 20x8 cells, its middle 16px under the stair's on a cell
// edge. 8.5 x 3 fills it and keeps the rift's middle on that edge.
export const STAIR_RIFT = rift("abyss-rift-stair", 8.5, 3, [-14, -16, 14, -3]);

/**
 * `fx` turning with its middle on (x, y) at `depth`, at ART_PX, from when its
 * sheet is in: baked a slice of each frame (warmSheets), so the scene's first
 * frame does not bake it. Gone with the scene.
 */
export function addAbyssRift(scene: Phaser.Scene, fx: FieldFx, x: number, y: number, depth: number): Phaser.GameObjects.Sprite {
  const sprite = fieldFxSprite(scene, fx, x, y, ART_PX).setDepth(depth);
  warmSheets(scene, fieldFxSheets(fx), () => playFieldFx(sprite, fx));
  return sprite;
}
