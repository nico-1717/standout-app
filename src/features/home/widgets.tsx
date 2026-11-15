import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/core/theme/ThemeProvider';
import type { TodoTheme } from '@/features/tasks/todoTheme';
import type { DoseView } from '@/features/pills/repo';
import type { Task } from '@/features/tasks/repo';
import type { Project } from '@/features/projects/logic';

import type { HomeCards, NextDeck, OpenGame } from '@/features/flashcards/homeCards';
import type { HomeNumbers } from '@/features/flashcards/numbers';
import { minutesText, toMin, type TodayData } from './today';
import { isQuote, type Trivia } from './trivia';
import {
  tint,
  HoCheck,
  HoChip,
  HoIcon,
  HoRings,
  HoSecHead,
  HoWidget,
  cap,
  hoTheme,
  type Ho,
  type HoIconName,
} from './HomeKit';

const WIDGET_LOOK: Record<string, { icon: HoIconName; color: (ho: Ho) => string }> = {
  agenda: { icon: 'calendar', color: (ho) => ho.red },
  note: { icon: 'note', color: (ho) => ho.orange },
  projects: { icon: 'folder', color: (ho) => ho.indigo },
  cards: { icon: 'cards', color: (ho) => ho.purple },
  trivia: { icon: 'bulb', color: () => '#FFD60A' },
  grades: { icon: 'cap', color: (ho) => ho.teal },
  stats: { icon: 'chart', color: (ho) => ho.blue },
};

