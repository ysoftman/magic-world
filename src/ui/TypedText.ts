import Phaser from "phaser";
import { TEXT_RESOLUTION } from "../pixelart";

export interface TypedTextOptions {
  // a glyph's width: both fonts are monospace (BODY_GLYPH_W, retroStyle's 1em)
  glyphW: number;
  wrapWidth: number;
  lineSpacing: number;
  // rows made up front; a text that wraps to more adds them
  rows: number;
}

/**
 * Text typed out a glyph at a time (the dialogue box, the battle message),
 * baked once. setText(text.slice(0, n)) a glyph drew the whole Text again and
 * sent it to the GPU each time: at TEXT_RESOLUTION 3 a four-row page of talk
 * was ~570MB over its typing, 2.4MB a frame (12.5MB at text speed x2). Here
 * setText() bakes it once, a Text a row (wrapped as the one Text wrapped it,
 * where it drew each row), and reveal() crops each row to its typed glyphs:
 * both fonts are monospace, so a crop's edge falls between glyphs. A Text a
 * row because one crop can't show all of a row and part of the next. Each row
 * is a whole pixel tall: Phaser's line height is 38.99997 for bodyStyle(33),
 * a canvas can't be, and at TEXT_RESOLUTION 1 the pixel the one Text's canvas
 * came up short squeezed a row of a glyph out (mid-row on a one-row page,
 * the last two rows a pixel low on a four-row one).
 */
export class TypedText {
  private scene: Phaser.Scene;
  private x: number;
  private y: number;
  private style: Phaser.Types.GameObjects.Text.TextStyle;
  private glyphW: number;
  // wraps the text as the one Text did; never drawn
  private wrap: Phaser.GameObjects.Text;
  private rows: Phaser.GameObjects.Text[] = [];
  private rowH: number;
  private pitch: number;
  private ascent: number;
  // where each row starts in the text, and how much of it shows
  private starts: number[] = [];
  private shown = 0;
  private length = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, style: Phaser.Types.GameObjects.Text.TextStyle, opts: TypedTextOptions) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.style = style;
    this.glyphW = opts.glyphW;
    this.wrap = scene.add.text(x, y, "", style).setWordWrapWidth(opts.wrapWidth).setVisible(false);
    const m = this.wrap.getTextMetrics();
    const lineH = m.fontSize + this.wrap.style.strokeThickness;
    this.rowH = Math.ceil(lineH);
    this.pitch = lineH + opts.lineSpacing;
    this.ascent = this.wrap.style.strokeThickness / 2 + m.ascent;
    for (let i = 0; i < opts.rows; i++) this.addRow();
    // a resize that bakes the rows again (watchTextResolution, just before
    // the render) changes the texels their crops are counted in
    scene.events.on(Phaser.Scenes.Events.PRE_RENDER, this.recrop);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.PRE_RENDER, this.recrop));
  }

  getWrappedText(text: string): string[] {
    return this.wrap.getWrappedText(text);
  }

  // bakes `text`, none of it showing yet
  setText(text: string): this {
    const lines = this.wrap.getWrappedText(text);
    while (this.rows.length < lines.length) this.addRow();
    let at = 0;
    this.starts = lines.map((line, i) => {
      this.rows[i].setText(line);
      // the wrap only breaks the text up (at a space it keeps, or a "\n")
      at = text.indexOf(line, at);
      const start = at;
      at += line.length;
      return start;
    });
    for (let i = lines.length; i < this.rows.length; i++) this.rows[i].setText("");
    this.length = text.length;
    return this.reveal(0);
  }

  // the text's first `n` glyphs; all of it uncropped
  reveal(n: number): this {
    this.shown = n;
    this.crop();
    return this;
  }

  setVisible(visible: boolean): this {
    for (const row of this.rows) row.setVisible(visible);
    return this;
  }

  setDepth(depth: number): this {
    for (const row of this.rows) row.setDepth(depth);
    return this;
  }

  setScrollFactor(factor: number): this {
    for (const row of this.rows) row.setScrollFactor(factor);
    return this;
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.PRE_RENDER, this.recrop);
    this.wrap.destroy();
    for (const row of this.rows) row.destroy();
  }

  private addRow(): void {
    const i = this.rows.length;
    // where the one Text drew row i: its baseline rounded, as Phaser rounds it
    const y = Math.round(i * this.pitch + this.ascent) - Math.round(this.ascent);
    const row = this.scene.add.text(this.x, this.y + y, "", { ...this.style, resolution: TEXT_RESOLUTION }).setFixedSize(0, this.rowH);
    const first = this.rows[0];
    if (first) row.setDepth(first.depth).setScrollFactor(first.scrollFactorX, first.scrollFactorY).setVisible(first.visible);
    this.rows.push(row);
  }

  private crop(): void {
    this.starts.forEach((start, i) => {
      const row = this.rows[i];
      const typed = Math.min(Math.max(this.shown - start, 0), row.text.length);
      if (typed === row.text.length) row.setCrop();
      else row.setCrop(0, 0, typed * this.glyphW * row.style.resolution, row.frame.realHeight);
    });
  }

  private recrop = (): void => {
    if (this.shown < this.length) this.crop();
  };
}
