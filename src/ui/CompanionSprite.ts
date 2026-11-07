import Phaser from "phaser";
import { GameState } from "../gameState";
import { TILE } from "../levels";
import { ENEMIES } from "../monsters";
import { stepEllipse } from "../pixelart";

// How far behind the hero, along the path the hero actually walked, the
// companion keeps (gapFor): half the hero's body (its 40px), half the
// companion's texture at SCALE and a little air, so the two never overlap
// side by side and a corner is cut the way the hero cut it. A 64px companion
// keeps 56px back, the TROLL KING (96px) 72px.
const HERO_HALF = 20;
const AIR = 4;
const gapFor = (width: number): number => HERO_HALF + (width * SCALE) / 2 + AIR;
// the hero's path is sampled each time it has moved this far
const TRAIL_STEP = 4;
// a hero jump longer than this between two frames is a teleport (a door, a
// stair, the battle's escape from a zone), not a walk: start over beside them
const TELEPORT = TILE * 1.5;
// where the companion appears on entry or after a teleport, the same gap
// away: off the hero's left shoulder, else the first of the others clear of
// a wall, water or tree (an ABYSS landing is often against the west wall)
const besideAt = (gap: number) => [
  { dx: -gap, dy: 4 },
  { dx: gap, dy: 4 },
  { dx: 0, dy: gap },
  { dx: 0, dy: -gap },
];
// Its field art as the map draws a roamer of its kind, 1x: a 32-cell grid at
// ART_PX, a cell 2px as the hero's and every other sprite's, so a pet the
// hero's size (64px; the TROLL KING, a giant, 96px as it roams the town). At
// 0.75 its cells were 1.5px, 1px and 2px columns by turns.
const SCALE = 1;
// its shadow: the hero's own (pixelart.ts addGroundShadow) under a 64px
// texture, in proportion under a bigger one
const SHADOW_W = 40;
const SHADOW_H = 16;
const SHADOW_DY = 28;
// a hop per step while walking, still when the hero stops
const HOP_PX = 4;
const HOP_MS = 280;

/**
 * The companion chosen in the Bestiary (B), trailing the hero in every
 * walkable scene. Purely cosmetic and collides with nothing — battle still
 * reads GameState.companion itself for the companion's attack. It walks the
 * hero's own path a gap behind (gapFor), stops when the hero stops, turns to
 * the way it walks, hops while it walks (not with reduced motion), and sorts
 * in front of or behind the hero by y. A change in the Bestiary shows at once,
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
  // how far behind the hero it keeps and its shadow under it, for its texture
  private gap = gapFor(64);
  private shadowDy = SHADOW_DY;
  private readonly calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  private readonly onPostUpdate = (_time: number, delta: number): void => this.step(delta);

  constructor(scene: Phaser.Scene, startX: number, startY: number) {
    this.scene = scene;
    this.hero = { x: startX, y: startY };
    // in rows of 2px as the hero's (pixelart.ts stepEllipse)
    this.shadow = stepEllipse(scene.add.ellipse(startX, startY, SHADOW_W, SHADOW_H, 0x000000, 0.35).setDepth(5).setVisible(false));
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

  /**
   * How much of it shows, its shadow with it: a portal's warp (ui/warpFx.ts)
   * fades it out with the hero and back in after. Its visibility stays
   * step()'s, and a new scene's companion starts at 1.
   */
  setAlpha(alpha: number): void {
    this.sprite.setAlpha(alpha);
    this.shadow.setAlpha(alpha);
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate);
    this.sprite.destroy();
    this.shadow.destroy();
  }

  // a fresh path that starts beside the hero and runs to them
  private placeBeside(): void {
    const spots = besideAt(this.gap).map(({ dx, dy }) => ({ x: this.hero.x + dx, y: this.hero.y + dy }));
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
      if (def) this.fit(def.texture);
      else this.currentName = null;
    }
    const shown = this.currentName !== null;
    this.sprite.setVisible(shown);
    this.shadow.setVisible(shown);
    if (!shown) return;

    // the point a gap back along the trail from the hero, and the trail
    // trimmed to just past it
    let left = this.gap;
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
    this.shadow.setPosition(at.x, at.y + this.shadowDy);
    // the hero stands at depth 10: in front of them when lower on the screen
    this.sprite.setDepth(at.y > this.hero.y ? 10.5 : 9.5);
  }

  // a new companion's texture, its gap behind the hero and its shadow
  private fit(texture: string): void {
    this.sprite.setTexture(texture);
    const k = (this.sprite.height * SCALE) / 64;
    this.gap = gapFor(this.sprite.width);
    this.shadow.setSize(SHADOW_W * k, SHADOW_H * k);
    this.shadowDy = SHADOW_DY * k;
  }

  private hop(): number {
    if (this.calm || this.walking === 0) return 0;
    return Math.abs(Math.sin((this.walking / HOP_MS) * Math.PI)) * HOP_PX;
  }
}
