# Ashta Chamma v1 — Tasks

Companion to [requirements.md](requirements.md) and [design.md](design.md). Tick tasks as they finish. Each milestone ends with the gate commands in Verification passing.

## M0 Scaffold

- [x] TASK-1: Initialise git repo, `.gitignore` (including `.claude/work/`), README stub
  Links: DES-20 | REQ-20
  Outcome: `git status` clean on an initial commit. (Repo initialised; first commit waits for your go-ahead.)
- [x] TASK-2: Create Expo app (TypeScript, expo-router) with expo-dev-client and EAS profiles development/preview/release
  Links: DES-20 | REQ-20
  Outcome: development build launches to a placeholder Home on Android emulator and iOS simulator. (Verified by expo-doctor 20/20 and an Android JS bundle export; no Xcode or Android SDK on this Mac, so not launched yet.)
- [x] TASK-3: Enable TS strict and create `src/engine`, `src/bot`, `src/ui`, `src/store`, `src/services`, `src/i18n`, `src/config`, `scripts` folders
  Links: DES-20 | REQ-11
  Outcome: `npm run typecheck` passes.
- [x] TASK-4: ESLint config with `import/no-restricted-paths` zones (engine imports nothing outside; bot imports engine only) and no React/RN/Expo imports in engine/bot
  Links: DES-20 | REQ-11
  Outcome: a deliberate bad import in a scratch file fails `npm run lint`.
- [x] TASK-5: Jest projects `engine`, `bot`, `app` (jest-expo) with 90% line thresholds on engine and bot; scripts `test`, `test:coverage`
  Links: DES-20, DES-21 | REQ-21
  Outcome: `npm test` runs an empty smoke test in each project.
- [x] TASK-6: Add `scripts/audit-deps.ts` and `npm run audit:deps` banning network, analytics, ads, crash and expo-updates packages
  Links: DES-19 | REQ-14
  Outcome: script passes on the scaffold and fails when a banned package is added.

## M1 Engine core

- [x] TASK-7: `engine/types.ts` with all types from design (SeatId, Square, Throw, Pawn, Seat, DoubleRec, GameState, Action, Move, GameEvent, EngineError)
  Links: DES-3, DES-8 | REQ-11
  Outcome: types compile; no runtime code.
- [x] TASK-8: `engine/board.ts` — PATH_A, rot, pathFor, SAFE_SQUARES, isSafe, ringOf
  Links: DES-1 | REQ-2
  Outcome: R-TEST-02 path tests pass for all four seats.
- [x] TASK-9: `engine/rng.ts` mulberry32 step function
  Links: DES-2 | REQ-12
  Outcome: fixed seed yields a fixed known sequence (snapshot test).
- [x] TASK-10: `engine/throws.ts` four-shell throw with ids and faces
  Links: DES-2 | REQ-3
  Outcome: R-TEST-03 distribution test passes (160,000 throws, ±1 pp).
- [x] TASK-11: `engine/config.ts` RuleConfig type, CLASSIC, option metadata
  Links: DES-4 | REQ-9
  Outcome: CLASSIC matches the PRD defaults table (test).
- [x] TASK-12: `engine/setup.ts` createGame + validateSeats (2–4 non-empty, ≥ 1 human, unique colours, pawns per entryRule)
  Links: DES-3 | REQ-1, REQ-5
  Outcome: tests for valid/invalid seat sets, empty seats have no pawns, onStart vs needChammaOrAshta start positions.
- [x] TASK-13: `engine/occupancy.ts` derived occupants per square
  Links: DES-5 | REQ-11
  Outcome: unit tests; no occupancy field exists in GameState.
- [x] TASK-14: `engine/movement.ts` target() and squaresPassed() for block, circle wrap and exact-count home
  Links: DES-5 | REQ-5
  Outcome: tests: overshoot past 24 illegal, hitless stop at 15 (block), wrap mod 16 (circle), hitter enters inner ring.
