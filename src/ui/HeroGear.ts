import type Phaser from "phaser";
import { GameState } from "../gameState";

export type Facing = "down" | "up" | "right" | "left";

interface Place {
  // offset of the gear sprite's centre from the hero's, in screen px at
  // scale 1: the gear art (BootScene EQUIP_*_32, Blacksmith) puts the hand's
  // grip at its centre cell, so this is where the hand is
  x: number;
  y: number;
  flip: boolean;
  // drawn over the hero (true) or behind it (false)
  above: boolean;
}

// Where the hero holds its gear, per facing. The hands are the 32-cell
// hero's cells 4-5 and 26-27 on rows 24-27, i.e. 22px either side of its
// centre and 18-20px below it, so the shield (16x20px, about a third of the
// hero's width) hangs at the hand beside the body and the blade rises from
// the other hand up and out, both clear of the face. Facing the camera both
// are in front; from behind the shield is slung on the back and the blade is
// behind the body; side on, the leading hand's blade is in front and the
// trailing hand's shield behind.
export const GEAR_LAYOUT: Record<Facing, { weapon: Place; shield: Place }> = {
  down: { weapon: { x: 22, y: 18, flip: false, above: true }, shield: { x: -22, y: 18, flip: false, above: true } },
  up: { weapon: { x: 22, y: 18, flip: false, above: false }, shield: { x: 0, y: 10, flip: false, above: true } },
  right: { weapon: { x: 22, y: 18, flip: false, above: true }, shield: { x: -22, y: 18, flip: false, above: false } },
  left: { weapon: { x: -22, y: 18, flip: true, above: true }, shield: { x: 22, y: 18, flip: true, above: false } },
};

type GearSprite = Phaser.GameObjects.Sprite;

/**
 * Puts the worn weapon and shield (or the GLACIER MAIL, which wears in the
 * shield's place) where `hero`, facing `facing`, holds them: texture,
 * visibility, side, flip and depth just over or under the hero's own.
 */
export function placeHeroGear(weapon: GearSprite, shield: GearSprite, hero: { x: number; y: number; depth: number }, facing: Facing): void {
  const layout = GEAR_LAYOUT[facing];
  weapon.setVisible(!!GameState.equipped.weapon).setTexture(GameState.weaponTexture());
  shield.setVisible(!!GameState.equipped.armor).setTexture(GameState.armorTexture());
  for (const [sprite, place] of [
    [weapon, layout.weapon],
    [shield, layout.shield],
  ] as const) {
    sprite
      .setFlipX(place.flip)
      .setPosition(hero.x + place.x, hero.y + place.y)
      .setDepth(hero.depth + (place.above ? 0.5 : -0.5));
  }
}
