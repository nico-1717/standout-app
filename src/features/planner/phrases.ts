/**
 * Le frasi della settimana (stesse regole di `pl_pick_phrase()` del sito): ogni settimana ha una frase motivazionale
 * (in fondo) e un'affermazione (in alto), scelte in modo stabile da chi sei e da quale settimana è, senza salvarle.
 * Lo stesso utente vede la stessa frase sul sito e sul telefono. I testi sono nelle traduzioni: `planner.fr_<id>`.
 */

const COUNT = 36;
const pad = (n: number) => String(n).padStart(2, '0');

export const QUOTE_IDS: readonly string[] = Array.from(
  { length: COUNT },
  (_, i) => `q${pad(i + 1)}`,
);
export const AFFIRMATION_IDS: readonly string[] = Array.from(
  { length: COUNT },
  (_, i) => `a${pad(i + 1)}`,
);

let TABLE: Uint32Array | null = null;

/** CRC-32 (come `crc32()` di PHP, senza segno) dei byte UTF-8 del testo. */
export function crc32(text: string): number {
  if (!TABLE) {
    TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of new TextEncoder().encode(text))
    crc = TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** L'id della frase di quella settimana (`weekStart` = lunedì `AAAA-MM-GG`). */
export function weekPhraseId(
  kind: 'quotes' | 'affirmations',
  weekStart: string,
  userId: number,
): string {
  const list = kind === 'quotes' ? QUOTE_IDS : AFFIRMATION_IDS;
  return list[crc32(`${kind}|${weekStart}|${userId}`) % list.length]!;
}
