"""Client Portal API — surface dedicated to role=`client` users.

Phase R.1 + R.2: ownership-scoped read endpoints. Every query is
double-scoped:
    1. tenant_id == current_tenant
    2. ownership == current client (projects.client_user_id, or
       derived from project ownership for moodboards/proposals/etc.)

NEVER returns "first project of tenant", "demo preload", or any
shared/global data. If the client has no data → returns empty arrays
and a `zero_data: true` flag so the UI can show the cinematic
welcome experience.
"""
from datetime import datetime, timezone
from typing import Optional, List
import logging
import uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from core.tenant_context import get_tenant_context
from database import db

log = logging.getLogger(__name__)

router = APIRouter()


def _require_client(ctx: dict) -> str:
    """Only role=client (and tenant_admin/super_admin for QA) can call.
    Returns the profile_id that owns the client view."""
    role = (ctx.get("role") or "").lower()
    if role not in {"client", "tenant_admin", "super_admin"}:
        # Designers / editors / pms should NOT call the client portal —
        # they have the Blueprint OS workspace instead.
        raise HTTPException(403, "Client portal is for client users.")
    pid = ctx.get("profile_id")
    if not pid:
        raise HTTPException(401, "Missing profile context.")
    return pid


# Pipeline stages — mirrored on the frontend ProjectProgressTracker.
# Order matters; the project.status string is mapped to one of these.
PIPELINE_STAGES = [
    {"key": "brief",        "label_it": "Brief iniziale",  "label_en": "Initial brief"},
    {"key": "moodboard",    "label_it": "Moodboard",       "label_en": "Moodboard"},
    {"key": "materials",    "label_it": "Materiali",       "label_en": "Materials"},
    {"key": "design",       "label_it": "Progettazione",   "label_en": "Design"},
    {"key": "review",       "label_it": "Revisione finale","label_en": "Final review"},
    {"key": "delivery",     "label_it": "Consegna",        "label_en": "Delivery"},
]

# Tolerant mapping from existing project.status strings to a pipeline stage.
# Unknown statuses default to "brief" so the welcome experience is never
# blocked by data we don't recognise.
_STATUS_TO_STAGE = {
    "new": "brief", "draft": "brief", "lead": "brief", "brief": "brief",
    "discovery": "brief", "intake": "brief", "scoping": "brief",
    "moodboard": "moodboard", "concept": "moodboard", "concepting": "moodboard",
    "materials": "materials", "selection": "materials", "specifying": "materials",
    "design": "design", "in_progress": "design", "active": "design",
    "designing": "design", "drafting": "design",
    "review": "review", "approval": "review", "client_review": "review",
    "delivered": "delivery", "completed": "delivery", "done": "delivery",
    "handed_over": "delivery", "closed": "delivery",
}


def _stage_index_for(status: Optional[str]) -> int:
    """Return the 0-based index of the current pipeline stage."""
    if not status:
        return 0
    s = str(status).strip().lower()
    stage_key = _STATUS_TO_STAGE.get(s, "brief")
    for i, st in enumerate(PIPELINE_STAGES):
        if st["key"] == stage_key:
            return i
    return 0


def _build_pipeline(current_index: int) -> List[dict]:
    """Decorate stages with status (done/current/upcoming)."""
    out = []
    for i, st in enumerate(PIPELINE_STAGES):
        status = "done" if i < current_index else ("current" if i == current_index else "upcoming")
        out.append({**st, "status": status, "index": i})
    return out


@router.get("/welcome-summary")
def client_welcome_summary(ctx: dict = Depends(get_tenant_context)):
    """ITER161 · P0.2 · Welcome card per il Client Profile.

    Restituisce: nome cliente, nome studio, referente principale,
    summary delle prime indicazioni (initial brief), prossimo capitolo.

    Lessico: spazio progettuale · referente · percorso (NON dashboard).
    """
    profile_id = _require_client(ctx)
    tenant_id = ctx["tenant_id"]
    c = db()

    # Profile cliente
    prof = (c.table("users_profile").select("id,first_name,last_name,email")
            .eq("id", profile_id).limit(1).execute().data or [])
    client_first_name = (prof[0].get("first_name") if prof else None) or "amico"

    # Studio
    t = (c.table("tenants").select("name,slug").eq("id", tenant_id)
         .limit(1).execute().data or [])
    studio_name = t[0]["name"] if t else "Lo Studio"

    # Referente principale (assignment + assignee profile)
    from core.human_assignment import (
        get_active_assignment, hydrate_assignee, ensure_assignment_for_client,
    )
    existing = get_active_assignment(tenant_id, "client", profile_id)
    if not existing:
        existing = ensure_assignment_for_client(tenant_id, profile_id)
    hydrated = hydrate_assignee(existing) if existing else None
    assignee = (hydrated or {}).get("assignee")

    # Journey più recente del cliente (via account.email == profile.email)
    summary = None
    atmosphere = {}
    lifestyle = {}
    journey_id = None
    next_step = None
    try:
        if prof and prof[0].get("email"):
            acc = (c.table("accounts").select("id")
                   .eq("tenant_id", tenant_id).ilike("email", prof[0]["email"])
                   .order("created_at", desc=True).limit(1).execute().data or [])
            if acc:
                aid = acc[0]["id"]
                jr = (c.table("design_journeys")
                      .select("id,project_id,current_milestone_id")
                      .eq("tenant_id", tenant_id).eq("account_id", aid)
                      .order("created_at", desc=True).limit(1).execute().data or [])
                if jr:
                    journey_id = jr[0]["id"]
                    # Atmosphere + lifestyle dal project metadata
                    if jr[0].get("project_id"):
                        pjr = (c.table("projects")
                               .select("metadata_json")
                               .eq("id", jr[0]["project_id"]).limit(1)
                               .execute().data or [])
                        if pjr:
                            meta = pjr[0].get("metadata_json") or {}
                            atmosphere = meta.get("atmosphere") or {}
                            lifestyle  = meta.get("lifestyle")  or {}
                    # Summary = primo capitolo Brief
                    brief = (c.table("journey_milestones").select("id,title")
                             .eq("journey_id", journey_id)
                             .eq("milestone_type", "brief")
                             .limit(1).execute().data or [])
                    if brief:
                        ver = (c.table("milestone_versions")
                               .select("title,rationale")
                               .eq("milestone_id", brief[0]["id"])
                               .order("created_at", desc=False).limit(1)
                               .execute().data or [])
                        if ver:
                            summary = ver[0].get("rationale")
                    # Prossimo capitolo: il milestone più piccolo non-completato
                    if jr[0].get("current_milestone_id"):
                        nxt = (c.table("journey_milestones")
                               .select("title,milestone_type")
                               .eq("id", jr[0]["current_milestone_id"]).limit(1)
                               .execute().data or [])
                        if nxt:
                            next_step = {
                                "title": nxt[0].get("title"),
                                "type":  nxt[0].get("milestone_type"),
                            }
    except Exception:
        import logging
        logging.getLogger(__name__).exception("welcome-summary journey lookup failed")

    return {
        "client": {
            "first_name": client_first_name,
            "email":      prof[0].get("email") if prof else None,
        },
        "studio_name": studio_name,
        "referente":   assignee,  # null OK: "Lo studio ti accompagnerà"
        "summary":     summary,
        "atmosphere":  atmosphere,
        "lifestyle":   lifestyle,
        "journey_id":  journey_id,
        "next_step":   next_step,
    }


