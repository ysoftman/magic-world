import Phaser from "phaser";
import { Sfx } from "../audio";
import { GameState } from "../gameState";
import { ART_PX, FIELD_TOAST_Y, makeTexture, retroStyle, showToast } from "../pixelart";
import type { PixelText } from "../pixelText";
import { ALL_SEALS_MP, cellCentre, fellKeeper, SEAL_MP, SEALS, type SealRegion, stepPlate } from "../seals";
import type { DialogueBox } from "./DialogueBox";

// the stone is the shrine's (art/props.ts), in its place on its tile the
// same way (ui/Shrine.ts): 14px up, its tag 70 over the tile's middle, its
// body the steps and lower third, in front of a hero behind it
const STONE_RISE = 14;
const TAG_RISE = 70;
const DEPTH_BEHIND_HERO = 9;
const DEPTH_OVER_HERO = 10.4;
const TALK_RADIUS = 96;
const TAG_SHUT = "#f87171";
const TAG_DONE = "#808096";

const PLATE_KEY = "seal-plate";
const PLATE_LIT_KEY = "seal-plate-lit";
// a rune plate set in the floor: a worn slab, 48px on 2px cells (ART_PX), a
// ring and a forked rune cut in it — a dark groove asleep, red-gold awake
// biome-ignore format: one row per line so the art reads as a grid
const PLATE = [
  "..kkkkkkkkkkkkkkkkkkkk..",
  ".kssssssssssssssssssssk.",
  "kssmmmmmmmmmmmmmmmmmmddk",
  "ksmmmmmmrrrrrrrrmmmmmmdk",
  "ksmmmmrrmmmmmmmmrrmmmmdk",
  "ksmmmrmmmmmmmmmmmmrmmmdk",
  "ksmmrmmmmrmmmmrmmmmrmmdk",
  "ksmmrmmmmrmmmmrmmmmrmmdk",
  "ksmrmmmmmmrmmrmmmmmmrmdk",
  "ksmrmmmmmmrmmrmmmmmmrmdk",
  "ksmrmmmmmmmrrmmmmmmmrmdk",
  "ksmrmmmmmmmrrmmmmmmmrmdk",
  "ksmrmmmmmmmrrmmmmmmmrmdk",
  "ksmrmmmmmmmrrmmmmmmmrmdk",
  "ksmrmmmmmmmrrmmmmmmmrmdk",
  "ksmrmmmmmmmrrmmmmmmmrmdk",
  "ksmmrmmmmmmrrmmmmmmrmmdk",
  "ksmmrmmmmmmrrmmmmmmrmmdk",
  "ksmmmrmmmmmmmmmmmmrmmmdk",
  "ksmmmmrrmmmmmmmmrrmmmmdk",
  "ksmmmmmmrrrrrrrrmmmmmmdk",
  "ksddddddddddddddddddddk.",
  ".kddddddddddddddddddddk.",
  "..kkkkkkkkkkkkkkkkkkkk..",
];
const PLATE_PALETTE = { k: 0x1a1028, s: 0x9a9fb3, m: 0x6f7489, d: 0x4a4e63, r: 0x33364a };
const PLATE_LIT_PALETTE = { k: 0x1a1028, s: 0x9a9fb3, m: 0x6f7489, d: 0x4a4e63, r: 0xfb923c };
// on the floor, over the terrain and under the star shards' and the maps'
// glints (4.5), footprints and everything that stands
const PLATE_DEPTH = 3.6;
// stepped on within this of its middle (the hero's feet on the slab), and
// not again until the hero has left it
const STEP_RADIUS = 30;
const REFUSE_MS = 280;

// The keeper's fight under way: which seal, and the wins and catches as it
// began. The field is built again when the fight returns, and reads it back
// (as the ABYSS reads its guardians': a win is GameState.battles grown, a
// CANDY catch `caught`). Not saved: a reload mid-fight leaves the seal open.
let fight: { region: SealRegion; battles: number; caught: number } | null = null;

