"""Journeys™ router — ITER168 Phase 1 · Design Journey™ Operational Refactor.

Journey-keyed API (NOT project-keyed). Il Design Journey™ è la root entity
del prodotto: ogni lookup avviene per `journey_id`, mai per `project_id`.

Endpoints
---------
GET   /api/journeys/{jid}/overview
      Snapshot completo: account + lifecycle + brief + milestones (raggruppati
      per parallel_track) + artifact counts + recent timeline + open health
      signals. Single source of truth per Workspace™ e Client Profile™.

GET   /api/journeys/{jid}/artifacts
      Lista degli artifact (moodboards/proposals/curated_collections)
      raggruppati per scope/room/chapter. Già journey-bound via FK.

GET   /api/journeys/{jid}/brief
      Brief materializzato (journey_briefs 1:1). Auto-derive da leads se
      non ancora materializzato.

PATCH /api/journeys/{jid}/lifecycle
      Cambia journey.lifecycle_state (LAYER 1 · relazione).
      NON tocca milestone.

PATCH /api/journeys/{jid}/milestones/{mid}/status
      Cambia milestone.status (LAYER 2 · operativo).
      NON tocca journey.lifecycle_state.

POST  /api/journeys/{jid}/milestones/{mid}/skip
      Marca skipped (elastic milestone).
POST  /api/journeys/{jid}/milestones/{mid}/reopen
      Marca reopened (elastic milestone).
POST  /api/journeys/{jid}/milestones/parallel
      Crea istanza parallela di una milestone su un parallel_track diverso.

GET   /api/moodboard-catalog/rooms
GET   /api/moodboard-catalog/chapters
      Catalog DB-driven (lettura pubblica con locale fallback).
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core.tenant_context import get_tenant_context
from database import db

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Constants ─────────────────────────────────────────────────────────
VALID_LIFECYCLE_STATES = {
    'conversation_open', 'in_progress', 'presenting', 'drifting',
    'on_pause', 'approved', 'closed', 'editioned', 'abandoned',
}
VALID_MILESTONE_STATUSES = {
    'not_started', 'in_progress', 'presented', 'revision_requested',
    'partially_approved', 'approved', 'closed',
    'skipped', 'not_applicable', 'reopened', 'parallel_active',
}

LIFECYCLE_NARRATIVE = {
    'conversation_open': "Conversazione aperta. Il viaggio inizia.",
    'in_progress':       "Il Design Journey™ avanza.",
    'presenting':        "Una direzione è stata presentata al cliente.",
    'drifting':          "Silenzio prolungato. Servirà un richiamo.",
    'on_pause':          "Journey in pausa volontaria.",
    'approved':          "Direzione condivisa raggiunta.",
    'closed':            "Design Journey™ chiuso.",
    'editioned':         "Cultural Edition generata. La memoria si fa portfolio.",
    'abandoned':         "Journey interrotto senza chiusura certificata.",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slim(row: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not row:
        return {}
    return {k: v for k, v in row.items() if k != "_id"}


def _slim_many(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [_slim(r) for r in (rows or [])]


def _resolve_journey(c, tenant_id: str, jid: str) -> Dict[str, Any]:
    rows = (c.table("design_journeys").select("*")
            .eq("id", jid).eq("tenant_id", tenant_id)
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Design Journey™ non trovato")
    return rows[0]


def _emit_event(c, *, journey_id: str, tenant_id: str,
                milestone_id: Optional[str], event_type: str,
                event_canon: Optional[str], narrative: str,
                created_by: Optional[str] = None,
                meta: Optional[Dict[str, Any]] = None) -> None:
    c.table("journey_timeline_events").insert({
        "id":             str(uuid.uuid4()),
        "journey_id":     journey_id,
        "tenant_id":      tenant_id,
        "milestone_id":   milestone_id,
        "event_type":     event_type,
        "event_canon":    event_canon,
        "narrative_text": narrative,
        "created_by":     created_by,
        "metadata":       meta or {},
        "created_at":     _now(),
    }).execute()


# ─── Models ────────────────────────────────────────────────────────────
class LifecyclePatch(BaseModel):
    lifecycle_state: str
    reason: Optional[str] = None


class MilestoneStatusPatch(BaseModel):
    status: str
    note: Optional[str] = None


class MilestoneSkip(BaseModel):
    reason: Optional[str] = None


class ParallelMilestoneCreate(BaseModel):
    milestone_type: str = Field(...,
        description="es. moodboard_direction · deve esistere come "
                    "milestone_type nella main track")
    parallel_track: str = Field(..., max_length=64,
        description="es. kitchen · bathroom_master · lighting")
    title: Optional[str] = None
    description: Optional[str] = None


# ─── GET overview ──────────────────────────────────────────────────────
@router.get("/{jid}/overview")
def get_overview(jid: str, ctx=Depends(get_tenant_context)):
    """Snapshot completo di una journey. Single source of truth."""
    c = db()
    tid = ctx["tenant_id"]
    j = _resolve_journey(c, tid, jid)

    # Account
    account = None
    if j.get("account_id"):
        rows = (c.table("accounts").select("*")
                .eq("id", j["account_id"]).eq("tenant_id", tid)
                .limit(1).execute().data or [])
        if rows:
            account = _slim(rows[0])

    # Brief (1:1)
    brief = None
    rows = (c.table("journey_briefs").select("*")
            .eq("journey_id", jid).eq("tenant_id", tid)
            .limit(1).execute().data or [])
    if rows:
        brief = _slim(rows[0])

    # Milestones (raggruppate per parallel_track)
    ms_rows = (c.table("journey_milestones").select("*")
               .eq("journey_id", jid).eq("tenant_id", tid)
               .order("order_index", desc=False).execute().data or [])
    milestones_by_track: Dict[str, List[Dict[str, Any]]] = {}
    for m in ms_rows:
        track = m.get("parallel_track") or "main"
        milestones_by_track.setdefault(track, []).append(_slim(m))

    # Artifact counts (via VIEW journey_artifacts non disponibile lato Supabase
    # client REST: facciamo 3 count diretti, è low-cost)
    mb_count = (c.table("moodboards").select("id", count="exact")
                .eq("journey_id", jid).eq("tenant_id", tid)
                .execute().count or 0)
    pp_count = (c.table("proposals").select("id", count="exact")
                .eq("journey_id", jid).eq("tenant_id", tid)
                .execute().count or 0)
    try:
        cc_count = (c.table("curated_collections").select("id", count="exact")
                    .eq("journey_id", jid).eq("tenant_id", tid)
                    .execute().count or 0)
    except Exception:
        cc_count = 0

    # Recent timeline (top 30)
    tl = (c.table("journey_timeline_events").select("*")
          .eq("journey_id", jid).eq("tenant_id", tid)
          .order("created_at", desc=True).limit(30)
          .execute().data or [])

    # Open health signals
    try:
        hs = (c.table("journey_health_signals").select("*")
              .eq("journey_id", jid).eq("tenant_id", tid)
              .is_("resolved_at", "null")
              .order("observed_at", desc=True).execute().data or [])
    except Exception:
        hs = []

    return {
        "journey":  _slim(j),
        "account":  account,
        "brief":    brief,
        "milestones_by_track": milestones_by_track,
        "milestones_flat":     _slim_many(ms_rows),
        "artifact_counts": {
            "moodboards":           mb_count,
            "proposals":            pp_count,
            "curated_collections":  cc_count,
        },
        "timeline_recent": _slim_many(tl),
        "open_health_signals": _slim_many(hs),
    }


# ─── GET artifacts ─────────────────────────────────────────────────────
@router.get("/{jid}/artifacts")
def get_artifacts(jid: str,
                  scope: Optional[str] = Query(None),
                  room: Optional[str] = Query(None),
                  ctx=Depends(get_tenant_context)):
    """Artifact (moodboards) della journey, raggruppati per room+chapter.
    Filtri opzionali: scope (es. 'direction', 'materials') · room (es. 'kitchen').
    """
    c = db()
    tid = ctx["tenant_id"]
    _ = _resolve_journey(c, tid, jid)  # verifica esistenza + tenancy

    q = (c.table("moodboards").select("*")
         .eq("journey_id", jid).eq("tenant_id", tid))
    if scope:
        q = q.eq("scope", scope)
    if room:
        q = q.eq("room_key", room)
    mbs = q.order("created_at", desc=False).execute().data or []

    # Group: room_key → chapter_key → [moodboards]
    grouped: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}
    for mb in mbs:
        rk = mb.get("room_key") or "_unscoped"
        ck = mb.get("chapter_key") or "_mixed"
        grouped.setdefault(rk, {}).setdefault(ck, []).append(_slim(mb))

    return {
        "journey_id": jid,
        "filters":   {"scope": scope, "room": room},
        "total":     len(mbs),
        "items":     _slim_many(mbs),
        "grouped_by_room_chapter": grouped,
    }


# ─── GET brief ─────────────────────────────────────────────────────────
@router.get("/{jid}/brief")
def get_brief(jid: str, ctx=Depends(get_tenant_context)):
    """Brief 1:1 con la journey. Auto-materializza da leads se mancante."""
    c = db()
    tid = ctx["tenant_id"]
    j = _resolve_journey(c, tid, jid)

    rows = (c.table("journey_briefs").select("*")
            .eq("journey_id", jid).eq("tenant_id", tid)
            .limit(1).execute().data or [])
    if rows:
        return {"brief": _slim(rows[0]), "materialized": True}

    # Tentativo di auto-derive da leads (cerca per email account / account_id)
    derived = None
    if j.get("account_id"):
        acc_rows = (c.table("accounts").select("email,id")
                    .eq("id", j["account_id"]).eq("tenant_id", tid)
                    .limit(1).execute().data or [])
        if acc_rows and acc_rows[0].get("email"):
            lead_rows = (c.table("leads")
                         .select("id,closed_answers,atmosphere_signals,"
                                 "material_signals,cultural_register,"
                                 "luxury_perception_tier,narrative_seed,"
                                 "intake_version")
                         .eq("tenant_id", tid)
                         .ilike("email", acc_rows[0]["email"])
                         .order("created_at", desc=True).limit(1)
                         .execute().data or [])
            if lead_rows:
                derived = lead_rows[0]

    if not derived:
        return {"brief": None, "materialized": False,
                "reason": "no_intake_data_found"}

    new_brief = {
        "id":                     str(uuid.uuid4()),
        "tenant_id":              tid,
        "journey_id":             jid,
        "closed_answers":         derived.get("closed_answers") or {},
        "atmosphere_signals":     derived.get("atmosphere_signals") or [],
        "material_signals":       derived.get("material_signals") or [],
        "cultural_register":      derived.get("cultural_register"),
        "luxury_perception_tier": derived.get("luxury_perception_tier"),
        "narrative_seed":         derived.get("narrative_seed"),
        "intake_version":         derived.get("intake_version"),
        "source_lead_id":         derived.get("id"),
        "created_at":             _now(),
        "updated_at":             _now(),
    }
    c.table("journey_briefs").insert(new_brief).execute()
    return {"brief": _slim(new_brief), "materialized": True,
            "auto_derived": True}


# ─── PATCH lifecycle (LAYER 1) ─────────────────────────────────────────
@router.patch("/{jid}/lifecycle")
def patch_lifecycle(jid: str, body: LifecyclePatch,
                    ctx=Depends(get_tenant_context)):
    """Cambia journey.lifecycle_state. NON tocca milestone."""
    c = db()
    tid = ctx["tenant_id"]
    uid = ctx.get("profile_id")
    j = _resolve_journey(c, tid, jid)

    new_state = body.lifecycle_state.strip().lower()
    if new_state not in VALID_LIFECYCLE_STATES:
        raise HTTPException(400, f"lifecycle_state non valido: {new_state}")
    if new_state == j.get("lifecycle_state"):
        return {"journey": _slim(j), "changed": False}

    patch = {"lifecycle_state": new_state, "updated_at": _now()}
    if new_state == "closed":
        patch["overall_status"] = "closed"
        patch["closed_at"] = _now()
    elif new_state == "in_progress":
        patch["overall_status"] = "in_progress"

    c.table("design_journeys").update(patch).eq("id", jid).execute()

    narrative = LIFECYCLE_NARRATIVE.get(new_state, "Lifecycle aggiornato.")
    if body.reason:
        narrative = f"{narrative} · {body.reason}"
    _emit_event(c, journey_id=jid, tenant_id=tid, milestone_id=None,
                event_type=f"journey_{new_state}",
                event_canon="journey_completed" if new_state == "closed"
                            else "journey_paused" if new_state == "on_pause"
                            else "journey_abandoned" if new_state == "abandoned"
                            else None,
                narrative=narrative, created_by=uid,
                meta={"reason": body.reason} if body.reason else None)

    updated = _resolve_journey(c, tid, jid)
    return {"journey": _slim(updated), "changed": True}


# ─── PATCH milestone status (LAYER 2) ──────────────────────────────────
@router.patch("/{jid}/milestones/{mid}/status")
def patch_milestone_status(jid: str, mid: str, body: MilestoneStatusPatch,
                           ctx=Depends(get_tenant_context)):
    """Cambia milestone.status. NON tocca journey.lifecycle_state."""
    c = db()
    tid = ctx["tenant_id"]
    uid = ctx.get("profile_id")
    _ = _resolve_journey(c, tid, jid)

    rows = (c.table("journey_milestones").select("*")
            .eq("id", mid).eq("journey_id", jid).eq("tenant_id", tid)
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Pietra miliare non trovata")
    cur = rows[0]

    new_status = body.status.strip().lower()
    if new_status not in VALID_MILESTONE_STATUSES:
        raise HTTPException(400, f"status non valido: {new_status}")
    if new_status == cur.get("status"):
        return {"milestone": _slim(cur), "changed": False}

    patch: Dict[str, Any] = {"status": new_status, "updated_at": _now()}
    if new_status == "in_progress" and not cur.get("started_at"):
        patch["started_at"] = _now()
    if new_status == "presented":
        patch["presented_at"] = _now()
    if new_status == "approved":
        patch["approved_at"] = _now()
    if new_status == "closed":
        patch["closed_at"] = _now()
    if new_status == "reopened":
        patch["reopened_at"] = _now()
    if new_status in ("skipped", "not_applicable"):
        patch["skipped_at"] = _now()
        if new_status == "not_applicable":
            patch["is_applicable"] = False

    c.table("journey_milestones").update(patch).eq("id", mid).execute()

    _emit_event(c, journey_id=jid, tenant_id=tid, milestone_id=mid,
                event_type=f"milestone_{new_status}",
                event_canon=None,
                narrative=f"{cur.get('title')} · {new_status}.",
                created_by=uid,
                meta={"note": body.note} if body.note else None)

    upd = (c.table("journey_milestones").select("*")
           .eq("id", mid).limit(1).execute().data or [])[0]
    return {"milestone": _slim(upd), "changed": True}


# ─── POST skip ─────────────────────────────────────────────────────────
@router.post("/{jid}/milestones/{mid}/skip")
def skip_milestone(jid: str, mid: str, body: MilestoneSkip,
                   ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    uid = ctx.get("profile_id")
    _ = _resolve_journey(c, tid, jid)

    rows = (c.table("journey_milestones").select("*")
            .eq("id", mid).eq("journey_id", jid).eq("tenant_id", tid)
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Pietra miliare non trovata")
    cur = rows[0]

    c.table("journey_milestones").update({
        "status":         "skipped",
        "skipped_at":     _now(),
        "skipped_reason": body.reason,
        "updated_at":     _now(),
    }).eq("id", mid).execute()

    _emit_event(c, journey_id=jid, tenant_id=tid, milestone_id=mid,
                event_type="milestone_skipped", event_canon=None,
                narrative=f"{cur.get('title')} · saltato"
                + (f" ({body.reason})" if body.reason else ""),
                created_by=uid,
                meta={"reason": body.reason} if body.reason else None)
    return {"ok": True, "milestone_id": mid}


# ─── POST reopen ───────────────────────────────────────────────────────
@router.post("/{jid}/milestones/{mid}/reopen")
def reopen_milestone(jid: str, mid: str,
                     ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    uid = ctx.get("profile_id")
    _ = _resolve_journey(c, tid, jid)

    rows = (c.table("journey_milestones").select("*")
            .eq("id", mid).eq("journey_id", jid).eq("tenant_id", tid)
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Pietra miliare non trovata")
    cur = rows[0]

    c.table("journey_milestones").update({
        "status":      "reopened",
        "reopened_at": _now(),
        "updated_at":  _now(),
    }).eq("id", mid).execute()

    _emit_event(c, journey_id=jid, tenant_id=tid, milestone_id=mid,
                event_type="milestone_reopened", event_canon=None,
                narrative=f"{cur.get('title')} · riaperto per nuova revisione",
                created_by=uid)
    return {"ok": True, "milestone_id": mid}


# ─── POST parallel milestone ───────────────────────────────────────────
@router.post("/{jid}/milestones/parallel")
def create_parallel_milestone(jid: str, body: ParallelMilestoneCreate,
                              ctx=Depends(get_tenant_context)):
    """Crea un'istanza parallela di una milestone esistente su un track
    diverso. Esempio: 'moodboard_direction' su track 'kitchen' parallela
    alla main."""
    c = db()
    tid = ctx["tenant_id"]
    uid = ctx.get("profile_id")
    _ = _resolve_journey(c, tid, jid)

    # Verifica esistenza milestone_type nella main track
    main_rows = (c.table("journey_milestones").select("*")
                 .eq("journey_id", jid).eq("tenant_id", tid)
                 .eq("milestone_type", body.milestone_type)
                 .limit(1).execute().data or [])
    if not main_rows:
        raise HTTPException(404,
            f"milestone_type {body.milestone_type} non esistente in journey")
    main = main_rows[0]

    # Non duplicare uno stesso track già esistente
    dup_rows = (c.table("journey_milestones").select("id")
                .eq("journey_id", jid).eq("tenant_id", tid)
                .eq("milestone_type", body.milestone_type)
                .eq("parallel_track", body.parallel_track)
                .limit(1).execute().data or [])
    if dup_rows:
        raise HTTPException(409,
            f"Track {body.parallel_track} già esistente per {body.milestone_type}")

    new_mid = str(uuid.uuid4())
    new_row = {
        "id":             new_mid,
        "journey_id":     jid,
        "tenant_id":      tid,
        "milestone_type": body.milestone_type,
        "title":          body.title or f"{main.get('title')} · {body.parallel_track}",
        "description":    body.description or main.get("description"),
        "order_index":    main.get("order_index"),
        "status":         "parallel_active",
        "parallel_track": body.parallel_track,
        "is_applicable":  True,
        "metadata":       main.get("metadata") or {},
        "created_at":     _now(),
        "updated_at":     _now(),
    }
    c.table("journey_milestones").insert(new_row).execute()

    _emit_event(c, journey_id=jid, tenant_id=tid, milestone_id=new_mid,
                event_type="milestone_parallel_opened", event_canon=None,
                narrative=f"Filone parallelo aperto: "
                          f"{body.milestone_type} · {body.parallel_track}",
                created_by=uid,
                meta={"milestone_type": body.milestone_type,
                      "parallel_track": body.parallel_track})
    return {"milestone": _slim(new_row), "created": True}


# ─── CATALOG endpoints ────────────────────────────────────────────────
@router.get("/catalog/rooms", tags=["moodboard-catalog"])
def list_rooms(locale: str = Query("it"),
               category: Optional[str] = Query(None)):
    """Catalog DB-driven delle stanze. Lettura pubblica per dropdown intake."""
    c = db()
    q = c.table("moodboard_rooms").select("*").eq("is_active", True)
    if category:
        q = q.eq("category", category)
    rows = q.order("display_order", desc=False).execute().data or []

    out = []
    for r in rows:
        labels = r.get("label_i18n") or {}
        out.append({
            "key":              r["key"],
            "category":         r["category"],
            "label":            labels.get(locale) or labels.get("it")
                                or labels.get("en") or r["key"],
            "default_chapters": r.get("default_chapters") or [],
        })
    return {"rooms": out, "total": len(out)}


@router.get("/catalog/chapters", tags=["moodboard-catalog"])
def list_chapters(locale: str = Query("it")):
    """Catalog DB-driven dei capitoli di moodboard."""
    c = db()
    rows = (c.table("moodboard_chapters").select("*")
            .eq("is_active", True)
            .order("display_order", desc=False).execute().data or [])
    out = []
    for r in rows:
        labels = r.get("label_i18n") or {}
        descs = r.get("description_i18n") or {}
        out.append({
            "key":         r["key"],
            "label":       labels.get(locale) or labels.get("it")
                           or labels.get("en") or r["key"],
            "description": descs.get(locale) or descs.get("it")
                           or descs.get("en") or "",
        })
    return {"chapters": out, "total": len(out)}
