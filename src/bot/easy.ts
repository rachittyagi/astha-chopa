import { legalMoves, nextRandom, type GameState, type Move } from '../engine';
import { EASY_HIT_RATE } from './weights';

/** Easy: a random legal move, but takes an available hit half the time (PRD section 5). */
export function chooseEasy(state: GameState, botRngState: number): { move: Move; botRngState: number } {
  const moves = legalMoves(state);
  if (moves.length === 0) throw new Error('No legal move to choose');
  const hits = moves.filter((m) => m.hits.length > 0);
  let [r, rng] = nextRandom(botRngState);
  const pool = hits.length > 0 && r < EASY_HIT_RATE ? hits : moves;
  [r, rng] = nextRandom(rng);
  return { move: pool[Math.floor(r * pool.length)]!, botRngState: rng };
}
