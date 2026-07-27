import { authenticate, getEverifyConfig, verifyIdentity, type EverifyQueryPayload } from '@/lib/everify';
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

  return Response.json({ error: `Unable to reach eVerify during ${step}` }, { status: 502 });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const body = (rawBody ?? {}) as Record<string, unknown>;
  const requiredFields = ['first_name', 'last_name', 'birth_date', 'face_liveness_session_id'] as const;
  const missingFields = requiredFields.filter((field) => !isNonEmptyString(body[field]));

  if (missingFields.length > 0) {
    return Response.json({ error: 'Missing required fields', missing_fields: missingFields }, { status: 400 });
  }

  const payload: EverifyQueryPayload = {
    first_name: body.first_name as string,
    middle_name: isNonEmptyString(body.middle_name) ? body.middle_name : null,
    last_name: body.last_name as string,
    suffix: isNonEmptyString(body.suffix) ? body.suffix : null,
    birth_date: body.birth_date as string,
    face_liveness_session_id: body.face_liveness_session_id as string,
  };

  const config = getEverifyConfig();
  if (!config) {
    console.error('eVerify route called with missing env config (EGOV_VERIFY_BASE_URL/CLIENT_ID/CLIENT_SECRET)');
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const authResult = await authenticate(config);
  if (!authResult.ok) {
    return upstreamFailureResponse('auth', authResult);
  }

  const queryResult = await verifyIdentity(config, authResult.data, payload);
  if (!queryResult.ok) {
    return upstreamFailureResponse('query', queryResult);
  }

  return Response.json(queryResult.data);
}
