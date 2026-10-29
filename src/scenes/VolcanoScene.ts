import Phaser from "phaser";
import { ACHIEVEMENTS, announceLooks, claimAchievements } from "../achievements";
import { Sfx, VOLCANO_THEME } from "../audio";
import { GAME_WIDTH } from "../config";
import { encounterOut } from "../fx";
import { GameState, isNight, onSaved } from "../gameState";
import {
  buildVolcano,
  escapeFromZones,
  T_ASH,
  T_LAVA_A,
  T_LAVA_B,
  TILE,
  VOLCANO_ENTRY,
  VOLCANO_H,
  VOLCANO_TREASURE_POS,
  VOLCANO_W,
  VOLCANO_ZONES,
} from "../levels";
import { ENEMIES } from "../monsters";
import { addGroundShadow, FIELD_TOAST_Y, retroStyle, showToast } from "../pixelart";
import {
  addBorderDressing,
  addTownExitSign,
  boundCameraToMap,
  buildTileLayers,
  createWalkAnimations,
  FieldKeys,
  FieldPanels,
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
import { addHelpPopup } from "../ui/HelpPopup";
import { placeHeroGear } from "../ui/HeroGear";
import { InventoryUI } from "../ui/InventoryUI";
import { Minimap } from "../ui/Minimap";
import { lightsOverTiles, NIGHT_ENCOUNTER_MULT, NightOverlay } from "../ui/NightOverlay";
import { QuestLog } from "../ui/QuestLog";
import { SettingsUI } from "../ui/SettingsUI";
import { STATUS_HUD_HEIGHT, StatusHud } from "../ui/StatusHud";
import { isTouchDevice, TouchControls } from "../ui/TouchControls";
import { TreasureDigger } from "../ui/TreasureDig";
import { weatherToday } from "../weather";

type LastMove = "down" | "up" | "right" | "left";
type VolcanoKind = "magmaSlime" | "fireImp" | "salamander" | "flameDrake";

const ENCOUNTER_COOLDOWN = 600;
const ENTRY_GRACE = 1200;
const MAX_COOLDOWN_STEP = 50;
const EXIT_SAFE_RADIUS_X = TILE * 2;
const EXIT_SAFE_RADIUS_Y = TILE * 2.5;
// lava churns slower than water ripples (WATER_ANIM_DELAY is 400)
const LAVA_ANIM_DELAY = 700;

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
  kind: VolcanoKind;
}

const IDLE_TEXTURE: Record<LastMove, string> = {
  down: "hero-idle-down",
  up: "hero-idle-up",
  right: "hero-idle-right",
  left: "hero-idle-left",
};

// The last region, past the GLACIER GOLEM: same skeleton as SnowScene (roamer
// zones, chests, an exit back to town, a boss that roams its own corner) on
// the volcano's own ash/lava/basalt tiles rather than tinted grass.
export class VolcanoScene extends Phaser.Scene {
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
  private exitingVolcano = false;
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
  private unsubSaved: () => void = () => {};
  // claims achievements at most once per second so ones earned here (the
  // boss kill) toast on return from battle instead of back in town
  private achievementCheckAccum = 0;
  // true while an achievement save is in flight, so the onSaved "SAVED" toast
  // doesn't clobber the "ACHIEVEMENT: ...!" toast on the same shared text
  // object (showToast reuses one per scene)
  private suppressSavedToast = false;

  private hud!: StatusHud;
  private minimap!: Minimap;
  private panels!: FieldPanels;
  private dialogue!: DialogueBox;
  private night!: NightOverlay;
  private touch?: TouchControls;

  constructor() {
    super("Volcano");
  }

