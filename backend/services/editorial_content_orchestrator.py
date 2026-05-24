"""ITER143A+ · Dynamic Editorial Runtime™ — Content Orchestrator.

The single source of truth for any visible editorial copy on the public
platform (begin-journey, professionals, header, footer, CTA, chips,
empty states, validation, toasts, helpers, narrative).

Design rules
────────────
1. **ZERO hardcoded content**: every visible string is a `editorial_blocks`
   row keyed by (namespace, block_key) with a `source_value` written in the
   studio's preferred authoring locale (default: `it`).
2. **Auto Localization**: at seed/upsert time, the Auto Localization Engine
   walks the active locales matrix and persists per-locale variants via
   the ALE (relational_translation). Cached in `editorial_block_translations`.
3. **STRICT locale chain — NO cross-language fallback**.
   Allowed:   en-US → en-GB → en
   FORBIDDEN: en-US → it
4. **Override-able manually**: a translation row with `status='manual'` is
   pinned. Regeneration skips it unless force=True is passed.
5. **Page bundle resolver**: the runtime serves bundles per `page_key`
   pre-warmed in a process-local cache. The frontend pre-loads the bundle
   BEFORE the first paint — no IT→EN flash.
"""
from __future__ import annotations

import hashlib
import logging
import threading
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from database import db, db_available
from services.relational_translation import translate

log = logging.getLogger(__name__)

# ─── Active locales matrix ────────────────────────────────────────────
# The 6 public-facing locales that get auto-localized on every upsert.
# Locale codes are stored lowercased canonical (BCP-47) in the DB.
ACTIVE_LOCALES: Tuple[str, ...] = (
    'it-it',
    'en-us',
    'en-gb',
    'fr-fr',
    'de-de',
    'es-es',
)

# Map our canonical lowercase codes to the `translate()` source/target codes.
_BCP47_TO_ALE = {
    'it':    'it',     'it-it': 'it',
    'en':    'en-US',  'en-us': 'en-US',  'en-gb': 'en-GB',
    'fr':    'fr',     'fr-fr': 'fr',
    'de':    'de',     'de-de': 'de',
    'es':    'es',     'es-es': 'es',
}

# Strict, in-family fallback chains. Used by the runtime resolver.
# A bundle request for `en-us` will try en-us, then en-gb, then nothing.
# We NEVER fall back across languages (the whole point of the sprint).
_FALLBACK_CHAIN: Dict[str, List[str]] = {
    'it-it': ['it-it', 'it'],
    'it':    ['it', 'it-it'],
    'en-us': ['en-us', 'en-gb', 'en'],
    'en-gb': ['en-gb', 'en-us', 'en'],
    'en':    ['en', 'en-us', 'en-gb'],
    'fr-fr': ['fr-fr', 'fr'],
    'fr':    ['fr', 'fr-fr'],
    'de-de': ['de-de', 'de'],
    'de':    ['de', 'de-de'],
    'es-es': ['es-es', 'es'],
    'es':    ['es', 'es-es'],
}


# ─── Helpers ──────────────────────────────────────────────────────────
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hash_source(text: str) -> str:
    norm = ' '.join((text or '').split())
    return hashlib.sha1(norm.encode('utf-8')).hexdigest()


def _normalize_locale(loc: Optional[str]) -> str:
    """Canonical lowercase BCP-47 (it-it, en-us)."""
    if not loc:
        return 'it-it'
    s = loc.strip().lower().replace('_', '-')
    if '-' not in s:
        # Bare language tag → expand to canonical region default.
        defaults = {'it': 'it-it', 'en': 'en-us', 'fr': 'fr-fr',
                    'de': 'de-de', 'es': 'es-es'}
        s = defaults.get(s, s)
    return s


def _fallback_chain(locale: str) -> List[str]:
    return _FALLBACK_CHAIN.get(_normalize_locale(locale), [_normalize_locale(locale)])


