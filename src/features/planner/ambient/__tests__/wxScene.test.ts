import { wxState } from '@/core/account/accountApi';

import { buildWxScene, wxCaldo, wxSceneInput, WXA_SCENA } from '../wxScene';

const raw = {
  enabled: true,
  adesso: { ora: '14:00', label: 'Rain', icon: 'pioggia', temp: 9, giorno: true },
  giorni: {
    '2026-11-17': { code: 61, label: 'Cloudy', icon: 'nubi', tmax: 14, tmin: 6 },
    '2026-11-18': { code: 0, label: 'Clear', icon: 'sole', tmax: 37, tmin: 20 },
  },
};

describe('weather scene input', () => {
  const noon = new Date(2026, 10, 17, 12, 0);
  test('today follows what the sky does now, other days the summary', () => {
    const wx = wxState(raw);
    expect(wxSceneInput(wx, '2026-11-17', '2026-11-17', noon)).toEqual({
      icon: 'pioggia',
      tmax: 14,
      night: false,
    });
    expect(wxSceneInput(wx, '2026-11-18', '2026-11-17', noon)).toEqual({
      icon: 'sole',
      tmax: 37,
      night: false,
    });
  });
  test('night comes from the server, the clock only when it is missing', () => {
    const dark = wxState({ ...raw, adesso: { ...raw.adesso, giorno: false } });
    expect(wxSceneInput(dark, '2026-11-17', '2026-11-17', noon)?.night).toBe(true);
    const noFlag = wxState({ ...raw, adesso: { ...raw.adesso, giorno: undefined } });
    expect(
      wxSceneInput(noFlag, '2026-11-17', '2026-11-17', new Date(2026, 10, 17, 22))?.night,
    ).toBe(true);
    expect(wxSceneInput(noFlag, '2026-11-17', '2026-11-17', noon)?.night).toBe(false);
  });
  test('nothing when the weather is off or the day has no forecast', () => {
    expect(wxSceneInput(wxState({ enabled: false }), '2026-11-17', '2026-11-17', noon)).toBeNull();
    expect(wxSceneInput(wxState(raw), '2027-01-01', '2026-11-17', noon)).toBeNull();
    expect(wxSceneInput(null, '2026-11-17', '2026-11-17', noon)).toBeNull();
  });
});

describe('weather scene recipes', () => {
  test('heat has three steps decided by the daily maximum', () => {
    expect([null, 20, 28, 32, 36].map(wxCaldo)).toEqual([0, 0, 1, 2, 3]);
  });
  test('every kind of weather has a recipe and the pieces match it', () => {
    for (const icon of Object.keys(WXA_SCENA)) {
      const s = buildWxScene({ icon, tmax: 15, night: false });
      expect(s.clouds).toHaveLength(WXA_SCENA[icon]!.clouds);
      expect(s.drops).toHaveLength(WXA_SCENA[icon]!.drops);
    }
    expect(buildWxScene({ icon: 'temporale', tmax: 15, night: false }).lightning).toBe(true);
    expect(buildWxScene({ icon: 'nebbia', tmax: 15, night: false }).fog).toHaveLength(3);
    expect(buildWxScene({ icon: 'neve', tmax: 0, night: false }).drops[0]!.type).toBe('snow');
    expect(buildWxScene({ icon: 'pioggia', tmax: 9, night: false }).drops[0]!.type).toBe('rain');
  });
  test('a hot clear day has a bigger red sun, and at night the sun becomes the moon with stars', () => {
    const hot = buildWxScene({ icon: 'sole', tmax: 37, night: false });
    expect(hot.sun).toBe(true);
    expect(hot.hotSun).toBe(true);
    const night = buildWxScene({ icon: 'sole', tmax: 37, night: true });
    expect(night.sun).toBe(false);
    expect(night.moon).toBe(true);
    expect(night.hotSun).toBe(false);
    expect(night.stars).toHaveLength(12);
  });
  test('no stars under a closed sky, rain or fog, and the scene is always the same for the same day', () => {
    for (const icon of ['nubi', 'pioggia', 'nebbia']) {
      expect(buildWxScene({ icon, tmax: 10, night: true }).stars).toHaveLength(0);
    }
    const a = buildWxScene({ icon: 'pioggia', tmax: 9, night: false });
    const b = buildWxScene({ icon: 'pioggia', tmax: 9, night: false });
    expect(a).toEqual(b);
  });
  test('an unknown icon falls back to the cloudy sky', () => {
    expect(buildWxScene({ icon: 'boh', tmax: 10, night: false }).clouds).toHaveLength(7);
  });
});
