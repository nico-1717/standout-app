import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  type GestureResponderEvent,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { mix } from '@/features/buy/buyTheme';
import { haptic } from '@/ui/motion';

import { CardAudio } from './CardAudio';
import { CardImage } from './CardImage';
import { catTones, type CatTones } from './deckUi';
import { DocView } from './DocView';
import { FlipCard } from './FlipCard';
import type { PlayView } from './gameKit';

const MAX_WIDTH = 620;
const GLASS = 'rgba(255,255,255,.16)';

/** Un'icona del visore (le stesse linee del sito: X, play, matita, frecce, giro). */
function Icon({ name, size, stroke = 2.5 }: { name: IconName; size: number; stroke?: number }) {
  const common = {
    stroke: '#fff',
    strokeWidth: stroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'close' ? <Path d="M18 6 6 18M6 6l12 12" {...common} strokeWidth={2.6} /> : null}
      {name === 'play' ? (
        <Path
          d="M8 5.14v13.72a1 1 0 0 0 1.53.85l11-6.86a1 1 0 0 0 0-1.7l-11-6.86A1 1 0 0 0 8 5.14Z"
          fill="#fff"
        />
      ) : null}
      {name === 'edit' ? (
        <>
          <Path d="M12 20h9" {...common} strokeWidth={2.2} />
          <Path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" {...common} strokeWidth={2.2} />
        </>
      ) : null}
      {name === 'prev' ? <Path d="m15 18-6-6 6-6" {...common} /> : null}
      {name === 'next' ? <Path d="m9 18 6-6-6-6" {...common} /> : null}
      {name === 'flip' ? (
        <>
          <Path d="M21 12a9 9 0 1 1-2.6-6.3" {...common} strokeWidth={2} />
          <Path d="M21 3v5h-5" {...common} strokeWidth={2} />
        </>
      ) : null}
    </Svg>
  );
}
type IconName = 'close' | 'play' | 'edit' | 'prev' | 'next' | 'flip';

