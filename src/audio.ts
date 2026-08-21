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

// Every note's own `vol` stays relative; this is the single knob for how loud
// the game is overall. Above 1 because the per-note levels were mixed very
// conservatively — the limiter below absorbs the peaks when notes stack.
const MASTER_VOLUME = 2.8;
// BGM sits under the effects on purpose, but not as far under as it did
const BGM_VOLUME = 0.055;

export class Sfx {
  private static ctx: AudioContext | null = null;
  private static master: GainNode | null = null;
  private static bgmBus: GainNode | null = null;
  private static sfxBus: GainNode | null = null;
  private static bgmTimer: ReturnType<typeof setTimeout> | null = null;
  private static bgmTrack: Note[] | null = null;

  static ensure(): void {
    if (Sfx.ctx) {
      // autoplay policies can start (or leave) the context suspended when
      // it's created before any user gesture, e.g. by the title screen's
      // BGM starting on load; nothing else in this file ever resumes it
      if (Sfx.ctx.state === "suspended") void Sfx.ctx.resume();
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
    if (Sfx.bgmTimer !== null) clearTimeout(Sfx.bgmTimer);
    Sfx.bgmTimer = null;
    const track = Sfx.bgmTrack;
    if (!track) return;
    let i = 0;
    const step = (): void => {
      const note = track[i % track.length];
      if (note.freq) Sfx.tone(note.freq, note.dur * 0.9, "triangle", BGM_VOLUME, 0, Sfx.bgmBus);
      i++;
      Sfx.bgmTimer = setTimeout(step, note.dur * 1000);
    };
    step();
  }

  // A hidden tab clamps setTimeout to >=1000ms, which would otherwise turn
  // the loop into a slow, distorted dribble of single notes. Go silent
  // instead and pick the same track back up (from its first note) on
  // return. Wired to document visibilitychange in main.ts.
  static suspendBgmForHiddenTab(): void {
    if (Sfx.bgmTimer !== null) clearTimeout(Sfx.bgmTimer);
    Sfx.bgmTimer = null;
  }

  static resumeBgmFromHiddenTab(): void {
    if (Sfx.bgmTrack && Sfx.bgmTimer === null) Sfx.restartBgmLoop();
  }

  private static tone(freq: number, dur: number, type: OscillatorType = "square", vol = 0.08, when = 0, bus: GainNode | null = null): void {
    if (GameState.soundMuted) return;
    Sfx.ensure();
    if (!Sfx.ctx) return;
    // autoplay policy: a context created before any user gesture stays
    // suspended with currentTime frozen, so every scheduled note would pile
    // onto the same timestamp and fire at once on resume — skip them instead
    if (Sfx.ctx.state !== "running") return;
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
  }

  static move(): void {
    Sfx.tone(600, 0.03, "square", 0.04);
  }

  static attack(): void {
    Sfx.tone(240, 0.08, "square", 0.09);
    Sfx.tone(180, 0.12, "square", 0.08, 0.03);
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

  static hit(): void {
    Sfx.tone(110, 0.16, "sawtooth", 0.1);
    Sfx.tone(80, 0.2, "sawtooth", 0.08, 0.03);
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

  static pickup(): void {
    Sfx.tone(880, 0.07, "square", 0.06);
    Sfx.tone(1175, 0.12, "square", 0.06, 0.06);
  }

  static spark(): void {
    Sfx.tone(1400, 0.04, "square", 0.05);
    Sfx.tone(900, 0.06, "square", 0.04, 0.03);
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
}
