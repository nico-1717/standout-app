import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { CardViewer } from '@/features/flashcards/CardViewer';
import { DeckIcon } from '@/features/flashcards/DeckIcon';
import {
  CARD_SORTS,
  filterCards,
  levelCounts,
  plainText,
  type CardSort,
} from '@/features/flashcards/cardList';
import { DeckPicker } from '@/features/flashcards/DeckPicker';
import type { GameStatus } from '@/features/flashcards/game';
import { studyView } from '@/features/flashcards/gameKit';
import { isTitleCard } from '@/features/flashcards/game';
import { LEVEL_COLORS, LEVELS, type Level } from '@/features/flashcards/levels';
import {
  DECK_ICON_KEYS,
  DECK_SWATCHES,
  compareDecks,
  daysToExam,
  deckBranch,
  deckIcon,
  deckMap,
  deckPath,
  examUrgency,
  iconFromName,
  type Deck,
} from '@/features/flashcards/logic';
import { isRichNote, noteText } from '@/features/projects/notes';
import { localToday } from '@/features/tasks/groups';
import { DateTimeField } from '@/ui/DateTimeField';
import { Card, Header, PrimaryButton, SectionLabel, TextButton } from '@/ui/kit';

const preview = (raw: string | null): string => {
  const t = plainText(raw);
  return t.length > 110 ? t.slice(0, 110) + '…' : t;
};

const SORT_LABELS: Record<CardSort, string> = {
  position: 'fc.vis_posizione',
  newest: 'fc.vis_id_recenti',
  oldest: 'fc.vis_id_meno_recenti',
  question: 'fc.vis_domanda_az',
  hardest: 'fcv.vis_piu_difficili',
};

