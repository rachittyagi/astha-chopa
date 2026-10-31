# Ashta Chamma v1 — Design

Companion to [requirements.md](requirements.md). Greenfield: the repo is empty, so file names below set the conventions.

## Technical Approach

One npm package, Expo (managed, development build), TypeScript strict. Layers are folders with lint-enforced boundaries:

```
src/
  app/                    expo-router routes (thin: compose src/ui screens); SDK 58 convention
    _layout.tsx  index.tsx  setup.tsx  game.tsx  result.tsx  how-to-play.tsx  settings.tsx
  engine/                 pure rules; imports nothing outside src/engine
    types.ts              SeatId, Square, ThrowValue, Throw, Pawn, Seat, DoubleRec, GameState, Action, Move, GameEvent, EngineError
    board.ts              SAFE_SQUARES, PATH_A, rot(), pathFor(), squareKey()
    rng.ts                mulberry32 step: (state) => [value, nextState]
    config.ts             RuleConfig, CLASSIC, validateConfig()
    setup.ts              createGame(), validateSeats()
    occupancy.ts          occupants(state, square) derived from pawns
    throws.ts             throwShells(rngState) -> {throw, rngState}
    movement.ts           target(), squaresPassed(), effectiveNoHit()
    doubles.ts            reconcileDoubles(), isBlockedByDouble()
    legal.ts              legalMoves(), hasAnyLegalMove(), canEverMove()
    reducer.ts            applyAction() and phase transitions
    turn.ts               endTurn(), nextSeat(), startBonusSequence(), checkStalemate()
    invariants.ts         checkInvariants(prev, action, next) for simulations
    index.ts              public API
  bot/                    imports only src/engine
    weights.ts            tunable constants
    danger.ts             inReach(), hitProbability()
    easy.ts  medium.ts  hard.ts
    index.ts              chooseAction(state, seat) -> {action, botRngState}
  ui/                     React Native components (board, pawns, shells, chips, panels, screens)
  store/                  zustand game store, settings store, animation queue
  services/               persistence (MMKV/AsyncStorage), audio, haptics, a11y announcer
  i18n/                   i18next setup, en.json, hi.json
  config/app.json         app name, slug, scheme, bundle id (single source; read by app.config.ts)
  config/app.ts           typed re-export for app code
scripts/
  simulate.ts             bot-vs-bot simulation runner (tsx)
  audit-deps.ts           fails on banned network/analytics packages
.maestro/                 E2E flows
```

Libraries: expo-router, react-native-svg, react-native-reanimated, react-native-gesture-handler, zustand, react-native-mmkv (+ @react-native-async-storage/async-storage fallback), expo-audio, expo-haptics, expo-font, expo-localization, i18next + react-i18next, expo-dev-client. Test: Jest (jest-expo for app), @testing-library/react-native, Maestro. Lint: ESLint + `import/no-restricted-paths` zones.

## API & Data Impacts

No backend or network API. The internal contract is the engine API (REQ-11).

```ts
type SeatId = 'A' | 'B' | 'C' | 'D';
type Square = readonly [row: number, col: number];
type ThrowValue = 1 | 2 | 3 | 4 | 8;
type BotLevel = 'easy' | 'medium' | 'hard';

interface Throw { id: number; value: ThrowValue; shells: readonly [boolean, boolean, boolean, boolean]; bonus: boolean }
interface Pawn { id: string /* 'A0'..'D3' */; seat: SeatId; pathIndex: number | null; progress: number }
interface Seat { id: SeatId; kind: 'human' | 'bot' | 'empty'; name: string; color: string; botLevel?: BotLevel;
                 hasHit: boolean; finishedRank: number | null; prevTurnStart: number }
interface DoubleRec { owner: SeatId; square: Square; pawnIds: string[]; formedAtTurn: number }

interface GameState {
  id: string; schemaVersion: 1; createdAt: number;
  seats: readonly [Seat, Seat, Seat, Seat]; pawns: Pawn[]; ruleConfig: RuleConfig;
  rngState: number; botRngState: number;
  phase: 'throwing' | 'moving' | 'finished';
  currentSeat: SeatId; turnNumber: number; turnStartedAt: number;
  pool: Throw[]; nextThrowId: number;
  consecutiveChammaAshta: number; pendingBonusThrows: number;
  doubles: DoubleRec[]; stalemateBroken: boolean;
  rankings: SeatId[]; log: LogEntry[];
}

type Action =
  | { type: 'Throw' }
  | { type: 'Enter'; throwId: number }
  | { type: 'Move'; throwId: number; pawnId: string; together: boolean };

interface Move { action: Action; from: number | null; to: number; path: Square[]; hits: string[] }

type GameEvent =
  | { type: 'ThrowResolved'; seat: SeatId; throw: Throw }
  | { type: 'PawnEntered'; pawnId: string }
  | { type: 'PawnMoved'; pawnIds: string[]; squares: Square[] }
  | { type: 'PawnHit'; pawnId: string; by: SeatId }
  | { type: 'DoubleFormed' | 'DoubleBroken'; owner: SeatId; square: Square }
  | { type: 'PawnHome'; pawnId: string }
  | { type: 'InnerRingUnlocked'; seat: SeatId }
  | { type: 'PoolDiscarded'; seat: SeatId; throws: Throw[] }
  | { type: 'TurnForfeited'; seat: SeatId }
  | { type: 'StalemateBroken' }
  | { type: 'TurnPassed'; from: SeatId; to: SeatId }
  | { type: 'PlayerFinished'; seat: SeatId; rank: number }
  | { type: 'GameOver'; rankings: SeatId[] };

type EngineError = { type: 'NotYourTurn' | 'IllegalMove' | 'WrongPhase'; message: string };

createGame(seats, config, seed, id, createdAt): GameState
legalMoves(state): Move[]
applyAction(state, action): { state: GameState; events: GameEvent[] } | { error: EngineError }
pathFor(seat): Square[]
```

