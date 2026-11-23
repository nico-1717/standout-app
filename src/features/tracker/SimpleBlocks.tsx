import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { uuidv7 } from 'uuidv7';

import { usePlanTheme } from '@/features/plan/ui';
import { haptic } from '@/ui/motion';

import {
  MAX_COLS,
  MAX_ROWS,
  checklistData,
  counterConfig,
  counterData,
  noteData,
  progressConfig,
  tableConfig,
  tableData,
  type Block,
} from './blocks';
import { cellKey, colName, columnSum, evaluate, show } from './formula';
import { Btn, Check, Hint } from './parts';

export interface BlockProps {
  block: Block;
  /** tutti i blocchi del tracker (la barra di avanzamento può leggere un contatore) */
  all: Block[];
  onSave: (change: { title?: string; config?: object; data?: object }) => void;
}

const CELL_W = 96;
const ROW_H = 40;

/** Una cella: da ferma mostra il risultato, mentre ci scrivi mostra quello che hai scritto (anche la formula). */
function Cell({
  value,
  shown,
  header,
  onCommit,
  testID,
}: {
  value: string;
  shown: string;
  header?: boolean;
  onCommit: (v: string) => void;
  testID: string;
}) {
  const ht = usePlanTheme();
  const [draft, setDraft] = useState<string | null>(null);
  const isErr = shown.startsWith('#');
  const num = shown !== '' && Number.isFinite(Number(shown));
  return (
    <TextInput
      testID={testID}
      value={draft ?? shown}
      onFocus={() => setDraft(value)}
      onChangeText={setDraft}
      onBlur={() => {
        if (draft !== null && draft !== value) onCommit(draft);
        setDraft(null);
      }}
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType="default"
      selectTextOnFocus
      style={{
        width: CELL_W,
        height: ROW_H,
        paddingHorizontal: 8,
        fontSize: 15,
        textAlign: num && draft === null ? 'right' : 'left',
        color: isErr && draft === null ? ht.red : ht.text,
        fontWeight: header ? '700' : '400',
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: ht.hairline2,
        fontVariant: ['tabular-nums'],
      }}
    />
  );
}

