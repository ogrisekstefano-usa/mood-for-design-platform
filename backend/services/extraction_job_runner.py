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
from services import extraction_event_publisher as events

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


# ─── Orphan recovery (called on FastAPI startup + every 60s scheduler) ─
def recover_orphan_jobs() -> int:
    """KE-001 · 3-phase orphan recovery.

    Phase A · running with stale heartbeat (> HEARTBEAT_STALE_AFTER_S)
             → demote to 'stalled' (sets stalled_at). Emits JOB_STALLED.
    Phase B · stalled with retry_count < MAX_RETRY_COUNT
             → re-queue (retry_count++) + spawn. Emits JOB_RECOVERED.
    Phase C · stalled with retry_count >= MAX_RETRY_COUNT
             → terminal 'failed' + reconcile brand_catalog_sets status.
               Emits JOB_FAILED with cause=max_retries.

    Additionally · safety net for catalog_sets in 'extracting' without
    any active job (legacy orphans, never persisted).

    Returns total jobs touched (demoted + requeued + terminated +
    safety-net catalog_sets reconciled).
    """
    c = db()
    threshold = (datetime.now(timezone.utc)
                 - timedelta(seconds=HEARTBEAT_STALE_AFTER_S)).isoformat()
    touched = 0

    # ── Phase A · running → stalled ──────────────────────────────────
    try:
        running_stale = (c.table("extraction_jobs")
                          .select("id,catalog_set_id,tenant_id,heartbeat_at")
                          .eq("status", "running")
                          .lt("heartbeat_at", threshold)
                          .execute().data or [])
    except Exception as ex:
        logger.warning(f"phase A query failed: {ex}")
        running_stale = []

    for j in running_stale:
        try:
            c.table("extraction_jobs").update({
                "status": "stalled",
                "stalled_at": _now(),
                "updated_at": _now(),
            }).eq("id", j["id"]).execute()
            events.emit(
                tenant_id=j["tenant_id"], catalog_set_id=j["catalog_set_id"],
                job_id=j["id"], kind=events.JOB_STALLED,
                message=f"Job demoted to stalled · last heartbeat {j['heartbeat_at']}",
                payload={"last_heartbeat_at": j["heartbeat_at"]},
            )
            logger.warning(f"phase A · job {j['id']} → stalled (last hb {j['heartbeat_at']})")
            touched += 1
        except Exception as ex:
            logger.warning(f"phase A · job {j['id']} demote failed: {ex}")

    # ── Phase B · stalled → queued (re-spawn) ────────────────────────
    try:
        stalled = (c.table("extraction_jobs")
                    .select("id,catalog_set_id,tenant_id,retry_count,heartbeat_at")
                    .eq("status", "stalled")
                    .execute().data or [])
    except Exception as ex:
        logger.warning(f"phase B query failed: {ex}")
        stalled = []

    for j in stalled:
        rc = int(j.get("retry_count") or 0)
        if rc >= MAX_RETRY_COUNT:
            # ── Phase C · max retries → terminal failed ──────────────
            try:
                c.table("extraction_jobs").update({
                    "status": "failed",
                    "error_message": f"Auto-terminate: exceeded {MAX_RETRY_COUNT} recovery attempts.",
                    "last_error_at": _now(),
                    "completed_at": _now(),
                    "updated_at": _now(),
                }).eq("id", j["id"]).execute()
                events.emit(
                    tenant_id=j["tenant_id"], catalog_set_id=j["catalog_set_id"],
                    job_id=j["id"], kind=events.JOB_FAILED,
                    message=f"Job auto-terminated after {MAX_RETRY_COUNT} retries.",
                    payload={"cause": "max_retries", "retry_count": rc},
                )
                # Reconcile brand_catalog_sets
                _reconcile_set_after_failure(c, j["catalog_set_id"], j["tenant_id"])
                logger.warning(f"phase C · job {j['id']} → failed (retries exceeded)")
                touched += 1
            except Exception as ex:
                logger.warning(f"phase C · job {j['id']} terminate failed: {ex}")
            continue

        # Re-queue + spawn
        try:
            c.table("extraction_jobs").update({
                "status": "queued",
                "retry_count": rc + 1,
                "pause_requested": False,
                "cancel_requested": False,
                "error_message": None,
                "heartbeat_at": _now(),
                "updated_at": _now(),
            }).eq("id", j["id"]).execute()
            _spawn_job(j["id"])
            events.emit(
                tenant_id=j["tenant_id"], catalog_set_id=j["catalog_set_id"],
                job_id=j["id"], kind=events.JOB_RECOVERED,
                message=f"Job auto-recovered (retry {rc + 1}/{MAX_RETRY_COUNT}).",
                payload={"retry_count": rc + 1, "max_retries": MAX_RETRY_COUNT},
            )
            logger.warning(f"phase B · job {j['id']} requeued (retry {rc + 1})")
            touched += 1
        except Exception as ex:
            logger.warning(f"phase B · job {j['id']} requeue failed: {ex}")

    # ── Safety net · catalog_sets stuck in 'extracting' with NO job ──
    # (legacy orphans from pre-KE-001 trigger or hard crashes that lost
    # the extraction_jobs row entirely)
    try:
        # Local import as a defensive measure against hot-reload races
        # where module-level `events` import may briefly disappear.
        from services import extraction_event_publisher as _ev
        five_min_ago = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        stuck_sets = (c.table("brand_catalog_sets")
                       .select("id,tenant_id,documents_extracted,documents_failed,document_count,updated_at")
                       .eq("status", "extracting")
                       .lt("updated_at", five_min_ago)
                       .execute().data or [])
        for cs in stuck_sets:
            # Has it an ACTIVE job?
            active = (c.table("extraction_jobs")
                       .select("id,status")
                       .eq("catalog_set_id", cs["id"])
                       .in_("status", ["queued", "running", "paused", "stalled"])
                       .limit(1).execute().data or [])
            if active:
                continue   # legitimate, will be handled by phases A/B/C
            # No active job → orphan catalog_set. Reconcile.
            _reconcile_set_after_failure(c, cs["id"], cs["tenant_id"])
            _ev.emit(
                tenant_id=cs["tenant_id"], catalog_set_id=cs["id"],
                kind=_ev.JOB_RECOVERED,
                message="Orphan catalog set reconciled · no active job, status reset.",
                payload={"safety_net": True,
                          "documents_extracted": cs.get("documents_extracted"),
                          "documents_failed": cs.get("documents_failed"),
                          "document_count": cs.get("document_count")},
            )
            logger.warning(f"safety net · catalog_set {cs['id']} reconciled")
            touched += 1
    except Exception as ex:
        logger.warning(f"safety net failed: {ex}")

    if touched:
        logger.warning(f"recover_orphan_jobs: touched {touched} job(s)/set(s)")
    return touched


