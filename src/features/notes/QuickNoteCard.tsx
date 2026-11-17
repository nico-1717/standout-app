import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { mix } from '@/features/buy/buyTheme';
import type { TodoTheme } from '@/features/tasks/todoTheme';

import { DEFAULT_CATEGORY_COLOR, type BuyCategory } from '@/features/buy/logic';
import { localToday } from '@/features/tasks/groups';

import { NOTE_MAX } from './quickNote';
import { itemFromLine, inputOf, noteAfter, toSave, type SortItem } from './sort';
import { SortModal } from './SortModal';

/** Le righe che lo smistamento vede: senza vuote, senza puntini o numeri davanti (righeDi di todo_nota.js). */
export function noteLines(text: string): { orig: number; text: string }[] {
  const out: { orig: number; text: string }[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const clean = raw.replace(/^[\s\-•*·]+|^\d{1,2}[.)]\s+/, '').trim();
    if (clean && out.length < 80) out.push({ orig: i, text: clean.slice(0, 300) });
  });
  return out;
}

const SAVE_DELAY_MS = 700;

/**
 * La nota veloce in cima al To do: si tocca, si scrive, basta. Si salva da sola — subito sul telefono, poco dopo
 * sul server — e non c'è un tasto «salva» da dimenticare.
 */
