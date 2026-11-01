# Standout app — Architettura (Fase 0, 01/11/2026)

> Documento di progetto dell'app mobile (React Native + Expo + TypeScript) che fa **tutto quello che fa il sito**,
> funziona senza rete e si sincronizza con il server.
> Il sito resta com'è per chi lo usa dal browser. Questo documento si legge insieme a:
> - `docs/PARITA_SITO_APP.md` — la tabella pagina per pagina (parte (a) della Fase 0);
> - nel repo del sito: `ARCHITECTURE.md`, `docs/STANDOUT_PROGETTO.md` (§16.1, decisioni del 01/11/2026),
>   `sql/migrations/2026-11-01_sync_*.sql`, `tools/genera_migrazioni_sync.py`.
>
> **Regola di lettura:** dove il documento e il codice non coincidono, vale il codice, e questo file si corregge.
> I numeri qui sotto sono **misurati sul codice** (letti `public/` e `lib/`, provate le migrazioni su MariaDB 10.11);
> quello che non si può misurare da qui è nella sezione «Da verificare» (§9).

---

## 1. Cosa si costruisce, in breve

- App **Android + iOS**, **React Native / Expo / TypeScript**, interfaccia rifatta da zero in componenti nativi.
  Niente WebView.
- Ogni schermata legge dal **database sul telefono** (SQLite): nessuna schermata aspetta la rete.
- Quello che l'utente scrive va **prima sul telefono**, poi al server (`/api/v1/sync/*`), poi agli altri suoi dispositivi.
- Il sito e l'app scrivono negli **stessi dati** del server, passando dalle stesse funzioni di `lib/`.
- Al lancio **tutto gratis**. Il testo è illimitato; solo immagini e audio hanno una quota per utente.

## 2. Decisioni (registro) e deviazioni

Le decisioni del prompt di Nico sono **definitive** e qui sono il punto di partenza: stack (§4), database locale (§4.2),
protocollo (§3), media (§3.7), prestazioni (§4.6), sicurezza (§3.8), notifiche (§4.7).
Una decisione si cambia solo con un motivo **verificato**. Ecco le deviazioni trovate leggendo il codice vero.
Ogni deviazione è «a parità di risultato per l'utente»: cambia **come**, non **cosa**.