As built in M1 (`src/engine/types.ts` is authoritative): every action carries `seat` (so the engine can return NotYourTurn); `applyAction` returns `{ ok: true, state, events } | { ok: false, error }`; `Move` also has `value` and `pawnIds`; `GameState` also has `seed` and `inBonusSequence`; `PawnEntered` carries its square and `PoolDiscarded`/`TurnForfeited` carry the lost throws. The engine itself caps `log` at `LOG_LIMIT` (200), so persistence saves the state as is.

Persisted data (device only): key `game.v1` = JSON GameState with `log` capped to the last 200 entries; key `settings.v1` = theme, sound, haptics, animationSpeed, language.

## Sequence: one human turn

```mermaid
sequenceDiagram
  participant UI
  participant Store
  participant Engine
  participant Save
  UI->>Store: tap Throw
  Store->>Engine: applyAction(Throw)
  Engine-->>Store: state + [ThrowResolved]
  Store->>Save: persist(state)
  Store->>UI: enqueue shell animation
  Note over Engine: 4/8 keeps phase=throwing; 1/2/3 -> moving
  UI->>Store: select chip + pawn
  Store->>Engine: applyAction(Move)
  Engine-->>Store: state + [PawnMoved, PawnHit, InnerRingUnlocked, ...]
  Store->>Save: persist(state)
  Note over Engine: pool empty or unplayable -> PoolDiscarded / bonus sequence / TurnPassed
  Store->>UI: play events in order
```

Bots follow the same path: the store sees `currentSeat` is a bot, waits 600–1000 ms after animations drain, calls `chooseAction`, then `applyAction`.

## Design items

### DES-1 Board geometry and paths
`board.ts` holds `PATH_A` (25 squares from the PRD table), `rot(r,c) = [4 − c, r]`, `pathFor(seat)` (A=0, B=1, C=2, D=3 rotations, memoised), `SAFE_SQUARES`, `isSafe`, `ringOf(index)` (outer 0–15, inner 16–23, home 24). Coordinates are general enough to add 7x7 later by swapping the path table.
Covers: REQ-2

### DES-2 Seeded RNG and throws
`rng.ts`: mulberry32 as a pure step function on a uint32 state. `throws.ts`: four draws, `draw < 0.5` = mouth-up, value per R-THROW-02, assigns `nextThrowId`. Bot RNG is a second, independent mulberry32 state (`botRngState`) seeded from `seed ^ 0x9e3779b9`.
Covers: REQ-3, REQ-12

### DES-3 Game creation and seat validation
`createGame` validates 2–4 non-empty seats, ≥ 1 human, unique colours; creates 4 pawns per non-empty seat (`pathIndex` null or 0 per entryRule, `progress` 0); sets `currentSeat` to the first non-empty seat from A, `turnNumber` 1. Id and createdAt come from the caller. Player-count presets live in the UI (`src/ui/setup/presets.ts`), not the engine.
Covers: REQ-1, REQ-11

### DES-4 RuleConfig
`config.ts` defines the type, `CLASSIC`, and option metadata (keys, values, i18n keys for one-line explanations) used by the setup screen. Every rule branch in the engine reads `state.ruleConfig`; only `config.ts` may reference `CLASSIC`, checked by a small test that greps the other engine files.
Covers: REQ-9

