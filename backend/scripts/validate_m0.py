"""M0 Validation Plan — Relationship OS Foundation.

Esegue check completo dello stato post-migration 031:
  1. Tabelle nuove esistono, columns corrette
  2. Indici creati (partial + GIN)
  3. Catalog seed completi (20+11+8+8)
  4. Backfill event_type_code applicato sui 38 eventi storici
  5. FK fk_sre_event_type_code attaccata
  6. View v_relationship_timeline interrogabile
  7. LEGACY READ-ONLY comments applicati
  8. Idempotenza: re-run del migration runner non distrugge dati
  9. Regression: studio_relations / studio_relationship_events
     funzionano come prima
 10. EXPLAIN ANALYZE sulle query critiche

Output: rapporto stdout + JSON dump in /tmp/m0_validation.json
"""
from __future__ import annotations
import asyncio, json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import AsyncSessionLocal
from sqlalchemy import text


CHECKS: list[dict] = []


def add(name: str, ok: bool, **kw):
    CHECKS.append({"name": name, "ok": ok, **kw})
    icon = "✅" if ok else "❌"
    extra = " ".join(f"{k}={v}" for k, v in kw.items())
    print(f"  {icon} {name}  {extra}")


async def main() -> int:
    t0 = time.time()
    async with AsyncSessionLocal() as s:
        # --- 1. Tabelle esistono
        print("\n[1] New tables exist")
        for t in ("tenant_contacts", "relationship_activities",
                  "platform_relationship_event_types", "platform_contact_roles",
                  "platform_activity_types", "platform_contact_sources"):
            r = (await s.execute(text(
                "SELECT 1 FROM information_schema.tables WHERE table_name=:t"),
                {"t": t})).scalar()
            add(f"table.{t}", r == 1)

        # --- 2. Columns critiche su tenant_contacts (provenance + readiness + owner)
        print("\n[2] tenant_contacts columns")
        cols = {r[0] for r in (await s.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name='tenant_contacts'"))).all()}
        for c in ("relationship_owner_user_id", "owner_assigned_at", "owner_assigned_by",
                  "source_code", "source_reference",
                  "relationship_score", "last_touch_at",
                  "is_primary", "status", "metadata"):
            add(f"col.tenant_contacts.{c}", c in cols)

        # --- 3. ALTER studio_relationship_events
        print("\n[3] studio_relationship_events ALTER")
        cols = {r[0] for r in (await s.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name='studio_relationship_events'"))).all()}
        for c in ("tenant_id", "event_type_code"):
            add(f"col.studio_relationship_events.{c}", c in cols)

        # --- 4. Indici creati
        print("\n[4] Indices")
        EXPECTED_IDX = [
            "idx_tenant_contacts_tenant_status",
            "idx_tenant_contacts_email_lower",
            "uq_tenant_contacts_primary_active",
            "idx_tenant_contacts_role",
            "idx_tenant_contacts_owner",
            "idx_tenant_contacts_score",
            "idx_tenant_contacts_source",
            "idx_tenant_contacts_search",
            "idx_studio_relations_search",
            "idx_relationship_activities_tenant_when",
            "idx_relationship_activities_owner_due",
            "idx_relationship_events_tenant_when",
            "idx_relationship_notifications_recipient_unread",
            "idx_relationship_notifications_tenant_unread",
        ]
        existing = {r[0] for r in (await s.execute(text(
            "SELECT indexname FROM pg_indexes WHERE schemaname='public'"))).all()}
        for ix in EXPECTED_IDX:
            add(f"index.{ix}", ix in existing)

        # --- 5. Catalog seeds
        print("\n[5] Catalog seeds")
        for tbl, expected in [
            ("platform_relationship_event_types", 27),  # M0 seed (20) + M2 email-template codes (7)
            ("platform_contact_roles", 11),
            ("platform_activity_types", 8),
            ("platform_contact_sources", 8),
        ]:
            cnt = (await s.execute(text(f"SELECT COUNT(*) FROM {tbl}"))).scalar()
            add(f"seed.{tbl}", cnt == expected, count=cnt, expected=expected)

        # Whitelist eventi che NON appaiono in timeline (D5) — 4 codici:
        # temperature_changed, password_set, password_reset_requested, contact_archived
        excluded = (await s.execute(text(
            "SELECT code FROM platform_relationship_event_types WHERE show_in_timeline=FALSE ORDER BY code"))).all()
        excluded_codes = [r[0] for r in excluded]
        add("seed.timeline_excluded_codes", len(excluded_codes) == 4,
            codes=",".join(excluded_codes))

        # Quick actions M1 = 5 codici
        qa = (await s.execute(text(
            "SELECT code FROM platform_activity_types WHERE quick_action_m1=TRUE ORDER BY sort_order"))).all()
        qa_codes = [r[0] for r in qa]
        add("seed.quick_action_m1", qa_codes == ["call","email","whatsapp","linkedin","internal_note"],
            codes=",".join(qa_codes))

        # --- 6. Backfill event_type_code sugli eventi storici
        print("\n[6] Backfill event_type_code")
        backfilled = (await s.execute(text(
            "SELECT COUNT(*) FROM studio_relationship_events WHERE event_type_code IS NOT NULL"))).scalar()
        total      = (await s.execute(text(
            "SELECT COUNT(*) FROM studio_relationship_events"))).scalar()
        add("backfill.event_type_code", backfilled > 0, backfilled=backfilled, total=total)

        # tenant_id backfill
        tid_filled = (await s.execute(text(
            "SELECT COUNT(*) FROM studio_relationship_events WHERE tenant_id IS NOT NULL"))).scalar()
        add("backfill.tenant_id", tid_filled > 0, filled=tid_filled, total=total)

        # --- 7. FK fk_sre_event_type_code
        print("\n[7] FK constraint")
        fk = (await s.execute(text(
            "SELECT 1 FROM information_schema.table_constraints "
            "WHERE constraint_name='fk_sre_event_type_code'"))).scalar()
        add("fk.fk_sre_event_type_code", fk == 1)

        # --- 8. View v_relationship_timeline interrogabile
        print("\n[8] View v_relationship_timeline")
        view_exists = (await s.execute(text(
            "SELECT 1 FROM pg_views WHERE viewname='v_relationship_timeline'"))).scalar()
        add("view.exists", view_exists == 1)
        try:
            view_count = (await s.execute(text(
                "SELECT COUNT(*) FROM v_relationship_timeline"))).scalar()
            add("view.queryable", True, rows=view_count)
        except Exception as e:
            add("view.queryable", False, error=str(e)[:80])

        # --- 9. LEGACY READ-ONLY comments
        print("\n[9] LEGACY READ-ONLY comments")
        for t in ("contacts", "accounts", "studio_team_members", "notifications",
                  "tenant_activity_events", "advisor_lead_activities", "advisor_notes"):
            r = (await s.execute(text("""
                SELECT obj_description((:t)::regclass) FROM (SELECT 1) x WHERE EXISTS
                  (SELECT 1 FROM information_schema.tables WHERE table_name=:tn)
            """), {"t": t, "tn": t})).scalar()
            ok = bool(r and "LEGACY" in r and "READ-ONLY" in r)
            add(f"legacy.{t}.comment", ok, comment=(r or "")[:60])

        # --- 10. Regression: studio_relations e events ancora interrogabili
        print("\n[10] Regression")
        try:
            n_rel  = (await s.execute(text("SELECT COUNT(*) FROM studio_relations"))).scalar()
            n_evt  = (await s.execute(text("SELECT COUNT(*) FROM studio_relationship_events"))).scalar()
            add("regression.studio_relations.count",   n_rel  >= 19, count=n_rel)
            add("regression.studio_relationship_events.count", n_evt >= 38, count=n_evt)
        except Exception as e:
            add("regression.basic_queries", False, error=str(e)[:80])

        # --- 11. EXPLAIN ANALYZE sulle query critiche
        print("\n[11] EXPLAIN ANALYZE (target <300ms su index)")
        for q_name, q in [
            ("idx.tenant_contacts.search",
             "EXPLAIN (FORMAT JSON, ANALYZE, TIMING ON) "
             "SELECT id FROM tenant_contacts WHERE to_tsvector('simple', "
             "coalesce(first_name,'')||' '||coalesce(last_name,'')) @@ plainto_tsquery('simple','test')"),
            ("idx.studio_relations.search",
             "EXPLAIN (FORMAT JSON, ANALYZE, TIMING ON) "
             "SELECT id FROM studio_relations WHERE to_tsvector('simple', "
             "coalesce(studio_name,'')) @@ plainto_tsquery('simple','interior')"),
        ]:
            try:
                plan = (await s.execute(text(q))).scalar()
                plan_json = plan if isinstance(plan, list) else [plan]
                exec_time = plan_json[0].get("Execution Time", -1) if isinstance(plan_json[0], dict) else -1
                add(f"explain.{q_name}", exec_time < 300, ms=round(exec_time, 1))
            except Exception as e:
                add(f"explain.{q_name}", False, error=str(e)[:80])

        # --- 12. Idempotenza marker (catalog count stesso post seed re-run)
        print("\n[12] Re-run seed idempotency (event_types)")
        # Re-import & re-run seed_relationship_event_types
        try:
            from scripts.seed_relationship_event_types import main as seed_main_a
            from scripts.seed_contact_roles            import main as seed_main_b
            await seed_main_a()
            await seed_main_b()
            cnt1 = (await s.execute(text("SELECT COUNT(*) FROM platform_relationship_event_types"))).scalar()
            cnt2 = (await s.execute(text("SELECT COUNT(*) FROM platform_contact_roles"))).scalar()
            add("idempotent.event_types_count_stable",   cnt1 == 27, count=cnt1)
            add("idempotent.contact_roles_count_stable", cnt2 == 11, count=cnt2)
        except Exception as e:
            add("idempotent.seed_rerun", False, error=str(e)[:120])

    # --- Riepilogo
    total = len(CHECKS)
    passed = sum(1 for c in CHECKS if c["ok"])
    failed = total - passed
    print(f"\n{'='*60}")
    print(f"M0 VALIDATION SUMMARY: {passed}/{total} PASS · {failed} FAIL  in {time.time()-t0:.2f}s")
    if failed:
        print("\nFailures:")
        for c in CHECKS:
            if not c["ok"]:
                print(f"  ❌ {c['name']}  " + " ".join(f"{k}={v}" for k,v in c.items() if k not in ("name","ok")))
    out = {"summary": {"total": total, "pass": passed, "fail": failed},
           "checks": CHECKS}
    with open("/tmp/m0_validation.json", "w") as f:
        json.dump(out, f, indent=2, default=str)
    print(f"\nJSON dump → /tmp/m0_validation.json")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
