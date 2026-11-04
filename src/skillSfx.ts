// The battle skills' and techs' sounds, as sfxKit programs: one for the
// cast (a spell's charge, a weapon's swing) and one for each blow landing.
// BattleScene plays them (playSkillSfx) as a skill starts and at each
// onHit(i) of its effects (skillFx.ts, techFx.ts), in place of the shared
// magic()/nova()/strike(). Each element keeps one family across its skills,
// beside the spells it shares an element with:
// - fire (FLAME PILLAR, METEOR, FIRE TORNADO): a roar of band-passed noise
//   over a driven sawtooth growl on A, with BURN's crackle (the kit's "spark")
// - ice (ICE SPIKES, FROST NOVA): a brittle crack and glassy triangle notes
//   high over everything, as the kit's "freeze"
// - bolt (CHAIN BOLT, THUNDERCLAP): STUN's metal-noise buzz leaping between a
//   high and a low clock (the kit's "shock"), and a square zap falling
// - arcane (ARCANE BEAM, MISSILES, STAR FALL): pulse and triangle notes on
//   the A minor chord, as the kit's "magic"
// - dark (SOUL DRAIN, VOID, SCYTHE REAP, BLACK HOLE): sawtooth and
//   triangle sinking, wide slow vibrato
// - weapons: a noise whoosh for the swing, a hiss and a ting for the cut
// A skill of several blows steps each blow up the scale (i), so a run of
// them climbs instead of repeating, and each has its own name, so the kit's
// repeat guard never swallows one. Levels (each Voice's `mix`, measured
// headless on the master bus before the limiter, six shots 0.4s apart): the
// strongest blows (VOID, METEOR, QUAKE, BLACK HOLE, THUNDERCLAP) at the
// plain strike's level, about -23 dBFS, which they stand in for; other
// single blows 1-4dB under it; each blow of a run -28 to -33, round the
// plain swing (-28); casts -26 to -31, under magic() (-24) and the blows.
import { Sfx } from "./audio";
import { degree, hz, registerSfx, type SfxPitch, type SfxProgram, type SfxStep } from "./sfxKit";
import type { SkillName } from "./skillFx";
import type { TechName } from "./techFx";

interface Sound {
  /** the one-line sound target it is authored to */
  target: string;
  pitch: SfxPitch;
  steps: SfxStep[];
}

interface Voice {
  /** "skill:<name>:..." or "tech:<name>:..." */
  kind: "skill" | "tech";
  /** blows it lands (skillFx SKILL_HITS, techFx TECH_HITS): one hit program each */
  hits: number;
  /**
   * dB on every step's vol, [cast, hits]: the mix, set by measuring each
   * program against the old battle sounds (headless, the master bus before
   * the limiter, six shots 0.4s apart), so the sounds keep their shapes here
   * and their levels in one place
   */
  mix: [number, number];
  cast: Sound;
  /** blow i of `hits` */
  hit: (i: number) => Sound;
}

const KEY: SfxPitch = "key";
const NONE: SfxPitch = "none";
const sound = (target: string, pitch: SfxPitch, steps: SfxStep[]): Sound => ({ target, pitch, steps });

// ---- shared recipes, one per family ----

// a weapon's swing: noise swept up through a bandpass
const whoosh = (target: string, dur: number, from: number, to: number, vol: number): Sound =>
  sound(target, NONE, [
    { at: 0, dur, wave: "noise", freq: 9000, to: 28000, vol, attack: dur * 0.4, filter: { type: "bandpass", freq: from, to, q: 1.4 } },
  ]);

// bolt: STUN's buzz (the kit's "shock": metal noise leaping between a high
// and a low clock) stuttering louder as the charge gathers, square chirps
// snapping up out of it
const SHOCK_CLOCKS = [150000, 36000];
const boltCharge = (target: string, dur: number): Sound => {
  const n = Math.round(dur / 0.04);
  return sound(target, KEY, [
    ...Array.from(
      { length: n },
      (_, k): SfxStep => ({
        at: k * 0.04,
        dur: 0.035,
        wave: "metal",
        freq: SHOCK_CLOCKS[k % 2],
        vol: 0.025 + (0.03 * k) / Math.max(1, n - 1),
        hold: 0.015,
      }),
    ),
    { at: dur * 0.45, dur: 0.04, wave: "square", freq: hz("E6"), vol: 0.045 },
    { at: dur * 0.7, dur: 0.04, wave: "square", freq: hz("B6"), vol: 0.045 },
  ]);
};
// bolt: the shock's high and low buzz once each, hard, as a bolt lands
const shockSnap = (vol: number): SfxStep[] => [
  { at: 0, dur: 0.035, wave: "metal", freq: SHOCK_CLOCKS[0], vol, hold: 0.015 },
  { at: 0.035, dur: 0.04, wave: "metal", freq: SHOCK_CLOCKS[1], vol: vol * 0.85, hold: 0.015 },
];

