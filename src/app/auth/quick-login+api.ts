import { callSsoAuthentication, exchangeCodeForToken, getEgovSsoConfig } from '@/lib/egov-sso';
import type { ApiResult } from '@/lib/api-result';

function upstreamFailureResponse(step: string, result: ApiResult<unknown>) {
  if (result.ok) {
    throw new Error('upstreamFailureResponse called with a successful result');
  }

  if (result.kind === 'upstream_error') {
    const status = result.status >= 400 && result.status < 500 ? result.status : 502;
    return Response.json(
      { error: `${step} request failed`, upstream_status: result.status, upstream_body: result.body },
      { status }
    );
  }

  if (result.kind === 'invalid_response') {
    return Response.json({ error: result.message }, { status: 502 });
  }

  return Response.json({ error: `Unable to reach eGov SSO during ${step}` }, { status: 502 });
}

/**
 * Dev-only shortcut: exchanges a manually-obtained exchange_code for the
 * citizen's eGov SSO profile without going through Face Liveness/eVerify.
 * Intentionally separate from /auth/verify/start so it never touches the
 * flow_id/liveness contract the production identity-verification flow relies on.
 */
export async function POST(request: Request) {
  console.log('[quick-login] request received');

  let rawBody: unknown = {};
  try {
    rawBody = (await request.json()) ?? {};
  } catch {
    // No body is fine — exchange_code can fall back to env below.
  }

  const body = rawBody as Record<string, unknown>;
  const exchangeCode =
    typeof body.exchange_code === 'string' && body.exchange_code.length > 0
      ? body.exchange_code
      : process.env.EGOV_SSO_EXCHANGE_CODE;

  if (!exchangeCode) {
    return Response.json({ error: 'exchange_code is required' }, { status: 400 });
  }

  const ssoConfig = getEgovSsoConfig();
  if (!ssoConfig) {
    console.error('[quick-login] called with missing eGov SSO env config');
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const tokenResult = await exchangeCodeForToken(ssoConfig, exchangeCode);
  if (!tokenResult.ok) {
    return upstreamFailureResponse('token', tokenResult);
  }

  const profileResult = await callSsoAuthentication(ssoConfig, tokenResult.data);
  if (!profileResult.ok) {
    return upstreamFailureResponse('sso_authentication', profileResult);
  }

  console.log('[quick-login] profile fetched successfully');

  return Response.json({ profile: profileResult.data });
}
