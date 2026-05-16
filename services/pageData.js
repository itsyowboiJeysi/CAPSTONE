const dataRepo = require('../database/repositories/data');
const {
  formatDisplayDate,
  formatScanTimestamp,
  toIso,
} = require('../utils/format');
const {
  buildFromReadings,
  buildFlowPeriodData,
  buildConsumptionMainComp,
  buildDashboardConsumptionData,
  pickDefaultConsumptionPeriod,
} = require('./chartData');

function evaluateMetric(key, value, thresholds) {
  const t = thresholds.find((x) => x.metric_key === key);
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
  if (checks.some(([k, v]) => evaluateMetric(k, v, thresholds) === 'warning')) {
    return reading.combined_status === 'critical' ? 'critical' : 'warning';
  }
  return reading.combined_status || 'normal';
}

function mapReadingMetrics(reading) {
  if (!reading) {
    return { ph: null, turbidity: null, temperature: null, ammonia: null, flow: null };
  }
  return {
    ph: reading.ph,
    turbidity: reading.turbidity_ntu,
    temperature: reading.temperature_c,
    ammonia: reading.ammonia_mg_l,
    flow: reading.flow_rate_lpm,
    peakUsage: reading.peak_usage_liters,
    combinedStatus: reading.combined_status,
  };
}

function buildScanHistory(readings, limit = 12) {
  return readings.slice(0, limit).map((r) => ({
    timestamp: formatScanTimestamp(r.recorded_at),
    source: r.device_name,
    ph: r.ph,
    turbidity: r.turbidity_ntu,
    temperature: r.temperature_c,
    flow: r.flow_rate_lpm,
    iso: toIso(r.recorded_at),
  }));
}

function buildReportsDeviceProfiles(devices) {
  const profiles = {};
  devices.forEach((device) => {
    const readings = dataRepo.listReadings(device.id, 50);
    profiles[device.name] = {
      history: readings.map((r) => {
        const activeAlerts = dataRepo.countActiveAlerts();
        return {
          iso: toIso(r.recorded_at),
          timestamp: formatDisplayDate(r.recorded_at),
          ph: `${r.ph ?? '—'} pH`,
          turbidity: `${r.turbidity_ntu ?? '—'} NTU`,
          temperature: `${r.temperature_c ?? '—'} C`,
          flow: `${r.flow_rate_lpm ?? '—'} L/min`,
          status: r.combined_status === 'normal' ? 'Normal' : 'Warning',
          alerts: `${activeAlerts} Active`,
        };
      }),
    };
  });
  return profiles;
}

function buildDeviceProfiles(devices, thresholds) {
  return devices.map((device) => {
    const readings = dataRepo.listReadings(device.id, 120);
    const latest = readings[0] || null;
    const daily = dataRepo.listConsumptionDaily(device.id, 30);
    const { mainData, compData } = buildConsumptionMainComp(readings, daily);

    return {
      id: device.id,
      name: device.name,
      topic: device.mqtt_topic,
      mqttIntakeEnabled: !!device.mqtt_intake_enabled,
      flowRate: latest?.flow_rate_lpm ?? 0,
      peakUsage: latest?.peak_usage_liters
        ? `${latest.peak_usage_liters} L`
        : '—',
      metrics: mapReadingMetrics(latest),
      periodData: buildFromReadings(readings, ['30m', '6m', '30d', '7d']),
      consumptionFlowData: buildFlowPeriodData(readings, ['30m', '1h', '3h', '8h']),
      mainData,
      compData,
    };
  });
}

function getShared(user) {
  const devices = dataRepo.listDevices();
  const thresholds = dataRepo.listThresholds();
  const notifications = dataRepo.listNotifications(user?.id, 8);
  const activeAlertCount = dataRepo.countActiveAlerts();
  const latestReading = dataRepo.getLatestReading();

  return {
    currentUser: user,
    devices,
    thresholds,
    notifications,
    activeAlertCount,
    latestReading: mapReadingMetrics(latestReading),
    latestReadingRaw: latestReading,
  };
}

