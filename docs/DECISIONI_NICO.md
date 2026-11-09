# Decisioni di Nico (tabellone del 2026-11-09)

Risposte date da Nico nel tabellone «Standout Decision Board» (26 schede). Qui sono scritte con quello che comportano.

## Aspetto
| Scheda | Risposta | Cosa faccio |
|---|---|---|
| Pausa Pomodoro | Scena all'aperto **con le funzioni della schermata calma** | Scena animata (sole, erba, tazza che fuma) + conto alla rovescia grande + un consiglio breve |
| Clessidra | Anello di default, clessidra come opzione | Interruttore nelle impostazioni del Pomodoro |
| Gioco di flashcard | Completo come il sito | Percorso a dischi, checkpoint, round boss, suoni e vibrazione; record «tratto più veloce»; impostazione del checkpoint |
| Giro della carta | «Come il sito (credo non sia 3D)» | Copiare esattamente l'animazione del sito (da controllare nel codice del sito) |
| Immagine mensile del planner | Animata come il sito | Scene da `planner_ambient.json`; ferme con «Riduci movimento» |
| Grigi piccoli | Più scuri | Nuovi `text3` nei quattro temi, con test di contrasto ≥ 4,5 |
| Testo piccolo (10–11) | Lasciare come il sito | Nessuna modifica |
| Testo molto grande | Tetto 150% solo sulle schermate dense | `maxFontSizeMultiplier` su settimana, tabelle, grafici |
| Alto contrasto | Sì, interruttore | Impostazione in Altro › Stile |

## Nome e icona
- Nome: «Standout: track and plan your life» (34 caratteri: Apple ne accetta 30 → proposto «Standout: Plan & Track Life»). Sulla schermata Home resta «Standout».
- Icona: Nico ha la sua (da mandare: PNG 1024×1024 senza trasparenza).
- Apertura: bianca in chiaro, scura in scuro. Identificativo: `app.standout.mobile` (invariato).

## Funzioni
- IA per l'abbinamento carte (F12) e libri/rapporti del diario (D8): **da costruire** (server + app, solo online, crediti).
- Dettatura e modalità vocale completa (ascolto + lettura): **con libreria di riconoscimento vocale** (serve una build speciale; etichetta privacy da aggiornare; l'audio può andare ad Apple/Google se non si usa il riconoscimento sul telefono).
- Mappa: dentro l'app su iPhone e Android (Nico crea la chiave Google Maps; passaggi da dargli).
- Scelta colonne a mano nelle importazioni: da costruire.
- «To study» e notifiche amicizia: confermato, non si portano.

## Store, legale, soldi
- iPhone prima, poi Android. iPad: sì.
- Crittografia: Nico vuole una spiegazione; l'interruttore `ITSAppUsesNonExemptEncryption` resta non impostato, Apple fa le domande all'invio.
- Etichette privacy: come proposte (email, contenuti, foto e audio; niente tracciamento).
- Scansione di sicurezza completa: sì, prima del rilascio.
- Spazio sul server: si cambierà host → la quota immagini/audio non dipende dai limiti di Altervista (valore di default in un solo posto, si cambia con l'host).