def _reconcile_set_after_failure(c, set_id: str, tenant_id: str) -> None:
    """Transition a stuck 'extracting' catalog set to a sane terminal-ish
    state based on its progress."""
    cset = (c.table("brand_catalog_sets")
            .select("status,documents_extracted,documents_failed,document_count,pages_processed")
            .eq("id", set_id).eq("tenant_id", tenant_id)
            .limit(1).execute().data or [])
    if not cset:
        return
    s = cset[0]
    if s["status"] != "extracting":
        return  # already moved on
    de = int(s.get("documents_extracted") or 0)
    target = "needs_review" if de > 0 else "draft"
    c.table("brand_catalog_sets").update({
        "status": target,
        "extraction_completed_at": _now(),
        "updated_at": _now(),
    }).eq("id", set_id).execute()
    # Documents stuck in 'extracting' → mark them 'failed' so the retry
    # endpoint can pick them up.
    c.table("brand_catalog_documents").update({
        "extraction_status": "failed",
        "extraction_completed_at": _now(),
        "error_logs": [{"error": "Reconciled after worker crash · KE-001 safety net",
                         "at": _now()}],
        "updated_at": _now(),
    }).eq("catalog_set_id", set_id).eq("extraction_status", "extracting").execute()


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
            row = (db().table("extraction_jobs").select("tenant_id,catalog_set_id")
                    .eq("id", job_id).limit(1).execute().data or [])
            tid = row[0]["tenant_id"] if row else None
            sid = row[0]["catalog_set_id"] if row else None
            db().table("extraction_jobs").update({
                "status": "failed",
                "error_message": f"runner crash: {type(e).__name__}: {e}",
                "last_error_at": _now(),
                "completed_at": _now(),
                "updated_at": _now(),
            }).eq("id", job_id).execute()
            if tid and sid:
                events.emit(tenant_id=tid, catalog_set_id=sid, job_id=job_id,
                            kind=events.JOB_FAILED,
                            message=f"Runner crash: {type(e).__name__}: {str(e)[:200]}",
                            payload={"cause": "runner_crash"})
                _reconcile_set_after_failure(db(), sid, tid)
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
        "heartbeat_at": _now(), "last_seen_at": _now(),
        "last_activity_at": _now(), "worker_id": events.worker_id(),
        "updated_at": _now(), "error_message": None,
    }).eq("id", job_id).execute()
    events.emit(
        tenant_id=tenant_id, catalog_set_id=set_id, job_id=job_id,
        kind=events.JOB_STARTED, message="Extraction job started",
        payload={"config": config, "retry_count": int(job.get("retry_count") or 0)},
    )
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
        events.emit(
            tenant_id=tenant_id, catalog_set_id=set_id, job_id=job_id,
            catalog_document_id=bcd_id, kind=events.DOCUMENT_STARTED,
            message=f"Document started: {d.get('display_name') or d.get('original_filename')}",
            payload={"page_count": d.get("page_count") or 0,
                     "source_document_id": src_doc_id},
        )

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
            events.emit(
                tenant_id=tenant_id, catalog_set_id=set_id, job_id=job_id,
                catalog_document_id=bcd_id, kind=events.DOCUMENT_COMPLETED,
                message=f"Document completed: {d.get('display_name') or d.get('original_filename')}",
                payload={"pages_written": pages_written,
                          "products": int((result.get("metrics") or {}).get("products_count") or 0),
                          "images":   int((result.get("metrics") or {}).get("images_count") or 0)},
            )

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
            events.emit(
                tenant_id=tenant_id, catalog_set_id=set_id, job_id=job_id,
                catalog_document_id=bcd_id, kind=events.DOCUMENT_FAILED,
                message=f"Document failed: {str(e)[:200]}",
                payload={"error": str(e)[:400]},
            )

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
    events.emit(
        tenant_id=tenant_id, catalog_set_id=set_id, job_id=job_id,
        kind=events.JOB_COMPLETED, message="Extraction job completed",
    )


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
        "last_seen_at": _now(),
        "last_activity_at": _now(),
        "worker_id": events.worker_id(),
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
    # ETA · linear projection from job started_at + processed_pages
    try:
        job_row = (c.table("extraction_jobs")
                    .select("started_at,total_pages,processed_pages")
                    .eq("id", job_id).limit(1).execute().data or [])
        if job_row:
            jr = job_row[0]
            started = jr.get("started_at")
            tot = int(jr.get("total_pages") or 0)
            done = int(jr.get("processed_pages") or 0)
            if started and tot > 0 and done > 0:
                t_start = datetime.fromisoformat(started.replace("Z", "+00:00"))
                if t_start.tzinfo is None:
                    t_start = t_start.replace(tzinfo=timezone.utc)
                elapsed = (datetime.now(timezone.utc) - t_start).total_seconds()
                if elapsed > 5:
                    pps = done / elapsed
                    if pps > 0:
                        upd["estimated_remaining_seconds"] = max(0, int((tot - done) / pps))
    except Exception:
        pass
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
