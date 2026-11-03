import raw from './catalog.json';

import type { GradeSettings } from './logic';
import type { GradesRepo } from './repo';

/** Il catalogo dei corsi (stesso file del sito: exams_catalog.json). */
export interface CatalogExam {
  code?: string;
  name: string;
  cfu: number;
  ssd?: string | null;
  year?: number | null;
  pass_fail?: boolean;
  national_avg?: number | null;
}
export interface CatalogProgram {
  label: string;
  faculty: string;
  total_cfu: number;
  grade_base?: number;
  thesis?: { min?: number; max?: number };
  defaults?: { honors_value?: number; on_time_points?: number };
  exams: CatalogExam[];
}
export interface CatalogFaculty {
  label: string;
  color: string;
  gradient?: string[];
  emoji?: string;
}

const CATALOG = raw as unknown as {
  faculties: Record<string, CatalogFaculty>;
  programs: Record<string, CatalogProgram>;
};

export const faculties = (): Record<string, CatalogFaculty> => CATALOG.faculties;
export const program = (key: string | null): CatalogProgram | null =>
  key ? (CATALOG.programs[key] ?? null) : null;

export interface ProgramRow {
  key: string;
  label: string;
  facultyLabel: string;
  color: string;
  emoji: string;
  cfu: number;
  examCount: number;
}

/** I corsi in ordine alfabetico, filtrati per nome del corso o della facoltà. */
export function programList(filter = '', locale = 'it'): ProgramRow[] {
  const f = filter.trim().toLowerCase();
  return Object.entries(CATALOG.programs)
    .map(([key, p]) => {
      const fac = CATALOG.faculties[p.faculty];
      return {
        key,
        label: p.label,
        facultyLabel: fac?.label ?? '',
        color: fac?.color ?? '#0A84FF',
        emoji: fac?.emoji ?? '🎓',
        cfu: p.total_cfu,
        examCount: p.exams?.length ?? 0,
      };
    })
    .filter(
      (r) => !f || r.label.toLowerCase().includes(f) || r.facultyLabel.toLowerCase().includes(f),
    )
    .sort((a, b) => a.label.localeCompare(b.label, locale, { sensitivity: 'base' }));
}

/**
 * Carica un corso: mette gli esami (`replace` toglie prima quelli che ci sono), regola CFU, base, lode, tesi e colore,
 * e se non c'è nessun bonus ne prepara uno spento «laurea in corso» (come il sito). Ritorna quanti esami ha messo.
 */
export function applyProgram(
  repo: GradesRepo,
  updateSettings: (patch: Partial<GradeSettings>) => void,
  key: string,
  mode: 'replace' | 'append',
  onTimeName: string,
): number {
  const p = program(key);
  if (!p) return 0;
  const fac = CATALOG.faculties[p.faculty];
  const n = repo.importProgram(p.exams ?? [], mode);
  updateSettings({
    program_key: key,
    program_label: p.label,
    faculty_key: p.faculty,
    total_cfu: p.total_cfu,
    grade_base: p.grade_base ?? 110,
    accent_color: fac?.color ?? '#0A84FF',
    honors_value: p.defaults?.honors_value ?? 30,
    thesis_min_points: p.thesis?.min ?? 0,
    thesis_max_points: p.thesis?.max ?? 0,
  });
  const pts = p.defaults?.on_time_points;
  if (pts != null && repo.bonuses().length === 0)
    repo.addBonus({ name: onTimeName, bonus_type: 'on_time', points: pts, is_enabled: false });
  return n;
}
