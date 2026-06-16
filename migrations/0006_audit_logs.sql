CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  area TEXT NOT NULL,
  action TEXT NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'success',
  actor_id INTEGER,
  actor_username TEXT,
  actor_display_name TEXT,
  actor_role TEXT,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  entity_type TEXT,
  entity_id TEXT,
  summary TEXT NOT NULL,
  changed_fields_json TEXT NOT NULL DEFAULT '[]',
  before_json TEXT,
  after_json TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS audit_logs_area_idx ON audit_logs(area);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_logs_actor_username_idx ON audit_logs(actor_username);
CREATE INDEX IF NOT EXISTS audit_logs_ip_address_idx ON audit_logs(ip_address);