function getDashboardPage(user) {
  const shared = getShared(user);
  const readings = dataRepo.listAllReadings(80);
  const primaryDevice = shared.devices[0];
  const deviceReadings = primaryDevice
    ? dataRepo.listReadings(primaryDevice.id, 120)
    : readings;
  const daily = primaryDevice
    ? dataRepo.listConsumptionDaily(primaryDevice.id, 30)
    : [];

  const latest = dataRepo.getLatestReading(primaryDevice?.id) || shared.latestReadingRaw;
  const metrics = mapReadingMetrics(latest);
  const potability =
    latest?.combined_status === 'critical'
      ? 'Unsafe'
      : latest?.combined_status === 'warning'
        ? 'Caution'
        : 'Safe to Use';

  const consumptionData = buildDashboardConsumptionData(deviceReadings, daily);

  return {
    ...shared,
    greetingName: user?.fullName?.split(' ')[0] || 'Admin',
    metrics,
    potability,
    consumptionData,
    defaultConsumptionPeriod: pickDefaultConsumptionPeriod(consumptionData),
    scanHistory: buildScanHistory(readings),
  };
}

function getAlertsPage(user) {
  const shared = getShared(user);
  const alerts = dataRepo.listAlerts().map((a) => {
    const snapshot = a.device_id
      ? dataRepo.getReadingNearTime(a.device_id, a.triggered_at)
      : null;
    return {
      id: a.id,
      title: a.title,
      description: a.description,
      status: a.status,
      triggeredAt: a.triggered_at,
      displayDate: formatDisplayDate(a.triggered_at),
      deviceName: a.device_name,
      snapshot: snapshot
        ? {
            pH: snapshot.ph,
            Turbidity: `${snapshot.turbidity_ntu} NTU`,
            Temperature: `${snapshot.temperature_c} C`,
            Ammonia: `${snapshot.ammonia_mg_l} mg/L`,
            Flow: `${snapshot.flow_rate_lpm} L/min`,
          }
        : { Description: a.description, Timestamp: formatDisplayDate(a.triggered_at) },
    };
  });

  const alertSnapshots = {};
  alerts.forEach((a) => {
    alertSnapshots[String(a.id)] = a.snapshot;
  });

  return { ...shared, alerts, alertSnapshots };
}

function getHistoryPage(user) {
  const shared = getShared(user);
  const logs = dataRepo.listHistoryLogs().map((h) => ({
    id: h.id,
    timestamp: formatDisplayDate(h.recorded_at),
    eventType: h.event_type,
    description: h.description,
    value: h.value_text || '',
    recordedAt: h.recorded_at,
    deviceName: h.device_name,
  }));

  return { ...shared, logs };
}

function getWaterQualityPage(user) {
  const shared = getShared(user);
  const deviceProfiles = buildDeviceProfiles(shared.devices, shared.thresholds);
  const readings = dataRepo.listAllReadings(80);

  return {
    ...shared,
    deviceProfiles,
    scanHistory: buildScanHistory(readings),
  };
}

function getMonitoringPage(user) {
  const shared = getShared(user);
  const deviceProfiles = buildDeviceProfiles(shared.devices, shared.thresholds);

  return { ...shared, deviceProfiles };
}

function getConsumptionPage(user) {
  const shared = getShared(user);
  const deviceProfiles = buildDeviceProfiles(shared.devices, shared.thresholds);

  return { ...shared, deviceProfiles };
}

function getReportsPage(user) {
  const shared = getShared(user);
  const deviceProfiles = buildReportsDeviceProfiles(shared.devices);
  const savedReports = dataRepo.listReports(10);

  return { ...shared, deviceProfiles, savedReports };
}

const PAGE_LOADERS = {
  dashboard: getDashboardPage,
  'realtime-monitoring': getMonitoringPage,
  'water-quality': getWaterQualityPage,
  consumption: getConsumptionPage,
  alerts: getAlertsPage,
  history: getHistoryPage,
  reports: getReportsPage,
};

function loadPageData(viewName, user) {
  const loader = PAGE_LOADERS[viewName];
  if (!loader) return getShared(user);
  return loader(user);
}

module.exports = {
  loadPageData,
  getShared,
};
