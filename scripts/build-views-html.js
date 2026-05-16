/**
 * Builds views-html/ mirror of views/*.ejs as static *.html:
 * - Inlines partials/glass-app-theme.ejs where included
 * - Rewrites Express-style /routes to sibling .html files (for opening locally or static hosting)
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const viewsDir = path.join(root, 'views');
const outDir = path.join(root, 'views-html');

const partialPath = path.join(viewsDir, 'partials', 'glass-app-theme.ejs');
const partialCss = fs.readFileSync(partialPath, 'utf8');

const includeRe =
  /<%-\s*include\(['"]partials\/glass-app-theme['"]\)\s*%>\s*\n?/g;

const replacements = [
  ['href="/monitoring"', 'href="realtime-monitoring.html"'],
  ['href="/water-quality"', 'href="water-quality.html"'],
  ['href="/consumption"', 'href="consumption.html"'],
  ['href="/dashboard"', 'href="dashboard.html"'],
  ['href="/alerts"', 'href="alerts.html"'],
  ['href="/history"', 'href="history.html"'],
  ['href="/reports"', 'href="reports.html"'],
  ['href="/settings"', 'href="#"'],
  ['href="/logout"', 'href="login.html"'],
  ['action="/login" method="POST"', 'action="dashboard.html" method="get"'],
  ['href="/forgot-password"', 'href="#"'],
  ['href="/contact-admin"', 'href="#"'],
];

const pages = [
  'login.ejs',
  'dashboard.ejs',
  'realtime-monitoring.ejs',
  'water-quality.ejs',
  'consumption.ejs',
  'alerts.ejs',
  'history.ejs',
  'reports.ejs',
];

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.join(outDir, 'partials'), { recursive: true });

fs.writeFileSync(
  path.join(outDir, 'partials', 'glass-app-theme.html'),
  `<!-- Same CSS snippet as views/partials/glass-app-theme.ejs (normally inlined in each app page HTML) -->
<style>\n${partialCss}\n</style>\n`,
  'utf8'
);

function stripLoginEjs(html) {
  return html
    .replace(/\s*<% if \(typeof error !== ['"]undefined['"] && error\) \{ %>[\s\S]*?<% } %>\s*/g, '\n')
    .replace(/\s+class="<%= typeof error !== ['"]undefined['"] && error \? 'input-error' : '' %>"/g, '')
    .replace(/window\.location\.href\s*=\s*['"]\/dashboard['"]/g, "window.location.href='dashboard.html'");
}

for (const name of pages) {
  let html = fs.readFileSync(path.join(viewsDir, name), 'utf8');
  html = html.replace(includeRe, `\n${partialCss}\n`);
  for (const [from, to] of replacements) {
    html = html.split(from).join(to);
  }
  if (name === 'login.ejs') html = stripLoginEjs(html);
  const base = name.replace(/\.ejs$/i, '');
  fs.writeFileSync(path.join(outDir, `${base}.html`), html, 'utf8');
}

console.log(`Wrote ${pages.length} pages + partials/glass-app-theme.html → ${outDir}`);
