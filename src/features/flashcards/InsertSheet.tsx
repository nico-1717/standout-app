import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { Sheet } from '@/features/habits/Sheet';
import { habitsTheme } from '@/features/habits/habitsTheme';
import { langFlag, langName } from '@/features/languages/langs';
import type { Course } from '@/features/languages/repo';

import { DeckPicker } from './DeckPicker';
import type { Deck } from './logic';

type Step = 'kind' | 'deck' | 'course';

/**
 * «Inserisci» della barra laterale del sito, come foglio: prima dove (Università o Vocabolario). Università: si sceglie il
 * mazzo e si apre l'inserimento di molte carte. Vocabolario: la lingua (se ce n'è una sola si va dritti) e si apre il corso.
 */
export function InsertSheet(p: {
  decks: Deck[];
  courses: Course[];
  onClose: () => void;
  go: (route: string, params?: Record<string, string>) => void;
}) {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const ht = useMemo(() => habitsTheme(th.scheme, undefined, th.style), [th.scheme, th.style]);
  const [step, setStep] = useState<Step>('kind');
  const ui = i18n.language === 'en' ? 'en' : 'it';
  const open = (route: string, params?: Record<string, string>) => {
    p.onClose();
    p.go(route, params);
  };
  const option = (id: string, label: string, sub?: string, onPress?: () => void) => (
    <Pressable
      key={id}
      testID={id}
      accessibilityRole="button"
      onPress={onPress}
      style={{ backgroundColor: ht.surface2, borderRadius: 14, padding: 14, gap: 2 }}
    >
      <Text style={{ color: ht.text, fontWeight: '700', fontSize: 16 }}>{label}</Text>
      {sub ? <Text style={{ color: ht.text2, fontSize: 13 }}>{sub}</Text> : null}
    </Pressable>
  );
  const pickVocab = () => {
    const only = p.courses.length === 1 ? p.courses[0] : undefined;
    if (only) open('/lang-course', { id: only.uuid });
    else setStep('course');
  };
  return (
    <Sheet visible title={t('sidebar.inserisci')} th={ht} onClose={p.onClose} testID="insert-sheet">
      <View style={{ padding: 20, gap: 10 }}>
        {step === 'kind' ? (
          <>
            <Text style={{ color: ht.text2 }}>{t('sidebar.ins_dove')}</Text>
            {option('insert-uni', t('sidebar.ins_uni'), undefined, () => setStep('deck'))}
            {option('insert-vocab', t('sidebar.ins_lingue'), undefined, pickVocab)}
          </>
        ) : null}
        {step === 'deck' ? (
          <>
            {p.decks.length ? (
              <DeckPicker
                decks={p.decks}
                value={null}
                onPick={(d) => d && open('/fc-insert', { deck: d })}
              />
            ) : (
              <Text testID="insert-no-decks" style={{ color: ht.text2 }}>
                {t('home.crea_mazzo')}
              </Text>
            )}
          </>
        ) : null}
        {step === 'course' ? (
          <>
            <Text style={{ color: ht.text2 }}>{t('sidebar.ins_quale')}</Text>
            {p.courses.map((c) =>
              option(
                `insert-course-${c.uuid}`,
                `${langFlag(c.learn_lang)} ${langName(c.learn_lang, ui, false)}`,
                langName(c.known_lang, ui, false),
                () => open('/lang-course', { id: c.uuid }),
              ),
            )}
          </>
        ) : null}
        {step !== 'kind' ? (
          <Pressable
            testID="insert-back"
            accessibilityRole="button"
            onPress={() => setStep('kind')}
            style={{ paddingVertical: 8 }}
          >
            <Text style={{ color: ht.accent, fontWeight: '600' }}>{t('sidebar.ins_indietro')}</Text>
          </Pressable>
        ) : null}
        {step === 'kind' && !p.courses.length ? (
          <Text testID="insert-no-course" style={{ color: ht.text2, fontSize: 13 }}>
            {t('sidebar.ins_nessuna')}
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}
