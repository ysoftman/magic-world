import { GameState } from "./gameState";

interface Note {
  freq: number | null; // null = rest
  dur: number; // seconds
}

// Looping chiptune backgrounds, one melodic line each (no separate bass) to
// keep the single-oscillator-per-note engine simple.
// A-A'-B-A form in C major, ~12s per loop
export const TITLE_THEME: Note[] = [
  // A
  { freq: 262, dur: 0.3 },
  { freq: 330, dur: 0.3 },
  { freq: 392, dur: 0.3 },
  { freq: 523, dur: 0.45 },
  { freq: 392, dur: 0.3 },
  { freq: 330, dur: 0.3 },
  { freq: 294, dur: 0.3 },
  { freq: null, dur: 0.3 },
  // A' — same rise, falls through A instead
  { freq: 262, dur: 0.3 },
  { freq: 330, dur: 0.3 },
  { freq: 392, dur: 0.3 },
  { freq: 523, dur: 0.45 },
  { freq: 440, dur: 0.3 },
  { freq: 392, dur: 0.3 },
  { freq: 330, dur: 0.3 },
  { freq: null, dur: 0.3 },
  // B — lifts to the subdominant
  { freq: 349, dur: 0.3 },
  { freq: 440, dur: 0.3 },
  { freq: 523, dur: 0.3 },
  { freq: 587, dur: 0.45 },
  { freq: 523, dur: 0.3 },
  { freq: 440, dur: 0.3 },
  { freq: 392, dur: 0.3 },
  { freq: null, dur: 0.3 },
  // C — a quieter, wider phrase before the last time through
  { freq: 220, dur: 0.45 },
  { freq: 330, dur: 0.3 },
  { freq: 440, dur: 0.3 },
  { freq: 392, dur: 0.45 },
  { freq: 330, dur: 0.3 },
  { freq: 294, dur: 0.3 },
  { freq: 247, dur: 0.6 },
  { freq: null, dur: 0.3 },
  { freq: 294, dur: 0.3 },
  { freq: 392, dur: 0.3 },
  { freq: 494, dur: 0.3 },
  { freq: 587, dur: 0.45 },
  { freq: 494, dur: 0.3 },
  { freq: 440, dur: 0.3 },
  { freq: 392, dur: 0.6 },
  { freq: null, dur: 0.3 },
  // A — cadence home
  { freq: 262, dur: 0.3 },
  { freq: 330, dur: 0.3 },
  { freq: 392, dur: 0.3 },
  { freq: 523, dur: 0.45 },
  { freq: 392, dur: 0.3 },
  { freq: 330, dur: 0.3 },
  { freq: 262, dur: 0.6 },
  { freq: null, dur: 0.45 },
];

// Four skipping phrases climbing then settling, ~6s per loop
export const OVERWORLD_THEME: Note[] = [
  { freq: 523, dur: 0.18 },
  { freq: 659, dur: 0.18 },
  { freq: 784, dur: 0.18 },
  { freq: 659, dur: 0.18 },
  { freq: 587, dur: 0.18 },
  { freq: 698, dur: 0.18 },
  { freq: 659, dur: 0.18 },
  { freq: 523, dur: 0.3 },
  { freq: 587, dur: 0.18 },
  { freq: 698, dur: 0.18 },
  { freq: 880, dur: 0.18 },
  { freq: 698, dur: 0.18 },
  { freq: 659, dur: 0.18 },
  { freq: 784, dur: 0.18 },
  { freq: 698, dur: 0.18 },
  { freq: 587, dur: 0.3 },
  { freq: 659, dur: 0.18 },
  { freq: 784, dur: 0.18 },
  { freq: 1047, dur: 0.18 },
  { freq: 784, dur: 0.18 },
  { freq: 698, dur: 0.18 },
  { freq: 880, dur: 0.18 },
  { freq: 784, dur: 0.18 },
  { freq: 659, dur: 0.3 },
  { freq: 523, dur: 0.18 },
  { freq: 587, dur: 0.18 },
  { freq: 659, dur: 0.18 },
  { freq: 784, dur: 0.18 },
  { freq: 659, dur: 0.18 },
  { freq: 587, dur: 0.18 },
  { freq: 523, dur: 0.36 },
  { freq: null, dur: 0.24 },
  // B — leans on the relative minor in longer strides, so the loop stops
  // sounding like the same eight bars over and over
  { freq: 440, dur: 0.24 },
  { freq: 523, dur: 0.24 },
  { freq: 659, dur: 0.24 },
  { freq: 523, dur: 0.24 },
  { freq: 494, dur: 0.24 },
  { freq: 587, dur: 0.24 },
  { freq: 494, dur: 0.36 },
  { freq: null, dur: 0.18 },
  { freq: 392, dur: 0.24 },
  { freq: 494, dur: 0.24 },
  { freq: 587, dur: 0.24 },
  { freq: 494, dur: 0.24 },
  { freq: 440, dur: 0.24 },
  { freq: 523, dur: 0.24 },
  { freq: 440, dur: 0.36 },
  { freq: null, dur: 0.18 },
  // C — climbs back up and hands the loop to the opening phrase
  { freq: 349, dur: 0.18 },
  { freq: 440, dur: 0.18 },
  { freq: 523, dur: 0.18 },
  { freq: 659, dur: 0.18 },
  { freq: 587, dur: 0.18 },
  { freq: 523, dur: 0.18 },
  { freq: 494, dur: 0.3 },
  { freq: null, dur: 0.12 },
  { freq: 523, dur: 0.18 },
  { freq: 659, dur: 0.18 },
  { freq: 784, dur: 0.18 },
  { freq: 880, dur: 0.24 },
  { freq: 784, dur: 0.18 },
  { freq: 659, dur: 0.18 },
  { freq: 523, dur: 0.42 },
  { freq: null, dur: 0.36 },
];

