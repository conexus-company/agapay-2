import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ appointments: data ?? [] });
}
