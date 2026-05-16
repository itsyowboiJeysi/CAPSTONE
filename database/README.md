# E-Tubig Database

SQLite database for users, IoT devices, sensor readings, alerts, history, and reports.

## Setup

```bash
npm install
npm run db:init
npm run wire:views   # optional: re-apply view DB bindings
npm start
```

### `EBUSY: resource busy or locked` on `npm run db:reset`

Something still has `database/etubig.db` open. Do this:

1. **Stop the app** – In the terminal running `npm start`, press **Ctrl+C**.
2. Run again: `npm run db:reset`
3. If it still fails, **pause OneDrive sync** (the project is under `OneDrive\Desktop`, which often locks files).
4. Close DB Browser / VS Code SQLite extensions if they have the file open.

The reset script will retry deleting the file, and if delete still fails it will try to **wipe tables inside the existing file** instead.

Reset and reseed:

```bash
npm run db:reset
```

## Default login

| Email | Password | Role |
|-------|----------|------|
| admin@etubig.local | Admin@123 | admin |
| operator@etubig.local | Admin@123 | operator |
| viewer@etubig.local | Admin@123 | viewer (inactive) |

## Tables

| Table | Purpose |
|-------|---------|
| `users` | Admin login, roles, account status |
| `devices` | ESP boards and MQTT topics |
| `sensor_readings` | pH, turbidity, temperature, ammonia, flow |
| `consumption_daily` | Daily water usage per device |
| `alerts` | Threshold warnings (active / resolved) |
| `history_logs` | System and status-change audit trail |
| `reports` | Saved report documents |
| `notifications` | In-app notifications per user |
| `parameter_thresholds` | Safe ranges for each metric |

## Automatic sensor data (every 5 minutes)

Simulates IoT devices sending water quality + flow readings:

- **With the app:** `npm start` runs ingest automatically (one batch on start, then every 5 min).
- **Standalone:** `npm run ingest` (only the ingest loop, no web UI).

Environment variables:

| Variable | Default | Meaning |
|----------|---------|---------|
| `SENSOR_INGEST` | on | Set to `0` to disable auto-ingest on `npm start` |
| `INGEST_INTERVAL_MS` | `300000` | Interval in ms (5 minutes) |

Manual trigger (logged in): `POST /api/ingest`

Each cycle inserts for every active device: pH, turbidity, temperature, ammonia, flow rate; updates daily consumption; may create alerts when thresholds are exceeded.

## API (requires login session)

- `GET /api/devices`
- `GET /api/alerts`
- `GET /api/readings/latest?device_id=1`
- `POST /api/ingest` — run one ingest cycle immediately
- `GET /api/history`

## User management

Admins can open **Manage Users** at `/users` to add, edit, and delete accounts.
