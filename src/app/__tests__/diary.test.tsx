import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import '@/core/i18n';
import { FakeEngine } from '@/core/speech/__tests__/fakeEngine';
import { phoneEngine } from '@/core/speech/recognizer';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { DiaryRepo } from '@/features/diary/repo';
import { DEFAULT_DIARY_SETTINGS, type DiarySettings } from '@/features/diary/settings';
import { HabitsRepo } from '@/features/habits/repo';
import { addDaysIso, localToday } from '@/features/tasks/groups';

import DiaryScreen from '../diary';

let mockStyle: 'standard' | 'paper' = 'standard';
let mockServices: unknown;
let mockVersion = 0;
let mockSettings: DiarySettings = DEFAULT_DIARY_SETTINGS;
const mockChanged = jest.fn(() => {
  mockVersion += 1;
});
const mockUpdate = jest.fn((p: Partial<DiarySettings>) => {
  mockSettings = { ...mockSettings, ...p };
});
const mockBack = jest.fn();
const mockNavigate = jest.fn();

// il microfono è finto: si "dice" una frase dal test
jest.mock('@/core/speech/recognizer', () => {
  const { FakeEngine: Fake } = jest.requireActual('@/core/speech/__tests__/fakeEngine');
  return { ...jest.requireActual('@/core/speech/recognizer'), phoneEngine: new Fake() };
});
const mockEngine = phoneEngine as unknown as FakeEngine;

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, navigate: mockNavigate, push: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({
    services: mockServices,
    version: mockVersion,
    changed: mockChanged,
    uiStyle: mockStyle,
    diarySettings: mockSettings,
    updateDiarySettings: mockUpdate,
    syncInfo: { status: 'idle', lastSyncAt: null, pending: 0 },
  }),
}));

const TODAY = localToday();

function setup() {
  const db = memoryDb();
  const diary = new DiaryRepo(db, 7);
  const habits = new HabitsRepo(db, undefined, undefined, () => TODAY);
  mockServices = { db, diary, habits };
  return { diary, habits };
}

const renderIt = () =>
  render(
    <ThemeProvider>
      <DiaryScreen />
    </ThemeProvider>,
  );

