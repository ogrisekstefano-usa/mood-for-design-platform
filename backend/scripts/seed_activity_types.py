"""Seed `platform_activity_types` (M0 — 8 codes).
Idempotent: ON CONFLICT (code) DO UPDATE.
"""
from __future__ import annotations
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import AsyncSessionLocal
from sqlalchemy import text

# code, icon, default_duration_min, show_in_timeline, quick_action_m1, label_it, label_en, sort
SEED: list[dict] = [
    {"code": "call",          "icon": "phone",          "default_duration_min": 30, "show_in_timeline": True, "quick_action_m1": True,  "label_it": "Chiamata",      "label_en": "Call",          "sort_order":  10},
    {"code": "email",         "icon": "mail",           "default_duration_min": None, "show_in_timeline": True, "quick_action_m1": True, "label_it": "Email",         "label_en": "Email",         "sort_order":  20},
    {"code": "whatsapp",      "icon": "message-circle", "default_duration_min": None, "show_in_timeline": True, "quick_action_m1": True, "label_it": "WhatsApp",      "label_en": "WhatsApp",      "sort_order":  30},
    {"code": "linkedin",      "icon": "linkedin",       "default_duration_min": None, "show_in_timeline": True, "quick_action_m1": True, "label_it": "LinkedIn",      "label_en": "LinkedIn",      "sort_order":  40},
    {"code": "internal_note", "icon": "sticky-note",    "default_duration_min": None, "show_in_timeline": True, "quick_action_m1": True, "label_it": "Nota interna",  "label_en": "Internal note", "sort_order":  50},
    {"code": "meeting",       "icon": "users",          "default_duration_min": 60, "show_in_timeline": True, "quick_action_m1": False, "label_it": "Meeting",       "label_en": "Meeting",       "sort_order":  60},
    {"code": "visit",         "icon": "map-pin",        "default_duration_min": 120, "show_in_timeline": True, "quick_action_m1": False, "label_it": "Visita",       "label_en": "Visit",         "sort_order":  70},
    {"code": "task",          "icon": "check-square",   "default_duration_min": None, "show_in_timeline": True, "quick_action_m1": False, "label_it": "Task",         "label_en": "Task",          "sort_order":  80},
]


async def main() -> int:
    async with AsyncSessionLocal() as s:
        for row in SEED:
            await s.execute(text("""
                INSERT INTO platform_activity_types
                    (code, icon, default_duration_min, show_in_timeline, quick_action_m1,
                     label_it, label_en, sort_order, enabled)
                VALUES
                    (:code, :icon, :default_duration_min, :show_in_timeline, :quick_action_m1,
                     :label_it, :label_en, :sort_order, TRUE)
                ON CONFLICT (code) DO UPDATE SET
                    icon                 = EXCLUDED.icon,
                    default_duration_min = EXCLUDED.default_duration_min,
                    show_in_timeline     = EXCLUDED.show_in_timeline,
                    quick_action_m1      = EXCLUDED.quick_action_m1,
                    label_it             = EXCLUDED.label_it,
                    label_en             = EXCLUDED.label_en,
                    sort_order           = EXCLUDED.sort_order
            """), row)
        await s.commit()
        count = (await s.execute(text("SELECT COUNT(*) FROM platform_activity_types"))).scalar()
        print(f"[seed_activity_types] upserted {len(SEED)} rows · total {count}")
        return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
