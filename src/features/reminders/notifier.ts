import * as Notifications from 'expo-notifications';
import { AndroidImportance, SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';

import type { Notifier } from './scheduler';

const CHANNEL = 'reminders';

// Se l'app è aperta la notifica si mostra lo stesso (è un promemoria: chi lo ha acceso lo vuole vedere).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensureChannel(name: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name,
    importance: AndroidImportance.DEFAULT,
  });
}

/** Chiede il permesso, se serve. true = concesso. */
export async function askPermission(): Promise<boolean> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export function phoneNotifier(channelName: string): Notifier {
  return {
    allowed: async () => (await Notifications.getPermissionsAsync()).granted,
    // i promemoria si rifanno da zero, ma l'avviso di fine Pomodoro (id «pomodoro-…») non è un promemoria: resta
    cancelAll: async () => {
      const all = await Notifications.getAllScheduledNotificationsAsync();
      await Promise.all(
        all
          .filter((n) => !n.identifier.startsWith('pomodoro-'))
          .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
      );
    },
    schedule: async (r) => {
      await ensureChannel(channelName);
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: { title: r.title, body: r.body, data: { kind: r.kind } },
        trigger: {
          type: SchedulableTriggerInputTypes.DATE,
          date: r.at,
          channelId: CHANNEL,
        },
      });
    },
  };
}
