import { type MonsterZone, T_PATH, T_ROCK, T_TALL, T_WATER_A, TILE } from "./levels";

// The ABYSS: a post-game dive down a stair at the bottom of THE CAVE, one
// small generated floor after another, until the hero turns back or falls.
// Everything here is pure — the floor generator, the depth scaling and the
// encounter tables — so AbyssScene draws the floor it is handed, BattleScene
// scales the foe it is told about, and a bun script can walk thousands of
// floors (BFS reachability, zones clear of chests and stairs) without Phaser.
//
// Rules, and why:
// - HP and MP carry from floor to floor; only a won fight's usual +5 HP / +2
//   MP, spells and items heal. The stair back up (TOWN) is on every floor, so
//   turning back is always one walk away; dying is the usual defeat (half the
//   gold, woken in town), which is what keeps a deep run a gamble.
// - Every ABYSS_BOSS_EVERY floors a GUARDIAN — a boss already beaten, in story
//   order — sits on the stair down, and the stair stays sealed until it falls.
//   It is a rematch, not a chapter: BattleScene sets no quest flag, ticks no
//   bounty/ELDER/HUNTER kill counter and rolls no ending or epilogue for
//   anything fought down here (see its `abyss` branches), and a guardian
//   can't be caught (no free TROLL KING). A catch is a catch, though: an
//   ordinary foe caught down here counts for the HUNTER's catch job and his
//   fire-beast job like one caught anywhere, as both read the catch list.
// - A fallen GUARDIAN makes the floor below it a checkpoint (B6, B11...,
//   GameState.abyssCheckpoint, the deepest only): the cave's stair then
//   offers a dive from there instead of B1. Nothing else is kept — the
//   floor in progress isn't saved, so a reload or a quit to the title loses
//   at most five floors — and a checkpoint start brings the HP and MP the
//   hero walks in with, no refill (the town's HOME is the place for that).
//   It is kept through NEW GAME+ like the record beside it; B1 is always
//   still offered when the cycle's harder foes put it out of reach.
// - The stair up asks before it leaves (STAY first, and on ESC: walking onto
//   it by mistake ended deep runs), and leaving by it from B2 down opens a
//   portal there (GameState.abyssPortal, saved the moment LEAVE is picked,
//   so a reload or a quit to the title leaves none): the cave's stair then
//   offers the deeper of it and the checkpoint. The walk home to rest and
//   back is its price, so it costs nothing else. It is used up once taken,
//   and gone on a fall anywhere down here, so a death still costs the
//   floors; a dive from B1 leaves it waiting, and leaving again keeps the
//   deeper of the two. The floor is built anew and the hero walks in with HP
//   and MP as they are, as from a checkpoint; NEW GAME+ keeps it on the same
//   terms.
// - No day or night underground: no night stat/loot shift, no night
//   encounter rate, a standing gloom instead of the clock's.
export const ABYSS_W = 22;
export const ABYSS_H = 15;
export const ABYSS_BOSS_EVERY = 5;
// the deepest floor a portal or checkpoint can name: every floor label
// ("ABYSS B999", "A PORTAL WAITS AT B999.") is sized for three digits
export const ABYSS_FLOOR_MAX = 999;

// the portal left by taking the stair up from `floor`: none from B1, and
// never shallower than one already waiting
export const portalOnLeave = (floor: number, portal: number): number => (floor >= 2 ? Math.max(floor, portal) : portal);

// where a dive from the cave's stair may start instead of B1: the deeper of
// the portal and the checkpoint (the portal on a tie, so taking it uses it
// up), or null when neither is past B1
export function abyssResume(portal: number, checkpoint: number): { floor: number; portal: boolean } | null {
  const floor = Math.max(portal, checkpoint);
  if (floor <= 1) return null;
  return { floor, portal: portal >= checkpoint };
}

// The stair opens once the FLAME DRAKE has fallen. NEW GAME+ wipes that flag,
// but only a hero who has beaten the drake can start a cycle, so the stair
// stays open through every replay — like the record it keeps (abyssBest).
export function abyssOpen(q: { volcanoBoss: boolean }, ngPlus: number): boolean {
  return q.volcanoBoss || ngPlus > 0;
}