| # | Decisione del prompt | Cosa faccio invece | Perché (verificato sul codice) |
|---|---|---|---|
| D1 | «I cancellamenti diventano soft (`deleted_at`) ovunque, sito compreso» | **La lapide è la riga `op='delete'` in `sync_changes`**; le righe vere si cancellano davvero, come oggi. Niente colonna `deleted_at`. | Con `deleted_at` ogni `SELECT` del sito dovrebbe aggiungere `AND deleted_at IS NULL`. Contate: **`FROM/JOIN` sulle tabelle sincronizzate = centinaia** (`projects` 120 in 24 file, `planner_events` 68 in 14, `pomodoro_sessions` 62, `todos` 47, `fc_study_decks` 36…). Una sola query dimenticata farebbe **ricomparire sul sito una riga cancellata**. Inoltre la promessa legale del sito è «cancella davvero» (STANDOUT_PROGETTO §7.8): una riga che resta 90 giorni come lapide contiene ancora i dati. Il registro tiene solo `(tbl, row_uuid, op)`, nessun contenuto. Il protocollo (lapidi in pull, pulizia a 90 giorni, `resync_required`) funziona **identico**. |
| D2 | «Un dispositivo non visto da più di 90 giorni riceve `resync_required`» | Si controlla il **cursore**, non la data: `sync_meta.purged_up_to_seq` = l'ultimo `seq` che la pulizia ha cancellato. Un telefono col cursore sotto quel valore deve riscaricare tutto. | È la condizione vera (mancano cambiamenti), non un'approssimazione: un telefono fermo 100 giorni su un account senza cambiamenti non deve riscaricare niente. Il limite dei 90 giorni resta (è quando la pulizia cancella). |
| D3 | «`base_updated_at` per decidere il conflitto sui testi lunghi» | Il conflitto sui **testi lunghi** si decide con **`base_hash`** (sha256 del testo su cui l'utente ha lavorato). `base_updated_at` resta nel messaggio, per «vince l'ultimo» degli altri campi. | `updated_at` ha precisione di **un secondo**, e **non si può portare a millisecondi**: `planner_events.updated_at` è confrontato con `google_synced_at` in `google_calendar.php` (≈10 punti, `updated_at > google_synced_at`, e il trucco `updated_at = updated_at` per non farlo salire); con i millisecondi ogni evento sembrerebbe «da rimandare a Google» per sempre. Il confronto dell'hash è esatto e non dipende dall'orologio. |
| D4 | «`uuid CHAR(36) NOT NULL UNIQUE` su ogni tabella sincronizzata» | Vale per le tabelle con id proprio (**«righe»**). Per le tabelle **a riga singola** (`planner_settings`, `home_layout`…, chiave = `user_id`) e **a chiave naturale** (`fc_study_learnt (user_id, fc_image_id, is_child)`, `plan_days`, `todo_buy_memory`…) l'identità è un **UUIDv5** calcolato da `tabella + chiave`, uguale sul server e sul telefono. | Quelle tabelle **non hanno un id** (le chiavi primarie lette dal database: `fc_study_learnt PK(user_id, fc_image_id, is_child)`, `plan_paint PK(user_id, project_id, day)`…). Aggiungere un id le riscriverebbe tutte. Il protocollo (sempre «uuid + patch») resta uguale. |
| D5 | «Aggiungere `updated_at` dove manca» | `updated_at DATETIME … ON UPDATE CURRENT_TIMESTAMP` (secondi, come tutte le altre del sito) **solo dove una riga si modifica**; i registri che si scrivono e basta (`*_plays`, `habit_log_events`, `habit_user_achievements`, `fc_game_durations`) non lo ricevono. | `ON UPDATE` lo fa il database: nessuna query del sito cambia. |
| D6 | Collisioni sul server | Se il telefono crea una riga la cui **chiave naturale esiste già** (es. un check-in `(habit, giorno)` creato anche dall'altro dispositivo, o una dose `(terapia, giorno, n)` generata da entrambi), il server **non duplica**: risponde `conflict_resolved` con `alias` = l'uuid che esiste già, e il telefono riscrive il proprio. | Le dosi delle pastiglie e i check-in si **generano** da regole (`pills_core.php`, `habits_core.php`): due dispositivi offline ne creano di identiche. Senza questa regola ci sarebbero righe doppie. |
| D7 | «Chiavi esterne» | Sulla rete le chiavi esterne viaggiano come **uuid** (`project_id` → `project_uuid`). Il server traduce da e verso i suoi id interi. La lista «campo → tabella» sta nel **manifest** (§3.6). | Il prompt dice «l'app e l'API parlano solo di uuid». Qui lo si rende esplicito: ci sono ~60 campi di questo tipo (`parent_id`, `project_id`, `category_id`, `habit_id`, `calendar_id`, `routine_id`…). |

Nessuna deviazione sullo stack: **Expo SDK 58 è uscito il 15/10/2026** (React Native 0.88; verificato sul changelog di Expo).
La compatibilità di ogni libreria si **controlla all'installazione** (Fase 1), non si copia da qui.

---

## 3. Lato server (repo del sito `nico-1717/standout`)

### 3.1 Le migrazioni SQL (pronte, provate)

File generati da `tools/genera_migrazioni_sync.py` e **provati su MariaDB 10.11** con dati finti (4.100 attività in un
elenco), **due volte di fila** (si rilanciano senza danni) e confrontati con `schema.sql` (stesse colonne).
Nico le esegue **in phpMyAdmin, in quest'ordine**, e solo quando una fase le richiede:

| Ordine | File | Cosa fa | Quando serve |
|---|---|---|---|
| 1 | `2026-11-01_sync_01_infra.sql` | crea `sync_changes`, `sync_mutations`, `sync_conflicts`, `sync_meta` | **Fase 1** |
| 2 | `2026-11-01_sync_02_attivita.sql` | `uuid`, `sort_key` su `todos`, `todo_buy_categories` | **Fase 1** |
| 3 | `…_sync_03_abitudini.sql` | abitudini, pastiglie, diario, home, bozze flashcard | Fase 2 |
| 4 | `…_sync_04_planner.sql` | planner | Fase 2 |
| 5 | `…_sync_05_progetti.sql` | progetti, Pomodoro, piano, voti | Fase 3 |
| 6 | `…_sync_06_flashcard.sql` | flashcard di studio e di lingue | Fase 3 |

**Cosa c'è dentro, per ogni tabella** (la lista completa è nel file `TABELLE` dello script):
- `uuid CHAR(36) NOT NULL DEFAULT (UUID())` + `UNIQUE`. Le righe esistenti ricevono ciascuna il proprio uuid
  (passo a 3 tempi: colonna vuota → riempita riga per riga → obbligatoria). Le **nuove** righe scritte dal sito
  ricevono l'uuid **dal database**: nessuna `INSERT` esistente cambia.
- `updated_at` dove mancava (D5).
- `sort_key VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin` per le liste ordinabili. **Collation binaria**: con una
  collation che ignora le maiuscole «Z» e «a» si ordinerebbero a rovescio. Le chiavi sono **identiche** a quelle della
  libreria `fractional-indexing` (provato su 4.100 righe, tre «lunghezze» a0…, b00…, c000…) e riempite dal `sort_order`
  esistente.
- **Rischio da conoscere:** richiedono **MySQL ≥ 8.0.13** (o MariaDB ≥ 10.2.1) per `DEFAULT (UUID())` e le funzioni finestra.
  Lo `schema.sql` del sito usa già `utf8mb4_0900_ai_ci` (MySQL 8), ma **non sappiamo la versione esatta di Altervista**:
  Nico esegue `SELECT VERSION();` (§8, domanda 2) **prima** di tutto il resto.
- Le tabelle sincronizzate **vengono anche aggiunte a `sql/schema.sql`** (blocco generato in fondo), per le installazioni nuove.

### 3.2 Il registro dei cambiamenti e `sync_log()` (lapidi nel registro, D1)

Tutto il server (sito **e** API) scrive nelle tabelle passando da `sec_q()`. Per questo **non serve** toccare 700 query di
lettura: si aggiunge una **riga di registro** accanto a ogni scrittura. Nuovo file `lib/sync.php`:

```
sync_attivo(): bool                       // le tabelle di sync esistono? (stesso schema di td_nota_c_e(): se no, tutto è un no-op:
                                          //  il codice si può pubblicare PRIMA della migrazione senza rompere il sito)
sync_log_id($uid, $tbl, $id, $op='upsert')        // 1 solo INSERT … SELECT uuid FROM tbl WHERE id=? (e proprietà)
sync_log_dove($uid, $tbl, $dove, $params, $op)    // per le scritture di massa (UPDATE … WHERE id IN (…))
sync_log_prima_di_cancellare(...)                 // registra op='delete' LEGGENDO l'uuid prima del DELETE, nella stessa transazione
sync_log_chiave($uid, $tbl, $chiave, $op)         // tabelle a riga singola o a chiave naturale (UUIDv5)
```

- **Non si rompe mai una scrittura del sito per colpa del registro:** gli errori vanno nel log (`sec_log_error`) e basta.
  Dove la scrittura è già in una transazione, la riga di registro ci sta dentro.
- **Cascate:** quando una riga ne trascina altre (cancellare un mazzo cancella le carte; cancellare un progetto toglie il
  legame dalle attività) il chiamante registra **anche i figli** (`sync_log_dove` prima del `DELETE`). I punti dove succede
  sono elencati in §3.4.
- **Chi possiede una riga:** per le tabelle con `user_id` è la colonna. Per le tabelle **figlie senza `user_id`**
  (`fc_study_cards`, `fc_study_subcards`, `fc_study_examples`, `fc_vocab_cards`…) il proprietario si ricava dal padre; la
  regola sta nel manifest e **è la stessa** di `ACCOUNT_CATENE` in `lib/account_dati.php` (già mantenuta e verificata).
- **Rete di sicurezza contro le dimenticanze** (una `sync_log()` mancata = una modifica che l'app non vede mai):
  1. `tools/controlla_sync.py` (nuovo, nei controlli prima del commit): fallisce se un file scrive una tabella sincronizzata
     senza chiamare una `sync_log*`.
  2. In prova (variabile `STANDOUT_SYNC_VERIFICA`), `sec_q()` riconosce `INSERT/UPDATE/DELETE` su una tabella sincronizzata
     e segnala se nella richiesta non è passata una `sync_log*` per quella tabella. I test del sito girano sotto questa
     verifica e **devono dare zero segnalazioni**. (Non è un trigger: non cambia nulla in produzione.)
  3. `GET /sync/digest` (conti e ultimo `updated_at` per tabella) + «Controlla la sincronizzazione» nelle Impostazioni:
     se i numeri del telefono e del server divergono, riscarica quella tabella.
- **Pulizia:** `sync_changes` oltre 90 giorni, `sync_mutations` oltre 30. Si fa **a caso dentro `push`** (come già
  `api_sessioni_pota_a_caso()`), e con cron se Altervista lo offre (§8, domanda 3). La pulizia scrive `purged_up_to_seq` (D2).
  Nessuna lapide con dati dentro: solo `(tbl, row_uuid)`.

### 3.3 Le rotte nuove (`/api/v1/`, regole di PROGETTO §5.3: `ok`, stato HTTP giusto, `{ok:false,error,code}`, 422 col campo)

Sincronizzazione (autenticazione **solo token**: sono le rotte dell'app):
- `POST /sync/push` — fino a **200** modifiche `{mutation_id, table, op: upsert|delete, uuid, patch, base_updated_at, base_hash?}`.
  Ogni modifica in **una transazione**, con le **stesse funzioni di validazione** delle rotte normali (es. `td_api_modifica`
  per i task: nessuna regola riscritta). Esito per ognuna: `applied | conflict_resolved(alias?) | rejected(code, field)`.
  Un rifiuto non si perde: l'app lo mette in «problemi di sincronizzazione».
- `GET /sync/pull?cursor=N&limit=500` — righe e lapidi dopo `N`, **raggruppate per tabella in ordine di dipendenza**
  (il padre arriva prima del figlio), nuovo cursore, `more`. Gzip. «Niente di nuovo» = **una** interrogazione su indice
  `(user_id, seq)`. Se `N` è sotto `purged_up_to_seq` risponde `resync_required` (D2).
- `GET /sync/state` — testa del registro, versione minima dell'app, ora del server, quota.
- `GET /sync/digest` — vedi §3.2.
- `X-App-Version` e piattaforma su **ogni** chiamata; il server può rispondere `426 upgrade_required`.

Account (richiesti dagli store, già nel prompt): `auth/register`, `auth/forgot` (manda l'email), `account/password`,
`account/export`, `account/delete` (richiede la password o un login recente), `account/prefs` (lingua, stile, colore).
Per Apple basta che la cancellazione **si avvii nell'app** (verificato: «easy to find», non serve un sito esterno né una
richiesta al supporto); il tuo obiettivo «≤ 3 tocchi» è più severo ed è quello che teniamo.

### 3.4 I punti di scrittura del sito da far passare da `sync_log()` (misurati: righe `INSERT/UPDATE/DELETE` per tabella)

| Area | Dove si scrive oggi (file, n. scritture) | Note |
|---|---|---|
| To do / to buy (`todos` 45, `todo_buy_categories` 9, `todo_notes`, `todo_buy_memory`) | `todo_api.php` 20, `todo_core.php` 10, `shopping_api.php` 5, `todo_bulk_api.php` 4, `pl_azioni.php` 3, `pl_scrivi.php` 2, `planner_api.php` 1 | **Fase 1.** Quasi tutto già in `lib/` (le fette 1–8 dell'API) |
| Planner (`planner_events` **68** in 10 file) | `pl_scrivi.php` 11, `planner_api.php` 12, `google_calendar.php` **22**, `study_api.php` 7, `todo_core.php` 5, `todo_api.php` 5, `pl_azioni.php` 2, `todo_bulk_api.php` 2, `pl_api.php`, `shopping_api.php` | **Il rischio più grosso**: `google_calendar.php` scrive spesso solo campi di servizio (`google_synced_at`) senza toccare `updated_at`; quelle **non** sono cambiamenti dell'utente e **non** si registrano. Si registra solo dove cambia il contenuto (si controlla riga per riga) |
| Altre tabelle del planner | `planner_api.php` (calendari 7, categorie 4, parole chiave 3, luoghi 3, routine 3+3, settimane, liste 2+4, contatti 3, priorità 2), `pl_base.php`, `pl_categorie.php`, `meteo_api.php`/`google_calendar.php` (`planner_settings`) | |
| Abitudini e diario | `habits_core.php`, `habits_api.php`, `habits.php`, `habits_import.php`, `pl_azioni.php` (check-in dal planner), `diary_api.php`, `lib/diary_api.php`, `diario_ai.php` | check-in e serie: lo scrive `hb_log_imposta` (un solo punto) |
| Pastiglie | `pills_core.php` (12 scritture, un solo file) | |
| Progetti / Pomodoro | `progetti.php` 19+, `study_api.php` 18 (legacy), `pomodoro.php` 11+6+2, `pomodoro_storico.php` 8, `piano_api.php` 20, `pomodoro_import.php`, `pomodoro_stato.php`, `project_selector.php` | |
| Voti | `voti.php` (25 scritture, un solo file) | |
| Flashcard | **tabelle con nome costruito a runtime** (studio/lingue): `fc_view.php` 20, `fc_insert_save.php` 12, `fc_card_edit.php` 11, `fc_game.php` 8, `fc_examples_api.php` 4, `fc_decks.php` 3, `ai_generate_text.php` 2, `fc_learnt.php`, `fc_game_start.php`, `fc_game_retry.php`, `fc_deck_selector.php`, `ai_shatter_save.php`, `lib/fc/fc_vocab_gioco.php`, `fc_languages.php`, `fc_nuove_carte.php`, `fc_history.php`, `fc_result.php`, `fc_settings`/`fc_goals` | Qui la ricerca per testo **non basta** (la tabella è `$tab`): `controlla_sync.py` legge anche le variabili `$t_…`/`$tab…` |

**Metodo per area** (quello degli otto passi già fatti): (1) portare la logica della pagina in `lib/` **senza cambiare il
comportamento del sito** (si confronta prima/dopo) e farla passare da `sync_log*`; (2) rotte e test; (3) logica in TypeScript
con **test d'oro**; (4) schermate; (5) test e budget; (6) mostrare a Nico; (7) spuntare la tabella.

### 3.5 Esportazione e cancellazione dell'account (da sistemare insieme alle migrazioni)

`lib/account_dati.php` esporta **tutte** le tabelle con `user_id` leggendole da `information_schema`. Con le tabelle nuove
finirebbero nel file ZIP `sync_changes` (centinaia di migliaia di righe, rischio memoria: il limite è 384 MB) e `sync_mutations`.
Prima di eseguire le migrazioni **si aggiunge l'esclusione** (due nomi in una costante) e `sync_meta` va in
`ACCOUNT_TABELLE_GLOBALI`. `sync_conflicts` **resta** nell'esportazione (contiene testi dell'utente). La cancellazione
dell'account funziona già da sola (`ON DELETE CASCADE`). `tools/controlla_dati_utente.py` non riconosce
`CREATE TABLE IF NOT EXISTS`: **va corretto o le tabelle nuove vanno scritte senza `IF NOT EXISTS` in `schema.sql`**
(lo decido in Fase 1; trovato provando lo script).

### 3.6 Il manifest (una sola fonte di verità)

`lib/sync_manifest.php` descrive, per ogni tabella: tipo (riga/singola/naturale/append/solo_server), proprietario
(colonna o catena), campi sincronizzati (**niente campi di servizio**: `google_*` di `planner_events`, `*_hash`,
`buy_image` come nome file → solo metadati), chiavi esterne (D7), campo di ordine, **campi di testo lungo** (per D3),
chiave naturale (D6), validatore (la funzione `lib/` da riusare). Il server lo **serve** a `GET /sync/schema`; l'app lo
copia nel repo con lo script `npm run sync:manifest` e **la CI fallisce se le due copie differiscono**. Da lì si generano le
tabelle Drizzle e gli schemi zod, così server e app non possono divergere. Parte dalle 3 tabelle della Fase 1 e cresce per area.

### 3.7 Media (immagini e audio): fuori dalla sincronizzazione delle righe

- La riga sincronizza solo i **metadati** (nome, peso, hash, stato); i file hanno una **coda di caricamento/scaricamento**
  che sopravvive al riavvio, riprende, e rispetta Wi-Fi / dati mobili (impostazione).
- Prima di caricare: immagine max 1600 px lato lungo, JPEG/WebP ~80% (`expo-image-manipulator`); audio AAC/m4a.
  Hash sha256 per non caricare due volte lo stesso file. Scaricamento pigro con cache locale a rotazione (LRU).
- **Quota** (solo immagini e audio, il testo non conta mai): per utente, nel modello dei piani (`plans`, `user_plans`):
  si aggiunge una colonna `plans.media_quota_mb` (NULL = nessun limite). Il server **controlla prima di accettare** un
  file; l'app mostra lo spazio nelle Impostazioni. Il valore predefinito lo **proporrò dopo che Nico mi dice lo spazio
  disco vero del piano Altervista** (§8, domanda 3): da qui non si può leggere.
- L'archivio dei file sta dietro **un'interfaccia sola** (`lib/storage_media.php`, oggi disco, domani S3/R2 col VPS):
  l'app non cambia. Oggi il sito tiene i file in `media/` e li cancella a mano in più punti (9 chiamate a `unlink`):
  vanno raccolte in **una** funzione prima di mettere i file sincronizzati.

### 3.8 Sicurezza, privacy, account (regole del prompt, riportate)

Token solo in `expo-secure-store`; accesso 30 min, rinnovo ruotato 60 giorni (già fatto); `token_reused` → uscita
pulita. **Niente certificate pinning.** Nessuna chiave nell'app. Database locale **cifrato** con SQLCipher (opzione del
config plugin di `expo-sqlite`), chiave generata al primo avvio e tenuta in `expo-secure-store`; **se le misure in Fase 1
mostrano un problema di prestazioni o di piattaforma, si ripiega sulla sola cifratura dei campi del diario e te lo dico**.
Blocco opzionale con Face ID/impronta, spento di default. Sentry (UE, senza dati personali) **solo dopo** l'aggiornamento
dell'informativa (`lib/legale/`, it/en, e la costante della versione: **tutti dovranno riaccettare**: te lo dico prima).
Nessun SDK di pubblicità/analisi.

---

## 4. Lato app (repo `standout-app`, da creare)

### 4.1 Stack (decisioni del prompt, riportate; versioni = quelle che raccomanda l'SDK al momento dell'installazione)

Expo (gestito + `expo-dev-client`), Nuova Architettura + Hermes, TypeScript `strict`, Expo Router, Zustand, TanStack Query (solo
dati online), FlashList, Reanimated + Gesture Handler, `expo-image`, grafici su `react-native-skia`, MMKV (preferenze non
sensibili), react-hook-form + zod, `date-fns`, una sola famiglia di icone SVG, i18next + `expo-localization`.
Qualità: ESLint + Prettier, `tsc --noEmit`, Jest + React Native Testing Library, Playwright (build web), Maestro (flussi su
telefono vero), GitHub Actions. Build con EAS Build solo su tag o a mano; aggiornamenti JS con EAS Update.
**Prima di ogni libreria**: ancora mantenuta? non deprecata? (es.: `expo-audio`/`expo-video`, non `expo-av`).

### 4.2 Cartelle

```
standout-app/
  app/                         Expo Router: solo percorsi, sottili
  src/
    core/{db,sync,api,theme,i18n,auth}
    features/<area>/{screens,components,db,api,logic}     // logic = TypeScript puro, senza React: si prova da solo
  docs/ARCHITETTURA_APP.md  docs/PARITA_SITO_APP.md
  test-fixtures/golden/        // vettori d'oro prodotti dal PHP (JSON)
  maestro/                     // flussi per telefono vero
  scripts/                     // i18n:sync, sync:manifest, bundle-report
```

### 4.3 Database sul telefono

`expo-sqlite` in WAL + Drizzle (migrazioni con drizzle-kit, **live queries**: la schermata si aggiorna quando cambia la riga).
Contiene **solo le righe dell'utente**, con le stesse colonne del server più colonne di servizio:
`uuid` (UUIDv7, creato sul telefono), `server_seq` (l'ultimo `seq` visto per quella riga), `sort_key`.
Tabelle di servizio: `outbox` (modifiche da inviare: `mutation_id`, tabella, uuid, `op`, `patch` JSON, `base_updated_at`,
`base_hash`, tentativi, ultimo errore), `sync_state` (cursore, `last_push`, `last_pull`), `sync_problems`, `media_queue`.
- **Una modifica = una sola transazione** che scrive la riga **e** mette in `outbox` (o tutte e due o nessuna).
- **Accorpamento:** modifiche successive agli stessi campi della stessa riga ancora non inviate diventano **una** modifica.
- Indici su ogni colonna usata in `WHERE`/`ORDER BY` di una schermata; scritture di massa in una transazione; elenchi lunghi con
  **paginazione a chiave** (non `OFFSET`), mai scansioni sul thread JS.
- Migrazioni locali **versionate** e dentro una transazione; non perdono mai la `outbox` (prova con un database «versione N−1
  con coda piena»).
- **Uscita (logout):** cancella il database locale **solo se la `outbox` è vuota** o se l'utente conferma di perdere le modifiche.

### 4.4 Il motore di sincronizzazione

- **Quando:** invio ~2 s dopo una modifica (con rete); invio e ricezione al ritorno in primo piano, al ritorno della rete
  (NetInfo) e ogni 60 s ad app aperta; migliore sforzo in background con `expo-background-task`. Ripetizione con
  **backoff esponenziale e jitter**. Niente socket al lancio (arriverà col VPS).
- **Ordine:** prima `push` (la `outbox` in ordine di creazione, a blocchi da 200), poi `pull` a pagine da 500 finché `more:false`.
  Ogni pagina applicata in **una transazione**, poi si cede il controllo all'interfaccia (mai lavoro lungo sul thread JS).
- **Primo accesso su un telefono nuovo:** `pull` dal cursore 0 con avanzamento visibile, **prima i dati più recenti** così l'app è
  usabile subito; il registro delle risposte delle flashcard e gli altri registri grandi vanno **per ultimi**.
- **Conflitti:** i campi si inviano a pezzi, quindi modifiche a campi diversi della stessa riga si fondono da sole; sullo stesso
  campo vince **l'ultimo secondo il server**. **Testi lunghi** (voci del diario, note): se l'hash di partenza non coincide con
  quello del server, il server tiene il più recente come testo principale e salva l'altro in `sync_conflicts`; l'app mostra
  «conservate entrambe le versioni». **Nessuna parola dell'utente si perde.**
- **Modifica di una riga già cancellata altrove:** vince la cancellazione, **ma** non in silenzio: finisce in «problemi di
  sincronizzazione» con il tasto «Ripristina» (che rimanda la riga intera con lo stesso uuid).
- **Ordine delle liste:** `sort_key` (fractional-indexing): spostare una riga cambia **una** riga, non si rinumera la lista.
- **Non si sincronizza (solo online):** crediti e lavori IA, meteo, ricerca luoghi, OAuth di Google Calendar, admin.

### 4.5 Logica che passa dal server al telefono (parità col PHP)

Espansione delle ripetizioni del planner, programmazione delle pastiglie, serie e traguardi delle abitudini, medie dei voti,
«Pianifica per me», livelli e ripasso delle flashcard, scelta della lacuna negli esempi, ripresa delle partite, parser delle
frasi veloci. **Metodo (non si salta):** si eseguono le funzioni PHP su molti ingressi, si salvano ingressi e uscite come JSON
in `test-fixtures/golden/`, e un test Jest verifica che il TypeScript dia **lo stesso risultato**. **Nessun porting è «fatto»
senza questo test.** Dove il PHP dipende dall'orologio o dal fuso (Europe/Rome, come `api_h_tasks_elenco`) l'orologio si
passa come parametro, così il test è ripetibile.

### 4.6 Prestazioni: i budget da misurare e tenere

| Cosa | Budget | Come lo misuro |
|---|---|---|
| Prima immagine utile di una schermata dopo la navigazione | < 100 ms | prova automatica sulla build web e profilo Hermes; tu sul telefono |
| Avvio a freddo fino alla Home usabile | < 2 s su un Android medio | build web come stand-in + suggerimenti Hermes; **la misura vera è sul tuo telefono** |
| Elenchi da migliaia di righe | 60 fps | FlashList, righe memoizzate, chiavi stabili; prova con 5.000 righe |
| Lavoro sul thread JS durante un gesto | < 16 ms | animazioni su thread UI (Reanimated) |
| Dimensione del bundle | soglia in CI (la fisso in Fase 1 dopo la prima misura) | `scripts/bundle-report` |
| Rete | gzip, patch e non righe intere, **un solo `pull` per ciclo** (non uno per tabella) | contatore di richieste nei test |
| Server | ogni interrogazione di sync su un indice; richieste brevi (Altervista ha limiti di tempo e memoria) | **numeri veri dal tuo server** appena misurabili |

Le schermate pesanti (gioco, editor immagini, grafici) si caricano **a richiesta** (rotte asincrone, `require` in linea).

### 4.7 Notifiche (locali, dai dati sincronizzati)

Pastiglie, eventi, fine Pomodoro, abitudini: **notifiche locali** programmate sul telefono dai dati sincronizzati, quindi
funzionano **senza rete e senza server**. Si **riprogrammano** dopo ogni sincronizzazione e dopo il riavvio. **Attenzione (da
verificare in Fase 2 sulla documentazione, lo ricordo a memoria):** iOS tiene al massimo **64 notifiche locali** programmate;
quindi si programmano solo le più vicine e si ricalcolano all'apertura e in background. Il push remoto (Expo Push Service)
**non si costruisce adesso**: è per la fase social.

### 4.8 Aspetto: i token del tema

Un solo file tipizzato `src/core/theme/tokens.ts`, estratto da `public/_assets/ui/base.css` e `stile_standard.css` (stile
«standard», chiaro e scuro, in `@layer base`), dallo stile «paper» di Planner/Diario/To do, dai colori d'accento
(`lib/accent.php`: palette chiusa `STANDOUT_ACCENTI`), dall'oro dei Voti (`lib/colore_voti.php`), da caratteri, raggi, ombre e
spaziature. Il colore di sistema del sito è `--brand` (non `--accent`). **Regola di Nico: l'app ha l'aspetto del sito di oggi.
Mai un aspetto nuovo, mai un cambiamento, senza prima una proposta visiva e il tuo OK.** Navigazione e gesti seguono la
piattaforma (gesto indietro su iOS, aree sicure, tastiera): non è un nuovo aspetto.
Le schermate in cui il sito ha un aspetto **solo sul web** e va deciso con te prima di costruirle (la tabella le segna
«serve il tuo OK sull'aspetto»): le due vesti del To buy, il gioco (percorso a dischi, checkpoint, boss) e le scene di pausa.

### 4.9 Lingue

i18next + `expo-localization`, italiano e inglese. **Una sola fonte: i file del sito** `lang/it.json`, `lang/en.json`.
`npm run i18n:sync` li copia nell'app (stessa struttura nidificata; `{n}` per i segnaposto, come in `t()`), e **la CI fallisce se la
copia dell'app non è aggiornata**. La ricaduta a catena (lingua scelta → italiano → la chiave stessa) è quella di `t()`.
I plurali (`_one`, `_other`) si usano solo dove servono.

---

## 5. Fasi e stime oneste

Le stime sono in **sedute di lavoro** (una seduta = una sessione piena, come questa) e in **settimane di calendario** a ritmo
regolare. Sono **intervalli**: l'incertezza principale non è scrivere il codice, è **quante volte tu provi sul telefono e io
correggo** (ogni giro costa un giorno di calendario). Vale ±40%.

| Fase | Contenuto | Sedute | Calendario | Cosa può farla slittare |
|---|---|---|---|---|
| 0 | Questo documento, la tabella, le migrazioni provate | **1 (fatta)** | — | |
| 1 | Scheletro, tema, lingue, accesso, DB cifrato, motore di sync, rotte `/sync/*`, **prova end-to-end sui to do** con i test elencati, banco di prestazioni | 8–12 | 2–3 settimane | versione MySQL di Altervista; SQLCipher su Expo SDK 58; il primo giro sul telefono |
| 2 | To do/to buy completi (con immagini), abitudini, pastiglie, diario, planner, Home, notifiche, impostazioni, account | 25–35 | 6–9 settimane | **planner (68 punti di scrittura, ripetizioni, mappa)**; test d'oro delle ripetizioni; quota media |
| 3 | Flashcard complete (editor ricco, immagini, audio, giochi, voce), Pomodoro, progetti, piano, voti, IA | 30–45 | 8–12 settimane | **editor ricco** (modello JSON + codice colorato), il gioco, «Pianifica per me», voce |
| 4 | Il resto della tabella, rifinitura, accessibilità, casi senza rete, pubblicazione | 10–15 | 3–5 settimane | revisione degli store; regola di Google (12 tester per 14 giorni) |

Totale onesto: **circa 4–7 mesi di calendario** per tutto il sito nell'app. La Fase 1 è il **punto di verifica**: se la
sincronizzazione sui to do regge sul tuo server, il resto è lavoro lungo ma regolare; se non regge, lo scopriamo subito e costa poco.

## 6. Rischi principali (in ordine di gravità)

1. **Una scrittura del sito che non passa dal registro** = modifica invisibile all'app. Mitigazione: §3.2 (controllo statico, verifica in prova, digest).
2. **Altervista**: limiti di tempo, memoria e connessioni per richiesta; `push` da 200 e `pull` da 500 righe potrebbero essere troppi (si regolano dai numeri misurati). Cron e disco **da verificare** (§8).
3. **`google_calendar.php`**: 22 scritture e un uso delicato di `updated_at` (D3): non si tocca la precisione; il registro non deve scattare per i campi di servizio.
4. **Righe generate da regole su due dispositivi** (dosi, check-in): D6.
5. **Editor ricco delle flashcard** (JSON di blocchi con proprietà `code`, `ck`, `q`, `hl`; evidenziazione 700 ms dopo l'ultimo tasto): la parte più difficile da portare.
6. **«Pianifica per me»** e ripetizioni del planner: algoritmi grandi, serve il test d'oro su molti ingressi.
7. **Limite di 64 notifiche locali su iOS** (da verificare).
8. **Regola di Google Play**: un account personale nuovo deve fare una **prova chiusa con almeno 12 tester per 14 giorni di seguito** prima della produzione (verificato sulla pagina d'aiuto di Google). Iniziare a cercare 12 tester **presto**.
9. **Cifratura SQLCipher** con la versione di Expo del momento: da misurare in Fase 1 (c'è il ripiego sul solo diario).
10. **Informativa privacy** da aggiornare (Sentry, dati sul telefono) **prima** della pubblicazione: tutti gli utenti dovranno riaccettare.

## 7. Pubblicazione negli store (cosa farai tu, cosa preparo io)

- **Apple Developer Program: 99 USD l'anno** (verificato sulla pagina ufficiale; nessuna esenzione per le persone).
- **Google Play:** vedi rischio 8. (Il costo di registrazione non risulta sulla pagina d'aiuto che ho letto: **lo controlli tu** quando ti iscrivi.)
- Preparo io: nome, descrizioni corta e lunga (it/en), parole chiave, elenco degli screenshot, indirizzo dell'informativa (`/legal/…`, già
  online), risposte per «App Privacy» (Apple) e «Sicurezza dei dati» (Google), classificazione per età, note per chi revisiona con un
  account di prova. **Non pubblico nulla**: pubblichi tu.
- **Cancellazione dell'account** nell'app: obbligatoria per Apple (verificato).

## 8. Domande per Nico (solo quelle vere)

1. **Il repo `standout-app`**: creare vuoto sul tuo GitHub e dirmi **privato o pubblico** (consiglio: privato). *Già chiesto in chat.*
2. **Una piccola commissione per te, 3 minuti, in phpMyAdmin (scheda SQL):** esegui
   `SELECT VERSION();` e dimmi il risultato. Poi, **nel pannello di Altervista**: (a) quanto **spazio disco** hai usato e quanto hai
   a disposizione; (b) se esiste «**Cron**» nel tuo piano e ogni quanto può girare. Da questi tre dati dipendono: se le migrazioni
   funzionano così come sono, la quota predefinita di immagini/audio, e dove metto la pulizia notturna.
3. **«To study» (`to_study.php`, `study_api.php`)**: sul sito è stato **sostituito dal Piano dei progetti** (la pagina stessa dice
   «ora vive dentro Progetti»). Non lo porto nell'app: **confermi?**
4. **Notifiche del widget (richieste di amicizia)**: sul sito il social è spento: le rimando alla fase social. **Confermi?**
5. **Nome dell'app e identificativo del pacchetto** (non cambia più dopo la pubblicazione; non hai un dominio): ti proporrò 2–3 opzioni
   all'inizio della Fase 1, con icona e splash da decidere insieme. *(Punto 3 della tua lista; non serve ancora.)*
6. **Chiave di Google Maps** (solo per Android, Fase 2): ti darò i passaggi esatti quando arriviamo al planner.
7. **Tre aspetti da approvare con una proposta visiva** (prima di costruirli): le due vesti del To buy, il gioco di studio, le scene di pausa.

## 9. Da verificare (non posso farlo da qui)

- Versione di MySQL e disco/cron/limiti PHP di Altervista (domanda 2). Le **latenze vere** le misuro quando posso chiamare il tuo server.
- Supporto di SQLCipher in `expo-sqlite` con SDK 58: la pagina delle novità di SDK 58 non lo nomina; **lo verifico nella documentazione del pacchetto e con una prova in Fase 1**.
- Stato di React Compiler in SDK 58 (la pagina delle novità non lo dice): lo verifico all'installazione.
- Il limite di notifiche locali (rischio 7) e il costo di registrazione su Google Play.
