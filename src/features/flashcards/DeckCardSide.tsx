import { ScrollView, Text, View } from 'react-native';

import { useTheme } from '@/core/theme/ThemeProvider';

import { CardAudio } from './CardAudio';
import { CardImage } from './CardImage';
import { docToPlain, parseDoc } from './doc';
import { DocView } from './DocView';

/** L'altezza oltre la quale il testo di una carta scorre da sé (`.qa-text{max-height:190px}` del sito). */
const TEXT_MAX = 190;

/**
 * Un lato della carta nell'elenco del mazzo (`.qa-side` di fc_view.php): l'etichetta con la sua linea, poi il testo FORMATTATO
 * (grassetto, colori, elenchi, formule: lo stesso disegno della carta) con l'immagine a fianco, e l'audio. Se c'è solo
 * l'immagine o solo il testo, riempiono la riga; con «carte intere» il testo non ha tetto e non scorre.
 */
export function DeckCardSide(p: {
  testID: string;
  label: string;
  raw: string | null;
  image: string | null;
  audio: string | null;
  full: boolean;
  /** domanda: un po' più grossa e marcata, come sul sito */
  question?: boolean;
}) {
  const th = useTheme();
  const hasText = docToPlain(parseDoc(p.raw)).trim().length > 0;
  const hasImage = !!p.image;
  const split = hasText && hasImage;
  const size = split ? 15.5 : 16.5;
  const text = (
    <DocView
      testID={`${p.testID}-text`}
      raw={p.raw}
      size={size}
      weight={p.question ? '700' : '500'}
      color={p.question ? th.text : th.text}
    />
  );
  return (
    <View testID={p.testID} style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text
          style={{
            color: th.text3,
            fontSize: 10.5,
            fontWeight: '800',
            letterSpacing: 1.1,
            textTransform: 'uppercase',
          }}
        >
          {p.label}
        </Text>
        <View style={{ flex: 1, height: 0.5, backgroundColor: th.hairline }} />
      </View>
      {hasText || hasImage ? (
        <View style={{ flexDirection: split ? 'row' : 'column', alignItems: 'flex-start', gap: 12 }}>
          {hasText ? (
            <View style={{ flex: split ? 1 : undefined, alignSelf: 'stretch', minWidth: 0 }}>
              {p.full ? (
                text
              ) : (
                <ScrollView
                  testID={`${p.testID}-scroll`}
                  nestedScrollEnabled
                  style={{ maxHeight: TEXT_MAX }}
                  showsVerticalScrollIndicator={false}
                >
                  {text}
                </ScrollView>
              )}
            </View>
          ) : null}
          {hasImage ? (
            <View style={split ? { width: 76 } : { alignSelf: 'stretch' }}>
              <CardImage
                testID={`${p.testID}-image`}
                name={p.image}
                height={split ? 76 : p.full ? 320 : 230}
              />
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={{ color: th.text3, fontSize: 14 }}>—</Text>
      )}
      {p.audio ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <CardAudio testID={`${p.testID}-audio`} name={p.audio} />
        </View>
      ) : null}
    </View>
  );
}
