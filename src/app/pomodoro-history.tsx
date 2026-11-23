import type { ReactNode } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { dayOfMonth, monthOf, weekdayOf } from '@/features/planner/dates';
import { TrashIcon } from '@/features/grades/parts';
import { ChoiceSheet } from '@/features/pomodoro/ChoiceSheet';
import {
  buildCsv,
  buildXlsx,
  exportRows,
  exportStem,
  exportTitle,
} from '@/features/pomodoro/exportFile';
import { human, type Session } from '@/features/pomodoro/logic';
import type { HistoryFilter } from '@/features/pomodoro/repo';
import { ProjectPicker } from '@/features/projects/ProjectPicker';
import { subtreeIds } from '@/features/projects/logic';
import { localToday } from '@/features/tasks/groups';
import { ActionSwipe } from '@/ui/ActionSwipe';
import { DateTimeField } from '@/ui/DateTimeField';
import { Card, Header, PrimaryButton, SectionLabel, TextButton } from '@/ui/kit';
import { HistBtn, HistBtnRow, HistChip } from '@/features/pomodoro/HistoryParts';
import { Text } from '@/ui/CappedText';

const PAGE = 20;
const PIE_C = 2 * Math.PI * 34;
const GREY = '#8E8E93';

type Sort = NonNullable<HistoryFilter['sort']>;

