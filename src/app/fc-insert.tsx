import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import {
  analyze,
  FIELDS,
  toCards,
  type Field,
  type Table,
} from '@/features/flashcards/smartImport';
import { Card, Header, PrimaryButton, SectionLabel } from '@/ui/kit';

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

  const [mode, setMode] = useState<Mode>('paste');
  const [text, setText] = useState('');
  const [override, setOverride] = useState<{ text: string; campi: Field[] } | null>(null);
  const [rows, setRows] = useState<{ q: string; a: string }[]>([{ q: '', a: '' }]);
  const [done, setDone] = useState<number | null>(null);

  const analysis = useMemo(() => analyze(text, (n) => t('fc.smi_colonna_n', { n })), [text, t]);
  if (!services) return null;
  const deck = services.flashcards.deck(deckId);
  if (!deck) return null;

  const tab: Table | null = analysis && !('errore' in analysis) ? analysis : null;
  const campi: Field[] | null = tab
    ? override && override.text === text
      ? override.campi
      : tab.campi
    : null;
  const imported = tab && campi ? toCards({ ...tab, campi }) : [];
  const hasQuestion = !!campi && campi.includes('q');

  const fieldName = (f: Field): string =>
    f === 'q'
      ? t('fc.smi_campo_q')
      : f === 'a'
        ? t('fc.smi_campo_a')
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

  const saveAll = (list: { q: string; a: string }[]) => {
    let n = 0;
    for (const c of list) {
      if (services.flashcards.addCard(deckId, c.q || null, c.a || null)) n += 1;
    }
    if (n > 0) changed();
    setDone(n);
    return n;
  };

  const rowsToSave = rows.filter((r) => r.q.trim() || r.a.trim());
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

        {mode === 'paste' ? (
          <View style={{ gap: 12 }}>
            <TextInput
              testID="fci-text"
              multiline
              value={text}
              onChangeText={(v) => {
                setText(v);
                setDone(null);
              }}
              placeholder={t('fc.smi_ph')}
              placeholderTextColor={th.text3}
              autoCorrect={false}
              autoCapitalize="none"
              style={{ ...input, minHeight: 160, textAlignVertical: 'top' }}
            />
            {analysis && 'errore' in analysis ? (
              <Text testID="fci-error" style={{ color: th.red }}>
                {t('fc.smi_json_errore', { errore: analysis.errore })}
              </Text>
            ) : null}
            {!analysis && text.trim() ? (
              <Text style={{ color: th.text2 }}>{t('fc.smi_non_capito')}</Text>
            ) : null}
            {tab && campi ? (
              <Card style={{ padding: 12, gap: 10 }}>
                <View
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}
                >
                  <Text testID="fci-format" style={{ color: th.brand, fontWeight: '700' }}>
                    {t(`fc.smi_formato_${tab.formato}`)}
                  </Text>
                  {tab.intestazione ? (
                    <Text style={{ color: th.text2 }}>{t('fc.smi_con_intestazione')}</Text>
                  ) : null}
                  <Text testID="fci-count" style={{ color: th.text, fontWeight: '700' }}>
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
                        testID={`fci-col-${i}`}
                        accessibilityRole="button"
                        onPress={() => {
                          const at = FIELDS.indexOf(campi[i] ?? '');
                          setField(i, FIELDS[(at + 1) % FIELDS.length]!);
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
                  <Text testID="fci-need-q" style={{ color: th.red }}>
                    {t('fc.smi_manca_q', { campo: t('fc.smi_campo_q').toLowerCase() })}
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
              testID="fci-create"
              label={
                imported.length === 1
                  ? t('fc.smi_crea_1')
                  : imported.length
                    ? t('fc.smi_crea', { n: imported.length })
                    : t('fc.ibfai_crea_carte')
              }
              disabled={!imported.length || !hasQuestion}
              onPress={() => {
                if (saveAll(imported) > 0) {
                  setText('');
                  setOverride(null);
                }
              }}
            />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {rows.map((r, i) => (
              <Card key={i} style={{ padding: 12, gap: 8 }}>
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
                {rows.length > 1 ? (
                  <Pressable
                    testID={`fci-del-${i}`}
                    accessibilityRole="button"
                    onPress={() => setRows(rows.filter((_, k) => k !== i))}
                  >
                    <Text style={{ color: th.red, fontSize: 13 }}>{t('comune.elimina')}</Text>
                  </Pressable>
                ) : null}
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
                if (saveAll(rowsToSave) > 0) setRows([{ q: '', a: '' }]);
              }}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
