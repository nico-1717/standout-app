import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { Confetti, type Burst } from '@/features/habits/Confetti';
import { Sheet } from '@/features/habits/Sheet';
import { habitsTheme } from '@/features/habits/habitsTheme';

import { CardImage } from '../CardImage';
import { DocView } from '../DocView';
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

  const answer = (ok: boolean) => {
    if (ok) {
      setGot(got + 1);
      onRight(got + 1);
    } else onWrong();
    setShown(false);
    setI(i + 1);
  };

  const btn = (testID: string, label: string, bg: string, fg: string, onPress: () => void) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        backgroundColor: bg,
      }}
    >
      <Text style={{ color: fg, fontWeight: '800', fontSize: 16 }}>{label}</Text>
    </Pressable>
  );

  return (
    <Sheet
      visible={visible}
      th={ht}
      testID="fcg-boss"
      title={t('fcv.boss_titolo')}
      onClose={onClose}
      overlay={<Confetti bursts={bursts} onDone={onBurstDone} />}
      footer={
        over ? (
          btn('fcg-boss-end', t('fcv.ck_continua'), th.brand, '#fff', onClose)
        ) : shown ? (
          <>
            {btn('fcg-boss-no', t('fcv.boss_mancato'), th.red, '#fff', () => answer(false))}
            {btn('fcg-boss-yes', t('fcv.boss_preso'), th.green, '#fff', () => answer(true))}
          </>
        ) : (
          btn('fcg-boss-show', t('fcv.boss_mostra'), th.brand, '#fff', () => setShown(true))
        )
      }
    >
      {over ? (
        <View testID="fcg-boss-result" style={{ padding: 28, alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 56 }}>{won ? '👑' : '🔥'}</Text>
          <Text style={{ color: ht.text, fontSize: 24, fontWeight: '800', textAlign: 'center' }}>
            {won ? t('fcv.boss_vinto') : t('fcv.boss_parziale', { g: got, n: cards.length })}
          </Text>
          <Text style={{ color: ht.text2, textAlign: 'center' }}>
            {won ? t('fcv.boss_vinto_sub') : t('fcv.boss_parziale_sub')}
          </Text>
        </View>
      ) : card ? (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
            {cards.map((c, j) => (
              <View
                key={c.key}
                style={{
                  width: j === i ? 22 : 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: j < i ? th.green : j === i ? th.brand : ht.hairline2,
                }}
              />
            ))}
          </View>
          <Text style={{ color: ht.text2, fontSize: 13, textAlign: 'center' }}>
            {t(vocab ? 'fcv.boss_domanda' : 'fcv.boss_domanda_studio')}
          </Text>
          {vocab ? (
            <Text
              testID="fcg-boss-prompt"
              style={{ color: ht.text, fontSize: 26, fontWeight: '800', textAlign: 'center' }}
            >
              {card.prompt}
            </Text>
          ) : (
            <View testID="fcg-boss-prompt">
              <DocView raw={card.prompt} size={19} />
            </View>
          )}
          {card.example ? (
            <Text style={{ color: ht.text2, fontStyle: 'italic', textAlign: 'center' }}>
              {card.example}
            </Text>
          ) : null}
          {!vocab ? <CardImage testID="fcg-boss-prompt-image" name={card.promptImage} /> : null}
          {shown ? (
            <View
              testID="fcg-boss-reveal"
              style={{
                backgroundColor: ht.surface2,
                borderRadius: 16,
                padding: 16,
                gap: 8,
                alignItems: vocab ? 'center' : 'stretch',
              }}
            >
              {vocab ? (
                <>
                  <Text style={{ color: ht.text, fontSize: 24, fontWeight: '800' }}>
                    {card.reveal}
                  </Text>
                  {card.meaning ? (
                    <Text style={{ color: ht.text2, textAlign: 'center' }}>{card.meaning}</Text>
                  ) : null}
                </>
              ) : (
                <>
                  <DocView raw={card.reveal} size={18} />
                  <CardImage testID="fcg-boss-reveal-image" name={card.revealImage} />
                </>
              )}
            </View>
          ) : null}
        </ScrollView>
      ) : null}
    </Sheet>
  );
}
