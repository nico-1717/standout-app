import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { DeckIcon } from '@/features/flashcards/DeckIcon';
import { whenShort } from '@/features/flashcards/format';
import { LEVEL_COLORS, LEVELS, type Level } from '@/features/flashcards/levels';
import {
  daysToExam,
  deckBranch,
  deckIcon,
  examUrgency,
  flattenDecks,
  scopeCounts,
  searchDecks,
  type DeckScope,
} from '@/features/flashcards/logic';
import { localToday } from '@/features/tasks/groups';
import { Card, Header, PrimaryButton, SectionLabel, TextButton, bigNumber } from '@/ui/kit';

/** Le categorie delle flashcard di studio ad albero (fc_decks.php): materie, sottocategorie, archivio, ricerca. */
export default function FlashcardsScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services, version, changed } = useApp();

  const [scope, setScope] = useState<DeckScope>('active');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [addingUnder, setAddingUnder] = useState<string | null>(null);
  const [subDraft, setSubDraft] = useState('');

  const data = useMemo(() => {
    void version;
    if (!services) return null;
    return {
      decks: services.flashcards.decks(),
      counts: services.flashcards.cardCounts(),
      stats: services.games.deckStats(),
    };
  }, [services, version]);
  if (!services || !data) return null;
  const { decks, counts, stats } = data;

  const today = localToday();
  const deckIds = new Set(decks.map((d) => d.uuid));
  const scopes = scopeCounts(decks);
  const rows = flattenDecks(decks, scope, collapsed);
  const found = query.trim() ? searchDecks(decks, query) : null;
  const totalCards = [...counts.values()].reduce((a, b) => a + b, 0);

  const add = (parent: string | null, name: string) => {
    const id = services.flashcards.createDeck({ name, parent });
    if (!id) return false;
    if (parent && collapsed.has(parent)) {
      const n = new Set(collapsed);
      n.delete(parent);
      setCollapsed(n);
    }
    changed();
    return true;
  };
  const open = (id: string) => router.push({ pathname: '/fc-deck', params: { id } });

  const statsLine = (id: string) => {
    const st = stats.get(id);
    if (!st) return null;
    const when = whenShort(st.last, today, t);
    const order: Level[] = [...LEVELS.filter((l) => l !== 'nuova')].reverse();
    order.push('nuova');
    const known = st.total ? Math.round((st.known / st.total) * 100) : 0;
    return (
      <View testID={`fc-stats-${id}`} style={{ gap: 4, marginTop: 3 }}>
        <Text style={{ color: th.text2, fontSize: 12 }}>
          {st.games > 0
            ? [t(st.games === 1 ? 'fc.dk_partite_1' : 'fc.dk_partite', { n: st.games }), when]
                .filter(Boolean)
                .join(' · ')
            : st.total > 0 && st.total === st.levels.nuova
              ? t('fc.dk_mai_giocato')
              : ''}
        </Text>
        {st.total > st.levels.nuova ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                height: 6,
                borderRadius: 3,
                overflow: 'hidden',
                backgroundColor: th.surface2,
              }}
            >
              {order.map((l) =>
                st.levels[l] ? (
                  <View key={l} style={{ flex: st.levels[l], backgroundColor: LEVEL_COLORS[l] }} />
                ) : null,
              )}
            </View>
            {known > 0 ? (
              <Text testID={`fc-known-${id}`} style={{ color: th.text2, fontSize: 12 }}>
                {known}%
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  const playHard = (id: string) => {
    const r = services.games.start({
      decks: deckBranch(decks, id),
      status: 'all',
      order: 'random',
      onlyHard: true,
    });
    if (r.kind === 'started') {
      router.push({ pathname: '/fc-game', params: { game: r.game, position: '1' } });
    }
  };

  const examChip = (iso: string | null) => {
    const d = daysToExam(iso, today);
    if (d === null) return null;
    const label =
      d === 0
        ? t('fc.dk_esame_oggi')
        : d === 1
          ? t('fc.dk_esame_domani')
          : t('fc.dk_esame_tra', { n: d });
    const u = examUrgency(d);
    const color = u === 'urgent' ? th.red : u === 'near' ? th.orange : th.text2;
    return (
      <Text style={{ color, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
        {label}
      </Text>
    );
  };

  const renderRow = ({
    id,
    depth,
    hasChildren,
    path,
  }: {
    id: string;
    depth: number;
    hasChildren: boolean;
    path?: string;
  }) => {
    const d = decks.find((x) => x.uuid === id)!;
    const closed = collapsed.has(id);
    const n = counts.get(id) ?? 0;
    return (
      <View key={id}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 11,
            paddingRight: 12,
            paddingLeft: 12 + depth * 18,
          }}
        >
          <Pressable
            testID={`fc-toggle-${id}`}
            accessibilityRole="button"
            disabled={!hasChildren}
            hitSlop={8}
            onPress={() => {
              const next = new Set(collapsed);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              setCollapsed(next);
            }}
            style={{ width: 16, alignItems: 'center' }}
          >
            <Text style={{ color: th.text3, fontSize: 12 }}>
              {hasChildren ? (closed ? '▶' : '▼') : ''}
            </Text>
          </Pressable>
          <Pressable
            testID={`fc-row-${id}`}
            accessibilityRole="button"
            onPress={() => open(id)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: d.color + '26',
              }}
            >
              <DeckIcon name={deckIcon(d)} color={d.color} size={22} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: th.text, fontSize: 16, fontWeight: '600' }} numberOfLines={2}>
                {d.pinned ? '📌 ' : ''}
                {d.name}
              </Text>
              {path ? (
                <Text style={{ color: th.text2, fontSize: 12 }} numberOfLines={1}>
                  {path}
                </Text>
              ) : null}
              {examChip(d.exam_date)}
              {statsLine(id)}
            </View>
            {(stats.get(id)?.hard ?? 0) >= 2 ? (
              <Pressable
                testID={`fc-hard-${id}`}
                accessibilityRole="button"
                accessibilityLabel={t('fc.dk_da_ripassare', { n: stats.get(id)!.hard })}
                onPress={() => playHard(id)}
                hitSlop={6}
                style={{
                  minWidth: 24,
                  paddingHorizontal: 7,
                  paddingVertical: 3,
                  borderRadius: 12,
                  backgroundColor: th.red,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                  {stats.get(id)!.hard}
                </Text>
              </Pressable>
            ) : null}
            <Text style={{ color: th.text2, fontSize: 13 }}>
              {n === 1 ? t('fc.app_n_carte_1') : t('fc.app_mostra_tutte_carte', { n })}
            </Text>
          </Pressable>
          {scope === 'active' && !found ? (
            <Pressable
              testID={`fc-add-${id}`}
              accessibilityRole="button"
              accessibilityLabel={t('fc.cfc_aggiungi_sottocategoria')}
              hitSlop={8}
              onPress={() => {
                setAddingUnder(addingUnder === id ? null : id);
                setSubDraft('');
              }}
            >
              <Text style={{ color: th.brand, fontSize: 22 }}>+</Text>
            </Pressable>
          ) : null}
        </View>
        {addingUnder === id ? (
          <View style={{ paddingLeft: 54 + depth * 18, paddingRight: 12, paddingBottom: 12 }}>
            <TextInput
              testID="fc-sub-input"
              autoFocus
              value={subDraft}
              onChangeText={setSubDraft}
              placeholder={t('fc.cfc_aggiungi_sottocategoria')}
              placeholderTextColor={th.text3}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (add(id, subDraft)) {
                  setSubDraft('');
                  setAddingUnder(null);
                }
              }}
              style={{
                backgroundColor: th.surface2,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 9,
                color: th.text,
              }}
            />
          </View>
        ) : null}
      </View>
    );
  };

  const resume = services?.games.unfinished() ?? null;
  const goal = services.study.goal();
  const todayPlayed = services.fcStats.activity().daily.get(today)?.played ?? 0;
  const knownCards = decks
    .filter((d) => !d.parent_uuid || !deckIds.has(d.parent_uuid))
    .reduce((n, d) => n + (stats.get(d.uuid)?.known ?? 0), 0);
  const withKids = new Set(
    decks.filter((d) => decks.some((c) => c.parent_uuid === d.uuid)).map((d) => d.uuid),
  );

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        top={insets.top}
        title={t('fc.cfc_titolo')}
        right={
          <Pressable testID="fc-close" accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: th.brand, fontSize: 17 }}>✕</Text>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          testID="fc-summary"
          accessibilityRole="button"
          onPress={() => router.push('/fc-stats')}
        >
          <Card style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ color: th.text2, fontSize: 11, fontWeight: '700' }}>
                {t('fc.obiettivo_di_oggi').toUpperCase()}
              </Text>
              <Text testID="fc-goal" style={[{ color: th.text }, bigNumber(th, 20)]}>
                {todayPlayed} / {goal}
              </Text>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: th.surface2 }}>
                <View
                  style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: todayPlayed >= goal ? th.green : th.brand,
                    width: `${Math.min(100, (todayPlayed / goal) * 100)}%`,
                  }}
                />
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text testID="fc-known" style={[{ color: th.text }, bigNumber(th, 20)]}>
                {knownCards}
              </Text>
              <Text style={{ color: th.text2, fontSize: 11 }}>{t('fc.carte_imparate')}</Text>
            </View>
          </Card>
        </Pressable>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              testID="fc-play"
              label={t('fc.cg_gioca')}
              onPress={() => router.push('/fc-setup')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextButton
              testID="fc-history"
              label={t('fc.js_storico')}
              onPress={() => router.push('/fc-history')}
            />
          </View>
        </View>
        <TextButton
          testID="fc-stats"
          label={t('fc.statistiche')}
          onPress={() => router.push('/fc-stats')}
        />
        {resume ? (
          <Pressable
            testID="fc-resume"
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/fc-game',
                params: { game: resume.game.uuid, position: String(resume.position) },
              })
            }
            style={{ backgroundColor: th.surface2, borderRadius: 12, padding: 14 }}
          >
            <Text style={{ color: th.text, fontWeight: '700' }}>{t('fc.res_continua')}</Text>
            <Text style={{ color: th.text2, fontSize: 13 }}>
              {resume.closed} / {resume.total}
            </Text>
          </Pressable>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            testID="fc-new"
            value={draft}
            onChangeText={setDraft}
            placeholder={t('fc.app_nuova_materia')}
            placeholderTextColor={th.text3}
            returnKeyType="done"
            onSubmitEditing={() => add(null, draft) && setDraft('')}
            style={{
              flex: 1,
              backgroundColor: th.surface,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: th.hairline,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: th.text,
              fontSize: 16,
            }}
          />
          <View style={{ width: 96 }}>
            <PrimaryButton
              testID="fc-new-add"
              label={t('vocab.cat_aggiungi')}
              disabled={!draft.trim()}
              onPress={() => add(null, draft) && setDraft('')}
            />
          </View>
        </View>

        <TextInput
          testID="fc-search"
          value={query}
          onChangeText={setQuery}
          placeholder={t('fc.app_nessuna_ricerca')}
          placeholderTextColor={th.text3}
          autoCorrect={false}
          style={{
            backgroundColor: th.surface2,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
            color: th.text,
            fontSize: 16,
          }}
        />

        {!found ? (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {(['active', 'archived'] as const).map((s) => (
              <Pressable
                key={s}
                testID={`fc-scope-${s}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: scope === s }}
                onPress={() => setScope(s)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor: scope === s ? th.brand : th.surface2,
                }}
              >
                <Text style={{ color: scope === s ? '#fff' : th.text, fontWeight: '600' }}>
                  {s === 'active' ? t('fc.cfc_attive') : t('fc.cfc_archiviate')} {scopes[s]}
                </Text>
              </Pressable>
            ))}
            <View style={{ flex: 1 }} />
            {withKids.size ? (
              <TextButton
                testID="fc-collapse"
                label={collapsed.size ? t('vocab.cat_espandi') : t('fc.cfc_comprimi_tutto')}
                onPress={() => setCollapsed(collapsed.size ? new Set() : new Set(withKids))}
              />
            ) : null}
          </View>
        ) : null}

        {found ? (
          found.length ? (
            <Card>
              {found.map((r, i) => (
                <View
                  key={r.deck.uuid}
                  style={{ borderTopWidth: i ? 0.5 : 0, borderTopColor: th.hairline }}
                >
                  {renderRow({ id: r.deck.uuid, depth: 0, hasChildren: false, path: r.path })}
                </View>
              ))}
            </Card>
          ) : (
            <Text style={{ color: th.text2, textAlign: 'center', padding: 24 }}>
              {t('fc.cfc_nessun_risultato')}
            </Text>
          )
        ) : rows.length ? (
          <Card index={0}>
            {rows.map((r, i) => (
              <View
                key={r.deck.uuid}
                style={{ borderTopWidth: i ? 0.5 : 0, borderTopColor: th.hairline }}
              >
                {renderRow({ id: r.deck.uuid, depth: r.depth, hasChildren: r.hasChildren })}
              </View>
            ))}
          </Card>
        ) : (
          <View style={{ padding: 28, alignItems: 'center', gap: 6 }}>
            <Text style={{ color: th.text, fontWeight: '700', fontSize: 17 }}>
              {scope === 'active' ? t('fc.cfc_nessuna_txt') : t('fc.cfc_archivio_vuoto')}
            </Text>
            {scope === 'archived' ? (
              <Text style={{ color: th.text2, textAlign: 'center' }}>
                {t('fc.cfc_archivio_vuoto_txt')}
              </Text>
            ) : null}
          </View>
        )}

        {decks.length ? (
          <View style={{ gap: 4 }}>
            <SectionLabel>{t('fc.cfc_carte')}</SectionLabel>
            <Text style={{ color: th.text2, fontSize: 13 }}>
              {t('fc.cfc_conteggio', { categorie: decks.length, carte: totalCards })}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
