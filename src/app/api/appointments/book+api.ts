import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const body = (rawBody ?? {}) as Record<string, unknown>;
  const facilityId = typeof body.facility_id === 'string' ? body.facility_id.trim() : '';
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

  const referenceNumber = `AGP-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const { data, error: insertError } = await supabase
    .from('appointments')
    .insert({
      reference_number: referenceNumber,
      citizen_hash: 'stub-citizen-hash',
      facility_id: facilityId,
      service_type: serviceType,
      scheduled_at: scheduledAt,
      status: 'confirmed',
      consented_fields: body.consent_id ? { consent_id: body.consent_id } : {},
    })
    .select('id, reference_number, status, scheduled_at')
    .single();

  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  return Response.json(
    {
      appointment_id: data.id,
      reference_number: data.reference_number,
      status: data.status,
      scheduled_at: data.scheduled_at,
    },
    { status: 201 },
  );
}
