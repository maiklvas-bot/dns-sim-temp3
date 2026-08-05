ALTER TABLE simulation_cases ADD COLUMN correction_of_case_id TEXT;
ALTER TABLE simulation_cases ADD COLUMN corrections_json TEXT NOT NULL DEFAULT '[]';
