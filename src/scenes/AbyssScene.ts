import Phaser from "phaser";
import {
  ABYSS_H,
  ABYSS_W,
  type AbyssBout,
  type AbyssFloor,
  abyssKind,
  abyssResume,
  abyssScale,
  boutDepth,
  cellCenter,
  floorSeed,
  generateFloor,
  portalOnLeave,
} from "../abyss";
import { DUNGEON_THEME, Sfx } from "../audio";
import { GAME_WIDTH } from "../config";
import { encounterOut } from "../fx";
import { GameState } from "../gameState";
import { escapeFromZones, type MonsterZone, T_GRASS, T_PATH, T_ROCK, T_TALL, T_WATER_A, T_WATER_B, TILE } from "../levels";
import { ENEMIES } from "../monsters";
import { ART_PX, addGroundShadow, FIELD_TOAST_Y, makeTexture, retroStyle, showToast } from "../pixelart";
import type { PixelText } from "../pixelText";
import {
  RELIC_EVERY,
  RELICS,
  type RelicKey,
  relicAmbush,
  relicGold,
  relicLine,
  relicTotal,
  resetRelics,
  rollRelicOffer,
  takeRelic,
} from "../relics";
import {
  addBorderDressing,
  addRoamer,
  addTownExitLabel,
  askWarpHome,
  boundCameraToMap,
  buildTileLayers,
  createWalkAnimations,
  FieldKeys,
  FieldPanels,
  FieldToasts,
  fadeAreaTitle,
  fadeInAfterAreaTitle,
  HeroWalk,
  isWalkableCell,
  type Roamer,
  saveAndQuit,
  saveOnShutdown,
  startWaterAnimation,
  walkOut,
  wanderRoamers,
  whilePanelUp,
} from "../sceneCommon";
import { AchievementsUI } from "../ui/AchievementsUI";
import { addAmbient } from "../ui/Ambient";
import { BestiaryUI } from "../ui/BestiaryUI";
import { CompanionSprite } from "../ui/CompanionSprite";
import { addCritters } from "../ui/Critters";
import { DialogueBox } from "../ui/DialogueBox";
import { addFootsteps } from "../ui/Footsteps";
import { addHelpPopup } from "../ui/HelpPopup";
import { InventoryUI } from "../ui/InventoryUI";
import { CAVE_TILE_COLORS, Minimap } from "../ui/Minimap";
import { lightsOverTiles, NightOverlay } from "../ui/NightOverlay";
import { addProp, PILLAR_FIRE } from "../ui/propFx";
import { QuestLog } from "../ui/QuestLog";
import { SettingsUI } from "../ui/SettingsUI";
import { STATUS_HUD_HEIGHT, StatusHud } from "../ui/StatusHud";
import { isTouchDevice, TouchControls } from "../ui/TouchControls";
import { WARP_IN_MS, warmWarp, warpIn, warpOut } from "../ui/warpFx";
import { CAVE_SKIN } from "./BootScene";

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
// A GUARDIAN's hall burns while the guardian holds it: violet fire
// (propFx.ts PILLAR_FIRE) on each of its pillars, the boulders standing
// inside its walls (abyss.ts PILLAR_SPOTS, mirrored, each there half the
// time), and none once it falls, the hall coming back unsealed. The fire's
// foot this far over the boulder's middle, sunk into its crown; at the
// rock's depth (9, as the cave's exit torches), so under the hero (10) and the
// tags (11). A violet glow in the air over each (as the stair down's: the
// lightmap has nothing to give back on the near-black rock), a phase apart so
// no two breathe as one.
const PILLAR_FIRE_DY = -14;
const PILLAR_FIRE_DEPTH = 9;
const PILLAR_GLOW = { radius: 96, color: 0x9d5cec, strength: 0.3, pulseMs: 1300, air: true } as const;
// a guarded stair says so at most this often while the hero stands on it
const SEALED_TOAST_MS = 2000;
const DOWN_COLOR = "#c084fc";
// What the dive holds (relics.ts relicLine), one line under the HUD: from
// x=24 at retroStyle(4), 16px a glyph, y 134..150, between the floor's title
// (y 96..128) and the toasts (y 166..186). Its longest, every relic at its
// max, is 67 glyphs: 1072px, ending at x=1096, short of the touch menu's
// column (x >= 1225). Over the map, so outlined; above the gloom (90) and
// under the HUD (110) and every panel.
const RELIC_TAG_X = 24;
const RELIC_TAG_Y = 134;
const RELIC_TAG_DEPTH = 96;
const SEALED_COLOR = "#ff5555";
const CURSED_TINT = 0xb388ff;
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
// the cave's way down use them: the cave's own stone (art/tilesets.ts's
// CAVE_ROCK_PALETTE), steps narrowing into a void with a violet glow, and a
// flight rising into daylight for the way back up. 32-cell grids drawn at
// ART_PX, a cell 2px as on the field round them, with the slabs' joints
// across the steps and chips in the walls; the pit is where it was, under
// the rift that turns in it (abyssRift.ts STAIR_RIFT).
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
  "................................",
  "................................",
  ".....bbbbbbbbbbbbbbbbbbbbbb.....",
  "...bbHHcHHHHHHcHHHHHHcHHHHHbb...",
  "...bbHHHHHHcHHHHHHcHHHHHHcHHb...",
  "..bHcHHHHHHcHHHHHHcHHHHHHcHHHb..",
  "..bcDccccccDccccccDccccccDcccb..",
  "..bcDccccccDccccccDccccccDcccb..",
  "..bSSDSSSSSSSSSSSSSSSSSSSSSDSb..",
  "..bSSSSSSSSSSSSSSSSSSSSSSSSDSb..",
  "..bSSSSHcHHHHHHcHHHHHHcHHSSSSb..",
  "..bSSDHHcHHHHHHcHHHHHHcHHHSSSb..",
  "..bSSSccccccDccccccDccccccSSSb..",
  "..bSSSScccccDccccccDcccccSDSSb..",
  "..bSSSSDSSSSSSSSSSDDSSSSSSSSDb..",
  "..bSSSSSSSSSSSSSSSSSSSSSSSSSSb..",
  "..bSSSSSDDDDDDDDDDDDDDDDSSSSSb..",
  "..bSSSSSDDDDDDDDDDDDDDDDSSSSDb..",
  "..bSSSSSSDSSSSSSSSSSSSSSSSSSSb..",
  "..bSSSSSSSSSSSSDSSSSSDSSDSSSSb..",
  "..bSSSSSSkkkkkkkkkkkkkkSSSSSSb..",
  "..bSSSSkkkkkkkkkkkkkkkkkkSDSSb..",
  "..bSSSSkkkkkkppppppkkkkkkSSSSb..",
  "..bSDSkkkkkppppppppppkkkkkSSSb..",
  "..bDSSkkkkppPPPPPPPPppkkkkSSSb..",
  "..bSSSkkkkppPPPPPPPPppkkkkSSSb..",
  "..bSSSkkkkkppppppppppkkkkkSSSb..",
  "..bbSSkkkkkkppppppppkkkkkkSSbb..",
  "..bbbSkkkkkkppppppppkkkkkkDbbb..",
  "...bbbbbbbbbbbbbbbbbbbbbbbbbb...",
  "................................",
  "................................",
];
// biome-ignore format: kept one row per line so the art reads as a grid
const STAIRS_UP = [
  "................................",
  "................................",
  ".....bbbbbbbbbbbbbbbbbbbbbb.....",
  "...bbLLlLLLLLLlLLLLLLlLLLLLbb...",
  "...bbLLLLLLlLLLLLLlLLLLLLlLLb...",
  "..bLlLLLLLLlLLLLLLlLLLLLLlLLLb..",
  "..blHllllllHllllllHllllllHlllb..",
  "..blHllllllHllllllHllllllHlllb..",
  "..bHHHHHcHHHHHHcHHHHHHcHHHHHHb..",
  "..bHHHHHcHHHHHHcHHHHHHcHHHHHHb..",
  "..bcccccDccccccDccccccDccccccb..",
  "..bcccccDccccccDccccccDccccccb..",
  "..bSSSDSSSSSSSSSSSSSSSSSSSSSSb..",
  "..bSSSSSSSSSSSSSSSSSSSSSSSDSSb..",
  "..bHHcHHHHHHcHHHHHHcHHHHHHcHHb..",
  "..bHHcHHHHHHcHHHHHHcHHHHHHcHHb..",
  "..bccccccDccccccDccccccDcccccb..",
  "..bccccccDccccccDccccccDcccccb..",
  "..bSSSSSSDSSSSSSSSSSSSSSSSSSSb..",
  "..bSSSSSSSSSSSSDSSSSSDSSDSSSSb..",
  "..bHHHHHHHHHHHHHHHHHHHHHHHHHHb..",
  "..bHHHHHHHHHHHHHHHHHHHHHHHHHHb..",
  "..bccccccccccccccccccccccccccb..",
  "..bccccccccccccccccccccccccccb..",
  "..bDSSSSSSSSSSSSSSSSDSSSSSSSSb..",
  "..bSSSSSSSSSSSSDSDSSSSSSSSSSSb..",
  "..bHHHHHHHHHHHHHHHHHHHHHHHHHHb..",
  "..bbHHHHHHHHHHHHHHHHHHHHHHHHbb..",
  "..bbbHHHHHHHHHHHHHHHHHHHHHHbbb..",
  "...bbbbbbbbbbbbbbbbbbbbbbbbbb...",
  "................................",
  "................................",
];
export const STAIRS_DOWN_KEY = "abyss-stairs-down";
const STAIRS_UP_KEY = "abyss-stairs-up";

