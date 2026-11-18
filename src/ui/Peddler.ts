import Phaser from "phaser";
import { Sfx } from "../audio";
import { econDay, GameState } from "../gameState";
import { buyFromPeddler, type PeddlerOffer, type PeddlerRegion, peddlerRegion, peddlerSold, peddlerStock } from "../peddler";
import { FIELD_TOAST_Y, retroStyle, showToast } from "../pixelart";
import { justBackFromFight } from "../sceneCommon";
import type { DialogueBox } from "./DialogueBox";

// how close (px, centre to centre) the hero has to stand for Z to reach him:
// any of the eight cells round his (ui/Shrine.ts's PRAY_RADIUS)
const TALK_RADIUS = 96;
// the tag over his head, in the map tags' look and at their depth (11):
// "PEDDLER" at retroStyle(5) is 140x20
const TAG_RISE = 40;

/**
 * The PEDDLER in the field that is his today (peddler.ts), and nothing on any
 * other day: `at` returns null then. He stands under his "PEDDLER" tag, solid
 * to the hero, and Z beside him asks which of the day's two offers — PIECES
 * or the DEAL — then YES or NO to its price; each sells once a day.
 *
 * The day is the one the field was built on: a midnight passed in the field
 * leaves him standing with that day's goods until the hero leaves.
 *
 * `dialogue`, `ownKey`, `blocked` and tryTalk() are as ui/Shrine.ts's:
 * the scene's own box; his own Z listener where the scene's Z does nothing
 * else, tryTalk() from the scene's Z where it does. `bought` runs after a
 * sale, for the scene to hold off its fights while the toast is read.
 */
export class Peddler {
  private scene: Phaser.Scene;
  private hero: { x: number; y: number };
  private dialogue: DialogueBox;
  private at: { x: number; y: number };
  private day: number;
  private stock: [PeddlerOffer, PeddlerOffer];
  private bought?: () => void;
  private zQueued = false;

  /** Whether he stands in `region` today. */
  static here(region: PeddlerRegion): boolean {
    return peddlerRegion(econDay(), GameState) === region;
  }

  constructor(
    scene: Phaser.Scene,
    at: { x: number; y: number },
    hero: Phaser.Physics.Arcade.Sprite,
    dialogue: DialogueBox,
    opts: { ownKey?: boolean; blocked?: () => boolean; bought?: () => void } = {},
  ) {
    this.scene = scene;
    this.hero = hero;
    this.dialogue = dialogue;
    this.at = at;
    this.bought = opts.bought;
    this.day = econDay();
    this.stock = peddlerStock(this.day, GameState.quest);
    // an NPC as the town's are: at the hero's depth, his feet the body
    const npc = scene.physics.add.staticImage(at.x, at.y, "npc-peddler").setDepth(10);
    (npc.body as Phaser.Physics.Arcade.StaticBody).setSize(40, 28, false).setOffset(12, 34);
    scene.physics.add.collider(hero, npc);
    scene.add
      .pixelText(at.x, at.y - TAG_RISE, "PEDDLER", retroStyle(5, "#4fd1c0"))
      .setOrigin(0.5, 1)
      .setStroke("#1a1028", 4)
      .setDepth(11);
    if (!opts.ownKey) return;
    // queued at the keydown unless a panel is up (the Z that closes a talk),
    // opened after the frame's update (ui/Shrine.ts)
    scene.input.keyboard
      ?.addKey(Phaser.Input.Keyboard.KeyCodes.Z)
      .on(Phaser.Input.Keyboard.Events.DOWN, (_k: unknown, e: KeyboardEvent) => {
        if (!e.repeat && !opts.blocked?.()) this.zQueued = true;
      });
    const onUpdate = (): void => {
      const z = this.zQueued;
      this.zQueued = false;
      if (z && !opts.blocked?.()) this.tryTalk();
    };
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, onUpdate));
  }

  /** Starts his talk if the hero stands by him; false when not. */
  tryTalk(): boolean {
    if (justBackFromFight(this.scene)) return false;
    if (Math.hypot(this.at.x - this.hero.x, this.at.y - this.hero.y) > TALK_RADIUS) return false;
    const [pieces, deal] = this.stock;
    const sold = [peddlerSold(GameState, this.day, 0), peddlerSold(GameState, this.day, 1)];
    if (sold[0] && sold[1]) {
      this.dialogue.start(["That's all I carried today.", "Look for me again tomorrow."], "PEDDLER");
      return true;
    }
    Sfx.buy();
    const line = (o: PeddlerOffer, i: number): string => (sold[i] ? `${o.label}: sold.` : `${o.label} for ${o.price} G.`);
    // The longest ("2 SPIDER SILK for 1170 G." is not a pair, but 2 FROST
    // SCALE at 1170 and 3 HI-POTION at 60 are: 25 + 22 glyphs) pack into two
    // rows of the touch box's 42. ESC (pick 2, past both) walks away.
    this.dialogue.ask(
      ["Goods you won't find in town, today only.", line(pieces, 0), line(deal, 1), "Which?"],
      "PEDDLER",
      ["PIECES", "DEAL"],
      (i) => {
        if (i === 0 || i === 1) this.offer(i);
      },
      2,
    );
    return true;
  }

  private offer(which: 0 | 1): void {
    const o = this.stock[which];
    if (peddlerSold(GameState, this.day, which)) {
      this.dialogue.start(["Sold that one already. Tomorrow, maybe."], "PEDDLER");
      return;
    }
    if (GameState.gold < o.price) {
      Sfx.error();
      this.dialogue.start([`${o.price} G for those. You have ${GameState.gold}.`], "PEDDLER");
      return;
    }
    // "2 FROST SCALE for 1170 G?" is 25 glyphs: the last page's one touch row
    this.dialogue.ask([`${o.label} for ${o.price} G?`], "PEDDLER", ["YES", "NO"], (i) => {
      if (i !== 0 || !buyFromPeddler(GameState, o, this.day, which)) return;
      Sfx.buy();
      // news (the "!"); before the save, so its "SAVED" queues behind
      showToast(this.scene, `BOUGHT ${o.label}!`, FIELD_TOAST_Y);
      GameState.save();
      this.bought?.();
    });
  }
}