// Sparse minor phrases drifting lower each time, ~13s per loop
export const DUNGEON_THEME: Note[] = [
  { freq: 262, dur: 0.3 },
  { freq: null, dur: 0.2 },
  { freq: 311, dur: 0.3 },
  { freq: null, dur: 0.2 },
  { freq: 294, dur: 0.4 },
  { freq: null, dur: 0.3 },
  { freq: 196, dur: 0.5 },
  { freq: null, dur: 0.4 },
  { freq: 262, dur: 0.3 },
  { freq: null, dur: 0.2 },
  { freq: 349, dur: 0.3 },
  { freq: null, dur: 0.2 },
  { freq: 311, dur: 0.4 },
  { freq: null, dur: 0.3 },
  { freq: 233, dur: 0.5 },
  { freq: null, dur: 0.4 },
  { freq: 415, dur: 0.3 },
  { freq: null, dur: 0.2 },
  { freq: 392, dur: 0.3 },
  { freq: null, dur: 0.2 },
  { freq: 349, dur: 0.4 },
  { freq: null, dur: 0.3 },
  { freq: 294, dur: 0.5 },
  { freq: null, dur: 0.4 },
  { freq: 262, dur: 0.3 },
  { freq: null, dur: 0.2 },
  { freq: 294, dur: 0.3 },
  { freq: null, dur: 0.2 },
  { freq: 311, dur: 0.4 },
  { freq: null, dur: 0.3 },
  { freq: 262, dur: 0.6 },
  { freq: null, dur: 0.4 },
  // a higher, thinner answer before sinking back to the opening
  { freq: 466, dur: 0.3 },
  { freq: null, dur: 0.2 },
  { freq: 440, dur: 0.3 },
  { freq: null, dur: 0.2 },
  { freq: 392, dur: 0.45 },
  { freq: null, dur: 0.35 },
  { freq: 311, dur: 0.5 },
  { freq: null, dur: 0.4 },
  { freq: 349, dur: 0.3 },
  { freq: null, dur: 0.2 },
  { freq: 311, dur: 0.3 },
  { freq: null, dur: 0.2 },
  { freq: 294, dur: 0.45 },
  { freq: null, dur: 0.35 },
  { freq: 196, dur: 0.7 },
  { freq: null, dur: 0.6 },
];

// Sparse, wind-swept theme for the Snow Field: long rests between notes so
// the constant blizzard particles and the whistling silence carry the mood.
export const SNOW_THEME: Note[] = [
  { freq: 440, dur: 0.5 },
  { freq: null, dur: 0.6 },
  { freq: 392, dur: 0.5 },
  { freq: null, dur: 0.6 },
  { freq: 349, dur: 0.7 },
  { freq: null, dur: 0.8 },
  { freq: 330, dur: 0.9 },
  { freq: null, dur: 1.0 },
  { freq: 294, dur: 0.5 },
  { freq: null, dur: 0.5 },
  { freq: 330, dur: 0.5 },
  { freq: null, dur: 0.5 },
  { freq: 349, dur: 0.7 },
  { freq: null, dur: 0.8 },
  { freq: 262, dur: 0.9 },
  { freq: null, dur: 1.0 },
  // a colder, higher answer before settling back down
  { freq: 587, dur: 0.4 },
  { freq: null, dur: 0.5 },
  { freq: 523, dur: 0.4 },
  { freq: null, dur: 0.5 },
  { freq: 494, dur: 0.6 },
  { freq: null, dur: 0.7 },
  { freq: 440, dur: 0.8 },
  { freq: null, dur: 0.9 },
  { freq: 349, dur: 0.5 },
  { freq: null, dur: 0.5 },
  { freq: 294, dur: 0.7 },
  { freq: null, dur: 0.8 },
  { freq: 220, dur: 1.2 },
  { freq: null, dur: 1.2 },
];

// Unbroken harp-like arpeggios in D dorian for the Forest, ~10.5s per loop.
// The dungeon is all silence between notes; here nothing ever stops moving,
// and the borrowed Bb chord with an E on top gives the glade its strangeness.
export const FOREST_THEME: Note[] = [
  // A — Dm9 / Bbmaj7(#11) / Dm9 / Cadd9, one flowing arpeggio per chord
  { freq: 294, dur: 0.22 },
  { freq: 440, dur: 0.22 },
  { freq: 659, dur: 0.22 },
  { freq: 698, dur: 0.22 },
  { freq: 659, dur: 0.22 },
  { freq: 440, dur: 0.22 },
  { freq: 233, dur: 0.22 },
  { freq: 349, dur: 0.22 },
  { freq: 440, dur: 0.22 },
  { freq: 659, dur: 0.22 },
  { freq: 587, dur: 0.22 },
  { freq: 440, dur: 0.22 },
  { freq: 294, dur: 0.22 },
  { freq: 440, dur: 0.22 },
  { freq: 659, dur: 0.22 },
  { freq: 698, dur: 0.22 },
  { freq: 659, dur: 0.22 },
  { freq: 440, dur: 0.22 },
  { freq: 262, dur: 0.22 },
  { freq: 392, dur: 0.22 },
  { freq: 587, dur: 0.22 },
  { freq: 659, dur: 0.22 },
  { freq: 587, dur: 0.22 },
  { freq: 392, dur: 0.22 },
  // B — a slow line drifting down through the canopy
  { freq: 880, dur: 0.44 },
  { freq: 784, dur: 0.22 },
  { freq: 698, dur: 0.22 },
  { freq: 659, dur: 0.44 },
  { freq: 587, dur: 0.22 },
  { freq: 659, dur: 0.22 },
  { freq: 523, dur: 0.66 },
  { freq: null, dur: 0.22 },
  // the dorian B natural is the "magic" note; landing on A hands the loop
  // back to the D that opens it
  { freq: 392, dur: 0.44 },
  { freq: 440, dur: 0.22 },
  { freq: 494, dur: 0.22 },
  { freq: 523, dur: 0.44 },
  { freq: 494, dur: 0.22 },
  { freq: 392, dur: 0.22 },
  { freq: 440, dur: 0.66 },
  { freq: null, dur: 0.22 },
];

