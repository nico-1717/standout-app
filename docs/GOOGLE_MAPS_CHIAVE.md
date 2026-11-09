# Chiave di Google Maps per Android

Su **iPhone non serve niente**: la mappa è Apple Mappe. Solo **Android** usa Google Maps e vuole una chiave.
La chiave non va nel codice: sta in un segreto di EAS e `app.config.js` la legge (`GOOGLE_MAPS_ANDROID_KEY`).
Senza chiave l'app Android parte lo stesso, ma le mappe restano grigie.

## Cosa fare (una volta, ~10 minuti)

1. Vai su <https://console.cloud.google.com> e accedi con l'account Google che vuoi per Standout.
2. In alto scegli **Seleziona un progetto → Nuovo progetto**. Nome: `Standout`. Crea.
3. Menu ☰ → **API e servizi → Libreria**. Cerca **Maps SDK for Android** e premi **Abilita**.
4. Menu ☰ → **API e servizi → Credenziali → Crea credenziali → Chiave API**. Copia la chiave.
5. Premi **Limita chiave** (importante, così nessuno può usarla al tuo posto):
   - *Restrizioni delle applicazioni* → **App Android** → **Aggiungi** → nome pacchetto `app.standout.mobile` e l'**impronta SHA-1** del certificato di firma (la dà EAS: `eas credentials` → Android → Keystore → mostra SHA-1; per Google Play va aggiunta anche la SHA-1 della *firma di Play*, che trovi in Play Console → Integrità dell'app).
   - *Restrizioni API* → **Limita chiave** → scegli solo **Maps SDK for Android**.
   - Salva.
6. Fatturazione: Google chiede di collegare una carta per attivare il progetto. Maps SDK for Android per le mappe sul telefono ha un uso gratuito molto ampio; imposta comunque un **budget con avviso** (Fatturazione → Budget e avvisi) per sicurezza.
7. Dammi la chiave **non** in chat pubblica: mettila tu come segreto EAS con
   `eas secret:create --scope project --name GOOGLE_MAPS_ANDROID_KEY --value LA_TUA_CHIAVE`
   (oppure dal sito expo.dev → progetto → Environment variables, visibilità *Secret*).

La **ricerca dei posti** (nomi e indirizzi) usa invece la chiave Google Places che il sito ha già sul server: l'app non ne vede mai una.

## Note
- La mappa nativa non funziona in Expo Go su tutti i casi: serve la build di sviluppo (`development-phone`).
- La chiave Android per le mappe e quella Places del server sono due chiavi diverse, con restrizioni diverse: tienile separate.
