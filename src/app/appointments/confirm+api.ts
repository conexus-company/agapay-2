import { validateAppointmentAgainstHours } from '@/lib/appointments';
import { getEmessageConfig, sendSms } from '@/lib/emessage';
import { resolveFullName, resolveMobileNumber } from '@/lib/health-profile';
import type { ApiResult } from '@/lib/api-result';
import type { FacilityHours } from '@/lib/health-navigation-types';

/**
 * Sends the appointment-confirmed SMS via eMessage. There's no Appointment
 * booking module yet, so this takes the appointment details directly in the
 * request body rather than looking them up — the future booking flow can
 * call this the moment a booking is confirmed, passing along the citizen
 * profile (already on the auth session) and the booked slot.
 */
function upstreamFailureResponse(result: ApiResult<unknown>) {
  if (result.ok) {
    throw new Error('upstreamFailureResponse called with a successful result');
  }

  if (result.kind === 'upstream_error') {
    const status = result.status >= 400 && result.status < 500 ? result.status : 502;
    return Response.json(
      { error: 'SMS send failed', upstream_status: result.status, upstream_body: result.body },
      { status }
    );
  }

  if (result.kind === 'invalid_response') {
    return Response.json({ error: result.message }, { status: 502 });
  }

  return Response.json({ error: 'Unable to reach eMessage' }, { status: 502 });
}

function stringField(body: Record<string, unknown>, field: string): string | null {
  const value = body[field];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

// Untrusted request body — only accept it as facility hours if it's
// actually shaped like FacilityHours[]; anything else is treated the same
// as "no hours data" (validateAppointmentAgainstHours already no-ops then).
function parseFacilityHours(value: unknown): FacilityHours[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const entries: FacilityHours[] = [];
  for (const item of value) {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as Record<string, unknown>).day === 'string' &&
      typeof (item as Record<string, unknown>).open === 'string' &&
      typeof (item as Record<string, unknown>).close === 'string'
    ) {
      entries.push(item as FacilityHours);
    } else {
      return undefined;
    }
  }
  return entries;
}

export async function POST(request: Request) {
  console.log('[appointments/confirm] request received');

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const body = (rawBody ?? {}) as Record<string, unknown>;

  const facilityName = stringField(body, 'facility_name');
  const appointmentDate = stringField(body, 'appointment_date');
  const appointmentDateIso = stringField(body, 'appointment_date_iso');
  const appointmentTime = stringField(body, 'appointment_time');

  if (!facilityName || !appointmentDate || !appointmentDateIso || !appointmentTime) {
    return Response.json(
      { error: 'facility_name, appointment_date, appointment_date_iso, and appointment_time are required' },
      { status: 400 }
    );
  }

  // Authoritative check — the client's calendar UI blocking closed
  // days/out-of-hours slots is a UX nicety, not the source of truth, since
  // a client could bypass it and call this endpoint directly.
  const facilityHours = parseFacilityHours(body.facility_hours);
  const hoursCheck = validateAppointmentAgainstHours(facilityHours, appointmentDateIso, appointmentTime);
  if (!hoursCheck.ok) {
    return Response.json({ error: hoursCheck.reason }, { status: 422 });
  }

  const profile = body.profile;
  const mobileNumber = resolveMobileNumber(profile);
  if (!mobileNumber) {
    return Response.json({ error: 'Could not resolve a mobile number from the citizen profile' }, { status: 422 });
  }

  const config = getEmessageConfig();
  if (!config) {
    console.error('appointments/confirm called with missing eMessage env config (EMESSAGE_BASE_URL/ACCESS_TOKEN)');
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const fullName = resolveFullName(profile);
  const greeting = fullName ? `Hi ${fullName},` : 'Hi,';
  const message = `${greeting} your AGAPAY appointment at ${facilityName} on ${appointmentDate} at ${appointmentTime} is confirmed.`;

  const smsResult = await sendSms(config, mobileNumber, message);
  if (!smsResult.ok) {
    console.warn('[appointments/confirm] eMessage send failed:', smsResult.kind);
    return upstreamFailureResponse(smsResult);
  }

  console.log('[appointments/confirm] SMS sent successfully');
  return Response.json({ sent: true });
}
