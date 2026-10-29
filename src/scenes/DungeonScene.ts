import Phaser from "phaser";
import { abyssOpen, abyssResume } from "../abyss";
import { DUNGEON_THEME, Sfx } from "../audio";
import { GAME_WIDTH } from "../config";
import { encounterOut } from "../fx";
import { GameState, isNight } from "../gameState";
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
import { addGroundShadow, FIELD_TOAST_Y, retroStyle } from "../pixelart";
import {
  addBorderDressing,
  addRoamer,
  addTownExitLabel,
  boundCameraToMap,
  buildTileLayers,
  createWalkAnimations,
  FieldKeys,
  FieldPanels,
  FieldToasts,
  fadeAreaTitle,
  HeroWalk,
  isWalkableCell,
  noteFightSpot,
  type Roamer,
  saveAndQuit,
  saveOnShutdown,
  startWaterAnimation,
  takeFightSpot,
  walkOut,
  wanderRoamers,
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

const ENCOUNTER_COOLDOWN = 600;
const ENTRY_GRACE = 1200;
const MAX_COOLDOWN_STEP = 50;
const EXIT_SAFE_RADIUS_X = TILE * 2;
const EXIT_SAFE_RADIUS_Y = TILE * 2.5;
// On touch the camera may sink a tile below the map's foot. Held at the
// bottom-right corner, where the ABYSS stair's pocket is, the ESC disc
// (TouchControls, screen y 628..708) sat on the stair's violet pit (y
// 636..648); a tile up the stair ends 40px above the disc, and its tag
// (x 942..1042) stays left of Z. What shows below the bottom rock row is the
// game's dark backdrop, behind the d-pad, Z and ESC.
const TOUCH_CAMERA_FOOT = TILE;
// same per-roll rarity as TownScene's GOLDEN_SLIME_CHANCE, applied to
// goblin rolls only — a dungeon-exclusive jackpot, tint-only reskin
const CURSED_GOBLIN_CHANCE = 0.08;

type CaveKind = "slime" | "goblin" | "king" | "bat" | "cursedGoblin";

export class DungeonScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private companionFollower!: CompanionSprite;
  private level: number[][] = [];
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private objectLayer!: Phaser.Tilemaps.TilemapLayer;
  private roamerGroup!: Phaser.Physics.Arcade.Group;
  private roamers: Roamer<CaveKind>[] = [];
  private encounterCooldown = 0;
  private exitingDungeon = false;

  private walk!: HeroWalk;
  private fieldKeys!: FieldKeys;
  private quitting = false;
  private toasts!: FieldToasts;

  private hud!: StatusHud;
  private minimap!: Minimap;
  private panels!: FieldPanels;
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
    this.exitingDungeon = false;
    this.quitting = false;

    // SAVED and the achievements; the first SHUTDOWN listener (FieldToasts)
    this.toasts = new FieldToasts(this, { blocked: () => this.uiBlocking() });

    const level = buildDungeon();
    this.level = level;
    // Drawn from the cave's own palettes (CAVE_SKIN in art/tilesets.ts) rather
    // than a tint over the town's, which left green trees. The floor is T_PATH
    // in the level, but is drawn as T_GRASS, which CAVE_SKIN paints as that
    // same floor: the shore transitions only run between water and grass, so
    // this is what rounds the pools' edges off instead of leaving hard
    // rectangles. Under the rock walls the ground is that floor too.
    // Walkability and the minimap keep reading `level` itself.
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

    const shadow = addGroundShadow(this, this.player);
    this.companionFollower = new CompanionSprite(this, this.player.x, this.player.y);
    // treasure maps to this region: the glint over each X, and Z to dig
    new TreasureDigger(this, "dungeon", this.player, {
      toastY: FIELD_TOAST_Y,
      ownKey: true,
      blocked: () => this.quitting || this.fieldKeys.leaving() || this.uiBlocking(),
      dug: () => this.holdFights(),
    });

    const weapon = this.add.sprite(this.player.x, this.player.y, "equip-sword").setDepth(11).setVisible(false);
    const shield = this.add.sprite(this.player.x, this.player.y, "equip-shield").setDepth(11).setVisible(false);

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
    boundCameraToMap(this, DUNGEON_W * TILE, DUNGEON_H * TILE + (isTouchDevice() ? TOUCH_CAMERA_FOOT : 0));

    this.walk = new HeroWalk(this, this.player, { shadow, companion: this.companionFollower, weapon, shield });
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
      // the king, until he falls; then the stair down, once the FLAME DRAKE
      // has opened it (abyss.ts), and where: it lies off the entrance's
      // screen; in between, the chain's current step (SEE ELDER, the
      // HUNTER's bats here). Read when the popup opens. 35 glyphs, 700px at
      // the popup's retroStyle(5), inside its 860px
      () =>
        !GameState.quest.bossDefeated
          ? "FIND THE KING!"
          : abyssOpen(GameState.quest, GameState.ngPlus)
            ? "ABYSS STAIR: FAR SOUTH-EAST CORNER"
            : objectiveLine(GameState.quest),
      () => this.uiBlocking() || this.quitting || this.fieldKeys.leaving(),
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
    // a faint blue light off the pools, shimmering slower than the lava's, and
    // the ABYSS stair glowing violet as the ABYSS's own stair down does
    // (AbyssScene). Unlit, its grey steps read as one more of the pocket's
    // boulders (mean luma 39.6 to their 41.1): a player took it for gone. In
    // the air, as the pools': the lightmap would only give back its near-black
    // pit, and would cost the cave a 3.7MB texture it has done without.
    this.night.addLights([
      ...lightsOverTiles(level, new Set([T_WATER_A, T_WATER_B]), {
        radius: 112,
        color: 0x3b82f6,
        strength: 0.18,
        pulseMs: 4200,
        air: true,
      }),
      ...(abyss ? [{ ...ABYSS_STAIRS_POS, radius: 128, color: 0x8b5cf6, strength: 0.4, pulseMs: 2400, air: true }] : []),
    ]);

    this.panels = new FieldPanels(this, this.fieldKeys);
    this.panels.add(new InventoryUI(this), "I");
    this.panels.add(new BestiaryUI(this), "B");
    this.panels.add(new AchievementsUI(this), "A");
    this.panels.add(new QuestLog(this), "U");
    // the ABYSS stair's question and the quit question (askQuitToTitle)
    this.dialogue = this.panels.add(new DialogueBox(this, []));
    // touch has no Q: the settings' QUIT chip runs the same save-and-quit as YES
    this.panels.add(new SettingsUI(this, () => this.quit()), "O");

    // under a panel, a question or the help the map's tags (TOWN, ABYSS) go, toasts wait
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
      wanderRoamers(this.roamers, delta);
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
      this.walk.halt();
      this.panels.update();
      wanderRoamers(this.roamers, delta);
      return;
    }

    if (this.panels.takeOpenKey()) return;

    // stood still through a scene change's fade: walked on, the fight's spot
    // could land on the exit or the ABYSS stair, which took the hero there
    // (the stair at B1, unasked) the moment the battle returned
    const moving = this.walk.step(this.exitingDungeon);
    wanderRoamers(this.roamers, delta);
    this.night.update();
    this.minimap.update();
    this.checkEncounter(delta, moving);
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

  private exitDungeon(): void {
    if (this.exitingDungeon) return;
    this.exitingDungeon = true;
    walkOut(this, this.player, () => this.scene.start("Town", { fromDungeon: true }));
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
    // at the map tags' 11, over the guide arrow (10.5), unlike the TOWN
    // marker's 9: from the top of the stair's row the arrow, pointing the way
    // out, sat on the tag's SS
    const label = this.add
      .text(x, y - TILE + 8, "ABYSS", retroStyle(5, "#c084fc"))
      .setOrigin(0.5, 1)
      .setStroke("#1a1028", 4)
      .setDepth(11);
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
    // a new dive, never a stale { fromBattle } replayed by Phaser
    walkOut(this, this.player, () => this.scene.start("Abyss", { start }));
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
        const kind: Exclude<CaveKind, "cursedGoblin"> = isBoss
          ? "king"
          : zone.kind === "bat"
            ? "bat"
            : Math.random() < 0.5
              ? "slime"
              : "goblin";
        // rare palette reskin, same pattern as TownScene's GOLDEN SLIME: its
        // own texture plus the bookkeeping "kind" used for battle dispatch
        const cursed = kind === "goblin" && Math.random() < CURSED_GOBLIN_CHANCE;
        const roamerKind: CaveKind = cursed ? "cursedGoblin" : kind;
        this.roamers.push(addRoamer(this, this.roamerGroup, zone, roamerKind, ENEMIES[roamerKind].texture, isBoss));
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
      // on the map, and over the ABYSS tag from the stair's chest: outlined
      .setStroke("#1a1028", 4)
      .setDepth(120);
    // 20px inside the screen: from the far corner's chest (22,14) "+30 GOLD
    // POTION!" (16 glyphs x 24px, 384px) ran 96px past its right edge
    const view = this.cameras.main.worldView;
    note.setX(Phaser.Math.Clamp(note.x, view.x + note.width / 2 + 20, view.right - note.width / 2 - 20));
    this.tweens.add({
      targets: note,
      y: note.y - 40,
      alpha: 0,
      duration: 900,
      onComplete: () => note.destroy(),
    });
    GameState.save();
  }

  private startBattle(enemy?: CaveKind): void {
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
