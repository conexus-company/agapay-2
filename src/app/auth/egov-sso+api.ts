import { callSsoAuthentication, exchangeCodeForToken, getEgovSsoConfig } from '@/lib/egov-sso';
import type { ApiResult } from '@/lib/api-result';

// TODO: production native builds need an `origin` set via the expo-router
// config plugin so this route resolves outside of `expo start` dev mode.

function upstreamFailureResponse(step: 'token' | 'sso_authentication', result: ApiResult<unknown>) {
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

export async function POST() {
  const config = getEgovSsoConfig();
  if (!config) {
    console.error('eGov SSO route called with missing env config (EGOV_SSO_BASE_URL/PARTNER_CODE/PARTNER_SECRET/EXCHANGE_CODE)');
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const tokenResult = await exchangeCodeForToken(config);
  if (!tokenResult.ok) {
    return upstreamFailureResponse('token', tokenResult);
  }

  const authResult = await callSsoAuthentication(config, tokenResult.data);
  if (!authResult.ok) {
    return upstreamFailureResponse('sso_authentication', authResult);
  }

  return Response.json(authResult.data);
}
