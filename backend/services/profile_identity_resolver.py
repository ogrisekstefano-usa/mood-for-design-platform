"""ITER147 · International Profile Identity™ — Resolver.

THIN orchestration layer on top of `editorial_content_orchestrator`.
Maps the four user-profile editorial fields (role_label, short_bio,
response_time_label, contact_cta_label) to `editorial_blocks` rows
under the `profile.identity` namespace, then exposes:

  • get_identity(profile_id)        — source + per-locale matrix
  • upsert_source(profile_id, …)    — write source value + regenerate
  • set_manual(profile_id, …)       — pin a locale to a manual value
  • regenerate_locale(profile_id…)  — force ALE re-author for one locale
  • lock_locale(profile_id…)        — freeze the current value
  • restore_ale(profile_id…)        — drop manual override, re-run ALE

ZERO new tables. ZERO duplicated business logic. ALE directive
injection is the ONLY new behaviour added to the orchestrator.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

from database import db
from services.editorial_content_orchestrator import (
    ACTIVE_LOCALES,
    invalidate_cache,
    upsert_block,
    _find_block,
    _list_translations,
    _normalize_locale,
    _to_ale_locale,
    _hash_source,
    _now,
)
from services.relational_translation import translate
from services.profile_identity_directives import build_profile_identity_addendum

log = logging.getLogger(__name__)

NAMESPACE = "profile.identity"
SUPPORTED_FIELDS = (
    "role_label",
    "short_bio",
    "response_time_label",
    "contact_cta_label",
)

# Status taxonomy surfaced to the UI.
# `source`    — the canonical authoring locale row (always present).
# `auto`      — ALE-generated, can be refreshed when source drifts.
# `manual`    — operator override, pinned across regenerations.
# `locked`    — manual + frozen (regenerate is blocked at UI level).
# `stale`     — source changed; the cached value is no longer current.
# `missing`   — no row yet for that locale.


def _block_key(profile_id: str, field: str) -> str:
    return f"{profile_id}.{field}"


def _get_tenant_default_locale(tenant_id: str) -> str:
    cfg = (db().table("tenant_configuration")
           .select("default_locale, enabled_locales")
           .eq("tenant_id", tenant_id).limit(1).execute().data or [])
    if cfg and cfg[0].get("default_locale"):
        return _normalize_locale(cfg[0]["default_locale"])
    return "it-it"


def _tenant_enabled_locales(tenant_id: str) -> List[str]:
    cfg = (db().table("tenant_configuration")
           .select("enabled_locales")
           .eq("tenant_id", tenant_id).limit(1).execute().data or [])
    raw = (cfg[0].get("enabled_locales") if cfg else None) or list(ACTIVE_LOCALES)
    return [_normalize_locale(x) for x in raw]


# ── Public API ────────────────────────────────────────────────────────
def get_identity(*, profile_id: str, tenant_id: str) -> dict:
    """Return source values + per-locale matrix for the four fields."""
    out: Dict[str, dict] = {}
    enabled = _tenant_enabled_locales(tenant_id)
    default_locale = _get_tenant_default_locale(tenant_id)

    for field in SUPPORTED_FIELDS:
        block = _find_block("tenant", NAMESPACE, _block_key(profile_id, field), tenant_id)
        if not block:
            out[field] = {
                "source_value":  None,
                "source_locale": default_locale,
                "locales":       [{"locale": loc, "value": None, "status": "missing"}
                                  for loc in enabled],
            }
            continue
        rows = _list_translations(block["id"])
        src_locale = _normalize_locale(block.get("source_locale") or default_locale)
        source_row = rows.get(src_locale) or {}
        per_locale = []
        for loc in enabled:
            tr = rows.get(loc)
            if not tr:
                per_locale.append({"locale": loc, "value": None,
                                    "status": "source" if loc == src_locale else "missing"})
                continue
            status = tr.get("status") or "auto"
            # locked is a manual override flagged as approved.
            if tr.get("locked"):
                status = "locked"
            elif status == "manual" and tr.get("source_hash") and \
                    tr["source_hash"] != block.get("source_hash"):
                status = "manual_stale"
            elif status == "auto" and tr.get("source_hash") and \
                    tr["source_hash"] != block.get("source_hash"):
                status = "stale"
            per_locale.append({
                "locale":       loc,
                "value":        tr.get("value"),
                "status":       status,
                "generated_by": tr.get("generated_by"),
                "updated_at":   tr.get("updated_at"),
            })
        out[field] = {
            "block_id":      block["id"],
            "source_value":  source_row.get("value") or block.get("source_value"),
            "source_locale": src_locale,
            "source_hash":   block.get("source_hash"),
            "locales":       per_locale,
        }
    return {
        "profile_id":       profile_id,
        "tenant_id":        tenant_id,
        "default_locale":   default_locale,
        "enabled_locales":  enabled,
        "fields":           out,
    }


def upsert_source(*, profile_id: str, tenant_id: str, field: str,
                  source_value: str, source_locale: Optional[str] = None) -> dict:
    """Write the canonical source value for a field and trigger ALE
    regeneration of every other enabled locale.

    Uses `upsert_block` so all the orchestrator's guarantees apply:
    drift detection, manual-row preservation, source row insert.
    """
    if field not in SUPPORTED_FIELDS:
        raise ValueError(f"unsupported field: {field}")
    locale = _normalize_locale(source_locale or _get_tenant_default_locale(tenant_id))
    # We need profile.identity-specific cultural adaptation. The orchestrator
    # uses translate() without addendum by default; we override here by
    # running upsert with auto_localize=False and triggering our own
    # culturally-aware generation.
    block = upsert_block(
        scope="tenant",
        namespace=NAMESPACE,
        block_key=_block_key(profile_id, field),
        source_value=source_value,
        source_locale=locale,
        tenant_id=tenant_id,
        page_key=None,
        block_type="text",
        auto_localize=False,           # we drive the loop with cultural addendum
        notes=f"International Profile Identity™ · {field}",
    )
    _generate_profile_variants(
        block_id=block["id"],
        source_locale=locale,
        source_value=source_value,
        source_hash=_hash_source(source_value),
        tenant_id=tenant_id,
        force=False,
    )
    invalidate_cache(None)
    return block


def set_manual(*, profile_id: str, tenant_id: str, field: str,
               target_locale: str, value: str) -> dict:
    """Pin a locale to a manual value. Subsequent regenerations skip it
    unless force=True is passed via regenerate_locale().
    """
    block = _require_block(profile_id, tenant_id, field)
    loc = _normalize_locale(target_locale)
    db().table("editorial_block_translations").upsert({
        "block_id":     block["id"],
        "locale":       loc,
        "value":        value,
        "status":       "manual",
        "source_hash":  block.get("source_hash"),
        "generated_by": "operator",
        "model":        None,
        "locked":       False,
        "updated_at":   _now(),
    }, on_conflict="block_id,locale").execute()
    invalidate_cache(None)
    return {"block_id": block["id"], "locale": loc, "status": "manual"}


def regenerate_locale(*, profile_id: str, tenant_id: str, field: str,
                      target_locale: str) -> dict:
    """Force ALE re-author of a single locale. Replaces any manual
    override unless the row is locked (UI prevents calling this on
    locked rows, but we double-check)."""
    block = _require_block(profile_id, tenant_id, field)
    loc = _normalize_locale(target_locale)
    existing = (db().table("editorial_block_translations")
                .select("locked").eq("block_id", block["id"])
                .eq("locale", loc).limit(1).execute().data or [])
    if existing and existing[0].get("locked"):
        raise PermissionError("locale is locked")
    _generate_profile_variants(
        block_id=block["id"],
        source_locale=_normalize_locale(block["source_locale"]),
        source_value=block["source_value"],
        source_hash=block["source_hash"],
        tenant_id=tenant_id,
        force=True,
        only_locale=loc,
    )
    invalidate_cache(None)
    return {"block_id": block["id"], "locale": loc, "status": "auto"}


def lock_locale(*, profile_id: str, tenant_id: str, field: str,
                target_locale: str, locked: bool = True) -> dict:
    """Freeze (or unfreeze) a locale's current value."""
    block = _require_block(profile_id, tenant_id, field)
    loc = _normalize_locale(target_locale)
    db().table("editorial_block_translations").update({
        "locked":     bool(locked),
        "updated_at": _now(),
    }).eq("block_id", block["id"]).eq("locale", loc).execute()
    invalidate_cache(None)
    return {"block_id": block["id"], "locale": loc, "locked": locked}


