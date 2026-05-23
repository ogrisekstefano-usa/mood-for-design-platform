"""ITER143C · Blueprint Command Center™ — Governance API.

The single control-tower router serving the `/admin/*` UI. Every endpoint
in this module is gated by `require_root_superadmin` — only the platform
ROOT can access these surfaces.

Endpoint map
────────────
  GET  /api/blueprint-admin/me                 → identity + flag check
  GET  /api/blueprint-admin/dashboard          → Dashboard Governance™
  GET  /api/blueprint-admin/tenants            → tenant orchestration list
  GET  /api/blueprint-admin/users              → user governance list
  GET  /api/blueprint-admin/presets            → atelier preset registry
  GET  /api/blueprint-admin/editorial-runtime  → blocks + locale coverage
  POST /api/blueprint-admin/editorial-runtime/{id}/regenerate
  GET  /api/blueprint-admin/email-events       → email governance feed
  GET  /api/blueprint-admin/demo/status        → demo tenant + last snapshot
  POST /api/blueprint-admin/demo/restore       → Restore Golden Snapshot™
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from database import db, db_available
from middleware.auth import require_root_superadmin
from services.editorial_content_orchestrator import (
    list_blocks,
    regenerate_block,
    ACTIVE_LOCALES,
)

log = logging.getLogger(__name__)
router = APIRouter()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _count(table: str, **filters) -> int:
    if not db_available():
        return 0
    try:
        q = db().table(table).select('id', count='exact')
        for k, v in filters.items():
            q = q.eq(k, v)
        return (q.limit(0).execute().count) or 0
    except Exception as e:
        log.warning("count(%s) failed: %s", table, e)
        return 0


# ─── Identity ─────────────────────────────────────────────────────────
@router.get("/me")
def admin_me(user: dict = Depends(require_root_superadmin)):
    return {
        "email":              user["email"],
        "profile_id":         user["profile_id"],
        "is_root_superadmin": True,
        "ready":              True,
    }


# ─── Dashboard Governance ─────────────────────────────────────────────
@router.get("/dashboard")
def dashboard_governance(user: dict = Depends(require_root_superadmin)):
    """Live counters across the platform — fast roll-up only."""
    tenants_total  = _count('tenants')
    tenants_active = _count('tenants', status='active')
    users_total    = _count('users_profile')
    users_active   = _count('users_profile', status='active')
    leads_total    = _count('relationships') if db_available() else 0
    journeys_total = _count('design_journeys') if db_available() else 0
    editorial_blocks = _count('editorial_blocks', is_active=True)
    email_events   = _count('email_events')
    demo_events    = _count('demo_snapshot_events')

    # Editorial Runtime coverage matrix
    coverage = {}
    if db_available():
        try:
            c = db()
            # Count translations per locale across active system blocks
            blocks = (c.table('editorial_blocks').select('id')
                      .eq('scope', 'system').eq('is_active', True).execute().data or [])
            total = len(blocks)
            if total:
                ids = [b['id'] for b in blocks]
                trans = (c.table('editorial_block_translations')
                         .select('locale, block_id')
                         .in_('block_id', ids).execute().data or [])
                by_locale = {}
                for r in trans:
                    by_locale.setdefault(r['locale'].lower(), set()).add(r['block_id'])
                for loc in ACTIVE_LOCALES:
                    have = len(by_locale.get(loc.lower(), set()))
                    coverage[loc] = {'have': have, 'total': total,
                                     'percent': round(100 * have / total)}
        except Exception as e:
            log.warning("editorial coverage failed: %s", e)

    return {
        "platform": {
            "tenants_total":   tenants_total,
            "tenants_active":  tenants_active,
            "users_total":     users_total,
            "users_active":    users_active,
            "leads_total":     leads_total,
            "journeys_total":  journeys_total,
        },
        "editorial_runtime": {
            "blocks_active":   editorial_blocks,
            "active_locales":  list(ACTIVE_LOCALES),
            "coverage":        coverage,
        },
        "email": {
            "events_total":    email_events,
        },
        "demo": {
            "snapshot_events": demo_events,
        },
        "generated_at": _now(),
    }


# ─── Tenant Orchestration ─────────────────────────────────────────────
@router.get("/tenants")
def admin_tenants(user: dict = Depends(require_root_superadmin)):
    if not db_available():
        return {"tenants": []}
    c = db()
    rows = (c.table('tenants')
            .select('id, slug, name, status, plan, default_locale_code, is_demo, created_at')
            .order('created_at', desc=True).execute().data or [])
    # Augment with member + journey counts (best-effort)
    for r in rows:
        r['members_count']  = _count('users_profile', tenant_id=r['id'])
        try:
            r['journeys_count'] = (c.table('design_journeys').select('id', count='exact')
                                   .eq('tenant_id', r['id']).limit(0).execute().count) or 0
        except Exception:
            r['journeys_count'] = 0
    return {"tenants": rows, "count": len(rows)}


# ─── User Governance ──────────────────────────────────────────────────
@router.get("/users")
def admin_users(user: dict = Depends(require_root_superadmin),
                limit: int = Query(200, le=500)):
    if not db_available():
        return {"users": []}
    c = db()
    rows = (c.table('users_profile')
            .select('id, email, first_name, last_name, role, status, tenant_id, '
                    'is_root_superadmin, created_at, avatar_url')
            .order('created_at', desc=True).limit(limit).execute().data or [])
    # Resolve tenant slug for display
    if rows:
        tids = list({r['tenant_id'] for r in rows if r.get('tenant_id')})
        if tids:
            tenants = (c.table('tenants').select('id, slug, name')
                       .in_('id', tids).execute().data or [])
            tmap = {t['id']: t for t in tenants}
            for r in rows:
                t = tmap.get(r.get('tenant_id'))
                r['tenant_slug'] = (t or {}).get('slug')
                r['tenant_name'] = (t or {}).get('name')
    # Compute the editorial role label (ROOT vs Blueprint Collaborator)
    for r in rows:
        if r.get('is_root_superadmin'):
            r['effective_role'] = 'root_superadmin'
        else:
            r['effective_role'] = r.get('role')
    return {"users": rows, "count": len(rows)}


# ─── Atelier Presets (view-only freeze) ───────────────────────────────
@router.get("/presets")
def admin_presets(user: dict = Depends(require_root_superadmin)):
    if not db_available():
        return {"presets": []}
    c = db()
    rows = (c.table('atelier_presets_registry')
            .select('code, display_name, position, summary, filter_json, '
                    'grain_level, vignette_level, warmth_offset, cyan_atmosphere, '
                    'is_locked, updated_at')
            .order('position').execute().data or [])
    return {"presets": rows, "count": len(rows), "frozen": True}


# ─── Editorial Runtime (Narrative Orchestration) ──────────────────────
@router.get("/editorial-runtime")
def admin_editorial_runtime(
    user: dict = Depends(require_root_superadmin),
    namespace: Optional[str] = Query(None),
    page_key: Optional[str] = Query(None),
):
    """Returns blocks grouped by namespace + per-locale coverage."""
    blocks = list_blocks(scope='system', page_key=page_key, namespace=namespace)
    # Group by namespace and project a compact UI shape.
    groups = {}
    for b in blocks:
        ns = b['namespace']
        coverage = {}
        translations = b.get('translations', [])
        by_locale = {t['locale'].lower(): t for t in translations}
        for loc in ACTIVE_LOCALES:
            t = by_locale.get(loc.lower())
            coverage[loc] = {
                'present': bool(t and (t.get('value') or '').strip()),
                'status':  (t or {}).get('status'),
                'updated_at': (t or {}).get('updated_at'),
            }
        groups.setdefault(ns, []).append({
            'id':            b['id'],
            'block_key':     b['block_key'],
            'page_key':      b.get('page_key'),
            'block_type':    b['block_type'],
            'source_locale': b['source_locale'],
            'source_value':  b['source_value'],
            'coverage':      coverage,
            'updated_at':    b.get('updated_at'),
        })
    return {
        "groups":         groups,
        "namespaces":     sorted(groups.keys()),
        "active_locales": list(ACTIVE_LOCALES),
    }


@router.post("/editorial-runtime/{block_id}/regenerate")
def admin_editorial_regenerate(
    block_id: str,
    user: dict = Depends(require_root_superadmin),
):
    return regenerate_block(block_id, force=True)


# ─── Email Governance ─────────────────────────────────────────────────
@router.get("/email-events")
def admin_email_events(
    user: dict = Depends(require_root_superadmin),
    tenant_id: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
):
    if not db_available():
        return {"events": [], "count": 0}
    c = db()
    q = (c.table('email_events')
         .select('id, tenant_id, event_type, recipient, subject, status, '
                 'provider, locale, error, opened_at, clicked_at, created_at')
         .order('created_at', desc=True).limit(limit))
    if tenant_id:
        q = q.eq('tenant_id', tenant_id)
    if event_type:
        q = q.eq('event_type', event_type)
    if status:
        q = q.eq('status', status)
    rows = q.execute().data or []
    # Stats roll-up
    stats = {'queued': 0, 'sent': 0, 'failed': 0, 'bounced': 0}
    try:
        for k in stats:
            stats[k] = _count('email_events', status=k)
    except Exception:
        pass
    return {"events": rows, "count": len(rows), "stats": stats}


# ─── Demo Governance ──────────────────────────────────────────────────
@router.get("/demo/status")
def admin_demo_status(user: dict = Depends(require_root_superadmin)):
    if not db_available():
        return {"available": False}
    c = db()
    tenant_row = (c.table('tenants').select('id, slug, name, status, is_demo, default_locale_code')
                  .eq('slug', 'mood-demo').limit(1).execute().data or [])
    if not tenant_row:
        return {"available": False, "reason": "demo_tenant_missing"}
    t = tenant_row[0]
    # Last snapshot event
    last = (c.table('demo_snapshot_events').select('action, created_at, initiated_by, duration_ms')
            .eq('tenant_id', t['id']).order('created_at', desc=True).limit(1).execute().data or [])
    # Inventory of current tenant content
    inv = {
        'users':       _count('users_profile', tenant_id=t['id']),
        'relationships': _count('relationships', tenant_id=t['id']) if db_available() else 0,
        'journeys':    _count('design_journeys', tenant_id=t['id']) if db_available() else 0,
    }
    return {
        "available": True,
        "tenant":    t,
        "inventory": inv,
        "last_snapshot": last[0] if last else None,
    }


@router.post("/demo/restore")
def admin_demo_restore(user: dict = Depends(require_root_superadmin)):
    """Restore Golden Snapshot™ — deterministic reseed orchestration.

    What it does (Phase 1 conservative):
      • Records the intent in `demo_snapshot_events` (action='restore').
      • Wipes RUNTIME content for the demo tenant: relationships,
        relationship_actions, design_journeys (+ welcome tokens),
        moodboards (header only — block-level reset deferred),
        proposals, inspirations_items.
      • PRESERVES: tenant config, users_profile, atelier_presets_registry,
        editorial_blocks (governance), editorial translations.

    The actual reseed of demo content (curated showcase moodboard,
    one example journey) is deferred to ITER141.3 to keep this freeze
    surgical. The endpoint returns the wipe inventory so the operator
    knows exactly what was reset.
    """
    if not db_available():
        raise HTTPException(503, "database unavailable")
    c = db()
    tenant_row = (c.table('tenants').select('id, slug')
                  .eq('slug', 'mood-demo').limit(1).execute().data or [])
    if not tenant_row:
        raise HTTPException(404, "demo tenant not found")
    tenant_id = tenant_row[0]['id']

    started = datetime.now(timezone.utc)
    wiped = {}

    # Conservative wipe list — only tables we KNOW exist + can scope.
    wipe_targets = [
        'relationship_actions',
        'relationships',
        'design_journeys',
        'journey_welcome_tokens',
        'milestones',
        'project_notes',
        'project_tasks',
        'moodboards',
        'proposals',
        'inspirations_items',
        'inspirations_boards',
        'leads',
    ]
    for table in wipe_targets:
        try:
            # First count what we're about to delete (for the audit log)
            try:
                before = (c.table(table).select('id', count='exact')
                          .eq('tenant_id', tenant_id).limit(0).execute().count) or 0
            except Exception:
                before = 0
            c.table(table).delete().eq('tenant_id', tenant_id).execute()
            wiped[table] = before
        except Exception as e:
            log.warning("wipe %s failed: %s", table, e)
            wiped[table] = f"skipped: {str(e)[:60]}"

    duration_ms = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)

    # Audit row
    try:
        c.table('demo_snapshot_events').insert({
            'id':            str(uuid.uuid4()),
            'tenant_id':     tenant_id,
            'action':        'restore',
            'initiated_by':  user.get('profile_id'),
            'preserved':     {'users': True, 'presets': True, 'locale': True,
                              'editorial_runtime': True, 'tenant_config': True},
            'wiped':         {k: v for k, v in wiped.items() if isinstance(v, int) and v > 0},
            'duration_ms':   duration_ms,
            'notes':         'ITER143C · conservative restore (no reseed)',
            'created_at':    _now(),
        }).execute()
    except Exception as e:
        log.warning("snapshot audit insert failed: %s", e)

    return {
        "restored":      True,
        "tenant_id":     tenant_id,
        "wiped":         wiped,
        "preserved":     ['users', 'tenant_config', 'atelier_presets',
                          'editorial_runtime', 'locale_governance'],
        "duration_ms":   duration_ms,
        "next_action":   "ITER141.3 minimal demo reseed (deferred)",
    }
