import { useRouter } from 'expo-router';
import { Fragment, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { human } from '@/features/pomodoro/logic';
import { localToday } from '@/features/tasks/groups';
import { useFloatingDock } from '@/features/plan/dockHost';
import { haptic } from '@/ui/motion';
import { TextButton } from '@/ui/kit';

import { ActionSwipe } from '@/ui/ActionSwipe';
import { AddInput } from './AddInput';
import { projectSwipeActions } from './swipeActions';
import { DragItem } from './DragItem';
import { PjIcon, StatusRing } from './PjIcons';
import { Lab, ListCard, RowLine } from './PjParts';
import { BulkDialogs, type BulkAction } from './BulkDialogs';
import { SubSelectBar } from './SubSelectBar';
import { lockedIds, toggleAll, toggleSelection } from './selection';
import { RowDialogs, type RowAction } from './RowDialogs';
import type { SubView } from './options';
import { subtreeIds, type Project, type TreeRow } from './logic';
import { dateLabel, shortDate } from './pjFormat';
import type { ProjectsRepo } from './repo';
import { GRAB_MS, type DropPlan } from './dragLogic';
import { useRowDrag } from './useRowDrag';

/**
 * Il blocco «Sotto-progetti» della scheda di un progetto (progetti.php): l'elenco con il pallino di stato, la data e il
 * tasto del Pomodoro, la griglia a schede, la selezione multipla (colore, sposta, elimina insieme) e in fondo
 * «Aggiungi un sotto-progetto».
 */
export function SubProjects(p: {
  repo: ProjectsRepo;
  all: Project[];
  /** il progetto aperto: i suoi figli sono le righe */
  parent: Project;
  /** le righe, già in ordine e con i rami chiusi tolti (profondità 0 = figli diretti) */
  rows: TreeRow[];
  collapsed: ReadonlySet<string>;
  onToggleBranch: (uuid: string) => void;
  /** apre o chiude tutti i rami insieme (il tasto con le frecce del sito, `prFoldAll`) */
  onFoldAll?: (ids: string[], collapse: boolean) => void;
  swatches: string[];
  onOpen: (project: Project) => void;
  onStart: (project: Project) => void;
  onCycle: (uuid: string) => void;
  /** crea un sotto-progetto (di `parent`, se dato: «Aggiungi dentro» di una riga) */
  onAdd: (name: string, parent?: string) => boolean;
  changed: () => void;
  /** il tempo di lavoro di ogni progetto, sotto-progetti compresi */
  totals?: ReadonlyMap<string, number>;
  view?: SubView;
  onView?: (view: SubView) => void;
  showTags: boolean;
  /** l'ordine scelto è «manuale»: solo allora una riga si può spostare fra i fratelli */
  canReorder?: boolean;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const today = localToday();
  const kids = p.all.filter((x) => x.parent_uuid === p.parent.uuid);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [action, setAction] = useState<BulkAction>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  // lo scorrimento della riga: quale è aperta, a chi si sta aggiungendo, e cosa si sposta/elimina
  const [swiped, setSwiped] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [rowAction, setRowAction] = useState<RowAction>(null);
  const grid = (p.view ?? 'list') === 'grid' && !selecting;
  const router = useRouter();
  const accent = p.parent.color;
  const addSub = useMemo(
    () => new Set(addingTo ? subtreeIds(p.all, addingTo) : []),
    [p.all, addingTo],
  );

  // tenere premuta una riga e trascinarla: fra i fratelli cambia posto, sopra un progetto ci entra
  const parentOf = useMemo(() => new Map(p.all.map((x) => [x.uuid, x.parent_uuid])), [p.all]);
  const [notice, setNotice] = useState<{ text: string; undo: () => void } | null>(null);
  const dropped = (id: string, plan: DropPlan) => {
    const me = p.all.find((x) => x.uuid === id);
    if (!me) return;
    if (plan.kind === 'nest') {
      const was = me.parent_uuid;
      if (!p.repo.move(id, plan.id)) return;
      const dest = plan.name ?? p.all.find((x) => x.uuid === plan.id)?.name ?? '';
      const text =
        plan.id === p.parent.uuid
          ? t('progetti.spostato_primo_livello', { nome: me.name })
          : t('progetti.spostato_dentro', { nome: me.name, dove: dest });
      const note = {
        text,
        undo: () => {
          p.repo.move(id, was);
          setNotice(null);
          p.changed();
        },
      };
      setNotice(note);
      setTimeout(() => setNotice((cur) => (cur === note ? null : cur)), 6000);
      p.changed();
      return;
    }
    if (plan.kind === 'slot') {
      const all = p.rows.filter((r) => r.project.parent_uuid === me.parent_uuid);
      const sibs = all.filter((r) => r.project.uuid !== id).map((r) => r.project.uuid);
      if (plan.index === all.findIndex((r) => r.project.uuid === id)) return;
      p.repo.reorder(id, sibs[plan.index - 1] ?? null, sibs[plan.index] ?? null);
      p.changed();
    }
  };
  const drag = useRowDrag({
    rows: p.rows.map((r) => ({ id: r.project.uuid, parent: r.project.parent_uuid })),
    parentOf,
    canReorder: p.canReorder ?? true,
    onDrop: dropped,
  });
  const nestName =
    drag.ui.plan.kind === 'nest'
      ? (drag.ui.plan.name ??
        p.all.find((x) => x.uuid === (drag.ui.plan as { id: string }).id)?.name ??
        '')
      : null;
  const caption =
    drag.ui.plan.kind !== 'nest'
      ? null
      : drag.ui.plan.id === p.parent.uuid
        ? t('progetti.drop_primo_livello')
        : t('progetti.drop_dentro', { nome: nestName ?? '' });

  const stop = () => {
    setSelecting(false);
    setPicked([]);
    setAction(null);
    setHint(null);
  };
  // le righe spuntate perché è scelto un loro padre: si vedono scelte ma non si toccano
  const locked = lockedIds(p.all, picked);
  const toggle = (uuid: string) => {
    const next = toggleSelection(p.all, picked, uuid);
    if (!next) {
      haptic.tap();
      return;
    }
    haptic.select();
    setHint(null);
    setPicked(next);
  };
  const done = () => {
    stop();
    p.changed();
  };
  const bulk = (which: Exclude<BulkAction, null>) => {
    if (!picked.length) {
      setHint(t('progetti.seleziona_almeno_un_sotto'));
      return;
    }
    setAction(which);
  };
  const submit = () => {
    if (p.onAdd(draft, addingTo ?? undefined)) {
      setDraft('');
      setAdding(false);
      setAddingTo(null);
    }
  };
  const addInside = (id: string) => {
    if (p.collapsed.has(id)) p.onToggleBranch(id);
    setAdding(false);
    setDraft('');
    setAddingTo(id);
  };

  // i rami che hanno dei figli, a ogni livello: il tasto con le frecce li apre o li chiude tutti insieme
  const branchIds = subtreeIds(p.all, p.parent.uuid).filter(
    (id) => id !== p.parent.uuid && p.all.some((x) => x.parent_uuid === id),
  );
  const anyOpen = branchIds.some((id) => !p.collapsed.has(id));

  // la barra della selezione sta ferma in basso (come .pr-sub-bulkbar): si consegna allo scaffale della schermata
  useFloatingDock(
    selecting ? (
      <SubSelectBar
        count={picked.length}
        hint={hint}
        onClose={stop}
        onAll={() => {
          setHint(null);
          setPicked(
            toggleAll(
              picked,
              kids.map((k) => k.uuid),
            ),
          );
        }}
        onAction={bulk}
      />
    ) : null,
  );

  return (
    <View>
      <View ref={(v) => drag.attachZone(p.parent.uuid, p.parent.name)(v)} collapsable={false}>
        <Lab
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              {kids.length >= 2 ? (
                <Pressable
                  testID="sub-select-toggle"
                  accessibilityRole="button"
                  accessibilityLabel={
                    selecting ? t('comune.annulla') : t('progetti.seleziona_sotto_progetti')
                  }
                  accessibilityState={{ selected: selecting }}
                  onPress={() => (selecting ? stop() : setSelecting(true))}
                  hitSlop={4}
                  style={labTool(selecting ? th.blue : null)}
                >
                  <PjIcon name="select" color={selecting ? th.blue : th.text3} size={17} />
                </Pressable>
              ) : null}
              {p.onView && kids.length && !selecting ? (
                <Pressable
                  testID="sub-view-toggle"
                  accessibilityRole="button"
                  accessibilityLabel={
                    grid ? t('progetti.mostra_elenco') : t('progetti.mostra_griglia')
                  }
                  onPress={() => p.onView?.(grid ? 'list' : 'grid')}
                  hitSlop={4}
                  style={labTool(grid ? accent : null)}
                >
                  <PjIcon name={grid ? 'list' : 'grid'} color={th.text3} size={17} />
                </Pressable>
              ) : null}
              {p.onFoldAll && !grid && !selecting && branchIds.length ? (
                <Pressable
                  testID="sub-fold-all"
                  accessibilityRole="button"
                  accessibilityLabel={
                    anyOpen ? t('progetti.chiudi_tutto') : t('progetti.apri_tutto')
                  }
                  onPress={() => p.onFoldAll?.(branchIds, anyOpen)}
                  hitSlop={4}
                  style={labTool(null)}
                >
                  <PjIcon name={anyOpen ? 'fold' : 'unfold'} color={th.text3} size={17} />
                </Pressable>
              ) : null}
            </View>
          }
        >
          {t('progetti.sotto_progetti')}
        </Lab>
      </View>

      {grid ? (
        <View testID="sub-grid" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {kids.map((k) => (
            <GridCard
              key={k.uuid}
              kid={k}
              all={p.all}
              secs={p.totals?.get(k.uuid) ?? 0}
              onOpen={() => p.onOpen(k)}
            />
          ))}
          <Pressable
            testID="proj-sub-add-line"
            accessibilityRole="button"
            onPress={() => setAdding(true)}
            style={{
              flexBasis: '100%',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              padding: 8,
            }}
          >
            <PjIcon name="plus" color={accent} size={20} width={2} />
            <Text style={{ color: accent, fontSize: 15.5, fontWeight: '500' }}>
              {t('progetti.aggiungi_un_sotto')}
            </Text>
          </Pressable>
          {adding ? (
            <AddInput
              draft={draft}
              onDraft={setDraft}
              onSubmit={submit}
              onCancel={() => setAdding(false)}
              accent={accent}
            />
          ) : null}
        </View>
      ) : (
        <ListCard style={drag.ui.active ? { overflow: 'visible' } : undefined}>
          <View
            testID="sub-rows"
            ref={(v) => drag.attach(v)}
            collapsable={false}
            {...drag.panHandlers}
          >
            {p.rows.map((r, i) => {
              const k = r.project;
              const on = picked.includes(k.uuid);
              const isLocked = locked.has(k.uuid);
              const closed = p.collapsed.has(k.uuid);
              const doneRow = k.status === 'completed';
              const secs = p.totals?.get(k.uuid) ?? 0;
              const meta = p.showTags
                ? [
                    r.total ? t('progetti.n_di_m', { n: r.done, m: r.total }) : '',
                    dateLabel(k, t, today),
                    secs ? t('progetti.tempo_concentrazione', { t: human(secs) }) : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : '';
              // «Aggiungi dentro»: il campo compare dopo l'ultima riga del ramo, un livello più in dentro
              const inAdd = addingTo ? addSub.has(k.uuid) : false;
              const next = p.rows[i + 1];
              const addHere = inAdd && !(next && addSub.has(next.project.uuid));
              const addDepth = addingTo
                ? (p.rows.find((x) => x.project.uuid === addingTo)?.depth ?? 0) + 1
                : 0;
              return (
                <Fragment key={k.uuid}>
                  <DragItem
                    id={k.uuid}
                    drag={drag}
                    caption={drag.ui.active === k.uuid ? caption : null}
                  >
                    {i ? <RowLine inset={74 + r.depth * 22} /> : null}
                    <ActionSwipe
                      id={k.uuid}
                      open={swiped === k.uuid}
                      disabled={selecting || drag.ui.active !== null}
                      onOpenChange={(on) => setSwiped(on ? k.uuid : null)}
                      actions={projectSwipeActions({
                        t,
                        red: th.red,
                        onAdd: () => addInside(k.uuid),
                        onMove: () => setRowAction({ kind: 'move', id: k.uuid }),
                        onDelete: () => setRowAction({ kind: 'delete', id: k.uuid }),
                      })}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          minHeight: 54,
                          paddingVertical: 8,
                          paddingRight: 8,
                          paddingLeft: r.depth * 22,
                          backgroundColor: on ? `${th.blue}12` : undefined,
                          opacity: isLocked ? 0.85 : 1,
                        }}
                      >
                        <View style={{ width: 40, alignItems: 'center' }}>
                          {r.hasChildren ? (
                            <Pressable
                              testID={`proj-toggle-${k.uuid}`}
                              accessibilityRole="button"
                              accessibilityLabel={t('progetti.apri_chiudi_sotto')}
                              accessibilityState={{ expanded: !closed }}
                              hitSlop={8}
                              onPress={() => p.onToggleBranch(k.uuid)}
                              style={{ padding: 6 }}
                            >
                              <View style={{ transform: [{ rotate: closed ? '0deg' : '90deg' }] }}>
                                <PjIcon name="chevron" color={th.text3} size={15} />
                              </View>
                            </Pressable>
                          ) : null}
                        </View>
                        {selecting ? (
                          <Pressable
                            testID={`kid-${k.uuid}`}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: on || isLocked, disabled: isLocked }}
                            onPress={() => toggle(k.uuid)}
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                          >
                            <View
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 11,
                                borderWidth: 2,
                                borderColor: on
                                  ? th.blue
                                  : isLocked
                                    ? `${th.blue}73`
                                    : th.hairline2,
                                backgroundColor: on
                                  ? th.blue
                                  : isLocked
                                    ? `${th.blue}73`
                                    : 'transparent',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {on || isLocked ? (
                                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>
                                  ✓
                                </Text>
                              ) : null}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text
                                style={{
                                  color: doneRow ? th.text3 : th.text,
                                  fontSize: 16,
                                  fontWeight: '500',
                                  textDecorationLine: doneRow ? 'line-through' : 'none',
                                }}
                              >
                                {k.name}
                              </Text>
                              {meta ? (
                                <Text style={{ color: th.text2, fontSize: 12.5, marginTop: 1 }}>
                                  {meta}
                                </Text>
                              ) : null}
                            </View>
                          </Pressable>
                        ) : (
                          <>
                            <Pressable
                              testID={`proj-status-${k.uuid}`}
                              accessibilityRole="checkbox"
                              accessibilityLabel={t('progetti.cambia_stato')}
                              accessibilityState={{ checked: doneRow }}
                              hitSlop={8}
                              onPress={() => p.onCycle(k.uuid)}
                            >
                              <StatusRing status={k.status} color={k.color} size={24} />
                            </Pressable>
                            <Pressable
                              testID={`kid-${k.uuid}`}
                              accessibilityRole="button"
                              onPress={() => p.onOpen(k)}
                              delayLongPress={GRAB_MS}
                              onLongPress={() => drag.grab(k.uuid)}
                              onPressOut={drag.release}
                              style={{ flex: 1, marginLeft: 10, paddingVertical: 2 }}
                            >
                              <Text
                                style={{
                                  color: doneRow ? th.text3 : th.text,
                                  fontSize: 16,
                                  fontWeight: '500',
                                  textDecorationLine: doneRow ? 'line-through' : 'none',
                                }}
                              >
                                {k.name}
                              </Text>
                              {meta ? (
                                <Text style={{ color: th.text2, fontSize: 12.5, marginTop: 1 }}>
                                  {meta}
                                </Text>
                              ) : null}
                            </Pressable>
                            <Pressable
                              testID={`proj-start-${k.uuid}`}
                              accessibilityRole="button"
                              accessibilityLabel={t('progetti.concentrati')}
                              hitSlop={6}
                              onPress={() => p.onStart(k)}
                              style={{
                                width: 34,
                                height: 32,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <PjIcon name="timer" color={th.text3} size={19} />
                            </Pressable>
                          </>
                        )}
                      </View>
                    </ActionSwipe>
                  </DragItem>
                  {addHere ? (
                    <View style={{ paddingLeft: addDepth * 22 + 14 }}>
                      <AddInput
                        draft={draft}
                        onDraft={setDraft}
                        onSubmit={submit}
                        onCancel={() => setAddingTo(null)}
                        accent={accent}
                        inCard
                      />
                    </View>
                  ) : null}
                </Fragment>
              );
            })}
          </View>
          {p.rows.length ? <RowLine inset={0} /> : null}
          {adding ? (
            <AddInput
              draft={draft}
              onDraft={setDraft}
              onSubmit={submit}
              onCancel={() => setAdding(false)}
              accent={accent}
              inCard
            />
          ) : selecting ? null : (
            <Pressable
              testID="proj-sub-add-line"
              accessibilityRole="button"
              onPress={() => setAdding(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 9,
                paddingVertical: 14,
                paddingLeft: 39,
                paddingRight: 14,
                minHeight: 50,
              }}
            >
              <View style={{ width: 26, alignItems: 'center' }}>
                <PjIcon name="plus" color={accent} size={22} width={2} />
              </View>
              <Text style={{ color: accent, fontSize: 15.5, fontWeight: '500' }}>
                {t('progetti.aggiungi_un_sotto')}
              </Text>
            </Pressable>
          )}
        </ListCard>
      )}

      <RowDialogs
        repo={p.repo}
        all={p.all}
        action={rowAction}
        onClose={() => setRowAction(null)}
        changed={p.changed}
      />

      {notice ? (
        <View
          testID="sub-notice"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginTop: 10,
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 14,
            backgroundColor: th.surface2,
          }}
        >
          <Text style={{ color: th.text, fontSize: 14, flex: 1 }}>{notice.text}</Text>
          <TextButton
            testID="sub-notice-undo"
            label={t('progetti.nota_annulla')}
            onPress={notice.undo}
          />
        </View>
      ) : null}

      {selecting ? <View style={{ height: 84 }} /> : null}
      <BulkDialogs
        repo={p.repo}
        all={p.all}
        picked={picked}
        action={action}
        swatches={p.swatches}
        onClose={() => setAction(null)}
        onDone={done}
        onGoPomodoros={() =>
          router.push({
            pathname: '/pomodoro-history',
            params: { project: picked.length === 1 ? (picked[0] ?? p.parent.uuid) : p.parent.uuid },
          })
        }
      />
    </View>
  );
}

