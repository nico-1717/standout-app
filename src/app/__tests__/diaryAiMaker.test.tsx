import { act, fireEvent, render, screen } from '@testing-library/react-native';

import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import type { CompactDay, Insights } from '@/features/diary/insights';
import { localToday } from '@/features/tasks/groups';

import DiaryYearScreen from '../diary-year';

const mockPush = jest.fn();
const mockInsights = jest.fn();
const mockAi = jest.fn();
const mockRun = jest.fn();
const mockSettings = { font: 'caveat', size: 18, paper: 'lined' };
const mockAccount = {
  diaryInsights: mockInsights,
  diaryAi: mockAi,
  diaryAiRun: (body: unknown) => mockRun(body),
};

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: mockPush }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({ account: mockAccount, uiStyle: 'standard', diarySettings: mockSettings }),
}));

const YEAR = Number(localToday().slice(0, 4));
const D = (w: number): CompactDay => [3, 3, w, 0, 0, 0, 0, 0];

/** Il primo trimestre ha scritto abbastanza (20 giorni da 100 parole); il secondo quasi niente. */
function insights(): Insights {
  const days: Record<string, CompactDay> = {};
  for (let d = 1; d <= 20; d++) days[`${YEAR}-01-${String(d).padStart(2, '0')}`] = D(100);
  days[`${YEAR}-04-02`] = D(20);
  return { year: YEAR, today: `${YEAR}-12-31`, days, anni: [] };
}

const wrap = () => (
  <ThemeProvider>
    <DiaryYearScreen />
  </ThemeProvider>
);
const flush = () => act(async () => undefined);

beforeEach(() => {
  mockPush.mockClear();
  mockRun.mockReset();
  mockInsights.mockResolvedValue(insights());
  mockAi.mockResolvedValue({ reports: [], books: [] });
});

