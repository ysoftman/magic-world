import Phaser from "phaser";
import { Sfx } from "../audio";
import { materialName } from "../delivery";
import { econDay, GameState } from "../gameState";
import { NEST_FIGHTS, NEST_MIN_BATTLES, NEST_PIECES, NESTS, type NestFight, type NestRegion, nestSpent, payNest } from "../nest";
import { ART_PX, FIELD_TOAST_Y, makeTexture, retroStyle, showToast } from "../pixelart";
import type { PixelText } from "../pixelText";
import { cellCentre } from "../seals";
import type { DialogueBox } from "./DialogueBox";

const TALK_RADIUS = 96;
// the tag over the mound's top (24px over the tile's middle)
const TAG_RISE = 34;
const TAG_LIVE = "#fbbf24";
const TAG_STILL = "#808096";
const DEPTH_BEHIND_HERO = 9;
const DEPTH_OVER_HERO = 10.4;

const NEST_KEY = "nest";
const NEST_STILL_KEY = "nest-still";
// a mound of sticks round a dark mouth, 64x48px on 2px cells (ART_PX): two
// eyes in the mouth while the nest can be gone into, none once it is still
// biome-ignore format: one row per line so the art reads as a grid
const MOUND = [
  "................................",
  ".............kkkkkk.............",
  "..........kkklllllmkkk..........",
  ".........kllllmmlllllmk.........",
  ".......kklllmllmllmllllkk.......",
  "......klmlmllllllmlmlllllk......",
  "......klllmlllmlllmlllmllk......",
  ".....kmmmmllllllllllllllllk.....",
  "....kmlllllmmlllllmlllllmmlk....",
  "...kllllmllmllmlllllllmllmllk...",
  "...klllllmlmkkkkkkkkmllllllmk...",
  "..kmdlmmdmmkhhhhhhhhkmmmdmmmdk..",
  "..kllmmmmmkhhhhhhhhhhkmmmlllmk..",
  "..kmmmlmdkhhhhhhhhhhhhkmmmmmdk..",
  ".kmldmmdkhheehhhhhheehhkdmmmmmk.",
  ".kmdlmmmkhheehhhhhheehhkmmmmdmk.",
  ".kmlmdmkhhhhhhhhhhhhhhhhkmdmmmk.",
  ".kmddddkhhhhhhhhhhhhhhhhkdddddk.",
  "kdddddmkhhhhhhhhhhhhhhhhkmdddddk",
  "kddmddkhhhhhhhhhhhhhhhhhhkddmddk",
  "kdmdmdkhhhhhhhhhhhhhhhhhhkdddmdk",
  "kddmdddkkkkkkkkkkkkkkkkkkdddmddk",
  "kddddddddddddmmmmmdddddddddddddk",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
];
const MOUND_PALETTE = { k: 0x1a1028, l: 0xa07c48, m: 0x76582f, d: 0x4c3820, h: 0x120c1c, e: 0xfde047 };
const MOUND_STILL_PALETTE = { ...MOUND_PALETTE, e: 0x120c1c };

// The run under way (nest.ts): which nest, the fights won, and the wins and
// catches as the fight now out began. The field is built again when it
// returns and reads this back, as ui/Seal.ts does its keeper's. Not saved.
let run: { region: NestRegion; wins: number; battles: number; caught: number } | null = null;

/**
 * A field's nest (nest.ts): the mound under its "NEST" tag, solid to the
 * hero. Z beside it is the way in (YES/NO), once a day; `fight(f)` is the
 * scene's own battle start with that fight's foe and bout. Built on a
 * fight's return (`back`) it counts the win and asks whether to fight on, or
 * pays the run out. `blocked` and `found` are as ui/Seal.ts's.
 */
export class Nest {
  private scene: Phaser.Scene;
  private region: NestRegion;
  private hero: { x: number; y: number };
  private dialogue: DialogueBox;
  private at: { x: number; y: number };
  private mound: Phaser.Physics.Arcade.Image;
  private tag: PixelText;
  private startFight: (fight: NestFight) => void;
  private found?: () => void;
  private zQueued = false;
  // fights won in a run whose next question is still to be asked
  private asking: number | null = null;