// fire: the roar of a blast of flame over a driven growl on A1, and BURN's
// crackle (the kit's "spark": a hiss snapping off, a pulse tick E7 -> B6)
const fireRoar = (dur: number, vol: number, bright: number): SfxStep[] => [
  { at: 0, dur: 0.04, wave: "square", freq: hz("A3"), vol: 0.06 },
  { at: 0.04, dur: 0.05, wave: "noise", freq: 36000, to: 12000, vol: vol * 0.6, filter: { type: "highpass", freq: 2200 } },
  { at: 0.05, dur: 0.06, wave: "pulse12", freq: hz("E7"), to: hz("B6"), vol: vol * 0.3 },
  {
    at: 0,
    dur,
    wave: "noise",
    freq: 8000,
    to: 20000,
    vol,
    hold: dur * 0.2,
    drive: 0.4,
    filter: { type: "bandpass", freq: 600, to: bright, q: 1.2 },
  },
  {
    at: 0,
    dur: dur * 0.85,
    wave: "sawtooth",
    freq: hz("A1"),
    to: hz("E1"),
    vol: vol * 0.9,
    drive: 0.6,
    filter: { type: "lowpass", freq: 600 },
  },
];

// ice: a brittle crack and a shower of glass falling down the given notes
const iceBurst = (notes: string[], vol: number): SfxStep[] => [
  { at: 0, dur: 0.03, wave: "square", freq: hz("C6"), vol: vol * 0.8 },
  { at: 0, dur: 0.1, wave: "noise", freq: 36000, vol: vol * 0.9, crush: 5, filter: { type: "highpass", freq: 4000 } },
  { at: 0, dur: 0.12, wave: "triangle", freq: hz("E3"), to: hz("A2"), vol: vol * 0.9 },
  ...notes.map((n, k): SfxStep => ({ at: 0.02 + k * 0.045, dur: 0.1 + k * 0.02, wave: "triangle", freq: hz(n), vol: vol * 0.7 })),
];

// dark: a boom that caves in, a driven sawtooth on A1 under crushed noise
const darkBoom = (vol: number): SfxStep[] => [
  { at: 0, dur: 0.04, wave: "square", freq: hz("A4"), vol: 0.06 },
  { at: 0, dur: 0.6, wave: "sawtooth", freq: hz("A1"), vol, hold: 0.08, drive: 0.8, filter: { type: "lowpass", freq: 700, to: 300 } },
  { at: 0, dur: 0.5, wave: "noise", freq: 12000, to: 1500, vol: vol * 0.75, crush: 3, filter: { type: "lowpass", freq: 5000, to: 300 } },
  { at: 0, dur: 0.2, wave: "metal", freq: 20000, vol: vol * 0.4 },
];

// a weapon's cut: a hiss and a ting `d` white keys over C5, a low knock under
const cut = (d: number, vol: number): SfxStep[] => [
  { at: 0, dur: 0.1, wave: "noise", freq: 34000, vol, filter: { type: "highpass", freq: 3500 } },
  { at: 0, dur: 0.07, wave: "square", freq: degree(d), vol: vol * 0.65 },
  { at: 0.01, dur: 0.09, wave: "triangle", freq: degree(d - 14), vol: vol * 0.8 },
];

