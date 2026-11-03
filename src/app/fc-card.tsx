import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { docToPlain, isPlainDoc, parseDoc, plainToField } from '@/features/flashcards/doc';
import { DeckPicker } from '@/features/flashcards/DeckPicker';
import { DocView } from '@/features/flashcards/DocView';
import { deckMap, deckPath } from '@/features/flashcards/logic';
import { Card, Header, PrimaryButton, SectionLabel, TextButton } from '@/ui/kit';

type Side = 'q' | 'a';

/**
 * Una carta (o una carta figlia): si legge con il suo formato come sul sito; si scrive come testo semplice.
 * Un testo con formato (grassetto, elenchi, formule…) si legge ma non si riscrive da qui: si può sostituire con testo semplice.
 * Parametri: `id` (carta), `sub` (carta figlia), `deck` (nuova carta in quel mazzo), `parent` (nuova carta figlia sotto quella carta).
 */
export default function CardScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id?: string;
    sub?: string;
    deck?: string;
    parent?: string;
  }>();
  const { services, version, changed } = useApp();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ q: string | null; a: string | null }>({ q: null, a: null });
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isNew = !params.id && !params.sub;
  const isSub = !!params.sub || !!params.parent;

  const data = useMemo(() => {
    void version;
    if (!services) return null;
    const repo = services.flashcards;
    if (params.id) {
      const c = repo.card(params.id);
      if (!c) return null;
      return {
        item: { q: c.question_desc, a: c.answer_desc, media: hasMedia(c) },
        deckId: c.category_uuid,
        parentCard: null as string | null,
        subs: repo.subcards(c.uuid),
        decks: repo.decks(),
      };
    }
    if (params.sub) {
      const s = repo.subcard(params.sub);
      if (!s) return null;
      const parent = repo.card(s.parent_uuid);
      return {
        item: { q: s.question_desc, a: s.answer_desc, media: hasMedia(s) },
        deckId: parent?.category_uuid ?? null,
        parentCard: s.parent_uuid,
        subs: [],
        decks: repo.decks(),
      };
    }
    if (params.deck && repo.deck(params.deck)) {
      return {
        item: { q: null, a: null, media: false },
        deckId: params.deck,
        parentCard: null,
        subs: [],
        decks: repo.decks(),
      };
    }
    if (params.parent) {
      const p = repo.card(params.parent);
      if (!p) return null;
      return {
        item: { q: null, a: null, media: false },
        deckId: p.category_uuid,
        parentCard: p.uuid,
        subs: [],
        decks: repo.decks(),
      };
    }
    return null;
  }, [services, version, params.id, params.sub, params.deck, params.parent]);

  if (!services) return null;
  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: th.bg, paddingTop: insets.top + 40, padding: 24 }}>
        <TextButton
          testID="fcc-gone-back"
          label={t('comune.indietro')}
          onPress={() => router.back()}
        />
      </View>
    );
  }
  const repo = services.flashcards;
  const { item } = data;
  const map = deckMap(data.decks);
  const crumbs = data.deckId ? [...deckPath(map, data.deckId), map.get(data.deckId)!] : [];
  const edit = isNew || editing;

  const raw = (s: Side) => (s === 'q' ? item.q : item.a);
  const plainOk = (s: Side) => isPlainDoc(raw(s));
  const value = (s: Side) => draft[s] ?? docToPlain(parseDoc(raw(s)));
  const set = (s: Side, v: string) => setDraft({ ...draft, [s]: v });

  const canSave = isNew
    ? !!(draft.q?.trim() || draft.a?.trim())
    : draft.q !== null || draft.a !== null;

  const save = () => {
    const q = draft.q !== null ? plainToField(draft.q) : undefined;
    const a = draft.a !== null ? plainToField(draft.a) : undefined;
    if (isNew) {
      const id = params.parent
        ? repo.addSubcard(params.parent, q ?? null, a ?? null)
        : repo.addCard(params.deck!, q ?? null, a ?? null);
      if (!id) return;
      changed();
      router.back();
      return;
    }
    const ok = params.sub
      ? repo.updateSubcard(params.sub, { question: q, answer: a })
      : repo.updateCard(params.id!, { question: q, answer: a });
    if (!ok) return;
    setDraft({ q: null, a: null });
    setEditing(false);
    changed();
  };

  const field = (s: Side) => {
    const label = s === 'q' ? t('fc.ifc_domanda') : t('fc.ifc_risposta');
    const rich = !plainOk(s) && draft[s] === null;
    return (
      <Card style={{ padding: 16, gap: 8 }}>
        <SectionLabel>{label}</SectionLabel>
        {edit && !rich ? (
          <TextInput
            testID={`fcc-${s}-input`}
            value={value(s)}
            onChangeText={(v) => set(s, v)}
            multiline
            autoFocus={isNew && s === 'q'}
            placeholder={label}
            placeholderTextColor={th.text3}
            style={{ color: th.text, fontSize: 17, minHeight: 80, textAlignVertical: 'top' }}
          />
        ) : (
          <>
            <DocView testID={`fcc-${s}-view`} raw={raw(s)} />
            {edit && rich ? (
              <View style={{ gap: 4 }}>
                <Text style={{ color: th.text, fontWeight: '600' }}>
                  {t('fc.app_testo_formattato')}
                </Text>
                <Text style={{ color: th.text2, fontSize: 13 }}>
                  {t('fc.app_testo_formattato_sub')}
                </Text>
                <TextButton
                  testID={`fcc-${s}-replace`}
                  label={t('fc.app_sostituisci_testo')}
                  onPress={() => set(s, docToPlain(parseDoc(raw(s))))}
                />
              </View>
            ) : null}
          </>
        )}
      </Card>
    );
  };

  const title = isNew
    ? isSub
      ? t('fc.app_nuova_carta_figlia')
      : t('fc.mfc_tb_nuova')
    : edit
      ? t('fc.mfc_tb_modifica')
      : isSub
        ? t('fc.app_carta_figlia')
        : t('fc.vis_una_carta');

  const remove = () => {
    if (params.sub) repo.removeSubcard(params.sub);
    else repo.removeCard(params.id!);
    changed();
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        top={insets.top}
        title={title}
        right={
          <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
            {!isNew && !editing ? (
              <Pressable
                testID="fcc-edit"
                accessibilityRole="button"
                onPress={() => setEditing(true)}
              >
                <Text style={{ color: th.brand, fontSize: 17 }}>{t('comune.modifica')}</Text>
              </Pressable>
            ) : null}
            <Pressable testID="fcc-close" accessibilityRole="button" onPress={() => router.back()}>
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
            {crumbs.map((c) => c.name).join(' › ')}
          </Text>
        ) : null}

        {field('q')}
        {field('a')}

        {item.media ? (
          <Text testID="fcc-media" style={{ color: th.text2, fontSize: 13 }}>
            🖼 🔊 {t('fc.app_media_sul_sito')}
          </Text>
        ) : null}

        {edit ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {!isNew ? (
              <View style={{ flex: 1 }}>
                <TextButton
                  testID="fcc-cancel"
                  label={t('comune.annulla')}
                  onPress={() => {
                    setDraft({ q: null, a: null });
                    setEditing(false);
                  }}
                />
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <PrimaryButton
                testID="fcc-save"
                label={t('comune.salva')}
                disabled={!canSave}
                onPress={save}
              />
            </View>
          </View>
        ) : null}

        {!isNew && !isSub ? (
          <View style={{ gap: 8 }}>
            <SectionLabel>{t('fc.app_carte_figlie')}</SectionLabel>
            {data.subs.length ? (
              <Card>
                {data.subs.map((s, i) => (
                  <Pressable
                    key={s.uuid}
                    testID={`fcc-sub-${s.uuid}`}
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: '/fc-card', params: { sub: s.uuid } })}
                    style={{
                      padding: 12,
                      gap: 2,
                      borderTopWidth: i ? 0.5 : 0,
                      borderTopColor: th.hairline,
                    }}
                  >
                    <Text style={{ color: th.text, fontWeight: '600' }} numberOfLines={2}>
                      {docToPlain(parseDoc(s.question_desc)) || '—'}
                    </Text>
                    <Text style={{ color: th.text2 }} numberOfLines={2}>
                      {docToPlain(parseDoc(s.answer_desc))}
                    </Text>
                  </Pressable>
                ))}
              </Card>
            ) : null}
            <TextButton
              testID="fcc-add-sub"
              label={t('fc.ifc_aggiungi_figlio')}
              onPress={() => router.push({ pathname: '/fc-card', params: { parent: params.id } })}
            />
          </View>
        ) : null}

        {params.sub && data.parentCard ? (
          <TextButton
            testID="fcc-to-parent"
            label={t('fc.vis_una_carta')}
            onPress={() =>
              router.replace({ pathname: '/fc-card', params: { id: data.parentCard! } })
            }
          />
        ) : null}

        {!isNew && !isSub ? (
          <Card style={{ padding: 16, gap: 8 }}>
            <Pressable
              testID="fcc-move"
              accessibilityRole="button"
              onPress={() => setMoving(!moving)}
            >
              <Text style={{ color: th.brand, fontSize: 16 }}>{t('fc.app_sposta_carta')} ›</Text>
            </Pressable>
            {moving ? (
              <Card style={{ backgroundColor: th.surface2 }}>
                <DeckPicker
                  decks={data.decks}
                  value={data.deckId}
                  onPick={(d) => {
                    if (d) repo.moveCard(params.id!, d);
                    setMoving(false);
                    changed();
                  }}
                />
              </Card>
            ) : null}
          </Card>
        ) : null}

        {!isNew ? (
          <Card style={{ padding: 16, gap: 10 }}>
            {deleting ? (
              <>
                <Text style={{ color: th.text, fontWeight: '700' }}>
                  {isSub ? t('fc.app_elimina_carta_figlia') : t('fc.vis_eliminare_carta')}
                </Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <TextButton
                      testID="fcc-delete-cancel"
                      label={t('comune.annulla')}
                      onPress={() => setDeleting(false)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      testID="fcc-delete-confirm"
                      danger
                      label={t('comune.elimina')}
                      onPress={remove}
                    />
                  </View>
                </View>
              </>
            ) : (
              <TextButton
                testID="fcc-delete"
                danger
                label={t('comune.elimina')}
                onPress={() => setDeleting(true)}
              />
            )}
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

const hasMedia = (c: {
  question_image: string | null;
  answer_image: string | null;
  question_audio: string | null;
  answer_audio: string | null;
}): boolean => !!(c.question_image || c.answer_image || c.question_audio || c.answer_audio);