- [x] TASK-15: `engine/legal.ts` legalMoves for Enter and single-pawn Move with landing-on-opponent-double rule and de-duplication
  Links: DES-5 | REQ-5, REQ-11
  Outcome: tests: enter only with 4/8, one pawn per entry, equivalent moves listed once.
- [x] TASK-16: Hits in the reducer: single-opponent hit, return to index 0, hasHit, InnerRingUnlocked, one bonus per hitting move
  Links: DES-6 | REQ-6
  Outcome: tests: hit on outer and inner ring, no hit on safe square or home, hit pawn moves again with any throw.
- [x] TASK-17: `engine/reducer.ts` Throw handling: pool, chaining on 4/8, triple penalty clearing pool and queued bonuses
  Links: DES-8 | REQ-4
  Outcome: tests for chaining, phase switch on 1/2/3, triple penalty in first and bonus sequences (R-TURN-04).
- [x] TASK-18: Reducer Enter/Move handling and `settle()` (discard only when nothing playable, bonus sequences, PoolDiscarded)
  Links: DES-8 | REQ-4
  Outcome: tests: deferred-playable throw kept (4 enters then 3 moves), pool auto-discarded with event, bonus taken after pool.
- [x] TASK-19: Reducer validation and typed errors (NotYourTurn, WrongPhase, IllegalMove) with no state change
  Links: DES-8 | REQ-11
  Outcome: tests for each error; input deep-frozen in all reducer tests.
- [x] TASK-20: `engine/turn.ts` endTurn, nextSeat skipping empty/finished, prevTurnStart, TurnPassed
  Links: DES-9 | REQ-4, REQ-1
  Outcome: tests for 2-, 3- and 4-seat rotations with empty seats.
- [x] TASK-21: Finishing and ranking: PawnHome, PlayerFinished, R-TURN-05 discard, playToEnd on/off, 2-player end, GameOver
  Links: DES-8, DES-9 | REQ-8, REQ-4
  Outcome: tests for each case, last remaining seat gets last rank.
- [x] TASK-22: Stalemate detection (canEverMove over {1,2,3,4,8}) and circle fallback for hitless players
  Links: DES-9, DES-5 | REQ-4
  Outcome: scenario test with all pawns stuck at 15 emits StalemateBroken and then allows wrap.
- [x] TASK-23: `engine/index.ts` public API (createGame, legalMoves, applyAction, pathFor) and API surface test
  Links: DES-8 | REQ-11
  Outcome: app/bot import only from `src/engine/index.ts`.
- [x] TASK-24: Purity and no-ambient-access test (deep-freeze, Date/Math.random spied and never called)
  Links: DES-8 | REQ-11, REQ-12
  Outcome: test passes across a scripted game.

## M2 House rules and bot

- [x] TASK-25: `engine/doubles.ts` reconcileDoubles with formedAtTurn, DoubleFormed/DoubleBroken
  Links: DES-7 | REQ-7
  Outcome: tests: double forms, third pawn joining creates a new record, breaking ends it.
- [x] TASK-26: Doubles in legalMoves: move-together (`together`), double hits single, double may not land on double
  Links: DES-7, DES-5 | REQ-7
  Outcome: scenario tests for each.
- [x] TASK-27: blockOnce passing rule via prevTurnStart vs formedAtTurn; `free` option; inner-ring doubles never block passing
  Links: DES-7 | REQ-7, REQ-9
  Outcome: test: opponent blocked on its first turn after formation, passes on the next; inner-ring double passable not landable.
- [x] TASK-28: doubles off: shared squares, no move-together, multi-pawn hit for one bonus
  Links: DES-6, DES-7 | REQ-6, REQ-9
  Outcome: scenario test passes.
- [x] TASK-29: bonusOnHome, triplePenalty off, entryRule onStart, noHitBehavior circle option tests (one per option value)
  Links: DES-4 | REQ-9
  Outcome: every RuleConfig value has at least one test asserting its behaviour (AC-10 at engine level).
- [x] TASK-30: `engine/invariants.ts` checkInvariants
  Links: DES-10 | REQ-21
  Outcome: unit tests where corrupted states are caught.
