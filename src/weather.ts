import { econDay } from "./gameState";
import { type Season, seasonOn, seasonToday } from "./season";

export type Region = "town" | "forest" | "snow" | "dungeon" | "volcano";
export type Weather = "clear" | "rain" | "storm" | "snow" | "blizzard" | "ashfall" | "none";

// The town and the forest share one sky, so it never pours in one and shines
// in the other; the cave has no sky at all.
type Climate = "lowland" | "highland" | "crater" | "underground";

const CLIMATE: Record<Region, Climate> = {
  town: "lowland",
  forest: "lowland",
  snow: "highland",
  volcano: "crater",
  dungeon: "underground",
};

// Odds in percent, most likely first: that one is also every climate's day-0
// weather, so a new game always opens on the usual sky.
type Odds = Array<[Weather, number]>;
const ODDS: Record<Exclude<Climate, "lowland">, Odds> = {
  highland: [
    ["snow", 55],
    ["clear", 25],
    ["blizzard", 20],
  ],
  crater: [
    ["clear", 75],
    ["ashfall", 25],
  ],
  underground: [["none", 100]],
};

// The lowland sky turns with the seasons (season.ts): showers in spring,
// thunderstorms in summer, snow in winter. Every season keeps "clear" first,
// so day 0 (spring) still opens on it. The wet days (rain + storm: 45, 42, 40
// and 25 out of 100) average 38 over the year, the share the single table had
// (26 + 12), so the rain-fed farm and the faster bites (isWet) pay what they
// did; a retune keeps that average. Winter has no storms and fewer clear
// days, and snows instead.
const LOWLAND: Record<Season, Odds> = {
  spring: [
    ["clear", 55],
    ["rain", 35],
    ["storm", 10],
  ],
  summer: [
    ["clear", 58],
    ["rain", 22],
    ["storm", 20],
  ],
  autumn: [
    ["clear", 60],
    ["rain", 30],
    ["storm", 10],
  ],
  winter: [
    ["clear", 45],
    ["snow", 30],
    ["rain", 25],
  ],
};

// separate salts so each climate rolls its own dice on the same day
const SALT: Record<Climate, number> = { lowland: 0x1b873593, highland: 0x27d4eb2f, crater: 0x165667b1, underground: 0 };

export const WEATHER_LABEL: Record<Weather, string> = {
  clear: "CLEAR",
  rain: "RAIN",
  storm: "STORM",
  snow: "SNOW",
  blizzard: "BLIZZARD",
  ashfall: "ASHFALL",
  none: "",
};

/**
 * The weather in `region` on day `day`, under the lowland odds of `season`
 * (that day's own unless told otherwise). Pure and deterministic: the day
 * number is hashed, so the same day always gets the same sky and nothing
 * needs saving.
 */
export function weatherOn(day: number, region: Region, season: Season = seasonOn(day)): Weather {
  const climate = CLIMATE[region];
  const odds = climate === "lowland" ? LOWLAND[season] : ODDS[climate];
  if (day <= 0) return odds[0][0];
  let roll = hash01(day, SALT[climate]) * 100;
  for (const [weather, pct] of odds) {
    roll -= pct;
    if (roll < 0) return weather;
  }
  return odds[0][0];
}

// Today's sky: the real-time day (econDay) rolled under the season the hero
// sees (dayIndex, season.ts), so the sky matches the ground it falls on.
// On the clock's day a x20 player could pull a rainy day up in ~2 minutes,
// then fish and harvest it at NORMAL for a real 24. The season still runs on
// the clock, so turning only it at x20 drops the same econDay's roll onto
// another season's table (spring's 55-60 is rain, autumn's clear; winter's
// 45-75 snow) and can move a wet day. Left in: a season takes a real 4.8
// minutes at x20 (up to 14.4 to reach a chosen one), not a day's 1.2, and
// only rolls near a boundary move.
export function weatherToday(region: Region): Weather {
  return weatherOn(econDay(), region, seasonToday());
}

// Rain or storm. The hook for systems that should care about a wet day
// (fishing bites, crop growth) without each re-listing the rainy kinds.
export function isWet(weather: Weather): boolean {
  return weather === "rain" || weather === "storm";
}

// 32-bit integer mix (murmur3 finalizer) of the day and a salt, to [0, 1).
// Consecutive days land far apart, so the weather doesn't run in streaks.
function hash01(day: number, salt: number): number {
  let h = (Math.imul(day, 0x9e3779b1) + salt) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
