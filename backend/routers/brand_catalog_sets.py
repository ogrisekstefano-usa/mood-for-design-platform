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

# ITER189-pre · UX improvement: live page progress.
# Map composer stage → estimated progress percentage of the document.
# Used to drive `pages_processed = floor(stage_pct * page_count)` so the
# UI can render "34/90 pages" instead of "0%" until the document finishes.
_STAGE_PROGRESS_PCT: Dict[str, float] = {
    "section_detection_start":      0.02,
    "section_detection_done":       0.10,
    "image_extraction_start":       0.12,
    "image_extraction_done":        0.25,
    "image_classification_start":   0.27,
    "image_classification_done":    0.40,
    "vision_layer2_start":          0.42,
    "vision_layer2_done":           0.85,
    "vision_layer2_skipped":        0.85,
    "dedup_done":                   0.88,
    "section_assignment_done":      0.90,
    "product_composition_start":    0.92,
    "product_composition_done":     0.99,
}


def _make_progress_logger(c, bcd_id: str, set_id: str, page_count: int):
    """Return a callback that updates pages_processed at each composer stage.

    The pipeline doesn't process page-by-page (it works in stages), so we
    derive an estimated page count from the stage progress %. This makes
    extraction OBSERVABLE in the UI ("34/90 pages") instead of the previous
    "0% until done" behaviour that triggered false-stall reports.
    """
    last_pct_state = {"v": -1.0}

    def _cb(step: str, payload: Optional[Dict[str, Any]] = None):
        pct = _STAGE_PROGRESS_PCT.get(step)
        if pct is None or page_count <= 0:
            return
        # Only persist if the stage progress moved meaningfully
        if pct <= last_pct_state["v"]:
            return
        last_pct_state["v"] = pct
        try:
            est_pages = max(0, min(page_count, int(round(pct * page_count))))
            c.table("brand_catalog_documents").update({
                "pages_processed": est_pages,
                "updated_at": _now(),
                # Stash stage in metrics so the UI can render a sub-label
                "metrics": {"stage": step, "stage_pct": round(pct, 2),
                            "stage_at": _now(),
                            "payload": (payload or {})},
            }).eq("id", bcd_id).execute()
            _refresh_set_progress(c, set_id)
        except Exception as e:
            logger.warning(f"progress_logger update warn: {e}")
    return _cb


def _make_vision_progress_cb(c, bcd_id: str, set_id: str, page_count: int):
    """Per-image progress callback fired by _run_vision_batch every 5 images.

    Within Vision Layer 2 (stage = 42% → 85%), we additionally interpolate
    page_progress = lerp(42%, 85%, current/total). This gives the UI a
    fine-grained moving counter during the slowest stage (~70% of total time).
    """
    last_n_state = {"v": -1}

    def _cb(current: int, total: int):
        if total <= 0 or page_count <= 0:
            return
        # Throttle: only update every 5 images
        if current - last_n_state["v"] < 5 and current < total:
            return
        last_n_state["v"] = current
        frac = current / max(total, 1)
        lo, hi = 0.42, 0.85
        pct = lo + (hi - lo) * frac
        try:
            est_pages = max(0, min(page_count, int(round(pct * page_count))))
            c.table("brand_catalog_documents").update({
                "pages_processed": est_pages,
                "updated_at": _now(),
                "metrics": {"stage": "vision_layer2",
                            "stage_pct": round(pct, 3),
                            "vision_current": current,
                            "vision_total": total,
                            "stage_at": _now()},
            }).eq("id", bcd_id).execute()
            _refresh_set_progress(c, set_id)
        except Exception as e:
            logger.warning(f"vision_progress update warn: {e}")
    return _cb


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
            # Skip already extracted docs and previously-failed docs (failed docs
            # require manual retry via the dedicated endpoint, not the batch
            # extract — prevents re-loops on documents that systematically hang
            # the pipeline, e.g. Vision Layer 2 timeouts).
            if d["extraction_status"] in ("review", "validated", "failed"):
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
                log_step=_make_progress_logger(c, bcd_id, set_id, d.get("page_count") or 0),
                vision_progress_cb=_make_vision_progress_cb(c, bcd_id, set_id, d.get("page_count") or 0),
            )

            # 1.b · Page-level analysis (OCR candidates + language hint)
            ocr_pages = 0
            text_pages = 0
            lang_counts = {"it": 0, "en": 0, "other": 0}
            try:
                import fitz as _fitz
                _doc = _fitz.open(stream=pdf_bytes, filetype="pdf")
                IT_HINTS = ("della", "delle", "degli", "questo", "questa",
                            "anche", "nostra", "nostro", "design", "italiano",
                            "collezione", "finitura", "materiale", "specchio")
                EN_HINTS = ("the ", "and ", "with ", "design ", "collection",
                            "finish", "material", "available", "designed")
                for _p in _doc:
                    txt = (_p.get_text("text") or "").strip()
                    if len(txt) < 30:
                        ocr_pages += 1
                        continue
                    text_pages += 1
                    low = txt.lower()
                    it_hit = sum(1 for h in IT_HINTS if h in low)
                    en_hit = sum(1 for h in EN_HINTS if h in low)
                    if it_hit > en_hit and it_hit >= 2:
                        lang_counts["it"] += 1
                    elif en_hit > it_hit and en_hit >= 2:
                        lang_counts["en"] += 1
                    else:
                        lang_counts["other"] += 1
                _doc.close()
            except Exception as e:
                logger.debug(f"page analysis skipped: {e}")
            doc_lang = max(lang_counts, key=lang_counts.get) if any(lang_counts.values()) else "unknown"

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
            metrics_full = dict(result.get("metrics") or {})
            metrics_full.update({
                "ocr_pages": ocr_pages,
                "text_pages": text_pages,
                "language": doc_lang,
                "language_pages_breakdown": lang_counts,
            })
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
    """KE-001 · Delegates to persistent extraction_job_runner.

    The legacy in-process BackgroundTasks path (`_DEPRECATED_run_set_extraction`)
    is kept for reference only. Every trigger now creates a row in
    `extraction_jobs` so crashes / restarts are auto-recovered by
    `recover_orphan_jobs`.
    """
    c = db()
    tid = ctx["tenant_id"]
    cset = _require_set(c, tid, set_id)
    if cset["status"] == "extracting":
        raise HTTPException(409, "Estrazione già in corso")
    if (cset.get("document_count") or 0) == 0:
        raise HTTPException(400, "Nessun documento caricato in questo set")
    # Persistent path · ITER197 runner
    from services import extraction_job_runner as runner
    try:
        out = runner.enqueue_job(
            tenant_id=tid, catalog_set_id=set_id,
            brand_id=cset.get("brand_id"),
            config={
                "max_candidates_per_doc": body.max_candidates_per_doc or 600,
                "rebuild_index": bool(body.rebuild_index),
            },
            created_by=ctx.get("profile_id"),
        )
    except ValueError as e:
        if str(e) == "active_job_exists":
            raise HTTPException(409, "Job già attivo per questo set")
        raise HTTPException(500, str(e))
    return {"status": "queued", "catalog_set_id": set_id, **out}


