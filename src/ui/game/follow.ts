// Helps a human follow what the bots did: the move a bot is about to make, and a numbered trail
// of the moves bots made since the human last moved. Pure, built on engine state and the bot API.
import { botDelay, chooseAction, withBotRng } from '@/bot';
import { legalMoves, pathFor, type GameState, type SeatId, type Square, type Throw, type ThrowValue } from '@/engine';

/** One bot move as marked on the board. */
export interface TrailMark {
  /** 1, 2, 3… in the order this seat moved during its turn. */
  n: number;
  seat: SeatId;
  turn: number;
  value: ThrowValue;
  /** Where the pawn left from; null when it entered the board. */
  from: Square | null;
  to: Square;
  /** The pawns that moved; their landing badge waits until they have finished moving. */
  pawnIds: string[];
}

/**
 * The trail after the latest action: a bot's move is added (replacing that seat's marks from an
 * earlier turn), a human's move clears it, and throws leave it as it is.
 * `poolBefore` is the pool before the action, to know which throw the move spent.
 */
export function trailAfter(trail: TrailMark[], state: GameState, poolBefore: Throw[]): TrailMark[] {
  const entry = state.log[state.log.length - 1];
  if (!entry || entry.action.type === 'Throw') return trail;
  const seat = state.seats.find((s) => s.id === entry.seat);
  if (seat?.kind !== 'bot') return [];
  const { throwId } = entry.action;
  const value = poolBefore.find((t) => t.id === throwId)?.value;
  let from: Square | null = null;
  let to: Square | null = null;
  let pawnIds: string[] = [];
  for (const event of entry.events) {
    if (event.type === 'PawnEntered') {
      to = event.square;
      pawnIds = [event.pawnId];
    }
    if (event.type === 'PawnMoved') {
      from = event.from;
      pawnIds = event.pawnIds;
      to = event.squares[event.squares.length - 1] ?? event.from;
    }
  }
  if (value === undefined || !to) return trail;
  const kept = trail.filter((m) => m.seat !== entry.seat || m.turn === entry.turnNumber);
  const n = kept.filter((m) => m.seat === entry.seat).length + 1;
  return [...kept, { n, seat: entry.seat, turn: entry.turnNumber, value, from, to, pawnIds }];
}

/** The move the current bot is about to make: the throw it will spend and the squares it covers. */
export interface BotPlan {
  throwId: number;
  /** The pawn's square first (its start square when entering), then every square it visits. */
  squares: Square[];
}

/**
 * Same decision the bot driver will play: it waits `botDelay()` first, then the bot chooses with
 * the stream advanced past that delay, so the preview and the actual move always agree.
 */
export function botPlan(state: GameState): BotPlan | null {
  if (state.phase !== 'moving') return null;
  const seat = state.seats.find((s) => s.id === state.currentSeat);
  if (seat?.kind !== 'bot') return null;
  const { botRngState } = botDelay(state.botRngState);
  const { action } = chooseAction(withBotRng(state, botRngState));
  if (action.type === 'Throw') return null;
  const value = state.pool.find((t) => t.id === action.throwId)?.value;
  const move = legalMoves(state).find(
    (m) =>
      m.value === value &&
      m.action.type === action.type &&
      (action.type === 'Enter' ||
        (m.action.type === 'Move' && m.action.pawnId === action.pawnId && m.action.together === action.together)),
  );
  if (!move) return null;
  const path = pathFor(seat.id);
  const start = move.from === null ? [] : [path[move.from]!];
  return { throwId: action.throwId, squares: [...start, ...move.path] };
}
