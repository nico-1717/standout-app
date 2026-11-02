import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import type { PlanInput } from '@/features/pills/logic';
import { PillsRepo, localStamp } from '@/features/pills/repo';
import { addDaysIso, localToday } from '@/features/tasks/groups';

import PillsScreen from '../(tabs)/pills';

let mockStyle: 'standard' | 'paper' = 'standard';
let mockServices: unknown;
let mockVersion = 0;
const mockChanged = jest.fn(() => {
  mockVersion += 1;
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({
    services: mockServices,
    version: mockVersion,
    changed: mockChanged,
    uiStyle: mockStyle,
    syncInfo: { status: 'idle', lastSyncAt: null, pending: 0 },
  }),
}));

const TODAY = localToday();
const TWO_DAYS_AGO = addDaysIso(TODAY, -2);

const plan = (o: Partial<PlanInput> = {}): PlanInput => ({
  name: 'Vitamin D',
  dose: '1 tablet',
  notes: 'with breakfast',
  color: '#B7A6D6',
  freq_type: 'daily',
  weekdays: '1111111',
  month_days: '',
  interval_days: 1,
  times: '08:00x1,20:00x1',
  start_date: TWO_DAYS_AGO,
  end_date: null,
  is_active: true,
  ...o,
});

function setup(withPlans = true) {
  const db = memoryDb();
  const pills = new PillsRepo(db, localToday, localStamp);
  const vit = withPlans ? pills.createPlan(plan()) : '';
  const omega = withPlans
    ? pills.createPlan(
        plan({
          name: 'Omega 3',
          dose: '2 capsules',
          notes: '',
          times: '13:00x1',
          color: '#8FB8A8',
        }),
      )
    : '';
  mockServices = { db, pills, scheduler: { trigger: jest.fn() } };
  return { db, pills, vit, omega };
}

const renderIt = () =>
  render(
    <ThemeProvider>
      <PillsScreen />
    </ThemeProvider>,
  );

const rerender = async () => {
  await act(async () => {});
};

beforeEach(() => {
  mockVersion = 0;
  mockStyle = 'standard';
  mockChanged.mockClear();
  jest.restoreAllMocks();
});

