// Bakes the commit's short hash into src/buildInfo.ts for the version tag. A
// Bun plugin, so the dev server (bunfig.toml [serve.static]) and
// scripts/build.ts get the same constant: bunfig's `env = "BUN_PUBLIC_*"`
// only inlines variables the process was started with (not ones dev.ts would
// set), and leaves `process.env.X` in the bundle when one is missing, which
// the browser has no `process` for. Without git, or in a copy that isn't the
// repository (an archive, maybe unpacked inside some other repo), the file
// keeps its own "" and the tag shows the bare version.
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

function gitHash(): string {
  if (!existsSync(join(ROOT, ".git"))) return "";
  try {
    const out = Bun.spawnSync(["git", "rev-parse", "--short", "HEAD"], { cwd: ROOT, stderr: "ignore" });
    const hash = out.stdout.toString().trim();
    return out.success && /^[0-9a-f]+$/.test(hash) ? hash : "";
  } catch {
    // no git on the PATH
    return "";
  }
}

export default {
  name: "build-info",
  setup(build: { onLoad: (opts: { filter: RegExp }, load: () => { contents: string; loader: "ts" }) => void }) {
    // read when the file is loaded: once per build, and once per dev server
    // (its hot reloads of other files keep it; a commit alone reloads nothing)
    build.onLoad({ filter: /[\\/]src[\\/]buildInfo\.ts$/ }, () => ({
      contents: `export const GIT_HASH: string = ${JSON.stringify(gitHash())};`,
      loader: "ts",
    }));
  },
};
