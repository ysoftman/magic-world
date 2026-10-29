import Phaser from "phaser";
import { BODY_FONT } from "./config";

// Text drawn from glyph atlases rather than baked per object: scene.add
// .pixelText(x, y, text, retroStyle(n) | bodyStyle(n)) takes the same
// arguments as scene.add.text and the Text methods the game uses, so a call
// site changes its factory name and its type and nothing else.
//
// Why: a Text is its own canvas texture, drawn again and sent to the GPU on
// every setText, and it is sharp only as far as TEXT_RESOLUTION's bigger bake
// gives the nearest filter clean samples (a 20px line kept 8.5% in-between
// grey pixels baked at 3, 30% at 1); at 3 the town's 502 Texts held 36.8MB of
// canvas, the same again on the GPU. Both fonts are pixel fonts on a grid
// (Press Start 2P 8px, Departure Mono 11px), so a glyph is read off once at
// its grid size, kept as on/off pixels, and drawn whole-pixel scaled: every
// glyph pixel is a block of game pixels on any screen at any DPR, and a
// setText only moves quads. The two grid-size atlases are 62 and 85KB; a size
// or outline baked at its size (see bake) 0.3 to 1MB, once for the game.

interface Family {
  css: string;
  // the font size its grid is drawn at, a glyph's advance, the baseline from
  // the top and the line's height, all in grid pixels; the line is what
  // Phaser measures for a Text (ascent + descent) over the grid size
  em: number;
  advance: number;
  ascent: number;
  lineHeight: number;
}

type FamilyName = "retro" | "body";

const FAMILIES: Record<FamilyName, Family> = {
  // Press Start 2P: 8x8 cells, the descenders inside them (Text's line is
  // fontSize tall, its ink from the top row)
  retro: { css: '"Press Start 2P", monospace', em: 8, advance: 8, ascent: 8, lineHeight: 8 },
  // Departure Mono: 7px a glyph, caps 8px tall under 3px of room for an
  // accent, descenders 2px; Text's line is 13/11 em (26px at 22, 39 at 33)
  body: { css: BODY_FONT, em: 11, advance: 7, ascent: 11, lineHeight: 13 },
};

// Printable ASCII and the em dash: every glyph the game's strings use (a
// name is typed in printable ASCII, NameEntry's TYPABLE). A character outside
// this has no glyph and draws nothing; a Text fell back to another font.
// The Latin-1 letters both bundled subsets also carry would double every
// atlas for text the game never shows.
const CHARS = (() => {
  let s = "";
  for (let c = 0x20; c < 0x7f; c++) s += String.fromCharCode(c);
  return `${s}—`;
})();

// Glyphs are drawn this many times their grid size and read back a sample
// from the middle of each grid pixel: the canvas antialiases every edge, a
// faint ring at grid size, but a pixel's middle is never in doubt.
const OVERSAMPLE = 4;

// on/off grid pixels of every glyph (advance x lineHeight, row by row), a
// family; read again once the webfont is in (see bake)
const masks = new Map<FamilyName, Uint8Array[]>();