@router.get("/overview")
def client_overview(ctx: dict = Depends(get_tenant_context)):
    """Returns the client's primary project + light counts. Strictly
    ownership-scoped. If no project exists → `zero_data: true`."""
    profile_id = _require_client(ctx)
    tenant_id = ctx["tenant_id"]
    c = db()

    # Primary project = most recently updated project owned by this client.
    # No tenant-wide fallback — if the client owns nothing they see the
    # welcome experience.
    pr = (
        c.table("projects")
        .select("id,title,description,project_type,status,priority,timeline,budget_range,language,metadata_json,created_at,updated_at,assigned_to")
        .eq("tenant_id", tenant_id)
        .eq("client_user_id", profile_id)
        .order("updated_at", desc=True)
        .limit(1)
        .execute()
    )
    project = pr.data[0] if pr.data else None

    if not project:
        return {
            "zero_data": True,
            "project": None,
            "pipeline": _build_pipeline(0),
            "counts": {"moodboards": 0, "approvals_pending": 0, "files": 0, "messages_unread": 0},
            "next_appointment": None,
        }

    proj_id = project["id"]

    # Moodboards belonging to the project — restricted via project ownership.
    mb = (
        c.table("moodboards")
        .select("id,title,status,cover_metadata,updated_at")
        .eq("tenant_id", tenant_id)
        .eq("project_id", proj_id)
        .is_("deleted_at", "null")
        .order("updated_at", desc=True)
        .limit(8)
        .execute()
    )
    moodboards = mb.data or []

    # Pending proposals (status != approved/rejected) awaiting client decision.
    pp = (
        c.table("proposals")
        .select("id,title,status,version,total_value,currency,updated_at")
        .eq("tenant_id", tenant_id)
        .eq("project_id", proj_id)
        .in_("status", ["draft", "sent", "in_review", "revision_requested"])
        .order("updated_at", desc=True)
        .limit(5)
        .execute()
    )
    approvals = pp.data or []

    current_index = _stage_index_for(project.get("status"))

    return {
        "zero_data": False,
        "project": {
            **{k: project.get(k) for k in ["id","title","description","project_type","status","timeline","budget_range","language","updated_at","created_at"]},
            "location": (project.get("metadata_json") or {}).get("location"),
            "cover_url": (project.get("metadata_json") or {}).get("cover_url"),
        },
        "pipeline": _build_pipeline(current_index),
        "moodboards": [
            {
                "id": m["id"],
                "title": m.get("title") or "Moodboard",
                "status": m.get("status"),
                "cover_url": (m.get("cover_metadata") or {}).get("signed_url")
                            or (m.get("cover_metadata") or {}).get("url"),
                "updated_at": m.get("updated_at"),
            }
            for m in moodboards
        ],
        "approvals_pending": approvals,
        "counts": {
            "moodboards": len(moodboards),
            "approvals_pending": len(approvals),
            "files": 0,            # Stub — wired in R.3 with project_files table
            "messages_unread": 0,  # Stub — wired in R.3 with messages table
        },
        "next_appointment": None,  # Stub — wired in R.3 with appointments table
    }


@router.get("/projects")
def client_projects(ctx: dict = Depends(get_tenant_context)):
    """All projects owned by this client (typically 1, but supports more)."""
    profile_id = _require_client(ctx)
    tenant_id = ctx["tenant_id"]
    c = db()
    pr = (
        c.table("projects")
        .select("id,title,description,status,project_type,timeline,updated_at,metadata_json")
        .eq("tenant_id", tenant_id)
        .eq("client_user_id", profile_id)
        .order("updated_at", desc=True)
        .execute()
    )
    return {
        "projects": [
            {
                **{k: p.get(k) for k in ["id","title","description","status","project_type","timeline","updated_at"]},
                "stage_index": _stage_index_for(p.get("status")),
                "stage_label_it": PIPELINE_STAGES[_stage_index_for(p.get("status"))]["label_it"],
                "location": (p.get("metadata_json") or {}).get("location"),
                "cover_url": (p.get("metadata_json") or {}).get("cover_url"),
            }
            for p in (pr.data or [])
        ]
    }


