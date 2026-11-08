import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
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
import { HistoryActivity } from '@/features/flashcards/HistoryActivity';
import { HistoryRoad, MiniClimb, useGold } from '@/features/flashcards/HistoryRoad';
import { HistorySubjects } from '@/features/flashcards/HistorySubjects';
import { deckBranch, flattenDecks } from '@/features/flashcards/logic';
import { buildSubjects, groupActivity } from '@/features/flashcards/subjects';
import { localToday } from '@/features/tasks/groups';
import { DateTimeField } from '@/ui/DateTimeField';
import { Card, Header } from '@/ui/kit';

type Period = 7 | 30 | 90 | 0 | 'custom';
const addDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function FilterRow<T extends string>({
  label,
  id,
  value,
  options,
  onChange,
}: {
  label: string;
  id: string;
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const th = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: th.text2, fontSize: 12, fontWeight: '700' }}>
        {label.toUpperCase()}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {options.map((o) => (
          <Pressable
            key={o.v}
            testID={`fch-f-${id}-${o.v || 'all'}`}
            accessibilityRole="button"
            accessibilityState={{ selected: value === o.v }}
            onPress={() => onChange(o.v)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 16,
              backgroundColor: value === o.v ? th.brand : th.surface2,
            }}
          >
            <Text style={{ color: value === o.v ? '#fff' : th.text, fontWeight: '600' }}>
              {o.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
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
  const gold = useGold();
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
  if (!services || !rows) return null;
  const summary = summarize(rows);

  const periods: { v: Period; label: string }[] = [
    { v: 7, label: t('fc.sfc_per_7') },
    { v: 30, label: t('fc.sfc_per_30') },
    { v: 90, label: t('fc.sfc_per_90') },
    { v: 0, label: t('fc.sfc_per_tutto') },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        top={insets.top}
        title={t('fc.sfc_storico')}
        right={
          <Pressable testID="fch-close" accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: th.brand, fontSize: 17 }}>{t('comune.chiudi')}</Text>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 40 }}
      >
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {periods.map((p) => (
            <Pressable
              key={p.v}
              testID={`fch-period-${p.v}`}
              accessibilityRole="button"
              accessibilityState={{ selected: period === p.v }}
              onPress={() => {
                setPeriod(p.v);
                setShowDates(false);
              }}
              style={{
                paddingVertical: 7,
                paddingHorizontal: 12,
                borderRadius: 16,
                backgroundColor: period === p.v ? th.brand : th.surface2,
              }}
            >
              <Text style={{ color: period === p.v ? '#fff' : th.text, fontWeight: '600' }}>
                {p.label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            testID="fch-dates"
            accessibilityRole="button"
            accessibilityLabel={t('fc.sfc_date')}
            accessibilityState={{ expanded: showDates, selected: period === 'custom' }}
            onPress={() => {
              if (!showDates) {
                setCustomFrom((v) => v || addDays(today, -29));
                setCustomTo((v) => v || today);
                setPeriod('custom');
              }
              setShowDates((v) => !v);
            }}
            style={{
              paddingVertical: 7,
              paddingHorizontal: 12,
              borderRadius: 16,
              backgroundColor: period === 'custom' ? th.brand : th.surface2,
            }}
          >
            <Text style={{ color: period === 'custom' ? '#fff' : th.text, fontWeight: '600' }}>
              {t('fc.sfc_date')}
            </Text>
          </Pressable>
        </View>

        {showDates ? (
          <Card style={{ padding: 14, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ color: th.text2, fontWeight: '700', width: 52 }}>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ color: th.text2, fontWeight: '700', width: 52 }}>
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
          </Card>
        ) : null}

        {activity ? <HistoryActivity step={activity.step} bars={activity.bars} /> : null}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['games', 'subjects'] as const).map((v) => (
            <Pressable
              key={v}
              testID={`fch-view-${v}`}
              accessibilityRole="button"
              accessibilityState={{ selected: view === v }}
              onPress={() => setView(v)}
              style={{
                paddingVertical: 7,
                paddingHorizontal: 14,
                borderRadius: 16,
                backgroundColor: view === v ? th.text : th.surface2,
              }}
            >
              <Text style={{ color: view === v ? th.bg : th.text, fontWeight: '600' }}>
                {t(v === 'games' ? 'fc.sfc_vista_partite' : 'fc.sfc_vista_materie')}
              </Text>
            </Pressable>
          ))}
          {view === 'games' ? (
            <Pressable
              testID="fch-density"
              accessibilityRole="button"
              accessibilityLabel={t('fc.sfc_densita')}
              accessibilityState={{ selected: detailed }}
              onPress={() => setDetailed((v) => !v)}
              style={{
                marginLeft: 'auto',
                paddingVertical: 7,
                paddingHorizontal: 12,
                borderRadius: 16,
                backgroundColor: detailed ? th.brand : th.surface2,
              }}
            >
              <Text style={{ color: detailed ? '#fff' : th.text, fontWeight: '600' }}>☰</Text>
            </Pressable>
          ) : null}
        </View>

        {view === 'subjects' && tree ? (
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
        ) : null}

        {view === 'games' ? (
          <>
            <Pressable
              testID="fch-filters"
              accessibilityRole="button"
              accessibilityState={{ expanded: showFilters }}
              onPress={() => setShowFilters((v) => !v)}
            >
              <Text style={{ color: th.brand, fontWeight: '600' }}>
                {t('fc.sfc_filtri')} {showFilters ? '▴' : '▾'}
              </Text>
            </Pressable>

            {showFilters ? (
              <Card style={{ padding: 14, gap: 12 }}>
                <FilterRow
                  label={t('fc.sfc_f_stato')}
                  id="state"
                  value={state}
                  onChange={setState}
                  options={[
                    { v: 'all', label: t('fc.sfc_f_stato_tutte') },
                    { v: 'open', label: t('fc.sfc_in_sospeso') },
                    { v: 'done', label: t('fc.sfc_f_stato_concluse') },
                  ]}
                />
                <FilterRow
                  label={t('fc.sfc_f_tipo')}
                  id="kind"
                  value={kind}
                  onChange={setKind}
                  options={[
                    { v: 'any', label: t('fc.sfc_f_tipo_tutti') },
                    { v: '0', label: t('fc.sfc_st_0') },
                    { v: '1', label: t('fc.sfc_st_1') },
                    { v: 'all', label: t('fc.sfc_st_all') },
                  ]}
                />
                <FilterRow
                  label={t('fc.sfc_f_ordina')}
                  id="sort"
                  value={sort}
                  onChange={setSort}
                  options={[
                    { v: 'recent', label: t('fc.sfc_o_recenti') },
                    { v: 'long', label: t('fc.sfc_o_lunghe') },
                    { v: 'errors', label: t('fc.sfc_o_errori') },
                    { v: 'accuracy', label: t('fc.sfc_o_precisione') },
                  ]}
                />
                <FilterRow
                  label={t('fc.sfc_f_materia')}
                  id="subject"
                  value={subject ?? ''}
                  onChange={(v) => setSubject(v || null)}
                  options={[
                    { v: '', label: t('fc.sfc_f_tipo_tutti') },
                    ...[...flattenDecks(decks, 'active'), ...flattenDecks(decks, 'archived')].map(
                      (r) => ({ v: r.deck.uuid, label: `${'· '.repeat(r.depth)}${r.deck.name}` }),
                    ),
                  ]}
                />
              </Card>
            ) : null}

            {rows.length > 0 ? (
              <Text testID="fch-summary" style={{ color: th.text2 }}>
                {summary.games} · {t('fc.res_corretto')} {summary.correct} · {t('fc.res_errato')}{' '}
                {summary.wrong} · {formatDuration(summary.seconds)}
              </Text>
            ) : null}

            {rows.length === 0 ? (
              <Text testID="fch-empty" style={{ color: th.text2 }}>
                {state !== 'all' || kind !== 'any' || subject
                  ? t('fc.sfc_vuoto_filtri_txt')
                  : t('fc.res_nessuna_carta')}
              </Text>
            ) : null}

            {rows.map((e) => {
              const g = e.game;
              const open = e.resume;
              const openRetry = e.retries.find((r) => r.resume !== null);
              const ch = chainOf(e);
              // una partita portata al 100% (o perfetta al primo colpo) è «d'oro»
              const isGold =
                !ch.suspended && (ch.state === 'perfetta' || ch.state === 'conquistata');
              // il prossimo ripasso parte dagli errori dell'ULTIMO passo, non della partita: così la catena arriva al 100%
              const fix = !ch.suspended && ch.state === 'aperta' && ch.toFix > 0;
              return (
                <Card key={g.uuid} style={{ padding: 14, gap: 6 }}>
                  <Pressable
                    testID={`fch-game-${g.uuid}`}
                    accessibilityRole="button"
                    onPress={() =>
                      open !== null
                        ? router.push({
                            pathname: '/fc-game',
                            params: { game: g.uuid, position: String(open) },
                          })
                        : router.push({ pathname: '/fc-result', params: { game: g.uuid } })
                    }
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: th.text, fontWeight: '700' }}>
                        {(g.game_date ?? '').slice(0, 16).replace('T', ' ')}
                      </Text>
                      <Text
                        testID={isGold ? `fch-gold-${g.uuid}` : undefined}
                        style={{
                          color: open !== null ? th.brand : isGold ? gold : th.text,
                          fontWeight: '800',
                        }}
                      >
                        {open !== null
                          ? t('fc.sfc_in_sospeso')
                          : isGold
                            ? '★ 100%'
                            : `${Math.round(e.score)}%`}
                      </Text>
                    </View>
                    <Text style={{ color: th.text2, fontSize: 13 }}>
                      {t('fc.res_corretto')} {e.correct} · {t('fc.res_errato')} {e.wrong} ·{' '}
                      {formatDuration(e.seconds)}
                    </Text>
                    {isGold ? (
                      <Text
                        testID={`fch-plate-${g.uuid}`}
                        style={{ color: gold, fontSize: 12, fontWeight: '700', marginTop: 4 }}
                      >
                        🏆{' '}
                        {ch.state === 'perfetta'
                          ? t('fc.sfc_perfetta')
                          : t(
                              e.retries.length === 1
                                ? 'fc.sfc_conquistata_1'
                                : 'fc.sfc_conquistata_n',
                              { n: e.retries.length },
                            )}
                      </Text>
                    ) : fix ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        <Text
                          testID={`fch-plate-${g.uuid}`}
                          style={{ color: th.orange, fontSize: 12, fontWeight: '700' }}
                        >
                          🎯{' '}
                          {t(ch.toFix === 1 ? 'fc.sfc_da_sistemare_1' : 'fc.sfc_da_sistemare_n', {
                            n: ch.toFix,
                          })}
                        </Text>
                        <MiniClimb chain={ch} />
                      </View>
                    ) : null}
                  </Pressable>
                  {detailed ? <HistoryRoad chain={ch} testID={`fch-road-${g.uuid}`} /> : null}
                  {detailed && e.retries.length > 0 ? (
                    <View testID={`fch-retries-${g.uuid}`} style={{ gap: 4 }}>
                      {e.retries.map((r, i) => (
                        <View
                          key={r.game.uuid}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                        >
                          <Pressable
                            testID={`fch-retry-${r.game.uuid}`}
                            accessibilityRole="button"
                            style={{ flex: 1, flexDirection: 'row', gap: 10 }}
                            onPress={() =>
                              r.resume !== null
                                ? router.push({
                                    pathname: '/fc-game',
                                    params: { game: r.game.uuid, position: String(r.resume) },
                                  })
                                : router.push({
                                    pathname: '/fc-result',
                                    params: { game: r.game.uuid },
                                  })
                            }
                          >
                            <Text style={{ color: th.text, fontSize: 13, fontWeight: '600' }}>
                              {t('fc.sfc_ripasso_n', { n: i + 1 })}
                            </Text>
                            <Text style={{ color: th.text2, fontSize: 13, flex: 1 }}>
                              {(r.game.game_date ?? '').slice(0, 10)}
                            </Text>
                            <Text
                              style={{
                                color: r.resume !== null ? th.brand : th.text,
                                fontSize: 13,
                                fontWeight: '700',
                              }}
                            >
                              {r.resume !== null
                                ? t('fc.sfc_in_sospeso')
                                : `${Math.round(r.score)}%`}
                            </Text>
                          </Pressable>
                          {r.resume !== null ? (
                            <Pressable
                              testID={`fch-retry-del-${r.game.uuid}`}
                              accessibilityRole="button"
                              accessibilityLabel={t('fc.sfc_elimina_ripasso')}
                              onPress={() => {
                                kit?.games.remove(r.game.uuid);
                                setTick((n) => n + 1);
                              }}
                            >
                              <Text style={{ color: th.red, fontSize: 13 }}>✕</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {detailed && open === null && openRetry ? (
                    <Pressable
                      testID={`fch-resume-retry-${g.uuid}`}
                      accessibilityRole="button"
                      onPress={() =>
                        router.push({
                          pathname: '/fc-game',
                          params: { game: openRetry.game.uuid, position: String(openRetry.resume) },
                        })
                      }
                    >
                      <Text style={{ color: th.brand, fontWeight: '600' }}>
                        {t('fc.sfc_riprendi')} ({t('fc.sfc_ripasso_errori')})
                      </Text>
                    </Pressable>
                  ) : null}
                  {detailed && fix && kit ? (
                    <Pressable
                      testID={`fch-fix-${g.uuid}`}
                      accessibilityRole="button"
                      onPress={() => {
                        const r = kit.games.retry(ch.lastUuid);
                        if (r.kind === 'started')
                          router.push({
                            pathname: '/fc-game',
                            params: { game: r.game, position: '1' },
                          });
                      }}
                    >
                      <Text style={{ color: th.brand, fontWeight: '700' }}>
                        {t(ch.toFix === 1 ? 'fc.sfc_sistema_1' : 'fc.sfc_sistema_n', {
                          n: ch.toFix,
                        })}
                      </Text>
                    </Pressable>
                  ) : null}
                  {detailed && e.wrong > 0 ? (
                    <Pressable
                      testID={`fch-errors-${g.uuid}`}
                      accessibilityRole="button"
                      onPress={() =>
                        router.push({
                          pathname: '/fc-result',
                          params: { game: g.uuid, errors: '1' },
                        })
                      }
                    >
                      <Text style={{ color: th.brand, fontWeight: '600' }}>
                        {t(fix ? 'fc.sfc_vedi_errori' : 'fc.sfc_ripassa')}
                      </Text>
                    </Pressable>
                  ) : null}
                  {asking === g.uuid ? (
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                      <Pressable
                        testID={`fch-del-yes-${g.uuid}`}
                        accessibilityRole="button"
                        onPress={() => {
                          kit?.games.remove(g.uuid);
                          setAsking(null);
                          setTick((n) => n + 1);
                        }}
                      >
                        <Text style={{ color: th.red, fontWeight: '700' }}>
                          {t('comune.elimina')}
                        </Text>
                      </Pressable>
                      <Pressable accessibilityRole="button" onPress={() => setAsking(null)}>
                        <Text style={{ color: th.brand }}>{t('comune.annulla')}</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      testID={`fch-del-${g.uuid}`}
                      accessibilityRole="button"
                      accessibilityLabel={t('fc.sfc_elimina_tit')}
                      onPress={() => setAsking(g.uuid)}
                    >
                      <Text style={{ color: th.text2, fontSize: 13 }}>{t('comune.elimina')}</Text>
                    </Pressable>
                  )}
                </Card>
              );
            })}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
