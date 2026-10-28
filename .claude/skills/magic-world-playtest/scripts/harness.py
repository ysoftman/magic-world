"""magic-world browser playtest harness (python playwright, headless).

Import it from a throwaway script under /tmp/pwcheck/, or run the smoke test:

    python3 -I harness.py smoke [--touch] [--out /tmp/pwcheck/playtest]

What it does for every page, without touching the repo:
- serves the Bun dev server's bundle (/_bun/client/*.js) with main.ts's
  game construction wrapped, so the page gets window.__game (the
  Phaser.Game) and window.__GS (the GameState instance the game uses; the
  bundle has no per-module URL to import it from)
- keeps Bun's HMR socket (/_bun/hmr) from opening, so a teammate's edit
  can't reload the page mid-test
- records console errors/warnings and page errors
"""

from __future__ import annotations

import glob
import json
import re
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

URL = "http://localhost:5199/"
OUT = "/tmp/pwcheck/playtest"

# main.ts's GameState.loadSettings() ... new Phaser.Game(config), with the
# bundler's names for both (import_gameState.GameState, import_phaser.default.);
# the patch keeps it and adds the handles
HOOK = re.compile(r"([\w$.]*\bGameState)\.loadSettings\(\);(.{0,400}?)new ([\w$.]*\.)?Game\(config\)", re.DOTALL)
PATCH = r"\1.loadSettings();\2(window.__GS = \1, window.__game = new \3Game(config))"

INIT_NO_HMR = """(() => {
  const Real = window.WebSocket;
  window.WebSocket = function (url, protocols) {
    if (String(url).includes("/_bun/hmr")) return Object.assign(new EventTarget(), { readyState: 0, send() {}, close() {} });
    return new Real(url, protocols);
  };
  window.WebSocket.prototype = Real.prototype;
  Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
})();"""

# isTouchDevice() reads (pointer: coarse); has_touch alone doesn't flip it everywhere
INIT_COARSE = """(() => {
  const real = window.matchMedia.bind(window);
  window.matchMedia = (q) => (/pointer:\\s*coarse/.test(q) ? real("(min-width: 0px)") : real(q));
})();"""

# a standard-mapping pad the game polls through navigator.getGamepads (ui/Gamepad.ts)
INIT_PAD = """(() => {
  const pad = { id: "Fake Pad (STANDARD GAMEPAD)", index: 0, connected: true, mapping: "standard", timestamp: 0,
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })), axes: [0, 0, 0, 0] };
  window.__pad = pad;
  navigator.getGamepads = () => [pad, null, null, null];
})();"""

AUDIT_JS = """() => {
  const out = { offscreen: [], overlap: [], missing: [], touch: [] };
  for (const s of window.__game.scene.getScenes(true)) {
    const cam = s.cameras.main, items = [];
    const walk = (list, vis) => {
      for (const o of list) {
        const v = vis && o.visible !== false && (o.alpha === undefined || o.alpha > 0.05);
        if (v && o.texture && o.texture.key === "__MISSING") out.missing.push(`${s.scene.key}:${o.type}`);
        if (o.list) walk(o.list, v);
        if (o.type !== "Text" || !v || !o.text || !o.text.trim()) continue;
        const b = o.getBounds();
        const fixed = (o.scrollFactorX ?? 1) === 0 || (o.parentContainer && (o.parentContainer.scrollFactorX ?? 1) === 0);
        items.push({ t: o.text.replace(/\\n/g, "|").slice(0, 48), x: fixed ? b.x : b.x - cam.scrollX, y: fixed ? b.y : b.y - cam.scrollY,
          w: b.width, h: b.height, fixed, depth: o.depth });
      }
    };
    walk(s.children.list, true);
    const r = (n) => Math.round(n);
    for (const it of items)
      if (it.fixed && (it.x < -1 || it.y < -1 || it.x + it.w > 1281 || it.y + it.h > 721))
        out.offscreen.push(`${s.scene.key} "${it.t}" x ${r(it.x)}..${r(it.x + it.w)} y ${r(it.y)}..${r(it.y + it.h)}`);
    const fx = items.filter((i) => i.fixed && i.depth < 250);
    for (let i = 0; i < fx.length; i++)
      for (let j = i + 1; j < fx.length; j++) {
        const a = fx[i], b = fx[j];
        const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ix > 3 && iy > 3 && a.t !== b.t) out.overlap.push(`${s.scene.key} "${a.t}" [${r(a.x)},${r(a.y)} d${a.depth}] x "${b.t}" [${r(b.x)},${r(b.y)} d${b.depth}]`);
      }
    // TouchControls' discs (depth 250) over any text under them
    for (const o of s.children.list)
      if (o.type === "Arc" && o.depth === 250 && o.visible)
        for (const it of fx) {
          const ix = Math.min(o.x + o.radius, it.x + it.w) - Math.max(o.x - o.radius, it.x);
          const iy = Math.min(o.y + o.radius, it.y + it.h) - Math.max(o.y - o.radius, it.y);
          if (ix > 4 && iy > 4) out.touch.push(`${s.scene.key} disc@${r(o.x)},${r(o.y)} x "${it.t}"`);
        }
  }
  return out;
}"""


