-- A-013: Healthcare Provider Directory
--
-- Demo database of healthcare facilities, departments, and providers that
-- powers the Healthcare Discovery module (Find Facilities list + facility
-- detail screens). This is READ-ONLY reference data for citizens: RLS is
-- enabled with select-only policies for everyone (anon + authenticated) so
-- the app can query it with the anon key; writes are reserved for the
-- service role / server-side code.
--
-- DEMO DATA NOTICE: this is hackathon seed data. Facility names, addresses,
-- and contact details are plausible placeholders for real Philippine
-- institutions and must be verified before any production use. All provider
-- (doctor) records are fictional demo entries. Contact details are marked
-- DEMO-* license numbers to make that obvious.
--
-- Column shapes mirror the app types in src/lib/health-navigation-types.ts
-- (Facility, Doctor, FacilityHours) so a future lib layer can map rows
-- straight onto those types:
--   - opening_hours  -> jsonb array of {day, open, close} ("HH:MM", 24h)
--   - services       -> text[] (facility-level service list)
--   - ownership      -> 'government' | 'private' (app shows Government/Private)
--   - rating         -> numeric(2,1) 0.0-5.0
--   - is_verified    -> boolean
--   - icon           -> Ionicons glyph name used by the app
--
-- NOTE ON SPECIALTY LABELS: department/provided specialties use natural
-- Philippine clinical names (e.g. 'Emergency Medicine'). A future mapping
-- table can normalize these onto the Stage-1 triage SPECIALTIES list
-- ('Emergency/Urgent Care', 'OB-GYN', ...) when the directory is joined to
-- the AI health navigation flow.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

create table if not exists public.healthcare_facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  facility_type text not null
    check (facility_type in ('hospital', 'clinic', 'health_center', 'dental_clinic', 'doctors_office', 'laboratory')),
  ownership text
    check (ownership in ('government', 'private')),
  address text,
  city text,
  province text,
  lat double precision not null,
  lng double precision not null,
  phone text,
  email text,
  website text,
  icon text not null default 'medical-outline',
  services text[] not null default '{}',
  opening_hours jsonb not null default '[]'::jsonb,
  rating numeric(2, 1) check (rating >= 0 and rating <= 5),
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.healthcare_departments (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.healthcare_facilities(id) on delete cascade,
  name text not null,
  specialty text,
  created_at timestamptz not null default now()
);

