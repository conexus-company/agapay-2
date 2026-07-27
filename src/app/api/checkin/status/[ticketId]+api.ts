import { supabase } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  const { ticketId } = await params;

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return Response.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
  }

  if (!ticketId) {
    return Response.json({ error: 'ticketId is required' }, { status: 400 });
  }

  const citizenHash = `stub-hash-${token.slice(0, 8)}`;

  const { data: ticket, error } = await supabase
    .from('queue_tickets')
    .select('id, queue_number, facility_id, service_type, status, checked_in_at, called_at, completed_at')
    .eq('id', ticketId)
    .eq('citizen_hash', citizenHash)
    .single();

  if (error || !ticket) {
    return Response.json({ error: 'Ticket not found' }, { status: 404 });
  }

  return Response.json({
    ticket_id: ticket.id,
    queue_number: ticket.queue_number,
    facility_id: ticket.facility_id,
    service_type: ticket.service_type,
    status: ticket.status,
    checked_in_at: ticket.checked_in_at,
    called_at: ticket.called_at,
    completed_at: ticket.completed_at,
  });
}
