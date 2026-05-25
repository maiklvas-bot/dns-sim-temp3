CREATE TABLE IF NOT EXISTS simulation_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id INTEGER,
  participant_name TEXT NOT NULL,
  evaluator_account_id INTEGER,
  evaluator_name TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT 'medium',
  selected_case_ids_json TEXT NOT NULL DEFAULT '[]',
  enabled_channels_json TEXT NOT NULL DEFAULT '{}',
  manual_selection INTEGER NOT NULL DEFAULT 0,
  time_limit INTEGER NOT NULL DEFAULT 240,
  is_test_mode INTEGER NOT NULL DEFAULT 0,
  speed_multiplier INTEGER NOT NULL DEFAULT 1,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  technical_status TEXT NOT NULL DEFAULT 'in_progress',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS simulation_sessions_status_idx ON simulation_sessions(technical_status);
CREATE INDEX IF NOT EXISTS simulation_sessions_started_idx ON simulation_sessions(started_at);

CREATE TABLE IF NOT EXISTS session_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  case_title TEXT NOT NULL,
  cycle INTEGER NOT NULL DEFAULT 1,
  option_level INTEGER NOT NULL,
  option_text TEXT NOT NULL,
  score INTEGER NOT NULL,
  raw_effects_json TEXT NOT NULL DEFAULT '{}',
  competency_scores_json TEXT NOT NULL DEFAULT '{}',
  timestamp TEXT NOT NULL,
  sim_time TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS session_answers_session_idx ON session_answers(session_id);

CREATE TABLE IF NOT EXISTS session_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL UNIQUE,
  total_score INTEGER NOT NULL DEFAULT 0,
  average_score INTEGER NOT NULL DEFAULT 0,
  competency_averages_json TEXT NOT NULL DEFAULT '{}',
  final_metrics_json TEXT NOT NULL DEFAULT '{}',
  pauses_json TEXT NOT NULL DEFAULT '[]',
  exported_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS session_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  queue INTEGER NOT NULL DEFAULT 20,
  conversion INTEGER NOT NULL DEFAULT 50,
  morale INTEGER NOT NULL DEFAULT 60,
  revenue_impact INTEGER NOT NULL DEFAULT 0,
  delivery_status INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS session_metrics_session_idx ON session_metrics(session_id);

