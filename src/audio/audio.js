// ============================================================================
//  שמע פרוצדורלי — מוזיקה ואפקטים, נוצרים בזמן אמת ב-Web Audio API (ללא קבצים)
// ============================================================================
//  audio.init()            — יוצר את ה-AudioContext (יש לקרוא מתוך פעולת משתמש)
//  audio.play(name, opts)  — אפקט קולי חד-פעמי. opts.volume (0..1), opts.pitch (מכפיל)
//  audio.setMusic(name)    — 'menu' | 'adventure' | 'battle' | 'town' | 'victory' | 'defeat' | null
//  audio.setMuted / isMuted / setMusicVolume / setSfxVolume — נשמרים ב-localStorage
// ============================================================================

const STORE_KEY = 'cvk-audio';
const settings = { muted: false, music: 0.45, sfx: 0.7 };
try {
  const s = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  if (typeof s.muted === 'boolean') settings.muted = s.muted;
  if (typeof s.music === 'number') settings.music = clamp01(s.music);
  if (typeof s.sfx === 'number') settings.sfx = clamp01(s.sfx);
} catch { /* ignore */ }

function saveSettings() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}
function clamp01(v) { return Math.max(0, Math.min(1, Number(v) || 0)); }

let ctx = null;
let masterGain, comp, musicGain, sfxGain, reverb, noiseBuf;
let wantedMusic = null;          // last requested track name
let currentTrack = null;         // active Track instance
const fadingTracks = new Set();
let schedTimer = null;
const lastPlayed = Object.create(null);

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

// ---------------------------------------------------------------------------
//  Graph setup
// ---------------------------------------------------------------------------
function makeNoise(seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// Procedural impulse response: decaying stereo noise that darkens over time.
function makeImpulse(seconds, decay) {
  const sr = ctx.sampleRate, len = Math.floor(sr * seconds), pre = Math.floor(sr * 0.012);
  const buf = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let y = 0;
    for (let i = pre; i < len; i++) {
      const k = (i - pre) / (len - pre);
      const a = 0.85 - 0.75 * k;                     // lowpass coefficient: brighter early, darker late
      y += a * ((Math.random() * 2 - 1) - y);
      d[i] = y * Math.pow(1 - k, decay);
    }
  }
  return buf;
}

function init() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return;
  try { ctx = new AC({ latencyHint: 'interactive' }); } catch { ctx = null; return; }

  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 18;
  comp.ratio.value = 4;
  comp.attack.value = 0.004;
  comp.release.value = 0.22;

  masterGain = ctx.createGain();
  masterGain.gain.value = settings.muted ? 0 : 0.9;
  comp.connect(masterGain).connect(ctx.destination);

  reverb = ctx.createConvolver();
  reverb.buffer = makeImpulse(2.6, 3.2);
  const verbOut = ctx.createGain();
  verbOut.gain.value = 0.9;
  reverb.connect(verbOut).connect(comp);

  musicGain = ctx.createGain();
  musicGain.gain.value = settings.music;
  musicGain.connect(comp);
  const musicSend = ctx.createGain();
  musicSend.gain.value = 0.32;
  musicGain.connect(musicSend).connect(reverb);

  sfxGain = ctx.createGain();
  sfxGain.gain.value = settings.sfx;
  sfxGain.connect(comp);
  const sfxSend = ctx.createGain();
  sfxSend.gain.value = 0.16;
  sfxGain.connect(sfxSend).connect(reverb);

  noiseBuf = makeNoise(2);
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  if (wantedMusic) startTrack(wantedMusic);
}

// ---------------------------------------------------------------------------
//  Synthesis primitives (shared by SFX and music)
// ---------------------------------------------------------------------------
function tone(out, t, o) {
  const { type = 'sine', f = 440, f2 = 0, glide = 0, dur = 0.2, vol = 0.3, a = 0.005, detune = 0, filter = null, fq = 1 } = o;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(f, t);
  if (f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + (glide || dur));
  if (detune) osc.detune.value = detune;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (filter) {
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = filter;
    flt.Q.value = fq;
    osc.connect(flt).connect(g);
  } else osc.connect(g);
  g.connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
  return osc;
}

function noise(out, t, o) {
  const { dur = 0.2, vol = 0.3, type = 'bandpass', f = 1000, f2 = 0, q = 1, a = 0.004, hold = 0 } = o;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const flt = ctx.createBiquadFilter();
  flt.type = type;
  flt.frequency.setValueAtTime(f, t);
  if (f2) flt.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  flt.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + a);
  if (hold) g.gain.setValueAtTime(vol, t + a + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(flt).connect(g).connect(out);
  src.start(t, Math.random() * 1.4);
  src.stop(t + dur + 0.05);
  return flt;
}

// Bell / chime with inharmonic partials.
function bell(out, t, f, dur = 1.2, vol = 0.2, partials = null) {
  const P = partials || [[1, 1, 1], [2.0, 0.45, 0.6], [2.76, 0.3, 0.45], [4.07, 0.16, 0.3], [5.4, 0.1, 0.2]];
  for (const [m, amp, dk] of P) {
    if (f * m > 16000) continue;
    tone(out, t, { f: f * m, dur: dur * dk, vol: vol * amp, a: 0.003 });
  }
}

// Short metallic ping (coins, sparkles).
function metal(out, t, f, vol = 0.1, dur = 0.15) {
  tone(out, t, { f, dur, vol, a: 0.001 });
  tone(out, t, { f: f * 1.47, dur: dur * 0.7, vol: vol * 0.6, a: 0.001 });
  tone(out, t, { f: f * 2.33, dur: dur * 0.5, vol: vol * 0.35, a: 0.001 });
}

// Brass-like tone (saw + opening lowpass).
function brass(out, t, f, dur, vol = 0.15) {
  const g = ctx.createGain();
  const flt = ctx.createBiquadFilter();
  flt.type = 'lowpass';
  flt.Q.value = 1.2;
  flt.frequency.setValueAtTime(f * 1.2, t);
  flt.frequency.exponentialRampToValueAtTime(Math.min(9000, f * 6), t + 0.06);
  flt.frequency.exponentialRampToValueAtTime(Math.min(6000, f * 3), t + Math.min(dur, 0.35));
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
  g.gain.setValueAtTime(vol * 0.85, t + Math.max(0.04, dur - 0.08));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
  flt.connect(g).connect(out);
  for (const dt of [-6, 6]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 0.985, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    o.detune.value = dt;
    o.connect(flt);
    o.start(t);
    o.stop(t + dur + 0.2);
  }
}

