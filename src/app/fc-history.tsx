import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { formatDuration } from '@/features/flashcards/format';
import { kitForCourse } from '@/features/flashcards/gameKit';
import {
  chainOf,
  filterHistory,
  historyEntries,
  summarize,
  type HistoryKind,
  type HistorySort,
  type HistoryState,
} from '@/features/flashcards/history';
import { HistoryRoad, MiniClimb } from '@/features/flashcards/HistoryRoad';
import { Icon } from '@/features/flashcards/game/GameUi';
import { HistorySubjects } from '@/features/flashcards/HistorySubjects';
import { deckBranch, flattenDecks } from '@/features/flashcards/logic';
import { buildSubjects, groupActivity } from '@/features/flashcards/subjects';
import { localToday } from '@/features/tasks/groups';
import { DateTimeField } from '@/ui/DateTimeField';
import { Sheet } from '@/features/habits/Sheet';
import { habitsTheme } from '@/features/habits/habitsTheme';

type Period = 7 | 30 | 90 | 0 | 'custom';
const addDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Una barra a segmenti (.sfc-seg): i tasti in fila, quello scelto in rilievo. */
function Seg<T extends string | number>({
  id,
  value,
  options,
  onChange,
  wrap,
  tone,
}: {
  id: string;
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
  wrap?: boolean;
  tone?: string;
}) {
  const th = useTheme();
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        flexWrap: wrap ? 'wrap' : 'nowrap',
        gap: 2,
        padding: 3,
        borderRadius: 12,
        backgroundColor: tone ?? th.hairline,
      }}
    >
      {options.map((o) => {
        const on = value === o.v;
        return (
          <Pressable
            key={String(o.v)}
            testID={`fch-${id}-${o.v === '' ? 'all' : o.v}`}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.v)}
            style={{
              flexGrow: 1,
              flexBasis: wrap ? '45%' : 0,
              paddingVertical: 7,
              paddingHorizontal: 4,
              borderRadius: 9,
              alignItems: 'center',
              backgroundColor: on ? th.surface : 'transparent',
              boxShadow: on ? '0 1px 3px rgba(0,0,0,0.12)' : undefined,
            }}
          >
            <Text
              numberOfLines={1}
              style={{ color: on ? th.text : th.text2, fontSize: 13, fontWeight: '600' }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Il tondo dell'intestazione (.sfc-icon-btn). */
function RoundBtn(p: {
  testID: string;
  label: string;
  icon: string | string[];
  on?: boolean;
  small?: boolean;
  badge?: number;
  onPress: () => void;
}) {
  const th = useTheme();
  const size = p.small ? 36 : 40;
  return (
    <Pressable
      testID={p.testID}
      accessibilityRole="button"
      accessibilityLabel={p.label}
      accessibilityState={{ selected: !!p.on }}
      onPress={p.onPress}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: p.on ? th.blueSoft : th.surface,
        borderWidth: 0.5,
        borderColor: th.hairline,
        transform: [{ scale: pressed ? 0.88 : 1 }],
      })}
    >
      <Icon d={p.icon} size={p.small ? 16 : 18} color={p.on ? th.blue : th.text} width={2} />
      {p.badge ? (
        <View
          style={{
            position: 'absolute',
            top: -3,
            right: -3,
            minWidth: 16,
            height: 16,
            paddingHorizontal: 4,
            borderRadius: 99,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: th.red,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{p.badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const IC = {
  back: 'm15 18-6-6 6-6',
  filter: ['M4 6h16', 'M7 12h10', 'M10 18h4'],
  play: 'M7 4.6v14.8a1 1 0 0 0 1.5.86l12-7.4a1 1 0 0 0 0-1.72l-12-7.4A1 1 0 0 0 7 4.6Z',
  calendar: [
    'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z',
    'M16 3v4M8 3v4M4 11h16',
  ],
  density: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  trophy: [
    'M8 21h8M12 17v4',
    'M7 4h10v5a5 5 0 0 1-10 0Z',
    'M17 5h3v2a3 3 0 0 1-3 3',
    'M7 5H4v2a3 3 0 0 0 3 3',
  ],
  target: [
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
    'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z',
    'M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z',
  ],
  star: 'm12 2.5 2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.6l-6 3.3 1.3-6.7-5-4.7 6.8-.8Z',
  retry: ['M3 12a9 9 0 1 0 2.8-6.5', 'M3 4v5h5'],
  results: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'],
  eye: [
    'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z',
    'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z',
  ],
  trash: [
    'M4 7h16',
    'M10 11v6M14 11v6',
    'M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12',
    'M9 7V4h6v3',
  ],
  x: 'M6 6l12 12M18 6 6 18',
  empty: [
    'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z',
    'M16 3v4M8 3v4M4 11h16',
  ],
};

/** La precisione: verde da 80, arancio da 50, rossa sotto (classePrecisione del sito). */
const pctOf = (ok: number, ko: number): number | null =>
  ok + ko ? Math.round((ok / (ok + ko)) * 100) : null;

/** L'anello di una partita (.sfc-anello): quanti concetti sono finiti, nel colore del mazzo. */
function GameRing({ done, color }: { done: number; color: string }) {
  const th = useTheme();
  const c = 2 * Math.PI * 12;
  return (
    <Svg width={32} height={32} viewBox="0 0 30 30" style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={15} cy={15} r={12} fill="none" stroke={th.hairline} strokeWidth={3.2} />
      {done > 0 ? (
        <Circle
          cx={15}
          cy={15}
          r={12}
          fill="none"
          stroke={color}
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeDasharray={`${(done * c).toFixed(1)} ${c}`}
        />
      ) : null}
    </Svg>
  );
}

/** La barretta giuste/sbagliate (.sfc-mini-barra, .sfc-det-barra). */
function OkKoBar({ p, h }: { p: number | null; h: number }) {
  const th = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        height: h,
        borderRadius: 99,
        overflow: 'hidden',
        backgroundColor: th.hairline,
      }}
    >
      <View style={{ width: `${p ?? 0}%`, backgroundColor: th.green }} />
      <View style={{ width: `${p === null ? 0 : 100 - p}%`, backgroundColor: th.red }} />
    </View>
  );
}

/**
 * Lo storico delle partite (fc_history.php), versione semplice: le partite dalla più recente, con il periodo da guardare;
 * quella lasciata a metà si riprende, le altre aprono il risultato. Si può togliere una partita.
 */
export default function HistoryScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services, version } = useApp();
  const { course } = useLocalSearchParams<{ course?: string }>();
  const kit = useMemo(() => (services ? kitForCourse(services, course) : null), [services, course]);
  const [period, setPeriod] = useState<Period>(30);
  const [asking, setAsking] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [state, setState] = useState<HistoryState>('all');
  const [kind, setKind] = useState<HistoryKind>('any');
  const [sort, setSort] = useState<HistorySort>('recent');
  const [subject, setSubject] = useState<string | null>(null);
  const [view, setView] = useState<'games' | 'subjects'>('games');
  const [detailed, setDetailed] = useState(false);
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [showDates, setShowDates] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const entries = useMemo(() => {
    void version;
    void tick;
    return kit ? historyEntries(kit.games) : null;
  }, [kit, version, tick]);
  const decks = useMemo(() => {
    void version;
    return kit ? kit.decks() : [];
  }, [kit, version]);
  const today = localToday();
  // un intervallo scelto a mano vale con le due date; se sono capovolte si girano (come sul sito)
  const customLow = customFrom && customTo && customFrom > customTo ? customTo : customFrom;
  const customHigh = customFrom && customTo && customFrom > customTo ? customFrom : customTo;
  const from = period === 'custom' ? customLow : period ? addDays(today, 1 - period) : '';
  const to = period === 'custom' ? customHigh : '';
  const rows = useMemo(() => {
    if (!entries) return null;
    return filterHistory(entries, {
      state,
      kind,
      sort,
      from,
      to,
      subject: subject ? new Set(deckBranch(decks, subject)) : null,
    });
  }, [entries, from, to, state, kind, sort, subject, decks]);
  const activity = useMemo(() => {
    void version;
    void tick;
    return kit ? groupActivity(kit.games.answersByDay(from, to), from, to, today) : null;
  }, [kit, version, tick, from, to, today]);
  const tree = useMemo(() => {
    void version;
    void tick;
    return kit && view === 'subjects' ? buildSubjects(kit.games.subjectRows(from, to)) : null;
  }, [kit, version, tick, from, to, view]);
  if (!services || !rows || !kit) return null;
  const ht = habitsTheme(th.scheme, th.brand, th.style);
  const summary = summarize(rows);
  const accuracy = pctOf(summary.correct, summary.wrong);
  const periods: { v: Period; label: string }[] = [
    { v: 7, label: t('fc.sfc_per_7') },
    { v: 30, label: t('fc.sfc_per_30') },
    { v: 90, label: t('fc.sfc_per_90') },
    { v: 0, label: t('fc.sfc_per_tutto') },
  ];
  const deckOf = (id: string) => decks.find((d) => d.uuid === id);
  const nameOf = (e: { decks: string[] }) =>
    e.decks.length
      ? e.decks
          .map((d) => deckOf(d)?.name ?? '')
          .filter(Boolean)
          .join(', ')
      : t('fc.cs_tutte_materie');
  const colorOf = (e: { decks: string[] }) => {
    const c = e.decks[0] ? deckOf(e.decks[0])?.color : null;
    return c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#8E8E93';
  };
  const pctTone = (p: number | null) =>
    p === null
      ? { fg: th.text2, bg: th.surface2 }
      : p >= 80
        ? { fg: th.green, bg: th.greenSoft }
        : p >= 50
          ? { fg: th.orange, bg: th.orangeSoft }
          : { fg: th.red, bg: th.redSoft };
  const daysAgo = (iso: string | null) => {
    if (!iso) return null;
    const a = new Date(`${today}T12:00:00`).getTime();
    const b = new Date(`${iso.slice(0, 10)}T12:00:00`).getTime();
    return Math.round((a - b) / 86400000);
  };
  const relative = (iso: string | null) => {
    const n = daysAgo(iso);
    return n === null
      ? ''
      : n <= 0
        ? t('fc.sfc_rel_oggi')
        : n === 1
          ? t('fc.sfc_rel_ieri')
          : t('fc.sfc_rel_giorni', { n });
  };
  const dayLabel = (iso: string) => {
    const n = daysAgo(iso);
    if (n === 0) return t('comune.oggi');
    if (n === 1) return t('comune.ieri');
    const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
    const s = d.toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const clock = (iso: string | null) => (iso ?? '').slice(11, 16);
  const go = (game: string, resume: number | null) =>
    resume !== null
      ? router.push({ pathname: '/fc-game', params: { game, position: String(resume) } })
      : router.push({ pathname: '/fc-result', params: { game } });
  const activeFilters =
    (state !== 'all' ? 1 : 0) +
    (kind !== 'any' ? 1 : 0) +
    (sort !== 'recent' ? 1 : 0) +
    (subject ? 1 : 0);
  const periodLabel =
    period === 'custom'
      ? `${customLow || '…'} – ${customHigh || '…'}`
      : t(`fc.sfc_per_${period === 0 ? 'tutto' : period}_lungo`);
  const toResume = rows.filter(
    (e) => e.resume !== null || e.retries.some((r) => r.resume !== null),
  );

  // i filtri accesi diventano pastiglie sotto il titolo (si tolgono col tondino)
  const chips: { k: string; label: string; clear: () => void }[] = [
    ...(state !== 'all'
      ? [
          {
            k: 'state',
            label: state === 'open' ? t('fc.sfc_in_sospeso') : t('fc.sfc_f_stato_concluse'),
            clear: () => setState('all'),
          },
        ]
      : []),
    ...(kind !== 'any'
      ? [{ k: 'kind', label: t(`fc.sfc_st_${kind}`), clear: () => setKind('any') }]
      : []),
    ...(sort !== 'recent'
      ? [
          {
            k: 'sort',
            label: t(
              `fc.sfc_o_${sort === 'long' ? 'lunghe' : sort === 'errors' ? 'errori' : 'precisione'}`,
            ),
            clear: () => setSort('recent'),
          },
        ]
      : []),
    ...(subject
      ? [{ k: 'subject', label: deckOf(subject)?.name ?? '', clear: () => setSubject(null) }]
      : []),
  ];

  /** Un tasto del dettaglio (.sfc-btn). */
  const btn = (
    testID: string,
    label: string,
    icon: string | string[],
    onPress: () => void,
    tone: 'plain' | 'primary' | 'fix' | 'danger' = 'plain',
  ): ReactNode => (
    <Pressable
      key={testID}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: 99,
        overflow: 'hidden',
        marginLeft: tone === 'danger' ? 'auto' : 0,
        backgroundColor: tone === 'primary' ? th.blue : tone === 'fix' ? '#FF9F0A' : th.surface2,
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}
    >
      {tone === 'fix' ? (
        <LinearGradient
          colors={['#FF9F0A', '#FF375F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 8,
          paddingHorizontal: tone === 'danger' ? 10 : 13,
        }}
      >
        <Icon
          d={icon}
          size={14}
          width={2.2}
          color={
            tone === 'primary' || tone === 'fix' ? '#fff' : tone === 'danger' ? th.red : th.text
          }
          fill={icon === IC.play}
        />
        {tone === 'danger' ? null : (
          <Text
            style={{
              color: tone === 'primary' || tone === 'fix' ? '#fff' : th.text,
              fontSize: 13,
              fontWeight: '700',
            }}
          >
            {label}
          </Text>
        )}
      </View>
    </Pressable>
  );

  // le righe, giorno per giorno quando sono in ordine di data
  const byDay = sort === 'recent';
  // la prima partita di ogni giorno porta il titolo del giorno
  const dayHeads = new Set<string>();
  {
    let prev = '';
    for (const e of rows) {
      const d = (e.game.game_date ?? '').slice(0, 10);
      if (d !== prev) dayHeads.add(e.game.uuid);
      prev = d;
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      {/* l'intestazione (.sfc-hdr) */}
      <View
        style={{
          paddingTop: insets.top + 14,
          paddingBottom: 12,
          paddingHorizontal: 16,
          backgroundColor: th.headerGlass,
          borderBottomWidth: 0.5,
          borderBottomColor: th.hairline,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <RoundBtn
            testID="fch-close"
            label={t('comune.chiudi')}
            icon={IC.back}
            onPress={() => router.back()}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{ color: th.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.6 }}
            >
              {t('fc.sfc_storico')}
            </Text>
            <Text
              numberOfLines={1}
              style={{ color: th.text2, fontSize: 13, fontWeight: '500', marginTop: 2 }}
            >
              {t(summary.games === 1 ? 'fc.sfc_sub_1' : 'fc.sfc_sub', {
                n: summary.games,
                periodo: periodLabel,
              })}
            </Text>
          </View>
          {view === 'games' ? (
            <RoundBtn
              testID="fch-filters"
              label={t('fc.sfc_filtri')}
              icon={IC.filter}
              on={showFilters}
              badge={activeFilters}
              onPress={() => setShowFilters(true)}
            />
          ) : null}
          <Pressable
            testID="fch-play"
            accessibilityRole="button"
            accessibilityLabel={t('fc.cg_gioca')}
            onPress={() =>
              router.push(course ? { pathname: '/fc-setup', params: { course } } : '/fc-setup')
            }
            style={({ pressed }) => ({
              width: 46,
              height: 46,
              borderRadius: 23,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 6px 18px -6px ${th.blue}`,
              transform: [{ scale: pressed ? 0.9 : 1 }],
            })}
          >
            <LinearGradient
              colors={[th.indigo, th.blue]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            <View style={{ marginLeft: 2 }}>
              <Icon d={IC.play} size={19} color="#fff" fill />
            </View>
          </Pressable>
        </View>
        {chips.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingTop: 10 }}>
            {chips.map((c) => (
              <View
                key={c.k}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingVertical: 5,
                  paddingLeft: 11,
                  paddingRight: 5,
                  borderRadius: 99,
                  backgroundColor: th.blueSoft,
                }}
              >
                <Text style={{ color: th.blue, fontSize: 12.5, fontWeight: '700' }}>{c.label}</Text>
                <Pressable
                  testID={`fch-chip-${c.k}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('comune.chiudi')}
                  onPress={c.clear}
                  hitSlop={6}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: `${th.blue}2E`,
                  }}
                >
                  <Icon d={IC.x} size={9} color={th.blue} width={3} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}>
        {/* da riprendere (.sfc-riprendi): le partite lasciate a metà, una per pagina */}
        {view === 'games' && toResume.length ? (
          <View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: 22,
                marginBottom: 8,
                marginHorizontal: 20,
              }}
            >
              <Text style={{ color: th.text2, fontSize: 13, fontWeight: '700' }}>
                {t('fc.sfc_da_riprendere')}
              </Text>
              <Text style={{ color: th.text2, fontSize: 13, fontWeight: '700' }}>
                {toResume.length}
              </Text>
            </View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={{ paddingHorizontal: 16 }}
              contentContainerStyle={{ gap: 0 }}
            >
              {toResume.map((e) => {
                const retry =
                  e.resume === null ? e.retries.find((r) => r.resume !== null) : undefined;
                const part = retry ?? e;
                const col = colorOf(e);
                const pct = part.total > 0 ? Math.round((part.closed / part.total) * 100) : 0;
                return (
                  <Pressable
                    key={e.game.uuid}
                    testID={`fch-resume-card-${e.game.uuid}`}
                    accessibilityRole="button"
                    onPress={() => go(part.game.uuid, part.resume)}
                    style={({ pressed }) => ({
                      width: 358,
                      marginRight: 10,
                      gap: 3,
                      paddingVertical: 12,
                      paddingHorizontal: 13,
                      borderRadius: 22,
                      backgroundColor: th.surface,
                      borderWidth: 0.5,
                      borderColor: th.hairline,
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                      <View
                        style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: col }}
                      />
                      <Text
                        numberOfLines={1}
                        style={{ flex: 1, color: th.text, fontSize: 15, fontWeight: '700' }}
                      >
                        {nameOf(e)}
                      </Text>
                    </View>
                    <Text numberOfLines={1} style={{ color: th.text2, fontSize: 12.5 }}>
                      {retry
                        ? t('fc.sfc_ripasso_errori')
                        : e.game.card_status
                          ? t(`fc.sfc_st_${e.game.card_status}`)
                          : ' '}
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 7,
                        marginBottom: 5,
                      }}
                    >
                      <View
                        style={{
                          flex: 1,
                          height: 5,
                          borderRadius: 99,
                          overflow: 'hidden',
                          backgroundColor: th.hairline,
                        }}
                      >
                        <View
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            borderRadius: 99,
                            backgroundColor: col,
                          }}
                        />
                      </View>
                      <Text style={{ color: th.text2, fontSize: 12, fontWeight: '700' }}>
                        {part.closed}/{part.total}
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <Text numberOfLines={1} style={{ flex: 1, color: th.text2, fontSize: 12 }}>
                        {relative(part.game.game_date)}
                        {part.seconds >= 60 ? ` · ${formatDuration(part.seconds)}` : ''}
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 5,
                          paddingVertical: 5,
                          paddingHorizontal: 10,
                          borderRadius: 99,
                          backgroundColor: th.blue,
                        }}
                      >
                        <Icon d={IC.play} size={10} color="#fff" fill />
                        <Text style={{ color: '#fff', fontSize: 12.5, fontWeight: '700' }}>
                          {t('fc.sfc_riprendi')}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* il periodo (.sfc-periodo): la scelta, le date, i tre numeri e l'attività */}
        <View
          style={{
            marginTop: 16,
            marginHorizontal: 16,
            padding: 12,
            borderRadius: 22,
            backgroundColor: th.surface,
            borderWidth: 0.5,
            borderColor: th.hairline,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Seg
              id="period"
              value={period === 'custom' ? ('x' as unknown as Period) : period}
              options={periods}
              onChange={(v) => {
                setPeriod(v);
                setShowDates(false);
              }}
            />
            <RoundBtn
              testID="fch-dates"
              small
              label={t('fc.sfc_date')}
              icon={IC.calendar}
              on={period === 'custom'}
              onPress={() => {
                if (!showDates) {
                  setCustomFrom((v) => v || addDays(today, -29));
                  setCustomTo((v) => v || today);
                  setPeriod('custom');
                }
                setShowDates((v) => !v);
              }}
            />
          </View>
          {showDates ? (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: th.text2, fontSize: 11.5, fontWeight: '700' }}>
                  {t('fc.sfc_dal')}
                </Text>
                <DateTimeField
                  kind="date"
                  testID="fch-from"
                  value={customFrom}
                  fallback={today}
                  onChange={(v) => {
                    setCustomFrom(v);
                    setPeriod('custom');
                  }}
                />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: th.text2, fontSize: 11.5, fontWeight: '700' }}>
                  {t('fc.sfc_al')}
                </Text>
                <DateTimeField
                  kind="date"
                  testID="fch-to"
                  value={customTo}
                  fallback={today}
                  onChange={(v) => {
                    setCustomTo(v);
                    setPeriod('custom');
                  }}
                />
              </View>
            </View>
          ) : null}
          <View testID="fch-summary" style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            {[
              [t('fc.sfc_m_partite'), String(summary.games)],
              [t('fc.sfc_m_tempo'), formatDuration(summary.seconds)],
              [t('fc.sfc_m_precisione'), accuracy === null ? '–' : `${accuracy}%`],
            ].map(([l, v]) => (
              <View
                key={l}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 12,
                  backgroundColor: th.surface2,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{ color: th.text2, fontSize: 11.5, fontWeight: '600' }}
                >
                  {l}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    color: th.text,
                    fontSize: 18,
                    fontWeight: '800',
                    letterSpacing: -0.2,
                    marginTop: 1,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {v}
                </Text>
              </View>
            ))}
          </View>
          {activity ? (
            <View
              testID="fch-activity"
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                gap: 2,
                height: 32,
                marginTop: 12,
                marginHorizontal: 2,
              }}
            >
              {activity.bars.map((b, i) => {
                const max = Math.max(1, ...activity.bars.map((x) => x.n));
                return (
                  <View
                    key={b.d}
                    testID={`fch-activity-bar-${i}`}
                    style={{
                      flex: 1,
                      minWidth: 1,
                      borderRadius: 2,
                      height: b.n > 0 ? Math.max(4, (b.n / max) * 32) : 3,
                      backgroundColor: b.n > 0 ? th.blue : th.hairline,
                    }}
                  />
                );
              })}
            </View>
          ) : null}
        </View>

        {/* partite o materie, e la densità (.sfc-vista-riga) */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 18,
            marginHorizontal: 16,
          }}
        >
          <Seg
            id="view"
            value={view}
            options={[
              { v: 'games', label: t('fc.sfc_vista_partite') },
              { v: 'subjects', label: t('fc.sfc_vista_materie') },
            ]}
            onChange={setView}
          />
          {view === 'games' ? (
            <RoundBtn
              testID="fch-density"
              small
              label={t('fc.sfc_densita')}
              icon={IC.density}
              on={detailed}
              onPress={() => setDetailed((v) => !v)}
            />
          ) : null}
        </View>

        {view === 'subjects' && tree ? (
          <View style={{ paddingHorizontal: 16 }}>
            <HistorySubjects
              tree={tree}
              today={today}
              onFilter={(id) => {
                setSubject(id);
                setView('games');
              }}
              onPlay={(id) =>
                router.push({
                  pathname: '/fc-setup',
                  params: { preselect: id, ...(course ? { course } : {}) },
                })
              }
            />
          </View>
        ) : null}

        {view === 'games' ? (
          <View style={{ paddingTop: 4, paddingHorizontal: 16 }}>
            {rows.length === 0 ? (
              <View
                testID="fch-empty"
                style={{
                  alignItems: 'center',
                  paddingTop: 48,
                  paddingHorizontal: 30,
                  paddingBottom: 30,
                }}
              >
                <Icon d={IC.empty} size={48} color={th.text3} width={1.6} />
                <Text
                  style={{
                    color: th.text,
                    fontSize: 17,
                    fontWeight: '700',
                    marginTop: 12,
                    marginBottom: 6,
                  }}
                >
                  {t(activeFilters ? 'fc.sfc_vuoto_filtri_tit' : 'fc.sfc_vuoto_tit')}
                </Text>
                <Text
                  style={{ color: th.text2, fontSize: 14, textAlign: 'center', marginBottom: 16 }}
                >
                  {t(activeFilters ? 'fc.sfc_vuoto_filtri_txt' : 'fc.sfc_vuoto_txt')}
                </Text>
                {activeFilters ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setState('all');
                      setKind('any');
                      setSort('recent');
                      setSubject(null);
                    }}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 18,
                      borderRadius: 99,
                      backgroundColor: th.blueSoft,
                    }}
                  >
                    <Text style={{ color: th.blue, fontSize: 14, fontWeight: '700' }}>
                      {t('fc.sfc_reimposta')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {rows.map((e) => {
              const g = e.game;
              const ch = chainOf(e);
              const suspended = ch.suspended;
              const isGold = !suspended && (ch.state === 'perfetta' || ch.state === 'conquistata');
              const fix = !suspended && ch.state === 'aperta' && ch.toFix > 0;
              const p = pctOf(e.correct, e.wrong);
              const tone = pctTone(p);
              const col = colorOf(e);
              const isOpen = openIds.includes(g.uuid);
              const day = (g.game_date ?? '').slice(0, 10);
              const header = byDay && dayHeads.has(g.uuid) ? day : null;
              const meta = `${byDay ? clock(g.game_date) : `${day} · ${clock(g.game_date)}`}${e.seconds >= 60 ? ` · ${formatDuration(e.seconds)}` : ''}`;
              return (
                <View key={g.uuid}>
                  {header ? (
                    <Text
                      style={{
                        color: th.text2,
                        fontSize: 13,
                        fontWeight: '700',
                        marginTop: 18,
                        marginBottom: 6,
                        marginHorizontal: 4,
                      }}
                    >
                      {dayLabel(header)}
                    </Text>
                  ) : null}
                  <View
                    style={{
                      marginBottom: 6,
                      borderRadius: 16,
                      overflow: 'hidden',
                      padding: isGold ? 1.5 : 0,
                      backgroundColor: isGold ? '#FFC300' : 'transparent',
                    }}
                  >
                    <View
                      style={{
                        borderRadius: isGold ? 14.5 : 16,
                        overflow: 'hidden',
                        backgroundColor: th.surface,
                        borderWidth: isGold ? 0 : 0.5,
                        borderColor: th.hairline,
                      }}
                    >
                      {isGold ? (
                        <LinearGradient
                          pointerEvents="none"
                          colors={['rgba(255,214,10,0.10)', 'transparent']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 0.55, y: 0.55 }}
                          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                        />
                      ) : null}
                      <Pressable
                        testID={`fch-game-${g.uuid}`}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: isOpen }}
                        onPress={() =>
                          setOpenIds((cur) =>
                            cur.includes(g.uuid)
                              ? cur.filter((x) => x !== g.uuid)
                              : [...cur, g.uuid],
                          )
                        }
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                        }}
                      >
                        {isGold ? (
                          <View
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 16,
                              overflow: 'hidden',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <LinearGradient
                              colors={['#FFE680', '#FFC300', '#FF9F0A']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                            />
                            <Icon d={IC.trophy} size={17} color="#7A4A00" width={2.2} />
                          </View>
                        ) : (
                          <GameRing
                            done={e.total > 0 ? Math.min(1, e.closed / e.total) : 0}
                            color={col}
                          />
                        )}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text
                            numberOfLines={1}
                            style={{ color: th.text, fontSize: 15.5, fontWeight: '700' }}
                          >
                            {nameOf(e)}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={{
                              color: th.text2,
                              fontSize: 12.5,
                              marginTop: 1,
                              fontVariant: ['tabular-nums'],
                            }}
                          >
                            {meta}
                          </Text>
                          {isGold ? (
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 5,
                                marginTop: 5,
                              }}
                            >
                              <Icon d={IC.trophy} size={13} color="#FFD60A" width={2.2} />
                              <Text
                                testID={`fch-plate-${g.uuid}`}
                                numberOfLines={1}
                                style={{ color: '#FFD60A', fontSize: 12, fontWeight: '800' }}
                              >
                                {ch.state === 'perfetta'
                                  ? t('fc.sfc_perfetta')
                                  : t(
                                      e.retries.length === 1
                                        ? 'fc.sfc_conquistata_1'
                                        : 'fc.sfc_conquistata_n',
                                      { n: e.retries.length },
                                    )}
                              </Text>
                            </View>
                          ) : fix ? (
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 5,
                                marginTop: 5,
                              }}
                            >
                              <Icon d={IC.target} size={13} color={th.orange} width={2.2} />
                              <Text
                                testID={`fch-plate-${g.uuid}`}
                                numberOfLines={1}
                                style={{ color: th.orange, fontSize: 12, fontWeight: '800' }}
                              >
                                {t(
                                  ch.toFix === 1
                                    ? 'fc.sfc_da_sistemare_1'
                                    : 'fc.sfc_da_sistemare_n',
                                  { n: ch.toFix },
                                )}
                              </Text>
                              <MiniClimb chain={ch} />
                            </View>
                          ) : null}
                          {detailed ? (
                            <View
                              style={{
                                flexDirection: 'row',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                columnGap: 10,
                                rowGap: 4,
                                marginTop: 5,
                              }}
                            >
                              <Text style={{ color: th.text2, fontSize: 12, fontWeight: '600' }}>
                                {t('fc.sfc_carte_n', { c: e.closed, t: e.total })}
                              </Text>
                              <Text style={{ color: th.text2, fontSize: 12, fontWeight: '600' }}>
                                {t(e.wrong === 1 ? 'fc.sfc_errori_1' : 'fc.sfc_errori_n', {
                                  n: e.wrong,
                                })}
                              </Text>
                              {e.retries.length ? (
                                <Text style={{ color: th.text2, fontSize: 12, fontWeight: '600' }}>
                                  {t(
                                    e.retries.length === 1
                                      ? 'fc.sfc_ripassi_1'
                                      : 'fc.sfc_ripassi_n',
                                    { n: e.retries.length },
                                  )}
                                </Text>
                              ) : null}
                              <View style={{ flexGrow: 1, flexBasis: 60 }}>
                                <OkKoBar p={p} h={4} />
                              </View>
                            </View>
                          ) : null}
                        </View>
                        {/* la pastiglia: in sospeso, 100% d'oro, o la precisione */}
                        {suspended ? (
                          <View
                            style={{
                              paddingVertical: 3,
                              paddingHorizontal: 9,
                              borderRadius: 99,
                              backgroundColor: th.blueSoft,
                            }}
                          >
                            <Text style={{ color: th.blue, fontSize: 12, fontWeight: '700' }}>
                              {t('fc.sfc_in_sospeso')}
                            </Text>
                          </View>
                        ) : isGold ? (
                          <View
                            testID={`fch-gold-${g.uuid}`}
                            accessible
                            accessibilityLabel="★ 100%"
                            style={{ borderRadius: 99, overflow: 'hidden' }}
                          >
                            <LinearGradient
                              colors={['#FFE680', '#FFC300', '#FFAA1A']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                paddingVertical: 3,
                                paddingHorizontal: 9,
                              }}
                            >
                              <Icon d={IC.star} size={12} color="#5C3A00" fill />
                              <Text style={{ color: '#5C3A00', fontSize: 12, fontWeight: '700' }}>
                                ★ 100%
                              </Text>
                            </LinearGradient>
                          </View>
                        ) : (
                          <View
                            style={{
                              paddingVertical: 3,
                              paddingHorizontal: 9,
                              borderRadius: 99,
                              backgroundColor: tone.bg,
                            }}
                          >
                            <Text
                              style={{
                                color: tone.fg,
                                fontSize: 12,
                                fontWeight: '700',
                                fontVariant: ['tabular-nums'],
                              }}
                            >
                              {p === null ? '–' : `${p}%`}
                            </Text>
                          </View>
                        )}
                      </Pressable>

                      {/* il dettaglio (.sfc-det): i numeri, la barra, la strada, i ripassi e i tasti */}
                      {isOpen ? (
                        <View
                          testID={`fch-detail-${g.uuid}`}
                          style={{
                            paddingTop: 2,
                            paddingRight: 12,
                            paddingBottom: 12,
                            paddingLeft: 56,
                          }}
                        >
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            {[
                              [t('fc.sfc_d_carte'), `${e.closed}/${e.total}`],
                              [t('fc.sfc_d_errori'), String(e.wrong)],
                              [t('fc.sfc_d_tempo'), formatDuration(e.seconds)],
                              [t('fc.sfc_d_sessioni'), String(e.sessions)],
                            ].map(([l, v]) => (
                              <View key={l} style={{ flex: 1, minWidth: 0 }}>
                                <Text
                                  numberOfLines={1}
                                  style={{ color: th.text2, fontSize: 11, fontWeight: '600' }}
                                >
                                  {l}
                                </Text>
                                <Text
                                  numberOfLines={1}
                                  style={{
                                    color: th.text,
                                    fontSize: 15,
                                    fontWeight: '800',
                                    fontVariant: ['tabular-nums'],
                                  }}
                                >
                                  {v}
                                </Text>
                              </View>
                            ))}
                          </View>
                          <View style={{ marginTop: 10, marginBottom: 7 }}>
                            <OkKoBar p={p} h={6} />
                          </View>
                          <Text style={{ color: th.text2, fontSize: 12.5 }}>
                            {[
                              g.card_status ? t(`fc.sfc_st_${g.card_status}`) : '',
                              g.game_order
                                ? t(
                                    `fc.sfc_ord_${g.game_order === 'random' ? 'random' : 'in_order'}`,
                                  )
                                : '',
                              g.score !== null
                                ? t('fc.sfc_punteggio', { p: Math.round(g.score) })
                                : '',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                          {ch.climb.length > 1 || ch.state === 'aperta' ? (
                            <HistoryRoad chain={ch} testID={`fch-road-${g.uuid}`} />
                          ) : null}
                          {e.retries.length > 0 ? (
                            <View
                              testID={`fch-retries-${g.uuid}`}
                              style={{ marginTop: 10, gap: 6 }}
                            >
                              {e.retries.map((r, i) => {
                                const rp = pctOf(r.correct, r.wrong);
                                const rt = pctTone(rp);
                                return (
                                  <View
                                    key={r.game.uuid}
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                                  >
                                    <Pressable
                                      testID={`fch-retry-${r.game.uuid}`}
                                      accessibilityRole="button"
                                      onPress={() => go(r.game.uuid, r.resume)}
                                      style={({ pressed }) => ({
                                        flex: 1,
                                        minWidth: 0,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 8,
                                        paddingVertical: 7,
                                        paddingHorizontal: 10,
                                        borderRadius: 12,
                                        backgroundColor: th.surface2,
                                        transform: [{ scale: pressed ? 0.98 : 1 }],
                                      })}
                                    >
                                      <Icon
                                        d={r.resume !== null ? IC.play : IC.retry}
                                        size={14}
                                        color={th.purple}
                                        width={2.2}
                                        fill={r.resume !== null}
                                      />
                                      <Text
                                        style={{
                                          color: th.text,
                                          fontSize: 12.5,
                                          fontWeight: '700',
                                        }}
                                      >
                                        {t('fc.sfc_ripasso_n', { n: i + 1 })}
                                      </Text>
                                      <Text
                                        numberOfLines={1}
                                        style={{ flex: 1, color: th.text2, fontSize: 12.5 }}
                                      >
                                        {(r.game.game_date ?? '').slice(0, 10)}
                                      </Text>
                                      <Text
                                        style={{
                                          color: th.text2,
                                          fontSize: 12.5,
                                          fontWeight: '700',
                                        }}
                                      >
                                        {r.closed}/{r.total}
                                      </Text>
                                      <View
                                        style={{
                                          paddingVertical: 3,
                                          paddingHorizontal: 9,
                                          borderRadius: 99,
                                          backgroundColor: r.resume !== null ? th.blueSoft : rt.bg,
                                        }}
                                      >
                                        <Text
                                          style={{
                                            color: r.resume !== null ? th.blue : rt.fg,
                                            fontSize: 12,
                                            fontWeight: '700',
                                          }}
                                        >
                                          {r.resume !== null
                                            ? t('fc.sfc_in_sospeso')
                                            : rp === null
                                              ? '–'
                                              : `${rp}%`}
                                        </Text>
                                      </View>
                                    </Pressable>
                                    {r.resume !== null ? (
                                      <Pressable
                                        testID={`fch-retry-del-${r.game.uuid}`}
                                        accessibilityRole="button"
                                        accessibilityLabel={t('fc.sfc_elimina_ripasso')}
                                        onPress={() => {
                                          kit.games.remove(r.game.uuid);
                                          setTick((n) => n + 1);
                                        }}
                                        style={({ pressed }) => ({
                                          width: 34,
                                          height: 34,
                                          borderRadius: 11,
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          backgroundColor: th.redSoft,
                                          transform: [{ scale: pressed ? 0.88 : 1 }],
                                        })}
                                      >
                                        <Icon d={IC.trash} size={16} color={th.red} />
                                      </Pressable>
                                    ) : null}
                                  </View>
                                );
                              })}
                            </View>
                          ) : null}
                          <View
                            style={{
                              flexDirection: 'row',
                              flexWrap: 'wrap',
                              gap: 8,
                              marginTop: 12,
                            }}
                          >
                            {e.resume !== null
                              ? btn(
                                  `fch-resume-${g.uuid}`,
                                  t('fc.sfc_riprendi'),
                                  IC.play,
                                  () => go(g.uuid, e.resume),
                                  'primary',
                                )
                              : null}
                            {e.resume === null && e.retries.find((r) => r.resume !== null)
                              ? btn(
                                  `fch-resume-retry-${g.uuid}`,
                                  `${t('fc.sfc_riprendi')} · ${t('fc.sfc_ripasso_errori')}`,
                                  IC.play,
                                  () => {
                                    const r = e.retries.find((x) => x.resume !== null)!;
                                    go(r.game.uuid, r.resume);
                                  },
                                  'primary',
                                )
                              : null}
                            {fix
                              ? btn(
                                  `fch-fix-${g.uuid}`,
                                  t(ch.toFix === 1 ? 'fc.sfc_sistema_1' : 'fc.sfc_sistema_n', {
                                    n: ch.toFix,
                                  }),
                                  IC.retry,
                                  () => {
                                    const r = kit.games.retry(ch.lastUuid);
                                    if (r.kind === 'started')
                                      router.push({
                                        pathname: '/fc-game',
                                        params: { game: r.game, position: '1' },
                                      });
                                  },
                                  'fix',
                                )
                              : null}
                            {btn(`fch-results-${g.uuid}`, t('fc.sfc_risultati'), IC.results, () =>
                              router.push({ pathname: '/fc-result', params: { game: g.uuid } }),
                            )}
                            {e.wrong > 0
                              ? btn(
                                  `fch-errors-${g.uuid}`,
                                  t(fix ? 'fc.sfc_vedi_errori' : 'fc.sfc_ripassa'),
                                  fix ? IC.eye : IC.retry,
                                  () =>
                                    router.push({
                                      pathname: '/fc-result',
                                      params: { game: g.uuid, errors: '1' },
                                    }),
                                )
                              : null}
                            {btn(
                              `fch-del-${g.uuid}`,
                              t('comune.elimina'),
                              IC.trash,
                              () => setAsking(g.uuid),
                              'danger',
                            )}
                          </View>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      {/* i filtri (.sfc-sheet) */}
      <Sheet
        visible={showFilters}
        th={ht}
        title={t('fc.sfc_filtri')}
        testID="fch-filters-sheet"
        onClose={() => setShowFilters(false)}
        footer={
          <View style={{ flex: 1, gap: 4 }}>
            <Pressable
              testID="fch-filters-done"
              accessibilityRole="button"
              onPress={() => setShowFilters(false)}
              style={{
                height: 50,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: th.blue,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                {t('fc.sfc_fine')}
              </Text>
            </Pressable>
            <Pressable
              testID="fch-filters-reset"
              accessibilityRole="button"
              onPress={() => {
                setState('all');
                setKind('any');
                setSort('recent');
                setSubject(null);
              }}
              style={{ padding: 12, alignItems: 'center' }}
            >
              <Text style={{ color: th.red, fontSize: 14.5, fontWeight: '700' }}>
                {t('fc.sfc_reimposta')}
              </Text>
            </Pressable>
          </View>
        }
      >
        <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}>
          {(
            [
              [
                'fc.sfc_f_stato',
                <Seg
                  key="s"
                  id="f-state"
                  tone={th.surface2}
                  value={state}
                  onChange={setState}
                  options={[
                    { v: 'all', label: t('fc.sfc_f_stato_tutte') },
                    { v: 'open', label: t('fc.sfc_in_sospeso') },
                    { v: 'done', label: t('fc.sfc_f_stato_concluse') },
                  ]}
                />,
              ],
              [
                'fc.sfc_f_tipo',
                <Seg
                  key="k"
                  id="f-kind"
                  tone={th.surface2}
                  value={kind}
                  onChange={setKind}
                  options={[
                    { v: 'any', label: t('fc.sfc_f_tipo_tutti') },
                    { v: '0', label: t('fc.sfc_st_0') },
                    { v: '1', label: t('fc.sfc_st_1') },
                    { v: 'all', label: t('fc.sfc_st_all') },
                  ]}
                />,
              ],
              [
                'fc.sfc_f_ordina',
                <Seg
                  key="o"
                  id="f-sort"
                  wrap
                  tone={th.surface2}
                  value={sort}
                  onChange={setSort}
                  options={[
                    { v: 'recent', label: t('fc.sfc_o_recenti') },
                    { v: 'long', label: t('fc.sfc_o_lunghe') },
                    { v: 'errors', label: t('fc.sfc_o_errori') },
                    { v: 'accuracy', label: t('fc.sfc_o_precisione') },
                  ]}
                />,
              ],
              [
                'fc.sfc_f_materia',
                <Seg
                  key="m"
                  id="f-subject"
                  wrap
                  tone={th.surface2}
                  value={subject ?? ''}
                  onChange={(v) => setSubject(v || null)}
                  options={[
                    { v: '', label: t('fc.sfc_f_tipo_tutti') },
                    ...[...flattenDecks(decks, 'active'), ...flattenDecks(decks, 'archived')].map(
                      (r) => ({ v: r.deck.uuid, label: `${'· '.repeat(r.depth)}${r.deck.name}` }),
                    ),
                  ]}
                />,
              ],
            ] as const
          ).map(([k, node]) => (
            <View key={k} style={{ gap: 8 }}>
              <Text style={{ color: th.text2, fontSize: 13, fontWeight: '700' }}>{t(k)}</Text>
              <View style={{ flexDirection: 'row' }}>{node}</View>
            </View>
          ))}
        </ScrollView>
      </Sheet>

      {/* «Eliminare la partita?» (.sfc-alert) */}
      <Modal
        visible={asking !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAsking(null)}
      >
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.42)',
            padding: 40,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 300,
              borderRadius: 18,
              overflow: 'hidden',
              backgroundColor: th.surface,
            }}
          >
            <View style={{ padding: 20, alignItems: 'center', gap: 8 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: th.redSoft,
                }}
              >
                <Icon d={IC.trash} size={22} color={th.red} />
              </View>
              <Text
                style={{ color: th.text, fontSize: 17, fontWeight: '700', textAlign: 'center' }}
              >
                {t('fc.sfc_elimina_tit')}
              </Text>
              <Text style={{ color: th.text2, fontSize: 13.5, textAlign: 'center' }}>
                {t('fc.sfc_elimina_txt')}
              </Text>
            </View>
            <View
              style={{ flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: th.hairline }}
            >
              <Pressable
                accessibilityRole="button"
                onPress={() => setAsking(null)}
                style={{ flex: 1, padding: 14, alignItems: 'center' }}
              >
                <Text style={{ color: th.blue, fontSize: 16 }}>{t('comune.annulla')}</Text>
              </Pressable>
              <Pressable
                testID={asking ? `fch-del-yes-${asking}` : undefined}
                accessibilityRole="button"
                onPress={() => {
                  if (asking) kit.games.remove(asking);
                  setAsking(null);
                  setTick((n) => n + 1);
                }}
                style={{
                  flex: 1,
                  padding: 14,
                  alignItems: 'center',
                  borderLeftWidth: 0.5,
                  borderLeftColor: th.hairline,
                }}
              >
                <Text style={{ color: th.red, fontSize: 16, fontWeight: '700' }}>
                  {t('comune.elimina')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
