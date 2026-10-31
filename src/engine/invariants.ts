// Rule invariants checked after every action in simulations (R-TEST-05).
import { HOME_INDEX, isSafe, LAST_OUTER_INDEX, squareKey } from './board';
import { legalMoves } from './legal';
import { activeSeats, pawnsAt, pawnsOf, squareOf } from './occupancy';
import { PAWNS_PER_SEAT } from './setup';
import { THROW_VALUES } from './throws';
import type { Action, GameState } from './types';

/** Problems found in `next`, given the state and action that produced it; empty when all hold. */
export function checkInvariants(prev: GameState, action: Action, next: GameState): string[] {
  const problems: string[] = [];
  const fail = (msg: string) => problems.push(`${action.type} by ${action.seat}: ${msg}`);

  for (const seat of next.seats) {
    const count = pawnsOf(next, seat.id).length;
    const want = seat.kind === 'empty' ? 0 : PAWNS_PER_SEAT;
    if (count !== want) fail(`seat ${seat.id} has ${count} pawns, expected ${want}`);
    const before = prev.seats.find((s) => s.id === seat.id)!;
    if (before.hasHit && !seat.hasHit) fail(`seat ${seat.id} lost its hit flag`);
    if (before.finishedRank !== null && seat.finishedRank !== before.finishedRank) {
      fail(`seat ${seat.id} changed its finished rank`);
    }
  }

  for (const pawn of next.pawns) {
    const i = pawn.pathIndex;
    if (i !== null && (!Number.isInteger(i) || i < 0 || i > HOME_INDEX)) fail(`${pawn.id} at index ${i}`);
    if (i === null && next.ruleConfig.entryRule === 'onStart') fail(`${pawn.id} off the board under onStart`);
    if (pawn.progress < 0) fail(`${pawn.id} has negative progress`);
    const hasHit = next.seats.find((s) => s.id === pawn.seat)!.hasHit;
    if (!hasHit && i !== null && i > LAST_OUTER_INDEX) fail(`${pawn.id} entered the inner ring without a hit`);
    const was = prev.pawns.find((p) => p.id === pawn.id)!;
    if (was.pathIndex === HOME_INDEX && i !== HOME_INDEX) fail(`${pawn.id} left home`);
  }

  const checked = new Set<number>();
  for (const pawn of next.pawns) {
    const square = squareOf(pawn);
    if (!square || isSafe(square) || checked.has(squareKey(square))) continue;
    checked.add(squareKey(square));
    const owners = new Set(pawnsAt(next, square).map((p) => p.seat));
    if (owners.size > 1) fail(`players ${[...owners].join(',')} share non-safe square ${square}`);
  }

  for (const d of next.doubles) {
    const here = pawnsAt(next, d.square).filter((p) => p.seat === d.owner).map((p) => p.id).sort();
    if (!next.ruleConfig.doubles) fail('double recorded with doubles off');
    if (isSafe(d.square)) fail(`double recorded on safe square ${d.square}`);
    if (here.length < 2 || here.join() !== [...d.pawnIds].sort().join()) {
      fail(`double record at ${d.square} does not match the board`);
    }
  }
  if (new Set(next.doubles.map((d) => `${d.owner}${squareKey(d.square)}`)).size !== next.doubles.length) {
    fail('duplicate double records');
  }

  if (next.pool.some((t) => !THROW_VALUES.includes(t.value))) fail('invalid throw value in pool');
  if (new Set(next.rankings).size !== next.rankings.length) fail('duplicate rankings');

  if (next.phase === 'finished') {
    const playing = next.seats.filter((s) => s.kind !== 'empty').length;
    if (next.rankings.length !== playing) fail('game finished without a full ranking');
  } else {
    if (!activeSeats(next).some((s) => s.id === next.currentSeat)) fail('current seat is not playing');
    if (next.phase === 'moving' && legalMoves(next).length === 0) fail('moving phase with no legal move');
    if (next.phase === 'throwing' && next.pool.length > 0 && !next.pool.every((t) => t.value === 4 || t.value === 8)) {
      fail('throwing phase with a 1, 2 or 3 in the pool');
    }
  }

  if (action.type !== 'Throw') {
    const moved = next.pawns.filter((p) => {
      const was = prev.pawns.find((q) => q.id === p.id)!;
      return was.pathIndex !== p.pathIndex;
    });
    if (moved.length === 0) fail('a move changed no pawn');
  }

  return problems;
}
