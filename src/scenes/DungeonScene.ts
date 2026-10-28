import Phaser from "phaser";
import { abyssOpen, abyssResume } from "../abyss";
import { ACHIEVEMENTS, announceLooks, claimAchievements } from "../achievements";
import { DUNGEON_THEME, Sfx } from "../audio";
import { GAME_WIDTH } from "../config";
import { encounterOut } from "../fx";
import { GameState, isNight, onSaved } from "../gameState";
import {
  ABYSS_STAIRS_POS,
  buildDungeon,
  DUNGEON_ENTRY,
  DUNGEON_H,
  DUNGEON_W,
  DUNGEON_ZONES,
  escapeFromZones,
  T_GRASS,
  T_PATH,
  T_WATER_A,
  T_WATER_B,
  TILE,
  TREASURE_POS,
} from "../levels";
import { ENEMIES } from "../monsters";
import { objectiveLine } from "../objective";
import { addGroundShadow, FIELD_TOAST_Y, retroStyle, showToast } from "../pixelart";
import {
  addBorderDressing,
  addTownExitLabel,
  askQuitToTitle,
  boundCameraToMap,
  buildTileLayers,
  createWalkAnimations,
  fadeAreaTitle,
  isWalkableCell,
  noteFightSpot,
  saveAndQuit,
  startWaterAnimation,
  takeFightSpot,
  whilePanelUp,
} from "../sceneCommon";
import { AchievementsUI } from "../ui/AchievementsUI";
import { addAmbient } from "../ui/Ambient";
import { BestiaryUI } from "../ui/BestiaryUI";
import { CompanionSprite } from "../ui/CompanionSprite";
import { DialogueBox } from "../ui/DialogueBox";
import { addFootsteps } from "../ui/Footsteps";
import { addGuideArrow } from "../ui/GuideArrow";
import { addHelpPopup, helpOpen } from "../ui/HelpPopup";
import { placeHeroGear } from "../ui/HeroGear";
import { InventoryUI } from "../ui/InventoryUI";
import { CAVE_TILE_COLORS, Minimap } from "../ui/Minimap";
import { lightsOverTiles, NIGHT_ENCOUNTER_MULT, NightOverlay } from "../ui/NightOverlay";
import { QuestLog } from "../ui/QuestLog";
import { SettingsUI } from "../ui/SettingsUI";
import { STATUS_HUD_HEIGHT, StatusHud } from "../ui/StatusHud";
import { isTouchDevice, TouchControls } from "../ui/TouchControls";
import { TreasureDigger } from "../ui/TreasureDig";
import { weatherToday } from "../weather";
import { bakeAbyssStairs, STAIRS_DOWN_KEY } from "./AbyssScene";
import { CAVE_SKIN } from "./BootScene";

type LastMove = "down" | "up" | "right" | "left";

const ENCOUNTER_COOLDOWN = 600;
const ENTRY_GRACE = 1200;
const MAX_COOLDOWN_STEP = 50;
const EXIT_SAFE_RADIUS_X = TILE * 2;
const EXIT_SAFE_RADIUS_Y = TILE * 2.5;
// same per-roll rarity as TownScene's GOLDEN_SLIME_CHANCE, applied to
// goblin rolls only — a dungeon-exclusive jackpot, tint-only reskin
const CURSED_GOBLIN_CHANCE = 0.08;

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
  kind: "slime" | "goblin" | "king" | "bat" | "cursedGoblin";
}

const IDLE_TEXTURE: Record<LastMove, string> = {
  down: "hero-idle-down",
  up: "hero-idle-up",
  right: "hero-idle-right",
  left: "hero-idle-left",
};

