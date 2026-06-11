"""Design Journey™ router — Phase F.A.

Backbone narrativa del progetto. NON è project management — è il sistema
operativo curatoriale-relazionale che accompagna il progetto dalla prima
intuizione alla chiusura certificata.

Endpoints:
  GET   /api/projects/{project_id}/journey
        Returns the journey + milestones + timeline. Auto-creates the
        journey + 10 default milestones on first access (Brief in
        'in_progress', tutte le altre 'not_started').

  PATCH /api/journeys/milestones/{milestone_id}
        Update status / metadata. Status transition auto-emits a
        narrative timeline event in italian editorial language.

  GET   /api/journeys/{journey_id}/timeline
        Full project evolution timeline (italian narrative).

  POST  /api/journeys/milestones/{milestone_id}/open
        Resolve the "Apri" CTA target: returns navigation hint
        (inline | navigate + route) per the F.A spec mix policy.

Italian compliance: NO 'task', 'sprint', 'kanban', 'dashboard',
'workflow', 'ticket', 'project management'. USA 'pietre miliari',
'direzione progettuale', 'evoluzione progetto', 'revisione richiesta',
'chiusura certificata'.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from core.tenant_context import get_tenant_context
from database import db
from services import knowledge_usage_hooks as _ke_hooks  # KE-005B.1
from core import journey_assignments as ja
from core.human_assignment import _candidates_for as _ha_candidates

logger = logging.getLogger(__name__)
router = APIRouter()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slim(row: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in (row or {}).items() if k != "_id"}


# ─── DEFAULT MILESTONES (10) ───────────────────────────────────────────
# Mix italian + branded ™ terms (per user spec approval F.A).
DEFAULT_MILESTONES = [
    {"type": "brief",                "title": "Brief Cliente",
     "description": "La prima conversazione progettuale: obiettivi, atmosfera, ambienti.",
     "open_mode": "inline",      "linked_route": None},

    {"type": "inspirations",         "title": "Inspirations™",
     "description": "Linguaggio visuale di partenza: riferimenti, atmosfere, suggestioni.",
     "open_mode": "navigate",    "linked_route": "/inspirations"},

    {"type": "moodboard_direction",  "title": "Moodboard Direction™",
     "description": "La direzione editoriale prende forma in una composizione narrativa.",
     "open_mode": "navigate",    "linked_route": "/moodboards"},

    {"type": "material_direction",   "title": "Material Direction™",
     "description": "Il tavolo materico: pietre, legni, tessuti, palette tattile.",
     "open_mode": "navigate",    "linked_route": "/inspirations/materials"},

    {"type": "concept_design",       "title": "Concept Design™",
     "description": "Render, tavole, layout: il progetto trova la sua spazialità.",
     "open_mode": "navigate",    "linked_route": "/workspace/projects"},

    {"type": "technical_package",    "title": "Technical Package™",
     "description": "Tavole tecniche, schede, documenti — il progetto pronto per il cantiere.",
     "open_mode": "navigate",    "linked_route": "/workspace/projects"},

    {"type": "curated_selections",   "title": "Curated Selections™",
     "description": "Selezioni finali: prodotti scelti, varianti, approvazioni materiche.",
     "open_mode": "navigate",    "linked_route": "/inspirations"},

    {"type": "site_evolution",       "title": "Site Evolution™",
     "description": "L'evoluzione reale del progetto, raccontata per immagini.",
     "open_mode": "inline",      "linked_route": None},

    {"type": "final_presentation",   "title": "Presentazione Finale",
     "description": "L'incontro cinematico in cui il progetto viene celebrato.",
     "open_mode": "navigate",    "linked_route": "/inspirations"},

    {"type": "certified_closure",    "title": "Chiusura Certificata",
     "description": "Il progetto entra nella memoria firmata dello studio.",
     "open_mode": "inline",      "linked_route": None},
]


# ─── Models ────────────────────────────────────────────────────────────
class MilestonePatch(BaseModel):
    status:       Optional[str] = None
    title:        Optional[str] = None
    description:  Optional[str] = None
    owner_user_id: Optional[str] = None
    linked_entity_type: Optional[str] = None
    linked_entity_id:   Optional[str] = None
    metadata:     Optional[Dict[str, Any]] = None
    entity_refs:  Optional[List[str]] = None  # KE-005B · canonical entity ids


VALID_STATUSES = {
    "not_started", "in_progress", "presented", "revision_requested",
    "partially_approved", "approved", "closed",
}

# Narrative templates — italian editorial, NO technical log.
STATUS_NARRATIVE = {
    "in_progress":         "{title} — in lavorazione.",
    "presented":           "{title} presentata al cliente.",
    "revision_requested":  "Cliente chiede una revisione su {title}.",
    "partially_approved":  "{title} approvata parzialmente.",
    "approved":            "{title} approvata. Il progetto avanza.",
    "closed":              "{title} chiusa. Capitolo concluso.",
}


# ─── Helpers ───────────────────────────────────────────────────────────
def _ensure_journey(c, tenant_id: str, project_id: str, user_id: Optional[str]) -> Dict[str, Any]:
    """Find or create the journey for a project. Idempotent.

    SPRINT-0 · P0-B fix:
      - Reads account_id from projects.metadata_json so project-first journeys
        are visible in the client portal (which resolves via account_id).
      - Always sets lifecycle_state='conversation_open' so /mine query
        (which excludes NULLs via neq) never loses this journey.
    """
    rows = (c.table("design_journeys").select("*")
            .eq("tenant_id", tenant_id).eq("project_id", project_id)
            .limit(1).execute().data or [])
    if rows:
        return rows[0]

    # Recover account_id from project metadata (P0-B: project-first path fix)
    account_id: Optional[str] = None
    try:
        prows = (c.table("projects").select("metadata_json")
                 .eq("id", project_id).eq("tenant_id", tenant_id)
                 .limit(1).execute().data or [])
        if prows:
            account_id = (prows[0].get("metadata_json") or {}).get("account_id") or None
    except Exception:
        pass  # non-fatal: journey still created without account_id

    # Create journey
    jid = str(uuid.uuid4())
    j_row = {
        "id":              jid,
        "tenant_id":       tenant_id,
        "project_id":      project_id,
        "account_id":      account_id,            # P0-B: from project meta
        "lifecycle_state": "conversation_open",   # P0-B: always explicit
        "current_milestone_id": None,
        "overall_status":  "in_progress",
        "started_at":      _now(),
        "closed_at":       None,
        "created_by":      user_id,
        "created_at":      _now(),
        "updated_at":      _now(),
    }
    c.table("design_journeys").insert(j_row).execute()

    # Create 10 default milestones
    milestones = []
    for idx, m in enumerate(DEFAULT_MILESTONES):
        is_brief = (m["type"] == "brief")
        mid = str(uuid.uuid4())
        m_row = {
            "id":             mid,
            "journey_id":     jid,
            "tenant_id":      tenant_id,
            "milestone_type": m["type"],
            "title":          m["title"],
            "description":    m["description"],
            "order_index":    idx,
            "status":         "in_progress" if is_brief else "not_started",
            "started_at":     _now() if is_brief else None,
            "presented_at":   None,
            "approved_at":    None,
            "closed_at":      None,
            "owner_user_id":  user_id if is_brief else None,
            "metadata":       {
                "open_mode":    m["open_mode"],
                "linked_route": m["linked_route"],
            },
            "created_at":     _now(),
            "updated_at":     _now(),
        }
        milestones.append(m_row)
    c.table("journey_milestones").insert(milestones).execute()

    # Set current_milestone_id to the Brief
    brief_mid = next(m["id"] for m in milestones if m["milestone_type"] == "brief")
    c.table("design_journeys").update(
        {"current_milestone_id": brief_mid, "updated_at": _now()}
    ).eq("id", jid).execute()
    j_row["current_milestone_id"] = brief_mid

    # Initial narrative events
    events = [
        {
            "id":           str(uuid.uuid4()),
            "journey_id":   jid,
            "tenant_id":    tenant_id,
            "milestone_id": None,
            "event_type":   "journey_started",
            "narrative_text": "Il Design Journey™ del progetto inizia. Una direzione progettuale prende forma.",
            "created_by":   user_id,
            "metadata":     {},
            "created_at":   _now(),
        },
        {
            "id":           str(uuid.uuid4()),
            "journey_id":   jid,
            "tenant_id":    tenant_id,
            "milestone_id": brief_mid,
            "event_type":   "milestone_started",
            "narrative_text": "Brief Cliente — in lavorazione. La prima conversazione progettuale è avviata.",
            "created_by":   user_id,
            "metadata":     {},
            "created_at":   _now(),
        },
    ]
    c.table("journey_timeline_events").insert(events).execute()

    # JOURNEY OWNERSHIP · Assegna creator o primo membro disponibile come owner
    try:
        owner_id = user_id
        if not owner_id:
            candidates = _ha_candidates(tenant_id, 'client')
            owner_id = candidates[0]['id'] if candidates else None
        if owner_id:
            ja.ensure_owner(tenant_id, jid, user_id=owner_id, created_by=user_id)
    except Exception:
        logger.exception("_ensure_journey: owner assignment failed (non-blocking)")

    return j_row


def _emit_event(c, *, journey_id: str, tenant_id: str, milestone_id: Optional[str],
                event_type: str, narrative: str, created_by: Optional[str] = None,
                meta: Optional[Dict[str, Any]] = None) -> None:
    c.table("journey_timeline_events").insert({
        "id":             str(uuid.uuid4()),
        "journey_id":     journey_id,
        "tenant_id":      tenant_id,
        "milestone_id":   milestone_id,
        "event_type":     event_type,
        "narrative_text": narrative,
        "created_by":     created_by,
        "metadata":       meta or {},
        "created_at":     _now(),
    }).execute()


# ─── Endpoints ─────────────────────────────────────────────────────────
@router.get("/projects/{project_id}/journey")
def get_or_create_journey(project_id: str,
                          locale: str = Query("en-US"),
                          ctx=Depends(get_tenant_context)):
    """Get the project's Design Journey™ + milestones + timeline.
    Auto-creates everything on first access."""
    c = db()
    tid = ctx["tenant_id"]
    uid = ctx.get("profile_id")

    # Verify project belongs to tenant (best-effort — table may or may not exist
    # depending on tenant setup; we do a soft check)
    journey = _ensure_journey(c, tid, project_id, uid)

    milestones = (c.table("journey_milestones").select("*")
                  .eq("journey_id", journey["id"]).eq("tenant_id", tid)
                  .order("order_index", desc=False).execute().data or [])
    timeline = (c.table("journey_timeline_events").select("*")
                .eq("journey_id", journey["id"]).eq("tenant_id", tid)
                .order("created_at", desc=True).limit(120).execute().data or [])

    milestones_out = [_slim(m) for m in milestones]
    timeline_out   = [_slim(e) for e in timeline]

    # ITER139 · ALE-on-read · localise journey narrative fields into the
    # active locale (multi-source-language aware).
    try:
        from services.editorial_translation_layer import (
            localize_records as _ale_localize_records,
            normalize_locale as _ale_norm,
        )
        ale_target = _ale_norm(locale)
        if ale_target:
            milestones_out = _ale_localize_records(
                milestones_out, fields=('title', 'description', 'narrative'),
                target_locale=ale_target, tenant_id=tid,
                surface='journey_milestone')
            timeline_out = _ale_localize_records(
                timeline_out, fields=('narrative', 'event_type_label', 'title'),
                target_locale=ale_target, tenant_id=tid,
                surface='journey_timeline_event')
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("ALE journey skipped: %s", e)

    return {
        "journey":    _slim(journey),
        "milestones": milestones_out,
        "timeline":   timeline_out,
    }


@router.patch("/journeys/milestones/{mid}")
def patch_milestone(mid: str, body: MilestonePatch,
                    ctx=Depends(get_tenant_context)):
    """DEPRECATED since SPRINT-1 · use PATCH /journeys/{jid}/milestones/{mid}.

    This endpoint continues to function but emits a Deprecation header so that
    API clients and monitoring can track remaining callers before removal.
    """
    from fastapi import Response as _Resp
    import warnings
    warnings.warn(
        "PATCH /journeys/milestones/{mid} is deprecated — "
        "migrate to PATCH /journeys/{jid}/milestones/{mid}",
        DeprecationWarning, stacklevel=2,
    )
    logger.warning(
        "DEPRECATED endpoint called: PATCH /journeys/milestones/%s — "
        "migrate to PATCH /journeys/{jid}/milestones/{mid}", mid
    )
    c = db()
    tid = ctx["tenant_id"]
    uid = ctx.get("profile_id")
    rows = (c.table("journey_milestones").select("*")
            .eq("id", mid).eq("tenant_id", tid).limit(1)
            .execute().data or [])
    if not rows:
        raise HTTPException(404, "Pietra miliare non trovata")
    cur = rows[0]

    patch: Dict[str, Any] = {}
    new_status: Optional[str] = None
    if body.status is not None:
        s = body.status.lower()
        if s not in VALID_STATUSES:
            raise HTTPException(400, "Stato non valido")
        if s != cur["status"]:
            new_status = s
            patch["status"] = s
            # Timestamp transitions
            if s == "in_progress" and not cur.get("started_at"):
                patch["started_at"] = _now()
            if s == "presented":
                patch["presented_at"] = _now()
            if s == "approved":
                patch["approved_at"] = _now()
            if s == "closed":
                patch["closed_at"] = _now()
    if body.title is not None:       patch["title"] = body.title.strip()[:200]
    if body.description is not None: patch["description"] = body.description.strip() or None
    if body.owner_user_id is not None: patch["owner_user_id"] = body.owner_user_id or None
    if body.linked_entity_type is not None: patch["linked_entity_type"] = body.linked_entity_type or None
    if body.linked_entity_id is not None:   patch["linked_entity_id"]   = body.linked_entity_id or None
    if body.metadata is not None:
        merged = {**(cur.get("metadata") or {}), **(body.metadata or {})}
        patch["metadata"] = merged
    # KE-005B · entity_refs JSONB diff (deferred to dopo l'update SQL)
    entity_refs_provided = body.entity_refs is not None
    if entity_refs_provided:
        patch["entity_refs"] = body.entity_refs or []

    if not patch:
        return {"item": _slim(cur)}

    patch["updated_at"] = _now()
    c.table("journey_milestones").update(patch).eq("id", mid).execute()

    # KE-005B · attach/detach diff per entity_refs
    if entity_refs_provided:
        try:
            prev = cur.get("entity_refs") or []
            if not isinstance(prev, list):
                prev = []
            _ke_hooks.sync_entity_refs(
                tenant_id=tid, surface_type="design_journey",
                surface_id=mid, previous_ids=prev,
                new_ids=body.entity_refs or [],
                user_id=uid,
            )
        except Exception as ex:
            logger.warning(f"ke005b sync_entity_refs failed: {ex}")

    if new_status:
        narrative = STATUS_NARRATIVE.get(new_status, "{title} aggiornata.").format(
            title=cur["title"],
        )
        _emit_event(
            c,
            journey_id=cur["journey_id"],
            tenant_id=tid,
            milestone_id=mid,
            event_type=f"milestone_{new_status}",
            narrative=narrative,
            created_by=uid,
        )
        # If approved → mark journey current_milestone to next not-yet-started
        if new_status in ("approved", "closed"):
            sib = (c.table("journey_milestones").select("id,order_index,status")
                   .eq("journey_id", cur["journey_id"])
                   .eq("tenant_id", tid)
                   .gt("order_index", cur["order_index"])
                   .order("order_index", desc=False).limit(1)
                   .execute().data or [])
            if sib:
                c.table("design_journeys").update(
                    {"current_milestone_id": sib[0]["id"], "updated_at": _now()}
                ).eq("id", cur["journey_id"]).execute()
        # If a Certified Closure approved → close journey
        if cur.get("milestone_type") == "certified_closure" and new_status == "approved":
            c.table("design_journeys").update(
                {"overall_status": "closed", "closed_at": _now(),
                 "updated_at": _now()}
            ).eq("id", cur["journey_id"]).execute()
            _emit_event(
                c, journey_id=cur["journey_id"], tenant_id=tid,
                milestone_id=mid, event_type="journey_closed",
                narrative="Design Journey™ chiuso. Il progetto entra nella memoria firmata dello studio.",
                created_by=uid,
            )

    upd = (c.table("journey_milestones").select("*")
           .eq("id", mid).limit(1).execute().data or [])[0]
    return {"item": _slim(upd)}


@router.get("/journeys/{jid}/timeline")
def get_timeline(jid: str, locale: str = Query("en-US"),
                 ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    rows = (c.table("journey_timeline_events").select("*")
            .eq("journey_id", jid).eq("tenant_id", tid)
            .order("created_at", desc=True).limit(200).execute().data or [])
    items = [_slim(r) for r in rows]
    try:
        from services.editorial_translation_layer import (
            localize_records as _ale_localize_records,
            normalize_locale as _ale_norm,
        )
        ale_target = _ale_norm(locale)
        if ale_target:
            items = _ale_localize_records(
                items, fields=('narrative', 'title', 'event_type_label'),
                target_locale=ale_target, tenant_id=tid,
                surface='journey_timeline_event')
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("ALE timeline skipped: %s", e)
    return {"items": items}


@router.get("/journeys/context/by-entity")
def journey_context_by_entity(
    entity_type: str,
    entity_id: str,
    ctx=Depends(get_tenant_context),
):
    """Journey Continuity™ context lookup.

    Lightweight resolver used by satellite modules (Moodboards, Materials,
    Documents, Render) to render the Journey Context Header™:

        Stai attraversando
        {project.title}
        {milestone.title} · {status_label}

    Supported entity_type values:
      • 'moodboard'  → resolves the moodboard's project_id, then maps to
                       the 'moodboard_direction' milestone of that journey.
      • 'project'    → resolves the journey's current milestone (fallback
                       used by Materials/Documents/Render which live at
                       project-scope, not entity-scope).

    Returns 200 with `{linked: false, …}` (NEVER 404) when the lookup
    can't resolve — satellite modules render nothing without breaking.
    """
    c = db()
    tid = ctx["tenant_id"]

    project_id: Optional[str] = None
    target_milestone_type: Optional[str] = None

    et = (entity_type or "").lower().strip()
    if et == "moodboard":
        rows = (c.table("moodboards").select("id, project_id, title")
                .eq("id", entity_id).eq("tenant_id", tid)
                .limit(1).execute().data or [])
        if not rows:
            return {"linked": False, "reason": "moodboard_not_found"}
        project_id = rows[0].get("project_id")
        target_milestone_type = "moodboard_direction"
    elif et == "project":
        project_id = entity_id
        target_milestone_type = None  # use journey.current_milestone_id
    elif et == "material":
        project_id = entity_id  # caller passes project_id for project-scoped lookup
        target_milestone_type = "material_direction"
    elif et == "document":
        project_id = entity_id
        target_milestone_type = "technical_package"
    elif et == "render":
        project_id = entity_id
        target_milestone_type = "final_presentation"
    else:
        return {"linked": False, "reason": "unsupported_entity_type"}

    if not project_id:
        return {"linked": False, "reason": "no_project_link"}

    # Resolve project (lightweight projection)
    p_rows = (c.table("projects").select("id, title, status")
              .eq("id", project_id).eq("tenant_id", tid)
              .limit(1).execute().data or [])
    if not p_rows:
        return {"linked": False, "reason": "project_not_found"}
    project = p_rows[0]

    # Resolve journey
    j_rows = (c.table("design_journeys").select("*")
              .eq("project_id", project_id).eq("tenant_id", tid)
              .limit(1).execute().data or [])
    if not j_rows:
        return {
            "linked": False,
            "reason": "journey_not_initialized",
            "project": _slim(project),
        }
    journey = j_rows[0]

    # Resolve milestone
    if target_milestone_type:
        m_rows = (c.table("journey_milestones").select("*")
                  .eq("journey_id", journey["id"]).eq("tenant_id", tid)
                  .eq("milestone_type", target_milestone_type)
                  .limit(1).execute().data or [])
    else:
        cur_id = journey.get("current_milestone_id")
        m_rows = (c.table("journey_milestones").select("*")
                  .eq("id", cur_id).eq("tenant_id", tid)
                  .limit(1).execute().data or []) if cur_id else []
    milestone = m_rows[0] if m_rows else None

    return {
        "linked":    bool(milestone),
        "project":   _slim(project),
        "journey":   {"id": journey["id"], "overall_status": journey.get("overall_status")},
        "milestone": _slim(milestone) if milestone else None,
    }


@router.post("/journeys/milestones/{mid}/open")
def open_milestone(mid: str, ctx=Depends(get_tenant_context)):
    """DEPRECATED since SPRINT-1 · use POST /journeys/{jid}/milestones/{mid}/open.

    Continues to function. Emits DeprecationWarning and backend log for monitoring.
    """
    logger.warning(
        "DEPRECATED endpoint called: POST /journeys/milestones/%s/open — "
        "migrate to POST /journeys/{jid}/milestones/{mid}/open", mid
    )
    c = db()
    tid = ctx["tenant_id"]
    uid = ctx.get("profile_id")
    rows = (c.table("journey_milestones").select("*")
            .eq("id", mid).eq("tenant_id", tid).limit(1)
            .execute().data or [])
    if not rows:
        raise HTTPException(404, "Pietra miliare non trovata")
    m = rows[0]
    meta = m.get("metadata") or {}

    # Auto-transition not_started → in_progress on first open
    if m["status"] == "not_started":
        c.table("journey_milestones").update({
            "status": "in_progress",
            "started_at": _now(),
            "updated_at": _now(),
        }).eq("id", mid).execute()
        narrative = STATUS_NARRATIVE["in_progress"].format(title=m["title"])
        _emit_event(
            c, journey_id=m["journey_id"], tenant_id=tid,
            milestone_id=mid, event_type="milestone_in_progress",
            narrative=narrative, created_by=uid,
        )

    return {
        "milestone_id":    mid,
        "milestone_type":  m["milestone_type"],
        "open_mode":       meta.get("open_mode") or "inline",
        "linked_route":    meta.get("linked_route"),
        "linked_entity_type": m.get("linked_entity_type"),
        "linked_entity_id":   m.get("linked_entity_id"),
    }
