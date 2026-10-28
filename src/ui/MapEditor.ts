import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import {
  clearMapOverride,
  EDITABLE_POS,
  MAP_H,
  MAP_W,
  mapToRows,
  saveMapOverride,
  T_GRASS,
  T_HOUSE,
  T_PATH,
  T_SOIL,
  T_TALL,
  T_TREE,
  T_WATER_A,
  TILE,
} from "../levels";
import { retroStyle, showToast } from "../pixelart";
import { paintTile, type TileLayers } from "../sceneCommon";
import { closeHelp } from "./HelpPopup";
import { STATUS_HUD_TOAST_Y } from "./StatusHud";

const BRUSHES: Array<{ key: number; name: string }> = [
  { key: T_GRASS, name: "GRASS" },
  { key: T_WATER_A, name: "WATER" },
  { key: T_TREE, name: "TREE" },
  { key: T_PATH, name: "PATH" },
  { key: T_TALL, name: "TALL GRASS" },
  { key: T_HOUSE, name: "HOUSE" },
  { key: T_SOIL, name: "SOIL" },
];

const PAN_SPEED = 12;
// how close to a screen edge the cursor has to get before the camera follows it
const EDGE_MARGIN = 56;
const CURSOR_SPEED = 10;

// Prints a coordinate the way overworldMap.ts writes them, keeping whatever
// offset inside the tile the landmark started with (HOUSE_POS sits on a tile
// corner, everything else on a centre).
const coord = (v: number): string => {
  const tile = Math.floor(v / TILE);
  const off = v - tile * TILE;
  if (off === 0) return `${tile} * T`;
  if (off === TILE / 2) return `${tile} * T + T / 2`;
  return `${tile} * T + ${off}`;
};

const MAP_FILE_HEADER = `// Overworld map data — the one file that decides what the town looks like.
// Written by the in-game map editor (F2, then X applies it straight back here)
// and read by levels.ts, so swapping this file swaps the whole layout.
//
// Row legend: G grass, W water, T tree, P path, h tall grass, H house, S soil.
// Landmark coordinates are in pixels; T is one tile, kept local so this file
// imports nothing and can be replaced wholesale.
const T = ${TILE};
`;

export class MapEditor {
  private scene: Phaser.Scene;
  private layers: TileLayers;
  private level: number[][];
  private active = false;
  private mode: "tile" | "landmark" = "tile";
  private brush = 0;
  private landmark = 0;
  private names: string[];
  private onMoveLandmark: (name: string, x: number, y: number) => void;

