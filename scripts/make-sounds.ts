// Generates the bundled sound effects (R-UX-03, R-NET-01: everything is bundled, nothing downloaded).
// Run once after changing a sound:  npx tsx scripts/make-sounds.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RATE = 22_050;
/** The throw needs crisp high clicks, so it is rendered at full CD rate. */
const THROW_RATE = 44_100;

/** 16-bit mono PCM WAV. */
function wav(samples: Float32Array, rate = RATE): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32_767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function render(seconds: number, fn: (t: number) => number, rate = RATE): Float32Array {
  const out = new Float32Array(Math.round(seconds * rate));
  for (let i = 0; i < out.length; i++) out[i] = fn(i / rate);
  return out;
}

// Deterministic noise so the files are reproducible.
let seed = 12345;
const noise = () => {
  seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
  return (seed / 1_073_741_824) - 1;
};

const decay = (t: number, rate: number) => Math.exp(-t * rate);
const tone = (t: number, hz: number) => Math.sin(2 * Math.PI * hz * t);

interface Click {
  at: number;
  amp: number;
  /** Ring frequencies of this shell, Hz. */
  modes: number[];
  /** How fast the ring dies away, per second. */
  damping: number;
}

/**
 * Cowries are small, hard, porcelain-like shells: each knock is a bright transient with a few
 * high resonances that die out within ~15 ms. A throw is a rattle in cupped hands, a short
 * pause, then the four shells landing with a couple of bounces each and a little slide.
 */
function cowrieThrow(): Float32Array {
  const shellModes = [
    [3150, 4720, 6900],
    [3480, 5210, 7600],
    [2900, 4380, 6420],
    [3760, 5590, 8100],
  ];
  const clicks: Click[] = [];
  // Rattle in the hand: quick, quieter knocks between the shells.
  for (let k = 0; k < 14; k++) {
    const shell = shellModes[k % 4]!;
    clicks.push({ at: 0.02 + k * 0.019 + Math.abs(noise()) * 0.008, amp: 0.18 + Math.abs(noise()) * 0.17, modes: shell, damping: 520 });
  }
  // Landing: each shell hits, then bounces lower and sooner.
  shellModes.forEach((modes, i) => {
    let at = 0.4 + i * 0.033 + Math.abs(noise()) * 0.02;
    let amp = 0.95 - i * 0.07;
    let gap = 0.075 + Math.abs(noise()) * 0.02;
    for (let bounce = 0; bounce < 3; bounce++) {
      clicks.push({ at, amp, modes, damping: 340 });
      at += gap;
      gap *= 0.6;
      amp *= 0.45;
    }
  });
  const slideStart = 0.62;
  const out = render(
    0.95,
    (t) => {
      let v = 0;
      for (const c of clicks) {
        const dt = t - c.at;
        if (dt < 0 || dt > 0.05) continue;
        const ring = c.modes.reduce((sum, hz, m) => sum + tone(dt, hz) / (m + 1), 0) * decay(dt, c.damping);
        const snap = dt < 0.002 ? noise() * (1 - dt / 0.002) : 0;
        v += c.amp * (0.6 * ring + 0.5 * snap);
      }
      // A soft scrape as the shells settle.
      if (t > slideStart && t < slideStart + 0.12) {
        const dt = t - slideStart;
        v += noise() * 0.06 * Math.sin((Math.PI * dt) / 0.12);
      }
      return v;
    },
    THROW_RATE,
  );
  // Light high-pass (remove any DC/rumble), then normalise to 0.9 peak.
  let prevIn = 0;
  let prevOut = 0;
  for (let i = 0; i < out.length; i++) {
    const x = out[i]!;
    prevOut = 0.995 * (prevOut + x - prevIn);
    prevIn = x;
    out[i] = prevOut;
  }
  const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  return out.map((v) => (v / peak) * 0.9);
}

/** A struck bell: a few inharmonic partials, the higher ones dying faster. */
function bell(dt: number, hz: number): number {
  if (dt < 0) return 0;
  const partials: [number, number, number][] = [
    [1, 1, 2.2],
    [2.0, 0.55, 3.4],
    [2.76, 0.42, 5],
    [4.07, 0.28, 7.5],
    [5.4, 0.18, 10],
  ];
  return partials.reduce((sum, [ratio, amp, damp]) => sum + amp * tone(dt, hz * ratio) * decay(dt, damp), 0);
}

/** A gong: low, slightly detuned partials with a long ring. */
function gong(dt: number): number {
  if (dt < 0) return 0;
  return [98, 147.3, 196.8, 263.5].reduce((sum, hz, i) => sum + tone(dt, hz) * decay(dt, 1.6 + i * 0.6) / (i + 1), 0);
}

/** Tiny high tinkles, like bangles, scattered over `seconds`. */
function sparkle(seconds: number, count: number): (t: number) => number {
  const hits = Array.from({ length: count }, () => ({ at: Math.abs(noise()) * seconds, hz: 2600 + Math.abs(noise()) * 1800 }));
  return (t) => hits.reduce((sum, h) => (t >= h.at ? sum + tone(t - h.at, h.hz) * decay(t - h.at, 30) * 0.12 : sum), 0);
}