// Depth scaling, multiplied onto NEW GAME+'s (GameState.enemyScale) for every
// fight down here:
// - stat: +6% HP/ATK a floor below B1. The product with NEW GAME+ stops at
//   ABYSS_STAT_CAP: at x4 the hardest ordinary blow (SALAMANDER, ATK 21 -> 84)
//   crits a Lv30 hero in GLACIER MAIL (DEF ~45, HP ~195) for at most
//   2 x (1.2 x 84 - 45) = 112, so a full-HP hero can't be one-shot by a roll
//   it had no answer to; past the cap a run still ends, by attrition (three
//   capped fights empty that HP bar). A first playthrough reaches the cap at
//   B51, NEW GAME+1 (x1.5) at B29, NEW GAME+3 (x2.5) at B11. HP is clamped
//   to 999 on top (BattleScene: the enemy window holds three digits).
// - loot: gold/EXP +2% a floor, a third of the stat step, so each floor down
//   costs more than it pays; capped at x2 with NEW GAME+'s. A GUARDIAN pays
//   ABYSS_GUARDIAN_GOLD_SHARE of its (scaled) gold, as the ARENA pays a cut:
//   its first kill already paid in full. The yardstick is hunting the
//   VOLCANO by day: 62.3 G a fight (its 40/35/25 MAGMA SLIME / FIRE IMP /
//   SALAMANDER mix). The lost balance sim (/tmp/pwcheck/sim, report.ts and
//   econ.ts: the game's battle rules, a fight's time timed in the live game
//   — ~10-12s for a two-round volcano fight, ~6-9s for a one-round cave
//   one) puts a fight every ~26s with the encounter waits, 125-145 an hour:
//   8.5-9.0k G/h without the win streak, 15.4-16.2k with it (the streak
//   sits at 8+ there and pays down here too, so the ratios below hold
//   either way). A dive in that sim, a Lv30 hero in the forged kit who
//   fights all ~6 foes a floor and drinks between fights, 10 POTIONs and
//   5 HI-POTIONs bought for it, chests left out: B1 to B10 ~0.75x the
//   field (the early floors' weak roster), B1 to B20 ~1.25x (80% get
//   there), a checkpoint start from B11 to B20 ~1.75x (82%); at Lv24 B1 to
//   B20 is ~0.8x and only a quarter get there. From B21 it ends in a fall
//   (the B25 FLAME DRAKE at x2.44 after nine floors of attrition): ~0.85x
//   with the deaths' half purses. Met fresh at Lv30 in the forged kit with
//   the TALISMAN, ten HI-POTIONs, BEAN SOUP and the WOLF, the B25 DRAKE
//   falls 26% of the time (as often without the TALISMAN: it neither
//   poisons nor freezes), the B45 GLACIER GOLEM 58% (1% without the
//   TALISMAN: frozen), the B50 DRAKE never — the floor no dive gets past, by
//   design, even at REFINE +5 (drops.ts); alone, none of the three falls.
//   That the B25 DRAKE stands firmer than the deeper GOLEM is seen and left
//   as it is. Those are the repo's sim, not the lost one:
//   `bun run sim:battle --abyss 25 --level 30 --potions 0
//   --hipotions 10 --talisman --meal def --n 20000`, its WOLF+GEAR column
//   (45 and 50 likewise; runs agree within a point). (Steps chosen
//   on the earlier ~20s-a-fight model: 0.03 with guardians in full made
//   B21-25 2.7x, 0.01 with a quarter share left a dive to B30 no better
//   than the field.) The ARENA's all-five run pays ~2.2x the streakless
//   hunt and ~1.2x the streak one (arena.ts); a deep checkpoint dive can
//   beat it, and every fight that deep still risks half the purse. The
//   portal (above) undoes the sim's attrition: a hero low on HP can walk
//   home to rest and come back to the same floor, so deep floors are easier
//   to reach than these one-go figures, at the price of the walk. Slipping
//   past roamers instead of fighting them all (there is always a way round,
//   see the zones below) eases it too, and isn't in the sim either.
//   Gold also stops at MAX_GOLD (9999) whatever the source.
// - materials: drops.ts rollDrop as anywhere else, the count x2 from B11 and
//   x3 from B21. The shop won't buy materials, so this is forge and delivery
//   stock, not gold.
export const ABYSS_STAT_STEP = 0.06;
export const ABYSS_STAT_CAP = 4;
export const ABYSS_LOOT_STEP = 0.02;
export const ABYSS_LOOT_CAP = 2;
export const ABYSS_GUARDIAN_GOLD_SHARE = 0.3;
const DROP_MULT_EVERY = 10;
const DROP_MULT_CAP = 3;

