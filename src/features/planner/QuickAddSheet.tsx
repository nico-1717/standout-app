import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import type { Habit, HabitLog } from '@/features/habits/logic';
import { habitsTheme } from '@/features/habits/habitsTheme';
import { Sheet } from '@/features/habits/Sheet';
import type { Project } from '@/features/projects/logic';
import { haptic } from '@/ui/motion';

import type { PlannerTheme } from './plannerTheme';
import { cleanTime, quickLists, type QuickItem } from './quickAdd';

/**
 * «Abitudini e progetti»: le abitudini previste nel giorno e i progetti preferiti. Si tocca una voce, si sceglie
 * l'ora (e la durata) e finisce in agenda legata alla sua abitudine o al suo progetto. Sul sito è l'attrezzo
 * armato: si sceglie e si tocca il calendario; sul telefono si scrive l'ora, come per le routine.
 */
export function QuickAddSheet({
  visible,
  pt,
  date,
  habits,
  logs,
  projects,
  defaultStart,
  onClose,
  onPlace,
}: {
  visible: boolean;
  pt: PlannerTheme;
  date: string;
  habits: Habit[];
  logs: HabitLog[];
  projects: Project[];
  /** l'ora proposta: la prossima mezz'ora se il giorno è oggi, altrimenti le 09:00 */
  defaultStart: string;
  onClose: () => void;
  onPlace: (item: QuickItem, start: string, minutes: number) => void;
}) {
  const app = useTheme();
  const { t } = useTranslation();
  const ht = useMemo(() => habitsTheme(app.scheme, undefined, app.style), [app.scheme, app.style]);
  const lists = useMemo(
    () => quickLists({ habits, logs, projects, date }),
    [habits, logs, projects, date],
  );
  const [picked, setPicked] = useState<QuickItem | null>(null);
  const [start, setStart] = useState(defaultStart);
  const [minutes, setMinutes] = useState('30');

  const choose = (it: QuickItem) => {
    setPicked(it);
    setStart(defaultStart);
    setMinutes(String(it.minutes));
  };
  const clean = cleanTime(start);
  const mins = Number(minutes);
  const ok = !!picked && !!clean && Number.isInteger(mins) && mins >= 5 && mins <= 1439;

  const field = {
    color: pt.ink,
    fontFamily: pt.sans,
    fontSize: 17,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: app.radiusButton,
    borderWidth: 1,
    borderColor: pt.hair2,
    backgroundColor: pt.card,
    minWidth: 84,
    textAlign: 'center' as const,
  };

  const section = (title: string, items: QuickItem[], emptyText: string | null) => {
    if (!items.length && !emptyText) return null;
    return (
      <View style={{ gap: 8 }}>
        <Text style={{ color: pt.ink2, fontSize: 13, fontFamily: pt.sans, letterSpacing: 0.3 }}>
          {title}
        </Text>
        {items.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {items.map((it) => {
              const on = picked?.uuid === it.uuid && picked.kind === it.kind;
              return (
                <Pressable
                  key={`${it.kind}-${it.uuid}`}
                  testID={`quick-${it.kind}-${it.uuid}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    haptic.tap();
                    choose(it);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 99,
                    borderWidth: on ? 2 : 1,
                    borderColor: on ? it.color : pt.hair2,
                    backgroundColor: on ? it.color + '22' : pt.card,
                  }}
                >
                  {it.icon ? (
                    <Text style={{ fontSize: 15 }}>{it.icon}</Text>
                  ) : (
                    <View
                      style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: it.color }}
                    />
                  )}
                  <Text style={{ color: pt.ink, fontSize: 15, fontFamily: pt.sans }}>
                    {it.name}
                  </Text>
                  {it.progress ? (
                    <Text style={{ color: pt.ink3, fontSize: 12, fontFamily: pt.sans }}>
                      {it.progress}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={{ color: pt.ink2, fontFamily: pt.serif, fontSize: 16 }}>{emptyText}</Text>
        )}
      </View>
    );
  };

  return (
    <Sheet
      visible={visible}
      title={t('planner.app_aggiungi_in_agenda')}
      th={ht}
      onClose={onClose}
      testID="quick-sheet"
      footer={
        picked ? (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ gap: 2 }}>
              <Text style={{ color: pt.ink3, fontSize: 11, fontFamily: pt.sans }}>
                {t('planner.inizio')}
              </Text>
              <TextInput
                testID="quick-start"
                value={start}
                onChangeText={setStart}
                maxLength={5}
                keyboardType="numbers-and-punctuation"
                accessibilityLabel={t('planner.inizio')}
                style={field}
              />
            </View>
            <View style={{ gap: 2 }}>
              <Text style={{ color: pt.ink3, fontSize: 11, fontFamily: pt.sans }}>
                {t('planner.durata_minuti')}
              </Text>
              <TextInput
                testID="quick-minutes"
                value={minutes}
                onChangeText={setMinutes}
                maxLength={4}
                keyboardType="number-pad"
                accessibilityLabel={t('planner.durata_minuti')}
                style={field}
              />
            </View>
            <Pressable
              testID="quick-place"
              accessibilityRole="button"
              accessibilityState={{ disabled: !ok }}
              disabled={!ok}
              onPress={() => {
                if (!picked || !clean) return;
                haptic.tap();
                onPlace(picked, clean, mins);
              }}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 13,
                borderRadius: app.radiusButton,
                backgroundColor: ok ? pt.accent : pt.hair2,
              }}
            >
              <Text style={{ color: pt.onAccent, fontSize: 16, fontFamily: pt.sans }}>
                {t('planner.inserisci')}
              </Text>
            </Pressable>
          </View>
        ) : undefined
      }
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: 460 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16, gap: 18 }}
      >
        {section(
          t('planner.abitudini'),
          lists.habits,
          lists.weekly.length ? null : t('planner.nessuna_abitudine_per_oggi'),
        )}
        {section(t('planner.questa_settimana'), lists.weekly, null)}
        {section(
          t('planner.progetti_preferiti'),
          lists.projects,
          t('planner.app_nessun_preferito'),
        )}
      </ScrollView>
    </Sheet>
  );
}
