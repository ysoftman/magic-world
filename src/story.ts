// The story's one thread, told in a line or two wherever a region turns: a
// fire deep under the land is waking, and its heat turned the old keepers one
// by one. The cave's slimes fattened on it into a KING; it drove the TROLL
// KING out of the eastern woods and the woods' own keeper, the MOSS GOLEM,
// mad; it thawed the snow pass, whose GLACIER GOLEM froze the crater shut to
// hold it down; and with that frost broken it climbed out as the FLAME DRAKE.
// The pit it rose from is the ABYSS under the cave. The ELDER, the GUARD, the
// HUNTER and the villagers tell their part of it in TownScene.ts and
// ui/Villagers.ts; the gates' own lines ("Something ancient stirs beyond the
// ice", the crater's black ice) and the endings (PEACE RETURNS TO THE FOREST,
// THE FLAME IS QUENCHED) were there first and this is written round them.
//
// Here: what the battle says as a boss's fight opens and as it falls, keyed
// as ENEMIES is (monsters.ts). `intro` stands where "<NAME> blocks your way!"
// does and `fall` where "The <NAME> is no more!" does, each one row of the
// battle's message box: 54 glyphs at most, the name included (the longest
// here is 53). Each line spells its boss's name as ENEMIES has it, so a
// renamed boss is renamed here too. They are written for the boss in its own
// lair: an ARENA round, an ABYSS GUARDIAN or an elite's tagged line keeps the
// plain one.

/** The bosses that have a story line: their keys in ENEMIES (monsters.ts). */
export type StoryBoss = "king" | "troll" | "mossGolem" | "iceGolem" | "flameDrake";

/** What a boss's fight opens on and what is said as it falls. */
export interface BossStory {
  /** the fight's opening line, in place of "<NAME> blocks your way!" */
  intro: string;
  /** the line after the payout, in place of "The <NAME> is no more!" */
  fall: string;
}

export const BOSS_STORY: Record<StoryBoss, BossStory> = {
  king: {
    intro: "KING SLIME, fat on the cave's heat, blocks your way!",
    fall: "The KING SLIME melts. The cave floor is still warm...",
  },
  troll: {
    intro: "TROLL KING, driven from the woods, blocks your way!",
    fall: "The TROLL KING falls, still staring at the woods.",
  },
  mossGolem: {
    intro: "MOSS GOLEM, the woods' mad keeper, blocks your way!",
    fall: "The MOSS GOLEM crumbles. Its eyes clear, then close.",
  },
  iceGolem: {
    intro: "GLACIER GOLEM, jailer of the fire, blocks your way!",
    fall: "The GLACIER GOLEM shatters. Far off, a peak rumbles.",
  },
  flameDrake: {
    intro: "FLAME DRAKE, born of the deep fire, blocks your way!",
    fall: "The FLAME DRAKE falls. The fire sinks back below...",
  },
};

/** The story lines of the enemy keyed `key` in ENEMIES, or null when it has none. */
export function bossStory(key: string): BossStory | null {
  return (BOSS_STORY as Record<string, BossStory | undefined>)[key] ?? null;
}
