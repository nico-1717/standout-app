# Standout app — tabella di corrispondenza sito → app

> **Cos'è.** Ogni pagina e ogni funzione visibile del sito, con la schermata dell'app che la sostituisce.
> Nulla si lascia fuori in silenzio. Si aggiorna a ogni fine di area (passo 7 del metodo) e **Nico firma
> modulo per modulo** (colonna «Firma»).
> **Come è stata fatta (01/11/2026):** letti `public/` e `lib/` (non solo l'elenco del prompt): ogni pagina PHP,
> le azioni `?ajax=` di ogni endpoint, i file `lib/*`, le tabelle di `sql/schema.sql`.
> **Se il codice e questo file non coincidono, vale il codice** e questo file si corregge.

**Legenda stato:** `API pronta` = esiste già in `/api/v1/` (provata dal vivo, 83 controlli) ma **va comunque
portata nel protocollo di sincronizzazione**; `da fare` = serve tutto; `solo online` = non si sincronizza, serve rete;
`da confermare` = secondo me non va portata, **decide Nico** (vedi `ARCHITETTURA_APP.md` §8).
**Fase:** P1 scheletro e prova di sincronizzazione (solo to do) · P2 produttività · P3 studio · P4 tutto il resto e rifinitura.
**Firma:** vuota finché Nico non ha provato il modulo sul telefono.

---

## 1. Account e impostazioni

| # | Funzione del sito (file) | Area API | Schermata app | Fase | Stato | Firma |
|---|---|---|---|---|---|---|
| A1 | Registrazione (`account/register.php`; accetta termini, password ≥ 10 caratteri) | `auth/register` (nuova) | Registrati | P1 | da fare | |
| A2 | Accesso (`account/login.php`) | `auth/login` | Accedi | P1 | API pronta | |
| A3 | Uscita da questo dispositivo (`account/logout.php`) | `auth/logout` | Impostazioni › Esci (con controllo della coda non inviata) | P1 | API pronta | |
| A4 | Conferma email (`invia_verifica.php`, `verifica_email.php`) | `auth/verify_email` (nuova: rinvio) | Banner «conferma l'email» + rinvio | P4 | da fare | |
| A5 | Password dimenticata (`password_dimenticata.php`, `password_nuova.php`) | `auth/forgot` (nuova) | Accedi › Password dimenticata (manda l'email; il link si apre sul sito) | P4 | da fare | |
| A6 | Cambio password (`cambia_password.php`) | `account/password` (nuova) | Impostazioni › Account › Cambia password | P2 | da fare | |
| A7 | Accettare condizioni e privacy (`accetta_termini.php`) | `auth/accept_terms` | Schermata «Condizioni aggiornate» | P1 | API pronta | |
| A8 | Privacy e dati: scarica i miei dati (`esporta_dati.php`) | `account/export` (nuova) | Impostazioni › Privacy e dati › Scarica | P2 | da fare | |
| A9 | Privacy e dati: elimina il mio account (`elimina_account.php`, chiede la password) | `account/delete` (nuova) | Impostazioni › Privacy e dati › Elimina (≤ 3 tocchi; la regola di Apple chiede solo che si **avvii nell'app**) | P2 | da fare | |
| A10 | Pagine legali (`legal/privacy.php`, `legal/termini.php`) | — | Impostazioni › Privacy / Condizioni (si aprono dal sito, nella lingua dell'utente) | P2 | da fare | |
| A11 | Elenco e uscita dei dispositivi | `auth/devices` | Impostazioni › Dispositivi collegati | P1 | API pronta | |
| A12 | Uscita da tutti i dispositivi | `auth/logout_all` | Impostazioni › Dispositivi › Esci ovunque | P2 | API pronta | |
| A13 | Lingua (`partials/lang_picker.php`, `api/lingua.php`, `users.lang`) | `me` + sync impostazioni | Impostazioni › Lingua | P1 | da fare | |
| A14 | Stile standard / paper (`api/stile.php`, `users.ui_style`) | sync impostazioni | Impostazioni › Aspetto | P2 | scritto e provato con test (stile, colore, lingua), da provare sul telefono | |
| A15 | Colore del sito (`api/accento.php`, `lib/accent.php`, `users.ui_accent`) | sync impostazioni | Impostazioni › Aspetto › Colore | P2 | da fare | |
| A16 | Menu dell'avatar: stile, colore, lingua, barre d'uso dell'IA (`partials/notifiche_widget.php`) | `home/ai_usage` (solo online) | Pannello profilo | P2 | da fare | |
| A17 | Notifiche del widget (richieste di amicizia: sul sito il social è SPENTO) | — | rimandata alla fase social | — | da confermare | |
| A18 | Barra laterale / menu (`partials/sidebar.php`, `sidebar.html`): scorciatoie «Inserisci» (`fc_corsi_lista.php`) | — | Barra a schede in basso + «Altro»; scorciatoia Inserisci | P2 | da fare | |
| A19 | Blocco con Face ID / impronta | — (solo locale) | Impostazioni › Sicurezza (NUOVO rispetto al sito, spento di default) | P4 | da fare | |
| A20 | Coda «problemi di sincronizzazione» e «conservate entrambe le versioni» | `sync/*` | Impostazioni › Sincronizzazione (NUOVO: serve al protocollo) | P1 | da fare | |
| A21 | Quota immagini/audio e spazio usato | `sync/quota` (nuova) | Impostazioni › Spazio | P2 | da fare | |

## 2. Home (`home/`)

| # | Funzione | Area API | Schermata app | Fase | Stato | Firma |
|---|---|---|---|---|---|---|
| H1 | Griglia di widget personalizzabile e ordine (`home_layout`, `home_core.js`) | sync `home_layout` | Home | P2 | da fare | |
| H2 | Modalità «personalizza» (accendi/spegni, ordine, frecce delle scorciatoie) | sync `home_layout` | Home › Personalizza | P2 | da fare | |
| H3 | Widget «Oggi»: ora, anelli abitudini, pastiglie in ritardo, prossima data importante, ore, to do/to buy di oggi | locale (da DB) | Home | P2 | da fare | |
| H4 | Widget Note (nota veloce) | sync `todo_notes` | Home | P2 | da fare | |
| H5 | Widget Flashcard, Progetti, Voti, «I tuoi numeri» | locale (da DB) | Home | P3 | da fare | |
| H6 | Widget Trivia (`trivia.json`, `trivia_en.json`) | file nell'app | Home | P4 | da fare | |
| H7 | Bozze veloci di flashcard (`fc_quick_drafts`: solo il fronte, finita dopo) | sync `fc_quick_drafts` | Home › Bozze | P3 | da fare | |
| H8 | Colpo d'occhio all'avvio: ultimo stato subito, poi aggiornamento (cache in localStorage sul sito) | — | non serve: tutto viene dal DB locale | P2 | assorbito | |
| H9 | Landing page pubblica (`landing_content.php`) | — | nessuna (è il sito) | — | non si porta | |

## 3. Planner (`planner/planner.php`, `lib/planner/`)

| # | Funzione | Area API | Schermata app | Fase | Stato | Firma |
|---|---|---|---|---|---|---|
| P1 | Vista giorno (`pl_giornata.php`) | sync planner | Planner › Giorno | P2 | da fare | |
| P2 | Vista settimana + «settimana» con righe (`planner_weeks`, liste settimanali) | sync planner | Planner › Settimana | P2 | da fare | |
| P3 | Vista mese | sync planner | Planner › Mese | P2 | da fare | |
| P4 | Eventi: crea, modifica, sposta (`event_move`), copia giorno, spunta, cancella | `events` (pronta) → sync `planner_events` | Scheda evento | P2 | API pronta | |
| P5 | Ripetizioni (giornaliera, settimanale, mensile, annuale, personalizzata, `rrule`), eccezioni per una sola occorrenza (`original_date`, `is_cancelled`) | logica da portare in TS | (dentro Planner) | P2 | da fare — **test d'oro contro PHP** | |
| P6 | Invitati (`event_guests`) e rubrica (`contacts`) | sync | Scheda evento › Invitati | P2 | da fare | |
| P7 | Calendari (colore, visibilità, solo uno, regole) | sync `planner_calendars` | Planner › Calendari | P2 | da fare | |
| P8 | Categorie e parole chiave | sync `planner_categories`, `_keywords` | Planner › Categorie | P2 | da fare | |
| P9 | Luoghi e rubrica dei luoghi; ricerca luoghi e dettaglio | sync `planner_places`; ricerca **solo online** | Scheda luogo + mappa | P2 | da fare | |
| P10 | Mappa dei luoghi | — (`react-native-maps`) | Mappa | P2 | da fare (serve la chiave Google Maps per Android: vedi §8) | |
| P11 | Priorità del giorno (`planner_priorities`) | sync | Planner › Priorità | P2 | da fare | |
| P12 | Routine (gruppi di righe, comprimi/ricompatta, inserisci) | sync `planner_routines`, `_items` | Planner › Routine | P2 | da fare | |
| P13 | Preferiti | sync | Planner › Preferiti | P2 | da fare | |
| P14 | Barra intelligente (data, ora, durata dalla frase: `04_barra_e_priorita.js`, `planner_smart.json`) | locale | Barra rapida | P2 | da fare — **test d'oro** (il parser sta in JS: si porta e si prova su frasi vere) | |
| P15 | Impostazioni del planner (`planner_settings`) | sync | Planner › Impostazioni | P2 | da fare | |
| P16 | Meteo (`meteo_api.php`: stato, attiva, anteprima, ricerca luogo) | `weather/*` (nuova) | Planner › Meteo | P4 | solo online | |
| P17 | Google Calendar (`google_calendar.php`: collega, calendari, mappa, push, ripara, sincronizza, scollega) | `google/*` (nuova, OAuth da browser di sistema) | Impostazioni › Google Calendar | P4 | solo online | |
| P18 | Pastiglie in scadenza dentro il planner (avvisi viola) | locale | Planner | P2 | da fare | |
| P19 | Ricerca eventi (`search`) | locale (SQLite FTS) | Cerca | P2 | da fare | |
| P20 | Ambienti/sfondi (`planner_ambient.json`) | file nell'app | Planner | P4 | da fare | |

## 4. To do / To buy / Pastiglie (`planner/todo.php`: schede `todo`, `buy`, `pills`)

| # | Funzione | Area API | Schermata app | Fase | Stato | Firma |
|---|---|---|---|---|---|---|
| T1 | To do: elenco, crea, modifica, spunta, cancella, sotto-attività, data/ora/durata, progetto | `tasks` (pronta) → sync `todos` | To do | **P1** | API pronta (**è la prova di sincronizzazione**) | |
| T2 | Riordino e azioni su più voci (cancella, programma, progetto, sposta) | `tasks/bulk`, `reorder` → `sort_key` | To do › selezione | P1/P2 | API pronta | |
| T3 | Barra intelligente del to do (`todo_barra.js`, `todo_smart.js`) | locale | To do › barra rapida | P2 | fatto il lettore di frasi (`smart.ts`, **test d'oro**: 168 risultati uguali al codice vero del sito) e i gruppi/ordine/«spariscono il giorno dopo» (`groups.ts`) · manca: la schermata (barra con «cosa ho capito», righe a riposo, scorciatoie data, selezione) — in attesa dell'OK di Nico sull'aspetto | |
| T4 | Nota veloce in cima (`todo_nota.js`): si salva da sola | sync `todo_notes` | To do › Nota | P2 | da fare | |
| T5 | Smista la nota a mano (regole di `todo_smart.js`) | locale | To do › Nota › Smista | P2 | da fare | |
| T6 | Smista la nota con l'IA (`todo_nota_ai.php`, crediti) | `ai/*` | To do › Nota › Smista con IA | P3 | solo online | |
| T7 | To buy: articoli, categorie (colore), priorità, prezzo, link, totale, «Carrello» | `shopping` (pronta) → sync | To buy | P2 | scritto e provato con test, da provare sul telefono | |
| T8 | To buy con immagine dell'articolo | `shopping/{id}/image` → coda media | To buy | P2 | API pronta | |
| T9 | Memoria degli acquisti frequenti/storico (`todo_buy_memory`, `buy_forget`) | sync | To buy › suggerimenti | P2 | API pronta | |
| T10 | Le due vesti del to buy: «Corsie» (standard) e «Scontrino» (paper) | — | To buy (due viste) | P2 | scritto (OK di Nico sull'aspetto il 02/11/2026), da provare sul telefono | |
| T11 | Microfono nella barra del to buy (una frase = un articolo) | voce locale | To buy › microfono | P4 | da fare | |
| T12 | Pastiglie: terapie, prese, arretrate, calendario, storico, «prese tutte» | `pills` (pronta) → sync | Pastiglie | P2 | API pronta | |
| T13 | Programmazione delle dosi (ritmo: giorni, mese, ogni N giorni, orari) | logica in TS | (dentro Pastiglie) | P2 | da fare — **test d'oro** | |
| T14 | Promemoria delle pastiglie | notifiche locali | — | P2 | da fare | |
| T15 | Progetto collegato a un'attività, «chiudi pomodoro» (`pomodoro_close`) | sync | To do › progetto | P3 | da fare | |
| T16 | «To study» (`to_study.php`, `study_api.php`, `to_study_progetti.css`): **sul sito è stato sostituito dal Piano dei progetti** (la pagina dice «ora vive dentro Progetti»; la scheda non esiste più nel To do) | — | non si porta | — | **da confermare** (§8, domanda 3) | |

## 5. Abitudini (`planner/habits.php`, `habits_import.php`)

| # | Funzione | Area API | Schermata app | Fase | Stato | Firma |
|---|---|---|---|---|---|---|
| B1 | Elenco abitudini (iniziate / future con «Vedi abitudini future»), anelli | `habits` (pronta) → sync | Abitudini | P2 | fatto: intestazione con tasti tabella/statistiche, carosello a 7 carte, fascia dei giorni, carta del giorno con chip, filtri (tutte/da fare/fascia), gruppi nell'ordine del sito, sezioni settimanali/mensili/personalizzate, «future» · scorrimento laterale (fatto/annulla) e impostazioni fatti · manca: tasto «Scrivi» (diario), vibrazione/suono/coriandoli | |
| B2 | Crea/modifica/archivia/elimina, ordine | sync `habits` | Abitudini › Scheda | P2 | fatti: modulo completo (icona, preset del sito, colori, categoria, tipo, obiettivo, frequenza, momento, durata, minuti planner, motivazione, inizio), modifica, archivia, elimina, «future» · archiviate/ripristina e riordino a trascinamento fatti (dalle Impostazioni) | |
| B3 | Check-in (fatto/parziale/saltato/fallito, quantità, nota, umore) | `habits/{id}/log` → sync `habit_logs` | Abitudini | P2 | fatti: tocco, salta, «ci sono cascato», annulla · mancano: nota e umore, quantità a mano (dettaglio) | |
| B4 | Serie e record (`habit_streak_records`: **calcolati**, non si sincronizzano) | logica in TS | — | P2 | fatto: serie, record, carte del carosello, «Statistiche» e «Vista tabella» con test d'oro sui numeri del sito · manca: record salvato sul server (`best_streak`), ore e traguardi | |
| B5 | Traguardi (`habit_achievements` catalogo, `habit_user_achievements`, «visti») | catalogo nell'app + sync | Abitudini › Traguardi | P2 | da fare | |
| B6 | Categorie di abitudini | `habits/categories` → sync | Abitudini › Categorie | P2 | fatto: le categorie si scelgono nel modulo e servono a statistiche/radar · il sito non ha una pagina per gestirle, quindi non serve una schermata | |
| B7 | Distribuzione per ora (`hour_distribution`) | locale | Abitudini › Statistiche | P2 | da fare | |
| B8 | Diario delle abitudini (`journal_save`, `habit_daily_journal`) | sync | Abitudini › Diario | P2 | API pronta | |
| B9 | Promemoria (`habit_reminders`) | notifiche locali | — | P2 | da fare | |
| B10 | Impostazioni abitudini (`habit_settings`) | `GET/PATCH habits/settings` (nuova, [app-api]) | Abitudini › Impostazioni | P2 | fatto: colore, giorni in barra, finestra grafici, interruttori (gruppi, carosello, coriandoli, vibrazione, suono), archiviate · mancano: importa, esporta; coriandoli/vibrazione/suono si salvano ma non fanno ancora nulla | |
| B11 | Importazione abitudini (`habits_import.php`: leggi, rimappa, salva) | `habits/import` (nuova) | Abitudini › Importa | P4 | da fare | |

## 6. Diario (`diario*.php`, `diary_api.php`, `diario_ai.php`)

| # | Funzione | Area API | Schermata app | Fase | Stato | Firma |
|---|---|---|---|---|---|---|
| D1 | Il giorno: umore, energia, testo, due elenchi (cose buone / imparate), abitudini, anelli | `diary/day` (pronta) → sync | Diario › Giorno | P2 | API pronta | |
| D2 | Testo lungo: conflitto «conservate entrambe le versioni» | `sync_conflicts` | Diario › avviso | P2 | da fare | |
| D3 | Mese (giorni scritti, medie, cose imparate) | locale | Diario › Mese | P2 | API pronta | |
| D4 | Anno (`diario_anno.php`) | locale | Diario › Anno | P2 | da fare | |
| D5 | Modalità lettura (`diario_lettura.php`) | locale | Diario › Lettura | P2 | da fare | |
| D6 | I numeri del diario (`diario_numeri.php`, `insights`) | locale | Diario › Numeri | P2 | API pronta | |
| D7 | Impostazioni (carattere, grandezza, carta) | sync `diary_settings` | Diario › Aspetto | P2 | API pronta | |
| D8 | Libri del diario scritti dall'IA (`diary_ai_books`) e rapporti trimestrali (`diary_ai_reports`) | `ai/*`; i risultati si sincronizzano (solo lettura) | Diario › Libri e rapporti | P3 | solo online per generarli | |
| D9 | Schermata nascosta nel selettore app (con blocco attivo) | — | — | P4 | da fare | |

## 7. Progetti, Piano e Pomodoro (`projects/`)

| # | Funzione | Area API | Schermata app | Fase | Stato | Firma |
|---|---|---|---|---|---|---|
| J1 | Albero dei progetti (`progetti.php`: figli, nipoti, preferiti, date, colore, note, stato) | sync `projects` | Progetti | P3 | da fare | |
| J2 | Selettore di progetto (`project_selector.php`) | locale | selettore | P3 | da fare | |
| J3 | Vista Elenco / Calendario / Piano dentro un progetto | sync piano | Progetto | P3 | da fare | |
| J4 | Piano: obiettivi (minuti, tipo, priorità, scadenza), divisione fra i figli con lucchetto | sync `plan_goals` | Progetto › Piano | P3 | da fare — **test d'oro** | |
| J5 | Evidenziatore dei giorni (`plan_paint`) e blocchi del giorno (`plan_days`) | sync | Progetto › Calendario | P3 | da fare | |
| J6 | «Pianifica per me» (`pn_pianifica`: anteprima, applica, non tocca i blocchi manuali) | logica in TS | Piano › Pianifica | P3 | da fare — **test d'oro** (algoritmo grosso) | |
| J7 | Progetti › Calendario: Oggi / Calendario / Panoramica / Cronologia (timeline) | locale | Progetti › Calendario | P3 | da fare | |
| J8 | «Il tuo tempo» (impostazioni del piano, `plan_settings`) | sync | Piano › Il tuo tempo | P3 | da fare | |
| J9 | Modelli di piano (`plan_templates`) | sync | Piano › Modelli | P3 | da fare | |
| J10 | «Porta le stime nel nuovo piano» (`import_old`) e salta/riporta (`skip_fix`) | logica | Piano | P4 | da fare | |
| J11 | Registro giornaliero «Ho già fatto» e avvio con minuti preimpostati (`daily_log`) | sync `pomodoro_sessions` | Piano › Oggi | P3 | da fare | |
| J12 | Pomodoro: timer, pausa, riprendi, ferma (chiede pausa/fine/scarta), durate personalizzate | sync `pomodoro_sessions`, `pomodoro_custom_durations`, `pomodoro_settings` | Pomodoro | P3 | da fare | |
| J13 | Barra globale del Pomodoro (`pomodoro_barra.*`) | locale | mini-barra sopra le schede | P3 | da fare | |
| J14 | Pause e scene (`pausa_scena.php`, `pomodoro_current_breaks`), clessidra (`clessidra.php`) | sync | Pomodoro › Pausa | P3 | da fare — **serve il tuo OK sull'aspetto** (scene animate) | |
| J15 | Storico del Pomodoro (`pomodoro_storico.php`: modifica, cancella) | locale | Pomodoro › Storico | P3 | da fare | |
| J16 | Importazione Pomodoro (`pomodoro_import.php`) | `pomodoro/import` (nuova) | Pomodoro › Importa | P4 | da fare | |
| J17 | Nota automatica (`nota_auto.js`) | locale | — | P3 | da fare | |
| J18 | Notifica di fine Pomodoro | notifica locale | — | P3 | da fare | |
| J19 | Mazzi collegati a un progetto (`fc_study_deck_projects`) | sync | Progetto › Mazzi | P3 | da fare | |

## 8. Voti / Esami (`exams/voti.php`)

| # | Funzione | Area API | Schermata app | Fase | Stato | Firma |
|---|---|---|---|---|---|---|
| V1 | Esami: voto, lode, idoneità, CFU, stato, previsione, anno, media nazionale | sync `university_exams` | Voti | P3 | da fare | |
| V2 | Gruppi di esami e media del gruppo | sync `university_exam_groups` | Voti | P3 | da fare | |
| V3 | Bonus e tetti | sync `university_bonuses` | Voti › Bonus | P3 | da fare | |
| V4 | Media, voto di laurea e previsioni | logica in TS | Voti | P3 | da fare — **test d'oro** | |
| V5 | Catalogo degli esami (`exams_catalog.json`, `catalog_code`) | file nell'app | Voti › Aggiungi | P3 | da fare | |
| V6 | Impostazioni (`university_settings`) e «oro dei Voti» (`lib/colore_voti.php`) | sync | Voti › Impostazioni | P3 | da fare | |

## 9. Flashcard (`fc/`, `lib/fc/`) — studio (`fc_study_*`) e lingue (`fc_vocab_*`)

| # | Funzione | Area API | Schermata app | Fase | Stato | Firma |
|---|---|---|---|---|---|---|
| F1 | Hub (`fc_home.php`): scheda Studio, scheda Lingue (una riga per corso), anello obiettivo, «schede che conosci», grafico | locale | Flashcard | P3 | da fare | |
| F2 | Lingue/corsi: aggiungi, variante, progetto, elimina, ordina (`fc_languages.*`) | sync `fc_vocab_courses` | Lingue | P3 | da fare | |
| F3 | Mazzi e sotto-mazzi annidati: crea, rinomina, colore, icona (`fc_icone.php`), note, fissa, archivia, data d'esame con conto alla rovescia (`fc_decks.php`) | sync `fc_*_decks` | Mazzi | P3 | da fare | |
| F4 | Numeri del mazzo e badge «da ripassare» (`fcm_badge_ripasso`, `fc_api_counts.php`) | locale | Mazzi | P3 | da fare — **test d'oro** | |
| F5 | Inserisci schede (`fc_insert.php`, `fc_insert_card.php`, `fc_insert_save.php`): righe nuove/modificate/cancellate, salvataggio automatico (`fc_autosave_bar`) | sync `fc_*_cards` | Inserisci | P3 | da fare | |
| F6 | Modifica carta (`fc_card_edit.php`, `fc_edit_popup`) e visualizza (`fc_view.php`) | sync | Carta | P3 | da fare | |
| F7 | Editor ricco (`fc_parser.js`, `format_toolbar.php`): elenchi, checklist, citazioni, codice con colori, evidenziatore | modello documento in TS | Editor | P3 | da fare — **la parte più difficile da portare**: il modello del documento è JSON e si prova con test d'oro | |
| F8 | Immagini: caricamento e editor immagini (`fc_image_editor.*`), misure (`fc_image_sizes.php`) | coda media | Editor immagini | P3 | da fare | |
| F9 | Audio: registratore (`fc_audio_recorder.js`) e lettore (`fc_audio_player`) | coda media | Audio | P3 | da fare | |
| F10 | Esempi (`fc_examples_*`, `fc_vocab_examples.js`, parte nascosta, «Aggiungi esempio») e esempi con lacuna (`fc_vocab_gap`) | sync `fc_*_examples` | Esempi | P3 | da fare — **test d'oro** per la scelta della lacuna | |
| F11 | Sotto-carte (padre/figlia, titoli di gruppo `fcv_titoli_studio`) | sync `fc_*_subcards` | Carta | P3 | da fare | |
| F12 | Importazione intelligente (`fc_smart_import.js`) e abbinamento (`fc_ai_match.js`) | locale + IA | Inserisci › Importa | P3 | da fare | |
| F13 | Preferiti | sync `fc_*_favorites` | Carta | P3 | da fare | |
| F14 | Imparate (`fc_learnt.php`: padre/figlio) | sync `fc_*_learnt` | Carta | P3 | da fare | |
| F15 | Elenco/visualizza carte con filtri (imparate/da imparare), livelli | locale | Mazzo › Carte | P3 | da fare | |
| F16 | Livelli delle carte (nuova, sembra facile, facile, difficile…: `fcv_livello_prefisso`, **gemello** `livello()` in `fc_game_juice.js`) | logica in TS | — | P3 | da fare — **test d'oro** | |
| F17 | Impostazione del gioco (`fc_game_setup.php`: livelli, solo difficili, ordine casuale/in ordine) | sync `fc_settings` | Gioco › Imposta | P3 | da fare | |
| F18 | Gioco (`fc_game.php`): studio e vocabolario, risposta velata, percorso a dischi con colori della categoria, checkpoint (`fc_game_juice.js`), round «boss», cronometro (`fc_game_durations`), pausa massima | sync `fc_games`, `fc_*_plays`, `fc_*_sequence` | Gioco | P3 | da fare — **serve il tuo OK sull'aspetto** (animazioni) | |
| F19 | Riprendi una partita lasciata a metà (`fc_ripresa.php`) e «carte aggiunte dopo» (`fc_nuove_carte.php`, `fc_game_nuove.php`) | locale | Gioco | P3 | da fare — **test d'oro** | |
| F20 | Riprova gli errori (`fc_game_retry.php`: partita figlia) | sync | Risultato › Riprova | P3 | da fare | |
| F21 | Risultato della partita (`fc_result.php`) | locale | Risultato | P3 | da fare | |
| F22 | Cronologia (`fc_history.php`) | locale | Cronologia | P3 | da fare | |
| F23 | Statistiche (`fc_stats.php`) calcolate dal registro delle risposte | locale | Statistiche | P3 | da fare — **test d'oro** | |
| F24 | Record e obiettivi (`fc_*_records`, `fc_goals`) | sync | Statistiche | P3 | da fare | |
| F25 | Selettore di mazzo (`fc_deck_selector.php`) | locale | selettore | P3 | da fare | |
| F26 | Modalità vocale a mani libere (`fc_voice_mode.*`, comandi `fc.cmd_*`, `fc_speak.js`, `fc_read_aloud.js`) | locale (voce + riconoscimento) | Gioco › Voce | P3 | da fare (libreria da scegliere in P3) | |
| F27 | Pannello IA (`fc_ai_panel.*`, `fc_ai.php`, `fc_ai_fab`): genera schede, immagini (`fc_ai_immagine.php`), «Migliora» (`fc_improve_card.php`) | `ai/*` | Inserisci › IA | P3 | solo online | |
| F28 | Spiega / Metafora / Esempio con IA (`ai_generate_text.php`, `ai_example.php`); testi salvati (`fc_study_ai`, `fc_study_ai_child`) | `ai/*`; i testi salvati si sincronizzano | Carta › IA | P3 | solo online | |
| F29 | Frantuma (`ai_shatter.php`, `ai_shatter_save.php`) | `ai/*` | Carta › Frantuma | P3 | solo online | |
| F30 | Tutor audio (`ai_tutor.php`) | `ai/*` | Carta › Tutor | P3 | solo online | |
| F31 | Lettura ad alta voce (`fc_speak.js`) | voce locale | — | P3 | da fare | |
| F32 | Controllo del punto di checkpoint (`fcv_checkpoint` in localStorage) | impostazione locale | — | P3 | da fare | |

## 10. IA (`ai/`)

| # | Funzione | Area API | Schermata app | Fase | Stato | Firma |
|---|---|---|---|---|---|---|
| I1 | I tuoi crediti (`credits.php`, `ai_credits.php`: costo e libro mastro) | `ai/credits` (nuova) | Impostazioni › IA | P3 | solo online | |
| I2 | Coda dei lavori lunghi (`ai_jobs.php`, `ai_job_api.php`, `ai_worker.php`, `fc_ai_job.js`) | `ai/jobs` (nuova) | indicatore di avanzamento | P3 | solo online (con richiesta in coda se offline) | |
| I3 | Pannello admin (`admin_ai.php`) | — | resta sul sito | — | non si porta | |

## 11. Cose del sito che l'app NON replica (da confermare) e novità dell'app

| # | Voce | Nota | Stato |
|---|---|---|---|
| X1 | Service worker, `offline.html`, manifest (`sw.js`) | Sostituiti dal database sul telefono | assorbito |
| X2 | Notifiche push web (`push_subscriptions`) | L'app usa notifiche **locali**; il push remoto è per la fase social | non si porta |
| X3 | Social (`social/friends*.php`) | SPENTO sul sito; fase social | rimandato |
| X4 | Mercato dei mazzi | Dopo l'app che replica il sito | rimandato |
| X5 | Sincronizzazione, coda, «problemi di sincronizzazione», aggiornamento obbligatorio (`426`) | Nuovi, richiesti dal protocollo | P1 |
| X6 | Blocco con biometria | Nuovo, spento di default | P4 |
