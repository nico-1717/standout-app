import { fireEvent, render, screen } from '@testing-library/react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { PlanRepo } from '@/features/plan/repo';
import { PomodoroRepo } from '@/features/pomodoro/repo';
import { ProjectOptionsStore } from '@/features/projects/options';
import { ProjectsRepo } from '@/features/projects/repo';

import PlanScreen from '../plan';
import ProjectScreen from '../project';

const TODAY = new Date(2030, 2, 4, 10, 0, 0); // lunedì 4 marzo 2030

let mockServices: unknown;
let mockVersion = 0;
let mockParams: Record<string, string> = {};
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockChanged = jest.fn(() => {
  mockVersion += 1;
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({
    services: mockServices,
    version: mockVersion,
    changed: mockChanged,
    pomodoroSettings: { last_pomodoro_duration_min: 25 },
  }),
}));

function setup() {
  mockVersion = 0;
  mockParams = {};
  mockPush.mockClear();
  mockBack.mockClear();
  const db = memoryDb();
  migrate(db);
  let n = 0;
  const ids = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const projects = new ProjectsRepo(db, () => '2030-03-04T09:00:00Z', ids);
  const plan = new PlanRepo(
    db,
    7,
    () => TODAY,
    () => '2030-03-04T09:00:00Z',
    ids,
  );
  plan.saveSettings({
    weekdayMin: 120,
    weekendMin: 60,
    restDow: 0,
    bufferDays: 0,
    floorMin: 15,
    maxSubjects: 3,
    reviews: false,
    overrides: {},
  });
  mockServices = {
    db,
    projects,
    plan,
    pomodoro: new PomodoroRepo(db, 7),
    projectOptions: new ProjectOptionsStore(db),
  };
  return { db, projects, plan };
}
const tree = (el: React.ReactElement) => <ThemeProvider>{el}</ThemeProvider>;

