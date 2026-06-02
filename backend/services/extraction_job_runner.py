"""ITER197 · Persistent Extraction Jobs™ runner.

Replaces FastAPI BackgroundTasks (process-bound, dies on restart) with a
DB-backed job system. Jobs persist progress continuously to the
`extraction_jobs` table; on startup, orphan jobs (status='running' with
stale heartbeat) are automatically resumed at the document boundary.

Design notes:
  • Each job runs in the same FastAPI process as a `asyncio.create_task`.
  • Progress is persisted on every stage callback AND every 5 vision images,
    so the heartbeat (`heartbeat_at`) is fresh.
  • Resume granularity is at the DOCUMENT level: documents already in
    `review`/`validated`/`failed` are skipped by the existing
    `_run_set_extraction` loop. Mid-document state is NOT checkpointed
    (the composer pipeline is stage-based, not page-based) — the in-flight
    document is re-processed from scratch on resume. This is acceptable
    because individual documents complete in 3-9 minutes.
  • Pause/cancel are COOPERATIVE: the runner checks the flags at the
    beginning of each document iteration.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Callable, Dict, List, Optional

from database import db, get_admin_client

logger = logging.getLogger("extraction_jobs")

# ── Heartbeat / orphan policy ─────────────────────────────────────────
HEARTBEAT_STALE_AFTER_S = 120        # 2 minutes
RECOVERY_RETRY_DELAY_S  = 5
MAX_RETRY_COUNT         = 3

# In-process registry of running jobs so we don't double-spawn.
_RUNNING_JOBS: Dict[str, asyncio.Task] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Public API ─────────────────────────────────────────────────────────
def enqueue_job(
    *,
    tenant_id: str,
    catalog_set_id: str,
    brand_id: Optional[str],
    config: Optional[Dict[str, Any]] = None,
    created_by: Optional[str] = None,
) -> Dict[str, Any]:
    """Insert a new extraction_jobs row in 'queued' state and spawn it.

    Raises ValueError if an active job (queued/running/paused) already
    exists for the same set (the unique partial index enforces this).
    """
    c = db()
    job_id = str(uuid.uuid4())
    # Pre-count docs / pages for the set so the UI has totals at t=0
    docs = (c.table("brand_catalog_documents")
            .select("id,page_count,extraction_status")
            .eq("catalog_set_id", catalog_set_id).execute().data or [])
    total_pages = sum(int(d.get("page_count") or 0) for d in docs)
    done = sum(1 for d in docs if d["extraction_status"] in ("review","validated"))
    failed_docs = sum(1 for d in docs if d["extraction_status"] == "failed")
    pages_done = sum(int(d.get("page_count") or 0) for d in docs
                     if d["extraction_status"] in ("review","validated"))
    progress = round(100.0 * pages_done / total_pages, 2) if total_pages else 0.0

    row = {
        "id": job_id,
        "tenant_id": tenant_id,
        "catalog_set_id": catalog_set_id,
        "brand_id": brand_id,
        "status": "queued",
        "total_pages": total_pages,
        "processed_pages": pages_done,
        "documents_total": len(docs),
        "documents_completed": done,
        "documents_failed": failed_docs,
        "progress_pct": progress,
        "config_json": config or {},
        "created_by": created_by,
        "heartbeat_at": _now(),
        "created_at": _now(),
        "updated_at": _now(),
    }
    try:
        c.table("extraction_jobs").insert(row).execute()
    except Exception as e:
        # Conflict on unique partial index → there's already an active job.
        msg = str(e)
        if "uq_extraction_jobs_active_per_set" in msg or "duplicate" in msg.lower():
            raise ValueError("active_job_exists") from e
        raise

    # Spawn it on the running event loop
    _spawn_job(job_id)
    return {"job_id": job_id, "status": "queued"}


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    c = db()
    rows = (c.table("extraction_jobs").select("*").eq("id", job_id)
            .limit(1).execute().data or [])
    return rows[0] if rows else None


def list_jobs(tenant_id: str, *, catalog_set_id: Optional[str] = None,
              status: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    c = db()
    q = (c.table("extraction_jobs").select("*").eq("tenant_id", tenant_id)
         .order("created_at", desc=True).limit(limit))
    if catalog_set_id:
        q = q.eq("catalog_set_id", catalog_set_id)
    if status:
        q = q.eq("status", status)
    return q.execute().data or []


def request_pause(job_id: str) -> bool:
    c = db()
    r = (c.table("extraction_jobs").update({
        "pause_requested": True, "updated_at": _now(),
    }).eq("id", job_id).in_("status", ["queued","running"]).execute().data or [])
    return len(r) > 0


def resume_job(job_id: str) -> bool:
    c = db()
    rows = (c.table("extraction_jobs").select("status").eq("id", job_id)
            .limit(1).execute().data or [])
    if not rows:
        return False
    st = rows[0]["status"]
    if st not in ("paused", "failed"):
        return False
    c.table("extraction_jobs").update({
        "status": "queued", "pause_requested": False,
        "error_message": None, "updated_at": _now(),
    }).eq("id", job_id).execute()
    _spawn_job(job_id)
    return True


def cancel_job(job_id: str) -> bool:
    c = db()
    r = (c.table("extraction_jobs").update({
        "cancel_requested": True, "updated_at": _now(),
    }).eq("id", job_id).in_("status", ["queued","running","paused"]).execute().data or [])
    return len(r) > 0


# ─── Orphan recovery (called on FastAPI startup) ────────────────────────
def recover_orphan_jobs() -> int:
    """Find 'running' jobs whose heartbeat is older than 2 minutes
    (= the worker process died) and mark them as queued, then re-spawn.

    Returns the number of jobs recovered.
    """
    c = db()
    threshold = (datetime.now(timezone.utc) - timedelta(seconds=HEARTBEAT_STALE_AFTER_S)).isoformat()
    orphans = (c.table("extraction_jobs").select("id,catalog_set_id,heartbeat_at,retry_count")
               .eq("status", "running").lt("heartbeat_at", threshold)
               .execute().data or [])
    n = 0
    for j in orphans:
        if (j.get("retry_count") or 0) >= MAX_RETRY_COUNT:
            c.table("extraction_jobs").update({
                "status": "failed",
                "error_message": f"Orphan job exceeded {MAX_RETRY_COUNT} restarts.",
                "last_error_at": _now(), "updated_at": _now(),
            }).eq("id", j["id"]).execute()
            logger.warning(f"orphan job {j['id']} max retries reached → failed")
            continue
        c.table("extraction_jobs").update({
            "status": "queued",
            "retry_count": (j.get("retry_count") or 0) + 1,
            "pause_requested": False,
            "cancel_requested": False,
            "updated_at": _now(),
        }).eq("id", j["id"]).execute()
        _spawn_job(j["id"])
        n += 1
        logger.warning(f"orphan job {j['id']} recovered (stale since {j['heartbeat_at']})")
    if n:
        logger.warning(f"recover_orphan_jobs: {n} job(s) re-queued")
    return n


# ─── Job execution ──────────────────────────────────────────────────────
def _spawn_job(job_id: str) -> None:
    """Spawn an asyncio task running _execute_job in the FastAPI event loop.

    If the task is already running (dict entry), do nothing.
    Falls back to a thread-spawned new loop if no running loop exists yet
    (rare — only during startup recovery before the lifespan starts).
    """
    if job_id in _RUNNING_JOBS and not _RUNNING_JOBS[job_id].done():
        return
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            task = loop.create_task(_execute_job_async(job_id))
            _RUNNING_JOBS[job_id] = task
            task.add_done_callback(lambda _t, jid=job_id: _RUNNING_JOBS.pop(jid, None))
            return
    except RuntimeError:
        pass
    # Fallback: run in a thread with its own event loop.
    import threading
    def _runner():
        loop = asyncio.new_event_loop()
        try:
            asyncio.set_event_loop(loop)
            loop.run_until_complete(_execute_job_async(job_id))
        finally:
            loop.close()
    threading.Thread(target=_runner, daemon=True, name=f"extr-job-{job_id[:8]}").start()


async def _execute_job_async(job_id: str) -> None:
    """Async entry point. Runs the synchronous extraction in a thread so it
    doesn't block the event loop (the composer uses sync DB calls)."""
    try:
        await asyncio.to_thread(_execute_job_sync, job_id)
    except Exception as e:
        logger.exception(f"extraction job {job_id} crashed: {e}")
        try:
            db().table("extraction_jobs").update({
                "status": "failed",
                "error_message": f"runner crash: {type(e).__name__}: {e}",
                "last_error_at": _now(),
                "completed_at": _now(),
                "updated_at": _now(),
            }).eq("id", job_id).execute()
        except Exception:
            pass


