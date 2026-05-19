"""Supplier Catalog Import™ router.

Endpoint set:
  POST  /api/inspirations/catalogs                    create catalog draft
  POST  /api/inspirations/catalogs/{id}/upload-pdf    upload PDF + extract candidates
  GET   /api/inspirations/catalogs/{id}               read catalog (with candidates)
  PATCH /api/inspirations/catalogs/{id}/candidates    edit candidate names/categories
  POST  /api/inspirations/catalogs/{id}/finalize      persist selected candidates as
                                                      Product Inspirations in media_library
  GET   /api/inspirations/catalogs                    list catalogs (Studio Collections™)
  DELETE /api/inspirations/catalogs/{id}              archive

Design principles:
  • The PDF parent file lives once in media_library (bucket='catalog-sources').
  • Each accepted candidate becomes its OWN media_library row with
    is_inspiration=true, inspiration_meta.inspiration_type='product',
    linked back to the parent via inspiration_meta.supplier_catalog_id and
    original_catalog_file_id.
  • No PIM bloat — only the fields the user actually fills.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from core.tenant_context import get_tenant_context
from cultural_engine import catalog_extractor
from database import db, get_admin_client

logger = logging.getLogger(__name__)
router = APIRouter()

CATALOG_BUCKET    = "catalog-sources"     # PDF/ZIP originals (private)
CANDIDATE_BUCKET  = "cms-assets"           # extracted product images (public)

CATALOG_CATEGORIES = [
    {"key": "arredi",            "label": "Arredi"},
    {"key": "cucine",            "label": "Cucine"},
    {"key": "bagni",             "label": "Bagni"},
    {"key": "illuminazione",     "label": "Illuminazione"},
    {"key": "outdoor",           "label": "Outdoor"},
    {"key": "pietra_materiali",  "label": "Pietra e materiali"},
    {"key": "tessuti",           "label": "Tessuti"},
    {"key": "decorazione",       "label": "Decorazione"},
    {"key": "contract",          "label": "Contract / hospitality"},
    {"key": "altro",             "label": "Altro"},
]

RIGHTS_STATUSES = [
    {"key": "uploaded_by_tenant",  "label": "Caricato dallo studio"},
    {"key": "supplier_authorized", "label": "Autorizzato dal fornitore"},
    {"key": "external_reference",  "label": "Riferimento esterno"},
    {"key": "unknown",             "label": "Diritti da verificare"},
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slim_catalog(row: Dict[str, Any]) -> Dict[str, Any]:
    """Strip Supabase _id and shape consistently for the frontend."""
    if not row:
        return {}
    out = {k: v for k, v in row.items() if k != "_id"}
    return out


# ─── Models ────────────────────────────────────────────────────────────
class CatalogCreate(BaseModel):
    brand:          Optional[str] = None  # legacy / fallback when no brand_id
    brand_id:       Optional[str] = None  # NEW — preferred (Brand Registry™)
    collection_id:  Optional[str] = None  # NEW — Collection Registry™
    supplier_name:  Optional[str] = None
    collection:     Optional[str] = None
    catalog_year:   Optional[int] = None
    category:       Optional[str] = None
    rights_status:  Optional[str] = "studio_uploaded"
    note:           Optional[str] = None


class CandidatePatch(BaseModel):
    """Per-candidate edits in the review grid (page_number is the key)."""
    page_number:   int
    product_name:  Optional[str] = None
    designer:      Optional[str] = None
    category_hint: Optional[str] = None
    selected:      Optional[bool] = None


class CandidatesPatchBody(BaseModel):
    candidates: List[CandidatePatch]


class FinalizeBody(BaseModel):
    # Optional batch defaults applied to every imported Product Inspiration
    default_atmosphere:   Optional[List[str]] = None
    default_material:     Optional[List[str]] = None
    default_markets:      Optional[List[str]] = None
    default_luxury_level: Optional[str] = None
    default_hospitality_profile: Optional[str] = None
    default_room_type:    Optional[str] = None


# ─── Helpers ───────────────────────────────────────────────────────────
def _require_catalog(c, tid: str, cid: str) -> Dict[str, Any]:
    rows = (c.table("supplier_catalogs").select("*")
            .eq("id", cid).eq("tenant_id", tid).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Catalogo fornitore non trovato")
    return rows[0]


def _upload_bytes(bucket: str, path: str, content: bytes,
                  content_type: str, public: bool = True) -> str:
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
    if public:
        info = admin.storage.from_(bucket).get_public_url(path)
        url = info.get("publicURL") or info.get("publicUrl") if isinstance(info, dict) else info
    else:
        # Long signed URL for private buckets (catalog source PDFs)
        signed = admin.storage.from_(bucket).create_signed_url(path, 60 * 60 * 24 * 365)
        url = (signed.get("signedURL") or signed.get("signed_url") or signed.get("signedUrl")) \
              if isinstance(signed, dict) else signed
    if not isinstance(url, str):
        raise HTTPException(500, "Public URL non disponibile.")
    return url.rstrip("?")


# ─── Endpoints ─────────────────────────────────────────────────────────
@router.get("/catalogs/taxonomy")
def catalog_taxonomy():
    """Public taxonomy for the wizard (no auth dep — read-only)."""
    return {
        "categories":     CATALOG_CATEGORIES,
        "rights_statuses": RIGHTS_STATUSES,
    }


@router.post("/catalogs", status_code=201)
def create_catalog(body: CatalogCreate, ctx=Depends(get_tenant_context)):
    """Create an empty supplier catalog (Step 1 of the wizard).

    Brand resolution priority: brand_id (Brand Registry™) > brand (legacy text).
    If brand_id is provided we hydrate brand/collection names from the registry.
    """
    c = db()
    tid = ctx["tenant_id"]

    # Resolve brand identity
    brand_id: Optional[str] = body.brand_id
    brand_name: Optional[str] = (body.brand or "").strip() or None
    collection_id: Optional[str] = body.collection_id
    collection_name: Optional[str] = (body.collection or "").strip() or None

    if brand_id:
        b = (c.table("brands").select("id,name,category")
             .or_(f"tenant_id.is.null,tenant_id.eq.{tid}")
             .eq("id", brand_id).limit(1).execute().data or [])
        if not b:
            raise HTTPException(400, "Produttore non trovato nel Brand Registry™")
        brand_name = b[0]["name"]
        # If category not explicitly set, inherit from brand
        if not body.category and b[0].get("category"):
            body.category = b[0]["category"]

    if collection_id:
        col = (c.table("brand_collections").select("id,name,brand_id")
               .eq("id", collection_id).limit(1).execute().data or [])
        if not col:
            raise HTTPException(400, "Collezione non trovata")
        if brand_id and col[0]["brand_id"] != brand_id:
            raise HTTPException(400, "La collezione non appartiene al produttore selezionato")
        collection_name = col[0]["name"]

    if not brand_name:
        raise HTTPException(400, "Indica il produttore (Brand Registry™ o nome libero)")

    cid = str(uuid.uuid4())
    row = {
        "id":             cid,
        "tenant_id":      tid,
        "brand":          brand_name,
        "brand_id":       brand_id,
        "supplier_name":  (body.supplier_name or "").strip() or None,
        "collection":     collection_name,
        "collection_id":  collection_id,
        "catalog_year":   body.catalog_year,
        "category":       body.category,
        "rights_status":  body.rights_status or "studio_uploaded",
        "status":         "draft",
        "created_by":     ctx.get("profile_id"),
        "created_at":     _now(),
        "updated_at":     _now(),
    }
    c.table("supplier_catalogs").insert(row).execute()
    return _slim_catalog(row)


@router.post("/catalogs/{cid}/upload-pdf", status_code=200)
async def upload_pdf(cid: str,
                     file: UploadFile = File(...),
                     ctx=Depends(get_tenant_context)):
    """Upload a PDF catalog → store original in Storage → run extraction.

    The candidate images are also uploaded so the review grid can display
    them via signed/public URLs. Candidates are persisted in the catalog's
    `extraction_payload` for the user's review step.
    """
    c = db()
    tid = ctx["tenant_id"]
    cat = _require_catalog(c, tid, cid)

    if not file.content_type or "pdf" not in file.content_type.lower():
        raise HTTPException(400, "Atteso un file PDF")

    content = await file.read()
    if len(content) < 1024:
        raise HTTPException(400, "PDF troppo piccolo / vuoto")

    # 1) Upload PDF original (catalog-sources bucket)
    pdf_path = f"{tid}/catalogs/{cid}/source.pdf"
    pdf_url  = _upload_bytes(CATALOG_BUCKET, pdf_path, content, "application/pdf", public=False)

    # Register the PDF in media_library as the parent file
    parent_id = str(uuid.uuid4())
    parent_row = {
        "id":             parent_id,
        "tenant_id":      tid,
        "uploaded_by":    ctx.get("profile_id"),
        "bucket":         CATALOG_BUCKET,
        "storage_path":   pdf_path,
        "file_url":       pdf_url,
        "file_name":      (file.filename or "catalog.pdf")[:120],
        "file_type":      "application/pdf",
        "file_size":      len(content),
        "category":       "catalog_source",
        "tags":           ["catalog", "supplier", cat["brand"]],
        "metadata_json":  {"supplier_catalog_id": cid},
        "is_inspiration": False,
        "created_at":     _now(),
        "updated_at":     _now(),
    }
    try:
        c.table("media_library").insert(parent_row).execute()
    except Exception as e:
        logger.warning(f"PDF parent row insert failed (continuing): {e}")

    # 2) Extract candidates
    c.table("supplier_catalogs").update(
        {"status": "extracting", "updated_at": _now()}
    ).eq("id", cid).execute()

    try:
        result = catalog_extractor.extract_candidates(content, brand=cat["brand"])
    except Exception as e:
        c.table("supplier_catalogs").update(
            {"status": "draft", "updated_at": _now()}
        ).eq("id", cid).execute()
        raise HTTPException(400, f"Estrazione non riuscita: {e}")

    raw_candidates = result.pop("_raw_candidates", [])

    # 3) Upload each candidate image and enrich payload with image_url
    candidates_out: List[Dict[str, Any]] = []
    for idx, rc in enumerate(raw_candidates):
        ext = rc.image_ext or "png"
        img_path = f"{tid}/catalogs/{cid}/p{rc.page_number:03d}-{idx:02d}.{ext}"
        try:
            content_type = "image/jpeg" if ext == "jpg" else "image/png"
            img_url = _upload_bytes(CANDIDATE_BUCKET, img_path, rc.image_bytes, content_type, public=True)
        except Exception as e:
            logger.warning(f"candidate upload failed page {rc.page_number}: {e}")
            continue
        candidates_out.append({
            "page_number":   rc.page_number,
            "image_url":     img_url,
            "storage_path":  img_path,
            "image_ext":     ext,
            "width":         rc.width,
            "height":        rc.height,
            "product_name":  rc.product_name,
            "designer":      rc.designer,
            "category_hint": rc.category_hint,
            "confidence":    rc.confidence,
            # Pre-selected only if we have a name (high-confidence candidates)
            "selected":      bool(rc.product_name),
            "media_id":      None,
        })

    payload = {
        "candidates":  candidates_out,
        "pages":       result["pages"],
        "method":      result["method"],
        "warnings":    result["warnings"],
        "extracted_at": _now(),
    }

    c.table("supplier_catalogs").update({
        "source_file_id":     parent_id,
        "source_file_url":    pdf_url,
        "source_file_kind":   "pdf",
        "extraction_payload": payload,
        "candidate_count":    len(candidates_out),
        "status":             "review",
        "updated_at":         _now(),
    }).eq("id", cid).execute()

    return {
        "catalog_id":      cid,
        "candidates":      candidates_out,
        "pages":           result["pages"],
        "warnings":        result["warnings"],
        "source_file_url": pdf_url,
    }


@router.get("/catalogs/{cid}")
def get_catalog(cid: str, ctx=Depends(get_tenant_context)):
    c = db()
    cat = _require_catalog(c, ctx["tenant_id"], cid)
    return _slim_catalog(cat)


@router.patch("/catalogs/{cid}/candidates")
def patch_candidates(cid: str, body: CandidatesPatchBody, ctx=Depends(get_tenant_context)):
    """Apply per-row edits from the review grid (name/category/selected)."""
    c = db()
    cat = _require_catalog(c, ctx["tenant_id"], cid)
    payload = cat.get("extraction_payload") or {}
    cands: List[Dict[str, Any]] = payload.get("candidates") or []
    patch_by_page = {p.page_number: p for p in body.candidates}
    for cand in cands:
        p = patch_by_page.get(cand.get("page_number"))
        if not p: continue
        if p.product_name  is not None: cand["product_name"]  = p.product_name or None
        if p.designer      is not None: cand["designer"]      = p.designer or None
        if p.category_hint is not None: cand["category_hint"] = p.category_hint or None
        if p.selected      is not None: cand["selected"]      = bool(p.selected)
    payload["candidates"] = cands
    c.table("supplier_catalogs").update({
        "extraction_payload": payload,
        "updated_at":         _now(),
    }).eq("id", cid).execute()
    return {"updated": len(body.candidates)}


@router.post("/catalogs/{cid}/finalize", status_code=201)
def finalize_catalog(cid: str, body: FinalizeBody, ctx=Depends(get_tenant_context)):
    """Persist all selected candidates as Product Inspirations in media_library."""
    c = db()
    tid = ctx["tenant_id"]
    cat = _require_catalog(c, tid, cid)
    payload = cat.get("extraction_payload") or {}
    cands = [x for x in (payload.get("candidates") or []) if x.get("selected")]
    if not cands:
        raise HTTPException(400, "Nessun candidato selezionato")

    now = _now()
    inserted_ids: List[str] = []
    base_meta = {
        "inspiration_type":     "product",
        "supplier_catalog_id":  cid,
        "brand_id":             cat.get("brand_id"),
        "collection_id":        cat.get("collection_id"),
        "brand":                cat.get("brand"),
        "collection":           cat.get("collection"),
        "product_category":     cat.get("category"),
        "supplier_name":        cat.get("supplier_name"),
        "rights_status":        cat.get("rights_status") or "studio_uploaded",
        "original_catalog_file_id": cat.get("source_file_id"),
        # batch defaults
        "atmosphere_tags":      body.default_atmosphere or [],
        "material_tags":        body.default_material or [],
        "market_codes":         body.default_markets or [],
        "luxury_level":         body.default_luxury_level,
        "hospitality_profile":  body.default_hospitality_profile,
        "room_type":            body.default_room_type,
    }
    base_meta = {k: v for k, v in base_meta.items() if v is not None}

    for cand in cands:
        if cand.get("media_id"):
            # Already finalized once — skip (idempotency)
            continue
        mid = str(uuid.uuid4())
        meta = {
            **base_meta,
            "product_name":  cand.get("product_name"),
            "designer":      cand.get("designer"),
            "page_number":   cand.get("page_number"),
            # Per-candidate override of category if heuristic detected one
            "product_category": cand.get("category_hint") or base_meta.get("product_category"),
        }
        meta = {k: v for k, v in meta.items() if v is not None}

        ml_row = {
            "id":               mid,
            "tenant_id":        tid,
            "uploaded_by":      ctx.get("profile_id"),
            "bucket":           CANDIDATE_BUCKET,
            "storage_path":     cand.get("storage_path") or f"catalogs/{cid}/p{cand['page_number']}",
            "file_url":         cand.get("image_url"),
            "file_name":        f"{cat.get('brand')} · {cand.get('product_name') or 'p.'+str(cand.get('page_number'))}",
            "file_type":        f"image/{cand.get('image_ext') or 'png'}",
            "file_size":        None,
            "width":            cand.get("width"),
            "height":           cand.get("height"),
            "alt_text":         cand.get("product_name"),
            "description":      None,
            "category":         "inspiration",
            "tags":             ["inspiration", "product", cat.get("brand")],
            "metadata_json":    {"supplier_catalog_id": cid, "page_number": cand.get("page_number")},
            "is_inspiration":   True,
            "inspiration_meta": meta,
            "source_kind":      "supplier_catalog",
            "created_at":       now,
            "updated_at":       now,
        }
        try:
            c.table("media_library").insert(ml_row).execute()
            cand["media_id"] = mid
            inserted_ids.append(mid)
        except Exception as e:
            logger.error(f"finalize: insert failed for page {cand.get('page_number')}: {e}")

    # Refresh catalog status
    payload["candidates"] = (payload.get("candidates") or [])  # keep references with media_id
    c.table("supplier_catalogs").update({
        "extraction_payload":   payload,
        "imported_count":       cat.get("imported_count", 0) + len(inserted_ids),
        "default_atmosphere":   body.default_atmosphere or [],
        "default_material":     body.default_material or [],
        "default_markets":      body.default_markets or [],
        "default_luxury_level": body.default_luxury_level,
        "default_hospitality_profile": body.default_hospitality_profile,
        "default_room_type":    body.default_room_type,
        "status":               "imported",
        "updated_at":           now,
    }).eq("id", cid).execute()

    return {
        "catalog_id":  cid,
        "imported":    len(inserted_ids),
        "media_ids":   inserted_ids,
    }


@router.get("/catalogs")
def list_catalogs(ctx=Depends(get_tenant_context)):
    """Studio Collections™ — list of imported catalogs (grouping view)."""
    c = db()
    rows = (c.table("supplier_catalogs").select(
        "id,brand,supplier_name,collection,catalog_year,category,"
        "rights_status,status,candidate_count,imported_count,"
        "source_file_url,created_at,updated_at"
    ).eq("tenant_id", ctx["tenant_id"])
     .order("created_at", desc=True)
     .limit(200).execute().data or [])
    return {"items": rows}


@router.delete("/catalogs/{cid}", status_code=204)
def archive_catalog(cid: str, ctx=Depends(get_tenant_context)):
    """Soft-archive (status='archived'). Keeps imported Product Inspirations live."""
    c = db()
    _require_catalog(c, ctx["tenant_id"], cid)
    c.table("supplier_catalogs").update(
        {"status": "archived", "updated_at": _now()}
    ).eq("id", cid).execute()
    return None
