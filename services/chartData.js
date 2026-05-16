const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS7 = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function padSeries(values, targetLen, fillValue) {
  const out = [...values];
  const last = out.length ? out[out.length - 1] : fillValue;
  while (out.length < targetLen) out.unshift(last);
  return out.slice(-targetLen);
}

function parseRecordedAt(iso) {
  return new Date(String(iso).replace(' ', 'T'));
}

function readingsInWindow(readings, hoursBack) {
  const cutoff = Date.now() - hoursBack * 60 * 60 * 1000;
  return readings
    .filter((r) => parseRecordedAt(r.recorded_at).getTime() >= cutoff)
    .sort((a, b) => parseRecordedAt(a.recorded_at) - parseRecordedAt(b.recorded_at));
}

function flowSeriesFromReadings(readings, maxPoints = 24) {
  const sorted = [...readings].sort(
    (a, b) => parseRecordedAt(a.recorded_at) - parseRecordedAt(b.recorded_at)
  );
  const step = Math.max(1, Math.ceil(sorted.length / maxPoints));
  const sampled = sorted.filter((_, i) => i % step === 0 || i === sorted.length - 1);

  const labels = sampled.map((r) =>
    parseRecordedAt(r.recorded_at).toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  );
  const flow = sampled.map((r) => Number(r.flow_rate_lpm) || 0);
  const liters = sampled.map((r) => Number(r.peak_usage_liters) || Number(r.flow_rate_lpm) * 5 || 0);

  return { labels, flow, liters };
}

function periodBlock(labels, seriesArrays) {
  return {
    labels,
    datasets: seriesArrays,
    d: seriesArrays,
    data: seriesArrays,
  };
}

/** Short-term charts: flow rate (L/min) from sensor_readings */
function buildFlowMainData(readings) {
  const fallback = 12;
  const windows = {
    '1h': readingsInWindow(readings, 1),
    '5h': readingsInWindow(readings, 5),
    '8h': readingsInWindow(readings, 8),
    '12h': readingsInWindow(readings, 12),
    '30m': readingsInWindow(readings, 0.5),
  };

  const result = {};
  Object.entries(windows).forEach(([key, windowReadings]) => {
    const src = windowReadings.length ? windowReadings : readings.slice(0, 24);
    const { labels, flow } = flowSeriesFromReadings(src, key === '1h' ? 12 : 18);
    const lastFlow = flow[flow.length - 1] || fallback;
    result[key] = periodBlock(
      labels.length ? labels : Array.from({ length: 8 }, (_, i) => `${i * 5}m`),
      [flow.length ? flow : padSeries([], 8, lastFlow)]
    );
  });
  return result;
}

function buildFlowPeriodData(readings, periodKeys) {
  const fallback = 12;
  const sorted = [...readings].sort(
    (a, b) => parseRecordedAt(a.recorded_at) - parseRecordedAt(b.recorded_at)
  );

  const result = {};
  periodKeys.forEach((key) => {
    const hours = { '30m': 0.5, '1h': 1, '3h': 3, '8h': 8, '30m-live': 0.5 }[key] ?? 1;
    const windowReadings = hours
      ? readingsInWindow(sorted, hours)
      : sorted;
    const src = windowReadings.length ? windowReadings : sorted.slice(-24);
    const { labels, flow } = flowSeriesFromReadings(src, 20);
    const lastFlow = flow[flow.length - 1] || fallback;
    result[key] = periodBlock(
      labels.length ? labels : ['—'],
      [
        flow.length ? flow : padSeries([], 12, lastFlow),
        padSeries(
          flow.length ? flow.map((v) => v * 0.85) : [],
          flow.length || 12,
          lastFlow * 0.85
        ),
      ]
    );
  });
  return result;
}

function readingsToSeries(readings, fields) {
  const sorted = [...readings].sort(
    (a, b) => parseRecordedAt(a.recorded_at) - parseRecordedAt(b.recorded_at)
  );
  const labels = sorted.map((r) =>
    parseRecordedAt(r.recorded_at).toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  );
  const datasets = fields.map((field) =>
    sorted.map((r) => Number(r[field]) || 0)
  );
  return { labels, datasets };
}

