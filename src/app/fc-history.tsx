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
  filterHistory,
  historyEntries,
  summarize,
  type HistoryKind,
  type HistorySort,
  type HistoryState,
} from '@/features/flashcards/history';
import { HistoryActivity } from '@/features/flashcards/HistoryActivity';
import { HistorySubjects } from '@/features/flashcards/HistorySubjects';
import { deckBranch, flattenDecks } from '@/features/flashcards/logic';
import { buildSubjects, groupActivity } from '@/features/flashcards/subjects';
import { localToday } from '@/features/tasks/groups';
import { Card, Header } from '@/ui/kit';

type Period = 7 | 30 | 90 | 0;

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
  const kit = useMemo(() => (services ? kitForCourse(services, course) : null), [services, course]);
  const [period, setPeriod] = useState<Period>(30);
  const [asking, setAsking] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [now] = useState(() => Date.now());
  const [showFilters, setShowFilters] = useState(false);
  const [state, setState] = useState<HistoryState>('all');
  const [kind, setKind] = useState<HistoryKind>('any');
  const [sort, setSort] = useState<HistorySort>('recent');
  const [subject, setSubject] = useState<string | null>(null);
  const [view, setView] = useState<'games' | 'subjects'>('games');

  const entries = useMemo(() => {
    void version;
    void tick;
    return kit ? historyEntries(kit.games) : null;
  }, [kit, version, tick]);
  const decks = useMemo(() => {
    void version;
    return kit ? kit.decks() : [];
  }, [kit, version]);
  const rows = useMemo(() => {
    if (!entries) return null;
    const from = period ? new Date(now - period * 86_400_000).toISOString().slice(0, 10) : '';
    return filterHistory(entries, {
      state,
      kind,
      sort,
      from,
      subject: subject ? new Set(deckBranch(decks, subject)) : null,
    });
  }, [entries, period, now, state, kind, sort, subject, decks]);
  const today = localToday();
  const from = period ? new Date(now - period * 86_400_000).toISOString().slice(0, 10) : '';
  const activity = useMemo(() => {
    void version;
    void tick;
    return kit ? groupActivity(kit.games.answersByDay(from, ''), from, '', today) : null;
  }, [kit, version, tick, from, today]);
  const tree = useMemo(() => {
    void version;
    void tick;
    return kit && view === 'subjects' ? buildSubjects(kit.games.subjectRows(from, '')) : null;
  }, [kit, version, tick, from, view]);
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
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {periods.map((p) => (
            <Pressable
              key={p.v}
              testID={`fch-period-${p.v}`}
              accessibilityRole="button"
              accessibilityState={{ selected: period === p.v }}
              onPress={() => setPeriod(p.v)}
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
        </View>

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
                        style={{ color: open !== null ? th.brand : th.text, fontWeight: '800' }}
                      >
                        {open !== null ? t('fc.sfc_in_sospeso') : `${Math.round(e.score)}%`}
                      </Text>
                    </View>
                    <Text style={{ color: th.text2, fontSize: 13 }}>
                      {t('fc.res_corretto')} {e.correct} · {t('fc.res_errato')} {e.wrong} ·{' '}
                      {formatDuration(e.seconds)}
                    </Text>
                  </Pressable>
                  {e.retries.length > 0 ? (
                    <Text
                      testID={`fch-retries-${g.uuid}`}
                      style={{ color: th.text2, fontSize: 13 }}
                    >
                      {t(e.retries.length === 1 ? 'fc.sfc_ripassi_1' : 'fc.sfc_ripassi_n', {
                        n: e.retries.length,
                      })}
                      {' · '}
                      {e.retries.map((r) => `${Math.round(r.score)}%`).join(' → ')}
                    </Text>
                  ) : null}
                  {open === null && openRetry ? (
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
