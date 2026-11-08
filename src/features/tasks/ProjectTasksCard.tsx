import { useMemo, useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { Card, SectionLabel } from '@/ui/kit';

import { localToday, visibleTasks } from './groups';
import type { TasksRepo } from './repo';

/**
 * Nella scheda di un progetto: l'interruttore «Attività» (`todo_enabled`) e, se è acceso, le attività collegate al progetto
 * (come il widget del sito): si spuntano e se ne aggiungono di nuove. Le spuntate di ieri spariscono, come nell'elenco.
 */
export function ProjectTasksCard(p: {
  repo: TasksRepo;
  project: string;
  enabled: boolean;
  version: number;
  onToggle: (on: boolean) => void;
  changed: () => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const [title, setTitle] = useState('');

  const tasks = useMemo(() => {
    void p.version;
    return visibleTasks(p.repo.ofProject(p.project), localToday());
  }, [p.repo, p.project, p.version]);

  const add = () => {
    const text = title.trim();
    if (!text) return;
    p.repo.create({ title: text, project_uuid: p.project });
    setTitle('');
    p.changed();
  };
  const toggle = (uuid: string, done: boolean) => {
    p.repo.update(uuid, { is_done: !done });
    p.changed();
  };

  return (
    <Card style={{ padding: 16, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionLabel>{t('progetti.attivita')}</SectionLabel>
        <Switch
          testID="proj-todo-switch"
          accessibilityLabel={t('progetti.attivita')}
          value={p.enabled}
          onValueChange={p.onToggle}
        />
      </View>
      {p.enabled ? (
        <View style={{ gap: 8 }}>
          {tasks.map((task) => {
            const done = !!task.is_done;
            return (
              <Pressable
                key={task.uuid}
                testID={`proj-task-${task.uuid}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
                onPress={() => toggle(task.uuid, done)}
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
              testID="proj-task-new"
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
              testID="proj-task-add"
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