// what BattleScene is told about a fight that started down here
export interface AbyssBout {
  floor: number;
  // the floor's GUARDIAN: uncatchable, and its fall unseals the stair
  guardian: boolean;
}

export function abyssScale(floor: number, ng: { stat: number; loot: number }): { stat: number; loot: number } {
  const depth = Math.max(0, floor - 1);
  return {
    stat: Math.min(ABYSS_STAT_CAP, ng.stat * (1 + ABYSS_STAT_STEP * depth)),
    loot: Math.min(ABYSS_LOOT_CAP, ng.loot * (1 + ABYSS_LOOT_STEP * depth)),
  };
}

export function abyssDropMult(floor: number): number {
  return Math.min(DROP_MULT_CAP, 1 + Math.floor(Math.max(0, floor - 1) / DROP_MULT_EVERY));
}

// The roster by depth, ENEMIES keys: the regions' own foes in the order the
// story meets them, a new region's every TIER_FLOORS floors, mixed with the
// one before it (NEWEST_SHARE of the rolls the newer). B1-4 the cave and
// fields, B5-8 the forest, B9-12 the snow field, B13 on the volcano. The rare
// jackpots (GOLDEN SLIME, CURSED GOBLIN, NIGHT WISP) stay out: their payouts
// assume they're rare, and the bosses only come as GUARDIANS.
const TIERS: readonly (readonly string[])[] = [
  ["slime", "goblin", "bat", "wolf"],
  ["wasp", "spider", "orc"],
  ["frostMoth", "yeti"],
  ["magmaSlime", "fireImp", "salamander"],
];
const TIER_FLOORS = 4;
const NEWEST_SHARE = 0.6;

export function abyssKind(floor: number, rand: () => number = Math.random): string {
  const newest = Math.min(TIERS.length - 1, Math.floor(Math.max(0, floor - 1) / TIER_FLOORS));
  const tier = newest > 0 && rand() >= NEWEST_SHARE ? TIERS[newest - 1] : TIERS[newest];
  return tier[Math.floor(rand() * tier.length)];
}

// every species abyssKind can roll, for the check script
export const ABYSS_ROSTER: readonly string[] = TIERS.flat();

// the beaten bosses in story order, B5, B10 ... B25, then round again
// (harder each time, the depth scaling keeps climbing)
export const ABYSS_GUARDIANS: readonly string[] = ["king", "troll", "mossGolem", "iceGolem", "flameDrake"];

export function abyssGuardian(floor: number): string | null {
  if (floor <= 0 || floor % ABYSS_BOSS_EVERY !== 0) return null;
  return ABYSS_GUARDIANS[(floor / ABYSS_BOSS_EVERY - 1) % ABYSS_GUARDIANS.length];
}

export interface Cell {
  tx: number;
  ty: number;
}

// a monster zone (px, like every scene's) and the kind of each roamer in it
export interface AbyssZone extends MonsterZone {
  kinds: string[];
}

export interface AbyssFloor {
  floor: number;
  // the logical grid: T_PATH floor, T_ROCK walls and boulders, T_WATER_A
  // pools, T_TALL for the roamers' zones (the cave skin draws it as a darker
  // floor, the way tall grass marks zones outside)
  tiles: number[][];
  up: Cell; // the stair back to town
  spawn: Cell; // where the hero lands: beside `up`, never on it
  down: Cell; // the stair to the next floor
  chest: Cell | null;
  zones: AbyssZone[];
  // a GUARDIAN floor's boss (ENEMIES key) and the box it roams, on the stair
  guardian: string | null;
  lair: MonsterZone | null;
}

export const cellCenter = (c: Cell): { x: number; y: number } => ({ x: c.tx * TILE + TILE / 2, y: c.ty * TILE + TILE / 2 });

