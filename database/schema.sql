-- E-Tubig SQLite schema
-- IoT water quality, consumption, alerts, users, and reports

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator'
    CHECK (role IN ('admin', 'operator', 'viewer')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  mqtt_topic TEXT NOT NULL UNIQUE,
  device_type TEXT,
  location TEXT,
  mqtt_intake_enabled INTEGER NOT NULL DEFAULT 1 CHECK (mqtt_intake_enabled IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS parameter_thresholds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  unit TEXT,
  min_safe REAL,
  max_safe REAL
);

CREATE TABLE IF NOT EXISTS sensor_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id INTEGER NOT NULL,
  recorded_at TEXT NOT NULL,
  ph REAL,
  turbidity_ntu REAL,
  temperature_c REAL,
  ammonia_mg_l REAL,
  flow_rate_lpm REAL,
  peak_usage_liters REAL,
  combined_status TEXT NOT NULL DEFAULT 'normal'
    CHECK (combined_status IN ('normal', 'warning', 'critical')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sensor_readings_device_time
  ON sensor_readings(device_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS consumption_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id INTEGER NOT NULL,
  reading_date TEXT NOT NULL,
  total_liters REAL NOT NULL DEFAULT 0,
  peak_flow_lpm REAL,
  UNIQUE (device_id, reading_date),
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id INTEGER,
  reading_id INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  metric_key TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'resolved')),
  triggered_at TEXT NOT NULL,
  resolved_at TEXT,
  resolved_by INTEGER,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL,
  FOREIGN KEY (reading_id) REFERENCES sensor_readings(id) ON DELETE SET NULL,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_alerts_status_time
  ON alerts(status, triggered_at DESC);

CREATE TABLE IF NOT EXISTS history_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id INTEGER,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  value_text TEXT,
  recorded_at TEXT NOT NULL,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_history_logs_time
  ON history_logs(recorded_at DESC);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_by INTEGER NOT NULL,
  title TEXT,
  body_html TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications(user_id, is_read, created_at DESC);
