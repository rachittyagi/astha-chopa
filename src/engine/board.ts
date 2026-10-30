import type { SeatId, Square } from './types';

export const BOARD_SIZE = 5;
export const LAST_OUTER_INDEX = 15;
export const FIRST_INNER_INDEX = 16;
export const HOME_INDEX = 24;
export const PATH_LENGTH = 25;

export const CENTRE: Square = [2, 2];

/** Seat A's path (R-PATH-03 table): outer ring anti-clockwise, inner ring clockwise, then home. */
export const PATH_A: readonly Square[] = [
  [4, 2], [4, 3], [4, 4], [3, 4], [2, 4], [1, 4], [0, 4], [0, 3],
  [0, 2], [0, 1], [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1],
  [3, 1], [2, 1], [1, 1], [1, 2], [1, 3], [2, 3], [3, 3], [3, 2],
  [2, 2],
];

/** 90° anti-clockwise rotation of the 5x5 board: rot(r, c) = (4 − c, r). */
export function rot([r, c]: Square): Square {
  return [BOARD_SIZE - 1 - c, r];
}

const ROTATIONS: Record<SeatId, number> = { A: 0, B: 1, C: 2, D: 3 };

function rotateTimes(square: Square, times: number): Square {
  let out = square;
  for (let i = 0; i < times; i++) out = rot(out);
  return out;
}

const PATHS: Record<SeatId, readonly Square[]> = {
  A: PATH_A,
  B: PATH_A.map((sq) => rotateTimes(sq, ROTATIONS.B)),
  C: PATH_A.map((sq) => rotateTimes(sq, ROTATIONS.C)),
  D: PATH_A.map((sq) => rotateTimes(sq, ROTATIONS.D)),
};

/** The 25 squares of a seat's path, index 0 = its start square, index 24 = home. */
export function pathFor(seat: SeatId): readonly Square[] {
  return PATHS[seat];
}

export function squareAt(seat: SeatId, pathIndex: number): Square {
  const sq = PATHS[seat][pathIndex];
  if (!sq) throw new RangeError(`No square at index ${pathIndex} for seat ${seat}`);
  return sq;
}

export function startSquare(seat: SeatId): Square {
  return squareAt(seat, 0);
}

export function squareKey([r, c]: Square): number {
  return r * BOARD_SIZE + c;
}

export function sameSquare(a: Square, b: Square): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/** Start squares of all four seats plus the centre (R-BOARD-02); empty seats' starts stay safe. */
export const SAFE_SQUARES: readonly Square[] = [
  startSquare('A'), startSquare('B'), startSquare('C'), startSquare('D'), CENTRE,
];

const SAFE_KEYS = new Set(SAFE_SQUARES.map(squareKey));

export function isSafe(square: Square): boolean {
  return SAFE_KEYS.has(squareKey(square));
}

export type Ring = 'outer' | 'inner' | 'home';

export function ringOf(pathIndex: number): Ring {
  if (pathIndex <= LAST_OUTER_INDEX) return 'outer';
  if (pathIndex < HOME_INDEX) return 'inner';
  return 'home';
}
