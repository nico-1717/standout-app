import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { BookRepo } from '@/features/planner/book';
import { SEARCH_DELAY_MS, mapsUrl } from '@/features/planner/PlaceSearch';
import { PlannerRepo } from '@/features/planner/repo';

import PlannerManage from '../planner-manage';
import PlannerScreen from '../(tabs)/planner';

let mockServices: unknown;
const mockAccount = { placeSearch: jest.fn(), placeDetails: jest.fn() };
let mockOpenURL: jest.SpyInstance;

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({
    services: mockServices,
    version: 0,
    changed: jest.fn(),
    account: mockAccount,
    uiStyle: 'standard',
    plannerSettings: {
      ...jest.requireActual('@/features/planner/settings').DEFAULT_PLANNER_SETTINGS,
      first_week_start: null,
      first_week_number: 1,
    },
  }),
}));

const DUOMO = {
  name: 'Duomo di Milano',
  detail: 'Piazza del Duomo, Milano',
  full: 'Duomo di Milano, Piazza del Duomo, Milano',
  ref: 'g-duomo',
  lat: null,
  lon: null,
};
const OSM = {
  ...DUOMO,
  name: 'Bar Roma',
  full: 'Bar Roma, Roma',
  ref: 'osm-1',
  lat: 41.9,
  lon: 12.5,
};

function setup() {
  const db = memoryDb();
  migrate(db);
  const planner = new PlannerRepo(db);
  const book = new BookRepo(db);
  db.run(
    `INSERT INTO planner_calendars (uuid, name, is_visible, is_default, def_repeat, def_notify, sort_key) VALUES ('cal-main', 'Main', 1, 1, 'none', 'none', 'a0')`,
  );
  mockServices = { db, planner, book };
  return { planner, book };
}
const wrap = (el: React.ReactElement) => render(<ThemeProvider>{el}</ThemeProvider>);
const flush = async (ms = 0) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
  });
};
async function openSheetAndType(text: string) {
  await wrap(<PlannerScreen />);
  await fireEvent.press(screen.getByTestId('planner-add'));
  await fireEvent.changeText(screen.getByTestId('sheet-title'), 'Visit');
  await fireEvent.changeText(screen.getByTestId('sheet-location'), text);
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockOpenURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  mockAccount.placeSearch.mockResolvedValue([DUOMO]);
  mockAccount.placeDetails.mockResolvedValue({
    lat: 45.464,
    lon: 9.19,
    full: DUOMO.full,
    ref: DUOMO.ref,
  });
});
afterEach(() => jest.useRealTimers());

