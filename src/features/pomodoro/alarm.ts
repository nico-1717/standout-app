import * as Notifications from 'expo-notifications';
import { AndroidImportance, SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * L'avviso «tempo finito» del Pomodoro e della pausa. È una notifica locale programmata all'ora esatta di fine:
 * suona anche con l'app chiusa o il telefono bloccato. Gli id cominciano con «pomodoro-» così il rifacimento dei
 * promemoria (notifier.ts) non li tocca.
 */
export const ALARM_ID = 'pomodoro-end';
const CHANNEL = 'pomodoro';

export interface AlarmText {
  channel: string;
  title: string;
  body: string;
}

export async function scheduleAlarm(at: Date, text: AlarmText): Promise<void> {
  try {
    if (at.getTime() <= Date.now()) return;
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: text.channel,
        importance: AndroidImportance.HIGH,
      });
    }
    await Notifications.scheduleNotificationAsync({
      identifier: ALARM_ID,
      content: { title: text.title, body: text.body, sound: true },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
    });
  } catch {
    // l'avviso è un di più: se non parte, il timer funziona lo stesso
  }
}

export async function cancelAlarm(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(ALARM_ID);
  } catch {
    // niente da annullare
  }
}
