import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import type { Project } from '@/features/projects/logic';
import { Card } from '@/ui/kit';

import { inkOn, shiftMonth } from './calendarGrid';
import { addDays, mondayOf } from './engine';
import { dayLabel, monthLabel, shortHours } from './format';
import type { PlanRepo } from './repo';
import { calendarView } from './view';
import { Text } from '@/ui/CappedText';

type Mode = 'week' | 'month';

interface Seg {
  from: number;
  to: number;
  mins: number[];
}

/** Giorni di fila con qualcosa (pianificato o evidenziato) diventano una barra. */
export function segments(act: ({ m: number } | null)[]): Seg[] {
  const out: Seg[] = [];
  let cur: Seg | null = null;
  act.forEach((a, i) => {
    if (a) {
      if (!cur) {
        cur = { from: i, to: i, mins: [] };
        out.push(cur);
      }
      cur.to = i;
      if (a.m) cur.mins.push(a.m);
    } else cur = null;
  });
  return out;
}

function minText(ms: number[]): string {
  if (!ms.length) return '';
  const lo = Math.min(...ms);
  const hi = Math.max(...ms);
  return lo === hi ? shortHours(lo) : `${shortHours(lo)}–${shortHours(hi)}`;
}

/**
 * «Linea del tempo»: una riga per progetto, una barra per ogni tratto di giorni di fila in cui c'è qualcosa (pianificato o
 * evidenziato), settimana o mese; sotto, gli eventi importanti del planner (renderLine del sito).
 */
