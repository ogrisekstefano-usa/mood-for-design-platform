"""Human Assignment Engine — Phase S.1 foundation.

Real, tenant-aware assignment of a single human reference per
subject (client / lead / project / studio_onboarding).

ABSOLUTE RULES:
    1. NO hardcoded users.
    2. NO fake "MOOD Support" personae.
    3. NO cross-tenant assignment.
    4. Round-robin V1 is deterministic per tenant based on the
       count of existing `active` assignments to each candidate.
    5. When no candidate exists → status='unassigned' is recorded
       and the API returns null (frontend renders a calm hint).
"""
from typing import Optional, List, Dict
from datetime import datetime, timezone
import uuid
import logging
from database import db

log = logging.getLogger(__name__)


# Candidate roles ordered by priority. The first non-empty group wins.
# Once a group is chosen, all members of that group compete round-robin.
# RULE: super_admin is NEVER a candidate for client assignments.
_PRIORITY_FOR_CLIENT: List[List[str]] = [
    ["tenant_admin"],
    ["project_manager"],
    ["designer", "editor"],
]

_PRIORITY_FOR_STUDIO_ONBOARDING: List[List[str]] = [
    ["super_admin"],
    ["tenant_admin"],
    ["project_manager"],
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _candidates_for(tenant_id: str, subject_type: str) -> List[Dict]:
    """Return the FIRST non-empty group of candidate profiles.
    Sorted by `(active_assignments_count ASC, created_at ASC)` so that
    round-robin is deterministic and history-aware.
    """
    c = db()
    role_groups = (_PRIORITY_FOR_STUDIO_ONBOARDING
                   if subject_type == "studio_onboarding"
                   else _PRIORITY_FOR_CLIENT)
    for roles in role_groups:
        # Belt-and-suspenders: super_admin is ALWAYS excluded from client routing,
        # regardless of which role_group is being evaluated.
        r = (
            c.table("users_profile")
            .select("id,first_name,last_name,role,email,avatar_url,short_bio,role_label,response_time_label,contact_cta_label,created_at")
            .eq("tenant_id", tenant_id)
            .in_("role", roles)
            .eq("status", "active")
            .neq("role", "super_admin")
            .execute()
        )
        members = r.data or []
        if not members:
            continue
        # Count active assignments per candidate for round-robin tie-break
        ids = [m["id"] for m in members]
        counts: Dict[str, int] = {mid: 0 for mid in ids}
        a = (
            c.table("human_assignments")
            .select("assignee_user_id")
            .eq("tenant_id", tenant_id)
            .eq("status", "active")
            .in_("assignee_user_id", ids)
            .execute()
        )
        for row in (a.data or []):
            aid = row.get("assignee_user_id")
            if aid in counts:
                counts[aid] += 1
        members.sort(key=lambda m: (counts.get(m["id"], 0), m.get("created_at") or ""))
        return members
    return []


def get_active_assignment(tenant_id: str, subject_type: str, subject_id: str) -> Optional[Dict]:
    """Return the current `active` assignment row, or None."""
    c = db()
    r = (
        c.table("human_assignments")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("subject_type", subject_type)
        .eq("subject_id", subject_id)
        .eq("status", "active")
        .limit(1)
        .execute()
    )
    return r.data[0] if r.data else None


def public_assignee_profile(profile: Optional[Dict]) -> Optional[Dict]:
    """Strip a users_profile row to the public-safe shape the client UI
    is allowed to consume. Never leak admin metadata or backend IDs."""
    if not profile:
        return None
    first = (profile.get("first_name") or "").strip()
    last = (profile.get("last_name") or "").strip()
    full_name = (first + " " + last).strip() or (profile.get("email") or "Studio").split("@")[0]
    return {
        "id": profile.get("id"),  # opaque uuid, no role / tenant
        "name": full_name,
        "first_name": first or None,
        "avatar_url": profile.get("avatar_url"),
        "role_label": profile.get("role_label") or _default_role_label(profile.get("role")),
        "short_bio": profile.get("short_bio") or "",
        "response_time_label": profile.get("response_time_label") or "Risponde in giornata",
        "contact_cta_label": profile.get("contact_cta_label") or "Scrivi al tuo referente",
    }


def _default_role_label(role: Optional[str]) -> str:
    """Soft, atelier-grade labels for the public profile."""
    return {
        "tenant_admin": "Direzione studio",
        "project_manager": "Project Manager",
        "designer": "Designer",
        "editor": "Editor",
        "super_admin": "Direzione MOOD for DESIGN",
    }.get((role or "").lower(), "Studio")


def assign(
    tenant_id: str,
    subject_type: str,
    subject_id: str,
    *,
    created_by: Optional[str] = None,
    force_assignee: Optional[str] = None,
    manual_override: bool = False,
) -> Dict:
    """Idempotent assignment.

    - If an active assignment already exists, returns it (no duplicates).
    - If `force_assignee` is provided (manual override), creates an
      assignment for that user without round-robin logic.
    - Otherwise picks the lowest-loaded candidate from the highest
      priority non-empty role group.
    - When no candidate exists → records status='unassigned' so the
      frontend can show "Il team sta assegnando il referente".
    """
    c = db()
    existing = get_active_assignment(tenant_id, subject_type, subject_id)
    if existing and not manual_override:
        return existing

    if manual_override and existing:
        # Mark existing as reassigned
        c.table("human_assignments").update({
            "status": "reassigned", "updated_at": _now(),
        }).eq("id", existing["id"]).execute()
        c.table("human_assignment_events").insert({
            "id": str(uuid.uuid4()),
            "assignment_id": existing["id"],
            "event_type": "reassigned",
            "actor_user_id": created_by,
            "payload_json": {"reason": "manual_override"},
            "created_at": _now(),
        }).execute()

    assignee_id = None
    reason = "unassigned"

    if force_assignee:
        assignee_id = force_assignee
        reason = "manual_override"
    else:
        candidates = _candidates_for(tenant_id, subject_type)
        if len(candidates) == 1:
            assignee_id = candidates[0]["id"]
            reason = "only_available_user"
        elif len(candidates) > 1:
            assignee_id = candidates[0]["id"]  # lowest-load wins
            reason = "round_robin"
        else:
            # No human in the tenant at all — record as unassigned
            assignee_id = None
            reason = "unassigned"

    row = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "subject_type": subject_type,
        "subject_id": subject_id,
        "assignee_user_id": assignee_id,
        "assignment_reason": reason,
        "status": "active",
        "created_at": _now(),
        "updated_at": _now(),
        "created_by": created_by,
        "metadata_json": {},
    }
    c.table("human_assignments").insert(row).execute()

    c.table("human_assignment_events").insert({
        "id": str(uuid.uuid4()),
        "assignment_id": row["id"],
        "event_type": "assigned",
        "actor_user_id": created_by,
        "payload_json": {"reason": reason},
        "created_at": _now(),
    }).execute()

    log.info(
        "human_assignment.created tenant=%s subject=%s/%s assignee=%s reason=%s",
        tenant_id, subject_type, subject_id, assignee_id, reason,
    )
    return row


def ensure_assignment_for_client(tenant_id: str, client_profile_id: str, created_by: Optional[str] = None) -> Dict:
    """Idempotent: assign a human to a client profile."""
    return assign(tenant_id, "client", client_profile_id, created_by=created_by)


def hydrate_assignee(row: Optional[Dict]) -> Optional[Dict]:
    """Augment an assignment row with the public-safe assignee profile."""
    if not row:
        return None
    aid = row.get("assignee_user_id")
    profile = None
    if aid:
        c = db()
        r = (
            c.table("users_profile")
            .select("id,first_name,last_name,role,email,avatar_url,short_bio,role_label,response_time_label,contact_cta_label")
            .eq("id", aid).limit(1).execute()
        )
        profile = r.data[0] if r.data else None
    return {
        "id": row["id"],
        "subject_type": row["subject_type"],
        "subject_id": row["subject_id"],
        "assignee_user_id": aid,
        "assignment_reason": row.get("assignment_reason"),
        "status": row.get("status"),
        "created_at": row.get("created_at"),
        "assignee": public_assignee_profile(profile),
    }
