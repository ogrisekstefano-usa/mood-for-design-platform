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
        leaks_total   = sum(item.count for item in report.leaks)
        missing_total = len(report.missing)
        # store the run row + raw report
        res = db().table('localization_audit_runs').insert({
            'tenant_id':     ctx.get('tenant_id'),
            'locale':        report.locale,
            'pages_scanned': report.pages_scanned,
            'leaks_total':   leaks_total,
            'missing_total': missing_total,
            'report_json':   {
                'leaks':   [item.model_dump() for item in report.leaks],
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


# ─── ITER132 · Editorial Translation Studio™ admin views ────────────────
@router.get("/editorial-translations/stats")
def editorial_translation_stats(ctx: dict = Depends(get_tenant_context)):
    """High-level TM stats for the Editorial Translation Studio™ panel."""
    try:
        from services.editorial_translation_layer import cache_stats
        return cache_stats(ctx.get('tenant_id'))
    except Exception as e:
        return {'available': False, 'error': str(e)[:200]}


@router.get("/editorial-translations")
def list_editorial_translations(
    target_locale: Optional[str] = Query(None),
    review_status: Optional[str] = Query(None),
    locked: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    ctx: dict = Depends(get_tenant_context),
):
    """List cached editorial translations for review / approval / lock.
    Returns IT source · target locale value · status · model · timestamps."""
    _require_admin(ctx)
    try:
        from database import db, db_available
        if not db_available():
            return {"items": [], "total": 0, "available": False}
        q = (db().table('editorial_translations')
             .select('id, content_hash, source_locale, target_locale, source_text, '
                     'translated_text, review_status, locked, model, source_field, '
                     'created_at, updated_at, reviewed_at, ai_generated, manual_refined',
                     count='exact')
             .eq('tenant_id', ctx.get('tenant_id')))
        if target_locale:
            q = q.eq('target_locale', target_locale)
        if review_status:
            q = q.eq('review_status', review_status)
        if locked is not None:
            q = q.eq('locked', locked)
        q = q.order('updated_at', desc=True).range(offset, offset + limit - 1)
        res = q.execute()
        return {
            "items": res.data or [],
            "total": res.count or 0,
            "available": True,
        }
    except Exception as e:
        return {"items": [], "total": 0, "available": False, "error": str(e)[:200]}


class EditorialTranslationUpdate(BaseModel):
    translated_text: Optional[str] = None
    review_status:   Optional[str] = None
    locked:          Optional[bool] = None


@router.patch("/editorial-translations/{translation_id}")
def update_editorial_translation(
    translation_id: str,
    body: EditorialTranslationUpdate,
    ctx: dict = Depends(get_tenant_context),
):
    """Update a cached editorial translation (refine wording, lock as the
    approved version, or change its review state)."""
    _require_admin(ctx)
    payload: dict = {'updated_at': _now_iso()}
    if body.translated_text is not None:
        payload['translated_text'] = body.translated_text.strip()
        payload['manual_refined'] = True
    if body.review_status is not None:
        if body.review_status not in ('ai_suggested', 'reviewed', 'locked_approved', 'rejected'):
            raise HTTPException(400, "invalid review_status")
        payload['review_status'] = body.review_status
        if body.review_status in ('reviewed', 'locked_approved'):
            payload['reviewed_at'] = _now_iso()
            payload['reviewed_by'] = ctx.get('profile_id') or ctx.get('user_id')
    if body.locked is not None:
        payload['locked'] = bool(body.locked)
        if body.locked:
            payload['review_status'] = payload.get('review_status') or 'locked_approved'
    try:
        from database import db, db_available
        if not db_available():
            raise HTTPException(503, "database unavailable")
        res = (db().table('editorial_translations')
               .update(payload)
               .eq('id', translation_id)
               .eq('tenant_id', ctx.get('tenant_id'))
               .execute())
        rows = res.data or []
        if not rows:
            raise HTTPException(404, "translation not found")
        return rows[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"update failed: {str(e)[:200]}")


# ─── ITER130 · Bulk Editorial Batch Translate (Studio Voice + ALE) ─────
class BatchTranslateItem(BaseModel):
    key_path:     str
    source_text:  str
    review_status: str = 'ai_suggested'


class BatchTranslateRequest(BaseModel):
    source_locale: str = 'it'
    target_locale: str
    items:         List[BatchTranslateItem]
    dry_run:       bool = False
    persist:       bool = True


@router.post("/batch-translate")
def batch_translate(payload: BatchTranslateRequest,
                    ctx: dict = Depends(get_tenant_context)):
    """Editorial batch translation pipeline.

    Powers the Language Command Center's "Refine in bulk with Studio Voice™"
    action. For every (key_path, source_text), the endpoint:

      1. Runs the text through `relational_translation.translate(...)` —
         Claude Sonnet 4.5 · DNT-aware · Studio Voice™ injected.
      2. When `persist=True`, upserts the result into `localization_overrides`
         (review_status from the item, default `ai_suggested`).
      3. Returns a per-item report: `{key, locale, original, localized,
         translated (bool), confidence, model, error?}`.

    `dry_run=True` skips the DB write but still returns the localized text
    — useful for preview-then-approve UX in the Command Center.
    """
    _require_admin(ctx)
    tenant_id = ctx.get('tenant_id')
    src = (payload.source_locale or 'it').strip()
    # Normalise: relational_translation.SUPPORTED_LOCALES uses 'it' (no region).
    src_translate = 'it' if src.lower().startswith('it') else src
    tgt = payload.target_locale.strip()
    tgt_translate = tgt
    # The translate() service uses 'fr' / 'de' / 'es' (no region) — bridge it.
    if tgt.lower() in {'fr-fr', 'fr'}:
        tgt_translate = 'fr'
    elif tgt.lower() in {'de-de', 'de'}:
        tgt_translate = 'de'
    elif tgt.lower() in {'es-es', 'es'}:
        tgt_translate = 'es'
    elif tgt.lower() in {'it-it', 'it'}:
        tgt_translate = 'it'
    elif tgt.lower() in {'ar-ae', 'ar'}:
        tgt_translate = 'ar'
    # en-US / en-GB pass through verbatim.

    # Studio Voice™ addendum — best-effort, never fatal.
    voice_addendum = ""
    try:
        from services.studio_voice import voice_addendum_for_prompt
        voice_addendum = voice_addendum_for_prompt(tenant_id, src_translate, tgt_translate) or ""
    except Exception:  # pragma: no cover — Studio Voice is best-effort
        voice_addendum = ""

    # Lazy import: only needed when we persist.
    db_fn = db_available_fn = None
    if payload.persist and not payload.dry_run:
        try:
            from database import db as _db, db_available as _ok
            db_fn, db_available_fn = _db, _ok
        except Exception:
            db_fn = db_available_fn = None

    from services.relational_translation import translate as _translate
    report = []
    succ = fail = 0
    for it in payload.items:
        try:
            r = _translate(
                it.source_text,
                source_locale=src_translate,
                target_locale=tgt_translate,
                voice_addendum=voice_addendum,
            )
            rec = {
                'key':        it.key_path,
                'locale':     tgt,
                'original':   r.original,
                'localized':  r.localized,
                'translated': bool(r.translated),
                'model':      r.model,
                'confidence': r.confidence,
                'error':      r.error,
            }
            if r.translated:
                succ += 1
            else:
                fail += 1

            # Persist as override when requested.
            if (payload.persist and not payload.dry_run and r.translated
                    and tenant_id and db_fn and db_available_fn and db_available_fn()):
                try:
                    db_fn().table('localization_overrides').upsert({
                        'tenant_id':     tenant_id,
                        'key_path':      it.key_path,
                        'locale':        tgt,
                        'override_text': r.localized.strip(),
                        'review_status': it.review_status or 'ai_suggested',
                        'source_text':   r.original,
                        'surface':       _surface_of_key(it.key_path),
                        'reviewed_by':   ctx.get('profile_id') or ctx.get('user_id'),
                        'reviewed_at':   _now_iso(),
                        'updated_at':    _now_iso(),
                    }, on_conflict='tenant_id,key_path,locale').execute()
                    rec['persisted'] = True
                except Exception as pe:
                    rec['persisted'] = False
                    rec['persist_error'] = str(pe)[:200]
            else:
                rec['persisted'] = False
            report.append(rec)
        except Exception as e:
            fail += 1
            report.append({
                'key': it.key_path, 'locale': tgt,
                'original': it.source_text,
                'localized': it.source_text,
                'translated': False, 'error': str(e)[:200],
            })

    return {
        'source_locale':   src,
        'target_locale':   tgt,
        'requested':       len(payload.items),
        'translated_ok':   succ,
        'failed':          fail,
        'persisted':       sum(1 for r in report if r.get('persisted')),
        'voice_addendum':  bool(voice_addendum),
        'items':           report,
    }


# ─── ITER132 · Runtime Localization Heatmap™ static surface ───────────
# These endpoints expose the autonomous-loop artefacts written by
# `scripts/full_runtime_localization_crawler.py` + remediator. Auth is
# admin-only since the heatmap reveals internal governance state.
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse  # noqa: E402

_GOV_DIR = Path('/app/governance')


@router.get("/runtime/summary")
def runtime_summary(ctx: dict = Depends(get_tenant_context)):
    """Latest crawler summary + iteration history (read from disk + SQLite)."""
    _require_admin(ctx)
    report_path = _GOV_DIR / 'runtime-localization-report.json'
    if not report_path.exists():
        return {
            "available": False,
            "message": "No crawl on file. Run `python3 /app/scripts/runtime_remediation_loop.py`.",
        }
    report = json.loads(report_path.read_text('utf-8'))
    # Iteration history from SQLite (optional, best-effort).
    iterations = []
    try:
        import sqlite3
        db_path = _GOV_DIR / 'runtime_leaks.db'
        if db_path.exists():
            conn = sqlite3.connect(str(db_path))
            for r in conn.execute(
                "SELECT n, started_at, finished_at, summary_json "
                "FROM iterations ORDER BY n DESC LIMIT 20"
            ):
                iterations.append({
                    "n": r[0], "started_at": r[1], "finished_at": r[2],
                    "summary": json.loads(r[3] or '{}'),
                })
            conn.close()
    except Exception:
        pass
    return {
        "available": True,
        "locale": report.get('locale'),
        "generated_at": report.get('generated_at'),
        "routes_crawled": report.get('routes_crawled'),
        "summary": report.get('summary'),
        "iterations": iterations,
    }


@router.get("/runtime/heatmap")
def runtime_heatmap(ctx: dict = Depends(get_tenant_context)):
    """Serves the editorial Localization Heatmap™ HTML."""
    _require_admin(ctx)
    f = _GOV_DIR / 'runtime-localization-heatmap.html'
    if not f.exists():
        return HTMLResponse(
            "<h1>No heatmap on file</h1>"
            "<p>Run <code>python3 /app/scripts/runtime_remediation_loop.py</code> first.</p>",
            status_code=404,
        )
    return HTMLResponse(f.read_text('utf-8'))


@router.get("/runtime/report")
def runtime_report(ctx: dict = Depends(get_tenant_context)):
    """Raw crawler report as JSON."""
    _require_admin(ctx)
    f = _GOV_DIR / 'runtime-localization-report.json'
    if not f.exists():
        return JSONResponse({"available": False}, status_code=404)
    return JSONResponse(json.loads(f.read_text('utf-8')))


@router.get("/runtime/leaks")
def runtime_leak_db(
    open_only: bool = Query(False),
    limit: int = Query(200, ge=1, le=500),
    ctx: dict = Depends(get_tenant_context),
):
    """Reads the SQLite leak DB written by the auto-remediation engine."""
    _require_admin(ctx)
    db_path = _GOV_DIR / 'runtime_leaks.db'
    if not db_path.exists():
        return {"items": [], "available": False}
    import sqlite3
    conn = sqlite3.connect(str(db_path))
    q = (
        "SELECT id, iteration, kind, page, text, testid, source, severity, "
        "first_seen, last_seen, resolution_method, fixed_at, occurrences "
        "FROM leaks "
    )
    if open_only:
        q += "WHERE resolution_method IS NULL "
    q += "ORDER BY last_seen DESC LIMIT ?"
    items = []
    for r in conn.execute(q, (limit,)):
        items.append({
            "id": r[0], "iteration": r[1], "kind": r[2], "page": r[3],
            "text": r[4], "testid": r[5], "source": r[6], "severity": r[7],
            "first_seen": r[8], "last_seen": r[9],
            "resolution_method": r[10], "fixed_at": r[11], "occurrences": r[12],
        })
    conn.close()
    return {"available": True, "items": items, "total": len(items)}


@router.get("/runtime/screenshot/{key}")
def runtime_screenshot(key: str, ctx: dict = Depends(get_tenant_context)):
    """Serves a per-route JPG captured during the crawl."""
    _require_admin(ctx)
    # Defensive: key is a route slug — strict charset (no traversal, no
    # consecutive dashes/underscores) and length capped at 80.
    import re as _re
    if not _re.fullmatch(r'[a-z0-9]+(?:[_-][a-z0-9]+)*', key) or len(key) > 80:
        raise HTTPException(400, "invalid_key")
    f = _GOV_DIR / 'runtime-localization-screenshots' / f'{key}.jpg'
    if not f.exists():
        raise HTTPException(404, "not_found")
    return FileResponse(str(f), media_type='image/jpeg')



# ─── ITER134 · Self-Healing Localization Loop™ orchestration ────────────
from services import runtime_loop_jobs  # noqa: E402


class RunLoopRequest(BaseModel):
    locales: Optional[List[str]] = None
    max_iters: int = 3
    no_restart: bool = False


@router.post("/runtime/run-loop")
def runtime_run_loop(
    body: RunLoopRequest,
    ctx: dict = Depends(get_tenant_context),
):
    """Launch the autonomous self-healing remediation loop in background.

    Body:
      - locales:      list of locale codes (default ['en-US']); valid set is
                      it-IT · en-US · en-GB · fr-FR · de-DE · es-ES · ar
      - max_iters:    crawler/remediator iterations per locale (default 3)
      - no_restart:   skip supervisorctl restart between iterations (for
                      quick CI runs); production should leave this False.

    Behaviour:
      - Refuses a new launch while another loop is in flight (HTTP 409).
      - Returns immediately with the `job_id` to poll.
    """
    _require_admin(ctx)
    locales = body.locales or ['en-US']
    if body.max_iters < 1 or body.max_iters > 6:
        raise HTTPException(400, "max_iters must be 1..6")
    res = runtime_loop_jobs.launch_loop(
        locales=locales, max_iters=body.max_iters, no_restart=body.no_restart,
    )
    if not res.get("ok"):
        if res.get("reason") == "concurrent_job":
            raise HTTPException(409, detail=res)
        raise HTTPException(400, detail=res)
    return res


# ─── ITER135 · Semantic Editorial Review™ ──────────────────────────────
from services import semantic_rewrite_engine  # noqa: E402


class SemanticPreviewRequest(BaseModel):
    source_text: str = Field(..., min_length=1, max_length=2000)
    source_locale: str = "it-IT"
    key: Optional[str] = None
    target_locales: Optional[List[str]] = None
    market_context: Optional[dict] = None
    use_cache: bool = True


@router.post("/runtime/semantic-rewrite")
def runtime_semantic_rewrite(
    body: SemanticPreviewRequest,
    ctx: dict = Depends(get_tenant_context),
):
    """ITER135 · Generate side-by-side semantic rewrites of a source string
    across one or more target locales.

    This is the back-end of the Semantic Editorial Review™ tab: the studio
    types/pastes one source phrase, picks markets, sees seven distinct
    editorial voices written by Claude Sonnet 4.5 with per-market voice
    directives. NOT a literal translator — the model is asked to
    reinterpret for each market.
    """
    _require_admin(ctx)
    target_locales = body.target_locales or [
        loc for loc in semantic_rewrite_engine.ALL_LOCALES
        if loc != body.source_locale
    ]
    invalid = [loc for loc in target_locales
               if loc not in semantic_rewrite_engine.ALL_LOCALES]
    if invalid:
        raise HTTPException(400, detail={"reason": "invalid_locales", "invalid": invalid})

    rewrites = semantic_rewrite_engine.batch_rewrite_key(
        source_text=body.source_text,
        source_locale=body.source_locale,
        key=body.key,
        target_locales=target_locales,
        market_context=body.market_context,
    )
    return {
        "source_locale": body.source_locale,
        "source_text": body.source_text,
        "key": body.key,
        "rewrites": [
            {
                "target_locale": loc,
                "text": r.text,
                "rationale": r.rationale,
                "model": r.model,
                "duration_ms": r.duration_ms,
                "cached": r.cached,
                "fallback": r.fallback,
            }
            for loc, r in rewrites.items()
        ],
        "voice_profiles": {
            loc: {
                "label":     v["label"],
                "tone":      v["tone"],
                "rhythm":    v["rhythm"],
                "luxury":    v["luxury_positioning"],
            }
            for loc, v in semantic_rewrite_engine.MARKET_VOICES.items()
            if loc in [body.source_locale, *target_locales]
        },
    }


@router.get("/runtime/voice-profiles")
def runtime_voice_profiles(ctx: dict = Depends(get_tenant_context)):
    """All 7 in-market editorial voices (label · tone · rhythm · luxury)."""
    _require_admin(ctx)
    return {
        "locales": list(semantic_rewrite_engine.ALL_LOCALES),
        "profiles": {
            loc: {
                "label":              v["label"],
                "tone":               v["tone"],
                "rhythm":             v["rhythm"],
                "vocabulary":         v["vocabulary"],
                "cta":                v["cta"],
                "luxury_positioning": v["luxury_positioning"],
                "voice_directive":    v["voice_directive"],
            }
            for loc, v in semantic_rewrite_engine.MARKET_VOICES.items()
        },
    }



@router.get("/runtime/run-loop/status/{job_id}")
def runtime_run_loop_status(
    job_id: str,
    ctx: dict = Depends(get_tenant_context),
):
    """Returns the current status of a self-healing job. Safe to poll."""
    _require_admin(ctx)
    import re as _re
    if not _re.fullmatch(r'[a-f0-9]{8,32}', job_id):
        raise HTTPException(400, "invalid_job_id")
    res = runtime_loop_jobs.get_status(job_id)
    if not res.get("ok"):
        raise HTTPException(404, detail=res)
    return res["status"]


@router.get("/runtime/run-loop/jobs")
def runtime_list_jobs(
    limit: int = Query(20, ge=1, le=100),
    ctx: dict = Depends(get_tenant_context),
):
    """Last N jobs (newest first), summary fields only."""
    _require_admin(ctx)
    return {"items": runtime_loop_jobs.list_jobs(limit=limit)}


@router.post("/runtime/run-loop/{job_id}/cancel")
def runtime_cancel_job(job_id: str, ctx: dict = Depends(get_tenant_context)):
    _require_admin(ctx)
    import re as _re
    if not _re.fullmatch(r'[a-f0-9]{8,32}', job_id):
        raise HTTPException(400, "invalid_job_id")
    return runtime_loop_jobs.kill_job(job_id)


@router.post("/runtime/clear-fixed-leaks")
def runtime_clear_fixed_leaks(ctx: dict = Depends(get_tenant_context)):
    """Delete all rows from runtime_leaks.db where resolution_method != NULL.
    Returns the count of pruned rows.
    """
    _require_admin(ctx)
    return runtime_loop_jobs.clear_fixed_leaks()
