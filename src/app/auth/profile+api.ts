import { callSsoAuthentication, getEgovSsoConfig } from '@/lib/egov-sso';
import type { ApiResult } from '@/lib/api-result';

// TODO: production native builds need an `origin` set via the expo-router
// config plugin so this route resolves outside of `expo start` dev mode.

function upstreamFailureResponse(result: ApiResult<unknown>) {
  if (result.ok) {
    throw new Error('upstreamFailureResponse called with a successful result');
  }

  if (result.kind === 'upstream_error') {
    const status = result.status >= 400 && result.status < 500 ? result.status : 502;
    return Response.json({ error: 'profile fetch failed', upstream_status: result.status }, { status });
  }

  if (result.kind === 'invalid_response') {
    return Response.json({ error: result.message }, { status: 502 });
  }

  return Response.json({ error: 'Unable to reach eGov SSO' }, { status: 502 });
}

export async function POST(request: Request) {
  const config = getEgovSsoConfig();
  if (!config) {
    console.warn('eGov SSO config missing — returning mock citizen profile for testing');
    return Response.json({
      data: {
        id: 'test-citizen-001',
        first_name: 'Test',
        last_name: 'User',
        birth_date: '1990-01-01',
      },
    });
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';

  if (!accessToken) {
    return Response.json({ error: 'Authorization bearer token is required' }, { status: 401 });
  }

  const authResult = await callSsoAuthentication(config, accessToken);
  if (!authResult.ok) {
    return upstreamFailureResponse(authResult);
  }

  return Response.json({ data: authResult.data });
}
