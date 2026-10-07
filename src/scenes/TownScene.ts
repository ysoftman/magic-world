import Phaser from "phaser";
import { ACHIEVEMENTS, claimAchievements } from "../achievements";
import { OVERWORLD_THEME, Sfx } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH, PIXEL } from "../config";
import { CROPS, FARM_PLOTS, GameState, isNight, onSaved } from "../gameState";
import {
  BOUNTY_BOARD_POS,
  buildLevel,
  CAVE_POS,
  EDITABLE_POS,
  escapeFromZones,
  FARM_POS,
  FARM_SIGN_POS,
  FISH_POS,
  FISH_SIGN_POS,
  FOREST_POS,
  farmPlots,
  GAMBLER_POS,
  HOUSE_POS,
  HUNTER_POS,
  hasMapOverride,
  LANDMARK_TILES,
  MAP_H,
  MAP_W,
  MONSTER_ZONES,
  NPC_POS,
  PLAYER_SPAWN,
  RANK_BOARD_POS,
  SHOP_POS,
  SNOW_POS,
  T_GRASS,
  TALL_GRASS,
  TILE,
} from "../levels";
import { allSpeciesCaught, CATCHABLE } from "../monsters";
import { addGroundShadow, retroStyle, showToast } from "../pixelart";
import {
  buildTileLayers,
  createWalkAnimations,
  isWalkableCell,
  OBJECT_LAYER_DEPTH,
  paintTile,
  startWaterAnimation,
  type TileLayers,
} from "../sceneCommon";
import { AchievementsUI } from "../ui/AchievementsUI";
import { BestiaryUI } from "../ui/BestiaryUI";
import { CompanionSprite } from "../ui/CompanionSprite";
import { DialogueBox } from "../ui/DialogueBox";
import { FarmUI } from "../ui/Farm";
import { FishingUI } from "../ui/Fishing";
import { addHelpPopup } from "../ui/HelpPopup";
import { InventoryUI } from "../ui/InventoryUI";
import { LuckyWheel } from "../ui/LuckyWheel";
import { MapEditor } from "../ui/MapEditor";
import { Minimap } from "../ui/Minimap";
import { NIGHT_ENCOUNTER_MULT, NightOverlay } from "../ui/NightOverlay";
import { RankingUI } from "../ui/RankingUI";
import { SettingsUI } from "../ui/SettingsUI";
import { ShopUI } from "../ui/Shop";
import { STATUS_HUD_HEIGHT, STATUS_HUD_TOAST_Y, StatusHud } from "../ui/StatusHud";
import { isTouchDevice, TouchControls } from "../ui/TouchControls";

const ENCOUNTER_RATE = 0.18;
const ENCOUNTER_COOLDOWN = 600;
const ENTRY_GRACE = 1200;
const MAX_COOLDOWN_STEP = 50;
// long enough for the SAVED confirmation to be readable before the title
const QUIT_SAVE_DELAY = 700;
const TROLL_KING_SPAWN_CHANCE = 0.35;
// Exits to another map (CAVE, FOREST, SNOW PASS) are all marked the same way:
// the tile that actually triggers the transition is outlined and pulsing, with
// the destination name above it — no signposts. The dy clears the CAVE's 128px
// entrance art and the neighbouring GUARD label.
const EXIT_LABEL_COLOR = "#9f9fd0";
const EXIT_AREA_COLOR = 0xffd166;
// gap between the top of the marker box (or of whatever entrance art stands
// above it) and the destination name, so the name reads as part of the box
const EXIT_LABEL_GAP = 20;
const GOLDEN_SLIME_CHANCE = 0.08;
// The house art and its shadow, one step above the object layer so neither the
// transition overlay (1) nor the object layer (2) can paint over the building.
const HOUSE_DEPTH = OBJECT_LAYER_DEPTH + 1;

type LastMove = "down" | "up" | "right" | "left";

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
  kind: "slime" | "troll" | "wolf" | "goldSlime" | "wisp";
}

const IDLE_TEXTURE: Record<LastMove, string> = {
  down: "hero-idle-down",
  up: "hero-idle-up",
  right: "hero-idle-right",
  left: "hero-idle-left",
};