@router.get("/moodboards")
def client_moodboards(ctx: dict = Depends(get_tenant_context)):
    """Moodboards across all projects owned by this client."""
    profile_id = _require_client(ctx)
    tenant_id = ctx["tenant_id"]
    c = db()
    # Step 1: project ids owned by client
    pr = (
        c.table("projects").select("id,title")
        .eq("tenant_id", tenant_id).eq("client_user_id", profile_id)
        .execute()
    )
    proj_map = {p["id"]: p.get("title") for p in (pr.data or [])}
    if not proj_map:
        return {"moodboards": []}
    mb = (
        c.table("moodboards")
        .select("id,title,status,cover_metadata,updated_at,project_id")
        .eq("tenant_id", tenant_id)
        .in_("project_id", list(proj_map.keys()))
        .is_("deleted_at", "null")
        .order("updated_at", desc=True)
        .execute()
    )
    return {
        "moodboards": [
            {
                "id": m["id"],
                "title": m.get("title") or "Moodboard",
                "status": m.get("status"),
                "project_id": m.get("project_id"),
                "project_title": proj_map.get(m.get("project_id")),
                "cover_url": (m.get("cover_metadata") or {}).get("signed_url")
                            or (m.get("cover_metadata") or {}).get("url"),
                "updated_at": m.get("updated_at"),
            }
            for m in (mb.data or [])
        ]
    }


@router.get("/approvals")
def client_approvals(ctx: dict = Depends(get_tenant_context)):
    """Pending approvals across all projects owned by this client."""
    profile_id = _require_client(ctx)
    tenant_id = ctx["tenant_id"]
    c = db()
    pr = (
        c.table("projects").select("id,title")
        .eq("tenant_id", tenant_id).eq("client_user_id", profile_id)
        .execute()
    )
    proj_map = {p["id"]: p.get("title") for p in (pr.data or [])}
    if not proj_map:
        return {"approvals": []}
    pp = (
        c.table("proposals")
        .select("id,title,status,version,total_value,currency,updated_at,project_id")
        .eq("tenant_id", tenant_id)
        .in_("project_id", list(proj_map.keys()))
        .in_("status", ["draft", "sent", "in_review", "revision_requested"])
        .order("updated_at", desc=True)
        .execute()
    )
    return {
        "approvals": [
            {**p, "project_title": proj_map.get(p.get("project_id"))}
            for p in (pp.data or [])
        ]
    }



# ════════════════════════════════════════════════════════════════════
# SPRINT G.7 · Client Portal Journey-First Experience™
#
# Il cliente non gestisce task. Vive il proprio percorso progettuale.
# Endpoint che restituiscono *Journey* (NON projects) e tutto in
# vocabolario editoriale italiano.
# ════════════════════════════════════════════════════════════════════

# Italian editorial lifecycle labels for the client surface — slightly
# softer than the studio side (which uses "Conversazione aperta",
# "Viaggio in corso", etc.). Here we want the client to read it as
# narration of THEIR journey.
CLIENT_LIFECYCLE_LABEL = {
    "conversation_open": "La conversazione è iniziata",
    "in_progress":       "Il viaggio è in corso",
    "presenting":        "Nuove direzioni condivise",
    "drifting":          "In ascolto del tuo riscontro",
    "on_pause":          "In pausa",
    "approved":          "Direzione approvata",
    "closed":            "Memoria della casa",
    "archived":          "Memoria della casa",
    "editioned":         "Edizione culturale",
    "abandoned":         "Viaggio sospeso",
}

CLIENT_STEP_STATUS_LABEL = {
    "not_started":        "Capitolo in attesa",
    "in_progress":        "Capitolo in lavorazione",
    "presented":          "Capitolo condiviso con te",
    "revision_requested": "In ascolto del tuo riscontro",
    "partially_approved": "Approvato in parte",
    "approved":           "Capitolo approvato",
    "closed":             "Capitolo chiuso",
}


def _client_project_ids(c, tenant_id: str, profile_id: str) -> List[str]:
    pr = (c.table("projects").select("id")
          .eq("tenant_id", tenant_id)
          .eq("client_user_id", profile_id).execute())
    return [p["id"] for p in (pr.data or [])]


def _journeys_for_projects(c, tenant_id: str, project_ids: List[str]) -> List[dict]:
    if not project_ids:
        return []
    rows = (c.table("design_journeys").select("*")
            .eq("tenant_id", tenant_id)
            .in_("project_id", project_ids)
            .order("updated_at", desc=True).execute().data or [])
    return rows


