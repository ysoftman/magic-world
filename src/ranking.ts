import { GameState } from "./gameState";

// Village rank board: a persistent top-10 leaderboard of level-ups, stored in
// its own localStorage key so it survives "new game" / delete-save — the board
// in town records every hero, not just the current run.

export interface RankEntry {
  name: string;
  level: number;
  date: string; // YYYY-MM-DD when the level was reached
  // the hero's best ARENA run, NEW GAME+ cycle and deepest ABYSS floor, last
  // seen at this level; absent on rows written before the board tracked them
  arena?: number;
  ng?: number;
  abyss?: number;
}

const RANK_KEY = "magic-world-ranking";
export const MAX_RANKS = 10;

let ranks: RankEntry[] = loadRanks();

function loadRanks(): RankEntry[] {
  try {
    const raw = localStorage.getItem(RANK_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is RankEntry =>
          !!e &&
          typeof (e as RankEntry).name === "string" &&
          typeof (e as RankEntry).level === "number" &&
          typeof (e as RankEntry).date === "string",
      )
      .map((e) => ({
        name: e.name,
        level: e.level,
        date: e.date,
        // a hand-edited or garbled value reads as "never", not as a number
        ...(typeof e.arena === "number" ? { arena: e.arena } : {}),
        ...(typeof e.ng === "number" ? { ng: e.ng } : {}),
        ...(typeof e.abyss === "number" ? { abyss: e.abyss } : {}),
      }))
      .sort(byLevel);
  } catch {
    return [];
  }
}

function byLevel(a: RankEntry, b: RankEntry): number {
  if (b.level !== a.level) return b.level - a.level;
  // same level: whoever reached it first ranks higher
  return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
}

function today(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function getRanks(): RankEntry[] {
  return ranks.slice();
}

function persist(): void {
  try {
    localStorage.setItem(RANK_KEY, JSON.stringify(ranks));
  } catch {
    /* storage full/blocked: the board still works for this session */
  }
}

// Records a level-up on the board. Same name + level entries collapse into a
// single row, so every save (and repeated saves at the same level) can safely
// call this without spamming the top 10 with copies of the current hero.
// Returns the 1-based rank the entry earned (0 when the level didn't crack the
// top 10).
//
// The row also carries the hero's ARENA best, NEW GAME+ cycle and ABYSS
// record, read from GameState here rather than passed in so GameState.save()'s
// existing call keeps working as is. All three only ever grow, so a collapsed
// row takes the newer values — a Lv30 hero's row follows every later run,
// cycle and dive. (gameState.ts imports this module too; neither touches the
// other at load, only inside calls, so the cycle is harmless.)
export function recordRank(name: string, level: number): number {
  const arena = GameState.arenaBest;
  const ng = GameState.ngPlus;
  const abyss = GameState.abyssBest;
  const existing = ranks.find((e) => e.name === name && e.level === level);
  if (existing) {
    const nextArena = Math.max(existing.arena ?? 0, arena);
    const nextNg = Math.max(existing.ng ?? 0, ng);
    const nextAbyss = Math.max(existing.abyss ?? 0, abyss);
    if (nextArena !== existing.arena || nextNg !== existing.ng || nextAbyss !== existing.abyss) {
      existing.arena = nextArena;
      existing.ng = nextNg;
      existing.abyss = nextAbyss;
      persist();
    }
    return ranks.indexOf(existing) + 1;
  }
  const entry: RankEntry = { name, level, date: today(), arena, ng, abyss };
  ranks.push(entry);
  ranks.sort(byLevel);
  ranks = ranks.slice(0, MAX_RANKS);
  persist();
  const idx = ranks.indexOf(entry);
  return idx >= 0 ? idx + 1 : 0;
}
