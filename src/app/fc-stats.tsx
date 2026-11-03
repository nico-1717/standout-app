import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { formatDuration } from '@/features/flashcards/format';
import { flattenDecks } from '@/features/flashcards/logic';
import { badges, streaks } from '@/features/flashcards/stats';
import { localToday } from '@/features/tasks/groups';
import { Card, Header, SectionLabel } from '@/ui/kit';

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
}: {
  values: number[];
  labels?: string[];
  color: string;
  testID?: string;
  height?: number;
}) {
  const th = useTheme();
  const max = Math.max(1, ...values);
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
  const goal = study.goal();
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

  const tile = (id: string, label: string, value: string, note: string) => (
    <Card key={id} style={{ flex: 1, padding: 12, gap: 2 }}>
      <Text style={{ color: th.text2, fontSize: 11, fontWeight: '700' }}>
        {label.toUpperCase()}
      </Text>
      <Text testID={id} style={{ color: th.text, fontSize: 22, fontWeight: '800' }}>
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
          <Text testID="fcst-streak" style={{ color: th.text, fontSize: 26, fontWeight: '800' }}>
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
          <Text testID="fcst-goal" style={{ color: th.text, fontSize: 22, fontWeight: '800' }}>
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
