// Bot-vs-bot simulation (R-TEST-05): every game must finish within 2,000 turns and every
// action must pass the rule-invariant checker.
//
//   npm run sim -- --players 2,3,4 --config classic,random --games 10000
import {
  applyAction,
  checkInvariants,
  CLASSIC,
  configNumber,
  createGame,
  type BotLevel,
  type RuleConfig,
  type SeatConfig,
  type SeatKind,
} from '../src/engine';
import { BOT_LEVELS, chooseAction, withBotRng } from '../src/bot';

const MAX_TURNS = 2000;
const COLORS = ['red', 'green', 'yellow', 'blue'];
const SEATS_BY_COUNT: Record<number, SeatKind[]> = {
  2: ['bot', 'empty', 'bot', 'empty'],
  3: ['bot', 'bot', 'bot', 'empty'],
  4: ['bot', 'bot', 'bot', 'bot'],
};

type ConfigMode = 'classic' | 'random';

function seatsFor(players: number, seed: number): SeatConfig[] {
  return SEATS_BY_COUNT[players]!.map((kind, i) => {
    if (kind === 'empty') return { kind, name: `Player ${i + 1}`, color: COLORS[i]! };
    const botLevel = BOT_LEVELS[(seed + i) % BOT_LEVELS.length]!;
    // One seat is nominally human (R-SEAT-02); the simulation drives every seat with a bot.
    return { kind: i === 0 ? 'human' : 'bot', name: `Player ${i + 1}`, color: COLORS[i]!, botLevel };
  });
}

interface GameResult {
  turns: number;
  finished: boolean;
  stalemate: boolean;
  winnerLevel: BotLevel;
  winnerSeat: string;
  problems: string[];
}

export function playGame(players: number, mode: ConfigMode, seed: number): GameResult {
  const config = mode === 'classic' ? CLASSIC : configNumber(seed);
  let state = createGame(seatsFor(players, seed), config, seed, `sim-${seed}`, 0);
  const problems: string[] = [];
  while (state.phase !== 'finished' && state.turnNumber <= MAX_TURNS && problems.length === 0) {
    const { action, botRngState } = chooseAction(state);
    const before = withBotRng(state, botRngState);
    const result = applyAction(before, action);
    if (!result.ok) {
      problems.push(`engine rejected bot action: ${result.error.type} ${result.error.message}`);
      break;
    }
    problems.push(...checkInvariants(before, action, result.state));
    state = result.state;
  }
  if (state.phase !== 'finished' && problems.length === 0) problems.push(`not finished after ${MAX_TURNS} turns`);
  const winner = state.seats.find((s) => s.id === state.rankings[0]) ?? state.seats[0]!;
  return {
    turns: state.turnNumber,
    finished: state.phase === 'finished',
    stalemate: state.stalemateBroken,
    winnerLevel: winner.botLevel ?? 'medium',
    winnerSeat: winner.id,
    problems,
  };
}

/** Two-player Classic games between two levels, alternating who sits on A (moves first). */
export function headToHead(a: BotLevel, b: BotLevel, games: number, firstSeed = 1) {
  let aWins = 0;
  const problems: string[] = [];
  for (let seed = firstSeed; seed < firstSeed + games; seed++) {
    const [first, second] = seed % 2 === 0 ? [a, b] : [b, a];
    const seats: SeatConfig[] = [
      { kind: 'human', name: 'Player 1', color: COLORS[0]!, botLevel: first },
      { kind: 'empty', name: 'Player 2', color: COLORS[1]! },
      { kind: 'bot', name: 'Player 3', color: COLORS[2]!, botLevel: second },
      { kind: 'empty', name: 'Player 4', color: COLORS[3]! },
    ];
    let state = createGame(seats, CLASSIC, seed, `h2h-${seed}`, 0);
    while (state.phase !== 'finished' && state.turnNumber <= MAX_TURNS) {
      const { action, botRngState } = chooseAction(state);
      const result = applyAction(withBotRng(state, botRngState), action);
      if (!result.ok) {
        problems.push(`seed ${seed}: ${result.error.message}`);
        break;
      }
      state = result.state;
    }
    const winner = state.seats.find((s) => s.id === state.rankings[0]);
    if (winner?.botLevel === a) aWins++;
  }
  return { winRate: aWins / games, problems };
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
}

function main(): void {
  const playerCounts = arg('players', '2,3,4').split(',').map(Number);
  const modes = arg('config', 'classic,random').split(',') as ConfigMode[];
  const games = Number(arg('games', '10000'));
  const firstSeed = Number(arg('seed', '1'));
  let failed = false;

  const vs = arg('vs', '');
  if (vs) {
    const [a, b] = vs.split(',') as [BotLevel, BotLevel];
    const started = Date.now();
    const { winRate, problems } = headToHead(a, b, games, firstSeed);
    const margin = 1.96 * Math.sqrt((winRate * (1 - winRate)) / games);
    console.log(
      `${a} vs ${b}, 2 players, ${games} games in ${((Date.now() - started) / 1000).toFixed(1)}s: ` +
        `${a} wins ${(100 * winRate).toFixed(1)}% ± ${(100 * margin).toFixed(1)} (95%)`,
    );
    if (problems.length > 0) {
      problems.slice(0, 5).forEach((p) => console.error(`  ${p}`));
      process.exit(1);
    }
    return;
  }

  for (const mode of modes) {
    for (const players of playerCounts) {
      const started = Date.now();
      const turns: number[] = [];
      const wins: Record<string, number> = {};
      const seatWins: Record<string, number> = {};
      let stalemates = 0;
      const failures: string[] = [];
      for (let seed = firstSeed; seed < firstSeed + games; seed++) {
        const r = playGame(players, mode, seed);
        turns.push(r.turns);
        if (r.stalemate) stalemates++;
        wins[r.winnerLevel] = (wins[r.winnerLevel] ?? 0) + 1;
        seatWins[r.winnerSeat] = (seatWins[r.winnerSeat] ?? 0) + 1;
        if (r.problems.length > 0 && failures.length < 5) failures.push(`seed ${seed}: ${r.problems[0]}`);
      }
      turns.sort((a, b) => a - b);
      const avg = turns.reduce((a, b) => a + b, 0) / turns.length;
      const fmt = (o: Record<string, number>) =>
        Object.entries(o)
          .sort()
          .map(([k, v]) => `${k} ${((100 * v) / games).toFixed(1)}%`)
          .join(', ');
      console.log(
        `${mode} ${players}p: ${games} games in ${((Date.now() - started) / 1000).toFixed(1)}s | ` +
          `turns avg ${avg.toFixed(0)}, p50 ${percentile(turns, 0.5)}, p99 ${percentile(turns, 0.99)}, max ${turns[turns.length - 1]} | ` +
          `stalemates ${stalemates} | wins by level: ${fmt(wins)} | by seat: ${fmt(seatWins)} | ` +
          `failures ${failures.length === 0 ? 0 : 'YES'}`,
      );
      if (failures.length > 0) {
        failed = true;
        failures.forEach((f) => console.error(`  ${f}`));
      }
    }
  }
  if (failed) process.exit(1);
}

if (require.main === module) main();
