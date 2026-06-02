"""Seed `platform_relationship_event_types` (M0 — 20 codes).
Idempotent: ON CONFLICT (code) DO UPDATE.
"""
from __future__ import annotations
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import AsyncSessionLocal
from sqlalchemy import text

SEED: list[dict] = [
    # code, category, source, show_in_timeline, icon, color, label_it, label_en, sort
    {"code": "relation_opened",          "category": "lifecycle",     "source": "auto",   "show_in_timeline": True,  "icon": "git-branch-plus",  "color": "#10b981", "label_it": "Relazione aperta",          "label_en": "Relationship opened",        "sort_order":  10},
    {"code": "studio_request_submitted", "category": "lifecycle",     "source": "auto",   "show_in_timeline": True,  "icon": "file-text",        "color": "#0ea5e9", "label_it": "Candidatura inviata",       "label_en": "Studio request submitted",   "sort_order":  20},
    {"code": "status_changed",           "category": "lifecycle",     "source": "auto",   "show_in_timeline": True,  "icon": "shuffle",          "color": "#6366f1", "label_it": "Stato aggiornato",          "label_en": "Status changed",             "sort_order":  30},
    {"code": "temperature_changed",      "category": "lifecycle",     "source": "auto",   "show_in_timeline": False, "icon": "thermometer",      "color": "#f59e0b", "label_it": "Temperatura aggiornata",    "label_en": "Temperature changed",        "sort_order":  40},
    {"code": "ownership_changed",        "category": "lifecycle",     "source": "auto",   "show_in_timeline": True,  "icon": "user-cog",         "color": "#a855f7", "label_it": "Advisor riassegnato",       "label_en": "Advisor reassigned",         "sort_order":  50},
    {"code": "qualification_done",       "category": "lifecycle",     "source": "auto",   "show_in_timeline": True,  "icon": "badge-check",      "color": "#22c55e", "label_it": "Qualificazione completata", "label_en": "Qualification done",         "sort_order":  60},
    {"code": "activated",                "category": "lifecycle",     "source": "auto",   "show_in_timeline": True,  "icon": "rocket",           "color": "#16a34a", "label_it": "Tenant attivato",           "label_en": "Tenant activated",           "sort_order":  70},
    {"code": "archived",                 "category": "lifecycle",     "source": "auto",   "show_in_timeline": True,  "icon": "archive",          "color": "#737373", "label_it": "Archiviato",                "label_en": "Archived",                   "sort_order":  80},

    {"code": "magic_link_issued",        "category": "communication", "source": "auto",   "show_in_timeline": True,  "icon": "key-round",        "color": "#0ea5e9", "label_it": "Magic link inviato",        "label_en": "Magic link issued",          "sort_order": 110},
    {"code": "magic_link_consumed",      "category": "communication", "source": "auto",   "show_in_timeline": True,  "icon": "log-in",           "color": "#22c55e", "label_it": "Primo accesso",             "label_en": "First access",               "sort_order": 120},
    {"code": "blueprint_first_access",   "category": "communication", "source": "auto",   "show_in_timeline": True,  "icon": "compass",          "color": "#0891b2", "label_it": "Primo ingresso Blueprint",  "label_en": "Blueprint first access",     "sort_order": 130},
    {"code": "password_set",             "category": "communication", "source": "auto",   "show_in_timeline": False, "icon": "lock",             "color": "#737373", "label_it": "Password impostata",        "label_en": "Password set",               "sort_order": 140},
    {"code": "password_reset_requested", "category": "communication", "source": "auto",   "show_in_timeline": False, "icon": "key",              "color": "#737373", "label_it": "Reset password richiesto",  "label_en": "Password reset requested",   "sort_order": 150},

    {"code": "contact_added",            "category": "manual",        "source": "auto",   "show_in_timeline": True,  "icon": "user-plus",        "color": "#06b6d4", "label_it": "Contatto aggiunto",         "label_en": "Contact added",              "sort_order": 210},
    {"code": "contact_archived",         "category": "manual",        "source": "auto",   "show_in_timeline": False, "icon": "user-minus",       "color": "#737373", "label_it": "Contatto archiviato",       "label_en": "Contact archived",           "sort_order": 220},
    {"code": "note_added",               "category": "manual",        "source": "manual", "show_in_timeline": True,  "icon": "sticky-note",      "color": "#eab308", "label_it": "Nota interna",              "label_en": "Internal note",              "sort_order": 230},
    {"code": "visit_recorded",           "category": "manual",        "source": "manual", "show_in_timeline": True,  "icon": "map-pin",          "color": "#dc2626", "label_it": "Visita registrata",         "label_en": "Visit recorded",             "sort_order": 240},
    {"code": "presentation_scheduled",   "category": "manual",        "source": "manual", "show_in_timeline": True,  "icon": "calendar-clock",   "color": "#6366f1", "label_it": "Presentazione pianificata", "label_en": "Presentation scheduled",     "sort_order": 250},
    {"code": "presentation_delivered",   "category": "manual",        "source": "manual", "show_in_timeline": True,  "icon": "presentation",     "color": "#7c3aed", "label_it": "Presentazione consegnata",  "label_en": "Presentation delivered",     "sort_order": 260},
    {"code": "ecosystem_aligned",        "category": "manual",        "source": "manual", "show_in_timeline": True,  "icon": "sparkles",         "color": "#d946ef", "label_it": "Ecosistema allineato",      "label_en": "Ecosystem aligned",          "sort_order": 270},
]


async def main() -> int:
    async with AsyncSessionLocal() as s:
        for row in SEED:
            await s.execute(text("""
                INSERT INTO platform_relationship_event_types
                    (code, category, source, show_in_timeline, icon, color,
                     label_it, label_en, sort_order, enabled)
                VALUES
                    (:code, :category, :source, :show_in_timeline, :icon, :color,
                     :label_it, :label_en, :sort_order, TRUE)
                ON CONFLICT (code) DO UPDATE SET
                    category         = EXCLUDED.category,
                    source           = EXCLUDED.source,
                    show_in_timeline = EXCLUDED.show_in_timeline,
                    icon             = EXCLUDED.icon,
                    color            = EXCLUDED.color,
                    label_it         = EXCLUDED.label_it,
                    label_en         = EXCLUDED.label_en,
                    sort_order       = EXCLUDED.sort_order
            """), row)
        await s.commit()
        count = (await s.execute(text("SELECT COUNT(*) FROM platform_relationship_event_types"))).scalar()
        print(f"[seed_relationship_event_types] upserted {len(SEED)} rows · total {count}")
        return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
