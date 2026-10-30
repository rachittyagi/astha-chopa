import { CENTRE, isSafe, PATH_A, pathFor, ringOf, rot, SAFE_SQUARES, sameSquare, startSquare } from '../board';
import { SEAT_IDS, type Square } from '../types';

const key = ([r, c]: Square) => `${r},${c}`;

describe('board (R-BOARD-01..03)', () => {
  it('R-BOARD-02 marks the four start squares and the centre as safe', () => {
    expect(SAFE_SQUARES.map(key).sort()).toEqual(['0,2', '2,0', '2,2', '2,4', '4,2']);
    expect(isSafe([2, 2])).toBe(true);
    expect(isSafe([4, 4])).toBe(false);
  });

  it('R-BOARD-03 puts indices 0–15 on the outer ring, 16–23 on the inner ring, 24 at home', () => {
    PATH_A.slice(0, 16).forEach(([r, c]) => expect([r, c].some((v) => v === 0 || v === 4)).toBe(true));
    PATH_A.slice(16, 24).forEach(([r, c]) => {
      expect(r >= 1 && r <= 3 && c >= 1 && c <= 3).toBe(true);
      expect(sameSquare([r, c], CENTRE)).toBe(false);
    });
    expect(ringOf(0)).toBe('outer');
    expect(ringOf(15)).toBe('outer');
    expect(ringOf(16)).toBe('inner');
    expect(ringOf(23)).toBe('inner');
    expect(ringOf(24)).toBe('home');
  });
});

describe('paths (R-PATH-01..03, R-TEST-02)', () => {
  it('R-PATH-03 rotates anti-clockwise: rot(4, 2) = (2, 4)', () => {
    expect(rot([4, 2])).toEqual([2, 4]);
  });

  it.each(SEAT_IDS)('seat %s: 25 unique squares, from its start to the centre', (seat) => {
    const path = pathFor(seat);
    expect(path).toHaveLength(25);
    expect(new Set(path.map(key)).size).toBe(25);
    expect(path[0]).toEqual(startSquare(seat));
    expect(path[24]).toEqual(CENTRE);
  });

  it.each(SEAT_IDS)('seat %s passes the other three start squares at indices 4, 8 and 12', (seat) => {
    const path = pathFor(seat);
    const others = SEAT_IDS.filter((s) => s !== seat).map((s) => key(startSquare(s))).sort();
    expect([path[4]!, path[8]!, path[12]!].map(key).sort()).toEqual(others);
  });

  it.each(SEAT_IDS)('seat %s moves one orthogonal step at a time', (seat) => {
    const path = pathFor(seat);
    for (let i = 1; i < path.length; i++) {
      const [r0, c0] = path[i - 1]!;
      const [r1, c1] = path[i]!;
      expect(Math.abs(r1 - r0) + Math.abs(c1 - c0)).toBe(1);
    }
  });

  it('start squares sit on the four sides: A bottom, B right, C top, D left', () => {
    expect(startSquare('A')).toEqual([4, 2]);
    expect(startSquare('B')).toEqual([2, 4]);
    expect(startSquare('C')).toEqual([0, 2]);
    expect(startSquare('D')).toEqual([2, 0]);
  });
});
