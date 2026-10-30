import { HOME_INDEX } from './board';
import { resolveMove } from './legal';
import { pawnsOf, seatOf } from './occupancy';
import { drawThrow, isExtraThrow } from './throws';
import { endTurn, playerFinished, settle } from './turn';
import type {
  Action,
  ApplyResult,
  EngineErrorType,
  GameEvent,
  GameState,
  Move,
} from './types';

/** How many log entries the state keeps; replays record their own full action list. */
export const LOG_LIMIT = 200;
const TRIPLE = 3;

function fail(type: EngineErrorType, message: string): ApplyResult {
  return { ok: false, error: { type, message } };
}

/** Copy everything the reducer may change, so the input state is never mutated (R-TECH-03). */
function draftOf(state: GameState): GameState {
  return {
    ...state,
    seats: state.seats.map((s) => ({ ...s })),
    pawns: state.pawns.map((p) => ({ ...p })),
    pool: [...state.pool],
    doubles: state.doubles.map((d) => ({ ...d, pawnIds: [...d.pawnIds] })),
    rankings: [...state.rankings],
    ruleConfig: { ...state.ruleConfig },
  };
}

function applyThrow(draft: GameState, events: GameEvent[]): void {
  const { thrown, rngState } = drawThrow(draft.rngState, draft.nextThrowId, draft.inBonusSequence);
  draft.rngState = rngState;
  draft.nextThrowId += 1;
  draft.pool.push(thrown);
  events.push({ type: 'ThrowResolved', seat: draft.currentSeat, throw: thrown });

  if (!isExtraThrow(thrown.value)) {
    settle(draft, events);
    return;
  }
  draft.consecutiveChammaAshta += 1;
  if (draft.ruleConfig.triplePenalty && draft.consecutiveChammaAshta >= TRIPLE) {
    // R-THROW-06, R-TURN-04: the pool and every queued bonus sequence are lost.
    events.push({ type: 'TurnForfeited', seat: draft.currentSeat, throws: draft.pool });
    draft.pool = [];
    draft.pendingBonusThrows = 0;
    endTurn(draft, events);
  }
}

function applyMove(draft: GameState, move: Move, events: GameEvent[]): void {
  const seat = seatOf(draft, draft.currentSeat);
  draft.pool = draft.pool.filter((t) => t.id !== move.action.throwId);

  for (const id of move.pawnIds) {
    const pawn = draft.pawns.find((p) => p.id === id)!;
    pawn.progress = move.from === null ? 0 : pawn.progress + move.value;
    pawn.pathIndex = move.to;
  }
  if (move.action.type === 'Enter') {
    events.push({ type: 'PawnEntered', pawnId: move.pawnIds[0]!, square: move.path[0]! });
  } else {
    events.push({ type: 'PawnMoved', pawnIds: move.pawnIds, squares: move.path });
  }

  if (move.hits.length > 0) {
    for (const id of move.hits) {
      const victim = draft.pawns.find((p) => p.id === id)!;
      victim.pathIndex = 0; // Back to its start square, still on the board (R-HIT-01).
      victim.progress = 0;
      events.push({ type: 'PawnHit', pawnId: id, by: seat.id });
    }
    if (!seat.hasHit) {
      seat.hasHit = true;
      events.push({ type: 'InnerRingUnlocked', seat: seat.id });
    }
    draft.pendingBonusThrows += 1; // One bonus sequence per hitting move (R-TURN-03).
  }

  if (move.to === HOME_INDEX) {
    for (const id of move.pawnIds) events.push({ type: 'PawnHome', pawnId: id });
    if (draft.ruleConfig.bonusOnHome) draft.pendingBonusThrows += 1;
    if (pawnsOf(draft, seat.id).every((p) => p.pathIndex === HOME_INDEX)) {
      playerFinished(draft, events);
      return;
    }
  }
  settle(draft, events);
}

/** The engine's only state transition: a new state plus events, or a typed error (PRD 8.2). */
export function applyAction(state: GameState, action: Action): ApplyResult {
  if (state.phase === 'finished') return fail('WrongPhase', 'The game is over.');
  if (action.seat !== state.currentSeat) {
    return fail('NotYourTurn', `It is seat ${state.currentSeat}'s turn.`);
  }

  const draft = draftOf(state);
  const events: GameEvent[] = [];

  if (action.type === 'Throw') {
    if (state.phase !== 'throwing') return fail('WrongPhase', 'Spend the throws in the pool first.');
    applyThrow(draft, events);
  } else {
    if (state.phase !== 'moving') return fail('WrongPhase', 'Throw before moving.');
    const move = resolveMove(state, action);
    if (!move) return fail('IllegalMove', 'That move is not allowed.');
    applyMove(draft, move, events);
  }

  const entry = { turnNumber: state.turnNumber, seat: action.seat, action, events };
  draft.log = [...state.log.slice(-(LOG_LIMIT - 1)), entry];
  return { ok: true, state: draft, events };
}
