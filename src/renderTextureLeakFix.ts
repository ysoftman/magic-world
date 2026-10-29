import Phaser from "phaser";

// A fix for Phaser 4.2.1's DynamicTexture (the latest release at the time):
// - TextureSource.js 249-251: init() gives a render texture's source a GL
//   texture of its own size;
// - DynamicTexture.js 197: the constructor then puts its DrawingContext's
//   texture on that source (`frame.source.glTexture = ...`) and never deletes
//   the first one, so nothing frees it.
// So every RenderTexture left one texture behind for good: NightOverlay's
// 1280x720 lightmap, made by each Town and Volcano create(), kept 3.7MB of
// GPU memory per visit (renderer.glTextureWrappers +1 a visit). Here the
// source's own texture is deleted as soon as init() made it. On a Phaser
// upgrade, check whether this is still needed: restart the Town a few times
// without it and see whether the count of 1280x720 wrappers in
// renderer.glTextureWrappers stays put.
type Source = {
  isRenderTexture?: boolean;
  renderer?: { gl?: unknown; deleteTexture?(texture: unknown): unknown };
  glTexture?: unknown;
  init(game: Phaser.Game): void;
};
type Patched = Source["init"] & { renderTextureLeakFix?: true };

// Called once at boot, before the game is made. It does nothing when the
// source isn't shaped as 4.2.1's (an upgrade changed it) and when it already
// ran (an HMR rerun of main.ts), so it can't break textures or wrap twice.
export function installRenderTextureLeakFix(): void {
  const proto = Phaser.Textures?.TextureSource?.prototype as unknown as Source | undefined;
  const init = proto?.init as Patched | undefined;
  if (!proto || typeof init !== "function" || init.renderTextureLeakFix) return;
  const patched: Patched = function (this: Source, game: Phaser.Game): void {
    // the whole init, setFilter at its end included, then the texture it made
    init.call(this, game);
    const renderer = this.renderer;
    if (this.isRenderTexture && renderer?.gl && this.glTexture && typeof renderer.deleteTexture === "function") {
      renderer.deleteTexture(this.glTexture);
      this.glTexture = null;
    }
  };
  patched.renderTextureLeakFix = true;
  proto.init = patched;
}
