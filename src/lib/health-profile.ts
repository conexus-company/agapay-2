import { FunctionsHttpError } from '@supabase/supabase-js';

import type { ApiResult } from '@/lib/api-result';
import { supabase } from '@/lib/supabase';

export type HealthProfile = {
  health_id: string;
  qr_payload: string;
  verification_level: string;
  full_name: string | null;
};

// The eGov SSO `sso_authentication` response wraps citizen fields under a
// `data` key, and the app's own `/auth/profile` route wraps that again — so
// depending on which path a profile object came through, citizen fields may
// be at the top level or nested one or two levels deep under `.data`. This
// walks down until it finds a level that actually looks like citizen fields.
function unwrapCitizenFields(raw: unknown): Record<string, unknown> {
  let current = raw;
  for (let i = 0; i < 3; i++) {
    if (!current || typeof current !== 'object') break;
    const obj = current as Record<string, unknown>;
    if (typeof obj.first_name === 'string' || typeof obj.last_name === 'string') {
      return obj;
    }
    if (obj.data && typeof obj.data === 'object') {
      current = obj.data;
      continue;
    }
    break;
  }
  return current && typeof current === 'object' ? (current as Record<string, unknown>) : {};
}

function stringField(fields: Record<string, unknown>, key: string): string | null {
  const value = fields[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

// Deterministic, non-cryptographic fallback (djb2) — only used when none of
// the candidate subject-id fields below are present.
function stableFallbackId(seed: string): string {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 33) ^ seed.charCodeAt(i);
  }
  return `derived-${(hash >>> 0).toString(36)}`;
}

// PLACEHOLDER: the hackathon eGov SSO sandbox has not confirmed which field
// carries the citizen's stable subject identifier, so this tries the
// plausible candidates and only falls back to a derived id (from name +
// birth date) if none are present. Once eGov confirms the real field name,
// trim this list to just that key — nothing else in the profile flow needs
// to change.
const SUBJECT_ID_CANDIDATE_KEYS = [
  'sub',
  'subject_id',
  'citizen_id',
  'philsys_number',
  'psn',
  'national_id',
  'reference_number',
  'id',
  'uuid',
];

export function resolveSsoSubjectId(profile: unknown): string {
  const fields = unwrapCitizenFields(profile);

  for (const key of SUBJECT_ID_CANDIDATE_KEYS) {
    const value = stringField(fields, key);
    if (value) return value;
  }

  const seed = [
    stringField(fields, 'first_name'),
    stringField(fields, 'middle_name'),
    stringField(fields, 'last_name'),
    stringField(fields, 'suffix'),
    stringField(fields, 'birth_date'),
  ]
    .filter(Boolean)
    .join('|');

  return stableFallbackId(seed);
}

export function resolveFullName(profile: unknown): string | null {
  const fields = unwrapCitizenFields(profile);

  const parts = [
    stringField(fields, 'first_name'),
    stringField(fields, 'middle_name'),
    stringField(fields, 'last_name'),
    stringField(fields, 'suffix'),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' ') : null;
}

// PLACEHOLDER: same situation as SUBJECT_ID_CANDIDATE_KEYS above — the
// hackathon eGov SSO sandbox hasn't confirmed the exact field name for the
// citizen's mobile number, so this tries the plausible candidates. Trim to
// the real key once eGov confirms it.
const MOBILE_NUMBER_CANDIDATE_KEYS = ['mobile_number', 'mobile_no', 'phone_number', 'contact_number', 'msisdn'];

export function resolveMobileNumber(profile: unknown): string | null {
  const fields = unwrapCitizenFields(profile);

  for (const key of MOBILE_NUMBER_CANDIDATE_KEYS) {
    const value = stringField(fields, key);
    if (value) return value;
  }

  return null;
}

export async function createOrGetHealthProfile(profile: unknown): Promise<ApiResult<HealthProfile>> {
  const { data, error } = await supabase.functions.invoke<HealthProfile>('generate-health-id', {
    body: {
      sso_subject_id: resolveSsoSubjectId(profile),
      full_name: resolveFullName(profile),
      raw_sso_data: profile,
    },
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const status = error.context.status;
      const body = await error.context.json().catch(() => null);
      return { ok: false, kind: 'upstream_error', status, body };
    }
    return { ok: false, kind: 'network_error' };
  }

  if (!data) {
    return { ok: false, kind: 'invalid_response', message: 'generate-health-id returned no data' };
  }

  return { ok: true, data };
}