def _execute_job_sync(job_id: str) -> None:
    """Synchronous job body. Reads config, transitions to running,
    iterates documents with continuous progress persistence, honours
    pause/cancel flags, and persists final state."""
    # Local import to avoid circular dependency at module load
    from routers import brand_catalog_sets as bcs
    from cultural_engine import product_composer, brand_index_builder

    c = db()
    job = get_job(job_id)
    if not job:
        logger.warning(f"job {job_id} not found"); return
    if job["status"] in ("completed", "cancelled", "failed"):
        logger.info(f"job {job_id} already terminal ({job['status']}), skipping"); return

    set_id    = job["catalog_set_id"]
    tenant_id = job["tenant_id"]
    config    = job.get("config_json") or {}
    max_cand  = int(config.get("max_candidates_per_doc") or 600)
    rebuild   = bool(config.get("rebuild_index", True))

    # Transition queued → running
    c.table("extraction_jobs").update({
        "status": "running", "started_at": job.get("started_at") or _now(),
        "heartbeat_at": _now(), "updated_at": _now(),
        "error_message": None,
    }).eq("id", job_id).execute()
    c.table("brand_catalog_sets").update({
        "status": "extracting",
        "extraction_started_at": _now(),
        "updated_at": _now(),
    }).eq("id", set_id).execute()

    sets = (c.table("brand_catalog_sets").select("*").eq("id", set_id)
            .eq("tenant_id", tenant_id).limit(1).execute().data or [])
    if not sets:
        _terminal(c, job_id, "failed", "Catalog set not found"); return
    cset = sets[0]
    brand_id = cset.get("brand_id")

    docs = (c.table("brand_catalog_documents").select("*")
            .eq("catalog_set_id", set_id).eq("tenant_id", tenant_id)
            .order("sort_order").execute().data or [])
    if not docs:
        _terminal(c, job_id, "completed", "No documents in set"); return

    admin = get_admin_client()

    for d in docs:
        # Re-fetch the job row to honour pause/cancel flags between docs.
        cur = get_job(job_id) or {}
        if cur.get("cancel_requested"):
            _terminal(c, job_id, "cancelled", "Cancellata dall'utente"); return
        if cur.get("pause_requested"):
            c.table("extraction_jobs").update({
                "status": "paused", "pause_requested": False,
                "heartbeat_at": _now(), "updated_at": _now(),
            }).eq("id", job_id).execute()
            logger.info(f"job {job_id} paused between documents"); return

        if d["extraction_status"] in ("review", "validated", "failed"):
            continue

        bcd_id = d["id"]
        src_doc_id = d["source_document_id"]

        # Persist "current document" pointer
        _persist_current(c, job_id,
                          current_document_id=bcd_id,
                          current_document_name=d.get("display_name") or d.get("original_filename"),
                          current_page=0, total_pages=d.get("page_count") or 0,
                          current_stage=None, current_stage_label=None)

        try:
            storage_path = d.get("storage_path") or (
                (c.table("source_documents").select("metadata_json")
                  .eq("id", src_doc_id).limit(1).execute().data or [{}])[0]
                .get("metadata_json") or {}
            ).get("storage_path")
            if not storage_path:
                raise RuntimeError("storage_path mancante")

            pdf_bytes = None
            for attempt in range(4):
                try:
                    pdf_bytes = admin.storage.from_(bcs.CATALOG_BUCKET).download(storage_path)
                    if pdf_bytes and len(pdf_bytes) >= 1024:
                        break
                except Exception as ex:
                    logger.warning(f"download attempt {attempt+1}: {ex}")
                time.sleep(1.5 * (attempt + 1))
            if not pdf_bytes or len(pdf_bytes) < 1024:
                raise RuntimeError("Download PDF fallito")

            c.table("brand_catalog_documents").update({
                "extraction_status": "extracting",
                "extraction_started_at": _now(),
                "updated_at": _now(),
            }).eq("id", bcd_id).execute()
            c.table("source_documents").update({
                "extraction_status": "extracting",
                "extraction_started_at": _now(),
                "updated_at": _now(),
            }).eq("id", src_doc_id).execute()

            asset_uploader = bcs._make_asset_uploader(c, admin, tenant_id, set_id, src_doc_id) \
                if hasattr(bcs, "_make_asset_uploader") \
                else _local_asset_uploader_fallback(c, admin, tenant_id, set_id, src_doc_id)

            stage_cb = _make_job_stage_cb(c, job_id, bcd_id, set_id, d.get("page_count") or 0)
            vision_cb = _make_job_vision_cb(c, job_id, bcd_id, set_id, d.get("page_count") or 0)

            result = product_composer.compose_products_from_pdf(
                pdf_bytes=pdf_bytes, source_document_id=src_doc_id,
                tenant_id=tenant_id, brand_id=brand_id,
                db_client=c, asset_uploader=asset_uploader,
                max_candidates=max_cand,
                log_step=stage_cb, vision_progress_cb=vision_cb,
            )

            # Page snapshots
            sections = (c.table("product_sections").select(
                "id,source_document_id,start_page,end_page,detected_title,"
                "detected_designer,detected_category,raw_text,confidence_score"
            ).eq("source_document_id", src_doc_id).execute().data or [])
            pages_written = brand_index_builder.write_page_snapshots(
                c, tenant_id=tenant_id, catalog_set_id=set_id,
                brand_id=brand_id, catalog_document_id=bcd_id,
                source_document_id=src_doc_id, page_count=d.get("page_count") or 0,
                sections=sections,
            )

            metrics_full = dict(result.get("metrics") or {})
            c.table("brand_catalog_documents").update({
                "extraction_status": "review",
                "extraction_completed_at": _now(),
                "pages_processed": pages_written,
                "metrics": metrics_full,
                "updated_at": _now(),
            }).eq("id", bcd_id).execute()
            c.table("source_documents").update({
                "extraction_status": "review",
                "extraction_completed_at": _now(),
                "metrics": metrics_full,
                "updated_at": _now(),
            }).eq("id", src_doc_id).execute()
            bcs._refresh_set_progress(c, set_id)
            _refresh_job_aggregates(c, job_id, set_id)

        except Exception as e:
            logger.exception(f"job {job_id} doc {bcd_id} failed: {e}")
            try:
                c.table("brand_catalog_documents").update({
                    "extraction_status": "failed",
                    "extraction_completed_at": _now(),
                    "error_logs": [{"error": str(e), "at": _now(),
                                     "job_id": job_id}],
                    "updated_at": _now(),
                }).eq("id", bcd_id).execute()
                c.table("source_documents").update({
                    "extraction_status": "failed",
                    "updated_at": _now(),
                }).eq("id", src_doc_id).execute()
            except Exception:
                pass
            bcs._refresh_set_progress(c, set_id)
            _refresh_job_aggregates(c, job_id, set_id)

    # Build unified index (best-effort)
    if rebuild:
        try:
            brand_index_builder.build_unified_index(
                c, tenant_id=tenant_id, catalog_set_id=set_id, brand_id=brand_id)
        except Exception as e:
            logger.exception(f"job {job_id} index build failed: {e}")

    # Final state
    c.table("brand_catalog_sets").update({
        "status": "needs_review",
        "extraction_completed_at": _now(),
        "updated_at": _now(),
    }).eq("id", set_id).execute()
    _terminal(c, job_id, "completed", None)