@router.get("/journeys")
def client_journeys(ctx: dict = Depends(get_tenant_context)):
    """My Design Journeys™ — list of journeys owned by this client.

    Each journey carries: project title/cover, current chapter,
    lifecycle label (italian editorial), latest evolution narrative,
    studio/showroom name (tenant), and progress.
    """
    profile_id = _require_client(ctx)
    tenant_id = ctx["tenant_id"]
    c = db()

    project_ids = _client_project_ids(c, tenant_id, profile_id)
    journeys = _journeys_for_projects(c, tenant_id, project_ids)

    if not journeys:
        return {"zero_data": True, "journeys": []}

    # Bulk-fetch projects, milestones (current), and latest timeline events
    pr_rows = (c.table("projects").select("id,title,project_type,metadata_json,status")
               .eq("tenant_id", tenant_id)
               .in_("id", project_ids).execute().data or [])
    pr_map = {p["id"]: p for p in pr_rows}

    tenant_row = (c.table("tenants").select("id,name,slug")
                  .eq("id", tenant_id).limit(1).execute().data or [])
    studio_name = tenant_row[0].get("name") if tenant_row else "Lo studio"

    out = []
    for j in journeys:
        proj = pr_map.get(j["project_id"]) or {}
        meta = proj.get("metadata_json") or {}

        # Current milestone
        cur_id = j.get("current_milestone_id")
        cur = None
        if cur_id:
            cm = (c.table("journey_milestones").select("*")
                  .eq("id", cur_id).limit(1).execute().data or [])
            cur = cm[0] if cm else None

        # Total chapters + approved chapters
        ms = (c.table("journey_milestones")
              .select("id,status,order_index")
              .eq("journey_id", j["id"]).execute().data or [])
        total = len(ms)
        approved = sum(1 for m in ms if m.get("status") in ("approved", "closed"))

        # Latest evolution narrative
        ev = (c.table("journey_timeline_events").select("narrative_text,created_at")
              .eq("journey_id", j["id"])
              .order("created_at", desc=True).limit(1).execute().data or [])
        latest_evolution = ev[0] if ev else None

        lifecycle = j.get("overall_status") or "in_progress"
        is_archived = (lifecycle == "archived"
                       or j.get("lifecycle_state") in ("closed", "certified_closure"))
        if is_archived:
            lifecycle = "archived"
        out.append({
            "journey_id":   j["id"],
            "project_id":   j["project_id"],
            "project_title": proj.get("title") or "Il tuo Journey",
            "project_type":  proj.get("project_type"),
            "location":      meta.get("location"),
            "cover_url":     meta.get("cover_url"),
            "studio_name":   studio_name,
            "is_archived":   is_archived,
            "closed_at":     j.get("closed_at"),
            "lifecycle_state": lifecycle,
            "lifecycle_label": CLIENT_LIFECYCLE_LABEL.get(lifecycle, "Il viaggio è in corso"),
            "current_chapter": {
                "id":             cur.get("id") if cur else None,
                "milestone_type": cur.get("milestone_type") if cur else None,
                "title":          cur.get("title") if cur else None,
                "status_label":   CLIENT_STEP_STATUS_LABEL.get(
                                    cur.get("status") if cur else None, "—"),
            } if cur else None,
            "progress": {
                "total_chapters":    total,
                "approved_chapters": approved,
            },
            "latest_evolution": ({
                "narrative":  latest_evolution["narrative_text"],
                "created_at": latest_evolution["created_at"],
            } if latest_evolution else None),
            "updated_at": j.get("updated_at"),
        })

    return {"zero_data": False, "journeys": out}


