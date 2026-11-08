import { fireEvent, render, screen } from '@testing-library/react-native';

import '@/core/i18n';
import { ThemeProvider, useTheme } from '@/core/theme/ThemeProvider';
import type { Habit } from '@/features/habits/logic';
import type { Project } from '@/features/projects/logic';

import { QuickAddSheet } from '../QuickAddSheet';
import { plannerTheme } from '../plannerTheme';

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

function Host({
  habits = [habit],
  projects = [proj],
  onPlace,
}: {
  habits?: Habit[];
  projects?: Project[];
  onPlace: jest.Mock;
}) {
  const th = useTheme();
  return (
    <QuickAddSheet
      visible
      pt={plannerTheme(th.style, th)}
      date="2026-11-04"
      habits={habits}
      logs={[]}
      projects={projects}
      defaultStart="14:30"
      onClose={() => {}}
      onPlace={onPlace}
    />
  );
}
const show = (props: Partial<Parameters<typeof Host>[0]> = {}, onPlace = jest.fn()) =>
  render(
    <ThemeProvider>
      <Host onPlace={onPlace} {...props} />
    </ThemeProvider>,
  );

describe('Quick add sheet', () => {
  test('lists habits and favourite projects; nothing to place until one is picked', async () => {
    await show();
    expect(screen.getByTestId('quick-habit-h1')).toBeOnTheScreen();
    expect(screen.getByTestId('quick-project-p1')).toBeOnTheScreen();
    expect(screen.queryByTestId('quick-place')).toBeNull();
  });

  test('picking a habit proposes the next half hour and its own length, then places it', async () => {
    const onPlace = jest.fn();
    await show({}, onPlace);
    await fireEvent.press(screen.getByTestId('quick-habit-h1'));
    expect(screen.getByTestId('quick-start').props.value).toBe('14:30');
    expect(screen.getByTestId('quick-minutes').props.value).toBe('45');
    await fireEvent.changeText(screen.getByTestId('quick-start'), '9:15');
    await fireEvent.press(screen.getByTestId('quick-place'));
    expect(onPlace).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'habit', uuid: 'h1' }),
      '09:15',
      45,
    );
  });

  test('a wrong hour keeps the button off', async () => {
    const onPlace = jest.fn();
    await show({}, onPlace);
    await fireEvent.press(screen.getByTestId('quick-project-p1'));
    await fireEvent.changeText(screen.getByTestId('quick-start'), '25:00');
    await fireEvent.press(screen.getByTestId('quick-place'));
    expect(onPlace).not.toHaveBeenCalled();
  });

  test('says so when there is nothing to add', async () => {
    await show({ habits: [], projects: [] });
    expect(screen.getAllByText(/Nessun|No /)).toHaveLength(2);
  });
});
