"""Brand Import Sessions™ router — Phase 1 Founding Brands (ITER192).

Endpoints (mounted under /api/inspirations/knowledge-factory):

  POST   /sessions                                  · create new import session
  GET    /sessions                                  · list sessions
  GET    /sessions/{id}                             · session detail + dashboard
  POST   /sessions/{id}/documents                   · multi-PDF upload (up to 50)
  POST   /sessions/{id}/process                     · background process all docs
  GET    /sessions/{id}/dashboard                   · founding brands dashboard tile
  GET    /sessions/{id}/knowledge-graph             · hierarchical knowledge graph
  DELETE /sessions/{id}                             · archive session

Design:
  • Tenant-scoped
  • Background pipeline launches per-PDF Product Composer™ runs
  • After all docs complete → entity resolution → package score → status='completed'
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from core.tenant_context import get_tenant_context
from cultural_engine import product_composer
from cultural_engine import entity_resolver
from cultural_engine import package_scorer
from database import db, get_admin_client

logger = logging.getLogger(__name__)
router = APIRouter()

CATALOG_BUCKET = "catalog-sources"
ASSET_BUCKET = "cms-assets"
MAX_PDFS_PER_REQUEST = 50


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slim(row: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not row:
        return {}
    return {k: v for k, v in row.items() if k != "_id"}


def _public_url(bucket: str, path: str, *, private: bool = False) -> str:
    admin = get_admin_client()
    if admin is None:
        raise HTTPException(500, "Storage non disponibile.")
    if private:
        signed = admin.storage.from_(bucket).create_signed_url(path, 60 * 60 * 24 * 365)
        url = (signed.get("signedURL") or signed.get("signed_url") or signed.get("signedUrl")) \
              if isinstance(signed, dict) else signed
    else:
        info = admin.storage.from_(bucket).get_public_url(path)
        url = info.get("publicURL") or info.get("publicUrl") if isinstance(info, dict) else info
    if not isinstance(url, str):
        raise HTTPException(500, "Public URL non disponibile.")
    return url.rstrip("?")


def _upload_bytes(bucket: str, path: str, content: bytes,
                  content_type: str, private: bool = False) -> str:
    admin = get_admin_client()
    if admin is None:
        raise HTTPException(500, "Storage non disponibile.")
    try:
        admin.storage.from_(bucket).upload(
            path, content,
            {"content-type": content_type, "x-upsert": "true"},
        )
    except Exception as e:
        raise HTTPException(500, f"Upload fallito: {e}")
    return _public_url(bucket, path, private=private)


# ─── Pydantic models ──────────────────────────────────────────────────
class CreateSessionBody(BaseModel):
    brand_id:     Optional[str] = None
    session_name: str
    metadata:     Optional[Dict[str, Any]] = None


class ProcessSessionBody(BaseModel):
    max_candidates_per_doc: Optional[int] = 800


# ─── Helpers ──────────────────────────────────────────────────────────
def _require_session(c, tid: str, sid: str) -> Dict[str, Any]:
    rows = (c.table("brand_import_sessions").select("*")
            .eq("id", sid).eq("tenant_id", tid).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Sessione non trovata")
    return rows[0]


def _append_log(c, sid: str, entry: Dict[str, Any]) -> None:
    try:
        cur = (c.table("brand_import_sessions").select("processing_logs")
               .eq("id", sid).limit(1).execute().data or [])
        logs = (cur[0].get("processing_logs") if cur else []) or []
        logs.append({**entry, "at": _now()})
        c.table("brand_import_sessions").update({
            "processing_logs": logs, "updated_at": _now(),
        }).eq("id", sid).execute()
    except Exception as e:
        logger.warning(f"append_log session {sid} failed: {e}")


# ─── Background pipeline ──────────────────────────────────────────────
def _run_session_pipeline(session_id: str, tenant_id: str,
                           max_candidates: int = 800) -> None:
    """Run Product Composer™ on every source_document in the session,
    then trigger entity resolution + package scoring.
    """
    c = db()
    if c is None:
        return

    sess_rows = (c.table("brand_import_sessions").select("*")
                 .eq("id", session_id).eq("tenant_id", tenant_id).limit(1).execute().data or [])
    if not sess_rows:
        return
    sess = sess_rows[0]
    brand_id = sess.get("brand_id")

    docs = (c.table("source_documents").select("id,original_filename,extraction_status,metadata_json,brand_id")
            .eq("brand_import_session_id", session_id)
            .eq("tenant_id", tenant_id).execute().data or [])
    if not docs:
        c.table("brand_import_sessions").update({
            "status": "failed", "updated_at": _now(),
        }).eq("id", session_id).execute()
        _append_log(c, session_id, {"step": "no_documents"})
        return

    c.table("brand_import_sessions").update({
        "status": "processing",
        "processing_started_at": _now(),
        "document_count": len(docs),
        "documents_processed": 0,
        "documents_failed": 0,
        "updated_at": _now(),
    }).eq("id", session_id).execute()
    _append_log(c, session_id, {"step": "pipeline_start", "doc_count": len(docs)})

    admin = get_admin_client()
    processed = failed = 0
    vision_total_hits = vision_total_miss = 0

    for doc in docs:
        try:
            if doc["extraction_status"] == "approved":
                processed += 1
                continue
            meta = doc.get("metadata_json") or {}
            storage_path = meta.get("storage_path")
            if not storage_path:
                raise RuntimeError(f"storage_path mancante per {doc['original_filename']}")
            # ── Retry storage download (transient connection errors) ──
            pdf_bytes = None
            last_err = None
            for attempt in range(4):
                try:
                    pdf_bytes = admin.storage.from_(CATALOG_BUCKET).download(storage_path)
                    if pdf_bytes and len(pdf_bytes) >= 1024:
                        break
                except Exception as e:
                    last_err = e
                    logger.warning(f"PDF download attempt {attempt+1} failed: {e}")
                import time as _time
                _time.sleep(1.5 * (attempt + 1))
            if not pdf_bytes or len(pdf_bytes) < 1024:
                raise RuntimeError(f"Download PDF fallito dopo 4 retry: {last_err}")

            c.table("source_documents").update({
                "extraction_status": "extracting",
                "extraction_started_at": _now(),
                "updated_at": _now(),
            }).eq("id", doc["id"]).execute()

            def asset_uploader(image_bytes: bytes, filename: str, _doc_id=doc["id"]):
                ext = filename.rsplit(".", 1)[-1].lower()
                content_type = "image/jpeg" if ext in ("jpg", "jpeg") else "image/png"
                path = f"{tenant_id}/knowledge-factory/sessions/{session_id}/{_doc_id}/{filename}"
                try:
                    pub = _upload_bytes(ASSET_BUCKET, path, image_bytes, content_type, private=False)
                except Exception as e:
                    logger.warning(f"asset_uploader failed: {e}")
                    return None, None
                media_id = str(uuid.uuid4())
                try:
                    c.table("media_library").insert({
                        "id": media_id, "tenant_id": tenant_id,
                        "bucket": ASSET_BUCKET, "storage_path": path,
                        "file_url": pub, "file_name": filename[:120],
                        "file_type": content_type, "file_size": len(image_bytes),
                        "category": "knowledge_factory_asset",
                        "is_inspiration": False,
                        "tags": ["knowledge_factory", "founding_brands"],
                        "metadata_json": {
                            "source_document_id": _doc_id,
                            "brand_import_session_id": session_id,
                        },
                        "created_at": _now(), "updated_at": _now(),
                    }).execute()
                except Exception as e:
                    logger.warning(f"media_library insert failed: {e}")
                    return pub, None
                return pub, media_id

            session_logs: List[Dict[str, Any]] = []

            def log_step(step_name, payload):
                session_logs.append({"step": step_name, "doc": doc["id"], **(payload or {})})
                if step_name == "vision_layer2_done":
                    nonlocal_dict["hits"] += int((payload or {}).get("cache_hits") or 0)
                    nonlocal_dict["miss"] += int((payload or {}).get("cache_misses") or 0)

            nonlocal_dict = {"hits": 0, "miss": 0}

            result = product_composer.compose_products_from_pdf(
                pdf_bytes=pdf_bytes, source_document_id=doc["id"],
                tenant_id=tenant_id, brand_id=brand_id or doc.get("brand_id"),
                db_client=c, asset_uploader=asset_uploader,
                max_candidates=max_candidates, log_step=log_step,
            )

            # Tag products with session
            for pid in result.get("products_created", []):
                c.table("products").update({
                    "brand_import_session_id": session_id,
                    "updated_at": _now(),
                }).eq("id", pid).execute()

            c.table("source_documents").update({
                "extraction_status": "review",
                "extraction_completed_at": _now(),
                "metrics": result["metrics"],
                "updated_at": _now(),
            }).eq("id", doc["id"]).execute()
            processed += 1
            vision_total_hits += nonlocal_dict["hits"]
            vision_total_miss += nonlocal_dict["miss"]
            _append_log(c, session_id, {
                "step": "doc_done", "doc_id": doc["id"],
                "products": result["metrics"].get("products_created", 0),
                "vision_hits": nonlocal_dict["hits"],
                "vision_misses": nonlocal_dict["miss"],
            })
        except Exception as e:
            logger.exception(f"doc {doc['id']} failed: {e}")
            failed += 1
            c.table("source_documents").update({
                "extraction_status": "failed",
                "extraction_completed_at": _now(),
                "error_logs": [{"error": str(e), "at": _now()}],
                "updated_at": _now(),
            }).eq("id", doc["id"]).execute()
            _append_log(c, session_id, {"step": "doc_failed", "doc_id": doc["id"], "error": str(e)})

        c.table("brand_import_sessions").update({
            "documents_processed": processed,
            "documents_failed": failed,
            "updated_at": _now(),
        }).eq("id", session_id).execute()

    # ── Entity resolution pass ──
    _append_log(c, session_id, {"step": "entity_resolution_start"})
    try:
        resolution_counts = entity_resolver.resolve_session_entities(
            c, tenant_id=tenant_id, brand_id=brand_id,
            brand_import_session_id=session_id,
        )
    except Exception as e:
        logger.exception(f"entity resolution failed: {e}")
        resolution_counts = {"error": str(e)}
    _append_log(c, session_id, {"step": "entity_resolution_done", **resolution_counts})

    # ── Package score ──
    try:
        package_score = package_scorer.compute_package_score(
            c, tenant_id=tenant_id, brand_id=brand_id,
            brand_import_session_id=session_id,
        )
    except Exception as e:
        logger.exception(f"package score failed: {e}")
        package_score = {"error": str(e)}

    # ── Knowledge package assembly (denormalized for fast dashboard) ──
    try:
        knowledge_package = _assemble_knowledge_package(
            c, tenant_id, brand_id, session_id,
        )
    except Exception as e:
        logger.exception(f"package assembly failed: {e}")
        knowledge_package = {"error": str(e)}

    # ── Final state ──
    final_status = "completed" if failed == 0 else "completed"  # both partial+full = completed
    c.table("brand_import_sessions").update({
        "status": final_status,
        "processing_completed_at": _now(),
        "metrics": {
            **(package_score.get("_counts") or {}),
            "vision_cache_hits": vision_total_hits,
            "vision_cache_misses": vision_total_miss,
            "documents_processed": processed,
            "documents_failed": failed,
            "resolution": resolution_counts,
        },
        "package_score": {k: v for k, v in package_score.items() if k != "_counts"},
        "knowledge_package": knowledge_package,
        "updated_at": _now(),
    }).eq("id", session_id).execute()
    _append_log(c, session_id, {
        "step": "pipeline_done",
        "overall_score": (package_score or {}).get("overall"),
        "products": processed,
    })


def _assemble_knowledge_package(c, tenant_id, brand_id, session_id) -> Dict[str, Any]:
    """Build the denormalized knowledge_package JSONB stored on the session."""
    products = (c.table("products")
                .select("id,product_name,designer_name,category_label,review_status,"
                        "confidence_score,spec_ready,academy_ready,content_ready,"
                        "source_document_id,canonical_designer_id,canonical_collection_id")
                .eq("tenant_id", tenant_id)
                .eq("brand_import_session_id", session_id)
                .execute().data or [])

    def _brand_eq(q):
        return q.eq("brand_id", brand_id) if brand_id else q.is_("brand_id", "null")

    materials = _brand_eq(c.table("materials_canonical")
                          .select("id,material_key,display_name,mention_count,source_document_ids")
                          .eq("tenant_id", tenant_id)).execute().data or []
    designers = (c.table("designers_canonical")
                 .select("id,designer_key,display_name,product_count,mention_count")
                 .eq("tenant_id", tenant_id).execute().data or [])
    collections = _brand_eq(c.table("collections_canonical")
                            .select("id,collection_key,display_name,product_count")
                            .eq("tenant_id", tenant_id)).execute().data or []
    stories = _brand_eq(c.table("stories_canonical")
                        .select("id,theme,title,evidence,source_document_ids")
                        .eq("tenant_id", tenant_id)).execute().data or []

    return {
        "counts": {
            "products":    len(products),
            "materials":   len(materials),
            "designers":   len(designers),
            "collections": len(collections),
            "stories":     len(stories),
        },
        "products":    [_slim(p) for p in products[:200]],
        "materials":   [_slim(m) for m in materials],
        "designers":   [_slim(d) for d in designers],
        "collections": [_slim(co) for co in collections],
        "stories":     [_slim(s) for s in stories],
    }


# ─── ENDPOINTS ────────────────────────────────────────────────────────
@router.post("/sessions", status_code=201)
def create_session(body: CreateSessionBody, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    sid = str(uuid.uuid4())
    row = {
        "id": sid,
        "tenant_id": tid,
        "brand_id": body.brand_id,
        "session_name": (body.session_name or "Untitled Session").strip()[:120],
        "status": "open",
        "metadata_json": body.metadata or {},
        "created_by": ctx.get("profile_id"),
        "created_at": _now(),
        "updated_at": _now(),
    }
    c.table("brand_import_sessions").insert(row).execute()
    full = (c.table("brand_import_sessions").select("*")
            .eq("id", sid).limit(1).execute().data or [])
    return _slim(full[0] if full else row)


@router.get("/sessions")
def list_sessions(brand_id: Optional[str] = None, status: Optional[str] = None,
                   limit: int = 50, ctx=Depends(get_tenant_context)):
    c = db()
    q = (c.table("brand_import_sessions")
         .select("id,brand_id,session_name,status,document_count,documents_processed,"
                 "documents_failed,metrics,package_score,created_at,updated_at")
         .eq("tenant_id", ctx["tenant_id"])
         .order("created_at", desc=True).limit(min(200, max(1, limit))))
    if brand_id:
        q = q.eq("brand_id", brand_id)
    if status:
        q = q.eq("status", status)
    rows = q.execute().data or []
    return {"sessions": [_slim(r) for r in rows], "total": len(rows)}


@router.get("/sessions/{session_id}")
def get_session(session_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    sess = _require_session(c, tid, session_id)
    docs = (c.table("source_documents")
            .select("id,original_filename,extraction_status,page_count,metrics,created_at")
            .eq("brand_import_session_id", session_id)
            .eq("tenant_id", tid).execute().data or [])
    return {
        "session": _slim(sess),
        "documents": [_slim(d) for d in docs],
    }


@router.post("/sessions/{session_id}/documents", status_code=201)
async def upload_documents(
    session_id: str,
    files: List[UploadFile] = File(...),
    ctx=Depends(get_tenant_context),
):
    if len(files) > MAX_PDFS_PER_REQUEST:
        raise HTTPException(400, f"Massimo {MAX_PDFS_PER_REQUEST} PDF per richiesta")
    c = db()
    tid = ctx["tenant_id"]
    sess = _require_session(c, tid, session_id)
    if sess["status"] == "processing":
        raise HTTPException(409, "Sessione in processing — attendere completamento")

    uploaded: List[Dict[str, Any]] = []
    for f in files:
        if not f.content_type or "pdf" not in f.content_type.lower():
            uploaded.append({"file": f.filename, "ok": False, "error": "not_pdf"})
            continue
        content = await f.read()
        if len(content) < 1024:
            uploaded.append({"file": f.filename, "ok": False, "error": "too_small"})
            continue
        doc_id = str(uuid.uuid4())
        path = f"{tid}/knowledge-factory/sessions/{session_id}/{doc_id}/source.pdf"
        try:
            pdf_url = _upload_bytes(CATALOG_BUCKET, path, content,
                                     "application/pdf", private=True)
        except HTTPException as e:
            uploaded.append({"file": f.filename, "ok": False, "error": str(e.detail)})
            continue
        page_count = None
        try:
            import fitz
            tmp = fitz.open(stream=content, filetype="pdf")
            page_count = tmp.page_count
            tmp.close()
        except Exception:
            pass

        c.table("source_documents").insert({
            "id": doc_id, "tenant_id": tid,
            "brand_id": sess.get("brand_id"),
            "brand_import_session_id": session_id,
            "original_filename": (f.filename or "catalog.pdf")[:200],
            "document_type": "catalog",
            "page_count": page_count,
            "extraction_status": "pending",
            "processing_logs": [], "error_logs": [], "metrics": {},
            "metadata_json": {"storage_path": path, "pdf_url": pdf_url,
                              "file_size": len(content)},
            "created_by": ctx.get("profile_id"),
            "created_at": _now(), "updated_at": _now(),
        }).execute()
        uploaded.append({"file": f.filename, "ok": True, "document_id": doc_id,
                         "page_count": page_count})

    # Update session document_count
    ok_count = sum(1 for u in uploaded if u["ok"])
    c.table("brand_import_sessions").update({
        "document_count": (sess.get("document_count") or 0) + ok_count,
        "updated_at": _now(),
    }).eq("id", session_id).execute()

    return {"session_id": session_id, "uploaded": uploaded,
            "ok_count": ok_count, "failed_count": len(uploaded) - ok_count}


@router.post("/sessions/{session_id}/process")
def process_session(session_id: str, body: ProcessSessionBody,
                     background_tasks: BackgroundTasks,
                     ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    sess = _require_session(c, tid, session_id)
    if sess["status"] == "processing":
        raise HTTPException(409, "Sessione già in processing")
    if (sess.get("document_count") or 0) == 0:
        raise HTTPException(400, "Nessun documento caricato in questa sessione")
    background_tasks.add_task(_run_session_pipeline, session_id, tid,
                               body.max_candidates_per_doc or 800)
    return {"status": "queued", "session_id": session_id}


@router.get("/sessions/{session_id}/dashboard")
def session_dashboard(session_id: str, ctx=Depends(get_tenant_context)):
    """Single-query dashboard tile (denormalized JSONB)."""
    c = db()
    sess = _require_session(c, ctx["tenant_id"], session_id)
    pkg = sess.get("knowledge_package") or {}
    return {
        "session_id":           sess["id"],
        "brand_id":             sess.get("brand_id"),
        "session_name":         sess.get("session_name"),
        "status":               sess.get("status"),
        "document_count":       sess.get("document_count"),
        "documents_processed":  sess.get("documents_processed"),
        "documents_failed":     sess.get("documents_failed"),
        "metrics":              sess.get("metrics"),
        "package_score":        sess.get("package_score"),
        "counts":               pkg.get("counts") or {},
        "processing_started_at":  sess.get("processing_started_at"),
        "processing_completed_at": sess.get("processing_completed_at"),
    }


@router.get("/sessions/{session_id}/knowledge-graph")
def session_knowledge_graph(session_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    sess = _require_session(c, ctx["tenant_id"], session_id)
    pkg = sess.get("knowledge_package") or {}
    return {
        "brand_import_session_id": session_id,
        "brand_id":  sess.get("brand_id"),
        "counts":    pkg.get("counts") or {},
        "tree": {
            "materials":    pkg.get("materials") or [],
            "designers":    pkg.get("designers") or [],
            "collections":  pkg.get("collections") or [],
            "products":     pkg.get("products") or [],
            "stories":      pkg.get("stories") or [],
        },
    }


@router.delete("/sessions/{session_id}")
def archive_session(session_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _require_session(c, tid, session_id)
    c.table("brand_import_sessions").update({
        "status": "archived", "updated_at": _now(),
    }).eq("id", session_id).eq("tenant_id", tid).execute()
    return {"session_id": session_id, "status": "archived"}
