import { parseJsonBody, resilientFetch, type ApiResult } from '@/lib/api-result';

const SSO_SCOPE = 'SSO_AUTHENTICATION';

type EgovSsoConfig = {
  baseUrl: string;
  partnerCode: string;
  partnerSecret: string;
};

export function getEgovSsoConfig(): EgovSsoConfig | null {
  const baseUrl = process.env.EGOV_SSO_BASE_URL;
  const partnerCode = process.env.EGOV_SSO_PARTNER_CODE;
  const partnerSecret = process.env.EGOV_SSO_PARTNER_SECRET;

  if (!baseUrl || !partnerCode || !partnerSecret) {
    return null;
  }

  return { baseUrl, partnerCode, partnerSecret };
}

export async function exchangeCodeForToken(
  config: EgovSsoConfig,
  exchangeCode: string
): Promise<ApiResult<string>> {
  console.log('[egov-sso] exchanging code for token');

  let response: Response;
  try {
    response = await resilientFetch(
      `${config.baseUrl}/api/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'agapay-backend/1.0' },
        body: JSON.stringify({
          exchange_code: exchangeCode,
          scope: SSO_SCOPE,
          partner_code: config.partnerCode,
          partner_secret: config.partnerSecret,
        }),
      },
      'egov-sso:token'
    );
  } catch (error) {
    console.error('[egov-sso] token exchange network failure:', error);
    return { ok: false, kind: 'network_error' };
  }

  const body = await parseJsonBody(response);
  console.log('[egov-sso] token exchange response:', response.status);

  if (!response.ok) {
    return { ok: false, kind: 'upstream_error', status: response.status, body };
  }

  const accessToken =
    body && typeof body === 'object' && 'access_token' in body
      ? (body as { access_token?: unknown }).access_token
      : undefined;

  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    return {
      ok: false,
      kind: 'invalid_response',
      message: 'eGov SSO token response did not include an access_token',
    };
  }

  return { ok: true, data: accessToken };
}

export async function callSsoAuthentication(
  config: Pick<EgovSsoConfig, 'baseUrl'>,
  accessToken: string
): Promise<ApiResult<unknown>> {
  console.log('[egov-sso] fetching sso_authentication profile');

  let response: Response;
  try {
    response = await resilientFetch(
      `${config.baseUrl}/api/partner/sso_authentication`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'agapay-backend/1.0' },
      },
      'egov-sso:profile'
    );
  } catch (error) {
    console.error('[egov-sso] sso_authentication network failure:', error);
    return { ok: false, kind: 'network_error' };
  }

  const body = await parseJsonBody(response);
  console.log('[egov-sso] sso_authentication response:', response.status);

  if (!response.ok) {
    return { ok: false, kind: 'upstream_error', status: response.status, body };
  }

  return { ok: true, data: body };
}
