import { useCallback, useState } from 'react';

export type Facility = {
  id: string;
  name: string;
  type: string;
  address: string;
  lat: number;
  lng: number;
  distance_km: number;
};

type NearbyState = {
  data: Facility[];
  loading: boolean;
  error: string | null;
  center: { lat: number; lng: number };
  refresh: (coords?: { lat: number; lng: number }) => Promise<void>;
};

const DEFAULT_CENTER = { lat: 14.5995, lng: 120.9842 };

export function useFacilities(): NearbyState {
  const [data, setData] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [center, setCenter] = useState(DEFAULT_CENTER);

  const refresh = useCallback(async (coords?: { lat: number; lng: number }) => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (coords) {
      params.set('lat', String(coords.lat));
      params.set('lng', String(coords.lng));
    }

    try {
      const query = params.toString();
      const response = await fetch(`/api/facilities/nearby${query ? `?${query}` : ''}`);

      if (!response.ok) {
        setError('Failed to load facilities');
        setLoading(false);
        return;
      }

      const body = await response.json();
      setCenter(body.center ?? DEFAULT_CENTER);
      setData(body.facilities ?? []);
    } catch {
      setError('Network error — check your connection');
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, center, refresh };
}
