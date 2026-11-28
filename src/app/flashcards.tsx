import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { DeckPicker } from '@/features/flashcards/DeckPicker';
import {
  DeckGrid,
  DeckRowShell,
  EmptyTree,
  NewDeckBar,
  ScopeBar,
  SubDeckInput,
  TreeHeader,
  ViewToggle,
  groupByRoot,
  toolButton,
  type GridItem,
} from '@/features/flashcards/DeckTreeParts';
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
  gridChildren,
  scopeCounts,
  searchDecks,
  type DeckScope,
} from '@/features/flashcards/logic';
import { ResumeCard } from '@/features/flashcards/ResumeCard';
import { localToday } from '@/features/tasks/groups';
import { Card, PrimaryButton, SectionLabel, TextButton } from '@/ui/kit';
import { HoIcon, hoTheme } from '@/features/home/HomeKit';

/** Le categorie delle flashcard di studio ad albero (fc_decks.php): materie, sottocategorie, archivio, ricerca. */
export default function FlashcardsScreen() {
  const th = useTheme();
  const ho = hoTheme(th);
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services, version, changed, localPrefs, updateLocalPrefs } = useApp();

  const [scope, setScope] = useState<DeckScope>('active');
  const [query, setQuery] = useState('');
  const [inCards, setInCards] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<null | 'move' | 'color' | 'delete'>(null);
  const [bulkNote, setBulkNote] = useState('');
  const [draft, setDraft] = useState('');
  // come sul sito: l'albero parte chiuso e si ricordano solo i rami aperti
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // la griglia: le cartelle in cui si è scesi (come le briciole di pane del sito)
  const [folder, setFolder] = useState<string[]>([]);
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
  const withKids = new Set(
    decks.filter((d) => decks.some((c) => c.parent_uuid === d.uuid)).map((d) => d.uuid),
  );
  const collapsed = new Set([...withKids].filter((id) => !expanded.has(id)));
  const rows = flattenDecks(decks, scope, collapsed);
  // ogni materia (radice) è una carta sua, con dentro i suoi rami
  const groups = groupByRoot(rows);
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
    if (parent && !expanded.has(parent)) setExpanded(new Set(expanded).add(parent));
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

  const toggleOpen = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const renderRow = ({
    id,
    depth,
    hasChildren,
    path,
    root = false,
  }: {
    id: string;
    depth: number;
    hasChildren: boolean;
    path?: string;
    root?: boolean;
  }) => {
    const d = decks.find((x) => x.uuid === id)!;
    const n = counts.get(id) ?? 0;
    const hard = stats.get(id)?.hard ?? 0;
    return (
      <DeckRowShell
        key={id}
        color={d.color}
        name={d.name}
        iconName={deckIcon(d)}
        pinned={!!d.pinned}
        depth={depth}
        root={root}
        hasChildren={hasChildren}
        open={hasChildren && expanded.has(id)}
        archived={scope === 'archived'}
        selecting={selecting}
        checked={picked.has(id)}
        ids={{ toggle: `fc-toggle-${id}`, row: `fc-row-${id}`, add: `fc-add-${id}` }}
        onToggle={() => toggleOpen(id)}
        onPress={() => (selecting ? pickDeck(id) : open(id))}
        badge={String(n)}
        badgeLabel={n === 1 ? t('fc.app_n_carte_1') : t('fc.app_mostra_tutte_carte', { n })}
        addable={scope === 'active' && !found && !selecting}
        adding={addingUnder === id}
        onAdd={() => {
          setAddingUnder(addingUnder === id ? null : id);
          setSubDraft('');
        }}
        addLabel={t('fc.cfc_aggiungi_sottocategoria')}
        below={
          <>
            {path ? (
              <Text style={{ color: th.text2, fontSize: 12 }} numberOfLines={1}>
                {path}
              </Text>
            ) : null}
            {examChip(d.exam_date)}
            {statsLine(id)}
          </>
        }
        beforeBadge={
          hard >= 2 ? (
            <Pressable
              testID={`fc-hard-${id}`}
              accessibilityRole="button"
              accessibilityLabel={t('fc.dk_da_ripassare', { n: hard })}
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
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{hard}</Text>
            </Pressable>
          ) : null
        }
        footer={
          addingUnder === id ? (
            <SubDeckInput
              testID="fc-sub-input"
              depth={depth}
              value={subDraft}
              onChange={setSubDraft}
              placeholder={t('fc.cfc_aggiungi_sottocategoria')}
              onSubmit={() => {
                if (add(id, subDraft)) {
                  setSubDraft('');
                  setAddingUnder(null);
                }
              }}
            />
          ) : null
        }
      />
    );
  };

  // la vista a griglia: le cartelle della cartella in cui si è scesi
  const view = localPrefs.fcTreeView;
  const gridParent = folder.at(-1) ?? null;
  const gridItems: GridItem[] =
    view === 'grid' && !found
      ? gridChildren(decks, scope, gridParent).map((d) => {
          const st = stats.get(d.uuid);
          return {
            id: d.uuid,
            name: d.name,
            color: d.color,
            iconName: deckIcon(d),
            pinned: !!d.pinned,
            cards: counts.get(d.uuid) ?? 0,
            subs: gridChildren(decks, scope, d.uuid).length,
            games: st?.games ?? 0,
            levels: st ? st.levels : null,
            knownPct: st && st.total ? Math.round((st.known / st.total) * 100) : 0,
            hard: st?.hard ?? 0,
            exam: examChip(d.exam_date),
          };
        })
      : [];
  const gridCrumbs = folder.map((id) => decks.find((x) => x.uuid === id)?.name ?? '');

  const resume = services.games.unfinished();

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <TreeHeader
        top={insets.top}
        title={t('vocab.cat_categorie')}
        subtitle={t('fc.cfc_conteggio', { categorie: decks.length, carte: totalCards })}
        onBack={() => router.back()}
        backTestID="fc-close"
        backLabel={t('comune.indietro')}
        play={{
          testID: 'fc-play',
          label: t('fc.cg_gioca'),
          onPress: () => router.push('/fc-history'),
          colors: [ho.blue, ho.indigo],
        }}
        search={{
          testID: 'fc-search',
          value: query,
          onChange: setQuery,
          placeholder: t('vocab.cat_cerca'),
        }}
      />
      <ScrollView
        contentContainerStyle={{
          padding: 14,
          paddingTop: 12,
          paddingBottom: insets.bottom + 40,
          gap: 12,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {resume ? (
          <ResumeCard
            ho={ho}
            title={t('fc.res_continua')}
            closed={resume.closed}
            total={resume.total}
            onPress={() =>
              router.push({
                pathname: '/fc-game',
                params: { game: resume.game.uuid, position: String(resume.position) },
              })
            }
          />
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
          <ScopeBar
            scope={scope}
            counts={scopes}
            labels={{ active: t('fc.cfc_attive'), archived: t('fc.cfc_archiviate') }}
            testIDPrefix="fc"
            onScope={(next) => {
              setScope(next);
              setFolder([]);
            }}
            tools={
              <>
                <ViewToggle
                  testID="fc-view"
                  view={view}
                  label={t('fc.cfc_elenco_griglia')}
                  onToggle={() => {
                    updateLocalPrefs({ fcTreeView: view === 'grid' ? 'list' : 'grid' });
                    setFolder([]);
                  }}
                />
                {view === 'list' && withKids.size ? (
                  <Pressable
                    testID="fc-collapse"
                    accessibilityRole="button"
                    accessibilityLabel={
                      expanded.size ? t('fc.cfc_comprimi_tutto') : t('vocab.cat_espandi')
                    }
                    onPress={() => setExpanded(expanded.size ? new Set() : new Set(withKids))}
                    style={toolButton(ho, false)}
                  >
                    <HoIcon name="updown" color={ho.text2} size={19} />
                  </Pressable>
                ) : null}
                <Pressable
                  testID="fc-select"
                  accessibilityRole="button"
                  accessibilityLabel={selecting ? t('fc.cfc_fine') : t('fc.cfc_seleziona')}
                  onPress={() => (selecting ? stopSelecting() : setSelecting(true))}
                  style={toolButton(ho, selecting)}
                >
                  <HoIcon name="checksq" color={selecting ? '#FFFFFF' : ho.text2} size={19} />
                </Pressable>
              </>
            }
          />
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
        ) : view === 'grid' ? (
          <DeckGrid
            prefix="fc"
            items={gridItems}
            crumbs={gridCrumbs}
            rootLabel={scope === 'archived' ? t('fc.cfc_archivio') : t('fc.cfc_tutte')}
            emptyText={t('fc.cfc_griglia_vuota')}
            selecting={selecting}
            picked={picked}
            openLabel={t('fc.cfc_apri')}
            hardLabel={(n) => t('fc.dk_da_ripassare', { n })}
            onCrumb={(i) => setFolder(folder.slice(0, i + 1))}
            onCard={(id) => {
              if (selecting) pickDeck(id);
              else if ((gridItems.find((g) => g.id === id)?.subs ?? 0) > 0)
                setFolder([...folder, id]);
              else open(id);
            }}
            onOpen={open}
            onHard={playHard}
          />
        ) : rows.length ? (
          <View style={{ gap: 14 }}>
            {groups.map((g, gi) => (
              <Card key={g[0]?.deck.uuid ?? gi} index={Math.min(gi, 6)}>
                {g.map((r, i) => (
                  <View
                    key={r.deck.uuid}
                    style={{ borderTopWidth: i ? 0.5 : 0, borderTopColor: th.hairline }}
                  >
                    {renderRow({
                      id: r.deck.uuid,
                      depth: r.depth,
                      hasChildren: r.hasChildren,
                      root: r.depth === 0,
                    })}
                  </View>
                ))}
              </Card>
            ))}
          </View>
        ) : (
          <EmptyTree
            title={scope === 'active' ? t('vocab.cat_nessuna') : t('fc.cfc_archivio_vuoto')}
            text={scope === 'active' ? t('fc.cfc_nessuna_txt') : t('fc.cfc_archivio_vuoto_txt')}
          />
        )}

        <NewDeckBar
          inputID="fc-new"
          addID="fc-new-add"
          value={draft}
          onChange={setDraft}
          placeholder={t('fc.app_nuova_materia')}
          addLabel={t('vocab.cat_aggiungi')}
          onAdd={() => add(view === 'grid' && !found ? gridParent : null, draft) && setDraft('')}
        />
      </ScrollView>
    </View>
  );
}
