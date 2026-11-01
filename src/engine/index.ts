// Public engine API. The app and bot import only from here.

export { pathFor, isSafe, ringOf, sameSquare, SAFE_SQUARES, HOME_INDEX, LAST_OUTER_INDEX } from './board';
export type { Ring } from './board';
export { CLASSIC, RULE_COMBINATIONS, RULE_KEYS, RULE_OPTIONS, configNumber, isValidConfig } from './config';
export type { RuleConfig, RuleKey } from './config';
export { legalMoves, movesWithValue } from './legal';
export { isOuterSquare } from './doubles';
export { checkInvariants, pieceProblems } from './invariants';
export { pawnsAt, squareOf, activeSeats } from './occupancy';
export { applyAction, endGameNow, humanStillPlaying, LOG_LIMIT } from './reducer';
export { createGame, validateSeats, PAWNS_PER_SEAT } from './setup';
export type { SeatProblem } from './setup';
export { THROW_ODDS, THROW_VALUES } from './throws';
export { nextRandom } from './rng';
export * from './types';

// Version of the saved GameState shape (R-SAVE-04).
export const SCHEMA_VERSION = 1;
