"""Phase P0.3.A — Cultural Design Intelligence™ · Reference Intelligence Layer.

External design references are NOT media uploads. They are contextualized
design signals that pass through an editorial interpretation pipeline
BEFORE they become visible.

ABSOLUTE RULES enforced server-side:
  • NO RAW IMPORTS — every reference is ingested with editorial_status
    'processing_editorial_reading' and only flips to 'ready' once the
    locale interpretation has landed.
  • MARKET INTERPRETATION ≠ TRANSLATION — readings are reinterpreted
    NATIVELY via with_runtime_prompt(locale_profile).
  • ADVISOR REMAINS CENTRAL — every meaningful state change emits a
    human-readable timeline event under `project_activity`.
  • AI INVISIBLE — events read like a senior editorial curator, never
    "AI generated".

Endpoints (all under /api/references and /api/reference-collections):

  POST   /api/references                          ingest a reference
  GET    /api/references                          list (tenant + optional project)
  GET    /api/references/{id}                     single reference + interpretations
  POST   /api/references/{id}/interpretations     regenerate for a locale
  GET    /api/references/{id}/interpretations     list interpretations

  POST   /api/reference-collections               create a curated direction
  GET    /api/reference-collections               list collections
  GET    /api/reference-collections/{cid}         collection + linked references
  POST   /api/reference-collections/{cid}/items   add a reference to a collection
  DELETE /api/reference-collections/{cid}/items/{rid}  remove a reference
"""
from __future__ import annotations

import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from database import db
from core.tenant_context import get_tenant_context, audit_log
from core.locale_runtime import (
    SUPPORTED_LOCALES,
    resolve_profile,
    resolve_from_request,
    with_runtime_prompt,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["reference-intelligence"])


SOURCE_TYPES = {"upload", "pinterest", "external_url", "curator_pick"}
EDITORIAL_STATUSES = {"processing_editorial_reading", "ready", "archived", "rejected"}


# ─── Helpers ─────────────────────────────────────────────────────────────

def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_or_404(c, table: str, row_id: str, tid: str) -> Dict[str, Any]:
    r = (c.table(table).select("*").eq("id", row_id).eq("tenant_id", tid)
         .limit(1).execute().data or [])
    if not r:
        raise HTTPException(404, f"{table} not found")
    return r[0]


def _push_activity(c, *, tenant_id: str, project_id: Optional[str],
                   actor_id: Optional[str], event_type: str,
                   label: str, ref_id: str,
                   payload: Optional[Dict[str, Any]] = None) -> None:
    """Append a human-readable timeline event. Only emitted when the
    reference is linked to a project (otherwise the timeline has no
    canvas to render on)."""
    if not project_id:
        return
    try:
        c.table("project_activity").insert({
            "id":         str(uuid.uuid4()),
            "tenant_id":  tenant_id,
            "project_id": project_id,
            "actor_id":   actor_id,
            "event_type": event_type,
            "label":      label[:200],
            "ref_id":     ref_id,
            "payload":    payload or {},
        }).execute()
    except Exception as e:
        logger.warning(f"reference activity push failed: {e}")


def _interpretation_to_public(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id":                    row.get("id"),
        "locale":                row.get("locale"),
        "atmosphere":            row.get("atmosphere"),
        "material_language":     row.get("material_language"),
        "hospitality_level":     row.get("hospitality_level"),
        "architectural_tone":    row.get("architectural_tone"),
        "emotional_positioning": row.get("emotional_positioning"),
        "market_fit_score":      float(row["market_fit_score"]) if row.get("market_fit_score") is not None else None,
        "editorial_reading":     row.get("editorial_reading"),
        "generated_at":          row.get("generated_at"),
    }


