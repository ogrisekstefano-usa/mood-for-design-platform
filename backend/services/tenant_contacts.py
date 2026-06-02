"""Tenant Contacts service (M1).

Canonical CRUD on `tenant_contacts`. Used by both Admin (`admin_crm` router)
and Founder (`blueprint_crm` router). Scope enforcement happens in the
caller; this service trusts `tenant_id` is already validated.
"""
from __future__ import annotations
from typing import Any, Optional
from uuid import UUID
import json

from fastapi import HTTPException
from sqlalchemy import text
from database import AsyncSessionLocal


# ─── helpers ───────────────────────────────────────────────────────────

# Base-code → canonical BCP-47 mapping for `preferred_language`.
# Allows API consumers to pass either short codes (it, en) or full
# locale codes (it-IT, en-US). Anything else raises 422.
_LANG_BASE_MAP = {
    "it": "it-IT", "en": "en-US", "fr": "fr-FR",
    "de": "de-DE", "es": "es-ES", "pt": "pt-BR",
    "ar": "ar-AE", "zh": "zh-CN", "ja": "ja-JP",
}


async def _normalize_language(s, raw: str | None) -> str | None:
    """Validate/normalize a preferred_language value.

    Accepts:
      - None / "" → returns None (column is nullable)
      - BCP-47 locale already present in platform_languages (e.g. 'it-IT') → kept as-is
      - ISO-639 base code mapped via _LANG_BASE_MAP (e.g. 'it' → 'it-IT')
    Rejects anything else with HTTP 422.
    """
    if not raw:
        return None
    val = str(raw).strip()
    if not val:
        return None
    # Direct hit on platform_languages.code
    exists = (await s.execute(text(
        "SELECT 1 FROM platform_languages WHERE code = :c"
    ), {"c": val})).scalar()
    if exists:
        return val
    # Base-code fallback
    mapped = _LANG_BASE_MAP.get(val.lower())
    if mapped:
        exists = (await s.execute(text(
            "SELECT 1 FROM platform_languages WHERE code = :c"
        ), {"c": mapped})).scalar()
        if exists:
            return mapped
    raise HTTPException(status_code=422, detail={
        "code": "invalid_preferred_language",
        "message": f"preferred_language '{raw}' non riconosciuto",
        "accepted_examples": list(_LANG_BASE_MAP.keys()) + list(_LANG_BASE_MAP.values()),
    })


async def _emit_event(s, tenant_id: str, relation_id: str | None,
                     event_type_code: str, actor_id: str | None,
                     payload: dict | None = None) -> None:
    """Append to studio_relationship_events with the new event_type_code FK.

    If relation_id is None, skip silently (relation_id has NOT NULL constraint
    on the legacy column). The contact event is preserved via tenant_id below
    once that column is migrated; today we emit only when a relation exists.
    """
    if not relation_id:
        return
    await s.execute(text("""
        INSERT INTO studio_relationship_events
            (relation_id, actor_id, kind, payload, occurred_at,
             tenant_id, event_type_code)
        VALUES
            (CAST(:rid AS uuid), CAST(:aid AS uuid),
             :kind, CAST(:pl AS jsonb), NOW(),
             CAST(:tid AS uuid), :code)
    """), {
        "rid": str(relation_id),
        "aid": str(actor_id) if actor_id else None,
        "kind": event_type_code,
        "pl": json.dumps(payload or {}),
        "tid": str(tenant_id),
        "code": event_type_code,
    })


# ─── service ───────────────────────────────────────────────────────────

async def list_contacts(tenant_id: str, *,
                        role_code: Optional[str] = None,
                        status: Optional[str] = "active",
                        owner_user_id: Optional[str] = None,
                        q: Optional[str] = None,
                        limit: int = 200,
                        offset: int = 0) -> list[dict[str, Any]]:
    """Return contacts for a tenant with optional filters."""
    where = ["c.tenant_id = CAST(:tid AS uuid)"]
    params: dict[str, Any] = {"tid": tenant_id, "limit": limit, "offset": offset}
    if status:
        where.append("c.status = :status")
        params["status"] = status
    if role_code:
        where.append("c.role_code = :role_code")
        params["role_code"] = role_code
    if owner_user_id:
        where.append("c.relationship_owner_user_id = CAST(:owner AS uuid)")
        params["owner"] = owner_user_id
    if q:
        where.append("""(
            to_tsvector('simple',
                coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')||' '||
                coalesce(c.email,'')||' '||coalesce(c.phone_number,'')
            ) @@ plainto_tsquery('simple', :q)
        )""")
        params["q"] = q

    sql = f"""
        SELECT c.id, c.tenant_id, c.studio_relation_id, c.user_id,
               c.first_name, c.last_name, c.role_code,
               c.email, c.phone_prefix, c.phone_number, c.linkedin_url,
               c.preferred_language, c.is_primary, c.status, c.notes,
               c.relationship_owner_user_id, c.owner_assigned_at,
               c.source_code, c.source_reference,
               c.relationship_score, c.last_touch_at,
               c.created_at, c.updated_at, c.last_activity_at,
               -- Resolved owner display
               ou.email   AS owner_email,
               coalesce(ou.full_name, ou.email) AS owner_display
          FROM tenant_contacts c
          LEFT JOIN users ou ON ou.id = c.relationship_owner_user_id
         WHERE {' AND '.join(where)}
         ORDER BY c.is_primary DESC, c.created_at DESC
         LIMIT :limit OFFSET :offset
    """
    async with AsyncSessionLocal() as s:
        rows = (await s.execute(text(sql), params)).mappings().all()
    return [dict(r) for r in rows]


