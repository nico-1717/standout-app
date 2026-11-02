import { checkInUuid, uuid5 } from '@/core/sync/uuid5';

import {
  addDays,
  applyCheckIn,
  currentStreak,
  isDue,
  isoWeekday,
  type Habit,
  type LogStatus,
  dailyFor,
  dayMessageKey,
  dayProgress,
  ofKind,
  periodProgress,
  stateOf,
  perfectStreak,
  swipeAllowed,
  moveNeighbours,
  swipeMode,
  type HabitLog,
} from '../logic';

const base: Habit = {
  uuid: 'h',
  category_uuid: null,
  preset_key: null,
  name: 'x',
  icon: '⭐',
  color: '#7C5CFF',
  motivation: null,
  kind: 'build',
  goal_type: 'completion',
  target_amount: 1,
  step_amount: 1,
  unit: '',
  frequency_type: 'daily',
  weekdays: '1111111',
  times_per_week: 7,
  times_per_month: 30,
  interval_days: 1,
  day_part: 'any',
  duration_type: 'forever',
  duration_days: null,
  start_date: '2026-10-01',
  end_date: null,
  planner_minutes: null,
  is_archived: 0,
  sort_key: 'a0',
};
const h = (p: Partial<Habit>): Habit => ({ ...base, ...p });

describe('uuid5 (stessi valori del server, calcolati da PHP)', () => {
  it('check-in', () => {
    expect(checkInUuid('0194e1a0-1111-7222-8333-444455556666', '2026-11-02')).toBe(
      '4aa9b372-7dc4-50ac-9cab-03a5910a7fae',
    );
  });
  it('testo non ASCII', () => {
    expect(uuid5('habit_logs|è😀|x')).toBe('766278e1-4eb9-5243-a9ca-fe543fa74c3c');
  });
});

describe('date', () => {
  it('giorni e lunedì', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(isoWeekday('2026-11-02')).toBe(1); // lunedì
    expect(isoWeekday('2026-11-01')).toBe(7); // domenica
  });
});

describe('isDue', () => {
  it('giorni della settimana', () => {
    const a = h({ weekdays: '1111100' });
    expect(isDue(a, '2026-11-02')).toBe(true); // lun
    expect(isDue(a, '2026-11-07')).toBe(false); // sab
  });
  it("non prima dell'inizio, non dopo la fine", () => {
    expect(isDue(h({ start_date: '2026-11-05' }), '2026-11-04')).toBe(false);
    expect(isDue(h({ end_date: '2026-11-05' }), '2026-11-06')).toBe(false);
  });
  it('ogni N giorni', () => {
    const a = h({ frequency_type: 'interval', interval_days: 3, start_date: '2026-11-01' });
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => isDue(a, `2026-11-0${n}`))).toEqual([
      true,
      false,
      false,
      true,
      false,
      false,
      true,
    ]);
  });
  it('settimanali e mensili: ogni giorno', () => {
    expect(isDue(h({ frequency_type: 'weekly' }), '2026-11-03')).toBe(true);
  });
});

describe('applyCheckIn (come hb_log_imposta)', () => {
  it('toggle: fatto, poi annulla (riga tolta)', () => {
    const a = applyCheckIn(base, null, 'toggle');
    expect(a).toMatchObject({ status: 'done', amount: 1, completions: 1, removed: false });
    const b = applyCheckIn(base, a, 'toggle');
    expect(b).toMatchObject({ status: 'partial', amount: 0, removed: true });
  });
  it('quantità: 3 spunte su 8 = parziale, 8 = fatto, sotto zero no', () => {
    const q = h({ goal_type: 'quantity', target_amount: 8 });
    let s = applyCheckIn(q, null, 'increment');
    s = applyCheckIn(q, s, 'increment');
    s = applyCheckIn(q, s, 'increment');
    expect(s).toMatchObject({ status: 'partial', amount: 3, completions: 3 });
    expect(applyCheckIn(q, s, 'set', 8)).toMatchObject({ status: 'done', amount: 8 });
    expect(applyCheckIn(q, null, 'decrement')).toMatchObject({ amount: 0, removed: true });
  });
  it('set con passo 5: spunte = quantità / passo, arrotondate in su', () => {
    const q = h({ goal_type: 'quantity', target_amount: 20, step_amount: 5 });
    expect(applyCheckIn(q, null, 'set', 12)).toMatchObject({
      amount: 12,
      completions: 3,
      status: 'partial',
    });
  });
  it('saltata e di nuovo = torna normale', () => {
    const a = applyCheckIn(base, null, 'skip');
    expect(a).toMatchObject({ status: 'skipped', removed: false });
    expect(applyCheckIn(base, a, 'skip')).toMatchObject({ status: 'partial', removed: true });
  });
  it('da evitare: "ci sono cascato" e annulla', () => {
    const q = h({ kind: 'quit' });
    const f = applyCheckIn(q, null, 'fail');
    expect(f).toMatchObject({ status: 'failed', amount: 1 });
    expect(applyCheckIn(q, f, 'fail')).toMatchObject({ status: 'partial', amount: 0 });
    expect(applyCheckIn(q, null, 'toggle')).toMatchObject({ status: 'failed' });
  });
  it('da evitare a quantità: sotto il limite resta parziale', () => {
    const q = h({ kind: 'quit', goal_type: 'quantity', target_amount: 3 });
    expect(applyCheckIn(q, null, 'set', 2)).toMatchObject({ status: 'partial' });
    expect(applyCheckIn(q, null, 'set', 3)).toMatchObject({ status: 'failed' });
  });
  it('con una nota la riga non si toglie', () => {
    expect(applyCheckIn(base, null, 'clear', 0, true).removed).toBe(false);
  });
});

