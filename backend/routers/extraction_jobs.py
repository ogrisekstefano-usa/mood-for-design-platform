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


# ─── ITER200 · Review Actions API ─────────────────────────────────────
@router.get("/catalog-sets/{set_id}/needs-review")
def list_needs_review(set_id: str, ctx=Depends(get_tenant_context)):
    """Return entities flagged as `needs_review` plus the post-resolution
    `demoted_*` types so the operator can audit cleanup decisions."""
    c = db(); tid = ctx["tenant_id"]
    _require_set_ownership(c, tid, set_id)
    REVIEW_TYPES = ["collection", "demoted_collection", "designer",
                    "demoted_designer", "finish", "demoted_finish"]
    rows = (c.table("brand_detected_entities")
            .select("id,entity_type,display_name,aliases,mention_count,"
                    "confidence_score,status,canonical_ref_id,"
                    "source_document_ids,attributes")
            .eq("catalog_set_id", set_id)
            .in_("entity_type", REVIEW_TYPES)
            .or_("status.eq.needs_review,entity_type.like.demoted_%")
            .order("entity_type")
            .order("mention_count", desc=True)
            .limit(500)
            .execute().data or [])
    return {"entities": rows, "count": len(rows)}


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
