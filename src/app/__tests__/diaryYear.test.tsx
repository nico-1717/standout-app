import { act, fireEvent, render, screen } from '@testing-library/react-native';

import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import type { CompactDay, Insights } from '@/features/diary/insights';
import { localToday } from '@/features/tasks/groups';

import DiaryYearScreen from '../diary-year';

let mockStyle: 'standard' | 'paper' = 'standard';
const mockInsights = jest.fn();
const mockSettings = { font: 'caveat', size: 18, paper: 'lined' };
const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
// stabile come nell'app: se cambiasse a ogni disegno, la richiesta ripartirebbe all'infinito
const mockAi = jest.fn();
const mockAccount = { diaryInsights: mockInsights, diaryAi: mockAi };
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({
    account: mockAccount,
    uiStyle: mockStyle,
    diarySettings: mockSettings,
  }),
}));

const TODAY = localToday();
const YEAR = Number(TODAY.slice(0, 4));
const D = (
  m: number | null,
  e: number | null,
  w = 0,
  l = 0,
  hd = 0,
  hu = 0,
  p = 0,
  f = 0,
): CompactDay => [m, e, w, l, hd, hu, p, f];

const insights = (year: number): Insights => ({
  year,
  today: year === YEAR ? TODAY : `${year}-12-31`,
  days: {
    [`${year}-01-10`]: D(5, 3, 100, 1, 2, 2, 1, 25),
    [`${year}-01-11`]: D(1, null, 0, 0, 0, 3, 0, 0),
  },
  anni: [
    {
      anno: YEAR - 1,
      giorni: 365,
      scritti: 120,
      parole: 9000,
      umore: 3.4,
      energia: 3,
      abitudini_pct: 60,
      pomodori: 40,
      minuti: 1000,
    },
    {
      anno: YEAR,
      giorni: 100,
      scritti: 2,
      parole: 100,
      umore: 3,
      energia: 3,
      abitudini_pct: 40,
      pomodori: 1,
      minuti: 25,
    },
  ],
});

const renderIt = () =>
  render(
    <ThemeProvider>
      <DiaryYearScreen />
    </ThemeProvider>,
  );

describe.each(['standard', 'paper'] as const)('Diary insights screen (%s)', (style) => {
  beforeEach(() => {
    mockStyle = style;
    mockInsights.mockReset().mockImplementation(async (y: number) => insights(y));
    mockAi.mockReset().mockResolvedValue({ reports: [], books: [] });
    mockPush.mockClear();
    mockBack.mockClear();
  });

  test('loads this year and shows the calendar and the weekly rows', async () => {
    await renderIt();
    await act(async () => {});
    expect(mockInsights).toHaveBeenCalledWith(YEAR);
    expect(screen.getByTestId('year-page')).toBeTruthy();
    expect(screen.getByTestId(`day-${YEAR}-01-10`)).toBeTruthy();
  });

  test('a day opens the journal on that day', async () => {
    await renderIt();
    await act(async () => {});
    await fireEvent.press(screen.getByTestId(`day-${YEAR}-01-10`));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/diary',
      params: { data: `${YEAR}-01-10` },
    });
  });

  test('the layer and the period buttons switch what is shown', async () => {
    await renderIt();
    await act(async () => {});
    await fireEvent.press(screen.getByTestId('layer-e'));
    await fireEvent.press(screen.getByTestId('layer-h'));
    await fireEvent.press(screen.getByTestId('period-y'));
    expect(screen.getByTestId(`row-${YEAR - 1}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('period-m'));
    expect(screen.getByTestId(`row-${YEAR}-01-01`)).toBeTruthy();
  });

  test('tapping a year row loads that year; the next-year arrow stops at this year', async () => {
    await renderIt();
    await act(async () => {});
    expect(screen.getByTestId('year-next').props.accessibilityState?.disabled ?? true).toBeTruthy();
    await fireEvent.press(screen.getByTestId('period-y'));
    await fireEvent.press(screen.getByTestId(`row-${YEAR - 1}`));
    await act(async () => {});
    expect(mockInsights).toHaveBeenLastCalledWith(YEAR - 1);
    expect(screen.getByTestId('year-label').props.children).toBe(YEAR - 1);
  });

  test('without network it says so and can try again', async () => {
    mockInsights
      .mockReset()
      .mockRejectedValueOnce(new Error('network'))
      .mockImplementation(async (y: number) => insights(y));
    await renderIt();
    await act(async () => {});
    expect(screen.getByTestId('year-failed')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('year-retry'));
    await act(async () => {});
    expect(screen.getByTestId('year-page')).toBeTruthy();
  });

  test('back leaves the page', async () => {
    await renderIt();
    await act(async () => {});
    await fireEvent.press(screen.getByTestId('year-back'));
    expect(mockBack).toHaveBeenCalled();
  });

  test('reports and books written by the AI are listed and open in the reader', async () => {
    mockAi.mockResolvedValue({
      reports: [
        {
          id: 4,
          year: 2026,
          quarter: 2,
          from: '2026-04-01',
          to: '2026-06-30',
          title: 'A calm spring',
        },
      ],
      books: [{ id: 9, title: '', from: '2026-01-01', to: '2026-06-30', done: false, chapters: 3 }],
    });
    await renderIt();
    await act(async () => {});
    expect(screen.getByText('A calm spring')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('ai-report-4'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/diary-read', params: { report: '4' } });
    expect(screen.getByText('My book')).toBeTruthy();
    expect(screen.getByText(/in progress/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('ai-book-9'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/diary-read', params: { book: '9' } });
  });

  test('no AI texts yet, or no network for the list: nothing is shown', async () => {
    await renderIt();
    await act(async () => {});
    expect(screen.queryByTestId('ai-list')).toBeNull();
    mockAi.mockReset().mockRejectedValue(new Error('network'));
    await renderIt();
    await act(async () => {});
    expect(screen.queryByTestId('ai-list')).toBeNull();
  });
});
