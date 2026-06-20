"""
FAQ Router — public read + admin CRUD.

Single source of truth: faq_categories + faq_items + cms_sections (section_type='faq_page').

Public:
    GET /api/site/faq?locale=it-IT&q=…&category=slug
      → fully-resolved page + categories + items in the requested locale,
        plus a JSON-LD FAQPage schema ready to be embedded.

Admin (require_admin_tenant — tenant scoped, NO cross-tenant leak):
    GET    /api/admin/site/faq/categories
    POST   /api/admin/site/faq/categories
    PATCH  /api/admin/site/faq/categories/{id}
    DELETE /api/admin/site/faq/categories/{id}
    POST   /api/admin/site/faq/categories/reorder
    GET    /api/admin/site/faq/items
    POST   /api/admin/site/faq/items
    PATCH  /api/admin/site/faq/items/{id}
    DELETE /api/admin/site/faq/items/{id}
    POST   /api/admin/site/faq/items/reorder

There is NO hardcoded category list, NO hardcoded translation, NO seed.
The page is empty until the admin creates content.
"""
from __future__ import annotations

from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text

from database import AsyncSessionLocal
from tenant_resolver import get_corporate_tenant
from ._auth import require_admin_tenant


async def resolve_corporate_tenant_id() -> str | None:
    t = await get_corporate_tenant()
    return t["id"] if t else None


public_router = APIRouter(prefix="/site",        tags=["site-faq"])
admin_router  = APIRouter(prefix="/admin/site",  tags=["admin-faq"])


# ── helpers ────────────────────────────────────────────────────────────

def _localized(lc: dict | None, locale: str, fallback_locales: List[str]) -> dict:
    """Return locale_content[locale] with graceful fallback chain."""
    lc = lc or {}
    if locale in lc and isinstance(lc[locale], dict):
        return lc[locale]
    # try language root (e.g. 'it' for 'it-IT')
    lang = locale.split('-')[0] if '-' in locale else locale
    for k in [lang] + list(lc.keys()) + fallback_locales:
        if k in lc and isinstance(lc[k], dict):
            return lc[k]
    return {}


def _build_jsonld(categories: list[dict]) -> dict:
    """FAQPage schema.org JSON-LD built ONLY from CMS content."""
    main_entity = []
    for cat in categories:
        for item in cat.get("items", []):
            q = (item.get("question") or "").strip()
            a = (item.get("answer") or "").strip()
            if not q or not a:
                continue
            main_entity.append({
                "@type": "Question",
                "name":  q,
                "acceptedAnswer": {"@type": "Answer", "text": a},
            })
    return {
        "@context":   "https://schema.org",
        "@type":      "FAQPage",
        "mainEntity": main_entity,
    }


# ── PUBLIC ─────────────────────────────────────────────────────────────

