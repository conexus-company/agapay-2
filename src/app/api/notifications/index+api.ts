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

  const { data: notifications, error } = await supabaseAdmin
    .from('citizen_notifications')
    .select('id, citizen_hash, category, title, body, action_route, created_at')
    .or(`citizen_hash.eq.${citizenHash},citizen_hash.is.null`)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return Response.json({ error: error.message }, { status: 502 });
  }

  // Read state is per citizen (broadcast rows are shared, so a column on the
  // row would leak read state across citizens).
  const { data: reads, error: readsError } = await supabaseAdmin
    .from('notification_reads')
    .select('notification_id, read_at')
    .eq('citizen_hash', citizenHash);

  if (readsError) {
    return Response.json({ error: readsError.message }, { status: 502 });
  }

  const readMap = new Map((reads ?? []).map((r) => [r.notification_id, r.read_at]));

  const items = (notifications ?? []).map((n) => {
    const readAt = readMap.get(n.id) ?? null;
    return { ...n, is_read: readAt !== null, read_at: readAt };
  });

  const unreadCount = items.filter((n) => !n.is_read).length;

  return Response.json({ notifications: items, unread_count: unreadCount });
}
