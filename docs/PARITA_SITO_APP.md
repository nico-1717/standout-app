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
| A1 | Registrazione (`account/register.php`; accetta termini, password ≥ 10 caratteri) | `auth/register` (nuova) | Registrati | P1 | scritto e provato con test, da provare sul telefono | |
| A2 | Accesso (`account/login.php`) | `auth/login` | Accedi | P1 | API pronta | |
| A3 | Uscita da questo dispositivo (`account/logout.php`) | `auth/logout` | Impostazioni › Esci (con controllo della coda non inviata) | P1 | API pronta | |
| A4 | Conferma email (`invia_verifica.php`, `verifica_email.php`) | `auth/verify_email` (nuova: rinvio) | Banner «conferma l'email» + rinvio | P4 | scritto e provato con test, da provare sul telefono | |
| A5 | Password dimenticata (`password_dimenticata.php`, `password_nuova.php`) | `auth/forgot` (nuova) | Accedi › Password dimenticata (manda l'email; il link si apre sul sito) | P4 | scritto e provato con test, da provare sul telefono | |
| A6 | Cambio password (`cambia_password.php`) | `account/password` (nuova) | Impostazioni › Account › Cambia password (poi rientra con la password nuova: il server chiude tutte le sessioni) | P2 | scritto e provato con test, da provare sul telefono | |
| A7 | Accettare condizioni e privacy (`accetta_termini.php`) | `auth/accept_terms` | Schermata «Condizioni aggiornate» | P1 | API pronta | |
| A8 | Privacy e dati: scarica i miei dati (`esporta_dati.php`) | `account/export` (nuova) | Impostazioni › Privacy e dati › Scarica | P2 | scritto e provato con test, da provare sul telefono | |
| A9 | Privacy e dati: elimina il mio account (`elimina_account.php`, chiede la password) | `account/delete` (nuova) | Impostazioni › Privacy e dati › Elimina (≤ 3 tocchi; la regola di Apple chiede solo che si **avvii nell'app**) | P2 | scritto e provato con test, da provare sul telefono | |
| A10 | Pagine legali (`legal/privacy.php`, `legal/termini.php`) | — | Impostazioni › Privacy / Condizioni (si aprono dal sito, nella lingua dell'utente) | P2 | scritto e provato con test, da provare sul telefono | |
| A11 | Elenco e uscita dei dispositivi | `auth/devices` | Impostazioni › Dispositivi collegati | P1 | scritto e provato con test, da provare sul telefono | |
| A12 | Uscita da tutti i dispositivi | `auth/logout_all` | Impostazioni › Dispositivi › Esci ovunque | P2 | scritto e provato con test, da provare sul telefono | |
| A13 | Lingua (`partials/lang_picker.php`, `api/lingua.php`, `users.lang`) | `me` + sync impostazioni | Impostazioni › Lingua | P1 | fatto — italiano, inglese o automatica (sync impostazioni) | |
| A14 | Stile standard / paper (`api/stile.php`, `users.ui_style`) | sync impostazioni | Impostazioni › Aspetto | P2 | scritto e provato con test (stile, colore, lingua), da provare sul telefono | |
| A15 | Colore del sito (`api/accento.php`, `lib/accent.php`, `users.ui_accent`) | sync impostazioni | Impostazioni › Aspetto › Colore | P2 | fatto — scelta del colore (chiaro/scuro) nelle impostazioni | |
| A16 | Menu dell'avatar: stile, colore, lingua, barre d'uso dell'IA (`partials/notifiche_widget.php`) | `home/ai_usage` (solo online) | Pannello profilo | P2 | fatto — nella pagina Account la scheda «Uso dell'IA questo mese» (piano, tre barre, data di azzeramento); sparisce senza rete o senza piano. Stile, colore e lingua stanno nelle Impostazioni | |
| A17 | Notifiche del widget (richieste di amicizia: sul sito il social è SPENTO) | — | rimandata alla fase social | — | da confermare | |
| A18 | Barra laterale / menu (`partials/sidebar.php`, `sidebar.html`): scorciatoie «Inserisci» (`fc_corsi_lista.php`) | — | Barra a schede in basso + «Altro»; scorciatoia Inserisci | P2 | fatto — «+ Inserisci» nel riquadro Flashcard della Home: Università (scegli il mazzo → inserimento) o Vocabolario (la lingua → corso) | |
| A19 | Blocco con Face ID / impronta | — (solo locale) | Impostazioni › Sicurezza (NUOVO rispetto al sito, spento di default) | P4 | **fatto** (da provare sul telefono: serve Face ID, impronta o codice) | |
| A20 | Coda «problemi di sincronizzazione» e «conservate entrambe le versioni» | `sync/*` | Impostazioni › Sincronizzazione (NUOVO: serve al protocollo) | P1 | fatto | Pagina «Sincronizzazione»: stato, «Sincronizza ora», modifiche rifiutate con motivo semplice e «Ho capito». «Conservate entrambe le versioni»: il protocollo non le crea (vince il server), quindi non c'è altro da mostrare |
| A21 | Quota immagini/audio e spazio usato | `sync/quota` (nuova) | Impostazioni › Spazio | P2 | da fare | |

## 2. Home (`home/`)

| # | Funzione | Area API | Schermata app | Fase | Stato | Firma |
|---|---|---|---|---|---|---|
| H1 | Griglia di widget personalizzabile e ordine (`home_layout`, `home_core.js`) | sync `home_layout` | Home | P2 | fatto | Home è la prima scheda; ordine e on/off salvati sul telefono e sul sito (`home/layout`). Non è una griglia: sul telefono i riquadri vanno uno sotto l'altro. |
| H2 | Modalità «personalizza» (accendi/spegni, ordine, frecce delle scorciatoie) | sync `home_layout` | Home › Personalizza | P2 | fatto | Personalizza: mostra/nascondi, su/giù, ◀ ▶ dei tasti rapidi, Ripristina. Mostra solo i tasti delle pagine che esistono già. |
| H3 | Widget «Oggi»: ora, anelli abitudini, pastiglie in ritardo, prossima data importante, ore, to do/to buy di oggi | locale (da DB) | Home | P2 | fatto | Adesso/Libero, eventi di oggi e domani, anelli abitudini, pastiglie in ritardo (Presa/Salta), prossima data importante, to do di oggi (si spuntano), spesa. Mancano: blocchi del piano progetti, «ore della settimana». |
| H4 | Widget Note (nota veloce) | sync `todo_notes` | Home | P2 | fatto | Stessa nota veloce del To do (si salva da sola). |
| H5 | Widget Flashcard, Progetti, Voti, «I tuoi numeri» | locale (da DB) | Home | P3 | fatto | Progetti fatto (preferiti o in corso, con il tempo). Flashcard (bozze veloci), Voti e «I tuoi numeri» (anello di ciò che sai, serie, precisione, record, carte, ultimi 7 giorni; studio e lingue insieme) fatti. Riquadro Flashcard completo: obiettivo di oggi, righe Continua/Gioca per studio e lingue (mazzo da giocare adesso come sul sito), bozze veloci. |
| H6 | Widget Trivia (`trivia.json`, `trivia_en.json`) | file nell'app | Home | P4 | fatto | Stessi file del sito nell'app; tocca per scoprire, «Presa bene / Mancata». |
| H7 | Bozze veloci di flashcard (`fc_quick_drafts`: solo il fronte, finita dopo) | sync `fc_quick_drafts` | Home › Bozze | P3 | **fatto** (scheda «Carta veloce» nella Home: salva il fronte, completa con retro e mazzo; sincronizzata, provata sul server) | |
| H8 | Colpo d'occhio all'avvio: ultimo stato subito, poi aggiornamento (cache in localStorage sul sito) | — | non serve: tutto viene dal DB locale | P2 | assorbito | non serve: tutto viene dal DB locale |
| H9 | Landing page pubblica (`landing_content.php`) | — | nessuna (è il sito) | — | non si porta | |

## 3. Planner (`planner/planner.php`, `lib/planner/`)

| # | Funzione | Area API | Schermata app | Fase | Stato | Firma |
|---|---|---|---|---|---|---|
| P1 | Vista giorno (`pl_giornata.php`) | sync planner | Planner › Giorno | P2 | fatto (giorno, ore, fasce, ora attuale) | |
| P2 | Vista settimana + «settimana» con righe (`planner_weeks`, liste settimanali) | sync planner | Planner › Settimana | P2 | fatto: vista settimana, numero della settimana (si calcola come il sito e si cambia a mano, sync `planner_weeks`), pannello settimana (to do, to buy, pastiglie, diario coperto). Linguetta «to study» fatta (blocchi di studio del giorno con i loro argomenti, pomodori fatti/stimati, spunta l'argomento). Frase e affermazione della settimana fatte (stessa scelta del sito: stessa frase sul sito e sul telefono). Le vecchie `planner_week_lists` del sito non si usano più nemmeno lì | |
| P3 | Vista mese | sync planner | Planner › Mese | P2 | fatto (griglia del mese, tocca per aprire il giorno) | |
| P4 | Eventi: crea, modifica, sposta (`event_move`), copia giorno, spunta, cancella | `events` (pronta) → sync `planner_events` | Scheda evento | P2 | fatto: crea, modifica, spunta, cancella (spostare con trascina: da fare) | |
| P5 | Ripetizioni (giornaliera, settimanale, mensile, annuale, personalizzata, `rrule`), eccezioni per una sola occorrenza (`original_date`, `is_cancelled`) | logica da portare in TS | (dentro Planner) | P2 | fatto — test d'oro contro PHP, DST sistemato anche sul sito | |
| P6 | Invitati (`event_guests`) e rubrica (`contacts`) | sync | Scheda evento › Invitati | P2 | fatto: invitati nella scheda evento (da rubrica o scritti a mano, fino a 30, nome copiato dalla rubrica), rubrica nella pagina Calendari e categorie, la barra intelligente invita «con luchino». Sync `contacts`, `event_guests` | |
| P7 | Calendari (colore, visibilità, solo uno, regole) | sync `planner_calendars` | Planner › Calendari | P2 | fatto (schermata Calendari e categorie) | |
| P8 | Categorie e parole chiave | sync `planner_categories`, `_keywords` | Planner › Categorie | P2 | fatto (schermata Calendari e categorie) | |
| P9 | Luoghi e rubrica dei luoghi; ricerca luoghi e dettaglio | sync `planner_places`; ricerca **solo online** | Scheda luogo + mappa | P2 | fatto in parte: luoghi salvati (nome, parole d'aggancio, indirizzo; sync `planner_places`), scelte rapide nella scheda evento con il luogo che il titolo nomina evidenziato, coordinate che si copiano nell'evento. Da fare: cerca un luogo (solo online) e la mappa (P10) | |
| P10 | Mappa dei luoghi | — (`react-native-maps`) | Mappa | P2 | da fare (serve la chiave Google Maps per Android: vedi §8) | |
| P11 | Priorità del giorno (`planner_priorities`) | sync | Planner › Priorità | P2 | fatto (scheda nel giorno: scrivi, spunta, fino a 6; sync con UUIDv5) | |
| P12 | Routine (gruppi di righe, comprimi/ricompatta, inserisci) | sync `planner_routines`, `_items` | Planner › Routine | P2 | fatto (crea/cambia routine, inserisci a un'ora, apri/chiudi, elimina il blocco) | |
| P13 | Preferiti | sync | Planner › Preferiti | P2 | fatto | Foglio «Abitudini e progetti» (link sotto la routine): abitudini del giorno, settimanali con il conto, progetti preferiti; si sceglie l'ora e la durata. Sul sito si tocca il calendario; sul telefono si scrive l'ora. Il server ora porta `project_uuid` sugli eventi |
| P14 | Barra intelligente (data, ora, durata dalla frase: `04_barra_e_priorita.js`, `planner_smart.json`) | locale | Barra rapida | P2 | fatto: `planner/smart.ts`, test d'oro su 864 casi contro il vero codice del sito (`scripts/gen-planner-smart.mjs`); i nomi dalla rubrica arrivano con P6 | |
| P15 | Impostazioni del planner (`planner_settings`) | sync | Planner › Impostazioni | P2 | fatto in parte — schermata Impostazioni (⚙ nel planner): colore della pagina, frasi, alberi e animali, scatti degli orari, contrasto, giorni affiancati (tablet); il planner usa colore, contrasto, zoom e ora d'inizio. Frasi e affermazioni sulla settimana fatte. Da fare: sfondi animati (P20) | |
| P16 | Meteo (`meteo_api.php`: stato, attiva, anteprima, ricerca luogo) | `weather/*` (nuova) | Planner › Meteo | P4 | solo online | |
| P17 | Google Calendar (`google_calendar.php`: collega, calendari, mappa, push, ripara, sincronizza, scollega) | `google/*` (nuova, OAuth da browser di sistema) | Impostazioni › Google Calendar | P4 | solo online | |
| P18 | Pastiglie la cui ora è passata, chieste in basso nel planner (✓ presa, Saltato, × per ora, Chiudi tutti) | locale | Planner | P2 | fatto | Come `renderAvvisi` del sito; solo vista giorno |
| P19 | Ricerca eventi (`search`) | locale (SQLite LIKE, come il sito) | Cerca | P2 | fatto: lente nell'intestazione, almeno 2 lettere, i più vicini a oggi per primi (max 60), tocco = vai al giorno e all'ora; con test | |
| P20 | Ambienti/sfondi (`planner_ambient.json`) | file nell'app | Planner | P4 | da fare | |

## 4. To do / To buy / Pastiglie (`planner/todo.php`: schede `todo`, `buy`, `pills`)

| # | Funzione | Area API | Schermata app | Fase | Stato | Firma |
|---|---|---|---|---|---|---|
| T1 | To do: elenco, crea, modifica, spunta, cancella, sotto-attività, data/ora/durata, progetto | `tasks` (pronta) → sync `todos` | To do | **P1** | scritto con l'aspetto del sito (OK di Nico il 02/11/2026), in chiaro/scuro e nelle due vesti, provato con test · da provare sul telefono · manca il progetto (Fase 3) | |
| T2 | Riordino e azioni su più voci (cancella, programma, progetto, sposta) | `tasks/bulk`, `reorder` → `sort_key` | To do › selezione | P1/P2 | fatta la selezione con cancella (con conferma) e «data e ora» per tutte insieme · mancano «progetto» (Fase 3) e il riordino a trascinamento | |
| T3 | Barra intelligente del to do (`todo_barra.js`, `todo_smart.js`) | locale | To do › barra rapida | P2 | fatta: lettore di frasi (`smart.ts`, **test d'oro**: 168 risultati uguali al sito), «cosa ho capito» sotto la barra, gruppi per giorno, righe a riposo con una frase sola, scorciatoie per la data (Oggi/Domani/Weekend/Fra una settimana/Senza data), scorrimento per cancellare · manca il microfono (Fase 4) | |
| T4 | Nota veloce in cima (`todo_nota.js`): si salva da sola | `notes/quick` (GET/PUT, 409 se cambiata: si tengono le due versioni) | To do › Nota | P2 | scritto e provato con test (anche contro il server vero), da provare sul telefono | |
| T5 | Smista la nota a mano (regole di `todo_smart.js`) | locale | To do › Nota › Smista a mano (schermata di conferma) | P2 | fatto per To do e To buy (con data, ora, categoria, prezzo); le voci «evento» e «progetto» diventano attività finché non ci sono Planner e Progetti, poi si aggiungono · da provare sul telefono | |
| T6 | Smista la nota con l'IA (`todo_nota_ai.php`, crediti) | `ai/*` | To do › Nota › Smista con IA | P3 | solo online | |
| T7 | To buy: articoli, categorie (colore), priorità, prezzo, link, totale, «Carrello» | `shopping` (pronta) → sync | To buy | P2 | scritto e provato con test, da provare sul telefono | |
| T8 | To buy con immagine dell'articolo | `shopping/{id}/image` → coda media | To buy | P2 | fatto — nei dettagli dell'articolo si sceglie, si scatta o si toglie la foto (coda file sul telefono); la foto privata si scarica col token e resta sul telefono (nuova rotta `GET /media/todos/{uuid}/buy_image`) | |
| T9 | Memoria degli acquisti frequenti/storico (`todo_buy_memory`, `buy_forget`) | sync | To buy › suggerimenti | P2 | API pronta | |
| T10 | Le due vesti del to buy: «Corsie» (standard) e «Scontrino» (paper) | — | To buy (due viste) | P2 | scritto (OK di Nico sull'aspetto il 02/11/2026), da provare sul telefono | |
| T11 | Microfono nella barra del to buy (una frase = un articolo) | voce locale | To buy › microfono | P4 | da fare | |
| T12 | Pastiglie: terapie, prese, arretrate, calendario, storico, «prese tutte» | `pills` (pronta) → sync | Pastiglie | P2 | dati, sincronizzazione e regole fatti e provati (terapie, prese, arretrate, calendario, storico, «prese tutte»; il server ora sincronizza anche le pastiglie) · schermata scritta con l'aspetto del sito (in chiaro/scuro e nelle due vesti): prese di oggi per orario, arretrate in rosso con «Prese tutte», scheda terapia, calendario con «quante prese», tab «Pastiglie» · da provare sul telefono · mancano i promemoria (T14) | |
| T13 | Programmazione delle dosi (ritmo: giorni, mese, ogni N giorni, orari) | logica in TS | (dentro Pastiglie) | P2 | fatta (`pills/logic.ts`, **test d'oro** contro il codice vero del sito, a prova di ora legale) | |
| T14 | Promemoria delle pastiglie | notifiche locali | Impostazioni › Promemoria (una notifica per orario; si rifanno a ogni cambiamento) | P2 | scritto e provato con test, da provare sul telefono | |
| T15 | Progetto collegato a un'attività, «chiudi pomodoro» (`pomodoro_close`) | sync | To do › progetto | P3 | fatto: collegare/scollegare un progetto (tasto nella riga aperta), nome sotto l'attività; il server porta `project_uuid` sulle attività · «chiudi pomodoro»: da fare insieme al post-it del Pomodoro | |
| T16 | «To study» (`to_study.php`, `study_api.php`, `to_study_progetti.css`): **sul sito è stato sostituito dal Piano dei progetti** (la pagina dice «ora vive dentro Progetti»; la scheda non esiste più nel To do) | — | non si porta | — | **da confermare** (§8, domanda 3) | |

## 5. Abitudini (`planner/habits.php`, `habits_import.php`)

| # | Funzione | Area API | Schermata app | Fase | Stato | Firma |
|---|---|---|---|---|---|---|
| B1 | Elenco abitudini (iniziate / future con «Vedi abitudini future»), anelli | `habits` (pronta) → sync | Abitudini | P2 | fatto: intestazione con tasti tabella/statistiche, carosello a 7 carte, fascia dei giorni, carta del giorno con chip, filtri (tutte/da fare/fascia), gruppi nell'ordine del sito, sezioni settimanali/mensili/personalizzate, «future» · scorrimento laterale (fatto/annulla) e impostazioni fatti · la carta del giorno mostra umore e nota del diario e ha il tasto «Scrivi» (apre il Diario in quel giorno) · manca: coriandoli/suono | |
| B2 | Crea/modifica/archivia/elimina, ordine | sync `habits` | Abitudini › Scheda | P2 | fatti: modulo completo (icona, preset del sito, colori, categoria, tipo, obiettivo, frequenza, momento, durata, minuti planner, motivazione, inizio), modifica, archivia, elimina, «future» · archiviate/ripristina e riordino a trascinamento fatti (dalle Impostazioni) | |
| B3 | Check-in (fatto/parziale/saltato/fallito, quantità, nota, umore) | `habits/{id}/log` → sync `habit_logs` | Abitudini | P2 | fatto: tocco, salta, «ci sono cascato», annulla, nota e umore (foglio nota). Il sito non ha una quantità scritta a mano: non serve | |
| B4 | Serie e record (`habit_streak_records`: **calcolati**, non si sincronizzano) | logica in TS | — | P2 | fatto: serie, record, carte del carosello, «Statistiche» e «Vista tabella» con test d'oro sui numeri del sito · manca: record salvato sul server (`best_streak`) | |
| B5 | Traguardi (`habit_achievements` catalogo, `habit_user_achievements`, «visti») | catalogo nell'app + sync | Abitudini › Traguardi | P2 | fatto: catalogo di 17 traguardi in `achievements.ts` (da `docs/data/habit_achievements.sql`), calcolati sul telefono con le regole del sito e mostrati in «Statistiche › Traguardi» (sbloccati/bloccati, livello) · finestra «Traguardo sbloccato» fatta (una volta per traguardo; i «visti» stanno sul telefono, i traguardi già raggiunti alla prima apertura non fanno festa) | |
| B6 | Categorie di abitudini | `habits/categories` → sync | Abitudini › Categorie | P2 | fatto: le categorie si scelgono nel modulo e servono a statistiche/radar · il sito non ha una pagina per gestirle, quindi non serve una schermata | |
| B7 | Distribuzione per ora (`hour_distribution`) | locale | Abitudini › Statistiche | P2 | fatto — grafico «Quando ti muovi» (check-in per ora, ultimi 90 giorni) dall'ora del primo check-in | |
| B8 | Diario delle abitudini (`journal_save`, `habit_daily_journal`) | sync | Abitudini › Diario | P2 | fatto | Il diario delle abitudini è lo stesso del Diario (stessa tabella): si scrive da lì; la carta del giorno lo mostra |
| B9 | Promemoria (`habit_reminders`: il sito non ha ancora una schermata) | notifiche locali | Impostazioni › Promemoria (una notifica al giorno, a un'ora scelta, con le abitudini ancora da fare) | P2 | scritto e provato con test, da provare sul telefono | |
| B10 | Impostazioni abitudini (`habit_settings`) | `GET/PATCH habits/settings` (nuova, [app-api]) | Abitudini › Impostazioni | P2 | fatto: colore, giorni in barra, finestra grafici, interruttori (gruppi, carosello, coriandoli, vibrazione, suono), archiviate · mancano: importa, esporta; la vibrazione ora funziona (leggera, su iPhone); coriandoli e suono si salvano ma non fanno ancora nulla | |
| B11 | Importazione abitudini (`habits_import.php`: leggi, rimappa, salva) | `habits/import` (nuova) | Abitudini › Importa | P4 | da fare | |

## 6. Diario (`diario*.php`, `diary_api.php`, `diario_ai.php`)

| # | Funzione | Area API | Schermata app | Fase | Stato | Firma |
|---|---|---|---|---|---|---|
| D1 | Il giorno: umore, energia, testo, due elenchi (cose buone / imparate), abitudini, anelli | sync `habit_daily_journal` + `diary_list_items` (UUIDv5 per giorno); anelli e riepilogo abitudini calcolati sul telefono | Diario › Giorno (scorri per cambiare giorno, «annulla», salvataggio da solo; stile standard e carta) | P2 | scritto e provato con test, da provare sul telefono (manca la dettatura con il microfono) | |
| D2 | Testo lungo: conflitto «conservate entrambe le versioni» | il telefono manda `note_rev` (impronta del testo visto); se il sito è cambiato, il server tiene TUTTE E DUE le versioni, divise da una riga «———», e le rimanda | Diario › Giorno (si vedono nel testo, nessun avviso a parte) | P2 | scritto e provato con test, da provare sul telefono | |
| D3 | Mese (giorni scritti, medie, cose imparate) | locale (dal DB del telefono) | Diario › Mese (calendario con faccine, 4 medie, «cose imparate questo mese») | P2 | scritto e provato con test, da provare sul telefono | |
| D4 | Anno (`diario_anno.php`): tessere, calendario a colori (umore / energia / abitudini), settimane / mesi / anni a confronto | `diary/insights` (serve la rete: il server ha anche pomodori e abitudini di tutto l'anno) | Diario › «Il diario in numeri» (tasto ▥ in basso) | P2 | scritto e provato con test, da provare sul telefono | |
| D5 | Modalità lettura (`diario_lettura.php`): legge i resoconti e i libri scritti dall'IA | `diary/ai`, `diary/ai/reports/{id}`, `diary/ai/books/{id}` (solo lettura, solo online) | Diario › «Il diario in numeri» › Resoconti e libri | P3 | fatto — elenco sotto la pagina dell'anno e schermata di lettura (una colonna, carattere grande, numeri con frecce, indice del libro che salta al capitolo); stampa/PDF no (si legge e basta) | |
| D6 | I numeri del diario (`diario_numeri.php`, `insights`) | vedi D4: è la stessa schermata | Diario › «Il diario in numeri» | P2 | scritto e provato con test, da provare sul telefono | |
| D7 | Impostazioni (carattere, grandezza, carta) | `diary/settings` (GET/PATCH), cambiano subito anche senza rete | Diario › «Aa» (6 scritture in standard, 5 sulla carta; corpo 14–26). La carta a righe / a puntini / bianca si salva ma sul sito non c'è un selettore | P2 | scritto e provato con test, da provare sul telefono | |
| D8 | Libri del diario scritti dall'IA (`diary_ai_books`) e rapporti trimestrali (`diary_ai_reports`) | `ai/*`; i risultati si sincronizzano (solo lettura) | Diario › Libri e rapporti | P3 | leggerli: fatto (D5); crearli con l'IA e i crediti: da fare, solo online | |
| D9 | Schermata nascosta nel selettore app (con blocco attivo) | — | — | P4 | **fatto** (copertura quando l'app esce dal primo piano; da provare sul telefono) | |

## 7. Progetti, Piano e Pomodoro (`projects/`)

| # | Funzione | Area API | Schermata app | Fase | Stato | Firma |
|---|---|---|---|---|---|---|
| J1 | Albero dei progetti (`progetti.php`: figli, nipoti, preferiti, date, colore, note, stato) | sync `projects` | Progetti | P3 | in parte: albero con stato (anche a cascata e ripristino), preferiti, scadenze, tempo di lavoro, opzioni della pagina (solo su questo telefono), scheda del progetto (nome, colore, date, nota di testo, sposta, riordina, sotto-progetti, elimina con scelta sui Pomodoro). Mancano: nota con formato (si legge, non si riscrive), attività del progetto (todo_enabled), mazzi collegati, selezione multipla/azioni di gruppo, vista a griglia | |
| J2 | Selettore di progetto (`project_selector.php`) | locale | selettore | P3 | fatto: scelta del progetto (albero con colori) nel Pomodoro, nello storico e per spostare un progetto | |
| J3 | Vista Elenco / Calendario / Piano dentro un progetto | sync piano | Progetto › Piano (scheda) + pagina Piano con `project` | P3 | **fatto** (solo da provare sul telefono) | scheda «Piano» nel progetto; la pagina Piano da solo il ramo |
| J4 | Piano: obiettivi (minuti, tipo, priorità, scadenza), divisione fra i figli con lucchetto | sync `plan_goals` | Progetto › Piano | P3 | **fatto** — test d'oro (400 casi) | al posto dello slider: −/+ 15 min o scrivi le ore |
| J5 | Evidenziatore dei giorni (`plan_paint`) e blocchi del giorno (`plan_days`) | sync | Piano › Calendario | P3 | **fatto** | tocca o trascina; Cancella, Guarda, Annulla (30 passi) |
| J6 | «Pianifica per me» (`pn_pianifica`: anteprima, applica, non tocca i blocchi manuali) | logica in TS | Piano › Pianifica | P3 | **fatto** — test d'oro | specchia il sito: un blocco a mano nello stesso giorno fa cadere la parte automatica |
| J7 | Progetti › Calendario: Oggi / Calendario / Panoramica / Cronologia (timeline) | locale | Piano (4 schede) | P3 | **fatto** | Oggi, Calendario, Linea del tempo, Panoramica |
| J8 | «Il tuo tempo» (impostazioni del piano, `plan_settings`) | sync | Piano › Il tuo tempo | P3 | **fatto** (sync lato server aspetta la migrazione 08) | |
| J9 | Modelli di piano (`plan_templates`) | sync | Progetto › Piano › Modelli | P3 | **fatto** | |
| J10 | «Porta le stime nel nuovo piano» (`import_old`) e salta/riporta (`skip_fix`) | logica | Piano / Progetto | P4 | **fatto** | |
| J11 | Registro giornaliero «Ho già fatto» e avvio con minuti preimpostati (`daily_log`) | sync `pomodoro_sessions` | Piano › Oggi | P3 | **fatto** | il Pomodoro riceve `min` e `auto=1` |
| J12 | Pomodoro: timer, pausa, riprendi, ferma (chiede pausa/fine/scarta), durate personalizzate | sync `pomodoro_sessions`, `pomodoro_custom_durations`, `pomodoro_settings` | Pomodoro | P3 | fatto: schermata con timer/cronometro, pausa, ferma (pausa/fine/scarta, «molto breve»), durate personalizzate, progetto, pausa dopo lo studio (sessioni, durate e impostazioni si sincronizzano) | |
| J13 | Barra globale del Pomodoro (`pomodoro_barra.*`) | locale | mini-barra sopra le schede | P3 | fatto: barretta sopra le schede con il tempo (Pomodoro, cronometro, pausa); tocco = apre il Pomodoro | |
| J14 | Pause e scene (`pausa_scena.php`, `pomodoro_current_breaks`), clessidra (`clessidra.php`) | sync | Pomodoro › Pausa | P3 | da fare — **serve il tuo OK sull'aspetto** (scene animate) | |
| J15 | Storico del Pomodoro (`pomodoro_storico.php`: modifica, cancella) | locale | Pomodoro › Storico | P3 | fatto: panoramica (oggi/ieri, settimana, mese, serie, ora migliore, progetto della settimana), elenco per giorno con filtri e ordine, aggiungi/correggi/cancella a mano, azioni su più righe. Mancano: torta di «oggi» e giorni a pagine di progetto | |
| J16 | Importazione Pomodoro (`pomodoro_import.php`) | `pomodoro/import` (nuova) | Pomodoro › Importa | P4 | da fare | |
| J17 | Nota automatica (`nota_auto.js`) | locale | — | P3 | fatto: la nota del progetto si salva 600 ms dopo l'ultimo tasto e quando si chiude la pagina; offline funziona già (il telefono scrive in locale e sincronizza dopo) | |
| J18 | Notifica di fine Pomodoro | notifica locale | — | P3 | fatto: notifica locale all'ora di fine, anche con l'app chiusa; le pausa pure | |
| J19 | Mazzi collegati a un progetto (`fc_study_deck_projects`) | sync | Progetto › Mazzi | P3 | **fatto** (scheda «Flashcard» nel progetto; regole del sito: una materia per progetto, non se lei, un padre o un figlio è già di un altro; provata sul server) | |

## 8. Voti / Esami (`exams/voti.php`)

| # | Funzione | Area API | Schermata app | Fase | Stato | Firma |
|---|---|---|---|---|---|---|
| V1 | Esami: voto, lode, idoneità, CFU, stato, previsione, anno, media nazionale | sync `university_exams` | Voti | P3 | fatto — lista fatti / da fare / simulatore, editor, selezione e cancellazione | |
| V2 | Gruppi di esami e media del gruppo | sync `university_exam_groups` | Voti | P3 | fatto — a scelta e suddiviso, quota, voto complessivo, scioglimento | |
| V3 | Bonus e tetti | sync `university_bonuses` | Voti › Bonus | P3 | fatto — 5 tipi, tetto, soglia, interruttore | |
| V4 | Media, voto di laurea e previsioni | logica in TS | Voti | P3 | fatto — **test d'oro** su 150 casi del codice vero del sito; media, /110, lodi, stima, obiettivo, andamento | |
| V5 | Catalogo degli esami (`exams_catalog.json`, `catalog_code`) | file nell'app | Voti › Aggiungi | P3 | fatto — 43 corsi / 11 facoltà, carica «sostituisci / aggiungi» | |
| V6 | Impostazioni (`university_settings`) e «oro dei Voti» (`lib/colore_voti.php`) | sync | Voti › Impostazioni | P3 | fatto — corso, colore facoltà, CFU, base, lode, tesi, arrotondamento (sync REST). Da fare: «oro» dei Voti (colore dei riquadri) | |

## 9. Flashcard (`fc/`, `lib/fc/`) — studio (`fc_study_*`) e lingue (`fc_vocab_*`)

| # | Funzione | Area API | Schermata app | Fase | Stato | Firma |
|---|---|---|---|---|---|---|
| F1 | Hub (`fc_home.php`): scheda Studio, scheda Lingue (una riga per corso), anello obiettivo, «schede che conosci», grafico | locale | Flashcard | P3 | in corso — scheda con l'obiettivo di oggi e le carte imparate, Gioca, Storico, Statistiche, Continua e l'elenco dei mazzi con i numeri; la scheda Lingue c'è (conta lingue e parole, apre l'elenco); grafico «Carte che sai» fatto (giorni/settimane/mesi, i due numeri studio e lingue che filtrano, «+N» di oggi/settimana/mese; il giorno è quello del sito: tastino o prima volta a «la sai», `learned.ts` con prove) | |
| F2 | Lingue/corsi: aggiungi, variante, progetto, elimina, ordina (`fc_languages.*`) | sync `fc_vocab_courses` | Lingue | P3 | fatto — elenco delle lingue (63, con bandiera), scelta della lingua conosciuta, ricerca, «più studiate», corso con il suo progetto (si riusa uno col nome della lingua), cambio d'accento, ordine su/giù, elimina con conteggio; mazzi ad albero, parole, parole figlie, esempi, preferiti, imparate. gioco di lingua (partite parola→traduzione, traduzione→parola, misto; indizi aperto/tocco/dopo; record; storico; risultato; sync completa). **Da fare:** collegare un progetto diverso a mano, voce/pronuncia (F9), (la pagina statistiche delle lingue non c'è nemmeno sul sito) | |
| F3 | Mazzi e sotto-mazzi annidati: crea, rinomina, colore, icona (`fc_icone.php`), note, fissa, archivia, data d'esame con conto alla rovescia (`fc_decks.php`) | sync `fc_*_decks` | Mazzi | P3 | fatto — alberi, colore ereditato, icone (57), note, fissa, archivia, esame con conto alla rovescia, cerca. Come il sito, si elimina solo una categoria vuota. Mancano: vista a griglia, selezione multipla, ricerca nel testo delle carte | |
| F4 | Numeri del mazzo e badge «da ripassare» (`fcm_badge_ripasso`, `fc_api_counts.php`) | locale | Mazzi | P3 | in corso — riga dei numeri (partite, ultima volta, barra dei livelli, % che sai) e badge «da ripassare» fatti; il confronto d'oro con il sito sui numeri del mazzo da fare | |
| F5 | Inserisci schede (`fc_insert.php`, `fc_insert_card.php`, `fc_insert_save.php`): righe nuove/modificate/cancellate, salvataggio automatico (`fc_autosave_bar`) | sync `fc_*_cards` | Inserisci | P3 | in corso — inserimento di molte carte in un mazzo: righe domanda/risposta e incolla-e-capisce; righe figlie, salvataggio automatico, immagini e audio per riga da fare | |
| F6 | Modifica carta (`fc_card_edit.php`, `fc_edit_popup`) e visualizza (`fc_view.php`) | sync | Carta | P3 | in corso — vedi, modifica (testo semplice), sposta, elimina fatto; i testi con formato si leggono ma non si riscrivono ancora; le immagini delle carte si vedono (dal sito); in modifica si sceglie, si scatta o si toglie la foto di domanda e risposta (resta sul telefono e parte quando c'è rete); audio di domanda e risposta si registra e si toglie | |
| F7 | Editor ricco (`fc_parser.js`, `format_toolbar.php`): elenchi, checklist, citazioni, codice con colori, evidenziatore | modello documento in TS | Editor | P3 | in corso — editor ricco fatto: un blocco per riga, grassetto, corsivo, sottolineato, evidenziatore, 6 colori, elenco a più livelli, checklist, citazione, codice, formula (LaTeX), rientro, anteprima; da fare: disegno delle formule, scelta del linguaggio del codice, colore dell'evidenziatore e dei pallini, cancella formattazione, dettatura | |
| F8 | Immagini: caricamento e editor immagini (`fc_image_editor.*`), misure (`fc_image_sizes.php`) | coda media | Editor immagini | P3 | in parte — le immagini si vedono nella carta e nel gioco; da telefono si sceglie dalla libreria o si scatta (ridotta a 1600 px, JPEG), coda sul telefono che riprova e aspetta che la riga sia sul sito (rotta `/media` già online) per carte, parole di lingue, figlie ed esempi; editor immagini (ritaglio/misure) da fare | |
| F9 | Audio: registratore (`fc_audio_recorder.js`) e lettore (`fc_audio_player`) | coda media | Audio | P3 | in corso — il lettore è fatto (tasto ascolta su ogni lato della carta e nel gioco, scarica dal sito; suona anche con il tasto silenzioso); registratore nella modifica della carta (m4a, al massimo 2 minuti, chiede il microfono); la registrazione resta sul telefono e parte quando c'è rete | |
| F10 | Esempi (`fc_examples_*`, `fc_vocab_examples.js`, parte nascosta, «Aggiungi esempio») e esempi con lacuna (`fc_vocab_gap`) | sync `fc_*_examples` | Esempi | P3 | in parte — esempi delle carte di studio: elenco, aggiungi, modifica, elimina, immagine dell'esempio visibile; audio e caricamento dopo. Lacune (solo lingue): fatto — stesso calcolo del sito (`languages/gap.ts`, provato su ~4.900 frasi contro `fc_vocab_gap.js`), parte nascosta nel gioco che si riempie alla risposta, scelta a mano a pezzi con «Automatica / Azzera». Da fare: lacuna nell'inserimento multiplo e nell'import | |
| F11 | Sotto-carte (padre/figlia, titoli di gruppo `fcv_titoli_studio`) | sync `fc_*_subcards` | Carta | P3 | fatto — carte figlie: aggiungi, apri, modifica, elimina; il padre diventa «padre» da solo. Mancano i titoli di gruppo | |
| F12 | Importazione intelligente (`fc_smart_import.js`) e abbinamento (`fc_ai_match.js`) | locale + IA | Inserisci › Importa | P3 | in corso — importa da Excel, CSV, JSON e «domanda - risposta» (portato dal sito, confronto d'oro sui casi); abbinamento IA e generazione IA da fare (solo online) | |
| F13 | Preferiti | sync `fc_*_favorites` | Carta | P3 | fatto — interruttore sulla carta e nel gioco | |
| F14 | Imparate (`fc_learnt.php`: padre/figlio) | sync `fc_*_learnt` | Carta | P3 | fatto — interruttore «imparata» sulla carta e il tasto «Imparato» nel gioco | |
| F15 | Elenco/visualizza carte con filtri (imparate/da imparare), livelli | locale | Mazzo › Carte | P3 | fatto — elenco con livello, «imparata», filtro da imparare/imparate, ricerca nel testo, filtro per livello (con conteggi), 5 ordinamenti, contatore, selezione multipla con sposta ed elimina; resta solo la vista a griglia (scelta di aspetto) e unisci/separa | |
| F16 | Livelli delle carte (nuova, sembra facile, facile, difficile…: `fcv_livello_prefisso`, **gemello** `livello()` in `fc_game_juice.js`) | logica in TS | — | P3 | fatto — livelli (colori e nomi del sito) in tutte le schermate; confronto d'oro già nei test | |
| F17 | Impostazione del gioco (`fc_game_setup.php`: livelli, solo difficili, ordine casuale/in ordine) | sync `fc_settings` | Gioco › Imposta | P3 | fatto — ordine, stato delle carte, livelli, «solo le difficili», più categorie nell'ordine scelto (la tabella `fc_settings` riguarda gli indizi del vocabolario e la voce, non la partita) | |
| F18 | Gioco (`fc_game.php`): studio e vocabolario, risposta velata, percorso a dischi con colori della categoria, checkpoint (`fc_game_juice.js`), round «boss», cronometro (`fc_game_durations`), pausa massima | sync `fc_games`, `fc_*_plays`, `fc_*_sequence` | Gioco | P3 | in corso — versione semplice: un concetto alla volta, risposta, voto, imparato, preferito, cambia verdetto, concludi con conferma; riprendi dalla Home/Flashcard. Animazioni, percorso a dischi, checkpoint, boss: da fare con il tuo OK | |
| F19 | Riprendi una partita lasciata a metà (`fc_ripresa.php`) e «carte aggiunte dopo» (`fc_nuove_carte.php`, `fc_game_nuove.php`) | locale | Gioco | P3 | in corso — «Continua» nella schermata Flashcard; «carte aggiunte dopo»: fatto — alla ripresa (e solo se la partita non è un ripasso) la schermata chiede «Hai aggiunto N carte: giocare anche quelle?»; sì = in coda alla sequenza e i totali crescono, no = non lo richiede per le stesse carte. Il telefono ricorda l'ordine di nascita delle carte in una tabella sua (`card_birth`, migrazione v20), perché il rowid cambia quando una riga torna dal server; usa lo stesso campo `max_card_uuid` del sito | |
| F20 | Riprova gli errori (`fc_game_retry.php`: partita figlia) | sync | Risultato › Riprova | P3 | fatto — «Rigioca errori» dal risultato | |
| F21 | Risultato della partita (`fc_result.php`) | locale | Risultato | P3 | in corso — punteggio, giuste/sbagliate, durata, elenco con verdetto cambiabile, rigioca; confronto con l'ultima volta e strada verso il 100% fatti; pagine da fare | |
| F22 | Cronologia (`fc_history.php`) | locale | Cronologia | P3 | in corso — elenco per periodo con i ripassi dentro la madre, filtri (stato, carte, materia), ordine, riepilogo, riprendi, apri, elimina; grafico dell'attività (giorno/settimana/mese, come il sito) e vista «Materie» (albero con i numeri del ramo, giocate/non toccate, ordini, tocca per filtrare, «Gioca»), anche per i corsi di lingua. periodo con date a scelta (dal/al), interruttore compatta/dettagliata (ripassi e tasto «Ripassa errori»/«Vedi gli errori» che apre il risultato già sulle sole errate). ogni ripasso è una riga (si apre, o si elimina se lasciato a metà). Da fare: «da sistemare» e la strada al 100% | |
| F23 | Statistiche (`fc_stats.php`) calcolate dal registro delle risposte | locale | Statistiche | P3 | in corso — carte giocate, precisione, tempo, serie, obiettivo di oggi, andamento, quando giochi, traguardi, panoramica mazzi, carte più sbagliate per materia, miglioramento dopo un errore, padronanza delle carte, punteggi delle partite; previsioni, velocità, calendario, Pomodoro collegato da fare | |
| F24 | Record e obiettivi (`fc_*_records`, `fc_goals`) | sync | Statistiche | P3 | in corso — obiettivo giornaliero e record (serie migliore, carte padroneggiate) fatti; il record «tratto più veloce» arriva con i checkpoint del gioco | |
| F25 | Selettore di mazzo (`fc_deck_selector.php`) | locale | selettore | P3 | fatto — scelta ad albero con ricerca e «+» per creare un mazzo al volo (sotto il mazzo scelto o in cima), usato per spostare carte e mazzi | |
| F26 | Modalità vocale a mani libere (`fc_voice_mode.*`, comandi `fc.cmd_*`, `fc_speak.js`, `fc_read_aloud.js`) | locale (voce + riconoscimento) | Gioco › Voce | P3 | da fare (libreria da scegliere in P3) | |
| F27 | Pannello IA (`fc_ai_panel.*`, `fc_ai.php`, `fc_ai_fab`): genera schede, immagini (`fc_ai_immagine.php`), «Migliora» (`fc_improve_card.php`) | `ai/*` | Inserisci › IA | P3 | solo online | |
| F28 | Spiega / Metafora / Esempio con IA (`ai_generate_text.php`, `ai_example.php`); testi salvati (`fc_study_ai`, `fc_study_ai_child`) | `ai/*`; i testi salvati si sincronizzano | Carta › IA | P3 | solo online | |
| F29 | Frantuma (`ai_shatter.php`, `ai_shatter_save.php`) | `ai/*` | Carta › Frantuma | P3 | solo online | |
| F30 | Tutor audio (`ai_tutor.php`) | `ai/*` | Carta › Tutor | P3 | solo online | |
| F31 | Lettura ad alta voce (`fc_speak.js`) | voce locale | — | P3 | fatto — `expo-speech` (voce del telefono, nessuna rete): stessa scelta della voce del sito (lingua esatta, voci di qualità, mai Eloquence), parola due volte (la seconda più lenta), frasi e traduzioni una volta. Tasto «ascolta» nel gioco (domanda, risposta, esempi solo dopo la risposta), nella pagina della parola (parola, traduzione, figlie, esempi). Da provare sul telefono (le voci cambiano da telefono a telefono); il tasto c'è anche nella pagina dei risultati (mazzi di lingua); manca il testo matematico di `fc_read_aloud.js` | |
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

### Voti — cosa resta (semplificato o rimandato)
- Scheda «Costo» (serve il collegamento esame ↔ progetto/pomodoro), blocco «Statistiche» (distribuzione, media per anno, confronto con la media nazionale), riordino con trascinamento, blocchi del simulatore per gruppo (si simula esame per esame).


## Nuovo aspetto dell'app (approvato da Nico il 7/11/2026)

Due vesti scelte in Altro › Stile (stesso campo `ui_style` del sito: `standard` = **Glass**, `paper` = **Calm paper**). I campioni sono nell'artefatto «Standout app – new style samples».

| Pezzo | Stato |
|---|---|
| Colori, forme e carattere dei titoli in un solo posto (`core/theme/skin.ts`), con chiaro/scuro | fatto, con test di contrasto (testo ≥ 4.5:1) |
| Carte, pulsanti, campi, intestazioni (`ui/kit.tsx`) | fatto |
| Barra delle schede: pillola di vetro (Glass) / piatta con linea (Paper) | fatto |
| Movimento: entrata a cascata, affondo al tocco, vibrazioni leggere, rispetta «Riduci movimento» (`ui/motion.tsx`) | fatto; usato in Home e Abitudini |
| Home, Abitudini, Statistiche con medaglie dei traguardi | fatto |
| To do, To buy: carta segue il tema (anche scuro) | fatto |
| Planner, Diario: carta anche in scuro | fatto |
| Flashcards, Pomodoro, Voti, Progetti, Impostazioni: colori, intestazioni, numeri grandi in serif (Paper), entrata a cascata delle carte | fatto; le forme interne delle singole pagine si rifiniscono sul telefono |
| Vetro sfocato vero e scheletri di caricamento | non servono ora: nulla scorre sotto la barra e i dati sono locali (si rivede se cambia) |
