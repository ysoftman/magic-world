import Phaser from "phaser";
import { Sfx } from "../audio";
import { econDay, GameState } from "../gameState";
import { FIELD_TOAST_Y, retroStyle, showToast } from "../pixelart";
import type { PixelText } from "../pixelText";
import { justBackFromFight } from "../sceneCommon";
import { BLESSING_BATTLES, BLESSINGS, type BlessingKey, pray, SHRINES, type ShrineRegion, shrineSpent } from "../shrine";
import type { DialogueBox } from "./DialogueBox";

// how close (px, centre to centre) the hero has to stand for Z to reach the
// stone: any of the eight cells round it (a diagonal is 91px), and short of a
// treasure map's X, which treasure.ts keeps 3 cells (192px) off — less its
// own 72px dig radius, so one Z never both digs and prays
const PRAY_RADIUS = 96;
// The stone is 96px, its foot on its tile's and its top half a tile over it:
// drawn 14px above the tile's middle
const STONE_RISE = 14;
// The tag over the stone, in the map tags' look and at their depth (11):
// "SHRINE" at retroStyle(5) is 120x20, its foot 8px over the stone's top
const TAG_RISE = 70;
// the stone's depth: with the chests, under the hero (10) who stands before
// it; over one who walks behind it, still under the guide arrow (10.5)
const DEPTH_BEHIND_HERO = 9;
const DEPTH_OVER_HERO = 10.4;
const TAG_LIT = "#7dd3fc";
// DIM_TEXT's grey: the day's offering made
const TAG_SPENT = "#808096";

/**
 * A field's shrine (shrine.ts): the stone, solid to the hero, under its
 * "SHRINE" tag, and the talk Z starts beside it — which of its two blessings,
 * then YES or NO to the offering. The rune is lit while the shrine will still
 * hear today's offering and dark once it has, turning back with the day.
 *
 * `dialogue` is the scene's own box (in its FieldPanels, so the hero stands
 * and the tags go while it talks). A scene whose Z already does something
 * (the snow field's dig and ice hole) calls tryPray() from its own Z and
 * stops if it prayed; one where Z does nothing else passes `ownKey` and this
 * listens itself, held off while `blocked()` says a panel is up or the scene
 * is leaving. `prayed` runs after an offering, for the scene to hold off its
 * fights while the toast is read.
 */
export class Shrine {
  private scene: Phaser.Scene;
  private region: ShrineRegion;
  private hero: { x: number; y: number };
  private dialogue: DialogueBox;
  private prayed?: () => void;
  private at: { x: number; y: number };
  private stone: Phaser.Physics.Arcade.Image;
  private tag: PixelText;
  private spent: boolean | null = null;
  private zQueued = false;

