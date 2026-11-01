# Standout app

Mobile app (React Native + Expo SDK 58 + TypeScript, Android and iOS) for the Standout website
(https://nisama.altervista.org). It works offline (encrypted SQLite on the phone) and syncs with the
server through `/api/v1/sync/*`.

- Design: `docs/ARCHITETTURA_APP.md`
- Website → app parity table: `docs/PARITA_SITO_APP.md`

## Commands

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run lint
npm test
npm run i18n:sync   # copy it.json / en.json from the website (single source of truth)
npx expo start      # needs a dev build: the encrypted database does not work in Expo Go
```

Never commit secrets, tokens or passwords. Bundle id: `app.standout.mobile`.