// --- Karplus-Strong plucked string (oud / lute), cached per MIDI note ----------
const ksCache = new Map();
function ksBuffer(midi) {
  let e = ksCache.get(midi);
  if (e) return e;
  const sr = ctx.sampleRate, f = mtof(midi);
  const dur = midi < 52 ? 2.6 : 2.0;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const N = Math.max(2, Math.round(sr / f - 0.5));
  let prev = 0;
  for (let i = 0; i < N; i++) {                       // pick excitation: lowpassed noise (warm, oud-like)
    prev = prev * 0.45 + (Math.random() * 2 - 1) * 0.55;
    d[i] = prev;
  }
  let mean = 0;
  for (let i = 0; i < N; i++) mean += d[i];
  mean /= N;
  for (let i = 0; i < N; i++) d[i] -= mean;
  const decay = Math.pow(0.001, 1 / (f * 2.4));
  for (let i = N; i < len; i++) d[i] = decay * 0.5 * (d[i - N] + (i - N - 1 >= 0 ? d[i - N - 1] : 0));
  let peak = 0;
  for (let i = 0; i < Math.min(len, N * 4); i++) peak = Math.max(peak, Math.abs(d[i]));
  const norm = peak > 0 ? 0.8 / peak : 1;
  const fade = Math.floor(sr * 0.15);
  for (let i = 0; i < len; i++) {
    d[i] *= norm;
    if (i > len - fade) d[i] *= (len - i) / fade;
  }
  e = { buf, rate: (f * (N + 0.5)) / sr };
  ksCache.set(midi, e);
  return e;
}

function pluck(out, t, midi, vol = 0.2, dur = 0) {
  const e = ksBuffer(Math.round(midi));
  const src = ctx.createBufferSource();
  src.buffer = e.buf;
  src.playbackRate.value = e.rate;
  const g = ctx.createGain();
  g.gain.value = vol;
  let end = t + e.buf.duration / e.rate;
  if (dur) {
    g.gain.setValueAtTime(vol, t + dur);
    g.gain.setTargetAtTime(0, t + dur, 0.07);
    end = Math.min(end, t + dur + 0.5);
  }
  src.connect(g).connect(out);
  src.start(t);
  src.stop(end);
}

