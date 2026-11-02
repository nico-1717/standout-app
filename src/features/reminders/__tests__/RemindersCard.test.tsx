import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import i18n from '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';

import { RemindersCard } from '../RemindersCard';

let mockReminders = { pills: false, habits: false, habitTime: '20:00' };
const mockUpdate = jest.fn(async (_p: object) => true);
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({ reminders: mockReminders, updateReminders: mockUpdate }),
}));

const ui = () =>
  render(
    <ThemeProvider accent="blue">
      <RemindersCard />
    </ThemeProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockReminders = { pills: false, habits: false, habitTime: '20:00' };
  mockUpdate.mockResolvedValue(true);
});

describe('RemindersCard', () => {
  test('the switches ask the app to turn the reminders on', async () => {
    await ui();
    await fireEvent(screen.getByTestId('rem-pills'), 'valueChange', true);
    expect(mockUpdate).toHaveBeenCalledWith({ pills: true });
    expect(screen.queryByTestId('rem-time')).toBeNull(); // the time shows only with habit reminders on
  });

  test('when the phone refuses the permission, the card says how to fix it', async () => {
    mockUpdate.mockResolvedValue(false);
    await ui();
    await fireEvent(screen.getByTestId('rem-habits'), 'valueChange', true);
    expect((await screen.findByTestId('rem-denied')).props.children).toBe(
      i18n.t('app.promemoria_negato'),
    );
  });

  test('a valid time is saved, a wrong one shows an error and is not saved', async () => {
    mockReminders = { pills: false, habits: true, habitTime: '20:00' };
    await ui();
    await fireEvent.changeText(screen.getByTestId('rem-time'), '7pm');
    await fireEvent(screen.getByTestId('rem-time'), 'endEditing');
    expect(await screen.findByTestId('rem-time-error')).toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('rem-time'), '07:30');
    await fireEvent(screen.getByTestId('rem-time'), 'endEditing');
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ habitTime: '07:30' }));
    expect(screen.queryByTestId('rem-time-error')).toBeNull();
  });
});
