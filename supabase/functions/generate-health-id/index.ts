// A-006: Digital Health Profile
//
// Get-or-create the citizen's AGAPAY health profile after eGov SSO login.
// Runs server-side only so the HMAC signing secret (HEALTH_ID_HMAC_SECRET)
// never reaches the client — the app only ever receives the finished
// qr_payload to render as a QR code.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Excludes 0/O and 1/I to avoid ambiguity when a citizen reads the ID aloud
// or copies it by hand at a facility desk.
const HEALTH_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateHealthId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let code = '';
  for (const byte of bytes) code += HEALTH_ID_ALPHABET[byte % HEALTH_ID_ALPHABET.length];
  return `AGP-${code}`;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signQrPayload(payload: Record<string, unknown>, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const payloadB64 = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64));
  const signatureB64 = toBase64Url(new Uint8Array(signatureBytes));
  return `${payloadB64}.${signatureB64}`;
}

type HealthProfileRow = {
  health_id: string;
  qr_payload: string;
  verification_level: string;
  full_name: string | null;
};

const PROFILE_COLUMNS = 'health_id, qr_payload, verification_level, full_name';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const { sso_subject_id, full_name, raw_sso_data } = (body ?? {}) as Record<string, unknown>;

  if (typeof sso_subject_id !== 'string' || sso_subject_id.length === 0) {
    return json({ error: 'sso_subject_id is required' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const hmacSecret = Deno.env.get('HEALTH_ID_HMAC_SECRET');

  if (!supabaseUrl || !serviceRoleKey || !hmacSecret) {
    console.error(
      'generate-health-id: missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/HEALTH_ID_HMAC_SECRET env config'
    );
    return json({ error: 'Server misconfiguration' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: existing, error: selectError } = await supabase
    .from('health_profiles')
    .select(PROFILE_COLUMNS)
    .eq('sso_subject_id', sso_subject_id)
    .maybeSingle<HealthProfileRow>();

  if (selectError) {
    console.error('generate-health-id: lookup failed', selectError);
    return json({ error: 'Unable to set up your health profile right now' }, 500);
  }

  if (existing) {
    return json(existing, 200);
  }

  const verificationLevel = 'sso_only';
  const healthId = generateHealthId();
  const issuedAt = new Date().toISOString();

  const qrPayload = await signQrPayload(
    { health_id: healthId, sso_subject_id, verification_level: verificationLevel, issued_at: issuedAt },
    hmacSecret
  );

  const { data: inserted, error: insertError } = await supabase
    .from('health_profiles')
    .insert({
      sso_subject_id,
      full_name: typeof full_name === 'string' && full_name.length > 0 ? full_name : null,
      health_id: healthId,
      qr_payload: qrPayload,
      verification_level: verificationLevel,
      raw_sso_data: raw_sso_data ?? null,
    })
    .select(PROFILE_COLUMNS)
    .single<HealthProfileRow>();

  if (insertError) {
    // Unique violation on sso_subject_id means a concurrent request already
    // created the row (e.g. a double tap, or two devices signing in at once)
    // — the citizen already has a profile, so fetch and return it instead of
    // failing.
    if (insertError.code === '23505') {
      const { data: raceWinner } = await supabase
        .from('health_profiles')
        .select(PROFILE_COLUMNS)
        .eq('sso_subject_id', sso_subject_id)
        .maybeSingle<HealthProfileRow>();

      if (raceWinner) {
        return json(raceWinner, 200);
      }
    }

    console.error('generate-health-id: insert failed', insertError);
    return json({ error: 'Unable to set up your health profile right now' }, 500);
  }

  return json(inserted, 201);
});