// ---------------------------------------------------------------------------
//  Sound effects
// ---------------------------------------------------------------------------
const SFX = {
  click(t, o, p) {
    tone(o, t, { type: 'triangle', f: 1150 * p, f2: 720 * p, dur: 0.06, vol: 0.22 });
    noise(o, t, { dur: 0.025, vol: 0.12, f: 3200 * p, q: 1.2 });
  },
  hover(t, o, p) {
    tone(o, t, { f: 1900 * p, f2: 2150 * p, dur: 0.05, vol: 0.045, a: 0.006 });
  },
  step(t, o, p) {
    const base = p * rnd(0.88, 1.12);
    for (let i = 0; i < 2; i++) {
      const tt = t + i * rnd(0.075, 0.1), v = i ? 0.55 : 0.85;
      noise(o, tt, { dur: 0.05, vol: 0.32 * v, f: 950 * base * rnd(0.85, 1.15), q: 3 });
      tone(o, tt, { f: 260 * base, f2: 120 * base, dur: 0.07, vol: 0.28 * v });
      tone(o, tt, { type: 'triangle', f: 640 * base * rnd(0.9, 1.1), f2: 420 * base, dur: 0.03, vol: 0.08 * v });
    }
  },
  pickup(t, o, p) {
    bell(o, t, 1318 * p, 0.5, 0.14);
    bell(o, t + 0.07, 1760 * p, 0.7, 0.13);
    bell(o, t + 0.14, 2637 * p, 0.6, 0.06);
  },
  gold(t, o, p) {
    const n = 8 + ((Math.random() * 4) | 0);
    for (let i = 0; i < n; i++) {
      const tt = t + Math.pow(i / n, 1.3) * 0.38 + rnd(0, 0.02);
      metal(o, tt, rnd(2600, 4600) * p, rnd(0.04, 0.08) * (1 - i / (n * 1.4)), rnd(0.08, 0.16));
    }
    noise(o, t, { dur: 0.4, vol: 0.04, type: 'highpass', f: 6000, q: 0.7, a: 0.02 });
  },
  chest(t, o, p) {
    // creak
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95 * p, t);
    osc.frequency.linearRampToValueAtTime(150 * p, t + 0.18);
    osc.frequency.linearRampToValueAtTime(110 * p, t + 0.42);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 700 * p; bp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.05);
    g.gain.setValueAtTime(0.16, t + 0.36);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);
    osc.connect(bp).connect(g).connect(o);
    osc.start(t); osc.stop(t + 0.5);
    tone(o, t + 0.45, { f: 160 * p, f2: 70 * p, dur: 0.12, vol: 0.25 });
    // sparkle
    [2093, 2637, 3136, 4186, 3520].forEach((f, i) => metal(o, t + 0.5 + i * 0.06, f * p, 0.05, 0.35));
    noise(o, t + 0.5, { dur: 0.6, vol: 0.03, type: 'highpass', f: 7000, a: 0.1 });
  },
  build(t, o, p) {
    for (let i = 0; i < 3; i++) {
      const tt = t + i * 0.17;
      noise(o, tt, { dur: 0.07, vol: 0.3, f: 1700 * p, q: 2 });
      tone(o, tt, { f: 340 * p, f2: 150 * p, dur: 0.1, vol: 0.3 });
      tone(o, tt, { type: 'triangle', f: 1250 * p, dur: 0.06, vol: 0.06 });
    }
    [60, 64, 67, 72].forEach((m, i) => {
      const tt = t + 0.56 + i * 0.07;
      tone(o, tt, { type: 'triangle', f: mtof(m) * p, dur: 0.9 - i * 0.05, vol: 0.12, a: 0.01 });
      tone(o, tt, { f: mtof(m + 12) * p, dur: 0.6, vol: 0.04, a: 0.01 });
    });
  },
  recruit(t, o, p) {
    [0, 0.13, 0.26, 0.39, 0.45].forEach((dt, i) => {
      noise(o, t + dt, { dur: 0.12, vol: i === 4 ? 0.16 : 0.22, type: 'highpass', f: 1800 * p, q: 0.8 });
      tone(o, t + dt, { type: 'triangle', f: 210 * p, f2: 150 * p, dur: 0.1, vol: 0.16 });
    });
    brass(o, t + 0.55, mtof(62) * p, 0.14, 0.11);
    brass(o, t + 0.72, mtof(69) * p, 0.14, 0.11);
    brass(o, t + 0.89, mtof(74) * p, 0.5, 0.12);
  },
  levelup(t, o, p) {
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(o, t + i * 0.075, { type: 'triangle', f: mtof(m) * p, dur: 0.5, vol: 0.12 });
      tone(o, t + i * 0.075, { f: mtof(m + 12) * p, dur: 0.3, vol: 0.04 });
    });
    [72, 76, 79, 84].forEach((m) => tone(o, t + 0.4, { type: 'triangle', f: mtof(m) * p, dur: 1.3, vol: 0.07, a: 0.04 }));
    for (let i = 0; i < 6; i++) metal(o, t + 0.4 + i * 0.09, rnd(3000, 5500) * p, 0.03, 0.3);
  },
  spell(t, o, p) {
    for (let i = 0; i < 7; i++) {
      tone(o, t + i * 0.05, { f: rnd(1200, 2600) * p, f2: rnd(2400, 4200) * p, dur: 0.6, vol: 0.04, a: 0.08 });
    }
    noise(o, t, { dur: 0.8, vol: 0.09, f: 1800 * p, f2: 7000 * p, q: 4, a: 0.25 });
  },
  fire(t, o, p) {
    noise(o, t, { dur: 0.9, vol: 0.4, type: 'lowpass', f: 300 * p, f2: 2400 * p, q: 1.5, a: 0.18 });
    noise(o, t + 0.1, { dur: 0.8, vol: 0.18, f: 900 * p, f2: 300 * p, q: 0.8, a: 0.1 });
    tone(o, t, { type: 'sawtooth', f: 70 * p, f2: 45 * p, dur: 0.8, vol: 0.12, a: 0.1, filter: 220 });
  },
  lightning(t, o, p) {
    noise(o, t, { dur: 0.09, vol: 0.6, type: 'highpass', f: 2000 * p, q: 0.7, a: 0.001 });
    for (let i = 0; i < 5; i++) noise(o, t + 0.03 + Math.random() * 0.18, { dur: 0.04, vol: 0.25, type: 'highpass', f: 3000, a: 0.001 });
    tone(o, t, { type: 'square', f: 90 * p, f2: 40 * p, dur: 0.12, vol: 0.12, filter: 900 });
    noise(o, t + 0.05, { dur: 1.6, vol: 0.4, type: 'lowpass', f: 220 * p, f2: 70, q: 1, a: 0.1 });
  },
  heal(t, o, p) {
    [72, 76, 79, 83, 86].forEach((m, i) => bell(o, t + i * 0.11, mtof(m) * p, 1.2, 0.07));
    tone(o, t, { type: 'triangle', f: mtof(60) * p, dur: 1.2, vol: 0.05, a: 0.3 });
  },
  buff(t, o, p) {
    tone(o, t, { type: 'triangle', f: 380 * p, f2: 1500 * p, dur: 0.45, vol: 0.1, a: 0.05 });
    tone(o, t, { f: 760 * p, f2: 3000 * p, dur: 0.4, vol: 0.05, a: 0.05 });
    for (let i = 0; i < 6; i++) metal(o, t + 0.15 + i * 0.06, rnd(2500, 5000) * p, 0.035, 0.25);
  },
  debuff(t, o, p) {
    tone(o, t, { type: 'sawtooth', f: 420 * p, f2: 70 * p, dur: 0.7, vol: 0.13, a: 0.03, filter: 900 });
    tone(o, t, { type: 'sawtooth', f: 445 * p, f2: 74 * p, dur: 0.7, vol: 0.1, a: 0.03, filter: 700 });
    tone(o, t + 0.1, { f: 110 * p, f2: 55 * p, dur: 0.7, vol: 0.18, a: 0.1 });
  },
  arrow(t, o, p) {
    tone(o, t, { type: 'triangle', f: 190 * p, f2: 150 * p, dur: 0.18, vol: 0.2, a: 0.002 });
    pluck(o, t, 43, 0.25, 0.15);
    noise(o, t + 0.04, { dur: 0.3, vol: 0.18, f: 2500 * p, f2: 900 * p, q: 2.5, a: 0.08 });
  },
  hit(t, o, p) {
    tone(o, t, { f: 160 * p, f2: 48 * p, dur: 0.2, vol: 0.5 });
    noise(o, t, { dur: 0.12, vol: 0.35, type: 'lowpass', f: 1100 * p, q: 0.8, a: 0.001 });
    noise(o, t, { dur: 0.04, vol: 0.12, f: 3000 * p, q: 1 });
  },
  swing(t, o, p) {
    noise(o, t, { dur: 0.26, vol: 0.32, f: 700 * p, f2: 3200 * p, q: 2.2, a: 0.1 });
    tone(o, t + 0.04, { f: 900 * p, f2: 450 * p, dur: 0.16, vol: 0.02, a: 0.06 });
  },
  death(t, o, p) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(170 * p, t);
    osc.frequency.exponentialRampToValueAtTime(65 * p, t + 0.8);
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 7; lg.gain.value = 6 * p;
    lfo.connect(lg).connect(osc.frequency);
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass'; flt.frequency.value = 600; flt.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    osc.connect(flt).connect(g).connect(o);
    osc.start(t); lfo.start(t); osc.stop(t + 0.9); lfo.stop(t + 0.9);
    tone(o, t + 0.7, { f: 120 * p, f2: 40 * p, dur: 0.3, vol: 0.45 });
    noise(o, t + 0.7, { dur: 0.2, vol: 0.25, type: 'lowpass', f: 600, a: 0.002 });
  },
  victory(t, o, p) {
    const n = [[67, 0, 0.12], [67, 0.13, 0.12], [67, 0.26, 0.12], [72, 0.4, 0.3], [71, 0.72, 0.14], [72, 0.88, 0.14], [76, 1.04, 0.8]];
    for (const [m, dt, d] of n) brass(o, t + dt, mtof(m) * p, d, 0.11);
    [60, 64, 67].forEach((m) => brass(o, t + 1.04, mtof(m) * p, 0.8, 0.05));
    tone(o, t + 1.04, { f: 98 * p, f2: 80 * p, dur: 0.6, vol: 0.3 });
  },
  defeat(t, o, p) {
    [[69, 0, 0.45], [67, 0.45, 0.45], [65, 0.9, 0.45], [64, 1.35, 0.5], [62, 1.9, 1.3]].forEach(([m, dt, d]) => {
      tone(o, t + dt, { type: 'triangle', f: mtof(m) * p, dur: d + 0.2, vol: 0.14, a: 0.05 });
      tone(o, t + dt, { type: 'sawtooth', f: mtof(m - 12) * p, dur: d + 0.2, vol: 0.04, a: 0.08, filter: 700 });
    });
    [50, 53, 57].forEach((m) => tone(o, t + 1.9, { type: 'sawtooth', f: mtof(m) * p, dur: 1.6, vol: 0.035, a: 0.3, filter: 600 }));
    tone(o, t + 1.9, { f: 73 * p, f2: 55 * p, dur: 0.8, vol: 0.3 });
  },
  newDay(t, o, p) {
    bell(o, t, mtof(79) * p, 1.6, 0.11);
    bell(o, t + 0.22, mtof(86) * p, 1.8, 0.09);
    tone(o, t, { type: 'triangle', f: mtof(67) * p, dur: 1.4, vol: 0.05, a: 0.2 });
    tone(o, t + 0.1, { type: 'triangle', f: mtof(71) * p, dur: 1.4, vol: 0.04, a: 0.2 });
  },
  newWeek(t, o, p) {
    // church bell: hum, prime, tierce, quint, nominal
    const P = [[0.5, 0.5, 1.4], [1, 1, 1], [1.19, 0.5, 0.8], [1.5, 0.35, 0.6], [2, 0.4, 0.5], [2.52, 0.2, 0.35], [3.01, 0.12, 0.25]];
    for (let i = 0; i < 3; i++) bell(o, t + i * 0.55, 392 * p * (i === 2 ? 0.75 : 1), 2.2, 0.14, P);
  },
  error(t, o, p) {
    for (let i = 0; i < 2; i++) {
      tone(o, t + i * 0.13, { type: 'square', f: 110 * p, dur: 0.11, vol: 0.08, filter: 600 });
      tone(o, t + i * 0.13, { type: 'square', f: 116 * p, dur: 0.11, vol: 0.07, filter: 600 });
    }
  },
  teleport(t, o, p) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260 * p, t);
    osc.frequency.exponentialRampToValueAtTime(1600 * p, t + 0.6);
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.setValueAtTime(9, t);
    lfo.frequency.linearRampToValueAtTime(22, t + 0.6);
    lg.gain.value = 90 * p;
    lfo.connect(lg).connect(osc.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    osc.connect(g).connect(o);
    osc.start(t); lfo.start(t); osc.stop(t + 0.75); lfo.stop(t + 0.75);
    noise(o, t, { dur: 0.7, vol: 0.06, f: 1500, f2: 6000, q: 5, a: 0.3 });
    for (let i = 0; i < 4; i++) metal(o, t + 0.45 + i * 0.05, rnd(3000, 5000) * p, 0.03, 0.25);
  },
  flag(t, o, p) {
    for (let i = 0; i < 4; i++) noise(o, t + i * 0.075, { dur: 0.07, vol: 0.14 - i * 0.02, f: 1300 * p * rnd(0.8, 1.2), q: 1.4, a: 0.015 });
    brass(o, t + 0.28, mtof(69) * p, 0.12, 0.09);
    brass(o, t + 0.42, mtof(74) * p, 0.35, 0.1);
  },
  turn(t, o, p) {
    tone(o, t, { f: 2100 * p, dur: 0.03, vol: 0.09, a: 0.001 });
    tone(o, t + 0.005, { type: 'triangle', f: 1400 * p, dur: 0.04, vol: 0.05, a: 0.001 });
  },
  dialog(t, o, p) {
    const n = 5 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) {
      noise(o, t + i * rnd(0.035, 0.06), { dur: rnd(0.03, 0.07), vol: rnd(0.04, 0.09), f: rnd(2500, 5500) * p, q: 0.9, a: 0.008 });
    }
  },
  magicArrow(t, o, p) {
    tone(o, t, { type: 'square', f: 1900 * p, f2: 320 * p, dur: 0.32, vol: 0.05, filter: 2400 });
    tone(o, t, { f: 2400 * p, f2: 600 * p, dur: 0.3, vol: 0.08 });
    noise(o, t, { dur: 0.3, vol: 0.12, f: 4000 * p, f2: 800 * p, q: 3, a: 0.02 });
    metal(o, t + 0.25, 3200 * p, 0.04, 0.2);
  },
  meteor(t, o, p) {
    noise(o, t, { dur: 0.85, vol: 0.18, f: 4000 * p, f2: 400 * p, q: 2.5, a: 0.4 });
    tone(o, t, { f: 1500 * p, f2: 260 * p, dur: 0.85, vol: 0.05, a: 0.4 });
    [0.8, 1.0, 1.22].forEach((dt, i) => {
      noise(o, t + dt, { dur: 0.7, vol: 0.45 - i * 0.08, type: 'lowpass', f: 900 * p, f2: 120, q: 0.9, a: 0.003 });
      tone(o, t + dt, { f: 120 * p, f2: 35 * p, dur: 0.45, vol: 0.45 - i * 0.08 });
    });
  },
  frost(t, o, p) {
    for (let i = 0; i < 12; i++) {
      const tt = t + i * 0.04 + rnd(0, 0.02);
      tone(o, tt, { f: rnd(2400, 6000) * p, dur: rnd(0.15, 0.4), vol: 0.035, a: 0.001 });
    }
    tone(o, t, { type: 'triangle', f: 1800 * p, f2: 3600 * p, dur: 0.6, vol: 0.04, a: 0.05 });
    noise(o, t, { dur: 0.7, vol: 0.08, type: 'highpass', f: 5000 * p, q: 1, a: 0.15 });
  },
};