// The floor's seed: the run's own (rolled when the dive starts), the floor
// and the NEW GAME+ cycle, so every run digs a different abyss while one run
// can rebuild the floor it left for a battle exactly as it was.
export function floorSeed(runSeed: number, floor: number, cycle: number): number {
  let h = (Math.imul(runSeed ^ Math.imul(floor, 0x27d4eb2f), 0x9e3779b1) + Math.imul(cycle + 1, 0x165667b1)) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

// mulberry32: small, fast, and the same sequence on every engine
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Floor `floor` of the run rolled from `seed` (floorSeed). Pure and deterministic. */
export function generateFloor(floor: number, seed: number): AbyssFloor {
  const rand = mulberry32(seed);
  const guardian = abyssGuardian(floor);
  if (guardian) return guardianFloor(floor, guardian, rand);
  for (let attempt = 0; attempt < CARVE_ATTEMPTS; attempt++) {
    const grid = carve(rand);
    const furnished = grid && furnish(floor, grid, rand);
    if (furnished) return furnished;
  }
  // never seen in the check script's seeds, but a run must not be able to
  // dead-end: an open hall always furnishes
  return furnish(floor, hall(), rand) as AbyssFloor;
}

// Cave carving: a random fill smoothed by a cellular automaton (a cell turns
// rock with 5+ rock neighbours, floor with 3 or fewer), then everything but
// the largest open pocket filled in, so nothing on the floor is cut off.
// ROCK_FILL 0.42 and four passes give caves ~50-60% open with 1-3 tile
// passages; MIN_OPEN rejects the odd cramped one.
const ROCK_FILL = 0.42;
const SMOOTH_PASSES = 4;
const MIN_OPEN = 110;
const CARVE_ATTEMPTS = 24;

const inside = (x: number, y: number): boolean => x > 0 && y > 0 && x < ABYSS_W - 1 && y < ABYSS_H - 1;

function hall(): number[][] {
  return Array.from({ length: ABYSS_H }, (_, y) => Array.from({ length: ABYSS_W }, (_, x) => (inside(x, y) ? T_PATH : T_ROCK)));
}

function carve(rand: () => number): number[][] | null {
  let g = Array.from({ length: ABYSS_H }, (_, y) =>
    Array.from({ length: ABYSS_W }, (_, x) => (!inside(x, y) || rand() < ROCK_FILL ? T_ROCK : T_PATH)),
  );
  for (let pass = 0; pass < SMOOTH_PASSES; pass++) {
    const next = g.map((row) => [...row]);
    for (let y = 1; y < ABYSS_H - 1; y++) {
      for (let x = 1; x < ABYSS_W - 1; x++) {
        let rock = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && g[y + dy][x + dx] === T_ROCK) rock++;
        if (rock >= 5) next[y][x] = T_ROCK;
        else if (rock <= 3) next[y][x] = T_PATH;
      }
    }
    g = next;
  }
  // keep the largest pocket
  const seen = g.map((row) => row.map(() => false));
  let best: Cell[] = [];
  for (let y = 0; y < ABYSS_H; y++) {
    for (let x = 0; x < ABYSS_W; x++) {
      if (seen[y][x] || g[y][x] !== T_PATH) continue;
      const pocket = flood(g, { tx: x, ty: y }, (t) => t === T_PATH);
      for (const c of pocket) seen[c.ty][c.tx] = true;
      if (pocket.length > best.length) best = pocket;
    }
  }
  if (best.length < MIN_OPEN) return null;
  const keep = new Set(best.map((c) => c.ty * ABYSS_W + c.tx));
  return g.map((row, y) => row.map((t, x) => (t === T_PATH && !keep.has(y * ABYSS_W + x) ? T_ROCK : t)));
}

const DIRS: ReadonlyArray<[number, number]> = [
  [0, 1],
  [-1, 0],
  [1, 0],
  [0, -1],
];

// every cell 4-connected to `from` whose tile passes `open`
function flood(g: number[][], from: Cell, open: (tile: number) => boolean): Cell[] {
  return [...bfs(g, from, open).keys()].map((k) => ({ tx: k % ABYSS_W, ty: Math.floor(k / ABYSS_W) }));
}

// 4-connected step counts from `from` over cells whose tile passes `open`,
// keyed ty * ABYSS_W + tx — the walk the hero's box can actually make
export function bfs(g: readonly (readonly number[])[], from: Cell, open: (tile: number) => boolean): Map<number, number> {
  const dist = new Map<number, number>();
  if (!open(g[from.ty]?.[from.tx] ?? T_ROCK)) return dist;
  dist.set(from.ty * ABYSS_W + from.tx, 0);
  const queue: Cell[] = [from];
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    const d = dist.get(c.ty * ABYSS_W + c.tx) as number;
    for (const [dx, dy] of DIRS) {
      const tx = c.tx + dx;
      const ty = c.ty + dy;
      const key = ty * ABYSS_W + tx;
      if (dist.has(key) || !open(g[ty]?.[tx] ?? T_ROCK)) continue;
      dist.set(key, d + 1);
      queue.push({ tx, ty });
    }
  }
  return dist;
}