describe('creating reports and books with the AI', () => {
  test('a quarter with enough writing offers to create; one with too little says to write more', async () => {
    await render(wrap());
    await flush();
    expect(screen.getByTestId('aim-report-1')).toBeTruthy();
    expect(screen.getByTestId('aim-book-1')).toBeTruthy();
    expect(screen.queryByTestId('aim-report-2')).toBeNull();
    expect(screen.getByTestId('aim-low-2')).toBeTruthy();
  });

  test('the report: shows the cost first, creates only after confirming, then opens it', async () => {
    mockRun.mockImplementation(async (b: { azione: string }) =>
      b.azione === 'stima'
        ? { ok: true, stima: 12, disponibili: 100, sufficiente: true }
        : { ok: true, id: 42 },
    );
    await render(wrap());
    await flush();
    await fireEvent.press(screen.getByTestId('aim-report-1'));
    await flush();
    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun.mock.calls[0]![0]).toEqual({
      azione: 'stima',
      anno: YEAR,
      q: 1,
      per: 'resoconto',
    });
    expect(screen.getByTestId('aim-cost').props.children).toMatch(/12/);
    await fireEvent.press(screen.getByTestId('aim-create'));
    await flush();
    expect(mockRun).toHaveBeenLastCalledWith({ azione: 'resoconto', anno: YEAR, q: 1 });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/diary-read', params: { report: '42' } });
    // l'elenco si ricarica per mostrare il nuovo resoconto
    expect(mockAi.mock.calls.length).toBeGreaterThan(1);
  });

  test('a plan with no credit limit shows only the cost', async () => {
    mockRun.mockResolvedValue({ ok: true, stima: 31, disponibili: null, sufficiente: true });
    await render(wrap());
    await flush();
    await fireEvent.press(screen.getByTestId('aim-report-1'));
    await flush();
    const text = String(screen.getByTestId('aim-cost').props.children);
    expect(text).toMatch(/31/);
    expect(text).not.toMatch(/you have/);
  });

  test('not enough credits: the message says so and Create is off', async () => {
    mockRun.mockResolvedValue({ ok: true, stima: 50, disponibili: 3, sufficiente: false });
    await render(wrap());
    await flush();
    await fireEvent.press(screen.getByTestId('aim-report-1'));
    await flush();
    expect(screen.getByTestId('aim-cost').props.children).toMatch(/50/);
    await fireEvent.press(screen.getByTestId('aim-create'));
    await flush();
    expect(mockRun).toHaveBeenCalledTimes(1); // solo la stima
  });

  test('a book is written piece by piece and opens at the end; it can continue a finished book', async () => {
    mockAi.mockResolvedValue({
      reports: [],
      books: [
        {
          id: 3,
          title: 'Old',
          from: `${YEAR - 1}-01-01`,
          to: `${YEAR - 1}-03-31`,
          done: true,
          chapters: 2,
        },
      ],
    });
    let pieces = 0;
    mockRun.mockImplementation(async (b: { azione: string }) => {
      if (b.azione === 'stima') return { ok: true, stima: 20, disponibili: 90, sufficiente: true };
      if (b.azione === 'libro_piano') return { ok: true, id: 8, titolo: 'New', pezzi: 2 };
      pieces++;
      return { ok: true, fatto: pieces === 2, fatti: pieces, totale: 2, capitolo: `C${pieces}` };
    });
    await render(wrap());
    await flush();
    await fireEvent.press(screen.getByTestId('aim-book-1'));
    await flush();
    await fireEvent.press(screen.getByTestId('aim-join-3'));
    await flush();
    expect(mockRun).toHaveBeenLastCalledWith({
      azione: 'stima',
      anno: YEAR,
      q: 1,
      per: 'libro',
      unisci: 3,
    });
    await fireEvent.press(screen.getByTestId('aim-create'));
    await flush();
    expect(mockRun.mock.calls.map((c) => c[0].azione)).toEqual([
      'stima',
      'stima',
      'libro_piano',
      'libro_avanti',
      'libro_avanti',
    ]);
    expect(mockRun).toHaveBeenCalledWith({ azione: 'libro_piano', anno: YEAR, q: 1, unisci: 3 });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/diary-read', params: { book: '8' } });
  });

  test('when the AI fails the message says no credits were used, and Try again goes on from the same book', async () => {
    let fail = true;
    mockRun.mockImplementation(async (b: { azione: string }) => {
      if (b.azione === 'stima') return { ok: true, stima: 20, disponibili: 90, sufficiente: true };
      if (b.azione === 'libro_piano') return { ok: true, id: 8, titolo: 'New', pezzi: 1 };
      if (fail) {
        fail = false;
        return { ok: false, error: 'ia_timeout', riprovabile: true };
      }
      return { ok: true, fatto: true, fatti: 1, totale: 1 };
    });
    await render(wrap());
    await flush();
    await fireEvent.press(screen.getByTestId('aim-book-1'));
    await flush();
    await fireEvent.press(screen.getByTestId('aim-create'));
    await flush();
    expect(screen.getByTestId('aim-failed')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('aim-retry'));
    await flush();
    // niente secondo piano: si riprende dal libro 8
    expect(mockRun.mock.calls.filter((c) => c[0].azione === 'libro_piano')).toHaveLength(1);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/diary-read', params: { book: '8' } });
  });

  test('an unfinished book in the list can be continued', async () => {
    mockAi.mockResolvedValue({
      reports: [],
      books: [
        {
          id: 5,
          title: 'Half',
          from: `${YEAR}-01-01`,
          to: `${YEAR}-03-31`,
          done: false,
          chapters: 3,
        },
      ],
    });
    mockRun.mockResolvedValue({ ok: true, fatto: true, fatti: 3, totale: 3 });
    await render(wrap());
    await flush();
    await fireEvent.press(screen.getByTestId('aim-resume-5'));
    await flush();
    expect(mockRun).toHaveBeenCalledWith({ azione: 'libro_avanti', id: 5 });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/diary-read', params: { book: '5' } });
  });

  test('an existing report can be read or written again', async () => {
    mockAi.mockResolvedValue({
      reports: [{ id: 11, year: YEAR, quarter: 1, from: '', to: '', title: 'Q1' }],
      books: [],
    });
    await render(wrap());
    await flush();
    await fireEvent.press(screen.getByTestId('aim-read-1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/diary-read', params: { report: '11' } });
    expect(screen.getByTestId('aim-report-1')).toBeTruthy(); // «scrivilo di nuovo»
  });
});
