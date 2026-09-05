import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Returns every queue ticket (any status, not just active) for the calling
 * citizen — unlike mine+api.ts, which only looks up the current
 * waiting/called ticket. journey.ts uses this to build check-in history
 * events on the journey timeline.
 */
export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return Response.json({ error: 'Database not configured' }, { status: 503 });
  }

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return Response.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
  }

  const citizenHash = `stub-hash-${token.slice(0, 8)}`;

  const { data: tickets, error } = await supabaseAdmin
    .from('queue_tickets')
    .select('id, queue_number, facility_id, service_type, status, checked_in_at, called_at, completed_at')
    .eq('citizen_hash', citizenHash)
    .order('checked_in_at', { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    tickets: (tickets ?? []).map((ticket) => ({
      ticket_id: ticket.id,
      queue_number: ticket.queue_number,
      facility_id: ticket.facility_id,
      service_type: ticket.service_type,
      status: ticket.status,
      checked_in_at: ticket.checked_in_at,
      called_at: ticket.called_at,
      completed_at: ticket.completed_at,
    })),
  });
}