// once per page load: generateTexture onto an existing key composites
export function bakeAbyssStairs(scene: Phaser.Scene): void {
  if (scene.textures.exists(STAIRS_DOWN_KEY)) return;
  makeTexture(scene, STAIRS_DOWN_KEY, STAIRS_DOWN, STAIRS_PALETTE, ART_PX);
  makeTexture(scene, STAIRS_UP_KEY, STAIRS_UP, STAIRS_PALETTE, ART_PX);
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
  // stairs taken down this dive, and the two relics on offer (relics.ts):
  // rolled as the dive starts and on every RELIC_EVERY-th stair, kept here
  // until one is taken, so a fight that cuts in can't lose the offer
  descents: number;
  offer: [RelicKey, RelicKey] | null;
  // Where the hero stood when the fight began, who it was with, and the win
  // count then: a guardian is only down if GameState.battles grew (it can't
  // be caught, and a flight leaves the count alone), so one fled from stays.
  // `cursed` is the cursed chest's fight: won, by the same count, or its foe
  // caught (a catch leaves that count alone, so the catch list's length is
  // kept too), it opens.
  fight: { x: number; y: number; roamer: string | null; guardian: boolean; cursed: boolean; battles: number; caught: number } | null;
}

let run: AbyssRun | null = null;

function freshFloor(r: AbyssRun): void {
  r.met = new Set();
  r.chestOpened = false;
  r.guardianDown = false;
  r.fight = null;
}

