import { act, fireEvent, render, screen } from '@testing-library/react-native';

import '@/core/i18n';
import { wxState, type AccountApi, type WxDay } from '@/core/account/accountApi';
import { ThemeProvider, useTheme } from '@/core/theme/ThemeProvider';

import { plannerTheme } from '../plannerTheme';
import { WeatherCard, WxPlacePicker, WxPopup, WxTag } from '../WeatherUi';
import { hourIcon, WxChart } from '../WxChart';
import { WX_ICONS, wxSvg, wxTint } from '../weatherIcons';
import { WeatherStore, wxHourIconName, wxIconName, wxTagText, wxTone, wxUvKey } from '../weather';

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
      pioggia_mm: 2.4,
      pioggia_ore: 3,
      ore: Array.from({ length: 12 }, (_, k) => ({
        h: `${String(6 + k).padStart(2, '0')}:00`,
        i: k === 0 ? 'nubi' : k === 6 ? 'sole-nubi' : 'sole',
        l: 'Clear',
        t: k === 6 ? 13 : 5 + (k % 4),
        ap: 3,
        p: k === 6 ? 20 : 0,
        v: 6,
        u: 70,
      })),
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
      weatherPlace: jest.fn(async () => wxState({ ...raw, place: 'Roma', auto: false })),
      weatherMode: jest.fn(async (auto: boolean) => auto),
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
  test('a chosen place stays (manual mode); the mode can be flipped without moving the place', async () => {
    const store = new WeatherStore();
    const a = api();
    await store.load(a, true);
    await store.setPlace(a, 41.9, 12.5, 'Roma');
    expect(a.weatherPlace).toHaveBeenCalledWith(41.9, 12.5, 'Roma');
    expect(store.state?.place).toBe('Roma');
    expect(store.state?.auto).toBe(false);
    await store.setAuto(a, true);
    expect(store.state?.auto).toBe(true);
    expect(store.state?.place).toBe('Roma');
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
  test('the card offers Automatic or Chosen place, and Change place only in manual mode', async () => {
    const onMode = jest.fn();
    const onChangePlace = jest.fn();
    const view = await render(
      wrap((pt) => (
        <WeatherCard
          pt={pt}
          wx={{ ...wxState(raw), auto: false }}
          today="2026-11-17"
          busy={false}
          onToggle={jest.fn()}
          onOpen={jest.fn()}
          onMode={onMode}
          onChangePlace={onChangePlace}
        />
      )),
    );
    await fireEvent.press(screen.getByTestId('ps-weather-change-place'));
    expect(onChangePlace).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('ps-weather-mode-auto'));
    expect(onMode).toHaveBeenCalledWith(true);
    // già a mano: toccare «a mano» non fa niente
    await fireEvent.press(screen.getByTestId('ps-weather-mode-manual'));
    expect(onMode).toHaveBeenCalledTimes(1);
    await view.rerender(
      wrap((pt) => (
        <WeatherCard
          pt={pt}
          wx={{ ...wxState(raw), auto: true }}
          today="2026-11-17"
          busy={false}
          onToggle={jest.fn()}
          onOpen={jest.fn()}
          onMode={onMode}
          onChangePlace={onChangePlace}
        />
      )),
    );
    expect(screen.queryByTestId('ps-weather-change-place')).toBeNull();
  });

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
  test('the big forecast tile previews today: place, degrees, sky and the rain chance when high', async () => {
    const rainy = wxState({
      ...raw,
      adesso: { ...raw.adesso, temp: 6 },
      giorni: { '2026-11-18': raw.giorni['2026-11-18'] },
    });
    await render(
      wrap((pt) => (
        <WeatherCard
          pt={pt}
          wx={rainy}
          today="2026-11-18"
          busy={false}
          onToggle={() => undefined}
          onOpen={() => undefined}
        />
      )),
    );
    expect(screen.getByText('TODAY IN MILANO')).toBeTruthy();
    expect(screen.getByText(/Rain · 80% chance of rain/)).toBeTruthy();
    expect(screen.getByText("See today's forecast →")).toBeTruthy();
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
  test('the hour-by-hour chart: hours, temperatures, sunrise and sunset, and the now line only today', async () => {
    const day = wxState(raw).giorni['2026-11-17']!;
    expect(day.ore).toHaveLength(12);
    expect(day.pioggia_ore).toBe(3);
    // il sole diventa luna dopo il tramonto, ora per ora
    expect(hourIcon(day, day.ore[2]!)).toBe('sole');
    expect(hourIcon(day, day.ore[11]!)).toBe('luna');
    expect(hourIcon(day, day.ore[0]!)).toBe('nubi');
    const noon = new Date(2026, 10, 17, 12, 30);
    await render(wrap((pt) => <WxChart pt={pt} day={day} isToday now={noon} />));
    expect(screen.getByTestId('wx-chart')).toBeTruthy();
    expect(screen.getByTestId('wx-chart-t-6')).toHaveTextContent('13°');
    expect(screen.getByTestId('wx-chart-sunrise')).toHaveTextContent('↑ 07:20');
    expect(screen.getByTestId('wx-chart-sunset')).toHaveTextContent('↓ 16:55');
    expect(screen.getByTestId('wx-chart-now')).toBeTruthy();
    await screen.unmount();
    await render(wrap((pt) => <WxChart pt={pt} day={day} isToday={false} />));
    expect(screen.queryByTestId('wx-chart-now')).toBeNull();
  });
  test('the popup shows the chart only when the day has hours, and the rain duration', async () => {
    const mk = (date: string) =>
      wrap((pt) => (
        <WxPopup
          pt={pt}
          wx={wxState(raw)}
          date={date}
          today="2026-11-17"
          title={(d) => d}
          onDate={() => undefined}
          places={async () => []}
          onPreview={async () => undefined}
          onOff={() => undefined}
          onClose={() => undefined}
        />
      ));
    await render(mk('2026-11-17'));
    expect(screen.getByTestId('wx-chart')).toBeTruthy();
    expect(screen.getByText('2.4 mm · 3 hours')).toBeTruthy();
    await screen.unmount();
    await render(mk('2026-11-18'));
    expect(screen.queryByTestId('wx-chart')).toBeNull();
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

describe('the icon of one hour', () => {
  test('the sun turns into the moon outside sunrise-sunset of that day, rain stays rain', () => {
    const day = wxState(raw).giorni['2026-11-17']!;
    expect(wxHourIconName('sole', day, 12 * 60)).toBe('sole');
    expect(wxHourIconName('sole', day, 17 * 60)).toBe('luna');
    expect(wxHourIconName('sole-nubi', day, 5 * 60)).toBe('luna-nubi');
    expect(wxHourIconName('pioggia', day, 23 * 60)).toBe('pioggia');
    expect(wxHourIconName('sole', undefined, 21 * 60)).toBe('luna');
  });
});

describe('the red heat sun and the coloured icons', () => {
  const day = wxState(raw).giorni['2026-11-17']!;
  test('a clear sky from 32 degrees is the heat sun, other skies and cooler hours are not', () => {
    expect(wxHourIconName('sole', day, 12 * 60, 32)).toBe('caldo');
    expect(wxHourIconName('sole', day, 12 * 60, 31)).toBe('sole');
    expect(wxHourIconName('sole-nubi', day, 12 * 60, 40)).toBe('sole-nubi');
    expect(wxHourIconName('sole', day, 20 * 60, 40)).toBe('luna');
    expect(wxIconName('sole', day, false, new Date(), 36)).toBe('caldo');
    expect(wxIconName('sole', day, false, new Date(), 20)).toBe('sole');
    expect(wxTone('caldo')).toBe('heat');
  });
  test('every icon is filled in with its own colours, light or dark, or with a single colour', () => {
    for (const name of Object.keys(WX_ICONS)) {
      const own = wxSvg(name);
      expect(own).not.toMatch(/\{\w+\}/);
      const mono = wxSvg(name, { mono: '#123456' });
      expect(mono).not.toMatch(/#(F2A100|64748B|1C6EF2|26A0D8|7A3FE0|4B57D4|E5322D|7B8A9C)/i);
      expect(mono).toContain('#123456');
    }
    expect(wxSvg('caldo')).toContain('#E5322D');
    expect(wxSvg('caldo', { dark: true })).toContain('#FF6B5E');
    expect(wxSvg('neve')).toContain('#26A0D8');
    expect(wxSvg('pioggia')).toContain('#64748B');
    expect(wxSvg('pioggia')).toContain('#1C6EF2');
    expect(wxTint('luna-nubi')).toBe('moon');
  });
});
