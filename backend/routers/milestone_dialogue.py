"""Milestone Dialogue · Sprint F.B (Immersive Project Dialogue).

NON è un commenting system, NON è approval workflow.
È il dialogo curatoriale tra studio e cliente attorno alla
direzione progettuale.

Endpoints:
  GET  /api/milestones/{mid}/dialogue          → versioni + feedback
  POST /api/milestones/{mid}/versions          → nuovo capitolo progettuale
  POST /api/milestones/{mid}/feedback          → voce curatoriale del cliente
  GET  /api/projects/{pid}/rationale           → leggi il "perché"
  PUT  /api/projects/{pid}/rationale           → scrivi il "perché"
  GET  /api/projects/{pid}/memory              → memoria viva del progetto
"""
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel, Field
from middleware.auth import get_current_user
from core.tenant_context import get_tenant_context
from database import db

router = APIRouter()


# ─── Editorial mappings — Italian only ───────────────────────────────
CHAPTER_LABEL = {
    'initial_direction':         'Direzione iniziale',
    'proposed_evolution':         'Evoluzione proposta',
    'shared_variant':             'Variante condivisa',
    'material_revision':          'Revisione materica',
    'new_interpretation':         'Nuova interpretazione',
    'final_direction':            'Direzione finale',
    'lighter_variant':            'Variante più luminosa',
    'more_material_variant':      'Direzione più materica',
    'hospitality_interpretation': 'Interpretazione hospitality',
    'minimal_contemporary':       'Evoluzione minimal contemporanea',
}

FEEDBACK_LABEL = {
    'embraces':              'Questa direzione mi rappresenta',
    'explore_atmosphere':    'Vorrei approfondire questa atmosfera',
    'request_variant':       'Possiamo esplorare una variante?',
    'material_loved':        'Questo materiale mi convince',
    'wants_lighter':         'Vorrei una proposta più luminosa',
    'storytelling_strong':   'Questa soluzione racconta bene il progetto',
    'wants_more_material':   "Mi piacerebbe vedere un'alternativa più materica",
    'palette_works':         'Questa palette funziona molto bene',
    'request_detail':        'Vorrei approfondire questo dettaglio',
    'free_voice':            'Voce libera',
}

FEEDBACK_TONE = {
    'embraces':              'embrace',
    'explore_atmosphere':    'curious',
    'request_variant':       'curious',
    'material_loved':        'embrace',
    'wants_lighter':         'reorient',
    'storytelling_strong':   'embrace',
    'wants_more_material':   'reorient',
    'palette_works':         'embrace',
    'request_detail':        'curious',
    'free_voice':            'voice',
}


# ─── Pydantic models ─────────────────────────────────────────────────
class VersionIn(BaseModel):
    chapter_kind: str
    title:        str
    summary:      Optional[str] = None
    rationale:    Optional[str] = None
    palette_hint: Optional[list] = None
    cover_url:    Optional[str] = None


class FeedbackIn(BaseModel):
    kind:        str
    quote:       Optional[str] = None
    version_id:  Optional[str] = None
    author_role: Optional[str] = 'client'


class RationaleIn(BaseModel):
    narrative_direction: Optional[str] = None  # direzione narrativa
    material_logic:      Optional[str] = None  # motivazione materiali
    desired_atmosphere:  Optional[str] = None  # atmosfera desiderata
    context_relation:    Optional[str] = None  # relazione col contesto
    cultural_coherence:  Optional[str] = None  # coerenza culturale
    client_perception:   Optional[str] = None  # percezione cliente
    project_language:    Optional[str] = None  # linguaggio progettuale


