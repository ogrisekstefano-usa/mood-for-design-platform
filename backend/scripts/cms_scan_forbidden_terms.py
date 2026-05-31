"""
CMS Forbidden Terms Scanner
═══════════════════════════════════════════════════════════════════════
Scansiona `editorial_blocks` + `editorial_block_translations` per
terminologie residue vietate dal nuovo posizionamento.

FORBIDDEN_TERMS:
  • Atelier            (registro aulico obsoleto)
  • Maison             (registro aulico obsoleto)
  • Demo               (CTA non più consentita — caso-sensitive parziale)
  • Prenota Demo       (CTA obsoleta)
  • Richiedi Demo      (CTA obsoleta)
  • Richiedi una demo  (CTA obsoleta)

Output: report machine-readable su stdout (e file opzionale).

Compatibile con hold P0 (READ-ONLY — solo SELECT).

Usage:
  python3 cms_scan_forbidden_terms.py [--output /path/report.md]
"""
import os
import sys
import argparse
import psycopg2
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')

DATABASE_URL = os.environ.get('SESSION_POOLER_URL') or os.environ.get('DATABASE_URL')

# Case-insensitive needle list. Each tuple = (display_label, ilike_pattern)
FORBIDDEN = [
    ('Atelier',           '%atelier%'),
    ('Maison',            '%maison%'),
    ('Prenota Demo',      '%prenota demo%'),
    ('Richiedi Demo',     '%richiedi demo%'),
    ('Richiedi una demo', '%richiedi una demo%'),
    # 'Demo' last so phrase matches above don't double-count cleanly.
    # We use word boundaries for plain "demo" to avoid matching "democrazia" etc.
    ('Demo (word)',       '%\\mdemo\\M%'),  # tsquery-like; we will use regex
]


def scan_blocks(cur, term_label, pattern, is_regex=False):
    if is_regex:
        sql_blocks = """
            SELECT id, namespace, block_key, source_locale, source_value
            FROM editorial_blocks
            WHERE source_value ~* %s AND is_active = true
            ORDER BY namespace, block_key
        """
        sql_trans = """
            SELECT t.block_id, b.namespace, b.block_key, t.locale, t.value
            FROM editorial_block_translations t
            JOIN editorial_blocks b ON b.id = t.block_id
            WHERE t.value ~* %s AND b.is_active = true
            ORDER BY b.namespace, b.block_key, t.locale
        """
    else:
        sql_blocks = """
            SELECT id, namespace, block_key, source_locale, source_value
            FROM editorial_blocks
            WHERE LOWER(source_value) LIKE LOWER(%s) AND is_active = true
            ORDER BY namespace, block_key
        """
        sql_trans = """
            SELECT t.block_id, b.namespace, b.block_key, t.locale, t.value
            FROM editorial_block_translations t
            JOIN editorial_blocks b ON b.id = t.block_id
            WHERE LOWER(t.value) LIKE LOWER(%s) AND b.is_active = true
            ORDER BY b.namespace, b.block_key, t.locale
        """
    cur.execute(sql_blocks, (pattern,))
    blocks = cur.fetchall()
    cur.execute(sql_trans, (pattern,))
    trans = cur.fetchall()
    return blocks, trans


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default=None)
    args = parser.parse_args()

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    report = ["# CMS Forbidden Terms Scan Report\n"]
    report.append(f"_Run:_ {os.popen('date -u +%Y-%m-%dT%H:%M:%SZ').read().strip()}\n")

    totals = {}
    for label, pattern in FORBIDDEN:
        is_regex = label == 'Demo (word)'
        if is_regex:
            # Use POSIX word boundary regex \mdemo\M
            pattern = r'\mdemo\M'
        blocks, trans = scan_blocks(cur, label, pattern, is_regex=is_regex)
        count = len(blocks) + len(trans)
        totals[label] = count
        report.append(f"\n## `{label}` — {count} hit(s)\n")
        if blocks:
            report.append("\n### editorial_blocks.source_value\n")
            for b in blocks:
                _id, ns, key, loc, val = b
                snippet = (val or '').replace('\n', ' ')[:200]
                report.append(f"- **{ns}.{key}** _(source `{loc}`)_ — `{_id}`\n  > {snippet}\n")
        if trans:
            report.append("\n### editorial_block_translations.value\n")
            for t in trans:
                bid, ns, key, loc, val = t
                snippet = (val or '').replace('\n', ' ')[:200]
                report.append(f"- **{ns}.{key}** _(locale `{loc}`)_ — block `{bid}`\n  > {snippet}\n")

    total = sum(totals.values())
    report.insert(2, f"\n**TOTAL OCCURRENCES: {total}**\n")
    report.insert(3, "| Term | Hits |\n|---|---|\n" + "\n".join([f"| `{k}` | {v} |" for k, v in totals.items()]) + "\n")

    out = "\n".join(report)
    if args.output:
        with open(args.output, 'w') as f:
            f.write(out)
        print(f"Report written to {args.output}")
    print(out)

    cur.close()
    conn.close()
    sys.exit(0 if total == 0 else 2)


if __name__ == '__main__':
    main()
