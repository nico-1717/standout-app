import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { AutoplanSheet } from '@/features/plan/AutoplanSheet';
import { DailySheet } from '@/features/plan/DailySheet';
import { DaySheet, type DayRow } from '@/features/plan/DaySheet';
import { GoalEditor, type EditorMode } from '@/features/plan/GoalEditor';
import { PlanCalendar } from '@/features/plan/PlanCalendar';
import { PlanOverview } from '@/features/plan/PlanOverview';
import { PlanTimeline } from '@/features/plan/PlanTimeline';
import { PlanToday } from '@/features/plan/PlanToday';
import type { AutoplanSummary } from '@/features/plan/repo';
import { TimeSheet } from '@/features/plan/TimeSheet';
import { calendarView, masterView, todayView } from '@/features/plan/view';
import { Header } from '@/ui/kit';

type Tab = 'today' | 'cal' | 'line' | 'plan';
const TABS: { id: Tab; key: string }[] = [
  { id: 'today', key: 'piano.tab_oggi' },
  { id: 'cal', key: 'piano.tab_calendario' },
  { id: 'line', key: 'piano.tab_linea' },
  { id: 'plan', key: 'piano.tab_piano' },
];
const isTab = (x: unknown): x is Tab =>
  x === 'today' || x === 'cal' || x === 'line' || x === 'plan';

interface DayOpen {
  day: string;
  sel: string | null;
}

/**
 * La pagina «Piano» (piano.js del sito): Oggi, Calendario, Linea del tempo e Panoramica. Con `project` si vede solo il
 * calendario di quel progetto e dei suoi figli. Qui vivono le schede (tempo libero, «Pianifica per me», giorno, «ogni giorno»).
 */
