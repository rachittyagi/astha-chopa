import { applyAction, createGame, CLASSIC, legalMoves, type BotLevel, type GameState, type Move } from '../../engine';
import { describeMoves, game, place, seatsOf, withHit, withPool } from '../../engine/testing/fixtures';
import { hitChance, threatChance } from '../danger';
import { chooseEasy } from '../easy';
import { chooseHard, scoreHard } from '../hard';
import { afterMove, chooseMedium, scoreMove, tieBreak } from '../medium';
import { botDelay, chooseAction, withBotRng } from '../index';

const label = (move: Move) => describeMoves([move])[0];

// Useful squares: (4,4) = A2 = C10; (0,0) = A10 = C2; (3,4) = A3 = C11; (0,1) = C1; (4,3) = C9.
describe('danger (PRD section 5, "in reach")', () => {
  it('is the throw-odds chance an opponent can land on the pawn next turn', () => {
    const state = place(game(), { A0: 10, C0: 1 });
    expect(hitChance(state, 'A0')).toBeCloseTo(4 / 16);
  });

  it('is zero on safe squares, at home, for doubles and out of reach', () => {
    expect(hitChance(place(game(), { A0: 4, C0: 1 }), 'A0')).toBe(0);
    expect(hitChance(withHit(place(game(), { A0: 24 }), 'A'), 'A0')).toBe(0);
    expect(hitChance(place(game(), { A0: 10, A1: 10, C0: 1 }), 'A0')).toBe(0);
    expect(hitChance(place(game(), { A0: 10, C0: 3 }), 'A0')).toBe(0);
  });

  it('adds up several throw values that reach', () => {
    const state = place(game({ config: { entryRule: 'onStart' } }), { A0: 10, C0: 1, C1: 0, C2: 0, C3: 0 });
    // From C index 0 a 2 reaches C2; from C1 a 1 does: 4/16 + 6/16.
    expect(hitChance(state, 'A0')).toBeCloseTo(10 / 16);
  });
});

describe('Medium heuristic (R-BOT-03, R-BOT-06)', () => {
  it('takes a hit over plain progress', () => {
    const state = withPool(place(game(), { A0: 1, A1: 6, C0: 11 }), [2]);
    expect(label(chooseMedium(state))).toBe('A0 2:1→3 hits C0');
  });

  it('enters a waiting pawn with a 4', () => {
    const state = withPool(place(game(), { A0: 1 }), [4]);
    expect(label(chooseMedium(state))).toBe('enter 4');
  });

  it('prefers landing on a safe square', () => {
    const state = withPool(place(game(), { A0: 2, A1: 7 }), [2]);
    expect(label(chooseMedium(state))).toBe('A0 2:2→4');
  });

  it('brings a pawn home', () => {
    const state = withPool(withHit(place(game(), { A0: 22, A1: 10 }), 'A'), [2]);
    expect(label(chooseMedium(state))).toBe('A0 2:22→24');
  });

  it('avoids a square an opponent can hit', () => {
    // A0 9→10 lands where C0 (at C1) hits with a 1; A1 1→2 is out of reach.
    const state = withPool(place(game(), { A0: 9, A1: 1, C0: 1 }), [1]);
    expect(label(chooseMedium(state))).toBe('A1 1:1→2');
  });

  it('R-BOT-06 breaks ties by the furthest pawn', () => {
    const state = withPool(place(game(), { A0: 1, A1: 5 }), [1]);
    expect(label(chooseMedium(state))).toBe('A1 1:5→6');
  });

  it('R-BOT-06 then by the lowest pawn id', () => {
    const move = (from: number, pawn: string) => ({ from, pawnIds: [pawn] }) as Move;
    expect([move(3, 'A2'), move(3, 'A1'), move(7, 'A3')].sort(tieBreak).map((m) => m.pawnIds[0])).toEqual([
      'A3',
      'A1',
      'A2',
    ]);
  });
});

describe('Easy', () => {
  it('takes an available hit half the time, otherwise a random move', () => {
    const state = withPool(place(game(), { A0: 1, A1: 6, C0: 11 }), [2]);
    let rng = 12345;
    let hits = 0;
    const n = 10_000;
    for (let i = 0; i < n; i++) {
      const { move, botRngState } = chooseEasy(state, rng);
      rng = botRngState;
      if (move.hits.length > 0) hits++;
    }
    // 50% deliberate hits plus half of the random picks (1 of 2 moves).
    expect(Math.abs(hits / n - 0.75)).toBeLessThan(0.02);
  });
});