def _DEPRECATED_run_set_extraction(set_id: str, tenant_id: str,
                                    max_candidates: int = 600,
                                    rebuild_index: bool = True) -> None:
    """[KE-001 · DEPRECATED] Legacy in-process pipeline. Kept here as a
    reference only — the persistent extraction_job_runner now drives all
    extraction. DO NOT call this function from new code.
    """
    return _run_set_extraction(set_id, tenant_id, max_candidates, rebuild_index)


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

    # ── ETA computation (linear projection from elapsed/processed)
    eta_seconds = None
    elapsed_seconds = None
    pages_per_second = None
    started_at = cset.get("extraction_started_at")
    total_pages = int(cset.get("total_pages") or 0)
    pages_done = int(cset.get("pages_processed") or 0)
    if started_at and total_pages > 0:
        try:
            from datetime import datetime as _dt, timezone as _tz
            t_start = _dt.fromisoformat(started_at.replace("Z", "+00:00"))
            if t_start.tzinfo is None:
                t_start = t_start.replace(tzinfo=_tz.utc)
            now = _dt.now(_tz.utc)
            elapsed_seconds = max(0, int((now - t_start).total_seconds()))
            if elapsed_seconds > 5 and pages_done > 0:
                pps = pages_done / elapsed_seconds
                pages_per_second = round(pps, 3)
                remaining = max(0, total_pages - pages_done)
                if pps > 0:
                    eta_seconds = int(remaining / pps)
        except Exception:
            pass

    # Aggregate OCR + language hints from per-doc metrics
    ocr_pages_total = 0
    text_pages_total = 0
    lang_pages = {"it": 0, "en": 0, "other": 0}
    for d in docs:
        m = (d.get("metrics") or {})
        ocr_pages_total += int(m.get("ocr_pages") or 0)
        text_pages_total += int(m.get("text_pages") or 0)
        b = (m.get("language_pages_breakdown") or {})
        for k in ("it", "en", "other"):
            lang_pages[k] += int(b.get(k) or 0)

    # Per-doc normalised status labels for the UI (queued/processing/completed/failed)
    def _phase(s: str) -> str:
        return {"pending": "queued", "extracting": "processing",
                 "review": "completed", "validated": "completed",
                 "failed": "failed"}.get(s, s or "queued")

    # ITER189-pre · human-readable stage labels (drives the UI sub-label
    # under "X/Y pages" so users see *what* the extractor is doing, not
    # just *how much* is done).
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
        "section_assignment_done":    "Assegnazione asset alle sezioni",
        "product_composition_start":  "Composizione prodotti…",
        "product_composition_done":   "Prodotti composti",
    }

    doc_rows = []
    for d in docs:
        m = (d.get("metrics") or {})
        stage = m.get("stage")
        stage_pct = m.get("stage_pct")
        vision_current = m.get("vision_current")
        vision_total = m.get("vision_total")
        doc_rows.append({
            **{k: v for k, v in d.items() if k != "_id"},
            "phase": _phase(d.get("extraction_status") or "pending"),
            "ocr_pages": int(m.get("ocr_pages") or 0),
            "text_pages": int(m.get("text_pages") or 0),
            "language": m.get("language") or "unknown",
            "stage": stage,
            "stage_pct": stage_pct,
            "stage_label": _STAGE_LABEL.get(stage) if stage else None,
            "vision_current": vision_current,
            "vision_total": vision_total,
        })

    return {
        "catalog_set_id":      set_id,
        "status":              cset["status"],
        "phase":               {"draft":"queued","uploading":"queued",
                                "extracting":"processing",
                                "needs_review":"completed",
                                "validated":"completed","published":"completed",
                                "archived":"archived"}.get(cset["status"], cset["status"]),
        "document_count":      cset.get("document_count") or 0,
        "documents_extracted": cset.get("documents_extracted") or 0,
        "documents_failed":    cset.get("documents_failed") or 0,
        "total_pages":         total_pages,
        "pages_processed":     pages_done,
        "pages_remaining":     max(0, total_pages - pages_done),
        "extraction_progress": float(cset.get("extraction_progress") or 0.0),
        "extraction_started_at":   started_at,
        "extraction_completed_at": cset.get("extraction_completed_at"),
        "elapsed_seconds":     elapsed_seconds,
        "eta_seconds":         eta_seconds,
        "pages_per_second":    pages_per_second,
        "ocr_pages":           ocr_pages_total,
        "text_pages":          text_pages_total,
        "language_pages_breakdown": lang_pages,
        "documents":           doc_rows,
    }