describe('place search in the event sheet', () => {
  test('waits for a pause and for 3 letters, then lists the places', async () => {
    setup();
    await openSheetAndType('du');
    await flush(SEARCH_DELAY_MS + 50);
    expect(mockAccount.placeSearch).not.toHaveBeenCalled(); // meno di 3 lettere
    await fireEvent.changeText(screen.getByTestId('sheet-location'), 'duo');
    await fireEvent.changeText(screen.getByTestId('sheet-location'), 'duomo');
    await flush(SEARCH_DELAY_MS - 100);
    expect(mockAccount.placeSearch).not.toHaveBeenCalled(); // ancora in pausa
    await flush(200);
    expect(mockAccount.placeSearch).toHaveBeenCalledTimes(1); // una sola ricerca, a frase finita
    expect(mockAccount.placeSearch).toHaveBeenCalledWith('duomo', expect.any(String));
    expect(screen.getByTestId('place-hit-0')).toBeTruthy();
    expect(screen.getByText('Piazza del Duomo, Milano')).toBeTruthy();
  });

  test('choosing a place fills the text, then asks for the coordinates once and shows the map', async () => {
    const { planner } = setup();
    await openSheetAndType('duomo');
    await flush(SEARCH_DELAY_MS + 50);
    await fireEvent.press(screen.getByTestId('place-hit-0'));
    expect(screen.getByTestId('sheet-location').props.value).toBe(DUOMO.full);
    expect(screen.queryByTestId('place-hits')).toBeNull();
    await flush();
    expect(mockAccount.placeDetails).toHaveBeenCalledTimes(1);
    expect(mockAccount.placeDetails).toHaveBeenCalledWith('g-duomo', expect.any(String));
    expect(screen.getByTestId('place-map')).toBeTruthy();
    expect(screen.queryByTestId('place-waiting')).toBeNull();

    await fireEvent.press(screen.getByTestId('sheet-save'));
    expect(planner.rows().find((r) => r.title === 'Visit')).toMatchObject({
      location: DUOMO.full,
      place_name: 'Duomo di Milano',
      place_lat: 45.464,
      place_lon: 9.19,
      place_ref: 'g-duomo',
    });
  });

  test('the fallback search (OpenStreetMap) already has the coordinates: no second call', async () => {
    mockAccount.placeSearch.mockResolvedValue([OSM]);
    setup();
    await openSheetAndType('bar roma');
    await flush(SEARCH_DELAY_MS + 50);
    await fireEvent.press(screen.getByTestId('place-hit-0'));
    await flush();
    expect(mockAccount.placeDetails).not.toHaveBeenCalled();
    expect(screen.getByTestId('place-map')).toBeTruthy();
  });

  test('coordinates not found: the text stays and a note says so', async () => {
    mockAccount.placeDetails.mockResolvedValue(null);
    const { planner } = setup();
    await openSheetAndType('duomo');
    await flush(SEARCH_DELAY_MS + 50);
    await fireEvent.press(screen.getByTestId('place-hit-0'));
    await flush();
    expect(screen.getByTestId('place-not-found')).toBeTruthy();
    expect(screen.queryByTestId('place-map')).toBeNull();
    await fireEvent.press(screen.getByTestId('sheet-save'));
    expect(planner.rows().find((r) => r.title === 'Visit')).toMatchObject({
      location: DUOMO.full,
      place_lat: null,
    });
  });

  test('typing by hand drops the pin; the ✕ drops it but keeps the text; "open in map" opens the phone maps', async () => {
    setup();
    await openSheetAndType('duomo');
    await flush(SEARCH_DELAY_MS + 50);
    await fireEvent.press(screen.getByTestId('place-hit-0'));
    await flush();
    await fireEvent.press(screen.getByTestId('place-open-map'));
    expect(mockOpenURL).toHaveBeenCalledWith(expect.stringContaining('45.464,9.19'));
    await fireEvent.press(screen.getByTestId('place-clear'));
    expect(screen.queryByTestId('place-status')).toBeNull();
    expect(screen.getByTestId('sheet-location').props.value).toBe(DUOMO.full);
  });

  test('offline: no list, the text stays as typed', async () => {
    mockAccount.placeSearch.mockRejectedValue(new TypeError('Network request failed'));
    setup();
    await openSheetAndType('duomo');
    await flush(SEARCH_DELAY_MS + 50);
    expect(screen.queryByTestId('place-hits')).toBeNull();
    expect(screen.getByTestId('sheet-location').props.value).toBe('duomo');
  });

  test('nothing found says so', async () => {
    mockAccount.placeSearch.mockResolvedValue([]);
    setup();
    await openSheetAndType('xyzzy');
    await flush(SEARCH_DELAY_MS + 50);
    expect(screen.getByText('No place found.')).toBeTruthy();
  });
});

describe('saved places page', () => {
  test('search an address, pick it: the saved place keeps the name, coordinates and shows a map', async () => {
    const { book } = setup();
    await wrap(<PlannerManage />);
    await fireEvent.changeText(screen.getByTestId('place-new-address'), 'duomo');
    await flush(SEARCH_DELAY_MS + 50);
    await fireEvent.press(screen.getByTestId('place-hit-0'));
    await flush();
    expect(screen.getByTestId('place-new-address').props.value).toBe(DUOMO.full);
    expect(screen.getByTestId('place-new-label').props.value).toBe('Duomo di Milano'); // il nome si propone
    expect(screen.getByTestId('place-map')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('place-add'));
    expect(book.places()[0]).toMatchObject({
      label: 'Duomo di Milano',
      address: DUOMO.full,
      place_lat: 45.464,
      place_lon: 9.19,
      place_ref: 'g-duomo',
    });
    expect(screen.queryByTestId('place-status')).toBeNull(); // il modulo si svuota
    await wrap(<PlannerManage />); // la pagina rilegge: il luogo salvato ha la sua mappa
    expect(screen.getAllByTestId(`place-onmap-${book.places()[0]!.uuid}`).length).toBeGreaterThan(
      0,
    );
  });

  test('typing by hand after a pick drops the coordinates', async () => {
    const { book } = setup();
    await wrap(<PlannerManage />);
    await fireEvent.changeText(screen.getByTestId('place-new-address'), 'duomo');
    await flush(SEARCH_DELAY_MS + 50);
    await fireEvent.press(screen.getByTestId('place-hit-0'));
    await flush();
    await fireEvent.changeText(screen.getByTestId('place-new-address'), 'Via Roma 1');
    await fireEvent.changeText(screen.getByTestId('place-new-label'), 'Gym');
    await fireEvent.press(screen.getByTestId('place-add'));
    expect(book.places()[0]).toMatchObject({ label: 'Gym', place_lat: null, place_ref: null });
  });
});

describe('maps link', () => {
  test('Apple Maps on iPhone, Google Maps on Android', () => {
    expect(mapsUrl(45.1, 9.2, 'Gym & Co', 'ios')).toBe(
      'https://maps.apple.com/?ll=45.1,9.2&q=Gym%20%26%20Co',
    );
    expect(mapsUrl(45.1, 9.2, null, 'android')).toBe(
      'https://www.google.com/maps/search/?api=1&query=45.1,9.2',
    );
  });
});
