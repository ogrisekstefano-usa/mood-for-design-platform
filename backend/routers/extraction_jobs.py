"""ITER197 · Persistent Extraction Jobs™ — REST API.

Endpoints:
  POST   /extraction-jobs                  Create + spawn job
  GET    /extraction-jobs                  List
  GET    /extraction-jobs/{id}             Detail
  POST   /extraction-jobs/{id}/pause       Cooperative pause
  POST   /extraction-jobs/{id}/resume      Resume from last persisted state
  POST   /extraction-jobs/{id}/cancel      Cooperative cancel

Plus:
  POST   /catalog-sets/{set_id}/documents/{doc_id}/retry
         Single-document retry endpoint (ITER189 retry hook).

  GET    /system/smoke-test
         Automatic operational smoke test:
         - no `running` extraction_job with heartbeat older than 2 min
         - mailbox-bodies bucket exists
         - Vision Layer 2 timeout config active
"""
from __future__ import annotations
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import db, get_admin_client
from core.tenant_context import get_tenant_context
from services import extraction_job_runner as runner

logger = logging.getLogger("extraction_jobs_api")
router = APIRouter()


# ─── Models ───────────────────────────────────────────────────────────
class CreateJobBody(BaseModel):
    catalog_set_id: str
    max_candidates_per_doc: Optional[int] = 600
    rebuild_index: Optional[bool] = True


