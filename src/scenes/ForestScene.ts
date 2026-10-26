import Phaser from "phaser";
import { ACHIEVEMENTS, claimAchievements } from "../achievements";
import { FOREST_THEME, Sfx } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { GameState, isNight, onSaved } from "../gameState";
import { buildForest, escapeFromZones, FOREST_ENTRY, FOREST_H, FOREST_TREASURE_POS, FOREST_W, FOREST_ZONES, TILE } from "../levels";
import { ENEMIES } from "../monsters";
import { addGroundShadow, FIELD_TOAST_Y, retroStyle, showToast } from "../pixelart";
import {
  addBorderDressing,
  addTownExitSign,
  boundCameraToMap,
  buildTileLayers,
  createWalkAnimations,
  fadeAreaTitle,
  isWalkableCell,
  startWaterAnimation,
  whilePanelUp,
} from "../sceneCommon";
import { AchievementsUI } from "../ui/AchievementsUI";
import { addAmbient } from "../ui/Ambient";
import { BestiaryUI } from "../ui/BestiaryUI";
import { CompanionSprite } from "../ui/CompanionSprite";
import { addFootsteps } from "../ui/Footsteps";
import { addGuideArrow } from "../ui/GuideArrow";
import { addHelpPopup, helpOpen } from "../ui/HelpPopup";
import { placeHeroGear } from "../ui/HeroGear";
import { InventoryUI } from "../ui/InventoryUI";
import { FOREST_TILE_COLORS, Minimap } from "../ui/Minimap";
import { NIGHT_ENCOUNTER_MULT, NightOverlay } from "../ui/NightOverlay";
import { QuestLog } from "../ui/QuestLog";
import { SettingsUI } from "../ui/SettingsUI";
import { STATUS_HUD_HEIGHT, StatusHud } from "../ui/StatusHud";
import { isTouchDevice, TouchControls } from "../ui/TouchControls";
import { TreasureDigger } from "../ui/TreasureDig";
import { seasonSkin } from "./BootScene";

type LastMove = "down" | "up" | "right" | "left";

const ENCOUNTER_COOLDOWN = 600;
const ENTRY_GRACE = 1200;
const MAX_COOLDOWN_STEP = 50;
// long enough for the SAVED confirmation to be readable before the title
const QUIT_SAVE_DELAY = 700;
const EXIT_SAFE_RADIUS_X = TILE * 2;
const EXIT_SAFE_RADIUS_Y = TILE * 2.5;

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
  kind: "wasp" | "spider" | "orc" | "mossGolem";
}

const IDLE_TEXTURE: Record<LastMove, string> = {
  down: "hero-idle-down",
  up: "hero-idle-up",
  right: "hero-idle-right",
  left: "hero-idle-left",
};