/** La griglia come un foglio Excel: celle, formule, una riga di totali sotto. */
export function TableBlock({ block, onSave }: BlockProps) {
  const ht = usePlanTheme();
  const { t } = useTranslation();
  const cfg = tableConfig(block.config);
  const { cells } = tableData(block.data);
  const values = evaluate(cells);
  const save = (nextCells: typeof cells, nextCfg = cfg) =>
    onSave({ config: nextCfg, data: { cells: nextCells } });

  const setCell = (key: string, v: string) => {
    const next = { ...cells };
    if (v === '') delete next[key];
    else next[key] = v;
    save(next);
  };
  const dropOutside = (cols: number, rows: number) => {
    const next: typeof cells = {};
    for (const [k, v] of Object.entries(cells)) {
      const m = /^([A-Z]+)(\d+)$/.exec(k);
      if (!m) continue;
      let c = 0;
      for (const ch of m[1] as string) c = c * 26 + (ch.charCodeAt(0) - 64);
      if (c - 1 < cols && Number(m[2]) <= rows) next[k] = v;
    }
    return next;
  };
  const resize = (cols: number, rows: number) => {
    const c = Math.min(MAX_COLS, Math.max(1, cols));
    const r = Math.min(MAX_ROWS, Math.max(1, rows));
    if (c === cfg.cols && r === cfg.rows) return;
    save(dropOutside(c, r), { ...cfg, cols: c, rows: r });
  };

  const head = {
    width: CELL_W,
    height: 30,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: ht.hairline2,
    backgroundColor: ht.surface2,
  };
  return (
    <View style={{ gap: 10 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator keyboardShouldPersistTaps="handled">
        <View style={{ borderTopWidth: 1, borderLeftWidth: 1, borderColor: ht.hairline2 }}>
          <View style={{ flexDirection: 'row' }}>
            {Array.from({ length: cfg.cols }, (_, c) => (
              <View key={c} style={head}>
                <Text style={{ color: ht.text2, fontWeight: '700' }}>{colName(c)}</Text>
              </View>
            ))}
          </View>
          {Array.from({ length: cfg.rows }, (_, r) => (
            <View key={r} style={{ flexDirection: 'row' }}>
              {Array.from({ length: cfg.cols }, (_, c) => {
                const key = cellKey(c, r);
                return (
                  <Cell
                    key={`${key}:${cells[key] ?? ''}`}
                    testID={`tr-cell-${key}`}
                    value={cells[key] ?? ''}
                    shown={show(values[key])}
                    onCommit={(v) => setCell(key, v)}
                  />
                );
              })}
            </View>
          ))}
          <View style={{ flexDirection: 'row', backgroundColor: ht.surface2 }}>
            {Array.from({ length: cfg.cols }, (_, c) => (
              <View
                key={c}
                style={{
                  width: CELL_W,
                  height: ROW_H,
                  paddingHorizontal: 8,
                  justifyContent: 'center',
                  borderRightWidth: 1,
                  borderBottomWidth: 1,
                  borderColor: ht.hairline2,
                }}
              >
                <Text
                  testID={`tr-total-${colName(c)}`}
                  style={{
                    color: ht.text,
                    fontWeight: '700',
                    textAlign: 'right',
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {c === 0 && !cells[cellKey(0, 0)]
                    ? t('tracker.t_total')
                    : show(columnSum(values, c, cfg.rows))}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Btn
          small
          label={t('tracker.t_add_row')}
          onPress={() => resize(cfg.cols, cfg.rows + 1)}
          testID="tr-add-row"
        />
        <Btn
          small
          label={t('tracker.t_add_col')}
          onPress={() => resize(cfg.cols + 1, cfg.rows)}
          testID="tr-add-col"
        />
        <Btn
          small
          label={t('tracker.t_del_row')}
          onPress={() => resize(cfg.cols, cfg.rows - 1)}
          testID="tr-del-row"
        />
        <Btn
          small
          label={t('tracker.t_del_col')}
          onPress={() => resize(cfg.cols - 1, cfg.rows)}
          testID="tr-del-col"
        />
      </View>
      <Hint>{t('tracker.t_hint')}</Hint>
    </View>
  );
}

const fmtNum = (n: number) => String(Math.round(n * 1e4) / 1e4);

/** Un numero che si alza e si abbassa, con il passo e l'unità che scegli. */
export function CounterBlock({ block, onSave }: BlockProps) {
  const ht = usePlanTheme();
  const { t } = useTranslation();
  const cfg = counterConfig(block.config);
  const { value } = counterData(block.data);
  const go = (d: number) => onSave({ data: { value: Math.round((value + d) * 1e4) / 1e4 } });
  const round = (label: string, a11y: string, d: number, id: string) => (
    <Pressable
      testID={id}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={() => {
        haptic.tap();
        go(d);
      }}
      style={({ pressed }) => ({
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ht.surface2,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ color: ht.text, fontSize: 26, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ gap: 12 }}>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22 }}
      >
        {round('−', t('tracker.c_minus'), -cfg.step, 'tr-counter-minus')}
        <View style={{ alignItems: 'center', minWidth: 90 }}>
          <Text
            testID="tr-counter-value"
            style={{
              color: ht.text,
              fontSize: 38,
              fontWeight: '700',
              fontVariant: ['tabular-nums'],
            }}
          >
            {fmtNum(value)}
          </Text>
          {cfg.unit ? <Text style={{ color: ht.text2 }}>{cfg.unit}</Text> : null}
        </View>
        {round('+', t('tracker.c_plus'), cfg.step, 'tr-counter-plus')}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <TextInput
          key={`u:${cfg.unit}`}
          testID="tr-counter-unit"
          defaultValue={cfg.unit}
          placeholder={t('tracker.c_unit_ph')}
          placeholderTextColor={ht.text3}
          onEndEditing={(e) => {
            const unit = e.nativeEvent.text.trim().slice(0, 20);
            if (unit !== cfg.unit) onSave({ config: { ...cfg, unit } });
          }}
          style={{
            flex: 1,
            minHeight: 44,
            color: ht.text,
            borderBottomWidth: 1,
            borderColor: ht.hairline2,
          }}
        />
        <Text style={{ color: ht.text2 }}>{t('tracker.c_step')}</Text>
        <TextInput
          key={`s:${cfg.step}`}
          testID="tr-counter-step"
          defaultValue={fmtNum(cfg.step)}
          keyboardType="decimal-pad"
          onEndEditing={(e) => {
            const n = Number(e.nativeEvent.text.replace(',', '.'));
            if (Number.isFinite(n) && n > 0 && n !== cfg.step)
              onSave({ config: { ...cfg, step: n } });
          }}
          style={{
            width: 64,
            minHeight: 44,
            color: ht.text,
            textAlign: 'center',
            borderBottomWidth: 1,
            borderColor: ht.hairline2,
          }}
        />
      </View>
    </View>
  );
}

/** Una barra verso un obiettivo: il valore lo scrivi tu, oppure lo legge da un contatore. */
export function ProgressBlock({ block, all, onSave }: BlockProps) {
  const ht = usePlanTheme();
  const { t } = useTranslation();
  const cfg = progressConfig(block.config);
  const counters = all.filter((b) => b.kind === 'counter');
  const source = cfg.source ? counters.find((b) => b.uuid === cfg.source) : undefined;
  const value = source ? counterData(source.data).value : counterData(block.data).value;
  const ratio = Math.max(0, Math.min(1, value / cfg.goal));
  return (
    <View style={{ gap: 12 }}>
      <View
        style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}
      >
        <Text testID="tr-progress-text" style={{ color: ht.text, fontSize: 22, fontWeight: '700' }}>
          {t('tracker.p_of', { a: fmtNum(value), b: fmtNum(cfg.goal) })}
          {cfg.unit ? ` ${cfg.unit}` : ''}
        </Text>
        <Text style={{ color: ht.text2, fontWeight: '600' }}>{Math.round(ratio * 100)}%</Text>
      </View>
      <View
        style={{ height: 10, borderRadius: 5, backgroundColor: ht.surface3, overflow: 'hidden' }}
      >
        <View
          testID="tr-progress-bar"
          style={{ width: `${ratio * 100}%`, height: '100%', backgroundColor: ht.accent }}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Text style={{ color: ht.text2 }}>{t('tracker.p_goal')}</Text>
        <TextInput
          key={`g:${cfg.goal}`}
          testID="tr-progress-goal"
          defaultValue={fmtNum(cfg.goal)}
          keyboardType="decimal-pad"
          onEndEditing={(e) => {
            const n = Number(e.nativeEvent.text.replace(',', '.'));
            if (Number.isFinite(n) && n > 0 && n !== cfg.goal)
              onSave({ config: { ...cfg, goal: n } });
          }}
          style={{
            width: 80,
            minHeight: 44,
            color: ht.text,
            borderBottomWidth: 1,
            borderColor: ht.hairline2,
          }}
        />
        {!source ? (
          <>
            <Text style={{ color: ht.text2 }}>{t('tracker.p_done')}</Text>
            <TextInput
              key={`v:${value}`}
              testID="tr-progress-value"
              defaultValue={fmtNum(value)}
              keyboardType="decimal-pad"
              onEndEditing={(e) => {
                const n = Number(e.nativeEvent.text.replace(',', '.'));
                if (Number.isFinite(n) && n !== value) onSave({ data: { value: n } });
              }}
              style={{
                width: 80,
                minHeight: 44,
                color: ht.text,
                borderBottomWidth: 1,
                borderColor: ht.hairline2,
              }}
            />
          </>
        ) : null}
      </View>
      {counters.length ? (
        <View style={{ gap: 6 }}>
          <Text style={{ color: ht.text2, fontSize: 13 }}>{t('tracker.p_source')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Btn
              small
              label={t('tracker.p_by_hand')}
              tone={cfg.source ? 'plain' : 'primary'}
              onPress={() => onSave({ config: { ...cfg, source: null } })}
              testID="tr-progress-src-none"
            />
            {counters.map((c) => (
              <Btn
                key={c.uuid}
                small
                label={c.title || t('tracker.k_counter')}
                tone={cfg.source === c.uuid ? 'primary' : 'plain'}
                onPress={() => onSave({ config: { ...cfg, source: c.uuid } })}
                testID={`tr-progress-src-${c.uuid}`}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Voci con la spunta. */
export function ChecklistBlock({ block, onSave }: BlockProps) {
  const ht = usePlanTheme();
  const { t } = useTranslation();
  const { items } = checklistData(block.data);
  const [text, setText] = useState('');
  const done = items.filter((i) => i.done).length;
  const add = () => {
    const v = text.trim().slice(0, 200);
    if (!v || items.length >= 500) return;
    setText('');
    onSave({ data: { items: [...items, { id: uuidv7(), text: v, done: false }] } });
  };
  return (
    <View style={{ gap: 6 }}>
      {items.length ? (
        <Text testID="tr-check-count" style={{ color: ht.text2, fontSize: 13 }}>
          {t('tracker.l_n_of_m', { n: done, m: items.length })}
        </Text>
      ) : null}
      {items.map((it) => (
        <View key={it.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Check
              testID={`tr-item-${it.id}`}
              on={it.done}
              label={it.text}
              onChange={(v) =>
                onSave({
                  data: { items: items.map((x) => (x.id === it.id ? { ...x, done: v } : x)) },
                })
              }
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('tracker.l_remove_item')}
            hitSlop={8}
            onPress={() => onSave({ data: { items: items.filter((x) => x.id !== it.id) } })}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: ht.text3, fontSize: 18 }}>✕</Text>
          </Pressable>
        </View>
      ))}
      <TextInput
        testID="tr-item-new"
        value={text}
        onChangeText={setText}
        onSubmitEditing={add}
        returnKeyType="done"
        placeholder={t('tracker.l_add_ph')}
        placeholderTextColor={ht.text3}
        style={{ minHeight: 44, color: ht.text, borderBottomWidth: 1, borderColor: ht.hairline2 }}
      />
    </View>
  );
}

/** Testo libero. */
export function NoteBlock({ block, onSave }: BlockProps) {
  const ht = usePlanTheme();
  const { t } = useTranslation();
  const { text } = noteData(block.data);
  return (
    <TextInput
      key={`n:${text.length}:${text.slice(-8)}`}
      testID="tr-note"
      defaultValue={text}
      multiline
      placeholder={t('tracker.n_ph')}
      placeholderTextColor={ht.text3}
      onEndEditing={(e) => {
        const v = e.nativeEvent.text.slice(0, 20000);
        if (v !== text) onSave({ data: { text: v } });
      }}
      style={{
        minHeight: 110,
        color: ht.text,
        fontSize: 15,
        lineHeight: 22,
        textAlignVertical: 'top',
      }}
    />
  );
}