/**
 * A field's seal (seals.ts): the red stone under its "SEAL" tag, solid to
 * the hero, and its three rune plates on the floor. Walking the plates in
 * the stone's order breaks the seal; Z by the stone is its riddle while it
 * is shut, the keeper's challenge (YES/NO, then `fight()`, the scene's own
 * battle start) once it is broken, and nothing much when the keeper is gone.
 *
 * `back`: the field is being built on a fight's return, which is when a
 * felled keeper pays out. `dialogue`, `ownKey` and `blocked` are as
 * ui/Shrine.ts's. `found` runs after the seal breaks or pays, for the scene
 * to hold off its fights while the toast is read.
 */
export class Seal {
  private scene: Phaser.Scene;
  private region: SealRegion;
  private hero: { x: number; y: number };
  private dialogue: DialogueBox;
  private at: { x: number; y: number };
  private stone: Phaser.Physics.Arcade.Image;
  private tag: PixelText;
  private plates: Array<{ x: number; y: number; image: Phaser.GameObjects.Image; on: boolean }>;
  private lit = 0;
  private startFight: () => void;
  private found?: () => void;
  private zQueued = false;

  constructor(
    scene: Phaser.Scene,
    region: SealRegion,
    hero: Phaser.Physics.Arcade.Sprite,
    dialogue: DialogueBox,
    opts: { back: boolean; fight: () => void; blocked: () => boolean; found?: () => void },
  ) {
    this.scene = scene;
    this.region = region;
    this.hero = hero;
    this.dialogue = dialogue;
    this.startFight = opts.fight;
    this.found = opts.found;
    const def = SEALS[region];
    this.at = cellCentre(def.at);
    if (!scene.textures.exists(PLATE_KEY)) {
      makeTexture(scene, PLATE_KEY, PLATE, PLATE_PALETTE, ART_PX);
      makeTexture(scene, PLATE_LIT_KEY, PLATE, PLATE_LIT_PALETTE, ART_PX);
    }
    this.plates = def.plates.map((cell) => {
      const p = cellCentre(cell);
      return { ...p, image: scene.add.image(p.x, p.y, PLATE_KEY).setDepth(PLATE_DEPTH), on: false };
    });
    this.stone = scene.physics.add.staticImage(this.at.x, this.at.y - STONE_RISE, "seal").setDepth(DEPTH_BEHIND_HERO);
    (this.stone.body as Phaser.Physics.Arcade.StaticBody).setSize(56, 38, false).setOffset(20, 52);
    scene.physics.add.collider(hero, this.stone);
    this.tag = scene.add
      .pixelText(this.at.x, this.at.y - TAG_RISE, "SEAL", retroStyle(5, TAG_SHUT))
      .setOrigin(0.5, 1)
      .setStroke("#1a1028", 4)
      .setDepth(11);

    // the keeper's fight just ended: felled or caught, it pays
    const fought = opts.back && fight?.region === region ? fight : null;
    fight = null;
    if (fought && (GameState.battles > fought.battles || GameState.caught.length > fought.caught)) {
      const paid = fellKeeper(GameState, region);
      if (paid) {
        Sfx.levelup();
        // "GRUK THE HEXED FALLS! MAX MP +3, +150 G" is 39 glyphs, 780px
        // (the longest, MOLG THE GILDED's, 40); the fourth's MP is in the next
        showToast(scene, `${def.keeper} FALLS! MAX MP +${SEAL_MP}, +${paid.gold} G`, FIELD_TOAST_Y);
        if (paid.all) showToast(scene, `ALL FOUR SEALS BROKEN! MAX MP +${ALL_SEALS_MP}`, FIELD_TOAST_Y);
        GameState.save();
        this.found?.();
      }
    }
    this.show();

    scene.input.keyboard
      ?.addKey(Phaser.Input.Keyboard.KeyCodes.Z)
      .on(Phaser.Input.Keyboard.Events.DOWN, (_k: unknown, e: KeyboardEvent) => {
        // not the Z that closes a talk (ui/Shrine.ts)
        if (!e.repeat && !opts.blocked()) this.zQueued = true;
      });
    const onUpdate = (): void => {
      this.stone.setDepth(hero.y < this.at.y ? DEPTH_OVER_HERO : DEPTH_BEHIND_HERO);
      if (!opts.blocked()) this.walkPlates();
      const z = this.zQueued;
      this.zQueued = false;
      if (z && !opts.blocked()) this.tryTalk();
    };
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, onUpdate));
  }

  private stage(): "shut" | "open" | "done" {
    return GameState.seals[this.region] ?? "shut";
  }

  // the stone, its tag and the plates as the seal stands
  private show(): void {
    const stage = this.stage();
    this.stone.setTexture(stage === "shut" ? "seal" : "shrine-spent");
    this.tag.setColor(stage === "done" ? TAG_DONE : TAG_SHUT).setText(stage === "open" ? "BROKEN SEAL" : "SEAL");
    const order = SEALS[this.region].order;
    this.plates.forEach((p, i) => {
      p.image.setTexture(stage !== "shut" || order.indexOf(i) < this.lit ? PLATE_LIT_KEY : PLATE_KEY);
    });
  }

  // a plate newly stepped on while the seal is shut
  private walkPlates(): void {
    if (this.stage() !== "shut") return;
    this.plates.forEach((p, i) => {
      const on = Math.hypot(p.x - this.hero.x, p.y + 16 - this.hero.y) <= STEP_RADIUS;
      const stepped = on && !p.on;
      p.on = on;
      if (!stepped) return;
      const before = this.lit;
      const wasLit = SEALS[this.region].order.indexOf(i) < before;
      this.lit = stepPlate(SEALS[this.region], this.lit, i);
      // a plate already lit says nothing; a wrong one says so even as the
      // first, when there is nothing lit to go dark (it used to be silent,
      // and read as a plate that did nothing)
      if (wasLit) return;
      if (this.lit === 0) {
        Sfx.error();
        this.refuse(p.image);
      } else if (this.lit < this.plates.length) {
        Sfx.pickup();
      } else {
        GameState.seals[this.region] = "open";
        Sfx.ward();
        showToast(this.scene, "THE SEAL BREAKS! SOMETHING STIRS IN THE STONE", FIELD_TOAST_Y);
        GameState.save();
        this.found?.();
      }
      this.show();
    });
  }

  // the wrong plate, red for a moment as it is stepped on
  private refuse(plate: Phaser.GameObjects.Image): void {
    plate.setTint(0xff5a5a);
    this.scene.time.delayedCall(REFUSE_MS, () => plate.clearTint());
  }

  /** Starts the stone's talk if the hero stands by it; false when not. */
  tryTalk(): boolean {
    if (Math.hypot(this.at.x - this.hero.x, this.at.y - this.hero.y) > TALK_RADIUS) return false;
    const def = SEALS[this.region];
    const stage = this.stage();
    if (stage === "done") {
      this.dialogue.start(["The stone is cold. Whatever it held is gone."], "SEAL");
    } else if (stage === "shut") {
      Sfx.buy();
      this.dialogue.start([...def.riddle, "A wrong step puts them all to sleep again."], "SEAL");
    } else {
      Sfx.buy();
      // the question, 28 glyphs at most ("Call GRUK THE HEXED out?" 24),
      // has the last page's one touch row
      this.dialogue.ask(["The seal is broken. Something waits inside.", `Call ${def.keeper} out?`], "SEAL", ["YES", "NO"], (i) => {
        if (i !== 0) return;
        fight = { region: this.region, battles: GameState.battles, caught: GameState.caught.length };
        this.startFight();
      });
    }
    return true;
  }
}
