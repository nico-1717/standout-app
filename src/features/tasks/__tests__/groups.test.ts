import { groupTasks, localToday } from '../groups';
import type { Task } from '../repo';

const mk = (title: string, o: Partial<Task> = {}): Task =>
  ({ uuid: title, title, is_done: 0, due_date: null, sort_key: 'a0', ...o }) as Task;

test('groups by overdue / today / later / done and hides empty groups', () => {
  const r = groupTasks(
    [
      mk('a', { due_date: '2026-10-31' }),
      mk('b', { due_date: '2026-11-01' }),
      mk('c'),
      mk('d', { due_date: '2026-11-09' }),
      mk('e', { is_done: 1, due_date: '2026-10-01' }),
    ],
    '2026-11-01',
  );
  expect(r.map((x) => [x.group, x.tasks.map((t) => t.title)])).toEqual([
    ['overdue', ['a']],
    ['today', ['b']],
    ['later', ['c', 'd']],
    ['done', ['e']],
  ]);
  expect(groupTasks([], '2026-11-01')).toEqual([]);
});

test('localToday formats with zero padding', () => {
  expect(localToday(new Date(2026, 0, 5))).toBe('2026-01-05');
});
