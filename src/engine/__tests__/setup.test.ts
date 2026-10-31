import { CLASSIC, configNumber, isValidConfig, RULE_COMBINATIONS, RULE_KEYS } from '../config';
import { createGame, validateSeats } from '../setup';
import { game, seatsOf } from '../testing/fixtures';

describe('rule config (R-CFG-01..02)', () => {
  it('Classic preset matches the PRD defaults', () => {
    expect(CLASSIC).toEqual({
      entryRule: 'needChammaOrAshta',
      noHitBehavior: 'free',
      triplePenalty: true,
      doubles: true,
      doubleCrossing: 'blockOnce',
      bonusOnHome: false,
      playToEnd: true,
    });
    expect(RULE_KEYS).toHaveLength(7);
    expect(RULE_COMBINATIONS).toBe(192);
  });

  it('numbers every combination of options exactly once', () => {
    const seen = new Set(Array.from({ length: RULE_COMBINATIONS }, (_, n) => JSON.stringify(configNumber(n))));
    expect(seen.size).toBe(RULE_COMBINATIONS);
    expect(configNumber(RULE_COMBINATIONS)).toEqual(configNumber(0));
  });

  it('rejects unknown option values', () => {
    expect(isValidConfig(CLASSIC)).toBe(true);
    expect(isValidConfig({ ...CLASSIC, entryRule: 'sometimes' as never })).toBe(false);
  });

  it('R-CFG-02 the game keeps its own copy of the config', () => {
    const config = { ...CLASSIC };
    const state = createGame(seatsOf(['human', 'human', 'empty', 'empty']), config, 1, 'g', 0);
    config.doubles = false;
    expect(state.ruleConfig.doubles).toBe(true);
  });
});

describe('seats (R-SEAT-01..03, R-MODE-02..04)', () => {
  it('R-SEAT-02 needs 2–4 players and at least one human', () => {
    expect(validateSeats(seatsOf(['human', 'empty', 'empty', 'empty']))).toEqual(['tooFewPlayers']);
    expect(validateSeats(seatsOf(['bot', 'bot', 'empty', 'empty']))).toEqual(['noHuman']);
    expect(validateSeats(seatsOf(['human', 'bot', 'bot', 'bot']))).toEqual([]);
    expect(validateSeats(seatsOf(['human', 'human']))).toEqual(['wrongSeatCount']);
  });

  it('R-MODE-04 two seats may not share a colour', () => {
    const seats = seatsOf(['human', 'human', 'empty', 'empty']);
    seats[1] = { ...seats[1]!, color: 'RED' };
    expect(validateSeats(seats)).toEqual(['duplicateColor']);
  });

  it('createGame refuses invalid seats', () => {
    expect(() => createGame(seatsOf(['bot', 'bot', 'bot', 'bot']), CLASSIC, 1, 'g', 0)).toThrow(/noHuman/);
    expect(() =>
      createGame(seatsOf(['human', 'bot', 'empty', 'empty']), { ...CLASSIC, doubles: 'x' as never }, 1, 'g', 0),
    ).toThrow(/config/);
  });

  it('R-SEAT-01 fills four seats with id, kind, name, colour and bot level', () => {
    const state = game({ seats: ['human', 'bot', 'human', 'empty'] });
    expect(state.seats.map((s) => s.id)).toEqual(['A', 'B', 'C', 'D']);
    expect(state.seats[1]).toMatchObject({ kind: 'bot', botLevel: 'medium', name: 'Player 2', color: 'green' });
    expect(state.seats.every((s) => !s.hasHit && s.finishedRank === null)).toBe(true);
  });

  it('R-SEAT-03 empty seats get no pawns', () => {
    const state = game({ seats: ['human', 'empty', 'human', 'empty'] });
    expect(state.pawns.map((p) => p.id)).toEqual(['A0', 'A1', 'A2', 'A3', 'C0', 'C1', 'C2', 'C3']);
  });

  it('the first playing seat from A starts', () => {
    expect(game({ seats: ['empty', 'human', 'empty', 'human'] }).currentSeat).toBe('B');
  });

  it('keeps separate throw and bot RNG streams (R-RNG-03)', () => {
    const state = game({ seed: 99 });
    expect(state.rngState).not.toBe(state.botRngState);
    expect(state.seed).toBe(99);
  });
});

describe('entry rule start positions (R-PATH-04)', () => {
  it('needChammaOrAshta: all pawns wait off the board', () => {
    expect(game().pawns.every((p) => p.pathIndex === null)).toBe(true);
  });

  it('onStart: all pawns begin on the start square', () => {
    expect(game({ config: { entryRule: 'onStart' } }).pawns.every((p) => p.pathIndex === 0)).toBe(true);
  });
});
