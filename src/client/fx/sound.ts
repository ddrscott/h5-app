/**
 * Every sound in the game, synthesized with the Web Audio API: no audio files, nothing to license.
 * Sounds are short and quiet by design; the loud ones (bomb, Heart 5, win) are the rare ones.
 *
 * The AudioContext is created on the first user gesture (browsers refuse to start it earlier).
 */
import { prefs } from './prefs';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let shaperCurve: Float32Array<ArrayBuffer> | null = null;
/** Browsers only let audio start after a gesture; until then every sound is skipped. */
let gestured = false;

function audio(): AudioContext | null {
  if (prefs.muted() || !gestured) return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Call from a user gesture so later, non-gesture sounds (an opponent's play) can be heard. */
export function unlockAudio() {
  gestured = true;
  audio();
}
if (typeof window !== 'undefined') {
  const unlock = () => { unlockAudio(); };
  window.addEventListener('pointerdown', unlock, { once: true, capture: true });
  window.addEventListener('keydown', unlock, { once: true, capture: true });
}

function noise(c: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function env(c: AudioContext, at: number, peak: number, attack: number, decay: number): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  g.connect(master!);
  return g;
}

function tone(c: AudioContext, o: {
  at?: number; type?: OscillatorType; f: number; f2?: number; glide?: number;
  peak?: number; attack?: number; decay?: number; detune?: number; out?: AudioNode;
}) {
  const at = o.at ?? c.currentTime;
  const osc = c.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f, at);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, at + (o.glide ?? 0.1));
  if (o.detune) osc.detune.value = o.detune;
  const g = env(c, at, o.peak ?? 0.2, o.attack ?? 0.004, o.decay ?? 0.15);
  if (o.out) { g.disconnect(); g.connect(o.out); }
  osc.connect(g);
  osc.start(at);
  osc.stop(at + (o.attack ?? 0.004) + (o.decay ?? 0.15) + 0.05);
}

function hiss(c: AudioContext, o: {
  at?: number; type?: BiquadFilterType; f: number; f2?: number; q?: number;
  peak?: number; attack?: number; decay?: number; out?: AudioNode;
}) {
  const at = o.at ?? c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const filt = c.createBiquadFilter();
  filt.type = o.type ?? 'bandpass';
  filt.Q.value = o.q ?? 1;
  filt.frequency.setValueAtTime(o.f, at);
  if (o.f2) filt.frequency.exponentialRampToValueAtTime(o.f2, at + (o.attack ?? 0.005) + (o.decay ?? 0.1));
  const g = env(c, at, o.peak ?? 0.2, o.attack ?? 0.005, o.decay ?? 0.1);
  if (o.out) { g.disconnect(); g.connect(o.out); }
  src.connect(filt).connect(g);
  src.start(at, Math.random() * 0.5);
  src.stop(at + (o.attack ?? 0.005) + (o.decay ?? 0.1) + 0.05);
}

function drive(c: AudioContext): WaveShaperNode {
  if (!shaperCurve) {
    shaperCurve = new Float32Array(new ArrayBuffer(1024 * 4));
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      shaperCurve[i] = Math.tanh(x * 3);
    }
  }
  const ws = c.createWaveShaper();
  ws.curve = shaperCurve;
  ws.connect(master!);
  return ws;
}

// Pentatonic steps, so rising selection ticks always sound like a tune.
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];
const semis = (base: number, n: number) => base * Math.pow(2, n / 12);

let lastHover = 0;

