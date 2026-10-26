import Phaser from "phaser";
import { GameState } from "../gameState";
import { currentObjective, objectivePoints } from "../objective";
import { makeTexture } from "../pixelart";
import type { Region } from "../weather";
import { STATUS_HUD_HEIGHT } from "./StatusHud";

const KEY = "guide-arrow";
// the minimap's goal ring magenta, outlined in the toasts' and captions'
// dark stroke so it still reads on the snow field's pale ground
const PALETTE = { o: 0x1a1028, f: 0xff4fd8 };
// Pointing east and south-east; the other six frames are these turned a
// quarter at a time, so the pixel grid never sees an arbitrary rotation.
// Square, so a quarter turn keeps each shape centred where it was.
// biome-ignore format: kept one row per line so the art reads as a grid
const EAST = [
  "..o......",
  "..oo.....",
  "..ofo....",
  "..offo...",
  "..offfo..",
  "..offo...",
  "..ofo....",
  "..oo.....",
  "..o......",
];
// biome-ignore format: as above
const SOUTH_EAST = [
  ".........",
  ".......o.",
  "......oo.",
  ".....ofo.",
  "....offo.",
  "...offfo.",
  "..offffo.",
  ".ooooooo.",
  ".........",
];
// from the hero's centre: the east frame's inner edge sits 14px clear of the
// 64px hero sprite
const RADIUS = 56;
// The goal counts as found once it's this far inside the view (below the
// HUD while that's up): an NPC or exit label right at the edge is already
// in sight, and the arrow would only point at what's on screen.
const IN_VIEW_INSET = 64;
// above the night shade (90) and its lights and glows (90.4/90.5), under the
// area title (95), the minimap (96) and the HUD (110)
const DEPTH = 91;
// faint and breathing, like the minimap's ring (900ms each way)
const ALPHA_LOW = 0.4;
const ALPHA_HIGH = 0.8;
const PULSE_MS = 1800;
const FADE_MS = 200;

// a quarter turn clockwise (screen y points down)
const turn = (rows: string[]): string[] => rows.map((_, y) => rows.map((_, x) => rows[rows.length - 1 - x][y]).join(""));

function bake(scene: Phaser.Scene): void {
  if (scene.textures.exists(`${KEY}-0`)) return;
  // frame i points i x 45 degrees clockwise from east, matching atan2's angle
  let axis = EAST;
  let diagonal = SOUTH_EAST;
  for (let i = 0; i < 8; i += 2) {
    makeTexture(scene, `${KEY}-${i}`, axis, PALETTE);
    makeTexture(scene, `${KEY}-${i + 1}`, diagonal, PALETTE);
    axis = turn(axis);
    diagonal = turn(diagonal);
  }
}

/**
 * A small arrow orbiting the hero towards the quest's current goal (the
 * nearest of objectivePoints, the spots the minimap rings), so the way is
 * there without opening the map. It shows only while the goal is out of
 * sight, and fades out once it comes into view; `hidden` is the scene's own
 * "a panel, dialogue or prompt is up" check, and the GUIDE ARROW setting
 * turns it off. Eight baked frames, one per 45 degrees, rather than rotating
 * one sprite: the position follows the exact bearing, the art only snaps.
 */
export function addGuideArrow(scene: Phaser.Scene, hero: Phaser.GameObjects.Sprite, region: Region, hidden: () => boolean): void {
  bake(scene);
  const arrow = scene.add.image(hero.x, hero.y, `${KEY}-0`).setDepth(DEPTH).setAlpha(0);
  const cam = scene.cameras.main;
  let shown = 0;
  let angle = 0;
  // after the physics step has moved the hero for this frame
  const onUpdate = (time: number, delta: number): void => {
    let goal: { x: number; y: number } | null = null;
    if (GameState.guideArrow && !hidden()) {
      let best = Number.POSITIVE_INFINITY;
      for (const p of objectivePoints(currentObjective(GameState.quest).spot, region)) {
        const d = Phaser.Math.Distance.Squared(hero.x, hero.y, p.x, p.y);
        if (d < best) {
          best = d;
          goal = p;
        }
      }
    }
    const v = cam.worldView;
    const top = v.y + (GameState.hudVisible ? STATUS_HUD_HEIGHT : 0) + IN_VIEW_INSET;
    // A town exit is a road's last tile, on the map's very edge, where the
    // camera can never bring it inside the inset: judge such a goal from just
    // within the camera's bounds, or the arrow would keep pointing at an exit
    // the hero is standing beside.
    const b = cam.getBounds();
    const gx = goal ? Phaser.Math.Clamp(goal.x, b.x + IN_VIEW_INSET + 1, b.right - IN_VIEW_INSET - 1) : 0;
    const gy = goal ? Math.min(goal.y, b.bottom - IN_VIEW_INSET - 1) : 0;
    const inView = goal !== null && gx > v.x + IN_VIEW_INSET && gx < v.right - IN_VIEW_INSET && gy > top && gy < v.bottom - IN_VIEW_INSET;
    if (goal) angle = Math.atan2(goal.y - hero.y, goal.x - hero.x);
    shown = Phaser.Math.Clamp(shown + ((goal && !inView ? 1 : -1) * delta) / FADE_MS, 0, 1);
    if (shown === 0) {
      arrow.setVisible(false);
      return;
    }
    const frame = (Math.round(angle / (Math.PI / 4)) + 8) % 8;
    const pulse = 0.5 - 0.5 * Math.cos((time / PULSE_MS) * Math.PI * 2);
    arrow
      .setVisible(true)
      .setTexture(`${KEY}-${frame}`)
      .setPosition(Math.round(hero.x + Math.cos(angle) * RADIUS), Math.round(hero.y + Math.sin(angle) * RADIUS))
      .setAlpha(shown * (ALPHA_LOW + (ALPHA_HIGH - ALPHA_LOW) * pulse));
  };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, onUpdate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, onUpdate));
}
