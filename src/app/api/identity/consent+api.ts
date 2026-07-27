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
    return { error: Response.json({ error: 'Digital Health ID not found — create one first' }, { status: 409 }) };
  }

  return { dhid };
}

export async function GET(request: Request) {
  const resolved = await resolveDigitalHealthId(request);
  if ('error' in resolved) return resolved.error;
  const { dhid } = resolved;

  const url = new URL(request.url);
  const transactionType = url.searchParams.get('transaction_type');
  const facilityId = url.searchParams.get('facility_id');

  if (!transactionType) {
    return Response.json({ error: 'transaction_type query param is required' }, { status: 400 });
  }

  const supabase = requireSupabase();

  let query = supabase
    .from('consent_records')
    .select('*')
    .eq('digital_health_id_id', dhid.id)
    .eq('transaction_type', transactionType)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1);

  if (facilityId) {
    query = query.eq('facility_id', facilityId);
  }

  const { data: consent, error: consentError } = await query.maybeSingle();

  if (consentError) {
    console.error('Supabase error checking consent:', consentError);
    return Response.json({ error: 'identity_service_unavailable' }, { status: 502 });
  }

  if (!consent) {
    return Response.json({ consent: null });
  }

  return Response.json({
    consent: {
      consent_id: consent.id,
      status: consent.status,
      expires_at: consent.expires_at,
      consented_fields: consent.consented_fields,
      transaction_type: consent.transaction_type,
      facility_id: consent.facility_id,
    },
  });
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
  const transactionType = typeof body.transaction_type === 'string' ? body.transaction_type : '';
  const facilityId = typeof body.facility_id === 'string' && body.facility_id.length > 0 ? body.facility_id : null;
  const consentedFields = Array.isArray(body.consented_fields) ? body.consented_fields : [];
  const retentionDays = typeof body.retention_days === 'number' && body.retention_days > 0
    ? body.retention_days
    : 90;

  if (!transactionType) {
    return Response.json({ error: 'transaction_type is required' }, { status: 400 });
  }

  if (consentedFields.length === 0) {
    return Response.json({ error: 'consented_fields must be a non-empty array' }, { status: 400 });
  }

  const supabase = requireSupabase();
  const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: consent, error: insertError } = await supabase
    .from('consent_records')
    .insert({
      digital_health_id_id: dhid.id,
      transaction_type: transactionType,
      facility_id: facilityId,
      consented_fields: consentedFields,
      expires_at: expiresAt,
    })
    .select('*')
    .single();

  if (insertError) {
    console.error('Failed to create consent record:', insertError);
    return Response.json({ error: 'Failed to create consent record' }, { status: 500 });
  }

  return Response.json(
    {
      consent_id: consent.id,
      status: consent.status,
      expires_at: consent.expires_at,
      consented_fields: consent.consented_fields,
    },
    { status: 201 }
  );
}