function play(name, opts = {}) {
  if (!ctx || settings.muted) return;
  const fn = SFX[name];
  if (!fn) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const now = ctx.currentTime;
  if (lastPlayed[name] && now - lastPlayed[name] < 0.03) return;   // throttle spam
  lastPlayed[name] = now;
  try {
    const g = ctx.createGain();
    g.gain.value = opts.volume == null ? 1 : clamp01(opts.volume);
    g.connect(sfxGain);
    const pitch = opts.pitch > 0 ? opts.pitch : 1;
    fn(now + 0.005, g, pitch);
    setTimeout(() => { try { g.disconnect(); } catch { /* ignore */ } }, 4000);
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('[audio] sfx failed', name, e);
  }
}

// ---------------------------------------------------------------------------
//  Music — scales, instruments, melody generation
// ---------------------------------------------------------------------------
const FREYGISH = [0, 1, 4, 5, 7, 8, 10];   // Ahava Rabba / phrygian dominant
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

function dm(scale, root, deg) {
  const o = Math.floor(deg / 7), i = ((deg % 7) + 7) % 7;
  return root + scale[i] + 12 * o;
}
function triad(scale, root, deg) { return [deg, deg + 2, deg + 4].map((d) => dm(scale, root, d)); }

function pad(out, t, midis, dur, vol = 0.04, cutoff = 900) {
  const flt = ctx.createBiquadFilter();
  flt.type = 'lowpass';
  flt.Q.value = 0.6;
  flt.frequency.setValueAtTime(cutoff * 0.6, t);
  flt.frequency.linearRampToValueAtTime(cutoff, t + dur * 0.5);
  flt.frequency.linearRampToValueAtTime(cutoff * 0.7, t + dur);
  const g = ctx.createGain();
  const att = Math.min(0.8, dur * 0.35);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + att);
  g.gain.setValueAtTime(vol, t + dur - 0.1);
  g.gain.linearRampToValueAtTime(0, t + dur + 0.6);
  flt.connect(g).connect(out);
  for (const m of midis) {
    for (const dt of [-8, 7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(m);
      o.detune.value = dt;
      o.connect(flt);
      o.start(t);
      o.stop(t + dur + 0.7);
    }
  }
}

