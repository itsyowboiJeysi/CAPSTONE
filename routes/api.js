const express = require('express');
const { getDb } = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const dataRepo = require('../database/repositories/data');
const { ingestSensorBatch } = require('../services/sensorIngest');
const auditLog = require('../services/auditLog');

const router = express.Router();

router.use(requireAuth);

router.get('/devices', (req, res) => {
  res.json(dataRepo.listDevices());
});

router.get('/alerts', (req, res) => {
  res.json(dataRepo.listAlerts());
});

router.delete('/alerts/:id', (req, res) => {
  const alertId = Number(req.params.id);
  getDb().prepare('DELETE FROM alerts WHERE id = ?').run(alertId);
  auditLog.logAlertDeleted(req.session.user, alertId);
  res.json({ ok: true });
});

router.post('/ingest', (req, res) => {
  try {
    const result = ingestSensorBatch();
    auditLog.logManualIngest(req.session.user, result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

router.get('/readings/latest', (req, res) => {
  const row = dataRepo.getLatestReading(req.query.device_id);
  res.json(row || null);
});

router.get('/history', (req, res) => {
  res.json(dataRepo.listHistoryLogs());
});

router.delete('/history/:id', (req, res) => {
  const logId = Number(req.params.id);
  getDb().prepare('DELETE FROM history_logs WHERE id = ?').run(logId);
  auditLog.logEvent({
    eventType: 'SYSTEM',
    description: 'History log entry deleted',
    valueText: `By ${req.session.user?.fullName || req.session.user?.email || 'user'} · log #${logId}`,
  });
  res.json({ ok: true });
});

module.exports = router;
