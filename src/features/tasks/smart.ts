import smartData from './planner_smart.json';

/**
 * La barra intelligente del to do: capisce «chiamare il dentista domani alle 15 #salute» e ne ricava titolo,
 * data, ora, durata e progetto. È la copia fedele di leggi() in public/planner/todo_smart.js (le parole stanno
 * in planner_smart.json, lo stesso file del sito): il test d'oro la confronta col codice vero del sito su
 * frasi vere. Nessuna IA, nessuna rete.
 */

export interface SmartData {
  giorni_relativi: Record<string, number>;
  giorni_settimana: Record<string, number>;
  mesi: Record<string, number>;
  fasce_orarie: Record<string, string>;
  parole_da_togliere: string[];
  settimana_prossima: string[];
  festivita: Record<string, { mese: number; giorno: number }>;
  festivita_mobili: Record<string, number>;
  fasce_da_conservare: string[];
  tolleranza_errori_battitura: number;
}

export interface SmartProject {
  id: string;
  name: string;
}

export interface SmartResult {
  title: string;
  date: string | null;
  time: string | null;
  minutes: number;
  project: SmartProject | null;
  projectNew: string | null;
  used: string[];
}

/** «Adesso»: passato da fuori così il test è ripetibile. */
export interface SmartNow {
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM */
  time: string;
}

const pad = (n: number) => (n < 10 ? '0' : '') + n;
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daIso = (s: string) => {
  const p = String(s).split('-');
  return new Date(+p[0]!, +p[1]! - 1, +p[2]!);
};
const piuGiorni = (s: string, n: number) => {
  const d = daIso(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
const giornoSett = (s: string) => (daIso(s).getDay() + 6) % 7; // 0 = lunedì

/** La Pasqua dell'anno (Meeus): serve a Pasquetta, Carnevale… */
function pasquaDi(anno: number): string {
  const a = anno % 19;
  const b = Math.floor(anno / 100);
  const c = anno % 100;
  const dd = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - dd - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31);
  const giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return `${anno}-${pad(mese)}-${pad(giorno)}`;
}

/** Quante correzioni da una parola all'altra: perdona «agsoto». */
function distanza(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 99;
  let prev: number[] = [];
  let cur: number[] = [];
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        cur[j - 1]! + 1,
        prev[j]! + 1,
        prev[j - 1]! + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1),
      );
    }
    prev = cur.slice();
  }
  return prev[b.length]!;
}

function trovaChiave(
  text: string,
  chiavi: string[],
  tol: number,
): { key: string; match: string } | null {
  const ord = chiavi.slice().sort((x, y) => y.length - x.length);
  for (const k of ord) if (text.indexOf(' ' + k + ' ') !== -1) return { key: k, match: k };
  if (!tol) return null;
  const parole = text.split(/\s+/).filter(Boolean);
  for (const p of parole) {
    if (p.length < 4) continue;
    for (const c of ord) {
      if (c.indexOf(' ') !== -1) continue;
      if (distanza(p, c) <= (c.length <= 5 ? 1 : tol)) return { key: c, match: p };
    }
  }
  return null;
}