describe('Hard', () => {
  it('also counts danger to pawns it does not move', () => {
    // A1 on (0,0) stays in reach of C0 whatever A0 does; Medium ignores that, Hard does not.
    const state = withPool(place(game(), { A0: 2, A1: 10, C0: 1 }), [1]);
    const move = legalMoves(state).find((m) => m.pawnIds[0] === 'A0')!;
    const after = afterMove(state, move);
    expect(scoreMove(state, move, after) - scoreHard(state, move, after)).toBeCloseTo(
      (4 / 16) * (50 + 2 * 10),
    );
  });

  it('values positions that can hit next turn', () => {
    // From A1 (4,3) a 1 reaches (4,4), where C0 stands (C10).
    expect(threatChance(place(game(), { A0: 1, C0: 10 }), 'A')).toBeCloseTo(4 / 16);
    expect(threatChance(place(game(), { A0: 5, C0: 10 }), 'A')).toBe(0);
  });

  it('takes the hit when planning a two-throw pool', () => {
    const state = withPool(place(game(), { A0: 1, C0: 11 }), [3, 2]);
    expect(label(chooseHard(state))).toBe('A0 2:1→3 hits C0');
  });
});

describe('chooseAction (R-BOT-01, R-BOT-05)', () => {
  const botGame = (level: BotLevel, seed: number) =>
    createGame(
      seatsOf(['human', 'bot', 'bot', 'bot']).map((s) => ({ ...s, botLevel: level })),
      CLASSIC,
      seed,
      'g',
      0,
    );

  it('throws in the throwing phase', () => {
    expect(chooseAction(game()).action).toEqual({ type: 'Throw', seat: 'A' });
  });

  it.each(['easy', 'medium', 'hard'] as BotLevel[])('%s is deterministic for a state', (level) => {
    const base = withPool(place(game(), { A0: 1, A1: 6, C0: 11 }), [2, 1]);
    const state: GameState = { ...base, seats: base.seats.map((s) => ({ ...s, botLevel: level })) };
    expect(chooseAction(state)).toEqual(chooseAction(state));
  });

  it('Medium and Hard do not consume the bot stream; Easy does', () => {
    const base = withPool(place(game(), { A0: 1, A1: 6 }), [2]);
    const at = (level: BotLevel) => ({ ...base, seats: base.seats.map((s) => ({ ...s, botLevel: level })) });
    expect(chooseAction(at('medium')).botRngState).toBe(base.botRngState);
    expect(chooseAction(at('hard')).botRngState).toBe(base.botRngState);
    expect(chooseAction(at('easy')).botRngState).not.toBe(base.botRngState);
  });

  it('never changes the throw sequence (R-RNG-03)', () => {
    const play = (level: BotLevel) => {
      let state = botGame(level, 8);
      const throws: number[] = [];
      for (let i = 0; i < 400 && state.phase !== 'finished'; i++) {
        const { action, botRngState } = chooseAction(state);
        const result = applyAction(withBotRng(state, botRngState), action);
        if (!result.ok) throw new Error(result.error.message);
        result.events.forEach((e) => e.type === 'ThrowResolved' && throws.push(e.throw.value));
        state = result.state;
      }
      return { throws, rngState: state.rngState };
    };
    const easy = play('easy');
    const hard = play('hard');
    const n = Math.min(easy.throws.length, hard.throws.length);
    expect(easy.throws.slice(0, n)).toEqual(hard.throws.slice(0, n));
  });

  it('R-BOT-04 decides well within budget (Node proxy: < 20 ms average)', () => {
    let state = botGame('hard', 21);
    let total = 0;
    let decisions = 0;
    while (state.phase !== 'finished' && state.turnNumber < 2000) {
      const start = performance.now();
      const { action, botRngState } = chooseAction(state);
      total += performance.now() - start;
      decisions += 1;
      const result = applyAction(withBotRng(state, botRngState), action);
      if (!result.ok) throw new Error(result.error.message);
      state = result.state;
    }
    expect(state.phase).toBe('finished');
    expect(total / decisions).toBeLessThan(20);
  });

  it('R-BOT-02 waits 600–1000 ms before acting', () => {
    let rng = 1;
    for (let i = 0; i < 200; i++) {
      const { delayMs, botRngState } = botDelay(rng);
      rng = botRngState;
      expect(delayMs).toBeGreaterThanOrEqual(600);
      expect(delayMs).toBeLessThanOrEqual(1000);
    }
  });
});