@router.get("/journeys/{journey_id}/companion")
def client_journey_companion(journey_id: str, ctx: dict = Depends(get_tenant_context)):
    """Design Journey Companion Experience™ — il payload completo per
    accompagnare il cliente lungo il proprio Journey.

    Restituisce 7 sezioni narrative:
      · header           — hero + lifecycle + studio
      · active_chapter   — il capitolo in corso, con artifacts e voci
      · shared_directions — direzioni condivise di recente (cross-step)
      · evolution_timeline — narrazione storica del Journey
      · materials_atmospheres — palette tattile dell'intero Journey
      · memory_archive   — capitoli passati & versioni approvate
      · conversations    — voci curatoriali aggregate
    """
    profile_id = _require_client(ctx)
    tenant_id = ctx["tenant_id"]
    c = db()

    # Verify journey ownership (must belong to a project owned by this client)
    j_rows = (c.table("design_journeys").select("*")
              .eq("id", journey_id).eq("tenant_id", tenant_id)
              .limit(1).execute().data or [])
    if not j_rows:
        raise HTTPException(404, "Journey non trovato")
    journey = j_rows[0]

    # Ownership check
    pr = (c.table("projects").select("id,title,project_type,metadata_json,client_user_id,status")
          .eq("id", journey["project_id"]).eq("tenant_id", tenant_id)
          .limit(1).execute().data or [])
    if not pr or pr[0].get("client_user_id") != profile_id:
        # tenant_admin / super_admin bypass (for QA)
        role = (ctx.get("role") or "").lower()
        if role not in {"tenant_admin", "super_admin"}:
            raise HTTPException(403, "Journey non accessibile")
    project = pr[0] if pr else {}
    meta = project.get("metadata_json") or {}

    # Tenant (studio) name
    tenant_row = (c.table("tenants").select("name,slug")
                  .eq("id", tenant_id).limit(1).execute().data or [])
    studio_name = tenant_row[0].get("name") if tenant_row else "Lo studio"

    # Milestones (full list)
    milestones = (c.table("journey_milestones").select("*")
                  .eq("journey_id", journey_id).eq("tenant_id", tenant_id)
                  .order("order_index", desc=False).execute().data or [])

    # Active chapter
    active = None
    cur_id = journey.get("current_milestone_id")
    if cur_id:
        active = next((m for m in milestones if m["id"] == cur_id), None)
    if not active:
        # Fallback: first in_progress, else first not_started
        active = next((m for m in milestones if m.get("status") == "in_progress"), None) \
            or next((m for m in milestones if m.get("status") == "not_started"), None) \
            or (milestones[0] if milestones else None)

    # Shared directions — only moodboards that have been explicitly published
    # (status != 'draft' = not yet ready for client review)
    moodboards = (c.table("moodboards")
                  .select("id,title,status,cover_metadata,updated_at,project_id,journey_id,ai_metadata")
                  .eq("tenant_id", tenant_id)
                  .eq("project_id", journey["project_id"])
                  .not_.eq("status", "draft")
                  .is_("deleted_at", "null")
                  .order("updated_at", desc=True).limit(8)
                  .execute().data or [])

    # Also include concept-direction moodboards linked by journey_id
    # (these use ai_metadata.concept_seed.shared_at as the publish signal)
    concept_mbs: list[dict] = []
    try:
        cr = (c.table("moodboards")
              .select("id,title,status,cover_metadata,updated_at,project_id,journey_id,ai_metadata")
              .eq("tenant_id", tenant_id)
              .eq("journey_id", journey_id)
              .is_("deleted_at", "null")
              .execute().data or [])
        for r in cr:
            seed = ((r.get("ai_metadata") or {}).get("concept_seed") or {})
            if seed.get("shared_at"):
                concept_mbs.append(r)
    except Exception:
        pass

    # Merge without duplicates — concept_mbs take precedence
    seen_ids = {r["id"] for r in concept_mbs}
    all_mbs = concept_mbs + [r for r in moodboards if r["id"] not in seen_ids]

    shared_directions = [{
        "kind":       "moodboard",
        "id":         m["id"],
        "title":      m.get("title") or "Direzione",
        "state":      m.get("status"),
        "state_label": {
            "draft": "Bozza interna",
            "sent": "Condivisa con te",
            "viewed": "Sei in lettura",
            "approved": "Approvata",
            "revision_requested": "In ascolto del tuo riscontro",
            "rejected": "Da ripensare",
        }.get(m.get("status"), m.get("status") or "—"),
        "cover_url":  (m.get("cover_metadata") or {}).get("signed_url")
                      or (m.get("cover_metadata") or {}).get("url"),
        "updated_at": m.get("updated_at"),
        "is_concept_direction": bool((m.get("ai_metadata") or {}).get("concept_seed")),
    } for m in all_mbs]

    # Evolution timeline (narrative)
    ev_rows = (c.table("journey_timeline_events")
               .select("id,narrative_text,milestone_id,event_type,created_at")
               .eq("journey_id", journey_id).eq("tenant_id", tenant_id)
               .order("created_at", desc=True).limit(40)
               .execute().data or [])
    evolution_timeline = [{
        "id":         e["id"],
        "narrative":  e["narrative_text"],
        "kind":       e.get("event_type"),
        "created_at": e.get("created_at"),
    } for e in ev_rows]

    # Materials & atmospheres — best-effort (table may not exist on tenant)
    materials = []
    try:
        mr = (c.table("project_materials").select("*")
              .eq("tenant_id", tenant_id)
              .eq("project_id", journey["project_id"])
              .limit(20).execute().data or [])
        materials = [{
            "id":       m.get("id") or m.get("material_id"),
            "title":    m.get("title") or m.get("name") or "Materia",
            "image_url": m.get("image_url") or m.get("thumb_url"),
            "category": m.get("category"),
            "selection": (m.get("decision") or m.get("status") or "selected"),
        } for m in mr]
    except Exception:
        materials = []

    # Memory archive — approved/closed milestones
    archive = [{
        "id":             m["id"],
        "milestone_type": m["milestone_type"],
        "title":          m["title"],
        "approved_at":    m.get("approved_at"),
        "closed_at":      m.get("closed_at"),
    } for m in milestones if m.get("status") in ("approved", "closed")]

    # Conversations — recent curatorial voices across all milestones (from
    # the canonical `milestone_feedback` table written by Milestone Dialogue™).
    conversations = []
    if milestones:
        mids = [m["id"] for m in milestones]
        try:
            vrows = (c.table("milestone_feedback")
                     .select("id,milestone_id,quote,kind,author_role,created_at")
                     .eq("tenant_id", tenant_id)
                     .in_("milestone_id", mids)
                     .order("created_at", desc=True).limit(30)
                     .execute().data or [])
            ms_label = {m["id"]: m["title"] for m in milestones}
            REORIENT = {"wants_lighter", "wants_more_material"}
            EMBRACE  = {"embraces", "palette_works", "material_loved",
                        "storytelling_strong"}
            conversations = [{
                "id":           v["id"],
                "chapter":      ms_label.get(v.get("milestone_id"), "—"),
                "message":      v.get("quote"),
                "tone":         "reorient" if (v.get("kind") or "") in REORIENT
                                else "embrace" if (v.get("kind") or "") in EMBRACE
                                else "voice",
                "author_name":  "Tu" if (v.get("author_role") or "").lower() == "client"
                                else (studio_name or "Il tuo studio"),
                "created_at":   v.get("created_at"),
            } for v in vrows]
        except Exception:
            conversations = []

    lifecycle = journey.get("overall_status") or "in_progress"
    is_archived = (lifecycle == "archived"
                   or journey.get("lifecycle_state") in ("closed", "certified_closure"))
    if is_archived:
        lifecycle = "archived"
    total = len(milestones)
    approved = sum(1 for m in milestones if m.get("status") in ("approved", "closed"))

    return {
        "header": {
            "journey_id":      journey_id,
            "project_id":      journey["project_id"],
            "project_title":   project.get("title") or "Il tuo Journey",
            "project_type":    project.get("project_type"),
            "location":        meta.get("location"),
            "cover_url":       meta.get("cover_url"),
            "studio_name":     studio_name,
            "is_archived":     is_archived,
            "closed_at":       journey.get("closed_at"),
            "lifecycle_state": lifecycle,
            "lifecycle_label": CLIENT_LIFECYCLE_LABEL.get(lifecycle, "Il viaggio è in corso"),
            "progress": {"total_chapters": total, "approved_chapters": approved},
        },
        "active_chapter": ({
            "id":             active["id"],
            "milestone_type": active["milestone_type"],
            "title":          active["title"],
            "description":    active.get("description"),
            "status":         active.get("status"),
            "status_label":   CLIENT_STEP_STATUS_LABEL.get(active.get("status"), "—"),
            "narrative_intro": (active.get("description")
                                 or "Il tuo studio sta dando forma a questo capitolo del Journey."),
        } if active else None),
        "shared_directions":    shared_directions,
        "evolution_timeline":   evolution_timeline,
        "materials_atmospheres": materials,
        "memory_archive":       archive,
        "conversations":        conversations,
    }


