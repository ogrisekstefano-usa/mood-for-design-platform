"""Phase P0.3.C PREP — Curated Demo Intelligence Set.

Seeds 6 design_references grouped into 3 curated editorial collections,
each interpreted natively across IT_IT, EN_US, EN_AE, DE_DE, FR_FR.

The seed is IDEMPOTENT — re-running upserts by a stable curator marker
("seed-p03-demo-vN"). Existing demo references / collections from earlier
runs are deleted first to avoid drift.

Cultural Design Intelligence™ guarantees enforced:
  • NO RAW IMPORTS — every reference passes through the editorial
    interpretation pipeline via with_runtime_prompt(locale_profile).
  • Market reinterpretation, NOT translation — 5 native readings per
    reference produced by claude-sonnet-4-5-20250929.
  • Advisor notes are HUMAN — written here verbatim, not LLM-generated.
  • Timeline events fire for project-linked references — human language only.

Usage:
    cd /app/backend && python3 scripts/seed_p03_demo_intelligence.py
    cd /app/backend && python3 scripts/seed_p03_demo_intelligence.py --locales IT_IT,EN_AE
    cd /app/backend && python3 scripts/seed_p03_demo_intelligence.py --skip-llm  # data only, no AI

LLM cost: ~30 calls (6 refs × 5 locales) — about $0.75 of EMERGENT_LLM_KEY
budget. The script is resumable: already-existing (reference, locale)
interpretations are skipped on re-run.
"""
import argparse
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from database import db  # noqa: E402
from routers.reference_intelligence import _interpret_and_store  # noqa: E402


# ─── Constants ───────────────────────────────────────────────────────────

TENANT_SLUG = "mood-demo-studio-81a09e"
SEED_MARKER = "seed-p03-demo-v1"     # curator_name tag → idempotency anchor

# Stable identities (verified in DB)
STEFANO   = "aaba9520-68e6-400b-8d11-06b6e4cfbfd8"   # super_admin · curator
ELIZABETH = "a0000001-c001-4001-8001-000000000001"   # Lead Designer
DIEGO     = "a0000001-c001-4001-8001-000000000002"   # Senior Architect
SOFIA     = "a0000001-c001-4001-8001-000000000003"   # Materials Curator

PROJECT_ID = "fdbe3c60-d630-46d1-9dc4-92ba9224b92a"  # Villa Toscana (residential)

DEFAULT_LOCALES = ("IT_IT", "EN_US", "EN_AE", "DE_DE", "FR_FR")


# ─── Cinematic editorial imagery (Unsplash, curated) ─────────────────────

IMG = {
    "mediterranean_residence":
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2200&q=85",
    "puglian_guesthouse":
        "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=2200&q=85",
    "atelier_boutique":
        "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=2200&q=85",
    "executive_library_office":
        "https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=2200&q=85",
    "hammam_wellness":
        "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=2200&q=85",
    "collector_library_residence":
        "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=2200&q=85",
}


# ─── The 6 references (rich design metadata, not technical metadata) ─────