const VOICES: Record<SkillName | TechName, Voice> = {
  // ---- skills (skillFx.ts) ----

  "ARCANE BEAM": {
    kind: "skill",
    hits: 1,
    mix: [5, -1.5],
    cast: sound("a charging arcane whine: pulse25 A4 sliding up to A5 under a fast vibrato, a soft hiss under it", KEY, [
      { at: 0, dur: 0.28, wave: "pulse25", freq: hz("A4"), to: hz("A5"), vol: 0.06, attack: 0.03, vib: { rate: 16, cents: 25 } },
      { at: 0.02, dur: 0.25, wave: "noise", freq: 18000, vol: 0.025, attack: 0.05, filter: { type: "bandpass", freq: 3000, q: 2 } },
    ]),
    hit: () =>
      sound("the beam lands and holds: a bright zap, then a buzzing pulse12 hum on A5 trembling fast for half a second", KEY, [
        { at: 0, dur: 0.06, wave: "square", freq: hz("E6"), to: hz("A5"), vol: 0.08 },
        { at: 0, dur: 0.08, wave: "noise", freq: 30000, vol: 0.05, filter: { type: "highpass", freq: 2500 } },
        {
          at: 0.03,
          dur: 0.5,
          wave: "pulse12",
          freq: hz("A5"),
          vol: 0.05,
          hold: 0.3,
          vib: { rate: 30, cents: 40 },
          filter: { type: "lowpass", freq: 4000 },
        },
        { at: 0.03, dur: 0.5, wave: "pulse25", freq: hz("A4"), vol: 0.035, hold: 0.3, vib: { rate: 24, cents: 20 } },
      ]),
  },

  THORNS: {
    kind: "skill",
    hits: 1,
    mix: [2, 4],
    cast: sound("seeds cracking under the soil: three dry metal ticks walking up over a low earthy rumble", NONE, [
      { at: 0, dur: 0.3, wave: "noise", freq: 2000, vol: 0.035, attack: 0.08, filter: { type: "lowpass", freq: 600 } },
      { at: 0, dur: 0.05, wave: "metal", freq: 9000, vol: 0.05, filter: { type: "bandpass", freq: 1500, q: 2 } },
      { at: 0.07, dur: 0.05, wave: "metal", freq: 11000, vol: 0.05, filter: { type: "bandpass", freq: 1800, q: 2 } },
      { at: 0.14, dur: 0.05, wave: "metal", freq: 14000, vol: 0.05, filter: { type: "bandpass", freq: 2200, q: 2 } },
    ]),
    hit: () =>
      sound("a woody spike punching through: a low triangle thunk dropping E3 to A2, a splintering crunch of noise", KEY, [
        { at: 0, dur: 0.14, wave: "triangle", freq: hz("E3"), to: hz("A2"), vol: 0.12 },
        { at: 0, dur: 0.18, wave: "noise", freq: 9000, vol: 0.08, crush: 4, filter: { type: "bandpass", freq: 1200, q: 3 } },
        { at: 0.02, dur: 0.05, wave: "square", freq: hz("A4"), vol: 0.04 },
      ]),
  },

  MISSILES: {
    kind: "skill",
    hits: 3,
    mix: [2, 2],
    cast: sound("five violet blips fanning out of the hand: magic's pulse25 run A5 C6 E6 A6 C7, spaced as the bolts leave", KEY, [
      ...["A5", "C6", "E6", "A6", "C7"].map(
        (n, k): SfxStep => ({ at: k * 0.09, dur: 0.07, wave: "pulse25", freq: hz(n), vol: 0.04, hold: 0.02 }),
      ),
      { at: 0, dur: 0.4, wave: "noise", freq: 24000, vol: 0.015, attack: 0.1, filter: { type: "highpass", freq: 5000 } },
    ]),
    hit: (i) =>
      sound("a dart pops: a bright square blip over a puff of hiss and a soft thump, each dart two white keys higher", KEY, [
        { at: 0, dur: 0.07, wave: "square", freq: degree(4 + 2 * i), vol: 0.065 },
        { at: 0, dur: 0.09, wave: "noise", freq: 26000, vol: 0.045, filter: { type: "highpass", freq: 3000 } },
        { at: 0.01, dur: 0.12, wave: "triangle", freq: degree(-3 + 2 * i), vol: 0.07 },
      ]),
  },

  "FLAME PILLAR": {
    kind: "skill",
    hits: 1,
    mix: [-2.3, -4.2],
    cast: sound("fire gathering in the cracks: a low rumble of noise opening from dull to bright over a soft A2 growl", KEY, [
      { at: 0, dur: 0.45, wave: "noise", freq: 3000, to: 9000, vol: 0.06, attack: 0.2, filter: { type: "lowpass", freq: 400, to: 1600 } },
      { at: 0.1, dur: 0.35, wave: "sawtooth", freq: hz("A2"), vol: 0.035, attack: 0.15, filter: { type: "lowpass", freq: 300 } },
    ]),
    hit: () =>
      sound("the pillar erupts: a roaring whoosh of noise sweeping up over a driven sawtooth growl on A1", KEY, fireRoar(0.5, 0.1, 2400)),
  },

  "CHAIN BOLT": {
    kind: "skill",
    hits: 3,
    mix: [-3, -3],
    cast: boltCharge("static gathering in the hand: STUN's high-low buzz stuttering louder, two square chirps snapping up out of it", 0.3),
    hit: (i) =>
      sound(
        "an electric snap down the chain: STUN's high-low buzz, hard, and a square zap falling an octave, a step higher each time",
        KEY,
        [
          ...shockSnap(0.08),
          { at: 0, dur: 0.12, wave: "square", freq: degree(14 + 2 * i), to: degree(7 + 2 * i), vol: 0.06 },
          { at: 0, dur: 0.04, wave: "noise", freq: 40000, vol: 0.05, filter: { type: "highpass", freq: 4000 } },
        ],
      ),
  },

  "ICE SPIKES": {
    kind: "skill",
    hits: 1,
    mix: [4.5, 3],
    cast: sound("frost running along the floor: glassy triangle notes climbing E6 G6 B6 over a thin icy hiss", KEY, [
      { at: 0, dur: 0.08, wave: "triangle", freq: hz("E6"), vol: 0.045 },
      { at: 0.06, dur: 0.08, wave: "triangle", freq: hz("G6"), vol: 0.045 },
      { at: 0.12, dur: 0.1, wave: "triangle", freq: hz("B6"), vol: 0.045 },
      { at: 0, dur: 0.3, wave: "noise", freq: 30000, vol: 0.02, attack: 0.1, filter: { type: "highpass", freq: 6000 } },
    ]),
    hit: () =>
      sound("ice blades bursting up: a brittle crack, a low knock, then glass falling E7 B6 E6", KEY, iceBurst(["E7", "B6", "E6"], 0.08)),
  },

  LASER: {
    kind: "skill",
    hits: 4,
    mix: [8, 5],
    cast: sound("a quick capacitor whine: a pulse12 sliding C6 up to C7 and a tick at the top", KEY, [
      { at: 0, dur: 0.14, wave: "pulse12", freq: hz("C6"), to: hz("C7"), vol: 0.05, attack: 0.04 },
      { at: 0.11, dur: 0.05, wave: "square", freq: hz("C7"), vol: 0.03 },
    ]),
    hit: (i) =>
      sound("a laser bolt strikes: a pulse25 zap diving from high to low into a sizzle, each shot a white key higher", KEY, [
        { at: 0, dur: 0.1, wave: "pulse25", freq: degree(12 + i), to: degree(5 + i), vol: 0.08 },
        { at: 0, dur: 0.08, wave: "noise", freq: 30000, vol: 0.04, filter: { type: "bandpass", freq: 5000, q: 2 } },
      ]),
  },

  "SOUL DRAIN": {
    kind: "skill",
    hits: 1,
    mix: [1, 3],
    // its moan sits at 165-220Hz: a pulse an octave up moans with it (A4 to
    // E4, the same wide vibrato) so it carries on small speakers
    cast: sound(
      "an eerie moan: a triangle A3 bending down to E3 under a slow wide vibrato, a pulse an octave up with it, a breath of noise",
      KEY,
      [
        { at: 0, dur: 0.5, wave: "triangle", freq: hz("A3"), to: hz("E3"), vol: 0.07, attack: 0.08, vib: { rate: 6, cents: 40 } },
        {
          at: 0,
          dur: 0.5,
          wave: "pulse25",
          freq: hz("A4"),
          to: hz("E4"),
          vol: 0.07,
          attack: 0.08,
          vib: { rate: 6, cents: 40 },
          filter: { type: "lowpass", freq: 2500 },
        },
        { at: 0, dur: 0.45, wave: "noise", freq: 6000, vol: 0.025, attack: 0.1, filter: { type: "bandpass", freq: 900, q: 3 } },
      ],
    ),
    hit: () =>
      sound("a soul ripped loose: a hollow triangle wail rising A4 to A5 with vibrato over a sucking sweep of noise", KEY, [
        { at: 0, dur: 0.06, wave: "square", freq: hz("A3"), vol: 0.05 },
        { at: 0, dur: 0.4, wave: "triangle", freq: hz("A4"), to: hz("A5"), vol: 0.08, vib: { rate: 9, cents: 30 } },
        { at: 0, dur: 0.35, wave: "noise", freq: 4000, to: 20000, vol: 0.04, filter: { type: "bandpass", freq: 600, to: 3000, q: 2 } },
      ]),
  },

  QUAKE: {
    kind: "skill",
    hits: 1,
    mix: [-1.5, -8.2],
    // its rumble is all under 300Hz, so a pulse an octave up (E3) and a
    // trembling square two up (E4), with a gritty band of noise, carry it on
    // a laptop's speakers
    cast: sound(
      "the ground grumbling: a dull rumble of slow noise under a low sawtooth on E2, a trembling E3/E4 growl and grit over it",
      KEY,
      [
        { at: 0, dur: 0.5, wave: "noise", freq: 1200, vol: 0.07, attack: 0.15, filter: { type: "lowpass", freq: 250 } },
        { at: 0.05, dur: 0.45, wave: "sawtooth", freq: hz("E2"), vol: 0.045, attack: 0.2, filter: { type: "lowpass", freq: 200 } },
        { at: 0.05, dur: 0.45, wave: "pulse25", freq: hz("E3"), vol: 0.07, attack: 0.2, filter: { type: "lowpass", freq: 1000 } },
        {
          at: 0.08,
          dur: 0.42,
          wave: "square",
          freq: hz("E4"),
          vol: 0.045,
          attack: 0.25,
          vib: { rate: 9, cents: 25 },
          filter: { type: "lowpass", freq: 1600 },
        },
        { at: 0, dur: 0.5, wave: "noise", freq: 5000, vol: 0.08, attack: 0.15, filter: { type: "bandpass", freq: 800, q: 1.5 } },
      ],
    ),
    hit: () =>
      // the boom is mostly under 150Hz: its fall doubled an octave up (A2 to
      // E2, driven) and two up (A3 to E3), and a crunch of mid noise, so a
      // laptop hears the slam
      sound(
        "the earth slams: a crushed low boom, a driven sawtooth falling A1 to E1 under rumbling noise, doubled A2/A3 and crunching",
        KEY,
        [
          { at: 0, dur: 0.03, wave: "square", freq: hz("E3"), vol: 0.06 },
          {
            at: 0,
            dur: 0.45,
            wave: "pulse25",
            freq: hz("A2"),
            to: hz("E2"),
            vol: 0.16,
            hold: 0.04,
            drive: 0.5,
            filter: { type: "lowpass", freq: 1500 },
          },
          { at: 0, dur: 0.3, wave: "square", freq: hz("A3"), to: hz("E3"), vol: 0.09, filter: { type: "lowpass", freq: 2000 } },
          { at: 0, dur: 0.3, wave: "noise", freq: 9000, to: 4000, vol: 0.14, crush: 4, filter: { type: "bandpass", freq: 1200, q: 1.2 } },
          {
            at: 0,
            dur: 0.55,
            wave: "sawtooth",
            freq: hz("A1"),
            to: hz("E1"),
            vol: 0.13,
            hold: 0.06,
            drive: 0.7,
            filter: { type: "lowpass", freq: 400 },
          },
          { at: 0, dur: 0.5, wave: "noise", freq: 2500, to: 800, vol: 0.1, crush: 4, filter: { type: "lowpass", freq: 900, to: 250 } },
        ],
      ),
  },

  EMP: {
    kind: "skill",
    hits: 1,
    mix: [0, 2],
    cast: sound("a charging electric whine: a square climbing C5 to C7 over a rising metal buzz", KEY, [
      { at: 0, dur: 0.35, wave: "square", freq: hz("C5"), to: hz("C7"), vol: 0.04, attack: 0.05, filter: { type: "lowpass", freq: 5000 } },
      { at: 0, dur: 0.35, wave: "metal", freq: 30000, to: 70000, vol: 0.03, attack: 0.15 },
    ]),
    hit: () =>
      sound("the dome pops: a white crack and a metal buzz, then a whine dying down C6 to C4 as the power fails", KEY, [
        { at: 0, dur: 0.05, wave: "noise", freq: 40000, vol: 0.07 },
        { at: 0, dur: 0.12, wave: "metal", freq: 60000, vol: 0.06 },
        { at: 0.02, dur: 0.4, wave: "pulse25", freq: hz("C6"), to: hz("C4"), vol: 0.06 },
        { at: 0.02, dur: 0.3, wave: "square", freq: hz("C5"), to: hz("C3"), vol: 0.035 },
      ]),
  },

  SMITE: {
    kind: "skill",
    hits: 1,
    mix: [4, -1.5],
    cast: sound("a holy ting from above: a bright triangle C7 then a shimmering G6", KEY, [
      { at: 0, dur: 0.2, wave: "triangle", freq: hz("C7"), vol: 0.05 },
      { at: 0.08, dur: 0.25, wave: "triangle", freq: hz("G6"), vol: 0.045, vib: { rate: 7, cents: 15 } },
      { at: 0, dur: 0.25, wave: "noise", freq: 40000, vol: 0.015, filter: { type: "highpass", freq: 8000 } },
    ]),
    hit: () =>
      sound("the hammer of light lands: a bell-like square C5 and G5 struck together over a white slam and a low thud", KEY, [
        { at: 0, dur: 0.45, wave: "square", freq: hz("C5"), vol: 0.055, filter: { type: "lowpass", freq: 3000 } },
        { at: 0, dur: 0.45, wave: "square", freq: hz("G5"), vol: 0.045, filter: { type: "lowpass", freq: 3000 } },
        { at: 0, dur: 0.4, wave: "triangle", freq: hz("C6"), vol: 0.04 },
        { at: 0, dur: 0.15, wave: "noise", freq: 30000, vol: 0.08, filter: { type: "lowpass", freq: 6000 } },
        { at: 0, dur: 0.2, wave: "sawtooth", freq: hz("C2"), vol: 0.08, drive: 0.4 },
      ]),
  },

  METEOR: {
    kind: "skill",
    hits: 1,
    mix: [0, -8.5],
    cast: sound("something incoming: a sine whistling down C7 to C5 as a hiss of air grows", KEY, [
      { at: 0, dur: 0.3, wave: "sine", freq: hz("C7"), to: hz("C5"), vol: 0.05, attack: 0.04 },
      {
        at: 0,
        dur: 0.3,
        wave: "noise",
        freq: 20000,
        to: 8000,
        vol: 0.035,
        attack: 0.2,
        filter: { type: "bandpass", freq: 3000, to: 1500 },
      },
    ]),
    hit: () =>
      sound("the meteor smashes: a blast of noise sweeping down into a long driven rumble on A1, the biggest fire", KEY, [
        { at: 0, dur: 0.04, wave: "square", freq: hz("A3"), vol: 0.06 },
        {
          at: 0,
          dur: 0.6,
          wave: "noise",
          freq: 30000,
          to: 3000,
          vol: 0.12,
          hold: 0.05,
          drive: 0.5,
          filter: { type: "lowpass", freq: 8000, to: 400 },
        },
        {
          at: 0,
          dur: 0.55,
          wave: "sawtooth",
          freq: hz("A1"),
          to: hz("E1"),
          vol: 0.12,
          hold: 0.05,
          drive: 0.7,
          filter: { type: "lowpass", freq: 500 },
        },
      ]),
  },

  "STAR FALL": {
    kind: "skill",
    hits: 5,
    mix: [5, 2.5],
    cast: sound("a twinkling cascade: triangle C7 G6 E6 C6 falling like stars over a sparkle of hiss", KEY, [
      ...["C7", "G6", "E6", "C6"].map((n, k): SfxStep => ({ at: k * 0.06, dur: 0.1, wave: "triangle", freq: hz(n), vol: 0.045 })),
      { at: 0, dur: 0.3, wave: "noise", freq: 40000, vol: 0.015, filter: { type: "highpass", freq: 7000 } },
    ]),
    hit: (i) =>
      sound("a star lands: a soft triangle ping with a little pop and a puff of hiss, each star a note up C6 D6 E6 G6 A6", KEY, [
        { at: 0, dur: 0.14, wave: "triangle", freq: degree(7 + [0, 1, 2, 4, 5][Math.min(i, 4)]), vol: 0.065 },
        { at: 0, dur: 0.05, wave: "square", freq: degree(7 + [0, 1, 2, 4, 5][Math.min(i, 4)]), vol: 0.03 },
        { at: 0, dur: 0.06, wave: "noise", freq: 26000, vol: 0.035, filter: { type: "highpass", freq: 3000 } },
      ]),
  },

  VOID: {
    kind: "skill",
    hits: 1,
    mix: [0, -8.3],
    cast: sound("the void opening: a sawtooth drone sinking A2 to A1 as its filter closes, motes hissing in", KEY, [
      {
        at: 0,
        dur: 0.55,
        wave: "sawtooth",
        freq: hz("A2"),
        to: hz("A1"),
        vol: 0.07,
        attack: 0.1,
        filter: { type: "lowpass", freq: 1500, to: 300 },
      },
      { at: 0, dur: 0.5, wave: "noise", freq: 20000, to: 6000, vol: 0.025, attack: 0.2, filter: { type: "highpass", freq: 3000 } },
    ]),
    hit: () =>
      sound(
        "the black star bursts: a crushed booming implosion, a driven sawtooth A1 under metal and noise, the strongest blow",
        KEY,
        darkBoom(0.13),
      ),
  },

  // ---- techs (techFx.ts): the weapons' cast is the swing as the hero dashes in ----

  "DOUBLE SLASH": {
    kind: "tech",
    hits: 2,
    mix: [6, 2.5],
    cast: whoosh("a quick blade whoosh: noise swept up through a bandpass", 0.14, 900, 4000, 0.05),
    hit: (i) =>
      sound("a crisp slash: a bright hissing cut and a square ting on E6, the cross-cut a third higher on G6", KEY, cut(9 + 2 * i, 0.075)),
  },

  UPPERCUT: {
    kind: "tech",
    hits: 1,
    mix: [6, 4],
    cast: whoosh("a rising whoosh up the foe's front", 0.16, 600, 3000, 0.05),
    hit: () =>
      sound("a comic punch pop: a square bouncing C4 up to C5 over a thump, a G5 twinkle after", KEY, [
        { at: 0, dur: 0.12, wave: "square", freq: hz("C4"), to: hz("C5"), vol: 0.07 },
        { at: 0, dur: 0.08, wave: "noise", freq: 12000, vol: 0.07, filter: { type: "lowpass", freq: 2500 } },
        { at: 0, dur: 0.1, wave: "sawtooth", freq: hz("C2"), vol: 0.06 },
        { at: 0.05, dur: 0.12, wave: "triangle", freq: hz("G5"), vol: 0.04 },
      ]),
  },

  "WHIP CRACK": {
    kind: "tech",
    hits: 1,
    mix: [7.5, 4],
    cast: sound("a whistling swish as the whip rolls out: a thin noise rising through a narrow band", NONE, [
      {
        at: 0,
        dur: 0.2,
        wave: "noise",
        freq: 16000,
        to: 36000,
        vol: 0.045,
        attack: 0.1,
        filter: { type: "bandpass", freq: 2000, to: 6000, q: 4 },
      },
    ]),
    hit: () =>
      sound("a whip crack: an instant white snap and a pulse25 click on E7, a short tail of hiss", KEY, [
        { at: 0, dur: 0.06, wave: "noise", freq: 44000, vol: 0.1, filter: { type: "highpass", freq: 2000 } },
        { at: 0, dur: 0.04, wave: "pulse25", freq: hz("E7"), vol: 0.06 },
        { at: 0.01, dur: 0.1, wave: "noise", freq: 20000, vol: 0.05, filter: { type: "bandpass", freq: 3000, q: 2 } },
      ]),
  },

  "DAGGER FLURRY": {
    kind: "tech",
    hits: 4,
    mix: [8, 6],
    cast: whoosh("a light flick of the dagger", 0.1, 1500, 5000, 0.04),
    hit: (i) =>
      i < 3
        ? sound("a quick snick: a tiny high tick of noise and a square blip, each a white key higher", KEY, [
            { at: 0, dur: 0.05, wave: "noise", freq: 40000, vol: 0.055, filter: { type: "highpass", freq: 5000 } },
            { at: 0, dur: 0.04, wave: "square", freq: degree(9 + i), vol: 0.04 },
          ])
        : sound("the big last cut: a bright hiss and a ting with a glint ringing on E7", KEY, [
            ...cut(12, 0.05),
            { at: 0.03, dur: 0.3, wave: "triangle", freq: hz("E7"), vol: 0.025, vib: { rate: 12, cents: 15 } },
          ]),
  },

  "SPEAR SWEEP": {
    kind: "tech",
    hits: 1,
    mix: [4.5, 2],
    cast: whoosh("a long low swoosh swinging round", 0.3, 400, 1500, 0.055),
    hit: () =>
      sound("a heavy sweeping thwack: a low triangle knock on A2, a snap of hiss and dust rolling off", KEY, [
        { at: 0, dur: 0.14, wave: "triangle", freq: hz("A2"), vol: 0.11 },
        { at: 0, dur: 0.05, wave: "noise", freq: 30000, vol: 0.06, filter: { type: "highpass", freq: 3000 } },
        { at: 0, dur: 0.3, wave: "noise", freq: 5000, to: 2000, vol: 0.06, filter: { type: "lowpass", freq: 1200, to: 400 } },
      ]),
  },

  "SPIN SLASH": {
    kind: "tech",
    hits: 3,
    mix: [4, 3.5],
    cast: whoosh("a whirl winding up", 0.25, 800, 3000, 0.05),
    hit: (i) =>
      sound("a ring of blade closes: a metallic ching on C6, E6, G6 by turn, the third flaring brighter", KEY, [
        { at: 0, dur: 0.12, wave: "metal", freq: 80000, vol: 0.045, filter: { type: "highpass", freq: 2000 } },
        { at: 0, dur: 0.1, wave: "square", freq: degree(7 + 2 * i), vol: i === 2 ? 0.06 : 0.045 },
        { at: 0, dur: 0.08, wave: "noise", freq: 30000, vol: i === 2 ? 0.07 : 0.05, filter: { type: "highpass", freq: 3000 } },
        { at: 0.02, dur: i === 2 ? 0.25 : 0.1, wave: "triangle", freq: degree(14), vol: i === 2 ? 0.04 : 0.02 },
      ]),
  },

  "HEAVY CLEAVE": {
    kind: "tech",
    hits: 1,
    mix: [1.6, -2.8],
    cast: sound("a glint over the head: a bright triangle C7 ting, then a heavy whoosh building", KEY, [
      { at: 0, dur: 0.12, wave: "triangle", freq: hz("C7"), vol: 0.045 },
      {
        at: 0.08,
        dur: 0.35,
        wave: "noise",
        freq: 6000,
        to: 16000,
        vol: 0.055,
        attack: 0.2,
        filter: { type: "bandpass", freq: 500, to: 1800, q: 1.2 },
      },
    ]),
    hit: () =>
      sound("a crushing slam into the floor: a driven sawtooth E2 down to A1 under a crushed burst of noise", KEY, [
        { at: 0, dur: 0.04, wave: "square", freq: hz("E4"), vol: 0.05 },
        { at: 0, dur: 0.45, wave: "sawtooth", freq: hz("E2"), to: hz("A1"), vol: 0.11, drive: 0.6, filter: { type: "lowpass", freq: 500 } },
        { at: 0, dur: 0.35, wave: "noise", freq: 20000, to: 2000, vol: 0.09, crush: 4, filter: { type: "lowpass", freq: 4000, to: 500 } },
      ]),
  },

  "SCYTHE REAP": {
    kind: "tech",
    hits: 1,
    mix: [1.5, 3],
    // the sines' chord sits at 220-330Hz: pulses an octave up (A4, C5, E5)
    // trace it so it carries on small speakers
    cast: sound("a slow eerie whoosh over a hollow sine A3, C4, E4 rising underneath, pulses an octave up tracing it", KEY, [
      {
        at: 0,
        dur: 0.45,
        wave: "noise",
        freq: 4000,
        to: 9000,
        vol: 0.045,
        attack: 0.2,
        filter: { type: "bandpass", freq: 500, to: 1200, q: 2 },
      },
      { at: 0, dur: 0.45, wave: "sine", freq: hz("A3"), vol: 0.035, attack: 0.1 },
      { at: 0.1, dur: 0.35, wave: "sine", freq: hz("C4"), vol: 0.03, attack: 0.08 },
      { at: 0.2, dur: 0.25, wave: "sine", freq: hz("E4"), vol: 0.025, attack: 0.06 },
      { at: 0, dur: 0.45, wave: "pulse25", freq: hz("A4"), vol: 0.05, attack: 0.1, filter: { type: "lowpass", freq: 2500 } },
      { at: 0.1, dur: 0.35, wave: "pulse25", freq: hz("C5"), vol: 0.045, attack: 0.08, filter: { type: "lowpass", freq: 2500 } },
      { at: 0.2, dur: 0.25, wave: "pulse25", freq: hz("E5"), vol: 0.04, attack: 0.06, filter: { type: "lowpass", freq: 2500 } },
    ]),
    hit: () =>
      sound("a cold reaping slice: a ringing metal-noise shear and a triangle falling A4 to A3", KEY, [
        { at: 0, dur: 0.2, wave: "metal", freq: 50000, vol: 0.06, filter: { type: "highpass", freq: 1500 } },
        { at: 0, dur: 0.12, wave: "noise", freq: 30000, vol: 0.06, filter: { type: "highpass", freq: 3000 } },
        { at: 0, dur: 0.35, wave: "triangle", freq: hz("A4"), to: hz("A3"), vol: 0.08 },
      ]),
  },

  "FIRE TORNADO": {
    kind: "tech",
    hits: 1,
    mix: [-0.6, -3.7],
    cast: sound("a swirling roar rising out of the ground: noise sweeping up over a low sawtooth A2", KEY, [
      {
        at: 0,
        dur: 0.5,
        wave: "noise",
        freq: 4000,
        to: 16000,
        vol: 0.065,
        attack: 0.25,
        filter: { type: "bandpass", freq: 400, to: 2000, q: 1.5 },
      },
      { at: 0, dur: 0.5, wave: "sawtooth", freq: hz("A2"), vol: 0.035, attack: 0.2, filter: { type: "lowpass", freq: 500 } },
    ]),
    hit: () => sound("the funnel blasts: a roaring burst of driven noise over a sawtooth growl on A1", KEY, fireRoar(0.45, 0.1, 1800)),
  },

  THUNDERCLAP: {
    kind: "tech",
    hits: 1,
    mix: [-1.5, -4.2],
    cast: boltCharge("static crackling at the foe: the bolt family's stuttering buzz and chirps, shorter", 0.22),
    hit: () =>
      sound("a thunder crack: STUN's high-low buzz snapping, a white flash of hiss and a low sawtooth boom rolling off on A1", KEY, [
        ...shockSnap(0.09),
        { at: 0, dur: 0.12, wave: "noise", freq: 44000, vol: 0.08 },
        { at: 0.02, dur: 0.55, wave: "sawtooth", freq: hz("A1"), vol: 0.1, drive: 0.5, filter: { type: "lowpass", freq: 300 } },
        { at: 0.02, dur: 0.5, wave: "noise", freq: 3000, vol: 0.06, filter: { type: "lowpass", freq: 400 } },
      ]),
  },

  "FROST NOVA": {
    kind: "tech",
    hits: 1,
    mix: [4, 2.2],
    cast: sound("cold spiralling in: glassy triangle notes E6 G6 B6 E7 spinning up over a thin hiss", KEY, [
      ...["E6", "G6", "B6", "E7"].map((n, k): SfxStep => ({ at: k * 0.06, dur: 0.09, wave: "triangle", freq: hz(n), vol: 0.04 })),
      { at: 0, dur: 0.35, wave: "noise", freq: 30000, vol: 0.02, attack: 0.15, filter: { type: "highpass", freq: 6000 } },
    ]),
    hit: () =>
      sound(
        "the snowflake bursts: a brittle crack and a bright shower of glass E7 C7 A6 E6",
        KEY,
        iceBurst(["E7", "C7", "A6", "E6"], 0.085),
      ),
  },

  "BLACK HOLE": {
    kind: "tech",
    hits: 1,
    mix: [-1.2, -8.5],
    cast: sound("a deep suck: a sawtooth sinking E2 to A1 under a hiss being drawn in", KEY, [
      {
        at: 0,
        dur: 0.55,
        wave: "sawtooth",
        freq: hz("E2"),
        to: hz("A1"),
        vol: 0.065,
        attack: 0.1,
        filter: { type: "lowpass", freq: 1200, to: 250 },
      },
      { at: 0, dur: 0.5, wave: "noise", freq: 30000, to: 4000, vol: 0.03, attack: 0.3, filter: { type: "highpass", freq: 2000 } },
    ]),
    hit: () =>
      sound("the collapse pops: a hard square pop on A5 and a dark caving boom", KEY, [
        { at: 0, dur: 0.06, wave: "square", freq: hz("A5"), vol: 0.06 },
        ...darkBoom(0.11),
      ]),
  },
};