export class ForestScene extends Phaser.Scene {
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
  private exitingForest = false;
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
  private quitConfirm = false;
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
  private yQueued = false;
  private nQueued = false;
  private escQueued = false;
  private keyY!: Phaser.Input.Keyboard.Key;
  private keyN!: Phaser.Input.Keyboard.Key;
  private keyEsc!: Phaser.Input.Keyboard.Key;
  private quitConfirmText!: Phaser.GameObjects.Text;

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
    super("Forest");
  }

  create(): void {
    Sfx.playBgm(FOREST_THEME);
    this.roamers = [];
    // Every entry gets a grace period, not just a return from battle: nothing
    // locked encounters when walking into the cave or forest, and their entry
    // tiles sit near a monster zone, so at night a fight fired immediately.
    this.encounterCooldown = ENTRY_GRACE;
    this.lastMove = "down";
    this.exitingForest = false;
    this.quitConfirm = false;
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

    const level = buildForest();
    this.level = level;
    // forest-palette copies of the shared tilesets (BootScene's FOREST_SKIN)
    // rather than a tint over the town's grass, which only ever darkened it;
    // in autumn and winter the season's (seasonSkin)
    const layers = buildTileLayers(this, level, { skin: seasonSkin("forest") });
    // the wall of trees round the glade, thickened; clear of the way out and its sign
    addBorderDressing(this, level, seasonSkin("forest"), [FOREST_ENTRY, { x: FOREST_ENTRY.x - 2 * TILE, y: FOREST_ENTRY.y }]);
    this.layer = layers.terrain;
    this.objectLayer = layers.objects;

    this.physics.world.setBounds(0, 0, FOREST_W * TILE, FOREST_H * TILE);

    const title = this.add
      .text(GAME_WIDTH / 2, STATUS_HUD_HEIGHT + 24, "THE FOREST", retroStyle(8, "#4ade80"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(95);
    fadeAreaTitle(this, title);

    this.player = this.physics.add.sprite(FOREST_ENTRY.x, FOREST_ENTRY.y + TILE * 2, "hero-idle-down");
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    this.player.body?.setSize(40, 32).setOffset(12, 32);
    // Both layers: every tree — the whole map border included — moved to the
    // object layer and carries its collision there, not on the ground.
    this.physics.add.collider(this.player, this.layer);
    this.physics.add.collider(this.player, this.objectLayer);

    // Step clear of every monster zone on entry, the same as the cave.
    this.escapeMonsterZone();

    this.playerShadow = addGroundShadow(this, this.player);
    this.companionFollower = new CompanionSprite(this, this.player.x, this.player.y);
    // treasure maps to this region: the glint over each X, and Z to dig
    new TreasureDigger(this, "forest", this.player, {
      toastY: FIELD_TOAST_Y,
      ownKey: true,
      blocked: () => this.quitConfirm || this.uiBlocking(),
    });

    this.weaponOverlay = this.add.sprite(this.player.x, this.player.y, "equip-sword").setDepth(11).setVisible(false);
    this.shieldOverlay = this.add.sprite(this.player.x, this.player.y, "equip-shield").setDepth(11).setVisible(false);

    createWalkAnimations(this);

    addFootsteps(this, this.player, level, "forest");
    addGuideArrow(this, this.player, "forest", () => this.quitConfirm || this.uiBlocking());

    // falling leaves by day, fireflies by night, rain on wet days; caption
    // names the day's weather under the area title
    addAmbient(this, "forest", { caption: true });

    this.spawnMonsters();

    this.spawnTreasures();

    this.physics.add.overlap(this.player, this.roamerGroup, (_p, roamer) => {
      // nor under the quit prompt, whose Y would then race the battle's fade
      if (this.encounterCooldown > 0 || this.uiBlocking() || this.quitConfirm) return;
      const r = this.roamers.find((r) => r.sprite === roamer);
      // BattleScene.runBattle() already plays the boss fanfare for the boss
      // enemy; playing it here too would sound it twice.
      this.startBattle(r?.kind ?? "wasp");
    });

    const exit = this.add.zone(FOREST_ENTRY.x, FOREST_ENTRY.y, TILE * 2, TILE * 2);
    this.physics.add.existing(exit);
    this.physics.add.overlap(this.player, exit, () => {
      if (!this.exitingForest) this.exitForest();
    });
    addTownExitSign(this, this.player, FOREST_ENTRY.x, FOREST_ENTRY.y);

    startWaterAnimation(this, this.layer);

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    boundCameraToMap(this, FOREST_W * TILE, FOREST_H * TILE);

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
    // only while the quit prompt is up: a Y pressed earlier would otherwise
    // sit queued and answer the next prompt the moment it opens
    this.keyY = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Y);
    this.keyY.on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (this.quitConfirm && !e.repeat) this.yQueued = true;
    });
    this.keyN = kb.addKey(Phaser.Input.Keyboard.KeyCodes.N);
    this.keyN.on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (this.quitConfirm && !e.repeat) this.nQueued = true;
    });
    this.keyEsc = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyEsc.on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (this.quitConfirm && !e.repeat) this.escQueued = true;
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
      "FIND THE MOSS GOLEM!",
      () => this.uiBlocking() || this.quitConfirm,
    );

    // exit + unopened chests; the golem's clearing is deliberately not marked
    this.minimap = new Minimap(
      this,
      level,
      this.player,
      [
        { x: FOREST_ENTRY.x, y: FOREST_ENTRY.y, color: 0xffd166 },
        ...FOREST_TREASURE_POS.filter((t) => !GameState.openedTreasures.includes(t.id)).map((t) => ({
          x: t.x,
          y: t.y,
          color: 0xfde047,
        })),
      ],
      FOREST_TILE_COLORS,
    );

    // canopy shade all day, and a proper night on top of it
    this.night = new NightOverlay(this, 0.15, 0.4);

    this.inventory = new InventoryUI(this);
    this.bestiary = new BestiaryUI(this);
    this.achievementsUI = new AchievementsUI(this);
    this.questLog = new QuestLog(this);
    // touch has no Q: the settings' QUIT chip runs the same save-and-quit as Y
    this.settingsUI = new SettingsUI(this, () => {
      this.quitConfirm = this.yQueued = true;
      this.quitConfirmText.setVisible(true);
    });

    // under a panel or the help the map's tags go, toasts wait
    whilePanelUp(this, () => this.uiBlocking());

    this.hud = new StatusHud(this);

    if (isTouchDevice()) this.touch = new TouchControls(this);

    this.quitConfirmText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "", retroStyle(8, "#ff5555"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(300)
      .setVisible(false);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      GameState.save();
      this.minimap.destroy();
      this.inventory.destroy();
      this.bestiary.destroy();
      this.achievementsUI.destroy();
      this.questLog.destroy();
      this.settingsUI.destroy();
      this.night.destroy();
      this.companionFollower.destroy();
      help.destroy();
      this.quitConfirmText.destroy();
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

    if (this.qQueued) {
      this.qQueued = false;
      // never over an open panel: the prompt's ESC would close that panel too
      if (!this.uiBlocking()) {
        this.quitConfirm = true;
        this.quitConfirmText.setText("QUIT TO TITLE? Y/N").setVisible(true);
        Sfx.error();
      }
    }

    if (this.quitConfirm) {
      // kept to their boxes, as under a panel: left on their last velocity
      // they walked off across the map until the prompt closed
      this.updateRoamers(delta);
      if (this.quitting) return;
      this.player.setVelocity(0, 0);
      this.player.anims.stop();
      // a panel key pressed while the prompt is up would otherwise open
      // that panel the moment the prompt is dismissed
      this.ctrlSQueued = this.mQueued = this.iQueued = this.bQueued = this.aQueued = this.uQueued = this.oQueued = this.tQueued = false;
      if (this.yQueued) {
        this.yQueued = false;
        // Save here rather than leaning on the SHUTDOWN handler: that one runs
        // after the toast subscription is torn down, so the player never sees
        // the confirmation. The SHUTDOWN save then just repeats this one.
        this.quitting = true;
        // the quit prompt itself reports the save, so drop the toast that
        // GameState.save() would otherwise stack on top of it
        this.unsubSaved();
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
    this.checkEncounter(delta);
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
      helpOpen(this)
    );
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

  private exitForest(): void {
    if (this.exitingForest) return;
    this.exitingForest = true;
    Sfx.night();
    this.player.setVelocity(0, 0);
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("Town", { fromForest: true });
    });
  }

  private checkEncounter(delta: number): void {
    if (this.encounterCooldown > 0) {
      // A scene transition hands the first frame a delta as large as the whole
      // load (~1.2s), which drained the entry grace in a single tick and
      // dropped the player straight into a fight. Clamp it to one frame.
      this.encounterCooldown -= Math.min(delta, MAX_COOLDOWN_STEP);
      return;
    }
    const nearExit =
      Math.abs(this.player.x - FOREST_ENTRY.x) < EXIT_SAFE_RADIUS_X && Math.abs(this.player.y - FOREST_ENTRY.y) < EXIT_SAFE_RADIUS_Y;
    if (nearExit) return;
    const rate = 0.06 * (isNight() ? NIGHT_ENCOUNTER_MULT : 1) * (delta / 1000);
    if (Math.random() < rate) {
      this.startBattle();
    }
  }

  private escapeMonsterZone(): void {
    const spot = escapeFromZones(FOREST_ZONES, this.player.x, this.player.y, (tx, ty) => isWalkableCell(this.level, tx, ty));
    if (spot) this.player.setPosition(spot.x, spot.y);
  }

  private spawnMonsters(): void {
    this.roamerGroup = this.physics.add.group();
    for (const zone of FOREST_ZONES) {
      const isBoss = zone.count === 1;
      for (let i = 0; i < zone.count; i++) {
        const x = zone.cx + (Math.random() - 0.5) * zone.w * 0.6;
        const y = zone.cy + (Math.random() - 0.5) * zone.h * 0.6;
        const kind: Roamer["kind"] = isBoss ? "mossGolem" : (zone.kind ?? "wasp");
        const sprite = this.roamerGroup.create(x, y, ENEMIES[kind].texture) as Phaser.Physics.Arcade.Sprite;
        sprite.setDepth(10);
        sprite.body?.setSize(40, 24).setOffset(12, 32);
        if (kind === "mossGolem") {
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
          kind,
        });
        this.tweens.add({
          targets: sprite,
          scaleX: kind === "mossGolem" ? 1.68 : 1.12,
          scaleY: kind === "mossGolem" ? 1.32 : 0.88,
          duration: 280,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    }
  }

  private spawnTreasures(): void {
    for (const t of FOREST_TREASURE_POS) {
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
      .text(chest.x, chest.y - 52, `+${gold} GOLD${loot}`, retroStyle(6, "#4ade80"))
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

  private startBattle(enemy?: "wasp" | "spider" | "orc" | "mossGolem"): void {
    if (this.encounterCooldown > 0) return; // already fading into a battle
    this.player.setVelocity(0, 0);
    this.encounterCooldown = ENCOUNTER_COOLDOWN;
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const roll = Math.random();
      const kind = enemy ?? (roll < 0.35 ? "wasp" : roll < 0.7 ? "spider" : "orc");
      this.scene.start("Battle", { enemy: kind, from: "Forest" });
    });
  }
}
