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
import { readImportFile } from '@/features/habits/importFile';
import { ColumnChooser } from '@/features/import/ColumnChooser';
import {
  parsePomodoroSheets,
  pomodoroColumns,
  type PCol,
  type PCols,
  type PomoParsed,
} from '@/features/pomodoro/importFile';
import {
  autoLink,
  savePomodoroImport,
  type ImportPlan,
  type ImportResult,
} from '@/features/pomodoro/importSave';
import { human } from '@/features/pomodoro/logic';
import { Card, Header, PrimaryButton, TextButton } from '@/ui/kit';

const SHOWN = 30;

/** I campi che l'importazione cerca, nell'ordine in cui si mostrano. */
const FIELDS: { key: PCol; label: string }[] = [
  { key: 'start', label: 'import.campo_inizio' },
  { key: 'end', label: 'import.campo_fine' },
  { key: 'date', label: 'import.campo_data_a_parte' },
  { key: 'type', label: 'import.campo_tipo' },
  { key: 'dur', label: 'import.campo_durata' },
  { key: 'title', label: 'import.campo_titolo' },
  { key: 'list', label: 'import.campo_lista' },
];

/**
 * «Importa» del Pomodoro (pomodoro_import.php): sessioni di un'altra app da un .xlsx o .csv. La colonna «lista» diventa il progetto,
 * il «titolo» il sotto-progetto. Si vede prima cosa c'è, si collega a un progetto che hai già o se ne fa uno nuovo, poi si salva.
 */
