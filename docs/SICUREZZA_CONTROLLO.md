# Controllo di sicurezza (15/11/2026, a mano)

Non è la scansione completa di Claude Security (serve «Dynamic workflows» in /config): è una lettura mirata.

## Cosa è a posto
- Database cifrato (SQLCipher); la chiave è casuale e sta nel Keychain/Keystore (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`).
- Token di accesso e di rinnovo solo in SecureStore; nessun `console.log`, nessuna chiave scritta nel codice.
- Nessun indirizzo `http://` nel codice; il blocco con Face ID sta in SecureStore (`WHEN_UNLOCKED`).
- SQL: i valori sono sempre parametri. I nomi di tabella e colonna che arrivano dal server passano da una lista
  (`isSyncTable`, `MANIFEST[table].columns`): un server ostile non può inserire SQL.
- Link degli articoli: se non iniziano con http(s) si mette `https://` davanti, quindi `javascript:` o `tel:` non partono.
- Niente `.p8`, `.pem`, `.jks`, `.env` nella storia di git.

## Cosa ho cambiato
- `src/core/app/baseUrl.ts`: l'indirizzo del server preso da `EXPO_PUBLIC_API_URL` vale solo se è https
  (http solo in sviluppo); altrimenti si usa il sito vero. Provato in `baseUrl.test.ts`.

## Da sapere
- `npm audit`: 26 avvisi (25 moderati, 1 basso), **tutti** in strumenti di costruzione e prova (Expo CLI, Jest,
  node-forge, glob, minimatch). Nessuno finisce nell'app sul telefono. Non serve `npm audit fix --force`
  (cambierebbe la versione di Expo). Si risolvono da soli con gli aggiornamenti di Expo.
- Da fare a mano da Nico: cancellare i token Expo e la chiave `.p8` vecchia che sono finiti in chat.