  constructor(
    scene: Phaser.Scene,
    region: NestRegion,
    hero: Phaser.Physics.Arcade.Sprite,
    dialogue: DialogueBox,
    opts: { back: boolean; fight: (fight: NestFight) => void; blocked: () => boolean; found?: () => void },
  ) {
    this.scene = scene;
    this.region = region;
    this.hero = hero;
    this.dialogue = dialogue;
    this.startFight = opts.fight;
    this.found = opts.found;
    this.at = cellCentre(NESTS[region].at);
    if (!scene.textures.exists(NEST_KEY)) {
      makeTexture(scene, NEST_KEY, MOUND, MOUND_PALETTE, ART_PX);
      makeTexture(scene, NEST_STILL_KEY, MOUND, MOUND_STILL_PALETTE, ART_PX);
    }
    // the body is the mound's lower half: the hero stops at its foot and
    // walks behind its top
    this.mound = scene.physics.add.staticImage(this.at.x, this.at.y, NEST_KEY).setDepth(DEPTH_BEHIND_HERO);
    (this.mound.body as Phaser.Physics.Arcade.StaticBody).setSize(56, 22, false).setOffset(4, 24);
    scene.physics.add.collider(hero, this.mound);
    this.tag = scene.add
      .pixelText(this.at.x, this.at.y - TAG_RISE, "NEST", retroStyle(5, TAG_LIVE))
      .setOrigin(0.5, 1)
      .setStroke("#1a1028", 4)
      .setDepth(11);

    // a run's fight just ended: won (or caught), the next is asked for or
    // the run is paid; fled, the run ends with what was banked
    const was = opts.back && run?.region === region ? run : null;
    run = null;
    if (was) {
      const won = GameState.battles > was.battles || GameState.caught.length > was.caught;
      const wins = was.wins + (won ? 1 : 0);
      if (won && wins < NEST_FIGHTS) this.asking = wins;
      else this.end(wins);
    }
    this.show();

    scene.input.keyboard
      ?.addKey(Phaser.Input.Keyboard.KeyCodes.Z)
      .on(Phaser.Input.Keyboard.Events.DOWN, (_k: unknown, e: KeyboardEvent) => {
        // not the Z that closes a talk (ui/Shrine.ts)
        if (!e.repeat && !opts.blocked()) this.zQueued = true;
      });
    const onUpdate = (): void => {
      this.mound.setDepth(hero.y < this.at.y ? DEPTH_OVER_HERO : DEPTH_BEHIND_HERO);
      const z = this.zQueued;
      this.zQueued = false;
      if (opts.blocked()) return;
      if (this.asking !== null) this.askOn(this.asking);
      else if (z) this.tryTalk();
    };
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, onUpdate));
  }

  // the mound and its tag as today leaves them
  private show(): void {
    const still = nestSpent(GameState, this.region, econDay()) && this.asking === null;
    this.mound.setTexture(still ? NEST_STILL_KEY : NEST_KEY);
    this.tag.setColor(still ? TAG_STILL : TAG_LIVE);
  }

  // the next fight out, the run noted for its return
  private fightOn(wins: number): void {
    run = { region: this.region, wins, battles: GameState.battles, caught: GameState.caught.length };
    this.startFight(NESTS[this.region].fights[wins]);
  }

  // Between two fights, as the field comes back: on, or out with the purse
  // so far. ESC is LEAVE (the last choice): the way out that loses nothing
  // held. "1 OF 3 DOWN. LEAVE NOW WITH 10 G, OR" / "FIGHT ON FOR IT ALL." is
  // two of the touch box's 42-glyph rows, the question its own page there.
  private askOn(wins: number): void {
    this.asking = null;
    this.found?.();
    const banked = NESTS[this.region].purse[wins - 1];
    this.dialogue.ask(
      [`${wins} of ${NEST_FIGHTS} down. Leave now with ${banked} G,`, "or fight on for it all.", "Fight on?"],
      "NEST",
      ["ON", "LEAVE"],
      (i) => {
        if (i === 0) this.fightOn(wins);
        else this.end(wins);
      },
    );
  }

  // The run over: paid by its wins (nest.ts payNest), said in a toast.
  // "NEST CLEARED! +40 G, 3 SPIDER SILK" is 34 glyphs, 680px.
  private end(wins: number): void {
    const def = NESTS[this.region];
    const paid = payNest(GameState, this.region, wins);
    if (wins >= NEST_FIGHTS) {
      Sfx.levelup();
      showToast(this.scene, `NEST CLEARED! +${paid.gold} G, ${paid.pieces} ${materialName(def.material)}`, FIELD_TOAST_Y);
    } else if (wins > 0) {
      Sfx.pickup();
      showToast(this.scene, `YOU LEAVE THE NEST! +${paid.gold} G`, FIELD_TOAST_Y);
    } else {
      showToast(this.scene, "THE NEST DRIVES YOU OUT!", FIELD_TOAST_Y);
    }
    GameState.save();
    this.found?.();
    this.show();
  }

  /** Starts the nest's talk if the hero stands by it; false when not. */
  tryTalk(): boolean {
    if (Math.hypot(this.at.x - this.hero.x, this.at.y - this.hero.y) > TALK_RADIUS) return false;
    const def = NESTS[this.region];
    const day = econDay();
    if (nestSpent(GameState, this.region, day)) {
      this.dialogue.start(["The nest is still.", "Whatever lives here will be back tomorrow."], "NEST");
      return true;
    }
    if (GameState.battles < NEST_MIN_BATTLES) {
      this.dialogue.start(["Eyes watch you from the dark.", "Not yet: win a few more fights first."], "NEST");
      return true;
    }
    Sfx.buy();
    // Three rows of the touch box's 42 glyphs with the longest material
    // ("Win all three for 40 G and 3 SPIDER SILK." 41), the question its own
    // page there
    this.dialogue.ask(
      [
        `A nest: ${NEST_FIGHTS} fights in a row, no rest between.`,
        `Win all three for ${def.purse[NEST_FIGHTS - 1]} G and ${NEST_PIECES} ${materialName(def.material)}.`,
        "Leave between fights and keep a part.",
        "Go in? Once a day.",
      ],
      "NEST",
      ["YES", "NO"],
      (i) => {
        if (i !== 0) return;
        GameState.nestDays[this.region] = day;
        GameState.save();
        this.fightOn(0);
      },
    );
    return true;
  }
}
