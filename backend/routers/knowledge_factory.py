"""Knowledge Factory™ — Product Composer router.

Endpoints (mounted under /api/inspirations):

  POST   /inspirations/knowledge-factory/documents
           Upload a PDF + register a source_document row (status='pending')

  POST   /inspirations/knowledge-factory/documents/{doc_id}/process
           Run the full Product Composer pipeline as a background task

  GET    /inspirations/knowledge-factory/documents
           List source_documents for the tenant (filters: status, brand)

  GET    /inspirations/knowledge-factory/documents/{doc_id}
           Detail: doc + sections + product summaries + logs

  GET    /inspirations/knowledge-factory/products
           List products (filters: review_status, brand_id, source_document_id)

  GET    /inspirations/knowledge-factory/products/{product_id}
           Detail: product + assets grouped by role

  PATCH  /inspirations/knowledge-factory/products/{product_id}
           Update editable fields

  POST   /inspirations/knowledge-factory/products/{product_id}/approve
           review_status='approved'

  POST   /inspirations/knowledge-factory/products/{product_id}/reject
           review_status='rejected' + reason

  POST   /inspirations/knowledge-factory/products/{product_id}/merge
           Merge into another product

  PATCH  /inspirations/knowledge-factory/products/{product_id}/assets/{pa_id}
           Update role / sort_order / is_primary

  DELETE /inspirations/knowledge-factory/products/{product_id}/assets/{pa_id}
           Unlink asset from product

Design principles:
  • All rows are tenant-scoped (Phase 1: NO curated_public promotion)
  • Pipeline runs as FastAPI BackgroundTask — status streams through
    source_documents.processing_logs
  • Product Knowledge Object™ flags (spec_ready/academy_ready/content_ready)
    are recomputed on every PATCH
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from core.tenant_context import get_tenant_context
from cultural_engine import product_composer
from database import db, get_admin_client

logger = logging.getLogger(__name__)
router = APIRouter()

CATALOG_BUCKET = "catalog-sources"
ASSET_BUCKET = "cms-assets"


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
class ProcessDocumentBody(BaseModel):
    max_candidates: Optional[int] = 240


class ProductPatch(BaseModel):
    product_name:           Optional[str] = None
    designer_name:          Optional[str] = None
    category_label:         Optional[str] = None
    description:            Optional[str] = None
    description_i18n:       Optional[Dict[str, str]] = None
    materials:              Optional[List[str]] = None
    finishes:               Optional[List[str]] = None
    dimensions_raw:         Optional[List[str]] = None
    dimensions_structured:  Optional[Dict[str, Any]] = None
    applications:           Optional[List[str]] = None
    usage_contexts:         Optional[List[str]] = None
    suggested_applications: Optional[List[str]] = None
    mood_tags:              Optional[List[str]] = None
    market_tags:            Optional[List[str]] = None


class RejectBody(BaseModel):
    reason: Optional[str] = None


class MergeBody(BaseModel):
    target_product_id: str


class AssetPatch(BaseModel):
    role:       Optional[str] = None
    is_primary: Optional[bool] = None
    sort_order: Optional[int] = None


VALID_ASSET_ROLES = {
    "hero", "ambient", "still_life", "detail", "texture", "technical",
    "finish", "drawing", "packshot", "logo", "decorative",
}


# ─── Helpers ──────────────────────────────────────────────────────────
def _require_document(c, tid: str, doc_id: str) -> Dict[str, Any]:
    rows = (c.table("source_documents").select("*")
            .eq("id", doc_id).eq("tenant_id", tid).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Documento non trovato")
    return rows[0]


def _require_product(c, tid: str, pid: str) -> Dict[str, Any]:
    rows = (c.table("products").select("*")
            .eq("id", pid).eq("tenant_id", tid).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Prodotto non trovato")
    return rows[0]


def _append_log(c, doc_id: str, entry: Dict[str, Any]) -> None:
    """Best-effort append to processing_logs."""
    try:
        cur = (c.table("source_documents").select("processing_logs")
               .eq("id", doc_id).limit(1).execute().data or [])
        logs = (cur[0].get("processing_logs") if cur else []) or []
        logs.append({**entry, "at": _now()})
        c.table("source_documents").update({
            "processing_logs": logs, "updated_at": _now(),
        }).eq("id", doc_id).execute()
    except Exception as e:
        logger.warning(f"append_log failed for {doc_id}: {e}")


def _recompute_knowledge_flags(c, product_id: str) -> Dict[str, bool]:
    """Recompute spec_ready / academy_ready / content_ready after a patch."""
    rows = (c.table("products").select("*").eq("id", product_id).limit(1).execute().data or [])
    if not rows:
        return {}
    p = rows[0]
    pa = (c.table("product_assets").select("role").eq("product_id", product_id).execute().data or [])
    role_counts: Dict[str, int] = {}
    for r in pa:
        role_counts[r["role"]] = role_counts.get(r["role"], 0) + 1
    has_designer = bool(p.get("designer_name"))
    has_materials = bool(p.get("materials"))
    has_dims = bool(p.get("dimensions_raw"))
    has_desc = bool(p.get("description") and len(p.get("description") or "") > 80)
    spec_ready = has_designer and has_dims and has_materials
    academy_ready = has_desc and has_designer and \
        (role_counts.get("ambient", 0) + role_counts.get("hero", 0)) >= 1
    content_ready = has_desc and role_counts.get("hero", 0) >= 1
    update = {"spec_ready": spec_ready, "academy_ready": academy_ready,
              "content_ready": content_ready, "updated_at": _now()}
    c.table("products").update(update).eq("id", product_id).execute()
    return {"spec_ready": spec_ready, "academy_ready": academy_ready, "content_ready": content_ready}


# ─── Pipeline background task ─────────────────────────────────────────
def _run_pipeline(doc_id: str, tenant_id: str, max_candidates: int = 240) -> None:
    """Background worker: fetch PDF bytes, run product_composer, persist
    results back to source_documents.
    """
    c = db()
    if c is None:
        return
    try:
        doc_rows = (c.table("source_documents").select("*")
                    .eq("id", doc_id).eq("tenant_id", tenant_id).limit(1).execute().data or [])
        if not doc_rows:
            logger.warning(f"_run_pipeline: doc {doc_id} not found")
            return
        doc = doc_rows[0]

        # Set extracting status
        c.table("source_documents").update({
            "extraction_status": "extracting",
            "extraction_started_at": _now(),
            "updated_at": _now(),
        }).eq("id", doc_id).execute()
        _append_log(c, doc_id, {"step": "pipeline_start"})

        # Fetch PDF bytes from storage
        admin = get_admin_client()
        meta = doc.get("metadata_json") or {}
        storage_path = meta.get("storage_path")
        if not storage_path:
            raise RuntimeError("storage_path mancante in metadata_json")
        try:
            pdf_bytes = admin.storage.from_(CATALOG_BUCKET).download(storage_path)
        except Exception as e:
            raise RuntimeError(f"Download PDF fallito: {e}")
        if not pdf_bytes or len(pdf_bytes) < 1024:
            raise RuntimeError("PDF scaricato è vuoto / troppo piccolo")

        # Define asset uploader closure
        def asset_uploader(image_bytes: bytes, filename: str):
            ext = filename.rsplit(".", 1)[-1].lower()
            content_type = "image/jpeg" if ext in ("jpg", "jpeg") else "image/png"
            path = f"{tenant_id}/knowledge-factory/{doc_id}/{filename}"
            try:
                public_url = _upload_bytes(ASSET_BUCKET, path, image_bytes, content_type, private=False)
            except Exception as e:
                logger.warning(f"asset_uploader failed for {filename}: {e}")
                return None, None
            # Register in media_library so the M2M can resolve it
            media_id = str(uuid.uuid4())
            try:
                c.table("media_library").insert({
                    "id": media_id,
                    "tenant_id": tenant_id,
                    "bucket": ASSET_BUCKET,
                    "storage_path": path,
                    "file_url": public_url,
                    "file_name": filename[:120],
                    "file_type": content_type,
                    "file_size": len(image_bytes),
                    "category": "knowledge_factory_asset",
                    "is_inspiration": False,
                    "tags": ["knowledge_factory"],
                    "metadata_json": {
                        "source_document_id": doc_id,
                    },
                    "created_at": _now(),
                    "updated_at": _now(),
                }).execute()
            except Exception as e:
                logger.warning(f"media_library insert failed: {e}")
                return public_url, None
            return public_url, media_id

        # Stream logs into the document
        def log_step(step_name, payload):
            _append_log(c, doc_id, {"step": step_name, **(payload or {})})

        result = product_composer.compose_products_from_pdf(
            pdf_bytes=pdf_bytes,
            source_document_id=doc_id,
            tenant_id=tenant_id,
            brand_id=doc.get("brand_id"),
            db_client=c,
            asset_uploader=asset_uploader,
            max_candidates=max_candidates,
            log_step=log_step,
        )

        # Persist final metrics
        c.table("source_documents").update({
            "extraction_status": "review",
            "extraction_completed_at": _now(),
            "metrics": result["metrics"],
            "updated_at": _now(),
        }).eq("id", doc_id).execute()
        _append_log(c, doc_id, {"step": "pipeline_done", **result["metrics"]})

    except Exception as e:
        logger.exception(f"Knowledge Factory pipeline failed for {doc_id}: {e}")
        try:
            cur = (c.table("source_documents").select("error_logs")
                   .eq("id", doc_id).limit(1).execute().data or [])
            err_logs = (cur[0].get("error_logs") if cur else []) or []
            err_logs.append({"error": str(e), "at": _now()})
            c.table("source_documents").update({
                "extraction_status": "failed",
                "extraction_completed_at": _now(),
                "error_logs": err_logs,
                "updated_at": _now(),
            }).eq("id", doc_id).execute()
        except Exception:
            pass


# ─── Endpoints · documents ────────────────────────────────────────────
@router.post("/knowledge-factory/documents", status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    brand_id: Optional[str] = Form(None),
    supplier_catalog_id: Optional[str] = Form(None),
    document_type: Optional[str] = Form("catalog"),
    ctx=Depends(get_tenant_context),
):
    """Upload a PDF + register a source_documents row (status='pending').
    Does NOT auto-run the pipeline — call /process to start.
    """
    if not file.content_type or "pdf" not in file.content_type.lower():
        raise HTTPException(400, "Atteso un file PDF")
    content = await file.read()
    if len(content) < 1024:
        raise HTTPException(400, "PDF troppo piccolo / vuoto")

    c = db()
    tid = ctx["tenant_id"]
    doc_id = str(uuid.uuid4())

    storage_path = f"{tid}/knowledge-factory/{doc_id}/source.pdf"
    pdf_url = _upload_bytes(CATALOG_BUCKET, storage_path, content,
                            "application/pdf", private=True)

    # Best-effort PyMuPDF page count
    page_count = None
    try:
        import fitz
        doc_tmp = fitz.open(stream=content, filetype="pdf")
        page_count = doc_tmp.page_count
        doc_tmp.close()
    except Exception:
        pass

    row = {
        "id": doc_id,
        "tenant_id": tid,
        "brand_id": brand_id,
        "supplier_catalog_id": supplier_catalog_id,
        "original_filename": (file.filename or "catalog.pdf")[:200],
        "document_type": document_type or "catalog",
        "page_count": page_count,
        "extraction_status": "pending",
        "processing_logs": [],
        "error_logs": [],
        "metrics": {},
        "metadata_json": {
            "storage_path": storage_path,
            "pdf_url": pdf_url,
            "file_size": len(content),
        },
        "created_by": ctx.get("profile_id"),
        "created_at": _now(),
        "updated_at": _now(),
    }
    c.table("source_documents").insert(row).execute()
    return _slim(row)


@router.post("/knowledge-factory/documents/{doc_id}/process")
def process_document(doc_id: str, body: ProcessDocumentBody,
                     background_tasks: BackgroundTasks,
                     ctx=Depends(get_tenant_context)):
    """Trigger the full Product Composer pipeline as a background task."""
    c = db()
    tid = ctx["tenant_id"]
    doc = _require_document(c, tid, doc_id)
    if doc["extraction_status"] == "extracting":
        raise HTTPException(409, "Pipeline già in esecuzione")
    background_tasks.add_task(_run_pipeline, doc_id, tid, body.max_candidates or 240)
    return {"status": "queued", "document_id": doc_id}


@router.get("/knowledge-factory/documents")
def list_documents(
    status: Optional[str] = None,
    brand_id: Optional[str] = None,
    limit: int = 50,
    ctx=Depends(get_tenant_context),
):
    c = db()
    tid = ctx["tenant_id"]
    q = (c.table("source_documents").select("*").eq("tenant_id", tid)
         .order("created_at", desc=True).limit(min(200, max(1, limit))))
    if status:
        q = q.eq("extraction_status", status)
    if brand_id:
        q = q.eq("brand_id", brand_id)
    rows = q.execute().data or []
    return {"documents": [_slim(r) for r in rows], "total": len(rows)}


@router.get("/knowledge-factory/documents/{doc_id}")
def get_document(doc_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    doc = _require_document(c, tid, doc_id)
    sections = (c.table("product_sections").select("*")
                .eq("source_document_id", doc_id)
                .order("section_index").execute().data or [])
    products = (c.table("products").select(
        "id,product_name,slug,designer_name,category_label,review_status,"
        "confidence_score,source_pages,spec_ready,academy_ready,content_ready"
    ).eq("source_document_id", doc_id)
                .eq("tenant_id", tid)
                .order("created_at").execute().data or [])
    return {
        "document": _slim(doc),
        "sections": [_slim(s) for s in sections],
        "products": [_slim(p) for p in products],
    }


# ─── Endpoints · products ─────────────────────────────────────────────
@router.get("/knowledge-factory/products")
def list_products(
    review_status: Optional[str] = None,
    brand_id: Optional[str] = None,
    source_document_id: Optional[str] = None,
    limit: int = 50,
    ctx=Depends(get_tenant_context),
):
    c = db()
    tid = ctx["tenant_id"]
    q = (c.table("products").select("*").eq("tenant_id", tid)
         .order("created_at", desc=True).limit(min(200, max(1, limit))))
    if review_status:
        q = q.eq("review_status", review_status)
    if brand_id:
        q = q.eq("brand_id", brand_id)
    if source_document_id:
        q = q.eq("source_document_id", source_document_id)
    rows = q.execute().data or []
    return {"products": [_slim(r) for r in rows], "total": len(rows)}


@router.get("/knowledge-factory/products/{product_id}")
def get_product(product_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    p = _require_product(c, tid, product_id)
    pa_rows = (c.table("product_assets").select("*")
               .eq("product_id", product_id)
               .order("sort_order").execute().data or [])

    # Hydrate media_library URLs (one batch query)
    media_ids = list({r["asset_id"] for r in pa_rows if r.get("asset_id")})
    media_index: Dict[str, Dict[str, Any]] = {}
    if media_ids:
        media_rows = (c.table("media_library").select("id,file_url,file_name,storage_path,bucket")
                      .in_("id", media_ids).execute().data or [])
        media_index = {m["id"]: m for m in media_rows}

    by_role: Dict[str, List[Dict[str, Any]]] = {}
    for r in pa_rows:
        media = media_index.get(r.get("asset_id")) or {}
        item = {
            **_slim(r),
            "file_url": media.get("file_url") or (r.get("metadata_json") or {}).get("public_url"),
            "file_name": media.get("file_name"),
        }
        by_role.setdefault(r["role"], []).append(item)

    return {
        "product": _slim(p),
        "assets_by_role": by_role,
        "asset_count": len(pa_rows),
    }


@router.patch("/knowledge-factory/products/{product_id}")
def patch_product(product_id: str, body: ProductPatch, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _require_product(c, tid, product_id)
    update: Dict[str, Any] = {k: v for k, v in body.model_dump(exclude_unset=True).items()
                              if v is not None}
    if not update:
        raise HTTPException(400, "Nessun campo da aggiornare")
    update["updated_at"] = _now()
    c.table("products").update(update).eq("id", product_id).eq("tenant_id", tid).execute()
    flags = _recompute_knowledge_flags(c, product_id)
    p = _require_product(c, tid, product_id)
    return {"product": _slim(p), "knowledge_flags": flags}


@router.post("/knowledge-factory/products/{product_id}/approve")
def approve_product(product_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _require_product(c, tid, product_id)
    c.table("products").update({
        "review_status": "approved",
        "reviewed_by": ctx.get("profile_id"),
        "reviewed_at": _now(),
        "updated_at": _now(),
    }).eq("id", product_id).eq("tenant_id", tid).execute()
    _recompute_knowledge_flags(c, product_id)
    return {"product_id": product_id, "review_status": "approved"}


@router.post("/knowledge-factory/products/{product_id}/reject")
def reject_product(product_id: str, body: RejectBody, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _require_product(c, tid, product_id)
    c.table("products").update({
        "review_status": "rejected",
        "rejection_reason": (body.reason or "").strip() or None,
        "reviewed_by": ctx.get("profile_id"),
        "reviewed_at": _now(),
        "updated_at": _now(),
    }).eq("id", product_id).eq("tenant_id", tid).execute()
    return {"product_id": product_id, "review_status": "rejected"}


@router.post("/knowledge-factory/products/{product_id}/merge")
def merge_product(product_id: str, body: MergeBody, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    if product_id == body.target_product_id:
        raise HTTPException(400, "Impossibile unire un prodotto con se stesso")
    _require_product(c, tid, product_id)
    _require_product(c, tid, body.target_product_id)  # validates existence
    # Move all product_assets from source → target
    c.table("product_assets").update({
        "product_id": body.target_product_id,
    }).eq("product_id", product_id).execute()
    c.table("products").update({
        "review_status": "merged",
        "merged_into_id": body.target_product_id,
        "reviewed_by": ctx.get("profile_id"),
        "reviewed_at": _now(),
        "updated_at": _now(),
    }).eq("id", product_id).eq("tenant_id", tid).execute()
    _recompute_knowledge_flags(c, body.target_product_id)
    return {"merged_from": product_id, "into": body.target_product_id}


# ─── Endpoints · product_assets ───────────────────────────────────────
@router.patch("/knowledge-factory/products/{product_id}/assets/{pa_id}")
def patch_asset(product_id: str, pa_id: str, body: AssetPatch,
                ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _require_product(c, tid, product_id)
    if body.role is not None and body.role not in VALID_ASSET_ROLES:
        raise HTTPException(400, f"Ruolo asset non valido: {body.role}")
    update: Dict[str, Any] = {k: v for k, v in body.model_dump(exclude_unset=True).items()
                              if v is not None}
    if not update:
        raise HTTPException(400, "Nessun campo da aggiornare")
    # If marking is_primary=True, unset any other primary in the product
    if update.get("is_primary"):
        c.table("product_assets").update({"is_primary": False}) \
            .eq("product_id", product_id).execute()
    c.table("product_assets").update(update) \
        .eq("id", pa_id).eq("product_id", product_id).execute()
    _recompute_knowledge_flags(c, product_id)
    return {"product_asset_id": pa_id, "updated": update}


@router.delete("/knowledge-factory/products/{product_id}/assets/{pa_id}")
def delete_asset(product_id: str, pa_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _require_product(c, tid, product_id)
    c.table("product_assets").delete().eq("id", pa_id).eq("product_id", product_id).execute()
    _recompute_knowledge_flags(c, product_id)
    return {"deleted": pa_id}
