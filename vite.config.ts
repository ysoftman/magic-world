import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const MAP_FILE = fileURLToPath(new URL("./src/overworldMap.ts", import.meta.url));
const MAX_MAP_BYTES = 200_000;
// MapEditor sends it with the file; see the checks below
const MAP_EDITOR_HEADER = "x-map-editor";

// the request came from a page this dev server served, by its Origin
function sameOrigin(origin: string | undefined, host: string | undefined): boolean {
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// Dev only: the in-game map editor (F2, then X) posts the overworld map file
// back here, so applying a layout is one keypress instead of copy-paste. It
// writes that one path and nothing else, and never ships in a build. Only the
// game's own page may write it: any other site open in the browser could send
// a no-cors "simple" POST here and overwrite a source file. So the Origin must
// be this server, the editor's custom header must be there (another origin
// can't add one without a CORS preflight), and the body must still be a map
// file.
const mapWriter: Plugin = {
  name: "overworld-map-writer",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use("/__map", (req, res) => {
      if (req.method !== "POST") {
        res.statusCode = 405;
        res.end("POST only");
        return;
      }
      if (!sameOrigin(req.headers.origin, req.headers.host) || req.headers[MAP_EDITOR_HEADER] !== "1") {
        res.statusCode = 403;
        res.end("the map editor only");
        return;
      }
      let body = "";
      req.on("data", (chunk: Buffer) => {
        body += chunk;
        if (body.length > MAX_MAP_BYTES) req.destroy();
      });
      req.on("end", () => {
        if (!/^export const OVERWORLD_MAP = \{/m.test(body)) {
          res.statusCode = 400;
          res.end("not a map file");
          return;
        }
        writeFile(MAP_FILE, body).then(
          () => res.end("ok"),
          (err: Error) => {
            res.statusCode = 500;
            res.end(err.message);
          },
        );
      });
    });
  },
};

export default defineConfig({
  base: "./",
  plugins: [mapWriter],
  server: {
    port: 5199,
    open: true,
  },
  build: {
    target: "es2020",
    rolldownOptions: {
      output: {
        // Phaser (the only dependency) in its own chunk: its hash only moves
        // when the package does, so a deploy that changes just the game keeps
        // the engine cached in players' browsers
        codeSplitting: {
          groups: [{ name: "vendor", test: /[\\/]node_modules[\\/]/ }],
        },
      },
    },
  },
});
