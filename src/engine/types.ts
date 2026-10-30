import type { RuleConfig } from './config';

export type SeatId = 'A' | 'B' | 'C' | 'D';
export const SEAT_IDS: readonly SeatId[] = ['A', 'B', 'C', 'D'];

/** (row, col) with (0, 0) top-left and row 4 at the bottom (R-BOARD-01). */
export type Square = readonly [row: number, col: number];

export type ThrowValue = 1 | 2 | 3 | 4 | 8;
/** true = mouth-up. */
export type Shells = readonly [boolean, boolean, boolean, boolean];

export interface Throw {
  id: number;
  value: ThrowValue;
  shells: Shells;
  /** Thrown during a bonus sequence earned by a hit (or bonusOnHome). */
  bonus: boolean;
}

export type SeatKind = 'human' | 'bot' | 'empty';
export type BotLevel = 'easy' | 'medium' | 'hard';

/** What the setup screen supplies for each seat. */
export interface SeatConfig {
  kind: SeatKind;
  name: string;
  color: string;
  botLevel?: BotLevel;
}

export interface Seat extends SeatConfig {
  id: SeatId;
  hasHit: boolean;
  finishedRank: number | null;
  /** turnNumber at which this seat's previous turn started; 0 before its first turn (blockOnce, R-DBL-02). */
  prevTurnStart: number;
}

export interface Pawn {
  /** 'A0'..'D3' */
  id: string;
  seat: SeatId;
  /** 0–24 along the seat's path, or null while waiting off the board. */
  pathIndex: number | null;
  /** Squares travelled since entry or the last hit; keeps growing under circle while pathIndex wraps. */
  progress: number;
}

export interface DoubleRec {
  owner: SeatId;
  square: Square;
  pawnIds: string[];
  formedAtTurn: number;
}

export type Phase = 'throwing' | 'moving' | 'finished';

export type Action =
  | { type: 'Throw'; seat: SeatId }
  | { type: 'Enter'; seat: SeatId; throwId: number }
  | { type: 'Move'; seat: SeatId; throwId: number; pawnId: string; together: boolean };

/** A legal move as listed by legalMoves(): the action to dispatch plus its outcome for previews. */
export interface Move {
  action: Extract<Action, { type: 'Enter' | 'Move' }>;
  value: ThrowValue;
  pawnIds: string[];
  from: number | null;
  to: number;
  /** Squares visited, in order, ending on the landing square. */
  path: Square[];
  hits: string[];
}

export type GameEvent =
  | { type: 'ThrowResolved'; seat: SeatId; throw: Throw }
  | { type: 'PawnEntered'; pawnId: string; square: Square }
  | { type: 'PawnMoved'; pawnIds: string[]; squares: Square[] }
  | { type: 'PawnHit'; pawnId: string; by: SeatId }
  | { type: 'DoubleFormed'; owner: SeatId; square: Square }
  | { type: 'DoubleBroken'; owner: SeatId; square: Square }
  | { type: 'PawnHome'; pawnId: string }
  | { type: 'InnerRingUnlocked'; seat: SeatId }
  | { type: 'PoolDiscarded'; seat: SeatId; throws: Throw[] }
  | { type: 'TurnForfeited'; seat: SeatId; throws: Throw[] }
  | { type: 'StalemateBroken' }
  | { type: 'TurnPassed'; from: SeatId; to: SeatId }
  | { type: 'PlayerFinished'; seat: SeatId; rank: number }
  | { type: 'GameOver'; rankings: SeatId[] };

export interface LogEntry {
  turnNumber: number;
  seat: SeatId;
  action: Action;
  events: GameEvent[];
}

export interface GameState {
  id: string;
  schemaVersion: 1;
  createdAt: number;
  seed: number;
  seats: Seat[];
  pawns: Pawn[];
  ruleConfig: RuleConfig;
  rngState: number;
  botRngState: number;
  phase: Phase;
  currentSeat: SeatId;
  turnNumber: number;
  turnStartedAt: number;
  pool: Throw[];
  nextThrowId: number;
  /** True while throwing or spending a bonus sequence. */
  inBonusSequence: boolean;
  consecutiveChammaAshta: number;
  pendingBonusThrows: number;
  doubles: DoubleRec[];
  stalemateBroken: boolean;
  rankings: SeatId[];
  /** Most recent entries only (LOG_LIMIT); full replays keep their own action list. */
  log: LogEntry[];
}

export type EngineErrorType = 'NotYourTurn' | 'IllegalMove' | 'WrongPhase';
export interface EngineError {
  type: EngineErrorType;
  message: string;
}

export type ApplyResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: EngineError };
