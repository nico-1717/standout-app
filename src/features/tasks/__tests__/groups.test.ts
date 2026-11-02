import {
  addDaysIso,
  doneDay,
  groupOf,
  groupTasks,
  isLate,
  localToday,
  sortLikeSite,
  visibleTasks,
} from '../groups';
import type { Task } from '../repo';

const mk = (title: string, o: Partial<Task> = {}): Task =>
  ({
    uuid: title,
    title,
    is_done: 0,
    due_date: null,
    due_time: null,
    sort_key: 'a0',
    ...o,
  }) as Task;

const TODAY = '2026-11-02'; // lunedì

test('groups like the website, in the website order, hiding empty groups', () => {
  const r = groupTasks(
    [
      mk('idea'),
      mk('settimana', { due_date: '2026-11-06' }),
      mk('domani', { due_date: '2026-11-03' }),
      mk('bolletta', { due_date: '2026-10-31' }),
      mk('oggi', { due_date: TODAY, due_time: '18:00' }),
      mk('dopo', { due_date: '2026-11-09' }),
      mk('fatta', { is_done: 1, due_date: '2026-10-01' }),
    ],
    TODAY,
    '10:00',
  );
  expect(r.map((x) => [x.group, x.tasks.map((t) => t.title)])).toEqual([
    ['ritardo', ['bolletta']],
    ['oggi', ['oggi']],
    ['domani', ['domani']],
    ['settimana', ['settimana']],
    ['dopo', ['dopo']],
    ['senza', ['idea']],
    ['fatte', ['fatta']],
  ]);
  expect(groupTasks([], TODAY)).toEqual([]);
});

test('today with a time already past is overdue; without a time it stays today', () => {
  const dent = mk('dentista', { due_date: TODAY, due_time: '09:30:00' });
  expect(isLate(dent, TODAY, '10:00')).toBe(true);
  expect(isLate(dent, TODAY, '09:00')).toBe(false);
  expect(groupOf(dent, TODAY, '10:00')).toBe('ritardo');
  expect(groupOf(mk('x', { due_date: TODAY }), TODAY, '23:59')).toBe('oggi');
  expect(isLate(mk('x', { is_done: 1, due_date: '2020-01-01' }), TODAY, '10:00')).toBe(false);
});

test('day 7 from today is "later", day 6 is "this week"', () => {
  expect(groupOf(mk('a', { due_date: '2026-11-08' }), TODAY, '10:00')).toBe('settimana');
  expect(groupOf(mk('b', { due_date: '2026-11-09' }), TODAY, '10:00')).toBe('dopo');
});

test('sortLikeSite: not done first, dated before undated, nearest first, time (none last), then manual order', () => {
  const s = sortLikeSite([
    mk('senza', { sort_key: 'a0' }),
    mk('fatta', { is_done: 1, due_date: '2026-11-01' }),
    mk('b-senza-ora', { due_date: TODAY, sort_key: 'a1' }),
    mk('b-ora', { due_date: TODAY, due_time: '20:00' }),
    mk('a', { due_date: '2026-11-01' }),
    mk('b-ora-prima', { due_date: TODAY, due_time: '08:00' }),
  ]).map((t) => t.title);
  expect(s).toEqual(['a', 'b-ora-prima', 'b-ora', 'b-senza-ora', 'senza', 'fatta']);
});

test('done tasks from previous days disappear', () => {
  const t = [
    { is_done: 1, done_at: '2026-11-01 22:10:00' },
    { is_done: 1, done_at: '2026-11-02 08:00:00' },
    { is_done: 1, done_at: null },
    { is_done: 0, done_at: null },
  ];
  expect(visibleTasks(t, TODAY)).toHaveLength(3);
  expect(doneDay('2026-11-02 08:00:00')).toBe('2026-11-02');
  expect(doneDay(null)).toBeNull();
});

test('date helpers', () => {
  expect(localToday(new Date(2026, 0, 5))).toBe('2026-01-05');
  expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
});
