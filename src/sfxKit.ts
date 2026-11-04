// The sound-effect kit. Every effect is a program — plain data, a list of
// voice steps — and one small synth plays any program. Game code never calls
// the synth: it emits an event name (Sfx.attack() in audio.ts emits
// "attack", new code calls Sfx.emit("tech:beam")) and the kit maps the name
// to its program. Because programs are data, validateKit() can hold every
// one to the length/step budget and the music's key, and a headless page can
// render each one to measure it.
//
// Era anchor: every program is built from the same fixed primitives (square,
// 25% and 12.5% pulse, triangle, sawtooth, sine, LFSR noise in long and
// "metal" short mode, a filter, a drive, a bit crush) and leaves through one
// fixed cabinet stage (a tone lowpass, then a soft clipper that only rounds
// peaks) on its way to the effects bus. The cabinet's two settings are
// clamped, so no program can dial in a modern master. The bus after it
// (sfxBus -> master gain -> limiter) is audio.ts's.

export type SfxWave = "square" | "pulse25" | "pulse12" | "triangle" | "sawtooth" | "sine" | "noise" | "metal";

export interface SfxFilter {
  type: "lowpass" | "highpass" | "bandpass";
  /** Hz at the step's start */
  freq: number;
  /** Hz at the step's end (exponential sweep) */
  to?: number;
  q?: number;
}

/** One voice: a source through optional crush, drive and filter, under its own envelope. */
export interface SfxStep {
  /** start, seconds from the program's start */
  at: number;
  /** length, seconds, attack included; the voice decays to silence by its end */
  dur: number;
  wave: SfxWave;
  /**
   * Tonal waves: pitch in Hz (hz("E6") reads better). noise/metal: the LFSR
   * clock in Hz — higher is brighter hiss; metal's buzz sits at freq / 93.
   */
  freq: number;
  /** end pitch (or LFSR clock), exponential glide over the step */
  to?: number;
  /**
   * peak gain of this voice into the cabinet. Battle blows use 0.09..0.12 a
   * voice; the voices sum, and the cabinet rounds a sum past 0.14.
   */
  vol: number;
  /** seconds to reach `vol` (default 0.002) */
  attack?: number;
  /** seconds held at `vol` before the decay (default 0) */
  hold?: number;
  /** pitch wobble: rate in Hz, depth in cents */
  vib?: { rate: number; cents: number };
  filter?: SfxFilter;
  /** 0..1, tanh overdrive on the raw source */
  drive?: number;
  /** 2..8, amplitude bits kept on the raw source */
  crush?: number;
}

/**
 * "key": every tonal pitch (freq and to) sits on the C major / A minor white
 * keys that the title, town, forest, snow and their battle themes share
 * (played a whole step down over the minor cave and volcano tracks).
 * "none": unpitched, noise steps only. { offKey }: deliberately outside the
 * key, with the one-line reason.
 */
export type SfxPitch = "key" | "none" | { offKey: string };

export interface SfxProgram {
  /** must equal its kit key */
  id: string;
  /** se: short, repeated feedback (<= 0.6s). jingle: a rare moment's phrase (<= 1.6s). */
  kind: "se" | "jingle";
  /** the one-line sound target the program is authored to */
  target: string;
  pitch: SfxPitch;
  steps: SfxStep[];
}

export interface SfxPlayOpts {
  /** seconds from now */
  when?: number;
  /** 0..1 scales every step's vol */
  vol?: number;
  /** semitones on a "key" program's tonal steps (default: the BGM's, setSfxKeyShift) */
  shift?: number;
}

// ---- budget and key ----

export const SFX_BUDGET = { se: 0.6, jingle: 1.6, steps: 24 } as const;
// pitch classes of the white keys, C = 0
const KEY_CLASSES = [0, 2, 4, 5, 7, 9, 11];
// a hand-rounded Hz value lands within a few cents; a semitone slip is 100
const KEY_TOLERANCE_CENTS = 25;

