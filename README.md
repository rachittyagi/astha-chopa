# Astha Chopa

Offline, pass-and-play Ashta Chamma for 1–4 players on one device, with bot opponents. React Native + Expo (SDK 58), TypeScript.

- Product requirements: [PRD](https://claude.ai/artifact/HhbJP3jvt6Be1eW6CPVdHG)
- Spec: [docs/specs/ashta-chamma-v1/](docs/specs/ashta-chamma-v1/)

## Layout

| Path | What |
|---|---|
| `src/engine/` | Pure rules engine. Imports nothing outside itself; no React, Expo, clock or `Math.random`. |
| `src/bot/` | Bot players. Imports only `src/engine`. |
| `src/app/` | Expo Router routes (thin screens). |
| `src/ui/`, `src/store/`, `src/services/`, `src/i18n/` | Components, state, device services, translations. |
| `src/config/app.json` | App name and identifiers — the single place to rename the app. |
| `scripts/` | `audit-deps.ts` (no network packages), `simulate.ts` (bot-vs-bot runs, from M2). |

## Commands

```bash
npm install
```

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

The app uses native modules, so it runs in a development build, not Expo Go:

```bash
npx expo run:ios
```

```bash
npx expo run:android
```

or build in the cloud with `npx eas-cli@latest build --profile development`.
