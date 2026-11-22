import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import type { Habit, HabitLog } from '@/features/habits/logic';
import { habitsTheme } from '@/features/habits/habitsTheme';
import { Sheet } from '@/features/habits/Sheet';
import type { Project } from '@/features/projects/logic';
import { haptic } from '@/ui/motion';

import { armedFromCategory, armedFromItem, type Armed } from './armed';
import { longHex, type PlannerTheme } from './plannerTheme';
import { quickLists, type QuickItem } from './quickAdd';
import type { Category } from './repo';

export type ArmMode = 'habits' | 'projects' | 'categories';

/**
 * Cosa mettere in agenda: le abitudini previste nel giorno (o i progetti preferiti, o le categorie), a seconda del
 * tastino toccato. Scegliere una voce la «arma»: poi si tocca la griglia nel punto voluto (come sul sito, dove la voce
 * scelta resta sul tastino finché non la si posa).
 */
export function ArmSheet({
  mode,
  pt,
  date,
  habits,
  logs,
  projects,
  categories,
  onClose,
  onArm,
  instantClose,
}: {
  /** la scelta di una voce chiude il foglio di colpo, senza farlo scendere: si vuole subito la griglia */
  instantClose?: boolean;
  /** null = chiuso */
  mode: ArmMode | null;
  pt: PlannerTheme;
  date: string;
  habits: Habit[];
  logs: HabitLog[];
  projects: Project[];
  categories: Category[];
  onClose: () => void;
  onArm: (armed: Armed) => void;
}) {
  const app = useTheme();
  const { t } = useTranslation();
  const ht = useMemo(() => habitsTheme(app.scheme, undefined, app.style), [app.scheme, app.style]);
  const lists = useMemo(
    () => quickLists({ habits, logs, projects, date }),
    [habits, logs, projects, date],
  );

  const chip = (
    key: string,
    testID: string,
    name: string,
    color: string,
    icon: string | null,
    note: string | null,
    onPress: () => void,
  ) => (
    <Pressable
      key={key}
      testID={testID}
      accessibilityRole="button"
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 99,
        borderWidth: 1,
        borderColor: pt.hair2,
        backgroundColor: pt.card,
      }}
    >
      {icon ? (
        <Text style={{ fontSize: 15 }}>{icon}</Text>
      ) : (
        <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color }} />
      )}
      <Text style={{ color: pt.ink, fontSize: 15, fontFamily: pt.sans }}>{name}</Text>
      {note ? (
        <Text style={{ color: pt.ink3, fontSize: 12, fontFamily: pt.sans }}>{note}</Text>
      ) : null}
    </Pressable>
  );

  const items = (title: string | null, list: QuickItem[], empty: string | null) => {
    if (!list.length && !empty) return null;
    return (
      <View style={{ gap: 8 }}>
        {title ? (
          <Text style={{ color: pt.ink2, fontSize: 13, fontFamily: pt.sans, letterSpacing: 0.3 }}>
            {title}
          </Text>
        ) : null}
        {list.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {list.map((it) =>
              chip(
                `${it.kind}-${it.uuid}`,
                `quick-${it.kind}-${it.uuid}`,
                it.name,
                it.color,
                it.icon,
                it.progress,
                () => onArm(armedFromItem(it)),
              ),
            )}
          </View>
        ) : (
          <Text style={{ color: pt.ink2, fontFamily: pt.serif, fontSize: 16 }}>{empty}</Text>
        )}
      </View>
    );
  };

  const title =
    mode === 'projects'
      ? t('planner.progetti_preferiti')
      : mode === 'categories'
        ? t('planner.categoria_predefinita')
        : t('planner.abitudini');
  const sorted = [...categories].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );

  return (
    <Sheet
      visible={mode !== null}
      title={title}
      th={ht}
      onClose={onClose}
      testID="quick-sheet"
      instantClose={instantClose}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: 460 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16, gap: 18 }}
      >
        <Text style={{ color: pt.ink3, fontSize: 13, fontFamily: pt.sans }}>
          {t('planner.tocca_il_calendario_dove_metterlo')}
        </Text>
        {mode === 'habits' ? (
          <>
            {items(
              null,
              lists.habits,
              lists.weekly.length ? null : t('planner.nessuna_abitudine_per_oggi'),
            )}
            {items(t('planner.questa_settimana'), lists.weekly, null)}
          </>
        ) : null}
        {mode === 'projects'
          ? items(null, lists.projects, t('planner.app_nessun_preferito'))
          : null}
        {mode === 'categories' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {sorted.map((c) =>
              chip(
                c.uuid,
                `arm-cat-${c.uuid}`,
                c.name,
                longHex(c.color, pt.accent),
                null,
                null,
                () => onArm(armedFromCategory(c, longHex(c.color, pt.accent))),
              ),
            )}
          </View>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}
