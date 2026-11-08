import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { pickImage } from '@/core/media/pickImage';
import { useTheme } from '@/core/theme/ThemeProvider';
import { DraftAudioField } from '@/features/media/DraftAudioField';
import { MAX_LINK_JOBS, attachLinkImages, type LinkJob } from '@/features/flashcards/linkImages';
import { PasteImport } from '@/features/flashcards/PasteImport';
import {
  loadInsertDraft,
  rowsToCreate,
  type NewCard,
  saveInsertDraft,
  type Row,
} from '@/features/flashcards/insertRows';
import { Card, Header, PrimaryButton } from '@/ui/kit';

type Mode = 'paste' | 'rows';
/**
 * Inserisci molte carte in un mazzo (fc_insert.php, fc_smart_import.js): o si incolla un testo e si capisce da solo il formato
 * (Excel, CSV, JSON, «domanda - risposta»), oppure si scrivono le righe una sotto l'altra. Parametro `deck`.
 */
export default function InsertScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services, changed } = useApp();
  const params = useLocalSearchParams<{ deck?: string }>();
  const deckId = params.deck ?? '';

  const latest = useRef<Row[] | null>(null);
  const [mode, setMode] = useState<Mode>(() =>
    services && loadInsertDraft(services.db, deckId) ? 'rows' : 'paste',
  );
  const [rows, setRows] = useState<Row[]>(
    () => (services ? loadInsertDraft(services.db, deckId) : null) ?? [{ q: '', a: '' }],
  );
  const [done, setDone] = useState<number | null>(null);
  const [pictures, setPictures] = useState<{
    done: number;
    total: number;
    added: number | null;
  } | null>(null);

  // le righe scritte restano sul telefono mentre si scrive (salvataggio automatico)
  useEffect(() => {
    if (!services || !deckId) return;
    latest.current = rows;
    const id = setTimeout(() => {
      saveInsertDraft(services.db, deckId, rows);
      latest.current = null;
    }, 400);
    return () => clearTimeout(id);
  }, [services, deckId, rows]);
  // uscendo dalla pagina si salva subito quello che il timer non ha ancora scritto
  useEffect(
    () => () => {
      if (services && deckId && latest.current)
        saveInsertDraft(services.db, deckId, latest.current);
    },
    [services, deckId],
  );

  if (!services) return null;
  const deck = services.flashcards.deck(deckId);
  if (!deck) return null;

  const saveAll = (
    list: NewCard[] | { q: string; a: string; kid?: boolean; imgLink?: string }[],
  ) => {
    let n = 0;
    const jobs: LinkJob[] = [];
    let parent: string | null = null;
    let photos = 0;
    // le foto scelte per le righe: partono verso il sito dopo che la carta c'è (il sito vuole la riga prima del file)
    const attach = (
      table: 'fc_study_cards' | 'fc_study_subcards',
      uuid: string,
      c: { qi?: string; ai?: string; qa?: string; aa?: string },
    ) => {
      if (c.qi) services.media.putFile(table, uuid, 'question_image', c.qi, 'image/jpeg');
      if (c.ai) services.media.putFile(table, uuid, 'answer_image', c.ai, 'image/jpeg');
      if (c.qa) services.media.putFile(table, uuid, 'question_audio', c.qa, 'audio/mp4');
      if (c.aa) services.media.putFile(table, uuid, 'answer_audio', c.aa, 'audio/mp4');
      if (c.qi || c.ai || c.qa || c.aa) photos += 1;
    };
    for (const c of list as NewCard[]) {
      if (c.kid && parent) {
        const kid = services.flashcards.addSubcard(parent, c.q || null, c.a || null);
        if (kid) {
          n += 1;
          attach('fc_study_subcards', kid, c);
          if (c.imgLink)
            jobs.push({
              table: 'fc_study_subcards',
              uuid: kid,
              slot: 'question_image',
              url: c.imgLink,
            });
        }
        continue;
      }
      parent = services.flashcards.addCard(deckId, c.q || null, c.a || null);
      if (parent) {
        n += 1;
        attach('fc_study_cards', parent, c);
        if (c.imgLink)
          jobs.push({
            table: 'fc_study_cards',
            uuid: parent,
            slot: 'question_image',
            url: c.imgLink,
          });
      }
    }
    if (photos > 0) services.scheduler.trigger(0);
    if (n > 0) changed();
    setDone(n);
    if (jobs.length > 0) void fetchPictures(jobs);
    return n;
  };
  // le immagini dei link (come sul sito: l'immagine della domanda) si scaricano dopo, una alla volta
  const fetchPictures = async (jobs: LinkJob[]) => {
    setPictures({ done: 0, total: Math.min(jobs.length, MAX_LINK_JOBS), added: null });
    const r = await attachLinkImages(services.media, jobs, (d, total) =>
      setPictures({ done: d, total, added: null }),
    );
    if (r.added > 0) services.scheduler.trigger(0);
    setPictures({ done: r.total, total: r.total, added: r.added });
    changed();
  };

  const setPhoto = (i: number, key: 'qi' | 'ai' | 'qa' | 'aa', uri: string | null) =>
    setRows((cur) =>
      cur.map((x, k) => {
        if (k !== i) return x;
        const { [key]: _old, ...rest } = x;
        void _old;
        return uri ? { ...rest, [key]: uri } : rest;
      }),
    );
  const choosePhoto = async (i: number, key: 'qi' | 'ai', source: 'library' | 'camera') => {
    const file = await pickImage(source);
    if (file) setPhoto(i, key, file.uri);
  };
  const rowsToSave = rowsToCreate(rows);
  const input = {
    backgroundColor: th.surface2,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: th.text,
    fontSize: 15,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        top={insets.top}
        title={t('fc.ifc_inserisci')}
        right={
          <Pressable testID="fci-close" accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: th.brand, fontSize: 17 }}>{t('comune.chiudi')}</Text>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ color: th.text2 }}>{deck.name}</Text>
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: th.surface2,
            borderRadius: 10,
            padding: 3,
          }}
        >
          {(
            [
              ['paste', t('fc.ibfai_sec_importa_titolo')],
              ['rows', t('fc.app_aggiungi_carta')],
            ] as [Mode, string][]
          ).map(([m, label]) => (
            <Pressable
              key={m}
              testID={`fci-mode-${m}`}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === m }}
              onPress={() => {
                setMode(m);
                setDone(null);
              }}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                alignItems: 'center',
                backgroundColor: mode === m ? th.surface : 'transparent',
              }}
            >
              <Text style={{ color: mode === m ? th.text : th.text2, fontWeight: '600' }}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {done !== null ? (
          <Text testID="fci-done" style={{ color: th.green, fontWeight: '700' }}>
            {t('fc.smi_create', { n: done })}
          </Text>
        ) : null}

        {pictures ? (
          <Text testID="fci-pictures" style={{ color: th.text2 }}>
            {pictures.added === null
              ? t('fc.smi_img_scarico', { done: pictures.done, total: pictures.total })
              : t('fc.smi_img_fatte', { n: pictures.added, total: pictures.total })}
          </Text>
        ) : null}

        {mode === 'paste' ? (
          <PasteImport
            onCreate={saveAll}
            onEdit={() => {
              setDone(null);
              setPictures(null);
            }}
          />
        ) : (
          <View style={{ gap: 12 }}>
            {rows.map((r, i) => (
              <Card key={i} style={{ padding: 12, gap: 8, marginLeft: r.kid ? 24 : 0 }}>
                <TextInput
                  testID={`fci-q-${i}`}
                  value={r.q}
                  onChangeText={(v) => setRows(rows.map((x, k) => (k === i ? { ...x, q: v } : x)))}
                  placeholder={t('fc.ifc_domanda')}
                  placeholderTextColor={th.text3}
                  multiline
                  style={input}
                />
                <TextInput
                  testID={`fci-a-${i}`}
                  value={r.a}
                  onChangeText={(v) => setRows(rows.map((x, k) => (k === i ? { ...x, a: v } : x)))}
                  placeholder={t('fc.ifc_risposta')}
                  placeholderTextColor={th.text3}
                  multiline
                  style={input}
                />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 18 }}>
                  {(['q', 'a'] as const).map((side) => {
                    const key = side === 'q' ? 'qi' : 'ai';
                    const uri = r[key];
                    const label = side === 'q' ? t('fc.ifc_img_domanda') : t('fc.ifc_img_risposta');
                    return uri ? (
                      <View
                        key={side}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                      >
                        <Image
                          testID={`fci-${side}img-${i}`}
                          source={{ uri }}
                          contentFit="cover"
                          accessibilityIgnoresInvertColors
                          style={{ width: 36, height: 36, borderRadius: 6 }}
                        />
                        <Pressable
                          testID={`fci-${side}img-del-${i}`}
                          accessibilityRole="button"
                          accessibilityLabel={`${t('vocab.mi_rimuovi_immagine')}: ${label}`}
                          onPress={() => setPhoto(i, key, null)}
                          hitSlop={8}
                        >
                          <Text style={{ color: th.red, fontSize: 13 }}>✕</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View key={side} style={{ flexDirection: 'row', columnGap: 12 }}>
                        <Pressable
                          testID={`fci-${side}img-${i}-library`}
                          accessibilityRole="button"
                          onPress={() => void choosePhoto(i, key, 'library')}
                          hitSlop={6}
                        >
                          <Text style={{ color: th.brand, fontSize: 13 }}>🖼 {label}</Text>
                        </Pressable>
                        <Pressable
                          testID={`fci-${side}img-${i}-camera`}
                          accessibilityRole="button"
                          accessibilityLabel={`${t('comune.app_foto_scatta')}: ${label}`}
                          onPress={() => void choosePhoto(i, key, 'camera')}
                          hitSlop={6}
                        >
                          <Text style={{ color: th.brand, fontSize: 13 }}>📷</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 18 }}>
                  {(['q', 'a'] as const).map((side) => {
                    const key = side === 'q' ? 'qa' : 'aa';
                    return (
                      <DraftAudioField
                        key={side}
                        testID={`fci-${side}aud-${i}`}
                        uri={r[key]}
                        onChange={(u) => setPhoto(i, key, u)}
                        label={
                          side === 'q' ? t('fc.app_audio_domanda') : t('fc.app_audio_risposta')
                        }
                      />
                    );
                  })}
                </View>
                <View style={{ flexDirection: 'row', gap: 18 }}>
                  {!r.kid ? (
                    <Pressable
                      testID={`fci-kid-${i}`}
                      accessibilityRole="button"
                      onPress={() => {
                        // la figlia va dopo le figlie che il padre ha già
                        let at = i + 1;
                        while (rows[at]?.kid) at += 1;
                        setRows([
                          ...rows.slice(0, at),
                          { q: '', a: '', kid: true },
                          ...rows.slice(at),
                        ]);
                      }}
                    >
                      <Text style={{ color: th.brand, fontSize: 13 }}>
                        ↳ {t('fc.ifc_aggiungi_figlio')}
                      </Text>
                    </Pressable>
                  ) : null}
                  {rows.length > 1 ? (
                    <Pressable
                      testID={`fci-del-${i}`}
                      accessibilityRole="button"
                      onPress={() => {
                        // togliendo un padre se ne vanno anche le sue figlie
                        let end = i + 1;
                        if (!r.kid) while (rows[end]?.kid) end += 1;
                        const rest = [...rows.slice(0, i), ...rows.slice(end)];
                        setRows(rest.length ? rest : [{ q: '', a: '' }]);
                      }}
                    >
                      <Text style={{ color: th.red, fontSize: 13 }}>{t('comune.elimina')}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </Card>
            ))}
            <Pressable
              testID="fci-add-row"
              accessibilityRole="button"
              onPress={() => setRows([...rows, { q: '', a: '' }])}
            >
              <Text style={{ color: th.brand, fontWeight: '600' }}>
                + {t('fc.ifc_inserisci_altra')}
              </Text>
            </Pressable>
            <PrimaryButton
              testID="fci-save"
              label={
                rowsToSave.length === 1
                  ? t('fc.smi_crea_1')
                  : rowsToSave.length
                    ? t('fc.smi_crea', { n: rowsToSave.length })
                    : t('fc.ibfai_crea_carte')
              }
              disabled={!rowsToSave.length}
              onPress={() => {
                if (saveAll(rowsToSave) > 0) {
                  setRows([{ q: '', a: '' }]);
                  saveInsertDraft(services.db, deckId, []);
                }
              }}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
