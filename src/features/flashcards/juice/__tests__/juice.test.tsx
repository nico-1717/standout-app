import { fireEvent, render, screen } from '@testing-library/react-native';

import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';

import type { BlockSummary, Due } from '../../gameJuice';
import { CheckpointSheet } from '../CheckpointSheet';
import { RoadTrack } from '../RoadTrack';
import { StreakPill, flameColor } from '../StreakPill';

jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({ localPrefs: { fcCheckpoint: 10, fcSounds: true }, updateLocalPrefs: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const wrap = (el: React.ReactElement) => <ThemeProvider>{el}</ThemeProvider>;

describe('StreakPill', () => {
  test('hidden below two in a row, shows the count from two', async () => {
    await render(wrap(<StreakPill n={1} />));
    expect(screen.queryByTestId('fcg-streak')).toBeNull();
    await render(wrap(<StreakPill n={7} />));
    expect(screen.getByTestId('fcg-streak')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
  });

  test('the flame warms up with the streak steps', () => {
    expect(flameColor(2)).toBe('#FF9F0A');
    expect(flameColor(5)).toBe('#FF6B00');
    expect(flameColor(12)).toBe('#FF375F');
    expect(flameColor(31)).toBe('#BF5AF2');
  });
});

describe('RoadTrack', () => {
  const model = { tot: 30, pos: 14, front: 14, done: 14, cp: [] };

  async function road(onErrors = jest.fn(), wrong: number[] = [3, 4, 15]) {
    await render(
      wrap(
        <RoadTrack
          model={model}
          every={10}
          wrong={wrong}
          accent="#B79CFF"
          title={null}
          onErrors={onErrors}
        />,
      ),
    );
    await fireEvent(screen.getByLabelText('Game progress'), 'layout', {
      nativeEvent: { layout: { width: 300, height: 26, x: 0, y: 0 } },
    });
    return onErrors;
  }

  test('one disc per stretch; the ones with errors are buttons that open that stretch', async () => {
    const onErrors = await road();
    // tratti 1–10, 11–20, 21–30
    expect(screen.getByTestId('fcg-disc-1')).toBeTruthy();
    expect(screen.getByTestId('fcg-disc-11')).toBeTruthy();
    expect(screen.getByTestId('fcg-disc-21')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fcg-disc-1'));
    expect(onErrors).toHaveBeenCalledWith(1, 10);
    await fireEvent.press(screen.getByTestId('fcg-disc-11'));
    expect(onErrors).toHaveBeenCalledWith(11, 20);
  });

  test('the ring to the next checkpoint is there with checkpoints on', async () => {
    await road();
    expect(screen.getByTestId('fcg-road-ring')).toBeTruthy();
  });
});

describe('CheckpointSheet', () => {
  const due: Due = { k: 1, from: 1, to: 10, end: false };
  const summary: BlockSummary = {
    correct: 8,
    wrong: 2,
    perCard: 4.2,
    nailed: [{ target: 'a', isChild: false, position: 1 }],
    missed: [{ target: 'b', isChild: false, position: 2 }],
  };

  test('shows the accuracy, records, chips and the boss button; buttons call back', async () => {
    const onContinue = jest.fn();
    const onBoss = jest.fn();
    await render(
      wrap(
        <CheckpointSheet
          visible
          due={due}
          count={3}
          summary={summary}
          bestStreak={6}
          records={[{ icon: '⏱️', text: 'Fastest level' }]}
          labelOf={(t) => `card ${t}`}
          bursts={[]}
          onBurstDone={jest.fn()}
          onContinue={onContinue}
          onBoss={onBoss}
        />,
      ),
    );
    expect(screen.getByLabelText(/80%/)).toBeTruthy();
    expect(screen.getByTestId('fcg-ck-streak')).toHaveTextContent('🔥 6');
    expect(screen.getByTestId('fcg-ck-record-0')).toBeTruthy();
    expect(screen.getByText('card a')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fcg-ck-boss'));
    expect(onBoss).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('fcg-ck-continue'));
    expect(onContinue).toHaveBeenCalled();
  });

  test('with no mistakes there is no boss button', async () => {
    await render(
      wrap(
        <CheckpointSheet
          visible
          due={{ ...due, end: true }}
          count={1}
          summary={{ ...summary, wrong: 0, missed: [] }}
          bestStreak={8}
          records={[]}
          labelOf={() => ''}
          bursts={[]}
          onBurstDone={jest.fn()}
          onContinue={jest.fn()}
          onBoss={jest.fn()}
        />,
      ),
    );
    expect(screen.queryByTestId('fcg-ck-boss')).toBeNull();
    expect(screen.getByLabelText(/100%/)).toBeTruthy();
  });
});
