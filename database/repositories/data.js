const { getDb } = require('../db');

function listDevices() {
  return getDb().prepare(`
    SELECT id, name, mqtt_topic, device_type, location, mqtt_intake_enabled, is_active
    FROM devices WHERE is_active = 1 ORDER BY name
  `).all();
}

function listThresholds() {
  return getDb().prepare('SELECT * FROM parameter_thresholds ORDER BY metric_key').all();
}

function listNotifications(userId, limit = 10) {
  return getDb().prepare(`
    SELECT id, title, message, is_read, created_at
    FROM notifications
    WHERE user_id = ? OR user_id IS NULL
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userId, limit);
}

function countActiveAlerts() {
  return getDb().prepare(`SELECT COUNT(*) AS c FROM alerts WHERE status = 'active'`).get().c;
}

function listAlerts() {
  return getDb().prepare(`
    SELECT a.*, d.name AS device_name
    FROM alerts a
    LEFT JOIN devices d ON d.id = a.device_id
    ORDER BY a.triggered_at DESC
  `).all();
}

function listHistoryLogs() {
  return getDb().prepare(`
    SELECT h.*, d.name AS device_name
    FROM history_logs h
    LEFT JOIN devices d ON d.id = h.device_id
    ORDER BY h.recorded_at DESC
    LIMIT 200
  `).all();
}

function insertHistoryLog({ deviceId = null, eventType, description, valueText = null, recordedAt = null }) {
  if (recordedAt) {
    return getDb().prepare(`
      INSERT INTO history_logs (device_id, event_type, description, value_text, recorded_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(deviceId, eventType, description, valueText, recordedAt);
  }
  return getDb().prepare(`
    INSERT INTO history_logs (device_id, event_type, description, value_text, recorded_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(deviceId, eventType, description, valueText);
}

function getLatestReading(deviceId) {
  if (deviceId) {
    return getDb().prepare(`
      SELECT sr.*, d.name AS device_name, d.mqtt_topic
      FROM sensor_readings sr
      JOIN devices d ON d.id = sr.device_id
      WHERE sr.device_id = ?
      ORDER BY sr.recorded_at DESC LIMIT 1
    `).get(deviceId);
  }
  return getDb().prepare(`
    SELECT sr.*, d.name AS device_name, d.mqtt_topic
    FROM sensor_readings sr
    JOIN devices d ON d.id = sr.device_id
    ORDER BY sr.recorded_at DESC LIMIT 1
  `).get();
}

function listReadings(deviceId, limit = 100) {
  return getDb().prepare(`
    SELECT sr.*, d.name AS device_name
    FROM sensor_readings sr
    JOIN devices d ON d.id = sr.device_id
    WHERE sr.device_id = ?
    ORDER BY sr.recorded_at DESC
    LIMIT ?
  `).all(deviceId, limit);
}

function listAllReadings(limit = 200) {
  return getDb().prepare(`
    SELECT sr.*, d.name AS device_name, d.mqtt_topic
    FROM sensor_readings sr
    JOIN devices d ON d.id = sr.device_id
    ORDER BY sr.recorded_at DESC
    LIMIT ?
  `).all(limit);
}

function listConsumptionDaily(deviceId, limit = 30) {
  return getDb().prepare(`
    SELECT reading_date, total_liters, peak_flow_lpm
    FROM consumption_daily
    WHERE device_id = ?
    ORDER BY reading_date DESC
    LIMIT ?
  `).all(deviceId, limit);
}

function getReadingNearTime(deviceId, triggeredAt) {
  return getDb().prepare(`
    SELECT sr.*, d.name AS device_name
    FROM sensor_readings sr
    JOIN devices d ON d.id = sr.device_id
    WHERE sr.device_id = ?
    ORDER BY ABS(strftime('%s', sr.recorded_at) - strftime('%s', ?))
    LIMIT 1
  `).get(deviceId, triggeredAt);
}

function listReports(limit = 20) {
  return getDb().prepare(`
    SELECT r.id, r.title, r.body_html, r.created_at, u.full_name AS author_name
    FROM reports r
    JOIN users u ON u.id = r.created_by
    ORDER BY r.created_at DESC
    LIMIT ?
  `).all(limit);
}

module.exports = {
  listDevices,
  listThresholds,
  listNotifications,
  countActiveAlerts,
  listAlerts,
  listHistoryLogs,
  insertHistoryLog,
  getLatestReading,
  listReadings,
  listAllReadings,
  listConsumptionDaily,
  getReadingNearTime,
  listReports,
};
