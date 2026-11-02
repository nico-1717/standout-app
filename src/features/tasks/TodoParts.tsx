import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState, type ReactNode } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { mix } from '@/features/buy/buyTheme';

import type { TaskGroup } from './groups';
import { cleanMinutes, type UnderstoodPiece } from './todoLogic';
import type { TodoTheme } from './todoTheme';

/* I pezzi della pagina Attività che non sono la riga: icone, barra per aggiungere, intestazioni dei gruppi,
   barra della selezione e finestra «data e ora» (todo_nuovo.css, todo_widget.css). */

const PATHS = {
  plus: 'M12 5v14M5 12h14',
  check: 'M20 6L9 17l-5-5',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3',
  cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  clock: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',
  close: 'M6 6l12 12M18 6L6 18',
} as const;

export function TodoIcon({
  name,
  color,
  size = 18,
  width = 2,
}: {
  name: keyof typeof PATHS;
  color: string;
  size?: number;
  width?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={PATHS[name]}
        stroke={color}
        strokeWidth={width}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Il carattere del testo: in «carta» il sito usa Jost. */
export const sansOf = (td: TodoTheme): TextStyle | null =>
  td.sans ? { fontFamily: td.sans } : null;

/* ---------- la barra per aggiungere (.tn-add, .tn-capito) ---------- */

export function AddBar(p: {
  td: TodoTheme;
  value: string;
  onChange: (s: string) => void;
  onSubmit: () => void;
  onFocus?: () => void;
  pieces: UnderstoodPiece[];
}) {
  const { td } = p;
  const { t } = useTranslation();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      <View
        style={[
          styles.add,
          {
            backgroundColor: td.card,
            borderColor: focus ? td.accent : td.hair,
            borderWidth: focus ? 1.5 : StyleSheet.hairlineWidth,
          },
        ]}
      >
        <TextInput
          testID="todo-input"
          value={p.value}
          onChangeText={p.onChange}
          onSubmitEditing={p.onSubmit}
          onFocus={() => {
            setFocus(true);
            p.onFocus?.();
          }}
          onBlur={() => setFocus(false)}
          returnKeyType="done"
          submitBehavior="submit"
          placeholder={t('todo.tn_ph_todo')}
          placeholderTextColor={td.ink3}
          style={[styles.addInput, { color: td.ink }, sansOf(td)]}
        />
        <Pressable
          testID="todo-add"
          accessibilityRole="button"
          accessibilityLabel={t('comune.aggiungi')}
          onPress={p.onSubmit}
          style={({ pressed }) => [
            styles.go,
            { backgroundColor: td.accent, transform: [{ scale: pressed ? 0.9 : 1 }] },
          ]}
        >
          <TodoIcon name="plus" color={td.onAccent} size={19} width={2.4} />
        </Pressable>
      </View>
      {p.pieces.length > 0 && (
        <View style={styles.capito} testID="todo-understood">
          {p.pieces.map((pc) => (
            <View
              key={pc.kind + pc.text}
              style={[
                styles.pez,
                pc.kind === 'nessuno'
                  ? { borderColor: td.hair, borderWidth: StyleSheet.hairlineWidth }
                  : {
                      backgroundColor:
                        pc.kind === 'date' ? mix(td.accent, td.card, 0.24) : td.accentSoft,
                    },
              ]}
            >
              <Text
                style={[
                  { fontSize: 12, color: pc.kind === 'nessuno' ? td.ink3 : td.ink },
                  sansOf(td),
                ]}
              >
                {pc.text}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/* ---------- l'intestazione di un gruppo (.tn-gh) ---------- */

export function GroupHead(p: {
  td: TodoTheme;
  group: TaskGroup;
  label: string;
  count: number;
  first: boolean;
  onPress?: () => void;
}) {
  const { td } = p;
  const late = p.group === 'ritardo';
  const color = late ? td.late : p.group === 'oggi' ? td.ink : td.ink3;
  return (
    <Pressable
      onPress={p.onPress}
      testID={`todo-group-${p.group}`}
      accessibilityRole="header"
      style={[styles.gh, { marginTop: p.first ? 4 : p.group === 'fatte' ? 22 : 18 }]}
    >
      {p.group === 'oggi' && <View style={[styles.dot, { backgroundColor: td.accent }]} />}
      <Text
        style={[
          {
            color,
            fontSize: 11,
            fontWeight: '500',
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          },
          sansOf(td),
        ]}
      >
        {p.label}
      </Text>
      <Text style={[{ color: late ? td.late : td.ink3, fontSize: 11, opacity: 0.8 }, sansOf(td)]}>
        {p.count}
      </Text>
    </Pressable>
  );
}

/* ---------- la barra della selezione (.td-bulk) ---------- */

export function BulkBar(p: {
  td: TodoTheme;
  count: number;
  onSchedule: () => void;
  onDelete: () => void;
}) {
  const { td } = p;
  const { t } = useTranslation();
  return (
    <View style={[styles.bulk, { borderBottomColor: td.hair }]} testID="todo-bulk">
      <Pressable
        testID="bulk-schedule"
        accessibilityRole="button"
        accessibilityLabel={t('todo.data_e_ora')}
        onPress={p.onSchedule}
        style={[styles.bulkBtn, { backgroundColor: td.panel, opacity: p.count ? 1 : 0.5 }]}
      >
        <TodoIcon name="cal" color={td.ink2} size={15} />
      </Pressable>
      <Pressable
        testID="bulk-delete"
        accessibilityRole="button"
        accessibilityLabel={t('comune.elimina')}
        onPress={p.onDelete}
        style={[styles.bulkBtn, { backgroundColor: td.delBg, opacity: p.count ? 1 : 0.5 }]}
      >
        <TodoIcon name="trash" color={td.delFg} size={15} />
      </Pressable>
      <Text
        testID="bulk-count"
        style={[{ marginLeft: 'auto', fontSize: 13, color: td.ink, fontWeight: '500' }, sansOf(td)]}
      >
        {p.count ? t('todo.n_scelti', { n: p.count }) : t('todo.nessuna_scelta')}
      </Text>
    </View>
  );
}

/* ---------- la finestrella «data e ora» (.td-card) ---------- */

export interface When {
  /** 'AAAA-MM-GG' oppure '' = senza data */
  date: string;
  /** 'HH:MM' oppure '' */
  time: string;
  minutes: number;
}

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

/** Un campo giorno o ora. iPhone/iPad: il selettore compatto di sistema; Android: la finestra di sistema. */
export function WhenField(p: {
  td: TodoTheme;
  kind: 'date' | 'time';
  label: string;
  value: string;
  fallback: string;
  testID: string;
  onChange: (v: string) => void;
}) {
  const { td } = p;
  const { t } = useTranslation();
  const isDate = p.kind === 'date';
  const current = p.value ? (isDate ? dateOf(p.value) : timeOf(p.value)) : null;
  const fromDate = (d: Date) => (isDate ? isoOf(d) : hhmmOf(d));
  return (
    <View style={[styles.field, { borderBottomColor: td.hair }]}>
      <Text style={[{ color: td.ink, fontSize: 14 }, sansOf(td)]}>{p.label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
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
            style={[styles.fieldBox, { backgroundColor: td.panel }]}
          >
            <Text style={[{ color: current ? td.ink : td.ink3, fontSize: 14 }, sansOf(td)]}>
              {p.value || '—'}
            </Text>
          </Pressable>
        )}
        {current && (
          <Pressable
            testID={`${p.testID}-clear`}
            accessibilityRole="button"
            accessibilityLabel={t('comune.annulla')}
            hitSlop={8}
            onPress={() => p.onChange('')}
          >
            <TodoIcon name="close" color={td.ink3} size={15} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function WhenModal(p: {
  td: TodoTheme;
  visible: boolean;
  title: string;
  sub?: string;
  initial: When;
  /** il giorno di partenza se il campo è vuoto (oggi) */
  today: string;
  withMinutes: boolean;
  onCancel: () => void;
  onApply: (w: When) => void;
}) {
  const { td } = p;
  return (
    <Modal
      visible={p.visible}
      transparent
      animationType="fade"
      onRequestClose={p.onCancel}
      statusBarTranslucent
    >
      <Pressable
        style={[
          styles.overlay,
          { backgroundColor: td.dark ? 'rgba(0,0,0,.55)' : 'rgba(74,68,61,.28)' },
        ]}
        onPress={p.onCancel}
      >
        {/* il tocco dentro la scheda non deve chiuderla */}
        <Pressable style={[styles.card, { backgroundColor: td.card }]} onPress={() => undefined}>
          {p.visible && <WhenBody {...p} />}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function WhenBody(p: {
  td: TodoTheme;
  title: string;
  sub?: string;
  initial: When;
  today: string;
  withMinutes: boolean;
  onCancel: () => void;
  onApply: (w: When) => void;
}) {
  const { td } = p;
  const { t } = useTranslation();
  const [date, setDate] = useState(p.initial.date);
  const [time, setTime] = useState(p.initial.time);
  const [minutes, setMinutes] = useState(String(p.initial.minutes || 30));
  return (
    <View testID="when-modal">
      <Text style={[{ color: td.ink, fontSize: 17, fontWeight: '600' }, sansOf(td)]}>
        {p.title}
      </Text>
      {p.sub ? (
        <Text
          style={[
            { color: td.ink2, fontSize: 12.5, lineHeight: 18, marginTop: 4, marginBottom: 8 },
            sansOf(td),
          ]}
        >
          {p.sub}
        </Text>
      ) : (
        <View style={{ height: 8 }} />
      )}
      <WhenField
        td={td}
        kind="date"
        label={t('comune.data')}
        value={date}
        fallback={p.today}
        testID="when-date"
        onChange={(v) => {
          setDate(v);
          if (!v) setTime(''); // senza giorno non c'è un'ora (come sul sito)
        }}
      />
      <WhenField
        td={td}
        kind="time"
        label={t('comune.ora')}
        value={time}
        fallback="09:00"
        testID="when-time"
        onChange={(v) => {
          setTime(v);
          if (v && !date) setDate(p.today);
        }}
      />
      {p.withMinutes && (
        <View style={[styles.field, { borderBottomColor: td.hair }]}>
          <Text style={[{ color: td.ink, fontSize: 14 }, sansOf(td)]}>{t('todo.durata_min')}</Text>
          <TextInput
            testID="when-minutes"
            value={minutes}
            onChangeText={(s) => setMinutes(s.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            style={[styles.fieldBox, styles.minutes, { backgroundColor: td.panel, color: td.ink }]}
          />
        </View>
      )}
      <View style={styles.acts}>
        <Pressable
          testID="when-cancel"
          accessibilityRole="button"
          onPress={p.onCancel}
          style={[styles.actBtn, { backgroundColor: td.panel }]}
        >
          <Text style={[{ color: td.ink2, fontSize: 14 }, sansOf(td)]}>{t('comune.annulla')}</Text>
        </Pressable>
        <Pressable
          testID="when-apply"
          accessibilityRole="button"
          onPress={() => p.onApply({ date, time, minutes: cleanMinutes(minutes) })}
          style={[styles.actBtn, { backgroundColor: td.accent }]}
        >
          <Text style={[{ color: td.onAccent, fontSize: 14, fontWeight: '500' }, sansOf(td)]}>
            {t('comune.applica')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Un «chip» tondo degli strumenti di una riga aperta (.td-chip). */
export function ToolChip(p: {
  td: TodoTheme;
  set?: boolean;
  late?: boolean;
  danger?: boolean;
  testID?: string;
  label: string;
  onPress: () => void;
  children?: ReactNode;
}) {
  const { td } = p;
  const bg = p.danger ? 'transparent' : p.set ? (p.late ? td.lateSoft : td.accentSoft) : td.panel;
  const fg = p.danger ? td.delFg : p.set ? (p.late ? td.late : td.ink) : td.ink2;
  return (
    <Pressable
      testID={p.testID}
      accessibilityRole="button"
      onPress={p.onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: bg, transform: [{ scale: pressed ? 0.94 : 1 }] },
      ]}
    >
      {p.children}
      {p.label ? <Text style={[{ color: fg, fontSize: 12 }, sansOf(td)]}>{p.label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingLeft: 16,
    paddingRight: 5,
    borderRadius: 999,
  },
  addInput: { flex: 1, minWidth: 0, fontSize: 16, paddingVertical: 9 },
  go: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  capito: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 9, paddingHorizontal: 6 },
  pez: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  gh: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginHorizontal: 2,
    marginBottom: 2,
  },
  dot: { width: 7, height: 7, borderRadius: 4, alignSelf: 'center' },
  bulk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  bulkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 22,
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 46,
  },
  fieldBox: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  minutes: { textAlign: 'center', fontSize: 14, minWidth: 70 },
  acts: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  actBtn: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 999,
  },
});
