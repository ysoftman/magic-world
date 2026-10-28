import Phaser from "phaser";
import {
  ABYSS_H,
  ABYSS_W,
  type AbyssBout,
  type AbyssFloor,
  abyssKind,
  abyssResume,
  abyssScale,
  cellCenter,
  floorSeed,
  generateFloor,
  portalOnLeave,
} from "../abyss";
import { ACHIEVEMENTS, announceLooks, claimAchievements } from "../achievements";
import { DUNGEON_THEME, Sfx } from "../audio";
import { GAME_WIDTH } from "../config";
import { GameState, onSaved } from "../gameState";
import { escapeFromZones, type MonsterZone, T_GRASS, T_PATH, T_TALL, T_WATER_A, T_WATER_B, TILE } from "../levels";
import { ENEMIES } from "../monsters";
import { addGroundShadow, FIELD_TOAST_Y, makeTexture, retroStyle, showToast } from "../pixelart";
import {
  addBorderDressing,
  addTownExitLabel,
  askQuitToTitle,
  boundCameraToMap,
  buildTileLayers,
  createWalkAnimations,
  fadeAreaTitle,
  fadeInAfterAreaTitle,
  isWalkableCell,
  saveAndQuit,
  startWaterAnimation,
  whilePanelUp,
} from "../sceneCommon";
import { AchievementsUI } from "../ui/AchievementsUI";
import { addAmbient } from "../ui/Ambient";
import { BestiaryUI } from "../ui/BestiaryUI";
import { CompanionSprite } from "../ui/CompanionSprite";
import { DialogueBox } from "../ui/DialogueBox";
import { addFootsteps } from "../ui/Footsteps";
import { addHelpPopup, helpOpen } from "../ui/HelpPopup";
import { placeHeroGear } from "../ui/HeroGear";
import { InventoryUI } from "../ui/InventoryUI";
import { CAVE_TILE_COLORS, Minimap } from "../ui/Minimap";
import { lightsOverTiles, NightOverlay } from "../ui/NightOverlay";
import { QuestLog } from "../ui/QuestLog";
import { SettingsUI } from "../ui/SettingsUI";
import { STATUS_HUD_HEIGHT, StatusHud } from "../ui/StatusHud";
import { isTouchDevice, TouchControls } from "../ui/TouchControls";
import { CAVE_SKIN } from "./BootScene";

type LastMove = "down" | "up" | "right" | "left";

const ENCOUNTER_COOLDOWN = 600;
const ENTRY_GRACE = 1200;
const MAX_COOLDOWN_STEP = 50;
const EXIT_SAFE_RADIUS_X = TILE * 2;
const EXIT_SAFE_RADIUS_Y = TILE * 2.5;
// every field's chance a second, with no night bump: no night down here
const ENCOUNTER_RATE = 0.06;
// The gloom never lifts or deepens with the clock (no night underground):
// between the cave's 0.35 by day and its 0.6 at night.
const GLOOM = 0.45;
// a guarded stair says so at most this often while the hero stands on it
const SEALED_TOAST_MS = 2000;
const DOWN_COLOR = "#c084fc";
const SEALED_COLOR = "#ff5555";
// the cave's minimap colours, with the zones' darker floor
const ABYSS_TILE_COLORS: Record<number, number> = { ...CAVE_TILE_COLORS, [T_TALL]: 0x2f2b28 };
// A chest's gold before the depth's loot scaling, and what may come with it.
// abyss.ts's gold model counts 30 G on half the cave floors; the potions are
// what lets a dive go one floor further, and an ETHER feeds HEAL.
const CHEST_GOLD_MIN = 20;
const CHEST_GOLD_SPREAD = 21;
const CHEST_LOOT: Array<{ key: "potion" | "hiPotion" | "ether"; chance: number; name: string }> = [
  { key: "potion", chance: 0.35, name: "POTION" },
  { key: "hiPotion", chance: 0.2, name: "HI-POTION" },
  { key: "ether", chance: 0.15, name: "ETHER" },
];

