import * as Location from 'expo-location';

import type { ApiResult } from '@/lib/api-result';

export type Coordinates = { lat: number; lng: number };

export async function getCurrentLocation(): Promise<ApiResult<Coordinates>> {
  let permission: Location.LocationPermissionResponse;
  try {
    permission = await Location.requestForegroundPermissionsAsync();
  } catch {
    return { ok: false, kind: 'network_error' };
  }

  if (permission.status !== 'granted') {
    return {
      ok: false,
      kind: 'invalid_response',
      message: 'Location permission was not granted. Enable it in Settings to see nearby facilities.',
    };
  }

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { ok: true, data: { lat: position.coords.latitude, lng: position.coords.longitude } };
  } catch {
    return {
      ok: false,
      kind: 'invalid_response',
      message: 'Could not determine your current location. Check that location services are on.',
    };
  }
}
