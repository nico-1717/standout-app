/**
 * Le regole dei mazzi e delle carte di studio, senza database. Stesse regole del sito (public/fc/fc_decks.php,
 * lib/fc/fc_icone.php): l'albero dei mazzi, il colore ereditato, l'archivio (un ramo archiviato porta con sé i figli),
 * i giorni all'esame, l'icona che si sceglie dal nome.
 */
import iconData from './icons.json';

/** Il colore di un mazzo che non ne ha scelto uno (e non lo ha nessun antenato). */
export const DEFAULT_DECK_COLOR = '#A0A0A0';

export interface Deck {
  uuid: string;
  parent_uuid: string | null;
  name: string;
  color: string;
  color_edited: number;
  archived: number;
  icon: string | null;
  notes: string | null;
  pinned: number;
  exam_date: string | null;
}

export interface Card {
  uuid: string;
  category_uuid: string;
  question_desc: string | null;
  answer_desc: string | null;
  question_image: string | null;
  answer_image: string | null;
  question_audio: string | null;
  answer_audio: string | null;
  is_father: number;
  custom_order: number;
}

export interface SubCard {
  uuid: string;
  parent_uuid: string;
  question_desc: string | null;
  answer_desc: string | null;
  question_image: string | null;
  answer_image: string | null;
  question_audio: string | null;
  answer_audio: string | null;
  custom_order: number;
}

export type DeckMap = Map<string, Deck>;
export const deckMap = (all: Deck[]): DeckMap => new Map(all.map((d) => [d.uuid, d]));

/** Il colore che un mazzo eredita da questo padre: il primo antenato col colore scelto a mano, altrimenti il grigio. */
export function inheritedDeckColor(all: DeckMap, parentUuid: string | null): string {
  let cur = parentUuid;
  for (let guard = 0; cur && guard < 60; guard++) {
    const d = all.get(cur);
    if (!d) break;
    if (d.color_edited && d.color) return d.color;
    cur = d.parent_uuid;
  }
  return DEFAULT_DECK_COLOR;
}

/** Il mazzo e tutti i suoi discendenti (il mazzo per primo). */
export function deckBranch(all: Deck[], rootUuid: string): string[] {
  const kids = new Map<string | null, string[]>();
  for (const d of all) kids.set(d.parent_uuid, [...(kids.get(d.parent_uuid) ?? []), d.uuid]);
  const out: string[] = [];
  const stack = [rootUuid];
  while (stack.length) {
    const cur = stack.shift()!;
    if (out.includes(cur)) continue; // una sicurezza contro i cicli
    out.push(cur);
    for (const k of kids.get(cur) ?? []) stack.push(k);
  }
  return out;
}

/** Mettere `uuid` dentro `target` farebbe un ciclo? (target è lui stesso o un suo discendente) */
export function deckWouldCycle(all: Deck[], uuid: string, target: string | null): boolean {
  if (!target) return false;
  return deckBranch(all, uuid).includes(target);
}

/** La catena dei padri, dalla radice al padre diretto. */
export function deckPath(all: DeckMap, uuid: string): Deck[] {
  const out: Deck[] = [];
  let cur = all.get(uuid)?.parent_uuid ?? null;
  for (let guard = 0; cur && guard < 60; guard++) {
    const d = all.get(cur);
    if (!d) break;
    out.unshift(d);
    cur = d.parent_uuid;
  }
  return out;
}

/** Il mazzo è archiviato lui o un suo antenato? (fc_in_ramo_archiviato) */
export function inArchivedBranch(all: DeckMap, uuid: string): boolean {
  let cur: string | null = uuid;
  for (let guard = 0; cur && guard < 60; guard++) {
    const d = all.get(cur);
    if (!d) return false;
    if (d.archived) return true;
    cur = d.parent_uuid;
  }
  return false;
}