export function QuickNoteCard({ td, paper }: { td: TodoTheme; paper: boolean }) {
  const { t } = useTranslation();
  const { services, version, changed, localPrefs, updateLocalPrefs } = useApp();
  const collapsed = localPrefs.noteCollapsed;
  const [text, setText] = useState(() => services?.notes.read() ?? '');
  const [focused, setFocused] = useState(false);
  const [status, setStatus] = useState<'' | 'saving' | 'saved'>('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTimer = useRef(false);
  const [sorting, setSorting] = useState<{ items: SortItem[]; cats: BuyCategory[] } | null>(null);
  const [notice, setNotice] = useState('');

  // Una nota arrivata dal server (o da uno smistamento) si vede, ma mai mentre si sta scrivendo.
  useEffect(() => {
    if (!services || focused || hasTimer.current) return;
    const stored = services.notes.read();
    setText((cur) => (cur === stored ? cur : stored));
  }, [services, version, focused]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function flush() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    hasTimer.current = false;
    changed(); // avvia l'invio al server
    setStatus('saved');
    setTimeout(() => setStatus((s) => (s === 'saved' ? '' : s)), 1800);
  }

  function onChange(v: string) {
    setText(v);
    services?.notes.write(v); // subito sul telefono
    setStatus('saving');
    hasTimer.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }

  function openSort() {
    if (!services) return;
    if (timer.current) flush();
    const cats = services.categories.list();
    const now = new Date();
    const pad = (v: number) => String(v).padStart(2, '0');
    const at = {
      date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    };
    setSorting({
      items: noteLines(services.notes.read()).map((l) => itemFromLine(l, at, cats)),
      cats,
    });
  }

  function saveSort(items: SortItem[]) {
    if (!services || !sorting) return;
    const made = new Map<string, string>(); // nome nuovo → uuid, così due voci con la stessa categoria nuova ne fanno una
    const saved = new Set<SortItem>();
    let failed = 0;
    for (const it of toSave(items)) {
      try {
        const { listType, input } = inputOf(it);
        if (listType === 'buy') {
          let cat = it.catUuid;
          if (it.newCategory) {
            const key = it.newCategory.toLowerCase();
            if (!made.has(key))
              made.set(key, services.categories.create(it.newCategory, DEFAULT_CATEGORY_COLOR));
            cat = made.get(key)!;
          }
          services.tasks.create({ ...input, buy_category_uuid: cat }, { listType });
        } else {
          services.tasks.create(input, { listType });
        }
        saved.add(it);
      } catch {
        failed++;
      }
    }
    const rest = noteAfter(services.notes.read(), items, saved);
    services.notes.write(rest);
    setText(rest);
    setSorting(null);
    setNotice(
      failed
        ? t('todo.nota_fatto_parziale', { n: saved.size, f: failed })
        : t(saved.size === 1 ? 'todo.nota_fatto_1' : 'todo.nota_fatto_n', { n: saved.size }),
    );
    setTimeout(() => setNotice(''), 3200);
    changed();
  }

  const lines = noteLines(text);
  const n = lines.length;
  const mono = paper ? td.serif : undefined;
  // la carta scura ha il fondo scuro: il testo deve chiarirsi anche lì (prima restava marrone scuro e non si leggeva)
  const dark = td.dark;
  const gold = dark ? '#E5CB7A' : '#A8873A';
  const goldInk = dark ? '#E5CB7A' : '#8F7835';
  const ink = dark ? td.ink : '#4A443D';

  return (
    <View
      testID="quick-note"
      style={[
        styles.box,
        {
          backgroundColor: mix('#F2D98A', td.card, dark ? 0.12 : 0.2),
          boxShadow: focused
            ? 'inset 0 0 0 1.4px rgba(217,184,79,.65), 0 12px 26px -16px rgba(74,68,61,.38)'
            : 'inset 0 0 0 0.5px rgba(217,184,79,.3), 0 8px 20px -16px rgba(74,68,61,.3)',
        },
      ]}
    >
      <View style={styles.head}>
        <Svg width={16} height={16} viewBox="0 0 24 24">
          <Path
            d="M6 3.5h8l4 4V20a.5.5 0 01-.5.5h-11A.5.5 0 016 20zM14 3.5V8h4M9 12.5h6M9 16h6"
            stroke={gold}
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
        <Text style={[styles.title, { color: goldInk }]}>{t('todo.nota_titolo')}</Text>
        <Text testID="note-status" style={[styles.status, { color: gold }]}>
          {collapsed && n > 0
            ? t(n === 1 ? 'todo.nota_riga_1' : 'todo.nota_righe_n', { n })
            : status === 'saving'
              ? t('todo.nota_salvo')
              : status === 'saved'
                ? t('todo.nota_salvata')
                : ''}
        </Text>
        <Pressable
          testID="note-collapse"
          accessibilityRole="button"
          accessibilityLabel={t(collapsed ? 'todo.nota_espandi' : 'todo.nota_comprimi')}
          accessibilityState={{ expanded: !collapsed }}
          hitSlop={10}
          onPress={() => {
            if (!collapsed && hasTimer.current) flush();
            updateLocalPrefs({ noteCollapsed: !collapsed });
          }}
          style={styles.fold}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path
              d={collapsed ? 'M7 10l5 5 5-5' : 'M7 14l5-5 5 5'}
              stroke={gold}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </Pressable>
      </View>
      {collapsed ? null : (
        <TextInput
          testID="note-input"
          value={text}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (hasTimer.current) flush();
          }}
          placeholder={t('todo.nota_ph')}
          placeholderTextColor={dark ? 'rgba(229,203,122,.55)' : 'rgba(143,120,53,.6)'}
          multiline
          maxLength={NOTE_MAX}
          scrollEnabled
          style={[styles.input, { color: ink, fontFamily: mono }]}
        />
      )}
      {!collapsed && n > 0 && (
        <View
          style={[styles.foot, { borderTopWidth: 0.5, borderTopColor: 'rgba(217,184,79,.28)' }]}
        >
          <Text testID="note-count" style={{ color: gold, fontSize: 12, marginRight: 'auto' }}>
            {t(n === 1 ? 'todo.nota_riga_1' : 'todo.nota_righe_n', { n })}
          </Text>
          <Pressable
            testID="note-sort"
            accessibilityRole="button"
            onPress={openSort}
            style={({ pressed }) => [
              styles.btn,
              {
                backgroundColor: dark ? 'rgba(255,255,255,.1)' : 'rgba(255,253,250,.75)',
                transform: [{ scale: pressed ? 0.95 : 1 }],
              },
              dark ? null : { boxShadow: 'inset 0 0 0 0.5px rgba(217,184,79,.4)' },
            ]}
          >
            <Text style={{ color: dark ? td.ink : '#6F5E2C', fontSize: 13 }}>
              {t('todo.nota_mano')}
            </Text>
          </Pressable>
        </View>
      )}
      {notice && !collapsed ? (
        <Text testID="note-notice" style={{ color: td.accent, fontSize: 13, marginTop: 6 }}>
          {notice}
        </Text>
      ) : null}
      {sorting ? (
        <SortModal
          td={td}
          paper={paper}
          initial={sorting.items}
          cats={sorting.cats}
          today={localToday()}
          onCancel={() => setSorting(null)}
          onSave={saveSort}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 10,
    marginBottom: 18,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  title: { fontSize: 10.5, letterSpacing: 1.7, textTransform: 'uppercase', fontWeight: '500' },
  status: { marginLeft: 'auto', fontSize: 11.5 },
  fold: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', marginRight: -4 },
  input: { minHeight: 46, maxHeight: 260, fontSize: 16, lineHeight: 24, paddingVertical: 4 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 6 },
  btn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 },
});
