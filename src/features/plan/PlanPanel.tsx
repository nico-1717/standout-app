import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';

import { AutoplanSheet } from './AutoplanSheet';
import { DailySheet } from './DailySheet';
import { DaySheet, type DayRow } from './DaySheet';
import { GoalEditor, type EditorMode } from './GoalEditor';
import { PlanCalendar } from './PlanCalendar';
import { PlanOverview } from './PlanOverview';
import { PlanTimeline } from './PlanTimeline';
import { PlanToday } from './PlanToday';
import type { AutoplanSummary } from './repo';
import { TimeSheet } from './TimeSheet';
import { calendarView, masterView, todayView } from './view';

export type PlanTab = 'today' | 'cal' | 'line' | 'plan';
const TABS: { id: PlanTab; key: string }[] = [
  { id: 'today', key: 'piano.tab_oggi' },
  { id: 'cal', key: 'piano.tab_calendario' },
  { id: 'line', key: 'piano.tab_linea' },
  { id: 'plan', key: 'piano.tab_piano' },
];
export const isPlanTab = (x: unknown): x is PlanTab =>
  x === 'today' || x === 'cal' || x === 'line' || x === 'plan';

interface DayOpen {
  day: string;
  sel: string | null;
}

/**
 * Il contenuto della pagina «Piano» (piano.js del sito): Oggi, Calendario, Linea del tempo e Panoramica, con le schede
 * (tempo libero, «Pianifica per me», giorno, «ogni giorno»). Con `scope` si vede solo il calendario di quel progetto e dei
 * suoi figli. Sta dentro la pagina Progetti (come sul sito) e dentro la pagina Piano da sola.
 */
export function PlanPanel({
  scope,
  initialTab,
  initialSel,
  timeOpen,
  onTimeOpen,
  onTimeClose,
  headRight,
}: {
  scope: string | null;
  initialTab?: PlanTab;
  initialSel?: string | null;
  timeOpen: boolean;
  onTimeOpen: () => void;
  onTimeClose: () => void;
  /** a destra della prima riga di pastiglie del calendario (nella pagina del progetto: il tasto «Piano») */
  headRight?: ReactNode;
}) {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { services, version, changed } = useApp();
  const [tab, setTab] = useState<PlanTab>(initialTab ?? (scope ? 'cal' : 'today'));
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
  const openProject = (project: string) =>
    router.push({ pathname: '/projects', params: { id: project } });
  const openPomodoro = (project: string, minutes: number, autoStart = false) =>
    router.push({
      pathname: '/pomodoro',
      params: {
        project,
        min: String(Math.min(600, Math.max(1, minutes))),
        ...(autoStart ? { auto: '1' } : {}),
      },
    });

  const preview = () => setAuto({ summary: repo.autoplan(scope, false), done: false });
  const apply = () => {
    const summary = repo.autoplan(scope, true);
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

  const current: PlanTab = scope ? 'cal' : tab;

  return (
    <View style={{ gap: 14 }}>
      {scope ? null : (
        <View
          accessibilityRole="tablist"
          style={{
            flexDirection: 'row',
            padding: 3,
            gap: 2,
            borderRadius: 11,
            backgroundColor: th.scheme === 'dark' ? 'rgba(235,235,245,.10)' : 'rgba(28,28,30,.07)',
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
                flex: 1,
                minHeight: 34,
                paddingHorizontal: 4,
                borderRadius: 9,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: current === x.id ? th.surface : 'transparent',
              }}
            >
              <Text
                style={{
                  color: current === x.id ? th.text : th.text2,
                  fontSize: 13.5,
                  fontWeight: '600',
                  textAlign: 'center',
                }}
              >
                {t(x.key)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

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
          scope={scope}
          initialSel={initialSel ?? scope}
          changed={changed}
          onDay={(d, sel) => setDay({ day: d, sel })}
          onEditHours={(project) => setEditor({ mode: 'goal', project })}
          onAutoplan={preview}
          headRight={headRight}
        />
      ) : null}
      {current === 'line' ? (
        <PlanTimeline
          repo={repo}
          projects={projects}
          version={version}
          lang={lang}
          onOpen={openProject}
        />
      ) : null}
      {current === 'plan' ? (
        <PlanOverview
          view={data.master}
          lang={lang}
          onOpen={openProject}
          onTime={onTimeOpen}
          onAutoplan={preview}
        />
      ) : null}

      <TimeSheet
        visible={timeOpen}
        settings={repo.settings()}
        lang={lang}
        onSave={(s) => {
          repo.saveSettings(s);
          changed();
          onTimeClose();
        }}
        onClose={onTimeClose}
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
