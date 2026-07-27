import { parseJsonBody, type ApiResult } from '@/lib/api-result';

export type VerificationStart = {
  flowId: string;
  profile: unknown;
  liveness: { url: string };
};

export async function startVerification(
  exchangeCode: string,
  callbackUrl: string
): Promise<ApiResult<VerificationStart>> {
  let response: Response;
  try {
    response = await fetch('/auth/verify/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exchange_code: exchangeCode, callback_url: callbackUrl }),
    });
  } catch {
    return { ok: false, kind: 'network_error' };
  }

  const body = await parseJsonBody(response);

  if (!response.ok) {
    return { ok: false, kind: 'upstream_error', status: response.status, body };
  }

  const flowId =
    body && typeof body === 'object' && 'flow_id' in body ? (body as { flow_id?: unknown }).flow_id : undefined;
  const liveness =
    body && typeof body === 'object' && 'liveness' in body
      ? (body as { liveness?: { url?: unknown } }).liveness
      : undefined;

  if (typeof flowId !== 'string' || flowId.length === 0 || !liveness || typeof liveness.url !== 'string') {
    return {
      ok: false,
      kind: 'invalid_response',
      message: 'Verification start response was missing flow_id or liveness details',
    };
  }

  return {
    ok: true,
    data: {
      flowId,
      profile: (body as { profile?: unknown }).profile,
      liveness: { url: liveness.url },
    },
  };
}

export type VerificationStatus = { status: 'completed'; everify: unknown };

export async function getVerificationStatus(
  flowId: string,
  sessionId: string
): Promise<ApiResult<VerificationStatus>> {
  let response: Response;
  try {
    response = await fetch(
      `/auth/verify/status/${encodeURIComponent(flowId)}?session_id=${encodeURIComponent(sessionId)}`
    );
  } catch {
    return { ok: false, kind: 'network_error' };
  }

  const body = await parseJsonBody(response);

  if (!response.ok) {
    return { ok: false, kind: 'upstream_error', status: response.status, body };
  }

  const status = body && typeof body === 'object' ? (body as { status?: unknown }).status : undefined;

  if (status === 'completed') {
    return { ok: true, data: { status: 'completed', everify: (body as { everify?: unknown }).everify } };
  }

  return {
    ok: false,
    kind: 'invalid_response',
    message: 'Verification status response had an unrecognized status value',
  };
}
