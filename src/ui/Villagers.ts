import type Phaser from "phaser";
import { GameState, nightFactor, type QuestState } from "../gameState";
import { type MonsterZone, SOLID, T_SOIL, T_TALL, TILE } from "../levels";
import { addGroundShadow, retroStyle } from "../pixelart";

// A slow stroll: the hero walks at 240px/s, a villager at a fifth of that.
const SPEED = 48;
const WAIT_MIN = 1500;
const WAIT_MAX = 4000;
// how far (in BFS steps) one stroll goes once a villager is inside its area
const STROLL_MAX = 5;
const FRAME_MS = 200;
const FADE_MS = 600;
// same radius tryTalk() uses
const TALK_RADIUS = 120;
// Kept clear of every fixed talk spot and map exit. Past 2 tiles a hero
// standing at a fixed spot (within ~40px of it) is always nearer to it than
// to any villager, so tryTalk's nearest-wins pick can't hand the ELDER's
// line to a passer-by; and nobody wanders onto a map exit.
const AVOID_RADIUS = 2 * TILE;
// name tags: retroStyle(5) like the fixed NPC tags, height per AGENTS.md
const LABEL_SIZE = 5;
const LABEL_H = LABEL_SIZE * 4 * 1.3;
const LABEL_DY = 48;
const LABEL_MARGIN = 8;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Hint = { lines: string[]; when?: (q: QuestState) => boolean };

export interface VillagerDef {
  key: "farmer" | "fisher" | "traveler";
  name: string;
  color: string;
  // tile rect (inclusive) the villager strolls in by day
  area: { x0: number; y0: number; x1: number; y1: number };
  // town-edge cell it walks off through at dusk and back in from at dawn.
  // On the top or bottom row: the exclusion rings round the talk spots cut
  // the road ends off from the rest of the town, the open edge rows don't
  home: { tx: number; ty: number };
  // Each hint names only places the hero can already reach: the forest's
  // poison after the KING SLIME, the snow's frost after the MOSS GOLEM, the
  // volcano after the GLACIER GOLEM. Every claim is checked against the code
  // it describes (CROPS, POND_FISH/ARCTIC_FISH, BattleScene's specials).
  hints: Hint[];
}

export const VILLAGERS: VillagerDef[] = [
  {
    key: "farmer",
    name: "FARMER",
    color: "#a3e635",
    area: { x0: 0, y0: 0, x1: 13, y1: 6 },
    home: { tx: 13, ty: 0 },
    hints: [
      { lines: ["MOONFLOWER only grows", "at night. Plant it by", "dusk and it's ripe", "before dawn!"] },
      { lines: ["A night asleep at HOME", "still counts for the", "night crops. Handy!"] },
      { lines: ["BEANS come up fast,", "CORN pays more. Plant", "whatever fits your day."] },
    ],
  },
  {
    key: "fisher",
    name: "FISHER",
    color: "#38bdf8",
    area: { x0: 10, y0: 0, x1: 22, y1: 6 },
    home: { tx: 27, ty: 0 },
    hints: [
      { lines: ["Some fish only bite", "after dark. Cast at", "the pond after 20:00!"] },
      { lines: ["Hook a GOLDEN FISH and", "there's a POTION on", "the line with it."] },
      { lines: ["The snow field's ice", "hides a pale fish that", "only shows at night."], when: (q) => q.forestBoss },
    ],
  },
  {
    key: "traveler",
    name: "TRAVELER",
    color: "#fbbf24",
    area: { x0: 5, y0: 8, x1: 21, y1: 15 },
    home: { tx: 14, ty: 19 },
    hints: [
      { lines: ["Lost track of a job?", "Press U to open your", "QUEST JOURNAL."] },
      { lines: ["The HUNTER pays well", "for side jobs. Ask him", "what he needs."] },
      // how a catch is made, until the hero has made one: nothing else says
      // so before the HUNTER's catch job (BattleScene: CANDY on a hurt foe)
      { lines: ["Weaken a monster, then", "throw CANDY at it. A", "catch fights beside you!"], when: () => GameState.caught.length === 0 },
      // gated like the HUNTER's own offer of his fire-beast job
      {
        lines: ["The HUNTER keeps asking", "about the VOLCANO's", "beasts. He has work!"],
        when: (q) => q.snowBoss && q.hunterYetiReward && !q.hunterFireAccepted,
      },
      { lines: ["WASPS and SPIDERS in", "the forest are poison.", "HEAL or a POTION", "cures it."], when: (q) => q.bossDefeated },
      { lines: ["Beasts of the snow can", "freeze you solid. You", "lose your next turn."], when: (q) => q.forestBoss },
      { lines: ["The VOLCANO's beasts", "are made of fire. Most", "of them fear ICE."], when: (q) => q.snowBoss },
    ],
  },
];

