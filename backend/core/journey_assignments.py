"""ITER178 · JOURNEY ASSIGNMENTS™ — service layer.

Manages `design_journey_assignments` rows with the canonical rules:

  - 1 owner UNIQUE active per journey  (DB-enforced via partial unique index)
  - 1 active assignment UNIQUE per (journey, user)  (DB-enforced)
  - Revoking owner without replacement is FORBIDDEN (app-level guard)
  - Owner handoff = revoke current + insert new in a single logical op
  - Every mutation appends an audit row in design_journey_assignment_events

Coexists with `core/human_assignment.py` (account-level referente).
Both subsystems are independent. The journey owner often coincides with
the account assignee, but they are not forced to be identical.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, List

from database import db

log = logging.getLogger(__name__)

ROLE_OWNER       = "owner"
ROLE_CONTRIBUTOR = "contributor"
ROLE_OBSERVER    = "observer"
VALID_ROLES = {ROLE_OWNER, ROLE_CONTRIBUTOR, ROLE_OBSERVER}

# Default client visibility per role.
_DEFAULT_CLIENT_VISIBLE = {
    ROLE_OWNER:       True,
    ROLE_CONTRIBUTOR: True,
    ROLE_OBSERVER:    False,
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Internal helpers ──────────────────────────────────────────────────────
def _emit_event(
    tenant_id: str,
    assignment: Dict,
    event_type: str,
    actor_user_id: Optional[str],
    payload: Optional[Dict] = None,
) -> None:
    """Append a row in design_journey_assignment_events (non-fatal on error)."""
    try:
        db().table("design_journey_assignment_events").insert({
            "id":             str(uuid.uuid4()),
            "tenant_id":      tenant_id,
            "assignment_id":  assignment["id"],
            "journey_id":     assignment["journey_id"],
            "event_type":     event_type,
            "actor_user_id":  actor_user_id,
            "payload_json":   payload or {},
            "created_at":     _now(),
        }).execute()
    except Exception:
        log.exception(
            "djae event insert failed (non-fatal) tenant=%s event=%s",
            tenant_id, event_type,
        )


def get_active_assignments(tenant_id: str, journey_id: str) -> List[Dict]:
    """Return all active assignments for a journey, owner first."""
    rows = (
        db().table("design_journey_assignments")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("journey_id", journey_id)
            .is_("revoked_at", "null")
            .order("assignment_role", desc=False)   # 'contributor','observer','owner'
            .order("assigned_at", desc=False)
            .execute()
            .data or []
    )
    # Push owner first regardless of alpha order
    rows.sort(key=lambda r: (0 if r["assignment_role"] == ROLE_OWNER else 1,
                             r["assigned_at"]))
    return rows


def get_current_owner(tenant_id: str, journey_id: str) -> Optional[Dict]:
    rows = (
        db().table("design_journey_assignments")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("journey_id", journey_id)
            .eq("assignment_role", ROLE_OWNER)
            .is_("revoked_at", "null")
            .limit(1)
            .execute()
            .data or []
    )
    return rows[0] if rows else None


def get_active_assignment_for_user(
    tenant_id: str, journey_id: str, user_id: str,
) -> Optional[Dict]:
    rows = (
        db().table("design_journey_assignments")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("journey_id", journey_id)
            .eq("user_id", user_id)
            .is_("revoked_at", "null")
            .limit(1)
            .execute()
            .data or []
    )
    return rows[0] if rows else None


# ── Public API ────────────────────────────────────────────────────────────
def ensure_owner(
    tenant_id: str,
    journey_id: str,
    user_id: str,
    *,
    created_by: Optional[str] = None,
    client_visible: Optional[bool] = None,
) -> Dict:
    """Idempotent creation of the owner row at journey creation time.

    - If an active owner already exists and is `user_id`, returns it.
    - If an active owner exists but is a different user, performs handoff.
    - If no active owner, inserts a new owner row.

    Used by `journey_initiate.py` after creating the design_journey row.
    """
    existing = get_current_owner(tenant_id, journey_id)
    if existing and existing["user_id"] == user_id:
        return existing
    if existing:
        return change_owner(
            tenant_id, journey_id,
            new_owner_user_id=user_id,
            actor_user_id=created_by,
            reason="auto_handoff_during_init",
        )
    visible = _DEFAULT_CLIENT_VISIBLE[ROLE_OWNER] if client_visible is None else client_visible
    row = {
        "id":               str(uuid.uuid4()),
        "tenant_id":        tenant_id,
        "journey_id":       journey_id,
        "user_id":          user_id,
        "assignment_role":  ROLE_OWNER,
        "client_visible":   visible,
        "assigned_at":      _now(),
        "assigned_by":      created_by,
        "metadata_json":    {"created_via": "journey_initiate"},
    }
    db().table("design_journey_assignments").insert(row).execute()
    _emit_event(tenant_id, row, "owner_assigned", created_by,
                {"user_id": user_id, "client_visible": visible})
    log.info("dja.owner_assigned journey=%s user=%s", journey_id, user_id)
    return row


def add_assignment(
    tenant_id: str,
    journey_id: str,
    user_id: str,
    role: str,
    *,
    actor_user_id: Optional[str] = None,
    client_visible: Optional[bool] = None,
) -> Dict:
    """Add a contributor or observer (use `change_owner` for owner handoff).

    Raises ValueError on invariant violations (caught by router → 4xx).
    """
    if role not in (ROLE_CONTRIBUTOR, ROLE_OBSERVER):
        raise ValueError(
            f"add_assignment supports only contributor/observer (got '{role}'). "
            "Use change_owner() for owner handoff."
        )
    # Reject if user already has any active assignment on this journey
    existing = get_active_assignment_for_user(tenant_id, journey_id, user_id)
    if existing:
        raise ValueError(
            f"user_already_assigned: {user_id} is already "
            f"'{existing['assignment_role']}' on this journey "
            f"(assignment_id={existing['id']})"
        )
    visible = _DEFAULT_CLIENT_VISIBLE[role] if client_visible is None else client_visible
    row = {
        "id":               str(uuid.uuid4()),
        "tenant_id":        tenant_id,
        "journey_id":       journey_id,
        "user_id":          user_id,
        "assignment_role":  role,
        "client_visible":   visible,
        "assigned_at":      _now(),
        "assigned_by":      actor_user_id,
        "metadata_json":    {},
    }
    db().table("design_journey_assignments").insert(row).execute()
    event_type = "contributor_added" if role == ROLE_CONTRIBUTOR else "observer_added"
    _emit_event(tenant_id, row, event_type, actor_user_id,
                {"user_id": user_id, "client_visible": visible})
    log.info("dja.%s journey=%s user=%s", event_type, journey_id, user_id)
    return row


def revoke_assignment(
    tenant_id: str,
    journey_id: str,
    assignment_id: str,
    *,
    actor_user_id: Optional[str] = None,
    reason: Optional[str] = None,
) -> Dict:
    """Soft-revoke a contributor/observer. Rejects revocation of owner
    (use `change_owner` for handoff, which inherently revokes the current).
    """
    rows = (
        db().table("design_journey_assignments")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("id", assignment_id)
            .limit(1)
            .execute()
            .data or []
    )
    if not rows:
        raise ValueError("assignment_not_found")
    a = rows[0]
    if a["journey_id"] != journey_id:
        raise ValueError("journey_mismatch")
    if a.get("revoked_at"):
        raise ValueError("already_revoked")
    if a["assignment_role"] == ROLE_OWNER:
        raise ValueError(
            "cannot_revoke_owner_without_replacement: "
            "use change_owner() to handoff to a different user"
        )
    now_iso = _now()
    db().table("design_journey_assignments").update({
        "revoked_at":    now_iso,
        "revoked_by":    actor_user_id,
        "revoke_reason": reason or "manual",
        "updated_at":    now_iso,
    }).eq("id", assignment_id).execute()
    role = a["assignment_role"]
    event_type = "contributor_removed" if role == ROLE_CONTRIBUTOR else "observer_removed"
    _emit_event(tenant_id, a, event_type, actor_user_id,
                {"user_id": a["user_id"], "reason": reason})
    log.info("dja.%s journey=%s user=%s", event_type, journey_id, a["user_id"])
    a["revoked_at"]    = now_iso
    a["revoked_by"]    = actor_user_id
    a["revoke_reason"] = reason or "manual"
    return a


def change_owner(
    tenant_id: str,
    journey_id: str,
    new_owner_user_id: str,
    *,
    actor_user_id: Optional[str] = None,
    reason: Optional[str] = None,
) -> Dict:
    """Handoff owner role to a new user.

    Workflow:
      1. Validate new_owner_user_id is a valid users_profile in this tenant
      2. If new user is currently contributor/observer on this journey,
         revoke that row first (free up the user)
      3. Revoke current owner (if any)
      4. Insert new owner row
      5. Emit `owner_changed` event with old/new payload

    Raises ValueError on invariant violations.
    """
    c = db()

    # Validate target user exists in same tenant
    target = (c.table("users_profile").select("id,tenant_id,role,status")
                .eq("id", new_owner_user_id).limit(1).execute().data or [])
    if not target:
        raise ValueError("target_user_not_found")
    if target[0]["tenant_id"] != tenant_id:
        raise ValueError("target_user_wrong_tenant")
    if target[0].get("status") == "suspended":
        raise ValueError("target_user_suspended")

    current_owner = get_current_owner(tenant_id, journey_id)
    if current_owner and current_owner["user_id"] == new_owner_user_id:
        return current_owner

    now_iso = _now()

    # If target user already has contributor/observer row, revoke it first
    pre_existing = get_active_assignment_for_user(tenant_id, journey_id, new_owner_user_id)
    if pre_existing:
        c.table("design_journey_assignments").update({
            "revoked_at":    now_iso,
            "revoked_by":    actor_user_id,
            "revoke_reason": "promoted_to_owner",
            "updated_at":    now_iso,
        }).eq("id", pre_existing["id"]).execute()
        _emit_event(tenant_id, pre_existing,
                    "role_changed", actor_user_id,
                    {"from": pre_existing["assignment_role"], "to": "owner",
                     "note": "revoked previous non-owner row before owner insert"})

    # Revoke current owner (if any)
    if current_owner:
        c.table("design_journey_assignments").update({
            "revoked_at":    now_iso,
            "revoked_by":    actor_user_id,
            "revoke_reason": reason or "owner_handoff",
            "updated_at":    now_iso,
        }).eq("id", current_owner["id"]).execute()

    # Insert new owner
    new_row = {
        "id":               str(uuid.uuid4()),
        "tenant_id":        tenant_id,
        "journey_id":       journey_id,
        "user_id":          new_owner_user_id,
        "assignment_role":  ROLE_OWNER,
        "client_visible":   _DEFAULT_CLIENT_VISIBLE[ROLE_OWNER],
        "assigned_at":      now_iso,
        "assigned_by":      actor_user_id,
        "metadata_json":    {"handoff_from": current_owner["user_id"]
                             if current_owner else None,
                             "reason": reason},
    }
    c.table("design_journey_assignments").insert(new_row).execute()

    # Compound audit event (links both rows by payload)
    _emit_event(tenant_id, new_row, "owner_changed", actor_user_id, {
        "from_user_id":    current_owner["user_id"] if current_owner else None,
        "from_assignment": current_owner["id"]      if current_owner else None,
        "to_user_id":      new_owner_user_id,
        "to_assignment":   new_row["id"],
        "reason":          reason,
    })
    log.info("dja.owner_changed journey=%s from=%s to=%s",
             journey_id,
             current_owner["user_id"] if current_owner else None,
             new_owner_user_id)
    return new_row


def list_user_journeys(tenant_id: str, user_id: str) -> List[Dict]:
    """Return journeys where the user has any active assignment.

    Output shape:
      [{ journey_id, assignment_id, assignment_role, client_visible,
         assigned_at, ... + denormalized journey fields }]
    """
    c = db()
    asg = (c.table("design_journey_assignments")
             .select("*")
             .eq("tenant_id", tenant_id)
             .eq("user_id", user_id)
             .is_("revoked_at", "null")
             .order("assigned_at", desc=True)
             .execute()
             .data or [])
    if not asg:
        return []
    journey_ids = [a["journey_id"] for a in asg]
    journeys = (c.table("design_journeys")
                  .select("id,project_id,account_id,lifecycle_state,"
                          "overall_status,started_at,closed_at,created_at")
                  .eq("tenant_id", tenant_id)
                  .in_("id", journey_ids)
                  .execute()
                  .data or [])
    jmap = {j["id"]: j for j in journeys}
    # Hydrate account name for display
    account_ids = [j["account_id"] for j in journeys if j.get("account_id")]
    accounts = []
    if account_ids:
        accounts = (c.table("accounts")
                      .select("id,account_name,email")
                      .in_("id", account_ids)
                      .execute()
                      .data or [])
    amap = {a["id"]: a for a in accounts}
    out = []
    for a in asg:
        j = jmap.get(a["journey_id"]) or {}
        acc = amap.get(j.get("account_id")) if j else None
        out.append({
            "assignment_id":      a["id"],
            "assignment_role":    a["assignment_role"],
            "client_visible":     a["client_visible"],
            "assigned_at":        a["assigned_at"],
            "journey_id":         a["journey_id"],
            "lifecycle_state":    j.get("lifecycle_state"),
            "overall_status":     j.get("overall_status"),
            "started_at":         j.get("started_at"),
            "closed_at":          j.get("closed_at"),
            "account": {
                "id":           (acc or {}).get("id"),
                "account_name": (acc or {}).get("account_name"),
                "email":        (acc or {}).get("email"),
            } if acc else None,
        })
    return out


def list_events(tenant_id: str, journey_id: str, limit: int = 50) -> List[Dict]:
    """Return recent audit events for a journey, newest first."""
    return (db().table("design_journey_assignment_events")
                  .select("*")
                  .eq("tenant_id", tenant_id)
                  .eq("journey_id", journey_id)
                  .order("created_at", desc=True)
                  .limit(limit)
                  .execute()
                  .data or [])