/** I tasti piccoli accanto al titoletto (.pr-lab-btn): 32 per 32, accesi con una tinta leggera dell'accento. */
const labTool = (on: string | null) => ({
  width: 32,
  height: 32,
  borderRadius: 10,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  backgroundColor: on ? `${on}22` : 'transparent',
});

/** Una scheda della griglia (pr-grid-card del sito): pallino col colore, nome, scadenza, barra dei sotto-progetti fatti, tempo. */
function GridCard(p: { kid: Project; all: Project[]; secs: number; onOpen: () => void }) {
  const th = useTheme();
  const { t } = useTranslation();
  const k = p.kid;
  const today = localToday();
  const children = p.all.filter((x) => x.parent_uuid === k.uuid);
  const total = children.length;
  const done = children.filter((x) => x.status === 'completed').length;
  const closed = k.status === 'completed';
  const dates = [
    k.due_date ? t('progetti.meta_scadenza', { d: shortDate(k.due_date, t, today) }) : null,
    k.target_date ? t('progetti.meta_obiettivo', { d: shortDate(k.target_date, t, today) }) : null,
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
        backgroundColor: th.surface,
        borderWidth: 0.5,
        borderColor: th.hairline,
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
          style={{ height: 4, borderRadius: 2, backgroundColor: th.surface2, overflow: 'hidden' }}
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