// Lumbering D harmonic minor for the Volcano, ~11s per loop: a low D pedal
// under each step, like something huge breathing below the crust, then a
// slow high line that rises and falls back onto the C# leading tone. Slower
// than BOSS_THEME's pedal riff on purpose, so the drake's fight still lands
// as an escalation.
export const VOLCANO_THEME: Note[] = [
  // A — the pedal climbs toward the C#
  { freq: 147, dur: 0.2 },
  { freq: 220, dur: 0.2 },
  { freq: 147, dur: 0.2 },
  { freq: 233, dur: 0.2 },
  { freq: 147, dur: 0.2 },
  { freq: 220, dur: 0.2 },
  { freq: 147, dur: 0.2 },
  { freq: 277, dur: 0.4 },
  { freq: null, dur: 0.2 },
  // A' — and sinks back down to the E
  { freq: 147, dur: 0.2 },
  { freq: 220, dur: 0.2 },
  { freq: 147, dur: 0.2 },
  { freq: 233, dur: 0.2 },
  { freq: 147, dur: 0.2 },
  { freq: 196, dur: 0.2 },
  { freq: 175, dur: 0.2 },
  { freq: 165, dur: 0.4 },
  { freq: null, dur: 0.2 },
  // B — the eruption, an octave up
  { freq: 294, dur: 0.4 },
  { freq: 349, dur: 0.4 },
  { freq: 440, dur: 0.6 },
  { freq: null, dur: 0.2 },
  { freq: 466, dur: 0.3 },
  { freq: 440, dur: 0.3 },
  { freq: 392, dur: 0.3 },
  { freq: 349, dur: 0.3 },
  { freq: 330, dur: 0.6 },
  { freq: null, dur: 0.2 },
  { freq: 349, dur: 0.4 },
  { freq: 330, dur: 0.4 },
  { freq: 294, dur: 0.4 },
  { freq: 277, dur: 0.6 },
  { freq: null, dur: 0.2 },
  { freq: 294, dur: 0.8 },
  { freq: null, dur: 0.4 },
];

// Driving riff with two variations and a run back home, ~4s per loop
export const BATTLE_THEME: Note[] = [
  { freq: 523, dur: 0.12 },
  { freq: 392, dur: 0.12 },
  { freq: 523, dur: 0.12 },
  { freq: 392, dur: 0.12 },
  { freq: 659, dur: 0.12 },
  { freq: 523, dur: 0.12 },
  { freq: 587, dur: 0.12 },
  { freq: 494, dur: 0.12 },
  { freq: 523, dur: 0.12 },
  { freq: 392, dur: 0.12 },
  { freq: 523, dur: 0.12 },
  { freq: 392, dur: 0.12 },
  { freq: 698, dur: 0.12 },
  { freq: 587, dur: 0.12 },
  { freq: 659, dur: 0.12 },
  { freq: 523, dur: 0.12 },
  { freq: 440, dur: 0.12 },
  { freq: 659, dur: 0.12 },
  { freq: 440, dur: 0.12 },
  { freq: 659, dur: 0.12 },
  { freq: 698, dur: 0.12 },
  { freq: 659, dur: 0.12 },
  { freq: 587, dur: 0.12 },
  { freq: 494, dur: 0.12 },
  { freq: 523, dur: 0.12 },
  { freq: 659, dur: 0.12 },
  { freq: 784, dur: 0.12 },
  { freq: 659, dur: 0.12 },
  { freq: 587, dur: 0.12 },
  { freq: 494, dur: 0.12 },
  { freq: 523, dur: 0.24 },
  { freq: null, dur: 0.12 },
  // B — half-time swell that breaks up the riff before it snaps back
  { freq: 415, dur: 0.24 },
  { freq: 494, dur: 0.24 },
  { freq: 523, dur: 0.24 },
  { freq: 622, dur: 0.24 },
  { freq: 587, dur: 0.24 },
  { freq: 523, dur: 0.24 },
  { freq: 494, dur: 0.36 },
  { freq: null, dur: 0.12 },
  // C — the riff again a step darker, then a run home
  { freq: 392, dur: 0.12 },
  { freq: 523, dur: 0.12 },
  { freq: 392, dur: 0.12 },
  { freq: 523, dur: 0.12 },
  { freq: 622, dur: 0.12 },
  { freq: 523, dur: 0.12 },
  { freq: 587, dur: 0.12 },
  { freq: 494, dur: 0.12 },
  { freq: 440, dur: 0.12 },
  { freq: 523, dur: 0.12 },
  { freq: 659, dur: 0.12 },
  { freq: 523, dur: 0.12 },
  { freq: 698, dur: 0.12 },
  { freq: 659, dur: 0.12 },
  { freq: 587, dur: 0.12 },
  { freq: 523, dur: 0.12 },
  { freq: 494, dur: 0.12 },
  { freq: 587, dur: 0.12 },
  { freq: 698, dur: 0.12 },
  { freq: 880, dur: 0.24 },
  { freq: 784, dur: 0.12 },
  { freq: 659, dur: 0.12 },
  { freq: 523, dur: 0.36 },
  { freq: null, dur: 0.12 },
  // D — pedal-tone chase, the tensest stretch, then a scramble back to the top
  { freq: 330, dur: 0.12 },
  { freq: 494, dur: 0.12 },
  { freq: 330, dur: 0.12 },
  { freq: 523, dur: 0.12 },
  { freq: 330, dur: 0.12 },
  { freq: 587, dur: 0.12 },
  { freq: 330, dur: 0.12 },
  { freq: 659, dur: 0.12 },
  { freq: 349, dur: 0.12 },
  { freq: 523, dur: 0.12 },
  { freq: 349, dur: 0.12 },
  { freq: 587, dur: 0.12 },
  { freq: 349, dur: 0.12 },
  { freq: 659, dur: 0.12 },
  { freq: 349, dur: 0.12 },
  { freq: 698, dur: 0.12 },
  { freq: 392, dur: 0.18 },
  { freq: 494, dur: 0.18 },
  { freq: 587, dur: 0.18 },
  { freq: 698, dur: 0.18 },
  { freq: 784, dur: 0.18 },
  { freq: 880, dur: 0.18 },
  { freq: 1047, dur: 0.36 },
  { freq: null, dur: 0.18 },
  { freq: 784, dur: 0.12 },
  { freq: 659, dur: 0.12 },
  { freq: 587, dur: 0.12 },
  { freq: 523, dur: 0.12 },
  { freq: 494, dur: 0.12 },
  { freq: 440, dur: 0.12 },
  { freq: 392, dur: 0.42 },
  { freq: null, dur: 0.24 },
];

