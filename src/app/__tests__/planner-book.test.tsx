import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { upsertRow } from '@/core/sync/rows';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { BookRepo } from '@/features/planner/book';
import { PlannerRepo } from '@/features/planner/repo';
import { localToday } from '@/features/tasks/groups';

import PlannerManage from '../planner-manage';
import PlannerScreen from '../(tabs)/planner';

let mockServices: unknown;
let mockVersion = 0;
const mockChanged = jest.fn(() => {
  mockVersion += 1;
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({
    services: mockServices,
    version: mockVersion,
    changed: mockChanged,
    uiStyle: 'standard',
    plannerSettings: {
      ...jest.requireActual('@/features/planner/settings').DEFAULT_PLANNER_SETTINGS,
      first_week_start: null,
      first_week_number: 1,
    },
  }),
}));

const TODAY = localToday();

function setup() {
  mockVersion = 0;
  mockChanged.mockClear();
  const db = memoryDb();
  migrate(db);
  const planner = new PlannerRepo(db);
  const book = new BookRepo(db);
  upsertRow(db, 'planner_calendars', {
    uuid: 'cal-main',
    name: 'Main',
    color: null,
    is_visible: true,
    is_default: true,
    role: null,
    keywords: '',
    def_repeat: 'none',
    def_notify: 'none',
    sort_key: 'a0',
    created_at: null,
    updated_at: null,
  });
  mockServices = { db, planner, book };
  return { db, planner, book };
}
const wrap = (el: React.ReactElement) => render(<ThemeProvider>{el}</ThemeProvider>);

describe('Event sheet: guests and saved places', () => {
  test('guests: pick from the address book, type an address, refuse a bad one, remove one', async () => {
    const { planner, book } = setup();
    const anna = book.addContact('anna@example.com', 'Anna')!;
    await wrap(<PlannerScreen />);
    await fireEvent.press(screen.getByTestId('planner-add'));
    await fireEvent.changeText(screen.getByTestId('sheet-title'), 'Lunch');
    await fireEvent.press(screen.getByTestId(`guest-pick-${anna}`));
    expect(screen.queryByTestId(`guest-pick-${anna}`)).toBeNull();
    expect(screen.getByTestId('guest-anna@example.com')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('guest-input'), 'nope');
    await fireEvent.press(screen.getByTestId('guest-add'));
    expect(screen.getByTestId('guest-error')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('guest-input'), 'Bob@Example.com');
    await fireEvent.press(screen.getByTestId('guest-add'));
    expect(screen.queryByTestId('guest-error')).toBeNull();
    await fireEvent.press(screen.getByTestId('guest-add')); // vuoto: niente
    await fireEvent.changeText(screen.getByTestId('guest-input'), 'zed@example.com');
    await fireEvent.press(screen.getByTestId('guest-add'));
    await fireEvent.press(screen.getByTestId('guest-zed@example.com')); // si toglie
    await fireEvent.press(screen.getByTestId('sheet-save'));
    const ev = planner.rows().find((r) => r.title === 'Lunch')!;
    expect(book.guests(ev.uuid).map((g) => [g.email, g.name, g.contact_uuid])).toEqual([
      ['anna@example.com', 'Anna', anna],
      ['bob@example.com', null, null],
    ]);
  });

  test('an event already saved shows its guests, and the changes are kept', async () => {
    const { planner, book } = setup();
    const id = planner.create({ title: 'Dentist', date: TODAY, start: '15:00', end: '16:00' });
    book.setGuests(id, [{ email: 'a@b.it', name: 'Ada' }, { email: 'c@b.it' }]);
    await wrap(<PlannerScreen />);
    await fireEvent.press(screen.getByTestId(`ev-${id}@${TODAY}`));
    expect(screen.getByTestId('guest-a@b.it')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('guest-c@b.it'));
    await fireEvent.press(screen.getByTestId('sheet-save'));
    expect(book.guests(id).map((g) => g.email)).toEqual(['a@b.it']);
  });

  test('a saved place fills the location and its coordinates; typing by hand clears them', async () => {
    const { planner, book } = setup();
    const gym = book.addPlace({
      label: 'Gym',
      keywords: 'palestra',
      address: 'Via Roma 1',
      lat: 45.1,
      lon: 9.2,
    })!;
    await wrap(<PlannerScreen />);
    await fireEvent.press(screen.getByTestId('planner-add'));
    await fireEvent.changeText(screen.getByTestId('sheet-title'), 'Palestra con Luca');
    await fireEvent.press(screen.getByTestId(`place-pick-${gym}`));
    expect(screen.getByTestId('sheet-location').props.value).toBe('Via Roma 1');
    await fireEvent.press(screen.getByTestId('sheet-save'));
    const ev = planner.rows().find((r) => r.title === 'Palestra con Luca')!;
    expect(ev).toMatchObject({
      location: 'Via Roma 1',
      place_name: 'Gym',
      place_lat: 45.1,
      place_lon: 9.2,
    });

    await fireEvent.press(screen.getByTestId(`ev-${ev.uuid}@${ev.event_date}`));
    await fireEvent.changeText(screen.getByTestId('sheet-location'), 'Somewhere else');
    await fireEvent.press(screen.getByTestId('sheet-save'));
    expect(planner.row(ev.uuid)).toMatchObject({
      location: 'Somewhere else',
      place_name: null,
      place_lat: null,
    });
  });

  test('the smart bar invites a contact named in the sentence', async () => {
    const { planner, book } = setup();
    book.addContact('luchino@example.com', 'Luchino');
    await wrap(<PlannerScreen />);
    await fireEvent.changeText(
      screen.getByTestId('smart-input'),
      'cena con luchino domani alle 8pm',
    );
    await fireEvent.press(screen.getByTestId('smart-go'));
    const ev = planner.rows().find((r) => r.title.toLowerCase().includes('cena'))!;
    expect(book.guests(ev.uuid).map((g) => [g.email, g.name])).toEqual([
      ['luchino@example.com', 'Luchino'],
    ]);
    expect(screen.getByTestId('smart-guests')).toBeTruthy();
  });

  test('without a book the sheet still works, with no guests field', async () => {
    const { db, planner } = setup();
    mockServices = { db, planner };
    await wrap(<PlannerScreen />);
    await fireEvent.press(screen.getByTestId('planner-add'));
    expect(screen.queryByTestId('guests-field')).toBeNull();
  });
});

