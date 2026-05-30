"""
MOOD Advisor Program™ · Chunk 2 — Identity seed.

Links existing advisor_profiles rows to central platform users so that:
  • the advisor can authenticate via the standard /api/auth/login flow
    or magic-link, and
  • the JWT they obtain carries role='advisor' so the require_advisor_scope
    guard can route their requests through the scoped data view.

Tenant assignment: ALL advisors live on the central `studio` tenant.
They never become tenant users of activated studios.

Idempotent — re-running this script will:
  • create a `users` row for each `advisor_profiles` that doesn't yet
    have one (skipped if `user_id` is already populated),
  • update existing rows to ensure role='advisor', is_active=TRUE,
    password_hash='!magic-link-only' (magic-link only, no password).
"""
from __future__ import annotations

import asyncio

from sqlalchemy import text

from database import AsyncSessionLocal


CENTRAL_TENANT_SLUG = "studio"
MAGIC_ONLY_SENTINEL = "!magic-link-only"


async def main():
    async with AsyncSessionLocal() as s:
        # Resolve the central tenant id.
        trow = (await s.execute(
            text("SELECT id FROM tenants WHERE slug = :slug LIMIT 1"),
            {"slug": CENTRAL_TENANT_SLUG},
        )).mappings().first()
        if not trow:
            raise SystemExit(f"Central tenant '{CENTRAL_TENANT_SLUG}' not found.")
        tenant_id = str(trow["id"])

        # Pull every advisor_profile (regardless of user_id state).
        profiles = (await s.execute(
            text("""
                SELECT id, user_id, email, name, advisor_code, status
                  FROM advisor_profiles
                 ORDER BY created_at NULLS LAST
            """),
        )).mappings().all()

        if not profiles:
            print("No advisor_profiles rows found. Nothing to seed.")
            return

        created = 0
        linked  = 0
        updated = 0
        for p in profiles:
            advisor_id = str(p["id"])
            email = (p["email"] or "").strip().lower()
            name  = (p["name"]  or "Advisor").strip()
            code  = (p["advisor_code"] or "").strip()
            if not email:
                print(f"  · advisor {advisor_id} skipped (no email).")
                continue

            user_id = str(p["user_id"]) if p["user_id"] else None

            # If already linked, just normalise the users row.
            if user_id:
                await s.execute(
                    text("""
                        UPDATE users SET
                          role          = 'advisor',
                          is_active     = TRUE,
                          full_name     = COALESCE(NULLIF(full_name,''), :nm),
                          password_hash = CASE
                            WHEN password_hash IS NULL OR password_hash = '' THEN :sentinel
                            ELSE password_hash
                          END,
                          updated_at    = NOW()
                         WHERE id = CAST(:uid AS uuid)
                    """),
                    {"uid": user_id, "nm": name, "sentinel": MAGIC_ONLY_SENTINEL},
                )
                updated += 1
                print(f"  · advisor {code or advisor_id} ({email}) already linked, normalised.")
                continue

            # Else find or create the users row on tenant=studio.
            urow = (await s.execute(
                text("""
                    SELECT id FROM users
                     WHERE tenant_id = CAST(:tid AS uuid)
                       AND lower(email) = :em
                     LIMIT 1
                """),
                {"tid": tenant_id, "em": email},
            )).mappings().first()

            if urow:
                # Upgrade role to advisor if needed, leave password_hash alone.
                await s.execute(
                    text("""
                        UPDATE users SET
                          role          = 'advisor',
                          is_active     = TRUE,
                          full_name     = COALESCE(NULLIF(full_name,''), :nm),
                          password_hash = CASE
                            WHEN password_hash IS NULL OR password_hash = '' THEN :sentinel
                            ELSE password_hash
                          END,
                          updated_at    = NOW()
                         WHERE id = :uid
                    """),
                    {"uid": str(urow["id"]), "nm": name, "sentinel": MAGIC_ONLY_SENTINEL},
                )
                new_user_id = str(urow["id"])
                linked += 1
                print(f"  · advisor {code or advisor_id} ({email}) attached to existing user.")
            else:
                ins = await s.execute(
                    text("""
                        INSERT INTO users
                          (tenant_id, email, password_hash, full_name, role, is_active)
                        VALUES
                          (CAST(:tid AS uuid), :em, :ph, :nm, 'advisor', TRUE)
                        RETURNING id
                    """),
                    {"tid": tenant_id, "em": email, "ph": MAGIC_ONLY_SENTINEL, "nm": name},
                )
                new_user_id = str(ins.scalar())
                created += 1
                print(f"  · advisor {code or advisor_id} ({email}) created on tenant 'studio'.")

            await s.execute(
                text("""
                    UPDATE advisor_profiles
                       SET user_id = CAST(:uid AS uuid),
                           updated_at = NOW()
                     WHERE id = CAST(:aid AS uuid)
                """),
                {"uid": new_user_id, "aid": advisor_id},
            )

        await s.commit()
        print(f"\nSeed complete. created={created} linked={linked} normalised={updated}.")


if __name__ == "__main__":
    asyncio.run(main())
