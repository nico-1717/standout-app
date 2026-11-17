import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { DeckIcon } from '@/features/flashcards/DeckIcon';
import { DeckPicker } from '@/features/flashcards/DeckPicker';
import { whenShort } from '@/features/flashcards/format';
import { LEVEL_COLORS, LEVELS, type Level } from '@/features/flashcards/levels';
import {
  DECK_SWATCHES,
  daysToExam,
  deckBranch,
  deckIcon,
  deckMap,
  deckPath,
  examUrgency,
  flattenDecks,
  scopeCounts,
  searchDecks,
  type DeckScope,
} from '@/features/flashcards/logic';
import { localToday } from '@/features/tasks/groups';
import { Card, PrimaryButton, SectionLabel, TextButton } from '@/ui/kit';
import { HoIcon, hoTheme, hoTitle } from '@/features/home/HomeKit';

/** Le categorie delle flashcard di studio ad albero (fc_decks.php): materie, sottocategorie, archivio, ricerca. */
export default function FlashcardsScreen() {
  const th = useTheme();
  const ho = hoTheme(th);
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services, version, changed } = useApp();

  const [scope, setScope] = useState<DeckScope>('active');
  const [query, setQuery] = useState('');
  const [inCards, setInCards] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<null | 'move' | 'color' | 'delete'>(null);
  const [bulkNote, setBulkNote] = useState('');
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
  const scopes = scopeCounts(decks);
  const rows = flattenDecks(decks, scope, collapsed);
  const found = query.trim() ? searchDecks(decks, query) : null;
  const cardHits =
    inCards && query.trim().length >= 2 ? services.flashcards.searchText(query.trim()) : [];
  const hitGroups = [...Map.groupBy(cardHits, (h) => h.deck).entries()].flatMap(([deck, hits]) => {
    const d = decks.find((x) => x.uuid === deck);
    return d
      ? [
          {
            deck: d,
            hits,
            path: deckPath(deckMap(decks), deck)
              .slice(0, -1)
              .map((x) => x.name)
              .join(' › '),
          },
        ]
      : [];
  });
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
  const stopSelecting = () => {
    setSelecting(false);
    setPicked(new Set());
    setBulk(null);
  };
  const pickDeck = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };
  const bulkIds = [...picked];

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
            onPress={() => (selecting ? pickDeck(id) : open(id))}
            accessibilityState={selecting ? { checked: picked.has(id) } : undefined}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: selecting && picked.has(id) ? th.brandSoft : undefined,
            }}
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
                {selecting ? (picked.has(id) ? '☑ ' : '☐ ') : ''}
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
          {scope === 'active' && !found && !selecting ? (
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
  const withKids = new Set(
    decks.filter((d) => decks.some((c) => c.parent_uuid === d.uuid)).map((d) => d.uuid),
  );

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingBottom: 12,
          paddingHorizontal: 16,
          backgroundColor: th.headerGlass,
          borderBottomWidth: 0.5,
          borderBottomColor: th.hairline,
          gap: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            testID="fc-close"
            accessibilityRole="button"
            accessibilityLabel={t('comune.indietro')}
            onPress={() => router.back()}
            hitSlop={8}
            style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}
          >
            <HoIcon name="back" color={ho.blue} size={26} sw={2.4} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text
              accessibilityRole="header"
              numberOfLines={1}
              style={[{ color: ho.text }, hoTitle(ho, 24)]}
            >
              {t('vocab.cat_categorie')}
            </Text>
            <Text numberOfLines={1} style={{ color: ho.text2, fontSize: 15, marginTop: 1 }}>
              {t('fc.cfc_conteggio', { categorie: decks.length, carte: totalCards })}
            </Text>
          </View>
          <Pressable
            testID="fc-play"
            accessibilityRole="button"
            accessibilityLabel={t('fc.cg_gioca')}
            onPress={() => router.push('/fc-setup')}
            style={{ width: 46, height: 46, borderRadius: 23, overflow: 'hidden' }}
          >
            <LinearGradient
              colors={[ho.blue, ho.indigo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              <HoIcon name="play" color="#FFFFFF" size={20} sw={2.2} />
            </LinearGradient>
          </Pressable>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: ho.surface2,
            borderRadius: 14,
            paddingHorizontal: 14,
          }}
        >
          <HoIcon name="search" color={ho.text3} size={20} />
          <TextInput
            testID="fc-search"
            value={query}
            onChangeText={setQuery}
            placeholder={t('vocab.cat_cerca')}
            placeholderTextColor={ho.text3}
            autoCorrect={false}
            style={{ flex: 1, paddingVertical: 12, color: ho.text, fontSize: 17 }}
          />
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
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

        {found ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              testID="fc-search-cards"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: inCards }}
              onPress={() => setInCards(!inCards)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 999,
                backgroundColor: inCards ? th.brand : th.surface2,
              }}
            >
              <Text style={{ color: inCards ? '#fff' : th.text, fontWeight: '600' }}>
                {t('fc.cfc_f_testo_carte')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {!found ? (
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                backgroundColor: ho.surface2,
                borderRadius: 14,
                padding: 3,
              }}
            >
              {(['active', 'archived'] as const).map((s) => (
                <Pressable
                  key={s}
                  testID={`fc-scope-${s}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: scope === s }}
                  onPress={() => setScope(s)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 9,
                    borderRadius: 11,
                    backgroundColor: scope === s ? ho.bg : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      color: scope === s ? ho.text : ho.text2,
                      fontSize: 15,
                      fontWeight: '700',
                    }}
                  >
                    {s === 'active' ? t('fc.cfc_attive') : t('fc.cfc_archiviate')}
                  </Text>
                  <View
                    style={{
                      minWidth: 22,
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                      borderRadius: 999,
                      alignItems: 'center',
                      backgroundColor: scope === s ? ho.blueSoft : ho.hair,
                    }}
                  >
                    <Text
                      style={{
                        color: scope === s ? ho.blueInk : ho.text2,
                        fontSize: 13,
                        fontWeight: '700',
                      }}
                    >
                      {scopes[s]}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
            {withKids.size ? (
              <Pressable
                testID="fc-collapse"
                accessibilityRole="button"
                accessibilityLabel={
                  collapsed.size ? t('vocab.cat_espandi') : t('fc.cfc_comprimi_tutto')
                }
                onPress={() => setCollapsed(collapsed.size ? new Set() : new Set(withKids))}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: ho.surface2,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <HoIcon name="updown" color={ho.text2} size={19} />
              </Pressable>
            ) : null}
            <Pressable
              testID="fc-select"
              accessibilityRole="button"
              accessibilityLabel={selecting ? t('fc.cfc_fine') : t('fc.cfc_seleziona')}
              onPress={() => (selecting ? stopSelecting() : setSelecting(true))}
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: selecting ? ho.blueSoft : ho.surface2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <HoIcon name="checksq" color={selecting ? ho.blueInk : ho.text2} size={19} />
            </Pressable>
          </View>
        ) : null}

        {selecting ? (
          <Card style={{ padding: 14, gap: 10 }}>
            <Text testID="fc-sel-count" style={{ color: th.text, fontWeight: '700' }}>
              {picked.size === 1
                ? t('fc.cfc_selezionata_1')
                : t('fc.cfc_selezionate', { n: picked.size })}
            </Text>
            {bulkNote ? (
              <Text testID="fc-sel-note" style={{ color: th.text2, fontSize: 13 }}>
                {bulkNote}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <TextButton
                testID="fc-sel-move"
                label={t('fc.cfc_sposta_titolo')}
                onPress={() => picked.size && setBulk(bulk === 'move' ? null : 'move')}
              />
              <TextButton
                testID="fc-sel-color"
                label={t('fc.cfc_colore_cartella')}
                onPress={() => picked.size && setBulk(bulk === 'color' ? null : 'color')}
              />
              <TextButton
                testID="fc-sel-archive"
                label={scope === 'active' ? t('fc.cfc_archivia') : t('fc.cfc_ripristina')}
                onPress={() => {
                  if (!picked.size) return;
                  for (const u of bulkIds) services.flashcards.setArchived(u, scope === 'active');
                  stopSelecting();
                  changed();
                }}
              />
              <TextButton
                testID="fc-sel-delete"
                danger
                label={t('comune.elimina')}
                onPress={() => picked.size && setBulk(bulk === 'delete' ? null : 'delete')}
              />
            </View>
            {bulk === 'move' ? (
              <DeckPicker
                decks={decks}
                value={null}
                allowRoot
                rootLabel={t('fc.cfc_in_cima')}
                exclude={new Set(picked)}
                onPick={(target) => {
                  const n = services.flashcards.moveDecks(bulkIds, target);
                  setBulkNote(n < bulkIds.length ? t('fc.cfc_non_selezionabile') : '');
                  stopSelecting();
                  changed();
                }}
              />
            ) : null}
            {bulk === 'color' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Pressable
                  hitSlop={6}
                  testID="fc-sel-color-auto"
                  accessibilityRole="button"
                  onPress={() => {
                    for (const u of bulkIds) services.flashcards.updateDeck(u, { color: null });
                    stopSelecting();
                    changed();
                  }}
                  style={{
                    paddingHorizontal: 12,
                    height: 32,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: th.hairline2,
                  }}
                >
                  <Text style={{ color: th.text, fontSize: 13 }}>{t('comune.automatico')}</Text>
                </Pressable>
                {DECK_SWATCHES.map((c) => (
                  <Pressable
                    hitSlop={6}
                    key={c}
                    testID={`fc-sel-color-${c.slice(1)}`}
                    accessibilityRole="button"
                    onPress={() => {
                      for (const u of bulkIds) services.flashcards.updateDeck(u, { color: c });
                      stopSelecting();
                      changed();
                    }}
                    style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c }}
                  />
                ))}
              </View>
            ) : null}
            {bulk === 'delete' ? (
              <View style={{ gap: 8 }}>
                <Text style={{ color: th.text }}>
                  {t('comune.elimina')}{' '}
                  {picked.size === 1
                    ? t('fc.cfc_elimina_sel_1')
                    : t('fc.cfc_elimina_sel_n', { n: picked.size })}
                  ?
                </Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <TextButton
                      testID="fc-sel-delete-cancel"
                      label={t('comune.annulla')}
                      onPress={() => setBulk(null)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      testID="fc-sel-delete-confirm"
                      danger
                      label={t('comune.elimina')}
                      onPress={() => {
                        const r = services.flashcards.removeEmptyDecks(bulkIds);
                        setBulkNote(
                          r.left === 0
                            ? ''
                            : r.deleted > 0
                              ? t('fc.cfc_eliminate_parziale')
                              : t('fc.cfc_eliminate_nessuna'),
                        );
                        stopSelecting();
                        changed();
                      }}
                    />
                  </View>
                </View>
              </View>
            ) : null}
          </Card>
        ) : bulkNote ? (
          <Text testID="fc-sel-note" style={{ color: th.text2, fontSize: 13 }}>
            {bulkNote}
          </Text>
        ) : null}

        {found && inCards ? (
          hitGroups.length ? (
            <View style={{ gap: 12 }}>
              <Text testID="fc-hits-count" style={{ color: th.text2 }}>
                {t('fc.app_n_carte_trovate', { n: cardHits.length })}
              </Text>
              {hitGroups.map((g) => (
                <Card key={g.deck.uuid}>
                  <View style={{ padding: 12, gap: 2 }}>
                    <Text style={{ color: th.text, fontWeight: '700' }}>{g.deck.name}</Text>
                    {g.path ? (
                      <Text style={{ color: th.text3, fontSize: 12 }}>{g.path}</Text>
                    ) : null}
                  </View>
                  {g.hits.map((h) => (
                    <Pressable
                      key={h.uuid}
                      testID={`fc-hit-${h.uuid}`}
                      accessibilityRole="button"
                      onPress={() =>
                        router.push({
                          pathname: '/fc-card',
                          params: h.child ? { sub: h.uuid } : { id: h.uuid },
                        })
                      }
                      style={{
                        padding: 12,
                        borderTopWidth: 0.5,
                        borderTopColor: th.hairline,
                      }}
                    >
                      <Text style={{ color: th.text }} numberOfLines={3}>
                        {h.excerpt}
                      </Text>
                    </Pressable>
                  ))}
                </Card>
              ))}
            </View>
          ) : query.trim().length >= 2 && !found.length ? (
            <Text style={{ color: th.text2, textAlign: 'center', padding: 24 }}>
              {t('fc.cfc_nessun_risultato')}
            </Text>
          ) : null
        ) : null}

        {found && inCards && found.length ? (
          <SectionLabel>{t('vocab.cat_categorie')}</SectionLabel>
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
          <View style={{ paddingTop: 36, paddingBottom: 12, alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 22,
                backgroundColor: ho.blueSoft,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 6,
              }}
            >
              <HoIcon name="folder" color={ho.blue} size={30} />
            </View>
            <Text style={[{ color: ho.text }, hoTitle(ho, 22)]}>
              {scope === 'active' ? t('vocab.cat_nessuna') : t('fc.cfc_archivio_vuoto')}
            </Text>
            <Text style={{ color: ho.text2, textAlign: 'center', fontSize: 15, lineHeight: 21 }}>
              {scope === 'active' ? t('fc.cfc_nessuna_txt') : t('fc.cfc_archivio_vuoto_txt')}
            </Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <TextInput
            testID="fc-new"
            value={draft}
            onChangeText={setDraft}
            placeholder={t('fc.app_nuova_materia')}
            placeholderTextColor={ho.text3}
            returnKeyType="done"
            onSubmitEditing={() => add(null, draft) && setDraft('')}
            style={{
              flex: 1,
              backgroundColor: ho.surface,
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingVertical: 13,
              color: ho.text,
              fontSize: 17,
            }}
          />
          <Pressable
            testID="fc-new-add"
            accessibilityRole="button"
            accessibilityLabel={t('vocab.cat_aggiungi')}
            accessibilityState={{ disabled: !draft.trim() }}
            disabled={!draft.trim()}
            onPress={() => add(null, draft) && setDraft('')}
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: ho.blue,
              opacity: draft.trim() ? 1 : 0.45,
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 6px 16px ${ho.blueSoft}`,
            }}
          >
            <HoIcon name="plus" color="#FFFFFF" size={24} sw={2.4} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