### DES-5 Movement and legality
`movement.ts`: `target(state, pawn, n)` returns the target index or null:
- off-board pawn: only via Enter with 4/8 → 0.
- hitless player and effective noHit = block: null if `i + n > 15`.
- hitless player and effective noHit = circle (config, or `stalemateBroken`): if `i + n > 15`, wrap to `(i + n) mod 16`.
- otherwise null if `i + n > 24`.
`squaresPassed` lists squares strictly between from and to along the seat's path (with wrap). `legal.ts` builds candidates for each distinct pool value × each movable pawn (and each own double with `together`), then filters: landing on opponent double (single or double) → illegal; passing an outer-ring opponent double blocked by DES-7 → illegal. Equivalent moves (same throw value, same from-square, same together flag) are de-duplicated, keeping the lowest pawn id and lowest throw id.
Covers: REQ-5, REQ-11

### DES-6 Hits
In the reducer after a move: if the landing square is not safe and holds opponent pawns — exactly one opponent pawn, or (doubles off) any number of one opponent's pawns — each goes to `pathIndex 0`, `progress 0`; emit PawnHit per pawn; set mover `hasHit` (emit InnerRingUnlocked on first); `pendingBonusThrows += 1` once per move.
Covers: REQ-6

### DES-7 Doubles and blockOnce
`doubles.ts`:
- `reconcileDoubles(state)` after every move: group pawns by (seat, non-safe square) with count ≥ 2 (only when `doubles` on). Keep an existing `DoubleRec` if owner, square and pawn-id set are identical; otherwise create one with `formedAtTurn = turnNumber` (emit DoubleFormed) and drop stale ones (emit DoubleBroken).
- `isBlockedByDouble(state, mover, square)`: for an outer-ring opponent double on a passed square, with `doubleCrossing = blockOnce`, the move is blocked iff `mover.prevTurnStart < double.formedAtTurn`, i.e. the mover has not started a turn since the double formed, so the current turn is its first after formation. `free` never blocks. `endTurn` sets the outgoing seat's `prevTurnStart = turnStartedAt` before handing over.
Covers: REQ-7

### DES-8 Reducer and phase machine
`reducer.ts` validates `phase` and `currentSeat` (WrongPhase/NotYourTurn), and the action against `legalMoves` (IllegalMove). Flow:
- Throw (phase throwing): draw; push to pool; 4/8 → `consecutiveChammaAshta++`, and if it reaches 3 with triplePenalty on → emit TurnForfeited, clear pool and `pendingBonusThrows`, `endTurn`. 1/2/3 → phase moving, then `settle()`.
- Enter / Move (phase moving): apply, remove the throw, DES-6 hits, DES-7 reconcile, home check (PawnHome; bonusOnHome → `pendingBonusThrows++`); if the player finished → rank, emit PlayerFinished, discard rest (R-TURN-05), game-over check, `endTurn`. Else `settle()`.
- `settle()`: if pool is non-empty and some move is legal → stay. Else if pool non-empty → PoolDiscarded. Then if `pendingBonusThrows > 0` → decrement, `consecutiveChammaAshta = 0`, phase throwing. Else `endTurn`.
Input state is never mutated (structural copies; tests deep-freeze inputs).
Covers: REQ-4, REQ-8, REQ-11

### DES-9 Turn passing, ranking and stalemate
`turn.ts`: `endTurn` records `prevTurnStart`, picks the next non-empty, unfinished seat in A→B→C→D order, increments `turnNumber`, sets `turnStartedAt`, resets pool and counters, emits TurnPassed. Game over when one active seat remains with `playToEnd` (it gets last rank) or at the first finisher otherwise (2 players always end there). After each `endTurn`, `checkStalemate`: if `!stalemateBroken` and `canEverMove(seat, v)` is false for every unfinished seat and every v in {1,2,3,4,8} (blockOnce ignored) → `stalemateBroken = true`, emit StalemateBroken.
Covers: REQ-4, REQ-8

### DES-10 Invariant checker and simulation
`invariants.ts` checks after each action: pawn count per seat is 4; indices in range; no pawn on index > 15 for a hitless player under block (unless stalemateBroken); no two opponents' singles share a non-safe square; no opponent shares a non-safe square with a double; finished pawns never move; pool values valid; rankings unique. `scripts/simulate.ts` runs N seeded games (`--players 2|3|4 --config classic|random --games 10000`) with bot seats of mixed levels, fails on any invariant breach or > 2,000 turns, and prints game-length and stalemate stats.
Covers: REQ-21, REQ-4

