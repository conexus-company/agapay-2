CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_hash TEXT NOT NULL,
  push_token TEXT NOT NULL,
  platform TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS queue_notification_preferences (
  citizen_hash TEXT PRIMARY KEY,
  push_enabled BOOLEAN DEFAULT TRUE,
  in_app_enabled BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON device_tokens FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON queue_notification_preferences FOR ALL USING (auth.role() = 'service_role');
