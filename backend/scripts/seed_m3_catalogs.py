"""Seed M3 catalogs — platform_activity_sources + platform_activity_outcomes.

Idempotent UPSERT. Run: `python scripts/seed_m3_catalogs.py`
"""
from __future__ import annotations
import asyncio, os, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")
import asyncpg

DATABASE_URL = os.environ["DATABASE_URL"]

SOURCES = [
    # (code,        label_it,    label_en,    icon,             sort)
    ("manual",      "Manuale",   "Manual",    "edit",            10),
    ("founder",     "Founder",   "Founder",   "user-circle",     20),
    ("advisor",     "Advisor",   "Advisor",   "briefcase",       30),
    ("admin",       "Admin",     "Admin",     "shield",          40),
    ("email",       "Email",     "Email",     "mail",            50),
    ("whatsapp",    "WhatsApp",  "WhatsApp",  "message-circle",  60),
    ("linkedin",    "LinkedIn",  "LinkedIn",  "linkedin",        70),
    ("import",      "Import",    "Import",    "upload",          80),
    ("api",         "API",       "API",       "code",            90),
    ("system",      "Sistema",   "System",    "cog",            100),
]

OUTCOMES = [
    # (code,                  label_it,             label_en,           color,      is_terminal, sort)
    ("completed",             "Completato",         "Completed",        "#10b981",  True,        10),
    ("pending",               "In sospeso",         "Pending",          "#eab308",  False,       20),
    ("no_response",           "Nessuna risposta",   "No response",      "#94a3b8",  False,       30),
    ("interested",            "Interessato",        "Interested",       "#3b82f6",  False,       40),
    ("not_interested",        "Non interessato",    "Not interested",   "#ef4444",  True,        50),
    ("follow_up_required",    "Richiede follow-up", "Follow-up required","#f97316", False,       60),
]


async def main() -> None:
    c = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    try:
        n_src = 0
        for code, lit, len_, icon, sort in SOURCES:
            await c.execute("""
                INSERT INTO platform_activity_sources (code, label_it, label_en, icon, sort_order, enabled)
                VALUES ($1, $2, $3, $4, $5, TRUE)
                ON CONFLICT (code) DO UPDATE
                  SET label_it = EXCLUDED.label_it, label_en = EXCLUDED.label_en,
                      icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order
            """, code, lit, len_, icon, sort)
            n_src += 1
        print(f"[OK] platform_activity_sources upserted: {n_src}/{len(SOURCES)}")

        n_out = 0
        for code, lit, len_, color, term, sort in OUTCOMES:
            await c.execute("""
                INSERT INTO platform_activity_outcomes
                    (code, label_it, label_en, icon, color, is_terminal, sort_order, enabled)
                VALUES ($1, $2, $3, NULL, $4, $5, $6, TRUE)
                ON CONFLICT (code) DO UPDATE
                  SET label_it = EXCLUDED.label_it, label_en = EXCLUDED.label_en,
                      color = EXCLUDED.color, is_terminal = EXCLUDED.is_terminal,
                      sort_order = EXCLUDED.sort_order
            """, code, lit, len_, color, term, sort)
            n_out += 1
        print(f"[OK] platform_activity_outcomes upserted: {n_out}/{len(OUTCOMES)}")

        rows = await c.fetch("SELECT code, label_it, sort_order FROM platform_activity_sources ORDER BY sort_order")
        print("\nSOURCES:")
        for r in rows: print(f"  {r['code']:<12} {r['label_it']:<14} sort={r['sort_order']}")
        rows = await c.fetch("SELECT code, label_it, color, is_terminal FROM platform_activity_outcomes ORDER BY sort_order")
        print("\nOUTCOMES:")
        for r in rows: print(f"  {r['code']:<22} {r['label_it']:<20} {r['color']}  term={r['is_terminal']}")
    finally:
        await c.close()


if __name__ == "__main__":
    asyncio.run(main())
