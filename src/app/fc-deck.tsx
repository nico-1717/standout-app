import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { CardViewer } from '@/features/flashcards/CardViewer';
import { DeckIcon } from '@/features/flashcards/DeckIcon';
import { Chip, Glyph, LevelPill, RoundBtn, catTones } from '@/features/flashcards/deckUi';
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
import { DeckViewSheet } from '@/features/flashcards/DeckViewSheet';
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
import { rgba } from '@/features/grades/ui';
import { isRichNote, noteText } from '@/features/projects/notes';
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
      questions: repo.questionCounts(),
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
  const filter = localPrefs.fcViewStatus;
  const passes =
    filter === 'dup'
      ? (c: (typeof data.cards)[number]) => isDuplicateCard(c, data.questions)
      : services.games.cardFilter(filter);
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

  const tone = catTones(deck.color);
  const toggleLearnt = (uuid: string) => {
    services.study.setLearnt(uuid, false, !learnt.has(uuid));
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

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 10,
          paddingHorizontal: 14,
          gap: 10,
          backgroundColor: th.headerGlass,
          borderBottomWidth: 0.5,
          borderBottomColor: th.hairline,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <RoundBtn
            th={th}
            testID="fcd-close"
            label={t('comune.chiudi')}
            glyph="close"
            onPress={() => router.back()}
          />
          <LinearGradient
            testID="fcd-hero"
            colors={[tone.light, tone.color, tone.dark]}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flex: 1,
              minWidth: 0,
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
                {data.cards.length === 1
                  ? t('fc.vis_una_carta_n')
                  : t('fc.vis_n_carte', { n: data.cards.length })}
              </Text>
            </View>
          </LinearGradient>
          <Pressable
            testID="fcd-pin"
            accessibilityRole="button"
            accessibilityLabel={t('fc.dk_fissa')}
            hitSlop={6}
            onPress={() => {
              repo.setPinned(id, !deck.pinned);
              changed();
            }}
          >
            <Text style={{ fontSize: 18, opacity: deck.pinned ? 1 : 0.35 }}>📌</Text>
          </Pressable>
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
            tone={{ from: '#4DA3FF', to: '#0A6FE0', shadow: 'rgba(10,132,255,.6)' }}
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
            <Glyph name="plus" size={17} color={deck.color} />
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: th.surface2,
                borderRadius: 12,
                paddingHorizontal: 12,
              }}
            >
              <Glyph name="search" size={15} color={th.text3} />
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
                  paddingVertical: 10,
                }}
              />
            </View>
            <Pressable
              testID="fcd-sort"
              accessibilityRole="button"
              accessibilityLabel={t('fc.vis_ordina')}
              onPress={() =>
                setSort(CARD_SORTS[(CARD_SORTS.indexOf(sort) + 1) % CARD_SORTS.length]!)
              }
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                maxWidth: 150,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: th.surface2,
              }}
            >
              <Glyph name="sort" size={14} color={th.text2} />
              <Text
                numberOfLines={1}
                style={{ color: th.text, fontSize: 13, fontWeight: '700', flexShrink: 1 }}
              >
                {t(SORT_LABELS[sort])}
              </Text>
            </Pressable>
            <Pressable
              testID="fcd-select"
              accessibilityRole="button"
              accessibilityState={{ selected: selecting }}
              onPress={() => (selecting ? stopSelecting() : setSelecting(true))}
              style={{ borderRadius: 12, overflow: 'hidden' }}
            >
              <LinearGradient
                colors={[tone.light, tone.dark]}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                }}
              >
                <Glyph name="check" size={14} color="#fff" stroke={2.6} />
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>
                  {selecting ? t('fc.vis_annulla_sel') : t('vocab.vi_seleziona')}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 7, alignItems: 'center' }}
          >
            {perLevel.size
              ? [
                  ['' as const, t('fc.vis_tutti_livelli'), byStatus.length] as const,
                  ...LEVELS.filter((l) => perLevel.has(l)).map(
                    (l) => [l, t(`fcv.liv_${l}`), perLevel.get(l) ?? 0] as const,
                  ),
                ].map(([v, label, n]) => (
                  <Chip
                    key={v || 'all'}
                    th={th}
                    tone={tone}
                    testID={`fcd-level-filter-${v || 'all'}`}
                    label={v ? `${label} (${n})` : label}
                    dot={v ? LEVEL_COLORS[v] : undefined}
                    on={level === v}
                    onPress={() => setLevel(v)}
                  />
                ))
              : null}
          </ScrollView>

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
            <View style={{ gap: 10 }}>
              {cards.map((c) => {
                const title = isTitleCard(c, childCounts.get(c.uuid) ?? 0);
                const isLearnt = learnt.has(c.uuid);
                const isPicked = selecting && picked.has(c.uuid);
                const lvl = levels.get(c.uuid);
                return (
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
                      borderRadius: th.radiusCard,
                      borderWidth: isPicked ? 0 : 0.5,
                      borderColor: th.hairline,
                      borderLeftWidth: 4,
                      borderLeftColor: deck.color,
                      paddingTop: 12,
                      paddingBottom: 12,
                      paddingLeft: 14,
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
                    <View
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 }}
                    >
                      {selecting ? (
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
                          {isPicked ? (
                            <Glyph name="check" size={14} color="#fff" stroke={3} />
                          ) : null}
                        </View>
                      ) : (
                        <Pressable
                          testID={`fcd-learn-toggle-${c.uuid}`}
                          accessibilityRole="checkbox"
                          accessibilityLabel={t('fc.cg_learnt')}
                          accessibilityState={{ checked: isLearnt }}
                          hitSlop={6}
                          onPress={() => toggleLearnt(c.uuid)}
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
                      {isLearnt ? (
                        <Text
                          testID={`fcd-learnt-${c.uuid}`}
                          style={{ color: th.green, fontSize: 12, fontWeight: '800' }}
                        >
                          {t('fc.cg_learnt')}
                        </Text>
                      ) : null}
                      <View style={{ flex: 1 }} />
                      {c.is_father && !title ? (
                        <Text style={{ color: th.text3, fontSize: 11.5, fontWeight: '700' }}>
                          {t('fc.app_carte_figlie')}
                        </Text>
                      ) : null}
                      {lvl ? (
                        <LevelPill
                          testID={`fcd-level-${c.uuid}`}
                          level={lvl}
                          label={t(`fcv.liv_${lvl}`)}
                        />
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
                          question
                        />
                        <DeckCardSide
                          testID={`fcd-a-${c.uuid}`}
                          label={t('fc.ifc_risposta')}
                          raw={c.answer_desc}
                          image={c.answer_image}
                          audio={c.answer_audio}
                          full={localPrefs.fcFullCards}
                        />
                      </>
                    )}
                  </Pressable>
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
            <Glyph name="layers" size={24} color="#fff" />
          </LinearGradient>
        </Pressable>
      ) : null}
    </View>
  );
}
