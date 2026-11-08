# Controllo di sicurezza prima del rilascio (2026-11-09)

Fatto leggendo il codice e con prove automatiche. **Non** sostituisce una prova sul telefono né un controllo fatto da una persona esperta di sicurezza se un giorno l'app avrà molti utenti.

## Cosa c'è già (verificato)
- **Dati sul telefono cifrati**: database SQLCipher; la chiave nasce sul telefono e sta nel Keychain (iPhone) / Keystore (Android), «solo dopo il primo sblocco, solo su questo telefono». Mai in un file normale.
- **Token di accesso** nello stesso Keychain/Keystore, con la stessa regola.
- **Blocco dell'app** con Face ID / impronta (opzionale, il flag sta nel Keychain).
- **Nessun `console.log`** nel codice dell'app (niente testi o token nei log). **Nessun indirizzo `http://`** (solo `https`). Nessun traffico in chiaro permesso nella configurazione.
- **Nessun servizio di tracciamento**: solo moduli ufficiali di Expo che lavorano sul telefono. Nessuna pubblicità, nessuna statistica d'uso.
- **Permessi chiesti solo quando servono** e con una frase chiara: fotocamera e foto (carte, parole, articoli), microfono (registrare la voce su una carta), Face ID. Il microfono NON è chiesto dal selettore di foto.
- **Eliminazione dell'account dentro l'app** (la chiede Apple).
- **Importazione di file** (abitudini e Pomodoro): un file più grande di 30 MB si rifiuta; un file ZIP/.xlsx non può gonfiarsi oltre 150 MB una volta aperto (difesa contro le «bombe ZIP», anche se l'intestazione del file mente); la copia temporanea del file scelto si cancella appena letta; le righe lette sono solo testo (nessuna formula viene eseguita).
- **Esportazione**: il file scritto per «Condividi» sta nella cache e si cancella subito dopo la condivisione.
- **Dipendenze**: `npm audit` sul codice che finisce nell'app non segnala niente; i 25 avvisi «moderati» sono tutti strumenti di sviluppo (Expo CLI, Jest) che non entrano nell'app.
- **Le regole del sito valgono anche qui**: il server rifà ogni controllo (proprietà delle righe, limiti, frequenza); il telefono non è mai creduto sulla parola.

## Da decidere con Nico al momento del rilascio (non sono cose di codice)
1. **Dichiarazione di crittografia (export compliance) su App Store Connect**: l'app usa la crittografia (https e SQLCipher). Va risposta la domanda di Apple («l'app usa crittografia?») e, se serve, va aggiunta la chiave `ITSAppUsesNonExemptEncryption` in `app.json`. Non lo decido io: dipende da dove vive e chi pubblica (è una dichiarazione legale). Posso preparare la chiave quando sai la risposta.
2. **«Privacy dell'app» (etichette)**: l'app manda al nostro server email, contenuti dell'utente (carte, abitudini, diario…) e le foto/audio che scegli; non li usa per tracciare e non li vende. Va dichiarato come «dati collegati all'utente», scopo «funzionalità dell'app». Stessa cosa per la scheda Play Store («Sicurezza dei dati»).
3. **Testi legali** (privacy, termini): sono quelli del sito; vanno collegati nelle schede dei negozi.

## Da fare quando l'app gira su un telefono
- Provare davvero: Face ID, rifiuto dei permessi (fotocamera, microfono) e che l'app resti usabile, uscita dall'account (i dati sul telefono spariscono e la chiave si cancella), nessuna schermata che mostra testi privati nell'anteprima delle app recenti (se vuoi, si può nascondere).
- Una scansione di sicurezza completa del codice (c'è lo strumento Claude Security): si può lanciare prima del rilascio; usa molti token.
