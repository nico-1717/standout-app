import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';

import { useTheme } from '@/core/theme/ThemeProvider';

import { CardAudio } from './CardAudio';
import { CardImage } from './CardImage';
import { DocView } from './DocView';
import type { Example } from './study';

/** Il viola dell'etichetta e del riquadro con la trasparenza di un colore esadecimale. */
const tint = (hex: string, alpha: number) =>
  `${hex}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')}`;

/**
 * Il riquadro «Esempi (n)» sotto una carta, come sul sito: etichetta viola, riquadro col bordo viola, i pallini in alto
 * e un esempio alla volta che si sfoglia di lato. Testo, immagine (tocco = schermo intero) e audio di ogni esempio.
 * `full` toglie il tetto di altezza ai testi lunghi (l'opzione «esempi interi»).
 */
export function DeckExamples({
  examples,
  full,
  onPress,
  testID,
}: {
  examples: Example[];
  full: boolean;
  onPress: () => void;
  testID: string;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const scroller = useRef<ScrollViewInstance>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  if (!examples.length) return null;

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };
  const goTo = (i: number) => {
    setIndex(i);
    scroller.current?.scrollTo({ x: i * width, animated: true });
  };

  return (
    <View testID={testID} style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text
          style={{
            color: th.purple,
            opacity: 0.75,
            fontSize: 10.5,
            fontWeight: '800',
            letterSpacing: 1.1,
            textTransform: 'uppercase',
          }}
        >
          {t('fc.vis_n_esempi', { n: examples.length })}
        </Text>
        <View style={{ flex: 1, height: 0.5, backgroundColor: th.hairline }} />
      </View>
      <View
        style={{
          borderWidth: 1.5,
          borderColor: tint(th.purple, 0.45),
          borderRadius: 14,
          backgroundColor: tint(th.purple, 0.05),
          paddingTop: 12,
          paddingBottom: 12,
          overflow: 'hidden',
        }}
      >
        {examples.length > 1 ? (
          <View
            testID={`${testID}-dots`}
            style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 8 }}
          >
            {examples.map((x, i) => (
              <Pressable
                key={x.uuid}
                testID={`${testID}-dot-${i}`}
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => goTo(i)}
              >
                <View
                  style={{
                    width: i === index ? 9 : 6,
                    height: i === index ? 9 : 6,
                    borderRadius: 5,
                    backgroundColor: i === index ? th.purple : th.hairline2,
                  }}
                />
              </Pressable>
            ))}
          </View>
        ) : null}
        <View onLayout={onLayout}>
          <ScrollView
            ref={scroller}
            testID={`${testID}-pager`}
            horizontal
            pagingEnabled
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            scrollEnabled={examples.length > 1}
            onMomentumScrollEnd={onEnd}
          >
            {examples.map((x) => (
              <Pressable
                key={x.uuid}
                testID={`${testID}-item-${x.uuid}`}
                accessible={false}
                onPress={onPress}
                style={{ width: width || undefined, paddingHorizontal: 14, gap: 8 }}
              >
                {x.example_text?.trim() ? (
                  <ScrollView
                    nestedScrollEnabled
                    style={full ? undefined : { maxHeight: 120 }}
                    showsVerticalScrollIndicator={!full}
                  >
                    <DocView raw={x.example_text} size={14.5} />
                  </ScrollView>
                ) : null}
                {x.example_image ? (
                  <CardImage
                    testID={`${testID}-image-${x.uuid}`}
                    name={x.example_image}
                    folder="example"
                    height={full ? 220 : 180}
                    zoom
                  />
                ) : null}
                {x.example_audio ? (
                  <View style={{ alignItems: 'flex-start' }}>
                    <CardAudio testID={`${testID}-audio-${x.uuid}`} name={x.example_audio} />
                  </View>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}
