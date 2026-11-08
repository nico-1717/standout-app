import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { DeckPicker } from '@/features/flashcards/DeckPicker';
import { deckMap, deckPath } from '@/features/flashcards/logic';
import { ExamplesBlock } from '@/features/languages/ExamplesBlock';
import type { WordText } from '@/features/languages/repo';
import { Card, Header, PrimaryButton, SectionLabel, TextButton } from '@/ui/kit';

type Field = keyof WordText;

/** Una parola: parola, traduzione, significato, note, esempi, forme figlie; imparata, preferita, sposta, elimina. */
export default function LangWordScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { services, version, changed } = useApp();

  const [edits, setEdits] = useState<Partial<Record<string, string>>>({});
  const [kidWord, setKidWord] = useState('');
  const [kidTranslation, setKidTranslation] = useState('');
  const [openKid, setOpenKid] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = useMemo(() => {
    void version;
    if (!services || typeof id !== 'string') return null;
    const repo = services.languages;
    const word = repo.word(id);
    if (!word) return null;
    const deck = repo.deck(word.category_uuid);
    return {
      word,
      deck,
      decks: deck ? repo.decks(deck.course_uuid) : [],
      kids: repo.children(id),
      learnt: repo.learnt(),
      favorites: repo.favorites(),
    };
  }, [services, version, id]);

  if (!services || typeof id !== 'string') return null;
  if (!data) {
    // la parola non c'è (più): si torna indietro
    return (
      <View style={{ flex: 1, backgroundColor: th.bg, paddingTop: insets.top + 40, padding: 24 }}>
        <TextButton
          testID="lw-gone-back"
          label={t('comune.indietro')}
          onPress={() => router.back()}
        />
      </View>
    );
  }
  const { word, deck, decks, kids, learnt, favorites } = data;
  const repo = services.languages;
  const map = deckMap(decks);
  const path = deck ? [...deckPath(map, deck.uuid), deck].map((d) => d.name).join(' › ') : '';
  const key = (scope: string, f: Field) => `${scope}:${f}`;

  /** Un campo di testo: si scrive, si esce dal campo e si salva. La parola vuota non si salva e torna com'era. */
  const field = (
    scope: string,
    f: Field,
    current: string | null,
    save: (v: string) => boolean,
    props: { placeholder: string; multiline?: boolean; size?: number; bold?: boolean },
  ) => (
    <TextInput
      testID={`lw-${scope === id ? '' : 'kid-'}${f}${scope === id ? '' : `-${scope}`}`}
      value={edits[key(scope, f)] ?? current ?? ''}
      onChangeText={(v) => setEdits({ ...edits, [key(scope, f)]: v })}
      onBlur={() => {
        const v = edits[key(scope, f)];
        if (v === undefined) return;
        const ok = save(v);
        setError(ok ? null : t('vocab.mi_serve_minimo'));
        const rest = { ...edits };
        delete rest[key(scope, f)];
        setEdits(rest);
        changed();
      }}
      placeholder={props.placeholder}
      placeholderTextColor={th.text3}
      multiline={props.multiline}
      autoCorrect={false}
      style={{
        color: th.text,
        fontSize: props.size ?? 16,
        fontWeight: props.bold ? '700' : '400',
        backgroundColor: th.surface2,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 9,
        minHeight: props.multiline ? 64 : undefined,
        textAlignVertical: props.multiline ? 'top' : 'center',
      }}
    />
  );

  const addKid = () => {
    if (repo.addChild(id, { word: kidWord, translation: kidTranslation })) {
      setKidWord('');
      setKidTranslation('');
      changed();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        top={insets.top}
        title={word.word}
        right={
          <Pressable testID="lw-close" accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: th.brand, fontSize: 17 }}>✕</Text>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 48, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        {deck ? (
          <Text
            testID="lw-path"
            style={{ color: th.brand }}
            numberOfLines={2}
            onPress={() => router.push({ pathname: '/lang-deck', params: { id: deck.uuid } })}
          >
            {path}
          </Text>
        ) : null}

        <Card style={{ padding: 16, gap: 10 }}>
          {field(id, 'word', word.word, (v) => repo.updateWord(id, { word: v }), {
            placeholder: t('fcv.ph_parola'),
            size: 22,
            bold: true,
          })}
          {field(
            id,
            'translation',
            word.translation,
            (v) => repo.updateWord(id, { translation: v }),
            { placeholder: t('fcv.ph_traduzione') },
          )}
          {field(id, 'meaning', word.meaning, (v) => repo.updateWord(id, { meaning: v }), {
            placeholder: t('fcv.ph_significato'),
            multiline: true,
          })}
          {field(id, 'notes', word.notes, (v) => repo.updateWord(id, { notes: v }), {
            placeholder: t('fcv.ph_note'),
            multiline: true,
          })}
          {error ? (
            <Text testID="lw-error" style={{ color: th.red }}>
              {error}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ flex: 1, color: th.text, fontWeight: '600' }}>
              {t('fchub.app_segna_imparata')}
            </Text>
            <Switch
              testID="lw-learnt"
              value={learnt.has(id)}
              onValueChange={(v) => {
                repo.setLearnt(id, false, v);
                changed();
              }}
              trackColor={{ true: th.brand }}
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ flex: 1, color: th.text, fontWeight: '600' }}>
              {t('fchub.app_preferita')}
            </Text>
            <Switch
              testID="lw-fav"
              value={favorites.has(id)}
              onValueChange={(v) => {
                repo.setFavorite(id, false, v);
                changed();
              }}
              trackColor={{ true: th.brand }}
            />
          </View>
        </Card>

        <Card style={{ padding: 16 }}>
          <ExamplesBlock repo={repo} target={id} isChild={false} tag="lw" onChange={changed} />
        </Card>

        <View style={{ gap: 8 }}>
          <SectionLabel>{t('fchub.app_figlie')}</SectionLabel>
          {kids.map((k) => (
            <Card key={k.uuid} style={{ padding: 12, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Pressable
                  testID={`lw-kid-learnt-${k.uuid}`}
                  accessibilityRole="checkbox"
                  accessibilityLabel={t('fchub.app_segna_imparata')}
                  accessibilityState={{ checked: learnt.has(k.uuid) }}
                  hitSlop={6}
                  onPress={() => {
                    repo.setLearnt(k.uuid, true, !learnt.has(k.uuid));
                    changed();
                  }}
                >
                  <Text style={{ color: learnt.has(k.uuid) ? th.green : th.text3, fontSize: 20 }}>
                    {learnt.has(k.uuid) ? '✓' : '○'}
                  </Text>
                </Pressable>
                <View style={{ flex: 1, gap: 6 }}>
                  {field(k.uuid, 'word', k.word, (v) => repo.updateChild(k.uuid, { word: v }), {
                    placeholder: t('fcv.ph_parola'),
                    bold: true,
                  })}
                  {field(
                    k.uuid,
                    'translation',
                    k.translation,
                    (v) => repo.updateChild(k.uuid, { translation: v }),
                    { placeholder: t('fcv.ph_traduzione') },
                  )}
                </View>
                <Pressable
                  testID={`lw-kid-fav-${k.uuid}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('fchub.app_preferita')}
                  accessibilityState={{ selected: favorites.has(k.uuid) }}
                  hitSlop={6}
                  onPress={() => {
                    repo.setFavorite(k.uuid, true, !favorites.has(k.uuid));
                    changed();
                  }}
                >
                  <Text style={{ fontSize: 18, opacity: favorites.has(k.uuid) ? 1 : 0.3 }}>★</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <TextButton
                  testID={`lw-kid-more-${k.uuid}`}
                  label={`${t('fcv.es_titolo')} ${openKid === k.uuid ? '▲' : '▼'}`}
                  onPress={() => setOpenKid(openKid === k.uuid ? null : k.uuid)}
                />
                <TextButton
                  danger
                  testID={`lw-kid-delete-${k.uuid}`}
                  label={t('comune.elimina')}
                  onPress={() => {
                    repo.removeChild(k.uuid);
                    changed();
                  }}
                />
              </View>
              {openKid === k.uuid ? (
                <ExamplesBlock
                  repo={repo}
                  target={k.uuid}
                  isChild
                  tag={`lw-kid-${k.uuid}`}
                  onChange={changed}
                />
              ) : null}
            </Card>
          ))}
          <TextInput
            testID="lw-kid-word"
            value={kidWord}
            onChangeText={setKidWord}
            placeholder={t('fcv.tb_nuova_sotto')}
            placeholderTextColor={th.text3}
            autoCorrect={false}
            returnKeyType="next"
            style={{
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
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              testID="lw-kid-translation"
              value={kidTranslation}
              onChangeText={setKidTranslation}
              placeholder={t('fcv.ph_traduzione')}
              placeholderTextColor={th.text3}
              returnKeyType="done"
              onSubmitEditing={addKid}
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
                testID="lw-kid-add"
                label={t('vocab.cat_aggiungi')}
                disabled={!kidWord.trim()}
                onPress={addKid}
              />
            </View>
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <TextButton
            testID="lw-move"
            label={t('fc.app_sposta_carta')}
            onPress={() => setMoving(!moving)}
          />
          {moving ? (
            <Card style={{ backgroundColor: th.surface2 }}>
              <DeckPicker
                decks={decks}
                value={word.category_uuid}
                onPick={(p) => {
                  if (p) repo.moveWord(id, p);
                  setMoving(false);
                  changed();
                }}
              />
            </Card>
          ) : null}
        </View>

        {deleting ? (
          <Card style={{ padding: 16, gap: 10 }}>
            <Text style={{ color: th.text, fontWeight: '700' }}>{t('vocab.eliminare_parola')}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <TextButton
                  testID="lw-delete-cancel"
                  label={t('comune.annulla')}
                  onPress={() => setDeleting(false)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  danger
                  testID="lw-delete-confirm"
                  label={t('comune.elimina')}
                  onPress={() => {
                    repo.removeWord(id);
                    changed();
                    router.back();
                  }}
                />
              </View>
            </View>
          </Card>
        ) : (
          <TextButton
            danger
            testID="lw-delete"
            label={t('comune.elimina')}
            onPress={() => setDeleting(true)}
          />
        )}
      </ScrollView>
    </View>
  );
}
