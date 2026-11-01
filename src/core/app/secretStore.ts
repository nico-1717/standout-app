import * as SecureStore from 'expo-secure-store';

import type { SecretStore } from '../auth/authService';

/** I token stanno nel Keychain (iOS) / Keystore (Android), mai in file normali. */
export const secureStoreAdapter: SecretStore = {
  get: (k) => SecureStore.getItemAsync(k),
  set: (k, v) =>
    SecureStore.setItemAsync(k, v, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    }),
  remove: (k) => SecureStore.deleteItemAsync(k),
};
