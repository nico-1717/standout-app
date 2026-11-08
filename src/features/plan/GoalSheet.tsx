import { useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DateTimeField } from '@/ui/DateTimeField';
import { PrimaryButton, TextButton } from '@/ui/kit';
import { Sheet } from '@/features/habits/Sheet';

import { GOAL_KINDS, PRIORITIES, type Goal, type GoalKind, type Priority } from './engine';
import { hours } from './format';
import type { GoalInput } from './repo';
import { Choices, HoursInput, NumberField, Row, Stepper, usePlanTheme } from './ui';

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

function fromGoal(g: Goal | null, hasKids: boolean): Draft {
  return {
    kind: g?.kind ?? 'plain',
    priority: g?.priority ?? 'should',
    minutes: g?.minutes ?? 0,
    items: g?.items ?? 10,
    unit: g?.unitMinutes ?? 30,
    deadline: g?.deadline ?? null,
    start: g?.start ?? null,
    cascade: hasKids,
  };
}

/**
 * «Tempo e tipo» di un progetto (goal_save del sito): che cos'è (semplice, esame, costante, corso, a elementi, ogni giorno),
 * quanto tempo, la priorità e le date. Il tempo di un progetto «a elementi» viene da quante voci sono per i minuti di una voce.
 */
export function GoalSheet(p: {
  visible: boolean;
  name: string;
  goal: Goal | null;
  inheritedDeadline: string | null;
  hasKids: boolean;
  today: string;
  /** quanto dura un giorno di studio abituale (per contare in giorni) */
  dayLen: number;
  /** minuti già fatti dal ramo e colore del progetto (per la barra) */
  doneMin: number;
  color: string;
  onSave: (input: GoalInput) => void;
  onClose: () => void;
}) {
  const ht = usePlanTheme();
  const { t } = useTranslation();
  const [unit, setUnit] = useState<'hours' | 'days'>('hours');
  const [draft, setDraft] = useState<Draft>(() => fromGoal(p.goal, p.hasKids));
  // si riparte dai valori salvati ogni volta che il foglio si apre
  const [wasOpen, setWasOpen] = useState(p.visible);
  if (p.visible !== wasOpen) {
    setWasOpen(p.visible);
    if (p.visible) {
      setDraft(fromGoal(p.goal, p.hasKids));
      setUnit('hours');
    }
  }
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const daily = draft.kind === 'daily';
  const count = draft.kind === 'count';
  const total = count ? draft.items * draft.unit : draft.minutes;

  const save = () => {
    p.onSave({
      kind: draft.kind,
      priority: draft.priority,
      minutes: total,
      items: count ? draft.items : null,
      unitMinutes: count ? draft.unit : null,
      deadline: draft.deadline,
      start: draft.start,
      cascade: p.hasKids && draft.cascade,
    });
  };

  const prioColor = (v: Priority) =>
    v === 'must' ? ht.red : v === 'should' ? '#FF9500' : '#30B0C7';
  return (
    <Sheet
      visible={p.visible}
      title={p.name}
      th={ht}
      onClose={p.onClose}
      testID="goal-sheet"
      footer={
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <TextButton testID="goal-cancel" label={t('piano.chiudi')} onPress={p.onClose} />
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton testID="goal-save" label={t('piano.salva')} onPress={save} />
          </View>
        </View>
      }
    >
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 22 }}
        keyboardShouldPersistTaps="handled"
      >
        <Row label={t('piano.tipo')} hint={t(`piano.tipo_${draft.kind}_h`)}>
          <Choices
            testID="goal-kind"
            value={draft.kind}
            onChange={(kind) =>
              // passando a «ogni giorno» i minuti diventano per-giorno (si riparte da 15); uscendone tornano a un totale da zero
              set({
                kind,
                minutes:
                  kind === 'daily' && draft.kind !== 'daily'
                    ? 15
                    : kind !== 'daily' && draft.kind === 'daily'
                      ? 0
                      : draft.minutes,
              })
            }
            options={GOAL_KINDS.map((k) => ({ value: k, label: t(`piano.tipo_${k}`) }))}
          />
        </Row>

        {daily ? (
          <Stepper
            testID="goal-daily"
            label={t('piano.min_al_giorno')}
            value={draft.minutes}
            step={5}
            min={5}
            max={600}
            format={(v) => `${v} min`}
            onChange={(minutes) => set({ minutes })}
          />
        ) : count ? (
          <Row label={t('piano.tempo_progetto')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <NumberField
                testID="goal-items"
                label={t('piano.voci_per')}
                value={draft.items}
                max={100000}
                onChange={(items) => set({ items })}
              />
              <Text style={{ color: ht.text2 }}>{t('piano.voci_per')}</Text>
              <NumberField
                testID="goal-unit"
                label={t('piano.min_ciascuna')}
                value={draft.unit}
                max={1440}
                onChange={(unit) => set({ unit })}
              />
              <Text style={{ color: ht.text2 }}>{t('piano.min_ciascuna')}</Text>
            </View>
            <Text testID="goal-total" style={{ color: ht.text, fontWeight: '700' }}>
              {hours(total)}
            </Text>
          </Row>
        ) : (
          <Row hint={unit === 'days' ? t('piano.giorno_vale', { h: hours(p.dayLen) }) : undefined}>
            {unit === 'hours' ? (
              <HoursInput
                testID="goal-hours"
                label={t('piano.tempo_progetto')}
                unit={t('piano.ore')}
                minutes={draft.minutes}
                minusLabel={t('piano.meno')}
                plusLabel={t('piano.piu')}
                onChange={(minutes) => set({ minutes })}
              />
            ) : (
              <Stepper
                testID="goal-days"
                label={t('piano.tempo_progetto')}
                value={draft.minutes}
                step={Math.max(5, Math.round(p.dayLen / 2 / 5) * 5)}
                min={0}
                max={600000}
                format={(v) => `${Math.round((v / p.dayLen) * 10) / 10} ${t('piano.giorni')}`}
                minusLabel={t('piano.meno')}
                plusLabel={t('piano.piu')}
                onChange={(minutes) => set({ minutes })}
              />
            )}
            <Choices
              testID="goal-unit-choice"
              value={unit}
              onChange={setUnit}
              options={[
                { value: 'hours', label: t('piano.ore') },
                { value: 'days', label: t('piano.giorni') },
              ]}
            />
          </Row>
        )}

        {total > 0 && !daily ? (
          <View style={{ gap: 6 }}>
            <View
              style={{
                height: 8,
                borderRadius: 4,
                backgroundColor: ht.surface2,
                overflow: 'hidden',
              }}
            >
              <View
                testID="goal-progress"
                style={{
                  width: `${Math.min(100, Math.round((p.doneMin * 100) / total))}%`,
                  height: 8,
                  backgroundColor: p.color,
                }}
              />
            </View>
            <Text style={{ color: ht.text2, fontSize: 13 }}>
              {t('piano.fatto_di', { a: hours(p.doneMin), b: hours(total) })}
            </Text>
          </View>
        ) : null}

        <Row label={t('piano.priorita')}>
          <Choices
            testID="goal-prio"
            value={draft.priority}
            onChange={(priority) => set({ priority })}
            tone={prioColor}
            options={PRIORITIES.map((k) => ({ value: k, label: t(`piano.prio_${k}`) }))}
          />
        </Row>

        <Row>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Text style={{ color: ht.text2, fontSize: 15 }}>
              {draft.kind === 'exam' ? t('piano.data_esame') : t('piano.scadenza')}
            </Text>
            <DateTimeField
              kind="date"
              testID="goal-deadline"
              value={draft.deadline ?? ''}
              fallback={p.today}
              placeholder={
                p.inheritedDeadline ? t('piano.eredita', { d: p.inheritedDeadline }) : '—'
              }
              clearable
              onChange={(v) => set({ deadline: v || null })}
            />
          </View>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Text style={{ color: ht.text2, fontSize: 15 }}>{t('piano.inizio')}</Text>
            <DateTimeField
              kind="date"
              testID="goal-start"
              value={draft.start ?? ''}
              fallback={p.today}
              placeholder="—"
              clearable
              onChange={(v) => set({ start: v || null })}
            />
          </View>
        </Row>

        {p.hasKids ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ color: ht.text, flex: 1, fontSize: 15 }}>{t('piano.anche_figli')}</Text>
            <Switch
              testID="goal-cascade"
              value={draft.cascade}
              onValueChange={(cascade) => set({ cascade })}
              trackColor={{ true: ht.accent }}
            />
          </View>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}
