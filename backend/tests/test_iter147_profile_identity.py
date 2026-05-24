"""ITER147 · International Profile Identity™ — pytest.

Verifies the four core contracts (Editorial Runtime™ convergence):

  1. `upsert_source` writes an editorial_blocks row under namespace
     `profile.identity` AND the source-locale translation row.
  2. `_generate_profile_variants` invokes ALE with the cultural
     directive and persists `status='auto'` rows for every enabled
     target locale.
  3. `set_manual` pins a locale (`status='manual'`); a subsequent
     non-force regenerate skips it.
  4. `lock_locale` freezes a row; `regenerate_locale` raises a
     PermissionError when called on a locked locale.
  5. `restore_ale` drops a manual override and re-runs ALE.
  6. `resolve_for_locale` returns the locale-coherent fields with the
     strict in-family fallback (en-US → en-GB → source).

DB-side tests use the live Supabase from /app/backend/.env. The studio
tenant is the canonical fixture.
"""
from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path
from unittest.mock import patch

import pytest
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from database import db                                          # noqa: E402
from services import profile_identity_resolver as pir            # noqa: E402
from services.editorial_content_orchestrator import _find_block  # noqa: E402
from services.profile_identity_directives import build_profile_identity_addendum  # noqa: E402

STUDIO_TENANT_ID = "848354b9-a43e-4147-bdad-116fb93bd585"


# Manufactured profile_id keeps tests isolated from real users.
@pytest.fixture
def profile_id():
    pid = f"pytest-iter147-{uuid.uuid4().hex[:8]}"
    yield pid
    # Cleanup: delete any editorial_blocks rows we created.
    blocks = (db().table("editorial_blocks").select("id")
              .eq("tenant_id", STUDIO_TENANT_ID)
              .eq("namespace", pir.NAMESPACE)
              .like("block_key", f"{pid}.%").execute().data or [])
    for b in blocks:
        db().table("editorial_block_translations").delete().eq("block_id", b["id"]).execute()
        db().table("editorial_blocks").delete().eq("id", b["id"]).execute()


def _fake_translate(text, source_locale, target_locale, **kwargs):
    """Deterministic stub — adds locale suffix so assertions are stable."""
    class R:
        def __init__(self, text):
            self.localized = text
            self.model = "test-stub"
    return R(f"{text} [{target_locale}]")


# ── 1. Source upsert + AUTO variants ──────────────────────────────────
def test_upsert_source_creates_block_and_source_row(profile_id):
    with patch("services.profile_identity_resolver.translate", side_effect=_fake_translate):
        pir.upsert_source(
            profile_id=profile_id, tenant_id=STUDIO_TENANT_ID,
            field="role_label", source_value="Fondatore", source_locale="it-IT",
        )
    block = _find_block("tenant", pir.NAMESPACE,
                        f"{profile_id}.role_label", STUDIO_TENANT_ID)
    assert block, "block row not created"
    assert block["source_value"] == "Fondatore"
    rows = (db().table("editorial_block_translations").select("*")
            .eq("block_id", block["id"]).execute().data or [])
    by_loc = {r["locale"]: r for r in rows}
    assert "it-it" in by_loc and by_loc["it-it"]["status"] == "source"
    # all other enabled locales got auto entries
    for loc in ["en-us", "fr-fr", "de-de", "es-es"]:
        assert loc in by_loc, f"missing variant for {loc}"
        assert by_loc[loc]["status"] == "auto"
        assert "[" in by_loc[loc]["value"], "stub localization should mark target locale"


# ── 2. Cultural directive is passed to ALE ────────────────────────────
def test_translate_call_carries_cultural_directive(profile_id):
    captured = []
    def capture(text, source_locale, target_locale, **kwargs):
        captured.append((target_locale, kwargs.get("voice_addendum") or ""))
        class R:
            localized = f"{text} [{target_locale}]"
            model = "test-stub"
        return R()
    with patch("services.profile_identity_resolver.translate", side_effect=capture):
        pir.upsert_source(
            profile_id=profile_id, tenant_id=STUDIO_TENANT_ID,
            field="role_label", source_value="Fondatore", source_locale="it-IT",
        )
    assert captured, "translate() was not called"
    # The addendum for en-US must include US-market calibration cues.
    en_call = next((c for c in captured if c[0] == "en-US"), None)
    assert en_call, "en-US variant was not generated"
    assert "International Studio Narrative" in en_call[1]
    assert "US market signals" in en_call[1]


