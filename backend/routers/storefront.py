"""Storefront CMS™ router — Cinematic Storefront Studio backend.

Powers the tenant's public-facing pages (the demo store):
  • /api/storefront/admin/*     — authenticated tenant_admin / super_admin
  • /api/storefront/public/*    — anonymous, READ-ONLY published content

DESIGN PRINCIPLES
─────────────────
1. Strictly tenant-scoped — every query filters by `tenant_id`.
2. Multilingual-first — locale_content is JSONB { _default, it, en-US, ... }.
3. Sections are ordered + visibility-flagged + droppable.
4. Publish workflow: draft → published (instant) or scheduled (future worker).
5. Assets live in Supabase Storage `tenant-assets` bucket; cms_assets rows
   carry focal_point + multilingual alt_text + reverse-index used_in.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends, Body, Query, Path
from pydantic import BaseModel, Field

from core.tenant_context import get_tenant_context, require_permission, audit_log
from core.permissions import P_TENANT_SETTINGS, P_STORAGE_WRITE
from core.storefront_registry import (
    STOREFRONT_SECTION_TYPES, STOREFRONT_SECTIONS_BY_KEY,
    storefront_section_defaults, is_known_storefront_section,
    PAGE_KEYS, page_section_types,
)
from core.storefront_revisions import (
    publish_page as revisions_publish,
    list_revisions as revisions_list,
    get_revision as revisions_get,
    diff_against_published, diff_between_revisions,
    revert_to_revision,
)
from database import db

router = APIRouter()

_NOW = lambda: datetime.now(timezone.utc).isoformat()  # noqa: E731

# `tenant-assets` is a private bucket → public URLs return 404 (Bucket not found).
# We use a dedicated public bucket for Storefront Studio assets (logos, hero
# images, project covers, footer media) so the public site can render them
# directly via the CDN URL with no signed-URL renewal needed.
PUBLIC_BUCKET = 'storefront-public'
LEGACY_PRIVATE_BUCKET = 'tenant-assets'  # kept for backward compatibility on already-registered assets
ALLOWED_BUCKETS = {PUBLIC_BUCKET, LEGACY_PRIVATE_BUCKET}


# ─── Schemas ───────────────────────────────────────────────────────────────
class SectionCreate(BaseModel):
    section_type: str
    sort_order: Optional[int] = None
    visible: bool = True
    locale_content: Dict[str, Any] = Field(default_factory=dict)
    settings: Dict[str, Any] = Field(default_factory=dict)


class SectionUpdate(BaseModel):
    section_type: Optional[str] = None
    sort_order: Optional[int] = None
    visible: Optional[bool] = None
    locale_content: Optional[Dict[str, Any]] = None
    settings: Optional[Dict[str, Any]] = None
    asset_refs: Optional[List[str]] = None


class PageUpdate(BaseModel):
    title: Optional[str] = None
    locale_meta: Optional[Dict[str, Any]] = None
    page_content: Optional[Dict[str, Any]] = None
    status: Optional[str] = None
    scheduled_publish_at: Optional[str] = None


class ReorderBody(BaseModel):
    section_ids: List[str]


class AssetRegister(BaseModel):
    storage_path: str
    public_url: str
    storage_bucket: str = 'tenant-assets'
    alt_text: Dict[str, Any] = Field(default_factory=dict)
    focal_point: Dict[str, Any] = Field(default_factory=lambda: {"x": 0.5, "y": 0.5})
    dimensions: Dict[str, Any] = Field(default_factory=dict)
    tags: List[str] = Field(default_factory=list)


class AssetUpdate(BaseModel):
    alt_text: Optional[Dict[str, Any]] = None
    focal_point: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None


# ─── Helpers ───────────────────────────────────────────────────────────────
def _strip_internal(page: Dict[str, Any], include_unpublished: bool = True) -> Dict[str, Any]:
    """Normalize a page row for response (drop internal fields for public)."""
    out = dict(page)
    out.pop('_id', None)
    return out


def _ensure_page(tenant_id: str, page_key: str) -> Dict[str, Any]:
    """Get or auto-create a page row for the given tenant + page_key."""
    if page_key not in PAGE_KEYS:
        raise HTTPException(400, f"Unknown page_key: {page_key}. Allowed: {PAGE_KEYS}")
    client = db()
    r = client.table('cms_pages').select('*') \
        .eq('tenant_id', tenant_id).eq('page_key', page_key).limit(1).execute()
    if r.data:
        return _strip_internal(r.data[0])
    # Auto-create empty draft page
    new_page = {
        'id': str(uuid.uuid4()),
        'tenant_id': tenant_id,
        'page_key': page_key,
        'title': page_key.replace('_', ' ').title(),
        'locale_meta': {},
        'page_content': {},
        'status': 'draft',
        'created_at': _NOW(),
        'updated_at': _NOW(),
    }
    ins = client.table('cms_pages').insert(new_page).execute()
    return _strip_internal(ins.data[0]) if ins.data else new_page


def _list_sections(tenant_id: str, page_id: str) -> List[Dict[str, Any]]:
    client = db()
    r = client.table('cms_sections').select('*') \
        .eq('tenant_id', tenant_id).eq('page_id', page_id) \
        .order('sort_order').execute()
    rows = r.data or []
    for s in rows:
        s.pop('_id', None)
    return rows


# ─── ADMIN — Registry / catalog ────────────────────────────────────────────
@router.get("/admin/registry")
def get_registry(ctx: dict = Depends(require_permission(P_TENANT_SETTINGS))):
    """Returns the storefront section catalog + allowed page_keys."""
    return {
        "page_keys": PAGE_KEYS,
        "sections": STOREFRONT_SECTION_TYPES,
    }


# ─── ADMIN — Pages ─────────────────────────────────────────────────────────
@router.get("/admin/pages")
def list_pages(ctx: dict = Depends(require_permission(P_TENANT_SETTINGS))):
    """List every page belonging to the tenant. Auto-creates missing keys."""
    pages = []
    for key in PAGE_KEYS:
        page = _ensure_page(ctx['tenant_id'], key)
        page['sections'] = _list_sections(ctx['tenant_id'], page['id'])
        pages.append(page)
    return {"pages": pages, "tenant_id": ctx['tenant_id']}


@router.get("/admin/pages/{page_key}")
def get_page(page_key: str, ctx: dict = Depends(require_permission(P_TENANT_SETTINGS))):
    page = _ensure_page(ctx['tenant_id'], page_key)
    page['sections'] = _list_sections(ctx['tenant_id'], page['id'])
    return page


@router.put("/admin/pages/{page_key}")
def update_page(page_key: str, body: PageUpdate,
                ctx: dict = Depends(require_permission(P_TENANT_SETTINGS))):
    page = _ensure_page(ctx['tenant_id'], page_key)
    client = db()
    update: Dict[str, Any] = {'updated_at': _NOW(), 'updated_by': ctx.get('profile_id')}
    if body.title is not None:           update['title'] = body.title
    if body.locale_meta is not None:     update['locale_meta'] = body.locale_meta
    if body.page_content is not None:    update['page_content'] = body.page_content
    if body.status is not None:
        if body.status not in {'draft', 'published', 'scheduled', 'archived'}:
            raise HTTPException(400, "Invalid status")
        update['status'] = body.status
        if body.status == 'published':
            update['published_at'] = _NOW()
    if body.scheduled_publish_at is not None:
        update['scheduled_publish_at'] = body.scheduled_publish_at
    r = client.table('cms_pages').update(update).eq('id', page['id']).execute()
    audit_log(ctx['tenant_id'], ctx.get('profile_id'), 'storefront.page.update', {'page_key': page_key})
    out = r.data[0] if r.data else page
    out.pop('_id', None)
    return out


@router.post("/admin/pages/{page_key}/publish")
def publish_page(page_key: str,
                 body: Optional[Dict[str, Any]] = Body(default=None),
                 ctx: dict = Depends(require_permission(P_TENANT_SETTINGS))):
    """Freeze current draft state into a new revision and mark as published."""
    _ensure_page(ctx['tenant_id'], page_key)
    label = (body or {}).get('label') if isinstance(body, dict) else None
    result = revisions_publish(ctx['tenant_id'], page_key, ctx.get('profile_id'), label=label)
    audit_log(ctx['tenant_id'], ctx.get('profile_id'), 'storefront.page.publish',
              {'page_key': page_key, 'revision_id': result['revision_id'],
               'change_summary': result.get('change_summary') or {}})
    return result


# ─── ADMIN — Revisions / Diff / Revert ─────────────────────────────────────
@router.get("/admin/pages/{page_key}/revisions")
def list_page_revisions(page_key: str, limit: int = Query(30, ge=1, le=100),
                        ctx: dict = Depends(require_permission(P_TENANT_SETTINGS))):
    page = _ensure_page(ctx['tenant_id'], page_key)
    revs = revisions_list(ctx['tenant_id'], page['id'], limit=limit)
    return {
        "page_id": page['id'],
        "page_key": page_key,
        "published_revision_id": page.get('published_revision_id'),
        "draft_updated_at": page.get('draft_updated_at'),
        "last_published_at": page.get('last_published_at'),
        "revisions": revs,
    }


@router.get("/admin/revisions/{revision_id}")
def get_revision_endpoint(revision_id: str,
                          ctx: dict = Depends(require_permission(P_TENANT_SETTINGS))):
    rev = revisions_get(ctx['tenant_id'], revision_id)
    rev.pop('_id', None)
    return rev


@router.get("/admin/pages/{page_key}/diff")
def page_diff(page_key: str,
              vs: str = Query("published", description="published | <revision_id>"),
              against: Optional[str] = Query(None, description="When vs is a revision_id, "
                                             "compare it to this other revision_id"),
              ctx: dict = Depends(require_permission(P_TENANT_SETTINGS))):
    """Diff the live draft against either the currently published revision
    (vs=published) or any historical revision (vs=<id>). When `against` is
    set, returns a revision-to-revision diff with no live data involved.
    """
    page = _ensure_page(ctx['tenant_id'], page_key)
    if vs == "published":
        return diff_against_published(ctx['tenant_id'], page['id'])
    if against:
        return diff_between_revisions(ctx['tenant_id'], page['id'], vs, against)
    # vs is a revision id, compare it to the live draft (use it as the BASE)
    rev = revisions_get(ctx['tenant_id'], vs)
    from core.storefront_revisions import diff_payload, _fetch_sections  # local import
    sections = _fetch_sections(ctx['tenant_id'], page['id'])
    return {
        "has_published": True,
        "published_revision_id": vs,
        "published_at": rev.get("created_at"),
        "draft_updated_at": page.get("draft_updated_at"),
        **diff_payload(rev["snapshot"], page, sections),
    }


@router.post("/admin/pages/{page_key}/revert/{revision_id}")
def revert_page(page_key: str, revision_id: str,
                ctx: dict = Depends(require_permission(P_TENANT_SETTINGS))):
    page = _ensure_page(ctx['tenant_id'], page_key)
    result = revert_to_revision(ctx['tenant_id'], page['id'], revision_id, ctx.get('profile_id'))
    audit_log(ctx['tenant_id'], ctx.get('profile_id'), 'storefront.page.revert',
              {'page_key': page_key, 'revision_id': revision_id})
    return result


# ─── ADMIN — Sections ──────────────────────────────────────────────────────
@router.post("/admin/pages/{page_key}/sections", status_code=201)
def create_section(page_key: str, body: SectionCreate,
                   ctx: dict = Depends(require_permission(P_TENANT_SETTINGS))):
    if not is_known_storefront_section(body.section_type):
        raise HTTPException(400, f"Unknown section type: {body.section_type}")
    page = _ensure_page(ctx['tenant_id'], page_key)
    client = db()
    # Compute sort_order if not provided (append at end)
    if body.sort_order is None:
        existing = _list_sections(ctx['tenant_id'], page['id'])
        sort_order = (existing[-1]['sort_order'] + 10) if existing else 0
    else:
        sort_order = body.sort_order
    # Defaults + provided overrides
    locale_content = body.locale_content or {}
    if not locale_content:
        defaults = storefront_section_defaults(body.section_type)
        locale_content = {'_default': defaults} if defaults else {}
    new = {
        'id': str(uuid.uuid4()),
        'tenant_id': ctx['tenant_id'],
        'page_id': page['id'],
        'section_type': body.section_type,
        'sort_order': sort_order,
        'visible': body.visible,
        'locale_content': locale_content,
        'settings': body.settings or {},
        'created_at': _NOW(),
        'updated_at': _NOW(),
    }
    r = client.table('cms_sections').insert(new).execute()
    out = r.data[0] if r.data else new
    out.pop('_id', None)
    return out


@router.put("/admin/sections/{section_id}")
def update_section(section_id: str, body: SectionUpdate,
                   ctx: dict = Depends(require_permission(P_TENANT_SETTINGS))):
    client = db()
    r = client.table('cms_sections').select('*') \
        .eq('id', section_id).eq('tenant_id', ctx['tenant_id']).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Section not found")
    update: Dict[str, Any] = {'updated_at': _NOW()}
    if body.section_type is not None:
        if not is_known_storefront_section(body.section_type):
            raise HTTPException(400, f"Unknown section type: {body.section_type}")
        update['section_type'] = body.section_type
    if body.sort_order is not None:    update['sort_order'] = body.sort_order
    if body.visible is not None:       update['visible'] = body.visible
    if body.locale_content is not None: update['locale_content'] = body.locale_content
    if body.settings is not None:      update['settings'] = body.settings
    if body.asset_refs is not None:    update['asset_refs'] = body.asset_refs
    u = client.table('cms_sections').update(update).eq('id', section_id).execute()
    out = u.data[0] if u.data else r.data[0]
    out.pop('_id', None)
    return out


@router.delete("/admin/sections/{section_id}")
def delete_section(section_id: str, ctx: dict = Depends(require_permission(P_TENANT_SETTINGS))):
    client = db()
    r = client.table('cms_sections').delete() \
        .eq('id', section_id).eq('tenant_id', ctx['tenant_id']).execute()
    if not r.data:
        raise HTTPException(404, "Section not found")
    return {"deleted": True, "id": section_id}


@router.patch("/admin/pages/{page_key}/sections/reorder")
def reorder_sections(page_key: str, body: ReorderBody,
                     ctx: dict = Depends(require_permission(P_TENANT_SETTINGS))):
    page = _ensure_page(ctx['tenant_id'], page_key)
    client = db()
    # Verify all section_ids belong to this page
    existing = _list_sections(ctx['tenant_id'], page['id'])
    existing_ids = {s['id'] for s in existing}
    if set(body.section_ids) != existing_ids:
        raise HTTPException(400, "section_ids must be the strict set of sections of this page")
    for idx, sid in enumerate(body.section_ids):
        client.table('cms_sections').update({
            'sort_order': idx * 10,
            'updated_at': _NOW(),
        }).eq('id', sid).execute()
    return {"reordered": True, "section_ids": body.section_ids}


@router.post("/admin/sections/{section_id}/duplicate", status_code=201)
def duplicate_section(section_id: str, ctx: dict = Depends(require_permission(P_TENANT_SETTINGS))):
    client = db()
    r = client.table('cms_sections').select('*') \
        .eq('id', section_id).eq('tenant_id', ctx['tenant_id']).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Section not found")
    src = r.data[0]
    siblings = _list_sections(ctx['tenant_id'], src['page_id'])
    new_order = (siblings[-1]['sort_order'] + 10) if siblings else 0
    new = {
        'id': str(uuid.uuid4()),
        'tenant_id': src['tenant_id'],
        'page_id': src['page_id'],
        'section_type': src['section_type'],
        'sort_order': new_order,
        'visible': src['visible'],
        'locale_content': src['locale_content'],
        'settings': src['settings'],
        'created_at': _NOW(),
        'updated_at': _NOW(),
    }
    ins = client.table('cms_sections').insert(new).execute()
    out = ins.data[0] if ins.data else new
    out.pop('_id', None)
    return out


# ─── ADMIN — Assets ────────────────────────────────────────────────────────
@router.get("/admin/assets")
def list_assets(limit: int = Query(60, ge=1, le=200),
                ctx: dict = Depends(require_permission(P_STORAGE_WRITE))):
    client = db()
    r = client.table('cms_assets').select('*') \
        .eq('tenant_id', ctx['tenant_id']) \
        .order('created_at', desc=True).limit(limit).execute()
    rows = r.data or []
    for a in rows:
        a.pop('_id', None)
    return {"assets": rows}


@router.post("/admin/assets/signed-upload")
def signed_upload(body: Dict[str, Any] = Body(...),
                  ctx: dict = Depends(require_permission(P_STORAGE_WRITE))):
    """Generate a signed URL for direct upload to Supabase Storage.
    Always writes to the PUBLIC bucket so the resulting URL is reachable
    by the public site without signed-URL renewal."""
    file_name = body.get('file_name') or f"{uuid.uuid4()}.bin"
    bucket = body.get('bucket') or PUBLIC_BUCKET
    if bucket not in ALLOWED_BUCKETS:
        raise HTTPException(400, f"Bucket not allowed: {bucket}")
    # Force the public bucket for new uploads. Legacy private bucket only kept
    # as fallback to read pre-existing assets, but no new writes go there.
    bucket = PUBLIC_BUCKET
    safe_path = f"{ctx['tenant_id']}/storefront/{uuid.uuid4()}-{file_name}"
    client = db()
    try:
        signed = client.storage.from_(bucket).create_signed_upload_url(safe_path)
        return {
            "bucket": bucket,
            "path": safe_path,
            "signed_url": signed.get('signed_url') or signed.get('signedUrl'),
            "token": signed.get('token'),
        }
    except Exception as e:
        raise HTTPException(500, f"Could not generate signed URL: {e}")


@router.post("/admin/assets/register", status_code=201)
def register_asset(body: AssetRegister, ctx: dict = Depends(require_permission(P_STORAGE_WRITE))):
    # Enforce tenant prefix
    tenant_prefix = ctx['tenant_id'] + '/'
    raw_path = (body.storage_path or '').lstrip('/')
    if '/' in raw_path:
        first = raw_path.split('/', 1)[0]
        if len(first) == 36 and first != ctx['tenant_id']:
            raise HTTPException(403, "Path outside tenant scope")
    if not raw_path.startswith(tenant_prefix):
        raw_path = tenant_prefix + raw_path
    # Force public bucket for new asset registrations (signed-upload also forces it)
    bucket = body.storage_bucket if body.storage_bucket in ALLOWED_BUCKETS else PUBLIC_BUCKET
    # Always compute the public URL deterministically — never store an empty string.
    client = db()
    public_url = body.public_url
    if not public_url:
        try:
            res = client.storage.from_(bucket).get_public_url(raw_path)
            # supabase-py may return a string or dict depending on version
            public_url = res if isinstance(res, str) else (res.get('publicUrl') or res.get('public_url') or '')
        except Exception:
            public_url = ''
    if not public_url:
        raise HTTPException(500, "Could not compute public URL for asset")
    new = {
        'id': str(uuid.uuid4()),
        'tenant_id': ctx['tenant_id'],
        'source': 'upload',
        'storage_bucket': bucket,
        'storage_path': raw_path,
        'public_url': public_url,
        'alt_text': body.alt_text,
        'focal_point': body.focal_point,
        'dimensions': body.dimensions,
        'tags': body.tags,
        'used_in': [],
        'uploaded_by': ctx.get('profile_id'),
        'created_at': _NOW(),
        'updated_at': _NOW(),
    }
    ins = client.table('cms_assets').insert(new).execute()
    out = ins.data[0] if ins.data else new
    out.pop('_id', None)
    return out


@router.put("/admin/assets/{asset_id}")
def update_asset(asset_id: str, body: AssetUpdate,
                 ctx: dict = Depends(require_permission(P_STORAGE_WRITE))):
    client = db()
    r = client.table('cms_assets').select('id') \
        .eq('id', asset_id).eq('tenant_id', ctx['tenant_id']).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Asset not found")
    update: Dict[str, Any] = {'updated_at': _NOW()}
    if body.alt_text is not None:    update['alt_text'] = body.alt_text
    if body.focal_point is not None: update['focal_point'] = body.focal_point
    if body.tags is not None:        update['tags'] = body.tags
    u = client.table('cms_assets').update(update).eq('id', asset_id).execute()
    out = u.data[0] if u.data else {'id': asset_id}
    out.pop('_id', None)
    return out


@router.delete("/admin/assets/{asset_id}")
def delete_asset(asset_id: str, ctx: dict = Depends(require_permission(P_STORAGE_WRITE))):
    client = db()
    r = client.table('cms_assets').delete() \
        .eq('id', asset_id).eq('tenant_id', ctx['tenant_id']).execute()
    if not r.data:
        raise HTTPException(404, "Asset not found")
    return {"deleted": True, "id": asset_id}


# ─── PUBLIC (anonymous) — Read-only published content ──────────────────────
@router.get("/public/{tenant_slug}/pages/{page_key}")
def public_page(tenant_slug: str, page_key: str,
                preview: int = Query(0, description="If 1, returns the live DRAFT (admin preview)")):
    """Render LIVE content for the public storefront.

    Behaviour:
      • preview=0 (default) — serve the frozen published_revision snapshot.
        Falls back gracefully to live data if the page was published
        before the revision engine landed (legacy compatibility).
      • preview=1            — serve the live draft + invisible sections too
        (used by the Studio's in-iframe preview).
    """
    if page_key not in PAGE_KEYS:
        raise HTTPException(404, "Unknown page")
    client = db()
    t = client.table('tenants').select('id').eq('slug', tenant_slug).limit(1).execute()
    if not t.data:
        raise HTTPException(404, "Tenant not found")
    tenant_id = t.data[0]['id']
    p = client.table('cms_pages').select('*') \
        .eq('tenant_id', tenant_id).eq('page_key', page_key).limit(1).execute()
    if not p.data:
        return {"page": None, "tenant_id": tenant_id, "status": "no_content"}
    page = p.data[0]

    # Preview mode — bypass the revision and serve live draft (incl. hidden sections)
    if preview:
        page['sections'] = _list_sections(tenant_id, page['id'])
        page.pop('_id', None)
        return {"page": page, "tenant_id": tenant_id, "status": "ok", "served_from": "draft"}

    # Public mode — read frozen snapshot from the revision pointer
    rev_id = page.get('published_revision_id')
    if rev_id:
        rev = client.table('cms_page_revisions').select('snapshot') \
            .eq('id', rev_id).eq('tenant_id', tenant_id).limit(1).execute()
        if rev.data:
            snap = rev.data[0]['snapshot'] or {}
            snap_page = snap.get('page') or {}
            sections = [s for s in (snap.get('sections') or []) if s.get('visible', True)]
            return {
                "page": {
                    **{k: snap_page.get(k) for k in snap_page.keys()},
                    "id": page['id'],
                    "tenant_id": tenant_id,
                    "page_key": page_key,
                    "sections": sections,
                    "asset_index": snap.get('asset_index') or {},
                    "published_at": page.get('last_published_at') or page.get('published_at'),
                },
                "tenant_id": tenant_id,
                "status": "ok",
                "served_from": "revision",
                "revision_id": rev_id,
            }

    # Legacy compatibility — page was published before the revision engine
    if page['status'] != 'published':
        return {"page": None, "tenant_id": tenant_id, "status": "not_published"}
    page['sections'] = [s for s in _list_sections(tenant_id, page['id']) if s.get('visible', True)]
    page.pop('_id', None)
    return {"page": page, "tenant_id": tenant_id, "status": "ok", "served_from": "legacy_live"}


@router.get("/public/{tenant_slug}/assets/{asset_id}")
def public_asset(tenant_slug: str, asset_id: str):
    client = db()
    t = client.table('tenants').select('id').eq('slug', tenant_slug).limit(1).execute()
    if not t.data:
        raise HTTPException(404, "Tenant not found")
    a = client.table('cms_assets').select('id, public_url, alt_text, focal_point, dimensions') \
        .eq('id', asset_id).eq('tenant_id', t.data[0]['id']).limit(1).execute()
    if not a.data:
        raise HTTPException(404, "Asset not found")
    return a.data[0]
