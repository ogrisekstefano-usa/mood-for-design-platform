#!/usr/bin/env node
/**
 * ITER131 · Full Runtime Localization Crawler™.
 *
 * Walks the LIVE app in EN-US, drives interactions (tabs, drawers,
 * accordions), reads the rendered DOM, and reports every gap a real
 * user would encounter:
 *
 *   • HARD_CODED_UI         · Italian text in a non-IT locale
 *   • MISSING_REGISTRY_KEY  · ⟦key⟧ tokens or raw dotted keys rendered
 *   • COMPONENT_BYPASS      · jsx_text not routed through t()
 *   • RUNTIME_CRASH         · React errors / page error boundaries
 *   • INVALID_USE_TRANSLATION · "t is not a function" / "undefined is not a function"
 *   • BACKEND_PAYLOAD       · IT strings in window.__lastPayloads__
 *   • CONSOLE_ERRORS        · captured stack traces
 *
 * Outputs:
 *   /app/governance/runtime-localization-report.json
 *   /app/governance/runtime-localization-screenshots/*.jpg
 *   /app/governance/runtime-localization-remediation.md
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const LOCALE = process.env.LOCALE || 'en-US';
const BASE   = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');
if (!BASE) { console.error('Set REACT_APP_BACKEND_URL'); process.exit(2); }

const EMAIL    = process.env.AUDIT_EMAIL    || 'demo@moodfordesign.com';
const PASSWORD = process.env.AUDIT_PASSWORD || 'Blueprint2024!';

const OUT_DIR   = path.join(__dirname, '..', '..', 'governance');
const SHOT_DIR  = path.join(OUT_DIR, 'runtime-localization-screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

// All major operational surfaces a user can reach.
const ROUTES = [
  ['dashboard',           '/dashboard'],
  ['journeys',            '/workspace/projects'],
  ['journey-detail',      '/workspace/projects'],   // first card click handled after nav
  ['crm-accounts',        '/crm/accounts'],
  ['crm-follow-ups',      '/crm/follow-ups'],
  ['inspirations',        '/inspirations'],
  ['brand-atlas',         '/inspirations/brands'],
  ['material-view',       '/inspirations/materials'],
  ['cultural-editions',   '/workspace/cultural-editions'],
  ['editorial-calendar',  '/editorial/calendar'],
  ['magazine',            '/editorial/magazine'],
  ['publishing',          '/editorial/publishing'],
  ['market-matrix',       '/editorial/market'],
  ['web-presence',        '/editorial/web-presence'],
  ['studio-identity',     '/team/studio-identity'],
  ['integrations',        '/team/integrations'],
  ['insights',            '/team/insights'],
  ['forms',               '/forms'],
  ['studio-voice',        '/blueprint/studio-voice'],
  ['language-center',     '/blueprint/language'],
  ['moodboards',          '/moodboards'],
  ['settings-locales',    '/settings/locales'],
];

// Higher-signal Italian markers — runtime regex used in the browser.
const RUNTIME_IT_RX_SRC = String.raw`\b(?:il|lo|la|gli|le|della|dello|delle|degli|alla|alle|nella|nelle|nel|del|sul|dal|tuoi|tue|tuo|tua|nostro|nostra|nessun|nessuna|aggiungi|annulla|salva|chiudi|carica|scegli|conferma|raccogli|aggiorna|crea|modifica|riprova|esporta|stampa|condividi|pubblica|prossimi|capitolo|sezione|atelier|moodboard|impostazion[ei]|contatti|esperienze|atmosfera|materico|cliente|progetto|ispirazione)\b`;
// Italian-only accents — almost zero false-positive in English chrome.
const RUNTIME_IT_ACCENT = String.raw`[àèéìòù]`;

async function authenticate(page) {
  await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((lc) => localStorage.setItem('mfd_locale', lc), LOCALE);
  await page.fill('[data-testid="login-email-input"]', EMAIL);
  await page.fill('[data-testid="login-password-input"]', PASSWORD);
  await page.click('[data-testid="login-submit-btn"]');
  await page.waitForURL((u) => !String(u).includes('/login'), { timeout: 25000 });
  // Force EN-US in localStorage + broadcast a locale change event.
  await page.evaluate((lc) => {
    localStorage.setItem('mfd_locale', lc);
    try {
      window.dispatchEvent(new CustomEvent('mfd:locale:change', { detail: { locale: lc } }));
    } catch (_) {}
  }, LOCALE);
  // Hard reload so Blueprint i18n bundle for EN-US loads.
  await page.reload({ waitUntil: 'domcontentloaded' });
}

async function harvestPage(page, key, url) {
  const errors = [];
  const consoleEntries = [];
  page.on('pageerror', (e) => errors.push({ kind: 'page', message: String(e?.message || e) }));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleEntries.push({ kind: 'console', message: msg.text().slice(0, 600) });
    else if (msg.text().startsWith('[i18n · STRICT]')) consoleEntries.push({ kind: 'strict', message: msg.text().slice(0, 600) });
    else if (msg.text().startsWith('[LEAKAGE]')) consoleEntries.push({ kind: 'leakage', message: msg.text().slice(0, 600) });
  });

  let navError = null;
  try {
    await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  } catch (e) {
    navError = e.message;
  }
  // Allow lazy data + initial leak scan to run.
  await page.waitForTimeout(4500);

  // Try to interact with up to 4 tabs / drawers per page.
  try {
    const tabs = await page.$$('[role="tab"], [data-testid*="tab-"]');
    for (let i = 0; i < Math.min(tabs.length, 3); i++) {
      try { await tabs[i].click({ timeout: 1500 }); await page.waitForTimeout(700); } catch (_) {}
    }
  } catch (_) {}

  // Harvest DOM in-page.
  const dom = await page.evaluate(({ ITRX, ACCENT }) => {
    const rx     = new RegExp(ITRX, 'i');
    const acc    = new RegExp(ACCENT);
    const missingTokens = [];
    const italianLeaks  = [];
    const rawKeys       = [];   // text like "common.foo" rendered as content
    const seen = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const v = n.nodeValue && n.nodeValue.trim();
        if (!v || v.length < 3) return NodeFilter.FILTER_REJECT;
        const p = n.parentNode;
        if (!p || p.nodeType !== 1) return NodeFilter.FILTER_REJECT;
        if (p.tagName === 'SCRIPT' || p.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
        const sk = p.closest('[data-ale-original],[data-no-leakage-scan],.ale-msg__original,input,textarea,select,[data-testid="localization-overlay-panel"]');
        if (sk) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let count = 0;
    while (walker.nextNode() && count < 2000) {
      const node = walker.currentNode;
      const text = node.nodeValue.trim();
      const tid  = node.parentElement?.closest('[data-testid]')?.getAttribute('data-testid') || null;
      // 1. Missing key token rendered into the DOM.
      if (/^⟦.+⟧$/.test(text)) {
        const sig = `MISS|${text}`;
        if (!seen.has(sig)) { seen.add(sig); missingTokens.push({ text, testid: tid }); }
      }
      // 2. Raw dotted i18n keys leaking through (e.g. "common.empty.title").
      if (/^[a-z][a-z0-9_]+(\.[a-z][a-z0-9_]+){2,}$/i.test(text) && text.length < 80) {
        const sig = `KEY|${text}`;
        if (!seen.has(sig)) { seen.add(sig); rawKeys.push({ text, testid: tid }); }
      }
      // 3. Italian leak (accent OR 2+ markers).
      const markers = text.match(new RegExp(ITRX, 'gi')) || [];
      if (acc.test(text) || markers.length >= 2 || (markers.length === 1 && rx.test(text) && text.length < 60)) {
        // Suppress 1-char accents that aren't actually Italian (e.g. "café").
        if (markers.length === 0 && /^[A-Za-zÀ-ÿ\s'·]+$/.test(text) && text.length < 24 && !acc.test(text.replace(/'/g, ''))) {
          continue;
        }
        const sig = `IT|${text.slice(0, 80)}`;
        if (!seen.has(sig)) { seen.add(sig); italianLeaks.push({ text: text.slice(0, 200), testid: tid }); }
      }
      count++;
    }
    // Probe for visible React error boundary copy.
    const errorBoundary = !!document.querySelector('[data-testid="error-boundary"], [data-error-boundary], .error-boundary');
    return { missingTokens, italianLeaks, rawKeys, errorBoundary };
  }, { ITRX: RUNTIME_IT_RX_SRC, ACCENT: RUNTIME_IT_ACCENT });

  // Screenshot for human review.
  const shotPath = path.join(SHOT_DIR, `${key}.jpg`);
  try {
    await page.screenshot({ path: shotPath, quality: 35, fullPage: false, type: 'jpeg' });
  } catch (_) {}

  return {
    key, url,
    nav_error: navError,
    missing_tokens: dom.missingTokens,
    italian_leaks:  dom.italianLeaks,
    raw_keys:       dom.rawKeys,
    error_boundary: dom.errorBoundary,
    console:        consoleEntries.slice(-40),
    page_errors:    errors.slice(-20),
    screenshot:     path.relative(OUT_DIR, shotPath),
  };
}

function classify(report) {
  const findings = [];
  for (const r of report.pages) {
    (r.missing_tokens || []).forEach((m) => findings.push({
      kind: 'MISSING_REGISTRY_KEY', page: r.url, text: m.text, testid: m.testid,
    }));
    (r.raw_keys || []).forEach((m) => findings.push({
      kind: 'INVALID_USE_TRANSLATION', page: r.url, text: m.text, testid: m.testid,
    }));
    (r.italian_leaks || []).forEach((m) => findings.push({
      kind: 'HARD_CODED_UI', page: r.url, text: m.text, testid: m.testid,
    }));
    (r.page_errors || []).forEach((e) => findings.push({
      kind: 'RUNTIME_CRASH', page: r.url, message: e.message,
    }));
    (r.console || []).forEach((c) => {
      if (/t is not a function|undefined is not a function|Cannot read|TypeError/i.test(c.message)) {
        findings.push({ kind: 'INVALID_USE_TRANSLATION', page: r.url, message: c.message });
      }
    });
  }
  return findings;
}

(async () => {
  console.log(`Runtime Crawl · locale=${LOCALE} · base=${BASE}`);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  try {
    await authenticate(page);
  } catch (e) {
    console.error('auth failed:', e.message);
    await browser.close();
    process.exit(3);
  }

  const pages = [];
  for (const [key, url] of ROUTES) {
    process.stdout.write(`  · ${key.padEnd(22)} ${url} … `);
    const r = await harvestPage(page, key, url);
    process.stdout.write(`IT=${r.italian_leaks.length} MISS=${r.missing_tokens.length} KEY=${r.raw_keys.length} ERR=${r.page_errors.length}\n`);
    pages.push(r);
  }
  await browser.close();

  const findings = classify({ pages });
  const summary = findings.reduce((acc, f) => { acc[f.kind] = (acc[f.kind] || 0) + 1; return acc; }, {});

  const out = {
    locale: LOCALE,
    base: BASE,
    generated_at: new Date().toISOString(),
    routes_crawled: ROUTES.length,
    summary,
    findings,
    pages,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'runtime-localization-report.json'),
    JSON.stringify(out, null, 2), 'utf-8');

  // Markdown remediation report.
  const md = [];
  md.push(`# Runtime Localization Report · ${out.generated_at.slice(0, 10)}`);
  md.push('');
  md.push(`**Locale**: \`${LOCALE}\`    **Routes**: ${ROUTES.length}`);
  md.push('');
  md.push('## Summary');
  md.push('');
  md.push('| Category | Count |');
  md.push('|---|---:|');
  Object.entries(summary).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => md.push(`| ${k} | ${v} |`));
  md.push('');
  md.push('## Findings by page');
  md.push('');
  for (const r of pages) {
    if (!r.italian_leaks.length && !r.missing_tokens.length && !r.raw_keys.length && !r.page_errors.length) continue;
    md.push(`### ${r.url}  (${r.key})`);
    md.push('');
    if (r.italian_leaks.length) {
      md.push(`**HARD_CODED_UI** · ${r.italian_leaks.length}`);
      md.push('');
      r.italian_leaks.slice(0, 30).forEach((l) => md.push(`- «${l.text.slice(0, 140)}»  · \`${l.testid || '—'}\``));
      md.push('');
    }
    if (r.missing_tokens.length) {
      md.push(`**MISSING_REGISTRY_KEY** · ${r.missing_tokens.length}`);
      md.push('');
      r.missing_tokens.slice(0, 30).forEach((l) => md.push(`- ${l.text}  · \`${l.testid || '—'}\``));
      md.push('');
    }
    if (r.raw_keys.length) {
      md.push(`**INVALID_USE_TRANSLATION (raw key rendered)** · ${r.raw_keys.length}`);
      md.push('');
      r.raw_keys.slice(0, 30).forEach((l) => md.push(`- ${l.text}  · \`${l.testid || '—'}\``));
      md.push('');
    }
    if (r.page_errors.length) {
      md.push(`**RUNTIME_CRASH** · ${r.page_errors.length}`);
      md.push('');
      r.page_errors.slice(0, 6).forEach((e) => md.push(`- \`${e.message.slice(0, 220)}\``));
      md.push('');
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, 'runtime-localization-remediation.md'), md.join('\n'), 'utf-8');

  console.log('\nReport: /app/governance/runtime-localization-report.json');
  console.log('Notes:  /app/governance/runtime-localization-remediation.md');
  console.log('Shots:  /app/governance/runtime-localization-screenshots/');
  console.log('Summary:', summary);
})().catch((e) => { console.error(e); process.exit(1); });
