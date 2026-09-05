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
    .from('appointments')
    .select('*')
    .eq('citizen_hash', citizenHash)
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ appointments: data ?? [] });
}
