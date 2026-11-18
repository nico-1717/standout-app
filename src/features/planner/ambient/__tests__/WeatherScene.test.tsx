import { render, screen } from '@testing-library/react-native';

import { WeatherScene } from '../WeatherScene';

const get = (id: string) => screen.queryByTestId(id, { includeHiddenElements: true });

describe('<WeatherScene>', () => {
  test('a stormy night: veils, clouds, rain and lightning, no sun', async () => {
    await render(<WeatherScene input={{ icon: 'temporale', tmax: 12, night: true }} />);
    expect(get('wx-scene')).toBeTruthy();
    expect(get('wx-scene-overcast')).toBeTruthy();
    expect(get('wx-scene-night')).toBeTruthy();
    expect(get('wx-scene-cloud-6')).toBeTruthy();
    expect(get('wx-scene-drops')).toBeTruthy();
    expect(get('wx-scene-flash')).toBeTruthy();
    expect(get('wx-scene-sun')).toBeNull();
    expect(get('wx-scene-moon')).toBeNull();
  });
  test('a hot clear day: sun and heat, nothing else', async () => {
    await render(<WeatherScene input={{ icon: 'sole', tmax: 38, night: false }} />);
    expect(get('wx-scene-sun')).toBeTruthy();
    expect(get('wx-scene-heat')).toBeTruthy();
    expect(get('wx-scene-cloud-0')).toBeNull();
    expect(get('wx-scene-drops')).toBeNull();
    expect(get('wx-scene-night')).toBeNull();
  });
  test('a clear night: moon and stars', async () => {
    await render(<WeatherScene input={{ icon: 'sole', tmax: 10, night: true }} />);
    expect(get('wx-scene-moon')).toBeTruthy();
    expect(get('wx-scene-stars')).toBeTruthy();
    expect(get('wx-scene-sun')).toBeNull();
  });
  test('fog gives three drifting bands, and the scene ignores touches and screen readers', async () => {
    await render(<WeatherScene input={{ icon: 'nebbia', tmax: 8, night: false }} />);
    expect(get('wx-scene-fog-2')).toBeTruthy();
    const scene = get('wx-scene')!;
    expect(scene.props.pointerEvents).toBe('none');
    expect(scene.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
