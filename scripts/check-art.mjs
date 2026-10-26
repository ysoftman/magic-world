// Guards the pixel grids in BootScene.ts against the two failure modes that are
// invisible in review but wreck a texture:
//   (a) a ragged row -- makeTexture() sizes on the LONGEST row, so one wrong row
//       widens the whole texture and shifts every row under it (the BAT_TILE bug)
//   (b) a character with no palette entry -- drawRows() silently skips it, so the
//       pixel comes out transparent (the ICE_GOLEM_TILE 'D' bug)
// TRANSPARENT ('.') is exempt from (b) on purpose: sprites and the transition
// overlays rely on it being absent from every palette. Any OTHER unmapped
// character is a bug, so the exemption is one specific character, not a mode.
// Also checks the water A/B frames stay phase-locked, and that each baked
// tileset's geometry matches what the scenes read back. The grids bake through
// Scale2x (pixelart.ts), so the last section repeats the checks that Scale2x
// could break on what it actually bakes, with the game's own scale2x().
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildRamp, scale2x } from "../src/pixelart.ts";

const SRC = fileURLToPath(new URL("../src/scenes/BootScene.ts", import.meta.url));
const src = readFileSync(SRC, "utf8");
const TRANSPARENT = ".";
const paletteColoursSafe = (name) => {
  const m = src.match(new RegExp(`const ${name} = \\{([\\s\\S]*?)\\};`));
  return m ? Object.fromEntries([...m[1].matchAll(/(\w+):\s*(0x[0-9a-fA-F]+)/g)].map(([, k, v]) => [k, parseInt(v, 16)])) : null;
};
let fails = 0;
const fail = (msg) => {
  console.log(`FAIL  ${msg}`);
  fails++;
};