@router.get("/catalog-sets/{set_id}/extraction-summary")
def extraction_summary(set_id: str, ctx=Depends(get_tenant_context)):
    """Final extraction-only summary. Independent from Knowledge Package scoring.

    Per Founder lock ITER195: this report covers ONLY raw extraction quality:
    duration, OCR pages, failed pages, detected language distribution. No
    Brand Atlas readiness, no Academy/Marketboard scoring.
    """
    c = db()
    tid = ctx["tenant_id"]
    cset = _require_set(c, tid, set_id)
    docs = (c.table("brand_catalog_documents")
            .select("id,display_name,original_filename,extraction_status,"
                    "page_count,pages_processed,metrics,extraction_started_at,"
                    "extraction_completed_at,error_logs")
            .eq("catalog_set_id", set_id).eq("tenant_id", tid)
            .order("sort_order").execute().data or [])

    # Duration
    started_at = cset.get("extraction_started_at")
    completed_at = cset.get("extraction_completed_at")
    duration_seconds = None
    if started_at and completed_at:
        try:
            from datetime import datetime as _dt, timezone as _tz
            t0 = _dt.fromisoformat(started_at.replace("Z", "+00:00"))
            t1 = _dt.fromisoformat(completed_at.replace("Z", "+00:00"))
            if t0.tzinfo is None:
                t0 = t0.replace(tzinfo=_tz.utc)
            if t1.tzinfo is None:
                t1 = t1.replace(tzinfo=_tz.utc)
            duration_seconds = max(0, int((t1 - t0).total_seconds()))
        except Exception:
            pass

    completed = [d for d in docs if d["extraction_status"] in ("review", "validated")]
    failed = [d for d in docs if d["extraction_status"] == "failed"]

    ocr_pages_total = sum(int((d.get("metrics") or {}).get("ocr_pages") or 0)
                           for d in completed)
    text_pages_total = sum(int((d.get("metrics") or {}).get("text_pages") or 0)
                            for d in completed)
    pages_processed_total = sum(int(d.get("pages_processed") or 0) for d in docs)
    pages_failed_total = sum(int(d.get("page_count") or 0) for d in failed)

    lang_pages = {"it": 0, "en": 0, "other": 0}
    docs_by_lang = {"it": 0, "en": 0, "other": 0, "unknown": 0}
    for d in completed:
        m = (d.get("metrics") or {})
        b = (m.get("language_pages_breakdown") or {})
        for k in ("it", "en", "other"):
            lang_pages[k] += int(b.get(k) or 0)
        lang = m.get("language") or "unknown"
        if lang not in docs_by_lang:
            lang = "unknown"
        docs_by_lang[lang] += 1

    # Per-doc rows for the report
    doc_report = []
    for d in docs:
        m = (d.get("metrics") or {})
        errs = d.get("error_logs") or []
        first_err = errs[0].get("error") if errs and isinstance(errs[0], dict) else None
        doc_report.append({
            "id": d["id"],
            "filename": d.get("original_filename") or d.get("display_name"),
            "status": d["extraction_status"],
            "page_count": d.get("page_count"),
            "pages_processed": d.get("pages_processed"),
            "ocr_pages": int(m.get("ocr_pages") or 0),
            "text_pages": int(m.get("text_pages") or 0),
            "language": m.get("language") or "unknown",
            "extraction_started_at": d.get("extraction_started_at"),
            "extraction_completed_at": d.get("extraction_completed_at"),
            "error": (first_err[:200] if first_err else None),
        })

    return {
        "catalog_set_id": set_id,
        "catalog_set_name": cset.get("name"),
        "status": cset["status"],
        "documents_total": len(docs),
        "documents_completed": len(completed),
        "documents_failed": len(failed),
        "pages_total": cset.get("total_pages") or 0,
        "pages_processed": pages_processed_total,
        "pages_failed": pages_failed_total,
        "ocr_pages": ocr_pages_total,
        "text_pages": text_pages_total,
        "duration_seconds": duration_seconds,
        "language_pages_breakdown": lang_pages,
        "language_documents_breakdown": docs_by_lang,
        "extraction_started_at": started_at,
        "extraction_completed_at": completed_at,
        "documents": doc_report,
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

    # KE-002.1 · Flat KPI counts for the Control Room strip.
    # Pulled from the REAL data sources (products / pages / relations /
    # entities) so we never show zero on a set with 300+ products.
    try:
        from services.knowledge_kpi import compute_kpi
        kpi = compute_kpi(set_id)
    except Exception:
        kpi = {"products": 0, "designers": 0, "materials": 0,
               "finishes": 0, "images": 0, "relations": 0,
               "aliases": 0, "collections": 0}

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
        # KE-002.1 · Flat counters for Control Room (also mirrored in
        # `product_count`, `designer_count`, etc. for legacy clients).
        "kpi": kpi,
        "product_count":  kpi["products"],
        "designer_count": kpi["designers"],
        "material_count": kpi["materials"],
        "image_count":    kpi["images"],
        "relations_count": kpi["relations"],
        "alias_count":    kpi["aliases"],
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
    """Mark the Catalog Set as published once the ITER201 Publish Gate
    is satisfied (criterion (c)): collections 100% + designers 100%
    + products linked ≥ 80% + graph ≥ 90. Non-critical entities
    (finishes/materials/products in review) do NOT block publish."""
    c = db()
    tid = ctx["tenant_id"]
    cset = _require_set(c, tid, set_id)
    if cset["status"] in ("draft", "uploading"):
        raise HTTPException(409, "Estrazione non eseguita")

    # Apply ITER201 Publish Gate (criterion (c))
    from services import entity_resolution_service as _resolver

    def _readiness(et: str):
        rows = (c.table("brand_detected_entities").select("id,status")
                .eq("catalog_set_id", set_id).eq("entity_type", et)
                .execute().data or [])
        total = len(rows)
        validated = sum(1 for r in rows if r.get("status") == "validated")
        return round(100.0 * validated / total, 2) if total else 100.0

    col_pct = _readiness("collection")
    des_pct = _readiness("designer_registered")
    audit = _resolver.compute_knowledge_audit(set_id)
    total_p = audit.get("metrics", {}).get("products_total", 0) or 0
    linked = audit.get("metrics", {}).get("products_linked_to_collection", 0) or 0
    linked_pct = round(100.0 * linked / total_p, 2) if total_p else 0.0
    graph_pct = audit.get("graph_completeness", 0) or 0
    blockers = []
    if col_pct < 100:  blockers.append(f"Collezioni validate {col_pct}% < 100%")
    if des_pct < 100:  blockers.append(f"Designer validati {des_pct}% < 100%")
    if linked_pct < 80: blockers.append(f"Prodotti linkati {linked_pct}% < 80%")
    if graph_pct < 90: blockers.append(f"Graph completeness {graph_pct} < 90")
    if blockers:
        raise HTTPException(409, "Publish Gate non superato: " + " · ".join(blockers))

    c.table("brand_catalog_sets").update({
        "status": "published",
        "validated_at": _now(),
        "validated_by": ctx.get("profile_id"),
        "published_at": _now(),
        "published_by": ctx.get("profile_id"),
        "updated_at": _now(),
    }).eq("id", set_id).eq("tenant_id", tid).execute()
    return {"catalog_set_id": set_id, "status": "published"}
