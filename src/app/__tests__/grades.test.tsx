import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { programList } from '@/features/grades/catalog';
import { DEFAULT_GRADE_SETTINGS, type GradeSettings } from '@/features/grades/logic';
import { GradesRepo } from '@/features/grades/repo';

import GradeBonusScreen from '../grade-bonus';
import GradeExamScreen from '../grade-exam';
import GradeGroupScreen from '../grade-group';
import GradeSettingsScreen from '../grade-settings';
import GradesScreen from '../grades';

let mockServices: unknown;
let mockVersion = 0;
let mockSettings: GradeSettings;
let mockParams: Record<string, string> = {};
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockChanged = jest.fn(() => {
  mockVersion += 1;
});
const mockUpdate = jest.fn((patch: Partial<GradeSettings>) => {
  mockSettings = { ...mockSettings, ...patch };
  mockVersion += 1;
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({
    services: mockServices,
    version: mockVersion,
    changed: mockChanged,
    gradeSettings: mockSettings,
    updateGradeSettings: mockUpdate,
  }),
}));

function setup() {
  mockVersion = 0;
  mockParams = {};
  mockSettings = { ...DEFAULT_GRADE_SETTINGS };
  mockPush.mockClear();
  mockBack.mockClear();
  mockUpdate.mockClear();
  const db = memoryDb();
  migrate(db);
  const grades = new GradesRepo(db);
  mockServices = { db, grades };
  return { db, grades };
}
const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;
const txt = (id: string) => {
  const c = screen.getByTestId(id).props.children;
  return Array.isArray(c) ? c.join('') : String(c);
};
/** Preme il bottone di un Alert.alert con quel testo. */
const pressAlert = async (spy: jest.SpyInstance, label: string) => {
  const buttons = spy.mock.calls.at(-1)![2] as { text: string; onPress?: () => void }[];
  await act(async () => {
    buttons.find((b) => b.text === label)!.onPress?.();
  });
};

