import { supabaseAdmin } from '@/lib/supabase-admin';

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

  const { data, error } = await supabaseAdmin
    .from('queue_tickets')
    .select('id, queue_number, facility_id, service_type, status, checked_in_at, called_at, completed_at')
    .eq('citizen_hash', citizenHash)
    .order('checked_in_at', { ascending: false })
    .limit(10);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ tickets: data ?? [] });
}
