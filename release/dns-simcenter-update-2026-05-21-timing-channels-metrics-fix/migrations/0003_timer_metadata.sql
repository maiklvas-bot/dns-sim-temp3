ALTER TABLE session_answers ADD COLUMN details_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE session_results ADD COLUMN timers_json TEXT NOT NULL DEFAULT '[]';