### DES-11 Bots
`bot/index.ts` `chooseAction(state)`: throwing phase → Throw; moving phase → pick from `legalMoves` by level, return the action and the advanced `botRngState` (the store writes it back via a pure `withBotRng` helper so the throw RNG is untouched).
- Easy: if a hitting move exists, take it when `botRng < 0.5`; else uniform random legal move.
- Medium: score = weights from `weights.ts` per the PRD heuristic table; `danger.ts` computes, for the landing square, the chance an opponent can hit next turn by a single throw (odds from R-THROW-03, respecting their hit flag, safe squares and doubles).
- Hard: Medium score minus expected loss from the lookahead over every opponent's next throw; for pools of 2–3 throws it also searches throw orders (keeping the best 3 moves per step) and plays the first step of the best sequence. Constants in `src/bot/weights.ts`. Measured in Node: Medium ≈ 0.07 ms and Hard ≈ 0.11 ms per decision on average, worst under 10 ms.
- Tie-break: furthest pawn, then lowest pawn id.
- Performance: budget-checked with a micro-benchmark in tests (≤ 20 ms in Node as a proxy for the 200 ms device target); the store runs it after `InteractionManager.runAfterInteractions` so animation frames are not blocked.
Covers: REQ-10, REQ-12

### DES-12 App store and animation queue
`store/game.ts` (zustand): holds `state`, `selectedThrowId`, an `events` queue and `isAnimating`. `dispatch(action)` → engine → persist → append events. The board consumes events one by one (Reanimated) and marks them done; input for the current human is accepted as soon as the engine says the action is legal, never waiting on non-blocking animations (R-UX-05). Bot driver: a `useEffect` that, when `currentSeat` is a bot and the queue is drained, waits 600–1000 ms (from botRng) and dispatches. Fast speed halves durations; automatic Fast when no human is unfinished.
Covers: REQ-10, REQ-16, REQ-17

### DES-13 Persistence
`services/persistence.ts`: `saveGame(state)` serialises with the capped log to MMKV (fallback AsyncStorage if MMKV init throws), called after every dispatch; `loadGame()` validates `schemaVersion` and shape (a small hand-written guard), returns null + a reason on failure; `clearGame()` on Result. Settings in a separate key. Save timing logged in dev to verify < 50 ms.
Covers: REQ-13

### DES-14 Screens and navigation
expo-router stack: Home (Play, Resume if save, How to play, Settings) → Setup (presets 1–4, seat rows with kind/name/colour/level, rules preset + Custom toggles, Start; Replace-save dialog) → Game (board, waiting areas, shells, chips, banner, seat panels, Pause sheet: Resume, Restart same setup, Rules summary, Quit to Home) → Result (ranking, Play again with new seed, New game, Home). How to play: paged illustrated rules reading the active RuleConfig when opened from Game. Settings: theme, sound, haptics, speed, language, reset saved game. End now appears on Game when no human is unfinished.
Covers: REQ-15

### DES-15 Game screen components
`ui/board/Board.tsx` (SVG grid, X marks, theme), `Pawn.tsx` (shape per seat, count badge, a11y label), `WaitingArea.tsx`, `Shells.tsx`, `PoolChips.tsx`, `TurnBanner.tsx`, `SeatPanel.tsx`, `MoveOrBoth.tsx`, `Callout.tsx`. Selection logic lives in a pure hook `useMoveSelection(state, selectedThrowId)` returning highlighted pawns and previews from `legalMoves`, so it is unit-testable. Layout: phone = one shared throw area; tablet landscape = per-seat panels on each side, rotated 0/90/180/270°.
Covers: REQ-16, REQ-17

### DES-16 Themes, audio and haptics
`ui/theme/` exports three theme objects (board, grid, X mark, pawn colours, fonts) consumed via context from the settings store, so switching re-renders immediately. Pawn shapes per seat: circle, triangle, square, diamond. `services/audio.ts` preloads bundled sounds with expo-audio; `services/haptics.ts` wraps expo-haptics; both read settings toggles.
Covers: REQ-17

### DES-17 Accessibility
Every Pressable gets `accessibilityLabel` built from i18n templates (`a11y.pawn` = "{{color}} pawn {{n}}, square {{index}}, {{ring}}"). `services/announce.ts` maps ThrowResolved and TurnPassed events to `AccessibilityInfo.announceForAccessibility`. A shared `HitTarget` enforces 44 pt minimum. Theme tokens are checked by a unit test computing WCAG contrast ratios.
Covers: REQ-18

