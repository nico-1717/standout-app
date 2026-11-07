import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { formatDuration } from '@/features/flashcards/format';
import { DocView } from '@/features/flashcards/DocView';
import { deckBranch, flattenDecks } from '@/features/flashcards/logic';
import { badges, streaks } from '@/features/flashcards/stats';
import { localToday } from '@/features/tasks/groups';
import { Card, Header, SectionLabel, bigNumber } from '@/ui/kit';

type Period = 7 | 30 | 90 | 0;

/** «AAAA-MM-GG» spostata di `n` giorni. */
function shiftDay(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + n)).toISOString().slice(0, 10);
}

/** Barre semplici: un valore per colonna, l'etichetta sotto. */
function Bars({
  values,
  labels,
  color,
  testID,
  height = 80,
  scale,
}: {
  values: number[];
  labels?: string[];
  color: string;
  testID?: string;
  height?: number;
  /** valore a cui la colonna arriva in cima (default: il più alto) */
  scale?: number;
}) {
  const th = useTheme();
  const max = scale ?? Math.max(1, ...values);
  return (
    <View testID={testID}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 2 }}>
        {values.map((v, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: Math.max(v > 0 ? 3 : 1, (v / max) * height),
              backgroundColor: v > 0 ? color : th.hairline2,
              borderRadius: 2,
            }}
          />
        ))}
      </View>
      {labels ? (
        <View style={{ flexDirection: 'row', gap: 2, marginTop: 3 }}>
          {labels.map((l, i) => (
            <Text
              key={i}
              style={{ flex: 1, textAlign: 'center', color: th.text2, fontSize: 9 }}
              numberOfLines={1}
            >
              {l}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Le statistiche delle flashcard (fc_stats.php), versione base: totali del periodo, serie di giorni, obiettivo di oggi,
 * andamento, quando giochi di più, traguardi e la panoramica dei mazzi. Le previsioni e i grafici di velocità arrivano dopo.
 */
export default function FlashcardStatsScreen() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services, version, changed } = useApp();
  const [period, setPeriod] = useState<Period>(30);
  const [today] = useState(() => localToday());
  const [focus, setFocus] = useState<string | null>(null);
  void version;
  if (!services) return null;
  const { fcStats, flashcards, games, study } = services;

  const act = fcStats.activity();
  const from = period ? shiftDay(today, -(period - 1)) : '';
  let played = 0;
  let correct = 0;
  let seconds = 0;
  for (const [d, v] of act.daily) {
    if (d >= from && d <= today) {
      played += v.played;
      correct += v.correct;
    }
  }
  for (const [d, s] of act.time) if (d >= from && d <= today) seconds += s;
  const sub = period === 0 ? t('fc.st_sempre') : t('fc.st_ultimi_n', { n: period });

  const streak = streaks([...act.daily.keys()], today);
  const deckStats = games.deckStats();
  // una materia è completa se tutte le sue carte «le sai»; si guardano i mazzi senza sottomazzi contati due volte
  const complete = [...deckStats.values()].some((d) => d.total > 0 && d.known >= d.total);
  const knownTotal = flashcards
    .decks()
    .reduce((n, d) => n + (deckStats.get(d.uuid)?.known ?? 0) * (d.parent_uuid ? 0 : 1), 0);
  const rootStats = flashcards
    .decks()
    .filter((d) => !d.parent_uuid)
    .map((d) => deckStats.get(d.uuid));
  const cardsTotal = rootStats.reduce((n, d) => n + (d?.total ?? 0), 0);
  const cardsTried = rootStats.reduce((n, d) => n + (d?.tried ?? 0), 0);
  const cardsNever = Math.max(0, cardsTotal - knownTotal - cardsTried);
  const masteryPct = cardsTotal > 0 ? Math.round((knownTotal / cardsTotal) * 100) : 0;
  // i punteggi delle partite (non i ripassi) nell'ordine in cui sono state giocate, al massimo gli ultimi 40
  const scores = games
    .games()
    .filter((g) => g.score !== null && !g.parent_uuid)
    .reverse()
    .slice(-40)
    .map((g) => Math.round(g.score ?? 0));
  const goal = study.goal();
  const records = study.records();
  const todayPlayed = act.daily.get(today)?.played ?? 0;

  // andamento: gli ultimi giorni (al massimo 30)
  const span = Math.min(period || 30, 30);
  const days = Array.from({ length: span }, (_, i) => shiftDay(today, -(span - 1 - i)));
  const trend = days.map((d) => act.daily.get(d)?.played ?? 0);

  const lang = i18n.language || 'it';
  const weekdayNames = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    try {
      return new Date(Date.UTC(2026, 0, 5 + i)).toLocaleDateString(lang, {
        weekday: 'short',
        timeZone: 'UTC',
      });
    } catch {
      return 'MTWTFSS'[i]!;
    }
  });

  const breakdown = fcStats.byDeck(from, today);
  const rows = flattenDecks(flashcards.decks(), 'active');
  const none = played === 0 && act.totalPlayed === 0;
  const allDecks = flashcards.decks();
  const drill = fcStats.drill(focus ? new Set(deckBranch(allDecks, focus)) : null);
  const retryPct =
    drill.afterError.opportunities >= 3
      ? Math.round((drill.afterError.fixed / drill.afterError.opportunities) * 100)
      : null;

  const tile = (id: string, label: string, value: string, note: string) => (
    <Card key={id} style={{ flex: 1, padding: 12, gap: 2 }}>
      <Text style={{ color: th.text2, fontSize: 11, fontWeight: '700' }}>
        {label.toUpperCase()}
      </Text>
      <Text testID={id} style={[{ color: th.text }, bigNumber(th, 22)]}>
        {value}
      </Text>
      <Text style={{ color: th.text2, fontSize: 11 }}>{note}</Text>
    </Card>
  );

  const periods: { v: Period; label: string }[] = [
    { v: 7, label: t('fc.7_giorni') },
    { v: 30, label: t('fc.30_giorni') },
    { v: 90, label: t('fc.90_giorni') },
    { v: 0, label: t('fc.tutto') },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        top={insets.top}
        title={t('fc.statistiche')}
        right={
          <Pressable testID="fcst-close" accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: th.brand, fontSize: 17 }}>{t('comune.chiudi')}</Text>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 40 }}
      >
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {periods.map((p) => (
            <Pressable
              key={p.v}
              testID={`fcst-period-${p.v}`}
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

        {none ? (
          <Text testID="fcst-empty" style={{ color: th.text2 }}>
            {t('fc.st_nessuna_giocata')}
          </Text>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {tile('fcst-played', t('fc.carte_giocate'), String(played), sub)}
          {tile(
            'fcst-accuracy',
            t('fc.precisione'),
            played > 0 ? `${Math.round((correct / played) * 100)}%` : '—',
            sub,
          )}
          {tile('fcst-time', t('fc.tempo_di_studio'), formatDuration(seconds), sub)}
        </View>

        <Card style={{ padding: 14, gap: 4 }}>
          <Text style={{ color: th.text2, fontSize: 11, fontWeight: '700' }}>
            {t('fc.streak_di_studio').toUpperCase()}
          </Text>
          <Text testID="fcst-streak" style={[{ color: th.text }, bigNumber(th, 26)]}>
            🔥 {t('fc.n_giorni', { n: streak.current })}
          </Text>
          <Text testID="fcst-best" style={{ color: th.text2 }}>
            {t('fc.record_n_giorni', { n: streak.best })}
          </Text>
          {streak.next ? (
            <Text style={{ color: th.text2 }}>
              {t('fc.ancora_n_per_traguardo', {
                mancano: t('fc.n_giorni', { n: streak.next - streak.current }),
                traguardo: streak.next,
              })}
            </Text>
          ) : null}
        </Card>

        <Card style={{ padding: 14, gap: 8 }}>
          <Text style={{ color: th.text2, fontSize: 11, fontWeight: '700' }}>
            {t('fc.obiettivo_di_oggi').toUpperCase()}
          </Text>
          <Text testID="fcst-goal" style={[{ color: th.text }, bigNumber(th, 22)]}>
            {todayPlayed} / {goal}
          </Text>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: th.surface2 }}>
            <View
              style={{
                height: 8,
                borderRadius: 4,
                backgroundColor: todayPlayed >= goal ? th.green : th.brand,
                width: `${Math.min(100, (todayPlayed / goal) * 100)}%`,
              }}
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ color: th.text2, flex: 1 }}>{t('fc.obiettivo_carte_al_giorno')}</Text>
            {[
              { id: 'less', label: '−', step: -5, a11y: t('fc.diminuisci') },
              { id: 'more', label: '+', step: 5, a11y: t('fc.aumenta') },
            ].map((b) => (
              <Pressable
                key={b.id}
                testID={`fcst-goal-${b.id}`}
                accessibilityRole="button"
                accessibilityLabel={b.a11y}
                onPress={() => {
                  if (study.setGoal(Math.max(1, Math.min(1000, goal + b.step)))) changed();
                }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: th.surface2,
                }}
              >
                <Text style={{ color: th.text, fontSize: 20 }}>{b.label}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <SectionLabel>{t('fc.andamento_carte_giocate')}</SectionLabel>
        <Card style={{ padding: 14 }}>
          {trend.some((v) => v > 0) ? (
            <Bars testID="fcst-trend" values={trend} color={th.brand} />
          ) : (
            <Text style={{ color: th.text2 }}>{t('fc.non_ci_sono_ancora_abbastanza')}</Text>
          )}
        </Card>

        <SectionLabel>{t('fc.quando_giochi_di_piu')}</SectionLabel>
        <Card style={{ padding: 14, gap: 14 }}>
          <Bars
            testID="fcst-weekdays"
            values={act.weekdays}
            labels={weekdayNames}
            color={th.green}
          />
          <Bars
            testID="fcst-hours"
            values={act.hours}
            labels={act.hours.map((_, h) => (h % 6 === 0 ? String(h) : ''))}
            color={th.brand}
          />
        </Card>

        {records.combo || records.padroneggiate ? (
          <>
            <SectionLabel>{t('fc.record')}</SectionLabel>
            <Card style={{ padding: 14, gap: 6 }}>
              {records.combo ? (
                <Text testID="fcst-record-combo" style={{ color: th.text }}>
                  🔥 {t('fcv.ck_serie')}: {records.combo}
                </Text>
              ) : null}
              {records.padroneggiate ? (
                <Text testID="fcst-record-mastered" style={{ color: th.text }}>
                  🎓 {t('fcv.ck_padroneggiate_carte', { n: records.padroneggiate })}
                </Text>
              ) : null}
            </Card>
          </>
        ) : null}

        <SectionLabel>{t('fc.padronanza_carte')}</SectionLabel>
        <Card style={{ padding: 12, gap: 8 }}>
          <Text style={{ color: th.text2, fontSize: 12 }}>
            {t('fc.su_tutto_l_archivio_flashcard')}
          </Text>
          <Text testID="fcst-mastery-pct" style={[{ color: th.text }, bigNumber(th, 24)]}>
            {masteryPct}%{' '}
            <Text style={{ fontSize: 13, fontWeight: '500' }}>{t('fc.completato')}</Text>
          </Text>
          <View
            testID="fcst-mastery-bar"
            style={{
              flexDirection: 'row',
              height: 12,
              borderRadius: 6,
              overflow: 'hidden',
              backgroundColor: th.hairline2,
            }}
          >
            <View style={{ flex: knownTotal, backgroundColor: th.green }} />
            <View style={{ flex: cardsTried, backgroundColor: th.brand }} />
            <View style={{ flex: Math.max(cardsNever, cardsTotal === 0 ? 1 : 0) }} />
          </View>
          <Text testID="fcst-mastery-known" style={{ color: th.text }}>
            🟢 {t('fc.leg_imparate', { n: knownTotal })}
          </Text>
          <Text testID="fcst-mastery-tried" style={{ color: th.text }}>
            🔵 {t('fc.leg_in_corso', { n: cardsTried })}
          </Text>
          <Text testID="fcst-mastery-never" style={{ color: th.text }}>
            ⚪ {t('fc.leg_da_provare', { n: cardsNever })}
          </Text>
        </Card>

        {scores.length > 0 ? (
          <>
            <SectionLabel>{t('fc.punteggio_partite')}</SectionLabel>
            <Card style={{ padding: 12, gap: 6 }}>
              <Text style={{ color: th.text2, fontSize: 12 }}>
                {t('fc.ogni_punto_e_una_partita')}
              </Text>
              <Bars testID="fcst-scores" values={scores} color={th.brand} scale={100} />
            </Card>
          </>
        ) : null}

        <SectionLabel>{t('fc.traguardi')}</SectionLabel>
        <Card style={{ padding: 12, gap: 8 }}>
          {badges(act.totalPlayed, streak.best, knownTotal, complete).map((b) => (
            <View
              key={b.key}
              testID={`fcst-badge-${b.key}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              <Text style={{ fontSize: 18, opacity: b.done ? 1 : 0.3 }}>{b.done ? '🏅' : '○'}</Text>
              <Text style={{ color: b.done ? th.text : th.text2, flex: 1 }}>
                {t(`fc.bdg_${b.key}`)}
              </Text>
            </View>
          ))}
        </Card>

        <SectionLabel>{t('fc.carte_piu_sbagliate')}</SectionLabel>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {[
            { uuid: null as string | null, name: t('fc.tutto') },
            ...rows.map((r) => ({
              uuid: r.deck.uuid as string | null,
              name: `${'· '.repeat(r.depth)}${r.deck.name}`,
            })),
          ].map((d) => (
            <Pressable
              key={d.uuid ?? 'all'}
              testID={`fcst-focus-${d.uuid ?? 'all'}`}
              accessibilityRole="button"
              accessibilityState={{ selected: focus === d.uuid }}
              onPress={() => setFocus(d.uuid)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 16,
                backgroundColor: focus === d.uuid ? th.brand : th.surface2,
              }}
            >
              <Text style={{ color: focus === d.uuid ? '#fff' : th.text, fontWeight: '600' }}>
                {d.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Card style={{ padding: 12, gap: 10 }}>
          {drill.missed.length === 0 ? (
            <Text testID="fcst-missed-empty" style={{ color: th.text2 }}>
              {t('fc.st_poche_ripetizioni')}
            </Text>
          ) : (
            drill.missed.map((m) => {
              const card = m.child_uuid
                ? flashcards.subcard(m.child_uuid)
                : m.card_uuid
                  ? flashcards.card(m.card_uuid)
                  : null;
              return (
                <View
                  key={m.key}
                  testID={`fcst-missed-${m.key}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    {card?.question_desc ? (
                      <DocView raw={card.question_desc} size={14} />
                    ) : (
                      <Text style={{ color: th.text2 }}>{t('fc.st_senza_descrizione')}</Text>
                    )}
                    <Text style={{ color: th.text2, fontSize: 12 }}>
                      {t('fc.st_tentativi_prec', { played: m.played, acc: m.accuracy })}
                    </Text>
                  </View>
                  <Text style={{ color: th.red, fontWeight: '800' }}>{m.wrong}×</Text>
                </View>
              );
            })
          )}
        </Card>

        <SectionLabel>{t('fc.miglioramento_dopo_un_errore')}</SectionLabel>
        <Card style={{ padding: 12, gap: 4 }}>
          <Text
            testID="fcst-retry-pct"
            style={{
              color:
                retryPct === null
                  ? th.text2
                  : retryPct >= 60
                    ? th.green
                    : retryPct >= 35
                      ? th.text
                      : th.red,
              fontSize: 24,
              fontWeight: '800',
            }}
          >
            {retryPct === null ? '—' : `${retryPct}%`}
          </Text>
          <Text testID="fcst-retry-text" style={{ color: th.text2 }}>
            {retryPct === null
              ? t('fc.st_poche_ripetizioni')
              : t('fc.st_dopo_errore', { pct: retryPct, n: drill.afterError.opportunities })}
          </Text>
        </Card>

        <SectionLabel>{t('fc.panoramica_categorie')}</SectionLabel>
        <Card style={{ padding: 12, gap: 10 }}>
          {rows.length === 0 ? (
            <Text style={{ color: th.text2 }}>{t('fc.st_nessuna_categoria')}</Text>
          ) : (
            rows.map((r) => {
              const b = breakdown.get(r.deck.uuid);
              const s = deckStats.get(r.deck.uuid);
              return (
                <View
                  key={r.deck.uuid}
                  testID={`fcst-deck-${r.deck.uuid}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingLeft: r.depth * 14,
                  }}
                >
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: r.deck.color,
                    }}
                  />
                  <Text style={{ color: th.text, flex: 1 }} numberOfLines={1}>
                    {r.deck.name}
                  </Text>
                  <Text style={{ color: th.text2, fontSize: 12 }}>
                    {b && b.played > 0 ? `${Math.round((b.correct / b.played) * 100)}%` : '—'}
                    {' · '}
                    {b?.played ?? 0}
                    {b && b.seconds > 0 ? ` · ${formatDuration(b.seconds)}` : ''}
                    {s && s.total > 0 ? ` · ${s.known}/${s.total}` : ''}
                  </Text>
                </View>
              );
            })
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