describe('Grades main screen', () => {
  test('without exams it invites to start from a course or add by hand', async () => {
    setup();
    await render(wrap(<GradesScreen />));
    await fireEvent.press(screen.getByTestId('grades-start-program'));
    expect(mockPush).toHaveBeenCalledWith('/grade-settings');
    await fireEvent.press(screen.getByTestId('grades-add-first'));
    expect(mockPush).toHaveBeenCalledWith('/grade-exam');
  });

  test('shows the weighted average, the /110 base and the credits', async () => {
    const { grades } = setup();
    grades.addExam({ name: 'Analysis', cfu: 6, status: 'done', grade: 28 });
    grades.addExam({ name: 'Physics', cfu: 12, status: 'done', grade: 30 });
    await render(wrap(<GradesScreen />));
    expect(txt('grades-average')).toBe('29.33');
    expect(txt('grades-base')).toBe('108');
    expect(txt('grades-cfu')).toBe('18/180');
    expect(screen.queryByTestId('grades-lodi')).toBeNull();
  });

  test('lists done exams and opens one on tap', async () => {
    const { grades } = setup();
    const id = grades.addExam({ name: 'Analysis', cfu: 6, status: 'done', grade: 28 });
    await render(wrap(<GradesScreen />));
    await fireEvent.press(screen.getByTestId(`grade-row-${id}`));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/grade-exam', params: { id } });
  });

  test('the target can be set, moved and removed, with the average it needs', async () => {
    const { grades } = setup();
    grades.addExam({ name: 'A', cfu: 6, status: 'done', grade: 27 });
    grades.addExam({ name: 'B', cfu: 6, status: 'todo' });
    const view = await render(wrap(<GradesScreen />));
    await fireEvent.press(screen.getByTestId('grades-target-set'));
    expect(mockSettings.target_average).toBe(27);
    await view.rerender(wrap(<GradesScreen />));
    await fireEvent.press(screen.getByTestId('grades-target-plus'));
    expect(mockSettings.target_average).toBe(27.5);
    await view.rerender(wrap(<GradesScreen />));
    expect(txt('grades-target-value')).toBe('27.50');
    // media 27 su 6 CFU, serve 28 sui 6 rimasti per arrivare a 27.5
    expect(txt('grades-target-text')).toMatch(/28\.00/);
    await fireEvent.press(screen.getByTestId('grades-target-clear'));
    expect(mockSettings.target_average).toBeNull();
  });

  test('an impossible target says so', async () => {
    const { grades } = setup();
    grades.addExam({ name: 'A', cfu: 6, status: 'done', grade: 20 });
    grades.addExam({ name: 'B', cfu: 6, status: 'todo' });
    mockSettings = { ...mockSettings, target_average: 28 };
    await render(wrap(<GradesScreen />));
    expect(txt('grades-target-text')).toMatch(/above 30/);
  });

  test('the simulator moves the predicted grade and can save it as the target', async () => {
    const { grades } = setup();
    grades.addExam({ name: 'A', cfu: 6, status: 'done', grade: 28 });
    const todo = grades.addExam({ name: 'B', cfu: 6, status: 'todo' });
    const view = await render(wrap(<GradesScreen />));
    await fireEvent.press(screen.getByTestId('grades-tab-sim'));
    await fireEvent.press(screen.getByTestId(`grades-pred-${todo}-plus`));
    expect(grades.exam(todo)!.predicted_grade).toBe(28);
    await view.rerender(wrap(<GradesScreen />));
    await fireEvent.press(screen.getByTestId(`grades-pred-${todo}-plus`));
    expect(grades.exam(todo)!.predicted_grade).toBe(29);
    await view.rerender(wrap(<GradesScreen />));
    await fireEvent.press(screen.getByTestId('grades-sim-target'));
    expect(mockSettings.target_average).toBe(28.5);
    expect(mockSettings.target_source).toBe('simulation');
    await view.rerender(wrap(<GradesScreen />));
    await fireEvent.press(screen.getByTestId(`grades-pred-clear-${todo}`));
    expect(grades.exam(todo)!.predicted_grade).toBeNull();
  });

  test('bonuses switch on and off and add to the final grade', async () => {
    const { grades } = setup();
    grades.addExam({ name: 'A', cfu: 6, status: 'done', grade: 30 });
    const b = grades.addBonus({
      name: 'On time',
      bonus_type: 'on_time',
      points: 2,
      is_enabled: false,
    });
    const view = await render(wrap(<GradesScreen />));
    expect(txt('grades-final')).toBe('110');
    await fireEvent(screen.getByTestId(`grades-bonus-switch-${b}`), 'valueChange', true);
    expect(grades.bonuses()[0]!.is_enabled).toBe(1);
    await view.rerender(wrap(<GradesScreen />));
    expect(txt('grades-final')).toBe('110L');
    expect(txt('grades-bonus-total')).toMatch(/\+2/);
  });

  test('select mode deletes the chosen exams after a confirm', async () => {
    const { grades } = setup();
    const a = grades.addExam({ name: 'A', cfu: 6, status: 'done', grade: 28 });
    grades.addExam({ name: 'B', cfu: 6, status: 'done', grade: 25 });
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const view = await render(wrap(<GradesScreen />));
    await fireEvent.press(screen.getByTestId('grades-select'));
    await fireEvent.press(screen.getByTestId(`grade-row-${a}`));
    await view.rerender(wrap(<GradesScreen />));
    expect(txt('grades-picked')).toBe('1 selected');
    await fireEvent.press(screen.getByTestId('grades-delete'));
    await pressAlert(spy, 'Delete');
    expect(grades.exams().map((e) => e.name)).toEqual(['B']);
    spy.mockRestore();
  });

  test('two picked exams go to the group screen, one is refused', async () => {
    const { grades } = setup();
    const a = grades.addExam({ name: 'A', cfu: 6, status: 'todo' });
    const b = grades.addExam({ name: 'B', cfu: 6, status: 'todo' });
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const view = await render(wrap(<GradesScreen />));
    await fireEvent.press(screen.getByTestId('grades-tab-todo'));
    await fireEvent.press(screen.getByTestId('grades-select'));
    await fireEvent.press(screen.getByTestId(`grade-row-${a}`));
    await view.rerender(wrap(<GradesScreen />));
    await fireEvent.press(screen.getByTestId('grades-group'));
    expect(spy).toHaveBeenCalledWith('Select at least two exams');
    await fireEvent.press(screen.getByTestId(`grade-row-${b}`));
    await view.rerender(wrap(<GradesScreen />));
    await fireEvent.press(screen.getByTestId('grades-group'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/grade-group',
      params: { ids: `${a},${b}` },
    });
    spy.mockRestore();
  });

  test('a covered elective group hides the other exams from "to take"', async () => {
    const { grades } = setup();
    const a = grades.addExam({ name: 'Elective A', cfu: 6, status: 'done', grade: 28 });
    grades.addExam({ name: 'Elective B', cfu: 6, status: 'todo' });
    grades.createGroup({
      name: 'Free choice',
      type: 'choice',
      exams: grades.exams().map((e) => e.uuid),
      cfu: 6,
    });
    await render(wrap(<GradesScreen />));
    await fireEvent.press(screen.getByTestId('grades-tab-todo'));
    expect(screen.queryByText('Elective B')).toBeNull();
    expect(a).toBeTruthy();
  });
});

