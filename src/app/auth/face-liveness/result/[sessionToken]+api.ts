import { getFaceLivenessConfig, getLivenessResult, isLivenessVerified } from '@/lib/face-liveness';
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

  return Response.json({ error: `Unable to reach eGov Face Liveness during ${step}` }, { status: 502 });
}

export async function GET(_request: Request, { sessionToken }: Record<string, string>) {
  if (!sessionToken) {
    return Response.json({ error: 'sessionToken is required' }, { status: 400 });
  }

  const config = getFaceLivenessConfig();
  if (!config) {
    console.error(
      'Face Liveness route called with missing env config (EGOV_LIVENESS_BASE_URL/API_KEY/CALLBACK_URL)'
    );
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const result = await getLivenessResult(config, sessionToken);
  if (!result.ok) {
    return upstreamFailureResponse('result lookup', result);
  }

  const body = result.data;
  return Response.json({ ...(body as object), verified: isLivenessVerified(body) });
}
