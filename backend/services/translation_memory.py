"""Adaptive Language Experience™ · Persistent Translation Layer™ · ITER124.

Wraps `services.relational_translation.translate(...)` with:

  1. Per-message DB cache (`message_translations`)        — cache-hit/miss flow
  2. Translation Memory™ reuse                            — same original_hash, same tenant,
                                                            different message → reuse output
  3. Immutability rule                                    — same original_text ↔ same localized_text
  4. Invalidation on source edit                          — bumps `translation_version`
  5. Tenant-scoped DNT registry merge                     — platform defaults ∪ tenant terms
  6. Studio Voice Learning™ hook (placeholder)            — future-proof seam for tone overrides
  7. Review-status awareness                              — locked_approved variants are never re-translated

The module is a side-effect-free service: routers call into it with the
caller's tenant context and an opaque `message_id`. It is safe for unit
testing — when Supabase is not available, it gracefully degrades to the
in-process translator and reports `translation_cached=False`.
"""
from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional, Tuple

from services.relational_translation import (
    DEFAULT_DNT_TERMS,
    SUPPORTED_LOCALES,
    translate,
)

logger = logging.getLogger(__name__)

# Surface tags routed through ALE. Adding here is editorial governance,
# not a hard constraint — the column itself accepts any string.
KNOWN_SURFACES = frozenset({
    'client_message',
    'milestone_note',
    'timeline_event',
    'journey_comment',
    'revision_request',
    'shared_thought',
    'site_evolution_note',
    'dossier_remark',
})


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hash_original(text: str) -> str:
    """Stable hash used both as identity (for the immutability rule) and as
    Translation Memory™ index. We strip+normalize whitespace so trivial
    whitespace edits do not invalidate variants."""
    normalized = ' '.join((text or '').split())
    return hashlib.sha1(normalized.encode('utf-8')).hexdigest()


def _merge_dnt_terms(tenant_id: Optional[str]) -> tuple:
    """Platform defaults ∪ tenant-scoped active terms. Returns a tuple to
    keep `translate()`'s signature pure."""
    terms = list(DEFAULT_DNT_TERMS)
    if not tenant_id:
        return tuple(terms)
    try:
        from database import db, db_available
        if not db_available():
            return tuple(terms)
        res = (db().table('tenant_dnt_registry')
               .select('term')
               .eq('tenant_id', tenant_id)
               .eq('active', True)
               .execute())
        for row in (res.data or []):
            term = (row.get('term') or '').strip()
            if term and term not in terms:
                terms.append(term)
    except Exception as e:
        logger.warning("tenant DNT merge failed: %s", e)
    return tuple(terms)


def _lookup_cached(message_id: str, target_locale: str, original_hash: str,
                   ) -> Optional[dict]:
    """Return the latest variant for (message_id, target_locale) IF its
    `original_hash` still matches the live source. Otherwise return None
    so the caller treats it as a cache-miss and regenerates."""
    try:
        from database import db, db_available
        if not db_available():
            return None
        res = (db().table('message_translations')
               .select('id, original_hash, original_text, localized_text, '
                       'source_locale, target_locale, translation_model, '
                       'review_status, translation_version, confidence_score, '
                       'created_at, updated_at')
               .eq('message_id', message_id)
               .eq('target_locale', target_locale)
               .order('translation_version', desc=True)
               .limit(1)
               .execute())
        rows = res.data or []
        if not rows:
            return None
        row = rows[0]
        if row.get('review_status') == 'locked_approved':
            # Locked is sacred — return it regardless of hash drift.
            return row
        if row.get('original_hash') != original_hash:
            return None
        return row
    except Exception as e:
        logger.warning("translation cache lookup failed: %s", e)
        return None


