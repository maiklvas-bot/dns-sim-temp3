ALTER TABLE simulation_sessions ADD COLUMN participant_token_hash TEXT;

CREATE TABLE session_answers_new (
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
  details_json TEXT NOT NULL DEFAULT '{}',
  timestamp TEXT NOT NULL,
  sim_time TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES simulation_sessions(id) ON DELETE CASCADE
);

INSERT INTO session_answers_new (
  id,
  session_id,
  source_type,
  content_id,
  case_title,
  cycle,
  option_level,
  option_text,
  score,
  raw_effects_json,
  competency_scores_json,
  details_json,
  timestamp,
  sim_time
)
SELECT
  answer.id,
  answer.session_id,
  answer.source_type,
  answer.content_id,
  answer.case_title,
  answer.cycle,
  answer.option_level,
  answer.option_text,
  answer.score,
  answer.raw_effects_json,
  answer.competency_scores_json,
  answer.details_json,
  answer.timestamp,
  answer.sim_time
FROM session_answers AS answer
INNER JOIN simulation_sessions AS session ON session.id = answer.session_id;

DROP TABLE session_answers;
ALTER TABLE session_answers_new RENAME TO session_answers;
CREATE INDEX session_answers_session_idx ON session_answers(session_id);

CREATE TABLE session_results_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL UNIQUE,
  total_score INTEGER NOT NULL DEFAULT 0,
  average_score INTEGER NOT NULL DEFAULT 0,
  competency_averages_json TEXT NOT NULL DEFAULT '{}',
  final_metrics_json TEXT NOT NULL DEFAULT '{}',
  timers_json TEXT NOT NULL DEFAULT '[]',
  pauses_json TEXT NOT NULL DEFAULT '[]',
  exported_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(session_id) REFERENCES simulation_sessions(id) ON DELETE CASCADE
);

INSERT INTO session_results_new (
  id,
  session_id,
  total_score,
  average_score,
  competency_averages_json,
  final_metrics_json,
  timers_json,
  pauses_json,
  exported_at,
  created_at
)
SELECT
  result.id,
  result.session_id,
  result.total_score,
  result.average_score,
  result.competency_averages_json,
  result.final_metrics_json,
  result.timers_json,
  result.pauses_json,
  result.exported_at,
  result.created_at
FROM session_results AS result
INNER JOIN simulation_sessions AS session ON session.id = result.session_id;

DROP TABLE session_results;
ALTER TABLE session_results_new RENAME TO session_results;
CREATE UNIQUE INDEX session_results_session_idx ON session_results(session_id);

CREATE TABLE session_metrics_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  queue INTEGER NOT NULL DEFAULT 20,
  conversion INTEGER NOT NULL DEFAULT 50,
  morale INTEGER NOT NULL DEFAULT 60,
  revenue_impact INTEGER NOT NULL DEFAULT 0,
  delivery_status INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(session_id) REFERENCES simulation_sessions(id) ON DELETE CASCADE
);

INSERT INTO session_metrics_new (
  id,
  session_id,
  timestamp,
  queue,
  conversion,
  morale,
  revenue_impact,
  delivery_status
)
SELECT
  metric.id,
  metric.session_id,
  metric.timestamp,
  metric.queue,
  metric.conversion,
  metric.morale,
  metric.revenue_impact,
  metric.delivery_status
FROM session_metrics AS metric
INNER JOIN simulation_sessions AS session ON session.id = metric.session_id;

DROP TABLE session_metrics;
ALTER TABLE session_metrics_new RENAME TO session_metrics;
CREATE INDEX session_metrics_session_idx ON session_metrics(session_id);
