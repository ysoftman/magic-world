import Phaser from "phaser";
import { ART_PX, scale2x, texelsOf } from "./pixelart";

// The battle draws its fighters at 2x, so a cell of their 32-cell art (48 for
// a boss or giant), ART_PX in the texture, is 4px on screen where the field
// draws it at 2px. battleTexture() gives the battle a texture of its own for
// a fighter (hero, gear, foe, companion), the same size as the art's so a
// sprite swapped onto it keeps its size, origin and feet, its cells a texel
// each, 2px on screen:
//
// - drawn at boot, under the art's key and HD, from a grid of twice the cells
//   (64, or 96 for a boss or giant: art/hdHero.ts, art/hdMonsters.ts,
//   art/hdBosses.ts), the art redrawn at the field's density. Its layout is
//   the art's own doubled, a cell (x, y) of the art the cells (2x..2x+1,
//   2y..2y+1), so the feet, the hands and the head are where the art has
//   them; or else
// - a copy of the art made here the first time it is asked for, whose outline
//   alone goes through Scale2x once more: where a cell meets the empty space
//   round the body its corner is cut or filled, so the outline steps by half a
//   cell, 2px on screen. Inside the outline every cell stays a whole block:
//   Scale2x limited to the boundary between the body and the empty space, as
//   smoothBoundaryOnly() limits it to a terrain's edge. A full Scale2x of the
//   body turned the hero's flat eyes into almonds, the SLIME's mouth into a
//   curve, the GOBLIN's eyes into slants and the BAT's two unlike eyes into a
//   squint; an eye, a mouth or a pattern inside the body never touches the
//   empty space, so it keeps its blocks.
//
// What reads the art itself (a fighter's footing, statusFx.ts's body cell by
// cell) reads the art under its own key (battleSource), not either of these.

const HD = "@hd";
// what empty is to scale2x(): its edges and the boundary the corners keep to
const EMPTY = ".";

// What a copy made here was drawn from: the source Texture, how many times it
// had been redrawn then, and its texels' hash. The hero's textures are drawn
// again in place when its look changes (art/hero.ts bakeHero), so a copy is
// drawn again once its source has been. Reading the texels back to find that
// out held every call to some 0.8ms (getImageData, headless), five a battle,
// so a redraw is counted instead (redrawsOf) and the texels are read only
// then.
interface Drawn {
  source: Phaser.Textures.Texture;
  redraws: number | undefined;
  hash: number;
}
const drawnFrom = new Map<string, Drawn>();

// Every redraw of a canvas texture in place ends in its refresh(), the upload
// to the GPU: generateTexture onto an existing key, and the clear() bakeHero
// starts with. Counted here per texture, from the first time it is a source.
// Any other texture is never drawn again under its key: undefined.
const redraws = new WeakMap<Phaser.Textures.Texture, number>();
function redrawsOf(tex: Phaser.Textures.Texture): number | undefined {
  if (!(tex instanceof Phaser.Textures.CanvasTexture)) return undefined;
  let n = redraws.get(tex);
  if (n === undefined) {
    n = 0;
    redraws.set(tex, n);
    const refresh = tex.refresh.bind(tex);
    tex.refresh = () => {
      redraws.set(tex, (redraws.get(tex) ?? 0) + 1);
      return refresh();
    };
  }
  return n;
}

// The texels as one number each (texelsOf, pixelart.ts: off the art's own
// read-frequently canvas)
function pixelsOf(source: HTMLCanvasElement | HTMLImageElement, w: number, h: number): Uint32Array | null {
  const data = texelsOf(source, 0, 0, w, h);
  return data && new Uint32Array(data.buffer, data.byteOffset, w * h);
}

// FNV-1a over the texels: a redraw that drew the same picture (bakeHero back
// to a look already drawn) keeps the copy
function hashOf(px: Uint32Array): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < px.length; i++) h = Math.imul(h ^ px[i], 0x01000193) >>> 0;
  return h;
}

