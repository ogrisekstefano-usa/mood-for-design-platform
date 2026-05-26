#!/usr/bin/env python3
"""
ITER155.R3 · Semantic Hardcoded Audit™ — scanner.

Walks /app/frontend/src to produce a per-surface "Hardcoded Heatmap™"
report classifying narrative strings into three buckets:

  A · Core Narrative      🔴 highest priority
  B · Operational UI      🟡 medium
  C · Dev / Temporary     🟢 low

Outputs:
  /app/memory/editorial_audit/heatmap.json
  /app/memory/editorial_audit/heatmap.md
"""
from __future__ import annotations
import json
import os
import re
from collections import defaultdict
from pathlib import Path

SRC = Path("/app/frontend/src")
OUT = Path("/app/memory/editorial_audit")
OUT.mkdir(parents=True, exist_ok=True)

# ── Surfaces: glob patterns → human label ──────────────────────────────
SURFACES = [
    ("Dashboard",          ["pages/dashboard/**/*.jsx", "components/dashboard/**/*.jsx"]),
    ("First Moves",        ["components/onboarding/FirstMoves*.jsx", "components/onboarding/first-moves*.jsx"]),
    ("Guided Tour",        ["components/onboarding/GuidedTour*.jsx"]),
    ("Notifications",      ["components/notifications/**/*.jsx", "components/**/Notification*.jsx"]),
    ("Client Portal",      ["pages/client/**/*.jsx", "components/client/**/*.jsx"]),
    ("Design Journey",     ["pages/journey/**/*.jsx", "components/journey/**/*.jsx"]),
    ("Public Marketing",   ["site/**/*.jsx", "pages/site/**/*.jsx"]),
    ("Auth",               ["pages/auth/**/*.jsx"]),
    ("Editorial Copy CMS", ["pages/admin/EditorialCopy*.jsx"]),
]

# Strings used to skip noise (imports, tailwind classes, etc.)
SKIP_LINE_RX  = re.compile(r"^\s*(import |from |\* |//|/\*|\*/|export (type|const)|require\()")
SKIP_VALUE_RX = re.compile(
    r"^(true|false|null|undefined|[#0-9./%-]+|\s*)$|"
    r"^(text-|bg-|flex|grid|w-|h-|p-|m-|gap-|border|rounded|shadow|hover:|focus:|"
    r"sm:|md:|lg:|xl:|absolute|relative|fixed|sticky|opacity-|font-|leading-|tracking-)",
    re.IGNORECASE,
)
JSX_TEXT_RX   = re.compile(r">([^<>{}\n]{3,})<")
PROP_TEXT_RX  = re.compile(r'(?:placeholder|title|aria-label|alt|tooltip|label|description|name)=["\']([^"\'<>]{3,})["\']')
TEMPLATE_TEXT_RX = re.compile(r"`([^`{}]{3,})`")

# Category-A vocabulary fingerprints (curatorial / narrative)
CAT_A_RX = re.compile(
    r"\b(Atelier|Studio|Journey|Blueprint|Design|Cliente|Voci|Voce|Inizia|Benvenuto|Bentornato|"
    r"Welcome|Saluto|Discover|Crea|Progett|Esperienza|Storia|Tour|Inspir|Direzion|Memoria|"
    r"Relazione|Companion|Pulse|Materia|Moodboard|Hero|Eyebrow|Manifesto)\b",
    re.IGNORECASE,
)
# Category-C dev / debug fingerprints
CAT_C_RX = re.compile(
    r"^(TODO|FIXME|DEBUG|console|test|tmp|placeholder|coming soon)$",
    re.IGNORECASE,
)

# t() / useT call pattern - if a string is wrapped in t('...') we IGNORE it
T_CALL_RX = re.compile(r"\bt\(\s*['\"`]")


def classify(s: str) -> str:
    s2 = s.strip()
    if CAT_C_RX.search(s2):
        return "C"
    if CAT_A_RX.search(s2):
        return "A"
    return "B"


