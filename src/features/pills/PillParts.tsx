import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useRef, useState, type ReactNode } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { alpha } from '@/features/buy/buyTheme';
import { TodoIcon, sansOf } from '@/features/tasks/TodoParts';
import type { TodoTheme } from '@/features/tasks/todoTheme';

import type { HistoryDay, PillPlan } from './logic';
import type { DoseView } from './repo';
import {
  hex6,
  hourOf,
  legend,
  levelOf,
  monthCells,
  perDay,
  shiftMonth,
  type Level,
  type PlanDraft,
} from './pillsLogic';
import { Text } from '@/ui/CappedText';

/* I pezzi della schermata Pastiglie, con l'aspetto di todo_widget.css (.td-pill-*). */

/** Il rosso delle prese rimaste indietro: sta sul bordo e sul giorno, non su tutto il blocco. */
export const PILL_RED = '#C98F8F';
export const PILL_RED_TEXT = '#A96A6A';

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
};
const timeOf = (hhmm: string) => {
  const d = new Date();
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
};
const hhmmOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Il segno di una presa nel cerchio: la spunta o la croce. */
function Mark({ kind, color, size = 16 }: { kind: 'check' | 'x'; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={kind === 'check' ? 'M5 12.5l4.5 4.5L19 7.5' : 'M7 7l10 10M17 7L7 17'}
        stroke={color}
        strokeWidth={kind === 'check' ? 2.6 : 2.4}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** «Nome  ·  1 compressa». */
const nameLine = (name: string, dose: string) => (dose ? `${name}  ·  ${dose}` : name);

/* ---------------- una presa ---------------- */

export function DoseRow(p: {
  td: TodoTheme;
  dose: DoseView;
  today: string;
  late?: boolean;
  /** «lunedì 3 agosto» sopra il nome, sulle arretrate */
  dayLabel?: string;
  onToggle: (d: DoseView) => void;
  onSkip: (d: DoseView) => void;
  onTime: (d: DoseView) => void;
  onPlan: (d: DoseView) => void;
  onForgot?: (d: DoseView) => void;
}) {
  const { td, dose: d } = p;
  const { t } = useTranslation();
  const taken = d.status === 'taken';
  const skipped = d.status === 'skipped';
  const color = hex6(d.color);
  const sub: string[] = [];
  if (d.notes) sub.push(d.notes);
  if (skipped) sub.push(t('todo.non_presa'));
  const when =
    taken && d.taken_at
      ? d.due_date !== p.today
        ? t('todo.presa_il_alle', {
            data: `${d.taken_at.slice(8, 10)}/${d.taken_at.slice(5, 7)}`,
            ora: hourOf(d.taken_at),
          })
        : t('todo.presa_alle', { ora: hourOf(d.taken_at) })
      : '';
  return (
    <View
      testID={`dose-${d.uuid}`}
      style={[
        styles.row,
        p.late && {
          borderLeftWidth: 2,
          borderLeftColor: PILL_RED,
          paddingLeft: 9,
          marginBottom: 2,
        },
      ]}
    >
      <Pressable
        testID={`dose-box-${d.uuid}`}
        accessibilityRole="checkbox"
        accessibilityLabel={taken ? t('todo.presa_maiusc') : t('todo.segna_come_presa')}
        accessibilityState={{ checked: taken }}
        // tocco lungo = saltata: è un gesto nascosto, ma la spunta normale resta di un tocco solo
        delayLongPress={550}
        onLongPress={() => p.onSkip(d)}
        onPress={() => p.onToggle(d)}
        style={[
          styles.check,
          taken
            ? { backgroundColor: color, borderColor: color }
            : {
                borderColor: p.late ? PILL_RED : alpha(color, 0.6),
                borderStyle: skipped ? 'dashed' : 'solid',
              },
        ]}
      >
        {taken ? (
          <Mark kind="check" color={td.onAccent} />
        ) : skipped ? (
          <Mark kind="x" color={td.ink3} />
        ) : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        testID={`dose-text-${d.uuid}`}
        // toccando il nome si apre la terapia: è lì che uno tocca chiedendosi come sta andando
        onPress={() => p.onPlan(d)}
        style={[styles.txt, (taken || skipped) && { opacity: 0.5 }]}
      >
        {p.dayLabel ? (
          <Text
            style={[
              {
                color: PILL_RED_TEXT,
                fontSize: 10.5,
                letterSpacing: 1,
                textTransform: 'uppercase',
              },
              sansOf(td),
            ]}
          >
            {p.dayLabel}
          </Text>
        ) : null}
        <Text style={[{ color: td.ink, fontSize: 14.5 }, sansOf(td)]}>
          {nameLine(d.name, d.plan_dose)}
        </Text>
        {sub.length ? (
          <Text style={[{ color: td.ink3, fontSize: 11.5 }, sansOf(td)]}>{sub.join('  ·  ')}</Text>
        ) : null}
      </Pressable>
      {when ? (
        <Pressable
          testID={`dose-when-${d.uuid}`}
          accessibilityRole="button"
          onPress={() => p.onTime(d)}
          hitSlop={6}
          style={styles.whenBox}
        >
          <Text
            style={[
              {
                color: td.ink3,
                fontSize: 11.5,
                textDecorationLine: 'underline',
                textDecorationStyle: 'dotted',
              },
              sansOf(td),
            ]}
          >
            {when}
          </Text>
        </Pressable>
      ) : null}
      {p.onForgot && !taken && !skipped ? (
        <Pressable
          testID={`dose-forgot-${d.uuid}`}
          accessibilityRole="button"
          accessibilityLabel={t('todo.non_ho_presa')}
          onPress={() => p.onForgot!(d)}
          style={[styles.forgot, { backgroundColor: td.panel }]}
        >
          <Text style={[{ color: td.ink3, fontSize: 11.5 }, sansOf(td)]}>
            {t('todo.dimenticata')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** «Prese tutte» (.td-pill-tutte). */
export function TakeAllButton(p: { td: TodoTheme; testID: string; onPress: () => void }) {
  const { td } = p;
  const { t } = useTranslation();
  return (
    <Pressable
      testID={p.testID}
      accessibilityRole="button"
      accessibilityLabel={t('todo.prese_tutte_aria')}
      onPress={p.onPress}
      style={({ pressed }) => [
        styles.takeAll,
        { backgroundColor: td.panel, transform: [{ scale: pressed ? 0.95 : 1 }] },
      ]}
    >
      <Text style={[{ color: td.ink, fontSize: 13 }, sansOf(td)]}>{t('todo.prese_tutte')}</Text>
    </Pressable>
  );
}

/** Una terapia nell'elenco «Le mie terapie». */
export function PlanRow(p: { td: TodoTheme; plan: PillPlan; rhythm: string; onPress: () => void }) {
  const { td, plan } = p;
  return (
    <Pressable
      testID={`plan-${plan.uuid}`}
      accessibilityRole="button"
      onPress={p.onPress}
      style={[styles.plan, { backgroundColor: td.panel }, !plan.is_active && { opacity: 0.5 }]}
    >
      <View style={[styles.dot, { backgroundColor: hex6(plan.color) }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[{ color: td.ink, fontSize: 14.5 }, sansOf(td)]}>
          {nameLine(plan.name, plan.dose)}
        </Text>
        <Text style={[{ color: td.ink3, fontSize: 11.5 }, sansOf(td)]}>{p.rhythm}</Text>
      </View>
    </Pressable>
  );
}

/* ---------------- finestre ---------------- */

/** La finestra (.td-modal + .td-card): scheda al centro su un velo; la larga scorre. */
export function PillModal(p: {
  td: TodoTheme;
  visible: boolean;
  onClose: () => void;
  wide?: boolean;
  testID?: string;
  children: ReactNode;
}) {
  const { td } = p;
  return (
    <Modal
      visible={p.visible}
      transparent
      animationType="fade"
      onRequestClose={p.onClose}
      statusBarTranslucent
    >
      <Pressable
        accessibilityRole="button"
        style={[
          styles.overlay,
          { backgroundColor: td.dark ? 'rgba(0,0,0,.55)' : 'rgba(74,68,61,.28)' },
        ]}
        onPress={p.onClose}
      >
        {/* il tocco dentro la scheda non deve chiuderla */}
        <Pressable
          accessibilityRole="button"
          testID={p.testID}
          style={[styles.card, { backgroundColor: td.card }, p.wide && styles.cardWide]}
          onPress={() => undefined}
        >
          {p.wide ? (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {p.children}
            </ScrollView>
          ) : (
            p.children
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function CardTitle({ td, children }: { td: TodoTheme; children: ReactNode }) {
  return (
    <Text style={[{ color: td.ink, fontSize: 17, fontWeight: '600', marginBottom: 8 }, sansOf(td)]}>
      {children}
    </Text>
  );
}

export function CardButton(p: {
  td: TodoTheme;
  label: string;
  testID: string;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { td } = p;
  return (
    <Pressable
      testID={p.testID}
      accessibilityRole="button"
      disabled={p.disabled}
      onPress={p.onPress}
      style={[
        styles.actBtn,
        { backgroundColor: p.primary ? td.accent : td.panel, opacity: p.disabled ? 0.5 : 1 },
      ]}
    >
      <Text
        style={[
          {
            color: p.primary ? td.onAccent : p.danger ? td.delFg : td.ink2,
            fontSize: 14,
            fontWeight: p.primary ? '500' : '400',
          },
          sansOf(td),
        ]}
      >
        {p.label}
      </Text>
    </Pressable>
  );
}

export function FieldLabel({ td, children }: { td: TodoTheme; children: ReactNode }) {
  return (
    <Text
      style={[
        {
          color: td.ink3,
          fontSize: 10,
          letterSpacing: 1.6,
          textTransform: 'uppercase',
          marginBottom: 5,
        },
        sansOf(td),
      ]}
    >
      {children}
    </Text>
  );
}

/** Un campo giorno o ora senza etichetta. iPhone/iPad: il selettore compatto di sistema; Android: la finestra di sistema. */
export function PickBox(p: {
  td: TodoTheme;
  kind: 'date' | 'time';
  value: string;
  fallback: string;
  testID: string;
  /** il giorno si può svuotare (la fine di una terapia) */
  clearable?: boolean;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  const { td } = p;
  const { t } = useTranslation();
  const isDate = p.kind === 'date';
  const current = p.value ? (isDate ? dateOf(p.value) : timeOf(p.value)) : null;
  const fromDate = (d: Date) => (isDate ? isoOf(d) : hhmmOf(d));
  return (
    <View style={[styles.pick, { backgroundColor: td.panel }]}>
      {current && Platform.OS === 'ios' ? (
        <DateTimePicker
          testID={p.testID}
          value={current}
          mode={p.kind}
          display="compact"
          themeVariant={td.dark ? 'dark' : 'light'}
          onValueChange={(_, d) => d && p.onChange(fromDate(d))}
        />
      ) : (
        <Pressable
          testID={p.testID}
          accessibilityRole="button"
          onPress={() => {
            const base = current ?? (isDate ? dateOf(p.fallback) : timeOf(p.fallback));
            if (Platform.OS === 'ios') {
              p.onChange(fromDate(base));
              return;
            }
            DateTimePickerAndroid.open({
              value: base,
              mode: p.kind,
              is24Hour: true,
              onValueChange: (_, d) => d && p.onChange(fromDate(d)),
            });
          }}
          style={{ paddingVertical: 4 }}
        >
          <Text style={[{ color: current ? td.ink : td.ink3, fontSize: 14 }, sansOf(td)]}>
            {p.value || p.placeholder || '—'}
          </Text>
        </Pressable>
      )}
      {p.clearable && current ? (
        <Pressable
          testID={`${p.testID}-clear`}
          accessibilityRole="button"
          accessibilityLabel={t('comune.annulla')}
          hitSlop={8}
          onPress={() => p.onChange('')}
        >
          <TodoIcon name="close" color={td.ink3} size={15} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** «Quando l'hai presa»: l'ora (e, sulle arretrate, anche il giorno). Si parte dall'ora prevista. */
export function TakenAtModal(p: {
  td: TodoTheme;
  dose: DoseView | null;
  withDay: boolean;
  onCancel: () => void;
  onApply: (stamp: string) => void;
}) {
  const { td, dose } = p;
  const { t } = useTranslation();
  return (
    <PillModal td={td} visible={!!dose} onClose={p.onCancel} testID="taken-modal">
      {dose && (
        <TakenAtBody
          key={dose.uuid}
          td={td}
          dose={dose}
          withDay={p.withDay}
          title={t('todo.quando_presa')}
          onCancel={p.onCancel}
          onApply={p.onApply}
        />
      )}
    </PillModal>
  );
}

function TakenAtBody(p: {
  td: TodoTheme;
  dose: DoseView;
  withDay: boolean;
  title: string;
  onCancel: () => void;
  onApply: (stamp: string) => void;
}) {
  const { td, dose: d } = p;
  const { t } = useTranslation();
  const [day, setDay] = useState((d.taken_at ?? '').slice(0, 10) || d.due_date);
  const [time, setTime] = useState(hourOf(d.taken_at) || d.due_time.slice(0, 5));
  return (
    <View>
      <CardTitle td={td}>{p.title}</CardTitle>
      {p.withDay && (
        <View style={{ marginBottom: 10 }}>
          <FieldLabel td={td}>{t('todo.giorno')}</FieldLabel>
          <PickBox
            td={td}
            kind="date"
            value={day}
            fallback={d.due_date}
            testID="taken-day"
            onChange={(v) => setDay(v || d.due_date)}
          />
        </View>
      )}
      <View style={{ marginBottom: 10 }}>
        <FieldLabel td={td}>{t('comune.ora')}</FieldLabel>
        <PickBox
          td={td}
          kind="time"
          value={time}
          fallback={d.due_time.slice(0, 5)}
          testID="taken-time"
          onChange={(v) => setTime(v || d.due_time.slice(0, 5))}
        />
      </View>
      <View style={styles.acts}>
        <CardButton
          td={td}
          testID="taken-cancel"
          label={t('comune.annulla')}
          onPress={p.onCancel}
        />
        <CardButton
          td={td}
          testID="taken-save"
          label={t('comune.salva')}
          primary
          onPress={() => p.onApply(`${day} ${time.slice(0, 5)}:00`)}
        />
      </View>
    </View>
  );
}

/** «Quando le hai prese?» per «Prese tutte» sulle arretrate: all'orario previsto o tutte adesso. */
export function TakeAllModal(p: {
  td: TodoTheme;
  count: number;
  onCancel: () => void;
  onPick: (mode: 'on_time' | 'now') => void;
}) {
  const { td } = p;
  const { t } = useTranslation();
  return (
    <PillModal td={td} visible={p.count > 0} onClose={p.onCancel} testID="takeall-modal">
      <CardTitle td={td}>{t('todo.quando_le_hai_prese')}</CardTitle>
      <Text
        style={[{ color: td.ink2, fontSize: 12.5, lineHeight: 18, marginBottom: 12 }, sansOf(td)]}
      >
        {p.count === 1 ? t('todo.prese_passate_1') : t('todo.prese_passate_n', { n: p.count })}
      </Text>
      <View style={{ gap: 8 }}>
        <CardButton
          td={td}
          testID="takeall-ontime"
          primary
          label={t('todo.all_orario_previsto')}
          onPress={() => p.onPick('on_time')}
        />
        <CardButton
          td={td}
          testID="takeall-now"
          label={t('todo.tutte_adesso')}
          onPress={() => p.onPick('now')}
        />
        <CardButton
          td={td}
          testID="takeall-cancel"
          label={t('comune.annulla')}
          onPress={p.onCancel}
        />
      </View>
    </PillModal>
  );
}

/** «Quante ne hai prese» in un giorno del calendario: un contatore e due scorciatoie. */
export function DayCountModal(p: {
  td: TodoTheme;
  plan: PillPlan | null;
  iso: string;
  taken: number;
  tot: number;
  locale: string;
  onCancel: () => void;
  onApply: (n: number) => void;
}) {
  const { td, plan } = p;
  const { t } = useTranslation();
  return (
    <PillModal td={td} visible={!!plan} onClose={p.onCancel} testID="daycount-modal">
      {plan && <DayCountBody key={`${plan.uuid}-${p.iso}`} {...p} plan={plan} t={t} />}
    </PillModal>
  );
}

function DayCountBody(p: {
  td: TodoTheme;
  plan: PillPlan;
  iso: string;
  taken: number;
  tot: number;
  locale: string;
  onCancel: () => void;
  onApply: (n: number) => void;
  t: (k: string, o?: Record<string, unknown>) => string;
}) {
  const { td, plan, tot, t } = p;
  const [n, setN] = useState(p.taken);
  const long = new Intl.DateTimeFormat(p.locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(dateOf(p.iso));
  const step = (label: string, delta: number, off: boolean, id: string) => (
    <Pressable
      testID={id}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={off}
      onPress={() => setN((x) => Math.max(0, Math.min(tot, x + delta)))}
      style={[styles.bigStep, { backgroundColor: td.panel, opacity: off ? 0.35 : 1 }]}
    >
      <Text style={[{ color: td.ink, fontSize: 22 }, sansOf(td)]}>{delta < 0 ? '−' : '+'}</Text>
    </Pressable>
  );
  const quick = (label: string, value: number, id: string) => (
    <Pressable
      testID={id}
      accessibilityRole="button"
      onPress={() => setN(value)}
      style={[styles.quickBtn, { backgroundColor: n === value ? td.accentSoft : td.panel }]}
    >
      <Text style={[{ color: n === value ? td.ink : td.ink2, fontSize: 13 }, sansOf(td)]}>
        {label}
      </Text>
    </Pressable>
  );
  return (
    <View>
      <CardTitle td={td}>{long}</CardTitle>
      <Text
        style={[{ color: td.ink2, fontSize: 12.5, lineHeight: 18, marginBottom: 10 }, sansOf(td)]}
      >
        {nameLine(plan.name, plan.dose)} — {t('todo.cal_quante')}
      </Text>
      <View style={styles.counter}>
        {step(t('todo.cal_meno'), -1, n <= 0, 'daycount-minus')}
        <View style={{ alignItems: 'center', minWidth: 70 }}>
          <Text
            testID="daycount-value"
            style={[{ color: td.ink, fontSize: 30, fontWeight: '600' }, sansOf(td)]}
          >
            {n}
          </Text>
          <Text style={[{ color: td.ink3, fontSize: 12 }, sansOf(td)]}>
            {t('todo.cal_di_tot', { tot })}
          </Text>
        </View>
        {step(t('todo.cal_piu'), 1, n >= tot, 'daycount-plus')}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 12 }}>
        {quick(t('todo.cal_nessuna'), 0, 'daycount-none')}
        {quick(t('todo.cal_tutte'), tot, 'daycount-all')}
      </View>
      <View style={styles.acts}>
        <CardButton
          td={td}
          testID="daycount-cancel"
          label={t('comune.annulla')}
          onPress={p.onCancel}
        />
        <CardButton
          td={td}
          testID="daycount-save"
          primary
          label={t('comune.salva')}
          onPress={() => (n === p.taken ? p.onCancel() : p.onApply(n))}
        />
      </View>
    </View>
  );
}

/* ---------------- calendario ---------------- */

/** Il pallino di un giorno: lo sfondo/contorno (per la vista) e il colore del numero (per il testo). */
const CAL_COLOR = (td: TodoTheme, level: Level, color: string): { box: ViewStyle; fg: string } => {
  switch (level) {
    case 'ok':
      return { box: { backgroundColor: color }, fg: td.onAccent };
    case 'low':
      return {
        box: {
          backgroundColor: alpha(color, 0.22),
          borderWidth: 1.4,
          borderColor: alpha(color, 0.45),
        },
        fg: td.ink2,
      };
    case 'high':
      return {
        box: {
          backgroundColor: alpha(color, 0.55),
          borderWidth: 1.4,
          borderColor: alpha(color, 0.75),
        },
        fg: td.ink,
      };
    case 'no':
      return { box: { backgroundColor: td.dark ? td.lateSoft : '#F3DFDF' }, fg: PILL_RED_TEXT };
    case 'wait':
      return { box: { borderWidth: 1.2, borderColor: td.hair }, fg: td.ink3 };
    default:
      return { box: {}, fg: td.ink3 };
  }
};

/** Un mese per volta, un pallino per giorno (pillCalendario del sito). Il giorno si tocca per dire quante prese. */
export function PillCalendar(p: {
  td: TodoTheme;
  plan: PillPlan;
  today: string;
  locale: string;
  /** i giorni del mese «AAAA-MM» con quante prese */
  history: (month: string) => HistoryDay[];
  onPickDay: (iso: string, taken: number, tot: number) => void;
}) {
  const { td, plan, today } = p;
  const { t } = useTranslation();
  const [month, setMonth] = useState(today.slice(0, 7));
  const startX = useRef(0);
  const color = hex6(plan.color);
  const days = new Map(p.history(month).map((d) => [d.date, d]));
  const cells = monthCells(month);
  const planTot = perDay(plan);
  const monthName = new Intl.DateTimeFormat(p.locale, { month: 'long' }).format(
    new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1),
  );
  // le sigle dei giorni nella lingua della pagina: il 1° gennaio 2024 era un lunedì
  const dows = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(p.locale, { weekday: 'narrow' }).format(new Date(2024, 0, 1 + i)),
  );
  const canNext = month < today.slice(0, 7);

  let done = 0;
  let holes = 0;
  const rendered = cells.map((c, i) => {
    if (!c.date) return <View key={`e${i}`} style={styles.calCell} />;
    const g = days.get(c.date);
    const tot = g ? g.taken + g.skipped + g.pending : 0;
    let level: Level = 'none';
    if (g) {
      // un giorno ancora in corso in cui non è successo niente non è un buco
      if (!g.taken && !g.skipped && c.date >= today) level = 'wait';
      else {
        level = levelOf(g.taken, tot);
        if (level === 'ok') done++;
        else if (level === 'no') holes++;
      }
    }
    const past = c.date <= today;
    const st = CAL_COLOR(td, level, color);
    const circle = (
      <View
        style={[
          styles.calCircle,
          st.box,
          c.date === today && { borderWidth: 1.8, borderColor: td.ink2 },
          c.date > today && { opacity: 0.35 },
        ]}
      >
        <Text style={[{ color: st.fg, fontSize: 12 }, sansOf(td)]}>{c.day}</Text>
      </View>
    );
    return past ? (
      <Pressable
        key={c.date}
        testID={`cal-day-${c.date}`}
        accessibilityRole="button"
        accessibilityLabel={
          g ? t('todo.cal_titolo_giorno', { data: c.date, n: g.taken, tot }) : c.date
        }
        style={styles.calCell}
        onPress={() => p.onPickDay(c.date!, g ? g.taken : 0, tot || planTot)}
      >
        {circle}
      </Pressable>
    ) : (
      <View key={c.date} style={styles.calCell}>
        {circle}
      </View>
    );
  });

  const note = holes
    ? t('todo.giorni_presa_no', { presa: done, no: holes })
    : done
      ? t('todo.presa_tutti_i_giorni')
      : t('todo.nessuna_presa');

  return (
    <View testID={`cal-${plan.uuid}`} style={{ marginTop: 6, marginBottom: 18 }}>
      <View style={styles.calHead}>
        <Pressable
          testID="cal-prev"
          accessibilityRole="button"
          onPress={() => setMonth((m) => shiftMonth(m, -1))}
          style={[styles.calNav, { backgroundColor: td.panel }]}
        >
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Path
              d="M15 5l-7 7 7 7"
              stroke={td.ink2}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
        <Text
          testID="cal-month"
          style={[
            { color: td.ink, fontSize: 14, fontWeight: '500', textTransform: 'capitalize' },
            sansOf(td),
          ]}
        >
          {monthName} {month.slice(0, 4)}
        </Text>
        <Pressable
          testID="cal-next"
          accessibilityRole="button"
          disabled={!canNext}
          onPress={() => setMonth((m) => shiftMonth(m, 1))}
          style={[styles.calNav, { backgroundColor: td.panel, opacity: canNext ? 1 : 0.3 }]}
        >
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Path
              d="M9 5l7 7-7 7"
              stroke={td.ink2}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
      </View>
      <View style={styles.calRow}>
        {dows.map((g, i) => (
          <View key={i} style={styles.calCell}>
            <Text
              style={[
                { color: td.ink3, fontSize: 9.5, textAlign: 'center', textTransform: 'uppercase' },
                sansOf(td),
              ]}
            >
              {g}
            </Text>
          </View>
        ))}
      </View>
      {/* si sfoglia anche col dito, come un calendario: trascinare a sinistra porta avanti */}
      <View
        style={styles.calRow}
        onTouchStart={(e) => {
          startX.current = e.nativeEvent.pageX;
        }}
        onTouchEnd={(e) => {
          const dx = e.nativeEvent.pageX - startX.current;
          if (Math.abs(dx) < 40) return;
          if (dx < 0) {
            if (canNext) setMonth((m) => shiftMonth(m, 1));
          } else setMonth((m) => shiftMonth(m, -1));
        }}
      >
        {rendered}
      </View>
      <View style={{ marginTop: 12, gap: 5 }}>
        {legend(planTot).map((v) => {
          const st = CAL_COLOR(td, v.level, color);
          return (
            <View key={v.level} style={styles.legRow}>
              <View style={[styles.legDot, st.box]} />
              <Text style={[{ color: td.ink3, fontSize: 11.5, flexShrink: 1 }, sansOf(td)]}>
                {legendText(v.level, v.counts, planTot, t)}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={[{ color: td.ink2, fontSize: 11.5, marginTop: 10 }, sansOf(td)]}>
        {note} <Text style={{ color: td.ink3 }}>{t('todo.cal_tocca')}</Text>
      </Text>
    </View>
  );
}

function legendText(
  level: Level,
  counts: number[],
  tot: number,
  t: (k: string, o?: Record<string, unknown>) => string,
): string {
  if (level === 'ok') return tot > 1 ? t('todo.presa_tutte_le_volte', { n: tot }) : t('todo.presa');
  if (level === 'no') return t('todo.non_presa');
  if (level === 'wait') return t('todo.prevista_giorno_non_finito');
  const times =
    counts.length === 1
      ? t(counts[0] === 1 ? 'todo.volta_su' : 'todo.volte_su', { n: counts[0], tot })
      : t('todo.volte_da_a_su', { da: counts[0], a: counts[counts.length - 1], tot });
  return t('todo.presa_n_volte', { volte: times });
}

/* ---------------- la scheda della terapia ---------------- */

const FREQS = [
  ['daily', 'todo.giorni_settimana'],
  ['monthly', 'todo.giorni_del_mese'],
  ['interval', 'todo.ogni_n_giorni'],
] as const;
const WEEKDAY_KEYS = [
  'todo.gg_lun',
  'todo.gg_mar',
  'todo.gg_mer',
  'todo.gg_gio',
  'todo.gg_ven',
  'todo.gg_sab',
  'todo.gg_dom',
] as const;

export function PlanEditor(p: {
  td: TodoTheme;
  draft: PlanDraft;
  isNew: boolean;
  /** il campo che il controllo ha rifiutato (si evidenzia) */
  errorField: string | null;
  today: string;
  onChange: (d: PlanDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
  /** il calendario, solo per una terapia che esiste già */
  calendar: ReactNode;
}) {
  const { td, draft: d } = p;
  const { t } = useTranslation();
  const set = (patch: Partial<PlanDraft>) => p.onChange({ ...d, ...patch });
  const input = (
    id: string,
    value: string,
    placeholder: string,
    max: number,
    onChange: (v: string) => void,
    field: string,
    extra: object = {},
  ) => (
    <TextInput
      testID={id}
      value={value}
      placeholder={placeholder}
      placeholderTextColor={td.ink3}
      maxLength={max}
      onChangeText={onChange}
      style={[
        styles.input,
        { backgroundColor: td.panel, color: td.ink },
        p.errorField === field && { borderWidth: 1.5, borderColor: td.late },
        sansOf(td),
      ]}
      {...extra}
    />
  );
  const field = (label: string, node: ReactNode) => (
    <View style={{ marginBottom: 10 }}>
      <FieldLabel td={td}>{label}</FieldLabel>
      {node}
    </View>
  );
  const seg = (on: boolean, label: string, id: string, onPress: () => void, flex = true) => (
    <Pressable
      key={id}
      testID={id}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[flex ? styles.seg : styles.segSmall, { backgroundColor: on ? td.accent : td.panel }]}
    >
      <Text
        style={[
          { color: on ? td.onAccent : td.ink3, fontSize: flex ? 11.5 : 11, textAlign: 'center' },
          sansOf(td),
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
  const step = (label: string, id: string, onPress: () => void) => (
    <Pressable
      testID={id}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.step, { backgroundColor: td.panel }]}
    >
      <Text style={[{ color: td.ink, fontSize: 15 }, sansOf(td)]}>{label}</Text>
    </Pressable>
  );
  return (
    <>
      <CardTitle td={td}>{p.isNew ? t('todo.nuova_terapia') : t('todo.terapia')}</CardTitle>
      {field(
        t('todo.cosa'),
        input(
          'plan-name',
          d.name,
          t('todo.esempio_pastiglia'),
          120,
          (v) => set({ name: v }),
          'name',
        ),
      )}
      {field(
        t('todo.quanto'),
        input('plan-dose', d.dose, t('todo.esempio_dose'), 60, (v) => set({ dose: v }), 'dose'),
      )}
      {field(
        t('todo.nota_breve'),
        input(
          'plan-notes',
          d.notes,
          t('todo.esempio_note'),
          255,
          (v) => set({ notes: v }),
          'notes',
        ),
      )}

      {field(
        t('todo.quando'),
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {FREQS.map(([key, label]) =>
            seg(d.freq === key, t(label), `plan-freq-${key}`, () => set({ freq: key })),
          )}
        </View>,
      )}
      <View style={{ marginTop: -2, marginBottom: 12 }}>
        {d.freq === 'daily' ? (
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {WEEKDAY_KEYS.map((k, i) =>
              seg(
                d.weekdays[i]!,
                t(k),
                `plan-wd-${i}`,
                () => set({ weekdays: d.weekdays.map((x, j) => (j === i ? !x : x)) }),
                false,
              ),
            )}
          </View>
        ) : d.freq === 'monthly' ? (
          input(
            'plan-monthdays',
            d.monthDays,
            t('todo.esempio_giorni'),
            100,
            (v) => set({ monthDays: v }),
            'month_days',
            { keyboardType: 'numbers-and-punctuation' },
          )
        ) : (
          input(
            'plan-interval',
            d.interval,
            '1',
            3,
            (v) => set({ interval: v.replace(/\D/g, '') }),
            'interval_days',
            { keyboardType: 'number-pad' },
          )
        )}
      </View>

      {field(
        t('todo.a_che_ora'),
        <View>
          {d.times.map((tm, i) => (
            <View key={i} style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <PickBox
                  td={td}
                  kind="time"
                  value={tm.time}
                  fallback="08:00"
                  testID={`plan-time-${i}`}
                  onChange={(v) =>
                    set({
                      times: d.times.map((x, j) => (j === i ? { ...x, time: v || '08:00' } : x)),
                    })
                  }
                />
              </View>
              {step('−', `plan-time-${i}-less`, () =>
                set({
                  times: d.times.map((x, j) => (j === i ? { ...x, n: Math.max(1, x.n - 1) } : x)),
                }),
              )}
              <Text
                testID={`plan-time-${i}-n`}
                style={[
                  { color: td.ink3, fontSize: 13, minWidth: 26, textAlign: 'center' },
                  sansOf(td),
                ]}
              >
                ×{tm.n}
              </Text>
              {step('+', `plan-time-${i}-more`, () =>
                set({
                  times: d.times.map((x, j) => (j === i ? { ...x, n: Math.min(9, x.n + 1) } : x)),
                }),
              )}
              {step('×', `plan-time-${i}-del`, () => {
                // almeno un orario deve restare
                if (d.times.length > 1) set({ times: d.times.filter((_, j) => j !== i) });
              })}
            </View>
          ))}
          <Pressable
            testID="plan-time-add"
            accessibilityRole="button"
            onPress={() => set({ times: [...d.times, { time: '20:00', n: 1 }] })}
            style={{ paddingVertical: 4 }}
          >
            <Text style={[{ color: td.ink3, fontSize: 12.5 }, sansOf(td)]}>
              {t('todo.altro_orario')}
            </Text>
          </Pressable>
        </View>,
      )}

      {field(
        t('todo.da'),
        <PickBox
          td={td}
          kind="date"
          value={d.start}
          fallback={p.today}
          testID="plan-start"
          onChange={(v) => set({ start: v || p.today })}
        />,
      )}
      {field(
        t('todo.fino_a'),
        <PickBox
          td={td}
          kind="date"
          value={d.end}
          fallback={p.today}
          testID="plan-end"
          clearable
          placeholder="—"
          onChange={(v) => set({ end: v })}
        />,
      )}
      {field(
        t('todo.stato'),
        <Pressable
          testID="plan-active"
          accessibilityRole="switch"
          accessibilityState={{ checked: d.active }}
          onPress={() => set({ active: !d.active })}
          style={[
            styles.att,
            { backgroundColor: d.active ? td.accent : td.panel, alignSelf: 'flex-start' },
          ]}
        >
          <Text style={[{ color: d.active ? td.onAccent : td.ink3, fontSize: 13 }, sansOf(td)]}>
            {d.active ? t('todo.attiva') : t('todo.sospesa')}
          </Text>
        </Pressable>,
      )}

      {/* come è andata, in fondo e non in cima: si guarda dopo aver finito di guardare le regole */}
      {p.calendar}

      <View style={styles.acts}>
        <CardButton td={td} testID="plan-cancel" label={t('comune.annulla')} onPress={p.onCancel} />
        {!p.isNew && (
          <CardButton
            td={td}
            testID="plan-delete"
            danger
            label={t('comune.elimina')}
            onPress={p.onDelete}
          />
        )}
        <CardButton
          td={td}
          testID="plan-save"
          primary
          label={t('comune.salva')}
          onPress={p.onSave}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 7 },
  check: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txt: { flex: 1, minWidth: 0 },
  whenBox: { flexShrink: 0 },
  forgot: { borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 },
  takeAll: { borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 11,
    marginBottom: 6,
    borderRadius: 13,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 22,
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  cardWide: { maxWidth: 380, maxHeight: '82%' },
  acts: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  actBtn: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 },
  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 44,
  },
  input: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  seg: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    justifyContent: 'center',
  },
  segSmall: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  step: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  att: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 11 },
  bigStep: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  quickBtn: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 18 },
  calHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calNav: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calRow: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100 / 7}%`, padding: 2 },
  calCircle: { aspectRatio: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  legRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legDot: { width: 14, height: 14, borderRadius: 7 },
});
