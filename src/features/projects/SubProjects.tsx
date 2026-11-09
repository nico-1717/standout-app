import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { PrimaryButton, TextButton } from '@/ui/kit';

import { dayOfMonth, monthOf } from '@/features/planner/dates';
import { human } from '@/features/pomodoro/logic';

import { ProjectPicker } from './ProjectPicker';
import type { SubView } from './options';
import { subtreeIds, type Project } from './logic';
import type { ProjectsRepo } from './repo';

type Panel = 'color' | 'parent' | 'delete' | null;

/**
 * L'elenco dei sotto-progetti nella scheda di un progetto, con la selezione multipla del sito: si scelgono più
 * sotto-progetti e si cambia il colore, si spostano sotto un altro progetto o si eliminano tutti insieme.
 */
export function SubProjects(p: {
  repo: ProjectsRepo;
  all: Project[];
  kids: Project[];
  swatches: string[];
  onOpen: (project: Project) => void;
  changed: () => void;
  /** il tempo di lavoro di ogni progetto, sotto-progetti compresi */
  totals?: ReadonlyMap<string, number>;
  view?: SubView;
  onView?: (view: SubView) => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const grid = (p.view ?? 'list') === 'grid' && !selecting;

  const stop = () => {
    setSelecting(false);
    setPicked([]);
    setPanel(null);
  };
  const toggle = (uuid: string) =>
    setPicked((cur) => (cur.includes(uuid) ? cur.filter((x) => x !== uuid) : [...cur, uuid]));
  const allOn = picked.length === p.kids.length && p.kids.length > 0;
  const done = () => {
    stop();
    p.changed();
  };
  const open = (which: Panel) => {
    if (!picked.length) return;
    setPanel(panel === which ? null : which);
  };

  if (!p.kids.length) return null;

  const subtree = picked.flatMap((id) => subtreeIds(p.all, id));
  const sessions = panel === 'delete' ? p.repo.sessionCount(subtree) : 0;
  const hasChildren = picked.some((id) => p.all.some((x) => x.parent_uuid === id));
  const targets = p.all.filter((x) => !subtree.includes(x.uuid));
  const remove = (withSessions: boolean) => {
    for (const id of picked) p.repo.remove(id, withSessions);
    done();
  };

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pressable
          testID="sub-select-toggle"
          accessibilityRole="button"
          onPress={() => (selecting ? stop() : setSelecting(true))}
        >
          <Text style={{ color: th.brand }}>
            {selecting ? t('comune.annulla') : t('progetti.seleziona_sotto_progetti')}
          </Text>
        </Pressable>
        {p.onView && !selecting ? (
          <Pressable
            testID="sub-view-toggle"
            accessibilityRole="button"
            accessibilityLabel={grid ? t('progetti.mostra_elenco') : t('progetti.mostra_griglia')}
            onPress={() => p.onView?.(grid ? 'list' : 'grid')}
            hitSlop={10}
          >
            <Text style={{ color: th.brand, fontSize: 18 }}>{grid ? '☰' : '▦'}</Text>
          </Pressable>
        ) : null}
      </View>

      {grid ? (
        <View testID="sub-grid" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {p.kids.map((k) => (
            <GridCard
              key={k.uuid}
              kid={k}
              all={p.all}
              secs={p.totals?.get(k.uuid) ?? 0}
              onOpen={() => p.onOpen(k)}
            />
          ))}
        </View>
      ) : (
        p.kids.map((k) => {
          const on = picked.includes(k.uuid);
          return (
            <Pressable
              key={k.uuid}
              testID={`kid-${k.uuid}`}
              accessibilityRole={selecting ? 'checkbox' : 'button'}
              accessibilityState={selecting ? { checked: on } : undefined}
              onPress={() => (selecting ? toggle(k.uuid) : p.onOpen(k))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}
            >
              {selecting ? (
                <Text style={{ color: on ? th.brand : th.text2, fontSize: 20 }}>
                  {on ? '☑' : '☐'}
                </Text>
              ) : null}
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: k.color }} />
              <Text style={{ color: th.text, flex: 1 }}>{k.name}</Text>
              {selecting ? null : <Text style={{ color: th.text3 }}>›</Text>}
            </Pressable>
          );
        })
      )}

      {selecting ? (
        <View style={{ gap: 10 }}>
          <Text testID="sub-count" style={{ color: th.text2 }}>
            {picked.length === 0
              ? t('progetti.0_selezionati')
              : t(picked.length === 1 ? 'progetti.n_selezionato' : 'progetti.n_selezionati', {
                  n: picked.length,
                })}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            <TextButton
              testID="sub-all"
              label={allOn ? t('progetti.deseleziona_tutti') : t('progetti.seleziona_tutti')}
              onPress={() => setPicked(allOn ? [] : p.kids.map((k) => k.uuid))}
            />
            <TextButton
              testID="sub-bulk-color"
              label={t('progetti.colore')}
              onPress={() => open('color')}
            />
            <TextButton
              testID="sub-bulk-parent"
              label={t('progetti.progetto_padre')}
              onPress={() => open('parent')}
            />
            <TextButton
              testID="sub-bulk-delete"
              danger
              label={t('comune.elimina')}
              onPress={() => open('delete')}
            />
          </View>

          {panel === 'color' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <Pressable
                hitSlop={5}
                testID="sub-color-auto"
                accessibilityRole="button"
                accessibilityLabel={t('progetti.colore_auto_padre')}
                onPress={() => {
                  for (const id of picked) p.repo.update(id, { color: null });
                  done();
                }}
                style={{
                  height: 34,
                  borderRadius: 17,
                  paddingHorizontal: 12,
                  justifyContent: 'center',
                  backgroundColor: th.surface2,
                }}
              >
                <Text style={{ color: th.text }}>{t('progetti.colore_auto_padre')}</Text>
              </Pressable>
              {p.swatches.map((c) => (
                <Pressable
                  hitSlop={5}
                  key={c}
                  testID={`sub-color-${c.slice(1)}`}
                  accessibilityRole="button"
                  onPress={() => {
                    for (const id of picked) p.repo.update(id, { color: c });
                    done();
                  }}
                  style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c }}
                />
              ))}
            </View>
          ) : null}

          {panel === 'parent' ? (
            <ProjectPicker
              projects={targets}
              value="none"
              hideNone
              extras={[{ id: 'root', label: t('progetti.livello_principale') }]}
              onPick={(target) => {
                const to = target === 'root' || !target ? null : target;
                for (const id of picked) p.repo.move(id, to);
                done();
              }}
            />
          ) : null}

          {panel === 'delete' ? (
            <View style={{ gap: 10 }}>
              <Text style={{ color: th.text, fontWeight: '700', fontSize: 17 }}>
                {picked.length === 1
                  ? t('progetti.eliminare_n_sotto_1')
                  : t('progetti.eliminare_n_sotto', { n: picked.length })}
              </Text>
              <Text style={{ color: th.text2 }}>
                {hasChildren ? t('progetti.alcuni_hanno_sotto') : ''}
                {sessions ? t('progetti.eliminare_anche_pomodori') : ''}
                {!sessions ? t('progetti.questa_azione_non_puo_essere') : ''}
              </Text>
              {sessions ? (
                <>
                  <PrimaryButton
                    testID="sub-del-all"
                    danger
                    label={t('progetti.elimina_anche_pomodori')}
                    onPress={() => remove(true)}
                  />
                  <PrimaryButton
                    testID="sub-del-keep"
                    danger
                    label={t('progetti.mantieni_pomodori')}
                    onPress={() => remove(false)}
                  />
                </>
              ) : (
                <PrimaryButton
                  testID="sub-del-yes"
                  danger
                  label={t('comune.elimina')}
                  onPress={() => remove(false)}
                />
              )}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Una scheda della griglia (pr-grid-card del sito): pallino col colore, nome, scadenza, barra dei sotto-progetti fatti, tempo. */
function GridCard(p: { kid: Project; all: Project[]; secs: number; onOpen: () => void }) {
  const th = useTheme();
  const { t } = useTranslation();
  const k = p.kid;
  const children = p.all.filter((x) => x.parent_uuid === k.uuid);
  const total = children.length;
  const done = children.filter((x) => x.status === 'completed').length;
  const closed = k.status === 'completed';
  const short = (d: string) => `${dayOfMonth(d)} ${t(`planner.mese_${monthOf(d)}`).toLowerCase()}`;
  const dates = [
    k.due_date ? t('progetti.meta_scadenza', { d: short(k.due_date) }) : null,
    k.target_date ? t('progetti.meta_obiettivo', { d: short(k.target_date) }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      testID={`kid-${k.uuid}`}
      accessibilityRole="button"
      accessibilityLabel={k.name}
      onPress={p.onOpen}
      style={({ pressed }) => ({
        flexBasis: '47%',
        flexGrow: 1,
        minHeight: 124,
        padding: 14,
        gap: 6,
        borderRadius: 16,
        backgroundColor: th.surface2,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', minHeight: 20 }}>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            marginTop: 5,
            backgroundColor: closed ? 'transparent' : k.color,
            borderWidth: closed ? 2 : 0,
            borderColor: k.color,
          }}
        />
        {k.notes ? <Text style={{ color: th.text3, fontSize: 12 }}>📝</Text> : null}
      </View>
      <Text
        numberOfLines={2}
        style={{
          color: closed ? th.text3 : th.text,
          fontSize: 15,
          fontWeight: '600',
          textDecorationLine: closed ? 'line-through' : 'none',
        }}
      >
        {k.name}
      </Text>
      {dates ? (
        <Text numberOfLines={2} style={{ color: th.text2, fontSize: 12 }}>
          {dates}
        </Text>
      ) : null}
      <View style={{ flex: 1 }} />
      {total > 0 ? (
        <View
          testID={`kid-bar-${k.uuid}`}
          style={{ height: 4, borderRadius: 2, backgroundColor: th.bg, overflow: 'hidden' }}
        >
          <View
            style={{
              height: 4,
              width: `${Math.round((done * 100) / total)}%`,
              backgroundColor: k.color,
            }}
          />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: th.text2, fontSize: 12 }}>{p.secs ? human(p.secs) : '–'}</Text>
        {total > 0 ? (
          <Text style={{ color: th.text2, fontSize: 12 }}>
            {t('progetti.n_di_m', { n: done, m: total })}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
