import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import type { TodoTheme } from '@/features/tasks/todoTheme';

import { NOTE_MAX } from './quickNote';

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
export function QuickNoteCard({
  td,
  paper,
  onSort,
}: {
  td: TodoTheme;
  paper: boolean;
  /** «Smista a mano»: riceve le righe lette */
  onSort?: (lines: { orig: number; text: string }[]) => void;
}) {
  const { t } = useTranslation();
  const { services, version, changed } = useApp();
  const [text, setText] = useState(() => services?.notes.read() ?? '');
  const [focused, setFocused] = useState(false);
  const [status, setStatus] = useState<'' | 'saving' | 'saved'>('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTimer = useRef(false);

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

  const lines = noteLines(text);
  const n = lines.length;
  const mono = paper ? td.serif : undefined;

  return (
    <View
      testID="quick-note"
      style={[
        styles.box,
        { backgroundColor: td.panel, borderColor: focused ? td.accent : td.hair },
      ]}
    >
      <View style={styles.head}>
        <Text style={[styles.title, { color: td.ink2 }]}>{t('todo.nota_titolo')}</Text>
        <Text testID="note-status" style={[styles.status, { color: td.ink3 }]}>
          {status === 'saving'
            ? t('todo.nota_salvo')
            : status === 'saved'
              ? t('todo.nota_salvata')
              : ''}
        </Text>
      </View>
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
        placeholderTextColor={td.ink3}
        multiline
        maxLength={NOTE_MAX}
        scrollEnabled
        style={[styles.input, { color: td.ink, fontFamily: mono }]}
      />
      <View style={styles.foot}>
        <Text testID="note-count" style={{ color: td.ink3, fontSize: 12 }}>
          {n ? t(n === 1 ? 'todo.nota_riga_1' : 'todo.nota_righe_n', { n }) : ''}
        </Text>
        {onSort ? (
          <Text
            testID="note-sort"
            accessibilityRole="button"
            accessibilityState={{ disabled: n === 0 }}
            onPress={() => n && onSort(lines)}
            style={{ color: n ? td.accent : td.ink3, fontSize: 13, fontWeight: '500' }}
          >
            {t('todo.nota_mano')}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 18 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '500' },
  status: { fontSize: 11 },
  input: { minHeight: 44, maxHeight: 220, fontSize: 15, lineHeight: 21, paddingTop: 8 },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
