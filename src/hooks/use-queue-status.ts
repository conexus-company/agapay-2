import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export type QueueStatus = 'waiting' | 'called' | 'completed' | 'no_show';

interface UseQueueStatusOptions {
  ticketId: string | null;
  onStatusChange?: (status: QueueStatus) => void;
}

interface UseQueueStatusResult {
  status: QueueStatus | null;
  ticketId: string | null;
  queueNumber: string | null;
  loading: boolean;
  error: string | null;
}

export function useQueueStatus({ ticketId, onStatusChange }: UseQueueStatusOptions): UseQueueStatusResult {
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [queueNumber, setQueueNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousStatus = useRef<QueueStatus | null>(null);
  const appState = useRef(AppState.currentState);
  const fetchIdRef = useRef(0);

  const poll = useCallback(async (id: string) => {
    const currentFetchId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/checkin/status/${id}`);
      if (currentFetchId !== fetchIdRef.current) return;

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Failed to fetch queue status');
        setLoading(false);
        return;
      }

      const data = await res.json();
      const current = data.status as QueueStatus;
      setStatus(current);
      setQueueNumber(data.queue_number);

      if (previousStatus.current !== current) {
        if (
          previousStatus.current === 'waiting' &&
          (current === 'called' || current === 'completed')
        ) {
          onStatusChange?.(current);
        }
        previousStatus.current = current;
      }
    } catch {
      if (currentFetchId !== fetchIdRef.current) return;
      setError('Network error');
    }

    setLoading(false);
  }, [onStatusChange]);

  useEffect(() => {
    if (!ticketId) return;

    previousStatus.current = null;

    const TERMINAL: QueueStatus[] = ['completed', 'no_show'];
    let interval: ReturnType<typeof setInterval>;

    function startPolling() {
      poll(ticketId!);
      interval = setInterval(() => {
        if (!TERMINAL.includes(previousStatus.current as QueueStatus)) {
          poll(ticketId!);
        }
      }, 20_000);
    }

    function handleAppStateChange(next: AppStateStatus) {
      if (appState.current.match(/active/) && next !== 'active') {
        clearInterval(interval);
      } else if (!appState.current.match(/active/) && next === 'active') {
        startPolling();
      }
      appState.current = next;
    }

    const sub = AppState.addEventListener('change', handleAppStateChange);
    startPolling();

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [ticketId, poll]);

  return { status, ticketId, queueNumber, loading, error };
}