REFERENCES = [
    {
        "key":  "residence_ligure",
        "imported_image_url":  IMG["mediterranean_residence"],
        "source_type":  "curator_pick",
        "source_url":   "https://moodfordesign.com/research/mediterranean-residence",
        "curator_name": "Camilla Ferri · MOOD Research",
        "locale_origin": "IT_IT",
        "design_intent":
            "Costiera ligure · residenza privata composta attraverso travertino "
            "levigato, lino crudo e luce filtrata — direzione di restrained "
            "Mediterranean warmth con sospensione editoriale.",
        "advisor_notes":
            "This residence reads as a quiet manifesto of Mediterranean material "
            "culture — a useful counterpoint when a client mistakes warmth for "
            "ornament. Stefano",
        "linked_advisor": STEFANO,
        "project_id":  PROJECT_ID,
    },
    {
        "key":  "puglian_guesthouse",
        "imported_image_url":  IMG["puglian_guesthouse"],
        "source_type":  "curator_pick",
        "source_url":   "https://moodfordesign.com/research/puglian-guesthouse",
        "curator_name": "Stefano Ogrisek · MOOD Studio",
        "locale_origin": "IT_IT",
        "design_intent":
            "Masseria boutique sull'Adriatico · ospitalità a scala privata "
            "composta attraverso volumi in pietra a vista, soglie generose e "
            "luce mediterranea calibrata. Materiali primari: travertino, "
            "terracotta, lino, ottone spazzolato.",
        "advisor_notes":
            "This atmosphere could evolve the hospitality direction for UAE "
            "clients — restrained Mediterranean welcome without the cliché. "
            "Worth discussing in our next Hamptons brief as well.",
        "linked_advisor": STEFANO,
        "project_id":  None,
    },
    {
        "key":  "atelier_boutique",
        "imported_image_url":  IMG["atelier_boutique"],
        "source_type":  "curator_pick",
        "source_url":   "https://moodfordesign.com/research/atelier-retail",
        "curator_name": "Sofia Rinaldi · Materials Curator",
        "locale_origin": "EN_GB",
        "design_intent":
            "Atelier retail environment composed as gallery — oak millwork, "
            "brushed brass, raw plaster walls — restraint engineered to let "
            "the product breathe. Architecture as narrative pace, not signage.",
        "advisor_notes":
            "Interesting restraint for executive environments with architectural "
            "positioning — the retail register reads as private consultancy more "
            "than commerce. Sofia",
        "linked_advisor": SOFIA,
        "project_id":  None,
    },
    {
        "key":  "executive_library_office",
        "imported_image_url":  IMG["executive_library_office"],
        "source_type":  "curator_pick",
        "source_url":   "https://moodfordesign.com/research/library-office",
        "curator_name": "Diego Marín · Senior Architect",
        "locale_origin": "EN_US",
        "design_intent":
            "Executive workspace composed as private library — dark walnut "
            "shelving, travertine threshold, leather, art at architectural "
            "scale. Hospitality codes applied to a workplace.",
        "advisor_notes":
            "Architectural hospitality applied to executive space — useful "
            "reference when a developer client asks 'why are we hiring an "
            "interior firm for offices?'. Diego",
        "linked_advisor": DIEGO,
        "project_id":  PROJECT_ID,
    },
    {
        "key":  "hammam_wellness",
        "imported_image_url":  IMG["hammam_wellness"],
        "source_type":  "curator_pick",
        "source_url":   "https://moodfordesign.com/research/hammam-wellness",
        "curator_name": "Sofia Rinaldi · Materials Curator",
        "locale_origin": "EN_AE",
        "design_intent":
            "Wellness threshold composed through onyx, water reflection and "
            "calibrated shadow — atmosphere as primary material. Hammam logic "
            "elevated to contemporary collectible spa.",
        "advisor_notes":
            "This material layering supports a quieter luxury narrative — "
            "especially relevant for Gulf hospitality clients moving away from "
            "spectacle and toward sensorial restraint. Sofia",
        "linked_advisor": SOFIA,
        "project_id":  None,
    },
    {
        "key":  "collector_library_residence",
        "imported_image_url":  IMG["collector_library_residence"],
        "source_type":  "curator_pick",
        "source_url":   "https://moodfordesign.com/research/collector-residence",
        "curator_name": "Elizabeth Whitcomb · Lead Designer",
        "locale_origin": "EN_GB",
        "design_intent":
            "Collector residence · private library composed around a single "
            "art piece, dark walnut, raw silk, scholar's lamp. Restraint as "
            "the loudest gesture — material gravity over decorative density.",
        "advisor_notes":
            "A collector-grade reference — anchors the conversation when a "
            "client asks for 'quiet luxury' without knowing it means editing, "
            "not adding. Elizabeth",
        "linked_advisor": ELIZABETH,
        "project_id":  None,
    },
]


# ─── The 3 curated collections ───────────────────────────────────────────

COLLECTIONS = [
    {
        "key":  "mediterranean_quiet_luxury",
        "title": "Mediterranean Quiet Luxury™",
        "subtitle": "Restrained Mediterranean material warmth.",
        "atmosphere_direction":
            "Travertine, raw linen, brass — warmth engineered through "
            "restraint, never through ornament.",
        "project_vertical": "residential",
        "market_focus": "IT_IT",
        "advisor_id": STEFANO,
        "references": ["residence_ligure", "puglian_guesthouse"],
    },
    {
        "key":  "architectural_hospitality_signals",
        "title": "Architectural Hospitality Signals™",
        "subtitle": "Architectural atmosphere as hospitality strategy.",
        "atmosphere_direction":
            "Hospitality codes — generous thresholds, calibrated light, "
            "material gravity — applied beyond hotels: into retail, into "
            "executive environments.",
        "project_vertical": "hospitality",
        "market_focus": "EN_AE",
        "advisor_id": DIEGO,
        # puglian_guesthouse shared with collection 01 (soft membership)
        "references": [
            "puglian_guesthouse", "atelier_boutique", "executive_library_office",
        ],
    },
    {
        "key":  "collectible_material_atmospheres",
        "title": "Collectible Material Atmospheres™",
        "subtitle": "Editorial material layering and tactile storytelling.",
        "atmosphere_direction":
            "Onyx, walnut, raw silk, water reflection — atmosphere read as a "
            "primary material, never as a finish.",
        "project_vertical": "collector",
        "market_focus": "EN_GB",
        "advisor_id": SOFIA,
        "references": ["hammam_wellness", "collector_library_residence"],
    },
]