async def get_contact(tenant_id: str, contact_id: str) -> dict[str, Any]:
    rows = await list_contacts(tenant_id, status=None, limit=1, offset=0)
    # Simpler: direct query
    async with AsyncSessionLocal() as s:
        row = (await s.execute(text("""
            SELECT c.*,
                   coalesce(ou.full_name, ou.email) AS owner_display,
                   ou.email AS owner_email
              FROM tenant_contacts c
              LEFT JOIN users ou ON ou.id = c.relationship_owner_user_id
             WHERE c.id = CAST(:cid AS uuid)
               AND c.tenant_id = CAST(:tid AS uuid)
        """), {"cid": contact_id, "tid": tenant_id})).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Contact not found")
    return dict(row)


async def create_contact(tenant_id: str, payload: dict[str, Any],
                          *, actor_user_id: Optional[str] = None,
                          studio_relation_id: Optional[str] = None,
                          source_default: str = "manual") -> dict[str, Any]:
    """Create with anti-duplicate guard on (tenant_id, lower(email))."""
    required = {"first_name", "role_code"}
    missing = required - payload.keys()
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing fields: {sorted(missing)}")

    email = (payload.get("email") or "").strip() or None
    async with AsyncSessionLocal() as s:
        # Anti-dup check
        if email:
            dup = (await s.execute(text("""
                SELECT id FROM tenant_contacts
                 WHERE tenant_id = CAST(:tid AS uuid)
                   AND lower(email) = lower(:email)
                   AND status <> 'archived'
                 LIMIT 1
            """), {"tid": tenant_id, "email": email})).scalar()
            if dup:
                raise HTTPException(status_code=409, detail={
                    "code": "duplicate_email",
                    "message": "Esiste già un contatto attivo con questa email",
                    "existing_contact_id": str(dup),
                })

        # Normalize/validate preferred_language ('it' → 'it-IT', or 422)
        normalized_lang = await _normalize_language(
            s, payload.get("preferred_language"))

        # is_primary management — unset others if requested
        is_primary = bool(payload.get("is_primary"))
        if is_primary:
            await s.execute(text("""
                UPDATE tenant_contacts SET is_primary = FALSE
                 WHERE tenant_id = CAST(:tid AS uuid)
                   AND is_primary = TRUE
                   AND status = 'active'
            """), {"tid": tenant_id})

        new = (await s.execute(text("""
            INSERT INTO tenant_contacts (
                tenant_id, studio_relation_id, first_name, last_name,
                role_code, email, phone_prefix, phone_number, linkedin_url,
                preferred_language, is_primary, status, notes,
                source_code, source_reference, created_by, metadata
            ) VALUES (
                CAST(:tid AS uuid),
                CAST(:rel AS uuid),
                :first_name, :last_name,
                :role_code, :email, :phone_prefix, :phone_number, :linkedin_url,
                :preferred_language, :is_primary, 'active', :notes,
                :source_code, :source_reference, CAST(:by AS uuid),
                CAST(:meta AS jsonb)
            )
            RETURNING id
        """), {
            "tid": tenant_id,
            "rel": studio_relation_id,
            "first_name": payload["first_name"].strip(),
            "last_name": (payload.get("last_name") or "").strip() or None,
            "role_code": payload["role_code"],
            "email": email,
            "phone_prefix": (payload.get("phone_prefix") or "").strip() or None,
            "phone_number": (payload.get("phone_number") or "").strip() or None,
            "linkedin_url": (payload.get("linkedin_url") or "").strip() or None,
            "preferred_language": normalized_lang,
            "is_primary": is_primary,
            "notes": payload.get("notes"),
            "source_code": payload.get("source_code") or source_default,
            "source_reference": payload.get("source_reference"),
            "by": actor_user_id,
            "meta": json.dumps(payload.get("metadata") or {}),
        })).scalar()

        # Emit relationship event
        await _emit_event(
            s, tenant_id, studio_relation_id,
            "contact_added", actor_user_id,
            {"contact_id": str(new),
             "role_code": payload["role_code"],
             "name": f"{payload['first_name']} {payload.get('last_name','')}".strip()})

        await s.commit()
    return await get_contact(tenant_id, str(new))


