"""
advisor_crm_scope.py — Shared helpers for the MOOD Advisor Mini CRM™.

This module hosts pure utility functions used by the advisor-crm router.
Strict separation from `services/studio_relations.py` (post-conversion)
and `services/access_continuity.py` (identity layer).

Conventions:
  • Every helper that mutates DB takes its own AsyncSession (caller-managed).
  • Every helper that reads DB returns plain dicts (JSON-serializable).
  • Reference codes (`LEAD-XXXXXX`, `TOK-XXXXXX`) are uppercase alnum,
    excluding ambiguous chars (0/O, 1/I) for human readability.
"""

from __future__ import annotations

import secrets
from typing import Optional
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


# ────────────────────────────────────────────────────────────────────
# Reference code generators
# ────────────────────────────────────────────────────────────────────

# Avoid: 0/O, 1/I, ambiguous letters
_REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _random_ref(prefix: str, length: int = 6) -> str:
    suffix = "".join(secrets.choice(_REF_ALPHABET) for _ in range(length))
    return f"{prefix}-{suffix}"


async def generate_unique_lead_reference(session: AsyncSession) -> str:
    """LEAD-XXXXXX, ensuring no collision in `advisor_leads.reference_code`."""
    for _ in range(8):
        candidate = _random_ref("LEAD", 6)
        exists = (await session.execute(
            text("SELECT 1 FROM advisor_leads WHERE reference_code = :c LIMIT 1"),
            {"c": candidate},
        )).scalar()
        if not exists:
            return candidate
    # Extremely unlikely (32^6 = ~1 billion combinations). Fallback: longer code.
    return _random_ref("LEAD", 10)


def generate_activation_token() -> str:
    """
    secrets.token_urlsafe(24) → 32 URL-safe chars (~192 bit entropy).
    Used as opaque path segment in /studio/start/{token}.
    """
    return secrets.token_urlsafe(24)


# ────────────────────────────────────────────────────────────────────
# Ownership guards (advisor scope only — admins use admin endpoints)
# ────────────────────────────────────────────────────────────────────

async def fetch_advisor_profile_id(session: AsyncSession, user_id: str) -> Optional[str]:
    """
    Return the `advisor_profiles.id` linked to a user, or None if the user
    has no advisor profile (i.e. is not an advisor).
    """
    row = (await session.execute(
        text("SELECT id FROM advisor_profiles WHERE user_id = CAST(:uid AS uuid) LIMIT 1"),
        {"uid": user_id},
    )).scalar()
    return str(row) if row else None


async def assert_advisor_owns_lead(
    session: AsyncSession,
    lead_id: str,
    advisor_user_id: str,
) -> dict:
    """
    Raises `LookupError` (caller maps to 404) if lead doesn't exist or
    doesn't belong to this advisor. Returns the lead row as dict on success.
    """
    row = (await session.execute(
        text("""SELECT id, advisor_id, advisor_user_id, reference_code,
                       company_name, status, temperature, studio_request_id,
                       studio_relation_id
                  FROM advisor_leads
                 WHERE id = CAST(:lid AS uuid)
                   AND advisor_user_id = CAST(:uid AS uuid)
                 LIMIT 1"""),
        {"lid": lead_id, "uid": advisor_user_id},
    )).mappings().first()
    if not row:
        raise LookupError("Lead non trovato o non autorizzato.")
    return dict(row)


async def assert_advisor_owns_token(
    session: AsyncSession,
    token_id: str,
    advisor_user_id: str,
) -> dict:
    row = (await session.execute(
        text("""SELECT id, advisor_id, advisor_user_id, lead_id, token,
                       label, status, expires_at, used_at, used_count
                  FROM advisor_activation_tokens
                 WHERE id = CAST(:tid AS uuid)
                   AND advisor_user_id = CAST(:uid AS uuid)
                 LIMIT 1"""),
        {"tid": token_id, "uid": advisor_user_id},
    )).mappings().first()
    if not row:
        raise LookupError("Token non trovato o non autorizzato.")
    return dict(row)


# ────────────────────────────────────────────────────────────────────
# Token resolution (used by /studio/start/{token} — PUBLIC endpoint)
# ────────────────────────────────────────────────────────────────────

async def resolve_active_token(session: AsyncSession, raw_token: str) -> Optional[dict]:
    """
    Look up a token by its URL value. Returns enriched row (joined with
    advisor_profiles.advisor_code) if the token is currently usable,
    otherwise None.

    Usable means: status='active' AND (expires_at IS NULL OR expires_at > NOW()).
    Tokens with status='used' / 'revoked' / 'expired' are treated as not
    resolvable from the public endpoint (caller maps to "link non valido").
    """
    if not raw_token or not isinstance(raw_token, str):
        return None
    row = (await session.execute(
        text("""SELECT t.id, t.advisor_id, t.advisor_user_id, t.lead_id,
                       t.token, t.label, t.status, t.expires_at,
                       t.used_at, t.used_count,
                       p.advisor_code, p.name AS advisor_name
                  FROM advisor_activation_tokens t
                  JOIN advisor_profiles p ON p.id = t.advisor_id
                 WHERE t.token = :tok
                 LIMIT 1"""),
        {"tok": raw_token},
    )).mappings().first()
    if not row:
        return None
    if row["status"] != "active":
        return None
    exp = row["expires_at"]
    if exp is not None and exp <= datetime.now(timezone.utc):
        # Side-effect on next admin sweep — but for now we just refuse.
        return None
    return dict(row)


# ────────────────────────────────────────────────────────────────────
# Lifecycle status transitions (centralized to keep semantics safe)
# ────────────────────────────────────────────────────────────────────

ALLOWED_LEAD_STATUSES = (
    "lead", "contacted", "meeting_scheduled", "demo_completed",
    "application_started", "application_submitted",
    "approved", "activated", "lost",
)

ALLOWED_TEMPERATURES = ("cold", "warm", "hot", "ready")

ALLOWED_ACTIVITY_TYPES = (
    "phone_call", "showroom_visit", "video_call",
    "email", "event", "follow_up", "demo", "proposal", "note",
)


def validate_lead_status(value: str) -> str:
    if value not in ALLOWED_LEAD_STATUSES:
        raise ValueError(f"Status non valido. Ammessi: {ALLOWED_LEAD_STATUSES}")
    return value


def validate_temperature(value: str) -> str:
    if value not in ALLOWED_TEMPERATURES:
        raise ValueError(f"Temperature non valida. Ammessi: {ALLOWED_TEMPERATURES}")
    return value


def validate_activity_type(value: str) -> str:
    if value not in ALLOWED_ACTIVITY_TYPES:
        raise ValueError(f"Activity type non valido. Ammessi: {ALLOWED_ACTIVITY_TYPES}")
    return value
