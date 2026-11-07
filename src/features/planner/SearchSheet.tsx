import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { habitsTheme } from '@/features/habits/habitsTheme';
import { Sheet } from '@/features/habits/Sheet';

import { dayTitle } from './PlannerParts';
import { eventColor, type PlannerTheme } from './plannerTheme';
import type { Category, PlannerRepo } from './repo';

/** «Cerca»: si scrive almeno 2 lettere e si vedono gli eventi con quel titolo, i più vicini a oggi per primi. */
export function SearchSheet({
  visible,
  repo,
  pt,
  today,
  categories,
  onClose,
  onPick,
}: {
  visible: boolean;
  repo: PlannerRepo | null;
  pt: PlannerTheme;
  today: string;
  categories: Category[];
  onClose: () => void;
  /** il giorno dell'evento scelto (e l'ora, se non dura tutto il giorno) */
  onPick: (date: string, start: string | null) => void;
}) {
  const app = useTheme();
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const hits = useMemo(() => (repo ? repo.search(q, today) : []), [repo, q, today]);
  const ht = useMemo(() => habitsTheme(app.scheme, undefined, app.style), [app.scheme, app.style]);
  const typed = q.trim().length >= 2;
  return (
    <Sheet
      visible={visible}
      title={t('planner.cerca')}
      th={ht}
      onClose={onClose}
      testID="search-sheet"
    >
      <TextInput
        testID="search-input"
        value={q}
        onChangeText={setQ}
        autoFocus
        maxLength={60}
        returnKeyType="search"
        clearButtonMode="while-editing"
        placeholder={t('planner.titolo_dell_evento')}
        placeholderTextColor={pt.ink3}
        accessibilityLabel={t('planner.cerca')}
        style={{
          color: pt.ink,
          fontFamily: pt.sans,
          fontSize: 17,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: app.radiusButton,
          borderWidth: 1,
          borderColor: pt.hair2,
          backgroundColor: pt.card,
        }}
      />
      <ScrollView keyboardShouldPersistTaps="handled" style={{ marginTop: 12, maxHeight: 420 }}>
        {typed && hits.length === 0 ? (
          <Text
            testID="search-empty"
            style={{ color: pt.ink2, fontFamily: pt.serif, fontSize: 17, padding: 8 }}
          >
            {t('planner.nessun_evento_con_questa_parola')}
          </Text>
        ) : null}
        {hits.map((h) => {
          const color = eventColor(
            pt,
            { color: h.color },
            categories.find((c) => c.uuid === h.category_uuid),
          );
          return (
            <Pressable
              key={h.uuid}
              testID={`search-hit-${h.uuid}`}
              accessibilityRole="button"
              onPress={() => onPick(h.date, h.all_day ? null : h.start)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 12,
                paddingHorizontal: 6,
                borderBottomWidth: 1,
                borderBottomColor: pt.hair,
              }}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{ color: pt.ink, fontSize: 16, fontFamily: pt.sans }}
                >
                  {h.title}
                </Text>
                <Text style={{ color: pt.ink2, fontSize: 13, fontFamily: pt.sans }}>
                  {dayTitle(t, h.date)}
                  {h.all_day ? '' : `  ·  ${h.start}`}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}