function flute(out, t, midi, dur, vol = 0.09, grace = 0) {
  const f = mtof(midi);
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
  o1.type = 'sine'; o2.type = 'triangle';
  if (grace) {
    const gf = mtof(midi + grace);
    o1.frequency.setValueAtTime(gf, t); o2.frequency.setValueAtTime(gf, t);
    o1.frequency.setValueAtTime(gf, t + 0.05); o2.frequency.setValueAtTime(gf, t + 0.05);
    o1.frequency.exponentialRampToValueAtTime(f, t + 0.09); o2.frequency.exponentialRampToValueAtTime(f, t + 0.09);
  } else {
    o1.frequency.setValueAtTime(f, t); o2.frequency.setValueAtTime(f, t);
  }
  const lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.frequency.value = rnd(4.8, 5.6);
  lg.gain.setValueAtTime(0, t);
  lg.gain.linearRampToValueAtTime(0, t + Math.min(0.25, dur * 0.4));
  lg.gain.linearRampToValueAtTime(f * 0.007, t + Math.min(0.6, dur * 0.8));
  lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
  const m2 = ctx.createGain(); m2.gain.value = 0.25;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.07);
  g.gain.linearRampToValueAtTime(vol * 0.8, t + Math.max(0.08, dur * 0.6));
  g.gain.linearRampToValueAtTime(0, t + dur + 0.12);
  o1.connect(g); o2.connect(m2).connect(g);
  g.connect(out);
  const end = t + dur + 0.15;
  o1.start(t); o2.start(t); lfo.start(t);
  o1.stop(end); o2.stop(end); lfo.stop(end);
  noise(out, t, { dur: 0.09, vol: vol * 0.25, f: f * 2, q: 2, a: 0.02 });   // breath
}

// Reedy lead (zurna-like) for battle.
function reed(out, t, midi, dur, vol = 0.05) {
  const f = mtof(midi);
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(f * 1.03, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
  const lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.frequency.value = 6;
  lg.gain.setValueAtTime(0, t);
  lg.gain.linearRampToValueAtTime(f * 0.01, t + Math.min(0.4, dur));
  lfo.connect(lg).connect(o.frequency);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = Math.min(4000, f * 3); bp.Q.value = 1.4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.03);
  g.gain.setValueAtTime(vol * 0.9, t + Math.max(0.04, dur - 0.04));
  g.gain.linearRampToValueAtTime(0, t + dur + 0.06);
  o.connect(bp).connect(g).connect(out);
  o.start(t); lfo.start(t); o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
}

function lowStr(out, t, midi, dur, vol = 0.06, cutoff = 520) {
  const flt = ctx.createBiquadFilter();
  flt.type = 'lowpass'; flt.frequency.value = cutoff; flt.Q.value = 1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + Math.min(0.05, dur * 0.3));
  g.gain.setValueAtTime(vol * 0.8, t + Math.max(0.06, dur - 0.05));
  g.gain.linearRampToValueAtTime(0, t + dur + 0.08);
  flt.connect(g).connect(out);
  for (const dt of [-9, 9]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = mtof(midi); o.detune.value = dt;
    o.connect(flt); o.start(t); o.stop(t + dur + 0.1);
  }
}

function swell(out, t, midi, dur, vol = 0.06) {
  const flt = ctx.createBiquadFilter();
  flt.type = 'lowpass'; flt.Q.value = 2;
  flt.frequency.setValueAtTime(200, t);
  flt.frequency.exponentialRampToValueAtTime(900, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + dur * 0.95);
  g.gain.linearRampToValueAtTime(0, t + dur + 0.1);
  flt.connect(g).connect(out);
  for (const dt of [-10, 10]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = mtof(midi); o.detune.value = dt;
    o.connect(flt); o.start(t); o.stop(t + dur + 0.15);
  }
}

// Percussion: darbuka / frame drum.
function dum(out, t, vol = 0.3, low = 1) {
  tone(out, t, { f: 120 * low, f2: 55 * low, glide: 0.18, dur: 0.38, vol });
  noise(out, t, { dur: 0.06, vol: vol * 0.25, type: 'lowpass', f: 500, q: 0.7, a: 0.001 });
}
function tek(out, t, vol = 0.15) {
  noise(out, t, { dur: 0.07, vol, f: 2600, q: 1.5, a: 0.001 });
  tone(out, t, { f: 420, f2: 300, dur: 0.035, vol: vol * 0.5, a: 0.001 });
}
function ka(out, t, vol = 0.08) {
  noise(out, t, { dur: 0.04, vol, type: 'highpass', f: 3800, q: 0.8, a: 0.001 });
}
function bendir(out, t, vol = 0.25) {
  tone(out, t, { f: 85, f2: 52, glide: 0.3, dur: 0.6, vol });
  noise(out, t, { dur: 0.35, vol: vol * 0.12, f: 900, q: 0.6, a: 0.005 });   // jingle/buzz
}
function timpani(out, t, midi, vol = 0.3, dur = 0.9) {
  const f = mtof(midi);
  tone(out, t, { f: f * 1.04, f2: f, glide: 0.08, dur, vol });
  tone(out, t, { f: f * 1.5, dur: dur * 0.4, vol: vol * 0.25 });
  noise(out, t, { dur: 0.1, vol: vol * 0.3, type: 'lowpass', f: 700, a: 0.001 });
}

// --- Melody generator: motif-based periods with randomized variation ---------
const RHYTHMS = [[4, 4, 4, 4], [6, 2, 4, 4], [4, 2, 2, 8], [8, 4, 4], [2, 2, 4, 8], [4, 4, 8], [12, 4], [2, 2, 2, 2, 8], [6, 2, 8], [4, 4, 2, 2, 4]];
const END_RHYTHMS = [[4, 12], [8, 8], [2, 2, 12], [6, 2, 8], [4, 4, 8], [16]];
const STEPS = [-1, -1, -1, 1, 1, 1, -2, 2, 0, -3, 2, 3];

