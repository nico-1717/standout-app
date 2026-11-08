import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme, type Theme } from '@/core/theme/ThemeProvider';
import { dayOfMonth, monthOf } from '@/features/planner/dates';
import { human } from '@/features/pomodoro/logic';
import { flatten, type TreeRow } from '@/features/projects/logic';
import { type ProjectOptions } from '@/features/projects/options';
import type { StatusSnapshot } from '@/features/projects/repo';
import { Card, Header, PrimaryButton, SectionLabel, TextButton } from '@/ui/kit';

const ORDERS: ProjectOptions['ordine'][] = ['manuale', 'alfabetico', 'recenti', 'scadenza'];
const ORDER_KEY = {
  manuale: 'progetti.opz_manuale',
  alfabetico: 'progetti.opz_alfabetico',
  recenti: 'progetti.opz_recenti',
  scadenza: 'progetti.opz_scadenza',
} as const;

function StatusDot({
  status,
  color,
  th,
  onPress,
  testID,
}: {
  status: string;
  color: string;
  th: Theme;
  onPress: () => void;
  testID: string;
}) {
  const done = status === 'completed';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      hitSlop={10}
      onPress={onPress}
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: color,
        borderStyle: status === 'planned' ? 'dashed' : 'solid',
        backgroundColor: done ? color : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {done ? <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>✓</Text> : null}
      {status === 'planned' ? (
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: th.text3 }} />
      ) : null}
    </Pressable>
  );
}

