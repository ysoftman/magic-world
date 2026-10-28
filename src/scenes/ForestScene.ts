import Phaser from "phaser";
import { ACHIEVEMENTS, announceLooks, claimAchievements } from "../achievements";
import { FOREST_THEME, Sfx } from "../audio";
import { GAME_WIDTH } from "../config";
import { encounterOut } from "../fx";
import { econDay, GameState, isNight, onSaved } from "../gameState";
import { buildForest, escapeFromZones, FOREST_ENTRY, FOREST_H, FOREST_TREASURE_POS, FOREST_W, FOREST_ZONES, TILE } from "../levels";
import { ENEMIES } from "../monsters";
import { addGroundShadow, FIELD_TOAST_Y, retroStyle, showToast } from "../pixelart";
import {
  addBorderDressing,
  addTownExitSign,
  askQuitToTitle,
  boundCameraToMap,
  buildTileLayers,
  createWalkAnimations,
  FieldKeys,
  fadeAreaTitle,
  isWalkableCell,
  noteFightSpot,
  saveAndQuit,
  startWaterAnimation,
  takeFightSpot,
  whilePanelUp,
} from "../sceneCommon";
import { type Season, seasonLook, seasonToday } from "../season";
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
import { FOREST_TILE_COLORS, Minimap } from "../ui/Minimap";
import { NIGHT_ENCOUNTER_MULT, NightOverlay } from "../ui/NightOverlay";
import { QuestLog } from "../ui/QuestLog";
import { SettingsUI } from "../ui/SettingsUI";
import { STATUS_HUD_HEIGHT, StatusHud } from "../ui/StatusHud";
import { isTouchDevice, TouchControls } from "../ui/TouchControls";
import { TreasureDigger } from "../ui/TreasureDig";
import { type Weather, weatherOn, weatherToday } from "../weather";
import { seasonSkin } from "./BootScene";

type LastMove = "down" | "up" | "right" | "left";

