import type { SheetData } from './xlsx';

/**
 * Aiuti per mostrare le colonne di un foglio all'utente (il selettore di colonne dell'importazione): la lettera di una
 * colonna, il suo nome (la cella d'intestazione) e qualche valore d'esempio.
 */

/** 0 → «A», 25 → «Z», 26 → «AA». */
export function colLetter(i: number): string {
  let n = i;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export interface ColumnInfo {
  index: number;
  letter: string;
  /** la cella d'intestazione (vuota se il foglio non ha intestazione) */
  name: string;
  /** i primi valori non vuoti sotto l'intestazione */
  samples: string[];
}

/** Le colonne di un foglio: quante ne ha la riga più larga fra le prime 50. */
export function columnsOf(sheet: SheetData, headerAt: number, sampleCount = 3): ColumnInfo[] {
  const rows = sheet.rows;
  const width = rows.slice(0, 50).reduce((w, r) => Math.max(w, r.length), 0);
  const body = rows.slice(headerAt + 1).filter((r) => r.some((c) => c.trim() !== ''));
  const header = headerAt >= 0 ? (rows[headerAt] ?? []) : [];
  return Array.from({ length: width }, (_, i) => ({
    index: i,
    letter: colLetter(i),
    name: (header[i] ?? '').trim(),
    samples: body
      .slice(0, 40)
      .map((r) => (r[i] ?? '').trim())
      .filter((v) => v !== '')
      .slice(0, sampleCount),
  }));
}
