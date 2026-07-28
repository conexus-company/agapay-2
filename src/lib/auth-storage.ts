import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const IDENTITY_KEY = 'agapay.auth.identity';

export type StoredIdentity = {
  profile: unknown;
  everify: unknown;
};

// expo-secure-store has no web implementation (it's a native Keychain/Keystore
// wrapper), so web falls back to localStorage — the browser has no equivalent
// secure enclave, this just keeps the session across reloads.
export async function loadIdentity(): Promise<StoredIdentity | null> {
  const raw =
    Platform.OS === 'web'
      ? typeof localStorage === 'undefined'
        ? null
        : localStorage.getItem(IDENTITY_KEY)
      : await SecureStore.getItemAsync(IDENTITY_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredIdentity;
  } catch {
    return null;
  }
}

export async function saveIdentity(identity: StoredIdentity): Promise<void> {
  const raw = JSON.stringify(identity);
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(IDENTITY_KEY, raw);
    return;
  }
  await SecureStore.setItemAsync(IDENTITY_KEY, raw);
}

export async function clearIdentity(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(IDENTITY_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(IDENTITY_KEY);
}
