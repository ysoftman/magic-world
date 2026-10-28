// Dev server: `bun run dev`, http://localhost:5199/ (AGENTS.md: one server,
// that port). Bun bundles index.html on request and hot-reloads on save; the
// bundler's plugin (bunfig.toml [serve.static]) puts the commit hash in.
import index from "../index.html";

const PORT = 5199;
const MAP_FILE = new URL("../src/overworldMap.ts", import.meta.url);
const MAX_MAP_BYTES = 200_000;
// MapEditor sends it with the file; see the checks below
const MAP_EDITOR_HEADER = "x-map-editor";

// the request came from a page this dev server served, by its Origin
function sameOrigin(origin: string | null, host: string | null): boolean {
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

const server = Bun.serve({
  port: PORT,
  hostname: "localhost",
  development: { hmr: true },
  // the map file is the only body this server takes
  maxRequestBodySize: MAX_MAP_BYTES,
  routes: {
    "/": index,
    // The in-game map editor (F2, then X) posts the overworld map file back
    // here, so applying a layout is one keypress instead of copy-paste. It
    // writes that one path and nothing else, and never ships in a build. Only
    // the game's own page may write it: any other site open in the browser
    // could send a no-cors "simple" POST here and overwrite a source file. So
    // the Origin must be this server, the editor's custom header must be there
    // (another origin can't add one without a CORS preflight), and the body
    // must still be a map file.
    "/__map": {
      async POST(req) {
        if (!sameOrigin(req.headers.get("origin"), req.headers.get("host")) || req.headers.get(MAP_EDITOR_HEADER) !== "1") {
          return new Response("the map editor only", { status: 403 });
        }
        const body = await req.text();
        if (!/^export const OVERWORLD_MAP = \{/m.test(body)) return new Response("not a map file", { status: 400 });
        await Bun.write(MAP_FILE, body);
        return new Response("ok");
      },
    },
  },
});
console.log(`dev: ${server.url}`);
