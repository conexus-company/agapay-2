-- Digital Health Identity & Consent-Based Data Reuse
-- Run against Supabase via CLI or dashboard

CREATE TABLE IF NOT EXISTS digital_health_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  qr_secret TEXT NOT NULL,
  is_revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  digital_health_id_id UUID NOT NULL REFERENCES digital_health_ids(id),
  transaction_type TEXT NOT NULL,
  facility_id TEXT,
  consented_fields JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_digital_health_ids_citizen_hash ON digital_health_ids(citizen_hash);
CREATE INDEX idx_consent_records_dhid ON consent_records(digital_health_id_id, status, expires_at);

ALTER TABLE digital_health_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

-- RLS: backend service role only (no direct client writes)
CREATE POLICY "service_role_all" ON digital_health_ids FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON consent_records FOR ALL USING (auth.role() = 'service_role');