/** Un tasto tondo del visore: vetro bianco trasparente, o sfumato col colore della cartella (`main`). */
function RoundButton(p: {
  testID: string;
  label: string;
  size: number;
  tone?: CatTones;
  disabled?: boolean;
  onPress?: () => void;
  shadow?: string;
  style?: ViewStyle;
  children: ReactNode;
}) {
  return (
    <Pressable
      testID={p.testID}
      accessibilityRole="button"
      accessibilityLabel={p.label}
      accessibilityState={{ disabled: !!p.disabled }}
      disabled={p.disabled}
      hitSlop={6}
      onPress={p.onPress}
      style={({ pressed }) => [
        {
          width: p.size,
          height: p.size,
          borderRadius: p.size / 2,
          opacity: p.disabled ? 0.28 : 1,
          transform: [{ scale: pressed ? 0.9 : 1 }],
          boxShadow: p.shadow,
        },
        p.style,
      ]}
    >
      {p.tone ? (
        <LinearGradient
          colors={[p.tone.light, p.tone.color, p.tone.dark]}
          locations={[0, 0.58, 1]}
          style={{
            flex: 1,
            borderRadius: p.size / 2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {p.children}
        </LinearGradient>
      ) : (
        <View
          style={{
            flex: 1,
            borderRadius: p.size / 2,
            backgroundColor: GLASS,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {p.children}
        </View>
      )}
    </Pressable>
  );
}

/**
 * Il visore delle carte a schermo intero (il «visore flashcard» di fc_view.php): sfondo scuro nel colore della cartella,
 * in alto la X, «3 / 20» e il tasto per giocare, sotto la barra di avanzamento; la carta ha il filetto colorato a sinistra,
 * l'etichetta DOMANDA / RISPOSTA e il testo che scorre se è lungo; il tondino con la matita la modifica; in fondo le frecce e
 * il tasto che gira. Si gira toccando la carta, si sfoglia con le frecce o con uno swipe.
 */
export function CardViewer(p: {
  cards: PlayView[];
  start?: number;
  onClose: () => void;
  /** il colore della cartella (di base quello del tema) */
  tone?: CatTones;
  /** la matita sulla carta: riceve la posizione della carta */
  onEdit?: (index: number) => void;
  /** il tasto «gioca» in alto a destra */
  onPlay?: () => void;
  testID?: string;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tone = p.tone ?? catTones(th.brand);
  const [index, setIndex] = useState(Math.min(Math.max(p.start ?? 0, 0), p.cards.length - 1));
  const [flipped, setFlipped] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const id = p.testID ?? 'cv';
  const total = p.cards.length;

  const go = (to: number) => {
    if (to < 0 || to >= total) return;
    setIndex(to);
    setFlipped(false);
    haptic.select();
  };
  const flip = () => {
    setFlipped((f) => !f);
    haptic.select();
  };
  const onEnd = (e: GestureResponderEvent) => {
    const from = touch.current;
    touch.current = null;
    if (!from) return;
    const dx = e.nativeEvent.pageX - from.x;
    const dy = e.nativeEvent.pageY - from.y;
    // solo uno swipe orizzontale deciso: uno scorrimento in verticale è il testo che scorre
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(index + (dx < 0 ? 1 : -1));
  };

  const card = p.cards[index];
  const face = (accent: string): ViewStyle => ({
    flexDirection: 'column',
    borderRadius: 24,
    backgroundColor: th.surface,
    borderLeftWidth: 4,
    borderLeftColor: accent,
    paddingVertical: 22,
    paddingHorizontal: 20,
    overflow: 'hidden',
    boxShadow: '0 20px 60px -18px rgba(0,0,0,.55)',
  });
  const eyebrow = (label: string, color: string) => (
    <Text
      style={{
        color,
        fontSize: 10.5,
        fontWeight: '800',
        letterSpacing: 1.15,
        textTransform: 'uppercase',
        marginBottom: 10,
      }}
    >
      {label}
    </Text>
  );
  const bodyScroll = { flex: 1, minHeight: 0 } as const;
  const bodyContent = { gap: 14, paddingBottom: 6 } as const;

  return (
    <Modal visible animationType="fade" onRequestClose={p.onClose} testID={id}>
      <LinearGradient
        colors={[mix(tone.dark, '#000000', 0.55), mix(tone.dark, '#000000', 0.2), '#05070A']}
        locations={[0, 0.5, 1]}
        style={{ flex: 1, alignItems: 'center' }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            maxWidth: MAX_WIDTH,
            paddingTop: insets.top + 12,
            paddingBottom: 10,
            paddingHorizontal: 16,
          }}
        >
          <RoundButton
            testID={`${id}-close`}
            label={t('comune.chiudi')}
            size={38}
            onPress={p.onClose}
          >
            <Icon name="close" size={18} />
          </RoundButton>
          <Text
            testID={`${id}-count`}
            style={{
              flex: 1,
              textAlign: 'center',
              color: '#fff',
              fontSize: 14,
              fontWeight: '800',
              fontVariant: ['tabular-nums'],
              textShadowColor: 'rgba(0,0,0,.4)',
              textShadowRadius: 4,
              textShadowOffset: { width: 0, height: 1 },
            }}
          >
            {card ? `${index + 1} / ${total}` : ''}
          </Text>
          {p.onPlay ? (
            <RoundButton
              testID={`${id}-play`}
              label={t('vocab.vi_gioca')}
              size={38}
              tone={tone}
              onPress={p.onPlay}
            >
              <Icon name="play" size={18} />
            </RoundButton>
          ) : (
            <View style={{ width: 38, height: 38 }} />
          )}
        </View>

        <View
          testID={`${id}-bar`}
          style={{
            width: '100%',
            maxWidth: MAX_WIDTH,
            height: 3,
            marginBottom: 4,
            backgroundColor: 'rgba(255,255,255,.18)',
          }}
        >
          <View
            testID={`${id}-bar-fill`}
            style={{
              height: '100%',
              width: `${total ? ((index + 1) / total) * 100 : 0}%`,
              backgroundColor: tone.light,
            }}
          />
        </View>

        {card ? (
          <View style={{ flex: 1, width: '100%', maxWidth: MAX_WIDTH, minHeight: 0 }}>
            <View
              style={{ position: 'absolute', left: 16, right: 16, top: 14, bottom: 14 }}
              onTouchStart={(e) => {
                touch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
              }}
              onTouchEnd={onEnd}
            >
              <FlipCard
                key={index}
                flipped={flipped}
                style={{ flex: 1 }}
                frontStyle={face(tone.color)}
                backStyle={face(tone.color)}
                front={
                  <Pressable
                    testID={`${id}-card`}
                    accessibilityRole="button"
                    accessibilityLabel={t('fc.res_gira')}
                    onPress={flip}
                    style={{ flex: 1 }}
                  >
                    {eyebrow(t('fc.ifc_domanda'), th.text3)}
                    <ScrollView
                      testID={`${id}-question-scroll`}
                      style={bodyScroll}
                      contentContainerStyle={bodyContent}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                    >
                      <DocView testID={`${id}-question`} raw={card.question} size={17} />
                      <CardImage
                        testID={`${id}-question-image`}
                        name={card.questionImage}
                        height={220}
                      />
                      {card.questionAudio ? (
                        <View style={{ alignSelf: 'flex-start' }}>
                          <CardAudio testID={`${id}-question-audio`} name={card.questionAudio} />
                        </View>
                      ) : null}
                    </ScrollView>
                    <Text
                      style={{
                        paddingTop: 12,
                        textAlign: 'center',
                        color: th.text3,
                        opacity: 0.8,
                        fontSize: 11.5,
                        fontWeight: '700',
                      }}
                    >
                      {t('fc.res_tocca_girare')}
                    </Text>
                  </Pressable>
                }
                back={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('fc.res_gira')}
                    onPress={flip}
                    style={{ flex: 1 }}
                  >
                    {eyebrow(t('fc.ifc_risposta'), tone.color)}
                    <ScrollView
                      testID={`${id}-answer-scroll`}
                      style={bodyScroll}
                      contentContainerStyle={bodyContent}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                    >
                      <DocView testID={`${id}-answer`} raw={card.answer} size={17} />
                      <CardImage
                        testID={`${id}-answer-image`}
                        name={card.answerImage}
                        height={220}
                      />
                      {card.answerAudio ? (
                        <View style={{ alignSelf: 'flex-start' }}>
                          <CardAudio testID={`${id}-answer-audio`} name={card.answerAudio} />
                        </View>
                      ) : null}
                    </ScrollView>
                  </Pressable>
                }
              />
              {p.onEdit ? (
                <RoundButton
                  testID={`${id}-edit`}
                  label={t('comune.modifica')}
                  size={38}
                  tone={tone}
                  onPress={() => p.onEdit?.(index)}
                  shadow="0 8px 20px -8px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.28)"
                  style={{ position: 'absolute', bottom: -14, right: -6 }}
                >
                  <Icon name="edit" size={17} />
                </RoundButton>
              ) : null}
            </View>
          </View>
        ) : (
          <Text style={{ flex: 1, color: '#fff', textAlign: 'center', marginTop: 40 }}>
            {t('fc.vis_fcv_vuoto')}
          </Text>
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            paddingTop: 8,
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 18,
          }}
        >
          <RoundButton
            testID={`${id}-prev`}
            label={t('fc.res_precedente')}
            size={50}
            disabled={index === 0}
            onPress={() => go(index - 1)}
          >
            <Icon name="prev" size={22} />
          </RoundButton>
          <RoundButton
            testID={`${id}-flip`}
            label={t('fc.res_gira')}
            size={60}
            tone={tone}
            disabled={!card}
            onPress={flip}
            shadow="0 10px 26px -8px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.28)"
          >
            <Icon name="flip" size={26} stroke={2} />
          </RoundButton>
          <RoundButton
            testID={`${id}-next`}
            label={t('fc.res_successiva')}
            size={50}
            disabled={index >= total - 1}
            onPress={() => go(index + 1)}
          >
            <Icon name="next" size={22} />
          </RoundButton>
        </View>
      </LinearGradient>
    </Modal>
  );
}
