import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import {
  CardButton,
  CardTitle,
  DayCountModal,
  DoseRow,
  PILL_RED_TEXT,
  PillCalendar,
  PillModal,
  PlanEditor,
  PlanRow,
  TakeAllButton,
  TakeAllModal,
  TakenAtModal,
} from '@/features/pills/PillParts';
import type { PillPlan } from '@/features/pills/logic';
import {
  draftOf,
  emptyDraft,
  monthRange,
  planOf,
  rhythmText,
  type PlanDraft,
  type RhythmWords,
} from '@/features/pills/pillsLogic';
import type { DoseView } from '@/features/pills/repo';
import { localToday } from '@/features/tasks/groups';
import { TodoIcon, sansOf } from '@/features/tasks/TodoParts';
import { todoTheme } from '@/features/tasks/todoTheme';
import { cardShadow } from '@/ui/kit';
import { SyncBadge } from '@/ui/SyncBadge';

const pad = (n: number) => String(n).padStart(2, '0');

/** Una terapia che si sta cambiando (`uuid` null = nuova) con i campi del modulo. */
interface Editing {
  uuid: string | null;
  draft: PlanDraft;
  error: string | null;
}

export default function PillsScreen() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { services, version, changed, uiStyle } = useApp();
  const td = todoTheme(uiStyle, th);
  const paper = td.style === 'paper';
  const today = localToday();
  const nowDate = new Date();
  const nowHm = `${pad(nowDate.getHours())}:${pad(nowDate.getMinutes())}`;

  const [editing, setEditing] = useState<Editing | null>(null);
  /** la terapia di cui si guarda solo il calendario (si tocca il nome di una presa) */
  const [chart, setChart] = useState<string | null>(null);
  const [taking, setTaking] = useState<{ dose: DoseView; withDay: boolean } | null>(null);
  const [takeAll, setTakeAll] = useState<DoseView[]>([]);
  const [dayPick, setDayPick] = useState<{
    plan: PillPlan;
    iso: string;
    taken: number;
    tot: number;
  } | null>(null);

  // `version` cambia a ogni modifica (locale o dal server): è ciò che fa rileggere. Leggere il giorno scrive
  // anche le prese che mancano, ma senza metterle in coda: nascono da una regola, non da una scelta.
  const data = useMemo(
    () => (services ? { day: services.pills.day(today), plans: services.pills.plans() } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, version, today],
  );

  const words: RhythmWords = {
    everyDay: t('todo.ogni_giorno'),
    never: t('todo.mai'),
    paused: t('todo.sospesa').toLowerCase(),
    monthly: (giorni) => t('todo.il_n_di_ogni_mese', { giorni }),
    everyN: (n) => t('todo.ogni_n_giorni_val', { n }),
    until: (ddmm) => `${t('todo.fino_a').split(' (')[0]!.toLowerCase()} ${ddmm}`,
    weekdays: [
      t('todo.gg_lun'),
      t('todo.gg_mar'),
      t('todo.gg_mer'),
      t('todo.gg_gio'),
      t('todo.gg_ven'),
      t('todo.gg_sab'),
      t('todo.gg_dom'),
    ],
  };

  /** «lunedì 3 agosto», per dire di che giorno è una presa arretrata. */
  function longDay(iso: string): string {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    if (iso === `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`)
      return t('todo.ieri_min');
    return new Intl.DateTimeFormat(i18n.language, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date(`${iso}T12:00:00`));
  }

  /* ---------------- prese ---------------- */

  function toggle(d: DoseView) {
    if (!services) return;
    services.pills.setStatus(d.uuid, d.status === 'taken' ? 'pending' : 'taken');
    changed();
  }
  function skip(d: DoseView) {
    if (!services) return;
    services.pills.setStatus(d.uuid, 'skipped');
    changed();
  }
  function takeLate(d: DoseView) {
    // una presa di ieri spuntata ora: l'ora dell'orologio sarebbe sbagliata, si chiede quando
    if (d.status === 'taken') toggle(d);
    else setTaking({ dose: d, withDay: true });
  }
  function applyTaking(stamp: string) {
    if (!services || !taking) return;
    services.pills.setStatus(taking.dose.uuid, 'taken', stamp);
    setTaking(null);
    changed();
  }
  function doTakeAll(list: DoseView[], mode: 'on_time' | 'now') {
    if (!services) return;
    services.pills.markAll(
      list.map((d) => d.uuid),
      mode,
    );
    setTakeAll([]);
    changed();
  }
  const open = (list: DoseView[]) => list.filter((d) => d.status !== 'taken');

  /* ---------------- terapie ---------------- */

  function openEditor(plan: PillPlan | null) {
    setEditing({
      uuid: plan?.uuid ?? null,
      draft: plan ? draftOf(plan) : emptyDraft(today),
      error: null,
    });
  }
  function save() {
    if (!services || !editing) return;
    try {
      if (editing.uuid) services.pills.updatePlan(editing.uuid, planOf(editing.draft));
      else services.pills.createPlan(planOf(editing.draft));
    } catch (e) {
      const m = /^invalid:(.+)$/.exec(e instanceof Error ? e.message : '');
      if (!m) throw e;
      setEditing({ ...editing, error: m[1]! });
      return;
    }
    setEditing(null);
    changed();
  }
  function confirmDelete() {
    if (!services || !editing?.uuid) return;
    const uuid = editing.uuid;
    const name = editing.draft.name.trim();
    Alert.alert(t('planner.elimino_nome', { nome: name }), t('todo.non_recuperabile'), [
      { text: t('comune.annulla'), style: 'cancel' },
      {
        text: t('comune.elimina'),
        style: 'destructive',
        onPress: () => {
          services.pills.removePlan(uuid);
          setEditing(null);
          changed();
        },
      },
    ]);
  }

  function calendarOf(plan: PillPlan) {
    return (
      <PillCalendar
        td={td}
        plan={plan}
        today={today}
        locale={i18n.language}
        history={(month) => {
          const r = monthRange(month);
          return services ? services.pills.history(plan.uuid, r.from, r.to) : [];
        }}
        onPickDay={(iso, taken, tot) => setDayPick({ plan, iso, taken, tot })}
      />
    );
  }

  function applyDay(n: number) {
    if (!services || !dayPick) return;
    try {
      services.pills.setDayCount(dayPick.plan.uuid, dayPick.iso, n);
    } catch {
      // un giorno che non è ancora arrivato non si segna: il calendario non lo permette, qui basta non rompersi
    }
    setDayPick(null);
    changed();
  }

  const label = (text: string, extra?: object) => (
    <Text
      style={[
        {
          color: td.ink3,
          fontSize: 10,
          letterSpacing: 2,
          textTransform: 'uppercase',
        },
        sansOf(td),
        extra,
      ]}
    >
      {text}
    </Text>
  );

  const late = data?.day.late ?? [];
  const doses = data?.day.doses ?? [];
  const plans = data?.plans ?? [];
  const st = data?.day.stats;
  const openToday = open(doses);
  const openLate = open(late);
  const editingPlan = editing?.uuid ? (plans.find((p) => p.uuid === editing.uuid) ?? null) : null;
  const chartPlan = chart ? (plans.find((p) => p.uuid === chart) ?? null) : null;

  return (
    <View style={{ flex: 1, backgroundColor: td.page }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          paddingBottom: 120,
        }}
      >
        <View style={styles.top}>
          <SyncBadge />
        </View>
        <View
          style={[
            styles.sheet,
            { backgroundColor: td.card, borderRadius: 26 },
            cardShadow(td.dark),
          ]}
        >
          <View style={styles.head}>
            <Text
              style={{
                color: td.ink,
                fontSize: paper ? 32 : 30,
                letterSpacing: paper ? 0 : -0.6,
                fontWeight: paper ? '400' : '700',
                fontStyle: paper ? 'italic' : 'normal',
                fontFamily: paper ? td.serif : undefined,
              }}
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

          <View style={{ marginBottom: 8 }}>{label(t('todo.tipo_pills'))}</View>

          {!services || !data ? (
            <Text style={[styles.empty, { color: td.ink2 }]}>{t('comune.carica')}</Text>
          ) : (
            <>
              {/* le rimaste indietro: in cima e in rosso, perché sono l'unica cosa su cui si può ancora fare qualcosa */}
              {late.length > 0 && (
                <View testID="pills-late">
                  <View style={styles.sectRow}>
                    {label(
                      late.length === 1 ? t('todo.rimasta_indietro') : t('todo.rimaste_indietro'),
                      {
                        color: PILL_RED_TEXT,
                      },
                    )}
                    {openLate.length > 1 && (
                      <TakeAllButton
                        td={td}
                        testID="takeall-late"
                        onPress={() => setTakeAll(openLate)}
                      />
                    )}
                  </View>
                  {late.map((d) => (
                    <DoseRow
                      key={d.uuid}
                      td={td}
                      dose={d}
                      today={today}
                      late
                      dayLabel={longDay(d.due_date)}
                      onToggle={takeLate}
                      onSkip={skip}
                      onTime={(x) => setTaking({ dose: x, withDay: true })}
                      onPlan={(x) => setChart(x.plan_uuid)}
                      onForgot={skip}
                    />
                  ))}
                </View>
              )}

              {doses.length === 0 && (
                <Text
                  testID="pills-empty"
                  style={[
                    styles.empty,
                    { color: td.ink2, fontFamily: paper ? td.serif : undefined },
                  ]}
                >
                  {plans.length ? t('todo.niente_da_prendere') : t('todo.aggiungi_prima_terapia')}
                </Text>
              )}

              {openToday.length > 1 && (
                <View style={styles.takeRow}>
                  <TakeAllButton
                    td={td}
                    testID="takeall-today"
                    onPress={() => doTakeAll(openToday, 'now')}
                  />
                </View>
              )}

              {doses.map((d, i) => {
                // l'ora fa da titolo al gruppo: una sola intestazione per ogni orario
                const header = i === 0 || doses[i - 1]!.due_time !== d.due_time;
                return (
                  <View key={d.uuid}>
                    {header && (
                      <View style={styles.hour}>
                        <Text
                          style={[{ color: td.ink3, fontSize: 12, letterSpacing: 1.2 }, sansOf(td)]}
                        >
                          {d.due_time}
                        </Text>
                        {/* in ritardo: l'ora è passata e la spunta non è arrivata */}
                        {d.status === 'pending' && d.due_time < nowHm && (
                          <Text style={[{ color: '#B08A8A', fontSize: 11 }, sansOf(td)]}>
                            {t('todo.in_ritardo')}
                          </Text>
                        )}
                      </View>
                    )}
                    <DoseRow
                      td={td}
                      dose={d}
                      today={today}
                      onToggle={toggle}
                      onSkip={skip}
                      onTime={(x) => setTaking({ dose: x, withDay: false })}
                      onPlan={(x) => setChart(x.plan_uuid)}
                    />
                  </View>
                );
              })}

              {st && st.taken + st.skipped + st.missed > 0 && (
                <Text
                  testID="pills-stats"
                  style={[{ color: td.ink3, fontSize: 11.5, marginTop: 14 }, sansOf(td)]}
                >
                  {t('todo.ultimi_30_giorni', {
                    prese: st.taken,
                    saltate: st.skipped,
                    dimenticate: st.missed,
                  })}
                </Text>
              )}

              <View style={{ marginTop: 22, marginBottom: 8 }}>
                {label(t('todo.le_mie_terapie'))}
              </View>
              {plans.map((p) => (
                <PlanRow
                  key={p.uuid}
                  td={td}
                  plan={p}
                  rhythm={rhythmText(p, words)}
                  onPress={() => openEditor(p)}
                />
              ))}
              <Pressable
                testID="plan-new"
                accessibilityRole="button"
                onPress={() => openEditor(null)}
                style={styles.add}
              >
                <TodoIcon name="plus" color={td.ink2} size={18} />
                <Text style={[{ color: td.ink2, fontSize: 15 }, sansOf(td)]}>
                  {t('todo.nuova_terapia')}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      <PillModal
        td={td}
        visible={!!editing}
        onClose={() => setEditing(null)}
        wide
        testID="plan-modal"
      >
        {editing && (
          <PlanEditor
            td={td}
            draft={editing.draft}
            isNew={!editing.uuid}
            errorField={editing.error}
            today={today}
            onChange={(draft) => setEditing({ ...editing, draft, error: null })}
            onCancel={() => setEditing(null)}
            onSave={save}
            onDelete={confirmDelete}
            calendar={editingPlan ? calendarOf(editingPlan) : null}
          />
        )}
      </PillModal>

      <PillModal
        td={td}
        visible={!!chartPlan}
        onClose={() => setChart(null)}
        wide
        testID="chart-modal"
      >
        {chartPlan && (
          <>
            <CardTitle td={td}>{chartPlan.name || t('todo.terapia')}</CardTitle>
            {chartPlan.dose ? (
              <Text style={[{ color: td.ink3, fontSize: 11.5 }, sansOf(td)]}>{chartPlan.dose}</Text>
            ) : null}
            {calendarOf(chartPlan)}
            <View style={styles.acts}>
              <CardButton
                td={td}
                testID="chart-close"
                primary
                label={t('comune.chiudi')}
                onPress={() => setChart(null)}
              />
            </View>
          </>
        )}
      </PillModal>

      <TakenAtModal
        td={td}
        dose={taking?.dose ?? null}
        withDay={!!taking?.withDay}
        onCancel={() => setTaking(null)}
        onApply={applyTaking}
      />
      <TakeAllModal
        td={td}
        count={takeAll.length}
        onCancel={() => setTakeAll([])}
        onPick={(mode) => doTakeAll(takeAll, mode)}
      />
      <DayCountModal
        td={td}
        plan={dayPick?.plan ?? null}
        iso={dayPick?.iso ?? today}
        taken={dayPick?.taken ?? 0}
        tot={dayPick?.tot ?? 1}
        locale={i18n.language}
        onCancel={() => setDayPick(null)}
        onApply={applyDay}
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
  empty: {
    textAlign: 'center',
    paddingTop: 26,
    paddingBottom: 10,
    fontSize: 15,
    fontStyle: 'italic',
  },
  sectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 8,
  },
  takeRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  hour: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 14, marginBottom: 6 },
  add: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingLeft: 4 },
  acts: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
});