  private panKeys: Phaser.Input.Keyboard.Key[];
  private pointerOverGame = true;
  // screen-space cursor, driven by the mouse or by HJKL — both scroll the map
  // the same way, by pushing it into a screen edge
  private cursorX = GAME_WIDTH / 2;
  private cursorY = GAME_HEIGHT / 2;
  private usingKeys = false;
  private cursor: Phaser.GameObjects.Rectangle;
  private pick: Phaser.GameObjects.Graphics;
  private spots: Phaser.GameObjects.Rectangle[] = [];
  private carrying = false;
  // anything painted or moved since the editor opened; leaving without it
  // writes no override, so a look round doesn't freeze the town to a copy
  // (and show "MAP EDITED") that later map-file changes never reach
  private dirty = false;
  private panel: Phaser.GameObjects.Rectangle;
  private info: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, layers: TileLayers, level: number[][], onMoveLandmark: (name: string, x: number, y: number) => void) {
    this.scene = scene;
    this.layers = layers;
    this.level = level;
    this.onMoveLandmark = onMoveLandmark;
    this.names = Object.keys(EDITABLE_POS);

    const kbInit = scene.input.keyboard!;
    const C = Phaser.Input.Keyboard.KeyCodes;
    // left, right, up, down — two bindings each, same order as the pan below
    this.panKeys = [C.H, C.LEFT, C.L, C.RIGHT, C.K, C.UP, C.J, C.DOWN].map((code) => kbInit.addKey(code));

    this.cursor = scene.add.rectangle(0, 0, TILE, TILE, 0xffffff, 0.15).setStrokeStyle(2, 0xffd166).setDepth(199).setVisible(false);
    // every landmark, so it is obvious in landmark mode what can be grabbed
    this.spots = this.names.map(() =>
      scene.add
        .rectangle(0, 0, TILE / 2, TILE / 2, 0x38bdf8, 0.35)
        .setStrokeStyle(1, 0xffffff, 0.8)
        .setDepth(198)
        .setVisible(false),
    );
    // the selected landmark, outlined in marching dashes so it reads as
    // "this is the one you are moving" next to the plain cursor box
    this.pick = scene.add.graphics().setDepth(199).setVisible(false);
    this.panel = scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 46, GAME_WIDTH, 92, 0x0b0b2b, 0.92)
      .setScrollFactor(0)
      .setDepth(198)
      .setVisible(false);
    this.info = scene.add
      .text(16, GAME_HEIGHT - 76, "", retroStyle(6, "#ffd166"))
      .setScrollFactor(0)
      .setDepth(199)
      .setVisible(false);
    this.hint = scene.add
      .text(
        16,
        GAME_HEIGHT - 44,
        "HJKL/MOUSE: CURSOR (EDGE SCROLLS MAP)   Z/CLICK: PAINT, PICK UP, DROP\n1-7: BRUSH   TAB: TILE/LANDMARK   X: APPLY TO MAP FILE   R: RESET   F2: LEAVE",
        retroStyle(4, "#9f9fd0"),
      )
      .setScrollFactor(0)
      .setDepth(199)
      .setVisible(false)
      .setLineSpacing(6);

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (!this.active) return;
      this.cursorX = p.x;
      this.cursorY = p.y;
      this.usingKeys = false;
      // in landmark mode, pressing on a landmark grabs it (and selects it, so
      // the bracket keys are never the only way to choose one); pressing on
      // empty ground drops whatever is selected there
      if (this.mode === "landmark") {
        const hit = this.landmarkUnderCursor();
        if (hit >= 0) {
          this.landmark = hit;
          this.carrying = true;
          showToast(this.scene, `HOLDING ${this.names[hit]}`, STATUS_HUD_TOAST_Y);
          return;
        }
      }
      this.apply();
    });
    scene.input.on(Phaser.Input.Events.POINTER_UP, () => {
      this.carrying = false;
    });
    // the pointer keeps its last position after leaving the canvas, which
    // would leave the edge pan running forever
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      this.cursorX = p.x;
      this.cursorY = p.y;
      this.usingKeys = false;
      if (this.active && this.carrying) this.apply();
    });
    scene.input.on(Phaser.Input.Events.GAME_OUT, () => {
      this.pointerOverGame = false;
    });
    scene.input.on(Phaser.Input.Events.GAME_OVER, () => {
      this.pointerOverGame = true;
    });

    const kb = scene.input.keyboard!;
    const DOWN = Phaser.Input.Keyboard.Events.DOWN;
    const K = Phaser.Input.Keyboard.KeyCodes;
    BRUSHES.forEach((_, i) => {
      kb.addKey(K.ONE + i).on(DOWN, () => {
        if (this.active) this.brush = i;
      });
    });
    kb.addKey(K.TAB).on(DOWN, () => {
      if (this.active) this.mode = this.mode === "tile" ? "landmark" : "tile";
    });
    kb.addKey(K.OPEN_BRACKET).on(DOWN, () => {
      if (this.active) this.landmark = (this.landmark + this.names.length - 1) % this.names.length;
    });
    kb.addKey(K.CLOSED_BRACKET).on(DOWN, () => {
      if (this.active) this.landmark = (this.landmark + 1) % this.names.length;
    });
    for (const code of [K.Z, K.SPACE, K.ENTER]) {
      kb.addKey(code).on(DOWN, () => {
        if (!this.active) return;
        // keyboard equivalent of the mouse drag: the first press picks up
        // whatever the cursor is on, the next one drops it where the cursor is
        if (this.mode === "landmark" && !this.carrying) {
          const hit = this.landmarkUnderCursor();
          if (hit >= 0) {
            this.landmark = hit;
            this.carrying = true;
            showToast(this.scene, `HOLDING ${this.names[hit]}`, STATUS_HUD_TOAST_Y);
            return;
          }
        }
        this.carrying = false;
        this.apply();
      });
    }
    kb.addKey(K.X).on(DOWN, () => {
      if (this.active) this.exportMap();
    });
    kb.addKey(K.R).on(DOWN, () => {
      if (!this.active) return;
      clearMapOverride();
      this.scene.scene.restart({});
    });
  }

  isActive(): boolean {
    return this.active;
  }

  toggle(): void {
    if (this.active) {
      this.close();
      return;
    }
    this.active = true;
    this.dirty = false;
    // F2 runs ahead of the scene's uiBlocking() gate, so the help popup would
    // otherwise stay up over the editor with Z painting under it
    closeHelp(this.scene);
    this.scene.cameras.main.stopFollow();
    this.cursor.setVisible(true);
    this.panel.setVisible(true);
    this.info.setVisible(true);
    this.hint.setVisible(true);
    showToast(this.scene, "MAP EDITOR ON", STATUS_HUD_TOAST_Y);
  }

  // Leaving restarts the scene so the minimap, crops, monsters and landmark
  // sprites are all rebuilt from the saved map instead of drifting from it.
  private close(): void {
    this.active = false;
    this.cursor.setVisible(false);
    this.pick.setVisible(false);
    this.carrying = false;
    for (const spot of this.spots) spot.setVisible(false);
    this.panel.setVisible(false);
    this.info.setVisible(false);
    this.hint.setVisible(false);
    if (this.dirty) saveMapOverride({ tiles: mapToRows(this.level), landmarks: structuredClone(EDITABLE_POS) });
    // {}: a restart with no data replays the scene's last one, and a Town
    // entered { fromDungeon } would put the hero back at the cave mouth
    // instead of where it stood (GameState.pos, saved on shutdown)
    this.scene.scene.restart({});
  }

  update(): void {
    if (!this.active) return;
    const cam = this.scene.cameras.main;
    const [h, left, l, right, k, up, j, down] = this.panKeys;
    let dx = 0;
    let dy = 0;
    if (h.isDown || left.isDown) dx -= CURSOR_SPEED;
    if (l.isDown || right.isDown) dx += CURSOR_SPEED;
    if (k.isDown || up.isDown) dy -= CURSOR_SPEED;
    if (j.isDown || down.isDown) dy += CURSOR_SPEED;
    if (dx !== 0 || dy !== 0) {
      this.usingKeys = true;
      this.cursorX = Phaser.Math.Clamp(this.cursorX + dx, 0, GAME_WIDTH);
      this.cursorY = Phaser.Math.Clamp(this.cursorY + dy, 0, GAME_HEIGHT);
    }
    this.edgePan(cam);

    const { tx, ty } = this.cursorTile();
    this.cursor.setPosition(tx * TILE + TILE / 2, ty * TILE + TILE / 2);
    const name = this.names[this.landmark];
    if (this.carrying && this.mode === "landmark") this.apply();
    const pos = EDITABLE_POS[name];
    this.names.forEach((n, i) => {
      const p = EDITABLE_POS[n];
      // the selected one is the brighter square; the dashes below mean "held"
      const chosen = i === this.landmark;
      this.spots[i]
        .setVisible(this.mode === "landmark")
        .setPosition(p.x, p.y)
        .setFillStyle(0x38bdf8, chosen ? 0.65 : 0.3)
        .setStrokeStyle(chosen ? 2 : 1, 0xffffff, chosen ? 1 : 0.6);
    });
    // dashes only while something is actually being carried, so dropping it
    // with Z visibly puts it down
    this.pick.setVisible(this.mode === "landmark" && this.carrying);
    if (this.mode === "landmark" && this.carrying) this.drawDashedBox(pos.x, pos.y);
    this.info.setText(
      this.mode === "tile"
        ? `TILE MODE   BRUSH: ${BRUSHES[this.brush].name}   AT (${tx}, ${ty})`
        : `LANDMARK MODE   ${this.carrying ? "HOLDING " : ""}${name}   AT (${tx}, ${ty})`,
    );
  }

  // cursor at any of the four screen edges scrolls the map that way, whether
  // the mouse or HJKL put it there; the camera is bounded to the map, so this
  // stops on its own at the edges
  private edgePan(cam: Phaser.Cameras.Scene2D.Camera): void {
    if (!this.usingKeys && !this.pointerOverGame) return;
    if (this.cursorX < EDGE_MARGIN) cam.scrollX -= PAN_SPEED;
    else if (this.cursorX > GAME_WIDTH - EDGE_MARGIN) cam.scrollX += PAN_SPEED;
    if (this.cursorY < EDGE_MARGIN) cam.scrollY -= PAN_SPEED;
    else if (this.cursorY > GAME_HEIGHT - EDGE_MARGIN) cam.scrollY += PAN_SPEED;
  }

  // marching-ants outline: the dash phase walks with the clock so the selected
  // landmark is obvious even when it sits under the cursor box
  private drawDashedBox(cx: number, cy: number): void {
    const dash = 10;
    const gap = 7;
    const step = dash + gap;
    const half = TILE / 2 + 4;
    const perimeter = half * 2 * 4;
    const phase = (this.scene.time.now / 40) % step;
    const at = (d: number): { x: number; y: number } => {
      const side = half * 2;
      const p = ((d % perimeter) + perimeter) % perimeter;
      if (p < side) return { x: cx - half + p, y: cy - half };
      if (p < side * 2) return { x: cx + half, y: cy - half + (p - side) };
      if (p < side * 3) return { x: cx + half - (p - side * 2), y: cy + half };
      return { x: cx - half, y: cy + half - (p - side * 3) };
    };
    this.pick.clear().lineStyle(3, 0xffffff, 1);
    for (let d = phase - step; d < perimeter; d += step) {
      // a dash that would wrap a corner is split by walking it in short steps
      let prev = at(d);
      for (let t = 2; t <= dash; t += 2) {
        const next = at(d + t);
        this.pick.lineBetween(prev.x, prev.y, next.x, next.y);
        prev = next;
      }
    }
  }

  // index of the landmark whose tile the cursor is on, or -1
  private landmarkUnderCursor(): number {
    const { tx, ty } = this.cursorTile();
    return this.names.findIndex((name) => {
      const pos = EDITABLE_POS[name];
      return Math.floor(pos.x / TILE) === tx && Math.floor(pos.y / TILE) === ty;
    });
  }

  private cursorTile(): { tx: number; ty: number } {
    const world = this.scene.cameras.main.getWorldPoint(this.cursorX, this.cursorY);
    return {
      tx: Phaser.Math.Clamp(Math.floor(world.x / TILE), 0, MAP_W - 1),
      ty: Phaser.Math.Clamp(Math.floor(world.y / TILE), 0, MAP_H - 1),
    };
  }

  private apply(): void {
    const { tx, ty } = this.cursorTile();
    if (this.mode === "tile") {
      const index = BRUSHES[this.brush].key;
      if (this.level[ty][tx] === index) return;
      this.dirty = true;
      this.level[ty][tx] = index;
      // Both render layers: a tree brush paints the object layer over ground,
      // anything else paints the ground and clears the object above it.
      paintTile(this.layers, tx, ty, index);
      return;
    }
    const name = this.names[this.landmark];
    const pos = EDITABLE_POS[name];
    const x = tx * TILE + (pos.x % TILE);
    const y = ty * TILE + (pos.y % TILE);
    // a held landmark is re-applied every frame; only a real move counts
    if (x === pos.x && y === pos.y) return;
    this.dirty = true;
    // keep the landmark's offset inside its tile: HOUSE_POS anchors on a
    // corner, every other landmark on a tile centre. The scene moves its
    // sprites and labels with it, so the change shows immediately.
    this.onMoveLandmark(name, x, y);
    showToast(this.scene, `${name} -> (${tx}, ${ty})`, STATUS_HUD_TOAST_Y);
  }

  // The whole of src/overworldMap.ts, ready to be written over the old one.
  private mapFileSource(): string {
    const rows = mapToRows(this.level)
      .map((r) => `    "${r}",`)
      .join("\n");
    const landmarks = this.names.map((n) => `    ${n}: { x: ${coord(EDITABLE_POS[n].x)}, y: ${coord(EDITABLE_POS[n].y)} },`).join("\n");
    return `${MAP_FILE_HEADER}\nexport const OVERWORLD_MAP = {\n  rows: [\n${rows}\n  ],\n  landmarks: {\n${landmarks}\n  },\n};\n`;
  }

  // Applying means writing the map file itself: the dev server takes the POST
  // and saves it, the page reloads, and the game comes back up on the new
  // layout with no localStorage override in the way. Without the dev server
  // (a built page) it falls back to the clipboard and the console.
  private exportMap(): void {
    const source = this.mapFileSource();
    const stored = { tiles: mapToRows(this.level), landmarks: structuredClone(EDITABLE_POS) };
    console.log(source);
    navigator.clipboard?.writeText(source).catch(() => undefined);
    clearMapOverride();
    // written to the file, or kept as the override below: either way leaving
    // the editor has nothing left to save over it
    this.dirty = false;
    // the header scripts/dev.ts asks for before it writes the file
    fetch("/__map", { method: "POST", headers: { "X-Map-Editor": "1" }, body: source })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        showToast(this.scene, "APPLIED TO src/overworldMap.ts", STATUS_HUD_TOAST_Y);
      })
      .catch(() => {
        // no dev server to write it: keep the edit where it was
        saveMapOverride(stored);
        showToast(this.scene, "COPIED TO CLIPBOARD", STATUS_HUD_TOAST_Y);
      });
  }

  destroy(): void {
    this.cursor.destroy();
    this.pick.destroy();
    for (const spot of this.spots) spot.destroy();
    this.panel.destroy();
    this.info.destroy();
    this.hint.destroy();
  }
}