describe('currentStreak', () => {
  const run = (s: Record<string, LogStatus>, p: Partial<Habit> = {}, today = '2026-11-05') =>
    currentStreak(h(p), s, today);
  it("conta all'indietro; oggi non fatto non rompe", () => {
    expect(run({ '2026-11-04': 'done', '2026-11-03': 'done' })).toBe(2);
    expect(run({ '2026-11-05': 'done', '2026-11-04': 'done', '2026-11-03': 'done' })).toBe(3);
  });
  it('un giorno vuoto prima di oggi rompe; saltata no', () => {
    expect(run({ '2026-11-04': 'done', '2026-11-02': 'done' })).toBe(1);
    expect(run({ '2026-11-04': 'done', '2026-11-03': 'skipped', '2026-11-02': 'done' })).toBe(2);
  });
  it('i giorni non previsti non rompono', () => {
    // solo lun-ven: sab 31/10 e dom 1/11 non contano
    const s: Record<string, LogStatus> = {
      '2026-11-02': 'done',
      '2026-10-30': 'done',
      '2026-10-29': 'done',
    };
    expect(run(s, { weekdays: '1111100' }, '2026-11-03')).toBe(3);
  });
  it('da evitare: parte piena, solo "cascato" rompe', () => {
    expect(run({ '2026-11-02': 'failed' }, { kind: 'quit', start_date: '2026-10-25' })).toBe(3);
  });
  it("settimanale: periodi che hanno raggiunto l'obiettivo", () => {
    const w = { frequency_type: 'weekly' as const, times_per_week: 2, start_date: '2026-10-12' };
    const s: Record<string, LogStatus> = {
      '2026-11-03': 'done', // settimana in corso (lun 2/11), 1 su 2: non rompe
      '2026-10-27': 'done',
      '2026-10-29': 'done', // sett. 26/10 ok
      '2026-10-20': 'done',
      '2026-10-22': 'done', // sett. 19/10 ok
      '2026-10-13': 'done', // sett. 12/10 solo 1: rompe
    };
    expect(run(s, w)).toBe(2);
  });
});

const lg = (habit: string, day: string, status: LogStatus, amount: number): HabitLog => ({
  uuid: 'l',
  habit_uuid: habit,
  log_date: day,
  status,
  amount,
  completions: 0,
  target_amount: 1,
  note: null,
  mood: null,
});

describe('stateOf e avanzamento del giorno', () => {
  const today = '2026-11-05';
  it('da fare: vuoto, parziale, fatto, saltato', () => {
    expect(stateOf(base, today, null, today).status).toBe('empty');
    const q = h({ goal_type: 'quantity', target_amount: 8 });
    expect(stateOf(q, today, lg('h', today, 'partial', 2), today)).toMatchObject({
      status: 'partial',
      pct: 0.25,
    });
    expect(stateOf(q, today, lg('h', today, 'done', 8), today).status).toBe('done');
    expect(stateOf(base, today, lg('h', today, 'skipped', 0), today).status).toBe('skipped');
  });
  it('da evitare: parte «pulita», «cascato» = fallita', () => {
    const q = h({ kind: 'quit' });
    expect(stateOf(q, today, null, today).status).toBe('clean');
    expect(stateOf(q, '2026-11-06', null, today).status).toBe('empty'); // futuro
    expect(stateOf(q, today, lg('h', today, 'failed', 1), today).status).toBe('failed');
  });
  it('da evitare a quantità: il margine che resta', () => {
    const q = h({ kind: 'quit', goal_type: 'quantity', target_amount: 4 });
    expect(stateOf(q, today, lg('h', today, 'partial', 1), today)).toMatchObject({
      status: 'partial',
      pct: 0.75,
    });
  });
  it('avanzamento: solo giornaliere previste, le saltate non contano', () => {
    const a = h({ uuid: 'a' });
    const b = h({ uuid: 'b' });
    const c = h({ uuid: 'c' });
    const w = h({ uuid: 'w', frequency_type: 'weekly' });
    const logs = new Map<string, HabitLog>([
      [`a|${today}`, lg('a', today, 'done', 1)],
      [`c|${today}`, lg('c', today, 'skipped', 0)],
    ]);
    expect(dailyFor([a, b, c, w], today).map((x) => x.uuid)).toEqual(['a', 'b', 'c']);
    expect(dayProgress([a, b, c, w], today, logs, today)).toEqual({ done: 1, total: 2, pct: 0.5 });
    expect(dayMessageKey({ total: 2, pct: 0.5 })).toBe('abitudini.hai_iniziato_continua');
    expect(dayMessageKey({ total: 2, pct: 0.6 })).toBe('abitudini.ci_sei_quasi_tieni_il');
    expect(dayMessageKey({ total: 0, pct: 0 })).toBe('abitudini.nessuna_abitudine_prevista');
    expect(ofKind([a, w], 'weekly')).toHaveLength(1);
  });
  it('settimanali, mensili, a intervallo', () => {
    const w = h({ frequency_type: 'weekly', times_per_week: 3 });
    expect(periodProgress(w, '2026-11-05', ['2026-11-02', '2026-11-04', '2026-10-30'])).toEqual({
      done: 2,
      target: 3,
    });
    const m = h({ frequency_type: 'monthly', times_per_month: 10 });
    expect(periodProgress(m, '2026-11-05', ['2026-11-02', '2026-10-30'])).toEqual({
      done: 1,
      target: 10,
    });
    const i = h({ frequency_type: 'interval', interval_days: 3, start_date: '2026-11-01' });
    expect(periodProgress(i, '2026-11-05', [])).toMatchObject({ done: 0, daysToNext: 2, step: 3 }); // turno 4-6: oggi è il 2° giorno, il prossimo fra 2
    expect(periodProgress(i, '2026-11-05', ['2026-11-04']).done).toBe(1);
  });
});