// Boss fights, ~11.4s per loop. E phrygian an octave under BATTLE_THEME and
// a hair faster: the low E alternates with every melody note so the single
// voice still carries a pounding bass, and the b2 (F) and tritone (Bb) keep
// it from ever sounding like the cheerful major-key riff of ordinary fights.
export const BOSS_THEME: Note[] = [
  // A — pedal riff
  { freq: 165, dur: 0.11 },
  { freq: 330, dur: 0.11 },
  { freq: 165, dur: 0.11 },
  { freq: 349, dur: 0.11 },
  { freq: 165, dur: 0.11 },
  { freq: 392, dur: 0.11 },
  { freq: 165, dur: 0.11 },
  { freq: 349, dur: 0.11 },
  { freq: 165, dur: 0.11 },
  { freq: 330, dur: 0.11 },
  { freq: 165, dur: 0.11 },
  { freq: 349, dur: 0.11 },
  { freq: 165, dur: 0.11 },
  { freq: 466, dur: 0.11 },
  { freq: 165, dur: 0.11 },
  { freq: 440, dur: 0.11 },
  { freq: 165, dur: 0.11 },
  { freq: 330, dur: 0.11 },
  { freq: 165, dur: 0.11 },
  { freq: 349, dur: 0.11 },
  { freq: 165, dur: 0.11 },
  { freq: 392, dur: 0.11 },
  { freq: 165, dur: 0.11 },
  { freq: 494, dur: 0.11 },
  { freq: 523, dur: 0.11 },
  { freq: 494, dur: 0.11 },
  { freq: 466, dur: 0.11 },
  { freq: 440, dur: 0.11 },
  { freq: 392, dur: 0.22 },
  { freq: 349, dur: 0.22 },
  // B — half-time stabs in the low register, the weight of the thing
  { freq: 165, dur: 0.22 },
  { freq: null, dur: 0.11 },
  { freq: 165, dur: 0.11 },
  { freq: 175, dur: 0.22 },
  { freq: null, dur: 0.11 },
  { freq: 175, dur: 0.11 },
  { freq: 196, dur: 0.22 },
  { freq: null, dur: 0.11 },
  { freq: 196, dur: 0.11 },
  { freq: 233, dur: 0.33 },
  { freq: null, dur: 0.11 },
  { freq: 165, dur: 0.22 },
  { freq: null, dur: 0.11 },
  { freq: 165, dur: 0.11 },
  { freq: 175, dur: 0.22 },
  { freq: null, dur: 0.11 },
  { freq: 175, dur: 0.11 },
  { freq: 196, dur: 0.11 },
  { freq: 220, dur: 0.11 },
  { freq: 233, dur: 0.11 },
  { freq: 247, dur: 0.55 },
  // C — a high wail with the leading tone (D#) pulling at it
  { freq: 659, dur: 0.33 },
  { freq: 622, dur: 0.11 },
  { freq: 659, dur: 0.22 },
  { freq: 698, dur: 0.22 },
  { freq: 659, dur: 0.22 },
  { freq: 523, dur: 0.22 },
  { freq: 494, dur: 0.33 },
  { freq: null, dur: 0.11 },
  { freq: 523, dur: 0.33 },
  { freq: 494, dur: 0.11 },
  { freq: 523, dur: 0.22 },
  { freq: 587, dur: 0.22 },
  { freq: 523, dur: 0.22 },
  { freq: 466, dur: 0.22 },
  { freq: 494, dur: 0.33 },
  { freq: null, dur: 0.11 },
  // a tumble back down onto the pedal that restarts the loop
  { freq: 784, dur: 0.11 },
  { freq: 698, dur: 0.11 },
  { freq: 659, dur: 0.11 },
  { freq: 622, dur: 0.11 },
  { freq: 659, dur: 0.11 },
  { freq: 494, dur: 0.11 },
  { freq: 330, dur: 0.22 },
];

// BATTLE_THEME's riff in a region's own key, for ordinary fights there
// (bosses and giants keep BOSS_THEME). Every note keeps its length, so the
// rhythm stays the riff's; each pitch moves `steps` places along the C major
// scale (a sharp moving with its note), which re-centres the same white keys
// on another mode. `alter` then nudges pitch classes by a semitone and
// `register` scales the whole line (0.5 = an octave down).
function battleVariant(steps: number, alter: Record<number, number> = {}, register = 1): Note[] {
  const scale = [0, 2, 4, 5, 7, 9, 11];
  return BATTLE_THEME.map(({ freq, dur }) => {
    if (freq === null) return { freq, dur };
    const midi = Math.round(69 + 12 * Math.log2(freq / 440));
    const sharp = scale.includes(midi % 12) ? 0 : 1;
    const degree = Math.floor((midi - sharp) / 12) * 7 + scale.indexOf((midi - sharp) % 12) + steps;
    const moved = Math.floor(degree / 7) * 12 + scale[degree % 7] + sharp;
    const out = moved + (alter[moved % 12] ?? 0);
    return { freq: Math.round(440 * 2 ** ((out - 69) / 12) * register), dur };
  });
}

// FOREST_THEME's D dorian: the riff's C turns D, and its two chromatic notes
// land on Bb and F, the Bb being the one the forest's Bbmaj7 borrows
export const FOREST_BATTLE_THEME = battleVariant(1);
// SNOW_THEME's A minor: two steps down the riff goes aeolian and a shade
// lower, colder than the town's major without turning into the boss's dread
export const SNOW_BATTLE_THEME = battleVariant(-2);
// VOLCANO_THEME's D harmonic minor, an octave down for its weight: the dorian
// version with B flattened and C sharpened, so the riff's B-to-C turns become
// the C#-to-D leading tone. BOSS_THEME (E phrygian, its pedal riff, the b2)
// stays the darker of the two, so the FLAME DRAKE's fight still escalates.
export const VOLCANO_BATTLE_THEME = battleVariant(1, { 11: -1, 0: 1 }, 0.5);

