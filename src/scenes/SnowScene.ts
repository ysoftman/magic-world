import Phaser from "phaser";
import { Sfx, SNOW_THEME } from "../audio";
import { GAME_WIDTH } from "../config";
import { encounterOut } from "../fx";
import { GameState, isNight } from "../gameState";
import { buildSnow, escapeFromZones, SNOW_ENTRY, SNOW_FISH_POS, SNOW_H, SNOW_TREASURE_POS, SNOW_W, SNOW_ZONES, TILE } from "../levels";
import { ENEMIES } from "../monsters";
import { addGroundShadow, FIELD_TOAST_Y, retroStyle } from "../pixelart";
import {
  addBorderDressing,
  addTownExitSign,
  boundCameraToMap,
  buildTileLayers,
  createWalkAnimations,
  FieldKeys,
  FieldPanels,
  FieldToasts,
  fadeAreaTitle,
  isWalkableCell,
  noteFightSpot,
  saveAndQuit,
  saveOnShutdown,
  startWaterAnimation,
  takeFightSpot,
  whilePanelUp,
} from "../sceneCommon";
import { AchievementsUI } from "../ui/AchievementsUI";
import { addAmbient } from "../ui/Ambient";
import { BestiaryUI } from "../ui/BestiaryUI";
import { CompanionSprite } from "../ui/CompanionSprite";
import { DialogueBox } from "../ui/DialogueBox";
import { FishingUI } from "../ui/Fishing";
import { addFootsteps } from "../ui/Footsteps";
import { addGuideArrow } from "../ui/GuideArrow";
import { addHelpPopup } from "../ui/HelpPopup";
import { placeHeroGear } from "../ui/HeroGear";
import { InventoryUI } from "../ui/InventoryUI";
import { Minimap, SNOW_TILE_COLORS } from "../ui/Minimap";
import { NIGHT_ENCOUNTER_MULT, NightOverlay } from "../ui/NightOverlay";
import { QuestLog } from "../ui/QuestLog";
import { SettingsUI } from "../ui/SettingsUI";
import { STATUS_HUD_HEIGHT, StatusHud } from "../ui/StatusHud";
import { isTouchDevice, TouchControls } from "../ui/TouchControls";
import { TreasureDigger } from "../ui/TreasureDig";
import { weatherToday } from "../weather";
import { SNOW_SKIN } from "./BootScene";

// Floating text over the snow gets the same dark rim as the TOWN marker: the
// field is light enough that the light blue and green labels lost their edges.
const TEXT_STROKE = "#1a1028";

type LastMove = "down" | "up" | "right" | "left";

const ENCOUNTER_COOLDOWN = 600;
// the share of frost moths that are the snow field's jackpot, AURORA MOTH
// (monsters.ts), roaming or met in the snow alike
const AURORA_MOTH_CHANCE = 0.035;
const ENTRY_GRACE = 1200;
const MAX_COOLDOWN_STEP = 50;
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
  kind: "frostMoth" | "auroraMoth" | "yeti" | "iceGolem";
}

const IDLE_TEXTURE: Record<LastMove, string> = {
  down: "hero-idle-down",
  up: "hero-idle-up",
  right: "hero-idle-right",
  left: "hero-idle-left",
};

