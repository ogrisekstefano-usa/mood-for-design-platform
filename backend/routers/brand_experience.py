"""ITER202 · BRAND EXPERIENCE LAYER™ — Digital Brand Embassy™ API.

Endpoints (all under `/api/knowledge`):
  GET   /brands/{id}/embassy             Composite payload for the public brand page
  PATCH /brands/{id}/hero                Admin update of hero_* fields + optional image
  POST  /brands/{id}/hero/upload         Multipart hero image upload (admin/superadmin)
  POST  /brands/{id}/regenerate-mood-dna LLM-generate 3–5 style keywords
  POST  /brands/{id}/link-to-studio      Add to Studio Library™ (tenant ⇄ brand link)
  DELETE /brands/{id}/link-to-studio     Unlink

Strict Lock™: NO knowledge_score / extraction / graph / audit / entity_count
in the designer-facing payload. Those metrics live in the Knowledge Engine
admin layer only. Only the high-level `atlas_certified_at` badge surfaces.
"""
from __future__ import annotations
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel

from database import db, get_admin_client
from core.tenant_context import get_tenant_context

logger = logging.getLogger("brand_experience")
router = APIRouter()

ASSET_BUCKET = "cms-assets"  # reuse existing bucket
MAX_HERO_SIZE_MB = 15


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_brand(c, tenant_id: str, brand_id: str) -> Dict[str, Any]:
    rows = (c.table("brands").select("*").eq("id", brand_id)
            .eq("tenant_id", tenant_id).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Brand non trovato")
    return rows[0]


def _is_admin(ctx) -> bool:
    if ctx.get("is_root_superadmin"):
        return True
    role = (ctx.get("role") or "").lower()
    return role in ("admin", "superadmin", "super_admin", "owner",
                    "studio_owner", "studio_admin")


# ══════════════════════════════════════════════════════════════════════
#  1 · COMPOSITE EMBASSY PAYLOAD
# ══════════════════════════════════════════════════════════════════════
@router.get("/brands/{brand_id}/embassy")
def brand_embassy(brand_id: str, ctx=Depends(get_tenant_context)):
    """Return everything the Digital Brand Embassy™ page needs in ONE call.

    Includes: hero, collections (with image + product count), materials,
    verified designers, products gallery (first 60), mood_dna, story,
    atlas_certified flag, linked_to_studio flag.
    DOES NOT include: knowledge_score, audit metrics, entity counts.
    """
    c = db(); tid = ctx["tenant_id"]
    brand = _require_brand(c, tid, brand_id)

    # Use the most recent certified / needs_review catalog set for this brand
    cset = (c.table("brand_catalog_sets")
            .select("id,status,validated_at,published_at,total_pages,brand_id")
            .eq("brand_id", brand_id).eq("tenant_id", tid)
            .in_("status", ["published", "validated", "needs_review"])
            .order("updated_at", desc=True).limit(1).execute().data or [])
    set_id = cset[0]["id"] if cset else None

    # Helper: get hero image for a product via product_assets
    def _product_image(product_id: str) -> Optional[str]:
        try:
            ass = (c.table("product_assets")
                   .select("metadata_json,is_primary,sort_order,role")
                   .eq("product_id", product_id)
                   .order("is_primary", desc=True)
                   .order("sort_order").limit(5).execute().data or [])
            for a in ass:
                url = (a.get("metadata_json") or {}).get("public_url")
                if url:
                    return url
        except Exception:
            pass
        return None

    # ── Collections (canonical) — with first product image when available
    collections: List[Dict[str, Any]] = []
    if set_id:
        canon = (c.table("collections_canonical")
                 .select("id,display_name,collection_key,metadata_json")
                 .eq("tenant_id", tid).eq("brand_id", brand_id)
                 .execute().data or [])
        canon = [x for x in canon
                 if (x.get("metadata_json") or {}).get("catalog_set_id") == set_id]
        for col in canon:
            prods = (c.table("products")
                     .select("id,product_name,category_label,metadata_json")
                     .eq("canonical_collection_id", col["id"])
                     .limit(20).execute().data or [])
            hero_img = None
            for p in prods:
                hero_img = _product_image(p["id"])
                if hero_img:
                    break
            collections.append({
                "id": col["id"],
                "name": col["display_name"],
                "slug": col.get("collection_key"),
                "kind": (col.get("metadata_json") or {}).get("kind", "detected"),
                "product_count": len(prods),
                "hero_image_url": hero_img,
            })
        collections.sort(key=lambda x: -x["product_count"])

    # ── Materials (canonical entities for this set)
    materials: List[Dict[str, Any]] = []
    if set_id:
        mats = (c.table("brand_detected_entities")
                .select("id,display_name,mention_count,attributes")
                .eq("catalog_set_id", set_id).eq("entity_type", "material")
                .order("mention_count", desc=True).limit(20).execute().data or [])
        for m in mats:
            materials.append({
                "id": m["id"],
                "name": m["display_name"],
                "variant_count": m.get("mention_count") or 0,
            })

    # ── Finishes count (aggregate by canonical_slug)
    finishes_total = 0
    if set_id:
        try:
            fs = (c.table("brand_detected_entities").select("id", count="exact")
                   .eq("catalog_set_id", set_id).eq("entity_type", "finish")
                   .execute())
            finishes_total = fs.count or 0
        except Exception:
            pass

    # ── Designers (registered only)
    designers: List[Dict[str, Any]] = []
    if set_id:
        ds = (c.table("brand_detected_entities")
              .select("id,display_name,attributes,aliases")
              .eq("catalog_set_id", set_id).eq("entity_type", "designer_registered")
              .execute().data or [])
        for d in ds:
            attrs = d.get("attributes") or {}
            designers.append({
                "id": d["id"],
                "name": d["display_name"],
                "verified_by": attrs.get("verified_by"),
                "studio": None,  # future enrichment
                "role": "Designer",
            })

    # ── Products (gallery) — limit 60
    products_gallery: List[Dict[str, Any]] = []
    products_total = 0
    if set_id:
        doc_rows = (c.table("brand_catalog_documents")
                    .select("source_document_id").eq("catalog_set_id", set_id)
                    .execute().data or [])
        src_ids = [d["source_document_id"] for d in doc_rows if d.get("source_document_id")]
        if src_ids:
            ps_count = (c.table("products").select("id", count="exact")
                        .in_("source_document_id", src_ids).execute())
            products_total = ps_count.count or 0
            ps = (c.table("products")
                  .select("id,product_name,category_label,"
                          "canonical_collection_id,metadata_json,materials")
                  .in_("source_document_id", src_ids)
                  .order("confidence_score", desc=True)
                  .limit(80).execute().data or [])
            # Resolve images via product_assets bulk lookup
            ids = [p["id"] for p in ps]
            assets_map: Dict[str, str] = {}
            if ids:
                try:
                    ass = (c.table("product_assets")
                           .select("product_id,metadata_json,is_primary,sort_order")
                           .in_("product_id", ids)
                           .order("is_primary", desc=True)
                           .order("sort_order").limit(500).execute().data or [])
                    for a in ass:
                        pid = a["product_id"]
                        if pid in assets_map: continue
                        url = (a.get("metadata_json") or {}).get("public_url")
                        if url:
                            assets_map[pid] = url
                except Exception:
                    pass
            for p in ps[:60]:
                meta = p.get("metadata_json") or {}
                products_gallery.append({
                    "id": p["id"],
                    "name": p.get("product_name"),
                    "image_url": assets_map.get(p["id"]),
                    "category": meta.get("canonical_category_label")
                                or p.get("category_label"),
                    "category_slug": meta.get("canonical_category"),
                    "collection_id": p.get("canonical_collection_id"),
                    "materials": p.get("materials") or [],
                })

    # ── Hero image: explicit > auto-derived from first product image
    hero_image = brand.get("hero_image_url")
    if not hero_image:
        hero_image = next((p["image_url"] for p in products_gallery if p.get("image_url")), None)

    # ── Studio Library link state
    linked = False
    try:
        lr = (c.table("studio_brand_links").select("id")
              .eq("tenant_id", tid).eq("brand_id", brand_id)
              .limit(1).execute().data or [])
        linked = bool(lr)
    except Exception:
        pass

    # ── Tenant Chameleon™ tokens
    tenant_row = (c.table("tenants")
                  .select("primary_color,secondary_color,font_heading,font_body,"
                          "branding_settings,theme_settings")
                  .eq("id", tid).limit(1).execute().data or [{}])[0]
    theme = {
        "primary_color":   tenant_row.get("primary_color"),
        "secondary_color": tenant_row.get("secondary_color"),
        "font_heading":    tenant_row.get("font_heading"),
        "font_body":       tenant_row.get("font_body"),
        "branding":        tenant_row.get("branding_settings") or {},
        "theme":           tenant_row.get("theme_settings") or {},
    }

    return {
        "brand": {
            "id":          brand["id"],
            "name":        brand["name"],
            "slug":        brand.get("slug"),
            "category":    brand.get("category"),
            "country":     brand.get("country"),
            "website":     brand.get("website"),
            "logo_url":    brand.get("logo_url"),
            "atlas_certified_at": brand.get("atlas_certified_at"),
            "verified":    bool(brand.get("atlas_certified_at")
                                or (cset and cset[0]["status"] == "published")),
        },
        "hero": {
            "image_url":   hero_image,
            "title":       brand.get("hero_title") or brand["name"],
            "subtitle":    brand.get("hero_subtitle"),
            "description": brand.get("hero_description"),
        },
        "mood_dna": brand.get("mood_dna") or [],
        "story": {
            "title": brand.get("story_title"),
            "body":  brand.get("story_body"),
        },
        "collections": collections,
        "materials":   materials,
        "designers":   designers,
        "products":    products_gallery,
        "counts": {
            "collections": len(collections),
            "materials":   len(materials),
            "designers":   len(designers),
            "finishes":    finishes_total,
            "products":    products_total,
        },
        "studio_library": {
            "linked": linked,
        },
        "academy": {
            # Placeholder slot — not built yet
            "modules_count": 0,
            "available": False,
        },
        "theme": theme,
        "ai_search_ready": False,  # Architecture placeholder — embeddings TBD
    }


# ══════════════════════════════════════════════════════════════════════
#  2 · INLINE HERO EDIT (admin only)
# ══════════════════════════════════════════════════════════════════════
class HeroPatch(BaseModel):
    hero_image_url:   Optional[str] = None
    hero_title:       Optional[str] = None
    hero_subtitle:    Optional[str] = None
    hero_description: Optional[str] = None
    story_title:      Optional[str] = None
    story_body:       Optional[str] = None


@router.patch("/brands/{brand_id}/hero")
def patch_hero(brand_id: str, body: HeroPatch,
                ctx=Depends(get_tenant_context)):
    if not _is_admin(ctx):
        raise HTTPException(403, "Solo admin / superadmin")
    c = db(); tid = ctx["tenant_id"]
    _require_brand(c, tid, brand_id)
    update = {k: v for k, v in body.dict().items() if v is not None}
    if not update:
        raise HTTPException(400, "Nessun campo da aggiornare")
    update["updated_at"] = _now()
    c.table("brands").update(update).eq("id", brand_id) \
        .eq("tenant_id", tid).execute()
    rows = (c.table("brands").select("*").eq("id", brand_id).limit(1)
            .execute().data or [])
    return {"ok": True, "brand": rows[0] if rows else None}


@router.post("/brands/{brand_id}/hero/upload")
async def upload_hero(brand_id: str, file: UploadFile = File(...),
                       ctx=Depends(get_tenant_context)):
    """Upload + set hero image. Returns the public URL."""
    if not _is_admin(ctx):
        raise HTTPException(403, "Solo admin / superadmin")
    c = db(); tid = ctx["tenant_id"]
    brand = _require_brand(c, tid, brand_id)
    content = await file.read()
    if len(content) > MAX_HERO_SIZE_MB * 1024 * 1024:
        raise HTTPException(413, f"Immagine > {MAX_HERO_SIZE_MB} MB")
    ext = (file.filename or "hero.jpg").split(".")[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        raise HTTPException(400, "Formato non supportato (jpg/png/webp)")
    path = f"brand-embassy/{tid}/{brand_id}/hero-{uuid.uuid4().hex[:8]}.{ext}"
    admin = get_admin_client()
    if admin is None:
        raise HTTPException(500, "Storage non disponibile")
    try:
        admin.storage.from_(ASSET_BUCKET).upload(
            path, content,
            {"content-type": file.content_type or "image/jpeg",
             "upsert": "true"},
        )
        public_url = admin.storage.from_(ASSET_BUCKET).get_public_url(path)
    except Exception as e:
        logger.warning(f"hero upload err: {e}")
        raise HTTPException(500, f"Upload fallito: {type(e).__name__}")
    c.table("brands").update({
        "hero_image_url": public_url,
        "updated_at": _now(),
    }).eq("id", brand_id).eq("tenant_id", tid).execute()
    return {"ok": True, "hero_image_url": public_url}


# ══════════════════════════════════════════════════════════════════════
#  3 · MOOD DNA™ — LLM-generated style keywords
# ══════════════════════════════════════════════════════════════════════
@router.post("/brands/{brand_id}/regenerate-mood-dna")
async def regenerate_mood_dna(brand_id: str,
                                ctx=Depends(get_tenant_context)):
    """Use Universal LLM Key (Emergent integrations) to generate 3–5
    style keywords for the brand based on its name, category, story
    and the names of its top collections/materials."""
    c = db(); tid = ctx["tenant_id"]
    brand = _require_brand(c, tid, brand_id)

    # Gather context
    cset = (c.table("brand_catalog_sets").select("id")
            .eq("brand_id", brand_id).eq("tenant_id", tid)
            .in_("status", ["published", "validated", "needs_review"])
            .order("updated_at", desc=True).limit(1).execute().data or [])
    set_id = cset[0]["id"] if cset else None
    col_names: List[str] = []
    mat_names: List[str] = []
    if set_id:
        col_names = [r["display_name"] for r in
                     (c.table("brand_detected_entities").select("display_name")
                      .eq("catalog_set_id", set_id).eq("entity_type", "collection")
                      .limit(20).execute().data or [])]
        mat_names = [r["display_name"] for r in
                     (c.table("brand_detected_entities").select("display_name")
                      .eq("catalog_set_id", set_id).eq("entity_type", "material")
                      .limit(20).execute().data or [])]

    prompt = (
        f"You are an editorial brand stylist. Generate exactly 5 short "
        f"premium-design style keywords (1–3 words each, no punctuation, "
        f"Title Case) capturing the design DNA of this brand. Return ONLY "
        f"a JSON array of 5 strings, nothing else.\n\n"
        f"Brand name: {brand.get('name')}\n"
        f"Category: {brand.get('category') or 'design'}\n"
        f"Country: {brand.get('country') or 'IT'}\n"
        f"Existing story: {brand.get('story_body') or '—'}\n"
        f"Top collections: {', '.join(col_names[:10]) or '—'}\n"
        f"Top materials: {', '.join(mat_names[:10]) or '—'}\n"
    )
    # Use Emergent universal key via emergentintegrations library
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise RuntimeError("EMERGENT_LLM_KEY non configurata")
        chat = (LlmChat(api_key=api_key,
                        session_id=f"mood-dna-{brand_id}",
                        system_message="You generate concise editorial style keywords.")
                .with_model("anthropic", "claude-sonnet-4-5-20250929"))
        resp = await chat.send_message(UserMessage(text=prompt))
        text = resp.strip() if isinstance(resp, str) else str(resp)
        # Best-effort extraction of JSON array
        import json, re
        m = re.search(r"\[.*\]", text, re.S)
        keywords = json.loads(m.group(0)) if m else []
        keywords = [str(k).strip() for k in keywords if k and isinstance(k, (str, int))][:5]
    except Exception as e:
        logger.warning(f"mood_dna llm err: {e}")
        # Sensible fallback per category
        cat = (brand.get("category") or "").lower()
        keywords = {
            "bathroom":  ["Wellness", "Italian Bathroom Architecture",
                          "Contemporary Elegance", "Material Intelligence",
                          "Technical Craftsmanship"],
            "kitchen":   ["Culinary Architecture", "Italian Cabinetry",
                          "Quiet Luxury", "Modular Living",
                          "Workshop Craftsmanship"],
            "stone":     ["Natural Stone", "Quarried Italy",
                          "Timeless Materials", "Sculpted Surfaces",
                          "Geological Heritage"],
            "lighting":  ["Luminous Sculpture", "Designed Atmosphere",
                          "Italian Lighting", "Architectural Glow",
                          "Material Light"],
        }.get(cat, ["Editorial Design", "Italian Heritage",
                    "Material Intelligence", "Contemporary Craft",
                    "Timeless Detail"])

    c.table("brands").update({
        "mood_dna": keywords,
        "updated_at": _now(),
    }).eq("id", brand_id).eq("tenant_id", tid).execute()
    return {"ok": True, "mood_dna": keywords}


# ══════════════════════════════════════════════════════════════════════
#  4 · ADD TO STUDIO LIBRARY™
# ══════════════════════════════════════════════════════════════════════
class StudioLinkBody(BaseModel):
    note: Optional[str] = None


@router.post("/brands/{brand_id}/link-to-studio")
def link_to_studio(brand_id: str, body: StudioLinkBody = StudioLinkBody(),
                    ctx=Depends(get_tenant_context)):
    c = db(); tid = ctx["tenant_id"]
    _require_brand(c, tid, brand_id)
    existing = (c.table("studio_brand_links").select("id")
                .eq("tenant_id", tid).eq("brand_id", brand_id)
                .limit(1).execute().data or [])
    if existing:
        return {"ok": True, "linked": True, "already_linked": True}
    c.table("studio_brand_links").insert({
        "id":        str(uuid.uuid4()),
        "tenant_id": tid,
        "brand_id":  brand_id,
        "linked_by": ctx.get("profile_id"),
        "linked_at": _now(),
        "note":      body.note,
    }).execute()
    return {"ok": True, "linked": True}


@router.delete("/brands/{brand_id}/link-to-studio")
def unlink_from_studio(brand_id: str, ctx=Depends(get_tenant_context)):
    c = db(); tid = ctx["tenant_id"]
    _require_brand(c, tid, brand_id)
    c.table("studio_brand_links").delete() \
        .eq("tenant_id", tid).eq("brand_id", brand_id).execute()
    return {"ok": True, "linked": False}