describe('plan screen', () => {
  test('Today lists the blocks and the play button opens the timer with the minutes left', async () => {
    const { projects, plan } = setup();
    const a = projects.create({ name: 'Analisi' })!;
    plan.saveGoal(a, { minutes: 300 });
    plan.setDay(a, '2030-03-04', 60);
    await render(tree(<PlanScreen />));
    expect(screen.getByTestId(`block-${a}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`block-play-${a}`));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/pomodoro',
      params: { project: a, min: '60' },
    });
  });

  test('an every-day block asks first: start the timer (auto) or say it is done', async () => {
    const { projects, plan } = setup();
    const a = projects.create({ name: 'Podcast' })!;
    plan.saveGoal(a, { kind: 'daily', minutes: 10 });
    plan.autoplan(null, true);
    await render(tree(<PlanScreen />));
    await fireEvent.press(screen.getByTestId(`block-play-${a}`));
    expect(screen.getByTestId('daily-sheet')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('daily-start'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/pomodoro',
      params: { project: a, min: '10', auto: '1' },
    });
  });

  test('a skipped block can be moved to the day with room', async () => {
    const { projects, plan, db } = setup();
    const a = projects.create({ name: 'A' })!;
    plan.saveGoal(a, { minutes: 300 });
    plan.setDay(a, '2030-03-03', 60);
    await render(tree(<PlanScreen />));
    await fireEvent.press(screen.getByTestId(`skip-move-${a}`));
    expect(mockChanged).toHaveBeenCalled();
    const rows = db.all<{ day: string; minutes: number }>(
      'SELECT day, minutes FROM plan_days WHERE project_uuid = ? ORDER BY day',
      [a],
    );
    expect(rows.map((r) => r.day)).toContain('2030-03-04');
  });

  test('the tabs switch between Calendar, Timeline and Overview', async () => {
    setup();
    await render(tree(<PlanScreen />));
    await fireEvent.press(screen.getByTestId('plan-tab-line'));
    expect(screen.getByTestId('tl-empty')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('plan-tab-plan'));
    expect(screen.getByTestId('ov-empty-title')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('plan-tab-cal'));
    expect(screen.queryByTestId('ov-empty-title')).toBeNull();
  });

  test('with a project in the link only its calendar shows, with no tabs', async () => {
    const { projects } = setup();
    const a = projects.create({ name: 'Tesi' })!;
    mockParams = { project: a };
    await render(tree(<PlanScreen />));
    expect(screen.queryByTestId('plan-tab-today')).toBeNull();
    expect(screen.getAllByText('Tesi').length).toBeGreaterThan(0);
  });

  test('the Timeline draws a bar for days in a row and opens the project when tapped', async () => {
    const { projects, plan } = setup();
    const a = projects.create({ name: 'Analisi' })!;
    plan.paint(a, 'add', ['2030-03-05', '2030-03-06']);
    plan.saveGoal(a, { minutes: 120 });
    plan.setDay(a, '2030-03-07', 60);
    await render(tree(<PlanScreen />));
    await fireEvent.press(screen.getByTestId('plan-tab-line'));
    expect(screen.queryByTestId('tl-empty')).toBeNull();
    await fireEvent.press(screen.getByTestId(`tl-bar-${a}-1`));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/project', params: { id: a } });
  });

  test('Calendar: pick a project, tap days to highlight them, undo, and look at a day', async () => {
    const { projects, plan } = setup();
    const a = projects.create({ name: 'Analisi' })!;
    plan.saveGoal(a, { minutes: 120 });
    await render(tree(<PlanScreen />));
    await fireEvent.press(screen.getByTestId('plan-tab-cal'));
    await fireEvent.press(screen.getByTestId(`cal-chip-${a}`));
    await fireEvent.press(screen.getByTestId('cal-day-2030-03-06'));
    await fireEvent.press(screen.getByTestId('cal-day-2030-03-07'));
    expect([...(plan.painted('2030-03-01', '2030-03-31').get(a) ?? [])].sort()).toEqual([
      '2030-03-06',
      '2030-03-07',
    ]);
    await fireEvent.press(screen.getByTestId('cal-undo'));
    expect([...(plan.painted('2030-03-01', '2030-03-31').get(a) ?? [])]).toEqual(['2030-03-06']);
    await fireEvent.press(screen.getByTestId('cal-tool-look'));
    await fireEvent.press(screen.getByTestId('cal-day-2030-03-06'));
    expect(screen.getByTestId('day-sheet')).toBeTruthy();
  });

  test('the free-time sheet saves the new hours', async () => {
    const { plan } = setup();
    await render(tree(<PlanScreen />));
    await fireEvent.press(screen.getByTestId('plan-time'));
    expect(screen.getByTestId('time-sheet')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('time-save'));
    expect(plan.settings().weekdayEff).toBe(120);
  });

  test('Plan for me shows the preview and applying it fills the calendar', async () => {
    const { projects, plan } = setup();
    const a = projects.create({ name: 'A' })!;
    plan.saveGoal(a, { minutes: 240, kind: 'exam', deadline: '2030-03-20' });
    await render(tree(<PlanScreen />));
    await fireEvent.press(screen.getByTestId('plan-tab-plan'));
    await fireEvent.press(screen.getByTestId('ov-autoplan'));
    expect(screen.getByTestId('autoplan-sheet')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('autoplan-apply'));
    expect(plan.blocks('2030-03-04', '2030-03-31').reduce((s, b) => s + b.minutes, 0)).toBe(240);
  });
});

describe('project Plan card', () => {
  test('shows no time yet, then saves hours from the sheet and shows the summary', async () => {
    const { projects, plan } = setup();
    const a = projects.create({ name: 'Fisica' })!;
    mockParams = { id: a };
    const view = await render(tree(<ProjectScreen />));
    expect(screen.getByTestId('plan-card-empty')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('plan-card-edit'));
    expect(screen.getByTestId('goal-sheet')).toBeTruthy();
    for (let i = 0; i < 4; i++) await fireEvent.press(screen.getByTestId('goal-hours-plus'));
    await fireEvent.press(screen.getByTestId('goal-save'));
    expect(plan.goals().get(a)?.minutes).toBe(60);
    await view.rerender(tree(<ProjectScreen />));
    expect(screen.getByTestId('plan-card-summary')).toBeTruthy();
  });

  test('the calendar button opens the plan page scoped to the project', async () => {
    const { projects } = setup();
    const a = projects.create({ name: 'Fisica' })!;
    mockParams = { id: a };
    await render(tree(<ProjectScreen />));
    await fireEvent.press(screen.getByTestId('plan-card-calendar'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/plan',
      params: { project: a, tab: 'cal' },
    });
  });

  test('a project with sub-projects splits its time among them', async () => {
    const { projects, plan } = setup();
    const a = projects.create({ name: 'Esame' })!;
    const k1 = projects.create({ name: 'Cap 1', parent: a })!;
    const k2 = projects.create({ name: 'Cap 2', parent: a })!;
    plan.saveGoal(a, { minutes: 240 });
    plan.resplit(a, 240);
    mockParams = { id: a };
    await render(tree(<ProjectScreen />));
    expect(screen.getByTestId('plan-card-split')).toBeTruthy();
    expect((plan.goals().get(k1)?.minutes ?? 0) + (plan.goals().get(k2)?.minutes ?? 0)).toBe(240);
  });

  test('an every-day project offers the focus button', async () => {
    const { projects, plan } = setup();
    const a = projects.create({ name: 'Podcast' })!;
    plan.saveGoal(a, { kind: 'daily', minutes: 10 });
    mockParams = { id: a };
    await render(tree(<ProjectScreen />));
    await fireEvent.press(screen.getByTestId('plan-card-focus'));
    await fireEvent.press(screen.getByTestId('daily-start'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/pomodoro',
      params: { project: a, min: '10', auto: '1' },
    });
  });
});
