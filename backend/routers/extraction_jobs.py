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
from typing import Optional

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
