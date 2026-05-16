function formatDisplayDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatShortTime(iso) {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatScanTimestamp(iso) {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  if (isToday) return `Today ${time}`;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

function toIso(iso) {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? iso : d.toISOString();
}

module.exports = {
  formatDisplayDate,
  formatShortTime,
  formatScanTimestamp,
  toIso,
};