  constructor(
    scene: Phaser.Scene,
    region: ShrineRegion,
    at: { x: number; y: number },
    hero: Phaser.Physics.Arcade.Sprite,
    dialogue: DialogueBox,
    opts: { ownKey?: boolean; blocked?: () => boolean; prayed?: () => void } = {},
  ) {
    this.scene = scene;
    this.region = region;
    this.hero = hero;
    this.dialogue = dialogue;
    this.prayed = opts.prayed;
    // the body is the steps and the stone's lower third (56x38 of the 96px
    // picture, y -10..+28 of the tile's middle): the hero stops at its foot
    // and walks behind no more than its upper half
    this.at = at;
    this.stone = scene.physics.add.staticImage(at.x, at.y - STONE_RISE, "shrine").setDepth(DEPTH_BEHIND_HERO);
    (this.stone.body as Phaser.Physics.Arcade.StaticBody).setSize(56, 38, false).setOffset(20, 52);
    scene.physics.add.collider(hero, this.stone);
    this.tag = scene.add
      .pixelText(at.x, at.y - TAG_RISE, "SHRINE", retroStyle(5, TAG_LIT))
      .setOrigin(0.5, 1)
      .setStroke("#1a1028", 4)
      .setDepth(11);
    this.light();
    const onUpdate = (): void => {
      this.light();
      this.stone.setDepth(hero.y < at.y ? DEPTH_OVER_HERO : DEPTH_BEHIND_HERO);
      // opened here rather than in the key's listener: the dialogue box hears
      // the same Z, and one that reached it after open() skipped the first
      // page's typing
      const z = this.zQueued;
      this.zQueued = false;
      if (z && !opts.blocked?.()) this.tryPray();
    };
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, onUpdate));
    if (opts.ownKey) {
      scene.input.keyboard
        ?.addKey(Phaser.Input.Keyboard.KeyCodes.Z)
        .on(Phaser.Input.Keyboard.Events.DOWN, (_k: unknown, e: KeyboardEvent) => {
          // not the Z that closes a talk: by POST_UPDATE the box is down
          // and the same press would open the shrine's again
          if (!e.repeat && !opts.blocked?.()) this.zQueued = true;
        });
    }
  }

  // the rune and the tag as today leaves them
  private light(): void {
    const spent = shrineSpent(GameState, this.region, econDay());
    if (spent === this.spent) return;
    this.spent = spent;
    this.stone.setTexture(spent ? "shrine-spent" : "shrine");
    this.tag.setColor(spent ? TAG_SPENT : TAG_LIT);
  }

  /** Starts the shrine's talk if the hero stands by it; false when not. */
  tryPray(): boolean {
    if (justBackFromFight(this.scene)) return false;
    if (Math.hypot(this.at.x - this.hero.x, this.at.y - this.hero.y) > PRAY_RADIUS) return false;
    const { cost, offers } = SHRINES[this.region];
    if (shrineSpent(GameState, this.region, econDay())) {
      this.dialogue.start(["The rune is dark.", "The shrine has had today's offering. Come back tomorrow."], "SHRINE");
      return true;
    }
    Sfx.buy();
    const [a, b] = offers.map((k) => BLESSINGS[k]);
    // The longest pair ("FURY: ATK +20%, DEF -20%." and "GREED: GOLD +50%.")
    // packs with the first line into three rows of the touch box's 42 glyphs
    // ("Once a day, for 200 G, it will bless your" 40, "next 6 battles. FURY:
    // ATK +20%, DEF -20%." 41, the second blessing), two of the keyboard's 54;
    // the question takes the choices' page alone there (DialogueBox). ESC
    // (pick 2, past both) walks away; N, the second, still meets the YES/NO.
    this.dialogue.ask(
      [
        `Once a day, for ${cost} G, it will bless your next ${BLESSING_BATTLES} battles.`,
        `${a.name}: ${a.info}.`,
        `${b.name}: ${b.info}.`,
        "Which blessing?",
      ],
      "SHRINE",
      [a.name, b.name],
      (i) => {
        if (i === 0 || i === 1) this.offer(offers[i]);
      },
      2,
    );
    return true;
  }

  // the blessing picked: too little gold, or YES/NO to the offering
  private offer(key: BlessingKey): void {
    const { cost } = SHRINES[this.region];
    const def = BLESSINGS[key];
    if (GameState.gold < cost) {
      Sfx.error();
      this.dialogue.start([`The shrine asks ${cost} G. You have ${GameState.gold}.`], "SHRINE");
      return;
    }
    const old = GameState.blessing;
    // at most "FURY: ATK +20%, DEF -20%." and "It takes the place of STONE
    // (6 left)."; the question, 14 glyphs, has the last page's one touch row
    const lines = [`${def.name}: ${def.info}.`];
    if (old) lines.push(`It takes the place of ${BLESSINGS[old.key].name} (${old.left} left).`);
    lines.push(`Offer ${cost} G?`);
    this.dialogue.ask(lines, "SHRINE", ["YES", "NO"], (i) => {
      if (i !== 0 || !pray(GameState, this.region, key, econDay())) return;
      // the BOUNTY BOARD's SHRINE PRAYER counts these (bounties.ts)
      GameState.prayers += 1;
      Sfx.ward();
      this.light();
      // news (the "!"): it waits for the box to close; before the save, so
      // its "SAVED" queues behind
      showToast(this.scene, `${def.name} BLESSING! ${def.info} x${BLESSING_BATTLES}`, FIELD_TOAST_Y);
      GameState.save();
      this.prayed?.();
    });
  }
}
