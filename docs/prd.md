# Ashta Chamma — Product Requirements Document

> Copy of the product requirements (revision 312). The specs in [specs/ashta-chamma-v1](specs/ashta-chamma-v1/) restate these requirements as testable criteria.

Oct 30, 2026 · @Rachit Tyagi

## 1. Overview

Build Astha Chopa, a fully offline mobile game of Ashta Chamma (also called Chowka Bara, Daayam, Kanna Kauri) for 1 to 4 people sharing one device, with a computer-controlled bot for solo play.

Ashta Chamma is a traditional Indian race game played on a 5x5 grid with four cowrie shells instead of dice. Each player races four pawns around the outer ring, into the inner ring, and to the centre square. Strategy comes from choosing which pawn to move and when to hit an opponent.

### Goals

1. Faithful, rule-correct digital version of the traditional 5x5 game.
2. Support 2, 3 and 4 players on one board, plus a 1-player mode against a bot.
3. Pass-and-play on a single phone or tablet. No accounts, no internet, no server.
4. Regional house rules exposed as settings, with sensible defaults.
5. A game engine that is pure, deterministic and fully unit-tested, separate from the UI.

### Non-goals for v1

- Online or networked multiplayer (internet, Bluetooth, local Wi-Fi).
- Accounts, cloud save, leaderboards, chat.
- Ads, in-app purchases, analytics or any network call.
- Larger boards (7x7 and up) and the 8-cowrie "senior" variant. The engine must not make these impossible later.
- Undo of moves, reviving dead pawns, and a Teams mode (A+C vs B+D). Reviving and Teams are candidates for v2.

### Platforms

- Android 7.0+ and iOS 16.4+, phones and tablets, portrait and landscape.
- Framework: React Native with Expo, in TypeScript, using a development build (expo-dev-client), not Expo Go. Built on Expo SDK 58, which sets the iOS minimum to 16.4.

### How to read this document

Requirement IDs (for example `R-RULE-07`) are stable and are referenced by the acceptance criteria in section 10. "Must" is mandatory for v1, "should" is desirable, "may" is optional. Where traditional rules vary by region, section 4 defines a setting and its default.

## 2. Players and play modes

Every game has exactly four seats; each seat is Human, Bot or Empty. Player count and bot play are both expressed through seats, not separate modes.

### Seats

The four seats sit at the four sides of the board. Their order is fixed and turns pass in this order.

| Seat | Side of board | Default colour | Start square (row, col) |
| --- | --- | --- | --- |
| A | Bottom | Red | (4, 2) |
| B | Right | Green | (2, 4) |
| C | Top | Yellow | (0, 2) |
| D | Left | Blue | (2, 0) |

- **R-SEAT-01** Each seat has a `kind`: `human`, `bot` or `empty`; a `name`; a `color`; and, for bots, a `botLevel`.
- **R-SEAT-02** A game must have 2 to 4 non-empty seats and at least 1 human seat.
- **R-SEAT-03** Empty seats are skipped in turn order. Their pawns do not exist. Their start square is still a safe square.
- **R-SEAT-04** Seat settings are locked once a game starts.

### Player counts

| Players | Default seats | Notes |
| --- | --- | --- |
| 4 | A, B, C, D all human | Standard game |
| 3 | A, B, C human; D empty | User may pick which seat is empty |
| 2 | A and C human; B, D empty | Opposite seats by default, for equal spacing |
| 1 (vs bot) | A human; C bot; B, D empty | User may add a second or third bot |

- **R-MODE-01** The setup screen offers quick presets for 1, 2, 3 and 4 human players. A preset only pre-fills the seats; the per-seat Human/Bot/Empty choice is the source of truth, and the engine never sees a player count.
- **R-MODE-02** Choosing 1 creates one human seat and one bot seat by default. The user may set any non-human seat to bot or empty, so 1 human vs 3 bots is allowed.
- **R-MODE-03** For 2 to 4 players, any seat may also be switched to bot (for example 2 humans + 1 bot).
- **R-MODE-04** All four seat names are editable, defaulting to Player 1, Player 2, Player 3 and Player 4 for seats A to D. Players may also change colours. Two seats may not share a colour.

### Same-device, offline play

- **R-LOCAL-01** All players share one device and take turns on it (pass-and-play).
- **R-LOCAL-02** The app must make zero network requests and must not request internet, Bluetooth, location or contacts permissions. Release builds remove the INTERNET permission React Native adds by default (android.blockedPermissions); debug builds keep it for the Metro bundler.
- **R-LOCAL-03** The current player is always unmistakable: their name, colour and a "Your turn" banner, and only their pawns are tappable.
- **R-LOCAL-04** On tablets in landscape, each seat's name and throw button should sit on that seat's side of the board, so players can play from where they sit. On phones, one shared throw button is used. Each seat's panel is rotated to face its player, so the top seat's reads the right way up from across the table.