describe.each(['standard', 'paper'] as const)('Pastiglie (%s)', (look) => {
  beforeEach(() => {
    mockStyle = look;
  });

  it('mostra titolo, le prese di oggi per orario e le terapie con il loro ritmo', async () => {
    const { pills } = setup();
    await renderIt();
    expect(screen.getByText('Tasks')).toBeTruthy();
    const today = pills.day(TODAY).doses;
    expect(today).toHaveLength(3);
    for (const d of today) expect(screen.getByTestId(`dose-${d.uuid}`)).toBeTruthy();
    // le terapie con il ritmo a parole
    expect(screen.getByText('every day  ·  08:00, 20:00')).toBeTruthy();
    expect(screen.getByText('every day  ·  13:00')).toBeTruthy();
    expect(screen.getByTestId('plan-new')).toBeTruthy();
  });

  it('senza terapie invita a aggiungere la prima', async () => {
    setup(false);
    await renderIt();
    expect(screen.getByTestId('pills-empty')).toBeTruthy();
    expect(screen.getByText('Add your first treatment below.')).toBeTruthy();
  });

  it('un tocco spunta la presa, un altro la rimette da prendere; il tocco lungo la salta', async () => {
    const { pills } = setup();
    const view = await renderIt();
    const d = pills.day(TODAY).doses[0]!;
    await fireEvent.press(screen.getByTestId(`dose-box-${d.uuid}`));
    expect(pills.dose(d.uuid)).toMatchObject({ status: 'taken' });
    expect(mockChanged).toHaveBeenCalled();
    await rerender();
    await view.rerender(
      <ThemeProvider>
        <PillsScreen />
      </ThemeProvider>,
    );
    expect(screen.getByTestId(`dose-when-${d.uuid}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`dose-box-${d.uuid}`));
    expect(pills.dose(d.uuid)).toMatchObject({ status: 'pending', taken_at: null });
    await fireEvent(screen.getByTestId(`dose-box-${d.uuid}`), 'longPress');
    expect(pills.dose(d.uuid)).toMatchObject({ status: 'skipped' });
  });

  it('«Prese tutte» di oggi segna tutte le prese aperte', async () => {
    const { pills } = setup();
    await renderIt();
    await fireEvent.press(screen.getByTestId('takeall-today'));
    expect(pills.day(TODAY).doses.every((d) => d.status === 'taken')).toBe(true);
  });

  it('le arretrate stanno in cima: la spunta chiede quando, «dimenticata» la salta', async () => {
    const { pills } = setup();
    await renderIt();
    const late = pills.day(TODAY).late;
    expect(late.length).toBeGreaterThanOrEqual(6);
    expect(screen.getByTestId('pills-late')).toBeTruthy();
    // spuntare una presa di un giorno scorso chiede quando
    await fireEvent.press(screen.getByTestId(`dose-box-${late[0]!.uuid}`));
    expect(screen.getByTestId('taken-modal')).toBeTruthy();
    expect(pills.dose(late[0]!.uuid)!.status).toBe('pending');
    await fireEvent.press(screen.getByTestId('taken-save'));
    const d = pills.dose(late[0]!.uuid)!;
    expect(d.status).toBe('taken');
    // si parte dall'ora prevista, sul giorno della presa
    expect(d.taken_at).toBe(`${late[0]!.due_date} ${late[0]!.due_time}:00`);
    // «dimenticata» la salta
    await fireEvent.press(screen.getByTestId(`dose-forgot-${late[1]!.uuid}`));
    expect(pills.dose(late[1]!.uuid)!.status).toBe('skipped');
  });

  it('«Prese tutte» sulle arretrate chiede a che ora scriverle', async () => {
    const { pills } = setup();
    await renderIt();
    const late = pills.day(TODAY).late;
    await fireEvent.press(screen.getByTestId('takeall-late'));
    expect(screen.getByTestId('takeall-modal')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('takeall-ontime'));
    for (const d of late) {
      expect(pills.dose(d.uuid)).toMatchObject({
        status: 'taken',
        taken_at: `${d.due_date} ${d.due_time}:00`,
      });
    }
  });

  it('una terapia nuova: il nome è obbligatorio, poi si salva e compare', async () => {
    const { pills } = setup(false);
    await renderIt();
    await fireEvent.press(screen.getByTestId('plan-new'));
    expect(screen.getByTestId('plan-modal')).toBeTruthy();
    // senza nome non salva e il campo si evidenzia
    await fireEvent.press(screen.getByTestId('plan-save'));
    expect(pills.plans()).toHaveLength(0);
    expect(screen.getByTestId('plan-modal')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('plan-name'), 'Magnesium');
    await fireEvent.changeText(screen.getByTestId('plan-dose'), 'one tablet');
    await fireEvent.press(screen.getByTestId('plan-time-0-more'));
    await fireEvent.press(screen.getByTestId('plan-time-add'));
    await fireEvent.press(screen.getByTestId('plan-save'));
    const saved = pills.plans();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      name: 'Magnesium',
      dose: 'one tablet',
      times: '08:00x2,20:00x1',
    });
    expect(screen.queryByTestId('plan-modal')).toBeNull();
  });

  it('il ritmo: giorni della settimana, giorni del mese, ogni N giorni', async () => {
    const { pills, vit } = setup();
    await renderIt();
    await fireEvent.press(screen.getByTestId(`plan-${vit}`));
    // tolgo sabato e domenica
    await fireEvent.press(screen.getByTestId('plan-wd-5'));
    await fireEvent.press(screen.getByTestId('plan-wd-6'));
    await fireEvent.press(screen.getByTestId('plan-save'));
    expect(pills.plan(vit)!.weekdays).toBe('1111100');
    // mensile senza giorni: non salva
    await fireEvent.press(screen.getByTestId(`plan-${vit}`));
    await fireEvent.press(screen.getByTestId('plan-freq-monthly'));
    await fireEvent.press(screen.getByTestId('plan-save'));
    expect(pills.plan(vit)!.freq_type).toBe('daily');
    await fireEvent.changeText(screen.getByTestId('plan-monthdays'), '1,15');
    await fireEvent.press(screen.getByTestId('plan-save'));
    expect(pills.plan(vit)).toMatchObject({ freq_type: 'monthly', month_days: '1,15' });
    await fireEvent.press(screen.getByTestId(`plan-${vit}`));
    await fireEvent.press(screen.getByTestId('plan-freq-interval'));
    await fireEvent.changeText(screen.getByTestId('plan-interval'), '3');
    await fireEvent.press(screen.getByTestId('plan-save'));
    expect(pills.plan(vit)).toMatchObject({ freq_type: 'interval', interval_days: 3 });
  });

  it('almeno un orario resta; «sospesa» ferma la terapia', async () => {
    const { pills, vit } = setup();
    await renderIt();
    await fireEvent.press(screen.getByTestId(`plan-${vit}`));
    await fireEvent.press(screen.getByTestId('plan-time-1-del'));
    expect(screen.queryByTestId('plan-time-1')).toBeNull();
    await fireEvent.press(screen.getByTestId('plan-time-0-del')); // l'ultimo non si toglie
    expect(screen.getByTestId('plan-time-0')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('plan-active'));
    await fireEvent.press(screen.getByTestId('plan-save'));
    expect(pills.plan(vit)).toMatchObject({ is_active: 0, times: '08:00x1' });
  });

  it('toccando il nome di una presa si apre il calendario; il giorno chiede quante prese', async () => {
    const { pills, vit } = setup();
    await renderIt();
    const d = pills.day(TODAY).doses.find((x) => x.plan_uuid === vit && x.due_time === '08:00')!;
    await fireEvent.press(screen.getByTestId(`dose-text-${d.uuid}`));
    expect(screen.getByTestId('chart-modal')).toBeTruthy();
    expect(screen.getByTestId(`cal-${vit}`)).toBeTruthy();
    // il calendario parte dal mese in corso; se «due giorni fa» è nel mese scorso si torna indietro
    if (TWO_DAYS_AGO.slice(0, 7) !== TODAY.slice(0, 7))
      await fireEvent.press(screen.getByTestId('cal-prev'));
    // il giorno prima di ieri: «ne ho prese 1 su 2»
    await fireEvent.press(screen.getByTestId(`cal-day-${TWO_DAYS_AGO}`));
    expect(screen.getByTestId('daycount-modal')).toBeTruthy();
    expect(screen.getByTestId('daycount-value').props.children).toBe(0);
    await fireEvent.press(screen.getByTestId('daycount-plus'));
    await fireEvent.press(screen.getByTestId('daycount-save'));
    const day = pills.history(vit, TWO_DAYS_AGO, TWO_DAYS_AGO)[0]!;
    expect(day).toMatchObject({ taken: 1, skipped: 1, pending: 0 });
    // oggi è l'ultimo giorno che si può toccare: i giorni dopo non hanno tasto
    expect(screen.queryByTestId(`cal-day-${addDaysIso(TODAY, 1)}`)).toBeNull();
  });

  it('elimina una terapia dopo la conferma', async () => {
    const { pills, omega } = setup();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderIt();
    await fireEvent.press(screen.getByTestId(`plan-${omega}`));
    await fireEvent.press(screen.getByTestId('plan-delete'));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(pills.plan(omega)).not.toBeNull();
    const buttons = alert.mock.calls[0]![2]!;
    await act(async () => buttons.find((b) => b.style === 'destructive')!.onPress!());
    expect(pills.plan(omega)).toBeNull();
    expect(within(screen.getByTestId('pills-late')).queryByText(/Omega/)).toBeNull();
  });
});