describe('Address book and saved places page', () => {
  beforeEach(() => jest.restoreAllMocks());

  test('contacts: add, refuse bad and repeated addresses, edit, delete', async () => {
    const { book } = setup();
    await wrap(<PlannerManage />);
    expect(screen.getByTestId('contacts-empty')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('contact-new-email'), 'nope');
    await fireEvent.press(screen.getByTestId('contact-add'));
    expect(screen.getByTestId('contact-new-error')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('contact-new-name'), 'Anna');
    await fireEvent.changeText(screen.getByTestId('contact-new-email'), 'Anna@Example.com');
    await fireEvent.press(screen.getByTestId('contact-add'));
    expect(book.contacts().map((c) => [c.name, c.email])).toEqual([['Anna', 'anna@example.com']]);
    await fireEvent.changeText(screen.getByTestId('contact-new-email'), 'anna@example.com');
    await fireEvent.press(screen.getByTestId('contact-add'));
    expect(screen.getByTestId('contact-new-error')).toBeTruthy();
    expect(book.contacts()).toHaveLength(1);

    await wrap(<PlannerManage />);
    const id = book.contacts()[0]!.uuid;
    await fireEvent(screen.getAllByTestId(`contact-name-${id}`)[0]!, 'endEditing', {
      nativeEvent: { text: 'Anna Rossi' },
    });
    expect(book.contacts()[0]!.name).toBe('Anna Rossi');
    await fireEvent(screen.getAllByTestId(`contact-email-${id}`)[0]!, 'endEditing', {
      nativeEvent: { text: 'bad' },
    });
    expect(screen.getAllByTestId(`contact-error-${id}`).length).toBeGreaterThan(0);
    expect(book.contacts()[0]!.email).toBe('anna@example.com');

    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await fireEvent.press(screen.getAllByTestId(`contact-del-${id}`)[0]!);
    expect(book.contacts()).toEqual([]);
  });

  test('places: add, edit address and words, delete', async () => {
    const { book } = setup();
    await wrap(<PlannerManage />);
    expect(screen.getByTestId('places-empty')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('place-add')); // senza nome: niente
    expect(book.places()).toEqual([]);
    await fireEvent.changeText(screen.getByTestId('place-new-label'), 'Gym');
    await fireEvent.changeText(screen.getByTestId('place-new-address'), 'Via Roma 1');
    await fireEvent.press(screen.getByTestId('place-add'));
    expect(book.places().map((p) => [p.label, p.address])).toEqual([['Gym', 'Via Roma 1']]);

    await wrap(<PlannerManage />);
    const id = book.places()[0]!.uuid;
    await fireEvent(screen.getAllByTestId(`place-address-${id}`)[0]!, 'endEditing', {
      nativeEvent: { text: 'Via Milano 2' },
    });
    await fireEvent(screen.getAllByTestId(`place-words-${id}`)[0]!, 'endEditing', {
      nativeEvent: { text: 'Palestra, Allenamento' },
    });
    expect(book.places()[0]).toMatchObject({
      address: 'Via Milano 2',
      keywords: 'palestra, allenamento',
    });
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await fireEvent.press(screen.getAllByTestId(`place-del-${id}`)[0]!);
    expect(book.places()).toEqual([]);
  });
});
