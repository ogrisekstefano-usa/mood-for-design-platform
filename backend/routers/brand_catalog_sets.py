"""Brand Catalog Sets™ — ITER194 Multi-PDF Ingestion Workspace API.

Endpoints (all mounted under `/api/knowledge`):

  Brands
    GET    /brands                                · list brand registry
    POST   /brands                                · create new brand
    GET    /brands/{brand_id}                     · brand detail + catalog sets

  Catalog Sets
    POST   /brands/{brand_id}/catalog-sets        · create set
    GET    /brands/{brand_id}/catalog-sets        · list sets for brand
    GET    /catalog-sets/{set_id}                 · set detail (documents+progress)
    PATCH  /catalog-sets/{set_id}                 · rename / annotate
    DELETE /catalog-sets/{set_id}                 · archive

  Documents (per set)
    POST   /catalog-sets/{set_id}/documents/upload   · multi-PDF batch (≤50)
    GET    /catalog-sets/{set_id}/documents          · list with status
    DELETE /catalog-sets/{set_id}/documents/{doc_id} · remove a PDF from set

  Extraction
    POST   /catalog-sets/{set_id}/extract             · start background pipeline
    GET    /catalog-sets/{set_id}/extraction-status  · live polling (every 2s)

  Validation
    GET    /catalog-sets/{set_id}/validation-summary  · brand summary + counts
    GET    /catalog-sets/{set_id}/pages               · paginated page review
    PATCH  /catalog-sets/{set_id}/pages/{page_id}     · update review state
    GET    /catalog-sets/{set_id}/entities            · unified brand index
    PATCH  /catalog-sets/{set_id}/entities/{eid}      · update / approve entity
    POST   /catalog-sets/{set_id}/entities/{eid}/merge · merge into another entity
    POST   /catalog-sets/{set_id}/publish              · mark as validated/published

Coexists with the legacy single-PDF `/inspirations/knowledge-factory/*` and
ITER192 multi-PDF `/sessions/*` flows. Does not modify them.
"""
from __future__ import annotations

import logging
import re
import unicodedata
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from core.tenant_context import get_tenant_context
from cultural_engine import brand_index_builder, product_composer
from database import db, get_admin_client

logger = logging.getLogger(__name__)
router = APIRouter()

CATALOG_BUCKET = "catalog-sources"
ASSET_BUCKET = "cms-assets"
MAX_PDFS_PER_REQUEST = 50

VALID_CATALOG_TYPES = {"catalog", "lookbook", "price_list", "spec_sheet", "brochure"}
VALID_ENTITY_STATUSES = {
    "detected", "auto_merged", "needs_review", "separate",
    "merged_into", "rejected", "validated",
}
VALID_PAGE_REVIEW = {"pending", "needs_review", "validated", "skipped"}


