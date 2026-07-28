import { authenticate, getEverifyConfig, verifyIdentity, type EverifyQueryPayload } from '@/lib/everify';
import { decodeFlowToken } from '@/lib/flow-token';
import type { ApiResult } from '@/lib/api-result';

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

export async function GET(request: Request, { flowId }: Record<string, string>) {
  console.log('[verify/status] request received');

  if (!flowId) {
    return Response.json({ error: 'flowId is required' }, { status: 400 });
  }

  const sessionId = new URL(request.url).searchParams.get('session_id');
  if (!sessionId) {
    return Response.json({ error: 'session_id is required' }, { status: 400 });
  }

  const flow = await decodeFlowToken(flowId);
  if (!flow) {
    console.warn('[verify/status] flow_id failed to decode/verify');
    return Response.json({ error: 'Invalid or expired flow_id' }, { status: 400 });
  }

  console.log('[verify/status] decoded flow, session_id:', sessionId);

  const everifyConfig = getEverifyConfig();
  if (!everifyConfig) {
    console.error('[verify/status] missing eVerify env config');
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const authResult = await authenticate(everifyConfig);
  if (!authResult.ok) {
    console.warn('[verify/status] eVerify auth failed:', authResult.kind);
    return upstreamFailureResponse('eVerify', 'auth', authResult);
  }

  const payload: EverifyQueryPayload = {
    first_name: flow.first_name,
    middle_name: flow.middle_name,
    last_name: flow.last_name,
    suffix: flow.suffix,
    birth_date: flow.birth_date,
    face_liveness_session_id: sessionId,
  };

  const queryResult = await verifyIdentity(everifyConfig, authResult.data, payload);
  if (!queryResult.ok) {
    console.warn('[verify/status] eVerify query failed:', queryResult.kind);
    return upstreamFailureResponse('eVerify', 'query', queryResult);
  }

  console.log('[verify/status] eVerify completed successfully');
  return Response.json({ flow_id: flowId, status: 'completed', everify: queryResult.data });
}