/** La scatola di un riquadro (.ho-w): titolo con l'icona colorata in alto, a destra «Apri ›». */
export function WidgetBox({
  id,
  title,
  action,
  onAction,
  children,
}: {
  td?: TodoTheme;
  id: string;
  title: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  const th = useTheme();
  const ho = hoTheme(th);
  const look = WIDGET_LOOK[id];
  return (
    <HoWidget
      ho={ho}
      id={id}
      title={title}
      icon={look?.icon}
      color={look?.color(ho)}
      action={action}
      onAction={onAction}
    >
      {children}
    </HoWidget>
  );
}

export interface Shortcut {
  href: string;
  route: string;
  label: string;
  /** il colore del pallino (quello della scorciatoia sul sito) */
  color?: string;
  icon?: HoIconName;
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
          accessibilityRole="button"
          key={s.href}
          testID={`home-go-${s.route.replace(/[^a-z]/gi, '')}`}
          onPress={() => onGo(s)}
          style={[styles.pill, { backgroundColor: td.card, borderColor: td.hair }]}
        >
          {s.color ? (
            <View
              testID={`home-dot-${s.route.replace(/[^a-z]/gi, '')}`}
              style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }}
            />
          ) : null}
          <Text style={{ color: td.ink, fontWeight: '600' }}>{s.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** «sab 31 ott»: giorno della settimana, numero, mese, senza virgole (come il sito). */
export function dayMonth(
  locale: string,
  d: Date,
  weekday: 'short' | 'long' = 'short',
  month: 'short' | 'long' = 'short',
): string {
  const parts = new Intl.DateTimeFormat(locale, { weekday, day: 'numeric', month }).formatToParts(
    d,
  );
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('weekday')} ${get('day')} ${get('month')}`.trim();
}

/** «oggi», «domani», «ieri» o «sab 31 ott» (H.rel del sito). */
function relDay(iso: string, today: string, locale: string, t: (k: string) => string): string {
  const toD = (s: string) => new Date(`${s}T12:00:00`);
  const diff = Math.round((toD(iso).getTime() - toD(today).getTime()) / 86400000);
  if (diff === 0) return t('todo.tn_oggi');
  if (diff === 1) return t('todo.tn_domani');
  if (diff === -1) return t('todo.tn_ieri');
  return dayMonth(locale, toD(iso));
}

export function TodayWidget({
  data,
  nowMin,
  projectNames,
  catNames,
  onToggleTodo,
  onPill,
  onOpenEvent,
  onOpenTodo,
  onOpenBuy,
  onOpenHabits,
}: {
  td?: TodoTheme;
  data: TodayData;
  nowMin: number;
  projectNames?: Map<string, string>;
  catNames?: Map<string, string>;
  onToggleTodo: (t: Task) => void;
  onPill: (d: DoseView, how: 'taken' | 'skipped') => void;
  onOpenEvent: (uuid: string, date: string) => void;
  onOpenTodo?: () => void;
  onOpenBuy?: () => void;
  onOpenHabits?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const th = useTheme();
  const ho = hoTheme(th);
  const [showAllPills, setShowAllPills] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const cur = data.current;
  const nxt = data.next;
  const endMin = (e: (typeof data.events)[number]) =>
    e.allDay ? 1440 : e.endDate > data.today ? 1440 : toMin(e.end);
  const past = data.events.filter((e) => !e.allDay && endMin(e) <= nowMin);
  const rest = data.events.filter((e) => !past.includes(e));
  const shown = rest.slice(0, 8);
  const late = showAllPills ? data.pillsLate : data.pillsLate.slice(0, 1);
  const free = !cur;

  const eventRow = (e: (typeof data.events)[number], i: number, isPast: boolean) => (
    <Pressable
      accessibilityRole="button"
      key={e.uid}
      testID={`home-event-${e.uid}`}
      onPress={() => onOpenEvent(e.masterUuid, e.occDate)}
      style={[
        styles.ev,
        { borderTopColor: ho.hair, borderTopWidth: i === 0 ? 0 : 1 },
        isPast || e.done ? { opacity: 0.5 } : null,
      ]}
    >
      <Text
        style={{
          width: 48,
          color: e === cur ? ho.blueInk : ho.text2,
          fontSize: 13.5,
          fontWeight: '700',
          fontVariant: ['tabular-nums'],
        }}
      >
        {e.allDay ? t('home.tutto_giorno') : e.start}
      </Text>
      <View
        style={{
          width: 4,
          alignSelf: 'stretch',
          minHeight: 34,
          borderRadius: 2,
          backgroundColor: e.color ?? ho.blue,
        }}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            color: e.done ? ho.text2 : ho.text,
            fontWeight: '600',
            lineHeight: 19,
            textDecorationLine: e.done ? 'line-through' : 'none',
          }}
        >
          {e.title || t('home.senza_titolo')}
        </Text>
        {!e.allDay ? (
          <Text style={{ color: ho.text2, fontSize: 12.5 }}>{`${e.start}–${e.end}`}</Text>
        ) : null}
      </View>
    </Pressable>
  );

  const chipTone = (date: string) =>
    date < data.today ? 'red' : date === data.today ? 'blue' : 'grey';
  const dueLabel = (x: Task) =>
    `${relDay(x.due_date as string, data.today, i18n.language, t)}${x.due_time ? ` ${x.due_time.slice(0, 5)}` : ''}`;

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <LinearGradient
            testID="home-now"
            colors={free ? [ho.teal, ho.green] : [ho.blue, ho.indigo, ho.purple]}
            locations={free ? [0, 1] : [0, 0.6, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.now}
          >
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -40,
                right: -30,
                width: 130,
                height: 130,
                borderRadius: 65,
                backgroundColor: 'rgba(255,255,255,.16)',
              }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              {cur ? (
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />
              ) : null}
              <Text style={styles.nowK}>{cur ? t('home.adesso') : t('home.libero')}</Text>
            </View>
            {cur ? (
              <>
                <Text style={styles.nowT}>{cur.title || t('home.senza_titolo')}</Text>
                <Text style={styles.nowM}>
                  {t('home.fino_alle', { ora: cur.endDate > data.today ? '24:00' : cur.end })}
                  {nxt
                    ? ` · ${t('home.poi', { titolo: nxt.title || t('home.senza_titolo'), ora: nxt.start })}`
                    : ''}
                </Text>
              </>
            ) : nxt ? (
              <>
                <Text style={styles.nowT}>{nxt.title || t('home.senza_titolo')}</Text>
                <Text style={styles.nowM}>
                  {t('home.alle_tra', {
                    ora: nxt.start,
                    tra: minutesText(toMin(nxt.start) - nowMin),
                  })}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.nowT}>{t('home.niente_altro')}</Text>
                <Text style={styles.nowM}>{t('home.resto_giornata_libero')}</Text>
              </>
            )}
          </LinearGradient>
        </View>
        {data.rings.length || data.hasPills ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Pressable
              testID="home-rings"
              accessibilityRole="button"
              accessibilityLabel={t('home.w_abitudini')}
              onPress={onOpenHabits}
            >
              <HoRings ho={ho} rings={data.rings} />
            </Pressable>
            {data.hasPills ? (
              <View
                testID="home-pillbtn"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: data.pillsLate.length ? ho.purpleSoft : ho.surface2,
                }}
              >
                <HoIcon
                  name="pill"
                  size={20}
                  color={data.pillsLate.length ? ho.purple : ho.text2}
                />
                {data.pillsLate.length ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: -3,
                      right: -3,
                      minWidth: 18,
                      height: 18,
                      paddingHorizontal: 5,
                      borderRadius: 9,
                      backgroundColor: ho.purple,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>
                      {data.pillsLate.length}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {data.important[0] ? (
        <View testID="home-important" style={{ gap: 6 }}>
          <Text style={cap(ho)}>{t('home.prossima_data')}</Text>
          <View style={[styles.dateCard, { backgroundColor: ho.surface2 }]}>
            <View style={{ minWidth: 48, alignItems: 'center' }}>
              <Text
                style={{
                  color: data.important[0].color ?? ho.red,
                  fontSize: 24,
                  fontWeight: '800',
                  letterSpacing: -0.7,
                }}
              >
                {data.important[0].days}
              </Text>
              <Text style={[cap(ho), { fontSize: 11.5 }]}>
                {t(data.important[0].days === 1 ? 'home.giorno' : 'home.giorni')}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: ho.text, fontWeight: '700' }}>{data.important[0].title}</Text>
              <Text style={{ color: ho.text2, fontSize: 13 }}>
                {dayMonth(i18n.language, new Date(`${data.important[0].date}T12:00:00`))}
                {data.important[0].time ? ` · ${data.important[0].time}` : ''}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      <View>
        {past.length ? (
          <Pressable
            accessibilityRole="button"
            testID="home-past-toggle"
            onPress={() => setPastOpen((v) => !v)}
            style={{ paddingTop: 6, paddingBottom: 2 }}
          >
            <Text style={{ color: ho.blueInk, fontSize: 13.5, fontWeight: '600' }}>
              {pastOpen ? t('home.nascondi_passati') : t('home.passati_n', { n: past.length })}
            </Text>
          </Pressable>
        ) : null}
        {pastOpen ? past.map((e, i) => eventRow(e, i + 1, true)) : null}
        {shown.map((e, i) => eventRow(e, i + (past.length ? 1 : 0), false))}
        {!data.events.length ? (
          <Text style={{ color: ho.text2, fontSize: 14, paddingTop: 6 }}>
            {t('home.nessun_evento_oggi')}
          </Text>
        ) : null}
        {rest.length > shown.length ? (
          <Text style={{ color: ho.blueInk, fontSize: 13.5, fontWeight: '600', paddingTop: 6 }}>
            {t('home.altri_n', { n: rest.length - shown.length })}
          </Text>
        ) : null}
      </View>

      {data.tomorrowEvents.length ? (
        <View>
          <Text style={[cap(ho), { marginTop: 8, marginBottom: 2 }]}>{t('home.domani')}</Text>
          {data.tomorrowEvents.slice(0, 4).map((e, i) => eventRow(e, i, false))}
        </View>
      ) : null}

      {late.length ? (
        <View style={{ gap: 8 }}>
          {late.map((d) => (
            <View
              key={d.uuid}
              testID={`home-pill-${d.uuid}`}
              style={[
                styles.av,
                { backgroundColor: ho.surface, boxShadow: `inset 0 0 0 1px ${ho.purple}6B` },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('home.presa')}
                testID={`home-pill-take-${d.uuid}`}
                onPress={() => onPill(d, 'taken')}
                style={[styles.avOk, { backgroundColor: ho.purpleSoft }]}
              >
                <HoIcon name="check" size={16} color={ho.purple} sw={2.6} />
              </Pressable>
              <Text style={{ flex: 1, color: ho.text2, fontSize: 13.5, lineHeight: 18 }}>
                {t('home.hp_hai_preso')}
                <Text style={{ color: ho.text, fontWeight: '700' }}>{d.name}</Text>{' '}
                {t('home.hp_alle', { ora: d.due_time })}?
              </Text>
              <Pressable
                accessibilityRole="button"
                testID={`home-pill-skip-${d.uuid}`}
                onPress={() => onPill(d, 'skipped')}
                style={{
                  backgroundColor: ho.surface2,
                  paddingVertical: 3,
                  paddingHorizontal: 9,
                  borderRadius: 999,
                }}
              >
                <Text style={{ color: ho.text2, fontSize: 11, fontWeight: '600' }}>
                  {t('home.salta')}
                </Text>
              </Pressable>
            </View>
          ))}
          {data.pillsLate.length > 1 && !showAllPills ? (
            <Pressable
              accessibilityRole="button"
              testID="home-pill-more"
              onPress={() => setShowAllPills(true)}
            >
              <Text style={{ color: ho.blueInk, fontSize: 13.5, fontWeight: '600' }}>
                {t('home.altre_n', { n: data.pillsLate.length - 1 })}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View>
        <HoSecHead
          ho={ho}
          title={t('home.tab_todo')}
          count={data.todos.length}
          openLabel={t('home.apri_todo')}
          openColor={ho.green}
          onOpen={onOpenTodo}
          testID="home-open-todo"
        />
        {data.todos.length ? (
          data.todos.slice(0, 5).map((x, i) => (
            <View
              key={x.uuid}
              style={[styles.li, { borderTopColor: ho.hair, borderTopWidth: i === 0 ? 0 : 1 }]}
            >
              <HoCheck
                ho={ho}
                label={t('home.segna_fatto')}
                testID={`home-todo-${x.uuid}`}
                onPress={() => onToggleTodo(x)}
              />
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text style={{ color: ho.text, fontWeight: '600', lineHeight: 19 }}>{x.title}</Text>
                {x.due_date || (x.project_uuid && projectNames?.get(x.project_uuid)) ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {x.due_date ? (
                      <HoChip ho={ho} tone={chipTone(x.due_date)}>
                        {dueLabel(x)}
                      </HoChip>
                    ) : null}
                    {x.project_uuid && projectNames?.get(x.project_uuid) ? (
                      <Text style={{ color: ho.text2, fontSize: 12.5 }}>
                        {projectNames.get(x.project_uuid)}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <Text style={{ color: ho.text2, fontSize: 14, paddingTop: 8 }}>
            {data.todosDoneToday > 0 ? t('home.tutto_fatto') : t('home.nessuna_attivita_oggi')}
          </Text>
        )}
        {data.todos.length > 5 ? (
          <Text style={{ color: ho.blueInk, fontSize: 13.5, fontWeight: '600', paddingTop: 6 }}>
            {t('home.altre_n', { n: data.todos.length - 5 })}
          </Text>
        ) : null}
      </View>

      <View>
        <HoSecHead
          ho={ho}
          title={t('home.tab_buy')}
          count={data.buyOpen}
          openLabel={t('home.apri_acquisti')}
          openColor={ho.orange}
          onOpen={onOpenBuy}
          testID="home-open-buy"
        />
        {data.buy.length ? (
          data.buy.slice(0, 4).map((x, i) => (
            <View
              key={x.uuid}
              style={[styles.li, { borderTopColor: ho.hair, borderTopWidth: i === 0 ? 0 : 1 }]}
            >
              <HoCheck
                ho={ho}
                color={ho.green}
                label={t('home.segna_comprato')}
                testID={`home-buy-${x.uuid}`}
                onPress={() => onToggleTodo(x)}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {x.buy_priority === 1 ? (
                    <View
                      accessibilityLabel={t('home.urgente')}
                      style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: ho.red }}
                    />
                  ) : null}
                  <Text
                    style={{ color: ho.text, fontWeight: '600', lineHeight: 19, flexShrink: 1 }}
                  >
                    {x.title}
                  </Text>
                </View>
                {x.buy_category_uuid && catNames?.get(x.buy_category_uuid) ? (
                  <Text style={{ color: ho.text2, fontSize: 12.5 }}>
                    {catNames.get(x.buy_category_uuid)}
                  </Text>
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <Text style={{ color: ho.text2, fontSize: 14, paddingTop: 8 }}>
            {t('home.niente_da_comprare')}
          </Text>
        )}
      </View>
    </View>
  );
}

export function ProjectsWidget({
  rows,
  onOpen,
}: {
  td?: TodoTheme;
  rows: { project: Project; seconds: number }[];
  onOpen: (uuid: string) => void;
}) {
  const { t } = useTranslation();
  const ho = hoTheme(useTheme());
  if (!rows.length)
    return <Text style={{ color: ho.text2, fontSize: 14 }}>{t('home.nessun_blocco')}</Text>;
  return (
    <View>
      {rows.map(({ project: p, seconds }, i) => (
        <Pressable
          accessibilityRole="button"
          key={p.uuid}
          testID={`home-project-${p.uuid}`}
          onPress={() => onOpen(p.uuid)}
          style={[styles.pj, { borderTopColor: ho.hair, borderTopWidth: i === 0 ? 0 : 1 }]}
        >
          <View style={[styles.dotPj, { backgroundColor: p.color }]} />
          <Text style={{ color: ho.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>
            {p.name}
          </Text>
          {seconds ? (
            <Text style={{ color: ho.text2, fontSize: 13, fontVariant: ['tabular-nums'] }}>
              {minutesText(seconds / 60)}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

/** Il riquadro Voti: la media, i crediti e (se c'è) il voto di laurea stimato; senza esami invita ad aggiungerli. */
export function GradesWidget({
  avg,
  base,
  baseValue,
  cfuDone,
  cfuTotal,
  empty,
  onOpen,
}: {
  td?: TodoTheme;
  avg: string;
  base: string;
  baseValue: string;
  cfuDone: string;
  cfuTotal: string;
  empty: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const ho = hoTheme(useTheme());
  if (empty)
    return (
      <Pressable accessibilityRole="button" testID="home-grades-empty" onPress={onOpen}>
        <Text style={{ color: ho.text2, fontSize: 14 }}>{t('home.voti_vuoti')}</Text>
        <Text style={{ color: ho.blueInk, fontWeight: '600', paddingTop: 4 }}>
          {t('home.voti_aggiungi')}
        </Text>
      </Pressable>
    );
  const kv: [string, string, string?][] = [
    [baseValue, `/${base}`],
    [`${cfuDone}/${cfuTotal}`, t('voti.cfu')],
  ];
  return (
    <Pressable accessibilityRole="button" testID="home-grades" onPress={onOpen} style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text
          testID="home-grades-avg"
          style={{
            color: ho.text,
            fontSize: 44,
            lineHeight: 46,
            fontWeight: '800',
            letterSpacing: -1.76,
            fontVariant: ['tabular-nums'],
          }}
        >
          {avg}
        </Text>
        <Text style={{ color: ho.text2, fontSize: 13, fontWeight: '700' }}>{t('voti.media')}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {kv.map(([v, label]) => (
          <View key={label} style={[styles.kv, { backgroundColor: ho.surface2 }]}>
            <Text
              style={{
                color: ho.text,
                fontSize: 21,
                fontWeight: '800',
                fontVariant: ['tabular-nums'],
              }}
            >
              {v}
            </Text>
            <Text style={{ color: ho.text2, fontSize: 12, fontWeight: '600' }}>{label}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

/** Una riga «Continua / Gioca» del riquadro Flashcard (la `track` del sito). */
function TrackRow({
  id,
  icon,
  color,
  title,
  open,
  idle,
  playLabel,
  onTitle,
  onContinue,
  onPlay,
}: {
  id: string;
  icon: string;
  color: string;
  title: string;
  open: OpenGame | null;
  idle: string;
  /** se c'è, il tasto di destra non è «Gioca» ma questo (es. «Aggiungi una lingua») */
  playLabel?: string;
  onTitle: () => void;
  onContinue: () => void;
  onPlay: () => void;
}) {
  const { t } = useTranslation();
  const ho = hoTheme(useTheme());
  const pct = open ? Math.round((open.closed / Math.max(1, open.total)) * 100) : 0;
  return (
    <View testID={`home-track-${id}`} style={[styles.trk, { backgroundColor: ho.surface2 }]}>
      <View style={[styles.trkIco, { backgroundColor: tint(color, ho.surface2, 0.85) }]}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 120 }}>
        <Pressable accessibilityRole="button" onPress={onTitle} testID={`home-track-${id}-title`}>
          <Text style={{ color: ho.text, fontWeight: '700' }} numberOfLines={1}>
            {title}
          </Text>
        </Pressable>
        {open ? (
          <>
            <Text style={{ color: ho.text2, fontSize: 13 }} numberOfLines={1}>
              {open.label ? `${open.label} · ` : ''}
              {t('home.fc_fatte', { n: open.closed, tot: open.total })}
            </Text>
            <View style={[styles.bar, { backgroundColor: ho.hair }]}>
              <View
                style={{ width: `${pct}%`, height: 8, borderRadius: 4, backgroundColor: color }}
              />
            </View>
          </>
        ) : (
          <Text style={{ color: ho.text2, fontSize: 13 }} numberOfLines={1}>
            {idle}
          </Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {open ? (
          <Pressable
            accessibilityRole="button"
            testID={`home-track-${id}-continue`}
            onPress={onContinue}
            style={[styles.btnSm, { backgroundColor: ho.blue }]}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
              {t('home.continua')}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          testID={`home-track-${id}-play`}
          onPress={onPlay}
          style={[styles.btnSm, { backgroundColor: open ? ho.blueSoft : ho.blue }]}
        >
          <Text style={{ color: open ? ho.blueInk : '#fff', fontWeight: '700', fontSize: 14 }}>
            {playLabel ?? t('home.gioca')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Il testo sotto il mazzo da giocare: «esame tra 12 g», «mai giocato» o «giocato 3 g fa». */
function nextSub(t: (k: string, o?: Record<string, unknown>) => string, d: NextDeck): string {
  const when =
    d.examDays !== null
      ? t('home.esame_tra', { n: d.examDays })
      : d.daysAgo === null
        ? t('home.mai_giocato')
        : t('home.giocato_giorni_fa', { n: d.daysAgo });
  return `${d.name} · ${when}`;
}

/**
 * Sopra le bozze del riquadro Flashcard: l'obiettivo di oggi e una riga per lo studio e una per le lingue, con la
 * partita da riprendere (se c'è) e il tasto per giocarne una nuova.
 */
export function CardsTracks({
  data,
  go,
  onInsert,
}: {
  td?: TodoTheme;
  data: HomeCards;
  go: (route: string, params?: Record<string, string>) => void;
  onInsert: () => void;
}) {
  const { t } = useTranslation();
  const ho = hoTheme(useTheme());
  const pct = data.goal ? Math.min(100, Math.round((data.today / data.goal) * 100)) : 0;
  const done = data.today >= data.goal;
  const { study, vocab } = data;
  const resume = (g: OpenGame) => go('/fc-game', { game: g.game, position: String(g.position) });
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={[cap(ho), { fontSize: 11.5 }]}>{t('home.carte_oggi')}</Text>
        <View
          style={{
            flex: 1,
            height: 8,
            borderRadius: 4,
            backgroundColor: ho.hair,
            overflow: 'hidden',
          }}
        >
          <View
            testID="home-cards-goal-bar"
            style={{
              width: `${pct}%`,
              height: 8,
              borderRadius: 4,
              backgroundColor: done ? ho.green : ho.blue,
            }}
          />
        </View>
        <Text
          testID="home-cards-goal"
          style={{ color: ho.text, fontWeight: '800', fontSize: 14, fontVariant: ['tabular-nums'] }}
        >
          {data.today}/{data.goal}
        </Text>
      </View>
      <TrackRow
        id="study"
        icon="🎓"
        color="#AF52DE"
        title={t('home.fc_studio')}
        open={study.open}
        idle={study.next ? nextSub(t, study.next) : t('home.nessun_mazzo')}
        onTitle={() => go('/fc-hub')}
        onContinue={() => study.open && resume(study.open)}
        onPlay={() => go('/fc-setup', study.next ? { preselect: study.next.uuid } : undefined)}
      />
      <TrackRow
        id="vocab"
        icon={vocab.course?.flag ?? '🌐'}
        color="#30B0C7"
        title={t('home.fc_lingue')}
        open={vocab.open}
        idle={vocab.course ? vocab.course.name : t('home.nessuna_lingua')}
        playLabel={vocab.course ? undefined : t('home.aggiungi_lingua')}
        onTitle={() => go('/fc-hub')}
        onContinue={() => vocab.open && resume(vocab.open)}
        onPlay={() =>
          vocab.course ? go('/fc-setup', { course: vocab.course.uuid }) : go('/fc-hub')
        }
      />
      <Pressable
        accessibilityRole="button"
        testID="home-insert"
        onPress={onInsert}
        style={[styles.btnSm, { alignSelf: 'flex-start', backgroundColor: ho.blueSoft }]}
      >
        <Text style={{ color: ho.blueInk, fontWeight: '700', fontSize: 14 }}>
          + {t('sidebar.inserisci')}
        </Text>
      </Pressable>
    </View>
  );
}

/** «I tuoi numeri»: l'anello delle carte che sai, serie, precisione, record, carte in tutto e gli ultimi 7 giorni. */
export function NumbersWidget({
  n,
  today,
  onOpen,
}: {
  td?: TodoTheme;
  n: HomeNumbers;
  today: string;
  onOpen: () => void;
}) {
  const ho = hoTheme(useTheme());
  const { t } = useTranslation();
  const r = 40;
  const c = 2 * Math.PI * r;
  const max = Math.max(1, ...n.week.map((w) => w.n));
  const letters = ['g_lun', 'g_mar', 'g_mer', 'g_gio', 'g_ven', 'g_sab', 'g_dom'];
  const kv: [string, string][] = [
    [String(n.streak), t('home.serie')],
    [`${n.accuracy}%`, t('home.precisione')],
    [String(n.record), t('home.record')],
    [String(n.cardsTotal), t('home.carte')],
  ];
  return (
    <Pressable
      accessibilityRole="button"
      testID="home-numbers"
      onPress={onOpen}
      style={{ gap: 12 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ width: 92, height: 92, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={92} height={92} viewBox="0 0 92 92" style={{ position: 'absolute' }}>
            <Circle cx={46} cy={46} r={r} fill="none" stroke={ho.hair} strokeWidth={9} />
            <Circle
              cx={46}
              cy={46}
              r={r}
              fill="none"
              stroke={ho.blue}
              strokeWidth={9}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - n.mastery / 100)}
              transform="rotate(-90 46 46)"
            />
          </Svg>
          <Text
            testID="home-numbers-mastery"
            style={{
              color: ho.text,
              fontSize: 20,
              fontWeight: '800',
              fontVariant: ['tabular-nums'],
            }}
          >
            {n.mastery}%
          </Text>
        </View>
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {kv.map(([v, label]) => (
            <View key={label} style={[styles.kvCell, { backgroundColor: ho.surface2 }]}>
              <Text
                style={{
                  color: ho.text,
                  fontSize: 21,
                  lineHeight: 23,
                  fontWeight: '800',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {v}
              </Text>
              <Text style={{ color: ho.text2, fontSize: 12, fontWeight: '600' }}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={cap(ho)}>{t('dashboard.ultimi_7_giorni')}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 58 }}>
        {n.week.map((w) => {
          const dow = new Date(`${w.day}T12:00:00Z`).getUTCDay();
          return (
            <View key={w.day} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
              <View
                testID={`home-numbers-bar-${w.day}`}
                style={{
                  width: '100%',
                  height: Math.max(6, Math.round((w.n / max) * 40)),
                  borderRadius: 6,
                  backgroundColor: w.day === today ? ho.blue : ho.hair,
                }}
              />
              <Text style={{ color: ho.text2, fontSize: 11.5, fontWeight: '700' }}>
                {t(`dashboard.${letters[(dow + 6) % 7]}`)}
              </Text>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

export function TriviaWidget({ item }: { td?: TodoTheme; item: Trivia }) {
  const { t } = useTranslation();
  const ho = hoTheme(useTheme());
  const [open, setOpen] = useState(false);
  const [verdict, setVerdict] = useState<'' | 'ok' | 'miss'>('');
  const quote = isQuote(item);
  return (
    <Pressable
      accessibilityRole="button"
      testID="home-trivia"
      onPress={() => setOpen(true)}
      style={{ borderRadius: 18, overflow: 'hidden' }}
    >
      <LinearGradient
        colors={[ho.purpleSoft, ho.blueSoft]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 18, minHeight: 170, gap: 14, justifyContent: 'space-between' }}
      >
        <View style={{ gap: 8 }}>
          <Text style={cap(ho)}>{quote ? t('home.citazione') : t('dashboard.curiosita')}</Text>
          <Text
            style={{
              color: ho.text,
              fontSize: 19,
              lineHeight: 24,
              fontWeight: '700',
              letterSpacing: -0.19,
            }}
          >
            {item.domanda}
          </Text>
          {open ? (
            <Text
              testID="home-trivia-answer"
              style={{ color: ho.greenInk, fontSize: 19, fontWeight: '800' }}
            >
              {item.risposta}
            </Text>
          ) : null}
        </View>
        {open ? (
          !quote && !verdict ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                testID="home-trivia-ok"
                onPress={() => setVerdict('ok')}
                style={[styles.btnLg, { backgroundColor: ho.blue }]}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                  {t('home.presa_bene')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                testID="home-trivia-miss"
                onPress={() => setVerdict('miss')}
                style={[styles.btnLg, { backgroundColor: ho.surface2 }]}
              >
                <Text style={{ color: ho.text, fontWeight: '700', fontSize: 15 }}>
                  {t('home.mancata')}
                </Text>
              </Pressable>
            </View>
          ) : null
        ) : (
          <Text style={{ color: ho.text2, fontSize: 13 }}>{t('dashboard.tocca_per_scoprire')}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  btnSm: { height: 34, paddingHorizontal: 13, borderRadius: 12, justifyContent: 'center' },
  btnLg: { flex: 1, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pj: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  dotPj: { width: 9, height: 9, borderRadius: 5 },
  kv: { flex: 1, paddingVertical: 9, paddingHorizontal: 11, borderRadius: 14 },
  kvCell: {
    width: '47%',
    flexGrow: 1,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 14,
  },
  trk: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  trkIco: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 6 },
  now: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 3,
    overflow: 'hidden',
    minHeight: 100,
  },
  nowK: {
    color: '#fff',
    opacity: 0.85,
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1.15,
    textTransform: 'uppercase',
  },
  nowT: { color: '#fff', fontSize: 19, fontWeight: '800', letterSpacing: -0.19 },
  nowM: { color: '#fff', opacity: 0.9, fontSize: 13.5 },
  ev: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 6 },
  li: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 46, paddingVertical: 5 },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  av: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingLeft: 9,
    paddingRight: 12,
    borderRadius: 22,
  },
  avOk: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  time: { fontSize: 12, width: 48 },
  sub: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  late: { borderRadius: 12, padding: 10, gap: 8 },
  btn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  check: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
});