def _reference_to_public(row: Dict[str, Any],
                         interpretations: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    out = {
        "id":                  row.get("id"),
        "project_id":          row.get("project_id"),
        "source_type":         row.get("source_type"),
        "source_url":          row.get("source_url"),
        "imported_image_url":  row.get("imported_image_url"),
        "curator_name":        row.get("curator_name"),
        "locale_origin":       row.get("locale_origin"),
        "editorial_status":    row.get("editorial_status"),
        "design_intent":       row.get("design_intent"),
        "emotional_direction": row.get("emotional_direction"),
        "project_relevance":   row.get("project_relevance"),
        "advisor_notes":       row.get("advisor_notes"),
        "material_affinity":   row.get("material_affinity"),
        "created_by":          row.get("created_by"),
        "created_at":          row.get("created_at"),
        "updated_at":          row.get("updated_at"),
    }
    if interpretations is not None:
        out["interpretations"] = [_interpretation_to_public(i) for i in interpretations]
    return out


# ─── Editorial Interpretation pipeline ───────────────────────────────────

_TASK_INTRO = """You are a senior international editorial design curator
working for a luxury private design intelligence archive. You read images
the way a senior creative director would — never as a computer vision
system, never as a social inspiration tool.

You are reading a single external design reference. Your job is to extract
the cultural design intelligence it carries for the active locale, NOT to
describe what's in the picture. Materials, atmospheres, hospitality cues,
architectural rigor — read the design language, not the pixels."""

_TASK_RULES = """═══ TASK RULES ═══
• Reposition NATIVELY for the active locale — never translate, never
  generate generic summaries.
• Each field: terse editorial prose. 1–2 sentences MAX per field.
• `editorial_reading` is the marquee field — write it the way a senior
  curator writes for a private client memo (4–6 sentences MAX).
• `market_fit_score`: a number 0..100 representing how well this reference
  reads to the active locale's market. Be honest; not every reference fits
  every market.
• NEVER mention AI, model names, image content, "generated by", or
  computer-vision language.
• Output JSON ONLY — no markdown, no preamble.

Output shape (exact keys, omit none):
{
  "atmosphere":            "...",
  "material_language":     "...",
  "hospitality_level":     "...",
  "architectural_tone":    "...",
  "emotional_positioning": "...",
  "market_fit_score":      78,
  "editorial_reading":     "..."
}"""


def _build_interpretation_system(profile: Dict[str, Any]) -> str:
    return f"{_TASK_INTRO}\n\n{with_runtime_prompt(profile)}\n\n{_TASK_RULES}"


def _build_interpretation_user(reference: Dict[str, Any],
                               profile: Dict[str, Any]) -> str:
    payload = {
        "locale_code":         profile["locale_code"],
        "market":              profile.get("market"),
        "imported_image_url":  reference.get("imported_image_url"),
        "source_type":         reference.get("source_type"),
        "source_url":          reference.get("source_url"),
        "curator_name":        reference.get("curator_name"),
        "locale_origin":       reference.get("locale_origin"),
        "design_intent":       reference.get("design_intent"),
        "advisor_notes":       reference.get("advisor_notes"),
    }
    return (
        f"=== REFERENCE METADATA (use the URL as the visual anchor; you do "
        f"not need to OCR the image — read it as a senior curator would) ===\n"
        f"{json.dumps(payload, ensure_ascii=False, indent=2)}\n\n"
        f"Compose the editorial reading natively for the locale profile "
        f"above. Output JSON only."
    )


async def _generate_interpretation(reference: Dict[str, Any],
                                   profile: Dict[str, Any]
                                   ) -> Optional[Dict[str, Any]]:
    """Call the LLM and return the parsed interpretation dict.
    Returns None on failure — caller decides whether to keep the reference
    in 'processing_editorial_reading' state."""
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        logger.warning("EMERGENT_LLM_KEY missing — reference stays in processing state")
        return None

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore
        chat = (
            LlmChat(
                api_key=key,
                session_id=f"ref-{reference['id']}-{uuid.uuid4().hex[:8]}",
                system_message=_build_interpretation_system(profile),
            )
            .with_model("anthropic", "claude-sonnet-4-5-20250929")
            .with_params(max_tokens=900)
        )
        raw = await chat.send_message(UserMessage(
            text=_build_interpretation_user(reference, profile)
        ))
        text = raw if isinstance(raw, str) else getattr(raw, "text", str(raw))
        m = re.search(r"\{[\s\S]*\}", text)
        if not m:
            logger.warning("interpretation: no JSON in LLM response")
            return None
        parsed = json.loads(m.group(0))
    except Exception as e:
        logger.warning(f"interpretation LLM call failed: {e}")
        return None

    # Whitelist + minimal validation
    out: Dict[str, Any] = {}
    for k in ("atmosphere", "material_language", "hospitality_level",
              "architectural_tone", "emotional_positioning",
              "editorial_reading"):
        v = parsed.get(k)
        if isinstance(v, str):
            out[k] = v.strip()
    score = parsed.get("market_fit_score")
    try:
        if score is not None:
            score = float(score)
            out["market_fit_score"] = max(0.0, min(100.0, score))
    except (TypeError, ValueError):
        pass
    return out or None


async def _interpret_and_store(c, reference: Dict[str, Any],
                               locale_code: str,
                               *, actor_id: Optional[str]) -> Optional[Dict[str, Any]]:
    """Resolve locale_profile, call the editorial pipeline, persist the
    interpretation. Returns the persisted row or None on failure."""
    profile = resolve_profile(c, locale_code)
    if not profile:
        return None

    interpretation = await _generate_interpretation(reference, profile)
    if not interpretation:
        return None

    locale_resolved = profile["locale_code"]
    existing = (c.table("reference_locale_interpretations").select("id")
                .eq("reference_id", reference["id"])
                .eq("locale", locale_resolved).limit(1).execute().data or [])
    row = {
        "tenant_id":           reference["tenant_id"],
        "reference_id":        reference["id"],
        "locale":              locale_resolved,
        "atmosphere":          interpretation.get("atmosphere"),
        "material_language":   interpretation.get("material_language"),
        "hospitality_level":   interpretation.get("hospitality_level"),
        "architectural_tone":  interpretation.get("architectural_tone"),
        "emotional_positioning": interpretation.get("emotional_positioning"),
        "market_fit_score":    interpretation.get("market_fit_score"),
        "editorial_reading":   interpretation.get("editorial_reading"),
        "created_by_system":   True,
        "generated_at":        _iso(),
        "updated_at":          _iso(),
    }
    if existing:
        c.table("reference_locale_interpretations").update(row).eq(
            "id", existing[0]["id"]
        ).execute()
        row_id = existing[0]["id"]
    else:
        row["id"] = str(uuid.uuid4())
        c.table("reference_locale_interpretations").insert(row).execute()
        row_id = row["id"]

    audit_log(reference["tenant_id"], actor_id,
              "reference.interpretation_generated",
              "design_reference", reference["id"],
              {"locale": locale_resolved})

    return {**row, "id": row_id}


# ─── Pydantic models ─────────────────────────────────────────────────────

class IngestIn(BaseModel):
    project_id:         Optional[str] = None
    source_type:        Optional[str] = Field("upload")
    source_url:         Optional[str] = None
    imported_image_url: str = Field(..., min_length=1)
    curator_name:       Optional[str] = None
    locale_origin:      Optional[str] = None
    locale_code:        Optional[str] = Field(
        None, description="Locale for the first interpretation. Falls back to runtime resolution."
    )
    design_intent:      Optional[str] = None
    advisor_notes:      Optional[str] = None


class InterpretationIn(BaseModel):
    locale_code: str = Field(..., min_length=4, max_length=8)


class CollectionIn(BaseModel):
    title:                str  = Field(..., min_length=1, max_length=200)
    subtitle:             Optional[str] = None
    atmosphere_direction: Optional[str] = None
    project_vertical:     Optional[str] = None
    market_focus:         Optional[str] = None
    advisor_id:           Optional[str] = None


class CollectionItemIn(BaseModel):
    reference_id: str = Field(..., min_length=1)


class ReferenceActionIn(BaseModel):
    action:      str = Field(..., description="link_project | discuss | moodboard | material_study")
    project_id:  Optional[str] = None
    note:        Optional[str] = None


# ─── Reference endpoints ─────────────────────────────────────────────────

@router.post("/references", status_code=201)
async def ingest_reference(body: IngestIn, request: Request,
                           ctx=Depends(get_tenant_context)):
    """Ingest a new design reference.

    The reference is created with editorial_status='processing_editorial_reading'
    and immediately passed through the cultural interpretation pipeline.
    Only if the interpretation succeeds does the status flip to 'ready' and
    a timeline event fire — references MUST NOT become visible until
    interpretation exists.
    """
    if body.source_type and body.source_type not in SOURCE_TYPES:
        raise HTTPException(400, f"unknown source_type: {body.source_type}")

    c = db()
    tid = ctx["tenant_id"]

    # Validate project ownership (cross-tenant probes return 404).
    if body.project_id:
        _row_or_404(c, "projects", body.project_id, tid)

    ref_id = str(uuid.uuid4())
    reference = {
        "id":                  ref_id,
        "tenant_id":           tid,
        "project_id":          body.project_id,
        "source_type":         body.source_type or "upload",
        "source_url":          body.source_url,
        "imported_image_url":  body.imported_image_url,
        "curator_name":        body.curator_name,
        "locale_origin":       (body.locale_origin or "").upper() or None,
        "editorial_status":    "processing_editorial_reading",
        "design_intent":       body.design_intent,
        "advisor_notes":       body.advisor_notes,
        "created_by":          ctx.get("profile_id"),
        "created_at":          _iso(),
        "updated_at":          _iso(),
    }
    try:
        c.table("design_references").insert(reference).execute()
    except Exception as e:
        logger.exception(f"reference ingest insert failed: {e}")
        raise HTTPException(500, "reference ingest failed")

    # Resolve the locale to use for the first reading:
    #   explicit body.locale_code > locale_origin > runtime resolver
    explicit = (body.locale_code or body.locale_origin or "").upper().strip() or None
    res = resolve_from_request(
        c,
        request=request,
        tenant_id=tid,
        profile_id=ctx.get("profile_id"),
        project_id=body.project_id,
        requested_locale=explicit,
    )
    locale_code = res["locale_code"]

    # Run the editorial interpretation pipeline NOW.
    interpretation = await _interpret_and_store(
        c, reference, locale_code, actor_id=ctx.get("profile_id"),
    )

    if interpretation:
        c.table("design_references").update({
            "editorial_status": "ready",
            "updated_at":       _iso(),
        }).eq("id", ref_id).execute()
        reference["editorial_status"] = "ready"
        reference["updated_at"] = _iso()

        # Timeline event — human only, never technical.
        actor_name = (ctx.get("first_name") or "").strip() or "L'advisor"
        atmosphere = (interpretation.get("atmosphere") or "").strip()
        first_clause = atmosphere.split(".")[0] if atmosphere else "una nuova direzione editoriale"
        label = f"{actor_name} ha aggiunto {first_clause[:120]}".strip()
        _push_activity(c,
            tenant_id=tid,
            project_id=body.project_id,
            actor_id=ctx.get("profile_id"),
            event_type="reference.added",
            label=label,
            ref_id=ref_id,
            payload={
                "locale": interpretation.get("locale"),
                "atmosphere": atmosphere[:200],
                "market_fit_score": interpretation.get("market_fit_score"),
            },
        )

    audit_log(tid, ctx.get("profile_id"),
              "reference.ingested", "design_reference", ref_id,
              {"project_id": body.project_id, "locale": locale_code,
               "interpreted": bool(interpretation)})

    return {
        "ok":         True,
        "reference":  _reference_to_public(
            reference,
            [interpretation] if interpretation else [],
        ),
    }


@router.get("/references")
def list_references(project_id: Optional[str] = None,
                    status: Optional[str] = None,
                    limit: int = 60,
                    ctx=Depends(get_tenant_context)):
    """List references for the current tenant. Optionally filter by
    project_id and editorial_status. By default only 'ready' references
    are returned — references in processing_editorial_reading remain
    hidden until interpretation exists.
    """
    c = db()
    tid = ctx["tenant_id"]
    q = c.table("design_references").select("*").eq("tenant_id", tid)
    if project_id:
        q = q.eq("project_id", project_id)
    if status:
        if status not in EDITORIAL_STATUSES:
            raise HTTPException(400, f"unknown editorial_status: {status}")
        q = q.eq("editorial_status", status)
    else:
        q = q.eq("editorial_status", "ready")
    rows = q.order("created_at", desc=True).limit(min(limit, 200)).execute().data or []

    # Bulk-load interpretations
    ref_ids = [r["id"] for r in rows]
    interp_by_ref: Dict[str, List[Dict[str, Any]]] = {}
    if ref_ids:
        ir = (c.table("reference_locale_interpretations").select("*")
              .in_("reference_id", ref_ids).execute().data or [])
        for i in ir:
            interp_by_ref.setdefault(i["reference_id"], []).append(i)

    return {
        "references": [_reference_to_public(r, interp_by_ref.get(r["id"], []))
                       for r in rows],
        "total": len(rows),
    }


@router.get("/references/{reference_id}")
def get_reference(reference_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    ref = _row_or_404(c, "design_references", reference_id, ctx["tenant_id"])
    interp = (c.table("reference_locale_interpretations").select("*")
              .eq("reference_id", reference_id)
              .order("generated_at", desc=True).execute().data or [])
    return {"reference": _reference_to_public(ref, interp)}


@router.get("/references/{reference_id}/interpretations")
def list_interpretations(reference_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    _row_or_404(c, "design_references", reference_id, ctx["tenant_id"])
    rows = (c.table("reference_locale_interpretations").select("*")
            .eq("reference_id", reference_id)
            .order("generated_at", desc=True).execute().data or [])
    return {"interpretations": [_interpretation_to_public(r) for r in rows]}


@router.post("/references/{reference_id}/interpretations")
async def regenerate_interpretation(reference_id: str, body: InterpretationIn,
                                    ctx=Depends(get_tenant_context)):
    """Generate (or regenerate) the cultural reading for a specific locale."""
    code = body.locale_code.upper().strip()
    if code not in SUPPORTED_LOCALES:
        raise HTTPException(400, f"unsupported locale: {code}")

    c = db()
    ref = _row_or_404(c, "design_references", reference_id, ctx["tenant_id"])
    interpretation = await _interpret_and_store(
        c, ref, code, actor_id=ctx.get("profile_id"),
    )
    if not interpretation:
        raise HTTPException(503,
            "editorial reading not available — interpretation pipeline unreachable")

    # If the reference was still processing, promote it to ready now that
    # at least one interpretation exists.
    if ref.get("editorial_status") == "processing_editorial_reading":
        c.table("design_references").update({
            "editorial_status": "ready",
            "updated_at":       _iso(),
        }).eq("id", reference_id).execute()

    _push_activity(c,
        tenant_id=ctx["tenant_id"],
        project_id=ref.get("project_id"),
        actor_id=ctx.get("profile_id"),
        event_type="reference.interpretation_updated",
        label=f"Editorial reading updated for {interpretation.get('locale')} market",
        ref_id=reference_id,
        payload={"locale": interpretation.get("locale")},
    )

    return {"ok": True, "interpretation": _interpretation_to_public(interpretation)}


# ─── Advisor context actions (CTAs from /workspace/references) ───────────

_ACTION_EVENT_TYPE = {
    "link_project":   "reference.added_to_direction",
    "discuss":        "reference.discuss_requested",
    "moodboard":      "reference.added_to_moodboard_intent",
    "material_study": "reference.material_study_flagged",
}

_ACTION_LABEL_TEMPLATE = {
    "link_project":   "Reference connected to the project direction",
    "discuss":        "Reference shared with the advisor for discussion",
    "moodboard":      "Reference noted for the moodboard composition",
    "material_study": "Reference flagged for the material study",
}


@router.post("/references/{reference_id}/actions")
def reference_action(reference_id: str, body: ReferenceActionIn,
                     ctx=Depends(get_tenant_context)):
    """Lightweight CTA dispatcher from `/workspace/references`.

    Four actions:
      • link_project    — attach reference to a project (must also be in
                          the same tenant) and flag in timeline.
      • discuss         — emit an advisor-context event.
      • moodboard       — record intent (UI hands off to moodboard editor later).
      • material_study  — flag for the material study workflow.
    """
    action = (body.action or "").lower().strip()
    if action not in _ACTION_EVENT_TYPE:
        raise HTTPException(400, f"unknown action: {action}")

    c = db()
    tid = ctx["tenant_id"]
    ref = _row_or_404(c, "design_references", reference_id, tid)
    if ref.get("editorial_status") != "ready":
        raise HTTPException(409,
            "this reference is still being read editorially — try again shortly")

    project_id = body.project_id or ref.get("project_id")

    # link_project actually mutates the reference. Otherwise just emit an event.
    if action == "link_project":
        if not body.project_id:
            raise HTTPException(400, "project_id required for link_project")
        _row_or_404(c, "projects", body.project_id, tid)
        c.table("design_references").update({
            "project_id": body.project_id,
            "updated_at": _iso(),
        }).eq("id", reference_id).eq("tenant_id", tid).execute()
        project_id = body.project_id

    _push_activity(c,
        tenant_id=tid,
        project_id=project_id,
        actor_id=ctx.get("profile_id"),
        event_type=_ACTION_EVENT_TYPE[action],
        label=_ACTION_LABEL_TEMPLATE[action],
        ref_id=reference_id,
        payload={"action": action, "note": body.note},
    )

    audit_log(tid, ctx.get("profile_id"),
              f"reference.action.{action}", "design_reference", reference_id,
              {"project_id": project_id})

    return {"ok": True, "action": action, "project_id": project_id}


# ─── Collection endpoints ────────────────────────────────────────────────

@router.post("/reference-collections", status_code=201)
def create_collection(body: CollectionIn, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    row_id = str(uuid.uuid4())
    row = {
        "id":                   row_id,
        "tenant_id":            tid,
        "advisor_id":           body.advisor_id or ctx.get("profile_id"),
        "title":                body.title.strip()[:200],
        "subtitle":             (body.subtitle or "").strip() or None,
        "atmosphere_direction": (body.atmosphere_direction or "").strip() or None,
        "project_vertical":     (body.project_vertical or "").strip() or None,
        "market_focus":         (body.market_focus or "").upper().strip() or None,
        "created_at":           _iso(),
        "updated_at":           _iso(),
    }
    c.table("reference_collections").insert(row).execute()
    audit_log(tid, ctx.get("profile_id"),
              "reference_collection.created", "reference_collection", row_id,
              {"title": row["title"]})
    return {"ok": True, "collection": row}


@router.get("/reference-collections")
def list_collections(ctx=Depends(get_tenant_context)):
    c = db()
    rows = (c.table("reference_collections").select("*")
            .eq("tenant_id", ctx["tenant_id"])
            .order("created_at", desc=True).execute().data or [])

    # Item counts in one query.
    counts: Dict[str, int] = {}
    if rows:
        items = (c.table("reference_collection_items").select("collection_id")
                 .in_("collection_id", [r["id"] for r in rows]).execute().data or [])
        for it in items:
            counts[it["collection_id"]] = counts.get(it["collection_id"], 0) + 1

    return {
        "collections": [{**r, "item_count": counts.get(r["id"], 0)} for r in rows],
        "total": len(rows),
    }


@router.get("/reference-collections/{collection_id}")
def get_collection(collection_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    collection = _row_or_404(c, "reference_collections", collection_id, ctx["tenant_id"])

    items = (c.table("reference_collection_items").select("reference_id, added_at")
             .eq("collection_id", collection_id)
             .order("added_at", desc=True).execute().data or [])
    ref_ids = [i["reference_id"] for i in items]

    references: List[Dict[str, Any]] = []
    if ref_ids:
        refs = (c.table("design_references").select("*")
                .in_("id", ref_ids).eq("tenant_id", ctx["tenant_id"])
                .eq("editorial_status", "ready").execute().data or [])
        interp = (c.table("reference_locale_interpretations").select("*")
                  .in_("reference_id", [r["id"] for r in refs]).execute().data or [])
        by_ref: Dict[str, List[Dict[str, Any]]] = {}
        for i in interp:
            by_ref.setdefault(i["reference_id"], []).append(i)
        # preserve insertion order
        order = {rid: idx for idx, rid in enumerate(ref_ids)}
        refs.sort(key=lambda r: order.get(r["id"], 9999))
        references = [_reference_to_public(r, by_ref.get(r["id"], [])) for r in refs]

    return {"collection": collection, "references": references}


@router.post("/reference-collections/{collection_id}/items", status_code=201)
def add_to_collection(collection_id: str, body: CollectionItemIn,
                      ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _row_or_404(c, "reference_collections", collection_id, tid)
    ref = _row_or_404(c, "design_references", body.reference_id, tid)
    if ref.get("editorial_status") != "ready":
        raise HTTPException(409,
            "this reference is still being read editorially — try again shortly")

    existing = (c.table("reference_collection_items").select("id")
                .eq("collection_id", collection_id)
                .eq("reference_id", body.reference_id).limit(1).execute().data or [])
    if existing:
        return {"ok": True, "item_id": existing[0]["id"], "already_added": True}

    item_id = str(uuid.uuid4())
    c.table("reference_collection_items").insert({
        "id":            item_id,
        "tenant_id":     tid,
        "collection_id": collection_id,
        "reference_id":  body.reference_id,
        "added_by":      ctx.get("profile_id"),
        "added_at":      _iso(),
    }).execute()

    _push_activity(c,
        tenant_id=tid,
        project_id=ref.get("project_id"),
        actor_id=ctx.get("profile_id"),
        event_type="reference.added_to_direction",
        label="Reference linked to a curated direction",
        ref_id=body.reference_id,
        payload={"collection_id": collection_id},
    )

    return {"ok": True, "item_id": item_id, "already_added": False}


@router.delete("/reference-collections/{collection_id}/items/{reference_id}")
def remove_from_collection(collection_id: str, reference_id: str,
                           ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _row_or_404(c, "reference_collections", collection_id, tid)
    c.table("reference_collection_items").delete().eq(
        "collection_id", collection_id
    ).eq("reference_id", reference_id).eq("tenant_id", tid).execute()
    return {"ok": True}