// The stairs, baked here rather than in BootScene since only the ABYSS and
// the cave's way down use them: the cave's own stone (BootScene's
// CAVE_ROCK_PALETTE), steps narrowing into a void with a violet glow, and a
// flight rising into daylight for the way back up.
const STAIRS_PALETTE = {
  b: 0x141518,
  S: 0x2a2c31,
  D: 0x3c3f45,
  c: 0x55585f,
  H: 0x737780,
  k: 0x07060c,
  p: 0x4c1d95,
  P: 0x7c3aed,
  l: 0xd9b56a,
  L: 0xfff1b8,
};
// biome-ignore format: kept one row per line so the art reads as a grid
const STAIRS_DOWN = [
  "................",
  "..bbbbbbbbbbbb..",
  ".bHHHHHHHHHHHHb.",
  ".bccccccccccccb.",
  ".bSSSSSSSSSSSSb.",
  ".bSHHHHHHHHHHSb.",
  ".bSccccccccccSb.",
  ".bSSSSSSSSSSSSb.",
  ".bSSDDDDDDDDSSb.",
  ".bSSSSSSSSSSSSb.",
  ".bSSkkkkkkkkSSb.",
  ".bSkkkppppkkkSb.",
  ".bSkkpPPPPpkkSb.",
  ".bSkkkppppkkkSb.",
  ".bbbbbbbbbbbbbb.",
  "................",
];
// biome-ignore format: as above
const STAIRS_UP = [
  "................",
  "..bbbbbbbbbbbb..",
  ".bLLLLLLLLLLLLb.",
  ".bllllllllllllb.",
  ".bHHHHHHHHHHHHb.",
  ".bccccccccccccb.",
  ".bSSSSSSSSSSSSb.",
  ".bHHHHHHHHHHHHb.",
  ".bccccccccccccb.",
  ".bSSSSSSSSSSSSb.",
  ".bHHHHHHHHHHHHb.",
  ".bccccccccccccb.",
  ".bSSSSSSSSSSSSb.",
  ".bHHHHHHHHHHHHb.",
  ".bbbbbbbbbbbbbb.",
  "................",
];
export const STAIRS_DOWN_KEY = "abyss-stairs-down";
const STAIRS_UP_KEY = "abyss-stairs-up";

// once per page load: generateTexture onto an existing key composites
export function bakeAbyssStairs(scene: Phaser.Scene): void {
  if (scene.textures.exists(STAIRS_DOWN_KEY)) return;
  makeTexture(scene, STAIRS_DOWN_KEY, STAIRS_DOWN, STAIRS_PALETTE);
  makeTexture(scene, STAIRS_UP_KEY, STAIRS_UP, STAIRS_PALETTE);
}

// One dive, from the stair in the cave to the walk back out (or a fall). It
// lives in memory only: quitting to the title or reloading ends it, and the
// save keeps just the record (GameState.abyssBest). A battle leaves this scene
// and comes back, so what the floor has already lost is kept here.
interface AbyssRun {
  seed: number;
  floor: number;
  // roamers met on this floor, "zone:index". One met is gone whatever came
  // of the fight — won, caught or fled from, it has lost the trail — so the
  // hero, put back where the fight began, isn't standing in it again.
  met: Set<string>;
  chestOpened: boolean;
  guardianDown: boolean;
  // Where the hero stood when the fight began, who it was with, and the win
  // count then: a guardian is only down if GameState.battles grew (it can't
  // be caught, and a flight leaves the count alone), so one fled from stays.
  fight: { x: number; y: number; roamer: string | null; guardian: boolean; battles: number } | null;
}

let run: AbyssRun | null = null;

function freshFloor(r: AbyssRun): void {
  r.met = new Set();
  r.chestOpened = false;
  r.guardianDown = false;
  r.fight = null;
}

interface Roamer {
  sprite: Phaser.Physics.Arcade.Sprite;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  targetX: number;
  targetY: number;
  wait: number;
  speed: number;
  kind: string;
  id: string | null; // null for the guardian
}

const IDLE_TEXTURE: Record<LastMove, string> = {
  down: "hero-idle-down",
  up: "hero-idle-up",
  right: "hero-idle-right",
  left: "hero-idle-left",
};

