import * as Notifications from 'expo-notifications';
import { AndroidImportance, SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';

import type { PillSlot } from './plan';
import type { Notifier } from './scheduler';

const CHANNEL = 'reminders';
/** Le notifiche delle pastiglie portano un pulsante «Presa» (non apre l'app). */
export const PILL_CATEGORY = 'pill';
export const TAKEN_ACTION = 'taken';

/**
 * Le pastiglie segnate «prese» dal pulsante della notifica, in attesa che l'app abbia i dati aperti: se la notifica
 * risveglia l'app in sottofondo, il database può non essere ancora pronto quando il tocco arriva.
 */
const pendingTaken: PillSlot[] = [];

/** Svuota la coda e rende le prese da segnare. */
export function drainTaken(): PillSlot[] {
  return pendingTaken.splice(0, pendingTaken.length);
}

/** La presa scritta nei dati di una notifica di pastiglia, se c'è ed è fatta bene. */
export function slotOfPill(raw: unknown): PillSlot | null {
  const pill = raw as Partial<PillSlot> | undefined;
  if (
    !pill ||
    typeof pill.plan !== 'string' ||
    typeof pill.date !== 'string' ||
    typeof pill.time !== 'string' ||
    typeof pill.seq !== 'number'
  )
    return null;
  return { plan: pill.plan, date: pill.date, time: pill.time, seq: pill.seq };
}

/** Dalla risposta a una notifica alla presa che segna, se è il pulsante «Presa» di una pastiglia. */
export function slotOfResponse(r: {
  actionIdentifier: string;
  notification: { request: { content: { data?: Record<string, unknown> } } };
}): PillSlot | null {
  if (r.actionIdentifier !== TAKEN_ACTION) return null;
  return slotOfPill(r.notification.request.content.data?.pill);
}

/** Un solo ascolto, per tutta la vita dell'app: registrato qui (all'avvio) e non in un componente. */
let listening = false;
export function listenForTaken(onTaken: () => void): void {
  if (listening) return;
  listening = true;
  Notifications.addNotificationResponseReceivedListener((resp) => {
    const slot = slotOfResponse(resp);
    if (!slot) return;
    pendingTaken.push(slot);
    onTaken();
  });
}

/** La risposta che ha lanciato l'app (se la si è aperta toccando «Presa» da chiusa). */
export async function takenSinceLaunch(): Promise<void> {
  const last = await Notifications.getLastNotificationResponseAsync();
  const slot = last ? slotOfResponse(last) : null;
  if (slot) pendingTaken.push(slot);
  if (last) Notifications.clearLastNotificationResponse();
}

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

/** Il pulsante «Presa» va registrato a ogni avvio: iOS non lo ricorda per le notifiche già programmate. */
export async function registerPillCategory(label: string): Promise<void> {
  await Notifications.setNotificationCategoryAsync(PILL_CATEGORY, [
    { identifier: TAKEN_ACTION, buttonTitle: label, options: { opensAppToForeground: false } },
  ]);
}

export function phoneNotifier(channelName: string, takenLabel = 'Taken'): Notifier {
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
    delivered: async () => {
      const shown = await Notifications.getPresentedNotificationsAsync();
      const out: { id: string; pill: PillSlot }[] = [];
      for (const n of shown) {
        const slot = slotOfPill(n.request.content.data?.pill);
        if (slot) out.push({ id: n.request.identifier, pill: slot });
      }
      return out;
    },
    dismiss: async (ids) => {
      await Promise.all(ids.map((id) => Notifications.dismissNotificationAsync(id)));
    },
    schedule: async (r) => {
      await ensureChannel(channelName);
      if (r.pill) await registerPillCategory(takenLabel);
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: {
          title: r.title,
          body: r.body,
          data: { kind: r.kind, ...(r.pill ? { pill: r.pill } : {}) },
          ...(r.pill ? { categoryIdentifier: PILL_CATEGORY } : {}),
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DATE,
          date: r.at,
          channelId: CHANNEL,
        },
      });
    },
  };
}
