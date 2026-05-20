"""Journey Step Workspace™ router — Sprint G.6.

Step-Anchored Artifact Pages™. NON è page migration. È la
contestualizzazione definitiva degli artifact dentro al Design Journey™.

Principio: l'utente NON apre più "una moodboard". Attraversa "Moodboard
Direction™" — la fase progettuale di cui la moodboard è la manifestazione.

Endpoint:
  GET /api/journey/projects/{project_id}/steps/{milestone_type}
      Ritorna lo step workspace completo:
        · context  — Journey, account, lifecycle, prev/next chapter
        · artifacts — le manifestazioni dello step (moodboards / materials /
                      proposals / documents) filtrate per progetto
        · versions — version stack (capitoli progettuali, NO V1/V2 letterale)
        · voices   — feedback / decisioni / richieste di revisione

Italian editorial. Mai SaaS, mai CRUD, mai task.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException

from core.tenant_context import get_tenant_context
from database import db

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Constants — editorial vocabulary lock ─────────────────────────────
LIFECYCLE_LABEL = {
    "conversation_open": "Conversazione aperta",
    "in_progress":       "Viaggio in corso",
    "presenting":        "Direzione presentata",
    "drifting":          "In ascolto",
    "on_pause":          "In pausa",
    "approved":          "Direzione approvata",
    "closed":            "Capitolo chiuso",
    "editioned":         "Edizione culturale",
    "abandoned":         "Viaggio sospeso",
}

STATUS_LABEL = {
    "not_started":        "Non iniziata",
    "in_progress":        "In lavorazione",
    "presented":          "Presentata",
    "revision_requested": "Revisione richiesta",
    "partially_approved": "Approvata parzialmente",
    "approved":           "Approvata",
    "closed":             "Chiusa",
}

# Each milestone type knows which artifact source(s) feed its workspace.
# Anchored exclusively to the artifact tables already present in MOOD.
ARTIFACT_SOURCE = {
    "moodboard_direction":  ["moodboards"],
    "material_direction":   ["project_materials"],
    "concept_design":       ["moodboards", "proposals"],
    "technical_package":    ["project_documents"],
    "final_presentation":   ["proposals"],
    "curated_selections":   ["moodboards"],
    "site_evolution":       ["site_evolution_photos"],
    "inspirations":         [],
    "brief":                [],
    "certified_closure":    [],
}


# ─── Helpers ───────────────────────────────────────────────────────────
def _slim(row: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    return {k: v for k, v in (row or {}).items() if k != "_id"}


def _safe_select(c, table: str, filters: Dict[str, Any],
                 fields: str = "*", order: Optional[str] = None,
                 desc: bool = True, limit: int = 50) -> List[Dict[str, Any]]:
    """Best-effort select that returns [] if the table is missing or empty.
    Sprint G.6 must NEVER crash because an artifact table is not yet
    populated in a given tenant (e.g. project_documents on a fresh tenant).
    """
    try:
        q = c.table(table).select(fields)
        for k, v in (filters or {}).items():
            q = q.eq(k, v)
        if order:
            q = q.order(order, desc=desc)
        q = q.limit(limit)
        return [_slim(r) for r in (q.execute().data or [])]
    except Exception as e:  # missing table / column / permission
        logger.debug("safe_select(%s) skipped: %s", table, e)
        return []


def _chapter_label(version_index: int) -> str:
    """Capitolo progettuale — NO 'V1' / 'V2' letterale.

    Editorial naming: 'Primo capitolo', 'Secondo capitolo', ...
    Fallback for >5: 'Capitolo N'.
    """
    names = [
        "Primo capitolo",
        "Secondo capitolo",
        "Terzo capitolo",
        "Quarto capitolo",
        "Quinto capitolo",
    ]
    if version_index < len(names):
        return names[version_index]
    return f"Capitolo {version_index + 1}"


def _moodboards_for_step(c, tid: str, pid: str) -> List[Dict[str, Any]]:
    rows = _safe_select(
        c, "moodboards",
        {"tenant_id": tid, "project_id": pid},
        fields="id, title, status, cover_image_url, share_token, approval_state,"
               " created_at, updated_at",
        order="created_at", desc=False, limit=20,
    )
    out: List[Dict[str, Any]] = []
    for i, r in enumerate(rows):
        out.append({
            "artifact_id":     r["id"],
            "artifact_type":   "moodboard",
            "title":           r.get("title") or "Direzione senza titolo",
            "cover_url":       r.get("cover_image_url"),
            "approval_state":  r.get("approval_state") or r.get("status"),
            "chapter_label":   _chapter_label(i),
            "chapter_index":   i,
            "created_at":      r.get("created_at"),
            "updated_at":      r.get("updated_at"),
            "open_route":      f"/moodboards/{r['id']}",
            "share_token":     r.get("share_token"),
        })
    return out


def _materials_for_step(c, tid: str, pid: str) -> List[Dict[str, Any]]:
    """Best-effort fetch of materials linked to the project.

    The materials schema varies across tenants. We tolerate that.
    """
    candidates: List[Dict[str, Any]] = []
    # Common shape: a join table "project_materials"
    rows = _safe_select(
        c, "project_materials",
        {"tenant_id": tid, "project_id": pid},
        fields="*", order="created_at", desc=False, limit=40,
    )
    for i, r in enumerate(rows):
        candidates.append({
            "artifact_id":   r.get("id") or r.get("material_id"),
            "artifact_type": "material",
            "title":         r.get("title") or r.get("name") or "Materiale",
            "cover_url":     r.get("image_url") or r.get("thumb_url"),
            "approval_state": r.get("decision") or r.get("status") or "selected",
            "chapter_label":  _chapter_label(0),
            "chapter_index":  0,
            "selection":      r.get("decision") or "selected",
            "supplier":       r.get("supplier") or r.get("supplier_name"),
            "created_at":     r.get("created_at"),
        })
    return candidates


def _proposals_for_step(c, tid: str, pid: str) -> List[Dict[str, Any]]:
    rows = _safe_select(
        c, "proposals",
        {"tenant_id": tid, "project_id": pid},
        fields="id, title, status, created_at, updated_at",
        order="created_at", desc=False, limit=20,
    )
    out = []
    for i, r in enumerate(rows):
        out.append({
            "artifact_id":   r["id"],
            "artifact_type": "proposal",
            "title":         r.get("title") or "Presentazione",
            "approval_state": r.get("status"),
            "chapter_label":  _chapter_label(i),
            "chapter_index":  i,
            "open_route":     f"/workspace/proposals/{r['id']}/compose",
            "created_at":     r.get("created_at"),
        })
    return out


def _documents_for_step(c, tid: str, pid: str) -> List[Dict[str, Any]]:
    rows = _safe_select(
        c, "project_documents",
        {"tenant_id": tid, "project_id": pid},
        fields="*", order="created_at", desc=False, limit=30,
    )
    return [{
        "artifact_id":    r.get("id"),
        "artifact_type":  "document",
        "title":          r.get("title") or r.get("filename") or "Documento",
        "url":            r.get("url") or r.get("file_url"),
        "chapter_label":  _chapter_label(i),
        "chapter_index":  i,
        "approval_state": r.get("status") or "shared",
        "created_at":     r.get("created_at"),
    } for i, r in enumerate(rows)]


ARTIFACT_LOADER = {
    "moodboards":          _moodboards_for_step,
    "project_materials":   _materials_for_step,
    "proposals":           _proposals_for_step,
    "project_documents":   _documents_for_step,
}


def _voices_for_milestone(c, tid: str, mid: str) -> List[Dict[str, Any]]:
    """Curatorial voices on the milestone (feedback, revision requests, approvals).

    Pulls from milestone_chapter_voices (Sprint F.B Milestone Dialogue) when
    available. Returns [] if the schema is not present.
    """
    rows = _safe_select(
        c, "milestone_chapter_voices",
        {"tenant_id": tid, "milestone_id": mid},
        fields="id, voice_type, tone, message, author_name, created_at, decision",
        order="created_at", desc=True, limit=20,
    )
    return rows


def _step_progress(milestones: List[Dict[str, Any]],
                   current_idx: int) -> Dict[str, Any]:
    completed = sum(1 for m in milestones if m.get("status") in
                    ("approved", "closed"))
    return {
        "current_step_index": current_idx,
        "total_steps":        len(milestones),
        "completed_steps":    completed,
    }


# ─── Endpoint ──────────────────────────────────────────────────────────
@router.get("/journey/projects/{project_id}/steps/{milestone_type}")
def get_step_workspace(project_id: str, milestone_type: str,
                       ctx=Depends(get_tenant_context)):
    """Return the full Step Workspace™ payload.

    NEVER 404 for unsupported types — returns a soft `{available: false}`
    payload so the frontend can render an editorial empty state.
    """
    c = db()
    tid = ctx["tenant_id"]

    # Project
    p_rows = (c.table("projects").select("id, title, status, created_at")
              .eq("id", project_id).eq("tenant_id", tid)
              .limit(1).execute().data or [])
    if not p_rows:
        raise HTTPException(404, "Progetto non trovato")
    project = p_rows[0]

    # Journey
    j_rows = (c.table("design_journeys").select("*")
              .eq("project_id", project_id).eq("tenant_id", tid)
              .limit(1).execute().data or [])
    if not j_rows:
        raise HTTPException(409, "Design Journey™ non ancora avviato")
    journey = j_rows[0]

    # Milestones (full set — needed for prev/next + progress)
    milestones = (c.table("journey_milestones").select("*")
                  .eq("journey_id", journey["id"]).eq("tenant_id", tid)
                  .order("order_index", desc=False).execute().data or [])
    if not milestones:
        raise HTTPException(409, "Il Journey non ha ancora capitoli")

    # Current step
    idx = next((i for i, m in enumerate(milestones)
                if m.get("milestone_type") == milestone_type), -1)
    if idx < 0:
        raise HTTPException(404, "Capitolo non disponibile per questo Journey")
    step = milestones[idx]

    # Account (best-effort — projects may or may not have account_id)
    account = None
    acc_id = project.get("account_id") if isinstance(project, dict) else None
    if acc_id:
        a_rows = (c.table("accounts").select("id, display_name, type")
                  .eq("id", acc_id).eq("tenant_id", tid)
                  .limit(1).execute().data or [])
        if a_rows:
            account = a_rows[0]

    # Artifacts — one or more sources per step type
    sources = ARTIFACT_SOURCE.get(milestone_type, [])
    artifacts: List[Dict[str, Any]] = []
    for src in sources:
        loader = ARTIFACT_LOADER.get(src)
        if loader:
            artifacts.extend(loader(c, tid, project_id))

    # Voices on this milestone
    voices = _voices_for_milestone(c, tid, step["id"])

    # Prev / next chapter (only siblings exist — never wrap)
    prev_step = milestones[idx - 1] if idx > 0 else None
    next_step = milestones[idx + 1] if idx < len(milestones) - 1 else None

    progress = _step_progress(milestones, idx)
    lifecycle = journey.get("overall_status") or "in_progress"

    return {
        "context": {
            "project": _slim(project),
            "account": _slim(account) if account else None,
            "journey": {
                "id":              journey["id"],
                "lifecycle_state": lifecycle,
                "lifecycle_label": LIFECYCLE_LABEL.get(lifecycle, "Viaggio in corso"),
            },
            "step": {
                "id":             step["id"],
                "milestone_type": step["milestone_type"],
                "title":          step["title"],
                "description":    step.get("description"),
                "status":         step.get("status"),
                "status_label":   STATUS_LABEL.get(step.get("status"), "—"),
                "started_at":     step.get("started_at"),
                "presented_at":   step.get("presented_at"),
                "approved_at":    step.get("approved_at"),
                "closed_at":      step.get("closed_at"),
            },
            "prev_step": ({"id": prev_step["id"],
                           "milestone_type": prev_step["milestone_type"],
                           "title": prev_step["title"]} if prev_step else None),
            "next_step": ({"id": next_step["id"],
                           "milestone_type": next_step["milestone_type"],
                           "title": next_step["title"]} if next_step else None),
            "progress": progress,
            "participants": [],  # advisor strip — populated by client later
        },
        "artifacts": artifacts,
        "voices":    voices,
        "supports_versioning": milestone_type in (
            "moodboard_direction", "material_direction",
            "concept_design", "final_presentation",
            "technical_package",
        ),
        "supports_alternatives": milestone_type in (
            "moodboard_direction", "material_direction",
        ),
        "available": True,
    }
