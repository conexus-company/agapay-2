import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { HealthProfile } from '@/lib/health-profile';

const HEALTH_PROFILE_KEY = 'agapay.healthProfile';

// Mirrors auth-storage.ts: expo-secure-store has no web implementation, so
// web falls back to localStorage.
export async function loadHealthProfile(): Promise<HealthProfile | null> {
  const raw =
    Platform.OS === 'web'
      ? typeof localStorage === 'undefined'
        ? null
        : localStorage.getItem(HEALTH_PROFILE_KEY)
      : await SecureStore.getItemAsync(HEALTH_PROFILE_KEY);

  if (!raw) return null;
  try {
    return JSON.parse(raw) as HealthProfile;
  } catch {
    return null;
  }
}

export async function saveHealthProfile(profile: HealthProfile): Promise<void> {
  const raw = JSON.stringify(profile);
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(HEALTH_PROFILE_KEY, raw);
    return;
  }
  await SecureStore.setItemAsync(HEALTH_PROFILE_KEY, raw);
}

export async function clearHealthProfile(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(HEALTH_PROFILE_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(HEALTH_PROFILE_KEY);
}
