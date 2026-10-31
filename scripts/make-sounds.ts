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

const SOUNDS: Record<string, Float32Array> = {
  // A soft tap for each step.
  step: render(0.08, (t) => (tone(t, 520) * 0.5 + noise() * 0.2) * decay(t, 70)),
  // A low thud.
  hit: render(0.3, (t) => (tone(t, 110 - 60 * t) * 0.9 + noise() * 0.2) * decay(t, 14)),
  // Two rising notes.
  home: render(0.4, (t) => (t < 0.18 ? tone(t, 660) : tone(t, 880)) * 0.5 * decay(t % 0.18, 8)),
  // A short arpeggio.
  win: render(0.9, (t) => tone(t, [523, 659, 784, 1047][Math.min(3, Math.floor(t / 0.2))]!) * 0.45 * decay(t % 0.2, 5)),
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