interface AbyssRoamer extends Roamer {
  id: string | null; // null for the guardian
}

// The post-game dive (abyss.ts): a generated floor at a time, on the cave's
// tiles and with the field scenes' skeleton (roamer zones, a chest, the way
// back to town), plus the stair down and, every fifth floor, a guardian on it.
export class AbyssScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private companionFollower!: CompanionSprite;
  private floor!: AbyssFloor;
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private objectLayer!: Phaser.Tilemaps.TilemapLayer;
  private roamerGroup!: Phaser.Physics.Arcade.Group;
  private roamers: AbyssRoamer[] = [];
  private downLabel!: PixelText;
  private upStair!: Phaser.GameObjects.Zone;
  // the stair up has asked since the hero last stepped onto it: a STAY holds
  // the question back until the hero steps off and on again
  private stairAsked = false;
  // likewise the cursed chest's question
  private chestAsked = false;
  private cursedChest?: Phaser.GameObjects.Zone;
  private dialogue!: DialogueBox;
  private encounterCooldown = 0;
  private leaving = false;
  private sealedToastAt = 0;
  private relicTag!: PixelText;

  private walk!: HeroWalk;
  private fieldKeys!: FieldKeys;
  private quitting = false;
  private toasts!: FieldToasts;

  private hud!: StatusHud;
  private minimap!: Minimap;
  private panels!: FieldPanels;
  private night!: NightOverlay;
  private touch?: TouchControls;

  constructor() {
    super("Abyss");
  }

  // `fromBattle` / `fromStairs` carry on the dive in memory; anything else
  // (the cave's stair or the town's gate) starts a new one, at B1 or at
  // `start` when that is where it offered to pick up (abyssResume: the
  // checkpoint, or the portal, which taking uses up — saved before anything
  // else, quietly)
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
      // a new dive holds no relics, and is offered its first on arrival
      resetRelics();
      run = {
        seed: (Math.random() * 2 ** 32) >>> 0,
        floor: startFloor,
        met: new Set(),
        chestOpened: false,
        guardianDown: false,
        fight: null,
        descents: 0,
        offer: rollRelicOffer(),
      };
    }
    const r = run;
    this.roamers = [];
    this.encounterCooldown = ENTRY_GRACE;
    this.leaving = false;
    this.sealedToastAt = 0;
    this.quitting = false;
    // back from a fight the hero stands where it began, which can be the
    // stair up: no question until a step off it
    this.stairAsked = fromBattle;
    this.chestAsked = fromBattle;
    this.cursedChest = undefined;

    // SAVED and the achievements; the first SHUTDOWN listener (FieldToasts)
    this.toasts = new FieldToasts(this, { blocked: () => this.uiBlocking() });

    // the same seed rebuilds the floor a battle was fought on, exactly
    const floor = generateFloor(r.floor, floorSeed(r.seed, r.floor, GameState.ngPlus));
    this.floor = floor;

    // settle the fight that just handed back
    const back = fromBattle ? r.fight : null;
    r.fight = null;
    let unsealed = false;
    let curseLifted = false;
    if (back?.guardian && GameState.battles > back.battles) unsealed = r.guardianDown = true;
    else if (back?.cursed && (GameState.battles > back.battles || GameState.caught.length > back.caught)) {
      // the cursed chest's foe fell or was caught: the chest is open, a relic its find
      curseLifted = r.chestOpened = true;
      GameState.feats.cursedOpened += 1;
      r.offer ??= rollRelicOffer();
    } else if (back?.roamer) r.met.add(back.roamer);
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
        .pixelText(GAME_WIDTH / 2, STATUS_HUD_HEIGHT + 24, `ABYSS B${r.floor}`, retroStyle(8, DOWN_COLOR))
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
    const pillarFires =
      floor.guardian && !r.guardianDown
        ? level.flatMap((row, ty) =>
            row.flatMap((tile, tx) =>
              tile === T_ROCK && tx > 0 && ty > 0 && tx < ABYSS_W - 1 && ty < ABYSS_H - 1 ? [cellCenter({ tx, ty })] : [],
            ),
          )
        : [];
    for (const [i, c] of pillarFires.entries()) addProp(this, PILLAR_FIRE, c.x, c.y + PILLAR_FIRE_DY, PILLAR_FIRE_DEPTH, (i * 0.618) % 1);

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

    const shadow = addGroundShadow(this, this.player);
    this.companionFollower = new CompanionSprite(this, this.player.x, this.player.y);

    const weapon = this.add.sprite(this.player.x, this.player.y, "equip-sword").setDepth(11).setVisible(false);
    const shield = this.add.sprite(this.player.x, this.player.y, "equip-shield").setDepth(11).setVisible(false);

    createWalkAnimations(this);

    addFootsteps(this, this.player, level, "dungeon");
    // The cave's dust and drips. No guide arrow: the quest's goals all lie
    // above, and objective.ts would point at the cave's own exit coordinates.
    addAmbient(this, "dungeon", { level });
    // and the wisps the cave above has none of
    addCritters(this, "abyss");

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
      .pixelText(down.x, down.y - TILE + 8, "", retroStyle(5, DOWN_COLOR))
      .setOrigin(0.5, 1)
      .setStroke("#1a1028", 4)
      .setDepth(9);
    this.tweens.add({ targets: this.downLabel, y: this.downLabel.y - 8, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    // a stair down by the way in sat under the floor's title (1 floor in 400)
    if (!back) fadeInAfterAreaTitle(this, this.downLabel);
    this.refreshDownLabel();

    startWaterAnimation(this, this.layer);

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    boundCameraToMap(this, ABYSS_W * TILE, ABYSS_H * TILE, true);

    this.walk = new HeroWalk(this, this.player, { shadow, companion: this.companionFollower, weapon, shield });
    this.fieldKeys = new FieldKeys(this, { warp: true });
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
        ["W", "WARP HOME"],
        ["Q", "QUIT"],
        ["?", "HELP"],
      ],
      // built per visit, so back from felling the guardian it says what's next
      floor.guardian && !r.guardianDown ? "DEFEAT THE GUARDIAN!" : "FIND THE STAIRS DOWN!",
      () => this.uiBlocking() || this.quitting || this.fieldKeys.leaving(),
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
      ...lightsOverTiles(level, new Set([T_WATER_A, T_WATER_B]), {
        radius: 112,
        color: 0x3b82f6,
        strength: 0.18,
        pulseMs: 4200,
        air: true,
      }),
      { x: down.x, y: down.y, radius: 128, color: 0x8b5cf6, strength: 0.4, pulseMs: 2400, air: true },
      ...pillarFires.map((c) => ({ ...PILLAR_GLOW, x: c.x, y: c.y + PILLAR_FIRE_DY - 24 })),
      // a cursed chest glows as the guardian's fires do, until it is opened
      ...(floor.chest && floor.cursed && !r.chestOpened ? [{ ...PILLAR_GLOW, ...cellCenter(floor.chest) }] : []),
    ]);

    this.panels = new FieldPanels(this, this.fieldKeys);
    this.panels.add(new InventoryUI(this), "I");
    this.panels.add(new BestiaryUI(this), "B");
    this.panels.add(new AchievementsUI(this), "A");
    this.panels.add(new QuestLog(this), "U");
    // the stair up's question (askLeave) and the quit question (askQuitToTitle)
    this.dialogue = this.panels.add(new DialogueBox(this, []));
    // touch has no Q: the settings' QUIT chip runs the same save-and-quit as YES
    this.panels.add(new SettingsUI(this, () => this.quit()), "O");

    // under a panel, the stair's question or the help the map's tags (TOWN,
    // the stair down's) go and toasts wait
    whilePanelUp(this, () => this.uiBlocking());

    this.hud = new StatusHud(this);
    this.relicTag = this.add
      .pixelText(RELIC_TAG_X, RELIC_TAG_Y, relicLine(), retroStyle(4, DOWN_COLOR))
      .setStroke("#1a1028", 4)
      .setScrollFactor(0)
      .setDepth(RELIC_TAG_DEPTH);

    if (isTouchDevice()) this.touch = new TouchControls(this);

    saveOnShutdown(this, [this.minimap, this.panels, this.night, this.companionFollower, help, this.touch]);

    // On a floor arrived at, by a portal (the gate, the cave's stair) or the
    // stair down, the hero blinks in (warpFx.ts); the entry grace runs on past
    // it. Then the sheets for the next stair down, should the look or gear
    // have changed on the way.
    if (!fromBattle) {
      this.encounterCooldown += WARP_IN_MS;
      warpIn(this, this.walk);
    }
    warmWarp(this);

    // News, queued under the floor's title. "NEW RECORD: B999!" is 17 glyphs
    // and "A GUARDIAN SEALS THE STAIRS!" 28 (560px) at retroStyle(5).
    if (record) {
      this.toasts.quietSave();
      // B1 is everyone's first record; only a new depth is news
      if (r.floor > 1) showToast(this, `NEW RECORD: B${r.floor}!`, FIELD_TOAST_Y);
    }
    if (unsealed) {
      Sfx.levelup();
      showToast(this, "THE STAIRS ARE OPEN!", FIELD_TOAST_Y);
      if (checkpoint) {
        this.toasts.quietSave();
        // "CHECKPOINT: B996!" is 17 glyphs, as the record's
        showToast(this, `CHECKPOINT: B${GameState.abyssCheckpoint}!`, FIELD_TOAST_Y);
      }
    } else if (floor.guardian && !r.guardianDown && !fromBattle) {
      showToast(this, "A GUARDIAN SEALS THE STAIRS!", FIELD_TOAST_Y);
    }
    if (curseLifted) {
      Sfx.chest();
      showToast(this, "THE CURSE LIFTS!", FIELD_TOAST_Y);
    }
  }

  update(_time: number, delta: number): void {
    GameState.minutes += (delta / 1000) * GameState.timeSpeed;
    this.hud.update();
    // gone with the HUD (S), and under a panel or a question, as the map's tags
    this.relicTag.setVisible(this.hud.isVisible() && !this.uiBlocking());

    this.toasts.update(delta);

    this.fieldKeys.takeSystemKeys(this.hud);

    this.fieldKeys.takeMapKey(this.minimap, () => this.uiBlocking());

    // saved and on the way to the title (quit): nothing else moves. The
    // roamers are kept to their boxes, as under a panel: left on their last
    // velocity they walked off across the map until the title came
    if (this.quitting) {
      wanderRoamers(this.roamers, delta);
      return;
    }

    this.fieldKeys.takeQuitKey(
      this.dialogue,
      () => this.uiBlocking(),
      () => this.quit(),
    );

    // W: the warp home question, not over a panel or a way out already begun
    this.fieldKeys.takeWarpKey(
      () => this.uiBlocking() || this.leaving || !run,
      () => this.warpHome(),
    );

    if (this.uiBlocking()) {
      this.walk.halt();
      this.panels.update();
      wanderRoamers(this.roamers, delta);
      return;
    }

    // stepped off the stair up: the next step onto it asks again
    if (this.stairAsked && !this.physics.overlap(this.player, this.upStair)) this.stairAsked = false;
    if (this.chestAsked && this.cursedChest && !this.physics.overlap(this.player, this.cursedChest)) this.chestAsked = false;

    if (this.panels.takeOpenKey()) return;

    // a relic waiting to be picked, once the hero has blinked in
    if (run?.offer && !this.leaving && !this.fieldKeys.leaving()) {
      this.offerRelic(run, run.offer);
      return;
    }

    const moving = this.walk.step(this.leaving);
    // no hunt (temper.ts): a floor's corridors leave a chased hero no way
    // round, and a dive's HP is not given back between fights
    wanderRoamers(this.roamers, delta);
    this.night.update();
    this.minimap.update();
    this.checkEncounter(delta, moving);
  }

  private uiBlocking(): boolean {
    return this.panels.blocking();
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
        this.toasts.quietSave();
        this.leave(() => {
          run = null;
          this.scene.start("Town", { fromDungeon: true });
        });
      },
      0,
    );
  }

  // W: back to HOME in town, blinking out as the stair down does. What the
  // stair up keeps it keeps: the portal on this floor (askLeave), so the next
  // dive can start there, and the run ends as a walk out's does.
  private warpHome(): void {
    if (this.leaving || !run) return;
    const portal = portalOnLeave(run.floor, GameState.abyssPortal);
    askWarpHome(
      this,
      this.walk,
      this.dialogue,
      () => {
        GameState.abyssPortal = portal;
        this.toasts.quietSave();
        this.leaving = true;
      },
      () => {
        run = null;
      },
    );
  }

  // Two relics, one to keep (relics.ts): the question is one row, "AEGIS:
  // WARD 1 TURN. HEART: WIN HEAL 4%." its longest at 39 glyphs of a touch
  // box's 42, and the names its two choices. No way to decline: ESC and N
  // take the second, both being a gain. The fights hold off after it as
  // after a chest.
  private offerRelic(r: AbyssRun, offer: [RelicKey, RelicKey]): void {
    this.walk.halt();
    const [a, b] = offer.map((k) => RELICS[k]);
    this.dialogue.ask([`${a.name}: ${a.effect}. ${b.name}: ${b.effect}.`], "RELIC", [a.name, b.name], (i) => {
      const key = offer[i === 0 ? 0 : 1];
      r.offer = null;
      takeRelic(key);
      GameState.feats.relicBest = Math.max(GameState.feats.relicBest, relicTotal());
      this.relicTag.setText(relicLine());
      this.holdFights();
      Sfx.chest();
      // "RELIC: PLATE!" is 13 glyphs at most
      showToast(this, `RELIC: ${RELICS[key].name}!`, FIELD_TOAST_Y);
    });
  }

  // YES to the quit question, or the settings' QUIT chip on touch
  private quit(): void {
    this.quitting = true;
    saveAndQuit(this);
  }

  private guardianAlive(): boolean {
    return !!this.floor.guardian && !run?.guardianDown;
  }

  private refreshDownLabel(): void {
    const sealed = this.guardianAlive();
    this.downLabel.setText(sealed ? "SEALED" : `B${(run?.floor ?? 0) + 1}`).setColor(sealed ? SEALED_COLOR : DOWN_COLOR);
  }

  // fade out once, then `next` (a scene change): the stair up (the stair down
  // blinks out instead, tryDescend)
  private leave(next: () => void): void {
    if (this.leaving) return;
    this.leaving = true;
    walkOut(this, this.player, next);
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
    // blinked out of rather than walked (warpFx.ts), as the way in was
    this.leaving = true;
    warpOut(this, this.walk, () => {
      r.floor += 1;
      r.descents += 1;
      if (r.descents % RELIC_EVERY === 0) r.offer ??= rollRelicOffer();
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
    if (Math.random() < ENCOUNTER_RATE * relicAmbush() * (delta / 1000)) this.startBattle(abyssKind(run.floor), null);
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
      this.roamers.push({ ...addRoamer(this, this.roamerGroup, zone, kind, ENEMIES[kind].texture, id === null), id });
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
    addGroundShadow(this, at, { w: 40, h: 16, yOffset: 24 });
    const chest = this.add.image(at.x, at.y, run.chestOpened ? "chest-open" : "chest").setDepth(9);
    if (run.chestOpened) return;
    const zone = this.add.zone(at.x, at.y, TILE, TILE);
    this.physics.add.existing(zone);
    if (this.floor.cursed) {
      // violet, under the glow create() gives it
      chest.setTint(CURSED_TINT);
      this.cursedChest = zone;
      this.physics.add.overlap(this.player, zone, () => this.askCursed());
    } else this.physics.add.overlap(this.player, zone, () => this.openChest(chest));
  }

  // A cursed chest asks first (abyss.ts): OPEN is a fight with a foe of
  // CURSED_DEPTH floors deeper (B13 at the least), LEAVE (and ESC) walks
  // away. Asked once a visit to the chest, as the stair up asks. "A CURSED
  // CHEST. OPEN IT?" is 24 glyphs, one row of a touch question.
  private askCursed(): void {
    if (this.leaving || this.chestAsked || this.uiBlocking() || this.quitting || this.fieldKeys.leaving() || !run) return;
    this.chestAsked = true;
    this.walk.halt();
    const r = run;
    this.dialogue.ask(["A CURSED CHEST. OPEN IT?"], "CHEST", ["OPEN", "LEAVE"], (i) => {
      if (i !== 0) return;
      // the question's own wait is not a fight's cooldown
      this.encounterCooldown = 0;
      this.startBattle(abyssKind(boutDepth({ floor: r.floor, guardian: false, cursed: true })), null, true);
    });
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
    const gold = GameState.gainGold(Math.round((CHEST_GOLD_MIN + Math.floor(Math.random() * CHEST_GOLD_SPREAD)) * loot * relicGold()));
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
    // "+128 GOLD HI-POTION!" (x2 loot at most, three PURSEs' x1.6 on it) is
    // 20 x 24 = 480px; kept on the
    // map like the volcano's notes, whatever wall the chest sits against
    const note = this.add
      .pixelText(chest.x, chest.y - 52, `+${gold} GOLD${found}`, retroStyle(6, "#4ade80"))
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

  private startBattle(kind: string, roamer: AbyssRoamer | null, cursed = false): void {
    if (this.encounterCooldown > 0 || this.leaving || !run) return; // already fading into a battle
    this.player.setVelocity(0, 0);
    this.encounterCooldown = ENCOUNTER_COOLDOWN;
    // a scene change like the stairs': without this the hero walked on
    // through the fade, and a stair reached in it started its scene as well,
    // leaving the battle and a floor running at once
    this.leaving = true;
    const guardian = !!roamer && roamer.id === null;
    run.fight = {
      x: this.player.x,
      y: this.player.y,
      roamer: roamer?.id ?? null,
      guardian,
      cursed,
      battles: GameState.battles,
      caught: GameState.caught.length,
    };
    const bout: AbyssBout = { floor: run.floor, guardian, cursed };
    encounterOut(this.cameras.main, 300, () => {
      this.scene.start("Battle", { enemy: kind, from: "Abyss", abyss: bout });
    });
  }
}
