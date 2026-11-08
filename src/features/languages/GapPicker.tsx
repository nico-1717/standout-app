import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';

import { gapKeys, gapSpans, keysFromSpans, piecesFromKeys, writeChoice } from './gap';

/**
 * Sceglie a mano cosa nascondere in una frase d'esempio: un tasto per parola (e per apostrofo: «I'm» = I ' m).
 * «Automatica» rimette il calcolo del sito (la parola della carta o una sua forma); «Azzera» spegne tutto.
 * `onDone` dà il nuovo `gap_text` ('' = automatica).
 */
export function GapPicker({
  text,
  word,
  gap,
  tag,
  onDone,
  onCancel,
}: {
  text: string;
  word: string;
  gap: string | null;
  tag: string;
  onDone: (gap: string) => void;
  onCancel: () => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const auto = gapSpans(text, word, null).filter((s) => s.tipo !== 'trattini');
  const [on, setOn] = useState<Set<number>>(() => keysFromSpans(text, gapSpans(text, word, gap)));
  const keys = gapKeys(text);
  const same = (a: { da: number; a: number }[], b: { da: number; a: number }[]) =>
    a.length === b.length && a.every((x, i) => x.da === b[i]!.da && x.a === b[i]!.a);
  const pieces = piecesFromKeys(text, on);
  const isAuto = same(pieces, auto);
  const flip = (k: number) => {
    const next = new Set(on);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setOn(next);
  };
  const btn = (
    id: string,
    label: string,
    onPress: () => void,
    opts?: { disabled?: boolean; primary?: boolean },
  ) => (
    <Pressable
      testID={`${tag}-${id}`}
      accessibilityRole="button"
      disabled={opts?.disabled}
      onPress={onPress}
      hitSlop={6}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: opts?.primary ? th.brand : th.surface2,
        opacity: opts?.disabled ? 0.4 : 1,
      }}
    >
      <Text style={{ color: opts?.primary ? '#fff' : th.text, fontWeight: '600', fontSize: 14 }}>
        {label}
      </Text>
    </Pressable>
  );
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: th.text2, fontSize: 13 }}>{t('fcv.es_guida2')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        {keys.map((x, n) =>
          x.tasto && x.k !== undefined ? (
            <Pressable
              key={n}
              testID={`${tag}-key-${x.k}`}
              accessibilityRole="button"
              accessibilityState={{ selected: on.has(x.k) }}
              onPress={() => flip(x.k!)}
              hitSlop={4}
              style={{
                paddingHorizontal: x.apostrofo ? 6 : 10,
                paddingVertical: 8,
                minWidth: 36,
                alignItems: 'center',
                borderRadius: 10,
                backgroundColor: on.has(x.k) ? th.brand : th.surface2,
              }}
            >
              <Text style={{ color: on.has(x.k) ? '#fff' : th.text, fontSize: 16 }}>{x.t}</Text>
            </Pressable>
          ) : null,
        )}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {auto.length
          ? btn(
              'auto',
              t('fcv.es_auto_btn'),
              () =>
                setOn(
                  keysFromSpans(
                    text,
                    auto.map((s) => ({ ...s, tipo: 'parola' as const })),
                  ),
                ),
              {
                disabled: isAuto,
              },
            )
          : null}
        {btn('clear', t('fcv.es_azzera'), () => setOn(new Set()), { disabled: on.size === 0 })}
        {btn('cancel', t('comune.annulla'), onCancel)}
        {btn('done', t('fcv.es_fatto'), () => onDone(isAuto ? '' : writeChoice(text, pieces)), {
          primary: true,
        })}
      </View>
    </View>
  );
}
