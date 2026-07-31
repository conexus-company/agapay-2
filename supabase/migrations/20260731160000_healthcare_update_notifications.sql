-- A-028: Healthcare Update Notification
--
-- In-app notifications for the citizen's healthcare journey. The Alerts tab
-- renders these: queue status changes (written by the check-in advance
-- endpoint), appointment milestones, and broadcast health advisories.
--
-- citizen_notifications.citizen_hash is NULL for broadcast rows that every
-- citizen sees (e.g. DOH-style health advisories) and set for journey-
-- specific rows (queue/appointment) so each citizen only sees their own.
--
-- Read state is tracked per citizen in notification_reads (a join table)
-- rather than a column on the row: that way marking a broadcast advisory
-- read for one citizen never flips it to read for everyone else.
--
-- DEMO DATA NOTICE: the seeded rows are hackathon placeholders illustrating
-- what a broadcast health advisory looks like. Treat them as demo content,
-- not verified official announcements.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

create table if not exists public.citizen_notifications (
  id uuid primary key default gen_random_uuid(),
  -- NULL = broadcast to all citizens; otherwise the citizen's stub hash
  -- (matches the `stub-hash-${token.slice(0,8)}` convention used by the
  -- check-in/notification API routes).
  citizen_hash text,
  category text not null default 'system'
    check (category in ('queue', 'appointment', 'health_advisory', 'system')),
  title text not null,
  body text not null,
  -- Optional deep link the app follows when the alert is tapped
  -- (e.g. '/queue', '/facilities', '/health-navigation').
  action_route text,
  created_at timestamptz not null default now()
);

comment on table public.citizen_notifications is
  'A-028 in-app notifications shown on the Alerts tab. citizen_hash NULL rows are broadcast to every citizen.';
comment on column public.citizen_notifications.action_route is
  'Expo Router path the Alerts tab navigates to when the alert is tapped.';

-- Per-citizen read state. Broadcast rows (citizen_hash IS NULL) are shared
-- rows, so read state must live here — keyed by citizen — not on the row.
create table if not exists public.notification_reads (
  citizen_hash text not null,
  notification_id uuid not null references public.citizen_notifications(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (citizen_hash, notification_id)
);

comment on table public.notification_reads is
  'Per-citizen read markers for citizen_notifications. Keeps broadcast rows from sharing read state across citizens.';

-- Server-only access: the notification API routes use the service role
-- (bypasses RLS), and the citizen's identity comes from the Bearer token,
-- matching the rest of the check-in/notification module.
alter table public.citizen_notifications enable row level security;
alter table public.notification_reads enable row level security;

create index if not exists citizen_notifications_citizen_created_idx
  on public.citizen_notifications (citizen_hash, created_at desc);

-- ---------------------------------------------------------------------------
-- Push registration tables (idempotent)
--
-- These back the push half of the notifications module. The register
-- endpoint (src/app/api/notifications/register+api.ts) upserts into both.
-- `if not exists` keeps this safe on the linked project where they may
-- already have been created during the digital check-in work.
-- ---------------------------------------------------------------------------

create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  citizen_hash text not null,
  push_token text not null,
  platform text not null,
  created_at timestamptz not null default now(),
  unique (citizen_hash, push_token)
);

create table if not exists public.queue_notification_preferences (
  citizen_hash text primary key,
  push_enabled boolean not null default true,
  in_app_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Seed: broadcast demo health advisories (visible to every citizen)
-- ---------------------------------------------------------------------------

insert into public.citizen_notifications (citizen_hash, category, title, body, action_route, created_at)
values
  (
    null,
    'health_advisory',
    'Dengue Prevention Week',
    'The City Health Office reminds everyone to follow the 4S campaign: Search and destroy, Self-protection, Seek early consultation, and Say yes to fogging.',
    '/health-navigation',
    now() - interval '2 hours'
  ),
  (
    null,
    'health_advisory',
    'Flu Vaccination Drive',
    'Free flu shots are now available at participating government health centers. Bring a valid ID and head to your nearest facility.',
    '/facilities',
    now() - interval '1 day'
  ),
  (
    null,
    'system',
    'Welcome to AGAPAY',
    'Your digital healthcare companion is ready. Explore facilities, book appointments, and track your queue right from the app.',
    '/',
    now() - interval '3 days'
  );
