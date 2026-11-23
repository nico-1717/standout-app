import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import type { Project } from '@/features/projects/logic';
import { Card, TextButton } from '@/ui/kit';
import { haptic } from '@/ui/motion';

import {
  branchOf,
  chipRows,
  gridRange,
  inkOn,
  isAncestorOfSel,
  legendDays,
  lineSegments,
  shiftMonth,
} from './calendarGrid';
import { dayMarks } from './calendarMarks';
import { CalendarLegend, CalendarLines } from './CalendarLines';
import { DayCell } from './DayCell';
import { useFloatingDock } from './dockHost';
import { addDays } from './engine';
import { hours, monthLabel, shortHours, weekdayName } from './format';
import { usePaintGesture } from './paintGesture';
import { PlanDock, type Tool } from './PlanDock';
import type { PlanRepo } from './repo';
import { calendarView, type CalendarNode } from './view';

export type { Tool };

interface Undo {
  project: string;
  mode: 'add' | 'remove';
  days: string[];
}

/**
 * Il calendario con l'evidenziatore (renderCalendar del sito): scegli un progetto, poi tocca i giorni (o trascina in
 * orizzontale) per evidenziarli; «Cancella» toglie, «Guarda» apre il giorno. Sotto, il riassunto del progetto scelto, gli
 * eventi importanti del planner e la barra con Annulla e «Pianifica».
 */
