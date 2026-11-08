import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { localNow, localToday, visibleTasks } from '@/features/tasks/groups';
import type { Task, TasksRepo } from '@/features/tasks/repo';
import { Card, PrimaryButton, SectionLabel, TextButton } from '@/ui/kit';

/**
 * Il post-it del Pomodoro (pomodoro.php): le attività da fare durante il timer. Con un progetto si vedono le sue
 * attività; senza, solo quelle scritte qui in questa sessione (il sito parte «davvero vuoto»). Le nuove attività
 * prendono il progetto, il giorno di oggi e l'ora di adesso. A pomodoro finito si chiede cosa farne.
 */
export function TasksNote(p: {
  repo: TasksRepo;
  project: string | null;
  /** le attività scritte in questa sessione (servono quando non c'è un progetto) */
  created: string[];
  onCreated: (uuid: string) => void;
  onReset: () => void;
  version: number;
  changed: () => void;
  /** l'identificativo del pomodoro appena concluso, se c'è: allora si chiede cosa fare delle attività */
  finished: string | null;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [answered, setAnswered] = useState<string | null>(null);

  const items = useMemo(() => {
    void p.version;
    const rows: Task[] = p.project
      ? visibleTasks(p.repo.ofProject(p.project), localToday())
      : p.created.map((id) => p.repo.get(id)).filter((x): x is Task => !!x);
    return rows;
  }, [p.repo, p.project, p.created, p.version]);

  const add = () => {
    const text = title.trim();
    if (!text) return;
    const uuid = p.repo.create({
      title: text,
      due_date: localToday(),
      due_time: localNow(),
      ...(p.project ? { project_uuid: p.project } : {}),
    });
    p.onCreated(uuid);
    setTitle('');
    p.changed();
  };
  const toggle = (task: Task) => {
    p.repo.update(task.uuid, { is_done: !task.is_done });
    p.changed();
  };
  const close = (mode: 'done' | 'all' | 'keep') => {
    if (mode !== 'keep') {
      const gone = items.filter((x) => mode === 'all' || x.is_done).map((x) => x.uuid);
      p.repo.removeMany(gone);
      p.onReset();
    }
    setAnswered(p.finished);
    p.changed();
  };

  const asking = !!p.finished && answered !== p.finished && items.length > 0;
  const ticked = items.filter((x) => x.is_done).length;

  return (
    <Card style={{ padding: 16, gap: 10 }}>
      <Pressable
        testID="pomo-note-toggle"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <SectionLabel>{t('pomodoro.attivita')}</SectionLabel>
        <Text style={{ color: th.brand }}>
          {items.length ? `${ticked}/${items.length}` : ''} {open ? '▴' : '▾'}
        </Text>
      </Pressable>

      {asking ? (
        <View style={{ gap: 8 }} testID="pomo-note-ask">
          <Text style={{ color: th.text, fontWeight: '700', fontSize: 16 }}>
            {t('pomodoro.attivita_di_questo')}
          </Text>
          <Text style={{ color: th.text2 }}>
            {t('pomodoro.n_su_n_spuntate', { fatte: ticked, totale: items.length })}
          </Text>
          <PrimaryButton
            testID="pomo-note-del-done"
            label={t('pomodoro.elimina_spuntate')}
            onPress={() => close('done')}
          />
          <TextButton
            testID="pomo-note-del-all"
            danger
            label={t('pomodoro.elimina_tutte')}
            onPress={() => close('all')}
          />
          <TextButton
            testID="pomo-note-keep"
            label={t('pomodoro.tienile_tutte')}
            onPress={() => close('keep')}
          />
        </View>
      ) : null}

      {open ? (
        <View style={{ gap: 8 }}>
          {items.map((task) => {
            const done = !!task.is_done;
            return (
              <Pressable
                key={task.uuid}
                testID={`pomo-note-${task.uuid}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
                onPress={() => toggle(task)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 }}
              >
                <Text style={{ color: done ? th.brand : th.text2, fontSize: 20 }}>
                  {done ? '☑' : '☐'}
                </Text>
                <Text
                  style={{
                    flex: 1,
                    color: done ? th.text3 : th.text,
                    textDecorationLine: done ? 'line-through' : 'none',
                  }}
                >
                  {task.title}
                </Text>
              </Pressable>
            );
          })}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              testID="pomo-note-new"
              value={title}
              onChangeText={setTitle}
              onSubmitEditing={add}
              returnKeyType="done"
              placeholder={t('todo.nuova_attivita')}
              placeholderTextColor={th.text3}
              style={{
                flex: 1,
                color: th.text,
                backgroundColor: th.surface2,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            />
            <Pressable
              testID="pomo-note-add"
              accessibilityRole="button"
              accessibilityLabel={t('todo.tn_aggiungi')}
              onPress={add}
              style={{
                justifyContent: 'center',
                paddingHorizontal: 14,
                borderRadius: 10,
                backgroundColor: th.brand,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>{t('todo.tn_aggiungi')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Card>
  );
}
