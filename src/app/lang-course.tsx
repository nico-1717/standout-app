import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { DeckIcon } from '@/features/flashcards/DeckIcon';
import {
  daysToExam,
  deckIcon,
  deckMap,
  deckPath,
  examUrgency,
  flattenDecks,
  scopeCounts,
  type DeckScope,
} from '@/features/flashcards/logic';
import { langFlag, langName } from '@/features/languages/langs';
import { localToday } from '@/features/tasks/groups';
import { Card, Header, PrimaryButton, TextButton } from '@/ui/kit';

const fold = (s: string | null | undefined): string =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Un corso di lingua (fc_decks.php?course=N): i suoi mazzi ad albero e la ricerca fra tutte le sue parole. */
export default function LangCourseScreen() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { services, version, changed } = useApp();
  const ui: 'it' | 'en' = i18n.language === 'en' ? 'en' : 'it';

  const [scope, setScope] = useState<DeckScope>('active');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
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
  const { course, decks, counts, words, learnt } = data;
  const map = deckMap(decks);
  const today = localToday();
  const scopes = scopeCounts(decks);
  const rows = flattenDecks(decks, scope, collapsed);
  const needle = fold(query.trim());
  const found = needle
    ? words.filter((w) => [w.word, w.translation, w.meaning].some((x) => fold(x).includes(needle)))
    : null;
  const totalWords = [...counts.values()].reduce((a, b) => a + b, 0);
  const withKids = new Set(
    decks.filter((d) => decks.some((c) => c.parent_uuid === d.uuid)).map((d) => d.uuid),
  );

  const add = (parent: string | null, name: string) => {
    const deck = repo.createDeck(id, { name, parent });
    if (!deck) return false;
    if (parent && collapsed.has(parent)) {
      const n = new Set(collapsed);
      n.delete(parent);
      setCollapsed(n);
    }
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

  const deckRow = (deckId: string, depth: number, hasChildren: boolean) => {
    const d = map.get(deckId)!;
    const n = counts.get(deckId) ?? 0;
    const closed = collapsed.has(deckId);
    return (
      <View key={deckId}>
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
            testID={`lcourse-toggle-${deckId}`}
            accessibilityRole="button"
            disabled={!hasChildren}
            hitSlop={8}
            onPress={() => {
              const next = new Set(collapsed);
              if (next.has(deckId)) next.delete(deckId);
              else next.add(deckId);
              setCollapsed(next);
            }}
            style={{ width: 16, alignItems: 'center' }}
          >
            <Text style={{ color: th.text3, fontSize: 12 }}>
              {hasChildren ? (closed ? '▶' : '▼') : ''}
            </Text>
          </Pressable>
          <Pressable
            testID={`lcourse-deck-${deckId}`}
            accessibilityRole="button"
            onPress={() => openDeck(deckId)}
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
              {examChip(d.exam_date)}
            </View>
            <Text style={{ color: th.text2, fontSize: 13 }}>
              {n} {n === 1 ? t('fchub.parola') : t('fchub.parole')}
            </Text>
          </Pressable>
          {scope === 'active' ? (
            <Pressable
              testID={`lcourse-add-${deckId}`}
              accessibilityRole="button"
              accessibilityLabel={t('fc.cfc_aggiungi_sottocategoria')}
              hitSlop={8}
              onPress={() => {
                setAddingUnder(addingUnder === deckId ? null : deckId);
                setSubDraft('');
              }}
            >
              <Text style={{ color: th.brand, fontSize: 22 }}>+</Text>
            </Pressable>
          ) : null}
        </View>
        {addingUnder === deckId ? (
          <View style={{ paddingLeft: 54 + depth * 18, paddingRight: 12, paddingBottom: 12 }}>
            <TextInput
              testID="lcourse-sub-input"
              autoFocus
              value={subDraft}
              onChangeText={setSubDraft}
              placeholder={t('fc.cfc_aggiungi_sottocategoria')}
              placeholderTextColor={th.text3}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (add(deckId, subDraft)) {
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

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        top={insets.top}
        title={`${langFlag(course.learn_lang)} ${langName(course.learn_lang, ui)}`}
        right={
          <Pressable
            testID="lcourse-close"
            accessibilityRole="button"
            accessibilityLabel={t('comune.chiudi')}
            onPress={() => router.back()}
          >
            <Text style={{ color: th.brand, fontSize: 17 }}>✕</Text>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text testID="lcourse-summary" style={{ color: th.text2 }}>
          {t('fchub.dalla_lingua', { lingua: langName(course.known_lang, ui, false) })} ·{' '}
          {t('fcv.conteggio', { categorie: decks.length, carte: totalWords })}
        </Text>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            testID="lcourse-play"
            accessibilityRole="button"
            disabled={totalWords === 0}
            onPress={() => router.push({ pathname: '/fc-setup', params: { course: course.uuid } })}
            style={{
              flex: 1,
              backgroundColor: th.brand,
              opacity: totalWords === 0 ? 0.4 : 1,
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
              {t('fc.cg_gioca')} ▶
            </Text>
          </Pressable>
          <Pressable
            testID="lcourse-history"
            accessibilityRole="button"
            onPress={() =>
              router.push({ pathname: '/fc-history', params: { course: course.uuid } })
            }
            style={{
              backgroundColor: th.surface2,
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 18,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: th.text, fontWeight: '600', fontSize: 16 }}>
              {t('fc.sfc_storico')}
            </Text>
          </Pressable>
        </View>

        <TextInput
          testID="lcourse-search"
          value={query}
          onChangeText={setQuery}
          placeholder={t('fchub.app_cerca_parole')}
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
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                testID="lcourse-new"
                value={draft}
                onChangeText={setDraft}
                placeholder={t('fchub.app_nuovo_mazzo')}
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
                  testID="lcourse-new-add"
                  label={t('vocab.cat_aggiungi')}
                  disabled={!draft.trim()}
                  onPress={() => add(null, draft) && setDraft('')}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              {(['active', 'archived'] as const).map((s) => (
                <Pressable
                  key={s}
                  testID={`lcourse-scope-${s}`}
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
                  testID="lcourse-collapse"
                  label={collapsed.size ? t('vocab.cat_espandi') : t('fc.cfc_comprimi_tutto')}
                  onPress={() => setCollapsed(collapsed.size ? new Set() : new Set(withKids))}
                />
              ) : null}
            </View>

            {rows.length ? (
              <Card index={0}>
                {rows.map((r, i) => (
                  <View
                    key={r.deck.uuid}
                    style={{ borderTopWidth: i ? 0.5 : 0, borderTopColor: th.hairline }}
                  >
                    {deckRow(r.deck.uuid, r.depth, r.hasChildren)}
                  </View>
                ))}
              </Card>
            ) : (
              <View style={{ padding: 28, alignItems: 'center', gap: 6 }}>
                <Text style={{ color: th.text, fontWeight: '700', fontSize: 17 }}>
                  {scope === 'active' ? t('fchub.primo_mazzo') : t('fc.cfc_archivio_vuoto')}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