# ─── Helpers ─────────────────────────────────────────────────────────────

def _iso():
    return datetime.now(timezone.utc).isoformat()


def _resolve_tenant(c):
    r = c.table("tenants").select("id").eq("slug", TENANT_SLUG).limit(1).execute().data
    if not r:
        raise SystemExit(f"tenant {TENANT_SLUG} missing — re-run seed_demo_users.py")
    return r[0]["id"]


def _cleanup_prior_seed(c, tid: str) -> None:
    """Delete all references + collections from previous seed runs (by marker).
    Cascade removes interpretations and collection items."""
    # Collections (any with the title pattern we own)
    titles = [c["title"] for c in COLLECTIONS]
    if titles:
        c.table("reference_collections").delete().eq("tenant_id", tid)\
            .in_("title", titles).execute()
    # References — match by source_url prefix (stable across runs).
    seed_urls = [r["source_url"] for r in REFERENCES if r.get("source_url")]
    if seed_urls:
        c.table("design_references").delete().eq("tenant_id", tid)\
            .in_("source_url", seed_urls).execute()


def _push_activity(c, *, tenant_id, project_id, actor_id, event_type, label,
                   ref_id, payload=None):
    if not project_id:
        return
    try:
        c.table("project_activity").insert({
            "id":         str(uuid.uuid4()),
            "tenant_id":  tenant_id,
            "project_id": project_id,
            "actor_id":   actor_id,
            "event_type": event_type,
            "label":      label[:200],
            "ref_id":     ref_id,
            "payload":    payload or {},
        }).execute()
    except Exception as e:
        print(f"   ! timeline event failed: {e}")


# ─── Main ────────────────────────────────────────────────────────────────

