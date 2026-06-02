"""Seed `platform_contact_roles` (M0 — 11 codes, M1 ratified).
Idempotent: ON CONFLICT (code) DO UPDATE.
"""
from __future__ import annotations
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import AsyncSessionLocal
from sqlalchemy import text

# code, category, icon (Lucide), label_it, label_en, sort
SEED: list[dict] = [
    {"code": "founder",          "category": "leadership",  "icon": "crown",           "label_it": "Founder",          "label_en": "Founder",          "sort_order":  10},
    {"code": "owner",            "category": "leadership",  "icon": "key",             "label_it": "Titolare",         "label_en": "Owner",            "sort_order":  20},
    {"code": "administration",   "category": "operations",  "icon": "file-spreadsheet","label_it": "Amministrazione",  "label_en": "Administration",   "sort_order":  30},
    {"code": "marketing",        "category": "commercial",  "icon": "megaphone",       "label_it": "Marketing",        "label_en": "Marketing",        "sort_order":  40},
    {"code": "sales",            "category": "commercial",  "icon": "trending-up",     "label_it": "Sales",            "label_en": "Sales",            "sort_order":  50},
    {"code": "project_manager",  "category": "operations",  "icon": "clipboard-list",  "label_it": "Project Manager",  "label_en": "Project Manager",  "sort_order":  60},
    {"code": "purchasing",       "category": "operations",  "icon": "shopping-cart",   "label_it": "Acquisti",         "label_en": "Purchasing",       "sort_order":  70},
    {"code": "architect",        "category": "creative",    "icon": "compass",         "label_it": "Architetto",       "label_en": "Architect",        "sort_order":  80},
    {"code": "designer",         "category": "creative",    "icon": "palette",         "label_it": "Designer",         "label_en": "Designer",         "sort_order":  90},
    {"code": "supplier",         "category": "external",    "icon": "truck",           "label_it": "Fornitore",        "label_en": "Supplier",         "sort_order": 100},
    {"code": "consultant",       "category": "external",    "icon": "briefcase",       "label_it": "Consulente",       "label_en": "Consultant",       "sort_order": 110},
]


async def main() -> int:
    async with AsyncSessionLocal() as s:
        for row in SEED:
            await s.execute(text("""
                INSERT INTO platform_contact_roles
                    (code, category, icon, label_it, label_en, sort_order, enabled)
                VALUES
                    (:code, :category, :icon, :label_it, :label_en, :sort_order, TRUE)
                ON CONFLICT (code) DO UPDATE SET
                    category   = EXCLUDED.category,
                    icon       = EXCLUDED.icon,
                    label_it   = EXCLUDED.label_it,
                    label_en   = EXCLUDED.label_en,
                    sort_order = EXCLUDED.sort_order
            """), row)
        await s.commit()
        count = (await s.execute(text("SELECT COUNT(*) FROM platform_contact_roles"))).scalar()
        print(f"[seed_contact_roles] upserted {len(SEED)} rows · total {count}")
        return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
