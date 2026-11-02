import { QuickNoteCard } from '@/features/notes/QuickNoteCard';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import {
  GROUP_ORDER,
  groupTasks,
  isLate,
  localNow,
  localToday,
  visibleTasks,
  type TaskGroup,
} from '@/features/tasks/groups';
import type { Task } from '@/features/tasks/repo';
import { readPhrase } from '@/features/tasks/smart';
import {
  AddBar,
  BulkBar,
  GroupHead,
  WhenModal,
  sansOf,
  type When,
} from '@/features/tasks/TodoParts';
import { TodoRow, type RowActions } from '@/features/tasks/TodoRow';
import { cleanMinutes, humanDay, type UnderstoodPiece } from '@/features/tasks/todoLogic';
import { todoTheme } from '@/features/tasks/todoTheme';
import { cardShadow } from '@/ui/kit';
import { SyncBadge } from '@/ui/SyncBadge';

/** Quello che serve a tenere ferma una riga mentre la si tocca: giorno, ora e «fatta» di prima (il sito non riordina «da sotto il dito»). */
type Pin = Pick<Task, 'uuid' | 'due_date' | 'due_time' | 'is_done'>;

type WhenTarget = { kind: 'row'; uuid: string } | { kind: 'bulk' } | null;

const GROUP_KEY: Record<TaskGroup, string> = {
  ritardo: 'todo.tn_g_ritardo',
  oggi: 'todo.tn_g_oggi',
  domani: 'todo.tn_g_domani',
  settimana: 'todo.tn_g_settimana',
  dopo: 'todo.tn_g_dopo',
  senza: 'todo.tn_g_senza',
  fatte: 'todo.tn_g_fatte',
};