// ---- parse every `const NAME = [ "..." , ... ];` grid and every palette ----
const grids = new Map();
for (const m of src.matchAll(/^const ([A-Z0-9_]+) = \[([\s\S]*?)\];$/gm)) {
  const body = m[2];
  if (!/^[\s"'.\w,]*$/.test(body) || !body.includes('"')) continue;
  grids.set(
    m[1],
    [...body.matchAll(/"([^"]*)"/g)].map((r) => r[1]),
  );
}
// single-line grids such as HERO_TORSO
for (const m of src.matchAll(/^const ([A-Z0-9_]+) = (\["[^\]]*"\]);$/gm)) {
  grids.set(
    m[1],
    [...m[2].matchAll(/"([^"]*)"/g)].map((r) => r[1]),
  );
}
const palettes = new Map();
for (const m of src.matchAll(/^const ([A-Z0-9_]+_PALETTE) = \{([\s\S]*?)\};$/gm)) {
  palettes.set(m[1], new Set([...m[2].matchAll(/(\w+):\s*0x[0-9a-fA-F]+/g)].map((p) => p[1])));
}
console.log(`parsed ${grids.size} grids, ${palettes.size} palettes`);

// ---- (a) uniform row length ----
for (const [name, rows] of grids) {
  const lens = [...new Set(rows.map((r) => r.length))];
  if (lens.length !== 1) {
    const widest = Math.max(...lens);
    fail(
      `${name}: rows are not all the same length (${lens.sort((a, b) => a - b).join("/")}); ` +
        `texture would be ${widest} wide: ` +
        rows
          .map((r, i) => (r.length === widest && lens.length > 1 ? `row ${i}=${r.length}` : null))
          .filter(Boolean)
          .join(", "),
    );
  }
}

// ---- (b) every character has a palette entry ----
// grid -> palette comes from the actual makeTexture/makeTilesetTexture calls, so
// shared grids get checked against every palette they are drawn with.
const usage = new Map(); // grid name -> Set of palette names
const use = (g, p) => {
  if (!grids.has(g)) return fail(`unknown grid ${g} referenced with ${p}`);
  if (!palettes.has(p)) return fail(`unknown palette ${p} referenced with ${g}`);
  if (!usage.has(g)) usage.set(g, new Set());
  usage.get(g).add(p);
};
// `const legs = walkFrames[i]` inside the hero loop
const ALIAS = {
  legs: ["HERO_LEGS_STRIDE_A_32", "HERO_LEGS_PASS_A_32", "HERO_LEGS_STRIDE_B_32", "HERO_LEGS_PASS_B_32"],
};
const expand = (expr) => {
  const names = [];
  for (const m of expr.matchAll(/\.\.\.(?:flipRows\()?([A-Za-z_][A-Za-z0-9_]*)/g)) names.push(m[1]);
  if (!names.length) {
    const bare = expr.trim().match(/^(?:flipRows\()?([A-Z][A-Z0-9_]*)\)?$/);
    if (bare) names.push(bare[1]);
    else return fail(`cannot resolve rows expression: ${expr.trim()}`) ?? [];
  }
  return names.flatMap((n) => ALIAS[n] ?? [n]);
};
// (an optional last argument is the cell size of a grid drawn as it stands;
// ART_PX marks a 32-cell grid, checked for its size further down)
const art32 = [];
for (const m of src.matchAll(
  /makeTexture\(\s*this,\s*[`"]([^`"]*)[`"],\s*(\[[\s\S]*?\]|[A-Za-z_][\w.]*),\s*([A-Z0-9_]+)\s*(?:,\s*([\w.]+)\s*)?\)/g,
)) {
  if (m[2].trim().startsWith("[") && m[2].includes('"') && !m[2].includes("...")) continue; // inline literal, e.g. ["dd","dd"]
  for (const g of expand(m[2])) use(g, m[3]);
  if (m[4] === "ART_PX") art32.push([m[1], m[2]]);
}
for (const m of src.matchAll(/\{\s*rows:\s*([A-Z0-9_]+),\s*palette:\s*([A-Z0-9_]+)\s*\}/g)) use(m[1], m[2]);

for (const [name, pals] of usage) {
  for (const pal of pals) {
    const allowed = palettes.get(pal);
    const bad = [...new Set(grids.get(name).join(""))].filter((c) => c !== TRANSPARENT && !allowed.has(c));
    if (bad.length) fail(`${name} drawn with ${pal} uses characters not in the palette: ${bad.map((c) => `'${c}'`).join(", ")}`);
  }
}
for (const name of grids.keys()) if (!usage.has(name)) console.log(`note  ${name} is not drawn by any makeTexture call`);

// ---- water frames must be phase-locked ----
for (const suffix of ["", "_2", "_3", "_4"]) {
  const a = grids.get(`WATER_A${suffix}`);
  const b = grids.get(`WATER_B${suffix}`);
  if (!a || !b) {
    fail(`WATER_A${suffix}/WATER_B${suffix} missing`);
    continue;
  }
  const off = a.findIndex((_, i) => b.every((row, y) => row === a[(y + i) % a.length]));
  if (off <= 0) fail(`WATER_B${suffix} is not WATER_A${suffix} at a different phase -- swapping them would jump, not ripple`);
}

// ---- every baked tileset: geometry, and the index contract it promises ----
const PIXEL = 4;
const TILE = 64; // addTilesetImage(key, key, TILE, TILE) / the frame size autotile.ts cuts
// keys may carry a skin suffix ("tiles16-snow")
const bakes = [...src.matchAll(/makeTilesetTexture\(\s*this,\s*"([a-z0-9-]+)",\s*\[([\s\S]*?)\],\s*(\d+),\s*\)/g)];
if (!bakes.length) fail("found no makeTilesetTexture calls at all");
const baked = new Map();
for (const [, key, body, size] of bakes) {
  const entries = [...body.matchAll(/\{\s*rows:\s*([A-Z0-9_]+),\s*palette:\s*([A-Z0-9_]+)\s*\}/g)].map((m) => m[1]);
  const tileSize = Number(size);
  baked.set(key, entries);
  console.log(
    `${key}: ${entries.length} tiles x ${tileSize}px x${PIXEL} = ${entries.length * tileSize * PIXEL}px wide, ${tileSize * PIXEL}px tall`,
  );
  if (tileSize * PIXEL !== TILE) fail(`${key}: tile pitch ${tileSize * PIXEL}px does not match the ${TILE}px the scenes read`);
  // 2048 is the GL_MAX_TEXTURE_SIZE floor on mobile GPUs; this game ships touch controls
  const width = entries.length * tileSize * PIXEL;
  if (width > 2048) fail(`${key} is ${width}px wide, past the 2048px GL_MAX_TEXTURE_SIZE floor on mobile -- split it`);
  for (const name of entries) {
    const rows = grids.get(name);
    if (!rows) {
      fail(`${key} bakes unknown grid ${name}`);
      continue;
    }
    if (rows.length !== tileSize || rows[0].length !== tileSize)
      fail(`${name} is ${rows[0].length}x${rows.length}, ${key} wants ${tileSize}x${tileSize}`);
  }
}

// tiles16 indices are baked into saved map data
const tiles = baked.get("tiles16");
if (!tiles) fail('no "tiles16" bake found');
else {
  // read whatever sets TILE_VARIANTS declares rather than a list of names, so a
  // set added later is covered without anyone remembering to update this
  const block = src.match(/export const TILE_VARIANTS = \{([\s\S]*?)\} as const;/);
  if (!block) fail("could not find the TILE_VARIANTS export");
  const sets = [...(block?.[1] ?? "").matchAll(/^\s*(\w+): \[([\d, ]+)\],$/gm)].map((m) => [m[1], m[2].split(",").map(Number)]);
  if (!sets.length) fail("TILE_VARIANTS declares no sets");
  const declared = sets.flatMap(([, ids]) => ids);
  const over = declared.filter((i) => i >= tiles.length);
  if (over.length) fail(`TILE_VARIANTS points at tile ${over.join(", ")} but tiles16 only has ${tiles.length}`);
  const dupes = declared.filter((v, i) => declared.indexOf(v) !== i);
  if (dupes.length) fail(`TILE_VARIANTS lists tile ${dupes.join(", ")} twice`);
  // a variation slot holding the same art as another in its set does nothing.
  // Driven off TILE_VARIANTS (index -> the grid tiles16 bakes there) instead of
  // the calm table below, which only lists the terrains that have a contrast cap
  // and so silently skipped the tree set when it was added.
  for (const [label, ids] of sets) {
    const seen = new Map();
    for (const i of ids) {
      const name = tiles[i];
      const key = (grids.get(name) ?? []).join("|");
      if (!name || !key) {
        fail(`TILE_VARIANTS.${label} index ${i} bakes no grid`);
        continue;
      }
      if (seen.has(key))
        fail(`TILE_VARIANTS.${label}: ${name} (index ${i}) is byte-identical to ${seen.get(key)} -- that variation slot does nothing`);
      else seen.set(key, `${name} (index ${i})`);
    }
    console.log(`TILE_VARIANTS.${label}: ${ids.length} distinct tiles at ${ids.join(",")}`);
  }
}

// ---- skins: a palette-swapped bake ("tiles16-snow") must be its base bake ----
// entry for entry -- same grid at every index, only the palettes differ -- or a
// map drawn with the skin shows the wrong tile (or a variation slot repeats).
const skinBase = (key) => key.replace(/-[a-z]+$/, "");
for (const [key, entries] of baked) {
  const base = skinBase(key);
  if (base === key) continue;
  const want = baked.get(base);
  if (!want) {
    fail(`${key} is a skin of "${base}", which is not baked`);
    continue;
  }
  if (entries.length !== want.length) fail(`${key} has ${entries.length} tiles, ${base} has ${want.length} -- indices would not line up`);
  const off = entries.map((name, i) => (name === want[i] ? null : `${i}: ${name} vs ${want[i]}`)).filter(Boolean);
  if (off.length) fail(`${key} bakes different grids than ${base} at ${off.join(", ")}`);
  else console.log(`${key}: same ${entries.length} grids as ${base}, in order`);
}

// ---- transition overlays: mask order, and that each tile draws a boundary ----
// The old check here demanded both transparent and opaque pixels. That was right
// for the additive design and is wrong now: these tiles cover the whole cell so
// the boundary can cut into the base layer, so all 28 are fully opaque.
// What actually matters is that a tile contains BOTH terrain families -- a tile
// filled entirely with grass, or entirely with water, draws no boundary at all
// and would silently erase the base layer's terrain instead of edging it.
// This holds by construction: mask 1..14 means at least one sampled corner is
// base and at least one is "other", and the bilinear field returns exactly those
// corner values, so the noise cannot flip either side past the midpoint.
const FAMILY = {
  shore16: { key: "SHORE", other: "WBhl", grass: "gq" },
  road16: { key: "ROAD", other: "pPSm", grass: "gq" },
};
for (const key of new Set([...Object.keys(FAMILY), ...[...baked.keys()].filter((k) => FAMILY[skinBase(k)])])) {
  const cfg = FAMILY[skinBase(key)];
  const entries = baked.get(key);
  if (!entries) {
    console.log(`note  no "${key}" bake yet`);
    continue;
  }
  const want = Array.from({ length: 14 }, (_, i) => `${cfg.key}_TILE_${i + 1}`);
  const ordered = entries.join(",") === want.join(",");
  if (!ordered) fail(`${key} is not in corner-mask 1..14 order: ${entries.join(", ")}`);
  for (const name of entries) {
    const rows = grids.get(name);
    if (!rows) continue;
    const flat = rows.join("");
    const t = [...flat].filter((c) => c === TRANSPARENT).length;
    if (t) {
      fail(`${name} has ${t} transparent px -- a placed overlay tile must cover its cell`);
      clear++;
    }
    const hasOther = [...flat].some((c) => cfg.other.includes(c));
    const hasGrass = [...flat].some((c) => cfg.grass.includes(c));
    if (!hasOther || !hasGrass) {
      fail(`${name} holds only ${hasOther ? "water/path" : "grass"} -- it draws no boundary`);
      missing++;
    }
  }
  const cover = entries.map((n) => Math.round(([...grids.get(n).join("")].filter((c) => cfg.other.includes(c)).length / 256) * 100));
  console.log(`${key}: ${ordered ? "mask 1..14 order ok" : "ORDER BROKEN"}, opaque, water/path share ${cover.join("/")}%`);
}

// the overlay's grass tones must equal the terrain's, or its fill seams against
// the base tiles it sits next to
// (each skin has its own grass and its own overlay palettes)
for (const [grass, overlays] of [
  ["GRASS_PALETTE", ["SHORE_PALETTE", "ROAD_PALETTE"]],
  ["SNOW_GRASS_PALETTE", ["SNOW_SHORE_PALETTE", "SNOW_ROAD_PALETTE"]],
  ["FOREST_GRASS_PALETTE", ["FOREST_SHORE_PALETTE", "FOREST_ROAD_PALETTE"]],
  ["CAVE_GRASS_PALETTE", ["CAVE_SHORE_PALETTE", "CAVE_ROAD_PALETTE"]],
  ["AUTUMN_GRASS_PALETTE", ["AUTUMN_SHORE_PALETTE", "AUTUMN_ROAD_PALETTE"]],
  ["FOREST_AUTUMN_GRASS_PALETTE", ["FOREST_AUTUMN_SHORE_PALETTE", "FOREST_AUTUMN_ROAD_PALETTE"]],
]) {
  const g = paletteColoursSafe(grass);
  for (const pname of overlays) {
    const p = paletteColoursSafe(pname);
    if (!p || !g) continue;
    if (p.g !== g.g) fail(`${pname}.g ${p.g?.toString(16)} != ${grass}.g ${g.g.toString(16)} -- overlay grass would seam`);
    if (p.q !== g.h) fail(`${pname}.q ${p.q?.toString(16)} != ${grass}.h ${g.h.toString(16)} -- overlay grass would seam`);
  }
}

// ---- terrain calm limits ----
// A terrain tile is the floor an actor stands on. Too many non-base cells, or
// too much luminance spread between them, and the background competes with the
// sprites on top of it -- the user's words were "grass and path look busy" and
// then "still tiring". Same metric as the lead's density.mjs (Rec.709 luma,
// share of cells that are not the base character, largest |luma - base luma|)
// so the numbers here can be compared with that report directly.
//
// LUMA SPREAD <= 8 is the real guard; the rest is slack. Three prototypes settled
// this: the calm ones carried MORE marked cells than the noisy original and
// still read as calm, because their spread was ~13 instead of 70. So there is
// deliberately no density cap here -- capping density would have blocked the
// fix. Objects are absent from this table on purpose: they SHOULD have
// contrast, and the tree/monsters/chest/coin were signed off as-is.
// Water is reported but not capped -- its foam is a shape, not scatter.
const CALM_LIMITS = {
  grass: {
    base: "g",
    palette: "GRASS_PALETTE",
    tiles: ["GRASS_TILE", "GRASS_TILE_2", "GRASS_TILE_3", "GRASS_TILE_4"],
    maxNonBasePct: 60,
    maxDarkPct: 30,
    maxLumaSpread: 20,
  },
  path: {
    base: "p",
    palette: "PATH_PALETTE",
    tiles: ["PATH_TILE", "PATH_TILE_2", "PATH_TILE_3", "PATH_TILE_4"],
    maxNonBasePct: 60,
    maxDarkPct: 30,
    maxLumaSpread: 20,
  },
  tall: { base: "g", palette: "TALL_PALETTE", tiles: ["TALL_TILE"], maxNonBasePct: 60, maxDarkPct: 30, maxLumaSpread: 20 },
  soil: { base: "s", palette: "SOIL_PALETTE", tiles: ["SOIL_TILE"], maxNonBasePct: 60, maxDarkPct: 30, maxLumaSpread: 20 },
  water: {
    base: "W",
    palette: "WATER_PALETTE",
    tiles: ["WATER_A", "WATER_A_2", "WATER_A_3", "WATER_A_4"],
    maxNonBasePct: null,
    maxDarkPct: null,
    maxLumaSpread: null,
  },
};
// The skins draw the same terrain grids, so the floor under the actors has to
// stay just as calm in their palettes.
// The autumn skins turn only the grass and the scrub; their paths and water
// are the town's and the forest's own palettes, checked above.
for (const [skin, labels] of [
  ["SNOW", ["grass", "path", "tall", "water"]],
  ["FOREST", ["grass", "path", "tall", "water"]],
  ["CAVE", ["grass", "path", "tall", "water"]],
  ["AUTUMN", ["grass", "tall"]],
  ["FOREST_AUTUMN", ["grass", "tall"]],
]) {
  for (const label of labels) {
    CALM_LIMITS[`${skin.toLowerCase()} ${label}`] = { ...CALM_LIMITS[label], palette: `${skin}_${CALM_LIMITS[label].palette}` };
  }
}
const luma = (c) => 0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255);
const paletteColours = (name) => {
  const m = src.match(new RegExp(`const ${name} = \\{([\\s\\S]*?)\\};`));
  return Object.fromEntries([...m[1].matchAll(/(\w+):\s*(0x[0-9a-fA-F]+)/g)].map(([, k, v]) => [k, parseInt(v, 16)]));
};
console.log("\nterrain calm (share of cells that are not the base char; luma spread vs base):");
for (const [label, cfg] of Object.entries(CALM_LIMITS)) {
  const colours = paletteColours(cfg.palette);
  const baseLuma = luma(colours[cfg.base]);
  let total = 0;
  const perChar = {};
  for (const name of cfg.tiles) {
    const rows = grids.get(name);
    if (!rows) {
      fail(`calm check: no grid ${name}`);
      continue;
    }
    for (const row of rows)
      for (const ch of row) {
        total++;
        if (ch !== cfg.base) perChar[ch] = (perChar[ch] ?? 0) + 1;
      }
  }
  if (!total) continue;
  const pct = (n) => (n / total) * 100;
  const nonBase = pct(Object.values(perChar).reduce((a, b) => a + b, 0));
  const spread = Math.max(0, ...Object.keys(perChar).map((ch) => Math.abs(luma(colours[ch]) - baseLuma)));
  // "dark" = every non-base char darker than the base; scattered dark cells read
  // as grit rather than texture, which is why they get their own limit
  const dark = pct(
    Object.entries(perChar)
      .filter(([ch]) => luma(colours[ch]) < baseLuma)
      .reduce((a, [, n]) => a + n, 0),
  );
  const detail = Object.entries(perChar)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([ch, n]) =>
        `${ch}(${luma(colours[ch]) - baseLuma >= 0 ? "+" : ""}${(luma(colours[ch]) - baseLuma).toFixed(0)}) ${pct(n).toFixed(1)}%`,
    )
    .join("  ");
  const limit = (v, cap, what) => {
    if (cap === null) return `${v.toFixed(1)}`;
    if (v > cap) {
      fail(`${label} ${what} is ${v.toFixed(1)}, over the ${cap} limit -- terrain must stay calm under the sprites`);
      return `${v.toFixed(1)}>${cap}`;
    }
    return `${v.toFixed(1)}<=${cap}`;
  };
  console.log(
    `  ${label.padEnd(12)} non-base ${limit(nonBase, cfg.maxNonBasePct, "non-base share")}%  dark ${limit(dark, cfg.maxDarkPct, "dark-cell share")}%  luma spread ${limit(spread, cfg.maxLumaSpread, "luma spread")}`,
  );
  console.log(`         ${detail}`);
}

// ---- the baked result: what Scale2x makes of the grids ----
// BootScene.buildTextures() names the grids that stay blocky (keepBlocky) and
// the ones smoothed only across a terrain edge (smoothBoundaryOnly); every
// other grid bakes through plain Scale2x. A tile bakes with its edges clamped.
const callNames = (fn) => {
  const m = src.match(new RegExp(`${fn}\\(([\\s\\S]*?)\\);`));
  if (!m) return null;
  return { family: m[1].match(/^\s*"([^"]*)"/)?.[1], names: [...m[1].matchAll(/\b([A-Z][A-Z0-9_]+)\b/g)].map((n) => n[1]) };
};
const blockyCall = callNames("keepBlocky");
const boundaryCall = callNames("smoothBoundaryOnly");
if (!blockyCall) fail("no keepBlocky(...) call in BootScene -- every grid would bake through Scale2x");
if (!boundaryCall) fail("no smoothBoundaryOnly(...) call in BootScene -- the transitions' fill would bend");
const blocky = new Set(blockyCall?.names ?? []);
const boundaryOf = new Map((boundaryCall?.names ?? []).map((n) => [n, boundaryCall.family]));
for (const n of [...blocky, ...boundaryOf.keys()]) if (!grids.has(n)) fail(`${n} is listed for its bake but is no grid`);
// a blocky grid is shown at the same 2x cell resolution, so both compare cell for cell
const doubled = (rows) =>
  rows.flatMap((r) => {
    const d = [...r].map((c) => c + c).join("");
    return [d, d];
  });
const bakeTile = (name) => {
  const rows = grids.get(name);
  return blocky.has(name) ? doubled(rows) : scale2x(rows, "clamp", boundaryOf.get(name));
};
console.log(`\nbaked through Scale2x: ${blocky.size} grids kept blocky, ${boundaryOf.size} smoothed across "${boundaryCall?.family}" only`);

// water A/B: B still A at a phase, now 2 rows a step
for (const suffix of ["", "_2", "_3", "_4"]) {
  if (!grids.has(`WATER_A${suffix}`)) continue;
  const a = bakeTile(`WATER_A${suffix}`);
  const b = bakeTile(`WATER_B${suffix}`);
  if (a.findIndex((_, i) => b.every((row, y) => row === a[(y + i) % a.length])) <= 0)
    fail(`baked WATER_B${suffix} is not baked WATER_A${suffix} at a phase -- the ripple would jump`);
}

// transitions: still opaque, still both terrains
for (const [key, cfg] of Object.entries(FAMILY)) {
  for (const name of baked.get(key) ?? []) {
    const flat = bakeTile(name).join("");
    if (flat.includes(TRANSPARENT)) fail(`baked ${name} has transparent px -- Scale2x opened a hole in the overlay`);
    if (![...flat].some((c) => cfg.other.includes(c)) || ![...flat].some((c) => cfg.grass.includes(c)))
      fail(`baked ${name} lost one of its terrains`);
  }
}

// Seams: a tile bakes alone, its edge clamped, so where a coastline crosses
// from one transition into the next the two halves may round off a cell
// differently than one bake of both would. Every pair of tiles that can sit
// side by side (the corners they share agree; mask bit 0 TL, 1 TR, 2 BL,
// 3 BR, 1 = water/path; 0 and 15 are the base tiles) is baked both ways and
// compared on the cells either side of the seam. One diagonal step (<= 4
// 2px cells) is the most a smoothed edge may differ by; anything more is the
// fill bending across tiles.
const SEAM_MAX = 4;
for (const key of Object.keys(FAMILY)) {
  const names = baked.get(key);
  if (!names) continue;
  const base = { 0: "GRASS_TILE", 15: key === "shore16" ? "WATER_A" : "PATH_TILE" };
  const nameOf = (m) => base[m] ?? names[m - 1];
  const joinedBake = (rows) => scale2x(rows, "clamp", boundaryOf.get(names[0]));
  const bit = (m, i) => (m >> i) & 1;
  let worst = 0;
  let pairs = 0;
  for (let a = 0; a < 16; a++)
    for (let b = 0; b < 16; b++) {
      if (base[a] && base[b]) continue;
      const [A, B] = [grids.get(nameOf(a)), grids.get(nameOf(b))];
      const [bA, bB] = [bakeTile(nameOf(a)), bakeTile(nameOf(b))];
      const sides = [];
      if (bit(a, 1) === bit(b, 0) && bit(a, 3) === bit(b, 2))
        sides.push([joinedBake(A.map((r, y) => r + B[y])), bA.map((r, y) => r + bB[y]), (_y, x) => x >= 28 && x < 36]);
      if (bit(a, 2) === bit(b, 0) && bit(a, 3) === bit(b, 1))
        sides.push([joinedBake([...A, ...B]), [...bA, ...bB], (y) => y >= 28 && y < 36]);
      for (const [joined, apart, near] of sides) {
        pairs++;
        let d = 0;
        joined.forEach((row, y) => {
          for (let x = 0; x < row.length; x++) if (near(y, x) && row[x] !== apart[y][x]) d++;
        });
        worst = Math.max(worst, d);
        if (d > SEAM_MAX) fail(`${key}: ${nameOf(a)} beside ${nameOf(b)} differs at the seam by ${d} cells (> ${SEAM_MAX})`);
      }
    }
  console.log(`${key}: ${pairs} neighbouring pairs, worst seam ${worst} 2px cells (<= ${SEAM_MAX})`);
}

// terrain calm, measured on the baked cells
for (const [label, cfg] of Object.entries(CALM_LIMITS)) {
  if (cfg.maxLumaSpread === null) continue;
  const colours = paletteColours(cfg.palette);
  const baseLuma = luma(colours[cfg.base]);
  const cells = cfg.tiles.flatMap((n) => (grids.has(n) ? bakeTile(n).join("") : "").split(""));
  const off = cells.filter((c) => c !== cfg.base);
  const nonBase = (off.length / cells.length) * 100;
  const dark = (off.filter((c) => luma(colours[c]) < baseLuma).length / cells.length) * 100;
  const spread = Math.max(0, ...off.map((c) => Math.abs(luma(colours[c]) - baseLuma)));
  if (nonBase > cfg.maxNonBasePct || dark > cfg.maxDarkPct || spread > cfg.maxLumaSpread)
    fail(`baked ${label}: non-base ${nonBase.toFixed(1)}% dark ${dark.toFixed(1)}% spread ${spread.toFixed(1)} -- over its calm limits`);
}
console.log("baked terrain stays within its calm limits");

// ---- 32-cell grids: drawn at ART_PX as they stand, 32 wide, stacking to 32 ----
// (a texture of 32 cells x 2px is the 64px every other sprite bakes to)
for (const [key, expr] of art32) {
  const parts = [...expr.matchAll(/\.\.\.(?:flipRows\()?([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => ALIAS[m[1]]?.[0] ?? m[1]);
  if (!parts.length) parts.push(expr.trim().replace(/^flipRows\(|\)$/g, ""));
  const narrow = parts.filter((n) => grids.get(n)?.[0]?.length !== 32);
  if (narrow.length) fail(`${key} is drawn at ART_PX but ${narrow.join(", ")} is not 32 cells wide`);
  const tall = parts.reduce((n, name) => n + (grids.get(name)?.length ?? 0), 0);
  if (tall !== 32) fail(`${key} stacks its 32-cell grid to ${tall} rows, not 32`);
}
console.log(`${art32.length} textures drawn from 32-cell grids at ART_PX, each 32x32`);

// BLUE's light and shade in HERO_PALETTE must be what heroShades() derives
// from BLUE's own colours, or picking BLUE again would redraw it differently
// from the hero BootScene bakes
{
  const hero = paletteColours("HERO_PALETTE");
  const [hair, tunic, trousers] = [buildRamp(hero.h), buildRamp(hero.t), buildRamp(hero.p)];
  const want = { H: hair[3], d: hair[1], T: tunic[3], u: tunic[1], P: trousers[1] };
  for (const [k, v] of Object.entries(want))
    if (hero[k] !== v) fail(`HERO_PALETTE.${k} is ${hero[k]?.toString(16)}, but heroShades gives BLUE ${v.toString(16)}`);
}

console.log(fails ? `\n${fails} problem(s)` : "\nall grid checks passed");
process.exit(fails ? 1 : 0);