// The post-game dive (abyss.ts): a generated floor at a time, on the cave's
// tiles and with the field scenes' skeleton (roamer zones, a chest, the way
// back to town), plus the stair down and, every fifth floor, a guardian on it.
export class AbyssScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private companionFollower!: CompanionSprite;
  private weaponOverlay!: Phaser.GameObjects.Sprite;
  private shieldOverlay!: Phaser.GameObjects.Sprite;
  private floor!: AbyssFloor;
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private objectLayer!: Phaser.Tilemaps.TilemapLayer;
  private roamerGroup!: Phaser.Physics.Arcade.Group;
  private roamers: Roamer[] = [];
  private downLabel!: Phaser.GameObjects.Text;
  private upStair!: Phaser.GameObjects.Zone;
  // the stair up has asked since the hero last stepped onto it: a STAY holds
  // the question back until the hero steps off and on again
  private stairAsked = false;
  private dialogue!: DialogueBox;
  private encounterCooldown = 0;
  private leaving = false;
  private sealedToastAt = 0;
  private sQueued = false;
  private ctrlSQueued = false;
  private lastMove: LastMove = "down";

  private keyLeft!: Phaser.Input.Keyboard.Key;
  private keyRight!: Phaser.Input.Keyboard.Key;
  private keyUp!: Phaser.Input.Keyboard.Key;
  private keyDown!: Phaser.Input.Keyboard.Key;
  private keyH!: Phaser.Input.Keyboard.Key;
  private keyJ!: Phaser.Input.Keyboard.Key;
  private keyK!: Phaser.Input.Keyboard.Key;
  private keyL!: Phaser.Input.Keyboard.Key;
  private mQueued = false;
  private tQueued = false;
  private iQueued = false;
  private bQueued = false;
  private aQueued = false;
  private uQueued = false;
  private oQueued = false;
  private qQueued = false;
  private quitting = false;
  private unsubSaved: () => void = () => {};
  // claims achievements at most once per second, like every field scene
  private achievementCheckAccum = 0;
  // true while a quiet save is in flight (a trophy, a depth record), so the
  // onSaved "SAVED" toast doesn't clobber the toast announcing it
  private suppressSavedToast = false;

  private hud!: StatusHud;
  private minimap!: Minimap;
  private inventory!: InventoryUI;
  private bestiary!: BestiaryUI;
  private achievementsUI!: AchievementsUI;
  private questLog!: QuestLog;
  private settingsUI!: SettingsUI;
  private night!: NightOverlay;
  private touch?: TouchControls;

  constructor() {
    super("Abyss");
  }

  // `fromBattle` / `fromStairs` carry on the dive in memory; anything else
  // (the cave's stair) starts a new one, at B1 or at `start` when that is
  // where the stair offered to pick up (abyssResume: the checkpoint, or the
  // portal, which taking uses up — saved before anything else, quietly)
  create(data?: { fromBattle?: boolean; fromStairs?: boolean; start?: number }): void {
    Sfx.playBgm(DUNGEON_THEME);
    const fromBattle = !!data?.fromBattle;
    if (!run || !(fromBattle || data?.fromStairs)) {
      const resume = abyssResume(GameState.abyssPortal, GameState.abyssCheckpoint);
      const startFloor = resume && data?.start === resume.floor ? resume.floor : 1;
      if (resume?.portal && startFloor === resume.floor) {
        GameState.abyssPortal = 0;
        GameState.save();
      }
      run = {
        seed: (Math.random() * 2 ** 32) >>> 0,
        floor: startFloor,
        met: new Set(),
        chestOpened: false,
        guardianDown: false,
        fight: null,
      };
    }
    const r = run;
    this.roamers = [];
    this.encounterCooldown = ENTRY_GRACE;
    this.lastMove = "down";
    this.leaving = false;
    this.sealedToastAt = 0;
    this.quitting = false;
    // back from a fight the hero stands where it began, which can be the
    // stair up: no question until a step off it
    this.stairAsked = fromBattle;

    // Registered before the SHUTDOWN handler below that calls GameState.save()
    // — SHUTDOWN listeners fire in registration order, so this unsubscribes
    // before that save happens and no toast gets created on a scene that's
    // already tearing down. Keep this the first SHUTDOWN listener.
    this.unsubSaved = onSaved(() => {
      if (!this.suppressSavedToast) showToast(this, "SAVED", FIELD_TOAST_Y);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubSaved());

    // the same seed rebuilds the floor a battle was fought on, exactly
    const floor = generateFloor(r.floor, floorSeed(r.seed, r.floor, GameState.ngPlus));
    this.floor = floor;

    // settle the fight that just handed back
    const back = fromBattle ? r.fight : null;
    r.fight = null;
    let unsealed = false;
    if (back?.guardian && GameState.battles > back.battles) unsealed = r.guardianDown = true;
    else if (back?.roamer) r.met.add(back.roamer);
    // A fallen GUARDIAN makes the floor below a checkpoint: a later dive can
    // start there (the cave's stair asks) rather than at B1, with whatever
    // HP and MP the hero walks in with — no refill. Only the deepest counts.
    const checkpoint = unsealed && r.floor + 1 > GameState.abyssCheckpoint;
    if (checkpoint) GameState.abyssCheckpoint = r.floor + 1;
    // arriving on a floor (not back from a fight) may set the depth record
    const record = !fromBattle && r.floor > GameState.abyssBest;
    if (record) GameState.abyssBest = r.floor;

    const level = floor.tiles;
    // Drawn like the cave (DungeonScene): its T_PATH floor painted as T_GRASS,
    // which CAVE_SKIN draws as that same floor and which the shore transitions
    // round the pools off against. Walkability and the minimap keep reading
    // `level` itself.
    const floorView = level.map((row) => row.map((tile) => (tile === T_PATH ? T_GRASS : tile)));
    const layers = buildTileLayers(this, floorView, { ground: T_GRASS, skin: CAVE_SKIN });
    // the outer rock wall thickened like the cave's, clear of both stairs
    addBorderDressing(this, floorView, CAVE_SKIN, [cellCenter(floor.up), cellCenter(floor.down)]);
    this.layer = layers.terrain;
    this.objectLayer = layers.objects;

    this.physics.world.setBounds(0, 0, ABYSS_W * TILE, ABYSS_H * TILE);

    // "ABYSS B999" is 10 x 32 = 320px; not back from a fight, as no field's
    // title is: the hero never left the floor
    if (!back) {
      const title = this.add
        .text(GAME_WIDTH / 2, STATUS_HUD_HEIGHT + 24, `ABYSS B${r.floor}`, retroStyle(8, DOWN_COLOR))
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(95);
      fadeAreaTitle(this, title);
    }

    bakeAbyssStairs(this);
    const up = cellCenter(floor.up);
    const down = cellCenter(floor.down);
    this.add.image(up.x, up.y, STAIRS_UP_KEY).setDepth(3);
    this.add.image(down.x, down.y, STAIRS_DOWN_KEY).setDepth(3);

    const start = back ?? cellCenter(floor.spawn);
    this.player = this.physics.add.sprite(start.x, start.y, "hero-idle-down");
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    this.player.body?.setSize(40, 32).setOffset(12, 32);
    // pools collide on the terrain layer, the rock on the object layer
    this.physics.add.collider(this.player, this.layer);
    this.physics.add.collider(this.player, this.objectLayer);

    // back from a fight, where it began: inside a zone, or the guardian's box
    if (back) this.escapeMonsterZone();

    this.playerShadow = addGroundShadow(this, this.player);
    this.companionFollower = new CompanionSprite(this, this.player.x, this.player.y);

    this.weaponOverlay = this.add.sprite(this.player.x, this.player.y, "equip-sword").setDepth(11).setVisible(false);
    this.shieldOverlay = this.add.sprite(this.player.x, this.player.y, "equip-shield").setDepth(11).setVisible(false);

    createWalkAnimations(this);

    addFootsteps(this, this.player, level, "dungeon");
    // The cave's dust and drips. No guide arrow: the quest's goals all lie
    // above, and objective.ts would point at the cave's own exit coordinates.
    addAmbient(this, "dungeon");

    this.spawnMonsters();

    this.spawnChest();

    this.physics.add.overlap(this.player, this.roamerGroup, (_p, sprite) => {
      // nor on the way to the title, which would then race the battle's fade
      if (this.encounterCooldown > 0 || this.uiBlocking() || this.quitting) return;
      const roamer = this.roamers.find((x) => x.sprite === sprite);
      // BattleScene.runBattle() already plays the boss fanfare for a guardian
      if (roamer) this.startBattle(roamer.kind, roamer);
    });

    // the stair up: back out through the cave mouth, once asked (askLeave)
    this.upStair = this.add.zone(up.x, up.y, TILE, TILE);
    this.physics.add.existing(this.upStair);
    this.physics.add.overlap(this.player, this.upStair, () => this.askLeave());
    addTownExitLabel(this, up.x, up.y, !back);

    const stair = this.add.zone(down.x, down.y, TILE, TILE);
    this.physics.add.existing(stair);
    this.physics.add.overlap(this.player, stair, () => this.tryDescend());
    // the TOWN marker's look and bob, over the stair down: the next floor's
    // name, or SEALED while a guardian holds it ("SEALED" 6 x 20 = 120px; the
    // generator check keeps both stair labels on the map and apart)
    this.downLabel = this.add
      .text(down.x, down.y - TILE + 8, "", retroStyle(5, DOWN_COLOR))
      .setOrigin(0.5, 1)
      .setStroke("#1a1028", 4)
      .setDepth(9);
    this.tweens.add({ targets: this.downLabel, y: this.downLabel.y - 8, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    // a stair down by the way in sat under the floor's title (1 floor in 400)
    if (!back) fadeInAfterAreaTitle(this, this.downLabel);
    this.refreshDownLabel();

    startWaterAnimation(this, this.layer);

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    boundCameraToMap(this, ABYSS_W * TILE, ABYSS_H * TILE);

    const kb = this.input.keyboard!;
    this.keyLeft = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keyRight = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keyUp = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyDown = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.keyH = kb.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    this.keyJ = kb.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.keyK = kb.addKey(Phaser.Input.Keyboard.KeyCodes.K);
    this.keyL = kb.addKey(Phaser.Input.Keyboard.KeyCodes.L);
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.S).on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (e.ctrlKey) this.ctrlSQueued = true;
      else this.sQueued = true;
    });
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.M).on(Phaser.Input.Keyboard.Events.DOWN, () => {
      this.mQueued = true;
    });
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.T).on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (!e.repeat) this.tQueued = true;
    });
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.I).on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (!e.repeat) this.iQueued = true;
    });
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.B).on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (!e.repeat) this.bQueued = true;
    });
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.A).on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (!e.repeat) this.aQueued = true;
    });
    // registered before TouchControls is built, so touch gets a U button too
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.U).on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (!e.repeat) this.uQueued = true;
    });
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.O).on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (!e.repeat) this.oQueued = true;
    });
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.Q).on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (!e.repeat) this.qQueued = true;
    });
    const help = addHelpPopup(
      this,
      [
        ["HJKL", "MOVE"],
        ["I", "ITEMS"],
        ["B", "BESTIARY"],
        ["A", "ACHIEVE"],
        ["U", "JOURNAL"],
        ["O", "SETTINGS"],
        ["T", "MAP"],
        ["S", "HUD"],
        ["M", "MUTE"],
        ["CTRL+S", "SAVE"],
        ["Q", "QUIT"],
        ["?", "HELP"],
      ],
      // built per visit, so back from felling the guardian it says what's next
      floor.guardian && !r.guardianDown ? "DEFEAT THE GUARDIAN!" : "FIND THE STAIRS DOWN!",
      () => this.uiBlocking() || this.quitting,
    );

    // both stairs and an unopened chest; the zones show on the map already
    this.minimap = new Minimap(
      this,
      level,
      this.player,
      [
        { x: up.x, y: up.y, color: 0xffd166 },
        { x: down.x, y: down.y, color: 0xc084fc },
        ...(floor.chest && !r.chestOpened ? [{ ...cellCenter(floor.chest), color: 0xfde047 }] : []),
      ],
      ABYSS_TILE_COLORS,
    );

    this.night = new NightOverlay(this, GLOOM, 0);
    // the pools' faint blue, as in the cave, and the stair down glowing violet
    this.night.addLights([
      ...lightsOverTiles(level, new Set([T_WATER_A, T_WATER_B]), { radius: 112, color: 0x3b82f6, strength: 0.18, pulseMs: 4200 }),
      { x: down.x, y: down.y, radius: 128, color: 0x8b5cf6, strength: 0.4, pulseMs: 2400 },
    ]);

    this.inventory = new InventoryUI(this);
    this.bestiary = new BestiaryUI(this);
    this.achievementsUI = new AchievementsUI(this);
    this.questLog = new QuestLog(this);
    // the stair up's question (askLeave) and the quit question (askQuitToTitle)
    this.dialogue = new DialogueBox(this, []);
    // touch has no Q: the settings' QUIT chip runs the same save-and-quit as YES
    this.settingsUI = new SettingsUI(this, () => this.quit());

    // under a panel, the stair's question or the help the map's tags (TOWN,
    // the stair down's) go and toasts wait
    whilePanelUp(this, () => this.uiBlocking());

    this.hud = new StatusHud(this);

    if (isTouchDevice()) this.touch = new TouchControls(this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      GameState.save();
      this.minimap.destroy();
      this.inventory.destroy();
      this.bestiary.destroy();
      this.achievementsUI.destroy();
      this.questLog.destroy();
      this.dialogue.destroy();
      this.settingsUI.destroy();
      this.night.destroy();
      this.companionFollower.destroy();
      help.destroy();
      this.touch?.destroy();
    });

    // News, queued under the floor's title. "NEW RECORD: B999!" is 17 glyphs
    // and "A GUARDIAN SEALS THE STAIRS!" 28 (560px) at retroStyle(5).
    if (record) {
      this.suppressSavedToast = true;
      GameState.save();
      this.suppressSavedToast = false;
      // B1 is everyone's first record; only a new depth is news
      if (r.floor > 1) showToast(this, `NEW RECORD: B${r.floor}!`, FIELD_TOAST_Y);
    }
    if (unsealed) {
      Sfx.levelup();
      showToast(this, "THE STAIRS ARE OPEN!", FIELD_TOAST_Y);
      if (checkpoint) {
        this.suppressSavedToast = true;
        GameState.save();
        this.suppressSavedToast = false;
        // "CHECKPOINT: B996!" is 17 glyphs, as the record's
        showToast(this, `CHECKPOINT: B${GameState.abyssCheckpoint}!`, FIELD_TOAST_Y);
      }
    } else if (floor.guardian && !r.guardianDown && !fromBattle) {
      showToast(this, "A GUARDIAN SEALS THE STAIRS!", FIELD_TOAST_Y);
    }
  }

  update(_time: number, delta: number): void {
    GameState.minutes += (delta / 1000) * GameState.timeSpeed;
    this.hud.update();

    this.achievementCheckAccum += delta;
    // only with no panel up: a trophy toast drawn over an open panel covered
    // its top rows. Nothing is lost: the check just waits for it to close.
    if (this.achievementCheckAccum >= 1000 && !this.uiBlocking()) {
      this.achievementCheckAccum = 0;
      const earned = claimAchievements();
      if (earned.length > 0) {
        this.suppressSavedToast = true;
        GameState.save();
        this.suppressSavedToast = false;
      }
      // showToast reuses one Text per scene, so several achievements earned in
      // the same tick would otherwise clobber each other with only the last
      // one ever visible — batch every name earned this tick into one toast.
      const names = earned.map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.name).filter((n): n is string => !!n);
      if (names.length > 0) {
        showToast(this, names.length === 1 ? `ACHIEVEMENT: ${names[0]}!` : `ACHIEVEMENTS: ${names.join(", ")}!`, FIELD_TOAST_Y);
      }
      announceLooks(this, earned, FIELD_TOAST_Y);
    }

    if (this.sQueued) {
      this.sQueued = false;
      this.toggleStatus();
    }

    if (this.ctrlSQueued) {
      this.ctrlSQueued = false;
      GameState.save();
    }

    if (this.mQueued) {
      this.mQueued = false;
      const muted = Sfx.toggleMuted();
      showToast(this, muted ? "SOUND: OFF" : "SOUND: ON", FIELD_TOAST_Y);
    }

    if (this.tQueued) {
      this.tQueued = false;
      if (!this.uiBlocking()) this.minimap.toggle();
    }

    // saved and on the way to the title (quit): nothing else moves. The
    // roamers are kept to their boxes, as under a panel: left on their last
    // velocity they walked off across the map until the title came
    if (this.quitting) {
      this.updateRoamers(delta);
      return;
    }

    if (this.qQueued) {
      this.qQueued = false;
      // never over an open panel: the question's ESC would close that panel too
      if (!this.uiBlocking()) askQuitToTitle(this.dialogue, () => this.quit());
    }

    if (this.uiBlocking()) {
      if (this.iQueued) {
        this.iQueued = false;
        if (this.inventory.isActive()) this.inventory.close();
      }
      if (this.bQueued) {
        this.bQueued = false;
        if (this.bestiary.isActive()) this.bestiary.close();
      }
      if (this.aQueued) {
        this.aQueued = false;
        if (this.achievementsUI.isActive()) this.achievementsUI.close();
      }
      if (this.uQueued) {
        this.uQueued = false;
        if (this.questLog.isActive()) this.questLog.close();
      }
      if (this.oQueued) {
        this.oQueued = false;
        if (this.settingsUI.isActive()) this.settingsUI.close();
      }
      this.player.setVelocity(0, 0);
      this.player.anims.stop();
      this.inventory.update();
      this.bestiary.update();
      this.achievementsUI.update();
      this.questLog.update();
      this.settingsUI.update();
      this.dialogue.update();
      this.updateRoamers(delta);
      return;
    }

    // stepped off the stair up: the next step onto it asks again
    if (this.stairAsked && !this.physics.overlap(this.player, this.upStair)) this.stairAsked = false;

    if (this.iQueued) {
      this.iQueued = false;
      this.inventory.open();
      return;
    }

    if (this.bQueued) {
      this.bQueued = false;
      this.bestiary.open();
      return;
    }

    if (this.aQueued) {
      this.aQueued = false;
      this.achievementsUI.open();
      return;
    }

    if (this.uQueued) {
      this.uQueued = false;
      this.questLog.open();
      return;
    }

    if (this.oQueued) {
      this.oQueued = false;
      this.settingsUI.open();
      return;
    }

    let vx = 0;
    let vy = 0;
    if (!this.leaving) {
      if (this.keyLeft.isDown || this.keyH.isDown) vx = -240;
      else if (this.keyRight.isDown || this.keyL.isDown) vx = 240;
      if (this.keyUp.isDown || this.keyK.isDown) vy = -240;
      else if (this.keyDown.isDown || this.keyJ.isDown) vy = 240;
    }

    this.player.setVelocity(vx, vy);

    const moving = vx !== 0 || vy !== 0;
    if (moving) {
      if (Math.abs(vx) > Math.abs(vy)) {
        this.lastMove = vx < 0 ? "left" : "right";
        this.player.anims.play(this.lastMove === "left" ? "walk-left" : "walk-right", true);
      } else {
        this.lastMove = vy < 0 ? "up" : "down";
        this.player.anims.play(this.lastMove === "up" ? "walk-up" : "walk-down", true);
      }
    } else {
      this.player.setVelocity(0, 0);
      this.player.anims.stop();
      this.player.setTexture(IDLE_TEXTURE[this.lastMove]);
    }

    this.playerShadow.setPosition(this.player.x, this.player.y + 28);
    this.companionFollower.update(this.player.x, this.player.y);
    this.updateEquipOverlays();
    this.updateRoamers(delta);
    this.night.update();
    this.minimap.update();
    this.checkEncounter(delta, moving);
  }

  private updateEquipOverlays(): void {
    placeHeroGear(this.weaponOverlay, this.shieldOverlay, this.player, this.lastMove);
  }

  private uiBlocking(): boolean {
    return (
      this.inventory.isActive() ||
      this.bestiary.isActive() ||
      this.achievementsUI.isActive() ||
      this.questLog.isActive() ||
      this.settingsUI.isActive() ||
      this.dialogue.isActive() ||
      helpOpen(this)
    );
  }

  // The stair up asks before it leaves for town (abyss.ts): STAY is the
  // marked choice and ESC's, so a stray step or Z keeps the dive, and Y
  // answers the question as asked. LEAVE saves the portal there and then
  // goes. Asked once a visit to the stair (stairAsked), never over a panel
  // or the quit prompt. The first line names where the next dive will pick
  // up, at most 24 glyphs ("A PORTAL WILL KEEP B999.", "THE STAIR LEADS TO
  // TOWN."), and with "STAY IN THE ABYSS?" makes 43: two rows of a touch
  // box's 28, all a touch question holds (DialogueBox); STAY and LEAVE are
  // five glyphs at most, as its choice row is laid out for.
  private askLeave(): void {
    if (this.leaving || this.stairAsked || this.uiBlocking() || this.quitting || !run) return;
    this.stairAsked = true;
    this.player.setVelocity(0, 0);
    const portal = portalOnLeave(run.floor, GameState.abyssPortal);
    const resume = abyssResume(portal, GameState.abyssCheckpoint);
    const where = !resume
      ? "THE STAIR LEADS TO TOWN."
      : resume.portal
        ? `A PORTAL WILL KEEP B${resume.floor}.`
        : `THE CHECKPOINT IS B${resume.floor}.`;
    this.dialogue.ask(
      [where, "STAY IN THE ABYSS?"],
      "TOWN",
      ["STAY", "LEAVE"],
      (i) => {
        if (i !== 1) return;
        GameState.abyssPortal = portal;
        this.suppressSavedToast = true;
        GameState.save();
        this.suppressSavedToast = false;
        this.leave(() => {
          run = null;
          this.scene.start("Town", { fromDungeon: true });
        });
      },
      0,
    );
  }

  // YES to the quit question, or the settings' QUIT chip on touch
  private quit(): void {
    this.quitting = true;
    saveAndQuit(this);
  }

  private toggleStatus(): void {
    const visible = !this.hud.isVisible();
    this.hud.setVisible(visible);
    GameState.hudVisible = visible;
    GameState.saveSettings();
  }

  private guardianAlive(): boolean {
    return !!this.floor.guardian && !run?.guardianDown;
  }

  private refreshDownLabel(): void {
    const sealed = this.guardianAlive();
    this.downLabel.setText(sealed ? "SEALED" : `B${(run?.floor ?? 0) + 1}`).setColor(sealed ? SEALED_COLOR : DOWN_COLOR);
  }

  // fade out once, then `next` (a scene change); stairs and exits share it
  private leave(next: () => void): void {
    if (this.leaving) return;
    this.leaving = true;
    Sfx.night();
    this.player.setVelocity(0, 0);
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, next);
  }

  private tryDescend(): void {
    if (this.leaving || this.uiBlocking() || !run) return;
    if (this.guardianAlive()) {
      if (this.time.now - this.sealedToastAt < SEALED_TOAST_MS) return;
      this.sealedToastAt = this.time.now;
      Sfx.error();
      showToast(this, "SEALED: DEFEAT THE GUARDIAN!", FIELD_TOAST_Y);
      return;
    }
    const r = run;
    this.leave(() => {
      r.floor += 1;
      freshFloor(r);
      this.scene.start("Abyss", { fromStairs: true });
    });
  }

  // The chest's find gets the grace a fight's return does, so a roamer can't
  // drag the hero into a fight before its note has been read (the fields'
  // holdFights).
  private holdFights(): void {
    this.encounterCooldown = Math.max(this.encounterCooldown, ENTRY_GRACE);
  }

  private checkEncounter(delta: number, moving: boolean): void {
    if (this.encounterCooldown > 0) {
      // A scene transition hands the first frame a delta as large as the whole
      // load (~1.2s), which drained the entry grace in a single tick and
      // dropped the player straight into a fight. Clamp it to one frame.
      this.encounterCooldown -= Math.min(delta, MAX_COOLDOWN_STEP);
      return;
    }
    // only while the hero walks, as in every other field: stood still a
    // fight still came every ~17s
    if (!moving) return;
    // a guardian's hall holds its guardian and nothing else
    if (this.floor.guardian || this.leaving || !run) return;
    const up = cellCenter(this.floor.up);
    const nearExit = Math.abs(this.player.x - up.x) < EXIT_SAFE_RADIUS_X && Math.abs(this.player.y - up.y) < EXIT_SAFE_RADIUS_Y;
    if (nearExit) return;
    if (Math.random() < ENCOUNTER_RATE * (delta / 1000)) this.startBattle(abyssKind(run.floor), null);
  }

  private liveZones(): MonsterZone[] {
    return this.guardianAlive() && this.floor.lair ? [...this.floor.zones, this.floor.lair] : this.floor.zones;
  }

  // Never onto a stair: a zone can sit two tiles from the stair down, just
  // where the nearest clear tile is, and landing there took the hero down
  // (or out) the moment the fight handed back.
  private escapeMonsterZone(): void {
    const { up, down } = this.floor;
    const stair = (tx: number, ty: number): boolean => (tx === up.tx && ty === up.ty) || (tx === down.tx && ty === down.ty);
    const spot = escapeFromZones(
      this.liveZones(),
      this.player.x,
      this.player.y,
      (tx, ty) => isWalkableCell(this.floor.tiles, tx, ty) && !stair(tx, ty),
    );
    if (spot) this.player.setPosition(spot.x, spot.y);
  }

  private spawnMonsters(): void {
    this.roamerGroup = this.physics.add.group();
    const r = run;
    if (!r) return;
    const spawn = (zone: MonsterZone, kind: string, id: string | null): void => {
      const boss = id === null;
      const x = zone.cx + (Math.random() - 0.5) * zone.w * 0.6;
      const y = zone.cy + (Math.random() - 0.5) * zone.h * 0.6;
      const def = ENEMIES[kind];
      const sprite = this.roamerGroup.create(x, y, def.texture) as Phaser.Physics.Arcade.Sprite;
      sprite.setDepth(10);
      sprite.body?.setSize(40, 24).setOffset(12, 32);
      if (boss) sprite.setScale(1.5);
      this.roamers.push({
        sprite,
        minX: zone.cx - zone.w / 2 + 8,
        maxX: zone.cx + zone.w / 2 - 8,
        minY: zone.cy - zone.h / 2 + 8,
        maxY: zone.cy + zone.h / 2 - 8,
        targetX: x,
        targetY: y,
        wait: 300 + Math.random() * 800,
        speed: (boss ? 40 : 56) + Math.random() * 40,
        kind,
        id,
      });
      this.tweens.add({
        targets: sprite,
        scaleX: boss ? 1.68 : 1.12,
        scaleY: boss ? 1.32 : 0.88,
        duration: 280,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    };
    this.floor.zones.forEach((zone, z) => {
      zone.kinds.forEach((kind, i) => {
        const id = `${z}:${i}`;
        if (!r.met.has(id)) spawn(zone, kind, id);
      });
    });
    if (this.floor.guardian && this.floor.lair && !r.guardianDown) spawn(this.floor.lair, this.floor.guardian, null);
  }

  private spawnChest(): void {
    const c = this.floor.chest;
    if (!c || !run) return;
    const at = cellCenter(c);
    addGroundShadow(this, at, { w: 40, h: 14, yOffset: 24 });
    const chest = this.add.image(at.x, at.y, run.chestOpened ? "chest-open" : "chest").setDepth(9);
    if (run.chestOpened) return;
    const zone = this.add.zone(at.x, at.y, TILE, TILE);
    this.physics.add.existing(zone);
    this.physics.add.overlap(this.player, zone, () => this.openChest(chest));
  }

  // gold by depth (abyss.ts's loot scaling) and, more often than not, a
  // potion or an ETHER to carry the dive on
  private openChest(chest: Phaser.GameObjects.Image): void {
    if (!run || run.chestOpened) return;
    run.chestOpened = true;
    chest.setTexture("chest-open");
    this.holdFights();
    Sfx.chest();
    const loot = abyssScale(run.floor, GameState.enemyScale()).loot;
    const gold = GameState.gainGold(Math.round((CHEST_GOLD_MIN + Math.floor(Math.random() * CHEST_GOLD_SPREAD)) * loot));
    let found = "";
    const roll = Math.random();
    let edge = 0;
    const item = CHEST_LOOT.find((l) => {
      edge += l.chance;
      return roll < edge;
    });
    if (item) {
      GameState.inventory[item.key] += 1;
      found = ` ${item.name}!`;
      Sfx.pickup();
    }
    // "+80 GOLD HI-POTION!" (x2 loot at most) is 19 x 24 = 456px; kept on the
    // map like the volcano's notes, whatever wall the chest sits against
    const note = this.add
      .text(chest.x, chest.y - 52, `+${gold} GOLD${found}`, retroStyle(6, "#4ade80"))
      .setOrigin(0.5)
      .setDepth(120);
    note.setX(Phaser.Math.Clamp(note.x, note.width / 2 + 8, ABYSS_W * TILE - note.width / 2 - 8));
    this.tweens.add({
      targets: note,
      y: note.y - 40,
      alpha: 0,
      duration: 900,
      onComplete: () => note.destroy(),
    });
    GameState.save();
  }

  private updateRoamers(delta: number): void {
    for (const r of this.roamers) {
      const s = r.sprite;
      if (r.wait > 0) {
        r.wait -= delta;
        if (r.wait <= 0) this.pickRoamerTarget(r);
        continue;
      }
      const dx = r.targetX - s.x;
      const dy = r.targetY - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 4) {
        s.setVelocity(0, 0);
        r.wait = 500 + Math.random() * 900;
      } else {
        s.setVelocity((dx / dist) * r.speed, (dy / dist) * r.speed);
      }
      s.x = Phaser.Math.Clamp(s.x, r.minX, r.maxX);
      s.y = Phaser.Math.Clamp(s.y, r.minY, r.maxY);
    }
  }

  private pickRoamerTarget(r: Roamer): void {
    r.targetX = r.minX + Math.random() * (r.maxX - r.minX);
    r.targetY = r.minY + Math.random() * (r.maxY - r.minY);
  }

  private startBattle(kind: string, roamer: Roamer | null): void {
    if (this.encounterCooldown > 0 || this.leaving || !run) return; // already fading into a battle
    this.player.setVelocity(0, 0);
    this.encounterCooldown = ENCOUNTER_COOLDOWN;
    // a scene change like the stairs': without this the hero walked on
    // through the fade, and a stair reached in it started its scene as well,
    // leaving the battle and a floor running at once
    this.leaving = true;
    const guardian = !!roamer && roamer.id === null;
    run.fight = { x: this.player.x, y: this.player.y, roamer: roamer?.id ?? null, guardian, battles: GameState.battles };
    const bout: AbyssBout = { floor: run.floor, guardian };
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("Battle", { enemy: kind, from: "Abyss", abyss: bout });
    });
  }
}
