import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SwipeRow } from '@/features/habits/SwipeRow';
import { mix } from '@/features/buy/buyTheme';

import type { Task } from './repo';
import { TodoIcon, ToolChip, sansOf } from './TodoParts';
import { cleanMinutes, humanDay, metaLine, quickDates, type DayWords } from './todoLogic';
import type { TodoTheme } from './todoTheme';

const QUICK_LABEL = {
  oggi: 'todo.tn_oggi',
  domani: 'todo.tn_domani',
  weekend: 'todo.tn_weekend',
  settimana: 'todo.tn_fra_sett',
  senza: 'todo.tn_senza_data',
} as const;

export interface RowActions {
  toggle: (task: Task) => void;
  rename: (task: Task, title: string) => void;
  setDate: (task: Task, date: string) => void;
  setMinutes: (task: Task, minutes: number) => void;
  /** apre la finestrella «data e ora» di questa attività */
  editWhen: (task: Task) => void;
  /** apre la scelta del progetto di questa attività */
  editProject: (task: Task) => void;
  remove: (task: Task) => void;
  open: (uuid: string | null) => void;
  pick: (uuid: string) => void;
}

/** La spunta tonda (.td-box) o, scegliendo, il cerchio di selezione (.td-pick). */
function Box(p: {
  td: TodoTheme;
  on: boolean;
  late: boolean;
  testID: string;
  label: string;
  onPress: () => void;
}) {
  const { td } = p;
  return (
    <Pressable
      testID={p.testID}
      onPress={p.onPress}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityLabel={p.label}
      accessibilityState={{ checked: p.on }}
      style={[
        styles.box,
        p.on
          ? { backgroundColor: td.accent }
          : { borderColor: p.late ? td.late : mix(td.ink, td.card, 0.28), borderWidth: 1.6 },
      ]}
    >
      {p.on && <TodoIcon name="check" color={td.onAccent} size={12} width={3} />}
    </Pressable>
  );
}

/** Una sotto-attività: spunta e titolo, rientrate (.td-sub). */
function SubRow(p: { td: TodoTheme; task: Task; actions: RowActions; selecting: boolean }) {
  const { td, task, actions } = p;
  const done = !!task.is_done;
  return (
    <View style={[styles.row, { paddingLeft: 24, opacity: done ? 0.62 : 1 }]}>
      <Box
        td={td}
        on={done}
        late={false}
        testID={`sub-box-${task.uuid}`}
        label={task.title}
        onPress={() => actions.toggle(task)}
      />
      <Text
        style={[
          styles.title,
          {
            flex: 1,
            color: done ? td.ink3 : td.ink,
            textDecorationLine: done ? 'line-through' : 'none',
          },
          sansOf(td),
        ]}
      >
        {task.title}
      </Text>
    </View>
  );
}

