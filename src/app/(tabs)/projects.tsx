import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { DockHost } from '@/features/plan/dockHost';
import { PlanPanel } from '@/features/plan/PlanPanel';
import { ProjectPlanCard } from '@/features/plan/ProjectPlanCard';
import { TrackerTab } from '@/features/tracker/TrackerTab';
import { Crumbs, ProjectsHeader, Seg } from '@/features/projects/PjParts';
import { DropZones, DropZonesContext } from '@/features/projects/DropZones';
import { ProjectHero } from '@/features/projects/ProjectHero';
import { SWATCHES, ProjectMenu } from '@/features/projects/ProjectMenu';
import { DatesSheet, OptionsModal } from '@/features/projects/ProjectSheets';
import { ProjectsAll } from '@/features/projects/ProjectsAll';
import { ScrollBridgeContext, type ScrollBridge } from '@/features/projects/ScrollBridge';
import { SubProjects } from '@/features/projects/SubProjects';
import { ancestors, byId, childrenOf, flatten, subtreeIds } from '@/features/projects/logic';
import type { ProjectOptions } from '@/features/projects/options';
import type { StatusSnapshot } from '@/features/projects/repo';

type AllTab = 'list' | 'cal';
type ProjectTab = 'list' | 'cal' | 'plan' | 'tracker';
const toProjectTab = (pp: string | undefined): ProjectTab =>
  pp === 'plan' || pp === 'cal' || pp === 'tracker' ? pp : 'list';

/**
 * Progetti (progetti.php): in alto «Tutti» e i progetti principali come schede. «Tutti» mostra l'elenco (preferiti e
 * progetti con la barra di avanzamento) o il calendario del Piano; un progetto mostra la sua scheda grande e sotto
 * Elenco (i sotto-progetti), Calendario e Piano. I tre puntini aprono colore, date, nota, attività, spostamento, eliminazione.
 */
/** quanto resta in vista un progetto appena completato prima di sparire (ms) */
const LINGER_MS = 4000;

