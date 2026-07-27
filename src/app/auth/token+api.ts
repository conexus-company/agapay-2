import { exchangeCodeForToken, getEgovSsoConfig } from '@/lib/egov-sso';
import { parseJsonBody, type ApiResult } from '@/lib/api-result';

// TODO: production native builds need an `origin` set via the expo-router
// config plugin so this route resolves outside of `expo start` dev mode.

function upstreamFailureResponse(result: ApiResult<unknown>) {
  if (result.ok) {
    throw new Error('upstreamFailureResponse called with a successful result');
  }

  if (result.kind === 'upstream_error') {
    const status = result.status >= 400 && result.status < 500 ? result.status : 502;
    return Response.json({ error: 'token exchange failed', upstream_status: result.status }, { status });
  }

  if (result.kind === 'invalid_response') {
    return Response.json({ error: result.message }, { status: 502 });
  }

  return Response.json({ error: 'Unable to reach eGov SSO' }, { status: 502 });
}

export async function POST(request: Request) {
  const config = getEgovSsoConfig();
  if (!config) {
    console.error('eGov SSO token route called with missing env config (EGOV_SSO_BASE_URL/PARTNER_CODE/PARTNER_SECRET)');
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const body = await parseJsonBody(request);
  const exchangeCode =
    body && typeof body === 'object' && 'exchange_code' in body
      ? (body as { exchange_code?: unknown }).exchange_code
      : undefined;

  if (typeof exchangeCode !== 'string' || exchangeCode.length === 0) {
    return Response.json({ error: 'exchange_code is required' }, { status: 400 });
  }

  const tokenResult = await exchangeCodeForToken(config, exchangeCode);
  if (!tokenResult.ok) {
    return upstreamFailureResponse(tokenResult);
  }

  return Response.json({ session_token: tokenResult.data });
}
