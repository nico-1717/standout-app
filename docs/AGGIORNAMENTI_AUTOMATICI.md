# Aggiornamenti automatici dell'app (come il sito)

Il sito si aggiorna da solo: si fa `push` su `main` e dopo pochi minuti è in linea. L'app ora fa lo stesso.

## Come funziona
1. Si fa `push` su `main`. Parte **CI** (controlli e prove).
2. Se CI passa, parte **Phone update** (`.github/workflows/phone-update.yml`):
   - manda il nuovo codice dell'app ai telefoni «via etere» (EAS Update, ramo `production`, solo iOS);
   - guarda se è cambiata la parte **nativa** (una libreria nuova, un permesso nuovo, la versione di Expo): una
     modifica così non può viaggiare via etere. In quel caso parte da sola anche una nuova build iOS verso TestFlight.
     Al massimo una build automatica ogni 6 ore, così un errore non consuma tutte le build del mese.
3. Sul telefono: all'apertura l'app cerca l'aggiornamento, lo scarica e riparte subito (si vede due volte la
   schermata di avvio). Se si torna all'app da un'altra, lo scarica soltanto e lo applica alla prossima apertura:
   non si riavvia mai mentre scrivi. Se l'aggiornamento è rotto e l'app non parte, EAS Update torna da solo alla
   versione precedente.

## Quando serve ancora una build (e non c'è da fare nulla)
Quando cambia la parte nativa il passo 2 la avvia da solo; poi Apple impiega 10-30 minuti e la nuova versione
compare in TestFlight (da installare dall'app TestFlight una volta). Fino ad allora le modifiche nuove
non arrivano ai telefoni con la versione vecchia (la «runtime» è diversa): è voluto, evita di rompere l'app.

## Cosa serve (una volta sola)
1. expo.dev › Account settings › Access tokens › Create token (nome `github`). Copialo, si vede una volta sola.
2. GitHub › repo `standout-app` › Settings › Secrets and variables › Actions › New repository secret:
   nome `EXPO_TOKEN`, valore il token. (Se c'è già, si sostituisce con quello nuovo.)
3. Per la prima volta: GitHub › Actions › «Phone update» › Run workflow. Fa tutto: manda il codice e avvia la
   build che contiene il sistema di aggiornamento. Poi non serve più toccare nulla.
Non servono più la chiave `.p8` né gli altri tre segreti: l'accesso ad Apple è già salvato su Expo.
Il vecchio token, e la vecchia chiave `.p8`, vanno cancellati.

## Dove guardare se qualcosa non va
- GitHub › Actions › «Phone update»: l'errore è scritto in rosso. «Secret EXPO_TOKEN is missing» = manca il passo 2.
- expo.dev › il progetto `standout` › Updates (gli aggiornamenti mandati) e Builds.
