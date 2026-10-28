import Phaser from "phaser";
import { ACHIEVEMENTS, announceLooks, claimAchievements } from "../achievements";
import { ARENA_RECOVER_PCT, type ArenaRun, arenaLineup, arenaOpen } from "../arena";
import { OVERWORLD_THEME, Sfx } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { canDeliver, deliver, deliveryReward, materialName, rollDeliveryIfStale } from "../delivery";
import { eventToday } from "../events";
import { acceptFavor, completeFavor, favorProgress, favorStatus, favorStep, materialNameOf } from "../favors";
import { encounterOut } from "../fx";
import {
  cropProgress,
  type DeliveryState,
  econDay,
  FARM_PLOTS,
  FIRE_BEASTS,
  GameState,
  isNight,
  onSaved,
  type VillagerKey,
} from "../gameState";
import { BEDS_LEVEL, houseTexture } from "../home";
import {
  ARENA_POS,
  BLACKSMITH_POS,
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
  T_PATH,
  TALL_GRASS,
  TILE,
  VOLCANO_POS,
  WORKPLACE_LANDMARKS,
} from "../levels";
import { allSpeciesCaught, CATCHABLE } from "../monsters";
import { objectiveLine } from "../objective";
import { addGroundShadow, retroStyle, showToast } from "../pixelart";
import {
  addExitArrow,
  askQuitToTitle,
  boundCameraToMap,
  buildTileLayers,
  createWalkAnimations,
  isWalkableCell,
  OBJECT_LAYER_DEPTH,
  paintTile,
  saveAndQuit,
  startWaterAnimation,
  type TileLayers,
  whilePanelUp,
} from "../sceneCommon";
import { type Season, seasonLook, seasonNews, seasonToday } from "../season";
import { AchievementsUI } from "../ui/AchievementsUI";
import { addAmbient } from "../ui/Ambient";
import { BestiaryUI } from "../ui/BestiaryUI";
import { BlacksmithUI } from "../ui/Blacksmith";
import { CompanionSprite } from "../ui/CompanionSprite";
import { DialogueBox } from "../ui/DialogueBox";
import { FarmUI } from "../ui/Farm";
import { FishingUI } from "../ui/Fishing";
import { addFootsteps } from "../ui/Footsteps";
import { addGuideArrow } from "../ui/GuideArrow";
import { addHelpPopup, helpOpen } from "../ui/HelpPopup";
import { placeHeroGear } from "../ui/HeroGear";
import { HomeUI } from "../ui/HomeUI";
import { InventoryUI } from "../ui/InventoryUI";
import { KitchenUI } from "../ui/Kitchen";
import { LookPicker } from "../ui/LookPicker";
import { LuckyWheel } from "../ui/LuckyWheel";
import { MapEditor } from "../ui/MapEditor";
import { Minimap } from "../ui/Minimap";
import { NIGHT_ENCOUNTER_MULT, type NightLight, NightOverlay } from "../ui/NightOverlay";
import { QuestLog } from "../ui/QuestLog";
import { RankingUI } from "../ui/RankingUI";
import { SettingsUI } from "../ui/SettingsUI";
import { ShopUI } from "../ui/Shop";
import { STATUS_HUD_HEIGHT, STATUS_HUD_TOAST_Y, StatusHud } from "../ui/StatusHud";
import { isTouchDevice, TouchControls } from "../ui/TouchControls";
import { TreasureDigger } from "../ui/TreasureDig";
import { type Rect, Villagers } from "../ui/Villagers";
import { showUnlockTip } from "../unlockTips";
import { bakeHero, seasonSkin } from "./BootScene";

// The last day whose town event (events.ts) was announced. Module scope, so
// it outlives a Town restart — every battle and field trip ends in one, and
// the toast would otherwise repeat after each fight — but not a page load.
let announcedDay = -1;
// lets the arrival and rest-until-morning fades finish before it shows
const EVENT_TOAST_DELAY = 600;

const ENCOUNTER_RATE = 0.18;
const ENCOUNTER_COOLDOWN = 600;
const ENTRY_GRACE = 1200;
const MAX_COOLDOWN_STEP = 50;
const TROLL_KING_SPAWN_CHANCE = 0.35;
// the fade out to the town built again for a new season, a fight's length
const SEASON_FADE = 300;
// Exits to another map are marked in the world rather than with a box: FOREST,
// SNOW PASS and VOLCANO are roads running off the map's edge with a signpost
// beside them (addMapExit), the CAVE is its mouth art with the name over it.
const EXIT_LABEL_COLOR = "#9f9fd0";
// gap between the top of the cave art and its name
const EXIT_LABEL_GAP = 20;
// A person's name tag shows only as the hero comes close: full within
// NPC_TAG_NEAR, gone past NPC_TAG_FAR, by distance alone, so it never blinks.
// A town tagged end to end was noise. The places keep theirs up — signs,
// exits, HOME, and the SHOP and BLACKSMITH, which are where they stand.
const NPC_TAG_NEAR = 2.5 * TILE;
const NPC_TAG_FAR = 3.5 * TILE;
const ALWAYS_TAGGED = new Set(["SHOP", "BLACKSMITH"]);
// The southern meadow's dressing, as tiles: flower patches and stones in the
// open grass between the footpath, the groves and the slime meadows. Nothing
// collides with them, a spot the map editor has turned into something other
// than grass is skipped, and the flowers sleep under the winter snow.
const MEADOW_DECOR: ReadonlyArray<readonly ["flowers" | "stones", number, number]> = [
  ["flowers", 11, 15],
  ["flowers", 14, 15],
  ["flowers", 17, 16],
  ["flowers", 10, 19],
  ["flowers", 21, 14],
  ["flowers", 12, 13],
  ["flowers", 4, 14],
  ["stones", 18, 15],
  ["stones", 11, 17],
  ["stones", 16, 19],
  ["stones", 22, 13],
  ["stones", 2, 13],
];
const GOLDEN_SLIME_CHANCE = 0.08;
// The house art and its shadow, one step above the object layer so neither the
// transition overlay (1) nor the object layer (2) can paint over the building.
const HOUSE_DEPTH = OBJECT_LAYER_DEPTH + 1;
// Each keeper's workplace (BootScene draws them, levels.ts says where): its
// texture; its roofline, px down from the top of the 128px art (the apex,
// awning beam, palisade points or eaves, not a chimney or pennant poking
// above), where the keeper's tag sits; and its lamps at night as offsets from
// the building's centre -- the windows and lanterns in its art, and the
// forge's hearth with a slow flicker.
const WORKPLACES: Record<
  (typeof WORKPLACE_LANDMARKS)[number],
  { key: string; roof: number; lights: ReadonlyArray<{ dx: number; dy: number; radius: number; color?: number; pulseMs?: number }> }
> = {
  NPC_POS: {
    key: "hut-elder",
    roof: 8,
    lights: [
      { dx: 26, dy: 22, radius: 32 },
      { dx: 0, dy: -32, radius: 16 },
    ],
  },
  SHOP_POS: { key: "stall-shop", roof: 20, lights: [{ dx: -46, dy: -4, radius: 32 }] },
  BLACKSMITH_POS: { key: "forge", roof: 36, lights: [{ dx: 28, dy: 48, radius: 44, color: 0xff8a3d, pulseMs: 900 }] },
  ARENA_POS: { key: "gate-arena", roof: 24, lights: [{ dx: -2, dy: -2, radius: 32 }] },
  GAMBLER_POS: { key: "tent-gambler", roof: 12, lights: [{ dx: -30, dy: 35, radius: 32 }] },
  HUNTER_POS: { key: "lodge-hunter", roof: 32, lights: [{ dx: -10, dy: 24, radius: 32 }] },
};
// half a retroStyle(5) tag's height (5 x 4 x 1.3 = 26px) plus a 2px gap
const TAG_CLEAR = 15;

type LastMove = "down" | "up" | "right" | "left";

// One step from an exit back into the map, in tiles: away from the edge it
// sits on. The CAVE, on no edge, steps out south of its mouth.
const inwardOf = (pos: { x: number; y: number }): { dx: number; dy: number } => {
  const tx = Math.floor(pos.x / TILE);
  const ty = Math.floor(pos.y / TILE);
  if (tx === 0) return { dx: 1, dy: 0 };
  if (tx === MAP_W - 1) return { dx: -1, dy: 0 };
  if (ty === MAP_H - 1) return { dx: 0, dy: -1 };
  return { dx: 0, dy: 1 };
};
// where a hero coming back through an exit is set down: two tiles in, off
// the trigger
const stepIn = (pos: { x: number; y: number }): { x: number; y: number } => {
  const { dx, dy } = inwardOf(pos);
  return { x: pos.x + dx * TILE * 2, y: pos.y + dy * TILE * 2 };
};