// what the hero can walk on: floor and the zones' marked floor
export const walkable = (tile: number): boolean => tile === T_PATH || tile === T_TALL;

const cheb = (a: Cell, b: Cell): number => Math.max(Math.abs(a.tx - b.tx), Math.abs(a.ty - b.ty));

function pick<T>(list: readonly T[], rand: () => number): T | undefined {
  return list.length > 0 ? list[Math.floor(rand() * list.length)] : undefined;
}

function shuffle<T>(list: T[], rand: () => number): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

const cellsOf = (g: number[][], tile: number): Cell[] => g.flatMap((row, ty) => row.flatMap((t, tx) => (t === tile ? [{ tx, ty }] : [])));

// The hero lands beside the stair up — below it or to a side, never above:
// above, the hero's 40x32 box (it hangs from the sprite's middle down) would
// sit flush against the stair's trigger, a pixel from walking straight back
// out.
const SPAWN_SIDES: ReadonlyArray<[number, number]> = [
  [0, 1],
  [-1, 0],
  [1, 0],
];
// the stair down is at least this many steps from the landing, and in the
// farther part of the floor (STAIR_FAR of the farthest reachable cell)
const STAIR_MIN_STEPS = 10;
const STAIR_FAR = 0.6;
// Zones are 2x2 tiles, like every field's, with a clear ring of floor around
// them: roamers float over terrain (no collider) and are drawn up to 24px past
// their box, so a wall or a pool next to a zone would have them wading into
// it. They stay ZONE_CLEAR tiles from the landing (no fight on arrival) and
// one from the stair down, and a path from the landing to the stair down must
// exist around them: a careful diver can always slip past.
const ZONE_COUNTS = [2, 3];
const ROAMERS_PER_ZONE = 2;
const ZONE_CLEAR = 3;
const CHEST_CHANCE = 0.5;
const POOL_SHAPES: ReadonlyArray<[number, number]> = [
  [2, 2],
  [2, 1],
  [1, 2],
  [3, 2],
];

