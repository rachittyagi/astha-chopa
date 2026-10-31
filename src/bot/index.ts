// Public bot API. Bots pick only from the engine's legalMoves() and own a separate RNG
// stream (botRngState), so they never change the throws (R-BOT-01, R-RNG-03).
import { nextRandom, type Action, type BotLevel, type GameState } from '../engine';
import { chooseEasy } from './easy';
import { chooseHard } from './hard';
import { chooseMedium } from './medium';
import { BOT_DELAY_MAX_MS, BOT_DELAY_MIN_MS } from './weights';

export const BOT_LEVELS: readonly BotLevel[] = ['easy', 'medium', 'hard'];
export type { BotLevel };

export interface BotDecision {
  action: Action;
  /** Write back with withBotRng() so the next decision continues the stream. */
  botRngState: number;
}

/** The current seat's next action at its level (defaults to Medium). Deterministic per state. */
export function chooseAction(state: GameState): BotDecision {
  const seat = state.seats.find((s) => s.id === state.currentSeat)!;
  if (state.phase === 'throwing') {
    return { action: { type: 'Throw', seat: seat.id }, botRngState: state.botRngState };
  }
  switch (seat.botLevel ?? 'medium') {
    case 'easy': {
      const { move, botRngState } = chooseEasy(state, state.botRngState);
      return { action: move.action, botRngState };
    }
    case 'hard':
      return { action: chooseHard(state).action, botRngState: state.botRngState };
    default:
      return { action: chooseMedium(state).action, botRngState: state.botRngState };
  }
}

export function withBotRng(state: GameState, botRngState: number): GameState {
  return { ...state, botRngState };
}

/** How long to wait before the bot acts, 600–1000 ms, from the bot stream (R-BOT-02). */
export function botDelay(botRngState: number): { delayMs: number; botRngState: number } {
  const [r, next] = nextRandom(botRngState);
  return {
    delayMs: Math.round(BOT_DELAY_MIN_MS + r * (BOT_DELAY_MAX_MS - BOT_DELAY_MIN_MS)),
    botRngState: next,
  };
}
