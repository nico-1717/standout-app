import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { docToPlain, parseDoc } from '@/features/flashcards/doc';
import { DeckPicker } from '@/features/flashcards/DeckPicker';
import { CardImage } from '@/features/flashcards/CardImage';
import { DocView } from '@/features/flashcards/DocView';
import { RichEditor } from '@/features/flashcards/RichEditor';
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
  const [newExample, setNewExample] = useState('');
  const [editExample, setEditExample] = useState<{ uuid: string; text: string } | null>(null);

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
        item: {
          q: c.question_desc,
          a: c.answer_desc,
          qImg: c.question_image,
          aImg: c.answer_image,
          media: hasAudio(c),
        },
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
        item: {
          q: s.question_desc,
          a: s.answer_desc,
          qImg: s.question_image,
          aImg: s.answer_image,
          media: hasAudio(s),
        },
        deckId: parent?.category_uuid ?? null,
        parentCard: s.parent_uuid,
        subs: [],
        decks: repo.decks(),
      };
    }
    if (params.deck && repo.deck(params.deck)) {
      return {
        item: { q: null, a: null, qImg: null, aImg: null, media: false },
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
        item: { q: null, a: null, qImg: null, aImg: null, media: false },
        deckId: p.category_uuid,
        parentCard: p.uuid,
        subs: [],
        decks: repo.decks(),
      };
    }
    return null;
  }, [services, version, params.id, params.sub, params.deck, params.parent]);

  const target = params.id ?? params.sub ?? null;
  const study = useMemo(() => {
    void version;
    if (!services || !target) return null;
    return {
      learnt: services.study.isLearnt(target),
      favorite: services.study.isFavorite(target),
      examples: services.study.examples(target),
    };
  }, [services, version, target]);

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
  const set = (s: Side, v: string | null) => setDraft({ ...draft, [s]: v ?? '' });

  // la bozza è già il campo da salvare ('' = svuotato, null = non toccato)
  const canSave = isNew ? !!(draft.q || draft.a) : draft.q !== null || draft.a !== null;

  const save = () => {
    const q = draft.q !== null ? draft.q || null : undefined;
    const a = draft.a !== null ? draft.a || null : undefined;
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
    return (
      <Card style={{ padding: 16, gap: 8 }}>
        <SectionLabel>{label}</SectionLabel>
        {edit ? (
          <RichEditor
            testID={`fcc-${s}`}
            value={raw(s)}
            onChange={(v) => set(s, v)}
            placeholder={label}
          />
        ) : (
          <DocView testID={`fcc-${s}-view`} raw={raw(s)} />
        )}
        <CardImage testID={`fcc-${s}-image`} name={s === 'q' ? item.qImg : item.aImg} />
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
            🔊 {t('fc.app_audio_sul_sito')}
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

        {target && study ? (
          <Card style={{ padding: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ flex: 1, color: th.text, fontWeight: '600' }}>
                {t('fc.gm_imparato')}
              </Text>
              <Switch
                testID="fcc-learnt"
                value={study.learnt}
                onValueChange={(v) => {
                  services.study.setLearnt(target, !!params.sub, v);
                  changed();
                }}
                trackColor={{ true: th.brand }}
              />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ flex: 1, color: th.text, fontWeight: '600' }}>
                {t('fc.gm_preferiti')}
              </Text>
              <Switch
                testID="fcc-favorite"
                value={study.favorite}
                onValueChange={(v) => {
                  services.study.setFavorite(target, !!params.sub, v);
                  changed();
                }}
                trackColor={{ true: th.brand }}
              />
            </View>
          </Card>
        ) : null}

        {target && study ? (
          <View style={{ gap: 8 }}>
            <SectionLabel>{t('fc.exm_conteggio', { n: study.examples.length })}</SectionLabel>
            {study.examples.length ? (
              <Card>
                {study.examples.map((ex, i) => (
                  <View
                    key={ex.uuid}
                    style={{
                      padding: 12,
                      gap: 8,
                      borderTopWidth: i ? 0.5 : 0,
                      borderTopColor: th.hairline,
                    }}
                  >
                    {editExample?.uuid === ex.uuid ? (
                      <>
                        <TextInput
                          testID={`fcc-ex-input-${ex.uuid}`}
                          value={editExample.text}
                          onChangeText={(v) => setEditExample({ uuid: ex.uuid, text: v })}
                          multiline
                          autoFocus
                          placeholder={t('fc.exm_ph_testo')}
                          placeholderTextColor={th.text3}
                          style={{ color: th.text, fontSize: 16, minHeight: 60 }}
                        />
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <View style={{ flex: 1 }}>
                            <TextButton
                              testID={`fcc-ex-cancel-${ex.uuid}`}
                              label={t('comune.annulla')}
                              onPress={() => setEditExample(null)}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <PrimaryButton
                              testID={`fcc-ex-save-${ex.uuid}`}
                              label={t('fc.exm_salva')}
                              disabled={!editExample.text.trim()}
                              onPress={() => {
                                if (services.study.updateExample(ex.uuid, editExample.text)) {
                                  setEditExample(null);
                                  changed();
                                }
                              }}
                            />
                          </View>
                        </View>
                      </>
                    ) : (
                      <>
                        <Text style={{ color: th.text, fontSize: 16 }}>{ex.example_text}</Text>
                        <CardImage
                          testID={`fcc-ex-image-${ex.uuid}`}
                          folder="example"
                          name={ex.example_image}
                          height={150}
                        />
                        {ex.example_audio ? (
                          <Text style={{ color: th.text2, fontSize: 13 }}>
                            🔊 {t('fc.app_audio_sul_sito')}
                          </Text>
                        ) : null}
                        <View style={{ flexDirection: 'row', gap: 18 }}>
                          <Pressable
                            testID={`fcc-ex-edit-${ex.uuid}`}
                            accessibilityRole="button"
                            onPress={() =>
                              setEditExample({ uuid: ex.uuid, text: ex.example_text ?? '' })
                            }
                          >
                            <Text style={{ color: th.brand }}>{t('comune.modifica')}</Text>
                          </Pressable>
                          <Pressable
                            testID={`fcc-ex-delete-${ex.uuid}`}
                            accessibilityRole="button"
                            onPress={() => {
                              services.study.removeExample(ex.uuid);
                              changed();
                            }}
                          >
                            <Text style={{ color: th.red }}>{t('comune.elimina')}</Text>
                          </Pressable>
                        </View>
                      </>
                    )}
                  </View>
                ))}
              </Card>
            ) : null}
            <Card style={{ padding: 12, gap: 8 }}>
              <TextInput
                testID="fcc-ex-new"
                value={newExample}
                onChangeText={setNewExample}
                multiline
                placeholder={t('fc.exm_ph_testo')}
                placeholderTextColor={th.text3}
                style={{ color: th.text, fontSize: 16, minHeight: 44 }}
              />
              <TextButton
                testID="fcc-ex-add"
                label={t('fc.exm_aggiungi_nuovo')}
                onPress={() => {
                  if (!newExample.trim()) return;
                  if (services.study.addExample(target, !!params.sub, newExample)) {
                    setNewExample('');
                    changed();
                  }
                }}
              />
            </Card>
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
                  onCreate={(name, parent) => repo.createDeck({ name, parent })}
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

const hasAudio = (c: { question_audio: string | null; answer_audio: string | null }): boolean =>
  !!(c.question_audio || c.answer_audio);
