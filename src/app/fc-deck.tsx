import { useLocalSearchParams, useRouter } from 'expo-router';
import { Fragment, useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme, type Theme } from '@/core/theme/ThemeProvider';
import { CardViewer } from '@/features/flashcards/CardViewer';
import { DeckIcon } from '@/features/flashcards/DeckIcon';
import {
  DashedBar,
  Glyph,
  LevelPill,
  RoundBtn,
  catTones,
  type GlyphName,
} from '@/features/flashcards/deckUi';
import {
  CARD_SORTS,
  filterCards,
  isDuplicateCard,
  levelCounts,
  plainText,
  type CardSort,
} from '@/features/flashcards/cardList';
import { DeckPicker } from '@/features/flashcards/DeckPicker';
import { DocView } from '@/features/flashcards/DocView';
import { DeckCardSide } from '@/features/flashcards/DeckCardSide';
import { DeckExamples } from '@/features/flashcards/DeckExamples';
import { DeckViewSheet } from '@/features/flashcards/DeckViewSheet';
import { OptionMenu } from '@/features/flashcards/OptionMenu';
import { CONFLICT_KEY } from '@/features/flashcards/ProjectDeckCard';
import { Sheet } from '@/features/habits/Sheet';
import { habitsTheme } from '@/features/habits/habitsTheme';
import { ProjectPicker } from '@/features/projects/ProjectPicker';
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
  type SubCard,
} from '@/features/flashcards/logic';
import { rgba } from '@/features/grades/ui';
import { isRichNote, noteText } from '@/features/projects/notes';
import { HoIcon } from '@/features/home/HomeKit';
import { localToday } from '@/features/tasks/groups';
import { DateTimeField } from '@/ui/DateTimeField';
import { Card, PrimaryButton, SectionLabel, TextButton } from '@/ui/kit';

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
  const { services, version, changed, localPrefs, updateLocalPrefs } = useApp();

  const [name, setName] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [sub, setSub] = useState('');
  const [moving, setMoving] = useState(false);
  const [iconsOpen, setIconsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [text, setText] = useState('');
  const [level, setLevel] = useState<Level | ''>('');
  const [sort, setSort] = useState<CardSort>('position');
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<'move' | 'delete' | 'join' | null>(null);
  const [joinNote, setJoinNote] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [settings, setSettings] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [menu, setMenu] = useState<'level' | 'sort' | null>(null);
  const ht = useMemo(() => habitsTheme(th.scheme, undefined, th.style), [th.scheme, th.style]);
  const [linkProblem, setLinkProblem] = useState<string | null>(null);

  const data = useMemo(() => {
    void version;
    if (!services || typeof id !== 'string') return null;
    const repo = services.flashcards;
    const deck = repo.deck(id);
    if (!deck) return null;
    const decks = repo.decks();
    const cards = repo.cards(id);
    const childCounts = repo.childCounts(id);
    // le carte figlie di ogni padre, mostrate sotto di lui come sul sito
    const subs = new Map(
      cards
        .filter((c) => (childCounts.get(c.uuid) ?? 0) > 0)
        .map((c) => [c.uuid, repo.subcards(c.uuid)] as const),
    );
    return {
      deck,
      decks,
      subs,
      examples: services.study.examplesFor([
        ...cards.map((c) => c.uuid),
        ...[...subs.values()].flat().map((k) => k.uuid),
      ]),
      subLevels: services.games.childLevels([...subs.values()].flat().map((k) => k.uuid)),
      kids: decks.filter((d) => d.parent_uuid === id).sort(compareDecks),
      cards,
      counts: repo.cardCounts(),
      canDelete: repo.canDeleteDeck(id),
      levels: services.games.cardLevels(cards),
      childCounts,
      learnt: services.study.learnt(),
      favorites: services.study.favorites(),
      questions: repo.questionCounts(),
      branchCards: repo.branchCardCount(id),
      games: services.games.deckStats().get(id)?.games ?? 0,
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
  const {
    deck,
    decks,
    kids,
    counts,
    levels,
    learnt,
    favorites,
    childCounts,
    subs,
    subLevels,
    examples,
  } = data;
  const filter = localPrefs.fcViewStatus;
  const passes =
    filter === 'dup'
      ? (c: (typeof data.cards)[number]) => isDuplicateCard(c, data.questions)
      : services.games.cardFilter(filter);
  const byStatus = filter === 'all' ? data.cards : data.cards.filter(passes);
  const cards = filterCards(byStatus, levels, { text, level, sort });
  const perLevel = levelCounts(byStatus, levels);
  // il visore, come sul sito: ogni carta (i titoli no) seguita dalle sue sotto-carte
  const viewerDeck = viewing
    ? cards.flatMap((c) => [
        ...(isTitleCard(c, childCounts.get(c.uuid) ?? 0)
          ? []
          : [{ uuid: c.uuid, sub: false, view: studyView(c) }]),
        ...services.flashcards
          .subcards(c.uuid)
          .map((sc) => ({ uuid: sc.uuid, sub: true, view: studyView(sc) })),
      ])
    : [];
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

  // il progetto collegato alla categoria (o al primo antenato collegato), come il sito
  const prjChain = [id, ...[...crumbs].reverse().map((c) => c.uuid)];
  const prjLink = prjChain
    .map((u) => ({ via: u !== id, uuid: repo.linkedProject(u) }))
    .find((x) => x.uuid !== null);
  const prjRow = prjLink?.uuid ? services.projects.get(prjLink.uuid) : null;
  const prjParent = prjRow?.parent_uuid ? services.projects.get(prjRow.parent_uuid) : null;
  const linkedPrj = prjRow
    ? { uuid: prjRow.uuid, leaf: prjRow.name, anc: prjParent?.name ?? '', via: !!prjLink?.via }
    : null;
  const chipStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-start' as const,
    gap: 5,
    marginTop: 5,
    maxWidth: '100%' as const,
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,.24)',
  };
  const chipText = { color: '#fff', fontSize: 11, fontWeight: '800' as const };
  const pickProject = (uuid: string | null) => {
    if (!uuid) return;
    const c = repo.deckLinkConflict(id, uuid);
    if (c) {
      setLinkProblem(
        t(CONFLICT_KEY[c.kind], {
          materia: map.get(c.deck)?.name ?? '',
          progetto: services.projects.get(c.project)?.name ?? '',
        }),
      );
      return;
    }
    if (repo.linkDeck(uuid, id)) {
      changed();
      setLinkOpen(false);
    }
  };

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

  const tone = catTones(deck.color);
  const toggleLearnt = (uuid: string, isChild = false) => {
    services.study.setLearnt(uuid, isChild, !learnt.has(uuid));
    changed();
  };
  const addSub = () => {
    if (repo.createDeck({ name: sub, parent: id })) {
      setSub('');
      setSubOpen(false);
      changed();
    }
  };
  const hasNote = !!(deck.notes && deck.notes.trim());
  const examLine =
    exam === null
      ? ''
      : exam === 0
        ? t('fc.dk_esame_oggi')
        : exam === 1
          ? t('fc.dk_esame_domani')
          : t('fc.dk_esame_tra', { n: exam });
  const tag = (text: string) => (
    <Text
      style={{
        color: th.text3,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}
    >
      {text}
    </Text>
  );
  const shadow = th.scheme === 'dark' ? undefined : '0 1px 3px rgba(0,0,0,.08)';

  const renderCard = (c: (typeof data.cards)[number] | SubCard, child: boolean) => {
    const title = !child && 'is_father' in c && isTitleCard(c, childCounts.get(c.uuid) ?? 0);
    const isLearnt = learnt.has(c.uuid);
    const isFav = favorites.has(c.uuid);
    const isPicked = !child && selecting && picked.has(c.uuid);
    const lvl = child ? subLevels.get(c.uuid) : levels.get(c.uuid);
    const pressCard = () => {
      if (child) {
        if (!selecting) router.push({ pathname: '/fc-card', params: { sub: c.uuid } });
        return;
      }
      if (!selecting) {
        router.push({ pathname: '/fc-card', params: { id: c.uuid } });
        return;
      }
      const next = new Set(picked);
      if (next.has(c.uuid)) next.delete(c.uuid);
      else next.add(c.uuid);
      setPicked(next);
    };
    return (
      <Pressable
        key={c.uuid}
        testID={`fcd-card-${c.uuid}`}
        accessibilityRole="button"
        onPress={pressCard}
        accessibilityState={selecting ? { checked: picked.has(c.uuid) } : undefined}
        style={{
          borderRadius: th.radiusCard,
          borderWidth: isPicked ? 0 : 0.5,
          borderColor: th.hairline,
          borderLeftWidth: child ? 0 : 4,
          borderLeftColor: deck.color,
          paddingTop: 12,
          paddingBottom: 12,
          paddingLeft: child ? 17 : 14,
          paddingRight: 14,
          gap: 10,
          backgroundColor: isPicked
            ? tone.soft
            : isLearnt
              ? rgba(th.green, th.scheme === 'dark' ? 0.14 : 0.1)
              : title
                ? rgba(deck.color, 0.06)
                : th.surface,
          boxShadow: isPicked ? `inset 0 0 0 2px ${deck.color}` : shadow,
        }}
      >
        {child ? <DashedBar color={deck.color} width={3} inset={8} opacity={0.75} /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 }}>
          {child ? (
            <Text
              testID={`fcd-child-tag-${c.uuid}`}
              style={{
                color: rgba(deck.color, 0.9),
                fontSize: 11.5,
                fontWeight: '800',
              }}
            >
              ↳ {t('fc.vis_sotto_carta')}
            </Text>
          ) : null}
          {selecting && !child ? (
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: isPicked ? deck.color : th.hairline2,
                backgroundColor: isPicked ? deck.color : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isPicked ? <Glyph name="check" size={14} color="#fff" stroke={3} /> : null}
            </View>
          ) : (
            <Pressable
              testID={`fcd-learn-toggle-${c.uuid}`}
              accessibilityRole="checkbox"
              accessibilityLabel={t('fc.cg_learnt')}
              accessibilityState={{ checked: isLearnt }}
              hitSlop={6}
              onPress={() => toggleLearnt(c.uuid, child)}
              style={{
                width: 30,
                height: 30,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isLearnt ? (
                <Glyph name="check" size={24} color={th.green} stroke={3.4} />
              ) : (
                <Text style={{ fontSize: 21 }}>🧐</Text>
              )}
            </Pressable>
          )}
          {!selecting ? (
            <Pressable
              testID={`fcd-fav-${c.uuid}`}
              accessibilityRole="button"
              accessibilityLabel={t('fc.gm_preferiti')}
              accessibilityState={{ selected: isFav }}
              hitSlop={6}
              onPress={() => {
                services.study.setFavorite(c.uuid, child, !isFav);
                changed();
              }}
              style={{
                width: 30,
                height: 30,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Glyph
                name="star"
                size={19}
                color={isFav ? '#FFB800' : rgba(th.text3, 0.7)}
                fill={isFav ? '#FFB800' : undefined}
                stroke={2}
              />
            </Pressable>
          ) : null}
          {isLearnt ? (
            <Text
              testID={`fcd-learnt-${c.uuid}`}
              style={{ color: th.green, fontSize: 12, fontWeight: '800' }}
            >
              {t('fc.cg_learnt')}
            </Text>
          ) : null}
          <View style={{ flex: 1 }} />
          {'is_father' in c && c.is_father && !title ? (
            <Text style={{ color: th.text3, fontSize: 11.5, fontWeight: '700' }}>
              {t('fc.vis_n_sottocarte', { n: childCounts.get(c.uuid) ?? 0 })}
            </Text>
          ) : null}
          {lvl ? (
            <LevelPill testID={`fcd-level-${c.uuid}`} level={lvl} label={t(`fcv.liv_${lvl}`)} />
          ) : null}
        </View>

        {title && (preview(c.question_desc) || '').length > 0 ? (
          <View
            testID={`fcd-title-${c.uuid}`}
            style={{
              gap: 5,
              paddingVertical: 4,
              paddingLeft: 12,
              borderLeftWidth: 3,
              borderLeftColor: deck.color,
            }}
          >
            <Text
              style={{
                color: deck.color,
                opacity: 0.75,
                fontSize: 10,
                fontWeight: '800',
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              {t('fc.vis_titolo')}
            </Text>
            <DocView raw={c.question_desc} size={16.5} weight="800" />
            <Text style={{ color: th.text3, fontSize: 11.5, fontWeight: '700' }}>
              {t('fc.vis_n_sottocarte', { n: childCounts.get(c.uuid) ?? 0 })}
            </Text>
          </View>
        ) : (
          <>
            <DeckCardSide
              testID={`fcd-q-${c.uuid}`}
              label={t('fc.ifc_domanda')}
              raw={c.question_desc}
              image={c.question_image}
              audio={c.question_audio}
              full={localPrefs.fcFullCards}
              onPress={pressCard}
              question
            />
            <DeckCardSide
              testID={`fcd-a-${c.uuid}`}
              label={t('fc.ifc_risposta')}
              raw={c.answer_desc}
              image={c.answer_image}
              audio={c.answer_audio}
              full={localPrefs.fcFullCards}
              onPress={pressCard}
            />
            <DeckExamples
              testID={`fcd-ex-${c.uuid}`}
              examples={examples.get(c.uuid) ?? []}
              full={localPrefs.fcFullExamples}
              onPress={pressCard}
            />
          </>
        )}
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <View
        style={{
          // la pagina è un foglio: l'area sicura in alto è già in parte coperta, non va contata due volte
          paddingTop: Math.max(insets.top - 20, 12),
          paddingBottom: 10,
          paddingHorizontal: 14,
          gap: 10,
          backgroundColor: th.headerGlass,
          borderBottomWidth: 0.5,
          borderBottomColor: th.hairline,
        }}
      >
        <View>
          <LinearGradient
            testID="fcd-hero"
            colors={[tone.light, tone.color, tone.dark]}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              alignSelf: 'stretch',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 16,
              boxShadow: `0 8px 20px -8px ${tone.line}, inset 0 1px 0 rgba(255,255,255,.25)`,
            }}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,.22)',
              }}
            >
              <DeckIcon name={deckIcon(deck)} color="#fff" size={19} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  color: 'rgba(255,255,255,.78)',
                  fontSize: 10,
                  fontWeight: '800',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                {t('vocab.cat_categoria')}
                {examLine ? `  ·  ${examLine}` : ''}
              </Text>
              <Text
                numberOfLines={1}
                style={{ color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: -0.2 }}
              >
                {deck.name}
              </Text>
              {linkedPrj ? (
                <Pressable
                  testID="fcd-project"
                  accessibilityRole="button"
                  accessibilityLabel={linkedPrj.leaf}
                  onPress={() =>
                    router.push({ pathname: '/projects', params: { id: linkedPrj.uuid } })
                  }
                  style={{ ...chipStyle, opacity: linkedPrj.via ? 0.85 : 1 }}
                >
                  <Glyph name="folder" size={11} color="#fff" stroke={2.6} />
                  {linkedPrj.anc ? (
                    <Text numberOfLines={1} style={{ ...chipText, opacity: 0.72, flexShrink: 1 }}>
                      {linkedPrj.anc}
                      {'  •'}
                    </Text>
                  ) : null}
                  <Text numberOfLines={1} style={{ ...chipText, flexShrink: 1 }}>
                    {linkedPrj.leaf}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  testID="fcd-project-link"
                  accessibilityRole="button"
                  onPress={() => {
                    setLinkProblem(null);
                    setLinkOpen(true);
                  }}
                  style={{
                    ...chipStyle,
                    borderWidth: 1,
                    borderStyle: 'dashed',
                    borderColor: 'rgba(255,255,255,.55)',
                    backgroundColor: 'rgba(255,255,255,.16)',
                  }}
                >
                  <Glyph name="plus" size={11} color="#fff" stroke={2.6} />
                  <Text style={chipText}>{t('fc.vis_collega_progetto')}</Text>
                </Pressable>
              )}
            </View>
            <View
              style={{
                paddingVertical: 5,
                paddingHorizontal: 10,
                borderRadius: 99,
                backgroundColor: 'rgba(255,255,255,.22)',
              }}
            >
              <Text
                testID="fcd-count"
                style={{
                  color: '#fff',
                  fontSize: 11.5,
                  fontWeight: '800',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {data.branchCards === 1
                  ? t('fc.vis_una_carta_n')
                  : t('fc.vis_n_carte', { n: data.branchCards })}
              </Text>
            </View>
            <Pressable
              testID="fcd-history"
              accessibilityRole="button"
              accessibilityLabel={t('fc.vis_partite_mazzo')}
              hitSlop={6}
              onPress={() => router.push('/fc-history')}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,.22)',
                borderWidth: 0.5,
                borderColor: 'rgba(255,255,255,.35)',
              }}
            >
              <Glyph name="clock" size={19} color="#fff" stroke={2.2} />
              {data.games > 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    top: -7,
                    right: -7,
                    minWidth: 20,
                    height: 20,
                    borderRadius: 10,
                    paddingHorizontal: 5,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#FF9F0A',
                    borderWidth: 1.5,
                    borderColor: tone.color,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>
                    {data.games > 99 ? '99+' : data.games}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </LinearGradient>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ alignItems: 'center', gap: 3, paddingRight: 8 }}
            style={{ flex: 1 }}
          >
            <Pressable
              testID="fcd-crumb-home"
              accessibilityRole="button"
              accessibilityLabel={t('fc.cfc_tutte')}
              hitSlop={6}
              onPress={() => router.dismissTo('/flashcards')}
              style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}
            >
              <Glyph name="home" size={15} color={th.text2} />
            </Pressable>
            {crumbs.map((c) => (
              <View key={c.uuid} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Text style={{ color: th.text3, fontSize: 13, fontWeight: '600' }}>›</Text>
                <Pressable
                  testID={`fcd-crumb-${c.uuid}`}
                  accessibilityRole="button"
                  onPress={() => open(c)}
                >
                  <Text
                    style={{
                      color: rgba(c.color, 1),
                      fontSize: 13.5,
                      fontWeight: '800',
                      paddingVertical: 5,
                      paddingHorizontal: 4,
                    }}
                  >
                    {c.name}
                  </Text>
                </Pressable>
              </View>
            ))}
            <Text style={{ color: th.text3, fontSize: 13, fontWeight: '600' }}>›</Text>
            <View
              style={{
                paddingVertical: 5,
                paddingHorizontal: 11,
                borderRadius: 99,
                backgroundColor: tone.soft,
              }}
            >
              <Text
                testID="fcd-crumb-current"
                style={{ color: tone.color, fontSize: 13.5, fontWeight: '800' }}
              >
                {deck.name}
              </Text>
            </View>
            <Pressable
              testID="fcd-crumb-edit"
              accessibilityRole="button"
              accessibilityLabel={t('fc.vis_cambia_padre')}
              hitSlop={6}
              onPress={() => {
                setSettings(true);
                setMoving(true);
              }}
              style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}
            >
              <Glyph name="pencil" size={16} color={th.text2} stroke={2.2} />
            </Pressable>
          </ScrollView>
          <RoundBtn
            th={th}
            testID="fcd-settings"
            label={t('fc.vis_impostazioni')}
            glyph="gear"
            active={sheet}
            dot={
              localPrefs.fcFullCards || localPrefs.fcFullExamples || filter !== 'all'
                ? tone.color
                : undefined
            }
            onPress={() => setSheet(true)}
          />
          <RoundBtn
            th={th}
            testID="fcd-add-card"
            label={t('fc.app_aggiungi_carta')}
            glyph="plus"
            tone={{ from: '#FFAA4D', to: '#FF6B2C', shadow: 'rgba(255,122,26,.6)' }}
            onPress={() => router.push({ pathname: '/fc-card', params: { deck: id } })}
          />
          <RoundBtn
            th={th}
            testID="fcd-play"
            label={t('fc.cg_gioca')}
            tone={{ from: tone.light, to: tone.dark, shadow: tone.line }}
            onPress={() => router.push({ pathname: '/fc-setup', params: { preselect: id } })}
          >
            <Glyph name="play" size={16} color="#fff" fill="#fff" stroke={1.5} />
          </RoundBtn>
        </View>

        {selecting ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              testID="fcd-select-cancel"
              accessibilityRole="button"
              accessibilityLabel={t('fc.vis_annulla_sel')}
              onPress={stopSelecting}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: th.surface2,
              }}
            >
              <Glyph name="close" size={15} color={th.text2} stroke={2.6} />
            </Pressable>
            <Pressable
              testID="fcd-select-all"
              accessibilityRole="button"
              onPress={() =>
                setPicked(
                  picked.size === cards.length ? new Set() : new Set(cards.map((c) => c.uuid)),
                )
              }
              style={{
                paddingVertical: 8,
                paddingHorizontal: 13,
                borderRadius: 99,
                backgroundColor: th.surface2,
              }}
            >
              <Text style={{ color: th.text, fontSize: 12.5, fontWeight: '800' }}>
                {t('vocab.vi_tutte')}
              </Text>
            </Pressable>
            <View
              style={{
                paddingVertical: 7,
                paddingHorizontal: 12,
                borderRadius: 99,
                backgroundColor: tone.color,
              }}
            >
              <Text
                testID="fcd-picked"
                style={{
                  color: '#fff',
                  fontSize: 12.5,
                  fontWeight: '800',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {picked.size}
              </Text>
            </View>
            {picked.size ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, alignItems: 'center' }}
                style={{ flex: 1 }}
              >
                {(
                  [
                    ['move', 'fcd-bulk-move', t('vocab.cat_sposta_attr'), false],
                    ['join', 'fcd-bulk-join', t('vocab.vi_unisci'), false],
                    ['delete', 'fcd-bulk-delete', t('comune.elimina'), true],
                  ] as const
                ).map(([key, tid, label, danger]) => (
                  <Pressable
                    key={key}
                    testID={tid}
                    accessibilityRole="button"
                    onPress={() => setBulk(bulk === key ? null : key)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 99,
                      backgroundColor:
                        bulk === key
                          ? danger
                            ? th.red
                            : tone.color
                          : danger
                            ? rgba(th.red, 0.14)
                            : rgba(th.blue, 0.14),
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12.5,
                        fontWeight: '800',
                        color: bulk === key ? '#fff' : danger ? th.red : th.blue,
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: th.surface2,
              borderRadius: 18,
              height: 36,
              paddingHorizontal: 12,
            }}
          >
            <Glyph name="search" size={15} color={th.text3} stroke={2.3} />
            <TextInput
              testID="fcd-search"
              value={text}
              onChangeText={setText}
              placeholder={t('fc.vis_cerca')}
              placeholderTextColor={th.text3}
              autoCorrect={false}
              clearButtonMode="while-editing"
              style={{
                flex: 1,
                color: th.text,
                fontSize: 14,
                fontWeight: '600',
                paddingVertical: 0,
              }}
            />
          </View>
          {perLevel.size ? (
            <Pressable
              testID="fcd-level"
              accessibilityRole="button"
              accessibilityLabel={t('fcv.vis_livello')}
              onPress={() => setMenu('level')}
              style={{
                maxWidth: 140,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 7,
                height: 36,
                paddingLeft: 12,
                paddingRight: 11,
                borderRadius: 18,
                backgroundColor: th.surface2,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: level ? LEVEL_COLORS[level] : 'transparent',
                  marginLeft: -2,
                  display: level ? 'flex' : 'none',
                }}
              />
              <Text
                numberOfLines={1}
                style={{ flexShrink: 1, color: th.text, fontSize: 13, fontWeight: '700' }}
              >
                {level ? t(`fcv.liv_${level}`) : t('fc.vis_tutti_livelli')}
              </Text>
              <View style={{ transform: [{ rotate: '90deg' }] }}>
                <Glyph name="chev" size={12} color={th.text2} stroke={2.6} />
              </View>
            </Pressable>
          ) : null}
          <ToolBtn
            th={th}
            testID="fcd-sort"
            label={`${t('fc.vis_ordina')}: ${t(SORT_LABELS[sort])}`}
            glyph="sort"
            dot={sort !== 'position' ? tone.color : undefined}
            onPress={() => setMenu('sort')}
          />
          <ToolBtn
            th={th}
            testID="fcd-select"
            label={selecting ? t('fc.vis_annulla_sel') : t('vocab.vi_seleziona')}
            glyph="checkbox"
            active={selecting}
            onPress={() => (selecting ? stopSelecting() : setSelecting(true))}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 96, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        {settings ? (
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
                            <DeckIcon
                              name={autoIcon}
                              color={on ? deck.color : th.text2}
                              size={20}
                            />
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
                  {deck.parent_uuid ? (map.get(deck.parent_uuid)?.name ?? '—') : t('fc.cfc_tutte')}{' '}
                  ›
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
            {/* eliminazione */}
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
        ) : null}

        {noteOpen || hasNote ? (
          <View
            testID="fcd-note-card"
            style={{
              padding: 14,
              paddingTop: 12,
              borderRadius: 16,
              gap: 6,
              backgroundColor: th.scheme === 'dark' ? 'rgba(255,214,10,.10)' : '#FFF8DB',
              borderWidth: 0.75,
              borderColor: 'rgba(224,168,0,.32)',
              boxShadow: '0 6px 18px -12px rgba(0,0,0,.25)',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(224,168,0,.2)',
                }}
              >
                <Glyph name="note" size={15} color="#B38600" />
              </View>
              <Text
                style={{
                  flex: 1,
                  color: '#B38600',
                  fontSize: 12,
                  fontWeight: '800',
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}
              >
                {t('fc.dn_titolo')}
              </Text>
            </View>
            {rich ? (
              <>
                <Text testID="fcd-note-rich" style={{ color: th.text2, fontSize: 13 }}>
                  {t('fc.app_note_ricche')}
                </Text>
                <Text style={{ color: th.text, fontSize: 14.5, lineHeight: 21 }}>
                  {noteText(deck.notes ?? '')}
                </Text>
              </>
            ) : (
              <TextInput
                testID="fcd-note"
                value={note ?? deck.notes ?? ''}
                onChangeText={setNote}
                onBlur={() => {
                  saveNote();
                  setNoteOpen(false);
                }}
                multiline
                autoFocus={!hasNote}
                placeholder={t('fc.dn_placeholder')}
                placeholderTextColor={th.text3}
                style={{
                  color: th.text,
                  fontSize: 14.5,
                  lineHeight: 21,
                  minHeight: 44,
                  textAlignVertical: 'top',
                }}
              />
            )}
          </View>
        ) : (
          <Pressable
            testID="fcd-note-add"
            accessibilityRole="button"
            onPress={() => setNoteOpen(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 14,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: rgba(deck.color, 0.4),
            }}
          >
            <Glyph name="note" size={18} color={deck.color} />
            <Text style={{ color: th.text2, fontSize: 13.5, fontWeight: '700' }}>
              {t('fc.dn_aggiungi')}
            </Text>
          </Pressable>
        )}

        {kids.length || subOpen ? (
          <View style={{ gap: 10 }}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 }}
            >
              <Glyph name="folder" size={13} color={th.text3} />
              {tag(t('fc.cfc_f_sottocategorie'))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {kids.map((k) => (
                <Pressable
                  key={k.uuid}
                  testID={`fcd-kid-${k.uuid}`}
                  accessibilityRole="button"
                  onPress={() => open(k)}
                  style={({ pressed }) => ({
                    width: '48%',
                    flexGrow: 1,
                    borderRadius: 16,
                    overflow: 'hidden',
                    backgroundColor: th.surface,
                    paddingHorizontal: 14,
                    paddingTop: 18,
                    paddingBottom: 12,
                    boxShadow: shadow,
                    transform: [{ scale: pressed ? 0.96 : 1 }],
                  })}
                >
                  <View
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 4,
                      backgroundColor: k.color,
                    }}
                  />
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: rgba(k.color, 0.16),
                      marginBottom: 10,
                    }}
                  >
                    <DeckIcon name={deckIcon(k)} color={k.color} size={16} />
                  </View>
                  <Text
                    numberOfLines={2}
                    style={{
                      color: th.text,
                      fontSize: 14.5,
                      fontWeight: '800',
                      letterSpacing: -0.15,
                      minHeight: 37,
                      marginBottom: 9,
                    }}
                  >
                    {k.name}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Glyph name="card" size={12} color={th.text2} />
                    <Text
                      style={{
                        color: th.text2,
                        fontSize: 11.5,
                        fontWeight: '700',
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {counts.get(k.uuid) ?? 0}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
            {subOpen ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  testID="fcd-sub-input"
                  autoFocus
                  value={sub}
                  onChangeText={setSub}
                  placeholder={t('fc.cfc_aggiungi_sottocategoria')}
                  placeholderTextColor={th.text3}
                  returnKeyType="done"
                  onSubmitEditing={addSub}
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
                    onPress={addSub}
                  />
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
        {!subOpen ? (
          <Pressable
            testID="fcd-sub-new"
            accessibilityRole="button"
            onPress={() => setSubOpen(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 }}
          >
            <Glyph name="plus" size={14} color={tone.color} />
            <Text style={{ color: tone.color, fontSize: 13, fontWeight: '800' }}>
              {t('fc.cfc_sotto_categoria')}
            </Text>
          </Pressable>
        ) : null}

        <View style={{ gap: 10 }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone.color }} />
            <Text
              testID="fcd-shown"
              style={{ flex: 1, color: th.text2, fontSize: 13, fontWeight: '700' }}
            >
              {t(cards.length === 1 ? 'fc.vis_una_carta_mostrata' : 'fc.vis_n_carte_mostrate', {
                n: cards.length,
              }).replace(/<[^>]+>/g, '')}
            </Text>
          </View>
          {selecting && bulk && picked.size ? (
            <Card style={{ padding: 12, gap: 10 }}>
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
              tone={tone}
              onClose={() => setViewing(false)}
              cards={viewerDeck.map((v) => v.view)}
              onEdit={(i) => {
                const v = viewerDeck[i];
                if (!v) return;
                setViewing(false);
                router.push({
                  pathname: '/fc-card',
                  params: v.sub ? { sub: v.uuid } : { id: v.uuid },
                });
              }}
              onPlay={() => {
                setViewing(false);
                router.push({ pathname: '/fc-setup', params: { preselect: id } });
              }}
            />
          ) : null}
          {cards.length ? (
            <View style={{ gap: 10 }}>
              {cards.map((c) => {
                const kids = subs.get(c.uuid) ?? [];
                return (
                  <View key={c.uuid} style={{ gap: 8 }}>
                    {renderCard(c, false)}
                    {kids.length ? (
                      <View
                        testID={`fcd-children-${c.uuid}`}
                        style={{ marginLeft: 20, paddingLeft: 14, gap: 8 }}
                      >
                        <DashedBar color={deck.color} width={2} opacity={0.45} />
                        {kids.map((k) => renderCard(k, true))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <View testID="fcd-empty" style={{ alignItems: 'center', paddingVertical: 48, gap: 6 }}>
              <Text style={{ fontSize: 44, marginBottom: 6 }}>🗂️</Text>
              <Text style={{ color: th.text, fontSize: 17, fontWeight: '800' }}>
                {t('fc.vis_nessuna_carta')}
              </Text>
              <Text style={{ color: th.text2, fontSize: 14, textAlign: 'center' }}>
                {t('fc.app_nessuna_carta')}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <DeckViewSheet
        visible={sheet}
        color={deck.color}
        status={filter}
        fullCards={localPrefs.fcFullCards}
        fullExamples={localPrefs.fcFullExamples}
        onStatus={(v) => updateLocalPrefs({ fcViewStatus: v })}
        onFullCards={(v) => updateLocalPrefs({ fcFullCards: v })}
        onFullExamples={(v) => updateLocalPrefs({ fcFullExamples: v })}
        onBigEdit={() => {
          setSheet(false);
          router.push({ pathname: '/fc-insert', params: { deck: id } });
        }}
        onEditDeck={() => {
          setSheet(false);
          setSettings(true);
        }}
        onClose={() => setSheet(false)}
      />

      {!selecting && !viewing ? (
        <Pressable
          testID="fcd-view"
          accessibilityRole="button"
          accessibilityLabel={t('fc.vis_fcv_apri')}
          onPress={() => setViewing(true)}
          style={({ pressed }) => ({
            position: 'absolute',
            right: 16,
            bottom: insets.bottom + 18,
            width: 52,
            height: 52,
            borderRadius: 26,
            transform: [{ scale: pressed ? 0.9 : 1 }],
            boxShadow: `0 10px 26px -8px ${tone.line}, inset 0 1px 0 rgba(255,255,255,.28)`,
          })}
        >
          <LinearGradient
            colors={[tone.light, tone.color, tone.dark]}
            locations={[0, 0.55, 1]}
            style={{ flex: 1, borderRadius: 26, alignItems: 'center', justifyContent: 'center' }}
          >
            <HoIcon name="cards" color="#FFFFFF" size={25} sw={2.2} />
          </LinearGradient>
        </Pressable>
      ) : null}
      {menu === 'level' ? (
        <OptionMenu
          testID="fcd-level-menu"
          title={t('fcv.vis_livello')}
          value={level}
          options={[
            {
              value: '',
              label: t('fc.vis_tutti_livelli'),
              testID: 'fcd-level-filter-all',
            },
            ...LEVELS.filter((l) => perLevel.has(l)).map((l) => ({
              value: l,
              label: `${t(`fcv.liv_${l}`)} (${perLevel.get(l) ?? 0})`,
              dot: LEVEL_COLORS[l],
              testID: `fcd-level-filter-${l}`,
            })),
          ]}
          onPick={(v) => setLevel(v === '' ? '' : (LEVELS.find((l) => l === v) ?? ''))}
          onClose={() => setMenu(null)}
        />
      ) : null}
      {menu === 'sort' ? (
        <OptionMenu
          testID="fcd-sort-menu"
          title={t('fc.vis_ordina')}
          value={sort}
          options={CARD_SORTS.map((k) => ({
            value: k,
            label: t(SORT_LABELS[k]),
            testID: `fcd-sort-${k}`,
          }))}
          onPick={(v) => setSort(CARD_SORTS.find((k) => k === v) ?? 'position')}
          onClose={() => setMenu(null)}
        />
      ) : null}
      {linkOpen ? (
        <Sheet
          visible
          title={t('fc.vis_collega_progetto')}
          th={ht}
          onClose={() => setLinkOpen(false)}
          testID="fcd-link-sheet"
        >
          <View style={{ padding: 20, gap: 12 }}>
            {linkProblem ? (
              <Text testID="fcd-link-problem" style={{ color: '#FF3B30' }}>
                {linkProblem}
              </Text>
            ) : null}
            <ProjectPicker
              projects={services.projects.all()}
              value={null}
              hideNone
              onPick={pickProject}
            />
          </View>
        </Sheet>
      ) : null}
    </View>
  );
}

/** Il tondo accanto alla ricerca (`.tb-icon-btn` del sito): 36 px, fondo grigio, pallino se qualcosa non è come di solito. */
function ToolBtn({
  th,
  glyph,
  label,
  testID,
  onPress,
  active,
  dot,
}: {
  th: Theme;
  glyph: GlyphName;
  label: string;
  testID: string;
  onPress: () => void;
  active?: boolean;
  dot?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? th.brandSoft : th.surface2,
        transform: [{ scale: pressed ? 0.92 : 1 }],
      })}
    >
      <Glyph name={glyph} size={17} color={active ? th.brand : th.text2} stroke={2.3} />
      {dot ? (
        <View
          testID={`${testID}-dot`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 3,
            right: 3,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: dot,
            borderWidth: 1.5,
            borderColor: th.bg,
          }}
        />
      ) : null}
    </Pressable>
  );
}
