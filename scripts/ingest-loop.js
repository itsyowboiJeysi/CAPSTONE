#!/usr/bin/env node
/**
 * Standalone IoT simulator: inserts water quality + flow readings every 5 minutes.
 * Usage: node scripts/ingest-loop.js
 * Env: INGEST_INTERVAL_MS=300000 (default 5 min)
 */
const path = require('fs');
const { DB_PATH, initDatabase } = require('../database/db');
const {
  FIVE_MINUTES_MS,
  startSensorIngestScheduler,
} = require('../services/sensorIngest');

if (!fs.existsSync(DB_PATH)) {
  console.error('Database not found. Run: npm run db:init');
  process.exit(1);
}

initDatabase({ seed: false });

const intervalMs = Number(process.env.INGEST_INTERVAL_MS) || FIVE_MINUTES_MS;
console.log('E-Tubig sensor ingest running. Press Ctrl+C to stop.');
startSensorIngestScheduler(intervalMs);

process.on('SIGINT', () => {
  console.log('\nStopped sensor ingest.');
  process.exit(0);
});
