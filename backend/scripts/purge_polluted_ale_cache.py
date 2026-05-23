"""Purge polluted ALE cache entries.

ITER139 · Cache hygiene — find rows in `editorial_translations` whose
`translated_text` looks like an LLM preamble leak (system prompt
acknowledgement, "Ready. Paste...", "I am your editorial translator…",
bullet-list dumps, etc.) and DELETE them so subsequent ALE calls
re-translate cleanly.
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / '.env')

import psycopg2
from services.editorial_translation_layer import looks_like_llm_preamble

DB_URL = os.environ['DATABASE_URL']
conn = psycopg2.connect(DB_URL)
conn.autocommit = False
cur = conn.cursor()

cur.execute("""
    SELECT id, content_hash, source_text, translated_text, target_locale
      FROM editorial_translations
""")
rows = cur.fetchall()
polluted_ids = []
for rid, h, src, tgt_text, locale in rows:
    if looks_like_llm_preamble(tgt_text or '', src or ''):
        polluted_ids.append(rid)
        print(f"  POLLUTED · {h[:10]} · {locale} · src=({len(src or '')}ch) trans=({len(tgt_text or '')}ch)")

print(f"\nTotal scanned: {len(rows)}  · polluted: {len(polluted_ids)}")
if polluted_ids:
    cur.execute(
        "DELETE FROM editorial_translations WHERE id = ANY(%s::uuid[])",
        ([str(x) for x in polluted_ids],),
    )
    conn.commit()
    print(f"🧹  Deleted {len(polluted_ids)} polluted entries.")
else:
    print("✅  No polluted entries found.")

cur.close()
conn.close()