// a display object's world-space box, in the shape Villagers takes
const rectOf = (obj: { getBounds(): Phaser.Geom.Rectangle }): Rect => {
  const b = obj.getBounds();
  return { x: b.x, y: b.y, w: b.width, h: b.height };
};

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
  private treasure!: TreasureDigger;
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
  private blacksmith!: BlacksmithUI;
  private kitchen!: KitchenUI;
  private home!: HomeUI;
  // the house as built so far (home.ts), and its winter snow cap
  private houseImage!: Phaser.GameObjects.Image;
  private houseSnow?: Phaser.GameObjects.Image;
  private cropSprites: Phaser.GameObjects.Sprite[] = [];
  private mapEditor!: MapEditor;
  // every object drawn relative to an editable landmark, with the offset it
  // was drawn at, so the map editor can move a landmark and its whole set of
  // sprites/labels together without waiting for a scene restart
  private landmarkParts: Array<{ name: string; obj: { x: number; y: number }; dx: number; dy: number }> = [];
  // world-space boxes of every fixed name tag (NPCs, signs, exits, HOME, zone
  // warnings), so the villagers can keep their own tags clear of them
  private fixedLabels: Rect[] = [];
  // the fixed NPCs' sprites, turned to face the hero who talks to them
  private npcSprites: Phaser.GameObjects.Sprite[] = [];
  // what the hero bumps into besides the tilemap: the SHOP's crate, the
  // anvil, the keepers' workplaces and the farm's fence (static bodies, see
  // addBlocker)
  private blockers: Phaser.GameObjects.Zone[] = [];
  // the workplaces' lamps, lit once the night overlay exists
  private workplaceLights: Array<{ landmark: string; light: NightLight }> = [];
  // the name tags that fade with the hero's distance (NPC_TAG_NEAR)
  private npcTags: Array<{ tag: Phaser.GameObjects.Text; sprite: Phaser.GameObjects.Sprite }> = [];
  private villagers!: Villagers;
  private level: number[][] = [];
  private editorQueued = false;
  private luckyWheel!: LuckyWheel;
  private achievementsUI!: AchievementsUI;
  private questLog!: QuestLog;
  private lookPicker!: LookPicker;
  private settingsUI!: SettingsUI;
  private roamerGroup!: Phaser.Physics.Arcade.Group;
  private roamers: Roamer[] = [];
  private wispRoamer?: Roamer;
  private wasNight = false;
  // a town-event toast is scheduled but not yet shown (see announceEvent)
  private eventToastPending = false;
  private encounterCooldown = 0;
  private lastMove: LastMove = "down";
  private night!: NightOverlay;
  private touch?: TouchControls;
  private homeLabel!: Phaser.GameObjects.Text;
  private homeBubble!: Phaser.GameObjects.Container;
  private homeBubbleText!: Phaser.GameObjects.Text;
  private bubbleVisible = false;
  private resting = false;
  private enteringDungeon = false;
  private enteringForest = false;
  private enteringSnow = false;
  private enteringVolcano = false;
  // true while overlapping the forest/snow/volcano zone; reset a full tile
  // away so the sealed-entrance dialogue doesn't restart every overlap frame
  private forestOverlapActive = false;
  private snowOverlapActive = false;
  private volcanoOverlapActive = false;
  private zQueued = false;
  private sQueued = false;
  private ctrlSQueued = false;
  private iQueued = false;
  private gCheatQueued = false;
  private mQueued = false;
  private tQueued = false;
  private cQueued = false;
  private bQueued = false;
  private aQueued = false;
  private oQueued = false;
  private qQueued = false;
  private uQueued = false;
  // claims achievements at most once per second; the checks read live
  // GameState, so battle/fishing/treasure mutations made while a modal or
  // another scene owns input are caught on the next tick after returning here
  private achievementCheckAccum = 0;
  private quitting = false;
  // the season the town was built in, and the fade out to building it again
  // once the clock moves it into another look (turnSeason)
  private season: Season = "spring";
  private turningSeason = false;
  private unsubSaved: () => void = () => {};
  // true while an achievement save is in flight; the onSaved "SAVED" toast is
  // skipped so it doesn't queue up behind the "ACHIEVEMENT: ...!" toast for
  // the same save (showToast shows one toast at a time per scene)
  private suppressSavedToast = false;

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
  private keyO!: Phaser.Input.Keyboard.Key;

  private hud!: StatusHud;
  private minimap!: Minimap;
  private guardPos = { x: 0, y: 0 };

  constructor() {
    super("Town");
  }

  create(data?: {
    fromDungeon?: boolean;
    fromBattle?: boolean;
    fromForest?: boolean;
    fromSnow?: boolean;
    fromVolcano?: boolean;
    mapOpen?: boolean;
    rested?: boolean;
  }): void {
    Sfx.playBgm(OVERWORLD_THEME);
    // the title bakes the save's look before it starts the town; this covers
    // any other way in (a no-op when that look is already baked)
    bakeHero(this, GameState.heroLook);
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
    this.enteringVolcano = false;
    this.forestOverlapActive = false;
    this.snowOverlapActive = false;
    this.volcanoOverlapActive = false;
    this.quitting = false;
    this.turningSeason = false;
    this.wispRoamer = undefined;
    this.landmarkParts = [];
    this.fixedLabels = [];
    this.npcSprites = [];
    this.npcTags = [];
    this.blockers = [];
    this.workplaceLights = [];
    this.wasNight = isNight();
    this.eventToastPending = false;

    // Registered before the SHUTDOWN handler below that calls GameState.save()
    // — SHUTDOWN listeners fire in registration order, so this unsubscribes
    // before that save happens and no toast gets created on a scene that's
    // already tearing down. Keep this the first SHUTDOWN listener.
    // Not over an open panel: a save made in one (a buy, an equip, a forge, a
    // companion picked) is already reported on the panel's own message line,
    // and this toast (y 100..124) landed on its top rows — the shop, the bag
    // and the forge hang from y 28 on touch screens, and their titles sit at
    // y 85..139 on a keyboard. The dialogue box (y 456..688) is clear of it,
    // so a save made while talking (a bounty paid, a favor taken) still shows.
    this.unsubSaved = onSaved(() => {
      if (this.suppressSavedToast || (this.uiBlocking() && !this.dialogue.isActive())) return;
      showToast(this, "SAVED", STATUS_HUD_TOAST_Y);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubSaved());

    const level = buildLevel();
    this.level = level;
    // the season's skin (BootScene's seasonSkin): green, autumn or snowed in
    this.season = seasonToday();
    this.layers = buildTileLayers(this, level, { skin: seasonSkin("town") });

    this.physics.world.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);

    // The building covers its own tiles, so it has to clear both the
    // transition overlay (depth 1) and the object layer (depth 2) — the map
    // editor can drop the house on the road, and the overlay is opaque. The
    // shadow shares the depth and is added first, so it stays under the house.
    this.track(
      "HOUSE_POS",
      addGroundShadow(this, { x: HOUSE_POS.x + TILE, y: HOUSE_POS.y + TILE }, { w: 118, h: 22, yOffset: 66, depth: HOUSE_DEPTH }),
    );
    this.houseImage = this.track(
      "HOUSE_POS",
      this.add
        .image(HOUSE_POS.x + TILE, HOUSE_POS.y + TILE, houseTexture(GameState.houseLevel))
        .setOrigin(0.5, 0.5)
        .setDepth(HOUSE_DEPTH),
    );
    // in the snow skin, snow on the roof, the chimney and the dormer
    if (seasonLook("town") === "winter") {
      this.houseSnow = this.track(
        "HOUSE_POS",
        this.add.image(HOUSE_POS.x + TILE, HOUSE_POS.y + TILE, `house-${GameState.houseLevel}-snow`).setDepth(HOUSE_DEPTH + 0.01),
      );
    }
    this.homeLabel = this.track(
      "HOUSE_POS",
      this.add
        .text(HOUSE_POS.x + TILE, HOUSE_POS.y + TILE - 80, "HOME", retroStyle(5, "#9f9fd0"))
        .setStroke("#1a1028", 4)
        .setOrigin(0.5)
        .setDepth(11),
    );
    this.fixedLabels.push(rectOf(this.homeLabel));
    this.homeBubble = this.track("HOUSE_POS", this.buildHomeBubble());
    // the bubble replaces the HOME tag up close, so it counts as one too
    this.fixedLabels.push(rectOf(this.homeBubble));
    this.homeBubble.setVisible(false);

    this.addNpc("NPC_POS", NPC_POS, "ELDER", 0xffffff, "#9f9fd0");
    this.addNpc("SHOP_POS", SHOP_POS, "SHOP", 0xffd166);
    // the keeper's produce, a tile east of him by the north-south road
    this.addProp("SHOP_POS", { x: SHOP_POS.x + TILE, y: SHOP_POS.y }, "produce-crate");

    this.track("CAVE_POS", addGroundShadow(this, CAVE_POS, { w: 104, h: 24, yOffset: 56 }));
    this.track("CAVE_POS", this.add.image(CAVE_POS.x, CAVE_POS.y, "cave").setDepth(9));
    // the cave mouth is 128px tall and centred on the entrance tile, so its
    // name clears the art (1.25 tiles: half the art plus half the tag);
    // flipped under it at the top of the map (labelY)
    const caveTag = this.track(
      "CAVE_POS",
      this.add
        .text(CAVE_POS.x, this.labelY(CAVE_POS.y, TILE * 1.25 + EXIT_LABEL_GAP), "CAVE", retroStyle(6, EXIT_LABEL_COLOR))
        .setStroke("#1a1028", 4)
        .setOrigin(0.5)
        .setDepth(11),
    );
    this.fixedLabels.push(rectOf(caveTag));

    this.addSign("RANK_BOARD_POS", RANK_BOARD_POS, "RANK BOARD", "#c084fc");
    this.addSign("BOUNTY_BOARD_POS", BOUNTY_BOARD_POS, "BOUNTY BOARD", "#facc15");
    // fishing dock: signpost on the pond's bank, one tile from the cast spot
    this.addSign("FISH_SIGN_POS", FISH_SIGN_POS, "FISHING", "#38bdf8");
    // farm field: signpost on the grass south of the plots, by the spot the
    // hero farms from. Beside them on the north row its tag lay under the HOME
    // bubble, which every new game and continue opens with.
    this.addSign("FARM_SIGN_POS", FARM_SIGN_POS, "FARM", "#a3e635");

    // the tilled rows and their fence over the 3x2 soil; FARM_POS is the
    // middle of the field's south row, where the fence stays open
    this.track("FARM_POS", this.add.image(FARM_POS.x, FARM_POS.y - TILE / 2, "farm-field").setDepth(OBJECT_LAYER_DEPTH - 0.5));
    this.addBlocker("FARM_POS", FARM_POS.x, FARM_POS.y - TILE * 1.5 + 8, TILE * 3, 16);
    this.addBlocker("FARM_POS", FARM_POS.x - TILE * 1.5 + 4, FARM_POS.y - TILE / 2, 8, TILE * 2);
    this.addBlocker("FARM_POS", FARM_POS.x + TILE * 1.5 - 4, FARM_POS.y - TILE / 2, 8, TILE * 2);

    this.cropSprites = farmPlots().map((pos) =>
      this.track("FARM_POS", this.add.sprite(pos.x, pos.y, "crop-sprout").setDepth(8).setVisible(false)),
    );

    // the eastern lane into the woods
    this.addMapExit("FOREST_POS", FOREST_POS, "FOREST");

    // gatekeeper who lets nobody through until the KING SLIME falls: on the
    // signpost's side of the lane, three tiles further in. Across the lane his
    // tag hung over the hero walking out; this keeps it off the lane and
    // clear of the sign's. Two tiles in, the tags shared a line 18px apart
    // (under a glyph, a word space) and read as one: "GUARD FOREST".
    const gate = inwardOf(FOREST_POS);
    this.guardPos = {
      x: Phaser.Math.Clamp(FOREST_POS.x + gate.dx * 4 * TILE - (gate.dy ? TILE : 0), TILE, (MAP_W - 1) * TILE),
      y: Phaser.Math.Clamp(FOREST_POS.y + gate.dy * 4 * TILE - (gate.dx ? TILE : 0), TILE * 1.5, (MAP_H - 1) * TILE - TILE * 0.5),
    };
    this.addNpc("FOREST_POS", this.guardPos, "GUARD", 0x67e8f9);

    // the mountain pass to the snow field, off the west edge
    this.addMapExit("SNOW_POS", SNOW_POS, "SNOW PASS");

    // the crater road, the last exit: marked like the others even while
    // sealed, so the GLACIER GOLEM's reward has somewhere visible to point to
    this.addMapExit("VOLCANO_POS", VOLCANO_POS, "VOLCANO");

    this.addNpc("HUNTER_POS", HUNTER_POS, "HUNTER", 0x86efac);
    this.addNpc("GAMBLER_POS", GAMBLER_POS, "GAMBLER", 0xf472b6);
    // runs the boss gauntlet (arena.ts); stands even before it opens, so the
    // KING SLIME has something to unlock
    this.addNpc("ARENA_POS", ARENA_POS, "ARENA", 0xfbbf24);
    // forges monster materials into gear (ui/Blacksmith.ts); steel grey, a
    // tint no other NPC or minimap dot uses
    this.addNpc("BLACKSMITH_POS", BLACKSMITH_POS, "BLACKSMITH", 0xcbd5e1);
    this.addProp("BLACKSMITH_POS", { x: BLACKSMITH_POS.x + TILE, y: BLACKSMITH_POS.y }, "anvil");
    for (const landmark of WORKPLACE_LANDMARKS) this.addWorkplace(landmark);

    const winter = seasonLook("town") === "winter";
    MEADOW_DECOR.forEach(([key, tx, ty], i) => {
      if (level[ty]?.[tx] !== T_GRASS || (winter && key === "flowers")) return;
      this.add
        .image(tx * TILE + TILE / 2, ty * TILE + TILE / 2, key)
        .setDepth(4)
        .setFlipX(i % 2 === 1);
    });

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
    const fromVolcano = !!data?.fromVolcano;
    const spawn = fromDungeon
      ? stepIn(CAVE_POS)
      : fromForest
        ? stepIn(FOREST_POS)
        : fromSnow
          ? stepIn(SNOW_POS)
          : fromVolcano
            ? stepIn(VOLCANO_POS)
            : respawn;
    // just walked out of the cave/forest/snow/volcano: hold off re-triggering
    // it in case the player is still holding the walk-in key
    if (fromDungeon || fromForest || fromSnow || fromVolcano) this.encounterCooldown = Math.max(this.encounterCooldown, ENCOUNTER_COOLDOWN);
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
    this.physics.add.collider(this.player, this.blockers);

    // a chevron on each edge exit's last tile, pointing off the map
    for (const [landmark, pos] of [
      ["FOREST_POS", FOREST_POS],
      ["SNOW_POS", SNOW_POS],
      ["VOLCANO_POS", VOLCANO_POS],
    ] as const) {
      const { dx, dy } = inwardOf(pos);
      this.track(landmark, addExitArrow(this, this.player, pos.x, pos.y, Phaser.Math.RadToDeg(Math.atan2(-dy, -dx))));
    }
    // No tag under a talk or a panel (the talk's name plate sat right on
    // them, a panel let them show through), and toasts wait for it to close —
    // but not under the map editor, which is all about where things stand.
    // The people's tags fade with distance while the rest are up.
    whilePanelUp(
      this,
      () => this.uiBlocking() && !this.mapEditor.isActive(),
      () => {
        for (const { tag, sprite } of this.npcTags) {
          const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, sprite.x, sprite.y);
          tag.setAlpha(Phaser.Math.Clamp((NPC_TAG_FAR - d) / (NPC_TAG_FAR - NPC_TAG_NEAR), 0, 1));
        }
      },
    );

    // A battle just ended on this spot, which is inside a monster zone —
    // step out to the nearest walkable tile outside it so the encounter
    // lock expiring here doesn't trigger another fight immediately.
    if (data?.fromBattle) this.escapeMonsterZone();

    this.playerShadow = addGroundShadow(this, this.player);
    this.companionFollower = new CompanionSprite(this, this.player.x, this.player.y);
    this.treasure = new TreasureDigger(this, "town", this.player, { toastY: STATUS_HUD_TOAST_Y, dug: () => this.holdFights() });

    this.weaponOverlay = this.add.sprite(this.player.x, this.player.y, "equip-sword").setDepth(11).setVisible(false);
    this.shieldOverlay = this.add.sprite(this.player.x, this.player.y, "equip-shield").setDepth(11).setVisible(false);

    createWalkAnimations(this);

    addFootsteps(this, this.player, level, "town");
    addGuideArrow(this, this.player, "town", () => this.quitting || this.uiBlocking());

    // petals and butterflies by day, fireflies at night; this replaces the
    // town's own player-following fireflies, which would double up with it
    addAmbient(this, "town");

    this.spawnMonsters();

    // after every fixed tag exists (spawnMonsters adds the zone warnings), and
    // kept off the same spots tryTalk() answers, plus the map exits and the
    // workplaces (their centres: AVOID_RADIUS covers all four tiles)
    this.villagers = new Villagers(
      this,
      level,
      [
        ...this.talkSpots(),
        CAVE_POS,
        FOREST_POS,
        SNOW_POS,
        VOLCANO_POS,
        ...WORKPLACE_LANDMARKS.map((k) => ({ x: EDITABLE_POS[k].x + TILE / 2, y: EDITABLE_POS[k].y - TILE * 1.5 })),
      ],
      MONSTER_ZONES,
      this.fixedLabels,
    );

    this.physics.add.overlap(this.player, this.roamerGroup, (_p, roamer) => {
      if (this.encounterCooldown > 0) return;
      // nor on the way to the title, which would then race the battle's fade
      if (this.uiBlocking() || this.quitting) return;
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

    const volcano = this.add.zone(VOLCANO_POS.x, VOLCANO_POS.y, TILE, TILE).setDepth(1);
    this.physics.add.existing(volcano);
    this.physics.add.overlap(this.player, volcano, () => {
      if (this.enteringVolcano || this.enteringDungeon || this.enteringForest || this.enteringSnow || this.encounterCooldown > 0) return;
      if (this.uiBlocking()) return;
      // overlap fires every frame while the body stays in the zone, so only
      // act on the entry edge and reset on exit (see updateVolcanoGate)
      if (this.volcanoOverlapActive) return;
      this.volcanoOverlapActive = true;
      // the last gate: the crater stays shut until the GLACIER GOLEM falls
      if (!GameState.quest.snowBoss) {
        this.dialogue.start(["A crust of black ice", "seals the crater.", "Its frost comes from", "the far snow field..."]);
        return;
      }
      this.enterVolcano();
    });

    startWaterAnimation(this, this.layers.terrain);

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    boundCameraToMap(this, MAP_W * TILE, MAP_H * TILE);

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
    // CTRL+G, +100 gold: a dev server's test key only. A build leaves it out
    // (Vite folds import.meta.env.DEV to false), or anyone could buy their way
    // up the RANK BOARD and into TYCOON.
    if (import.meta.env.DEV) {
      this.keyG = kb.addKey(Phaser.Input.Keyboard.KeyCodes.G);
      this.keyG.on(Phaser.Input.Keyboard.Events.DOWN, () => {
        if (this.keyG.ctrlKey) this.gCheatQueued = true;
      });
    }
    this.keyM = kb.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.keyM.on(Phaser.Input.Keyboard.Events.DOWN, () => {
      this.mQueued = true;
    });
    // C at HOME: a new look (the bubble says so; on touch the bubble is tapped)
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.C).on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (!e.repeat) this.cQueued = true;
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
    // quest journal: U, since R (restore) and X (export) belong to the map editor
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.U).on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (!e.repeat) this.uQueued = true;
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
    // every talk, and the quit question (askQuitToTitle)
    this.dialogue = new DialogueBox(this, []);
    this.shop = new ShopUI(this);
    this.inventory = new InventoryUI(this);
    this.bestiary = new BestiaryUI(this);
    this.rankBoard = new RankingUI(this);
    this.fishing = new FishingUI(this);
    this.farm = new FarmUI(this);
    this.blacksmith = new BlacksmithUI(this);
    this.kitchen = new KitchenUI(this);
    this.home = new HomeUI(this, {
      rest: () => this.rest(),
      cook: () => this.kitchen.open(),
      built: (level) => this.houseBuilt(level),
    });
    this.mapEditor = new MapEditor(this, this.layers, level, (name, x, y) => this.moveLandmark(name, x, y));
    // ?edit in the URL opens the editor without a keypress — a way in that
    // survives whatever swallows the hotkey (a Mac's F-keys, an IME holding
    // keydown, a stale tab from an older bundle)
    if (new URLSearchParams(window.location.search).has("edit")) this.editorQueued = true;
    this.luckyWheel = new LuckyWheel(this);
    this.achievementsUI = new AchievementsUI(this);
    this.questLog = new QuestLog(this);
    this.lookPicker = new LookPicker(this);
    // touch has no Q: the settings' QUIT chip runs the same save-and-quit as YES
    this.settingsUI = new SettingsUI(this, () => this.quit());

    const help = addHelpPopup(
      this,
      [
        ["HJKL", "MOVE"],
        ["Z", "TALK/OK"],
        // only by the door (nearHouse), as the HOME bubble says
        ["C", "LOOK@HOME"],
        ["I", "ITEMS"],
        ["B", "BESTIARY"],
        ["A", "ACHIEVE"],
        ["U", "JOURNAL"],
        ["O", "SETTINGS"],
        ["T", "MAP"],
        ["S", "HUD"],
        ["M", "MUTE"],
        ["ESC", "SKIP"],
        ["F2", "MAP EDIT"],
        ["CTRL+S", "SAVE"],
        ["Q", "QUIT"],
        ["?", "HELP"],
      ],
      // the chain's current step, read when the popup opens: the ELDER pays
      // out and the HUNTER hires without the scene restarting
      () => objectiveLine(GameState.quest),
      () => this.uiBlocking() || this.quitting,
    );

    // key landmarks in world px, drawn as colored dots over the tile map
    this.minimap = new Minimap(this, level, this.player, [
      { x: HOUSE_POS.x + TILE, y: HOUSE_POS.y + TILE, color: 0xffd166 },
      { x: SHOP_POS.x, y: SHOP_POS.y, color: 0xfde047 },
      { x: NPC_POS.x, y: NPC_POS.y, color: 0x8ecbff },
      { x: CAVE_POS.x, y: CAVE_POS.y, color: 0xff5555 },
      { x: RANK_BOARD_POS.x, y: RANK_BOARD_POS.y, color: 0xc084fc },
      { x: BOUNTY_BOARD_POS.x, y: BOUNTY_BOARD_POS.y, color: 0xfacc15 },
      { x: GAMBLER_POS.x, y: GAMBLER_POS.y, color: 0xf472b6 },
      { x: ARENA_POS.x, y: ARENA_POS.y, color: 0xfbbf24 },
      { x: BLACKSMITH_POS.x, y: BLACKSMITH_POS.y, color: 0xcbd5e1 },
      { x: FOREST_POS.x, y: FOREST_POS.y, color: 0x4ade80 },
      { x: SNOW_POS.x, y: SNOW_POS.y, color: 0xa5f3fc },
      { x: VOLCANO_POS.x, y: VOLCANO_POS.y, color: 0xf97316 },
      { x: FISH_POS.x, y: FISH_POS.y, color: 0x38bdf8 },
      { x: FARM_POS.x, y: FARM_POS.y, color: 0xa3e635 },
    ]);

    // open ground: no ambient shade, full night range
    this.night = new NightOverlay(this);
    // the house's two windows light up at night (36px either side of its
    // centre, 8px below, in the 128px art) and move with it in the map editor
    const windows = [-36, 36].map((dx) => ({
      x: HOUSE_POS.x + TILE + dx,
      y: HOUSE_POS.y + TILE + 8,
      radius: 36,
      color: 0xffc861,
      strength: 0.6,
      lamp: true,
    }));
    for (const glow of this.night.addLights(windows)) this.track("HOUSE_POS", glow);
    if (GameState.houseLevel >= BEDS_LEVEL) this.lightDormer();
    for (const { landmark, light } of this.workplaceLights) for (const glow of this.night.addLights([light])) this.track(landmark, glow);

    this.hud = new StatusHud(this);
    // on the first visit of a new season, after the arrival fade like the
    // town event's toast, queued with it
    this.announceSeason(EVENT_TOAST_DELAY);
    // built again for a new season (turnSeason, or a night slept into one):
    // the map as the hero left it, and the waking a rest ends in
    if (data?.mapOpen) this.minimap.toggle();
    if (data?.rested) {
      this.cameras.main.fadeIn(400, 0, 0, 0);
      this.restedNote();
    }

    // An edited map silently outranks the code, which reads as "my changes
    // didn't deploy" — say so on screen instead, and say how to undo it.
    if (hasMapOverride()) {
      this.add
        // top right, under the HUD: the top left is where the HOME bubble
        // opens and the bottom corners are the minimap and the key hints.
        // Below a two-line toast (y 100..152): level with the toast line, a
        // long one ran into it ("MARKET DAY! SHOP PRICES ..." over "MAP
        // EDITED"). Clear of the touch menu strip (x >= 1222), outlined like
        // the other text over the map.
        .text(GAME_WIDTH - 70, STATUS_HUD_TOAST_Y + 60, "MAP EDITED - F2 THEN R TO RESTORE", retroStyle(4, "#ffd166"))
        .setStroke("#1a1028", 4)
        .setOrigin(1, 0)
        .setScrollFactor(0)
        .setDepth(120);
    }

    if (isTouchDevice()) this.touch = new TouchControls(this);

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
      this.blacksmith.destroy();
      this.kitchen.destroy();
      this.home.destroy();
      this.mapEditor.destroy();
      this.luckyWheel.destroy();
      this.achievementsUI.destroy();
      this.villagers.destroy();
      this.questLog.destroy();
      this.lookPicker.destroy();
      this.settingsUI.destroy();
      this.minimap.destroy();
      this.night.destroy();
      this.companionFollower.destroy();
      help.destroy();
      this.touch?.destroy();
    });
  }

  // One place decides how an exit to another map is drawn, so the three
  // openings can't drift apart again (they had three different offsets, two
  // colours, and the CAVE's name sat below its entrance instead of above).
  // A name tag above its spot hides under the status HUD when the spot is
  // near the top of the map: the camera clamps there, so it can never scroll
  // clear. Flip the tag below the spot in that band instead. (The camera can
  // rise to show row 0 under the HUD now, but a tag there sat in the toast
  // line just under it: FARM and FISHING read into "MARKET DAY! SHOP ...".)
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
      // a static body (a prop's, the fence's) stays where it was unless told
      const body = (part.obj as { body?: unknown }).body;
      if (body instanceof Phaser.Physics.Arcade.StaticBody) body.updateFromGameObject();
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

  // sprite + shadow + name tag, the shape every town NPC shares. A role with
  // art of its own (`npc-<label>`, e.g. npc-elder) is drawn as it is; the
  // rest share the robed "npc" figure, told apart by tint.
  private addNpc(landmark: string, pos: { x: number; y: number }, label: string, tint: number, labelColor?: string): void {
    const key = `npc-${label.toLowerCase()}`;
    const own = this.textures.exists(key);
    const sprite = this.track(landmark, this.add.sprite(pos.x, pos.y, own ? key : "npc").setDepth(10));
    if (!own) sprite.setTint(tint);
    this.npcSprites.push(sprite);
    this.track(landmark, addGroundShadow(this, pos));
    const at = this.tagAt(landmark, pos);
    const tag = this.track(
      landmark,
      this.add
        .text(at.x, at.y, label, retroStyle(5, labelColor ?? `#${tint.toString(16).padStart(6, "0")}`))
        .setStroke("#1a1028", 4)
        .setOrigin(0.5)
        .setDepth(11),
    );
    this.fixedLabels.push(rectOf(tag));
    if (!ALWAYS_TAGGED.has(label)) this.npcTags.push({ tag: tag.setAlpha(0), sprite });
  }

  // Where a person's tag goes: over their head; for a keeper with a workplace
  // (WORKPLACES), centred over the building as HOME's is, just above its
  // roofline -- over the front of the art, the hearth and the counter, it
  // covered what they keep. Where the row above the building is road, it
  // drops onto the building's empty top edge instead, off the road.
  private tagAt(landmark: string, pos: { x: number; y: number }): { x: number; y: number } {
    const place = WORKPLACES[landmark as (typeof WORKPLACE_LANDMARKS)[number]];
    if (!place) return { x: pos.x, y: this.labelY(pos.y, 48) };
    const top = pos.y - TILE * 2.5;
    const tx = Math.floor(pos.x / TILE);
    const above = Math.floor(top / TILE) - 1;
    const roadAbove = [tx, tx + 1].some((x) => this.level[above]?.[x] === T_PATH);
    const y = top + place.roof - TAG_CLEAR;
    return { x: pos.x + TILE / 2, y: roadAbove ? Math.max(y, top + TAG_CLEAR) : y };
  }

  // a keeper's prop on its own ground shadow, carried with them in the
  // editor; solid at its foot, like a tree trunk, so the hero walks round it
  private addProp(landmark: string, pos: { x: number; y: number }, key: string): void {
    this.track(landmark, addGroundShadow(this, pos, { w: 52, h: 14 }));
    this.track(landmark, this.add.image(pos.x, pos.y, key).setDepth(9));
    this.addBlocker(landmark, pos.x, pos.y + 12, 48, 24);
  }

  // A keeper's workplace behind them (levels.ts WORKPLACE_LANDMARKS): 2x2
  // tiles on the two rows north of their tile, its left column over theirs.
  // Solid over that footprint as HOME's tiles are, not just at its foot like
  // a prop: two tiles tall, a hero walking in under its roof would stand on
  // the art. Carried with the keeper in the map editor; snowed in the winter
  // skin, its lamps lit at night.
  private addWorkplace(landmark: (typeof WORKPLACE_LANDMARKS)[number]): void {
    const pos = EDITABLE_POS[landmark];
    const { key, lights } = WORKPLACES[landmark];
    const x = pos.x + TILE / 2;
    const y = pos.y - TILE * 1.5;
    this.track(landmark, addGroundShadow(this, { x, y }, { w: 120, h: 18, yOffset: 60, depth: HOUSE_DEPTH }));
    this.track(landmark, this.add.image(x, y, seasonLook("town") === "winter" ? `${key}-winter` : key).setDepth(HOUSE_DEPTH));
    this.addBlocker(landmark, x, y, TILE * 2, TILE * 2);
    for (const l of lights) {
      const light = {
        x: x + l.dx,
        y: y + l.dy,
        radius: l.radius,
        color: l.color ?? 0xffc861,
        strength: 0.55,
        lamp: true,
        pulseMs: l.pulseMs,
      };
      this.workplaceLights.push({ landmark, light });
    }
  }

  // an invisible static box the hero collides with (create() adds the
  // collider once the hero exists), moved along with its landmark
  private addBlocker(landmark: string, x: number, y: number, w: number, h: number): void {
    const zone = this.track(landmark, this.add.zone(x, y, w, h));
    this.physics.add.existing(zone, true);
    this.blockers.push(zone);
  }

  // signpost + name tag, the shape every interactive spot shares
  private addSign(landmark: string, pos: { x: number; y: number }, label: string, color: string): void {
    this.track(landmark, this.add.image(pos.x, pos.y, "sign").setDepth(9));
    // outlined like the snow field's tags: winter's snow (season.ts) is as
    // pale as the field's, and the bare colours sank into it (contrast ~1.3)
    const tag = this.track(
      landmark,
      this.add.text(pos.x, this.labelY(pos.y, 48), label, retroStyle(5, color)).setStroke("#1a1028", 4).setOrigin(0.5).setDepth(11),
    );
    this.fixedLabels.push(rectOf(tag));
  }

  // An exit on the map's edge, on the last tile of the road running off it:
  // a signpost a tile in, beside the road (north of an east-west road, west
  // of a north-south one), and a chevron on the edge tile once the hero is
  // close. The arrow needs the hero, so it is added after the hero is.
  private addMapExit(landmark: string, pos: { x: number; y: number }, name: string): void {
    const { dx, dy } = inwardOf(pos);
    this.addSign(landmark, { x: pos.x + dx * TILE - (dy ? TILE : 0), y: pos.y + dy * TILE - (dx ? TILE : 0) }, name, EXIT_LABEL_COLOR);
  }

  // The last line follows rest(): only a night's sleep moves the clock. The
  // first names the look change beside HOME rather than taking a fourth line,
  // whose taller bubble would drop its tail onto the hero's head. At
  // retroStyle(5) (20px a glyph) "Z: REST, COOK, BUILD" is the widest line
  // either way (400px; "HOME  TAP: NEW LOOK" 380, "SLEEP UNTIL MORNING" 380,
  // "SLEEP AFTER 20:00" 340), so the box sized once below fits every swap.
  private homeBubbleLines(): string {
    return [
      `HOME  ${isTouchDevice() ? "TAP" : "C"}: NEW LOOK`,
      "Z: REST, COOK, BUILD",
      isNight() ? "SLEEP UNTIL MORNING" : "SLEEP AFTER 20:00",
    ].join("\n");
  }

  private buildHomeBubble(): Phaser.GameObjects.Container {
    const text = this.add.text(0, 0, this.homeBubbleLines(), retroStyle(5, "#f5f5f5")).setOrigin(0.5).setAlign("center").setLineSpacing(4);
    this.homeBubbleText = text;
    const pad = 20;
    const w = text.width + pad * 2;
    const h = text.height + pad * 2;
    const border = this.add.rectangle(0, 0, w + 8, h + 8, 0xffffff).setOrigin(0.5);
    const box = this.add.rectangle(0, 0, w, h, 0x0b0b2b).setOrigin(0.5);
    // a tap on the bubble is touch's C (it only shows by the door)
    box.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
      if (this.bubbleVisible && !this.uiBlocking()) this.openLookPicker();
    });
    const tail = this.add
      .triangle(0, h / 2 + 4, -24, 0, 24, 0, 0, 28, 0x0b0b2b)
      .setStrokeStyle(2, 0xffffff)
      .setOrigin(0.5);
    // The camera never scrolls past the map's left, right or bottom edge, so
    // clamping the bubble to the map there keeps it fully on screen even for a
    // house in a far corner. The top is different: boundCameraToMap lets the
    // camera rise STATUS_HUD_HEIGHT above the map (an empty strip behind the
    // HUD). Keeping the bubble's top at least that far into the map still
    // clears the HUD — at the camera's highest it just sits lower on screen.
    const x = Phaser.Math.Clamp(HOUSE_POS.x + TILE, w / 2 + 8, MAP_W * TILE - w / 2 - 8);
    const y = Phaser.Math.Clamp(HOUSE_POS.y + TILE - h / 2 - 32, STATUS_HUD_HEIGHT + h / 2, MAP_H * TILE - h / 2 - 8);
    return this.add.container(x, y, [border, box, text, tail]).setDepth(12);
  }

  private openLookPicker(): void {
    this.player.setVelocity(0, 0);
    this.lookPicker.open(GameState.heroLook, (look) => {
      if (look === null || look === GameState.heroLook) return;
      GameState.heroLook = look;
      bakeHero(this, look);
      GameState.save();
    });
  }

  private nearHouse(): boolean {
    const dx = this.player.x - (HOUSE_POS.x + TILE);
    const dy = this.player.y - (HOUSE_POS.y + 2 * TILE);
    return dx * dx + dy * dy <= 144 * 144;
  }

  private updateHomeBubble(): void {
    const near = this.nearHouse();
    // dusk or dawn can pass while the hero stands by the door
    if (near) this.homeBubbleText.setText(this.homeBubbleLines());
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
      // {} rather than nothing: Phaser keeps the last start's data when the
      // next passes none, and a forest last built for a season's turn would
      // set the hero back where they stood then, untitled
      this.scene.start("Forest", {});
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

  private enterVolcano(): void {
    if (this.enteringVolcano) return;
    this.enteringVolcano = true;
    Sfx.night();
    this.player.setVelocity(0, 0);
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("Volcano");
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
      const grown = cropProgress(plot);
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

  // and again for the volcano's
  private updateVolcanoGate(): void {
    if (!this.volcanoOverlapActive) return;
    if (Math.abs(this.player.x - VOLCANO_POS.x) > TILE || Math.abs(this.player.y - VOLCANO_POS.y) > TILE) {
      this.volcanoOverlapActive = false;
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
      this.blacksmith.isActive() ||
      this.kitchen.isActive() ||
      this.home.isActive() ||
      this.mapEditor.isActive() ||
      this.luckyWheel.isActive() ||
      this.achievementsUI.isActive() ||
      this.questLog.isActive() ||
      this.lookPicker.isActive() ||
      this.settingsUI.isActive() ||
      helpOpen(this)
    );
  }

  // The day only counts as announced once the toast is handed over: a Town
  // restart during the delay (a battle) drops this timer, and update() then
  // schedules it again. showToast queues it behind any toast already up (an
  // achievement claimed on arrival) rather than cutting that off.
  private announceEvent(day: number, text: string): void {
    this.eventToastPending = false;
    // a panel opened during the delay; update() retries once it closes
    if (this.uiBlocking()) return;
    announcedDay = day;
    showToast(this, text, STATUS_HUD_TOAST_Y);
  }

  update(_time: number, delta: number): void {
    GameState.minutes += (delta / 1000) * GameState.timeSpeed;

    // A town event is announced once a day (econDay, the day the event itself
    // goes by): on the first arrival that day, or when the clock (or a rest)
    // turns the day over here. Held back while a panel is up so it doesn't
    // land on one. Its longest line, "FISHING DERBY! POND CATCHES PAY x1.5
    // TODAY", is 42 x 20 = 840px (x 220..1060) under the HUD, clear of the
    // touch menu strip (x>=1222).
    const day = econDay();
    if (day !== announcedDay && !this.eventToastPending && !this.uiBlocking()) {
      const event = eventToday();
      if (!event) {
        announcedDay = day;
      } else {
        this.eventToastPending = true;
        this.time.delayedCall(EVENT_TOAST_DELAY, () => this.announceEvent(day, event.toast));
      }
    }

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
    this.updateVolcanoGate();
    this.updateCrops();
    if (this.editorQueued) {
      this.editorQueued = false;
      // F2 is handled ahead of the uiBlocking() gate, so it would otherwise
      // open the editor right over the journal
      if (this.questLog.isActive()) this.questLog.close();
      this.mapEditor.toggle();
    }
    this.minimap.update();

    if (import.meta.env.DEV && this.gCheatQueued) {
      this.gCheatQueued = false;
      const gained = GameState.gainGold(100);
      GameState.save();
      this.flashNote(`+${gained}G (CHEAT)`);
    }

    this.achievementCheckAccum += delta;
    // only with no panel or talk up: a tip or trophy toast drawn over an open
    // panel (the bag, the journal...) covered its top rows. Nothing is lost:
    // the check just waits for the panel to close.
    if (this.achievementCheckAccum >= 1000 && !this.uiBlocking()) {
      this.achievementCheckAccum = 0;
      const earned = claimAchievements();
      if (showUnlockTip(this, "town", STATUS_HUD_TOAST_Y) || earned.length > 0) {
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
        showToast(this, names.length === 1 ? `ACHIEVEMENT: ${names[0]}!` : `ACHIEVEMENTS: ${names.join(", ")}!`, STATUS_HUD_TOAST_Y);
      }
      announceLooks(this, earned, STATUS_HUD_TOAST_Y);
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

    // saved and on the way to the title (quit), or fading out to the new
    // season (turnSeason): nothing else moves. The roamers are kept to their
    // boxes, as under a panel: left on their last velocity they walked off
    // across the map until the title came
    if (this.quitting || this.turningSeason) {
      this.updateRoamers(delta);
      return;
    }

    if (this.qQueued) {
      this.qQueued = false;
      // never over an open panel: the question's ESC would close that panel too
      if (!this.uiBlocking() && !this.enteringDungeon) askQuitToTitle(this.dialogue, () => this.quit());
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
      this.dialogue.update();
      this.shop.update();
      this.inventory.update();
      this.bestiary.update();
      this.rankBoard.update();
      this.fishing.update();
      this.farm.update();
      this.blacksmith.update();
      this.kitchen.update();
      this.home.update();
      this.mapEditor.update();
      this.luckyWheel.update();
      this.achievementsUI.update();
      this.questLog.update();
      this.lookPicker.update();
      this.settingsUI.update();
      this.updateRoamers(delta);
      // the town keeps living behind a panel; whoever is talking stands still
      this.villagers.update(delta, this.player, this.dialogue.isActive());
      return;
    }

    // The clock moved the town into a new season while the hero stood in it:
    // not under a panel or a talk (above), nor while a fight, a rest or
    // another map is already fading the screen out (encounterCooldown covers
    // the fight's fade, and the entry grace). A new look of the ground
    // (seasonLook) builds the town again; spring into summer, the same
    // ground, only brings the news.
    const leaving = this.resting || this.enteringDungeon || this.enteringForest || this.enteringSnow || this.enteringVolcano;
    const season = seasonToday();
    if (season !== this.season && !leaving && this.encounterCooldown <= 0) {
      if (seasonLook("town", season) !== seasonLook("town", this.season)) {
        this.turnSeason();
        return;
      }
      this.season = season;
      this.announceSeason();
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

    if (this.cQueued) {
      this.cQueued = false;
      if (this.nearHouse()) {
        this.openLookPicker();
        return;
      }
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
    this.updateEquipOverlays();
    this.updateRoamers(delta);
    this.villagers.update(delta, this.player, this.dialogue.isActive());
    this.checkEncounter(delta, moving);
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
    placeHeroGear(this.weaponOverlay, this.shieldOverlay, this.player, this.lastMove);
  }

  // YES to the quit question, or the settings' QUIT chip on touch
  private quit(): void {
    this.quitting = true;
    // same pos the SHUTDOWN handler would record, so what SAVED reports is
    // already the complete state
    GameState.pos = { x: this.player.x, y: this.player.y };
    saveAndQuit(this);
  }

  private toggleStatus(): void {
    const visible = !this.hud.isVisible();
    this.hud.setVisible(visible);
    GameState.hudVisible = visible;
    GameState.saveSettings();
  }

  private updateDayNight(): void {
    this.night.update();
  }

  private updateStatus(): void {
    this.hud.update();
  }

  // Every fixed spot Z answers to. Also what the villagers steer clear of, so
  // the two can't drift apart.
  private talkSpots(): Array<{ x: number; y: number; run: () => void }> {
    return [
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
      { x: HOUSE_POS.x + TILE, y: HOUSE_POS.y + 2 * TILE, run: () => this.homeChoice() },
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
      { x: ARENA_POS.x, y: ARENA_POS.y, run: () => this.startArenaDialogue() },
      {
        x: BLACKSMITH_POS.x,
        y: BLACKSMITH_POS.y,
        run: () => {
          Sfx.buy();
          this.blacksmith.open();
        },
      },
    ];
  }

  // The keeper explains the gauntlet and asks under the last page (the
  // dialogue's choices: FIGHT, or LEAVE — which ESC also picks). Lines fit
  // the dialogue's 42-glyph touch rows unbroken; the question gets a page of
  // its own on touch, where it keeps to one row over the choices.
  private startArenaDialogue(): void {
    if (!arenaOpen()) {
      this.dialogue.start(["The ARENA is shut.", "Beat the KING SLIME,", "then come back!"], "ARENA");
      return;
    }
    const lineup = arenaLineup();
    this.dialogue.ask(
      [
        `${lineup.length} ${lineup.length === 1 ? "boss" : "bosses"} you've beaten,`,
        "back to back. No running!",
        "Items are allowed, and you",
        `heal ${Math.round(ARENA_RECOVER_PCT * 100)}% between bouts.`,
        `Your best run: ${GameState.arenaBest} won.`,
        "ENTER THE ARENA?",
      ],
      "ARENA",
      ["FIGHT", "LEAVE"],
      (i) => {
        if (i === 0) this.startArena();
      },
    );
  }

  // the keeper's yes: straight into the first bout behind the same fade an
  // encounter uses; BattleScene carries the run from there (see arena.ts)
  private startArena(): void {
    // No encounterCooldown check: that grace is for random encounters, and
    // here it silently swallowed an explicit FIGHT picked within the first
    // seconds in town. It's still raised below, so nothing ambushes the fade.
    const run: ArenaRun = { lineup: arenaLineup(), round: 0, purse: 0 };
    this.player.setVelocity(0, 0);
    this.encounterCooldown = ENCOUNTER_COOLDOWN;
    Sfx.boss();
    encounterOut(this.cameras.main, 300, () => {
      this.scene.start("Battle", { enemy: run.lineup[0], from: "Town", arena: run });
    });
  }

  // NPCs on the main road sit 3 tiles (192px) apart, closer than 2x the 120px
  // talk radius (240px) — their radii overlap in a ~24px band. Picking the
  // nearest candidate (instead of the first one whose radius contains the
  // player) makes standing in that band resolve to whichever NPC is actually
  // closest, not whichever happens to be checked first. The villagers join
  // the same pick at wherever they are walking right now.
  // A villager's favor comes first (favors.ts): offered with a YES/NO, its
  // progress with a hint while it's open, paid when it's met — handing over
  // pieces from the bag asks first. Otherwise, or once the chain is done or
  // waits on a region, just a hint. villagers.talk() also stops the walker
  // and turns it to the hero. Lines stay within the touch box's 42 glyphs.
  private talkToVillager(index: number, key: VillagerKey, name: string): void {
    const hint = this.villagers.talk(index, this.player.x);
    const step = favorStep(key);
    const status = favorStatus(key);
    if (!step || status === "done" || status === "locked") {
      this.dialogue.start(hint, name);
      return;
    }
    if (status === "offer") {
      this.dialogue.ask([...step.talk, "Will you help me?"], name, ["YES", "NO"], (i) => {
        if (i !== 0) return;
        acceptFavor(key);
        GameState.save();
        this.dialogue.start(["Thank you, hero!", "Come see me by day", "when it's done."], name);
      });
      return;
    }
    const { have, need } = favorProgress(key);
    if (status === "open") {
      this.dialogue.start([`How is it going? ${Math.min(have, need)}/${need}`, ...hint], name);
      return;
    }
    const pay = () => {
      const paid = completeFavor(key);
      if (!paid) return;
      if (paid === "full") {
        this.dialogue.start(["Your purse is full.", "Come back with room."], name);
        return;
      }
      Sfx.buy();
      GameState.save();
      this.dialogue.start(
        ["Thank you, hero!", `Take ${paid.gold} gold.`, ...(paid.elixir ? ["And this ELIXIR. That's", "all I needed. Thanks!"] : [])],
        name,
      );
    };
    if (step.takes) {
      const pieces = `${step.need} ${materialNameOf(step.takes)}`;
      this.dialogue.ask([`You have ${pieces}!`, "Will you hand it over?"], name, ["YES", "NO"], (i) => {
        if (i === 0) pay();
      });
      return;
    }
    pay();
  }

  private tryTalk(): boolean {
    // a treasure map's X (ui/TreasureDig.ts) first: spots keep 2 tiles clear
    // of every talk spot, but a villager can wander up to one
    if (this.treasure.tryDig()) return true;
    const dist2 = (x: number, y: number): number => {
      const dx = this.player.x - x;
      const dy = this.player.y - y;
      return dx * dx + dy * dy;
    };
    const candidates = [
      ...this.talkSpots(),
      ...this.villagers.talkTargets().map((v) => ({
        x: v.x,
        y: v.y,
        run: () => this.talkToVillager(v.index, v.key, v.name),
      })),
    ];
    const RADIUS2 = 120 * 120;
    let best: { d: number; x: number; y: number; run: () => void } | null = null;
    for (const c of candidates) {
      const d = dist2(c.x, c.y);
      if (d <= RADIUS2 && (!best || d < best.d)) best = { d, ...c };
    }
    if (!best) return false;
    // a fixed NPC turns to the hero, the way a villager does
    const { x, y } = best;
    const npc = this.npcSprites.find((s) => s.x === x && s.y === y);
    npc?.setFlipX(this.player.x < npc.x);
    best.run();
    return true;
  }

  // HOME's Z: its panel (ui/HomeUI.ts) — rest, the kitchen, or build on
  private homeChoice(): void {
    this.home.open();
  }

  // a new extension (home.ts): the house redrawn as it now stands, its snow
  // cap with it, and the dormer lit at night once there is one
  private houseBuilt(level: number): void {
    this.houseImage.setTexture(houseTexture(level));
    this.houseSnow?.setTexture(`house-${level}-snow`);
    if (level === BEDS_LEVEL) this.lightDormer();
  }

  // the FEATHER BEDS' dormer window, 24px above the house's centre
  private lightDormer(): void {
    const dormer = { x: HOUSE_POS.x + TILE, y: HOUSE_POS.y + TILE - 24, radius: 24, color: 0xffc861, strength: 0.5, lamp: true };
    for (const glow of this.night.addLights([dormer])) this.track("HOUSE_POS", glow);
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
      // the FEATHER BEDS (home.ts): the next battle opens with WARD up
      if (GameState.houseLevel >= BEDS_LEVEL) GameState.rested = true;
      // Only a night's sleep moves the clock: to the next 06:00, which past
      // midnight is the same day's. A daytime rest used to jump to the next
      // dawn as well, and with crops timed on GameState.minutes that made
      // plant -> rest -> harvest a ~15s loop worth ~150k G an hour. A night
      // slept through still grows the night crops (cropGrowth counts it).
      if (isNight()) {
        const dawn = Math.floor(GameState.minutes / 1440) * 1440 + 360;
        GameState.minutes = GameState.minutes < dawn ? dawn : dawn + 1440;
      }
      GameState.save();
      // slept into a new season's look: the screen is dark already, so wake
      // in the town built again for it (create() fades in and says RESTED)
      if (seasonLook("town") !== seasonLook("town", this.season)) {
        this.scene.restart({ mapOpen: this.minimap.isVisible(), rested: true });
        return;
      }
      this.hud.forceRefresh();
      this.cameras.main.fadeIn(400, 0, 0, 0);
      this.resting = false;
      this.restedNote();
    });
  }

  // "AUTUMN HAS COME!" (16 x 20 = 320px) once per season (seasonNews), and
  // saved on the spot: the season last announced rides in the save, and one
  // shown after the last save came round again on a reload. Without the
  // SAVED toast, as for an achievement's save.
  private announceSeason(delay = 0): void {
    const news = seasonNews();
    if (!news) return;
    this.suppressSavedToast = true;
    GameState.save();
    this.suppressSavedToast = false;
    this.time.delayedCall(delay, () => showToast(this, news, STATUS_HUD_TOAST_Y));
  }

  private restedNote(): void {
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
  }

  // Everything the season changes is picked in create(): the ground's skin,
  // the snow on the house and the workplaces, the meadow's flowers, the
  // footprints, the air (Ambient) and the minimap's colours. So rather than
  // repaint each, fade out and build the town again where the hero stands
  // (GameState.pos, saved on shutdown), which also brings the season's news.
  // The roamers are rolled afresh, as after any fight.
  private turnSeason(): void {
    this.turningSeason = true;
    // the roamers still wander (update) and would start a fight on contact
    this.encounterCooldown = ENCOUNTER_COOLDOWN;
    this.player.setVelocity(0, 0);
    this.player.anims.stop();
    this.player.setTexture(IDLE_TEXTURE[this.lastMove]);
    this.cameras.main.fadeOut(SEASON_FADE, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      // never without data: a restart with none replays the last, and a town
      // entered { fromForest } would set the hero back at the lane
      this.scene.restart({ mapOpen: this.minimap.isVisible() });
    });
  }

  private startElderDialogue(): void {
    const q = GameState.quest;
    if (!q.slimeReward && q.slimes >= 5) {
      q.slimeReward = true;
      const gained = GameState.gainGold(30);
      Sfx.buy();
      // and the next errand with it, so the reward isn't a dead end
      const next = q.bossDefeated ? [] : ["Now the KING SLIME", "waits in the cave", "up north!"];
      this.dialogue.start(["Well done, hero!", "You hunted 5 slimes.", `Take these ${gained} gold!`, ...next], "ELDER");
      return;
    }
    if (!q.bossDefeated) {
      // on NEW GAME+ the ELDER knows the hero, and warns the beasts have grown
      // (GameState.enemyScale) before the same first errand as ever. A first
      // talk can be a first meeting, so no "welcome back"
      const greeting =
        GameState.ngPlus > 0 ? ["You again, hero?", "The beasts have grown", "fiercer since your", "last journey."] : ["Welcome, hero!"];
      // the slime hunt only until it's reported
      const errand = q.slimeReward
        ? ["The KING SLIME waits", "in the cave up north!"]
        : ["Slimes lurk in the grass.", "Hunt 5 slimes first.", "Then face the KING SLIME", "in the cave up north!"];
      this.dialogue.start([...greeting, ...errand], "ELDER");
      return;
    }
    if (!q.finalReward) {
      q.finalReward = true;
      const gained = GameState.gainGold(100);
      Sfx.buy();
      // the TROLL KING (TownScene's roaming giant) walks the meadows from
      // the KING SLIME's fall on (spawnMonsters), and hits harder than it did
      const troll = q.trollDefeated ? [] : ["A crowned TROLL KING", "roams the grass too.", "RUN until you're strong!"];
      this.dialogue.start(
        [
          "You are our hero!",
          "The KING SLIME is gone.",
          `Take this ${gained} gold!`,
          "The eastern woods hold",
          "a deeper threat now.",
          "The GUARD by the woods",
          "knows more.",
          ...troll,
        ],
        "ELDER",
      );
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
        [
          "The GLACIER GOLEM...",
          "fallen? You are the",
          "truest hero this realm",
          "has ever known.",
          `${gained} gold and 2 ELIXIRS!`,
          // its frost was what held the crater shut (see the volcano gate)
          "But with its frost gone,",
          "the VOLCANO to the",
          "south-east awakens...",
        ],
        "ELDER",
      );
      return;
    }
    // fifth and last step of the main chain; it sits ahead of the bestiary so
    // a finished drake hunt is paid before the long catch-them-all goal
    if (!q.volcanoReward && q.volcanoBoss) {
      q.volcanoReward = true;
      const gained = GameState.gainGold(400);
      GameState.inventory.elixir += 3;
      Sfx.buy();
      this.dialogue.start(
        [
          "The FLAME DRAKE is slain",
          "and the mountain sleeps.",
          "No hero will ever",
          "match your legend!",
          `${gained} gold and 3 ELIXIRS!`,
        ],
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
      const caught = GameState.caughtSpecies();
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
      this.dialogue.start(
        ["Now a different job:", "catch any 3 beasts", "with CANDY. Fresh", "catches only! Weaken one", "first, then throw it."],
        "HUNTER",
      );
      return;
    }
    if (!q.hunterCatchReward) {
      const caught = Math.min(GameState.caught.length - q.caughtAtAccept, 3);
      if (caught < 3) {
        this.dialogue.start([`${caught} of 3 beasts caught.`, "Throw CANDY at a hurt", "one to fill the order!"], "HUNTER");
        return;
      }
      q.hunterCatchReward = true;
      const gained = GameState.gainGold(80);
      GameState.inventory.ether += 2;
      Sfx.buy();
      this.dialogue.start(["A fine haul! Take", `${gained} gold and 2 ETHERS.`], "HUNTER");
      return;
    }
    if (this.silkJob()) return;
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
    // fourth job, once the GLACIER GOLEM falls and opens the volcano: a catch
    // job again, since catches are already on record (GameState.caught) and
    // a kill count would need a new BattleScene counter
    if (!q.snowBoss) {
      this.dialogue.start(["The wilds are quieter", "thanks to you, hero."], "HUNTER");
      return;
    }
    if (!q.hunterFireAccepted) {
      q.hunterFireAccepted = true;
      q.fireCaughtAtAccept = GameState.caught.length;
      this.dialogue.start(
        [
          "Last job, the big one:",
          "the VOLCANO's beasts",
          "fetch a fortune alive.",
          "Catch one MAGMA SLIME,",
          "FIRE IMP and SALAMANDER.",
          "Fresh catches only!",
        ],
        "HUNTER",
      );
      return;
    }
    if (!q.hunterFireReward) {
      const got = GameState.fireBeastsCaught();
      if (got.length < FIRE_BEASTS.length) {
        const missing = FIRE_BEASTS.filter((name) => !got.includes(name));
        this.dialogue.start(
          [`${got.length} of ${FIRE_BEASTS.length} fire beasts caught.`, `Still missing: ${missing.join(", ")}.`],
          "HUNTER",
        );
        return;
      }
      q.hunterFireReward = true;
      // the reward line reports what gainGold() actually credited, so a purse
      // at MAX_GOLD isn't promised gold it never got (see 6105867)
      const gained = GameState.gainGold(250);
      GameState.inventory.elixir += 1;
      Sfx.buy();
      this.dialogue.start(["The full set! Take", `${gained} gold and an`, "ELIXIR. Best hunter", "I've ever known."], "HUNTER");
      return;
    }
    this.dialogue.start(["The wilds are quieter", "thanks to you, hero."], "HUNTER");
  }

  // The HUNTER's SPIDER SILK job, the forest stretch's (Lv6-12) between the
  // CATCH job and the YETIs: once the KING SLIME opens the forest, 3 SILK
  // brought in — the TALISMAN's own thread, so it asks before taking any.
  // A save that took the YETI job before this one existed gets it once that
  // chain has nothing running or due (objective.ts reads the same). Taken on,
  // it's what the HUNTER talks about until it's handed in. True when it spoke.
  private silkJob(): boolean {
    const q = GameState.quest;
    if (!q.bossDefeated || q.hunterSilkReward) return false;
    if (!q.hunterSilkAccepted) {
      if (q.hunterYetiAccepted && (!q.hunterYetiReward || (q.snowBoss && !q.hunterFireReward))) return false;
      q.hunterSilkAccepted = true;
      this.dialogue.start(
        ["A new job, hero:", "the forest's SPIDERS", "spin a fine SILK.", "Bring me 3 SPIDER SILK", "and I'll pay well."],
        "HUNTER",
      );
      return true;
    }
    const have = GameState.inventory.spiderSilk;
    if (have < 3) {
      this.dialogue.start([`${have} of 3 SPIDER SILK.`, "The forest's SPIDERS", "drop it. Bring 3!"], "HUNTER");
      return true;
    }
    this.dialogue.ask([`${have} SPIDER SILK!`, "Will you hand 3 over?"], "HUNTER", ["YES", "NO"], (i) => {
      // re-read: nothing should move it behind the talk, but never take
      // what isn't there
      if (i !== 0 || GameState.inventory.spiderSilk < 3) {
        this.dialogue.start(["Bring it when you're", "ready, hero."], "HUNTER");
        return;
      }
      GameState.inventory.spiderSilk -= 3;
      q.hunterSilkReward = true;
      const gained = GameState.gainGold(110);
      GameState.inventory.hiPotion += 2;
      GameState.save();
      Sfx.buy();
      this.dialogue.start(["Fine silk! Take", `${gained} gold and 2`, "HI-POTIONS."], "HUNTER");
    });
    return true;
  }

  // The board's two jobs on one talk. The kill bounty rerolls once a new
  // in-game day starts (or on first read), then shows progress, pays out a
  // finished bounty once, or says it's already been claimed — no streak or
  // partial credit, same as every other day-based gate. Then the delivery
  // (delivery.ts): materials are the BLACKSMITH's too, so they're only taken
  // on a YES under the last page (NO, or ESC, keeps them). Every line is at
  // most 42 glyphs (the touch box's row) and the delivery starts on a row of
  // its own; the longest talk — a bounty still open plus a delivery ready —
  // fills three rows ("BOUNTY: FROST MOTH 5/6 REWARD: 342 GOLD." 1 row,
  // "DELIVER 4 SPIDER SILK FOR 1560 GOLD + A BOMB. YOU HAVE 5." 2) and the
  // question gets a page of its own over the choices.
  private startBountyDialogue(): void {
    GameState.rollBountyIfStale();
    const b = GameState.bounty;
    if (!b) return;
    const d = rollDeliveryIfStale();
    const name = materialName(d.material);
    const lines: string[] = [];
    if (b.claimed) {
      lines.push("BOUNTY CLAIMED TODAY.");
    } else if (b.have < b.need) {
      lines.push(`BOUNTY: ${b.target} ${b.have}/${b.need}`, `REWARD: ${b.reward} GOLD.`);
    } else {
      const gained = GameState.gainGold(b.reward);
      // only latch claimed once gold actually landed — at the cap gainGold()
      // returns 0, same MAX_GOLD edge BattleScene's steal already guards
      if (gained > 0) b.claimed = true;
      Sfx.buy();
      GameState.save();
      lines.push("BOUNTY COMPLETE!", `TAKE ${gained} GOLD.`);
    }
    if (d.done) {
      lines.push("\nDELIVERY DONE TODAY.");
    } else {
      const reward = deliveryReward(d.material, d.need);
      lines.push(
        `\nDELIVER ${d.need} ${name}`,
        `FOR ${reward.gold} GOLD${reward.bomb ? " + A BOMB" : ""}.`,
        `YOU HAVE ${GameState.inventory[d.material]}.`,
      );
      if (canDeliver(d)) {
        lines.push(`HAND IN ${d.need} ${name}?`);
        this.dialogue.ask(lines, "BOUNTY BOARD", ["YES", "NO"], (i) => {
          if (i === 0) this.handInDelivery(d);
        });
        return;
      }
    }
    this.dialogue.start(lines, "BOUNTY BOARD");
  }

  // the board's YES: paid first, then the pieces go (delivery.ts deliver())
  private handInDelivery(d: DeliveryState): void {
    const name = materialName(d.material);
    const paid = deliver(d);
    if (!paid) {
      this.dialogue.start(["YOUR PURSE IS FULL.", "COME BACK WITH ROOM."], "BOUNTY BOARD");
      return;
    }
    Sfx.buy();
    GameState.save();
    this.dialogue.start([`DELIVERED ${d.need} ${name}!`, `TAKE ${paid.gold} GOLD${paid.bomb ? " AND A BOMB" : ""}.`], "BOUNTY BOARD");
  }

  // A treasure map's dig gets the grace a fight's return does, so a roamer
  // can't drag the hero into a fight before the toast that says what came
  // out has been read (the fields' holdFights, for their chests too).
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
    // only while the hero walks, as in the fields: stood in the tall grass
    // (over a treasure map, deciding the way) a fight still came every ~6s
    if (!moving) return;
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
    // No warning signpost by each zone any more: the clump of tall grass and
    // the monsters wandering in it say it, and the slime hunt's meadows are
    // on the minimap and the guide arrow.
    for (const zone of MONSTER_ZONES) {
      const kind: "slime" | "wolf" = zone.kind === "wolf" ? "wolf" : "slime";
      for (let i = 0; i < zone.count; i++) {
        const x = zone.cx + (Math.random() - 0.5) * zone.w * 0.6;
        const y = zone.cy + (Math.random() - 0.5) * zone.h * 0.6;
        const golden = kind === "slime" && Math.random() < GOLDEN_SLIME_CHANCE;
        const roamerKind: Roamer["kind"] = golden ? "goldSlime" : kind;
        const sprite = this.roamerGroup.create(x, y, roamerKind) as Phaser.Physics.Arcade.Sprite;
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

    // Only once the KING SLIME is down: sim:battle --boss TROLL has a new
    // hero (Lv1-3, no gear, no companion) winning 0-3% (90% takes Lv4 with a
    // WOLF, Lv6 alone), and the giant could stand in the slime hunt's own
    // meadows, so a first hour could neither dodge it nor win and lost half
    // its gold.
    if (GameState.quest.bossDefeated && Math.random() < TROLL_KING_SPAWN_CHANCE) {
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
    if (toast) showToast(this, "A NIGHT WISP EMERGES!", STATUS_HUD_TOAST_Y);
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
    encounterOut(this.cameras.main, 300, () => {
      const roll = Math.random();
      const kind = enemy ?? (roll < 0.4 ? "slime" : roll < 0.75 ? "goblin" : "wolf");
      this.scene.start("Battle", { enemy: kind, from: "Town" });
    });
  }
}