# ─── helpers ──────────────────────────────────────────────────────────
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slim(row: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not row:
        return {}
    return {k: v for k, v in row.items() if k != "_id"}


def _slugify(text: str) -> str:
    if not text:
        return "untitled"
    norm = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    norm = re.sub(r"[^a-zA-Z0-9]+", "-", norm).strip("-").lower()
    return norm or "untitled"


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


def _require_brand(c, tid: str, brand_id: str) -> Dict[str, Any]:
    rows = (c.table("brands").select("*")
            .eq("id", brand_id).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Brand non trovato")
    brand = rows[0]
    # brand may be tenant-scoped or curated_public (tenant_id NULL)
    if brand.get("tenant_id") and brand["tenant_id"] != tid:
        raise HTTPException(403, "Brand non accessibile da questo tenant")
    return brand


def _require_set(c, tid: str, set_id: str) -> Dict[str, Any]:
    rows = (c.table("brand_catalog_sets").select("*")
            .eq("id", set_id).eq("tenant_id", tid).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Catalog Set non trovato")
    return rows[0]


def _refresh_set_progress(c, set_id: str) -> Dict[str, Any]:
    """Recompute extraction_progress + documents counters from child docs."""
    docs = (c.table("brand_catalog_documents")
            .select("id,extraction_status,page_count,pages_processed")
            .eq("catalog_set_id", set_id).execute().data or [])
    total = len(docs)
    extracted = sum(1 for d in docs if d["extraction_status"] in ("review", "validated"))
    failed = sum(1 for d in docs if d["extraction_status"] == "failed")
    total_pages = sum(int(d.get("page_count") or 0) for d in docs)
    pages_done = sum(int(d.get("pages_processed") or 0) for d in docs)
    progress = round(100.0 * pages_done / total_pages, 2) if total_pages else 0.0
    status_map = {d["id"]: d["extraction_status"] for d in docs}

    update = {
        "document_count": total,
        "documents_extracted": extracted,
        "documents_failed": failed,
        "total_pages": total_pages,
        "pages_processed": pages_done,
        "extraction_progress": progress,
        "documents_status": status_map,
        "updated_at": _now(),
    }
    try:
        c.table("brand_catalog_sets").update(update).eq("id", set_id).execute()
    except Exception as e:
        logger.warning(f"refresh_set_progress failed: {e}")
    return update


# ─── Pydantic ─────────────────────────────────────────────────────────
class BrandCreate(BaseModel):
    name:        str
    slug:        Optional[str] = None
    category:    Optional[str] = None
    country:     Optional[str] = None
    website:     Optional[str] = None
    positioning: Optional[str] = None


class CatalogSetCreate(BaseModel):
    name:        str
    description: Optional[str] = None
    slug:        Optional[str] = None


class CatalogSetUpdate(BaseModel):
    name:        Optional[str] = None
    description: Optional[str] = None
    status:      Optional[str] = None


class ExtractBody(BaseModel):
    max_candidates_per_doc: Optional[int] = 600
    rebuild_index:          Optional[bool] = True


class EntityPatch(BaseModel):
    display_name: Optional[str] = None
    status:       Optional[str] = None
    attributes:   Optional[Dict[str, Any]] = None
    aliases:      Optional[List[str]] = None


class EntityMergeBody(BaseModel):
    target_entity_id: str


class PageReviewPatch(BaseModel):
    review_status: Optional[str] = None
    review_notes:  Optional[str] = None
    visual_role:   Optional[str] = None


# ────────────────────────────────────────────────────────────────────
# ─── BRANDS ─────────────────────────────────────────────────────────
# ────────────────────────────────────────────────────────────────────
@router.get("/brands")
def list_brands(ctx=Depends(get_tenant_context)):
    """List brands accessible to this tenant (curated_public + own)."""
    c = db()
    tid = ctx["tenant_id"]
    rows = (c.table("brands")
            .select("id,name,slug,category,country,website,logo_url,"
                    "visibility_level,tenant_id,created_at")
            .or_(f"tenant_id.eq.{tid},tenant_id.is.null")
            .order("name").execute().data or [])
    return {"brands": [_slim(r) for r in rows], "total": len(rows)}


@router.post("/brands", status_code=201)
def create_brand(body: BrandCreate, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    slug = (body.slug or _slugify(body.name))[:120]
    existing = (c.table("brands").select("id")
                .eq("tenant_id", tid).eq("slug", slug)
                .limit(1).execute().data or [])
    if existing:
        raise HTTPException(409, "Brand già esistente con questo slug")
    bid = str(uuid.uuid4())
    row = {
        "id": bid, "tenant_id": tid,
        "name": body.name.strip()[:200], "slug": slug,
        "category": body.category, "country": body.country,
        "website": body.website, "positioning": body.positioning,
        "visibility_level": "studio_private",
        "agreement_status": "unverified",
        "created_by": ctx.get("profile_id"),
        "created_at": _now(), "updated_at": _now(),
    }
    c.table("brands").insert(row).execute()
    return _slim(row)


@router.get("/brands/{brand_id}")
def get_brand(brand_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    brand = _require_brand(c, tid, brand_id)
    sets = (c.table("brand_catalog_sets")
            .select("id,name,slug,status,document_count,documents_extracted,"
                    "documents_failed,total_pages,extraction_progress,"
                    "index_summary,created_at,updated_at")
            .eq("brand_id", brand_id).eq("tenant_id", tid)
            .order("created_at", desc=True).execute().data or [])
    return {
        "brand": _slim(brand),
        "catalog_sets": [_slim(s) for s in sets],
        "total_sets": len(sets),
    }


# ────────────────────────────────────────────────────────────────────
# ─── CATALOG SETS ───────────────────────────────────────────────────
# ────────────────────────────────────────────────────────────────────
@router.post("/brands/{brand_id}/catalog-sets", status_code=201)
def create_catalog_set(brand_id: str, body: CatalogSetCreate,
                       ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _require_brand(c, tid, brand_id)
    slug = (body.slug or _slugify(body.name))[:120]
    sid = str(uuid.uuid4())
    row = {
        "id": sid, "tenant_id": tid, "brand_id": brand_id,
        "name": body.name.strip()[:200], "slug": slug,
        "description": body.description, "status": "draft",
        "created_by": ctx.get("profile_id"),
        "created_at": _now(), "updated_at": _now(),
    }
    try:
        c.table("brand_catalog_sets").insert(row).execute()
    except Exception as e:
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            raise HTTPException(409, "Catalog Set con questo slug già esistente")
        raise HTTPException(500, f"Creazione fallita: {e}")
    full = (c.table("brand_catalog_sets").select("*")
            .eq("id", sid).limit(1).execute().data or [])
    return _slim(full[0] if full else row)


@router.get("/brands/{brand_id}/catalog-sets")
def list_catalog_sets(brand_id: str, status: Optional[str] = None,
                      ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _require_brand(c, tid, brand_id)
    q = (c.table("brand_catalog_sets").select("*")
         .eq("brand_id", brand_id).eq("tenant_id", tid)
         .order("created_at", desc=True))
    if status:
        q = q.eq("status", status)
    rows = q.execute().data or []
    return {"catalog_sets": [_slim(r) for r in rows], "total": len(rows)}


@router.get("/catalog-sets/{set_id}")
def get_catalog_set(set_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    cset = _require_set(c, tid, set_id)
    docs = (c.table("brand_catalog_documents")
            .select("id,display_name,original_filename,catalog_type,catalog_year,"
                    "language,pdf_url,page_count,pages_processed,extraction_status,"
                    "metrics,sort_order,created_at")
            .eq("catalog_set_id", set_id).eq("tenant_id", tid)
            .order("sort_order").order("created_at").execute().data or [])
    return {
        "catalog_set": _slim(cset),
        "documents": [_slim(d) for d in docs],
        "document_count": len(docs),
    }


@router.patch("/catalog-sets/{set_id}")
def update_catalog_set(set_id: str, body: CatalogSetUpdate,
                       ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _require_set(c, tid, set_id)
    update = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not update:
        raise HTTPException(400, "Nessun campo da aggiornare")
    update["updated_at"] = _now()
    c.table("brand_catalog_sets").update(update).eq("id", set_id).eq("tenant_id", tid).execute()
    return get_catalog_set(set_id, ctx)


@router.delete("/catalog-sets/{set_id}")
def archive_catalog_set(set_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _require_set(c, tid, set_id)
    c.table("brand_catalog_sets").update({
        "status": "archived", "updated_at": _now(),
    }).eq("id", set_id).eq("tenant_id", tid).execute()
    return {"catalog_set_id": set_id, "status": "archived"}


# ────────────────────────────────────────────────────────────────────
# ─── DOCUMENTS UPLOAD ───────────────────────────────────────────────
# ────────────────────────────────────────────────────────────────────
@router.post("/catalog-sets/{set_id}/documents/upload", status_code=201)
async def upload_documents(
    set_id: str,
    files: List[UploadFile] = File(...),
    ctx=Depends(get_tenant_context),
):
    """Upload up to 50 PDFs in a single batch into the Catalog Set."""
    c = db()
    tid = ctx["tenant_id"]
    cset = _require_set(c, tid, set_id)
    if cset["status"] in ("extracting",):
        raise HTTPException(409, "Estrazione in corso — attendere completamento")
    if cset["status"] in ("published", "archived"):
        raise HTTPException(409, "Catalog Set non modificabile in questo stato")
    if len(files) > MAX_PDFS_PER_REQUEST:
        raise HTTPException(400, f"Massimo {MAX_PDFS_PER_REQUEST} PDF per richiesta")

    brand_id = cset["brand_id"]
    uploaded: List[Dict[str, Any]] = []
    next_sort = (cset.get("document_count") or 0)

    for f in files:
        if not f.content_type or "pdf" not in f.content_type.lower():
            uploaded.append({"file": f.filename, "ok": False, "error": "Solo file PDF accettati"})
            continue
        content = await f.read()
        if len(content) < 1024:
            uploaded.append({"file": f.filename, "ok": False, "error": "File troppo piccolo"})
            continue
        # 1. Insert source_document (reusable extraction unit)
        src_doc_id = str(uuid.uuid4())
        storage_path = f"{tid}/catalog-sets/{set_id}/{src_doc_id}/source.pdf"
        try:
            pdf_url = _upload_bytes(CATALOG_BUCKET, storage_path, content,
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

        try:
            c.table("source_documents").insert({
                "id": src_doc_id, "tenant_id": tid, "brand_id": brand_id,
                "original_filename": (f.filename or "catalog.pdf")[:200],
                "document_type": "catalog",
                "page_count": page_count,
                "extraction_status": "pending",
                "processing_logs": [], "error_logs": [], "metrics": {},
                "metadata_json": {"storage_path": storage_path, "pdf_url": pdf_url,
                                  "file_size": len(content), "catalog_set_id": set_id},
                "created_by": ctx.get("profile_id"),
                "created_at": _now(), "updated_at": _now(),
            }).execute()
        except Exception as e:
            uploaded.append({"file": f.filename, "ok": False, "error": f"DB insert fallito: {e}"})
            continue

        # 2. Insert brand_catalog_documents (the workspace wrapper)
        bcd_id = str(uuid.uuid4())
        try:
            c.table("brand_catalog_documents").insert({
                "id": bcd_id, "tenant_id": tid,
                "catalog_set_id": set_id, "brand_id": brand_id,
                "source_document_id": src_doc_id,
                "display_name": (f.filename or "catalog.pdf").rsplit(".", 1)[0][:200],
                "original_filename": (f.filename or "catalog.pdf")[:200],
                "catalog_type": "catalog",
                "pdf_url": pdf_url, "storage_path": storage_path,
                "page_count": page_count,
                "extraction_status": "pending",
                "sort_order": next_sort,
                "created_by": ctx.get("profile_id"),
                "created_at": _now(), "updated_at": _now(),
            }).execute()
            next_sort += 1
        except Exception as e:
            uploaded.append({"file": f.filename, "ok": False, "error": f"Wrapper insert fallito: {e}"})
            continue

        uploaded.append({
            "file": f.filename, "ok": True,
            "catalog_document_id": bcd_id,
            "source_document_id": src_doc_id,
            "page_count": page_count,
        })

    _refresh_set_progress(c, set_id)
    # Move set status to 'uploading' if it was draft
    if cset["status"] == "draft":
        c.table("brand_catalog_sets").update({
            "status": "uploading", "updated_at": _now(),
        }).eq("id", set_id).execute()

    ok_count = sum(1 for u in uploaded if u["ok"])
    return {
        "catalog_set_id": set_id,
        "uploaded": uploaded,
        "ok_count": ok_count,
        "failed_count": len(uploaded) - ok_count,
    }


@router.get("/catalog-sets/{set_id}/documents")
def list_set_documents(set_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _require_set(c, tid, set_id)
    rows = (c.table("brand_catalog_documents").select("*")
            .eq("catalog_set_id", set_id).eq("tenant_id", tid)
            .order("sort_order").order("created_at").execute().data or [])
    return {"documents": [_slim(r) for r in rows], "total": len(rows)}


@router.delete("/catalog-sets/{set_id}/documents/{doc_id}")
def delete_set_document(set_id: str, doc_id: str,
                         ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    cset = _require_set(c, tid, set_id)
    if cset["status"] in ("extracting",):
        raise HTTPException(409, "Estrazione in corso")
    doc_rows = (c.table("brand_catalog_documents").select("source_document_id")
                .eq("id", doc_id).eq("catalog_set_id", set_id)
                .limit(1).execute().data or [])
    if not doc_rows:
        raise HTTPException(404, "Documento non trovato nel set")
    c.table("brand_catalog_documents").delete().eq("id", doc_id).execute()
    _refresh_set_progress(c, set_id)
    return {"deleted": doc_id}


# ────────────────────────────────────────────────────────────────────
# ─── EXTRACTION ─────────────────────────────────────────────────────
# ────────────────────────────────────────────────────────────────────
def _run_set_extraction(set_id: str, tenant_id: str,
                         max_candidates: int = 600,
                         rebuild_index: bool = True) -> None:
    """Background pipeline: extract every PDF in the set, then build the
    Unified Brand Index + page snapshots.
    """
    c = db()
    if c is None:
        return
    sets = (c.table("brand_catalog_sets").select("*")
            .eq("id", set_id).eq("tenant_id", tenant_id)
            .limit(1).execute().data or [])
    if not sets:
        return
    cset = sets[0]
    brand_id = cset["brand_id"]

    docs = (c.table("brand_catalog_documents")
            .select("*").eq("catalog_set_id", set_id)
            .eq("tenant_id", tenant_id).execute().data or [])
    if not docs:
        c.table("brand_catalog_sets").update({
            "status": "needs_review", "updated_at": _now(),
        }).eq("id", set_id).execute()
        return

    c.table("brand_catalog_sets").update({
        "status": "extracting",
        "extraction_started_at": _now(),
        "documents_extracted": 0,
        "documents_failed": 0,
        "pages_processed": 0,
        "updated_at": _now(),
    }).eq("id", set_id).execute()

    admin = get_admin_client()

    for d in docs:
        bcd_id = d["id"]
        src_doc_id = d["source_document_id"]
        try:
            # Skip already extracted docs unless explicitly re-run
            if d["extraction_status"] in ("review", "validated"):
                continue
            # 1. Download PDF
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
                    pdf_bytes = admin.storage.from_(CATALOG_BUCKET).download(storage_path)
                    if pdf_bytes and len(pdf_bytes) >= 1024:
                        break
                except Exception as ex:
                    logger.warning(f"download attempt {attempt+1}: {ex}")
                import time as _t
                _t.sleep(1.5 * (attempt + 1))
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

            def asset_uploader(image_bytes: bytes, filename: str,
                                _src=src_doc_id, _set=set_id):
                ext = filename.rsplit(".", 1)[-1].lower()
                ct = "image/jpeg" if ext in ("jpg", "jpeg") else "image/png"
                path = f"{tenant_id}/catalog-sets/{_set}/{_src}/{filename}"
                try:
                    pub = _upload_bytes(ASSET_BUCKET, path, image_bytes, ct, private=False)
                except Exception as e:
                    logger.warning(f"asset upload failed: {e}")
                    return None, None
                media_id = str(uuid.uuid4())
                try:
                    c.table("media_library").insert({
                        "id": media_id, "tenant_id": tenant_id,
                        "bucket": ASSET_BUCKET, "storage_path": path,
                        "file_url": pub, "file_name": filename[:120],
                        "file_type": ct, "file_size": len(image_bytes),
                        "category": "brand_catalog_asset",
                        "is_inspiration": False,
                        "tags": ["brand_catalog_workspace"],
                        "metadata_json": {
                            "source_document_id": _src,
                            "catalog_set_id": _set,
                        },
                        "created_at": _now(), "updated_at": _now(),
                    }).execute()
                except Exception as e:
                    logger.warning(f"media_library insert: {e}")
                    return pub, None
                return pub, media_id

            result = product_composer.compose_products_from_pdf(
                pdf_bytes=pdf_bytes, source_document_id=src_doc_id,
                tenant_id=tenant_id, brand_id=brand_id,
                db_client=c, asset_uploader=asset_uploader,
                max_candidates=max_candidates,
            )

            # 2. Write page snapshots (visual_role per page)
            page_count = d.get("page_count") or 0
            sections = (c.table("product_sections")
                        .select("id,source_document_id,start_page,end_page,"
                                "detected_title,detected_designer,detected_category,"
                                "raw_text,confidence_score")
                        .eq("source_document_id", src_doc_id).execute().data or [])
            pages_written = brand_index_builder.write_page_snapshots(
                c, tenant_id=tenant_id, catalog_set_id=set_id,
                brand_id=brand_id, catalog_document_id=bcd_id,
                source_document_id=src_doc_id, page_count=page_count,
                sections=sections,
            )

            # 3. Mark doc as review-ready
            c.table("brand_catalog_documents").update({
                "extraction_status": "review",
                "extraction_completed_at": _now(),
                "pages_processed": pages_written,
                "metrics": result["metrics"],
                "updated_at": _now(),
            }).eq("id", bcd_id).execute()
            c.table("source_documents").update({
                "extraction_status": "review",
                "extraction_completed_at": _now(),
                "metrics": result["metrics"],
                "updated_at": _now(),
            }).eq("id", src_doc_id).execute()
            _refresh_set_progress(c, set_id)

        except Exception as e:
            logger.exception(f"doc {bcd_id} failed: {e}")
            try:
                c.table("brand_catalog_documents").update({
                    "extraction_status": "failed",
                    "extraction_completed_at": _now(),
                    "error_logs": [{"error": str(e), "at": _now()}],
                    "updated_at": _now(),
                }).eq("id", bcd_id).execute()
                c.table("source_documents").update({
                    "extraction_status": "failed",
                    "updated_at": _now(),
                }).eq("id", src_doc_id).execute()
            except Exception:
                pass
            _refresh_set_progress(c, set_id)

    # 4. Build Unified Brand Index
    try:
        brand_index_builder.build_unified_index(
            c, tenant_id=tenant_id, catalog_set_id=set_id, brand_id=brand_id,
        )
    except Exception as e:
        logger.exception(f"index build failed: {e}")

    # 5. Final state: needs_review (waiting for SuperAdmin validation)
    c.table("brand_catalog_sets").update({
        "status": "needs_review",
        "extraction_completed_at": _now(),
        "updated_at": _now(),
    }).eq("id", set_id).execute()


@router.post("/catalog-sets/{set_id}/extract")
def trigger_extraction(set_id: str, body: ExtractBody,
                        background_tasks: BackgroundTasks,
                        ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    cset = _require_set(c, tid, set_id)
    if cset["status"] == "extracting":
        raise HTTPException(409, "Estrazione già in corso")
    if (cset.get("document_count") or 0) == 0:
        raise HTTPException(400, "Nessun documento caricato in questo set")
    background_tasks.add_task(_run_set_extraction, set_id, tid,
                               body.max_candidates_per_doc or 600,
                               bool(body.rebuild_index))
    return {"status": "queued", "catalog_set_id": set_id}


@router.get("/catalog-sets/{set_id}/extraction-status")
def extraction_status(set_id: str, ctx=Depends(get_tenant_context)):
    """Poll-friendly endpoint (every 2s) used by the Extraction Progress panel."""
    c = db()
    tid = ctx["tenant_id"]
    cset = _require_set(c, tid, set_id)
    docs = (c.table("brand_catalog_documents")
            .select("id,display_name,extraction_status,page_count,pages_processed,"
                    "metrics,extraction_started_at,extraction_completed_at")
            .eq("catalog_set_id", set_id).eq("tenant_id", tid)
            .order("sort_order").execute().data or [])
    return {
        "catalog_set_id":      set_id,
        "status":              cset["status"],
        "document_count":      cset.get("document_count") or 0,
        "documents_extracted": cset.get("documents_extracted") or 0,
        "documents_failed":    cset.get("documents_failed") or 0,
        "total_pages":         cset.get("total_pages") or 0,
        "pages_processed":     cset.get("pages_processed") or 0,
        "extraction_progress": float(cset.get("extraction_progress") or 0.0),
        "extraction_started_at":   cset.get("extraction_started_at"),
        "extraction_completed_at": cset.get("extraction_completed_at"),
        "documents":           [_slim(d) for d in docs],
    }


# ────────────────────────────────────────────────────────────────────
# ─── VALIDATION ─────────────────────────────────────────────────────
# ────────────────────────────────────────────────────────────────────
@router.get("/catalog-sets/{set_id}/validation-summary")
def validation_summary(set_id: str, ctx=Depends(get_tenant_context)):
    """Brand summary tile for the Validation Dashboard."""
    c = db()
    tid = ctx["tenant_id"]
    cset = _require_set(c, tid, set_id)
    brand = _require_brand(c, tid, cset["brand_id"])

    docs = (c.table("brand_catalog_documents")
            .select("id,display_name,original_filename,extraction_status,"
                    "page_count,pages_processed,metrics,catalog_type")
            .eq("catalog_set_id", set_id).order("sort_order").execute().data or [])

    # Entities by type+status
    entities = (c.table("brand_detected_entities")
                .select("entity_type,status,confidence_score,mention_count")
                .eq("catalog_set_id", set_id).execute().data or [])
    by_type: Dict[str, Dict[str, int]] = {}
    for e in entities:
        et = e["entity_type"]
        st = e["status"]
        by_type.setdefault(et, {"total": 0, "auto_merged": 0, "needs_review": 0,
                                 "separate": 0, "validated": 0, "rejected": 0})
        by_type[et]["total"] += 1
        if st in by_type[et]:
            by_type[et][st] += 1

    pages_pending = (c.table("brand_catalog_pages")
                     .select("id", count="exact")
                     .eq("catalog_set_id", set_id)
                     .eq("review_status", "pending").execute().count or 0)
    pages_needs_review = (c.table("brand_catalog_pages")
                          .select("id", count="exact")
                          .eq("catalog_set_id", set_id)
                          .eq("review_status", "needs_review").execute().count or 0)
    pages_validated = (c.table("brand_catalog_pages")
                       .select("id", count="exact")
                       .eq("catalog_set_id", set_id)
                       .eq("review_status", "validated").execute().count or 0)

    return {
        "catalog_set": _slim(cset),
        "brand": {
            "id": brand["id"], "name": brand.get("name"),
            "slug": brand.get("slug"), "category": brand.get("category"),
            "country": brand.get("country"), "logo_url": brand.get("logo_url"),
        },
        "documents": [_slim(d) for d in docs],
        "entity_counts": by_type,
        "page_review": {
            "pending":       pages_pending,
            "needs_review":  pages_needs_review,
            "validated":     pages_validated,
            "total":         pages_pending + pages_needs_review + pages_validated,
        },
        "index_summary": cset.get("index_summary") or {},
    }


@router.get("/catalog-sets/{set_id}/pages")
def list_pages(set_id: str,
               catalog_document_id: Optional[str] = None,
               review_status: Optional[str] = None,
               visual_role: Optional[str] = None,
               limit: int = 100,
               offset: int = 0,
               ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _require_set(c, tid, set_id)
    q = (c.table("brand_catalog_pages").select("*")
         .eq("catalog_set_id", set_id).eq("tenant_id", tid))
    if catalog_document_id:
        q = q.eq("catalog_document_id", catalog_document_id)
    if review_status:
        q = q.eq("review_status", review_status)
    if visual_role:
        q = q.eq("visual_role", visual_role)
    rows = (q.order("catalog_document_id").order("page_number")
            .range(offset, offset + min(500, max(1, limit)) - 1)
            .execute().data or [])
    return {"pages": [_slim(r) for r in rows], "count": len(rows),
            "offset": offset, "limit": limit}


@router.patch("/catalog-sets/{set_id}/pages/{page_id}")
def patch_page(set_id: str, page_id: str, body: PageReviewPatch,
                ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _require_set(c, tid, set_id)
    update = {}
    if body.review_status is not None:
        if body.review_status not in VALID_PAGE_REVIEW:
            raise HTTPException(400, f"review_status non valido: {body.review_status}")
        update["review_status"] = body.review_status
        update["reviewed_by"] = ctx.get("profile_id")
        update["reviewed_at"] = _now()
    if body.review_notes is not None:
        update["review_notes"] = body.review_notes[:2000]
    if body.visual_role is not None:
        update["visual_role"] = body.visual_role
    if not update:
        raise HTTPException(400, "Nessun campo da aggiornare")
    update["updated_at"] = _now()
    c.table("brand_catalog_pages").update(update).eq("id", page_id) \
        .eq("catalog_set_id", set_id).eq("tenant_id", tid).execute()
    rows = (c.table("brand_catalog_pages").select("*")
            .eq("id", page_id).limit(1).execute().data or [])
    return {"page": _slim(rows[0] if rows else {})}


@router.get("/catalog-sets/{set_id}/entities")
def list_entities(set_id: str,
                  entity_type: Optional[str] = None,
                  status: Optional[str] = None,
                  q: Optional[str] = None,
                  limit: int = 200,
                  ctx=Depends(get_tenant_context)):
    """List Unified Brand Index entries — drives the Entity Resolver UI."""
    c = db()
    tid = ctx["tenant_id"]
    _require_set(c, tid, set_id)
    query = (c.table("brand_detected_entities").select("*")
             .eq("catalog_set_id", set_id).eq("tenant_id", tid))
    if entity_type:
        query = query.eq("entity_type", entity_type)
    if status:
        query = query.eq("status", status)
    if q:
        query = query.ilike("display_name", f"%{q}%")
    rows = (query.order("entity_type")
            .order("confidence_score", desc=True)
            .order("mention_count", desc=True)
            .limit(min(500, max(1, limit))).execute().data or [])
    return {"entities": [_slim(r) for r in rows], "total": len(rows)}


@router.patch("/catalog-sets/{set_id}/entities/{entity_id}")
def patch_entity(set_id: str, entity_id: str, body: EntityPatch,
                  ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _require_set(c, tid, set_id)
    update: Dict[str, Any] = {}
    if body.display_name is not None:
        update["display_name"] = body.display_name.strip()[:200]
    if body.status is not None:
        if body.status not in VALID_ENTITY_STATUSES:
            raise HTTPException(400, f"status non valido: {body.status}")
        update["status"] = body.status
        update["reviewed_by"] = ctx.get("profile_id")
        update["reviewed_at"] = _now()
    if body.attributes is not None:
        update["attributes"] = body.attributes
    if body.aliases is not None:
        update["aliases"] = body.aliases
    if not update:
        raise HTTPException(400, "Nessun campo da aggiornare")
    update["updated_at"] = _now()
    c.table("brand_detected_entities").update(update).eq("id", entity_id) \
        .eq("catalog_set_id", set_id).eq("tenant_id", tid).execute()
    rows = (c.table("brand_detected_entities").select("*")
            .eq("id", entity_id).limit(1).execute().data or [])
    return {"entity": _slim(rows[0] if rows else {})}


@router.post("/catalog-sets/{set_id}/entities/{entity_id}/merge")
def merge_entity(set_id: str, entity_id: str, body: EntityMergeBody,
                  ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _require_set(c, tid, set_id)
    if entity_id == body.target_entity_id:
        raise HTTPException(400, "Impossibile unire un'entità con se stessa")
    src_rows = (c.table("brand_detected_entities").select("*")
                .eq("id", entity_id).eq("catalog_set_id", set_id).limit(1)
                .execute().data or [])
    tgt_rows = (c.table("brand_detected_entities").select("*")
                .eq("id", body.target_entity_id).eq("catalog_set_id", set_id)
                .limit(1).execute().data or [])
    if not src_rows or not tgt_rows:
        raise HTTPException(404, "Entità non trovata")
    src, tgt = src_rows[0], tgt_rows[0]
    if src["entity_type"] != tgt["entity_type"]:
        raise HTTPException(400, "Tipi di entità incompatibili per merge")

    # Merge evidence + aliases + counts into target
    merged_aliases = sorted(set((tgt.get("aliases") or [])
                                + (src.get("aliases") or [])
                                + [src["display_name"]]))
    merged_doc_ids = sorted(set((tgt.get("source_document_ids") or [])
                                + (src.get("source_document_ids") or [])))
    new_mentions = (tgt.get("mention_count") or 0) + (src.get("mention_count") or 0)
    new_conf = round(min(0.99, max(float(tgt.get("confidence_score") or 0),
                                    float(src.get("confidence_score") or 0)) + 0.05), 3)
    c.table("brand_detected_entities").update({
        "aliases": merged_aliases,
        "source_document_ids": merged_doc_ids,
        "mention_count": new_mentions,
        "confidence_score": new_conf,
        "status": "validated",
        "reviewed_by": ctx.get("profile_id"),
        "reviewed_at": _now(),
        "updated_at": _now(),
    }).eq("id", body.target_entity_id).execute()

    # Mark source as merged_into
    c.table("brand_detected_entities").update({
        "status": "merged_into",
        "merged_into_id": body.target_entity_id,
        "reviewed_by": ctx.get("profile_id"),
        "reviewed_at": _now(),
        "updated_at": _now(),
    }).eq("id", entity_id).execute()

    # Re-point relations
    c.table("brand_entity_relations").update({
        "source_entity_id": body.target_entity_id, "updated_at": _now(),
    }).eq("source_entity_id", entity_id).execute()
    c.table("brand_entity_relations").update({
        "target_entity_id": body.target_entity_id, "updated_at": _now(),
    }).eq("target_entity_id", entity_id).execute()

    return {"merged_from": entity_id, "into": body.target_entity_id}


@router.post("/catalog-sets/{set_id}/publish")
def publish_set(set_id: str, ctx=Depends(get_tenant_context)):
    """Mark the Catalog Set as published once validation is complete."""
    c = db()
    tid = ctx["tenant_id"]
    cset = _require_set(c, tid, set_id)
    if cset["status"] in ("draft", "uploading"):
        raise HTTPException(409, "Estrazione non eseguita")
    # Verify no remaining needs_review entities
    pending = (c.table("brand_detected_entities").select("id", count="exact")
               .eq("catalog_set_id", set_id)
               .eq("status", "needs_review").execute().count or 0)
    if pending > 0:
        raise HTTPException(409, f"{pending} entità ancora in review")
    c.table("brand_catalog_sets").update({
        "status": "published",
        "validated_at": _now(),
        "validated_by": ctx.get("profile_id"),
        "published_at": _now(),
        "published_by": ctx.get("profile_id"),
        "updated_at": _now(),
    }).eq("id", set_id).eq("tenant_id", tid).execute()
    return {"catalog_set_id": set_id, "status": "published"}