@public_router.get("/faq")
async def public_faq(
    locale:   str          = Query("it-IT"),
    q:        Optional[str] = None,
    category: Optional[str] = None,
):
    """
    Returns:
      {
        page:       {hero:{...}, finalCta:{...}, seo:{title,description}},
        categories: [{id, slug, title, description, items:[{id, question, answer}]}],
        jsonld:     {@context, @type:FAQPage, mainEntity:[...]}
      }
    All localized. ALL content is from CMS — never hardcoded.
    """
    tid = await resolve_corporate_tenant_id()
    if not tid:
        raise HTTPException(404, "Site not configured")

    fallback = ["en-US", "it-IT", "en", "it"]

    async with AsyncSessionLocal() as s:
        # --- page meta from cms_sections section_type='faq_page' ----------
        sec = (await s.execute(
            text("""
                SELECT locale_content
                  FROM cms_sections s
                  JOIN cms_pages   p ON p.id = s.page_id
                 WHERE p.tenant_id   = :tid
                   AND p.page_key    = 'faq'
                   AND s.section_type = 'faq_page'
                 LIMIT 1
            """),
            {"tid": tid},
        )).first()
        page_lc = _localized(sec[0] if sec else None, locale, fallback) if sec else {}

        # --- categories ---------------------------------------------------
        cat_rows = (await s.execute(
            text("""
                SELECT id, slug, sort_order, locale_content
                  FROM faq_categories
                 WHERE tenant_id = :tid AND visible = true AND deleted_at IS NULL
                 ORDER BY sort_order, slug
            """),
            {"tid": tid},
        )).mappings().all()

        # --- items (one query, group client-side) -------------------------
        item_rows = (await s.execute(
            text("""
                SELECT id, category_id, sort_order, locale_content
                  FROM faq_items
                 WHERE tenant_id = :tid AND visible = true AND deleted_at IS NULL
                 ORDER BY sort_order, created_at
            """),
            {"tid": tid},
        )).mappings().all()

        # Resolve to locale and assemble
        categories: list[dict] = []
        items_by_cat: dict = {}
        for it in item_rows:
            items_by_cat.setdefault(str(it["category_id"]), []).append(it)

        q_lower = (q or "").strip().lower()
        for c in cat_rows:
            ctitle_d = _localized(c["locale_content"], locale, fallback)
            cat_slug = c["slug"]
            if category and cat_slug != category:
                continue

            resolved_items = []
            for it in items_by_cat.get(str(c["id"]), []):
                lt = _localized(it["locale_content"], locale, fallback)
                question = (lt.get("question") or "").strip()
                answer   = (lt.get("answer")   or "").strip()
                if not question and not answer:
                    continue
                if q_lower:
                    haystack = (
                        question.lower() + ' ' +
                        answer.lower()   + ' ' +
                        (ctitle_d.get("title") or "").lower()
                    )
                    if q_lower not in haystack:
                        continue
                resolved_items.append({
                    "id":       str(it["id"]),
                    "question": question,
                    "answer":   answer,
                })

            if q_lower and not resolved_items:
                continue   # hide empty category on search

            categories.append({
                "id":          str(c["id"]),
                "slug":        cat_slug,
                "title":       ctitle_d.get("title")       or "",
                "description": ctitle_d.get("description") or "",
                "items":       resolved_items,
            })

    return {
        "page": {
            "hero": {
                "eyebrow":          page_lc.get("hero_eyebrow")          or "",
                "title":            page_lc.get("hero_title")            or "",
                "body":             page_lc.get("hero_body")             or "",
                "primary_cta_label":page_lc.get("hero_primary_cta_label")or "",
                "primary_cta_url":  page_lc.get("hero_primary_cta_url")  or "",
            },
            "finalCta": {
                "eyebrow":           page_lc.get("final_cta_eyebrow")          or "",
                "title":             page_lc.get("final_cta_title")            or "",
                "body":              page_lc.get("final_cta_body")             or "",
                "primary_label":     page_lc.get("final_cta_primary_label")    or "",
                "primary_url":       page_lc.get("final_cta_primary_url")      or "",
                "secondary_label":   page_lc.get("final_cta_secondary_label")  or "",
                "secondary_url":     page_lc.get("final_cta_secondary_url")    or "",
            },
            "seo": {
                "title":       page_lc.get("seo_title")       or "",
                "description": page_lc.get("seo_description") or "",
            },
        },
        "categories": categories,
        "jsonld":     _build_jsonld(categories),
        "locale":     locale,
    }


# ── ADMIN ──────────────────────────────────────────────────────────────

class CategoryUpsert(BaseModel):
    slug:           str               = Field(..., min_length=1, max_length=64)
    sort_order:     int               = 0
    visible:        bool              = True
    locale_content: dict              = Field(default_factory=dict)


class ItemUpsert(BaseModel):
    category_id:    UUID
    sort_order:     int               = 0
    visible:        bool              = True
    locale_content: dict              = Field(default_factory=dict)


class ReorderEntry(BaseModel):
    id:         UUID
    sort_order: int


class ReorderPayload(BaseModel):
    entries: List[ReorderEntry]