- [x] TASK-31: Replay test: seed + action log reproduces identical final state
  Links: DES-2, DES-21 | REQ-12
  Outcome: R-TEST-06 passes for 100 random seeds.
- [x] TASK-32: `bot/weights.ts` and `bot/danger.ts` (inReach, single-throw hit probability with odds, hit flag, safe squares, doubles)
  Links: DES-11 | REQ-10
  Outcome: unit tests on hand-built boards.
- [x] TASK-33: Easy bot (random legal move, takes a hit with 50% chance via botRng)
  Links: DES-11 | REQ-10
  Outcome: over 10,000 decisions with a hit available, hit rate is 50% ± 2 pp.
- [x] TASK-34: Medium bot heuristic and tie-breaks
  Links: DES-11 | REQ-10
  Outcome: tests per heuristic term and both tie-break rules.
- [x] TASK-35: Hard bot lookahead and pool-order search (pools ≤ 4)
  Links: DES-11 | REQ-10
  Outcome: Hard beats Medium in > 55% of 2,000 seeded 2-player games (sanity, not a hard gate). (Open: Hard wins 53.0% ± 1.8 on 3,000 games. Tuning tried 2026-10-31: a position-evaluation Hard with full pool search scored 33–49%; single-weight sweeps of the Medium table moved results only within noise. Accepted at ~53% by the user, 2026-10-31.)
- [x] TASK-36: `bot/index.ts` chooseAction with botRngState threading; determinism test; benchmark ≤ 20 ms per decision in Node
  Links: DES-11 | REQ-10, REQ-12
  Outcome: same state gives same action; benchmark test passes.
- [x] TASK-37: `scripts/simulate.ts` and `npm run sim` (players 2/3/4 × Classic, plus random configs, mixed levels, invariants, 2,000-turn cap, stats)
  Links: DES-10 | REQ-21, REQ-4
  Outcome: 10,000 games per configuration pass; stats report average turns and stalemate count (AC-13).
- [x] TASK-38: Coverage gate at 90% for engine and bot; per-rule test checklist (grep R-ids in test titles against PRD list)
  Links: DES-21 | REQ-21
  Outcome: `npm run test:coverage` passes; checklist script reports every R-id in sections 3–4 covered.

## M3 Playable app

- [ ] TASK-39: `store/game.ts` zustand store: dispatch → engine → persist → event queue, selection state
  Links: DES-12 | REQ-16
  Outcome: store unit tests with a fake persistence service.
- [ ] TASK-40: Bot driver effect (delay 600–1000 ms from botRng, runs after interactions, writes botRngState back)
  Links: DES-12, DES-11 | REQ-10
  Outcome: a 1-human + 1-bot game in a store test advances bot turns without input.
- [ ] TASK-41: `services/persistence.ts` MMKV with AsyncStorage fallback, capped log, schemaVersion guard, clear on Result
  Links: DES-13 | REQ-13
  Outcome: R-TEST-07 round-trip passes; corrupt and old saves return null with a reason.
- [ ] TASK-42: Settings store persisted separately (theme, sound, haptics, speed, language)
  Links: DES-13 | REQ-13, REQ-17
  Outcome: settings survive relaunch independently of the game slot.
- [ ] TASK-43: Home screen (Play, Resume when a save exists, How to play, Settings)
  Links: DES-14 | REQ-15, REQ-13
  Outcome: Resume appears only with a valid save.
- [ ] TASK-44: Setup screen: presets 1–4, seat rows (kind, name, colour, bot level), validation messages, Classic/Custom rules with explanations, Replace-save dialog
  Links: DES-14, DES-3, DES-4 | REQ-1, REQ-9, REQ-15
  Outcome: component tests: default names Player 1–4, duplicate colour rejected, Start disabled without a human.
- [ ] TASK-45: Board, pawns and waiting areas (SVG, X marks, basic theme, count badges)
  Links: DES-15 | REQ-16, REQ-17
  Outcome: renders any GameState; snapshot tests for start and mid-game states.