// Every note's own `vol` stays relative; this is the single knob for how loud
// the game is overall. Above 1 because the per-note levels were mixed very
// conservatively — the limiter below absorbs the peaks when notes stack.
const MASTER_VOLUME = 2.8;
// BGM sits under the effects on purpose, but not as far under as it did
const BGM_VOLUME = 0.055;
// Weather beds at full strength (a storm's rain, a blizzard's hardest gust).
// They play for minutes at a time, so they sit well under a single blip.
const RAIN_VOLUME = 0.035;
const WIND_VOLUME = 0.04;
const THUNDER_VOLUME = 0.14;
// Area ambience (Sfx.ambience/setDrone): under the weather beds and far under
// the BGM's notes (0.055): background life you notice when you listen for it.
// The high cues (birds, crickets) sit lowest, since a sine at 3-5kHz is where
// the ear is most sensitive; the low ones get more to be heard at all.
const AMBIENCE_VOLUME: Record<AmbienceCue, number> = {
  bird: 0.012,
  warble: 0.012,
  cricket: 0.006,
  owl: 0.022,
  drip: 0.02,
  bubble: 0.026,
  rumble: 0.045,
  // a festival firework bursting over the town (NightSky.ts): far off, so
  // about the owl's level
  pop: 0.024,
};
const DRONE_VOLUME = 0.02;
// BGM is booked on the AudioContext's own clock: every BGM_TICK_MS a timer
// books the notes due in the next BGM_LOOKAHEAD seconds at their exact start
// times. One setTimeout per note left each note to the main thread, and a
// scene being built (title -> town) held a 300ms note to 405ms. A stall
// longer than the lookahead (building the town took ~0.6s headless) leaves
// the next note in the past; it starts BGM_LEAD from "now" instead, so the
// tune waits and goes on rather than skipping what the stall overran or
// playing it late in a heap. BGM_LEAD also puts a fresh start just ahead.
const BGM_TICK_MS = 50;
const BGM_LOOKAHEAD = 0.2;
const BGM_LEAD = 0.05;

export type AmbienceCue = "bird" | "warble" | "cricket" | "owl" | "drip" | "bubble" | "rumble" | "pop";

export class Sfx {
  private static ctx: AudioContext | null = null;
  private static master: GainNode | null = null;
  private static bgmBus: GainNode | null = null;
  private static sfxBus: GainNode | null = null;
  private static bgmTimer: ReturnType<typeof setInterval> | null = null;
  private static bgmTrack: Note[] | null = null;
  private static bgmIndex = 0;
  // the AudioContext time the next note starts at; null until anchored
  private static bgmNext: number | null = null;
  // notes booked ahead and not started yet, so a track change or a hidden
  // tab can call them off
  private static bgmBooked: Array<{ osc: OscillatorNode; at: number }> = [];
  private static resuming = false;

  static ensure(): void {
    if (Sfx.ctx) {
      // autoplay policies can start (or leave) the context suspended when
      // it's created before any user gesture, e.g. by the title screen's
      // BGM starting on load, and iOS "interrupts" it (a call, another
      // app's audio, the page in the background) — a state that isn't
      // "suspended", so it never came back. Resume whenever it isn't
      // running, short of closed; one request at a time, as the BGM's
      // booking calls this every tick until it does run.
      const state: string = Sfx.ctx.state;
      if (state !== "running" && state !== "closed" && !Sfx.resuming) {
        Sfx.resuming = true;
        Sfx.ctx
          .resume()
          .catch(() => undefined)
          .finally(() => {
            Sfx.resuming = false;
          });
      }
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      Sfx.ctx = new AC();
      // notes -> master gain -> limiter -> speakers, so boosting the master
      // can't clip when a BGM note and a hit land on the same frame
      const limiter = Sfx.ctx.createDynamicsCompressor();
      limiter.threshold.value = -8;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.1;
      Sfx.master = Sfx.ctx.createGain();
      Sfx.master.gain.value = MASTER_VOLUME;
      Sfx.master.connect(limiter).connect(Sfx.ctx.destination);
      Sfx.bgmBus = Sfx.ctx.createGain();
      Sfx.sfxBus = Sfx.ctx.createGain();
      Sfx.applyVolumes();
      Sfx.bgmBus.connect(Sfx.master);
      Sfx.sfxBus.connect(Sfx.master);
    } catch {
      Sfx.ctx = null;
      Sfx.master = null;
      Sfx.bgmBus = null;
      Sfx.sfxBus = null;
    }
  }

  static toggleMuted(): boolean {
    GameState.soundMuted = !GameState.soundMuted;
    GameState.saveSettings();
    // the BGM notes booked ahead would still sound for up to the lookahead
    if (GameState.soundMuted) Sfx.callOffBookedBgm();
    return GameState.soundMuted;
  }

  // settings-screen volume knobs: BGM and effects get separate gain buses so
  // each mixes live without touching the per-note levels baked into callers
  static applyVolumes(): void {
    if (!Sfx.ctx || !Sfx.bgmBus || !Sfx.sfxBus) return;
    Sfx.bgmBus.gain.value = GameState.bgmVolume;
    Sfx.sfxBus.gain.value = GameState.sfxVolume;
  }

  static playBgm(track: Note[]): void {
    if (Sfx.bgmTrack === track) return; // already looping this one
    Sfx.bgmTrack = track;
    Sfx.restartBgmLoop();
  }

  private static restartBgmLoop(): void {
    Sfx.stopBgmClock();
    if (!Sfx.bgmTrack) return;
    Sfx.bgmIndex = 0;
    Sfx.bgmNext = null;
    // the first booking waits for the first tick: scenes call playBgm() at
    // the top of create(), and a note booked then went out just before the
    // rest of create() stalled the main thread, its next one ~0.6s late
    Sfx.bgmTimer = setInterval(Sfx.bookBgm, BGM_TICK_MS);
  }

  // stops the booking and calls off the notes booked ahead
  private static stopBgmClock(): void {
    if (Sfx.bgmTimer !== null) clearInterval(Sfx.bgmTimer);
    Sfx.bgmTimer = null;
    Sfx.callOffBookedBgm();
  }

  // a note already sounding plays out, as it did when each note had its own
  // timer; the ones booked to start later never do
  private static callOffBookedBgm(): void {
    for (const b of Sfx.bgmBooked) {
      try {
        // a stop time before its start: the note never sounds
        b.osc.stop();
      } catch {
        // already ended
      }
    }
    Sfx.bgmBooked = [];
  }

