import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { docToPlain, parseDoc } from '@/features/flashcards/doc';
import { Glyph, RoundBtn, catTones, type CatTones } from '@/features/flashcards/deckUi';
import { DeckPicker } from '@/features/flashcards/DeckPicker';
import { CardAudio } from '@/features/flashcards/CardAudio';
import { CardImage } from '@/features/flashcards/CardImage';
import { DocView } from '@/features/flashcards/DocView';
import { RichEditor } from '@/features/flashcards/RichEditor';
import { deckMap, deckPath } from '@/features/flashcards/logic';
import { rgba } from '@/features/grades/ui';
import { HoIcon } from '@/features/home/HomeKit';
import { AudioField } from '@/features/media/AudioField';
import { ImageField } from '@/features/media/ImageField';
import { Card, PrimaryButton, TextButton } from '@/ui/kit';

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
          qAud: c.question_audio,
          aAud: c.answer_audio,
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
          qAud: s.question_audio,
          aAud: s.answer_audio,
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
        item: { q: null, a: null, qImg: null, aImg: null, qAud: null, aAud: null, media: false },
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
        item: { q: null, a: null, qImg: null, aImg: null, qAud: null, aAud: null, media: false },
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

  const deck = data.deckId ? map.get(data.deckId) : undefined;
  const tone = catTones(deck?.color ?? th.brand);
  const path = crumbs.map((c) => c.name).join(' › ');

  const field = (s: Side) => {
    const label = s === 'q' ? t('fc.ifc_domanda') : t('fc.ifc_risposta');
    const accent = s === 'q' ? th.text3 : tone.color;
    return (
      <Card style={{ paddingVertical: 14, paddingLeft: 20, paddingRight: 16, gap: 10 }}>
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 5,
            backgroundColor: s === 'q' ? th.hairline2 : tone.color,
          }}
        />
        <Eyebrow label={label} color={accent} />
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
        {edit && !isNew ? (
          <ImageField
            testID={`fcc-${s}-imgfield`}
            table={params.sub ? 'fc_study_subcards' : 'fc_study_cards'}
            uuid={(params.sub ?? params.id)!}
            slot={s === 'q' ? 'question_image' : 'answer_image'}
            name={s === 'q' ? item.qImg : item.aImg}
            label={s === 'q' ? t('fc.ifc_img_domanda') : t('fc.ifc_img_risposta')}
          />
        ) : (
          <CardImage testID={`fcc-${s}-image`} name={s === 'q' ? item.qImg : item.aImg} />
        )}
        {edit && !isNew ? (
          <AudioField
            testID={`fcc-${s}-audfield`}
            table={params.sub ? 'fc_study_subcards' : 'fc_study_cards'}
            uuid={(params.sub ?? params.id)!}
            slot={s === 'q' ? 'question_audio' : 'answer_audio'}
            name={s === 'q' ? item.qAud : item.aAud}
            label={s === 'q' ? t('fc.app_audio_domanda') : t('fc.app_audio_risposta')}
          />
        ) : (
          <CardAudio testID={`fcc-${s}-audio`} name={s === 'q' ? item.qAud : item.aAud} />
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
      <View
        style={{
          // la pagina è un foglio: l'area sicura in alto è già in parte coperta, non va contata due volte
          paddingTop: Math.max(insets.top - 20, 12),
          paddingBottom: 12,
          paddingHorizontal: 14,
          backgroundColor: th.headerGlass,
          borderBottomWidth: 0.5,
          borderBottomColor: th.hairline,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <RoundBtn
            th={th}
            testID="fcc-close"
            label={t('comune.chiudi')}
            glyph="close"
            onPress={() => router.back()}
          />
          <LinearGradient
            testID="fcc-hero"
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
              <Glyph name="card" size={19} color="#fff" />
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
                {title}
              </Text>
              <Text
                testID="fcc-path"
                numberOfLines={1}
                style={{ color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: -0.2 }}
              >
                {path || '—'}
              </Text>
            </View>
          </LinearGradient>
          {!isNew && !editing ? (
            <RoundBtn
              th={th}
              testID="fcc-edit"
              label={t('comune.modifica')}
              glyph="pencil"
              tone={{ from: '#FFAA4D', to: '#FF6B2C', shadow: 'rgba(255,122,26,.6)' }}
              onPress={() => setEditing(true)}
            />
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 14,
          paddingBottom: insets.bottom + (edit ? 110 : 48),
          gap: 14,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {field('q')}
        {field('a')}

        {item.media ? (
          <Text testID="fcc-media" style={{ color: th.text2, fontSize: 13 }}>
            🔊 {t('fc.app_audio_sul_sito')}
          </Text>
        ) : null}

        {target && study ? (
          <Card style={{ paddingVertical: 6, paddingHorizontal: 16 }}>
            <ToggleRow
              testID="fcc-learnt"
              label={t('fc.gm_imparato')}
              value={study.learnt}
              color={th.green}
              icon={
                <Glyph
                  name="check"
                  size={16}
                  color={study.learnt ? th.green : th.text3}
                  stroke={2.6}
                />
              }
              onChange={(v) => {
                services.study.setLearnt(target, !!params.sub, v);
                changed();
              }}
            />
            <View style={{ height: 0.5, backgroundColor: th.hairline, marginLeft: 44 }} />
            <ToggleRow
              testID="fcc-favorite"
              label={t('fc.gm_preferiti')}
              value={study.favorite}
              color="#FF2D55"
              icon={
                <HoIcon
                  name="heart"
                  size={16}
                  color={study.favorite ? '#FF2D55' : th.text3}
                  sw={2.4}
                />
              }
              onChange={(v) => {
                services.study.setFavorite(target, !!params.sub, v);
                changed();
              }}
            />
          </Card>
        ) : null}

        {target && study ? (
          <View style={{ gap: 10 }}>
            <SectionHead
              icon={<HoIcon name="bulb" size={14} color={th.text3} sw={2.3} />}
              label={t('fc.exm_conteggio', { n: study.examples.length })}
            />
            {study.examples.length ? (
              <Card>
                {study.examples.map((ex, i) => (
                  <View
                    key={ex.uuid}
                    style={{
                      padding: 14,
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
                        <Text style={{ color: th.text, fontSize: 16, lineHeight: 22 }}>
                          {ex.example_text}
                        </Text>
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
                            <Text style={{ color: tone.color, fontWeight: '700' }}>
                              {t('comune.modifica')}
                            </Text>
                          </Pressable>
                          <Pressable
                            testID={`fcc-ex-delete-${ex.uuid}`}
                            accessibilityRole="button"
                            onPress={() => {
                              services.study.removeExample(ex.uuid);
                              changed();
                            }}
                          >
                            <Text style={{ color: th.red, fontWeight: '700' }}>
                              {t('comune.elimina')}
                            </Text>
                          </Pressable>
                        </View>
                      </>
                    )}
                  </View>
                ))}
              </Card>
            ) : null}
            <View
              style={{
                padding: 12,
                gap: 10,
                borderRadius: 16,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: rgba(tone.color, 0.4),
              }}
            >
              <TextInput
                testID="fcc-ex-new"
                value={newExample}
                onChangeText={setNewExample}
                multiline
                placeholder={t('fc.exm_ph_testo')}
                placeholderTextColor={th.text3}
                style={{ color: th.text, fontSize: 16, minHeight: 44 }}
              />
              <PillButton
                testID="fcc-ex-add"
                label={t('fc.exm_aggiungi_nuovo')}
                tone={tone}
                disabled={!newExample.trim()}
                onPress={() => {
                  if (!newExample.trim()) return;
                  if (services.study.addExample(target, !!params.sub, newExample)) {
                    setNewExample('');
                    changed();
                  }
                }}
              />
            </View>
          </View>
        ) : null}

        {!isNew && !isSub ? (
          <View style={{ gap: 10 }}>
            <SectionHead
              icon={<Glyph name="card" size={14} color={th.text3} stroke={2.3} />}
              label={t('fc.app_carte_figlie')}
            />
            {data.subs.length ? (
              <Card>
                {data.subs.map((s, i) => (
                  <Pressable
                    key={s.uuid}
                    testID={`fcc-sub-${s.uuid}`}
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: '/fc-card', params: { sub: s.uuid } })}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      padding: 14,
                      borderTopWidth: i ? 0.5 : 0,
                      borderTopColor: th.hairline,
                    }}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ color: th.text, fontWeight: '700' }} numberOfLines={2}>
                        {docToPlain(parseDoc(s.question_desc)) || '—'}
                      </Text>
                      <Text style={{ color: th.text2 }} numberOfLines={2}>
                        {docToPlain(parseDoc(s.answer_desc))}
                      </Text>
                    </View>
                    <Glyph name="chev" size={16} color={th.text3} stroke={2.4} />
                  </Pressable>
                ))}
              </Card>
            ) : null}
            <PillButton
              testID="fcc-add-sub"
              label={t('fc.ifc_aggiungi_figlio')}
              tone={tone}
              glyph="plus"
              onPress={() => router.push({ pathname: '/fc-card', params: { parent: params.id } })}
            />
          </View>
        ) : null}

        {params.sub && data.parentCard ? (
          <PillButton
            testID="fcc-split"
            label={t('vocab.vi_separa')}
            tone={tone}
            onPress={() => {
              const made = repo.unjoinSubcard(params.sub!);
              if (!made) return;
              changed();
              router.replace({ pathname: '/fc-card', params: { id: made } });
            }}
          />
        ) : null}

        {params.sub && data.parentCard ? (
          <PillButton
            testID="fcc-to-parent"
            label={t('fc.vis_una_carta')}
            tone={tone}
            onPress={() =>
              router.replace({ pathname: '/fc-card', params: { id: data.parentCard! } })
            }
          />
        ) : null}

        {!isNew && !isSub ? (
          <Card>
            <Pressable
              testID="fcc-move"
              accessibilityRole="button"
              onPress={() => setMoving(!moving)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}
            >
              <Glyph name="folder" size={18} color={tone.color} />
              <Text style={{ flex: 1, color: th.text, fontSize: 16, fontWeight: '600' }}>
                {t('fc.app_sposta_carta')}
              </Text>
              <View style={{ transform: [{ rotate: moving ? '90deg' : '0deg' }] }}>
                <Glyph name="chev" size={16} color={th.text3} stroke={2.4} />
              </View>
            </Pressable>
            {moving ? (
              <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
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
              </View>
            ) : null}
          </Card>
        ) : null}

        {!isNew ? (
          <Card style={{ padding: 14, gap: 10 }}>
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

      {edit ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            flexDirection: 'row',
            gap: 12,
            paddingHorizontal: 14,
            paddingTop: 10,
            paddingBottom: insets.bottom + 10,
            backgroundColor: th.headerGlass,
            borderTopWidth: 0.5,
            borderTopColor: th.hairline,
          }}
        >
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
    </View>
  );
}

