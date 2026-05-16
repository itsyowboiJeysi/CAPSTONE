/**
 * Patches EJS views to use ETUBIG database payload.
 * Run: node scripts/wire-views.js
 */
const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, '..', 'views');
const tailInclude = `<%- include('partials/etubig-data') %>\n<script src="/js/etubig-ui.js"></script>\n`;

function applyTopbar(content) {
  let out = content;
  out = out.replace(/<span class="badge badge-indigo">\d+<\/span>/g, '<span class="badge badge-indigo" data-etubig-alert-badge>0</span>');
  out = out.replace(/<span class="badge">\d+<\/span>/g, '<span class="badge" data-etubig-alert-badge>0</span>');
  out = out.replace(/<ul class="popover-list">[\s\S]*?<\/ul>/g, '<ul class="popover-list" data-etubig-notifications></ul>');
  out = out.split('<strong>Admin User</strong>').join('<strong data-etubig-user-name>Admin User</strong>');
  out = out.split('<span>admin@etubig.local</span>').join('<span data-etubig-user-email>admin@etubig.local</span>');
  out = out.split('<div class="avatar-chip">A</div>').join('<div class="avatar-chip" data-etubig-user-chip>A</div>');
  return out;
}

function injectTail(content) {
  if (content.includes('partials/etubig-data')) return content;
  return content.replace(/<script>\r?\n/, `${tailInclude}<script>\n`);
}

function patchCharts(file) {
  const filePath = path.join(viewsDir, file);
  let content = applyTopbar(fs.readFileSync(filePath, 'utf8'));
  content = content.replace(/const deviceProfiles = \[[\s\S]*?\n  \];/m, 'const deviceProfiles = ETUBIG.deviceProfiles || [];');
  content = content.replace(/const deviceProfiles = \{[\s\S]*?\n  \};/m, 'const deviceProfiles = ETUBIG.deviceProfiles || {};');
  content = content.replace(/const scanHistory = \[[\s\S]*?\n  \];/m, 'const scanHistory = ETUBIG.scanHistory || [];');
  content = content.replace(/const consumptionData = \{[\s\S]*?\n  \};/m, 'const consumptionData = ETUBIG.consumptionData || {};');
  content = injectTail(content);
  fs.writeFileSync(filePath, content);
  console.log('Patched', file);
}

['dashboard.ejs', 'realtime-monitoring.ejs', 'water-quality.ejs', 'consumption.ejs', 'reports.ejs', 'history.ejs'].forEach(patchCharts);

const alertsPath = path.join(viewsDir, 'alerts.ejs');
let alerts = fs.readFileSync(alertsPath, 'utf8');
alerts = alerts.replace(/<tbody id="alertsTableBody">[\s\S]*?<\/tbody>/, (block) => {
  if (!block.includes('etubig.alerts')) return block;
  const marker = '<% }); %>';
  const i = block.lastIndexOf(marker);
  return i === -1 ? block : `${block.slice(0, i + marker.length)}\n        </tbody>`;
});
alerts = applyTopbar(alerts);
alerts = injectTail(alerts);
fs.writeFileSync(alertsPath, alerts);
console.log('Patched alerts.ejs');

let dashboard = fs.readFileSync(path.join(viewsDir, 'dashboard.ejs'), 'utf8');
dashboard = dashboard.replace(/Hey Admin &nbsp;–&nbsp;/, 'Hey <%= etubig.greetingName %> &nbsp;–&nbsp;');
const metricReplacements = [
  [/<div class="metric-value">7\.2<span class="metric-unit">pH<\/span><\/div>/, '<div class="metric-value"><%= etubig.metrics.ph != null ? etubig.metrics.ph : "—" %><span class="metric-unit">pH</span></div>'],
  [/<div class="metric-value">2\.1<span class="metric-unit">NTU<\/span><\/div>/, '<div class="metric-value"><%= etubig.metrics.turbidity != null ? etubig.metrics.turbidity : "—" %><span class="metric-unit">NTU</span></div>'],
  [/<div class="metric-value">23<span class="metric-unit">°C<\/span><\/div>/, '<div class="metric-value"><%= etubig.metrics.temperature != null ? etubig.metrics.temperature : "—" %><span class="metric-unit">°C</span></div>'],
  [/<div class="metric-value">0\.3<span class="metric-unit">mg\/L<\/span><\/div>/, '<div class="metric-value"><%= etubig.metrics.ammonia != null ? etubig.metrics.ammonia : "—" %><span class="metric-unit">mg/L</span></div>'],
  [/<div class="potability-status">Safe to Use<\/div>/, '<div class="potability-status"><%= etubig.potability %></div>'],
  [/<div class="metric-value">50<span class="metric-unit">L\/min<\/span><\/div>/, '<div class="metric-value"><%= etubig.metrics.flow != null ? etubig.metrics.flow : "—" %><span class="metric-unit">L/min</span></div>'],
];
metricReplacements.forEach(([from, to]) => { dashboard = dashboard.replace(from, to); });
fs.writeFileSync(path.join(viewsDir, 'dashboard.ejs'), dashboard);
console.log('Patched dashboard metrics');

const historyPath = path.join(viewsDir, 'history.ejs');
let history = fs.readFileSync(historyPath, 'utf8');
if (!history.includes('etubig.logs')) {
  history = history.replace(/<tbody id="historyTableBody">[\s\S]*?<\/tbody>/, `        <tbody id="historyTableBody">
          <% (etubig.logs || []).forEach(function(log) { %>
          <tr data-log-id="<%= log.id %>">
            <td><%= log.timestamp %></td>
            <td><%= log.eventType %></td>
            <td><%= log.description %></td>
            <td><%= log.value %></td>
            <td><input type="checkbox" /></td>
            <td class="action-cell">
              <button type="button" class="action-btn" data-row-action>...</button>
              <div class="action-menu">
                <button type="button" class="action-item" data-action="delete">Delete record</button>
                <button type="button" class="action-item" data-action="pdf">Export to PDF</button>
                <button type="button" class="action-item" data-action="time-data">View data at this time</button>
              </div>
            </td>
          </tr>
          <% }); %>
        </tbody>`);
}
history = history.replace(/if \(action === 'delete'\) \{\s*row\.remove\(\);/, `if (action === 'delete') {
        const logId = row.getAttribute('data-log-id');
        if (logId) fetch(\`/api/history/\${logId}\`, { method: 'DELETE' }).then(() => row.remove());
        else row.remove();`);
fs.writeFileSync(historyPath, history);
console.log('Patched history.ejs');

console.log('Done.');