- [ ] TASK-46: Shells, throw button, pool chips (pre-select single value), turn banner, seat panels (name, pawns home, hit flag)
  Links: DES-15 | REQ-16
  Outcome: component tests for chip pre-selection and banner content.
- [ ] TASK-47: `useMoveSelection` hook (chip-first or pawn-first, highlights, destination preview, entry via waiting area) and Move one / Move both prompt
  Links: DES-15 | REQ-16
  Outcome: hook unit tests on engine fixtures; only legal pawns highlighted.
- [ ] TASK-48: Pause menu (Resume, Restart same setup, Rules summary, Quit to Home) and Result screen (ranking, Play again with new seed, New game, Home)
  Links: DES-14 | REQ-15
  Outcome: flows reachable; Quit keeps the save, Result clears it.
- [ ] TASK-49: End now when no human is unfinished (rank bots by progress, go to Result)
  Links: DES-14 | REQ-15
  Outcome: store test with 1 human finished vs 3 bots shows End now and produces a full ranking.
- [ ] TASK-50: Debug seed deep link in development/preview builds
  Links: DES-20 | REQ-21
  Outcome: `astha://debug/new?seed=42` starts a deterministic game; absent in release config.

## M4 Polish

- [ ] TASK-51: Event-driven animations: square-by-square moves, hit knock-back, shell roll ~700 ms, Normal/Fast, auto-Fast for bot-only play
  Links: DES-12, DES-15 | REQ-16, REQ-17
  Outcome: animations follow the event queue; input for the next legal action is never blocked.
- [ ] TASK-52: Callouts (Chamma, Ashta, Hit! Bonus throw, Inner ring unlocked, No legal move, Turn forfeited)
  Links: DES-15 | REQ-16
  Outcome: each engine event shows its callout (component test per event).
- [ ] TASK-53: Three themes (chalk default, wooden, modern flat) with live switching; per-seat pawn shapes
  Links: DES-16 | REQ-17
  Outcome: switching in Settings mid-game re-renders immediately (AC-16).
- [ ] TASK-54: Sound effects and haptics services with settings toggles
  Links: DES-16 | REQ-17
  Outcome: toggling off silences sound/haptics (service tests with mocks).
- [ ] TASK-55: Tablet landscape layout with per-seat panels and throw buttons rotated toward each player
  Links: DES-15 | REQ-16
  Outcome: manual check on a tablet; phone layout unchanged.
- [ ] TASK-56: Accessibility labels, screen-reader announcements, 44 pt targets, 150% font scaling
  Links: DES-17 | REQ-18
  Outcome: tests assert labels on every pressable; manual VoiceOver/TalkBack full turn (AC-14).
- [ ] TASK-57: Contrast test for all theme tokens (WCAG AA 4.5:1)
  Links: DES-17 | REQ-18
  Outcome: unit test passes for all three themes.
- [ ] TASK-58: i18next setup, en.json, hi.json, literal-string lint rule, Devanagari fallback font
  Links: DES-18 | REQ-19
  Outcome: lint finds no literal strings in `src/app` and `src/ui`; Hindi renders in all themes.
- [ ] TASK-59: `src/config/app.ts` APP_NAME wired into app.config.ts, splash and in-app title
  Links: DES-18 | REQ-19
  Outcome: changing APP_NAME and rebuilding updates all in-app occurrences (AC-17).
- [ ] TASK-60: How to play pages (board, throws, moving, hits, doubles, winning) reflecting active RuleConfig and listing regional names
  Links: DES-14 | REQ-15, REQ-19
  Outcome: opened from a Custom game, pages show that game's toggles.
- [ ] TASK-61: Settings screen (theme, sound, haptics, speed, language, reset saved game)
  Links: DES-14, DES-16 | REQ-15, REQ-17
  Outcome: each control persists and takes effect.

## M5 Release

- [ ] TASK-62: Release config: no expo-updates, INTERNET blocked for release, iOS privacy manifest, permissions audit of built manifests
  Links: DES-19 | REQ-14
  Outcome: release APK manifest has no INTERNET; IPA has the privacy manifest.
