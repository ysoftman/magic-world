// Production build: `bun run build` (tsc first). Bundles index.html into
// dist/ with relative URLs, so the page works under GitHub Pages' /<repo>/.
import { rm } from "node:fs/promises";
import buildInfo from "./buildInfoPlugin";

await rm("dist", { recursive: true, force: true });
const result = await Bun.build({
  // src/vendor.ts only splits Phaser into its own chunk (see that file)
  entrypoints: ["index.html", "src/vendor.ts"],
  outdir: "dist",
  splitting: true,
  minify: true,
  // the dev-only code paths (CTRL+G gold) drop out of the bundle
  define: { "process.env.NODE_ENV": '"production"' },
  // the commit hash in the version tag, as the dev server has it (bunfig.toml)
  plugins: [buildInfo],
});
// its own output: nothing loads it
await rm("dist/src", { recursive: true });

for (const out of result.outputs) console.log(`${out.path.slice(process.cwd().length + 1).padEnd(40)} ${(out.size / 1024).toFixed(1)} KB`);