function nearestChordTone(deg, chordDeg) {
  let best = deg, bd = 99;
  for (let d = deg - 3; d <= deg + 3; d++) {
    const r = (((d - chordDeg) % 7) + 7) % 7;
    if (r === 0 || r === 2 || r === 4) {
      const dist = Math.abs(d - deg) + Math.random() * 0.5;
      if (dist < bd) { bd = dist; best = d; }
    }
  }
  return best;
}

function genPhrase(chords, cadence, o = {}) {
  const lo = o.lo ?? -2, hi = o.hi ?? 9, rh = o.rhythms || RHYTHMS;
  const notes = [];
  let deg = o.start ?? pick([0, 2, 4, 4, 7]);
  const bars = chords.length;
  for (let b = 0; b < bars; b++) {
    const r = b === bars - 1 ? pick(END_RHYTHMS) : pick(rh);
    let s = b * 16;
    r.forEach((d, i) => {
      if (i === 0) deg = nearestChordTone(deg, chords[b]);
      else deg += pick(STEPS);
      if (deg < lo) deg = lo + 1;
      if (deg > hi) deg = hi - 1;
      const last = b === bars - 1 && i === r.length - 1;
      if (last) {
        const opts = [cadence - 7, cadence, cadence + 7].filter((x) => x >= lo && x <= hi);
        deg = opts.reduce((a, c) => (Math.abs(c - deg) < Math.abs(a - deg) ? c : a), opts[0] ?? cadence);
      }
      notes.push({ s, d, deg });
      s += d;
    });
  }
  return notes;
}

function varyPhrase(src, cadence, o = {}) {
  const lo = o.lo ?? -2, hi = o.hi ?? 9;
  const out = [];
  src.forEach((n, i) => {
    const last = i === src.length - 1;
    if (last) {
      const opts = [cadence - 7, cadence, cadence + 7].filter((x) => x >= lo && x <= hi);
      const deg = opts.reduce((a, c) => (Math.abs(c - n.deg) < Math.abs(a - n.deg) ? c : a), opts[0] ?? cadence);
      out.push({ ...n, deg });
      return;
    }
    const r = Math.random();
    if (r < 0.15 && n.d >= 4 && n.d % 2 === 0) {
      out.push({ s: n.s, d: n.d / 2, deg: n.deg });
      out.push({ s: n.s + n.d / 2, d: n.d / 2, deg: Math.max(lo, Math.min(hi, n.deg + pick([-1, 1, 2]))) });
    } else if (r < 0.4) {
      out.push({ ...n, deg: Math.max(lo, Math.min(hi, n.deg + pick([-1, 1]))) });
    } else out.push({ ...n });
  });
  return out;
}

// Phrase scheduler shared by tracks: periods of A A' B A''.
function nextPhrase(st, chords, o) {
  const k = st.pIdx++ % 4;
  let notes;
  if (k === 0) notes = st.A && Math.random() < 0.35 ? varyPhrase(st.A, 4, o) : genPhrase(chords, 4, o);
  if (k === 0) st.A = notes;
  if (k === 1) notes = varyPhrase(st.A, pick([0, 2]), o);
  if (k === 2) notes = genPhrase(chords, 4, { ...o, start: pick([4, 5, 7]) });
  if (k === 3) notes = varyPhrase(st.A, 0, o);
  const map = new Map();
  for (const n of notes) map.set(n.s, n);
  return map;
}

