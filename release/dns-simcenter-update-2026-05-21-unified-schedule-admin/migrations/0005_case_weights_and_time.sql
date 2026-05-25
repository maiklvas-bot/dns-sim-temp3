ALTER TABLE simulation_settings ADD COLUMN case_weights_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE simulation_settings ADD COLUMN time_influence_enabled INTEGER NOT NULL DEFAULT 0;