# ─── Helpers ──────────────────────────────────────────────────────────
def _terminal(c, job_id: str, status: str, message: Optional[str]) -> None:
    upd = {"status": status, "completed_at": _now(),
           "heartbeat_at": _now(), "updated_at": _now()}
    if message:
        upd["error_message"] = message
        upd["last_error_at"] = _now()
    c.table("extraction_jobs").update(upd).eq("id", job_id).execute()


def _persist_current(c, job_id: str, *,
                      current_document_id: Optional[str] = None,
                      current_document_name: Optional[str] = None,
                      current_page: int = 0,
                      total_pages: int = 0,
                      current_stage: Optional[str] = None,
                      current_stage_label: Optional[str] = None,
                      vision_current: Optional[int] = None,
                      vision_total: Optional[int] = None) -> None:
    upd: Dict[str, Any] = {
        "heartbeat_at": _now(),
        "updated_at": _now(),
    }
    if current_document_id is not None:    upd["current_document_id"] = current_document_id
    if current_document_name is not None:  upd["current_document_name"] = current_document_name
    upd["current_page"] = current_page
    if total_pages:                        upd["total_pages"] = total_pages
    if current_stage is not None:          upd["current_stage"] = current_stage
    if current_stage_label is not None:    upd["current_stage_label"] = current_stage_label
    if vision_current is not None:         upd["current_vision_current"] = vision_current
    if vision_total is not None:           upd["current_vision_total"] = vision_total
    try:
        c.table("extraction_jobs").update(upd).eq("id", job_id).execute()
    except Exception as e:
        logger.warning(f"persist_current {job_id}: {e}")