const ENCOUNTER_COOLDOWN = 600;
// the share of wasps that are the forest's jackpot, SILVER WASP (monsters.ts),
// roaming or met in the grass alike
const SILVER_WASP_CHANCE = 0.035;
const ENTRY_GRACE = 1200;
const MAX_COOLDOWN_STEP = 50;
const EXIT_SAFE_RADIUS_X = TILE * 2;
const EXIT_SAFE_RADIUS_Y = TILE * 2.5;
// the fade out to the forest built again for a new season, a fight's length
const SEASON_FADE = 300;

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
  kind: "wasp" | "silverWasp" | "spider" | "orc" | "mossGolem";
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
  private lastMove: LastMove = "down";

  private keyLeft!: Phaser.Input.Keyboard.Key;
  private keyRight!: Phaser.Input.Keyboard.Key;
  private keyUp!: Phaser.Input.Keyboard.Key;
  private keyDown!: Phaser.Input.Keyboard.Key;
  private keyH!: Phaser.Input.Keyboard.Key;
  private keyJ!: Phaser.Input.Keyboard.Key;
  private keyK!: Phaser.Input.Keyboard.Key;
  private keyL!: Phaser.Input.Keyboard.Key;
  private fieldKeys!: FieldKeys;
  private quitting = false;
  // the season the forest was built in (or last turned to in place), and
  // the fade out to building it again once the clock moves it into another
  // look (turnSeason)
  private season: Season = "spring";
  private turningSeason = false;
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
  private dialogue!: DialogueBox;
  private night!: NightOverlay;
  private touch?: TouchControls;

  constructor() {
    super("Forest");
  }

  // `turn`: built again for a new season (turnSeason) round a hero who never
  // left: where they stood, the map as they left it and the sky they saw, and
  // none of an arrival's title, caption or step out of the monster zones
  create(data?: { turn?: { at: { x: number; y: number }; mapOpen: boolean; weather: Weather }; fromBattle?: boolean }): void {
    const turn = data?.turn;
    // back from a fight (takeFightSpot): the same, where the fight began
    const back = takeFightSpot(this, data);
    Sfx.playBgm(FOREST_THEME);
    this.roamers = [];
    // Every entry gets a grace period, not just a return from battle: nothing
    // locked encounters when walking into the cave or forest, and their entry
    // tiles sit near a monster zone, so at night a fight fired immediately.
    this.encounterCooldown = ENTRY_GRACE;
    this.lastMove = "down";
    this.exitingForest = false;
    this.quitting = false;
    this.turningSeason = false;

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
    this.season = seasonToday();
    const layers = buildTileLayers(this, level, { skin: seasonSkin("forest") });
    // the wall of trees round the glade, thickened; clear of the way out and its sign
    addBorderDressing(this, level, seasonSkin("forest"), [FOREST_ENTRY, { x: FOREST_ENTRY.x - 2 * TILE, y: FOREST_ENTRY.y }]);
    this.layer = layers.terrain;
    this.objectLayer = layers.objects;

    this.physics.world.setBounds(0, 0, FOREST_W * TILE, FOREST_H * TILE);

    if (!turn && !back) {
      const title = this.add
        .text(GAME_WIDTH / 2, STATUS_HUD_HEIGHT + 24, "THE FOREST", retroStyle(8, "#4ade80"))
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(95);
      fadeAreaTitle(this, title);
    }

    const at = turn?.at ?? back ?? { x: FOREST_ENTRY.x, y: FOREST_ENTRY.y + TILE * 2 };
    this.player = this.physics.add.sprite(at.x, at.y, "hero-idle-down");
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    this.player.body?.setSize(40, 32).setOffset(12, 32);
    // Both layers: every tree — the whole map border included — moved to the
    // object layer and carries its collision there, not on the ground.
    this.physics.add.collider(this.player, this.layer);
    this.physics.add.collider(this.player, this.objectLayer);

    // Step clear of every monster zone on entry, the same as the cave
    if (!turn) this.escapeMonsterZone();

    this.playerShadow = addGroundShadow(this, this.player);
    this.companionFollower = new CompanionSprite(this, this.player.x, this.player.y);
    // treasure maps to this region: the glint over each X, and Z to dig
    new TreasureDigger(this, "forest", this.player, {
      toastY: FIELD_TOAST_Y,
      ownKey: true,
      blocked: () => this.quitting || this.uiBlocking(),
      dug: () => this.holdFights(),
    });

    this.weaponOverlay = this.add.sprite(this.player.x, this.player.y, "equip-sword").setDepth(11).setVisible(false);
    this.shieldOverlay = this.add.sprite(this.player.x, this.player.y, "equip-shield").setDepth(11).setVisible(false);

    createWalkAnimations(this);

    addFootsteps(this, this.player, level, "forest");
    addGuideArrow(this, this.player, "forest", () => this.quitting || this.uiBlocking());

    // falling leaves by day, fireflies by night, rain on wet days; caption
    // names the day's weather under the area title (on a season's turn only
    // if the sky changed with it)
    addAmbient(this, "forest", { caption: true, since: turn?.weather ?? back?.weather });

    this.spawnMonsters();

    this.spawnTreasures();

    this.physics.add.overlap(this.player, this.roamerGroup, (_p, roamer) => {
      // nor on the way to the title, which would then race the battle's fade
      if (this.encounterCooldown > 0 || this.uiBlocking() || this.quitting) return;
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
    addTownExitSign(this, this.player, FOREST_ENTRY.x, FOREST_ENTRY.y, !turn && !back);

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
    this.fieldKeys = new FieldKeys(this);
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
      () => this.uiBlocking() || this.quitting,
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
    if (turn?.mapOpen) this.minimap.toggle();

    // canopy shade all day, and a proper night on top of it
    this.night = new NightOverlay(this, 0.15, 0.4);

    this.inventory = new InventoryUI(this);
    this.bestiary = new BestiaryUI(this);
    this.achievementsUI = new AchievementsUI(this);
    this.questLog = new QuestLog(this);
    // the quit question (askQuitToTitle)
    this.dialogue = new DialogueBox(this, []);
    // touch has no Q: the settings' QUIT chip runs the same save-and-quit as YES
    this.settingsUI = new SettingsUI(this, () => this.quit());

    // under a panel, the quit question or the help the map's tags go, toasts wait
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

    if (this.fieldKeys.take("S")) this.toggleStatus();

    if (this.fieldKeys.take("CTRL+S")) GameState.save();

    if (this.fieldKeys.take("M")) {
      const muted = Sfx.toggleMuted();
      showToast(this, muted ? "SOUND: OFF" : "SOUND: ON", FIELD_TOAST_Y);
    }

    if (this.fieldKeys.take("T") && !this.uiBlocking()) this.minimap.toggle();

    // saved and on the way to the title (quit), or fading out to the new
    // season (turnSeason): nothing else moves. The roamers are kept to their
    // boxes, as under a panel: left on their last velocity they walked off
    // across the map until the title came
    if (this.quitting || this.turningSeason) {
      this.updateRoamers(delta);
      return;
    }

    // never over an open panel: the question's ESC would close that panel too
    if (this.fieldKeys.take("Q") && !this.uiBlocking()) askQuitToTitle(this.dialogue, () => this.quit());

    // Items and the bestiary are reachable here too now; without them a low-HP
    // run through the cave or forest had no way to drink a potion outside of a
    // battle.
    if (this.uiBlocking()) {
      if (this.fieldKeys.take("I") && this.inventory.isActive()) this.inventory.close();
      if (this.fieldKeys.take("B") && this.bestiary.isActive()) this.bestiary.close();
      if (this.fieldKeys.take("A") && this.achievementsUI.isActive()) this.achievementsUI.close();
      if (this.fieldKeys.take("U") && this.questLog.isActive()) this.questLog.close();
      if (this.fieldKeys.take("O") && this.settingsUI.isActive()) this.settingsUI.close();
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

    // The clock moved the forest into a new season while the hero was in it:
    // not under a panel (above), nor on the way out or into a fight
    // (encounterCooldown covers its fade, and the entry grace). A new look of
    // the ground (seasonLook) builds the forest again; spring into summer,
    // the same ground, needs nothing (the air turns its sky itself).
    const season = seasonToday();
    if (season !== this.season && !this.exitingForest && this.encounterCooldown <= 0) {
      if (seasonLook("forest", season) !== seasonLook("forest", this.season)) {
        this.turnSeason();
        return;
      }
      this.season = season;
    }

    if (this.fieldKeys.take("I")) {
      this.inventory.open();
      return;
    }

    if (this.fieldKeys.take("B")) {
      this.bestiary.open();
      return;
    }

    if (this.fieldKeys.take("A")) {
      this.achievementsUI.open();
      return;
    }

    if (this.fieldKeys.take("U")) {
      this.questLog.open();
      return;
    }

    if (this.fieldKeys.take("O")) {
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

  // The skin, the border trees, the footprints, the air (Ambient) and the
  // minimap's colours are all picked in create(), so rather than repaint each,
  // fade out and build the forest again with the hero where they stand. The
  // roamers are rolled afresh, as after any fight.
  private turnSeason(): void {
    this.turningSeason = true;
    // the roamers still wander (update) and would start a fight on contact
    this.encounterCooldown = ENCOUNTER_COOLDOWN;
    this.player.setVelocity(0, 0);
    this.player.anims.stop();
    this.player.setTexture(IDLE_TEXTURE[this.lastMove]);
    this.cameras.main.fadeOut(SEASON_FADE, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.restart({
        // the sky as it was under the old season's odds: weatherToday() has
        // already turned with the clock
        turn: {
          at: { x: this.player.x, y: this.player.y },
          mapOpen: this.minimap.isVisible(),
          weather: weatherOn(econDay(), "forest", this.season),
        },
      });
    });
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
    // only while the hero walks: stood still (by a chest, over a map,
    // deciding the way) a fight still came every ~17s
    if (!moving) return;
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
        const base: Roamer["kind"] = isBoss ? "mossGolem" : (zone.kind ?? "wasp");
        const kind: Roamer["kind"] = base === "wasp" && Math.random() < SILVER_WASP_CHANCE ? "silverWasp" : base;
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

  private startBattle(enemy?: Roamer["kind"]): void {
    if (this.encounterCooldown > 0) return; // already fading into a battle
    this.player.setVelocity(0, 0);
    this.encounterCooldown = ENCOUNTER_COOLDOWN;
    encounterOut(this.cameras.main, 300, () => {
      const roll = Math.random();
      const rolled = roll < 0.35 ? "wasp" : roll < 0.7 ? "spider" : "orc";
      const kind = enemy ?? (rolled === "wasp" && Math.random() < SILVER_WASP_CHANCE ? "silverWasp" : rolled);
      noteFightSpot(this, { x: this.player.x, y: this.player.y, weather: weatherToday("forest") });
      this.scene.start("Battle", { enemy: kind, from: "Forest" });
    });
  }
}