// The texture read back on its art grid, a character a colour ("." empty), or
// null if its texels are not whole ART_PX blocks (a grid baked through Scale2x
// already, or not art at all): those are left as they are.
function cellRows(px: Uint32Array, w: number, h: number): { rows: string[]; colors: Map<string, number> } | null {
  const colors = new Map<string, number>();
  const chars = new Map<number, string>();
  const rows: string[] = [];
  for (let cy = 0; cy < h / ART_PX; cy++) {
    let row = "";
    for (let cx = 0; cx < w / ART_PX; cx++) {
      const v = px[cy * ART_PX * w + cx * ART_PX];
      for (let k = 1; k < ART_PX * ART_PX; k++)
        if (px[(cy * ART_PX + Math.floor(k / ART_PX)) * w + cx * ART_PX + (k % ART_PX)] !== v) return null;
      if (v >>> 24 === 0) {
        row += EMPTY;
        continue;
      }
      let ch = chars.get(v);
      if (ch === undefined) {
        // past Latin-1, so never "." and never a surrogate
        ch = String.fromCharCode(0x100 + chars.size);
        chars.set(v, ch);
        colors.set(ch, v);
      }
      row += ch;
    }
    rows.push(row);
  }
  return { rows, colors };
}

/**
 * The key of `key`'s battle texture (see above): the one drawn at boot where
 * there is one, else the copy with its outline smoothed, made the first time
 * it is asked for and again whenever `key` has been drawn again since; `key`
 * itself when it is missing or not on the ART_PX grid.
 */
export function battleTexture(scene: Phaser.Scene, key: string): string {
  if (!scene.textures.exists(key)) return key;
  const hd = key + HD;
  const seen = drawnFrom.get(hd);
  const exists = scene.textures.exists(hd);
  // drawn at boot (a copy made here is always in drawnFrom); the hero's is
  // drawn again with the hero's own (art/hero.ts bakeHero)
  if (exists && !seen) return hd;
  const texture = scene.textures.get(key);
  const n = redrawsOf(texture);
  if (exists && seen?.source === texture && n !== undefined && seen.redraws === n) return hd;
  const source = texture.getSourceImage();
  if (!(source instanceof HTMLCanvasElement || source instanceof HTMLImageElement)) return key;
  const { width: w, height: h } = source;
  if (w % ART_PX !== 0 || h % ART_PX !== 0) return key;
  const px = pixelsOf(source, w, h);
  if (!px) return key;
  const hash = hashOf(px);
  if (exists && seen?.hash === hash) {
    drawnFrom.set(hd, { source: texture, redraws: n, hash });
    return hd;
  }
  const grid = cellRows(px, w, h);
  if (!grid) return key;
  // a cell of the smoothed grid is half an art cell
  const sub = ART_PX / 2;
  const out = new Uint32Array(w * h);
  scale2x(grid.rows, "transparent", EMPTY).forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const v = grid.colors.get(row[x]) ?? 0;
      if (v === 0) continue;
      for (let k = 0; k < sub * sub; k++) out[(y * sub + Math.floor(k / sub)) * w + x * sub + (k % sub)] = v;
    }
  });
  const tex = (exists ? scene.textures.get(hd) : scene.textures.createCanvas(hd, w, h)) as Phaser.Textures.CanvasTexture | null;
  if (!tex) return key;
  if (tex.width !== w || tex.height !== h) tex.setSize(w, h);
  tex.context.putImageData(new ImageData(new Uint8ClampedArray(out.buffer), w, h), 0, 0);
  tex.refresh();
  drawnFrom.set(hd, { source: texture, redraws: n, hash });
  return hd;
}

/** The art a battle texture stands for; any other key as it is. */
export function battleSource(key: string): string {
  return key.endsWith(HD) ? key.slice(0, -HD.length) : key;
}
