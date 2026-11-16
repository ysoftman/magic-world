import Phaser from "phaser";
import { type MonsterZone, TILE } from "../levels";
import { FIELD_TOAST_Y, retroStyle, showToast } from "../pixelart";
import { hop, isWalkableCell } from "../sceneCommon";

// A runner: now and then a field's jackpot monster (the cave's CURSED GOBLIN,
// the forest's SILVER WASP, the snow field's AURORA MOTH, the volcano's GILDED
// IMP, which is met no other way) stands out in the
// open, away from the monster zones, where the hero can see it. It idles
// until the hero comes within NOTICE, then runs — "!" over its head — and
// the hero has FLEE_MS to run it down before it is gone. Touching it is the
// fight (the scene's own startBattle), the jackpot's ordinary one.
//
// The chase. It runs cell to cell over the same walkable grid the hero
// walks, always to the neighbour farthest from the hero, at RUN_SPEED: faster
// than the hero along a row or a column (240) and slower than the hero's
// diagonal (339), so it is not caught by following it but by cutting its
// corners and by the walls it has to turn along. It knows nothing of dead
// ends, so it can be driven into one. The monster zones are open to it and
// their roamers still start their own fights, which ends the chase (the
// field is built again after a fight): the short way to it is not always the
// one to take. No random fight starts while it runs (fleeing(), the scenes'
// checkEncounter): a chase lost to a dice roll was nobody's fault.
//
// The speed was set by a bot that only ever walks straight at it, from 5
// cells off (headless, the three fields in turn): at 200-270 it caught every
// one within 1.2-4.4s of the "!", at 310 four of nine, at 290 six of eleven
// in 1.1-4.9s, the rest gone at the 10s. A player who heads it off does
// better than the bot. The volcano's lava leaves fewer ways to run: the bot
// caught five of five there.
//
// How often. RUNNER_CHANCE of a field's builds: on arrival 12%, back from a
// fight 2.5% — at ~130 fights an hour about three an hour, a field's jackpot
// each (108G in the cave, 168G in the forest, 456G in the snow field, 792G
// in the volcano): some 320G, 500G, 1370G and 2380G an hour more if every
// one is caught (the volcano hunts 8.5-9.0k an hour, cooking.ts), less the chases
// lost and the ~10s each takes. Not run through the balance sim. The
// jackpots' own 3.5% among their kind's roamers stays as it was.
export const RUNNER_CHANCE = { arrival: 0.12, back: 0.025 };

const NOTICE = 3 * TILE;
const RUN_SPEED = 290;
const IDLE_SPEED = 60;
const FLEE_MS = 10000;
// spawned this many cells or more (either axis) from the hero, so it is
// found by walking, and its own 3 from a way out
const SPAWN_CLEAR = 6;
const EXIT_CLEAR = 3;
const ALARM_MS = 700;

type Point = { x: number; y: number };
type Cell = [number, number];