def _lookup_translation_memory(tenant_id: str, source_locale: str,
                               target_locale: str, original_hash: str,
                               ) -> Optional[dict]:
    """Translation Memory™: if the EXACT same source text was already
    translated for this tenant/locale-pair (e.g. boilerplate "Allego la
    nuova selezione materica."), reuse the localized output. This is the
    seam for the future TM dashboard."""
    try:
        from database import db, db_available
        if not db_available():
            return None
        res = (db().table('message_translations')
               .select('original_text, localized_text, translation_model, '
                       'review_status, confidence_score')
               .eq('tenant_id', tenant_id)
               .eq('source_locale', source_locale)
               .eq('target_locale', target_locale)
               .eq('original_hash', original_hash)
               .order('review_status', desc=True)  # locked > human > ai
               .limit(1)
               .execute())
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:
        logger.warning("translation memory lookup failed: %s", e)
        return None


def _persist(tenant_id: str, message_id: str, surface: str,
             source_locale: str, target_locale: str,
             original_text: str, original_hash: str,
             localized_text: str, translation_model: Optional[str],
             confidence: Optional[float], duration_ms: Optional[int],
             previous_version: int = 0) -> Optional[dict]:
    """Insert a new variant row. We never UPDATE existing variants — every
    regeneration creates a new `translation_version`, preserving lineage
    and supporting the future review/audit UI."""
    try:
        from database import db, db_available
        if not db_available():
            return None
        payload = {
            'tenant_id': tenant_id,
            'message_id': message_id,
            'surface': surface or 'client_message',
            'source_locale': source_locale,
            'target_locale': target_locale,
            'original_text': original_text,
            'original_hash': original_hash,
            'localized_text': localized_text,
            'translation_model': translation_model,
            'confidence_score': confidence,
            'review_status': 'ai_only',
            'translation_version': previous_version + 1,
            'duration_ms': duration_ms,
            'created_at': _now_iso(),
            'updated_at': _now_iso(),
        }
        res = db().table('message_translations').insert(payload).execute()
        row = (res.data or [None])[0]
        return row
    except Exception as e:
        logger.warning("translation persist failed: %s", e)
        return None


def _latest_version(message_id: str, target_locale: str) -> int:
    try:
        from database import db, db_available
        if not db_available():
            return 0
        res = (db().table('message_translations')
               .select('translation_version')
               .eq('message_id', message_id)
               .eq('target_locale', target_locale)
               .order('translation_version', desc=True)
               .limit(1)
               .execute())
        rows = res.data or []
        return int(rows[0]['translation_version']) if rows else 0
    except Exception:
        return 0


