-- Sample data (users are created in scripts/init-db.js with bcrypt hashes)

INSERT OR IGNORE INTO parameter_thresholds (metric_key, label, unit, min_safe, max_safe) VALUES
  ('ph', 'pH Level', 'pH', 6.8, 8.2),
  ('turbidity', 'Turbidity', 'NTU', NULL, 1.0),
  ('temperature', 'Temperature', 'C', 20, 28),
  ('ammonia', 'Ammonia', 'mg/L', NULL, 0.5);

INSERT OR IGNORE INTO devices (id, name, mqtt_topic, device_type, location) VALUES
  (1, 'ESP-32 Main Tank', 'etubig/main-tank/status', 'ESP32', 'Main reservoir'),
  (2, 'ESP-32 Zone B', 'etubig/zone-b/status', 'ESP32', 'Zone B distribution'),
  (3, 'ESP-8266 Intake', 'etubig/intake/status', 'ESP8266', 'Raw water intake');

INSERT OR IGNORE INTO sensor_readings (
  device_id, recorded_at, ph, turbidity_ntu, temperature_c, ammonia_mg_l,
  flow_rate_lpm, peak_usage_liters, combined_status
) VALUES
  (1, datetime('now', '-2 minutes'), 7.2, 2.1, 23, 0.3, 12.5, 480, 'normal'),
  (1, datetime('now', '-1 hour'), 7.0, 1.8, 22, 0.28, 11.2, 450, 'normal'),
  (2, datetime('now', '-5 minutes'), 6.9, 2.4, 24, 0.35, 9.8, 320, 'warning'),
  (3, datetime('now', '-10 minutes'), 7.4, 0.9, 21, 0.22, 50, 1200, 'normal');

INSERT OR IGNORE INTO consumption_daily (device_id, reading_date, total_liters, peak_flow_lpm) VALUES
  (1, date('now'), 1240, 18.5),
  (1, date('now', '-1 day'), 1180, 16.2),
  (2, date('now'), 890, 14.1);

INSERT OR IGNORE INTO alerts (device_id, title, description, metric_key, status, triggered_at) VALUES
  (1, 'High Turbidity Detected', 'Value: 6.8 NTU (Above safe limit)', 'turbidity', 'active', '2024-12-30 21:42:00'),
  (1, 'pH Level Out of Range', 'Value: 9.2 pH (Too alkaline)', 'ph', 'active', '2025-04-22 09:58:00'),
  (2, 'Temperature Spike Detected', 'Value: 42C', 'temperature', 'resolved', '2025-04-21 16:12:00');

INSERT OR IGNORE INTO history_logs (device_id, event_type, description, value_text, recorded_at) VALUES
  (1, 'STATUS CHANGE', 'Turbidity exceeded threshold', '6.8 NTU', '2024-12-30 21:42:00'),
  (NULL, 'SYSTEM', 'MQTT Disconnected', NULL, '2024-12-31 13:42:00'),
  (NULL, 'SYSTEM', 'MQTT Reconnected', NULL, '2024-12-31 16:42:00'),
  (1, 'STATUS CHANGE', 'Temperature above normal', '50 C', '2024-12-30 21:42:00');

INSERT OR IGNORE INTO notifications (user_id, title, message, is_read) VALUES
  (1, 'pH Warning', 'Reservoir 2 recorded pH 6.4 at 08:45 AM.', 0),
  (1, 'Flow Update', 'Main line flow increased by 12% this hour.', 0),
  (1, 'Reminder', 'Monthly compliance report is due today.', 0);

INSERT OR IGNORE INTO reports (created_by, title, body_html) VALUES
  (1, 'Weekly Water Quality Summary', '<p>All primary parameters within normal range for Main Tank.</p>');
