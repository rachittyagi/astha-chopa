import type { RuleConfig } from './config';
import { nextRandom } from './rng';
import type { Shells, Throw, ThrowValue } from './types';

export const THROW_VALUES: readonly ThrowValue[] = [1, 2, 3, 4, 8];

/** Exact odds from four fair shells (R-THROW-03). */
export const THROW_ODDS: Readonly<Record<ThrowValue, number>> = {
  1: 4 / 16,
  2: 6 / 16,
  3: 4 / 16,
  4: 1 / 16,
  8: 1 / 16,
};

/** Chamma (4) and Ashta (8) earn another throw (R-THROW-05). */
export function isExtraThrow(value: ThrowValue): boolean {
  return value === 4 || value === 8;
}

/** Whether a throw earns another throw: a 4 or 8, and a 1 too under rethrowOnOne. */
export function earnsRethrow(value: ThrowValue, config: Pick<RuleConfig, 'rethrowOnOne'>): boolean {
  return isExtraThrow(value) || (value === 1 && config.rethrowOnOne);
}

/** Mouth-up count, except none up = 8 (Ashta) (R-THROW-02). */
export function valueOf(shells: Shells): ThrowValue {
  const up = shells.filter(Boolean).length;
  return up === 0 ? 8 : (up as 1 | 2 | 3 | 4);
}

/** One draw per shell, each mouth-up with probability 0.5 (R-THROW-01). */
export function drawThrow(
  rngState: number,
  id: number,
  bonus: boolean,
): { thrown: Throw; rngState: number } {
  let state = rngState;
  const faces: boolean[] = [];
  for (let i = 0; i < 4; i++) {
    const [r, next] = nextRandom(state);
    state = next;
    faces.push(r < 0.5);
  }
  const shells = faces as unknown as Shells;
  return { thrown: { id, value: valueOf(shells), shells, bonus }, rngState: state };
}
