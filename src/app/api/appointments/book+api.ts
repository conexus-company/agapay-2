import { BOOKING_COMMITMENT_AMOUNT_PHP, BOOKING_HOLD_WINDOW_MINUTES } from '@/lib/appointments';
import { supabaseAdmin } from '@/lib/supabase-admin';

const UNIQUE_VIOLATION = '23505';

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return Response.json({ error: 'Database not configured' }, { status: 503 });
  }

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return Response.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const body = (rawBody ?? {}) as Record<string, unknown>;
  const facilityId = typeof body.facility_id === 'string' ? body.facility_id.trim() : '';
  const doctorId = typeof body.doctor_id === 'string' && body.doctor_id.trim() ? body.doctor_id.trim() : null;
  const serviceType = typeof body.service_type === 'string' ? body.service_type.trim() : '';
  const scheduledAt = typeof body.scheduled_at === 'string' ? body.scheduled_at.trim() : '';

  if (!facilityId || !serviceType || !scheduledAt) {
    return Response.json(
      { error: 'facility_id, service_type, and scheduled_at are required' },
      { status: 400 },
    );
  }

  if (isNaN(Date.parse(scheduledAt))) {
    return Response.json({ error: 'scheduled_at must be a valid ISO-8601 timestamp' }, { status: 400 });
  }

  if (new Date(scheduledAt) <= new Date()) {
    return Response.json({ error: 'scheduled_at must be in the future' }, { status: 400 });
  }

  const citizenHash = `stub-hash-${token.slice(0, 8)}`;
  const referenceNumber = `AGP-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  // Insert while still pending_commitment — appointments_active_slot_lock
  // (a unique index on facility_id + doctor_id + scheduled_at, scoped to
  // pending_commitment/confirmed rows) is the real-time lock: a second
  // citizen racing for the same doctor+slot hits a 23505 unique violation
  // here, not a check-then-insert with its own race window.
  const { data: appointment, error: insertError } = await supabaseAdmin
    .from('appointments')
    .insert({
      reference_number: referenceNumber,
      citizen_hash: citizenHash,
      facility_id: facilityId,
      doctor_id: doctorId,
      service_type: serviceType,
      scheduled_at: scheduledAt,
      status: 'pending_commitment',
      consented_fields: body.consent_id ? { consent_id: body.consent_id } : {},
    })
    .select('id, reference_number, scheduled_at')
    .single();

  if (insertError) {
    if (insertError.code === UNIQUE_VIOLATION) {
      return Response.json(
        { error: 'This time slot was just booked by someone else. Please choose another.' },
        { status: 409 },
      );
    }
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  const holdExpiresAt = new Date(Date.now() + BOOKING_HOLD_WINDOW_MINUTES * 60_000).toISOString();

  const { data: commitment, error: commitmentError } = await supabaseAdmin
    .from('booking_commitments')
    .insert({
      appointment_id: appointment.id,
      status: 'held',
      amount_php: BOOKING_COMMITMENT_AMOUNT_PHP,
      hold_expires_at: holdExpiresAt,
    })
    .select('id, status, amount_php')
    .single();

  if (commitmentError) {
    // Release the slot lock we just took — no commitment, no hold.
    await supabaseAdmin.from('appointments').delete().eq('id', appointment.id);
    return Response.json({ error: 'Could not place the booking hold. Please try again.' }, { status: 500 });
  }

  // No payment gateway exists yet (roadmap defers real integration to
  // eGovPay), so capture is an immediate placeholder rather than an actual
  // charge — it still exercises the real held -> captured state machine,
  // and a booking never reaches "confirmed" without this step succeeding.
  const now = new Date().toISOString();

  const { error: captureError } = await supabaseAdmin
    .from('booking_commitments')
    .update({ status: 'captured', captured_at: now, updated_at: now })
    .eq('id', commitment.id);

  if (captureError) {
    await supabaseAdmin.from('appointments').delete().eq('id', appointment.id);
    return Response.json({ error: 'Could not confirm the booking commitment. Please try again.' }, { status: 500 });
  }

  const { data: confirmed, error: confirmError } = await supabaseAdmin
    .from('appointments')
    .update({ status: 'confirmed', updated_at: now })
    .eq('id', appointment.id)
    .select('id, reference_number, status, scheduled_at')
    .single();

  if (confirmError || !confirmed) {
    await supabaseAdmin.from('appointments').delete().eq('id', appointment.id);
    return Response.json({ error: 'Could not confirm the booking. Please try again.' }, { status: 500 });
  }

  return Response.json(
    {
      appointment_id: confirmed.id,
      reference_number: confirmed.reference_number,
      status: confirmed.status,
      scheduled_at: confirmed.scheduled_at,
      commitment: { status: 'captured', amount_php: commitment.amount_php },
    },
    { status: 201 },
  );
}
