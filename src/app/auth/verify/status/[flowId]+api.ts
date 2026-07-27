import { getFaceLivenessConfig, getLivenessResult, isLivenessVerified } from '@/lib/face-liveness';
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

export async function GET(_request: Request, { flowId }: Record<string, string>) {
  if (!flowId) {
    return Response.json({ error: 'flowId is required' }, { status: 400 });
  }

  const flow = await decodeFlowToken(flowId);
  if (!flow) {
    return Response.json({ error: 'Invalid or expired flow_id' }, { status: 400 });
  }

  const livenessConfig = getFaceLivenessConfig();
  if (!livenessConfig) {
    console.error('verify/status called with missing Face Liveness env config');
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const livenessResult = await getLivenessResult(livenessConfig, flow.livenessToken);
  if (!livenessResult.ok) {
    return upstreamFailureResponse('eGov Face Liveness', 'result lookup', livenessResult);
  }

  if (!isLivenessVerified(livenessResult.data)) {
    return Response.json({ flow_id: flowId, status: 'pending_liveness', liveness: livenessResult.data });
  }

  const everifyConfig = getEverifyConfig();
  if (!everifyConfig) {
    console.error('verify/status called with missing eVerify env config');
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const authResult = await authenticate(everifyConfig);
  if (!authResult.ok) {
    return upstreamFailureResponse('eVerify', 'auth', authResult);
  }

  const payload: EverifyQueryPayload = {
    first_name: flow.first_name,
    middle_name: flow.middle_name,
    last_name: flow.last_name,
    suffix: flow.suffix,
    birth_date: flow.birth_date,
    face_liveness_session_id: flow.livenessToken,
  };

  const queryResult = await verifyIdentity(everifyConfig, authResult.data, payload);
  if (!queryResult.ok) {
    return upstreamFailureResponse('eVerify', 'query', queryResult);
  }

  return Response.json({ flow_id: flowId, status: 'completed', everify: queryResult.data });
}
