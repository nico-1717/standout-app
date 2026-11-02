import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import type { Task } from '@/features/tasks/repo';
import {
  groupTasks,
  localNow,
  localToday,
  visibleTasks,
  type TaskGroup,
} from '@/features/tasks/groups';
import { Chip, Field, Header, SectionLabel, cardShadow } from '@/ui/kit';
import { SyncBadge } from '@/ui/SyncBadge';

type Item =
  | { kind: 'label'; key: string; text: string }
  | { kind: 'task'; key: string; task: Task; first: boolean; last: boolean };

export default function TodoScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { services, version, changed } = useApp();
  const [text, setText] = useState('');

  const today = localToday();
  const tasks = useMemo(
    () => (services ? services.tasks.list('todo') : []),
    // `version` cambia a ogni modifica (locale o dal server): è ciò che fa rileggere la lista
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, version],
  );
  const subCount = useMemo(() => {
    const m = new Map<string, number>();
    if (services)
      for (const r of services.db.all<{ p: string; n: number }>(
        `SELECT parent_uuid AS p, COUNT(*) AS n FROM todos WHERE list_type='todo' AND parent_uuid IS NOT NULL GROUP BY parent_uuid`,
      ))
        m.set(r.p, r.n);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, version]);

  const groupLabel: Record<TaskGroup, string> = {
    ritardo: t('todo.tn_g_ritardo'),
    oggi: t('todo.tn_g_oggi'),
    domani: t('todo.tn_g_domani'),
    settimana: t('todo.tn_g_settimana'),
    dopo: t('todo.tn_g_dopo'),
    senza: t('todo.tn_g_senza'),
    fatte: t('todo.tn_g_fatte'),
  };

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const g of groupTasks(visibleTasks(tasks, today), today, localNow())) {
      out.push({ kind: 'label', key: `l-${g.group}`, text: groupLabel[g.group] });
      g.tasks.forEach((task, i) =>
        out.push({
          kind: 'task',
          key: task.uuid,
          task,
          first: i === 0,
          last: i === g.tasks.length - 1,
        }),
      );
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, today, t]);

  function add() {
    const title = text.trim();
    if (!title || !services) return;
    services.tasks.create({ title });
    setText('');
    changed();
  }

  function toggle(task: Task) {
    services?.tasks.update(task.uuid, { is_done: !task.is_done });
    changed();
  }

  function confirmDelete(task: Task) {
    Alert.alert(t('todo.elimino_attivita'), task.title, [
      { text: t('comune.annulla'), style: 'cancel' },
      {
        text: t('comune.elimina'),
        style: 'destructive',
        onPress: () => {
          services?.tasks.remove(task.uuid);
          changed();
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
      <Header title={t('planner.to_do')} top={insets.top} right={<SyncBadge />} />
      <FlatList
        data={items}
        keyExtractor={(i) => i.key}
        contentContainerStyle={{ paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={{ color: th.text2, textAlign: 'center', marginTop: 60 }}>
            {services ? t('todo.niente_da_fare') : t('comune.carica')}
          </Text>
        }
        renderItem={({ item }) => {
          if (item.kind === 'label') return <SectionLabel>{item.text}</SectionLabel>;
          const { task } = item;
          const done = !!task.is_done;
          const subs = subCount.get(task.uuid) ?? 0;
          const overdue = !done && task.due_date !== null && task.due_date < today;
          // Ogni attività è una riga dentro la carta del suo gruppo: gli angoli arrotondati stanno solo su primo e ultimo.
          return (
            <View
              style={[
                {
                  marginHorizontal: 16,
                  backgroundColor: th.surface,
                  borderTopLeftRadius: item.first ? 22 : 0,
                  borderTopRightRadius: item.first ? 22 : 0,
                  borderBottomLeftRadius: item.last ? 22 : 0,
                  borderBottomRightRadius: item.last ? 22 : 0,
                  marginTop: item.first ? 8 : 0,
                },
                cardShadow(th.scheme === 'dark'),
              ]}
            >
              <Pressable
                onLongPress={() => confirmDelete(task)}
                accessibilityHint={t('todo.elimina_attivita')}
                style={[
                  styles.row,
                  !item.last && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: th.hairline,
                  },
                ]}
              >
                <Pressable
                  onPress={() => toggle(task)}
                  hitSlop={10}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: done }}
                  style={[
                    styles.check,
                    {
                      borderColor: done ? th.green : th.text3,
                      backgroundColor: done ? th.green : 'transparent',
                    },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: done ? th.text3 : th.text,
                      fontWeight: '600',
                      fontSize: 16,
                      textDecorationLine: done ? 'line-through' : 'none',
                    }}
                  >
                    {task.title}
                  </Text>
                  {subs > 0 && (
                    <Text style={{ color: th.text2, fontSize: 13 }}>
                      {t('app.sotto_attivita', { n: subs })}
                    </Text>
                  )}
                </View>
                {task.due_time ? (
                  <Chip label={task.due_time.slice(0, 5)} />
                ) : overdue ? (
                  <Chip label={t('todo.tn_g_ritardo')} tone="orange" />
                ) : null}
              </Pressable>
            </View>
          );
        }}
      />
      <View
        style={[styles.addBar, { backgroundColor: th.surface }, cardShadow(th.scheme === 'dark')]}
      >
        <Pressable
          onPress={add}
          style={[styles.plus, { backgroundColor: th.brand }]}
          accessibilityRole="button"
          accessibilityLabel={t('comune.aggiungi')}
        >
          <Text style={{ color: '#fff', fontSize: 20, lineHeight: 22 }}>+</Text>
        </Pressable>
        <Field
          placeholder={t('todo.cosa_da_fare')}
          value={text}
          onChangeText={setText}
          onSubmitEditing={add}
          returnKeyType="done"
          blurOnSubmit={false}
          style={{
            flex: 1,
            marginBottom: 0,
            borderWidth: 0,
            paddingVertical: 4,
            backgroundColor: 'transparent',
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
  addBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  plus: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
