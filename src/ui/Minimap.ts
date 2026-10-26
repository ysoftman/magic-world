import type Phaser from "phaser";
import { GAME_HEIGHT } from "../config";
import { GameState } from "../gameState";
import {
  T_ASH,
  T_GRASS,
  T_HOUSE,
  T_LAVA_A,
  T_LAVA_B,
  T_PATH,
  T_ROCK,
  T_SCORCH,
  T_SOIL,
  T_TALL,
  T_TREE,
  T_WATER_A,
  T_WATER_B,
  TILE,
} from "../levels";
import { currentObjective, objectivePoints } from "../objective";
import { type Season, seasonToday } from "../season";
import type { Region } from "../weather";
import { isTouchDevice } from "./TouchControls";

export interface MinimapMarker {
  x: number;
  y: number;
  color: number;
}

// Tile index -> minimap color. Tiles the current scene doesn't know about
// (e.g. a future forest's own tile types) fall back to a neutral slate.
const TILE_COLORS: Record<number, number> = {
  [T_GRASS]: 0x1e7a34,
  [T_WATER_A]: 0x2563eb,
  [T_WATER_B]: 0x2563eb,
  [T_TREE]: 0x14532d,
  [T_PATH]: 0xb08968,
  [T_TALL]: 0x3fae49,
  [T_HOUSE]: 0x94a3b8,
  [T_SOIL]: 0x6b4a2f,
  // volcano: lava in the tile's own orange so the moat around the crater
  // reads at a glance; scorched zones a red-brown step off the ash, the way
  // tall grass sits a step off grass above
  [T_ASH]: 0x57534e,
  [T_LAVA_A]: 0xc2410c,
  [T_LAVA_B]: 0xc2410c,
  [T_ROCK]: 0x1c1917,
  [T_SCORCH]: 0x7c2d12,
};

// The snow field's own colours, laid over TILE_COLORS (SnowScene passes this).
// The field is a mid grey-blue rather than white so the white player dot and
// the yellow chest markers still stand out on it.
export const SNOW_TILE_COLORS: Record<number, number> = {
  [T_GRASS]: 0x8fa3b6,
  [T_WATER_A]: 0x2a6690,
  [T_WATER_B]: 0x2a6690,
  [T_TREE]: 0x1d4a3e,
  [T_PATH]: 0x6b6e75,
  [T_TALL]: 0x6f8396,
};

// The forest's colours (ForestScene passes this): its darker moss, leaf-litter
// path and swamp water, so the map matches the ground it shows.
export const FOREST_TILE_COLORS: Record<number, number> = {
  [T_GRASS]: 0x3a5c3b,
  [T_WATER_A]: 0x1f5a5c,
  [T_WATER_B]: 0x1f5a5c,
  [T_TREE]: 0x0f3a22,
  [T_PATH]: 0x8a6e4c,
  [T_TALL]: 0x2b4a2f,
};

// The cave's colours (DungeonScene passes this): warm grey stone floor,
// lighter cool boulder walls, dark pools.
export const CAVE_TILE_COLORS: Record<number, number> = {
  [T_PATH]: 0x4a4540,
  [T_ROCK]: 0x7a7d85,
  [T_WATER_A]: 0x1d3b5c,
  [T_WATER_B]: 0x1d3b5c,
};

// The town's and the forest's autumn (BootScene's AUTUMN_SKIN and
// FOREST_AUTUMN_SKIN): olive grass and rust trees, the paths and water as
// they were.
const AUTUMN_TILE_COLORS: Record<number, number> = {
  [T_GRASS]: 0x6f8a36,
  [T_TREE]: 0x9a4418,
  [T_TALL]: 0x5c7334,
};
const FOREST_AUTUMN_TILE_COLORS: Record<number, number> = {
  ...FOREST_TILE_COLORS,
  [T_GRASS]: 0x4f6a36,
  [T_TREE]: 0x6e2a10,
  [T_TALL]: 0x42582f,
};
// Which colours the town and the forest take in each season, after
// BootScene's seasonSkin(): the autumn sets above, and in winter the snow
// field's. A season left out keeps what the scene passed in.
const SEASON_COLORS: Partial<Record<Region, Partial<Record<Season, Record<number, number>>>>> = {
  town: { autumn: AUTUMN_TILE_COLORS, winter: SNOW_TILE_COLORS },
  forest: { autumn: FOREST_AUTUMN_TILE_COLORS, winter: SNOW_TILE_COLORS },
};

const MAX_W = 160;
const MAX_H = 120;
const PAD = 2;
const DOT = 5;
// clears the two-line key hint every scene draws along the bottom edge
const BOTTOM_MARGIN = 68;
// On touch the bottom-left corner is the d-pad's (y>=508), so the map sits
// above it instead, its bottom edge also clear of the dialogue box's speaker
// name (y=456) — the map can stay open while you talk to someone.
const TOUCH_BOTTOM = 450;