export function PlanCalendar(p: {
  repo: PlanRepo;
  projects: Project[];
  version: number;
  lang: string;
  /** il progetto di cui si vede il ramo (null = tutti) */
  scope: string | null;
  initialSel?: string | null;
  changed: () => void;
  onDay: (day: string, sel: string | null) => void;
  onEditHours: (project: string) => void;
  onAutoplan: () => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const today = p.repo.today();
  const [month, setMonth] = useState(`${today.slice(0, 7)}-01`);
  const [sel, setSel] = useState<string | null>(p.initialSel ?? null);
  const [tool, setTool] = useState<Tool>('paint');
  const [showEv, setShowEv] = useState(false);
  const [undo, setUndo] = useState<Undo[]>([]);
  const [scope, setScope] = useState<string | null>(p.scope);

  const range = gridRange(month);
  const view = useMemo(() => {
    void p.version;
    return calendarView(p.repo, p.projects, scope, range.from, range.to);
  }, [p.repo, p.projects, p.version, scope, range.from, range.to]);
  const events = useMemo(() => {
    void p.version;
    return showEv ? p.repo.importantEvents(range.from, range.to) : [];
  }, [p.repo, p.version, showEv, range.from, range.to]);

  // se il progetto scelto non c'è più (o non è in questo ramo) si torna a «nessuno»
  const nodes = view.nodes;
  const byId = new Map(nodes.map((n) => [n.project, n]));
  const current = sel && byId.has(sel) ? sel : null;
  const rows = chipRows(nodes, current);
  const selNode = current ? byId.get(current)! : null;
  const selColor = selNode?.color ?? '#007AFF';

  const dayMinutes = (day: string, ids: string[]) => {
    const keep = new Set(ids);
    let m = 0;
    for (const b of view.plan) if (b.day === day && keep.has(b.project)) m += b.minutes;
    return m;
  };
  const scopeIds = (scope ? branchOf(nodes, scope) : nodes.map((n) => n.project)) as string[];
  const focusIds = current ? branchOf(nodes, current) : scopeIds;

  const apply = (project: string, mode: 'add' | 'remove', days: string[], record = true) => {
    if (!days.length) return;
    p.repo.paint(project, mode, days);
    if (record)
      setUndo((u) => [...u.slice(-29), { project, mode: mode === 'add' ? 'remove' : 'add', days }]);
    p.changed();
  };
  const doUndo = () => {
    const last = undo[undo.length - 1];
    if (!last) return;
    setUndo(undo.slice(0, -1));
    p.repo.paint(last.project, last.mode, last.days);
    p.changed();
  };

  const tapDay = (day: string) => {
    if (tool === 'look' || !current) {
      p.onDay(day, current);
      return;
    }
    if (day < today) return;
    const on = view.paint.get(current)?.has(day) ?? false;
    haptic.tap();
    if (tool === 'erase') {
      if (on) apply(current, 'remove', [day]);
      return;
    }
    apply(current, on ? 'remove' : 'add', [day]);
  };

  /* ---- il trascinamento in orizzontale: sul thread dell'interfaccia, il primo giorno decide se si accende o si spegne ---- */
  const cells = useMemo(
    () => Array.from({ length: 42 }, (_, i) => addDays(range.from, i)),
    [range.from],
  );
  const painted = current ? view.paint.get(current) : undefined;
  const noDays = useMemo(() => new Set<string>(), []);
  const { repo, changed } = p;
  const onCommit = useCallback(
    (mode: 'add' | 'remove', days: string[]) => {
      if (!current || !days.length) return;
      repo.paint(current, mode, days);
      setUndo((u) => [
        ...u.slice(-29),
        { project: current, mode: mode === 'add' ? 'remove' : 'add', days },
      ]);
      changed();
    },
    [repo, changed, current],
  );
  const paint = usePaintGesture({
    enabled: tool !== 'look' && !!current,
    erase: tool === 'erase',
    cells,
    painted: painted ?? noDays,
    today,
    onCommit,
  });

  const estimate = (() => {
    if (!selNode) return 0;
    const rem = Math.max(0, selNode.minutes - selNode.doneMin);
    if (rem <= 0) return 0;
    let n = 0;
    for (const d of view.paint.get(selNode.project) ?? []) if (d >= today) n++;
    return n > 0 ? Math.round(rem / n / 5) * 5 : 0;
  })();
  const paintedDays = selNode
    ? [...(view.paint.get(selNode.project) ?? [])].filter((d) => d >= today).length
    : 0;

  const chip = (id: string) => {
    const n = byId.get(id)!;
    const on = current === id;
    const trail = !on && isAncestorOfSel(nodes, current, id);
    const inPlan = branchOf(nodes, id).some((x) => (byId.get(x)?.minutes ?? 0) > 0);
    return (
      <Pressable
        key={id}
        testID={`cal-chip-${id}`}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        onPress={() => setSel(on ? null : id)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          minHeight: 38,
          backgroundColor: on ? n.color : trail ? `${n.color}33` : th.surface,
          borderWidth: 1,
          borderColor: on || trail ? n.color : th.hairline2,
          opacity: inPlan || on ? 1 : 0.6,
        }}
      >
        {on ? null : (
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: n.color }} />
        )}
        <Text style={{ color: on ? inkOn(n.color) : th.text, fontWeight: '600' }} numberOfLines={1}>
          {n.name}
        </Text>
        {n.minutes > 0 ? (
          <Text style={{ color: on ? inkOn(n.color) : th.text2, fontSize: 12 }}>
            {hours(n.minutes)}
          </Text>
        ) : null}
      </Pressable>
    );
  };

  // React Compiler memoizza da solo: niente useMemo a mano (la sua regola lo vieta
  // quando una dipendenza deriva da un array ricostruito a ogni render)
  const marks = dayMarks({
    cells,
    nodes,
    current,
    rowIds: rows.flatMap((r) => r.ids),
    paint: view.paint,
    plan: view.plan,
  });
  const segs = lineSegments(marks);
  const names = new Map(nodes.map((n) => [n.project, n]));
  const legend = [...legendDays(marks, cells, month)].map(([id, v]) => ({
    id,
    name: names.get(id)?.name ?? '',
    color: v.color,
    days: v.days,
  }));
  const me = current ? names.get(current) : undefined;
  if (current && me) {
    const n = cells.filter(
      (d) => d.slice(0, 7) === month.slice(0, 7) && (view.paint.get(current)?.has(d) ?? false),
    ).length;
    if (n) legend.unshift({ id: current, name: me.name, color: me.color, days: n });
  }
  const tapRef = useRef<(day: string) => void>(() => undefined);
  useEffect(() => {
    tapRef.current = tapDay;
  });
  const pressDay = useCallback((day: string) => tapRef.current(day), []);

  useFloatingDock(
    <PlanDock
      tool={tool}
      onTool={setTool}
      showEvents={showEv}
      onEvents={() => setShowEv(!showEv)}
      canUndo={undo.length > 0}
      onUndo={doUndo}
      onAutoplan={p.onAutoplan}
    />,
  );

  return (
    <View style={{ gap: 14 }}>
      {scope && scope !== p.scope ? (
        <TextButton
          testID="cal-up"
          label={`‹ ${byId.get(byId.get(scope)?.parent ?? '')?.name ?? ''}`}
          onPress={() => setScope(byId.get(scope)?.parent ?? p.scope)}
        />
      ) : null}
      {rows.map((r, i) => (
        <View key={r.parent ?? 'root'} style={{ gap: 6 }}>
          {r.parent && byId.get(r.parent) ? (
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: byId.get(r.parent)!.color,
                }}
              />
              <Text style={{ color: th.text2, fontSize: 12, fontWeight: '700' }}>
                {byId.get(r.parent)!.name}
              </Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} testID={`cal-row-${i}`}>
            {r.ids.map(chip)}
          </View>
        </View>
      ))}
      {!nodes.length ? <Text style={{ color: th.text2 }}>{t('piano.senza_figli')}</Text> : null}

      <Card style={{ padding: 12, gap: 8 }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Text
            testID="cal-title"
            style={{ color: th.text, fontSize: 20, fontWeight: '800', textTransform: 'capitalize' }}
          >
            {monthLabel(month, p.lang)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Pressable
              testID="cal-prev"
              accessibilityRole="button"
              accessibilityLabel={t('piano.mese_prima')}
              onPress={() => setMonth(shiftMonth(month, -1))}
              style={{ padding: 10 }}
            >
              <Text style={{ color: th.brand, fontSize: 20 }}>‹</Text>
            </Pressable>
            <Pressable
              testID="cal-today"
              accessibilityRole="button"
              onPress={() => setMonth(`${today.slice(0, 7)}-01`)}
              style={{ padding: 10 }}
            >
              <Text style={{ color: th.brand, fontWeight: '700' }}>{t('piano.oggi')}</Text>
            </Pressable>
            <Pressable
              testID="cal-next"
              accessibilityRole="button"
              accessibilityLabel={t('piano.mese_dopo')}
              onPress={() => setMonth(shiftMonth(month, 1))}
              style={{ padding: 10 }}
            >
              <Text style={{ color: th.brand, fontSize: 20 }}>›</Text>
            </Pressable>
          </View>
        </View>
        <View style={{ flexDirection: 'row' }}>
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <Text
              key={d}
              style={{
                flex: 1,
                textAlign: 'center',
                color: th.text3,
                fontSize: 11,
                fontWeight: '700',
              }}
            >
              {weekdayName(d, p.lang, 'short')}
            </Text>
          ))}
        </View>
        <GestureDetector gesture={paint.gesture}>
          <View
            testID="cal-grid"
            onLayout={(e: LayoutChangeEvent) => paint.setWidth(e.nativeEvent.layout.width)}
            style={{ flexDirection: 'row', flexWrap: 'wrap' }}
          >
            {cells.map((d, i) => {
              const inMonth = d.slice(0, 7) === month.slice(0, 7);
              const saved = (current ? view.paint.get(current)?.has(d) : false) ?? false;
              const cp = view.cap.get(d);
              const rest = !!cp && cp.cap === 0 && d >= today;
              const planned = dayMinutes(d, focusIds);
              const done = (() => {
                const m = view.done.get(d);
                if (!m) return false;
                for (const id of focusIds) if ((m.get(id) ?? 0) > 0) return true;
                return false;
              })();
              const evs = events.filter((e) => e.day === d);
              const label =
                planned > 0
                  ? shortHours(planned)
                  : saved && estimate && d >= today
                    ? `~${shortHours(estimate)}`
                    : '';
              return (
                <DayCell
                  key={d}
                  index={i}
                  day={d}
                  saved={saved}
                  selColor={selColor}
                  ink={inkOn(selColor)}
                  textColor={th.text}
                  labelColor={th.text2}
                  restColor={th.surface2}
                  edgeColor={th.brand}
                  checkColor={saved ? inkOn(selColor) : th.green}
                  eventColor={
                    evs.length
                      ? evs.some((e) => e.importance === 'highest')
                        ? '#FF453A'
                        : '#FFD60A'
                      : null
                  }
                  isToday={d === today}
                  fade={!inMonth ? 0.35 : d < today ? 0.6 : 1}
                  rest={rest}
                  label={label}
                  done={done}
                  preview={paint.preview}
                  onPress={pressDay}
                />
              );
            })}
            <CalendarLines segs={segs} />
          </View>
        </GestureDetector>
        <CalendarLegend rows={legend} />
        <Text style={{ color: th.text2, fontSize: 12 }}>{t(`piano.tip_${tool}`)}</Text>
      </Card>

      <Card style={{ padding: 16, gap: 8 }}>
        {!selNode ? (
          <Text testID="cal-summary" style={{ color: th.text, fontWeight: '700' }}>
            {t('piano.nessuna_scelta')}
          </Text>
        ) : (
          <>
            <Text testID="cal-summary" style={{ color: th.text, fontWeight: '700', fontSize: 16 }}>
              {selNode.name}
              {paintedDays ? ` · ${t('piano.n_giorni', { n: paintedDays })}` : ''}
            </Text>
            <Text testID="cal-summary-sub" style={{ color: th.text2 }}>
              {selNode.minutes <= 0
                ? t('piano.senza_ore')
                : paintedDays > 0
                  ? t('piano.ore_in_giorni', {
                      h: hours(Math.max(0, selNode.minutes - selNode.doneMin)),
                      n: paintedDays,
                      d: hours(estimate),
                    })
                  : `${t('piano.ore_restano', { h: hours(Math.max(0, selNode.minutes - selNode.doneMin)) })} · ${t('piano.nessun_giorno')}`}
            </Text>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <TextButton
                testID="cal-edit-hours"
                label={t('piano.modifica_ore')}
                onPress={() => p.onEditHours(selNode.project)}
              />
              {paintedDays > 0 ? (
                <TextButton
                  testID="cal-clear"
                  danger
                  label={t('piano.svuota_giorni')}
                  onPress={() => {
                    const was = [...(view.paint.get(selNode.project) ?? [])];
                    p.repo.paint(selNode.project, 'clear');
                    setUndo((u) => [
                      ...u.slice(-29),
                      { project: selNode.project, mode: 'add', days: was },
                    ]);
                    p.changed();
                  }}
                />
              ) : null}
            </View>
          </>
        )}
      </Card>

      {showEv ? (
        <Card style={{ padding: 16, gap: 8 }}>
          <Text style={{ color: th.text, fontWeight: '700', fontSize: 16 }}>
            {t('piano.eventi_titolo')}
          </Text>
          {(() => {
            const mine = events.filter((e) => e.day.slice(0, 7) === month.slice(0, 7));
            if (!mine.length)
              return (
                <Text testID="cal-ev-none" style={{ color: th.text2 }}>
                  {t('piano.eventi_nessuno')}
                </Text>
              );
            return mine.map((e, i) => (
              <View
                key={`${e.day}-${e.title}-${i}`}
                style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}
              >
                <Text style={{ width: 26, color: th.text2, fontVariant: ['tabular-nums'] }}>
                  {Number(e.day.slice(8, 10))}
                </Text>
                <Text style={{ flex: 1, color: th.text }} numberOfLines={1}>
                  {e.title || '—'}
                </Text>
                <Text style={{ color: th.text2, fontSize: 12 }}>
                  {e.allDay ? t('piano.tutto_giorno') : e.time}
                </Text>
                <Text
                  style={{
                    color: e.importance === 'highest' ? th.red : th.orange,
                    fontSize: 12,
                    fontWeight: '700',
                  }}
                >
                  {t(e.importance === 'highest' ? 'piano.imp_highest' : 'piano.imp_high')}
                </Text>
              </View>
            ));
          })()}
        </Card>
      ) : null}
    </View>
  );
}

export type { CalendarNode };