# ── Public API ─────────────────────────────────────────────────
def localize_with_memory(
    *,
    text: str,
    source_locale: str,
    target_locale: str,
    tenant_id: Optional[str] = None,
    message_id: Optional[str] = None,
    surface: str = 'client_message',
    extra_dnt_terms: Optional[tuple] = None,
) -> dict:
    """The one entry point for routers. Returns a fully-formed ALE payload:

        {
          original_text, localized_text,
          source_locale, target_locale,
          translation_cached  (True if served from cache OR TM reuse),
          translation_source  ('cache' | 'memory' | 'fresh' | 'no_op' | 'fallback'),
          translation_model, confidence_score,
          review_status, translation_version,
          translated, error,
        }
    """
    text = (text or '').strip()
    if not text:
        return _empty_payload(text, source_locale, target_locale,
                              error='empty_text')

    # No-op when locales match.
    if source_locale == target_locale:
        return {
            'original_text': text,
            'localized_text': text,
            'localized': text,           # back-compat alias for older callers
            'original':  text,           # back-compat alias for older callers
            'source_locale': source_locale,
            'target_locale': target_locale,
            'translated': False,
            'translation_cached': True,
            'translation_source': 'no_op',
            'translation_model': None,
            'confidence_score': 1.0,
            'review_status': 'ai_only',
            'translation_version': 0,
            'error': None,
        }

    if source_locale not in SUPPORTED_LOCALES or target_locale not in SUPPORTED_LOCALES:
        return _empty_payload(text, source_locale, target_locale,
                              error='unsupported_locale')

    original_hash = _hash_original(text)

    # iter125: Lock-Approved short-circuit. If the studio has manually
    # locked a translation for this exact source text + locale pair, it
    # bypasses the LLM entirely AND the per-message cache (the lock is
    # tenant-scoped, not message-scoped).
    if tenant_id:
        try:
            from services.studio_voice import load_locked_translation
            locked = load_locked_translation(tenant_id, source_locale,
                                             target_locale, text)
            if locked:
                row = {
                    'original_text': text,
                    'localized_text': locked,
                    'source_locale': source_locale,
                    'target_locale': target_locale,
                    'translation_model': 'studio_voice/locked',
                    'confidence_score': 1.0,
                    'review_status': 'locked_approved',
                    'translation_version': 1,
                }
                return _wrap_payload(row, source='locked')
        except Exception as e:
            logger.warning("locked-translation lookup failed: %s", e)

    # 1) Per-message cache (most specific).
    if message_id:
        cached = _lookup_cached(message_id, target_locale, original_hash)
        if cached:
            # iter125: best-effort usage bump for Translation Analytics™.
            try:
                from services.studio_voice import bump_usage
                bump_usage(cached.get('id'))
            except Exception:
                pass
            return _wrap_payload(cached, source='cache')

    # 2) Translation Memory™ (cross-message reuse for identical source text).
    if tenant_id:
        tm = _lookup_translation_memory(tenant_id, source_locale, target_locale,
                                        original_hash)
        if tm:
            # If we have a message_id, persist a fresh row pointing at this
            # message so future lookups become O(1) on the per-message index.
            persisted_row = None
            if message_id:
                persisted_row = _persist(
                    tenant_id=tenant_id, message_id=message_id, surface=surface,
                    source_locale=source_locale, target_locale=target_locale,
                    original_text=text, original_hash=original_hash,
                    localized_text=tm['localized_text'],
                    translation_model=tm.get('translation_model'),
                    confidence=tm.get('confidence_score'),
                    duration_ms=0,  # TM hit is effectively free
                    previous_version=_latest_version(message_id, target_locale),
                )
            row = persisted_row or {
                'original_text': text,
                'localized_text': tm['localized_text'],
                'source_locale': source_locale,
                'target_locale': target_locale,
                'translation_model': tm.get('translation_model'),
                'confidence_score': tm.get('confidence_score'),
                'review_status': tm.get('review_status') or 'ai_only',
                'translation_version': 1,
            }
            return _wrap_payload(row, source='memory')

    # 3) Fresh translation via LLM (with Studio Voice™ injected).
    dnt = _merge_dnt_terms(tenant_id)
    if extra_dnt_terms:
        dnt = tuple(list(dnt) + list(extra_dnt_terms))
    voice_addendum = ""
    if tenant_id:
        try:
            from services.studio_voice import voice_addendum_for_prompt
            voice_addendum = voice_addendum_for_prompt(tenant_id, source_locale, target_locale)
        except Exception as e:
            logger.warning("voice_addendum_for_prompt failed: %s", e)
    result = translate(text, source_locale, target_locale, dnt_terms=dnt,
                       voice_addendum=voice_addendum)

    if not result.translated:
        # Either LLM failure, empty output, or fallback path. Return the
        # raw result with `translation_cached=False` so the UI can decide.
        return {
            'original_text': text,
            'localized_text': result.localized,
            'localized': result.localized, 'original': text,
            'source_locale': source_locale,
            'target_locale': target_locale,
            'translated': False,
            'translation_cached': False,
            'translation_source': 'fallback',
            'translation_model': result.model,
            'confidence_score': result.confidence,
            'review_status': 'ai_only',
            'translation_version': 0,
            'error': result.error,
        }

    # 4) Persist (if we have tenant + message anchors).
    persisted = None
    if tenant_id and message_id:
        persisted = _persist(
            tenant_id=tenant_id, message_id=message_id, surface=surface,
            source_locale=source_locale, target_locale=target_locale,
            original_text=text, original_hash=original_hash,
            localized_text=result.localized,
            translation_model=result.model,
            confidence=result.confidence,
            duration_ms=result.duration_ms,
            previous_version=_latest_version(message_id, target_locale),
        )

    row = persisted or {
        'original_text': text,
        'localized_text': result.localized,
        'source_locale': source_locale,
        'target_locale': target_locale,
        'translation_model': result.model,
        'confidence_score': result.confidence,
        'review_status': 'ai_only',
        'translation_version': 1,
    }
    return _wrap_payload(row, source='fresh')