# ─── Helpers ─────────────────────────────────────────────────────────
def _milestone(mid: str, tid: str) -> dict:
    rows = (db().table('journey_milestones').select('*')
            .eq('id', mid).eq('tenant_id', tid)
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(status_code=404, detail="Milestone not found")
    return rows[0]


def _project(pid: str, tid: str) -> dict:
    rows = (db().table('projects').select('*')
            .eq('id', pid).eq('tenant_id', tid)
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(status_code=404, detail="Project not found")
    return rows[0]


def _enrich_version(v: dict) -> dict:
    return {
        **v,
        'chapter_label': CHAPTER_LABEL.get(v['chapter_kind'], v['chapter_kind']),
    }


def _enrich_feedback(f: dict) -> dict:
    return {
        **f,
        'kind_label': FEEDBACK_LABEL.get(f['kind'], f['kind']),
        'tone':       FEEDBACK_TONE.get(f['kind'], 'voice'),
    }


# ─── Dialogue routes ─────────────────────────────────────────────────
@router.get("/milestones/{mid}/dialogue")
def get_dialogue(mid: str, ctx=Depends(get_tenant_context)):
    """Return chapters + curatorial feedback woven around a milestone."""
    tid = ctx["tenant_id"]
    m = _milestone(mid, tid)

    versions = (db().table('milestone_versions').select('*')
                .eq('milestone_id', mid).eq('tenant_id', tid)
                .order('created_at', desc=False)
                .execute().data or [])
    feedback = (db().table('milestone_feedback').select('*')
                .eq('milestone_id', mid).eq('tenant_id', tid)
                .order('created_at', desc=True)
                .execute().data or [])

    return {
        "milestone":  {
            "id":             m['id'],
            "title":          m.get('title'),
            "milestone_type": m.get('milestone_type'),
            "status":         m.get('status'),
        },
        "chapters":   [_enrich_version(v) for v in versions],
        "feedback":   [_enrich_feedback(f) for f in feedback],
        "lexicon":    {
            "chapter_kinds":  CHAPTER_LABEL,
            "feedback_kinds": FEEDBACK_LABEL,
        },
    }


@router.post("/milestones/{mid}/versions")
def create_version(mid: str, body: VersionIn, ctx=Depends(get_tenant_context)):
    if body.chapter_kind not in CHAPTER_LABEL:
        raise HTTPException(status_code=400,
                            detail=f"Unknown chapter_kind '{body.chapter_kind}'")
    tid = ctx["tenant_id"]
    m = _milestone(mid, tid)

    row = {
        "tenant_id":    tid,
        "milestone_id": mid,
        "chapter_kind": body.chapter_kind,
        "title":        body.title,
        "summary":      body.summary,
        "rationale":    body.rationale,
        "palette_hint": body.palette_hint or [],
        "cover_url":    body.cover_url,
        "created_by":   ctx.get("user_id"),
    }
    r = db().table('milestone_versions').insert(row).execute()
    saved = r.data[0]

    # Emit an editorial timeline event on the journey
    try:
        db().table('journey_timeline_events').insert({
            "tenant_id":      tid,
            "journey_id":     m.get('journey_id'),
            "milestone_id":   mid,
            "event_type":     "chapter_added",
            "narrative_text": f"{CHAPTER_LABEL[body.chapter_kind]} aggiunta a {m.get('title')}.",
            "created_by":     ctx.get("profile_id") or ctx.get("user_id"),
        }).execute()
    except Exception:
        pass

    return {"item": _enrich_version(saved)}


@router.post("/milestones/{mid}/feedback")
def create_feedback(mid: str, body: FeedbackIn, ctx=Depends(get_tenant_context)):
    if body.kind not in FEEDBACK_LABEL:
        raise HTTPException(status_code=400,
                            detail=f"Unknown feedback kind '{body.kind}'")
    tid = ctx["tenant_id"]
    m = _milestone(mid, tid)

    row = {
        "tenant_id":      tid,
        "milestone_id":   mid,
        "version_id":     body.version_id,
        "kind":           body.kind,
        "quote":          body.quote,
        "author_role":    body.author_role or 'client',
        "author_user_id": ctx.get("user_id"),
    }
    r = db().table('milestone_feedback').insert(row).execute()
    saved = r.data[0]

    # Editorial timeline event with the curatorial phrasing.
    try:
        phrase = FEEDBACK_LABEL[body.kind]
        narrative = (f'{phrase} · "{body.quote}"' if body.quote and body.kind == 'free_voice'
                     else phrase)
        db().table('journey_timeline_events').insert({
            "tenant_id":      tid,
            "journey_id":     m.get('journey_id'),
            "milestone_id":   mid,
            "event_type":     "client_voice",
            "narrative_text": f"Voce del cliente · {narrative}",
            "created_by":     ctx.get("profile_id") or ctx.get("user_id"),
        }).execute()
    except Exception:
        pass

    return {"item": _enrich_feedback(saved)}


# ─── Project Rationale ──────────────────────────────────────────────
@router.get("/projects/{pid}/rationale")
def get_rationale(pid: str, ctx=Depends(get_tenant_context)):
    p = _project(pid, ctx["tenant_id"])
    rationale = (p.get('metadata_json') or {}).get('rationale_json') or {}
    return {
        "project_id": pid,
        "rationale":  rationale,
        "updated_at": (p.get('metadata_json') or {}).get('rationale_updated_at'),
    }


@router.put("/projects/{pid}/rationale")
def put_rationale(pid: str, body: RationaleIn, ctx=Depends(get_tenant_context)):
    tid = ctx["tenant_id"]
    p = _project(pid, tid)
    meta = (p.get('metadata_json') or {}).copy()
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    meta['rationale_json'] = {**(meta.get('rationale_json') or {}), **payload}
    meta['rationale_updated_at'] = datetime.now(timezone.utc).isoformat()

    db().table('projects').update({"metadata_json": meta}) \
        .eq('id', pid).eq('tenant_id', tid).execute()

    return {"project_id": pid, "rationale": meta['rationale_json']}


# ─── Project Memory — memoria viva ──────────────────────────────────
@router.get("/projects/{pid}/memory")
def get_project_memory(pid: str, ctx=Depends(get_tenant_context)):
    """Editorial narrative memory: journey events + chapters + feedback,
    woven chronologically as the project's living memory.
    """
    tid = ctx["tenant_id"]
    p = _project(pid, tid)
    j_rows = (db().table('design_journeys').select('*')
              .eq('project_id', pid).eq('tenant_id', tid)
              .limit(1).execute().data or [])
    if not j_rows:
        return {"project_id": pid, "memory": []}
    journey_id = j_rows[0]['id']

    events = (db().table('journey_timeline_events').select('*')
              .eq('journey_id', journey_id).eq('tenant_id', tid)
              .order('created_at', desc=True)
              .limit(120).execute().data or [])

    # Group events into editorial memory entries (no audit-log feel).
    memory = []
    for e in events:
        memory.append({
            "id":            e['id'],
            "narrative":     e.get('narrative_text'),
            "kind":          e.get('event_type'),
            "created_at":    e.get('created_at'),
        })
    return {"project_id": pid, "memory": memory}
