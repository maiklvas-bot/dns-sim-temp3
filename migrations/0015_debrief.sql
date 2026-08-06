CREATE TABLE IF NOT EXISTS debriefs (
  id TEXT PRIMARY KEY,
  session_result_id INTEGER NOT NULL REFERENCES session_results(id) ON DELETE CASCADE,
  live_session_id TEXT,
  mode TEXT NOT NULL DEFAULT 'solo',
  status TEXT NOT NULL DEFAULT 'pending',
  conclusion TEXT,
  action_plan TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS debriefs_result_idx ON debriefs (session_result_id);

CREATE TABLE IF NOT EXISTS debrief_reviews (
  id TEXT PRIMARY KEY,
  debrief_id TEXT NOT NULL REFERENCES debriefs(id) ON DELETE CASCADE,
  answer_id INTEGER NOT NULL,
  question TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  assessor_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS debrief_reviews_debrief_idx ON debrief_reviews (debrief_id);

CREATE TABLE IF NOT EXISTS debrief_messages (
  id TEXT PRIMARY KEY,
  debrief_id TEXT NOT NULL REFERENCES debriefs(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS debrief_messages_debrief_idx ON debrief_messages (debrief_id);
