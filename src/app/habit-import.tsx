import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { columnsOf } from '@/core/files/columns';
import { readXlsx, type SheetData } from '@/core/files/xlsx';
import { pickDocument } from '@/core/media/pickFile';
import { useTheme } from '@/core/theme/ThemeProvider';
import {
  parseHabitSheets,
  readImportFile,
  sheetColumns,
  type ColumnChoice,
  type ColKey,
  type ImportParsed,
  type ImportWarning,
} from '@/features/habits/importFile';
import { planImport, saveImport, type ImportResult } from '@/features/habits/importSave';
import { ColumnChooser } from '@/features/import/ColumnChooser';
import { Card, Header, PrimaryButton, TextButton } from '@/ui/kit';

const SHOWN = 30;

/** I campi che l'importazione cerca, nell'ordine in cui si mostrano. */
const FIELDS: { key: ColKey; label: string }[] = [
  { key: 'habit', label: 'import.campo_abitudine' },
  { key: 'date', label: 'import.campo_data' },
  { key: 'time', label: 'import.campo_ora' },
  { key: 'status', label: 'import.campo_stato' },
  { key: 'count', label: 'import.campo_checkin' },
  { key: 'mood', label: 'import.campo_umore' },
  { key: 'note', label: 'import.campo_nota' },
];

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
  // il file letto e le colonne scelte a mano: cambiando una colonna si rilegge il file
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [choice, setChoice] = useState<ColumnChoice>({});
  const [showCols, setShowCols] = useState(false);
  const [sheetAt, setSheetAt] = useState(0);

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

  /** Legge i fogli con le colonne date; ritorna false se non ci sono abitudini (e dice perché). */
  const analyse = (sh: SheetData[], ch: ColumnChoice): boolean => {
    const p = parseHabitSheets(sh, t('import.abitudine_importata'), ch);
    if (!p.habits.length) {
      setParsed(null);
      setError(t('import.nessuna_abitudine'));
      return false;
    }
    const pl = planImport(p, existing);
    setError('');
    setParsed(p);
    setLink(Object.fromEntries(pl.map((r) => [r.key, r.existing])));
    setOpen(null);
    setMore(false);
    return true;
  };

  const choose = async () => {
    setError('');
    setBusy(true);
    try {
      const doc = await pickDocument();
      if (!doc) return;
      const read = readImportFile(doc.name, doc.bytes, readXlsx);
      setFileName(doc.name);
      setSheets(read);
      setChoice({});
      setSheetAt(0);
      // se l'app non ha capito nulla, si apre subito la scelta delle colonne
      setShowCols(!analyse(read, {}));
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

  const pickColumn = (key: ColKey, index: number) => {
    const next: ColumnChoice = { ...choice, [sheetAt]: { ...choice[sheetAt], [key]: index } };
    setChoice(next);
    analyse(sheets, next);
  };

  const columnsCard = () => {
    const sheet = sheets[sheetAt];
    if (!sheet) return null;
    const { headerAt, cols } = sheetColumns(sheet, choice[sheetAt]);
    return (
      <Card>
        <View style={{ padding: 16, gap: 12 }}>
          <Text style={{ color: th.text, fontSize: 16, fontWeight: '700' }}>
            {t('import.colonne_titolo')}
          </Text>
          {sheets.length > 1 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {sheets.map((sh, i) => (
                <Pressable
                  key={i}
                  testID={`hi-sheet-${i}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: i === sheetAt }}
                  onPress={() => setSheetAt(i)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: i === sheetAt ? th.brand : th.surface2,
                  }}
                >
                  <Text style={{ color: i === sheetAt ? '#fff' : th.text, fontSize: 13 }}>
                    {sh.name || `#${i + 1}`}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <ColumnChooser
            idPrefix="hi-col"
            fields={FIELDS.map((f) => ({ key: f.key, label: t(f.label) }))}
            columns={columnsOf(sheet, headerAt)}
            value={cols}
            onChange={(k, i) => pickColumn(k as ColKey, i)}
          />
        </View>
      </Card>
    );
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
          <>
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
            {sheets.length > 0 ? columnsCard() : null}
          </>
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
                  testID="hi-columns"
                  label={t('import.colonne_controlla')}
                  onPress={() => setShowCols(!showCols)}
                />
                <TextButton
                  testID="hi-change"
                  label={t('import.cambia_file')}
                  onPress={() => {
                    setParsed(null);
                    setSheets([]);
                    setChoice({});
                    setShowCols(false);
                    setError('');
                  }}
                />
              </View>
            </Card>
            {showCols ? columnsCard() : null}
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
