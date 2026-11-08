import { render, screen } from '@testing-library/react-native';

import { Bars } from '../charts';
import { habitsTheme } from '../habitsTheme';
import { HBars, LineChart, Radar } from '../overview';

const th = habitsTheme('light');

describe('habit charts are readable by a screen reader', () => {
  test('bars: one element with "label: percent" for every bar', async () => {
    await render(
      <Bars
        th={th}
        testID="b"
        bars={[
          { value: 1, label: 'M', color: '#000', highlight: false },
          { value: 0.5, label: 'T', color: '#000', highlight: true },
        ]}
      />,
    );
    const el = screen.getByTestId('b');
    expect(el.props.accessible).toBe(true);
    expect(el.props.accessibilityLabel).toBe('M: 100%, T: 50%');
  });

  test('horizontal bars: each row says name and value; radar and line say their numbers', async () => {
    await render(
      <>
        <HBars
          th={th}
          empty="-"
          rows={[{ name: 'Health', color: '#000', fill: 0.4, value: '40%' }]}
        />
        <Radar
          th={th}
          empty="-"
          data={[
            { name: 'A', v: 1 },
            { name: 'B', v: 0.5 },
            { name: 'C', v: 0.25 },
          ]}
        />
        <LineChart th={th} color="#000" points={[0.2, 0.9]} />
      </>,
    );
    expect(screen.getByLabelText('Health: 40%')).toBeTruthy();
    expect(screen.getByLabelText('A: 100%, B: 50%, C: 25%')).toBeTruthy();
    expect(screen.getByLabelText('20% → 90%')).toBeTruthy();
  });
});
