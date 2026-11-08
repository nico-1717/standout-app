import * as SecureStore from 'expo-secure-store';

const KEY = 'standout.app_lock';

/** Il blocco è una scelta di questo telefono: sta nel Keychain/Keystore e non viaggia con la sincronizzazione. */
export async function readLockEnabled(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function writeLockEnabled(on: boolean): Promise<void> {
  if (on) {
    await SecureStore.setItemAsync(KEY, '1', {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } else {
    await SecureStore.deleteItemAsync(KEY);
  }
}