function furnish(floor: number, grid: number[][], rand: () => number): AbyssFloor | null {
  const g = grid.map((row) => [...row]);
  const open = cellsOf(g, T_PATH);
  const landings = shuffle(
    open.filter((c) => SPAWN_SIDES.some(([dx, dy]) => g[c.ty + dy]?.[c.tx + dx] === T_PATH)),
    rand,
  );
  const up = landings[0];
  if (!up) return null;
  const [sx, sy] = SPAWN_SIDES.find(([dx, dy]) => g[up.ty + dy][up.tx + dx] === T_PATH) as [number, number];
  const spawn = { tx: up.tx + sx, ty: up.ty + sy };

  const dist = bfs(g, spawn, (t) => t === T_PATH);
  const far = Math.max(...dist.values());
  const down = pick(
    open.filter((c) => {
      const d = dist.get(c.ty * ABYSS_W + c.tx) ?? -1;
      return d >= Math.max(STAIR_MIN_STEPS, far * STAIR_FAR) && cheb(c, up) > 1;
    }),
    rand,
  );
  if (!down) return null;
  const landmarks = [up, spawn, down];

  // pools: only where they leave every open cell reachable from the landing
  const pools = rand() < 0.6 ? 1 + Math.floor(rand() * 2) : 0;
  for (let n = 0; n < pools; n++) {
    const at = pick(open, rand) as Cell;
    const [w, h] = pick(POOL_SHAPES, rand) as [number, number];
    const cells: Cell[] = [];
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) cells.push({ tx: at.tx + dx, ty: at.ty + dy });
    if (!cells.every((c) => g[c.ty]?.[c.tx] === T_PATH && landmarks.every((l) => cheb(c, l) >= 2))) continue;
    for (const c of cells) g[c.ty][c.tx] = T_WATER_A;
    if (bfs(g, spawn, (t) => t === T_PATH).size !== cellsOf(g, T_PATH).length) for (const c of cells) g[c.ty][c.tx] = T_PATH;
  }

  // zones: a 2x2 box whose 4x4 ring is all plain floor (so also one tile
  // clear of every zone placed before it)
  const zones: AbyssZone[] = [];
  const wanted = pick(ZONE_COUNTS, rand) as number;
  const spots = shuffle(
    cellsOf(g, T_PATH).filter((c) => {
      for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) if (g[c.ty + dy]?.[c.tx + dx] !== T_PATH) return false;
      const box = [c, { tx: c.tx + 1, ty: c.ty }, { tx: c.tx, ty: c.ty + 1 }, { tx: c.tx + 1, ty: c.ty + 1 }];
      return box.every((b) => cheb(b, spawn) >= ZONE_CLEAR && cheb(b, up) >= ZONE_CLEAR && cheb(b, down) >= 2);
    }),
    rand,
  );
  for (const c of spots) {
    if (zones.length >= wanted) break;
    let clear = true;
    for (let dy = -1; dy <= 2 && clear; dy++) for (let dx = -1; dx <= 2; dx++) if (g[c.ty + dy][c.tx + dx] !== T_PATH) clear = false;
    if (!clear) continue;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) g[c.ty + dy][c.tx + dx] = T_TALL;
    if (!bfs(g, spawn, (t) => t === T_PATH).has(down.ty * ABYSS_W + down.tx)) {
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) g[c.ty + dy][c.tx + dx] = T_PATH;
      continue;
    }
    zones.push({
      cx: (c.tx + 1) * TILE,
      cy: (c.ty + 1) * TILE,
      w: 2 * TILE,
      h: 2 * TILE,
      count: ROAMERS_PER_ZONE,
      kinds: Array.from({ length: ROAMERS_PER_ZONE }, () => abyssKind(floor, rand)),
    });
  }
  // a cave too cramped for even one zone is dug again
  if (zones.length === 0) return null;

  // a chest half the time, on plain floor off the stairs and outside every
  // zone's ring
  const chest =
    rand() < CHEST_CHANCE
      ? (pick(
          cellsOf(g, T_PATH).filter((c) => {
            if (landmarks.some((l) => cheb(c, l) < 2)) return false;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g[c.ty + dy]?.[c.tx + dx] === T_TALL) return false;
            return true;
          }),
          rand,
        ) ?? null)
      : null;

  return { floor, tiles: g, up, spawn, down, chest, zones, guardian: null, lair: null };
}

// A GUARDIAN floor: one hall rather than a cave, the stair up at the top and
// the stair down at the bottom middle, the guardian roaming a 5x2 box right
// above it (its 1.5x sprite clears the stair by 24px at the bottom of its
// box), and seeded boulders and pools mirrored left to right.
const LAIR = { x0: 9, y0: 9, w: 5, h: 2 };
const PILLAR_SPOTS: ReadonlyArray<[number, number]> = [
  [3, 4],
  [6, 4],
  [3, 7],
  [6, 7],
  [4, 10],
  [7, 12],
  [2, 12],
];
const CORNER_POOLS: ReadonlyArray<[number, number, number, number]> = [
  [1, 1, 2, 2],
  [1, 12, 2, 2],
];

function guardianFloor(floor: number, guardian: string, rand: () => number): AbyssFloor {
  const g = hall();
  const mid = Math.floor(ABYSS_W / 2);
  const up = { tx: mid, ty: 1 };
  const spawn = { tx: mid, ty: 2 };
  const down = { tx: mid, ty: LAIR.y0 + LAIR.h + 1 };
  const mirror = (tx: number): number => ABYSS_W - 1 - tx;
  for (const [tx, ty] of PILLAR_SPOTS) {
    if (rand() < 0.5) continue;
    g[ty][tx] = T_ROCK;
    g[ty][mirror(tx)] = T_ROCK;
  }
  for (const [x0, y0, w, h] of CORNER_POOLS) {
    if (rand() < 0.5) continue;
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        g[y][x] = T_WATER_A;
        g[y][mirror(x)] = T_WATER_A;
      }
    }
  }
  const lair: MonsterZone = {
    cx: (LAIR.x0 + LAIR.w / 2) * TILE,
    cy: (LAIR.y0 + LAIR.h / 2) * TILE,
    w: LAIR.w * TILE,
    h: LAIR.h * TILE,
    count: 1,
  };
  return { floor, tiles: g, up, spawn, down, chest: null, zones: [], guardian, lair };
}
