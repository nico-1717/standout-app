import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';

import { PlanOverview } from '../PlanOverview';
import type { MasterGoal, MasterView } from '../view';

const goal = (p: Partial<MasterGoal>): MasterGoal => ({
  project: 'p1',
  name: 'Maths',
  color: '#FF9500',
  status: 'active',
  active: true,
  kind: 'plain',
  priority: 'should',
  minutes: 600,
  done: 150,
  planned: 450,
  missing: 0,
  deadline: null,
  kids: 0,
  ...p,
});

const view = (goals: MasterGoal[]): MasterView => ({
  goals,
  weeks: [{ start: '2026-11-23', cap: 600, parts: { p1: 300 } }],
  neededMin: 1200,
  freeMin: 2400,
  missingMin: 0,
  fits: true,
  end: '2026-12-31',
  units: 2,
  available: [],
});

const show = (v: MasterView) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <ThemeProvider>
        <PlanOverview
          view={v}
          lang="en"
          onOpen={() => {}}
          onTime={() => {}}
          onAutoplan={() => {}}
        />
      </ThemeProvider>
    </SafeAreaProvider>,
  );

describe('PlanOverview clarity', () => {
  it('names the project colours and says how much of each goal is done', async () => {
    await show(view([goal({}), goal({ project: 'p2', name: 'English', missing: 120, done: 0 })]));
    expect(screen.getByTestId('ov-legend')).toBeTruthy();
    expect(screen.getAllByText('Maths').length).toBeGreaterThan(1); // legend + row
    expect(screen.getByText('2 h 30 min of 10 h done')).toBeTruthy();
    expect(screen.getByText('Fits')).toBeTruthy();
    expect(screen.getByText('Short by 2 h')).toBeTruthy();
  });
});