# ─── Permissions helper ───────────────────────────────────────────────
def _require_set_ownership(c, tenant_id: str, set_id: str):
    rows = (c.table("brand_catalog_sets").select("id,brand_id,tenant_id,status")
            .eq("id", set_id).eq("tenant_id", tenant_id).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Catalog Set non trovato")
    return rows[0]


def _require_job(c, tenant_id: str, job_id: str):
    rows = (c.table("extraction_jobs").select("*").eq("id", job_id)
            .eq("tenant_id", tenant_id).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Job non trovato")
    return rows[0]


# ─── Endpoints ────────────────────────────────────────────────────────
@router.post("/extraction-jobs")
def create_job(body: CreateJobBody, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    cset = _require_set_ownership(c, tid, body.catalog_set_id)
    try:
        out = runner.enqueue_job(
            tenant_id=tid,
            catalog_set_id=body.catalog_set_id,
            brand_id=cset.get("brand_id"),
            config={
                "max_candidates_per_doc": body.max_candidates_per_doc or 600,
                "rebuild_index": bool(body.rebuild_index),
            },
            created_by=ctx.get("profile_id"),
        )
        return {"ok": True, **out}
    except ValueError as e:
        if str(e) == "active_job_exists":
            raise HTTPException(409, "Job di estrazione già attivo per questo set")
        raise HTTPException(500, str(e))


@router.get("/extraction-jobs")
def list_jobs_api(catalog_set_id: Optional[str] = None,
                   status: Optional[str] = None,
                   limit: int = 50,
                   ctx=Depends(get_tenant_context)):
    tid = ctx["tenant_id"]
    rows = runner.list_jobs(tid, catalog_set_id=catalog_set_id,
                              status=status, limit=limit)
    return {"jobs": rows, "count": len(rows)}


@router.get("/extraction-jobs/{job_id}")
def get_job_api(job_id: str, ctx=Depends(get_tenant_context)):
    c = db(); tid = ctx["tenant_id"]
    job = _require_job(c, tid, job_id)
    # Enrich with ETA + elapsed
    out = dict(job)
    started = job.get("started_at")
    elapsed = None; eta = None; pps = None
    if started:
        try:
            from datetime import datetime as _dt
            t0 = _dt.fromisoformat(started.replace("Z","+00:00"))
            if t0.tzinfo is None: t0 = t0.replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            elapsed = max(0, int((now - t0).total_seconds()))
            done = int(job.get("processed_pages") or 0)
            total = int(job.get("total_pages") or 0)
            if elapsed > 5 and done > 0:
                pps = round(done / elapsed, 3)
                remaining = max(0, total - done)
                if pps > 0: eta = int(remaining / pps)
        except Exception:
            pass
    out.update({"elapsed_seconds": elapsed, "eta_seconds": eta,
                 "pages_per_second": pps})
    return out


@router.post("/extraction-jobs/{job_id}/pause")
def pause_api(job_id: str, ctx=Depends(get_tenant_context)):
    c = db(); tid = ctx["tenant_id"]
    _require_job(c, tid, job_id)
    if not runner.request_pause(job_id):
        raise HTTPException(409, "Job non in stato pausabile")
    return {"ok": True, "pause_requested": True}


@router.post("/extraction-jobs/{job_id}/resume")
def resume_api(job_id: str, ctx=Depends(get_tenant_context)):
    c = db(); tid = ctx["tenant_id"]
    _require_job(c, tid, job_id)
    if not runner.resume_job(job_id):
        raise HTTPException(409, "Job non in stato resumibile")
    return {"ok": True, "status": "queued"}


@router.post("/extraction-jobs/{job_id}/cancel")
def cancel_api(job_id: str, ctx=Depends(get_tenant_context)):
    c = db(); tid = ctx["tenant_id"]
    _require_job(c, tid, job_id)
    if not runner.cancel_job(job_id):
        raise HTTPException(409, "Job non in stato annullabile")
    return {"ok": True, "cancel_requested": True}


# ─── Single-document retry (ITER189 hook) ─────────────────────────────
@router.post("/catalog-sets/{set_id}/documents/{doc_id}/retry")
def retry_document(set_id: str, doc_id: str, ctx=Depends(get_tenant_context)):
    """Reset a single document back to 'pending' and spawn a fresh
    extraction job for the catalog set. The job will skip review/validated/
    failed docs and process the pending ones (including the one we just
    reset). This is the recommended retry path for documents that hit
    Vision Layer 2 hangs (now bounded by per-image timeout).
    """
    c = db(); tid = ctx["tenant_id"]
    _require_set_ownership(c, tid, set_id)
    doc_rows = (c.table("brand_catalog_documents")
                .select("id,source_document_id,extraction_status,display_name")
                .eq("id", doc_id).eq("catalog_set_id", set_id)
                .limit(1).execute().data or [])
    if not doc_rows:
        raise HTTPException(404, "Documento non trovato nel set")
    doc = doc_rows[0]
    # Reset doc
    c.table("brand_catalog_documents").update({
        "extraction_status": "pending",
        "extraction_started_at": None,
        "extraction_completed_at": None,
        "pages_processed": 0,
        "error_logs": [],
        "metrics": {},
        "updated_at": runner._now(),
    }).eq("id", doc_id).execute()
    if doc.get("source_document_id"):
        try:
            c.table("source_documents").update({
                "extraction_status": "pending",
                "updated_at": runner._now(),
            }).eq("id", doc["source_document_id"]).execute()
        except Exception:
            pass
    # Flip set if needed so enqueue_job doesn't conflict on the unique index
    cset = _require_set_ownership(c, tid, set_id)
    if cset.get("status") == "extracting":
        c.table("brand_catalog_sets").update({
            "status": "needs_review", "updated_at": runner._now(),
        }).eq("id", set_id).execute()
    # Enqueue
    try:
        out = runner.enqueue_job(
            tenant_id=tid, catalog_set_id=set_id,
            brand_id=cset.get("brand_id"),
            config={"max_candidates_per_doc": 600, "rebuild_index": True},
            created_by=ctx.get("profile_id"),
        )
    except ValueError as e:
        if str(e) == "active_job_exists":
            raise HTTPException(409, "Job già attivo per questo set")
        raise HTTPException(500, str(e))
    return {"ok": True, "retried_document": doc.get("display_name"), **out}


# ─── ITER199 · Entity Resolution + Knowledge Audit ────────────────────
from services import entity_resolution_service as resolver  # noqa: E402


@router.post("/catalog-sets/{set_id}/resolve-entities")
def resolve_entities(set_id: str, ctx=Depends(get_tenant_context)):
    """Run the full Entity Resolution™ pipeline on a catalog set.
    Demotes false collections, normalises finishes, assigns canonical
    categories, links products to collections, hardens designer entities,
    then rebuilds the knowledge_graph_edges."""
    c = db(); tid = ctx["tenant_id"]
    cset = _require_set_ownership(c, tid, set_id)
    return {"ok": True, "result": resolver.run_resolution(tid, set_id, cset.get("brand_id"))}


@router.get("/catalog-sets/{set_id}/knowledge-audit")
def knowledge_audit(set_id: str, ctx=Depends(get_tenant_context)):
    """Reusable audit endpoint returning the 7-component Knowledge Score™
    + builder readiness for any brand catalog set."""
    c = db(); tid = ctx["tenant_id"]
    _require_set_ownership(c, tid, set_id)
    return resolver.compute_knowledge_audit(set_id)


@router.get("/catalog-sets/{set_id}/worker-status")
def worker_status(set_id: str, ctx=Depends(get_tenant_context)):
    """KE-002 · semantic worker state for the Control Room status bar.

    Returns one of 7 states (`idle`, `active`, `stalled`, `stalled_recovery`,
    `failed`, `review_required`, `certified`) along with the active job
    snapshot, queue counts, ETA and warnings total.
    """
    c = db(); tid = ctx["tenant_id"]
    cset = _require_set_ownership(c, tid, set_id)
    set_status = cset.get("status")

    # Pull most recent job (any status)
    jobs = (c.table("extraction_jobs")
            .select("id,status,worker_id,current_document_name,current_page,"
                     "total_pages,processed_pages,current_stage,current_stage_label,"
                     "current_vision_current,current_vision_total,"
                     "heartbeat_at,last_seen_at,last_activity_at,stalled_at,"
                     "retry_count,progress_pct,estimated_remaining_seconds,"
                     "documents_total,documents_completed,documents_failed,"
                     "error_message,started_at,completed_at,created_at")
            .eq("tenant_id", tid).eq("catalog_set_id", set_id)
            .order("created_at", desc=True).limit(1)
            .execute().data or [])
    active_job = jobs[0] if jobs else None

    # Document queue counts
    counts = {"pending": 0, "extracting": 0, "review": 0, "failed": 0,
              "validated": 0}
    try:
        docs = (c.table("brand_catalog_documents")
                .select("extraction_status")
                .eq("catalog_set_id", set_id).execute().data or [])
        for d in docs:
            s = d.get("extraction_status") or "pending"
            counts[s] = counts.get(s, 0) + 1
    except Exception:
        pass

    # Warnings total = entities flagged needs_review/demoted
    warnings_total = 0
    try:
        wq = (c.table("brand_detected_entities")
              .select("id", count="exact").limit(0)
              .eq("catalog_set_id", set_id)
              .or_("status.eq.needs_review,entity_type.like.demoted_%")
              .execute())
        warnings_total = int(getattr(wq, "count", 0) or 0)
    except Exception:
        pass

    # Heartbeat age (seconds)
    hb_age = None
    if active_job and active_job.get("heartbeat_at"):
        try:
            from datetime import datetime, timezone
            t = datetime.fromisoformat(active_job["heartbeat_at"].replace("Z", "+00:00"))
            if t.tzinfo is None:
                t = t.replace(tzinfo=timezone.utc)
            hb_age = max(0, int((datetime.now(timezone.utc) - t).total_seconds()))
        except Exception:
            pass

    # Semantic state resolution (7 states)
    state = "idle"
    if set_status == "published":
        state = "certified"
    elif active_job and active_job["status"] == "running":
        if hb_age is not None and hb_age > 30:
            state = "stalled"
        else:
            state = "active"
    elif active_job and active_job["status"] == "stalled":
        state = "stalled_recovery"
    elif active_job and active_job["status"] == "queued":
        state = "active"
    elif active_job and active_job["status"] == "failed":
        state = "failed" if (counts.get("failed", 0) + counts.get("pending", 0)) > 0 else "review_required"
    elif set_status == "needs_review" or warnings_total > 0 or counts["failed"] > 0:
        state = "review_required"
    elif set_status == "draft" and counts["pending"] == 0:
        state = "idle"
    elif set_status == "needs_review":
        state = "review_required"

    return {
        "state": state,
        "set_status": set_status,
        "job": active_job,
        "heartbeat_age_seconds": hb_age,
        "queue": counts,
        "warnings_total": warnings_total,
        "eta_seconds": (active_job or {}).get("estimated_remaining_seconds"),
    }


from fastapi import Query

# ─── KE-001 · Review Workspace deep-link foundation ───────────────────
NEEDS_REVIEW_FILTERS = {
    "designer_ambiguous": {"entity_type": ["designer", "demoted_designer"]},
    "material_ambiguous": {"entity_type": ["material", "demoted_material",
                                            "finish", "demoted_finish"]},
    "brand_duplicate":    {"entity_type": ["brand_alias", "brand"]},
    "product_unclassified": {"entity_type": ["product", "demoted_product"],
                              "confidence_lt": 0.6},
    "image_orphan":       {"entity_type": ["image_orphan", "media_orphan"]},
    "low_confidence":     {"confidence_lt": 0.6},
    "failed_document":    {"_meta": "document_level"},
}


# ─── ITER200 · Review Actions API ─────────────────────────────────────
@router.get("/catalog-sets/{set_id}/needs-review")
def list_needs_review(
    set_id: str,
    type: Optional[str] = Query(None, description="KE-001 filter: designer_ambiguous|material_ambiguous|brand_duplicate|product_unclassified|image_orphan|low_confidence|failed_document"),
    include_first: bool = Query(False, description="KE-001 · include first_anomaly entity_id for deep-link"),
    ctx=Depends(get_tenant_context),
):
    """Return entities flagged as `needs_review` plus the post-resolution
    `demoted_*` types so the operator can audit cleanup decisions.

    KE-001 · supports `?type=…` filter for Review Workspace deep-link.
    """
    c = db(); tid = ctx["tenant_id"]
    _require_set_ownership(c, tid, set_id)

    if type and type == "failed_document":
        # Document-level breakdown for the Warning Center
        docs = (c.table("brand_catalog_documents")
                 .select("id,display_name,extraction_status,page_count,pages_processed,error_logs")
                 .eq("catalog_set_id", set_id)
                 .eq("extraction_status", "failed")
                 .execute().data or [])
        payload = {"failed_documents": docs, "count": len(docs),
                    "filter": type}
        if include_first:
            payload["first_anomaly"] = docs[0]["id"] if docs else None
        return payload

    DEFAULT_TYPES = ["collection", "demoted_collection", "designer",
                      "demoted_designer", "finish", "demoted_finish"]
    q = (c.table("brand_detected_entities")
         .select("id,entity_type,display_name,aliases,mention_count,"
                  "confidence_score,status,canonical_ref_id,"
                  "source_document_ids,attributes"))
    q = q.eq("catalog_set_id", set_id)

    spec = NEEDS_REVIEW_FILTERS.get(type) if type else None
    if spec:
        if spec.get("entity_type"):
            q = q.in_("entity_type", spec["entity_type"])
        if "confidence_lt" in spec:
            q = q.lt("confidence_score", spec["confidence_lt"])
        q = q.or_("status.eq.needs_review,entity_type.like.demoted_%")
    else:
        q = q.in_("entity_type", DEFAULT_TYPES)
        q = q.or_("status.eq.needs_review,entity_type.like.demoted_%")

    rows = (q.order("entity_type").order("mention_count", desc=True)
             .limit(500).execute().data or [])

    out = {"entities": rows, "count": len(rows), "filter": type}
    if include_first:
        out["first_anomaly"] = rows[0]["id"] if rows else None
    return out


@router.post("/catalog-sets/{set_id}/entities/{entity_id}/approve")
def approve_entity(set_id: str, entity_id: str,
                    ctx=Depends(get_tenant_context)):
    """Promote a `needs_review` or demoted entity to `validated`.
    Demoted entity types are restored to their canonical type."""
    from datetime import datetime as _dt
    c = db(); tid = ctx["tenant_id"]
    _require_set_ownership(c, tid, set_id)
    rows = (c.table("brand_detected_entities").select("*")
            .eq("id", entity_id).eq("catalog_set_id", set_id)
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Entità non trovata")
    e = rows[0]
    target_type = e["entity_type"]
    if target_type.startswith("demoted_"):
        target_type = target_type.replace("demoted_", "", 1)
    if target_type == "designer":  # promoted via approval → registered
        target_type = "designer_registered"
    attrs = dict(e.get("attributes") or {})
    attrs["approved_at"] = _dt.now(timezone.utc).isoformat()
    attrs["approved_by"] = ctx.get("profile_id")
    c.table("brand_detected_entities").update({
        "entity_type": target_type,
        "status": "validated",
        "attributes": attrs,
        "reviewed_by": ctx.get("profile_id"),
        "reviewed_at": runner._now(),
        "updated_at": runner._now(),
    }).eq("id", entity_id).execute()
    return {"ok": True, "entity_id": entity_id,
            "new_entity_type": target_type, "new_status": "validated"}


@router.post("/catalog-sets/{set_id}/entities/{entity_id}/reject")
def reject_entity(set_id: str, entity_id: str,
                   ctx=Depends(get_tenant_context)):
    """Permanently demote an entity (status=rejected, entity_type=demoted_*)."""
    c = db(); tid = ctx["tenant_id"]
    _require_set_ownership(c, tid, set_id)
    rows = (c.table("brand_detected_entities").select("*")
            .eq("id", entity_id).eq("catalog_set_id", set_id)
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Entità non trovata")
    e = rows[0]
    et = e["entity_type"]
    # Normalise so 'designer_registered' rejected becomes 'demoted_designer'
    # and 'demoted_X' stays as 'demoted_X'.
    if et.startswith("demoted_"):
        target_type = et
    else:
        base = et.replace("_registered", "")
        target_type = f"demoted_{base}"
    attrs = dict(e.get("attributes") or {})
    attrs["rejected_at"] = runner._now()
    attrs["rejected_by"] = ctx.get("profile_id")
    c.table("brand_detected_entities").update({
        "entity_type": target_type,
        "status": "rejected",
        "attributes": attrs,
        "reviewed_by": ctx.get("profile_id"),
        "reviewed_at": runner._now(),
        "updated_at": runner._now(),
    }).eq("id", entity_id).execute()
    return {"ok": True, "entity_id": entity_id,
            "new_entity_type": target_type, "new_status": "rejected"}


@router.post("/catalog-sets/{set_id}/entities/{entity_id}/promote-canonical")
def promote_to_canonical(set_id: str, entity_id: str,
                          ctx=Depends(get_tenant_context)):
    """Promote a collection / finish entity to canonical anchor status.
    For collection entities: materialises a `collections_canonical` row
    and links the entity to it. For finishes: marks `is_canonical_anchor`
    and `self_canonical` in attributes."""
    import uuid as _uuid
    c = db(); tid = ctx["tenant_id"]
    cset = _require_set_ownership(c, tid, set_id)
    rows = (c.table("brand_detected_entities").select("*")
            .eq("id", entity_id).eq("catalog_set_id", set_id)
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Entità non trovata")
    e = rows[0]
    et = e["entity_type"]
    base = et.replace("demoted_", "", 1) if et.startswith("demoted_") else et
    attrs = dict(e.get("attributes") or {})

    if base == "collection":
        name = e["display_name"]
        key = (resolver._normalize(name).replace(" ", "-")[:60]) or f"col-{entity_id[:8]}"
        existing = (c.table("collections_canonical").select("id")
                    .eq("tenant_id", tid).eq("collection_key", key)
                    .limit(1).execute().data or [])
        if existing:
            cid = existing[0]["id"]
        else:
            cid = str(_uuid.uuid4())
            c.table("collections_canonical").insert({
                "id": cid, "tenant_id": tid,
                "brand_id": cset.get("brand_id"),
                "collection_key": key, "display_name": name,
                "metadata_json": {"promoted_from": entity_id,
                                   "catalog_set_id": set_id,
                                   "kind": "manual_promotion"},
                "created_at": runner._now(),
                "updated_at": runner._now(),
            }).execute()
        attrs["promoted_at"] = runner._now()
        attrs["canonical_id"] = cid
        c.table("brand_detected_entities").update({
            "entity_type": "collection",
            "status": "validated",
            "canonical_ref_id": cid,
            "canonical_ref_table": "collections_canonical",
            "attributes": attrs,
            "reviewed_by": ctx.get("profile_id"),
            "reviewed_at": runner._now(),
            "updated_at": runner._now(),
        }).eq("id", entity_id).execute()
        return {"ok": True, "entity_id": entity_id, "canonical_id": cid,
                "entity_type": "collection"}

    if base == "finish":
        attrs.update({
            "is_canonical_anchor": True,
            "self_canonical": True,
            "canonical_label": e["display_name"],
            "promoted_at": runner._now(),
        })
        c.table("brand_detected_entities").update({
            "entity_type": "finish",
            "status": "validated",
            "attributes": attrs,
            "reviewed_by": ctx.get("profile_id"),
            "reviewed_at": runner._now(),
            "updated_at": runner._now(),
        }).eq("id", entity_id).execute()
        return {"ok": True, "entity_id": entity_id,
                "entity_type": "finish", "promoted": True}

    if base == "designer":
        # Promote to designer_registered with full verification
        attrs.update({"source": "manual_promotion",
                      "verified": True,
                      "promoted_at": runner._now()})
        c.table("brand_detected_entities").update({
            "entity_type": "designer_registered",
            "status": "validated",
            "attributes": attrs,
            "reviewed_by": ctx.get("profile_id"),
            "reviewed_at": runner._now(),
            "updated_at": runner._now(),
        }).eq("id", entity_id).execute()
        return {"ok": True, "entity_id": entity_id,
                "entity_type": "designer_registered", "promoted": True}

    raise HTTPException(400, f"Tipo di entità non promovibile: {et}")


# ─── Operational smoke test ───────────────────────────────────────────
@router.get("/system/smoke-test")
def smoke_test(ctx=Depends(get_tenant_context)):
    """Automatic operational checks for the Knowledge Engine.

    Checks (per tenant):
      1. No 'running' extraction_job with heartbeat > 2 min (orphan).
      2. No catalog_set in 'extracting' for > 30 min with no progress.
      3. mailbox-bodies bucket exists (Journey Mail Phase 4 dep).
      4. Vision Layer 2 per-image timeout config active (ITER189 root fix).

    Returns ok=True iff all 4 pass.
    """
    c = db(); tid = ctx["tenant_id"]
    checks = {}

    # 1. Orphan extraction jobs
    threshold = (datetime.now(timezone.utc) - timedelta(seconds=120)).isoformat()
    orphans = (c.table("extraction_jobs").select("id,heartbeat_at,current_document_name")
               .eq("tenant_id", tid).eq("status", "running")
               .lt("heartbeat_at", threshold).execute().data or [])
    checks["no_orphan_extraction_jobs"] = {
        "ok": len(orphans) == 0,
        "count": len(orphans),
        "samples": orphans[:3],
    }

    # 2. Stuck catalog sets
    stuck_threshold = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    stuck = (c.table("brand_catalog_sets").select("id,name,status,updated_at")
             .eq("tenant_id", tid).eq("status", "extracting")
             .lt("updated_at", stuck_threshold).execute().data or [])
    checks["no_stuck_catalog_sets"] = {
        "ok": len(stuck) == 0,
        "count": len(stuck),
        "samples": stuck[:3],
    }

    # 3. mailbox-bodies bucket
    bucket_ok = False; bucket_detail = {}
    try:
        admin = get_admin_client()
        if admin is not None:
            names = [b.name for b in admin.storage.list_buckets()]
            bucket_ok = "mailbox-bodies" in names
            bucket_detail = {"present": bucket_ok}
        else:
            bucket_detail = {"error": "admin_client_unavailable"}
    except Exception as e:
        bucket_detail = {"error": type(e).__name__}
    checks["mailbox_bodies_bucket_ok"] = {"ok": bucket_ok, **bucket_detail}

    # 4. Vision Layer 2 timeout config active
    timeout_s = float(os.environ.get("CULTURAL_VISION_PER_IMAGE_TIMEOUT_S", "45"))
    timeout_ok = 5 <= timeout_s <= 120
    checks["vision_layer2_timeout_ok"] = {
        "ok": timeout_ok,
        "value_seconds": timeout_s,
    }

    overall = all(v["ok"] for v in checks.values())
    return {
        "ok": overall, "tenant_id": tid,
        "checked_at": runner._now(),
        "checks": checks,
    }



# ══════════════════════════════════════════════════════════════════════
#  ITER201 · REVIEW WORKSPACE™ — Human-in-the-Loop Validation Layer
# ══════════════════════════════════════════════════════════════════════

# Critical entity types that gate publishing (Founder Lock from PRD).
_CRITICAL_TYPES = {"collection", "designer_registered"}
_ALL_REVIEW_TYPES = ["collection", "demoted_collection",
                      "designer", "designer_registered", "demoted_designer",
                      "material", "finish", "demoted_finish", "product"]


def _readiness_for_type(c, set_id: str, etype: str) -> Dict[str, int]:
    rows = (c.table("brand_detected_entities").select("id,status")
            .eq("catalog_set_id", set_id).eq("entity_type", etype)
            .execute().data or [])
    total = len(rows)
    validated = sum(1 for r in rows if r.get("status") == "validated")
    return {"total": total, "validated": validated,
            "pct": round(100.0 * validated / total, 2) if total else 100.0}


@router.get("/catalog-sets/{set_id}/review-summary")
def review_summary(set_id: str, ctx=Depends(get_tenant_context)):
    """Top-of-page Review Queue header for ITER201.

    Returns:
      - totals: all reviewable entities, auto_validated, needs_review, blocked
      - breakdown[type]: total, needs_review, validated, pct
      - sort_order: explicit type priority (collection > designer > material > product > finish)
    """
    c = db(); tid = ctx["tenant_id"]
    _require_set_ownership(c, tid, set_id)

    rows = (c.table("brand_detected_entities")
            .select("id,entity_type,status,confidence_score")
            .eq("catalog_set_id", set_id)
            .in_("entity_type", _ALL_REVIEW_TYPES)
            .execute().data or [])

    by_type: Dict[str, Dict[str, int]] = {}
    totals = {"total": 0, "validated": 0, "needs_review": 0,
              "rejected": 0, "auto_validated": 0}
    for r in rows:
        et = r["entity_type"]
        st = r.get("status") or "detected"
        d = by_type.setdefault(et, {"total": 0, "needs_review": 0,
                                      "validated": 0, "rejected": 0,
                                      "auto_validated": 0})
        d["total"] += 1
        totals["total"] += 1
        if st == "validated":
            d["validated"] += 1
            totals["validated"] += 1
        elif st == "needs_review":
            d["needs_review"] += 1
            totals["needs_review"] += 1
        elif st == "rejected":
            d["rejected"] += 1
            totals["rejected"] += 1
        elif st == "auto_merged":
            d["auto_validated"] += 1
            totals["auto_validated"] += 1
        # Demoted types count as 'blocked' for queue purposes
        if et.startswith("demoted_"):
            d["rejected"] = d.get("rejected", 0) + 0  # already counted via status
    for et, d in by_type.items():
        d["pct_validated"] = round(100.0 * d["validated"] / d["total"], 2) if d["total"] else 0

    # Impact ordering — collections/designers first
    sort_order = ["collection", "designer_registered", "designer",
                  "material", "product",
                  "demoted_collection", "demoted_designer",
                  "finish", "demoted_finish"]
    return {
        "set_id": set_id,
        "totals": totals,
        "breakdown": by_type,
        "sort_order": sort_order,
    }


@router.get("/catalog-sets/{set_id}/entities/{entity_id}/detail")
def entity_detail(set_id: str, entity_id: str,
                   ctx=Depends(get_tenant_context)):
    """Drawer payload: entity info, aliases, suggested canonical, graph impact."""
    c = db(); tid = ctx["tenant_id"]
    cset = _require_set_ownership(c, tid, set_id)
    rows = (c.table("brand_detected_entities").select("*")
            .eq("id", entity_id).eq("catalog_set_id", set_id)
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Entità non trovata")
    e = rows[0]

    # Source pages (look up via source_page_ids if present)
    page_ids = e.get("source_page_ids") or []
    pages: List[Dict[str, Any]] = []
    if page_ids:
        try:
            pages = (c.table("product_pages").select("id,page_number,source_document_id")
                     .in_("id", page_ids[:50]).execute().data or [])
        except Exception:
            pages = []
    doc_ids = e.get("source_document_ids") or []
    docs: List[Dict[str, Any]] = []
    if doc_ids:
        try:
            docs = (c.table("brand_catalog_documents").select("source_document_id,display_name")
                    .in_("source_document_id", doc_ids[:50])
                    .eq("catalog_set_id", set_id).execute().data or [])
        except Exception:
            docs = []

    # Graph impact — count outgoing/incoming edges referencing this entity
    impact = {"products_linked": 0, "materials_linked": 0,
              "collections_linked": 0, "finishes_linked": 0}
    try:
        # Edges where this entity is the source OR target
        es = (c.table("knowledge_graph_edges")
              .select("source_type,source_id,target_type,target_id,edge_type")
              .eq("tenant_id", tid)
              .contains("metadata_json", {"catalog_set_id": set_id})
              .or_(f"source_id.eq.{entity_id},target_id.eq.{entity_id},"
                   f"source_id.eq.{e.get('canonical_ref_id') or entity_id},"
                   f"target_id.eq.{e.get('canonical_ref_id') or entity_id}")
              .limit(500).execute().data or [])
        for x in es:
            other_type = x["target_type"] if x["source_id"] in (entity_id, e.get("canonical_ref_id")) else x["source_type"]
            if other_type == "product":   impact["products_linked"] += 1
            if other_type == "material":  impact["materials_linked"] += 1
            if other_type == "collection": impact["collections_linked"] += 1
            if other_type == "finish":    impact["finishes_linked"] += 1
    except Exception as ex:
        logger.warning(f"graph impact lookup: {ex}")

    # Suggested canonical — if entity has canonical_ref_id, fetch the target
    suggested = None
    if e.get("canonical_ref_id") and e.get("canonical_ref_table") == "collections_canonical":
        try:
            sc = (c.table("collections_canonical").select("id,display_name,collection_key")
                  .eq("id", e["canonical_ref_id"]).limit(1).execute().data or [])
            if sc:
                suggested = {"kind": "collection_canonical", **sc[0],
                              "confidence": e.get("confidence_score")}
        except Exception:
            pass
    elif e.get("entity_type") == "designer":
        # Suggest registry match
        from services import brand_designer_registry as bdr
        brand_id = cset.get("brand_id")
        # Resolve brand_slug via brands table → simplified using bdr helper
        entries = bdr.get_registry_for_brand_id(c, brand_id)
        slug = None
        if entries:
            # Find by name normalisation
            for ent in entries:
                if bdr._normalize(ent["name"]) == bdr._normalize(e.get("display_name") or ""):
                    suggested = {"kind": "designer_registry", "name": ent["name"],
                                  "confidence": 1.0,
                                  "verified_by": ent.get("verified_by")}
                    break

    return {
        "entity": e,
        "documents": docs,
        "pages": pages[:20],
        "graph_impact": impact,
        "suggested_canonical": suggested,
    }


class MergeAliasesBody(BaseModel):
    source_entity_ids: List[str]  # entities to absorb
    target_entity_id: str  # canonical winner (keeps its identity)


@router.post("/catalog-sets/{set_id}/entities/merge-aliases")
def merge_aliases(set_id: str, body: MergeAliasesBody,
                   ctx=Depends(get_tenant_context)):
    """Merge multiple source entities INTO a target as aliases.
    The target gains the source display_names as aliases and absorbs
    mention counts. Sources become status=merged_into."""
    if not body.source_entity_ids:
        raise HTTPException(400, "source_entity_ids vuoto")
    if body.target_entity_id in body.source_entity_ids:
        raise HTTPException(400, "Target non può essere fra le source")

    c = db(); tid = ctx["tenant_id"]
    _require_set_ownership(c, tid, set_id)

    tgt_rows = (c.table("brand_detected_entities").select("*")
                .eq("id", body.target_entity_id)
                .eq("catalog_set_id", set_id).limit(1).execute().data or [])
    if not tgt_rows:
        raise HTTPException(404, "Target non trovato")
    tgt = tgt_rows[0]

    src_rows = (c.table("brand_detected_entities").select("*")
                .in_("id", body.source_entity_ids)
                .eq("catalog_set_id", set_id).execute().data or [])
    if not src_rows:
        raise HTTPException(404, "Source non trovate")

    new_aliases = set(tgt.get("aliases") or [])
    new_docs = set(tgt.get("source_document_ids") or [])
    new_mentions = tgt.get("mention_count") or 0
    max_conf = tgt.get("confidence_score") or 0
    for s in src_rows:
        new_aliases.add(s["display_name"])
        for a in (s.get("aliases") or []):
            new_aliases.add(a)
        for d in (s.get("source_document_ids") or []):
            new_docs.add(d)
        new_mentions += s.get("mention_count") or 0
        max_conf = max(max_conf, s.get("confidence_score") or 0)

    new_conf = round(min(0.99, max_conf + 0.05 * len(src_rows)), 3)
    c.table("brand_detected_entities").update({
        "aliases": sorted(new_aliases),
        "source_document_ids": sorted(new_docs),
        "mention_count": new_mentions,
        "confidence_score": new_conf,
        "status": "validated",
        "reviewed_by": ctx.get("profile_id"),
        "reviewed_at": runner._now(),
        "updated_at": runner._now(),
    }).eq("id", body.target_entity_id).execute()

    for s in src_rows:
        c.table("brand_detected_entities").update({
            "status": "merged_into",
            "merged_into_id": body.target_entity_id,
            "reviewed_by": ctx.get("profile_id"),
            "reviewed_at": runner._now(),
            "updated_at": runner._now(),
        }).eq("id", s["id"]).execute()
    return {"ok": True, "target": body.target_entity_id,
            "absorbed_count": len(src_rows),
            "new_alias_count": len(new_aliases),
            "new_mention_count": new_mentions}


class BulkActionBody(BaseModel):
    entity_ids: List[str]
    action: str  # 'approve' | 'reject' | 'promote'


@router.post("/catalog-sets/{set_id}/entities/bulk-action")
def bulk_action(set_id: str, body: BulkActionBody,
                 ctx=Depends(get_tenant_context)):
    """Apply approve / reject / promote to many entities at once."""
    if body.action not in ("approve", "reject", "promote"):
        raise HTTPException(400, f"Azione non valida: {body.action}")
    if not body.entity_ids:
        raise HTTPException(400, "Nessuna entità selezionata")
    c = db(); tid = ctx["tenant_id"]
    _require_set_ownership(c, tid, set_id)

    rows = (c.table("brand_detected_entities").select("id,entity_type,attributes")
            .in_("id", body.entity_ids).eq("catalog_set_id", set_id)
            .execute().data or [])
    if not rows:
        raise HTTPException(404, "Nessuna entità trovata")

    applied = 0; errors: List[Dict[str, Any]] = []
    for e in rows:
        try:
            et = e["entity_type"]
            attrs = dict(e.get("attributes") or {})
            attrs[f"{body.action}d_at"] = runner._now()
            attrs[f"{body.action}d_by"] = ctx.get("profile_id")
            update: Dict[str, Any] = {
                "attributes": attrs,
                "reviewed_by": ctx.get("profile_id"),
                "reviewed_at": runner._now(),
                "updated_at": runner._now(),
            }
            if body.action == "approve":
                target_type = et.replace("demoted_", "", 1) if et.startswith("demoted_") else et
                if target_type == "designer":
                    target_type = "designer_registered"
                update["entity_type"] = target_type
                update["status"] = "validated"
            elif body.action == "reject":
                if et.startswith("demoted_"):
                    target_type = et
                else:
                    base = et.replace("_registered", "")
                    target_type = f"demoted_{base}"
                update["entity_type"] = target_type
                update["status"] = "rejected"
            elif body.action == "promote":
                base = et.replace("demoted_", "", 1) if et.startswith("demoted_") else et
                update["entity_type"] = (
                    "designer_registered" if base == "designer" else base
                )
                update["status"] = "validated"
                if base == "finish":
                    attrs["is_canonical_anchor"] = True
                    attrs["self_canonical"] = True
                    attrs["canonical_label"] = e.get("display_name") if isinstance(e, dict) else None
                    update["attributes"] = attrs
            c.table("brand_detected_entities").update(update) \
                .eq("id", e["id"]).execute()
            applied += 1
        except Exception as ex:
            errors.append({"id": e["id"], "error": str(ex)})
    return {"ok": True, "applied": applied,
            "total": len(body.entity_ids),
            "errors": errors}


@router.get("/catalog-sets/{set_id}/publish-gate")
def publish_gate(set_id: str, ctx=Depends(get_tenant_context)):
    """ITER201 · Publish Gate readiness check (criterion (c)):
      • Collections (canonical-promoted): 100% validated
      • Designers (registered):          100% validated
      • Products linked to collection:   ≥ 80%
      • Graph completeness:              ≥ 90
    Returns per-criterion status + overall ready_to_publish.
    """
    c = db(); tid = ctx["tenant_id"]
    _require_set_ownership(c, tid, set_id)

    col_r = _readiness_for_type(c, set_id, "collection")
    des_r = _readiness_for_type(c, set_id, "designer_registered")
    mat_r = _readiness_for_type(c, set_id, "material")
    prod_r = _readiness_for_type(c, set_id, "product")

    # Linked-product %
    audit = resolver.compute_knowledge_audit(set_id)
    total_p = audit.get("metrics", {}).get("products_total", 0) or 0
    linked = audit.get("metrics", {}).get("products_linked_to_collection", 0) or 0
    linked_pct = round(100.0 * linked / total_p, 2) if total_p else 0.0
    graph_pct = audit.get("graph_completeness", 0) or 0

    criteria = [
        {"key": "collections_validated",
         "label": "Collezioni validate",
         "value_pct": col_r["pct"], "threshold": 100,
         "ok": col_r["pct"] >= 100,
         "count": f"{col_r['validated']}/{col_r['total']}"},
        {"key": "designers_validated",
         "label": "Designer verificati",
         "value_pct": des_r["pct"], "threshold": 100,
         "ok": des_r["pct"] >= 100,
         "count": f"{des_r['validated']}/{des_r['total']}"},
        {"key": "products_linked",
         "label": "Prodotti linkati a collezione",
         "value_pct": linked_pct, "threshold": 80,
         "ok": linked_pct >= 80,
         "count": f"{linked}/{total_p}"},
        {"key": "graph_completeness",
         "label": "Knowledge Graph completo",
         "value_pct": graph_pct, "threshold": 90,
         "ok": graph_pct >= 90,
         "count": f"{graph_pct}/100"},
    ]
    ready_to_publish = all(x["ok"] for x in criteria)
    overall_pct = round(sum(min(100, x["value_pct"]) for x in criteria) / len(criteria), 2)

    # Non-critical: finishes/materials in needs_review (info-only)
    nc_finish = _readiness_for_type(c, set_id, "finish")
    return {
        "ready_to_publish": ready_to_publish,
        "overall_readiness_pct": overall_pct,
        "criteria": criteria,
        "non_critical": {
            "finishes": nc_finish,
            "materials": mat_r,
            "products": prod_r,
        },
        "blockers": [c["label"] for c in criteria if not c["ok"]],
    }


# ═════════════════════════════════════════════════════════════════════
# KE-001 · Document-level recovery + extraction events
# ═════════════════════════════════════════════════════════════════════

@router.get("/catalog-sets/{set_id}/documents/{doc_id}")
def get_document_preview(set_id: str, doc_id: str,
                          ctx=Depends(get_tenant_context)):
    """KE-001 · OPEN action · read-only document state for the Control
    Room. Returns extraction stage, pages_processed, last metrics, and
    error_logs if any."""
    c = db(); tid = ctx["tenant_id"]
    _require_set_ownership(c, tid, set_id)
    rows = (c.table("brand_catalog_documents")
            .select("id,catalog_set_id,source_document_id,display_name,"
                    "original_filename,extraction_status,page_count,"
                    "pages_processed,extraction_started_at,"
                    "extraction_completed_at,metrics,error_logs,storage_path,"
                    "sort_order,updated_at,created_at")
            .eq("id", doc_id).eq("catalog_set_id", set_id)
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Documento non trovato")
    d = rows[0]
    # Asset counters · best-effort
    asset_count = 0
    try:
        # media_library.metadata_json->source_document_id
        sd = d.get("source_document_id")
        if sd:
            res = (c.table("media_library").select("id", count="exact")
                   .eq("tenant_id", tid).limit(0)
                   .filter("metadata_json->>source_document_id", "eq", sd)
                   .execute())
            asset_count = int(getattr(res, "count", 0) or 0)
    except Exception:
        pass
    return {
        "document": d,
        "stats": {"asset_count": asset_count},
    }


@router.get("/catalog-sets/{set_id}/documents/{doc_id}/review-context")
def get_document_review_context(set_id: str, doc_id: str,
                                 ctx=Depends(get_tenant_context)):
    """KE-001 · REVIEW deep-link · entities flagged for review that
    originate from this document. Returns `first_anomaly` so the UI can
    auto-open the first one in the Review Workspace™ V3."""
    c = db(); tid = ctx["tenant_id"]
    _require_set_ownership(c, tid, set_id)
    doc = (c.table("brand_catalog_documents")
            .select("id,source_document_id")
            .eq("id", doc_id).eq("catalog_set_id", set_id)
            .limit(1).execute().data or [])
    if not doc:
        raise HTTPException(404, "Documento non trovato")
    sd = doc[0].get("source_document_id")
    if not sd:
        return {"entities": [], "count": 0, "first_anomaly": None}
    rows = (c.table("brand_detected_entities")
            .select("id,entity_type,display_name,confidence_score,status,"
                    "source_document_ids,mention_count")
            .eq("catalog_set_id", set_id)
            .filter("source_document_ids", "cs", f'["{sd}"]')
            .or_("status.eq.needs_review,entity_type.like.demoted_%")
            .order("confidence_score").limit(200)
            .execute().data or [])
    return {
        "document_id": doc_id,
        "source_document_id": sd,
        "entities": rows,
        "count": len(rows),
        "first_anomaly": (rows[0]["id"] if rows else None),
    }


class RetryFailedBody(BaseModel):
    dry_run: bool = False


@router.post("/catalog-sets/{set_id}/retry-failed")
def retry_failed_documents(set_id: str, body: RetryFailedBody = RetryFailedBody(),
                            ctx=Depends(get_tenant_context)):
    """KE-001 · Bulk retry of all `failed` documents in the set.
    Does NOT touch documents in `review`/`validated`/`pending`. Enqueues
    a single new job after resetting the failed docs to `pending`.
    """
    c = db(); tid = ctx["tenant_id"]
    cset = _require_set_ownership(c, tid, set_id)
    failed = (c.table("brand_catalog_documents")
               .select("id,source_document_id,display_name")
               .eq("catalog_set_id", set_id)
               .eq("extraction_status", "failed")
               .execute().data or [])
    if not failed:
        return {"ok": True, "reset": 0, "job_id": None,
                "dry_run": body.dry_run, "message": "Nessun documento failed"}

    if body.dry_run:
        return {"ok": True, "reset": len(failed),
                "documents": [{"id": d["id"], "name": d.get("display_name")} for d in failed],
                "dry_run": True}

    for d in failed:
        c.table("brand_catalog_documents").update({
            "extraction_status": "pending",
            "extraction_started_at": None,
            "extraction_completed_at": None,
            "pages_processed": 0,
            "error_logs": [],
            "metrics": {},
            "updated_at": runner._now(),
        }).eq("id", d["id"]).execute()
        if d.get("source_document_id"):
            try:
                c.table("source_documents").update({
                    "extraction_status": "pending",
                    "updated_at": runner._now(),
                }).eq("id", d["source_document_id"]).execute()
            except Exception:
                pass

    # Flip the set so enqueue_job doesn't conflict
    if cset.get("status") == "extracting":
        c.table("brand_catalog_sets").update({
            "status": "needs_review", "updated_at": runner._now(),
        }).eq("id", set_id).execute()

    try:
        out = runner.enqueue_job(
            tenant_id=tid, catalog_set_id=set_id,
            brand_id=cset.get("brand_id"),
            config={"max_candidates_per_doc": 600, "rebuild_index": True},
            created_by=ctx.get("profile_id"),
        )
    except ValueError as e:
        if str(e) == "active_job_exists":
            raise HTTPException(409, "Job già attivo per questo set")
        raise HTTPException(500, str(e))

    # Emit DOCUMENT_RETRIED for each doc (best-effort)
    try:
        from services import extraction_event_publisher as _ev
        for d in failed:
            _ev.emit(tenant_id=tid, catalog_set_id=set_id,
                     catalog_document_id=d["id"],
                     kind=_ev.DOCUMENT_RETRIED,
                     message=f"Document retried via /retry-failed: {d.get('display_name')}",
                     payload={"job_id": out.get("job_id")})
    except Exception:
        pass

    return {"ok": True, "reset": len(failed), **out, "dry_run": False}


@router.get("/catalog-sets/{set_id}/extraction-jobs")
def list_extraction_jobs_for_set(set_id: str,
                                   limit: int = Query(50, ge=1, le=200),
                                   ctx=Depends(get_tenant_context)):
    """KE-001 · history of extraction_jobs rows for this set."""
    c = db(); tid = ctx["tenant_id"]
    _require_set_ownership(c, tid, set_id)
    rows = (c.table("extraction_jobs")
            .select("id,status,started_at,completed_at,heartbeat_at,"
                    "last_seen_at,last_activity_at,stalled_at,worker_id,"
                    "retry_count,parent_job_id,progress_pct,"
                    "documents_total,documents_completed,documents_failed,"
                    "total_pages,processed_pages,current_document_name,"
                    "current_page,current_stage,current_stage_label,"
                    "estimated_remaining_seconds,error_message,"
                    "pause_requested,cancel_requested,created_at,updated_at")
            .eq("tenant_id", tid).eq("catalog_set_id", set_id)
            .order("created_at", desc=True).limit(limit)
            .execute().data or [])
    return {"jobs": rows, "count": len(rows)}


@router.get("/catalog-sets/{set_id}/events")
def list_extraction_events(set_id: str,
                            since: Optional[str] = Query(None,
                                description="ISO timestamp for incremental polling"),
                            kind: Optional[str] = Query(None),
                            limit: int = Query(100, ge=1, le=500),
                            ctx=Depends(get_tenant_context)):
    """KE-001 · paged event stream for the catalog set. Foundation for
    KE-002 Live Activity Stream / Worker Status / Warning Center / KPI.
    """
    c = db(); tid = ctx["tenant_id"]
    _require_set_ownership(c, tid, set_id)
    q = (c.table("extraction_event_log")
         .select("id,ts,kind,message,catalog_document_id,job_id,entity_id,payload")
         .eq("tenant_id", tid).eq("catalog_set_id", set_id)
         .order("ts", desc=True).limit(limit))
    if since:
        q = q.gt("ts", since)
    if kind:
        q = q.eq("kind", kind)
    rows = q.execute().data or []
    next_since = rows[0]["ts"] if rows else since
    return {"events": rows, "count": len(rows), "next_since": next_since}
