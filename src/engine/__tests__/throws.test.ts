import { nextRandom, seedState } from '../rng';
import { drawThrow, isExtraThrow, THROW_ODDS, THROW_VALUES, valueOf } from '../throws';
import type { ThrowValue } from '../types';

describe('seeded RNG (R-RNG-01)', () => {
  it('is deterministic and stays in [0, 1)', () => {
    const run = () => {
      let s = seedState(42);
      return Array.from({ length: 5 }, () => {
        const [v, next] = nextRandom(s);
        s = next;
        return v;
      });
    };
    const a = run();
    expect(a).toEqual(run());
    a.forEach((v) => expect(v >= 0 && v < 1).toBe(true));
    expect(new Set(a).size).toBe(5);
  });
});

describe('cowrie throws (R-THROW-01..04)', () => {
  it('R-THROW-02 scores mouth-up counts, with none up = 8 and all up = 4', () => {
    expect(valueOf([false, false, false, false])).toBe(8);
    expect(valueOf([true, false, false, false])).toBe(1);
    expect(valueOf([true, true, false, false])).toBe(2);
    expect(valueOf([true, true, true, false])).toBe(3);
    expect(valueOf([true, true, true, true])).toBe(4);
  });

  it('R-THROW-05 only Chamma (4) and Ashta (8) earn another throw', () => {
    expect(THROW_VALUES.filter(isExtraThrow)).toEqual([4, 8]);
  });

  it('R-THROW-04 records each shell face consistently with the value', () => {
    const { thrown } = drawThrow(seedState(7), 1, false);
    expect(thrown.shells).toHaveLength(4);
    expect(valueOf(thrown.shells)).toBe(thrown.value);
  });

  it('R-THROW-03 / R-TEST-03 matches the real odds within 1 percentage point over 160,000 throws', () => {
    const counts: Record<ThrowValue, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 8: 0 };
    let state = seedState(20261030);
    const total = 160_000;
    for (let i = 0; i < total; i++) {
      const { thrown, rngState } = drawThrow(state, i, false);
      state = rngState;
      counts[thrown.value] += 1;
    }
    for (const value of THROW_VALUES) {
      expect(Math.abs(counts[value] / total - THROW_ODDS[value])).toBeLessThan(0.01);
    }
  });
});