### DES-18 Localisation and app name
`src/config/app.json` holds the name (the Expo config loader cannot import TS modules); `app.config.ts` reads it for `name`, and `src/config/app.ts` re-exports `APP_NAME` for splash and title. i18next with `en.json`, `hi.json`, language from settings or `expo-localization`. ESLint rule `i18next/no-literal-string` on `src/ui` and `src/app`. Noto Sans Devanagari bundled as fallback font family in every theme.
Covers: REQ-19

### DES-19 Offline, permissions and privacy
`app.config.ts`: no expo-updates plugin; `android.blockedPermissions: ['android.permission.INTERNET']` applied only when `APP_VARIANT=release`; iOS privacy manifest via `ios.privacyManifests` declaring UserDefaults (CA92.1) and no tracking/collection. `scripts/audit-deps.ts` fails CI if any banned package (expo-updates, firebase, sentry, analytics, ads, axios-style HTTP clients) is in the dependency tree.
Covers: REQ-14

### DES-20 Tooling, CI and platforms
`tsconfig` strict; ESLint with import zones (`src/engine` → nothing outside; `src/bot` → engine only); Jest projects `engine`, `bot`, `app` with coverage thresholds 90% for engine and bot. npm scripts: `typecheck`, `lint`, `test`, `test:coverage`, `sim`, `audit:deps`, `e2e`. EAS build profiles `development`, `preview`, `release`. Debug seed hook: deep link `astha://debug/new?seed=N` registered only in development/preview builds, used by Maestro.
Covers: REQ-11, REQ-20, REQ-21

### DES-21 Test suites
- `src/engine/__tests__/`: one file per rule area (board, throws, entry, movement, hits, doubles, turns, winning, config, stalemate, purity, replay), named by R-id in test titles so coverage per rule is greppable.
- `src/bot/__tests__/`: determinism, tie-breaks, heuristic terms, Easy hit rate, benchmark.
- `src/services/__tests__/persistence.test.ts`: round-trip and corrupt/old save.
- `.maestro/`: `new-2p-turn.yaml`, `background-resume.yaml`, `scripted-to-result.yaml`.
- `docs/manual-test.md`: device checklist (airplane mode, VoiceOver/TalkBack, themes, Hindi, tablet layout, network inspector).
Covers: REQ-21, REQ-12, REQ-13

## Milestones

Dependency order; each ends green on typecheck, lint and tests.

1. **M0 Scaffold** — repo, Expo app, TS strict, lint zones, Jest projects, scripts (DES-20).
2. **M1 Engine core** — DES-1, 2, 3, 5, 6, 8, 9 on Classic rules; rule tests R-TEST-01..04.
3. **M2 House rules and bot** — DES-4, 7 (full), 10, 11; simulation, replay (R-TEST-05, 06).
4. **M3 Playable app** — DES-12, 13, 14, 15 (basic visuals), persistence and resume.
5. **M4 Polish** — DES-15 (tablet), 16, 17, 18; animations, sound, haptics, How to play, Hindi.
6. **M5 Release** — DES-19, 21 (Maestro, manual pass), store listings, privacy labels, beta.

Engine work (M1–M2) needs no Expo, so it can start before M0's app scaffold is final.

## Risks

- **Stalemate fallback untested in practice.** The `circle` switch is new; simulations (DES-10) report how often it fires and game lengths. If games still exceed 2,000 turns, revisit the rule.
- **blockOnce semantics** are our interpretation (first turn after formation). Easy to change in one function if play-testing disagrees.
- **Long early game.** With needChammaOrAshta + block, players wait ~8 turns for a first entry and may lose throws often. Simulation stats will show average length; UI auto-discards so dead turns cost one animation, not a tap.
- **MMKV needs a dev build** and runs synchronously on the JS thread; capped log keeps it small. If saves exceed 50 ms, move to snapshot-diffs.
- **Expo SDK iOS floor** may exceed iOS 15 (OQ-4).
- **Bot timing on low-end Android.** Hard's order search is capped at pools of 2–3 throws with a beam of 3; larger pools fall back to greedy. Node timings are far under budget; confirm on device in M5.
- **Font coverage.** Chalk-style display fonts likely lack Devanagari; fallback font keeps Hindi readable but less themed.
- **Tablet per-seat layout** is a "should"; it is scheduled last in M4 and can slip to v1.1 without breaking any AC.

## Open Questions

Same as requirements.md OQ-1..OQ-5, with proposed answers there.
