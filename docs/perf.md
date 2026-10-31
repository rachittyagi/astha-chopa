# Performance (TASK-64)

Targets come from PRD section 9. "Node" rows are measured on the development Mac and are proxies only; every device row must be measured on a **mid-range 2022 Android phone** (for example a Samsung Galaxy A33 or Pixel 6a) with a **preview** build, not a development build.

## Measured so far

| Target | Goal | Measured | Where | Date |
|---|---|---|---|---|
| Bot decision, average | < 200 ms | Medium 0.07 ms, Hard 0.11 ms | Node 24, M-series Mac | 2026-10-30 |
| Bot decision, worst case | < 200 ms | < 10 ms (all levels, 60 games) | Node 24 | 2026-10-30 |
| Saved game size | small enough for a 50 ms save | 47.6 KB at most over a 541-action, 4-player bot game (log capped at 200 entries) | Node 24 | 2026-10-31 |
| Serialising a save | part of the 50 ms budget | 0.41 ms at most (JSON.stringify) | Node 24 | 2026-10-31 |
| JS bundle | part of < 40 MB install | 3.0 MB Hermes bytecode per platform, plus 94 KB of sounds | `expo export` | 2026-10-31 |
| Cold start to Home | < 2 s | not measured | needs device | |
| Animation frame rate | 60 fps, no dropped input | not measured | needs device | |
| Save after an action | < 50 ms, off the UI thread | not measured on device | needs device | |
| Bot decision on device | < 200 ms | not measured on device | needs device | |
| Install size | < 40 MB | not measured | needs store build | |

## How to measure on the device

1. Build a preview APK: `npx eas-cli@latest build --profile preview --platform android`, install it, and turn on airplane mode.
2. **Cold start:** force-stop the app, then `adb shell am start -W -n com.asthachopa.app/.MainActivity` three times; record the median `TotalTime`.
3. **Frame rate:** enable *Profile GPU rendering* (bars) in Developer options, play a 4-player game against bots at Normal speed for two minutes, and note any frames over the 16 ms line during pawn moves and shell rolls.
4. **Save and bot timing:** in a development build, wrap `saveGame` and `chooseAction` with `performance.now()` and log the times for one full game against Hard bots; record the 95th percentile.
5. **Install size:** read *App size* in Settings → Apps after installing the Play internal-testing build.

Record each result in the table above with the device model and date.
