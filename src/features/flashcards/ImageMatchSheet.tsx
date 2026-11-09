import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { Sheet } from '@/features/habits/Sheet';
import { habitsTheme } from '@/features/habits/habitsTheme';
import { PrimaryButton, TextButton } from '@/ui/kit';

import {
  cardsFrom,
  counts,
  initialPairs,
  link,
  questionOf,
  unlink,
  type ImageCard,
} from './imageMatch';

/** Un colore per ogni coppia: si vede a colpo d'occhio chi è con chi. */
const HUES = [
  '#E07A6B',
  '#4A90D9',
  '#57B07B',
  '#E9A23B',
  '#8A6BD0',
  '#2BA3A3',
  '#D96BA8',
  '#8C8C3A',
];

/**
 * «Abbina domande e risposte»: le immagini delle domande a sinistra, quelle delle risposte a destra, già abbinate nell'ordine.
 * Si tocca una immagine e poi la sua compagna per correggere; una già abbinata, toccata, si libera. Quelle senza compagna
 * diventano carte con una immagine sola. Vive solo mentre è aperto: ogni volta riparte dall'abbinamento in ordine.
 */
export function ImageMatchSheet(props: {
  visible: boolean;
  questions: readonly string[];
  answers: readonly string[];
  onCancel: () => void;
  onCreate: (cards: ImageCard[]) => void;
}) {
  return props.visible ? <Round {...props} /> : null;
}

type Pick = { side: 'q' | 'a'; i: number } | null;

function Round({ questions, answers, onCancel, onCreate }: Parameters<typeof ImageMatchSheet>[0]) {
  const th = useTheme();
  const { t } = useTranslation();
  const ht = habitsTheme(th.scheme, th.brand, th.style);
  const [pairs, setPairs] = useState(() => initialPairs(questions.length, answers.length));
  const [picked, setPicked] = useState<Pick>(null);
  const n = counts(questions.length, answers.length, pairs);

  const press = (side: 'q' | 'a', i: number) => {
    const partner = side === 'q' ? pairs[i] : questionOf(pairs, i);
    // una già abbinata e nient'altro scelto: si libera e resta scelta, pronta per una nuova compagna
    if (!picked && partner !== undefined && partner !== null) {
      setPairs(unlink(pairs, side === 'q' ? i : partner));
      setPicked({ side, i });
      return;
    }
    if (!picked) {
      setPicked({ side, i });
      return;
    }
    if (picked.side === side) {
      // lo stesso lato: o si annulla la scelta, o si passa a questa
      setPicked(picked.i === i ? null : { side, i });
      return;
    }
    const q = side === 'q' ? i : picked.i;
    const a = side === 'a' ? i : picked.i;
    setPairs(link(pairs, q, a));
    setPicked(null);
  };

  const tile = (side: 'q' | 'a', uri: string, i: number) => {
    const partner = side === 'q' ? pairs[i] : questionOf(pairs, i);
    const pairNo = side === 'q' ? (partner !== undefined ? i : null) : partner;
    const hue = pairNo !== null && pairNo !== undefined ? HUES[pairNo % HUES.length] : null;
    const on = picked?.side === side && picked.i === i;
    return (
      <Pressable
        key={`${side}${i}`}
        testID={`fcm-${side}-${i}`}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={`${t(side === 'q' ? 'fc.ibfai_abbina_domande' : 'fc.ibfai_abbina_risposte')} ${i + 1}`}
        onPress={() => press(side, i)}
        style={{
          borderWidth: 3,
          borderRadius: 12,
          overflow: 'hidden',
          borderColor: on ? th.brand : (hue ?? ht.hairline2),
          opacity: partner === undefined || partner === null ? 0.85 : 1,
        }}
      >
        <Image
          source={{ uri }}
          contentFit="cover"
          accessibilityIgnoresInvertColors
          style={{ width: '100%', aspectRatio: 1 }}
        />
        <View
          style={{
            position: 'absolute',
            top: 4,
            left: 4,
            minWidth: 22,
            paddingHorizontal: 5,
            height: 22,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: hue ?? 'rgba(0,0,0,0.55)',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{i + 1}</Text>
        </View>
      </Pressable>
    );
  };

  const column = (side: 'q' | 'a', list: readonly string[]) => (
    <View style={{ flex: 1, gap: 8 }}>
      <Text style={{ color: ht.text2, fontWeight: '700', fontSize: 13 }}>
        {t(side === 'q' ? 'fc.ibfai_abbina_domande' : 'fc.ibfai_abbina_risposte')}
      </Text>
      {list.map((u, i) => tile(side, u, i))}
    </View>
  );

  return (
    <Sheet
      visible
      th={ht}
      testID="fcm-sheet"
      title={t('fc.ibfai_abbina_titolo')}
      onClose={onCancel}
      footer={
        <View style={{ flex: 1, gap: 4 }}>
          <Text testID="fcm-count" style={{ color: ht.text2, textAlign: 'center', fontSize: 13 }}>
            {n.pairs} {t('fc.ibfai_abbina_coppie')} · {n.alone} {t('fc.ibfai_abbina_sole')}
          </Text>
          <PrimaryButton
            testID="fcm-create"
            label={t('fc.ibfai_crea_carte')}
            onPress={() => onCreate(cardsFrom(questions, answers, pairs))}
          />
          <TextButton testID="fcm-cancel" label={t('fc.ibfai_annulla')} onPress={onCancel} />
        </View>
      }
    >
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ color: ht.text2, fontSize: 13 }}>{t('fc.ibfai_abbina_aiuto')}</Text>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          {column('q', questions)}
          {column('a', answers)}
        </View>
      </ScrollView>
    </Sheet>
  );
}
