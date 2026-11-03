import smartData from '@/features/tasks/planner_smart.json';

import { addDaysIso, weekdayOf } from './dates';
import type { EventView } from './events';
import { minutesOf, timeOf, type EventInput } from './model';

/**
 * La barra intelligente del planner: da «cena con luchino sabato alle 8pm» a un evento con titolo, giorno e ora.
 * È la copia fedele di smartParse() in public/planner/js/04_barra_e_priorita.js (le parole stanno in
 * planner_smart.json, lo stesso file del sito). Il test d'oro la confronta con il codice vero del sito su
 * centinaia di frasi (scripts/gen-planner-smart.mjs). Nessuna IA, nessuna rete.
 */

interface SmartFile {
  giorni_relativi: Record<string, number>;
  giorni_settimana: Record<string, number>;
  mesi: Record<string, number>;
  fasce_orarie: Record<string, string>;
  parole_da_togliere: string[];
  settimana_prossima: string[];
  festivita: Record<string, { mese: number; giorno: number }>;
  festivita_mobili: Record<string, number>;
  fasce_da_conservare: string[];
  pasti: Record<string, string>;
  tutto_il_giorno_se_manca_ora?: boolean;
  durata_predefinita_minuti: number;
  tolleranza_errori_battitura: number;
}
const SMART = smartData as unknown as SmartFile;

export interface Contact {
  name: string;
  email: string;
}

export interface SmartParsed {
  title: string;
  guests: Contact[];
  date: string;
  time: string | null;
  allDay: boolean;
  dateGuessed: boolean;
  timeGuessed: boolean;
  used: string[];
}

const pad = (n: number) => (n < 10 ? '0' : '') + n;
const year = (iso: string) => Number(iso.slice(0, 4));

/** La Pasqua dell'anno chiesto (Meeus). */
export function pasquaDi(anno: number): string {
  const a = anno % 19,
    b = Math.floor(anno / 100),
    c = anno % 100;
  const dd = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - dd - g + 15) % 30;
  const i = Math.floor(c / 4),
    k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31);
  const giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return `${anno}-${pad(mese)}-${pad(giorno)}`;
}

/** Quante correzioni servono per passare da una parola all'altra (perdona gli errori di battitura). */
export function distanzaParole(a0: string, b0: string): number {
  const a = String(a0),
    b = String(b0);
  if (Math.abs(a.length - b.length) > 3) return 99;
  let prev: number[] = [];
  let cur: number[] = [];
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let k = 1; k <= b.length; k++) {
      const costo = a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1;
      cur[k] = Math.min(cur[k - 1]! + 1, prev[k]! + 1, prev[k - 1]! + costo);
    }
    prev = cur.slice();
  }
  return prev[b.length]!;
}

/** Cerca una delle chiavi nel testo, perdonando qualche lettera. Le chiavi più lunghe vincono. */
export function trovaChiave(
  text: string,
  chiavi: string[],
  tolleranza: number,
): { key: string; match: string } | null {
  const ordinate = chiavi.slice().sort((x, y) => y.length - x.length);
  for (const k of ordinate) {
    if (text.indexOf(' ' + k + ' ') !== -1) return { key: k, match: k };
  }
  if (!tolleranza) return null;
  const parole = text.split(/\s+/).filter(Boolean);
  for (const p of parole) {
    if (p.length < 4) continue;
    for (const c of ordinate) {
      if (c.indexOf(' ') !== -1) continue;
      const limite = c.length <= 5 ? 1 : tolleranza;
      if (distanzaParole(p, c) <= limite) return { key: c, match: p };
    }
  }
  return null;
}

const escapeRe = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Legge la frase e ne ricava data, ora e titolo. `today` è «oggi» (YYYY-MM-DD), `focusDate` il giorno che
 * si sta guardando (vale se la frase non dice nessun giorno).
 */
