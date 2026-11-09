import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { haptic } from '@/ui/motion';

import { CardImage } from './CardImage';
import { DocView } from './DocView';
import { FlipCard } from './FlipCard';
import type { PlayView } from './gameKit';

/**
 * Il visore delle carte a schermo intero (il «visore flashcard» del sito): una carta alla volta, si tocca per girarla,
 * si scorre con i tasti o con uno swipe orizzontale. Mostra la domanda, poi la risposta con le immagini.
 */
export function CardViewer(p: {
  cards: PlayView[];
  start?: number;
  onClose: () => void;
  testID?: string;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(Math.min(Math.max(p.start ?? 0, 0), p.cards.length - 1));
  const [flipped, setFlipped] = useState(false);
  const touch = useRef<number | null>(null);
  const id = p.testID ?? 'cv';

  const go = (to: number) => {
    if (to < 0 || to >= p.cards.length) return;
    setIndex(to);
    setFlipped(false);
  };
  const onEnd = (e: GestureResponderEvent) => {
    const from = touch.current;
    touch.current = null;
    if (from === null) return;
    const dx = e.nativeEvent.pageX - from;
    if (Math.abs(dx) > 60) go(index + (dx < 0 ? 1 : -1));
  };

  const card = p.cards[index];
  const face = (border: string) => ({
    borderRadius: 18,
    backgroundColor: th.surface,
    borderWidth: 1,
    borderColor: border,
    overflow: 'hidden' as const,
  });
  const body = { padding: 20, gap: 14, flexGrow: 1, justifyContent: 'center' as const };
  return (
    <Modal visible animationType="fade" onRequestClose={p.onClose} testID={id}>
      <View
        style={{
          flex: 1,
          backgroundColor: th.bg,
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 12,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 16,
          }}
        >
          <Text testID={`${id}-count`} style={{ color: th.text2, fontVariant: ['tabular-nums'] }}>
            {card ? `${index + 1} / ${p.cards.length}` : ''}
          </Text>
          <Pressable
            testID={`${id}-close`}
            accessibilityRole="button"
            accessibilityLabel={t('comune.chiudi')}
            hitSlop={12}
            onPress={p.onClose}
          >
            <Text style={{ color: th.brand, fontSize: 20 }}>✕</Text>
          </Pressable>
        </View>

        {card ? (
          <Pressable
            testID={`${id}-card`}
            accessibilityRole="button"
            accessibilityLabel={t('fc.res_gira')}
            onPress={() => {
              setFlipped(!flipped);
              haptic.select();
            }}
            onTouchStart={(e) => {
              touch.current = e.nativeEvent.pageX;
            }}
            onTouchEnd={onEnd}
            style={{ flex: 1, margin: 16 }}
          >
            <FlipCard
              key={index}
              flipped={flipped}
              style={{ flex: 1 }}
              frontStyle={face(th.hairline)}
              backStyle={face(th.brand)}
              front={
                <ScrollView contentContainerStyle={body}>
                  <DocView testID={`${id}-question`} raw={card.question} size={20} />
                  <CardImage
                    testID={`${id}-question-image`}
                    name={card.questionImage}
                    height={220}
                  />
                  <Text style={{ color: th.text3, textAlign: 'center', fontSize: 12 }}>
                    {t('fc.res_tocca_girare')}
                  </Text>
                </ScrollView>
              }
              back={
                <ScrollView contentContainerStyle={body}>
                  <DocView testID={`${id}-answer`} raw={card.answer} size={20} />
                  <CardImage testID={`${id}-answer-image`} name={card.answerImage} height={220} />
                </ScrollView>
              }
            />
          </Pressable>
        ) : (
          <Text style={{ color: th.text2, textAlign: 'center', marginTop: 40 }}>
            {t('fc.vis_fcv_vuoto')}
          </Text>
        )}

        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24 }}
        >
          <Pressable
            testID={`${id}-prev`}
            accessibilityRole="button"
            accessibilityLabel={t('fc.res_precedente')}
            disabled={index === 0}
            onPress={() => go(index - 1)}
            hitSlop={10}
          >
            <Text style={{ color: index === 0 ? th.text3 : th.brand, fontSize: 17 }}>
              ‹ {t('fc.res_precedente')}
            </Text>
          </Pressable>
          <Pressable
            testID={`${id}-next`}
            accessibilityRole="button"
            accessibilityLabel={t('fc.res_successiva')}
            disabled={index >= p.cards.length - 1}
            onPress={() => go(index + 1)}
            hitSlop={10}
          >
            <Text
              style={{
                color: index >= p.cards.length - 1 ? th.text3 : th.brand,
                fontSize: 17,
              }}
            >
              {t('fc.res_successiva')} ›
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
