import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Returns the calling citizen's active queue ticket (waiting or called), if
 * any — the client has nowhere else to learn a ticketId from once it exists
 * past the check-in screen (see queue.tsx), so it looks it up here instead
 * of trying to persist it locally.
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

  const { data: ticket, error } = await supabaseAdmin
    .from('queue_tickets')
    .select('id, queue_number, facility_id, service_type, status, checked_in_at, called_at, completed_at')
    .eq('citizen_hash', citizenHash)
    .in('status', ['waiting', 'called'])
    .order('checked_in_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!ticket) {
    return Response.json({ ticket: null });
  }

  return Response.json({
    ticket: {
      ticket_id: ticket.id,
      queue_number: ticket.queue_number,
      facility_id: ticket.facility_id,
      service_type: ticket.service_type,
      status: ticket.status,
      checked_in_at: ticket.checked_in_at,
      called_at: ticket.called_at,
      completed_at: ticket.completed_at,
    },
  });
}
