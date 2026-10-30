// Square occupancy is always derived from pawn positions, never stored (PRD 8.3).
import { sameSquare, squareAt } from './board';
import type { GameState, Pawn, Seat, SeatId, Square } from './types';

export function squareOf(pawn: Pawn): Square | null {
  return pawn.pathIndex === null ? null : squareAt(pawn.seat, pawn.pathIndex);
}

export function pawnsAt(state: GameState, square: Square): Pawn[] {
  return state.pawns.filter((p) => {
    const sq = squareOf(p);
    return sq !== null && sameSquare(sq, square);
  });
}

export function pawnsOf(state: GameState, seat: SeatId): Pawn[] {
  return state.pawns.filter((p) => p.seat === seat);
}

export function seatOf(state: GameState, seat: SeatId): Seat {
  const found = state.seats.find((s) => s.id === seat);
  if (!found) throw new Error(`Unknown seat ${seat}`);
  return found;
}

/** Seats still taking turns: not empty and not finished. */
export function activeSeats(state: GameState): Seat[] {
  return state.seats.filter((s) => s.kind !== 'empty' && s.finishedRank === null);
}
