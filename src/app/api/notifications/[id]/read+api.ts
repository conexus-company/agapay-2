import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!supabaseAdmin) {
    return Response.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { id } = await params;

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return Response.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
  }

  if (!id) {
    return Response.json({ error: 'Notification id is required' }, { status: 400 });
  }

  const citizenHash = `stub-hash-${token.slice(0, 8)}`;

  // Only allow marking a notification this citizen is allowed to see
  // (their own rows plus broadcasts).
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('citizen_notifications')
    .select('id')
    .eq('id', id)
    .or(`citizen_hash.eq.${citizenHash},citizen_hash.is.null`)
    .single();

  if (existingError || !existing) {
    return Response.json({ error: 'Notification not found' }, { status: 404 });
  }

  const { error: readError } = await supabaseAdmin
    .from('notification_reads')
    .upsert(
      {
        citizen_hash: citizenHash,
        notification_id: id,
        read_at: new Date().toISOString(),
      },
      { onConflict: 'citizen_hash,notification_id' },
    );

  if (readError) {
    return Response.json({ error: readError.message }, { status: 502 });
  }

  return Response.json({ read: true });
}
