// Guards the sound kit (src/sfxKit.ts, designing-retro-arcade-sound-kits)
// against effects that drift into background music or out of the music's key
// without anyone hearing it in review. Every program registered through
// registerSfx() must keep: its id equal to its kit key, 1..24 steps, an SE
// within 0.6s and a jingle within 1.6s, a one-line sound target, and tonal
// pitches on the white keys unless it declares { offKey: reason }. No key may
// be registered by two tables (the later one silently replaces the sound).
//
// The tables are found, not listed: every src module with a top-level
// registerSfx( call is imported, so a new kit file is checked from its first
// commit. Such a module has to load under Bun (no Phaser import).
import { kitPrograms, programLength, registryClashes, SFX_BUDGET, type SfxProgram, validateKit, validateProgram } from "../src/sfxKit";

const srcDir = `${import.meta.dir}/../src`;
let fails = 0;
const fail = (msg: string): void => {
  console.log(`FAIL  ${msg}`);
  fails++;
};

const registering: string[] = [];
for (const f of [...new Bun.Glob("**/*.ts").scanSync(srcDir)].sort()) {
  if (/^\s*registerSfx\(/m.test(await Bun.file(`${srcDir}/${f}`).text())) registering.push(f);
}
if (registering.length === 0) fail("no module calls registerSfx(");
// sfxKit.ts registered its own table when this script imported it above
const ownTable = Object.keys(kitPrograms()).length;
for (const f of registering) {
  const before = Object.keys(kitPrograms()).length;
  try {
    await import(`${srcDir}/${f}`);
  } catch (e) {
    fail(`src/${f} did not load under Bun: ${e instanceof Error ? e.message : e}`);
    continue;
  }
  const added = f === "sfxKit.ts" ? ownTable : Object.keys(kitPrograms()).length - before;
  console.log(`src/${f}: ${added} programs`);
}

const kit = kitPrograms();
for (const line of validateKit(kit)) fail(line);
for (const line of registryClashes()) fail(line);

// the validator itself must still reject what it claims to
const mustFail: Record<string, SfxProgram> = {
  "off key": { id: "off key", kind: "se", target: "t", pitch: "key", steps: [{ at: 0, dur: 0.1, wave: "square", freq: 600, vol: 0.05 }] },
  "too long": {
    id: "too long",
    kind: "se",
    target: "t",
    pitch: "none",
    steps: [{ at: 0.5, dur: 0.2, wave: "noise", freq: 9000, vol: 0.05 }],
  },
  "id drift": {
    id: "copied",
    kind: "jingle",
    target: "t",
    pitch: "none",
    steps: [{ at: 0, dur: 0.1, wave: "noise", freq: 9000, vol: 0.05 }],
  },
  "too many steps": {
    id: "too many steps",
    kind: "jingle",
    target: "t",
    pitch: "none",
    steps: Array.from({ length: SFX_BUDGET.steps + 1 }, () => ({ at: 0, dur: 0.1, wave: "noise" as const, freq: 9000, vol: 0.01 })),
  },
  "no target": {
    id: "no target",
    kind: "se",
    target: " ",
    pitch: "none",
    steps: [{ at: 0, dur: 0.1, wave: "noise", freq: 9000, vol: 0.05 }],
  },
};
for (const [key, p] of Object.entries(mustFail)) {
  if (validateProgram(key, p).length === 0) fail(`the validator let a bad program through (${key})`);
}

const programs = Object.values(kit);
const longest = (kind: SfxProgram["kind"]): string => {
  const own = programs.filter((p) => p.kind === kind);
  if (own.length === 0) return "none";
  const p = own.reduce((a, b) => (programLength(b) > programLength(a) ? b : a));
  return `${p.id} ${programLength(p).toFixed(2)}s / ${SFX_BUDGET[kind]}s`;
};
const offKey = programs.filter((p) => typeof p.pitch === "object").length;
console.log(
  `${programs.length} programs: ${programs.filter((p) => p.kind === "se").length} SE (longest ${longest("se")}), ` +
    `${programs.filter((p) => p.kind === "jingle").length} jingles (longest ${longest("jingle")}), ${offKey} declared off-key`,
);
console.log(fails ? `${fails} failure(s)` : "sound kit OK");
process.exit(fails ? 1 : 0);
