import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { DayPage, dateParts } from '@/features/diary/DayPage';
import { FacePop, FontPop, HabitsSummary } from '@/features/diary/DiaryParts';
import { diaryTheme } from '@/features/diary/diaryTheme';
import type { DiaryItem, ListType } from '@/features/diary/logic';
import { monthEnd, weekStart } from '@/features/diary/logic';
import { MonthPage } from '@/features/diary/MonthPage';
import { addDaysIso, localToday } from '@/features/tasks/groups';

/** Un passo da annullare: la chiave unisce le scritture ravvicinate (un testo scritto di getto è un solo «annulla»). */
interface Undo {
  key: string;
  label: string;
  at: number;
  revert: () => void;
}

/** La pagina Diario: un quaderno con una pagina per giorno. Si sfoglia con lo scorrimento e si salva da sé. */
export default function DiaryScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services, version, changed, uiStyle, diarySettings, updateDiarySettings } = useApp();
  const params = useLocalSearchParams<{ data?: string }>();
  const today = localToday();
  const d = diaryTheme(uiStyle, th, diarySettings);
  const std = d.style === 'standard';

  const [date, setDate] = useState(
    typeof params.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.data)
      ? params.data
      : today,
  );
  const [view, setView] = useState<'day' | 'month'>('day');
  const [cursor, setCursor] = useState(date.slice(0, 7));
  const [facePop, setFacePop] = useState<'mood' | 'energy' | null>(null);
  const [fontPop, setFontPop] = useState(false);
  const [summary, setSummary] = useState(false);
  const [undo, setUndo] = useState<Undo[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const seq = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const diary = services?.diary;
  // `version` cambia a ogni modifica (locale o dal server): è ciò che fa rileggere.
  const day = useMemo(
    () => (diary ? diary.day(date) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [diary, date, version],
  );
  const extras = useMemo(() => {
    if (!diary || !services) return null;
    const from =
      weekStart(date) < `${date.slice(0, 7)}-01` ? weekStart(date) : `${date.slice(0, 7)}-01`;
    const wEnd = addDaysIso(weekStart(date), 6);
    const mEnd = monthEnd(date);
    const to = wEnd > mEnd ? wEnd : mEnd;
    return diary.extras(date, services.habits.list(), services.habits.logsBetween(from, to));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diary, services, date, version]);
  const month = useMemo(
    () => (diary && view === 'month' ? diary.month(cursor) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [diary, view, cursor, version],
  );

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => t(`diario.mese_${i + 1}`)),
    [t],
  );
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => t(`diario.gg_${i + 1}`)), [t]);
  const weekdaysShort = useMemo(
    () => Array.from({ length: 7 }, (_, i) => t(`diario.ggs_${i + 1}`)),
    [t],
  );

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const say = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const pushUndo = (key: string, label: string, revert: () => void) =>
    setUndo((u) => {
      const now = Date.now();
      const top = u[u.length - 1];
      // scritture ravvicinate sullo stesso campo: resta il «prima» più vecchio
      if (top && top.key === key && now - top.at < 8000)
        return [...u.slice(0, -1), { ...top, at: now }];
      return [...u.slice(-39), { key, label, at: now, revert }];
    });

  const turnPage = useCallback(
    (delta: number) => {
      Keyboard.dismiss(); // chiude il campo: quello che stai scrivendo si salva
      if (view === 'month') {
        setCursor((c) => {
          const p = dateParts(`${c}-01`);
          const n = new Date(Date.UTC(p.y, p.m - 1 + delta, 1));
          return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}`;
        });
      } else {
        setDate((x) => addDaysIso(x, delta));
      }
    },
    [view],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > 30 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
        onPanResponderRelease: (_e, g) => {
          if (Math.abs(g.dx) < 50 || Math.abs(g.dy) > Math.abs(g.dx)) return;
          turnPage(g.dx < 0 ? 1 : -1);
        },
      }),
    [turnPage],
  );

  if (!diary || !day || !extras) return <View style={{ flex: 1, backgroundColor: d.page }} />;

  const label = (key: string) => t(key);

  const onFace = (kind: 'mood' | 'energy', level: number | null) => {
    const before = kind === 'mood' ? day.mood : day.energy;
    const set = (v: number | null) =>
      kind === 'mood' ? diary.setMood(date, v) : diary.setEnergy(date, v);
    set(level);
    changed();
    setFacePop(null);
    pushUndo(
      `${kind}:${++seq.current}`,
      label(kind === 'mood' ? 'diario.com_e_andata_u' : 'diario.l_energia_u'),
      () => {
        set(before);
        changed();
      },
    );
  };

  const onNote = (text: string) => {
    const before = day.note;
    if (text === before) return;
    diary.setNote(date, text);
    changed();
    pushUndo(`note:${date}`, label('diario.la_scrittura_u'), () => {
      diary.setNote(date, before);
      changed();
    });
  };

  const onItem = (type: ListType, item: DiaryItem | null, text: string) => {
    const name = label(type === 'good' ? 'diario.cosa_bella' : 'diario.cosa_imparata');
    const clean = text.trim();
    if (!item) {
      const id = diary.addItem(date, type, clean);
      if (!id) return;
      changed();
      pushUndo(`item:${id}`, name, () => {
        diary.removeItem(id);
        changed();
      });
      return;
    }
    if (clean === item.content) return;
    const before = item.content;
    if (!clean) {
      diary.removeItem(item.uuid);
      changed();
      pushUndo(`item:${item.uuid}`, name, () => {
        diary.addItem(date, type, before);
        changed();
      });
      return;
    }
    diary.editItem(item.uuid, clean);
    changed();
    pushUndo(`item:${item.uuid}`, name, () => {
      diary.editItem(item.uuid, before);
      changed();
    });
  };

  const doUndo = () => {
    const step = undo[undo.length - 1];
    if (!step) return;
    setUndo(undo.slice(0, -1));
    step.revert();
    say(t('diario.annullato', { cosa: step.label }));
  };

  const goToday = () => {
    if (view === 'month') return setCursor(today.slice(0, 7));
    if (date === today) return say(t('diario.gia_su_oggi'));
    setDate(today);
  };

  const parts = dateParts(date);
  const summaryData = { habits: extras.habits, weekly: extras.weekly };
  return (
    <View style={{ flex: 1, backgroundColor: d.page }} {...pan.panHandlers}>
      {!std && (
        <View
          pointerEvents="none"
          style={[styles.spine, { backgroundColor: 'rgba(74,68,61,0.07)' }]}
        />
      )}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingTop: insets.top + 14,
            paddingHorizontal: 18,
            paddingBottom: 96 + insets.bottom,
          }}
        >
          {view === 'day' ? (
            <DayPage
              key={date}
              d={d}
              paper={diarySettings.paper}
              day={day}
              rings={extras.rings}
              months={months}
              weekdays={weekdays}
              onMood={() => setFacePop('mood')}
              onEnergy={() => setFacePop('energy')}
              onNote={onNote}
              onItem={onItem}
              onOpenMonth={() => {
                setCursor(date.slice(0, 7));
                setView('month');
              }}
              onOpenSummary={() => setSummary(true)}
            />
          ) : (
            month && (
              <MonthPage
                d={d}
                month={cursor}
                data={month}
                today={today}
                months={months}
                weekdaysShort={weekdaysShort}
                onBack={() => setView('day')}
                onPickDay={(ds) => {
                  setDate(ds);
                  setView('day');
                }}
              />
            )
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.tools, { paddingBottom: 10 + insets.bottom, backgroundColor: d.page }]}>
        <Tool
          d={d}
          id="diary-back"
          glyph="‹"
          a11y={t('comune.chiudi')}
          onPress={() => router.back()}
        />
        <Tool
          d={d}
          id="diary-undo"
          glyph="↶"
          a11y={t('diario.annulla_l_ultima_cosa')}
          onPress={doUndo}
          disabled={undo.length === 0}
        />
        <Tool
          d={d}
          id="diary-year"
          glyph="▥"
          a11y={t('diario.dn_apri')}
          onPress={() => router.push('/diary-year')}
        />
        <Tool d={d} id="diary-today" glyph="◎" a11y={t('diario.vai_a_oggi')} onPress={goToday} />
        <Tool
          d={d}
          id="diary-font"
          glyph="Aa"
          a11y={t('diario.scegli_la_scrittura')}
          onPress={() => setFontPop(true)}
        />
      </View>

      {toast && (
        <View
          pointerEvents="none"
          style={[styles.toast, { bottom: 76 + insets.bottom, backgroundColor: d.ink }]}
        >
          <Text style={{ color: d.page, fontSize: 13 }}>{toast}</Text>
        </View>
      )}

      <FacePop
        kind={facePop}
        value={facePop === 'mood' ? day.mood : day.energy}
        d={d}
        onPick={(lv) => facePop && onFace(facePop, lv)}
        onClose={() => setFacePop(null)}
      />
      <FontPop
        visible={fontPop}
        d={d}
        font={diarySettings.font}
        size={diarySettings.size}
        onFont={(font) => updateDiarySettings({ font })}
        onSize={(size) => updateDiarySettings({ size })}
        onClose={() => setFontPop(false)}
      />
      <HabitsSummary
        visible={summary}
        d={d}
        title={t('diario.abitudini')}
        sub={`${weekdays[parts.wd].toLowerCase()} ${parts.d} ${months[parts.m - 1].toLowerCase()}`}
        data={summaryData}
        onClose={() => setSummary(false)}
        onGo={() => {
          setSummary(false);
          router.navigate('/(tabs)/habits');
        }}
      />
    </View>
  );
}

function Tool(p: {
  d: ReturnType<typeof diaryTheme>;
  id: string;
  glyph: string;
  a11y: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      testID={p.id}
      accessibilityRole="button"
      accessibilityLabel={p.a11y}
      disabled={p.disabled}
      onPress={p.onPress}
      style={[styles.tool, p.disabled && { opacity: 0.35 }]}
    >
      <Text style={{ color: p.d.pencil, fontSize: 21 }}>{p.glyph}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  spine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 9, zIndex: 1 },
  tools: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 22,
    paddingTop: 10,
    paddingHorizontal: 18,
  },
  tool: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    opacity: 0.92,
  },
});
