import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { TodoTheme } from '@/features/tasks/todoTheme';
import type { DoseView } from '@/features/pills/repo';
import type { Task } from '@/features/tasks/repo';
import type { Project } from '@/features/projects/logic';

import { minutesText, toMin, type TodayData } from './today';
import { isQuote, type Trivia } from './trivia';

/** La scatola di un riquadro: titolo in alto, a destra un'azione (di solito «Apri ›»). */
export function WidgetBox({
  td,
  id,
  title,
  action,
  onAction,
  children,
}: {
  td: TodoTheme;
  id: string;
  title: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <View
      testID={`home-w-${id}`}
      style={[styles.box, { backgroundColor: td.panel, borderColor: td.hair }]}
    >
      <View style={styles.boxHead}>
        <Text style={[styles.boxTitle, { color: td.ink2 }]}>{title}</Text>
        {action ? (
          <Pressable testID={`home-open-${id}`} onPress={onAction} hitSlop={8}>
            <Text style={{ color: td.accent, fontSize: 13, fontWeight: '600' }}>{action}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export interface Shortcut {
  href: string;
  route: string;
  label: string;
}

export function Shortcuts({
  td,
  items,
  onGo,
}: {
  td: TodoTheme;
  items: Shortcut[];
  onGo: (s: Shortcut) => void;
}) {
  return (
    <View style={styles.wrap}>
      {items.map((s) => (
        <Pressable
          key={s.href}
          testID={`home-go-${s.route.replace(/[^a-z]/gi, '')}`}
          onPress={() => onGo(s)}
          style={[styles.pill, { backgroundColor: td.card, borderColor: td.hair }]}
        >
          <Text style={{ color: td.ink, fontWeight: '600' }}>{s.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function TodayWidget({
  td,
  data,
  nowMin,
  onToggleTodo,
  onPill,
  onOpenEvent,
}: {
  td: TodoTheme;
  data: TodayData;
  nowMin: number;
  onToggleTodo: (t: Task) => void;
  onPill: (d: DoseView, how: 'taken' | 'skipped') => void;
  onOpenEvent: (uuid: string, date: string) => void;
}) {
  const { t } = useTranslation();
  const [showAllPills, setShowAllPills] = useState(false);
  const cur = data.current;
  const nxt = data.next;
  const rest = data.events.filter((e) => e !== cur && !e.done);
  const shown = rest.slice(0, 5);
  const ringName: Record<string, string> = {
    daily: t('home.hab_giornaliere'),
    weekly: t('home.hab_settimanali'),
    monthly: t('home.hab_mensili'),
    interval: t('home.hab_intervallo'),
  };
  const late = showAllPills ? data.pillsLate : data.pillsLate.slice(0, 1);
  return (
    <View style={{ gap: 10 }}>
      <View testID="home-now" style={[styles.now, { backgroundColor: td.accentSoft }]}>
        {cur ? (
          <>
            <Text style={[styles.nowLabel, { color: td.accent }]}>{t('home.adesso')}</Text>
            <Text style={[styles.nowTitle, { color: td.ink }]}>
              {cur.title || t('home.senza_titolo')}
            </Text>
            <Text style={{ color: td.ink2 }}>
              {t('home.fino_alle', { ora: cur.endDate > data.today ? '24:00' : cur.end })}
            </Text>
          </>
        ) : nxt ? (
          <>
            <Text style={[styles.nowLabel, { color: td.accent }]}>{t('home.libero')}</Text>
            <Text style={[styles.nowTitle, { color: td.ink }]}>
              {t('home.alle_tra', {
                ora: nxt.start,
                tra: minutesText(toMin(nxt.start) - nowMin),
              })}
            </Text>
            <Text style={{ color: td.ink2 }}>{nxt.title || t('home.senza_titolo')}</Text>
          </>
        ) : (
          <>
            <Text style={[styles.nowLabel, { color: td.accent }]}>{t('home.libero')}</Text>
            <Text style={[styles.nowTitle, { color: td.ink }]}>{t('home.niente_altro')}</Text>
            <Text style={{ color: td.ink2 }}>{t('home.resto_giornata_libero')}</Text>
          </>
        )}
      </View>

      {shown.length ? (
        shown.map((e) => (
          <Pressable
            key={e.uid}
            testID={`home-event-${e.uid}`}
            onPress={() => onOpenEvent(e.masterUuid, e.occDate)}
            style={styles.row}
          >
            <View style={[styles.dot, { backgroundColor: e.color ?? td.accent }]} />
            <Text style={[styles.time, { color: td.ink3 }]}>
              {e.allDay ? t('home.tutto_giorno') : e.start}
            </Text>
            <Text style={{ color: td.ink, flex: 1 }} numberOfLines={1}>
              {e.title || t('home.senza_titolo')}
            </Text>
          </Pressable>
        ))
      ) : (
        <Text style={{ color: td.ink3 }}>{t('home.nessun_evento_oggi')}</Text>
      )}
      {rest.length > shown.length ? (
        <Text style={{ color: td.ink3, fontSize: 12 }}>
          {t('home.altri_n', { n: rest.length - shown.length })}
        </Text>
      ) : null}

      {data.tomorrowEvents.length ? (
        <View style={{ gap: 4 }}>
          <Text style={[styles.sub, { color: td.ink3 }]}>{t('home.domani')}</Text>
          {data.tomorrowEvents.slice(0, 3).map((e) => (
            <Text key={e.uid} style={{ color: td.ink2 }} numberOfLines={1}>
              {e.allDay ? t('home.tutto_giorno') : e.start} · {e.title || t('home.senza_titolo')}
            </Text>
          ))}
        </View>
      ) : null}

      {data.important[0] ? (
        <View testID="home-important" style={{ gap: 2 }}>
          <Text style={[styles.sub, { color: td.ink3 }]}>{t('home.prossima_data')}</Text>
          <Text style={{ color: td.ink, fontWeight: '600' }}>
            {data.important[0].title} ·{' '}
            {data.important[0].days === 0
              ? t('home.oggi')
              : data.important[0].days === 1
                ? t('home.domani')
                : `${data.important[0].days} ${t('home.giorni')}`}
          </Text>
        </View>
      ) : null}

      {data.rings.length ? (
        <View testID="home-rings" style={styles.wrap}>
          {data.rings.map((r) => (
            <View
              key={r.key}
              style={[styles.pill, { backgroundColor: td.card, borderColor: td.hair }]}
            >
              <Text style={{ color: td.ink2, fontSize: 12 }}>{ringName[r.key]}</Text>
              <Text style={{ color: td.ink, fontWeight: '700' }}>
                {r.done}/{r.total}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {late.map((d) => (
        <View
          key={d.uuid}
          testID={`home-pill-${d.uuid}`}
          style={[styles.late, { backgroundColor: td.lateSoft }]}
        >
          <Text style={{ color: td.ink }}>
            {t('home.hp_hai_preso')}
            <Text style={{ fontWeight: '700' }}>{d.name}</Text>{' '}
            {t('home.hp_alle', { ora: d.due_time })}?
          </Text>
          <View style={styles.wrap}>
            <Pressable
              testID={`home-pill-take-${d.uuid}`}
              onPress={() => onPill(d, 'taken')}
              style={[styles.btn, { backgroundColor: td.accent }]}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>{t('home.presa')}</Text>
            </Pressable>
            <Pressable
              testID={`home-pill-skip-${d.uuid}`}
              onPress={() => onPill(d, 'skipped')}
              style={[styles.btn, { borderColor: td.hair, borderWidth: 1 }]}
            >
              <Text style={{ color: td.ink2, fontWeight: '600' }}>{t('home.salta')}</Text>
            </Pressable>
          </View>
        </View>
      ))}
      {data.pillsLate.length > 1 && !showAllPills ? (
        <Pressable testID="home-pill-more" onPress={() => setShowAllPills(true)}>
          <Text style={{ color: td.accent }}>
            {t('home.altre_n', { n: data.pillsLate.length - 1 })}
          </Text>
        </Pressable>
      ) : null}

      <Text style={[styles.sub, { color: td.ink3 }]}>{t('home.tab_todo')}</Text>
      {data.todos.length ? (
        data.todos.slice(0, 5).map((x) => (
          <Pressable
            key={x.uuid}
            testID={`home-todo-${x.uuid}`}
            onPress={() => onToggleTodo(x)}
            style={styles.row}
          >
            <View style={[styles.check, { borderColor: td.ink3 }]} />
            <Text style={{ color: td.ink, flex: 1 }} numberOfLines={1}>
              {x.title}
            </Text>
          </Pressable>
        ))
      ) : (
        <Text style={{ color: td.ink3 }}>{t('home.nessuna_attivita_oggi')}</Text>
      )}
      {data.todos.length > 5 ? (
        <Text style={{ color: td.ink3, fontSize: 12 }}>
          {t('home.altre_n', { n: data.todos.length - 5 })}
        </Text>
      ) : null}

      {data.buy.length ? (
        <View style={{ gap: 4 }}>
          <Text style={[styles.sub, { color: td.ink3 }]}>{t('home.tab_buy')}</Text>
          {data.buy.map((x) => (
            <Pressable
              key={x.uuid}
              testID={`home-buy-${x.uuid}`}
              onPress={() => onToggleTodo(x)}
              style={styles.row}
            >
              <View style={[styles.check, { borderColor: td.ink3 }]} />
              <Text style={{ color: td.ink, flex: 1 }} numberOfLines={1}>
                {x.title}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function ProjectsWidget({
  td,
  rows,
  onOpen,
}: {
  td: TodoTheme;
  rows: { project: Project; seconds: number }[];
  onOpen: (uuid: string) => void;
}) {
  const { t } = useTranslation();
  if (!rows.length) return <Text style={{ color: td.ink3 }}>{t('home.nessun_blocco')}</Text>;
  return (
    <View style={{ gap: 6 }}>
      {rows.map(({ project: p, seconds }) => (
        <Pressable
          key={p.uuid}
          testID={`home-project-${p.uuid}`}
          onPress={() => onOpen(p.uuid)}
          style={styles.row}
        >
          <View style={[styles.dot, { backgroundColor: p.color }]} />
          <Text style={{ color: td.ink, flex: 1 }} numberOfLines={1}>
            {p.name}
          </Text>
          {seconds ? (
            <Text style={{ color: td.ink3, fontSize: 12 }}>{minutesText(seconds / 60)}</Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

/** Il riquadro Voti: la media, i crediti e (se c'è) il voto di laurea stimato; senza esami invita ad aggiungerli. */
export function GradesWidget({
  td,
  avg,
  base,
  baseValue,
  cfuDone,
  cfuTotal,
  empty,
  onOpen,
}: {
  td: TodoTheme;
  avg: string;
  base: string;
  baseValue: string;
  cfuDone: string;
  cfuTotal: string;
  empty: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  if (empty)
    return (
      <Pressable testID="home-grades-empty" onPress={onOpen}>
        <Text style={{ color: td.ink3 }}>{t('home.voti_vuoti')}</Text>
        <Text style={{ color: td.accent, fontWeight: '600' }}>{t('home.voti_aggiungi')}</Text>
      </Pressable>
    );
  return (
    <Pressable testID="home-grades" onPress={onOpen} style={{ flexDirection: 'row', gap: 20 }}>
      <View>
        <Text style={{ color: td.ink3, fontSize: 12 }}>{t('voti.media')}</Text>
        <Text testID="home-grades-avg" style={{ color: td.ink, fontSize: 26, fontWeight: '800' }}>
          {avg}
        </Text>
      </View>
      <View>
        <Text style={{ color: td.ink3, fontSize: 12 }}>/{base}</Text>
        <Text style={{ color: td.ink, fontSize: 26, fontWeight: '800' }}>{baseValue}</Text>
      </View>
      <View>
        <Text style={{ color: td.ink3, fontSize: 12 }}>{t('voti.cfu')}</Text>
        <Text style={{ color: td.ink, fontSize: 26, fontWeight: '800' }}>
          {cfuDone}/{cfuTotal}
        </Text>
      </View>
    </Pressable>
  );
}

export function TriviaWidget({ td, item }: { td: TodoTheme; item: Trivia }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [verdict, setVerdict] = useState<'' | 'ok' | 'miss'>('');
  const quote = isQuote(item);
  return (
    <Pressable testID="home-trivia" onPress={() => setOpen(true)} style={{ gap: 8 }}>
      <Text style={[styles.sub, { color: td.ink3 }]}>
        {quote ? t('home.citazione') : t('dashboard.curiosita')}
      </Text>
      <Text style={{ color: td.ink, fontSize: 16, lineHeight: 22 }}>{item.domanda}</Text>
      {open ? (
        <>
          <Text testID="home-trivia-answer" style={{ color: td.accent, fontWeight: '700' }}>
            {item.risposta}
          </Text>
          {!quote && !verdict ? (
            <View style={styles.wrap}>
              <Pressable
                testID="home-trivia-ok"
                onPress={() => setVerdict('ok')}
                style={[styles.btn, { backgroundColor: td.accent }]}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>{t('home.presa_bene')}</Text>
              </Pressable>
              <Pressable
                testID="home-trivia-miss"
                onPress={() => setVerdict('miss')}
                style={[styles.btn, { borderColor: td.hair, borderWidth: 1 }]}
              >
                <Text style={{ color: td.ink2, fontWeight: '600' }}>{t('home.mancata')}</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : (
        <Text style={{ color: td.ink3 }}>{t('dashboard.tocca_per_scoprire')}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  boxHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  boxTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  now: { borderRadius: 14, padding: 12, gap: 2 },
  nowLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  nowTitle: { fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  time: { fontSize: 12, width: 48 },
  sub: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  late: { borderRadius: 12, padding: 10, gap: 8 },
  btn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  check: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
});