/** Fissati in cima, poi per nome (come il sito: ORDER BY pinned DESC, name). */
export function compareDecks(a: Deck, b: Deck): number {
  if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

export interface DeckRow {
  deck: Deck;
  depth: number;
  hasChildren: boolean;
  /** quanti sottomazzi diretti */
  childCount: number;
}

export type DeckScope = 'active' | 'archived';

/**
 * L'albero come righe in fila. «active»: tutto quello che non sta in un ramo archiviato. «archived»: ogni ramo archiviato
 * appeso alla sua radice (il mazzo su cui si è premuto «archivia»), che compare come voce di primo livello.
 * `collapsed`: i rami chiusi non elencano i figli.
 */
export function flattenDecks(
  all: Deck[],
  scope: DeckScope,
  collapsed: ReadonlySet<string> = new Set(),
): DeckRow[] {
  const map = deckMap(all);
  const kids = new Map<string | null, Deck[]>();
  const roots: Deck[] = [];
  for (const d of all) {
    const arch = inArchivedBranch(map, d.uuid);
    if (scope === 'active') {
      if (arch) continue;
      const p = d.parent_uuid && map.has(d.parent_uuid) ? d.parent_uuid : null;
      if (p) kids.set(p, [...(kids.get(p) ?? []), d]);
      else roots.push(d);
    } else {
      if (!arch) continue;
      const parentIn =
        d.parent_uuid && map.has(d.parent_uuid) && inArchivedBranch(map, d.parent_uuid);
      if (parentIn) kids.set(d.parent_uuid, [...(kids.get(d.parent_uuid) ?? []), d]);
      else roots.push(d);
    }
  }
  const out: DeckRow[] = [];
  const walk = (list: Deck[], depth: number) => {
    for (const d of [...list].sort(compareDecks)) {
      const sub = kids.get(d.uuid) ?? [];
      out.push({ deck: d, depth, hasChildren: sub.length > 0, childCount: sub.length });
      if (!collapsed.has(d.uuid)) walk(sub, depth + 1);
    }
  };
  walk(roots, 0);
  return out;
}

/** Quante «materie» (radici) ci sono nelle due linguette: Attive / Archivio. */
export function scopeCounts(all: Deck[]): { active: number; archived: number } {
  return {
    active: flattenDecks(all, 'active').filter((r) => r.depth === 0).length,
    archived: flattenDecks(all, 'archived').filter((r) => r.depth === 0).length,
  };
}

/** Cerca per nome (ignora maiuscole e accenti). Ogni risultato porta il percorso di dove sta. */
export function searchDecks(all: Deck[], query: string): { deck: Deck; path: string }[] {
  const q = fold(query);
  if (!q) return [];
  const map = deckMap(all);
  return all
    .filter((d) => fold(d.name).includes(q))
    .sort(compareDecks)
    .map((d) => ({
      deck: d,
      path: deckPath(map, d.uuid)
        .map((p) => p.name)
        .join(' › '),
    }));
}

function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/* ---------------- l'esame ---------------- */

const DAY = 86_400_000;

/** `YYYY-MM-DD` → giorni UTC dall'epoca (niente fusi orari: i giorni di calendario). */
function dayNumber(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return Math.floor(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!) / DAY);
}

/** Giorni all'esame (0 = oggi), o null se non c'è o è passato (fcm_giorni_esame). `today` è `YYYY-MM-DD`. */
export function daysToExam(examDate: string | null, today: string): number | null {
  if (!examDate) return null;
  const e = dayNumber(examDate);
  const t = dayNumber(today);
  if (e === null || t === null) return null;
  const g = e - t;
  return g >= 0 ? g : null;
}

/** Quanto è vicino: «urgent» fino a 3 giorni, «near» fino a 14 (le classi is-urgente / is-vicino del sito). */
export function examUrgency(days: number): 'urgent' | 'near' | 'far' {
  return days <= 3 ? 'urgent' : days <= 14 ? 'near' : 'far';
}

/* ---------------- le icone ---------------- */

const ICONS = iconData.icons as Record<string, string>;
const RULES = (iconData.rules as [string, string][]).map(([re, icon]) => ({
  re: new RegExp(re, 'u'),
  icon,
}));

/** Le chiavi delle icone che si possono scegliere. */
export const DECK_ICON_KEYS: string[] = Object.keys(ICONS);

export const isDeckIcon = (key: string | null | undefined): key is string =>
  !!key && Object.prototype.hasOwnProperty.call(ICONS, key);

/** L'icona che il nome suggerisce (fc_icona_da_nome): la prima regola che combacia, altrimenti la cartella. */
export function iconFromName(name: string): string {
  const n = name.trim().toLowerCase();
  for (const r of RULES) if (r.re.test(n)) return r.icon;
  return 'cartella';
}

/** L'icona da disegnare per un mazzo: quella scelta, o quella del nome. */
export function deckIcon(d: Pick<Deck, 'icon' | 'name'>): string {
  return isDeckIcon(d.icon) ? d.icon : iconFromName(d.name);
}

/** Il disegno (i tratti SVG, 24×24) di un'icona; chiave sconosciuta = cartella. */
export function deckIconSvg(key: string): string {
  return ICONS[isDeckIcon(key) ? key : 'cartella']!;
}

/* ---------------- le carte ---------------- */

/** Le carte di un mazzo nel loro ordine (custom_order, poi uuid per stabilità). */
export function sortCards<T extends { custom_order: number; uuid: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.custom_order - b.custom_order || (a.uuid < b.uuid ? -1 : 1));
}
