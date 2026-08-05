ALTER TABLE simulation_cases ADD COLUMN business_problem TEXT;
ALTER TABLE simulation_cases ADD COLUMN hidden_cause TEXT;
ALTER TABLE simulation_cases ADD COLUMN data_points_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE simulation_cases ADD COLUMN false_trails_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE simulation_cases ADD COLUMN qa_status TEXT NOT NULL DEFAULT 'draft';

ALTER TABLE competencies ADD COLUMN facet_of_competency_id TEXT;
ALTER TABLE competencies ADD COLUMN is_stop_factor INTEGER NOT NULL DEFAULT 0;
