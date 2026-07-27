-- A-006: Digital Health Profile
-- Citizen health profile created after eGov SSO login. verification_level
-- starts at 'sso_only' and is designed to accept richer values once
-- A-003 (eVerify) / A-004 (Face Liveness) ship — no enum constraint here
-- on purpose, since those values don't exist yet.
create table if not exists public.health_profiles (
  id uuid primary key default gen_random_uuid(),
  sso_subject_id text not null unique,
  full_name text,
  health_id text not null unique,
  qr_payload text not null,
  verification_level text not null default 'sso_only',
  raw_sso_data jsonb,
  created_at timestamptz not null default now()
);

comment on table public.health_profiles is
  'Citizen Digital Health Profile. One row per eGov SSO subject; created on first login, reused on repeat logins.';
comment on column public.health_profiles.sso_subject_id is
  'Stable citizen identifier from the eGov SSO response. Unique so repeat logins reuse the existing profile instead of creating a duplicate.';
comment on column public.health_profiles.health_id is
  'AGAPAY-generated Digital Health ID, e.g. AGP-XXXXXXXX.';
comment on column public.health_profiles.qr_payload is
  'HMAC-signed, base64url-encoded payload rendered as the citizen QR code. Signed server-side only; the signing secret never reaches the client.';
comment on column public.health_profiles.verification_level is
  'sso_only today; will grow to sso_eVerify / sso_eVerify_faceLiveness once those flows ship. Intentionally free-text, not an enum.';
comment on column public.health_profiles.raw_sso_data is
  'Full SSO profile payload, stored once so the citizen never re-enters it (once-only data reuse principle).';

-- RLS is enabled with no policies: this table is only ever read/written by
-- the generate-health-id Edge Function via the service role key, which
-- bypasses RLS. Neither the anon nor authenticated key can touch it.
alter table public.health_profiles enable row level security;