/** "C5", "F#4", "Bb3" -> Hz (A4 = 440) */
export function hz(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note name ${name}`);
  const pc = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1] as "C"] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  const midi = (Number(m[3]) + 1) * 12 + pc;
  return 440 * 2 ** ((midi - 69) / 12);
}

/** the white-key note `degree` steps above C5 (negative goes down) */
export function degree(d: number): number {
  const oct = Math.floor(d / 7);
  return 440 * 2 ** ((72 + oct * 12 + KEY_CLASSES[d - oct * 7] - 69) / 12);
}

function inKey(f: number): boolean {
  const semis = 12 * Math.log2(f / 440) + 69;
  const nearest = Math.round(semis);
  const cents = Math.abs(semis - nearest) * 100;
  return cents <= KEY_TOLERANCE_CENTS && KEY_CLASSES.includes(((nearest % 12) + 12) % 12);
}

const isNoise = (w: SfxWave): w is "noise" | "metal" => w === "noise" || w === "metal";

export function programLength(p: SfxProgram): number {
  return Math.max(0, ...p.steps.map((s) => s.at + s.dur));
}

/** Everything wrong with one program, as readable lines (empty = fine). */
export function validateProgram(key: string, p: SfxProgram): string[] {
  const bad: string[] = [];
  const say = (msg: string): number => bad.push(`${key}: ${msg}`);
  if (p.id !== key) say(`id "${p.id}" differs from its kit key`);
  if (!p.target.trim()) say("no sound target");
  if (p.steps.length < 1 || p.steps.length > SFX_BUDGET.steps) say(`${p.steps.length} steps (1..${SFX_BUDGET.steps})`);
  const len = programLength(p);
  const cap = SFX_BUDGET[p.kind];
  if (len > cap + 1e-9) say(`${len.toFixed(3)}s is over the ${p.kind} cap ${cap}s`);
  p.steps.forEach((s, i) => {
    const at = `step ${i}`;
    if (!(s.at >= 0) || !(s.dur > 0)) say(`${at} needs at >= 0 and dur > 0`);
    if (!(s.vol > 0 && s.vol <= 0.2)) say(`${at} vol ${s.vol} outside (0, 0.2]`);
    if ((s.attack ?? 0) + (s.hold ?? 0) >= s.dur) say(`${at} attack + hold fill its whole dur`);
    if (!(s.freq > 0) || (s.to !== undefined && !(s.to > 0))) say(`${at} needs positive freq/to`);
    if (s.crush !== undefined && (s.crush < 2 || s.crush > 8)) say(`${at} crush ${s.crush} outside 2..8`);
    if (s.drive !== undefined && (s.drive < 0 || s.drive > 1)) say(`${at} drive ${s.drive} outside 0..1`);
    if (isNoise(s.wave)) return;
    if (p.pitch === "none") say(`${at} is tonal (${s.wave}) in a pitch "none" program`);
    if (p.pitch === "key") {
      for (const f of s.to === undefined ? [s.freq] : [s.freq, s.to]) {
        if (!inKey(f)) say(`${at} ${f.toFixed(1)}Hz is off the key (declare { offKey } if meant)`);
      }
    }
  });
  if (typeof p.pitch === "object" && !p.pitch.offKey.trim()) say("offKey needs its reason");
  return bad;
}

export function validateKit(kit: Record<string, SfxProgram>): string[] {
  return Object.entries(kit).flatMap(([key, p]) => validateProgram(key, p));
}

// ---- the cabinet: fixed chain, clamped settings ----

export interface SfxCabinet {
  /** Hz, the tone lowpass every effect leaves through (clamped 3000..12000) */
  tone: number;
  /** the soft clipper's ceiling, pre-master gain (clamped 0.08..0.3) */
  ceiling: number;
}

const CABINET_LIMITS = { tone: [3000, 12000], ceiling: [0.08, 0.3] } as const;
const clamp = (v: number, [lo, hi]: readonly [number, number]): number => Math.min(hi, Math.max(lo, v));

// audio.ts's master gain (2.8) puts the limiter's -8dBFS threshold at 0.142
// here. The clipper's 0.14 ceiling rounds a lone effect's peaks just under
// it, so the limiter (a compressor, which ducks short sounds far more than
// long ones) only works when effects stack on the BGM.
let cabinet: SfxCabinet = { tone: 9000, ceiling: 0.14 };

export function configureCabinet(c: Partial<SfxCabinet>): void {
  cabinet = {
    tone: clamp(c.tone ?? cabinet.tone, CABINET_LIMITS.tone),
    ceiling: clamp(c.ceiling ?? cabinet.ceiling, CABINET_LIMITS.ceiling),
  };
  cabinetInputs = new WeakMap();
}

// ---- the synth: a pure player, no named sounds ----

export interface SfxOutput {
  ctx: BaseAudioContext;
  bus: AudioNode;
}

let output: (() => SfxOutput | null) | null = null;

/** audio.ts hands over its context and effects bus (null while muted or suspended). */
export function bindSfxOutput(get: () => SfxOutput | null): void {
  output = get;
}

const shapes = new WeakMap<BaseAudioContext, Map<string, unknown>>();
function cached<T>(ctx: BaseAudioContext, key: string, make: () => T): T {
  let m = shapes.get(ctx);
  if (!m) {
    m = new Map();
    shapes.set(ctx, m);
  }
  if (!m.has(key)) m.set(key, make());
  return m.get(key) as T;
}

function curve(n: number, f: (x: number) => number): Float32Array<ArrayBuffer> {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = f((i / (n - 1)) * 2 - 1);
  return c;
}

function pulseWave(ctx: BaseAudioContext, duty: number): PeriodicWave {
  return cached(ctx, `pulse${duty}`, () => {
    const n = 64;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    return ctx.createPeriodicWave(real, imag);
  });
}

// The NES-style noise channel: a 15-bit LFSR, each state held 2 samples so
// the loop is exact. Long mode (taps 0,1) is hiss; short mode (taps 0,6)
// repeats every 93 states, a metallic buzz.
function lfsrBuffer(ctx: BaseAudioContext, metal: boolean): AudioBuffer {
  return cached(ctx, metal ? "lfsrMetal" : "lfsr", () => {
    const states = metal ? 93 : 32767;
    const buf = ctx.createBuffer(1, states * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let reg = 1;
    for (let i = 0; i < states; i++) {
      const v = reg & 1 ? -1 : 1;
      d[i * 2] = v;
      d[i * 2 + 1] = v;
      const fb = (reg & 1) ^ ((reg >> (metal ? 6 : 1)) & 1);
      reg = (reg >> 1) | (fb << 14);
    }
    return buf;
  });
}

const crushCurve = (bits: number): Float32Array<ArrayBuffer> => {
  const levels = 2 ** (bits - 1);
  return curve(4096, (x) => Math.round(x * levels) / levels);
};
const driveCurve = (drive: number): Float32Array<ArrayBuffer> => {
  const k = 1 + drive * 9;
  return curve(1024, (x) => Math.tanh(k * x) / Math.tanh(k));
};

function shaper(ctx: BaseAudioContext, key: string, make: () => Float32Array<ArrayBuffer>): WaveShaperNode {
  const node = ctx.createWaveShaper();
  node.curve = cached(ctx, key, make);
  return node;
}

let cabinetInputs = new WeakMap<AudioNode, GainNode>();
function cabinetInput(ctx: BaseAudioContext, bus: AudioNode): GainNode {
  const have = cabinetInputs.get(bus);
  if (have) return have;
  const input = ctx.createGain();
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = cabinet.tone;
  tone.Q.value = 0.5;
  const c = cabinet.ceiling;
  // c * tanh(x / c): linear while quiet, peaks rounded toward c
  const clip = shaper(ctx, `clip${c}`, () => curve(2048, (x) => c * Math.tanh(x / c)));
  input.connect(tone).connect(clip).connect(bus);
  cabinetInputs.set(bus, input);
  return input;
}

// The "key" programs are written on C major's white keys. A minor-key track
// never plays some of them (the cave's C minor has Eb where the kit has E),
// so while one plays, audio.ts moves them onto its scale. Off-key programs,
// noise and filters stay where they are.
let keyShift = 0;
export function setSfxKeyShift(semitones: number): void {
  keyShift = semitones;
}

function playStep(ctx: BaseAudioContext, out: AudioNode, s: SfxStep, t0: number, gain: number, ratio: number): void {
  const t = t0 + s.at;
  const end = t + s.dur;
  let src: AudioScheduledSourceNode;
  let head: AudioNode;
  const extra: AudioScheduledSourceNode[] = [];
  if (isNoise(s.wave)) {
    const n = ctx.createBufferSource();
    n.buffer = lfsrBuffer(ctx, s.wave === "metal");
    n.loop = true;
    const clock = ctx.sampleRate / 2;
    n.playbackRate.setValueAtTime(s.freq / clock, t);
    if (s.to !== undefined) n.playbackRate.exponentialRampToValueAtTime(s.to / clock, end);
    src = n;
    head = n;
  } else {
    const o = ctx.createOscillator();
    if (s.wave === "pulse25" || s.wave === "pulse12") o.setPeriodicWave(pulseWave(ctx, s.wave === "pulse25" ? 0.25 : 0.125));
    else o.type = s.wave;
    o.frequency.setValueAtTime(s.freq * ratio, t);
    if (s.to !== undefined) o.frequency.exponentialRampToValueAtTime(s.to * ratio, end);
    if (s.vib) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = s.vib.rate;
      depth.gain.value = s.vib.cents;
      lfo.connect(depth).connect(o.detune);
      extra.push(lfo);
    }
    src = o;
    head = o;
  }
  if (s.crush !== undefined) {
    const bits = Math.round(s.crush);
    head = head.connect(shaper(ctx, `crush${bits}`, () => crushCurve(bits)));
  }
  if (s.drive !== undefined && s.drive > 0) {
    const d = Math.round(s.drive * 20) / 20;
    head = head.connect(shaper(ctx, `drive${d}`, () => driveCurve(d)));
  }
  if (s.filter) {
    const f = ctx.createBiquadFilter();
    f.type = s.filter.type;
    f.frequency.setValueAtTime(s.filter.freq, t);
    if (s.filter.to !== undefined) f.frequency.exponentialRampToValueAtTime(s.filter.to, end);
    f.Q.value = s.filter.q ?? 1;
    head = head.connect(f);
  }
  const env = ctx.createGain();
  const peak = s.vol * gain;
  const attack = s.attack ?? 0.002;
  const top = t + attack + (s.hold ?? 0);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(peak, t + attack);
  env.gain.setValueAtTime(peak, top);
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  head.connect(env).connect(out);
  for (const node of [src, ...extra]) {
    node.start(t);
    node.stop(end + 0.01);
  }
}

/** Plays a program into `out` at context time `t0`. The pure synth; the bus below is the way in. */
export function renderProgram(ctx: BaseAudioContext, out: AudioNode, p: SfxProgram, t0: number, opts: SfxPlayOpts = {}): void {
  const gain = Math.max(0, Math.min(1, opts.vol ?? 1));
  if (gain <= 0) return;
  const ratio = p.pitch === "key" ? 2 ** ((opts.shift ?? 0) / 12) : 1;
  for (const s of p.steps) playStep(ctx, out, s, t0, gain, ratio);
}

// ---- the bus: event name -> program, with a repeat guard ----

const KIT = new Map<string, SfxProgram>();
// the same event at most this many times inside one ~frame: a burst can't
// stack one effect into a louder copy of itself
const REPEAT_CAP = 2;
const FRAME_MS = 16;
const recent = new Map<string, { at: number; n: number }>();

// a key registered twice: the later table silently replaced the earlier sound
const clashes: string[] = [];

/**
 * Adds a table of programs to the kit, once, at its module's top level (so
 * scripts/check-sound.ts finds it). Dev builds report any budget/key problem.
 */
export function registerSfx(programs: Record<string, SfxProgram>): void {
  const found: string[] = [];
  for (const [key, p] of Object.entries(programs)) {
    const had = KIT.get(key);
    if (had && had !== p) found.push(`${key}: registered twice, the later program replaced the earlier`);
    KIT.set(key, p);
  }
  clashes.push(...found);
  if (process.env.NODE_ENV !== "production") {
    for (const line of [...validateKit(programs), ...found]) console.error(`[sfxKit] ${line}`);
  }
}

/** Keys that more than one registerSfx table claimed (check:sound fails on any). */
export function registryClashes(): string[] {
  return [...clashes];
}

export function sfxProgram(name: string): SfxProgram | undefined {
  return KIT.get(name);
}

export function kitPrograms(): Record<string, SfxProgram> {
  return Object.fromEntries(KIT);
}

/** Plays a program through the cabinet into audio.ts's effects bus. */
export function playProgram(p: SfxProgram, opts: SfxPlayOpts = {}): void {
  const out = output?.();
  if (!out) return;
  renderProgram(out.ctx, cabinetInput(out.ctx, out.bus), p, out.ctx.currentTime + (opts.when ?? 0), { shift: keyShift, ...opts });
}

/** The way game code makes a sound: by event name. Unknown names are a dev error, silent in production. */
export function emitSfx(name: string, opts: SfxPlayOpts = {}): void {
  const p = KIT.get(name);
  if (!p) {
    if (process.env.NODE_ENV !== "production") console.error(`[sfxKit] no program for "${name}"`);
    return;
  }
  const now = performance.now();
  const r = recent.get(name);
  if (r && now - r.at < FRAME_MS) {
    if (r.n >= REPEAT_CAP) return;
    r.n++;
  } else recent.set(name, { at: now, n: 1 });
  playProgram(p, opts);
}

// ---- the game's kit ----
// One program per moment the player must hear. SE = repeated feedback;
// jingle = a rare state change that should land as a phrase. Moments with
// no sound on purpose: walking, dialogue typing, a panel opening, a toast.
// Levels, as A-weighted loudest 50ms (dBFS on the master bus; the BGM's is
// -24): the ultimate -17, a boss's sting and rage -18, the battle blows
// (attack, strike, hit) -20, spells and status -21..-22, reward and state
// jingles -20..-22 so they never cover a blow, ticks and menu confirms
// -23..-25. The menu cursor, the most frequent sound, sits at -31 but in its
// own register (4.5kHz centroid, 10dB over the BGM above 1.5kHz) instead of
// more level. Low sounds carry square doubles an octave up, since a laptop
// speaker plays little under 150Hz. The tonal pitches stay on the white keys
// that most of the music uses; the deliberate clashes say why in `pitch`.

const N = hz;

const GAME_KIT: Record<string, SfxProgram> = {
  // ---- menus ----
  move: {
    id: "move",
    kind: "se",
    target: "cursor: a 30ms 12.5% pulse tick on A6, a register above the BGM's line so it never hides in it",
    pitch: "key",
    steps: [{ at: 0, dur: 0.035, wave: "pulse12", freq: N("A6"), vol: 0.11, hold: 0.008 }],
  },
  buy: {
    id: "buy",
    kind: "se",
    target: "confirm: a clean square hop up a fifth, C6 -> G6, over in a blink",
    pitch: "key",
    steps: [
      { at: 0, dur: 0.05, wave: "pulse25", freq: N("C6"), vol: 0.046, hold: 0.025 },
      { at: 0.045, dur: 0.11, wave: "pulse25", freq: N("G6"), vol: 0.046, hold: 0.035 },
    ],
  },
  error: {
    id: "error",
    kind: "se",
    target: "refusal: two short low buzzes, a driven semitone cluster that never resolves",
    pitch: { offKey: "a refusal should rub against the key, not sit in it" },
    steps: [
      { at: 0, dur: 0.07, wave: "sawtooth", freq: N("G3"), vol: 0.042, hold: 0.035, drive: 0.6 },
      { at: 0, dur: 0.07, wave: "sawtooth", freq: N("Ab3"), vol: 0.038, hold: 0.035, drive: 0.6 },
      { at: 0.09, dur: 0.1, wave: "sawtooth", freq: N("G3"), vol: 0.042, hold: 0.04, drive: 0.6 },
      { at: 0.09, dur: 0.1, wave: "sawtooth", freq: N("Ab3"), vol: 0.038, hold: 0.04, drive: 0.6 },
    ],
  },
  // ---- field ----
  pickup: {
    id: "pickup",
    kind: "se",
    // E and A sit inside victory's held C6 (BattleScene plays pickup 360ms
    // into it), where a B under the C rubbed a semitone
    target: "pickup: a coin chirp E6 -> A6 on a thin 12.5% pulse, the second note ringing",
    pitch: "key",
    steps: [
      { at: 0, dur: 0.06, wave: "pulse12", freq: N("E6"), vol: 0.08, hold: 0.035 },
      { at: 0.055, dur: 0.17, wave: "pulse12", freq: N("A6"), vol: 0.08, hold: 0.05 },
    ],
  },
  chest: {
    id: "chest",
    kind: "se",
    target: "chest: a creaking lid (a wobbling driven saw G3 -> D3), then a bright pulse sparkle E6 -> B6",
    pitch: "key",
    steps: [
      {
        at: 0,
        dur: 0.15,
        wave: "sawtooth",
        freq: N("G3"),
        to: N("D3"),
        vol: 0.07,
        hold: 0.06,
        drive: 0.5,
        vib: { rate: 24, cents: 40 },
        filter: { type: "lowpass", freq: 1400 },
      },
      { at: 0.14, dur: 0.07, wave: "pulse25", freq: N("E6"), vol: 0.055, hold: 0.03 },
      { at: 0.2, dur: 0.14, wave: "pulse25", freq: N("B6"), vol: 0.055, hold: 0.03 },
    ],
  },
  // ---- battle: the hero's blows ----
  attack: {
    id: "attack",
    kind: "se",
    target: "swing: a noise whoosh swept down through a band (3k -> 600Hz) over a square thump falling A3 -> A2",
    pitch: "key",
    steps: [
      { at: 0, dur: 0.13, wave: "noise", freq: 30000, vol: 0.095, attack: 0.02, filter: { type: "bandpass", freq: 3200, to: 600, q: 1.2 } },
      { at: 0.01, dur: 0.11, wave: "square", freq: N("A3"), to: N("A2"), vol: 0.055, hold: 0.02 },
    ],
  },
  strike: {
    id: "strike",
    kind: "se",
    target: "impact: a crunchy metal-noise crack (30ms) over a short driven saw thud E3 -> E2",
    pitch: "key",
    steps: [
      { at: 0, dur: 0.03, wave: "metal", freq: 70000, vol: 0.11 },
      { at: 0, dur: 0.085, wave: "noise", freq: 24000, to: 5000, vol: 0.1 },
      {
        at: 0.015,
        dur: 0.12,
        wave: "sawtooth",
        freq: N("E3"),
        to: N("E2"),
        vol: 0.1,
        hold: 0.02,
        drive: 0.6,
        filter: { type: "lowpass", freq: 2200 },
      },
    ],
  },
  critical: {
    id: "critical",
    kind: "se",
    target: "crit: a sharp noise snap and a 12.5% pulse zing leaping E6 -> B6, pitched over strike so the two stack",
    pitch: "key",
    steps: [
      { at: 0, dur: 0.04, wave: "noise", freq: 44000, vol: 0.11, filter: { type: "highpass", freq: 3500 } },
      { at: 0, dur: 0.06, wave: "square", freq: N("E3"), vol: 0.07 },
      { at: 0.02, dur: 0.05, wave: "pulse12", freq: N("E6"), vol: 0.095, hold: 0.02 },
      { at: 0.06, dur: 0.12, wave: "pulse12", freq: N("B6"), vol: 0.095, hold: 0.03, vib: { rate: 30, cents: 35 } },
    ],
  },
  magic: {
    id: "magic",
    kind: "se",
    target: "cast: a rising 25% pulse arpeggio A5-C6-E6-A6 over a soft triangle A4, the top note shimmering",
    pitch: "key",
    steps: [
      { at: 0, dur: 0.3, wave: "triangle", freq: N("A4"), vol: 0.06, hold: 0.1 },
      { at: 0, dur: 0.065, wave: "pulse25", freq: N("A5"), vol: 0.05, hold: 0.03 },
      { at: 0.06, dur: 0.065, wave: "pulse25", freq: N("C6"), vol: 0.05, hold: 0.03 },
      { at: 0.12, dur: 0.065, wave: "pulse25", freq: N("E6"), vol: 0.05, hold: 0.03 },
      { at: 0.18, dur: 0.17, wave: "pulse25", freq: N("A6"), vol: 0.05, hold: 0.05, vib: { rate: 12, cents: 25 } },
    ],
  },
  ward: {
    id: "ward",
    kind: "se",
    target: "shield: a soft triangle hum on G3 under an open fifth C5/G5 that wobbles slowly — settling, not rising",
    pitch: "key",
    steps: [
      { at: 0, dur: 0.44, wave: "triangle", freq: N("G3"), vol: 0.072, attack: 0.03, hold: 0.12 },
      { at: 0.04, dur: 0.38, wave: "triangle", freq: N("C5"), vol: 0.05, attack: 0.02, hold: 0.1, vib: { rate: 6, cents: 15 } },
      { at: 0.08, dur: 0.36, wave: "triangle", freq: N("G5"), vol: 0.04, attack: 0.02, hold: 0.08, vib: { rate: 6, cents: 15 } },
    ],
  },
  // rare and timed to the scene, so it takes a jingle's length: the boom
  // lands at 0.7s on BattleScene.castNova's last blast
  nova: {
    id: "nova",
    kind: "jingle",
    target: "ultimate: a fast two-octave pulse run C5-G5-C6-G6-C7, a G7 glint, then a driven saw-and-noise boom at 0.7s",
    pitch: "key",
    steps: [
      ...["C5", "G5", "C6", "G6", "C7"].map(
        (n, i): SfxStep => ({ at: i * 0.05, dur: 0.08, wave: "pulse25", freq: N(n), vol: 0.05, hold: 0.03 }),
      ),
      { at: 0.25, dur: 0.28, wave: "triangle", freq: N("G7"), vol: 0.04, hold: 0.05, vib: { rate: 14, cents: 20 } },
      {
        at: 0.7,
        dur: 0.5,
        wave: "sawtooth",
        freq: N("E2"),
        to: N("E1"),
        vol: 0.12,
        hold: 0.05,
        drive: 0.8,
        filter: { type: "lowpass", freq: 1600, to: 200 },
      },
      { at: 0.7, dur: 0.45, wave: "noise", freq: 9000, to: 1500, vol: 0.11, filter: { type: "lowpass", freq: 3500, to: 300 } },
      { at: 0.72, dur: 0.45, wave: "square", freq: N("A2"), to: N("A1"), vol: 0.05 },
    ],
  },
  // ---- battle: blows taken and status ----
  hit: {
    id: "hit",
    kind: "se",
    target: "hurt: a heavy driven saw thud A2 -> A1 with a dark noise body, lower and rounder than strike",
    pitch: "key",
    steps: [
      {
        at: 0,
        dur: 0.2,
        wave: "sawtooth",
        freq: N("A2"),
        to: N("A1"),
        vol: 0.095,
        hold: 0.03,
        drive: 0.7,
        filter: { type: "lowpass", freq: 1500, to: 300 },
      },
      { at: 0, dur: 0.12, wave: "noise", freq: 7000, to: 2000, vol: 0.115, filter: { type: "lowpass", freq: 2500 } },
      { at: 0.03, dur: 0.17, wave: "square", freq: N("E2"), to: N("A1"), vol: 0.045 },
    ],
  },
  poison: {
    id: "poison",
    kind: "se",
    target: "poison: two saws a semitone apart beating sour for 0.1s, then a small triangle bubble popping up",
    pitch: { offKey: "the semitone beat is what reads as sickness" },
    steps: [
      { at: 0, dur: 0.1, wave: "sawtooth", freq: N("A3"), vol: 0.058, hold: 0.04, filter: { type: "lowpass", freq: 1800 } },
      { at: 0, dur: 0.1, wave: "sawtooth", freq: N("Bb3"), vol: 0.052, hold: 0.04, filter: { type: "lowpass", freq: 1800 } },
      { at: 0.08, dur: 0.06, wave: "triangle", freq: N("C5"), to: N("A5"), vol: 0.058 },
    ],
  },
  spark: {
    id: "spark",
    kind: "se",
    target: "spark: a crackle — bright LFSR hiss snapping off in two bursts, with a falling 12.5% pulse tick E7 -> B6",
    pitch: "key",
    steps: [
      { at: 0, dur: 0.05, wave: "noise", freq: 36000, to: 12000, vol: 0.09, filter: { type: "highpass", freq: 2200 } },
      { at: 0.01, dur: 0.06, wave: "pulse12", freq: N("E7"), to: N("B6"), vol: 0.045 },
      { at: 0.055, dur: 0.04, wave: "noise", freq: 22000, vol: 0.065, filter: { type: "highpass", freq: 2800 } },
    ],
  },
  freeze: {
    id: "freeze",
    kind: "se",
    target: "frost: a brittle high noise crack, then glassy triangle notes G6 C7 A6 E7 glinting above the whole mix",
    pitch: "key",
    steps: [
      { at: 0, dur: 0.03, wave: "noise", freq: 48000, vol: 0.068, filter: { type: "highpass", freq: 5000 } },
      { at: 0.02, dur: 0.07, wave: "triangle", freq: N("G6"), vol: 0.047, hold: 0.02 },
      { at: 0.06, dur: 0.07, wave: "triangle", freq: N("C7"), vol: 0.047, hold: 0.02 },
      { at: 0.1, dur: 0.08, wave: "triangle", freq: N("A6"), vol: 0.047, hold: 0.02 },
      { at: 0.14, dur: 0.14, wave: "triangle", freq: N("E7"), vol: 0.043, hold: 0.03, vib: { rate: 20, cents: 20 } },
      { at: 0.14, dur: 0.12, wave: "pulse12", freq: N("E7"), vol: 0.015 },
    ],
  },
  shock: {
    id: "shock",
    kind: "se",
    target: "stun: a buzzing metal-noise stutter leaping between a high and a low buzz, current through the body",
    pitch: "none",
    steps: [0, 1, 2, 3, 4].map(
      (i): SfxStep => ({ at: i * 0.04, dur: 0.035, wave: "metal", freq: i % 2 ? 36000 : 150000, vol: 0.055, hold: 0.015 }),
    ),
  },
  run: {
    id: "run",
    kind: "se",
    target: "flee: three quick 12.5% pulse footsteps climbing D6-E6-G6 along the scale, each with a noise scuff",
    pitch: "key",
    steps: [
      ...["D6", "E6", "G6"].map(
        (n, i): SfxStep => ({ at: i * 0.055, dur: i === 2 ? 0.1 : 0.05, wave: "pulse12", freq: N(n), vol: 0.062, hold: 0.02 }),
      ),
      ...[0, 1, 2].map(
        (i): SfxStep => ({ at: i * 0.055, dur: 0.025, wave: "noise", freq: 16000, vol: 0.04, filter: { type: "highpass", freq: 1500 } }),
      ),
    ],
  },
  // ---- battle: the enemy's threats ----
  charge: {
    id: "charge",
    kind: "se",
    target: "telegraph: three low driven saw steps creeping up a semitone (E2-F2-F#2) under a rising noise swell, left hanging",
    pitch: { offKey: "the chromatic creep is the threat; next turn's hit answers it" },
    steps: [
      { at: 0, dur: 0.18, wave: "sawtooth", freq: N("E2"), vol: 0.08, hold: 0.09, drive: 0.6, filter: { type: "lowpass", freq: 1800 } },
      { at: 0.18, dur: 0.18, wave: "sawtooth", freq: N("F2"), vol: 0.08, hold: 0.09, drive: 0.6, filter: { type: "lowpass", freq: 1800 } },
      {
        at: 0.36,
        dur: 0.24,
        wave: "sawtooth",
        freq: N("F#2"),
        vol: 0.085,
        hold: 0.12,
        drive: 0.6,
        filter: { type: "lowpass", freq: 1800 },
      },
      { at: 0.36, dur: 0.24, wave: "square", freq: N("F#3"), vol: 0.06, hold: 0.1 },
      {
        at: 0,
        dur: 0.6,
        wave: "noise",
        freq: 4000,
        to: 24000,
        vol: 0.075,
        attack: 0.45,
        filter: { type: "bandpass", freq: 500, to: 2500, q: 1 },
      },
    ],
  },
  enrage: {
    id: "enrage",
    kind: "jingle",
    target:
      "rage: a shuddering driven saw cluster E2/F2 with square doubles, then a tritone snarl Bb/B above it, the loudest thing in the kit",
    pitch: { offKey: "a semitone cluster and the tritone: the boss turning, not a tune" },
    // the saws carry the weight; the square doubles an octave up are what a
    // laptop speaker, deaf below ~150Hz, actually plays
    steps: [
      { at: 0, dur: 0.4, wave: "sawtooth", freq: N("E2"), vol: 0.07, hold: 0.15, drive: 0.8, vib: { rate: 14, cents: 30 } },
      { at: 0, dur: 0.4, wave: "sawtooth", freq: N("F2"), vol: 0.055, hold: 0.15, drive: 0.8 },
      { at: 0, dur: 0.4, wave: "square", freq: N("E3"), vol: 0.075, hold: 0.15, vib: { rate: 14, cents: 30 } },
      { at: 0, dur: 0.4, wave: "square", freq: N("F3"), vol: 0.06, hold: 0.15 },
      { at: 0.22, dur: 0.36, wave: "sawtooth", freq: N("Bb2"), vol: 0.065, hold: 0.12, drive: 0.8 },
      { at: 0.22, dur: 0.36, wave: "square", freq: N("Bb3"), vol: 0.07, hold: 0.12 },
      { at: 0.22, dur: 0.36, wave: "square", freq: N("B3"), vol: 0.055, hold: 0.12 },
      { at: 0, dur: 0.34, wave: "noise", freq: 9000, vol: 0.075, filter: { type: "lowpass", freq: 4000 } },
    ],
  },
  boss: {
    id: "boss",
    kind: "jingle",
    target: "boss: two heavy driven saw stabs, E2 then the tritone Bb2, each doubled an octave up, over a low noise roll",
    pitch: { offKey: "BOSS_THEME's tritone; dread, not a tune" },
    steps: [
      { at: 0, dur: 0.3, wave: "sawtooth", freq: N("E2"), vol: 0.082, hold: 0.1, drive: 0.7, filter: { type: "lowpass", freq: 1600 } },
      { at: 0, dur: 0.3, wave: "square", freq: N("E3"), vol: 0.055, hold: 0.1 },
      { at: 0.2, dur: 0.35, wave: "sawtooth", freq: N("Bb2"), vol: 0.078, hold: 0.12, drive: 0.7, filter: { type: "lowpass", freq: 1600 } },
      { at: 0.2, dur: 0.35, wave: "square", freq: N("Bb3"), vol: 0.05, hold: 0.12 },
      { at: 0, dur: 0.55, wave: "noise", freq: 4000, to: 1200, vol: 0.07, attack: 0.05, filter: { type: "lowpass", freq: 1400 } },
    ],
  },
  // ---- jingles ----
  victory: {
    id: "victory",
    kind: "jingle",
    target: "victory: a square fanfare C5-E5-G5 up to a held C6 with vibrato over a triangle C4, short enough for every fight",
    pitch: "key",
    steps: [
      { at: 0, dur: 0.5, wave: "triangle", freq: N("C4"), vol: 0.048, hold: 0.25 },
      ...["C5", "E5", "G5"].map((n, i): SfxStep => ({ at: i * 0.08, dur: 0.085, wave: "square", freq: N(n), vol: 0.038, hold: 0.05 })),
      { at: 0.24, dur: 0.3, wave: "square", freq: N("C6"), vol: 0.038, hold: 0.12, vib: { rate: 9, cents: 18 } },
    ],
  },
  levelup: {
    id: "levelup",
    kind: "jingle",
    target: "level up: a brisk 25% pulse run C5-E5-G5-C6-E6 landing on a held G6 sparkle, brighter than victory",
    pitch: "key",
    steps: [
      { at: 0, dur: 0.6, wave: "triangle", freq: N("C4"), vol: 0.06, hold: 0.3 },
      { at: 0.35, dur: 0.3, wave: "triangle", freq: N("G4"), vol: 0.05, hold: 0.12 },
      ...["C5", "E5", "G5", "C6", "E6"].map(
        (n, i): SfxStep => ({ at: i * 0.07, dur: 0.075, wave: "pulse25", freq: N(n), vol: 0.055, hold: 0.04 }),
      ),
      { at: 0.35, dur: 0.3, wave: "pulse25", freq: N("G6"), vol: 0.055, hold: 0.1, vib: { rate: 10, cents: 20 } },
    ],
  },
  capture: {
    id: "capture",
    kind: "jingle",
    target: "new record: a settling triangle line G5-E5-C5, answered by a high 12.5% pulse C7 ping",
    pitch: "key",
    steps: [
      { at: 0, dur: 0.1, wave: "triangle", freq: N("G5"), vol: 0.058, hold: 0.06 },
      { at: 0.09, dur: 0.1, wave: "triangle", freq: N("E5"), vol: 0.058, hold: 0.06 },
      { at: 0.18, dur: 0.2, wave: "triangle", freq: N("C5"), vol: 0.058, hold: 0.08 },
      { at: 0.3, dur: 0.14, wave: "pulse12", freq: N("C7"), vol: 0.032, hold: 0.03 },
    ],
  },
  gameover: {
    id: "gameover",
    kind: "jingle",
    target: "game over: a slow falling square line G4-E4-C4 into a long low G3 under a closing lowpass, behind the battle sounds",
    pitch: "key",
    steps: [
      ...["G4", "E4", "C4"].map(
        (n, i): SfxStep => ({
          at: i * 0.18,
          dur: 0.2,
          wave: "square",
          freq: N(n),
          vol: 0.045,
          hold: 0.1,
          filter: { type: "lowpass", freq: 2400 },
        }),
      ),
      { at: 0.54, dur: 0.6, wave: "square", freq: N("G3"), vol: 0.045, hold: 0.2, filter: { type: "lowpass", freq: 2000, to: 300 } },
      ...["G3", "E3", "C3"].map((n, i): SfxStep => ({ at: i * 0.18, dur: 0.2, wave: "triangle", freq: N(n), vol: 0.05, hold: 0.1 })),
      { at: 0.54, dur: 0.6, wave: "triangle", freq: N("G2"), vol: 0.06, hold: 0.25 },
    ],
  },
  night: {
    id: "night",
    kind: "jingle",
    target: "nightfall: two soft triangle bell tones, B4 then the E4 below it, dimming like the light",
    pitch: "key",
    steps: [
      { at: 0, dur: 0.3, wave: "triangle", freq: N("B4"), vol: 0.054, attack: 0.006 },
      { at: 0, dur: 0.18, wave: "pulse12", freq: N("B5"), vol: 0.012 },
      { at: 0.2, dur: 0.42, wave: "triangle", freq: N("E4"), vol: 0.058, attack: 0.006, hold: 0.04 },
    ],
  },
};

registerSfx(GAME_KIT);