export class SnowScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private companionFollower!: CompanionSprite;
  private treasure!: TreasureDigger;
  private weaponOverlay!: Phaser.GameObjects.Sprite;
  private shieldOverlay!: Phaser.GameObjects.Sprite;
  private level: number[][] = [];
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private objectLayer!: Phaser.Tilemaps.TilemapLayer;
  private fireflies!: Phaser.GameObjects.Particles.ParticleEmitter;
  private roamerGroup!: Phaser.Physics.Arcade.Group;
  private roamers: Roamer[] = [];
  private encounterCooldown = 0;
  private exitingSnow = false;
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
  private keyZ!: Phaser.Input.Keyboard.Key;
  private zQueued = false;
  private quitting = false;
  private toasts!: FieldToasts;

  private hud!: StatusHud;
  private minimap!: Minimap;
  private panels!: FieldPanels;
  private dialogue!: DialogueBox;
  private fishing!: FishingUI;
  private night!: NightOverlay;
  private touch?: TouchControls;

  constructor() {
    super("Snow");
  }

  create(data?: { fromBattle?: boolean }): void {
    // Every entry (back from a fight, quit and continue) runs this same
    // instance again, fields and all: a Z queued while the last run faded
    // out would otherwise act on this run's first frame (FieldKeys: the rest).
    this.zQueued = false;
    // back from a fight (takeFightSpot): where it began, and none of an
    // arrival's title, caption or wait for the TOWN tag
    const back = takeFightSpot(this, data);
    Sfx.playBgm(SNOW_THEME);
    this.roamers = [];
    // Every entry gets a grace period, not just a return from battle: nothing
    // locked encounters when walking into the cave or forest, and their entry
    // tiles sit near a monster zone, so at night a fight fired immediately.
    this.encounterCooldown = ENTRY_GRACE;
    this.lastMove = "down";
    this.exitingSnow = false;
    this.quitting = false;

    // SAVED, the achievements and the snow's unlock tips; the first SHUTDOWN
    // listener (FieldToasts)
    this.toasts = new FieldToasts(this, { tip: "snow", blocked: () => this.uiBlocking() });

    const level = buildSnow();
    this.level = level;
    // snow-palette copies of the shared tilesets (SNOW_SKIN in art/tilesets.ts),
    // not a tint over the green ones: a tint can only darken, so the field stayed
    // green
    const layers = buildTileLayers(this, level, { skin: SNOW_SKIN });
    addBorderDressing(this, level, SNOW_SKIN, [SNOW_ENTRY, { x: SNOW_ENTRY.x - 2 * TILE, y: SNOW_ENTRY.y }]);
    this.layer = layers.terrain;
    this.objectLayer = layers.objects;

    this.physics.world.setBounds(0, 0, SNOW_W * TILE, SNOW_H * TILE);

    if (!back) {
      const title = this.add
        .text(GAME_WIDTH / 2, STATUS_HUD_HEIGHT + 24, "SNOW FIELD", retroStyle(8, "#a5f3fc"))
        .setOrigin(0.5)
        .setStroke(TEXT_STROKE, 6)
        .setScrollFactor(0)
        .setDepth(95);
      fadeAreaTitle(this, title);
    }

    const at = back ?? { x: SNOW_ENTRY.x, y: SNOW_ENTRY.y + TILE * 2 };
    this.player = this.physics.add.sprite(at.x, at.y, "hero-idle-down");
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
    this.treasure = new TreasureDigger(this, "snow", this.player, { toastY: FIELD_TOAST_Y, dug: () => this.holdFights() });

    this.weaponOverlay = this.add.sprite(this.player.x, this.player.y, "equip-sword").setDepth(11).setVisible(false);
    this.shieldOverlay = this.add.sprite(this.player.x, this.player.y, "equip-shield").setDepth(11).setVisible(false);

    createWalkAnimations(this);

    addFootsteps(this, this.player, level, "snow");
    addGuideArrow(this, this.player, "snow", () => this.quitting || this.uiBlocking());

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

    // snowfall swept by the odd gust: heavier on blizzard days, none on clear
    // ones; caption names the day's weather under the area title
    addAmbient(this, "snow", { caption: true, since: back?.weather });

    this.spawnMonsters();

    this.spawnTreasures();

    this.add.image(SNOW_FISH_POS.x, SNOW_FISH_POS.y - TILE, "sign").setDepth(9);
    this.add
      .text(SNOW_FISH_POS.x, SNOW_FISH_POS.y - TILE - 48, "ICE FISHING", retroStyle(5, "#38bdf8"))
      .setOrigin(0.5)
      .setStroke(TEXT_STROKE, 4)
      .setDepth(11);
    this.fishing = new FishingUI(this, true);

    this.physics.add.overlap(this.player, this.roamerGroup, (_p, roamer) => {
      // nor on the way to the title, which would then race the battle's fade
      if (this.encounterCooldown > 0 || this.uiBlocking() || this.quitting) return;
      const r = this.roamers.find((r) => r.sprite === roamer);
      // BattleScene.runBattle() already plays the boss fanfare for the boss
      // enemy; playing it here too would sound it twice.
      this.startBattle(r?.kind ?? "frostMoth");
    });

    const exit = this.add.zone(SNOW_ENTRY.x, SNOW_ENTRY.y, TILE * 2, TILE * 2);
    this.physics.add.existing(exit);
    this.physics.add.overlap(this.player, exit, () => {
      if (!this.exitingSnow) this.exitSnow();
    });
    addTownExitSign(this, this.player, SNOW_ENTRY.x, SNOW_ENTRY.y, !back);

    startWaterAnimation(this, this.layer);

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    boundCameraToMap(this, SNOW_W * TILE, SNOW_H * TILE);

    const kb = this.input.keyboard!;
    this.keyLeft = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keyRight = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keyUp = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyDown = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.keyH = kb.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    this.keyJ = kb.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.keyK = kb.addKey(Phaser.Input.Keyboard.KeyCodes.K);
    this.keyL = kb.addKey(Phaser.Input.Keyboard.KeyCodes.L);
    this.keyZ = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.keyZ.on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (!e.repeat) this.zQueued = true;
    });
    this.fieldKeys = new FieldKeys(this);
    const help = addHelpPopup(
      this,
      [
        ["HJKL", "MOVE"],
        ["Z", "FISH"],
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
      "BEWARE THE GLACIER GOLEM!",
      () => this.uiBlocking() || this.quitting || this.fieldKeys.leaving(),
    );

    // exit + unopened chests; the golem's basin is deliberately not marked
    this.minimap = new Minimap(
      this,
      level,
      this.player,
      [
        { x: SNOW_ENTRY.x, y: SNOW_ENTRY.y, color: 0xffd166 },
        { x: SNOW_FISH_POS.x, y: SNOW_FISH_POS.y, color: 0x38bdf8 },
        ...SNOW_TREASURE_POS.filter((t) => !GameState.openedTreasures.includes(t.id)).map((t) => ({
          x: t.x,
          y: t.y,
          color: 0xfde047,
        })),
      ],
      SNOW_TILE_COLORS,
    );

    // thin highland shade by day, a proper night on top of it
    this.night = new NightOverlay(this, 0.1, 0.45);

    this.panels = new FieldPanels(this, this.fieldKeys);
    this.panels.add(new InventoryUI(this), "I");
    this.panels.add(new BestiaryUI(this), "B");
    this.panels.add(new AchievementsUI(this), "A");
    this.panels.add(new QuestLog(this), "U");
    // the quit question (askQuitToTitle)
    this.dialogue = this.panels.add(new DialogueBox(this, []));
    // touch has no Q: the settings' QUIT chip runs the same save-and-quit as YES
    this.panels.add(new SettingsUI(this, () => this.quit()), "O");
    this.panels.add(this.fishing);

    // under a panel, the fishing hole's, the quit question or the help the
    // map's tags go, toasts wait
    whilePanelUp(this, () => this.uiBlocking());

    this.hud = new StatusHud(this);

    if (isTouchDevice()) this.touch = new TouchControls(this);

    saveOnShutdown(this, [this.minimap, this.panels, this.night, this.companionFollower, help, this.touch]);
  }

  update(_time: number, delta: number): void {
    GameState.minutes += (delta / 1000) * GameState.timeSpeed;
    this.updateStatus();

    this.toasts.update(delta);

    this.fieldKeys.takeSystemKeys(this.hud);

    this.fieldKeys.takeMapKey(this.minimap, () => this.uiBlocking());

    // saved and on the way to the title (quit): nothing else moves. The
    // roamers are kept to their boxes, as under a panel: left on their last
    // velocity they walked off across the map until the title came
    if (this.quitting) {
      this.updateRoamers(delta);
      return;
    }

    this.fieldKeys.takeQuitKey(
      this.dialogue,
      () => this.uiBlocking(),
      () => this.quit(),
    );

    // Items and the bestiary are reachable here too now; without them a low-HP
    // run through the cave or forest had no way to drink a potion outside of a
    // battle.
    if (this.uiBlocking()) {
      this.zQueued = false;
      this.player.setVelocity(0, 0);
      this.player.anims.stop();
      this.panels.update();
      this.updateRoamers(delta);
      return;
    }

    if (this.panels.takeOpenKey()) return;

    // dropped once the scene is leaving, as Q is (FieldKeys.leaving): in a
    // fight's fade a dig saved and the ice hole opened under the battle
    const zPressed = this.zQueued && !this.fieldKeys.leaving();
    this.zQueued = false;
    if (zPressed) {
      // a treasure map's X (ui/TreasureDig.ts) before the ice hole: it is the
      // nearer, smaller target and is kept 2 tiles clear of the hole
      if (this.treasure.tryDig()) return;
      const dx = this.player.x - SNOW_FISH_POS.x;
      const dy = this.player.y - SNOW_FISH_POS.y;
      if (dx * dx + dy * dy <= 120 * 120) {
        Sfx.buy();
        this.fishing.open();
        return;
      }
    }

    let vx = 0;
    let vy = 0;
    // stood still through a scene change's fade: walked on, the fight's spot
    // could land on the exit, which took the hero back to town the moment the
    // battle returned
    if (!this.exitingSnow) {
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
    const nightFade = this.night.update();
    this.fireflies.emitting = nightFade > 0.05;
    this.fireflies.setAlpha(nightFade);
    this.minimap.update();
    this.checkEncounter(delta, moving);
  }

  private updateEquipOverlays(): void {
    placeHeroGear(this.weaponOverlay, this.shieldOverlay, this.player, this.lastMove);
  }

  private uiBlocking(): boolean {
    return this.panels.blocking();
  }

  // YES to the quit question, or the settings' QUIT chip on touch
  private quit(): void {
    this.quitting = true;
    saveAndQuit(this);
  }

  private updateStatus(): void {
    this.hud.update();
  }

  private exitSnow(): void {
    if (this.exitingSnow) return;
    this.exitingSnow = true;
    Sfx.night();
    this.player.setVelocity(0, 0);
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("Town", { fromSnow: true });
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
      Math.abs(this.player.x - SNOW_ENTRY.x) < EXIT_SAFE_RADIUS_X && Math.abs(this.player.y - SNOW_ENTRY.y) < EXIT_SAFE_RADIUS_Y;
    if (nearExit) return;
    const rate = 0.06 * (isNight() ? NIGHT_ENCOUNTER_MULT : 1) * (delta / 1000);
    if (Math.random() < rate) {
      this.startBattle();
    }
  }

  private escapeMonsterZone(): void {
    const spot = escapeFromZones(SNOW_ZONES, this.player.x, this.player.y, (tx, ty) => isWalkableCell(this.level, tx, ty));
    if (spot) this.player.setPosition(spot.x, spot.y);
  }

  private spawnMonsters(): void {
    this.roamerGroup = this.physics.add.group();
    for (const zone of SNOW_ZONES) {
      const isBoss = zone.count === 1;
      for (let i = 0; i < zone.count; i++) {
        const x = zone.cx + (Math.random() - 0.5) * zone.w * 0.6;
        const y = zone.cy + (Math.random() - 0.5) * zone.h * 0.6;
        const base: Roamer["kind"] = isBoss ? "iceGolem" : (zone.kind ?? "frostMoth");
        const kind: Roamer["kind"] = base === "frostMoth" && Math.random() < AURORA_MOTH_CHANCE ? "auroraMoth" : base;
        const sprite = this.roamerGroup.create(x, y, ENEMIES[kind].texture) as Phaser.Physics.Arcade.Sprite;
        sprite.setDepth(10);
        sprite.body?.setSize(40, 24).setOffset(12, 32);
        if (kind === "iceGolem") {
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
          scaleX: kind === "iceGolem" ? 1.68 : 1.12,
          scaleY: kind === "iceGolem" ? 1.32 : 0.88,
          duration: 280,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    }
  }

  private spawnTreasures(): void {
    for (const t of SNOW_TREASURE_POS) {
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
      .setStroke(TEXT_STROKE, 4)
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
    // A fade out either way is a scene change: the exit reached while a
    // battle fades, or a roamer met while the exit fades, started both scenes
    // at once and left the town running under the battle.
    if (this.encounterCooldown > 0 || this.exitingSnow) return; // already fading into a battle
    this.player.setVelocity(0, 0);
    this.encounterCooldown = ENCOUNTER_COOLDOWN;
    this.exitingSnow = true;
    encounterOut(this.cameras.main, 300, () => {
      const roll = Math.random();
      const rolled = roll < 0.5 ? "frostMoth" : "yeti";
      const kind = enemy ?? (rolled === "frostMoth" && Math.random() < AURORA_MOTH_CHANCE ? "auroraMoth" : rolled);
      noteFightSpot(this, { x: this.player.x, y: this.player.y, weather: weatherToday("snow") });
      this.scene.start("Battle", { enemy: kind, from: "Snow" });
    });
  }
}
