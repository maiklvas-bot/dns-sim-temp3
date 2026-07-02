CREATE TABLE zrd_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_name TEXT NOT NULL DEFAULT 'Участник',
  participant_token_hash TEXT,
  evaluator_account_id INTEGER,
  evaluator_name TEXT NOT NULL DEFAULT '',
  difficulty INTEGER NOT NULL DEFAULT 3,
  region TEXT,
  seed INTEGER NOT NULL DEFAULT 0,
  quarters INTEGER NOT NULL DEFAULT 4,
  opponent TEXT NOT NULL DEFAULT 'ai',
  access_code TEXT,
  state_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'in_progress',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX zrd_sessions_status_idx ON zrd_sessions(status);
CREATE INDEX zrd_sessions_created_idx ON zrd_sessions(created_at);
CREATE INDEX zrd_sessions_access_code_idx ON zrd_sessions(access_code);

CREATE TABLE zrd_turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  seq INTEGER NOT NULL,
  quarter INTEGER NOT NULL,
  intent_json TEXT NOT NULL DEFAULT '{}',
  log_type TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(session_id) REFERENCES zrd_sessions(id) ON DELETE CASCADE
);

CREATE INDEX zrd_turns_session_idx ON zrd_turns(session_id);

CREATE TABLE zrd_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  tr INTEGER NOT NULL DEFAULT 0,
  ai_tr INTEGER NOT NULL DEFAULT 0,
  winner TEXT NOT NULL DEFAULT 'player',
  final_metrics_json TEXT NOT NULL DEFAULT '{}',
  competencies_json TEXT NOT NULL DEFAULT '{}',
  outcome_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(session_id) REFERENCES zrd_sessions(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX zrd_results_session_idx ON zrd_results(session_id);
