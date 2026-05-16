const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const { DB_PATH, initDatabase } = require('./database/db');
const { requireAuth, attachUser } = require('./middleware/auth');
const registerAuth = require('./routes/auth');
const usersRouter = require('./routes/users');
const apiRouter = require('./routes/api');
const { loadPageData } = require('./services/pageData');
const { startSensorIngestScheduler, FIVE_MINUTES_MS } = require('./services/sensorIngest');

const app = express();

if (!fs.existsSync(DB_PATH)) {
  console.warn('Database not found. Run: npm run db:init');
} else {
  initDatabase({ seed: false });
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'etubig-dev-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

app.use(attachUser);

registerAuth(app);

const protectedPages = [
  ['/dashboard', 'dashboard'],
  ['/monitoring', 'realtime-monitoring'],
  ['/water-quality', 'water-quality'],
  ['/consumption', 'consumption'],
  ['/alerts', 'alerts'],
  ['/history', 'history'],
  ['/reports', 'reports'],
];

protectedPages.forEach(([route, view]) => {
  app.get(route, requireAuth, (req, res) => {
    let etubig = {};
    try {
      if (fs.existsSync(DB_PATH)) {
        etubig = loadPageData(view, req.session.user);
      }
    } catch (err) {
      console.error(`Failed to load data for ${view}:`, err.message);
    }
    res.render(view, { etubig });
  });
});

app.use('/users', usersRouter);
app.use('/api', apiRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`E-Tubig running at http://localhost:${PORT}`);

  if (fs.existsSync(DB_PATH) && process.env.SENSOR_INGEST !== '0') {
    const intervalMs = Number(process.env.INGEST_INTERVAL_MS) || FIVE_MINUTES_MS;
    startSensorIngestScheduler(intervalMs);
  }
});
