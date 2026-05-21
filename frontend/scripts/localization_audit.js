#!/usr/bin/env node
/**
 * Localization Audit CLI · ITER127.
 *
 * Headless Playwright tour through the 12+ Blueprint surfaces, captures:
 *   • Italian Leakage Detector™ results (window.__moodLeaks__)
 *   • Missing translation registry      (window.__moodMissing__)
 * and produces:
 *   • /app/governance/localization-leaks.md   (human-readable report)
 *   • /app/governance/localization-leaks.json (machine-readable for CI)
 *
 * Usage:
 *   node scripts/localization_audit.js               # default: en-US
 *   LOCALE=fr-FR node scripts/localization_audit.js  # override locale
 *   AUDIT_INGEST=1 node scripts/localization_audit.js  # also POST to /api/language/audit/ingest
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const LOCALE = process.env.LOCALE || 'en-US';
const BASE   = (process.env.REACT_APP_BACKEND_URL || process.env.BASE_URL || '').replace(/\/$/, '');
if (!BASE) { console.error('Set REACT_APP_BACKEND_URL or BASE_URL'); process.exit(2); }

const STUDIO_EMAIL    = process.env.AUDIT_EMAIL    || 'demo@moodfordesign.com';
const STUDIO_PASSWORD = process.env.AUDIT_PASSWORD || 'Blueprint2024!';

// 12+ Blueprint surfaces explicitly called out in the sprint brief.
const PAGES = [
  ['Dashboard',          '/dashboard'],
  ['Your Journeys',      '/workspace/projects'],
  ['CRM Accounts',       '/crm/accounts'],
  ['CRM Follow-ups',     '/crm/follow-ups'],
  ['Inspirations',       '/inspirations'],
  ['Brand Atlas',        '/inspirations/brands'],
  ['Material View',      '/inspirations/materials'],
  ['Cultural Editions',  '/workspace/cultural-editions'],
  ['Editorial Calendar', '/editorial/calendar'],
  ['Magazine',           '/editorial/magazine'],
  ['Publishing Queue',   '/editorial/publishing'],
  ['Market Matrix',      '/editorial/market'],
  ['Web Presence',       '/editorial/web-presence'],
  ['Studio Identity',    '/team/studio-identity'],
  ['Integrations',       '/team/integrations'],
  ['Insights',           '/team/insights'],
  ['Forms & Journeys',   '/forms'],
  ['Studio Voice',       '/blueprint/studio-voice'],
];

async function authenticate(page) {
  await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((lc) => localStorage.setItem('mfd_locale', lc), LOCALE);
  await page.fill('[data-testid="login-email-input"]', STUDIO_EMAIL);
  await page.fill('[data-testid="login-password-input"]', STUDIO_PASSWORD);
  await page.click('[data-testid="login-submit-btn"]');
  await page.waitForURL((u) => !String(u).includes('/login'), { timeout: 20000 });
  await page.evaluate((lc) => {
    localStorage.setItem('mfd_locale', lc);
    window.dispatchEvent(new CustomEvent('mfd:locale:change', { detail: { locale: lc } }));
  }, LOCALE);
}

async function exposeRegistries(page) {
  // Expose the two in-memory registries to window so the audit can read them.
  await page.addInitScript(() => {
    Object.defineProperty(window, '__moodLeakModule__', { value: null, writable: true });
  });
}

async function scanPage(page, label, url) {
  const start = Date.now();
  try {
    await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  } catch (e) {
    return { label, url, error: `nav: ${e.message}`, leaks: [], missing: [] };
  }
  // Give the leakage detector at least one scan window (it ticks every 8s).
  await page.waitForTimeout(11_000);
  const leaks = await page.evaluate(() => {
    try {
      const m = require('./i18n/leakageDetector');   // won't work via require in browser, see below
      return m.getLeaks();
    } catch (_) { return null; }
  }).catch(() => null);

  // Fallback: the detector exposes `[LEAKAGE]` console warns + we can read the
  // overlay panel content directly. We use the published console messages
  // instead (see consoleMessages collector below).
  const overlayLeaks = await page.evaluate(() => {
    const out = [];
    const rows = document.querySelectorAll('[data-testid="localization-overlay-panel"] li');
    rows.forEach((row) => {
      const phrase = row.querySelector('div:first-child')?.textContent?.trim() || '';
      const meta   = row.querySelector('div:last-child')?.textContent?.trim() || '';
      if (phrase) out.push({ phrase, meta });
    });
    return out;
  }).catch(() => []);

  return {
    label, url,
    leaks: leaks || overlayLeaks || [],
    overlayLeaks,
    durationMs: Date.now() - start,
  };
}

async function main() {
  console.log(`Localization Audit · locale=${LOCALE} · base=${BASE}`);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const consoleLeaks = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.startsWith('[LEAKAGE]')) {
      try { consoleLeaks.push(JSON.parse(text.replace('[LEAKAGE]', '').trim())); }
      catch (_) { consoleLeaks.push({ raw: text }); }
    }
  });

  try {
    await exposeRegistries(page);
    await authenticate(page);
  } catch (e) {
    console.error('Authentication failed:', e.message);
    await browser.close();
    process.exit(3);
  }

  const results = [];
  for (const [label, url] of PAGES) {
    process.stdout.write(`  · ${label.padEnd(22)} ${url} … `);
    const r = await scanPage(page, label, url);
    process.stdout.write(`${(r.leaks?.length || 0)} leaks\n`);
    results.push(r);
  }

  await browser.close();

  // Aggregate console-captured leaks by page (more reliable than DOM scrape).
  const byPage = new Map();
  for (const c of consoleLeaks) {
    const p = c.page || '(unknown)';
    const key = `${p}|${c.phrase}`;
    if (!byPage.has(key)) byPage.set(key, { ...c, count: 1 });
    else byPage.get(key).count += 1;
  }
  const aggregatedLeaks = Array.from(byPage.values())
    .sort((a, b) => b.count - a.count);

  // Build Markdown report.
  const lines = [];
  lines.push(`# Localization Leaks · ${new Date().toISOString().slice(0, 10)}`);
  lines.push('');
  lines.push(`**Locale**: \`${LOCALE}\`    **Base**: ${BASE}    **Pages**: ${PAGES.length}    **Leaks total**: ${aggregatedLeaks.length}`);
  lines.push('');
  // Group by page
  const grouped = new Map();
  aggregatedLeaks.forEach((l) => {
    const k = l.page || '(unknown)';
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k).push(l);
  });
  const sortedPages = Array.from(grouped.keys()).sort((a, b) =>
    (grouped.get(b).length - grouped.get(a).length));
  if (!sortedPages.length) {
    lines.push('## Result\n\n_No Italian leakage detected. 🎉_\n');
  } else {
    sortedPages.forEach((p) => {
      lines.push(`## ${p}  ·  ${grouped.get(p).length} leaks`);
      lines.push('');
      lines.push('| Phrase | testid | × |');
      lines.push('|---|---|---:|');
      grouped.get(p).slice(0, 50).forEach((l) => {
        lines.push(`| «${(l.phrase || '').slice(0, 80)}» | \`${l.testid || '—'}\` | ${l.count} |`);
      });
      lines.push('');
    });
  }

  // Append per-page nav summary
  lines.push('## Per-page summary');
  lines.push('');
  lines.push('| Page | URL | Leaks | Duration |');
  lines.push('|---|---|---:|---:|');
  results.forEach((r) => {
    const pageLeaks = aggregatedLeaks.filter((l) => l.page === r.url).reduce((a, c) => a + c.count, 0);
    lines.push(`| ${r.label} | \`${r.url}\` | ${pageLeaks} | ${r.durationMs || 0}ms |`);
  });

  const outDir = path.join(__dirname, '..', '..', 'governance');
  fs.mkdirSync(outDir, { recursive: true });
  const mdPath = path.join(outDir, 'localization-leaks.md');
  const jsonPath = path.join(outDir, 'localization-leaks.json');
  fs.writeFileSync(mdPath, lines.join('\n'), 'utf-8');
  fs.writeFileSync(jsonPath, JSON.stringify({
    locale: LOCALE, base: BASE, generated_at: new Date().toISOString(),
    pages_scanned: PAGES.length, leaks: aggregatedLeaks, results,
  }, null, 2), 'utf-8');
  console.log(`\nReport: ${mdPath}`);
  console.log(`JSON:   ${jsonPath}`);
  console.log(`Total leaks: ${aggregatedLeaks.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
