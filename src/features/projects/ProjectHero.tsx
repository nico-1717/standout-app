import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { dictationLang } from '@/core/speech/dictation';
import { useDictation } from '@/core/speech/useDictation';

import { useTheme } from '@/core/theme/ThemeProvider';
import { mix } from '@/features/buy/buyTheme';
import { human } from '@/features/pomodoro/logic';
import { localToday, visibleTasks } from '@/features/tasks/groups';
import type { TasksRepo } from '@/features/tasks/repo';
import { AddBar, TodoIcon, sansOf } from '@/features/tasks/TodoParts';
import { todoTheme } from '@/features/tasks/todoTheme';

import { PjIcon, StatusRing } from './PjIcons';
import type { Project } from './logic';
import { isRichNote, noteText } from './notes';
import { shortDate } from './pjFormat';

/**
 * La scheda grande di un progetto (.pr-hero): il pallino di stato, il nome grande (si tocca per cambiarlo), la stella
 * dei preferiti, il tasto del Pomodoro e i tre puntini; sotto «1 di 3 fatti · scade il 18 Dic», la barra, le attività
 * (se sono accese) e l'inizio della nota.
 */
export function ProjectHero(p: {
  me: Project;
  done: number;
  total: number;
  secs: number;
  tasks: TasksRepo | null;
  version: number;
  onCycle: () => void;
  onRename: (name: string) => void;
  onFocus: () => void;
  /** lo storico dei pomodori di questo progetto (si tocca il tempo, come sul sito) */
  onHistory: () => void;
  onMenu: () => void;
  onDates: () => void;
  onNote: () => void;
  changed: () => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const today = localToday();
  const { me } = p;
  const [name, setName] = useState<string | null>(null);
  const saveName = () => {
    const next = (name ?? me.name).trim();
    setName(null);
    if (next && next !== me.name) p.onRename(next);
  };
  const date = me.due_date
    ? t('progetti.meta_scadenza', { d: shortDate(me.due_date, t, today) })
    : me.target_date
      ? t('progetti.meta_obiettivo', { d: shortDate(me.target_date, t, today) })
      : '';
  const fill = p.total ? p.done / p.total : me.status === 'completed' ? 1 : 0;
  const note = me.notes ? noteText(me.notes).trim() : '';

  return (
    <View
      style={{
        backgroundColor: th.surface,
        borderRadius: Math.min(th.radiusCard, 20),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: th.cardEdge,
        padding: 16,
        gap: 8,
        marginTop: -4,
        boxShadow: th.cardShadow,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 34 }}>
        <Pressable
          testID="proj-status"
          accessibilityRole="button"
          accessibilityLabel={t('progetti.cambia_stato')}
          hitSlop={8}
          onPress={p.onCycle}
        >
          <StatusRing status={me.status} color={me.color} size={26} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <TextInput
            testID="proj-name"
            value={name ?? me.name}
            onChangeText={setName}
            onBlur={saveName}
            onSubmitEditing={saveName}
            placeholder={t('progetti.nome')}
            placeholderTextColor={th.text3}
            returnKeyType="done"
            // il titolo va a capo invece di tagliarsi con «…» (sul sito è un testo che si allarga)
            multiline
            scrollEnabled={false}
            submitBehavior="blurAndSubmit"
            style={{
              flexShrink: 1,
              color: th.text,
              fontSize: 24,
              fontWeight: th.display ? undefined : '800',
              fontFamily: th.display,
              letterSpacing: -0.5,
              paddingVertical: 2,
            }}
          />
          {me.is_favorite ? <PjIcon name="star" color="#E0B84A" size={17} /> : null}
        </View>
        <Pressable
          testID="proj-start"
          accessibilityRole="button"
          accessibilityLabel={t('progetti.concentrati')}
          onPress={p.onFocus}
          style={({ pressed }) => ({
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: me.color,
            transform: [{ scale: pressed ? 0.92 : 1 }],
          })}
        >
          <PjIcon name="timer" color="#FFFFFF" size={18} width={2} />
        </Pressable>
        <Pressable
          testID="proj-menu"
          accessibilityRole="button"
          accessibilityLabel={t('progetti.altro')}
          onPress={p.onMenu}
          style={({ pressed }) => ({
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: th.surface2,
            transform: [{ scale: pressed ? 0.92 : 1 }],
          })}
        >
          <PjIcon name="dots" color={th.text2} size={18} />
        </Pressable>
      </View>

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 4,
          marginTop: 2,
        }}
      >
        {date ? (
          <Pressable
            testID="proj-date-meta"
            accessibilityRole="button"
            onPress={p.onDates}
            hitSlop={6}
          >
            <Text style={{ color: th.text, opacity: 0.8, fontSize: 14 }}>{date}</Text>
          </Pressable>
        ) : null}
        {p.secs ? (
          <Pressable
            testID="proj-time"
            accessibilityRole="button"
            onPress={p.onHistory}
            hitSlop={6}
          >
            <Text style={{ color: th.text2, fontSize: 14 }}>
              {date ? '· ' : ''}
              {t('progetti.durata_totale', { durata: human(p.secs) })}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View
        style={{
          height: 5,
          borderRadius: 99,
          backgroundColor: th.surface2,
          overflow: 'hidden',
          marginTop: 6,
        }}
      >
        <View
          style={{
            height: 5,
            borderRadius: 99,
            width: `${Math.round(fill * 100)}%`,
            backgroundColor: me.color,
          }}
        />
      </View>

      {me.todo_enabled && p.tasks ? (
        <HeroTasks repo={p.tasks} project={me.uuid} version={p.version} changed={p.changed} />
      ) : null}

      {note ? (
        <Pressable
          testID="proj-note-preview"
          accessibilityRole="button"
          onPress={p.onNote}
          style={{ marginTop: 4 }}
        >
          <Text
            numberOfLines={isRichNote(me.notes) ? 6 : 8}
            style={{ color: th.text, opacity: 0.8, fontSize: 15, lineHeight: 21 }}
          >
            {note}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Le attività del progetto dentro la scheda: la barra per aggiungere (come nel To do), le spunte, e il vuoto in corsivo. */
function HeroTasks(p: { repo: TasksRepo; project: string; version: number; changed: () => void }) {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const td = useMemo(() => todoTheme(th.style, th), [th]);
  const [title, setTitle] = useState('');
  const tasks = useMemo(() => {
    void p.version;
    return visibleTasks(p.repo.ofProject(p.project), localToday());
  }, [p.repo, p.project, p.version]);

  const addText = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    p.repo.create({ title: text, project_uuid: p.project });
    setTitle('');
    p.changed();
  };
  const add = () => addText(title);
  // il microfono: una frase = un'attività
  const mic = useDictation({
    lang: dictationLang(i18n.language),
    once: true,
    onInterim: setTitle,
    onFinal: setTitle,
    onStop: (heard) => addText(heard),
  });
  const toggle = (uuid: string, done: boolean) => {
    p.repo.update(uuid, { is_done: !done });
    p.changed();
  };

  return (
    <View style={{ marginTop: 3 }}>
      <AddBar
        td={td}
        value={title}
        onChange={setTitle}
        onSubmit={add}
        pieces={[]}
        inputID="proj-task-new"
        addID="proj-task-add"
        fadeEmpty
        mic={{ active: mic.active, onPress: () => (mic.active ? mic.stop() : mic.start()) }}
      />
      {tasks.length === 0 ? (
        <Text
          testID="proj-task-empty"
          style={[
            {
              color: td.ink2,
              fontSize: 15,
              lineHeight: 22,
              textAlign: 'center',
              paddingHorizontal: 12,
              paddingVertical: 14,
            },
            td.serif ? { fontFamily: td.serif } : { fontStyle: 'italic' },
          ]}
        >
          {t('todo.tn_vuoto_todo')}
        </Text>
      ) : (
        <View style={{ gap: 2 }}>
          {tasks.map((task) => {
            const done = !!task.is_done;
            return (
              <Pressable
                key={task.uuid}
                testID={`proj-task-${task.uuid}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
                onPress={() => toggle(task.uuid, done)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 42 }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: done ? td.accent : 'transparent',
                    borderWidth: done ? 0 : 1.6,
                    borderColor: mix(td.ink, td.card, 0.28),
                  }}
                >
                  {done ? <TodoIcon name="check" color={td.onAccent} size={12} width={3} /> : null}
                </View>
                <Text
                  style={[
                    {
                      flex: 1,
                      color: done ? td.ink3 : td.ink,
                      fontSize: 16,
                      textDecorationLine: done ? 'line-through' : 'none',
                    },
                    sansOf(td),
                  ]}
                >
                  {task.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
