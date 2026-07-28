import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  if (!supabaseAdmin) {
    return Response.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { data, error } = await supabaseAdmin
    .from('appointments')
    .select('*')
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ appointments: data ?? [] });
}
