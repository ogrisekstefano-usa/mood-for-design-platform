"""Seed relationship health signals (M2) into platform catalog tables.

Idempotent UPSERT of `score_delta`, `touch`, `visibility`, `notifiable`
per the M2 Final Execution Plan §3.2.

Run: `python scripts/seed_relationship_health_signals.py`
"""
from __future__ import annotations
import asyncio, os, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

import asyncpg

DATABASE_URL = os.environ["DATABASE_URL"]

# code → (score_delta, touch, visibility, notifiable)
EVENT_SIGNALS: dict[str, tuple[int, bool, str, bool]] = {
    "relation_opened":           ( +5, True,  "all",        False),
    "activated":                 (+20, True,  "all",        True),
    "magic_link_issued":         (  0, False, "all",        False),
    "magic_link_consumed":       (+15, True,  "all",        True),
    "blueprint_first_access":    (+10, True,  "all",        True),
    "password_set":              ( +1, False, "all",        False),
    "password_reset_requested":  (  0, False, "all",        False),
    "contact_added":             ( +2, False, "all",        False),
    "contact_archived":          ( -2, False, "all",        False),
    "status_changed":            ( +3, True,  "all",        False),
    "temperature_changed":       (  0, False, "all",        False),
    "qualification_done":        (+10, True,  "all",        True),
    "presentation_delivered":    (+12, True,  "all",        True),
    "ecosystem_aligned":         (+15, True,  "all",        False),
    "visit_recorded":            ( +8, True,  "all",        True),
    "archived":                  (-50, False, "all",        False),
    # Email templates surfaced as event_type_code via studio_email_dispatch_log
    "admin_new_studio_request":  (  0, False, "admin_only", False),
    "studio_request_received":   ( +2, True,  "all",        False),
    "studio_request_review":     ( +2, True,  "all",        False),
    "studio_request_qualified":  ( +2, True,  "all",        False),
    "studio_request_approved":   ( +5, True,  "all",        False),
    "founder_invitation_resent": ( +1, False, "all",        False),
    "tenant_activated_notice":   ( +3, True,  "all",        True),
}

ACTIVITY_SIGNALS: dict[str, tuple[int, bool, str, bool]] = {
    "call":           ( +5, True,  "all", False),
    "meeting":        ( +8, True,  "all", True),
    "visit":          (+10, True,  "all", True),
    "email":          ( +2, True,  "all", False),
    "whatsapp":       ( +2, True,  "all", False),
    "linkedin":       ( +1, True,  "all", False),
    "internal_note":  (  0, False, "all", False),
    "task":           (  0, False, "all", False),
}


async def main() -> None:
    c = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    try:
        # Pre-seed email-template codes into platform_relationship_event_types
        # so visibility/notifiable filters apply when they surface in the
        # `email` source of v_relationship_timeline.
        EMAIL_TEMPLATE_CODES = {
            "admin_new_studio_request": ("communication", "auto",
                "Nuova richiesta studio (admin)", "New studio request (admin)",
                "mail", "#64748b", "admin_only"),
            "studio_request_received":  ("communication", "auto",
                "Richiesta ricevuta", "Request received",
                "mail-check", "#22c55e", "all"),
            "studio_request_review":    ("communication", "auto",
                "Richiesta in revisione", "Request under review",
                "mail-question", "#eab308", "all"),
            "studio_request_qualified": ("communication", "auto",
                "Richiesta qualificata", "Request qualified",
                "mail-check", "#3b82f6", "all"),
            "studio_request_approved":  ("communication", "auto",
                "Richiesta approvata", "Request approved",
                "mail-plus", "#10b981", "all"),
            "founder_invitation_resent":("communication", "auto",
                "Invito founder reinviato", "Founder invitation resent",
                "send", "#0ea5e9", "all"),
            "tenant_activated_notice":  ("communication", "auto",
                "Tenant attivato", "Tenant activated",
                "rocket", "#16a34a", "all"),
        }
        for code, (cat, src, lbl_it, lbl_en, icon, color, vis) in EMAIL_TEMPLATE_CODES.items():
            await c.execute("""
                INSERT INTO platform_relationship_event_types
                    (code, category, source, show_in_timeline,
                     icon, color, label_it, label_en, sort_order, enabled,
                     visibility)
                VALUES ($1, $2, $3, TRUE, $4, $5, $6, $7, 500, TRUE, $8)
                ON CONFLICT (code) DO UPDATE
                   SET label_it = EXCLUDED.label_it,
                       label_en = EXCLUDED.label_en,
                       icon     = EXCLUDED.icon,
                       color    = EXCLUDED.color,
                       visibility = EXCLUDED.visibility
            """, code, cat, src, icon, color, lbl_it, lbl_en, vis)

        ev_applied = 0
        for code, (delta, touch, vis, notif) in EVENT_SIGNALS.items():
            r = await c.execute(
                """
                UPDATE platform_relationship_event_types
                   SET score_delta = $2, touch = $3, visibility = $4, notifiable = $5
                 WHERE code = $1
                """,
                code, delta, touch, vis, notif,
            )
            if r.endswith("0"):
                # row not present (catalog out of sync) — skip silently, signal won't apply
                continue
            ev_applied += 1
        print(f"[OK] event signals applied: {ev_applied}/{len(EVENT_SIGNALS)}")

        ac_applied = 0
        for code, (delta, touch, vis, notif) in ACTIVITY_SIGNALS.items():
            r = await c.execute(
                """
                UPDATE platform_activity_types
                   SET score_delta = $2, touch = $3, visibility = $4, notifiable = $5
                 WHERE code = $1
                """,
                code, delta, touch, vis, notif,
            )
            if r.endswith("0"):
                continue
            ac_applied += 1
        print(f"[OK] activity signals applied: {ac_applied}/{len(ACTIVITY_SIGNALS)}")

        # Verification snapshot
        ev = await c.fetch(
            "SELECT code, score_delta, touch, visibility, notifiable "
            "FROM platform_relationship_event_types WHERE code = ANY($1::text[]) "
            "ORDER BY code",
            list(EVENT_SIGNALS.keys()),
        )
        ac = await c.fetch(
            "SELECT code, score_delta, touch, visibility, notifiable "
            "FROM platform_activity_types ORDER BY code",
        )
        print("\nEVENT TYPES (post-seed):")
        for r in ev:
            print(f"  {r['code']:<28} delta={r['score_delta']:>+4} touch={r['touch']!s:<5} "
                  f"vis={r['visibility']:<11} notif={r['notifiable']}")
        print("\nACTIVITY TYPES (post-seed):")
        for r in ac:
            print(f"  {r['code']:<14} delta={r['score_delta']:>+4} touch={r['touch']!s:<5} "
                  f"vis={r['visibility']:<11} notif={r['notifiable']}")
    finally:
        await c.close()


if __name__ == "__main__":
    asyncio.run(main())
