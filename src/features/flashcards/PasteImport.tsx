import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { Card, PrimaryButton, SectionLabel } from '@/ui/kit';

import {
  analyze,
  FIELDS,
  toCards,
  VOCAB_FIELDS,
  type Field,
  type ImportedCard,
  type Table,
  type VocabOptions,
} from './smartImport';

/**
 * «Incolla e capisce» (fc_smart_import.js): si incolla un testo, si vede che formato è e come sono state assegnate le
 * colonne (si cambiano toccando), poi si creano le carte. Per le lingue (`vocab`) le colonne in più sono significato,
 * esempio e note. `onCreate` ritorna quante ne ha create; se > 0 il testo si svuota.
 */
export function PasteImport({
  vocab,
  onCreate,
  onEdit,
  testPrefix = 'fci',
}: {
  vocab?: VocabOptions;
  onCreate: (cards: ImportedCard[]) => number;
  /** il testo è cambiato (serve a togliere il messaggio «create») */
  onEdit?: () => void;
  testPrefix?: string;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [override, setOverride] = useState<{ text: string; campi: Field[] } | null>(null);
  const analysis = useMemo(
    () => analyze(text, (n) => t('fc.smi_colonna_n', { n }), vocab),
    [text, t, vocab],
  );
  const tab: Table | null = analysis && !('errore' in analysis) ? analysis : null;
  const campi: Field[] | null = tab
    ? override && override.text === text
      ? override.campi
      : tab.campi
    : null;
  const imported = tab && campi ? toCards({ ...tab, campi }) : [];
  const hasQuestion = !!campi && campi.includes('q');
  const choices = vocab ? VOCAB_FIELDS : FIELDS;
  const input = {
    backgroundColor: th.surface2,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: th.text,
    fontSize: 15,
  } as const;

  const fieldName = (f: Field): string =>
    f === 'q'
      ? t(vocab ? 'fc.smi_campo_q_vocab' : 'fc.smi_campo_q')
      : f === 'a'
        ? t(vocab ? 'fc.smi_campo_a_vocab' : 'fc.smi_campo_a')
        : f === 'm'
          ? t('fc.smi_campo_m')
          : f === 'ex'
            ? t('fc.smi_campo_ex')
            : f === 'n'
              ? t('fc.smi_campo_n')
              : f === 'img'
                ? t('fc.smi_campo_img')
                : t('fc.smi_campo_salta');

  const setField = (i: number, f: Field) => {
    if (!campi) return;
    // un campo sta in una colonna sola, tranne «ignora»
    const next = campi.map((c, k) => (k !== i && f && c === f ? '' : c));
    next[i] = f;
    setOverride({ text, campi: next as Field[] });
  };

  return (
    <View style={{ gap: 12 }}>
      <TextInput
        testID={`${testPrefix}-text`}
        multiline
        value={text}
        onChangeText={(v) => {
          setText(v);
          onEdit?.();
        }}
        placeholder={t(vocab ? 'fc.smi_ph_vocab' : 'fc.smi_ph')}
        placeholderTextColor={th.text3}
        autoCorrect={false}
        autoCapitalize="none"
        style={{ ...input, minHeight: 160, textAlignVertical: 'top' }}
      />
      {analysis && 'errore' in analysis ? (
        <Text testID={`${testPrefix}-error`} style={{ color: th.red }}>
          {t('fc.smi_json_errore', { errore: analysis.errore })}
        </Text>
      ) : null}
      {!analysis && text.trim() ? (
        <Text style={{ color: th.text2 }}>{t('fc.smi_non_capito')}</Text>
      ) : null}
      {tab && campi ? (
        <Card style={{ padding: 12, gap: 10 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Text testID={`${testPrefix}-format`} style={{ color: th.brand, fontWeight: '700' }}>
              {t(`fc.smi_formato_${tab.formato}`)}
            </Text>
            {tab.intestazione ? (
              <Text style={{ color: th.text2 }}>{t('fc.smi_con_intestazione')}</Text>
            ) : null}
            <Text testID={`${testPrefix}-count`} style={{ color: th.text, fontWeight: '700' }}>
              {imported.length === 1
                ? t('fc.smi_1_carta')
                : t('fc.smi_n_carte', { n: imported.length })}
            </Text>
          </View>
          {tab.colonne.map((name, i) => {
            const sample = tab.righe.map((r) => r[i] ?? '').find(Boolean) ?? '';
            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: th.text, fontWeight: '600' }} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={{ color: th.text2, fontSize: 12 }} numberOfLines={1}>
                    {sample.length > 46 ? `${sample.slice(0, 44)}…` : sample}
                  </Text>
                </View>
                <Pressable
                  testID={`${testPrefix}-col-${i}`}
                  accessibilityRole="button"
                  onPress={() => {
                    const at = choices.indexOf(campi[i] ?? '');
                    setField(i, choices[(at + 1) % choices.length]!);
                  }}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 14,
                    backgroundColor: campi[i] ? th.brand : th.surface2,
                  }}
                >
                  <Text style={{ color: campi[i] ? '#fff' : th.text2, fontWeight: '600' }}>
                    {fieldName(campi[i] ?? '')}
                  </Text>
                </Pressable>
              </View>
            );
          })}
          {!hasQuestion ? (
            <Text testID={`${testPrefix}-need-q`} style={{ color: th.red }}>
              {t('fc.smi_manca_q', { campo: fieldName('q').toLowerCase() })}
            </Text>
          ) : null}
          {imported.length > 0 ? (
            <View style={{ gap: 4 }}>
              <SectionLabel>{t('fc.smi_anteprima')}</SectionLabel>
              {imported.slice(0, 3).map((c, i) => (
                <Text key={i} style={{ color: th.text }} numberOfLines={2}>
                  <Text style={{ fontWeight: '700' }}>{c.q}</Text>
                  {c.a ? ` — ${c.a}` : ''}
                </Text>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}
      <PrimaryButton
        testID={`${testPrefix}-create`}
        label={
          imported.length === 1
            ? t('fc.smi_crea_1')
            : imported.length
              ? t('fc.smi_crea', { n: imported.length })
              : t('fc.ibfai_crea_carte')
        }
        disabled={!imported.length || !hasQuestion}
        onPress={() => {
          if (onCreate(imported) > 0) {
            setText('');
            setOverride(null);
          }
        }}
      />
    </View>
  );
}