create table if not exists public.healthcare_providers (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.healthcare_facilities(id) on delete cascade,
  department_id uuid references public.healthcare_departments(id) on delete set null,
  full_name text not null,
  specialty text not null,
  qualifications text,
  license_number text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.healthcare_facilities is
  'A-013 demo directory of healthcare facilities (hospitals, clinics, health centers). Read-only reference data for citizens.';
comment on column public.healthcare_facilities.ownership is
  "'government' or 'private' - rendered by the app as the Government/Private badge. Null when unknown.";
comment on column public.healthcare_facilities.opening_hours is
  'Weekly hours as jsonb array of {day, open, close} with 24h "HH:MM" times; null open/close marks a closed day. Mirrors the app FacilityHours type.';
comment on column public.healthcare_facilities.rating is
  'Demo rating 0.0-5.0. Placeholder data only.';
comment on table public.healthcare_departments is
  'A-013 demo directory of departments/wards inside a facility (e.g. Emergency Medicine, Cardiology).';
comment on table public.healthcare_providers is
  'A-013 demo directory of individual healthcare providers (doctors/dentists) practicing at a facility, optionally within a department. All records are fictional demo entries.';

-- ---------------------------------------------------------------------------
-- RLS - citizens can read the whole directory; no client can write it
-- ---------------------------------------------------------------------------

alter table public.healthcare_facilities enable row level security;
alter table public.healthcare_departments enable row level security;
alter table public.healthcare_providers enable row level security;

create policy "directory_facilities_readable" on public.healthcare_facilities
  for select using (true);
create policy "directory_departments_readable" on public.healthcare_departments
  for select using (true);
create policy "directory_providers_readable" on public.healthcare_providers
  for select using (true);

-- Supabase grants public-schema tables to anon/authenticated by default, but
-- state it explicitly so the intended read-only access is self-documenting.
grant select on public.healthcare_facilities to anon, authenticated;
grant select on public.healthcare_departments to anon, authenticated;
grant select on public.healthcare_providers to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Indexes for the search / browse paths the app uses
-- ---------------------------------------------------------------------------

create index if not exists healthcare_facilities_name_idx on public.healthcare_facilities (lower(name));
create index if not exists healthcare_facilities_city_idx on public.healthcare_facilities (city);
create index if not exists healthcare_facilities_type_idx on public.healthcare_facilities (facility_type);
create index if not exists healthcare_departments_facility_idx on public.healthcare_departments (facility_id);
create index if not exists healthcare_providers_facility_idx on public.healthcare_providers (facility_id);
create index if not exists healthcare_providers_department_idx on public.healthcare_providers (department_id);
create index if not exists healthcare_providers_specialty_idx on public.healthcare_providers (specialty);

-- ---------------------------------------------------------------------------
-- Demo seed data
-- ---------------------------------------------------------------------------

-- Compact builder for the weekly opening_hours jsonb shape the app expects.
-- Defaults to the common Mon-Fri 8:00-17:00 + Sat 8:00-12:00 clinic pattern.
-- Named `_demo_*` and dropped at the end of this migration so it never
-- lingers in the schema.
create or replace function public._demo_weekly_hours(
  weekday_open text default '08:00',
  weekday_close text default '17:00',
  saturday_open text default '08:00',
  saturday_close text default '12:00',
  sunday_open text default null,
  sunday_close text default null
) returns jsonb
language sql
immutable
as $$
  select jsonb_build_array(
    jsonb_build_object('day', 'Monday', 'open', weekday_open, 'close', weekday_close),
    jsonb_build_object('day', 'Tuesday', 'open', weekday_open, 'close', weekday_close),
    jsonb_build_object('day', 'Wednesday', 'open', weekday_open, 'close', weekday_close),
    jsonb_build_object('day', 'Thursday', 'open', weekday_open, 'close', weekday_close),
    jsonb_build_object('day', 'Friday', 'open', weekday_open, 'close', weekday_close),
    jsonb_build_object('day', 'Saturday', 'open', saturday_open, 'close', saturday_close),
    jsonb_build_object('day', 'Sunday', 'open', sunday_open, 'close', sunday_close)
  );
$$;

insert into public.healthcare_facilities (
  id, name, facility_type, ownership, address, city, province, lat, lng,
  phone, email, website, icon, services, opening_hours, rating, is_verified
) values
  -- Hospitals (Metro Manila) - 24/7 emergency coverage
  (
    'a0130000-0000-4000-8000-000000000001',
    'Philippine General Hospital',
    'hospital', 'government', 'Taft Avenue, Ermita',
    'Manila', 'Metro Manila', 14.5788, 120.9881,
    '(02) 8554-8400', 'info@pgh.gov.ph', 'https://www.pgh.gov.ph',
    'business-outline',
    array['Emergency Medicine', 'Internal Medicine', 'Pediatrics', 'Obstetrics & Gynecology', 'General Surgery', 'Orthopedics'],
    public._demo_weekly_hours('00:00', '23:59', '00:00', '23:59', '00:00', '23:59'),
    4.3, true
  ),
  (
    'a0130000-0000-4000-8000-000000000002',
    'Makati Medical Center',
    'hospital', 'private', '2 Amorsolo Street, Legazpi Village',
    'Makati', 'Metro Manila', 14.5573, 121.0218,
    '(02) 8888-8999', 'info@makatimed.com.ph', 'https://www.makatimed.com.ph',
    'medical-outline',
    array['Cardiology', 'Oncology', 'Orthopedics', 'Pediatrics', 'Emergency Medicine'],
    public._demo_weekly_hours('00:00', '23:59', '00:00', '23:59', '00:00', '23:59'),
    4.6, true
  ),
  (
    'a0130000-0000-4000-8000-000000000003',
    'St. Luke''s Medical Center - Quezon City',
    'hospital', 'private', '279 E. Rodriguez Sr. Boulevard',
    'Quezon City', 'Metro Manila', 14.6211, 121.0369,
    '(02) 8723-0101', 'info@stlukes.com.ph', 'https://www.stlukes.com.ph',
    'medical-outline',
    array['Cardiology', 'Neurology', 'Oncology', 'Urology', 'Emergency Medicine', 'Radiology'],
    public._demo_weekly_hours('00:00', '23:59', '00:00', '23:59', '00:00', '23:59'),
    4.7, true
  ),
  (
    'a0130000-0000-4000-8000-000000000004',
    'The Medical City',
    'hospital', 'private', 'Ortigas Avenue',
    'Pasig', 'Metro Manila', 14.5834, 121.0572,
    '(02) 8988-1000', 'info@themedicalcity.com', 'https://www.themedicalcity.com',
    'medical-outline',
    array['Internal Medicine', 'Dermatology', 'Ear, Nose & Throat', 'Ophthalmology', 'Emergency Medicine'],
    public._demo_weekly_hours('00:00', '23:59', '00:00', '23:59', '00:00', '23:59'),
    4.5, true
  ),
  (
    'a0130000-0000-4000-8000-000000000005',
    'Asian Hospital and Medical Center',
    'hospital', 'private', '2205 Civic Drive, Filinvest City',
    'Muntinlupa', 'Metro Manila', 14.4186, 121.0201,
    '(02) 8771-9000', 'info@asianhospital.com', 'https://www.asianhospital.com',
    'medical-outline',
    array['Orthopedics', 'Internal Medicine', 'Cardiology', 'Oncology'],
    public._demo_weekly_hours('00:00', '23:59', '00:00', '23:59', '00:00', '23:59'),
    4.4, true
  ),
  (
    'a0130000-0000-4000-8000-000000000006',
    'East Avenue Medical Center',
    'hospital', 'government', 'East Avenue',
    'Quezon City', 'Metro Manila', 14.6257, 121.0413,
    '(02) 8926-0957', null, null,
    'business-outline',
    array['Obstetrics & Gynecology', 'Pediatrics', 'Emergency Medicine', 'Internal Medicine'],
    public._demo_weekly_hours('00:00', '23:59', '00:00', '23:59', '00:00', '23:59'),
    4.0, true
  ),
  (
    'a0130000-0000-4000-8000-000000000007',
    'National Kidney and Transplant Institute',
    'hospital', 'government', 'East Avenue',
    'Quezon City', 'Metro Manila', 14.6271, 121.0437,
    '(02) 8981-0300', null, 'https://www.nkti.gov.ph',
    'business-outline',
    array['Nephrology', 'Urology', 'Dialysis', 'Kidney Transplant'],
    public._demo_weekly_hours('00:00', '23:59', '00:00', '23:59', '00:00', '23:59'),
    4.2, true
  ),
  (
    'a0130000-0000-4000-8000-000000000008',
    'Philippine Heart Center',
    'hospital', 'government', 'East Avenue',
    'Quezon City', 'Metro Manila', 14.6230, 121.0435,
    '(02) 8925-2401', null, 'https://www.phc.gov.ph',
    'business-outline',
    array['Cardiology', 'Cardiothoracic Surgery', 'Vascular Medicine'],
    public._demo_weekly_hours('00:00', '23:59', '00:00', '23:59', '00:00', '23:59'),
    4.1, true
  ),
  (
    'a0130000-0000-4000-8000-000000000009',
    'Lung Center of the Philippines',
    'hospital', 'government', 'East Avenue',
    'Quezon City', 'Metro Manila', 14.6261, 121.0430,
    '(02) 8924-6101', null, 'https://www.lcp.gov.ph',
    'business-outline',
    array['Pulmonology', 'Thoracic Surgery', 'Tuberculosis'],
    public._demo_weekly_hours('00:00', '23:59', '00:00', '23:59', '00:00', '23:59'),
    4.0, true
  ),
  (
    'a0130000-0000-4000-8000-000000000010',
    'Manila Doctors Hospital',
    'hospital', 'private', '667 United Nations Avenue, Ermita',
    'Manila', 'Metro Manila', 14.5765, 120.9883,
    '(02) 8524-3011', null, null,
    'medical-outline',
    array['General Practice', 'Internal Medicine', 'Emergency Medicine'],
    public._demo_weekly_hours('00:00', '23:59', '00:00', '23:59', '00:00', '23:59'),
    4.1, true
  ),
  (
    'a0130000-0000-4000-8000-000000000011',
    'Ospital ng Makati',
    'hospital', 'government', '2 Amorsolo Street',
    'Makati', 'Metro Manila', 14.5673, 121.0359,
    '(02) 8888-8394', null, null,
    'business-outline',
    array['Emergency Medicine', 'Internal Medicine', 'Pediatrics', 'Obstetrics & Gynecology'],
    public._demo_weekly_hours('00:00', '23:59', '00:00', '23:59', '00:00', '23:59'),
    3.9, true
  ),
  (
    'a0130000-0000-4000-8000-000000000012',
    'University of Santo Tomas Hospital',
    'hospital', 'private', 'Lacson Avenue, Sampaloc',
    'Manila', 'Metro Manila', 14.6104, 120.9893,
    '(02) 8731-3001', null, 'https://www.usthospital.com.ph',
    'medical-outline',
    array['Dentistry', 'Internal Medicine', 'Pediatrics', 'Emergency Medicine'],
    public._demo_weekly_hours('00:00', '23:59', '00:00', '23:59', '00:00', '23:59'),
    4.3, true
  ),
  (
    'a0130000-0000-4000-8000-000000000013',
    'Chinese General Hospital and Medical Center',
    'hospital', 'private', '286 Blumentritt Road, Santa Cruz',
    'Manila', 'Metro Manila', 14.6061, 120.9819,
    '(02) 8711-4141', null, null,
    'medical-outline',
    array['Internal Medicine', 'Cardiology', 'Emergency Medicine'],
    public._demo_weekly_hours('00:00', '23:59', '00:00', '23:59', '00:00', '23:59'),
    4.0, true
  ),
  (
    'a0130000-0000-4000-8000-000000000014',
    'Rizal Medical Center',
    'hospital', 'government', 'Pasig Boulevard',
    'Pasig', 'Metro Manila', 14.5639, 121.0848,
    '(02) 8702-4411', null, null,
    'business-outline',
    array['Emergency Medicine', 'Internal Medicine', 'Pediatrics'],
    public._demo_weekly_hours('00:00', '23:59', '00:00', '23:59', '00:00', '23:59'),
    3.8, true
  ),
  (
    'a0130000-0000-4000-8000-000000000015',
    'Amang Rodriguez Memorial Medical Center',
    'hospital', 'government', 'Sumulong Highway',
    'Marikina', 'Metro Manila', 14.6400, 121.1010,
    '(02) 8646-4401', null, null,
    'business-outline',
    array['Emergency Medicine', 'Internal Medicine', 'Pediatrics'],
    public._demo_weekly_hours('00:00', '23:59', '00:00', '23:59', '00:00', '23:59'),
    3.8, true
  ),
  (
    'a0130000-0000-4000-8000-000000000016',
    'San Lazaro Hospital',
    'hospital', 'government', 'Quiricada Street, Santa Cruz',
    'Manila', 'Metro Manila', 14.5969, 120.9893,
    '(02) 8730-0911', null, null,
    'business-outline',
    array['Infectious Diseases', 'Dermatology', 'Internal Medicine'],
    public._demo_weekly_hours('00:00', '23:59', '00:00', '23:59', '00:00', '23:59'),
    3.7, true
  ),
  -- Smaller clinics - standard weekday hours
  (
    'a0130000-0000-4000-8000-000000000017',
    'Ligaya Family Clinic',
    'clinic', 'private', '42 Scout Rallos Street',
    'Quezon City', 'Metro Manila', 14.6105, 121.0260,
    null, null, null,
    'medical-outline',
    array['General Practice', 'Pediatrics', 'Women''s Health'],
    public._demo_weekly_hours('09:00', '17:00', '09:00', '12:00'),
    4.5, false
  ),
  (
    'a0130000-0000-4000-8000-000000000018',
    'Bagong Silang Community Health Center',
    'health_center', 'government', 'Bagong Silang',
    'Caloocan', 'Metro Manila', 14.7120, 121.1090,
    null, null, null,
    'medical-outline',
    array['General Practice', 'Maternal & Child Health', 'Immunization'],
    public._demo_weekly_hours('08:00', '17:00', null, null),
    3.6, false
  ),
  (
    'a0130000-0000-4000-8000-000000000019',
    'SmileLine Dental Clinic',
    'dental_clinic', 'private', '7 Tomas Morato Avenue',
    'Quezon City', 'Metro Manila', 14.6077, 121.0350,
    null, null, null,
    'medical-outline',
    array['General Dentistry', 'Orthodontics', 'Oral Surgery'],
    public._demo_weekly_hours('10:00', '19:00', '09:00', '17:00'),
    4.6, false
  )
on conflict (id) do nothing;

insert into public.healthcare_departments (id, facility_id, name, specialty) values
  ('a0130000-0000-4000-8000-000000000101', 'a0130000-0000-4000-8000-000000000001', 'Emergency Medicine', 'Emergency Medicine'),
  ('a0130000-0000-4000-8000-000000000102', 'a0130000-0000-4000-8000-000000000001', 'Internal Medicine', 'Internal Medicine'),
  ('a0130000-0000-4000-8000-000000000103', 'a0130000-0000-4000-8000-000000000001', 'Pediatrics', 'Pediatrics'),
  ('a0130000-0000-4000-8000-000000000104', 'a0130000-0000-4000-8000-000000000001', 'Obstetrics & Gynecology', 'Obstetrics & Gynecology'),
  ('a0130000-0000-4000-8000-000000000105', 'a0130000-0000-4000-8000-000000000001', 'General Surgery', 'General Surgery'),
  ('a0130000-0000-4000-8000-000000000106', 'a0130000-0000-4000-8000-000000000002', 'Cardiology', 'Cardiology'),
  ('a0130000-0000-4000-8000-000000000107', 'a0130000-0000-4000-8000-000000000002', 'Oncology', 'Oncology'),
  ('a0130000-0000-4000-8000-000000000108', 'a0130000-0000-4000-8000-000000000002', 'Orthopedics', 'Orthopedics'),
  ('a0130000-0000-4000-8000-000000000109', 'a0130000-0000-4000-8000-000000000002', 'Pediatrics', 'Pediatrics'),
  ('a0130000-0000-4000-8000-000000000110', 'a0130000-0000-4000-8000-000000000002', 'Emergency Medicine', 'Emergency Medicine'),
  ('a0130000-0000-4000-8000-000000000111', 'a0130000-0000-4000-8000-000000000003', 'Cardiology', 'Cardiology'),
  ('a0130000-0000-4000-8000-000000000112', 'a0130000-0000-4000-8000-000000000003', 'Neurology', 'Neurology'),
  ('a0130000-0000-4000-8000-000000000113', 'a0130000-0000-4000-8000-000000000003', 'Oncology', 'Oncology'),
  ('a0130000-0000-4000-8000-000000000114', 'a0130000-0000-4000-8000-000000000003', 'Urology', 'Urology'),
  ('a0130000-0000-4000-8000-000000000115', 'a0130000-0000-4000-8000-000000000004', 'Internal Medicine', 'Internal Medicine'),
  ('a0130000-0000-4000-8000-000000000116', 'a0130000-0000-4000-8000-000000000004', 'Dermatology', 'Dermatology'),
  ('a0130000-0000-4000-8000-000000000117', 'a0130000-0000-4000-8000-000000000004', 'Ear, Nose & Throat', 'Ear, Nose & Throat'),
  ('a0130000-0000-4000-8000-000000000118', 'a0130000-0000-4000-8000-000000000004', 'Ophthalmology', 'Ophthalmology'),
  ('a0130000-0000-4000-8000-000000000119', 'a0130000-0000-4000-8000-000000000005', 'Orthopedics', 'Orthopedics'),
  ('a0130000-0000-4000-8000-000000000120', 'a0130000-0000-4000-8000-000000000005', 'Internal Medicine', 'Internal Medicine'),
  ('a0130000-0000-4000-8000-000000000121', 'a0130000-0000-4000-8000-000000000006', 'Obstetrics & Gynecology', 'Obstetrics & Gynecology'),
  ('a0130000-0000-4000-8000-000000000122', 'a0130000-0000-4000-8000-000000000006', 'Pediatrics', 'Pediatrics'),
  ('a0130000-0000-4000-8000-000000000123', 'a0130000-0000-4000-8000-000000000007', 'Nephrology', 'Nephrology'),
  ('a0130000-0000-4000-8000-000000000124', 'a0130000-0000-4000-8000-000000000007', 'Urology', 'Urology'),
  ('a0130000-0000-4000-8000-000000000125', 'a0130000-0000-4000-8000-000000000007', 'Dialysis', 'Dialysis'),
  ('a0130000-0000-4000-8000-000000000126', 'a0130000-0000-4000-8000-000000000008', 'Cardiology', 'Cardiology'),
  ('a0130000-0000-4000-8000-000000000127', 'a0130000-0000-4000-8000-000000000008', 'Cardiothoracic Surgery', 'Cardiothoracic Surgery'),
  ('a0130000-0000-4000-8000-000000000128', 'a0130000-0000-4000-8000-000000000009', 'Pulmonology', 'Pulmonology'),
  ('a0130000-0000-4000-8000-000000000129', 'a0130000-0000-4000-8000-000000000009', 'Thoracic Surgery', 'Thoracic Surgery'),
  ('a0130000-0000-4000-8000-000000000130', 'a0130000-0000-4000-8000-000000000010', 'General Practice', 'General Practice'),
  ('a0130000-0000-4000-8000-000000000131', 'a0130000-0000-4000-8000-000000000012', 'Dentistry', 'Dentistry')
on conflict (id) do nothing;

-- Providers: ALL fictional demo entries (license numbers prefixed DEMO-).
insert into public.healthcare_providers (
  id, facility_id, department_id, full_name, specialty, qualifications, license_number
) values
  ('a0130000-0000-4000-8000-000000000201', 'a0130000-0000-4000-8000-000000000001', 'a0130000-0000-4000-8000-000000000101', 'Dr. Ramon dela Cruz', 'Emergency Medicine', 'MD, FPCEP', 'DEMO-000001'),
  ('a0130000-0000-4000-8000-000000000202', 'a0130000-0000-4000-8000-000000000001', 'a0130000-0000-4000-8000-000000000101', 'Dr. Liza Manansala', 'Emergency Medicine', 'MD', 'DEMO-000002'),
  ('a0130000-0000-4000-8000-000000000203', 'a0130000-0000-4000-8000-000000000001', 'a0130000-0000-4000-8000-000000000102', 'Dr. Carlos Villanueva', 'Internal Medicine', 'MD, FPCP', 'DEMO-000003'),
  ('a0130000-0000-4000-8000-000000000204', 'a0130000-0000-4000-8000-000000000001', 'a0130000-0000-4000-8000-000000000102', 'Dr. Andrea Ramos', 'Internal Medicine', 'MD', 'DEMO-000004'),
  ('a0130000-0000-4000-8000-000000000205', 'a0130000-0000-4000-8000-000000000001', 'a0130000-0000-4000-8000-000000000103', 'Dr. Maria Santos', 'Pediatrics', 'MD, FPPA', 'DEMO-000005'),
  ('a0130000-0000-4000-8000-000000000206', 'a0130000-0000-4000-8000-000000000001', 'a0130000-0000-4000-8000-000000000103', 'Dr. Kevin Tan', 'Pediatrics', 'MD', 'DEMO-000006'),
  ('a0130000-0000-4000-8000-000000000207', 'a0130000-0000-4000-8000-000000000001', 'a0130000-0000-4000-8000-000000000104', 'Dr. Grace Lim', 'Obstetrics & Gynecology', 'MD, FPOGS', 'DEMO-000007'),
  ('a0130000-0000-4000-8000-000000000208', 'a0130000-0000-4000-8000-000000000001', 'a0130000-0000-4000-8000-000000000104', 'Dr. Michelle Aquino', 'Obstetrics & Gynecology', 'MD', 'DEMO-000008'),
  ('a0130000-0000-4000-8000-000000000209', 'a0130000-0000-4000-8000-000000000001', 'a0130000-0000-4000-8000-000000000105', 'Dr. Antonio Reyes', 'General Surgery', 'MD, FPCS', 'DEMO-000009'),
  ('a0130000-0000-4000-8000-000000000210', 'a0130000-0000-4000-8000-000000000001', 'a0130000-0000-4000-8000-000000000105', 'Dr. Patrick Uy', 'General Surgery', 'MD', 'DEMO-000010'),
  ('a0130000-0000-4000-8000-000000000211', 'a0130000-0000-4000-8000-000000000002', 'a0130000-0000-4000-8000-000000000106', 'Dr. Eduardo Navarro', 'Cardiology', 'MD, FPCC', 'DEMO-000011'),
  ('a0130000-0000-4000-8000-000000000212', 'a0130000-0000-4000-8000-000000000002', 'a0130000-0000-4000-8000-000000000106', 'Dr. Sofia Bautista', 'Cardiology', 'MD', 'DEMO-000012'),
  ('a0130000-0000-4000-8000-000000000213', 'a0130000-0000-4000-8000-000000000002', 'a0130000-0000-4000-8000-000000000107', 'Dr. Hannah Francisco', 'Oncology', 'MD', 'DEMO-000013'),
  ('a0130000-0000-4000-8000-000000000214', 'a0130000-0000-4000-8000-000000000002', 'a0130000-0000-4000-8000-000000000108', 'Dr. Miguel Ocampo', 'Orthopedics', 'MD, FPOS', 'DEMO-000014'),
  ('a0130000-0000-4000-8000-000000000215', 'a0130000-0000-4000-8000-000000000002', 'a0130000-0000-4000-8000-000000000109', 'Dr. Jasmine Cruz', 'Pediatrics', 'MD', 'DEMO-000015'),
  ('a0130000-0000-4000-8000-000000000216', 'a0130000-0000-4000-8000-000000000003', 'a0130000-0000-4000-8000-000000000111', 'Dr. Victor Salazar', 'Cardiology', 'MD, FPCC', 'DEMO-000016'),
  ('a0130000-0000-4000-8000-000000000217', 'a0130000-0000-4000-8000-000000000003', 'a0130000-0000-4000-8000-000000000112', 'Dr. Katrina Mendoza', 'Neurology', 'MD', 'DEMO-000017'),
  ('a0130000-0000-4000-8000-000000000218', 'a0130000-0000-4000-8000-000000000003', 'a0130000-0000-4000-8000-000000000113', 'Dr. Rafael Garcia', 'Oncology', 'MD', 'DEMO-000018'),
  ('a0130000-0000-4000-8000-000000000219', 'a0130000-0000-4000-8000-000000000003', 'a0130000-0000-4000-8000-000000000114', 'Dr. Adrian Torres', 'Urology', 'MD, FPUA', 'DEMO-000019'),
  ('a0130000-0000-4000-8000-000000000220', 'a0130000-0000-4000-8000-000000000004', 'a0130000-0000-4000-8000-000000000116', 'Dr. Patricia Villanueva', 'Dermatology', 'MD, FPDS', 'DEMO-000020'),
  ('a0130000-0000-4000-8000-000000000221', 'a0130000-0000-4000-8000-000000000004', 'a0130000-0000-4000-8000-000000000117', 'Dr. Luis Domingo', 'Ear, Nose & Throat', 'MD', 'DEMO-000021'),
  ('a0130000-0000-4000-8000-000000000222', 'a0130000-0000-4000-8000-000000000004', 'a0130000-0000-4000-8000-000000000118', 'Dr. Camille Reyes', 'Ophthalmology', 'MD, FPOS', 'DEMO-000022'),
  ('a0130000-0000-4000-8000-000000000223', 'a0130000-0000-4000-8000-000000000007', 'a0130000-0000-4000-8000-000000000123', 'Dr. Noel Ramirez', 'Nephrology', 'MD, PSN', 'DEMO-000023'),
  ('a0130000-0000-4000-8000-000000000224', 'a0130000-0000-4000-8000-000000000007', 'a0130000-0000-4000-8000-000000000124', 'Dr. Bianca Santiago', 'Urology', 'MD', 'DEMO-000024'),
  ('a0130000-0000-4000-8000-000000000225', 'a0130000-0000-4000-8000-000000000007', 'a0130000-0000-4000-8000-000000000125', 'Dr. Arvin Delos Reyes', 'Dialysis', 'MD', 'DEMO-000025'),
  ('a0130000-0000-4000-8000-000000000226', 'a0130000-0000-4000-8000-000000000008', 'a0130000-0000-4000-8000-000000000126', 'Dr. Fernando Castillo', 'Cardiology', 'MD, FPCC', 'DEMO-000026'),
  ('a0130000-0000-4000-8000-000000000227', 'a0130000-0000-4000-8000-000000000008', 'a0130000-0000-4000-8000-000000000127', 'Dr. Judith Yap', 'Cardiothoracic Surgery', 'MD, FPCTS', 'DEMO-000027'),
  ('a0130000-0000-4000-8000-000000000228', 'a0130000-0000-4000-8000-000000000009', 'a0130000-0000-4000-8000-000000000128', 'Dr. Gerardo Pineda', 'Pulmonology', 'MD, FPCCP', 'DEMO-000028'),
  ('a0130000-0000-4000-8000-000000000229', 'a0130000-0000-4000-8000-000000000009', 'a0130000-0000-4000-8000-000000000129', 'Dr. Rosario Lim', 'Thoracic Surgery', 'MD', 'DEMO-000029'),
  ('a0130000-0000-4000-8000-000000000230', 'a0130000-0000-4000-8000-000000000010', 'a0130000-0000-4000-8000-000000000130', 'Dr. Samuel Cruz', 'General Practice', 'MD', 'DEMO-000030'),
  ('a0130000-0000-4000-8000-000000000231', 'a0130000-0000-4000-8000-000000000012', 'a0130000-0000-4000-8000-000000000131', 'Dr. Annabelle Santos', 'Dentistry', 'DMD', 'DEMO-000031')
on conflict (id) do nothing;

-- Seeding helper is demo-only - remove it so it never appears in the schema.
drop function if exists public._demo_weekly_hours;

-- ---------------------------------------------------------------------------
-- Example queries (docs for the next ticket that wires this into the app)
-- ---------------------------------------------------------------------------
-- All facilities:
--   select * from public.healthcare_facilities order by name;
-- Search by name/city:
--   select * from public.healthcare_facilities
--   where lower(name) like '%heart%' or lower(city) like '%quezon%';
-- Facilities near a point (haversine, km) - used by Find Facilities:
--   select f.*,
--     (6371 * acos(
--       least(1, cos(radians($lat)) * cos(radians(f.lat)) *
--             cos(radians(f.lng) - radians($lng)) +
--             sin(radians($lat)) * sin(radians(f.lat)))
--     )) as distance_km
--   from public.healthcare_facilities f
--   order by distance_km
--   limit 20;
-- Doctors at a facility (facility detail "Doctors" tab):
--   select p.*, d.name as department
--   from public.healthcare_providers p
--   left join public.healthcare_departments d on d.id = p.department_id
--   where p.facility_id = 'a0130000-0000-4000-8000-000000000001'
--     and p.is_active
--   order by p.full_name;