interface Draft {
  uuid: string | null;
  day: string;
  from: string;
  to: string;
  mode: 0 | 1;
  project: string | null;
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const fromMin = (n: number) => {
  const x = ((n % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};

/** Una voce del pannello come sul sito: etichetta piccola in maiuscolo sopra a un campo grigio. */
function Field(p: { label: string; children: ReactNode; width?: number }) {
  const th = useTheme();
  return (
    <View style={{ flex: p.width ? 0 : 1, width: p.width, gap: 4 }}>
      <Text
        style={{
          color: th.text2,
          fontSize: 11,
          fontWeight: '700',
          textTransform: 'uppercase',
        }}
      >
        {p.label}
      </Text>
      <View
        style={{
          backgroundColor: th.surface2,
          borderRadius: 11,
          paddingHorizontal: 10,
          paddingVertical: 6,
          minHeight: 40,
          justifyContent: 'center',
        }}
      >
        {p.children}
      </View>
    </View>
  );
}

/** Lo storico del Pomodoro: panoramica, elenco per giorno con filtri, aggiunta e correzione a mano, azioni su più righe. */
export default function PomodoroHistory() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services, version, changed } = useApp();
  const today = localToday();

  const { project: scopeParam } = useLocalSearchParams<{ project?: string }>();
  // aperto da un progetto: si vedono i suoi Pomodoro e quelli dei suoi sotto-progetti, finché non si azzera
  const [scope, setScope] = useState<string | null>(
    typeof scopeParam === 'string' ? scopeParam : null,
  );
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [minText, setMinText] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [pickFilter, setPickFilter] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [pages, setPages] = useState(1);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftPick, setDraftPick] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bulkPick, setBulkPick] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [swiped, setSwiped] = useState<string | null>(null);
  const [rowDelete, setRowDelete] = useState<string | null>(null);

  const filter: HistoryFilter = useMemo(() => {
    void version;
    return {
      projects: scope && services ? subtreeIds(services.projects.all(), scope) : undefined,
      project: projectFilter === 'all' ? undefined : projectFilter,
      from: from || undefined,
      to: to || undefined,
      minMinutes: parseInt(minText, 10) || undefined,
      sort,
    };
  }, [scope, services, version, projectFilter, from, to, minText, sort]);

  const data = useMemo(() => {
    void version;
    if (!services) return null;
    const p = services.pomodoro;
    return {
      list: p.history(filter, PAGE * pages, 0),
      more: p.history(filter, 1, PAGE * pages).length > 0,
      totals: p.dayTotals(filter),
      insights: p.insights(today),
      projects: services.projects.all(),
    };
  }, [services, version, filter, pages, today]);
  if (!services || !data) return null;
  const { insights: ins } = data;
  const nameOf = (id: string | null) => data.projects.find((p) => p.uuid === id)?.name ?? null;
  const colorOf = (id: string | null) => data.projects.find((p) => p.uuid === id)?.color ?? GREY;

  const dayLabel = (d: string) =>
    `${t(`planner.gg_${weekdayOf(d)}`)} ${dayOfMonth(d)} ${t(`planner.mese_${monthOf(d)}`)}`;
  const hm = (stamp: string | null) => (stamp ? stamp.slice(11, 16) : '');
  const groups: { day: string; rows: Session[] }[] = [];
  for (const s of data.list) {
    const day = s.start_time.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.rows.push(s);
    else groups.push({ day, rows: [s] });
  }

  const filterName =
    projectFilter === 'all'
      ? t('pomodoro.storico_tutti_progetti')
      : projectFilter === 'none'
        ? t('pomodoro.storico_senza_progetto')
        : (nameOf(projectFilter) ?? t('pomodoro.storico_tutti_progetti'));

  const open = (s: Session | null) => {
    setError('');
    setDraftPick(false);
    setConfirmDelete(false);
    setDraft(
      s
        ? {
            uuid: s.uuid,
            day: s.start_time.slice(0, 10),
            from: hm(s.start_time),
            to: hm(s.end_time),
            mode: s.mode === 1 ? 1 : 0,
            project: s.project_uuid,
          }
        : { uuid: null, day: today, from: '09:00', to: '09:25', mode: 0, project: null },
    );
  };
  const save = () => {
    if (!draft) return;
    const p = services.pomodoro;
    const ok = draft.uuid
      ? p.edit(draft.uuid, {
          day: draft.day,
          from: draft.from,
          to: draft.to,
          projectUuid: draft.project,
        })
      : !!p.addManual({
          day: draft.day,
          from: draft.from,
          to: draft.to,
          mode: draft.mode,
          projectUuid: draft.project,
        });
    if (!ok) {
      setError(t('pomodoro.storico_compila'));
      return;
    }
    setDraft(null);
    changed();
  };

  /** «Esporta»: tutto lo storico in un file (.xlsx come il sito, o .csv) da salvare o condividere. */
  async function exportFile(format: 'xlsx' | 'csv') {
    setExporting(false);
    try {
      const rows = exportRows(services!.db);
      if (!rows.length) {
        Alert.alert(t('pomodoro.ph_esporta'), t('pomodoro.storico_nessuna'));
        return;
      }
      const title = exportTitle(rows);
      const file = new File(Paths.cache, `${exportStem()}.${format}`);
      file.create({ overwrite: true });
      if (format === 'xlsx') file.write(buildXlsx(rows, title));
      else file.write(buildCsv(rows, title));
      try {
        await Sharing.shareAsync(file.uri, {
          mimeType:
            format === 'xlsx'
              ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              : 'text/csv',
        });
      } finally {
        // la copia nella cache non serve più dopo «Condividi»
        try {
          if (file.exists) file.delete();
        } catch {
          /* già sparita */
        }
      }
    } catch {
      Alert.alert(t('pomodoro.ph_esporta'), t('app.scarica_errore'));
    }
  }

  const toggle = (id: string) =>
    setSelected((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
    setBulkPick(false);
    setConfirmDelete(false);
  };
  const bulkIds = [...selected];

  const compare =
    ins.today.n === 0
      ? t('pomodoro.storico_oggi_vuoto')
      : ins.today.n === ins.yesterday.n
        ? t('pomodoro.storico_uguale_a_ieri')
        : ins.today.n > ins.yesterday.n
          ? t('pomodoro.storico_oggi_in_piu', { n: ins.today.n - ins.yesterday.n })
          : t('pomodoro.storico_oggi_in_meno', { n: ins.yesterday.n - ins.today.n });
  const pieTotal = ins.todayProjects.reduce((n, p) => n + p.secs, 0);
  const pieArcs = ins.todayProjects.map((p, i) => ({
    key: p.uuid ?? 'none',
    color: colorOf(p.uuid),
    len: PIE_C * (p.secs / pieTotal),
    from: PIE_C * (ins.todayProjects.slice(0, i).reduce((n, x) => n + x.secs, 0) / pieTotal),
  }));
  const pieFirst = ins.todayProjects[0];
  const pieName = pieFirst ? (nameOf(pieFirst.uuid) ?? t('pomodoro.storico_nessun_progetto')) : '';
  const pieCaption =
    ins.todayProjects.length > 1
      ? t('pomodoro.storico_torta_e_altri', { progetto: pieName, n: ins.todayProjects.length - 1 })
      : pieName;
  const maxWeek = Math.max(1, ...ins.week.map((d) => d.secs));
  const maxMonth = Math.max(1, ...Object.values(ins.month).map((d) => d.secs));

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        top={insets.top}
        title={t('pomodoro.storico')}
        right={
          <HistBtnRow>
            <HistBtn
              testID="hist-select"
              icon="select"
              label={t('pomodoro.ph_seleziona')}
              active={selecting}
              onPress={() => (selecting ? stopSelecting() : setSelecting(true))}
            />
            <HistBtn
              testID="hist-add"
              icon="add"
              label={t('pomodoro.ph_aggiungi_manuale')}
              onPress={() => open(null)}
            />
            <HistBtn
              testID="hist-import"
              icon="import"
              label={t('pomodoro.ph_importa')}
              onPress={() => router.push('/pomodoro-import')}
            />
            <HistBtn
              testID="hist-export"
              icon="export"
              label={t('pomodoro.ph_esporta')}
              onPress={() => setExporting(true)}
            />
            <HistBtn
              testID="hist-close"
              icon="close"
              label={t('comune.chiudi')}
              onPress={() => router.back()}
            />
          </HistBtnRow>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        {draft ? (
          <Card style={{ padding: 16, gap: 10 }}>
            {draft.uuid ? (
              <Text style={{ color: th.text, fontSize: 13, fontWeight: '800' }}>
                {t('pomodoro.storico_modifica_titolo')}
              </Text>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <HistChip
                  testID="draft-mode-0"
                  label={t('pomodoro.timer')}
                  on={draft.mode === 0}
                  onPress={() => setDraft({ ...draft, mode: 0 })}
                />
                <HistChip
                  testID="draft-mode-1"
                  label={t('pomodoro.cronometro')}
                  on={draft.mode === 1}
                  onPress={() => setDraft({ ...draft, mode: 1 })}
                />
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Field label={t('comune.data')}>
                <DateTimeField
                  kind="date"
                  testID="draft-day"
                  value={draft.day}
                  fallback={today}
                  onChange={(v) => v && setDraft({ ...draft, day: v })}
                />
              </Field>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Field label={t('pomodoro.storico_inizio')}>
                <DateTimeField
                  kind="time"
                  testID="draft-from"
                  value={draft.from}
                  fallback="09:00"
                  onChange={(v) => v && setDraft({ ...draft, from: v })}
                />
              </Field>
              <Field label={t('pomodoro.storico_fine')}>
                <DateTimeField
                  kind="time"
                  testID="draft-to"
                  value={draft.to}
                  fallback="09:25"
                  onChange={(v) => v && setDraft({ ...draft, to: v })}
                />
              </Field>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
              <Field label={t('pomodoro.durata')} width={150}>
                <DateTimeField
                  kind="time"
                  testID="draft-duration"
                  value={fromMin(toMin(draft.to) - toMin(draft.from))}
                  fallback="00:25"
                  onChange={(v) =>
                    v && setDraft({ ...draft, to: fromMin(toMin(draft.from) + toMin(v)) })
                  }
                />
              </Field>
            </View>
            <View style={{ gap: 4 }}>
              <Text
                style={{
                  color: th.text2,
                  fontSize: 11,
                  fontWeight: '700',
                  textTransform: 'uppercase',
                }}
              >
                {t('pomodoro.storico_progetto_opz')}
              </Text>
              <Pressable
                testID="draft-project"
                accessibilityRole="button"
                onPress={() => setDraftPick(!draftPick)}
                style={{
                  backgroundColor: th.surface2,
                  borderRadius: 11,
                  paddingHorizontal: 12,
                  minHeight: 40,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ color: th.text, fontSize: 14.5 }}>
                  {nameOf(draft.project) ?? t('pomodoro.storico_nessun_progetto')}
                </Text>
                <Text style={{ color: th.text2 }}>›</Text>
              </Pressable>
            </View>
            {draftPick ? (
              <ProjectPicker
                projects={data.projects}
                value={draft.project}
                onPick={(id) => {
                  setDraft({ ...draft, project: id });
                  setDraftPick(false);
                }}
              />
            ) : null}
            {error ? <Text style={{ color: th.red }}>{error}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {draft.uuid ? (
                <Pressable
                  testID="draft-cancel"
                  accessibilityRole="button"
                  onPress={() => setDraft(null)}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 18,
                    borderRadius: 12,
                    backgroundColor: th.surface2,
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: th.text2, fontWeight: '700' }}>{t('comune.annulla')}</Text>
                </Pressable>
              ) : null}
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  testID="draft-save"
                  label={
                    draft.uuid
                      ? t('pomodoro.storico_salva_modifica')
                      : t('pomodoro.storico_salva_sessione')
                  }
                  onPress={save}
                />
              </View>
            </View>
            {draft.uuid ? (
              confirmDelete ? (
                <PrimaryButton
                  testID="draft-delete-yes"
                  danger
                  label={t('pomodoro.scarta_conferma')}
                  onPress={() => {
                    services.pomodoro.removeMany([draft.uuid!]);
                    setDraft(null);
                    changed();
                  }}
                />
              ) : (
                <TextButton
                  testID="draft-delete"
                  danger
                  label={t('pomodoro.scarta')}
                  onPress={() => setConfirmDelete(true)}
                />
              )
            ) : (
              <TextButton
                testID="draft-cancel"
                label={t('comune.annulla')}
                onPress={() => setDraft(null)}
              />
            )}
          </Card>
        ) : null}

        <Card style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <SectionLabel>{t('pomodoro.storico_panoramica_oggi')}</SectionLabel>
              <Text testID="ins-today" style={{ color: th.text, fontSize: 22, fontWeight: '700' }}>
                {ins.today.n} · {human(ins.today.secs)}
              </Text>
              <Text style={{ color: th.text2, marginTop: 2 }}>{compare}</Text>
            </View>
            {ins.streak > 0 ? (
              <View style={{ alignItems: 'flex-end' }}>
                <Text
                  testID="ins-streak"
                  style={{ color: th.orange, fontSize: 22, fontWeight: '700' }}
                >
                  🔥 {ins.streak}
                </Text>
                <Text style={{ color: th.text2 }}>
                  {ins.streak === 1
                    ? t('pomodoro.storico_serie_unita_uno')
                    : t('pomodoro.storico_serie_unita_altri')}
                </Text>
              </View>
            ) : null}
          </View>
          <SectionLabel>{t('pomodoro.storico_panoramica_giorno')}</SectionLabel>
          {pieTotal > 0 ? (
            <View
              testID="ins-pie"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}
              accessible
              accessibilityLabel={`${pieCaption} · ${human(pieTotal)}`}
            >
              <View style={{ width: 96, height: 96 }}>
                <Svg
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  width={96}
                  height={96}
                  viewBox="0 0 80 80"
                  style={{ transform: [{ rotate: '-90deg' }] }}
                >
                  <Circle cx={40} cy={40} r={34} fill="none" stroke={th.hairline} strokeWidth={6} />
                  {pieArcs.map((a) => (
                    <Circle
                      key={a.key}
                      cx={40}
                      cy={40}
                      r={34}
                      fill="none"
                      stroke={a.color}
                      strokeWidth={6}
                      strokeDasharray={`${a.len} ${PIE_C - a.len}`}
                      strokeDashoffset={-a.from}
                    />
                  ))}
                </Svg>
                <View
                  style={{
                    position: 'absolute',
                    inset: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: th.text, fontSize: 16, fontWeight: '800' }}>
                    {human(pieTotal)}
                  </Text>
                </View>
              </View>
              <Text testID="ins-pie-caption" style={{ color: th.text2, flex: 1 }}>
                {pieCaption}
              </Text>
            </View>
          ) : (
            <Text style={{ color: th.text2 }}>{t('pomodoro.storico_oggi_vuoto')}</Text>
          )}
          <SectionLabel>{t('pomodoro.storico_panoramica_settimana')}</SectionLabel>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={ins.week
              .map((d) => `${t(`planner.gg_${weekdayOf(d.day)}`)}: ${human(d.secs)}`)
              .join(', ')}
            style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 70 }}
          >
            {ins.week.map((d) => (
              <View key={d.day} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <View
                  testID={`ins-bar-${d.day}`}
                  style={{
                    width: '100%',
                    height: Math.max(3, Math.round((d.secs / maxWeek) * 48)),
                    borderRadius: 4,
                    overflow: 'hidden',
                    flexDirection: 'column-reverse',
                    backgroundColor: d.secs ? th.brand : th.hairline,
                  }}
                >
                  {(ins.weekProjects[d.day] ?? []).map((p) => (
                    <View
                      key={p.uuid ?? 'none'}
                      style={{ flex: p.secs / d.secs, backgroundColor: colorOf(p.uuid) }}
                    />
                  ))}
                </View>
                <Text style={{ color: th.text3, fontSize: 10 }}>
                  {t(`planner.gg_${weekdayOf(d.day)}`).slice(0, 1)}
                </Text>
              </View>
            ))}
          </View>
          <SectionLabel>{t('pomodoro.storico_panoramica_mese')}</SectionLabel>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={human(Object.values(ins.month).reduce((n, v) => n + v.secs, 0))}
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}
          >
            {Array.from({ length: 31 }, (_, i) => {
              const day = `${today.slice(0, 8)}${String(i + 1).padStart(2, '0')}`;
              if (Number(today.slice(5, 7)) !== Number(day.slice(5, 7))) return null;
              const v = ins.month[day];
              return (
                <View
                  key={day}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    backgroundColor: v ? th.brand : th.hairline,
                    opacity: v ? 0.35 + 0.65 * (v.secs / maxMonth) : 1,
                  }}
                />
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <SectionLabel>{t('pomodoro.storico_panoramica_ora_top')}</SectionLabel>
              <Text style={{ color: th.text }}>
                {ins.topHour === null
                  ? t('pomodoro.storico_ora_top_vuoto')
                  : `${String(ins.topHour).padStart(2, '0')}:00`}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <SectionLabel>{t('pomodoro.storico_panoramica_progetto_settimana')}</SectionLabel>
              <Text style={{ color: th.text }}>
                {ins.weekProject
                  ? `${nameOf(ins.weekProject.uuid) ?? ''} · ${human(ins.weekProject.secs)}`
                  : t('pomodoro.storico_progetto_settimana_vuoto')}
              </Text>
            </View>
          </View>
        </Card>

        <View style={{ gap: 10 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            <HistChip
              testID="sort-recent"
              label={t('pomodoro.storico_recenti')}
              on={sort === 'recent'}
              onPress={() => setSort('recent')}
            />
            <HistChip
              testID="sort-oldest"
              label={t('pomodoro.storico_vecchi')}
              on={sort === 'oldest'}
              onPress={() => setSort('oldest')}
            />
            <HistChip
              testID="sort-duration"
              label={t('pomodoro.durata')}
              on={sort === 'duration'}
              onPress={() => setSort('duration')}
            />
            <HistChip
              testID="hist-period"
              label={
                from || to
                  ? `${t('pomodoro.storico_periodo')} · ${from || '…'} → ${to || '…'}`
                  : t('pomodoro.storico_periodo')
              }
              on={!!(from || to) || periodOpen}
              onPress={() => setPeriodOpen(!periodOpen)}
            />
            {scope ? null : (
              <HistChip
                testID="hist-filter-project"
                label={projectFilter === 'all' ? t('pomodoro.storico_progetto') : filterName}
                on={projectFilter !== 'all' || pickFilter}
                onPress={() => setPickFilter(!pickFilter)}
              />
            )}
          </ScrollView>
          {pickFilter && !scope ? (
            <ProjectPicker
              projects={data.projects}
              value={projectFilter}
              hideNone
              extras={[
                { id: 'all', label: t('pomodoro.storico_tutti_progetti') },
                { id: 'none', label: t('pomodoro.storico_senza_progetto') },
              ]}
              onPick={(id) => {
                setProjectFilter(id ?? 'all');
                setPickFilter(false);
                setPages(1);
              }}
            />
          ) : null}
          {periodOpen ? (
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
              <Field label={t('pomodoro.storico_dal')}>
                <DateTimeField
                  kind="date"
                  testID="hist-from"
                  value={from}
                  fallback={today}
                  placeholder="—"
                  clearable
                  onChange={(v) => {
                    setFrom(v);
                    setPages(1);
                  }}
                />
              </Field>
              <Field label="→">
                <DateTimeField
                  kind="date"
                  testID="hist-to"
                  value={to}
                  fallback={today}
                  placeholder="—"
                  clearable
                  onChange={(v) => {
                    setTo(v);
                    setPages(1);
                  }}
                />
              </Field>
              <Field label="≥ min" width={74}>
                <TextInput
                  testID="hist-min"
                  value={minText}
                  onChangeText={(v) => {
                    setMinText(v.replace(/[^0-9]/g, ''));
                    setPages(1);
                  }}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={th.text3}
                  style={{ color: th.text, fontSize: 14, padding: 0 }}
                />
              </Field>
            </View>
          ) : null}
          {scope ? (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text testID="hist-scope" style={{ color: th.text }}>
                {t('pomodoro.ph_progetto_nome', { nome: nameOf(scope) ?? '' })}
              </Text>
              <TextButton
                testID="hist-scope-clear"
                label={t('pomodoro.storico_tutti')}
                onPress={() => setScope(null)}
              />
            </View>
          ) : null}
          {from || to || minText || projectFilter !== 'all' ? (
            <TextButton
              testID="hist-reset"
              label={t('pomodoro.ph_azzera_periodo')}
              onPress={() => {
                setFrom('');
                setTo('');
                setMinText('');
                setProjectFilter('all');
                setPages(1);
              }}
            />
          ) : null}
        </View>

        {selecting ? (
          <Card style={{ padding: 14, gap: 8 }}>
            <Text style={{ color: th.text, fontWeight: '700' }}>
              {t('pomodoro.storico_n_selezionati', { n: bulkIds.length })}
            </Text>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <TextButton
                testID="bulk-all"
                label={t('pomodoro.storico_seleziona_tutti')}
                onPress={() => setSelected(new Set(services.pomodoro.historyIds(filter)))}
              />
              <TextButton
                testID="bulk-none"
                label={t('pomodoro.storico_deseleziona')}
                onPress={() => setSelected(new Set())}
              />
            </View>
            {bulkIds.length ? (
              <View style={{ gap: 4 }}>
                <TextButton
                  testID="bulk-set"
                  label={t('pomodoro.storico_assegna')}
                  onPress={() => setBulkPick(!bulkPick)}
                />
                {bulkPick ? (
                  <ProjectPicker
                    projects={data.projects}
                    value={null}
                    hideNone
                    onPick={(id) => {
                      if (!id) return;
                      services.pomodoro.setProjectMany(bulkIds, id);
                      stopSelecting();
                      changed();
                    }}
                  />
                ) : null}
                <TextButton
                  testID="bulk-unlink"
                  label={t('pomodoro.storico_scollega')}
                  onPress={() => {
                    services.pomodoro.setProjectMany(bulkIds, null);
                    stopSelecting();
                    changed();
                  }}
                />
                {confirmDelete ? (
                  <PrimaryButton
                    testID="bulk-delete-yes"
                    danger
                    label={t('pomodoro.scarta_conferma')}
                    onPress={() => {
                      services.pomodoro.removeMany(bulkIds);
                      stopSelecting();
                      changed();
                    }}
                  />
                ) : (
                  <TextButton
                    testID="bulk-delete"
                    danger
                    label={t('pomodoro.elimina_tutte')}
                    onPress={() => setConfirmDelete(true)}
                  />
                )}
              </View>
            ) : null}
          </Card>
        ) : null}

        {scope ? (
          <Pressable
            testID="hist-go"
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/pomodoro', params: { project: scope } })}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              minHeight: 48,
              borderRadius: 16,
              backgroundColor: colorOf(scope),
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>
              ▶ {t('pomodoro.avvia_su_questo')}
            </Text>
          </Pressable>
        ) : null}

        {groups.length === 0 ? (
          <Text style={{ color: th.text2, textAlign: 'center', padding: 24 }}>
            {t('pomodoro.storico_nessuna')}
          </Text>
        ) : (
          groups.map((g) => (
            <View key={g.day} style={{ gap: 6 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingHorizontal: 4,
                }}
              >
                <Text style={{ color: th.text2, fontWeight: '600' }}>{dayLabel(g.day)}</Text>
                <Text style={{ color: th.text2 }}>{human(data.totals[g.day] ?? 0)}</Text>
              </View>
              <Card>
                {g.rows.map((s, i) => {
                  const on = selected.has(s.uuid);
                  const rowEl = (
                    <Pressable
                      key={s.uuid}
                      testID={`hist-row-${s.uuid}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() => (selecting ? toggle(s.uuid) : open(s))}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        padding: 14,
                        borderTopWidth: i ? 0.5 : 0,
                        borderTopColor: th.hairline,
                        backgroundColor: on ? th.brandSoft : 'transparent',
                      }}
                    >
                      {selecting ? (
                        <Text style={{ color: on ? th.brand : th.text3, fontSize: 18 }}>
                          {on ? '●' : '○'}
                        </Text>
                      ) : null}
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: colorOf(s.project_uuid),
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: th.text, fontSize: 15 }} numberOfLines={1}>
                          {nameOf(s.project_uuid) ?? t('pomodoro.storico_senza_progetto')}
                        </Text>
                        <Text style={{ color: th.text2, fontSize: 12 }}>
                          {hm(s.start_time)}–{hm(s.end_time)} ·{' '}
                          {s.mode === 1 ? t('pomodoro.cronometro') : t('pomodoro.tipo_pomodoro')} ·{' '}
                          {s.is_manual === 1
                            ? t('pomodoro.storico_badge_manuale')
                            : t('pomodoro.storico_badge_automatica')}
                        </Text>
                      </View>
                      <Text style={{ color: th.text, fontWeight: '600' }}>
                        {human(s.duration_seconds)}
                      </Text>
                    </Pressable>
                  );
                  // trascinata verso destra la riga scopre «Modifica» ed «Elimina» (come sul sito); non mentre si seleziona o si corregge
                  if (selecting || draft) return rowEl;
                  return (
                    <ActionSwipe
                      key={s.uuid}
                      id={s.uuid}
                      open={swiped === s.uuid}
                      onOpenChange={(o) => setSwiped(o ? s.uuid : null)}
                      actions={[
                        {
                          key: 'edit',
                          color: th.brand,
                          label: t('comune.modifica'),
                          icon: (
                            <Svg width={18} height={18} viewBox="0 0 24 24">
                              <Path
                                d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"
                                stroke="#fff"
                                strokeWidth={2.1}
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </Svg>
                          ),
                          run: () => open(s),
                        },
                        {
                          key: 'delete',
                          color: th.red,
                          label: t('comune.elimina'),
                          icon: <TrashIcon size={18} />,
                          run: () => setRowDelete(s.uuid),
                        },
                      ]}
                    >
                      {rowEl}
                    </ActionSwipe>
                  );
                })}
              </Card>
            </View>
          ))
        )}
        {data.more ? (
          <TextButton
            testID="hist-more"
            label={t('pomodoro.storico_carica_altri')}
            onPress={() => setPages(pages + 1)}
          />
        ) : null}
      </ScrollView>
      {exporting ? (
        <ChoiceSheet
          testID="export-choice"
          accent={th.brand}
          title={t('pomodoro.ph_esporta')}
          text={t('import.formati')}
          options={[
            { key: 'xlsx', label: 'Excel (.xlsx)', icon: 'down', primary: true },
            { key: 'csv', label: 'CSV (.csv)', icon: 'down' },
          ]}
          onChoose={(k) => (k === 'xlsx' || k === 'csv' ? void exportFile(k) : setExporting(false))}
        />
      ) : null}
      {rowDelete ? (
        <ChoiceSheet
          testID="row-delete-choice"
          accent={th.brand}
          title={t('pomodoro.scarta_titolo')}
          text={t('pomodoro.scarta_testo')}
          options={[
            { key: 'cancel', label: t('comune.annulla'), icon: 'back', primary: true },
            { key: 'yes', label: t('pomodoro.scarta_si'), icon: 'trash' },
          ]}
          onChoose={(k) => {
            if (k === 'yes') {
              services.pomodoro.removeMany([rowDelete]);
              changed();
            }
            setRowDelete(null);
          }}
        />
      ) : null}
    </View>
  );
}
