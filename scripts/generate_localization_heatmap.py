#!/usr/bin/env python3
"""
SPRINT ITER132 · Localization Heatmap Generator™

Reads /app/governance/runtime-localization-report.json and the SQLite
leak DB at runtime_leaks.db, produces a static HTML heatmap at:

  /app/governance/runtime-localization-heatmap.html

Visual: editorial atelier style — dark surface, gold accents — one row per
route, severity-coloured swatches per leak class, expandable rows with
testid + excerpt. Static, single file, no JS framework, no external deps.
"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from html import escape
from pathlib import Path


GOV = Path("/app/governance")
REPORT = GOV / "runtime-localization-report.json"
DB = GOV / "runtime_leaks.db"
OUT = GOV / "runtime-localization-heatmap.html"

SEVERITY = {
    "RUNTIME_CRASH":           ("#c25b5b", "P0 · CRASH"),
    "INVALID_USE_TRANSLATION": ("#d97b3a", "P0 · RAW KEY"),
    "MISSING_REGISTRY_KEY":    ("#d9b285", "P0 · MISSING"),
    "DB_SEEDED_CONTENT":       ("#7b9aa6", "P1 · DB SEED"),
    "HARD_CODED_UI":           ("#a4775e", "P1 · IT LEAK"),
}


def severity_for(counts: dict) -> str:
    if counts.get("RUNTIME_CRASH"):  return "#c25b5b"
    if counts.get("INVALID_USE_TRANSLATION") or counts.get("MISSING_REGISTRY_KEY"):
        return "#d9b285"
    if counts.get("HARD_CODED_UI") or counts.get("DB_SEEDED_CONTENT"):
        return "#7b9aa6"
    return "#3d8b6a"


def main() -> int:
    if not REPORT.exists():
        print("× no report — run crawler first")
        return 2
    report = json.loads(REPORT.read_text("utf-8"))

    # Iteration history from DB.
    iterations = []
    if DB.exists():
        conn = sqlite3.connect(str(DB))
        for row in conn.execute(
            "SELECT n, started_at, finished_at, summary_json FROM iterations ORDER BY n"
        ):
            iterations.append({
                "n": row[0], "started_at": row[1], "finished_at": row[2],
                "summary": json.loads(row[3] or "{}"),
            })
        # leak tallies.
        all_leaks = conn.execute(
            "SELECT kind, page, text, testid, source, severity, "
            "first_seen, last_seen, resolution_method, occurrences "
            "FROM leaks ORDER BY last_seen DESC LIMIT 300"
        ).fetchall()
        conn.close()
    else:
        all_leaks = []

    summary = report.get("summary", {})
    pages = report.get("pages", [])
    locale = report.get("locale")
    generated_at = report.get("generated_at")

    # Build per-page severity counts.
    rows_html: list[str] = []
    for p in pages:
        per_kind = {
            "RUNTIME_CRASH":           len(p.get("page_errors", [])),
            "INVALID_USE_TRANSLATION": len(p.get("raw_keys", [])),
            "MISSING_REGISTRY_KEY":    len(p.get("missing_tokens", [])),
            "HARD_CODED_UI":           len(p.get("italian_leaks", [])),
            "DB_SEEDED_CONTENT":       len(p.get("api_leaks", [])),
        }
        sev_color = severity_for(per_kind)
        swatches = "".join(
            f'<span class="swatch" style="background:{SEVERITY[k][0]};opacity:{0.92 if c else 0.18}" '
            f'title="{escape(SEVERITY[k][1])} · {c}">{c if c else "·"}</span>'
            for k, c in per_kind.items()
        )

        # leak detail bullets
        bullets = []
        for k, items_key, label in [
            ("RUNTIME_CRASH",           "page_errors",  "Runtime crash"),
            ("INVALID_USE_TRANSLATION", "raw_keys",     "Raw key rendered"),
            ("MISSING_REGISTRY_KEY",    "missing_tokens","Missing key"),
            ("HARD_CODED_UI",           "italian_leaks", "Italian leak"),
            ("DB_SEEDED_CONTENT",       "api_leaks",    "DB seed (API)"),
        ]:
            it_list = p.get(items_key) or []
            for it in it_list[:12]:
                if k == "RUNTIME_CRASH":
                    bullets.append(
                        f'<li><span class="kind" style="color:{SEVERITY[k][0]}">{label}</span> '
                        f'<code>{escape(it.get("message", "")[:200])}</code></li>'
                    )
                elif k == "DB_SEEDED_CONTENT":
                    bullets.append(
                        f'<li><span class="kind" style="color:{SEVERITY[k][0]}">{label}</span> '
                        f'<code>{escape(it.get("url", "")[:200])}</code></li>'
                    )
                else:
                    bullets.append(
                        f'<li><span class="kind" style="color:{SEVERITY[k][0]}">{label}</span> '
                        f'<code>{escape((it.get("testid") or "—")[:80])}</code> · '
                        f'«{escape(it.get("text","")[:140])}»</li>'
                    )

        bullets_html = "".join(bullets) or '<li class="ok">No leaks detected</li>'
        rows_html.append(f"""
          <details class="route" data-key="{escape(p['key'])}">
            <summary>
              <span class="dot" style="background:{sev_color}"></span>
              <span class="path"><code>{escape(p['url'])}</code></span>
              <span class="meta">{swatches}</span>
            </summary>
            <div class="detail">
              <ul class="bullets">{bullets_html}</ul>
              <a class="shot" href="{escape(p.get('screenshot') or '')}">screenshot →</a>
            </div>
          </details>
        """)

    # History table.
    history_rows = "".join(
        f"<tr><td>{it['n']}</td><td><code>{escape(it.get('started_at') or '')}</code></td>"
        f"<td><code>{escape(json.dumps(it.get('summary') or {}, ensure_ascii=False))}</code></td></tr>"
        for it in iterations[-10:]
    ) or "<tr><td colspan='3' class='ok'>No iterations recorded yet.</td></tr>"

    # Top open leaks.
    open_leaks_rows = []
    for k, page, text, testid, source, sev, first, last, res, occ in all_leaks:
        if res:
            continue
        color = SEVERITY.get(k, ("#888",))[0]
        open_leaks_rows.append(
            f"<tr><td style='color:{color}'>{escape(k)}</td>"
            f"<td><code>{escape(page or '')}</code></td>"
            f"<td>«{escape((text or '')[:120])}»</td>"
            f"<td><code>{escape(testid or '—')}</code></td>"
            f"<td>{occ}</td></tr>"
        )
    open_leaks_html = "".join(open_leaks_rows[:60]) or "<tr><td colspan='5' class='ok'>No open leaks.</td></tr>"

    summary_chips = "".join(
        f'<span class="chip" style="border-color:{SEVERITY.get(k,("#888",))[0]};color:{SEVERITY.get(k,("#888",))[0]}">'
        f'{escape(k)} · {v}</span>'
        for k, v in sorted(summary.items(), key=lambda x: -x[1])
    ) or '<span class="chip chip-zero">Zero leaks.</span>'

    crit_total = sum(v for k, v in summary.items()
                     if k in ("RUNTIME_CRASH", "INVALID_USE_TRANSLATION", "MISSING_REGISTRY_KEY"))
    headline = "CONVERGED · MISS 0 · LEAK 0" if crit_total == 0 else f"OPEN · {crit_total} P0 leaks"
    headline_color = "#3d8b6a" if crit_total == 0 else "#c25b5b"

    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Runtime Localization Heatmap™ · {escape(locale or '')}</title>
<style>
  :root {{
    --bg: #0c0e11; --surface: #11141a; --border: rgba(255,255,255,0.06);
    --text: #f0ebe0; --muted: rgba(240,235,224,0.55); --accent: #d9b285;
  }}
  * {{ box-sizing: border-box; }}
  body {{ background: var(--bg); color: var(--text); font-family: ui-monospace, Menlo, monospace; margin: 0; padding: 56px 64px; }}
  h1 {{ font-family: 'Playfair Display', serif; font-weight: 400; font-size: 44px; letter-spacing: -0.01em; margin: 0 0 8px; }}
  h2 {{ font-family: 'Playfair Display', serif; font-weight: 400; font-size: 22px; margin: 64px 0 18px; letter-spacing: -0.005em; }}
  .eyebrow {{ text-transform: uppercase; letter-spacing: 0.32em; font-size: 10px; color: var(--accent); margin: 0 0 12px; }}
  .lede {{ color: var(--muted); font-size: 13px; line-height: 1.7; max-width: 78ch; font-family: ui-sans-serif, system-ui; }}
  .headline {{ display: inline-block; margin-top: 24px; padding: 14px 22px; border: 1px solid {headline_color}; color: {headline_color}; letter-spacing: 0.18em; font-size: 11px; text-transform: uppercase; }}
  .chips {{ margin: 26px 0; display: flex; flex-wrap: wrap; gap: 10px; }}
  .chip {{ padding: 6px 12px; border: 1px solid; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.18em; }}
  .chip-zero {{ border-color: #3d8b6a; color: #3d8b6a; }}
  .route {{ border-top: 1px solid var(--border); padding: 14px 0; }}
  .route summary {{ cursor: pointer; list-style: none; display: grid; grid-template-columns: 16px 1fr auto; align-items: center; gap: 18px; }}
  .route summary::-webkit-details-marker {{ display: none; }}
  .dot {{ width: 9px; height: 9px; border-radius: 50%; }}
  .path code {{ font-size: 13px; color: var(--text); }}
  .meta {{ display: flex; gap: 6px; }}
  .swatch {{ display: inline-flex; align-items: center; justify-content: center; min-width: 28px; height: 22px; font-size: 10px; letter-spacing: 0.08em; padding: 0 6px; color: var(--bg); font-weight: 600; }}
  .detail {{ padding: 18px 0 6px 36px; }}
  .bullets {{ margin: 0; padding: 0; list-style: none; }}
  .bullets li {{ padding: 6px 0; font-size: 12px; color: var(--muted); border-bottom: 1px dashed rgba(255,255,255,0.04); }}
  .bullets li.ok {{ color: #3d8b6a; }}
  .bullets .kind {{ display: inline-block; min-width: 130px; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.18em; }}
  .bullets code {{ color: var(--text); background: rgba(255,255,255,0.03); padding: 1px 6px; }}
  .shot {{ font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; color: var(--accent); text-decoration: none; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 11.5px; }}
  th, td {{ padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--border); }}
  th {{ color: var(--accent); text-transform: uppercase; letter-spacing: 0.22em; font-size: 9.5px; font-weight: 400; }}
  td.ok {{ color: #3d8b6a; }}
  code {{ font-size: 11px; }}
  footer {{ margin-top: 72px; color: rgba(240,235,224,0.32); font-size: 10.5px; letter-spacing: 0.18em; text-transform: uppercase; }}
</style>
</head>
<body>
  <p class="eyebrow">Blueprint Command Center™ · Localization Governance</p>
  <h1>Runtime Localization Heatmap™</h1>
  <p class="lede">Live signal from the autonomous remediation loop. Each route is crawled in <code>{escape(locale or 'en-US')}</code>, the DOM walked for IT leaks, raw keys, missing tokens, runtime crashes; API responses screened for Italian seed content. The swatches read left-to-right as: crash · raw key · missing · IT leak · DB seed.</p>
  <div class="headline">{headline}</div>
  <div class="chips">{summary_chips}</div>

  <h2>Routes · Severity Map</h2>
  {''.join(rows_html)}

  <h2>Iteration history</h2>
  <table>
    <thead><tr><th>#</th><th>Started</th><th>Summary</th></tr></thead>
    <tbody>{history_rows}</tbody>
  </table>

  <h2>Open leaks (top 60)</h2>
  <table>
    <thead><tr><th>Kind</th><th>Page</th><th>Text</th><th>Testid</th><th>×</th></tr></thead>
    <tbody>{open_leaks_html}</tbody>
  </table>

  <footer>Generated {escape(generated_at or datetime.now(timezone.utc).isoformat(timespec="seconds"))}</footer>
</body>
</html>
"""
    OUT.write_text(html, encoding="utf-8")
    print(f"✓ heatmap written: {OUT}")
    return 0


if __name__ == "__main__":
    main()
