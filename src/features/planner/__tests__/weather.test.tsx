import { act, fireEvent, render, screen } from '@testing-library/react-native';

import '@/core/i18n';
import { wxState, type AccountApi, type WxDay } from '@/core/account/accountApi';
import { ThemeProvider, useTheme } from '@/core/theme/ThemeProvider';

import { plannerTheme } from '../plannerTheme';
import { WeatherCard, WxPlacePicker, WxPopup, WxTag } from '../WeatherUi';
import { WeatherStore, wxIconName, wxTagText, wxTone, wxUvKey } from '../weather';

const raw = {
  enabled: true,
  place: 'Milano',
  lat: 45.46,
  lon: 9.19,
  fonte: 'Open-Meteo',
  fonte_url: 'https://open-meteo.com',
  nota_affidabilita: 'Our estimate',
  adesso: {
    ora: '14:00',
    label: 'Clear',
    icon: 'sole',
    temp: 12,
    percepita: 10,
    umidita: 55,
    vento: 8,
  },
  giorni: {
    '2026-11-17': {
      code: 0,
      label: 'Clear',
      icon: 'sole',
      tmax: 14,
      tmin: 6,
      pioggia: 10,
      vento: 12,
      uv: 2.5,
      alba: '07:20',
      tramonto: '16:55',
      sole_min: 380,
      affidabilita: 95,
    },
    '2026-11-18': { code: 63, label: 'Rain', icon: 'pioggia', tmax: 10, tmin: 5, pioggia: 80 },
  },
};

describe('weather helpers', () => {
  test('the sun becomes the moon after sunset, only today', () => {
    const day = wxState(raw).giorni['2026-11-17']!;
    const evening = new Date(2026, 10, 17, 18, 0);
    const noon = new Date(2026, 10, 17, 12, 0);
    expect(wxIconName('sole', day, true, evening)).toBe('luna');
    expect(wxIconName('sole-nubi', day, true, evening)).toBe('luna-nubi');
    expect(wxIconName('sole', day, true, noon)).toBe('sole');
    expect(wxIconName('sole', day, false, evening)).toBe('sole');
    expect(wxIconName('pioggia', day, true, evening)).toBe('pioggia');
  });
  test('tones and tag text follow the website', () => {
    expect(wxTone('pioggia-leggera')).toBe('rain');
    expect(wxTone('luna')).toBe('moon');
    expect(wxTone('nubi')).toBe('plain');
    const d = wxState(raw).giorni['2026-11-17']!;
    expect(wxTagText(d, { single: true, today: true, now: 12 })).toBe('12° · 6/14°');
    expect(wxTagText(d, { single: true, today: false, now: 12 })).toBe('6/14°');
    expect(wxTagText(d, { single: false, today: true, now: 12 })).toBe('14°');
    expect(wxUvKey(2.5)).toBe('planner.uv_basso');
    expect(wxUvKey(12)).toBe('planner.uv_estremo');
  });
  test('wxState tolerates missing fields', () => {
    const s = wxState({ enabled: false });
    expect(s.enabled).toBe(false);
    expect(s.giorni).toEqual({});
    expect(s.adesso).toBeNull();
    expect(s.fonteUrl).toBe('https://open-meteo.com');
  });
});

describe('WeatherStore', () => {
  const api = (over: Partial<AccountApi> = {}) =>
    ({
      weather: jest.fn(async () => wxState(raw)),
      weatherEnable: jest.fn(async () => wxState(raw)),
      weatherDisable: jest.fn(async () => undefined),
      weatherPreview: jest.fn(async () => wxState({ ...raw, manual: true, place: 'Roma' })),
      ...over,
    }) as unknown as AccountApi;

  test('loads once, then reuses the answer for ten minutes unless forced', async () => {
    const store = new WeatherStore();
    const a = api();
    await store.load(a);
    await store.load(a);
    expect(a.weather).toHaveBeenCalledTimes(1);
    await store.load(a, true);
    expect(a.weather).toHaveBeenCalledTimes(2);
    expect(store.state?.place).toBe('Milano');
  });
  test('a failed load is remembered, and turning it off is immediate', async () => {
    const store = new WeatherStore();
    await store.load(api({ weather: jest.fn(async () => Promise.reject(new Error('net'))) }));
    expect(store.failed).toBe(true);
    const a = api();
    await store.load(a, true);
    const pending = store.disable(a);
    expect(store.state?.enabled).toBe(false);
    await pending;
    expect(a.weatherDisable).toHaveBeenCalled();
  });
  test('previewing another place keeps the answer as manual', async () => {
    const store = new WeatherStore();
    await store.preview(api(), 41.9, 12.5, 'Roma');
    expect(store.state?.manual).toBe(true);
    expect(store.state?.place).toBe('Roma');
  });
});

