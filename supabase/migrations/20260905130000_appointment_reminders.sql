-- A-026: Appointment Notification (reminder half)
--
-- confirm+api.ts / book+api.ts never persisted contact info or a
-- human-readable facility name onto the appointments row (citizen_hash is a
-- one-way stub derived from the auth token, not reversible to a phone
-- number) — a server-driven reminder job has no live session to resolve
-- those from, so book+api.ts is updated alongside this migration to store
-- them at booking time. mobile_number/citizen_full_name/facility_name are
-- nullable: a missing mobile_number just means the SMS half of a reminder
-- is skipped for that appointment, push still works off citizen_hash alone.
alter table public.appointments
  add column if not exists mobile_number text,
  add column if not exists citizen_full_name text,
  add column if not exists facility_name text,
  add column if not exists reminder_24h_sent_at timestamptz,
  add column if not exists reminder_1h_sent_at timestamptz;

-- Lets send-reminders+api.ts's per-lead-time query
-- (status = 'confirmed' and <column> is null and scheduled_at in range)
-- skip already-reminded/irrelevant rows without a full table scan.
create index if not exists idx_appointments_reminder_24h
  on public.appointments (scheduled_at)
  where status = 'confirmed' and reminder_24h_sent_at is null;
create index if not exists idx_appointments_reminder_1h
  on public.appointments (scheduled_at)
  where status = 'confirmed' and reminder_1h_sent_at is null;