  create(data?: { fromBattle?: boolean }): void {
    // back from a fight (takeFightSpot): where it began, and none of an
    // arrival's title, caption or wait for the TOWN tag
    const back = takeFightSpot(this, data);
    Sfx.playBgm(VOLCANO_THEME);
    this.roamers = [];
    // same entry grace as every other area, so a zone near the entry can't
    // start a fight on the first frame
    this.encounterCooldown = ENTRY_GRACE;
    this.lastMove = "down";
    this.exitingVolcano = false;
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

    const level = buildVolcano();
    this.level = level;
    // ash under the basalt boulders, not grass; no tint, the tiles carry
    // their own colour
    const layers = buildTileLayers(this, level, { ground: T_ASH });
    addBorderDressing(this, level, undefined, [VOLCANO_ENTRY, { x: VOLCANO_ENTRY.x - 2 * TILE, y: VOLCANO_ENTRY.y }]);
    this.layer = layers.terrain;
    this.objectLayer = layers.objects;

    this.physics.world.setBounds(0, 0, VOLCANO_W * TILE, VOLCANO_H * TILE);

    if (!back) {
      const title = this.add
        .text(GAME_WIDTH / 2, STATUS_HUD_HEIGHT + 24, "VOLCANO", retroStyle(8, "#fb923c"))
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(95);
      fadeAreaTitle(this, title);
    }

    const at = back ?? { x: VOLCANO_ENTRY.x, y: VOLCANO_ENTRY.y + TILE * 2 };
    this.player = this.physics.add.sprite(at.x, at.y, "hero-idle-down");
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    this.player.body?.setSize(40, 32).setOffset(12, 32);
    // lava collides on the terrain layer, the basalt on the object layer
    this.physics.add.collider(this.player, this.layer);
    this.physics.add.collider(this.player, this.objectLayer);

    // Step clear of every monster zone on entry, the same as the cave.
    this.escapeMonsterZone();

    this.playerShadow = addGroundShadow(this, this.player);
    this.companionFollower = new CompanionSprite(this, this.player.x, this.player.y);
    // treasure maps to this region: the glint over each X, and Z to dig
    new TreasureDigger(this, "volcano", this.player, {
      toastY: FIELD_TOAST_Y,
      ownKey: true,
      blocked: () => this.quitting || this.fieldKeys.leaving() || this.uiBlocking(),
      dug: () => this.holdFights(),
    });

    this.weaponOverlay = this.add.sprite(this.player.x, this.player.y, "equip-sword").setDepth(11).setVisible(false);
    this.shieldOverlay = this.add.sprite(this.player.x, this.player.y, "equip-shield").setDepth(11).setVisible(false);

    createWalkAnimations(this);

    addFootsteps(this, this.player, level, "volcano");
    addGuideArrow(this, this.player, "volcano", () => this.quitting || this.uiBlocking());

    // embers and ash on the crater's updraft with a faint heat shimmer, and
    // ash raining down on ashfall days; caption names the day's weather
    addAmbient(this, "volcano", { caption: true, since: back?.weather });

    this.spawnMonsters();

    this.spawnTreasures();

    this.physics.add.overlap(this.player, this.roamerGroup, (_p, roamer) => {
      // nor on the way to the title, which would then race the battle's fade
      if (this.encounterCooldown > 0 || this.uiBlocking() || this.quitting) return;
      const r = this.roamers.find((r) => r.sprite === roamer);
      // BattleScene.runBattle() already plays the boss fanfare for the boss
      // enemy; playing it here too would sound it twice.
      this.startBattle(r?.kind ?? "magmaSlime");
    });

    const exit = this.add.zone(VOLCANO_ENTRY.x, VOLCANO_ENTRY.y, TILE * 2, TILE * 2);
    this.physics.add.existing(exit);
    this.physics.add.overlap(this.player, exit, () => {
      if (!this.exitingVolcano) this.exitVolcano();
    });
    addTownExitSign(this, this.player, VOLCANO_ENTRY.x, VOLCANO_ENTRY.y, !back);

    startWaterAnimation(this, this.layer, [[T_LAVA_A, T_LAVA_B]], LAVA_ANIM_DELAY);

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    boundCameraToMap(this, VOLCANO_W * TILE, VOLCANO_H * TILE);

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
      "BEWARE THE FLAME DRAKE!",
      () => this.uiBlocking() || this.quitting || this.fieldKeys.leaving(),
    );

    // exit + unopened chests; the drake's crater is deliberately not marked
    this.minimap = new Minimap(this, level, this.player, [
      { x: VOLCANO_ENTRY.x, y: VOLCANO_ENTRY.y, color: 0xffd166 },
      ...VOLCANO_TREASURE_POS.filter((t) => !GameState.openedTreasures.includes(t.id)).map((t) => ({
        x: t.x,
        y: t.y,
        color: 0xfde047,
      })),
    ]);

    // a smoke haze by day, a full night on top of it
    this.night = new NightOverlay(this, 0.12, 0.4);
    // the lava glows red into the dark, swelling slowly with its own churn
    this.night.addLights(
      lightsOverTiles(level, new Set([T_LAVA_A, T_LAVA_B]), { radius: 136, color: 0xff5a1f, strength: 0.36, pulseMs: LAVA_ANIM_DELAY * 4 }),
    );

    this.panels = new FieldPanels(this, this.fieldKeys);
    this.panels.add(new InventoryUI(this), "I");
    this.panels.add(new BestiaryUI(this), "B");
    this.panels.add(new AchievementsUI(this), "A");
    this.panels.add(new QuestLog(this), "U");
    // the quit question (askQuitToTitle)
    this.dialogue = this.panels.add(new DialogueBox(this, []));
    // touch has no Q: the settings' QUIT chip runs the same save-and-quit as YES
    this.panels.add(new SettingsUI(this, () => this.quit()), "O");

    // under a panel, the quit question or the help the map's tags go and toasts wait
    whilePanelUp(this, () => this.uiBlocking());

    this.hud = new StatusHud(this);

