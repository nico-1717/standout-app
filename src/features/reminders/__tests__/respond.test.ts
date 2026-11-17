import * as Notifications from 'expo-notifications';

import {
  drainTaken,
  listenForTaken,
  phoneNotifier,
  PILL_CATEGORY,
  slotOfResponse,
  takenSinceLaunch,
  TAKEN_ACTION,
} from '../notifier';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  addNotificationResponseReceivedListener: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponse: jest.fn(),
  setNotificationCategoryAsync: jest.fn(async () => null),
  scheduleNotificationAsync: jest.fn(async () => 'x'),
}));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const response = (action: string, data: Record<string, unknown>) => ({
  actionIdentifier: action,
  notification: { request: { content: { data } } },
});
const pill = { plan: 'p1', date: '2026-11-05', time: '08:00', seq: 0 };

describe('the "Taken" button on a pill notification', () => {
  test('only the Taken action of a pill notification gives a dose', () => {
    expect(slotOfResponse(response(TAKEN_ACTION, { kind: 'pill', pill }))).toEqual(pill);
    expect(
      slotOfResponse(response('expo.modules.notifications.actions.DEFAULT', { pill })),
    ).toBeNull();
    expect(slotOfResponse(response(TAKEN_ACTION, { kind: 'habits' }))).toBeNull();
    expect(slotOfResponse(response(TAKEN_ACTION, { pill: { plan: 1 } }))).toBeNull();
  });

  test('a tap is queued until the app drains it; the listener is registered once', () => {
    const onTaken = jest.fn();
    listenForTaken(onTaken);
    listenForTaken(onTaken);
    const add = Notifications.addNotificationResponseReceivedListener as jest.Mock;
    expect(add).toHaveBeenCalledTimes(1);
    const handler = add.mock.calls[0]![0] as (r: unknown) => void;
    handler(response(TAKEN_ACTION, { pill }));
    handler(response('other', { pill }));
    expect(onTaken).toHaveBeenCalledTimes(1);
    expect(drainTaken()).toEqual([pill]);
    expect(drainTaken()).toEqual([]);
  });

  test('a tap that launched the app is picked up once and cleared', async () => {
    (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValueOnce(
      response(TAKEN_ACTION, { pill }),
    );
    await takenSinceLaunch();
    expect(Notifications.clearLastNotificationResponse).toHaveBeenCalled();
    expect(drainTaken()).toEqual([pill]);
  });

  test('scheduling a pill carries the category and the dose; a habit has neither', async () => {
    const n = phoneNotifier('Reminders', 'Taken');
    const at = new Date(2030, 0, 1, 8, 0);
    await n.schedule({ id: 'a', kind: 'pill', at, title: 'Pills', body: 'Zinc', pill });
    await n.schedule({ id: 'b', kind: 'habits', at, title: 'Habits', body: 'Water' });
    const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.map(
      (c) => c[0].content,
    );
    expect(calls[0]).toMatchObject({ categoryIdentifier: PILL_CATEGORY, data: { pill } });
    expect(calls[1]).not.toHaveProperty('categoryIdentifier');
    expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledWith(PILL_CATEGORY, [
      expect.objectContaining({ identifier: TAKEN_ACTION, buttonTitle: 'Taken' }),
    ]);
  });
});
