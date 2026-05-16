const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'etubig.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function runSqlFile(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  getDb().exec(sql);
}

function initDatabase({ seed = true } = {}) {
  const schemaPath = path.join(__dirname, 'schema.sql');
  runSqlFile(schemaPath);

  if (seed) {
    const seedPath = path.join(__dirname, 'seed.sql');
    if (fs.existsSync(seedPath)) {
      runSqlFile(seedPath);
    }
  }

  return getDb();
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  DB_PATH,
  getDb,
  initDatabase,
  closeDatabase,
};
