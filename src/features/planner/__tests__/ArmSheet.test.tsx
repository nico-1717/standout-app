import { fireEvent, render, screen } from '@testing-library/react-native';

import '@/core/i18n';
import { ThemeProvider, useTheme } from '@/core/theme/ThemeProvider';
import type { Habit } from '@/features/habits/logic';
import type { Project } from '@/features/projects/logic';

import { ArmSheet, type ArmMode } from '../ArmSheet';
import type { Armed } from '../armed';
import { plannerTheme } from '../plannerTheme';
import type { Category } from '../repo';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const habit = {
  uuid: 'h1',
  name: 'Read',
  icon: '📖',
  color: '#3366CC',
  kind: 'build',
  frequency_type: 'daily',
  weekdays: '1111111',
  times_per_week: 7,
  start_date: '2026-10-01',
  end_date: null,
  planner_minutes: 45,
  is_archived: 0,
} as unknown as Habit;
const proj = { uuid: 'p1', name: 'Thesis', color: '#aa5500', is_favorite: 1 } as unknown as Project;
const cat = { uuid: 'c1', name: 'Health', color: '#C77D7D' } as unknown as Category;

function Host({
  mode,
  habits = [habit],
  projects = [proj],
  onArm,
}: {
  mode: ArmMode;
  habits?: Habit[];
  projects?: Project[];
  onArm: (a: Armed) => void;
}) {
  const th = useTheme();
  return (
    <ArmSheet
      mode={mode}
      pt={plannerTheme(th.style, th)}
      date="2026-11-04"
      habits={habits}
      logs={[]}
      projects={projects}
      categories={[cat]}
      onClose={() => {}}
      onArm={onArm}
    />
  );
}
const show = (mode: ArmMode, props: Partial<Parameters<typeof Host>[0]> = {}, onArm = jest.fn()) =>
  render(
    <ThemeProvider>
      <Host mode={mode} onArm={onArm} {...props} />
    </ThemeProvider>,
  );

describe('Arm sheet', () => {
  test('habits mode lists the habits of the day, not the projects', async () => {
    await show('habits');
    expect(screen.getByTestId('quick-habit-h1')).toBeOnTheScreen();
    expect(screen.queryByTestId('quick-project-p1')).toBeNull();
  });

  test('picking a habit arms it with its own length', async () => {
    const onArm = jest.fn();
    await show('habits', {}, onArm);
    await fireEvent.press(screen.getByTestId('quick-habit-h1'));
    expect(onArm).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'habit', uuid: 'h1', minutes: 45 }),
    );
  });

  test('projects mode arms a favourite project', async () => {
    const onArm = jest.fn();
    await show('projects', {}, onArm);
    await fireEvent.press(screen.getByTestId('quick-project-p1'));
    expect(onArm).toHaveBeenCalledWith(expect.objectContaining({ kind: 'project', uuid: 'p1' }));
  });

  test('categories mode arms a category', async () => {
    const onArm = jest.fn();
    await show('categories', {}, onArm);
    await fireEvent.press(screen.getByTestId('arm-cat-c1'));
    expect(onArm).toHaveBeenCalledWith(expect.objectContaining({ kind: 'category', uuid: 'c1' }));
  });

  test('says so when there is nothing to add', async () => {
    await show('projects', { projects: [] });
    expect(screen.getAllByText(/Nessun|No /).length).toBeGreaterThan(0);
  });
});
