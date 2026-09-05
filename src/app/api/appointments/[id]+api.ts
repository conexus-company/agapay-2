import { CANCELLATION_WINDOW_HOURS } from '@/lib/appointments';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!supabaseAdmin) {
    return Response.json({ error: 'Database not configured' }, { status: 503 });
  }

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return Response.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
  }

  const { id } = await params;

  if (!id) {
    return Response.json({ error: 'Appointment id is required' }, { status: 400 });
  }

  const citizenHash = `stub-hash-${token.slice(0, 8)}`;
  const now = new Date();

  const { data: appointment, error: updateError } = await supabaseAdmin
    .from('appointments')
    .update({ status: 'cancelled', updated_at: now.toISOString() })
    .eq('id', id)
    .eq('citizen_hash', citizenHash)
    .in('status', ['pending_commitment', 'confirmed'])
    .select()
    .single();

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  if (!appointment) {
    return Response.json({ error: 'Appointment not found or already cancelled' }, { status: 404 });
  }

  const { data: commitment } = await supabaseAdmin
    .from('booking_commitments')
    .select('*')
    .eq('appointment_id', appointment.id)
    .single();

  if (!commitment) {
    return Response.json({ appointment, commitment: null });
  }

  const hoursUntilAppointment = (new Date(appointment.scheduled_at).getTime() - now.getTime()) / (60 * 60 * 1000);
  const withinPolicy = hoursUntilAppointment >= CANCELLATION_WINDOW_HOURS;

  let releasedCommitment = commitment;
  let refund: { released: boolean; reason: string };

  if (!withinPolicy) {
    refund = {
      released: false,
      reason: `Cancelled less than ${CANCELLATION_WINDOW_HOURS} hours before the appointment, so the booking commitment is forfeited.`,
    };
  } else if (commitment.status === 'captured') {
    const { data: updated } = await supabaseAdmin
      .from('booking_commitments')
      .update({ status: 'refunded', refunded_at: now.toISOString(), updated_at: now.toISOString() })
      .eq('id', commitment.id)
      .select()
      .single();
    releasedCommitment = updated ?? commitment;
    refund = { released: true, reason: 'Cancelled within policy — the booking commitment has been refunded.' };
  } else if (commitment.status === 'held') {
    const { data: updated } = await supabaseAdmin
      .from('booking_commitments')
      .update({ status: 'voided', voided_at: now.toISOString(), updated_at: now.toISOString() })
      .eq('id', commitment.id)
      .select()
      .single();
    releasedCommitment = updated ?? commitment;
    refund = { released: true, reason: 'Cancelled within policy — the booking hold has been voided.' };
  } else {
    refund = { released: false, reason: `Booking commitment already ${commitment.status}.` };
  }

  return Response.json({ appointment, commitment: releasedCommitment, refund });
}
