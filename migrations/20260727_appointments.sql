CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT NOT NULL UNIQUE,
  citizen_hash TEXT NOT NULL,
  facility_id TEXT NOT NULL,
  service_type TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  consented_fields JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_appointments_reference ON appointments(reference_number);
CREATE INDEX idx_appointments_citizen ON appointments(citizen_hash, status);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON appointments FOR ALL USING (auth.role() = 'service_role');
