# Ashta Chamma v1 — Requirements

Source: [PRD](https://claude.ai/artifact/HhbJP3jvt6Be1eW6CPVdHG) (rev 290). `R-*` ids are the PRD's; `AC-*` are its acceptance criteria. Each REQ below groups PRD requirements and states them as testable EARS criteria.

## Summary

"Astha Chopa" is an offline mobile game of Ashta Chamma for 1–4 people sharing one phone or tablet, with bot opponents. A pure TypeScript engine owns every rule; a React Native + Expo app renders engine state and sends player actions.

## Problem

There is no faithful, offline, ad-free digital Ashta Chamma that handles the real cowrie odds, the hit-to-enter rule, doubles and regional house rules, and that families can play on one device without accounts or internet.

## Goals

- Rule-correct 5x5 game with real cowrie odds and the Classic rule set, plus seven house-rule toggles.
- 2–4 seats in any mix of humans and bots, at least one human; pass-and-play.
- Easy, Medium and Hard bots that use the same engine API as humans.
- Deterministic, replayable engine with ≥ 90% line coverage and 10,000-game simulations per player count.
- Zero network use, no data collected, Android 8.0+ and iOS 15+.

## Non-Goals

- Online, Bluetooth or Wi-Fi multiplayer; accounts, cloud save, leaderboards, chat.
- Ads, in-app purchases, analytics, crash reporters.
- 7x7 boards and the 8-cowrie variant (engine must not preclude them).
- Undo, reviving dead pawns, Teams mode.
- Languages beyond English and Hindi.

## Requirements

### REQ-1 Seats and game setup
As a group of players, I want to choose who sits where (human, bot or empty) so we can play with 1–4 people.
PRD: R-SEAT-01..04, R-MODE-01..04. AC: AC-02, AC-04, AC-15.

- THE SYSTEM SHALL model exactly four seats A–D (bottom, right, top, left) with default colours red, green, yellow, blue, each with kind human | bot | empty, a name, a colour and, for bots, a level.
- WHEN the user picks a quick preset of 1, 2, 3 or 4 humans THE SYSTEM SHALL pre-fill seats as in the PRD player-count table (1: A human, C bot Medium; 2: A, C human; 3: A, B, C human; 4: all human).
- THE SYSTEM SHALL let the user set any seat to human, bot or empty after applying a preset.
- IF fewer than 2 non-empty seats or no human seat are configured THEN THE SYSTEM SHALL disable Start and say why.
- IF two seats share a colour THEN THE SYSTEM SHALL reject the change.
- THE SYSTEM SHALL default seat names to "Player 1"…"Player 4" for A–D and allow all four to be edited before Start.
- WHEN a game has started THE SYSTEM SHALL keep seat settings unchanged for the rest of that game.
- WHILE a seat is empty THE SYSTEM SHALL skip it in turn order, give it no pawns, and keep its start square safe.

Verification: engine setup tests; setup-screen component tests; AC-02, AC-04, AC-15 manual checks.

### REQ-2 Board and paths
As a player, I want each seat's pawns to follow the traditional path so the game matches the real board.
PRD: R-BOARD-01..03, R-PATH-01..03.

- THE SYSTEM SHALL address squares as (row, col), (0,0) top-left, and mark (4,2), (2,4), (0,2), (2,0) and (2,2) as safe.
- THE SYSTEM SHALL define seat A's path as the 25 squares in the PRD table and derive B, C, D by rotating with rot(r, c) = (4 − c, r) once, twice and three times.
- `pathFor(seat)` SHALL return 25 unique squares starting on that seat's start square, reaching the other three start squares at indices 4, 8 and 12, and ending at (2, 2).

Verification: R-TEST-02 path tests.

### REQ-3 Cowrie throws
As a player, I want throws that behave like real cowrie shells.
PRD: R-THROW-01..04, R-RNG-01. AC: AC-05.

- WHEN a Throw action is applied THE SYSTEM SHALL draw four shells from the game's seeded PRNG, each mouth-up with probability 0.5.
- THE SYSTEM SHALL score 1–3 mouth-up as 1–3, 4 mouth-up as 4 (Chamma) and 0 mouth-up as 8 (Ashta).
- THE SYSTEM SHALL record each shell's face on the throw so the UI can show it.

Verification: R-TEST-03 distribution test (160,000 throws within 1 percentage point of 4/16, 6/16, 4/16, 1/16, 1/16).

### REQ-4 Turn structure, pool and bonus throws
As a player, I want to throw until I get a 1, 2 or 3 and then spend the pool as I choose.
PRD: R-THROW-05, R-THROW-06, R-TURN-01..06. AC: AC-09.

- WHEN a 4 or 8 is thrown THE SYSTEM SHALL keep the turn in the throwing phase; WHEN a 1, 2 or 3 is thrown THE SYSTEM SHALL move to the moving phase.
- IF `triplePenalty` is on AND three 4/8 throws occur in a row within one throw sequence THEN THE SYSTEM SHALL discard the pool and all queued bonus sequences, emit TurnForfeited and end the turn (R-TURN-04).
- THE SYSTEM SHALL let the player spend pool throws in any order, each whole on one pawn or one double.
- WHEN no throw left in the pool has a legal move THE SYSTEM SHALL discard the remaining pool without a player action and emit PoolDiscarded; it SHALL NOT discard a throw while any throw in the pool is playable.
- WHEN a move hits THE SYSTEM SHALL queue one bonus throw sequence per hitting move, taken after the pool is spent, with the same chaining and penalty rules.
- WHEN a player's last pawn reaches home THE SYSTEM SHALL discard any remaining pool and queued bonuses and pass the turn (R-TURN-05).
- WHEN a turn ends THE SYSTEM SHALL pass to the next seat in A→B→C→D order, skipping empty and finished seats.
- IF no unfinished seat has a legal move for any single throw value (ignoring blockOnce one-turn blocks) THEN THE SYSTEM SHALL emit StalemateBroken and from then on apply `circle` behaviour to every player without a hit (R-TURN-06).

Verification: scenario tests (triple penalty, bonus after hit, deferred-playable throw, stalemate); simulation invariants.

### REQ-5 Entry and legal movement
As a player, I want the game to allow only legal moves.
PRD: R-PATH-04, R-MOVE-01..05. AC: AC-06, AC-07.

- WHERE `entryRule` is `needChammaOrAshta` THE SYSTEM SHALL start all pawns off the board and let a 4 or 8 place exactly one waiting pawn on index 0.
- WHERE `entryRule` is `onStart` THE SYSTEM SHALL start all pawns on index 0.
- THE SYSTEM SHALL reject any move whose target index exceeds 24.
- WHERE `noHitBehavior` is `block` THE SYSTEM SHALL reject moves past index 15 for a player who has not hit; WHERE it is `circle` the pawn SHALL wrap around the outer ring.
- WHEN a player makes their first hit THE SYSTEM SHALL let all of their pawns enter the inner ring for the rest of the game.
- THE SYSTEM SHALL reject a single pawn landing on a non-safe square holding an opponent's double, on either ring.
- THE SYSTEM SHALL allow any number of pawns of any players on a safe square.

Verification: scenario tests (exact-count home, no-hit block at 15, circle wrap, entering with 4/8, landing on opponent double).

### REQ-6 Hits
As a player, I want to send opponents back by landing on them.
PRD: R-HIT-01..04. AC: AC-08.

- WHEN a pawn or double ends a move on a non-safe square holding exactly one opponent pawn THE SYSTEM SHALL return that pawn to its start square (index 0, on the board), set the mover's hit flag and queue a bonus sequence.
- WHERE `doubles` is off, WHEN a move lands on a non-safe square holding several of one opponent's pawns THE SYSTEM SHALL hit all of them for one bonus sequence.
- THE SYSTEM SHALL judge hits only on the landing square and never on safe squares or home.
- WHEN a hit pawn later moves THE SYSTEM SHALL allow it to move with any throw.

Verification: scenario tests (hit on outer and inner ring, no hit on safe square, hit pawn restart, doubles-off multi-hit).

### REQ-7 Doubles
As a player, I want to stack pawns into doubles that protect and block.
PRD: R-DBL-01..05, R-CFG-04.

- WHERE `doubles` is on, THE SYSTEM SHALL treat two or more of one player's pawns on one non-safe square as a double, recording owner, square, pawn ids and formedAtTurn.
- WHEN a double's pawns or square change THE SYSTEM SHALL end it and record any remaining stack as a new double.
- THE SYSTEM SHALL let the owner move one pawn out of a double, or two pawns together with one throw, landing as a double.
- WHERE `doubleCrossing` is `blockOnce`, THE SYSTEM SHALL reject an opponent's move that passes an outer-ring double during that opponent's first turn starting after the double formed, and allow it from the next turn.
- THE SYSTEM SHALL never block passing for inner-ring doubles, and SHALL reject any double landing on an opponent's double.

Verification: scenario tests (block once then pass, double hits single, move both, inner-ring double passable but not landable).

### REQ-8 Finishing and ranking
As players, we want the game to end with a clear ranking.
PRD: R-WIN-01..03.

- WHEN a pawn reaches index 24 THE SYSTEM SHALL mark it finished and never move or hit it again.
- WHEN all four of a player's pawns are home THE SYSTEM SHALL assign that player the next rank.
- WHERE `playToEnd` is on with 3–4 players THE SYSTEM SHALL continue until one player remains, who takes last place; otherwise THE SYSTEM SHALL end the game at the first finisher.

Verification: scenario tests; simulation (every game finishes with a full ranking).

### REQ-9 House rules
As players from different regions, we want our rules.
PRD: R-CFG-01..03, section 4 table. AC: AC-10.

- THE SYSTEM SHALL take all rule variation from one `RuleConfig` (entryRule, noHitBehavior, triplePenalty, doubles, doubleCrossing, bonusOnHome, playToEnd) fixed at `createGame`.
- THE SYSTEM SHALL offer a Classic preset (needChammaOrAshta, block, on, on, blockOnce, off, on) and a Custom option revealing each toggle with a one-line explanation.
- WHEN `bonusOnHome` is on AND a pawn reaches home THE SYSTEM SHALL queue a bonus sequence.
- THE SYSTEM SHALL save the RuleConfig with the game and keep it unchanged once started.

Verification: one scenario test per option value; random-config simulations.

### REQ-10 Bot opponents
As a solo player, I want bots at three strengths.
PRD: R-BOT-01..06, section 5. AC: AC-03.

- THE SYSTEM SHALL choose bot actions only from `legalMoves()` using a bot-owned seeded PRNG that never touches the throw PRNG.
- WHEN it is a bot's turn THE SYSTEM SHALL throw and move automatically, waiting 600–1000 ms per action and animating like a human move.
- THE SYSTEM SHALL implement Easy (random legal move, takes an available hit 50% of the time), Medium (PRD heuristic, tunable weights) and Hard (Medium plus throw-odds-weighted one-turn danger lookahead, optionally searching pool orders).
- THE SYSTEM SHALL break ties by furthest-along pawn, then lowest pawn id.
- THE SYSTEM SHALL return a bot decision within 200 ms on a mid-range 2022 Android phone without blocking the UI thread, and the same state and bot seed SHALL give the same decision.

Verification: bot unit tests (determinism, tie-breaks, heuristic terms); timing benchmark; AC-03 end-to-end.

### REQ-11 Engine architecture and API
As a developer, I want the rules in one pure, typed module.
PRD: R-TECH-01..05, sections 8.2–8.3.

- THE SYSTEM SHALL implement the engine and bot in strict TypeScript with no React, React Native, Expo or platform imports, enforced by lint.
- THE SYSTEM SHALL expose `createGame(seats, config, seed, id, createdAt)`, `legalMoves(state)`, `applyAction(state, action)` and `pathFor(seat)`.
- `applyAction` SHALL return a new state and an ordered event list, never mutate its input, and never read the clock, storage or global randomness.
- IF an action is not allowed THEN `applyAction` SHALL return a typed error (NotYourTurn, IllegalMove, WrongPhase) and leave state unchanged.
- THE SYSTEM SHALL support actions Throw, Enter(throwId) and Move(throwId, pawnId, together), give every pool throw an id, and de-duplicate equivalent moves in `legalMoves`.
- THE SYSTEM SHALL derive square occupancy from pawn positions, never store it.
- THE SYSTEM SHALL drive all UI animation from engine events, never from state diffs.

Verification: lint boundary rule; purity test (frozen input); API type tests.

### REQ-12 Determinism and replay
PRD: R-RNG-01..03, R-TEST-06.

- THE SYSTEM SHALL keep throw PRNG state and bot PRNG state inside the game state.
- WHEN the same seed and action log are replayed THE SYSTEM SHALL produce an identical final state.
- THE SYSTEM MAY show the seed on a debug screen.

Verification: R-TEST-06 replay test.

### REQ-13 Persistence and resume
PRD: R-SAVE-01..04, flows "Resume" and "Quit mid-game". AC: AC-11.

- WHEN an action is applied THE SYSTEM SHALL save the full game state locally (MMKV, AsyncStorage fallback) within 50 ms, with the log capped.
- WHEN the app relaunches with a saved game THE SYSTEM SHALL show Resume on Home and restore the exact state, losing at most an in-progress animation.
- THE SYSTEM SHALL keep one game slot and store settings separately.
- IF a save is unreadable or has an old schemaVersion THEN THE SYSTEM SHALL discard it with a friendly message and not crash.
- WHEN the user starts a new game while a save exists THE SYSTEM SHALL ask "Replace your saved game?".
- WHEN a game reaches the Result screen THE SYSTEM SHALL clear the save.

Verification: R-TEST-07 round-trip test; kill-and-relaunch manual test; Maestro background/resume flow.

### REQ-14 Offline and privacy
PRD: R-LOCAL-02, R-NET-01..03, NFR permissions. AC: AC-12.

- THE SYSTEM SHALL make zero network requests and work in airplane mode from first launch.
- THE SYSTEM SHALL bundle all fonts, sounds and images and include no network, analytics, crash-reporting, ad or update (expo-updates) libraries.
- THE SYSTEM SHALL ship Android release builds without the INTERNET permission and request no Bluetooth, location or contacts permissions.
- THE SYSTEM SHALL ship an iOS privacy manifest declaring required-reason API use and declare "No data collected" in store privacy labels.

Verification: dependency audit script; manifest check on release build; network-inspector run (AC-12).

### REQ-15 Screens and flows
PRD: section 6 screens and primary flows, R-UX-04 (End now).

- THE SYSTEM SHALL provide Home, Game setup, Game, Pause menu, Result, How to play and Settings screens with the elements in the PRD screen table.
- THE SYSTEM SHALL let a new player reach their first throw in three taps (Home → Play → Start).
- WHEN a game ends THE SYSTEM SHALL show the final ranking with Play again (same setup, new seed), New game and Home.
- WHEN no human is left in play THE SYSTEM SHALL offer End now, ranking remaining bots by progress.
- WHEN How to play is opened from a game THE SYSTEM SHALL reflect that game's house rules and list the regional names.

Verification: Maestro flows; manual walkthrough.

### REQ-16 Game screen interaction
PRD: R-LOCAL-01, R-LOCAL-03, R-LOCAL-04, R-UI-01..07. AC: AC-01.

- THE SYSTEM SHALL always show the current player's name, colour and a "Your turn" banner, and accept taps only on that player's pawns and waiting area.
- WHEN the throw button or shells are tapped THE SYSTEM SHALL animate the shells for about 700 ms, then show faces and value.
- THE SYSTEM SHALL show the pool as chips, pre-selecting when it holds one distinct value.
- WHEN a chip is selected THE SYSTEM SHALL highlight only pawns (and the waiting area for 4/8 entry) with a legal move and preview each destination; a pawn tap then commits, in either order.
- WHEN a tapped pawn is in a double THE SYSTEM SHALL ask "Move one" or "Move both".
- THE SYSTEM SHALL animate pawns square by square, show a knock-back on hits, and show callouts for Chamma, Ashta, hit + bonus, inner ring unlocked, no legal move and turn forfeited.
- THE SYSTEM SHALL show a count badge on stacked pawns and keep each tappable.
- WHERE the device is a tablet in landscape THE SYSTEM SHOULD place each seat's name and throw button on its side, rotated to face that player; on phones one shared throw button is used.

Verification: component tests for selection logic; Maestro 2-player turn; AC-01 manual game.

### REQ-17 Visuals, themes, audio and animation
PRD: R-UX-01..05. AC: AC-16.

- THE SYSTEM SHALL draw a square board filling the shortest screen dimension minus margins, with X marks on safe squares.
- THE SYSTEM SHALL ship chalk-on-floor (default), wooden and modern flat themes, switchable in Settings with immediate effect mid-game.
- THE SYSTEM SHALL give each seat a distinct pawn shape or symbol in addition to colour.
- THE SYSTEM SHALL play sounds for throw, step, hit, home and win and haptics on throw and hit, each switchable off.
- THE SYSTEM SHALL offer Normal and Fast animation speeds and use Fast automatically for bot-only play.
- THE SYSTEM SHALL animate at 60 fps on a mid-range 2022 Android phone without blocking input for the next legal action.

Verification: theme switch test; manual perf check with the performance monitor.

### REQ-18 Accessibility
PRD: R-A11Y-01..04. AC: AC-14.

- THE SYSTEM SHALL give every interactive element an accessible label (for example "Red pawn 2, square 7, outer ring").
- WHEN a throw resolves or the turn changes THE SYSTEM SHALL announce it to screen readers.
- THE SYSTEM SHALL use touch targets ≥ 44 × 44 pt, support system font scaling to 150% without broken layouts, and meet WCAG AA contrast (4.5:1) in all themes.

Verification: label lint/test; VoiceOver and TalkBack full-turn run (AC-14); contrast check per theme.

### REQ-19 Localisation and app name
PRD: R-I18N-01..03. AC: AC-17.

- THE SYSTEM SHALL load all user-facing strings from translation files, with English and Hindi in v1 and room for Telugu, Tamil, Kannada and Marathi.
- THE SYSTEM SHALL render Devanagari in every theme, falling back to a bundled Devanagari font.
- THE SYSTEM SHALL read the app name "Astha Chopa" from one config value feeding display name, splash and in-app title.

Verification: hard-coded-string lint; Hindi screenshot pass; rename test build (AC-17).

### REQ-20 Platforms and non-functional targets
PRD: section 1 Platforms, section 9 NFR table.

- THE SYSTEM SHALL run on Android 8.0+ and iOS 15+ (or the Expo SDK floor if higher, recorded as a decision), phones and tablets, portrait and landscape, built as an Expo development build.
  - Decision (OQ-4, 2026-10-31): Expo SDK 58 sets the iOS deployment target to 16.4, so the floor is **iOS 16.4**. Android's minimum is API 24 (7.0), below the PRD's 8.0.
- THE SYSTEM SHALL reach Home in under 2 s cold start, stay under 40 MB installed, and reach 99.5% crash-free sessions in beta.

Verification: release-build measurements; beta report.

### REQ-21 Test and simulation suite
PRD: R-TEST-01..09. AC: AC-13.

- THE SYSTEM SHALL have at least one unit test per rule id in PRD sections 3–4 and per config option, with ≥ 90% line coverage on engine and bot.
- THE SYSTEM SHALL run 10,000 seeded bot-vs-bot games per player count (2, 3, 4) on Classic and 10,000 over random RuleConfigs, with mixed bot levels, where every game finishes within 2,000 turns and every move passes the invariant checker.
- THE SYSTEM SHALL have Maestro smoke tests (start 2-player game, play a turn, background and resume, scripted game to Result) using a debug-only seed hook.
- THE SYSTEM SHALL pass a manual test on a small Android phone, an iPhone and a tablet in airplane mode.

Verification: CI unit job; nightly simulation job; Maestro job; manual checklist.

## Acceptance criteria → REQ

| AC | REQ |
|---|---|
| AC-01 | REQ-15, REQ-16 |
| AC-02 | REQ-1 |
| AC-03 | REQ-10 |
| AC-04 | REQ-1 |
| AC-05 | REQ-3 |
| AC-06 | REQ-5 |
| AC-07 | REQ-5 |
| AC-08 | REQ-6 |
| AC-09 | REQ-4 |
| AC-10 | REQ-9 |
| AC-11 | REQ-13 |
| AC-12 | REQ-14 |
| AC-13 | REQ-21 |
| AC-14 | REQ-18 |
| AC-15 | REQ-1 |
| AC-16 | REQ-17 |
| AC-17 | REQ-19 |

## Open Questions

- OQ-1 Confirm tap before a move commits? Proposed: no for v1; revisit after play-testing.
- OQ-2 Test runner? Proposed: Jest everywhere (jest-expo preset for the app).
- OQ-3 App state container? Proposed: zustand.
- OQ-4 If the current Expo SDK's iOS floor is above 15, accept it? Proposed: yes, record the new floor.
- OQ-5 Board rendering library? Proposed: react-native-svg for the board, Reanimated for pawn motion.