// ---------------------------------------------------------------------------
//  Track definitions
// ---------------------------------------------------------------------------
const TRACKS = {
  menu: {
    bpm: 62,
    init(tr) {
      tr.st = { root: 50, scale: FREYGISH, prog: [0, 0, 3, 3, 1, 1, 6, 0], pIdx: 0, phrase: null, pStart: 0 };
      tr.drone([38, 45], 0.05);
    },
    step(tr, t, i) {
      const st = tr.st, s = i % 16, bar = (i / 16) | 0, sd = tr.stepDur;
      const cd = st.prog[bar % st.prog.length];
      const chord = triad(st.scale, st.root, cd);
      if (s === 0) {
        pad(tr.center, t, chord.map((m) => m + 12), sd * 16, 0.028, 1100);
        bendir(tr.center, t, 0.2);
      }
      if (s === 8) bendir(tr.center, t, 0.1);
      if (s % 2 === 0) {
        const tones = [chord[0], chord[1], chord[2], chord[0] + 12];
        const pat = [0, 1, 2, 3, 2, 1, 2, 1];
        pluck(tr.left, t, tones[pat[s / 2]], s === 0 ? 0.26 : 0.17);
      }
      if (bar >= 2 && bar % 2 === 0 && s === 0) {
        st.phrase = Math.random() < 0.12 ? null : nextPhrase(st, [cd, st.prog[(bar + 1) % 8]], { lo: -1, hi: 9, rhythms: [[8, 8], [12, 4], [4, 4, 8], [8, 4, 4], [16], [6, 2, 8]] });
        st.pStart = i;
      }
      const n = st.phrase && st.phrase.get(i - st.pStart);
      if (n) flute(tr.right, t, dm(st.scale, 74, n.deg), n.d * sd * 0.95, 0.075, n.d >= 6 && Math.random() < 0.35 ? 1 : 0);
    },
  },

  adventure: {
    bpm: 84,
    init(tr) {
      tr.st = { root: 45, scale: FREYGISH, pIdx: 0, phrase: null, pStart: 0, pat: 0, inst: 'flute',
        progF: [0, 0, 3, 0, 1, 0, 6, 0], progM: [0, 5, 6, 0, 3, 5, 6, 0] };
      tr.drone([33, 40], 0.035);
    },
    step(tr, t, i) {
      const st = tr.st, s = i % 16, bar = (i / 16) | 0, sd = tr.stepDur;
      const minor = ((bar / 8) | 0) % 2 === 1;
      st.scale = minor ? MINOR : FREYGISH;
      const prog = minor ? st.progM : st.progF;
      const cd = prog[bar % 8];
      const chord = triad(st.scale, st.root, cd);
      if (s === 0) {
        if (bar % 2 === 0) pad(tr.center, t, chord.map((m) => m + 12), sd * 32, 0.022, 900);
        if (bar % 2 === 0) st.pat = (Math.random() * 3) | 0;
      }
      // walking oud accompaniment
      const low = chord[0] - (chord[0] > 50 ? 12 : 0);
      if (st.pat === 0) {
        if (s % 8 === 0) pluck(tr.left, t, low, 0.24);
        else if (s % 4 === 0) pluck(tr.left, t, chord[2], 0.14);
        else if (s % 2 === 0) pluck(tr.left, t, chord[1] + (s % 8 === 2 ? 0 : 12), 0.1);
      } else if (st.pat === 1) {
        if (s === 0 || s === 6 || s === 12) pluck(tr.left, t, low, 0.22);
        else if (s === 3 || s === 9) pluck(tr.left, t, chord[1], 0.12);
        else if (s === 14) pluck(tr.left, t, chord[2], 0.12);
      } else {
        const seq = [low, chord[1], chord[2], chord[1]];
        if (s % 4 === 0) pluck(tr.left, t, seq[s / 4], s === 0 ? 0.22 : 0.13);
        if (s === 10) pluck(tr.left, t, chord[0] + 12, 0.09);
      }
      // light frame drum
      if (s === 0) bendir(tr.center, t, 0.16);
      if (s === 6 || s === 10) tek(tr.center, t, 0.04);
      if (s === 12) ka(tr.center, t, 0.04);
      // melody
      if (bar >= 1 && bar % 2 === 1 && s === 0) {
        const r = Math.random();
        st.inst = r < 0.62 ? 'flute' : r < 0.88 ? 'oud' : 'rest';
        st.phrase = st.inst === 'rest' ? null : nextPhrase(st, [cd, prog[(bar + 1) % 8]], { lo: -2, hi: 8 });
        st.pStart = i;
      }
      const n = st.phrase && st.phrase.get(i - st.pStart);
      if (n) {
        if (st.inst === 'flute') flute(tr.right, t, dm(st.scale, 69, n.deg), n.d * sd * 0.95, 0.07, n.d >= 6 && Math.random() < 0.3 ? 1 : 0);
        else {
          pluck(tr.right, t, dm(st.scale, 57, n.deg), 0.2);
          if (n.d >= 8) pluck(tr.right, t + sd * 2, dm(st.scale, 57, n.deg), 0.1);   // tremolo-ish restrike
        }
      }
    },
  },

  town: {
    bpm: 96,
    init(tr) {
      tr.st = { root: 52, scale: FREYGISH, prog: [0, 0, 1, 0, 0, 3, 1, 0], pIdx: 0, phrase: null, pStart: 0, inst: 'oud' };
      tr.drone([40], 0.03);
    },
    step(tr, t, i) {
      const st = tr.st, s = i % 16, bar = (i / 16) | 0, sd = tr.stepDur;
      const cd = st.prog[bar % 8];
      const chord = triad(st.scale, st.root, cd);
      if (s === 0) pad(tr.center, t, chord.map((m) => m + 12), sd * 16, 0.024, 1300);
      // light darbuka
      if (s === 0 || s === 8) dum(tr.center, t, s === 0 ? 0.2 : 0.14);
      if (s === 4 || s === 12) tek(tr.center, t, 0.07);
      if (s === 6 || s === 14) tek(tr.center, t, 0.045);
      if (s % 2 === 1 && Math.random() < 0.18) ka(tr.center, t, 0.03);
      // oud chord strums on beats 2 & 4
      if (s === 4 || s === 12) chord.forEach((m, k) => pluck(tr.left, t + k * 0.012, m - 12, 0.08));
      if (s === 0) pluck(tr.left, t, chord[0] - 12, 0.18);
      // call & response melody: oud / flute
      if (bar % 2 === 0 && s === 0) {
        st.inst = st.pIdx % 2 === 0 ? 'oud' : 'flute';
        st.phrase = nextPhrase(st, [cd, st.prog[(bar + 1) % 8]], { lo: -1, hi: 9 });
        st.pStart = i;
      }
      const n = st.phrase && st.phrase.get(i - st.pStart);
      if (n) {
        if (st.inst === 'flute') flute(tr.right, t, dm(st.scale, 76, n.deg), n.d * sd * 0.95, 0.06, n.d >= 6 && Math.random() < 0.3 ? 1 : 0);
        else pluck(tr.right, t, dm(st.scale, 64, n.deg), 0.22);
      }
    },
  },

  battle: {
    bpm: 132,
    init(tr) {
      tr.st = { root: 50, scale: FREYGISH, prog: [0, 0, 1, 1, 0, 0, 6, 1], pIdx: 0, phrase: null, pStart: 0 };
      tr.drone([38, 26], 0.05, 260);
    },
    step(tr, t, i) {
      const st = tr.st, s = i % 16, bar = (i / 16) | 0, sd = tr.stepDur;
      const cd = st.prog[bar % 8];
      // maqsum: D T . T D . T .
      const fill = bar % 4 === 3 && s >= 8;
      if (s === 0 || s === 8) dum(tr.center, t, 0.34);
      if (s === 2 || s === 6 || s === 12) tek(tr.center, t, 0.12);
      if (fill) tek(tr.center, t, 0.05 + (s - 8) * 0.012);
      else if (s % 2 === 1 && Math.random() < 0.3) ka(tr.center, t, 0.05);
      // ostinato oud (16ths)
      const pat = [0, 0, 1, 0, 2, 0, 1, 0, 3, 2, 1, 0, 1, 0, -1, 0];
      pluck(tr.left, t, dm(st.scale, st.root, cd + pat[s]) - 12, s % 4 === 0 ? 0.2 : 0.11, sd * 1.5);
      // tense low strings
      if (s === 0) {
        const r = dm(st.scale, st.root, cd) - 24;
        lowStr(tr.center, t, r, sd * 15, 0.05);
        lowStr(tr.center, t, r + 7, sd * 15, 0.03);
      }
      if (s % 4 === 2) lowStr(tr.center, t, dm(st.scale, st.root, cd) - 12, sd * 0.8, 0.035, 900);
      if (bar % 8 === 7 && s === 0) swell(tr.center, t, dm(st.scale, st.root, cd + 4) - 12, sd * 16, 0.05);
      // reed lead every other 4-bar block
      if (bar % 2 === 0 && s === 0) {
        st.phrase = ((bar / 4) | 0) % 2 === 1 ? nextPhrase(st, [cd, st.prog[(bar + 1) % 8]], { lo: 0, hi: 8, rhythms: [[2, 2, 4, 8], [4, 2, 2, 8], [2, 2, 2, 2, 8], [6, 2, 4, 4], [4, 4, 2, 2, 4]] }) : null;
        st.pStart = i;
      }
      const n = st.phrase && st.phrase.get(i - st.pStart);
      if (n) reed(tr.right, t, dm(st.scale, 62, n.deg), n.d * sd * 0.92, 0.045);
    },
  },

  victory: {
    bpm: 120, once: true,
    play(tr, t) {
      const b = tr.center;
      const n = [[62, 0, 0.17], [62, 0.2, 0.17], [62, 0.4, 0.17], [69, 0.6, 0.5], [67, 1.15, 0.24], [69, 1.4, 0.24], [74, 1.65, 1.8]];
      for (const [m, dt, d] of n) { brass(b, t + dt, mtof(m), d, 0.09); brass(b, t + dt, mtof(m - 12), d, 0.04); }
      pad(b, t + 1.65, [62, 66, 69, 74], 2.0, 0.035, 1600);
      [0, 0.2, 0.4].forEach((dt) => timpani(b, t + dt, 38, 0.22, 0.4));
      for (let k = 0; k < 10; k++) timpani(b, t + 1.15 + k * 0.05, 38, 0.06 + k * 0.012, 0.3);
      timpani(b, t + 1.65, 38, 0.38, 1.6);
      [50, 54, 57, 62, 66].forEach((m, k) => pluck(tr.left, t + 1.65 + k * 0.03, m, 0.15));
      return 4.2;
    },
  },

  defeat: {
    bpm: 60, once: true,
    play(tr, t) {
      const b = tr.center;
      lowStr(b, t, 38, 5.2, 0.05, 400);
      pad(b, t, [50, 53, 57], 2.6, 0.03, 700);
      pad(b, t + 2.6, [46, 50, 53], 2.6, 0.03, 600);
      [[69, 0, 0.6], [67, 0.6, 0.6], [65, 1.2, 0.6], [64, 1.8, 0.8], [65, 2.6, 0.5], [64, 3.1, 0.4], [62, 3.5, 2.0]].forEach(([m, dt, d]) =>
        flute(tr.right, t + dt, m, d, 0.08, d >= 0.8 ? 1 : 0));
      dum(b, t, 0.3, 0.7);
      dum(b, t + 3.5, 0.35, 0.6);
      return 6;
    },
  },
};