def _to_ale_locale(loc: str) -> Optional[str]:
    return _BCP47_TO_ALE.get(loc.lower())


# ─── Process-local cache (per page_key + locale + scope + tenant) ─────
_CACHE_LOCK = threading.RLock()
_CACHE: Dict[str, Tuple[float, Dict[str, str]]] = {}
_CACHE_TTL_S = 60.0  # short TTL so manual edits surface within a minute


def _cache_key(page_key: str, locale: str, scope: str,
               tenant_id: Optional[str]) -> str:
    return f"{scope}|{tenant_id or '-'}|{page_key}|{_normalize_locale(locale)}"


def invalidate_cache(page_key: Optional[str] = None) -> None:
    """Drop the page bundle cache (call after upsert/regenerate)."""
    with _CACHE_LOCK:
        if page_key is None:
            _CACHE.clear()
            return
        stale = [k for k in _CACHE if f"|{page_key}|" in k]
        for k in stale:
            _CACHE.pop(k, None)


# ─── DB primitives ────────────────────────────────────────────────────
def _ensure_db():
    if not db_available():
        raise RuntimeError("Supabase admin client not available")
    return db()


def _find_block(scope: str, namespace: str, block_key: str,
                tenant_id: Optional[str]) -> Optional[dict]:
    c = _ensure_db()
    q = (c.table('editorial_blocks')
         .select('id, scope, tenant_id, namespace, block_key, page_key, '
                 'block_type, source_locale, source_value, source_hash, '
                 'is_active, updated_at')
         .eq('scope', scope)
         .eq('namespace', namespace)
         .eq('block_key', block_key))
    if scope == 'tenant':
        q = q.eq('tenant_id', tenant_id)
    rows = q.limit(1).execute().data or []
    return rows[0] if rows else None


def _list_translations(block_id: str) -> Dict[str, dict]:
    c = _ensure_db()
    rows = (c.table('editorial_block_translations')
            .select('locale, value, status, source_hash, generated_by, '
                    'model, locked, updated_at')
            .eq('block_id', block_id).execute().data or [])
    return {r['locale'].lower(): r for r in rows}


# ─── Public API ───────────────────────────────────────────────────────
def upsert_block(
    *,
    scope: str,
    namespace: str,
    block_key: str,
    source_value: str,
    page_key: Optional[str] = None,
    block_type: str = 'text',
    source_locale: str = 'it',
    tenant_id: Optional[str] = None,
    notes: Optional[str] = None,
    auto_localize: bool = True,
    force_regenerate: bool = False,
) -> dict:
    """Create or update an editorial block + (optionally) regenerate variants.

    Returns the block row (without sensitive id-only fields removed).
    The DB `_id` is intentionally not used; PostgreSQL primary key is UUID.
    """
    if scope not in ('system', 'tenant'):
        raise ValueError(f"invalid scope: {scope}")
    if scope == 'tenant' and not tenant_id:
        raise ValueError("tenant scope requires tenant_id")
    if scope == 'system' and tenant_id:
        raise ValueError("system scope must not carry tenant_id")
    if not source_value or not source_value.strip():
        raise ValueError("source_value cannot be empty")

    c = _ensure_db()
    new_hash = _hash_source(source_value)
    existing = _find_block(scope, namespace, block_key, tenant_id)

    if existing:
        # Drift detection: if hash changed, bump it and mark all auto
        # translations as stale so regeneration knows what to refresh.
        drift = existing['source_hash'] != new_hash
        c.table('editorial_blocks').update({
            'source_value': source_value,
            'source_hash':  new_hash,
            'source_locale': source_locale.lower(),
            'block_type':   block_type,
            'page_key':     page_key or existing.get('page_key'),
            'notes':        notes if notes is not None else existing.get('notes'),
            'is_active':    True,
            'updated_at':   _now(),
        }).eq('id', existing['id']).execute()
        if drift:
            c.table('editorial_block_translations').update({
                'status': 'stale', 'updated_at': _now(),
            }).eq('block_id', existing['id']).neq('status', 'manual').execute()
        block_id = existing['id']
    else:
        ins = c.table('editorial_blocks').insert({
            'scope':         scope,
            'tenant_id':     tenant_id,
            'namespace':     namespace,
            'block_key':     block_key,
            'page_key':      page_key,
            'block_type':    block_type,
            'source_locale': source_locale.lower(),
            'source_value':  source_value,
            'source_hash':   new_hash,
            'is_active':     True,
            'notes':         notes,
        }).execute()
        block_id = (ins.data or [{}])[0].get('id')

    # Always persist the source-locale row as a translation so the resolver
    # never has to "guess" — it just reads the table.
    src_norm = _normalize_locale(source_locale)
    c.table('editorial_block_translations').upsert({
        'block_id':     block_id,
        'locale':       src_norm,
        'value':        source_value,
        'status':       'source',
        'source_hash':  new_hash,
        'generated_by': 'seed',
        'model':        None,
        'updated_at':   _now(),
    }, on_conflict='block_id,locale').execute()

    if auto_localize:
        _generate_variants(block_id, source_locale=src_norm,
                           source_value=source_value, source_hash=new_hash,
                           force=force_regenerate)

    invalidate_cache(page_key)
    return {'id': block_id, 'scope': scope, 'namespace': namespace,
            'block_key': block_key, 'page_key': page_key,
            'source_locale': src_norm, 'source_hash': new_hash}


