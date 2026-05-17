"""Phase E-1A — Editorial Intelligence Operating System™ — backend.

This is NOT a CMS. It's the foundation of MOOD's cultural editorial
engine. Every variant is a market-native reinterpretation of a central
EDITORIAL MASTER, never a flat translation.

Endpoints in this phase (Foundation only — AI generation lands in E-1B):

  Masters:
    GET    /api/editorial/masters
    POST   /api/editorial/masters
    GET    /api/editorial/masters/{id}
    PATCH  /api/editorial/masters/{id}
    DELETE /api/editorial/masters/{id}                 (soft archive)

  Variants:
    GET    /api/editorial/masters/{id}/variants
    POST   /api/editorial/masters/{id}/variants        (manual stub — AI Phase 1B)
    GET    /api/editorial/variants/{id}
    PATCH  /api/editorial/variants/{id}
    POST   /api/editorial/variants/{id}/transition     (status change w/ guards)
    POST   /api/editorial/variants/{id}/schedule
    POST   /api/editorial/variants/{id}/publish
    DELETE /api/editorial/variants/{id}                (soft archive)

  Revisions (append-only history; AI applies them in E-1B):
    GET    /api/editorial/variants/{id}/revisions
    POST   /api/editorial/variants/{id}/revisions
    PATCH  /api/editorial/revisions/{id}/apply         (manual apply for now)

  Editorial calendar:
    GET    /api/editorial/calendar?from=&to=&market_id=

  CTA tracking (public — feeds the Relationship CRM):
    POST   /api/public/editorial/cta-click
    (also GET /api/editorial/cta-clicks?variant_id=)
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from database import db
from core.tenant_context import get_tenant_context

logger = logging.getLogger(__name__)
router = APIRouter(tags=["editorial"])


def _iso() -> str: return datetime.now(timezone.utc).isoformat()


# ─── Status workflow guards ──────────────────────────────────────────────
# Stable graph (value_keys live in `article_status` platform lookup). We
# accept any value the lookup exposes, but block obvious illegal jumps.
ALLOWED_TRANSITIONS: Dict[str, set] = {
    'draft':                       {'direction_defined', 'archived'},
    'direction_defined':           {'ai_composing', 'ready_for_editorial_review', 'draft', 'archived'},
    'ai_composing':                {'ready_for_editorial_review', 'direction_defined', 'archived'},
    'ready_for_editorial_review':  {'revision_requested', 'approved', 'archived'},
    'revision_requested':          {'ai_composing', 'ready_for_editorial_review', 'archived'},
    'approved':                    {'scheduled', 'published', 'revision_requested', 'archived'},
    'scheduled':                   {'published', 'approved', 'archived'},
    'published':                   {'archived', 'revision_requested'},
    'archived':                    {'draft'},
}


# ─── Helpers ─────────────────────────────────────────────────────────────

def _platform_value_exists(c, group_key: str, value_key: str) -> bool:
    r = (c.table('relationship_lookups').select('id')
         .is_('tenant_id', 'null').eq('scope', 'platform')
         .eq('group_key', group_key).eq('value_key', value_key)
         .limit(1).execute().data or [])
    return bool(r)


def _resolve_lookup_meta(c, group_key: str, value_key: str) -> Dict[str, Any]:
    r = (c.table('relationship_lookups').select('metadata')
         .is_('tenant_id', 'null').eq('scope', 'platform')
         .eq('group_key', group_key).eq('value_key', value_key)
         .limit(1).execute().data or [])
    return (r[0]['metadata'] if r else {}) or {}


def _strip_internal_for_public(variant: Dict[str, Any]) -> Dict[str, Any]:
    """Public views NEVER include the internal_translation."""
    v = dict(variant)
    v.pop('internal_translation', None)
    return v


# ─── Models ──────────────────────────────────────────────────────────────

class MasterIn(BaseModel):
    code:                    str = Field(..., min_length=2, max_length=120)
    title:                   str
    canonical_locale:        str = 'it-IT'
    conceptual_direction:    Optional[str] = None
    emotional_objective:     Dict[str, Any] = Field(default_factory=dict)
    target_psychology:       Dict[str, Any] = Field(default_factory=dict)
    architectural_tone:      Dict[str, Any] = Field(default_factory=dict)
    hospitality_positioning: Dict[str, Any] = Field(default_factory=dict)
    material_language:       Dict[str, Any] = Field(default_factory=dict)
    cta_intent:              Dict[str, Any] = Field(default_factory=dict)
    seo_intent:              Dict[str, Any] = Field(default_factory=dict)
    baseline_imagery:        List[Dict[str, Any]] = Field(default_factory=list)
    canonical_article_seed:  Dict[str, Any] = Field(default_factory=dict)
    taxonomy:                Dict[str, Any] = Field(default_factory=dict)


class MasterPatch(BaseModel):
    title:                   Optional[str] = None
    canonical_locale:        Optional[str] = None
    conceptual_direction:    Optional[str] = None
    emotional_objective:     Optional[Dict[str, Any]] = None
    target_psychology:       Optional[Dict[str, Any]] = None
    architectural_tone:      Optional[Dict[str, Any]] = None
    hospitality_positioning: Optional[Dict[str, Any]] = None
    material_language:       Optional[Dict[str, Any]] = None
    cta_intent:              Optional[Dict[str, Any]] = None
    seo_intent:              Optional[Dict[str, Any]] = None
    baseline_imagery:        Optional[List[Dict[str, Any]]] = None
    canonical_article_seed:  Optional[Dict[str, Any]] = None
    taxonomy:                Optional[Dict[str, Any]] = None
    master_status:           Optional[str] = None
    primary_owner_id:        Optional[str] = None


class VariantIn(BaseModel):
    market_id:               str
    variant_slug:            str = Field(..., min_length=2, max_length=160)
    target_locale:           str
    blueprint_review_locale: str = 'it-IT'
    target_sub_region:       Optional[str] = None
    editorial_edition:       Optional[str] = None
    season_code:             Optional[str] = None
    title:                   str = ''
    excerpt:                 Optional[str] = None
    body_blocks:             List[Dict[str, Any]] = Field(default_factory=list)
    hero_image_url:          Optional[str] = None
    cultural_angle:          Optional[str] = None
    tone_label:              Optional[str] = None
    pacing_label:            Optional[str] = None
    seo:                     Dict[str, Any] = Field(default_factory=dict)
    cta_set:                 List[Dict[str, Any]] = Field(default_factory=list)
    hotspot_data:            List[Dict[str, Any]] = Field(default_factory=list)


class VariantPatch(BaseModel):
    title:                   Optional[str] = None
    excerpt:                 Optional[str] = None
    body_blocks:             Optional[List[Dict[str, Any]]] = None
    hero_image_url:          Optional[str] = None
    cultural_angle:          Optional[str] = None
    tone_label:              Optional[str] = None
    pacing_label:            Optional[str] = None
    seo:                     Optional[Dict[str, Any]] = None
    cta_set:                 Optional[List[Dict[str, Any]]] = None
    hotspot_data:            Optional[List[Dict[str, Any]]] = None
    internal_translation:    Optional[Dict[str, Any]] = None
    assigned_editor_user_id: Optional[str] = None


class TransitionBody(BaseModel):
    to: str


class ScheduleBody(BaseModel):
    scheduled_at: str  # ISO timestamp


class RevisionIn(BaseModel):
    revision_options: List[str] = Field(default_factory=list)
    notes:            Optional[str] = None
    scope:            str = 'full'


class CtaClickIn(BaseModel):
    tenant_slug:        str
    variant_id:         str
    cta_id:             Optional[str] = None
    cta_tier:           str                                  # soft | medium | strong
    cta_action:         Optional[str] = None
    cta_intent:         Optional[str] = None
    atmosphere_context: Dict[str, Any] = Field(default_factory=dict)
    device_locale:      Optional[str] = None
    time_on_article_sec:Optional[int] = None
    hotspots_opened:    List[Dict[str, Any]] = Field(default_factory=list)
    materials_viewed:   List[Dict[str, Any]] = Field(default_factory=list)
    references_saved:   List[Dict[str, Any]] = Field(default_factory=list)
    utm:                Dict[str, Any] = Field(default_factory=dict)
    referrer:           Optional[str] = None
    # Visitor identity (optional — provided by Strong-CTA forms).
    visitor_name:       Optional[str] = None
    visitor_email:      Optional[str] = None
    visitor_phone:      Optional[str] = None
    visitor_city:       Optional[str] = None
    visitor_country:    Optional[str] = None
    visitor_notes:      Optional[str] = None


# ─── MASTERS ─────────────────────────────────────────────────────────────

@router.get("/editorial/masters")
def list_masters(
    status: Optional[str] = None,
    ctx=Depends(get_tenant_context),
):
    c = db()
    qb = c.table('editorial_masters').select('*').eq('tenant_id', ctx['tenant_id'])
    if status:
        qb = qb.eq('master_status', status)
    rows = qb.order('updated_at', desc=True).execute().data or []
    # Attach variant counts in bulk.
    ids = [r['id'] for r in rows]
    counts: Dict[str, int] = {}
    if ids:
        vs = (c.table('editorial_variants').select('id,master_id')
              .in_('master_id', ids).execute().data or [])
        for v in vs:
            counts[v['master_id']] = counts.get(v['master_id'], 0) + 1
    for r in rows:
        r['variant_count'] = counts.get(r['id'], 0)
    return {'masters': rows, 'total': len(rows)}


@router.post("/editorial/masters", status_code=201)
def create_master(payload: MasterIn, ctx=Depends(get_tenant_context)):
    c = db()
    row = payload.model_dump()
    row.update({
        'id':         str(uuid.uuid4()),
        'tenant_id':  ctx['tenant_id'],
        'master_status': 'draft',
        'created_at': _iso(),
        'updated_at': _iso(),
    })
    try:
        c.table('editorial_masters').insert(row).execute()
    except Exception as e:
        if 'duplicate' in str(e).lower() or 'unique' in str(e).lower():
            raise HTTPException(409, f"Master code '{payload.code}' already exists for this tenant")
        raise
    return row


@router.get("/editorial/masters/{mid}")
def get_master(mid: str, ctx=Depends(get_tenant_context)):
    c = db()
    rows = (c.table('editorial_masters').select('*')
            .eq('id', mid).eq('tenant_id', ctx['tenant_id'])
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, 'Master not found')
    master = rows[0]
    variants = (c.table('editorial_variants').select('*')
                .eq('master_id', mid)
                .order('updated_at', desc=True).execute().data or [])
    for v in variants:
        v.pop('internal_translation', None)  # strip from list view
    master['variants'] = variants
    return master


@router.patch("/editorial/masters/{mid}")
def patch_master(mid: str, patch: MasterPatch, ctx=Depends(get_tenant_context)):
    c = db()
    body = patch.model_dump(exclude_none=True)
    if not body:
        raise HTTPException(400, 'Empty patch')
    body['updated_at'] = _iso()
    r = (c.table('editorial_masters').update(body)
         .eq('id', mid).eq('tenant_id', ctx['tenant_id']).execute())
    if not r.data:
        raise HTTPException(404, 'Master not found')
    return r.data[0]


@router.delete("/editorial/masters/{mid}")
def archive_master(mid: str, ctx=Depends(get_tenant_context)):
    c = db()
    r = (c.table('editorial_masters')
         .update({'master_status': 'archived', 'archived_at': _iso(), 'updated_at': _iso()})
         .eq('id', mid).eq('tenant_id', ctx['tenant_id']).execute())
    if not r.data:
        raise HTTPException(404, 'Master not found')
    return {'ok': True}


# ─── VARIANTS ────────────────────────────────────────────────────────────

@router.get("/editorial/masters/{mid}/variants")
def list_variants(mid: str, ctx=Depends(get_tenant_context)):
    c = db()
    variants = (c.table('editorial_variants').select('*')
                .eq('master_id', mid).eq('tenant_id', ctx['tenant_id'])
                .order('updated_at', desc=True).execute().data or [])
    for v in variants:
        v.pop('internal_translation', None)
    return {'variants': variants, 'total': len(variants)}


@router.post("/editorial/masters/{mid}/variants", status_code=201)
def create_variant(mid: str, payload: VariantIn, ctx=Depends(get_tenant_context)):
    c = db()
    master = (c.table('editorial_masters').select('id')
              .eq('id', mid).eq('tenant_id', ctx['tenant_id'])
              .limit(1).execute().data or [])
    if not master:
        raise HTTPException(404, 'Master not found')

    market = (c.table('markets').select('id,primary_locale').eq('id', payload.market_id)
              .limit(1).execute().data or [])
    if not market:
        raise HTTPException(404, 'Market not found')

    if payload.tone_label and not _platform_value_exists(c, 'editorial_tone', payload.tone_label):
        raise HTTPException(400, f"Unknown editorial_tone '{payload.tone_label}'")
    if payload.pacing_label and not _platform_value_exists(c, 'editorial_pacing', payload.pacing_label):
        raise HTTPException(400, f"Unknown editorial_pacing '{payload.pacing_label}'")

    row = payload.model_dump()
    row.update({
        'id':         str(uuid.uuid4()),
        'tenant_id':  ctx['tenant_id'],
        'master_id':  mid,
        'status':     'draft',
        'created_at': _iso(),
        'updated_at': _iso(),
    })
    try:
        c.table('editorial_variants').insert(row).execute()
    except Exception as e:
        if 'duplicate' in str(e).lower() or 'unique' in str(e).lower():
            raise HTTPException(409, "A variant with this slug+edition+season already exists for this market")
        raise
    row.pop('internal_translation', None)
    return row


@router.get("/editorial/variants/{vid}")
def get_variant(vid: str, ctx=Depends(get_tenant_context)):
    c = db()
    rows = (c.table('editorial_variants').select('*')
            .eq('id', vid).eq('tenant_id', ctx['tenant_id'])
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, 'Variant not found')
    return rows[0]


@router.patch("/editorial/variants/{vid}")
def patch_variant(vid: str, patch: VariantPatch, ctx=Depends(get_tenant_context)):
    c = db()
    body = patch.model_dump(exclude_none=True)
    if not body:
        raise HTTPException(400, 'Empty patch')
    if 'tone_label' in body and not _platform_value_exists(c, 'editorial_tone', body['tone_label']):
        raise HTTPException(400, f"Unknown editorial_tone '{body['tone_label']}'")
    if 'pacing_label' in body and not _platform_value_exists(c, 'editorial_pacing', body['pacing_label']):
        raise HTTPException(400, f"Unknown editorial_pacing '{body['pacing_label']}'")
    body['updated_at'] = _iso()
    r = (c.table('editorial_variants').update(body)
         .eq('id', vid).eq('tenant_id', ctx['tenant_id']).execute())
    if not r.data:
        raise HTTPException(404, 'Variant not found')
    return r.data[0]


@router.post("/editorial/variants/{vid}/transition")
def transition_variant(vid: str, body: TransitionBody, ctx=Depends(get_tenant_context)):
    c = db()
    rows = (c.table('editorial_variants').select('id,status')
            .eq('id', vid).eq('tenant_id', ctx['tenant_id'])
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, 'Variant not found')
    current = rows[0]['status']
    target = body.to

    if not _platform_value_exists(c, 'article_status', target):
        raise HTTPException(400, f"Unknown article_status '{target}'")
    allowed = ALLOWED_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise HTTPException(409, f"Illegal transition: {current} → {target}. Allowed: {sorted(allowed)}")

    patch = {'status': target, 'updated_at': _iso()}
    if target == 'published':
        patch['is_published'] = True
        patch['published_at'] = _iso()
    if target == 'archived':
        patch['archived_at'] = _iso()
        patch['is_published'] = False
    c.table('editorial_variants').update(patch).eq('id', vid).execute()
    return {'ok': True, 'from': current, 'to': target}


@router.post("/editorial/variants/{vid}/schedule")
def schedule_variant(vid: str, body: ScheduleBody, ctx=Depends(get_tenant_context)):
    c = db()
    rows = (c.table('editorial_variants').select('id,status')
            .eq('id', vid).eq('tenant_id', ctx['tenant_id'])
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, 'Variant not found')
    if rows[0]['status'] not in {'approved', 'scheduled'}:
        raise HTTPException(409, "Variant must be 'approved' before scheduling")
    c.table('editorial_variants').update({
        'status': 'scheduled', 'scheduled_at': body.scheduled_at, 'updated_at': _iso(),
    }).eq('id', vid).execute()
    return {'ok': True}


@router.delete("/editorial/variants/{vid}")
def archive_variant(vid: str, ctx=Depends(get_tenant_context)):
    c = db()
    r = (c.table('editorial_variants')
         .update({'status': 'archived', 'archived_at': _iso(), 'is_published': False, 'updated_at': _iso()})
         .eq('id', vid).eq('tenant_id', ctx['tenant_id']).execute())
    if not r.data:
        raise HTTPException(404, 'Variant not found')
    return {'ok': True}


# ─── REVISIONS ───────────────────────────────────────────────────────────

@router.get("/editorial/variants/{vid}/revisions")
def list_revisions(vid: str, ctx=Depends(get_tenant_context)):
    c = db()
    # Ownership check.
    if not (c.table('editorial_variants').select('id')
            .eq('id', vid).eq('tenant_id', ctx['tenant_id']).limit(1).execute().data):
        raise HTTPException(404, 'Variant not found')
    rows = (c.table('editorial_revisions').select('*')
            .eq('variant_id', vid).order('requested_at', desc=True).execute().data or [])
    return {'revisions': rows, 'total': len(rows)}


@router.post("/editorial/variants/{vid}/revisions", status_code=201)
def request_revision(vid: str, payload: RevisionIn, ctx=Depends(get_tenant_context)):
    c = db()
    v = (c.table('editorial_variants').select('*')
         .eq('id', vid).eq('tenant_id', ctx['tenant_id'])
         .limit(1).execute().data or [])
    if not v:
        raise HTTPException(404, 'Variant not found')
    variant = v[0]

    # Validate options against `revision_option` platform lookup (defence in depth).
    for opt in payload.revision_options:
        if not _platform_value_exists(c, 'revision_option', opt):
            raise HTTPException(400, f"Unknown revision_option '{opt}'")

    rev_id = str(uuid.uuid4())
    c.table('editorial_revisions').insert({
        'id':                  rev_id,
        'tenant_id':           ctx['tenant_id'],
        'variant_id':          vid,
        'requested_by_user_id':ctx.get('user_id'),
        'requested_at':        _iso(),
        'revision_options':    payload.revision_options,
        'notes':               payload.notes,
        'scope':               payload.scope,
        'before_snapshot':     {'title': variant['title'], 'body_blocks': variant['body_blocks'], 'seo': variant['seo']},
        'after_snapshot':      {},
        'ai_response_meta':    {},
        'status':              'pending',
    }).execute()

    # Bump variant counter and move status to revision_requested.
    c.table('editorial_variants').update({
        'revision_count':   (variant.get('revision_count') or 0) + 1,
        'last_revision_at': _iso(),
        'status':           'revision_requested',
        'updated_at':       _iso(),
    }).eq('id', vid).execute()

    return {'id': rev_id, 'status': 'pending'}


@router.patch("/editorial/revisions/{rid}/apply")
def apply_revision(rid: str, patch: VariantPatch, ctx=Depends(get_tenant_context)):
    """Manually apply a revision (Phase E-1A). In Phase E-1B the AI will
    fill the after_snapshot automatically."""
    c = db()
    rev = (c.table('editorial_revisions').select('*')
           .eq('id', rid).eq('tenant_id', ctx['tenant_id'])
           .limit(1).execute().data or [])
    if not rev:
        raise HTTPException(404, 'Revision not found')
    revision = rev[0]
    if revision['status'] != 'pending':
        raise HTTPException(409, f"Revision already {revision['status']}")

    body = patch.model_dump(exclude_none=True)
    if body:
        body['updated_at'] = _iso()
        body['status'] = 'ready_for_editorial_review'
        c.table('editorial_variants').update(body).eq('id', revision['variant_id']).execute()

    # Capture after-snapshot for audit.
    v = (c.table('editorial_variants').select('title,body_blocks,seo')
         .eq('id', revision['variant_id']).limit(1).execute().data or [{}])[0]
    c.table('editorial_revisions').update({
        'after_snapshot':      v,
        'status':              'applied',
        'applied_at':          _iso(),
        'applied_by_user_id':  ctx.get('user_id'),
    }).eq('id', rid).execute()

    return {'ok': True}


# ─── EDITORIAL CALENDAR ──────────────────────────────────────────────────

@router.get("/editorial/calendar")
def editorial_calendar(
    from_:     Optional[str] = Query(None, alias='from'),
    to:        Optional[str] = None,
    market_id: Optional[str] = None,
    ctx=Depends(get_tenant_context),
):
    c = db()
    qb = c.table('editorial_variants').select('*').eq('tenant_id', ctx['tenant_id'])
    if market_id:
        qb = qb.eq('market_id', market_id)
    if from_:
        qb = qb.gte('scheduled_at', from_)
    if to:
        qb = qb.lte('scheduled_at', to)
    rows = qb.order('scheduled_at').execute().data or []
    for r in rows:
        r.pop('internal_translation', None)
    return {'items': rows, 'total': len(rows)}


# ─── CTA TRACKING — feeds the Relationship CRM ───────────────────────────

@router.get("/editorial/cta-clicks")
def list_cta_clicks(
    variant_id: Optional[str] = None,
    market_id:  Optional[str] = None,
    limit:      int = 200,
    ctx=Depends(get_tenant_context),
):
    c = db()
    qb = c.table('editorial_cta_clicks').select('*').eq('tenant_id', ctx['tenant_id'])
    if variant_id:
        qb = qb.eq('variant_id', variant_id)
    if market_id:
        qb = qb.eq('market_id', market_id)
    rows = (qb.order('created_at', desc=True)
              .limit(min(limit, 500)).execute().data or [])
    return {'clicks': rows, 'total': len(rows)}


@router.post("/public/editorial/cta-click", status_code=201)
def public_cta_click(payload: CtaClickIn, request: Request):
    """Anonymous CTA click handler. Feeds the Relationship CRM.

    For SOFT tier: tracks the click + optionally creates a lightweight
                    Account if the visitor leaves identifying info.
    For MEDIUM:    creates Account + Contact + `web_lead_generation`
                    interaction, lifecycle_stage = 'lead'.
    For STRONG:    creates Account + Contact + Interaction, lifecycle_stage
                    = 'discovery'. The studio knows: this person opened
                    a discovery channel."""
    c = db()
    t = (c.table('tenants').select('id').eq('slug', payload.tenant_slug)
         .limit(1).execute().data or [])
    if not t:
        raise HTTPException(404, 'Tenant not found')
    tid = t[0]['id']

    variant = (c.table('editorial_variants').select('id,market_id,title,target_locale,cultural_angle,tone_label,is_published')
               .eq('id', payload.variant_id).eq('tenant_id', tid)
               .limit(1).execute().data or [])
    if not variant:
        raise HTTPException(404, 'Variant not found')
    v = variant[0]

    if payload.cta_tier not in {'soft', 'medium', 'strong'}:
        raise HTTPException(400, "cta_tier must be one of: soft, medium, strong")

    tier_meta = _resolve_lookup_meta(c, 'cta_tier', payload.cta_tier)
    resulting_stage  = tier_meta.get('resulting_lifecycle_stage')
    resulting_intent = tier_meta.get('resulting_intent_label_key')

    # Persist the click row first.
    click_id = str(uuid.uuid4())
    click_row = {
        'id':                       click_id,
        'tenant_id':                tid,
        'variant_id':               payload.variant_id,
        'market_id':                v['market_id'],
        'cta_id':                   payload.cta_id,
        'cta_tier':                 payload.cta_tier,
        'cta_action':               payload.cta_action,
        'cta_intent':               payload.cta_intent,
        'atmosphere_context':       payload.atmosphere_context,
        'device_locale':            payload.device_locale,
        'time_on_article_sec':      payload.time_on_article_sec,
        'hotspots_opened':          payload.hotspots_opened,
        'materials_viewed':         payload.materials_viewed,
        'references_saved':         payload.references_saved,
        'resulting_lifecycle_stage':resulting_stage,
        'resulting_intent_label':   resulting_intent,
        'utm':                      payload.utm,
        'referrer':                 payload.referrer,
        'user_agent_label':         (request.headers.get('user-agent') or '')[:200],
        'created_at':               _iso(),
    }

    # CRM linkage: only if the visitor left identifying information OR the
    # CTA tier is medium/strong (we still create an anonymous-handle account
    # so the studio can attribute the open intent — they can choose to
    # archive it later).
    account_id = contact_id = interaction_id = None
    has_identity = bool(payload.visitor_email or payload.visitor_phone or payload.visitor_name)
    if payload.cta_tier in {'medium', 'strong'} or has_identity:
        account_name = (
            payload.visitor_name
            or (payload.visitor_email.split('@')[0] if payload.visitor_email else None)
            or f"Editorial visitor · {v['title'][:40] or v['target_locale']}"
        )
        account_id = str(uuid.uuid4())
        c.table('accounts').insert({
            'id':                account_id,
            'tenant_id':         tid,
            'account_name':      account_name,
            'account_type':      'private_client',
            'lifecycle_stage':   resulting_stage or 'new_inquiry',
            'source':            'web_form',
            'city':              payload.visitor_city,
            'country':           payload.visitor_country,
            'notes':             payload.visitor_notes,
            'last_activity_at':  _iso(),
            'metadata_json':     {
                'editorial_lead_intent': resulting_intent,
                'cta_tier':              payload.cta_tier,
                'origin_variant_id':     payload.variant_id,
                'origin_market_id':      v['market_id'],
                'origin_locale':         v['target_locale'],
                'cultural_angle':        v.get('cultural_angle'),
                'tone_label':            v.get('tone_label'),
            },
            'created_at':        _iso(),
            'updated_at':        _iso(),
        }).execute()

        if payload.visitor_name or payload.visitor_email or payload.visitor_phone:
            contact_id = str(uuid.uuid4())
            first, last = (payload.visitor_name or '').strip().split(' ', 1) if payload.visitor_name else (None, None)
            if isinstance(first, str) and ' ' not in (payload.visitor_name or ''):
                last = None
            c.table('contacts').insert({
                'id':              contact_id,
                'tenant_id':       tid,
                'account_id':      account_id,
                'first_name':      first or payload.visitor_name or '',
                'last_name':       last,
                'email':           payload.visitor_email,
                'phone':           payload.visitor_phone,
                'primary_contact': True,
                'created_at':      _iso(),
                'updated_at':      _iso(),
            }).execute()

        interaction_id = str(uuid.uuid4())
        c.table('interactions').insert({
            'id':               interaction_id,
            'tenant_id':        tid,
            'account_id':       account_id,
            'contact_id':       contact_id,
            'interaction_type': 'web_lead_generation',
            'title':            f"{payload.cta_action or payload.cta_tier} · {v['title'] or v['target_locale']}",
            'summary':          payload.visitor_notes,
            'occurred_at':      _iso(),
            'is_automatic':     True,
            'report_payload':   {
                'cta_tier':              payload.cta_tier,
                'cta_intent':            payload.cta_intent,
                'editorial_lead_intent': resulting_intent,
                'variant_id':            payload.variant_id,
                'market_id':             v['market_id'],
                'atmosphere_context':    payload.atmosphere_context,
                'hotspots_opened':       payload.hotspots_opened,
                'materials_viewed':      payload.materials_viewed,
            },
            'created_at':       _iso(),
        }).execute()

    click_row.update({
        'account_id':     account_id,
        'contact_id':     contact_id,
        'interaction_id': interaction_id,
    })
    c.table('editorial_cta_clicks').insert(click_row).execute()

    # Update lightweight performance_signals on the variant (no aggressive analytics).
    counts = (variant[0].get('performance_signals') or {}).copy() if isinstance(variant[0].get('performance_signals'), dict) else {}
    counts.setdefault('cta_click_count_by_tier', {})
    counts['cta_click_count_by_tier'][payload.cta_tier] = (
        counts['cta_click_count_by_tier'].get(payload.cta_tier, 0) + 1
    )
    c.table('editorial_variants').update({
        'performance_signals': counts, 'updated_at': _iso(),
    }).eq('id', payload.variant_id).execute()

    return {
        'click_id':       click_id,
        'account_id':     account_id,
        'contact_id':     contact_id,
        'interaction_id': interaction_id,
        'resulting_lifecycle_stage': resulting_stage,
        'resulting_intent_label':    resulting_intent,
    }
