import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';

/** Gli id cominciano con «smartask-» così il rifacimento dei promemoria non li cancella. */
const idOf = (id: string, step: string) => `smartask-${id}-${step}`;
const STEPS = ['soon', 'hour', 'day'] as const;
/** Quando la domanda resta senza risposta: dopo 2 minuti, dopo 1 ora, poi ogni giorno. */
export const SOON_MS = 2 * 60_000;
export const HOUR_MS = 60 * 60_000;
export const DAY_S = 24 * 60 * 60;

export const SMART_ASK_KIND = 'smart-pending';

/** Programma i tre avvisi per una frase in attesa (chi non risponde non la perde). Mai un errore verso chi chiama. */
export async function scheduleAsk(
  id: string,
  text: { channel: string; title: string; body: string },
): Promise<void> {
  const now = Date.now();
  try {
    // caricato qui (e non in cima): il file dei promemoria registra il suo ascolto appena lo si importa
    const { CHANNEL, askPermission, ensureChannel } = await import('@/features/reminders/notifier');
    if (!(await askPermission())) return;
    await ensureChannel(text.channel);
    const content = { title: text.title, body: text.body, data: { kind: SMART_ASK_KIND, id } };
    await Notifications.scheduleNotificationAsync({
      identifier: idOf(id, 'soon'),
      content,
      trigger: {
        type: SchedulableTriggerInputTypes.DATE,
        date: new Date(now + SOON_MS),
        channelId: CHANNEL,
      },
    });
    await Notifications.scheduleNotificationAsync({
      identifier: idOf(id, 'hour'),
      content,
      trigger: {
        type: SchedulableTriggerInputTypes.DATE,
        date: new Date(now + HOUR_MS),
        channelId: CHANNEL,
      },
    });
    await Notifications.scheduleNotificationAsync({
      identifier: idOf(id, 'day'),
      content,
      trigger: {
        type: SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: DAY_S,
        repeats: true,
        channelId: CHANNEL,
      },
    });
  } catch {
    // le notifiche sono un aiuto: senza, la domanda torna comunque all'apertura dell'app
  }
}

/** La risposta è arrivata: gli avvisi non servono più (anche quelli già mostrati). */
export async function cancelAsk(id: string): Promise<void> {
  try {
    await Promise.all(
      STEPS.flatMap((s) => [
        Notifications.cancelScheduledNotificationAsync(idOf(id, s)),
        Notifications.dismissNotificationAsync(idOf(id, s)),
      ]),
    );
  } catch {
    // niente da cancellare
  }
}

const isAskTap = (r: Notifications.NotificationResponse | null) =>
  r?.notification.request.content.data?.kind === SMART_ASK_KIND;

/** Toccare l'avviso «il tuo evento aspetta» porta al planner, dove la domanda si riapre (anche da app chiusa). */
export function listenForAskTap(onTap: () => void): () => void {
  try {
    void Notifications.getLastNotificationResponseAsync().then((last) => {
      if (isAskTap(last)) {
        Notifications.clearLastNotificationResponse();
        onTap();
      }
    });
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      if (isAskTap(r)) onTap();
    });
    return () => sub.remove();
  } catch {
    return () => undefined;
  }
}