export function smartParse(
  raw: string,
  ctx: { today: string; focusDate: string; contacts?: Contact[] },
): SmartParsed {
  const { today } = ctx;
  let text = ' ' + String(raw).toLowerCase().trim() + ' ';
  const used: string[] = [];
  let date: string | null = null;
  let time: string | null = null;
  let mealFound = false;
  let timeExplicit = false;

  const eat = (re: RegExp): RegExpMatchArray | null => {
    const m = text.match(re);
    if (m) {
      used.push(m[0].trim());
      text = text.replace(m[0], ' ');
    }
    return m;
  };

  // --- ora all'inglese: 3pm, 9.30am, "at 7 pm" ---
  const mAmPm = eat(/\s(?:at\s+)?(1[0-2]|0?[1-9])(?:[:.]([0-5]\d))?\s*(am|pm)\s/);
  if (mAmPm) {
    const h12 = (parseInt(mAmPm[1]!, 10) % 12) + (mAmPm[3] === 'pm' ? 12 : 0);
    time = pad(h12) + ':' + (mAmPm[2] || '00');
    timeExplicit = true;
  }

  // --- ora: 12:30, 12.30, "alle 15", "ore 9", "at 15" ---
  const mTime = mAmPm
    ? null
    : eat(/\s(?:alle|alla|ore|ora|verso|at)?\s*([01]?\d|2[0-3])[:.]([0-5]\d)\s/);
  if (mAmPm) {
    // già fatto
  } else if (mTime) {
    time = pad(parseInt(mTime[1]!, 10)) + ':' + mTime[2];
    timeExplicit = true;
  } else {
    let mHour = eat(/\s(?:alle|ore|ora|verso|at|around)\s+([01]?\d|2[0-3])\s/);
    if (!mHour) mHour = eat(/\s([01]?\d|2[0-3])\s*$/);
    if (mHour) {
      time = pad(parseInt(mHour[1]!, 10)) + ':00';
      timeExplicit = true;
    }
    // Un numero subito dopo un giorno è l'ora: "martedì 23 partita", "domani 15 dentista".
    if (!mHour) {
      const paroleGiorno = Object.keys(SMART.giorni_settimana)
        .concat(Object.keys(SMART.giorni_relativi))
        .sort((a, b) => b.length - a.length)
        .map(escapeRe);
      const mDopo = text.match(
        new RegExp('\\s(' + paroleGiorno.join('|') + ')\\s+([01]?\\d|2[0-3])(?=\\s)'),
      );
      if (mDopo) {
        const resto = text.slice(mDopo.index! + mDopo[0].length).trim();
        let dopo = resto.split(/\s+/)[0] || '';
        if (dopo === 'of' || dopo === 'di') dopo = resto.split(/\s+/)[1] || '';
        const eMese =
          dopo.length >= 3 &&
          trovaChiave(
            ' ' + dopo + ' ',
            Object.keys(SMART.mesi),
            SMART.tolleranza_errori_battitura || 0,
          );
        if (!eMese) {
          time = pad(parseInt(mDopo[2]!, 10)) + ':00';
          timeExplicit = true;
          used.push(mDopo[2]!);
          text =
            text.slice(0, mDopo.index) +
            ' ' +
            mDopo[1] +
            ' ' +
            text.slice(mDopo.index! + mDopo[0].length);
        }
      }
    }
  }

  // --- feste a data fissa ---
  const tol = SMART.tolleranza_errori_battitura || 0;
  if (!date && SMART.festivita) {
    const f = trovaChiave(text, Object.keys(SMART.festivita), tol);
    if (f) {
      const info = SMART.festivita[f.key]!;
      const y1 = year(today);
      let cand = `${y1}-${pad(info.mese)}-${pad(info.giorno)}`;
      if (cand < today) cand = `${y1 + 1}-${pad(info.mese)}-${pad(info.giorno)}`;
      date = cand;
      used.push(f.key);
      text = text.replace(' ' + f.match + ' ', ' ');
    }
  }

  // --- feste che si spostano ---
  if (!date && SMART.festivita_mobili) {
    const fm = trovaChiave(text, Object.keys(SMART.festivita_mobili), tol);
    if (fm) {
      const y2 = year(today);
      let cand = addDaysIso(pasquaDi(y2), SMART.festivita_mobili[fm.key]!);
      if (cand < today) cand = addDaysIso(pasquaDi(y2 + 1), SMART.festivita_mobili[fm.key]!);
      date = cand;
      used.push(fm.key);
      text = text.replace(' ' + fm.match + ' ', ' ');
    }
  }

  // --- data esplicita: 13/8, 13-08-2026 ---
  const mNum = eat(/\s(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\s/);
  if (mNum) {
    let yy = mNum[3] ? parseInt(mNum[3], 10) : year(today);
    if (yy < 100) yy += 2000;
    date = `${yy}-${pad(parseInt(mNum[2]!, 10))}-${pad(parseInt(mNum[1]!, 10))}`;
  }

  // --- giorno e mese scritti: "13 agosto", "august 13th" ---
  if (!date) {
    let mm2: string[] | null = text.match(
      /\s(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-zàèéìòù]{3,12})\s/,
    );
    const mm2b = mm2 ? null : text.match(/\s([a-z]{3,12})\s+(\d{1,2})(?:st|nd|rd|th)?\s/);
    if (mm2b && trovaChiave(' ' + mm2b[1] + ' ', Object.keys(SMART.mesi), 0)) {
      mm2 = [mm2b[0], mm2b[2]!, mm2b[1]!];
    }
    if (mm2) {
      const mese = trovaChiave(' ' + mm2[2] + ' ', Object.keys(SMART.mesi), tol);
      if (mese) {
        const y3 = year(today);
        const mm = pad(SMART.mesi[mese.key]!);
        const dd = pad(parseInt(mm2[1]!, 10));
        let cand = `${y3}-${mm}-${dd}`;
        if (cand < today) cand = `${y3 + 1}-${mm}-${dd}`;
        date = cand;
        used.push(mm2[1] + ' ' + mese.key);
        text = text.replace(mm2[0], ' ');
      }
    }
  }

  // --- fasce del giorno (prima di togliere il giorno relativo) ---
  if (!time && SMART.fasce_orarie) {
    const fa = trovaChiave(text, Object.keys(SMART.fasce_orarie), 0);
    if (fa) time = SMART.fasce_orarie[fa.key]!;
  }
  // --- pasti: danno un'ora solo se non è scritta ---
  if (SMART.pasti) {
    const pa = trovaChiave(text, Object.keys(SMART.pasti), tol);
    if (pa) {
      mealFound = true;
      if (!timeExplicit) time = SMART.pasti[pa.key]!;
    }
  }

  // --- giorni relativi: oggi, domani, dopodomani ---
  if (!date) {
    const rel = Object.keys(SMART.giorni_relativi).sort((a, b) => b.length - a.length);
    for (const w of rel) {
      if (text.indexOf(' ' + w + ' ') === -1) continue;
      date = addDaysIso(today, SMART.giorni_relativi[w]!);
      used.push(w);
      text = text.replace(' ' + w + ' ', ' ');
      break;
    }
  }

  // --- giorni della settimana: il prossimo che capita ---
  if (!date) {
    const wd = trovaChiave(text, Object.keys(SMART.giorni_settimana), tol);
    if (wd) {
      const target = SMART.giorni_settimana[wd.key]!;
      const oggiDow = weekdayOf(today);
      let delta = (target - oggiDow + 7) % 7;
      if (delta === 0) delta = 7;
      let piu = false;
      for (const w of SMART.settimana_prossima || []) if (text.indexOf(w) !== -1) piu = true;
      if (piu) delta += 7;
      date = addDaysIso(today, delta);
      used.push(wd.key);
      text = text.replace(' ' + wd.match + ' ', ' ');
    }
  } else {
    // la data c'è già: il nome del giorno accanto è solo un rinforzo
    for (const w of Object.keys(SMART.giorni_settimana)) {
      if (w.length < 6) continue;
      if (text.indexOf(' ' + w + ' ') !== -1) {
        text = text.replace(' ' + w + ' ', ' ');
        used.push(w);
      }
    }
  }

  // --- con chi: "con luchino" invita luchino (il nome resta nel titolo) ---
  const invitati: Contact[] = [];
  const rubrica = ctx.contacts ?? [];
  if (rubrica.length) {
    for (const c of rubrica) {
      const nome = String(c.name || '')
        .toLowerCase()
        .trim();
      if (!nome) continue;
      if (invitati.some((g) => g.email === c.email)) continue;
      if (text.indexOf(' con ' + nome + ' ') !== -1 || text.indexOf(' with ' + nome + ' ') !== -1) {
        invitati.push({ email: c.email, name: c.name });
        continue;
      }
      if (nome.length >= 4) {
        const trovato = trovaChiave(text, [nome], tol);
        if (trovato) invitati.push({ email: c.email, name: c.name });
      }
    }
  }

  // --- quello che resta è il titolo ---
  const parole = text
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => (SMART.parole_da_togliere || []).indexOf(w) === -1);
  let titolo = parole.join(' ').trim();
  if (titolo) titolo = titolo.charAt(0).toUpperCase() + titolo.slice(1);

  return {
    title: titolo,
    guests: invitati,
    date: date || ctx.focusDate,
    time,
    allDay: !time && SMART.tutto_il_giorno_se_manca_ora !== false && !mealFound,
    dateGuessed: !date,
    timeGuessed: !time,
    used,
  };
}

