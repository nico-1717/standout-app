import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { DateTimeField } from '@/ui/DateTimeField';
import { Card } from '@/ui/kit';

import { GOAL_KINDS, PRIORITIES, type Goal, type GoalKind, type Priority } from './engine';
import { hours } from './format';
import type { GoalInput } from './repo';

interface Draft {
  kind: GoalKind;
  priority: Priority;
  minutes: number;
  items: number;
  unit: number;
  deadline: string | null;
  start: string | null;
  cascade: boolean;
}

const fromGoal = (g: Goal | null, hasKids: boolean): Draft => ({
  kind: g?.kind ?? 'plain',
  priority: g?.priority ?? 'should',
  minutes: g?.minutes ?? 0,
  items: g?.items ?? 10,
  unit: g?.unitMinutes ?? 30,
  deadline: g?.deadline ?? null,
  start: g?.start ?? null,
  cascade: hasKids,
});

/** Il numero di ore (o giorni) come lo scrive il sito: «1.5», senza zeri inutili. */
const num = (v: number) => String(Math.round(v * 10) / 10);

/** Il salvataggio automatico: ogni cambio riparte da mezzo secondo, e uscendo il cambio in sospeso si salva subito. */
class Saver {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: GoalInput | null = null;
  private save: (input: GoalInput) => void = () => {};
  target(save: (input: GoalInput) => void) {
    this.save = save;
  }
  schedule(input: GoalInput) {
    this.pending = input;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 500);
  }
  flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const input = this.pending;
    this.pending = null;
    if (input) this.save(input);
  }
}

/**
 * La scheda «Tempo del progetto» come sul sito (`goalCard` di piano.js): il numero grande con ore/giorni, la barra di quanto è fatto,
 * il tipo e la priorità in pastiglie, le due date. Niente foglio e niente «Salva»: ogni cambio si salva da solo dopo mezzo secondo.
 */
