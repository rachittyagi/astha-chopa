// Phase transitions after a throw or move. Every function here mutates a draft
// that the reducer has already copied, and appends to its event list.
import { canEverMove, legalMoves } from './legal';
import { activeSeats, pawnsOf, seatOf } from './occupancy';
import { SEAT_IDS, type GameEvent, type GameState, type SeatId } from './types';

/** Next seat after `from` in A → B → C → D order that is still playing (R-SEAT-03). */
export function nextSeat(state: GameState, from: SeatId): SeatId {
  const start = SEAT_IDS.indexOf(from);
  for (let k = 1; k <= SEAT_IDS.length; k++) {
    const id = SEAT_IDS[(start + k) % SEAT_IDS.length]!;
    const seat = seatOf(state, id);
    if (seat.kind !== 'empty' && seat.finishedRank === null) return id;
  }
  return from;
}

/** Stalemate (R-TURN-06): nobody could ever move, so hitless players switch to circle. */
export function checkStalemate(draft: GameState, events: GameEvent[]): void {
  if (draft.stalemateBroken || draft.phase === 'finished') return;
  if (activeSeats(draft).some((s) => canEverMove(draft, s.id))) return;
  draft.stalemateBroken = true;
  events.push({ type: 'StalemateBroken' });
}

export function endTurn(draft: GameState, events: GameEvent[]): void {
  const from = draft.currentSeat;
  seatOf(draft, from).prevTurnStart = draft.turnStartedAt;
  const to = nextSeat(draft, from);
  draft.currentSeat = to;
  draft.turnNumber += 1;
  draft.turnStartedAt = draft.turnNumber;
  draft.phase = 'throwing';
  draft.pool = [];
  draft.consecutiveChammaAshta = 0;
  draft.pendingBonusThrows = 0;
  draft.inBonusSequence = false;
  events.push({ type: 'TurnPassed', from, to });
  checkStalemate(draft, events);
}

/** Start a queued bonus sequence, or end the turn when none is left (R-TURN-03). */
function nextSequenceOrEndTurn(draft: GameState, events: GameEvent[]): void {
  if (draft.pendingBonusThrows > 0) {
    draft.pendingBonusThrows -= 1;
    draft.consecutiveChammaAshta = 0;
    draft.inBonusSequence = true;
    draft.phase = 'throwing';
    return;
  }
  endTurn(draft, events);
}

/**
 * After a 1/2/3 ends a throw sequence, or after a move: keep the turn while any
 * throw is playable, otherwise discard what is left (R-TURN-02) and move on.
 */
export function settle(draft: GameState, events: GameEvent[]): void {
  draft.phase = 'moving';
  if (draft.pool.length > 0 && legalMoves(draft).length > 0) return;
  if (draft.pool.length > 0) {
    events.push({ type: 'PoolDiscarded', seat: draft.currentSeat, throws: draft.pool });
    draft.pool = [];
  }
  nextSequenceOrEndTurn(draft, events);
}

function totalProgress(state: GameState, seat: SeatId): number {
  return pawnsOf(state, seat).reduce((sum, p) => sum + (p.pathIndex === null ? 0 : p.progress), 0);
}

/** Give remaining players their ranks, furthest along first, and end the game (R-WIN-02, R-WIN-03). */
export function finishGame(draft: GameState, events: GameEvent[]): void {
  const remaining = activeSeats(draft).sort(
    (a, b) =>
      totalProgress(draft, b.id) - totalProgress(draft, a.id) ||
      SEAT_IDS.indexOf(a.id) - SEAT_IDS.indexOf(b.id),
  );
  for (const seat of remaining) {
    seat.finishedRank = draft.rankings.length + 1;
    draft.rankings.push(seat.id);
  }
  draft.phase = 'finished';
  draft.pool = [];
  draft.pendingBonusThrows = 0;
  events.push({ type: 'GameOver', rankings: [...draft.rankings] });
}

/** A player just brought their last pawn home (R-TURN-05, R-WIN-02, R-WIN-03). */
export function playerFinished(draft: GameState, events: GameEvent[]): void {
  const seat = seatOf(draft, draft.currentSeat);
  seat.finishedRank = draft.rankings.length + 1;
  draft.rankings.push(seat.id);
  events.push({ type: 'PlayerFinished', seat: seat.id, rank: seat.finishedRank });

  const left = activeSeats(draft).length;
  if (!draft.ruleConfig.playToEnd || left <= 1) {
    finishGame(draft, events);
    return;
  }
  if (draft.pool.length > 0) {
    events.push({ type: 'PoolDiscarded', seat: seat.id, throws: draft.pool });
  }
  draft.pool = [];
  draft.pendingBonusThrows = 0;
  endTurn(draft, events);
}
