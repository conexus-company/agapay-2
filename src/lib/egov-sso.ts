import { parseJsonBody, type ApiResult } from '@/lib/api-result';

const SSO_SCOPE = 'SSO_AUTHENTICATION';

type EgovSsoConfig = {
  baseUrl: string;
  partnerCode: string;
  partnerSecret: string;
  exchangeCode: string;
};

export function getEgovSsoConfig(): EgovSsoConfig | null {
  const baseUrl = process.env.EGOV_SSO_BASE_URL;
  const partnerCode = process.env.EGOV_SSO_PARTNER_CODE;
  const partnerSecret = process.env.EGOV_SSO_PARTNER_SECRET;
  const exchangeCode = process.env.EGOV_SSO_EXCHANGE_CODE;

  if (!baseUrl || !partnerCode || !partnerSecret || !exchangeCode) {
    return null;
  }

  return { baseUrl, partnerCode, partnerSecret, exchangeCode };
}

export async function exchangeCodeForToken(
  config: Pick<EgovSsoConfig, 'baseUrl' | 'partnerCode' | 'partnerSecret' | 'exchangeCode'>
): Promise<ApiResult<string>> {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/api/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'agapay-backend/1.0' },
      body: JSON.stringify({
        exchange_code: config.exchangeCode,
        scope: SSO_SCOPE,
        partner_code: config.partnerCode,
        partner_secret: config.partnerSecret,
      }),
    });
  } catch {
    return { ok: false, kind: 'network_error' };
  }

  const body = await parseJsonBody(response);

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
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/api/partner/sso_authentication`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'agapay-backend/1.0' },
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
