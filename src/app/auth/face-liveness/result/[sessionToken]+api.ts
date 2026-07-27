import { getFaceLivenessConfig, getLivenessResult } from '@/lib/face-liveness';
import type { ApiResult } from '@/lib/api-result';

const MIN_CONFIDENCE_SCORE = 95;

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
  const status = body && typeof body === 'object' ? (body as { status?: unknown }).status : undefined;
  const confidenceScore =
    body && typeof body === 'object' ? (body as { confidence_score?: unknown }).confidence_score : undefined;

  const verified =
    status === 'SUCCEEDED' && typeof confidenceScore === 'number' && confidenceScore >= MIN_CONFIDENCE_SCORE;

  return Response.json({ ...(body as object), verified });
}
