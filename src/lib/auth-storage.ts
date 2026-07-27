import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SESSION_TOKEN_KEY = 'agapay.auth.sessionToken';

// expo-secure-store has no web implementation (it's a native Keychain/Keystore
// wrapper), so web falls back to localStorage — the browser has no equivalent
// secure enclave, this just keeps the session across reloads.
export async function loadSessionToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(SESSION_TOKEN_KEY);
  }
  return SecureStore.getItemAsync(SESSION_TOKEN_KEY);
}

export async function saveSessionToken(sessionToken: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
    return;
  }
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, sessionToken);
}

export async function clearSessionToken(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(SESSION_TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
}
