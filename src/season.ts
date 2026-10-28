import { dayIndex, GameState } from "./gameState";

export type Season = "spring" | "summer" | "autumn" | "winter";

const ORDER: readonly Season[] = ["spring", "summer", "autumn", "winter"];

// Four days a season, a 16-day year. A day is 24 minutes of play at TIME
// SPEED NORMAL, less with a night slept through at HOME (rest skips ~10
// hours), so a season lasts roughly an hour to an hour and a half: long
// enough to settle in, short enough that a first run sees the whole year
// go round. Seven-day seasons (a 28-day year) took ~10 hours to reach winter.
export const SEASON_DAYS = 4;

export const SEASON_LABEL: Record<Season, string> = {
  spring: "SPRING",
  summer: "SUMMER",
  autumn: "AUTUMN",
  winter: "WINTER",
};

/**
 * The season on in-game day `day`. Pure and deterministic, like weatherOn():
 * the day number alone decides it, so nothing needs saving. Day 0, a new
 * game's first morning, is the first day of spring.
 */
export function seasonOn(day: number): Season {
  return ORDER[Math.floor(Math.max(0, day) / SEASON_DAYS) % ORDER.length];
}

export function seasonToday(): Season {
  return seasonOn(dayIndex());
}

/**
 * How `season` dresses `region`'s ground: the town and the forest (the
 * lowland, one sky) turn in autumn and lie under snow in winter; every other
 * region looks the same all year (null), as do spring and summer. The one
 * table art/tilesets.ts's map skins and battle backdrops and the footsteps all
 * read, so the ground, the fight behind it and the prints on it agree.
 */
export function seasonLook(region: string, season: Season = seasonToday()): "autumn" | "winter" | null {
  if (region !== "town" && region !== "forest") return null;
  return season === "autumn" || season === "winter" ? season : null;
}

/**
 * "AUTUMN HAS COME!" the first time the town is entered in a new season, or
 * the season turns while the hero is in it; null otherwise. The season
 * (counted from day 0, so each year's autumn is a new one) last announced
 * rides in the save (GameState.seasonSeen), which the town writes as soon as
 * it has the news, so a reload doesn't call the same one news again. A save
 * from before it (-1) only calls it news on the season's first day, as any
 * later entry may be a return. Never on day 0: the game has only just begun,
 * nothing has come.
 */
export function seasonNews(): string | null {
  const day = dayIndex();
  const index = Math.floor(day / SEASON_DAYS);
  const first = GameState.seasonSeen < 0;
  if (index === GameState.seasonSeen) return null;
  GameState.seasonSeen = index;
  if (day <= 0 || (first && day % SEASON_DAYS !== 0)) return null;
  return `${SEASON_LABEL[seasonOn(day)]} HAS COME!`;
}
