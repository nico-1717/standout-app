import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { HabitsRepo } from '@/features/habits/repo';
import { PillsRepo } from '@/features/pills/repo';
import { PlannerRepo } from '@/features/planner/repo';
import { TasksRepo } from '@/features/tasks/repo';

import { DEFAULT_HOME_LAYOUT, HomeLayoutStore, cleanHomeLayout, type HomeWidget } from '../layout';
import { addDay, buildToday, minutesText } from '../today';
import { isQuote, pickTrivia } from '../trivia';

function setup() {
  const db = memoryDb();
  migrate(db);
  const planner = new PlannerRepo(db, undefined, undefined, undefined, 7);
  const tasks = new TasksRepo(db);
  const habits = new HabitsRepo(db, undefined, undefined, () => '2030-03-05');
  const pills = new PillsRepo(
    db,
    () => '2030-03-05',
    () => '2030-03-05 10:00:00',
  );
  return { db, planner, tasks, habits, pills };
}

describe('layout', () => {
  test('cleaning drops unknown and duplicate widgets and puts missing ones last, switched on', () => {
    const out = cleanHomeLayout([
      { id: 'trivia', on: false },
      { id: 'nope', on: true },
      { id: 'trivia', on: true },
      { id: 'shortcuts', on: true, order: ['planner/todo.php', 'planner/todo.php', 'bad href!'] },
    ]);
    expect(out.map((w) => w.id).slice(0, 2)).toEqual(['trivia', 'shortcuts']);
    expect(out[0]).toEqual({ id: 'trivia', on: false });
    expect(out[1]).toEqual({ id: 'shortcuts', on: true, order: ['planner/todo.php'] });
    expect(out).toHaveLength(8);
    expect(out.slice(2).every((w) => w.on)).toBe(true);
    expect(cleanHomeLayout('x')).toEqual(DEFAULT_HOME_LAYOUT);
  });

  test('the phone keeps the layout and sends the whole list once, then follows the server', async () => {
    const { db } = setup();
    const store = new HomeLayoutStore(db);
    expect(store.read()).toEqual(DEFAULT_HOME_LAYOUT);
    const mine = DEFAULT_HOME_LAYOUT.map((w) => (w.id === 'stats' ? { ...w, on: false } : w));
    store.write(mine);
    expect(store.hasPending()).toBe(true);
    const put = jest.fn(async (l: HomeWidget[]) => l);
    const get = jest.fn(async () => DEFAULT_HOME_LAYOUT);
    await store.sync({ putHomeLayout: put, getHomeLayout: get });
    expect(put).toHaveBeenCalledTimes(1);
    expect(get).not.toHaveBeenCalled();
    expect(store.hasPending()).toBe(false);
    expect(store.read().find((w) => w.id === 'stats')!.on).toBe(false);
    await store.sync({ putHomeLayout: put, getHomeLayout: get });
    expect(get).toHaveBeenCalledTimes(1);
    expect(store.read()).toEqual(DEFAULT_HOME_LAYOUT);
  });
});

describe('trivia', () => {
  test('picks by the random number, in the app language, with a fallback', () => {
    expect(pickTrivia('it', 0).domanda).toMatch(/Romania/);
    expect(pickTrivia('en', 0).domanda).toBeTruthy();
    expect(pickTrivia('fr', 0.999)).toBeTruthy();
    expect(isQuote({ tipo: 'quote - x', domanda: '', risposta: '' })).toBe(true);
    expect(isQuote({ tipo: 'trivia - x', domanda: '', risposta: '' })).toBe(false);
  });
});

describe('today', () => {
  test('small helpers', () => {
    expect(minutesText(45)).toBe('45 min');
    expect(minutesText(130)).toBe('2 h 10');
    expect(minutesText(120)).toBe('2 h');
    expect(addDay('2030-03-31', 1)).toBe('2030-04-01');
  });

  test('now / next event, tomorrow, important date, tasks due and shopping picks', () => {
    const { planner, tasks, habits, pills } = setup();
    const now = new Date(2030, 2, 5, 10, 30); // 5 marzo 2030, 10:30
    planner.create({ title: 'Lecture', date: '2030-03-05', start: '10:00', end: '11:00' });
    planner.create({ title: 'Gym', date: '2030-03-05', start: '18:00', end: '19:00' });
    planner.create({ title: 'Dentist', date: '2030-03-06', start: '09:00', end: '09:30' });
    planner.create({
      title: 'Exam',
      date: '2030-03-09',
      allDay: true,
      importance: 'highest',
    });
    tasks.create({ title: 'Late one', due_date: '2030-03-04' });
    tasks.create({ title: 'Today one', due_date: '2030-03-05' });
    tasks.create({ title: 'Later', due_date: '2030-03-20' });
    tasks.create({ title: 'Milk' }, { listType: 'buy' });
    const d = buildToday({ planner, habits, pills, tasks }, now);
    expect(d.current?.title).toBe('Lecture');
    expect(d.next?.title).toBe('Gym');
    expect(d.events.map((e) => e.title)).toEqual(['Lecture', 'Gym']);
    expect(d.tomorrowEvents.map((e) => e.title)).toEqual(['Dentist']);
    expect(d.important[0]).toMatchObject({ title: 'Exam', days: 4, strong: true });
    expect(d.todos.map((x) => x.title).sort()).toEqual(['Late one', 'Today one']);
    expect(d.buy.map((x) => x.title)).toEqual(['Milk']);
    expect(d.buyOpen).toBe(1);
    expect(d.hasPills).toBe(false);
    expect(d.rings).toEqual([]);
  });

  test('after the last event of the day nothing is next, and a done event is never "now"', () => {
    const { planner, tasks, habits, pills } = setup();
    planner.create({ title: 'Early', date: '2030-03-05', start: '08:00', end: '09:00' });
    const d = buildToday({ planner, habits, pills, tasks }, new Date(2030, 2, 5, 20, 0));
    expect(d.current).toBeNull();
    expect(d.next).toBeNull();
    expect(d.events).toHaveLength(1);
  });
});
