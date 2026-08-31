UPDATE app_sessions SET school_id = (SELECT id FROM schools ORDER BY created_at LIMIT 1) WHERE school_id IS NULL;
ALTER TABLE app_sessions ALTER COLUMN school_id SET NOT NULL;
UPDATE analytics_events SET school_id = (SELECT id FROM schools ORDER BY created_at LIMIT 1) WHERE school_id IS NULL;
ALTER TABLE analytics_events ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE audit_logs ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE badges ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE hymn_practice_sessions ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE system_configs ALTER COLUMN school_id SET NOT NULL;