/** L'etichetta piccola in maiuscolo sopra a un campo («DOMANDA», «RISPOSTA»), col suo pallino. */
function Eyebrow({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Text
        style={{
          color,
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: 1.1,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** L'intestazione di una sezione (esempi, carte figlie): icona e titolo piccolo in maiuscolo. */
function SectionHead({ icon, label }: { icon: ReactNode; label: string }) {
  const th = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 }}>
      {icon}
      <Text
        style={{
          color: th.text3,
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** Una riga con interruttore: pallino con l'icona, nome e il tasto. */
function ToggleRow({
  testID,
  label,
  value,
  color,
  icon,
  onChange,
}: {
  testID: string;
  label: string;
  value: boolean;
  color: string;
  icon: ReactNode;
  onChange: (v: boolean) => void;
}) {
  const th = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: value ? rgba(color, 0.16) : th.surface2,
        }}
      >
        {icon}
      </View>
      <Text style={{ flex: 1, color: th.text, fontSize: 16, fontWeight: '600' }}>{label}</Text>
      <Switch testID={testID} value={value} onValueChange={onChange} trackColor={{ true: color }} />
    </View>
  );
}

/** Un tasto a pillola nel colore del mazzo (aggiungi, separa…). */
function PillButton({
  testID,
  label,
  tone,
  glyph,
  disabled,
  onPress,
}: {
  testID: string;
  label: string;
  tone: CatTones;
  glyph?: 'plus';
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      style={({ pressed }) => ({
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 9,
        paddingHorizontal: 16,
        borderRadius: 99,
        backgroundColor: tone.soft,
        opacity: disabled ? 0.5 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      {glyph ? <Glyph name={glyph} size={15} color={tone.color} stroke={2.6} /> : null}
      <Text style={{ color: tone.color, fontSize: 14.5, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

const hasAudio = (c: { question_audio: string | null; answer_audio: string | null }): boolean =>
  !!(c.question_audio || c.answer_audio);
