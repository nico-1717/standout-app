import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { localNow, localToday, visibleTasks } from '@/features/tasks/groups';
import type { Task, TasksRepo } from '@/features/tasks/repo';

const SAGE = '#A9C3AE';

/**
 * Il post-it del Pomodoro (pomodoro.php): un tastino tondo in basso a destra che apre un foglietto inclinato con il timer
 * in piccolo e le attività da fare durante il timer. Con un progetto si vedono le sue attività; senza, solo quelle scritte
 * qui in questa sessione (il sito parte «davvero vuoto»). Le nuove attività prendono il progetto, il giorno di oggi e l'ora
 * di adesso. A pomodoro finito il foglietto si apre da solo e chiede cosa farne.
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
  /** il timer in piccolo in cima al foglietto */
  time: string;
  fraction: number;
  /** il colore del tastino quando il foglietto è aperto (l'accento del pomodoro) */
  accent: string;
  /** distanza dal fondo (barra di navigazione) */
  bottom: number;
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
  const dark = th.scheme === 'dark';
  const paper = dark ? '#2A2925' : '#FBF9F4';
  const ink = dark ? '#EAE6DE' : '#262523';
  const soft = dark ? '#9A958C' : '#8A8177';
  const shown = open || asking;
  const pct = Math.max(0, Math.min(1, p.fraction));

  return (
    <>
      <Pressable
        testID="pomo-note-toggle"
        accessibilityRole="button"
        accessibilityLabel={t('pomodoro.attivita')}
        accessibilityState={{ expanded: shown }}
        onPress={() => setOpen(!open)}
        style={({ pressed }) => ({
          position: 'absolute',
          right: 16,
          bottom: p.bottom,
          zIndex: 6,
          width: 46,
          height: 46,
          borderRadius: 23,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: shown ? p.accent : th.surface2,
          boxShadow: '0 8px 22px -10px rgba(0,0,0,.5)',
          transform: [{ scale: pressed ? 0.9 : 1 }],
        })}
      >
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 7l2.2 2.2L10 5.5M4 17l2.2 2.2L10 15.5M13 7.5h7M13 17.5h7"
            stroke={shown ? '#fff' : th.text2}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Pressable>

      <Modal visible={shown} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('comune.chiudi')}
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
          />
          <View
            testID="pomo-postit"
            style={{
              width: '100%',
              maxWidth: 340,
              maxHeight: '76%',
              backgroundColor: paper,
              borderTopLeftRadius: 4,
              borderTopRightRadius: 4,
              borderBottomLeftRadius: 14,
              borderBottomRightRadius: 14,
              paddingTop: 22,
              paddingHorizontal: 16,
              paddingBottom: 16,
              transform: [{ rotate: '-0.8deg' }],
              boxShadow: dark
                ? '0 24px 54px -20px rgba(0,0,0,.75), inset 0 0 0 0.5px rgba(255,255,255,.06)'
                : '0 24px 54px -20px rgba(0,0,0,.45), inset 0 0 0 0.5px rgba(0,0,0,.06)',
            }}
          >
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -11,
                alignSelf: 'center',
                width: 78,
                height: 21,
                borderRadius: 1,
                backgroundColor: dark ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.7)',
                transform: [{ rotate: '-2.4deg' }],
                boxShadow: '0 2px 6px rgba(0,0,0,.16)',
              }}
            />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <View
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <Svg width={44} height={44} viewBox="0 0 36 36" style={{ position: 'absolute' }}>
                  <G rotation={-90} origin="18, 18">
                    <Circle
                      cx={18}
                      cy={18}
                      r={15}
                      fill="none"
                      stroke={dark ? 'rgba(255,255,255,.12)' : 'rgba(74,68,61,.14)'}
                      strokeWidth={2.6}
                    />
                    <Circle
                      cx={18}
                      cy={18}
                      r={15}
                      fill="none"
                      stroke={SAGE}
                      strokeWidth={2.6}
                      strokeLinecap="round"
                      strokeDasharray="94.2 94.2"
                      strokeDashoffset={94.2 * (1 - pct)}
                    />
                  </G>
                </Svg>
                <Text style={{ color: soft, fontSize: 10, fontVariant: ['tabular-nums'] }}>
                  {p.time}
                </Text>
              </View>
              <Pressable
                testID="pomo-note-close"
                accessibilityRole="button"
                onPress={() => setOpen(false)}
                hitSlop={10}
              >
                <Text style={{ color: soft, fontSize: 13 }}>{t('comune.chiudi')}</Text>
              </Pressable>
            </View>

            {asking ? (
              <View style={{ gap: 7 }} testID="pomo-note-ask">
                <Text style={{ color: ink, fontWeight: '600', fontSize: 19, marginBottom: 2 }}>
                  {t('pomodoro.attivita_di_questo')}
                </Text>
                <Text style={{ color: soft, fontSize: 13, lineHeight: 19, marginBottom: 9 }}>
                  {t('pomodoro.n_su_n_spuntate', { fatte: ticked, totale: items.length })}
                </Text>
                <Pressable
                  testID="pomo-note-del-done"
                  accessibilityRole="button"
                  onPress={() => close('done')}
                  style={[styles.act, { backgroundColor: SAGE }]}
                >
                  <Text style={{ color: '#FFFDFA', fontSize: 14 }}>
                    {t('pomodoro.elimina_spuntate')}
                  </Text>
                </Pressable>
                <Pressable
                  testID="pomo-note-del-all"
                  accessibilityRole="button"
                  onPress={() => close('all')}
                  style={[
                    styles.act,
                    { backgroundColor: dark ? 'rgba(255,255,255,.10)' : '#F5F1EA' },
                  ]}
                >
                  <Text style={{ color: th.red, fontSize: 14 }}>{t('pomodoro.elimina_tutte')}</Text>
                </Pressable>
                <Pressable
                  testID="pomo-note-keep"
                  accessibilityRole="button"
                  onPress={() => close('keep')}
                  style={[
                    styles.act,
                    { backgroundColor: dark ? 'rgba(255,255,255,.10)' : '#F5F1EA' },
                  ]}
                >
                  <Text style={{ color: dark ? '#EAE6DE' : '#4A443D', fontSize: 14 }}>
                    {t('pomodoro.tienile_tutte')}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#FFFFFF',
                    borderRadius: 999,
                    paddingLeft: 16,
                    paddingRight: 5,
                    height: 46,
                    boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,.08), 0 6px 16px -10px rgba(0,0,0,.4)',
                  }}
                >
                  <TextInput
                    testID="pomo-note-new"
                    value={title}
                    onChangeText={setTitle}
                    onSubmitEditing={add}
                    returnKeyType="done"
                    placeholder={t('todo.tn_ph_todo')}
                    placeholderTextColor="#9A958C"
                    style={{ flex: 1, color: '#262523', fontSize: 15, paddingVertical: 0 }}
                  />
                  <Pressable
                    testID="pomo-note-add"
                    accessibilityRole="button"
                    accessibilityLabel={t('todo.tn_aggiungi')}
                    onPress={add}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: SAGE,
                    }}
                  >
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M12 5v14M5 12h14"
                        stroke="#fff"
                        strokeWidth={2.4}
                        strokeLinecap="round"
                      />
                    </Svg>
                  </Pressable>
                </View>
                {items.length === 0 ? (
                  <Text
                    style={{
                      color: soft,
                      fontSize: 14,
                      lineHeight: 21,
                      textAlign: 'center',
                      paddingHorizontal: 6,
                      paddingVertical: 14,
                    }}
                  >
                    {t('todo.tn_vuoto_todo')}
                  </Text>
                ) : (
                  <View style={{ gap: 4 }}>
                    {items.map((task) => {
                      const done = !!task.is_done;
                      return (
                        <Pressable
                          key={task.uuid}
                          testID={`pomo-note-${task.uuid}`}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: done }}
                          onPress={() => toggle(task)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 11,
                            minHeight: 40,
                            paddingHorizontal: 4,
                          }}
                        >
                          <View
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 11,
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderWidth: done ? 0 : 1.6,
                              borderColor: soft,
                              backgroundColor: done ? SAGE : 'transparent',
                            }}
                          >
                            {done ? (
                              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                                <Path
                                  d="M5 12.5l4.5 4.5L19 7.5"
                                  stroke="#fff"
                                  strokeWidth={3.2}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </Svg>
                            ) : null}
                          </View>
                          <Text
                            style={{
                              flex: 1,
                              fontSize: 15,
                              color: done ? soft : ink,
                              textDecorationLine: done ? 'line-through' : 'none',
                            }}
                          >
                            {task.title}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,.46)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  act: { padding: 11, borderRadius: 13, alignItems: 'center' },
});
