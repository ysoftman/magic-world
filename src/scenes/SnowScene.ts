import Phaser from "phaser";
import { ACHIEVEMENTS, claimAchievements } from "../achievements";
import { Sfx, SNOW_THEME } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { GameState, isNight, onSaved } from "../gameState";
import {
  buildSnow,
  escapeFromZones,
  SNOW_ENTRY,
  SNOW_FISH_POS,
  SNOW_H,
  SNOW_TREASURE_POS,
  SNOW_W,
  SNOW_ZONES,
  SOLID,
  T_WATER_A,
  T_WATER_B,
  TILE,
} from "../levels";
import { ENEMIES } from "../monsters";
import { retroStyle, showToast } from "../pixelart";
import { BestiaryUI } from "../ui/BestiaryUI";
import { CompanionSprite } from "../ui/CompanionSprite";
import { FishingUI } from "../ui/Fishing";
import { InventoryUI } from "../ui/InventoryUI";
import { Minimap } from "../ui/Minimap";
import { NIGHT_ENCOUNTER_MULT, NightOverlay } from "../ui/NightOverlay";
import { STATUS_HUD_HEIGHT, STATUS_HUD_TOAST_Y, StatusHud } from "../ui/StatusHud";
import { isTouchDevice, TouchControls } from "../ui/TouchControls";

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
  kind: "frostMoth" | "yeti" | "iceGolem";
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
  private weaponOverlay!: Phaser.GameObjects.Sprite;
  private shieldOverlay!: Phaser.GameObjects.Sprite;
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private fireflies!: Phaser.GameObjects.Particles.ParticleEmitter;
  private snowfall!: Phaser.GameObjects.Particles.ParticleEmitter;
  private roamerGroup!: Phaser.Physics.Arcade.Group;
  private roamers: Roamer[] = [];
  private encounterCooldown = 0;
  private exitingSnow = false;
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
  private keyZ!: Phaser.Input.Keyboard.Key;
  private zQueued = false;
  private mQueued = false;
  private tQueued = false;
  private iQueued = false;
  private bQueued = false;
  private qQueued = false;
  private quitConfirm = false;
  private quitting = false;
  private unsubSaved: () => void = () => {};
  // claims achievements at most once per second so earned-here achievements
  // (e.g. defeating a boss) toast immediately instead of waiting for the
  // player to wander back to World, the only scene that used to poll this
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
  private fishing!: FishingUI;
  private night!: NightOverlay;
  private touch?: TouchControls;

  constructor() {
    super("Snow");
  }

  create(): void {
    Sfx.playBgm(SNOW_THEME);
    this.roamers = [];
    // Every entry gets a grace period, not just a return from battle: nothing
    // locked encounters when walking into the cave or forest, and their entry
    // tiles sit near a monster zone, so at night a fight fired immediately.
    this.encounterCooldown = ENTRY_GRACE;
    this.lastMove = "down";
    this.exitingSnow = false;
    this.quitConfirm = false;
    this.quitting = false;

    // Registered before the SHUTDOWN handler below that calls GameState.save()
    // — SHUTDOWN listeners fire in registration order, so this unsubscribes
    // before that save happens and no toast gets created on a scene that's
    // already tearing down. Keep this the first SHUTDOWN listener.
    this.unsubSaved = onSaved(() => {
      if (!this.suppressSavedToast) showToast(this, "SAVED", STATUS_HUD_TOAST_Y);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubSaved());

    const level = buildSnow();
    const map = this.make.tilemap({
      data: level,
      tileWidth: TILE,
      tileHeight: TILE,
    });
    const tileset = map.addTilesetImage("tiles16", "tiles16", TILE, TILE);
    this.layer = map.createLayer(0, tileset!, 0, 0)! as Phaser.Tilemaps.TilemapLayer;
    this.layer.setCollision(Array.from(SOLID));
    this.layer.setTint(0xbfe3fc);

    this.physics.world.setBounds(0, 0, SNOW_W * TILE, SNOW_H * TILE);

    this.add
      .text((SNOW_W * TILE) / 2, STATUS_HUD_HEIGHT + 24, "SNOW FIELD", retroStyle(8, "#a5f3fc"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(95);

    this.player = this.physics.add.sprite(SNOW_ENTRY.x, SNOW_ENTRY.y + TILE * 2, "hero-idle-down");
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    this.player.body?.setSize(40, 32).setOffset(12, 32);
    this.physics.add.collider(this.player, this.layer);

    // Step clear of every monster zone on entry, the same as the cave.
    this.escapeMonsterZone();

    this.playerShadow = this.add.ellipse(this.player.x, this.player.y + 28, 40, 16, 0x000000, 0.4).setDepth(5);
    this.companionFollower = new CompanionSprite(this, this.player.x, this.player.y);

    this.weaponOverlay = this.add.sprite(this.player.x, this.player.y, "equip-sword").setDepth(11).setVisible(false);
    this.shieldOverlay = this.add.sprite(this.player.x, this.player.y, "equip-shield").setDepth(11).setVisible(false);

    const walkFrames = (dir: string): Phaser.Types.Animations.AnimationFrame[] => [0, 1, 2, 3].map((i) => ({ key: `hero-${dir}-${i}` }));

    if (!this.anims.exists("walk-down")) {
      this.anims.create({
        key: "walk-down",
        frames: walkFrames("down"),
        frameRate: 10,
        repeat: -1,
      });
    }
    if (!this.anims.exists("walk-up")) {
      this.anims.create({
        key: "walk-up",
        frames: walkFrames("up"),
        frameRate: 10,
        repeat: -1,
      });
    }
    if (!this.anims.exists("walk-right")) {
      this.anims.create({
        key: "walk-right",
        frames: walkFrames("right"),
        frameRate: 10,
        repeat: -1,
      });
    }
    if (!this.anims.exists("walk-left")) {
      this.anims.create({
        key: "walk-left",
        frames: walkFrames("left"),
        frameRate: 10,
        repeat: -1,
      });
    }

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
    this.fireflies.startFollow(this.player, 0, 0);

    // constant blizzard: screen-space flakes drifting down over everything
    // but the HUD panels
    this.snowfall = this.add.particles(0, 0, "snowflake", {
      x: { min: -20, max: GAME_WIDTH + 20 },
      y: -8,
      lifespan: 9000,
      speedY: { min: 35, max: 80 },
      speedX: { min: -25, max: 15 },
      scale: { min: 0.5, max: 1 },
      alpha: { start: 0.75, end: 0.25 },
      frequency: 55,
    });
    this.snowfall.setScrollFactor(0).setDepth(90);

    this.spawnMonsters();

    this.spawnTreasures();

    this.add.image(SNOW_FISH_POS.x, SNOW_FISH_POS.y - TILE, "sign").setDepth(9);
    this.add
      .text(SNOW_FISH_POS.x, SNOW_FISH_POS.y - TILE - 48, "ICE FISHING", retroStyle(5, "#38bdf8"))
      .setOrigin(0.5)
      .setDepth(11);
    this.fishing = new FishingUI(this);

    this.physics.add.overlap(this.player, this.roamerGroup, (_p, roamer) => {
      if (this.encounterCooldown > 0) return;
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

    this.time.addEvent({
      delay: 400,
      loop: true,
      callback: () => this.animateWater(),
    });

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setBounds(0, 0, SNOW_W * TILE, SNOW_H * TILE);

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
    this.keyEsc = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyEsc.on(Phaser.Input.Keyboard.Events.DOWN, (_k: Phaser.Input.Keyboard.Key, e: KeyboardEvent) => {
      if (!e.repeat) this.escQueued = true;
    });

    this.add
      .text(
        GAME_WIDTH - 8,
        GAME_HEIGHT - 6,
        "HJKL:MOVE  Z:FISH  I:ITEMS  B:BESTIARY  T:MAP\nS:HUD  M:MUTE  Q:QUIT  CTRL+S:SAVE  BEWARE THE GLACIER GOLEM!",
        retroStyle(6, "#a5f3fc"),
      )
      .setOrigin(1, 1)
      .setAlign("right")
      .setScrollFactor(0)
      .setDepth(100);

    // exit + unopened chests; the golem's basin is deliberately not marked
    this.minimap = new Minimap(this, level, this.player, [
      { x: SNOW_ENTRY.x, y: SNOW_ENTRY.y, color: 0xffd166 },
      { x: SNOW_FISH_POS.x, y: SNOW_FISH_POS.y, color: 0x38bdf8 },
      ...SNOW_TREASURE_POS.filter((t) => !GameState.openedTreasures.includes(t.id)).map((t) => ({
        x: t.x,
        y: t.y,
        color: 0xfde047,
      })),
    ]);

    // thin highland shade by day, a proper night on top of it
    this.night = new NightOverlay(this, 0.1, 0.45);

    this.inventory = new InventoryUI(this);
    this.bestiary = new BestiaryUI(this);

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
      this.fishing.destroy();
      this.night.destroy();
      this.snowfall.destroy();
      this.companionFollower.destroy();
      this.quitConfirmText.destroy();
      this.touch?.destroy();
    });
  }

  update(_time: number, delta: number): void {
    GameState.minutes += delta / 1000;
    this.updateStatus();

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
      // the same tick would otherwise clobber each other with only the last
      // one ever visible — batch every name earned this tick into one toast.
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

    if (this.tQueued) {
      this.tQueued = false;
      if (!this.uiBlocking()) this.minimap.toggle();
    }

    if (this.qQueued) {
      this.qQueued = false;
      this.quitConfirm = true;
      this.quitConfirmText.setText("QUIT TO TITLE? Y/N").setVisible(true);
      Sfx.error();
    }

    if (this.quitConfirm) {
      if (this.quitting) return;
      this.player.setVelocity(0, 0);
      this.player.anims.stop();
      this.dust.emitting = false;
      this.ctrlSQueued = this.mQueued = false;
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
      this.zQueued = false;
      if (this.iQueued) {
        this.iQueued = false;
        if (this.inventory.isActive()) this.inventory.close();
      }
      if (this.bQueued) {
        this.bQueued = false;
        if (this.bestiary.isActive()) this.bestiary.close();
      }
      this.player.setVelocity(0, 0);
      this.player.anims.stop();
      this.dust.emitting = false;
      this.inventory.update();
      this.bestiary.update();
      this.fishing.update();
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

    if (this.zQueued) {
      this.zQueued = false;
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
    const nightFade = this.night.update();
    this.fireflies.emitting = nightFade > 0.05;
    this.fireflies.setAlpha(nightFade);
    this.minimap.update();
    this.checkEncounter(delta);
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

  private uiBlocking(): boolean {
    return this.inventory.isActive() || this.bestiary.isActive() || this.fishing.isActive();
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

  private exitSnow(): void {
    if (this.exitingSnow) return;
    this.exitingSnow = true;
    Sfx.night();
    this.player.setVelocity(0, 0);
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("World", { fromSnow: true });
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
      Math.abs(this.player.x - SNOW_ENTRY.x) < EXIT_SAFE_RADIUS_X && Math.abs(this.player.y - SNOW_ENTRY.y) < EXIT_SAFE_RADIUS_Y;
    if (nearExit) return;
    const rate = 0.06 * (isNight() ? NIGHT_ENCOUNTER_MULT : 1) * (delta / 1000);
    if (Math.random() < rate) {
      this.startBattle();
    }
  }

  private escapeMonsterZone(): void {
    const spot = escapeFromZones(SNOW_ZONES, this.player.x, this.player.y, (tx, ty) => {
      const tile = this.layer.getTileAt(tx, ty);
      return !!tile && !SOLID.has(tile.index);
    });
    if (spot) this.player.setPosition(spot.x, spot.y);
  }

  private spawnMonsters(): void {
    this.roamerGroup = this.physics.add.group();
    for (const zone of SNOW_ZONES) {
      const isBoss = zone.count === 1;
      for (let i = 0; i < zone.count; i++) {
        const x = zone.cx + (Math.random() - 0.5) * zone.w * 0.6;
        const y = zone.cy + (Math.random() - 0.5) * zone.h * 0.6;
        const kind: Roamer["kind"] = isBoss ? "iceGolem" : (zone.kind ?? "frostMoth");
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
    const gold = 15 + Math.floor(Math.random() * 16);
    GameState.gainGold(gold);
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

  private startBattle(enemy?: "frostMoth" | "yeti" | "iceGolem"): void {
    if (this.encounterCooldown > 0) return; // already fading into a battle
    this.player.setVelocity(0, 0);
    this.encounterCooldown = ENCOUNTER_COOLDOWN;
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const roll = Math.random();
      const kind = enemy ?? (roll < 0.5 ? "frostMoth" : "yeti");
      this.scene.start("Battle", { enemy: kind, from: "Snow" });
    });
  }

  private animateWater(): void {
    this.layer.forEachTile((tile) => {
      if (tile.index === T_WATER_A) tile.index = T_WATER_B;
      else if (tile.index === T_WATER_B) tile.index = T_WATER_A;
    });
  }
}
