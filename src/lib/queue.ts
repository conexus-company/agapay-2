import { parseJsonBody, type ApiResult } from '@/lib/api-result';
import { resolveSsoSubjectId } from '@/lib/health-profile';

export type QueueStatus = 'waiting' | 'called' | 'completed' | 'no_show';

export type QueueTicket = {
  id: string;
  queue_number: string;
  facility_id: string;
  service_type: string;
  status: QueueStatus;
  checked_in_at: string | null;
  called_at: string | null;
  completed_at: string | null;
};

/**
 * The check-in API routes identify the citizen by a stub hash derived from
 * the Bearer token (`stub-hash-${token.slice(0, 8)}`), so we send a stable
 * per-citizen token derived from the SSO subject id — this keeps the hash
 * consistent across check-in, status, and "my tickets" calls.
 */
export function getQueueAuthToken(profile: unknown): string {
  return resolveSsoSubjectId(profile);
}

export async function fetchMyQueueTickets(profile: unknown): Promise<ApiResult<QueueTicket[]>> {
  const token = getQueueAuthToken(profile);
  if (!token) {
    return { ok: false, kind: 'invalid_response', message: 'No citizen identity available' };
  }

  let response: Response;
  try {
    response = await fetch('/api/checkin/mine', {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return { ok: false, kind: 'network_error' };
  }

  const body = await parseJsonBody(response);

  if (!response.ok) {
    return { ok: false, kind: 'upstream_error', status: response.status, body };
  }

  if (!body || typeof body !== 'object' || !('tickets' in body) || !Array.isArray((body as { tickets: unknown }).tickets)) {
    return { ok: false, kind: 'invalid_response', message: 'Queue API returned an unexpected response' };
  }

  return { ok: true, data: (body as { tickets: QueueTicket[] }).tickets };
}
