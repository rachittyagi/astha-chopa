// Builders for engine tests. Not part of the public API.
import { CLASSIC, type RuleConfig } from '../config';
import { applyAction } from '../reducer';
import { createGame } from '../setup';
import { drawThrow } from '../throws';
import type {
  Action,
  GameState,
  Move,
  SeatConfig,
  SeatId,
  SeatKind,
  Shells,
  Throw,
  ThrowValue,
} from '../types';

const COLORS = ['red', 'green', 'yellow', 'blue'];

export function seatsOf(kinds: SeatKind[]): SeatConfig[] {
  return kinds.map((kind, i) => ({
    kind,
    name: `Player ${i + 1}`,
    color: COLORS[i]!,
    ...(kind === 'bot' ? { botLevel: 'medium' as const } : {}),
  }));
}

export interface GameOptions {
  seats?: SeatKind[];
  config?: Partial<RuleConfig>;
  seed?: number;
}

/** A fresh game; defaults to two humans on A and C with Classic rules. */
export function game(opts: GameOptions = {}): GameState {
  const kinds = opts.seats ?? ['human', 'empty', 'human', 'empty'];
  return createGame(seatsOf(kinds), { ...CLASSIC, ...opts.config }, opts.seed ?? 1, 'test-game', 0);
}

/** Put pawns at path indices (null = waiting); progress is set to the index. */
export function place(state: GameState, positions: Record<string, number | null>): GameState {
  return {
    ...state,
    pawns: state.pawns.map((p) =>
      p.id in positions
        ? { ...p, pathIndex: positions[p.id] ?? null, progress: positions[p.id] ?? 0 }
        : { ...p },
    ),
  };
}

export function withHit(state: GameState, ...seats: SeatId[]): GameState {
  return {
    ...state,
    seats: state.seats.map((s) => (seats.includes(s.id) ? { ...s, hasHit: true } : { ...s })),
  };
}

function shellsFor(value: ThrowValue): Shells {
  const up = value === 8 ? 0 : value;
  return [0, 1, 2, 3].map((i) => i < up) as unknown as Shells;
}

/** The current seat is in the moving phase with this pool (throw ids 1, 2, 3…). */
export function withPool(state: GameState, values: ThrowValue[], seat?: SeatId): GameState {
  const pool: Throw[] = values.map((value, i) => ({
    id: i + 1,
    value,
    shells: shellsFor(value),
    bonus: false,
  }));
  return {
    ...state,
    currentSeat: seat ?? state.currentSeat,
    phase: 'moving',
    pool,
    nextThrowId: pool.length + 1,
  };
}

/** An RNG state whose next throws are exactly `values`. */
export function rngFor(values: ThrowValue[]): number {
  for (let candidate = 0; candidate < 5_000_000; candidate++) {
    let state = candidate;
    let match = true;
    for (const want of values) {
      const { thrown, rngState } = drawThrow(state, 0, false);
      state = rngState;
      if (thrown.value !== want) {
        match = false;
        break;
      }
    }
    if (match) return candidate;
  }
  throw new Error(`No RNG state found for ${values.join(',')}`);
}

/** The current seat will throw `values` next. */
export function rigged(state: GameState, values: ThrowValue[]): GameState {
  return { ...state, rngState: rngFor(values) };
}

/** Apply an action and fail the test on an engine error. */
export function act(state: GameState, action: Action): GameState {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(`${result.error.type}: ${result.error.message}`);
  return result.state;
}

export function throwOnce(state: GameState): GameState {
  return act(state, { type: 'Throw', seat: state.currentSeat });
}

export function moveAction(state: GameState, pawnId: string, throwId: number): Action {
  return { type: 'Move', seat: state.currentSeat, throwId, pawnId, together: false };
}

/** Compact move list for assertions, e.g. ['A0 3:2→5', 'enter 8']. */
export function describeMoves(moves: Move[]): string[] {
  return moves.map((m) =>
    m.action.type === 'Enter'
      ? `enter ${m.value}`
      : `${m.pawnIds.join('+')} ${m.value}:${m.from}→${m.to}${m.hits.length ? ` hits ${m.hits.join(',')}` : ''}`,
  );
}

export function pawn(state: GameState, id: string) {
  const found = state.pawns.find((p) => p.id === id);
  if (!found) throw new Error(`No pawn ${id}`);
  return found;
}