// one tag width for every villager, so a single exclusion pass covers them all
const LABEL_W = Math.max(...VILLAGERS.map((v) => v.name.length * LABEL_SIZE * 4));

// Always above the sprite. TownScene.labelY flips a fixed tag below its spot
// near the top so it never hides under the HUD; a villager's flipped tag
// landed right on the hero walking up to talk to it on the top rows, where
// they come and go. Under the HUD it is just hidden, and the dialogue box
// names the speaker anyway.
export function villagerLabelY(y: number): number {
  return y - LABEL_DY;
}

function villagerLabelX(x: number, mapW: number): number {
  return Math.min(Math.max(x, LABEL_W / 2), mapW - LABEL_W / 2);
}

const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Cells a villager may stand on or pass through. Paths only ever step
 * between neighbouring allowed cells, so everything checked at the cell
 * centres here also holds for every point along the way.
 */
export function villagerGrid(
  level: readonly (readonly number[])[],
  avoid: ReadonlyArray<{ x: number; y: number }>,
  zones: readonly MonsterZone[],
  labels: readonly Rect[],
): boolean[][] {
  const mapW = (level[0]?.length ?? 0) * TILE;
  return level.map((row, ty) =>
    row.map((tile, tx) => {
      // tall grass is a monster zone, soil is the farm's crops
      if (SOLID.has(tile) || tile === T_TALL || tile === T_SOIL) return false;
      const cx = tx * TILE + TILE / 2;
      const cy = ty * TILE + TILE / 2;
      if (avoid.some((p) => Math.hypot(p.x - cx, p.y - cy) < AVOID_RADIUS)) return false;
      // the whole ring of cells round each zone too (its tall grass reaches
      // into it, levels.ts ZONE_RIMS), so a villager never brushes a roamer
      if (zones.some((z) => Math.abs(cx - z.cx) <= z.w / 2 + TILE / 2 && Math.abs(cy - z.cy) <= z.h / 2 + TILE / 2)) return false;
      const tag = { x: villagerLabelX(cx, mapW) - LABEL_W / 2, y: villagerLabelY(cy) - LABEL_H / 2, w: LABEL_W, h: LABEL_H };
      return !labels.some((r) =>
        overlaps(tag, { x: r.x - LABEL_MARGIN, y: r.y - LABEL_MARGIN, w: r.w + 2 * LABEL_MARGIN, h: r.h + 2 * LABEL_MARGIN }),
      );
    }),
  );
}

/** BFS step counts from (sx, sy) over allowed cells; -1 where unreachable. */
export function bfs(grid: readonly (readonly boolean[])[], sx: number, sy: number): number[][] {
  const dist = grid.map((row) => row.map(() => -1));
  if (!grid[sy]?.[sx]) return dist;
  dist[sy][sx] = 0;
  const queue: Array<[number, number]> = [[sx, sy]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
      if (!grid[ny]?.[nx] || dist[ny][nx] >= 0) continue;
      dist[ny][nx] = dist[y][x] + 1;
      queue.push([nx, ny]);
    }
  }
  return dist;
}

// walks the distance field back from the target, so the path ends at it
function pathFrom(dist: number[][], tx: number, ty: number): Array<[number, number]> {
  const path: Array<[number, number]> = [];
  let x = tx;
  let y = ty;
  while (dist[y][x] > 0) {
    path.unshift([x, y]);
    const d = dist[y][x];
    const next = (
      [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ] as Array<[number, number]>
    ).find(([nx, ny]) => dist[ny]?.[nx] === d - 1);
    if (!next) break;
    [x, y] = next;
  }
  return path;
}

interface Walker {
  def: VillagerDef;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text;
  // out: strolling; homeward: walking off at dusk; home: gone for the night
  state: "out" | "homeward" | "home";
  path: Array<[number, number]>;
  wait: number;
  frameTime: number;
  frame: number;
  talking: boolean;
  fading: boolean;
  lastHint: number;
}

