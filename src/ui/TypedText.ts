import type Phaser from "phaser";
import type { PixelText } from "../pixelText";

export interface TypedTextOptions {
  wrapWidth: number;
  lineSpacing: number;
}

/**
 * Text typed out a glyph at a time (the dialogue box, the battle message):
 * one PixelText that setText() wraps the page into once, and reveal(n) sets
 * the first n glyphs of that wrapped page on. The wrap (Text's basic one,
 * PixelText's by default) only puts a "\n" in after the space a row breaks
 * at, so the typed glyphs are the start of the wrapped page: each row typed
 * is the start of a row that fitted, and wrapping it again changes nothing,
 * so a word never jumps a row as it types. A setText moves quads. A Text drew
 * its canvas again and sent it to the GPU every glyph (at TEXT_RESOLUTION 3 a
 * four-row page was ~570MB over its typing), which this used to dodge with a
 * Text a row, baked once and cropped to the typed glyphs.
 */
export class TypedText {
  private text: PixelText;
  // the page as wrapped, and where in it the page's first n glyphs end
  private wrapped = "";
  private ends: number[] = [0];

  constructor(scene: Phaser.Scene, x: number, y: number, style: Phaser.Types.GameObjects.Text.TextStyle, opts: TypedTextOptions) {
    this.text = scene.add.pixelText(x, y, "", style).setWordWrapWidth(opts.wrapWidth).setLineSpacing(opts.lineSpacing);
  }

  getWrappedText(text: string): string[] {
    return this.text.getWrappedText(text);
  }

  // bakes `text`, none of it showing yet
  setText(text: string): this {
    this.wrapped = this.getWrappedText(text).join("\n");
    this.ends = [0];
    let at = 0;
    for (const ch of text) {
      // a "\n" the wrap put in, before the glyph that starts the next row
      while (at < this.wrapped.length && this.wrapped[at] !== ch) at++;
      this.ends.push(++at);
    }
    return this.reveal(0);
  }

  // the text's first `n` glyphs; all of it at its length
  reveal(n: number): this {
    this.text.setText(this.wrapped.slice(0, this.ends[Math.min(Math.max(n, 0), this.ends.length - 1)]));
    return this;
  }

  setVisible(visible: boolean): this {
    this.text.setVisible(visible);
    return this;
  }

  setDepth(depth: number): this {
    this.text.setDepth(depth);
    return this;
  }

  setScrollFactor(factor: number): this {
    this.text.setScrollFactor(factor);
    return this;
  }

  destroy(): void {
    this.text.destroy();
  }
}