export default function TodoScreen() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { services, version, changed, uiStyle } = useApp();
  const td = todoTheme(uiStyle, th);
  const paper = td.style === 'paper';

  const [text, setText] = useState('');
  const [openUuid, setOpenUuid] = useState<string | null>(null);
  const [pin, setPin] = useState<Pin | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [when, setWhen] = useState<WhenTarget>(null);

  const today = localToday();
  const now = localNow();

  const tasks = useMemo(
    () => (services ? services.tasks.list('todo') : []),
    // `version` cambia a ogni modifica (locale o dal server): è ciò che fa rileggere la lista
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, version],
  );
  const subsOf = useMemo(() => {
    const m = new Map<string, Task[]>();
    if (services)
      for (const s of services.db.all<Task>(
        `SELECT * FROM todos WHERE list_type='todo' AND parent_uuid IS NOT NULL ORDER BY sort_key`,
      )) {
        const k = s.parent_uuid!;
        m.set(k, [...(m.get(k) ?? []), s]);
      }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, version]);

  const byUuid = useMemo(() => new Map(tasks.map((x) => [x.uuid, x])), [tasks]);

  // I gruppi si decidono con la riga toccata «com'era»; si disegna poi la riga vera.
  const groups = useMemo(() => {
    const shown = visibleTasks(tasks, today).map((x) =>
      pin && x.uuid === pin.uuid ? { ...x, ...pin } : x,
    );
    return groupTasks(shown, today, now).map((g) => ({
      group: g.group,
      tasks: g.tasks.map((x) => byUuid.get(x.uuid) ?? x),
    }));
  }, [tasks, byUuid, pin, today, now]);

  const locale = i18n.language;
  const words = {
    today: t('todo.tn_oggi'),
    tomorrow: t('todo.tn_domani'),
    yesterday: t('todo.tn_ieri'),
  };

  // Cosa ha capito la barra, mentre si scrive.
  const pieces = useMemo<UnderstoodPiece[]>(() => {
    if (!text.trim()) return [];
    const r = readPhrase(text, [], { date: today, time: now });
    const out: UnderstoodPiece[] = [];
    if (r.date) out.push({ kind: 'date', text: humanDay(r.date, today, locale, words) });
    if (r.time) out.push({ kind: 'time', text: r.time });
    if (r.minutes) out.push({ kind: 'minutes', text: `${r.minutes} min` });
    if (r.projectNew)
      out.push({ kind: 'nessuno', text: t('todo.tn_progetto_no', { n: r.projectNew }) });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, today, now, locale, t]);

  function release() {
    setOpenUuid(null);
    setPin(null);
  }

  function freeze(task: Task) {
    setPin((p) =>
      p && p.uuid === task.uuid
        ? p
        : {
            uuid: task.uuid,
            due_date: task.due_date,
            due_time: task.due_time,
            is_done: task.is_done,
          },
    );
  }

  function add() {
    if (!services) return;
    // più righe incollate = più attività (come sul sito: si toglie l'elenco puntato davanti)
    const lines = text
      .split(/\r?\n/)
      .map((s) => s.replace(/^[\s\-•*·]+|^\d{1,2}[.)]\s+/, '').trim())
      .filter(Boolean)
      .slice(0, 60);
    let any = false;
    for (const line of lines) {
      const r = readPhrase(line, [], { date: today, time: now });
      if (!r.title) continue;
      services.tasks.create({
        title: r.title,
        ...(r.date ? { due_date: r.date } : {}),
        ...(r.time ? { due_time: r.time } : {}),
        ...(r.minutes ? { duration_minutes: r.minutes } : {}),
      });
      any = true;
    }
    if (!any) return;
    setText('');
    release();
    changed();
  }

  function confirmDelete(task: Task) {
    const name = task.title.trim();
    Alert.alert(
      t('todo.elimino_attivita'),
      name ? t('todo.nome_non_recuperabile', { nome: name }) : t('todo.non_recuperabile'),
      [
        { text: t('comune.annulla'), style: 'cancel' },
        {
          text: t('comune.elimina'),
          style: 'destructive',
          onPress: () => {
            services?.tasks.remove(task.uuid);
            release();
            changed();
          },
        },
      ],
    );
  }

  const actions: RowActions = {
    toggle: (task) => {
      freeze(task);
      services?.tasks.update(task.uuid, { is_done: !task.is_done });
      changed();
    },
    rename: (task, title) => {
      freeze(task);
      services?.tasks.update(task.uuid, { title });
      changed();
    },
    setDate: (task, date) => {
      freeze(task);
      // «Senza data» toglie anche l'ora (come sul sito)
      services?.tasks.update(
        task.uuid,
        date ? { due_date: date } : { due_date: null, due_time: null },
      );
      changed();
    },
    setMinutes: (task, minutes) => {
      freeze(task);
      services?.tasks.update(task.uuid, { duration_minutes: minutes });
      changed();
    },
    editWhen: (task) => {
      freeze(task);
      setWhen({ kind: 'row', uuid: task.uuid });
    },
    remove: confirmDelete,
    open: (uuid) => {
      if (uuid && pin && pin.uuid !== uuid) setPin(null);
      setOpenUuid(uuid);
    },
    pick: (uuid) =>
      setPicked((p) => (p.includes(uuid) ? p.filter((u) => u !== uuid) : [...p, uuid])),
  };

  function toggleSelect() {
    release();
    setPicked([]);
    setSelecting((s) => !s);
  }

  function bulkDelete() {
    if (!picked.length || !services) return;
    const n = picked.length;
    Alert.alert(
      n === 1 ? t('todo.n_attivita_1') : t('todo.n_attivita', { n }),
      t('todo.non_recuperabile'),
      [
        { text: t('comune.annulla'), style: 'cancel' },
        {
          text: t('comune.elimina'),
          style: 'destructive',
          onPress: () => {
            services.tasks.removeMany(picked);
            setPicked([]);
            changed();
          },
        },
      ],
    );
  }

  function applyWhen(w: When) {
    if (!services || !when) return;
    const patch = {
      due_date: w.date || null,
      due_time: w.date && w.time ? w.time : null,
    };
    if (when.kind === 'row') {
      services.tasks.update(when.uuid, patch);
    } else {
      for (const u of picked)
        services.tasks.update(u, { ...patch, duration_minutes: cleanMinutes(w.minutes) });
      setPicked([]);
    }
    setWhen(null);
    changed();
  }

  const whenTask = when?.kind === 'row' ? (byUuid.get(when.uuid) ?? null) : null;
  const whenInitial: When =
    when?.kind === 'row' && whenTask
      ? {
          date: whenTask.due_date ?? '',
          time: whenTask.due_time?.slice(0, 5) ?? '',
          minutes: whenTask.duration_minutes || 30,
        }
      : { date: today, time: '', minutes: 30 };

  const shownCount = groups.reduce((n, g) => n + g.tasks.length, 0);

  return (
    <View style={{ flex: 1, backgroundColor: td.page }}>
      {selecting && (
        <View
          style={{
            paddingTop: insets.top + 8,
            paddingHorizontal: 34,
            backgroundColor: td.card,
          }}
        >
          <BulkBar
            td={td}
            count={picked.length}
            onSchedule={() => picked.length && setWhen({ kind: 'bulk' })}
            onDelete={bulkDelete}
          />
        </View>
      )}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: selecting ? 0 : insets.top + 12,
          paddingHorizontal: selecting ? 0 : 16,
          paddingBottom: 120,
        }}
      >
        {!selecting && (
          <View style={styles.top}>
            <SyncBadge />
          </View>
        )}
        <View
          style={[
            styles.sheet,
            { backgroundColor: td.card },
            selecting ? { borderRadius: 0, paddingTop: 8 } : { borderRadius: 26 },
            cardShadow(td.dark),
          ]}
        >
          {!selecting && (
            <>
              <View style={styles.head}>
                <Text
                  style={[
                    {
                      color: td.ink,
                      fontSize: paper ? 32 : 30,
                      letterSpacing: paper ? 0 : -0.6,
                      fontWeight: paper ? '400' : '700',
                      fontStyle: paper ? 'italic' : 'normal',
                      fontFamily: paper ? td.serif : undefined,
                    },
                  ]}
                >
                  {t('todo.titolo')}
                </Text>
                <Text
                  style={[
                    {
                      color: td.ink3,
                      fontSize: paper ? 9.5 : 11,
                      letterSpacing: paper ? 1.9 : 0.1,
                      textTransform: 'uppercase',
                      flexShrink: 1,
                      textAlign: 'right',
                    },
                    sansOf(td),
                  ]}
                >
                  {t('todo.sottotitolo')}
                </Text>
              </View>
              <Text
                style={{
                  color: td.ink2,
                  fontSize: paper ? 15 : 14,
                  lineHeight: 21,
                  fontStyle: 'italic',
                  fontFamily: paper ? td.serif : undefined,
                  marginTop: 2,
                  marginBottom: 16,
                }}
              >
                {t('todo.nota')}
              </Text>
            </>
          )}

          {!selecting && <QuickNoteCard td={td} paper={paper} />}

          <View style={styles.label}>
            <Text
              style={[
                {
                  color: td.ink3,
                  fontSize: 9,
                  fontWeight: '500',
                  letterSpacing: 1.6,
                  textTransform: 'uppercase',
                },
                sansOf(td),
              ]}
            >
              {t('planner.to_do')}
            </Text>
            <Pressable
              testID="todo-select"
              accessibilityRole="button"
              onPress={toggleSelect}
              hitSlop={8}
            >
              <Text
                style={[
                  {
                    color: selecting ? td.accent : td.ink2,
                    fontSize: 12,
                    fontWeight: selecting ? '500' : '400',
                  },
                  sansOf(td),
                ]}
              >
                {selecting ? t('comune.fine') : t('comune.seleziona')}
              </Text>
            </Pressable>
          </View>

          <AddBar
            td={td}
            value={text}
            onChange={setText}
            onSubmit={add}
            onFocus={release}
            pieces={pieces}
          />

          {!services ? (
            <Text style={[styles.empty, { color: td.ink2 }]}>{t('comune.carica')}</Text>
          ) : shownCount === 0 ? (
            <Text
              testID="todo-empty"
              style={[styles.empty, { color: td.ink2, fontFamily: paper ? td.serif : undefined }]}
            >
              {t('todo.tn_vuoto_todo')}
            </Text>
          ) : (
            GROUP_ORDER.map((key) => groups.find((g) => g.group === key))
              .filter((g): g is NonNullable<typeof g> => !!g)
              .map((g, gi) => (
                <View key={g.group}>
                  <GroupHead
                    td={td}
                    group={g.group}
                    label={t(GROUP_KEY[g.group])}
                    count={g.tasks.length}
                    first={gi === 0}
                    onPress={release}
                  />
                  {g.tasks.map((task) => (
                    <TodoRow
                      key={task.uuid}
                      td={td}
                      task={task}
                      subs={subsOf.get(task.uuid) ?? []}
                      late={isLate(task, today, now)}
                      open={openUuid === task.uuid}
                      selecting={selecting}
                      picked={picked.includes(task.uuid)}
                      today={today}
                      locale={locale}
                      actions={actions}
                    />
                  ))}
                </View>
              ))
          )}
        </View>
      </ScrollView>

      <WhenModal
        td={td}
        visible={when !== null}
        title={
          when?.kind === 'bulk'
            ? picked.length === 1
              ? t('todo.n_attivita_1')
              : t('todo.n_attivita', { n: picked.length })
            : t('todo.data_e_ora')
        }
        sub={when?.kind === 'bulk' ? t('todo.stessa_data_per_tutte') : undefined}
        initial={whenInitial}
        today={today}
        withMinutes={when?.kind === 'bulk'}
        onCancel={() => setWhen(null)}
        onApply={applyWhen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'flex-end', marginBottom: 10, paddingHorizontal: 4 },
  sheet: { paddingTop: 22, paddingHorizontal: 18, paddingBottom: 26 },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  empty: {
    textAlign: 'center',
    paddingTop: 26,
    paddingBottom: 10,
    fontSize: 15,
    fontStyle: 'italic',
  },
});
