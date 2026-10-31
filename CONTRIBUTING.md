# Contributing

Thanks for helping improve Astha Chopa. Bug reports, rule corrections and pull requests are all welcome.

## Before you start

- For anything larger than a small fix, open an issue first so we can agree on the approach.
- Rule changes should cite how the game is traditionally played, and say whether the change is a new rule option or a change to the default.

## Development

```bash
npm install
```

Run every check before opening a pull request:

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm test
```

```bash
npm run audit:deps
```

## Guidelines

- `src/engine/` stays pure: no React, Expo, timers, clock or `Math.random`. Every rule change needs a unit test, and `npm run sim` should still report zero failures.
- `src/bot/` imports only from `src/engine`.
- User-facing text goes through i18n (`src/i18n/en.json` and `hi.json`); the linter rejects literal strings in JSX.
- Keep the app offline: no network libraries, analytics or ads. `audit:deps` enforces this.
- Add dependencies with `npx expo install <package>` so versions match the Expo SDK.
- Keep pull requests focused on one change, with a short description of what changed and how you tested it.

## Code of conduct

Be respectful and constructive. Harassment or personal attacks are not tolerated.