function Themed({
  children,
}: {
  children: (pt: ReturnType<typeof plannerTheme>) => React.ReactNode;
}) {
  const th = useTheme();
  return <>{children(plannerTheme('paper', th))}</>;
}
const wrap = (ui: (pt: ReturnType<typeof plannerTheme>) => React.ReactNode) => (
  <ThemeProvider>
    <Themed>{ui}</Themed>
  </ThemeProvider>
);

describe('weather UI', () => {
  test('the card says where and how warm, and toggles', async () => {
    const onToggle = jest.fn();
    const onOpen = jest.fn();
    await render(
      wrap((pt) => (
        <WeatherCard
          pt={pt}
          wx={wxState(raw)}
          today="2026-11-17"
          busy={false}
          onToggle={onToggle}
          onOpen={onOpen}
        />
      )),
    );
    expect(screen.getByTestId('ps-weather-sub').props.children).toBe('Milano · 12° · 6/14°');
    await fireEvent(screen.getByTestId('ps-weather-toggle'), 'valueChange', false);
    expect(onToggle).toHaveBeenCalledWith(false);
    await fireEvent.press(screen.getByTestId('ps-weather-open'));
    expect(onOpen).toHaveBeenCalled();
  });
  test('a switched-off card shows the hint and no forecast button', async () => {
    await render(
      wrap((pt) => (
        <WeatherCard
          pt={pt}
          wx={wxState({ enabled: false })}
          today="2026-11-17"
          busy={false}
          onToggle={() => undefined}
          onOpen={() => undefined}
        />
      )),
    );
    expect(screen.queryByTestId('ps-weather-open')).toBeNull();
  });
  test('the tag opens the day', async () => {
    const onPress = jest.fn();
    const day: WxDay = wxState(raw).giorni['2026-11-18']!;
    await render(
      wrap((pt) => (
        <WxTag
          pt={pt}
          date="2026-11-18"
          day={day}
          today={false}
          nowTemp={null}
          single={false}
          onPress={onPress}
        />
      )),
    );
    await fireEvent.press(screen.getByTestId('wx-tag-2026-11-18'));
    expect(onPress).toHaveBeenCalledWith('2026-11-18');
  });
  test('the popup pages through days, shows the details and turns the weather off', async () => {
    const onDate = jest.fn();
    const onOff = jest.fn();
    await render(
      wrap((pt) => (
        <WxPopup
          pt={pt}
          wx={wxState(raw)}
          date="2026-11-17"
          today="2026-11-17"
          title={(d) => `Day ${d}`}
          onDate={onDate}
          places={async () => []}
          onPreview={async () => undefined}
          onOff={onOff}
          onClose={() => undefined}
        />
      )),
    );
    expect(screen.getByTestId('wx-title').props.children).toBe('Day 2026-11-17');
    expect(screen.getByTestId('wx-now')).toBeTruthy();
    expect(screen.getByText('10%')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('wx-next'));
    expect(onDate).toHaveBeenCalledWith('2026-11-18');
    expect(screen.getByTestId('wx-prev').props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(screen.getByTestId('wx-off'));
    expect(onOff).toHaveBeenCalled();
  });
  test('the place picker waits for three letters and returns the chosen place', async () => {
    jest.useFakeTimers();
    const search = jest.fn(async () => [
      { nome: 'Lisbon', dove: 'Portugal', lat: 38.7, lon: -9.1 },
    ]);
    const onPick = jest.fn();
    await render(wrap((pt) => <WxPlacePicker pt={pt} search={search} onPick={onPick} />));
    await fireEvent.changeText(screen.getByTestId('wx-place-input'), 'Li');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(400);
    });
    expect(search).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('wx-place-input'), 'Lisb');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(400);
    });
    expect(search).toHaveBeenCalledWith('Lisb');
    await fireEvent.press(screen.getByTestId('wx-place-0'));
    expect(onPick).toHaveBeenCalledWith({ nome: 'Lisbon', dove: 'Portugal', lat: 38.7, lon: -9.1 });
    jest.useRealTimers();
  });
});