@admin_router.get("/faq/categories")
async def admin_list_categories(tenant: dict = Depends(require_admin_tenant)):
    async with AsyncSessionLocal() as s:
        rows = (await s.execute(
            text("""
                SELECT id, slug, sort_order, visible, locale_content, created_at, updated_at
                  FROM faq_categories
                 WHERE tenant_id = :tid AND deleted_at IS NULL
                 ORDER BY sort_order, slug
            """),
            {"tid": tenant["id"]},
        )).mappings().all()
        return {"categories": [
            {
                "id":             str(r["id"]),
                "slug":           r["slug"],
                "sort_order":     r["sort_order"],
                "visible":        r["visible"],
                "locale_content": r["locale_content"] or {},
                "created_at":     r["created_at"].isoformat() if r["created_at"] else None,
                "updated_at":     r["updated_at"].isoformat() if r["updated_at"] else None,
            }
            for r in rows
        ]}


@admin_router.post("/faq/categories")
async def admin_create_category(body: CategoryUpsert,
                                 tenant: dict = Depends(require_admin_tenant)):
    async with AsyncSessionLocal() as s:
        try:
            row = (await s.execute(
                text("""
                    INSERT INTO faq_categories (tenant_id, slug, sort_order, visible, locale_content)
                    VALUES (:tid, :slug, :so, :vis, CAST(:lc AS jsonb))
                    RETURNING id
                """),
                {"tid": tenant["id"], "slug": body.slug, "so": body.sort_order,
                 "vis": body.visible,  "lc": _json(body.locale_content)},
            )).first()
            await s.commit()
            return {"id": str(row[0])}
        except Exception as e:
            await s.rollback()
            if "duplicate key" in str(e).lower():
                raise HTTPException(409, "Slug già esistente per questo tenant")
            raise HTTPException(400, f"Errore creazione categoria: {e}")


@admin_router.patch("/faq/categories/{cid}")
async def admin_update_category(cid: UUID, body: CategoryUpsert,
                                 tenant: dict = Depends(require_admin_tenant)):
    async with AsyncSessionLocal() as s:
        res = await s.execute(
            text("""
                UPDATE faq_categories
                   SET slug=:slug, sort_order=:so, visible=:vis,
                       locale_content = CAST(:lc AS jsonb)
                 WHERE id=:id AND tenant_id=:tid AND deleted_at IS NULL
            """),
            {"id": str(cid), "tid": tenant["id"],
             "slug": body.slug, "so": body.sort_order, "vis": body.visible,
             "lc": _json(body.locale_content)},
        )
        if res.rowcount == 0:
            await s.rollback()
            raise HTTPException(404, "Categoria non trovata")
        await s.commit()
        return {"ok": True}


@admin_router.delete("/faq/categories/{cid}")
async def admin_delete_category(cid: UUID,
                                 tenant: dict = Depends(require_admin_tenant)):
    async with AsyncSessionLocal() as s:
        res = await s.execute(
            text("UPDATE faq_categories SET deleted_at=now() WHERE id=:id AND tenant_id=:tid"),
            {"id": str(cid), "tid": tenant["id"]},
        )
        if res.rowcount == 0:
            await s.rollback()
            raise HTTPException(404, "Categoria non trovata")
        await s.commit()
        return {"ok": True}


@admin_router.post("/faq/categories/reorder")
async def admin_reorder_categories(body: ReorderPayload,
                                    tenant: dict = Depends(require_admin_tenant)):
    async with AsyncSessionLocal() as s:
        for e in body.entries:
            await s.execute(
                text("UPDATE faq_categories SET sort_order=:so WHERE id=:id AND tenant_id=:tid"),
                {"so": e.sort_order, "id": str(e.id), "tid": tenant["id"]},
            )
        await s.commit()
        return {"ok": True}