export default function PomodoroImportScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services, changed } = useApp();

  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<PomoParsed | null>(null);
  const [link, setLink] = useState<ImportPlan>({ lists: {}, titles: {} });
  const [open, setOpen] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  // il foglio letto e le colonne scelte a mano: cambiando una colonna si rilegge il file
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [choice, setChoice] = useState<Partial<PCols>>({});
  const [showCols, setShowCols] = useState(false);

  const projects = useMemo(() => (services ? services.projects.all() : []), [services]);
  const nameOf = (uuid: string | null) => projects.find((p) => p.uuid === uuid)?.name ?? '';

  if (!services) return null;

  /** Legge il foglio con le colonne date; ritorna false se non ci sono sessioni (e dice perché). */
  const analyse = (sh: SheetData[], ch: Partial<PCols>): boolean => {
    const p = parsePomodoroSheets(sh, ch);
    if (!p) {
      setParsed(null);
      setError(t('import.pi_nessuna_sessione'));
      return false;
    }
    setError('');
    setParsed(p);
    setLink(autoLink(p, projects));
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

  const pickColumn = (key: PCol, index: number) => {
    const next = { ...choice, [key]: index };
    setChoice(next);
    analyse(sheets, next);
  };

  const columnsCard = () => {
    const sheet = sheets[0];
    if (!sheet) return null;
    const { headerAt, cols } = pomodoroColumns(sheet, choice);
    return (
      <Card>
        <View style={{ padding: 16, gap: 12 }}>
          <Text style={{ color: th.text, fontSize: 16, fontWeight: '700' }}>
            {t('import.colonne_titolo')}
          </Text>
          <ColumnChooser
            idPrefix="pi-col"
            fields={FIELDS.map((f) => ({ key: f.key, label: t(f.label) }))}
            columns={columnsOf(sheet, headerAt)}
            value={cols}
            onChange={(k, i) => pickColumn(k as PCol, i)}
          />
        </View>
      </Card>
    );
  };

  const save = () => {
    if (!parsed) return;
    setBusy(true);
    try {
      const r = savePomodoroImport(services.db, services.projects, services.pomodoro, parsed, link);
      changed();
      setResult(r);
    } catch {
      setError(t('import.errore_salvataggio'));
    } finally {
      setBusy(false);
    }
  };

  const warningText = (w: PomoParsed['warnings'][number]): string =>
    w.kind === 'no_header'
      ? t('import.pi_warn_header')
      : w.kind === 'date_ambiguous'
        ? t('import.pi_warn_date')
        : t(w.n === 1 ? 'import.pi_riga_ignorata' : 'import.pi_righe_ignorate', { n: w.n });

  const q = search.trim().toLowerCase();
  const pickable = projects.filter((p) => !q || p.name.toLowerCase().includes(q)).slice(0, 20);
  const totalSeconds = parsed ? parsed.sessions.reduce((n, s) => n + s.dur, 0) : 0;

  /** Una riga «progetto del file» con il suo collegamento. */
  const renderLink = (
    kind: 'lists' | 'titles',
    key: string,
    name: string,
    context: string | null,
  ) => {
    const id = `${kind}-${key}`;
    const linked = link[kind][key] ?? null;
    const set = (uuid: string | null) => {
      setLink((cur) => ({ ...cur, [kind]: { ...cur[kind], [key]: uuid } }));
      setOpen(null);
    };
    return (
      <Card key={id}>
        <View style={{ padding: 14, gap: 8 }}>
          <Text style={{ color: th.text, fontSize: 16, fontWeight: '600' }}>{name}</Text>
          {context ? <Text style={{ color: th.text3, fontSize: 13 }}>{context}</Text> : null}
          <Pressable
            testID={`pi-link-${id}`}
            accessibilityRole="button"
            accessibilityLabel={t('import.pi_collega')}
            onPress={() => {
              setOpen(open === id ? null : id);
              setSearch('');
            }}
          >
            <Text style={{ color: linked ? th.brand : th.green, fontSize: 14 }}>
              {linked ? `↔ ${nameOf(linked)}` : `＋ ${t('import.pi_nuovo')}`}
            </Text>
          </Pressable>
          {open === id && (
            <View style={{ gap: 4 }}>
              <TextInput
                testID={`pi-search-${id}`}
                value={search}
                onChangeText={setSearch}
                placeholder={t('progetti.ps_cerca')}
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
                testID={`pi-new-${id}`}
                accessibilityRole="button"
                onPress={() => set(null)}
                style={{ paddingVertical: 8 }}
              >
                <Text style={{ color: th.green, fontSize: 15 }}>＋ {t('import.pi_nuovo')}</Text>
              </Pressable>
              {pickable.length === 0 && (
                <Text style={{ color: th.text3, fontSize: 14 }}>
                  {t('import.pi_nessun_progetto')}
                </Text>
              )}
              {pickable.map((p) => (
                <Pressable
                  key={p.uuid}
                  testID={`pi-pick-${id}-${p.uuid}`}
                  accessibilityRole="button"
                  onPress={() => set(p.uuid)}
                  style={{ paddingVertical: 8 }}
                >
                  <Text style={{ color: th.text, fontSize: 15 }}>
                    {p.parent_uuid ? `${nameOf(p.parent_uuid)} › ` : ''}
                    {p.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </Card>
    );
  };

  const listRows = parsed ? parsed.lists : [];
  const titleRows = parsed ? parsed.titles : [];
  const newProjects =
    listRows.filter((l) => !link.lists[l.key]).length +
    titleRows.filter((x) => !link.titles[x.key]).length;
  const rows = [
    ...listRows.map((l) => ({ kind: 'lists' as const, key: l.key, name: l.name, context: null })),
    ...titleRows.map((x) => ({
      kind: 'titles' as const,
      key: x.key,
      name: x.name,
      context: listRows.find((l) => l.key === x.listKey)?.name ?? t('import.pi_senza_principale'),
    })),
  ];
  const shown = more ? rows : rows.slice(0, SHOWN);

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        top={insets.top}
        title={t('import.importa')}
        right={
          <Pressable testID="pi-close" accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: th.brand, fontSize: 17 }}>{t('comune.chiudi')}</Text>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 40 }}
      >
        {result ? (
          <Card>
            <View testID="pi-done" style={{ padding: 16, gap: 8 }}>
              <Text style={{ color: th.text, fontSize: 18, fontWeight: '700' }}>
                {t('import.fatto')}
              </Text>
              <Text style={{ color: th.text2, fontSize: 15 }}>
                {t('import.pi_esito_sessioni', { n: result.sessions })}
              </Text>
              <Text style={{ color: th.text2, fontSize: 15 }}>
                {t('import.pi_esito_progetti', { n: result.projects })}
              </Text>
              <PrimaryButton
                testID="pi-finish"
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
                  {t('import.pi_sottotitolo')}
                </Text>
                <Text style={{ color: th.text2, fontSize: 14, lineHeight: 20 }}>
                  {t('import.pi_hint')
                    .replace(/<br\s*\/?>/g, '\n')
                    .replace(/<[^>]+>/g, '')}
                </Text>
                <Text style={{ color: th.text3, fontSize: 13 }}>{t('import.formati')}</Text>
                <PrimaryButton
                  testID="pi-pick"
                  label={t('import.sfoglia')}
                  busy={busy}
                  onPress={() => void choose()}
                />
                {error ? (
                  <Text
                    testID="pi-error"
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
                  {t('import.pi_dal_file', { nome: fileName })}
                </Text>
                <Text style={{ color: th.text, fontSize: 17, fontWeight: '600' }}>
                  {t('import.pi_sessioni_trovate', { n: parsed.sessions.length })}
                </Text>
                <Text style={{ color: th.text2, fontSize: 14 }}>
                  {t('import.pi_pomodori')}: {parsed.pomodori} · {t('import.pi_cronometri')}:{' '}
                  {parsed.cronometri} · {human(totalSeconds)}
                </Text>
                <TextButton
                  testID="pi-columns"
                  label={t('import.colonne_controlla')}
                  onPress={() => setShowCols(!showCols)}
                />
                <TextButton
                  testID="pi-change"
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
                <View testID="pi-warnings" style={{ padding: 16, gap: 6 }}>
                  {parsed.warnings.map((w, i) => (
                    <Text key={i} style={{ color: th.orange, fontSize: 14 }}>
                      {warningText(w)}
                    </Text>
                  ))}
                </View>
              </Card>
            )}
            {rows.length === 0 ? (
              <Text style={{ color: th.text3, fontSize: 14 }}>
                {t('import.pi_nessun_progetto_file')}
              </Text>
            ) : (
              <Text style={{ color: th.text2, fontSize: 14 }}>
                {t('import.pi_progetti')}:{' '}
                {t('import.pi_nuovi_su', { nuovi: newProjects, tot: rows.length })}
              </Text>
            )}
            {shown.map((r) => renderLink(r.kind, r.key, r.name, r.context))}
            {!more && rows.length > SHOWN && (
              <TextButton
                testID="pi-more"
                label={t('import.pi_mostra_altre', { n: rows.length - SHOWN, di: rows.length })}
                onPress={() => setMore(true)}
              />
            )}
            <Text style={{ color: th.text2, fontSize: 14, textAlign: 'center' }}>
              {t('import.pi_da_salvare', { n: parsed.sessions.length })}
            </Text>
            {error ? (
              <Text
                testID="pi-error"
                accessibilityRole="alert"
                style={{ color: th.red, fontSize: 14 }}
              >
                {error}
              </Text>
            ) : null}
            <PrimaryButton
              testID="pi-save"
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
