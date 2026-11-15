import type { TFunction } from 'i18next';

import { dayOfMonth, monthOf, yearOf } from '@/features/planner/dates';

import type { Project, TreeRow } from './logic';

/** «18 Dic», e con l'anno se non è quello di oggi: «1 Mar 2027» (come le date della pagina Progetti del sito). */
export function shortDate(iso: string, t: TFunction, today: string): string {
  const mese = t(`planner.mese_${monthOf(iso)}`);
  const short = mese.charAt(0).toUpperCase() + mese.slice(1, 3);
  const base = `${dayOfMonth(iso)} ${short}`;
  return yearOf(iso) === yearOf(today) ? base : `${base} ${yearOf(iso)}`;
}

/** La data che il sito scrive sotto il nome: la scadenza, e se manca l'obiettivo. */
export function dateLabel(p: Project, t: TFunction, today: string): string {
  if (p.due_date) return t('progetti.meta_scadenza', { d: shortDate(p.due_date, t, today) });
  if (p.target_date) return t('progetti.meta_obiettivo', { d: shortDate(p.target_date, t, today) });
  return '';
}

/**
 * La riga grigia sotto il nome di un progetto nell'elenco: «1 di 3 · scade il 18 Dic». Un progetto fatto, senza
 * sotto-progetti, dice «Fatto».
 */
export function metaLine(row: TreeRow, t: TFunction, today: string): string {
  const out: string[] = [];
  if (row.total) out.push(t('progetti.n_di_m', { n: row.done, m: row.total }));
  else if (row.project.status === 'completed') out.push(t('progetti.fatto'));
  const date = dateLabel(row.project, t, today);
  if (date) out.push(date);
  return out.join(' · ');
}

/** Quanta barra è piena: i sotto-progetti fatti; senza sotto-progetti, pieno solo se il progetto è fatto. */
export function progressOf(row: TreeRow): number {
  if (row.total) return row.done / row.total;
  return row.project.status === 'completed' ? 1 : 0;
}
