import { checkInUuid, uuid5 } from '@/core/sync/uuid5';

import {
  addDays,
  applyCheckIn,
  currentStreak,
  isDue,
  isoWeekday,
  type Habit,
  type LogStatus,
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