function normalise(samples: Float32Array, peak = 0.9): Float32Array {
  const max = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  return samples.map((v) => (v / max) * peak);
}

/** One handclap: a short, bright burst of noise with a tiny room tail. */
function clapBurst(dt: number): number {
  if (dt < 0 || dt > 0.12) return 0;
  const body = noise() * decay(dt, 95);
  const tail = noise() * decay(dt, 22) * 0.18;
  return body + tail;
}

/** A few people clapping for the winner. */
function applause(): Float32Array {
  const claps: number[] = [];
  for (let person = 0; person < 6; person++) {
    let at = Math.abs(noise()) * 0.08;
    const beat = 0.19 + Math.abs(noise()) * 0.05;
    while (at < 1.25) {
      claps.push(at);
      at += beat + noise() * 0.015;
    }
  }
  let prev = 0;
  return normalise(
    render(1.45, (t) => {
      let v = 0;
      for (const at of claps) v += clapBurst(t - at) * (t > 1.0 ? Math.max(0, 1 - (t - 1.0) / 0.45) : 1);
      // Gentle high-pass so the claps sound crisp rather than thuddy.
      const out = v - 0.85 * prev;
      prev = v;
      return out;
    }),
    0.85,
  );
}

const SOUNDS: Record<string, Float32Array> = {
  // A soft tap for each step.
  step: render(0.08, (t) => (tone(t, 520) * 0.5 + noise() * 0.2) * decay(t, 70)),
  // A low thud.
  hit: render(0.3, (t) => (tone(t, 110 - 60 * t) * 0.9 + noise() * 0.2) * decay(t, 14)),
  // Chamma (4): two bright bell strikes and a sparkle.
  chamma: (() => {
    const shimmer = sparkle(0.6, 10);
    return normalise(render(1.1, (t) => 0.5 * bell(t, 988) + 0.5 * bell(t - 0.14, 1319) + shimmer(t)));
  })(),
  // Ashta (8): a gong under a rising peal of bells; bigger than Chamma.
  ashta: (() => {
    const shimmer = sparkle(0.9, 16);
    const peal = [784, 988, 1175, 1568];
    return normalise(
      render(1.7, (t) => 0.55 * gong(t) + peal.reduce((sum, hz, i) => sum + 0.32 * bell(t - 0.08 - i * 0.11, hz), 0) + shimmer(t)),
    );
  })(),
  // The winner's screen: applause.
  clap: applause(),
  // The winner: a bright fanfare ending on a held chord.
  win: (() => {
    const notes = [523, 659, 784, 1047];
    return normalise(
      render(1.8, (t) => {
        const run = notes.reduce((sum, hz, i) => sum + 0.35 * bell(t - i * 0.14, hz), 0);
        const chord = t > 0.62 ? [523, 659, 784, 1047].reduce((sum, hz) => sum + tone(t, hz), 0) * 0.12 * decay(t - 0.62, 1.4) : 0;
        return run + chord;
      }),
    );
  })(),
  // A pawn reached home: a slide whistle swooping up ("whee") then a quick hop up ("oop").
  // Pure tones only, so the noise sequence (and every other file) stays the same.
  whistle: (() => {
    let phase = 0;
    return normalise(
      render(0.75, (t) => {
        // Frequency: glide 700 → 1700 Hz over 0.42 s, a tiny dip, then a hop to 2100 Hz.
        const glide = t < 0.42 ? 700 + 1000 * Math.pow(t / 0.42, 0.8) : t < 0.48 ? 1700 - 300 * ((t - 0.42) / 0.06) : 2100;
        const vibrato = 1 + 0.012 * Math.sin(2 * Math.PI * 7 * t);
        phase += (2 * Math.PI * glide * vibrato) / RATE;
        // A whistle is nearly a sine with a little breathy second harmonic.
        const voice = Math.sin(phase) + 0.18 * Math.sin(2 * phase);
        const env =
          t < 0.03 ? t / 0.03 : t < 0.42 ? 1 : t < 0.48 ? 0.35 : t < 0.52 ? 0.35 + 0.65 * ((t - 0.48) / 0.04) : decay(t - 0.52, 9);
        return voice * env;
      }),
      0.8,
    );
  })(),
};

const dir = join(__dirname, '..', 'assets', 'sounds');
mkdirSync(dir, { recursive: true });
const shells = cowrieThrow();
writeFileSync(join(dir, 'throw.wav'), wav(shells, THROW_RATE));
console.log(`assets/sounds/throw.wav  ${(shells.length / THROW_RATE).toFixed(2)}s (cowrie throw)`);
for (const [name, samples] of Object.entries(SOUNDS)) {
  writeFileSync(join(dir, `${name}.wav`), wav(samples));
  console.log(`assets/sounds/${name}.wav  ${(samples.length / RATE).toFixed(2)}s`);
}
