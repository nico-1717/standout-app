import { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { Confetti, type Burst } from '@/features/habits/Confetti';
import { Sheet } from '@/features/habits/Sheet';
import { habitsTheme } from '@/features/habits/habitsTheme';

import { CardImage } from '../CardImage';
import { DocView } from '../DocView';
import { Icon } from '../game/GameUi';
import type { BossCard } from './bossCards';

/**
 * Il boss: le carte sbagliate del tratto, una dopo l'altra. Si pensa alla risposta, si tocca «Mostra» e si dice se
 * l'avevi o no. Alla fine, se le hai prese tutte, il boss è sconfitto.
 */
export function BossSheet(props: BossProps) {
  // il giro vive solo mentre il foglio è aperto: ogni volta riparte dalla prima carta
  return props.visible ? <BossRound {...props} /> : null;
}

interface BossProps {
  visible: boolean;
  cards: readonly BossCard[];
  vocab: boolean;
  bursts: readonly Burst[];
  onBurstDone: (id: number) => void;
  /** ogni «L'ho presa» (il numero di quelle prese finora, per il suono) */
  onRight: (got: number) => void;
  onWrong: () => void;
  /** alla fine, con quante ne ha prese */
  onFinish: (got: number, total: number) => void;
  onClose: () => void;
  /** a voce: a che punto è il giro (ogni volta che cambia carta o si mostra la risposta) */
  onPhase?: (phase: 'q' | 'a' | 'over', index: number) => void;
  /** a voce: i comandi per muovere il giro dall'esterno; `null` quando il foglio si chiude */
  onControl?: (c: BossControl | null) => void;
}

/** Quello che «Mostra», «L'ho presa» e «Mancata» fanno, a disposizione di chi comanda a voce. */
export interface BossControl {
  reveal: () => void;
  answer: (ok: boolean) => void;
}

function BossRound({
  visible,
  cards,
  vocab,
  bursts,
  onBurstDone,
  onRight,
  onWrong,
  onFinish,
  onClose,
  onPhase,
  onControl,
}: BossProps) {
  const th = useTheme();
  const { t } = useTranslation();
  const ht = habitsTheme(th.scheme, th.brand, th.style);
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [got, setGot] = useState(0);

  const over = i >= cards.length;
  const card = cards[i];
  const won = over && got === cards.length;

  useEffect(() => {
    if (visible && over && cards.length > 0) onFinish(got, cards.length);
    // solo quando si arriva in fondo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]);

  const phase = over ? 'over' : shown ? 'a' : 'q';
  useEffect(() => {
    onPhase?.(phase, i);
  }, [phase, i, onPhase]);

  const answer = (ok: boolean) => {
    if (ok) {
      setGot(got + 1);
      onRight(got + 1);
    } else onWrong();
    setShown(false);
    setI(i + 1);
  };

  useEffect(() => {
    if (!onControl) return;
    onControl({
      reveal: () => setShown(true),
      answer: (ok) => {
        if (!over) answer(ok);
      },
    });
    return () => onControl(null);
  });

  // i colori del boss sul sito: viola e rosa
  const PURPLE = '#BF5AF2';
  const PINK = '#FF375F';
  const CROWN = 'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5Z';
  const FLAME =
    'M12.6 2.2c.3 3-1.4 4.6-2.9 6.2C8.2 10 6.6 11.7 6.6 14.6A5.4 5.4 0 0 0 12 20a5.4 5.4 0 0 0 5.4-5.4c0-2.3-1-4-2.1-5.5-.2 1.3-.8 2.3-1.8 2.8.4-3.3-.1-6.8-.9-9.7Z';

  /** I tasti del sito (.fcg-btn): alti 52, angoli di 16, testo spesso. */
  const btn = (testID: string, label: string, tone: 'primo' | 'si' | 'no', onPress: () => void) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        height: 52,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tone === 'primo' ? th.blue : tone === 'si' ? th.green : `${th.red}21`,
        transform: [{ scale: pressed ? 0.97 : 1 }],
        boxShadow: tone === 'primo' ? `0 8px 22px -10px ${th.blue}CC` : undefined,
      })}
    >
      <Text
        style={{
          color: tone === 'no' ? th.red : '#fff',
          fontWeight: '800',
          fontSize: 16,
          letterSpacing: -0.16,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <Sheet
      visible={visible}
      th={ht}
      testID="fcg-boss"
      title=""
      onClose={onClose}
      overlay={<Confetti bursts={bursts} onDone={onBurstDone} />}
      footer={
        <View style={{ flex: 1, gap: 8 }}>
          {over ? (
            btn('fcg-boss-end', t('fcv.ck_continua'), 'primo', onClose)
          ) : shown ? (
            <>
              {btn('fcg-boss-no', t('fcv.boss_mancato'), 'no', () => answer(false))}
              {btn('fcg-boss-yes', t('fcv.boss_preso'), 'si', () => answer(true))}
            </>
          ) : (
            btn('fcg-boss-show', t('fcv.boss_mostra'), 'primo', () => setShown(true))
          )}
        </View>
      }
    >
      {/* il velo viola in alto (.fcg-boss .fcg-pannello) */}
      <LinearGradient
        pointerEvents="none"
        colors={[`${PURPLE}1F`, 'transparent']}
        locations={[0, 0.45]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 420 }}
      />
      {over ? (
        <View
          testID="fcg-boss-result"
          style={{ paddingTop: 10, paddingHorizontal: 20, paddingBottom: 8, alignItems: 'center' }}
        >
          {/* la medaglia: d'oro con la corona se l'hai battuto, arancio e rosa con la fiamma se no */}
          <Animated.View
            entering={ZoomIn.springify().damping(10)}
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: won
                ? '0 0 0 10px rgba(255,195,0,0.15), 0 16px 40px -10px rgba(255,159,10,0.7)'
                : undefined,
            }}
          >
            <LinearGradient
              colors={won ? ['#FFE066', '#FFC300', '#FF9F0A'] : ['#FF9F0A', PINK]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            <Icon
              d={won ? CROWN : FLAME}
              size={42}
              color={won ? '#1C1C1E' : '#fff'}
              width={2.1}
              fill={!won}
            />
          </Animated.View>
          <Animated.Text
            entering={FadeIn.delay(150).duration(400)}
            style={{
              marginTop: 18,
              marginBottom: 6,
              color: ht.text,
              fontSize: 28,
              fontWeight: '900',
              letterSpacing: -0.8,
              textAlign: 'center',
            }}
          >
            {won ? t('fcv.boss_vinto') : t('fcv.boss_parziale', { g: got, n: cards.length })}
          </Animated.Text>
          <Text style={{ color: ht.text2, fontSize: 15, textAlign: 'center' }}>
            {won ? t('fcv.boss_vinto_sub') : t('fcv.boss_parziale_sub')}
          </Text>
        </View>
      ) : card ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          {/* la testa: la corona, «Boss round» e un puntino per carta */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 10,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LinearGradient
                colors={[PURPLE, PINK]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              />
              <Icon d={CROWN} size={17} color="#fff" width={2.1} />
            </View>
            <Text
              style={{
                color: ht.text3,
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 1.3,
                textTransform: 'uppercase',
              }}
            >
              {t('fcv.boss_titolo')}
            </Text>
            <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 5 }}>
              {cards.map((c, j) => (
                <View
                  key={c.key}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: j < i ? PURPLE : j === i ? PINK : ht.hairline2,
                    transform: [{ scale: j === i ? 1.3 : 1 }],
                  }}
                />
              ))}
            </View>
          </View>

          {/* la carta (.fcg-boss-carta): grigia, bordo viola, al centro */}
          <Animated.View
            key={card.key}
            entering={ZoomIn.springify().damping(14)}
            style={{
              marginTop: 18,
              paddingVertical: 22,
              paddingHorizontal: 18,
              borderRadius: 22,
              backgroundColor: ht.surface2,
              borderWidth: 1,
              borderColor: `${PURPLE}4D`,
              alignItems: vocab ? 'center' : 'stretch',
            }}
          >
            <Text
              style={{
                color: ht.text3,
                fontSize: 12,
                fontWeight: '800',
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                textAlign: 'center',
                marginBottom: vocab ? 0 : 10,
              }}
            >
              {t(vocab ? 'fcv.boss_domanda' : 'fcv.boss_domanda_studio')}
            </Text>
            {!vocab ? <CardImage testID="fcg-boss-prompt-image" name={card.promptImage} /> : null}
            {vocab ? (
              <Text
                testID="fcg-boss-prompt"
                style={{
                  marginTop: 10,
                  color: ht.text,
                  fontSize: 24,
                  fontWeight: '800',
                  letterSpacing: -0.5,
                  textAlign: 'center',
                }}
              >
                {card.prompt}
              </Text>
            ) : (
              <View testID="fcg-boss-prompt">
                <DocView raw={card.prompt} size={17} weight="600" />
              </View>
            )}
            {card.example ? (
              <Text
                style={{
                  marginTop: 14,
                  color: ht.text2,
                  fontSize: 16,
                  lineHeight: 25,
                  textAlign: 'center',
                }}
              >
                {card.example}
              </Text>
            ) : null}
            {shown ? (
              <Animated.View
                testID="fcg-boss-reveal"
                entering={ZoomIn.springify().damping(11)}
                style={{
                  alignSelf: 'stretch',
                  marginTop: 16,
                  paddingTop: 16,
                  borderTopWidth: 0.5,
                  borderTopColor: ht.hairline2,
                  alignItems: vocab ? 'center' : 'stretch',
                  gap: 6,
                }}
              >
                {vocab ? (
                  <>
                    <Text
                      style={{
                        color: PURPLE,
                        fontSize: 28,
                        fontWeight: '900',
                        letterSpacing: -0.6,
                      }}
                    >
                      {card.reveal}
                    </Text>
                    {card.meaning ? (
                      <Text
                        style={{
                          color: ht.text2,
                          fontSize: 14,
                          fontStyle: 'italic',
                          textAlign: 'center',
                        }}
                      >
                        {card.meaning}
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <>
                    <CardImage testID="fcg-boss-reveal-image" name={card.revealImage} />
                    <DocView raw={card.reveal} size={17} />
                  </>
                )}
              </Animated.View>
            ) : null}
          </Animated.View>
        </ScrollView>
      ) : null}
    </Sheet>
  );
}
