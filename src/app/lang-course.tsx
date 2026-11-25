import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
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
import {
  daysToExam,
  deckIcon,
  deckMap,
  deckPath,
  examUrgency,
  flattenDecks,
  gridChildren,
  scopeCounts,
  type DeckScope,
} from '@/features/flashcards/logic';
import { HoIcon, hoTheme } from '@/features/home/HomeKit';
import { langFlag, langName } from '@/features/languages/langs';
import { localToday } from '@/features/tasks/groups';
import { Card, TextButton } from '@/ui/kit';

const fold = (s: string | null | undefined): string =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Un corso di lingua (fc_decks.php?course=N): i suoi mazzi ad albero e la ricerca fra tutte le sue parole. */
export default function LangCourseScreen() {
  const th = useTheme();
  const ho = hoTheme(th);
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { services, version, changed, localPrefs, updateLocalPrefs } = useApp();
  const ui: 'it' | 'en' = i18n.language === 'en' ? 'en' : 'it';

  const [scope, setScope] = useState<DeckScope>('active');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  // come sul sito: l'albero parte chiuso e si ricordano solo i rami aperti
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [folder, setFolder] = useState<string[]>([]);
  const [addingUnder, setAddingUnder] = useState<string | null>(null);
  const [subDraft, setSubDraft] = useState('');

  const data = useMemo(() => {
    void version;
    if (!services || typeof id !== 'string') return null;
    const repo = services.languages;
    const course = repo.course(id);
    if (!course) return null;
    return {
      course,
      decks: repo.decks(id),
      counts: repo.wordCounts(id),
      words: repo.courseWords(id),
      learnt: repo.learnt(),
      stats: repo.games(id).deckStats(),
    };
  }, [services, version, id]);

  if (!services || typeof id !== 'string') return null;
  if (!data) {
    // il corso non c'è (più): si torna indietro
    return (
      <View style={{ flex: 1, backgroundColor: th.bg, paddingTop: insets.top + 40, padding: 24 }}>
        <TextButton
          testID="lcourse-gone-back"
          label={t('comune.indietro')}
          onPress={() => router.back()}
        />
      </View>
    );
  }
  const repo = services.languages;
  const { course, decks, counts, words, learnt, stats } = data;
  const map = deckMap(decks);
  const today = localToday();
  const scopes = scopeCounts(decks);
  const needle = fold(query.trim());
  const found = needle
    ? words.filter((w) => [w.word, w.translation, w.meaning].some((x) => fold(x).includes(needle)))
    : null;
  const totalWords = [...counts.values()].reduce((a, b) => a + b, 0);
  const withKids = new Set(
    decks.filter((d) => decks.some((c) => c.parent_uuid === d.uuid)).map((d) => d.uuid),
  );
  const collapsed = new Set([...withKids].filter((x) => !expanded.has(x)));
  const rows = flattenDecks(decks, scope, collapsed);
  const groups = groupByRoot(rows);
  const view = localPrefs.fcTreeView;

  const add = (parent: string | null, name: string) => {
    const deck = repo.createDeck(id, { name, parent });
    if (!deck) return false;
    if (parent && !expanded.has(parent)) setExpanded(new Set(expanded).add(parent));
    changed();
    return true;
  };
  const openDeck = (deck: string) => router.push({ pathname: '/lang-deck', params: { id: deck } });

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
    return (
      <Text
        style={{
          color: u === 'urgent' ? th.red : u === 'near' ? th.orange : th.text2,
          fontSize: 12,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    );
  };

  const toggleOpen = (deckId: string) => {
    const next = new Set(expanded);
    if (next.has(deckId)) next.delete(deckId);
    else next.add(deckId);
    setExpanded(next);
  };

  const words_ = (n: number) => `${n} ${n === 1 ? t('fchub.parola') : t('fchub.parole')}`;

  const deckRow = (deckId: string, depth: number, hasChildren: boolean, root: boolean) => {
    const d = map.get(deckId)!;
    const n = counts.get(deckId) ?? 0;
    return (
      <DeckRowShell
        key={deckId}
        color={d.color}
        name={d.name}
        iconName={deckIcon(d)}
        pinned={!!d.pinned}
        depth={depth}
        root={root}
        hasChildren={hasChildren}
        open={hasChildren && expanded.has(deckId)}
        archived={scope === 'archived'}
        ids={{
          toggle: `lcourse-toggle-${deckId}`,
          row: `lcourse-deck-${deckId}`,
          add: `lcourse-add-${deckId}`,
        }}
        onToggle={() => toggleOpen(deckId)}
        onPress={() => openDeck(deckId)}
        badge={String(n)}
        badgeLabel={words_(n)}
        addable={scope === 'active'}
        adding={addingUnder === deckId}
        onAdd={() => {
          setAddingUnder(addingUnder === deckId ? null : deckId);
          setSubDraft('');
        }}
        addLabel={t('fc.cfc_aggiungi_sottocategoria')}
        below={examChip(d.exam_date)}
        footer={
          addingUnder === deckId ? (
            <SubDeckInput
              testID="lcourse-sub-input"
              depth={depth}
              value={subDraft}
              onChange={setSubDraft}
              placeholder={t('fc.cfc_aggiungi_sottocategoria')}
              onSubmit={() => {
                if (add(deckId, subDraft)) {
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
            hard: 0,
            exam: examChip(d.exam_date),
          };
        })
      : [];
  const gridCrumbs = folder.map((x) => map.get(x)?.name ?? '');

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <TreeHeader
        top={insets.top}
        titleLead={langFlag(course.learn_lang)}
        title={langName(course.learn_lang, ui)}
        subtitle={`${t('fchub.dalla_lingua', { lingua: langName(course.known_lang, ui, false) })} · ${t('fcv.conteggio', { categorie: decks.length, carte: totalWords })}`}
        onBack={() => router.back()}
        backTestID="lcourse-close"
        backLabel={t('comune.indietro')}
        play={{
          testID: 'lcourse-play',
          label: t('fc.cg_gioca'),
          onPress: () => router.push({ pathname: '/fc-setup', params: { course: course.uuid } }),
          colors: [ho.pink, ho.orange],
          disabled: totalWords === 0,
        }}
        search={{
          testID: 'lcourse-search',
          value: query,
          onChange: setQuery,
          placeholder: t('fchub.app_cerca_parole'),
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
        {found ? (
          found.length ? (
            <Card>
              {found.slice(0, 100).map((w, i) => {
                const path = [...deckPath(map, w.category_uuid), map.get(w.category_uuid)!]
                  .filter(Boolean)
                  .map((p) => p.name)
                  .join(' › ');
                return (
                  <Pressable
                    key={w.uuid}
                    testID={`lcourse-word-${w.uuid}`}
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: '/lang-word', params: { id: w.uuid } })}
                    style={{
                      padding: 12,
                      gap: 2,
                      borderTopWidth: i ? 0.5 : 0,
                      borderTopColor: th.hairline,
                    }}
                  >
                    <Text style={{ color: th.text, fontSize: 16, fontWeight: '600' }}>
                      {learnt.has(w.uuid) ? '✓ ' : ''}
                      {w.word}
                    </Text>
                    <Text style={{ color: th.text2 }}>
                      {w.translation || t('fchub.app_traduzione_vuota')}
                    </Text>
                    <Text style={{ color: th.text3, fontSize: 12 }} numberOfLines={1}>
                      {path}
                    </Text>
                  </Pressable>
                );
              })}
            </Card>
          ) : (
            <Text style={{ color: th.text2, textAlign: 'center', padding: 24 }}>
              {t('vocab.vi_nessun_risultato')}
            </Text>
          )
        ) : (
          <>
            <ScopeBar
              scope={scope}
              counts={scopes}
              labels={{ active: t('fc.cfc_attive'), archived: t('fc.cfc_archiviate') }}
              testIDPrefix="lcourse"
              onScope={(next) => {
                setScope(next);
                setFolder([]);
              }}
              tools={
                <>
                  <ViewToggle
                    testID="lcourse-view"
                    view={view}
                    label={t('fc.cfc_elenco_griglia')}
                    onToggle={() => {
                      updateLocalPrefs({ fcTreeView: view === 'grid' ? 'list' : 'grid' });
                      setFolder([]);
                    }}
                  />
                  {view === 'list' && withKids.size ? (
                    <Pressable
                      testID="lcourse-collapse"
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
                    testID="lcourse-history"
                    accessibilityRole="button"
                    accessibilityLabel={t('fc.sfc_storico')}
                    onPress={() =>
                      router.push({ pathname: '/fc-history', params: { course: course.uuid } })
                    }
                    style={toolButton(ho, false)}
                  >
                    <HoIcon name="list" color={ho.text2} size={19} />
                  </Pressable>
                </>
              }
            />

            {view === 'grid' ? (
              <DeckGrid
                prefix="lcourse"
                items={gridItems}
                crumbs={gridCrumbs}
                rootLabel={scope === 'archived' ? t('fc.cfc_archivio') : t('fc.cfc_tutte')}
                emptyText={t('fc.cfc_griglia_vuota')}
                selecting={false}
                picked={new Set()}
                openLabel={t('fc.cfc_apri')}
                hardLabel={(n) => String(n)}
                onCrumb={(i) => setFolder(folder.slice(0, i + 1))}
                onCard={(deckId) => {
                  if ((gridItems.find((g) => g.id === deckId)?.subs ?? 0) > 0) {
                    setFolder([...folder, deckId]);
                  } else {
                    openDeck(deckId);
                  }
                }}
                onOpen={openDeck}
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
                        {deckRow(r.deck.uuid, r.depth, r.hasChildren, r.depth === 0)}
                      </View>
                    ))}
                  </Card>
                ))}
              </View>
            ) : (
              <EmptyTree
                title={scope === 'active' ? t('fchub.primo_mazzo') : t('fc.cfc_archivio_vuoto')}
                text={scope === 'active' ? undefined : t('fc.cfc_archivio_vuoto_txt')}
              />
            )}

            <NewDeckBar
              inputID="lcourse-new"
              addID="lcourse-new-add"
              value={draft}
              onChange={setDraft}
              placeholder={t('fchub.app_nuovo_mazzo')}
              addLabel={t('vocab.cat_aggiungi')}
              onAdd={() => add(view === 'grid' ? gridParent : null, draft) && setDraft('')}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}