/** Il titolo è ciò che resta, senza le paroline che accompagnavano data e ora (solo ai bordi). */
function pulisci(orig: string, data: SmartData | null): string {
  const tog = data?.parole_da_togliere ?? [];
  const parole = String(orig).split(/\s+/).filter(Boolean);
  while (parole.length && tog.indexOf(parole[parole.length - 1]!.toLowerCase()) !== -1)
    parole.pop();
  while (parole.length > 1 && tog.indexOf(parole[0]!.toLowerCase()) !== -1) parole.shift();
  const t = parole.join(' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

const escRe = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function readPhrase(
  raw: string,
  projects: SmartProject[],
  now: SmartNow,
  data: SmartData | null = smartData as unknown as SmartData,
): SmartResult {
  const r: SmartResult = {
    title: '',
    date: null,
    time: null,
    minutes: 0,
    project: null,
    projectNew: null,
    used: [],
  };
  const text = ' ' + String(raw || '').trim() + ' ';
  let low = text.toLowerCase();
  // si lavora sul minuscolo per capire, ma il titolo resta scritto come l'ha scritto l'utente
  let orig = text;
  const oggi = now.date;

  function mangia(re: RegExp): RegExpMatchArray | null {
    const m = low.match(re);
    if (!m) return null;
    r.used.push(m[0].trim());
    const i = m.index!;
    low = low.slice(0, i) + ' '.repeat(m[0].length) + low.slice(i + m[0].length);
    orig = orig.slice(0, i) + ' '.repeat(m[0].length) + orig.slice(i + m[0].length);
    return m;
  }
  function togli(da: number, a: number) {
    low = low.slice(0, da) + ' '.repeat(a - da) + low.slice(a);
    orig = orig.slice(0, da) + ' '.repeat(a - da) + orig.slice(a);
  }
  function togliParola(parola: string) {
    const k = low.indexOf(' ' + parola + ' ');
    if (k !== -1) togli(k + 1, k + 1 + parola.length);
  }

  // il progetto: #nome, anche parziale. Un #tag che non è un progetto resta nel titolo
  const mp = low.match(/\s#([^\s#!]+)/);
  if (mp) {
    const n = mp[1]!.toLowerCase().replace(/[_-]+/g, ' ');
    const trovato =
      projects.filter((p) => String(p.name).toLowerCase() === n)[0] ??
      projects.filter((p) => String(p.name).toLowerCase().indexOf(n) === 0)[0];
    if (trovato) {
      r.project = trovato;
      mangia(/\s#([^\s#!]+)/);
    } else r.projectNew = mp[1]!.replace(/[_-]+/g, ' ');
  }

  // durata: «per 30 min», «1h», «1h30», «45'»
  let md = mangia(
    /\s(?:per\s+|for\s+)?(\d{1,2})\s*(?:h|ore|ora|hours?|hr)\s*(\d{1,2})?\s*(?:min|m)?(?=\s)/,
  );
  if (md) r.minutes = Math.min(1440, +md[1]! * 60 + (+(md[2] ?? 0) || 0));
  else {
    md = mangia(/\s(?:per\s+|for\s+)?(\d{1,3})\s*(?:min|minuti|minutes?|')(?=\s)/);
    if (md) r.minutes = Math.min(1440, +md[1]!);
  }

  if (!data) {
    r.title = pulisci(orig, null);
    return r;
  }
  const tol = data.tolleranza_errori_battitura || 0;
  let esplicita = false;

  // ora
  const ma = mangia(/\s(?:at\s+)?(1[0-2]|0?[1-9])(?:[:.]([0-5]\d))?\s*(am|pm)(?=\s)/);
  if (ma) {
    r.time = `${pad((parseInt(ma[1]!, 10) % 12) + (ma[3] === 'pm' ? 12 : 0))}:${ma[2] || '00'}`;
    esplicita = true;
  }
  if (!ma) {
    const mt = mangia(/\s(?:alle|alla|ore|ora|verso|at)?\s*([01]?\d|2[0-3])[:.]([0-5]\d)(?=\s)/);
    if (mt) {
      r.time = `${pad(+mt[1]!)}:${mt[2]}`;
      esplicita = true;
    } else {
      const mh = mangia(/\s(?:alle|ore|ora|verso|at|around)\s+([01]?\d|2[0-3])(?=\s)/);
      if (mh) {
        r.time = `${pad(+mh[1]!)}:00`;
        esplicita = true;
      } else {
        // «domani 15 dentista»: un numero subito dopo un giorno è l'ora, a meno che segua un mese
        const giorni = Object.keys(data.giorni_settimana)
          .concat(Object.keys(data.giorni_relativi))
          .sort((a, b) => b.length - a.length)
          .map(escRe);
        const mg = low.match(
          new RegExp('\\s(' + giorni.join('|') + ')\\s+([01]?\\d|2[0-3])(?=\\s)'),
        );
        if (mg) {
          const dopo =
            low
              .slice(mg.index! + mg[0].length)
              .trim()
              .split(/\s+/)[0] || '';
          const eMese =
            dopo.length >= 3 && trovaChiave(' ' + dopo + ' ', Object.keys(data.mesi), tol);
          if (!eMese) {
            const da = mg.index! + mg[0].length - mg[2]!.length;
            r.time = `${pad(+mg[2]!)}:00`;
            esplicita = true;
            r.used.push(mg[2]!);
            togli(da, da + mg[2]!.length);
          }
        }
      }
    }
  }

  const anno = daIso(oggi).getFullYear();
  // feste fisse e mobili
  const f = trovaChiave(low, Object.keys(data.festivita || {}), tol);
  if (f) {
    const inf = data.festivita[f.key]!;
    let c1 = `${anno}-${pad(inf.mese)}-${pad(inf.giorno)}`;
    if (c1 < oggi) c1 = `${anno + 1}-${pad(inf.mese)}-${pad(inf.giorno)}`;
    r.date = c1;
    r.used.push(f.key);
    togliParola(f.match);
  }
  if (!r.date) {
    const fm = trovaChiave(low, Object.keys(data.festivita_mobili || {}), tol);
    if (fm) {
      let c2 = piuGiorni(pasquaDi(anno), data.festivita_mobili[fm.key]!);
      if (c2 < oggi) c2 = piuGiorni(pasquaDi(anno + 1), data.festivita_mobili[fm.key]!);
      r.date = c2;
      r.used.push(fm.key);
      togliParola(fm.match);
    }
  }
  // data scritta: 13/8, 13-08-2026
  if (!r.date) {
    const mn = mangia(/\s(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?(?=\s)/);
    if (mn) {
      let yy = mn[3] ? +mn[3] : anno;
      if (yy < 100) yy += 2000;
      r.date = `${yy}-${pad(+mn[2]!)}-${pad(+mn[1]!)}`;
    }
  }
  // «13 agosto», «august 13th»
  if (!r.date) {
    let m2: RegExpMatchArray | string[] | null = low.match(
      /\s(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-zàèéìòù]{3,12})(?=\s)/,
    );
    const m2b = m2 ? null : low.match(/\s([a-z]{3,12})\s+(\d{1,2})(?:st|nd|rd|th)?(?=\s)/);
    if (m2b && trovaChiave(' ' + m2b[1] + ' ', Object.keys(data.mesi), 0))
      m2 = [m2b[0], m2b[2]!, m2b[1]!];
    if (m2) {
      const mese = trovaChiave(' ' + m2[2] + ' ', Object.keys(data.mesi), tol);
      if (mese) {
        let c3 = `${anno}-${pad(data.mesi[mese.key]!)}-${pad(+m2[1]!)}`;
        if (c3 < oggi) c3 = `${anno + 1}-${pad(data.mesi[mese.key]!)}-${pad(+m2[1]!)}`;
        r.date = c3;
        r.used.push(m2[1] + ' ' + mese.key);
        const k = low.indexOf(m2[0]!);
        if (k !== -1) togli(k, k + m2[0]!.length);
      }
    }
  }
  // fasce del giorno («stasera» = 20:00); i pasti no
  if (!r.time && data.fasce_orarie) {
    const fasce = Object.keys(data.fasce_orarie).filter(
      (k) =>
        (data.fasce_da_conservare || []).indexOf(k) !== -1 ||
        [
          'mattina',
          'pomeriggio',
          'sera',
          'notte',
          'mezzogiorno',
          'morning',
          'afternoon',
          'evening',
          'night',
          'noon',
        ].indexOf(k) !== -1,
    );
    const fa = trovaChiave(low, fasce, 0);
    if (fa) r.time = data.fasce_orarie[fa.key]!;
  }
  // oggi, domani, dopodomani
  if (!r.date) {
    const rel = Object.keys(data.giorni_relativi).sort((a, b) => b.length - a.length);
    for (const w of rel) {
      if (low.indexOf(' ' + w + ' ') === -1) continue;
      r.date = piuGiorni(oggi, data.giorni_relativi[w]!);
      r.used.push(w);
      togliParola(w);
      break;
    }
  }
  // giorno della settimana: il prossimo che capita
  if (!r.date) {
    const wd = trovaChiave(low, Object.keys(data.giorni_settimana), tol);
    if (wd) {
      let delta = (data.giorni_settimana[wd.key]! - 1 - giornoSett(oggi) + 7) % 7;
      if (delta === 0) delta = 7;
      const piu = (data.settimana_prossima || []).some((w) => low.indexOf(w) !== -1);
      if (piu) delta += 7;
      r.date = piuGiorni(oggi, delta);
      r.used.push(wd.key);
      togliParola(wd.match);
    }
  }
  // un'ora senza giorno vale per oggi (o domani, se è già passata)
  if (r.time && !r.date) r.date = r.time < now.time && esplicita ? piuGiorni(oggi, 1) : oggi;

  r.title = pulisci(orig, data);
  return r;
}

const RE_BUY =
  /^(compra(?:re)?|acquista(?:re)?|ordina(?:re)?|prendere|buy|purchase|order|get)\b|€|\beur(?:o)?\b/i;
const RE_EVENT =
  /\b(appuntamento|riunione|meeting|visita|dentista|dottore|cena|pranzo|aperitivo|call|colloquio|appointment|dinner|lunch|interview|concerto|concert|compleanno|birthday|volo|flight)\b/i;
const RE_PROJECT = /^(progetto|project)\s*[:-]?\s+/i;

/** Dove andrebbe una riga di nota (smistamento a mano, senza IA): solo un suggerimento. */
export function destinazione(
  riga: string,
  letto: SmartResult | null,
): 'project' | 'buy' | 'event' | 'todo' {
  const s = String(riga || '').trim();
  if (RE_PROJECT.test(s)) return 'project';
  if (RE_BUY.test(s)) return 'buy';
  if (letto && letto.date && RE_EVENT.test(s)) return 'event';
  return 'todo';
}
