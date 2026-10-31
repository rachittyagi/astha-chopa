// Generates the bundled sound effects (R-UX-03, R-NET-01: everything is bundled, nothing downloaded).
// Run once after changing a sound:  npx tsx scripts/make-sounds.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RATE = 22_050;

/** 16-bit mono PCM WAV. */
function wav(samples: Float32Array): Buffer {
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
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function render(seconds: number, fn: (t: number) => number): Float32Array {
  const out = new Float32Array(Math.round(seconds * RATE));
  for (let i = 0; i < out.length; i++) out[i] = fn(i / RATE);
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

const SOUNDS: Record<string, Float32Array> = {
  // Four shells clattering: short noise bursts.
  throw: render(0.45, (t) => [0, 0.08, 0.17, 0.27].reduce((s, at) => (t >= at ? s + noise() * 0.5 * decay(t - at, 60) : s), 0)),
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
for (const [name, samples] of Object.entries(SOUNDS)) {
  writeFileSync(join(dir, `${name}.wav`), wav(samples));
  console.log(`assets/sounds/${name}.wav  ${(samples.length / RATE).toFixed(2)}s`);
}
