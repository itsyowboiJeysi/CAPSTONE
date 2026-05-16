const { getDb } = require('../database/db');
const dataRepo = require('../database/repositories/data');

const FIVE_MINUTES_MS = 5 * 60 * 1000;

/** Per-device baseline offsets so each ESP reads slightly different */
const DEVICE_PROFILES = {
  default: { ph: 7.1, turbidity: 1.8, temperature: 23, ammonia: 0.28, flow: 12 },
  1: { ph: 7.2, turbidity: 2.0, temperature: 23, ammonia: 0.3, flow: 12.5 },
  2: { ph: 6.9, turbidity: 2.4, temperature: 24, ammonia: 0.35, flow: 9.8 },
  3: { ph: 7.4, turbidity: 0.9, temperature: 21, ammonia: 0.22, flow: 50 },
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, decimals = 2) {
  const p = 10 ** decimals;
  return Math.round(value * p) / p;
}

function drift(previous, baseline, spread, min, max) {
  const base = previous != null ? previous : baseline;
  const delta = (Math.random() - 0.5) * spread;
  return round(clamp(base + delta, min, max), 2);
}

function evaluateMetric(metricKey, value, thresholds) {
  const t = thresholds.find((x) => x.metric_key === metricKey);
  if (value == null || !t) return 'normal';
  if (t.min_safe != null && value < t.min_safe) return 'warning';
  if (t.max_safe != null && value > t.max_safe) return 'warning';
  return 'normal';
}

function combinedStatus(reading, thresholds) {
  const checks = [
    ['ph', reading.ph],
    ['turbidity', reading.turbidity_ntu],
    ['temperature', reading.temperature_c],
    ['ammonia', reading.ammonia_mg_l],
  ];
  const anyWarning = checks.some(([k, v]) => evaluateMetric(k, v, thresholds) === 'warning');
  return anyWarning ? 'warning' : 'normal';
}

function buildReading(deviceId, previous) {
  const profile = DEVICE_PROFILES[deviceId] || DEVICE_PROFILES.default;

  const ph = drift(previous?.ph, profile.ph, 0.25, 5.5, 9.5);
  const turbidity = drift(previous?.turbidity_ntu, profile.turbidity, 0.4, 0.2, 8);
  const temperature = drift(previous?.temperature_c, profile.temperature, 1.2, 18, 35);
  const ammonia = drift(previous?.ammonia_mg_l, profile.ammonia, 0.08, 0.05, 1.2);
  const flow = drift(previous?.flow_rate_lpm, profile.flow, 4, 2, 65);

  const reading = {
    device_id: deviceId,
    recorded_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    ph,
    turbidity_ntu: turbidity,
    temperature_c: temperature,
    ammonia_mg_l: ammonia,
    flow_rate_lpm: flow,
    peak_usage_liters: round(flow * 5 + Math.random() * 5, 1),
  };

  return reading;
}

