import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { DeckIcon } from '@/features/flashcards/DeckIcon';
import { DeckPicker } from '@/features/flashcards/DeckPicker';
import { PasteImport } from '@/features/flashcards/PasteImport';
import { MAX_LINK_JOBS, attachLinkImages, type LinkJob } from '@/features/flashcards/linkImages';
import type { ImportedCard } from '@/features/flashcards/smartImport';
import { langName } from '@/features/languages/langs';
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
} from '@/features/flashcards/logic';
import { localToday } from '@/features/tasks/groups';
import { DateTimeField } from '@/ui/DateTimeField';
import { Card, Header, PrimaryButton, SectionLabel, TextButton } from '@/ui/kit';

/** Un mazzo di lingua: nome, padre, colore, icona, esame, note; sottomazzi e parole (con aggiunta veloce). */
export default function LangDeckScreen() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const uiLang = i18n.language.startsWith('en') ? 'en' : 'it';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { services, version, changed } = useApp();

  const [name, setName] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [sub, setSub] = useState('');
  const [word, setWord] = useState('');
  const [translation, setTranslation] = useState('');
  const [moving, setMoving] = useState(false);
  const [iconsOpen, setIconsOpen] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [imported, setImported] = useState<number | null>(null);
  const [pictures, setPictures] = useState<{
    done: number;
    total: number;
    added: number | null;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const data = useMemo(() => {
    void version;
    if (!services || typeof id !== 'string') return null;
    const repo = services.languages;
    const deck = repo.deck(id);
    if (!deck) return null;
    const decks = repo.decks(deck.course_uuid);
    return {
      deck,
      decks,
      course: repo.course(deck.course_uuid),
      kids: decks.filter((d) => d.parent_uuid === id).sort(compareDecks),
      words: repo.words(id),
      counts: repo.wordCounts(deck.course_uuid),
      canDelete: repo.canDeleteDeck(id),
      learnt: repo.learnt(),
      favorites: repo.favorites(),
    };
  }, [services, version, id]);

  const course = data?.course ?? null;
  const vocabOptions = useMemo(
    () =>
      course
        ? {
            learn: { name: langName(course.learn_lang, uiLang), code: course.learn_lang },
            known: { name: langName(course.known_lang, uiLang), code: course.known_lang },
          }
        : undefined,
    [course, uiLang],
  );

  if (!services || typeof id !== 'string') return null;
  if (!data) {
    // il mazzo non c'è (più): si torna indietro
    return (
      <View style={{ flex: 1, backgroundColor: th.bg, paddingTop: insets.top + 40, padding: 24 }}>
        <TextButton
          testID="ld-gone-back"
          label={t('comune.indietro')}
          onPress={() => router.back()}
        />
      </View>
    );
  }
  const { deck, decks, kids, words, counts, canDelete, learnt, favorites } = data;
  const repo = services.languages;
  const map = deckMap(decks);
  const crumbs = deckPath(map, id);
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
    if (note !== null) repo.updateDeck(id, { notes: note });
    setNote(null);
    changed();
  };
  const importWords = (cards: ImportedCard[]) => {
    let n = 0;
    const jobs: LinkJob[] = [];
    for (const c of cards) {
      const uuid = repo.addWord(id, {
        word: c.q,
        translation: c.a,
        meaning: c.m,
        notes: c.n,
      });
      if (!uuid) continue;
      if (c.ex) repo.addExample(uuid, false, c.ex);
      if (c.imgLink) jobs.push({ table: 'fc_vocab_cards', uuid, slot: 'image', url: c.imgLink });
      n += 1;
    }
    if (n > 0) changed();
    setImported(n);
    if (jobs.length > 0) void fetchPictures(jobs);
    return n;
  };
  // le immagini dei link si scaricano dopo, una alla volta: le parole ci sono già
  const fetchPictures = async (jobs: LinkJob[]) => {
    if (!services) return;
    setPictures({ done: 0, total: Math.min(jobs.length, MAX_LINK_JOBS), added: null });
    const r = await attachLinkImages(services.media, jobs, (done, total) =>
      setPictures({ done, total, added: null }),
    );
    if (r.added > 0) services.scheduler.trigger(0);
    setPictures({ done: r.total, total: r.total, added: r.added });
    changed();
  };
  const addWord = () => {
    if (repo.addWord(id, { word, translation })) {
      setWord('');
      setTranslation('');
      changed();
    }
  };
  const openDeck = (uuid: string) => router.push({ pathname: '/lang-deck', params: { id: uuid } });
  const input = {
    backgroundColor: th.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: th.hairline,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: th.text,
    fontSize: 16,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        top={insets.top}
        title={deck.name}
        right={
          <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
            <Pressable
              testID="ld-pin"
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
              testID="ld-close"
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
              <Text key={c.uuid} testID={`ld-crumb-${c.uuid}`} onPress={() => openDeck(c.uuid)}>
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
              testID="ld-name"
              value={name ?? deck.name}
              onChangeText={setName}
              onBlur={saveName}
              onSubmitEditing={saveName}
              placeholder={t('fc.app_nome_mazzo')}
              placeholderTextColor={th.text3}
              style={{ flex: 1, color: th.text, fontSize: 22, fontWeight: '700' }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <SectionLabel>{t('fc.dk_data_esame')}</SectionLabel>
            <DateTimeField
              kind="date"
              testID="ld-exam"
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
                testID="ld-color-auto"
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
                    key={c}
                    testID={`ld-color-${c.slice(1)}`}
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
              testID="ld-icon-toggle"
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
                      testID={`ld-icon-${k ?? '_auto'}`}
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
                      <DeckIcon
                        name={k ?? iconFromName(deck.name)}
                        color={on ? deck.color : th.text2}
                        size={k ? 24 : 20}
                      />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ flex: 1, color: th.text, fontWeight: '600' }}>{t('fc.dk_fissa')}</Text>
            <Switch
              testID="ld-pin-switch"
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
              testID="ld-archive-switch"
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
              testID="ld-parent"
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
                  onCreate={(n, parent) => repo.createDeck(deck.course_uuid, { name: n, parent })}
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
          <TextInput
            testID="ld-note"
            value={note ?? deck.notes ?? ''}
            onChangeText={setNote}
            onBlur={saveNote}
            multiline
            placeholder={t('comune.note')}
            placeholderTextColor={th.text3}
            style={{ color: th.text, fontSize: 16, minHeight: 60, textAlignVertical: 'top' }}
          />
        </Card>

        <View style={{ gap: 8 }}>
          <SectionLabel>{t('fc.cfc_f_sottocategorie')}</SectionLabel>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              testID="ld-sub-input"
              value={sub}
              onChangeText={setSub}
              placeholder={t('fc.cfc_aggiungi_sottocategoria')}
              placeholderTextColor={th.text3}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (repo.createDeck(deck.course_uuid, { name: sub, parent: id })) {
                  setSub('');
                  changed();
                }
              }}
              style={{ ...input, flex: 1 }}
            />
            <View style={{ width: 96 }}>
              <PrimaryButton
                testID="ld-sub-add"
                label={t('vocab.cat_aggiungi')}
                disabled={!sub.trim()}
                onPress={() => {
                  if (repo.createDeck(deck.course_uuid, { name: sub, parent: id })) {
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
                  testID={`ld-kid-${k.uuid}`}
                  accessibilityRole="button"
                  onPress={() => openDeck(k.uuid)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    borderTopWidth: i ? 0.5 : 0,
                    borderTopColor: th.hairline,
                  }}
                >
                  <DeckIcon name={deckIcon(k)} color={k.color} size={22} />
                  <Text style={{ flex: 1, color: th.text, fontSize: 16 }}>{k.name}</Text>
                  <Text style={{ color: th.text2, fontSize: 13 }}>{counts.get(k.uuid) ?? 0}</Text>
                </Pressable>
              ))}
            </Card>
          ) : null}
        </View>

        <View style={{ gap: 8 }}>
          <SectionLabel>{t('fchub.parole')}</SectionLabel>
          <TextInput
            testID="ld-word"
            value={word}
            onChangeText={setWord}
            placeholder={t('fcv.ph_parola')}
            placeholderTextColor={th.text3}
            autoCorrect={false}
            returnKeyType="next"
            style={input}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              testID="ld-translation"
              value={translation}
              onChangeText={setTranslation}
              placeholder={t('fcv.ph_traduzione')}
              placeholderTextColor={th.text3}
              returnKeyType="done"
              onSubmitEditing={addWord}
              style={{ ...input, flex: 1 }}
            />
            <View style={{ width: 96 }}>
              <PrimaryButton
                testID="ld-word-add"
                label={t('vocab.cat_aggiungi')}
                disabled={!word.trim()}
                onPress={addWord}
              />
            </View>
          </View>
          <Pressable
            testID="ld-paste-toggle"
            accessibilityRole="button"
            onPress={() => {
              setPasting(!pasting);
              setImported(null);
              setPictures(null);
            }}
          >
            <Text style={{ color: th.brand, fontWeight: '600' }}>
              {pasting ? '▲' : '▼'} {t('fc.ibfai_sec_importa_titolo')}
            </Text>
          </Pressable>
          {pasting ? (
            <>
              {imported !== null ? (
                <Text testID="ld-paste-done" style={{ color: th.green, fontWeight: '700' }}>
                  {t('fc.smi_create', { n: imported })}
                </Text>
              ) : null}
              {pictures ? (
                <Text testID="ld-paste-pictures" style={{ color: th.text2 }}>
                  {pictures.added === null
                    ? t('fc.smi_img_scarico', { done: pictures.done, total: pictures.total })
                    : t('fc.smi_img_fatte', { n: pictures.added, total: pictures.total })}
                </Text>
              ) : null}
              <PasteImport
                testPrefix="ldi"
                vocab={vocabOptions}
                onCreate={importWords}
                onEdit={() => setImported(null)}
              />
            </>
          ) : null}
          {words.length ? (
            <Card>
              {words.map((w, i) => (
                <View
                  key={w.uuid}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderTopWidth: i ? 0.5 : 0,
                    borderTopColor: th.hairline,
                  }}
                >
                  <Pressable
                    testID={`ld-learnt-${w.uuid}`}
                    accessibilityRole="checkbox"
                    accessibilityLabel={t('fchub.app_segna_imparata')}
                    accessibilityState={{ checked: learnt.has(w.uuid) }}
                    hitSlop={6}
                    onPress={() => {
                      repo.setLearnt(w.uuid, false, !learnt.has(w.uuid));
                      changed();
                    }}
                    style={{ padding: 12 }}
                  >
                    <Text style={{ color: learnt.has(w.uuid) ? th.green : th.text3, fontSize: 20 }}>
                      {learnt.has(w.uuid) ? '✓' : '○'}
                    </Text>
                  </Pressable>
                  <Pressable
                    testID={`ld-open-${w.uuid}`}
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: '/lang-word', params: { id: w.uuid } })}
                    style={{ flex: 1, paddingVertical: 10, gap: 2 }}
                  >
                    <Text style={{ color: th.text, fontSize: 16, fontWeight: '600' }}>
                      {w.word}
                      {w.is_father ? '  ↳' : ''}
                    </Text>
                    <Text style={{ color: th.text2 }} numberOfLines={1}>
                      {w.translation || t('fchub.app_traduzione_vuota')}
                    </Text>
                  </Pressable>
                  <Pressable
                    testID={`ld-fav-${w.uuid}`}
                    accessibilityRole="button"
                    accessibilityLabel={t('fchub.app_preferita')}
                    accessibilityState={{ selected: favorites.has(w.uuid) }}
                    hitSlop={6}
                    onPress={() => {
                      repo.setFavorite(w.uuid, false, !favorites.has(w.uuid));
                      changed();
                    }}
                    style={{ padding: 12 }}
                  >
                    <Text style={{ fontSize: 18, opacity: favorites.has(w.uuid) ? 1 : 0.3 }}>
                      ★
                    </Text>
                  </Pressable>
                </View>
              ))}
            </Card>
          ) : (
            <Text style={{ color: th.text2, textAlign: 'center', padding: 16 }}>
              {t('fchub.app_nessuna_parola_qui')}
            </Text>
          )}
        </View>

        {deleting ? (
          <Card style={{ padding: 16, gap: 10 }}>
            <Text style={{ color: th.text, fontWeight: '700' }}>{t('fc.app_elimina_mazzo')}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <TextButton
                  testID="ld-delete-cancel"
                  label={t('comune.annulla')}
                  onPress={() => setDeleting(false)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  danger
                  testID="ld-delete-confirm"
                  label={t('comune.elimina')}
                  onPress={() => {
                    repo.removeDeck(id);
                    changed();
                    router.back();
                  }}
                />
              </View>
            </View>
          </Card>
        ) : (
          <View style={{ gap: 4 }}>
            <TextButton
              danger
              testID="ld-delete"
              label={t('comune.elimina')}
              onPress={() => canDelete && setDeleting(true)}
            />
            {!canDelete ? (
              <Text testID="ld-delete-hint" style={{ color: th.text2, textAlign: 'center' }}>
                {t('fchub.app_mazzo_non_vuoto')}
              </Text>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
