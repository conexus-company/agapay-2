import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
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
  const pushToken = typeof body.push_token === 'string' ? body.push_token.trim() : '';
  const platform = typeof body.platform === 'string' ? body.platform.trim() : '';

  if (!pushToken || !platform) {
    return Response.json({ error: 'push_token and platform are required' }, { status: 400 });
  }

  if (platform !== 'ios' && platform !== 'android') {
    return Response.json({ error: 'platform must be "ios" or "android"' }, { status: 400 });
  }

  const citizenHash = `stub-hash-${token.slice(0, 8)}`;

  const { error: tokenError } = await supabase
    .from('device_tokens')
    .upsert(
      { citizen_hash: citizenHash, push_token: pushToken, platform },
      { onConflict: 'citizen_hash,push_token' },
    );

  if (tokenError) {
    return Response.json({ error: tokenError.message }, { status: 502 });
  }

  await supabase
    .from('queue_notification_preferences')
    .upsert(
      { citizen_hash: citizenHash, push_enabled: true, in_app_enabled: true },
      { onConflict: 'citizen_hash' },
    );

  return Response.json({ registered: true });
}