// Two or three townsfolk who stroll the lanes by day, walk home along the
// roads at dusk and come back after dawn. Nothing here is saved: they
// re-spawn on every Town entry, which is all a bit of background life needs.
export class Villagers {
  private scene: Phaser.Scene;
  private grid: boolean[][];
  private mapW: number;
  private walkers: Walker[] = [];

  constructor(
    scene: Phaser.Scene,
    level: readonly (readonly number[])[],
    avoid: ReadonlyArray<{ x: number; y: number }>,
    zones: readonly MonsterZone[],
    labels: readonly Rect[],
  ) {
    this.scene = scene;
    this.grid = villagerGrid(level, avoid, zones, labels);
    this.mapW = (level[0]?.length ?? 0) * TILE;
    const dark = nightFactor() > 0;
    for (const def of VILLAGERS) {
      // only cells the villager can also walk home from; a map edit that cuts
      // the road off (F2) just leaves that villager out
      const fromHome = bfs(this.grid, def.home.tx, def.home.ty);
      const spots = this.areaCells(def).filter(([x, y]) => fromHome[y][x] > 0);
      if (spots.length === 0) continue;
      const [sx, sy] = dark ? [def.home.tx, def.home.ty] : spots[Math.floor(Math.random() * spots.length)];
      const x = sx * TILE + TILE / 2;
      const y = sy * TILE + TILE / 2;
      const sprite = scene.add.sprite(x, y, `villager-${def.key}-idle`).setDepth(10);
      const shadow = addGroundShadow(scene, sprite);
      const label = scene.add
        .text(x, villagerLabelY(y), def.name, retroStyle(LABEL_SIZE, def.color))
        .setStroke("#1a1028", 4)
        .setOrigin(0.5)
        .setDepth(11)
        .setVisible(false);
      if (dark) {
        sprite.setVisible(false);
        shadow.setVisible(false);
      }
      this.walkers.push({
        def,
        sprite,
        shadow,
        label,
        state: dark ? "home" : "out",
        path: [],
        wait: WAIT_MIN + Math.random() * (WAIT_MAX - WAIT_MIN),
        frameTime: 0,
        frame: 0,
        talking: false,
        fading: false,
        lastHint: -1,
      });
    }
  }

  private areaCells(def: VillagerDef): Array<[number, number]> {
    const cells: Array<[number, number]> = [];
    for (let y = def.area.y0; y <= def.area.y1; y++) {
      for (let x = def.area.x0; x <= def.area.x1; x++) if (this.grid[y]?.[x]) cells.push([x, y]);
    }
    return cells;
  }

  /** Villagers the hero can talk to right now, for tryTalk's nearest-wins pick. */
  talkTargets(): Array<{ index: number; x: number; y: number; name: string; key: VillagerDef["key"] }> {
    return this.walkers
      .map((w, index) => ({ w, index }))
      .filter(({ w }) => w.state !== "home" && !w.fading)
      .map(({ w, index }) => ({ index, x: w.sprite.x, y: w.sprite.y, name: w.def.name, key: w.def.key }));
  }

  /**
   * Stops the villager, turns it toward the hero and returns what it says. It
   * stays put until the dialogue closes (see update's `dialogueActive`).
   */
  talk(index: number, heroX: number): string[] {
    const w = this.walkers[index];
    w.talking = true;
    w.sprite.setTexture(`villager-${w.def.key}-idle`).setFlipX(heroX < w.sprite.x);
    const open = w.def.hints.map((h, i) => ({ h, i })).filter(({ h }) => !h.when || h.when(GameState.quest));
    // never the same hint twice in a row while there's another to give
    const pool = open.length > 1 ? open.filter(({ i }) => i !== w.lastHint) : open;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    w.lastHint = pick.i;
    return pick.h.lines;
  }

  update(delta: number, hero: { x: number; y: number }, dialogueActive: boolean): void {
    // the whole evening ramp, not just isNight(): by the time the overlay is
    // fully dark at 20:00 they've been heading home for half an hour
    const dark = nightFactor() > 0;
    for (const w of this.walkers) {
      if (w.talking && !dialogueActive) w.talking = false;
      if (!w.talking && !w.fading) this.step(w, delta, dark);
      const near = w.sprite.visible && Math.hypot(hero.x - w.sprite.x, hero.y - w.sprite.y) <= TALK_RADIUS;
      w.label.setVisible(near && !w.fading);
      if (near) w.label.setPosition(villagerLabelX(w.sprite.x, this.mapW), villagerLabelY(w.sprite.y));
      w.shadow.setPosition(w.sprite.x, w.sprite.y + 28);
    }
  }

