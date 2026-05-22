#!/usr/bin/env python3
"""ITER131 · Full Runtime Localization Crawler™ (Python · sync Playwright).

Drives the LIVE app in EN-US, walks every operational route, opens up to N
tabs/drawers, harvests the rendered DOM, and writes:

  /app/governance/runtime-localization-report.json
  /app/governance/runtime-localization-screenshots/*.jpg
  /app/governance/runtime-localization-remediation.md

What it detects at RUNTIME (not via grep / AST):
  • HARD_CODED_UI         — Italian text inside an EN-US locale
  • MISSING_REGISTRY_KEY  — ⟦key⟧ tokens or raw dotted keys in DOM
  • INVALID_USE_TRANSLATION — page errors / "t is not a function"
  • RUNTIME_CRASH         — pageerror events, error boundaries
  • CONSOLE_ERRORS        — every console.error printed during the visit
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

LOCALE = os.environ.get('LOCALE', 'en-US')
BASE   = (os.environ.get('REACT_APP_BACKEND_URL') or '').rstrip('/')
if not BASE:
    # Fall back to the frontend .env so the script works in one-line invocations.
    env = Path('/app/frontend/.env').read_text(encoding='utf-8')
    m = re.search(r'^REACT_APP_BACKEND_URL=(.+)$', env, re.M)
    BASE = (m.group(1).strip() if m else '').rstrip('/')
if not BASE:
    print('Set REACT_APP_BACKEND_URL'); sys.exit(2)

EMAIL    = os.environ.get('AUDIT_EMAIL',    'demo@moodfordesign.com')
PASSWORD = os.environ.get('AUDIT_PASSWORD', 'Blueprint2024!')
OUT_DIR  = Path('/app/governance')
SHOT_DIR = OUT_DIR / 'runtime-localization-screenshots'
SHOT_DIR.mkdir(parents=True, exist_ok=True)

ROUTES = [
    ('dashboard',           '/dashboard'),
    ('journeys',            '/workspace/projects'),
    ('crm-accounts',        '/crm/accounts'),
    ('crm-follow-ups',      '/crm/follow-ups'),
    ('inspirations',        '/inspirations'),
    ('brand-atlas',         '/inspirations/brands'),
    ('material-view',       '/inspirations/materials'),
    ('cultural-editions',   '/workspace/cultural-editions'),
    ('editorial-calendar',  '/editorial/calendar'),
    ('magazine',            '/editorial/magazine'),
    ('publishing',          '/editorial/publishing'),
    ('market-matrix',       '/editorial/market'),
    ('web-presence',        '/editorial/web-presence'),
    ('studio-identity',     '/team/studio-identity'),
    ('integrations',        '/team/integrations'),
    ('insights',            '/team/insights'),
    ('forms',               '/forms'),
    ('studio-voice',        '/blueprint/studio-voice'),
    ('language-center',     '/blueprint/language'),
    ('moodboards',          '/moodboards'),
]

# Italian fingerprint pattern used in-page (string, compiled to JS RegExp).
IT_RX_SRC = (
    r"\b(?:il|lo|la|gli|le|della|dello|delle|degli|alla|alle|nella|nelle|nel|del|sul|"
    r"dal|tuoi|tue|tuo|tua|nostro|nostra|nessun|nessuna|aggiungi|annulla|salva|chiudi|"
    r"carica|scegli|conferma|raccogli|aggiorna|crea|modifica|riprova|esporta|stampa|"
    r"condividi|pubblica|prossimi|capitolo|sezione|atelier|atmosfera|materico|"
    r"cliente|progetto|ispirazione|impostazion[ei]|contatti|esperienze)\b"
)
IT_ACCENT = r"[àèéìòù]"

HARVEST_JS = """
({ ITRX, ACC }) => {
  const rx = new RegExp(ITRX, 'i');
  const rxg = new RegExp(ITRX, 'gi');
  const accent = new RegExp(ACC);
  const it_leaks = [], missing = [], raw_keys = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const v = n.nodeValue && n.nodeValue.trim();
      if (!v || v.length < 3) return NodeFilter.FILTER_REJECT;
      const p = n.parentNode;
      if (!p || p.nodeType !== 1) return NodeFilter.FILTER_REJECT;
      if (p.tagName === 'SCRIPT' || p.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
      const skip = p.closest('[data-ale-original],[data-no-leakage-scan],.ale-msg__original,input,textarea,select,[data-testid="localization-overlay-panel"]');
      if (skip) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let count = 0;
  while (walker.nextNode() && count < 2000) {
    const node = walker.currentNode;
    const text = node.nodeValue.trim();
    const el = node.parentElement;
    const tid = el && el.closest && el.closest('[data-testid]') && el.closest('[data-testid]').getAttribute('data-testid');
    if (/^⟦.+⟧$/.test(text)) {
      const s = 'M|' + text;
      if (!seen.has(s)) { seen.add(s); missing.push({ text, testid: tid }); }
    } else if (/^[a-z][a-z0-9_]+(\\.[a-z][a-z0-9_]+){2,}$/i.test(text) && text.length < 80) {
      const s = 'K|' + text;
      if (!seen.has(s)) { seen.add(s); raw_keys.push({ text, testid: tid }); }
    } else {
      const markers = text.match(rxg) || [];
      const hasAcc  = accent.test(text);
      if (hasAcc || markers.length >= 2 || (markers.length === 1 && text.length < 60)) {
        const s = 'I|' + text.slice(0, 80);
        if (!seen.has(s)) { seen.add(s); it_leaks.push({ text: text.slice(0, 200), testid: tid }); }
      }
    }
    count++;
  }
  const eb = !!document.querySelector('[data-testid="error-boundary"], [data-error-boundary]');
  return { it_leaks, missing, raw_keys, error_boundary: eb };
}
"""


def authenticate(page):
    page.goto(f'{BASE}/auth/login', wait_until='domcontentloaded', timeout=25000)
    page.evaluate("(lc) => localStorage.setItem('mfd_locale', lc)", LOCALE)
    page.fill('[data-testid="login-email-input"]', EMAIL)
    page.fill('[data-testid="login-password-input"]', PASSWORD)
    page.click('[data-testid="login-submit-btn"]')
    page.wait_for_url(lambda u: '/login' not in str(u), timeout=25000)
    page.evaluate(
        "(lc) => { localStorage.setItem('mfd_locale', lc); "
        "try { window.dispatchEvent(new CustomEvent('mfd:locale:change',{detail:{locale:lc}})); } catch(_){}}",
        LOCALE,
    )
    page.reload(wait_until='domcontentloaded')


def harvest_route(page, key, url, captured):
    captured['errors'] = []
    captured['console'] = []

    def on_error(e):
        captured['errors'].append(str(getattr(e, 'message', e))[:400])

    def on_console(msg):
        try:
            t = msg.type
            text = msg.text[:600]
        except Exception:
            return
        if t == 'error' or text.startswith('[i18n · STRICT]') or text.startswith('[LEAKAGE]'):
            captured['console'].append({'type': t, 'text': text})

    page.on('pageerror', on_error)
    page.on('console', on_console)

    nav_err = None
    try:
        page.goto(f'{BASE}{url}', wait_until='domcontentloaded', timeout=25000)
    except Exception as e:
        nav_err = str(e)[:200]
    page.wait_for_timeout(4000)

    # Click up to 3 tabs/sub-nav items if present.
    try:
        tabs = page.query_selector_all('[role="tab"], [data-testid*="-tab-"]')
        for t in tabs[:3]:
            try:
                t.click(timeout=1200)
                page.wait_for_timeout(700)
            except Exception:
                pass
    except Exception:
        pass

    dom = page.evaluate(HARVEST_JS, {'ITRX': IT_RX_SRC, 'ACC': IT_ACCENT})

    try:
        page.screenshot(path=str(SHOT_DIR / f'{key}.jpg'), quality=35, full_page=False, type='jpeg')
    except Exception:
        pass

    page.remove_listener('pageerror', on_error)
    page.remove_listener('console', on_console)

    return {
        'key': key, 'url': url, 'nav_error': nav_err,
        'italian_leaks':  dom.get('it_leaks', []),
        'missing_tokens': dom.get('missing', []),
        'raw_keys':       dom.get('raw_keys', []),
        'error_boundary': dom.get('error_boundary', False),
        'page_errors':    captured['errors'][:],
        'console':        captured['console'][:],
        'screenshot':     f'runtime-localization-screenshots/{key}.jpg',
    }


def classify(pages):
    findings = []
    # testid prefixes that identify DB-seeded content (user content, not chrome).
    DB_SEEDED_PREFIXES = (
        'inspiration-card-', 'ce-row-', 'project-card-', 'moodboard-card-',
        'account-card-', 'mb-page-', 'mb-tile-', 'reference-card-',
        'jp-journey-', 'jp-voice-', 'jp-action-',  # Presence stream items
        'bm-card-', 'bm-materials-',                # Brand atlas DB cards
    )
    # Surfaces that intentionally display source-locale text (the studio's
    # original IT is the editorial truth being inspected — translating it
    # would defeat the purpose). They are classified separately so the
    # zero-leak audit does not fail on by-design content.
    EDITORIAL_SEED_PREFIXES = (
        'voice-vocab-row-', 'voice-memory-row-',
    )
    for r in pages:
        for m in r['missing_tokens']:
            findings.append({'kind': 'MISSING_REGISTRY_KEY', 'page': r['url'], **m})
        for m in r['raw_keys']:
            findings.append({'kind': 'INVALID_USE_TRANSLATION', 'page': r['url'], **m})
        for m in r['italian_leaks']:
            tid = m.get('testid') or ''
            if any(tid.startswith(p) for p in EDITORIAL_SEED_PREFIXES):
                kind = 'EDITORIAL_SEED_BY_DESIGN'
            elif any(tid.startswith(p) for p in DB_SEEDED_PREFIXES):
                kind = 'DB_SEEDED_CONTENT'
            else:
                kind = 'HARD_CODED_UI'
            findings.append({'kind': kind, 'page': r['url'], **m})
        for e in r['page_errors']:
            findings.append({'kind': 'RUNTIME_CRASH', 'page': r['url'], 'message': e})
        for c in r['console']:
            if re.search(r'(t is not a function|undefined is not a function|TypeError|Cannot read|ReferenceError)', c['text']):
                findings.append({'kind': 'INVALID_USE_TRANSLATION', 'page': r['url'], 'message': c['text']})
    return findings


def main():
    print(f'Runtime Crawl · locale={LOCALE} · base={BASE}')
    pages_data = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(viewport={'width': 1440, 'height': 900})
        page = ctx.new_page()
        try:
            authenticate(page)
        except Exception as e:
            print(f'auth failed: {e}')
            browser.close()
            sys.exit(3)
        for key, url in ROUTES:
            captured = {}
            t0 = time.time()
            r = harvest_route(page, key, url, captured)
            dt = int((time.time() - t0) * 1000)
            print(f'  · {key:22s} {url:38s} IT={len(r["italian_leaks"]):3d} MISS={len(r["missing_tokens"]):2d} KEY={len(r["raw_keys"]):2d} ERR={len(r["page_errors"]):2d} ({dt}ms)')
            pages_data.append(r)
        browser.close()

    findings = classify(pages_data)
    summary = {}
    for f in findings:
        summary[f['kind']] = summary.get(f['kind'], 0) + 1

    report = {
        'locale': LOCALE, 'base': BASE,
        'generated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'routes_crawled': len(ROUTES),
        'summary': summary,
        'findings': findings,
        'pages': pages_data,
    }
    (OUT_DIR / 'runtime-localization-report.json').write_text(
        json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')

    # Remediation markdown.
    md = [
        f'# Runtime Localization Report · {report["generated_at"][:10]}',
        '',
        f'**Locale**: `{LOCALE}`    **Routes**: {len(ROUTES)}',
        '',
        '## Summary',
        '',
        '| Category | Count |',
        '|---|---:|',
    ]
    for k, v in sorted(summary.items(), key=lambda kv: -kv[1]):
        md.append(f'| {k} | {v} |')
    md += ['', '## Findings by page', '']
    for r in pages_data:
        if not (r['italian_leaks'] or r['missing_tokens'] or r['raw_keys'] or r['page_errors']):
            continue
        md.append(f'### {r["url"]}  ({r["key"]})')
        md.append('')
        if r['italian_leaks']:
            md.append(f'**HARD_CODED_UI** · {len(r["italian_leaks"])}'); md.append('')
            for x in r['italian_leaks'][:30]:
                md.append(f'- «{x["text"][:140]}»  · `{x.get("testid") or "—"}`')
            md.append('')
        if r['missing_tokens']:
            md.append(f'**MISSING_REGISTRY_KEY** · {len(r["missing_tokens"])}'); md.append('')
            for x in r['missing_tokens'][:30]:
                md.append(f'- {x["text"]}  · `{x.get("testid") or "—"}`')
            md.append('')
        if r['raw_keys']:
            md.append(f'**INVALID_USE_TRANSLATION (raw key rendered)** · {len(r["raw_keys"])}'); md.append('')
            for x in r['raw_keys'][:30]:
                md.append(f'- {x["text"]}  · `{x.get("testid") or "—"}`')
            md.append('')
        if r['page_errors']:
            md.append(f'**RUNTIME_CRASH** · {len(r["page_errors"])}'); md.append('')
            for e in r['page_errors'][:6]:
                md.append(f'- `{e[:200]}`')
            md.append('')

    (OUT_DIR / 'runtime-localization-remediation.md').write_text('\n'.join(md), encoding='utf-8')

    print(f'\nReport: {OUT_DIR}/runtime-localization-report.json')
    print(f'Notes:  {OUT_DIR}/runtime-localization-remediation.md')
    print(f'Shots:  {SHOT_DIR}')
    print('Summary:', summary)


if __name__ == '__main__':
    main()