// The current quest step's marker: a magenta ring, apart from every landmark
// colour (yellow exits and chests, blue fishing, the white player dot),
// breathing slowly between full and faint rather than blinking.
const GOAL_COLOR = 0xff4fd8;
const GOAL_RADIUS = 6;
const GOAL_PULSE_MS = 900;

// which region's map each roaming scene is, for objectivePoints()
const SCENE_REGION: Record<string, Region> = { Town: "town", Forest: "forest", Snow: "snow", Dungeon: "dungeon", Volcano: "volcano" };

// Small fixed-screen minimap overlay: the scene's tilemap 2D array is drawn
// once into a Graphics as colored blocks, the player is a moving dot on top,
// and landmarks are passed in as world-space markers. Scroll-locked and
// anchored to the bottom-left corner so it clears the top HUD and the
// bottom-right hint text. Hidden until the scene toggles it (T key).
export class Minimap {
  private container: Phaser.GameObjects.Container;
  private playerDot: Phaser.GameObjects.Rectangle;
  private cell: number;
  private dotX: number;
  private dotY: number;
  private player: Phaser.GameObjects.Sprite;
  private goal: Phaser.GameObjects.Graphics;
  private goalKey: string | null = null;
  private region: Region | undefined;

  constructor(
    scene: Phaser.Scene,
    mapData: number[][],
    player: Phaser.GameObjects.Sprite,
    markers: MinimapMarker[] = [],
    tileColors: Record<number, number> = {},
  ) {
    this.player = player;
    const mapW = mapData.length > 0 ? mapData[0].length : 0;
    const mapH = mapData.length;
    const cell = mapW > 0 && mapH > 0 ? Math.min(MAX_W / mapW, MAX_H / mapH) : 1;
    this.cell = cell;
    const w = Math.floor(mapW * cell);
    const h = Math.floor(mapH * cell);
    this.dotX = PAD;
    this.dotY = PAD;
    this.region = SCENE_REGION[scene.sys.settings.key];
    // the season's colours, read when the map is drawn as the scene's skin is
    const colors = (this.region && SEASON_COLORS[this.region]?.[seasonToday()]) || tileColors;

    const mapG = scene.add.graphics();
    mapG.fillStyle(0x0b0b2b, 1);
    mapG.fillRect(0, 0, w, h);
    for (let ty = 0; ty < mapH; ty++) {
      for (let tx = 0; tx < mapW; tx++) {
        const tile = mapData[ty][tx];
        mapG.fillStyle(colors[tile] ?? TILE_COLORS[tile] ?? 0x334155, 1);
        // +0.5 so adjacent cells overlap instead of showing hairline seams
        mapG.fillRect(tx * cell, ty * cell, cell + 0.5, cell + 0.5);
      }
    }
    for (const m of markers) {
      mapG.fillStyle(m.color, 1);
      mapG.fillRect((m.x / TILE) * cell - 2, (m.y / TILE) * cell - 2, 4, 4);
    }

    this.goal = scene.add.graphics();
    scene.tweens.add({ targets: this.goal, alpha: 0.3, duration: GOAL_PULSE_MS, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    this.playerDot = scene.add.rectangle(0, 0, DOT, DOT, 0xf5f5f5).setOrigin(0.5);

    const border = scene.add
      .rectangle(0, 0, w + PAD * 2, h + PAD * 2, 0x0b0b2b)
      .setOrigin(0)
      .setStrokeStyle(2, 0xffffff);

    const bottom = isTouchDevice() ? TOUCH_BOTTOM : GAME_HEIGHT - BOTTOM_MARGIN;
    this.container = scene.add
      .container(12, bottom - (h + PAD * 2), [border, mapG, this.goal, this.playerDot])
      .setScrollFactor(0)
      .setDepth(96)
      .setVisible(false);
  }

  toggle(): void {
    this.container.setVisible(!this.container.visible);
    this.update();
  }

  isVisible(): boolean {
    return this.container.visible;
  }

  // Called every frame by the owning scene; cheap — just repositions the dot,
  // and redraws the quest marker only when the step or its spot has moved.
  update(): void {
    if (!this.container.visible) return;
    this.playerDot.setPosition(this.dotX + (this.player.x / TILE) * this.cell, this.dotY + (this.player.y / TILE) * this.cell);
    this.drawGoal();
  }

  // Rings the quest's current goal: the spot itself on this map, or this map's
  // way towards it when it lies in another region (objective.ts).
  private drawGoal(): void {
    const points = this.region ? objectivePoints(currentObjective(GameState.quest).spot, this.region) : [];
    const key = points.map((p) => `${p.x},${p.y}`).join("|");
    if (key === this.goalKey) return;
    this.goalKey = key;
    this.goal.clear();
    for (const p of points) {
      // on the same spot the landmark dots are drawn at
      const x = (p.x / TILE) * this.cell;
      const y = (p.y / TILE) * this.cell;
      this.goal.lineStyle(2, GOAL_COLOR, 1).strokeCircle(x, y, GOAL_RADIUS);
      this.goal.fillStyle(GOAL_COLOR, 1).fillRect(x - 1, y - 1, 2, 2);
    }
  }

  destroy(): void {
    this.container.destroy();
  }
}
