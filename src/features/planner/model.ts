import { dateOrNull } from './recurrence';
import type { EventRow } from './events';

/**
 * Le regole con cui il sito (lib/planner/pl_scrivi.php › pl_evento_salva) mette in ordine un evento prima di
 * salvarlo. Il telefono le applica subito, per mostrare l'evento com'è; poi il server rifà lo stesso lavoro e
 * il suo risultato vince.
 */
export const MAX_EVENT_DAYS = 366;

const DAY_MS = 86_400_000;
const dayNum = (s: string) => Math.floor(Date.parse(`${s}T00:00:00Z`) / DAY_MS);
const dayStr = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);
export const addDaysIso = (s: string, n: number) => dayStr(dayNum(s) + n);

export const minutesOf = (t: string): number => {
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
};
export const timeOf = (min: number): string => {
  const m = Math.max(0, Math.min(1439, Math.round(min)));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export type Notify = 'none' | 'at_time' | 'm30' | 'h1' | 'd1' | 'custom';
export const NOTIFY_MINUTES: Record<Exclude<Notify, 'custom'>, number> = {
  none: 0,
  at_time: 0,
  m30: 30,
  h1: 60,
  d1: 1440,
};

export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
export type Unit = 'day' | 'week' | 'month' | 'year';

/** La regola RRULE che il server scrive dai campi «ripeti» (stesso testo, così il telefono la legge uguale). */
export function buildRrule(
  repeat: string,
  interval: number,
  unit: string,
  until: string | null,
): string | null {
  if (repeat === 'none') return null;
  const simple: Record<string, string> = {
    daily: 'DAILY',
    weekly: 'WEEKLY',
    monthly: 'MONTHLY',
    yearly: 'YEARLY',
  };
  const custom: Record<string, string> = {
    day: 'DAILY',
    week: 'WEEKLY',
    month: 'MONTHLY',
    year: 'YEARLY',
  };
  let freq: string | undefined = simple[repeat];
  let every = 1;
  if (repeat === 'custom') {
    freq = custom[unit] ?? 'WEEKLY';
    every = Math.max(1, interval);
  }
  if (!freq) return null;
  let r = `FREQ=${freq}`;
  if (every > 1) r += `;INTERVAL=${every}`;
  if (until) r += `;UNTIL=${until.replaceAll('-', '')}T235959Z`;
  return r;
}

/** Quello che l'utente può scegliere per un evento (tutto facoltativo salvo la data). */
export interface EventInput {
  title?: string;
  notes?: string;
  location?: string;
  placeName?: string | null;
  placeLat?: number | null;
  placeLon?: number | null;
  placeRef?: string | null;
  durationLocked?: boolean;
  date: string;
  endDate?: string | null;
  start?: string;
  end?: string;
  allDay?: boolean;
  categoryUuid?: string | null;
  calendarUuid?: string | null;
  importance?: 'normal' | 'high' | 'highest';
  color?: string | null;
  type?: 'event' | 'task';
  notify?: Notify;
  notifyMin?: number;
  repeat?: Repeat;
  repeatInterval?: number;
  repeatUnit?: Unit;
  repeatUntil?: string | null;
}

/** Il contesto che serve a decidere i valori che l'utente non ha scelto. */
export interface Context {
  defaultCalendar: string | null;
  untitled: string;
  autoCategory: (title: string) => string | null;
  autoCalendar: (title: string) => { uuid: string; defRepeat: string; defNotify: string } | null;
}

/** I campi di una riga evento, come li scrive il sito. `explicit` = le chiavi che l'utente ha nominato. */
export function normalise(
  input: EventInput,
  ctx: Context,
  explicit: ReadonlySet<keyof EventInput>,
  isNew: boolean,
): Pick<
  EventRow,
  | 'title'
  | 'notes'
  | 'location'
  | 'place_name'
  | 'place_lat'
  | 'place_lon'
  | 'place_ref'
  | 'duration_locked'
  | 'event_date'
  | 'end_date'
  | 'start_time'
  | 'end_time'
  | 'is_all_day'
  | 'category_uuid'
  | 'calendar_uuid'
  | 'importance'
  | 'color'
  | 'item_type'
  | 'notify_type'
  | 'notify_minutes'
  | 'repeat_type'
  | 'repeat_interval'
  | 'repeat_unit'
  | 'repeat_until'
  | 'rrule'
> {
  const date = dateOrNull(input.date) ?? input.date;
  const allDay = !!input.allDay;
  const start = input.start ? timeOf(minutesOf(input.start)) : '09:00';
  let end = input.end ? timeOf(minutesOf(input.end)) : '10:00';

  // la data di fine: prima dell'inizio si riporta all'inizio; uguale = «un giorno solo» (nessuna); più lunga del massimo si taglia
  let endDate = input.endDate ? dateOrNull(input.endDate) : null;
  if (endDate !== null) {
    if (endDate < date) endDate = date;
    const limit = addDaysIso(date, MAX_EVENT_DAYS - 1);
    if (endDate > limit) endDate = limit;
    if (endDate === date) endDate = null;
  }
  // nello stesso giorno la fine dopo l'inizio; altrimenti +30 minuti (un evento che scavalca la mezzanotte ha end_date)
  if (endDate === null && minutesOf(end) <= minutesOf(start) && !allDay) {
    end = timeOf(Math.min(1439, minutesOf(start) + 30));
  }

  let title = (input.title ?? '').trim().slice(0, 180);
  let category = input.categoryUuid ?? null;
  if (category === null && title !== '') category = ctx.autoCategory(title);

  let calendar = input.calendarUuid ?? null;
  let repeat: string = input.repeat ?? 'none';
  let notify: string = input.notify ?? 'h1';
  let notifyMin = input.notifyMin;
  // chi non sceglie finisce nel calendario principale; i calendari dedotti dal titolo (parole chiave) contano
  // solo se non c'è un principale: come sul sito, dove il principale vince sempre
  if (calendar === null) calendar = ctx.defaultCalendar;
  if (calendar === null && title !== '') {
    const auto = ctx.autoCalendar(title);
    if (auto) {
      calendar = auto.uuid;
      if (isNew && !explicit.has('repeat') && auto.defRepeat !== 'none') repeat = auto.defRepeat;
      if (isNew && !explicit.has('notify') && auto.defNotify !== 'none') notify = auto.defNotify;
    }
  }
  if (title === '') title = ctx.untitled;

  const nMin =
    notify === 'custom'
      ? Math.max(0, Math.min(40320, Math.round(notifyMin ?? 60)))
      : (NOTIFY_MINUTES[notify as Exclude<Notify, 'custom'>] ?? 60);
  const interval = Math.max(1, Math.min(365, Math.round(input.repeatInterval ?? 1)));
  const unit = input.repeatUnit ?? 'week';
  const until = repeat === 'none' ? null : dateOrNull(input.repeatUntil);
  const lat = input.placeLat ?? null;
  const lon = input.placeLon ?? null;
  const hasPoint = lat !== null && lon !== null;

  return {
    title,
    notes: input.notes ?? '',
    location: input.location ?? '',
    place_name: input.placeName ? input.placeName : null,
    place_lat: hasPoint ? lat : null,
    place_lon: hasPoint ? lon : null,
    place_ref: input.placeRef ? input.placeRef : null,
    duration_locked: input.durationLocked === false ? 0 : 1,
    event_date: date,
    end_date: endDate,
    start_time: start,
    end_time: end,
    is_all_day: allDay ? 1 : 0,
    category_uuid: category,
    calendar_uuid: calendar,
    importance: input.importance ?? 'normal',
    color: input.color ?? null,
    item_type: input.type ?? 'event',
    notify_type: notify,
    notify_minutes: nMin,
    repeat_type: repeat,
    repeat_interval: interval,
    repeat_unit: unit,
    repeat_until: until,
    rrule: buildRrule(repeat, interval, unit, until),
  };
}

/** Da una riga alle scelte dell'utente (per modificarla e rifare la normalizzazione). */
export function inputOf(r: EventRow): EventInput {
  return {
    title: r.title,
    notes: r.notes ?? '',
    location: r.location ?? '',
    placeName: r.place_name,
    placeLat: r.place_lat,
    placeLon: r.place_lon,
    placeRef: r.place_ref,
    durationLocked: r.duration_locked === 1,
    date: r.event_date,
    endDate: r.end_date,
    start: r.start_time,
    end: r.end_time,
    allDay: r.is_all_day === 1,
    categoryUuid: r.category_uuid,
    calendarUuid: r.calendar_uuid,
    importance: r.importance as EventInput['importance'],
    color: r.color,
    type: r.item_type as EventInput['type'],
    notify: r.notify_type as Notify,
    notifyMin: r.notify_minutes,
    repeat: r.repeat_type as Repeat,
    repeatInterval: r.repeat_interval,
    repeatUnit: r.repeat_unit as Unit,
    repeatUntil: r.repeat_until,
  };
}