def _generate_variants(block_id: str, *, source_locale: str,
                       source_value: str, source_hash: str,
                       force: bool = False) -> None:
    """Walk ACTIVE_LOCALES and persist a translation for each one (skipping
    the source locale and any locale flagged `manual`).

    Skipped on failure — the row simply won't exist and the resolver will
    return None for it, which the frontend renders as empty (no leak).
    """
    c = _ensure_db()
    existing = _list_translations(block_id)
    src_ale = _to_ale_locale(source_locale) or 'it'

    for tgt in ACTIVE_LOCALES:
        if _normalize_locale(tgt) == _normalize_locale(source_locale):
            continue  # source row already inserted above
        cur = existing.get(tgt)
        # Skip manual overrides — they are pinned.
        if cur and cur.get('status') == 'manual' and not force:
            continue
        # If a fresh auto entry exists and source hasn't drifted, skip.
        if (not force) and cur and cur.get('status') == 'auto' \
                and cur.get('source_hash') == source_hash and (cur.get('value') or '').strip():
            continue
        tgt_ale = _to_ale_locale(tgt)
        if not tgt_ale:
            continue
        try:
            r = translate(source_value, source_locale=src_ale,
                          target_locale=tgt_ale)
            value = (r.localized or '').strip()
            if not value:
                continue
            # NOTE: We intentionally persist even when value == source_value.
            # Many editorial words travel unchanged across languages
            # ("Showroom", "Hospitality", "Atelier", brand names, etc.).
            # Skipping these would leave a hole in the target bundle and
            # render an empty chip — worse than the loanword passing through.
            c.table('editorial_block_translations').upsert({
                'block_id':     block_id,
                'locale':       _normalize_locale(tgt),
                'value':        value,
                'status':       'auto',
                'source_hash':  source_hash,
                'generated_by': 'ale',
                'model':        r.model,
                'updated_at':   _now(),
            }, on_conflict='block_id,locale').execute()
        except Exception as e:
            log.warning("editorial runtime · variant generation failed "
                        "block=%s tgt=%s: %s", block_id, tgt, e)


def regenerate_block(block_id: str, force: bool = True) -> dict:
    """Force-regenerate translations for an existing block."""
    c = _ensure_db()
    rows = (c.table('editorial_blocks')
            .select('id, source_locale, source_value, source_hash, page_key')
            .eq('id', block_id).limit(1).execute().data or [])
    if not rows:
        raise ValueError(f"block not found: {block_id}")
    b = rows[0]
    _generate_variants(b['id'],
                       source_locale=_normalize_locale(b['source_locale']),
                       source_value=b['source_value'],
                       source_hash=b['source_hash'],
                       force=force)
    invalidate_cache(b.get('page_key'))
    return {'block_id': b['id'], 'regenerated': True}


