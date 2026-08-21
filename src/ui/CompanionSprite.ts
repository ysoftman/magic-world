import type Phaser from "phaser";
import { GameState } from "../gameState";
import { ENEMIES } from "../monsters";

// Frames of position history sampled once per update(); the companion always
// steps into the oldest one, which reads as "walking a pace behind" instead
// of glued to the hero's heels.
const TRAIL_LENGTH = 14;

// Shown in every walkable scene once the player has a companion (set via the
// Bestiary), trailing a short delay behind the player's own path. Purely
// cosmetic — battle still looks up GameState.companion itself for the
// in-battle companion attack.
export class CompanionSprite {
  private sprite: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Ellipse;
  private history: Array<{ x: number; y: number }> = [];
  private currentName: string | null = null;

  constructor(scene: Phaser.Scene, startX: number, startY: number) {
    this.shadow = scene.add
      .ellipse(startX, startY + 24, 30, 12, 0x000000, 0.35)
      .setDepth(5)
      .setVisible(false);
    this.sprite = scene.add.sprite(startX, startY, "slime").setDepth(9).setScale(0.8).setVisible(false);
  }

  update(playerX: number, playerY: number): void {
    if (GameState.companion !== this.currentName) {
      this.currentName = GameState.companion;
      this.history = [];
      if (this.currentName) {
        const def = Object.values(ENEMIES).find((e) => e.name === this.currentName);
        if (def) {
          this.sprite.setTexture(def.texture);
          this.sprite.setTint(def.tint ?? 0xffffff);
        }
      }
    }
    const visible = !!this.currentName;
    this.sprite.setVisible(visible);
    this.shadow.setVisible(visible);
    if (!visible) return;

    this.history.push({ x: playerX, y: playerY });
    if (this.history.length > TRAIL_LENGTH) this.history.shift();
    const target = this.history[0];
    this.sprite.setPosition(target.x, target.y);
    this.shadow.setPosition(target.x, target.y + 24);
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