def _refresh_job_aggregates(c, job_id: str, set_id: str) -> None:
    """Recompute job-level counters from brand_catalog_documents."""
    docs = (c.table("brand_catalog_documents")
            .select("extraction_status,page_count,pages_processed")
            .eq("catalog_set_id", set_id).execute().data or [])
    total = len(docs)
    completed = sum(1 for d in docs if d["extraction_status"] in ("review","validated"))
    failed = sum(1 for d in docs if d["extraction_status"] == "failed")
    total_pages = sum(int(d.get("page_count") or 0) for d in docs)
    pages_done = sum(int(d.get("pages_processed") or 0) for d in docs)
    progress = round(100.0 * pages_done / total_pages, 2) if total_pages else 0.0
    try:
        c.table("extraction_jobs").update({
            "documents_total": total,
            "documents_completed": completed,
            "documents_failed": failed,
            "total_pages": total_pages,
            "processed_pages": pages_done,
            "progress_pct": progress,
            "heartbeat_at": _now(), "updated_at": _now(),
        }).eq("id", job_id).execute()
    except Exception as e:
        logger.warning(f"refresh_job_aggregates {job_id}: {e}")


_STAGE_LABEL = {
    "section_detection_start":    "Rilevamento sezioni…",
    "section_detection_done":     "Sezioni rilevate",
    "image_extraction_start":     "Estrazione immagini…",
    "image_extraction_done":      "Immagini estratte",
    "image_classification_start": "Classificazione immagini…",
    "image_classification_done":  "Immagini classificate",
    "vision_layer2_start":        "Analisi Vision Layer 2…",
    "vision_layer2":              "Analisi Vision Layer 2…",
    "vision_layer2_done":         "Vision Layer 2 completata",
    "vision_layer2_skipped":      "Vision saltata",
    "dedup_done":                 "Deduplicazione",
    "section_assignment_done":    "Asset assegnati alle sezioni",
    "product_composition_start":  "Composizione prodotti…",
    "product_composition_done":   "Prodotti composti",
}
_STAGE_PCT = {
    "section_detection_start": 0.02, "section_detection_done": 0.10,
    "image_extraction_start": 0.12,  "image_extraction_done": 0.25,
    "image_classification_start": 0.27, "image_classification_done": 0.40,
    "vision_layer2_start": 0.42, "vision_layer2_done": 0.85,
    "vision_layer2_skipped": 0.85, "dedup_done": 0.88,
    "section_assignment_done": 0.90,
    "product_composition_start": 0.92, "product_composition_done": 0.99,
}


