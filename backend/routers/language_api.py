"""Language Command Center™ API · ITER127.

Endpoints
─────────
  GET    /api/language/health        — locales · counts · health
  GET    /api/language/registry      — full UI Copy Registry (flattened keys × locales)
                                       supports ?surface, ?search, ?missing_only, ?leak_only,
                                       ?locale (returns only that locale + base it)
  POST   /api/language/override      — upsert an override for (key, locale)
  DELETE /api/language/override      — remove an override (revert to baseline)
  GET    /api/language/leaks         — Italian Leakage Detector™ snapshots
  POST   /api/language/leaks/ingest  — accept a batch of leaks (from CLI or browser)
  GET    /api/language/audit/last    — last audit run summary
  POST   /api/language/audit/ingest  — accept a CLI audit report
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core.tenant_context import get_tenant_context

router = APIRouter()

STRINGS_DIR = Path('/app/frontend/src/i18n/strings')
ADMIN_ROLES = frozenset({'super_admin', 'tenant_admin', 'designer'})
REVIEW_STATUSES = frozenset({'ai_suggested', 'human_reviewed', 'locked_approved', 'stale'})


# ─── helpers ───────────────────────────────────────────────────
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_admin(ctx: dict) -> None:
    if (ctx.get('role') or '').lower() not in ADMIN_ROLES:
        raise HTTPException(403, "forbidden")


def _load_locale_dict(locale: str) -> dict:
    path = STRINGS_DIR / f'{locale}.json'
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return {}


_LOCALES = ('it-IT', 'en-US', 'en-GB', 'fr-FR', 'de-DE', 'es-ES', 'ar')


def _flatten(d: dict, prefix: str = '') -> dict:
    out = {}
    for k, v in (d or {}).items():
        path = f'{prefix}.{k}' if prefix else k
        if isinstance(v, dict):
            out.update(_flatten(v, path))
        elif isinstance(v, str):
            out[path] = v
    return out


def _surface_of_key(key_path: str) -> str:
    """Coarse mapping key namespace → surface label, used by the UI filter."""
    head = key_path.split('.', 1)[0] if key_path else ''
    return {
        'nav':              'Navigation',
        'sidebar':          'Navigation',
        'dashboard':        'Dashboard',
        'studio_pulse':     'Dashboard',
        'journey':          'Design Journey',
        'journeys':         'Design Journey',
        'milestone':        'Design Journey',
        'crm':              'CRM',
        'accounts':         'CRM',
        'follow_ups':       'CRM',
        'inspirations':     'Inspirations',
        'brand_atlas':      'Brand Atlas',
        'material_view':    'Material View',
        'cultural':         'Cultural Editions',
        'cultural_editions':'Cultural Editions',
        'editorial':        'Editorial Calendar',
        'publication':      'Publication Review',
        'magazine':         'Magazine',
        'market':           'Market Editions',
        'experience':       'Experience Studio',
        'insights':         'Insights',
        'studio_identity':  'Studio Identity',
        'integrations':     'Integrations',
        'forms':            'Forms & Journeys',
        'client':           'Client Companion',
        'companion':        'Client Companion',
        'dossier':          'Dossier',
        'common':           'Common',
        'auth':             'Auth',
    }.get(head, 'Other')


# ─── /api/language/health ──────────────────────────────────────
@router.get("/health")
def health():
    locales = []
    for lc in _LOCALES:
        d = _load_locale_dict(lc)
        locales.append({'locale': lc, 'string_count': len(_flatten(d))})
    return {"ok": True, "locales": locales,
            "registry_path": str(STRINGS_DIR),
            "supported_review_statuses": sorted(REVIEW_STATUSES)}


# ─── /api/language/registry ────────────────────────────────────
@router.get("/registry")
def registry(
    surface:      Optional[str] = Query(None),
    search:       Optional[str] = Query(None),
    locale:       Optional[str] = Query(None),
    missing_only: bool          = Query(False),
    limit:        int           = Query(500, ge=1, le=5000),
    ctx: dict = Depends(get_tenant_context),
):
    """Return the merged UI Copy Registry: every key × every locale, with
    overrides applied on top. Each item is `{ key, surface, source_text,
    locales: { 'it-IT': {text, source:'base|override', review_status, ...}, ... } }`."""
    base = {lc: _flatten(_load_locale_dict(lc)) for lc in _LOCALES}
    keys = set()
    for d in base.values():
        keys.update(d.keys())

    overrides = _load_tenant_overrides(ctx.get('tenant_id'))
    # iter127: include override-only keys (new keys defined by the studio in
    # the Command Center that don't exist in the baseline JSON yet).
    for (k, _lc) in overrides.keys():
        keys.add(k)

    items = []
    for key in sorted(keys):
        srf = _surface_of_key(key)
        if surface and surface.lower() != srf.lower():
            continue
        if search:
            q = search.lower()
            in_key = q in key.lower()
            in_val = any(q in (base[lc].get(key) or '').lower() for lc in _LOCALES)
            if not (in_key or in_val):
                continue
        loc_map = {}
        any_missing = False
        for lc in _LOCALES:
            base_val = base[lc].get(key)
            ov = overrides.get((key, lc))
            if ov:
                loc_map[lc] = {
                    'text':          ov['override_text'],
                    'source':        'override',
                    'review_status': ov['review_status'],
                    'updated_at':    ov.get('updated_at'),
                }
            elif base_val is not None:
                loc_map[lc] = {'text': base_val, 'source': 'base',
                               'review_status': 'ai_suggested'}
            else:
                loc_map[lc] = {'text': None, 'source': 'missing',
                               'review_status': 'stale'}
                any_missing = True
        if missing_only and not any_missing:
            continue
        if locale and locale in _LOCALES:
            # caller wants a single locale + the IT baseline for context
            keep = {locale, 'it-IT'}
            loc_map = {k: v for k, v in loc_map.items() if k in keep}
        items.append({
            'key':         key,
            'surface':     srf,
            'source_text': base['it-IT'].get(key),
            'locales':     loc_map,
        })
        if len(items) >= limit:
            break

    return {
        'items':   items,
        'total':   len(items),
        'limit':   limit,
        'filters': {'surface': surface, 'search': search,
                    'locale': locale, 'missing_only': missing_only},
    }


def _load_tenant_overrides(tenant_id: Optional[str]) -> dict:
    if not tenant_id:
        return {}
    try:
        from database import db, db_available
        if not db_available():
            return {}
        res = (db().table('localization_overrides')
               .select('key_path, locale, override_text, review_status, source_text, updated_at')
               .eq('tenant_id', tenant_id).execute())
        return {(r['key_path'], r['locale']): r for r in (res.data or [])}
    except Exception:
        return {}


# ─── overrides CRUD ─────────────────────────────────────────────
class OverridePayload(BaseModel):
    key_path:      str = Field(..., min_length=1, max_length=200)
    locale:        str = Field(..., min_length=2, max_length=10)
    override_text: str = Field(..., min_length=1, max_length=4000)
    review_status: str = 'human_reviewed'
    surface:       Optional[str] = None


@router.post("/override")
def upsert_override(payload: OverridePayload, ctx: dict = Depends(get_tenant_context)):
    _require_admin(ctx)
    tenant_id = ctx.get('tenant_id')
    if not tenant_id:
        raise HTTPException(400, "tenant_required")
    if payload.review_status not in REVIEW_STATUSES:
        raise HTTPException(422, {"error": "invalid_status",
                                  "valid": sorted(REVIEW_STATUSES)})
    if payload.locale not in _LOCALES:
        raise HTTPException(422, {"error": "unsupported_locale", "valid": list(_LOCALES)})
    base = _flatten(_load_locale_dict(payload.locale)).get(payload.key_path)
    try:
        from database import db, db_available
        if not db_available():
            raise HTTPException(503, "db_unavailable")
        res = db().table('localization_overrides').upsert({
            'tenant_id':     tenant_id,
            'key_path':      payload.key_path,
            'locale':        payload.locale,
            'override_text': payload.override_text.strip(),
            'review_status': payload.review_status,
            'source_text':   base,
            'surface':       payload.surface or _surface_of_key(payload.key_path),
            'reviewed_by':   ctx.get('profile_id') or ctx.get('user_id'),
            'reviewed_at':   _now_iso(),
            'updated_at':    _now_iso(),
        }, on_conflict='tenant_id,key_path,locale').execute()
        return {"ok": True, "item": (res.data or [None])[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"override save failed: {e}")


@router.delete("/override")
def delete_override(key_path: str = Query(...), locale: str = Query(...),
                    ctx: dict = Depends(get_tenant_context)):
    _require_admin(ctx)
    tenant_id = ctx.get('tenant_id')
    if not tenant_id:
        raise HTTPException(400, "tenant_required")
    try:
        from database import db, db_available
        if not db_available():
            raise HTTPException(503, "db_unavailable")
        db().table('localization_overrides').delete().eq('tenant_id', tenant_id) \
           .eq('key_path', key_path).eq('locale', locale).execute()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"override delete failed: {e}")


# ─── audit / leaks ingestion ───────────────────────────────────
class LeakItem(BaseModel):
    phrase:   str
    locale:   str
    page:     str
    testid:   Optional[str] = None
    snippet:  Optional[str] = None
    count:    int = 1


class AuditReport(BaseModel):
    locale:        str
    pages_scanned: int = 0
    leaks:         List[LeakItem] = []
    missing:       List[dict] = []
    triggered_via: Optional[str] = 'cli'


@router.post("/audit/ingest")
def ingest_audit(report: AuditReport, ctx: dict = Depends(get_tenant_context)):
    _require_admin(ctx)
    try:
        from database import db, db_available
        if not db_available():
            return {"ok": False, "reason": "db_unavailable"}
        leaks_total   = sum(l.count for l in report.leaks)
        missing_total = len(report.missing)
        # store the run row + raw report
        res = db().table('localization_audit_runs').insert({
            'tenant_id':     ctx.get('tenant_id'),
            'locale':        report.locale,
            'pages_scanned': report.pages_scanned,
            'leaks_total':   leaks_total,
            'missing_total': missing_total,
            'report_json':   {
                'leaks':   [l.model_dump() for l in report.leaks],
                'missing': report.missing,
            },
            'triggered_by':  ctx.get('profile_id') or ctx.get('user_id'),
            'triggered_via': report.triggered_via or 'cli',
        }).execute()
        return {"ok": True, "run_id": (res.data or [{}])[0].get('id'),
                "leaks_total": leaks_total, "missing_total": missing_total}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"audit ingest failed: {e}")


@router.get("/audit/last")
def last_audit(ctx: dict = Depends(get_tenant_context)):
    try:
        from database import db, db_available
        if not db_available():
            return {"item": None}
        q = (db().table('localization_audit_runs')
             .select('id, locale, pages_scanned, leaks_total, missing_total, '
                     'report_json, triggered_via, created_at'))
        tenant_id = ctx.get('tenant_id')
        if tenant_id:
            q = q.eq('tenant_id', tenant_id)
        res = q.order('created_at', desc=True).limit(1).execute()
        return {"item": (res.data or [None])[0]}
    except Exception as e:
        raise HTTPException(500, f"last audit failed: {e}")


@router.get("/leaks")
def list_leaks(limit: int = Query(100, ge=1, le=500),
               ctx: dict = Depends(get_tenant_context)):
    """Returns aggregated leaks from the most recent audit run."""
    last = last_audit(ctx).get('item')
    if not last:
        return {"items": [], "run_id": None}
    leaks = (last.get('report_json') or {}).get('leaks', [])
    return {"items": leaks[:limit], "run_id": last['id'],
            "scanned_at": last['created_at'],
            "locale": last['locale']}
