import * as LocalAuthentication from 'expo-local-authentication';

export type UnlockResult = 'ok' | 'failed' | 'unavailable';

/** Il telefono sa chiedere Face ID, impronta o codice? */
export async function canAuthenticate(): Promise<boolean> {
  try {
    return (
      (await LocalAuthentication.hasHardwareAsync()) &&
      (await LocalAuthentication.isEnrolledAsync())
    );
  } catch {
    return false;
  }
}

/**
 * Chiede Face ID / impronta; se non riesce si può usare il codice del telefono (così non resti fuori dall'app). Niente viene
 * salvato: conta solo l'esito.
 */
export async function authenticate(reason: string): Promise<UnlockResult> {
  if (!(await canAuthenticate())) return 'unavailable';
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      disableDeviceFallback: false,
    });
    return r.success ? 'ok' : 'failed';
  } catch {
    return 'failed';
  }
}
