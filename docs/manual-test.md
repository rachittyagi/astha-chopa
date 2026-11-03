# Manual device test (TASK-66, R-TEST-09)

Run on **one small Android phone, one iPhone and one tablet**, all with **preview** builds and **airplane mode on from first launch**. Tick each box per device and note the device, OS version and date.

| Device | OS | Date | Tester |
|---|---|---|---|
| | | | |
| | | | |
| | | | |

## Acceptance criteria

- [ ] **AC-01** A 4-player human game plays from Setup to Result on one device.
- [ ] **AC-02** 2- and 3-player games skip the empty seats; an empty seat's start square is still safe (land on it with two players: no hit).
- [ ] **AC-03** 1 player against a Medium bot plays to the end; the bot never needs a tap.
- [ ] **AC-04** 1 human vs 3 bots, and 2 humans + 1 bot, both start and play.
- [ ] **AC-05** Throw odds: covered by the automated test (`pnpm test`, R-TEST-03). Nothing to do by hand.
- [ ] **AC-06** A player with no hit stops at the end of the outer ring; after one hit their pawns enter the inner ring.
- [ ] **AC-07** Pawns start off the board and enter only with a 4 or 8; a pawn needs the exact count to reach the centre.
- [ ] **AC-08** A hit sends the pawn back to its start square and the hitter throws again; no hits on cross squares.
- [ ] **AC-09** Three 4/8 throws in a row lose the turn (Classic rules).
- [ ] **AC-10** In Custom rules, each of the seven settings changes play as its description says.
- [ ] **AC-11** Mid-game, swipe the app away, reopen: Home shows Resume and the game is exactly where it was.
- [ ] **AC-12** With a network inspector (Charles/Proxyman on iOS, `adb shell dumpsys netstats` or PCAPdroid on Android) the app makes **zero** requests from launch through a full game. On Android, also check that *Settings → Apps → Astha Chopa → Permissions* lists no internet, storage, microphone or overlay permission.
- [ ] **AC-13** Simulations: run `pnpm run sim` (60,000 games, 0 failures expected). Nothing to do on device.
- [ ] **AC-14** With VoiceOver (iOS) and TalkBack (Android) only, play a full turn: hear the throw result and the turn change; every button and pawn has a spoken label.
- [ ] **AC-15** Setup shows Player 1–4 as default names; all four can be renamed.
- [ ] **AC-16** All three themes work; chalk is the default; switching in Settings mid-game applies at once.
- [ ] **AC-17** Change `name` in `src/config/app.json`, rebuild: the home-screen icon label and the in-app title both change (store listings are updated by hand).

## Also check

- [ ] **Large text (R-A11Y-03):** system font size at maximum (about 150%): Home, Setup, Game and Settings still fit and nothing is cut off.
- [ ] **Touch targets:** every button, chip and pawn is easy to hit with a thumb (44 pt minimum).
- [ ] **Hindi:** switch to हिन्दी in Settings; every screen is in Hindi with no English left and no broken characters. Have a native speaker read How to play.
- [ ] **Sound and vibration:** throw, step, hit, home and win sounds play; turning each off in Settings silences it.
- [ ] **Tablet landscape (R-LOCAL-04):** with 4 players, each seat's panel faces its side and only the current player's panel shows the throw controls.
- [ ] **Rotation:** turning the phone or tablet mid-game keeps the game state.
- [ ] **Interruptions (R-SAVE-02):** take a phone call or lock the screen mid-move; on return nothing completed is lost.
- [ ] **Bad save:** not testable by hand; covered by the persistence tests.
- [ ] **Release build has no debug link:** opening `astha://debug/new?seed=1` on a release build goes to Home, not a game.
