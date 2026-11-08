import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Circle } from 'react-native-svg';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { dayOfMonth, monthOf, weekdayOf } from '@/features/planner/dates';
import { human, type Session } from '@/features/pomodoro/logic';
import type { HistoryFilter } from '@/features/pomodoro/repo';
import { ProjectPicker } from '@/features/projects/ProjectPicker';
import { subtreeIds } from '@/features/projects/logic';
import { localToday } from '@/features/tasks/groups';
import { DateTimeField } from '@/ui/DateTimeField';
import { Card, Header, PrimaryButton, SectionLabel, TextButton } from '@/ui/kit';

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
  const [pages, setPages] = useState(1);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftPick, setDraftPick] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bulkPick, setBulkPick] = useState(false);

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

  const chip = (label: string, on: boolean, onPress: () => void, testID: string) => (
    <Pressable
      key={testID}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: on ? th.brand : th.surface,
        borderWidth: 1,
        borderColor: on ? th.brand : th.hairline2,
      }}
    >
      <Text style={{ color: on ? '#fff' : th.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        top={insets.top}
        title={t('pomodoro.storico')}
        right={
          <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
            <Pressable
              testID="hist-select"
              accessibilityRole="button"
              accessibilityLabel={t('pomodoro.ph_seleziona')}
              onPress={() => (selecting ? stopSelecting() : setSelecting(true))}
            >
              <Text style={{ color: th.brand, fontSize: 17 }}>{selecting ? '✓' : '☐'}</Text>
            </Pressable>
            <Pressable
              testID="hist-import"
              accessibilityRole="button"
              accessibilityLabel={t('import.importa')}
              onPress={() => router.push('/pomodoro-import')}
            >
              <Text style={{ color: th.brand, fontSize: 17 }}>⇩</Text>
            </Pressable>
            <Pressable
              testID="hist-add"
              accessibilityRole="button"
              accessibilityLabel={t('pomodoro.ph_aggiungi_manuale')}
              onPress={() => open(null)}
            >
              <Text style={{ color: th.brand, fontSize: 22 }}>+</Text>
            </Pressable>
            <Pressable
              testID="hist-close"
              accessibilityRole="button"
              accessibilityLabel={t('comune.chiudi')}
              onPress={() => router.back()}
            >
              <Text style={{ color: th.brand, fontSize: 17 }}>✕</Text>
            </Pressable>
          </View>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        {draft ? (
          <Card style={{ padding: 16, gap: 12 }}>
            <Text style={{ color: th.text, fontWeight: '700', fontSize: 17 }}>
              {draft.uuid
                ? t('pomodoro.storico_modifica_titolo')
                : t('pomodoro.ph_aggiungi_manuale')}
            </Text>
            {!draft.uuid ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {chip(
                  t('pomodoro.timer'),
                  draft.mode === 0,
                  () => setDraft({ ...draft, mode: 0 }),
                  'draft-mode-0',
                )}
                {chip(
                  t('pomodoro.cronometro'),
                  draft.mode === 1,
                  () => setDraft({ ...draft, mode: 1 }),
                  'draft-mode-1',
                )}
              </View>
            ) : null}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: th.text2 }}>{t('pomodoro.storico_dal')}</Text>
              <DateTimeField
                kind="date"
                testID="draft-day"
                value={draft.day}
                fallback={today}
                onChange={(v) => v && setDraft({ ...draft, day: v })}
              />
            </View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: th.text2 }}>{t('pomodoro.storico_inizio')}</Text>
              <DateTimeField
                kind="time"
                testID="draft-from"
                value={draft.from}
                fallback="09:00"
                onChange={(v) => v && setDraft({ ...draft, from: v })}
              />
            </View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: th.text2 }}>{t('pomodoro.storico_fine')}</Text>
              <DateTimeField
                kind="time"
                testID="draft-to"
                value={draft.to}
                fallback="09:25"
                onChange={(v) => v && setDraft({ ...draft, to: v })}
              />
            </View>
            <Pressable
              testID="draft-project"
              accessibilityRole="button"
              onPress={() => setDraftPick(!draftPick)}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: th.text2 }}>{t('pomodoro.storico_progetto_opz')}</Text>
              <Text style={{ color: th.brand }}>
                {nameOf(draft.project) ?? t('pomodoro.storico_nessun_progetto')} ›
              </Text>
            </Pressable>
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
            <PrimaryButton
              testID="draft-save"
              label={
                draft.uuid
                  ? t('pomodoro.storico_salva_modifica')
                  : t('pomodoro.storico_salva_sessione')
              }
              onPress={save}
            />
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
            ) : null}
            <TextButton testID="draft-cancel" label="✕" onPress={() => setDraft(null)} />
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
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 70 }}>
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
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
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

        <Card style={{ padding: 14, gap: 10 }}>
          <Pressable
            testID="hist-filter-project"
            accessibilityRole="button"
            onPress={() => setPickFilter(!pickFilter)}
            style={{ flexDirection: 'row', justifyContent: 'space-between' }}
          >
            <Text style={{ color: th.text2 }}>{t('pomodoro.storico_filtra_progetto')}</Text>
            <Text style={{ color: th.brand }}>{filterName} ›</Text>
          </Pressable>
          {pickFilter ? (
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
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Text style={{ color: th.text2 }}>{t('pomodoro.storico_dal')}</Text>
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
          </View>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Text style={{ color: th.text2 }}>→</Text>
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
          </View>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text style={{ color: th.text2 }}>≥ min</Text>
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
              style={{
                minWidth: 70,
                textAlign: 'right',
                color: th.text,
                backgroundColor: th.surface2,
                borderRadius: 10,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {chip(
              t('pomodoro.storico_recenti'),
              sort === 'recent',
              () => setSort('recent'),
              'sort-recent',
            )}
            {chip(
              t('pomodoro.storico_vecchi'),
              sort === 'oldest',
              () => setSort('oldest'),
              'sort-oldest',
            )}
            {chip(
              t('pomodoro.durata'),
              sort === 'duration',
              () => setSort('duration'),
              'sort-duration',
            )}
          </View>
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
              label={t('pomodoro.storico_azzera')}
              onPress={() => {
                setFrom('');
                setTo('');
                setMinText('');
                setProjectFilter('all');
                setPages(1);
              }}
            />
          ) : null}
        </Card>

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
                  return (
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
    </View>
  );
}