    if (isTouchDevice()) this.touch = new TouchControls(this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      GameState.save();
      this.minimap.destroy();
      this.panels.destroy();
      this.night.destroy();
      this.companionFollower.destroy();
      help.destroy();
      this.touch?.destroy();
    });
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

    if (this.uiBlocking()) {
      this.player.setVelocity(0, 0);
      this.player.anims.stop();
      this.panels.update();
      this.updateRoamers(delta);
      return;
    }

    if (this.panels.takeOpenKey()) return;

    let vx = 0;
    let vy = 0;
    // stood still through a scene change's fade: walked on, the fight's spot
    // could land on the exit, which took the hero back to town the moment the
    // battle returned
    if (!this.exitingVolcano) {
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
    return this.panels.blocking();
  }

  // YES to the quit question, or the settings' QUIT chip on touch
  private quit(): void {
    this.quitting = true;
    saveAndQuit(this);
  }

  private exitVolcano(): void {
    if (this.exitingVolcano) return;
    this.exitingVolcano = true;
    Sfx.night();
    this.player.setVelocity(0, 0);
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("Town", { fromVolcano: true });
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
      Math.abs(this.player.x - VOLCANO_ENTRY.x) < EXIT_SAFE_RADIUS_X && Math.abs(this.player.y - VOLCANO_ENTRY.y) < EXIT_SAFE_RADIUS_Y;
    if (nearExit) return;
    const rate = 0.06 * (isNight() ? NIGHT_ENCOUNTER_MULT : 1) * (delta / 1000);
    if (Math.random() < rate) {
      this.startBattle();
    }
  }

  private escapeMonsterZone(): void {
    const spot = escapeFromZones(VOLCANO_ZONES, this.player.x, this.player.y, (tx, ty) => isWalkableCell(this.level, tx, ty));
    if (spot) this.player.setPosition(spot.x, spot.y);
  }

  private spawnMonsters(): void {
    this.roamerGroup = this.physics.add.group();
    for (const zone of VOLCANO_ZONES) {
      const isBoss = zone.count === 1;
      for (let i = 0; i < zone.count; i++) {
        const x = zone.cx + (Math.random() - 0.5) * zone.w * 0.6;
        const y = zone.cy + (Math.random() - 0.5) * zone.h * 0.6;
        const kind: VolcanoKind = isBoss ? "flameDrake" : (zone.kind ?? "magmaSlime");
        const sprite = this.roamerGroup.create(x, y, ENEMIES[kind].texture) as Phaser.Physics.Arcade.Sprite;
        sprite.setDepth(10);
        sprite.body?.setSize(40, 24).setOffset(12, 32);
        if (isBoss) sprite.setScale(1.5);
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
          scaleX: isBoss ? 1.68 : 1.12,
          scaleY: isBoss ? 1.32 : 0.88,
          duration: 280,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    }
  }

  private spawnTreasures(): void {
    for (const t of VOLCANO_TREASURE_POS) {
      const opened = GameState.openedTreasures.includes(t.id);
      addGroundShadow(this, t, { w: 40, h: 14, yOffset: 24 });
      const chest = this.add.image(t.x, t.y, opened ? "chest-open" : "chest").setDepth(9);
      if (opened) continue;
      const zone = this.add.zone(t.x, t.y, TILE, TILE);
      this.physics.add.existing(zone);
      this.physics.add.overlap(this.player, zone, () => this.openTreasure(t.id, chest));
    }
  }

  // richer than the snow field's chests, as the last region's should be:
  // more gold, and a HI-POTION where those give a POTION
  private openTreasure(id: string, chest: Phaser.GameObjects.Image): void {
    if (GameState.openedTreasures.includes(id)) return;
    GameState.openedTreasures.push(id);
    chest.setTexture("chest-open");
    this.holdFights();
    Sfx.chest();
    const gold = GameState.gainGold(25 + Math.floor(Math.random() * 26));
    let loot = "";
    const r = Math.random();
    if (r < 0.35) {
      GameState.inventory.hiPotion += 1;
      loot = " HI-POTION!";
    } else if (r < 0.6) {
      GameState.inventory.candy += 1;
      loot = " CANDY!";
    }
    if (loot) Sfx.pickup();
    const note = this.add
      .text(chest.x, chest.y - 52, `+${gold} GOLD${loot}`, retroStyle(6, "#4ade80"))
      .setOrigin(0.5)
      .setDepth(120);
    // two of the chests sit two tiles from a side wall, closer than half of
    // the widest note ("+50 GOLD HI-POTION!", 456px) — the camera can't
    // scroll past the map edge, so keep the whole note on the map
    note.setX(Phaser.Math.Clamp(note.x, note.width / 2 + 8, VOLCANO_W * TILE - note.width / 2 - 8));
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

  private startBattle(enemy?: VolcanoKind): void {
    // A fade out either way is a scene change: the exit reached while a
    // battle fades, or a roamer met while the exit fades, started both scenes
    // at once and left the town running under the battle.
    if (this.encounterCooldown > 0 || this.exitingVolcano) return; // already fading into a battle
    this.player.setVelocity(0, 0);
    this.encounterCooldown = ENCOUNTER_COOLDOWN;
    this.exitingVolcano = true;
    encounterOut(this.cameras.main, 300, () => {
      const roll = Math.random();
      const kind = enemy ?? (roll < 0.4 ? "magmaSlime" : roll < 0.75 ? "fireImp" : "salamander");
      noteFightSpot(this, { x: this.player.x, y: this.player.y, weather: weatherToday("volcano") });
      this.scene.start("Battle", { enemy: kind, from: "Volcano" });
    });
  }
}