def restore_ale(*, profile_id: str, tenant_id: str, field: str,
                target_locale: str) -> dict:
    """Drop any manual override on a locale and re-run ALE for it."""
    block = _require_block(profile_id, tenant_id, field)
    loc = _normalize_locale(target_locale)
    # Reset the row so the orchestrator does not skip it as `manual`.
    db().table("editorial_block_translations").update({
        "status":       "stale",
        "locked":       False,
        "updated_at":   _now(),
    }).eq("block_id", block["id"]).eq("locale", loc).execute()
    return regenerate_locale(profile_id=profile_id, tenant_id=tenant_id,
                              field=field, target_locale=target_locale)


def resolve_for_locale(*, profile_id: str, tenant_id: str, locale: str) -> Dict[str, Optional[str]]:
    """Public-runtime: return the four fields resolved to a single
    locale, with strict in-family fallback (en-US → en-GB → source).
    Used by the client-facing surfaces.
    """
    bundle = get_identity(profile_id=profile_id, tenant_id=tenant_id)
    out: Dict[str, Optional[str]] = {}
    requested = _normalize_locale(locale or bundle["default_locale"])
    source_locale = bundle["default_locale"]
    for field in SUPPORTED_FIELDS:
        block = bundle["fields"].get(field) or {}
        loc_rows = {r["locale"]: r for r in block.get("locales", [])}
        # Try exact, then in-family fallback (primary tag), then source.
        chain = [requested]
        primary = requested.split("-")[0]
        for r in loc_rows:
            if r != requested and r.startswith(primary):
                chain.append(r)
        chain.append(_normalize_locale(block.get("source_locale") or source_locale))
        for candidate in chain:
            row = loc_rows.get(candidate)
            if row and row.get("value") and row.get("status") != "missing":
                out[field] = row["value"]
                break
        else:
            out[field] = block.get("source_value")
    return out