/** La scheda di una categoria: nome, padre, colore, icona, esame, fissata/archiviata, note; sottocategorie e carte. */
export default function DeckScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { services, version, changed } = useApp();

  const [name, setName] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [sub, setSub] = useState('');
  const [moving, setMoving] = useState(false);
  const [iconsOpen, setIconsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState<GameStatus>('all');
  const [text, setText] = useState('');
  const [level, setLevel] = useState<Level | ''>('');
  const [sort, setSort] = useState<CardSort>('position');
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<'move' | 'delete' | 'join' | null>(null);
  const [joinNote, setJoinNote] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);

  const data = useMemo(() => {
    void version;
    if (!services || typeof id !== 'string') return null;
    const repo = services.flashcards;
    const deck = repo.deck(id);
    if (!deck) return null;
    const decks = repo.decks();
    return {
      deck,
      decks,
      kids: decks.filter((d) => d.parent_uuid === id).sort(compareDecks),
      cards: repo.cards(id),
      counts: repo.cardCounts(),
      canDelete: repo.canDeleteDeck(id),
      levels: services.games.cardLevels(repo.cards(id)),
      childCounts: repo.childCounts(id),
      learnt: services.study.learnt(),
    };
  }, [services, version, id]);

  if (!services || typeof id !== 'string') return null;
  if (!data) {
    // la categoria non c'è (più): si torna indietro
    return (
      <View style={{ flex: 1, backgroundColor: th.bg, paddingTop: insets.top + 40, padding: 24 }}>
        <TextButton
          testID="fcd-gone-back"
          label={t('comune.indietro')}
          onPress={() => router.back()}
        />
      </View>
    );
  }
  const { deck, decks, kids, counts, levels, learnt, childCounts } = data;
  const passes = services.games.cardFilter(filter);
  const byStatus = filter === 'all' ? data.cards : data.cards.filter(passes);
  const cards = filterCards(byStatus, levels, { text, level, sort });
  const perLevel = levelCounts(byStatus, levels);
  const stopSelecting = () => {
    setSelecting(false);
    setPicked(new Set());
    setBulk(null);
  };
  const repo = services.flashcards;
  const map = deckMap(decks);
  const crumbs = deckPath(map, id);
  const rich = !!deck.notes && isRichNote(deck.notes);
  const today = localToday();
  const exam = daysToExam(deck.exam_date, today);

  const patch = (p: Parameters<typeof repo.updateDeck>[1]) => {
    repo.updateDeck(id, p);
    changed();
  };
  const saveName = () => {
    if (name !== null) repo.updateDeck(id, { name });
    setName(null);
    changed();
  };
  const saveNote = () => {
    if (note !== null && !rich) repo.updateDeck(id, { notes: note });
    setNote(null);
    changed();
  };
  const open = (d: Deck) => router.push({ pathname: '/fc-deck', params: { id: d.uuid } });
  const autoIcon = iconFromName(deck.name);

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        top={insets.top}
        title={deck.name}
        right={
          <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
            <Pressable
              testID="fcd-pin"
              accessibilityRole="button"
              accessibilityLabel={t('fc.dk_fissa')}
              onPress={() => {
                repo.setPinned(id, !deck.pinned);
                changed();
              }}
            >
              <Text style={{ fontSize: 18, opacity: deck.pinned ? 1 : 0.35 }}>📌</Text>
            </Pressable>
            <Pressable
              testID="fcd-close"
              accessibilityRole="button"
              accessibilityLabel={t('comune.chiudi')}
              onPress={() => router.back()}
            >
              <Text style={{ color: th.brand, fontSize: 17 }}>✕</Text>
            </Pressable>
          </View>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 48, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        {crumbs.length ? (
          <Text style={{ color: th.text2 }} numberOfLines={2}>
            {crumbs.map((c, i) => (
              <Text key={c.uuid} testID={`fcd-crumb-${c.uuid}`} onPress={() => open(c)}>
                {i ? ' › ' : ''}
                {c.name}
              </Text>
            ))}
          </Text>
        ) : null}

        <Card style={{ padding: 16, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 13,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: deck.color + '26',
              }}
            >
              <DeckIcon name={deckIcon(deck)} color={deck.color} size={26} />
            </View>
            <TextInput
              testID="fcd-name"
              value={name ?? deck.name}
              onChangeText={setName}
              onBlur={saveName}
              onSubmitEditing={saveName}
              placeholder={t('fc.app_nome_mazzo')}
              placeholderTextColor={th.text3}
              style={{ flex: 1, color: th.text, fontSize: 22, fontWeight: '700' }}
            />
          </View>

          <TextButton
            testID="fcd-insert"
            label={t('fc.ifc_inserisci')}
            onPress={() => router.push({ pathname: '/fc-insert', params: { deck: id } })}
          />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                testID="fcd-play"
                label={t('fc.cg_gioca')}
                onPress={() => router.push({ pathname: '/fc-setup', params: { preselect: id } })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                testID="fcd-add-card"
                label={t('fc.app_aggiungi_carta')}
                onPress={() => router.push({ pathname: '/fc-card', params: { deck: id } })}
              />
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <SectionLabel>{t('fc.dk_data_esame')}</SectionLabel>
            <DateTimeField
              kind="date"
              testID="fcd-exam"
              value={deck.exam_date ?? ''}
              fallback={today}
              placeholder={t('fc.dk_data_esame')}
              clearable
              onChange={(v) => patch({ exam_date: v || null })}
            />
            {exam !== null ? (
              <Text
                style={{
                  color:
                    examUrgency(exam) === 'urgent'
                      ? th.red
                      : examUrgency(exam) === 'near'
                        ? th.orange
                        : th.text2,
                  fontWeight: '600',
                }}
              >
                {exam === 0
                  ? t('fc.dk_esame_oggi')
                  : exam === 1
                    ? t('fc.dk_esame_domani')
                    : t('fc.dk_esame_tra', { n: exam })}
              </Text>
            ) : null}
          </View>

          <View style={{ gap: 8 }}>
            <SectionLabel>{t('fc.cfc_colore_cartella')}</SectionLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <Pressable
                hitSlop={6}
                testID="fcd-color-auto"
                accessibilityRole="radio"
                accessibilityLabel={t('fc.app_colore_auto')}
                accessibilityState={{ selected: !deck.color_edited }}
                onPress={() => patch({ color: null })}
                style={{
                  paddingHorizontal: 12,
                  height: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: !deck.color_edited ? th.brand : th.hairline2,
                }}
              >
                <Text style={{ color: th.text, fontSize: 13 }}>{t('comune.automatico')}</Text>
              </Pressable>
              {DECK_SWATCHES.map((c) => {
                const on = !!deck.color_edited && deck.color.toUpperCase() === c;
                return (
                  <Pressable
                    hitSlop={6}
                    key={c}
                    testID={`fcd-color-${c.slice(1)}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    onPress={() => patch({ color: c })}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: c,
                      borderWidth: on ? 3 : 0,
                      borderColor: th.text,
                    }}
                  />
                );
              })}
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Pressable
              testID="fcd-icon-toggle"
              accessibilityRole="button"
              onPress={() => setIconsOpen(!iconsOpen)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <SectionLabel>{t('fc.dk_icona')}</SectionLabel>
              <Text style={{ color: th.brand }}>{iconsOpen ? '▲' : '▼'}</Text>
            </Pressable>
            {iconsOpen ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[null, ...DECK_ICON_KEYS].map((k) => {
                  const on = (deck.icon ?? null) === k;
                  return (
                    <Pressable
                      key={k ?? '__auto'}
                      testID={`fcd-icon-${k ?? '_auto'}`}
                      accessibilityRole="radio"
                      accessibilityLabel={k ? t(`fc.ico_${k}`) : t('fc.dk_icona_auto')}
                      accessibilityState={{ selected: on }}
                      onPress={() => patch({ icon: k })}
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: on ? deck.color + '33' : th.surface2,
                        borderWidth: on ? 2 : 0,
                        borderColor: deck.color,
                      }}
                    >
                      {k ? (
                        <DeckIcon name={k} color={on ? deck.color : th.text2} size={24} />
                      ) : (
                        <View style={{ alignItems: 'center' }}>
                          <DeckIcon name={autoIcon} color={on ? deck.color : th.text2} size={20} />
                          <Text style={{ color: th.text2, fontSize: 9 }}>A</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ flex: 1, color: th.text, fontWeight: '600' }}>{t('fc.dk_fissa')}</Text>
            <Switch
              testID="fcd-pin-switch"
              value={!!deck.pinned}
              onValueChange={(v) => {
                repo.setPinned(id, v);
                changed();
              }}
              trackColor={{ true: th.brand }}
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ flex: 1, color: th.text, fontWeight: '600' }}>
              {t('fc.cfc_archivia_questa')}
            </Text>
            <Switch
              testID="fcd-archive-switch"
              value={!!deck.archived}
              onValueChange={(v) => {
                repo.setArchived(id, v);
                changed();
              }}
              trackColor={{ true: th.brand }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <SectionLabel>{t('fc.cfc_padre_titolo')}</SectionLabel>
            <Pressable
              testID="fcd-parent"
              accessibilityRole="button"
              onPress={() => setMoving(!moving)}
            >
              <Text style={{ color: th.brand, fontSize: 16 }}>
                {deck.parent_uuid ? (map.get(deck.parent_uuid)?.name ?? '—') : t('fc.cfc_tutte')} ›
              </Text>
            </Pressable>
            {moving ? (
              <Card style={{ backgroundColor: th.surface2 }}>
                <DeckPicker
                  decks={decks}
                  value={deck.parent_uuid}
                  allowRoot
                  rootLabel={t('fc.cfc_tutte')}
                  exclude={new Set(deckBranch(decks, id))}
                  onCreate={(name, parent) => repo.createDeck({ name, parent })}
                  onPick={(p) => {
                    repo.moveDeck(id, p);
                    setMoving(false);
                    changed();
                  }}
                />
              </Card>
            ) : null}
          </View>
        </Card>

        <Card style={{ padding: 16, gap: 8 }}>
          <SectionLabel>{t('fc.app_note_mazzo')}</SectionLabel>
          {rich ? (
            <>
              <Text testID="fcd-note-rich" style={{ color: th.text2, fontSize: 13 }}>
                {t('fc.app_note_ricche')}
              </Text>
              <Text style={{ color: th.text }}>{noteText(deck.notes ?? '')}</Text>
            </>
          ) : (
            <TextInput
              testID="fcd-note"
              value={note ?? deck.notes ?? ''}
              onChangeText={setNote}
              onBlur={saveNote}
              multiline
              placeholder={t('comune.note')}
              placeholderTextColor={th.text3}
              style={{ color: th.text, fontSize: 16, minHeight: 60, textAlignVertical: 'top' }}
            />
          )}
        </Card>

        <View style={{ gap: 8 }}>
          <SectionLabel>{t('fc.cfc_f_sottocategorie')}</SectionLabel>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              testID="fcd-sub-input"
              value={sub}
              onChangeText={setSub}
              placeholder={t('fc.cfc_aggiungi_sottocategoria')}
              placeholderTextColor={th.text3}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (repo.createDeck({ name: sub, parent: id })) {
                  setSub('');
                  changed();
                }
              }}
              style={{
                flex: 1,
                backgroundColor: th.surface,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: th.hairline,
                paddingHorizontal: 14,
                paddingVertical: 11,
                color: th.text,
                fontSize: 16,
              }}
            />
            <View style={{ width: 96 }}>
              <PrimaryButton
                testID="fcd-sub-add"
                label={t('vocab.cat_aggiungi')}
                disabled={!sub.trim()}
                onPress={() => {
                  if (repo.createDeck({ name: sub, parent: id })) {
                    setSub('');
                    changed();
                  }
                }}
              />
            </View>
          </View>
          {kids.length ? (
            <Card>
              {kids.map((k, i) => (
                <Pressable
                  key={k.uuid}
                  testID={`fcd-kid-${k.uuid}`}
                  accessibilityRole="button"
                  onPress={() => open(k)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    borderTopWidth: i ? 0.5 : 0,
                    borderTopColor: th.hairline,
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: k.color + '26',
                    }}
                  >
                    <DeckIcon name={deckIcon(k)} color={k.color} size={20} />
                  </View>
                  <Text style={{ flex: 1, color: th.text, fontSize: 16 }} numberOfLines={1}>
                    {k.name}
                  </Text>
                  <Text style={{ color: th.text2 }}>{counts.get(k.uuid) ?? 0}</Text>
                </Pressable>
              ))}
            </Card>
          ) : null}
        </View>

        <View style={{ gap: 8 }}>
          <SectionLabel>{t('fc.cfc_carte')}</SectionLabel>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(
              [
                ['all', t('fc.cg_tutti_stati')],
                ['0', t('fc.cg_to_learn')],
                ['1', t('fc.cg_learnt')],
              ] as [GameStatus, string][]
            ).map(([v, label]) => (
              <Pressable
                key={v}
                testID={`fcd-filter-${v}`}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === v }}
                onPress={() => setFilter(v)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 16,
                  backgroundColor: filter === v ? th.brand : th.surface2,
                }}
              >
                <Text style={{ color: filter === v ? '#fff' : th.text, fontWeight: '600' }}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            testID="fcd-search"
            value={text}
            onChangeText={setText}
            placeholder={t('fc.vis_cerca')}
            placeholderTextColor={th.text3}
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={{
              color: th.text,
              fontSize: 15,
              backgroundColor: th.surface2,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 9,
            }}
          />
          {perLevel.size ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {[
                ['' as const, t('fc.vis_tutti_livelli'), byStatus.length] as const,
                ...LEVELS.filter((l) => perLevel.has(l)).map(
                  (l) => [l, t(`fcv.liv_${l}`), perLevel.get(l) ?? 0] as const,
                ),
              ].map(([v, label, n]) => (
                <Pressable
                  key={v || 'all'}
                  testID={`fcd-level-filter-${v || 'all'}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: level === v }}
                  onPress={() => setLevel(v)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 16,
                    backgroundColor: level === v ? th.brand : th.surface2,
                  }}
                >
                  {v ? (
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: LEVEL_COLORS[v],
                      }}
                    />
                  ) : null}
                  <Text style={{ color: level === v ? '#fff' : th.text, fontWeight: '600' }}>
                    {label}
                    {v ? ` (${n})` : ''}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Pressable
              testID="fcd-sort"
              accessibilityRole="button"
              accessibilityLabel={t('fc.vis_ordina')}
              onPress={() =>
                setSort(CARD_SORTS[(CARD_SORTS.indexOf(sort) + 1) % CARD_SORTS.length]!)
              }
            >
              <Text style={{ color: th.brand, fontWeight: '600' }}>⇅ {t(SORT_LABELS[sort])}</Text>
            </Pressable>
            <Pressable
              testID="fcd-view"
              accessibilityRole="button"
              onPress={() => setViewing(true)}
            >
              <Text style={{ color: th.brand, fontWeight: '600' }}>{t('fc.vis_fcv_apri')}</Text>
            </Pressable>
            <Text testID="fcd-shown" style={{ color: th.text2, fontSize: 13 }}>
              {t(cards.length === 1 ? 'fc.vis_una_carta_mostrata' : 'fc.vis_n_carte_mostrate', {
                n: cards.length,
              }).replace(/<[^>]+>/g, '')}
            </Text>
            <Pressable
              testID="fcd-select"
              accessibilityRole="button"
              accessibilityState={{ selected: selecting }}
              onPress={() => (selecting ? stopSelecting() : setSelecting(true))}
            >
              <Text style={{ color: th.brand, fontWeight: '600' }}>
                {selecting ? t('fc.vis_annulla_sel') : t('vocab.vi_seleziona')}
              </Text>
            </Pressable>
          </View>
          {selecting ? (
            <Card style={{ padding: 12, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Pressable
                  testID="fcd-select-all"
                  accessibilityRole="button"
                  onPress={() =>
                    setPicked(
                      picked.size === cards.length ? new Set() : new Set(cards.map((c) => c.uuid)),
                    )
                  }
                >
                  <Text style={{ color: th.brand, fontWeight: '600' }}>{t('vocab.vi_tutte')}</Text>
                </Pressable>
                <Text testID="fcd-picked" style={{ color: th.text, fontWeight: '700' }}>
                  {picked.size}
                </Text>
                <View style={{ flex: 1 }} />
                {picked.size ? (
                  <>
                    <Pressable
                      testID="fcd-bulk-move"
                      accessibilityRole="button"
                      onPress={() => setBulk(bulk === 'move' ? null : 'move')}
                    >
                      <Text style={{ color: th.brand, fontWeight: '600' }}>
                        {t('vocab.cat_sposta_attr')}
                      </Text>
                    </Pressable>
                    <Pressable
                      testID="fcd-bulk-join"
                      accessibilityRole="button"
                      onPress={() => setBulk(bulk === 'join' ? null : 'join')}
                    >
                      <Text style={{ color: th.brand, fontWeight: '600' }}>
                        {t('vocab.vi_unisci')}
                      </Text>
                    </Pressable>
                    <Pressable
                      testID="fcd-bulk-delete"
                      accessibilityRole="button"
                      onPress={() => setBulk(bulk === 'delete' ? null : 'delete')}
                    >
                      <Text style={{ color: th.red, fontWeight: '600' }}>
                        {t('comune.elimina')}
                      </Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
              {bulk === 'move' && picked.size ? (
                <DeckPicker
                  decks={decks}
                  value={id}
                  exclude={new Set([id])}
                  onCreate={(name, parent) => repo.createDeck({ name, parent })}
                  onPick={(d) => {
                    if (d) for (const c of picked) repo.moveCard(c, d);
                    stopSelecting();
                    changed();
                  }}
                />
              ) : null}
              {bulk === 'join' && picked.size ? (
                <View style={{ gap: 6 }}>
                  <Text style={{ color: th.text2, fontSize: 13 }}>{t('fc.vis_tocca_padre')}</Text>
                  {cards
                    .filter((c) => !picked.has(c.uuid))
                    .map((c) => (
                      <Pressable
                        key={c.uuid}
                        testID={`fcd-join-${c.uuid}`}
                        accessibilityRole="button"
                        onPress={() => {
                          const r = repo.joinCards(c.uuid, [...picked]);
                          setJoinNote(
                            [
                              t('fc.app_unite_n', { n: r.joined }),
                              r.skipped ? t('fc.app_unite_saltate', { n: r.skipped }) : '',
                            ]
                              .filter(Boolean)
                              .join(' · '),
                          );
                          stopSelecting();
                          changed();
                        }}
                        style={{ paddingVertical: 8 }}
                      >
                        <Text style={{ color: th.text }} numberOfLines={1}>
                          {preview(c.question_desc)}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              ) : null}
              {bulk === 'delete' && picked.size ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: th.text, fontWeight: '700' }}>
                    {t('fc.vis_eliminare_carta')} ({picked.size})
                  </Text>
                  <Text style={{ color: th.text2, fontSize: 13 }}>
                    {t('fc.vis_non_annullabile')}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <TextButton
                        testID="fcd-bulk-delete-cancel"
                        label={t('comune.annulla')}
                        onPress={() => setBulk(null)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton
                        testID="fcd-bulk-delete-confirm"
                        danger
                        label={t('comune.elimina')}
                        onPress={() => {
                          for (const c of picked) repo.removeCard(c);
                          stopSelecting();
                          changed();
                        }}
                      />
                    </View>
                  </View>
                </View>
              ) : null}
            </Card>
          ) : null}
          {joinNote ? (
            <Text testID="fcd-join-note" style={{ color: th.text2, fontSize: 13 }}>
              {joinNote}
            </Text>
          ) : null}
          {viewing ? (
            <CardViewer
              testID="fcd-viewer"
              onClose={() => setViewing(false)}
              cards={cards
                .filter((c) => !isTitleCard(c, childCounts.get(c.uuid) ?? 0))
                .map((c) => studyView(c))}
            />
          ) : null}
          {cards.length ? (
            <Card>
              {cards.map((c, i) => (
                <Pressable
                  key={c.uuid}
                  testID={`fcd-card-${c.uuid}`}
                  accessibilityRole="button"
                  onPress={() => {
                    if (!selecting) {
                      router.push({ pathname: '/fc-card', params: { id: c.uuid } });
                      return;
                    }
                    const next = new Set(picked);
                    if (next.has(c.uuid)) next.delete(c.uuid);
                    else next.add(c.uuid);
                    setPicked(next);
                  }}
                  accessibilityState={selecting ? { checked: picked.has(c.uuid) } : undefined}
                  style={{
                    padding: 12,
                    gap: 4,
                    backgroundColor: selecting && picked.has(c.uuid) ? th.brandSoft : undefined,
                    borderTopWidth: i ? 0.5 : 0,
                    borderTopColor: th.hairline,
                  }}
                >
                  {isTitleCard(c, childCounts.get(c.uuid) ?? 0) &&
                  (preview(c.question_desc) || '').length > 0 ? (
                    <View testID={`fcd-title-${c.uuid}`} style={{ gap: 2 }}>
                      <Text
                        style={{
                          color: th.text3,
                          fontSize: 11,
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          letterSpacing: 0.6,
                        }}
                      >
                        {t('fc.vis_titolo')}
                      </Text>
                      <Text
                        style={{ color: th.text, fontSize: 18, fontWeight: '800' }}
                        numberOfLines={2}
                      >
                        {selecting ? (picked.has(c.uuid) ? '☑ ' : '☐ ') : ''}
                        {preview(c.question_desc)}
                      </Text>
                      <Text style={{ color: th.text2, fontSize: 13 }}>
                        {t('fc.vis_n_sottocarte', { n: childCounts.get(c.uuid) ?? 0 })}
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Text
                        style={{ color: th.text, fontSize: 16, fontWeight: '600' }}
                        numberOfLines={2}
                      >
                        {selecting ? (picked.has(c.uuid) ? '☑ ' : '☐ ') : ''}
                        {preview(c.question_desc) || '—'}
                      </Text>
                      <Text style={{ color: th.text2, fontSize: 14 }} numberOfLines={2}>
                        {preview(c.answer_desc)}
                      </Text>
                    </>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {levels.get(c.uuid) ? (
                      <View
                        testID={`fcd-level-${c.uuid}`}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                      >
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: LEVEL_COLORS[levels.get(c.uuid)!],
                          }}
                        />
                        <Text style={{ color: th.text2, fontSize: 12 }}>
                          {t(`fcv.liv_${levels.get(c.uuid)}`)}
                        </Text>
                      </View>
                    ) : null}
                    {learnt.has(c.uuid) ? (
                      <Text
                        testID={`fcd-learnt-${c.uuid}`}
                        style={{ color: th.green, fontSize: 12 }}
                      >
                        ✓ {t('fc.cg_learnt')}
                      </Text>
                    ) : null}
                    {c.is_father && !isTitleCard(c, childCounts.get(c.uuid) ?? 0) ? (
                      <Text style={{ color: th.text3, fontSize: 12 }}>
                        {t('fc.app_carte_figlie')}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </Card>
          ) : (
            <Text style={{ color: th.text2, paddingVertical: 8 }}>{t('fc.app_nessuna_carta')}</Text>
          )}
        </View>

        <Card style={{ padding: 16, gap: 10 }}>
          {data.canDelete ? (
            deleting ? (
              <>
                <Text style={{ color: th.text, fontWeight: '700' }}>
                  {t('fc.app_elimina_mazzo')}
                </Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <TextButton
                      testID="fcd-delete-cancel"
                      label={t('comune.annulla')}
                      onPress={() => setDeleting(false)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      testID="fcd-delete-confirm"
                      danger
                      label={t('comune.elimina')}
                      onPress={() => {
                        repo.removeDeck(id);
                        changed();
                        router.back();
                      }}
                    />
                  </View>
                </View>
              </>
            ) : (
              <TextButton
                testID="fcd-delete"
                danger
                label={t('comune.elimina')}
                onPress={() => setDeleting(true)}
              />
            )
          ) : (
            <Text testID="fcd-delete-hint" style={{ color: th.text2, fontSize: 13 }}>
              {t('fc.app_elimina_solo_vuota')}
            </Text>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
