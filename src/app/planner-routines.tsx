import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { plannerTheme } from '@/features/planner/plannerTheme';
import type { Routine, RoutineItem } from '@/features/planner/repo';
import { localToday } from '@/features/tasks/groups';

const SWATCHES = ['#E3D9EE', '#E8B86B', '#A9C3AE', '#D9B7C0', '#C6B6A6', '#9DB4D0', '#E39A8A'];

interface Draft {
  uuid?: string;
  name: string;
  color: string;
  items: { name: string; minutes: string }[];
}

const total = (items: RoutineItem[]) => items.reduce((n, i) => n + i.duration_minutes, 0);
const fmt = (min: number) =>
  min >= 60
    ? `${Math.floor(min / 60)} h ${min % 60 ? `${min % 60} min` : ''}`.trim()
    : `${min} min`;

/** Le routine: si creano e si cambiano qui, e si mettono in un giorno scegliendo l'ora d'inizio. */
export default function PlannerRoutines() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const date =
    typeof dateParam === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : localToday();
  const { services, version, changed, uiStyle, plannerSettings } = useApp();
  const pt = plannerTheme(uiStyle, th, plannerSettings.palette, plannerSettings.contrast_level);
  const repo = services?.planner ?? null;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [startAt, setStartAt] = useState<{ uuid: string; time: string } | null>(null);

  const data = useMemo(() => {
    void version;
    return repo
      ? { routines: repo.routines(), items: repo.routineItems() }
      : { routines: [], items: [] };
  }, [repo, version]);
  if (!repo) return null;

  const card = {
    backgroundColor: pt.card,
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: pt.hair,
    padding: 14,
    gap: 10,
  } as const;
  const input = { color: pt.ink, fontFamily: pt.sans, fontSize: 16, paddingVertical: 8 } as const;
  const heading = {
    color: pt.ink,
    fontSize: 22,
    fontFamily: pt.serif,
    fontWeight: pt.style === 'standard' ? '700' : '400',
  } as const;

  function edit(r: Routine) {
    setDraft({
      uuid: r.uuid,
      name: r.name,
      color: r.color,
      items: data.items
        .filter((i) => i.routine_uuid === r.uuid)
        .map((i) => ({ name: i.name, minutes: String(i.duration_minutes) })),
    });
  }

  function save() {
    if (!draft || !repo) return;
    const ok = repo.saveRoutine({
      uuid: draft.uuid,
      name: draft.name,
      color: draft.color,
      items: draft.items.map((i) => ({ name: i.name, minutes: Number(i.minutes) || 5 })),
    });
    if (ok === null) {
      Alert.alert(t('planner.non_salvata'), t('api.serve_nome_routine'));
      return;
    }
    setDraft(null);
    changed();
  }

  function put(uuid: string, time: string) {
    if (!repo) return;
    const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return;
    const n = repo.insertRoutine(uuid, date, `${m[1]!.padStart(2, '0')}:${m[2]}`);
    if (n > 0) {
      changed();
      router.back();
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: pt.page }}>
      <View
        style={{
          paddingTop: Math.max(insets.top - 20, 12),
          paddingHorizontal: 16,
          paddingBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Text style={{ ...heading, flex: 1 }}>{t('planner.routine')}</Text>
        <Pressable testID="routines-done" accessibilityRole="button" onPress={() => router.back()}>
          <Text style={{ color: pt.accentInk, fontSize: 16, fontFamily: pt.sans }}>
            {t('comune.fine')}
          </Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        {draft ? (
          <View style={card}>
            <TextInput
              testID="routine-name"
              value={draft.name}
              onChangeText={(v) => setDraft({ ...draft, name: v })}
              placeholder={t('planner.nome_della_routine')}
              placeholderTextColor={pt.ink3}
              maxLength={80}
              style={{ ...input, fontSize: 18 }}
            />
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              {SWATCHES.map((c) => (
                <Pressable
                  hitSlop={8}
                  key={c}
                  testID={`routine-color-${c}`}
                  accessibilityRole="radio"
                  accessibilityLabel={c}
                  accessibilityState={{ selected: draft.color === c }}
                  onPress={() => setDraft({ ...draft, color: c })}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: c,
                    borderWidth: draft.color === c ? 3 : 0,
                    borderColor: pt.ink,
                  }}
                />
              ))}
            </View>
            <Text style={{ color: pt.ink2, fontSize: 13, fontFamily: pt.sans }}>
              {t('planner.passaggi')}
            </Text>
            {draft.items.map((it, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput
                  testID={`step-name-${i}`}
                  value={it.name}
                  onChangeText={(v) =>
                    setDraft({
                      ...draft,
                      items: draft.items.map((x, j) => (j === i ? { ...x, name: v } : x)),
                    })
                  }
                  placeholder={t('planner.passaggio')}
                  placeholderTextColor={pt.ink3}
                  maxLength={120}
                  style={{ ...input, flex: 1 }}
                />
                <TextInput
                  testID={`step-min-${i}`}
                  value={it.minutes}
                  keyboardType="number-pad"
                  onChangeText={(v) =>
                    setDraft({
                      ...draft,
                      items: draft.items.map((x, j) =>
                        j === i ? { ...x, minutes: v.replace(/\D/g, '') } : x,
                      ),
                    })
                  }
                  style={{ ...input, width: 56, textAlign: 'right' }}
                />
                <Text style={{ color: pt.ink3, fontSize: 12 }}>min</Text>
                <Pressable
                  testID={`step-del-${i}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('planner.elimina')}
                  onPress={() =>
                    setDraft({ ...draft, items: draft.items.filter((_, j) => j !== i) })
                  }
                >
                  <Text style={{ color: '#B4645F', fontSize: 16 }}>✕</Text>
                </Pressable>
              </View>
            ))}
            {draft.items.length < 40 ? (
              <Pressable
                testID="step-add"
                accessibilityRole="button"
                onPress={() =>
                  setDraft({ ...draft, items: [...draft.items, { name: '', minutes: '5' }] })
                }
              >
                <Text style={{ color: pt.accentInk, fontSize: 15, fontFamily: pt.sans }}>
                  ＋ {t('planner.aggiungi_passaggio')}
                </Text>
              </Pressable>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'flex-end' }}>
              <Pressable
                testID="routine-cancel"
                accessibilityRole="button"
                onPress={() => setDraft(null)}
              >
                <Text style={{ color: pt.ink2, fontSize: 16 }}>{t('comune.annulla')}</Text>
              </Pressable>
              <Pressable testID="routine-save" accessibilityRole="button" onPress={save}>
                <Text style={{ color: pt.accentInk, fontSize: 16, fontWeight: '600' }}>
                  {t('planner.salva')}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            {data.routines.length === 0 ? (
              <Text testID="routines-empty" style={{ color: pt.ink3, fontFamily: pt.sans }}>
                {t('planner.nessuna_routine_inserita')}
              </Text>
            ) : null}
            {data.routines.map((r) => {
              const its = data.items.filter((i) => i.routine_uuid === r.uuid);
              return (
                <View key={r.uuid} testID={`routine-card-${r.uuid}`} style={card}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View
                      style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: r.color }}
                    />
                    <Text style={{ flex: 1, color: pt.ink, fontSize: 17, fontFamily: pt.sans }}>
                      {r.name}
                    </Text>
                    <Pressable
                      testID={`routine-edit-${r.uuid}`}
                      accessibilityRole="button"
                      onPress={() => edit(r)}
                    >
                      <Text style={{ color: pt.accentInk, fontSize: 14 }}>
                        {t('planner.modifica')}
                      </Text>
                    </Pressable>
                  </View>
                  <Text style={{ color: pt.ink2, fontSize: 13, fontFamily: pt.sans }}>
                    {t('planner.routine_quanti_passaggi', {
                      durata: fmt(total(its)),
                      n: its.length,
                    })}
                  </Text>
                  {startAt?.uuid === r.uuid ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <TextInput
                        testID="routine-start"
                        value={startAt.time}
                        onChangeText={(v) => setStartAt({ uuid: r.uuid, time: v })}
                        keyboardType="numbers-and-punctuation"
                        maxLength={5}
                        style={{ ...input, width: 70, borderBottomWidth: 1, borderColor: pt.hair }}
                      />
                      <Pressable
                        testID="routine-put"
                        accessibilityRole="button"
                        onPress={() => put(r.uuid, startAt.time)}
                        style={{
                          paddingVertical: 6,
                          paddingHorizontal: 16,
                          borderRadius: 999,
                          backgroundColor: pt.accent,
                        }}
                      >
                        <Text style={{ color: pt.onAccent, fontSize: 14 }}>
                          {t('planner.inserisci')}
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Pressable
                        testID={`routine-insert-${r.uuid}`}
                        accessibilityRole="button"
                        disabled={its.length === 0}
                        onPress={() => setStartAt({ uuid: r.uuid, time: '07:00' })}
                        style={{ opacity: its.length === 0 ? 0.4 : 1 }}
                      >
                        <Text style={{ color: pt.accentInk, fontSize: 15, fontFamily: pt.sans }}>
                          {t('planner.inserisci')} ›
                        </Text>
                      </Pressable>
                      <Pressable
                        testID={`routine-remove-${r.uuid}`}
                        accessibilityRole="button"
                        onPress={() =>
                          Alert.alert(t('planner.elimino_tutta_la_routine'), undefined, [
                            { text: t('comune.annulla'), style: 'cancel' },
                            {
                              text: t('planner.elimina'),
                              style: 'destructive',
                              onPress: () => {
                                repo.removeRoutine(r.uuid);
                                changed();
                              },
                            },
                          ])
                        }
                      >
                        <Text style={{ color: '#B4645F', fontSize: 14 }}>
                          {t('planner.elimina')}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
            <Pressable
              testID="routine-new"
              accessibilityRole="button"
              onPress={() =>
                setDraft({ name: '', color: SWATCHES[0]!, items: [{ name: '', minutes: '5' }] })
              }
              style={{ ...card, alignItems: 'center' }}
            >
              <Text style={{ color: pt.accentInk, fontSize: 16, fontFamily: pt.sans }}>
                ＋ {t('planner.nuova_routine')}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}