# ════════════════════════════════════════════════════════════════════
# SPRINT G.7-ter · Shared Voice™
#
# Il cliente lascia una VOCE editoriale sul Journey attivo. NON è un
# commento, non è una chat, non è un thread. È un gesto relazionale
# contestuale al capitolo.
#
# La voce vive in milestone_feedback (kind='free_voice') ed entra
# nella Journey Memory via journey_timeline_events (event_type='voice_received').
# ════════════════════════════════════════════════════════════════════

class SharedVoiceIn(BaseModel):
    milestone_id: str = Field(..., description="UUID del capitolo a cui legare la voce.")
    text: str         = Field(..., min_length=2, max_length=600,
                              description="Testo della voce (sobrio, breve).")
    reference_url: Optional[str] = Field(None, max_length=600,
                              description="Pinterest / Instagram / link a un riferimento.")
    image_url: Optional[str]     = Field(None, max_length=600,
                              description="Immagine allegata.")
    note: Optional[str]          = Field(None, max_length=400,
                              description="Nota aggiuntiva opzionale.")


def _verify_journey_ownership(c, tenant_id: str, journey_id: str, profile_id: str,
                              role: str) -> dict:
    """Returns the journey if the caller owns the underlying project.
    super_admin / tenant_admin bypass for QA."""
    rows = (c.table("design_journeys").select("*")
            .eq("id", journey_id).eq("tenant_id", tenant_id)
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Journey non trovato")
    j = rows[0]
    role_l = (role or "").lower()
    if role_l in {"tenant_admin", "super_admin"}:
        return j
    pr = (c.table("projects").select("client_user_id")
          .eq("id", j["project_id"]).eq("tenant_id", tenant_id)
          .limit(1).execute().data or [])
    if not pr or pr[0].get("client_user_id") != profile_id:
        raise HTTPException(403, "Journey non accessibile")
    return j


@router.post("/journeys/{journey_id}/voice", status_code=201)
def leave_shared_voice(journey_id: str, body: SharedVoiceIn,
                       ctx: dict = Depends(get_tenant_context)):
    """Lascia una voce editoriale sul capitolo del Journey.

    Persistenza:
      · milestone_feedback (kind='free_voice', author_role='client')
      · journey_timeline_events (event_type='voice_received')
    """
    profile_id = _require_client(ctx)
    tenant_id  = ctx["tenant_id"]
    c = db()

    _ = _verify_journey_ownership(c, tenant_id, journey_id, profile_id,
                                  ctx.get("role"))

    ms = (c.table("journey_milestones").select("id,title,milestone_type")
          .eq("id", body.milestone_id).eq("journey_id", journey_id)
          .eq("tenant_id", tenant_id).limit(1).execute().data or [])
    if not ms:
        raise HTTPException(404, "Capitolo non disponibile per questo Journey")
    chapter = ms[0]

    # Build the quote — base text plus optional reference/image/note lines.
    parts = [body.text.strip()]
    if body.reference_url:
        parts.append(f"\n— riferimento: {body.reference_url.strip()}")
    if body.image_url:
        parts.append(f"\n— immagine: {body.image_url.strip()}")
    if body.note:
        parts.append(f"\n— nota: {body.note.strip()}")
    quote = "".join(parts)

    import uuid
    now_iso = datetime.now(timezone.utc).isoformat()

    voice_row = {
        "id":             str(uuid.uuid4()),
        "tenant_id":      tenant_id,
        "milestone_id":   body.milestone_id,
        "version_id":     None,
        "kind":           "free_voice",
        "quote":          quote,
        "author_role":    "client",
        "author_user_id": profile_id,
        "created_at":     now_iso,
    }
    c.table("milestone_feedback").insert(voice_row).execute()

    short = body.text.strip().replace("\n", " ")
    if len(short) > 140:
        short = short[:137] + "…"
    narrative = f'Hai lasciato una voce su "{chapter["title"]}": "{short}"'
    timeline_row = {
        "id":             str(uuid.uuid4()),
        "journey_id":     journey_id,
        "tenant_id":      tenant_id,
        "milestone_id":   body.milestone_id,
        "event_type":     "voice_received",
        "narrative_text": narrative,
        "created_by":     profile_id,
        "metadata":       {"voice_id": voice_row["id"],
                           "kind":     "shared_voice"},
        "created_at":     now_iso,
    }
    c.table("journey_timeline_events").insert(timeline_row).execute()

    c.table("design_journeys").update({"updated_at": now_iso}) \
                              .eq("id", journey_id).execute()

    return {
        "voice": {
            "id":            voice_row["id"],
            "milestone_id":  body.milestone_id,
            "text":          body.text,
            "reference_url": body.reference_url,
            "image_url":     body.image_url,
            "note":          body.note,
            "author_role":   "client",
            "created_at":    now_iso,
        },
        "timeline_event": {
            "id":         timeline_row["id"],
            "narrative":  narrative,
            "created_at": now_iso,
        },
        "chapter": {"id": chapter["id"], "title": chapter["title"]},
    }


# ════════════════════════════════════════════════════════════════════
#  STORE-012C · CLIENT PORTAL CONCEPT REVIEW™
#
#  GET  /api/client/journeys/{jid}/concept-directions
#  POST /api/client/concept-directions/{moodboard_id}/feedback
#
#  Rules:
#  · Preferred ≠ Approved. We never change moodboard.status from the
#    client side. Status remains in the studio's hands.
#  · One "preferred" direction per Direction Set: switching emits a
#    "changed preferred direction" timeline event.
#  · Reactions vocabulary: interested · explore_further · preferred · comment.
#  · Every reaction is persisted in milestone_feedback + journey_timeline_events
#    + appended into moodboards.ai_metadata.concept_seed.client_reactions.
#  · Client Alignment Score™ is updated INTERNALLY (never exposed to
#    client). It is stored on each moodboard's concept_seed.
# ════════════════════════════════════════════════════════════════════

VALID_REACTIONS = {"interested", "explore_further", "preferred", "comment"}
SCORE_WEIGHT = {"interested": 3, "explore_further": 2, "preferred": 10, "comment": 5}

# Narrative templates per locale.
FB_NARRATIVES = {
    "it-IT": {
        "interested":      'Il cliente ha segnato "{name}" come interessante.',
        "explore_further": 'Il cliente vuole esplorare ulteriormente "{name}".',
        "preferred":       'Il cliente ha indicato "{name}" come direzione preferita.',
        "preferred_changed":'Il cliente ha cambiato direzione preferita: da "{prev}" a "{name}".',
        "comment":         'Il cliente ha lasciato un commento su "{name}": "{quote}"',
    },
    "en-US": {
        "interested":      'The client marked "{name}" as interesting.',
        "explore_further": 'The client wants to explore "{name}" further.',
        "preferred":       'The client marked "{name}" as preferred direction.',
        "preferred_changed":'The client changed preferred direction from "{prev}" to "{name}".',
        "comment":         'The client left a comment on "{name}": "{quote}"',
    },
}


def _narratives(locale: str) -> dict:
    return FB_NARRATIVES.get(locale) or FB_NARRATIVES["it-IT"]


class ConceptFeedbackIn(BaseModel):
    reaction: str
    comment: Optional[str] = None


@router.get("/journeys/{journey_id}/concept-directions")
def client_list_concept_directions(journey_id: str, ctx: dict = Depends(get_tenant_context)):
    """Return Direction Sets that have been SHARED with the client.

    Boards whose concept_seed lacks `shared_at` are excluded entirely. The
    Client Alignment Score™ is NEVER included in the response."""
    profile_id = _require_client(ctx)
    tenant_id  = ctx["tenant_id"]
    c = db()
    _verify_journey_ownership(c, tenant_id, journey_id, profile_id, ctx.get("role"))

    rows = (c.table("moodboards")
             .select("id,title,ai_metadata,status,updated_at,cover_metadata")
             .eq("tenant_id", tenant_id).eq("journey_id", journey_id)
             .is_("deleted_at", "null")
             .execute().data or [])

    sets: dict = {}
    for r in rows:
        seed = ((r.get("ai_metadata") or {}).get("concept_seed") or {})
        if not seed.get("shared_at"):
            continue
        sid = seed.get("set_id")
        if not sid:
            continue
        if sid not in sets:
            sets[sid] = {
                "set_id":         sid,
                "set_index":      seed.get("set_index"),
                "set_label":      seed.get("set_label") or f"Direction Set {(seed.get('set_index') or 0):02d}",
                "set_shared_at":  seed.get("shared_at"),
                "directions":     [],
            }
        reactions = seed.get("client_reactions") or []
        cover = (r.get("cover_metadata") or {}).get("signed_url") or (r.get("cover_metadata") or {}).get("url")
        sets[sid]["directions"].append({
            "moodboard_id":     r["id"],
            "direction_letter": seed.get("direction_letter"),
            "direction_name":   seed.get("direction_name"),
            "color_palette":    seed.get("color_palette") or [],
            "style_dna_snapshot": seed.get("style_dna_snapshot") or [],
            "material_entity_ids": seed.get("material_entity_ids") or [],
            "media_ids":        seed.get("media_ids") or [],
            "cover_url":        cover,
            "designer_notes":   seed.get("designer_notes") or "",
            "is_preferred":     bool(seed.get("is_preferred")),
            "my_reactions":     [{"reaction": x.get("reaction"),
                                  "created_at": x.get("created_at"),
                                  "comment": x.get("comment")}
                                  for x in reactions
                                  if x.get("by") == profile_id],
        })

    sets_list = sorted(sets.values(), key=lambda s: s.get("set_index") or 0)
    return {"sets": sets_list, "total_sets": len(sets_list)}


@router.post("/concept-directions/{moodboard_id}/feedback", status_code=201)
def client_concept_feedback(moodboard_id: str, body: ConceptFeedbackIn,
                            ctx: dict = Depends(get_tenant_context)):
    """Persist a client reaction. NEVER changes moodboard.status."""
    profile_id = _require_client(ctx)
    tenant_id  = ctx["tenant_id"]

    if body.reaction not in VALID_REACTIONS:
        raise HTTPException(422, f"Invalid reaction. Allowed: {sorted(VALID_REACTIONS)}")
    if body.reaction == "comment" and not (body.comment and body.comment.strip()):
        raise HTTPException(422, "Comment text is required for reaction=comment")

    c = db()
    # Load the target moodboard
    mb_rows = (c.table("moodboards").select("id,journey_id,ai_metadata,title")
                .eq("id", moodboard_id).eq("tenant_id", tenant_id)
                .limit(1).execute().data or [])
    if not mb_rows:
        raise HTTPException(404, "Concept Board non trovato")
    mb = mb_rows[0]
    jid = mb.get("journey_id")
    if not jid:
        raise HTTPException(400, "Concept Board non collegato ad alcun Journey")

    # Ownership via journey
    _verify_journey_ownership(c, tenant_id, jid, profile_id, ctx.get("role"))

    am = mb.get("ai_metadata") or {}
    seed = dict(am.get("concept_seed") or {})
    if not seed.get("shared_at"):
        raise HTTPException(403, "Questa direzione non è ancora stata condivisa con te")

    set_id = seed.get("set_id")
    direction_name = seed.get("direction_name") or mb.get("title") or "Concept"
    locale = "it-IT"
    try:
        # Reuse the resolver from concept_directions for consistency.
        from routers.concept_directions import _resolve_client_locale
        locale = _resolve_client_locale(c, tenant_id, profile_id)
    except Exception:
        pass
    narratives = _narratives(locale)

    now_iso = datetime.now(timezone.utc).isoformat()
    reaction_record = {
        "id":         str(uuid.uuid4()),
        "reaction":   body.reaction,
        "by":         profile_id,
        "created_at": now_iso,
        "comment":    (body.comment or "").strip() or None,
    }

    # Update concept_seed.client_reactions[]
    reactions = list(seed.get("client_reactions") or [])
    reactions.append(reaction_record)
    seed["client_reactions"] = reactions

    # ── Update Client Alignment Score™ (internal)
    cur_score = int(seed.get("client_alignment_score") or 0)
    seed["client_alignment_score"] = cur_score + SCORE_WEIGHT.get(body.reaction, 0)

    # ── Handle "preferred": single per set semantics
    set_preferred_switch = None  # (prev_name, prev_mb_id) if switch happens
    if body.reaction == "preferred":
        seed["is_preferred"] = True
        # Find the previously preferred board in this set (if any other) and unset it.
        if set_id:
            other = (c.table("moodboards").select("id,ai_metadata,title")
                      .eq("tenant_id", tenant_id).eq("journey_id", jid)
                      .is_("deleted_at", "null").execute().data or [])
            for o in other:
                if o["id"] == moodboard_id:
                    continue
                o_am = o.get("ai_metadata") or {}
                o_seed = dict(o_am.get("concept_seed") or {})
                if o_seed.get("set_id") == set_id and o_seed.get("is_preferred"):
                    set_preferred_switch = (o_seed.get("direction_name") or o.get("title") or "Concept", o["id"])
                    o_seed["is_preferred"] = False
                    # decrement aggregate score on the old preferred? — leave history intact.
                    o_am["concept_seed"] = o_seed
                    c.table("moodboards").update({
                        "ai_metadata": o_am,
                        "updated_at":  now_iso,
                    }).eq("id", o["id"]).execute()

    # Persist updated concept_seed back to moodboard
    am["concept_seed"] = seed
    c.table("moodboards").update({
        "ai_metadata": am,
        "updated_at":  now_iso,
    }).eq("id", moodboard_id).execute()

    # ── milestone_feedback row (mirrors voice persistence pattern)
    fb_row = {
        "id":             str(uuid.uuid4()),
        "tenant_id":      tenant_id,
        "milestone_id":   None,
        "version_id":     None,
        "kind":           f"concept_reaction_{body.reaction}",
        "quote":          (body.comment or direction_name).strip()[:1000],
        "author_role":    "client",
        "author_user_id": profile_id,
        "created_at":     now_iso,
    }
    try:
        c.table("milestone_feedback").insert(fb_row).execute()
    except Exception:
        log.exception("milestone_feedback insert failed (non-blocking)")

    # ── Timeline event(s)
    quote_snippet = ((body.comment or "").strip().replace("\n", " "))[:140]
    if body.reaction == "preferred" and set_preferred_switch:
        narrative = narratives["preferred_changed"].format(
            prev=set_preferred_switch[0], name=direction_name)
    else:
        key = body.reaction
        narrative = narratives[key].format(name=direction_name, quote=quote_snippet)

    tl_row = {
        "id":            str(uuid.uuid4()),
        "tenant_id":     tenant_id,
        "journey_id":    jid,
        "milestone_id":  None,
        "event_type":    "client_concept_feedback",
        "narrative_text": narrative,
        "metadata":      {
            "moodboard_id":    moodboard_id,
            "direction_name":  direction_name,
            "set_id":          set_id,
            "reaction":        body.reaction,
            "comment":         (body.comment or "").strip() or None,
            "feedback_id":     fb_row["id"],
            "switched_from_moodboard_id": set_preferred_switch[1] if set_preferred_switch else None,
        },
        "created_by":    profile_id,
        "created_at":    now_iso,
    }
    try:
        c.table("journey_timeline_events").insert(tl_row).execute()
    except Exception:
        log.exception("timeline event insert failed (non-blocking)")

    # ── Notify designer: client left feedback on a concept direction
    try:
        from services import notification_publisher
        jr_rows = (c.table("design_journeys")
                    .select("created_by, id")
                    .eq("id", jid).eq("tenant_id", tenant_id)
                    .limit(1).execute().data or [])
        if jr_rows:
            designer_id = jr_rows[0].get("created_by")
            if designer_id:
                reaction_labels = {
                    "approved": "ha approvato",
                    "preferred": "ha scelto come preferita",
                    "revision_requested": "ha richiesto una revisione",
                    "comment": "ha lasciato un commento su",
                    "rejected": "ha rifiutato",
                }
                label = reaction_labels.get(body.reaction, "ha reagito a")
                notification_publisher.publish(
                    tenant_id=tenant_id,
                    recipient_user_id=designer_id,
                    category_key="message_received",
                    narrative=f"Il cliente {label}: «{direction_name}»",
                    sender_user_id=profile_id,
                    sender_type="client",
                    recipient_type="designer",
                    payload={
                        "journey_id": jid,
                        "moodboard_id": moodboard_id,
                        "reaction": body.reaction,
                    },
                    deep_link_url=f"/studio/journey/{jid}",
                )
        # Increment unread counter on the conversation thread for this journey
        thread_rows = (c.table("conversation_threads")
                        .select("id, unread_for_designer")
                        .eq("tenant_id", tenant_id)
                        .eq("journey_id", jid)
                        .limit(1).execute().data or [])
        if thread_rows:
            cur_unread = int(thread_rows[0].get("unread_for_designer") or 0)
            c.table("conversation_threads").update({
                "unread_for_designer": cur_unread + 1,
            }).eq("id", thread_rows[0]["id"]).execute()
    except Exception:
        log.exception("concept feedback notification failed (non-blocking)")

    return {
        "feedback":        reaction_record,
        "direction_name":  direction_name,
        "set_id":          set_id,
        "moodboard_id":    moodboard_id,
        "narrative":       narrative,
        "is_preferred":    bool(seed.get("is_preferred")),
    }

