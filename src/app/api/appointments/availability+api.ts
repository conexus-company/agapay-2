import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Lists this doctor's already-taken slots at this facility, so the booking
 * UI can gray them out before a citizen tries to pick one. A UX nicety,
 * not the source of truth — the appointments_active_slot_lock unique index
 * is what actually prevents a double-book at insert time.
 */
export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return Response.json({ error: 'Database not configured' }, { status: 503 });
  }

  const url = new URL(request.url);
  const facilityId = url.searchParams.get('facility_id')?.trim() ?? '';
  const doctorId = url.searchParams.get('doctor_id')?.trim() ?? '';

  if (!facilityId || !doctorId) {
    return Response.json({ error: 'facility_id and doctor_id are required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('appointments')
    .select('scheduled_at')
    .eq('facility_id', facilityId)
    .eq('doctor_id', doctorId)
    .in('status', ['pending_commitment', 'confirmed'])
    .gte('scheduled_at', new Date().toISOString());

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ booked: (data ?? []).map((row) => row.scheduled_at) });
}