describe('perfectStreak', () => {
  it('conta i giorni con tutto fatto; oggi incompleto non rompe', () => {
    const a = h({ uuid: 'a', start_date: '2026-11-01' });
    const logs = new Map<string, HabitLog>([
      ['a|2026-11-04', lg('a', '2026-11-04', 'done', 1)],
      ['a|2026-11-03', lg('a', '2026-11-03', 'done', 1)],
    ]);
    expect(perfectStreak([a], logs, '2026-11-05')).toBe(2);
    logs.set('a|2026-11-05', lg('a', '2026-11-05', 'done', 1));
    expect(perfectStreak([a], logs, '2026-11-05')).toBe(3);
  });
  it('un giorno non perfetto prima di oggi la spezza', () => {
    const a = h({ uuid: 'a', start_date: '2026-11-01' });
    const logs = new Map<string, HabitLog>([['a|2026-11-04', lg('a', '2026-11-04', 'done', 1)]]);
    expect(perfectStreak([a], logs, '2026-11-05')).toBe(1);
    expect(perfectStreak([a], new Map(), '2026-11-05')).toBe(0);
  });
});

describe('swipeAllowed / swipeMode (come il sito)', () => {
  const TODAY = '2026-11-02';
  const st = (x: Habit, log: Partial<HabitLog> | null) =>
    stateOf(x, TODAY, log ? ({ ...log } as HabitLog) : null, TODAY);

  test('completion: right = do, left = undo, only when it changes something', () => {
    const a = h({});
    expect(swipeAllowed(a, st(a, null), 1)).toBe(true);
    expect(swipeAllowed(a, st(a, null), -1)).toBe(false);
    const done = st(a, { status: 'done', amount: 1, completions: 1 });
    expect(swipeAllowed(a, done, 1)).toBe(false);
    expect(swipeAllowed(a, done, -1)).toBe(true);
    expect(swipeMode(a, 1)).toBe('toggle');
  });

  test('quit: right = "I slipped", left = undo the slip', () => {
    const q = h({ kind: 'quit' });
    expect(swipeAllowed(q, st(q, null), 1)).toBe(true);
    expect(swipeAllowed(q, st(q, null), -1)).toBe(false);
    const failed = st(q, { status: 'failed', amount: 1, completions: 1 });
    expect(swipeAllowed(q, failed, 1)).toBe(false);
    expect(swipeAllowed(q, failed, -1)).toBe(true);
    expect(swipeMode(q, 1)).toBe('fail');
    expect(swipeMode(q, -1)).toBe('fail');
  });

  test('quantity: always up, down only above zero', () => {
    const w = h({ goal_type: 'quantity', target_amount: 8, step_amount: 1 });
    expect(swipeAllowed(w, st(w, null), 1)).toBe(true);
    expect(swipeAllowed(w, st(w, null), -1)).toBe(false);
    expect(swipeAllowed(w, st(w, { status: 'partial', amount: 3, completions: 3 }), -1)).toBe(true);
    expect(swipeMode(w, 1)).toBe('increment');
    expect(swipeMode(w, -1)).toBe('decrement');
  });
});

describe('moveNeighbours (riordino)', () => {
  const list = ['a', 'b', 'c', 'd'].map((uuid) => ({ uuid }));
  test('to the top, the middle and the bottom', () => {
    expect(moveNeighbours(list, 'c', 0)).toEqual([null, 'a']);
    expect(moveNeighbours(list, 'a', 2)).toEqual(['c', 'd']); // b c [a] d
    expect(moveNeighbours(list, 'a', 3)).toEqual(['d', null]);
    expect(moveNeighbours(list, 'd', 1)).toEqual(['a', 'b']);
  });
});
