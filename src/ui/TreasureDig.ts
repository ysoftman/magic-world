import Phaser from "phaser";
import { Sfx } from "../audio";
import { PIXEL } from "../config";
import { GameState } from "../gameState";
import { SOLID, T_LAVA_A, T_LAVA_B, T_PATH, T_SOIL, T_WATER_A, T_WATER_B, TILE } from "../levels";
import { makeTexture, showToast } from "../pixelart";
import {
  DIG_RADIUS,
  digUp,
  HINT_RADIUS,
  MAX_MAPS,
  REGIONS,
  resettleTreasureMaps,
  type TreasureMap,
  type TreasureRegion,
} from "../treasure";

const GLINT_KEY = "treasure-glint";
// a small four-point twinkle, pale gold, drawn blocky (no Scale2x)
const GLINT = ["...w...", "...w...", "..wyw..", "wwyyyww", "..wyw..", "...w...", "...w..."];
const GLINT_PALETTE = { w: 0xfffbe6, y: 0xfde68a };
// faint even up close, and breathing slowly rather than blinking
const GLINT_ALPHA = 0.75;
const GLINT_BREATH_MS = 1400;
// on the ground: over the meadow's flowers and stones (4), under shadows (5)
const GLINT_DEPTH = 4.5;

/**
 * Treasure maps in one roaming scene (treasure.ts): a faint glint on the
 * ground over each map's X once the hero is within HINT_RADIUS, and the dig
 * itself, tryDig(), for the scene's Z. A scene whose Z already does
 * something (talk, the ice hole) calls tryDig() first and stops if it dug;
 * one where Z does nothing passes `ownKey` and this listens for Z itself,
 * held off while `blocked()` says a panel or dialogue is up. `dug` runs after
 * a dig, for the scene to hold off its fights while the find is read.
 */
export class TreasureDigger {
  private scene: Phaser.Scene;
  private region: TreasureRegion;
  private hero: { x: number; y: number };
  private toastY: number;
  private dug?: () => void;
  private glints: Phaser.GameObjects.Image[] = [];
  private readonly calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  constructor(
    scene: Phaser.Scene,
    region: TreasureRegion,
    hero: { x: number; y: number },
    opts: { toastY: number; ownKey?: boolean; blocked?: () => boolean; dug?: () => void },
  ) {
    this.scene = scene;
    this.region = region;
    this.hero = hero;
    this.toastY = opts.toastY;
    this.dug = opts.dug;
    // the ground is final now, a map edit included (closing the editor
    // restarts the scene): move any X it no longer allows, in every region,
    // so the item window's charts agree too
    resettleTreasureMaps(GameState.treasureMaps);
    if (!scene.textures.exists(GLINT_KEY)) makeTexture(scene, GLINT_KEY, GLINT, GLINT_PALETTE, PIXEL);
    for (let i = 0; i < MAX_MAPS; i++) this.glints.push(scene.add.image(0, 0, GLINT_KEY).setDepth(GLINT_DEPTH).setVisible(false));
    const onUpdate = (time: number): void => this.glow(time);
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, onUpdate));
    if (opts.ownKey) {
      scene.input.keyboard
        ?.addKey(Phaser.Input.Keyboard.KeyCodes.Z)
        .on(Phaser.Input.Keyboard.Events.DOWN, (_k: unknown, e: KeyboardEvent) => {
          if (!e.repeat && !opts.blocked?.()) this.tryDig();
        });
    }
  }

  // the held maps that point into this scene
  private here(): TreasureMap[] {
    return GameState.treasureMaps.filter((m) => m.region === this.region);
  }

  /** Digs the map whose X the hero stands by; false when there is none. */
  tryDig(): boolean {
    const map = this.here().find(
      (m) => Math.hypot(m.tx * TILE + TILE / 2 - this.hero.x, m.ty * TILE + TILE / 2 - this.hero.y) <= DIG_RADIUS,
    );
    if (!map) return false;
    const line = digUp(map, GameState);
    GameState.treasureMaps.splice(GameState.treasureMaps.indexOf(map), 1);
    GameState.mapsDug += 1;
    Sfx.chest();
    // before the save, so its "SAVED" waits behind the find instead of
    // holding it up
    showToast(this.scene, line, this.toastY);
    GameState.save();
    this.dug?.();
    return true;
  }

  private glow(time: number): void {
    const maps = this.here();
    const breath = this.calm ? 1 : 0.6 + 0.4 * Math.sin((time / GLINT_BREATH_MS) * Math.PI * 2);
    this.glints.forEach((g, i) => {
      const m = maps[i];
      if (!m) {
        g.setVisible(false);
        return;
      }
      const x = m.tx * TILE + TILE / 2;
      const y = m.ty * TILE + TILE / 2;
      // full a tile inside HINT_RADIUS, gone just past it
      const near = Phaser.Math.Clamp((HINT_RADIUS + TILE / 2 - Math.hypot(x - this.hero.x, y - this.hero.y)) / TILE, 0, 1);
      g.setPosition(x, y + 8)
        .setVisible(near > 0)
        .setAlpha(GLINT_ALPHA * near * breath);
    });
  }
}

// The item window's picture of a map: the region as an old chart, in ink and
// parchment rather than the minimap's game colours (a map read at home, not
// a radar), with a red X on the spot.
const INK = {
  ground: 0xf0dfb4,
  road: 0xc9a46a,
  soil: 0xa47148,
  solid: 0x7c5a2e,
  water: 0x5b8fb0,
  lava: 0xc2410c,
  frame: 0x5b3a1a,
  x: 0xb91c1c,
};

/**
 * Draws `map`'s region into `g`, as large as fits `area` in whole pixels per
 * cell and centred in it, with the X. Returns the cell size used.
 */
export function drawTreasureMap(
  g: Phaser.GameObjects.Graphics,
  map: TreasureMap,
  area: { x: number; y: number; w: number; h: number },
): number {
  const grid = REGIONS[map.region].grid();
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const cell = Math.floor(Math.min(area.w / cols, area.h / rows));
  const x0 = Math.round(area.x + (area.w - cols * cell) / 2);
  const y0 = Math.round(area.y + (area.h - rows * cell) / 2);
  g.clear();
  g.fillStyle(INK.frame, 1);
  g.fillRect(x0 - 6, y0 - 6, cols * cell + 12, rows * cell + 12);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const t = grid[y][x];
      const color =
        t === T_WATER_A || t === T_WATER_B
          ? INK.water
          : t === T_LAVA_A || t === T_LAVA_B
            ? INK.lava
            : SOLID.has(t)
              ? INK.solid
              : t === T_PATH && REGIONS[map.region].noRoads
                ? INK.road
                : t === T_SOIL
                  ? INK.soil
                  : INK.ground;
      g.fillStyle(color, 1);
      g.fillRect(x0 + x * cell, y0 + y * cell, cell, cell);
    }
  }
  // the X, a little bigger than its cell so it reads at a glance
  const cx = x0 + map.tx * cell + cell / 2;
  const cy = y0 + map.ty * cell + cell / 2;
  const r = cell * 0.75;
  g.lineStyle(Math.max(3, Math.round(cell / 4)), INK.x, 1);
  g.lineBetween(cx - r, cy - r, cx + r, cy + r);
  g.lineBetween(cx - r, cy + r, cx + r, cy - r);
  return cell;
}