export function PlanTimeline(p: {
  repo: PlanRepo;
  projects: Project[];
  version: number;
  lang: string;
  onOpen: (project: string) => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const today = p.repo.today();
  const [mode, setMode] = useState<Mode>('week');
  const [date, setDate] = useState(today);

  const range = (() => {
    if (mode === 'month') {
      const first = `${date.slice(0, 7)}-01`;
      const next = shiftMonth(first, 1);
      const n = Math.round(
        (Date.parse(`${next}T12:00:00Z`) - Date.parse(`${first}T12:00:00Z`)) / 86400000,
      );
      return { from: first, to: addDays(first, n - 1), n };
    }
    const mon = mondayOf(date);
    return { from: mon, to: addDays(mon, 6), n: 7 };
  })();
  const days = Array.from({ length: range.n }, (_, i) => addDays(range.from, i));

  const data = useMemo(() => {
    void p.version;
    return {
      view: calendarView(p.repo, p.projects, null, range.from, range.to),
      events: p.repo.importantEvents(range.from, range.to),
    };
  }, [p.repo, p.projects, p.version, range.from, range.to]);
  const { view, events } = data;

  const byId = new Map(view.nodes.map((n) => [n.project, n]));
  const rows = view.nodes
    .map((n) => ({
      n,
      act: days.map((d) => {
        const pl = view.plan
          .filter((b) => b.day === d && b.project === n.project)
          .reduce((a, b) => a + b.minutes, 0);
        const pa = view.paint.get(n.project)?.has(d) ?? false;
        return pl > 0 || pa ? { m: pl } : null;
      }),
    }))
    .filter((r) => r.act.some(Boolean));

  const evs = new Map<string, { title: string; imp: string; act: ({ m: number } | null)[] }>();
  days.forEach((d, i) => {
    for (const e of events.filter((x) => x.day === d)) {
      const k = `${e.title}|${e.importance}`;
      let cur = evs.get(k);
      if (!cur)
        evs.set(k, (cur = { title: e.title, imp: e.importance, act: days.map(() => null) }));
      cur.act[i] = { m: 0 };
    }
  });

  const move = (dir: 1 | -1) =>
    setDate(mode === 'month' ? shiftMonth(`${date.slice(0, 7)}-15`, dir) : addDays(date, dir * 7));
  const title =
    mode === 'month'
      ? monthLabel(range.from, p.lang)
      : `${dayLabel(range.from, p.lang, { day: 'numeric', month: 'short' })} – ${dayLabel(range.to, p.lang, { day: 'numeric', month: 'short' })}`;
  const pct = (i: number) => `${(i * 100) / range.n}%` as const;

  return (
    <Card style={{ padding: 12, gap: 10 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 6,
        }}
      >
        <Text
          testID="tl-title"
          style={{ color: th.text, fontSize: 18, fontWeight: '800', textTransform: 'capitalize' }}
        >
          {title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable
            testID="tl-prev"
            accessibilityRole="button"
            accessibilityLabel={t('piano.mese_prima')}
            onPress={() => move(-1)}
            style={{ padding: 10 }}
          >
            <Text style={{ color: th.brand, fontSize: 20 }}>‹</Text>
          </Pressable>
          <Pressable
            testID="tl-today"
            accessibilityRole="button"
            onPress={() => setDate(today)}
            style={{ padding: 10 }}
          >
            <Text style={{ color: th.brand, fontWeight: '700' }}>{t('piano.oggi')}</Text>
          </Pressable>
          <Pressable
            testID="tl-next"
            accessibilityRole="button"
            accessibilityLabel={t('piano.mese_dopo')}
            onPress={() => move(1)}
            style={{ padding: 10 }}
          >
            <Text style={{ color: th.brand, fontSize: 20 }}>›</Text>
          </Pressable>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['week', 'month'] as Mode[]).map((m) => (
          <Pressable
            key={m}
            testID={`tl-mode-${m}`}
            accessibilityRole="button"
            accessibilityState={{ selected: mode === m }}
            onPress={() => {
              setMode(m);
              if (m === 'week' && date.slice(0, 7) === today.slice(0, 7)) setDate(today);
            }}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: mode === m ? th.brand : th.surface2,
            }}
          >
            <Text style={{ color: mode === m ? '#fff' : th.text, fontWeight: '600' }}>
              {t(m === 'week' ? 'piano.tl_settimana' : 'piano.tl_mese')}
            </Text>
          </Pressable>
        ))}
      </View>

      {!rows.length && !evs.size ? (
        <Text testID="tl-empty" style={{ color: th.text2 }}>
          {t('piano.tl_nulla')}
        </Text>
      ) : (
        <View style={{ gap: 8 }}>
          <View style={{ height: 18 }}>
            {days.map((d, i) => {
              const lab =
                mode === 'month'
                  ? i === 0 || (Number(d.slice(8, 10)) % 5 === 0 && range.n - i > 2)
                    ? String(Number(d.slice(8, 10)))
                    : ''
                  : dayLabel(d, p.lang, { weekday: 'short', day: 'numeric' });
              return (
                <Text
                  key={d}
                  numberOfLines={1}
                  style={{
                    position: 'absolute',
                    left: pct(i),
                    width: pct(1),
                    textAlign: 'center',
                    fontSize: 10,
                    color: d === today ? th.brand : th.text3,
                    fontWeight: d === today ? '800' : '500',
                  }}
                >
                  {lab}
                </Text>
              );
            })}
          </View>
          {rows.map(({ n, act }) => {
            const parent = n.parent ? byId.get(n.parent) : null;
            return (
              <View key={n.project} style={{ gap: 2 }}>
                <Text style={{ color: th.text2, fontSize: 11 }} numberOfLines={1}>
                  {parent ? `${parent.name} › ` : ''}
                  {n.name}
                </Text>
                <View style={{ height: 28 }}>
                  {segments(act).map((sg) => {
                    const mt = minText(sg.mins);
                    return (
                      <Pressable
                        hitSlop={9}
                        key={sg.from}
                        testID={`tl-bar-${n.project}-${sg.from}`}
                        accessibilityRole="button"
                        accessibilityLabel={`${n.name} ${mt}`}
                        onPress={() => p.onOpen(n.project)}
                        style={{
                          position: 'absolute',
                          left: pct(sg.from),
                          width: pct(sg.to - sg.from + 1),
                          height: 26,
                          borderRadius: 8,
                          justifyContent: 'center',
                          paddingHorizontal: 6,
                          backgroundColor: sg.mins.length ? n.color : `${n.color}55`,
                          borderWidth: sg.mins.length ? 0 : 1,
                          borderColor: n.color,
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          style={{
                            color: sg.mins.length ? inkOn(n.color) : th.text,
                            fontSize: 11,
                            fontWeight: '700',
                          }}
                        >
                          {mode === 'month' ? mt : `${n.name}${mt ? ` · ${mt}` : ''}`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
          {evs.size ? (
            <View style={{ gap: 2 }}>
              <Text style={{ color: th.text2, fontSize: 11 }}>{t('piano.eventi_titolo')}</Text>
              <View style={{ minHeight: 8 + Math.max(1, evs.size) * 26 }}>
                {[...evs.values()].flatMap((e, level) =>
                  segments(e.act).map((sg) => (
                    <View
                      key={`${e.title}-${sg.from}`}
                      testID={`tl-ev-${e.title}`}
                      style={{
                        position: 'absolute',
                        top: 4 + level * 26,
                        left: pct(sg.from),
                        width: pct(sg.to - sg.from + 1),
                        height: 22,
                        borderRadius: 8,
                        justifyContent: 'center',
                        paddingHorizontal: 6,
                        backgroundColor: e.imp === 'highest' ? '#FF453A' : '#FFD60A',
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        style={{
                          color: e.imp === 'highest' ? '#fff' : '#1C1C1E',
                          fontSize: 11,
                          fontWeight: '700',
                        }}
                      >
                        {e.title}
                      </Text>
                    </View>
                  )),
                )}
              </View>
            </View>
          ) : null}
        </View>
      )}
    </Card>
  );
}