/**
 * Il primo orario libero del giorno, a partire da `top` (di solito le 8): se lì c'è già qualcosa si scorre in
 * avanti fino alla fine dell'ultimo evento attaccato (come firstFreeMinute() del sito).
 */
export function firstFreeMinute(
  busy: { start: string; end: string }[],
  durMin: number,
  slot = 30,
  top = 8 * 60,
): number {
  const dur = Math.max(5, durMin || slot);
  const list = busy
    .map((b) => ({ s: minutesOf(b.start), e: minutesOf(b.end) }))
    .sort((a, b) => a.s - b.s);
  const start = Math.floor(top / slot) * slot;
  let t = start;
  let guard = 0;
  while (guard++ < 400) {
    const clash = list.find((b) => t < b.e && t + dur > b.s);
    if (!clash) break;
    t = Math.ceil(clash.e / slot) * slot;
    if (t + dur > 1440) {
      t = start;
      break;
    }
  }
  return Math.max(0, Math.min(1440 - dur, t));
}

/** Da una frase letta all'evento da creare (come smartCreate() del sito). `dayEvents` = cosa c'è già quel giorno. */
export function smartEvent(
  p: SmartParsed,
  dayEvents: Pick<EventView, 'start' | 'end' | 'allDay' | 'multiday'>[],
): EventInput {
  const dur = SMART.durata_predefinita_minuti || 60;
  const busy = dayEvents.filter((e) => !e.allDay && !e.multiday);
  const start = p.allDay ? '00:00' : (p.time ?? timeOf(firstFreeMinute(busy, dur)));
  const end = p.allDay ? '23:59' : timeOf(Math.min(1439, minutesOf(start) + dur));
  return {
    title: p.title,
    date: p.date,
    start,
    end,
    allDay: p.allDay,
    type: 'event',
    notify: p.allDay ? 'none' : 'h1',
  };
}
