import { parseJsonBody, type ApiResult } from '@/lib/api-result';
import { resolveSsoSubjectId } from '@/lib/health-profile';

export type NotificationCategory = 'queue' | 'appointment' | 'health_advisory' | 'system';

export type CitizenNotification = {
  id: string;
  citizen_hash: string | null;
  category: NotificationCategory;
  title: string;
  body: string;
  action_route: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

export type NotificationsResult = {
  notifications: CitizenNotification[];
  unread_count: number;
};

/**
 * The notification API routes identify the citizen by a stub hash derived
 * from the Bearer token (same convention as the check-in module), so we send
 * a stable per-citizen token derived from the SSO subject id.
 */
export function getNotificationsAuthToken(profile: unknown): string {
  return resolveSsoSubjectId(profile);
}

export async function fetchMyNotifications(profile: unknown): Promise<ApiResult<NotificationsResult>> {
  const token = getNotificationsAuthToken(profile);

  let response: Response;
  try {
    response = await fetch('/api/notifications', {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return { ok: false, kind: 'network_error' };
  }

  const body = await parseJsonBody(response);

  if (!response.ok) {
    return { ok: false, kind: 'upstream_error', status: response.status, body };
  }

  if (
    !body ||
    typeof body !== 'object' ||
    !('notifications' in body) ||
    !Array.isArray((body as { notifications: unknown }).notifications)
  ) {
    return { ok: false, kind: 'invalid_response', message: 'Notifications API returned an unexpected response' };
  }

  return { ok: true, data: body as unknown as NotificationsResult };
}

export async function markNotificationRead(profile: unknown, id: string): Promise<ApiResult<unknown>> {
  const token = getNotificationsAuthToken(profile);

  let response: Response;
  try {
    response = await fetch(`/api/notifications/${id}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return { ok: false, kind: 'network_error' };
  }

  const body = await parseJsonBody(response);

  if (!response.ok) {
    return { ok: false, kind: 'upstream_error', status: response.status, body };
  }

  return { ok: true, data: body };
}
