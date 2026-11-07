import { fireEvent, render, screen } from '@testing-library/react-native';

import '@/core/i18n';
import { ThemeProvider, useTheme } from '@/core/theme/ThemeProvider';
import type { DoseView } from '@/features/pills/repo';

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
}: {
  doses: DoseView[];
  onAnswer: (u: string, s: 'taken' | 'skipped') => void;
}) {
  const th = useTheme();
  return (
    <PillNotices
      doses={doses}
      today="2026-11-05"
      pt={plannerTheme(th.style, th)}
      bottom={18}
      onAnswer={onAnswer}
    />
  );
}
const renderIt = (doses: DoseView[], onAnswer = jest.fn()) =>
  render(
    <ThemeProvider>
      <Host doses={doses} onAnswer={onAnswer} />
    </ThemeProvider>,
  );

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
});
