#!/usr/bin/env python3
"""
SPRINT ITER132 · Full Runtime Localization Crawler™

Autonomous DOM crawler that:
  1. Authenticates against the live preview URL (Supabase Auth via /api/auth/login)
  2. Crawls every Blueprint route in EN-US locale
  3. Drives interactions on each route (clicks tabs / opens drawers / sidebar)
  4. Captures DOM text + console errors + page errors + network payloads
  5. Classifies every leak:
        HARD_CODED_UI          — Italian text rendered under en-US
        MISSING_REGISTRY_KEY   — ⟦key⟧ visible tokens
        INVALID_USE_TRANSLATION — raw dotted key string rendered as content
        RUNTIME_CRASH          — pageerror / "t is not a function" / TypeError
        DB_SEEDED_CONTENT      — Italian text present in API responses
  6. Writes:
        /app/governance/runtime-localization-report.json   (master)
        /app/governance/runtime-localization-payloads.json (API payloads)
        /app/governance/runtime-localization-screenshots/  (one JPG/route)

USAGE:
  python3 /app/scripts/full_runtime_localization_crawler.py
  LOCALE=fr-FR python3 /app/scripts/full_runtime_localization_crawler.py
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Hard-add /opt/plugins-venv site-packages so we can use the same Playwright
# the tooling already provides without polluting /app dependencies.
_PW_SITE = "/opt/plugins-venv/lib"
for p in Path(_PW_SITE).glob("python*/site-packages"):
    sys.path.insert(0, str(p))

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout  # noqa: E402


# ─────────────── CONFIG ───────────────────────────────────────────────────
LOCALE   = os.environ.get("LOCALE", "en-US")
BASE     = os.environ.get(
    "BASE_URL",
    "https://content-hub-pro-22.preview.emergentagent.com",
).rstrip("/")
EMAIL    = os.environ.get("AUDIT_EMAIL", "demo@moodfordesign.com")
PASSWORD = os.environ.get("AUDIT_PASSWORD", "Blueprint2024!")
OUT_DIR  = Path("/app/governance")
SHOT_DIR = OUT_DIR / "runtime-localization-screenshots"
SHOT_DIR.mkdir(parents=True, exist_ok=True)


# All operational routes — keep in sync with iter131_runtime_crawler.js
ROUTES = [
    ("dashboard",         "/dashboard"),
    ("journeys",          "/workspace/projects"),
    ("crm-accounts",      "/crm/accounts"),
    ("crm-follow-ups",    "/crm/follow-ups"),
    ("inspirations",      "/inspirations"),
    ("brand-atlas",       "/inspirations/brands"),
    ("material-view",     "/inspirations/materials"),
    ("cultural-editions", "/workspace/cultural-editions"),
    ("editorial-calendar","/editorial/calendar"),
    ("magazine",          "/editorial/magazine"),
    ("publishing",        "/editorial/publishing"),
    ("market-matrix",     "/editorial/market"),
    ("web-presence",      "/editorial/web-presence"),
    ("studio-identity",   "/team/studio-identity"),
    ("integrations",      "/team/integrations"),
    ("insights",          "/team/insights"),
    ("forms",             "/forms"),
    ("studio-voice",      "/blueprint/studio-voice"),
    ("language-center",   "/blueprint/language"),
    ("moodboards",        "/moodboards"),
    ("settings-locales",  "/settings/locales"),
]


# ─────────────── DETECTION REGEXES ────────────────────────────────────────
# Italian high-signal markers (anti-false-positive).
IT_MARKERS_RX = re.compile(
    r"\b(?:"
    r"il|lo|la|gli|le|della|dello|delle|degli|alla|alle|nella|nelle|nel|del|sul|dal|"
    r"tuoi|tue|tuo|tua|nostro|nostra|nessun|nessuna|"
    r"aggiungi|annulla|salva|chiudi|carica|scegli|conferma|raccogli|aggiorna|crea|"
    r"modifica|riprova|esporta|stampa|condividi|pubblica|prossimi|capitolo|sezione|"
    r"atelier|moodboard|impostazion[ei]|contatti|esperienze|atmosfera|materico|"
    r"materialit[aà]|cliente|progetto|ispirazione"
    r")\b",
    re.IGNORECASE,
)
IT_ACCENT_RX = re.compile(r"[àèéìòùÀÈÉÌÒÙ]")
RAW_KEY_RX   = re.compile(r"^[a-z][a-z0-9_]+(?:\.[a-z][a-z0-9_]+){2,}$", re.IGNORECASE)
MISSING_TOKEN_RX = re.compile(r"^⟦.+⟧$")
RUNTIME_ERR_RX = re.compile(
    r"t is not a function|undefined is not a function|TypeError|"
    r"Cannot read prop|Cannot destructure",
    re.IGNORECASE,
)


# DOM harvest script injected into the page. Returns leaks for the route.
HARVEST_JS = r"""
() => {
  const ITRX = /\b(il|lo|la|gli|le|della|dello|delle|degli|alla|alle|nella|nelle|nel|del|sul|dal|tuoi|tue|tuo|tua|nostro|nostra|nessun|nessuna|aggiungi|annulla|salva|chiudi|carica|scegli|conferma|raccogli|aggiorna|crea|modifica|riprova|esporta|stampa|condividi|pubblica|prossimi|capitolo|sezione|atmosfera|materico|materialit[aà]|cliente|progetto|ispirazione|geometrie|finiture|proposta|cucina|domestiche|quotidiano)\b/i;
  const ACCENT = /[àèéìòù]/;
  const RAW = /^[a-z][a-z0-9_]+(\.[a-z][a-z0-9_]+){2,}$/i;
  const MISS = /^⟦.+⟧$/;
  const out = { italian_leaks: [], raw_keys: [], missing_tokens: [], error_boundary: false };
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const v = n.nodeValue && n.nodeValue.trim();
      if (!v || v.length < 3) return NodeFilter.FILTER_REJECT;
      const p = n.parentNode;
      if (!p || p.nodeType !== 1) return NodeFilter.FILTER_REJECT;
      if (p.tagName === 'SCRIPT' || p.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
      // Studio Voice surfaces show IT source by design (it's the editorial atelier
      // where the studio reviews/translates its own Italian content) — they are
      // NOT runtime leaks.
      const sk = p.closest('[data-ale-original],[data-no-leakage-scan],.ale-msg__original,input,textarea,select,[data-testid="localization-overlay-panel"],[data-testid^="voice-memory-row-"],[data-testid^="voice-vocab-row-"],[data-testid="voice-memory-inspector"],[data-testid="voice-preferred-vocabulary"],[data-testid^="leakage-row-"],[data-testid="language-cc-leakage-section"]');
      if (sk) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let count = 0;
  while (walker.nextNode() && count < 4000) {
    const node = walker.currentNode;
    const text = node.nodeValue.trim();
    const tid = node.parentElement?.closest('[data-testid]')?.getAttribute('data-testid') || null;
    if (MISS.test(text)) {
      const sig = 'M|' + text;
      if (!seen.has(sig)) { seen.add(sig); out.missing_tokens.push({text, testid: tid}); }
    } else if (RAW.test(text) && text.length < 80) {
      const sig = 'K|' + text;
      if (!seen.has(sig)) { seen.add(sig); out.raw_keys.push({text, testid: tid}); }
    } else {
      const ms = text.match(new RegExp(ITRX.source, 'gi')) || [];
      if (ACCENT.test(text) || ms.length >= 2 || (ms.length === 1 && text.length < 60)) {
        const sig = 'I|' + text.slice(0, 80);
        if (!seen.has(sig)) { seen.add(sig); out.italian_leaks.push({text: text.slice(0, 200), testid: tid}); }
      }
    }
    count++;
  }
  out.error_boundary = !!document.querySelector('[data-testid="error-boundary"],[data-error-boundary]');
  return out;
}
"""


# ─────────────── CRAWLER ──────────────────────────────────────────────────
def authenticate(page) -> None:
    page.goto(f"{BASE}/auth/login", wait_until="domcontentloaded", timeout=30000)
    page.evaluate(f"localStorage.setItem('mfd_locale', '{LOCALE}')")
    page.fill('[data-testid="login-email-input"]', EMAIL)
    page.fill('[data-testid="login-password-input"]', PASSWORD)
    page.click('[data-testid="login-submit-btn"]')
    try:
        page.wait_for_url(lambda u: "/login" not in u, timeout=25000)
    except PWTimeout:
        pass
    page.evaluate(
        f"""(() => {{
          localStorage.setItem('mfd_locale', '{LOCALE}');
          try {{ window.dispatchEvent(new CustomEvent('mfd:locale:change', {{detail: {{locale: '{LOCALE}'}}}})); }} catch(_){{}}
        }})()"""
    )
    page.reload(wait_until="domcontentloaded")
    page.wait_for_timeout(1500)


def drive_interactions(page) -> None:
    """ITER136 · Deep Runtime Traversal™.

    Open every interactive surface that holds copy: tabs, collapsibles,
    drawers, dropdown menus, profile menus, dialog/modal triggers,
    tooltip-on-hover targets, command palette. Tries each surface a few
    times then collapses, so the next route gets a clean slate.
    """
    # 1. Primary tabs.
    try:
        for tb in page.query_selector_all('[role="tab"],[data-testid*="tab-"]')[:6]:
            try:
                tb.click(timeout=1200, force=True)
                page.wait_for_timeout(450)
            except Exception:
                pass
    except Exception:
        pass

    # 2. Collapsibles / accordions / hidden expanders.
    try:
        triggers = page.query_selector_all(
            '[data-state="closed"][aria-expanded="false"]'
        )
        for tr in triggers[:5]:
            try:
                tr.click(timeout=1200, force=True)
                page.wait_for_timeout(280)
            except Exception:
                pass
    except Exception:
        pass

    # 3. Dropdown / popover / select triggers (Radix uses aria-haspopup).
    try:
        triggers = page.query_selector_all(
            '[aria-haspopup="menu"], [aria-haspopup="listbox"], '
            '[aria-haspopup="dialog"], [data-radix-popper-content-wrapper]'
        )
        for tr in triggers[:4]:
            try:
                tr.click(timeout=1000, force=True)
                page.wait_for_timeout(420)
                # Press Escape to close.
                page.keyboard.press("Escape")
                page.wait_for_timeout(150)
            except Exception:
                pass
    except Exception:
        pass

    # 4. Generic dialog / drawer triggers (testid heuristic).
    try:
        for tr in page.query_selector_all(
            '[data-testid*="-open-"], [data-testid$="-open"], '
            '[data-testid$="-trigger"], [data-testid*="-drawer"], '
            '[data-testid*="-modal"], [data-testid*="open-"]'
        )[:3]:
            try:
                tr.click(timeout=900, force=True)
                page.wait_for_timeout(420)
                page.keyboard.press("Escape")
                page.wait_for_timeout(150)
            except Exception:
                pass
    except Exception:
        pass

    # 5. Profile / topbar menu.
    try:
        for sel in ('[data-testid*="profile-menu"]',
                    '[data-testid*="user-menu"]',
                    '[data-testid="topbar-menu"]',
                    '[aria-label="User menu"]'):
            el = page.query_selector(sel)
            if el:
                try:
                    el.click(timeout=900, force=True)
                    page.wait_for_timeout(380)
                    page.keyboard.press("Escape")
                except Exception:
                    pass
                break
    except Exception:
        pass

    # 6. Hover-card / tooltip surfaces (best effort: hover over the first
    #    few "info" markers per page).
    try:
        for el in page.query_selector_all(
            '[data-state="instant-open"], [aria-describedby*="tooltip"], '
            '[data-radix-tooltip-trigger]'
        )[:3]:
            try:
                el.hover(timeout=600, force=True)
                page.wait_for_timeout(300)
            except Exception:
                pass
    except Exception:
        pass

    # 7. Command palette / search palette.
    try:
        page.keyboard.press("Meta+K")
        page.wait_for_timeout(280)
        page.keyboard.press("Escape")
        page.wait_for_timeout(150)
    except Exception:
        pass


def harvest_one(page, key: str, url: str, payloads_by_route: dict) -> dict:
    errors: list = []
    console_msgs: list = []
    api_responses: list = []

    def on_pageerror(exc):
        errors.append({"kind": "page", "message": str(exc)[:600]})

    def on_console(msg):
        try:
            txt = msg.text
            if msg.type == "error" or txt.startswith("[LEAKAGE]") or txt.startswith("[i18n · STRICT]"):
                console_msgs.append({"type": msg.type, "text": txt[:600]})
        except Exception:
            pass

    def on_response(resp):
        try:
            u = resp.url
            if "/api/" not in u:
                return
            # These endpoints LEGITIMATELY return Italian source content
            # (Studio Voice memory, ALE translation memory, Language Command
            # Center registry, locale dictionaries). Excluding them is not
            # whitewashing — they are governance surfaces, not user-facing.
            if any(s in u for s in [
                "/auth/", "/i18n/", "lookups", "stream",
                "/voice/", "/ale/", "/language/", "/taxonomy/",
            ]):
                return
            # User/tenant-authored payloads where Italian is the source of
            # truth (addresses, profile names, project titles, branding,
            # storefront page content): they are NOT runtime leaks. The
            # editorial layer (ALE) is responsible for transforming them at
            # the rendering boundary — captured by the DOM walker above,
            # not by the network screen.
            user_data_paths = (
                "/branding", "/branding/presets",
                "/profile/me", "/auth/me",
                "/projects", "/relationships/accounts",
                "/storefront/public/", "/public/",
                "/inspirations/registry/", "/uploads/",
                "/tenant", "/users/",
            )
            if any(p in u for p in user_data_paths):
                return
            ct = (resp.headers.get("content-type") or "").lower()
            if "application/json" not in ct:
                return
            body = resp.text()
            if not body or len(body) > 200_000:
                return
            # High-signal threshold: need ≥3 Italian markers OR ≥4 accented
            # vowels in distinct words. Single accents pass too easily for
            # proper nouns ("Stefano", "Café") and unrelated unicode.
            marker_hits = len(IT_MARKERS_RX.findall(body))
            accent_hits = len(IT_ACCENT_RX.findall(body))
            if marker_hits >= 3 or accent_hits >= 4:
                api_responses.append({
                    "url": u, "status": resp.status,
                    "marker_hits": marker_hits, "accent_hits": accent_hits,
                    "body_excerpt": body[:1500],
                })
        except Exception:
            pass

    page.on("pageerror", on_pageerror)
    page.on("console", on_console)
    page.on("response", on_response)

    nav_error = None
    try:
        page.goto(f"{BASE}{url}", wait_until="domcontentloaded", timeout=30000)
    except Exception as e:
        nav_error = str(e)[:300]
    page.wait_for_timeout(4500)
    drive_interactions(page)
    page.wait_for_timeout(800)

    try:
        dom = page.evaluate(HARVEST_JS)
    except Exception as e:
        dom = {"italian_leaks": [], "raw_keys": [], "missing_tokens": [],
               "error_boundary": False, "_harvest_err": str(e)[:200]}

    shot = SHOT_DIR / f"{key}.jpg"
    try:
        page.screenshot(path=str(shot), quality=35, type="jpeg", full_page=False)
    except Exception:
        pass

    # Detach handlers (page is reused across routes).
    page.remove_listener("pageerror", on_pageerror)
    page.remove_listener("console", on_console)
    page.remove_listener("response", on_response)

    payloads_by_route[key] = api_responses
    return {
        "key": key,
        "url": url,
        "nav_error": nav_error,
        "italian_leaks":  dom.get("italian_leaks", []),
        "raw_keys":       dom.get("raw_keys", []),
        "missing_tokens": dom.get("missing_tokens", []),
        "error_boundary": dom.get("error_boundary", False),
        "console":        console_msgs[-50:],
        "page_errors":    errors[-20:],
        "api_leaks":      api_responses,
        "screenshot":     str(shot.relative_to(OUT_DIR)),
    }


UUID_TESTID_RX = re.compile(r"-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")


def classify(pages: list) -> list:
    findings = []
    for r in pages:
        for m in r.get("missing_tokens", []):
            findings.append({"kind": "MISSING_REGISTRY_KEY", "page": r["url"],
                             "text": m["text"], "testid": m.get("testid")})
        for m in r.get("raw_keys", []):
            findings.append({"kind": "INVALID_USE_TRANSLATION", "page": r["url"],
                             "text": m["text"], "testid": m.get("testid")})
        for m in r.get("italian_leaks", []):
            tid = m.get("testid") or ""
            # Row-level testids (containing a UUID) almost always mean the
            # text is rendered from a DB record, not from a hardcoded JSX
            # string. Classify as DB_SEEDED_CONTENT so the remediation
            # engine routes it through the ALE Localized Narrative path
            # instead of the AST sweep.
            kind = "DB_SEEDED_CONTENT" if UUID_TESTID_RX.search(tid) else "HARD_CODED_UI"
            findings.append({"kind": kind, "page": r["url"],
                             "text": m["text"], "testid": tid or None})
        for e in r.get("page_errors", []):
            msg = e.get("message", "")
            # Localization runtime crash: t/destructure/TypeError. Anything
            # else is an API or framework failure outside our scope here.
            if RUNTIME_ERR_RX.search(msg):
                findings.append({"kind": "RUNTIME_CRASH", "page": r["url"], "message": msg})
            else:
                findings.append({"kind": "API_FAILURE", "page": r["url"], "message": msg[:240]})
        for c in r.get("console", []):
            if RUNTIME_ERR_RX.search(c.get("text", "")):
                findings.append({"kind": "RUNTIME_CRASH", "page": r["url"],
                                 "message": c["text"]})
        for a in r.get("api_leaks", []):
            findings.append({"kind": "DB_SEEDED_CONTENT", "page": r["url"],
                             "url": a["url"],
                             "body_excerpt": a["body_excerpt"][:240]})
    return findings


def main() -> int:
    started = datetime.now(timezone.utc).isoformat(timespec="seconds")
    print(f"\n╭─ ITER132 · FULL RUNTIME CRAWLER · {LOCALE} · {BASE}")
    print(f"╰─ started_at={started}\n")

    payloads_by_route: dict = {}
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        try:
            authenticate(page)
        except Exception as e:
            print(f"   auth failed: {e}")
            browser.close()
            return 3

        pages = []
        for key, url in ROUTES:
            t0 = time.time()
            r = harvest_one(page, key, url, payloads_by_route)
            ms = int((time.time() - t0) * 1000)
            print(
                f"  · {key.ljust(22)} {url.ljust(36)} "
                f"IT={len(r['italian_leaks']):2d}  "
                f"MISS={len(r['missing_tokens']):2d}  "
                f"KEY={len(r['raw_keys']):2d}  "
                f"ERR={len(r['page_errors']):2d}  "
                f"DBL={len(r['api_leaks']):2d}  "
                f"{ms}ms"
            )
            pages.append(r)
        browser.close()

    findings = classify(pages)
    summary: dict = {}
    for f in findings:
        summary[f["kind"]] = summary.get(f["kind"], 0) + 1

    out = {
        "iteration": "ITER132",
        "locale": LOCALE,
        "base": BASE,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "routes_crawled": len(ROUTES),
        "summary": summary,
        "findings": findings,
        "pages": pages,
    }

    (OUT_DIR / "runtime-localization-report.json").write_text(
        json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (OUT_DIR / "runtime-localization-payloads.json").write_text(
        json.dumps(payloads_by_route, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    # Markdown remediation digest (human-readable).
    md = [
        f"# Runtime Localization Report · {LOCALE} · {out['generated_at']}",
        "",
        f"**Routes crawled**: {len(ROUTES)}",
        "",
        "## Summary",
        "",
        "| Category | Count |",
        "|---|---:|",
    ]
    for k, v in sorted(summary.items(), key=lambda x: -x[1]):
        md.append(f"| {k} | {v} |")
    md += ["", "## Findings by page", ""]
    for r in pages:
        if not any([r["italian_leaks"], r["raw_keys"], r["missing_tokens"],
                    r["page_errors"], r["api_leaks"]]):
            continue
        md.append(f"### {r['url']}  (`{r['key']}`)")
        md.append("")
        for cat, items, label in [
            ("HARD_CODED_UI",       r["italian_leaks"],  "Italian leaks (DOM)"),
            ("MISSING_REGISTRY_KEY", r["missing_tokens"], "Missing keys ⟦…⟧"),
            ("INVALID_USE_TRANSLATION", r["raw_keys"],  "Raw dotted keys rendered"),
        ]:
            if items:
                md.append(f"**{label}** · {len(items)}")
                md.append("")
                for it in items[:25]:
                    md.append(f"- `{it.get('testid') or '—'}` · «{it['text'][:140]}»")
                md.append("")
        if r["page_errors"]:
            md.append(f"**RUNTIME_CRASH** · {len(r['page_errors'])}")
            md.append("")
            for e in r["page_errors"][:6]:
                md.append(f"- {e['message'][:240]}")
            md.append("")
        if r["api_leaks"]:
            md.append(f"**DB_SEEDED_CONTENT** · {len(r['api_leaks'])} API responses with IT markers")
            md.append("")
            for a in r["api_leaks"][:6]:
                md.append(f"- `{a['url']}` · {a['body_excerpt'][:180]}…")
            md.append("")
    (OUT_DIR / "runtime-localization-remediation.md").write_text(
        "\n".join(md), encoding="utf-8"
    )

    print("\n┌─ SUMMARY")
    for k, v in sorted(summary.items(), key=lambda x: -x[1]):
        print(f"│  {k.ljust(28)} {v}")
    print(f"└─ Report: /app/governance/runtime-localization-report.json\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
