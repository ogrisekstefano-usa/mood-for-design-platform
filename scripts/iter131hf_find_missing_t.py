#!/usr/bin/env python3
"""ITER131hf · Find every React function that *uses* t(...) but does NOT
destructure `useT()` in its own scope (or receive `t` as a prop / parameter).

Why: the AST remediator earlier in this codebase auto-rewrote string
literals to t('...') calls without ensuring `t` was actually in scope.
The result: scattered `TypeError: t is not a function` crashes at
runtime as soon as the offending branch renders.

This scanner is regex-driven and intentionally conservative: it reports
suspects, the human (or another agent) decides.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path('/app/frontend/src')

# Match component/function declarations.
# Capture: type, name, args (so we can detect a `t` prop in the destructuring).
COMP_RE = re.compile(
    r"""
    (?:^|\n)
    (?:export\s+)?                              # optional export
    (?:const|let|function)\s+
    ([A-Z][A-Za-z0-9_]*)\s*                     # 1. Pascal-case name (component)
    (?:=\s*)?
    (?:\(\s*)?                                  # opening paren
    (?:\{?\s*([^}\)]*?)\s*\}?)?                 # 2. arg/destructuring contents
    \s*\)?\s*=>\s*\{?                            # arrow + body
    """,
    re.X | re.M,
)
USE_T_DESTRUCTURE = re.compile(r"\b(?:const|let)\s*\{\s*[^}]*\bt\b[^}]*\}\s*=\s*useT\s*\(\s*\)")
T_CALL = re.compile(r"\bt\s*\(\s*['\"`]")
HOOK_INDICATOR = re.compile(r"\buse[A-Z][a-zA-Z0-9_]+\s*\(")

REPORT = []


def scan_file(p: Path) -> None:
    src = p.read_text(encoding='utf-8')
    if not T_CALL.search(src):
        return
    # Walk through top-level component declarations.
    matches = list(COMP_RE.finditer(src))
    if not matches:
        return
    for i, m in enumerate(matches):
        name = m.group(1)
        args = m.group(2) or ''
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(src)
        body = src[start:end]
        if not T_CALL.search(body):
            continue
        # If the args contain a destructured `t`, fine.
        if re.search(r"(^|,|\{)\s*t\s*(=|,|\})", args):
            continue
        # If body destructures useT, fine.
        if USE_T_DESTRUCTURE.search(body):
            continue
        # Is this even a component (uses other hooks or returns JSX)?
        looks_like_component = bool(re.search(r"<[A-Za-z]", body))
        REPORT.append({
            'file':   str(p.relative_to(Path('/app/frontend'))),
            'name':   name,
            'kind':   'component' if looks_like_component else 'function',
            'first_t_offset': T_CALL.search(body).start(),
        })


def main():
    targets = list(ROOT.rglob('*.jsx')) + list(ROOT.rglob('*.js'))
    for p in targets:
        if 'node_modules' in p.parts or '__pycache__' in p.parts:
            continue
        try:
            scan_file(p)
        except Exception as e:
            print(f'! {p}: {e}', file=sys.stderr)

    by_file = {}
    for r in REPORT:
        by_file.setdefault(r['file'], []).append(r)

    print(f'Components calling t(...) without t in scope: {len(REPORT)}')
    for fpath, rows in sorted(by_file.items()):
        print(f"\n· {fpath}")
        for r in rows:
            print(f"    · {r['kind']:9s} {r['name']}")

    return REPORT


if __name__ == '__main__':
    main()