export default function ProjectsScreen() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services, version, changed, pomodoroSettings } = useApp();
  const params = useLocalSearchParams<{ id?: string; view?: string; pp?: string }>();

  const [sel, setSel] = useState<string | null>(typeof params.id === 'string' ? params.id : null);
  const [allTab, setAllTab] = useState<AllTab>(params.view === 'cal' ? 'cal' : 'list');
  const [projectTab, setProjectTab] = useState<ProjectTab>(toProjectTab(params.pp));
  const [menu, setMenu] = useState<null | 'menu' | 'due' | 'note'>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [showDates, setShowDates] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [collapsedState, setCollapsedState] = useState<Set<string> | null>(null);
  // un progetto appena completato resta in vista qualche secondo prima di nascondersi (se i completati sono nascosti)
  const [lingering, setLingering] = useState<ReadonlySet<string>>(new Set());
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (lingerTimer.current) clearTimeout(lingerTimer.current);
    },
    [],
  );
  // lo stato di prima dei figli, per tornare indietro quando si toglie «completato»
  const snapshots = useRef(new Map<string, StatusSnapshot[]>());
  // la pagina scorre da sola ai bordi mentre una riga è in mano, e sta ferma sotto il dito
  const scroller = useRef<ScrollViewInstance>(null);
  const scrolled = useRef(0);
  const [held, setHeld] = useState(false);
  // i posti dove si può lasciare una riga trascinata: briciole e pastiglie dei progetti principali
  const [zones] = useState(() => new DropZones());
  const bridge = useMemo<ScrollBridge>(
    () => ({
      offset: () => scrolled.current,
      scrollTo: (y) => scroller.current?.scrollTo({ y, animated: false }),
      lock: setHeld,
    }),
    [],
  );

  // un collegamento da un'altra pagina («apri questo progetto») cambia la scheda aperta
  const [seenId, setSeenId] = useState(params.id);
  if (params.id !== seenId) {
    setSeenId(params.id);
    if (typeof params.id === 'string') {
      setSel(params.id);
      setProjectTab(toProjectTab(params.pp));
    }
  }

  const data = useMemo(() => {
    void version;
    if (!services) return null;
    return {
      all: services.projects.all(),
      opts: services.projectOptions.read(),
      totals: services.projects.totals(),
      worked: services.projects.worked(),
      savedBranches: services.projectOptions.collapsed(),
      subView: services.projectOptions.subView(),
    };
  }, [services, version]);
  if (!services || !data) return null;
  const { all, opts, totals } = data;
  const repo = services.projects;

  const me = sel ? (all.find((p) => p.uuid === sel) ?? null) : null;
  const crumbs = me ? ancestors(byId(all), me.uuid) : [];
  const rootOfMe = me ? (crumbs[0]?.uuid ?? me.uuid) : null;

  const parents = new Set(
    all.filter((p) => all.some((c) => c.parent_uuid === p.uuid)).map((p) => p.uuid),
  );
  const collapsed: Set<string> =
    collapsedState ?? (opts.ricorda_rami && data.savedBranches ? data.savedBranches : parents);
  const setCollapsed = (next: Set<string>) => {
    setCollapsedState(next);
    if (opts.ricorda_rami) services.projectOptions.saveCollapsed(next);
  };
  const treeOpts = {
    keep: lingering,
    showCompleted: opts.completati,
    onlyWorked: opts.solo_attivi ? data.worked : null,
    order: opts.ordine,
  };
  const roots = flatten(all, { ...treeOpts, collapsed: parents });
  const favorites = all.filter(
    (p) => p.is_favorite && (opts.completati || p.status !== 'completed'),
  );

  const setOpt = (patch: Partial<ProjectOptions>) => {
    services.projectOptions.write(patch);
    changed();
  };
  const create = (name: string, parent: string | null) => {
    const id = repo.create({ name, parent, position: 'last' });
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
    const r = repo.cycleStatus(uuid, snapshots.current.get(uuid));
    if (r && !opts.completati) {
      const ids = subtreeIds(all, uuid);
      if (r.status === 'completed') {
        setLingering((cur) => new Set([...cur, ...ids]));
        if (lingerTimer.current) clearTimeout(lingerTimer.current);
        lingerTimer.current = setTimeout(() => setLingering(new Set()), LINGER_MS);
      } else {
        setLingering((cur) => new Set([...cur].filter((x) => !ids.includes(x))));
      }
    }
    if (r) {
      if (r.status === 'completed') snapshots.current.set(uuid, r.snapshot);
      else snapshots.current.delete(uuid);
    }
    changed();
  };
  const open = (uuid: string) => {
    setSel(uuid);
    setProjectTab('list');
  };
  // il tasto col timer apre prima l'elenco dei Pomodoro del progetto (il popup del sito), che ha «Avvia su questo»
  const startPomodoro = (uuid: string) =>
    router.push({ pathname: '/pomodoro-history', params: { project: uuid } });

  const lang = i18n.language || 'it';
  const showTags = opts.mostra_tag;

  return (
    <DropZonesContext.Provider value={zones}>
      <View style={{ flex: 1, backgroundColor: th.bg }}>
        <ProjectsHeader
          roots={roots.map((r) => r.project)}
          current={rootOfMe}
          onPick={(uuid) => {
            setSel(uuid);
            setProjectTab('list');
          }}
          onDates={() => setShowDates(true)}
          onOptions={() => setShowOptions(true)}
        />
        <ScrollBridgeContext.Provider value={bridge}>
          <ScrollView
            ref={scroller}
            scrollEnabled={!held}
            scrollEventThrottle={16}
            onScroll={(e) => {
              scrolled.current = e.nativeEvent.contentOffset.y;
            }}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 90, gap: 14 }}
            keyboardShouldPersistTaps="handled"
          >
            {!me ? (
              <>
                <Seg<AllTab>
                  testID="proj-all-tab"
                  value={allTab}
                  onChange={setAllTab}
                  items={[
                    { id: 'list', label: t('progetti.elenco') },
                    { id: 'cal', label: t('piano.v_calendario') },
                  ]}
                />
                {allTab === 'list' ? (
                  <ProjectsAll
                    repo={repo}
                    all={all}
                    changed={changed}
                    roots={roots}
                    favorites={favorites}
                    totals={totals}
                    showTags={showTags}
                    onOpen={open}
                    onCreate={(name, parent) => create(name, parent ?? null)}
                  />
                ) : (
                  <PlanPanel
                    scope={null}
                    timeOpen={timeOpen}
                    onTimeOpen={() => setTimeOpen(true)}
                    onTimeClose={() => setTimeOpen(false)}
                  />
                )}
              </>
            ) : (
              <>
                {crumbs.length ? <Crumbs crumbs={crumbs} onOpen={open} /> : null}
                <ProjectHero
                  me={me}
                  done={childrenOf(all, me.uuid).filter((k) => k.status === 'completed').length}
                  total={childrenOf(all, me.uuid).length}
                  secs={totals.get(me.uuid) ?? 0}
                  tasks={services.tasks ?? null}
                  version={version}
                  onCycle={() => cycle(me.uuid)}
                  onRename={(name) => {
                    repo.update(me.uuid, { name });
                    changed();
                  }}
                  onFocus={() => startPomodoro(me.uuid)}
                  onHistory={() =>
                    router.push({ pathname: '/pomodoro-history', params: { project: me.uuid } })
                  }
                  onMenu={() => setMenu('menu')}
                  onDates={() => setMenu('due')}
                  onNote={() => setMenu('note')}
                  changed={changed}
                />
                <Seg<ProjectTab>
                  testID="proj-tab"
                  compact
                  value={projectTab}
                  onChange={setProjectTab}
                  items={[
                    { id: 'list', label: t('progetti.elenco') },
                    { id: 'cal', label: t('piano.v_calendario') },
                    { id: 'plan', label: t('piano.v_piano') },
                    { id: 'tracker', label: t('tracker.tab') },
                  ]}
                />
                {projectTab === 'list' ? (
                  <SubProjects
                    repo={repo}
                    all={all}
                    parent={me}
                    rows={flatten(all, { ...treeOpts, collapsed, root: me.uuid })}
                    collapsed={collapsed}
                    fading={lingering}
                    onFoldAll={(ids, collapse) => {
                      const n = new Set(collapsed);
                      for (const id of ids) {
                        if (collapse) n.add(id);
                        else n.delete(id);
                      }
                      setCollapsed(n);
                    }}
                    onToggleBranch={(uuid) => {
                      const n = new Set(collapsed);
                      if (n.has(uuid)) n.delete(uuid);
                      else n.add(uuid);
                      setCollapsed(n);
                    }}
                    swatches={SWATCHES}
                    onOpen={(k) => open(k.uuid)}
                    onStart={(k) => startPomodoro(k.uuid)}
                    onCycle={cycle}
                    onAdd={(name, parent) => create(name, parent ?? me.uuid)}
                    changed={changed}
                    totals={totals}
                    view={data.subView}
                    onView={(v) => {
                      services.projectOptions.setSubView(v);
                      changed();
                    }}
                    showTags={showTags}
                    canReorder={opts.ordine === 'manuale'}
                  />
                ) : null}
                {projectTab === 'cal' ? (
                  <PlanPanel
                    scope={me.uuid}
                    initialSel={me.uuid}
                    timeOpen={timeOpen}
                    onTimeOpen={() => setTimeOpen(true)}
                    onTimeClose={() => setTimeOpen(false)}
                  />
                ) : null}
                {projectTab === 'plan' && services.plan ? (
                  <ProjectPlanCard
                    repo={services.plan}
                    projects={all}
                    project={me.uuid}
                    lang={lang}
                    pomodoroMinutes={pomodoroSettings.last_pomodoro_duration_min}
                    changed={changed}
                    onCalendar={() => setProjectTab('cal')}
                    onPomodoro={(min, auto) =>
                      router.push({
                        pathname: '/pomodoro',
                        params: {
                          project: me.uuid,
                          min: String(min),
                          ...(auto ? { auto: '1' } : {}),
                        },
                      })
                    }
                  />
                ) : null}
                {projectTab === 'tracker' ? (
                  <TrackerTab repo={services.tracker} project={me.uuid} changed={changed} />
                ) : null}
              </>
            )}
          </ScrollView>
        </ScrollBridgeContext.Provider>

        {me && menu ? (
          <ProjectMenu
            me={me}
            all={all}
            crumbs={crumbs}
            sessions={repo.sessionCount(subtreeIds(all, me.uuid))}
            initial={menu === 'due' ? 'due' : menu === 'note' ? 'note' : undefined}
            onClose={() => setMenu(null)}
            onDeleted={() => {
              setMenu(null);
              setSel(me.parent_uuid);
            }}
          />
        ) : null}
        {showOptions ? (
          <OptionsModal opts={opts} onChange={setOpt} onClose={() => setShowOptions(false)} />
        ) : null}
        {showDates ? (
          <DatesSheet all={all} onOpen={open} onClose={() => setShowDates(false)} />
        ) : null}
        <DockHost bottom={12} />
      </View>
    </DropZonesContext.Provider>
  );
}
