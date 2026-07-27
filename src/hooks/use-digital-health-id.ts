import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/contexts/auth-context';

export type DigitalHealthIdState = {
  id: string | null;
  fullName: string | null;
  birthDate: string | null;
  isRevoked: boolean;
  qrPayload: string | null;
  qrSecret: string | null;
  isNew: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: () => Promise<void>;
};

export function useDigitalHealthId(): DigitalHealthIdState {
  const { session } = useAuth();
  const [id, setId] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [isRevoked, setIsRevoked] = useState(false);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [qrSecret, setQrSecret] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchHealthId = useCallback(async () => {
    const token = session?.sessionToken;
    if (!token) return;

    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await fetch('/api/identity/health-id', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!mountedRef.current) return;

      if (response.status === 404) {
        setId(null);
        setFullName(null);
        setBirthDate(null);
        setIsRevoked(false);
        setQrPayload(null);
        setQrSecret(null);
        setIsNew(false);
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? 'Failed to load Digital Health ID');
        return;
      }

      const body = await response.json();
      setId(body.digital_health_id);
      setFullName(body.full_name);
      setBirthDate(body.birth_date);
      setIsRevoked(false);
      setQrPayload(body.qr?.payload ?? null);
      setQrSecret(body.qr?.secret ?? null);
      setIsNew(body.is_new ?? false);
    } catch {
      if (mountedRef.current) {
        setError('Network error — check your connection');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [session]);

  const createHealthId = useCallback(async () => {
    const token = session?.sessionToken;
    if (!token) return;

    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await fetch('/api/identity/health-id', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!mountedRef.current) return;

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? 'Failed to create Digital Health ID');
        return;
      }

      const body = await response.json();
      setId(body.digital_health_id);
      setFullName(body.full_name);
      setBirthDate(body.birth_date);
      setIsRevoked(false);
      setQrPayload(body.qr?.payload ?? null);
      setQrSecret(body.qr?.secret ?? null);
      setIsNew(body.is_new ?? false);
    } catch {
      if (mountedRef.current) {
        setError('Network error — check your connection');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [session]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate data-fetch-on-mount pattern
    fetchHealthId();
  }, [fetchHealthId]);

  return {
    id,
    fullName,
    birthDate,
    isRevoked,
    qrPayload,
    qrSecret,
    isNew,
    loading,
    error,
    refresh: fetchHealthId,
    create: createHealthId,
  };
}
