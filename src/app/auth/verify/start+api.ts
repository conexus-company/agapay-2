import { callSsoAuthentication, exchangeCodeForToken, getEgovSsoConfig } from '@/lib/egov-sso';
import { encodeFlowToken } from '@/lib/flow-token';
import type { ApiResult } from '@/lib/api-result';

function stringField(profile: unknown, field: string): string | null {
  if (!profile || typeof profile !== 'object') {
    return null;
  }
  const value = (profile as Record<string, unknown>)[field];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function upstreamFailureResponse(service: string, step: string, result: ApiResult<unknown>) {
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

  return Response.json({ error: `Unable to reach ${service} during ${step}` }, { status: 502 });
}

export async function POST(request: Request) {
  console.log('[verify/start] request received');

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

  const callbackUrl =
    typeof body.callback_url === 'string' && body.callback_url.length > 0
      ? body.callback_url
      : process.env.EGOV_LIVENESS_CALLBACK_URL;

  if (!callbackUrl) {
    return Response.json({ error: 'callback_url is required' }, { status: 400 });
  }

  const ssoConfig = getEgovSsoConfig();
  if (!ssoConfig) {
    console.error('verify/start called with missing eGov SSO env config');
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const tokenResult = await exchangeCodeForToken(ssoConfig, exchangeCode);
  if (!tokenResult.ok) {
    return upstreamFailureResponse('eGov SSO', 'token', tokenResult);
  }

  const profileResult = await callSsoAuthentication(ssoConfig, tokenResult.data);
  if (!profileResult.ok) {
    return upstreamFailureResponse('eGov SSO', 'sso_authentication', profileResult);
  }

  const profileFields =
    profileResult.data && typeof profileResult.data === 'object'
      ? (profileResult.data as { data?: unknown }).data
      : undefined;

  const flowId = await encodeFlowToken({
    first_name: stringField(profileFields, 'first_name') ?? '',
    middle_name: stringField(profileFields, 'middle_name'),
    last_name: stringField(profileFields, 'last_name') ?? '',
    suffix: stringField(profileFields, 'suffix'),
    birth_date: stringField(profileFields, 'birth_date') ?? '',
  });

  if (!flowId) {
    console.error('[verify/start] missing FLOW_TOKEN_SECRET env config');
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const livenessPageUrl = new URL('/auth/verify/liveness-page', request.url);
  livenessPageUrl.searchParams.set('redirect_uri', callbackUrl);

  console.log('[verify/start] flow started successfully, flow_id length:', flowId.length);

  return Response.json({
    flow_id: flowId,
    profile: profileResult.data,
    liveness: { url: livenessPageUrl.toString() },
  });
}