def _make_job_stage_cb(c, job_id: str, bcd_id: str, set_id: str, page_count: int):
    last_pct = {"v": -1.0}
    def _cb(step: str, payload: Optional[Dict[str, Any]] = None):
        pct = _STAGE_PCT.get(step)
        if pct is None or page_count <= 0:
            return
        if pct <= last_pct["v"]:
            return
        last_pct["v"] = pct
        est = max(0, min(page_count, int(round(pct * page_count))))
        # Update job row (current_page + stage)
        _persist_current(c, job_id,
                          current_page=est, total_pages=page_count,
                          current_stage=step,
                          current_stage_label=_STAGE_LABEL.get(step))
        # Also keep brand_catalog_documents in sync (so the existing UI
        # panel works without any change)
        try:
            c.table("brand_catalog_documents").update({
                "pages_processed": est, "updated_at": _now(),
                "metrics": {"stage": step, "stage_pct": round(pct, 2),
                            "stage_at": _now(), "job_id": job_id},
            }).eq("id", bcd_id).execute()
        except Exception:
            pass
    return _cb


def _make_job_vision_cb(c, job_id: str, bcd_id: str, set_id: str, page_count: int):
    last_n = {"v": -1}
    def _cb(current: int, total: int):
        if total <= 0 or page_count <= 0: return
        if current - last_n["v"] < 5 and current < total: return
        last_n["v"] = current
        frac = current / max(total, 1)
        lo, hi = 0.42, 0.85
        pct = lo + (hi - lo) * frac
        est = max(0, min(page_count, int(round(pct * page_count))))
        _persist_current(c, job_id,
                          current_page=est, total_pages=page_count,
                          current_stage="vision_layer2",
                          current_stage_label=_STAGE_LABEL["vision_layer2"],
                          vision_current=current, vision_total=total)
        try:
            c.table("brand_catalog_documents").update({
                "pages_processed": est, "updated_at": _now(),
                "metrics": {"stage": "vision_layer2",
                            "stage_pct": round(pct, 3),
                            "vision_current": current, "vision_total": total,
                            "stage_at": _now(), "job_id": job_id},
            }).eq("id", bcd_id).execute()
        except Exception:
            pass
    return _cb


