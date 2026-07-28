import { supabaseAdmin } from '@/lib/supabase-admin';

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
  const appointmentId = typeof body.appointment_id === 'string' ? body.appointment_id.trim() : null;

  if (!facilityId) {
    return Response.json({ error: 'facility_id is required' }, { status: 400 });
  }

  const citizenHash = `stub-hash-${token.slice(0, 8)}`;

  if (appointmentId) {
    const { data: appt, error: apptError } = await supabaseAdmin
      .from('appointments')
      .select('id, status, service_type')
      .eq('id', appointmentId)
      .eq('citizen_hash', citizenHash)
      .single();

    if (apptError || !appt) {
      return Response.json({ error: 'Appointment not found' }, { status: 404 });
    }

    if (appt.status === 'cancelled') {
      return Response.json({ error: 'This appointment is cancelled.' }, { status: 409 });
    }
  }

  const { data: existing } = await supabaseAdmin
    .from('queue_tickets')
    .select('id, queue_number, facility_id, service_type, status, checked_in_at')
    .eq('appointment_id', appointmentId ?? '')
    .in('status', ['waiting', 'called'])
    .maybeSingle();

  if (existing) {
    return Response.json({
      ticket_id: existing.id,
      queue_number: existing.queue_number,
      facility_id: existing.facility_id,
      service_type: existing.service_type,
      status: existing.status,
      checked_in_at: existing.checked_in_at,
    }, { status: 200 });
  }

  let serviceType = 'general';
  if (appointmentId) {
    const { data: appt } = await supabaseAdmin
      .from('appointments')
      .select('service_type')
      .eq('id', appointmentId)
      .single();
    if (appt?.service_type) serviceType = appt.service_type;
  } else if (typeof body.service_type === 'string' && body.service_type.trim()) {
    serviceType = body.service_type.trim();
  }

  const today = new Date().toISOString().split('T')[0];

  const { count } = await supabaseAdmin
    .from('queue_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('facility_id', facilityId)
    .gte('checked_in_at', `${today}T00:00:00Z`)
    .lt('checked_in_at', `${today}T23:59:59Z`)
    .in('status', ['waiting', 'called', 'completed']);

  const nextSeq = (count ?? 0) + 1;
  const queueNumber = `${facilityId.toUpperCase()}-${String(nextSeq).padStart(3, '0')}`;

  const { data: ticket, error: insertError } = await supabaseAdmin
    .from('queue_tickets')
    .insert({
      appointment_id: appointmentId,
      facility_id: facilityId,
      service_type: serviceType,
      citizen_hash: citizenHash,
      queue_number: queueNumber,
      status: 'waiting',
    })
    .select('id, queue_number, facility_id, service_type, status, checked_in_at')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      const retrySeq = nextSeq + 1;
      const retryNumber = `${facilityId.toUpperCase()}-${String(retrySeq).padStart(3, '0')}`;

      const { data: retryTicket, error: retryError } = await supabaseAdmin
        .from('queue_tickets')
        .insert({
          appointment_id: appointmentId,
          facility_id: facilityId,
          service_type: serviceType,
          citizen_hash: citizenHash,
          queue_number: retryNumber,
          status: 'waiting',
        })
        .select('id, queue_number, facility_id, service_type, status, checked_in_at')
        .single();

      if (retryError) {
        return Response.json({ error: retryError.message }, { status: 500 });
      }

      return Response.json({
        ticket_id: retryTicket.id,
        queue_number: retryTicket.queue_number,
        facility_id: retryTicket.facility_id,
        service_type: retryTicket.service_type,
        status: retryTicket.status,
        checked_in_at: retryTicket.checked_in_at,
      }, { status: 201 });
    }

    return Response.json({ error: insertError.message }, { status: 500 });
  }

  return Response.json({
    ticket_id: ticket.id,
    queue_number: ticket.queue_number,
    facility_id: ticket.facility_id,
    service_type: ticket.service_type,
    status: ticket.status,
    checked_in_at: ticket.checked_in_at,
  }, { status: 201 });
}
