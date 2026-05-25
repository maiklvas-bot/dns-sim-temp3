CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS evaluator_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT UNIQUE,
  full_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS competencies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'image',
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  original_filename TEXT,
  size_bytes INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS simulation_cases (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  primary_competencies_json TEXT NOT NULL DEFAULT '[]',
  secondary_competencies_json TEXT NOT NULL DEFAULT '[]',
  zones_affected_json TEXT NOT NULL DEFAULT '[]',
  image_asset_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS simulation_cases_order_idx ON simulation_cases(sort_order);

CREATE TABLE IF NOT EXISTS case_cycles (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  cycle_number INTEGER NOT NULL,
  situation TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS case_cycles_case_cycle_idx ON case_cycles(case_id, cycle_number);

CREATE TABLE IF NOT EXISTS case_signals (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  cycle_id TEXT,
  signal_role TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  source TEXT,
  text TEXT,
  content TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS case_options (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  text TEXT NOT NULL,
  score INTEGER NOT NULL,
  effect_queue INTEGER NOT NULL DEFAULT 0,
  effect_conversion INTEGER NOT NULL DEFAULT 0,
  effect_morale INTEGER NOT NULL DEFAULT 0,
  effect_revenue_impact INTEGER NOT NULL DEFAULT 0,
  effect_delivery_status INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS case_options_cycle_level_idx ON case_options(cycle_id, level);

CREATE TABLE IF NOT EXISTS messenger_chats (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_group INTEGER NOT NULL DEFAULT 0,
  avatar TEXT NOT NULL,
  role TEXT,
  icon TEXT,
  members_json TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS channel_items (
  id TEXT PRIMARY KEY,
  channel_type TEXT NOT NULL,
  chat_id TEXT,
  is_group INTEGER,
  title TEXT NOT NULL,
  subject TEXT,
  sender_name TEXT NOT NULL,
  sender_role TEXT,
  sender_avatar TEXT,
  department TEXT,
  department_color TEXT,
  preview TEXT,
  body TEXT,
  duration TEXT,
  arrival_minute INTEGER NOT NULL DEFAULT 0,
  primary_competency TEXT NOT NULL,
  image_asset_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS channel_items_channel_order_idx ON channel_items(channel_type, sort_order);

CREATE TABLE IF NOT EXISTS channel_options (
  id TEXT PRIMARY KEY,
  channel_item_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  text TEXT NOT NULL,
  score INTEGER NOT NULL,
  effect_queue INTEGER NOT NULL DEFAULT 0,
  effect_conversion INTEGER NOT NULL DEFAULT 0,
  effect_morale INTEGER NOT NULL DEFAULT 0,
  effect_revenue_impact INTEGER NOT NULL DEFAULT 0,
  effect_delivery_status INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS channel_options_item_level_idx ON channel_options(channel_item_id, level);

CREATE TABLE IF NOT EXISTS scoring_rules (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_option_id TEXT NOT NULL,
  competency_id TEXT NOT NULL,
  score INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS scoring_rules_source_competency_idx
  ON scoring_rules(source_type, source_option_id, competency_id);

CREATE TABLE IF NOT EXISTS case_timings (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  arrival_minute INTEGER,
  min_interval_seconds INTEGER,
  max_interval_seconds INTEGER,
  reminder_interval_seconds INTEGER NOT NULL DEFAULT 3,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS case_timings_source_idx ON case_timings(source_type, source_id);

CREATE TABLE IF NOT EXISTS case_images (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS case_images_source_idx ON case_images(source_type, source_id, sort_order);

CREATE TABLE IF NOT EXISTS simulation_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_signal_min_seconds INTEGER NOT NULL DEFAULT 15,
  first_signal_max_seconds INTEGER NOT NULL DEFAULT 30,
  signal_interval_min_seconds INTEGER NOT NULL DEFAULT 120,
  signal_interval_max_seconds INTEGER NOT NULL DEFAULT 180,
  reminder_interval_seconds INTEGER NOT NULL DEFAULT 3,
  easy_auto_case_count INTEGER NOT NULL DEFAULT 6,
  medium_auto_case_count INTEGER NOT NULL DEFAULT 10,
  hard_auto_case_count INTEGER NOT NULL DEFAULT 14,
  default_time_per_case_minutes INTEGER NOT NULL DEFAULT 4,
  min_simulation_minutes INTEGER NOT NULL DEFAULT 20,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

