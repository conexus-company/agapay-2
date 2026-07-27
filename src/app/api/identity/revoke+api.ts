import { createHash } from 'crypto';

import { callSsoAuthentication, getEgovSsoConfig } from '@/lib/egov-sso';
import { type ApiResult } from '@/lib/api-result';
import { requireSupabase } from '@/lib/supabase';

function stringField(profile: unknown, field: string): string | null {
  if (!profile || typeof profile !== 'object') return null;
  const value = (profile as Record<string, unknown>)[field];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function computeCitizenHash(firstName: string, lastName: string, birthDate: string): string {
  const input = `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${birthDate}`;
  return createHash('sha256').update(input).digest('hex');
}

function upstreamFailureResponse(result: ApiResult<unknown>) {
  if (result.ok) throw new Error('upstreamFailureResponse called with a successful result');

  if (result.kind === 'upstream_error') {
    const status = result.status >= 400 && result.status < 500 ? result.status : 502;
    return Response.json(
      { error: 'profile fetch failed', upstream_status: result.status },
      { status }
    );
  }
  if (result.kind === 'invalid_response') {
    return Response.json({ error: result.message }, { status: 502 });
  }
  return Response.json({ error: 'Unable to reach eGov SSO' }, { status: 502 });
}

async function resolveDigitalHealthId(request: Request) {
  const authHeader = request.headers.get('authorization') ?? '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  if (!accessToken) {
    return { error: Response.json({ error: 'Authorization bearer token is required' }, { status: 401 }) };
  }

  const ssoConfig = getEgovSsoConfig();
  if (!ssoConfig) {
    return { error: Response.json({ error: 'Server misconfiguration' }, { status: 500 }) };
  }

  const authResult = await callSsoAuthentication(ssoConfig, accessToken);
  if (!authResult.ok) {
    return { error: upstreamFailureResponse(authResult) };
  }

  const profileData = authResult.data;
  const data = profileData && typeof profileData === 'object'
    ? (profileData as { data?: unknown }).data ?? profileData
    : null;

  const firstName = stringField(data, 'first_name') ?? '';
  const lastName = stringField(data, 'last_name') ?? '';
  const birthDate = stringField(data, 'birth_date') ?? '';

  if (!firstName || !lastName || !birthDate) {
    return { error: Response.json({ error: 'Incomplete verified profile' }, { status: 422 }) };
  }

  const supabase = requireSupabase();
  const citizenHash = computeCitizenHash(firstName, lastName, birthDate);

  const { data: dhid, error: dhidError } = await supabase
    .from('digital_health_ids')
    .select('*')
    .eq('citizen_hash', citizenHash)
    .eq('is_revoked', false)
    .limit(1)
    .maybeSingle();

  if (dhidError) {
    console.error('Supabase error resolving Digital Health ID:', dhidError);
    return { error: Response.json({ error: 'identity_service_unavailable' }, { status: 502 }) };
  }

  if (!dhid) {
    return { error: Response.json({ error: 'Digital Health ID not found' }, { status: 409 }) };
  }

  return { dhid };
}

export async function POST(request: Request) {
  const resolved = await resolveDigitalHealthId(request);
  if ('error' in resolved) return resolved.error;
  const { dhid } = resolved;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const body = (rawBody ?? {}) as Record<string, unknown>;
  const scope = typeof body.scope === 'string' ? body.scope : '';
  const consentId = typeof body.consent_id === 'string' ? body.consent_id : null;

  if (scope !== 'consent' && scope !== 'health_id') {
    return Response.json({ error: 'scope must be "consent" or "health_id"' }, { status: 400 });
  }

  if (scope === 'consent' && !consentId) {
    return Response.json({ error: 'consent_id is required when scope is "consent"' }, { status: 400 });
  }

  const supabase = requireSupabase();

  if (scope === 'health_id') {
    const { error: revokeDhidError } = await supabase
      .from('digital_health_ids')
      .update({ is_revoked: true, updated_at: new Date().toISOString() })
      .eq('id', dhid.id);

    if (revokeDhidError) {
      console.error('Failed to revoke Digital Health ID:', revokeDhidError);
      return Response.json({ error: 'Failed to revoke Digital Health ID' }, { status: 500 });
    }

    const { error: cascadeError } = await supabase
      .from('consent_records')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('digital_health_id_id', dhid.id)
      .eq('status', 'active');

    if (cascadeError) {
      console.error('Failed to cascade revoke consents:', cascadeError);
    }

    return Response.json({ revoked: 'health_id', digital_health_id: dhid.id });
  }

  const { data: consent, error: fetchError } = await supabase
    .from('consent_records')
    .select('*')
    .eq('id', consentId!)
    .eq('digital_health_id_id', dhid.id)
    .single();

  if (fetchError || !consent) {
    return Response.json({ error: 'Consent record not found' }, { status: 404 });
  }

  if (consent.status !== 'active') {
    return Response.json({ error: 'Consent is already revoked' }, { status: 409 });
  }

  const { error: revokeError } = await supabase
    .from('consent_records')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('id', consentId!);

  if (revokeError) {
    console.error('Failed to revoke consent:', revokeError);
    return Response.json({ error: 'Failed to revoke consent' }, { status: 500 });
  }

  return Response.json({ revoked: 'consent', consent_id: consentId });
}
