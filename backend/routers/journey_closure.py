"""Journey Closure™ router — Sprint G.9.

Un Design Journey NON viene "chiuso". Diventa **memoria editoriale firmata**.
Questo router orchestra la cerimonia di Certified Closure™.

Lifecycle state: 'certified_closure'.

Endpoints (montati sotto /api):
  · POST   /journeys/{journey_id}/certify-closure   — studio cerimonia
  · GET    /journeys/{journey_id}/dossier           — dossier editoriale
  · POST   /journeys/{journey_id}/reopen            — riapre un Journey
  · GET    /journeys/archive                        — studio archive index
  · GET    /client/journeys/archive                 — client archive index

Il "dossier" è il dossier editoriale del Journey archiviato:
header + statement + capitoli chiave + materiali iconici + key visuals +
before/after + durata. Tono AD magazine, NON luxury marketing.

Persistenza: zero schema migration.
  · `design_journeys.lifecycle_state = 'certified_closure'`
  · `design_journeys.overall_status  = 'archived'`
  · `design_journeys.closed_at`  (UTC)
  · Un `journey_timeline_events` di tipo `dossier_metadata` salva:
      { final_title, statement, cover_url, certified_at }
"""
from __future__ import annotations

import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.tenant_context import get_tenant_context
from database import db

logger = logging.getLogger(__name__)
router = APIRouter()


STUDIO_ROLES   = {"super_admin", "tenant_admin", "designer", "pm", "editor"}
ARCHIVE_ROLES  = STUDIO_ROLES | {"advisor"}


# ── Pydantic ─────────────────────────────────────────────────────
class CertifyClosureIn(BaseModel):
    final_title: str = Field(..., min_length=2, max_length=180,
                              description="Titolo definitivo del Journey archiviato.")
    statement:   str = Field(..., min_length=10, max_length=800,
                              description="Closure Statement™ editoriale dello studio.")
    cover_url:   Optional[str] = Field(None, max_length=800,
                              description="Immagine rappresentativa del Journey.")


class ReopenIn(BaseModel):
    reason: Optional[str] = Field(None, max_length=400,
                                   description="Motivo della riapertura — sobrio, editoriale.")