def is_meaningful_string(s: str) -> bool:
    s2 = s.strip()
    if len(s2) < 3:
        return False
    if SKIP_VALUE_RX.match(s2):
        return False
    # require at least one space or capital letter (real human language)
    if " " not in s2 and not re.search(r"[A-Z][a-z]", s2):
        # short single tokens are too noisy
        if len(s2) < 8:
            return False
    return True


def scan_file(path: Path) -> list[dict]:
    findings = []
    try:
        src = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return findings
    # Skip strings already wrapped in t(...). We approximate by removing
    # those calls from the buffer before regex-matching.
    sanitized = re.sub(r"\bt\([^)]*\)", "t(REPLACED)", src)
    for line_no, line in enumerate(sanitized.splitlines(), 1):
        if SKIP_LINE_RX.match(line):
            continue
        for rx in (JSX_TEXT_RX, PROP_TEXT_RX, TEMPLATE_TEXT_RX):
            for m in rx.finditer(line):
                val = m.group(1).strip()
                if not is_meaningful_string(val):
                    continue
                # Skip placeholders / interpolations / JSX expressions
                if "{" in val or "}" in val:
                    continue
                # Skip if it is a CSS-like or HTML id
                if val.startswith(("aria-", "data-", "on", "id=")):
                    continue
                findings.append({
                    "file": str(path.relative_to(SRC)),
                    "line": line_no,
                    "value": val,
                    "category": classify(val),
                })
    return findings


def collect_for_surface(globs: list[str]) -> list[Path]:
    files: set[Path] = set()
    for g in globs:
        for p in SRC.glob(g):
            if p.suffix in {".jsx", ".js"}:
                files.add(p)
    return sorted(files)


def main() -> None:
    report = []
    for label, globs in SURFACES:
        files = collect_for_surface(globs)
        all_findings: list[dict] = []
        for p in files:
            all_findings.extend(scan_file(p))
        by_cat = defaultdict(int)
        for f in all_findings:
            by_cat[f["category"]] += 1
        top = sorted(all_findings,
                     key=lambda x: (0 if x["category"] == "A" else 1 if x["category"] == "B" else 2,
                                    -len(x["value"])))[:8]
        report.append({
            "surface":         label,
            "files_scanned":   len(files),
            "hardcoded_count": len(all_findings),
            "category_a":      by_cat["A"],
            "category_b":      by_cat["B"],
            "category_c":      by_cat["C"],
            "top_offenders":   top,
        })

    OUT.joinpath("heatmap.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    # Markdown report
    md_lines = [
        "# Hardcoded Heatmap™",
        "",
        "_Generated by `scripts/editorial_audit.py` — ITER155.R3 · Semantic Hardcoded Audit™._",
        "",
        "| Surface | Files | Total | 🔴 A · Narrative | 🟡 B · Operational | 🟢 C · Dev |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for r in report:
        md_lines.append(
            f"| **{r['surface']}** | {r['files_scanned']} | {r['hardcoded_count']} | "
            f"{r['category_a']} | {r['category_b']} | {r['category_c']} |"
        )
    md_lines.append("")
    md_lines.append("## Top offenders per surface (Category A first)")
    for r in report:
        if not r["top_offenders"]:
            continue
        md_lines.append(f"\n### {r['surface']}")
        for t in r["top_offenders"]:
            md_lines.append(f"- **[{t['category']}]** `{t['file']}:{t['line']}` — _{t['value'][:90]}_")
    OUT.joinpath("heatmap.md").write_text("\n".join(md_lines), encoding="utf-8")

    # Console summary
    print("# Hardcoded Heatmap™")
    for r in report:
        print(f"{r['surface']:<22} files={r['files_scanned']:>3}  total={r['hardcoded_count']:>4}"
              f"  A={r['category_a']:>3}  B={r['category_b']:>3}  C={r['category_c']:>3}")


if __name__ == "__main__":
    main()