# ── Internals ─────────────────────────────────────────────────────────
def _require_block(profile_id: str, tenant_id: str, field: str) -> dict:
    if field not in SUPPORTED_FIELDS:
        raise ValueError(f"unsupported field: {field}")
    block = _find_block("tenant", NAMESPACE, _block_key(profile_id, field), tenant_id)
    if not block:
        raise LookupError(f"no source for {field}; PATCH /source first")
    return block


def _generate_profile_variants(*, block_id: str, source_locale: str,
                                source_value: str, source_hash: str,
                                tenant_id: str, force: bool,
                                only_locale: Optional[str] = None) -> None:
    """Mirror of `editorial_content_orchestrator._generate_variants` but
    injects the `profile.identity` cultural addendum at translate() call
    time. Otherwise contract-identical.
    """
    enabled = _tenant_enabled_locales(tenant_id)
    if only_locale:
        enabled = [_normalize_locale(only_locale)]
    existing = _list_translations(block_id)
    src_ale = _to_ale_locale(source_locale) or "it"
    for tgt in enabled:
        if _normalize_locale(tgt) == _normalize_locale(source_locale):
            continue
        cur = existing.get(tgt)
        if cur and cur.get("locked") and not (force and only_locale == tgt):
            continue
        if cur and cur.get("status") == "manual" and not force:
            continue
        if (not force) and cur and cur.get("status") == "auto" \
                and cur.get("source_hash") == source_hash \
                and (cur.get("value") or "").strip():
            continue
        tgt_ale = _to_ale_locale(tgt)
        if not tgt_ale:
            continue
        addendum = build_profile_identity_addendum(tgt_ale)
        try:
            r = translate(source_value, source_locale=src_ale,
                           target_locale=tgt_ale, voice_addendum=addendum)
            value = (r.localized or "").strip()
            if not value:
                continue
            db().table("editorial_block_translations").upsert({
                "block_id":     block_id,
                "locale":       _normalize_locale(tgt),
                "value":        value,
                "status":       "auto",
                "source_hash":  source_hash,
                "generated_by": "ale",
                "model":        r.model,
                "locked":       False,
                "updated_at":   _now(),
            }, on_conflict="block_id,locale").execute()
        except Exception as e:
            log.warning("profile.identity · variant generation failed "
                        "block=%s tgt=%s: %s", block_id, tgt, e)


__all__ = [
    "SUPPORTED_FIELDS",
    "NAMESPACE",
    "get_identity",
    "upsert_source",
    "set_manual",
    "regenerate_locale",
    "lock_locale",
    "restore_ale",
    "resolve_for_locale",
]
