import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
} from 'react-native';

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
  /** il tocco sul testo che scorre: lo scorrimento non può stare dentro il tocco della carta, quindi lo gestisce il testo stesso */
  onPress?: () => void;
}) {
  const th = useTheme();
  const inner = useRef<ScrollViewInstance>(null);
  const [textH, setTextH] = useState(0);
  const tall = textH > TEXT_MAX + 1;
  const measure = (e: LayoutChangeEvent) => setTextH(e.nativeEvent.layout.height);
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
        <View
          style={{ flexDirection: split ? 'row' : 'column', alignItems: 'flex-start', gap: 12 }}
        >
          {hasText ? (
            <View style={{ flex: split ? 1 : undefined, alignSelf: 'stretch', minWidth: 0 }}>
              {p.full ? (
                text
              ) : (
                <View testID={`${p.testID}-scroll`}>
                  {tall ? (
                    // altezza FISSA e contenuto alto quanto il testo misurato. Il tocco della carta sta DENTRO il riquadro:
                    // su iPhone uno ScrollView dentro il tocco (Pressable) di una carta non scorre mai, vince la pagina
                    <ScrollView
                      testID={`${p.testID}-box`}
                      ref={inner}
                      nestedScrollEnabled
                      style={{ height: TEXT_MAX }}
                      contentContainerStyle={{ minHeight: textH }}
                      showsVerticalScrollIndicator
                      onLayout={() => inner.current?.flashScrollIndicators()}
                    >
                      <Pressable accessible={false} onPress={p.onPress}>
                        <View testID={`${p.testID}-measure`} onLayout={measure}>
                          {text}
                        </View>
                      </Pressable>
                    </ScrollView>
                  ) : (
                    // un testo corto sta com'è; se alla misura risulta più alto del tetto passa nel riquadro che scorre
                    <View testID={`${p.testID}-measure`} onLayout={measure}>
                      {text}
                    </View>
                  )}
                </View>
              )}
            </View>
          ) : null}
          {hasImage ? (
            <View style={split ? { width: 76 } : { alignSelf: 'stretch' }}>
              <CardImage
                testID={`${p.testID}-image`}
                name={p.image}
                zoom
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
