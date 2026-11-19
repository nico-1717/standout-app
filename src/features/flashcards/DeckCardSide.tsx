import { createContext, useContext, useRef, useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
  type ScrollViewProps,
} from 'react-native';

import { useTheme } from '@/core/theme/ThemeProvider';

import { CardAudio } from './CardAudio';
import { CardImage } from './CardImage';
import { docToPlain, parseDoc } from './doc';
import { DocView } from './DocView';

/** L'altezza oltre la quale il testo di una carta scorre da sé (`.qa-text{max-height:190px}` del sito). */
const TEXT_MAX = 190;

/**
 * Chi tiene l'elenco delle carte (la pagina che scorre) la mette qui: mentre il dito è su un testo lungo che scorre da sé,
 * la pagina si ferma, così il tocco va al testo e non alla pagina (su iPhone due scorrimenti in verticale uno dentro
 * l'altro si litigavano il dito e vinceva la pagina).
 */
const ScrollLockContext = createContext<(locked: boolean) => void>(() => {});

/** La pagina con l'elenco delle carte: come un ScrollView, ma si ferma mentre il dito è su un testo lungo che scorre da sé. */
export function LockedScrollView(props: ScrollViewProps) {
  const [held, setHeld] = useState(false);
  return (
    <ScrollLockContext.Provider value={setHeld}>
      <ScrollView {...props} scrollEnabled={!held} />
    </ScrollLockContext.Provider>
  );
}

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
  const lock = useContext(ScrollLockContext);
  const inner = useRef<ScrollViewInstance>(null);
  const [textH, setTextH] = useState(0);
  const [dbg, setDbg] = useState('');
  const add = (x: string) => setDbg((d) => (d + ' ' + x).slice(-70));
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
      {dbg ? <Text testID={`${p.testID}-dbg`} style={{ color: 'red', fontSize: 10 }}>{dbg}</Text> : null}
      {hasText || hasImage ? (
        <View
          style={{ flexDirection: split ? 'row' : 'column', alignItems: 'flex-start', gap: 12 }}
        >
          {hasText ? (
            <View style={{ flex: split ? 1 : undefined, alignSelf: 'stretch', minWidth: 0 }}>
              {p.full ? (
                text
              ) : (
                <View
                  testID={`${p.testID}-scroll`}
                  onTouchStart={() => { add('S'); lock(true); }}
                  onTouchEnd={() => { add('E'); lock(false); }}
                  onTouchCancel={() => { add('C'); lock(false); }}
                >
                  {tall ? (
                    // altezza FISSA (non solo massima) e contenuto alto quanto il testo misurato: così c'è sempre qualcosa
                    // che sporge e il riquadro scorre davvero (prima il contenuto restava alto quanto il riquadro e non partiva nulla)
                    <ScrollView
                      testID={`${p.testID}-box`}
                      ref={inner}
                      nestedScrollEnabled
                      style={{ height: TEXT_MAX }}
                      contentContainerStyle={{ minHeight: textH }}
                      showsVerticalScrollIndicator
                      onLayout={(e) => { add('L' + Math.round(e.nativeEvent.layout.height)); inner.current?.flashScrollIndicators(); }}
                      onContentSizeChange={(_w, h) => add('c' + Math.round(h))}
                      onScrollBeginDrag={() => add('D')}
                      onScroll={(e) => add('y' + Math.round(e.nativeEvent.contentOffset.y))}
                      scrollEventThrottle={50}
                    >
                      <View testID={`${p.testID}-measure`} onLayout={measure}>
                        {text}
                      </View>
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
