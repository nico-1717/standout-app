import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { docToPlain, parseDoc } from '@/features/flashcards/doc';
import { Glyph, catTones, type CatTones } from '@/features/flashcards/deckUi';
import { DeckPicker } from '@/features/flashcards/DeckPicker';
import { Sheet } from '@/features/habits/Sheet';
import { habitsTheme } from '@/features/habits/habitsTheme';
import { BarDockProvider } from '@/features/flashcards/BarDock';
import { CardAudio } from '@/features/flashcards/CardAudio';
import { CardImage } from '@/features/flashcards/CardImage';
import { RichEditor } from '@/features/flashcards/RichEditor';
import { deckMap, deckPath } from '@/features/flashcards/logic';
import { rgba } from '@/features/grades/ui';
import { HoIcon } from '@/features/home/HomeKit';
import {
  AiButton,
  AudioPreview,
  MicButton,
  PhotoButton,
  PhotoPreview,
  StageMicButton,
  StagePhotoButton,
  StagedPreview,
  type StagedFile,
} from '@/features/media/MediaIcons';
import { Card, PrimaryButton, TextButton } from '@/ui/kit';

/** Salva dopo una pausa di scrittura: ogni disegno nuovo (un tasto) fa ripartire l'attesa. */
function AutoSave({ on, onSave }: { on: boolean; onSave: () => void }) {
  useEffect(() => {
    if (!on) return;
    const timer = setTimeout(onSave, 900);
    return () => clearTimeout(timer);
  });
  return null;
}

/** Tondo piccolo dentro la barra del salvataggio (chiudi, elimina). */
function BarIcon({
  testID,
  label,
  glyph,
  color,
  bg,
  onPress,
}: {
  testID: string;
  label: string;
  glyph: 'close' | 'trash';
  color: string;
  bg: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        transform: [{ scale: pressed ? 0.92 : 1 }],
      })}
    >
      <Glyph name={glyph} size={18} color={color} stroke={2.2} />
    </Pressable>
  );
}

type Side = 'q' | 'a';

/**
 * Una carta (o una carta figlia): si legge con il suo formato come sul sito; si scrive come testo semplice.
 * Un testo con formato (grassetto, elenchi, formule…) si legge ma non si riscrive da qui: si può sostituire con testo semplice.
 * Parametri: `id` (carta), `sub` (carta figlia), `deck` (nuova carta in quel mazzo), `parent` (nuova carta figlia sotto quella carta).
 */