export function PlanGoalCard(p: {
  goal: Goal | null;
  hasKids: boolean;
  inheritedDeadline: string | null;
  today: string;
  /** quanto dura un giorno di studio abituale (per contare in giorni) */
  dayLen: number;
  doneMin: number;
  color: string;
  onSave: (input: GoalInput) => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Draft>(() => fromGoal(p.goal, p.hasKids));
  const [unit, setUnit] = useState<'hours' | 'days'>('hours');
  const [text, setText] = useState<string | null>(null);
  // il salvataggio in sospeso vive in un oggetto fisso, che si usa solo dai gestori
  const [saver] = useState(() => new Saver());
  useEffect(() => {
    saver.target(p.onSave);
  });
  // chi esce con un cambio in sospeso lo salva, invece di perderlo
  useEffect(() => () => saver.flush(), [saver]);

  const daily = draft.kind === 'daily';
  const count = draft.kind === 'count';
  const total = count ? draft.items * draft.unit : draft.minutes;

  const commit = (next: Draft) => {
    setDraft(next);
    saver.schedule({
      kind: next.kind,
      priority: next.priority,
      minutes: next.kind === 'count' ? next.items * next.unit : next.minutes,
      items: next.kind === 'count' ? next.items : null,
      unitMinutes: next.kind === 'count' ? next.unit : null,
      deadline: next.deadline,
      start: next.start,
      cascade: p.hasKids && next.cascade,
    });
  };
  const set = (patch: Partial<Draft>) => commit({ ...draft, ...patch });

  const shown =
    text ??
    (draft.minutes
      ? daily
        ? String(draft.minutes)
        : unit === 'hours'
          ? num(draft.minutes / 60)
          : num(draft.minutes / p.dayLen)
      : '');

  const lab = (s: string) => (
    <Text
      style={{
        color: th.text2,
        fontSize: 12.5,
        fontWeight: '600',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        marginTop: 14,
        marginBottom: 6,
      }}
    >
      {s}
    </Text>
  );
  const sub = (s: string) => (
    <Text style={{ color: th.text2, fontSize: 12.5, lineHeight: 17, marginTop: 5 }}>{s}</Text>
  );
  const pill = (label: string, on: boolean, onPress: () => void, testID: string) => (
    <Pressable
      key={testID}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{
        minHeight: 32,
        paddingHorizontal: 12,
        borderRadius: 999,
        justifyContent: 'center',
        backgroundColor: on ? th.text : th.surface2,
      }}
    >
      <Text style={{ color: on ? th.bg : th.text, fontSize: 13, fontWeight: on ? '600' : '400' }}>
        {label}
      </Text>
    </Pressable>
  );
  const small = (v: number, onChange: (n: number) => void, testID: string) => (
    <TextInput
      testID={testID}
      value={v ? String(v) : ''}
      onChangeText={(s) => onChange(Number(s.replace(/[^0-9]/g, '')) || 0)}
      keyboardType="number-pad"
      placeholder="0"
      placeholderTextColor={th.text3}
      style={{
        width: 76,
        minHeight: 38,
        textAlign: 'right',
        color: th.text,
        backgroundColor: th.surface2,
        borderRadius: 10,
        paddingHorizontal: 10,
        fontSize: 16,
      }}
    />
  );
  const field = (label: string, child: ReactNode, hint?: string) => (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={{ color: th.text2, fontSize: 12.5 }}>{label}</Text>
      {hint ? <Text style={{ color: th.text3, fontSize: 11.5 }}>{hint}</Text> : null}
      <View
        style={{
          backgroundColor: th.surface2,
          borderRadius: 10,
          minHeight: 38,
          paddingHorizontal: 8,
          justifyContent: 'center',
        }}
      >
        {child}
      </View>
    </View>
  );

  return (
    <Card style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
      <Text
        style={{
          color: th.text2,
          fontSize: 12.5,
          fontWeight: '600',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {t('piano.tempo_progetto')}
      </Text>
      <View
        style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}
      >
        {count ? (
          <Text
            testID="plan-goal-total"
            style={{ color: th.text, fontSize: 38, fontWeight: '700' }}
          >
            {hours(total)}
          </Text>
        ) : (
          <TextInput
            testID="plan-goal-input"
            value={shown}
            onChangeText={(s) => {
              setText(s);
              const v = Number(s.replace(',', '.')) || 0;
              set({
                minutes: daily
                  ? Math.max(0, Math.round(v))
                  : Math.round(((unit === 'hours' ? v * 60 : v * p.dayLen) as number) / 5) * 5,
              });
            }}
            onBlur={() => setText(null)}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={th.text3}
            style={{
              flex: 1,
              maxWidth: 200,
              color: th.text,
              fontSize: 38,
              lineHeight: 44,
              fontWeight: '700',
              letterSpacing: -0.8,
              padding: 0,
            }}
          />
        )}
        <View
          style={{
            flexDirection: 'row',
            padding: 2,
            borderRadius: 9,
            backgroundColor: th.surface2,
          }}
        >
          {daily ? (
            <View
              style={{
                minHeight: 28,
                paddingHorizontal: 11,
                borderRadius: 7,
                justifyContent: 'center',
                backgroundColor: th.surface,
              }}
            >
              <Text style={{ color: th.text, fontSize: 12.5, fontWeight: '600' }}>
                {t('piano.min_al_giorno')}
              </Text>
            </View>
          ) : count ? null : (
            (['hours', 'days'] as const).map((u) => (
              <Pressable
                key={u}
                testID={`plan-unit-${u}`}
                accessibilityRole="button"
                accessibilityState={{ selected: unit === u }}
                onPress={() => {
                  setText(null);
                  setUnit(u);
                }}
                style={{
                  minHeight: 28,
                  paddingHorizontal: 11,
                  borderRadius: 7,
                  justifyContent: 'center',
                  backgroundColor: unit === u ? th.surface : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: unit === u ? th.text : th.text2,
                    fontSize: 12.5,
                    fontWeight: unit === u ? '600' : '400',
                  }}
                >
                  {t(u === 'hours' ? 'piano.ore' : 'piano.giorni')}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      </View>
      {unit === 'days' && !daily && !count
        ? sub(t('piano.giorno_vale', { h: hours(p.dayLen) }))
        : null}

      {total > 0 && !daily ? (
        <>
          <View
            style={{
              height: 6,
              borderRadius: 999,
              backgroundColor: th.surface2,
              overflow: 'hidden',
              marginTop: 10,
              marginBottom: 5,
            }}
          >
            <View
              testID="plan-goal-progress"
              style={{
                width: `${Math.min(100, Math.round((p.doneMin * 100) / total))}%`,
                height: '100%',
                borderRadius: 999,
                backgroundColor: p.color,
              }}
            />
          </View>
          {sub(t('piano.fatto_di', { a: hours(p.doneMin), b: hours(total) }))}
        </>
      ) : null}

      {lab(t('piano.tipo'))}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {GOAL_KINDS.map((k) =>
          pill(
            t(`piano.tipo_${k}`),
            draft.kind === k,
            () => {
              setText(null);
              // passando a «ogni giorno» i minuti cambiano significato: si riparte da un valore sensato
              set({
                kind: k,
                minutes:
                  k === 'daily' && draft.kind !== 'daily'
                    ? 15
                    : k !== 'daily' && draft.kind === 'daily'
                      ? 0
                      : draft.minutes,
              });
            },
            `plan-kind-${k}`,
          ),
        )}
      </View>
      {sub(t(`piano.tipo_${draft.kind}_h`))}
      {count ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            marginTop: 8,
          }}
        >
          {small(draft.items, (items) => set({ items }), 'plan-goal-items')}
          <Text style={{ color: th.text2, fontSize: 12.5 }}>{t('piano.voci_per')}</Text>
          {small(draft.unit, (unit2) => set({ unit: unit2 }), 'plan-goal-unit')}
          <Text style={{ color: th.text2, fontSize: 12.5 }}>{t('piano.min_ciascuna')}</Text>
        </View>
      ) : null}

      {lab(t('piano.priorita'))}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {PRIORITIES.map((k) =>
          pill(
            t(`piano.prio_${k}`),
            draft.priority === k,
            () => set({ priority: k }),
            `plan-prio-${k}`,
          ),
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        {field(
          draft.kind === 'exam' ? t('piano.data_esame') : t('piano.scadenza'),
          <DateTimeField
            kind="date"
            testID="plan-deadline"
            value={draft.deadline ?? ''}
            fallback={p.today}
            placeholder={p.inheritedDeadline ? t('piano.eredita', { d: p.inheritedDeadline }) : '—'}
            clearable
            onChange={(v) => set({ deadline: v || null })}
          />,
        )}
        {field(
          t('piano.inizio'),
          <DateTimeField
            kind="date"
            testID="plan-start"
            value={draft.start ?? ''}
            fallback={p.today}
            placeholder="—"
            clearable
            onChange={(v) => set({ start: v || null })}
          />,
        )}
      </View>
      {p.hasKids ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <Switch
            testID="plan-cascade"
            value={draft.cascade}
            onValueChange={(cascade) => set({ cascade })}
            trackColor={{ true: th.brand }}
          />
          <Text style={{ color: th.text, flex: 1, fontSize: 14 }}>{t('piano.anche_figli')}</Text>
        </View>
      ) : null}
    </Card>
  );
}