describe('Exam editor', () => {
  test('adds a done exam with a grade and honours', async () => {
    const { grades } = setup();
    mockParams = { status: 'done' };
    await render(wrap(<GradeExamScreen />));
    await fireEvent.changeText(screen.getByTestId('exam-name'), 'Calculus');
    await fireEvent.changeText(screen.getByTestId('exam-cfu'), '9');
    await fireEvent.press(screen.getByTestId('exam-year-1'));
    await fireEvent.press(screen.getByTestId('exam-grade-plus'));
    await fireEvent.press(screen.getByTestId('exam-save'));
    const e = grades.exams()[0]!;
    expect(e).toMatchObject({ name: 'Calculus', cfu: 9, study_year: 1, status: 'done', grade: 28 });
    expect(e.exam_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(mockBack).toHaveBeenCalled();
  });

  test('refuses an empty name', async () => {
    const { grades } = setup();
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(wrap(<GradeExamScreen />));
    await fireEvent.press(screen.getByTestId('exam-save'));
    expect(spy).toHaveBeenCalledWith('Enter the exam name');
    expect(grades.exams()).toHaveLength(0);
    spy.mockRestore();
  });

  test('a pass/fail exam keeps no grade', async () => {
    const { grades } = setup();
    mockParams = { status: 'done' };
    await render(wrap(<GradeExamScreen />));
    await fireEvent.changeText(screen.getByTestId('exam-name'), 'English B2');
    await fireEvent(screen.getByTestId('exam-passfail'), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('exam-save'));
    expect(grades.exams()[0]).toMatchObject({ is_pass_fail: 1, grade: null });
  });

  test('edits and deletes an existing exam', async () => {
    const { grades } = setup();
    const id = grades.addExam({ name: 'Old', cfu: 6, status: 'todo' });
    mockParams = { id };
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(wrap(<GradeExamScreen />));
    await fireEvent.changeText(screen.getByTestId('exam-name'), 'New name');
    await fireEvent.press(screen.getByTestId('exam-pred-plus'));
    await fireEvent.press(screen.getByTestId('exam-save'));
    expect(grades.exam(id)).toMatchObject({ name: 'New name', predicted_grade: 27 });
    await fireEvent.press(screen.getByTestId('exam-delete'));
    await pressAlert(spy, 'Delete');
    expect(grades.exams()).toHaveLength(0);
    spy.mockRestore();
  });

  test('passing an elective exam that fills the quota offers to drop the others', async () => {
    const { grades } = setup();
    const a = grades.addExam({ name: 'A', cfu: 6, status: 'todo' });
    const b = grades.addExam({ name: 'B', cfu: 6, status: 'todo' });
    grades.createGroup({ name: 'G', type: 'choice', exams: [a, b], cfu: 6 });
    mockParams = { id: a };
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(wrap(<GradeExamScreen />));
    await fireEvent.press(screen.getByTestId('exam-status-done'));
    await fireEvent.press(screen.getByTestId('exam-save'));
    await pressAlert(spy, 'Remove');
    expect(grades.exams().map((e) => e.uuid)).toEqual([a]);
    expect(grades.groups()).toHaveLength(0);
    spy.mockRestore();
  });
});

describe('Group editor', () => {
  test('creates an elective group from the picked exams with a quota', async () => {
    const { grades } = setup();
    const a = grades.addExam({ name: 'A', cfu: 6, status: 'todo' });
    const b = grades.addExam({ name: 'B', cfu: 9, status: 'todo' });
    mockParams = { ids: `${a},${b}` };
    await render(wrap(<GradeGroupScreen />));
    await fireEvent.changeText(screen.getByTestId('group-name'), 'Free choice');
    await fireEvent.press(screen.getByTestId('group-quota-9'));
    await fireEvent.press(screen.getByTestId('group-save'));
    const g = grades.groups()[0]!;
    expect(g).toMatchObject({ name: 'Free choice', group_type: 'choice', cfu: 9 });
    expect(grades.exams().every((e) => e.group_uuid === g.uuid)).toBe(true);
  });

  test('a split group adds the credits up', async () => {
    const { grades } = setup();
    const a = grades.addExam({ name: 'A', cfu: 6, status: 'todo' });
    const b = grades.addExam({ name: 'B', cfu: 3, status: 'todo' });
    mockParams = { ids: `${a},${b}` };
    await render(wrap(<GradeGroupScreen />));
    await fireEvent.press(screen.getByTestId('group-type-split'));
    expect(txt('group-total')).toBe('9');
    await fireEvent.press(screen.getByTestId('group-save'));
    expect(grades.groups()[0]).toMatchObject({ group_type: 'split', cfu: 9 });
  });

  test('needs two exams', async () => {
    const { grades } = setup();
    const a = grades.addExam({ name: 'A', cfu: 6, status: 'todo' });
    grades.addExam({ name: 'B', cfu: 6, status: 'todo' });
    mockParams = { ids: a };
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(wrap(<GradeGroupScreen />));
    await fireEvent.press(screen.getByTestId('group-save'));
    expect(spy).toHaveBeenCalledWith('At least two exams are needed');
    expect(grades.groups()).toHaveLength(0);
    spy.mockRestore();
  });

  test('dissolves an existing group after a confirm', async () => {
    const { grades } = setup();
    const a = grades.addExam({ name: 'A', cfu: 6, status: 'todo' });
    const b = grades.addExam({ name: 'B', cfu: 6, status: 'todo' });
    const g = grades.createGroup({ name: 'G', type: 'choice', exams: [a, b], cfu: 6 })!;
    mockParams = { id: g };
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(wrap(<GradeGroupScreen />));
    await fireEvent.press(screen.getByTestId('group-dissolve'));
    await pressAlert(spy, 'Ungroup');
    expect(grades.groups()).toHaveLength(0);
    expect(grades.exams()).toHaveLength(2);
    spy.mockRestore();
  });
});

describe('Bonus editor', () => {
  test('adds a per-honours bonus with a cap', async () => {
    const { grades } = setup();
    await render(wrap(<GradeBonusScreen />));
    await fireEvent.changeText(screen.getByTestId('bonus-name'), 'Honours');
    await fireEvent.press(screen.getByTestId('bonus-type-honors_each'));
    await fireEvent.changeText(screen.getByTestId('bonus-points'), '0.5');
    await fireEvent.changeText(screen.getByTestId('bonus-cap'), '3');
    await fireEvent.press(screen.getByTestId('bonus-save'));
    expect(grades.bonuses()[0]).toMatchObject({
      name: 'Honours',
      bonus_type: 'honors_each',
      points: 0.5,
      cap_points: 3,
      is_enabled: 1,
    });
  });

  test('needs a name, and a saved bonus can be deleted', async () => {
    const { grades } = setup();
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const view = await render(wrap(<GradeBonusScreen />));
    await fireEvent.press(screen.getByTestId('bonus-save'));
    expect(spy).toHaveBeenCalledWith('Give the bonus a name');
    const id = grades.addBonus({ name: 'X', bonus_type: 'fixed', points: 1 });
    mockParams = { id };
    await view.unmount();
    await render(wrap(<GradeBonusScreen />));
    await fireEvent.press(screen.getByTestId('bonus-delete'));
    await pressAlert(spy, 'Delete');
    expect(grades.bonuses()).toHaveLength(0);
    spy.mockRestore();
  });
});

describe('Settings', () => {
  test('picking a course loads its exams and rules', async () => {
    const { grades } = setup();
    const row = programList('', 'en').find((r) => r.examCount > 5)!;
    await render(wrap(<GradeSettingsScreen />));
    expect(txt('gset-current')).toBe('No course');
    await fireEvent.press(screen.getByTestId(`gset-program-${row.key}`));
    expect(grades.exams().length).toBe(row.examCount);
    expect(mockSettings.program_key).toBe(row.key);
    expect(mockSettings.total_cfu).toBe(row.cfu);
  });

  test('with exams already there it asks replace or append', async () => {
    const { grades } = setup();
    grades.addExam({ name: 'Mine', cfu: 6, status: 'todo' });
    const row = programList('', 'en').find((r) => r.examCount > 5)!;
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(wrap(<GradeSettingsScreen />));
    await fireEvent.press(screen.getByTestId(`gset-program-${row.key}`));
    await pressAlert(spy, '＋ Add exam');
    expect(grades.exams().length).toBe(row.examCount + 1);
    spy.mockRestore();
  });

  test('search narrows the list; rules are editable', async () => {
    setup();
    await render(wrap(<GradeSettingsScreen />));
    await fireEvent.changeText(screen.getByTestId('gset-search'), 'zzzz-nothing');
    expect(screen.getByText('No course found.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('gset-honors-31'));
    expect(mockSettings.honors_value).toBe(31);
    await fireEvent(screen.getByTestId('gset-round'), 'valueChange', false);
    expect(mockSettings.round_half_up).toBe(false);
    await fireEvent.changeText(screen.getByTestId('gset-base'), '100');
    await fireEvent(screen.getByTestId('gset-base'), 'endEditing');
    expect(mockSettings.grade_base).toBe(100);
  });
});
