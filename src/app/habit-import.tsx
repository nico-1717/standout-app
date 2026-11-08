import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { readXlsx } from '@/core/files/xlsx';
import { pickDocument } from '@/core/media/pickFile';
import { useTheme } from '@/core/theme/ThemeProvider';
import {
  parseHabitSheets,
  readImportFile,
  type ImportParsed,
  type ImportWarning,
} from '@/features/habits/importFile';
import { planImport, saveImport, type ImportResult } from '@/features/habits/importSave';
import { Card, Header, PrimaryButton, TextButton } from '@/ui/kit';

const SHOWN = 30;

/**
 * «Importa» (habits_import.php): si sceglie un .xlsx o .csv di un'altra app, si vede cosa c'è dentro (abitudini nuove o già
 * presenti, quanti check-in), si può collegare una riga a un'abitudine che hai già, e solo dopo si salva.
 */
export default function HabitImportScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services, changed } = useApp();

  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ImportParsed | null>(null);
  const [link, setLink] = useState<Record<string, string | null>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const existing = useMemo(
    () =>
      services ? [...services.habits.list(), ...services.habits.list({ archived: true })] : [],
    [services],
  );
  const plan = useMemo(() => (parsed ? planImport(parsed, existing) : []), [parsed, existing]);

  if (!services) return null;

  const warningText = (w: ImportWarning): string => {
    switch (w.kind) {
      case 'no_header':
        return t('import.warn_no_header', { foglio: w.sheet });
      case 'date_ambiguous':
        return t('import.warn_date_ambigue', { foglio: w.sheet });
      case 'sheets_skipped':
        return t('import.warn_fogli_ignorati', { n: w.n, nomi: w.names });
      case 'rows_skipped':
        return t(w.n === 1 ? 'import.warn_riga_saltata' : 'import.warn_righe_saltate', { n: w.n });
    }
  };

  const choose = async () => {
    setError('');
    setBusy(true);
    try {
      const doc = await pickDocument();
      if (!doc) return;
      const sheets = readImportFile(doc.name, doc.bytes, readXlsx);
      const p = parseHabitSheets(sheets, t('import.abitudine_importata'));
      if (!p.habits.length) {
        setError(t('import.nessuna_abitudine'));
        return;
      }
      const pl = planImport(p, existing);
      setFileName(doc.name);
      setParsed(p);
      setLink(Object.fromEntries(pl.map((r) => [r.key, r.existing])));
      setOpen(null);
      setMore(false);
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setError(
        ['xls_vecchio', 'xlsx_non_valido', 'file_vuoto', 'troppo_grande'].includes(code)
          ? t(`import.${code}`)
          : t('import.illeggibile'),
      );
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!parsed) return;
    setBusy(true);
    try {
      const r = saveImport(services.db, services.habits, parsed, link);
      changed();
      setResult(r);
    } catch {
      setError(t('import.errore_salvataggio'));
    } finally {
      setBusy(false);
    }
  };

  const nameOf = (uuid: string | null) => existing.find((h) => h.uuid === uuid)?.name ?? '';
  const newCount = plan.filter((r) => !link[r.key]).length;
  const checkins = plan.reduce((n, r) => n + r.checkins, 0);
  const shownRows = more ? plan : plan.slice(0, SHOWN);
  const q = search.trim().toLowerCase();
  const pickable = existing.filter((h) => !q || h.name.toLowerCase().includes(q)).slice(0, 20);

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        top={insets.top}
        title={t('import.importa')}
        right={
          <Pressable testID="hi-close" accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: th.brand, fontSize: 17 }}>{t('comune.chiudi')}</Text>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 40 }}
      >
        {result ? (
          <Card>
            <View testID="hi-done" style={{ padding: 16, gap: 8 }}>
              <Text style={{ color: th.text, fontSize: 18, fontWeight: '700' }}>
                {t('import.fatto')}
              </Text>
              <Text style={{ color: th.text2, fontSize: 15 }}>
                {t('import.esito_abitudini', { n: result.habits })}
              </Text>
              <Text style={{ color: th.text2, fontSize: 15 }}>
                {t('import.esito_giorni', { n: result.days })}
              </Text>
              <Text style={{ color: th.text2, fontSize: 15 }}>
                {t('import.esito_checkin', { n: result.checkins })}
              </Text>
              <PrimaryButton
                testID="hi-finish"
                label={t('comune.chiudi')}
                onPress={() => router.back()}
              />
            </View>
          </Card>
        ) : !parsed ? (
          <Card>
            <View style={{ padding: 16, gap: 12 }}>
              <Text style={{ color: th.text, fontSize: 17, fontWeight: '600' }}>
                {t('import.scegli_file')}
              </Text>
              <Text style={{ color: th.text2, fontSize: 14, lineHeight: 20 }}>
                {t('import.spiegazione')
                  .replace(/<br\s*\/?>/g, '\n')
                  .replace(/<[^>]+>/g, '')}
              </Text>
              <Text style={{ color: th.text3, fontSize: 13 }}>{t('import.formati')}</Text>
              <PrimaryButton
                testID="hi-pick"
                label={t('import.sfoglia')}
                busy={busy}
                onPress={() => void choose()}
              />
              {error ? (
                <Text
                  testID="hi-error"
                  accessibilityRole="alert"
                  style={{ color: th.red, fontSize: 14 }}
                >
                  {error}
                </Text>
              ) : null}
            </View>
          </Card>
        ) : (
          <>
            <Card>
              <View style={{ padding: 16, gap: 6 }}>
                <Text style={{ color: th.text3, fontSize: 13 }}>
                  {t('import.dal_file', { nome: fileName })}
                </Text>
                <Text style={{ color: th.text, fontSize: 17, fontWeight: '600' }}>
                  {t('import.trovati', { abitudini: plan.length, checkin: checkins })}
                </Text>
                <Text style={{ color: th.text2, fontSize: 14 }}>
                  {t('import.n_nuove_su', { nuove: newCount, tot: plan.length })}
                </Text>
                <TextButton
                  testID="hi-change"
                  label={t('import.cambia_file')}
                  onPress={() => {
                    setParsed(null);
                    setError('');
                  }}
                />
              </View>
            </Card>
            {parsed.warnings.length > 0 && (
              <Card>
                <View testID="hi-warnings" style={{ padding: 16, gap: 6 }}>
                  {parsed.warnings.map((w, i) => (
                    <Text key={i} style={{ color: th.orange, fontSize: 14 }}>
                      {warningText(w)}
                    </Text>
                  ))}
                </View>
              </Card>
            )}
            {shownRows.map((r) => {
              const linked = link[r.key] ?? null;
              return (
                <Card key={r.key}>
                  <View style={{ padding: 14, gap: 8 }}>
                    <Text style={{ color: th.text, fontSize: 16, fontWeight: '600' }}>
                      {r.name}
                    </Text>
                    <Text style={{ color: th.text3, fontSize: 13 }}>
                      {t('import.trovati', { abitudini: 1, checkin: r.checkins })}
                    </Text>
                    <Pressable
                      testID={`hi-link-${r.key}`}
                      accessibilityRole="button"
                      accessibilityLabel={t('import.collega_esistente')}
                      onPress={() => {
                        setOpen(open === r.key ? null : r.key);
                        setSearch('');
                      }}
                    >
                      <Text style={{ color: linked ? th.brand : th.green, fontSize: 14 }}>
                        {linked ? `↔ ${nameOf(linked)}` : `＋ ${t('import.nuova')}`}
                      </Text>
                    </Pressable>
                    {open === r.key && (
                      <View style={{ gap: 4 }}>
                        <TextInput
                          testID={`hi-search-${r.key}`}
                          value={search}
                          onChangeText={setSearch}
                          placeholder={t('import.cerca_abitudine')}
                          placeholderTextColor={th.text3}
                          style={{
                            backgroundColor: th.surface2,
                            borderRadius: 10,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            color: th.text,
                            fontSize: 15,
                          }}
                        />
                        <Pressable
                          testID={`hi-new-${r.key}`}
                          accessibilityRole="button"
                          onPress={() => {
                            setLink((cur) => ({ ...cur, [r.key]: null }));
                            setOpen(null);
                          }}
                          style={{ paddingVertical: 8 }}
                        >
                          <Text style={{ color: th.green, fontSize: 15 }}>
                            ＋ {t('import.nuova')}
                          </Text>
                        </Pressable>
                        {pickable.length === 0 && (
                          <Text style={{ color: th.text3, fontSize: 14 }}>
                            {t('import.nessuna_trovata')}
                          </Text>
                        )}
                        {pickable.map((h) => (
                          <Pressable
                            key={h.uuid}
                            testID={`hi-pick-${r.key}-${h.uuid}`}
                            accessibilityRole="button"
                            onPress={() => {
                              setLink((cur) => ({ ...cur, [r.key]: h.uuid }));
                              setOpen(null);
                            }}
                            style={{ paddingVertical: 8 }}
                          >
                            <Text style={{ color: th.text, fontSize: 15 }}>
                              {h.name}
                              {h.is_archived ? ` · ${t('import.archiviata')}` : ''}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                </Card>
              );
            })}
            {!more && plan.length > SHOWN && (
              <TextButton
                testID="hi-more"
                label={t('import.mostra_altri', { n: plan.length - SHOWN, di: plan.length })}
                onPress={() => setMore(true)}
              />
            )}
            <Text style={{ color: th.text2, fontSize: 14, textAlign: 'center' }}>
              {t('import.n_abitudini_nuove', { n: newCount })} ·{' '}
              {t('import.n_checkin_da_salvare', { n: checkins })}
            </Text>
            {error ? (
              <Text
                testID="hi-error"
                accessibilityRole="alert"
                style={{ color: th.red, fontSize: 14 }}
              >
                {error}
              </Text>
            ) : null}
            <PrimaryButton
              testID="hi-save"
              label={t('import.importa')}
              busy={busy}
              onPress={save}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}