const cellOf = (p: Point): Cell => [Math.floor(p.x / TILE), Math.floor(p.y / TILE)];
const centre = ([tx, ty]: Cell): Point => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
const STEPS: Cell[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export interface RunnerOpts {
  // back from a fight rather than arriving (RUNNER_CHANCE)
  back: boolean;
  // cells solid without being solid tiles (the shrine)
  walls: readonly Point[];
  // the ways out: it neither spawns near one nor runs onto its cell
  exits: readonly Point[];
  // it spawns outside these (and a tile round them); it may run through
  zones: readonly MonsterZone[];
  // a panel, a talk or a scene change: it stands
  paused: () => boolean;
  // the hero has run it down
  caught: () => void;
}

export class FieldRunner {
  private scene: Phaser.Scene;
  private hero: Point;
  private sprite: Phaser.Physics.Arcade.Sprite;
  // where it may run, and where it idles: clear of the monster zones, so it
  // never strolls into a pack or a boss's lair before anyone has seen it
  private open: (tx: number, ty: number) => boolean;
  private calm: (tx: number, ty: number) => boolean;
  private paused: () => boolean;
  private target: Point;
  private wait = 800;
  private alarmed = false;
  private fleeMs = 0;
  private gone = false;

  /** A runner drawn as `texture`, by RUNNER_CHANCE and if the field has a place for one; else null. */
  static roll(
    scene: Phaser.Scene,
    hero: Phaser.Physics.Arcade.Sprite,
    level: readonly (readonly number[])[],
    texture: string,
    opts: RunnerOpts,
  ): FieldRunner | null {
    if (Math.random() >= (opts.back ? RUNNER_CHANCE.back : RUNNER_CHANCE.arrival)) return null;
    const blocked = new Set([...opts.walls, ...opts.exits].map((p) => cellOf(p).join(",")));
    const open = (tx: number, ty: number): boolean => isWalkableCell(level, tx, ty) && !blocked.has(`${tx},${ty}`);
    // every cell the hero can walk to
    const [hx, hy] = cellOf(hero);
    const reached = new Set([`${hx},${hy}`]);
    const queue: Cell[] = [[hx, hy]];
    const spots: Cell[] = [];
    const inZone = (p: Point): boolean =>
      opts.zones.some((z) => Math.abs(p.x - z.cx) <= z.w / 2 + TILE && Math.abs(p.y - z.cy) <= z.h / 2 + TILE);
    while (queue.length > 0) {
      const [x, y] = queue.pop() as Cell;
      const far = Math.max(Math.abs(x - hx), Math.abs(y - hy)) >= SPAWN_CLEAR;
      const byExit = opts.exits.some((p) => Math.max(Math.abs(cellOf(p)[0] - x), Math.abs(cellOf(p)[1] - y)) <= EXIT_CLEAR);
      if (far && !byExit && !inZone(centre([x, y]))) spots.push([x, y]);
      for (const [dx, dy] of STEPS) {
        const k = `${x + dx},${y + dy}`;
        if (!reached.has(k) && open(x + dx, y + dy)) {
          reached.add(k);
          queue.push([x + dx, y + dy]);
        }
      }
    }
    if (spots.length === 0) return null;
    const calm = (tx: number, ty: number): boolean => open(tx, ty) && !inZone(centre([tx, ty]));
    return new FieldRunner(scene, hero, texture, centre(spots[Math.floor(Math.random() * spots.length)]), open, calm, opts);
  }

  private constructor(
    scene: Phaser.Scene,
    hero: Phaser.Physics.Arcade.Sprite,
    texture: string,
    at: Point,
    open: (tx: number, ty: number) => boolean,
    calm: (tx: number, ty: number) => boolean,
    opts: RunnerOpts,
  ) {
    this.scene = scene;
    this.hero = hero;
    this.open = open;
    this.calm = calm;
    this.paused = opts.paused;
    this.target = at;
    // a roamer in every way but where it goes: its depth, hit box and hop
    this.sprite = scene.physics.add.sprite(at.x, at.y, texture).setDepth(10);
    this.sprite.body?.setSize(40, 24).setOffset(12, 32);
    hop(scene, this.sprite);
    scene.physics.add.overlap(hero, this.sprite, () => {
      if (!this.gone && !this.paused()) opts.caught();
    });
    const onUpdate = (_time: number, delta: number): void => this.step(delta);
    scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate));
  }

  /** Running from the hero: the scene rolls no random fight meanwhile. */
  fleeing(): boolean {
    return this.alarmed && !this.gone;
  }

  private step(delta: number): void {
    if (this.gone) return;
    const s = this.sprite;
    if (this.paused()) {
      s.setVelocity(0, 0);
      return;
    }
    if (!this.alarmed && Math.hypot(this.hero.x - s.x, this.hero.y - s.y) < NOTICE) this.alarm();
    if (this.alarmed) {
      this.fleeMs += delta;
      if (this.fleeMs >= FLEE_MS) {
        this.escape();
        return;
      }
    }
    const dx = this.target.x - s.x;
    const dy = this.target.y - s.y;
    const dist = Math.hypot(dx, dy);
    const speed = this.alarmed ? RUN_SPEED : IDLE_SPEED;
    if (dist > Math.max(2, (speed * delta) / 1000)) {
      s.setVelocity((dx / dist) * speed, (dy / dist) * speed);
      return;
    }
    // on its cell: the next one, at once when running, after a pause when not
    s.setPosition(this.target.x, this.target.y).setVelocity(0, 0);
    if (!this.alarmed) {
      this.wait -= delta;
      if (this.wait > 0) return;
      this.wait = 600 + Math.random() * 1200;
    }
    this.target = this.next();
    // off at once: a frame stood on every cell was a fifteenth of its speed
    const [nx, ny] = [this.target.x - s.x, this.target.y - s.y];
    const n = Math.hypot(nx, ny);
    if (n > 0) s.setVelocity((nx / n) * speed, (ny / n) * speed);
  }

  // The neighbour cell farthest from the hero when running (its own when
  // every way is nearer: cornered), any neighbour when idling
  private next(): Point {
    const [tx, ty] = cellOf(this.sprite);
    const around = STEPS.map(([dx, dy]): Cell => [tx + dx, ty + dy]);
    if (!this.alarmed) {
      const strolls = around.filter(([x, y]) => this.calm(x, y));
      return centre(strolls[Math.floor(Math.random() * strolls.length)] ?? [tx, ty]);
    }
    const ways = around.filter(([x, y]) => this.open(x, y));
    const from = (c: Cell): number => Math.hypot(centre(c).x - this.hero.x, centre(c).y - this.hero.y);
    let best: Cell = [tx, ty];
    // a little noise breaks ties, so it doesn't always turn the same way
    let far = from(best);
    for (const c of ways) {
      const d = from(c) + Math.random() * 8;
      if (d > far) {
        far = d;
        best = c;
      }
    }
    return centre(best);
  }

  private alarm(): void {
    this.alarmed = true;
    const s = this.sprite;
    const mark = this.scene.add
      .pixelText(s.x, s.y - 40, "!", retroStyle(6, "#fde047"))
      .setOrigin(0.5, 1)
      .setStroke("#1a1028", 4)
      .setDepth(11);
    const follow = (): void => {
      mark.setPosition(s.x, s.y - 40);
    };
    this.scene.events.on(Phaser.Scenes.Events.POST_UPDATE, follow);
    const drop = (): void => {
      this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, follow);
      mark.destroy();
    };
    const timer = this.scene.time.delayedCall(ALARM_MS, drop);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      timer.remove();
      this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, follow);
    });
  }

  // out of time: it is gone, and says so (a status line: no "!")
  private escape(): void {
    this.gone = true;
    const s = this.sprite;
    s.setVelocity(0, 0);
    if (s.body) s.body.enable = false;
    this.scene.tweens.add({ targets: s, alpha: 0, duration: 300, onComplete: () => s.setVisible(false) });
    showToast(this.scene, "IT GOT AWAY", FIELD_TOAST_Y);
  }
}