## 3. Game rules (default rule set)

Each player races 4 pawns along a fixed 25-square path (outer ring, inner ring, centre), using cowrie throws worth 1, 2, 3, 4 or 8. The first player with all 4 pawns in the centre wins. Rules marked ⚙ are configurable in section 4; the text here describes the default.

### 3.1 Board

- **R-BOARD-01** The board is a 5x5 grid. Squares are addressed as (row, col), with (0, 0) at the top-left and row 4 at the bottom.
- **R-BOARD-02** Safe squares (drawn with an X) are the four start squares (4, 2), (2, 4), (0, 2), (2, 0) and the centre (2, 2).
- **R-BOARD-03** The 16 edge squares form the outer ring. The 8 squares around the centre form the inner ring. The centre is home.

### 3.2 Pawns and paths

- **R-PATH-01** Each player has 4 pawns. A pawn is either waiting off the board or at an index 0–24 into its seat's path. Index 0 is the seat's start square; index 24 is home.
- **R-PATH-02** Indices 0–15 are the outer ring, travelled anti-clockwise. Indices 16–23 are the inner ring, travelled clockwise. Index 24 is the centre.
- **R-PATH-03** Seat A's path is defined below. Seats B, C and D use the same path rotated 90° anti-clockwise 1, 2 and 3 times, using rot(r, c) = (4 − c, r). Example: rot(4, 2) = (2, 4), seat B's start.
- **R-PATH-04** At game start all pawns wait off the board, drawn on their start square so all four appear there. Spending a 4 (Chamma) or 8 (Ashta) from the pool places one waiting pawn on the start square (index 0). ⚙ *entry rule*

Seat A path (index: square):

| Index | Square | Ring | Note |
| --- | --- | --- | --- |
| 0 | (4, 2) | Outer | A start, safe |
| 1 | (4, 3) | Outer |  |
| 2 | (4, 4) | Outer | Corner |
| 3 | (3, 4) | Outer |  |
| 4 | (2, 4) | Outer | B start, safe |
| 5 | (1, 4) | Outer |  |
| 6 | (0, 4) | Outer | Corner |
| 7 | (0, 3) | Outer |  |
| 8 | (0, 2) | Outer | C start, safe |
| 9 | (0, 1) | Outer |  |
| 10 | (0, 0) | Outer | Corner |
| 11 | (1, 0) | Outer |  |
| 12 | (2, 0) | Outer | D start, safe |
| 13 | (3, 0) | Outer |  |
| 14 | (4, 0) | Outer | Corner |
| 15 | (4, 1) | Outer | Last outer square, left of start |
| 16 | (3, 1) | Inner | Gate into inner ring |
| 17 | (2, 1) | Inner |  |
| 18 | (1, 1) | Inner |  |
| 19 | (1, 2) | Inner |  |
| 20 | (1, 3) | Inner |  |
| 21 | (2, 3) | Inner |  |
| 22 | (3, 3) | Inner |  |
| 23 | (3, 2) | Inner |  |
| 24 | (2, 2) | Centre | Home, safe |

Seat A path indices on the 5x5 board (row 0 at the top):

```
 10   9   8   7   6
 11  18  19  20   5
 12  17  24  21   4
 13  16  23  22   3
 14  15   0   1   2
```

The four start squares sit 4 indices apart on every path, so each pawn passes all three opponents' start squares before reaching the gate at 15 → 16.

### 3.3 Cowrie throws

- **R-THROW-01** A throw simulates 4 shells. Each shell independently lands mouth-up with probability 0.5.
- **R-THROW-02** Value = number of mouth-up shells, except 0 mouth-up = 8 (Ashta) and 4 mouth-up = 4 (Chamma).
- **R-THROW-03** Resulting odds must be: 1 → 4/16, 2 → 6/16, 3 → 4/16, 4 (Chamma) → 1/16, 8 (Ashta) → 1/16. Picking uniformly from 1–5 is a defect.
- **R-THROW-04** The UI shows the four shells, drawn as cowries, and which way each landed, not just the number. Once they settle, a voice calls out the result loud and clear: just the number ("3", "2"), or "Chamma!" / "Ashta!" (in Hindi when the app is in Hindi). Chamma and Ashta, the privileged throws, also play their own sound first.

### 3.4 Turn structure

