import { parseJsonBody, type ApiResult } from '@/lib/api-result';
import { SPECIALTIES, type Specialty, type TriageResult } from '@/lib/health-navigation-types';

function isSpecialty(value: unknown): value is Specialty {
  return typeof value === 'string' && (SPECIALTIES as readonly string[]).includes(value);
}

function isTriageResult(value: unknown): value is TriageResult {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    isSpecialty(obj.specialty) &&
    typeof obj.explanation === 'string' &&
    typeof obj.confidence === 'number' &&
    typeof obj.is_emergency === 'boolean'
  );
}

export async function triageConcern(concern: string): Promise<ApiResult<TriageResult>> {
  let response: Response;
  try {
    response = await fetch('/health-navigation/triage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ concern }),
    });
  } catch {
    return { ok: false, kind: 'network_error' };
  }

  const body = await parseJsonBody(response);

  if (!response.ok) {
    return { ok: false, kind: 'upstream_error', status: response.status, body };
  }

  if (!isTriageResult(body)) {
    return { ok: false, kind: 'invalid_response', message: 'Triage response did not match the expected schema' };
  }

  return { ok: true, data: body };
}
