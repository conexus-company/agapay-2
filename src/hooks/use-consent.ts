import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/contexts/auth-context';

export type ConsentField = 'full_name' | 'birth_date' | 'middle_name' | 'suffix';
export type TransactionType = 'appointment' | 'checkin' | 'navigation';

export type ConsentRecord = {
  consent_id: string;
  status: string;
  expires_at: string;
  consented_fields: ConsentField[];
  transaction_type: TransactionType;
  facility_id: string | null;
};

const REMEMBER_PREFERENCES_KEY = 'agapay.consent.preferences';

async function loadRememberPreferences(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(REMEMBER_PREFERENCES_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

async function saveRememberPreferences(value: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(REMEMBER_PREFERENCES_KEY, String(value));
  } catch {
    // web fallback or storage error — silently ignore
  }
}

export type ConsentState = {
  check: (type: TransactionType, facilityId?: string) => Promise<ConsentRecord | null>;
  create: (payload: {
    type: TransactionType;
    facilityId?: string;
    fields: ConsentField[];
  }) => Promise<ConsentRecord | null>;
  revoke: (consentId: string) => Promise<boolean>;
  rememberPreferences: boolean;
  setRememberPreferences: (value: boolean) => Promise<void>;
  loading: boolean;
  error: string | null;
};

export function useConsent(): ConsentState {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberPreferences, setRememberPreferencesState] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadRememberPreferences().then((v) => {
      if (!cancelled) setRememberPreferencesState(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setRememberPreferences = useCallback(async (value: boolean) => {
    setRememberPreferencesState(value);
    await saveRememberPreferences(value);
  }, []);

  const check = useCallback(
    async (type: TransactionType, facilityId?: string): Promise<ConsentRecord | null> => {
      const token = session?.sessionToken;
      if (!token) return null;

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ transaction_type: type });
        if (facilityId) params.set('facility_id', facilityId);

        const response = await fetch(`/api/identity/consent?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          setError(body?.error ?? 'Failed to check consent');
          return null;
        }

        const body = await response.json();
        return body.consent ?? null;
      } catch {
        setError('Network error — check your connection');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [session]
  );

  const create = useCallback(
    async (payload: {
      type: TransactionType;
      facilityId?: string;
      fields: ConsentField[];
    }): Promise<ConsentRecord | null> => {
      const token = session?.sessionToken;
      if (!token) return null;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/identity/consent', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transaction_type: payload.type,
            facility_id: payload.facilityId ?? null,
            consented_fields: payload.fields,
            retention_days: 90,
          }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          setError(body?.error ?? 'Failed to create consent');
          return null;
        }

        const body = await response.json();
        return {
          consent_id: body.consent_id,
          status: body.status,
          expires_at: body.expires_at,
          consented_fields: body.consented_fields,
          transaction_type: payload.type,
          facility_id: payload.facilityId ?? null,
        };
      } catch {
        setError('Network error — check your connection');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [session]
  );

  const revoke = useCallback(
    async (consentId: string): Promise<boolean> => {
      const token = session?.sessionToken;
      if (!token) return false;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/identity/revoke', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ scope: 'consent', consent_id: consentId }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          setError(body?.error ?? 'Failed to revoke consent');
          return false;
        }

        return true;
      } catch {
        setError('Network error — check your connection');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [session]
  );

  return {
    check,
    create,
    revoke,
    rememberPreferences,
    setRememberPreferences,
    loading,
    error,
  };
}
