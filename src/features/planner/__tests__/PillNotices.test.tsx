import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import '@/core/i18n';
import { ThemeProvider, useTheme } from '@/core/theme/ThemeProvider';
import type { DoseView } from '@/features/pills/repo';
import { SETTLE_MS } from '@/features/pills/settle';

import { PillNotices } from '../PillNotices';
import { plannerTheme } from '../plannerTheme';

const dose = (o: Partial<DoseView>): DoseView => ({
  uuid: 'd1',
  plan_uuid: 'p1',
  due_date: '2026-11-05',
  due_time: '08:00',
  seq: 0,
  status: 'pending',
  taken_at: null,
  name: 'Vitamina D',
  plan_dose: '1 compressa',
  color: '#3B82F6',
  notes: '',
  ...o,
});

function Host({
  doses,
  onAnswer,
  onAnswerAll,
  onReview,
}: {
  doses: DoseView[];
  onAnswer: (u: string, s: 'taken' | 'skipped') => void;
  onAnswerAll?: (u: string[]) => void;
  onReview?: () => void;
}) {
  const th = useTheme();
  return (
    <PillNotices
      doses={doses}
      today="2026-11-05"
      pt={plannerTheme(th.style, th)}
      bottom={18}
      onAnswer={onAnswer}
      onAnswerAll={onAnswerAll}
      onReview={onReview}
    />
  );
}
const renderIt = (
  doses: DoseView[],
  onAnswer = jest.fn(),
  extra: { onAnswerAll?: (u: string[]) => void; onReview?: () => void } = {},
) =>
  render(
    <ThemeProvider>
      <Host doses={doses} onAnswer={onAnswer} {...extra} />
    </ThemeProvider>,
  );

const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((u) => dose({ uuid: u }));

describe('Pill notices in the planner', () => {
  test('shows nothing when no pill is waiting', async () => {
    await renderIt([]);
    expect(screen.queryByTestId('pill-notice-d1')).toBeNull();
  });

  test('asks about today with the time, and about earlier days with a short day name', async () => {
    await renderIt([dose({}), dose({ uuid: 'd2', due_date: '2026-11-03' })]);
    expect(screen.getByTestId('pill-notice-d1')).toHaveTextContent(/Vitamina D/);
    expect(screen.getByTestId('pill-notice-d1')).toHaveTextContent(/08:00/);
    expect(screen.getByTestId('pill-notice-d2')).toHaveTextContent(/08:00/);
  });

  test('tick and skip answer the right dose', async () => {
    const onAnswer = jest.fn();
    await renderIt([dose({}), dose({ uuid: 'd2' })], onAnswer);
    await fireEvent.press(screen.getByTestId('pill-taken-d1'));
    await fireEvent.press(screen.getByTestId('pill-skip-d2'));
    expect(onAnswer).toHaveBeenNthCalledWith(1, 'd1', 'taken');
    expect(onAnswer).toHaveBeenNthCalledWith(2, 'd2', 'skipped');
  });

  test('the x hides one notice, "close all" hides the rest, nothing is written', async () => {
    const onAnswer = jest.fn();
    await renderIt([dose({}), dose({ uuid: 'd2' }), dose({ uuid: 'd3' })], onAnswer);
    await fireEvent.press(screen.getByTestId('pill-hide-d1'));
    expect(screen.queryByTestId('pill-notice-d1')).toBeNull();
    await fireEvent.press(screen.getByTestId('pill-close-all'));
    expect(screen.queryByTestId('pill-notice-d2')).toBeNull();
    expect(screen.queryByTestId('pill-notice-d3')).toBeNull();
    expect(onAnswer).not.toHaveBeenCalled();
  });

  test('six waiting pills become one card with "All taken" and "Review"', async () => {
    const onAnswerAll = jest.fn();
    const onReview = jest.fn();
    await renderIt(six, jest.fn(), { onAnswerAll, onReview });
    expect(screen.getByTestId('pill-group')).toHaveTextContent(/6 pills to confirm/);
    expect(screen.queryByTestId('pill-notice-a')).toBeNull();
    await fireEvent.press(screen.getByTestId('pill-review'));
    expect(onReview).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('pill-all-taken'));
    expect(onAnswerAll).toHaveBeenCalledWith(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  test('the group card closes for now without writing anything', async () => {
    const onAnswerAll = jest.fn();
    await renderIt(six, jest.fn(), { onAnswerAll });
    await fireEvent.press(screen.getByTestId('pill-group-hide'));
    expect(screen.queryByTestId('pill-group')).toBeNull();
    expect(onAnswerAll).not.toHaveBeenCalled();
  });

  test('three or fewer stay as separate cards, and no group without the all-taken handler', async () => {
    await renderIt([dose({}), dose({ uuid: 'd2' }), dose({ uuid: 'd3' })], jest.fn(), {
      onAnswerAll: jest.fn(),
    });
    expect(screen.queryByTestId('pill-group')).toBeNull();
    expect(screen.getByTestId('pill-notice-d3')).toBeTruthy();
  });
});

describe('taking a pill is a small animation, not a disappearance', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('the answer is written at once; the card shows "Taken" for a moment, then goes', async () => {
    const onAnswer = jest.fn();
    function Live() {
      const [list, setList] = useState([dose({}), dose({ uuid: 'd2', name: 'Zinc' })]);
      return (
        <Host
          doses={list}
          onAnswer={(u, s) => {
            onAnswer(u, s);
            setList((l) => l.filter((x) => x.uuid !== u)); // the page re-reads: the dose is no longer pending
          }}
        />
      );
    }
    await render(
      <ThemeProvider>
        <Live />
      </ThemeProvider>,
    );
    await fireEvent.press(screen.getByTestId('pill-taken-d1'));
    expect(onAnswer).toHaveBeenCalledWith('d1', 'taken');
    // the dose is already out of the list, but its card is still here, settled
    expect(screen.getByTestId('pill-done-d1')).toHaveTextContent(/Vitamina D/);
    expect(screen.getByTestId('pill-notice-d2')).toBeTruthy();
    // a second tap on the settled card does nothing
    await fireEvent.press(screen.getByTestId('pill-taken-d1'));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(SETTLE_MS + 50);
    });
    expect(screen.queryByTestId('pill-notice-d1')).toBeNull();
    expect(screen.getByTestId('pill-notice-d2')).toBeTruthy();
  });

  test('"all taken" settles the group card before it leaves', async () => {
    const onAll = jest.fn();
    function Live() {
      const [list, setList] = useState(six);
      return (
        <Host
          doses={list}
          onAnswer={jest.fn()}
          onAnswerAll={(ids) => {
            onAll(ids);
            setList([]);
          }}
        />
      );
    }
    await render(
      <ThemeProvider>
        <Live />
      </ThemeProvider>,
    );
    await fireEvent.press(screen.getByTestId('pill-all-taken'));
    expect(onAll).toHaveBeenCalledWith(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(screen.getByTestId('pill-group')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(SETTLE_MS + 50);
    });
    expect(screen.queryByTestId('pill-group')).toBeNull();
  });
});