export default function PlanScreen() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services, version, changed } = useApp();
  const params = useLocalSearchParams<{ tab?: string; project?: string; sel?: string }>();
  const scoped = typeof params.project === 'string' ? params.project : null;
  const [tab, setTab] = useState<Tab>(isTab(params.tab) ? params.tab : scoped ? 'cal' : 'today');
  const [showTime, setShowTime] = useState(false);
  const [auto, setAuto] = useState<{ summary: AutoplanSummary; done: boolean } | null>(null);
  const [day, setDay] = useState<DayOpen | null>(null);
  const [daily, setDaily] = useState<{ project: string; name: string; minutes: number } | null>(
    null,
  );
  const [editor, setEditor] = useState<{ mode: EditorMode | null; project: string | null }>({
    mode: null,
    project: null,
  });
  const repo = services?.plan ?? null;
  const projects = useMemo(() => {
    void version;
    return services?.projects.all() ?? [];
  }, [services, version]);

  const lang = i18n.language || 'it';
  const data = useMemo(() => {
    void version;
    if (!repo) return null;
    return {
      today: todayView(repo, projects),
      master: masterView(repo, projects),
    };
  }, [repo, projects, version]);
  if (!repo || !data) return null;

  const nameOf = (id: string) => projects.find((p) => p.uuid === id)?.name ?? '';
  const openPomodoro = (project: string, minutes: number, autoStart = false) =>
    router.push({
      pathname: '/pomodoro',
      params: {
        project,
        min: String(Math.min(600, Math.max(1, minutes))),
        ...(autoStart ? { auto: '1' } : {}),
      },
    });

  const preview = () => setAuto({ summary: repo.autoplan(scoped, false), done: false });
  const apply = () => {
    const summary = repo.autoplan(scoped, true);
    changed();
    setAuto({ summary, done: true });
  };

  const dayRows = (d: string): DayRow[] => {
    const cv = calendarView(repo, projects, null, d, d);
    const byId = new Map(cv.nodes.map((n) => [n.project, n]));
    return cv.plan
      .filter((b) => b.day === d)
      .map((b) => ({
        project: b.project,
        name: byId.get(b.project)?.name ?? '',
        color: byId.get(b.project)?.color ?? '#8E8E93',
        kind: b.kind,
        minutes: b.minutes,
        source: b.source,
        done: cv.done.get(d)?.get(b.project) ?? 0,
      }));
  };

  const dayCap = (d: string) => {
    const cv = calendarView(repo, projects, null, d, d);
    return {
      cap: cv.cap.get(d)?.cap ?? 0,
      busy: cv.cap.get(d)?.busy ?? 0,
      painted: (id: string) => cv.paint.get(id)?.has(d) ?? false,
    };
  };

  const title = scoped ? nameOf(scoped) || t('progetti.piano_titolo') : t('progetti.piano_titolo');
  const current: Tab = scoped ? 'cal' : tab;

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        top={insets.top}
        title={title}
        right={
          <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
            <Pressable
              testID="plan-time"
              accessibilityRole="button"
              accessibilityLabel={t('piano.il_tuo_tempo')}
              onPress={() => setShowTime(true)}
            >
              <Text style={{ color: th.brand, fontSize: 18 }}>⏱</Text>
            </Pressable>
            <Pressable testID="plan-close" accessibilityRole="button" onPress={() => router.back()}>
              <Text style={{ color: th.brand, fontSize: 17 }}>✕</Text>
            </Pressable>
          </View>
        }
      />
      {scoped ? null : (
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            paddingHorizontal: 16,
            paddingTop: 12,
            flexWrap: 'wrap',
          }}
        >
          {TABS.map((x) => (
            <Pressable
              key={x.id}
              testID={`plan-tab-${x.id}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: current === x.id }}
              onPress={() => setTab(x.id)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 999,
                backgroundColor: current === x.id ? th.brand : th.surface2,
              }}
            >
              <Text style={{ color: current === x.id ? '#fff' : th.text, fontWeight: '600' }}>
                {t(x.key)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        {current === 'today' ? (
          <PlanToday
            view={data.today}
            lang={lang}
            onStart={(project, minutes, isDaily) =>
              isDaily
                ? setDaily({ project, name: nameOf(project), minutes })
                : openPomodoro(project, minutes)
            }
            onMove={(project, to) => {
              repo.skipFix(project, 'move', to);
              changed();
            }}
            onLeave={(project) => {
              repo.skipFix(project, 'leave');
              changed();
            }}
            onAutoplan={preview}
          />
        ) : null}
        {current === 'cal' ? (
          <PlanCalendar
            repo={repo}
            projects={projects}
            version={version}
            lang={lang}
            scope={scoped}
            initialSel={typeof params.sel === 'string' ? params.sel : scoped}
            changed={changed}
            onDay={(d, sel) => setDay({ day: d, sel })}
            onEditHours={(project) => setEditor({ mode: 'goal', project })}
            onAutoplan={preview}
          />
        ) : null}
        {current === 'line' ? (
          <PlanTimeline
            repo={repo}
            projects={projects}
            version={version}
            lang={lang}
            onOpen={(project) => router.push({ pathname: '/project', params: { id: project } })}
          />
        ) : null}
        {current === 'plan' ? (
          <PlanOverview
            view={data.master}
            lang={lang}
            onOpen={(project) => router.push({ pathname: '/project', params: { id: project } })}
            onTime={() => setShowTime(true)}
            onAutoplan={preview}
          />
        ) : null}
      </ScrollView>

      <TimeSheet
        visible={showTime}
        settings={repo.settings()}
        lang={lang}
        onSave={(s) => {
          repo.saveSettings(s);
          changed();
          setShowTime(false);
        }}
        onClose={() => setShowTime(false)}
      />
      <AutoplanSheet
        visible={auto !== null}
        summary={auto?.summary ?? null}
        names={new Map(projects.map((p) => [p.uuid, p.name]))}
        lang={lang}
        done={auto?.done ?? false}
        onApply={apply}
        onClose={() => setAuto(null)}
      />
      {day ? (
        <DaySheet
          visible
          day={day.day}
          lang={lang}
          cap={dayCap(day.day).cap}
          busy={dayCap(day.day).busy}
          capOverridden={day.day in repo.settings().stored.overrides}
          rows={dayRows(day.day)}
          focus={
            day.sel
              ? {
                  uuid: day.sel,
                  name: nameOf(day.sel),
                  painted: dayCap(day.day).painted(day.sel),
                }
              : null
          }
          onSetBlock={(project, minutes) => {
            repo.setDay(project, day.day, minutes);
            changed();
          }}
          onAddBlock={(project) => {
            const now = dayRows(day.day)
              .filter((r) => r.project === project && r.kind === 'study')
              .reduce((a, r) => a + r.minutes, 0);
            repo.setDay(project, day.day, now + 30);
            changed();
          }}
          onSetCap={(minutes) => {
            repo.setDayCapacity(day.day, minutes);
            changed();
          }}
          onTogglePaint={() => {
            if (!day.sel) return;
            repo.paint(day.sel, dayCap(day.day).painted(day.sel) ? 'remove' : 'add', [day.day]);
            changed();
          }}
          onStart={(project, minutes) => {
            setDay(null);
            openPomodoro(project, minutes);
          }}
          onClose={() => setDay(null)}
        />
      ) : null}
      {daily ? (
        <DailySheet
          visible
          name={daily.name}
          minutes={daily.minutes}
          now={new Date()}
          onStart={() => {
            const d = daily;
            setDaily(null);
            openPomodoro(d.project, d.minutes, true);
          }}
          onLog={(start) => {
            repo.dailyLog(daily.project, start);
            changed();
            setDaily(null);
          }}
          onClose={() => setDaily(null)}
        />
      ) : null}
      <GoalEditor
        repo={repo}
        projects={projects}
        project={editor.project}
        mode={editor.mode}
        changed={changed}
        onMode={(mode, project) => setEditor({ mode, project })}
      />
    </View>
  );
}