  private static bookBgm(): void {
    const track = Sfx.bgmTrack;
    if (!track) return;
    // muted, no context is made just for silence (tone() never made one)
    if (!GameState.soundMuted) Sfx.ensure();
    const ctx = Sfx.ctx;
    // a suspended context's clock is frozen: book nothing, and anchor afresh
    // once it runs, rather than piling the notes onto one instant
    if (ctx?.state !== "running") {
      Sfx.bgmNext = null;
      return;
    }
    const now = ctx.currentTime;
    Sfx.bgmBooked = Sfx.bgmBooked.filter((b) => b.at > now);
    // a fresh start, or a stall that left the next note in the past
    if (Sfx.bgmNext === null || Sfx.bgmNext < now) Sfx.bgmNext = now + BGM_LEAD;
    while (Sfx.bgmNext < now + BGM_LOOKAHEAD) {
      const note = track[Sfx.bgmIndex];
      // muted, the notes still go by (tone() returns null), so unmuting
      // comes back in time
      if (note.freq) {
        const osc = Sfx.tone(note.freq, note.dur * 0.9, "triangle", BGM_VOLUME, Sfx.bgmNext - now, Sfx.bgmBus);
        if (osc) Sfx.bgmBooked.push({ osc, at: Sfx.bgmNext });
      }
      Sfx.bgmIndex = (Sfx.bgmIndex + 1) % track.length;
      Sfx.bgmNext += note.dur;
    }
  }

  // A hidden tab clamps timers to >=1000ms, longer than the lookahead, which
  // would turn the loop into a slow, broken dribble of notes. Go silent
  // instead and pick the same track back up (from its first note) on
  // return. Wired to document visibilitychange in main.ts, which on return
  // also wakes a context the system suspended meanwhile.
  static suspendBgmForHiddenTab(): void {
    Sfx.stopBgmClock();
  }

  static resumeBgmFromHiddenTab(): void {
    if (Sfx.ctx) Sfx.ensure();
    if (Sfx.bgmTrack && Sfx.bgmTimer === null) Sfx.restartBgmLoop();
  }

