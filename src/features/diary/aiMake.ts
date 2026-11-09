import type { DiaryAiReply } from '@/core/account/accountApi';

import type { AiList } from './aiReading';
import { dayOf, type Insights } from './insights';

/**
 * Creare i resoconti e i libri con l'IA (diario_ai.php del sito): quale trimestre ha scritto abbastanza, cosa dire
 * quando qualcosa non va, e il giro che scrive un libro pezzo per pezzo. Niente schermo qui dentro.
 */

/** Come sul sito (`DN_MIN_GIORNI`, `DN_MIN_PAROLE`) e un giorno «scritto» ha almeno 10 parole. */
export const MIN_DAYS = 15;
export const MIN_WORDS = 1500;
export const MIN_WORDS_PER_DAY = 10;

export interface QuarterInfo {
  quarter: 1 | 2 | 3 | 4;
  days: number;
  words: number;
  /** ha scritto abbastanza per un resoconto */
  enough: boolean;
  /** il trimestre è già cominciato */
  started: boolean;
}

/** Giorni e parole scritti in ogni trimestre dell'anno, dai numeri del diario. */
export function quarters(data: Insights, today: string): QuarterInfo[] {
  return ([1, 2, 3, 4] as const).map((q) => {
    let days = 0;
    let words = 0;
    for (let m = 3 * (q - 1) + 1; m <= 3 * q; m++) {
      const last = new Date(Date.UTC(data.year, m, 0)).getUTCDate();
      for (let d = 1; d <= last; d++) {
        const iso = `${data.year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const x = dayOf(data, iso);
        if (!x) continue;
        if (x.w >= MIN_WORDS_PER_DAY) days++;
        words += x.w;
      }
    }
    const start = `${data.year}-${String(3 * (q - 1) + 1).padStart(2, '0')}-01`;
    return {
      quarter: q,
      days,
      words,
      enough: days >= MIN_DAYS && words >= MIN_WORDS,
      started: start <= today,
    };
  });
}

/** Il testo da mostrare per una risposta con `ok: false` (la chiave del dizionario e i suoi valori). */
export function failure(r: DiaryAiReply): {
  key: string;
  vars: Record<string, number | string>;
  retry: boolean;
} {
  switch (r.error) {
    case 'limite_piano':
      return {
        key: 'diario.dn_err_crediti',
        vars: { stima: r.stima ?? 0, disp: r.disponibili ?? 0 },
        retry: false,
      };
    case 'niente_pensieri':
      return { key: 'diario.dn_err_pensieri', vars: {}, retry: false };
    case 'troppo_poco':
      return { key: 'diario.dn_scrivi_ancora', vars: {}, retry: false };
    default:
      if (r.error?.startsWith('ia_')) return { key: 'diario.dn_err_ia', vars: {}, retry: true };
      return { key: 'diario.dn_ops', vars: {}, retry: true };
  }
}

export interface AiRunner {
  run: (body: Record<string, unknown>) => Promise<DiaryAiReply>;
}

export type MakeResult =
  | { ok: true; kind: 'report' | 'book'; id: number }
  | { ok: false; reply: DiaryAiReply | null; bookId?: number };

/** Scrive il resoconto del trimestre. `reply: null` = non si è riusciti a parlare col server. */
export async function makeReport(api: AiRunner, year: number, q: number): Promise<MakeResult> {
  try {
    const r = await api.run({ azione: 'resoconto', anno: year, q });
    return r.ok && r.id ? { ok: true, kind: 'report', id: r.id } : { ok: false, reply: r };
  } catch {
    return { ok: false, reply: null };
  }
}

export interface BookProgress {
  /** il titolo, appena c'è il piano */
  title?: string;
  done: number;
  total: number;
  chapter?: string;
}

/**
 * Scrive un libro: prima il piano (se `bookId` non c'è), poi un pezzo per volta finché il server dice «fatto». Il
 * lavoro è salvato a ogni pezzo: se si interrompe (rete, crediti), con `bookId` si riprende da dove era.
 */
export async function makeBook(
  api: AiRunner,
  opts: { year: number; q: number; join?: number; bookId?: number },
  onProgress: (p: BookProgress) => void,
  stopped: () => boolean = () => false,
): Promise<MakeResult> {
  let id = opts.bookId ?? 0;
  try {
    if (!id) {
      const plan = await api.run({
        azione: 'libro_piano',
        anno: opts.year,
        q: opts.q,
        ...(opts.join ? { unisci: opts.join } : {}),
      });
      if (!plan.ok || !plan.id) return { ok: false, reply: plan };
      id = plan.id;
      onProgress({ title: plan.titolo, done: 0, total: plan.pezzi ?? 0 });
    }
    // un giro di sicurezza: un libro non ha mai migliaia di pezzi
    for (let i = 0; i < 400; i++) {
      if (stopped()) return { ok: false, reply: null, bookId: id };
      const r = await api.run({ azione: 'libro_avanti', id });
      if (!r.ok) return { ok: false, reply: r, bookId: id };
      onProgress({ done: r.fatti ?? 0, total: r.totale ?? 0, chapter: r.capitolo });
      if (r.fatto) return { ok: true, kind: 'book', id };
    }
    return { ok: false, reply: null, bookId: id };
  } catch {
    return { ok: false, reply: null, bookId: id || undefined };
  }
}

/** Il resoconto già scritto per un trimestre, se c'è. */
export const reportOf = (list: AiList | null, year: number, q: number) =>
  list?.reports.find((r) => r.year === year && r.quarter === q) ?? null;