export default function CardScreen() {
  const th = useTheme();
  const ht = useMemo(() => habitsTheme(th.scheme, undefined, th.style), [th.scheme, th.style]);
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id?: string;
    sub?: string;
    deck?: string;
    parent?: string;
  }>();
  const { services, version, changed, account, localPrefs, updateLocalPrefs } = useApp();

  const [micFailed, setMicFailed] = useState<{ q: boolean; a: boolean }>({ q: false, a: false });
  const [draft, setDraft] = useState<{ q: string | null; a: string | null }>({ q: null, a: null });
  // ciò che è già salvato (le stesse bozze): sporco = la bozza è diversa
  const [saved, setSaved] = useState<{ q: string | null; a: string | null }>({ q: null, a: null });
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // una carta nuova esiste dal primo salvataggio: da lì in poi è una carta come le altre
  const [born, setBorn] = useState<{ kind: 'card' | 'sub'; id: string } | null>(null);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newExample, setNewExample] = useState('');
  const [exImage, setExImage] = useState<StagedFile | null>(null);
  const [exAudio, setExAudio] = useState<StagedFile | null>(null);
  const [exMicFailed, setExMicFailed] = useState(false);
  const [exAi, setExAi] = useState<{ busy: boolean; error: string | null }>({
    busy: false,
    error: null,
  });
  const [editExample, setEditExample] = useState<{ uuid: string; text: string } | null>(null);

  const cid = params.id ?? (born?.kind === 'card' ? born.id : null);
  const sub = params.sub ?? (born?.kind === 'sub' ? born.id : null);
  const isNew = !cid && !sub;
  const isSub = !!sub || !!params.parent;

  const data = useMemo(() => {
    void version;
    if (!services) return null;
    const repo = services.flashcards;
    if (cid) {
      const c = repo.card(cid);
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
    if (sub) {
      const s = repo.subcard(sub);
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
  }, [services, version, cid, sub, params.deck, params.parent]);

  const target = cid ?? sub ?? null;
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

  const raw = (s: Side) => (s === 'q' ? item.q : item.a);
  const row = sub ?? cid ?? null;
  const table = sub ? 'fc_study_subcards' : 'fc_study_cards';
  const set = (s: Side, v: string | null) => setDraft({ ...draft, [s]: v ?? '' });

  // la bozza è già il campo da salvare ('' = svuotato, null = non toccato); sporco = diversa da ciò che è già salvato
  const dirty = draft.q !== saved.q || draft.a !== saved.a;
  const canSave = dirty && (!isNew || !!(draft.q || draft.a));
  const autosave = localPrefs.fcAutosave;

  /** Salva la bozza (la carta nuova nasce qui) e resta sulla pagina: con il salvataggio automatico si salva di continuo. */
  const save = () => {
    if (!canSave) return;
    const q = draft.q !== null ? draft.q || null : undefined;
    const a = draft.a !== null ? draft.a || null : undefined;
    if (isNew) {
      const id = params.parent
        ? repo.addSubcard(params.parent, q ?? null, a ?? null)
        : repo.addCard(params.deck!, q ?? null, a ?? null);
      if (!id) return;
      setBorn({ kind: params.parent ? 'sub' : 'card', id });
    } else {
      const ok = sub
        ? repo.updateSubcard(sub, { question: q, answer: a })
        : repo.updateCard(cid!, { question: q, answer: a });
      if (!ok) return;
    }
    setSaved(draft);
    setSavedAt(Date.now());
    changed();
  };

  const deck = data.deckId ? map.get(data.deckId) : undefined;
  const tone = catTones(deck?.color ?? th.brand);
  const path = crumbs.map((c) => c.name).join(' › ');

  /** L'esempio nasce qui; la foto e il suono scelti gli si attaccano subito dopo e partono verso il sito. */
  const addExample = () => {
    if (!target || !newExample.trim()) return;
    const id = services.study.addExample(target, !!sub, newExample);
    if (!id) return;
    if (exImage) {
      services.media.putFile('fc_study_examples', id, 'example_image', exImage.uri, exImage.mime);
    }
    if (exAudio) {
      services.media.putFile('fc_study_examples', id, 'example_audio', exAudio.uri, exAudio.mime);
    }
    if (exImage || exAudio) services.scheduler.trigger(0);
    setNewExample('');
    setExImage(null);
    setExAudio(null);
    setExMicFailed(false);
    setExAi({ busy: false, error: null });
    changed();
  };

  /** L'IA scrive l'esempio dalla carta com'è adesso (anche non ancora salvata); si accoda a ciò che c'è già nel campo. */
  const runAi = async () => {
    if (!account || exAi.busy) return;
    const plain = (side: Side) =>
      docToPlain(parseDoc(side === 'q' ? (draft.q ?? item.q) : (draft.a ?? item.a)));
    const q = plain('q');
    const a = plain('a');
    if (!q.trim() && !a.trim()) {
      setExAi({ busy: false, error: t('fc.exm_carta_vuota') });
      return;
    }
    setExAi({ busy: true, error: null });
    try {
      const r = await account.fcAiExample({ q, a });
      if (r.success && r.example) {
        const text = docToPlain(parseDoc(r.example));
        setNewExample(newExample.trim() ? `${newExample.trim()}\n\n${text}` : text);
        setExAi({ busy: false, error: null });
      } else {
        setExAi({ busy: false, error: r.message ?? t('fc.ibfai_errore_ia') });
      }
    } catch {
      setExAi({ busy: false, error: t('fc.ibfai_err_rete') });
    }
  };

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
        <RichEditor
          testID={`fcc-${s}`}
          value={raw(s)}
          onChange={(v) => set(s, v)}
          placeholder={label}
        />
        {row ? (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <PhotoButton
                testID={`fcc-${s}-imgfield`}
                table={table}
                uuid={row}
                slot={s === 'q' ? 'question_image' : 'answer_image'}
                name={s === 'q' ? item.qImg : item.aImg}
                color={tone.color}
              />
              <MicButton
                testID={`fcc-${s}-audfield`}
                table={table}
                uuid={row}
                slot={s === 'q' ? 'question_audio' : 'answer_audio'}
                name={s === 'q' ? item.qAud : item.aAud}
                color={tone.color}
                onError={(failed) => setMicFailed({ ...micFailed, [s]: failed })}
              />
            </View>
            <PhotoPreview
              testID={`fcc-${s}-imgfield`}
              table={table}
              uuid={row}
              slot={s === 'q' ? 'question_image' : 'answer_image'}
              name={s === 'q' ? item.qImg : item.aImg}
            />
            <AudioPreview
              testID={`fcc-${s}-audfield`}
              table={table}
              uuid={row}
              slot={s === 'q' ? 'question_audio' : 'answer_audio'}
              name={s === 'q' ? item.qAud : item.aAud}
              failed={micFailed[s]}
            />
          </>
        ) : null}
      </Card>
    );
  };

  const title = isNew
    ? isSub
      ? t('fc.app_nuova_carta_figlia')
      : t('fc.mfc_tb_nuova')
    : t('fc.mfc_tb_modifica');

  const remove = () => {
    if (sub) repo.removeSubcard(sub);
    else repo.removeCard(cid!);
    changed();
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <BarDockProvider>
        <View
          style={{
            // la pagina è un foglio: l'area sicura in alto è già in parte coperta, non va contata due volte
            paddingTop: Math.max(insets.top - 20, 12),
            paddingBottom: 10,
            paddingHorizontal: 12,
            backgroundColor: th.headerGlass,
            borderBottomWidth: 0.5,
            borderBottomColor: th.hairline,
          }}
        >
          <AutoSave on={autosave && canSave} onSave={save} />
          <View testID="fcc-savebar" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <BarIcon
              testID="fcc-close"
              label={t('comune.chiudi')}
              glyph="close"
              color={th.text}
              bg={th.surface2}
              onPress={() => router.back()}
            />
            <View testID="fcc-hero" style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{
                  color: tone.color,
                  fontSize: 10,
                  fontWeight: '800',
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                }}
              >
                {title}
              </Text>
              <Text
                testID="fcc-path"
                numberOfLines={1}
                ellipsizeMode="head"
                style={{ color: th.text, fontSize: 14, fontWeight: '800', letterSpacing: -0.2 }}
              >
                {path || '—'}
              </Text>
            </View>
            {deleting ? (
              <>
                <TextButton
                  testID="fcc-delete-cancel"
                  label={t('comune.annulla')}
                  onPress={() => setDeleting(false)}
                />
                <TextButton
                  testID="fcc-delete-confirm"
                  danger
                  label={t('comune.elimina')}
                  onPress={remove}
                />
              </>
            ) : (
              <>
                {!isNew ? (
                  <BarIcon
                    testID="fcc-delete"
                    label={t('comune.elimina')}
                    glyph="trash"
                    color={th.red}
                    bg={rgba(th.red, 0.12)}
                    onPress={() => setDeleting(true)}
                  />
                ) : null}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    height: 42,
                    paddingLeft: 10,
                    paddingRight: 3,
                    borderRadius: 21,
                    backgroundColor: th.surface,
                    borderWidth: 0.5,
                    borderColor: th.hairline,
                  }}
                >
                  <View style={{ alignItems: 'center', gap: 3 }}>
                    <Pressable
                      testID="fcc-autosave"
                      accessibilityRole="switch"
                      accessibilityLabel={t('comune.salvataggio_auto')}
                      accessibilityState={{ checked: autosave }}
                      hitSlop={8}
                      onPress={() => updateLocalPrefs({ fcAutosave: !autosave })}
                      style={{
                        width: 34,
                        height: 20,
                        borderRadius: 10,
                        padding: 2,
                        justifyContent: 'center',
                        backgroundColor: autosave ? th.green : th.surface2,
                      }}
                    >
                      <View
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 8,
                          backgroundColor: '#fff',
                          alignSelf: autosave ? 'flex-end' : 'flex-start',
                        }}
                      />
                    </Pressable>
                    <Text
                      testID="fcc-last-saved"
                      numberOfLines={1}
                      style={{ color: th.text3, fontSize: 9, fontWeight: '800' }}
                    >
                      {savedAt
                        ? t('fc.exm_salvato_alle', {
                            ora: new Date(savedAt).toTimeString().slice(0, 5),
                          })
                        : t('comune.salvataggio_auto')}
                    </Text>
                  </View>
                  <Pressable
                    testID="fcc-save"
                    accessibilityRole="button"
                    accessibilityLabel={t('comune.salva_ora')}
                    accessibilityState={{ disabled: !canSave }}
                    disabled={!canSave}
                    onPress={save}
                    style={({ pressed }) => ({
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: th.green,
                      transform: [{ scale: pressed ? 0.92 : 1 }],
                    })}
                  >
                    <Glyph name="save" size={18} color="#fff" stroke={2.2} />
                    {dirty ? (
                      <View
                        testID="fcc-dirty"
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: '#FF9500',
                          borderWidth: 1.5,
                          borderColor: th.surface,
                        }}
                      />
                    ) : null}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{
            padding: 14,
            paddingBottom: insets.bottom + 40,
            gap: 14,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {field('q')}
          {field('a')}

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
                  services.study.setLearnt(target, !!sub, v);
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
                  services.study.setFavorite(target, !!sub, v);
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
                            <CardAudio testID={`fcc-ex-audio-${ex.uuid}`} name={ex.example_audio} />
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
                <View
                  style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}
                >
                  <StagePhotoButton
                    testID="fcc-ex-photo"
                    color={tone.color}
                    value={exImage}
                    onChange={setExImage}
                  />
                  <StageMicButton
                    testID="fcc-ex-mic"
                    color={tone.color}
                    value={exAudio}
                    onChange={setExAudio}
                    onError={setExMicFailed}
                  />
                  <AiButton
                    testID="fcc-ex-ai"
                    label={t('fc.exm_genera_ia')}
                    busy={exAi.busy}
                    disabled={!account}
                    onPress={() => void runAi()}
                  />
                </View>
                <StagedPreview
                  testID="fcc-ex"
                  image={exImage}
                  audio={exAudio}
                  failed={exMicFailed}
                  onClearImage={() => setExImage(null)}
                  onClearAudio={() => setExAudio(null)}
                />
                {exAi.error ? (
                  <Text testID="fcc-ex-ai-error" style={{ color: th.red, fontSize: 13 }}>
                    {exAi.error}
                  </Text>
                ) : null}
                <PillButton
                  testID="fcc-ex-add"
                  label={t('fc.exm_aggiungi_nuovo')}
                  tone={tone}
                  disabled={!newExample.trim()}
                  onPress={addExample}
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
                onPress={() => router.push({ pathname: '/fc-card', params: { parent: cid } })}
              />
            </View>
          ) : null}

          {sub && data.parentCard ? (
            <PillButton
              testID="fcc-split"
              label={t('vocab.vi_separa')}
              tone={tone}
              onPress={() => {
                const made = repo.unjoinSubcard(sub!);
                if (!made) return;
                changed();
                router.replace({ pathname: '/fc-card', params: { id: made } });
              }}
            />
          ) : null}

          {sub && data.parentCard ? (
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
                onPress={() => setMoving(true)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}
              >
                <Glyph name="folder" size={18} color={tone.color} />
                <Text style={{ flex: 1, color: th.text, fontSize: 16, fontWeight: '600' }}>
                  {t('fc.app_sposta_carta')}
                </Text>
                <Glyph name="chev" size={16} color={th.text3} stroke={2.4} />
              </Pressable>
            </Card>
          ) : null}
        </ScrollView>
      </BarDockProvider>
      {moving ? (
        <Sheet
          visible
          title={t('fc.app_sposta_carta')}
          th={ht}
          onClose={() => setMoving(false)}
          testID="fcc-move-sheet"
        >
          <View style={{ padding: 14, paddingBottom: 24 }}>
            <DeckPicker
              decks={data.decks}
              value={data.deckId}
              onCreate={(name, parent) => repo.createDeck({ name, parent })}
              onPick={(d) => {
                if (d && d !== data.deckId) repo.moveCard(cid!, d);
                setMoving(false);
                changed();
              }}
            />
          </View>
        </Sheet>
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