@admin_router.get("/faq/items")
async def admin_list_items(tenant: dict = Depends(require_admin_tenant),
                            category_id: Optional[UUID] = None):
    async with AsyncSessionLocal() as s:
        sql = """
            SELECT id, category_id, sort_order, visible, locale_content, created_at, updated_at
              FROM faq_items
             WHERE tenant_id = :tid AND deleted_at IS NULL
        """
        params = {"tid": tenant["id"]}
        if category_id:
            sql += " AND category_id = :cid"
            params["cid"] = str(category_id)
        sql += " ORDER BY sort_order, created_at"
        rows = (await s.execute(text(sql), params)).mappings().all()
        return {"items": [
            {
                "id":             str(r["id"]),
                "category_id":    str(r["category_id"]),
                "sort_order":     r["sort_order"],
                "visible":        r["visible"],
                "locale_content": r["locale_content"] or {},
                "created_at":     r["created_at"].isoformat() if r["created_at"] else None,
                "updated_at":     r["updated_at"].isoformat() if r["updated_at"] else None,
            }
            for r in rows
        ]}


@admin_router.post("/faq/items")
async def admin_create_item(body: ItemUpsert,
                             tenant: dict = Depends(require_admin_tenant)):
    async with AsyncSessionLocal() as s:
        owner = (await s.execute(
            text("SELECT 1 FROM faq_categories WHERE id=:id AND tenant_id=:tid AND deleted_at IS NULL"),
            {"id": str(body.category_id), "tid": tenant["id"]},
        )).first()
        if not owner:
            raise HTTPException(400, "Categoria non valida per questo tenant")
        row = (await s.execute(
            text("""
                INSERT INTO faq_items (tenant_id, category_id, sort_order, visible, locale_content)
                VALUES (:tid, :cid, :so, :vis, CAST(:lc AS jsonb))
                RETURNING id
            """),
            {"tid": tenant["id"], "cid": str(body.category_id),
             "so":  body.sort_order, "vis": body.visible,
             "lc":  _json(body.locale_content)},
        )).first()
        await s.commit()
        return {"id": str(row[0])}


@admin_router.patch("/faq/items/{iid}")
async def admin_update_item(iid: UUID, body: ItemUpsert,
                             tenant: dict = Depends(require_admin_tenant)):
    async with AsyncSessionLocal() as s:
        owner = (await s.execute(
            text("SELECT 1 FROM faq_categories WHERE id=:id AND tenant_id=:tid AND deleted_at IS NULL"),
            {"id": str(body.category_id), "tid": tenant["id"]},
        )).first()
        if not owner:
            raise HTTPException(400, "Categoria non valida per questo tenant")
        res = await s.execute(
            text("""
                UPDATE faq_items
                   SET category_id=:cid, sort_order=:so, visible=:vis,
                       locale_content = CAST(:lc AS jsonb)
                 WHERE id=:id AND tenant_id=:tid AND deleted_at IS NULL
            """),
            {"id": str(iid), "tid": tenant["id"],
             "cid": str(body.category_id), "so": body.sort_order, "vis": body.visible,
             "lc": _json(body.locale_content)},
        )
        if res.rowcount == 0:
            await s.rollback()
            raise HTTPException(404, "Item non trovato")
        await s.commit()
        return {"ok": True}


@admin_router.delete("/faq/items/{iid}")
async def admin_delete_item(iid: UUID,
                             tenant: dict = Depends(require_admin_tenant)):
    async with AsyncSessionLocal() as s:
        res = await s.execute(
            text("UPDATE faq_items SET deleted_at=now() WHERE id=:id AND tenant_id=:tid"),
            {"id": str(iid), "tid": tenant["id"]},
        )
        if res.rowcount == 0:
            await s.rollback()
            raise HTTPException(404, "Item non trovato")
        await s.commit()
        return {"ok": True}


@admin_router.post("/faq/items/reorder")
async def admin_reorder_items(body: ReorderPayload,
                               tenant: dict = Depends(require_admin_tenant)):
    async with AsyncSessionLocal() as s:
        for e in body.entries:
            await s.execute(
                text("UPDATE faq_items SET sort_order=:so WHERE id=:id AND tenant_id=:tid"),
                {"so": e.sort_order, "id": str(e.id), "tid": tenant["id"]},
            )
        await s.commit()
        return {"ok": True}


# Local helper to safely serialize jsonb param without psycopg adapter games.
def _json(d: dict) -> str:
    import json
    return json.dumps(d or {}, ensure_ascii=False)