# ── Helpers ──────────────────────────────────────────────────────
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _journey(c, tenant_id: str, journey_id: str) -> Dict[str, Any]:
    rows = (c.table("design_journeys").select("*")
            .eq("id", journey_id).eq("tenant_id", tenant_id)
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Journey non trovato")
    return rows[0]


def _project(c, tenant_id: str, project_id: str) -> Dict[str, Any]:
    rows = (c.table("projects").select("*")
            .eq("id", project_id).eq("tenant_id", tenant_id)
            .limit(1).execute().data or [])
    return rows[0] if rows else {}


def _dossier_metadata(c, tenant_id: str, journey_id: str) -> Optional[Dict[str, Any]]:
    rows = (c.table("journey_timeline_events").select("*")
            .eq("journey_id", journey_id).eq("tenant_id", tenant_id)
            .eq("event_type", "dossier_metadata")
            .order("created_at", desc=True).limit(1)
            .execute().data or [])
    if not rows:
        return None
    return (rows[0].get("metadata") or {})


def _client_owns(c, tenant_id: str, project_id: str, profile_id: str,
                role: str) -> bool:
    if (role or "").lower() in {"tenant_admin", "super_admin"}:
        return True
    pr = (c.table("projects").select("client_user_id")
          .eq("id", project_id).eq("tenant_id", tenant_id)
          .limit(1).execute().data or [])
    return bool(pr and pr[0].get("client_user_id") == profile_id)


# ── Certify Closure (studio ceremony) ────────────────────────────
@router.post("/journeys/{journey_id}/certify-closure", status_code=201)
def certify_closure(journey_id: str, body: CertifyClosureIn,
                    ctx: dict = Depends(get_tenant_context)):
    """Cerimonia di Certified Closure™. Sobria. Editoriale.

    Lo studio deposita:
      · titolo definitivo
      · closure statement
      · cover visiva (opzionale)
    Il Journey passa a `lifecycle_state='certified_closure'`,
    `overall_status='archived'`, `closed_at` viene cristallizzato.
    """
    role = (ctx.get("role") or "").lower()
    if role not in STUDIO_ROLES:
        raise HTTPException(403, "Solo lo studio può cristallizzare un Journey.")
    c = db()
    tenant_id = ctx["tenant_id"]
    j = _journey(c, tenant_id, journey_id)

    now = _now_iso()
    # Save dossier metadata as a dedicated timeline event
    dossier_row = {
        "id":             str(uuid.uuid4()),
        "tenant_id":      tenant_id,
        "journey_id":     journey_id,
        "milestone_id":   None,
        "event_type":     "dossier_metadata",
        "narrative_text": body.final_title.strip(),
        "created_by":     ctx.get("profile_id"),
        "metadata": {
            "final_title":  body.final_title.strip(),
            "statement":    body.statement.strip(),
            "cover_url":    body.cover_url,
            "certified_at": now,
            "certified_by_role": role,
        },
        "created_at":     now,
    }
    c.table("journey_timeline_events").insert(dossier_row).execute()

    # Closure timeline marker (editorial italian)
    marker_row = {
        "id":             str(uuid.uuid4()),
        "tenant_id":      tenant_id,
        "journey_id":     journey_id,
        "milestone_id":   None,
        "event_type":     "journey_certified_closure",
        "narrative_text": f'Il Journey è entrato nel suo archivio firmato come "{body.final_title.strip()}".',
        "created_by":     ctx.get("profile_id"),
        "metadata":       {"kind": "ceremony"},
        "created_at":     now,
    }
    c.table("journey_timeline_events").insert(marker_row).execute()

    # Update the journey itself
    # Note: the DB enum doesn't yet include 'certified_closure'; we use 'closed'
    # as the canonical archived lifecycle state. The dossier metadata + the
    # 'journey_certified_closure' marker preserve the editorial ceremony.
    c.table("design_journeys").update({
        "lifecycle_state": "closed",
        "overall_status":  "archived",
        "closed_at":       now,
        "updated_at":      now,
    }).eq("id", journey_id).execute()

    return {
        "journey_id":    journey_id,
        "final_title":   body.final_title.strip(),
        "statement":     body.statement.strip(),
        "cover_url":     body.cover_url,
        "certified_at":  now,
        "lifecycle_state": "closed",
    }


# ── Reopen — il Journey NON è morto ──────────────────────────────
@router.post("/journeys/{journey_id}/reopen", status_code=200)
def reopen_journey(journey_id: str, body: ReopenIn,
                   ctx: dict = Depends(get_tenant_context)):
    role = (ctx.get("role") or "").lower()
    if role not in STUDIO_ROLES:
        raise HTTPException(403, "Solo lo studio può riaprire un Journey.")
    c = db()
    tenant_id = ctx["tenant_id"]
    j = _journey(c, tenant_id, journey_id)
    if j.get("lifecycle_state") != "closed" or j.get("overall_status") != "archived":
        raise HTTPException(409, "Questo Journey non è archiviato.")

    now = _now_iso()
    c.table("design_journeys").update({
        "lifecycle_state": "in_progress",
        "overall_status":  "in_progress",
        "closed_at":       None,
        "updated_at":      now,
    }).eq("id", journey_id).execute()

    # Editorial timeline event
    narr = "Il Journey è stato riaperto per un nuovo capitolo."
    if body.reason:
        narr += f" {body.reason.strip()}"
    c.table("journey_timeline_events").insert({
        "id":             str(uuid.uuid4()),
        "tenant_id":      tenant_id,
        "journey_id":     journey_id,
        "milestone_id":   None,
        "event_type":     "journey_reopened",
        "narrative_text": narr,
        "created_by":     ctx.get("profile_id"),
        "metadata":       {"reason": body.reason},
        "created_at":     now,
    }).execute()

    return {"journey_id": journey_id, "lifecycle_state": "in_progress",
            "reopened_at": now}


# ── Dossier (client + studio) ────────────────────────────────────
def _build_dossier(c, tenant_id: str, journey_id: str,
                  for_client: bool = False) -> Dict[str, Any]:
    j = _journey(c, tenant_id, journey_id)

    project = _project(c, tenant_id, j["project_id"])
    meta_p  = project.get("metadata_json") or {}

    tenant_row = (c.table("tenants").select("name,slug")
                  .eq("id", tenant_id).limit(1).execute().data or [])
    studio_name = tenant_row[0].get("name") if tenant_row else "Lo studio"

    dossier = _dossier_metadata(c, tenant_id, journey_id) or {}

    # Milestones — for key chapters narrative
    milestones = (c.table("journey_milestones").select("*")
                  .eq("journey_id", journey_id).eq("tenant_id", tenant_id)
                  .order("order_index", desc=False).execute().data or [])
    total    = len(milestones)
    approved = sum(1 for m in milestones if m.get("status") in ("approved", "closed"))
    key_chapters = [{
        "id":             m["id"],
        "milestone_type": m["milestone_type"],
        "title":          m["title"],
        "status":         m.get("status"),
        "approved_at":    m.get("approved_at"),
    } for m in milestones if m.get("status") in ("approved", "closed",
                                                  "in_progress", "presented")]

    # Moodboards — iconic visuals
    mb_rows = (c.table("moodboards")
               .select("id,title,cover_metadata,status,updated_at")
               .eq("tenant_id", tenant_id).eq("project_id", project.get("id"))
               .is_("deleted_at", "null")
               .order("updated_at", desc=True).limit(6)
               .execute().data or [])
    key_visuals = [{
        "id":         m["id"],
        "title":      m.get("title"),
        "cover_url":  (m.get("cover_metadata") or {}).get("signed_url")
                       or (m.get("cover_metadata") or {}).get("url"),
        "status":     m.get("status"),
    } for m in mb_rows if (m.get("cover_metadata") or {}).get("signed_url")
                       or (m.get("cover_metadata") or {}).get("url")]

    # Site Evolution — iconic before/after pairs
    se_rows = (c.table("journey_timeline_events").select("*")
               .eq("journey_id", journey_id).eq("tenant_id", tenant_id)
               .eq("event_type", "site_evolution")
               .order("created_at", desc=True).execute().data or [])
    before_after_pairs = []
    site_moments = []
    for r in se_rows:
        m = r.get("metadata") or {}
        if m.get("before_url") and m.get("after_url"):
            before_after_pairs.append({
                "id":     r["id"],
                "title":  m.get("title") or r.get("narrative_text"),
                "before_url": m["before_url"],
                "after_url":  m["after_url"],
                "space_key":  m.get("space_key"),
            })
        if len(site_moments) < 4 and (m.get("photos") or []):
            site_moments.append({
                "id":     r["id"],
                "title":  m.get("title") or r.get("narrative_text"),
                "photo_url": (m.get("photos") or [{}])[0].get("url"),
                "space_key": m.get("space_key"),
            })

    # Materials — best effort iconic palette
    iconic_materials: List[Dict[str, Any]] = []
    try:
        mat_rows = (c.table("project_materials").select("*")
                    .eq("tenant_id", tenant_id).eq("project_id", project.get("id"))
                    .limit(8).execute().data or [])
        iconic_materials = [{
            "id":       m.get("id") or m.get("material_id"),
            "title":    m.get("title") or m.get("name") or "Materia",
            "category": m.get("category"),
            "image_url": m.get("image_url") or m.get("thumb_url"),
        } for m in mat_rows]
    except Exception:
        iconic_materials = []

    # Duration narration
    started = j.get("started_at") or j.get("created_at")
    closed  = j.get("closed_at")  or j.get("updated_at")
    months  = None
    try:
        if started and closed:
            sd = datetime.fromisoformat(started.replace("Z", "+00:00"))
            ed = datetime.fromisoformat(closed.replace("Z", "+00:00"))
            months = max(1, round((ed - sd).days / 30))
    except Exception:
        months = None

    return {
        "available":    True,
        "header": {
            "journey_id":      journey_id,
            "project_id":      project.get("id"),
            "final_title":     dossier.get("final_title") or project.get("title") or "Journey archiviato",
            "studio_name":     studio_name,
            "location":        meta_p.get("location"),
            "project_type":    project.get("project_type"),
            "cover_url":       dossier.get("cover_url") or meta_p.get("cover_url"),
            "started_at":      started,
            "closed_at":       closed,
            "duration_months": months,
            "lifecycle_state": j.get("lifecycle_state"),
        },
        "statement":         dossier.get("statement"),
        "certified_at":      dossier.get("certified_at"),
        "key_chapters":      key_chapters,
        "key_visuals":       key_visuals,
        "before_after_pairs": before_after_pairs,
        "site_moments":      site_moments,
        "iconic_materials":  iconic_materials,
        "progress": {"total_chapters": total, "approved_chapters": approved},
    }


@router.get("/journeys/{journey_id}/dossier")
def journey_dossier(journey_id: str, ctx: dict = Depends(get_tenant_context)):
    """Dossier editoriale (studio view)."""
    role = (ctx.get("role") or "").lower()
    if role not in ARCHIVE_ROLES:
        raise HTTPException(403, "Vista riservata allo studio.")
    return _build_dossier(db(), ctx["tenant_id"], journey_id)


@router.get("/client/journeys/{journey_id}/dossier")
def client_journey_dossier(journey_id: str, ctx: dict = Depends(get_tenant_context)):
    """Dossier editoriale (client view)."""
    role = (ctx.get("role") or "").lower()
    if role not in {"client", "tenant_admin", "super_admin"}:
        raise HTTPException(403, "Vista riservata al cliente.")
    c = db()
    tenant_id = ctx["tenant_id"]
    j = _journey(c, tenant_id, journey_id)
    profile_id = ctx.get("profile_id")
    if not _client_owns(c, tenant_id, j["project_id"], profile_id, role):
        raise HTTPException(403, "Journey non accessibile")
    return _build_dossier(c, tenant_id, journey_id, for_client=True)


# ── Archive index ────────────────────────────────────────────────
def _archive_card(c, tenant_id: str, j: Dict[str, Any], studio_name: str) -> Dict[str, Any]:
    project = _project(c, tenant_id, j["project_id"])
    meta_p  = project.get("metadata_json") or {}
    dossier = _dossier_metadata(c, tenant_id, j["id"]) or {}
    return {
        "journey_id":   j["id"],
        "project_id":   j["project_id"],
        "final_title":  dossier.get("final_title") or project.get("title")
                         or "Journey archiviato",
        "studio_name":  studio_name,
        "location":     meta_p.get("location"),
        "cover_url":    dossier.get("cover_url") or meta_p.get("cover_url"),
        "project_type": project.get("project_type"),
        "closed_at":    j.get("closed_at") or j.get("updated_at"),
        "started_at":   j.get("started_at") or j.get("created_at"),
        "statement_preview": (dossier.get("statement") or "")[:180],
    }


@router.get("/journeys/archive")
def studio_archive(ctx: dict = Depends(get_tenant_context)):
    """Studio Archive — Journey patrimonio."""
    role = (ctx.get("role") or "").lower()
    if role not in ARCHIVE_ROLES:
        raise HTTPException(403, "Vista riservata allo studio.")
    c = db()
    tenant_id = ctx["tenant_id"]
    rows = (c.table("design_journeys").select("*")
            .eq("tenant_id", tenant_id)
            .eq("overall_status", "archived")
            .order("closed_at", desc=True).execute().data or [])
    tenant_row = (c.table("tenants").select("name").eq("id", tenant_id)
                  .limit(1).execute().data or [])
    studio_name = tenant_row[0].get("name") if tenant_row else "Lo studio"
    cards = [_archive_card(c, tenant_id, j, studio_name) for j in rows]
    return {"available": len(cards) > 0, "journeys": cards}


@router.get("/client/journeys/archive")
def client_archive(ctx: dict = Depends(get_tenant_context)):
    """Client Archive — Journey della casa, parte della memoria."""
    role = (ctx.get("role") or "").lower()
    if role not in {"client", "tenant_admin", "super_admin"}:
        raise HTTPException(403, "Vista riservata al cliente.")
    profile_id = ctx.get("profile_id")
    if not profile_id:
        raise HTTPException(401)
    c = db()
    tenant_id = ctx["tenant_id"]
    # Find projects owned by client, then their archived journeys
    pr = (c.table("projects").select("id")
          .eq("tenant_id", tenant_id).eq("client_user_id", profile_id)
          .execute().data or [])
    pids = [p["id"] for p in pr]
    if not pids and role == "client":
        return {"available": False, "journeys": []}
    q = c.table("design_journeys").select("*").eq("tenant_id", tenant_id) \
                                  .eq("overall_status", "archived")
    if pids:
        q = q.in_("project_id", pids)
    rows = q.order("closed_at", desc=True).execute().data or []
    tenant_row = (c.table("tenants").select("name").eq("id", tenant_id)
                  .limit(1).execute().data or [])
    studio_name = tenant_row[0].get("name") if tenant_row else "Lo studio"
    cards = [_archive_card(c, tenant_id, j, studio_name) for j in rows]
    return {"available": len(cards) > 0, "journeys": cards}
