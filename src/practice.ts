import { GameState } from "./gameState";
import { ENEMIES } from "./monsters";

// The town's TRAINING YARD: a different foe each bout for as long as the player stays, C:FOE moving on to the next one in the list,
// the hero's HP and MP never running out, nothing won or lost. BattleScene
// restarts into the next foe as each falls and leaves only when the player
// picks EXIT (the menu's ESC); a restart carries this run along.
//
// The run is a loan: the HP, MP and bag from the moment of entering are put
// back on the way out, so the yard can't be used to heal up, to burn through
// or to stock potions, and no EXP, gold, drop, streak, quest or achievement
// count comes of it (BattleScene.practiceVictory goes round all of it).
export interface PracticeRun {
  /** bouts fought so far */
  round: number;
  /** the roster's foe now fought; a bout won picks another at random, C:FOE the next in line */
  foe: number;
  hp: number;
  mp: number;
  bag: Record<string, number>;
}

// the ordinary foes in the monsters' own order; no boss or giant, whose
// fights are the story's and the ARENA's
const ROSTER = Object.keys(ENEMIES).filter((key) => !ENEMIES[key].boss && !ENEMIES[key].giant);

export const practiceEnemy = (foe: number): string => ROSTER[((foe % ROSTER.length) + ROSTER.length) % ROSTER.length];

// a foe's HP in the yard: a long fight is the point, so ten times its own or
// 25 of the hero's attacks, the bigger, kept to four digits (the foe's window)
export const practiceHp = (foeHp: number, heroAtk: number): number => Math.min(9999, Math.max(foeHp * 10, heroAtk * 25));

// how far along the roster a won bout moves: any foe but the one just beaten
export const randomStep = (): number => 1 + Math.floor(Math.random() * (ROSTER.length - 1));

export function startPracticeRun(): PracticeRun {
  return { round: 0, foe: 0, hp: GameState.player.hp, mp: GameState.player.mp, bag: { ...GameState.inventory } };
}

export function endPracticeRun(run: PracticeRun): void {
  GameState.player.hp = run.hp;
  GameState.player.mp = run.mp;
  Object.assign(GameState.inventory, run.bag);
}
