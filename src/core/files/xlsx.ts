import { unzip } from './inflate';

/** Un foglio letto: il nome e le righe di testo (una cella vuota = ''). */
export type SheetData = { name: string; rows: string[][] };

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodeXml = (s: string): string =>
  s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[e] ?? m;
  });

/** Tutti i testi `<t>…</t>` dentro un pezzo di XML (una stringa con più pezzi di formato è fatta di più <t>). */
function texts(xml: string): string {
  const out: string[] = [];
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g;
  for (let m = re.exec(xml); m; m = re.exec(xml)) out.push(decodeXml(m[1] ?? ''));
  return out.join('');
}

const attr = (tag: string, name: string): string | undefined => {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? decodeXml(m[1]!) : undefined;
};

/** Le colonne `A`, `B`, … `AA` come numero a partire da 0. */
function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    const c = ch.charCodeAt(0);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

const BUILTIN_DATE = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51,
  52, 53, 54, 55, 56, 57, 58,
]);

/** Un formato personalizzato è una data se, tolti testi tra virgolette e parti tra [ ], ha anni, mesi, giorni, ore o minuti. */
const isDateFormat = (code: string): boolean =>
  /[ymdhs]/i.test(
    code
      .replace(/"[^"]*"/g, '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/\\./g, ''),
  );

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * Un numero «di data» di Excel (giorni dal 30 dicembre 1899) come testo: `YYYY-MM-DD`, `HH:MM`, o tutti e due.
 * Un numero intero è una data; solo la parte dopo la virgola è un'ora.
 */
export function excelDateText(serial: number): string {
  const whole = Math.floor(serial);
  const secs = Math.round((serial - whole) * 86400);
  const time = `${pad(Math.floor(secs / 3600) % 24)}:${pad(Math.floor(secs / 60) % 60)}`;
  if (whole <= 0) return time;
  const d = new Date(Date.UTC(1899, 11, 30 + whole));
  const day = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return secs === 0 ? day : `${day} ${time}`;
}

/** Apre un file .xlsx e dà tutti i fogli con il loro testo. Le date diventano testo `YYYY-MM-DD` / `HH:MM`. */
export function readXlsx(bytes: Uint8Array): SheetData[] {
  const files = unzip(bytes);
  const dec = new TextDecoder();
  const read = (name: string): string | null => {
    const f = files.get(name);
    return f ? dec.decode(f) : null;
  };
  const workbook = read('xl/workbook.xml');
  if (!workbook) throw new Error('xlsx: manca xl/workbook.xml');

  const rels = new Map<string, string>();
  for (const m of (read('xl/_rels/workbook.xml.rels') ?? '').matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(m[0], 'Id');
    const target = attr(m[0], 'Target');
    if (id && target) rels.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target}`);
  }

  const shared: string[] = [];
  const sst = read('xl/sharedStrings.xml');
  if (sst)
    for (const m of sst.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g)) {
      shared.push(texts((m[1] ?? '').replace(/<rPh\b[\s\S]*?<\/rPh>/g, '')));
    }

  // quali stili sono date
  const styles = read('xl/styles.xml') ?? '';
  const custom = new Map<number, string>();
  for (const m of styles.matchAll(/<numFmt\b[^>]*>/g)) {
    const id = Number(attr(m[0], 'numFmtId'));
    const code = attr(m[0], 'formatCode');
    if (Number.isFinite(id) && code != null) custom.set(id, code);
  }
  const dateStyle: boolean[] = [];
  const xfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1] ?? '';
  for (const m of xfs.matchAll(/<xf\b[^>]*>/g)) {
    const id = Number(attr(m[0], 'numFmtId') ?? 0);
    dateStyle.push(BUILTIN_DATE.has(id) || (custom.has(id) && isDateFormat(custom.get(id)!)));
  }

  const out: SheetData[] = [];
  for (const m of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    const name = attr(m[0], 'name') ?? `Sheet${out.length + 1}`;
    const rid = attr(m[0], 'r:id');
    const path = rid ? rels.get(rid) : undefined;
    const xml = path ? read(path) : null;
    if (xml == null) continue;
    const rows: string[][] = [];
    for (const r of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const rowNo = Number(attr(r[1] ?? '', 'r'));
      const cells: string[] = [];
      let next = 0;
      for (const c of (r[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const head = c[1] ?? '';
        const ref = attr(head, 'r');
        const at = ref ? colIndex(ref) : next;
        next = at + 1;
        const type = attr(head, 't') ?? 'n';
        const body = c[2] ?? '';
        const v = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body)?.[1];
        let text = '';
        if (type === 'inlineStr') text = texts(body);
        else if (v == null) text = '';
        else if (type === 's') text = shared[Number(v)] ?? '';
        else if (type === 'str' || type === 'e') text = decodeXml(v);
        else if (type === 'b') text = v === '1' ? 'TRUE' : 'FALSE';
        else {
          const n = Number(v);
          const style = Number(attr(head, 's') ?? 0);
          text = Number.isFinite(n) && dateStyle[style] ? excelDateText(n) : decodeXml(v);
        }
        while (cells.length < at) cells.push('');
        cells[at] = text;
      }
      const index = Number.isFinite(rowNo) && rowNo > 0 ? rowNo - 1 : rows.length;
      while (rows.length < index) rows.push([]);
      rows[index] = cells;
    }
    out.push({ name, rows });
  }
  return out;
}
