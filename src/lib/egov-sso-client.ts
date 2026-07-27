import { parseJsonBody, type ApiResult } from '@/lib/api-result';

export async function exchangeCodeForSession(
  exchangeCode: string
): Promise<ApiResult<{ sessionToken: string }>> {
  let response: Response;
  try {
    response = await fetch('/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exchange_code: exchangeCode }),
    });
  } catch {
    return { ok: false, kind: 'network_error' };
  }

  const body = await parseJsonBody(response);

  if (!response.ok) {
    return { ok: false, kind: 'upstream_error', status: response.status, body };
  }

  const sessionToken =
    body && typeof body === 'object' && 'session_token' in body
      ? (body as { session_token?: unknown }).session_token
      : undefined;

  if (typeof sessionToken !== 'string' || sessionToken.length === 0) {
    return {
      ok: false,
      kind: 'invalid_response',
      message: 'Token exchange response did not include a session_token',
    };
  }

  return { ok: true, data: { sessionToken } };
}

export async function fetchCitizenProfile(sessionToken: string): Promise<ApiResult<unknown>> {
  let response: Response;
  try {
    response = await fetch('/auth/profile', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
  } catch {
    return { ok: false, kind: 'network_error' };
  }

  const body = await parseJsonBody(response);

  if (!response.ok) {
    return { ok: false, kind: 'upstream_error', status: response.status, body };
  }

  const data = body && typeof body === 'object' && 'data' in body ? (body as { data?: unknown }).data : body;

  return { ok: true, data };
}