export class TownScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private companionFollower!: CompanionSprite;
  private weaponOverlay!: Phaser.GameObjects.Sprite;
  private shieldOverlay!: Phaser.GameObjects.Sprite;
  private layers!: TileLayers;
  private dialogue!: DialogueBox;
  private shop!: ShopUI;
  private inventory!: InventoryUI;
  private bestiary!: BestiaryUI;
  private rankBoard!: RankingUI;
  private fishing!: FishingUI;
  private farm!: FarmUI;
  private cropSprites: Phaser.GameObjects.Sprite[] = [];
  private mapEditor!: MapEditor;
  // every object drawn relative to an editable landmark, with the offset it
  // was drawn at, so the map editor can move a landmark and its whole set of
  // sprites/labels together without waiting for a scene restart
  private landmarkParts: Array<{ name: string; obj: { x: number; y: number }; dx: number; dy: number }> = [];
  private level: number[][] = [];
  private editorQueued = false;
  private luckyWheel!: LuckyWheel;
  private achievementsUI!: AchievementsUI;
  private settingsUI!: SettingsUI;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private fireflies!: Phaser.GameObjects.Particles.ParticleEmitter;
  private roamerGroup!: Phaser.Physics.Arcade.Group;
  private roamers: Roamer[] = [];
  private wispRoamer?: Roamer;
  private wasNight = false;
  private encounterCooldown = 0;
  private lastMove: LastMove = "down";
  private night!: NightOverlay;
  private touch?: TouchControls;
  private homeLabel!: Phaser.GameObjects.Text;
  private homeBubble!: Phaser.GameObjects.Container;
  private bubbleVisible = false;
  private resting = false;
  private enteringDungeon = false;
  private enteringForest = false;
  private enteringSnow = false;
  // true while overlapping the forest/snow zone; reset a full tile away so
  // the sealed-entrance dialogue doesn't restart every overlap frame
  private forestOverlapActive = false;
  private snowOverlapActive = false;
  private zQueued = false;
  private sQueued = false;
  private ctrlSQueued = false;
  private iQueued = false;
  private gCheatQueued = false;
  private mQueued = false;
  private tQueued = false;
  private bQueued = false;
  private aQueued = false;
  private oQueued = false;
  private qQueued = false;
  // claims achievements at most once per second; the checks read live
  // GameState, so battle/fishing/treasure mutations made while a modal or
  // another scene owns input are caught on the next tick after returning here
  private achievementCheckAccum = 0;
  private quitConfirm = false;
  private quitting = false;
  private unsubSaved: () => void = () => {};
  // true while an achievement save is in flight; the onSaved "SAVED" toast is
  // skipped so it doesn't clobber the "ACHIEVEMENT: ...!" toast on the same
  // shared __toast text object (showToast reuses one per scene)
  private suppressSavedToast = false;
  private yQueued = false;
  private nQueued = false;
  private escQueued = false;
  private quitConfirmText!: Phaser.GameObjects.Text;

  private keyLeft!: Phaser.Input.Keyboard.Key;
  private keyRight!: Phaser.Input.Keyboard.Key;
  private keyUp!: Phaser.Input.Keyboard.Key;
  private keyDown!: Phaser.Input.Keyboard.Key;
  private keyH!: Phaser.Input.Keyboard.Key;
  private keyJ!: Phaser.Input.Keyboard.Key;
  private keyK!: Phaser.Input.Keyboard.Key;
  private keyL!: Phaser.Input.Keyboard.Key;
  private keyZ!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyI!: Phaser.Input.Keyboard.Key;
  private keyG!: Phaser.Input.Keyboard.Key;
  private keyM!: Phaser.Input.Keyboard.Key;
  private keyT!: Phaser.Input.Keyboard.Key;
  private keyB!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyY!: Phaser.Input.Keyboard.Key;
  private keyN!: Phaser.Input.Keyboard.Key;
  private keyEsc!: Phaser.Input.Keyboard.Key;
  private keyO!: Phaser.Input.Keyboard.Key;

  private hud!: StatusHud;
  private minimap!: Minimap;
  private guardPos = { x: 0, y: 0 };

  constructor() {
    super("Town");
  }

  create(data?: { fromDungeon?: boolean; fromBattle?: boolean; fromForest?: boolean; fromSnow?: boolean }): void {
    Sfx.playBgm(OVERWORLD_THEME);
    this.roamers = [];
    // Every entry gets a grace period, not just a return from battle: nothing
    // locked encounters when walking into the cave or forest, and their entry
    // tiles sit near a monster zone, so at night a fight fired immediately.
    this.encounterCooldown = ENTRY_GRACE;
    this.lastMove = "down";
    this.resting = false;
    this.enteringDungeon = false;
    this.enteringForest = false;
    this.enteringSnow = false;
    this.forestOverlapActive = false;
    this.snowOverlapActive = false;
    this.quitConfirm = false;
    this.quitting = false;
    this.wispRoamer = undefined;
    this.landmarkParts = [];
    this.wasNight = isNight();

    // Registered before the SHUTDOWN handler below that calls GameState.save()
    // — SHUTDOWN listeners fire in registration order, so this unsubscribes
    // before that save happens and no toast gets created on a scene that's
    // already tearing down. Keep this the first SHUTDOWN listener.
    this.unsubSaved = onSaved(() => {
      if (!this.suppressSavedToast) showToast(this, "SAVED", STATUS_HUD_TOAST_Y);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubSaved());

    const level = buildLevel();
    this.level = level;
    this.layers = buildTileLayers(this, level);

    this.physics.world.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);

    // The building covers its own tiles, so it has to clear both the
    // transition overlay (depth 1) and the object layer (depth 2) — the map
    // editor can drop the house on the road, and the overlay is opaque. The
    // shadow shares the depth and is added first, so it stays under the house.
    this.track(
      "HOUSE_POS",
      addGroundShadow(this, { x: HOUSE_POS.x + TILE, y: HOUSE_POS.y + TILE }, { w: 118, h: 22, yOffset: 66, depth: HOUSE_DEPTH }),
    );
    this.track(
      "HOUSE_POS",
      this.add
        .image(HOUSE_POS.x + TILE, HOUSE_POS.y + TILE, "house")
        .setOrigin(0.5, 0.5)
        .setDepth(HOUSE_DEPTH),
    );
    this.homeLabel = this.track(
      "HOUSE_POS",
      this.add
        .text(HOUSE_POS.x + TILE, HOUSE_POS.y + TILE - 80, "HOME", retroStyle(5, "#9f9fd0"))
        .setOrigin(0.5)
        .setDepth(11),
    );
    this.homeBubble = this.track("HOUSE_POS", this.buildHomeBubble());
    this.homeBubble.setVisible(false);

    this.addNpc("NPC_POS", NPC_POS, "ELDER", 0xffffff, "#9f9fd0");
    this.addNpc("SHOP_POS", SHOP_POS, "SHOP", 0xffd166);

    this.track("CAVE_POS", addGroundShadow(this, CAVE_POS, { w: 104, h: 24, yOffset: 56 }));
    this.track("CAVE_POS", this.add.image(CAVE_POS.x, CAVE_POS.y, "cave").setDepth(9));
    // the cave mouth is 128px tall and centred on the entrance tile, so its
    // name clears the art rather than the marker box
    this.addMapExit("CAVE_POS", CAVE_POS, "CAVE", 48);

    this.addSign("RANK_BOARD_POS", RANK_BOARD_POS, "RANK BOARD", "#c084fc");
    this.addSign("BOUNTY_BOARD_POS", BOUNTY_BOARD_POS, "BOUNTY BOARD", "#facc15");
    // fishing dock: signpost on the pond's bank, one tile from the cast spot
    this.addSign("FISH_SIGN_POS", FISH_SIGN_POS, "FISHING", "#38bdf8");
    // farm field: signpost on the grass beside the plots
    this.addSign("FARM_SIGN_POS", FARM_SIGN_POS, "FARM", "#a3e635");

    this.cropSprites = farmPlots().map((pos) =>
      this.track("FARM_POS", this.add.sprite(pos.x, pos.y, "crop-sprout").setDepth(8).setVisible(false)),
    );

    // eastern woods entrance: no signpost here, unlike the other exits — the
    // GUARD stands right beside it and already marks the opening
    this.addMapExit("FOREST_POS", FOREST_POS, "FOREST");

    // gatekeeper who lets nobody through until the KING SLIME falls; stands a
    // tile south of the entrance — beside it, where his name tag clears the
    // FOREST label now that the label hugs the marker box
    this.guardPos = {
      x: Phaser.Math.Clamp(FOREST_POS.x, TILE, (MAP_W - 1) * TILE),
      y: Phaser.Math.Clamp(FOREST_POS.y + TILE, TILE * 1.5, (MAP_H - 1) * TILE - TILE * 0.5),
    };
    this.addNpc("FOREST_POS", this.guardPos, "GUARD", 0x67e8f9);

    // north-west mountain pass to the snow field: no signpost, same as the
    // other two exits — every one of them is just its name above the opening
    this.addMapExit("SNOW_POS", SNOW_POS, "SNOW PASS");

    this.addNpc("HUNTER_POS", HUNTER_POS, "HUNTER", 0x86efac);
    this.addNpc("GAMBLER_POS", GAMBLER_POS, "GAMBLER", 0xf472b6);

    const respawn = GameState.pos ?? PLAYER_SPAWN;
    // Position-based fallback for old saves / any other path that lands here
    // without the explicit flag. The real signal is `data.fromDungeon`, set
    // by DungeonScene.exitDungeon() — inferring "near the cave" from raw
    // coordinates undercounts the actual overlap-trigger radius (player body
    // half-width extends it further than this box), so it can't be trusted
    // alone.
    const nearCave = Math.abs(respawn.x - CAVE_POS.x) <= TILE / 2 && Math.abs(respawn.y - CAVE_POS.y) <= TILE / 2;
    const fromDungeon = !!data?.fromDungeon || nearCave;
    const fromForest = !!data?.fromForest;
    const fromSnow = !!data?.fromSnow;
    const spawn = fromDungeon
      ? { x: CAVE_POS.x, y: CAVE_POS.y + TILE * 2 }
      : fromForest
        ? { x: FOREST_POS.x, y: FOREST_POS.y + TILE * 2 }
        : fromSnow
          ? { x: SNOW_POS.x, y: SNOW_POS.y + TILE * 2 }
          : respawn;
    // just walked out of the cave/forest/snow: hold off re-triggering it in
    // case the player is still holding the walk-in key
    if (fromDungeon || fromForest || fromSnow) this.encounterCooldown = Math.max(this.encounterCooldown, ENCOUNTER_COOLDOWN);
    // the map editor can paint a tree (or water) over wherever the hero was
    // standing — drop them back at the town spawn rather than inside a wall
    const safeSpawn = isWalkableCell(level, Math.floor(spawn.x / TILE), Math.floor(spawn.y / TILE)) ? spawn : PLAYER_SPAWN;
    this.player = this.physics.add.sprite(safeSpawn.x, safeSpawn.y, "hero-idle-down");
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    this.player.body?.setSize(40, 32).setOffset(12, 32);
    // Both layers: the trees and the house block moved off the terrain layer
    // and carry their collision on the object layer now.
    this.physics.add.collider(this.player, this.layers.terrain);
    this.physics.add.collider(this.player, this.layers.objects);

    // A battle just ended on this spot, which is inside a monster zone —
    // step out to the nearest walkable tile outside it so the encounter
    // lock expiring here doesn't trigger another fight immediately.
    if (data?.fromBattle) this.escapeMonsterZone();

    this.playerShadow = addGroundShadow(this, this.player);
    this.companionFollower = new CompanionSprite(this, this.player.x, this.player.y);

    this.weaponOverlay = this.add.sprite(this.player.x, this.player.y, "equip-sword").setDepth(11).setVisible(false);
    this.shieldOverlay = this.add.sprite(this.player.x, this.player.y, "equip-shield").setDepth(11).setVisible(false);

    createWalkAnimations(this);

    this.dust = this.add.particles(0, 0, "dust", {
      speed: { min: 16, max: 44 },
      lifespan: { min: 180, max: 320 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.45, end: 0 },
      frequency: 70,
      emitting: false,
    });
    this.dust.startFollow(this.player, 0, 28);

    this.fireflies = this.add.particles(0, 0, "firefly", {
      speed: { min: 12, max: 40 },
      lifespan: { min: 2500, max: 4500 },
      scale: { start: 1, end: 0.4 },
      alpha: { start: 0.7, end: 0 },
      frequency: 700,
      emitting: false,
    });
    // fireflies are lights, not motes: ADD makes them actually glow once the
    // night overlay darkens the ground under them
    this.fireflies.setBlendMode(Phaser.BlendModes.ADD);
    this.fireflies.startFollow(this.player, 0, 0);

    this.spawnMonsters();

    this.physics.add.overlap(this.player, this.roamerGroup, (_p, roamer) => {
      if (this.encounterCooldown > 0) return;
      if (this.uiBlocking()) return;
      // the monster zones are cramped enough that a slime can overlap the
      // player at the same moment as the troll; always let the rare one win
      // the tie instead of whichever roamer the physics engine happened to
      // report first
      const troll = this.roamers.find((r) => r.kind === "troll");
      const golden = this.roamers.find((r) => r.kind === "goldSlime");
      const r =
        troll && this.physics.overlap(this.player, troll.sprite)
          ? troll
          : golden && this.physics.overlap(this.player, golden.sprite)
            ? golden
            : this.roamers.find((r) => r.sprite === roamer);
      // BattleScene.runBattle() already plays the boss fanfare for boss/giant
      // enemies; playing it here too would sound it twice.
      this.startBattle(r?.kind ?? "slime");
    });

    const cave = this.add.zone(CAVE_POS.x, CAVE_POS.y, TILE, TILE).setDepth(1);
    this.physics.add.existing(cave);
    this.physics.add.overlap(this.player, cave, () => {
      if (this.enteringDungeon || this.encounterCooldown > 0) return;
      if (this.uiBlocking()) return;
      this.enterDungeon();
    });

    const forest = this.add.zone(FOREST_POS.x, FOREST_POS.y, TILE, TILE).setDepth(1);
    this.physics.add.existing(forest);
    this.physics.add.overlap(this.player, forest, () => {
      if (this.enteringForest || this.enteringDungeon || this.encounterCooldown > 0) return;
      if (this.uiBlocking()) return;
      // overlap fires every frame while the body stays in the zone, so only
      // act on the entry edge and reset on exit (see updateForestGate)
      if (this.forestOverlapActive) return;
      this.forestOverlapActive = true;
      if (!GameState.quest.bossDefeated) {
        this.dialogue.start(["The forest is sealed.", "Defeat the KING SLIME", "first!"], "GUARD");
        return;
      }
      this.enterForest();
    });

    const snowPass = this.add.zone(SNOW_POS.x, SNOW_POS.y, TILE, TILE).setDepth(1);
    this.physics.add.existing(snowPass);
    this.physics.add.overlap(this.player, snowPass, () => {
      if (this.enteringSnow || this.enteringDungeon || this.enteringForest || this.encounterCooldown > 0) return;
      if (this.uiBlocking()) return;
      // overlap fires every frame while the body stays in the zone, so only
      // act on the entry edge and reset on exit (see updateSnowGate)
      if (this.snowOverlapActive) return;
      this.snowOverlapActive = true;
      // post-game gate: the pass only thaws once the forest boss falls
      if (!GameState.quest.forestBoss) {
        this.dialogue.start(["The northern pass is", "choked with eternal", "snow...", "Something ancient stirs", "beyond the ice."]);
        return;
      }
      this.enterSnow();
    });

    startWaterAnimation(this, this.layers.terrain);

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);

    const kb = this.input.keyboard!;
    this.keyLeft = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keyRight = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keyUp = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyDown = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.keyH = kb.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    this.keyJ = kb.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.keyK = kb.addKey(Phaser.Input.Keyboard.KeyCodes.K);
    this.keyL = kb.addKey(Phaser.Input.Keyboard.KeyCodes.L);
    // ignore e.repeat on keys the title screen also uses (Z/SPACE/C): holding
    // one through the scene switch delivers repeat keydowns to the fresh Keys
    // here, instantly triggering talk/rest or the bestiary on entry
    this.keyZ = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.keyZ.on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (!e.repeat) this.zQueued = true;
    });
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keySpace.on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (!e.repeat) this.zQueued = true;
    });
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyS.on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (e.ctrlKey) this.ctrlSQueued = true;
      else this.sQueued = true;
    });
    this.keyI = kb.addKey(Phaser.Input.Keyboard.KeyCodes.I);
    this.keyI.on(Phaser.Input.Keyboard.Events.DOWN, () => {
      this.iQueued = true;
    });
    this.keyG = kb.addKey(Phaser.Input.Keyboard.KeyCodes.G);
    this.keyG.on(Phaser.Input.Keyboard.Events.DOWN, () => {
      if (this.keyG.ctrlKey) this.gCheatQueued = true;
    });
    this.keyM = kb.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.keyM.on(Phaser.Input.Keyboard.Events.DOWN, () => {
      this.mQueued = true;
    });
    this.keyT = kb.addKey(Phaser.Input.Keyboard.KeyCodes.T);
    this.keyT.on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (!e.repeat) this.tQueued = true;
    });
    this.keyB = kb.addKey(Phaser.Input.Keyboard.KeyCodes.B);
    this.keyB.on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (!e.repeat) this.bQueued = true;
    });
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyA.on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (!e.repeat) this.aQueued = true;
    });
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.Q).on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (!e.repeat) this.qQueued = true;
    });
    this.keyY = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Y);
    this.keyY.on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (!e.repeat) this.yQueued = true;
    });
    this.keyN = kb.addKey(Phaser.Input.Keyboard.KeyCodes.N);
    this.keyN.on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (!e.repeat) this.nQueued = true;
    });
    this.keyO = kb.addKey(Phaser.Input.Keyboard.KeyCodes.O);
    this.keyO.on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (!e.repeat) this.oQueued = true;
    });
    // dev tool: paint tiles and drag landmarks around, then export the result.
    // On a Mac this needs "F1, F2 as standard function keys" (or fn+F2); the
    // ?edit URL below opens the editor without any key at all.
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.F2).on(
      Phaser.Input.Keyboard.Events.DOWN,
      (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
        if (!e.repeat) this.editorQueued = true;
      },
    );
    this.keyEsc = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyEsc.on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (this.quitConfirm && !e.repeat) this.escQueued = true;
    });

    this.dialogue = new DialogueBox(this, []);
    this.shop = new ShopUI(this);
    this.inventory = new InventoryUI(this);
    this.bestiary = new BestiaryUI(this);
    this.rankBoard = new RankingUI(this);
    this.fishing = new FishingUI(this);
    this.farm = new FarmUI(this);
    this.mapEditor = new MapEditor(this, this.layers, level, (name, x, y) => this.moveLandmark(name, x, y));
    // ?edit in the URL opens the editor without a keypress — a way in that
    // survives whatever swallows the hotkey (a Mac's F-keys, an IME holding
    // keydown, a stale tab from an older bundle)
    if (new URLSearchParams(window.location.search).has("edit")) this.editorQueued = true;
    this.luckyWheel = new LuckyWheel(this);
    this.achievementsUI = new AchievementsUI(this);
    this.settingsUI = new SettingsUI(this);

    const help = addHelpPopup(this, [
      ["HJKL", "MOVE"],
      ["Z", "TALK/OK"],
      ["I", "ITEMS"],
      ["B", "BESTIARY"],
      ["A", "ACHIEVE"],
      ["O", "SETTINGS"],
      ["T", "MAP"],
      ["S", "HUD"],
      ["M", "MUTE"],
      ["ESC", "SKIP"],
      ["F2", "MAP EDIT"],
      ["CTRL+S", "SAVE"],
      ["Q", "QUIT"],
      ["?", "HELP"],
    ]);

    // key landmarks in world px, drawn as colored dots over the tile map
    this.minimap = new Minimap(this, level, this.player, [
      { x: HOUSE_POS.x + TILE, y: HOUSE_POS.y + TILE, color: 0xffd166 },
      { x: SHOP_POS.x, y: SHOP_POS.y, color: 0xfde047 },
      { x: NPC_POS.x, y: NPC_POS.y, color: 0x8ecbff },
      { x: CAVE_POS.x, y: CAVE_POS.y, color: 0xff5555 },
      { x: RANK_BOARD_POS.x, y: RANK_BOARD_POS.y, color: 0xc084fc },
      { x: BOUNTY_BOARD_POS.x, y: BOUNTY_BOARD_POS.y, color: 0xfacc15 },
      { x: GAMBLER_POS.x, y: GAMBLER_POS.y, color: 0xf472b6 },
      { x: FOREST_POS.x, y: FOREST_POS.y, color: 0x4ade80 },
      { x: SNOW_POS.x, y: SNOW_POS.y, color: 0xa5f3fc },
      { x: FISH_POS.x, y: FISH_POS.y, color: 0x38bdf8 },
      { x: FARM_POS.x, y: FARM_POS.y, color: 0xa3e635 },
    ]);

    // open ground: no ambient shade, full night range
    this.night = new NightOverlay(this);

    this.hud = new StatusHud(this);

    // An edited map silently outranks the code, which reads as "my changes
    // didn't deploy" — say so on screen instead, and say how to undo it.
    if (hasMapOverride()) {
      this.add
        // top right, under the HUD: the top left is where the HOME bubble
        // opens and the bottom corners are the minimap and the key hints
        .text(GAME_WIDTH - 12, STATUS_HUD_HEIGHT + 10, "MAP EDITED - F2 THEN R TO RESTORE", retroStyle(4, "#ffd166"))
        .setOrigin(1, 0)
        .setScrollFactor(0)
        .setDepth(120);
    }

    if (isTouchDevice()) this.touch = new TouchControls(this);

    this.quitConfirmText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "", retroStyle(8, "#ff5555"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(300)
      .setVisible(false);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      GameState.pos = { x: this.player.x, y: this.player.y };
      GameState.save();
      this.dialogue.destroy();
      this.shop.destroy();
      this.inventory.destroy();
      this.bestiary.destroy();
      this.rankBoard.destroy();
      this.fishing.destroy();
      this.farm.destroy();
      this.mapEditor.destroy();
      this.luckyWheel.destroy();
      this.achievementsUI.destroy();
      this.settingsUI.destroy();
      this.minimap.destroy();
      this.night.destroy();
      this.companionFollower.destroy();
      help.destroy();
      this.quitConfirmText.destroy();
      this.touch?.destroy();
    });
  }

  // One place decides how an exit to another map is drawn, so the three
  // openings can't drift apart again (they had three different offsets, two
  // colours, and the CAVE's name sat below its entrance instead of above).
  // The marker traces the TILE x TILE overlap zone that fires the transition,
  // so what the player sees is exactly what they have to step on. Depth 9.5
  // keeps it over the CAVE's entrance art but under the hero and NPCs (10).
  // The x clamp keeps a long name on the map when the opening hugs an edge.
  // A name tag above its marker hides under the status HUD when the marker is
  // near the top of the map: the camera clamps there, so it can never scroll
  // clear. Flip the tag below the marker in that band instead.
  private labelY(y: number, offset: number): number {
    return y - offset < STATUS_HUD_HEIGHT + 20 ? y + offset : y - offset;
  }

  private track<T extends { x: number; y: number }>(landmark: string, obj: T): T {
    const pos = EDITABLE_POS[landmark];
    this.landmarkParts.push({ name: landmark, obj, dx: obj.x - pos.x, dy: obj.y - pos.y });
    return obj;
  }

  // called by the map editor: move the landmark, everything drawn from it, and
  // the patch of ground it owns (the house block, the pond, the tilled field)
  moveLandmark(landmark: string, x: number, y: number): void {
    const pos = EDITABLE_POS[landmark];
    const footprint = LANDMARK_TILES[landmark];
    if (footprint) this.paintFootprint(footprint, pos, T_GRASS);
    pos.x = x;
    pos.y = y;
    if (footprint) this.paintFootprint(footprint, pos, footprint.tile);
    for (const part of this.landmarkParts) {
      if (part.name !== landmark) continue;
      part.obj.x = x + part.dx;
      part.obj.y = y + part.dy;
    }
  }

  private paintFootprint(footprint: { cells: Array<[number, number]> }, pos: { x: number; y: number }, tile: number): void {
    const ox = Math.floor(pos.x / TILE);
    const oy = Math.floor(pos.y / TILE);
    for (const [dx, dy] of footprint.cells) {
      const tx = ox + dx;
      const ty = oy + dy;
      if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) continue;
      this.level[ty][tx] = tile;
      paintTile(this.layers, tx, ty, tile);
    }
  }

  // sprite + shadow + name tag, the shape every town NPC shares
  private addNpc(landmark: string, pos: { x: number; y: number }, label: string, tint: number, labelColor?: string): void {
    this.track(landmark, this.add.sprite(pos.x, pos.y, "npc").setDepth(10).setTint(tint));
    this.track(landmark, addGroundShadow(this, pos));
    this.track(
      landmark,
      this.add
        .text(pos.x, this.labelY(pos.y, 48), label, retroStyle(5, labelColor ?? `#${tint.toString(16).padStart(6, "0")}`))
        .setOrigin(0.5)
        .setDepth(11),
    );
  }

  // signpost + name tag, the shape every interactive spot shares
  private addSign(landmark: string, pos: { x: number; y: number }, label: string, color: string): void {
    this.track(landmark, this.add.image(pos.x, pos.y, "sign").setDepth(9));
    this.track(landmark, this.add.text(pos.x, this.labelY(pos.y, 48), label, retroStyle(5, color)).setOrigin(0.5).setDepth(11));
  }

  private addMapExit(landmark: string, pos: { x: number; y: number }, name: string, artClearance = 0): void {
    const marker = this.track(
      landmark,
      this.add.rectangle(pos.x, pos.y, TILE, TILE, EXIT_AREA_COLOR, 0.25).setStrokeStyle(2, EXIT_AREA_COLOR, 0.9).setDepth(9.5),
    );
    this.tweens.add({ targets: marker, alpha: 0.45, duration: 900, yoyo: true, repeat: -1, ease: "sine.inout" });
    const halfWidth = (name.length * 6 * PIXEL) / 2;
    const label = this.add
      .text(
        Phaser.Math.Clamp(pos.x, halfWidth, MAP_W * TILE - halfWidth),
        this.labelY(pos.y, TILE / 2 + artClearance + EXIT_LABEL_GAP),
        name,
        retroStyle(6, EXIT_LABEL_COLOR),
      )
      .setOrigin(0.5)
      .setDepth(11);
    this.track(landmark, label);
  }

  private buildHomeBubble(): Phaser.GameObjects.Container {
    const lines = ["HOME", "Z: REST - FULL HP/MP", "SLEEP UNTIL MORNING"];
    const text = this.add.text(0, 0, lines.join("\n"), retroStyle(5, "#f5f5f5")).setOrigin(0.5).setAlign("center").setLineSpacing(4);
    const pad = 20;
    const w = text.width + pad * 2;
    const h = text.height + pad * 2;
    const border = this.add.rectangle(0, 0, w + 8, h + 8, 0xffffff).setOrigin(0.5);
    const box = this.add.rectangle(0, 0, w, h, 0x0b0b2b).setOrigin(0.5);
    const tail = this.add
      .triangle(0, h / 2 + 4, -24, 0, 24, 0, 0, 28, 0x0b0b2b)
      .setStrokeStyle(2, 0xffffff)
      .setOrigin(0.5);
    // the camera never scrolls past the map edge, so clamping the bubble to
    // the map keeps it fully on screen even for a house in the far corner
    const x = Phaser.Math.Clamp(HOUSE_POS.x + TILE, w / 2 + 8, MAP_W * TILE - w / 2 - 8);
    const y = Phaser.Math.Clamp(HOUSE_POS.y + TILE - h / 2 - 32, STATUS_HUD_HEIGHT + h / 2, MAP_H * TILE - h / 2 - 8);
    return this.add.container(x, y, [border, box, text, tail]).setDepth(12);
  }

  private nearHouse(): boolean {
    const dx = this.player.x - (HOUSE_POS.x + TILE);
    const dy = this.player.y - (HOUSE_POS.y + 2 * TILE);
    return dx * dx + dy * dy <= 144 * 144;
  }

  private updateHomeBubble(): void {
    const near = this.nearHouse();
    if (near === this.bubbleVisible) return;
    this.bubbleVisible = near;
    this.homeBubble.setVisible(near);
    this.homeLabel.setVisible(!near);
    if (near) {
      this.tweens.killTweensOf(this.homeBubble);
      this.homeBubble.setAlpha(0);
      this.tweens.add({
        targets: this.homeBubble,
        alpha: 1,
        duration: 160,
      });
    }
  }

  private enterDungeon(): void {
    if (this.enteringDungeon) return;
    this.enteringDungeon = true;
    Sfx.night();
    this.player.setVelocity(0, 0);
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("Dungeon");
    });
  }

  private enterForest(): void {
    if (this.enteringForest) return;
    this.enteringForest = true;
    Sfx.night();
    this.player.setVelocity(0, 0);
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("Forest");
    });
  }

  private enterSnow(): void {
    if (this.enteringSnow) return;
    this.enteringSnow = true;
    Sfx.night();
    this.player.setVelocity(0, 0);
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("Snow");
    });
  }

  // resets forestOverlapActive once the player is a full tile clear of the
  // entrance, so stepping back in re-triggers the forest zone
  private updateForestGate(): void {
    if (!this.forestOverlapActive) return;
    if (Math.abs(this.player.x - FOREST_POS.x) > TILE || Math.abs(this.player.y - FOREST_POS.y) > TILE) {
      this.forestOverlapActive = false;
    }
  }

  // Growth is shown on the field itself: a sprout first, then the ripe plant
  // tinted green until it can be harvested. Cheap enough to redo every frame —
  // four sprites, and Phaser skips a setTexture to the texture already set.
  private updateCrops(): void {
    for (let i = 0; i < FARM_PLOTS; i++) {
      const plot = GameState.farm[i];
      const sprite = this.cropSprites[i];
      if (!plot) {
        sprite.setVisible(false);
        continue;
      }
      const grown = (GameState.minutes - plot.plantedAt) / CROPS[plot.crop].grow;
      sprite.setVisible(true);
      if (grown < 0.4) {
        sprite.setTexture("crop-sprout").setScale(0.7).clearTint();
      } else if (grown < 1) {
        sprite.setTexture(`crop-${plot.crop}`).setScale(0.85).setTint(0x86efac);
      } else {
        sprite.setTexture(`crop-${plot.crop}`).setScale(1).clearTint();
      }
    }
  }

  // same fix as updateForestGate, for the snow pass's sealed-entrance dialogue
  private updateSnowGate(): void {
    if (!this.snowOverlapActive) return;
    if (Math.abs(this.player.x - SNOW_POS.x) > TILE || Math.abs(this.player.y - SNOW_POS.y) > TILE) {
      this.snowOverlapActive = false;
    }
  }

  // true while a modal panel owns input — every place that checks this must
  // use this method instead of listing the panels itself, or a newly added
  // panel silently stops blocking (this happened once already: overlap
  // callbacks kept a stale copy of this check and missed BestiaryUI).
  private uiBlocking(): boolean {
    return (
      this.dialogue.isActive() ||
      this.shop.isActive() ||
      this.inventory.isActive() ||
      this.bestiary.isActive() ||
      this.rankBoard.isActive() ||
      this.fishing.isActive() ||
      this.farm.isActive() ||
      this.mapEditor.isActive() ||
      this.luckyWheel.isActive() ||
      this.achievementsUI.isActive() ||
      this.settingsUI.isActive()
    );
  }

  update(_time: number, delta: number): void {
    GameState.minutes += (delta / 1000) * GameState.timeSpeed;

    const night = isNight();
    if (night !== this.wasNight) {
      this.wasNight = night;
      if (night) this.spawnNightWisp(true);
      else this.removeNightWisp();
    }
    this.updateStatus();
    this.updateDayNight();
    this.updateHomeBubble();
    this.updateForestGate();
    this.updateSnowGate();
    this.updateCrops();
    if (this.editorQueued) {
      this.editorQueued = false;
      this.mapEditor.toggle();
    }
    this.minimap.update();

    if (this.gCheatQueued) {
      this.gCheatQueued = false;
      const gained = GameState.gainGold(100);
      GameState.save();
      this.flashNote(`+${gained}G (CHEAT)`);
    }

    this.achievementCheckAccum += delta;
    if (this.achievementCheckAccum >= 1000) {
      this.achievementCheckAccum = 0;
      const earned = claimAchievements();
      if (earned.length > 0) {
        this.suppressSavedToast = true;
        GameState.save();
        this.suppressSavedToast = false;
      }
      // showToast reuses one Text per scene, so several achievements earned in
      // the same tick (e.g. an 8-hit combo that also fells a boss) would
      // otherwise clobber each other with only the last one ever visible —
      // batch every name earned this tick into a single toast instead.
      const names = earned.map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.name).filter((n): n is string => !!n);
      if (names.length > 0) {
        showToast(this, names.length === 1 ? `ACHIEVEMENT: ${names[0]}!` : `ACHIEVEMENTS: ${names.join(", ")}!`);
      }
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
      showToast(this, muted ? "SOUND: OFF" : "SOUND: ON", STATUS_HUD_TOAST_Y);
    }

    if (this.qQueued) {
      this.qQueued = false;
      if (!this.uiBlocking() && !this.enteringDungeon) {
        this.quitConfirm = true;
        this.quitConfirmText.setText("QUIT TO TITLE? Y/N").setVisible(true);
        Sfx.error();
      }
    }

    if (this.quitConfirm) {
      if (this.quitting) return;
      this.player.setVelocity(0, 0);
      this.player.anims.stop();
      this.dust.emitting = false;
      this.zQueued =
        this.ctrlSQueued =
        this.iQueued =
        this.gCheatQueued =
        this.mQueued =
        this.bQueued =
        this.tQueued =
        this.aQueued =
        this.oQueued =
          false;
      if (this.yQueued) {
        this.yQueued = false;
        // Save here rather than leaning on the SHUTDOWN handler: that one runs
        // after the toast subscription is torn down, so the player never sees
        // the confirmation. The SHUTDOWN save then just repeats this one.
        this.quitting = true;
        // the quit prompt itself reports the save, so drop the toast that
        // GameState.save() would otherwise stack on top of it
        this.unsubSaved();
        // same pos the SHUTDOWN handler would record, so what SAVED reports is
        // already the complete state
        GameState.pos = { x: this.player.x, y: this.player.y };
        GameState.save();
        this.quitConfirmText.setText("SAVED").setColor("#4ade80");
        this.time.delayedCall(QUIT_SAVE_DELAY, () => this.scene.start("Title"));
        return;
      }
      if (this.nQueued || this.escQueued) {
        this.nQueued = false;
        this.escQueued = false;
        this.quitConfirm = false;
        this.quitConfirmText.setVisible(false);
      }
      return;
    }

    if (this.tQueued) {
      this.tQueued = false;
      if (!this.uiBlocking()) this.minimap.toggle();
    }

    if (this.uiBlocking()) {
      this.zQueued = false;
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
      if (this.oQueued) {
        this.oQueued = false;
        if (this.settingsUI.isActive()) this.settingsUI.close();
      }
      this.player.setVelocity(0, 0);
      this.player.anims.stop();
      this.dust.emitting = false;
      this.dialogue.update();
      this.shop.update();
      this.inventory.update();
      this.bestiary.update();
      this.rankBoard.update();
      this.fishing.update();
      this.farm.update();
      this.mapEditor.update();
      this.luckyWheel.update();
      this.achievementsUI.update();
      this.settingsUI.update();
      this.updateRoamers(delta);
      return;
    }

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

    if (this.oQueued) {
      this.oQueued = false;
      this.settingsUI.open();
      return;
    }

    if (this.zQueued) {
      this.zQueued = false;
      if (this.tryTalk()) return;
    }

    let vx = 0;
    let vy = 0;
    if (this.keyLeft.isDown || this.keyH.isDown) vx = -240;
    else if (this.keyRight.isDown || this.keyL.isDown) vx = 240;
    if (this.keyUp.isDown || this.keyK.isDown) vy = -240;
    else if (this.keyDown.isDown || this.keyJ.isDown) vy = 240;

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
    this.dust.emitting = moving;
    this.updateEquipOverlays();
    this.updateRoamers(delta);
    this.checkEncounter(delta);
  }

  private flashNote(text: string): void {
    const n = this.add
      .text(this.player.x, this.player.y - 52, text, retroStyle(6, "#ffd166"))
      .setOrigin(0.5)
      .setDepth(120);
    this.tweens.add({
      targets: n,
      y: n.y - 40,
      alpha: 0,
      duration: 900,
      onComplete: () => n.destroy(),
    });
  }

  private updateEquipOverlays(): void {
    this.weaponOverlay.setVisible(!!GameState.equipped.weapon);
    this.shieldOverlay.setVisible(!!GameState.equipped.armor);
    this.weaponOverlay.setTexture(GameState.weaponTexture());
    this.shieldOverlay.setTexture(GameState.armorTexture());
    const flip = this.lastMove === "left";
    this.weaponOverlay.setFlipX(flip);
    this.shieldOverlay.setFlipX(flip);
    this.weaponOverlay.setPosition(this.player.x + 14, this.player.y + 4);
    this.shieldOverlay.setPosition(this.player.x - 14, this.player.y + 8);
  }

  private toggleStatus(): void {
    const visible = !this.hud.isVisible();
    this.hud.setVisible(visible);
    GameState.hudVisible = visible;
    GameState.saveSettings();
  }

  private updateDayNight(): void {
    const factor = this.night.update();
    this.fireflies.emitting = factor > 0.05;
    this.fireflies.setAlpha(factor);
  }

  private updateStatus(): void {
    this.hud.update();
  }

  // NPCs on the main road sit 3 tiles (192px) apart, closer than 2x the 120px
  // talk radius (240px) — their radii overlap in a ~24px band. Picking the
  // nearest candidate (instead of the first one whose radius contains the
  // player) makes standing in that band resolve to whichever NPC is actually
  // closest, not whichever happens to be checked first.
  private tryTalk(): boolean {
    const dist2 = (x: number, y: number): number => {
      const dx = this.player.x - x;
      const dy = this.player.y - y;
      return dx * dx + dy * dy;
    };
    const candidates: Array<{ x: number; y: number; run: () => void }> = [
      { x: NPC_POS.x, y: NPC_POS.y, run: () => this.startElderDialogue() },
      {
        x: SHOP_POS.x,
        y: SHOP_POS.y,
        run: () => {
          Sfx.buy();
          this.shop.open();
        },
      },
      {
        x: this.guardPos.x,
        y: this.guardPos.y,
        run: () => {
          const q = GameState.quest;
          this.dialogue.start(
            q.bossDefeated
              ? ["The path to the forest", "is open. Be wary of", "the MOSS GOLEM!"]
              : ["The forest is sealed.", "Defeat the KING SLIME", "first!"],
            "GUARD",
          );
        },
      },
      { x: HUNTER_POS.x, y: HUNTER_POS.y, run: () => this.startHunterDialogue() },
      { x: HOUSE_POS.x + TILE, y: HOUSE_POS.y + 2 * TILE, run: () => this.rest() },
      {
        x: RANK_BOARD_POS.x,
        y: RANK_BOARD_POS.y,
        run: () => {
          Sfx.buy();
          this.rankBoard.open();
        },
      },
      { x: BOUNTY_BOARD_POS.x, y: BOUNTY_BOARD_POS.y, run: () => this.startBountyDialogue() },
      {
        x: FISH_POS.x,
        y: FISH_POS.y,
        run: () => {
          Sfx.buy();
          this.fishing.open();
        },
      },
      {
        x: FARM_POS.x,
        y: FARM_POS.y,
        run: () => {
          Sfx.buy();
          this.farm.open();
        },
      },
      {
        x: GAMBLER_POS.x,
        y: GAMBLER_POS.y,
        run: () => {
          Sfx.buy();
          this.luckyWheel.open();
        },
      },
    ];
    const RADIUS2 = 120 * 120;
    let best: { d: number; run: () => void } | null = null;
    for (const c of candidates) {
      const d = dist2(c.x, c.y);
      if (d <= RADIUS2 && (!best || d < best.d)) best = { d, run: c.run };
    }
    if (!best) return false;
    best.run();
    return true;
  }

  private rest(): void {
    if (this.resting) return;
    this.resting = true;
    this.player.setVelocity(0, 0);
    Sfx.night();
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      GameState.player.hp = GameState.effMaxHp();
      GameState.player.mp = GameState.player.maxMp;
      GameState.minutes = (Math.floor(GameState.minutes / 1440) + 1) * 1440 + 360;
      GameState.save();
      this.hud.forceRefresh();
      this.cameras.main.fadeIn(400, 0, 0, 0);
      this.resting = false;
      const note = this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "RESTED! HP/MP FULL", retroStyle(8, "#ffd166"))
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(120);
      this.tweens.add({
        targets: note,
        y: GAME_HEIGHT / 2 - 60,
        alpha: 0,
        delay: 800,
        duration: 600,
        onComplete: () => note.destroy(),
      });
    });
  }

  private startElderDialogue(): void {
    const q = GameState.quest;
    if (!q.slimeReward && q.slimes >= 5) {
      q.slimeReward = true;
      const gained = GameState.gainGold(30);
      Sfx.buy();
      this.dialogue.start(["Well done, hero!", "You hunted 5 slimes.", `Take these ${gained} gold!`], "ELDER");
      return;
    }
    if (!q.bossDefeated) {
      this.dialogue.start(
        ["Welcome back!", "Slimes lurk in the grass.", "Hunt 5 slimes first.", "Then face the KING SLIME", "in the cave up north!"],
        "ELDER",
      );
      return;
    }
    if (!q.finalReward) {
      q.finalReward = true;
      const gained = GameState.gainGold(100);
      Sfx.buy();
      this.dialogue.start(["You are our hero!", "The KING SLIME is gone.", `Take this ${gained} gold!`], "ELDER");
      return;
    }
    if (!q.forestBoss) {
      this.dialogue.start(["The eastern woods hold", "a deeper threat now.", "The GUARD by the woods", "knows more."], "ELDER");
      return;
    }
    if (!q.forestReward) {
      q.forestReward = true;
      const gained = GameState.gainGold(200);
      GameState.inventory.mythrilSword += 1;
      Sfx.buy();
      this.dialogue.start(["The forest is at peace!", `Take this ${gained} gold and`, "a MYTHRIL SWORD!"], "ELDER");
      return;
    }
    if (!q.snowReward && q.snowBoss) {
      q.snowReward = true;
      const gained = GameState.gainGold(300);
      GameState.inventory.elixir += 2;
      Sfx.buy();
      this.dialogue.start(
        ["The GLACIER GOLEM...", "fallen? You are the", "truest hero this realm", "has ever known.", `${gained} gold and 2 ELIXIRS!`],
        "ELDER",
      );
      return;
    }
    if (!q.bestiaryReward && allSpeciesCaught(GameState.caught)) {
      q.bestiaryReward = true;
      const gained = GameState.gainGold(500);
      GameState.inventory.elixir += 3;
      GameState.inventory.mythrilShield += 1;
      Sfx.buy();
      this.dialogue.start(
        ["You caught every beast", "in the realm! A feat no", "hero has matched.", `${gained} gold, 3 ELIXIRS and`, "a MYTHRIL SHIELD!"],
        "ELDER",
      );
      return;
    }
    if (!q.bestiaryReward) {
      const caught = CATCHABLE.filter((e) => GameState.caught.includes(e.name)).length;
      this.dialogue.start(
        ["The forest is at peace.", `You have caught ${caught} of`, `${CATCHABLE.length} beasts. Catch them`, "all and I will reward you!"],
        "ELDER",
      );
      return;
    }
    this.dialogue.start(["The realm owes you", "everything, hero."], "ELDER");
  }

  private startHunterDialogue(): void {
    const q = GameState.quest;
    if (!q.hunterBatsAccepted) {
      q.hunterBatsAccepted = true;
      this.dialogue.start(["Psst, hero! BATS nest", "in the northern cave.", "Slay 4 of them and", "I will pay you well."], "HUNTER");
      return;
    }
    if (!q.hunterBatsReward) {
      if (q.batsSlain < 4) {
        this.dialogue.start([`You have felled ${q.batsSlain}`, "of 4 bats. The cave is", "north — keep going!"], "HUNTER");
        return;
      }
      q.hunterBatsReward = true;
      const gained = GameState.gainGold(40);
      GameState.inventory.potion += 2;
      Sfx.buy();
      this.dialogue.start(["4 bats down! Take", `${gained} gold and 2 POTIONS.`], "HUNTER");
      return;
    }
    if (!q.hunterCatchAccepted) {
      q.hunterCatchAccepted = true;
      q.caughtAtAccept = GameState.caught.length;
      this.dialogue.start(["Now a different job:", "catch any 3 beasts", "with CANDY. Fresh", "catches only!"], "HUNTER");
      return;
    }
    if (!q.hunterCatchReward) {
      const caught = Math.min(GameState.caught.length - q.caughtAtAccept, 3);
      if (caught < 3) {
        this.dialogue.start([`${caught} of 3 beasts caught.`, "Throw CANDY in battle", "to fill the order!"], "HUNTER");
        return;
      }
      q.hunterCatchReward = true;
      const gained = GameState.gainGold(80);
      GameState.inventory.ether += 2;
      Sfx.buy();
      this.dialogue.start(["A fine haul! Take", `${gained} gold and 2 ETHERS.`], "HUNTER");
      return;
    }
    if (!q.forestBoss) {
      this.dialogue.start(["The wilds are quieter", "thanks to you, hero."], "HUNTER");
      return;
    }
    if (!q.hunterYetiAccepted) {
      q.hunterYetiAccepted = true;
      this.dialogue.start(
        ["One more job, hero:", "YETIS roam the snow", "pass to the north.", "Slay 3 and I'll pay", "handsomely."],
        "HUNTER",
      );
      return;
    }
    if (!q.hunterYetiReward) {
      if (q.yetisSlain < 3) {
        this.dialogue.start([`${q.yetisSlain} of 3 yetis felled.`, "The pass is north", "of the village."], "HUNTER");
        return;
      }
      q.hunterYetiReward = true;
      const gained = GameState.gainGold(150);
      GameState.inventory.hiPotion += 2;
      Sfx.buy();
      this.dialogue.start(["3 yetis down! Take", `${gained} gold and 2`, "HI-POTIONS."], "HUNTER");
      return;
    }
    this.dialogue.start(["The wilds are quieter", "thanks to you, hero."], "HUNTER");
  }

  // rerolls once a new in-game day starts (or on first read), then either
  // shows progress, pays out a finished bounty once, or says it's already
  // been claimed — no streak/partial-credit tracking, same as every other
  // day-based gate in this game
  private startBountyDialogue(): void {
    GameState.rollBountyIfStale();
    const b = GameState.bounty;
    if (!b) return;
    if (b.claimed) {
      this.dialogue.start(["ALREADY CLAIMED TODAY.", "COME BACK TOMORROW."], "BOUNTY BOARD");
      return;
    }
    const progress = Math.min(b.have, b.need);
    if (progress < b.need) {
      this.dialogue.start([`TARGET: ${b.target}`, `PROGRESS: ${progress}/${b.need}`, `REWARD: ${b.reward} GOLD`], "BOUNTY BOARD");
      return;
    }
    const gained = GameState.gainGold(b.reward);
    // only latch claimed once gold actually landed — at the cap gainGold()
    // returns 0, same MAX_GOLD edge BattleScene's steal already guards
    if (gained > 0) b.claimed = true;
    Sfx.buy();
    GameState.save();
    this.dialogue.start(["BOUNTY COMPLETE!", `TAKE ${gained} GOLD.`], "BOUNTY BOARD");
  }

  private checkEncounter(delta: number): void {
    if (this.encounterCooldown > 0) {
      // A scene transition hands the first frame a delta as large as the whole
      // load (~1.2s), which drained the entry grace in a single tick and
      // dropped the player straight into a fight. Clamp it to one frame.
      this.encounterCooldown -= Math.min(delta, MAX_COOLDOWN_STEP);
      return;
    }
    // Off the logical grid, not the rendered index: the render layer paints a
    // variation frame (8..22) wherever a terrain has one, so an index compare
    // there only works while tall grass happens to have none — and it would
    // start silently returning early (encounters just stop) the day it gains
    // some. `level` only ever holds base indexes.
    const cell = this.level[Math.floor(this.player.y / TILE)]?.[Math.floor(this.player.x / TILE)];
    if (cell !== TALL_GRASS) return;
    const rate = ENCOUNTER_RATE * (isNight() ? NIGHT_ENCOUNTER_MULT : 1) * (delta / 1000);
    if (Math.random() < rate) {
      this.startBattle();
    }
  }

  private escapeMonsterZone(): void {
    const spot = escapeFromZones(MONSTER_ZONES, this.player.x, this.player.y, (tx, ty) => isWalkableCell(this.level, tx, ty));
    if (spot) this.player.setPosition(spot.x, spot.y);
  }

  private spawnMonsters(): void {
    this.roamerGroup = this.physics.add.group();
    for (const zone of MONSTER_ZONES) {
      const signX = zone.cx - zone.w / 2 - 32;
      this.add.image(signX, zone.cy, "sign").setDepth(9);
      const bang = this.add
        .text(signX, zone.cy - 64, "!", retroStyle(10, "#ffdd44"))
        .setOrigin(0.5)
        .setStroke("#7c2d12", 2)
        .setDepth(11);
      this.tweens.add({
        targets: bang,
        y: zone.cy - 84,
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      const kind: "slime" | "wolf" = zone.kind === "wolf" ? "wolf" : "slime";
      for (let i = 0; i < zone.count; i++) {
        const x = zone.cx + (Math.random() - 0.5) * zone.w * 0.6;
        const y = zone.cy + (Math.random() - 0.5) * zone.h * 0.6;
        const golden = kind === "slime" && Math.random() < GOLDEN_SLIME_CHANCE;
        const roamerKind: Roamer["kind"] = golden ? "goldSlime" : kind;
        const sprite = this.roamerGroup.create(x, y, kind) as Phaser.Physics.Arcade.Sprite;
        if (golden) sprite.setTint(0xffd700);
        sprite.setDepth(10);
        sprite.body?.setSize(40, 24).setOffset(12, 32);
        this.roamers.push({
          sprite,
          minX: zone.cx - zone.w / 2 + 8,
          maxX: zone.cx + zone.w / 2 - 8,
          minY: zone.cy - zone.h / 2 + 8,
          maxY: zone.cy + zone.h / 2 - 8,
          targetX: x,
          targetY: y,
          wait: 300 + Math.random() * 800,
          speed: 56 + Math.random() * 40,
          kind: roamerKind,
        });
        this.tweens.add({
          targets: sprite,
          scaleX: 1.12,
          scaleY: 0.88,
          duration: 280,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    }

    if (Math.random() < TROLL_KING_SPAWN_CHANCE) {
      const zone = MONSTER_ZONES[Math.floor(Math.random() * MONSTER_ZONES.length)];
      const x = zone.cx + (Math.random() - 0.5) * zone.w * 0.6;
      const y = zone.cy + (Math.random() - 0.5) * zone.h * 0.6;
      const sprite = this.roamerGroup.create(x, y, "troll") as Phaser.Physics.Arcade.Sprite;
      sprite.setDepth(10).setScale(1.6);
      sprite.body?.setSize(40, 24).setOffset(12, 32);
      this.roamers.push({
        sprite,
        minX: zone.cx - zone.w / 2 + 8,
        maxX: zone.cx + zone.w / 2 - 8,
        minY: zone.cy - zone.h / 2 + 8,
        maxY: zone.cy + zone.h / 2 - 8,
        targetX: x,
        targetY: y,
        wait: 300 + Math.random() * 800,
        speed: 44 + Math.random() * 24,
        kind: "troll",
      });
      this.tweens.add({
        targets: sprite,
        scaleX: 1.72,
        scaleY: 1.48,
        duration: 280,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    if (isNight()) this.spawnNightWisp();
  }

  // the NIGHT WISP is the overworld's night-exclusive jackpot: one roamer that
  // exists only while isNight(), withdrawn again at dawn
  private spawnNightWisp(toast = false): void {
    if (this.wispRoamer) return;
    const zone = MONSTER_ZONES[Math.floor(Math.random() * MONSTER_ZONES.length)];
    const x = zone.cx + (Math.random() - 0.5) * zone.w * 0.6;
    const y = zone.cy + (Math.random() - 0.5) * zone.h * 0.6;
    const sprite = this.roamerGroup.create(x, y, "wisp") as Phaser.Physics.Arcade.Sprite;
    sprite.setDepth(10);
    sprite.body?.setSize(40, 24).setOffset(12, 32);
    const roamer: Roamer = {
      sprite,
      minX: zone.cx - zone.w / 2 + 8,
      maxX: zone.cx + zone.w / 2 - 8,
      minY: zone.cy - zone.h / 2 + 8,
      maxY: zone.cy + zone.h / 2 - 8,
      targetX: x,
      targetY: y,
      wait: 300 + Math.random() * 800,
      speed: 56 + Math.random() * 40,
      kind: "wisp",
    };
    this.roamers.push(roamer);
    this.wispRoamer = roamer;
    this.tweens.add({
      targets: sprite,
      scaleX: 1.12,
      scaleY: 0.88,
      duration: 280,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    if (toast) showToast(this, "A NIGHT WISP EMERGES!");
  }

  private removeNightWisp(): void {
    const wisp = this.wispRoamer;
    if (!wisp) return;
    this.wispRoamer = undefined;
    const i = this.roamers.indexOf(wisp);
    if (i >= 0) this.roamers.splice(i, 1);
    this.tweens.killTweensOf(wisp.sprite);
    wisp.sprite.destroy();
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

  private startBattle(enemy?: "slime" | "goblin" | "troll" | "wolf" | "goldSlime" | "wisp"): void {
    if (this.encounterCooldown > 0) return; // already fading into a battle
    this.player.setVelocity(0, 0);
    this.encounterCooldown = ENCOUNTER_COOLDOWN;
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const roll = Math.random();
      const kind = enemy ?? (roll < 0.4 ? "slime" : roll < 0.75 ? "goblin" : "wolf");
      this.scene.start("Battle", { enemy: kind, from: "Town" });
    });
  }
}
