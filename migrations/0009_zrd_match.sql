CREATE TABLE zrd_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_json TEXT NOT NULL DEFAULT '{}',
  state_json TEXT NOT NULL DEFAULT '{}',
  state_version INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress',
  paused INTEGER NOT NULL DEFAULT 0,
  tick_deadline_at TEXT,
  evaluator_account_id INTEGER,
  evaluator_name TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX zrd_matches_status_idx ON zrd_matches(status);
CREATE INDEX zrd_matches_created_idx ON zrd_matches(created_at);

CREATE TABLE zrd_match_seats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL,
  seat_idx INTEGER NOT NULL,
  rrs_id TEXT NOT NULL,
  controller_kind TEXT NOT NULL DEFAULT 'off',
  ai_level INTEGER,
  participant_name TEXT,
  token_hash TEXT,
  access_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(match_id) REFERENCES zrd_matches(id) ON DELETE CASCADE
);

CREATE INDEX zrd_match_seats_match_idx ON zrd_match_seats(match_id);
CREATE UNIQUE INDEX zrd_match_seats_access_code_idx ON zrd_match_seats(access_code);
CREATE UNIQUE INDEX zrd_match_seats_seat_idx ON zrd_match_seats(match_id, seat_idx);

CREATE TABLE zrd_match_turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL,
  seat_idx INTEGER NOT NULL,
  seq INTEGER NOT NULL,
  tick INTEGER NOT NULL,
  intent_json TEXT NOT NULL DEFAULT '{}',
  log_type TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(match_id) REFERENCES zrd_matches(id) ON DELETE CASCADE
);

CREATE INDEX zrd_match_turns_match_idx ON zrd_match_turns(match_id);

CREATE TABLE zrd_match_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL,
  seat_idx INTEGER NOT NULL,
  tr INTEGER NOT NULL DEFAULT 0,
  is_winner INTEGER NOT NULL DEFAULT 0,
  kpi_json TEXT NOT NULL DEFAULT '{}',
  competencies_json TEXT NOT NULL DEFAULT '{}',
  outcome_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(match_id) REFERENCES zrd_matches(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX zrd_match_results_match_seat_idx ON zrd_match_results(match_id, seat_idx);