  private step(w: Walker, delta: number, dark: boolean): void {
    const tx = Math.floor(w.sprite.x / TILE);
    const ty = Math.floor(w.sprite.y / TILE);
    if (w.state === "home") {
      if (!dark) this.comeOut(w);
      return;
    }
    if (dark && w.state === "out") {
      w.state = "homeward";
      // finish the step in progress first, then route home from that cell
      w.path = w.path.slice(0, 1);
      const from = w.path[0] ?? [tx, ty];
      w.path.push(...pathFrom(bfs(this.grid, from[0], from[1]), w.def.home.tx, w.def.home.ty));
    }
    if (!dark && w.state === "homeward") {
      // dawn came first (the hero slept): turn round and stroll again
      w.state = "out";
      w.path = w.path.slice(0, 1);
    }
    if (w.path.length === 0) {
      if (w.state === "homeward") {
        this.goIn(w);
        return;
      }
      w.sprite.setTexture(`villager-${w.def.key}-idle`);
      w.wait -= delta;
      if (w.wait > 0) return;
      w.wait = WAIT_MIN + Math.random() * (WAIT_MAX - WAIT_MIN);
      w.path = this.pickStroll(w, tx, ty);
      return;
    }
    const [nx, ny] = w.path[0];
    const gx = nx * TILE + TILE / 2;
    const gy = ny * TILE + TILE / 2;
    const dx = gx - w.sprite.x;
    const dy = gy - w.sprite.y;
    const dist = Math.hypot(dx, dy);
    const move = (SPEED * delta) / 1000;
    if (dist <= move) {
      w.sprite.setPosition(gx, gy);
      w.path.shift();
    } else {
      w.sprite.setPosition(w.sprite.x + (dx / dist) * move, w.sprite.y + (dy / dist) * move);
    }
    if (dx !== 0) w.sprite.setFlipX(dx < 0);
    w.frameTime += delta;
    if (w.frameTime >= FRAME_MS) {
      w.frameTime = 0;
      w.frame = 1 - w.frame;
    }
    w.sprite.setTexture(`villager-${w.def.key}-${w.frame}`);
  }

  // a short walk to another cell of its own area; from outside the area (just
  // back from home) any reachable cell in it, however far
  private pickStroll(w: Walker, tx: number, ty: number): Array<[number, number]> {
    const dist = bfs(this.grid, tx, ty);
    const a = w.def.area;
    const inArea = tx >= a.x0 && tx <= a.x1 && ty >= a.y0 && ty <= a.y1;
    const options = this.areaCells(w.def).filter(([x, y]) => dist[y][x] > 1 && (!inArea || dist[y][x] <= STROLL_MAX));
    if (options.length === 0) return [];
    const [gx, gy] = options[Math.floor(Math.random() * options.length)];
    return pathFrom(dist, gx, gy);
  }

  private goIn(w: Walker): void {
    w.fading = true;
    w.sprite.setTexture(`villager-${w.def.key}-idle`);
    this.scene.tweens.add({
      targets: [w.sprite, w.shadow],
      alpha: 0,
      duration: FADE_MS,
      onComplete: () => {
        w.fading = false;
        w.state = "home";
        w.sprite.setVisible(false);
        w.shadow.setVisible(false);
      },
    });
  }

  private comeOut(w: Walker): void {
    w.fading = true;
    w.state = "out";
    w.path = [];
    w.wait = 0;
    w.sprite
      .setPosition(w.def.home.tx * TILE + TILE / 2, w.def.home.ty * TILE + TILE / 2)
      .setAlpha(0)
      .setVisible(true);
    w.shadow.setAlpha(0).setVisible(true);
    this.scene.tweens.add({ targets: w.sprite, alpha: 1, duration: FADE_MS });
    this.scene.tweens.add({
      targets: w.shadow,
      alpha: 0.4,
      duration: FADE_MS,
      onComplete: () => {
        w.fading = false;
      },
    });
  }

  destroy(): void {
    for (const w of this.walkers) {
      w.sprite.destroy();
      w.shadow.destroy();
      w.label.destroy();
    }
  }
}
