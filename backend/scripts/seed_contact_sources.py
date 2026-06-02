"""Seed `platform_contact_sources` (M0 — 8 codes, contact provenance).
Idempotent: ON CONFLICT (code) DO UPDATE.
"""
from __future__ import annotations
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import AsyncSessionLocal
from sqlalchemy import text

# code, icon (Lucide), label_it, label_en, sort
SEED: list[dict] = [
    {"code": "studio_request", "icon": "file-text",  "label_it": "Candidatura V2",         "label_en": "Studio request V2",   "sort_order":  10},
    {"code": "manual",         "icon": "edit-3",     "label_it": "Inserito manualmente",   "label_en": "Manual entry",        "sort_order":  20},
    {"code": "advisor",        "icon": "user-cog",   "label_it": "Da advisor",             "label_en": "Added by advisor",    "sort_order":  30},
    {"code": "import",         "icon": "upload",     "label_it": "Importato (CSV/batch)",  "label_en": "Imported (CSV/batch)","sort_order":  40},
    {"code": "api",            "icon": "plug",       "label_it": "Tramite API",            "label_en": "Via API",             "sort_order":  50},
    {"code": "erp_sync",       "icon": "refresh-cw", "label_it": "Sync da ERP",            "label_en": "ERP sync",            "sort_order":  60},
    {"code": "website",        "icon": "globe",      "label_it": "Form sito",              "label_en": "Website form",        "sort_order":  70},
    {"code": "linkedin",       "icon": "linkedin",   "label_it": "LinkedIn outreach",      "label_en": "LinkedIn outreach",   "sort_order":  80},
]


async def main() -> int:
    async with AsyncSessionLocal() as s:
        for row in SEED:
            await s.execute(text("""
                INSERT INTO platform_contact_sources
                    (code, icon, label_it, label_en, sort_order, enabled)
                VALUES
                    (:code, :icon, :label_it, :label_en, :sort_order, TRUE)
                ON CONFLICT (code) DO UPDATE SET
                    icon       = EXCLUDED.icon,
                    label_it   = EXCLUDED.label_it,
                    label_en   = EXCLUDED.label_en,
                    sort_order = EXCLUDED.sort_order
            """), row)
        await s.commit()
        count = (await s.execute(text("SELECT COUNT(*) FROM platform_contact_sources"))).scalar()
        print(f"[seed_contact_sources] upserted {len(SEED)} rows · total {count}")
        return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
