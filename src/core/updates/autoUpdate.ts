import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';

/** Ciò che serve di `expo-updates`: così si prova con un finto, senza telefono. */
export interface UpdatesApi {
  isEnabled: boolean;
  checkForUpdateAsync(): Promise<{ isAvailable: boolean }>;
  fetchUpdateAsync(): Promise<{ isNew: boolean }>;
  reloadAsync(): Promise<void>;
}

/**
 * Cerca un aggiornamento e, se c'è, lo scarica. Ritorna `true` solo se ha scaricato qualcosa di nuovo.
 * Ogni errore (niente rete, server lento) è un «no»: l'app non deve mai cadere per un aggiornamento.
 */
export async function downloadUpdate(api: UpdatesApi): Promise<boolean> {
  if (!api.isEnabled) return false;
  try {
    const check = await api.checkForUpdateAsync();
    if (!check.isAvailable) return false;
    const got = await api.fetchUpdateAsync();
    return got.isNew;
  } catch {
    return false;
  }
}

/** All'apertura: scarica e riparte subito nella versione nuova (si vede due volte la schermata di avvio, una volta). */
export async function updateAtLaunch(api: UpdatesApi): Promise<void> {
  if (!(await downloadUpdate(api))) return;
  try {
    await api.reloadAsync();
  } catch {
    /* resta la versione di ora: la nuova parte alla prossima apertura */
  }
}

/**
 * Gli aggiornamenti «via etere» (EAS Update): ogni modifica che finisce su `main` arriva sul telefono da sola.
 * Aperta l'app: si scarica e si riparte. Tornando all'app da un'altra: si scarica soltanto, e si applica alla
 * prossima apertura (non si riavvia mai mentre stai scrivendo). In sviluppo non fa nulla.
 */
export function useAutoUpdate(api: UpdatesApi = Updates): void {
  useEffect(() => {
    if (__DEV__) return;
    void updateAtLaunch(api);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void downloadUpdate(api);
    });
    return () => sub.remove();
  }, [api]);
}