1. **Throw phase.** The player throws. The value is added to the turn's *pool* of throws.
2. A 4 or 8 grants another throw immediately (R-THROW-05). Throwing continues until a 1, 2 or 3 is thrown.
3. **R-THROW-06** If a player throws 4 or 8 three times in a row within one throw sequence, the whole pool is discarded and the turn ends. ⚙ *triple penalty*
4. **Move phase.** The player picks one throw from the pool and one pawn (or double) to move by that value, or spends a 4 or 8 to bring a waiting pawn onto the board. Repeat until the pool is empty.
5. **R-TURN-01** Each throw is used whole on one pawn or double; it cannot be split. Different throws may go to different pawns or the same pawn, in any order the player chooses.
6. **R-TURN-02** Throws are discarded only when no throw left in the pool has a legal move; the engine then discards the rest of the pool itself and emits PoolDiscarded, with no player action. A throw that is unplayable now may become playable after another throw is used (for example a 4 enters a pawn, then a 3 moves it). The player is not required to use as many throws as possible. The UI must say why ("No legal move").
7. **R-TURN-03** Each hitting move grants one bonus throw sequence, taken after the current pool is used. A double that hits, or a move that hits several pawns (doubles off), still grants one; several hitting moves in one turn queue that many sequences. Bonus sequences follow the same rules, including chaining on 4/8 and the triple penalty.
8. **R-TURN-04** A triple penalty, in the first sequence or in a bonus sequence, discards the current pool and every queued bonus sequence, and ends the turn.
9. **R-TURN-05** When a player's last pawn reaches home, any remaining pool and queued bonus sequences are discarded and the turn passes.
10. **R-TURN-06** Stalemate: if no unfinished seat has a legal move for any single throw value (1, 2, 3, 4 or 8, ignoring `blockOnce`'s one-turn blocks), the game can never progress. This happens under `block` when every remaining player is hitless and stuck at index 15. The engine checks for it after each turn, emits StalemateBroken, and from then on every player without a hit uses `circle` behaviour until they hit.
11. The turn passes to the next seat in A → B → C → D order, skipping empty and finished seats.

### 3.5 Moving and legal moves

A move of throw *n* takes a pawn from index *i* to *t = i + n*. It is legal only if all of these hold:

- **R-MOVE-01** *t* ≤ 24. A pawn must reach home by exact count; overshooting is illegal.
- **R-MOVE-02** Hit requirement: a player may move pawns past index 15 into the inner ring only after that player has hit at least one opponent pawn in this game. The flag is per player, not per pawn, and is never lost. ⚙ *no-hit behaviour*
- **R-MOVE-03** By default (free) there is no hit requirement: any pawn may go on into the inner ring. Under block, a pawn of a player who has not yet hit cannot move past index 15, and a throw that would take it beyond 15 is not a legal move for that pawn; under circle, it goes round the outer ring again.
- **R-MOVE-04** A single pawn may not land on a non-safe square holding an opponent's double.
- **R-MOVE-05** On a safe square, any number of pawns of any players may stand together. No hits happen there.

### 3.6 Hits

- **R-HIT-01** A pawn that ends its move on a non-safe square holding exactly one opponent pawn hits it. With doubles off, landing on a non-safe square holding several of one opponent's pawns hits all of them (section 4). The hit pawn returns to its seat's start square (index 0). It stays on the board and moves again with any throw; only first entry needs a 4 or 8.
- **R-HIT-02** The hitting player's hit flag becomes true and they earn a bonus throw sequence (R-TURN-03).
- **R-HIT-03** Hits are judged only on the landing square. Squares passed over are never affected.
- **R-HIT-04** Hits can happen on the outer and inner rings, but never on safe squares or home.

### 3.7 Doubles

- **R-DBL-01** Two or more of one player's pawns on the same non-safe square form a double. ⚙ *doubles*
- **R-DBL-02** On the outer ring, a double blocks opponents from landing on its square (R-MOVE-04). Under blockOnce, each opponent seat may not pass it during that seat's first turn that starts after the double formed; from its next turn on it may. A double records the turn number it formed on (formedAtTurn). ⚙ *double crossing*
- **R-DBL-03** The owner may move one pawn out of a double (breaking it) or move two pawns together with one throw. Moving together, they land as a double.
- **R-DBL-04** A double that lands on a square with one opponent pawn hits it. A double may not land on an opponent's double.
- **R-DBL-05** Doubles on the inner ring never stop opponents from passing, but R-MOVE-04 and R-DBL-04 still apply: no opponent may land on them. They can move together as on the outer ring.

### 3.8 Finishing and winning

- **R-WIN-01** A pawn on index 24 is finished and can no longer move or be hit.
- **R-WIN-02** A player is finished when all 4 pawns are home. The first finished player wins.
- **R-WIN-03** With 3 or 4 players, play continues to rank 2nd and 3rd place until one player is left. ⚙ *play to the end*

## 4. House rules (configurable)

Traditional play varies by region, so seven rules are settings chosen before a game starts; the defaults below make up the "Classic" preset.

- **R-CFG-01** Settings live in one `RuleConfig` object passed to the engine at game creation. The engine reads rules only from it, never from hard-coded branches.
- **R-CFG-02** Settings are locked once a game starts and are saved with the game.
- **R-CFG-03** The setup screen offers presets ("Classic" plus a "Custom" option that reveals each toggle). Each toggle shows a one-line explanation.

| Key | Options | Default | Effect |
| --- | --- | --- | --- |
| `entryRule` | `onStart` \| `needChammaOrAshta` | `needChammaOrAshta` | `onStart`: pawns begin on the start square and move with any throw. `needChammaOrAshta`: pawns begin off the board; spending a 4 or 8 places one pawn on index 0, and a hit pawn returns to its start square (index 0), still on the board. |
| `noHitBehavior` | `free` \| `block` \| `circle` | `free` | `free`: no hit needed to enter the inner ring (default; Settings sets the default for new games). `block`: a player with no hit cannot pass index 15, and that throw has no legal move for them. `circle`: their pawns wrap around the outer ring. |
| `triplePenalty` | `on` \| `off` | `on` | `on`: three 4/8 throws in a row discard the pool and end the turn. |
| `doubles` | `on` \| `off` | `on` | `off`: same-player pawns may share a square but never block or move together. An opponent landing on such a shared non-safe square hits every pawn on it, for one bonus sequence. |
| `doubleCrossing` | `free` \| `blockOnce` | `blockOnce` | `blockOnce`: an opponent may not pass an outer-ring double on the first turn it stands in their way (that crossing move is void); from their next turn they may. |
| `bonusOnHome` | `on` \| `off` | `off` | `on`: a pawn reaching home grants one bonus throw sequence. |
| `playToEnd` | `on` \| `off` | `on` | `off`: the game ends as soon as one player finishes. Ignored with 2 players. |

- **R-CFG-04** For `blockOnce`, the engine stores, per double, its owner, square and formedAtTurn (R-DBL-02). Any change to a double's pawns or square ends it; a stack that remains, or two pawns landing together, is a new double with a new formedAtTurn.

## 5. Bot opponent

A bot is a seat controlled by the device, offered at three levels; it plays by exactly the same rules and engine API as a human.

### Behaviour

- **R-BOT-01** The bot chooses moves only from the engine's `legalMoves()`. It never reads hidden state or future throws, and it cannot affect the random number generator.
- **R-BOT-02** The bot throws and moves automatically. Each action waits 600–1000 ms so humans can follow it, and every bot move is animated like a human move.
- **R-BOT-03** When the pool holds several throws, the bot chooses both which throw and which pawn for each step, re-planning after every move (a hit can change the board). Hard may also search over the orders in which the pool's throws can be used; the pool is small enough to fit the R-BOT-04 budget.
- **R-BOT-04** A bot decision must complete within 200 ms on a mid-range 2022 Android phone, and must never block the UI thread.
- **R-BOT-05** Bot choices are deterministic for a given game state and seed, so tests and replays are repeatable.

### Levels

| Level | Strategy |
| --- | --- |
| Easy | Random legal move, but takes a hit when one is available half of the time. |
| Medium | Scores each legal move with the heuristic below and plays the highest score. |
| Hard | Medium heuristic plus a one-turn lookahead: for each candidate, averages the danger from every opponent's possible next throw, weighted by the real throw odds (R-THROW-03). |

### Medium heuristic

Score each candidate move by adding these terms. Weights are starting points and must be tunable constants.

| Situation after the move | Score |
| --- | --- |
| Hits an opponent pawn | +100, plus 2 × that pawn's progress index |
| First hit of the game for this player (unlocks inner ring) | +60 extra |
| Pawn reaches home | +80 |
| Brings a waiting pawn onto the board | +35 |
| Pawn lands on a safe square | +30 |
| Pawn leaves a square where it was in reach of an opponent | +40 |
| Pawn lands where an opponent can hit it next turn | −50 × probability of that throw |
| Forms a double on the outer ring | +20 |
| Progress | +1 per square advanced |

"In reach" means an opponent pawn sits 1, 2, 3, 4 or 8 squares behind along that opponent's own path, and the move would be legal for it. This is an approximation that ignores throws chained within one turn (for example 4 then 3 = 7); Hard's lookahead uses the same approximation.

- **R-BOT-06** Ties are broken by preferring the pawn furthest along, then the lowest pawn id.

## 6. Screens and user flows

The app has seven screens; a new player must reach their first throw in one tap from launch (Home → Play), using the players and rules remembered from last time.

| Screen | Purpose | Key elements |
| --- | --- | --- |
| Home | Entry point | Who is playing; one large Play button that starts at once with the remembered setup (Continue game and New game when a save exists); Players & rules; How to play; Settings |
| Game setup | Configure a new game | Player count 1–4; per seat: Human/Bot/Empty, name, colour, bot level; rules preset and Custom toggles; Start |
| Game | Play | Board with every pawn drawn separately (waiting pawns on their start square), cowrie shells, large Throw button, throw chips, turn banner, Pause |
| Pause menu | Interrupt a game | Resume, Restart with same setup, Rules summary, Quit to Home (game stays saved) |
| Result | End of game | Final ranking 1st–4th, Play again (same setup), New game, Home |
| How to play | Teach the rules | Illustrated pages for board, throws, moving, hits, doubles, winning; reflects the active house rules when opened from a game |
| Settings | App preferences | Board theme (festival, chalk-on-floor, wooden board, modern flat), sound, haptics, animation speed (normal/fast), language, throw call-outs, inner-ring default for new games, reset saved game |

### Primary flows

1. **New game:** Home → Play → Game → Result → Play again or Home. Players & rules is optional; whatever is started there becomes the remembered setup.
2. **Resume:** launch app → Home shows Continue game → Game restored exactly where it stopped.
3. **Solo vs bot:** Game setup → player count 1 → bot seat pre-filled at Medium → Start.
4. **Quit mid-game:** Pause → Quit to Home. Starting a new game while a save exists asks "Replace your saved game?".

### Game screen interaction

- **R-UI-01** Throwing: tap the throw button (or the shells). Shells animate for about 700 ms, then show their faces and the value.
- **R-UI-02** The throw pool appears as chips (for example `4` `8` `2`). When the pool holds one distinct value, it is pre-selected.
- **R-UI-03** Moving: tap a throw chip, then a highlighted pawn; or tap a pawn first, then a chip. Only pawns with a legal move for the selected throw are highlighted, and the destination square is previewed.
- **R-UI-04** When a pawn stands in a double, tapping it asks "Move one" or "Move both".
- **R-UI-05** Pawns move square by square along the path, not in a straight line. Hits show a short knock-back animation to its seat's start square.
- **R-UI-06** Events get clear feedback: Chamma and Ashta callouts, "Hit! Bonus throw", "Inner ring unlocked", "No legal move", "Turn forfeited" for the triple penalty.
- **R-UI-07** Every pawn is drawn separately: pawns sharing a square sit in a small grid (2×2, or 3×3 when crowded), waiting pawns sit faded on their start square, and a double's square is tinted in its owner's colour. Each pawn stays individually tappable.

## 7. UX, accessibility and localisation

The game should feel like a warm, traditional board drawn in chalk, while staying readable for children and older players.

### Visual and audio

- **R-UX-01** The board fills the shortest screen dimension minus margins and stays square. Safe squares show a clear X motif. Four board themes ship: festival (default: warm cream and marigold, saffron buttons, dark pawn outlines, chosen to be cheerful yet easy for older eyes), chalk-on-floor, wooden board and modern flat. The theme is picked in Settings and applies immediately, including mid-game.
- **R-UX-02** Pawn colours must be distinguishable with colour-blindness: each seat also has a distinct pawn shape or symbol.
- **R-UX-03** Sound effects for shell throw, pawn step, hit, home and win. Haptic tap on throw and hit. The throw sound is a cowrie clatter: a rattle in the hand, then the shells landing. Chamma plays two bright bells, Ashta a gong with a peal of bells; a pawn reaching home gets applause; the winner gets a fanfare. Sound, haptics and the spoken result can each be turned off.
- **R-UX-04** Animation speed setting: Normal and Fast (about half the duration). Bot-only turns may use Fast automatically when no human is left in the game. At that point the game also offers End now, which ranks the remaining bots by progress and goes to the Result screen.
- **R-UX-05** Animations run at 60 fps on a mid-range 2022 Android phone and never block input for the next legal action.

### Accessibility

- **R-A11Y-01** Every interactive element has an accessible label, for example "Red pawn 2, square 7, outer ring".
- **R-A11Y-02** Throw results and turn changes are announced to screen readers.
- **R-A11Y-03** Touch targets are at least 44 × 44 pt. Text respects system font size up to 150% without breaking layouts.
- **R-A11Y-04** Text contrast meets WCAG AA (4.5:1).

### Localisation

- **R-I18N-01** All user-facing strings come from translation files; no hard-coded text in components.
- **R-I18N-02** v1 ships English and Hindi. The structure must allow adding Telugu, Tamil, Kannada and Marathi later. Every theme's fonts must render Devanagari, or fall back to a bundled Devanagari font.
- **R-I18N-03** The app is named "Astha Chopa". The name lives in one app config value that feeds the display name, splash and in-app title, so the developer can change it in one place. Store listing names live in App Store Connect and Play Console and are changed there by hand. The How to play screen lists the regional names.

## 8. Technical requirements

The game logic must live in a pure TypeScript engine with no UI, framework or platform imports; the app is a thin shell that renders engine state and sends it player actions.

### 8.1 Architecture

- **R-TECH-01** Language: TypeScript in strict mode everywhere.
- **R-TECH-02** Repository layout: an `engine` package (rules, state, legal moves, RNG), a `bot` package (depends only on `engine`), and the `app` (React Native + Expo UI, persistence, audio). These may be folders in one package (src/engine, src/bot, src/app) with an ESLint import-boundary rule enforcing the dependencies, instead of separate workspace packages.
- **R-TECH-03** The engine is a pure reducer: given a state and an action, it returns a new state plus a list of events. It never mutates input and never reads the clock, storage or global randomness.
- **R-TECH-04** The UI never decides rules. It asks the engine for legal moves and only dispatches actions the engine accepts.
- **R-TECH-05** Animations are driven by the engine's event list (for example `PawnMoved` with the squares passed, `PawnHit`, `ThrowResolved`), not by diffing states.

### 8.2 Engine interface

| Function | Input | Output |
| --- | --- | --- |
| `createGame` | seats, rule config, seed | initial game state |
| `legalMoves` | game state | list of legal moves for the current player and pool |
| `applyAction` | game state, action | new state + events, or a typed error for an illegal action |
| `pathFor` | seat | the 25 board squares of that seat's path |

Actions are `Throw`, `Enter` (pool throw id) and `Move` (pool throw id, pawn id, move-together flag). Each throw in the pool has an id, because a pool can hold the same value twice. There is no `Forfeit` action: when nothing is playable the engine discards the pool and passes the turn itself (R-TURN-02). `legalMoves` returns each distinct outcome once, so two pawns on one square moved by the same throw count as one move. Errors include `NotYourTurn`, `IllegalMove` and `WrongPhase`.

Events: ThrowResolved, PawnEntered, PawnMoved (with the squares passed), PawnHit, DoubleFormed, DoubleBroken, PawnHome, InnerRingUnlocked, PoolDiscarded, TurnForfeited, StalemateBroken, TurnPassed, PlayerFinished and GameOver. createGame also takes the game id and createdAt from the caller, because the engine may not read the clock or generate random ids.

### 8.3 Data model

| Entity | Fields |
| --- | --- |
| Game | id, schemaVersion, createdAt, seats\[4\], ruleConfig, rngState, botRngState, phase (`throwing` \| `moving` \| `finished`), currentSeat, pool (throws), consecutiveChammaAshta, pendingBonusThrows, doubles (owner, square, formedAtTurn), stalemateBroken, rankings, turnNumber, log |
| Seat | id (A–D), kind (`human` \| `bot` \| `empty`), name, color, botLevel, hasHit, finishedRank |
| Pawn | id, seat, pathIndex (0–24, or `null` when off-board under `needChammaOrAshta`), progress (squares travelled since entry or the last hit; under circle it keeps growing while pathIndex wraps 0–15) |
| Throw | id, value (1, 2, 3, 4, 8), shells\[4\] (up/down), bonus flag |
| LogEntry | turnNumber, seat, action, resulting events |

Square occupancy is derived from pawn positions, never stored separately, so the two cannot disagree.

### 8.4 Randomness

- **R-RNG-01** Use a small seeded PRNG (for example mulberry32 or xoshiro128) owned by the game state. Each shell is one draw.
- **R-RNG-02** The same seed and the same actions must reproduce the same game exactly. A debug screen may show the seed.
- **R-RNG-03** The bot uses its own seeded generator so its choices never change the throw sequence.

### 8.5 Persistence

- **R-SAVE-01** The full game state is saved locally after every applied action: MMKV, with AsyncStorage as a fallback. The saved log is capped (for example the last 200 entries) so saves stay within the 50 ms target as games run long.
- **R-SAVE-02** Killing the app, a phone call or a reboot must lose at most the animation in progress, never a completed action.
- **R-SAVE-03** One saved game slot in v1. Settings are stored separately from the game.
- **R-SAVE-04** Saved games carry `schemaVersion`. An unreadable or old save is discarded with a friendly message, never a crash.

### 8.6 Offline and privacy

- **R-NET-01** No network libraries, analytics, crash reporters or ad SDKs that phone home, and no expo-updates (it checks for updates on launch). All fonts, sounds and images are bundled.
- **R-NET-02** The app works in airplane mode from first launch.
- **R-NET-03** Store privacy labels declare "No data collected". The iOS build ships a privacy manifest declaring its required-reason API use (UserDefaults, used by MMKV and AsyncStorage).

## 9. Non-functional requirements and testing

The engine is the riskiest part, so it carries the heaviest testing: 90% line coverage and a 10,000-game bot simulation with zero rule violations.

### Non-functional targets

| Area | Target |
| --- | --- |
| Cold start to Home | Under 2 s on a mid-range 2022 Android phone |
| Frame rate during animations | 60 fps, no dropped input |
| Bot decision time | Under 200 ms (Hard level included) |
| Save after an action | Under 50 ms, off the UI thread |
| Install size | Under 40 MB |
| Crash-free sessions | 99.5% in beta testing |
| Permissions | None; release builds do not declare INTERNET (R-LOCAL-02) |

### Testing requirements

- **R-TEST-01** Engine unit tests cover every rule ID in sections 3 and 4, with at least one test per rule and per config option. Target: 90% line coverage on `engine` and `bot`.
- **R-TEST-02** Path tests check that all four seat paths have 25 unique squares, start on the right start square, pass the other three start squares at indices 4, 8 and 12, and end at (2, 2).
- **R-TEST-03** Throw distribution test: over 160,000 seeded throws, each value's frequency is within 1 percentage point of its odds in R-THROW-03.
- **R-TEST-04** Scenario tests build specific board states and check legal moves, for example: exact-count home, landing on an opponent double, hit on a safe square, no-hit block at index 15, entering a pawn with a 4 or 8, a hit pawn restarting from its start square, an opponent blocked once by a double, triple penalty, bonus throw after a hit, a stalemate at index 15 broken by circle, a throw that becomes playable only after another throw is used, and doubles off with an opponent landing on a shared square.
- **R-TEST-05** Simulation: 10,000 seeded bot-vs-bot games for each player count (2, 3, 4) with the Classic preset, plus 10,000 games over random RuleConfig samples covering all 128 toggle combinations. Seats use a mix of Easy, Medium and Hard bots. These run as a nightly job, not on every commit. Every game must finish, every move must pass a rule-invariant checker, and no game may exceed 2,000 turns.
- **R-TEST-06** Replay test: the same seed plus the same action log reproduces an identical final state.
- **R-TEST-07** Persistence test: save after any action, reload, and the restored state equals the original.
- **R-TEST-08** UI end-to-end smoke tests (Maestro): start a 2-player game, play a turn, background and resume, finish a scripted game to the Result screen. A debug-only hook lets tests set the game seed.
- **R-TEST-09** Manual test pass on at least one small Android phone, one iPhone and one tablet, in airplane mode.

## 10. Acceptance criteria, milestones and decisions

v1 is done when every criterion below passes on Android and iOS in airplane mode.

### Acceptance criteria

- [ ] AC-01 A 4-player human game can be played from setup to Result on one device. (R-MODE-01, R-LOCAL-01)
- [ ] AC-02 2-player and 3-player games work, with empty seats skipped and their start squares still safe. (R-SEAT-03)
- [ ] AC-03 A 1-player game against a Medium bot plays to the end without human help on the bot's turns. (R-MODE-02, R-BOT-02)
- [ ] AC-04 1 human vs 3 bots and 2 humans + 1 bot are both possible. (R-MODE-02, R-MODE-03)
- [ ] AC-05 Throw odds match R-THROW-03 within tolerance. (R-TEST-03)
- [ ] AC-06 A player who has not hit cannot move past index 15; after one hit, all their pawns can enter the inner ring. (R-MOVE-02, R-MOVE-03)
- [ ] AC-07 Pawns start off the board and enter only by spending a 4 or 8; exact count is enforced for reaching home. (R-PATH-04, R-MOVE-01)
- [ ] AC-08 Hits send the pawn back to its start square (on the board) and grant a bonus throw; no hits on safe squares. (R-HIT-01 to 04)
- [ ] AC-09 Three Chamma/Ashta throws in a row forfeit the turn when the setting is on. (R-THROW-06)
- [ ] AC-10 Each house-rule setting changes behaviour as described in section 4.
- [ ] AC-11 Killing the app mid-game and relaunching restores the exact game. (R-SAVE-01, 02)
- [ ] AC-12 The app makes zero network requests (verified with a network inspector). (R-LOCAL-02, R-NET-01)
- [ ] AC-13 10,000-game simulations pass with no rule violations. (R-TEST-05)
- [ ] AC-14 Screen reader can play a full turn using labels and announcements. (R-A11Y-01, 02)
- [ ] AC-15 Seats default to Player 1–4 and all four names can be edited before a game. (R-MODE-04)
- [ ] AC-16 All four board themes work, festival is the default, and switching in Settings applies immediately. (R-UX-01)
- [ ] AC-17 Changing the single app-name config value updates the app name everywhere it appears in the app; store listings are updated by hand. (R-I18N-03)

### Milestones

1. **Engine core:** board, paths, throws, turn loop, moves, hits, winning; tests R-TEST-01 to 04.
2. **House rules and bot:** `RuleConfig`, three bot levels, simulation and replay tests.
3. **Playable app:** setup, game and result screens with basic visuals; persistence and resume.
4. **Polish:** animations, sound, haptics, tablet layout, How to play, accessibility, Hindi.
5. **Release:** device test pass, store listings, privacy labels, beta.

### Decisions

- **Entry rule:** `needChammaOrAshta` is the default; pawns enter only with a 4 or 8.
- **No-hit behaviour:** `block` replaced by free as the default (2026-10-31): pawns may enter the inner ring without a hit. block and circle remain house rules, and Settings holds the default used for new games.
- **Reviving dead pawns:** not in v1; consider for a later version.
- **Teams mode (A+C vs B+D):** not in v1; candidate for v2.
- **App name:** "Astha Chopa", set from a single app config value so the developer can change it easily.
- **Theme:** four themes ship (festival, chalk-on-floor, wooden board, modern flat); festival is the default since 2026-10-31, switchable in Settings.
- **Player names:** all four are editable, defaulting to Player 1, Player 2, Player 3 and Player 4.
- **Framework:** React Native with Expo.

* **Pawns per entry throw:** one pawn per 4 or 8 throw, whether Chamma or Ashta. This deliberately differs from the Wikipedia description, where a Chamma enters 2 pawns and an Ashta 4.
* **Lost throws under `block`:** accepted; a player with no hit may lose several throws in a row by design.
* **Crossing doubles:** `blockOnce` is the default, as in Wikipedia's standard rules.
* **Hit pawns:** return straight to their start square (index 0) and stay on the board, as Wikipedia describes. Only a pawn's first entry needs a 4 or 8.
* **Player count:** presets only; the seats are the source of truth (R-MODE-01).
* **Discarding throws:** only when nothing left in the pool is playable; no rule to maximise throws used (R-TURN-02).
* **Triple penalty in a bonus sequence:** ends the whole turn, including queued bonuses (R-TURN-04).
* **Stalemate:** when no seat can ever move, players without a hit switch to `circle` (R-TURN-06).
* **`blockOnce` timing:** each opponent is held for its first turn after the double forms (R-DBL-02).
* **Inner-ring doubles:** can be passed but not landed on (R-DBL-05).
* **`doubles` off:** landing on a shared square hits every pawn on it, for one bonus sequence.
* **Platform minimums:** iOS 16.4, the floor Expo SDK 58 sets (PRD originally said iOS 15), and Android 7.0 (API 24), which the framework allows below the original 8.0.
* **Waiting pawns on the board:** pawns that still need a 4 or 8 are drawn on their own start square (faded, with a count), so all four pawns are visible there from the start; tapping them enters one.
* **Throw feedback:** shells are drawn as cowries, the throw sound is a synthesised cowrie clatter (a real recording can replace `assets/sounds/throw.wav`), and the device's offline text-to-speech calls out each result, switchable in Settings.
* **Simple for children and players over 50:** one main action per screen, buttons at least 56 pt (72 pt for Play and Throw), larger text and chips, and no seat panels on the phone game screen. Play starts straight away with the players and rules used last time (first launch: you against a Medium computer player); setup is optional and remembered.
* **Winner celebration:** when a player finishes first, a full-screen celebration shows confetti, a trophy and "\<name> wins!" with a fanfare; play (and bots) wait until Continue is tapped, and a finished game then goes to Results.

### Glossary

| Term | Meaning |
| --- | --- |
| Ashta | All four shells mouth-down; worth 8 and an extra throw |
| Chamma | All four shells mouth-up; worth 4 and an extra throw |
| Cowrie | Sea shell used as a two-sided die |
| Pool | All throws collected in one turn, waiting to be assigned to pawns |
| Hit (kill, cut) | Landing on an opponent pawn and sending it back to its start square |
| Double | Two or more of one player's pawns on one non-safe square |
| Safe square | Start squares and centre, marked X; no hits there |
| Home | The centre square, path index 24 |
| Seat | One of the four board sides, controlled by a human, a bot or nobody |

### Sources

- [Chowka bhara — Wikipedia](https://en.wikipedia.org/wiki/Chowka_bhara)