function buildFromReadings(readings, periods) {
  const sorted = [...readings].sort(
    (a, b) => parseRecordedAt(a.recorded_at) - parseRecordedAt(b.recorded_at)
  );
  const base = readingsToSeries(sorted, ['ph', 'turbidity_ntu', 'temperature_c']);
  const fallback = base.datasets[0]?.[0] || 100;

  const result = {};
  periods.forEach((key) => {
    const len = key === '30m' ? 12 : key === '7d' ? 7 : key === '30d' ? 14 : 6;
    const series = base.datasets.map((ds) => padSeries(ds, len, fallback));
    result[key] = periodBlock(
      padSeries(base.labels, len, '').map((_, idx) =>
        key === '7d' ? DAYS7[idx % 7] : key === '30d' ? `D${idx + 1}` : `${idx * 5}m`
      ),
      series
    );
  });
  return result;
}

function buildConsumptionFromDaily(rows, periods) {
  const sorted = [...rows].sort((a, b) => a.reading_date.localeCompare(b.reading_date));
  const liters = sorted.map((r) => Number(r.total_liters) || 0);
  const peak = sorted.map((r) => Number(r.peak_flow_lpm) || 0);
  const labels = sorted.map((r) => {
    const d = new Date(`${r.reading_date}T12:00:00`);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
  });
  const fallbackL = liters[liters.length - 1] || 500;
  const fallbackP = peak[peak.length - 1] || 15;

  const result = {};
  periods.forEach((key) => {
    const len = key === '7d' ? 7 : key === '30d' ? 14 : key === '6m' ? 6 : 12;
    result[key] = periodBlock(
      padSeries(labels, len, '—'),
      [
        padSeries(liters, len, fallbackL),
        padSeries(peak, len, fallbackP),
        padSeries(liters.map((v) => Math.round(v * 0.4)), len, fallbackL * 0.4),
      ]
    );
  });
  return result;
}

/** Merge daily totals + recent flow for comparison chart slots */
function buildConsumptionCompData(readings, dailyRows) {
  const sortedDaily = [...dailyRows].sort((a, b) => a.reading_date.localeCompare(b.reading_date));
  const liters = sortedDaily.map((r) => Number(r.total_liters) || 0);
  const peak = sortedDaily.map((r) => Number(r.peak_flow_lpm) || 0);
  const dayLabels = sortedDaily.map((r) => {
    const d = new Date(`${r.reading_date}T12:00:00`);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
  });
  const fallbackL = liters[liters.length - 1] || 500;
  const fallbackP = peak[peak.length - 1] || 15;

  const recent = flowSeriesFromReadings(readings.slice(0, 48), 12);
  const flowLabels = recent.labels.length ? recent.labels : dayLabels;
  const flowVals = recent.flow.length ? recent.flow : padSeries(peak, 12, fallbackP);

  const compData = {};
  ['10am', '12nn', '2pm', '5pm'].forEach((slot, idx) => {
    const offset = idx;
    compData[slot] = periodBlock(
      dayLabels.length ? dayLabels : flowLabels,
      [
        padSeries(liters, 12, fallbackL),
        padSeries(peak, 12, fallbackP),
        padSeries(
          flowVals.map((v) => Math.round(v * (4 + offset))),
          flowVals.length || 12,
          fallbackP
        ),
      ]
    );
  });
  return compData;
}

function buildConsumptionMainComp(readings, dailyRows) {
  const fromDaily = buildConsumptionFromDaily(dailyRows, ['7d', '30d', '12m']);
  const mainData = {
    ...buildFlowMainData(readings),
    weekly: fromDaily['7d'],
    monthly: fromDaily['30d'],
    yearly: fromDaily['12m'],
  };
  return {
    mainData,
    compData: buildConsumptionCompData(readings, dailyRows),
  };
}

/** Dashboard consumption chart: daily liters + flow from readings */
function buildDashboardConsumptionData(readings, dailyRows) {
  const fromDaily = buildConsumptionFromDaily(dailyRows, ['12m', '6m', '30d', '7d']);
  const fromFlow = buildFlowMainData(readings);

  return {
    '12m': fromDaily['12m'],
    '6m': fromDaily['6m'],
    '30d': fromDaily['30d'],
    '7d': fromDaily['7d'],
    '1h': fromFlow['1h'],
    '5h': fromFlow['5h'],
  };
}

function pickDefaultConsumptionPeriod(data) {
  const order = ['7d', '30d', '6m', '12m', '1h', '5h'];
  for (const key of order) {
    const block = data[key];
    if (block?.datasets?.[0]?.length) return key;
  }
  return '7d';
}

module.exports = {
  MONTHS,
  DAYS7,
  readingsToSeries,
  buildFromReadings,
  buildFlowMainData,
  buildFlowPeriodData,
  buildConsumptionFromDaily,
  buildConsumptionMainComp,
  buildConsumptionCompData,
  buildDashboardConsumptionData,
  pickDefaultConsumptionPeriod,
  padSeries,
};
