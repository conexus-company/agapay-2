import { createHash, randomBytes } from 'crypto';

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

function randomHex(bytes: number): string {
  return randomBytes(bytes).toString('hex');
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

function extractProfileFields(profileData: unknown) {
  const data = profileData && typeof profileData === 'object'
    ? (profileData as { data?: unknown }).data ?? profileData
    : null;

  return {
    firstName: stringField(data, 'first_name') ?? '',
    middleName: stringField(data, 'middle_name'),
    lastName: stringField(data, 'last_name') ?? '',
    suffix: stringField(data, 'suffix'),
    birthDate: stringField(data, 'birth_date') ?? '',
  };
}

async function resolveProfile(request: Request) {
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

  return { profile: extractProfileFields(authResult.data) };
}

function fullName(parts: { firstName: string; middleName: string | null; lastName: string; suffix: string | null }): string {
  const parts2 = [parts.firstName, parts.middleName, parts.lastName, parts.suffix].filter(Boolean);
  return parts2.join(' ');
}

export async function GET(request: Request) {
  const resolved = await resolveProfile(request);
  if ('error' in resolved) return resolved.error;
  const { profile } = resolved;

  if (!profile.firstName || !profile.lastName || !profile.birthDate) {
    return Response.json({ error: 'Incomplete verified profile' }, { status: 422 });
  }

  const supabase = requireSupabase();
  const citizenHash = computeCitizenHash(profile.firstName, profile.lastName, profile.birthDate);

  const { data: existing } = await supabase
    .from('digital_health_ids')
    .select('*')
    .eq('citizen_hash', citizenHash)
    .eq('is_revoked', false)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return Response.json({
      digital_health_id: existing.id,
      full_name: existing.full_name,
      birth_date: existing.birth_date,
      qr: { payload: `DHID:${existing.id}`, secret: existing.qr_secret },
      is_new: false,
    });
  }

  return Response.json({ error: 'Digital Health ID not found' }, { status: 404 });
}

export async function POST(request: Request) {
  const resolved = await resolveProfile(request);
  if ('error' in resolved) return resolved.error;
  const { profile } = resolved;

  if (!profile.firstName || !profile.lastName || !profile.birthDate) {
    return Response.json({ error: 'Incomplete verified profile — cannot create Digital Health ID' }, { status: 422 });
  }

  const supabase = requireSupabase();
  const citizenHash = computeCitizenHash(profile.firstName, profile.lastName, profile.birthDate);
  const name = fullName(profile);

  const { data: existing } = await supabase
    .from('digital_health_ids')
    .select('*')
    .eq('citizen_hash', citizenHash)
    .eq('is_revoked', false)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return Response.json({
      digital_health_id: existing.id,
      full_name: existing.full_name,
      birth_date: existing.birth_date,
      qr: { payload: `DHID:${existing.id}`, secret: existing.qr_secret },
      is_new: false,
    });
  }

  const qrSecret = randomHex(32);

  const { data: created, error: insertError } = await supabase
    .from('digital_health_ids')
    .insert({
      citizen_hash: citizenHash,
      full_name: name,
      birth_date: profile.birthDate,
      qr_secret: qrSecret,
    })
    .select('*')
    .single();

  if (insertError) {
    console.error('Failed to create Digital Health ID:', insertError);
    return Response.json({ error: 'Failed to create Digital Health ID' }, { status: 500 });
  }

  return Response.json({
    digital_health_id: created.id,
    full_name: created.full_name,
    birth_date: created.birth_date,
    qr: { payload: `DHID:${created.id}`, secret: created.qr_secret },
    is_new: true,
  });
}
