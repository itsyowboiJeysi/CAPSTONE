#!/usr/bin/env node
/**
 * Initialize E-Tubig SQLite database.
 * Usage: node scripts/init-db.js [--fresh]
 *
 * Default admin:
 *   Email: admin@etubig.local
 *   Password: Admin@123
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { DB_PATH, initDatabase, closeDatabase, getDb } = require('../database/db');

const fresh = process.argv.includes('--fresh');

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* wait for file lock to release */
  }
}

function tryRemoveDatabaseFile() {
  if (!fs.existsSync(DB_PATH)) return true;

  closeDatabase();

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      fs.unlinkSync(DB_PATH);
      console.log('Removed existing database:', DB_PATH);
      return true;
    } catch (err) {
      if (err.code !== 'EBUSY' && err.code !== 'EPERM') throw err;
      if (attempt < 5) sleep(400);
    }
  }
  return false;
}

function wipeDatabaseInPlace(db) {
  const tables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
    .all()
    .map((row) => row.name);

  db.exec('PRAGMA foreign_keys = OFF');
  tables.forEach((name) => db.exec(`DROP TABLE IF EXISTS "${name}"`));
  db.exec('PRAGMA foreign_keys = ON');
  console.log('Cleared database tables in place (file was locked for delete).');
}

function seedUsersAndData(db) {
  const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123';
  const passwordHash = bcrypt.hashSync(defaultPassword, 10);

  const upsertUser = db.prepare(`
    INSERT INTO users (email, password_hash, full_name, role, is_active)
    VALUES (@email, @password_hash, @full_name, @role, @is_active)
    ON CONFLICT(email) DO UPDATE SET
      password_hash = excluded.password_hash,
      full_name = excluded.full_name,
      role = excluded.role,
      is_active = excluded.is_active,
      updated_at = datetime('now')
  `);

  [
    { email: 'admin@etubig.local', full_name: 'Admin User', role: 'admin', is_active: 1 },
    { email: 'operator@etubig.local', full_name: 'Field Operator', role: 'operator', is_active: 1 },
    { email: 'viewer@etubig.local', full_name: 'Report Viewer', role: 'viewer', is_active: 0 },
  ].forEach((user) => {
    upsertUser.run({ ...user, password_hash: passwordHash });
  });

  const seedPath = path.join(__dirname, '..', 'database', 'seed.sql');
  db.exec(fs.readFileSync(seedPath, 'utf8'));

  const insertReading = db.prepare(`
    INSERT INTO sensor_readings (
      device_id, recorded_at, ph, turbidity_ntu, temperature_c, ammonia_mg_l,
      flow_rate_lpm, peak_usage_liters, combined_status
    ) VALUES (?, datetime('now', ?), ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertDaily = db.prepare(`
    INSERT OR IGNORE INTO consumption_daily (device_id, reading_date, total_liters, peak_flow_lpm)
    VALUES (?, date('now', ?), ?, ?)
  `);

  for (let deviceId = 1; deviceId <= 3; deviceId += 1) {
    for (let h = 0; h < 24; h += 2) {
      const offset = `-${h + deviceId} hours`;
      insertReading.run(
        deviceId,
        offset,
        6.8 + deviceId * 0.15 + (h % 5) * 0.05,
        1.2 + (h % 4) * 0.3,
        21 + (h % 6),
        0.2 + (h % 3) * 0.05,
        10 + deviceId * 2 + (h % 8),
        400 + h * 12,
        h % 7 === 0 ? 'warning' : 'normal'
      );
    }
    for (let d = 0; d < 14; d += 1) {
      insertDaily.run(deviceId, `-${d} days`, 900 + d * 25 + deviceId * 40, 12 + (d % 5));
    }
  }

  return defaultPassword;
}

if (fresh) {
  const removed = tryRemoveDatabaseFile();
  if (!removed) {
    console.warn('\nCould not delete the database file (it is in use).');
    console.warn('Trying to wipe tables inside the existing file instead...\n');
    console.warn('If this fails, stop the app server first: press Ctrl+C in the terminal running "npm start",');
    console.warn('then run "npm run db:reset" again.\n');
    console.warn('Tip: OneDrive can also lock files under Desktop — pause sync if needed.\n');

    try {
      const db = getDb();
      wipeDatabaseInPlace(db);
      closeDatabase();
    } catch (err) {
      console.error('\nDatabase is locked. Stop the server and retry:\n');
      console.error('  1. In the terminal running the app, press Ctrl+C');
      console.error('  2. Run: npm run db:reset\n');
      process.exit(1);
    }
  }
}

initDatabase({ seed: false });

const db = getDb();
const defaultPassword = seedUsersAndData(db);

closeDatabase();

console.log('Database ready at:', DB_PATH);
console.log('Login: admin@etubig.local /', defaultPassword);
