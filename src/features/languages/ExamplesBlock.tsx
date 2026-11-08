import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { SectionLabel } from '@/ui/kit';
import { SpeakButton } from '@/ui/SpeakButton';

import { gapParts, gapSpans, isAutomatic, speakable } from './gap';
import { GapPicker } from './GapPicker';
import type { LanguagesRepo } from './repo';

/** Cosa nasconde il gioco in questa frase, scritto in breve: «house (auto)», «is big», o «—» se niente. */
function hiddenLabel(text: string, word: string, gap: string | null, autoLabel: string): string {
  const spans = gapSpans(text, word, gap);
  const parts = gapParts(text, word, gap)
    .filter((p) => p.hidden)
    .map((p) => p.text)
    .join(' … ');
  if (!parts) return '—';
  return isAutomatic(spans) ? `${parts} (${autoLabel})` : parts;
}

/**
 * Gli esempi di una parola (o di una sua figlia): la frase nella lingua che impari, con un «_» dove va la parola.
 * Si aggiunge, si cambia (tocca il testo, esci dal campo) e si toglie. Sotto ogni frase si vede cosa nasconde il gioco
 * (da solo o scelto a mano) e si può cambiare.
 */
export function ExamplesBlock({
  repo,
  target,
  word,
  voice,
  isChild,
  tag,
  onChange,
}: {
  repo: LanguagesRepo;
  target: string;
  /** la parola della carta: le sue forme sono quelle che il gioco nasconde da sole */
  word: string;
  /** la lingua con cui leggere gli esempi (quella che si studia) */
  voice?: string;
  isChild: boolean;
  /** prefisso dei testID, per distinguere la parola dalle sue figlie */
  tag: string;
  onChange: () => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [picking, setPicking] = useState<string | null>(null);
  const list = repo.examples(target);
  const add = () => {
    if (repo.addExample(target, isChild, draft)) {
      setDraft('');
      onChange();
    }
  };
  return (
    <View style={{ gap: 8 }}>
      <SectionLabel>{t('fcv.es_titolo')}</SectionLabel>
      {list.length === 0 ? (
        <Text testID={`${tag}-ex-empty`} style={{ color: th.text2, fontSize: 13 }}>
          {t('fcv.es_vuoto')}
        </Text>
      ) : null}
      {list.map((e) => (
        <View key={e.uuid} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput
              testID={`${tag}-ex-${e.uuid}`}
              value={edits[e.uuid] ?? e.example_text ?? ''}
              onChangeText={(v) => setEdits({ ...edits, [e.uuid]: v })}
              onBlur={() => {
                const v = edits[e.uuid];
                if (v === undefined) return;
                // un testo vuoto non si salva: resta quello di prima
                if (v.trim()) repo.updateExample(e.uuid, v);
                const { [e.uuid]: _gone, ...rest } = edits;
                void _gone;
                setEdits(rest);
                onChange();
              }}
              multiline
              style={{
                flex: 1,
                color: th.text,
                fontSize: 15,
                backgroundColor: th.surface2,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            />
            {voice ? (
              <SpeakButton
                testID={`${tag}-ex-speak-${e.uuid}`}
                text={speakable(e.example_text ?? '', word)}
                lang={voice}
                once
                size={18}
              />
            ) : null}
            <Pressable
              testID={`${tag}-ex-del-${e.uuid}`}
              accessibilityRole="button"
              accessibilityLabel={t('fcv.esempio_togli')}
              hitSlop={8}
              onPress={() => {
                repo.removeExample(e.uuid);
                onChange();
              }}
            >
              <Text style={{ color: th.red, fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>
          {picking === e.uuid ? (
            <GapPicker
              tag={`${tag}-gap-${e.uuid}`}
              text={e.example_text ?? ''}
              word={word}
              gap={e.gap_text}
              onCancel={() => setPicking(null)}
              onDone={(g) => {
                repo.setExampleGap(e.uuid, g);
                setPicking(null);
                onChange();
              }}
            />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={{ color: th.text2, fontSize: 13 }}>{t('fcv.es_nascosta')}:</Text>
              <Text testID={`${tag}-hidden-${e.uuid}`} style={{ color: th.text2, fontSize: 13 }}>
                {hiddenLabel(e.example_text ?? '', word, e.gap_text, t('fcv.es_auto'))}
              </Text>
              <Pressable
                testID={`${tag}-gap-edit-${e.uuid}`}
                accessibilityRole="button"
                onPress={() => setPicking(e.uuid)}
                hitSlop={8}
              >
                <Text style={{ color: th.brand, fontSize: 13, fontWeight: '600' }}>
                  {t('fcv.es_cambia')}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <TextInput
          testID={`${tag}-ex-new`}
          value={draft}
          onChangeText={setDraft}
          placeholder={t('fcv.es_ph_nuovo')}
          placeholderTextColor={th.text3}
          returnKeyType="done"
          onSubmitEditing={add}
          style={{
            flex: 1,
            color: th.text,
            fontSize: 15,
            backgroundColor: th.surface,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: th.hairline,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        />
        <Pressable
          testID={`${tag}-ex-add`}
          accessibilityRole="button"
          disabled={!draft.trim()}
          onPress={add}
          hitSlop={6}
        >
          <Text
            style={{ color: draft.trim() ? th.brand : th.text3, fontSize: 15, fontWeight: '600' }}
          >
            {t('fcv.es_aggiungi')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
