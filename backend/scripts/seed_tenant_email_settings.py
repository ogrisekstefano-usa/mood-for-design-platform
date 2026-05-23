"""ITER143D · Seed tenant_email_settings for the platform + Golden Demo Tenant™."""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from database import db  # noqa: E402


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


SEEDS = [
    {
        "slug": "studio",  # Golden Demo Tenant™ (was 'mood-demo')
        "settings": {
            "sender_name":      "MOOD for DESIGN™",
            "sender_email":     "onboarding@resend.dev",  # TODO: swap to no-reply@mail.moodfordesign.com when domain verifies on Resend
            "reply_to":         "support@moodfordesign.com",
            "support_email":    "support@moodfordesign.com",
            "logo_url":         "",
            "primary_color":    "#7ce4f5",
            "accent_color":     "#e8ebf0",
            "footer_signature": "MOOD for DESIGN™ · Golden Demo Tenant™ · studio.moodfordesign.com",
            "email_domain":     "studio.moodfordesign.com",
            "provider_type":    "resend",
            "locale_default":   "it-IT",
            "active":           True,
        },
    },
]


def seed() -> dict:
    c = db()
    inserted = 0
    updated = 0
    for entry in SEEDS:
        tenant_row = (c.table("tenants").select("id, slug, name")
                      .eq("slug", entry["slug"]).limit(1).execute().data or [])
        if not tenant_row:
            print(f"  ! tenant slug={entry['slug']} not found, skipping")
            continue
        tenant_id = tenant_row[0]["id"]
        existing = (c.table("tenant_email_settings").select("id")
                    .eq("tenant_id", tenant_id).limit(1).execute().data or [])
        payload = {"tenant_id": tenant_id, **entry["settings"], "updated_at": _now()}
        if existing:
            c.table("tenant_email_settings").update(payload)\
                .eq("id", existing[0]["id"]).execute()
            updated += 1
            print(f"  ✓ updated tenant_email_settings for {entry['slug']}")
        else:
            payload["created_at"] = _now()
            c.table("tenant_email_settings").insert(payload).execute()
            inserted += 1
            print(f"  ✓ inserted tenant_email_settings for {entry['slug']}")
    return {"inserted": inserted, "updated": updated}


if __name__ == "__main__":
    print("📧 ITER143D · seeding tenant_email_settings")
    out = seed()
    print(f"\n── Done · inserted={out['inserted']} updated={out['updated']} ──")