// "FLAME PILLAR" -> "flame-pillar"
const slug = (name: string): string => name.toLowerCase().replace(/ /g, "-");
const castId = (name: SkillName | TechName): string => `${VOICES[name].kind}:${slug(name)}:cast`;
const hitId = (name: SkillName | TechName, i: number): string => `${VOICES[name].kind}:${slug(name)}:hit:${i}`;

/** every program, by event name, as registered */
export const SKILL_SFX: Record<string, SfxProgram> = {};
for (const [name, v] of Object.entries(VOICES) as [SkillName | TechName, Voice][]) {
  const add = (id: string, s: Sound, db: number): void => {
    const k = 10 ** (db / 20);
    const steps = s.steps.map((st) => ({ ...st, vol: Math.min(0.2, Math.round(st.vol * k * 1000) / 1000) }));
    SKILL_SFX[id] = { id, kind: "se", ...s, steps };
  };
  add(castId(name), v.cast, v.mix[0]);
  for (let i = 0; i < v.hits; i++) add(hitId(name, i), v.hit(i), v.mix[1]);
}
registerSfx(SKILL_SFX);

/**
 * The skill's or tech's sound: its cast as it starts, or blow i (from 0) as
 * it lands. A blow past its count plays the last one's.
 */
export function playSkillSfx(name: SkillName | TechName, phase: "cast" | "hit", i = 0): void {
  const v = VOICES[name];
  if (!v) return;
  Sfx.emit(phase === "cast" ? castId(name) : hitId(name, Math.max(0, Math.min(v.hits - 1, i))));
}