describe.each(['standard', 'paper'] as const)('Diary screen (%s)', (style) => {
  beforeEach(() => {
    mockStyle = style;
    mockVersion = 0;
    mockSettings = DEFAULT_DIARY_SETTINGS;
    mockChanged.mockClear();
    mockUpdate.mockClear();
    mockBack.mockClear();
  });

  test("opens on today's page with the day number", async () => {
    setup();
    await renderIt();
    expect(screen.getByTestId('diary-num').props.children).toBe(Number(TODAY.slice(8)));
    expect(screen.getByTestId('diary-text')).toBeTruthy();
  });

  test('choosing a mood writes it; choosing the same again removes it; undo brings it back', async () => {
    const { diary } = setup();
    await renderIt();
    await fireEvent.press(screen.getByTestId('diary-mood'));
    await fireEvent.press(screen.getByTestId('face-4'));
    expect(diary.day(TODAY).mood).toBe(4);
    expect(screen.queryByTestId('face-pop')).toBeNull(); // the little sheet closes
    await fireEvent.press(screen.getByTestId('diary-mood'));
    await fireEvent.press(screen.getByTestId('face-4'));
    expect(diary.day(TODAY).mood).toBeNull();
    await fireEvent.press(screen.getByTestId('diary-undo'));
    expect(diary.day(TODAY).mood).toBe(4);
  });

  test('energy is separate from mood', async () => {
    const { diary } = setup();
    await renderIt();
    await fireEvent.press(screen.getByTestId('diary-energy'));
    await fireEvent.press(screen.getByTestId('face-2'));
    expect(diary.day(TODAY)).toMatchObject({ energy: 2, mood: null });
  });

  test('a new item is saved when the field closes; the empty row comes back', async () => {
    const { diary } = setup();
    await renderIt();
    const input = screen.getByTestId('item-new-good');
    await fireEvent.changeText(input, 'Coffee with Anna');
    await fireEvent(input, 'endEditing', { nativeEvent: { text: 'Coffee with Anna' } });
    expect(diary.day(TODAY).good.map((i) => i.content)).toEqual(['Coffee with Anna']);
    expect(screen.getByTestId('item-new-good')).toBeTruthy();
    expect((screen.getByTestId('item-new-good').props as { value: string }).value).toBe('');
  });

  test('emptying a saved item removes it', async () => {
    const { diary } = setup();
    const id = diary.addItem(TODAY, 'learned', 'Sleep helps')!;
    await renderIt();
    await fireEvent(screen.getByTestId(`item-${id}`), 'endEditing', { nativeEvent: { text: ' ' } });
    expect(diary.day(TODAY).learned).toEqual([]);
  });

  test('the text is saved when the field loses focus', async () => {
    const { diary } = setup();
    await renderIt();
    const ta = screen.getByTestId('diary-text');
    await fireEvent.changeText(ta, 'A calm day');
    await fireEvent(ta, 'blur');
    expect(diary.day(TODAY).note).toBe('A calm day');
    await fireEvent.press(screen.getByTestId('diary-undo'));
    expect(diary.day(TODAY).note).toBe('');
  });

  test('dictation: phrases are added with punctuation, the live words are shown but saved only when final', async () => {
    const { diary } = setup();
    await renderIt();
    await fireEvent.press(screen.getByTestId('diary-mic'));
    await act(async () => undefined);
    await act(async () => mockEngine.say(['I went for a run'], false));
    expect(screen.getByDisplayValue('I went for a run')).toBeTruthy();
    expect(diary.day(TODAY).note).toBe(''); // il provvisorio non si salva
    await act(async () => mockEngine.say(['I went for a run in the park'], true));
    await act(async () => mockEngine.finish());
    await act(async () => mockEngine.say(['comma'], true));
    await fireEvent.press(screen.getByTestId('diary-mic')); // stop: salva subito
    expect(diary.day(TODAY).note).toBe('I went for a run in the park,');
  });

  test('dictation: no permission → a short note, the text is untouched', async () => {
    const { diary } = setup();
    mockEngine.granted = false;
    await renderIt();
    await fireEvent.press(screen.getByTestId('diary-mic'));
    await act(async () => undefined);
    expect(screen.getByTestId('diary-mic-error')).toBeTruthy();
    expect(diary.day(TODAY).note).toBe('');
    mockEngine.granted = true;
  });

  test('the habits ring shows done/total and opens the summary', async () => {
    const { habits } = setup();
    const h = habits.create({ name: 'Run', icon: '🏃', start_date: addDaysIso(TODAY, -3) });
    habits.create({ name: 'Read', start_date: addDaysIso(TODAY, -3) });
    habits.checkIn(h, TODAY, 'toggle');
    await renderIt();
    expect(screen.getByTestId('diary-ring-n').props.children).toBe('1/2');
    await fireEvent.press(screen.getByTestId('diary-ring'));
    expect(screen.getByText('Today · 1 of 2')).toBeTruthy();
    expect(screen.getByText('🏃 Run')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('summary-go'));
    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/habits');
  });

  test('the month page shows written days, stats and the things learned; a day opens that day', async () => {
    const { diary } = setup();
    diary.setMood(TODAY, 4);
    diary.addItem(TODAY, 'learned', 'Stretch daily');
    const yesterday = addDaysIso(TODAY, -1);
    await renderIt();
    await fireEvent.press(screen.getByTestId('diary-month-btn'));
    expect(screen.getByTestId('diary-month')).toBeTruthy();
    expect(screen.getByTestId(`cal-${TODAY}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('taped-head'));
    expect(screen.getByText('Stretch daily')).toBeTruthy();
    expect(screen.getByTestId('taped-n').props.children).toBe(1);
    // back to the day page, then open another day from the calendar
    await fireEvent.press(screen.getByTestId('month-back'));
    expect(screen.getByTestId('diary-text')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('diary-month-btn'));
    if (yesterday.slice(0, 7) === TODAY.slice(0, 7)) {
      await fireEvent.press(screen.getByTestId(`cal-${yesterday}`));
      expect(screen.getByTestId('diary-num').props.children).toBe(Number(yesterday.slice(8)));
    }
  });

  test('the font sheet changes writing and size through the settings', async () => {
    setup();
    await renderIt();
    await fireEvent.press(screen.getByTestId('diary-font'));
    await fireEvent.press(screen.getByTestId('font-kalam'));
    expect(mockUpdate).toHaveBeenCalledWith({ font: style === 'standard' ? 'std-kalam' : 'kalam' });
    await fireEvent.press(screen.getByTestId('font-bigger'));
    expect(mockUpdate).toHaveBeenCalledWith({ size: 19 });
  });

  test('the back button leaves the diary', async () => {
    setup();
    await renderIt();
    await fireEvent.press(screen.getByTestId('diary-back'));
    expect(mockBack).toHaveBeenCalled();
  });

  test('today button on today tells you so', async () => {
    setup();
    await renderIt();
    await fireEvent.press(screen.getByTestId('diary-today'));
    await act(async () => {});
    expect(screen.getByText("You're already on today's page.")).toBeTruthy();
  });
});