export const sfx = {
  /** A wooden "tok" when a card lifts. Pitch climbs with how many cards are selected. */
  select(count = 1) {
    const c = audio(); if (!c) return;
    const f = semis(520, PENTA[Math.min(count - 1, PENTA.length - 1)]);
    tone(c, { f: f * 1.6, f2: f, glide: 0.03, peak: 0.16, decay: 0.09, type: 'triangle' });
    hiss(c, { f: 2400, q: 2, peak: 0.05, decay: 0.03 });
  },
  deselect() {
    const c = audio(); if (!c) return;
    tone(c, { f: 420, f2: 300, glide: 0.04, peak: 0.1, decay: 0.07, type: 'triangle' });
  },
  /** A barely-there tick for pointer hover over a card (desktop). */
  hover() {
    const now = performance.now();
    if (now - lastHover < 45) return;
    lastHover = now;
    const c = audio(); if (!c) return;
    hiss(c, { f: 5200, q: 4, peak: 0.018, decay: 0.02 });
  },
  /** The throw: air moving past a card. */
  whoosh(strength = 1) {
    const c = audio(); if (!c) return;
    hiss(c, { f: 500, f2: 2600, q: 1.4, peak: 0.07 * strength, attack: 0.06, decay: 0.12 });
  },
  /** Cards meeting the table. `weight` 1..3 deepens it. */
  land(weight = 1) {
    const c = audio(); if (!c) return;
    hiss(c, { type: 'highpass', f: 1800, peak: 0.12 + 0.03 * weight, decay: 0.05 });
    tone(c, { f: 150 + 20 * weight, f2: 55, glide: 0.12, peak: 0.18 + 0.06 * weight, decay: 0.16 });
  },
  /** A pass is two knuckle knocks on the table, the way people pass at a real one. */
  pass() {
    const c = audio(); if (!c) return;
    const t = c.currentTime;
    for (const dt of [0, 0.12]) {
      tone(c, { at: t + dt, f: 210, f2: 120, glide: 0.05, peak: 0.22, decay: 0.08 });
      hiss(c, { at: t + dt, f: 900, q: 3, peak: 0.08, decay: 0.04 });
    }
  },
  /** Soft two-note chime: it's your move. */
  yourTurn() {
    const c = audio(); if (!c) return;
    const t = c.currentTime;
    tone(c, { at: t, f: 784, peak: 0.09, attack: 0.01, decay: 0.5 });
    tone(c, { at: t, f: 784 * 2.01, peak: 0.02, attack: 0.01, decay: 0.3 });
    tone(c, { at: t + 0.11, f: 1175, peak: 0.08, attack: 0.01, decay: 0.7 });
  },
  /** Callout punctuation for mid-strength melds (straights, sisters, full houses). */
  flourish(level = 1) {
    const c = audio(); if (!c) return;
    const t = c.currentTime;
    [0, 4, 7, 12].slice(0, 2 + level).forEach((n, i) =>
      tone(c, { at: t + i * 0.05, f: semis(440, n), type: 'triangle', peak: 0.06, decay: 0.22 }));
  },
  /** BOMB: a low drop, a saturated thump and a falling roar. */
  bomb() {
    const c = audio(); if (!c) return;
    const t = c.currentTime;
    const d = drive(c);
    tone(c, { at: t, f: 120, f2: 28, glide: 0.7, peak: 0.9, attack: 0.005, decay: 0.9, out: d });
    tone(c, { at: t, f: 60, f2: 30, glide: 0.5, peak: 0.5, decay: 1.1 });
    hiss(c, { at: t, type: 'lowpass', f: 4000, f2: 140, q: 0.7, peak: 0.6, attack: 0.004, decay: 1.2 });
    hiss(c, { at: t + 0.02, type: 'highpass', f: 3000, peak: 0.15, decay: 0.15 });
  },
  /** The Heart of Five: a struck bronze bell. Inharmonic partials, long tail. */
  heart5() {
    const c = audio(); if (!c) return;
    const t = c.currentTime;
    const base = 196;
    [[1, 0.35, 2.4], [2.0, 0.12, 1.8], [2.76, 0.14, 1.5], [5.4, 0.06, 0.9], [8.9, 0.03, 0.5]].forEach(([m, p, dcy]) =>
      tone(c, { at: t, f: base * m, peak: p, attack: 0.003, decay: dcy, detune: (Math.random() - 0.5) * 8 }));
    tone(c, { at: t, f: 90, f2: 45, glide: 0.3, peak: 0.4, decay: 0.4 });
  },
  /** A quick card flick, for dealing. */
  deal() {
    const c = audio(); if (!c) return;
    hiss(c, { type: 'highpass', f: 2600 + Math.random() * 800, peak: 0.05, decay: 0.025 });
  },
  /** Score tick while numbers count up. */
  tick(i = 0) {
    const c = audio(); if (!c) return;
    tone(c, { f: semis(880, PENTA[i % PENTA.length]), type: 'square', peak: 0.025, decay: 0.04 });
  },
  /** Somebody went out: a bright upward run. */
  out() {
    const c = audio(); if (!c) return;
    const t = c.currentTime;
    [0, 4, 7, 12, 16].forEach((n, i) => tone(c, { at: t + i * 0.06, f: semis(523, n), type: 'triangle', peak: 0.08, decay: 0.3 }));
  },
  /** You won the game: a pentatonic run that blooms into a chord. */
  win() {
    const c = audio(); if (!c) return;
    const t = c.currentTime;
    [0, 2, 4, 7, 9, 12, 14, 16].forEach((n, i) =>
      tone(c, { at: t + i * 0.07, f: semis(392, n), type: 'triangle', peak: 0.09, decay: 0.35 }));
    [0, 4, 7, 12].forEach((n) => tone(c, { at: t + 0.62, f: semis(392, n + 12), peak: 0.07, attack: 0.02, decay: 1.6 }));
    tone(c, { at: t + 0.62, f: 196 * 2.76, peak: 0.05, decay: 1.4 });
  },
  /** The game ended and you didn't win: warm, short, not sad. */
  gameOver() {
    const c = audio(); if (!c) return;
    const t = c.currentTime;
    [7, 4, 0].forEach((n, i) => tone(c, { at: t + i * 0.1, f: semis(392, n), type: 'triangle', peak: 0.07, decay: 0.4 }));
  },
  error() {
    const c = audio(); if (!c) return;
    tone(c, { f: 180, f2: 140, glide: 0.12, type: 'square', peak: 0.04, decay: 0.12 });
  },
};
