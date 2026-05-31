#!/usr/bin/env python3
"""ITER177.B · COPY LINT™ — report-only governance for MOOD copy.

Scans the codebase for tone-of-voice violations defined in
`/app/memory/GLOBAL_COPY_AUDIT.md §6.3`.

Usage:
    python3 scripts/copy_lint.py                 # full repo scan
    python3 scripts/copy_lint.py --path frontend # subset
    python3 scripts/copy_lint.py --json          # machine-readable output
    python3 scripts/copy_lint.py --strict        # exit code 1 if violations found
    python3 scripts/copy_lint.py --baseline FILE # only flag NEW violations vs baseline

This script NEVER blocks builds by default. CI must invoke `--strict` only
once the existing baseline is acknowledged.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from collections import Counter, defaultdict

# ── Configuration ─────────────────────────────────────────────────────
# Forbidden patterns (word-boundary, case-insensitive). Each entry:
#   (pattern_regex, severity, advice)
BLACKLIST = [
    (r"\bcapitolo\b",           "high",     "use 'progetto' / 'sezione' / 'step' / 'fase' (Magazine module exempt)"),
    (r"\batmosfera\b",          "medium",   "use 'stile' / 'mood' / 'impostazione visiva' (Magazine/Mood module exempt)"),
    (r"\bcinematic\w*\b",       "high",     "drop ornamental qualifier"),
    (r"\bcinematog\w+\b",       "high",     "drop ornamental qualifier"),
    (r"\becosistema\b",         "medium",   "use 'sistema' / 'piattaforma' / 'area'"),
    (r"\borchestraz\w+\b",      "high",     "use 'configurazione' / 'elenco' / 'catalogo'"),
    (r"\borchestrat\w+\b",      "high",     "use 'configurato' / 'gestito'"),
    (r"\btemperamento\b",       "high",     "use 'configurazione' / 'profilo'"),
    (r"\bcuratorial\w+\b",      "medium",   "Magazine only — elsewhere use 'selezionato' / 'scelto'"),
    (r"\bcuratoriale\b",        "medium",   "Magazine only — elsewhere use 'selezionato' / 'scelto'"),
    (r"\bsussurr\w+\b",         "high",     "drop metaphorical verb"),
    (r"\brespirar?\w*\b",       "medium",   "drop metaphorical verb (use literal verb)"),
    (r"\brespira\b",            "medium",   "drop metaphorical verb"),
    (r"prende forma",           "high",     "use 'inizia' / 'si configura'"),
    (r"\bnarrazione\b",         "medium",   "use 'descrizione' / 'contenuto'"),
    (r"\brituale\b",            "high",     "use 'procedura' / 'processo'"),
    (r"\bStudio Identity\b",    "high",     "deprecated — use 'Blueprint Chameleon' (ITER177.B rebrand)"),
    (r"\bdisvel\w+\b",          "high",     "drop metaphor"),
    (r"\bsvelar\w+\b",          "medium",   "use 'mostrare' / 'rivelare'"),
    (r"\binizia la narrazione\b","high",    "use 'aggiungi il primo blocco' or domain-specific"),
]

# Exempted file patterns (Magazine + Editorial Calendar may use editorial register)
EXEMPT_PATHS = [
    r"/magazine/",
    r"/editorial/",
    r"/editorial_calendar",
    r"/i18n/EditorialDebug",
    r"/site/HomePageLegacy",  # legacy marketing copy — reviewed separately
    r"COPY_LINT_SPEC\.md",
    r"GLOBAL_COPY_AUDIT\.md",
    r"copy_lint\.py",
    # ITER179 · v1.1 false-positive guards
    r"/CinematicLoader",                  # canonical component name
    r"/JourneyCanonicalRoutes",           # route file (only component imports)
    r"premiumTemplates\.js",              # asset keys + brand-canonical collection names
    r"/blueprint/sections/MagazineGridSection",  # CSS var --bp-duration-cinematic
    r"/blueprint/sections/GallerySection",
    r"/blueprint/forms/fields/StyleCardsField",
    r"/pages/settings/AtelierDashboardAdminPage",  # admin layout variants
    r"/pages/site/JourneyWelcomePage",    # canonical map keys
]

# File extensions to scan
SCAN_EXTS = {".jsx", ".tsx", ".js", ".ts", ".json", ".py"}

# Subdirectories to skip
SKIP_DIRS = {"node_modules", ".git", "__pycache__", "build", "dist", ".cache",
             "frontend/node_modules", ".emergent", "venv", ".venv"}


def is_exempt(rel_path: str) -> bool:
    return any(re.search(p, rel_path) for p in EXEMPT_PATHS)


def scan_file(path: Path, root: Path):
    rel = str(path.relative_to(root))
    if is_exempt(rel):
        return []
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return []
    findings = []
    for ln_idx, line in enumerate(text.splitlines(), start=1):
        # Quick skip of obvious non-copy lines (imports, comments-only, etc.)
        if not line.strip():
            continue
        # Only inspect lines that look like they contain strings
        if ('"' not in line and "'" not in line and "`" not in line
                and not path.suffix == ".json"):
            continue
        for pattern, severity, advice in BLACKLIST:
            for m in re.finditer(pattern, line, re.IGNORECASE):
                findings.append({
                    "file": rel,
                    "line": ln_idx,
                    "col": m.start() + 1,
                    "match": m.group(0),
                    "pattern": pattern,
                    "severity": severity,
                    "advice": advice,
                    "context": line.strip()[:200],
                })
    return findings


def scan_repo(root: Path, scope: Path):
    findings = []
    for dirpath, dirnames, filenames in os.walk(scope):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            p = Path(dirpath) / fn
            if p.suffix not in SCAN_EXTS:
                continue
            findings.extend(scan_file(p, root))
    return findings


def print_text_report(findings):
    if not findings:
        print("✓ COPY_LINT · 0 violations found")
        return
    by_severity = Counter(f["severity"] for f in findings)
    by_pattern = Counter(f["pattern"] for f in findings)
    by_file = Counter(f["file"] for f in findings)

    print(f"COPY_LINT · {len(findings)} violations across {len(by_file)} files\n")
    print("Severity distribution:")
    for sev, n in by_severity.most_common():
        emoji = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}.get(sev, "·")
        print(f"  {emoji} {sev:8s}: {n}")
    print("\nTop violated patterns:")
    for pat, n in by_pattern.most_common(10):
        print(f"  {n:4d}× {pat}")
    print("\nTop violating files:")
    for f, n in by_file.most_common(15):
        print(f"  {n:4d}× {f}")
    print("\nUse --json for full machine-readable output.")


def load_baseline(path: Path):
    if not path or not path.exists():
        return None
    with open(path) as f:
        return json.load(f)


def filter_new(findings, baseline):
    if not baseline:
        return findings
    baseline_keys = {
        (f["file"], f["line"], f["match"]) for f in baseline.get("findings", [])
    }
    return [f for f in findings if (f["file"], f["line"], f["match"]) not in baseline_keys]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--path", default=".", help="Root path to scan (default: current dir)")
    parser.add_argument("--root", default=None, help="Repo root (for relative paths). Defaults to --path.")
    parser.add_argument("--json", action="store_true", help="Output JSON")
    parser.add_argument("--strict", action="store_true", help="Exit 1 if any violation")
    parser.add_argument("--baseline", default=None, help="Baseline JSON to compare against (only flag new)")
    parser.add_argument("--write-baseline", default=None, help="Write current findings as baseline JSON")
    args = parser.parse_args()

    scope = Path(args.path).resolve()
    root = Path(args.root).resolve() if args.root else scope

    findings = scan_repo(root, scope)
    baseline = load_baseline(Path(args.baseline)) if args.baseline else None
    if baseline:
        new_findings = filter_new(findings, baseline)
    else:
        new_findings = findings

    if args.write_baseline:
        Path(args.write_baseline).write_text(json.dumps({
            "version": 1,
            "count": len(findings),
            "findings": findings,
        }, indent=2, ensure_ascii=False))
        print(f"Baseline written to {args.write_baseline} ({len(findings)} findings)")
        return 0

    if args.json:
        print(json.dumps({
            "total": len(findings),
            "new": len(new_findings),
            "findings": new_findings if baseline else findings,
        }, indent=2, ensure_ascii=False))
    else:
        if baseline:
            print(f"Baseline: {baseline.get('count', 0)} known violations.")
            print(f"NEW violations vs baseline: {len(new_findings)}")
            print()
        print_text_report(new_findings if baseline else findings)

    if args.strict and (new_findings if baseline else findings):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
