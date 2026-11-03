import type { HabitLog } from '../logic';
import { checkInHours } from '../stats';

const log = (day: string, at: string | null, status: HabitLog['status'] = 'done'): HabitLog => ({
  uuid: `${day}-${at}`,
  habit_uuid: 'h',
  log_date: day,
  status,
  amount: 1,
  completions: 1,
  target_amount: 1,
  note: null,
  mood: null,
  first_logged_at: at,
});

describe('check-in hours ("when you get going")', () => {
  test('counts done and partial check-ins in the last 90 days by hour', () => {
    const today = '2026-11-03';
    const logs = [
      log('2026-11-03', '2026-11-03 09:10:00'),
      log('2026-11-02', '2026-11-02 09:50:00', 'partial'),
      log('2026-11-01', '2026-11-01 21:00:00'),
      log('2026-11-01', '2026-11-01 07:00:00', 'skipped'), // non conta
      log('2026-11-01', '2026-11-01 08:00:00', 'failed'), // non conta
      log('2026-07-01', '2026-07-01 12:00:00'), // oltre 90 giorni
      log('2026-11-02', null), // senza orario
    ];
    const h = checkInHours(logs, today);
    expect(h).toHaveLength(24);
    expect(h[9]).toBe(2);
    expect(h[21]).toBe(1);
    expect(h.reduce((a, b) => a + b, 0)).toBe(3);
  });

  test('an ISO time with a zone is read in local time', () => {
    const iso = '2026-11-03T08:30:00.000Z';
    const h = checkInHours([log('2026-11-03', iso)], '2026-11-03');
    expect(h[new Date(iso).getHours()]).toBe(1);
  });

  test('the first and the last day of the window count', () => {
    const logs = [
      log('2026-08-06', '2026-08-06 10:00:00'),
      log('2026-08-05', '2026-08-05 10:00:00'),
    ];
    expect(checkInHours(logs, '2026-11-03')[10]).toBe(1); // 90 giorni: dal 6 agosto
  });
});