# ── 3. Manual override persists across non-force regen ────────────────
def test_manual_override_persists(profile_id):
    with patch("services.profile_identity_resolver.translate", side_effect=_fake_translate):
        pir.upsert_source(
            profile_id=profile_id, tenant_id=STUDIO_TENANT_ID,
            field="role_label", source_value="Fondatore", source_locale="it-IT",
        )
    pir.set_manual(
        profile_id=profile_id, tenant_id=STUDIO_TENANT_ID,
        field="role_label", target_locale="en-US",
        value="Founding Partner & Creative Director",
    )
    # Re-upsert source WITHOUT forcing — manual row must survive.
    with patch("services.profile_identity_resolver.translate", side_effect=_fake_translate):
        pir.upsert_source(
            profile_id=profile_id, tenant_id=STUDIO_TENANT_ID,
            field="role_label", source_value="Fondatore", source_locale="it-IT",
        )
    bundle = pir.get_identity(profile_id=profile_id, tenant_id=STUDIO_TENANT_ID)
    en = next(l for l in bundle["fields"]["role_label"]["locales"]
              if l["locale"] == "en-us")
    assert en["status"] == "manual"
    assert en["value"] == "Founding Partner & Creative Director"


# ── 4. Locked locale blocks regeneration ──────────────────────────────
def test_locked_locale_blocks_regeneration(profile_id):
    with patch("services.profile_identity_resolver.translate", side_effect=_fake_translate):
        pir.upsert_source(
            profile_id=profile_id, tenant_id=STUDIO_TENANT_ID,
            field="role_label", source_value="Fondatore", source_locale="it-IT",
        )
    pir.lock_locale(
        profile_id=profile_id, tenant_id=STUDIO_TENANT_ID,
        field="role_label", target_locale="en-US", locked=True,
    )
    with patch("services.profile_identity_resolver.translate", side_effect=_fake_translate):
        with pytest.raises(PermissionError):
            pir.regenerate_locale(
                profile_id=profile_id, tenant_id=STUDIO_TENANT_ID,
                field="role_label", target_locale="en-US",
            )


# ── 5. Restore-ALE drops manual override ──────────────────────────────
def test_restore_ale_drops_manual(profile_id):
    with patch("services.profile_identity_resolver.translate", side_effect=_fake_translate):
        pir.upsert_source(
            profile_id=profile_id, tenant_id=STUDIO_TENANT_ID,
            field="role_label", source_value="Fondatore", source_locale="it-IT",
        )
    pir.set_manual(
        profile_id=profile_id, tenant_id=STUDIO_TENANT_ID,
        field="role_label", target_locale="en-US", value="MY OVERRIDE",
    )
    with patch("services.profile_identity_resolver.translate", side_effect=_fake_translate):
        pir.restore_ale(
            profile_id=profile_id, tenant_id=STUDIO_TENANT_ID,
            field="role_label", target_locale="en-US",
        )
    bundle = pir.get_identity(profile_id=profile_id, tenant_id=STUDIO_TENANT_ID)
    en = next(l for l in bundle["fields"]["role_label"]["locales"]
              if l["locale"] == "en-us")
    assert en["status"] == "auto"
    assert "MY OVERRIDE" not in (en["value"] or "")


# ── 6. resolve_for_locale uses in-family fallback ─────────────────────
def test_resolve_for_locale_in_family_fallback(profile_id):
    with patch("services.profile_identity_resolver.translate", side_effect=_fake_translate):
        pir.upsert_source(
            profile_id=profile_id, tenant_id=STUDIO_TENANT_ID,
            field="role_label", source_value="Fondatore", source_locale="it-IT",
        )
    out = pir.resolve_for_locale(
        profile_id=profile_id, tenant_id=STUDIO_TENANT_ID, locale="en-US",
    )
    assert "[en-US]" in (out.get("role_label") or "")


# ── 7. Directive builder hits all enabled locales gracefully ──────────
def test_directive_builder_returns_calibration_per_locale():
    for loc in ("en-US", "en-GB", "de-DE", "fr-FR", "es-ES"):
        d = build_profile_identity_addendum(loc)
        assert "International Studio Narrative" in d
        assert "LOCALE CALIBRATION" in d, f"calibration missing for {loc}"


# ── 8. Status taxonomy reports `missing` when nothing exists ──────────
def test_get_identity_reports_missing_for_unwritten_fields(profile_id):
    bundle = pir.get_identity(profile_id=profile_id, tenant_id=STUDIO_TENANT_ID)
    for field in pir.SUPPORTED_FIELDS:
        assert bundle["fields"][field]["source_value"] is None
        for loc in bundle["fields"][field]["locales"]:
            assert loc["status"] == "missing"