export class DungeonScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private companionFollower!: CompanionSprite;
  private weaponOverlay!: Phaser.GameObjects.Sprite;
  private shieldOverlay!: Phaser.GameObjects.Sprite;
  private level: number[][] = [];
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private objectLayer!: Phaser.Tilemaps.TilemapLayer;
  private roamerGroup!: Phaser.Physics.Arcade.Group;
  private roamers: Roamer[] = [];
  private encounterCooldown = 0;
  private exitingDungeon = false;
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
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyM!: Phaser.Input.Keyboard.Key;
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
  // claims achievements at most once per second so earned-here achievements
  // (e.g. defeating a boss) toast immediately instead of waiting for the
  // player to wander back to Town, the only scene that used to poll this
  private achievementCheckAccum = 0;
  // true while an achievement save is in flight, so the onSaved "SAVED" toast
  // doesn't clobber the "ACHIEVEMENT: ...!" toast on the same shared text
  // object (showToast reuses one per scene)
  private suppressSavedToast = false;

  private hud!: StatusHud;
  private minimap!: Minimap;
  private inventory!: InventoryUI;
  private bestiary!: BestiaryUI;
  private achievementsUI!: AchievementsUI;
  private questLog!: QuestLog;
  private settingsUI!: SettingsUI;
  // the ABYSS stair's question (checkpoint or B1); nothing else talks here
  private dialogue!: DialogueBox;
  private night!: NightOverlay;
  private touch?: TouchControls;

  constructor() {
    super("Dungeon");
  }

  create(data?: { fromBattle?: boolean }): void {
    // back from a fight (takeFightSpot): where it began, and none of an
    // arrival's title, caption or wait for the TOWN tag
    const back = takeFightSpot(this, data);
    Sfx.playBgm(DUNGEON_THEME);
    this.roamers = [];
    // Every entry gets a grace period, not just a return from battle: nothing
    // locked encounters when walking into the cave or forest, and their entry
    // tiles sit near a monster zone, so at night a fight fired immediately.
    this.encounterCooldown = ENTRY_GRACE;
    this.lastMove = "down";
    this.exitingDungeon = false;
    this.quitting = false;

    // Registered before the SHUTDOWN handler below that calls GameState.save()
    // — SHUTDOWN listeners fire in registration order, so this unsubscribes
    // before that save happens and no toast gets created on a scene that's
    // already tearing down. Keep this the first SHUTDOWN listener.
    // Not over an open panel: an equip, a potion or a companion picked there
    // is already reported on the panel's own message line, and this toast
    // (y 176..200) landed on the bag's MATERIALS header or its first rows.
    this.unsubSaved = onSaved(() => {
      if (!this.suppressSavedToast && !this.uiBlocking()) showToast(this, "SAVED", FIELD_TOAST_Y);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubSaved());

    const level = buildDungeon();
    this.level = level;
    // Drawn from the cave's own palettes (BootScene's CAVE_SKIN) rather than a
    // tint over the town's, which left green trees. The floor is T_PATH in the
    // level, but is drawn as T_GRASS, which CAVE_SKIN paints as that same floor:
    // the shore transitions only run between water and grass, so this is what
    // rounds the pools' edges off instead of leaving hard rectangles. Under
    // the rock walls the ground is that floor too. Walkability and the minimap
    // keep reading `level` itself.
    const floorView = level.map((row) => row.map((tile) => (tile === T_PATH ? T_GRASS : tile)));
    const layers = buildTileLayers(this, floorView, { ground: T_GRASS, skin: CAVE_SKIN });
    // the rock walls, thickened; clear of the cave mouth
    addBorderDressing(this, floorView, CAVE_SKIN, [DUNGEON_ENTRY]);
    this.layer = layers.terrain;
    this.objectLayer = layers.objects;

    this.physics.world.setBounds(0, 0, DUNGEON_W * TILE, DUNGEON_H * TILE);

    if (!back) {
      const title = this.add
        .text(GAME_WIDTH / 2, STATUS_HUD_HEIGHT + 24, "THE CAVE", retroStyle(8, "#ffd166"))
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(95);
      fadeAreaTitle(this, title);
    }

    addGroundShadow(this, DUNGEON_ENTRY, { w: 104, h: 24, yOffset: 56 });
    this.add.image(DUNGEON_ENTRY.x, DUNGEON_ENTRY.y, "cave").setDepth(9);

    const at = back ?? { x: DUNGEON_ENTRY.x, y: DUNGEON_ENTRY.y + TILE * 2 };
    this.player = this.physics.add.sprite(at.x, at.y, "hero-idle-down");
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    this.player.body?.setSize(40, 32).setOffset(12, 32);
    // Both layers: every tree — the whole map border included — moved to the
    // object layer and carries its collision there, not on the ground.
    this.physics.add.collider(this.player, this.layer);
    this.physics.add.collider(this.player, this.objectLayer);

    // The entry spawn sits inside the bat zone, so step clear of every zone
    // on any entry — not just when coming back from a battle, which is what
    // made walking into the cave start a fight straight away.
    this.escapeMonsterZone();

    this.playerShadow = addGroundShadow(this, this.player);
    this.companionFollower = new CompanionSprite(this, this.player.x, this.player.y);
    // treasure maps to this region: the glint over each X, and Z to dig
    new TreasureDigger(this, "dungeon", this.player, {
      toastY: FIELD_TOAST_Y,
      ownKey: true,
      blocked: () => this.quitting || this.uiBlocking(),
      dug: () => this.holdFights(),
    });

    this.weaponOverlay = this.add.sprite(this.player.x, this.player.y, "equip-sword").setDepth(11).setVisible(false);
    this.shieldOverlay = this.add.sprite(this.player.x, this.player.y, "equip-shield").setDepth(11).setVisible(false);

    createWalkAnimations(this);

    addFootsteps(this, this.player, level, "dungeon");
    addGuideArrow(this, this.player, "dungeon", () => this.quitting || this.uiBlocking());

    // floating dust motes and the odd drip from the ceiling
    addAmbient(this, "dungeon");

    this.spawnMonsters();

    this.spawnTreasures();

    // the stair down to the ABYSS (abyss.ts), once the FLAME DRAKE has fallen
    const abyss = abyssOpen(GameState.quest, GameState.ngPlus);
    if (abyss) this.addAbyssStairs();

    this.physics.add.overlap(this.player, this.roamerGroup, (_p, roamer) => {
      // nor on the way to the title, which would then race the battle's fade
      if (this.encounterCooldown > 0 || this.uiBlocking() || this.quitting) return;
      // cramped zones can overlap the player with more than one roamer on
      // the same tick; always let the rare one win the tie instead of
      // whichever roamer the physics engine happened to report first
      // (same fix as TownScene's troll/goldSlime tie-break). Filtered on
      // overlap too, not just kind — more than one cursed goblin can spawn,
      // and a non-overlapping one shouldn't shadow the real match below.
      const cursed = this.roamers.find((r) => r.kind === "cursedGoblin" && this.physics.overlap(this.player, r.sprite));
      const r = cursed ?? this.roamers.find((r) => r.sprite === roamer);
      // BattleScene.runBattle() already plays the boss fanfare for the boss
      // enemy; playing it here too would sound it twice.
      this.startBattle(r?.kind ?? "slime");
    });

    const exit = this.add.zone(DUNGEON_ENTRY.x, DUNGEON_ENTRY.y, TILE * 2, TILE * 2);
    this.physics.add.existing(exit);
    this.physics.add.overlap(this.player, exit, () => {
      if (!this.exitingDungeon) this.exitDungeon();
    });
    addTownExitLabel(this, DUNGEON_ENTRY.x, DUNGEON_ENTRY.y, !back);

    startWaterAnimation(this, this.layer);

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    boundCameraToMap(this, DUNGEON_W * TILE, DUNGEON_H * TILE);

    const kb = this.input.keyboard!;
    this.keyLeft = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keyRight = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keyUp = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyDown = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.keyH = kb.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    this.keyJ = kb.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.keyK = kb.addKey(Phaser.Input.Keyboard.KeyCodes.K);
    this.keyL = kb.addKey(Phaser.Input.Keyboard.KeyCodes.L);
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyS.on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (e.ctrlKey) this.ctrlSQueued = true;
      else this.sQueued = true;
    });
    this.keyM = kb.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.keyM.on(Phaser.Input.Keyboard.Events.DOWN, () => {
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
      // the king, until he falls; then the stair down, once the FLAME DRAKE
      // has opened it (abyss.ts); in between, the chain's current step
      // (SEE ELDER, the HUNTER's bats here). Read when the popup opens
      () =>
        !GameState.quest.bossDefeated
          ? "FIND THE KING!"
          : abyssOpen(GameState.quest, GameState.ngPlus)
            ? "THE ABYSS STAIR IS OPEN!"
            : objectiveLine(GameState.quest),
      () => this.uiBlocking() || this.quitting,
    );

    // exit + unopened chests (+ the ABYSS stair); the king's lair is
    // deliberately not marked
    this.minimap = new Minimap(
      this,
      level,
      this.player,
      [
        { x: DUNGEON_ENTRY.x, y: DUNGEON_ENTRY.y, color: 0xffd166 },
        ...TREASURE_POS.filter((t) => !GameState.openedTreasures.includes(t.id)).map((t) => ({
          x: t.x,
          y: t.y,
          color: 0xfde047,
        })),
        ...(abyss ? [{ ...ABYSS_STAIRS_POS, color: 0xc084fc }] : []),
      ],
      CAVE_TILE_COLORS,
    );

    // the cave is dim whatever the hour; night just deepens it
    this.night = new NightOverlay(this, 0.35, 0.25);
    // a faint blue light off the pools, shimmering slower than the lava's
    this.night.addLights(
      lightsOverTiles(level, new Set([T_WATER_A, T_WATER_B]), { radius: 112, color: 0x3b82f6, strength: 0.18, pulseMs: 4200 }),
    );

    this.inventory = new InventoryUI(this);
    this.bestiary = new BestiaryUI(this);
    this.achievementsUI = new AchievementsUI(this);
    this.questLog = new QuestLog(this);
    // the ABYSS stair's question and the quit question (askQuitToTitle)
    this.dialogue = new DialogueBox(this, []);
    // touch has no Q: the settings' QUIT chip runs the same save-and-quit as YES
    this.settingsUI = new SettingsUI(this, () => this.quit());

    // under a panel, a question or the help the map's tags (TOWN, ABYSS) go, toasts wait
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
      this.settingsUI.destroy();
      this.dialogue.destroy();
      this.night.destroy();
      this.companionFollower.destroy();
      help.destroy();
      this.touch?.destroy();
    });
  }

  update(_time: number, delta: number): void {
    GameState.minutes += (delta / 1000) * GameState.timeSpeed;
    this.updateStatus();

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

    // Items and the bestiary are reachable here too now; without them a low-HP
    // run through the cave or forest had no way to drink a potion outside of a
    // battle.
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

  private updateStatus(): void {
    this.hud.update();
  }

  private exitDungeon(): void {
    if (this.exitingDungeon) return;
    this.exitingDungeon = true;
    Sfx.night();
    this.player.setVelocity(0, 0);
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("Town", { fromDungeon: true });
    });
  }

  // The ABYSS's stair (abyss.ts) under an "ABYSS" tag in the TOWN marker's
  // look; walking onto it starts a dive at B1, or — once a GUARDIAN has
  // fallen, or a dive was left by its stair up — asks whether to start at the
  // checkpoint or the portal instead, the deeper (abyssResume). The dive's
  // own stair up comes out at the town's cave mouth, not back here.
  private addAbyssStairs(): void {
    const { x, y } = ABYSS_STAIRS_POS;
    bakeAbyssStairs(this);
    this.add.image(x, y, STAIRS_DOWN_KEY).setDepth(3);
    const label = this.add
      .text(x, y - TILE + 8, "ABYSS", retroStyle(5, "#c084fc"))
      .setOrigin(0.5, 1)
      .setStroke("#1a1028", 4)
      .setDepth(9);
    this.tweens.add({ targets: label, y: label.y - 8, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    const stair = this.add.zone(x, y, TILE, TILE);
    this.physics.add.existing(stair);
    this.physics.add.overlap(this.player, stair, () => {
      if (this.exitingDungeon || this.uiBlocking()) return;
      this.player.setVelocity(0, 0);
      const resume = abyssResume(GameState.abyssPortal, GameState.abyssCheckpoint);
      if (!resume) {
        this.enterAbyss(1);
        return;
      }
      // Y or the first choice dives from there; N, ESC (the last choice, as
      // on any question) or the second from B1, as ever, which leaves a
      // portal waiting. Two lines of at most 27 glyphs ("A CHECKPOINT WAITS
      // AT B996.", "A PORTAL WAITS AT B999." 23) and two choices: all a touch
      // question holds (DialogueBox).
      const what = resume.portal ? "A PORTAL" : "A CHECKPOINT";
      this.dialogue.ask([`${what} WAITS AT B${resume.floor}.`, "START THERE?"], "ABYSS", [`B${resume.floor}`, "B1"], (i) =>
        this.enterAbyss(i === 0 ? resume.floor : 1),
      );
    });
  }

  private enterAbyss(start: number): void {
    this.exitingDungeon = true;
    Sfx.night();
    this.player.setVelocity(0, 0);
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      // a new dive, never a stale { fromBattle } replayed by Phaser
      this.scene.start("Abyss", { start });
    });
  }

  // A find (a chest, a treasure map's dig) gets the grace a fight's return
  // does, so a roamer can't drag the hero into a fight before the toast that
  // says what came out has been read.
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
    // only while the hero walks: stood still (by a chest, over a map, at the
    // ice hole, deciding the way) a fight still came every ~17s
    if (!moving) return;
    const nearExit =
      Math.abs(this.player.x - DUNGEON_ENTRY.x) < EXIT_SAFE_RADIUS_X && Math.abs(this.player.y - DUNGEON_ENTRY.y) < EXIT_SAFE_RADIUS_Y;
    if (nearExit) return;
    // 0.06/s, a third of the town's tall grass (0.18/s), on purpose: the cave
    // is the road to the KING SLIME, not a hunting ground, and three times the
    // fights would only drag the walk. A fight pays about the same (7.3 G to
    // 8.9), so hunting here makes ~0.45x the town's gold an hour, as meant.
    const rate = 0.06 * (isNight() ? NIGHT_ENCOUNTER_MULT : 1) * (delta / 1000);
    if (Math.random() < rate) {
      this.startBattle();
    }
  }

  private escapeMonsterZone(): void {
    const spot = escapeFromZones(DUNGEON_ZONES, this.player.x, this.player.y, (tx, ty) => isWalkableCell(this.level, tx, ty));
    if (spot) this.player.setPosition(spot.x, spot.y);
  }

  private spawnMonsters(): void {
    this.roamerGroup = this.physics.add.group();
    for (const zone of DUNGEON_ZONES) {
      const isBoss = zone.count === 1;
      for (let i = 0; i < zone.count; i++) {
        const x = zone.cx + (Math.random() - 0.5) * zone.w * 0.6;
        const y = zone.cy + (Math.random() - 0.5) * zone.h * 0.6;
        const kind: Exclude<Roamer["kind"], "cursedGoblin"> = isBoss
          ? "king"
          : zone.kind === "bat"
            ? "bat"
            : Math.random() < 0.5
              ? "slime"
              : "goblin";
        // rare palette reskin, same pattern as TownScene's GOLDEN SLIME: its
        // own texture plus the bookkeeping "kind" used for battle dispatch
        const cursed = kind === "goblin" && Math.random() < CURSED_GOBLIN_CHANCE;
        const roamerKind: Roamer["kind"] = cursed ? "cursedGoblin" : kind;
        const sprite = this.roamerGroup.create(x, y, ENEMIES[roamerKind].texture) as Phaser.Physics.Arcade.Sprite;
        sprite.setDepth(10);
        sprite.body?.setSize(40, 24).setOffset(12, 32);
        if (kind === "king") {
          sprite.setScale(1.5);
        }
        this.roamers.push({
          sprite,
          minX: zone.cx - zone.w / 2 + 8,
          maxX: zone.cx + zone.w / 2 - 8,
          minY: zone.cy - zone.h / 2 + 8,
          maxY: zone.cy + zone.h / 2 - 8,
          targetX: x,
          targetY: y,
          wait: 300 + Math.random() * 800,
          speed: (isBoss ? 40 : 56) + Math.random() * 40,
          kind: roamerKind,
        });
        this.tweens.add({
          targets: sprite,
          scaleX: kind === "king" ? 1.68 : 1.12,
          scaleY: kind === "king" ? 1.32 : 0.88,
          duration: 280,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    }
  }

  private spawnTreasures(): void {
    for (const t of TREASURE_POS) {
      const opened = GameState.openedTreasures.includes(t.id);
      addGroundShadow(this, t, { w: 40, h: 14, yOffset: 24 });
      const chest = this.add.image(t.x, t.y, opened ? "chest-open" : "chest").setDepth(9);
      if (opened) continue;
      const zone = this.add.zone(t.x, t.y, TILE, TILE);
      this.physics.add.existing(zone);
      this.physics.add.overlap(this.player, zone, () => this.openTreasure(t.id, chest));
    }
  }

  private openTreasure(id: string, chest: Phaser.GameObjects.Image): void {
    if (GameState.openedTreasures.includes(id)) return;
    GameState.openedTreasures.push(id);
    chest.setTexture("chest-open");
    this.holdFights();
    Sfx.chest();
    const gold = GameState.gainGold(15 + Math.floor(Math.random() * 16));
    let loot = "";
    const r = Math.random();
    if (r < 0.4) {
      GameState.inventory.potion += 1;
      loot = " POTION!";
    } else if (r < 0.6) {
      GameState.inventory.candy += 1;
      loot = " CANDY!";
    }
    if (loot) Sfx.pickup();
    const note = this.add
      .text(chest.x, chest.y - 52, `+${gold} GOLD${loot}`, retroStyle(6, "#ffd166"))
      .setOrigin(0.5)
      .setDepth(120);
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

  private startBattle(enemy?: Roamer["kind"]): void {
    // A fade out either way is a scene change: a battle rolled while the exit
    // or the ABYSS stair fades (no safe radius round the stair), or that stair
    // reached while a battle fades, started both scenes at once.
    if (this.encounterCooldown > 0 || this.exitingDungeon) return; // already fading into a battle
    this.player.setVelocity(0, 0);
    this.encounterCooldown = ENCOUNTER_COOLDOWN;
    this.exitingDungeon = true;
    encounterOut(this.cameras.main, 300, () => {
      const roll = Math.random();
      const kind = enemy ?? (roll < 0.35 ? "slime" : roll < 0.7 ? "goblin" : "bat");
      noteFightSpot(this, { x: this.player.x, y: this.player.y, weather: weatherToday("dungeon") });
      this.scene.start("Battle", { enemy: kind, from: "Dungeon" });
    });
  }
}