async def run(locales: tuple, skip_llm: bool):
    c = db()
    if c is None:
        raise SystemExit("Supabase admin client unavailable — check /app/backend/.env")
    tid = _resolve_tenant(c)
    print(f"→ tenant: {TENANT_SLUG} ({tid})")
    print(f"→ locales for interpretation: {', '.join(locales)}")
    if skip_llm:
        print("→ --skip-llm: references will stay in processing_editorial_reading "
              "(use this to seed structure only)")

    print("→ cleaning prior seed (idempotent)")
    _cleanup_prior_seed(c, tid)

    # 1. Insert references (status starts as processing_editorial_reading)
    ref_by_key: dict = {}
    for spec in REFERENCES:
        rid = str(uuid.uuid4())
        row = {
            "id":                  rid,
            "tenant_id":           tid,
            "project_id":          spec.get("project_id"),
            "source_type":         spec["source_type"],
            "source_url":          spec.get("source_url"),
            "imported_image_url":  spec["imported_image_url"],
            "curator_name":        spec["curator_name"],
            "locale_origin":       spec.get("locale_origin"),
            "editorial_status":    "processing_editorial_reading",
            "design_intent":       spec.get("design_intent"),
            "advisor_notes":       spec.get("advisor_notes"),
            "created_by":          spec.get("linked_advisor") or STEFANO,
            "created_at":          _iso(),
            "updated_at":          _iso(),
        }
        c.table("design_references").insert(row).execute()
        ref_by_key[spec["key"]] = {**row, "spec": spec}
        print(f"   • inserted reference [{spec['key']}] → {rid}")

    # 2. Generate cultural interpretations
    if not skip_llm:
        for key, ref in ref_by_key.items():
            existing = (c.table("reference_locale_interpretations")
                        .select("locale").eq("reference_id", ref["id"])
                        .execute().data or [])
            already = {r["locale"] for r in existing}
            print(f"\n   ◇ interpreting [{key}] across {len(locales)} locales …")
            for code in locales:
                if code in already:
                    print(f"      ↳ {code}: already present (skip)")
                    continue
                interp = await _interpret_and_store(
                    c, ref, code,
                    actor_id=ref["spec"].get("linked_advisor") or STEFANO,
                )
                if interp:
                    snippet = (interp.get("atmosphere") or "")[:80]
                    score = interp.get("market_fit_score")
                    print(f"      ↳ {code}: ✓  score={score}  · {snippet}")
                else:
                    print(f"      ↳ {code}: ✗  (LLM unreachable — staying processing)")
                # gentle pacing to avoid budget spikes
                await asyncio.sleep(0.5)

            # If at least one interpretation landed, promote the reference.
            interp_count = (c.table("reference_locale_interpretations")
                            .select("id", count="exact")
                            .eq("reference_id", ref["id"])
                            .execute().count or 0)
            if interp_count > 0:
                c.table("design_references").update({
                    "editorial_status": "ready",
                    "updated_at":       _iso(),
                }).eq("id", ref["id"]).execute()
                ref["editorial_status"] = "ready"

    # 3. Build collections + memberships
    print("\n→ assembling 3 curated collections")
    coll_by_key: dict = {}
    for spec in COLLECTIONS:
        cid = str(uuid.uuid4())
        c.table("reference_collections").insert({
            "id":                   cid,
            "tenant_id":            tid,
            "advisor_id":           spec["advisor_id"],
            "title":                spec["title"],
            "subtitle":             spec["subtitle"],
            "atmosphere_direction": spec["atmosphere_direction"],
            "project_vertical":     spec["project_vertical"],
            "market_focus":         spec["market_focus"],
            "created_at":           _iso(),
            "updated_at":           _iso(),
        }).execute()
        coll_by_key[spec["key"]] = cid
        print(f"   • {spec['title']} → {cid}")
        for rk in spec["references"]:
            ref = ref_by_key.get(rk)
            if not ref:
                continue
            c.table("reference_collection_items").insert({
                "id":            str(uuid.uuid4()),
                "tenant_id":     tid,
                "collection_id": cid,
                "reference_id":  ref["id"],
                "added_by":      spec["advisor_id"],
                "added_at":      _iso(),
            }).execute()
        print(f"      ↳ linked {len(spec['references'])} references")

    # 4. Timeline events for project-linked references (only those that are 'ready')
    print("\n→ emitting timeline events for project-linked references")
    for key, ref in ref_by_key.items():
        pid = ref.get("project_id")
        if not pid or ref.get("editorial_status") != "ready":
            continue
        # Pull one interpretation to use in the human label
        interp = (c.table("reference_locale_interpretations").select("atmosphere,locale")
                  .eq("reference_id", ref["id"]).order("generated_at", desc=True)
                  .limit(1).execute().data or [])
        atm = (interp[0].get("atmosphere") if interp else "") or "a new editorial direction"
        first_clause = atm.split(".")[0]
        # Use the advisor's first name (looked up live so output reads naturally)
        prof = (c.table("users_profile").select("first_name")
                .eq("id", ref["created_by"]).limit(1).execute().data or [])
        actor_first = (prof[0].get("first_name") if prof else "L'advisor")
        label = f"{actor_first} added {first_clause[:120]}"
        _push_activity(c,
            tenant_id=tid,
            project_id=pid,
            actor_id=ref["created_by"],
            event_type="reference.added",
            label=label,
            ref_id=ref["id"],
            payload={"locale": interp[0].get("locale") if interp else None},
        )
        print(f"   • timeline · {label}")

    # ─── Summary ────────────────────────────────────────────────────────
    ready_refs = (c.table("design_references")
                  .select("id", count="exact")
                  .eq("tenant_id", tid)
                  .eq("editorial_status", "ready")
                  .in_("source_url", [r["source_url"] for r in REFERENCES])
                  .execute().count or 0)
    interp_total = 0
    for ref in ref_by_key.values():
        interp_total += (c.table("reference_locale_interpretations")
                         .select("id", count="exact")
                         .eq("reference_id", ref["id"])
                         .execute().count or 0)

    print("\n" + "═" * 60)
    print(f"  ✓ References inserted:    {len(REFERENCES)}")
    print(f"  ✓ References ready:       {ready_refs}")
    print(f"  ✓ Interpretations stored: {interp_total}")
    print(f"  ✓ Collections created:    {len(COLLECTIONS)}")
    print(f"  ✓ Curator marker:         {SEED_MARKER}")
    print("═" * 60)


def _parse_locales(raw: str) -> tuple:
    if not raw:
        return DEFAULT_LOCALES
    items = [s.strip().upper() for s in raw.split(",") if s.strip()]
    return tuple(items) or DEFAULT_LOCALES


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--locales", default=",".join(DEFAULT_LOCALES),
        help="Comma-separated locale codes (default: all 5)",
    )
    parser.add_argument(
        "--skip-llm", action="store_true",
        help="Insert references + collections only — skip AI interpretation",
    )
    args = parser.parse_args()
    asyncio.run(run(_parse_locales(args.locales), args.skip_llm))


if __name__ == "__main__":
    main()
