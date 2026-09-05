-- A-033: Booking Commitment (Micro-Deposit) & Real-Time Queue Lock
--
-- Backfills the schema for four tables that several routes already query
-- against (src/app/api/appointments/*, src/app/api/checkin/*,
-- src/app/api/notifications/register+api.ts) but that were never migrated.
-- Confirmed via the linked project's PostgREST schema cache that none of
-- these tables exist live yet — this migration is authoring them from
-- scratch, inferring columns from what the existing route code already
-- selects/inserts.

-- ---------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  reference_number text not null unique,
  citizen_hash text not null,
  facility_id text not null,
  -- Nullable: only the doctor-led booking flow (schedule-selection.tsx)
  -- populates this; a facility/service-only booking has no doctor to lock.
  doctor_id text,
  service_type text not null,
  scheduled_at timestamptz not null,
  status text not null default 'pending_commitment'
    check (status in ('pending_commitment', 'confirmed', 'cancelled', 'completed', 'no_show')),
  consented_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.appointments is
  'Citizen appointment bookings. A row starts pending_commitment while its booking_commitments hold is being captured, then moves to confirmed.';
comment on column public.appointments.doctor_id is
  'Doctor selected for the booking, when the flow has one. Combined with facility_id + scheduled_at for the real-time slot lock below.';

create index if not exists idx_appointments_citizen_hash on public.appointments (citizen_hash);
create index if not exists idx_appointments_facility_scheduled on public.appointments (facility_id, scheduled_at);

-- Real-time slot lock: at most one non-cancelled booking (held or
-- confirmed) may occupy a given doctor+facility+time. This is the
-- authoritative lock — book+api.ts relies on the resulting unique-violation
-- (23505) to reject a second citizen racing for the same slot, rather than
-- a check-then-insert that would have a race window of its own.
create unique index if not exists appointments_active_slot_lock
  on public.appointments (facility_id, doctor_id, scheduled_at)
  where status in ('pending_commitment', 'confirmed');

alter table public.appointments enable row level security;

-- ---------------------------------------------------------------------
-- booking_commitments (micro-deposit hold)
-- ---------------------------------------------------------------------
create table if not exists public.booking_commitments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments (id) on delete cascade,
  status text not null default 'held'
    check (status in ('held', 'captured', 'refunded', 'voided')),
  amount_php numeric(10, 2) not null default 0,
  hold_expires_at timestamptz not null,
  held_at timestamptz not null default now(),
  captured_at timestamptz,
  refunded_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.booking_commitments is
  'One row per appointment: tracks the booking micro-deposit hold through held -> captured, and its eventual refunded/voided outcome on cancellation. No real payment gateway is wired yet (see roadmap eGovPay) — capture today is an immediate, non-charging placeholder that still exercises the real state machine.';

alter table public.booking_commitments enable row level security;

-- ---------------------------------------------------------------------
-- queue_tickets
-- ---------------------------------------------------------------------
create table if not exists public.queue_tickets (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments (id),
  facility_id text not null,
  service_type text not null,
  citizen_hash text not null,
  queue_number text not null,
  status text not null default 'waiting'
    check (status in ('waiting', 'called', 'completed', 'no_show')),
  -- Queue numbers (e.g. "FACILITYID-003") reset daily per facility; this
  -- column plus the unique index below is what makes checkin/queue+api.ts's
  -- existing insert-conflict retry loop meaningful instead of dead code.
  checkin_date date not null default current_date,
  checked_in_at timestamptz not null default now(),
  called_at timestamptz,
  completed_at timestamptz
);

comment on table public.queue_tickets is
  'Digital check-in queue tickets. Created by checkin/queue+api.ts when a citizen checks in at a facility (a separate action from booking) and advanced by staff/kiosk via checkin/advance+api.ts.';

create unique index if not exists queue_tickets_daily_number
  on public.queue_tickets (facility_id, checkin_date, queue_number);
create index if not exists idx_queue_tickets_citizen_hash on public.queue_tickets (citizen_hash);
create index if not exists idx_queue_tickets_facility_id on public.queue_tickets (facility_id);
create index if not exists idx_queue_tickets_appointment_id on public.queue_tickets (appointment_id);

alter table public.queue_tickets enable row level security;

-- ---------------------------------------------------------------------
-- device_tokens / queue_notification_preferences
-- ---------------------------------------------------------------------
create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  citizen_hash text not null,
  push_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (citizen_hash, push_token)
);

create index if not exists idx_device_tokens_citizen_hash on public.device_tokens (citizen_hash);

alter table public.device_tokens enable row level security;

create table if not exists public.queue_notification_preferences (
  citizen_hash text primary key,
  push_enabled boolean not null default true,
  in_app_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.queue_notification_preferences enable row level security;

-- RLS is enabled with no policies on all four tables, matching
-- health_profiles: every route above reads/writes exclusively through
-- supabaseAdmin (the service role key), which bypasses RLS. Neither the
-- anon nor authenticated key can touch these tables.