  private static tone(
    freq: number,
    dur: number,
    type: OscillatorType = "square",
    vol = 0.08,
    when = 0,
    bus: GainNode | null = null,
  ): OscillatorNode | null {
    if (GameState.soundMuted) return null;
    Sfx.ensure();
    if (!Sfx.ctx) return null;
    // autoplay policy: a context created before any user gesture stays
    // suspended with currentTime frozen, so every scheduled note would pile
    // onto the same timestamp and fire at once on resume — skip them instead
    if (Sfx.ctx.state !== "running") return null;
    const t = Sfx.ctx.currentTime + when;
    const osc = Sfx.ctx.createOscillator();
    const gain = Sfx.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(bus ?? Sfx.sfxBus ?? Sfx.master ?? Sfx.ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
    return osc;
  }

  static move(): void {
    Sfx.tone(600, 0.03, "square", 0.04);
  }

  static attack(): void {
    Sfx.tone(240, 0.08, "square", 0.09);
    Sfx.tone(180, 0.12, "square", 0.08, 0.03);
  }

  // impact crack for the moment a blow actually lands — attack() above is the
  // swing, hit() below is the enemy's heavy thud
  static strike(): void {
    Sfx.tone(900, 0.03, "square", 0.08);
    Sfx.tone(160, 0.09, "sawtooth", 0.1, 0.02);
  }

  static critical(): void {
    Sfx.tone(150, 0.05, "square", 0.1);
    Sfx.tone(700, 0.1, "square", 0.09, 0.04);
  }

  static magic(): void {
    Sfx.tone(440, 0.12, "triangle", 0.08);
    Sfx.tone(660, 0.14, "triangle", 0.07, 0.06);
    Sfx.tone(880, 0.18, "triangle", 0.06, 0.12);
  }

  // a soft low hum under a held open fifth, so a shield reads as something
  // settling around the hero rather than another attack spell's rising run
  static ward(): void {
    Sfx.tone(196, 0.4, "triangle", 0.06);
    Sfx.tone(523, 0.3, "triangle", 0.06, 0.05);
    Sfx.tone(784, 0.35, "triangle", 0.05, 0.1);
  }

  // the ultimate: a fast two-octave charge, then the boom timed to
  // BattleScene.castNova's last blast (~0.7s in) — sawtooth low end so laptop
  // speakers still carry it
  static nova(): void {
    [262, 392, 523, 784, 1047].forEach((f, i) => {
      Sfx.tone(f, 0.08, "square", 0.05, i * 0.05);
    });
    Sfx.tone(1568, 0.25, "triangle", 0.05, 0.25);
    Sfx.tone(90, 0.5, "sawtooth", 0.11, 0.7);
    Sfx.tone(130, 0.45, "sawtooth", 0.09, 0.72);
  }

  static hit(): void {
    Sfx.tone(110, 0.16, "sawtooth", 0.1);
    Sfx.tone(80, 0.2, "sawtooth", 0.08, 0.03);
  }

  // two pitches a semitone apart beat against each other, and that sour
  // wobble reads as sickness; the little pop after it is the bubble. Short
  // and under hit()'s level because it ticks every turn, often next to a blow.
  static poison(): void {
    Sfx.tone(220, 0.09, "sawtooth", 0.05);
    Sfx.tone(233, 0.09, "sawtooth", 0.04);
    Sfx.tone(520, 0.04, "square", 0.035, 0.07);
  }

  // a brittle crack, then glassy triangle notes high above everything else in
  // the mix so the frost glints instead of thuds
  static freeze(): void {
    Sfx.tone(1200, 0.02, "square", 0.05);
    Sfx.tone(1568, 0.06, "triangle", 0.06, 0.02);
    Sfx.tone(2093, 0.06, "triangle", 0.05, 0.06);
    Sfx.tone(1760, 0.07, "triangle", 0.05, 0.1);
    Sfx.tone(2637, 0.12, "triangle", 0.04, 0.14);
  }

  static victory(): void {
    Sfx.tone(523, 0.1, "square", 0.07);
    Sfx.tone(659, 0.1, "square", 0.07, 0.09);
    Sfx.tone(784, 0.18, "square", 0.07, 0.18);
  }

  static levelup(): void {
    Sfx.tone(523, 0.09, "square", 0.08);
    Sfx.tone(659, 0.09, "square", 0.08, 0.08);
    Sfx.tone(784, 0.09, "square", 0.08, 0.16);
    Sfx.tone(1047, 0.22, "square", 0.08, 0.24);
  }

  static capture(): void {
    Sfx.tone(784, 0.1, "triangle", 0.08);
    Sfx.tone(659, 0.1, "triangle", 0.08, 0.09);
    Sfx.tone(523, 0.2, "triangle", 0.08, 0.18);
  }

  static buy(): void {
    Sfx.tone(880, 0.06, "square", 0.06);
    Sfx.tone(1320, 0.1, "square", 0.06, 0.05);
  }

  static error(): void {
    Sfx.tone(160, 0.12, "sawtooth", 0.08);
  }

  static run(): void {
    Sfx.tone(600, 0.06, "square", 0.06);
    Sfx.tone(700, 0.06, "square", 0.06, 0.05);
    Sfx.tone(800, 0.1, "square", 0.06, 0.1);
  }

  static boss(): void {
    Sfx.tone(90, 0.35, "sawtooth", 0.11);
    Sfx.tone(120, 0.35, "sawtooth", 0.09, 0.2);
  }

  // lower than boss() so the two never blur together: a semitone cluster
  // that shudders, then a tritone above it as the snarl. Sawtooth keeps
  // enough upper harmonics for laptop speakers that can't play the root.
  static enrage(): void {
    Sfx.tone(82, 0.4, "sawtooth", 0.11);
    Sfx.tone(87, 0.4, "sawtooth", 0.09);
    Sfx.tone(117, 0.35, "sawtooth", 0.1, 0.22);
    Sfx.tone(124, 0.35, "sawtooth", 0.08, 0.22);
  }

  // a boss winding up a telegraphed strike: three low steps climbing a
  // semitone at a time, unresolved on purpose — the answer is next turn's hit
  static charge(): void {
    Sfx.tone(98, 0.22, "sawtooth", 0.08);
    Sfx.tone(104, 0.22, "sawtooth", 0.08, 0.2);
    Sfx.tone(110, 0.4, "sawtooth", 0.09, 0.4);
    Sfx.tone(220, 0.4, "square", 0.04, 0.4);
  }

  static pickup(): void {
    Sfx.tone(880, 0.07, "square", 0.06);
    Sfx.tone(1175, 0.12, "square", 0.06, 0.06);
  }

  static spark(): void {
    Sfx.tone(1400, 0.04, "square", 0.05);
    Sfx.tone(900, 0.06, "square", 0.04, 0.03);
  }

  // BOLT's stun: a buzzing stutter that leaps high/low, so it reads as
  // current through the body rather than spark()'s single crackle
  static shock(): void {
    [1600, 380, 1500, 360, 1400].forEach((f, i) => {
      Sfx.tone(f, 0.035, "square", 0.05, i * 0.04);
    });
  }

  static chest(): void {
    Sfx.tone(200, 0.12, "sawtooth", 0.08);
    Sfx.tone(150, 0.1, "sawtooth", 0.07, 0.08);
    Sfx.tone(660, 0.14, "square", 0.06, 0.14);
  }

  static night(): void {
    Sfx.tone(330, 0.1, "triangle", 0.05);
  }

  static gameover(): void {
    Sfx.tone(392, 0.2, "square", 0.08);
    Sfx.tone(330, 0.2, "square", 0.08, 0.18);
    Sfx.tone(262, 0.3, "square", 0.08, 0.36);
    Sfx.tone(196, 0.5, "square", 0.08, 0.56);
  }

  // ---- weather ----
  // Rain and blizzard wind are looped noise through filters, each on its own
  // gain into the effects bus, so the SFX volume knob reaches them like any
  // other effect. Ambient sets their levels (0..1) every frame from its
  // weather mix, so they swell and fade with it, midnight hand-over included,
  // and drop to 0 when a field scene shuts down (a battle, the title).
  private static noise: AudioBuffer | null = null;
  private static weatherBed: { rain: GainNode; wind: GainNode; windTone: BiquadFilterNode } | null = null;
  private static weatherLevels = { rain: -1, wind: -1 };

  static setWeatherSound(rain: number, wind: number): void {
    // nothing playing yet: don't build a graph (or a context) to fade out silence
    if (!Sfx.weatherBed && rain <= 0 && wind <= 0) return;
    // tone() checks the mute per note; a loop has to be faded instead
    const quiet = GameState.soundMuted || document.hidden;
    const r = quiet ? 0 : rain;
    const w = quiet ? 0 : wind;
    if (Math.abs(r - Sfx.weatherLevels.rain) < 0.01 && Math.abs(w - Sfx.weatherLevels.wind) < 0.01) return;
    const bed = Sfx.buildWeatherBed();
    if (!bed || !Sfx.ctx) return;
    Sfx.weatherLevels = { rain: r, wind: w };
    const t = Sfx.ctx.currentTime;
    bed.rain.gain.setTargetAtTime(r * RAIN_VOLUME, t, 0.3);
    bed.wind.gain.setTargetAtTime(w * WIND_VOLUME, t, 0.4);
    // a stronger gust howls higher
    bed.windTone.frequency.setTargetAtTime(320 + 520 * w, t, 0.4);
  }

  private static buildWeatherBed(): typeof Sfx.weatherBed {
    if (Sfx.weatherBed) return Sfx.weatherBed;
    Sfx.ensure();
    const ctx = Sfx.ctx;
    if (!ctx || !Sfx.sfxBus) return null;
    const loop = (offset: number): AudioBufferSourceNode => {
      const src = ctx.createBufferSource();
      src.buffer = Sfx.noiseBuffer(ctx);
      src.loop = true;
      src.start(0, offset);
      return src;
    };
    // rain: broadband hiss with the rumble and the fizz filtered off
    const rain = ctx.createGain();
    rain.gain.value = 0;
    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 450;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 4200;
    loop(0).connect(highpass).connect(lowpass).connect(rain).connect(Sfx.sfxBus);
    // wind: a narrow band that setWeatherSound slides up with the gust
    const wind = ctx.createGain();
    wind.gain.value = 0;
    const windTone = ctx.createBiquadFilter();
    windTone.type = "bandpass";
    windTone.frequency.value = 320;
    windTone.Q.value = 1.4;
    loop(1).connect(windTone).connect(wind).connect(Sfx.sfxBus);
    // A hidden tab stops the game loop, so nothing would call
    // setWeatherSound to fade these: do it here. The first frame back sets
    // the levels again.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) Sfx.setWeatherSound(0, 0);
    });
    Sfx.weatherBed = { rain, wind, windTone };
    return Sfx.weatherBed;
  }

  private static noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (Sfx.noise) return Sfx.noise;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    Sfx.noise = buffer;
    return buffer;
  }

  // A distant roll: lowpassed noise that swells fast and dies away over ~2.4s,
  // with a sub tone under it for weight. `strength` 0..1 scales it.
  static thunder(strength = 1): void {
    if (GameState.soundMuted) return;
    Sfx.ensure();
    const ctx = Sfx.ctx;
    if (ctx?.state !== "running") return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = Sfx.noiseBuffer(ctx);
    src.loop = true;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(300, t);
    lowpass.frequency.exponentialRampToValueAtTime(80, t + 2.2);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(THUNDER_VOLUME * Math.max(0.05, strength), t + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    src
      .connect(lowpass)
      .connect(gain)
      .connect(Sfx.sfxBus ?? ctx.destination);
    src.start(t, Math.random() * 1.5);
    src.stop(t + 2.5);
    Sfx.tone(46, 1.4, "sine", 0.09 * strength, 0.05);
  }

  // ---- area ambience ----
  // One-shot sounds of a place, fired by Ambient at random gaps with a level
  // (0..1) it works out from the hour and the weather. Every pitch and gap is
  // drawn fresh, so nothing repeats exactly.
  static ambience(cue: AmbienceCue, strength = 1): void {
    if (GameState.soundMuted || document.hidden || strength <= 0) return;
    Sfx.ensure();
    if (Sfx.ctx?.state !== "running") return;
    const vol = AMBIENCE_VOLUME[cue] * Math.min(1, strength);
    const r = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);
    if (cue === "bird") {
      // a short run of rising chirps
      const f = r(2400, 3400);
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) Sfx.sweep(f * r(0.95, 1.08), f * r(1.2, 1.4), 0.07, vol, i * r(0.09, 0.14));
    } else if (cue === "warble") {
      // the forest's birds: lower, longer, a slide down and back up
      const f = r(1500, 2200);
      Sfx.sweep(f, f * 0.8, 0.16, vol, 0);
      Sfx.sweep(f * 0.85, f * 1.15, 0.18, vol, r(0.18, 0.24));
    } else if (cue === "cricket") {
      // two or three trains of very short pulses
      const f = r(4200, 4800);
      const trains = 2 + Math.floor(Math.random() * 2);
      for (let k = 0; k < trains; k++) for (let i = 0; i < 5; i++) Sfx.sweep(f, f, 0.018, vol, k * 0.32 + i * 0.04, "sine", 0.002);
    } else if (cue === "owl") {
      // "hoo ... hoo-hoo", each a soft swell sagging a little
      const f = r(360, 420);
      Sfx.sweep(f, f * 0.92, 0.32, vol, 0, "sine", 0.06);
      Sfx.sweep(f * 0.97, f * 0.9, 0.22, vol, 0.55, "sine", 0.05);
      Sfx.sweep(f * 0.97, f * 0.88, 0.3, vol, 0.8, "sine", 0.05);
    } else if (cue === "drip") {
      // a plink that drops in pitch, and its fainter echo off the cave walls
      const f = r(1500, 2300);
      Sfx.sweep(f, f * 0.55, 0.12, vol, 0);
      Sfx.sweep(f, f * 0.55, 0.12, vol * 0.3, r(0.16, 0.22));
    } else if (cue === "bubble") {
      // a lava "blup": a low note pulled sharply up, sometimes twice
      const f = r(110, 190);
      Sfx.sweep(f, f * 1.7, 0.12, vol, 0, "triangle");
      if (Math.random() < 0.4) Sfx.sweep(f * 1.2, f * 2, 0.1, vol * 0.7, r(0.12, 0.2), "triangle");
    } else if (cue === "pop") {
      // a soft thump as the shell opens, then a faint crackle of sparks
      Sfx.sweep(r(150, 210), 60, 0.22, vol, 0, "sine", 0.004);
      for (let i = 0; i < 4; i++) Sfx.sweep(r(2600, 4200), r(1800, 2400), 0.03, vol * 0.25, r(0.18, 0.5), "triangle", 0.002);
    } else {
      Sfx.rumble(vol);
    }
  }

  // A held low note under a place (the cave's resonance, the crater's rumble):
  // noise through a narrow band at `freq`, faded to `level` (0..1). Driven
  // every frame by Ambient like the weather beds, and faded out the same way
  // for a mute, a hidden tab, or leaving the scene.
  private static drone: { gain: GainNode; band: BiquadFilterNode } | null = null;
  private static droneLevel = -1;

  static setDrone(level: number, freq = 110): void {
    if (!Sfx.drone && level <= 0) return;
    const l = GameState.soundMuted || document.hidden ? 0 : level;
    if (Math.abs(l - Sfx.droneLevel) < 0.01) return;
    Sfx.ensure();
    const ctx = Sfx.ctx;
    if (!ctx || !Sfx.sfxBus) return;
    if (!Sfx.drone) {
      const src = ctx.createBufferSource();
      src.buffer = Sfx.noiseBuffer(ctx);
      src.loop = true;
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.Q.value = 6;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(band).connect(gain).connect(Sfx.sfxBus);
      src.start(0, 0.5);
      // the game loop stops with a hidden tab, so fade from here
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) Sfx.setDrone(0);
      });
      Sfx.drone = { gain, band };
    }
    Sfx.droneLevel = l;
    const t = ctx.currentTime;
    Sfx.drone.band.frequency.setTargetAtTime(freq, t, 0.2);
    Sfx.drone.gain.gain.setTargetAtTime(l * DRONE_VOLUME, t, 0.6);
  }

  // a far-off groan: thunder's recipe, lower, softer and slower to swell
  private static rumble(vol: number): void {
    const ctx = Sfx.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = Sfx.noiseBuffer(ctx);
    src.loop = true;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(140, t);
    lowpass.frequency.exponentialRampToValueAtTime(60, t + 2);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    src
      .connect(lowpass)
      .connect(gain)
      .connect(Sfx.sfxBus ?? ctx.destination);
    src.start(t, Math.random() * 1.5);
    src.stop(t + 2.3);
  }

  // One gliding note on the effects bus: frequency `f0` -> `f1` over `dur`,
  // a short `attack` then an exponential fade. tone() is fixed-pitch, which
  // can't chirp.
  private static sweep(f0: number, f1: number, dur: number, vol: number, when = 0, type: OscillatorType = "sine", attack = 0.008): void {
    const ctx = Sfx.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(Sfx.sfxBus ?? ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
}
