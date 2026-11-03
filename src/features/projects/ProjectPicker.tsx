import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';

import { flatten, type Project } from './logic';

function PickRow({
  label,
  color,
  depth,
  on,
  id,
  onPick,
}: {
  label: string;
  color: string | null;
  depth: number;
  on: boolean;
  id: string | null;
  onPick: (uuid: string | null) => void;
}) {
  const th = useTheme();
  return (
    <Pressable
      testID={`project-pick-${id ?? 'none'}`}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={() => onPick(id)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 11,
        paddingLeft: 14 + depth * 18,
        paddingRight: 14,
        backgroundColor: on ? th.brandSoft : 'transparent',
      }}
    >
      <View
        style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color ?? th.text3 }}
      />
      <Text style={{ color: th.text, fontSize: 15, flex: 1 }} numberOfLines={1}>
        {label}
      </Text>
      {on ? <Text style={{ color: th.brand, fontWeight: '700' }}>✓</Text> : null}
    </Pressable>
  );
}

/**
 * La scelta di un progetto: l'albero dei progetti non conclusi (rientri come nel sito), con un pallino del loro colore,
 * più «nessun progetto». Serve al Pomodoro e, dopo, a tutto il resto (attività, storico, mazzi).
 */
export function ProjectPicker({
  projects,
  value,
  onPick,
  extras,
  hideNone,
}: {
  projects: Project[];
  value: string | null;
  onPick: (uuid: string | null) => void;
  /** righe in più in cima (nei filtri: «tutti», «senza progetto»); `id` torna in `onPick` */
  extras?: { id: string; label: string }[];
  /** nasconde «nessun progetto» (quando le `extras` lo dicono già) */
  hideNone?: boolean;
}) {
  const { t } = useTranslation();
  const rows = flatten(projects, {
    showCompleted: false,
    onlyWorked: null,
    order: 'manuale',
    collapsed: new Set<string>(),
  });
  return (
    <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
      {(extras ?? []).map((x) => (
        <PickRow
          key={x.id}
          label={x.label}
          color={null}
          depth={0}
          on={value === x.id}
          id={x.id}
          onPick={onPick}
        />
      ))}
      {hideNone ? null : (
        <PickRow
          label={t('pomodoro.nessun_progetto')}
          color={null}
          depth={0}
          on={value === null}
          id={null}
          onPick={onPick}
        />
      )}
      {rows.map((r) => (
        <PickRow
          key={r.project.uuid}
          label={r.project.name}
          color={r.project.color}
          depth={r.depth}
          on={value === r.project.uuid}
          id={r.project.uuid}
          onPick={onPick}
        />
      ))}
    </ScrollView>
  );
}
