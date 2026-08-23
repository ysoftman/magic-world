import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const MAP_FILE = fileURLToPath(new URL("./src/overworldMap.ts", import.meta.url));
const MAX_MAP_BYTES = 200_000;

// Dev only: the in-game map editor (F2, then X) posts the overworld map file
// back here, so applying a layout is one keypress instead of copy-paste. It
// writes that one path and nothing else, and never ships in a build.
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
      let body = "";
      req.on("data", (chunk: Buffer) => {
        body += chunk;
        if (body.length > MAX_MAP_BYTES) req.destroy();
      });
      req.on("end", () => {
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
  },
});
