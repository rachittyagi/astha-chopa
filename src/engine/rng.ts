// mulberry32 as a pure step function: the generator state lives in the game state (R-RNG-01).

export function seedState(seed: number): number {
  return seed >>> 0;
}

/** Returns a float in [0, 1) and the next state. */
export function nextRandom(state: number): [value: number, next: number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/** A second, independent stream for bots, so their choices never shift the throws (R-RNG-03). */
export function botSeedState(seed: number): number {
  return (seed ^ 0x9e3779b9) >>> 0;
}