function insertReading(db, reading, thresholds) {
  const status = combinedStatus(reading, thresholds);

  const result = db.prepare(`
    INSERT INTO sensor_readings (
      device_id, recorded_at, ph, turbidity_ntu, temperature_c, ammonia_mg_l,
      flow_rate_lpm, peak_usage_liters, combined_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    reading.device_id,
    reading.recorded_at,
    reading.ph,
    reading.turbidity_ntu,
    reading.temperature_c,
    reading.ammonia_mg_l,
    reading.flow_rate_lpm,
    reading.peak_usage_liters,
    status
  );

  return { id: result.lastInsertRowid, status, reading };
}

function updateConsumptionDaily(db, deviceId, flowLpm) {
  const litersThisInterval = flowLpm * 5;
  const today = new Date().toISOString().slice(0, 10);

  const existing = db.prepare(`
    SELECT id, total_liters, peak_flow_lpm FROM consumption_daily
    WHERE device_id = ? AND reading_date = date(?)
  `).get(deviceId, today);

  if (existing) {
    const newTotal = round((existing.total_liters || 0) + litersThisInterval, 1);
    const newPeak = Math.max(existing.peak_flow_lpm || 0, flowLpm);
    db.prepare(`
      UPDATE consumption_daily
      SET total_liters = ?, peak_flow_lpm = ?
      WHERE id = ?
    `).run(newTotal, newPeak, existing.id);
    return;
  }

  db.prepare(`
    INSERT INTO consumption_daily (device_id, reading_date, total_liters, peak_flow_lpm)
    VALUES (?, date(?), ?, ?)
  `).run(deviceId, today, round(litersThisInterval, 1), flowLpm);
}

function maybeCreateAlert(db, device, inserted, thresholds) {
  const issues = [];

  const phState = evaluateMetric('ph', inserted.reading.ph, thresholds);
  if (phState === 'warning') {
    issues.push({
      metric_key: 'ph',
      title: 'pH Level Out of Range',
      description: `Value: ${inserted.reading.ph} pH on ${device.name}`,
    });
  }

  const turbState = evaluateMetric('turbidity', inserted.reading.turbidity_ntu, thresholds);
  if (turbState === 'warning') {
    issues.push({
      metric_key: 'turbidity',
      title: 'High Turbidity Detected',
      description: `Value: ${inserted.reading.turbidity_ntu} NTU on ${device.name}`,
    });
  }

  const tempState = evaluateMetric('temperature', inserted.reading.temperature_c, thresholds);
  if (tempState === 'warning') {
    issues.push({
      metric_key: 'temperature',
      title: 'Temperature Out of Range',
      description: `Value: ${inserted.reading.temperature_c} C on ${device.name}`,
    });
  }

  const ammoniaState = evaluateMetric('ammonia', inserted.reading.ammonia_mg_l, thresholds);
  if (ammoniaState === 'warning') {
    issues.push({
      metric_key: 'ammonia',
      title: 'Ammonia Level Elevated',
      description: `Value: ${inserted.reading.ammonia_mg_l} mg/L on ${device.name}`,
    });
  }

  issues.forEach((issue) => {
    const recent = db.prepare(`
      SELECT id FROM alerts
      WHERE device_id = ? AND metric_key = ? AND status = 'active'
        AND triggered_at > datetime('now', '-30 minutes')
      LIMIT 1
    `).get(device.id, issue.metric_key);

    if (recent) return;

    db.prepare(`
      INSERT INTO alerts (device_id, reading_id, title, description, metric_key, status, triggered_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?)
    `).run(
      device.id,
      inserted.id,
      issue.title,
      issue.description,
      issue.metric_key,
      inserted.reading.recorded_at
    );

    db.prepare(`
      INSERT INTO history_logs (device_id, event_type, description, value_text, recorded_at)
      VALUES (?, 'STATUS CHANGE', ?, ?, ?)
    `).run(
      device.id,
      issue.title,
      issue.description,
      inserted.reading.recorded_at
    );
  });
}

/**
 * Insert one reading per active device (simulates MQTT / IoT push every 5 minutes).
 */
function ingestSensorBatch() {
  const db = getDb();
  const devices = dataRepo.listDevices();
  const thresholds = dataRepo.listThresholds();

  if (!devices.length) {
    return { ok: false, message: 'No active devices', inserted: 0 };
  }

  const insertedRows = [];

  devices.forEach((device) => {
    const previous = dataRepo.getLatestReading(device.id);
    const reading = buildReading(device.id, previous);
    const inserted = insertReading(db, reading, thresholds);

    updateConsumptionDaily(db, device.id, reading.flow_rate_lpm);
    maybeCreateAlert(db, device, inserted, thresholds);

    insertedRows.push({
      deviceId: device.id,
      deviceName: device.name,
      readingId: inserted.id,
      status: inserted.status,
      ph: reading.ph,
      flow: reading.flow_rate_lpm,
      recordedAt: reading.recorded_at,
    });
  });

  return { ok: true, inserted: insertedRows.length, readings: insertedRows };
}

let schedulerTimer = null;

function startSensorIngestScheduler(intervalMs = FIVE_MINUTES_MS) {
  if (schedulerTimer) return schedulerTimer;

  const run = () => {
    try {
      const result = ingestSensorBatch();
      if (result.ok) {
        console.log(
          `[sensor-ingest] ${result.inserted} reading(s) saved at ${new Date().toLocaleTimeString()}`
        );
      }
    } catch (err) {
      console.error('[sensor-ingest] failed:', err.message);
    }
  };

  run();
  schedulerTimer = setInterval(run, intervalMs);
  console.log(`[sensor-ingest] scheduled every ${intervalMs / 60000} minute(s)`);
  return schedulerTimer;
}

function stopSensorIngestScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

module.exports = {
  FIVE_MINUTES_MS,
  ingestSensorBatch,
  startSensorIngestScheduler,
  stopSensorIngestScheduler,
};
