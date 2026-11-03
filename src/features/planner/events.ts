import { MAX_OCCURRENCES, occurrences, type RepeatSource } from './recurrence';

/**
 * Gli eventi del planner come stanno sul telefono (una riga = una riga del sito) e come li vede una
 * vista: `eventsInRange` fa quello che fa `pl_events_range` del sito (lib/planner/pl_eventi.php) —
 * eventi normali, eccezioni di una serie («solo questa volta» / «questa volta no»), cloni delle serie,
 * eventi di più giorni, ordine finale. Il test d'oro lo confronta con le risposte del sito.
 */
export interface EventRow extends RepeatSource {
  uuid: string;
  title: string;
  notes: string | null;
  location: string | null;
  place_name: string | null;
  place_lat: number | null;
  place_lon: number | null;
  place_ref: string | null;
  duration_locked: number;
  event_date: string;
  end_date: string | null;
  start_time: string;
  end_time: string;
  is_all_day: number;
  category_uuid: string | null;
  calendar_uuid: string | null;
  habit_uuid: string | null;
  importance: string;
  color: string | null;
  item_type: string;
  is_completed: number;
  notify_type: string;
  notify_minutes: number;
  repeat_type: string;
  repeat_interval: number;
  repeat_unit: string;
  repeat_until: string | null;
  rrule: string | null;
  series_uuid: string | null;
  original_date: string | null;
  is_cancelled: number;
  routine_uuid: string | null;
  routine_group: string | null;
  routine_collapsed: number;
  sort_order: number;
}

/** Un evento da disegnare: una riga vera, o una ripetizione calcolata di una serie. */
export interface EventView {
  /** la riga da modificare: l'evento, l'eccezione o (per una ripetizione) il capostipite */
  uuid: string;
  masterUuid: string;
  /** di quale ripetizione si tratta (per un evento normale: la sua data) */
  occDate: string;
  isOccurrence: boolean;
  /** identità stabile nella vista: «uuid@data» */
  uid: string;
  title: string;
  notes: string;
  location: string;
  placeName: string | null;
  placeLat: number | null;
  placeLon: number | null;
  durationLocked: boolean;
  date: string;
  endDate: string;
  days: number;
  multiday: boolean;
  start: string;
  end: string;
  allDay: boolean;
  categoryUuid: string | null;
  calendarUuid: string | null;
  habitUuid: string | null;
  routineUuid: string | null;
  routineGroup: string | null;
  routineCollapsed: boolean;
  importance: string;
  color: string | null;
  type: string;
  done: boolean;
  notify: string;
  notifyMin: number;
  repeat: string;
  repeatInterval: number;
  repeatUnit: string;
  repeatUntil: string | null;
  seriesUuid: string | null;
  /** una riga che è l'eccezione di una serie (spostata o modificata solo per quella volta) */
  isException: boolean;
}

const DAY_MS = 86_400_000;
const dayNum = (s: string) => Math.floor(Date.parse(`${s}T00:00:00Z`) / DAY_MS);
const dayStr = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);

/** L'ultimo giorno di un evento: end_date se c'è, altrimenti il giorno stesso. */
export function lastDay(r: { event_date: string; end_date: string | null }): string {
  return r.end_date ? r.end_date : r.event_date;
}

/** Quante caselle occupa nel calendario (estremi compresi). */
export function spanDays(r: { event_date: string; end_date: string | null }): number {
  const a = dayNum(r.event_date);
  const b = dayNum(lastDay(r));
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 1;
  return b - a + 1;
}

function view(r: EventRow, occDate: string, masterUuid: string, clone: boolean): EventView {
  const days = spanDays(r);
  return {
    uuid: r.uuid,
    masterUuid,
    occDate,
    isOccurrence: clone,
    uid: `${masterUuid}@${occDate}`,
    title: r.title,
    notes: r.notes ?? '',
    location: r.location ?? '',
    placeName: r.place_name,
    placeLat: r.place_lat,
    placeLon: r.place_lon,
    durationLocked: r.duration_locked === 1,
    date: r.event_date,
    endDate: lastDay(r),
    days,
    multiday: days > 1,
    start: r.start_time.slice(0, 5),
    end: r.end_time.slice(0, 5),
    allDay: r.is_all_day === 1,
    categoryUuid: r.category_uuid,
    calendarUuid: r.calendar_uuid,
    habitUuid: r.habit_uuid,
    routineUuid: r.routine_uuid,
    routineGroup: r.routine_group,
    routineCollapsed: r.routine_collapsed === 1,
    importance: r.importance,
    color: r.color,
    type: r.item_type,
    done: r.is_completed === 1,
    notify: r.notify_type,
    notifyMin: r.notify_minutes,
    repeat: r.repeat_type,
    repeatInterval: r.repeat_interval,
    repeatUnit: r.repeat_unit,
    repeatUntil: r.repeat_until,
    seriesUuid: r.series_uuid,
    isException: !!r.original_date && !!r.series_uuid && r.series_uuid !== r.uuid,
  };
}

/** Le righe che la query del sito leggerebbe per il periodo (stesse tre condizioni). */
function touches(r: EventRow, from: string, to: string): boolean {
  if (r.rrule === null && r.original_date === null) {
    return r.event_date <= to && lastDay(r) >= from;
  }
  if (r.rrule !== null) {
    return r.event_date <= to && (r.repeat_until === null || r.repeat_until >= from);
  }
  return (
    (r.event_date >= from && r.event_date <= to) ||
    (r.original_date! >= from && r.original_date! <= to)
  );
}

/** Cosa si vede nel periodo [from, to]: gli eventi del giorno, le ripetizioni e le eccezioni, nell'ordine del sito. */
export function eventsInRange(all: EventRow[], from: string, to: string): EventView[] {
  const rows = all.filter((r) => touches(r, from, to));
  const exceptions = new Map<string, EventRow>();
  for (const r of rows) {
    if (r.original_date && r.series_uuid) exceptions.set(`${r.series_uuid}@${r.original_date}`, r);
  }
  const out: { r: EventRow; v: EventView }[] = [];
  for (const r of rows) {
    if (!r.rrule) {
      // il segnaposto di «questa volta no» non si disegna
      if (r.is_cancelled === 1) continue;
      if (lastDay(r) < from || r.event_date > to) continue;
      out.push({ r, v: view(r, r.event_date, r.series_uuid ?? r.uuid, false) });
      continue;
    }
    const duration = spanDays(r);
    for (const d of occurrences(r, from, to)) {
      // se per quella data esiste una riga vera (spostata o tolta), parla lei
      if (exceptions.has(`${r.uuid}@${d}`)) continue;
      const clone: EventRow = {
        ...r,
        event_date: d,
        end_date: duration > 1 ? dayStr(dayNum(d) + duration - 1) : null,
        series_uuid: r.uuid,
      };
      out.push({ r: clone, v: view(clone, d, r.uuid, true) });
    }
  }
  out.sort((a, b) => {
    const x = a.r;
    const y = b.r;
    if (x.event_date !== y.event_date) return x.event_date < y.event_date ? -1 : 1;
    if (x.is_all_day !== y.is_all_day) return y.is_all_day - x.is_all_day;
    if (x.start_time !== y.start_time) return x.start_time < y.start_time ? -1 : 1;
    if (x.sort_order !== y.sort_order) return x.sort_order - y.sort_order;
    return x.uuid < y.uuid ? -1 : x.uuid > y.uuid ? 1 : 0;
  });
  return out.map((o) => o.v);
}

export { MAX_OCCURRENCES };
