CREATE TABLE IF NOT EXISTS queue_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES appointments(id),
  facility_id TEXT NOT NULL,
  service_type TEXT NOT NULL,
  citizen_hash TEXT NOT NULL,
  queue_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  called_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_queue_tickets_facility ON queue_tickets(facility_id, status, created_at);
CREATE INDEX idx_queue_tickets_appointment ON queue_tickets(appointment_id);
CREATE UNIQUE INDEX idx_queue_tickets_daily_seq ON queue_tickets(facility_id, (checked_in_at::date), queue_number);

ALTER TABLE queue_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON queue_tickets FOR ALL USING (auth.role() = 'service_role');