/** I progetti ad albero (progetti.php): stato, preferiti, scadenze, tempo di lavoro, sotto-progetti da aprire e chiudere. */
export default function ProjectsScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services, version, changed } = useApp();

  const [draft, setDraft] = useState('');
  const [addingUnder, setAddingUnder] = useState<string | null>(null);
  const [subDraft, setSubDraft] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [collapsedState, setCollapsedState] = useState<Set<string> | null>(null);
  // lo stato di prima dei figli, per tornare indietro quando si toglie «completato»
  const snapshots = useRef(new Map<string, StatusSnapshot[]>());

  const data = useMemo(() => {
    void version;
    if (!services) return null;
    return {
      all: services.projects.all(),
      opts: services.projectOptions.read(),
      worked: services.projects.worked(),
      totals: services.projects.totals(),
      savedBranches: services.projectOptions.collapsed(),
    };
  }, [services, version]);
  if (!services || !data) return null;
  const { all, opts, totals } = data;

  const parents = new Set(
    all.filter((p) => all.some((c) => c.parent_uuid === p.uuid)).map((p) => p.uuid),
  );
  const collapsed: Set<string> =
    collapsedState ?? (opts.ricorda_rami && data.savedBranches ? data.savedBranches : parents);
  const setCollapsed = (next: Set<string>) => {
    setCollapsedState(next);
    if (opts.ricorda_rami) services.projectOptions.saveCollapsed(next);
  };
  const rows = flatten(all, {
    showCompleted: opts.completati,
    onlyWorked: opts.solo_attivi ? data.worked : null,
    order: opts.ordine,
    collapsed,
  });
  const favorites = all.filter(
    (p) => p.is_favorite && (opts.completati || p.status !== 'completed'),
  );

  const setOpt = (patch: Partial<ProjectOptions>) => {
    services.projectOptions.write(patch);
    changed();
  };
  const add = (parent: string | null, name: string, position: 'first' | 'last' = 'first') => {
    const id = services.projects.create({ name, parent, position });
    if (!id) return false;
    // un sotto-progetto nuovo si deve vedere: il ramo si apre
    if (parent && collapsed.has(parent)) {
      const n = new Set(collapsed);
      n.delete(parent);
      setCollapsed(n);
    }
    changed();
    return true;
  };
  const cycle = (uuid: string) => {
    const r = services.projects.cycleStatus(uuid, snapshots.current.get(uuid));
    if (r) {
      if (r.status === 'completed') snapshots.current.set(uuid, r.snapshot);
      else snapshots.current.delete(uuid);
    }
    changed();
  };
  const shortDate = (d: string) =>
    `${dayOfMonth(d)} ${t(`planner.mese_${monthOf(d)}`).toLowerCase()}`;

  const tags = (r: TreeRow) => {
    const p = r.project;
    const out: string[] = [];
    if (r.total) out.push(t('progetti.n_di_m_fatti', { n: r.done, m: r.total }));
    if (p.due_date) out.push(t('progetti.meta_scadenza', { d: shortDate(p.due_date) }));
    else if (p.target_date) out.push(t('progetti.meta_obiettivo', { d: shortDate(p.target_date) }));
    const secs = totals.get(p.uuid);
    if (secs) out.push(t('progetti.tempo_concentrazione', { t: human(secs) }));
    return out.join(' · ');
  };

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        top={insets.top}
        title={t('progetti.titolo_pagina')}
        right={
          <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
            <Pressable
              testID="proj-plan"
              accessibilityRole="button"
              accessibilityLabel={t('progetti.piano_titolo')}
              onPress={() => router.push('/plan')}
            >
              <Text style={{ color: th.brand, fontSize: 18 }}>🗓</Text>
            </Pressable>
            <Pressable
              testID="proj-options"
              accessibilityRole="button"
              accessibilityLabel={t('progetti.impostazioni')}
              onPress={() => setShowOptions(!showOptions)}
            >
              <Text style={{ color: th.brand, fontSize: 18 }}>⚙︎</Text>
            </Pressable>
            <Pressable testID="proj-close" accessibilityRole="button" onPress={() => router.back()}>
              <Text style={{ color: th.brand, fontSize: 17 }}>✕</Text>
            </Pressable>
          </View>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        {showOptions ? (
          <Card style={{ padding: 16, gap: 12 }}>
            <SectionLabel>{t('progetti.opz_ordine')}</SectionLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {ORDERS.map((o) => (
                <Pressable
                  key={o}
                  testID={`opt-order-${o}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: opts.ordine === o }}
                  onPress={() => setOpt({ ordine: o })}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                    backgroundColor: opts.ordine === o ? th.brand : th.surface2,
                  }}
                >
                  <Text style={{ color: opts.ordine === o ? '#fff' : th.text, fontWeight: '600' }}>
                    {t(ORDER_KEY[o])}
                  </Text>
                </Pressable>
              ))}
            </View>
            {(
              [
                ['completati', 'opz_completati', 'opz_completati_sub'],
                ['mostra_tag', 'opz_tag', 'opz_tag_sub'],
                ['ricorda_rami', 'opz_rami', 'opz_rami_sub'],
                ['solo_attivi', 'opz_attivi', 'opz_attivi_sub'],
              ] as const
            ).map(([key, label, sub]) => (
              <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: th.text, fontWeight: '600' }}>
                    {t(`progetti.${label}`)}
                  </Text>
                  <Text style={{ color: th.text2, fontSize: 12 }}>{t(`progetti.${sub}`)}</Text>
                </View>
                <Switch
                  testID={`opt-${key}`}
                  value={opts[key]}
                  onValueChange={(v) => setOpt({ [key]: v })}
                  trackColor={{ true: th.brand }}
                />
              </View>
            ))}
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <TextButton
                testID="proj-expand"
                label={t('progetti.apri_tutto')}
                onPress={() => setCollapsed(new Set())}
              />
              <TextButton
                testID="proj-collapse"
                label={t('progetti.chiudi_tutto')}
                onPress={() => setCollapsed(new Set(parents))}
              />
            </View>
          </Card>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            testID="proj-new"
            value={draft}
            onChangeText={setDraft}
            placeholder={t('progetti.nome_nuovo_progetto')}
            placeholderTextColor={th.text3}
            returnKeyType="done"
            onSubmitEditing={() => add(null, draft) && setDraft('')}
            style={{
              flex: 1,
              backgroundColor: th.surface,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: th.hairline,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: th.text,
              fontSize: 16,
            }}
          />
          <View style={{ width: 96 }}>
            <PrimaryButton
              testID="proj-new-add"
              label={t('progetti.aggiungi')}
              disabled={!draft.trim()}
              onPress={() => add(null, draft) && setDraft('')}
            />
          </View>
        </View>

        {favorites.length ? (
          <View style={{ gap: 6 }}>
            <SectionLabel>{t('progetti.preferiti')}</SectionLabel>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {favorites.map((p) => (
                <Pressable
                  key={p.uuid}
                  testID={`proj-fav-${p.uuid}`}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/project', params: { id: p.uuid } })}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                    backgroundColor: th.surface,
                    borderWidth: 1,
                    borderColor: th.hairline,
                  }}
                >
                  <View
                    style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: p.color }}
                  />
                  <Text style={{ color: th.text }}>{p.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {all.length === 0 ? (
          <View style={{ padding: 28, alignItems: 'center', gap: 6 }}>
            <Text style={{ color: th.text, fontWeight: '700', fontSize: 17 }}>
              {t('progetti.nessun_progetto_ancora')}
            </Text>
            <Text style={{ color: th.text2, textAlign: 'center' }}>
              {t('progetti.crea_il_tuo_primo_progetto')}
            </Text>
          </View>
        ) : (
          <Card>
            {rows.map((r, i) => {
              const p = r.project;
              const closed = collapsed.has(p.uuid);
              const tag = opts.mostra_tag ? tags(r) : '';
              return (
                <View key={p.uuid}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingVertical: 12,
                      paddingRight: 12,
                      paddingLeft: 12 + r.depth * 20,
                      borderTopWidth: i ? 0.5 : 0,
                      borderTopColor: th.hairline,
                    }}
                  >
                    <Pressable
                      testID={`proj-toggle-${p.uuid}`}
                      accessibilityRole="button"
                      accessibilityLabel={t('progetti.apri_chiudi_sotto')}
                      disabled={!r.hasChildren}
                      hitSlop={8}
                      onPress={() => {
                        const n = new Set(collapsed);
                        if (n.has(p.uuid)) n.delete(p.uuid);
                        else n.add(p.uuid);
                        setCollapsed(n);
                      }}
                      style={{ width: 18, alignItems: 'center' }}
                    >
                      <Text style={{ color: th.text3, fontSize: 12 }}>
                        {r.hasChildren ? (closed ? '▶' : '▼') : ''}
                      </Text>
                    </Pressable>
                    <StatusDot
                      testID={`proj-status-${p.uuid}`}
                      status={p.status}
                      color={p.color}
                      th={th}
                      onPress={() => cycle(p.uuid)}
                    />
                    <Pressable
                      testID={`proj-row-${p.uuid}`}
                      accessibilityRole="button"
                      onPress={() => router.push({ pathname: '/project', params: { id: p.uuid } })}
                      style={{ flex: 1 }}
                    >
                      <Text
                        style={{
                          color: p.status === 'completed' ? th.text2 : th.text,
                          fontSize: 16,
                          fontWeight: '600',
                          textDecorationLine: p.status === 'completed' ? 'line-through' : 'none',
                        }}
                        numberOfLines={2}
                      >
                        {p.name}
                      </Text>
                      {tag ? (
                        <Text style={{ color: th.text2, fontSize: 12, marginTop: 2 }}>{tag}</Text>
                      ) : null}
                    </Pressable>
                    {p.is_favorite ? <Text style={{ color: th.orange }}>★</Text> : null}
                    <Pressable
                      testID={`proj-add-${p.uuid}`}
                      accessibilityRole="button"
                      accessibilityLabel={t('progetti.aggiungi_sotto_progetto_rapido')}
                      hitSlop={8}
                      onPress={() => {
                        setAddingUnder(addingUnder === p.uuid ? null : p.uuid);
                        setSubDraft('');
                      }}
                    >
                      <Text style={{ color: th.brand, fontSize: 22 }}>+</Text>
                    </Pressable>
                  </View>
                  {addingUnder === p.uuid ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        gap: 8,
                        paddingHorizontal: 12,
                        paddingLeft: 52 + r.depth * 20,
                        paddingBottom: 12,
                      }}
                    >
                      <TextInput
                        testID="proj-sub-input"
                        autoFocus
                        value={subDraft}
                        onChangeText={setSubDraft}
                        placeholder={t('progetti.nome_nuovo_sotto')}
                        placeholderTextColor={th.text3}
                        returnKeyType="done"
                        onSubmitEditing={() => {
                          if (add(p.uuid, subDraft)) {
                            setSubDraft('');
                            setAddingUnder(null);
                          }
                        }}
                        style={{
                          flex: 1,
                          backgroundColor: th.surface2,
                          borderRadius: 10,
                          paddingHorizontal: 12,
                          paddingVertical: 9,
                          color: th.text,
                        }}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