def _local_asset_uploader_fallback(c, admin, tenant_id, set_id, src_doc_id):
    """Inline copy of the asset uploader used by the legacy
    `_run_set_extraction`. Kept here so the job runner is self-contained."""
    from routers import brand_catalog_sets as bcs
    def uploader(image_bytes: bytes, filename: str):
        ext = filename.rsplit(".", 1)[-1].lower()
        ct = "image/jpeg" if ext in ("jpg", "jpeg") else "image/png"
        path = f"{tenant_id}/catalog-sets/{set_id}/{src_doc_id}/{filename}"
        try:
            pub = bcs._upload_bytes(bcs.ASSET_BUCKET, path, image_bytes, ct, private=False)
        except Exception as e:
            logger.warning(f"asset upload failed: {e}")
            return None, None
        media_id = str(uuid.uuid4())
        try:
            c.table("media_library").insert({
                "id": media_id, "tenant_id": tenant_id,
                "bucket": bcs.ASSET_BUCKET, "storage_path": path,
                "file_url": pub, "file_name": filename[:120],
                "file_type": ct, "file_size": len(image_bytes),
                "category": "brand_catalog_asset",
                "is_inspiration": False,
                "tags": ["brand_catalog_workspace"],
                "metadata_json": {"source_document_id": src_doc_id,
                                   "catalog_set_id": set_id},
                "created_at": _now(), "updated_at": _now(),
            }).execute()
        except Exception as e:
            logger.warning(f"media_library insert: {e}")
            return pub, None
        return pub, media_id
    return uploader