def resolve_page_bundle(
    page_key: str,
    locale: str,
    *,
    scope: str = 'system',
    tenant_id: Optional[str] = None,
    use_cache: bool = True,
) -> Dict[str, str]:
    """Return {namespace.block_key: value} for a full page bundle.

    STRICT LOCALE CHAIN — the resolver walks the in-family fallback list
    only. If no variant exists in the chain, the key is OMITTED from the
    response (the frontend may render an empty state but never a
    foreign-language leak).
    """
    ck = _cache_key(page_key, locale, scope, tenant_id)
    now = time.time()
    if use_cache:
        with _CACHE_LOCK:
            cached = _CACHE.get(ck)
            if cached and (now - cached[0]) < _CACHE_TTL_S:
                return dict(cached[1])

    if not db_available():
        return {}
    c = db()
    q = (c.table('editorial_blocks')
         .select('id, namespace, block_key, source_value, source_locale')
         .eq('page_key', page_key).eq('is_active', True).eq('scope', scope))
    if scope == 'tenant':
        q = q.eq('tenant_id', tenant_id)
    blocks = q.execute().data or []
    if not blocks:
        with _CACHE_LOCK:
            _CACHE[ck] = (now, {})
        return {}

    block_ids = [b['id'] for b in blocks]
    trans_rows = (c.table('editorial_block_translations')
                  .select('block_id, locale, value, status')
                  .in_('block_id', block_ids).execute().data or [])
    by_block: Dict[str, Dict[str, str]] = {}
    for r in trans_rows:
        by_block.setdefault(r['block_id'], {})[r['locale'].lower()] = r.get('value') or ''

    chain = _fallback_chain(locale)
    out: Dict[str, str] = {}
    for b in blocks:
        variants = by_block.get(b['id'], {})
        chosen: Optional[str] = None
        # Walk chain — STRICT in-family only.
        for loc in chain:
            v = variants.get(loc)
            if v and v.strip():
                chosen = v
                break
        # Last-resort safety net: if request locale's family matches
        # source language, fall back to source value. Otherwise omit.
        if not chosen:
            src = _normalize_locale(b.get('source_locale') or 'it')
            if src in chain:
                chosen = b.get('source_value') or ''
        if chosen:
            full_key = f"{b['namespace']}.{b['block_key']}"
            out[full_key] = chosen

    with _CACHE_LOCK:
        _CACHE[ck] = (now, dict(out))
    return out


def list_blocks(
    *,
    scope: str = 'system',
    tenant_id: Optional[str] = None,
    page_key: Optional[str] = None,
    namespace: Optional[str] = None,
) -> List[dict]:
    """Admin / debug helper — list every block + its translations status."""
    c = _ensure_db()
    q = (c.table('editorial_blocks')
         .select('id, scope, tenant_id, namespace, block_key, page_key, '
                 'block_type, source_locale, source_value, source_hash, '
                 'is_active, notes, updated_at')
         .eq('scope', scope).eq('is_active', True))
    if scope == 'tenant':
        q = q.eq('tenant_id', tenant_id)
    if page_key:
        q = q.eq('page_key', page_key)
    if namespace:
        q = q.eq('namespace', namespace)
    blocks = q.execute().data or []
    if not blocks:
        return []
    ids = [b['id'] for b in blocks]
    trans = (c.table('editorial_block_translations')
             .select('block_id, locale, value, status, generated_by, updated_at')
             .in_('block_id', ids).execute().data or [])
    by_block: Dict[str, List[dict]] = {}
    for r in trans:
        by_block.setdefault(r['block_id'], []).append(r)
    out = []
    for b in blocks:
        out.append({**b, 'translations': by_block.get(b['id'], [])})
    return out
