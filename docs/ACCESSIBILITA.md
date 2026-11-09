# Accessibilità dell'app (controllo WCAG 2.1 AA sul codice)

Fatto il 2026-11-07 con la skill `design:accessibility-review`. È un controllo sul codice e sui colori; **non** sostituisce la prova con VoiceOver / TalkBack sul telefono (da fare nella lista di prove sul telefono).

## Già sistemato (non cambia l'aspetto)
- 62 bottoni (`Pressable`) senza ruolo ora hanno `accessibilityRole` (bottone; la casella dei progetti è `checkbox`).
- 3 bottoni piccoli (SmartBar, editor ricco, pallino progetti) hanno più area di tocco (`hitSlop`), senza cambiare la grandezza che si vede.
- 2026-11-08: 28 bottoni con solo un simbolo (✕, ＋, ↑ ↓, ‹ ›, − +, ↗) ora hanno `accessibilityLabel` con parole già nei dizionari (Chiudi, Aggiungi, Sposta su/giù, Mese precedente/successivo, Diminuisci/Aumenta, Apri, Rimuovi).

## Colori: da decidere con Nico (cambiare l'aspetto richiede una proposta visiva e il suo OK)
I colori sono copiati dal sito. Rapporto di contrasto (serve ≥ 4,5 per il testo normale, ≥ 3 per testi grandi e icone):

| Tema | Colore | Su sfondo | Rapporto | Esito |
|---|---|---|---|---|
| chiaro | testo secondario `#8A8A8E` | bianco | 3,44 | non passa (testo piccolo) |
| chiaro | testo terziario `#AEAEB2` | bianco | 2,21 | non passa |
| chiaro | blu `#007AFF` | bianco | 4,02 | passa solo per testo grande |
| chiaro | verde `#34C759`, arancione `#FF9500` | bianco | 2,2 | non passano come testo |
| chiaro | bianco su blu (bottoni) | — | 4,02 | passa solo per testo grande/bold |
| scuro | testo secondario `#98989F` | `#1C1C1E` | 5,94 | passa |
| scuro | testo terziario `#636366` | `#1C1C1E` | 2,84 | non passa |

Idea da mostrare a Nico (con immagini) prima di toccare qualcosa: un tema "alto contrasto" opzionale nelle impostazioni, senza cambiare l'aspetto di default.

## Ancora da fare
- Prova con VoiceOver (iPhone) e TalkBack (Android): ordine di lettura, etichette dei bottoni con solo icona/emoji (le principali sono fatte, resta da sentirle).
- Dimensione del testo di sistema (Dynamic Type) al 200%: controllare che i layout non si rompano.
- Grafici: il grafico dei voti, le barre delle abitudini e dei mazzi, la linea, il radar, le barre orizzontali, la settimana e il mese del Pomodoro ora si leggono come un solo elemento («etichetta: valore, …»); la mappa a quadratini delle abitudini è nascosta al lettore (i numeri stanno nelle carte intorno); la torta del Pomodoro ha già la sua riga. Restano da fare i giochi (da sentire sul telefono).

## Fatto il 2026-11-09 (dopo le risposte di Nico)
- Grigi dei testi piccoli più scuri nei quattro temi (rapporto ≥ 4,5 su sfondo e carta, controllato da test).
- Interruttore «Alto contrasto» in Altro (solo su questo telefono): testi ≥ 7:1 e linee ben visibili; sfondi invariati.
- Tetto al 150% per il testo nelle schermate dense (settimana del planner, tabelle e grafici delle abitudini, statistiche e percorso delle flashcard, pagine del diario, pillole, storico Pomodoro, piano): `src/ui/CappedText.tsx`. Le altre schermate seguono il telefono senza limite.
- 28 bottoni sotto i 44 punti hanno più area di tocco (`hitSlop`), senza cambiare l'aspetto.
- Nico ha scelto di **lasciare** i testi da 10 e 11 punti come sul sito.
