"""ITER143E · Swap the platform sender to the production verified domain.

Run AFTER you have:
  1. Added the DNS records (SPF, DKIM, MX, return-path) for
     mail.moodfordesign.com on your DNS provider, AND
  2. Pressed "Verify DNS records" on
     https://resend.com/domains → mail.moodfordesign.com,
     waiting until the status badge turns green.

What it does:
  • Updates `backend/.env` so EMAIL_FROM points to the verified address.
  • Updates `tenant_email_settings.sender_email` everywhere that still
    holds the testing default (`onboarding@resend.dev`).
  • Prints a confirmation summary.

Idempotent. Re-run is safe.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

NEW_FROM   = "MOOD for DESIGN™ <no-reply@mail.moodfordesign.com>"
NEW_SENDER = "no-reply@mail.moodfordesign.com"
OLD_TESTING = "onboarding@resend.dev"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _swap_env() -> bool:
    env_path = BACKEND / ".env"
    text = env_path.read_text()
    lines = text.splitlines()
    found = False
    out = []
    for line in lines:
        if line.startswith("EMAIL_FROM="):
            out.append(f"EMAIL_FROM={NEW_FROM}")
            found = True
        else:
            out.append(line)
    if not found:
        out.append(f"EMAIL_FROM={NEW_FROM}")
    env_path.write_text("\n".join(out) + ("\n" if not text.endswith("\n") else ""))
    return found


def _swap_tenant_rows() -> int:
    from database import db
    c = db()
    rows = (c.table("tenant_email_settings")
            .select("id, sender_email, tenant_id")
            .eq("sender_email", OLD_TESTING).execute().data or [])
    for r in rows:
        c.table("tenant_email_settings").update({
            "sender_email": NEW_SENDER,
            "updated_at": _now(),
        }).eq("id", r["id"]).execute()
    return len(rows)


def main() -> int:
    print("🔁 ITER143E · Swap sender → no-reply@mail.moodfordesign.com")
    print()
    print("PRE-FLIGHT — confirm before continuing:")
    print("  [ ] DNS records added on your DNS provider:")
    print("      SPF, DKIM, MX, return-path (Resend UI shows them)")
    print("  [ ] Resend dashboard shows mail.moodfordesign.com = VERIFIED")
    print()
    if not (os.environ.get("FORCE_SWAP") == "1"):
        confirm = input("Continue with swap? (yes/no): ").strip().lower()
        if confirm != "yes":
            print("Aborted — no changes made.")
            return 1

    env_found = _swap_env()
    rows_updated = _swap_tenant_rows()

    print()
    print(f"✓ .env EMAIL_FROM → {NEW_FROM}  (replaced existing: {env_found})")
    print(f"✓ tenant_email_settings rows updated: {rows_updated}")
    print()
    print("Now restart backend:")
    print("    sudo supervisorctl restart backend")
    print()
    print("Then run a live test from /admin/email-governance → Test invio.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