def _browser_kwargs(kind: str) -> dict:
    """'chrome' (installed Google Chrome) or 'shell' (a cached headless shell, whichever version is there)"""
    if kind == "shell":
        exe = sorted(glob.glob(str(Path.home() / "Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell")))
        if not exe:
            raise RuntimeError("no cached chromium_headless_shell; use kind='chrome'")
        return {"executable_path": exe[-1], "args": ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]}
    return {"channel": "chrome"}


class Game:
    def __init__(
        self, name: str = "run", touch: bool = False, pad: bool = False, browser: str = "chrome", out: str = OUT,
        viewport: tuple[int, int] = (1280, 720), dpr: float = 1,
    ):
        self.name, self.out = name, out
        Path(out).mkdir(parents=True, exist_ok=True)
        self._pw = sync_playwright().start()
        self.browser = self._pw.chromium.launch(headless=True, **_browser_kwargs(browser))
        opts: dict = {"viewport": {"width": viewport[0], "height": viewport[1]}, "device_scale_factor": dpr}
        if touch:
            opts.update(has_touch=True, is_mobile=True)
        self.ctx = self.browser.new_context(**opts)
        self.ctx.add_init_script(INIT_NO_HMR)
        if touch:
            self.ctx.add_init_script(INIT_COARSE)
        if pad:
            self.ctx.add_init_script(INIT_PAD)
        self.ctx.route(re.compile(r".*/_bun/client/[^/]+\.js(\?.*)?$"), self._patch_main)
        self.page = self.ctx.new_page()
        self.page.set_default_timeout(20000)
        self.errors: list[str] = []
        self.page.on("console", lambda m: self.errors.append(f"console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
        self.page.on("pageerror", lambda e: self.errors.append(f"pageerror: {e}"))
        self.page.on("dialog", lambda d: d.dismiss())

    @staticmethod
    def _patch_main(route) -> None:
        resp = route.fetch()
        body = resp.text()
        patched, n = HOOK.subn(PATCH, body)
        if n != 1:
            print("WARN: main.ts game construction not found in the bundle; window.__game / __GS missing", file=sys.stderr)
        route.fulfill(response=resp, body=patched)

    # --- page ---------------------------------------------------------------
    def ev(self, js: str, arg=None):
        return self.page.evaluate(js, arg) if arg is not None else self.page.evaluate(js)

    def gs(self, body: str):
        """run `body` with G = the game's GameState; `return` a JSON-able value"""
        return self.ev(f"(() => {{ const G = window.__GS; {body} }})()")

    def active(self) -> list[str]:
        return self.ev("window.__game ? window.__game.scene.getScenes(true).map(s => s.scene.key) : []")

    def wait_scene(self, key: str, timeout: float = 20) -> bool:
        t0 = time.time()
        while time.time() - t0 < timeout:
            if key in self.active():
                return True
            self.wait(100)
        return False

    def wait(self, ms: int) -> None:
        self.page.wait_for_timeout(ms)

    def scene(self, key: str, body: str):
        """run `body` with s = that scene (its private fields are plain properties)"""
        return self.ev(f"(() => {{ const s = window.__game.scene.getScene({json.dumps(key)}); {body} }})()")

    def start(self, key: str, data: dict | None = None) -> None:
        """scene.start from the active scene; void, or evaluate tries to serialize the ScenePlugin and hangs"""
        self.ev(
            f"void window.__game.scene.getScenes(true)[0].scene.start({json.dumps(key)}, {json.dumps(data if data is not None else {})})"
        )

    def press(self, key: str, after: int = 250) -> None:
        self.page.keyboard.press(key)
        self.wait(after)

    def hold(self, key: str, ms: int) -> None:
        self.page.keyboard.down(key)
        self.wait(ms)
        self.page.keyboard.up(key)

    def pad(self, button: int, ms: int = 120, after: int = 300) -> None:
        """press a fake-pad button (standard mapping: 0 A, 1 B, 2 X, 3 Y, 8 Select, 9 Start, 12-15 d-pad); needs pad=True"""
        self.ev(f"window.__pad.buttons[{button}] = {{ pressed: true, touched: true, value: 1 }}")
        self.wait(ms)
        self.ev(f"window.__pad.buttons[{button}] = {{ pressed: false, touched: false, value: 0 }}")
        self.wait(after)

    def teleport(self, scene: str, x: float, y: float) -> None:
        """the hero to (x, y); its gear and shadow catch up only once it moves (walk a step for screenshots)"""
        self.scene(scene, f"s.player.setPosition({x}, {y}); s.player.body && s.player.body.reset({x}, {y}); return 1")

    def shot(self, name: str, clip: dict | None = None) -> str:
        path = f"{self.out}/{self.name}-{name}.png"
        self.page.screenshot(path=path, clip=clip) if clip else self.page.screenshot(path=path)
        return path

    def audit(self) -> dict:
        """screen-fixed text off the 1280x720 screen, fixed texts overlapping, __MISSING textures, touch discs over text.
        An opaque panel over the HUD band still lists the HUD texts under it as overlaps: check the screenshot."""
        return self.ev(AUDIT_JS)

    # --- game flows ---------------------------------------------------------
    def boot(self, save: dict | None = None, slot: int = 1, settings: dict | None = None) -> bool:
        """load the title, optionally on a given save (GameState.save()'s JSON) in `slot`"""
        self.page.goto(URL)
        if save is not None or settings is not None:
            self.ev(
                "([k, v, s]) => { localStorage.clear(); if (v) localStorage.setItem(k, v); if (s) localStorage.setItem('magic-world-settings', s); }",
                [f"magic-world-save-{slot}", json.dumps(save) if save else None, json.dumps(settings) if settings else None],
            )
            self.page.reload()
        ok = self.wait_scene("Title")
        self.wait(600)
        return ok

    def new_game(self, name: str = "QA") -> bool:
        """title on an empty slot: Z -> the name panel (typed) -> ENTER -> the look picker -> Z -> Town"""
        self.press("z", 700)
        self.page.keyboard.type(name, delay=60)
        self.press("Enter", 700)
        self.press("z", 300)
        return self.wait_scene("Town")

    def wait_menu(self, timeout: float = 10) -> bool:
        """in a battle, advance the text (Z) until the action menu waits"""
        t0 = time.time()
        while time.time() - t0 < timeout:
            if self.scene("Battle", "return !!s.waitingAction"):
                return True
            self.press("z", 150)
        return False

    def fight(self, key: str = "a", max_s: float = 90) -> int:
        """press `key` (A = FIGHT) whenever the menu waits, Z otherwise, until the battle ends; returns the turns"""
        t0, turns = time.time(), 0
        while time.time() - t0 < max_s and "Battle" in self.active():
            if self.scene("Battle", "return !!s.waitingAction"):
                turns += 1
                self.press(key, 150)
            else:
                self.press("z", 120)
        return turns

    def keydown_counts(self, scene: str = "Title") -> list[int]:
        """three keydowns dispatched in one go: how often the scene's keydown listener sees each (1s = no duplicates)"""
        return self.scene(
            scene,
            """const kb = s.input.keyboard, seen = new Map(), h = (e) => seen.set(e, (seen.get(e) || 0) + 1);
            kb.on('keydown', h);
            for (const k of ['KeyA', 'KeyB', 'KeyC']) window.dispatchEvent(new KeyboardEvent('keydown', { code: k, key: k[3].toLowerCase(), keyCode: k.charCodeAt(3), bubbles: true }));
            kb.off('keydown', h); return [...seen.values()];""",
        )

    def close(self) -> None:
        self.ctx.close()
        self.browser.close()
        self._pw.stop()


def smoke(touch: bool, out: str) -> int:
    g = Game("smoke-touch" if touch else "smoke", touch=touch, out=out)
    try:
        report: dict = {"title": g.boot()}
        report["town"] = g.new_game("SMOKE")
        g.wait(1500)
        report["hero"] = g.gs("return { name: G.player.name, level: G.player.level, look: G.heroLook }")
        report["screenshot"] = g.shot("town")
        report["audit"] = g.audit()
        report["keydown_counts"] = g.keydown_counts("Town")
        report["errors"] = [e for e in g.errors if "favicon" not in e]
        print(json.dumps(report, indent=1, ensure_ascii=False))
        return 0 if report["title"] and report["town"] and not report["errors"] else 1
    finally:
        g.close()


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or args[0] != "smoke":
        print(__doc__)
        sys.exit(2)
    out_dir = args[args.index("--out") + 1] if "--out" in args else OUT
    sys.exit(smoke("--touch" in args, out_dir))