export function TodoRow(p: {
  td: TodoTheme;
  task: Task;
  subs: Task[];
  late: boolean;
  open: boolean;
  selecting: boolean;
  picked: boolean;
  today: string;
  locale: string;
  /** il progetto collegato (nome e colore), se c'è e lo conosciamo */
  project?: { name: string; color: string } | null;
  actions: RowActions;
}) {
  const { td, task, actions } = p;
  const { t } = useTranslation();
  const done = !!task.is_done;
  const words: DayWords = {
    today: t('todo.tn_oggi'),
    tomorrow: t('todo.tn_domani'),
    yesterday: t('todo.tn_ieri'),
  };
  const meta = metaLine(task, p.today, p.locale, words);
  const hasTime = !!task.due_time;

  const commit = (text: string) => {
    const title = text.trim();
    // titolo svuotato: si torna a quello di prima (il server rifiuterebbe un titolo vuoto)
    if (title && title !== task.title) actions.rename(task, title);
  };

  const row = (
    <View
      style={[
        styles.item,
        {
          backgroundColor: p.open ? mix(td.accent, td.card, 0.11) : td.card,
          opacity: done ? 0.62 : 1,
        },
      ]}
      testID={`todo-row-${task.uuid}`}
    >
      <View style={styles.row}>
        {p.selecting ? (
          <Box
            td={td}
            on={p.picked}
            late={false}
            testID={`pick-${task.uuid}`}
            label={task.title}
            onPress={() => actions.pick(task.uuid)}
          />
        ) : (
          <Box
            td={td}
            on={done}
            late={p.late}
            testID={`box-${task.uuid}`}
            label={task.title}
            onPress={() => actions.toggle(task)}
          />
        )}
        <View style={styles.main}>
          {p.selecting ? (
            <Pressable accessibilityRole="button" onPress={() => actions.pick(task.uuid)}>
              <Text
                style={[
                  styles.title,
                  {
                    color: done ? td.ink3 : p.late ? td.late : td.ink,
                    textDecorationLine: done ? 'line-through' : 'none',
                  },
                  sansOf(td),
                ]}
              >
                {task.title}
              </Text>
            </Pressable>
          ) : (
            <TextInput
              // si rimonta quando il titolo cambia da fuori (sincronizzazione) così mostra sempre quello vero
              key={`${task.uuid}-${task.title}`}
              testID={`title-${task.uuid}`}
              defaultValue={task.title}
              multiline
              submitBehavior="blurAndSubmit"
              scrollEnabled={false}
              onFocus={() => actions.open(task.uuid)}
              onEndEditing={(e) => commit(e.nativeEvent.text)}
              style={[
                styles.title,
                {
                  color: done ? td.ink3 : p.late ? td.late : td.ink,
                  textDecorationLine: done ? 'line-through' : 'none',
                },
                sansOf(td),
              ]}
            />
          )}

          {!p.open && !p.selecting && meta ? (
            <Text
              testID={`meta-${task.uuid}`}
              style={[{ fontSize: 12.5, color: p.late ? td.late : td.ink2 }, sansOf(td)]}
            >
              {meta}
            </Text>
          ) : null}

          {!p.open && !p.selecting && p.project ? (
            <View
              testID={`project-${task.uuid}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <View
                style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.project.color }}
              />
              <Text style={[{ fontSize: 12.5, color: td.ink2 }, sansOf(td)]} numberOfLines={1}>
                {p.project.name}
              </Text>
            </View>
          ) : null}

          {p.open && !p.selecting && (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ gap: 6, paddingVertical: 1 }}
              >
                {quickDates(p.today).map((q) => {
                  const on = (task.due_date ?? '') === q.date;
                  return (
                    <Pressable
                      key={q.key}
                      testID={`quick-${q.key}-${task.uuid}`}
                      accessibilityRole="button"
                      onPress={() => actions.setDate(task, q.date)}
                      style={[
                        styles.quick,
                        on
                          ? { backgroundColor: td.accent }
                          : {
                              backgroundColor: td.card,
                              borderColor: td.hair,
                              borderWidth: StyleSheet.hairlineWidth,
                            },
                      ]}
                    >
                      <Text
                        style={[{ fontSize: 12, color: on ? td.onAccent : td.ink2 }, sansOf(td)]}
                      >
                        {t(QUICK_LABEL[q.key])}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View style={styles.tools}>
                <ToolChip
                  td={td}
                  set={!!task.due_date}
                  late={p.late}
                  testID={`chip-date-${task.uuid}`}
                  label={
                    task.due_date
                      ? humanDay(task.due_date, p.today, p.locale, words)
                      : t('comune.data')
                  }
                  onPress={() => actions.editWhen(task)}
                >
                  <TodoIcon
                    name="cal"
                    color={task.due_date ? (p.late ? td.late : td.ink) : td.ink2}
                    size={12}
                  />
                </ToolChip>
                {task.due_date ? (
                  <ToolChip
                    td={td}
                    set={hasTime}
                    late={p.late}
                    testID={`chip-time-${task.uuid}`}
                    label={hasTime ? task.due_time!.slice(0, 5) : t('comune.ora')}
                    onPress={() => actions.editWhen(task)}
                  >
                    <TodoIcon
                      name="clock"
                      color={hasTime ? (p.late ? td.late : td.ink) : td.ink2}
                      size={12}
                    />
                  </ToolChip>
                ) : null}
                <ToolChip
                  td={td}
                  set={!!p.project}
                  testID={`chip-project-${task.uuid}`}
                  label={p.project ? p.project.name : t('todo.progetto')}
                  onPress={() => actions.editProject(task)}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: p.project ? p.project.color : td.ink3,
                    }}
                  />
                </ToolChip>
                {hasTime ? (
                  <View style={[styles.chip, { backgroundColor: td.accentSoft }]}>
                    <TextInput
                      testID={`chip-min-${task.uuid}`}
                      key={`${task.uuid}-min-${task.duration_minutes}`}
                      defaultValue={String(task.duration_minutes || 30)}
                      keyboardType="number-pad"
                      selectTextOnFocus
                      onEndEditing={(e) => {
                        const m = cleanMinutes(e.nativeEvent.text);
                        if (m !== task.duration_minutes) actions.setMinutes(task, m);
                      }}
                      style={[
                        {
                          color: td.ink,
                          fontSize: 12,
                          minWidth: 28,
                          textAlign: 'center',
                          padding: 0,
                        },
                        sansOf(td),
                      ]}
                    />
                    <Text style={[{ color: td.ink, fontSize: 12 }, sansOf(td)]}>min</Text>
                  </View>
                ) : null}
                <View style={{ marginLeft: 'auto' }}>
                  <ToolChip
                    td={td}
                    danger
                    testID={`chip-trash-${task.uuid}`}
                    label=""
                    onPress={() => actions.remove(task)}
                  >
                    <TodoIcon name="trash" color={td.delFg} size={14} />
                  </ToolChip>
                </View>
              </View>
            </>
          )}
        </View>
      </View>
      {p.subs.map((s) => (
        <SubRow key={s.uuid} td={td} task={s} actions={actions} selecting={p.selecting} />
      ))}
    </View>
  );

  return (
    <View style={styles.wrap}>
      <SwipeRow
        th={{ red: '#D98C8C' }}
        color="#D98C8C"
        doneLabel={t('comune.elimina')}
        undoLabel=""
        icon="trash"
        radius={14}
        allowRight={!p.selecting && !p.open}
        allowLeft={false}
        onSwipe={() => actions.remove(task)}
        testID={`swipe-${task.uuid}`}
      >
        {row}
      </SwipeRow>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 2 },
  item: { borderRadius: 14, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    paddingVertical: 9,
    paddingHorizontal: 6,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginTop: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: { flex: 1, minWidth: 0, gap: 5 },
  title: { fontSize: 16, lineHeight: 22, paddingVertical: 2, paddingHorizontal: 0 },
  quick: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  tools: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 999,
  },
});
