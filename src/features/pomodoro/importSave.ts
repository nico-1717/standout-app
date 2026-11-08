import type { SqlDb } from '@/core/db/sqldb';
import { norm } from '@/features/habits/importFile';
import type { Project } from '@/features/projects/logic';
import type { ProjectsRepo } from '@/features/projects/repo';

import type { PomoParsed } from './importFile';
import type { PomodoroRepo } from './repo';

export type ImportLink = Record<string, string | null>;
export type ImportPlan = {
  /** per ogni lista (progetto) e titolo (sotto-progetto) del file: il progetto che c'è già con lo stesso nome, o null */
  lists: ImportLink;
  titles: ImportLink;
};

/**
 * Collega da soli i nomi uguali: una lista a un progetto principale, un titolo a un figlio della lista già collegata
 * (o a un principale, se il titolo non ha lista). Maiuscole e simboli non contano.
 */
export function autoLink(parsed: PomoParsed, projects: Project[]): ImportPlan {
  const top = projects.filter((p) => p.parent_uuid === null);
  const find = (pool: Project[], name: string) =>
    pool.find((p) => norm(p.name) === norm(name))?.uuid ?? null;
  const lists: ImportLink = {};
  for (const l of parsed.lists) lists[l.key] = find(top, l.name);
  const titles: ImportLink = {};
  for (const t of parsed.titles) {
    const parent = t.listKey ? (lists[t.listKey] ?? null) : null;
    if (t.listKey && !parent) titles[t.key] = null;
    else
      titles[t.key] = find(parent ? projects.filter((p) => p.parent_uuid === parent) : top, t.name);
  }
  return { lists, titles };
}

export type ImportResult = { projects: number; sessions: number };

/** Salva: i progetti non collegati si creano (i sotto-progetti sotto il loro padre), poi le sessioni. O tutto o niente. */
export function savePomodoroImport(
  db: SqlDb,
  projectsRepo: ProjectsRepo,
  pomodoro: PomodoroRepo,
  parsed: PomoParsed,
  link: ImportPlan,
): ImportResult {
  return db.transaction(() => {
    let created = 0;
    const listIds = new Map<string, string>();
    for (const l of parsed.lists) {
      const linked = link.lists[l.key];
      if (linked && projectsRepo.get(linked)) {
        listIds.set(l.key, linked);
        continue;
      }
      const id = projectsRepo.create({ name: l.name, position: 'last' });
      if (!id) throw new Error('project');
      listIds.set(l.key, id);
      created++;
    }
    const titleIds = new Map<string, string>();
    for (const t of parsed.titles) {
      const linked = link.titles[t.key];
      if (linked && projectsRepo.get(linked)) {
        titleIds.set(t.key, linked);
        continue;
      }
      const id = projectsRepo.create({
        name: t.name,
        parent: t.listKey ? (listIds.get(t.listKey) ?? null) : null,
        position: 'last',
      });
      if (!id) throw new Error('project');
      titleIds.set(t.key, id);
      created++;
    }
    const sessions = pomodoro.addImported(
      parsed.sessions.map((s) => ({
        start: s.start,
        dur: s.dur,
        mode: s.mode,
        projectUuid:
          (s.titleKey && titleIds.get(s.titleKey)) || (s.listKey && listIds.get(s.listKey)) || null,
      })),
    );
    return { projects: created, sessions };
  });
}