- [ ] TASK-63: Maestro flows: new 2-player game + one turn, background and resume, scripted seed game to Result
  Links: DES-21 | REQ-21, REQ-13, REQ-16
  Outcome: `npm run e2e` passes on Android emulator and iOS simulator.
- [ ] TASK-64: Performance pass: cold start < 2 s, 60 fps animations, save < 50 ms, bot < 200 ms on a mid-range 2022 Android, install < 40 MB
  Links: DES-11, DES-13, DES-20 | REQ-20, REQ-10, REQ-13, REQ-17
  Outcome: measurements recorded in `docs/perf.md`.
- [ ] TASK-65: Confirm Expo SDK iOS floor and record it (OQ-4)
  Links: DES-20 | REQ-20
  Outcome: decision recorded in state.md; app.config deploymentTarget set.
- [ ] TASK-66: `docs/manual-test.md` checklist and pass on a small Android phone, an iPhone and a tablet in airplane mode, with a network inspector run
  Links: DES-21 | REQ-21, REQ-14
  Outcome: checklist completed for AC-01..AC-17; zero requests observed (AC-12).
- [ ] TASK-67: Store listings, "No data collected" privacy labels, beta builds (TestFlight, Play internal testing)
  Links: DES-19 | REQ-14, REQ-20
  Outcome: beta live; crash-free sessions tracked from store consoles (no in-app reporter).

## Verification

Gate commands (every milestone):

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm run test:coverage
```

```bash
npm run audit:deps
```

M2 onward also `npm run sim`; M5 also `npm run e2e`.

One check per REQ:

| REQ | Check | Task |
|---|---|---|
| REQ-1 | Setup validation tests + AC-02/04/15 manual | TASK-12, TASK-44, TASK-66 |
| REQ-2 | Path tests R-TEST-02 | TASK-8 |
| REQ-3 | Distribution test R-TEST-03 (AC-05) | TASK-10 |
| REQ-4 | Turn, triple, discard, stalemate scenarios (AC-09) | TASK-17, TASK-18, TASK-22 |
| REQ-5 | Entry, block, exact-count tests (AC-06, AC-07) | TASK-14, TASK-15 |
| REQ-6 | Hit scenarios (AC-08) | TASK-16, TASK-28 |
| REQ-7 | Doubles and blockOnce scenarios | TASK-25, TASK-26, TASK-27 |
| REQ-8 | Finishing and ranking tests | TASK-21 |
| REQ-9 | One test per config value (AC-10) | TASK-29 |
| REQ-10 | Bot determinism, levels, benchmark; AC-03 end-to-end | TASK-33..36, TASK-40, TASK-64 |
| REQ-11 | Lint zones, purity test, API surface test | TASK-4, TASK-23, TASK-24 |
| REQ-12 | Replay test R-TEST-06 | TASK-31 |
| REQ-13 | Persistence round-trip R-TEST-07; kill-relaunch (AC-11) | TASK-41, TASK-63, TASK-66 |
| REQ-14 | Dependency audit, release manifest check, network inspector (AC-12) | TASK-6, TASK-62, TASK-66 |
| REQ-15 | Screen flows via Maestro and manual | TASK-43, TASK-48, TASK-63 |
| REQ-16 | Selection hook tests; 4-player manual game (AC-01) | TASK-47, TASK-66 |
| REQ-17 | Theme switch (AC-16), perf pass | TASK-53, TASK-64 |
| REQ-18 | Label tests, contrast test, screen-reader turn (AC-14) | TASK-56, TASK-57 |
| REQ-19 | Literal-string lint, APP_NAME rename (AC-17) | TASK-58, TASK-59 |
| REQ-20 | Perf measurements, iOS floor decision | TASK-64, TASK-65 |
| REQ-21 | Coverage gate, simulations (AC-13), Maestro, manual pass | TASK-37, TASK-38, TASK-63, TASK-66 |
