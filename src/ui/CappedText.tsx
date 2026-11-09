import { Text as RNText, type TextProps } from 'react-native';

/** Quanto può crescere il testo nelle schermate dense (settimana, tabelle, grafici) quando il telefono ha il testo molto grande. */
export const DENSE_FONT_SCALE = 1.5;

/**
 * Come `Text`, ma con un tetto al 150% della dimensione di sistema: nelle schermate fitte (settimana del planner,
 * tabelle, grafici) il testo continua a seguire il telefono, ma non rompe più la pagina al massimo ingrandimento.
 * Le altre schermate usano `Text` normale e seguono il telefono senza limiti.
 */
export function Text(props: TextProps) {
  return <RNText maxFontSizeMultiplier={DENSE_FONT_SCALE} {...props} />;
}