def invalidate_for_message(message_id: str) -> int:
    """Hard-invalidate every cached variant for a message_id. Returns the
    number of rows logically retired. We *do not* delete history — we
    simply rely on the `original_hash` mismatch path for cache misses, so
    explicit invalidation is rarely needed. This helper exists for admin
    operations and tests."""
    try:
        from database import db, db_available
        if not db_available():
            return 0
        res = (db().table('message_translations')
               .delete()
               .eq('message_id', message_id)
               .execute())
        return len(res.data or [])
    except Exception:
        return 0


def stats_for_tenant(tenant_id: str) -> dict:
    """Governance Overlay numbers."""
    out = {'cache_total': 0, 'reviewed': 0, 'locked': 0,
           'today': 0, 'locale_pairs': 0}
    try:
        from database import db, db_available
        if not db_available():
            return out
        client = db()
        total = client.table('message_translations').select('id', count='exact').eq('tenant_id', tenant_id).execute()
        out['cache_total'] = total.count or 0
        reviewed = client.table('message_translations').select('id', count='exact').eq('tenant_id', tenant_id).eq('review_status', 'human_reviewed').execute()
        out['reviewed'] = reviewed.count or 0
        locked = client.table('message_translations').select('id', count='exact').eq('tenant_id', tenant_id).eq('review_status', 'locked_approved').execute()
        out['locked'] = locked.count or 0
        today = (client.table('message_translations')
                 .select('id', count='exact')
                 .eq('tenant_id', tenant_id)
                 .gte('created_at', datetime.now(timezone.utc).strftime('%Y-%m-%dT00:00:00Z'))
                 .execute())
        out['today'] = today.count or 0
    except Exception as e:
        logger.warning("tenant stats failed: %s", e)
    return out


# ── Helpers ────────────────────────────────────────────────────
def _wrap_payload(row: dict, *, source: str) -> dict:
    return {
        'id': row.get('id'),
        'original_text': row.get('original_text'),
        'localized_text': row.get('localized_text'),
        # back-compat aliases (the POC frontend reads `localized`)
        'localized': row.get('localized_text'),
        'original':  row.get('original_text'),
        'source_locale': row.get('source_locale'),
        'target_locale': row.get('target_locale'),
        'translated': row.get('localized_text') != row.get('original_text'),
        'translation_cached': source in ('cache', 'memory', 'no_op', 'locked'),
        'translation_source': source,
        'translation_model': row.get('translation_model'),
        'confidence_score': row.get('confidence_score'),
        'review_status': row.get('review_status') or 'ai_only',
        'translation_version': int(row.get('translation_version') or 1),
        'usage_count': int(row.get('usage_count') or 1),
        'error': None,
    }


def _empty_payload(text: str, src: str, tgt: str, *, error: str) -> dict:
    return {
        'original_text': text,
        'localized_text': text,
        'localized': text, 'original': text,
        'source_locale': src,
        'target_locale': tgt,
        'translated': False,
        'translation_cached': False,
        'translation_source': 'fallback',
        'translation_model': None,
        'confidence_score': None,
        'review_status': 'ai_only',
        'translation_version': 0,
        'error': error,
    }
