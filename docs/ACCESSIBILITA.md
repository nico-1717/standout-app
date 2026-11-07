# Accessibilità dell'app (controllo WCAG 2.1 AA sul codice)

Fatto il 2026-11-07 con la skill `design:accessibility-review`. È un controllo sul codice e sui colori; **non** sostituisce la prova con VoiceOver / TalkBack sul telefono (da fare nella lista di prove sul telefono).

## Già sistemato (non cambia l'aspetto)
- 62 bottoni (`Pressable`) senza ruolo ora hanno `accessibilityRole` (bottone; la casella dei progetti è `checkbox`).
- 3 bottoni piccoli (SmartBar, editor ricco, pallino progetti) hanno più area di tocco (`hitSlop`), senza cambiare la grandezza che si vede.

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
- Prova con VoiceOver (iPhone) e TalkBack (Android): ordine di lettura, etichette dei bottoni con solo icona/emoji.
- Dimensione del testo di sistema (Dynamic Type) al 200%: controllare che i layout non si rompano.
- Giochi e grafici: dare un'alternativa testuale (le barre delle statistiche oggi sono solo visive).
