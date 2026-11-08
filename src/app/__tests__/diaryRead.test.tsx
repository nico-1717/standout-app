import { act, fireEvent, render, screen } from '@testing-library/react-native';

import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import type { AiBook, AiReport } from '@/features/diary/aiReading';
import { paragraphs, trend } from '@/features/diary/aiReading';

import DiaryReadScreen from '../diary-read';

let mockParams: Record<string, string> = {};
const mockReport = jest.fn();
const mockBook = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockAccount = { diaryReport: mockReport, diaryBook: mockBook };
const mockSettings = { font: 'caveat', size: 18, paper: 'lined' };
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({ account: mockAccount, uiStyle: 'standard', diarySettings: mockSettings }),
}));

const report: AiReport = {
  id: 4,
  year: 2026,
  quarter: 2,
  from: '2026-04-01',
  to: '2026-06-30',
  created_at: '2026-07-02 10:00:00',
  content: {
    titolo: 'A calm spring',
    in_breve: 'You wrote often.',
    pensieri: ['I want more quiet'],
    sentimenti: ['First paragraph.\n\nSecond paragraph.'],
    alti: ['The trip'],
    bassi: [],
    temi: [{ tema: 'Sleep', testo: 'You slept better.' }],
    abitudini: 'Mostly steady.',
    concentrazione: 'Good focus.',
    spunti: ['Walk more'],
  },
  numbers: {
    ora: { scritti: 60, umore: 3.5, energia: 3, abitudini_pct: 80, pomodori: 40 },
    prima: { scritti: 50, umore: 3.8, energia: 3, abitudini_pct: 70, pomodori: 40 },
    abitudini: [{ nome: 'Read', fatte: 70, obiettivo: 90, fatte_prima: 60, obiettivo_prima: 90 }],
  },
};
const book: AiBook = {
  id: 9,
  title: 'My year',
  from: '2026-01-01',
  to: '2026-06-30',
  done: false,
  created_at: '2026-07-02 10:00:00',
  chapters: [
    { title: 'Beginnings', text: 'One.\n\nTwo.' },
    { title: 'Middle', text: 'Three.' },
  ],
};

const renderIt = () =>
  render(
    <ThemeProvider>
      <DiaryReadScreen />
    </ThemeProvider>,
  );

beforeEach(() => {
  mockReport.mockReset().mockResolvedValue(report);
  mockBook.mockReset().mockResolvedValue(book);
  mockBack.mockClear();
  mockParams = {};
});

describe('aiReading helpers', () => {
  test('paragraphs split on blank lines and drop empty ones', () => {
    expect(paragraphs('a\n\n\n b \n\n')).toEqual(['a', 'b']);
  });
  test('trend arrows', () => {
    expect(trend(4, 3)).toBe(' ↑');
    expect(trend(2, 3)).toBe(' ↓');
    expect(trend(3, 3)).toBe(' =');
    expect(trend(null, 3)).toBe('');
    expect(trend(3, undefined)).toBe('');
  });
});

describe('diary reader', () => {
  test('a report: title, numbers with arrows, sections and the habits table', async () => {
    mockParams = { report: '4' };
    await renderIt();
    await act(async () => {});
    expect(mockReport).toHaveBeenCalledWith(4);
    expect(screen.getByText('A calm spring')).toBeTruthy();
    expect(screen.getByText('You wrote often.')).toBeTruthy();
    expect(screen.getByTestId('report-num-written')).toHaveTextContent('60');
    expect(screen.getByTestId('report-num-mood')).toHaveTextContent(/3\.5 ↓/);
    expect(screen.getByTestId('report-num-habits')).toHaveTextContent(/80% ↑/);
    expect(screen.getByTestId('report-num-pomodoros')).toHaveTextContent(/40 =/);
    expect(screen.getByText('First paragraph.')).toBeTruthy();
    expect(screen.getByText('Second paragraph.')).toBeTruthy();
    expect(screen.getByText('Sleep')).toBeTruthy();
    expect(screen.getByTestId('report-habit-0')).toHaveTextContent(/70\/90/);
    expect(screen.getByText(/Written by AI from your journal on/)).toBeTruthy();
  });

  test('a book: unfinished note, contents and chapters', async () => {
    mockParams = { book: '9' };
    await renderIt();
    await act(async () => {});
    expect(mockBook).toHaveBeenCalledWith(9);
    expect(screen.getByText('My year')).toBeTruthy();
    expect(screen.getByTestId('book-unfinished')).toBeTruthy();
    expect(screen.getByTestId('book-toc-1')).toHaveTextContent('2. Middle');
    await fireEvent.press(screen.getByTestId('book-toc-1')); // salta senza errori
    expect(screen.getByText('Chapter 2')).toBeTruthy();
    expect(screen.getByText('Three.')).toBeTruthy();
  });

  test('a finished book has no unfinished note', async () => {
    mockParams = { book: '9' };
    mockBook.mockResolvedValue({ ...book, done: true });
    await renderIt();
    await act(async () => {});
    expect(screen.queryByTestId('book-unfinished')).toBeNull();
  });

  test('no network says so and can try again', async () => {
    mockParams = { report: '4' };
    mockReport.mockRejectedValueOnce(new Error('network'));
    await renderIt();
    await act(async () => {});
    expect(screen.getByTestId('read-failed')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('read-retry'));
    await act(async () => {});
    expect(screen.getByTestId('report-reader')).toBeTruthy();
  });

  test('a bad id never asks the server', async () => {
    mockParams = { report: 'abc' };
    await renderIt();
    await act(async () => {});
    expect(mockReport).not.toHaveBeenCalled();
    expect(screen.getByTestId('read-failed')).toBeTruthy();
  });

  test('back leaves the page', async () => {
    mockParams = { report: '4' };
    await renderIt();
    await fireEvent.press(screen.getByTestId('read-back'));
    expect(mockBack).toHaveBeenCalled();
  });
});
