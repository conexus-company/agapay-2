import { parseJsonBody, type ApiResult } from '@/lib/api-result';

const USER_AGENT = 'agapay-backend/1.0';
const MIN_CONFIDENCE_SCORE = 95;

type FaceLivenessConfig = {
  baseUrl: string;
  apiKey: string;
  callbackUrl: string;
};

export function getFaceLivenessConfig(): FaceLivenessConfig | null {
  const baseUrl = process.env.EGOV_LIVENESS_BASE_URL;
  const apiKey = process.env.EGOV_LIVENESS_API_KEY;
  const callbackUrl = process.env.EGOV_LIVENESS_CALLBACK_URL;

  if (!baseUrl || !apiKey || !callbackUrl) {
    return null;
  }

  return { baseUrl, apiKey, callbackUrl };
}

export async function createLivenessSession(
  config: FaceLivenessConfig
): Promise<ApiResult<unknown>> {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/v1/liveness/session`, {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({
        action: 'redirect',
        callback_url: config.callbackUrl,
        delay: 3000,
      }),
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

export function isLivenessVerified(body: unknown): boolean {
  const status = body && typeof body === 'object' ? (body as { status?: unknown }).status : undefined;
  const confidenceScore =
    body && typeof body === 'object' ? (body as { confidence_score?: unknown }).confidence_score : undefined;

  return status === 'SUCCEEDED' && typeof confidenceScore === 'number' && confidenceScore >= MIN_CONFIDENCE_SCORE;
}

export async function getLivenessResult(
  config: Pick<FaceLivenessConfig, 'baseUrl' | 'apiKey'>,
  sessionToken: string
): Promise<ApiResult<unknown>> {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/v1/liveness/result/${encodeURIComponent(sessionToken)}`, {
      method: 'GET',
      headers: { 'x-api-key': config.apiKey, 'User-Agent': USER_AGENT },
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
