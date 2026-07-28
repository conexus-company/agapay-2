import { supabaseAdmin } from '@/lib/supabase-admin';

const VALID_STATUSES = ['called', 'completed', 'no_show'] as const;

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return Response.json({ error: 'Database not configured' }, { status: 503 });
  }

  const advanceSecret = process.env.QUEUE_ADVANCE_SECRET;
  if (!advanceSecret) {
    return Response.json({ error: 'Feature not configured' }, { status: 403 });
  }

  const headerSecret = request.headers.get('x-advance-secret');
  if (headerSecret !== advanceSecret) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const body = (rawBody ?? {}) as Record<string, unknown>;
  const ticketId = typeof body.ticket_id === 'string' ? body.ticket_id.trim() : '';
  const status = typeof body.status === 'string' ? body.status.trim() : '';

  if (!ticketId || !status) {
    return Response.json({ error: 'ticket_id and status are required' }, { status: 400 });
  }

  if (!(VALID_STATUSES as readonly string[]).includes(status)) {
    return Response.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 },
    );
  }

  const { data: existing } = await supabaseAdmin
    .from('queue_tickets')
    .select('id, status')
    .eq('id', ticketId)
    .single();

  if (!existing) {
    return Response.json({ error: 'Ticket not found' }, { status: 404 });
  }

  if (existing.status !== 'waiting' && existing.status !== 'called') {
    return Response.json({ error: 'Ticket already in terminal state' }, { status: 409 });
  }

  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> = { status };
  if (status === 'called') updatePayload.called_at = now;
  if (status === 'completed') updatePayload.completed_at = now;

  const { error: updateError } = await supabaseAdmin
    .from('queue_tickets')
    .update(updatePayload)
    .eq('id', ticketId);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  const { data: ticket } = await supabaseAdmin
    .from('queue_tickets')
    .select('citizen_hash, queue_number')
    .eq('id', ticketId)
    .single();

  if (ticket) {
    const { data: tokens } = await supabaseAdmin
      .from('device_tokens')
      .select('push_token')
      .eq('citizen_hash', ticket.citizen_hash);

    const { data: prefs } = await supabaseAdmin
      .from('queue_notification_preferences')
      .select('push_enabled')
      .eq('citizen_hash', ticket.citizen_hash)
      .single();

    if (tokens?.length && prefs?.push_enabled !== false) {
      const messages = tokens.map((t) => ({
        to: t.push_token,
        title: 'Queue Update',
        body: `Your queue number ${ticket.queue_number} has been ${status === 'called' ? 'called' : status === 'completed' ? 'completed' : 'marked as no show'}.`,
        sound: 'default',
        data: { ticket_id: ticketId, status },
      }));

      try {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messages),
        });
      } catch {
        // Push failure is non-fatal
      }
    }
  }

  return Response.json({ advanced: true });
}