class Track {
  constructor(name) {
    this.name = name;
    this.def = TRACKS[name];
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(musicGain);
    this.center = this.bus;
    this.left = this.mkPan(-0.28);
    this.right = this.mkPan(0.22);
    this.stepDur = 60 / this.def.bpm / 4;
    this.stepIdx = 0;
    this.next = ctx.currentTime + 0.12;
    this.drones = [];
    this.stopped = false;
    if (this.def.once) {
      this.dur = this.def.play(this, ctx.currentTime + 0.05);
    } else this.def.init(this);
  }
  mkPan(v) {
    if (!ctx.createStereoPanner) return this.bus;
    const p = ctx.createStereoPanner();
    p.pan.value = v;
    p.connect(this.bus);
    return p;
  }
  drone(midis, vol, cutoff = 320) {
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass'; flt.frequency.value = cutoff; flt.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 2);
    flt.connect(g).connect(this.bus);
    for (const m of midis) {
      for (const [type, dt] of [['sawtooth', -5], ['triangle', 4]]) {
        const o = ctx.createOscillator();
        o.type = type; o.frequency.value = mtof(m); o.detune.value = dt;
        o.connect(flt); o.start();
        this.drones.push(o);
      }
    }
    // slow breathing of the drone filter
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.07; lg.gain.value = cutoff * 0.35;
    lfo.connect(lg).connect(flt.frequency); lfo.start();
    this.drones.push(lfo);
  }
  tick() {
    if (this.stopped || this.def.once) return;
    const now = ctx.currentTime;
    if (this.next < now - 0.1) {                       // fell behind (throttled tab) — skip ahead
      const skip = Math.ceil((now - this.next) / this.stepDur);
      this.next += skip * this.stepDur;
      this.stepIdx += skip;
    }
    const ahead = now + (typeof document !== 'undefined' && document.hidden ? 1.6 : 0.3);
    while (this.next < ahead) {
      if (!settings.muted) {
        try { this.def.step(this, this.next, this.stepIdx); } catch (e) { console.warn('[audio] music step', e); }
      }
      this.next += this.stepDur;
      this.stepIdx++;
    }
  }
  fadeIn(sec) {
    const g = this.bus.gain, now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(1, now + sec);
  }
  fadeOut(sec) {
    const g = this.bus.gain, now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + sec);
    fadingTracks.add(this);
    setTimeout(() => this.stop(), sec * 1000 + 250);
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    fadingTracks.delete(this);
    for (const o of this.drones) { try { o.stop(); } catch { /* ignore */ } }
    setTimeout(() => { try { this.bus.disconnect(); } catch { /* ignore */ } }, 1500);
    if (currentTrack === this) currentTrack = null;
    updateScheduler();
  }
}

function updateScheduler() {
  const active = (currentTrack && !currentTrack.def.once) || [...fadingTracks].some((t) => !t.def.once);
  if (active && !schedTimer) {
    schedTimer = setInterval(() => {
      if (currentTrack) currentTrack.tick();
      for (const t of fadingTracks) t.tick();
    }, 60);
  } else if (!active && schedTimer) {
    clearInterval(schedTimer);
    schedTimer = null;
  }
}

function startTrack(name) {
  const XF = 1.5;
  if (currentTrack) {
    if (currentTrack.name === name && !currentTrack.def.once) return;
    currentTrack.fadeOut(TRACKS[name]?.once ? 0.8 : XF);
    currentTrack = null;
  }
  if (!name || !TRACKS[name]) { updateScheduler(); return; }
  const tr = new Track(name);
  currentTrack = tr;
  if (tr.def.once) {
    tr.fadeIn(0.05);
    setTimeout(() => { if (currentTrack === tr) currentTrack = null; tr.stop(); }, (tr.dur + 1.5) * 1000);
  } else {
    tr.fadeIn(XF);
    tr.tick();
  }
  updateScheduler();
}

function setMusic(name) {
  const n = name && TRACKS[name] ? name : null;
  if (n === wantedMusic && currentTrack && currentTrack.name === n && !TRACKS[n]?.once) return;
  wantedMusic = n;
  if (!ctx) return;
  startTrack(n);
}

// ---------------------------------------------------------------------------
//  Settings
// ---------------------------------------------------------------------------
function setMuted(m) {
  settings.muted = !!m;
  saveSettings();
  if (ctx) {
    const now = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setTargetAtTime(settings.muted ? 0 : 0.9, now, 0.05);
  }
}
function setMusicVolume(v) {
  settings.music = clamp01(v);
  saveSettings();
  if (ctx) musicGain.gain.setTargetAtTime(settings.music, ctx.currentTime, 0.05);
}
function setSfxVolume(v) {
  settings.sfx = clamp01(v);
  saveSettings();
  if (ctx) sfxGain.gain.setTargetAtTime(settings.sfx, ctx.currentTime, 0.05);
}

export const audio = {
  init,
  play,
  setMusic,
  setMuted,
  isMuted: () => settings.muted,
  setMusicVolume,
  setSfxVolume,
  getMusicVolume: () => settings.music,
  getSfxVolume: () => settings.sfx,
  getMusic: () => wantedMusic,
  get sfxNames() { return Object.keys(SFX); },
  get musicNames() { return Object.keys(TRACKS); },
};

export default audio;