async def update_contact(tenant_id: str, contact_id: str,
                          payload: dict[str, Any], *,
                          actor_user_id: Optional[str] = None,
                          allow_owner_change: bool = True) -> dict[str, Any]:
    """Update partial. `allow_owner_change=False` for founder (D4)."""
    existing = await get_contact(tenant_id, contact_id)
    fields: list[str] = []
    params: dict[str, Any] = {"cid": contact_id, "tid": tenant_id}

    UPDATABLE = {
        "first_name", "last_name", "role_code", "email", "phone_prefix",
        "phone_number", "linkedin_url", "preferred_language", "notes",
        "status", "source_code", "source_reference",
    }
    if allow_owner_change:
        UPDATABLE = UPDATABLE | {"relationship_owner_user_id"}

    # Anti-dup check on email change
    if "email" in payload and payload["email"]:
        new_email = payload["email"].strip()
        if (new_email or "").lower() != (existing.get("email") or "").lower():
            async with AsyncSessionLocal() as s:
                dup = (await s.execute(text("""
                    SELECT id FROM tenant_contacts
                     WHERE tenant_id = CAST(:tid AS uuid)
                       AND lower(email) = lower(:email)
                       AND status <> 'archived'
                       AND id <> CAST(:cid AS uuid)
                     LIMIT 1
                """), {"tid": tenant_id, "email": new_email, "cid": contact_id})).scalar()
                if dup:
                    raise HTTPException(status_code=409, detail={
                        "code": "duplicate_email",
                        "existing_contact_id": str(dup),
                    })

    for k, v in payload.items():
        if k in UPDATABLE:
            if k == "relationship_owner_user_id":
                fields.append(f"{k} = CAST(:{k} AS uuid)")
                fields.append("owner_assigned_at = NOW()")
                fields.append(f"owner_assigned_by = CAST(:_actor AS uuid)")
            else:
                fields.append(f"{k} = :{k}")
            params[k] = v

    # Normalize preferred_language if present in update (422 on invalid)
    if "preferred_language" in params:
        async with AsyncSessionLocal() as _s:
            params["preferred_language"] = await _normalize_language(
                _s, params["preferred_language"])

    if not fields:
        return existing

    params["_actor"] = actor_user_id
    fields.append("updated_at = NOW()")

    async with AsyncSessionLocal() as s:
        await s.execute(text(f"""
            UPDATE tenant_contacts SET {', '.join(fields)}
             WHERE id = CAST(:cid AS uuid)
               AND tenant_id = CAST(:tid AS uuid)
        """), params)
        await s.commit()
    return await get_contact(tenant_id, contact_id)


async def archive_contact(tenant_id: str, contact_id: str, *,
                           actor_user_id: Optional[str] = None) -> dict[str, Any]:
    """Soft-delete (status='archived')."""
    existing = await get_contact(tenant_id, contact_id)
    async with AsyncSessionLocal() as s:
        await s.execute(text("""
            UPDATE tenant_contacts
               SET status = 'archived',
                   archived_at = NOW(),
                   is_primary = FALSE,
                   updated_at = NOW()
             WHERE id = CAST(:cid AS uuid)
               AND tenant_id = CAST(:tid AS uuid)
        """), {"cid": contact_id, "tid": tenant_id})
        await _emit_event(
            s, tenant_id, existing.get("studio_relation_id"),
            "contact_archived", actor_user_id,
            {"contact_id": contact_id})
        await s.commit()
    return {"ok": True, "id": contact_id, "status": "archived"}


async def set_primary(tenant_id: str, contact_id: str, *,
                       actor_user_id: Optional[str] = None) -> dict[str, Any]:
    """Mark a contact as the tenant primary (single active primary)."""
    async with AsyncSessionLocal() as s:
        # Unset others
        await s.execute(text("""
            UPDATE tenant_contacts SET is_primary = FALSE
             WHERE tenant_id = CAST(:tid AS uuid)
               AND is_primary = TRUE
               AND status = 'active'
        """), {"tid": tenant_id})
        # Set this one
        r = await s.execute(text("""
            UPDATE tenant_contacts
               SET is_primary = TRUE, updated_at = NOW()
             WHERE id = CAST(:cid AS uuid)
               AND tenant_id = CAST(:tid AS uuid)
               AND status = 'active'
            RETURNING id
        """), {"cid": contact_id, "tid": tenant_id})
        if not r.scalar():
            raise HTTPException(status_code=404, detail="Active contact not found")
        await s.commit()
    return await get_contact(tenant_id, contact_id)


async def assign_owner(tenant_id: str, contact_id: str,
                       owner_user_id: Optional[str], *,
                       actor_user_id: Optional[str] = None) -> dict[str, Any]:
    """Assign or clear `relationship_owner_user_id`. Admin/Advisor only."""
    return await update_contact(
        tenant_id, contact_id,
        {"relationship_owner_user_id": owner_user_id},
        actor_user_id=actor_user_id, allow_owner_change=True)
