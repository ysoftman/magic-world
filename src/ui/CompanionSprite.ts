import Phaser from "phaser";
import { GameState } from "../gameState";
import { TILE } from "../levels";
import { ENEMIES } from "../monsters";

// How far behind the hero, along the path the hero actually walked, the
// companion keeps: a body's width (the hero's is 40px) plus a little air, so
// the two never overlap and a corner is cut the way the hero cut it.
const FOLLOW_GAP = 44;
// the hero's path is sampled each time it has moved this far
const TRAIL_STEP = 4;
// a hero jump longer than this between two frames is a teleport (a door, a
// stair, the battle's escape from a zone), not a walk: start over beside them
const TELEPORT = TILE * 1.5;
// where the companion appears on entry or after a teleport, the same gap
// away: off the hero's left shoulder, else the first of the others clear of
// a wall, water or tree (an ABYSS landing is often against the west wall)
const BESIDE = [
  { dx: -FOLLOW_GAP, dy: 4 },
  { dx: FOLLOW_GAP, dy: 4 },
  { dx: 0, dy: FOLLOW_GAP },
  { dx: 0, dy: -FOLLOW_GAP },
];
// a pet, not a second hero: the hero sprite is 64px, the field textures too
const SCALE = 0.75;
// a hop per step while walking, still when the hero stops
const HOP_PX = 4;
const HOP_MS = 280;
const SHADOW_DY = 22;

/**
 * The companion chosen in the Bestiary (B), trailing the hero in every
 * walkable scene. Purely cosmetic and collides with nothing — battle still
 * reads GameState.companion itself for the companion's attack. It walks the
 * hero's own path FOLLOW_GAP behind, stops when the hero stops, turns to the
 * way it walks, hops while it walks (not with reduced motion), and sorts in
 * front of or behind the hero by y. A change in the Bestiary shows at once,
 * even behind an open panel: it re-checks GameState.companion every frame
 * after the update, while update() only feeds it the hero's position.
 */
export class CompanionSprite {
  private scene: Phaser.Scene;
  private sprite: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Ellipse;
  // the hero's path, oldest first, the last point being where the hero is
  private trail: Array<{ x: number; y: number }> = [];
  private hero: { x: number; y: number };
  private currentName: string | null = null;
  // where the companion stood last frame, before its hop
  private last: { x: number; y: number };
  private walking = 0;
  private readonly calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  private readonly onPostUpdate = (_time: number, delta: number): void => this.step(delta);

  constructor(scene: Phaser.Scene, startX: number, startY: number) {
    this.scene = scene;
    this.hero = { x: startX, y: startY };
    this.shadow = scene.add.ellipse(startX, startY, 30, 12, 0x000000, 0.35).setDepth(5).setVisible(false);
    this.sprite = scene.add.sprite(startX, startY, "slime").setScale(SCALE).setVisible(false);
    this.placeBeside();
    this.last = { ...this.trail[0] };
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  update(playerX: number, playerY: number): void {
    if (Math.hypot(playerX - this.hero.x, playerY - this.hero.y) > TELEPORT) {
      this.hero = { x: playerX, y: playerY };
      this.placeBeside();
      return;
    }
    this.hero = { x: playerX, y: playerY };
    const last = this.trail[this.trail.length - 1];
    if (Math.hypot(playerX - last.x, playerY - last.y) >= TRAIL_STEP) this.trail.push({ x: playerX, y: playerY });
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate);
    this.sprite.destroy();
    this.shadow.destroy();
  }

  // a fresh path that starts beside the hero and runs to them
  private placeBeside(): void {
    const spots = BESIDE.map(({ dx, dy }) => ({ x: this.hero.x + dx, y: this.hero.y + dy }));
    this.trail = [spots.find((p) => !this.solidAt(p.x, p.y)) ?? spots[0], { ...this.hero }];
    this.walking = 0;
  }

  // anything solid on any of the scene's tile layers, whatever it calls them
  private solidAt(x: number, y: number): boolean {
    return this.scene.children.list.some(
      (o) => o instanceof Phaser.Tilemaps.TilemapLayer && (o.getTileAtWorldXY(x, y, true)?.collides ?? false),
    );
  }

  private step(delta: number): void {
    if (GameState.companion !== this.currentName) {
      this.currentName = GameState.companion;
      const def = this.currentName ? Object.values(ENEMIES).find((e) => e.name === this.currentName) : undefined;
      if (def) this.sprite.setTexture(def.texture).setTint(def.tint ?? 0xffffff);
      else this.currentName = null;
    }
    const shown = this.currentName !== null;
    this.sprite.setVisible(shown);
    this.shadow.setVisible(shown);
    if (!shown) return;

    // the point FOLLOW_GAP back along the trail from the hero, and the trail
    // trimmed to just past it
    let left = FOLLOW_GAP;
    let at = { ...this.trail[0] };
    for (let i = this.trail.length - 1; i > 0; i--) {
      const a = this.trail[i];
      const b = this.trail[i - 1];
      const seg = Math.hypot(a.x - b.x, a.y - b.y);
      if (seg >= left) {
        const t = left / seg;
        at = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        this.trail.splice(0, i - 1);
        break;
      }
      left -= seg;
    }

    const dx = at.x - this.last.x;
    this.walking = Math.abs(dx) + Math.abs(at.y - this.last.y) > 0.3 ? this.walking + delta : 0;
    // the field textures face left, toward the hero in battle
    if (dx > 0.3) this.sprite.setFlipX(true);
    else if (dx < -0.3) this.sprite.setFlipX(false);
    this.last = at;
    this.sprite.setPosition(at.x, at.y - this.hop());
    this.shadow.setPosition(at.x, at.y + SHADOW_DY);
    // the hero stands at depth 10: in front of them when lower on the screen
    this.sprite.setDepth(at.y > this.hero.y ? 10.5 : 9.5);
  }

  private hop(): number {
    if (this.calm || this.walking === 0) return 0;
    return Math.abs(Math.sin((this.walking / HOP_MS) * Math.PI)) * HOP_PX;
  }
}
