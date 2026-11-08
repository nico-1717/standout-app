import type { Project } from '@/features/projects/logic';

import { inherit } from './engine';
import { GoalSheet } from './GoalSheet';
import type { GoalInput, PlanRepo } from './repo';
import { SplitSheet } from './SplitSheet';

export type EditorMode = 'goal' | 'split';

/**
 * Le due schede che cambiano il tempo di un progetto: «Obiettivo» (GoalSheet) e «Dividi» (SplitSheet). Le usano la pagina
 * Piano e la scheda del progetto. Se il tempo di un progetto con sotto-progetti cambia, i figli si adeguano in proporzione,
 * come fa il sito (resplit).
 */
export function GoalEditor(p: {
  repo: PlanRepo;
  projects: Project[];
  project: string | null;
  mode: EditorMode | null;
  changed: () => void;
  onMode: (mode: EditorMode | null, project: string | null) => void;
}) {
  const { repo, project } = p;
  if (!project || !p.mode) return null;
  const proj = p.projects.find((x) => x.uuid === project);
  if (!proj) return null;

  const nodes = new Map(repo.nodes().map((n) => [n.id, n]));
  const node = nodes.get(project);
  const goals = repo.goals();
  const goal = goals.get(project) ?? null;
  const close = () => p.onMode(null, null);

  if (p.mode === 'split') {
    const kids = (node?.kids ?? [])
      .map((id) => ({ id, p: p.projects.find((x) => x.uuid === id) }))
      .filter((k) => k.p && k.p.status !== 'completed')
      .map((k) => ({
        uuid: k.id,
        name: k.p!.name,
        color: k.p!.color,
        minutes: goals.get(k.id)?.minutes ?? 0,
        locked: goals.get(k.id)?.locked ?? false,
        hasKids: (nodes.get(k.id)?.kids.length ?? 0) > 0,
      }));
    return (
      <SplitSheet
        visible
        name={proj.name}
        total={goal?.minutes ?? 0}
        kids={kids}
        onSave={(total, rows) => {
          const before = new Map(kids.map((k) => [k.uuid, k.minutes]));
          const saved = repo.saveSplit(project, total, rows);
          for (const r of saved)
            if (r.minutes !== before.get(r.uuid)) repo.resplit(r.uuid, r.minutes);
          p.changed();
          close();
        }}
        onOpenKid={(id) => p.onMode('split', id)}
        onClose={close}
      />
    );
  }

  const save = (input: GoalInput) => {
    const before = goal?.minutes ?? 0;
    const minutes = repo.saveGoal(project, input);
    const kind = input.kind ?? goal?.kind ?? 'plain';
    if ((node?.kids.length ?? 0) > 0 && kind !== 'daily' && minutes > 0 && minutes !== before)
      repo.resplit(project, minutes);
    p.changed();
    close();
  };
  return (
    <GoalSheet
      visible
      name={proj.name}
      goal={goal}
      inheritedDeadline={node?.parent ? inherit(nodes, goals, node.parent, 'deadline') : null}
      hasKids={(node?.kids.length ?? 0) > 0}
      today={repo.today()}
      dayLen={repo.settings().weekdayEff}
      doneMin={repo.doneInBranch(project, goal?.since ?? null)}
      color={proj.color}
      onSave={save}
      onClose={close}
    />
  );
}