function readMasks(name: FamilyName): Uint8Array[] {
  const f = FAMILIES[name];
  const k = OVERSAMPLE;
  const canvas = document.createElement("canvas");
  canvas.width = f.advance * k;
  canvas.height = f.lineHeight * k;
  const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
  ctx.font = `${f.em * k}px ${f.css}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  return [...CHARS].map((ch) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillText(ch, 0, f.ascent * k);
    const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const mask = new Uint8Array(f.advance * f.lineHeight);
    for (let y = 0; y < f.lineHeight; y++)
      for (let x = 0; x < f.advance; x++)
        mask[y * f.advance + x] = px[((y * k + k / 2) * canvas.width + x * k + k / 2) * 4 + 3] >= 128 ? 1 : 0;
    return mask;
  });
}

function familyMasks(name: FamilyName): Uint8Array[] {
  let m = masks.get(name);
  if (!m) {
    m = readMasks(name);
    masks.set(name, m);
  }
  return m;
}

interface Atlas {
  family: FamilyName;
  // the font size it's baked at, and the outline round its glyphs, in atlas
  // pixels; the GPU scales it up a whole number of times (see atlasKey)
  px: number;
  outline?: { color: number; radius: number };
}

// Phaser's glyph type leaves out the advance its own parsers fill in
type Glyph = Phaser.Types.GameObjects.BitmapText.BitmapFontCharacterData & { xAdvance: number };

const atlases = new Map<string, Atlas>();
let refetching = false;

// One glyph cell a column in rows of 16, a pixel apart so no sample at a
// cell's edge can reach the next glyph. Each grid pixel becomes a block of
// atlas pixels (2 or 3 for 2.5, retroStyle(5)'s, baked here rather than left
// to the GPU's nearest, which splits a block wherever a float lands on the
// half), and the outline is every pixel within `radius` of the glyph.
function bake(scene: Phaser.Scene, key: string, a: Atlas): void {
  const f = FAMILIES[a.family];
  const glyphs = familyMasks(a.family);
  const s = a.px / f.em;
  const adv = Math.round(f.advance * s);
  const line = Math.round(f.lineHeight * s);
  const r = a.outline?.radius ?? 0;
  const cw = adv + 2 * r;
  const ch = line + 2 * r;
  const cols = 16;
  const rows = Math.ceil(glyphs.length / cols);
  const w = cols * (cw + 1) + 1;
  const h = rows * (ch + 1) + 1;
  const tex = scene.textures.exists(key)
    ? (scene.textures.get(key) as Phaser.Textures.CanvasTexture)
    : scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const img = tex.context.createImageData(w, h);
  const out = img.data;
  const oc = a.outline?.color ?? 0;
  const chars: Record<number, Glyph> = {};
  const fill = new Uint8Array(cw * ch);
  glyphs.forEach((mask, i) => {
    const gx = 1 + (i % cols) * (cw + 1);
    const gy = 1 + Math.floor(i / cols) * (ch + 1);
    fill.fill(0);
    for (let y = 0; y < line; y++)
      for (let x = 0; x < adv; x++)
        fill[(y + r) * cw + x + r] =
          mask[Math.floor(((y + 0.5) * f.lineHeight) / line) * f.advance + Math.floor(((x + 0.5) * f.advance) / adv)];
    for (let y = 0; y < ch; y++)
      for (let x = 0; x < cw; x++) {
        let rgb = -1;
        if (fill[y * cw + x]) rgb = 0xffffff;
        else if (r > 0) {
          // the outline: every pixel within `r` of the glyph, square, as a
          // stroke's mitred corners draw round a pixel glyph
          near: for (let dy = Math.max(0, y - r); dy <= Math.min(ch - 1, y + r); dy++)
            for (let dx = Math.max(0, x - r); dx <= Math.min(cw - 1, x + r); dx++)
              if (fill[dy * cw + dx]) {
                rgb = oc;
                break near;
              }
        }
        if (rgb < 0) continue;
        const o = ((gy + y) * w + gx + x) * 4;
        out[o] = rgb >> 16;
        out[o + 1] = (rgb >> 8) & 0xff;
        out[o + 2] = rgb & 0xff;
        out[o + 3] = 255;
      }
    // the uv's v counts up from the bottom, as Phaser's own font parsers have it
    chars[CHARS.charCodeAt(i)] = {
      x: gx,
      y: gy,
      width: cw,
      height: ch,
      centerX: Math.floor(cw / 2),
      centerY: Math.floor(ch / 2),
      xOffset: 0,
      yOffset: 0,
      xAdvance: adv,
      data: {},
      kerning: {},
      u0: gx / w,
      v0: 1 - gy / h,
      u1: (gx + cw) / w,
      v1: 1 - (gy + ch) / h,
    };
  });
  tex.context.putImageData(img, 0, 0);
  tex.refresh();
  // the line takes the outline in, as a stroked Text's does (fontSize +
  // strokeThickness), so lines step the same distance
  const data = { font: key, size: a.px, lineHeight: ch, retroFont: true, chars };
  scene.cache.bitmapFont.add(key, { data, texture: key, frame: null });
  atlases.set(key, a);
  // baked in the fallback font (main.ts gives the webfonts 2s): read the
  // glyphs again and redraw every atlas once they're in
  if (!refetching && !document.fonts.check(`${f.em}px ${f.css}`)) {
    refetching = true;
    Promise.all(Object.values(FAMILIES).map((g) => document.fonts.load(`${g.em}px ${g.css}`))).then(() => {
      masks.clear();
      for (const [k, at] of atlases) bake(scene, k, at);
    });
  }
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

// The atlas key for `family` at `px` (a font size in game pixels) with an
// outline `radius` game pixels round it, baked on first use. The GPU draws it
// `q` times up, q the most that leaves both a grid pixel and the outline
// whole atlas pixels: every plain whole-number size shares the grid-size
// atlas (q = px / em), retroStyle(8)'s 2px outline is baked at 16px with a
// 1px one (q = 2), and a size off the grid is baked as it's drawn (q = 1).
function atlasKey(scene: Phaser.Scene, family: FamilyName, px: number, radius = 0, color = 0): string {
  const s = px / FAMILIES[family].em;
  const q = Number.isInteger(s) ? gcd(s, radius) : 1;
  const atlas: Atlas = { family, px: px / q, outline: radius > 0 ? { color, radius: radius / q } : undefined };
  const key = `pixel-${family}-${atlas.px}${atlas.outline ? `-o${atlas.outline.radius}-${color.toString(16)}` : ""}`;
  if (!scene.cache.bitmapFont.exists(key)) bake(scene, key, atlas);
  return key;
}

// Boot bakes the two grid-size atlases, the ones nearly every text uses.
export function bakePixelFonts(scene: Phaser.Scene): void {
  atlasKey(scene, "retro", FAMILIES.retro.em);
  atlasKey(scene, "body", FAMILIES.body.em);
}

const cssColor = (c: string | number): number => (typeof c === "number" ? c : Phaser.Display.Color.HexStringToColor(c).color);

// Text's word wrap, measured for a monospace font: a glyph is `adv` wide.
// Ported from Phaser 4.2.1's Text basicWordWrap and advancedWordWrap so a
// text breaks where it did. Basic keeps the space each line broke at, at its
// end; advanced collapses runs of spaces, trims each line and wants room for
// a space after every word, the last one too.
function basicWrap(text: string, width: number, adv: number): string {
  return text
    .split(/(?:\r\n|\r|\n)/)
    .map((line) => {
      let out = "";
      let left = width;
      const words = line.split(" ");
      words.forEach((word, j) => {
        const last = j === words.length - 1;
        const w = word.length * adv;
        const withSpace = last ? w : w + adv;
        if (withSpace > left && j > 0) {
          out += "\n";
          left = width;
        }
        out += last ? word : `${word} `;
        left -= withSpace;
      });
      return out;
    })
    .join("\n");
}

function advancedWrap(text: string, width: number, adv: number): string {
  const lines = text.replace(/ +/gi, " ").split(/(?:\r\n|\r|\n)/);
  let output = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/^ *|\s*$/gi, "");
    if (line.length * adv < width) {
      output += `${line}\n`;
      continue;
    }
    let left = width;
    let out = "";
    const words = line.split(" ");
    for (let j = 0; j < words.length; j++) {
      const word = words[j];
      const w = (word.length + 1) * adv;
      if (w <= left) {
        out += `${word} `;
        left -= w;
        continue;
      }
      if (j === 0) {
        // a word wider than the line is cut where it stops fitting
        let fit = word.length;
        while (fit > 0 && fit * adv > left) fit--;
        if (fit === 0) throw new Error("wordWrapWidth < a single character");
        out += word.slice(0, fit);
        words[j] = word.slice(fit);
      }
      const rest = words
        .slice(words[j].length ? j : j + 1)
        .join(" ")
        .replace(/[ \n]*$/gi, "");
      lines.splice(i + 1, 0, rest);
      break;
    }
    output += `${out.replace(/[ \n]*$/gi, "")}\n`;
  }
  return output.replace(/[\s|\n]*$/gi, "");
}

// BitmapText's internals PixelText works with (not in Phaser's types)
interface BitmapInternals {
  _text: string;
  _dirty: boolean;
  _displayOriginX: number;
  _displayOriginY: number;
  _bounds: Phaser.Types.GameObjects.BitmapText.BitmapTextSize;
}

type RenderWebGL = (
  renderer: Phaser.Renderer.WebGL.WebGLRenderer,
  src: Phaser.GameObjects.GameObject,
  drawingContext: Phaser.Renderer.WebGL.DrawingContext,
  parentMatrix?: Phaser.GameObjects.Components.TransformMatrix,
) => void;
const bitmapRender = (Phaser.GameObjects.BitmapText.prototype as unknown as { renderWebGL: RenderWebGL }).renderWebGL;

const ALIGN: Record<string, number> = { left: 0, center: 1, right: 2 };

// the PixelText whose getTextBounds is measuring: its `text` is the wrapped
// text then
let measuring: PixelText | null = null;

/**
 * A BitmapText on the pixel-font atlases, worked like the Text it replaces:
 * built from retroStyle/bodyStyle, and setColor, setStroke, setFontSize,
 * setWordWrapWidth, setLineSpacing (in game pixels), setAlign, setStyle and
 * setShadow do what Text's did. A Text's box, origin and line pitch come out
 * the same, so a converted call site draws at the pixel it did.
 *
 * `text` is what was set; the wrapped lines are what's drawn
 * (getWrappedText). No crop, background or padding: TypedText types a
 * prefix of the wrapped text, a tag's backdrop is a Rectangle behind it.
 * The outline is baked in the atlas, white inside, so the tint (the text's
 * colour) multiplies it too: the near-black stroke colours stay near-black.
 */
export class PixelText extends Phaser.GameObjects.BitmapText {
  private family: FamilyName = "retro";
  private px = 32;
  private strokeColor = 0;
  private strokeThickness = 0;
  private wrapWidth = 0;
  private wrapAdvanced = false;
  private lineSpacingPx = 0;
  private source = "";

  constructor(scene: Phaser.Scene, x: number, y: number, text: string | string[], style: Phaser.Types.GameObjects.Text.TextStyle = {}) {
    super(scene, x, y, atlasKey(scene, "retro", FAMILIES.retro.em), "");
    this.applyStyle(style);
    this.setText(text);
  }

  setText(value: string | string[]): this {
    const text = Array.isArray(value) ? value.join("\n") : value === undefined || value === null ? "" : String(value);
    // BitmapText's constructor sets "" before this class's fields are in
    if (text === this.source && this.family) return this;
    this.source = text;
    return this.layout();
  }

  setColor(color: string | number): this {
    return this.setTint(cssColor(color));
  }

  // thickness as Text's (a stroke centred on the glyph's edge): the outline
  // is half of it, in whole game pixels, round the glyph
  setStroke(color: string | number, thickness: number): this {
    this.strokeColor = cssColor(color);
    this.strokeThickness = thickness;
    return this.refont();
  }

  setFontSize(size: number | string): this {
    this.px = typeof size === "number" ? size : Number.parseFloat(size);
    return this.refont();
  }

  setWordWrapWidth(width: number | null, useAdvancedWrap = false): this {
    this.wrapWidth = width ?? 0;
    this.wrapAdvanced = useAdvancedWrap;
    return this.layout();
  }

  // `text` (by default the text set) broken into the lines it draws as
  getWrappedText(text = this.source): string[] {
    return this.wrap(text).split("\n");
  }

  setLineSpacing(px = 0): this {
    this.lineSpacingPx = px;
    super.setLineSpacing(px / this.scaleFromAtlas());
    return this;
  }

  setAlign(align = "left"): this {
    this.align = ALIGN[align] ?? 0;
    return this;
  }

  setStyle(style: Phaser.Types.GameObjects.Text.TextStyle): this {
    this.applyStyle(style);
    return this;
  }

  // Text's setShadow: the shadow is the whole glyph, outline and all, in one
  // colour; blur and the stroke/fill switches have no say
  setShadow(x = 0, y = 0, color: string | number = "#000000", _blur = 0, _shadowStroke = false, _shadowFill = true): this {
    return this.setDropShadow(x, y, cssColor(color), 1);
  }

  getTextBounds(round?: boolean): Phaser.Types.GameObjects.BitmapText.BitmapTextSize {
    const self = this as unknown as BitmapInternals;
    const b = self._bounds;
    const fresh = self._dirty || round || this.scaleX !== b.scaleX || this.scaleY !== b.scaleY;
    const outer = measuring;
    measuring = this;
    try {
      super.getTextBounds(round);
    } finally {
      measuring = outer;
    }
    // a stroked Text is its stroke wider (half each side); the glyphs
    // already sit that far in, their cells baked with the outline round them
    const extra = this.family ? 2 * this.outlineRadius() : 0;
    if (fresh && extra) {
      b.local.width += extra;
      b.global.width += extra * this.scaleX;
      self._displayOriginX = this.originX * b.local.width;
      b.global.x = this.x - self._displayOriginX * this.scaleX;
    }
    return b;
  }

  // As Text's quad is rounded to whole pixels (roundPixels, only moved), the
  // glyphs are put where it would have been: BitmapText leaves its quads
  // where the float math lands them, and an atlas pixel drawn across a
  // pixel's middle comes out a pixel narrow or wide. A render step, called
  // without `this`: `src` is the text.
  renderWebGL(
    renderer: Phaser.Renderer.WebGL.WebGLRenderer,
    src: Phaser.GameObjects.GameObject,
    drawingContext: Phaser.Renderer.WebGL.DrawingContext,
    parentMatrix?: Phaser.GameObjects.Components.TransformMatrix,
  ): void {
    const text = src as PixelText;
    const camera = drawingContext.camera;
    const m = camera && Phaser.GameObjects.GetCalcMatrix(text, camera, parentMatrix, !drawingContext.useCanvas).calc;
    if (!camera || !m || !text.willRoundVertices(camera, m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1)) {
      bitmapRender(renderer, src, drawingContext, parentMatrix);
      return;
    }
    text.getTextBounds(false);
    const ox = m.e - text.displayOriginX;
    const oy = m.f - text.displayOriginY;
    const { x, y } = text;
    text.x = x + Math.round(ox) - ox;
    text.y = y + Math.round(oy) - oy;
    bitmapRender(renderer, src, drawingContext, parentMatrix);
    text.x = x;
    text.y = y;
  }

  private applyStyle(style: Phaser.Types.GameObjects.Text.TextStyle): void {
    if (style.fontFamily !== undefined) this.family = style.fontFamily === BODY_FONT ? "body" : "retro";
    if (style.fontSize !== undefined) this.px = typeof style.fontSize === "number" ? style.fontSize : Number.parseFloat(style.fontSize);
    if (typeof style.color === "string") this.setColor(style.color);
    if (style.align !== undefined) this.setAlign(style.align);
    if (style.stroke !== undefined || style.strokeThickness !== undefined) {
      this.strokeColor = typeof style.stroke === "string" ? cssColor(style.stroke) : this.strokeColor;
      this.strokeThickness = style.strokeThickness ?? this.strokeThickness;
    }
    this.refont();
  }

  // half of Text's stroke thickness (centred on the glyph's edge), whole
  private outlineRadius(): number {
    return this.strokeThickness > 0 ? Math.round(this.strokeThickness / 2) : 0;
  }

  // game pixels an atlas pixel: 1 for an atlas baked at its size
  private scaleFromAtlas(): number {
    return this.fontSize / this.fontData.size;
  }

  private refont(): this {
    this.setFont(atlasKey(this.scene, this.family, this.px, this.outlineRadius(), this.strokeColor), this.px);
    super.setLineSpacing(this.lineSpacingPx / this.scaleFromAtlas());
    return this.layout();
  }

  private wrap(text: string): string {
    if (!(this.wrapWidth > 0)) return text;
    const adv = (this.fontData.chars[32] as Glyph).xAdvance * this.scaleFromAtlas();
    return this.wrapAdvanced ? advancedWrap(text, this.wrapWidth, adv) : basicWrap(text, this.wrapWidth, adv);
  }

  private layout(): this {
    (this as unknown as BitmapInternals)._text = this.wrap(this.source ?? "");
    this.updateDisplayOrigin();
    // as Text keeps a hit area its own size
    const input = this.input;
    if (input && !input.customHitArea) {
      const area = input.hitArea as Phaser.Geom.Rectangle;
      area.width = this.width;
      area.height = this.height;
    }
    return this;
  }
}

// `text` is what was set; while getTextBounds measures, Phaser's size code
// reads the wrapped lines through it. An accessor on the prototype, as
// Phaser's own is: TypeScript won't let a subclass redeclare a property as one.
Object.defineProperty(PixelText.prototype, "text", {
  configurable: true,
  get(this: PixelText): string {
    const self = this as unknown as BitmapInternals & { source?: string };
    return measuring === this ? self._text : (self.source ?? "");
  },
  set(this: PixelText, value: string) {
    this.setText(value);
  },
});

declare global {
  namespace Phaser.GameObjects {
    interface GameObjectFactory {
      pixelText(x: number, y: number, text: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle): PixelText;
    }
  }
}

Phaser.GameObjects.GameObjectFactory.register(
  "pixelText",
  function (
    this: Phaser.GameObjects.GameObjectFactory,
    x: number,
    y: number,
    text: string | string[],
    style?: Phaser.Types.GameObjects.Text.TextStyle,
  ): PixelText {
    return this.displayList.add(new PixelText(this.scene, x, y, text, style)) as PixelText;
  },
);
