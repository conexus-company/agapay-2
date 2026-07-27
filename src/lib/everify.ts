import { parseJsonBody, resilientFetch, type ApiResult } from '@/lib/api-result';

const USER_AGENT = 'agapay-backend/1.0';

type EverifyConfig = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
};

export type EverifyQueryPayload = {
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  birth_date: string;
  face_liveness_session_id: string;
};

export function getEverifyConfig(): EverifyConfig | null {
  const baseUrl = process.env.EGOV_VERIFY_BASE_URL;
  const clientId = process.env.EGOV_VERIFY_CLIENT_ID;
  const clientSecret = process.env.EGOV_VERIFY_CLIENT_SECRET;

  if (!baseUrl || !clientId || !clientSecret) {
    return null;
  }

  return { baseUrl, clientId, clientSecret };
}

export async function authenticate(config: EverifyConfig): Promise<ApiResult<string>> {
  console.log('[everify] authenticating');

  let response: Response;
  try {
    response = await resilientFetch(
      `${config.baseUrl}/api/auth`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
        body: JSON.stringify({
          client_id: config.clientId,
          client_secret: config.clientSecret,
        }),
      },
      'everify:auth'
    );
  } catch (error) {
    console.error('[everify] auth network failure:', error);
    return { ok: false, kind: 'network_error' };
  }

  const body = await parseJsonBody(response);
  console.log('[everify] auth response:', response.status);

  if (!response.ok) {
    return { ok: false, kind: 'upstream_error', status: response.status, body };
  }

  const data = body && typeof body === 'object' && 'data' in body ? (body as { data?: unknown }).data : undefined;

  const accessToken =
    data && typeof data === 'object' && 'access_token' in data
      ? (data as { access_token?: unknown }).access_token
      : undefined;

  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    return {
      ok: false,
      kind: 'invalid_response',
      message: 'eVerify auth response did not include an access_token',
    };
  }

  return { ok: true, data: accessToken };
}

export async function verifyIdentity(
  config: Pick<EverifyConfig, 'baseUrl'>,
  accessToken: string,
  payload: EverifyQueryPayload
): Promise<ApiResult<unknown>> {
  console.log('[everify] querying identity, face_liveness_session_id:', payload.face_liveness_session_id);

  let response: Response;
  try {
    response = await resilientFetch(
      `${config.baseUrl}/api/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
        },
        body: JSON.stringify(payload),
      },
      'everify:query'
    );
  } catch (error) {
    console.error('[everify] query network failure:', error);
    return { ok: false, kind: 'network_error' };
  }

  const body = await parseJsonBody(response);
  console.log('[everify] query response:', response.status, body);

  if (!response.ok) {
    return { ok: false, kind: 'upstream_error', status: response.status, body };
  }

  return { ok: true, data: body };
}
